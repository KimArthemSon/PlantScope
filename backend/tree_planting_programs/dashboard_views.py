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
    Reason, ProgressReport
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


def _survival(planted, added, dead):
    """Same formula as the site monitoring report: (planted + added - dead) / (planted + added)."""
    total = planted + added
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
        rp = ra = rd = 0
        for sp in r.report_species.all():
            p, a, d = sp.no_planted or 0, sp.no_added_by_grower or 0, sp.no_dead or 0
            rp, ra, rd = rp + p, ra + a, rd + d
            name = sp.tree_species.name if sp.tree_species else "Unknown"
            spec = per_species.setdefault(name, {"planted": 0, "added": 0, "dead": 0})
            spec["planted"] += p
            spec["added"] += a
            spec["dead"] += d
        r._totals = (rp, ra, rd)

        s = per_site.setdefault(r.site_id, {
            "site": r.site, "planted": 0, "added": 0, "dead": 0,
            "visits": 0, "last_visit": None, "area": None,
        })
        s["planted"] += rp
        s["added"] += ra
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

    run_planted = run_added = run_dead = 0
    site_area, site_seedlings, planted_sites = {}, {}, set()
    planting_trend = []
    ptr = 0
    for key in month_keys:
        new_seedlings = new_dead = new_sites = visits = 0
        while ptr < len(reports) and _month_key(_report_date(reports[ptr])) <= key:
            r = reports[ptr]
            ptr += 1
            rp, ra, rd = r._totals
            run_planted, run_added, run_dead = run_planted + rp, run_added + ra, run_dead + rd
            site_seedlings[r.site_id] = site_seedlings.get(r.site_id, 0) + rp + ra
            if r.planted_area_hectares:
                site_area[r.site_id] = r.planted_area_hectares
            is_new_site = r.site_id not in planted_sites and (rp + ra > 0 or r.visit_type == 'initial')
            if is_new_site:
                planted_sites.add(r.site_id)
            if _month_key(_report_date(r)) == key:
                new_seedlings += rp + ra
                new_dead += rd
                visits += 1
                new_sites += 1 if is_new_site else 0

        total, survived, rate = _survival(run_planted, run_added, run_dead)
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
        total, survived, rate = _survival(s["planted"], s["added"], s["dead"])
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
        total, survived, rate = _survival(sp["planted"], sp["added"], sp["dead"])
        if total == 0:
            continue
        survival_by_species.append({
            "name": name, "planted": total, "survived": survived,
            "dead": sp["dead"], "rate": rate,
        })
    survival_by_species.sort(key=lambda x: -x["planted"])
    survival_by_species = survival_by_species[:8]

    # ── Summary ──
    all_planted = sum(s["planted"] + s["added"] for s in per_site.values())
    all_dead = sum(s["dead"] for s in per_site.values())
    _, all_survived, all_rate = _survival(all_planted, 0, all_dead)
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
    completed_sites = Sites.objects.filter(monitoring_status='completed').count()

    areas_assessed = SiteMetaDataVerification.objects.filter(status='verified').count()
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
    # 5. APPROVAL RATE TREND
    # ═══════════════════════════════════════════════════════════
    approval_rate = [
        {
            "month": e['month'].strftime('%b'),
            "rate": int(round((e['approved'] / e['submitted'] * 100), 0)) if e['submitted'] > 0 else 0
        }
        for e in monthly_apps_list
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
    all_apps = [
        _format_app(a) for a in
        Application.objects.select_related('site__reforestation_area__barangay')
        .order_by('-created_at')[:20]
    ]

    # ═══════════════════════════════════════════════════════════
    # 8. ASSESSORS (OnsiteInspectors)
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
    # 10. SITE VERIFICATION PIPELINE
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
            "completed_sites": completed_sites,
            "total_seedlings_planted": summary["total_planted"],
            "total_area_planted": summary["planted_hectares"],
            "areas_assessed": areas_assessed,
            "assessors": assessors_count,
            "trees_endorsed": trees_endorsed,
            "overall_survival_rate": summary["survival_rate"],
            "official_sites": summary["official_sites"],
            "official_hectares": summary["official_hectares"],
        },
        "application_trend": application_trend,
        "status_data": status_data,
        "assessment_data": assessment_data,
        "approval_rate": approval_rate,
        "recent_activities": recent_activities,
        "recent_apps": recent_apps,
        "all_apps": all_apps,
        "assessors": assessors,
        "seedling_request_pipeline": seedling_pipeline,
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