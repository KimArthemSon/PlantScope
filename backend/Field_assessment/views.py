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
def get_assigned_list(request, reforestation_area_id):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    assignments = Assigned_onsite_inspector.objects.select_related(
        'user',
        'reforestation_area',
        'user__profile'
    ).filter(
        reforestation_area__reforestation_area_id=reforestation_area_id
    )

    data = []

    for a in assignments:
        profile = getattr(a.user, 'profile', None)

        full_name = None
        if profile:
            full_name = f"{profile.first_name} {profile.middle_name} {profile.last_name}"

        data.append({
            "assigned_onsite_inspector_id": a.assigned_onsite_inspector_id,
            "user_id": a.user.id,
            "email": a.user.email,
            "full_name": full_name,
            "created_at": a.created_at
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
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)

    try:
        body = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    reforestation_area_id = body.get('reforestation_area_id')
    user_ids = body.get('user_ids')

    if not reforestation_area_id or not isinstance(user_ids, list):
        return JsonResponse({
            'error': 'reforestation_area_id and user_ids[] are required'
        }, status=400)

    area = get_object_or_404(
        Reforestation_areas,
        reforestation_area_id=reforestation_area_id
    )

    created = []
    skipped = []

    for user_id in user_ids:
        try:
            user = User.objects.get(id=int(user_id))

            assignment, is_created = Assigned_onsite_inspector.objects.get_or_create(
                user=user,
                reforestation_area=area
            )

            if is_created:
                created.append(user.id)
            else:
                skipped.append(user.id)

        except (User.DoesNotExist, ValueError):
            skipped.append(user_id)

    return JsonResponse({
        "status": "success",
        "reforestation_area_id": reforestation_area_id,
        "assigned_users": created,
        "skipped_users": skipped
    }, status=201)


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