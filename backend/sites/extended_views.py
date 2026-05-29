import json
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from django.db.models import Prefetch, Q
from reforestation_areas.models import Reforestation_areas
from Field_assessment.models import Field_assessment, Field_assessment_images, Assigned_onsite_inspector

# Valid layers for field assessments (NOT meta data - those are separate)
SITE_LAYERS = ['safety', 'survivability', 'boundary_verification']


@csrf_exempt
def get_restricted_zones_for_area(request, reforestation_area_id):
    """GET: Fetch classified/restricted areas for map overlay in GIS workspace."""
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    try:
        reforestation_area = get_object_or_404(Reforestation_areas, reforestation_area_id=reforestation_area_id)
        classified_areas_list = reforestation_area.barangay.classified_areas.all()
        data = {
            "reforestation_area": {
                "name": reforestation_area.name,
                "description": reforestation_area.description,
                "coordinate": reforestation_area.coordinate,
            },
            "barangay": {
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
                "land_classification_name": classified_area.land_classification.name if classified_area.land_classification else None
            })
        data["classified_area"] = classified_areas
        
        return JsonResponse(data, status=200)
        
    except Exception as e:
        return JsonResponse({'error': str(e), 'success': False}, status=500)


@csrf_exempt
def get_field_assessments_by_layer_mcda(request, reforestation_area_id, layer_name):
    """
    GET: Fetch field assessments for a specific MCDA layer within a reforestation area.
    
    Filters assessments by checking if field_assessment_data contains the layer key.
    Then fetches related images based on layer prefix.
    """
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    
    if layer_name not in SITE_LAYERS:
        return JsonResponse({
            'error': f'Invalid layer. Allowed: {SITE_LAYERS}',
            'success': False
        }, status=400)

    try:
        # Map layer names to image layer prefixes (matches IMAGE_LAYER_CHOICES)
        LAYER_PREFIX_MAP = {
            'safety': 'safety_',
            'survivability': 'surv_',
            'boundary_verification': 'bound_',
        }
        
        layer_prefix = LAYER_PREFIX_MAP.get(layer_name, layer_name)

        # ✅ STEP 1: Get ALL submitted assessments for this area
        all_assessments = Field_assessment.objects.filter(
            assigned_onsite_inspector__reforestation_area_id=reforestation_area_id,
            is_submitted=True
        ).select_related(
            'assigned_onsite_inspector__user__profile'
        ).order_by('-assessment_date')

        # ✅ STEP 2: Filter in Python to check if field_assessment_data contains the layer
        filtered_assessments = []
        for assessment in all_assessments:
            assessment_json = assessment.field_assessment_data or {}
            # Check if the layer key exists and has data
            if layer_name in assessment_json and assessment_json[layer_name]:
                filtered_assessments.append(assessment)

        # ✅ STEP 3: Prefetch images for the filtered assessments
        assessment_ids = [a.field_assessment_id for a in filtered_assessments]
        
        # Get images for these assessments filtered by layer prefix
        images_by_assessment = {}
        if assessment_ids:
            images = Field_assessment_images.objects.filter(
                field_assessment_id__in=assessment_ids,
                layer__startswith=layer_prefix
            )
            
            # Group images by assessment_id
            for img in images:
                if img.field_assessment_id not in images_by_assessment:
                    images_by_assessment[img.field_assessment_id] = []
                images_by_assessment[img.field_assessment_id].append(img)

        # ✅ STEP 4: Build response data
        data = []
        for a in filtered_assessments:
            # Extract layer-specific data from JSON
            assessment_json = a.field_assessment_data or {}
            layer_data = assessment_json.get(layer_name, {})
            
            # Get inspector info
            inspector_profile = a.assigned_onsite_inspector.user.profile
            full_name = f"{inspector_profile.first_name} {inspector_profile.middle_name or ''} {inspector_profile.last_name}".strip()
            
            # Get images for this assessment
            layer_images = images_by_assessment.get(a.field_assessment_id, [])
            
            data.append({
                "field_assessment_id": a.field_assessment_id,
                "inspector": {
                    "email": a.assigned_onsite_inspector.user.email,
                    "full_name": full_name,
                    "profile_image": inspector_profile.profile_img.url if inspector_profile.profile_img else None,
                },
                "assessment_date": a.assessment_date.isoformat() if a.assessment_date else None,
                "location": a.location,
                "layer_data": layer_data,  # Layer-specific data from JSON
                "images": [
                    {
                        "id": img.field_assessment_images_id,
                        "url": f"http://127.0.0.1:8000{img.img.url}" if img.img else None,
                        "layer": img.layer,
                        "description": img.description,
                        "latitude": float(img.latitude) if img.latitude else None,
                        "longitude": float(img.longitude) if img.longitude else None,
                    }
                    for img in layer_images
                ],
                "created_at": a.created_at.isoformat(),
                "updated_at": a.updated_at.isoformat(),
            })

        return JsonResponse({"data": data, "count": len(data)}, status=200)

    except Exception as e:
        return JsonResponse({'error': str(e), 'success': False}, status=500)


