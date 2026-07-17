import json
import math
import logging
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from .models import Reforestation_areas
from sites.models import Potential_sites, Sites

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────
# HELPER FUNCTION
# ─────────────────────────────────────────────
def _serialize_area(a):
    """
    Serializes Reforestation Area with site statistics
    ✅ UPDATED: Date format changed to M/D/YYYY
    """
    # Get site counts for this area
    sites_qs = Sites.objects.filter(reforestation_area=a, is_active=True)
    total_sites = sites_qs.count()
    
    # Count accepted AND verified sites
    accepted_verified_sites = sites_qs.filter(
        status='accepted',
        meta_verification__status='verified'
    ).count()
    
    # Count by status
    accepted_sites = sites_qs.filter(status='accepted').count()
    pending_sites = sites_qs.filter(status='pending').count()
    
    # ✅ Format date as M/D/YYYY (e.g., 5/30/2026)
    created_date = a.created_at.strftime('%Y-%m-%d').lstrip('0')
    
    return {
        'reforestation_area_id': a.reforestation_area_id,
        'name': a.name,
        'description': a.description,
        'coordinate': a.coordinate,
        'barangay': {
            'barangay_id': a.barangay.barangay_id,
            'name': a.barangay.name
        } if a.barangay else None,
        'created_at': created_date,  # ✅ Changed from '%Y-%m-%d %H:%M:%S'
        # Site statistics
        'site_stats': {
            'total': total_sites,
            'accepted_verified': accepted_verified_sites,
            'accepted': accepted_sites,
            'pending': pending_sites,
        }
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
    barangay_id = request.GET.get('barangay_id', '').strip()
    
    try:
        entries = max(1, int(request.GET.get('entries', 10)))
        page = max(1, int(request.GET.get('page', 1)))
    except ValueError:
        return JsonResponse({'error': 'Invalid pagination values'}, status=400)

    offset = (page - 1) * entries
    areas = Reforestation_areas.objects.all().order_by('-created_at')
    
    # Apply filters
    if search:
        areas = areas.filter(name__icontains=search)
    
    if barangay_id:
        try:
            areas = areas.filter(barangay_id=int(barangay_id))
        except ValueError:
            pass

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
        description = request.POST.get('description', '').strip()
        barangay_id = request.POST.get('barangay_id')
        coordinate = request.POST.get('coordinate')

        if not name:
            return JsonResponse({'error': 'Name is required'}, status=400)

        if coordinate:
            coordinate = json.loads(coordinate)

        if Reforestation_areas.objects.filter(name__iexact=name).exists():
            return JsonResponse({'error': 'Reforestation area with this name already exists'}, status=409)

        area = Reforestation_areas.objects.create(
            name=name, 
            description=description, 
            coordinate=coordinate,
            barangay_id=barangay_id if barangay_id else None
        )

        return JsonResponse({
            'message': 'Successfully added',
            'data': {
                'reforestation_area_id': area.reforestation_area_id, 
                'name': area.name
            }
        }, status=201)
    except Exception as e:
        logger.error(f"Create area error: {e}", exc_info=True)
        return JsonResponse({'error': f'Failed to create area: {str(e)[:100]}'}, status=500)

@csrf_exempt
def update_reforestation_areas(request, reforestation_area_id):
    if request.method not in ['PUT', 'POST']: 
        return JsonResponse({'error': 'Only PUT/POST allowed'}, status=405)
    area = get_object_or_404(Reforestation_areas, reforestation_area_id=reforestation_area_id)

    try:
        body = json.loads(request.body) if 'application/json' in request.content_type else request.POST
        
        if 'name' in body:
            if Reforestation_areas.objects.exclude(reforestation_area_id=reforestation_area_id).filter(name__iexact=body['name']).exists():
                return JsonResponse({'error': 'Name already exists'}, status=409)
            area.name = body['name'].strip()
        if 'description' in body: 
            area.description = body['description']
        if 'barangay_id' in body:
            area.barangay_id = body['barangay_id']
        if 'coordinate' in body:
            val = body['coordinate']
            area.coordinate = json.loads(val) if isinstance(val, str) else val

        area.save()
        return JsonResponse({'message': 'Successfully updated', 'data': _serialize_area(area)}, status=200)
    except Exception as e:
        logger.error(f"Update area error: {e}", exc_info=True)
        return JsonResponse({'error': f'Failed to update area: {str(e)[:100]}'}, status=500)

@csrf_exempt
def delete_reforestation_areas(request, reforestation_area_id):
    if request.method != 'DELETE': 
        return JsonResponse({'error': 'Only DELETE allowed'}, status=405)
    area = get_object_or_404(Reforestation_areas, reforestation_area_id=reforestation_area_id)
    area.delete()
    return JsonResponse({'message': 'Successfully deleted'}, status=200)
