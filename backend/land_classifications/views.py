from django.shortcuts import get_object_or_404
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from .models import LandClassification, Classified_areas
from barangay.models import Barangay
from django.conf import settings
from security.views import log_activity
import json
import math
import jwt


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
    ip = request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR'))
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

# -------------------- LandClassification Views --------------------

@csrf_exempt
def get_land_classifications_list(request):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    if request.GET.get('for_reforestation', '').strip().lower() == 'true':
        classifications = (
            LandClassification.objects
            .filter(for_reforestation=True)
            .order_by('created_at')
            .values('land_classification_id', 'name')  # only these fields
        )
    else:
        classifications = (
            LandClassification.objects
            .filter(for_reforestation=False)
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
    for_reforestation = request.GET.get('for_reforestation', '').strip().lower()
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
    # Apply for_reforestation filter    if for_reforestation in ['true', 'false']:
    if for_reforestation in ['true', 'false']:
        classifications = classifications.filter(for_reforestation=(for_reforestation == 'true'))
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
        'for_reforestation': classification.for_reforestation,
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
        for_reforestation = data.get('for_reforestation', False)  # default to False if not provided
        description = data['description']
    except KeyError:
        return JsonResponse({'error': 'Missing fields'}, status=400)

    classification = LandClassification.objects.create(name=name, description=description, for_reforestation=for_reforestation)

    record_activity(
        request,
        action_type='CREATE',
        entity_type='LandClassification',
        entity_id=classification.land_classification_id,
        entity_label=name,
        description=f'Land classification "{name}" created.',
        new_data={'name': name, 'description': description, 'for_reforestation': for_reforestation},
    )

    return JsonResponse({'data': classification.land_classification_id}, status=200)


@csrf_exempt
def update_land_classification(request, classification_id):
    if request.method != 'PUT':
        return JsonResponse({'error': 'Only PUT allowed'}, status=405)
    try:
        data = json.loads(request.body)
        name = data['name']
        for_reforestation = data.get('for_reforestation', False)  # default to False if not provided
        description = data['description']
    except KeyError:
        return JsonResponse({'error': 'Missing fields'}, status=400)

    classification = get_object_or_404(LandClassification, pk=classification_id)

    _old = {
        'name': classification.name,
        'description': classification.description,
        'for_reforestation': classification.for_reforestation,
    }

    classification.name = name
    classification.description = description
    classification.for_reforestation = for_reforestation
    classification.save()

    _new = {'name': name, 'description': description, 'for_reforestation': for_reforestation}
    _changed = [k for k in _old if _old[k] != _new[k]]

    record_activity(
        request,
        action_type='UPDATE',
        entity_type='LandClassification',
        entity_id=classification_id,
        entity_label=name,
        description=f'Land classification "{name}" updated. Fields changed: {", ".join(_changed) or "none"}.',
        old_data=_old,
        new_data=_new,
        changed_fields=_changed,
    )

    return JsonResponse({'message': 'Successfully updated!'}, status=200)


@csrf_exempt
def delete_land_classification(request, classification_id):
    if request.method != 'DELETE':
        return JsonResponse({'error': 'Only DELETE allowed'}, status=405)

    classification = get_object_or_404(LandClassification, pk=classification_id)
    deleted_name = classification.name

    record_activity(
        request,
        action_type='DELETE',
        entity_type='LandClassification',
        entity_id=classification_id,
        entity_label=deleted_name,
        description=f'Land classification "{deleted_name}" deleted.',
        old_data={'name': deleted_name, 'description': classification.description, 'for_reforestation': classification.for_reforestation},
    )

    classification.delete()
    return JsonResponse({'message': 'Successfully deleted!'}, status=200)

# -------------------- Classified_area Views --------------------

