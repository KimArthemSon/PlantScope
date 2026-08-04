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


def get_client_ip(request):
    """
    Extract the real client IP address from request.
    Handles Render's proxy format: "client_ip, proxy1, proxy2"
    Returns only the first IP (the actual client).
    """
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        # Take the first IP (the actual client)
        ip = x_forwarded_for.split(',')[0].strip()
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip


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
    
    # ✅ FIX: Extract only the first IP from X-Forwarded-For header
    ip = get_client_ip(request)
    
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
    Register a new tree grower group and initial application.
    NOTE: Seedling requests are handled separately AFTER application acceptance.
    Personal information is NOT collected or stored at this stage.
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)

    data = request.POST
    files = request.FILES

    # 1️⃣ Validate required user fields (Only email and password for account creation)
    required_fields = ['email', 'password']
    missing = [f for f in required_fields if not data.get(f)]
    if missing:
        return JsonResponse({'error': 'Missing required fields', 'fields': missing}, status=400)

    # 2️⃣ Extract & sanitize basic user data
    email = data.get('email').strip().lower()
    password = data.get('password')
    
    # 3️⃣ Validate password format
    password_regex = r'^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$'
    if not re.match(password_regex, password):
        return JsonResponse({
            'error': 'Password must contain uppercase, lowercase, number, special character, and be at least 8 characters long.'
        }, status=400)

    # 4️⃣ Check email uniqueness
    if User.objects.filter(email=email).exists():
        return JsonResponse({'error': 'Email already exists'}, status=400)

    # 5️⃣ Handle Tree Grower Group data
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

    # 6️⃣ Handle Application data
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

    # Optional proposed_site and proposed_orientation_date
    proposed_site_id = data.get('proposed_site_id') or None
    proposed_orientation_date = data.get('proposed_orientation_date')
    
    if proposed_orientation_date:
        try:
            proposed_orientation_date = datetime.strptime(proposed_orientation_date, '%Y-%m-%d').date()
        except ValueError:
            return JsonResponse({'error': 'Invalid proposed_orientation_date format. Use YYYY-MM-DD.'}, status=400)

    # 7️⃣ Database Transaction (NO PERSONAL PROFILE CREATED)
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

            # Create Tree Grower Group (Profile creation completely removed to save storage)
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
                classification='new',
                status='for_evaluation',
                maintenance_plan=app_data['maintenance_plan'],
                total_treegrowers_will_participate=app_data['total_treegrowers_will_participate'],
                proposed_site_id=proposed_site_id,
                proposed_orientation_date=proposed_orientation_date,
            )

        # 8️⃣ Activity Logging
        record_activity(
            request,
            action_type='CREATE',
            entity_type='User',
            entity_id=user.id,
            entity_label=email,
            description=f'New tree grower group account registered: {group.group_name}',
            new_data={'email': email, 'user_role': 'treeGrowers', 'is_active': user.is_active},
        )

        return JsonResponse({
            'message': 'Tree grower registration successful',
            'user_id': user.id,
            'group_id': group.group_id, # Adjust to 'id' if your model uses standard 'id'
            'application_id': application.application_id,
            'next_step': 'awaiting_evaluation'
        }, status=201)

    except Exception as e:
        print(f"Registration failed: {str(e)}")
        traceback.print_exc()
        return JsonResponse({'error': f'Registration failed: {str(e)}'}, status=500)
    

