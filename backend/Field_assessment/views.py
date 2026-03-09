import json
from django.shortcuts import get_object_or_404
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

from reforestation_areas.models import Reforestation_areas

from accounts.models import User
from .models import (
    Assigned_onsite_inspector,
    Field_assessment,
    Field_assessment_details
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
    
    # Existing users will remain assigned automatically
    return JsonResponse({
    "status": "success",
    "assigned_users_added": list(to_add),
    "assigned_users_removed": list(to_remove),
    "total_assigned": list(new_user_ids)
})

# =====================================================
# GET ALL FIELD ASSESSMENTS OF AN INSPECTOR
# ONLY RETURN IF is_sent = TRUE
# =====================================================
@csrf_exempt
def get_field_assessments(request, user_id):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    assignments = Assigned_onsite_inspector.objects.filter(user__id=user_id)

    assessments = Field_assessment.objects.filter(
        assigned_onsite_inspector__in=assignments,
        is_sent=True   # ✅ FILTER ONLY SENT ASSESSMENTS
    ).select_related(
        'assigned_onsite_inspector',
        'site'
    ).order_by('-created_at')

    data = []

    for fa in assessments:
        data.append({
            "field_assessment_id": fa.field_assessment_id,
            "site_id": fa.site.id if fa.site else None,
            "assigned_onsite_inspector_id": fa.assigned_onsite_inspector.assigned_onsite_inspector_id,
            "title": fa.tile,
            "legality": fa.legality,
            "safety": fa.safety,
            "location": fa.location,
            "soil_quality": fa.soil_quality,
            "ndvi": fa.ndvi,
            "distance_to_water_source": fa.distance_to_water_source,
            "accessibility": fa.accessibility,
            "wildlife_status": fa.wildlife_status,
            "created_at": fa.created_at
        })

    return JsonResponse({
        "user_id": user_id,
        "count": len(data),
        "results": data
    }, status=200)


# =====================================================
# GET SINGLE FIELD ASSESSMENT (WITH DETAILS)
# ONLY RETURN IF is_sent = TRUE
# =====================================================
@csrf_exempt
def get_field_assessment(request, field_assessment_id):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    fa = get_object_or_404(
        Field_assessment.objects.select_related(
            'assigned_onsite_inspector',
            'site'
        ).prefetch_related(
            'details__Tree_specie',
            'details__soil'
        ),
        field_assessment_id=field_assessment_id,
        is_sent=True   # ✅ ONLY SENT ASSESSMENTS
    )

    details_data = []

    for d in fa.details.all():
        details_data.append({
            "field_assessment_detail_id": d.field_assessment_detail_id,
            "tree_specie": {
                "id": d.Tree_specie.id if d.Tree_specie else None,
                "name": d.Tree_specie.name if d.Tree_specie else None
            },
            "soil": {
                "id": d.soil.id if d.soil else None,
                "name": d.soil.name if d.soil else None
            }
        })

    data = {
        "field_assessment_id": fa.field_assessment_id,
        "site_id": fa.site.id if fa.site else None,
        "assigned_onsite_inspector_id": fa.assigned_onsite_inspector.assigned_onsite_inspector_id,
        "title": fa.tile,
        "legality": fa.legality,
        "safety": fa.safety,
        "location": fa.location,
        "coordinates": fa.coordinates,
        "polygon_coordinates": fa.polygon_coordinates,
        "description": fa.description,
        "soil_quality": fa.soil_quality,
        "ndvi": fa.ndvi,
        "distance_to_water_source": fa.distance_to_water_source,
        "accessibility": fa.accessibility,
        "wildlife_status": fa.wildlife_status,
        "created_at": fa.created_at,
        "details": details_data
    }

    return JsonResponse({"data": data}, status=200)


@csrf_exempt
def update_field_assessment_is_sent(request, field_assessment_id):
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)

    # Parse JSON
    try:
        body = json.loads(request.body)
        is_sent = body.get("is_sent")
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    # Validate input
    if not isinstance(is_sent, bool):
        return JsonResponse({
            "error": "is_sent must be true or false"
        }, status=400)

    # Get assessment
    field_assessment = get_object_or_404(
        Field_assessment,
        field_assessment_id=field_assessment_id
    )

    # Optional: Prevent un-sending once submitted
    if field_assessment.is_sent and is_sent is False:
        return JsonResponse({
            "error": "Cannot revert a submitted field assessment"
        }, status=400)

    # Update value
    field_assessment.is_sent = is_sent
    field_assessment.save()

    return JsonResponse({
        "message": "Field assessment status updated successfully",
        "field_assessment_id": field_assessment_id,
        "is_sent": field_assessment.is_sent
    }, status=200)


@csrf_exempt
def get_field_assessments_by_area(request, reforestation_area_id):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    # Get all assignments for this reforestation area
    assignments = Assigned_onsite_inspector.objects.select_related(
        "user",
        "reforestation_area",
        "user__profile"
    ).filter(
        reforestation_area__reforestation_area_id=reforestation_area_id
    )

    data = []

    for assignment in assignments:
        profile = getattr(assignment.user, "profile", None)
        full_name = (
            " ".join(filter(None, [profile.first_name, profile.middle_name, profile.last_name]))
            if profile else assignment.user.get_full_name() or assignment.user.username
        )
        profile_img = f"/media/{profile.profile_img}" if profile and profile.profile_img else None

        # Get field assessments for this assignment, only if sent
        assessments = Field_assessment.objects.filter(
            assigned_onsite_inspector=assignment,
            is_sent=True
        )

        for fa in assessments:
            data.append({
                "field_assessment_id": fa.field_assessment_id,
                "legality": fa.legality,
                "safety": fa.safety,
                "created_at": fa.created_at,
                "assigned_onsite_inspector_id": assignment.assigned_onsite_inspector_id,
                "user_id": assignment.user.id,
                "full_name": full_name,
                "email": assignment.user.email,
                "profile_img": profile_img
            })

    return JsonResponse({
        "reforestation_area_id": reforestation_area_id,
        "count": len(data),
        "results": data
    }, status=200)