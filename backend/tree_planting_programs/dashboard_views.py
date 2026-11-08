from django.db.models import Sum, Count, Q, F, Value
from django.db.models.functions import Coalesce, TruncMonth
from datetime import timedelta, datetime
from django.utils import timezone
from sites.models import Sites, SiteMetaDataVerification
from sites.views import OFFICIAL_SITE_STATUSES
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


# A site under monitoring with no accepted visit in this many days is overdue.
# Matches the 90-day compliance rule used in the Head dashboard.
OVERDUE_VISIT_DAYS = 90

# Survival rate below this (in %) flags a site as needing attention.
LOW_SURVIVAL_THRESHOLD = 70

MONITORING_STATUS_MAP = {
    'available':        ('Available',        '#10b981'),
    'reserved':         ('Reserved',         '#f59e0b'),
    'under_monitoring': ('Under Monitoring', '#6366f1'),
    'completed':        ('Completed',        '#059669'),
    'failed':           ('Failed',           '#ef4444'),
    'onhold':           ('On Hold',          '#9ca3af'),
}


def _report_date(report):
    return report.submitted_at or report.created_at


def _month_key(dt):
    local = timezone.localtime(dt)
    return (local.year, local.month)


def _survival(planted, dead):
    """Same formula as the site monitoring report: (planted - dead) / planted."""
    total = planted
    survived = max(0, total - dead)
    rate = round(survived / total * 100, 1) if total > 0 else None
    return total, survived, rate


def _estimated_hectares(seedlings):
    """Fallback when no planted polygon exists: 2m x 2m spacing = 4 m² per seedling."""
    return round((seedlings * 4) / 10000, 2)


