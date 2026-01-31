from django.shortcuts import get_object_or_404
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from .models import LandClassification, Classified_areas
import json
import math

# -------------------- LandClassification Views --------------------

@csrf_exempt
def get_land_classifications_list(request):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    classifications = (
    LandClassification.objects
    .order_by('created_at')
    .values('land_classification_id', 'name')  # only these fields
    )

    
    data = [
         {'land_classification_id': c['land_classification_id'], 'name': c['name']}
         for c in classifications
    ]

    return JsonResponse({'data': data}, status=200)


@csrf_exempt
def get_land_classifications(request):
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

    classifications = LandClassification.objects.all().order_by('created_at')
    if search:
        classifications = classifications.filter(name__icontains=search)

    total = classifications.count()
    total_page = math.ceil(total / entries) if total > 0 else 0

    data = list(classifications[offset : offset + entries].values())

    return JsonResponse({
        'data': data,
        'total_page': total_page,
        'page': page,
        'entries': entries,
        'total': total
    }, status=200)


def get_land_classification(request, classification_id):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    classification = get_object_or_404(LandClassification, pk=classification_id)
    data = {
        'land_classification_id': classification.land_classification_id,
        'name': classification.name,
        'description': classification.description,
        'created_at': classification.created_at
    }
    return JsonResponse({'data': data}, status=200)


@csrf_exempt
def create_land_classification(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)
    try:
        data = json.loads(request.body)
        name = data['name']
        description = data['description']
    except KeyError:
        return JsonResponse({'error': 'Missing fields'}, status=400)

    classification = LandClassification.objects.create(name=name, description=description)
    return JsonResponse({'data': classification.land_classification_id}, status=200)


@csrf_exempt
def update_land_classification(request, classification_id):
    if request.method != 'PUT':
        return JsonResponse({'error': 'Only PUT allowed'}, status=405)
    try:
        data = json.loads(request.body)
        name = data['name']
        description = data['description']
    except KeyError:
        return JsonResponse({'error': 'Missing fields'}, status=400)

    classification = get_object_or_404(LandClassification, pk=classification_id)
    classification.name = name
    classification.description = description
    classification.save()
    return JsonResponse({'message': 'Successfully updated!'}, status=200)


@csrf_exempt
def delete_land_classification(request, classification_id):
    if request.method != 'DELETE':
        return JsonResponse({'error': 'Only DELETE allowed'}, status=405)

    classification = get_object_or_404(LandClassification, pk=classification_id)
    classification.delete()
    return JsonResponse({'message': 'Successfully deleted!'}, status=200)

# -------------------- Classified_area Views --------------------

@csrf_exempt
def get_classified_areas(request):
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

    classified_areas = (
        Classified_areas.objects
        .select_related('land_classification')
        .all()
        .order_by('-created_at')
    )

    if search:
        classified_areas = classified_areas.filter(name__icontains=search)

    total = classified_areas.count()
    total_page = math.ceil(total / entries) if total > 0 else 0

    data = []
    for area in classified_areas[offset: offset + entries]:
        data.append({
            'classified_area_id': area.classified_area_id,
            'name': area.name,
            'land_classification_id': area.land_classification.land_classification_id,
            'land_classification_name': area.land_classification.name,
            'polygon': area.polygon,
            'description': area.description,
            'created_at': area.created_at
        })

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
        .select_related('land_classification')
        .get(classified_area_id=classified_area_id)
    )

    data = {
        'classified_area_id': classified_area.classified_area_id,
        'name': classified_area.name,
        'land_classification_id': classified_area.land_classification.land_classification_id,
        'land_classification_name': classified_area.land_classification.name,
        'polygon': classified_area.polygon,
        'description': classified_area.description,
        'created_at': classified_area.created_at
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
        polygon = data['polygon']
        description = data['description']
    except KeyError:
        return JsonResponse({'error': 'Missing fields'}, status=400)

    classification = get_object_or_404(
        LandClassification,
        land_classification_id=land_classification_id
    )

    classified_area = Classified_areas.objects.create(
        name=name,
        land_classification=classification,
        polygon=polygon,
        description=description
    )

    return JsonResponse(
        {'data': classified_area.classified_area_id},
        status=200
    )

@csrf_exempt
def update_classified_area(request, classified_area_id):
    if request.method != 'PUT':
        return JsonResponse({'error': 'Only PUT allowed'}, status=405)

    try:
        data = json.loads(request.body)
        name = data['name']
        land_classification_id = data['land_classification_id']
        polygon = data['polygon']
        description = data['description']
    except KeyError:
        return JsonResponse({'error': 'Missing fields'}, status=400)

    classified_area = get_object_or_404(
        Classified_areas,
        classified_area_id=classified_area_id
    )

    classification = get_object_or_404(
        LandClassification,
        land_classification_id=land_classification_id
    )

    classified_area.name = name
    classified_area.land_classification = classification
    classified_area.polygon = polygon
    classified_area.description = description
    classified_area.save()

    return JsonResponse({'message': 'Successfully updated!'}, status=200)


@csrf_exempt
def delete_classified_area(request, classified_area_id):
    if request.method != 'DELETE':
        return JsonResponse({'error': 'Only DELETE allowed'}, status=405)

    classified_area = get_object_or_404(
        Classified_areas,
        classified_area_id=classified_area_id
    )

    classified_area.delete()

    return JsonResponse({'message': 'Successfully deleted!'}, status=200)