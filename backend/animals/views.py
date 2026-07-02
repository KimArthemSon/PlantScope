import json
import math
import jwt
import logging
from django.shortcuts import get_object_or_404
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.db import IntegrityError
from django.conf import settings
from security.views import log_activity
from .models import Animal


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
    
    # FIXED: Extract only the first IP from the comma-separated list
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


# =========================
# GET ANIMALS (PAGINATED LIST)
# =========================
@csrf_exempt
def get_animals(request):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    search = request.GET.get('search', '').strip()
    entries = int(request.GET.get('entries', 10))
    page = int(request.GET.get('page', 1))

    if entries <= 0: entries = 10
    if page <= 0: page = 1

    offset = (page - 1) * entries

    animals = Animal.objects.all().order_by('-created_at')
    if search:
        animals = animals.filter(name__icontains=search)

    total = animals.count()
    total_page = math.ceil(total / entries) if total > 0 else 0

    data = []
    for a in animals[offset: offset + entries]:
        data.append({
            "animal_id": a.animal_id,
            "name": a.name,
            "scientific_name": a.scientific_name,
            "description":a.description,
            "created_at": a.created_at.strftime("%Y-%m-%d") if a.created_at else None,
        })
    
 
    return JsonResponse({
        'data': data,
        'total_page': total_page,
        'page': page,
        'entries': entries,
        'total': total
    }, status=200)


# =========================
# GET SINGLE ANIMAL
# =========================
def get_animal(request, animal_id):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    animal = get_object_or_404(Animal, animal_id=animal_id)

    data = {
        'animal_id': animal.animal_id,
        'name': animal.name,
        'scientific_name': animal.scientific_name,
        'description': animal.description,
        'created_at': animal.created_at
    }

    return JsonResponse({'data': data}, status=200)


# =========================
# CREATE ANIMAL
# =========================
@csrf_exempt
def create_animal(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)

    try:
        data = json.loads(request.body)
        name = data['name'].strip()
        scientific_name = data.get('scientific_name', '').strip()
        description = data.get('description', '')
    except (KeyError, json.JSONDecodeError):
        return JsonResponse({'error': 'Missing or invalid fields'}, status=400)

    if Animal.objects.filter(name__iexact=name).exists():
        return JsonResponse({'error': 'Animal with this name already exists'}, status=409)

    try:
        animal = Animal.objects.create(
            name=name,
            scientific_name=scientific_name,
            description=description
        )
    except IntegrityError:
        return JsonResponse({'error': 'Animal with this name already exists'}, status=409)

    record_activity(
        request,
        action_type='CREATE',
        entity_type='Animal',
        entity_id=animal.animal_id,
        entity_label=name,
        description=f'Animal "{name}" created.',
        new_data={'name': name, 'scientific_name': scientific_name, 'description': description},
    )

    return JsonResponse({'message': 'Successfully added'}, status=201)


# =========================
# UPDATE ANIMAL
# =========================
@csrf_exempt
def update_animal(request, animal_id):
    if request.method != 'PUT':
        return JsonResponse({'error': 'Only PUT allowed'}, status=405)

    try:
        data = json.loads(request.body)
        name = data['name'].strip()
        scientific_name = data.get('scientific_name', '').strip()
        description = data.get('description', '')
    except (KeyError, json.JSONDecodeError):
        return JsonResponse({'error': 'Missing or invalid fields'}, status=400)

    animal = get_object_or_404(Animal, animal_id=animal_id)

    if Animal.objects.exclude(animal_id=animal_id).filter(name__iexact=name).exists():
        return JsonResponse({'error': 'Animal with this name already exists'}, status=409)

    _old = {
        'name': animal.name,
        'scientific_name': animal.scientific_name,
        'description': animal.description
    }

    animal.name = name
    animal.scientific_name = scientific_name
    animal.description = description
    animal.save()

    _new = {
        'name': name,
        'scientific_name': scientific_name,
        'description': description
    }
    _changed = [k for k in _old if _old[k] != _new[k]]

    record_activity(
        request,
        action_type='UPDATE',
        entity_type='Animal',
        entity_id=animal_id,
        entity_label=name,
        description=f'Animal "{name}" updated. Fields changed: {", ".join(_changed) or "none"}.',
        old_data=_old,
        new_data=_new,
        changed_fields=_changed,
    )

    return JsonResponse({'message': 'Successfully updated'}, status=200)


# =========================
# DELETE ANIMAL
# =========================
@csrf_exempt
def delete_animal(request, animal_id):
    if request.method != 'DELETE':
        return JsonResponse({'error': 'Only DELETE allowed'}, status=405)

    animal = get_object_or_404(Animal, animal_id=animal_id)
    deleted_name = animal.name

    record_activity(
        request,
        action_type='DELETE',
        entity_type='Animal',
        entity_id=animal_id,
        entity_label=deleted_name,
        description=f'Animal "{deleted_name}" deleted.',
        old_data={'name': deleted_name, 'scientific_name': animal.scientific_name, 'description': animal.description},
    )

    animal.delete()

    return JsonResponse({'message': 'Successfully deleted'}, status=200)


# =========================
# GET ANIMALS LIST (FLAT FOR MOBILE/ASSESSMENT)
# =========================
@csrf_exempt
def get_animals_list(request):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    try:
        animals = Animal.objects.all().order_by('name').values(
            'animal_id', 'name', 'scientific_name', 'description'
        )
        
        data = [
            {
                "animal_id": a['animal_id'],
                "name": a['name'],
                "scientific_name": a['scientific_name'] or "",
                "description": a['description'] or ""
            }
            for a in animals
        ]
        
        return JsonResponse(data, safe=False, status=200)
        
    except Exception as e:
        logging.error(f"Error fetching animals list: {str(e)}")
        return JsonResponse({'error': str(e)}, status=500)