import json
import math
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from django.db import IntegrityError
from .models import Reforestation_areas, Potential_sites
import logging
logger = logging.getLogger(__name__)

@csrf_exempt
def get_all_reforestation_areas(request):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    areas = Reforestation_areas.objects.all().order_by('-created_at')

    data = []
    for area in areas:

        barangay_data = None
        if area.barangay:
            barangay_data = {
                'barangay_id': area.barangay.barangay_id,
                'name': area.barangay.name
            }

        data.append({
            'reforestation_area_id': area.reforestation_area_id,
            'name': area.name,
            'legality': area.legality,
            'safety': area.safety,
            'polygon_coordinate': area.polygon_coordinate,
            'coordinate': area.coordinate,
            'barangay': barangay_data,
            'description': area.description,
            'area_img': area.area_img.url if area.area_img else None,
            'created_at': area.created_at.isoformat(),
        })

    return JsonResponse({'data': data}, status=200)

@csrf_exempt
def get_reforestation_areas(request):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    search = request.GET.get('search', '').strip()
    legality = request.GET.get('legality', 'All')
    safety = request.GET.get('safety', 'All')

    try:
        entries = int(request.GET.get('entries', 10))
        page = int(request.GET.get('page', 1))
    except ValueError:
        return JsonResponse({'error': 'Invalid pagination values'}, status=400)

    if entries <= 0:
        entries = 10
    if page <= 0:
        page = 1

    offset = (page - 1) * entries

    areas = Reforestation_areas.objects.all().order_by('-created_at')

    if search:
        areas = areas.filter(name__icontains=search)

    if legality != 'All':
        areas = areas.filter(legality=legality)

    if safety != 'All':
        areas = areas.filter(safety=safety)

    total = areas.count()
    total_page = math.ceil(total / entries) if total > 0 else 0

    data = []
    for area in areas[offset: offset + entries]:

        barangay_data = None
        if area.barangay:
            barangay_data = {
                'barangay_id': area.barangay.barangay_id,
                'name': area.barangay.name
            }

        data.append({
            'reforestation_area_id': area.reforestation_area_id,
            'name': area.name,
            'legality': area.legality,
            'safety': area.safety,
            'polygon_coordinate': area.polygon_coordinate,
            'coordinate': area.coordinate,
            'barangay': barangay_data,
            'description': area.description,
            'area_img': area.area_img.url if area.area_img else None,
            'created_at': area.created_at.isoformat(),
        })

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

    area = get_object_or_404(
        Reforestation_areas,
        reforestation_area_id=reforestation_area_id
    )

    barangay_data = None
    if area.barangay:
        barangay_data = {
            'barangay_id': area.barangay.barangay_id,
            'name': area.barangay.name
        }

    data = {
        'reforestation_area_id': area.reforestation_area_id,
        'name': area.name,
        'legality': area.legality,
        'safety': area.safety,
        'polygon_coordinate': area.polygon_coordinate,
        'coordinate': area.coordinate,
        'barangay': barangay_data,
        'description': area.description,
        'area_img': area.area_img.url if area.area_img else None,
        'created_at': area.created_at.isoformat(),
    }

    return JsonResponse({'data': data}, status=200)

@csrf_exempt
def create_reforestation_areas(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)

    try:
        name = request.POST.get('name', '').strip()
        legality = request.POST.get('legality', 'pending')
        safety = request.POST.get('safety', 'danger')
        barangay_id = int(request.POST.get('barangay_id', '').strip())
        description = request.POST.get('description', '').strip()
        polygon_coordinate = request.POST.get('polygon_coordinate')
        coordinate = request.POST.get('coordinate')

        if not name or not barangay_id:
            return JsonResponse({'error': 'Name and location are required'}, status=400)

        if polygon_coordinate:
            polygon_coordinate = json.loads(polygon_coordinate)

        if coordinate:
            coordinate = json.loads(coordinate)

        area_img = request.FILES.get('area_img')

    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON format in coordinates'}, status=400)

    valid_legalities = [choice[0] for choice in Reforestation_areas.legality_status]
    if legality not in valid_legalities:
        return JsonResponse({'error': f'Invalid legality value. Allowed: {valid_legalities}'}, status=400)

    valid_safety = [choice[0] for choice in Reforestation_areas.Safety_types]
    if safety not in valid_safety:
        return JsonResponse({'error': f'Invalid safety value. Allowed: {valid_safety}'}, status=400)

    if Reforestation_areas.objects.filter(name__iexact=name).exists():
        return JsonResponse({'error': 'Reforestation area with this name already exists'}, status=409)

    try:
        # ✅ CAPTURE THE CREATED AREA
        area = Reforestation_areas.objects.create(
            name=name,
            legality=legality,
            safety=safety,
            polygon_coordinate=polygon_coordinate,
            coordinate=coordinate,
            barangay_id=barangay_id,
            description=description,
            area_img=area_img
        )
        
        # ✅ RETURN THE AREA ID IN 'data' KEY
        return JsonResponse({
            'message': 'Successfully added',
            'data': {
                'reforestation_area_id': area.reforestation_area_id,
                'name': area.name
            }
        }, status=201)
        
    except IntegrityError:
        return JsonResponse({'error': 'Reforestation area already exists'}, status=409)

