from django.shortcuts import get_object_or_404
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from .models import HazardArea
from barangay.models import Barangay
from django.conf import settings
from security.views import log_activity
import json
import math
import jwt
from django.db import IntegrityError

# -------------------- Helper Functions --------------------

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
    
    # FIXED: Extract only the first IP from the comma-separated list
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0].strip()
    else:
        ip = request.META.get('REMOTE_ADDR')
    
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


# -------------------- HazardArea Views --------------------

@csrf_exempt
def get_hazard_areas_list(request):
    """Returns a simplified list of hazard areas (useful for dropdowns/map layers)"""
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    
    hazard_type = request.GET.get('hazard_type', '').strip()
    barangay_id = request.GET.get('barangay_id', '').strip()
    
    queryset = HazardArea.objects.all().order_by('name')
    
    # Filter by hazard type if provided
    if hazard_type:
        queryset = queryset.filter(hazard_type=hazard_type)
        
    # Filter by barangay if provided
    if barangay_id:
        queryset = queryset.filter(barangay_id=barangay_id)

    data = list(queryset.values('hazard_area_id', 'name', 'hazard_type', 'barangay_id'))
    return JsonResponse({'data': data}, status=200)




@csrf_exempt
def get_hazard_areas(request):
    """Paginated, searchable, and filterable list of hazard areas"""
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    search = request.GET.get('search', '').strip()
    hazard_type = request.GET.get('hazard_type', '').strip()
    barangay_id = request.GET.get('barangay_id', '').strip()
    
    try:
        entries = int(request.GET.get('entries', 10))
        page = int(request.GET.get('page', 1))
    except ValueError:
        entries, page = 10, 1

    if entries <= 0: 
        entries = 10
    if page <= 0: 
        page = 1

    offset = (page - 1) * entries

    queryset = HazardArea.objects.all().order_by('-created_at')

    # Apply filters
    if search:
        queryset = queryset.filter(name__icontains=search)
    if hazard_type:
        queryset = queryset.filter(hazard_type=hazard_type)
    if barangay_id:
        queryset = queryset.filter(barangay_id=barangay_id)

    total = queryset.count()
    total_page = math.ceil(total / entries) if total > 0 else 1

    # Format dates manually instead of using .values()
    data = []
    for h in queryset[offset: offset + entries]:
        data.append({
            "hazard_area_id": h.hazard_area_id,
            "name": h.name,
            "hazard_type": h.hazard_type,
            "barangay_id": h.barangay_id,
            "polygon": h.polygon,
            "description": h.description,
            "created_at": h.created_at.strftime("%Y-%m-%d") if h.created_at else None,
            "updated_at": h.updated_at.strftime("%Y-%m-%d") if h.updated_at else None,
        })

    return JsonResponse({
        'data': data,
        'total_page': total_page,
        'page': page,
        'entries': entries,
        'total': total
    }, status=200)



def get_hazard_area(request, hazard_area_id):
    """Get details of a single hazard area by ID"""
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    area = get_object_or_404(HazardArea, pk=hazard_area_id)
    data = {
        'hazard_area_id': area.hazard_area_id,
        'name': area.name,
        'hazard_type': area.hazard_type,
        'barangay_id': area.barangay_id,
        'polygon': area.polygon,
        'description': area.description,
        'created_at': area.created_at,
        'updated_at': area.updated_at
    }
    return JsonResponse({'data': data}, status=200)


@csrf_exempt
def create_hazard_area(request):
    """Create a new hazard area"""
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)
    
    try:
        data = json.loads(request.body)
        name = data['name']
        hazard_type = data['hazard_type']
        description = data.get('description', '')
        barangay_id = data.get('barangay_id')
        polygon = data['polygon']
    except KeyError as e:
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)

    barangay = None
    if barangay_id:
        barangay = get_object_or_404(Barangay, pk=barangay_id)

    # ✅ Try to create, and catch the database duplicate error
    try:
        area = HazardArea.objects.create(
            name=name,
            hazard_type=hazard_type,
            description=description,
            barangay=barangay,
            polygon=polygon
        )
    except IntegrityError:
        # This runs if the name is a duplicate!
        return JsonResponse({
            'error': f'A hazard area with the name "{name}" already exists.'
        }, status=400)

    record_activity(
        request,
        action_type='CREATE',
        entity_type='HazardArea',
        entity_id=area.hazard_area_id,
        entity_label=name,
        description=f'Hazard area "{name}" ({hazard_type}) created.',
        new_data={
            'name': name, 
            'hazard_type': hazard_type, 
            'description': description, 
            'barangay_id': barangay_id, 
            'polygon': polygon
        },
    )

    return JsonResponse({'data': area.hazard_area_id, 'message': 'Successfully created!'}, status=201)


