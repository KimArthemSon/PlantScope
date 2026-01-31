import math
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from .models import User, profile
from security.models import SecurityLog
from security.views import log_event, is_lock
import json
import hashlib
import jwt
from datetime import datetime, timedelta
import re
from django.conf import settings
from django.db import DatabaseError, connection, transaction


@csrf_exempt
def register_user(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)
    
    required_fields = [
        'email',
        'password',
        'user_role',
        'first_name',
        'last_name',
        "is_active" , 
        "birthday" , 
        "contact" ,
        "address" , 
        "gender" ,
    ]

    missing = [f for f in required_fields if not request.POST.get(f)]

    if not request.FILES.get('profile_img'):
        missing.append('profile_img')
    
    if missing:
        return JsonResponse({
            'error': 'Missing required fields',
            'fields': missing
        }, status=400)
    
    email = request.POST.get('email')
    user_role = request.POST.get('user_role')
    is_active =  request.POST.get('is_active').lower() == 'true'
    password = request.POST.get('password')
    first_name =  request.POST.get('first_name')
    middle_name = request.POST.get('middle_name')
    last_name =  request.POST.get('last_name')
    birthday =  request.POST.get('birthday')
    contact = request.POST.get('contact')
    address =  request.POST.get('address')
    profile_img = request.FILES.get('profile_img')
    gender = request.POST.get('gender')
    

    password_regex = r'^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$'

    if not re.match(password_regex, password):
        return JsonResponse({
            'error': 'Password must contain uppercase, lowercase, number, special character, and be at least 8 characters long.'
        }, status=400)

   
    if User.objects.filter(email=email).exists():
        return JsonResponse({'error': 'Email already exists'}, status=400)

   
    hashed_password = hashlib.sha256(password.encode()).hexdigest()
    try:
        with transaction.atomic():
            
            user = User.objects.create(
            email=email,
            password=hashed_password,
            user_role=user_role,
            is_active=is_active
            )

            profile.objects.create(
            users = user,
            first_name = first_name,
            middle_name = middle_name,
            last_name = last_name,
            birthday = birthday,
            contact = contact,
            address = address,
            profile_img = profile_img,
            gender = gender,
            )

    except Exception as e:
        print(e)
        return JsonResponse(
            {'error': f'Missing fields, Please try again {e}'}, status=400)
    

    return JsonResponse({'message': 'User registered successfully', 'user_id': user.id})

@csrf_exempt
def login_user(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)
    
    try:
        data = json.loads(request.body)
        email = data['email']
        password = data['password']
        ip = request.META.get("HTTP_X_FORWARDED_FOR", request.META.get("REMOTE_ADDR"))
    except KeyError:
        return JsonResponse({'error': 'Missing fields, Please try again'}, status=400)
    if is_lock(ip):
            return JsonResponse({'error': 'Too many failed attempts. Try again later.'}, status=403)
    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        log_event(None, email, SecurityLog.LOGIN_FAILED, ip_address=ip, user_agent=request.META.get('HTTP_USER_AGENT'))
        return JsonResponse({'error': 'Login failed. Please check your credentials.'}, status=401)

    # Hash the input password and compare
    hashed_password = hashlib.sha256(password.encode()).hexdigest()
    if hashed_password != user.password:
     
        log_event(None, email, SecurityLog.LOGIN_FAILED, ip_address=ip, user_agent=request.META.get('HTTP_USER_AGENT'))
        return JsonResponse({'error': 'Login failed. Please check your credentials.'}, status=401)
    

    log_event(user, email, SecurityLog.LOGIN_SUCCESS, ip_address=ip, user_agent=request.META.get('HTTP_USER_AGENT'))
  
    payload = {
        'user_id': user.id,
        'email': user.email,
        'exp': datetime.utcnow() + timedelta(seconds=settings.JWT_EXP_DELTA_SECONDS)
    }

    token = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return JsonResponse({'token': token, 'user_role': user.user_role, 'email': user.email})

@csrf_exempt
def logout_user(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)

    user = None
    email = None

    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        try:
            payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
            user_id = payload.get("user_id")
            user = User.objects.filter(id=user_id).first()
            email = user.email if user else None
        except jwt.ExpiredSignatureError:
            return JsonResponse({'error': 'Token expired'}, status=401)
        except jwt.InvalidTokenError:
            return JsonResponse({'error': 'Invalid token'}, status=401)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)

    ip_address = request.META.get("HTTP_X_FORWARDED_FOR", request.META.get("REMOTE_ADDR"))
    user_agent = request.META.get("HTTP_USER_AGENT")

  
    log_event(user=user, email=email, event_type=SecurityLog.LOGOUT, ip_address=ip_address, user_agent=user_agent)
    return JsonResponse({'message': 'Logout successful'})

