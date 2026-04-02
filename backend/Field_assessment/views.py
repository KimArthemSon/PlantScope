import json
from django.shortcuts import get_object_or_404
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.db.models import Q, Prefetch
from sites.models import Sites
from reforestation_areas.models import Reforestation_areas

from accounts.models import User
from .models import (
    Assigned_onsite_inspector,
    Field_assessment,
    Field_assessment_details,
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


# @csrf_exempt
# def get_field_assessments_legality_safety(request, reforestation_area_id):

#     if request.method != "GET":
#         return JsonResponse({"error": "Only GET allowed"}, status=405)

#     assignments = Assigned_onsite_inspector.objects.select_related(
#         "user",
#         "user__profile",
#         "reforestation_area"
#     ).filter(
#         reforestation_area__reforestation_area_id=reforestation_area_id
#     )

#     print(f"Assignments found: {assignments.count()}")
    
#     data = []

#     for assignment in assignments:

#         profile = getattr(assignment.user, "profile", None)

#         full_name = (
#             " ".join(filter(None, [
#                 profile.first_name,
#                 profile.middle_name,
#                 profile.last_name
#             ]))
#             if profile
#             else assignment.user.get_full_name() or assignment.user.username
#         )

#         profile_img = f"/media/{profile.profile_img}" if profile and profile.profile_img else None

#         # -------- FILTER FIELD ASSESSMENTS --------
#         assessments = Field_assessment.objects.filter(
#             assigned_onsite_inspector=assignment,
#             is_sent=True,
#             site__isnull=True
#         ).prefetch_related("field_assessment_multicriteria")

#         for fa in assessments:

#             multicriteria = fa.field_assessment_multicriteria.first()

#             data.append({
#                 "field_assessment_id": fa.field_assessment_id,

#                 "legality": fa.legality,
#                 "safety": fa.safety,

#                 "legality_discussion": multicriteria.legality_disccussion if multicriteria else None,
#                 "safety_discussion": multicriteria.safety_disccussion if multicriteria else None,

#                 "created_at": fa.created_at,

#                 "assigned_onsite_inspector_id": assignment.assigned_onsite_inspector_id,

#                 "user": {
#                     "user_id": assignment.user.id,
#                     "full_name": full_name,
#                     "email": assignment.user.email,
#                     "profile_img": profile_img
#                 }
#             })

#     return JsonResponse({
#         "reforestation_area_id": reforestation_area_id,
#         "count": len(data),
#         "results": data
#     }, status=200)

# @csrf_exempt
# def get_recent_field_assessments(request, site_id):
#     if request.method != 'GET':
#         return JsonResponse({'error': 'Method not allowed'}, status=405)

#     try:
#         # 1. Get the site
#         site = Sites.objects.get(site_id=site_id)
        
#         # 2. Get reforestation area from site (adjust field name if needed)
#         reforestation_area = site.reforestation_area

#         # 3. Get all field assessments for this reforestation area
#         assessments = Field_assessment.objects.filter(
#             assigned_onsite_inspector__reforestation_area=reforestation_area
#         ).order_by('-created_at')

#         # 4. Get all multicriteria feedbacks with related user and profile
#         multicriteria_list = Field_assessment_multicriteria.objects.filter(
#             field_assessment__in=assessments
#         ).select_related(
#             'field_assessment__assigned_onsite_inspector__user',
#             'field_assessment__assigned_onsite_inspector__user__profile'
#         )

#         # 5. Define criteria mapping (model field -> display name)
#         criteria_mapping = {
#             'safety_disccussion': 'safety',
#             'distance_to_water_source_disccussion': 'water_accessibility',
#             'accessibility_disccussion': 'accessibility',
#             'soil_quality_disccussion': 'soil_quality',
#             'slope_disccussion': 'slope',
#             'legality_disccussion': 'legality'
#         }

#         # 6. Aggregate feedback counts and collect recent feedbacks
#         criteria_summary = {}
#         for db_field, criteria_name in criteria_mapping.items():
#             # Filter non-empty feedbacks (null=True means no feedback for that criteria)
#             feedbacks = multicriteria_list.filter(
#                 **{f"{db_field}__isnull": False}
#             ).exclude(
#                 **{f"{db_field}": ''}
#             )

#             # Get recent 5 feedbacks for this criteria
#             recent_feedbacks = []
#             for fb in feedbacks.order_by('-created_at')[:5]:
#                 inspector = fb.field_assessment.assigned_onsite_inspector.user
#                 profile = inspector.profile
                
#                 # Build profile image URL
#                 profile_img_url = ''
#                 if profile.profile_img:
#                     profile_img_url = request.build_absolute_uri(profile.profile_img.url)

#                 recent_feedbacks.append({
#                     'id': fb.field_assessment_multicriteria_id,
#                     'assessment_id': fb.field_assessment.field_assessment_id,
#                     'feedback': getattr(fb, db_field),
#                     'inspector': {
#                         'name': f"{profile.first_name} {profile.last_name}".strip(),
#                         'email': inspector.email,
#                         'avatar': profile_img_url,
#                         'role': inspector.user_role
#                     },
#                     'created_at': fb.created_at.isoformat()
#                 })

#             criteria_summary[criteria_name] = {
#                 'total_feedbacks': feedbacks.count(),
#                 'recent_feedbacks': recent_feedbacks
#             }

#         # 7. Return response
#         return JsonResponse({
#             'success': True,
#             'site_id': site_id,
#             'reforestation_area_id': reforestation_area.reforestation_area_id,
#             'total_assessments': assessments.count(),
#             'criteria_summary': criteria_summary
#         }, status=200)

#     except Sites.DoesNotExist:
#         return JsonResponse({
#             'success': False,
#             'error': 'Site not found'
#         }, status=404)
#     except Exception as e:
#         return JsonResponse({
#             'success': False,
#             'error': str(e)
#         }, status=500)