from django.db.models import Sum, Count, Q, F, Avg, Value
from django.db.models.functions import Coalesce, TruncMonth, Round
from datetime import timedelta
from django.utils import timezone
from sites.models import Sites, SiteMetaDataVerification, PermitDocument
from accounts.models import User
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from .models import (
    Application, SeedlingRequest, SeedlingRequestSpecies,
    Reason, ProgressReport, ProgressReportSpecies
)
from accounts.helper import get_user_from_token


# ─────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────
def _time_ago(dt):
    """Format datetime to human-readable relative time"""
    if not dt:
        return "—"
    diff = timezone.now() - dt
    if diff.days > 30:
        return dt.strftime("%b %d, %Y")
    if diff.days > 0:
        return f"{diff.days}d ago" if diff.days > 1 else "Yesterday"
    if diff.seconds > 3600:
        return f"{diff.seconds // 3600}h ago"
    if diff.seconds > 60:
        return f"{diff.seconds // 60}m ago"
    return "Just now"


def _officer_name(user):
    """Safely extract officer display name"""
    if hasattr(user, 'profile') and user.profile:
        return f"{user.profile.first_name[0]}. {user.profile.last_name}"
    return user.email.split('@')[0]


def _status_display(status):
    """Application status → display label"""
    return {
        'accepted': 'Approved',
        'for_evaluation': 'Pending',
        'for_head': 'On Review',
        'under_monitoring': 'Monitoring',
        'rejected': 'Rejected',
        'failed': 'Rejected',
        'cancelled': 'Cancelled',
        'completed': 'Completed',
    }.get(status, 'Pending')


def _format_app(app):
    """Format a single Application record for API response"""
    return {
        "ref": f"APP-{app.application_id:04d}",
        "title": app.title,
        "classification": app.get_classification_display(),
        "area": (app.site.reforestation_area.barangay.name
                 if app.site and app.site.reforestation_area and app.site.reforestation_area.barangay
                 else "Unassigned"),
        "hectares": f"{app.site.total_area_hectares:.2f} ha"
                    if app.site and app.site.total_area_hectares else "N/A",
        "status": _status_display(app.status),
        "created_at": _time_ago(app.created_at),
    }


