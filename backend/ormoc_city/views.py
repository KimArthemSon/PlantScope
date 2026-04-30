from django.shortcuts import render, get_object_or_404
from .models import Ormoc_City
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from security.views import log_activity
import json
import jwt
from django.http import JsonResponse


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
# Create your views here
@csrf_exempt
def get_ormoc(request):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    obj = get_object_or_404(Ormoc_City, ormoc_city_id = 1)
    data = {
        'marker': obj.marker,
        'polygon': obj.polygon,
    }

    return JsonResponse(data)

@csrf_exempt
def update_ormoc_city(request):

    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)
    try:
        data = json.loads(request.body)
        marker = data['marker']
        polygon = data['polygon']
    except Exception as e:
        return JsonResponse({'error': 'Something went wrong: ' + str(e)}, status=400)
  
    
    obj, created = Ormoc_City.objects.get_or_create(
        ormoc_city_id=1,
        defaults={
            'marker': marker,
            'polygon': polygon
        }
    )

    if not created:
        _old = {'marker': obj.marker, 'polygon': obj.polygon}
        obj.marker = marker
        obj.polygon = polygon
        obj.save()
        _new = {'marker': marker, 'polygon': polygon}
        _changed = [k for k in _old if _old[k] != _new[k]]

        record_activity(
            request,
            action_type='UPDATE',
            entity_type='OrmocCity',
            entity_id=1,
            entity_label='Ormoc City',
            description=f'Ormoc City map data updated. Fields changed: {", ".join(_changed) or "none"}.',
            old_data=_old,
            new_data=_new,
            changed_fields=_changed,
        )
    else:
        record_activity(
            request,
            action_type='CREATE',
            entity_type='OrmocCity',
            entity_id=1,
            entity_label='Ormoc City',
            description='Ormoc City map data created.',
            new_data={'marker': marker, 'polygon': polygon},
        )

    return JsonResponse({
        'message': 'Created' if created else 'Updated'
    })
