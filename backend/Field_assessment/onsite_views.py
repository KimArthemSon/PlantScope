import json
from decimal import Decimal, InvalidOperation
from django.core.serializers.json import DjangoJSONEncoder
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import get_object_or_404
from accounts.helper import get_user_from_token
from security.views import log_activity
from .models import Assigned_onsite_inspector, Field_assessment, Field_assessment_images
from django.db.models import Prefetch

import logging

logger = logging.getLogger(__name__)

# ✅ Valid layer codes for image uploads (matches IMAGE_LAYER_CHOICES in models)
VALID_IMAGE_LAYERS = [
    'meta_land_title', 'meta_tax_decl', 'meta_other_doc',
    'safety_flood', 'safety_landslide', 'safety_erosion', 'safety_other',
    'surv_soil', 'surv_water', 'surv_animal', 'surv_slope',
    'bound_verification'
]

# ✅ Ormoc City approximate GPS bounds for basic validation (FIXED: consistent ORMOC prefix)
ORMOC_LAT_MIN, ORMOC_LAT_MAX = 10.90, 11.25
ORMOC_LNG_MIN, ORMOC_LNG_MAX = 124.40, 124.80


def _record_activity(user, request, action_type, entity_type, entity_id=None,
                     entity_label='', description='',
                     old_data=None, new_data=None, changed_fields=None):
    email = user.email if user else ''
    ip = request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR'))
    log_activity(
        performed_by=user,
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


def check_inspector_assignment(user, reforestation_area_id):
    if not user or user.user_role != "OnsiteInspector":
        return False
    return Assigned_onsite_inspector.objects.filter(
        user=user,
        reforestation_area_id=reforestation_area_id
    ).exists()


@csrf_exempt
def get_assigned_reforestation_area(request):
    """
    GET: Fetch reforestation areas assigned to the onsite inspector.
    
    Returns area info + optional meta verification status from AreaMetaDataVerification.
    """
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    
    try:
        user = get_user_from_token(request)
        if not user or user.user_role != "OnsiteInspector":
            return JsonResponse({'error': 'Unauthorized'}, status=403)

        records = Assigned_onsite_inspector.objects.filter(
            user=user
        ).select_related(
            'reforestation_area', 
            'reforestation_area__barangay',
            'reforestation_area__land_classification'
        ).prefetch_related(
            'reforestation_area__meta_verification'  # OneToOne relation
        )
        
        data = []
        for r in records:
            area = r.reforestation_area
            
            # ✅ Get verification status from AreaMetaDataVerification (OneToOne)
            meta_verification = getattr(area, 'meta_verification', None)
            verification_status = meta_verification.status if meta_verification else 'pending'
            
            # ✅ Parse coordinate for map display
            coordinate = area.coordinate
            lat, lng, coord_display = _parse_coordinate(coordinate)
            
            # ✅ Parse polygon coordinate if available
            polygon_coordinate = area.polygon_coordinate
            
            data.append({
                "assigned_onsite_inspector_id": r.assigned_onsite_inspector_id,
                "reforestation_area_id": area.reforestation_area_id,
                "name": area.name,
                "description": area.description,
                "barangay": {
                    "id": area.barangay.barangay_id if area.barangay else None,
                    "name": area.barangay.name if area.barangay else None,
                } if area.barangay else None,
                "land_classification": {
                    "id": area.land_classification.land_classification_id if area.land_classification else None,
                    "name": area.land_classification.name if area.land_classification else None,
                } if area.land_classification else None,
                "coordinate": coordinate,  # Raw JSON for flexibility
                "polygon_coordinate": polygon_coordinate,  # Raw JSON for polygon rendering
                "latitude": lat,  # Parsed for map centering
                "longitude": lng,
                "coord_display": coord_display,
                "area_img": f"http://127.0.0.1:8000{area.area_img.url}" if area.area_img else None,
                # ✅ Verification status from meta_verification table
                "verification_status": verification_status,
                "verified_at": meta_verification.verified_at.isoformat() if meta_verification and meta_verification.verified_at else None,
                "assigned_at": r.created_at.isoformat()
            })
            
        return JsonResponse(data, safe=False, status=200)
        
    except Exception as e:
        return JsonResponse({'error': str(e), 'success': False}, status=500)


def _parse_coordinate(coordinate):
    """Helper: Parse coordinate JSON/string to lat/lng for map display."""
    default_lat, default_lng = 11.0, 124.6
    default_display = "No Coordinates"
    
    if not coordinate:
        return default_lat, default_lng, default_display
    
    try:
        # Handle JSON array: [lat, lng]
        if isinstance(coordinate, list) and len(coordinate) >= 2:
            lat, lng = float(coordinate[0]), float(coordinate[1])
            return lat, lng, f"{lat:.4f}° N, {lng:.4f}° E"
        
        # Handle JSON object: {"latitude": x, "longitude": y}
        if isinstance(coordinate, dict):
            lat = float(coordinate.get('latitude', default_lat))
            lng = float(coordinate.get('longitude', default_lng))
            return lat, lng, f"{lat:.4f}° N, {lng:.4f}° E"
        
        # Handle string: "lat, lng"
        if isinstance(coordinate, str) and ',' in coordinate:
            parts = coordinate.split(',')
            if len(parts) >= 2:
                lat, lng = float(parts[0].strip()), float(parts[1].strip())
                return lat, lng, f"{lat:.4f}° N, {lng:.4f}° E"
                
    except (ValueError, TypeError, KeyError):
        pass
    
    return default_lat, default_lng, default_display



# ─────────────────────────────────────────────
# 2. GET FIELD ASSESSMENTS (LIST)
# ─────────────────────────────────────────────
@csrf_exempt
def get_field_assessments(request):
    """
    GET: Fetch field assessments for onsite inspector.
    
    Query Parameters:
    - reforestation_area_id: Filter by area (optional)
    - is_submitted: Filter by submission status (optional)
    - layer: Filter by layer key in field_assessment_data (optional)
             Valid values: 'meta_data', 'safety', 'boundary_verification', 'survivability'
    """
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    
    try:
        user = get_user_from_token(request)
        if not user or user.user_role != "OnsiteInspector":
            return JsonResponse({'error': 'Unauthorized'}, status=403)

        # Base queryset
        q = Field_assessment.objects.filter(
            assigned_onsite_inspector__user=user
        ).select_related(
            'assigned_onsite_inspector__reforestation_area'
        )
        
        # Filter by reforestation area
        if aid := request.GET.get('reforestation_area_id'):
            q = q.filter(assigned_onsite_inspector__reforestation_area_id=aid)
        
        # Filter by submission status
        if request.GET.get('is_submitted') is not None:
            q = q.filter(is_submitted=(request.GET['is_submitted'].lower() == 'true'))
            
        # ✅ NEW: Filter by layer in field_assessment_data JSON
        layer = request.GET.get('layer')
        if layer:
            # Valid layer keys
            VALID_LAYERS = ['meta_data', 'safety', 'boundary_verification', 'survivability']
            if layer not in VALID_LAYERS:
                return JsonResponse({
                    'error': f'Invalid layer. Allowed: {VALID_LAYERS}',
                    'success': False
                }, status=400)
            
            # Filter 1: Check if JSON field has the layer key
            q = q.filter(field_assessment_data__has_key=layer)
            
            # Note: We'll do empty dict filtering in Python below for clarity
        
        q = q.order_by('-updated_at')

        data = []
        for fa in q:
            # ✅ NEW: Skip if layer filter is set but layer data is empty
            if layer:
                layer_data = fa.field_assessment_data.get(layer)
                # Skip if layer data is None, empty dict, or empty list
                if not layer_data or (isinstance(layer_data, (dict, list)) and not layer_data):
                    continue
            
            data.append({
                "field_assessment_id": fa.field_assessment_id,
                "reforestation_area_id": fa.assigned_onsite_inspector.reforestation_area_id,
                "reforestation_area_name": fa.assigned_onsite_inspector.reforestation_area.name,
                "assessment_date": fa.assessment_date.isoformat() if fa.assessment_date else None,
                "location": fa.location,
                "is_submitted": fa.is_submitted,
                "image_count": fa.images.count(),
                # ✅ Include layer data if requested (for debugging/preview)
                "layer_data": fa.field_assessment_data.get(layer) if layer else None,
                "created_at": fa.created_at.isoformat(),
                "updated_at": fa.updated_at.isoformat(),
            })
            
        return JsonResponse(data, safe=False, status=200)
        
    except Exception as e:
        return JsonResponse({'error': str(e), 'success': False}, status=500)


# ─────────────────────────────────────────────
# 3. GET FIELD ASSESSMENT DETAIL
# ─────────────────────────────────────────────
@csrf_exempt
def get_field_assessment_detail(request, field_assessment_id):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    try:
        user = get_user_from_token(request)
        if not user or user.user_role != "OnsiteInspector":
            return JsonResponse({'error': 'Unauthorized'}, status=403)

        fa = get_object_or_404(
            Field_assessment.objects.select_related(
                'assigned_onsite_inspector__user',
                'assigned_onsite_inspector__reforestation_area'
            ).prefetch_related('images'),  # ✅ Added for performance
            field_assessment_id=field_assessment_id
        )
        if fa.assigned_onsite_inspector.user != user:
            return JsonResponse({'error': 'Forbidden'}, status=403)

        # ✅ Enriched image payload with Geocam fields
        images = [{
            "image_id": img.field_assessment_images_id,
            "layer": img.layer,
            "url": request.build_absolute_uri(img.img.url) if img.img else None,  # ✅ Absolute URL for mobile
            "latitude": float(img.latitude) if img.latitude is not None else None,
            "longitude": float(img.longitude) if img.longitude is not None else None,
            "description": img.description or "",
            "created_at": img.created_at.isoformat(),
        } for img in fa.images.order_by('created_at')]

        return JsonResponse({
            "field_assessment_id": fa.field_assessment_id,
            "assessment_date": fa.assessment_date.isoformat() if fa.assessment_date else None,
            "location": fa.location,
            "field_assessment_data": fa.field_assessment_data,
            "is_submitted": fa.is_submitted,
            "images": images,
            "created_at": fa.created_at.isoformat(),
            "updated_at": fa.updated_at.isoformat(),
        }, encoder=DjangoJSONEncoder, status=200)  # ✅ Safe Decimal serialization
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


# ─────────────────────────────────────────────
# 4. CREATE FIELD ASSESSMENT (DRAFT)
# ─────────────────────────────────────────────
@csrf_exempt
def create_field_assessment(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)
    try:
        user = get_user_from_token(request)
        if not user or user.user_role != "OnsiteInspector":
            return JsonResponse({'error': 'Unauthorized'}, status=403)

        body = json.loads(request.body)
        reforestation_area_id = body.get('reforestation_area_id')
        assessment_date = body.get('assessment_date')
        raw_location = body.get('location')
        field_data = body.get('field_assessment_data', {})

        if not reforestation_area_id or not assessment_date:
            return JsonResponse({'error': 'reforestation_area_id and assessment_date are required'}, status=400)
        if not check_inspector_assignment(user, reforestation_area_id):
            return JsonResponse({'error': 'You are not assigned to this area'}, status=403)

        # ✅ Validate location if provided
        location = None
        if raw_location and isinstance(raw_location, dict):
            if 'latitude' not in raw_location or 'longitude' not in raw_location:
                return JsonResponse({'error': 'Invalid location: must contain latitude and longitude'}, status=400)
            location = raw_location

        assignment = get_object_or_404(
            Assigned_onsite_inspector, 
            user=user, 
            reforestation_area_id=reforestation_area_id
        )
        fa = Field_assessment.objects.create(
            assigned_onsite_inspector=assignment,
            assessment_date=assessment_date,
            location=location,
            field_assessment_data=field_data,
            is_submitted=False
        )

        _record_activity(
            user, request,
            action_type='CREATE',
            entity_type='FieldAssessment',
            entity_id=fa.field_assessment_id,
            entity_label=f'Assessment {fa.field_assessment_id} - Area {reforestation_area_id}',
            description=f'Field assessment draft created for reforestation area {reforestation_area_id}.',
            new_data={'reforestation_area_id': reforestation_area_id, 'assessment_date': assessment_date, 'location': location},
        )

        return JsonResponse({
            'message': 'Draft created', 
            'field_assessment_id': fa.field_assessment_id
        }, status=201)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


# ─────────────────────────────────────────────
# 5. UPDATE FIELD ASSESSMENT (DRAFT ONLY)
# ─────────────────────────────────────────────
@csrf_exempt
def update_field_assessment(request, field_assessment_id):
    if request.method not in ['POST', 'PUT']:
        return JsonResponse({'error': 'Only POST/PUT allowed'}, status=405)
    try:
        user = get_user_from_token(request)
        if not user or user.user_role != "OnsiteInspector":
            return JsonResponse({'error': 'Unauthorized'}, status=403)

        fa = get_object_or_404(Field_assessment, field_assessment_id=field_assessment_id)
        if fa.assigned_onsite_inspector.user != user:
            return JsonResponse({'error': 'Forbidden'}, status=403)
        if fa.is_submitted:
            return JsonResponse({'error': 'Cannot edit a submitted assessment'}, status=400)

        body = json.loads(request.body)
        _changed = [k for k in ('assessment_date', 'location', 'field_assessment_data') if k in body]
        
        if 'assessment_date' in body: fa.assessment_date = body['assessment_date']
        if 'location' in body: fa.location = body['location']
        if 'field_assessment_data' in body: fa.field_assessment_data = body['field_assessment_data']
        fa.save()

        _record_activity(
            user, request,
            action_type='UPDATE',
            entity_type='FieldAssessment',
            entity_id=field_assessment_id,
            entity_label=f'Assessment {field_assessment_id}',
            description=f'Field assessment {field_assessment_id} updated. Fields changed: {", ".join(_changed) or "none"}.',
            changed_fields=_changed,
        )

        return JsonResponse({'message': 'Draft updated', 'updated_at': fa.updated_at.isoformat()}, status=200)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


# ─────────────────────────────────────────────
# 6. SUBMIT FIELD ASSESSMENT
# ─────────────────────────────────────────────
@csrf_exempt
def submit_field_assessment(request, field_assessment_id):
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)
    try:
        user = get_user_from_token(request)
        if not user or user.user_role != "OnsiteInspector":
            return JsonResponse({'error': 'Unauthorized'}, status=403)

        fa = get_object_or_404(Field_assessment, field_assessment_id=field_assessment_id)
        if fa.assigned_onsite_inspector.user != user:
            return JsonResponse({'error': 'Forbidden'}, status=403)
        if fa.is_submitted:
            return JsonResponse({'error': 'Already submitted'}, status=400)
        if not fa.field_assessment_data:
            return JsonResponse({'error': 'Cannot submit empty assessment'}, status=400)

        fa.is_submitted = True
        fa.save()

        _record_activity(
            user, request,
            action_type='UPDATE',
            entity_type='FieldAssessment',
            entity_id=field_assessment_id,
            entity_label=f'Assessment {field_assessment_id}',
            description=f'Field assessment {field_assessment_id} submitted.',
            old_data={'is_submitted': False},
            new_data={'is_submitted': True},
            changed_fields=['is_submitted'],
        )

        return JsonResponse({
            'message': 'Assessment submitted', 
            'submitted_at': fa.updated_at.isoformat()
        }, status=200)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


