from django.shortcuts import get_object_or_404
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from .models import LandClassification, Classified_areas
from barangay.models import Barangay
from .models import Classified_areas
from reforestation_areas.models import Reforestation_areas
from django.conf import settings
from security.views import log_activity
import json
import math
import jwt


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

@csrf_exempt 
def get_barangay_classified_areas(request, barangay_id):
    """
    Returns classified/restricted areas for a specific barangay.
    Handles One-to-Many relationship (one barangay → many classified areas).
    """
    # ✅ Fix: Block non-GET requests (original logic was inverted)
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET method is allowed'}, status=405)
    
    try:
        # ✅ Verify barangay exists using get_object_or_404
        barangay = get_object_or_404(Barangay, barangay_id=barangay_id)
        
        # ✅ Use .filter() for One-to-Many: get ALL classified areas for this barangay
        # ✅ Use select_related to optimize DB queries for land_classification
        areas = Classified_areas.objects.filter(
            barangay=barangay
        ).select_related('land_classification')
        
        # ✅ Serialize data for frontend consumption
        data = []
        for area in areas:
            data.append({
                'classified_area_id': area.classified_area_id,
                'name': area.name,
                'description': area.description,
                'land_classification': {
                    'id': area.land_classification.land_classification_id,
                    'name': area.land_classification.name
                } if area.land_classification else None,
                'polygon': area.polygon,  # GeoJSON-compatible JSON field
                'created_at': area.created_at.isoformat() if area.created_at else None,
            })
            
        return JsonResponse({
            'success': True,
            'barangay_id': barangay.barangay_id,
            'barangay_name': barangay.name,
            'count': len(data),
            'data': data
        }, safe=False)
        
    except Exception as e:
        return JsonResponse({
            'error': str(e), 
            'success': False
        }, status=500)

@csrf_exempt 
def get_classified_areas_by_reforestation_area(request, reforestation_area_id):
    """
    Returns classified areas for a reforestation area by first getting its barangay.
    """
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET method is allowed'}, status=405)
    
    try:
        # ✅ Get reforestation area
        reforestation_area = get_object_or_404(
            Reforestation_areas, 
            reforestation_area_id=reforestation_area_id
        )
        
        # ✅ Get barangay from reforestation area
        if not reforestation_area.barangay:
            return JsonResponse({
                'success': False,
                'error': 'Reforestation area has no barangay assigned',
                'data': []
            }, status=400)
        
        # ✅ Get classified areas for this barangay
        areas = Classified_areas.objects.filter(
            barangay=reforestation_area.barangay
        ).select_related('land_classification')
        
        # ✅ Serialize
        data = []
        for area in areas:
            data.append({
                'classified_area_id': area.classified_area_id,
                'name': area.name,
                'description': area.description,
                'land_classification': {
                    'id': area.land_classification.land_classification_id,
                    'name': area.land_classification.name
                } if area.land_classification else None,
                'polygon': area.polygon,
                'created_at': area.created_at.isoformat() if area.created_at else None,
            })
            
        return JsonResponse({
            'success': True,
            'reforestation_area_id': reforestation_area_id,
            'barangay_id': reforestation_area.barangay.barangay_id,
            'barangay_name': reforestation_area.barangay.name,
            'count': len(data),
            'data': data
        }, safe=False)
        
    except Exception as e:
        import logging
        logging.error(f"Error fetching classified areas: {str(e)}")
        return JsonResponse({
            'error': str(e), 
            'success': False
        }, status=500)
    
@csrf_exempt
def get_classified_areas(request):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    # Get parameters with defaults
    search = request.GET.get('search', '').strip()
    landClassification_id = request.GET.get('land_classification_id', '').strip()
    barangay_id = request.GET.get('barangay_id', '').strip()
    try:
        entries = int(request.GET.get('entries', 10))
        page = int(request.GET.get('page', 1))
    except ValueError:
        entries = 10
        page = 1

    # Validate pagination values
    if entries <= 0:
        entries = 10
    if page <= 0:
        page = 1

    offset = (page - 1) * entries

    # Queryset with sorting by created_at (Descending: Newest first)
    classified_areas = (
        Classified_areas.objects
        .select_related('land_classification', 'barangay')
        .all()
        .order_by('-created_at')  # ✅ Sorted by created_at
    )

    # Apply search filter if exists
    if search:
        classified_areas = classified_areas.filter(name__icontains=search)
    if landClassification_id:
        classified_areas = classified_areas.filter(land_classification__land_classification_id=landClassification_id)
    if barangay_id:
        classified_areas = classified_areas.filter(barangay__barangay_id=barangay_id)
    # Get total count before slicing
    total = classified_areas.count()
    total_page = math.ceil(total / entries) if total > 0 else 1

    # Slice queryset for pagination (Django handles this efficiently in SQL)
    paginated_areas = classified_areas[offset: offset + entries]

    # Build data list
    data = [
        {
            'classified_area_id': area.classified_area_id,
            'name': area.name,
            'land_classification_id': area.land_classification.land_classification_id,
            'land_classification_name': area.land_classification.name,
            'barangay_id': area.barangay.barangay_id,
            'barangay_name': area.barangay.name,
            'polygon': area.polygon,
            'description': area.description,
            'created_at': area.created_at.isoformat()
        }
        for area in paginated_areas
    ]

    return JsonResponse({
        'data': data,
        'total_page': total_page,
        'page': page,
        'entries': entries,
        'total': total
    }, status=200)