@csrf_exempt
def update_hazard_area(request, hazard_area_id):
    """Update an existing hazard area"""
    if request.method != 'PUT':
        return JsonResponse({'error': 'Only PUT allowed'}, status=405)
    
    try:
        data = json.loads(request.body)
        name = data['name']
        hazard_type = data['hazard_type']
        description = data.get('description', '')
        barangay_id = data.get('barangay_id')
        polygon = data['polygon']
    except KeyError as e:
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)

    area = get_object_or_404(HazardArea, pk=hazard_area_id)

    _old = {
        'name': area.name,
        'hazard_type': area.hazard_type,
        'description': area.description,
        'barangay_id': area.barangay_id,
        'polygon': area.polygon,
    }

    barangay = None
    if barangay_id:
        barangay = get_object_or_404(Barangay, pk=barangay_id)

    area.name = name
    area.hazard_type = hazard_type
    area.description = description
    area.barangay = barangay
    area.polygon = polygon
    
    # ✅ Wrap save() in try/except to catch duplicate names
    try:
        area.save()
    except IntegrityError:
        return JsonResponse({
            'error': f'A hazard area with the name "{name}" already exists.'
        }, status=400)

    # Only calculate changes and log activity if the save was successful
    _new = {
        'name': area.name,
        'hazard_type': area.hazard_type,
        'description': area.description,
        'barangay_id': area.barangay_id,
        'polygon': area.polygon,
    }
    _changed = [k for k in _old if str(_old[k]) != str(_new[k])]

    record_activity(
        request,
        action_type='UPDATE',
        entity_type='HazardArea',
        entity_id=hazard_area_id,
        entity_label=name,
        description=f'Hazard area "{name}" updated. Fields changed: {", ".join(_changed) or "none"}.',
        old_data=_old,
        new_data=_new,
        changed_fields=_changed,
    )

    return JsonResponse({'message': 'Successfully updated!'}, status=200)


@csrf_exempt
def delete_hazard_area(request, hazard_area_id):
    """Delete a hazard area"""
    if request.method != 'DELETE':
        return JsonResponse({'error': 'Only DELETE allowed'}, status=405)

    area = get_object_or_404(HazardArea, pk=hazard_area_id)
    deleted_name = area.name
    deleted_type = area.get_hazard_type_display()

    # ✅ CHECK FOR DEPENDENT FOREIGN KEY RECORDS
    for related in HazardArea._meta.related_objects:
        accessor = related.get_accessor_name()
        related_manager = getattr(area, accessor)
        
        # If any related table has records pointing to this area, block deletion
        if related_manager.exists():
            related_model_name = related.related_model._meta.verbose_name_plural.title()
            return JsonResponse({
                'error': f'Cannot delete "{deleted_name}". It is currently linked to {related_model_name}.'
            }, status=400)

    record_activity(
        request,
        action_type='DELETE',
        entity_type='HazardArea',
        entity_id=hazard_area_id,
        entity_label=deleted_name,
        description=f'Hazard area "{deleted_name}" ({deleted_type}) deleted.',
        old_data={
            'name': deleted_name, 
            'hazard_type': area.hazard_type, 
            'barangay_id': area.barangay_id
        },
    )

    area.delete()
    return JsonResponse({'message': 'Successfully deleted!'}, status=200)


# -------------------- Dedicated Barangay Filter View --------------------

def get_hazard_areas_by_barangay(request, barangay_id):
    """Get all hazard areas specifically for a given barangay"""
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    
    # Verify barangay exists (optional but safe)
    get_object_or_404(Barangay, pk=barangay_id)
    
    # Filter strictly by this barangay
    areas = HazardArea.objects.filter(barangay_id=barangay_id).order_by('-created_at').values()
    
    return JsonResponse({'data': list(areas)}, status=200)


# Add this new endpoint to hazard_areas/views.py

@csrf_exempt
def get_all_hazard_polygons(request):
    """
    Returns ALL hazard polygons for offline download.
    This endpoint has NO pagination - it returns everything.
    """
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    try:
        # Get all hazard areas without pagination
        all_hazards = HazardArea.objects.all().order_by('name')
        
        data = []
        for h in all_hazards:
            data.append({
                'id': h.hazard_area_id,
                'name': h.name,
                'hazard_type': h.hazard_type,
                'barangay_id': h.barangay_id,
                'severity': 'MEDIUM',  # Default if not in model - adjust as needed
                'coordinates': h.polygon,  # Already in GeoJSON format
                'color': '#ef4444' if h.hazard_type.upper() == 'LANDSLIDE' 
                         else '#3b82f6' if h.hazard_type.upper() == 'FLOOD'
                         else '#8b5cf6',
                'downloadedAt': None,  # Will be set on client side
            })
            
        return JsonResponse({
            'success': True,
            'count': len(data),
            'data': data
        }, status=200)
        
    except Exception as e:
        import logging
        logging.error(f"Error fetching all hazard polygons: {str(e)}")
        return JsonResponse({
            'error': str(e),
            'success': False
        }, status=500)