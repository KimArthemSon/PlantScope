import json
import math
import os
import logging
import jwt
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from django.db import IntegrityError
from django.conf import settings
from accounts.helper import get_user_from_token  # ✅ Added missing import
from security.views import log_activity
from .models import Reforestation_areas, Potential_sites, PermitDocument
from barangay.models import Barangay
logger = logging.getLogger(__name__)


def _get_request_user(request):
    try:
        from accounts.models import User
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


def _serialize_area(area):
    """✅ Consistent JSON response for all GET endpoints - includes permit_count for React"""
    return {
        'reforestation_area_id': area.reforestation_area_id,
        'name': area.name,
        'legality': area.legality,
        'pre_assessment_status': area.pre_assessment_status,
        'safety': area.safety,
        'polygon_coordinate': area.polygon_coordinate,
        'coordinate': area.coordinate,
        'barangay': {
            'barangay_id': area.barangay.barangay_id,
            'name': area.barangay.name
        } if area.barangay else None,
        'land_classification': {
            'land_classification_id': area.land_classification.land_classification_id,
            'name': area.land_classification.name
        } if area.land_classification else None,
        'description': area.description,
        'area_img': area.area_img.url if area.area_img else None,
        'reforestation_data': area.reforestation_data,
        'permit_count': area.permit_documents.count(),  # ✅ Added for React permit badge
        'created_at': area.created_at.strftime("%d/%m/%y"),
    }


# ─────────────────────────────────────────────
# REFORESTATION AREA CRUD
# ─────────────────────────────────────────────
@csrf_exempt
def get_all_reforestation_areas(request):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    areas = Reforestation_areas.objects.all().order_by('-created_at')
    return JsonResponse({'data': [_serialize_area(a) for a in areas]}, status=200)


@csrf_exempt
def get_reforestation_areas(request):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    search = request.GET.get('search', '').strip()
    legality = request.GET.get('legality', 'All')
    safety = request.GET.get('safety', 'All')
    barangay_id = request.GET.get('barangay_id', 'All')
    land_classification_id = request.GET.get('land_classification_id', 'All')
    pre_status = request.GET.get('pre_assessment_status', 'All')

    try:
        entries = max(1, int(request.GET.get('entries', 10)))
        page = max(1, int(request.GET.get('page', 1)))
    except ValueError:
        return JsonResponse({'error': 'Invalid pagination values'}, status=400)

    offset = (page - 1) * entries
    areas = Reforestation_areas.objects.all().order_by('-created_at')
    
    if search:
        areas = areas.filter(name__icontains=search)
    if legality != 'All':
        areas = areas.filter(legality=legality)
    if safety != 'All':
        areas = areas.filter(safety=safety)
    if barangay_id != 'All':
        areas = areas.filter(barangay_id=barangay_id)
    if land_classification_id != 'All':
        areas = areas.filter(land_classification_id=land_classification_id)
    if pre_status != 'All':
        areas = areas.filter(pre_assessment_status=pre_status)

    total = areas.count()
    total_page = math.ceil(total / entries) if total > 0 else 0
    data = [_serialize_area(a) for a in areas[offset: offset + entries]]

    return JsonResponse({
        'data': data,
        'total_page': total_page,
        'page': page,
        'entries': entries,
        'total': total
    }, status=200)


@csrf_exempt
def get_reforestation_area(request, reforestation_area_id):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    area = get_object_or_404(Reforestation_areas, reforestation_area_id=reforestation_area_id)
    return JsonResponse({'data': _serialize_area(area)}, status=200)


