import json
from decimal import Decimal, InvalidOperation
from django.core.serializers.json import DjangoJSONEncoder
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import get_object_or_404
from accounts.helper import get_user_from_token, get_cloudinary_url, delete_cloudinary_resource
from security.views import log_activity
from .models import (
    Assigned_onsite_inspector, Field_assessment, Field_assessment_images, 
    FieldAssessmentAnimal, LandClassification
)
from animals.models import Animal
from django.db.models import Prefetch
from django.http.multipartparser import MultiPartParser

import logging

logger = logging.getLogger(__name__)

VALID_IMAGE_LAYERS = [
    'meta_land_title', 'meta_tax_decl', 'meta_other_doc',
    'safety_flood', 'safety_landslide', 'safety_erosion', 'safety_other',
    'surv_soil', 'surv_water', 'surv_animal', 'surv_slope',
    'bound_verification'
]

ORMOC_LAT_MIN, ORMOC_LAT_MAX = 10.90, 11.25
ORMOC_LNG_MIN, ORMOC_LNG_MAX = 124.40, 124.80

def _record_activity(user, request, action_type, entity_type, entity_id=None,
                     entity_label='', description='',
                     old_data=None, new_data=None, changed_fields=None):
    email = user.email if user else ''
    ip = request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR'))
    log_activity(
        performed_by=user, email=email, action_type=action_type, entity_type=entity_type,
        entity_id=entity_id, entity_label=entity_label, description=description,
        old_data=old_data, new_data=new_data, changed_fields=changed_fields, ip_address=ip,
    )

def check_inspector_assignment(user, reforestation_area_id):
    if not user or user.user_role != "OnsiteInspector": return False
    return Assigned_onsite_inspector.objects.filter(user=user, reforestation_area_id=reforestation_area_id).exists()

# ─────────────────────────────────────────────
# 1. GET ASSIGNED AREAS (Unchanged)
# ─────────────────────────────────────────────
@csrf_exempt
def get_assigned_reforestation_area(request):
    if request.method != 'GET': return JsonResponse({'error': 'Only GET allowed'}, status=405)
    try:
        user = get_user_from_token(request)
        if not user or user.user_role != "OnsiteInspector": return JsonResponse({'error': 'Unauthorized'}, status=403)
        records = Assigned_onsite_inspector.objects.filter(user=user).select_related('reforestation_area')
        data = []
        for r in records:
            area = r.reforestation_area
            coordinate = area.coordinate
            lat, lng, coord_display = _parse_coordinate(coordinate)
            data.append({
                "assigned_onsite_inspector_id": r.assigned_onsite_inspector_id,
                "reforestation_area_id": area.reforestation_area_id,
                "name": area.name, "description": area.description,
                "coordinate": coordinate, "latitude": lat, "longitude": lng, "coord_display": coord_display,
                "assigned_at": r.created_at.isoformat()
            })
        return JsonResponse(data, safe=False, status=200)
    except Exception as e: return JsonResponse({'error': str(e), 'success': False}, status=500)

def _parse_coordinate(coordinate):
    default_lat, default_lng = 11.0, 124.6
    if not coordinate: return default_lat, default_lng, "No Coordinates"
    try:
        if isinstance(coordinate, list) and len(coordinate) >= 2:
            lat, lng = float(coordinate[0]), float(coordinate[1])
            return lat, lng, f"{lat:.4f}° N, {lng:.4f}° E"
        if isinstance(coordinate, dict):
            lat = float(coordinate.get('latitude', default_lat))
            lng = float(coordinate.get('longitude', default_lng))
            return lat, lng, f"{lat:.4f}° N, {lng:.4f}° E"
        if isinstance(coordinate, str) and ',' in coordinate:
            parts = coordinate.split(',')
            if len(parts) >= 2:
                lat, lng = float(parts[0].strip()), float(parts[1].strip())
                return lat, lng, f"{lat:.4f}° N, {lng:.4f}° E"
    except (ValueError, TypeError, KeyError): pass
    return default_lat, default_lng, "No Coordinates"