def _build_monitoring_data(now):
    """
    Monitoring and planting progress for the Data Manager.
    Works from accepted progress reports, grouped per site, so each site is
    counted once and the planted area is the latest polygon (not a sum of visits).
    """
    # ── Official sites and their monitoring status ──
    official_sites = Sites.objects.filter(
        is_active=True,
        meta_verification__status='verified',
        status__in=OFFICIAL_SITE_STATUSES,
    )
    status_rows = {
        r['monitoring_status']: r for r in official_sites
        .values('monitoring_status')
        .annotate(count=Count('site_id'),
                  hectares=Coalesce(Sum('total_area_hectares'), Value(0.0)))
    }
    monitoring_status_breakdown = []
    for key, (label, color) in MONITORING_STATUS_MAP.items():
        row = status_rows.get(key)
        monitoring_status_breakdown.append({
            "key": key,
            "name": label,
            "value": row['count'] if row else 0,
            "hectares": round(row['hectares'], 2) if row else 0.0,
            "fill": color,
        })
    official_total = sum(r['count'] for r in status_rows.values())
    official_hectares = round(sum(r['hectares'] for r in status_rows.values()), 2)
    under_monitoring_row = status_rows.get('under_monitoring')

    # ── Accepted reports, oldest first ──
    reports = list(
        ProgressReport.objects
        .filter(status='accepted', site__isnull=False)
        .select_related('site__reforestation_area__barangay')
        .prefetch_related('report_species__tree_species')
    )
    reports.sort(key=_report_date)

    per_site = {}
    per_species = {}
    for r in reports:
        rp = rd = 0
        for sp in r.report_species.all():
            p, d = sp.no_planted or 0, sp.no_dead or 0
            rp, rd = rp + p, rd + d
            name = sp.tree_species.name if sp.tree_species else "Unknown"
            spec = per_species.setdefault(name, {"planted": 0, "dead": 0})
            spec["planted"] += p
            spec["dead"] += d
        r._totals = (rp, rd)

        s = per_site.setdefault(r.site_id, {
            "site": r.site, "planted": 0, "dead": 0,
            "visits": 0, "last_visit": None, "area": None,
        })
        s["planted"] += rp
        s["dead"] += rd
        s["visits"] += 1
        s["last_visit"] = _report_date(r)
        if r.planted_area_hectares:
            s["area"] = r.planted_area_hectares  # latest polygon wins

    # ── Monthly progress trend (last 12 months, cumulative) ──
    month_keys = []
    y, m = now.year, now.month
    for _ in range(12):
        month_keys.append((y, m))
        m -= 1
        if m == 0:
            y, m = y - 1, 12
    month_keys.reverse()

    run_planted = run_dead = 0
    site_area, site_seedlings, planted_sites = {}, {}, set()
    planting_trend = []
    ptr = 0
    for key in month_keys:
        new_seedlings = new_dead = new_sites = visits = 0
        while ptr < len(reports) and _month_key(_report_date(reports[ptr])) <= key:
            r = reports[ptr]
            ptr += 1
            rp, rd = r._totals
            run_planted, run_dead = run_planted + rp, run_dead + rd
            site_seedlings[r.site_id] = site_seedlings.get(r.site_id, 0) + rp
            if r.planted_area_hectares:
                site_area[r.site_id] = r.planted_area_hectares
            is_new_site = r.site_id not in planted_sites and (rp > 0 or r.visit_type == 'initial')
            if is_new_site:
                planted_sites.add(r.site_id)
            if _month_key(_report_date(r)) == key:
                new_seedlings += rp
                new_dead += rd
                visits += 1
                new_sites += 1 if is_new_site else 0

        total, survived, rate = _survival(run_planted, run_dead)
        hectares = sum(
            site_area[sid] if sid in site_area else _estimated_hectares(site_seedlings.get(sid, 0))
            for sid in planted_sites
        )
        planting_trend.append({
            "month": datetime(key[0], key[1], 1).strftime("%b '%y"),
            "new_seedlings": new_seedlings,
            "new_dead": new_dead,
            "new_sites": new_sites,
            "visits": visits,
            "cumulative_sites": len(planted_sites),
            "cumulative_seedlings": total,
            "cumulative_survived": survived,
            "cumulative_hectares": round(hectares, 2),
            "survival_rate": rate,
        })

    # ── Per-site progress ──
    site_progress = []
    for sid, s in per_site.items():
        site = s["site"]
        total, survived, rate = _survival(s["planted"], s["dead"])
        days_since = (now - s["last_visit"]).days if s["last_visit"] else None
        site_progress.append({
            "site_id": sid,
            "name": site.name or "Unnamed Site",
            "barangay": (site.reforestation_area.barangay.name
                         if site.reforestation_area and site.reforestation_area.barangay
                         else "Unassigned"),
            "monitoring_status": MONITORING_STATUS_MAP.get(site.monitoring_status, (site.monitoring_status, ''))[0],
            "site_hectares": round(site.total_area_hectares or 0, 2),
            "planted_hectares": round(s["area"], 2) if s["area"] is not None else _estimated_hectares(total),
            "planted": total,
            "survived": survived,
            "dead": s["dead"],
            "rate": rate if rate is not None else 0.0,
            "visits": s["visits"],
            "last_visit": _time_ago(s["last_visit"]),
            "days_since_visit": days_since,
            "overdue": site.monitoring_status == 'under_monitoring'
                       and days_since is not None and days_since > OVERDUE_VISIT_DAYS,
            "no_visit": False,
        })

    # Sites under monitoring that have no accepted visit yet
    for site in (official_sites.filter(monitoring_status='under_monitoring')
                 .exclude(site_id__in=per_site.keys())
                 .select_related('reforestation_area__barangay')):
        site_progress.append({
            "site_id": site.site_id,
            "name": site.name or "Unnamed Site",
            "barangay": (site.reforestation_area.barangay.name
                         if site.reforestation_area and site.reforestation_area.barangay
                         else "Unassigned"),
            "monitoring_status": "Under Monitoring",
            "site_hectares": round(site.total_area_hectares or 0, 2),
            "planted_hectares": 0.0,
            "planted": 0, "survived": 0, "dead": 0, "rate": 0.0,
            "visits": 0,
            "last_visit": "No visit yet",
            "days_since_visit": None,
            "overdue": False,
            "no_visit": True,
        })

    site_progress.sort(key=lambda x: (-x["planted"], x["name"]))
    planted_by_barangay = {}
    for sp in site_progress:
        e = planted_by_barangay.setdefault(sp["barangay"] or "Unassigned", {"hectares": 0.0, "planted": 0, "dead": 0})
        e["hectares"] = round(e["hectares"] + (sp["planted_hectares"] or 0), 4)
        e["planted"] += sp["planted"]
        e["dead"] += sp["dead"]

    top_performing_sites = sorted(
        [s for s in site_progress if s["planted"] > 0],
        key=lambda x: (-x["rate"], -x["planted"]),
    )[:5]

    def _attention_reason(s):
        if s["no_visit"]:
            return "No accepted visit yet"
        if s["overdue"]:
            return f"No visit in {s['days_since_visit']} days"
        return f"Low survival ({s['rate']}%)"

    sites_needing_attention = [
        {**s, "reason": _attention_reason(s)}
        for s in sorted(
            [s for s in site_progress
             if s["no_visit"] or s["overdue"]
             or (s["planted"] > 0 and s["rate"] < LOW_SURVIVAL_THRESHOLD)],
            key=lambda x: (not x["overdue"], not x["no_visit"], x["rate"]),
        )
    ][:6]

    # ── Survival by species ──
    survival_by_species = []
    for name, sp in per_species.items():
        total, survived, rate = _survival(sp["planted"], sp["dead"])
        if total == 0:
            continue
        survival_by_species.append({
            "name": name, "planted": total, "survived": survived,
            "dead": sp["dead"], "rate": rate,
        })
    survival_by_species.sort(key=lambda x: -x["planted"])
    survival_by_species = survival_by_species[:8]

    # ── Summary ──
    all_planted = sum(s["planted"] for s in per_site.values())
    all_dead = sum(s["dead"] for s in per_site.values())
    _, all_survived, all_rate = _survival(all_planted, all_dead)
    planted_hectares = planting_trend[-1]["cumulative_hectares"] if planting_trend else 0.0

    thirty_days_ago = now - timedelta(days=30)
    monitoring_summary = {
        "official_sites": official_total,
        "official_hectares": official_hectares,
        "sites_under_monitoring": under_monitoring_row['count'] if under_monitoring_row else 0,
        "hectares_under_monitoring": round(under_monitoring_row['hectares'], 2) if under_monitoring_row else 0.0,
        "available_sites": status_rows['available']['count'] if 'available' in status_rows else 0,
        "sites_planted": len(per_site),
        "planted_hectares": planted_hectares,
        "total_planted": all_planted,
        "total_survived": all_survived,
        "total_dead": all_dead,
        "survival_rate": all_rate if all_rate is not None else 0.0,
        "overdue_sites": sum(1 for s in site_progress if s["overdue"]),
        "sites_without_visit": sum(1 for s in site_progress if s["no_visit"]),
        "pending_reports": ProgressReport.objects.filter(status='pending').count(),
        "visits_last_30_days": sum(1 for r in reports if _report_date(r) >= thirty_days_ago),
        "overdue_days": OVERDUE_VISIT_DAYS,
    }

    return {
        "monitoring_summary": monitoring_summary,
        "monitoring_status_breakdown": monitoring_status_breakdown,
        "planting_trend": planting_trend,
        "site_progress": site_progress[:15],
        "planted_by_barangay": planted_by_barangay,
        "survival_by_species": survival_by_species,
        "top_performing_sites": top_performing_sites,
        "sites_needing_attention": sites_needing_attention,
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
    active_sites = Sites.objects.filter(is_active=True, reforestation_area__deleted_at__isnull=True)

    # Site status = the GIS Specialist's decision on the site
    site_decision_counts = {r['status']: r['n'] for r in active_sites.values('status').annotate(n=Count('site_id'))}
    # Meta-data verification = the Data Manager's review of the site's field data
    verification_counts = {
        r['meta_verification__status'] or 'none': r['n']
        for r in active_sites.values('meta_verification__status').annotate(n=Count('site_id'))
    }

    areas_qs = Reforestation_areas.objects.filter(deleted_at__isnull=True)
    reforestation_areas = {
        "total": areas_qs.count(),
        "with_sites": areas_qs.filter(sites__is_active=True).distinct().count(),
        "sites": active_sites.count(),
        "hectares": round(active_sites.aggregate(h=Coalesce(Sum('total_area_hectares'), 0.0))['h'], 2),
    }
    assessors_count = User.objects.filter(user_role='OnsiteInspector', is_active=True).count()

    # Seedlings: endorsed (distributed) from accepted requests
    trees_endorsed = SeedlingRequestSpecies.objects.filter(
        seedling_request__status='accepted'
    ).aggregate(total=Coalesce(Sum('quantity'), 0))['total']

    under_monitoring_applications = Application.objects.filter(status='under_monitoring').count()

    # Monitoring & planting progress (seedlings, area, survival, official sites)
    monitoring = _build_monitoring_data(now)
    summary = monitoring["monitoring_summary"]

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
    # 3. STATUS DATA (Pie Chart)
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
    # 4. ASSESSMENT DATA (By Barangay)
    # ═══════════════════════════════════════════════════════════
    barangay_stats = active_sites.filter(
        reforestation_area__barangay__isnull=False
    ).values(
        barangay_name=F('reforestation_area__barangay__name')
    ).annotate(
        sites=Count('site_id'),
        accepted=Count('site_id', filter=Q(status='accepted')),
        verified=Count('site_id', filter=Q(meta_verification__status='verified')),
    ).order_by('-sites')[:6]

    sites_by_barangay = [
        {"name": i['barangay_name'], "sites": i['sites'], "accepted": i['accepted'], "verified": i['verified']}
        for i in barangay_stats
    ]

    # ═══════════════════════════════════════════════════════════
    # 6. RECENT ACTIVITIES (audit trail — multi-layer)
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
    # 7. RECENT APPS & ALL APPS
    # ═══════════════════════════════════════════════════════════
    recent_apps = [
        _format_app(a) for a in
        Application.objects.select_related('site__reforestation_area__barangay')
        .order_by('-created_at')[:5]
    ]

    # ═══════════════════════════════════════════════════════════
    # 8. ASSESSORS (OnsiteInspectors)
    # ═══════════════════════════════════════════════════════════
    inspectors = User.objects.filter(
        user_role='OnsiteInspector', is_active=True
    ).select_related('profile')[:6]

    assessors = []
    for insp in inspectors:
        submitted = Field_assessment.objects.filter(assigned_onsite_inspector__user=insp, is_submitted=True)
        assessments_done = submitted.count()
        sites_assessed = submitted.filter(site__isnull=False).values('site_id').distinct().count()
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
            "sites_assessed": sites_assessed,
            "pending_seedlings": pending_seedlings,
            "status": "Active",
            "avatar": avatar,
        })

    # ═══════════════════════════════════════════════════════════
    # 9. SEEDLING REQUEST PIPELINE
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
    # 10. SITE DECISION (GIS) & META-DATA VERIFICATION (DM)
    # ═══════════════════════════════════════════════════════════
    def _pipeline(counts, styles):
        return [{"key": k, "name": name, "value": counts.get(k, 0), "fill": color}
                for k, (name, color) in styles.items()]

    site_decision_pipeline = _pipeline(site_decision_counts, {
        'pending':      ('Pending',      '#f59e0b'),
        'under_review': ('Under Review', '#3b82f6'),
        'accepted':     ('Accepted',     '#10b981'),
        'rejected':     ('Rejected',     '#ef4444'),
    })
    verification_pipeline = _pipeline(verification_counts, {
        'none':     ('Not started', '#d1d5db'),
        'draft':    ('Draft',       '#9ca3af'),
        'pending':  ('Pending',     '#f59e0b'),
        'verified': ('Verified',    '#10b981'),
        'rejected': ('Rejected',    '#ef4444'),
    })

    # ═══════════════════════════════════════════════════════════
    # 11. PROGRESS REPORT STATS (Initial vs Ongoing)
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
    # RESPONSE
    # ═══════════════════════════════════════════════════════════
    return JsonResponse({
        "stats": {
            "total_applications": total_applications,
            "approved": approved,
            "pending": pending,
            "rejected": rejected,
            "under_monitoring_applications": under_monitoring_applications,
            "completed_applications": completed_applications,
            "assessors": assessors_count,
            "trees_endorsed": trees_endorsed,
        },
        "reforestation_areas": reforestation_areas,
        "application_trend": application_trend,
        "status_data": status_data,
        "sites_by_barangay": sites_by_barangay,
        "recent_activities": recent_activities,
        "recent_apps": recent_apps,
        "assessors": assessors,
        "seedling_request_pipeline": seedling_pipeline,
        "site_decision_pipeline": site_decision_pipeline,
        "site_verification_pipeline": verification_pipeline,
        "progress_report_stats": progress_report_stats,
        **monitoring,
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


"""
Data Manager reports.

Every endpoint takes optional filters as query params and returns:
  - "summary": totals for the filtered set
  - chart data (monthly / per barangay / per status)
  - "rows": every matching record (not paginated, so exports include everything)

Survival uses the same formula as the site monitoring report:
  survived = planted - dead,   rate = survived / planted
"""
from datetime import datetime, date, timedelta

from django.db.models import Q, Prefetch
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt

from accounts.helper import get_user_from_token
from barangay.models import Barangay
from Field_assessment.models import Field_assessment
from land_classifications.models import LandClassification
from reforestation_areas.models import Reforestation_areas
from sites.models import Sites
from sites.views import OFFICIAL_SITE_STATUSES
from tree_species.models import Tree_species
from .models import (
    Application, ProgressReport, SeedlingRequest, SeedlingRequestSpecies,
    ProgressReportSpecies, ProgramClosureRequest,
)

MAX_ROWS = 2000

# A site under monitoring with no accepted visit in this many days is overdue.
OVERDUE_VISIT_DAYS = 90

PROGRAM_STATUS_GROUPS = {
    'completed': ['completed'],
    'failed': ['failed'],
    'ongoing': ['accepted', 'under_monitoring'],
    'pending': ['for_evaluation', 'for_head'],
    'rejected': ['rejected'],
    'cancelled': ['cancelled'],
}

PROGRAM_STATUS_LABELS = {
    'for_evaluation': 'For Evaluation',
    'for_head': 'For Head Approval',
    'accepted': 'Accepted',
    'under_monitoring': 'Under Monitoring',
    'completed': 'Completed',
    'failed': 'Failed',
    'rejected': 'Rejected',
    'cancelled': 'Cancelled',
}

MONITORING_STATUS_LABELS = dict(Sites.MONITORING_STATUS_CHOICES)
MONITORING_STATUS_SHORT = {
    'available': 'Available',
    'reserved': 'Reserved',
    'under_monitoring': 'Under Monitoring',
    'completed': 'Completed',
    'failed': 'Failed',
    'onhold': 'On Hold',
}
SEEDLING_RELEASED_STATUSES = ['accepted', 'confirmed']


# ─────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────
def _auth(request):
    try:
        user = get_user_from_token(request)
    except Exception:
        return None
    if not user or user.user_role not in ('DataManager', 'CityENROHead', 'GISSpecialist'):
        return None
    return user


def _parse_date(value):
    if not value:
        return None
    try:
        return datetime.strptime(value, '%Y-%m-%d').date()
    except ValueError:
        return None


def _iso(d):
    if not d:
        return None
    if isinstance(d, datetime):
        return timezone.localtime(d).date().isoformat() if timezone.is_aware(d) else d.date().isoformat()
    return d.isoformat()


def _local_date(dt):
    if not dt:
        return None
    if isinstance(dt, datetime):
        return timezone.localtime(dt).date() if timezone.is_aware(dt) else dt.date()
    return dt


def _survival(planted, dead):
    total = planted
    survived = max(0, total - dead)
    rate = round(survived / total * 100, 1) if total > 0 else None
    return total, survived, rate


def _group_name(user):
    group = getattr(user, 'tree_grower_group', None) if user else None
    if group:
        return group.group_name
    return user.email if user else 'Unknown'


def _person_name(user):
    if not user:
        return '—'
    profile = getattr(user, 'profile', None)
    if profile and getattr(profile, 'first_name', None):
        return f"{profile.first_name} {profile.last_name}".strip()
    return user.email


def _barangay_name(site):
    if site and site.reforestation_area and site.reforestation_area.barangay:
        return site.reforestation_area.barangay.name
    return None


def _month_range(date_from, date_to, default_months=12):
    """List of (year, month) covering the filter range, or the last N months."""
    end = date_to or timezone.localdate()
    start = date_from or (end.replace(day=1) - timedelta(days=31 * (default_months - 1)))
    months = []
    y, m = start.year, start.month
    while (y, m) <= (end.year, end.month) and len(months) < 36:
        months.append((y, m))
        m += 1
        if m == 13:
            y, m = y + 1, 1
    return months


def _filter_land_class(qs, site_path, value):
    """Filter by the site's verified land classification (an id, or 'none' for unclassified)."""
    prefix = f'{site_path}__' if site_path else ''
    if value == 'none':
        return qs.filter(Q(**{f'{prefix}meta_verification__isnull': True})
                         | Q(**{f'{prefix}meta_verification__verified_land_classification__isnull': True}))
    if value.isdigit():
        return qs.filter(**{f'{prefix}meta_verification__verified_land_classification_id': value})
    return qs


def _month_label(key):
    return date(key[0], key[1], 1).strftime("%b '%y")


def _in_range(d, date_from, date_to):
    if d is None:
        return False
    if date_from and d < date_from:
        return False
    if date_to and d > date_to:
        return False
    return True


def _report_totals(report):
    planted = dead = 0
    for sp in report.report_species.all():
        planted += sp.no_planted or 0
        dead += sp.no_dead or 0
    return planted, dead


# ─────────────────────────────────────────────────────────────
# FILTER OPTIONS
# ─────────────────────────────────────────────────────────────
@csrf_exempt
def get_report_filter_options(request):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    if not _auth(request):
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    return JsonResponse({
        "barangays": [
            {"id": b.barangay_id, "name": b.name}
            for b in Barangay.objects.order_by('name')
        ],
        "species": [
            {"id": s.pk, "name": s.name}
            for s in Tree_species.objects.order_by('name')
        ],
        "areas": [
            {"id": a.reforestation_area_id, "name": a.name, "barangay_id": a.barangay_id}
            for a in Reforestation_areas.objects.filter(deleted_at__isnull=True).order_by('name')
        ],
        "land_classifications": [
            {"id": lc.land_classification_id, "name": lc.name, "ownership": lc.ownership_type}
            for lc in LandClassification.objects.order_by('name')
        ],
        "program_statuses": [
            {"value": k, "label": k.capitalize()} for k in PROGRAM_STATUS_GROUPS
        ],
        "monitoring_statuses": [
            {"value": k, "label": v} for k, v in MONITORING_STATUS_SHORT.items()
        ],
    }, status=200)


# ─────────────────────────────────────────────────────────────
# PROGRAMS REPORT
# ─────────────────────────────────────────────────────────────
def _closed_date(app):
    """When the program ended: Head's closure decision, else last update for finished programs."""
    approved = [c for c in app.closure_requests.all() if c.status == 'approved' and c.decided_at]
    if approved:
        return _local_date(max(approved, key=lambda c: c.decided_at).decided_at)
    if app.status in ('completed', 'failed', 'rejected', 'cancelled'):
        return _local_date(app.updated_at)
    return None


def _closure_note(app):
    approved = [c for c in app.closure_requests.all() if c.status == 'approved']
    if not approved:
        return None
    latest = max(approved, key=lambda c: c.decided_at or c.requested_at)
    return latest.head_notes or latest.recommendation_reason


def _progress_trend(events, months):
    """
    Month-by-month progress of the listed programs, from accepted monitoring visits:
    trees planted / dead that month, running totals, survival rate and planted area
    (each program's latest planted polygon so far). Visits before the first month
    count toward the starting totals.
    """
    events = sorted(e for e in events if e[0])
    trend = []
    i = cum_planted = cum_dead = 0
    area_by_program = {}
    for y, m in months:
        month_end = date(y + (m == 12), m % 12 + 1, 1) - timedelta(days=1)
        new_planted = new_dead = visits = 0
        while i < len(events) and events[i][0] <= month_end:
            d, program_id, planted, dead, area = events[i]
            cum_planted += planted
            cum_dead += dead
            if area:
                area_by_program[program_id] = area
            if (d.year, d.month) == (y, m):
                new_planted += planted
                new_dead += dead
                visits += 1
            i += 1
        _, alive, rate = _survival(cum_planted, cum_dead)
        trend.append({
            "month": _month_label((y, m)),
            "new_planted": new_planted,
            "new_dead": new_dead,
            "visits": visits,
            "total_planted": cum_planted,
            "alive": alive,
            "survival_rate": rate,
            "planted_hectares": round(sum(area_by_program.values()), 2),
        })
    return trend


@csrf_exempt
def get_programs_report(request):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    if not _auth(request):
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    status_group = request.GET.get('status', 'all').strip().lower()
    barangay_id = request.GET.get('barangay', '').strip()
    classification = request.GET.get('classification', '').strip()
    area_id = request.GET.get('area', '').strip()
    land_class = request.GET.get('land_classification', '').strip()   # id | none
    search = request.GET.get('search', '').strip()
    date_basis = request.GET.get('date_basis', 'submitted').strip()  # submitted | closed
    date_from = _parse_date(request.GET.get('date_from'))
    date_to = _parse_date(request.GET.get('date_to'))

    qs = (Application.objects
          .select_related('user__tree_grower_group', 'site__reforestation_area__barangay')
          .prefetch_related(
              Prefetch('progress_reports',
                       queryset=ProgressReport.objects.filter(status='accepted')
                       .prefetch_related('report_species'),
                       to_attr='accepted_reports'),
              Prefetch('seedling_requests',
                       queryset=SeedlingRequest.objects.filter(status__in=SEEDLING_RELEASED_STATUSES)
                       .prefetch_related('seedling_species'),
                       to_attr='released_requests'),
              'closure_requests',
          )
          .order_by('-created_at'))

    if status_group in PROGRAM_STATUS_GROUPS:
        qs = qs.filter(status__in=PROGRAM_STATUS_GROUPS[status_group])
    if barangay_id:
        qs = qs.filter(site__reforestation_area__barangay_id=barangay_id)
    if classification in ('new', 'old'):
        qs = qs.filter(classification=classification)
    if area_id:
        qs = qs.filter(site__reforestation_area_id=area_id)
    qs = _filter_land_class(qs, 'site', land_class)
    if search:
        qs = qs.filter(
            Q(title__icontains=search)
            | Q(user__tree_grower_group__group_name__icontains=search)
            | Q(site__name__icontains=search)
        )
    if date_basis != 'closed':
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)

    today = timezone.localdate()
    rows = []
    events = []   # (visit date, program id, planted, dead, planted area) for the progress trend
    for app in qs[:MAX_ROWS * 2]:
        closed = _closed_date(app)
        if date_basis == 'closed' and (date_from or date_to) and not _in_range(closed, date_from, date_to):
            continue

        planted = dead = 0
        last_visit = None
        planted_area = None
        app_events = []
        for r in sorted(app.accepted_reports, key=lambda r: r.submitted_at or r.created_at):
            p, d = _report_totals(r)
            planted, dead = planted + p, dead + d
            last_visit = r.submitted_at or r.created_at
            if r.planted_area_hectares:
                planted_area = r.planted_area_hectares
            app_events.append((_local_date(last_visit), app.application_id, p, d, r.planted_area_hectares))
        total, survived, rate = _survival(planted, dead)

        endorsed = sum(
            sp.quantity or 0
            for req in app.released_requests
            for sp in req.seedling_species.all()
        )

        start = app.orientation_date or app.confirmed_at or _local_date(app.created_at)
        end = closed or (today if app.status in ('accepted', 'under_monitoring') else None)
        duration = (end - start).days if start and end and end >= start else None

        rows.append({
            "application_id": app.application_id,
            "ref": f"APP-{app.application_id:04d}",
            "title": app.title,
            "group_name": _group_name(app.user),
            "classification": app.get_classification_display(),
            "site_id": app.site.site_id if app.site else None,
            "site_name": app.site.name if app.site else None,
            "barangay": _barangay_name(app.site),
            "status": app.status,
            "status_label": PROGRAM_STATUS_LABELS.get(app.status, app.status),
            "participants": app.total_treegrowers_will_participate,
            "submitted": _iso(app.created_at),
            "orientation_date": _iso(app.orientation_date),
            "closed_date": _iso(closed),
            "duration_days": duration,
            "seedlings_endorsed": endorsed,
            "planted": total,
            "survived": survived,
            "dead": dead,
            "survival_rate": rate,
            "visits": len(app.accepted_reports),
            "last_visit": _iso(last_visit),
            "planted_hectares": round(planted_area, 2) if planted_area else None,
            "closure_note": _closure_note(app),
        })
        events.extend(app_events)
        if len(rows) >= MAX_ROWS:
            break

    # ── Summary ──
    def count(statuses):
        return sum(1 for r in rows if r["status"] in statuses)

    completed = count(PROGRAM_STATUS_GROUPS['completed'])
    failed = count(PROGRAM_STATUS_GROUPS['failed'])
    all_planted = sum(r["planted"] for r in rows)
    all_dead = sum(r["dead"] for r in rows)
    _, all_survived, all_rate = _survival(all_planted, all_dead)
    durations = [r["duration_days"] for r in rows if r["status"] == 'completed' and r["duration_days"] is not None]

    summary = {
        "total": len(rows),
        "completed": completed,
        "failed": failed,
        "ongoing": count(PROGRAM_STATUS_GROUPS['ongoing']),
        "pending": count(PROGRAM_STATUS_GROUPS['pending']),
        "rejected": count(PROGRAM_STATUS_GROUPS['rejected']),
        "cancelled": count(PROGRAM_STATUS_GROUPS['cancelled']),
        "success_rate": round(completed / (completed + failed) * 100, 1) if (completed + failed) else None,
        "seedlings_endorsed": sum(r["seedlings_endorsed"] for r in rows),
        "planted": all_planted,
        "survived": all_survived,
        "dead": all_dead,
        "survival_rate": all_rate,
        "planted_hectares": round(sum(r["planted_hectares"] or 0 for r in rows), 2),
        "avg_completed_duration_days": round(sum(durations) / len(durations)) if durations else None,
        "groups": len({r["group_name"] for r in rows}),
    }

    # ── Monthly: submitted (by created date), completed/failed (by closed date) ──
    months = _month_range(date_from, date_to)
    monthly = {k: {"submitted": 0, "completed": 0, "failed": 0} for k in months}
    for r in rows:
        sub = _parse_date(r["submitted"])
        if sub and (sub.year, sub.month) in monthly:
            monthly[(sub.year, sub.month)]["submitted"] += 1
        closed = _parse_date(r["closed_date"])
        if closed and (closed.year, closed.month) in monthly and r["status"] in ('completed', 'failed'):
            monthly[(closed.year, closed.month)][r["status"]] += 1
    monthly_list = [{"month": _month_label(k), **v} for k, v in monthly.items()]
    progress_trend = _progress_trend(events, months)

    # ── By barangay ──
    brgy = {}
    for r in rows:
        name = r["barangay"] or "Unassigned"
        b = brgy.setdefault(name, {"name": name, "programs": 0, "completed": 0, "failed": 0,
                                   "ongoing": 0, "planted": 0, "dead": 0})
        b["programs"] += 1
        if r["status"] == 'completed':
            b["completed"] += 1
        elif r["status"] == 'failed':
            b["failed"] += 1
        elif r["status"] in PROGRAM_STATUS_GROUPS['ongoing']:
            b["ongoing"] += 1
        b["planted"] += r["planted"]
        b["dead"] += r["dead"]
    by_barangay = []
    for b in sorted(brgy.values(), key=lambda x: -x["programs"]):
        _, _, rate = _survival(b["planted"], b["dead"])
        by_barangay.append({**b, "survival_rate": rate})

    status_breakdown = [
        {"name": "Completed", "value": completed, "fill": "#059669"},
        {"name": "Ongoing", "value": summary["ongoing"], "fill": "#6366f1"},
        {"name": "Pending", "value": summary["pending"], "fill": "#f59e0b"},
        {"name": "Failed", "value": failed, "fill": "#ef4444"},
        {"name": "Rejected", "value": summary["rejected"], "fill": "#f87171"},
        {"name": "Cancelled", "value": summary["cancelled"], "fill": "#9ca3af"},
    ]

    return JsonResponse({
        "summary": summary,
        "status_breakdown": status_breakdown,
        "monthly": monthly_list,
        "progress_trend": progress_trend,
        "by_barangay": by_barangay,
        "rows": rows,
        "truncated": len(rows) >= MAX_ROWS,
    }, status=200)


# ─────────────────────────────────────────────────────────────
# SITES REPORT
# ─────────────────────────────────────────────────────────────
@csrf_exempt
def get_sites_report(request):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    if not _auth(request):
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    monitoring_status = request.GET.get('monitoring_status', '').strip()
    barangay_id = request.GET.get('barangay', '').strip()
    area_id = request.GET.get('area', '').strip()
    land_class = request.GET.get('land_classification', '').strip()
    search = request.GET.get('search', '').strip()
    attention = request.GET.get('attention', '').strip()  # overdue | low_survival | no_visit
    # Dates only set the months shown in the progress trend
    date_from = _parse_date(request.GET.get('date_from'))
    date_to = _parse_date(request.GET.get('date_to'))

    qs = (Sites.objects
          .filter(is_active=True, meta_verification__status='verified', status__in=OFFICIAL_SITE_STATUSES)
          .select_related('reforestation_area__barangay', 'meta_verification__verified_land_classification')
          .prefetch_related(
              Prefetch('applications',
                       queryset=Application.objects.select_related('user__tree_grower_group').order_by('-created_at')),
              Prefetch('progress_reports',
                       queryset=ProgressReport.objects.filter(status='accepted').prefetch_related('report_species'),
                       to_attr='accepted_reports'),
          )
          .order_by('reforestation_area__barangay__name', 'name'))

    if monitoring_status in MONITORING_STATUS_SHORT:
        qs = qs.filter(monitoring_status=monitoring_status)
    if barangay_id:
        qs = qs.filter(reforestation_area__barangay_id=barangay_id)
    if area_id:
        qs = qs.filter(reforestation_area_id=area_id)
    qs = _filter_land_class(qs, '', land_class)
    if search:
        qs = qs.filter(Q(name__icontains=search) | Q(reforestation_area__name__icontains=search))

    today = timezone.localdate()
    rows = []
    events = []   # (visit date, site id, planted, dead, planted area) for the progress trend
    for site in qs[:MAX_ROWS]:
        apps = list(site.applications.all())
        active = next((a for a in apps if a.status in ('for_evaluation', 'for_head', 'accepted', 'under_monitoring')), None)
        finished = [a for a in apps if a.status in ('completed', 'failed')]

        planted = dead = 0
        last_visit = None
        planted_area = None
        site_events = []
        for r in sorted(site.accepted_reports, key=lambda r: r.submitted_at or r.created_at):
            p, d = _report_totals(r)
            planted, dead = planted + p, dead + d
            last_visit = r.submitted_at or r.created_at
            if r.planted_area_hectares:
                planted_area = r.planted_area_hectares
            site_events.append((_local_date(last_visit), site.site_id, p, d, r.planted_area_hectares))
        total, survived, rate = _survival(planted, dead)
        last_visit_date = _local_date(last_visit)
        days_since = (today - last_visit_date).days if last_visit_date else None
        overdue = site.monitoring_status == 'under_monitoring' and days_since is not None and days_since > OVERDUE_VISIT_DAYS
        no_visit = site.monitoring_status == 'under_monitoring' and last_visit is None

        if attention == 'overdue' and not overdue:
            continue
        if attention == 'no_visit' and not no_visit:
            continue
        if attention == 'low_survival' and not (rate is not None and rate < 70):
            continue

        mv = getattr(site, 'meta_verification', None)
        rows.append({
            "site_id": site.site_id,
            "name": site.name,
            "reforestation_area": site.reforestation_area.name if site.reforestation_area else None,
            "barangay": _barangay_name(site),
            "approval_status": site.get_status_display(),
            "monitoring_status": site.monitoring_status,
            "monitoring_label": MONITORING_STATUS_SHORT.get(site.monitoring_status, site.monitoring_status),
            "hectares": round(site.total_area_hectares or 0, 2),
            "land_classification": (mv.verified_land_classification.name
                                    if mv and mv.verified_land_classification else None),
            "verified_at": _iso(mv.verified_at) if mv else None,
            "programs_total": len(apps),
            "programs_completed": sum(1 for a in apps if a.status == 'completed'),
            "programs_failed": sum(1 for a in apps if a.status == 'failed'),
            "current_program": active.title if active else None,
            "current_group": _group_name(active.user) if active else None,
            "last_outcome": (PROGRAM_STATUS_LABELS[finished[0].status] if finished else None),
            "planted": total,
            "survived": survived,
            "dead": dead,
            "survival_rate": rate,
            "planted_hectares": round(planted_area, 2) if planted_area else None,
            "visits": len(site.accepted_reports),
            "last_visit": _iso(last_visit),
            "days_since_visit": days_since,
            "overdue": overdue,
            "no_visit": no_visit,
        })
        events.extend(site_events)

    status_breakdown = []
    colors = {'available': '#10b981', 'reserved': '#f59e0b', 'under_monitoring': '#6366f1',
              'completed': '#059669', 'failed': '#ef4444', 'onhold': '#9ca3af'}
    for key, label in MONITORING_STATUS_SHORT.items():
        group = [r for r in rows if r["monitoring_status"] == key]
        status_breakdown.append({
            "key": key, "name": label, "value": len(group),
            "hectares": round(sum(r["hectares"] for r in group), 2), "fill": colors[key],
        })

    brgy = {}
    for r in rows:
        name = r["barangay"] or "Unassigned"
        b = brgy.setdefault(name, {"name": name, "sites": 0, "hectares": 0.0, "planted_hectares": 0.0})
        b["sites"] += 1
        b["hectares"] += r["hectares"]
        b["planted_hectares"] += r["planted_hectares"] or 0
    by_barangay = [
        {**b, "hectares": round(b["hectares"], 2), "planted_hectares": round(b["planted_hectares"], 2)}
        for b in sorted(brgy.values(), key=lambda x: -x["hectares"])
    ]

    land = {}
    for r in rows:
        name = r["land_classification"] or "Unclassified"
        land[name] = land.get(name, 0) + 1
    land_classification = [{"name": k, "value": v} for k, v in sorted(land.items(), key=lambda x: -x[1])]

    all_planted = sum(r["planted"] for r in rows)
    all_dead = sum(r["dead"] for r in rows)
    _, all_survived, all_rate = _survival(all_planted, all_dead)

    summary = {
        "survived": all_survived,
        "dead": all_dead,
        "total_sites": len(rows),
        "total_hectares": round(sum(r["hectares"] for r in rows), 2),
        "planted_hectares": round(sum(r["planted_hectares"] or 0 for r in rows), 2),
        "under_monitoring": sum(1 for r in rows if r["monitoring_status"] == 'under_monitoring'),
        "available": sum(1 for r in rows if r["monitoring_status"] == 'available'),
        "completed": sum(1 for r in rows if r["monitoring_status"] == 'completed'),
        "overdue": sum(1 for r in rows if r["overdue"]),
        "no_visit": sum(1 for r in rows if r["no_visit"]),
        "planted": all_planted,
        "survival_rate": all_rate,
        "programs_completed": sum(r["programs_completed"] for r in rows),
        "overdue_days": OVERDUE_VISIT_DAYS,
    }

    return JsonResponse({
        "summary": summary,
        "status_breakdown": status_breakdown,
        "by_barangay": by_barangay,
        "land_classification": land_classification,
        "progress_trend": _progress_trend(events, _month_range(date_from, date_to)),
        "rows": rows,
    }, status=200)


# ─────────────────────────────────────────────────────────────
# OPERATIONS STATUS (Data Manager: totals and activity over time)
# ─────────────────────────────────────────────────────────────
REQUEST_STATUS_STYLE = {
    'pending':   ('Pending review',     '#f59e0b'),
    'accepted':  ('Awaiting handover',  '#3b82f6'),
    'confirmed': ('Handed over',        '#10b981'),
    'rejected':  ('Rejected',           '#ef4444'),
    'cancelled': ('Cancelled',          '#9ca3af'),
}
VISIT_STATUS_STYLE = {
    'pending':  ('Pending review',    '#f59e0b'),
    'accepted': ('Accepted',          '#10b981'),
    'rejected': ('Changes requested', '#ef4444'),
}
PROGRAM_GROUP_STYLE = {
    'pending':   ('Pending review', '#f59e0b'),
    'ongoing':   ('Ongoing',        '#6366f1'),
    'completed': ('Completed',      '#059669'),
    'failed':    ('Failed',         '#ef4444'),
    'rejected':  ('Rejected',       '#f87171'),
    'cancelled': ('Cancelled',      '#9ca3af'),
}
SITE_STATUS_COLORS = {'available': '#10b981', 'reserved': '#f59e0b', 'under_monitoring': '#6366f1',
                      'completed': '#059669', 'failed': '#ef4444', 'onhold': '#9ca3af'}


@csrf_exempt
def get_status_report(request):
    """
    What is going on right now: programs, official sites, seedling requests and
    monitoring visits by status, plus how many of each came in per month.
    Barangay / area filter everything; dates filter programs, requests and
    visits by when they were created (sites are a current snapshot).
    """
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    if not _auth(request):
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    barangay_id = request.GET.get('barangay', '').strip()
    area_id = request.GET.get('area', '').strip()
    land_class = request.GET.get('land_classification', '').strip()
    date_from = _parse_date(request.GET.get('date_from'))
    date_to = _parse_date(request.GET.get('date_to'))

    def scoped(qs, site_path, dated=True):
        if barangay_id:
            qs = qs.filter(**{f'{site_path}__reforestation_area__barangay_id': barangay_id})
        if area_id:
            qs = qs.filter(**{f'{site_path}__reforestation_area_id': area_id})
        qs = _filter_land_class(qs, site_path, land_class)
        if dated and date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        if dated and date_to:
            qs = qs.filter(created_at__date__lte=date_to)
        return qs

    programs = scoped(Application.objects.all(), 'site')
    requests_qs = scoped(SeedlingRequest.objects.all(), 'application__site')
    visits = scoped(ProgressReport.objects.all(), 'site')
    # Official sites are a current snapshot, so no date filter
    sites = Sites.objects.filter(is_active=True, meta_verification__status='verified',
                                 status__in=OFFICIAL_SITE_STATUSES)
    if barangay_id:
        sites = sites.filter(reforestation_area__barangay_id=barangay_id)
    if area_id:
        sites = sites.filter(reforestation_area_id=area_id)
    sites = _filter_land_class(sites, '', land_class)

    # ── Status breakdowns ──
    app_counts = {r['status']: r['n'] for r in programs.values('status').annotate(n=Count('application_id'))}
    program_breakdown = [
        {"key": k, "name": label, "fill": color,
         "value": sum(app_counts.get(st, 0) for st in PROGRAM_STATUS_GROUPS[k])}
        for k, (label, color) in PROGRAM_GROUP_STYLE.items()
    ]
    site_rows = {r['monitoring_status']: r for r in sites.values('monitoring_status')
                 .annotate(n=Count('site_id'), ha=Coalesce(Sum('total_area_hectares'), Value(0.0)))}
    site_breakdown = [
        {"key": k, "name": label, "fill": SITE_STATUS_COLORS[k],
         "value": site_rows[k]['n'] if k in site_rows else 0,
         "hectares": round(site_rows[k]['ha'], 2) if k in site_rows else 0.0}
        for k, label in MONITORING_STATUS_SHORT.items()
    ]
    req_counts = {r['status']: r['n'] for r in requests_qs.values('status').annotate(n=Count('seedling_request_id'))}
    request_breakdown = [{"key": k, "name": label, "fill": color, "value": req_counts.get(k, 0)}
                         for k, (label, color) in REQUEST_STATUS_STYLE.items()]
    visit_counts = {r['status']: r['n'] for r in visits.values('status').annotate(n=Count('progress_report_id'))}
    visit_breakdown = [{"key": k, "name": label, "fill": color, "value": visit_counts.get(k, 0)}
                       for k, (label, color) in VISIT_STATUS_STYLE.items()]

    # ── Seedling request records ──
    request_rows = []
    for req in (requests_qs.select_related('application__user__tree_grower_group',
                                           'application__site__reforestation_area__barangay',
                                           'assigned_inspector__profile')
                .prefetch_related('seedling_species').order_by('-created_at')[:MAX_ROWS]):
        app = req.application
        site = app.site if app else None
        released = (sum(sp.quantity or 0 for sp in req.seedling_species.all())
                    if req.status in SEEDLING_RELEASED_STATUSES else 0)
        request_rows.append({
            "id": req.seedling_request_id,
            "date": _iso(req.created_at),
            "program": f"APP-{app.application_id:04d}" if app else None,
            "group_name": _group_name(app.user) if app else None,
            "site_id": site.site_id if site else None,
            "site_name": site.name if site else None,
            "barangay": _barangay_name(site),
            "requested": req.no_request_seedling or 0,
            "released": released,
            "status": req.status,
            "status_label": REQUEST_STATUS_STYLE.get(req.status, (req.status, ''))[0],
            "inspector": _person_name(req.assigned_inspector) if req.assigned_inspector else None,
        })

    # ── Activity per month ──
    months = _month_range(date_from, date_to)
    monthly = {k: {"programs": 0, "requests": 0, "visits": 0} for k in months}
    for key, qs in (("programs", programs), ("requests", requests_qs), ("visits", visits)):
        for row in qs.annotate(m=TruncMonth('created_at')).values('m').annotate(n=Count('pk')):
            if row['m'] and (row['m'].year, row['m'].month) in monthly:
                monthly[(row['m'].year, row['m'].month)][key] += row['n']

    summary = {
        "programs": sum(app_counts.values()),
        "programs_pending": program_breakdown[0]["value"],
        "programs_ongoing": program_breakdown[1]["value"],
        "sites": sum(r['n'] for r in site_rows.values()),
        "site_hectares": round(sum(r['ha'] for r in site_rows.values()), 2),
        "sites_under_monitoring": site_rows['under_monitoring']['n'] if 'under_monitoring' in site_rows else 0,
        "sites_available": site_rows['available']['n'] if 'available' in site_rows else 0,
        "requests": sum(req_counts.values()),
        "requests_pending": req_counts.get('pending', 0),
        "requests_awaiting_handover": req_counts.get('accepted', 0),
        "seedlings_requested": sum(r["requested"] for r in request_rows),
        "seedlings_released": sum(r["released"] for r in request_rows),
        "visits": sum(visit_counts.values()),
        "visits_pending": visit_counts.get('pending', 0),
        "visits_changes_requested": visit_counts.get('rejected', 0),
    }

    return JsonResponse({
        "summary": summary,
        "program_status": program_breakdown,
        "site_status": site_breakdown,
        "request_status": request_breakdown,
        "visit_status": visit_breakdown,
        "monthly": [{"month": _month_label(k), **v} for k, v in monthly.items()],
        "requests": request_rows,
    }, status=200)


# ─────────────────────────────────────────────────────────────
# SITE HISTORY (timeline for one site)
# ─────────────────────────────────────────────────────────────
@csrf_exempt
def get_site_history(request, site_id):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    if not _auth(request):
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    site = (Sites.objects
            .select_related('reforestation_area__barangay', 'meta_verification__verified_by__profile',
                            'meta_verification__verified_land_classification')
            .filter(site_id=site_id).first())
    if not site:
        return JsonResponse({'error': 'Site not found'}, status=404)

    events = []

    def add(when, kind, title, detail=None, tone='info'):
        if when:
            events.append({"date": _iso(when), "sort": when if isinstance(when, datetime) else
                           timezone.make_aware(datetime(when.year, when.month, when.day)),
                           "kind": kind, "title": title, "detail": detail, "tone": tone})

    add(site.created_at, 'site', 'Site created', site.reforestation_area.name if site.reforestation_area else None)
    mv = getattr(site, 'meta_verification', None)
    if mv and mv.verified_at:
        add(mv.verified_at, 'site', f"Site data {mv.get_status_display().lower()}",
            f"by {_person_name(mv.verified_by)}" if mv.verified_by else None,
            'success' if mv.status == 'verified' else 'warning')

    apps = list(Application.objects.filter(site=site)
                .select_related('user__tree_grower_group')
                .prefetch_related(
                    Prefetch('progress_reports',
                             queryset=ProgressReport.objects.filter(status='accepted').prefetch_related('report_species'),
                             to_attr='accepted_reports'),
                    Prefetch('seedling_requests',
                             queryset=SeedlingRequest.objects.filter(status__in=SEEDLING_RELEASED_STATUSES)
                             .prefetch_related('seedling_species'),
                             to_attr='released_requests'),
                    'closure_requests', 'progress_reports')
                .order_by('created_at'))

    programs = []
    for app in apps:
        ref = f"APP-{app.application_id:04d}"
        group = _group_name(app.user)
        grp = getattr(app.user, 'tree_grower_group', None)
        add(app.created_at, 'program', f"{ref} submitted", f"{app.title} · {group}")
        if app.confirmed_at:
            add(app.confirmed_at, 'program', f"{ref} approved by Head", None, 'success')
        if app.orientation_date:
            add(app.orientation_date, 'program', f"{ref} orientation", None)
        for c in app.closure_requests.all():
            add(c.requested_at, 'closure',
                f"{ref} closure recommended: {c.get_recommendation_display()}", c.recommendation_reason, 'warning')
            if c.decided_at:
                add(c.decided_at, 'closure', f"{ref} closure {c.get_status_display().lower()}",
                    c.head_notes, 'success' if c.final_outcome == 'completed' else
                    'danger' if c.final_outcome == 'failed' else 'info')
        closed = _closed_date(app)
        if app.status in ('rejected', 'cancelled'):
            add(closed, 'program', f"{ref} {app.status}", None, 'danger')

        planted = dead = 0
        for r in app.accepted_reports:
            p, d = _report_totals(r)
            planted, dead = planted + p, dead + d
        total, survived, rate = _survival(planted, dead)
        released = sum(sp.quantity or 0 for req in app.released_requests for sp in req.seedling_species.all())
        start = app.orientation_date or app.confirmed_at or _local_date(app.created_at)
        end_date = closed or (timezone.localdate() if app.status in ('accepted', 'under_monitoring') else None)
        programs.append({
            "application_id": app.application_id,
            "ref": ref,
            "title": app.title,
            "group_name": group,
            "group_type": grp.get_group_type_display() if grp else None,
            "group_contact": grp.contact if grp else None,
            "group_address": grp.address if grp else None,
            "group_email": app.user.email if app.user else None,
            "classification": app.get_classification_display(),
            "participants": app.total_treegrowers_will_participate,
            "status": app.status,
            "status_label": PROGRAM_STATUS_LABELS.get(app.status, app.status),
            "submitted": _iso(app.created_at),
            "orientation_date": _iso(app.orientation_date),
            "closed_date": _iso(closed),
            "duration_days": (end_date - start).days if start and end_date and end_date >= start else None,
            "seedlings_released": released,
            "planted": total,
            "survived": survived,
            "dead": dead,
            "survival_rate": rate,
            "visits": len(app.accepted_reports),
            "reports_total": len(app.progress_reports.all()),
            "closure_note": _closure_note(app),
        })

    visits = []
    polygon_history = []
    site_reports = list(ProgressReport.objects.filter(site=site)
                        .select_related('submitted_by__profile', 'gis_reviewed_by__profile',
                                        'application__user__tree_grower_group')
                        .prefetch_related('report_species')
                        .order_by('-created_at'))
    for r in site_reports:
        p, d = _report_totals(r)
        when = r.submitted_at or r.created_at
        visit_label = r.get_visit_type_display().split(' (')[0]
        visits.append({
            "id": r.progress_report_id,
            "date": _iso(when),
            "visit_type": visit_label,
            "status": r.status,
            "program": f"APP-{r.application.application_id:04d}" if r.application else None,
            "program_title": r.application.title if r.application else None,
            "group_name": _group_name(r.application.user) if r.application else None,
            "linked": r.application_id is not None,
            "inspector": _person_name(r.submitted_by),
            "planted": p, "dead": d,
            "planted_hectares": round(r.planted_area_hectares, 4) if r.planted_area_hectares else None,
            "dm_review": r.get_dm_review_status_display(),
            "gis_review": r.get_gis_review_status_display(),
            "has_polygon": bool(r.polygon_coordinates),
        })
        if r.polygon_coordinates:
            polygon_history.append({
                "id": r.progress_report_id,
                "date": _iso(when),
                "visit_type": visit_label,
                "status": r.status,
                "gis_review": r.get_gis_review_status_display(),
                "program": f"APP-{r.application.application_id:04d}" if r.application else None,
                "planted_hectares": round(r.planted_area_hectares, 4) if r.planted_area_hectares else None,
                "polygon": r.polygon_coordinates,
            })
        if r.status == 'accepted':
            detail = f"{p} planted · {d} dead · by {_person_name(r.submitted_by)}"
            if not r.application_id:
                detail += " · not linked to a program"
            add(when, 'visit', f"{visit_label} accepted", detail, 'success')
        if r.gis_reviewed_at and r.gis_review_status in ('approved', 'changes_requested'):
            area_txt = f"{r.planted_area_hectares:.2f} ha planted polygon" if r.planted_area_hectares else "Planted polygon"
            add(r.gis_reviewed_at, 'gis',
                'Planted area confirmed by GIS' if r.gis_review_status == 'approved'
                else 'Planted area: GIS requested changes',
                f"{area_txt} · by {_person_name(r.gis_reviewed_by)}"
                + (f" · {r.gis_review_notes}" if r.gis_review_notes else ""),
                'success' if r.gis_review_status == 'approved' else 'warning')
    polygon_history.reverse()  # oldest first

    # Running totals per accepted visit (oldest first) for the trend chart
    progress_trend = []
    run_p = run_d = 0
    latest_area = None
    for r in reversed(site_reports):
        if r.status != 'accepted':
            continue
        p, d = _report_totals(r)
        run_p, run_d = run_p + p, run_d + d
        if r.planted_area_hectares:
            latest_area = r.planted_area_hectares
        total, survived, rate = _survival(run_p, run_d)
        when = _local_date(r.submitted_at or r.created_at)
        short_type = {'initial': 'Initial', 'ongoing': 'Ongoing', 'inactive_check': 'Check'}.get(r.visit_type, r.visit_type)
        progress_trend.append({
            "date": _iso(when),
            "label": f"{when.strftime('%b %d')} · {short_type}",
            "planted": total,
            "alive": survived,
            "dead": run_d,
            "survival_rate": rate,
            "planted_hectares": round(latest_area, 4) if latest_area else None,
        })

    if site.updated_at and site.updated_at - site.created_at > timedelta(minutes=5):
        add(site.updated_at, 'site', 'Site record last updated', None)

    events.sort(key=lambda e: e["sort"], reverse=True)
    for e in events:
        e.pop("sort")

    # ── Totals for the metric strip ──
    accepted = [v for v in visits if v["status"] == 'accepted']
    all_p = sum(v["planted"] for v in accepted)
    all_d = sum(v["dead"] for v in accepted)
    total_plants, alive, survival = _survival(all_p, all_d)
    site_ha = site.total_area_hectares or 0
    last_visit = accepted[0]["date"] if accepted else None
    metrics = {
        "site_hectares": round(site_ha, 2),
        "planted_hectares": round(latest_area, 4) if latest_area else None,
        "coverage_pct": round(latest_area / site_ha * 100, 1) if latest_area and site_ha > 0 else None,
        "plants_planted": total_plants,
        "plants_alive": alive,
        "plants_dead": all_d,
        "added_by_growers": 0,
        "survival_rate": survival,
        "programs": len(programs),
        "programs_completed": sum(1 for p in programs if p["status"] == 'completed'),
        "programs_failed": sum(1 for p in programs if p["status"] == 'failed'),
        "programs_active": sum(1 for p in programs if p["status"] in ('accepted', 'under_monitoring')),
        "groups": len({p["group_name"] for p in programs}),
        "seedlings_released": sum(p["seedlings_released"] for p in programs),
        "visits_total": len(visits),
        "visits_accepted": len(accepted),
        "visits_unlinked": sum(1 for v in visits if not v["linked"]),
        "last_visit": last_visit,
        "days_since_visit": (timezone.localdate() - _parse_date(last_visit)).days if last_visit else None,
    }

    return JsonResponse({
        "site": {
            "site_id": site.site_id,
            "name": site.name,
            "reforestation_area": site.reforestation_area.name if site.reforestation_area else None,
            "reforestation_area_id": site.reforestation_area_id,
            "barangay": _barangay_name(site),
            "hectares": round(site_ha, 2),
            "approval_status": site.get_status_display(),
            "status": site.status,
            "official": bool(mv and mv.status == 'verified' and site.status in OFFICIAL_SITE_STATUSES),
            "monitoring_status": site.monitoring_status,
            "monitoring_label": MONITORING_STATUS_SHORT.get(site.monitoring_status, site.monitoring_status),
            "land_classification": (mv.verified_land_classification.name
                                    if mv and mv.verified_land_classification else None),
            "verified_by": _person_name(mv.verified_by) if mv and mv.verified_by else None,
            "verified_at": _iso(mv.verified_at) if mv else None,
            "created_at": _iso(site.created_at),
            "polygon": site.polygon_coordinates,
        },
        "metrics": metrics,
        "polygon_history": polygon_history,
        "progress_trend": progress_trend,
        "programs": list(reversed(programs)),
        "visits": visits,
        "timeline": events,
    }, status=200)


# ─────────────────────────────────────────────────────────────
# MONITORING VISITS REPORT
# ─────────────────────────────────────────────────────────────
@csrf_exempt
def get_visits_report(request):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    if not _auth(request):
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    visit_type = request.GET.get('visit_type', '').strip()
    status = request.GET.get('status', '').strip()
    barangay_id = request.GET.get('barangay', '').strip()
    area_id = request.GET.get('area', '').strip()
    land_class = request.GET.get('land_classification', '').strip()
    search = request.GET.get('search', '').strip()
    date_from = _parse_date(request.GET.get('date_from'))
    date_to = _parse_date(request.GET.get('date_to'))

    qs = (ProgressReport.objects
          .select_related('site__reforestation_area__barangay', 'application__user__tree_grower_group',
                          'submitted_by__profile')
          .prefetch_related('report_species')
          .order_by('-created_at'))
    if visit_type in ('initial', 'ongoing', 'inactive_check'):
        qs = qs.filter(visit_type=visit_type)
    if status in ('accepted', 'pending', 'rejected'):
        qs = qs.filter(status=status)
    if barangay_id:
        qs = qs.filter(site__reforestation_area__barangay_id=barangay_id)
    if area_id:
        qs = qs.filter(site__reforestation_area_id=area_id)
    qs = _filter_land_class(qs, 'site', land_class)
    if search:
        qs = qs.filter(
            Q(site__name__icontains=search)
            | Q(application__title__icontains=search)
            | Q(application__user__tree_grower_group__group_name__icontains=search)
        )
    if date_from:
        qs = qs.filter(created_at__date__gte=date_from)
    if date_to:
        qs = qs.filter(created_at__date__lte=date_to)

    rows = []
    for r in qs[:MAX_ROWS]:
        p, d = _report_totals(r)
        when = r.submitted_at or r.created_at
        rows.append({
            "id": r.progress_report_id,
            "date": _iso(when),
            "site_id": r.site_id,
            "site_name": r.site.name if r.site else None,
            "barangay": _barangay_name(r.site),
            "program": f"APP-{r.application.application_id:04d}" if r.application else None,
            "group_name": _group_name(r.application.user) if r.application else None,
            "visit_type": r.visit_type,
            "visit_label": r.get_visit_type_display().split(' (')[0],
            "status": r.status,
            "dm_review": r.get_dm_review_status_display(),
            "gis_review": r.get_gis_review_status_display(),
            "inspector": _person_name(r.submitted_by),
            "planted": p,
            "dead": d,
            "planted_hectares": round(r.planted_area_hectares, 2) if r.planted_area_hectares else None,
        })

    months = _month_range(date_from, date_to)
    monthly = {k: {"accepted": 0, "pending": 0, "rejected": 0} for k in months}
    for r in rows:
        d = _parse_date(r["date"])
        if d and (d.year, d.month) in monthly and r["status"] in monthly[(d.year, d.month)]:
            monthly[(d.year, d.month)][r["status"]] += 1

    inspectors = {}
    for r in rows:
        i = inspectors.setdefault(r["inspector"], {"name": r["inspector"], "visits": 0, "accepted": 0})
        i["visits"] += 1
        i["accepted"] += 1 if r["status"] == 'accepted' else 0

    accepted = [r for r in rows if r["status"] == 'accepted']
    summary = {
        "total": len(rows),
        "accepted": len(accepted),
        "pending": sum(1 for r in rows if r["status"] == 'pending'),
        "rejected": sum(1 for r in rows if r["status"] == 'rejected'),
        "initial": sum(1 for r in rows if r["visit_type"] == 'initial'),
        "ongoing": sum(1 for r in rows if r["visit_type"] == 'ongoing'),
        "inactive_check": sum(1 for r in rows if r["visit_type"] == 'inactive_check'),
        "sites_visited": len({r["site_id"] for r in rows if r["site_id"]}),
        "planted_recorded": sum(r["planted"] for r in accepted),
        "dead_recorded": sum(r["dead"] for r in accepted),
        "inspectors": len(inspectors),
    }

    return JsonResponse({
        "summary": summary,
        "monthly": [{"month": _month_label(k), **v} for k, v in monthly.items()],
        "by_inspector": sorted(inspectors.values(), key=lambda x: -x["visits"]),
        "rows": rows,
    }, status=200)


# ─────────────────────────────────────────────────────────────
# SPECIES REPORT
# ─────────────────────────────────────────────────────────────
@csrf_exempt
def get_species_report(request):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    if not _auth(request):
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    barangay_id = request.GET.get('barangay', '').strip()
    area_id = request.GET.get('area', '').strip()
    land_class = request.GET.get('land_classification', '').strip()
    date_from = _parse_date(request.GET.get('date_from'))
    date_to = _parse_date(request.GET.get('date_to'))

    endorsed_qs = (SeedlingRequestSpecies.objects
                   .filter(seedling_request__status__in=SEEDLING_RELEASED_STATUSES)
                   .select_related('tree_species'))
    report_qs = (ProgressReportSpecies.objects
                 .filter(progress_report__status='accepted')
                 .select_related('tree_species', 'progress_report'))
    if barangay_id:
        endorsed_qs = endorsed_qs.filter(
            seedling_request__application__site__reforestation_area__barangay_id=barangay_id)
        report_qs = report_qs.filter(progress_report__site__reforestation_area__barangay_id=barangay_id)
    if area_id:
        endorsed_qs = endorsed_qs.filter(seedling_request__application__site__reforestation_area_id=area_id)
        report_qs = report_qs.filter(progress_report__site__reforestation_area_id=area_id)
    endorsed_qs = _filter_land_class(endorsed_qs, 'seedling_request__application__site', land_class)
    report_qs = _filter_land_class(report_qs, 'progress_report__site', land_class)
    if date_from:
        endorsed_qs = endorsed_qs.filter(seedling_request__created_at__date__gte=date_from)
        report_qs = report_qs.filter(progress_report__created_at__date__gte=date_from)
    if date_to:
        endorsed_qs = endorsed_qs.filter(seedling_request__created_at__date__lte=date_to)
        report_qs = report_qs.filter(progress_report__created_at__date__lte=date_to)

    species = {}

    def entry(sp):
        name = sp.name if sp else 'Unknown'
        return species.setdefault(name, {"name": name, "endorsed": 0, "planted": 0, "dead": 0, "sites": set()})

    for row in endorsed_qs:
        entry(row.tree_species)["endorsed"] += row.quantity or 0
    for row in report_qs:
        e = entry(row.tree_species)
        e["planted"] += row.no_planted or 0
        e["dead"] += row.no_dead or 0
        if row.progress_report.site_id:
            e["sites"].add(row.progress_report.site_id)

    rows = []
    for e in species.values():
        total, survived, rate = _survival(e["planted"], e["dead"])
        rows.append({
            "name": e["name"],
            "endorsed": e["endorsed"],
            "planted": total,
            "survived": survived,
            "dead": e["dead"],
            "survival_rate": rate,
            "sites": len(e["sites"]),
        })
    rows.sort(key=lambda r: (-r["planted"], -r["endorsed"]))

    all_planted = sum(r["planted"] for r in rows)
    all_dead = sum(r["dead"] for r in rows)
    _, all_survived, all_rate = _survival(all_planted, all_dead)
    rated = [r for r in rows if r["survival_rate"] is not None and r["planted"] >= 10]
    summary = {
        "species_count": len(rows),
        "endorsed": sum(r["endorsed"] for r in rows),
        "planted": all_planted,
        "survived": all_survived,
        "dead": all_dead,
        "survival_rate": all_rate,
        "best_species": max(rated, key=lambda r: r["survival_rate"])["name"] if rated else None,
        "worst_species": min(rated, key=lambda r: r["survival_rate"])["name"] if rated else None,
    }

    return JsonResponse({"summary": summary, "rows": rows}, status=200)