# ─────────────────────────────────────────────
# 7. DELETE FIELD ASSESSMENT (DRAFT ONLY)
# ─────────────────────────────────────────────
@csrf_exempt
def delete_field_assessment(request, field_assessment_id):
    if request.method != 'DELETE':
        return JsonResponse({'error': 'Only DELETE allowed'}, status=405)
    try:
        user = get_user_from_token(request)
        if not user or user.user_role != "OnsiteInspector":
            return JsonResponse({'error': 'Unauthorized'}, status=403)

        fa = get_object_or_404(Field_assessment, field_assessment_id=field_assessment_id)
        if fa.assigned_onsite_inspector.user != user:
            return JsonResponse({'error': 'Forbidden'}, status=403)
        if fa.is_submitted:
            return JsonResponse({'error': 'Cannot delete submitted assessment'}, status=400)

        _record_activity(
            user, request,
            action_type='DELETE',
            entity_type='FieldAssessment',
            entity_id=field_assessment_id,
            entity_label=f'Assessment {field_assessment_id}',
            description=f'Field assessment {field_assessment_id} deleted.',
            old_data={'assessment_date': fa.assessment_date.isoformat() if fa.assessment_date else None},
        )

        fa.delete()
        return JsonResponse({'message': 'Deleted successfully'}, status=200)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