# ─────────────────────────────────────────────
# 2. GET FIELD ASSESSMENTS (LIST) - Updated to include new fields
# ─────────────────────────────────────────────
@csrf_exempt
def get_field_assessments(request):
    if request.method != 'GET': return JsonResponse({'error': 'Only GET allowed'}, status=405)
    try:
        user = get_user_from_token(request)
        if not user or user.user_role != "OnsiteInspector": return JsonResponse({'error': 'Unauthorized'}, status=403)

        q = Field_assessment.objects.filter(assigned_onsite_inspector__user=user).select_related(
            'assigned_onsite_inspector__reforestation_area', 'land_classification'
        )
        
        if aid := request.GET.get('reforestation_area_id'): q = q.filter(assigned_onsite_inspector__reforestation_area_id=aid)
        if request.GET.get('is_submitted') is not None: q = q.filter(is_submitted=(request.GET['is_submitted'].lower() == 'true'))
            
        sid = request.GET.get('site_id')
        if sid is not None:
            if sid.lower() == 'null' or sid == '0' or sid == '': q = q.filter(site_id__isnull=True)
            else:
                try: q = q.filter(site_id=int(sid))
                except ValueError: pass

        layer = request.GET.get('layer')
        if layer:
            VALID_LAYERS = ['meta_data', 'safety', 'boundary_verification', 'survivability']
            if layer not in VALID_LAYERS: return JsonResponse({'error': f'Invalid layer. Allowed: {VALID_LAYERS}'}, status=400)
            q = q.filter(field_assessment_data__has_key=layer)
        
        q = q.order_by('-updated_at')
        data = []
        for fa in q:
            if layer:
                layer_data = fa.field_assessment_data.get(layer)
                if not layer_data or (isinstance(layer_data, (dict, list)) and not layer_data): continue
            
            data.append({
                "field_assessment_id": fa.field_assessment_id,
                "reforestation_area_id": fa.assigned_onsite_inspector.reforestation_area_id,
                "reforestation_area_name": fa.assigned_onsite_inspector.reforestation_area.name,
                "site_id": fa.site_id,
                "assessment_date": fa.assessment_date.isoformat() if fa.assessment_date else None,
                "location": fa.location,
                "is_submitted": fa.is_submitted,
                "image_count": fa.images.count(),
                "field_assessment_data": fa.field_assessment_data,
                "layer_data": fa.field_assessment_data.get(layer) if layer else None,
                # ✅ NEW: Land Classification Summary
                "land_classification": {
                    "id": fa.land_classification.land_classification_id,
                    "name": fa.land_classification.name
                } if fa.land_classification else None,
                "created_at": fa.created_at.isoformat(),
                "updated_at": fa.updated_at.isoformat(),
            })
        return JsonResponse(data, safe=False, encoder=DjangoJSONEncoder, status=200)
    except Exception as e:
        logger.error(f"Error in get_field_assessments: {e}", exc_info=True)
        return JsonResponse({'error': str(e), 'success': False}, status=500)

# ────────────────────────────────────────────
# 3. GET FIELD ASSESSMENT DETAIL - Updated to include new fields
# ─────────────────────────────────────────────
@csrf_exempt
def get_field_assessment_detail(request, field_assessment_id):
    if request.method != 'GET': return JsonResponse({'error': 'Only GET allowed'}, status=405)
    try:
        user = get_user_from_token(request)
        if not user or user.user_role != "OnsiteInspector": return JsonResponse({'error': 'Unauthorized'}, status=403)

        fa = get_object_or_404(
            Field_assessment.objects.select_related(
                'assigned_onsite_inspector__user', 'assigned_onsite_inspector__reforestation_area', 'land_classification'
            ).prefetch_related('images', 'animal_relations__animal'),
            field_assessment_id=field_assessment_id
        )
        if fa.assigned_onsite_inspector.user != user: return JsonResponse({'error': 'Forbidden'}, status=403)

        images = [{
            "image_id": img.field_assessment_images_id, "layer": img.layer,
            "url": get_cloudinary_url(str(img.img)) if img.img else None,
            "latitude": float(img.latitude) if img.latitude is not None else None,
            "longitude": float(img.longitude) if img.longitude is not None else None,
            "description": img.description or "", "created_at": img.created_at.isoformat(),
        } for img in fa.images.order_by('created_at')]

        # ✅ NEW: Animals Present
        animals_data = [
            {
                "animal_id": rel.animal.animal_id,
                "name": rel.animal.name,
                "scientific_name": rel.animal.scientific_name
            }
            for rel in fa.animal_relations.all()
        ]

        return JsonResponse({
            "field_assessment_id": fa.field_assessment_id,
            "assessment_date": fa.assessment_date.isoformat() if fa.assessment_date else None,
            "location": fa.location,
            "field_assessment_data": fa.field_assessment_data,
            "is_submitted": fa.is_submitted,
            "images": images,
            # ✅ NEW: Land Classification & Animals
            "land_classification": {
                "id": fa.land_classification.land_classification_id,
                "name": fa.land_classification.name
            } if fa.land_classification else None,
            "animals_present": animals_data,
            "created_at": fa.created_at.isoformat(),
            "updated_at": fa.updated_at.isoformat(),
        }, encoder=DjangoJSONEncoder, status=200)
    except Exception as e: return JsonResponse({'error': str(e)}, status=500)

