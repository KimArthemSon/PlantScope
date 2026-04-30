from django.shortcuts import get_object_or_404
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from .models import Barangay
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

    record_activity(
        request,
        action_type='CREATE',
        entity_type='Barangay',
        entity_id=barangay.barangay_id,
        entity_label=name,
        description=f'Barangay "{name}" created.',
        new_data={'name': name, 'description': description, 'coordinate': coordinate},
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

    _old = {
        'name': barangay.name,
        'description': barangay.description,
        'coordinate': barangay.coordinate,
    }

    barangay.name = name
    barangay.description = description
    barangay.coordinate = coordinate
    barangay.save()

    _new = {'name': name, 'description': description, 'coordinate': coordinate}
    _changed = [k for k in _old if _old[k] != _new[k]]

    record_activity(
        request,
        action_type='UPDATE',
        entity_type='Barangay',
        entity_id=barangay_id,
        entity_label=name,
        description=f'Barangay "{name}" updated. Fields changed: {", ".join(_changed) or "none"}.',
        old_data=_old,
        new_data=_new,
        changed_fields=_changed,
    )

    return JsonResponse({'message': 'Successfully updated!'}, status=200)


# -------------------- Delete Barangay --------------------

@csrf_exempt
def delete_barangay(request, barangay_id):
    if request.method != 'DELETE':
        return JsonResponse({'error': 'Only DELETE allowed'}, status=405)

    barangay = get_object_or_404(Barangay, barangay_id=barangay_id)
    deleted_name = barangay.name

    record_activity(
        request,
        action_type='DELETE',
        entity_type='Barangay',
        entity_id=barangay_id,
        entity_label=deleted_name,
        description=f'Barangay "{deleted_name}" deleted.',
        old_data={'name': deleted_name, 'description': barangay.description, 'coordinate': barangay.coordinate},
    )

    barangay.delete()

    return JsonResponse({'message': 'Successfully deleted!'}, status=200)