# ─────────────────────────────────────────────────────────────
# MAIN ENDPOINT
# ─────────────────────────────────────────────────────────────
@csrf_exempt
def get_dashboard_data(request):
    """
    Comprehensive dashboard data endpoint for DataManager.
    Capstone-aligned: GIS-based site suitability + reforestation monitoring.
    """
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    user = get_user_from_token(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    now = timezone.now()
    seven_months_ago = now - timedelta(days=210)

    # ═══════════════════════════════════════════════════════════
    # 1. CORE STATS
    # ═══════════════════════════════════════════════════════════
    total_applications = Application.objects.count()
    approved = Application.objects.filter(status='accepted').count()
    pending = Application.objects.filter(status__in=['for_evaluation', 'for_head']).count()
    rejected = Application.objects.filter(status__in=['rejected', 'failed', 'cancelled']).count()
    completed_applications = Application.objects.filter(status='completed').count()
    completed_sites = Sites.objects.filter(status='completed').count()

    areas_assessed = SiteMetaDataVerification.objects.filter(status='verified').count()
    assessors_count = User.objects.filter(user_role='OnsiteInspector', is_active=True).count()

    # Seedlings: endorsed (distributed) from accepted requests
    trees_endorsed = SeedlingRequestSpecies.objects.filter(
        seedling_request__status='accepted'
    ).aggregate(total=Coalesce(Sum('quantity'), 0))['total']

    # Seedlings: actually planted (from baseline in initial visits)
    total_seedlings_planted = ProgressReportSpecies.objects.filter(
        progress_report__visit_type='initial',
        progress_report__status='accepted',
    ).aggregate(total=Coalesce(Sum('no_planted'), 0))['total']

    total_area_planted = round((total_seedlings_planted * 4) / 10000, 2)

    # Overall survival rate (from accepted progress reports)
    survival_totals = ProgressReportSpecies.objects.filter(
        progress_report__status='accepted'
    ).aggregate(
        survived=Coalesce(Sum('no_survived'), 0),
        dead=Coalesce(Sum('no_dead'), 0),
    )
    total_plants = survival_totals['survived'] + survival_totals['dead']
    overall_survival_rate = round(
        (survival_totals['survived'] / total_plants * 100), 1
    ) if total_plants > 0 else 0.0

    active_alerts = (
        SiteMetaDataVerification.objects.filter(status='pending').count()
        + Application.objects.filter(status='for_evaluation').count()
        + SeedlingRequest.objects.filter(status='pending').count()
        + ProgressReport.objects.filter(status='pending').count()
    )

    # ═══════════════════════════════════════════════════════════
    # 2. APPLICATION TREND (Last 7 months)
    # ═══════════════════════════════════════════════════════════
    monthly_apps = Application.objects.filter(
        created_at__gte=seven_months_ago
    ).annotate(
        month=TruncMonth('created_at')
    ).values('month').annotate(
        submitted=Count('application_id'),
        approved=Count('application_id', filter=Q(status='accepted')),
        rejected=Count('application_id', filter=Q(status__in=['rejected', 'failed', 'cancelled']))
    ).order_by('month')

    monthly_apps_list = list(monthly_apps)
    application_trend = [
        {
            "month": e['month'].strftime('%b'),
            "submitted": e['submitted'],
            "approved": e['approved'],
            "rejected": e['rejected']
        } for e in monthly_apps_list
    ]

    # ═══════════════════════════════════════════════════════════
    # 3. SEEDLINGS PLANTED TREND
    # ═══════════════════════════════════════════════════════════
    monthly_planted = ProgressReportSpecies.objects.filter(
        progress_report__visit_type='initial',
        progress_report__status='accepted',
        progress_report__created_at__gte=seven_months_ago,
    ).annotate(
        month=TruncMonth('progress_report__created_at')
    ).values('month').annotate(
        planted=Coalesce(Sum('no_planted'), 0)
    ).order_by('month')

    seedlings_planted_trend = []
    cumulative_seedlings = 0
    for e in monthly_planted:
        planted = e['planted'] or 0
        cumulative_seedlings += planted
        seedlings_planted_trend.append({
            "month": e['month'].strftime('%b'),
            "seedlings_planted": planted,
            "cumulative_seedlings": cumulative_seedlings,
            "cumulative_area_hectares": round((cumulative_seedlings * 4) / 10000, 2)
        })

    # ═══════════════════════════════════════════════════════════
    # 4. STATUS DATA (Pie Chart)
    # ═══════════════════════════════════════════════════════════
    status_counts = Application.objects.values('status').annotate(count=Count('application_id'))

    status_map = {
        'accepted':         ('Approved',  '#10b981'),
        'for_evaluation':   ('Pending',   '#f59e0b'),
        'for_head':         ('Pending',   '#f59e0b'),
        'rejected':         ('Rejected',  '#ef4444'),
        'failed':           ('Rejected',  '#ef4444'),
        'cancelled':        ('Cancelled', '#f97316'),
        'under_monitoring': ('Monitoring','#6366f1'),
        'completed':        ('Completed', '#059669'),
    }
    status_aggregated = {}
    for item in status_counts:
        s = item['status']
        if s in status_map:
            name, color = status_map[s]
            if name not in status_aggregated:
                status_aggregated[name] = {'name': name, 'value': 0, 'fill': color}
            status_aggregated[name]['value'] += item['count']
    status_data = list(status_aggregated.values())

    # ═══════════════════════════════════════════════════════════
    # 5. ASSESSMENT DATA (By Barangay)
    # ═══════════════════════════════════════════════════════════
    barangay_stats = Sites.objects.filter(
        reforestation_area__barangay__isnull=False
    ).values(
        barangay_name=F('reforestation_area__barangay__name')
    ).annotate(
        assessed=Count('site_id'),
        approved=Count('site_id', filter=Q(status__in=['accepted', 'completed']))
    ).order_by('-assessed')[:6]

    assessment_data = [
        {"name": i['barangay_name'], "assessed": i['assessed'], "approved": i['approved']}
        for i in barangay_stats
    ]

    # ═══════════════════════════════════════════════════════════
    # 6. APPROVAL RATE TREND
    # ═══════════════════════════════════════════════════════════
    approval_rate = [
        {
            "month": e['month'].strftime('%b'),
            "rate": int(round((e['approved'] / e['submitted'] * 100), 0)) if e['submitted'] > 0 else 0
        }
        for e in monthly_apps_list
    ]

    # ═══════════════════════════════════════════════════════════
    # 7. RECENT ACTIVITIES (audit trail — multi-layer)
    # ═══════════════════════════════════════════════════════════
    recent_reasons = Reason.objects.select_related(
        'user__profile', 'application'
    ).order_by('-created')[:8]

    recent_activities = []
    for r in recent_reasons:
        if r.status in ['accepted', 'completed']:
            act_type = 'success'
            action = ('Application approved' if r.status == 'accepted'
                      else 'Program completed')
        elif r.status in ['rejected', 'failed', 'cancelled']:
            act_type = 'danger'
            action = f'Application {r.get_status_display().lower()}'
        elif r.status == 'for_head':
            act_type = 'warning'
            action = 'Escalated to Head'
        else:
            act_type = 'info'
            action = r.reason[:60] if r.reason else 'Update recorded'

        recent_activities.append({
            "id": r.reason_id,
            "type": act_type,
            "ref": f"APP-{r.application.application_id:04d}" if r.application else "N/A",
            "action": action,
            "time": _time_ago(r.created),
            "officer": _officer_name(r.user),
            "layer": r.status_layer,
        })

    # ═══════════════════════════════════════════════════════════
    # 8. RECENT APPS & ALL APPS
    # ═══════════════════════════════════════════════════════════
    recent_apps = [
        _format_app(a) for a in
        Application.objects.select_related('site__reforestation_area__barangay')
        .order_by('-created_at')[:5]
    ]
    all_apps = [
        _format_app(a) for a in
        Application.objects.select_related('site__reforestation_area__barangay')
        .order_by('-created_at')[:20]
    ]

    # ═══════════════════════════════════════════════════════════
    # 9. ASSESSORS (OnsiteInspectors)
    # ═══════════════════════════════════════════════════════════
    inspectors = User.objects.filter(
        user_role='OnsiteInspector', is_active=True
    ).select_related('profile')[:6]

    assessors = []
    for insp in inspectors:
        verifications = SiteMetaDataVerification.objects.filter(verified_by=insp)
        assessments_done = verifications.count()
        approved_count = verifications.filter(status='verified').count()
        pending_seedlings = SeedlingRequest.objects.filter(
            assigned_inspector=insp, status='accepted'
        ).count()

        avatar = (f"{insp.profile.first_name[0]}{insp.profile.last_name[0]}"
                  if hasattr(insp, 'profile') and insp.profile
                  else insp.email[:2].upper())

        assessors.append({
            "name": (f"{insp.profile.first_name[0]}. {insp.profile.last_name}"
                     if hasattr(insp, 'profile') and insp.profile
                     else insp.email),
            "assessments": assessments_done,
            "approved": approved_count,
            "pending_seedlings": pending_seedlings,
            "status": "Active",
            "avatar": avatar,
        })

    # ═══════════════════════════════════════════════════════════
    # 10. BARANGAY BREAKDOWN (with real seedling counts)
    # ═══════════════════════════════════════════════════════════
    brgy_app_counts = (Application.objects
        .filter(site__reforestation_area__barangay__isnull=False)
        .values(brgy=F('site__reforestation_area__barangay__name'))
        .annotate(
            apps=Count('application_id'),
            approved_apps=Count('application_id',
                filter=Q(status__in=['accepted', 'completed', 'under_monitoring'])))
        .order_by('-apps')[:6]
    )

    barangay_breakdown = []
    for b in brgy_app_counts:
        brgy_name = b['brgy']
        total_seedlings = (ProgressReportSpecies.objects
            .filter(
                progress_report__status='accepted',
                progress_report__application__site__reforestation_area__barangay__name=brgy_name
            )
            .aggregate(total=Coalesce(Sum('no_planted'), 0))['total'])
        rate = (int(round(b['approved_apps'] / b['apps'] * 100))
                if b['apps'] > 0 else 0)

        barangay_breakdown.append({
            "name": brgy_name,
            "apps": b['apps'],
            "trees": total_seedlings,
            "rate": rate,
        })

    # ═══════════════════════════════════════════════════════════
    # 11. SEEDLING REQUEST PIPELINE
    # ═══════════════════════════════════════════════════════════
    seedling_status_counts = (SeedlingRequest.objects
        .values('status')
        .annotate(count=Count('seedling_request_id')))

    seedling_pipeline_map = {
        'pending':   ('Pending',   '#f59e0b'),
        'accepted':  ('Accepted',  '#10b981'),
        'confirmed': ('Confirmed', '#059669'),
        'rejected':  ('Rejected',  '#ef4444'),
        'cancelled': ('Cancelled', '#9ca3af'),
    }
    seedling_pipeline = []
    for item in seedling_status_counts:
        if item['status'] in seedling_pipeline_map:
            name, color = seedling_pipeline_map[item['status']]
            seedling_pipeline.append({
                "name": name, "value": item['count'], "fill": color
            })

    # ═══════════════════════════════════════════════════════════
    # 12. SITE VERIFICATION PIPELINE
    # ═══════════════════════════════════════════════════════════
    verification_counts = (SiteMetaDataVerification.objects
        .values('status')
        .annotate(count=Count('id')))

    verification_map = {
        'pending':  ('Pending',  '#f59e0b'),
        'verified': ('Verified', '#10b981'),
        'rejected': ('Rejected', '#ef4444'),
        'draft':    ('Draft',    '#9ca3af'),
    }
    verification_pipeline = []
    for item in verification_counts:
        if item['status'] in verification_map:
            name, color = verification_map[item['status']]
            verification_pipeline.append({
                "name": name, "value": item['count'], "fill": color
            })

    # ═══════════════════════════════════════════════════════════
    # 13. PROGRESS REPORT STATS (Initial vs Ongoing)
    # ═══════════════════════════════════════════════════════════
    pr_counts = (ProgressReport.objects
        .values('visit_type', 'status')
        .annotate(count=Count('progress_report_id')))

    progress_report_stats = {
        "total_initial": 0, "initial_completed": 0,
        "total_ongoing": 0, "ongoing_completed": 0,
    }
    for p in pr_counts:
        if p['visit_type'] == 'initial':
            progress_report_stats['total_initial'] += p['count']
            if p['status'] == 'accepted':
                progress_report_stats['initial_completed'] += p['count']
        elif p['visit_type'] == 'ongoing':
            progress_report_stats['total_ongoing'] += p['count']
            if p['status'] == 'accepted':
                progress_report_stats['ongoing_completed'] += p['count']

    # ═══════════════════════════════════════════════════════════
    # 14. SURVIVAL RATE BY SPECIES
    # ═══════════════════════════════════════════════════════════
    species_survival = (ProgressReportSpecies.objects
        .filter(progress_report__status='accepted')
        .values(species=F('tree_species__name'))
        .annotate(
            survived=Coalesce(Sum('no_survived'), 0),
            dead=Coalesce(Sum('no_dead'), 0),
            planted=Coalesce(Sum('no_planted'), 0),
        )
        .order_by('-survived')[:8]
    )

    survival_by_species = []
    for s in species_survival:
        total = s['survived'] + s['dead']
        rate = round((s['survived'] / total * 100), 1) if total > 0 else 0.0
        survival_by_species.append({
            "name": s['species'] or "Unknown",
            "planted": s['planted'],
            "survived": s['survived'],
            "dead": s['dead'],
            "rate": rate,
        })

    # ═══════════════════════════════════════════════════════════
    # 15. SURVIVAL RATE BY BARANGAY
    # ═══════════════════════════════════════════════════════════
    brgy_survival_qs = (ProgressReportSpecies.objects
        .filter(
            progress_report__status='accepted',
            progress_report__application__site__reforestation_area__barangay__isnull=False,
        )
        .values(brgy=F('progress_report__application__site__reforestation_area__barangay__name'))
        .annotate(
            survived=Coalesce(Sum('no_survived'), 0),
            dead=Coalesce(Sum('no_dead'), 0),
        )
        .order_by('-survived')[:8]
    )

    survival_by_barangay = []
    for b in brgy_survival_qs:
        total = b['survived'] + b['dead']
        rate = round((b['survived'] / total * 100), 1) if total > 0 else 0.0
        survival_by_barangay.append({
            "name": b['brgy'],
            "survived": b['survived'],
            "dead": b['dead'],
            "rate": rate,
        })

    # ═══════════════════════════════════════════════════════════
    # 16. DOCUMENTATION & COMPLIANCE STATS
    # ═══════════════════════════════════════════════════════════
    apps_with_maintenance = Application.objects.exclude(
        Q(maintenance_plan='') | Q(maintenance_plan__isnull=True)
    ).count()

    sites_with_permits = (PermitDocument.objects
        .values('site')
        .distinct()
        .count())

    initial_visits_total = ProgressReport.objects.filter(visit_type='initial').count()
    initial_visits_with_agreement = (ProgressReport.objects
        .filter(visit_type='initial')
        .exclude(Q(agreement_image='') | Q(agreement_image__isnull=True))
        .count())

    permit_docs_by_type = list(
        PermitDocument.objects.values('document_type')
        .annotate(count=Count('permit_id'))
    )
    for p in permit_docs_by_type:
        p['display'] = dict(PermitDocument.DOCUMENT_TYPES).get(
            p['document_type'], p['document_type']
        )

    documentation_stats = {
        "apps_with_maintenance_plan": apps_with_maintenance,
        "apps_total": total_applications,
        "sites_with_permits": sites_with_permits,
        "sites_total": Sites.objects.count(),
        "initial_visits_with_agreement": initial_visits_with_agreement,
        "initial_visits_total": initial_visits_total,
        "permit_docs_by_type": permit_docs_by_type,
    }

    # ═══════════════════════════════════════════════════════════
    # 17. TOP PERFORMING SITES (highest survival)
    # ═══════════════════════════════════════════════════════════
    site_performance = (ProgressReportSpecies.objects
        .filter(progress_report__status='accepted')
        .values(
            site_name=F('progress_report__application__site__name'),
            barangay=F('progress_report__application__site__reforestation_area__barangay__name'),
            site_id=F('progress_report__application__site__site_id'),
        )
        .annotate(
            survived=Coalesce(Sum('no_survived'), 0),
            dead=Coalesce(Sum('no_dead'), 0),
        )
        .order_by('-survived')[:5]
    )

    top_performing_sites = []
    for s in site_performance:
        total = s['survived'] + s['dead']
        rate = round((s['survived'] / total * 100), 1) if total > 0 else 0.0
        top_performing_sites.append({
            "name": s['site_name'] or "Unnamed Site",
            "barangay": s['barangay'] or "Unassigned",
            "survived": s['survived'],
            "dead": s['dead'],
            "total": total,
            "rate": rate,
        })

    # ═══════════════════════════════════════════════════════════
    # 18. SITES NEEDING ATTENTION (low survival or no recent visit)
    # ═══════════════════════════════════════════════════════════
    sites_attention_qs = (ProgressReportSpecies.objects
        .filter(progress_report__status='accepted')
        .values(
            site_name=F('progress_report__application__site__name'),
            barangay=F('progress_report__application__site__reforestation_area__barangay__name'),
            site_id=F('progress_report__application__site__site_id'),
        )
        .annotate(
            survived=Coalesce(Sum('no_survived'), 0),
            dead=Coalesce(Sum('no_dead'), 0),
            last_visit=F('progress_report__created_at'),
        )
        .order_by('survived')[:5]
    )

    sites_needing_attention = []
    for s in sites_attention_qs:
        total = s['survived'] + s['dead']
        if total == 0:
            continue
        rate = round((s['survived'] / total * 100), 1)
        sites_needing_attention.append({
            "name": s['site_name'] or "Unnamed Site",
            "barangay": s['barangay'] or "Unassigned",
            "survived": s['survived'],
            "dead": s['dead'],
            "total": total,
            "rate": rate,
            "last_visit": _time_ago(s['last_visit']) if s['last_visit'] else "—",
        })

    # ═══════════════════════════════════════════════════════════
    # RESPONSE
    # ═══════════════════════════════════════════════════════════
    return JsonResponse({
        "stats": {
            "total_applications": total_applications,
            "approved": approved,
            "pending": pending,
            "rejected": rejected,
            "completed_applications": completed_applications,
            "completed_sites": completed_sites,
            "total_seedlings_planted": total_seedlings_planted,
            "total_area_planted": total_area_planted,
            "areas_assessed": areas_assessed,
            "assessors": assessors_count,
            "trees_endorsed": trees_endorsed,
            "overall_survival_rate": overall_survival_rate,
            "active_alerts": active_alerts,
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
        "barangay_breakdown": barangay_breakdown,
        # NEW
        "seedling_request_pipeline": seedling_pipeline,
        "site_verification_pipeline": verification_pipeline,
        "progress_report_stats": progress_report_stats,
        "survival_by_species": survival_by_species,
        "survival_by_barangay": survival_by_barangay,
        "documentation_stats": documentation_stats,
        "top_performing_sites": top_performing_sites,
        "sites_needing_attention": sites_needing_attention,
    }, status=200)


# ─────────────────────────────────────────────────────────────
# UNCHANGED ENDPOINTS
# ─────────────────────────────────────────────────────────────
@csrf_exempt
def get_pending_dm_application_count(request):
    """Pending applications count for DataManager sidebar badge"""
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    user = get_user_from_token(request)
    if not user or user.user_role != 'DataManager':
        return JsonResponse({'error': 'Unauthorized'}, status=403)
    return JsonResponse({
        'pending_count': Application.objects.filter(status='for_evaluation').count(),
        'timestamp': timezone.now().isoformat()
    }, status=200)


@csrf_exempt
def get_pending_request_count(request):
    """Pending seedling requests count for DataManager sidebar badge"""
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    user = get_user_from_token(request)
    if not user or user.user_role != 'DataManager':
        return JsonResponse({'error': 'Unauthorized'}, status=403)
    return JsonResponse({
        'pending_count': SeedlingRequest.objects.filter(status='pending').count(),
        'timestamp': timezone.now().isoformat()
    }, status=200)