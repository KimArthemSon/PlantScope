import json
import math
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from django.db import IntegrityError
from .models import Reforestation_areas, Potential_sites


# =====================================================
# REFORESTATION AREAS CRUD
# =====================================================

# =========================
# GET REFORESTATION AREAS (LIST + SEARCH + PAGINATION)
# =========================
@csrf_exempt
def get_reforestation_areas(request):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    search = request.GET.get('search', '').strip()
    entries = int(request.GET.get('entries', 10))
    page = int(request.GET.get('page', 1))

    if entries <= 0:
        entries = 10
    if page <= 0:
        page = 1

    offset = (page - 1) * entries

    areas = Reforestation_areas.objects.all().order_by('-created_at')

    if search:
        areas = areas.filter(name__icontains=search)

    total = areas.count()
    total_page = math.ceil(total / entries) if total > 0 else 0

    data = list(
        areas[offset: offset + entries].values()
    )

    return JsonResponse({
        'data': data,
        'total_page': total_page,
        'page': page,
        'entries': entries,
        'total': total
    }, status=200)


# =========================
# GET SINGLE REFORESTATION AREA
# =========================
@csrf_exempt
def get_reforestation_area(request, reforestation_area_id):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    area = get_object_or_404(
        Reforestation_areas,
        reforestation_area_id=reforestation_area_id
    )

    data = {
        'reforestation_area_id': area.reforestation_area_id,
        'name': area.name,
        'legality': area.legality,
        'safety': area.safety,
        'polygon_coordinate': area.polygon_coordinate,
        'coordinate': area.coordinate,
        'location': area.location,
        'description': area.description,
        'area_img': area.area_img.url if area.area_img else None,
        'created_at': area.created_at,
    }

    return JsonResponse({'data': data}, status=200)


# =========================
# CREATE REFORESTATION AREA
# =========================
@csrf_exempt
def create_reforestation_areas(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)

    try:
        data = json.loads(request.body)

        name = data['name'].strip()
        legality = data.get('legality', True)
        safety = data.get('safety', 'danger')
        polygon_coordinate = data.get('polygon_coordinate')
        coordinate = data.get('coordinate')
        location = data['location']
        description = data['description']

    except (KeyError, json.JSONDecodeError):
        return JsonResponse(
            {'error': 'Missing or invalid fields'},
            status=400
        )

    if Reforestation_areas.objects.filter(name__iexact=name).exists():
        return JsonResponse(
            {'error': 'Reforestation area with this name already exists'},
            status=409
        )

    try:
        Reforestation_areas.objects.create(
            name=name,
            legality=legality,
            safety=safety,
            polygon_coordinate=polygon_coordinate,
            coordinate=coordinate,
            location=location,
            description=description
        )
    except IntegrityError:
        return JsonResponse(
            {'error': 'Reforestation area with this name already exists'},
            status=409
        )

    return JsonResponse({'message': 'Successfully added'}, status=201)


# =========================
# UPDATE REFORESTATION AREA
# =========================
@csrf_exempt
def update_reforestation_areas(request, reforestation_area_id):
    if request.method != 'PUT':
        return JsonResponse({'error': 'Only PUT allowed'}, status=405)

    try:
        data = json.loads(request.body)

        name = data['name'].strip()
        legality = data.get('legality', True)
        safety = data.get('safety', 'danger')
        polygon_coordinate = data.get('polygon_coordinate')
        coordinate = data.get('coordinate')
        location = data['location']
        description = data['description']

    except (KeyError, json.JSONDecodeError):
        return JsonResponse(
            {'error': 'Missing or invalid fields'},
            status=400
        )

    area = get_object_or_404(
        Reforestation_areas,
        reforestation_area_id=reforestation_area_id
    )

    if Reforestation_areas.objects.exclude(
        reforestation_area_id=reforestation_area_id
    ).filter(name__iexact=name).exists():
        return JsonResponse(
            {'error': 'Reforestation area with this name already exists'},
            status=409
        )

    area.name = name
    area.legality = legality
    area.safety = safety
    area.polygon_coordinate = polygon_coordinate
    area.coordinate = coordinate
    area.location = location
    area.description = description
    area.save()

    return JsonResponse({'message': 'Successfully updated'}, status=200)


# =========================
# DELETE REFORESTATION AREA
# =========================
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

# =========================
# GET ALL POTENTIAL SITES (NO PAGINATION)
# =========================
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
# CREATE POTENTIAL SITE
# =========================
@csrf_exempt
def create_potential_site(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)

    try:
        data = json.loads(request.body)
        reforestation_area_id = data['reforestation_area_id']
        polygon_coordinates = data['polygon_coordinates']
    except (KeyError, json.JSONDecodeError):
        return JsonResponse(
            {'error': 'Missing or invalid fields'},
            status=400
        )

    area = get_object_or_404(
        Reforestation_areas,
        reforestation_area_id=reforestation_area_id
    )

    Potential_sites.objects.create(
        reforestation_area=area,
        polygon_coordinates=polygon_coordinates
    )

    return JsonResponse({'message': 'Successfully added'}, status=201)


# =========================
# UPDATE POTENTIAL SITE
# =========================
@csrf_exempt
def update_potential_site(request, potential_sites_id):
    if request.method != 'PUT':
        return JsonResponse({'error': 'Only PUT allowed'}, status=405)

    try:
        data = json.loads(request.body)
        polygon_coordinates = data['polygon_coordinates']
    except (KeyError, json.JSONDecodeError):
        return JsonResponse(
            {'error': 'Missing or invalid fields'},
            status=400
        )

    site = get_object_or_404(
        Potential_sites,
        potential_sites_id=potential_sites_id
    )

    site.polygon_coordinates = polygon_coordinates
    site.save()

    return JsonResponse({'message': 'Successfully updated'}, status=200)


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