# ─────────────────────────────────────────────
# 8. UPLOAD IMAGE (Geocam + Layer Code)
# ────────────────────────────────────────────
@csrf_exempt
def upload_field_assessment_image(request, field_assessment_id):
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)
    try:
        user = get_user_from_token(request)
        if not user or user.user_role != "OnsiteInspector":
            return JsonResponse({'error': 'Unauthorized'}, status=403)

        fa = get_object_or_404(Field_assessment, field_assessment_id=field_assessment_id)
        if fa.assigned_onsite_inspector.user != user:
            return JsonResponse({'error': 'Forbidden'}, status=403)
        if fa.is_submitted:
            return JsonResponse({'error': 'Cannot add images to submitted assessment'}, status=400)
        if 'image' not in request.FILES:
            return JsonResponse({'error': 'No image file provided'}, status=400)

        # ✅ Extract & validate Geocam data
        layer = request.POST.get('layer')
        if layer not in VALID_IMAGE_LAYERS:
            return JsonResponse({'error': f'Invalid layer. Allowed: {VALID_IMAGE_LAYERS}'}, status=400)

        try:
            lat = Decimal(request.POST.get('latitude'))
            lng = Decimal(request.POST.get('longitude'))
        except (InvalidOperation, TypeError):
            return JsonResponse({'error': 'Invalid latitude/longitude format'}, status=400)

        # ✅ FIXED: Use consistent ORMOC_* constants (was ORMOG_LNG_MIN typo)
        if not (ORMOC_LAT_MIN <= lat <= ORMOC_LAT_MAX and ORMOC_LNG_MIN <= lng <= ORMOC_LNG_MAX):
            return JsonResponse({'error': 'Coordinates out of Ormoc City bounds'}, status=400)

        description = request.POST.get('description', '')

        img = Field_assessment_images.objects.create(
            field_assessment=fa,
            layer=layer,
            img=request.FILES['image'],
            latitude=lat,
            longitude=lng,
            description=description
        )

        _record_activity(
            user, request,
            action_type='CREATE',
            entity_type='FieldAssessmentImage',
            entity_id=img.field_assessment_images_id,
            entity_label=f'Image for Assessment {field_assessment_id}',
            description=f'Geocam image uploaded to assessment {field_assessment_id} (layer: {layer}).',
            new_data={'field_assessment_id': field_assessment_id, 'layer': layer},
        )

        return JsonResponse({
            'message': 'Image uploaded', 
            'image_id': img.field_assessment_images_id, 
            'url': request.build_absolute_uri(img.img.url) if img.img else None  # ✅ Absolute URL
        }, status=201)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