@csrf_exempt
def update_tree_grower(request, user_id):
    """
    Update tree grower account.

    Tree growers are treated as group accounts, not individual persons.
    Therefore personal profile fields such as first_name, last_name, birthday,
    gender, personal contact, personal address, and personal profile image
    are no longer handled here.

    Updated models:
    - User: email, password, is_active
    - TreeGrowerGroup: group_name, group_type, address, contact, profile_img
    """

    if request.method not in ['POST', 'PUT']:
        return JsonResponse({'error': 'Only POST/PUT allowed'}, status=405)

    user = get_object_or_404(User, id=user_id, user_role='treeGrowers')
    tree_grower_group = getattr(user, 'tree_grower_group', None)

    # ------------------------------------------------------------
    # Payload parsing
    # Supports:
    # - multipart/form-data
    # - application/x-www-form-urlencoded
    # - application/json
    # ------------------------------------------------------------
    if request.content_type and 'application/json' in request.content_type:
        try:
            payload = json.loads(request.body.decode('utf-8') or '{}')
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON body.'}, status=400)

        if not isinstance(payload, dict):
            return JsonResponse({'error': 'Invalid JSON payload.'}, status=400)

        files = {}
    else:
        payload = request.POST
        files = request.FILES

    def get_value(key, default=None):
        value = payload.get(key, default)
        return default if value is None else value

    def get_str(key, default=''):
        value = payload.get(key, default)
        if value is None:
            value = default
        return str(value).strip()

    password_regex = r'^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$'
    valid_group_types = ['formal_org', 'community_group', 'informal_group']

    try:
        # =========================================================
        # SNAPSHOT BEFORE UPDATE
        # =========================================================
        _old = {
            'email': user.email,
            'is_active': user.is_active,
            'group_name': tree_grower_group.group_name if tree_grower_group else '',
            'group_type': tree_grower_group.group_type if tree_grower_group else '',
            'group_address': tree_grower_group.address if tree_grower_group else '',
            'group_contact': tree_grower_group.contact if tree_grower_group else '',
        }

        # Keep old group image reference so we can delete it only after successful save
        old_group_image = None
        if tree_grower_group and tree_grower_group.profile_img:
            old_group_image = tree_grower_group.profile_img

        # =========================================================
        # EXTRACT USER FIELDS
        # =========================================================
        email = get_str('email', user.email).lower()

        if not email:
            return JsonResponse({'error': 'Email is required.'}, status=400)

        is_active_raw = get_value('is_active', user.is_active)

        if isinstance(is_active_raw, bool):
            is_active = is_active_raw
        elif isinstance(is_active_raw, str):
            is_active = is_active_raw.strip().lower() in ['true', '1', 'yes']
        else:
            is_active = bool(is_active_raw)

        password = get_value('password', None)
        password = str(password).strip() if password is not None else None

        if password == '':
            password = None

        # =========================================================
        # EXTRACT TREE GROWER GROUP FIELDS
        # =========================================================
        group_name = get_str(
            'group_name',
            tree_grower_group.group_name if tree_grower_group else ''
        )

        group_type = get_str(
            'group_type',
            tree_grower_group.group_type if tree_grower_group else 'informal_group'
        ) or 'informal_group'

        group_address = get_str(
            'group_address',
            tree_grower_group.address if tree_grower_group else ''
        )

        group_contact = get_str(
            'group_contact',
            tree_grower_group.contact if tree_grower_group else ''
        )

        group_profile_img = files.get('group_profile_img') if files else None

        # =========================================================
        # VALIDATIONS
        # =========================================================

        # Email uniqueness
        if user.email != email and User.objects.filter(email=email).exists():
            return JsonResponse({'error': 'Email already exists'}, status=400)

        # Password validation
        if password:
            if not re.match(password_regex, password):
                return JsonResponse({
                    'error': (
                        'Password must contain uppercase, lowercase, number, '
                        'special character, and be at least 8 characters long.'
                    )
                }, status=400)

        # Group type validation
        if group_type not in valid_group_types:
            return JsonResponse({
                'error': f'Invalid group type. Must be one of: {", ".join(valid_group_types)}'
            }, status=400)

        # Required group fields
        if not group_name:
            return JsonResponse({'error': 'Group name is required.'}, status=400)

        if not group_contact:
            return JsonResponse({'error': 'Group contact is required.'}, status=400)

        # =========================================================
        # UPDATE USER + TREE GROWER GROUP
        # =========================================================
        with transaction.atomic():
            # Update user account fields
            user.email = email
            user.is_active = is_active

            if password:
                # NOTE:
                # Keeping your existing sha256 behavior for compatibility.
                # For production authentication, consider migrating to
                # Django's built-in password hashing in a separate task.
                user.password = hashlib.sha256(password.encode()).hexdigest()

            user.save()

            # Update or create tree grower group
            if tree_grower_group is None:
                tree_grower_group = TreeGrowerGroup(users=user)

            tree_grower_group.group_name = group_name
            tree_grower_group.group_type = group_type
            tree_grower_group.address = group_address
            tree_grower_group.contact = group_contact

            if group_profile_img:
                tree_grower_group.profile_img = group_profile_img

            tree_grower_group.save()

        # =========================================================
        # DELETE OLD GROUP IMAGE AFTER SUCCESSFUL SAVE
        # =========================================================
        if group_profile_img and old_group_image:
            try:
                delete_cloudinary_resource(old_group_image, resource_type='image')
            except Exception as cloudinary_error:
                # Do not fail the whole update if old image cleanup fails
                print(f"Warning: Failed to delete old group image: {cloudinary_error}")

        # =========================================================
        # SNAPSHOT AFTER UPDATE
        # =========================================================
        _new = {
            'email': email,
            'is_active': is_active,
            'group_name': group_name,
            'group_type': group_type,
            'group_address': group_address,
            'group_contact': group_contact,
        }

        _changed = [
            key for key in _old
            if str(_old[key]) != str(_new.get(key, ''))
        ]

        if password:
            _new['password'] = '***'
            _changed.append('password')

        if group_profile_img:
            _changed.append('group_profile_img')

        # =========================================================
        # ACTIVITY LOG
        # =========================================================
        record_activity(
            request,
            action_type='UPDATE',
            entity_type='TreeGrower',
            entity_id=user_id,
            entity_label=email,
            description=(
                'Tree grower group updated. '
                f'Fields changed: {", ".join(_changed) or "none"}.'
            ),
            old_data=_old,
            new_data=_new,
            changed_fields=_changed,
        )

        # =========================================================
        # RESPONSE
        # =========================================================
        response_data = {
            'message': 'Tree grower group updated successfully',
            'user_id': user.id,
            'email': user.email,
            'is_active': user.is_active,
            'group': {
                'group_id': tree_grower_group.group_id,
                'group_name': tree_grower_group.group_name,
                'group_type': tree_grower_group.group_type,
                'group_type_display': tree_grower_group.get_group_type_display(),
                'group_address': tree_grower_group.address,
                'group_contact': tree_grower_group.contact,
                'profile_img': (
                    get_cloudinary_url(str(tree_grower_group.profile_img))
                    if tree_grower_group.profile_img
                    else None
                ),
            },
        }

        return JsonResponse(response_data, status=200)

    except Exception as e:
        print(f"Error updating tree grower: {str(e)}")
        traceback.print_exc()
        return JsonResponse({'error': f'Something went wrong: {str(e)}'}, status=400)

    