@csrf_exempt
def get_all_site_assessments(request, reforestation_area_id):
    """
    GET: Fetch ALL field assessments for a reforestation area.
    Returns complete assessment data with all layers.
    
    Note: These are area-level assessments, not site-level.
    """
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    try:
        assessments = Field_assessment.objects.filter(
            assigned_onsite_inspector__reforestation_area_id=reforestation_area_id,
            is_submitted=True
        ).select_related(
            'assigned_onsite_inspector__user__profile'
        ).prefetch_related('images').order_by('-assessment_date')

        data = []
        for a in assessments:
            inspector_profile = a.assigned_onsite_inspector.user.profile
            full_name = f"{inspector_profile.first_name} {inspector_profile.middle_name or ''} {inspector_profile.last_name}".strip()
            
            data.append({
                "field_assessment_id": a.field_assessment_id,
                "inspector": {
                    "email": a.assigned_onsite_inspector.user.email,
                    "full_name": full_name,
                    "profile_image": inspector_profile.profile_img.url if inspector_profile.profile_img else None,
                },
                "assessment_date": a.assessment_date.isoformat() if a.assessment_date else None,
                "location": a.location,
                "field_assessment_data": a.field_assessment_data,
                "images": [
                    {
                        "id": img.field_assessment_images_id,
                        "url": f"http://127.0.0.1:8000{img.img.url}" if img.img else None,
                        "layer": img.layer,
                        "description": img.description,
                        "latitude": float(img.latitude) if img.latitude else None,
                        "longitude": float(img.longitude) if img.longitude else None,
                    }
                    for img in a.images.all()
                ],
                "created_at": a.created_at.isoformat(),
            })

        return JsonResponse({"data": data, "count": len(data)}, status=200)

    except Exception as e:
        return JsonResponse({'error': str(e), 'success': False}, status=500)


@csrf_exempt
def update_field_assessment_coordinate(request):
    """POST: Update GPS location for a field assessment."""
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)
    
    try:
        data_json = json.loads(request.body)
        field_assessment_id = int(data_json.get("field_assessment_id", 0))
        coordinate = data_json.get("coordinate")

        if not coordinate:
            return JsonResponse({"error": "Coordinate is required"}, status=400)

        try:
            coordinate = {
                "latitude": float(coordinate["latitude"]),
                "longitude": float(coordinate["longitude"]),
                "gps_accuracy_meters": float(coordinate.get("gps_accuracy_meters", 0))
            }
        except (ValueError, KeyError, TypeError):
            return JsonResponse({"error": "Invalid coordinate values"}, status=400)

        field_assessment = get_object_or_404(Field_assessment, field_assessment_id=field_assessment_id)
        field_assessment.location = coordinate
        field_assessment.save()

        return JsonResponse({"message": "Location saved successfully", "location": coordinate}, status=200)
        
    except Exception as e:
        return JsonResponse({'error': str(e), 'success': False}, status=500)