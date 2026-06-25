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