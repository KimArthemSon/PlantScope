import math
import random
import string
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from django.core.cache import cache
from django.core.mail import send_mail
from .models import User, profile, Organization
from security.models import SecurityLog
from security.views import log_event, get_lock_info, log_activity
import json
import hashlib
import jwt
from datetime import datetime, timedelta
import re
from django.conf import settings
from django.db import DatabaseError, connection, transaction
from tree_planting_programs.models import Application, SeedlingRequest


def _get_request_user(request):
    """Return (User, email) of the JWT-authenticated caller, or (None, '') on failure."""
    try:
        header = request.headers.get('Authorization', '')
        if not header.startswith('Bearer '):
            return None, ''
        payload = jwt.decode(
            header.split(' ')[1], settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM]
        )
        user = User.objects.filter(id=payload.get('user_id')).first()
        return user, (user.email if user else '')
    except Exception:
        return None, ''


def record_activity(request, action_type, entity_type, entity_id=None,
                    entity_label='', description='',
                    old_data=None, new_data=None, changed_fields=None):
    """Log a business operation performed by the JWT-authenticated caller."""
    performer, email = _get_request_user(request)
    ip = request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR'))
    log_activity(
        performed_by=performer,
        email=email,
        action_type=action_type,
        entity_type=entity_type,
        entity_id=entity_id,
        entity_label=entity_label,
        description=description,
        old_data=old_data,
        new_data=new_data,
        changed_fields=changed_fields,
        ip_address=ip,
    )


