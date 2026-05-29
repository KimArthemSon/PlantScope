import json
import math
import logging
import jwt
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from django.utils import timezone
from accounts.helper import get_user_from_token
from security.views import log_activity
from .models import Reforestation_areas, Potential_sites, PermitDocument, AreaMetaDataVerification
from barangay.models import Barangay

# Optional: Link to external field_assessment app (graceful fallback if not installed)
try:
    from Field_assessment.models import FieldAssessment
except ImportError:
    FieldAssessment = None

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
    """
    Serializes Reforestation Area for React.
    Includes verification status summary for dashboard badges/status pills.
    """
    verification = getattr(area, 'meta_verification', None)
    
    return {
        'reforestation_area_id': area.reforestation_area_id,
        'name': area.name,
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
        'permit_count': area.permit_documents.count(),
        'verification_status': verification.status if verification else 'pending',
        'verification_decision_note': verification.decision_note if verification else None,
        'created_at': area.created_at.strftime("%d/%m/%y"),
    }


# ─────────────────────────────────────────────
# REFORESTATION AREA CRUD (Spatial/Basic Data Only)
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
    barangay_id = request.GET.get('barangay_id', 'All')
    land_classification_id = request.GET.get('land_classification_id', 'All')
    verification_status = request.GET.get('verification_status', 'All')

    try:
        entries = max(1, int(request.GET.get('entries', 10)))
        page = max(1, int(request.GET.get('page', 1)))
    except ValueError:
        return JsonResponse({'error': 'Invalid pagination values'}, status=400)

    offset = (page - 1) * entries
    areas = Reforestation_areas.objects.all().order_by('-created_at')
    
    if search:
        areas = areas.filter(name__icontains=search)
    if barangay_id != 'All':
        areas = areas.filter(barangay_id=barangay_id)
    if land_classification_id != 'All':
        areas = areas.filter(land_classification_id=land_classification_id)
    if verification_status != 'All':
        areas = areas.filter(meta_verification__status=verification_status)

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
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)

    try:
        name = request.POST.get('name', '').strip()
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
            polygon_coordinate=polygon_coordinate,
            coordinate=coordinate,
            barangay_id=barangay_id,
            description=description,
            area_img=area_img
        )

        record_activity(
            request, action_type='CREATE', entity_type='ReforestationArea',
            entity_id=area.reforestation_area_id, entity_label=name,
            description=f'Reforestation area "{name}" created.',
            new_data={'name': name, 'barangay_id': barangay_id, 'description': description},
        )

        return JsonResponse({
            'message': 'Successfully added',
            'data': {'reforestation_area_id': area.reforestation_area_id, 'name': area.name}
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
    """PUT/POST: Updates ONLY spatial & basic area details."""
    if request.method not in ['PUT', 'POST']:
        return JsonResponse({'error': 'Only PUT/POST allowed'}, status=405)

    area = get_object_or_404(Reforestation_areas, reforestation_area_id=reforestation_area_id)

    try:
        img = None
        _old = {
            'name': area.name, 'description': area.description,
            'barangay_id': area.barangay_id, 'land_classification_id': area.land_classification_id,
        }
        
        if request.content_type and 'multipart/form-data' in request.content_type:
            data = request.POST
            img = request.FILES.get('area_img', None)
        else:
            try:
                body = json.loads(request.body)
                data = body
            except json.JSONDecodeError:
                return JsonResponse({'error': 'Invalid JSON format'}, status=400)

        if 'name' in data:
            if Reforestation_areas.objects.exclude(reforestation_area_id=reforestation_area_id).filter(name__iexact=data['name']).exists():
                return JsonResponse({'error': 'Name already exists'}, status=409)
            area.name = data['name'].strip()
        
        if img:
            area.area_img = img
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

        area.save()

        _new = {
            'name': area.name, 'description': area.description,
            'barangay_id': area.barangay_id, 'land_classification_id': area.land_classification_id,
        }
        _changed = [k for k in _old if str(_old[k]) != str(_new[k])]

        record_activity(
            request, action_type='UPDATE', entity_type='ReforestationArea',
            entity_id=reforestation_area_id, entity_label=area.name,
            description=f'Area updated. Fields changed: {", ".join(_changed) or "none"}.',
            old_data=_old, new_data=_new, changed_fields=_changed,
        )

        return JsonResponse({'message': 'Successfully updated', 'data': _serialize_area(area)}, status=200)

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
        request, action_type='DELETE', entity_type='ReforestationArea',
        entity_id=reforestation_area_id, entity_label=deleted_name,
        description=f'Area "{deleted_name}" deleted.',
        old_data={'name': deleted_name, 'barangay_id': area.barangay_id},
    )

    area.delete()
    return JsonResponse({'message': 'Successfully deleted'}, status=200)


# =====================================================
# POTENTIAL SITES CRUD (UNCHANGED)
# =====================================================
@csrf_exempt
def get_potential_sites(request):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    area_id = request.GET.get('reforestation_area_id')
    qs = Potential_sites.objects.all()
    if area_id:
        qs = qs.filter(reforestation_area_id=area_id)
    return JsonResponse({'data': [s.to_dict() for s in qs]}, status=200)


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
        request, action_type='DELETE', entity_type='PotentialSite',
        entity_id=potential_sites_id, entity_label=f'Potential Site {potential_sites_id}',
        description=f'Potential site {potential_sites_id} deleted.',
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
            return JsonResponse({"error": "Missing required fields"}, status=400)

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
            request, action_type='CREATE', entity_type='PotentialSite',
            entity_id=reforestation_area_id, entity_label=f'Area {reforestation_area_id}',
            description=f'{created_count} potential site(s) bulk-created.',
            new_data={'reforestation_area_id': reforestation_area_id, 'created_count': created_count},
        )

        return JsonResponse({"success": True, "created_count": created_count, "message": f"Saved {created_count} sites"}, status=201)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)
    except Exception as e:
        logger.error(f"Error in bulk_create_potential_sites: {e}", exc_info=True)
        return JsonResponse({"error": f"Server error: {str(e)[:200]}"}, status=500)