# ─────────────────────────────────────────────
# 4. CREATE FIELD ASSESSMENT (Supports JSON & Multipart with Images)
# ─────────────────────────────────────────────
@csrf_exempt
def create_field_assessment(request):
    if request.method != 'POST': return JsonResponse({'error': 'Only POST allowed'}, status=405)
    try:
        user = get_user_from_token(request)
        if not user or user.user_role != "OnsiteInspector": return JsonResponse({'error': 'Unauthorized'}, status=403)

        is_multipart = request.content_type.startswith('multipart/form-data')
        
        # --- Parse Data based on Content-Type ---
        if is_multipart:
            reforestation_area_id = request.POST.get('reforestation_area_id')
            site_id = request.POST.get('site_id')
            assessment_date = request.POST.get('assessment_date')
            raw_location = json.loads(request.POST.get('location', 'null')) if request.POST.get('location') else None
            field_data = json.loads(request.POST.get('field_assessment_data', '{}'))
            land_classification_id = request.POST.get('land_classification_id')
            animal_ids_raw = request.POST.get('animal_ids', '[]')
            animal_ids = json.loads(animal_ids_raw) if isinstance(animal_ids_raw, str) else (animal_ids_raw if isinstance(animal_ids_raw, list) else [])
            
            images_files = request.FILES.getlist('images')
            image_metadata_raw = request.POST.get('image_metadata', '[]')
            image_metadata = json.loads(image_metadata_raw) if isinstance(image_metadata_raw, str) else []
        else:
            body = json.loads(request.body)
            reforestation_area_id = body.get('reforestation_area_id')
            site_id = body.get('site_id')
            assessment_date = body.get('assessment_date')
            raw_location = body.get('location')
            field_data = body.get('field_assessment_data', {})
            land_classification_id = body.get('land_classification_id')
            animal_ids = body.get('animal_ids', [])
            images_files = []
            image_metadata = []

        if not reforestation_area_id or not assessment_date:
            return JsonResponse({'error': 'reforestation_area_id and assessment_date are required'}, status=400)
        if not check_inspector_assignment(user, reforestation_area_id):
            return JsonResponse({'error': 'You are not assigned to this area'}, status=403)

        location = None
        if raw_location and isinstance(raw_location, dict):
            if 'latitude' not in raw_location or 'longitude' not in raw_location:
                return JsonResponse({'error': 'Invalid location'}, status=400)
            location = raw_location

        assignment = get_object_or_404(Assigned_onsite_inspector, user=user, reforestation_area_id=reforestation_area_id)

        # --- Handle Land Classification ---
        land_class_obj = None
        if land_classification_id:
            try:
                land_class_obj = LandClassification.objects.get(land_classification_id=land_classification_id)
            except LandClassification.DoesNotExist:
                return JsonResponse({'error': 'Invalid land_classification_id'}, status=400)

        # --- Create Assessment ---
        fa = Field_assessment.objects.create(
            assigned_onsite_inspector=assignment,
            assessment_date=assessment_date,
            site_id=site_id,
            location=location,
            field_assessment_data=field_data,
            land_classification=land_class_obj,
            is_submitted=False
        )

        # --- Handle Animals ---
        if animal_ids:
            for animal_id in animal_ids:
                try:
                    animal = Animal.objects.get(animal_id=animal_id)
                    FieldAssessmentAnimal.objects.create(field_assessment=fa, animal=animal)
                except Animal.DoesNotExist:
                    pass # Ignore invalid IDs

        # --- Handle Images (Multipart Only) ---
        if is_multipart and images_files:
            if len(images_files) != len(image_metadata):
                fa.delete() # Cleanup
                return JsonResponse({'error': 'Image count mismatch with metadata'}, status=400)
            
            for i, img_file in enumerate(images_files):
                meta = image_metadata[i]
                layer = meta.get('layer')
                if layer not in VALID_IMAGE_LAYERS:
                    fa.delete() # Cleanup
                    return JsonResponse({'error': f'Invalid layer: {layer}'}, status=400)
                
                lat = meta.get('latitude', 11.0)
                lng = meta.get('longitude', 124.6)
                description = meta.get('description', '')

                Field_assessment_images.objects.create(
                    field_assessment=fa, layer=layer, img=img_file,
                    latitude=lat, longitude=lng, description=description
                )

        _record_activity(user, request, 'CREATE', 'FieldAssessment', fa.field_assessment_id,
                         f'Assessment {fa.field_assessment_id}', f'Created draft.',
                         new_data={'reforestation_area_id': reforestation_area_id})

        return JsonResponse({'message': 'Draft created', 'field_assessment_id': fa.field_assessment_id}, status=201)
    except json.JSONDecodeError: return JsonResponse({'error': 'Invalid JSON'}, status=400)
    except Exception as e: return JsonResponse({'error': str(e)}, status=500)

