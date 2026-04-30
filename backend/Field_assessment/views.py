import json
import jwt
from django.shortcuts import get_object_or_404
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.db.models import Q, Prefetch
from django.conf import settings
from sites.models import Sites
from reforestation_areas.models import Reforestation_areas
from security.views import log_activity

from accounts.models import User
from .models import (
    Assigned_onsite_inspector,
    Field_assessment,
)


def _get_request_user(request):
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


# =====================================================
# GET ALL INSPECTORS ASSIGNED TO A REFORESTATION AREA
# =====================================================

@csrf_exempt
def get_unassigned_inspectors(request, reforestation_area_id):
    if request.method != "GET":
        return JsonResponse({"error": "Only GET allowed"}, status=405)

    # Get the reforestation area
    area = get_object_or_404(Reforestation_areas, reforestation_area_id=reforestation_area_id)

    # IDs of users already assigned
    assigned_user_ids = Assigned_onsite_inspector.objects.filter(
        reforestation_area=area
    ).values_list('user_id', flat=True)

    # Fetch users who are NOT assigned AND have role OnsiteInspector
    unassigned_users = User.objects.exclude(id__in=assigned_user_ids).filter(
        user_role="OnsiteInspector"
    ).select_related('profile')

    data = []
    for user in unassigned_users:
        profile = getattr(user, "profile", None)
        full_name = (
            " ".join(filter(None, [profile.first_name, profile.middle_name, profile.last_name]))
            if profile else user.email  # fallback to email if no profile
        )
        profile_img = f"/media/{profile.profile_img}" if profile and profile.profile_img else None

        data.append({
        "user_id": user.id,
        "full_name": full_name,
         "email": user.email,
        "profile_img": profile_img,
        })

    return JsonResponse({
        "reforestation_area_id": reforestation_area_id,
        "count": len(data),
        "results": data
    }, status=200)

@csrf_exempt
def get_assigned_list(request, reforestation_area_id):
    if request.method != "GET":
        return JsonResponse({"error": "Only GET allowed"}, status=405)

    # Fetch all assignments for this area
    assignments = Assigned_onsite_inspector.objects.select_related(
        "user",
        "reforestation_area",
        "user__profile"  # assuming you have a related profile model
    ).filter(
        reforestation_area__reforestation_area_id=reforestation_area_id
    )

    data = []

    for a in assignments:
        profile = getattr(a.user, "profile", None)

        # Construct full name safely
        if profile:
            full_name = " ".join(
                filter(None, [profile.first_name, profile.middle_name, profile.last_name])
            )
            profile_img = f"/media/{profile.profile_img}" if profile.profile_img else None
        else:
            full_name = a.user.get_full_name() or a.user.username
            profile_img = None

        data.append({
            "assigned_onsite_inspector_id": a.assigned_onsite_inspector_id,
            "user_id": a.user.id,
            "email": a.user.email,
            "full_name": full_name,
            "profile_img": profile_img,
            "created_at": a.created_at,
        })

    return JsonResponse({
        "reforestation_area_id": reforestation_area_id,
        "count": len(data),
        "results": data
    }, status=200)

# =====================================================
# ASSIGN INSPECTOR TO REFORESTATION AREA
# =====================================================

@csrf_exempt
def assign_inspector(request):
    if request.method != "POST":
        return JsonResponse({"error": "Only POST allowed"}, status=405)

    try:
        body = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    reforestation_area_id = body.get("reforestation_area_id")
    user_ids = body.get("user_ids", [])

    if reforestation_area_id is None or not isinstance(user_ids, list):
        return JsonResponse({
            "error": "reforestation_area_id and user_ids[] are required"
        }, status=400)

    # Fetch the reforestation area or 404
    area = get_object_or_404(Reforestation_areas, reforestation_area_id=reforestation_area_id)

    # Safely convert submitted user IDs to integers
    new_user_ids = {int(u) for u in user_ids if u is not None}

    # Get current assignments for this area
    current_assignments = Assigned_onsite_inspector.objects.filter(reforestation_area=area)
    current_user_ids = set(current_assignments.values_list('user_id', flat=True))

    created = []

    # Only add new assignments that are NOT already assigned
    to_add = new_user_ids - current_user_ids
    for user_id in to_add:
        try:
            user = User.objects.get(id=user_id)
            Assigned_onsite_inspector.objects.create(user=user, reforestation_area=area)
            created.append(user.id)
        except User.DoesNotExist:
            continue

    # Do NOT remove existing assignments
    to_remove = current_user_ids - new_user_ids

    Assigned_onsite_inspector.objects.filter(
    reforestation_area=area,
    user_id__in=to_remove
    ).delete()

    record_activity(
        request,
        action_type='UPDATE',
        entity_type='InspectorAssignment',
        entity_id=reforestation_area_id,
        entity_label=f'Reforestation Area {reforestation_area_id}',
        description=f'Inspector assignments updated. Added: {list(to_add) or "none"}, Removed: {list(to_remove) or "none"}.',
        new_data={'assigned_added': list(to_add), 'assigned_removed': list(to_remove)},
    )

    # Existing users will remain assigned automatically
    return JsonResponse({
    "status": "success",
    "assigned_users_added": list(to_add),
    "assigned_users_removed": list(to_remove),
    "total_assigned": list(new_user_ids)
})