# ─────────────────────────────────────────────
# AREA META DATA VERIFICATION (Admin Consolidation)
# ─────────────────────────────────────────────
@csrf_exempt
def get_area_verification(request, reforestation_area_id):
    """
    GET: Returns current verification record + list of field assessments for the left panel.
    """
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    area = get_object_or_404(Reforestation_areas, reforestation_area_id=reforestation_area_id)
    
    # Get or create placeholder verification record
    verification, _ = AreaMetaDataVerification.objects.get_or_create(
        reforestation_area=area,
        defaults={'status': 'pending'}
    )

    # Fetch field assessments from external app (if available)
    assessments_data = []
    if FieldAssessment:
        assessments = FieldAssessment.objects.filter(
            reforestation_area=area, status='submitted'
        ).order_by('-assessment_date').values(
            'assessment_id', 'inspector__first_name', 'inspector__last_name', 
            'inspector__email', 'assessment_date', 'inspector_data', 'status'
        )
        for a in assessments:
            # Parse raw JSON safely
            try:
                a['inspector_data'] = json.loads(a['inspector_data']) if a['inspector_data'] else {}
            except:
                a['inspector_data'] = {}
            assessments_data.append(a)

    return JsonResponse({
        'verification': {
            'id': verification.id,
            'status': verification.status,
            'verified_security_concerns': verification.verified_security_concerns,
            'verified_accessibility': verification.verified_accessibility,
            'verified_land_classification_id': verification.verified_land_classification_id,
            'verified_land_classification_name': verification.verified_land_classification.name if verification.verified_land_classification else None,
            'decision_note': verification.decision_note,
            'referenced_assessment_ids': verification.referenced_assessment_ids,
            'verified_by': verification.verified_by.email if verification.verified_by else None,
            'verified_at': verification.verified_at.isoformat() if verification.verified_at else None,
        },
        'field_assessments': assessments_data,
        'area_info': _serialize_area(area)
    }, status=200)


@csrf_exempt
def update_area_verification(request, reforestation_area_id):
    """
    PUT/POST: Save Draft, Accept, or Reject.
    Expects JSON payload matching AreaMetaDataVerification fields.
    """
    if request.method not in ['PUT', 'POST']:
        return JsonResponse({'error': 'Only PUT/POST allowed'}, status=405)

    area = get_object_or_404(Reforestation_areas, reforestation_area_id=reforestation_area_id)
    user, _ = _get_request_user(request)

    try:
        if request.content_type and 'multipart/form-data' in request.content_type:
            try:
                data = json.loads(request.POST.get('verification_data', '{}'))
            except json.JSONDecodeError:
                return JsonResponse({'error': 'Invalid verification_data JSON'}, status=400)
        else:
            try:
                data = json.loads(request.body)
            except json.JSONDecodeError:
                return JsonResponse({'error': 'Invalid JSON'}, status=400)

        verification, created = AreaMetaDataVerification.objects.get_or_create(
            reforestation_area=area,
            defaults={'status': 'draft', 'verified_by': user}
        )

        _old = {
            'status': verification.status,
            'security_concerns': verification.verified_security_concerns,
            'accessibility': verification.verified_accessibility,
            'land_classification_id': verification.verified_land_classification_id,
            'decision_note': verification.decision_note
        }

        # Update consolidation fields
        if 'verified_security_concerns' in data:
            verification.verified_security_concerns = data['verified_security_concerns']
        if 'verified_accessibility' in data:
            verification.verified_accessibility = data['verified_accessibility']
        if 'verified_land_classification_id' in data:
            verification.verified_land_classification_id = data['verified_land_classification_id']
        if 'decision_note' in data:
            verification.decision_note = data['decision_note']
        if 'referenced_assessment_ids' in data:
            verification.referenced_assessment_ids = data['referenced_assessment_ids']
        if 'status' in data:
            verification.status = data['status']

        # Auto-set timestamps & auditor on final decision
        if verification.status in ['verified', 'rejected']:
            verification.verified_by = user
            verification.verified_at = timezone.now()
        else:
            verification.verified_by = user  # Track who saved draft

        verification.save()

        _new = {
            'status': verification.status,
            'security_concerns': verification.verified_security_concerns,
            'accessibility': verification.verified_accessibility,
            'land_classification_id': verification.verified_land_classification_id,
            'decision_note': verification.decision_note
        }
        _changed = [k for k in _old if str(_old[k]) != str(_new[k])]

        record_activity(
            request, action_type='UPDATE' if not created else 'CREATE', 
            entity_type='AreaMetaDataVerification', entity_id=verification.id,
            entity_label=f"Verification: {area.name}",
            description=f'Verification status changed to {verification.status}. Fields: {", ".join(_changed) or "none"}.',
            old_data=_old, new_data=_new, changed_fields=_changed,
        )

        return JsonResponse({
            'message': f'Verification {verification.status}',
            'data': {
                'id': verification.id,
                'status': verification.status,
                'verified_at': verification.verified_at.isoformat() if verification.verified_at else None
            }
        }, status=200)

    except Exception as e:
        logger.error(f"Verification update error: {e}", exc_info=True)
        return JsonResponse({'error': f'Failed to update verification: {str(e)[:100]}'}, status=500)