@csrf_exempt
def get_classified_area(request, classified_area_id):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    classified_area = (
        Classified_areas.objects
        .select_related('land_classification', 'barangay')  # ✅ Added barangay
        .get(classified_area_id=classified_area_id)
    )

    data = {
        'classified_area_id': classified_area.classified_area_id,
        'name': classified_area.name,
        'land_classification_id': classified_area.land_classification.land_classification_id,
        'land_classification_name': classified_area.land_classification.name,
        'barangay_id': classified_area.barangay.barangay_id,  # ✅ Added
        'barangay_name': classified_area.barangay.name,        # ✅ Added
        'polygon': classified_area.polygon,
        'description': classified_area.description,
        'created_at': classified_area.created_at.isoformat()   # ✅ ISO format
    }

    return JsonResponse({'data': data}, status=200)

@csrf_exempt
def create_classified_area(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)

    try:
        data = json.loads(request.body)
        name = data['name']
        land_classification_id = data['land_classification_id']
        barangay_id = data['barangay_id']  # ✅ Added
        polygon = data['polygon']
        description = data['description']
    except KeyError as e:
        return JsonResponse({'error': f'Missing field: {str(e)}'}, status=400)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    classification = get_object_or_404(
        LandClassification,
        land_classification_id=land_classification_id
    )

    barangay = get_object_or_404(  # ✅ Added
        Barangay,
        barangay_id=barangay_id
    )

    classified_area = Classified_areas.objects.create(
        name=name,
        land_classification=classification,
        barangay=barangay,  # ✅ Added
        polygon=polygon,
        description=description
    )

    record_activity(
        request,
        action_type='CREATE',
        entity_type='ClassifiedArea',
        entity_id=classified_area.classified_area_id,
        entity_label=name,
        description=f'Classified area "{name}" created.',
        new_data={
            'name': name,
            'land_classification_id': land_classification_id,
            'barangay_id': barangay_id,
            'description': description,
        },
    )

    return JsonResponse(
        {'data': classified_area.classified_area_id, 'message': 'Created successfully'},
        status=201
    )


@csrf_exempt
def update_classified_area(request, classified_area_id):
    if request.method != 'PUT':
        return JsonResponse({'error': 'Only PUT allowed'}, status=405)

    try:
        data = json.loads(request.body)
        name = data['name']
        land_classification_id = data['land_classification_id']
        barangay_id = data['barangay_id']  # ✅ Added
        polygon = data['polygon']
        description = data['description']
    except KeyError as e:
        return JsonResponse({'error': f'Missing field: {str(e)}'}, status=400)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    classified_area = get_object_or_404(
        Classified_areas,
        classified_area_id=classified_area_id
    )

    classification = get_object_or_404(
        LandClassification,
        land_classification_id=land_classification_id
    )

    barangay = get_object_or_404(  # ✅ Added
        Barangay,
        barangay_id=barangay_id
    )

    _old = {
        'name': classified_area.name,
        'land_classification_id': classified_area.land_classification_id,
        'barangay_id': classified_area.barangay_id,
        'polygon': classified_area.polygon,
        'description': classified_area.description,
    }

    classified_area.name = name
    classified_area.land_classification = classification
    classified_area.barangay = barangay  # ✅ Added
    classified_area.polygon = polygon
    classified_area.description = description
    classified_area.save()

    _new = {
        'name': name,
        'land_classification_id': land_classification_id,
        'barangay_id': barangay_id,
        'polygon': polygon,
        'description': description,
    }
    _changed = [k for k in _old if str(_old[k]) != str(_new[k])]

    record_activity(
        request,
        action_type='UPDATE',
        entity_type='ClassifiedArea',
        entity_id=classified_area_id,
        entity_label=name,
        description=f'Classified area "{name}" updated. Fields changed: {", ".join(_changed) or "none"}.',
        old_data=_old,
        new_data=_new,
        changed_fields=_changed,
    )

    return JsonResponse({'message': 'Successfully updated!'}, status=200)


@csrf_exempt
def delete_classified_area(request, classified_area_id):
    if request.method != 'DELETE':
        return JsonResponse({'error': 'Only DELETE allowed'}, status=405)

    classified_area = get_object_or_404(
        Classified_areas,
        classified_area_id=classified_area_id
    )
    deleted_name = classified_area.name

    record_activity(
        request,
        action_type='DELETE',
        entity_type='ClassifiedArea',
        entity_id=classified_area_id,
        entity_label=deleted_name,
        description=f'Classified area "{deleted_name}" deleted.',
        old_data={
            'name': deleted_name,
            'land_classification_id': classified_area.land_classification_id,
            'barangay_id': classified_area.barangay_id,
            'description': classified_area.description,
        },
    )

    classified_area.delete()

    return JsonResponse({'message': 'Successfully deleted!'}, status=200)