@csrf_exempt
def register_user(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)

    data = request.POST
    files = request.FILES

    # 1️ Validate required fields
    required_fields = ['email', 'password', 'user_role', 'first_name', 'last_name',
                       'birthday', 'contact', 'address', 'gender']
    missing = [f for f in required_fields if not data.get(f)]

    if not files.get('profile_img'):
        missing.append('profile_img')

    if missing:
        return JsonResponse({'error': 'Missing required fields', 'fields': missing}, status=400)

    # 2️⃣ Extract & sanitize basic user data
    email = data.get('email').strip().lower()
    password = data.get('password')
    user_role = data.get('user_role')
    first_name = data.get('first_name').strip()
    middle_name = data.get('middle_name', '').strip()
    last_name = data.get('last_name').strip()
    contact = data.get('contact').strip()
    address = data.get('address').strip()
    gender = data.get('gender')
    
    # Default to active, but treeGrowers will be set inactive later
    is_active_input = data.get('is_active', 'true').lower()
    is_active = is_active_input in ['true', '1', 'yes']

    # 3️⃣ Validate password format
    password_regex = r'^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$'
    if not re.match(password_regex, password):
        return JsonResponse({
            'error': 'Password must contain uppercase, lowercase, number, special character, and be at least 8 characters long.'
        }, status=400)

    # 4️⃣ Check email uniqueness
    if User.objects.filter(email=email).exists():
        return JsonResponse({'error': 'Email already exists'}, status=400)

    # 5️⃣ Parse birthday safely
    try:
        birthday = datetime.strptime(data.get('birthday'), '%Y-%m-%d').date()
    except ValueError:
        return JsonResponse({'error': 'Invalid birthday format. Use YYYY-MM-DD.'}, status=400)

    # 6️⃣ Handle treeGrower-specific data
    org_data = {}
    app_data = {}
    seedling_data = {}

    if user_role == 'treeGrowers':
        is_active = False  # Requires approval before activation
        
        # Organization validation
        org_required = ['organization_name', 'org_email', 'org_address', 'org_contact']
        org_missing = [f for f in org_required if not data.get(f)]
        if not files.get('org_profile'):
            org_missing.append('org_profile')
        if org_missing:
            return JsonResponse({'error': 'Missing organization fields', 'fields': org_missing}, status=400)

        org_data = {
            'organization_name': data.get('organization_name').strip(),
            'org_email': data.get('org_email').strip(),
            'org_address': data.get('org_address').strip(),
            'org_contact': data.get('org_contact').strip(),
            'org_profile': files.get('org_profile'),
        }

        # Application validation
        app_required = ['title', 'description', 'total_members', 'project_duration']
        app_missing = [f for f in app_required if not data.get(f)]
        if not files.get('maintenance_plan'):
            app_missing.append('maintenance_plan')
        if app_missing:
            return JsonResponse({'error': 'Missing application fields', 'fields': app_missing}, status=400)

        try:
            total_members = int(data.get('total_members'))
            project_duration = int(data.get('project_duration'))
        except ValueError:
            return JsonResponse({'error': 'total_members and project_duration must be valid integers.'}, status=400)

        app_data = {
            'title': data.get('title').strip(),
            'description': data.get('description').strip(),
            'total_members': total_members,
            'project_duration': project_duration,
            'maintenance_plan': files.get('maintenance_plan'),
        }

        # Seedling Request validation
        if not data.get('no_request_seedling') or not data.get('seedling_type'):
            return JsonResponse({'error': 'Missing seedling request fields: no_request_seedling, seedling_type'}, status=400)

        try:
            no_request_seedling = int(data.get('no_request_seedling'))
            # Expect JSON string from mobile: {"mahogany": 30, "narra": 20}
            seedling_type = json.loads(data.get('seedling_type'))
            if not isinstance(seedling_type, dict):
                raise ValueError("seedling_type must be a JSON object")
        except (ValueError, json.JSONDecodeError) as e:
            return JsonResponse({'error': f'Invalid seedling data: {str(e)}'}, status=400)

        seedling_data = {
            'no_request_seedling': no_request_seedling,
            'description': data.get('seedling_description', '').strip(),
        }

    # 7️⃣ Database Transaction
    try:
        with transaction.atomic():
            # Create User
            hashed_password = hashlib.sha256(password.encode()).hexdigest()
            user = User.objects.create(
                email=email,
                password=hashed_password,
                user_role=user_role,
                is_active=is_active
            )

            # Create Profile
            profile.objects.create(
                users=user,
                first_name=first_name,
                middle_name=middle_name,
                last_name=last_name,
                birthday=birthday,
                contact=contact,
                address=address,
                profile_img=files.get('profile_img'),
                gender=gender,
            )

            if user_role == 'treeGrowers':
                # Create Organization
                Organization.objects.create(
                    organization_name=org_data['organization_name'],
                    users=user,
                    email=org_data['org_email'],
                    address=org_data['org_address'],
                    contact=org_data['org_contact'],
                    profile_img=org_data['org_profile'],
                )

                # Create Application (site remains NULL, assigned later by DataManager)
                application = Application.objects.create(
                    user=user,
                    title=app_data['title'],
                    description=app_data['description'],
                    classification='new',
                    status='for_evaluation',
                    project_duration=app_data['project_duration'],
                    maintenance_plan=app_data['maintenance_plan'],
                    total_members=app_data['total_members'],
                )

                # Create Seedling Request (linked to application)
                SeedlingRequest.objects.create(
                    application=application,
                    no_request_seedling=seedling_data['no_request_seedling'],
                    description=seedling_data.get('description'),
                    status='pending',
                )

        # 8️⃣ Activity Logging
        record_activity(
            request,
            action_type='CREATE',
            entity_type='User',
            entity_id=user.id,
            entity_label=email,
            description=f'New {user_role} account registered.',
            new_data={'email': email, 'user_role': user_role, 'is_active': user.is_active},
        )

        return JsonResponse({
            'message': 'Registration successful',
            'user_id': user.id,
            'next_step': 'awaiting_evaluation' if user_role == 'treeGrowers' else 'active'
        }, status=201)

    except Exception as e:
        # In production, use logging.error() instead of print()
        print(f"Registration failed: {str(e)}")
        return JsonResponse({'error': 'Registration failed. Please try again.'}, status=500)

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
    locked, remaining_seconds, attempts_left = get_lock_info(ip)
    if locked:
        return JsonResponse({
            'error': 'Too many failed attempts. Try again later.',
            'remaining_seconds': remaining_seconds,
        }, status=403)

    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        log_event(None, email, SecurityLog.LOGIN_FAILED, ip_address=ip, user_agent=request.META.get('HTTP_USER_AGENT'))
        _, _, attempts_left = get_lock_info(ip)
        return JsonResponse({
            'error': 'Login failed. Please check your credentials.',
            'attempts_left': attempts_left,
        }, status=401)

    if not user.is_active:
        return JsonResponse({'error': 'Your account is deactivated!'}, status=401)

    # Hash the input password and compare
    hashed_password = hashlib.sha256(password.encode()).hexdigest()
    if hashed_password != user.password:
        log_event(user, email, SecurityLog.LOGIN_FAILED, ip_address=ip, user_agent=request.META.get('HTTP_USER_AGENT'))
        _, remaining_seconds, attempts_left = get_lock_info(ip)
        if attempts_left == 0:
            return JsonResponse({
                'error': 'Too many failed attempts. Try again later.',
                'remaining_seconds': remaining_seconds,
            }, status=403)
        return JsonResponse({
            'error': 'Login failed. Please check your credentials.',
            'attempts_left': attempts_left,
        }, status=401)
    

    log_event(user, email, SecurityLog.LOGIN_SUCCESS, ip_address=ip, user_agent=request.META.get('HTTP_USER_AGENT'))
  
    payload = {
        'user_id': user.id,
        'email': user.email,
        'user_role': user.user_role,
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
            ORDER BY u.created_at desc
            LIMIT %s OFFSET %s
            ''',
            [f"%{search}%", f"%{role}%", "treeGrowers", entries, offset]
        )

        columns = [col[0] for col in cursor.description]
        rows = [dict(zip(columns, row)) for row in cursor.fetchall()]

        # Add /media/ prefix for profile images and format created_at to YYYY-MM-DD
        users_list = [
            {
                **user, 
                'profile_img': '/media/' + user['profile_img'] if user['profile_img'] else None,
                'created_at': str(user['created_at'])[:10] if user['created_at'] else None
            }
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
        # Snapshot before update
        _old = {
            'email':       user.email,
            'user_role':   user.user_role,
            'is_active':   user.is_active,
            'first_name':  user_profile.first_name  if user_profile else '',
            'middle_name': user_profile.middle_name if user_profile else '',
            'last_name':   user_profile.last_name   if user_profile else '',
            'birthday':    str(user_profile.birthday) if user_profile else '',
            'contact':     user_profile.contact     if user_profile else '',
            'address':     user_profile.address     if user_profile else '',
            'gender':      user_profile.gender      if user_profile else '',
        }

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
        if user_profile is None:
            user_profile = profile(users=user)
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

        _new = {
            'email': email, 'user_role': user_role, 'is_active': is_active,
            'first_name': first_name, 'middle_name': middle_name, 'last_name': last_name,
            'birthday': str(birthday), 'contact': contact, 'address': address, 'gender': gender,
        }
        _changed = [k for k in _old if str(_old[k]) != str(_new.get(k, ''))]
        if password:
            _changed.append('password')

        record_activity(
            request,
            action_type='UPDATE',
            entity_type='User',
            entity_id=user_id,
            entity_label=email,
            description=f'User account updated. Fields changed: {", ".join(_changed) or "none"}.',
            old_data=_old,
            new_data=_new,
            changed_fields=_changed,
        )

        return JsonResponse({'message': 'User updated successfully'})

    except Exception as e:
        print("Error:", e)
        return JsonResponse({'error': 'Something went wrong: ' + str(e)}, status=400)

@csrf_exempt
def delete_user(request, user_id):
    if request.method != 'DELETE':
        return JsonResponse({'error': 'Only DELETE allowed'}, status=405)

    user = get_object_or_404(User, id=user_id)
    deleted_email = user.email
    deleted_role = user.user_role
    user.delete()

    record_activity(
        request,
        action_type='DELETE',
        entity_type='User',
        entity_id=user_id,
        entity_label=deleted_email,
        description=f'{deleted_role} account deleted.',
        old_data={'email': deleted_email, 'user_role': deleted_role},
    )

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
            'profile_img': user.profile.profile_img.url if hasattr(user, 'profile') and user.profile.profile_img else None,
            'full_name': user.profile.first_name + " " + user.profile.last_name,
            'user_role': getattr(user, "user_role", None),
        }

        return JsonResponse(data)
    
    except Exception as e:
        print("Error:", e)
        return JsonResponse({'error': 'Invalid JSON input'}, status=400)
    
@csrf_exempt
def get_tree_grower_detail(request, user_id):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    try:
        user = User.objects.get(id=user_id, user_role='treeGrowers')
    except User.DoesNotExist:
        return JsonResponse({'error': 'Tree grower not found'}, status=404)

    p   = getattr(user, 'profile', None)
    org = getattr(user, 'organization', None)

    return JsonResponse({
        'id':         user.id,
        'email':      user.email,
        'is_active':  user.is_active,
        'created_at': str(user.created_at),
        'profile': {
            'first_name':  p.first_name  if p else '',
            'middle_name': p.middle_name if p else '',
            'last_name':   p.last_name   if p else '',
            'birthday':    str(p.birthday) if p else None,
            'gender':      p.gender      if p else '',
            'contact':     p.contact     if p else '',
            'address':     p.address     if p else '',
            'profile_img': '/media/' + p.profile_img.name if p and p.profile_img else None,
        },
        'organization': {
            'organization_name': org.organization_name,
            'email':             org.email,
            'address':           org.address,
            'contact':           org.contact,
            'created_at':        str(org.created_at),
            'profile_img':       '/media/' + org.profile_img.name if org.profile_img else None,
        } if org else None,
    })


@csrf_exempt
def toggle_user_status(request, user_id):
    if request.method != 'PATCH':
        return JsonResponse({'error': 'Only PATCH allowed'}, status=405)

    user = get_object_or_404(User, id=user_id)
    old_status = user.is_active
    user.is_active = not old_status
    user.save()

    action = 'ACTIVATE' if user.is_active else 'DEACTIVATE'
    record_activity(
        request,
        action_type='UPDATE',
        entity_type='User',
        entity_id=user_id,
        entity_label=user.email,
        description=f'User account {action.lower()}d.',
        old_data={'is_active': old_status},
        new_data={'is_active': user.is_active},
        changed_fields=['is_active'],
    )

    return JsonResponse({'message': f'User {action.lower()}d successfully.', 'is_active': user.is_active})

@csrf_exempt
def list_tree_growers(request):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    search = request.GET.get('search', '').strip()
    page = int(request.GET.get('page', 1))
    entries = int(request.GET.get('entries', 10))

    with connection.cursor() as cursor:
        # 1️⃣ Get total count
        cursor.execute(
            '''
            SELECT COUNT(*)
            FROM accounts_user AS u
            JOIN accounts_profile AS a ON u.id = a.users_id
            WHERE u.email LIKE %s AND u.user_role = %s
            ''',
            [f"%{search}%", "treeGrowers"]
        )
        total_count_row = cursor.fetchone()
        total_count = total_count_row[0] if total_count_row else 0
        total_pages = max(math.ceil(total_count / entries), 1)

        # 2️⃣ Fetch paginated rows
        offset = (page - 1) * entries
        cursor.execute(
            '''
            SELECT u.id, u.email, u.is_active, u.created_at,
                   a.profile_img, a.first_name, a.last_name, a.contact, a.address
            FROM accounts_user AS u
            JOIN accounts_profile AS a ON u.id = a.users_id
            WHERE u.email LIKE %s AND u.user_role = %s
            ORDER BY u.created_at desc
            LIMIT %s OFFSET %s
            ''',
            [f"%{search}%", "treeGrowers", entries, offset]
        )

        columns = [col[0] for col in cursor.description]
        rows = [dict(zip(columns, row)) for row in cursor.fetchall()]

        users_list = [
            {
                'id':             user['id'],
                'email':          user['email'],
                'is_active':      user['is_active'],
                'profile_img':    '/media/' + user['profile_img'] if user['profile_img'] else None,
                'full_name':      f"{user['first_name']} {user['last_name']}".strip(),
                'contact_number': user.get('contact', ''),
                'address':        user.get('address', ''),
            }
            for user in rows
        ]

    response = {
        'total_pages': total_pages,
        'tree_growers': users_list,
    }
    return JsonResponse(response, safe=False)
    
    
    

