from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.db import transaction
from .models import User, profile, TreeGrowerGroup
from tree_planting_programs.models import Application, SeedlingRequest, SeedlingRequestSpecies
from tree_species.models import Tree_species
from security.views import log_activity
import json
import hashlib
import re
from datetime import datetime
from accounts.helper import get_cloudinary_url, delete_cloudinary_resource
from django.shortcuts import get_object_or_404
import traceback

def _get_request_user(request):
    """Return User of the JWT-authenticated caller, or None on failure."""
    try:
        from django.conf import settings
        import jwt
        header = request.headers.get('Authorization', '')
        if not header.startswith('Bearer '):
            return None
        payload = jwt.decode(
            header.split(' ')[1], settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM]
        )
        user = User.objects.filter(id=payload.get('user_id')).first()
        return user
    except Exception:
        return None


def record_activity(request, action_type, entity_type, entity_id=None,
                    entity_label='', description='',
                    old_data=None, new_data=None, changed_fields=None):
    """Log a business operation."""
    performer = _get_request_user(request)
    email = performer.email if performer else ''
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
def register_tree_grower(request):
    """
    Register a new tree grower with their group and initial application.
    Tree growers must be part of a group (minimum 2 members).
    NOTE: Seedling requests are handled separately AFTER application acceptance.
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)

    data = request.POST
    files = request.FILES

    # 1️ Validate required user fields
    required_fields = ['email', 'password', 'first_name', 'last_name', 'contact', 'address', 'gender']
    missing = [f for f in required_fields if not data.get(f)]
    if missing:
        return JsonResponse({'error': 'Missing required fields', 'fields': missing}, status=400)

    # 2️ Extract & sanitize basic user data
    email = data.get('email').strip().lower()
    password = data.get('password')
    first_name = data.get('first_name').strip()
    middle_name = data.get('middle_name', '').strip()
    last_name = data.get('last_name').strip()
    contact = data.get('contact').strip()
    address = data.get('address').strip()
    gender = data.get('gender')
    
    # Optional birthday
    birthday = None
    if data.get('birthday'):
        try:
            birthday = datetime.strptime(data.get('birthday'), '%Y-%m-%d').date()
        except ValueError:
            return JsonResponse({'error': 'Invalid birthday format. Use YYYY-MM-DD.'}, status=400)

    # 3️ Validate password format
    password_regex = r'^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$'
    if not re.match(password_regex, password):
        return JsonResponse({
            'error': 'Password must contain uppercase, lowercase, number, special character, and be at least 8 characters long.'
        }, status=400)

    # 4️ Check email uniqueness
    if User.objects.filter(email=email).exists():
        return JsonResponse({'error': 'Email already exists'}, status=400)

    # 5️ Handle Tree Grower Group data
    group_required = ['group_name', 'group_type', 'group_address', 'group_contact']
    group_missing = [f for f in group_required if not data.get(f)]
    if group_missing:
        return JsonResponse({'error': 'Missing group fields', 'fields': group_missing}, status=400)

    group_data = {
        'group_name': data.get('group_name').strip(),
        'group_type': data.get('group_type').strip(),
        'group_address': data.get('group_address').strip(),
        'group_contact': data.get('group_contact').strip(),
        'group_profile': files.get('group_profile'),
    }

    # Validate group_type
    valid_group_types = ['formal_org', 'community_group', 'informal_group']
    if group_data['group_type'] not in valid_group_types:
        return JsonResponse({
            'error': f'Invalid group_type. Must be one of: {", ".join(valid_group_types)}'
        }, status=400)

    # 6️ Handle Application data
    app_required = ['title', 'total_treegrowers_will_participate']
    app_missing = [f for f in app_required if not data.get(f)]
    if not files.get('maintenance_plan'):
        app_missing.append('maintenance_plan')
    if app_missing:
        return JsonResponse({'error': 'Missing application fields', 'fields': app_missing}, status=400)

    try:
        total_treegrowers = int(data.get('total_treegrowers_will_participate'))
        if total_treegrowers < 2:
            return JsonResponse({'error': 'Minimum 2 tree growers required per group'}, status=400)
    except ValueError:
        return JsonResponse({'error': 'total_treegrowers_will_participate must be a valid integer'}, status=400)

    app_data = {
        'title': data.get('title').strip(),
        'total_treegrowers_will_participate': total_treegrowers,
        'maintenance_plan': files.get('maintenance_plan'),
    }

    # Optional proposed_site and proposed_orientation_date (for returning growers)
    proposed_site_id = data.get('proposed_site_id') or None  # Handle empty strings
    proposed_orientation_date = data.get('proposed_orientation_date')
    
    if proposed_orientation_date:
        try:
            proposed_orientation_date = datetime.strptime(proposed_orientation_date, '%Y-%m-%d').date()
        except ValueError:
            return JsonResponse({'error': 'Invalid proposed_orientation_date format. Use YYYY-MM-DD.'}, status=400)

    # 7️ Database Transaction (NO SEEDLING REQUEST HERE)
    try:
        with transaction.atomic():
            # Create User
            hashed_password = hashlib.sha256(password.encode()).hexdigest()
            user = User.objects.create(
                email=email,
                password=hashed_password,
                user_role='treeGrowers',
                is_active=False  # Requires approval before activation
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

            # Create Tree Grower Group
            group = TreeGrowerGroup.objects.create(
                group_name=group_data['group_name'],
                users=user,
                group_type=group_data['group_type'],
                address=group_data['group_address'],
                contact=group_data['group_contact'],
                profile_img=group_data['group_profile'],
            )

            # Create Application
            application = Application.objects.create(
                user=user,
                title=app_data['title'],
                classification='new',  # First-time applicant
                status='for_evaluation',
                maintenance_plan=app_data['maintenance_plan'],
                total_treegrowers_will_participate=app_data['total_treegrowers_will_participate'],
                proposed_site_id=proposed_site_id,
                proposed_orientation_date=proposed_orientation_date,
            )

        # 8️ Activity Logging
        record_activity(
            request,
            action_type='CREATE',
            entity_type='User',
            entity_id=user.id,
            entity_label=email,
            description=f'New tree grower account registered with group: {group.group_name}',
            new_data={'email': email, 'user_role': 'treeGrowers', 'is_active': user.is_active},
        )

        return JsonResponse({
            'message': 'Tree grower registration successful',
            'user_id': user.id,
            'group_id': group.group_id,
            'application_id': application.application_id,
            'next_step': 'awaiting_evaluation'
        }, status=201)

    except Exception as e:
        print(f"Registration failed: {str(e)}")
        return JsonResponse({'error': f'Registration failed: {str(e)}'}, status=500)
    

@csrf_exempt
def update_tree_grower(request, user_id):
    """
    Update tree grower profile including personal info and group/organization details.
    Handles User, Profile, and TreeGrowerGroup models.
    """
    if request.method not in ['POST', 'PUT']:
        return JsonResponse({'error': 'Only POST/PUT allowed'}, status=405)
    
    # Get the tree grower user
    user = get_object_or_404(User, id=user_id, user_role='treeGrowers')
    user_profile = getattr(user, 'profile', None)
    tree_grower_group = getattr(user, 'tree_grower_group', None)

    # Password validation regex
    password_regex = r'^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$'

    try:
        # ===== SNAPSHOT BEFORE UPDATE =====
        _old = {
            'email': user.email,
            'is_active': user.is_active,
            'first_name': user_profile.first_name if user_profile else '',
            'middle_name': user_profile.middle_name if user_profile else '',
            'last_name': user_profile.last_name if user_profile else '',
            'birthday': str(user_profile.birthday) if user_profile and user_profile.birthday else '',
            'contact': user_profile.contact if user_profile else '',
            'address': user_profile.address if user_profile else '',
            'gender': user_profile.gender if user_profile else '',
            'group_name': tree_grower_group.group_name if tree_grower_group else '',
            'group_type': tree_grower_group.group_type if tree_grower_group else '',
            'group_address': tree_grower_group.address if tree_grower_group else '',
            'group_contact': tree_grower_group.contact if tree_grower_group else '',
        }

        # ===== EXTRACT FORM DATA =====
        # User fields
        email = request.POST.get('email', user.email).strip().lower()
        is_active = request.POST.get('is_active', str(user.is_active)).lower() == 'true'
        password = request.POST.get('password', None)

        # Profile fields
        first_name = request.POST.get('first_name', user_profile.first_name if user_profile else "").strip()
        middle_name = request.POST.get('middle_name', user_profile.middle_name if user_profile else "").strip()
        last_name = request.POST.get('last_name', user_profile.last_name if user_profile else "").strip()
        
        birthday = request.POST.get('birthday', None)
        if birthday:
            try:
                birthday = datetime.strptime(birthday, '%Y-%m-%d').date()
            except ValueError:
                return JsonResponse({'error': 'Invalid birthday format. Use YYYY-MM-DD.'}, status=400)
        elif user_profile:
            birthday = user_profile.birthday
        
        contact = request.POST.get('contact', user_profile.contact if user_profile else "").strip()
        address = request.POST.get('address', user_profile.address if user_profile else "").strip()
        gender = request.POST.get('gender', user_profile.gender if user_profile else "O")

        # Tree Grower Group fields
        group_name = request.POST.get('group_name', tree_grower_group.group_name if tree_grower_group else "").strip()
        group_type = request.POST.get('group_type', tree_grower_group.group_type if tree_grower_group else "informal_group").strip()
        group_address = request.POST.get('group_address', tree_grower_group.address if tree_grower_group else "").strip()
        group_contact = request.POST.get('group_contact', tree_grower_group.contact if tree_grower_group else "").strip()

        # Files
        profile_img = request.FILES.get('profile_img', None)
        group_profile_img = request.FILES.get('group_profile_img', None)

        # ===== VALIDATIONS =====
        
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

        # Validate group type
        valid_group_types = ['formal_org', 'community_group', 'informal_group']
        if group_type not in valid_group_types:
            return JsonResponse({
                'error': f'Invalid group type. Must be one of: {", ".join(valid_group_types)}'
            }, status=400)

        # Validate required fields
        if not first_name or not last_name:
            return JsonResponse({'error': 'First name and last name are required.'}, status=400)
        
        if not group_name:
            return JsonResponse({'error': 'Group name is required.'}, status=400)

        if not group_contact:
            return JsonResponse({'error': 'Group contact is required.'}, status=400)

        # ===== UPDATE USER =====
        user.email = email
        user.is_active = is_active
        user.save()

        # ===== UPDATE OR CREATE PROFILE =====
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
            # Delete old image from Cloudinary if exists
            if user_profile.profile_img:
                delete_cloudinary_resource(user_profile.profile_img, resource_type='image')
            user_profile.profile_img = profile_img
        
        user_profile.save()

        # ===== UPDATE OR CREATE TREE GROWER GROUP =====
        if tree_grower_group is None:
            tree_grower_group = TreeGrowerGroup(users=user)
        
        tree_grower_group.group_name = group_name
        tree_grower_group.group_type = group_type
        tree_grower_group.address = group_address
        tree_grower_group.contact = group_contact
        
        if group_profile_img:
            # Delete old group image from Cloudinary if exists
            if tree_grower_group.profile_img:
                delete_cloudinary_resource(tree_grower_group.profile_img, resource_type='image')
            tree_grower_group.profile_img = group_profile_img
        
        tree_grower_group.save()

        # ===== SNAPSHOT AFTER UPDATE =====
        _new = {
            'email': email,
            'is_active': is_active,
            'first_name': first_name,
            'middle_name': middle_name,
            'last_name': last_name,
            'birthday': str(birthday) if birthday else '',
            'contact': contact,
            'address': address,
            'gender': gender,
            'group_name': group_name,
            'group_type': group_type,
            'group_address': group_address,
            'group_contact': group_contact,
        }
        
        if password:
            _new['password'] = '***'  # Don't log actual password

        # Find changed fields
        _changed = [k for k in _old if str(_old[k]) != str(_new.get(k, ''))]
        if password:
            _changed.append('password')

        # ===== ACTIVITY LOGGING =====
        record_activity(
            request,
            action_type='UPDATE',
            entity_type='TreeGrower',
            entity_id=user_id,
            entity_label=email,
            description=f'Tree grower profile updated. Fields changed: {", ".join(_changed) or "none"}.',
            old_data=_old,
            new_data=_new,
            changed_fields=_changed,
        )

        # ===== PREPARE RESPONSE =====
        response_data = {
            'message': 'Tree grower profile updated successfully',
            'user_id': user.id,
            'email': user.email,
            'profile': {
                'first_name': user_profile.first_name,
                'last_name': user_profile.last_name,
                'profile_img': get_cloudinary_url(str(user_profile.profile_img)) if user_profile.profile_img else None,
            },
            'group': {
                'group_name': tree_grower_group.group_name,
                'group_type': tree_grower_group.get_group_type_display(),
                'profile_img': get_cloudinary_url(str(tree_grower_group.profile_img)) if tree_grower_group.profile_img else None,
            } if tree_grower_group else None,
        }

        return JsonResponse(response_data, status=200)

    except Exception as e:
        print(f"Error updating tree grower: {str(e)}")
        traceback.print_exc()
        return JsonResponse({'error': f'Something went wrong: {str(e)}'}, status=400)