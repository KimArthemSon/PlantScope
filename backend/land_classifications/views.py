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
from django.db import IntegrityError

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
    
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0].strip()
    else:
        ip = request.META.get('REMOTE_ADDR')
    
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
    
    # ✅ UPDATED: Filter by ownership_type instead of for_reforestation
    ownership_type = request.GET.get('ownership_type', '').strip().lower()
    
    classifications = LandClassification.objects.all().order_by('created_at')
    
    # If 'public' or 'private' is specified, filter. Otherwise, return ALL.
    if ownership_type in ['public', 'private']:
        classifications = classifications.filter(ownership_type=ownership_type)
    
    data = [
        {
            'land_classification_id': c['land_classification_id'], 
            'name': c['name'],
            'ownership_type': c['ownership_type']
        }
        for c in classifications.values('land_classification_id', 'name', 'ownership_type')
    ]

    return JsonResponse({'data': data}, status=200)


@csrf_exempt
def get_land_classifications(request):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    search = request.GET.get('search', '').strip()
    # ✅ UPDATED: Filter by ownership_type (supports 'public', 'private', or 'all'/omitted)
    ownership_type = request.GET.get('ownership_type', '').strip().lower()
    
    try:
        entries = int(request.GET.get('entries', 10))
        page = int(request.GET.get('page', 1))
    except ValueError:
        entries = 10
        page = 1

    if entries <= 0:
        entries = 10
    if page <= 0:
        page = 1

    offset = (page - 1) * entries

    classifications = LandClassification.objects.all().order_by('-created_at')

    if search:
        classifications = classifications.filter(name__icontains=search)
    
    # ✅ UPDATED: Apply ownership_type filter if valid
    if ownership_type in ['public', 'private']:
        classifications = classifications.filter(ownership_type=ownership_type)
        
    total = classifications.count()
    total_page = math.ceil(total / entries) if total > 0 else 1

    data = []
    for lc in classifications[offset: offset + entries]:
        data.append({
            "land_classification_id": lc.land_classification_id,
            "name": lc.name,
            "description": lc.description,
            "ownership_type": lc.ownership_type,  # ✅ UPDATED
            "created_at": lc.created_at.strftime("%Y-%m-%d") if lc.created_at else None,
        })

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
        'ownership_type': classification.ownership_type,  # ✅ UPDATED
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
        # ✅ UPDATED: Expect ownership_type instead of for_reforestation
        ownership_type = data.get('ownership_type', 'private') 
        description = data.get('description', '')
    except KeyError:
        return JsonResponse({'error': 'Missing required fields (name)'}, status=400)

    try:
        classification = LandClassification.objects.create(
            name=name, 
            description=description, 
            ownership_type=ownership_type  # ✅ UPDATED
        )
    except IntegrityError:
        return JsonResponse({
            'error': f'A land classification with the name "{name}" already exists.'
        }, status=400)

    record_activity(
        request,
        action_type='CREATE',
        entity_type='LandClassification',
        entity_id=classification.land_classification_id,
        entity_label=name,
        description=f'Land classification "{name}" created.',
        new_data={'name': name, 'description': description, 'ownership_type': ownership_type},  # ✅ UPDATED
    )

    return JsonResponse({'data': classification.land_classification_id}, status=200)


@csrf_exempt
def update_land_classification(request, classification_id):
    if request.method != 'PUT':
        return JsonResponse({'error': 'Only PUT allowed'}, status=405)
    try:
        data = json.loads(request.body)
        name = data['name']
        # ✅ UPDATED: Expect ownership_type instead of for_reforestation
        ownership_type = data.get('ownership_type', 'private')
        description = data.get('description', '')
    except KeyError:
        return JsonResponse({'error': 'Missing required fields (name)'}, status=400)

    classification = get_object_or_404(LandClassification, pk=classification_id)

    _old = {
        'name': classification.name,
        'description': classification.description,
        'ownership_type': classification.ownership_type,  # ✅ UPDATED
    }

    classification.name = name
    classification.description = description
    classification.ownership_type = ownership_type  # ✅ UPDATED
    
    try:
        classification.save()
    except IntegrityError:
        return JsonResponse({
            'error': f'A land classification with the name "{name}" already exists.'
        }, status=400)

    _new = {'name': name, 'description': description, 'ownership_type': ownership_type}  # ✅ UPDATED
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

    for related in LandClassification._meta.related_objects:
        accessor = related.get_accessor_name()
        related_manager = getattr(classification, accessor)
        
        if related_manager.exists():
            related_model_name = related.related_model._meta.verbose_name_plural.title()
            return JsonResponse({
                'error': f'Cannot delete "{deleted_name}". It is currently linked to {related_model_name}.'
            }, status=400)

    record_activity(
        request,
        action_type='DELETE',
        entity_type='LandClassification',
        entity_id=classification_id,
        entity_label=deleted_name,
        description=f'Land classification "{deleted_name}" deleted.',
        old_data={
            'name': deleted_name, 
            'description': classification.description, 
            'ownership_type': classification.ownership_type  # ✅ UPDATED
        },
    )

    classification.delete()
    return JsonResponse({'message': 'Successfully deleted!'}, status=200)