# ─────────────────────────────────────────────
# 5. UPDATE FIELD ASSESSMENT (Supports JSON & Multipart)
# ─────────────────────────────────────────────
@csrf_exempt
def update_field_assessment(request, field_assessment_id):
    if request.method not in ['POST', 'PUT']: return JsonResponse({'error': 'Only POST/PUT allowed'}, status=405)
    try:
        user = get_user_from_token(request)
        if not user or user.user_role != "OnsiteInspector": return JsonResponse({'error': 'Unauthorized'}, status=403)

        fa = get_object_or_404(Field_assessment, field_assessment_id=field_assessment_id)
        if fa.assigned_onsite_inspector.user != user: return JsonResponse({'error': 'Forbidden'}, status=403)
        if fa.is_submitted: return JsonResponse({'error': 'Cannot edit a submitted assessment'}, status=400)

        is_multipart = request.content_type.startswith('multipart/form-data')
        
        if is_multipart:
            # ✅ FIX: Django does not automatically parse multipart data for PUT requests into request.POST.
            # We must parse it manually using MultiPartParser to avoid fields being set to null.
            if request.method == 'PUT':
                parser = MultiPartParser(request.META, request, request.upload_handlers)
                post_data, files = parser.parse()
            else:
                post_data = request.POST
                files = request.FILES

            data = {
                'assessment_date': post_data.get('assessment_date'),
                'location': json.loads(post_data.get('location', 'null')) if post_data.get('location') else None,
                'field_assessment_data': json.loads(post_data.get('field_assessment_data', '{}')),
                'land_classification_id': post_data.get('land_classification_id'),
                'animal_ids': json.loads(post_data.get('animal_ids', '[]')) if post_data.get('animal_ids') else []
            }
            images_files = files.getlist('images')
            image_metadata_raw = post_data.get('image_metadata', '[]')
            image_metadata = json.loads(image_metadata_raw) if isinstance(image_metadata_raw, str) else []
        else:
            body = json.loads(request.body)
            data = body
            images_files = []
            image_metadata = []

        _changed = []
        if 'assessment_date' in data and data['assessment_date'] != fa.assessment_date:
            fa.assessment_date = data['assessment_date']; _changed.append('assessment_date')
        if 'location' in data and data['location'] != fa.location:
            fa.location = data['location']; _changed.append('location')
        if 'field_assessment_data' in data and data['field_assessment_data'] != fa.field_assessment_data:
            fa.field_assessment_data = data['field_assessment_data']; _changed.append('field_assessment_data')
            
        # --- Update Land Classification ---
        if 'land_classification_id' in data:
            lc_id = data['land_classification_id']
            # ✅ FIX: Handle empty string from frontend as None
            if lc_id == "" or lc_id is None:
                if fa.land_classification is not None:
                    fa.land_classification = None; _changed.append('land_classification')
            else:
                try:
                    new_lc = LandClassification.objects.get(land_classification_id=int(lc_id))
                    if fa.land_classification != new_lc:
                        fa.land_classification = new_lc; _changed.append('land_classification')
                except (LandClassification.DoesNotExist, ValueError):
                    return JsonResponse({'error': 'Invalid land_classification_id'}, status=400)

        fa.save()

        # --- Update Animals (Replace All) ---
        if 'animal_ids' in data:
            fa.animal_relations.all().delete() # Clear existing
            for animal_id in data['animal_ids']:
                try:
                    animal = Animal.objects.get(animal_id=animal_id)
                    FieldAssessmentAnimal.objects.create(field_assessment=fa, animal=animal)
                except Animal.DoesNotExist: pass
            _changed.append('animals_present')

        # --- Handle New Images (Append) ---
        if is_multipart and images_files:
            for i, img_file in enumerate(images_files):
                if i < len(image_metadata):
                    meta = image_metadata[i]
                    layer = meta.get('layer')
                    if layer in VALID_IMAGE_LAYERS:
                        Field_assessment_images.objects.create(
                            field_assessment=fa, layer=layer, img=img_file,
                            latitude=meta.get('latitude', 11.0), longitude=meta.get('longitude', 124.6),
                            description=meta.get('description', '')
                        )
            _changed.append('images')

        _record_activity(user, request, 'UPDATE', 'FieldAssessment', field_assessment_id,
                         f'Assessment {field_assessment_id}', f'Updated. Fields: {", ".join(_changed)}',
                         changed_fields=_changed)

        return JsonResponse({'message': 'Draft updated', 'updated_at': fa.updated_at.isoformat()}, status=200)
    except json.JSONDecodeError: return JsonResponse({'error': 'Invalid JSON'}, status=400)
    except Exception as e: 
        logger.error(f"Error in update_field_assessment: {e}", exc_info=True)
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

        # ✅ NEW: Delete all images from Cloudinary before deleting the assessment
        deleted_images = 0
        for img in fa.images.all():
            if img.img:
                print(f"🖼️ Deleting image {img.field_assessment_images_id} from Cloudinary...")
                if delete_cloudinary_resource(img.img, resource_type='image'):
                    deleted_images += 1

        _record_activity(
            user, request,
            action_type='DELETE',
            entity_type='FieldAssessment',
            entity_id=field_assessment_id,
            entity_label=f'Assessment {field_assessment_id}',
            description=f'Field assessment {field_assessment_id} deleted. {deleted_images} images removed from Cloudinary.',
            old_data={'assessment_date': fa.assessment_date.isoformat() if fa.assessment_date else None},
        )

        fa.delete()
        return JsonResponse({'message': 'Deleted successfully', 'images_deleted': deleted_images}, status=200)
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
            'url': get_cloudinary_url(str(img.img)) if img.img else None  # ✅ Absolute URL
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

        # ✅ NEW: Delete all images from Cloudinary before deleting the assessment
        deleted_images = 0
        for img in fa.images.all():
            if img.img:
                print(f"🖼️ Deleting image {img.field_assessment_images_id} from Cloudinary...")
                if delete_cloudinary_resource(img.img, resource_type='image'):
                    deleted_images += 1

        _record_activity(
            user, request,
            action_type='DELETE',
            entity_type='FieldAssessment',
            entity_id=field_assessment_id,
            entity_label=f'Assessment {field_assessment_id}',
            description=f'Field assessment {field_assessment_id} deleted by head user. {deleted_images} images removed from Cloudinary.',
            old_data={'is_submitted': fa.is_submitted},
        )

        fa.delete()
        return JsonResponse({'message': 'Assessment deleted successfully', 'images_deleted': deleted_images}, status=200)
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
                
                # ✅ FIX 1: Use helper for profile image
                profile_img_url = get_cloudinary_url(str(profile.profile_img)) if profile.profile_img else None
            else:
                full_name = inspector_user.email if inspector_user else "Unknown Inspector"
                profile_img_url = None

            # ── Build images list (ONLY meta-related) ────────────────────
            images_data = []
            for img in fa.images.all():
                # Filter by layer code. Ensure img.layer is not None.
                if img.layer and img.layer in META_LAYER_CODES:
                    images_data.append({
                        "image_id": img.field_assessment_images_id,
                        
                        # ✅ FIX 2: Use helper for assessment images (Removed build_absolute_uri)
                        "url": get_cloudinary_url(str(img.img)) if img.img else None,
                        
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
                "field_assessment_data": fa.field_assessment_data,
                "is_submitted": fa.is_submitted,
                "image_count": len(images_data),
                "images": images_data,
                "created_at": fa.created_at.isoformat(),
                "submitted_at": fa.updated_at.isoformat(),
            })

        return JsonResponse(data, safe=False, encoder=DjangoJSONEncoder, status=200)
        
    except Exception as e:
        logger.error(f"❌ Error in get_area_meta_data: {e}", exc_info=True)
        return JsonResponse({'error': f'Server error: {str(e)}'}, status=500)