@csrf_exempt
def update_reforestation_areas(request, reforestation_area_id):
    if request.method not in ['PUT', 'POST']:
        return JsonResponse({'error': 'Only PUT allowed'}, status=405)

    area = get_object_or_404(
        Reforestation_areas,
        reforestation_area_id=reforestation_area_id
    )

    try:
        if request.content_type and request.content_type.startswith('multipart/form-data'):

            name = request.POST['name'].strip()
            legality = request.POST.get('legality', 'pending')
            safety = request.POST.get('safety', 'danger')
            barangay_id = int(request.POST.get('barangay_id', '').strip())
            description = request.POST.get('description', '')

            polygon_coordinate = request.POST.get('polygon_coordinate')
            coordinate = request.POST.get('coordinate')

            if polygon_coordinate:
                polygon_coordinate = json.loads(polygon_coordinate)
            if coordinate:
                coordinate = json.loads(coordinate)

            area_img = request.FILES.get('area_img')
            if area_img:
                area.area_img = area_img
        else:
            data = json.loads(request.body)
            name = data['name'].strip()
            legality = data.get('legality', "pending")
            safety = data.get('safety', 'danger')
            polygon_coordinate = data.get('polygon_coordinate')
            coordinate = data.get('coordinate')
            barangay_id = data['barangay_id']
            description = data['description']

    except (KeyError, json.JSONDecodeError):
        return JsonResponse({'error': 'Missing or invalid fields'}, status=400)

    if Reforestation_areas.objects.exclude(
        reforestation_area_id=reforestation_area_id
    ).filter(name__iexact=name).exists():
        return JsonResponse({'error': 'Reforestation area with this name already exists'}, status=409)

    area.name = name
    area.legality = legality
    area.safety = safety
    area.polygon_coordinate = polygon_coordinate
    area.coordinate = coordinate
    area.barangay_id = barangay_id
    area.description = description
    area.save()

    return JsonResponse({'message': 'Successfully updated'}, status=200)

@csrf_exempt
def delete_reforestation_areas(request, reforestation_area_id):
    if request.method != 'DELETE':
        return JsonResponse({'error': 'Only DELETE allowed'}, status=405)

    area = get_object_or_404(
        Reforestation_areas,
        reforestation_area_id=reforestation_area_id
    )

    area.delete()

    return JsonResponse({'message': 'Successfully deleted'}, status=200)

# =====================================================
# POTENTIAL SITES CRUD
# =====================================================

@csrf_exempt
def get_potential_sites(request):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    sites = Potential_sites.objects.all().values()

    return JsonResponse({
        'data': list(sites)
    }, status=200)

# =========================
# GET SINGLE POTENTIAL SITE
# =========================
@csrf_exempt
def get_potential_site(request, potential_sites_id):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    site = get_object_or_404(
        Potential_sites,
        potential_sites_id=potential_sites_id
    )

    data = {
        'potential_sites_id': site.potential_sites_id,
        'reforestation_area_id': site.reforestation_area.reforestation_area_id,
        'polygon_coordinates': site.polygon_coordinates
    }

    return JsonResponse({'data': data}, status=200)

# =========================
# DELETE POTENTIAL SITE
# =========================
@csrf_exempt
def delete_potential_site(request, potential_sites_id):
    if request.method != 'DELETE':
        return JsonResponse({'error': 'Only DELETE allowed'}, status=405)

    site = get_object_or_404(
        Potential_sites,
        potential_sites_id=potential_sites_id
    )
    site.delete()

    return JsonResponse({'message': 'Successfully deleted'}, status=200)

@csrf_exempt
def bulk_create_potential_sites(request):
    """
    POST /api/potential-sites/bulk-create/
    
    Save multiple potential sites from NDVI analysis to a reforestation area.
    
    Request Body:
    {
        "reforestation_area_id": 123,
        "sites": [
            {
                "site_id": "SITE-001",
                "geometry": {GeoJSON Polygon},
                "area_hectares": 2.4,
                "avg_ndvi": 0.28,
                "suitability_score": 72.0
            }
        ]
    }
    """
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed. Use POST."}, status=405)

    try:
        data = json.loads(request.body)
        
        reforestation_area_id = data.get('reforestation_area_id')
        sites = data.get('sites')
        
        if not reforestation_area_id or not sites or not isinstance(sites, list):
            return JsonResponse(
                {"error": "Missing required fields: 'reforestation_area_id' and 'sites' array"},
                status=400
            )
        
        reforestation_area = get_object_or_404(
            Reforestation_areas,
            reforestation_area_id=reforestation_area_id
        )
        
        created_count = 0
        
        for site_data in sites:
            # Skip invalid geometries
            if not site_data.get('geometry') or 'type' not in site_data['geometry']:
                continue
            
            Potential_sites.objects.create(
                reforestation_area=reforestation_area,
                site_id=site_data.get('site_id', ''),
                polygon_coordinates=site_data['geometry'],
                area_hectares=site_data.get('area_hectares', 0),
                avg_ndvi=site_data.get('avg_ndvi', 0),
                suitability_score=site_data.get('suitability_score', 0),
                ndvi_threshold=0.41  # Fixed threshold
            )
            created_count += 1
        
        return JsonResponse({
            "success": True,
            "created_count": created_count,
            "message": f"Successfully saved {created_count} potential site(s)"
        }, status=201)
        
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON in request body"}, status=400)
    except Exception as e:
        logger.error(f"❌ Error in bulk_create_potential_sites: {e}")
        return JsonResponse(
            {"error": f"Server error: {str(e)[:200]}"},
            status=500
        )