@csrf_exempt
def list_users(request):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    search = request.GET.get('search', '').strip()
    role = request.GET.get('role', 'all').strip()
    page = int(request.GET.get('page', 1))
    entries = int(request.GET.get('entries', 10))

    if role.lower() == 'all':
        role = ''

    with connection.cursor() as cursor:
        # 1️⃣ Get total count
        cursor.execute(
            '''
            SELECT COUNT(*)
            FROM accounts_user AS u
            JOIN accounts_profile AS a ON u.id = a.users_id
            WHERE u.email LIKE %s AND u.user_role LIKE %s AND u.user_role != %s
            ''',
            [f"%{search}%", f"%{role}%", "treeGrowers"]
        )
        total_count_row = cursor.fetchone()
        total_count = total_count_row[0] if total_count_row else 0
        total_pages = max(math.ceil(total_count / entries), 1)

        # 2️⃣ Fetch paginated rows
        offset = (page - 1) * entries
        cursor.execute(
            '''
            SELECT u.id, u.email, u.user_role, u.is_active, u.created_at, a.profile_img
            FROM accounts_user AS u
            JOIN accounts_profile AS a ON u.id = a.users_id
            WHERE u.email LIKE %s AND u.user_role LIKE %s AND u.user_role != %s
            ORDER BY u.created_at
            LIMIT %s OFFSET %s
            ''',
            [f"%{search}%", f"%{role}%", "treeGrowers", entries, offset]
        )

        columns = [col[0] for col in cursor.description]
        rows = [dict(zip(columns, row)) for row in cursor.fetchall()]

        # Add /media/ prefix for profile images
        users_list = [
            {**user, 'profile_img': '/media/' + user['profile_img'] if user['profile_img'] else None}
            for user in rows
        ]

    response = {
        'total_pages': total_pages,
        'accounts': users_list,
    }
    return JsonResponse(response, safe=False)

@csrf_exempt
def get_user(request, user_id):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    try:
        with connection.cursor() as cursor:
            cursor.execute('''
                SELECT *
                FROM accounts_user AS u
                JOIN accounts_profile AS a ON u.id = a.users_id
                WHERE u.id = %s
            ''', [user_id])
            
            cols = [col[0] for col in cursor.description]
            rows = [dict(zip(cols, row)) for row in cursor.fetchall()]

            if rows:
                user = rows[0]
                account = {
                    **user,
                    'profile_img': '/media/' + user['profile_img'] if user['profile_img'] else None
                }
                return JsonResponse(account)
            else:
                return JsonResponse({'error': 'User not found'}, status=404)

    except DatabaseError as e:
        # This catches any SQL/database errors
        return JsonResponse({'error': 'Database error', 'details': str(e)}, status=500)

@csrf_exempt
def update_user(request, user_id):
    if request.method not in ['POST']:
        return JsonResponse({'error': 'Only POST allowed'}, status=405)
    
    user = get_object_or_404(User, id=user_id)
    user_profile = getattr(user, 'profile', None)

    # Required fields (optional updates, so only validate password if provided)
    password_regex = r'^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$'

    try:
        # Use form-data instead of JSON
        email = request.POST.get('email', user.email)
        user_role = request.POST.get('user_role', user.user_role)
        is_active = request.POST.get('is_active', str(user.is_active)).lower() == 'true'
        password = request.POST.get('password', None)

        first_name = request.POST.get('first_name', user_profile.first_name if user_profile else "")
        middle_name = request.POST.get('middle_name', user_profile.middle_name if user_profile else "")
        last_name = request.POST.get('last_name', user_profile.last_name if user_profile else "")
        birthday = request.POST.get('birthday', user_profile.birthday if user_profile else None)
        contact = request.POST.get('contact', user_profile.contact if user_profile else "")
        address = request.POST.get('address', user_profile.address if user_profile else "")
        gender = request.POST.get('gender', user_profile.gender if user_profile else "")
        profile_img = request.FILES.get('profile_img', getattr(user_profile, 'profile_img', None))

        # Validate password if provided
        if password:
            if not re.match(password_regex, password):
                return JsonResponse({
                    'error': 'Password must contain uppercase, lowercase, number, special character, and be at least 8 characters long.'
                }, status=400)
            hashed_password = hashlib.sha256(password.encode()).hexdigest()
            user.password = hashed_password

        # Validate email uniqueness if changed
        if user.email != email and User.objects.filter(email=email).exists():
            return JsonResponse({'error': 'Email already exists'}, status=400)

        # Update user
        user.email = email
        user.user_role = user_role
        user.is_active = is_active
        user.save()

        # Update or create profile
       
        user_profile.first_name = first_name
        user_profile.middle_name = middle_name
        user_profile.last_name = last_name
        user_profile.birthday = birthday
        user_profile.contact = contact
        user_profile.address = address
        user_profile.gender = gender
        if profile_img:
            user_profile.profile_img = profile_img
        user_profile.save()
        

        return JsonResponse({'message': 'User updated successfully'})

    except Exception as e:
        print("Error:", e)
        return JsonResponse({'error': 'Something went wrong: ' + str(e)}, status=400)

@csrf_exempt 
def delete_user(request, user_id):
    if request.method != 'DELETE':
        return JsonResponse({'error': 'Only DELETE allowed'}, status=405)

    user = get_object_or_404(User, id=user_id)
    user.delete()

    return JsonResponse({'message': 'User deleted successfully'})

@csrf_exempt
def get_me(request):
    if request.method != 'POST':
         return JsonResponse({'error': 'Only POST allowed'}, status=405)
    
    try:
        
        auth_header = request.headers.get('Authorization')

        if not auth_header or not auth_header.startswith('Bearer '):
            return JsonResponse({'error': 'Authorization header missing or invalid'}, status=401)
        token = auth_header.split(' ')[1]
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        user_id = payload.get('user_id')
        user = get_object_or_404(User, id=user_id)
        
        data = {
            'id': user.id,
            'email': user.email,
            'user_role': getattr(user, "user_role", None),
        }

        return JsonResponse(data)
    
    except Exception as e:
        print("Error:", e)
        return JsonResponse({'error': 'Invalid JSON input'}, status=400)
    

    
    
    