# ─────────────────────────────────────────────
# 9. DELETE IMAGE
# ─────────────────────────────────────────────
@csrf_exempt
def delete_field_assessment_image(request, image_id):
    if request.method != 'DELETE':
        return JsonResponse({'error': 'Only DELETE allowed'}, status=405)
    try:
        user = get_user_from_token(request)
        if not user or user.user_role != "OnsiteInspector":
            return JsonResponse({'error': 'Unauthorized'}, status=403)

        img = get_object_or_404(
            Field_assessment_images.objects.select_related('field_assessment__assigned_onsite_inspector__user'),
            field_assessment_images_id=image_id
        )
        if img.field_assessment.assigned_onsite_inspector.user != user:
            return JsonResponse({'error': 'Forbidden'}, status=403)
        if img.field_assessment.is_submitted:
            return JsonResponse({'error': 'Cannot delete images from submitted assessment'}, status=400)

        fa_id = img.field_assessment.field_assessment_id

        _record_activity(
            user, request,
            action_type='DELETE',
            entity_type='FieldAssessmentImage',
            entity_id=image_id,
            entity_label=f'Image {image_id} for Assessment {fa_id}',
            description=f'Image {image_id} deleted from assessment {fa_id}.',
            old_data={'field_assessment_id': fa_id, 'layer': img.layer},
        )

        if img.img:
            try: 
                img.img.delete(save=False)
            except Exception: 
                pass
        img.delete()
        return JsonResponse({'message': 'Image deleted'}, status=200)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


