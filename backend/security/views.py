from django.http import JsonResponse
from django.utils import timezone
from datetime import timedelta
from security.models import SecurityLog
from django.shortcuts import get_object_or_404
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

    
@csrf_exempt
def get_recent_logs(request):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    
    limit = int(request.GET.get('limit', 100))  # allow optional ?limit=50
    logs = SecurityLog.objects.all()[:limit]

    data = []
    for log in logs:
        data.append({
            'id': log.id,
            'user_id': log.user.id if log.user else None,
            'email': log.email,
            'event_type': log.event_type,
            'ip_address': log.ip_address,
            'user_agent': log.user_agent,
            'timestamp': log.timestamp,
            'user_role': log.user.user_role if log.user else None  # ← ADDED
        })

    return JsonResponse(data, safe=False)