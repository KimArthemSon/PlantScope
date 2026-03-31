from django.shortcuts import get_object_or_404
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from .models import LandClassification, Classified_areas
from barangay.models import Barangay
from .models import Classified_areas
import json
import math

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
def get_classified_areas(request):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    # Get parameters with defaults
    search = request.GET.get('search', '').strip()
    
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

    classified_area.name = name
    classified_area.land_classification = classification
    classified_area.barangay = barangay  # ✅ Added
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