# ─────────────────────────────────────────────
# PERMIT DOCUMENT CRUD (UNCHANGED, MINOR CLEANUP)
# ─────────────────────────────────────────────
@csrf_exempt
def list_permits(request, reforestation_area_id):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    try:
        user = get_user_from_token(request)
        allowed_roles = ["GISSpecialist", "CityENROHead", "DataManager", "Admin"]
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
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)
    try:
        user = get_user_from_token(request)
        allowed_roles = ["GISSpecialist", "CityENROHead", "DataManager", "Admin"]
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
            request, action_type='CREATE', entity_type='PermitDocument',
            entity_id=permit.permit_id, entity_label=f'{document_type} - {permit_number or "no number"}',
            description=f'Permit "{document_type}" uploaded for area {reforestation_area_id}.',
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
    if request.method != 'DELETE':
        return JsonResponse({'error': 'Only DELETE allowed'}, status=405)
    try:
        user = get_user_from_token(request)
        allowed_roles = ["GISSpecialist", "CityENROHead", "DataManager", "Admin"]
        if not user or user.user_role not in allowed_roles:
            return JsonResponse({'error': 'Unauthorized'}, status=403)

        permit = get_object_or_404(PermitDocument, permit_id=permit_id)

        record_activity(
            request, action_type='DELETE', entity_type='PermitDocument',
            entity_id=permit_id, entity_label=permit.document_type,
            description=f'Permit "{permit.document_type}" deleted from area {permit.reforestation_area_id}.',
            old_data={'document_type': permit.document_type, 'permit_number': permit.permit_number, 'reforestation_area_id': permit.reforestation_area_id},
        )

        if permit.file:
            try:
                permit.file.delete(save=False)
            except Exception as file_err:
                logger.warning(f"Could not delete file for permit {permit_id}: {file_err}")

        permit.delete()
        return JsonResponse({'message': 'Permit deleted'}, status=200)
    except Exception as e:
        logger.error(f"Delete permit error: {e}", exc_info=True)
        return JsonResponse({'error': str(e)}, status=500)
    
@csrf_exempt
def get_area_verification(request, reforestation_area_id):
    """
    GET: Return the saved verification record for an area.
    Endpoint: GET /api/reforestation-areas/{id}/verification/
    """
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    
    try:
        area = get_object_or_404(Reforestation_areas, reforestation_area_id=reforestation_area_id)
        
        # Get or create verification record
        verification, _ = AreaMetaDataVerification.objects.get_or_create(
            reforestation_area=area,
            defaults={'status': 'pending'}
        )
        
        return JsonResponse({
            'id': verification.id,
            'status': verification.status,
            'verified_security_concerns': verification.verified_security_concerns or [],
            'verified_accessibility': verification.verified_accessibility or [],
            'verified_land_classification_id': verification.verified_land_classification_id,
            'decision_note': verification.decision_note or '',
            'referenced_assessment_ids': verification.referenced_assessment_ids or [],
            'verified_by': verification.verified_by.email if verification.verified_by else None,
            'verified_at': verification.verified_at.isoformat() if verification.verified_at else None,
        }, status=200)
        
    except Exception as e:
        logger.error(f"Error fetching verification: {e}", exc_info=True)
        return JsonResponse({'error': str(e)}, status=500)