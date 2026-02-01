import json
from django.db import IntegrityError
from django.shortcuts import get_object_or_404
from reforestation_areas.models import Reforestation_areas
from accounts.models import User
from .models import Assigned_onsite_inspector
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
# Create your views here.


@csrf_exempt
def get_assigned_list(request):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    assignments = Assigned_onsite_inspector.objects.select_related(
        'user',
        'reforestation_area',
        'user__profile'
    )

    data = []

    for a in assignments:
        profile = a.user.profile if hasattr(a.user, 'profile') else None

        full_name = (
            f"{profile.first_name} {profile.middle_name} {profile.last_name}"
            if profile else None
        )

        data.append({
            "assigned_onsite_inspector_id": a.assigned_onsite_inspector_id,
            "user_id": a.user.id,
            "email": a.user.email,
            "full_name": full_name,
            "reforestation_area": {
                "id": a.reforestation_area.reforestation_area_id,
                "name": a.reforestation_area.name,
                "coordinate": a.reforestation_area.coordinate,
                "location": a.reforestation_area.location,
            },
            "created_at": a.created_at
        })

    return JsonResponse({
        "count": len(data),
        "results": data
    }, status=200)
    

@csrf_exempt
def assign_inspector(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)

    # Parse JSON body
    try:
        body = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    reforestation_area_id = body.get('reforestation_area_id')
    user_ids = body.get('user_ids')

    # Validate input
    if not reforestation_area_id or not isinstance(user_ids, list):
        return JsonResponse({
            'error': 'reforestation_area_id and user_ids[] are required'
        }, status=400)

    # Ensure ID is integer
    try:
        reforestation_area_id = int(reforestation_area_id)
    except ValueError:
        return JsonResponse({'error': 'reforestation_area_id must be a number'}, status=400)

    # Get the area safely
    try:
        area = Reforestation_areas.objects.get(reforestation_area_id=reforestation_area_id)
    except Reforestation_areas.DoesNotExist:
        return JsonResponse({'error': 'Reforestation area not found'}, status=404)

    created = []
    skipped = []

    # Assign users
    for user_id in user_ids:
        try:
            user = User.objects.get(id=int(user_id))  # ensure integer
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

    
