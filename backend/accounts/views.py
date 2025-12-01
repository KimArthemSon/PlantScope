from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from .models import User
from security.models import SecurityLog
from security.views import log_event, is_lock
import json
import hashlib
import jwt
from datetime import datetime, timedelta
import re

JWT_SECRET = 'AKOANISECRET_super_secret_key_here'
JWT_ALGORITHM = 'HS256'
JWT_EXP_DELTA_SECONDS = 3600 

@csrf_exempt
def register_user(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)

    try:
        data = json.loads(request.body)
        email = data['email']
        username = data['username']
        password = data['password']
        user_role = data.get('user_role', 'FieldOfficer')
    except KeyError:
        return JsonResponse({'error': 'Missing fields'}, status=400)
    

    password_regex = r'^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$'

    if not re.match(password_regex, password):
        return JsonResponse({
            'error': 'Password must contain uppercase, lowercase, number, special character, and be at least 8 characters long.'
        }, status=400)

   
    if User.objects.filter(email=email).exists():
        return JsonResponse({'error': 'Email already exists'}, status=400)

   
    hashed_password = hashlib.sha256(password.encode()).hexdigest()

    user = User.objects.create(
        email=email,
        username=username,
        password=hashed_password,
        user_role=user_role
    )

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
        'exp': datetime.utcnow() + timedelta(seconds=JWT_EXP_DELTA_SECONDS)
    }

    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return JsonResponse({'token': token, 'user_role': user.user_role})



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
            payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
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
    users = User.objects.all().values('id', 'email', 'username', 'user_role', 'created_at')
    return JsonResponse(list(users), safe=False)

@csrf_exempt
def get_user(request, user_id):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    user = get_object_or_404(User, id=user_id)
    data = {
        'id': user.id,
        'email': user.email,
        'username': user.username,
        'user_role': getattr(user, "user_role", None),
        'created_at': user.date_joined,
    }
    return JsonResponse(data)

@csrf_exempt
def update_user(request, user_id):
    if request.method not in ['PUT', 'PATCH']:
        return JsonResponse({'error': 'Only PUT/PATCH allowed'}, status=405)

    user = get_object_or_404(User, id=user_id)

    try:
        data = json.loads(request.body.decode('utf-8'))

        # Update basic fields
        user.username = data.get('username', user.username)
        user.email = data.get('email', user.email)
        user.user_role = data.get('user_role', user.user_role)
        password_regex = r'^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$'

        
        
        # 🔥 Update password only if provided and not empty
        if "password" in data and data["password"].strip() != "":
            if not re.match(password_regex, data["password"]):
                return JsonResponse({
                'error': 'Password must contain uppercase, lowercase, number, special character, and be at least 8 characters long.'
                }, status=400)
            
            hashed_password = hashlib.sha256(data["password"].encode()).hexdigest()
            user.password = hashed_password
        
        user.save()
       
        return JsonResponse({'message': 'User updated successfully'})

    except Exception as e:
        print("Error:", e)
        return JsonResponse({'error': 'Invalid JSON input'}, status=400)

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
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get('user_id')
        user = get_object_or_404(User, id=user_id)
        
        data = {
            'id': user.id,
            'email': user.email,
            'username': user.username,
            'user_role': getattr(user, "user_role", None),
        }

        return JsonResponse(data)
    
    except Exception as e:
        print("Error:", e)
        return JsonResponse({'error': 'Invalid JSON input'}, status=400)
    

    
    
    

