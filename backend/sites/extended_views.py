import json
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from django.db.models import Prefetch, Q
from reforestation_areas.models import Reforestation_areas
from Field_assessment.models import Field_assessment, Field_assessment_images, Assigned_onsite_inspector
from django.conf import settings
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
    
    Filters:
    - layer_name: Must exist at root level of field_assessment_data
    - assessment_type: 'specific' (has site), 'general' (no site), 'all'
    - site_id: Filter by specific site ID
    """
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    
    if layer_name not in SITE_LAYERS:
        return JsonResponse({
            'error': f'Invalid layer. Allowed: {SITE_LAYERS}',
            'success': False
        }, status=400)

    try:
        # ✅ Get query parameters
        assessment_type = request.GET.get('assessment_type', 'all').lower()
        site_id = request.GET.get('site_id')

        # Map layer names to image layer prefixes
        LAYER_PREFIX_MAP = {
            'safety': 'safety_',
            'survivability': 'surv_',
            'boundary_verification': 'bound_',
        }
        layer_prefix = LAYER_PREFIX_MAP.get(layer_name, layer_name)

        # ✅ STEP 1: Base Queryset - all submitted assessments for this area
        base_queryset = Field_assessment.objects.filter(
            assigned_onsite_inspector__reforestation_area_id=reforestation_area_id,
            is_submitted=True
        ).select_related(
            'assigned_onsite_inspector__user__profile',
            'site'
        ).prefetch_related('images').order_by('-assessment_date')

        # ✅ STEP 2: Apply Assessment Type Filter
        if assessment_type == 'specific':
            if site_id:
                base_queryset = base_queryset.filter(site_id=site_id)
            else:
                base_queryset = base_queryset.filter(site__isnull=False)
        elif assessment_type == 'general':
            base_queryset = base_queryset.filter(site__isnull=True)
        # else 'all': no additional filter

        # ✅ STEP 3: Filter by layer_name (must exist at root level)
        filtered_assessments = []
        for assessment in base_queryset:
            assessment_json = assessment.field_assessment_data or {}
            # Check if layer_name exists at root level and has data
            if layer_name in assessment_json and assessment_json[layer_name]:
                filtered_assessments.append(assessment)

        # ✅ STEP 4: Calculate Counts for UI toggle
        # Get ALL assessments for this area (without type filter) to count
        all_for_counting = Field_assessment.objects.filter(
            assigned_onsite_inspector__reforestation_area_id=reforestation_area_id,
            is_submitted=True
        ).select_related('site')
        
        counts = {"specific": 0, "general": 0, "all": 0}
        for assessment in all_for_counting:
            assessment_json = assessment.field_assessment_data or {}
            # Check if this assessment has the layer
            if layer_name in assessment_json and assessment_json[layer_name]:
                counts["all"] += 1
                if assessment.site_id:
                    counts["specific"] += 1
                else:
                    counts["general"] += 1

        # ✅ STEP 5: Prefetch images for filtered assessments
        assessment_ids = [a.field_assessment_id for a in filtered_assessments]
        images_by_assessment = {}
        
        if assessment_ids:
            images = Field_assessment_images.objects.filter(
                field_assessment_id__in=assessment_ids,
                layer__startswith=layer_prefix
            )
            for img in images:
                if img.field_assessment_id not in images_by_assessment:
                    images_by_assessment[img.field_assessment_id] = []
                images_by_assessment[img.field_assessment_id].append(img)

        # ✅ STEP 6: Build response data
        data = []
        for a in filtered_assessments:
            assessment_json = a.field_assessment_data or {}
            layer_data = assessment_json.get(layer_name, {})
            
            # Get inspector info
            try:
                inspector_profile = a.assigned_onsite_inspector.user.profile
                full_name = f"{inspector_profile.first_name} {inspector_profile.middle_name or ''} {inspector_profile.last_name}".strip()
                profile_img = inspector_profile.profile_img.url if inspector_profile.profile_img else None
            except:
                full_name = a.assigned_onsite_inspector.user.email
                profile_img = None
            
            layer_images = images_by_assessment.get(a.field_assessment_id, [])
            
            data.append({
                "field_assessment_id": a.field_assessment_id,
                "assessment_type": "specific" if a.site_id else "general",
                "site_name": a.site.name if a.site else None,
                "inspector": {
                    "email": a.assigned_onsite_inspector.user.email,
                    "full_name": full_name,
                    "profile_image": profile_img,
                },
                "assessment_date": a.assessment_date.isoformat() if a.assessment_date else None,
                "location": a.location,
                "layer_data": layer_data,
                "images": [
                    {
                        "id": img.field_assessment_images_id,
                        "url": f"{settings.API_BASE}{img.img.url}" if img.img else None,
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

        return JsonResponse({
            "data": data, 
            "count": len(data),
            "counts": counts
        }, status=200)

    except Exception as e:
        import traceback
        traceback.print_exc()
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
                        "url": f"{settings.API_BASE}{img.img.url}" if img.img else None,
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