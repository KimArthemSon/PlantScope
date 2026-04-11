import json
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from reforestation_areas.models import Reforestation_areas
from barangay.models import Barangay
from Field_assessment.models import Assigned_onsite_inspector,Field_assessment
ALLOWED_LAYERS = ['safety', 'boundary_verification', 'survivability']

# get retricted area ✔️
# get field assessment by layer
# get field assessment by layer
# assign field assessment marker
# assign field assessment by site


@csrf_exempt
def get_restricted_zones_for_area(request, reforestation_area_id):
    """GET: Fetch classified/restricted areas for map overlay in GIS workspace."""
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    try:
        reforestation_area = get_object_or_404(Reforestation_areas, reforestation_area_id = reforestation_area_id)
        classified_areas_list = reforestation_area.barangay.classified_areas.all()
        data = {
            "reforestation_aree": {
                "name": reforestation_area.name,
                "description": reforestation_area.description,
                "coordinate": reforestation_area.coordinate,
                "area_img": reforestation_area.area_img.url
            },
            "barangay" : {
                "name": reforestation_area.barangay.name,
                "description": reforestation_area.barangay.description,
                "coordinate": reforestation_area.barangay.coordinate
            },
            "classified_area": []
        }
        classified_areas = []
        for classified_area in classified_areas_list:
            classified_areas.append({
                "name": classified_area.name,
                "description": classified_area.description,
                "polygon": classified_area.polygon,
                "land_classification_name": classified_area.land_classification.name
            })
        data["classified_area"] = classified_areas
        
        return JsonResponse(data, status=200)
        
    except Exception as e:
        return JsonResponse({'error': str(e), 'success': False}, status=500)

@csrf_exempt
def get_field_assessments_by_layer_mcda(request, reforestation_area_id, layer_name):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    try:
        assignments = Field_assessment.objects.filter(
            assigned_onsite_inspector__reforestation_area_id=reforestation_area_id,
            layer=layer_name,
            is_submitted=True
        ).select_related(
            "assigned_onsite_inspector__user__profile"
        ).prefetch_related(
            "images"
        )

        inspectors = [
            {
                "email": a.assigned_onsite_inspector.user.email,
                "full_name": (
                    f"{a.assigned_onsite_inspector.user.profile.first_name} "
                    f"{a.assigned_onsite_inspector.user.profile.middle_name} "
                    f"{a.assigned_onsite_inspector.user.profile.last_name}"
                ),
                "profile_image": (
                    a.assigned_onsite_inspector.user.profile.profile_img.url
                    if a.assigned_onsite_inspector.user.profile.profile_img
                    else None
                ),
                "field_assessment_data": {
                    "layer": a.layer,
                    "location": a.location,
                    "field_assessment_data": a.field_assessment_data,
                    "assessment_date": a.assessment_date,

                    # ✅ IMAGES ADDED HERE
                    "images": [
                        {
                            "id": img.field_assessment_images_id,
                            "url": img.img.url if img.img else None,
                            "caption": img.caption
                        }
                        for img in a.images.all()
                    ]
                }
            }
            for a in assignments
        ]

        return JsonResponse({"data": inspectors}, status=200)

    except Exception as e:
        return JsonResponse({'error': str(e), 'success': False}, status=500)

