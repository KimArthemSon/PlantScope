from django.shortcuts import get_object_or_404
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from .models import Barangay
import json
import math

# -------------------- Barangay List (Simple) --------------------

@csrf_exempt
def get_barangay_list(request):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    
    barangays = (
        Barangay.objects
        .order_by('created_at')
        .values('barangay_id', 'name', 'coordinate', 'description')
    )

    data = [
        {
            'barangay_id': b['barangay_id'],
            'name': b['name'],
            'description': b['description'],
            'coordinate': b['coordinate']
        }
        for b in barangays
    ]

    return JsonResponse({'data': data}, status=200)


# -------------------- Barangay List (Paginated) --------------------

@csrf_exempt
def get_barangays(request):
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

    barangays = Barangay.objects.all().order_by('-created_at')

    if search:
        barangays = barangays.filter(name__icontains=search)

    total = barangays.count()
    total_page = math.ceil(total / entries) if total > 0 else 0

    data = []
    for b in barangays[offset: offset + entries]:
        data.append({
            'barangay_id': b.barangay_id,
            'name': b.name,
            'description': b.description,
            'coordinate': b.coordinate,
            'created_at': b.created_at
        })

    return JsonResponse({
        'data': data,
        'total_page': total_page,
        'page': page,
        'entries': entries,
        'total': total
    }, status=200)


# -------------------- Get Single Barangay --------------------

def get_barangay(request, barangay_id):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    barangay = get_object_or_404(Barangay, barangay_id=barangay_id)

    data = {
        'barangay_id': barangay.barangay_id,
        'name': barangay.name,
        'description': barangay.description,
        'coordinate': barangay.coordinate,
        'created_at': barangay.created_at
    }

    return JsonResponse({'data': data}, status=200)


# -------------------- Create Barangay --------------------

@csrf_exempt
def create_barangay(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)

    try:
        data = json.loads(request.body)
        name = data['name']
        description = data['description']
        coordinate = data['coordinate']
    except (KeyError, json.JSONDecodeError):
        return JsonResponse({'error': 'Invalid or missing fields'}, status=400)

    barangay = Barangay.objects.create(
        name=name,
        description=description,
        coordinate=coordinate
    )

    return JsonResponse({'data': barangay.barangay_id}, status=200)


# -------------------- Update Barangay --------------------

@csrf_exempt
def update_barangay(request, barangay_id):
    if request.method != 'PUT':
        return JsonResponse({'error': 'Only PUT allowed'}, status=405)

    try:
        data = json.loads(request.body)
        name = data['name']
        description = data['description']
        coordinate = data['coordinate']
    except (KeyError, json.JSONDecodeError):
        return JsonResponse({'error': 'Invalid or missing fields'}, status=400)

    barangay = get_object_or_404(Barangay, barangay_id=barangay_id)

    barangay.name = name
    barangay.description = description
    barangay.coordinate = coordinate
    barangay.save()

    return JsonResponse({'message': 'Successfully updated!'}, status=200)


# -------------------- Delete Barangay --------------------

@csrf_exempt
def delete_barangay(request, barangay_id):
    if request.method != 'DELETE':
        return JsonResponse({'error': 'Only DELETE allowed'}, status=405)

    barangay = get_object_or_404(Barangay, barangay_id=barangay_id)
    barangay.delete()

    return JsonResponse({'message': 'Successfully deleted!'}, status=200)