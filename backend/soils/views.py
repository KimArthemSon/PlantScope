import json
import math
from django.shortcuts import get_object_or_404
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.db import IntegrityError
from .models import Soils


# =========================
# GET SOILS (LIST + SEARCH)
# =========================
@csrf_exempt
def get_soils(request):
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

    soils = Soils.objects.all().order_by('-created_at')

    if search:
        soils = soils.filter(name__icontains=search)

    total = soils.count()
    total_page = math.ceil(total / entries) if total > 0 else 0

    data = list(
        soils[offset: offset + entries].values()
    )

    return JsonResponse({
        'data': data,
        'total_page': total_page,
        'page': page,
        'entries': entries,
        'total': total
    }, status=200)


# =========================
# GET SINGLE SOIL
# =========================
def get_soil(request, soil_id):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    soil = get_object_or_404(Soils, soil_id=soil_id)

    data = {
        'soil_id': soil.soil_id,
        'name': soil.name,
        'description': soil.description,
        'created_at': soil.created_at
    }

    return JsonResponse({'data': data}, status=200)


# =========================
# CREATE SOIL
# =========================
@csrf_exempt
def create_soil(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)

    try:
        data = json.loads(request.body)
        name = data['name'].strip()
        description = data['description']
    except (KeyError, json.JSONDecodeError):
        return JsonResponse(
            {'error': 'Missing or invalid fields'},
            status=400
        )

    # Case-insensitive duplicate check
    if Soils.objects.filter(name__iexact=name).exists():
        return JsonResponse(
            {'error': 'Soil with this name already exists'},
            status=409
        )

    try:
        Soils.objects.create(
            name=name,
            description=description
        )
    except IntegrityError:
        return JsonResponse(
            {'error': 'Soil with this name already exists'},
            status=409
        )

    return JsonResponse(
        {'message': 'Successfully added'},
        status=201
    )


# =========================
# UPDATE SOIL
# =========================
@csrf_exempt
def update_soil(request, soil_id):
    if request.method != 'PUT':
        return JsonResponse({'error': 'Only PUT allowed'}, status=405)

    try:
        data = json.loads(request.body)
        name = data['name'].strip()
        description = data['description']
    except (KeyError, json.JSONDecodeError):
        return JsonResponse(
            {'error': 'Missing or invalid fields'},
            status=400
        )

    soil = get_object_or_404(Soils, soil_id=soil_id)

    # Prevent duplicate name on update
    if Soils.objects.exclude(soil_id=soil_id).filter(name__iexact=name).exists():
        return JsonResponse(
            {'error': 'Soil with this name already exists'},
            status=409
        )

    soil.name = name
    soil.description = description
    soil.save()

    return JsonResponse(
        {'message': 'Successfully updated'},
        status=200
    )


# =========================
# DELETE SOIL
# =========================
@csrf_exempt
def delete_soil(request, soil_id):
    if request.method != 'DELETE':
        return JsonResponse({'error': 'Only DELETE allowed'}, status=405)

    soil = get_object_or_404(Soils, soil_id=soil_id)
    soil.delete()

    return JsonResponse(
        {'message': 'Successfully deleted'},
        status=200
    )
