import json
import math
import logging
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from .models import Reforestation_areas
from sites.models import Potential_sites, Sites

logger = logging.getLogger(__name__)

def _serialize_area(area):
    """
    Serializes Reforestation Area.
    ✅ UPDATED: Includes barangay data
    """
    return {
        'reforestation_area_id': area.reforestation_area_id,
        'name': area.name,
        'description': area.description,
        'coordinate': area.coordinate,
        'barangay': {
            'barangay_id': area.barangay.barangay_id,
            'name': area.barangay.name
        } if area.barangay else None,
        'created_at': area.created_at.strftime("%d/%m/%y"),
    }

# ─────────────────────────────────────────────
# REFORESTATION AREA CRUD (Core Container Only)
# ─────────────────────────────────────────────
@csrf_exempt
def get_all_reforestation_areas(request):
    if request.method != 'GET': 
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    areas = Reforestation_areas.objects.all().order_by('-created_at')
    return JsonResponse({'data': [_serialize_area(a) for a in areas]}, status=200)

def _serialize_area(a):
    """Serialize area with site counts"""
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
    
    return {
        'reforestation_area_id': a.reforestation_area_id,
        'name': a.name,
        'description': a.description,
        'coordinate': a.coordinate,
        'barangay': {
            'barangay_id': a.barangay.barangay_id,
            'name': a.barangay.name
        } if a.barangay else None,
        'created_at': a.created_at.strftime('%Y-%m-%d %H:%M:%S'),
        # ✅ NEW: Site statistics
        'site_stats': {
            'total': total_sites,
            'accepted_verified': accepted_verified_sites,
            'accepted': accepted_sites,
            'pending': pending_sites,
        }
    }


@csrf_exempt
def get_reforestation_areas(request):
    if request.method != 'GET': 
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    
    search = request.GET.get('search', '').strip()
    barangay_id = request.GET.get('barangay_id', '').strip()  # ✅ NEW
    
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
    
    # ✅ NEW: Filter by barangay
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

# =====================================================
# POTENTIAL SITES (Querying via Site relationship)
# =====================================================
@csrf_exempt
def get_potential_sites(request):
    if request.method != 'GET': 
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    
    site_id = request.GET.get('site_id')
    area_id = request.GET.get('reforestation_area_id')
    
    qs = Potential_sites.objects.all()
    if site_id:
        qs = qs.filter(site_id=site_id)
    elif area_id:
        # ✅ Query via the Site relationship since Potential_sites no longer has direct area FK
        qs = qs.filter(site__reforestation_area_id=area_id)
        
    return JsonResponse({'data': [s.to_dict() for s in qs]}, status=200)

@csrf_exempt
def get_potential_site(request, potential_sites_id):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    
    site = get_object_or_404(Potential_sites, potential_sites_id=potential_sites_id)
    return JsonResponse({'data': site.to_dict()}, status=200)

@csrf_exempt
def delete_potential_site(request, potential_sites_id):
    if request.method != 'DELETE':
        return JsonResponse({'error': 'Only DELETE allowed'}, status=405)
    
    site = get_object_or_404(Potential_sites, potential_sites_id=potential_sites_id)
    site.delete()
    return JsonResponse({'message': 'Successfully deleted'}, status=200)

@csrf_exempt
def bulk_create_potential_sites(request):
    """
    ✅ UPDATED: Now expects 'site_id' instead of 'reforestation_area_id'.
    Used when creating a Site and saving its NDVI markers "along with it".
    """
    if request.method != "POST": 
        return JsonResponse({"error": "POST only."}, status=405)
    try:
        data = json.loads(request.body)
        site_id = data.get('site_id') 
        sites_data = data.get('sites')
        
        if not site_id or not sites_data:
            return JsonResponse({"error": "site_id and sites array are required"}, status=400)

        site = get_object_or_404(Sites, site_id=site_id, is_active=True)
        created_count = 0
        
        for site_data in sites_data:
            if not site_data.get('geometry'): 
                continue
            Potential_sites.objects.create(
                site=site, # ✅ Linked directly to the official Site
                site_id=site_data.get('site_id', ''),
                polygon_coordinates=site_data['geometry'],
                area_hectares=site_data.get('area_hectares', 0),
                avg_ndvi=site_data.get('avg_ndvi', 0),
                suitability_score=site_data.get('suitability_score', 0),
                ndvi_threshold=0.41
            )
            created_count += 1
            
        return JsonResponse({"success": True, "created_count": created_count}, status=201)
    except Exception as e:
        logger.error(f"Bulk create potential sites error: {e}", exc_info=True)
        return JsonResponse({"error": str(e)}, status=500)