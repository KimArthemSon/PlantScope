from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.db.models import Q, Count, Case, When, BooleanField
from django.utils import timezone
from datetime import timedelta
import json

from .models import Notification, User
from .helper import get_user_from_token


@csrf_exempt
def get_notifications(request):
    """
    Fetch notifications for the current user with advanced filtering.
    Supports: unread_only, type filter, pagination
    """
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    user = get_user_from_token(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    # Pagination
    try:
        page = max(int(request.GET.get('page', 1)), 1)
        entries = min(max(int(request.GET.get('entries', 20)), 10), 100)
    except (ValueError, TypeError):
        page, entries = 1, 20

    # Filters
    unread_only = request.GET.get('unread_only', 'false').lower() == 'true'
    read_only = request.GET.get('read_only', 'false').lower() == 'true'
    type_filter = request.GET.get('type', '').strip()  # alert, success, warning, info

    # Build query
    query = (
        Q(user=user) | 
        Q(user__isnull=True, target_role=user.user_role) | 
        Q(user__isnull=True, target_role__isnull=True)
    )
    
    if unread_only:
        query &= Q(is_read=False)
    elif read_only:
        query &= Q(is_read=True)
    
    if type_filter and type_filter in ['alert', 'success', 'warning', 'info']:
        query &= Q(type=type_filter)

    notifications = Notification.objects.filter(query).order_by('-created_at')
    total = notifications.count()
    total_page = max((total + entries - 1) // entries, 1)
    offset = (page - 1) * entries

    data = [{
        "notification_id": n.notification_id,
        "type": n.type,
        "title": n.title,
        "description": n.description or "",
        "link": n.link,
        "is_read": n.is_read,
        "is_general": n.user is None,
        "target_role": n.target_role,
        "created_at": n.created_at.isoformat(),
    } for n in notifications[offset:offset + entries]]

    # Unread count
    unread_count = Notification.objects.filter(
        Q(user=user) | Q(user__isnull=True, target_role=user.user_role) | Q(user__isnull=True, target_role__isnull=True),
        is_read=False
    ).count()

    # Type counts for filter badges
    base_query = (
        Q(user=user) | 
        Q(user__isnull=True, target_role=user.user_role) | 
        Q(user__isnull=True, target_role__isnull=True)
    )
    type_counts = {
        'all': Notification.objects.filter(base_query).count(),
        'alert': Notification.objects.filter(base_query, type='alert').count(),
        'success': Notification.objects.filter(base_query, type='success').count(),
        'warning': Notification.objects.filter(base_query, type='warning').count(),
        'info': Notification.objects.filter(base_query, type='info').count(),
    }

    return JsonResponse({
        'data': data,
        'total': total,
        'total_page': total_page,
        'page': page,
        'entries': entries,
        'unread_count': unread_count,
        'type_counts': type_counts,
    }, status=200)

@csrf_exempt
def get_unread_notification_count(request):
    """Lightweight endpoint for polling - returns just the unread count."""
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    user = get_user_from_token(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    query = Q(user=user) | Q(user__isnull=True, target_role=user.user_role) | Q(user__isnull=True, target_role__isnull=True)
    unread_count = Notification.objects.filter(query, is_read=False).count()

    return JsonResponse({
        'unread_count': unread_count,
        'timestamp': timezone.now().isoformat(),
    }, status=200)


@csrf_exempt
def mark_notification_read(request, notification_id):
    """Mark a single notification as read."""
    if request.method != 'PUT':
        return JsonResponse({'error': 'Only PUT allowed'}, status=405)

    user = get_user_from_token(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    # Can only mark own notifications or general ones
    query = Q(notification_id=notification_id) & (
        Q(user=user) | Q(user__isnull=True)
    )
    notification = Notification.objects.filter(query).first()
    
    if not notification:
        return JsonResponse({'error': 'Notification not found'}, status=404)

    notification.is_read = True
    notification.save()

    return JsonResponse({
        'message': 'Notification marked as read',
        'notification_id': notification.notification_id,
    }, status=200)


@csrf_exempt
def mark_all_notifications_read(request):
    """Mark all notifications as read for the current user."""
    if request.method != 'PUT':
        return JsonResponse({'error': 'Only PUT allowed'}, status=405)

    user = get_user_from_token(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    query = Q(user=user) | Q(user__isnull=True, target_role=user.user_role) | Q(user__isnull=True, target_role__isnull=True)
    updated = Notification.objects.filter(query, is_read=False).update(is_read=True)

    return JsonResponse({
        'message': f'Marked {updated} notifications as read',
        'updated_count': updated,
    }, status=200)


@csrf_exempt
def delete_notification(request, notification_id):
    """Dismiss/delete a notification."""
    if request.method != 'DELETE':
        return JsonResponse({'error': 'Only DELETE allowed'}, status=405)

    user = get_user_from_token(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    # Can only delete own notifications or general ones
    query = Q(notification_id=notification_id) & (
        Q(user=user) | Q(user__isnull=True)
    )
    notification = Notification.objects.filter(query).first()
    
    if not notification:
        return JsonResponse({'error': 'Notification not found'}, status=404)

    notification.delete()

    return JsonResponse({
        'message': 'Notification deleted',
        'notification_id': notification_id,
    }, status=200)