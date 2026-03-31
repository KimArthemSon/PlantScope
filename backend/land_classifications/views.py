from django.shortcuts import get_object_or_404
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from .models import LandClassification, Classified_areas
from barangay.models import Barangay
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

    # Get parameters with defaults
    search = request.GET.get('search', '').strip()
    
    # Safe integer conversion
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

    # Queryset with sorting
    # Using '-created_at' for Descending (Newest first) to match get_classified_areas
    # Use 'created_at' without '-' for Ascending (Oldest first)
    classifications = LandClassification.objects.all().order_by('-created_at')

    # Apply search filter
    if search:
        classifications = classifications.filter(name__icontains=search)

    # Get total count before slicing
    total = classifications.count()
    total_page = math.ceil(total / entries) if total > 0 else 1

    # Slice and convert to list of dictionaries
    # .values() fetches all fields as dictionaries
    paginated_data = classifications[offset: offset + entries].values()

    return JsonResponse({
        'data': list(paginated_data),
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