# ─────────────────────────────────────────────
# HEAD: UNSENT FIELD ASSESSMENT
# ─────────────────────────────────────────────
@csrf_exempt
def head_unsent_field_assessment(request, field_assessment_id):
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)
    try:
        user = get_user_from_token(request)
        allowed_roles = ["DataManager", "CityENROHead"]
        if not user or user.user_role not in allowed_roles:
            return JsonResponse({'error': 'Unauthorized'}, status=403)

        fa = get_object_or_404(Field_assessment, field_assessment_id=field_assessment_id)
        if not fa.is_submitted:
            return JsonResponse({'error': 'Assessment is not submitted'}, status=400)

        fa.is_submitted = False
        fa.save()

        _record_activity(
            user, request,
            action_type='UPDATE',
            entity_type='FieldAssessment',
            entity_id=field_assessment_id,
            entity_label=f'Assessment {field_assessment_id}',
            description=f'Field assessment {field_assessment_id} marked as unsent by head user.',
            old_data={'is_submitted': True},
            new_data={'is_submitted': False},
            changed_fields=['is_submitted'],
        )

        return JsonResponse({'message': 'Assessment marked as unsent'}, status=200)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


# ─────────────────────────────────────────────
# HEAD: DELETE FIELD ASSESSMENT
# ─────────────────────────────────────────────
@csrf_exempt
def head_delete_field_assessment(request, field_assessment_id):
    if request.method != 'DELETE':
        return JsonResponse({'error': 'Only DELETE allowed'}, status=405)
    try:
        user = get_user_from_token(request)
        allowed_roles = ["DataManager", "CityENROHead"]
        if not user or user.user_role not in allowed_roles:
            return JsonResponse({'error': 'Unauthorized'}, status=403)

        fa = get_object_or_404(Field_assessment, field_assessment_id=field_assessment_id)

        _record_activity(
            user, request,
            action_type='DELETE',
            entity_type='FieldAssessment',
            entity_id=field_assessment_id,
            entity_label=f'Assessment {field_assessment_id}',
            description=f'Field assessment {field_assessment_id} deleted by head user.',
            old_data={'is_submitted': fa.is_submitted},
        )

        fa.delete()
        return JsonResponse({'message': 'Assessment deleted successfully'}, status=200)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


