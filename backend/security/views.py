from django.http import JsonResponse
from django.utils import timezone
from datetime import timedelta
from security.models import SecurityLog, ActivityLog
from django.views.decorators.csrf import csrf_exempt

RECOVER_LOCK_TIME_MINUTES = 2
ATTEMPT_LIMIT = 5


def is_lock(ip_address):
    time_threshold = timezone.now() - timedelta(minutes=RECOVER_LOCK_TIME_MINUTES)
    failed_count = SecurityLog.objects.filter(
        ip_address=ip_address,
        event_type=SecurityLog.LOGIN_FAILED,
        timestamp__gte=time_threshold
    ).count()
    return failed_count >= ATTEMPT_LIMIT


def log_event(user, email, event_type, ip_address=None, user_agent=None):
    SecurityLog.objects.create(
        user=user,
        email=email,
        event_type=event_type,
        ip_address=ip_address,
        user_agent=user_agent
    )


def log_activity(performed_by, email, action_type, entity_type='', entity_id=None,
                 entity_label='', description='', old_data=None, new_data=None,
                 changed_fields=None, ip_address=None):
    ActivityLog.objects.create(
        performed_by=performed_by,
        performed_by_email=email,
        action_type=action_type,
        entity_type=entity_type,
        entity_id=entity_id,
        entity_label=entity_label,
        description=description,
        old_data=old_data,
        new_data=new_data,
        changed_fields=changed_fields,
        ip_address=ip_address,
    )


@csrf_exempt
def get_recent_logs(request):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    try:
        page = int(request.GET.get('page', 1))
        page_size = min(int(request.GET.get('page_size', 20)), 100)
    except ValueError:
        return JsonResponse({'error': 'Invalid pagination params'}, status=400)

    logs = SecurityLog.objects.all()

    date_from  = request.GET.get('date_from')
    date_to    = request.GET.get('date_to')
    event_type = request.GET.get('event_type')

    if date_from:  logs = logs.filter(timestamp__date__gte=date_from)
    if date_to:    logs = logs.filter(timestamp__date__lte=date_to)
    if event_type: logs = logs.filter(event_type=event_type)

    total  = logs.count()
    offset = (page - 1) * page_size
    logs   = logs[offset: offset + page_size]

    data = [
        {
            'id':         log.id,
            'user_id':    log.user.id if log.user else None,
            'email':      log.email,
            'event_type': log.event_type,
            'ip_address': log.ip_address,
            'user_agent': log.user_agent,
            'timestamp':  log.timestamp,
            'user_role':  log.user.user_role if log.user else None,
        }
        for log in logs
    ]

    return JsonResponse({
        'total':       total,
        'page':        page,
        'page_size':   page_size,
        'total_pages': (total + page_size - 1) // page_size,
        'results':     data,
    })


@csrf_exempt
def get_activity_log(request):
    """
    Returns ActivityLog entries.
    Supports filtering by performed_by_id, date range, action_type, entity_type, entity_id.
    Used by both the Operational History tab (no user filter) and the
    Account Activity modal (performed_by_id filter).
    """
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    try:
        page      = int(request.GET.get('page', 1))
        page_size = min(int(request.GET.get('page_size', 20)), 100)
    except ValueError:
        return JsonResponse({'error': 'Invalid pagination params'}, status=400)

    qs = ActivityLog.objects.all()

    performed_by_id = request.GET.get('performed_by_id')
    date_from       = request.GET.get('date_from')
    date_to         = request.GET.get('date_to')
    action_type     = request.GET.get('action_type')
    entity_type     = request.GET.get('entity_type')
    entity_id       = request.GET.get('entity_id')

    if performed_by_id: qs = qs.filter(performed_by_id=performed_by_id)
    if date_from:       qs = qs.filter(timestamp__date__gte=date_from)
    if date_to:         qs = qs.filter(timestamp__date__lte=date_to)
    if action_type:     qs = qs.filter(action_type=action_type)
    if entity_type:     qs = qs.filter(entity_type=entity_type)
    if entity_id:       qs = qs.filter(entity_id=entity_id)

    total  = qs.count()
    offset = (page - 1) * page_size
    qs     = qs[offset: offset + page_size]

    data = [
        {
            'id':               entry.id,
            'performed_by_id':  entry.performed_by.id if entry.performed_by else None,
            'performed_by_email': entry.performed_by_email,
            'performed_by_role':  entry.performed_by.user_role if entry.performed_by else None,
            'action_type':      entry.action_type,
            'entity_type':      entry.entity_type,
            'entity_id':        entry.entity_id,
            'entity_label':     entry.entity_label,
            'description':      entry.description,
            'old_data':         entry.old_data,
            'new_data':         entry.new_data,
            'changed_fields':   entry.changed_fields,
            'ip_address':       entry.ip_address,
            'timestamp':        entry.timestamp,
        }
        for entry in qs
    ]

    return JsonResponse({
        'total':       total,
        'page':        page,
        'page_size':   page_size,
        'total_pages': (total + page_size - 1) // page_size,
        'results':     data,
    })
