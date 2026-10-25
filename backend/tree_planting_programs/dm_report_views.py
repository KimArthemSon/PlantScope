"""
Data Manager reports.

Every endpoint takes optional filters as query params and returns:
  - "summary": totals for the filtered set
  - chart data (monthly / per barangay / per status)
  - "rows": every matching record (not paginated, so exports include everything)

Survival uses the same formula as the site monitoring report:
  survived = (planted + added) - dead,   rate = survived / (planted + added)
"""
from datetime import datetime, date, timedelta

from django.db.models import Q, Prefetch
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt

from accounts.helper import get_user_from_token
from barangay.models import Barangay
from Field_assessment.models import Field_assessment
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


def _survival(planted, added, dead):
    total = planted + added
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
    planted = added = dead = 0
    for sp in report.report_species.all():
        planted += sp.no_planted or 0
        added += sp.no_added_by_grower or 0
        dead += sp.no_dead or 0
    return planted, added, dead


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


@csrf_exempt
def get_programs_report(request):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    if not _auth(request):
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    status_group = request.GET.get('status', 'all').strip().lower()
    barangay_id = request.GET.get('barangay', '').strip()
    classification = request.GET.get('classification', '').strip()
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
    for app in qs[:MAX_ROWS * 2]:
        closed = _closed_date(app)
        if date_basis == 'closed' and (date_from or date_to) and not _in_range(closed, date_from, date_to):
            continue

        planted = added = dead = 0
        last_visit = None
        planted_area = None
        for r in sorted(app.accepted_reports, key=lambda r: r.submitted_at or r.created_at):
            p, a, d = _report_totals(r)
            planted, added, dead = planted + p, added + a, dead + d
            last_visit = r.submitted_at or r.created_at
            if r.planted_area_hectares:
                planted_area = r.planted_area_hectares
        total, survived, rate = _survival(planted, added, dead)

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
        if len(rows) >= MAX_ROWS:
            break

    # ── Summary ──
    def count(statuses):
        return sum(1 for r in rows if r["status"] in statuses)

    completed = count(PROGRAM_STATUS_GROUPS['completed'])
    failed = count(PROGRAM_STATUS_GROUPS['failed'])
    all_planted = sum(r["planted"] for r in rows)
    all_dead = sum(r["dead"] for r in rows)
    _, all_survived, all_rate = _survival(all_planted, 0, all_dead)
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
        _, _, rate = _survival(b["planted"], 0, b["dead"])
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
    search = request.GET.get('search', '').strip()
    attention = request.GET.get('attention', '').strip()  # overdue | low_survival | no_visit

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
    if search:
        qs = qs.filter(Q(name__icontains=search) | Q(reforestation_area__name__icontains=search))

    today = timezone.localdate()
    rows = []
    for site in qs[:MAX_ROWS]:
        apps = list(site.applications.all())
        active = next((a for a in apps if a.status in ('for_evaluation', 'for_head', 'accepted', 'under_monitoring')), None)
        finished = [a for a in apps if a.status in ('completed', 'failed')]

        planted = added = dead = 0
        last_visit = None
        planted_area = None
        for r in sorted(site.accepted_reports, key=lambda r: r.submitted_at or r.created_at):
            p, a, d = _report_totals(r)
            planted, added, dead = planted + p, added + a, dead + d
            last_visit = r.submitted_at or r.created_at
            if r.planted_area_hectares:
                planted_area = r.planted_area_hectares
        total, survived, rate = _survival(planted, added, dead)
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
    _, _, all_rate = _survival(all_planted, 0, all_dead)

    summary = {
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
        "rows": rows,
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

        planted = added = dead = 0
        for r in app.accepted_reports:
            p, a, d = _report_totals(r)
            planted, added, dead = planted + p, added + a, dead + d
        total, survived, rate = _survival(planted, added, dead)
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
        p, a, d = _report_totals(r)
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
            "planted": p, "added": a, "dead": d,
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
            detail = f"{p + a} planted/added · {d} dead · by {_person_name(r.submitted_by)}"
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
    run_p = run_a = run_d = 0
    latest_area = None
    for r in reversed(site_reports):
        if r.status != 'accepted':
            continue
        p, a, d = _report_totals(r)
        run_p, run_a, run_d = run_p + p, run_a + a, run_d + d
        if r.planted_area_hectares:
            latest_area = r.planted_area_hectares
        total, survived, rate = _survival(run_p, run_a, run_d)
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

    assessments = []
    for fa in (Field_assessment.objects.filter(site=site, is_submitted=True)
               .select_related('assigned_onsite_inspector__user__profile', 'land_classification')
               .prefetch_related('images')
               .order_by('-created_at')):
        data = fa.field_assessment_data or {}
        layers = [label for key, label in (('meta_data', 'Meta'), ('safety', 'Safety'),
                                           ('survivability', 'Survivability'),
                                           ('boundary_verification', 'Boundary')) if data.get(key)]
        inspector = fa.assigned_onsite_inspector.user if fa.assigned_onsite_inspector else None
        when = fa.sent_date or fa.created_at
        photos = fa.images.count()
        assessments.append({
            "id": fa.field_assessment_id,
            "title": fa.title or f"Assessment #{fa.field_assessment_id}",
            "date": _iso(when),
            "inspector": _person_name(inspector),
            "layers": layers,
            "photos": photos,
            "land_classification": fa.land_classification.name if fa.land_classification else None,
        })
        add(when, 'assessment', 'Field assessment submitted',
            f"{', '.join(layers) or 'No layers'} · {photos} photos · by {_person_name(inspector)}")
    if site.updated_at and site.updated_at - site.created_at > timedelta(minutes=5):
        add(site.updated_at, 'site', 'Site record last updated', None)

    events.sort(key=lambda e: e["sort"], reverse=True)
    for e in events:
        e.pop("sort")

    # ── Totals for the metric strip ──
    accepted = [v for v in visits if v["status"] == 'accepted']
    all_p = sum(v["planted"] for v in accepted)
    all_a = sum(v["added"] for v in accepted)
    all_d = sum(v["dead"] for v in accepted)
    total_plants, alive, survival = _survival(all_p, all_a, all_d)
    site_ha = site.total_area_hectares or 0
    last_visit = accepted[0]["date"] if accepted else None
    metrics = {
        "site_hectares": round(site_ha, 2),
        "planted_hectares": round(latest_area, 4) if latest_area else None,
        "coverage_pct": round(latest_area / site_ha * 100, 1) if latest_area and site_ha > 0 else None,
        "plants_planted": total_plants,
        "plants_alive": alive,
        "plants_dead": all_d,
        "added_by_growers": all_a,
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
        "assessments": len(assessments),
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
        "assessments": assessments,
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
        p, a, d = _report_totals(r)
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
            "added": a,
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
        "planted_recorded": sum(r["planted"] + r["added"] for r in accepted),
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
    if date_from:
        endorsed_qs = endorsed_qs.filter(seedling_request__created_at__date__gte=date_from)
        report_qs = report_qs.filter(progress_report__created_at__date__gte=date_from)
    if date_to:
        endorsed_qs = endorsed_qs.filter(seedling_request__created_at__date__lte=date_to)
        report_qs = report_qs.filter(progress_report__created_at__date__lte=date_to)

    species = {}

    def entry(sp):
        name = sp.name if sp else 'Unknown'
        return species.setdefault(name, {"name": name, "endorsed": 0, "planted": 0, "added": 0,
                                         "dead": 0, "sites": set()})

    for row in endorsed_qs:
        entry(row.tree_species)["endorsed"] += row.quantity or 0
    for row in report_qs:
        e = entry(row.tree_species)
        e["planted"] += row.no_planted or 0
        e["added"] += row.no_added_by_grower or 0
        e["dead"] += row.no_dead or 0
        if row.progress_report.site_id:
            e["sites"].add(row.progress_report.site_id)

    rows = []
    for e in species.values():
        total, survived, rate = _survival(e["planted"], e["added"], e["dead"])
        rows.append({
            "name": e["name"],
            "endorsed": e["endorsed"],
            "planted": total,
            "added_by_grower": e["added"],
            "survived": survived,
            "dead": e["dead"],
            "survival_rate": rate,
            "sites": len(e["sites"]),
        })
    rows.sort(key=lambda r: (-r["planted"], -r["endorsed"]))

    all_planted = sum(r["planted"] for r in rows)
    all_dead = sum(r["dead"] for r in rows)
    _, all_survived, all_rate = _survival(all_planted, 0, all_dead)
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
