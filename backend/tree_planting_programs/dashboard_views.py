from django.db.models import Sum, Count, Q, F
from django.db.models.functions import Coalesce, TruncMonth
from datetime import timedelta
from django.utils import timezone
from sites.models import Sites, SiteMetaDataVerification
from accounts.models import User
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from .models import (
    Application, SeedlingRequest, SeedlingRequestSpecies, Reason
)
from accounts.helper import get_user_from_token



@csrf_exempt
def get_dashboard_data(request):
    """
    Comprehensive dashboard data endpoint for DataManager.
    Returns all data needed for the dashboard tabs.
    """
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    user = get_user_from_token(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    # ─── STATS ─────────────────────────────────────────────────────────
    total_applications = Application.objects.count()
    approved = Application.objects.filter(status='accepted').count()
    pending = Application.objects.filter(status__in=['for_evaluation', 'for_head']).count()
    rejected = Application.objects.filter(status__in=['rejected', 'failed', 'cancelled']).count()
    
    # ✅ NEW: Completed applications and sites
    completed_applications = Application.objects.filter(status='completed').count()
    completed_sites = Sites.objects.filter(status='completed').count()
    
    areas_assessed = SiteMetaDataVerification.objects.filter(status='verified').count()
    assessors_count = User.objects.filter(user_role='OnsiteInspector', is_active=True).count()
    
    # ✅ FIXED: Trees endorsed = total seedlings from accepted requests
    trees_endorsed = SeedlingRequestSpecies.objects.filter(
        seedling_request__status='accepted'
    ).aggregate(total=Coalesce(Sum('quantity'), 0))['total']
    
    # ✅ FIXED: Total seedlings planted = sum of all accepted seedling requests
    # Only count seedlings from ACCEPTED requests
    total_seedlings_planted = SeedlingRequestSpecies.objects.filter(
        seedling_request__status='accepted'
    ).aggregate(total=Coalesce(Sum('quantity'), 0))['total']
    
    # ✅ FIXED: Calculate total area planted (2m x 2m spacing = 4 sqm per tree)
    # 1 hectare = 10,000 sqm
    # Area in hectares = (total_seedlings * 4) / 10,000
    total_area_planted = (total_seedlings_planted * 4) / 10000
    
    # Active alerts = pending verifications + pending evaluations
    active_alerts = SiteMetaDataVerification.objects.filter(status='pending').count() + \
                    Application.objects.filter(status='for_evaluation').count()

    # ─── APPLICATION TREND (Last 7 months) ─────────────────────────────
    seven_months_ago = timezone.now() - timedelta(days=210)
    monthly_apps = Application.objects.filter(
        created_at__gte=seven_months_ago
    ).annotate(
        month=TruncMonth('created_at')
    ).values('month').annotate(
        submitted=Count('application_id'),
        approved=Count('application_id', filter=Q(status='accepted')),
        rejected=Count('application_id', filter=Q(status__in=['rejected', 'failed', 'cancelled']))
    ).order_by('month')

    application_trend = [
        {
            "month": entry['month'].strftime('%b'),
            "submitted": entry['submitted'],
            "approved": entry['approved'],
            "rejected": entry['rejected']
        } for entry in monthly_apps
    ]

    # ✅ FIXED: SEEDLINGS PLANTED TREND (Monthly) - Based on ACCEPTED requests
    monthly_seedling_requests = SeedlingRequest.objects.filter(
        created_at__gte=seven_months_ago,
        status='accepted'  # ✅ Only accepted requests
    ).annotate(
        month=TruncMonth('created_at')
    ).values('month').annotate(
        seedlings_provided=Sum('seedling_species__quantity')
    ).order_by('month')

    seedlings_planted_trend = []
    cumulative_seedlings = 0
    for entry in monthly_seedling_requests:
        seedlings = entry['seedlings_provided'] or 0
        cumulative_seedlings += seedlings
        area_hectares = (cumulative_seedlings * 4) / 10000
        
        seedlings_planted_trend.append({
            "month": entry['month'].strftime('%b'),
            "seedlings_planted": seedlings,
            "cumulative_seedlings": cumulative_seedlings,
            "cumulative_area_hectares": round(area_hectares, 2)
        })

    # ─── STATUS DATA (Pie Chart) ───────────────────────────────────────
    status_counts = Application.objects.values('status').annotate(count=Count('application_id'))
    
    status_map = {
        'accepted': ('Approved', '#10b981'),
        'for_evaluation': ('Pending', '#f59e0b'),
        'for_head': ('Pending', '#f59e0b'),
        'rejected': ('Rejected', '#ef4444'),
        'failed': ('Rejected', '#ef4444'),
        'cancelled': ('Rejected', '#ef4444'),
        'under_monitoring': ('On Review', '#6366f1'),
        'completed': ('Approved', '#10b981'),
    }
    
    status_aggregated = {}
    for item in status_counts:
        status = item['status']
        if status in status_map:
            name, color = status_map[status]
            if name not in status_aggregated:
                status_aggregated[name] = {'name': name, 'value': 0, 'fill': color}
            status_aggregated[name]['value'] += item['count']
    
    status_data = list(status_aggregated.values())

    # ─── ASSESSMENT DATA (By Barangay) ─────────────────────────────────
    barangay_stats = Sites.objects.filter(
        reforestation_area__barangay__isnull=False
    ).values(
        barangay_name=F('reforestation_area__barangay__name')
    ).annotate(
        assessed=Count('site_id'),
        approved=Count('site_id', filter=Q(status__in=['accepted', 'completed']))
    ).order_by('-assessed')[:6]

    assessment_data = [
        {
            "name": item['barangay_name'],
            "assessed": item['assessed'],
            "approved": item['approved']
        } for item in barangay_stats
    ]

    # ─── APPROVAL RATE TREND ───────────────────────────────────────────
    approval_rate = []
    for entry in monthly_apps:
        rate = round((entry['approved'] / entry['submitted'] * 100), 0) if entry['submitted'] > 0 else 0
        approval_rate.append({
            "month": entry['month'].strftime('%b'),
            "rate": int(rate)
        })

    # ─── RECENT ACTIVITIES (From Reason model) ─────────────────────────
    recent_reasons = Reason.objects.select_related('user__profile', 'application').order_by('-created')[:5]
    
    recent_activities = []
    for reason in recent_reasons:
        # Determine activity type
        if reason.status in ['accepted', 'completed']:
            act_type = 'success'
            action = 'Application approved' if reason.status == 'accepted' else 'Program completed'
        elif reason.status in ['rejected', 'failed', 'cancelled']:
            act_type = 'danger'
            action = 'Application rejected'
        elif reason.status == 'for_head':
            act_type = 'warning'
            action = 'Pending site verification'
        else:
            act_type = 'info'
            action = 'Documents submitted'
        
        officer_name = f"{reason.user.profile.first_name[0]}. {reason.user.profile.last_name}" if hasattr(reason.user, 'profile') else reason.user.email.split('@')[0]
        
        # Calculate time ago
        time_diff = timezone.now() - reason.created
        if time_diff.days > 0:
            time_str = f"{time_diff.days} days ago" if time_diff.days > 1 else "Yesterday"
        elif time_diff.seconds > 3600:
            time_str = f"{time_diff.seconds // 3600}h ago"
        else:
            time_str = f"{time_diff.seconds // 60}m ago"
        
        recent_activities.append({
            "id": reason.reason_id,
            "type": act_type,
            "ref": f"APP-{reason.application.application_id:04d}" if reason.application else "N/A",
            "action": action,
            "time": time_str,
            "officer": officer_name
        })

    # ─── RECENT APPS & ALL APPS ────────────────────────────────────────
    recent_apps_qs = Application.objects.select_related(
        'site__reforestation_area__barangay'
    ).order_by('-created_at')[:5]

    all_apps_qs = Application.objects.select_related(
        'site__reforestation_area__barangay'
    ).order_by('-created_at')[:20]

    def format_app(app):
        # Score = NDVI value * 100 (scaled to 0-100)
        score = int(app.site.ndvi_value * 100) if app.site and app.site.ndvi_value else 0
        score = min(score, 100)  # Cap at 100
        
        status_display = {
            'accepted': 'Approved',
            'for_evaluation': 'Pending',
            'for_head': 'On Review',
            'under_monitoring': 'On Review',
            'rejected': 'Rejected',
            'failed': 'Rejected',
            'cancelled': 'Rejected',
            'completed': 'Approved',
        }.get(app.status, 'Pending')
        
        return {
            "ref": f"APP-{app.application_id:04d}",
            "area": app.site.reforestation_area.barangay.name if app.site and app.site.reforestation_area and app.site.reforestation_area.barangay else "Unassigned",
            "hectares": f"{app.site.total_area_hectares:.1f} ha" if app.site and app.site.total_area_hectares else "N/A",
            "status": status_display,
            "score": score
        }

    recent_apps = [format_app(app) for app in recent_apps_qs]
    all_apps = [format_app(app) for app in all_apps_qs]

    # ─── ASSESSORS (OnsiteInspectors) ──────────────────────────────────
    inspectors = User.objects.filter(user_role='OnsiteInspector', is_active=True).select_related('profile')[:6]
    
    assessors = []
    for inspector in inspectors:
        # Count assessments done by this inspector (from SiteMetaDataVerification)
        assessments_done = SiteMetaDataVerification.objects.filter(verified_by=inspector).count()
        approved_count = SiteMetaDataVerification.objects.filter(
            verified_by=inspector, 
            status='verified'
        ).count()
        
        # Determine status (simplified - could be enhanced with last login)
        status = "Active"
        
        avatar = f"{inspector.profile.first_name[0]}{inspector.profile.last_name[0]}" if hasattr(inspector, 'profile') else inspector.email[:2].upper()
        
        assessors.append({
            "name": f"{inspector.profile.first_name[0]}. {inspector.profile.last_name}" if hasattr(inspector, 'profile') else inspector.email,
            "assessments": assessments_done,
            "approved": approved_count,
            "status": status,
            "avatar": avatar
        })

    # ─── BARANGAY BREAKDOWN ────────────────────────────────────────────
    barangay_breakdown_qs = Application.objects.filter(
        site__reforestation_area__barangay__isnull=False
    ).values(
        barangay_name=F('site__reforestation_area__barangay__name')
    ).annotate(
        apps=Count('application_id'),
        total_seedlings=Coalesce(Sum('site__total_seedlings_planted'), 0)
    ).order_by('-apps')[:6]

    barangay_breakdown = []
    for item in barangay_breakdown_qs:
        # Calculate approval rate for this barangay
        total_in_brgy = Application.objects.filter(
            site__reforestation_area__barangay__name=item['barangay_name']
        ).count()
        approved_in_brgy = Application.objects.filter(
            site__reforestation_area__barangay__name=item['barangay_name'],
            status__in=['accepted', 'completed']
        ).count()
        
        rate = round((approved_in_brgy / total_in_brgy * 100), 0) if total_in_brgy > 0 else 0
        
        barangay_breakdown.append({
            "name": item['barangay_name'],
            "apps": item['apps'],
            "trees": item['total_seedlings'],
            "rate": int(rate)
        })

    # ─── RESPONSE ──────────────────────────────────────────────────────
    return JsonResponse({
        "stats": {
            "total_applications": total_applications,
            "approved": approved,
            "pending": pending,
            "rejected": rejected,
            "completed_applications": completed_applications,
            "completed_sites": completed_sites,
            "total_seedlings_planted": total_seedlings_planted,
            "total_area_planted": round(total_area_planted, 2),
            "areas_assessed": areas_assessed,
            "assessors": assessors_count,
            "trees_endorsed": trees_endorsed,
            "active_alerts": active_alerts
        },
        "application_trend": application_trend,
        "seedlings_planted_trend": seedlings_planted_trend,
        "status_data": status_data,
        "assessment_data": assessment_data,
        "approval_rate": approval_rate,
        "recent_activities": recent_activities,
        "recent_apps": recent_apps,
        "all_apps": all_apps,
        "assessors": assessors,
        "barangay_breakdown": barangay_breakdown
    }, status=200)


@csrf_exempt
def get_pending_dm_application_count(request):
    """
    Returns count of applications pending DataManager's evaluation (for_evaluation status).
    """
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    
    user = get_user_from_token(request)
    if not user or user.user_role != 'DataManager':
        return JsonResponse({'error': 'Unauthorized'}, status=403)
    
    # Count applications waiting for DataManager's evaluation
    pending_count = Application.objects.filter(status='for_evaluation').count()
    
    return JsonResponse({
        'pending_count': pending_count,
        'timestamp': timezone.now().isoformat()
    }, status=200)


@csrf_exempt
def get_pending_request_count(request):
    """
    Returns count of seedling requests pending DataManager's review.
    """
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    
    user = get_user_from_token(request)
    if not user or user.user_role != 'DataManager':
        return JsonResponse({'error': 'Unauthorized'}, status=403)
    
    # Count pending seedling requests
    pending_count = SeedlingRequest.objects.filter(status='pending').count()
    
    return JsonResponse({
        'pending_count': pending_count,
        'timestamp': timezone.now().isoformat()
    }, status=200)