@csrf_exempt
def create_reforestation_areas(request):
    """
    ✅ KEPT EXACTLY AS REQUESTED.
    New columns (legality, pre_assessment_status, reforestation_data)
    automatically use defaults/nulls so your form never breaks.
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)

    try:
        name = request.POST.get('name', '').strip()
        safety = request.POST.get('safety', 'danger')
        barangay_id = int(request.POST.get('barangay_id', '').strip())
        description = request.POST.get('description', '').strip()
        polygon_coordinate = request.POST.get('polygon_coordinate')
        coordinate = request.POST.get('coordinate')
        area_img = request.FILES.get('area_img')

        if not name or not barangay_id:
            return JsonResponse({'error': 'Name and barangay_id are required'}, status=400)

        if polygon_coordinate:
            polygon_coordinate = json.loads(polygon_coordinate)
        if coordinate:
            coordinate = json.loads(coordinate)

        if Reforestation_areas.objects.filter(name__iexact=name).exists():
            return JsonResponse({'error': 'Reforestation area with this name already exists'}, status=409)

        area = Reforestation_areas.objects.create(
            name=name,
            safety=safety,
            polygon_coordinate=polygon_coordinate,
            coordinate=coordinate,
            barangay_id=barangay_id,
            description=description,
            area_img=area_img
        )

        record_activity(
            request,
            action_type='CREATE',
            entity_type='ReforestationArea',
            entity_id=area.reforestation_area_id,
            entity_label=name,
            description=f'Reforestation area "{name}" created.',
            new_data={'name': name, 'safety': safety, 'barangay_id': barangay_id, 'description': description},
        )

        return JsonResponse({
            'message': 'Successfully added',
            'data': {
                'reforestation_area_id': area.reforestation_area_id,
                'name': area.name
            }
        }, status=201)

    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON format in coordinates'}, status=400)
    except ValueError:
        return JsonResponse({'error': 'Invalid barangay_id format'}, status=400)
    except Exception as e:
        logger.error(f"Create error: {e}", exc_info=True)
        return JsonResponse({'error': f'Failed to create area: {str(e)[:100]}'}, status=500)


@csrf_exempt
def update_reforestation_areas(request, reforestation_area_id):
    """
    PUT/POST: GIS Specialist manual review & finalization.
    Accepts partial updates from your Right Panel form.
    """
    if request.method not in ['PUT', 'POST']:
        return JsonResponse({'error': 'Only PUT/POST allowed'}, status=405)

    area = get_object_or_404(Reforestation_areas, reforestation_area_id=reforestation_area_id)

    try:
        img = None
        _old = {
            'name': area.name,
            'legality': area.legality,
            'pre_assessment_status': area.pre_assessment_status,
            'safety': area.safety,
            'description': area.description,
            'barangay_id': area.barangay_id,
            'land_classification_id': area.land_classification_id,
        }
        # Handle multipart/form-data (file uploads) vs application/json
        if request.content_type and 'multipart/form-data' in request.content_type:
            data = request.POST
            reforestation_data_raw = data.get('reforestation_data')
            img = request.FILES.get('area_img', None)
            reforestation_data = json.loads(reforestation_data_raw) if reforestation_data_raw else None
        else:
            body = json.loads(request.body)
            data = body
            reforestation_data = data.get('reforestation_data')

        # Apply only provided fields (partial update safe)
        
        if 'name' in data:
            if Reforestation_areas.objects.exclude(reforestation_area_id=reforestation_area_id).filter(name__iexact=data['name']).exists():
                return JsonResponse({'error': 'Name already exists'}, status=409)
            area.name = data['name'].strip()
        
        if img:
            area.area_img = img
        if 'legality' in data:
            area.legality = data['legality']
        if 'pre_assessment_status' in data:
            area.pre_assessment_status = data['pre_assessment_status']
        if 'safety' in data:
            area.safety = data['safety']
        if 'barangay_id' in data:
            area.barangay_id = data['barangay_id']
        if 'land_classification_id' in data:
            area.land_classification_id = data['land_classification_id']
        if 'description' in data:
            area.description = data['description']

        if 'polygon_coordinate' in data:
            val = data['polygon_coordinate']
            area.polygon_coordinate = json.loads(val) if isinstance(val, str) else val
        if 'coordinate' in data:
            val = data['coordinate']
            area.coordinate = json.loads(val) if isinstance(val, str) else val

        if reforestation_data is not None:
            area.reforestation_data = reforestation_data

        area.save()

        _new = {
            'name': area.name,
            'legality': area.legality,
            'pre_assessment_status': area.pre_assessment_status,
            'safety': area.safety,
            'description': area.description,
            'barangay_id': area.barangay_id,
            'land_classification_id': area.land_classification_id,
        }
        _changed = [k for k in _old if str(_old[k]) != str(_new[k])]

        record_activity(
            request,
            action_type='UPDATE',
            entity_type='ReforestationArea',
            entity_id=reforestation_area_id,
            entity_label=area.name,
            description=f'Reforestation area "{area.name}" updated. Fields changed: {", ".join(_changed) or "none"}.',
            old_data=_old,
            new_data=_new,
            changed_fields=_changed,
        )

        return JsonResponse({'message': 'Successfully updated & finalized', 'data': _serialize_area(area)}, status=200)

    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON format'}, status=400)
    except Exception as e:
        logger.error(f"Update error: {e}", exc_info=True)
        return JsonResponse({'error': f'Failed to update area: {str(e)[:100]}'}, status=500)


@csrf_exempt
def delete_reforestation_areas(request, reforestation_area_id):
    if request.method != 'DELETE':
        return JsonResponse({'error': 'Only DELETE allowed'}, status=405)
    area = get_object_or_404(Reforestation_areas, reforestation_area_id=reforestation_area_id)
    deleted_name = area.name

    record_activity(
        request,
        action_type='DELETE',
        entity_type='ReforestationArea',
        entity_id=reforestation_area_id,
        entity_label=deleted_name,
        description=f'Reforestation area "{deleted_name}" deleted.',
        old_data={'name': deleted_name, 'safety': area.safety, 'barangay_id': area.barangay_id},
    )

    area.delete()
    return JsonResponse({'message': 'Successfully deleted'}, status=200)


# =====================================================
# POTENTIAL SITES CRUD (UNCHANGED AS REQUESTED)
# =====================================================
@csrf_exempt
def get_potential_sites(request):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    sites = Potential_sites.objects.all().values()
    return JsonResponse({'data': list(sites)}, status=200)


@csrf_exempt
def get_potential_site(request, potential_sites_id):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    site = get_object_or_404(Potential_sites, potential_sites_id=potential_sites_id)
    return JsonResponse({
        'data': {
            'potential_sites_id': site.potential_sites_id,
            'reforestation_area_id': site.reforestation_area.reforestation_area_id,
            'polygon_coordinates': site.polygon_coordinates
        }
    }, status=200)


@csrf_exempt
def delete_potential_site(request, potential_sites_id):
    if request.method != 'DELETE':
        return JsonResponse({'error': 'Only DELETE allowed'}, status=405)
    site = get_object_or_404(Potential_sites, potential_sites_id=potential_sites_id)

    record_activity(
        request,
        action_type='DELETE',
        entity_type='PotentialSite',
        entity_id=potential_sites_id,
        entity_label=f'Potential Site {potential_sites_id}',
        description=f'Potential site {potential_sites_id} deleted from reforestation area {site.reforestation_area_id}.',
        old_data={'reforestation_area_id': site.reforestation_area_id},
    )

    site.delete()
    return JsonResponse({'message': 'Successfully deleted'}, status=200)


@csrf_exempt
def bulk_create_potential_sites(request):
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed. Use POST."}, status=405)
    try:
        data = json.loads(request.body)
        reforestation_area_id = data.get('reforestation_area_id')
        sites = data.get('sites')
        if not reforestation_area_id or not sites or not isinstance(sites, list):
            return JsonResponse({"error": "Missing required fields: 'reforestation_area_id' and 'sites' array"}, status=400)

        reforestation_area = get_object_or_404(Reforestation_areas, reforestation_area_id=reforestation_area_id)
        created_count = 0
        for site_data in sites:
            if not site_data.get('geometry') or 'type' not in site_data['geometry']:
                continue
            Potential_sites.objects.create(
                reforestation_area=reforestation_area,
                site_id=site_data.get('site_id', ''),
                polygon_coordinates=site_data['geometry'],
                area_hectares=site_data.get('area_hectares', 0),
                avg_ndvi=site_data.get('avg_ndvi', 0),
                suitability_score=site_data.get('suitability_score', 0),
                ndvi_threshold=0.41
            )
            created_count += 1
        record_activity(
            request,
            action_type='CREATE',
            entity_type='PotentialSite',
            entity_id=reforestation_area_id,
            entity_label=f'Reforestation Area {reforestation_area_id}',
            description=f'{created_count} potential site(s) bulk-created for reforestation area {reforestation_area_id}.',
            new_data={'reforestation_area_id': reforestation_area_id, 'created_count': created_count},
        )

        return JsonResponse({
            "success": True,
            "created_count": created_count,
            "message": f"Successfully saved {created_count} potential site(s)"
        }, status=201)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON in request body"}, status=400)
    except Exception as e:
        logger.error(f"❌ Error in bulk_create_potential_sites: {e}", exc_info=True)
        return JsonResponse({"error": f"Server error: {str(e)[:200]}"}, status=500)


# ─────────────────────────────────────────────
# ✅ PERMIT DOCUMENT CRUD (GIS Specialist Only)
# ─────────────────────────────────────────────
@csrf_exempt
def list_permits(request, reforestation_area_id):
    """GET: List all verified permits for an area (GIS Specialist only)"""
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    try:
        user = get_user_from_token(request)
        allowed_roles = ["GISSpecialist", "CityENROHead"]
        if not user or user.user_role not in allowed_roles:
            return JsonResponse({'error': 'Unauthorized'}, status=403)

        area = get_object_or_404(Reforestation_areas, reforestation_area_id=reforestation_area_id)
        permits = area.permit_documents.select_related('uploaded_by').order_by('-uploaded_at')

        data = [{
            'permit_id': p.permit_id,
            'document_type': p.document_type,
            'permit_number': p.permit_number,
            'file_url': p.file.url if p.file else None,
            'verification_notes': p.verification_notes,
            'uploaded_at': p.uploaded_at.isoformat(),
            'uploaded_by': p.uploaded_by.email if p.uploaded_by else None,
        } for p in permits]
        return JsonResponse({'data': data}, status=200)
    except Exception as e:
        logger.error(f"List permits error: {e}", exc_info=True)
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
def upload_permit(request, reforestation_area_id):
    """POST multipart: GIS Specialist uploads a VERIFIED permit"""
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)
    try:
        user = get_user_from_token(request)
        allowed_roles = ["GISSpecialist", "CityENROHead"]
        if not user or user.user_role not in allowed_roles:
            return JsonResponse({'error': 'Unauthorized'}, status=403)

        area = get_object_or_404(Reforestation_areas, reforestation_area_id=reforestation_area_id)
        document_type = request.POST.get('document_type')
        permit_number = request.POST.get('permit_number', '').strip()
        verification_notes = request.POST.get('verification_notes', '').strip()
        permit_file = request.FILES.get('file')

        if not document_type or not permit_file:
            return JsonResponse({'error': 'document_type and file are required'}, status=400)

        valid_types = [t[0] for t in PermitDocument.DOCUMENT_TYPES]
        if document_type not in valid_types:
            return JsonResponse({'error': f'Invalid type. Allowed: {valid_types}'}, status=400)

        permit = PermitDocument.objects.create(
            reforestation_area=area,
            document_type=document_type,
            permit_number=permit_number or None,
            file=permit_file,
            verification_notes=verification_notes or None,
            uploaded_by=user
        )
        record_activity(
            request,
            action_type='CREATE',
            entity_type='PermitDocument',
            entity_id=permit.permit_id,
            entity_label=f'{document_type} - {permit_number or "no number"}',
            description=f'Permit document "{document_type}" uploaded for reforestation area {reforestation_area_id}.',
            new_data={'document_type': document_type, 'permit_number': permit_number, 'reforestation_area_id': reforestation_area_id},
        )

        return JsonResponse({
            'message': 'Permit verified & uploaded',
            'permit_id': permit.permit_id,
            'file_url': permit.file.url
        }, status=201)
    except Exception as e:
        logger.error(f"Permit upload error: {e}", exc_info=True)
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
def delete_permit(request, permit_id):
    """DELETE: Remove a verified permit (GIS Specialist only)"""
    if request.method != 'DELETE':
        return JsonResponse({'error': 'Only DELETE allowed'}, status=405)
    try:
        user = get_user_from_token(request)
        allowed_roles = ["GISSpecialist", "CityENROHead"]
        if not user or user.user_role not in allowed_roles:
            return JsonResponse({'error': 'Unauthorized'}, status=403)

        permit = get_object_or_404(PermitDocument, permit_id=permit_id)

        record_activity(
            request,
            action_type='DELETE',
            entity_type='PermitDocument',
            entity_id=permit_id,
            entity_label=permit.document_type,
            description=f'Permit document "{permit.document_type}" deleted from reforestation area {permit.reforestation_area_id}.',
            old_data={'document_type': permit.document_type, 'permit_number': permit.permit_number, 'reforestation_area_id': permit.reforestation_area_id},
        )

        # ✅ Auto-delete file from media/ using Django's storage API (safer than os.remove)
        if permit.file:
            try:
                permit.file.delete(save=False)  # Uses Django storage backend
            except Exception as file_err:
                logger.warning(f"Could not delete file for permit {permit_id}: {file_err}")

        permit.delete()
        return JsonResponse({'message': 'Permit deleted'}, status=200)
    except Exception as e:
        logger.error(f"Delete permit error: {e}", exc_info=True)
        return JsonResponse({'error': str(e)}, status=500)