# ─────────────────────────────────────────────
# GET AREA ASSESSMENTS (For GIS/ENRO Review)
# ─────────────────────────────────────────────
@csrf_exempt
def get_area_meta_data(request, reforestation_area_id):
    """
    GET: For GIS Specialists / ENRO Heads.
    Fetches ONLY submitted assessments containing 'meta_data' for a specific Reforestation Area.
    Returns ONLY meta-related images (land_title, tax_decl, other_doc).
    
    FIX: Uses fa.images.all() which correctly accesses the related images 
    defined by related_name='images' in Field_assessment_images model.
    """
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    
    try:
        # 1. Authentication & Authorization
        user = get_user_from_token(request)
        allowed_roles = ["DataManager", "CityENROHead", "GISSpecialist"]
        
        if not user or user.user_role not in allowed_roles:
            return JsonResponse({'error': 'Unauthorized'}, status=403)

        # 2. Define meta-related layer codes (must match IMAGE_LAYER_CHOICES)
        META_LAYER_CODES = ['meta_land_title', 'meta_tax_decl', 'meta_other_doc']

        # 3. Query assessments with prefetched images
        # We use simple prefetch_related('images') so that fa.images.all() works correctly.
        # This avoids issues with 'to_attr' hiding the data from the default accessor.
        assessments = Field_assessment.objects.filter(
            assigned_onsite_inspector__reforestation_area_id=reforestation_area_id,
            is_submitted=True,
            field_assessment_data__has_key='meta_data'  # DB-level JSON key filter
        ).select_related(
            'assigned_onsite_inspector__user',
            'assigned_onsite_inspector__user__profile'
        ).prefetch_related('images').order_by('-created_at')

        data = []
        for fa in assessments:
            # Skip if meta_data is empty (extra safety check)
            meta_data = fa.field_assessment_data.get('meta_data')
            if not meta_data or (isinstance(meta_data, (dict, list)) and not meta_data):
                continue
                
            # ── Inspector info ───────────────────────────────────────────
            inspector_user = fa.assigned_onsite_inspector.user if fa.assigned_onsite_inspector else None
            profile = getattr(inspector_user, 'profile', None) if inspector_user else None
            
            if profile:
                full_name = f"{profile.first_name} {profile.middle_name + ' ' if profile.middle_name else ''}{profile.last_name}".strip()
                profile_img_url = profile.profile_img.url if profile.profile_img else None
            else:
                full_name = inspector_user.email if inspector_user else "Unknown Inspector"
                profile_img_url = None

            # ── Build images list (ONLY meta-related) ─────────────────────
            # ✅ CORRECT USAGE: fa.images is the RelatedManager created by related_name='images'
            # .all() retrieves the list of images for this assessment.
            images_data = []
            for img in fa.images.all():
                # Filter by layer code. Ensure img.layer is not None.
                if img.layer and img.layer in META_LAYER_CODES:
                    images_data.append({
                        "image_id": img.field_assessment_images_id,
                        "url": request.build_absolute_uri(img.img.url) if img.img else None,
                        "layer": img.layer,
                        "latitude": float(img.latitude) if img.latitude is not None else None,
                        "longitude": float(img.longitude) if img.longitude is not None else None,
                        "description": img.description or "",
                        "created_at": img.created_at.isoformat(),
                    })

            # ── Build assessment object ──────────────────────────────────
            data.append({
                "field_assessment_id": fa.field_assessment_id,
                "inspector_id": inspector_user.id if inspector_user else None,
                "inspector_name": full_name,
                "inspector_email": inspector_user.email if inspector_user else None,
                "inspector_profile_img": profile_img_url,
                "assessment_date": fa.assessment_date.isoformat() if fa.assessment_date else None,
                "location": fa.location,
                "field_assessment_data": fa.field_assessment_data,  # Full JSON for frontend parsing
                "is_submitted": fa.is_submitted,
                "image_count": len(images_data),  # Count reflects filtered meta images
                "images": images_data,  # Only meta-related images
                "created_at": fa.created_at.isoformat(),
                "submitted_at": fa.updated_at.isoformat(),
            })

        return JsonResponse(data, safe=False, encoder=DjangoJSONEncoder, status=200)
        
    except Exception as e:
        logger.error(f"❌ Error in get_area_meta_data: {e}", exc_info=True)
        return JsonResponse({'error': f'Server error: {str(e)}'}, status=500)