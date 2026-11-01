"""
City ENRO Head dashboard — oversight of every office's work.

Tabs served by one endpoint:
  executive   decisions waiting, organisation KPIs, program lifecycle, monthly trend,
              backlog per office (Data Manager, GIS, field inspectors), recent activity
  approvals   applications waiting for Head approval + program closure requests
  performance planting/survival trend, program outcomes, species, sites needing attention
  growers     every tree grower group with programs, survival and visit compliance
  coverage    barangay coverage: sites, official/planted hectares, programs, survival

Survival and planted area use the same calculations as the Data Manager and GIS
dashboards (see dashboard_views._build_monitoring_data), so all roles see the same numbers.
"""
from datetime import date, timedelta

from django.db.models import Count, Max, Prefetch, Q, Sum, Value
from django.db.models.functions import Coalesce
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt

from accounts.helper import get_user_from_token
from accounts.models import TreeGrowerGroup, User
from Field_assessment.models import Field_assessment
from reforestation_areas.models import Reforestation_areas
from sites.models import SiteMetaDataVerification, Sites
from sites.views import OFFICIAL_SITE_STATUSES

from .dashboard_views import (
    LOW_SURVIVAL_THRESHOLD, OVERDUE_VISIT_DAYS, _build_monitoring_data, _survival, _time_ago,
)
from .models import (
    Application, ProgramClosureRequest, ProgressReport, Reason, SeedlingRequest,
)

SEEDLING_RELEASED = ['accepted', 'confirmed']
ACTIVE_APP = ['accepted', 'under_monitoring']
COMPLIANT_DAYS = 60
INSPECTOR_ACTIVE_DAYS = 30

STATUS_LABEL = {
    'for_evaluation': 'For Evaluation',
    'for_head': 'Waiting for Head',
    'accepted': 'Accepted',
    'under_monitoring': 'Under Monitoring',
    'completed': 'Completed',
    'failed': 'Failed',
    'rejected': 'Rejected',
    'cancelled': 'Cancelled',
}
STATUS_COLOR = {
    'for_evaluation': '#fbbf24',
    'for_head': '#f97316',
    'accepted': '#38bdf8',
    'under_monitoring': '#6366f1',
    'completed': '#059669',
    'failed': '#ef4444',
    'rejected': '#f87171',
    'cancelled': '#9ca3af',
}
ROLE_LABEL = {
    'DataManager': 'Data Manager',
    'CityENROHead': 'City ENRO Head',
    'GISSpecialist': 'GIS Specialist',
    'OnsiteInspector': 'Onsite Inspector',
    'treeGrowers': 'Tree Grower',
}


def _local_date(dt):
    if not dt:
        return None
    return timezone.localtime(dt).date() if timezone.is_aware(dt) else dt.date() if hasattr(dt, 'date') else dt


def _iso(dt):
    d = _local_date(dt) if hasattr(dt, 'hour') else dt
    return d.isoformat() if d else None


def _person(user):
    if not user:
        return '—'
    profile = getattr(user, 'profile', None)
    if profile and getattr(profile, 'first_name', None):
        return f'{profile.first_name} {profile.last_name}'.strip()
    return user.email.split('@')[0]


def _group_name(user):
    grp = getattr(user, 'tree_grower_group', None) if user else None
    return grp.group_name if grp else (user.email if user else 'Unknown')


def _barangay(site):
    if site and site.reforestation_area and site.reforestation_area.barangay:
        return site.reforestation_area.barangay.name
    return None


def _report_totals(report):
    p = d = 0
    for sp in report.report_species.all():
        p += sp.no_planted or 0
        d += sp.no_dead or 0
    return p, d


def _closed_date(app):
    approved = [c for c in app.closure_requests.all() if c.status == 'approved' and c.decided_at]
    if approved:
        return _local_date(max(approved, key=lambda c: c.decided_at).decided_at)
    if app.status in ('completed', 'failed', 'rejected', 'cancelled'):
        return _local_date(app.updated_at)
    return None


def _month_keys(today, n=12):
    keys, y, m = [], today.year, today.month
    for _ in range(n):
        keys.append((y, m))
        m -= 1
        if m == 0:
            y, m = y - 1, 12
    return list(reversed(keys))


def load_programs():
    """Every application with its planting results, released seedlings and closing date."""
    apps = list(
        Application.objects
        .select_related('user__tree_grower_group', 'site__reforestation_area__barangay',
                        'site__meta_verification__verified_land_classification')
        .prefetch_related(
            Prefetch('progress_reports',
                     queryset=ProgressReport.objects.filter(status='accepted').prefetch_related('report_species'),
                     to_attr='accepted_reports'),
            Prefetch('seedling_requests',
                     queryset=SeedlingRequest.objects.filter(status__in=SEEDLING_RELEASED)
                     .prefetch_related('seedling_species'),
                     to_attr='released_requests'),
            'closure_requests',
        )
    )
    app_stats = {}
    for app in apps:
        p = d = 0
        last_visit = None
        for r in app.accepted_reports:
            rp, rd = _report_totals(r)
            p, d = p + rp, d + rd
            when = r.submitted_at or r.created_at
            if last_visit is None or when > last_visit:
                last_visit = when
        total, alive, rate = _survival(p, d)
        released = sum(sp.quantity or 0 for req in app.released_requests for sp in req.seedling_species.all())
        closed = _closed_date(app)
        start = app.orientation_date or app.confirmed_at or _local_date(app.created_at)
        app_stats[app.application_id] = {
            'planted': total, 'alive': alive, 'dead': d, 'rate': rate,
            'released': released, 'visits': len(app.accepted_reports),
            'last_visit': last_visit, 'closed': closed,
            'duration': (closed - start).days if closed and start and closed >= start else None,
        }
    return apps, app_stats


def build_grower_rows(apps, app_stats, groups, now):
    """One row per tree grower group: programs, planting results, compliance and standing."""
    apps_by_user = {}
    for a in apps:
        apps_by_user.setdefault(a.user_id, []).append(a)
    rows = []
    for g in groups:
        g_apps = apps_by_user.get(g.users_id, [])
        p = d = 0
        released = visits = 0
        last_visit = None
        for a in g_apps:
            st = app_stats[a.application_id]
            p += st['planted']
            d += st['dead']
            released += st['released']
            visits += st['visits']
            if st['last_visit'] and (last_visit is None or st['last_visit'] > last_visit):
                last_visit = st['last_visit']
        _, alive, rate = _survival(p, d)
        active = [a for a in g_apps if a.status in ACTIVE_APP]
        days = (now - last_visit).days if last_visit else None
        if not active:
            compliance = 'No active program'
        elif days is not None and days <= COMPLIANT_DAYS:
            compliance = 'Compliant'
        elif days is not None and days <= OVERDUE_VISIT_DAYS:
            compliance = 'Warning'
        else:
            compliance = 'Non-Compliant'
        n_failed = sum(1 for a in g_apps if a.status == 'failed')
        n_completed = sum(1 for a in g_apps if a.status == 'completed')
        if not g_apps:
            standing = 'New'
        elif (rate is not None and rate < 50) or compliance == 'Non-Compliant' or n_failed > n_completed:
            standing = 'Needs attention'
        elif rate is not None and rate >= 80 and n_failed == 0:
            standing = 'Excellent'
        else:
            standing = 'Good'
        barangays = sorted({_barangay(a.site) for a in g_apps if _barangay(a.site)})
        rows.append({
            'group_id': g.group_id,
            'group_name': g.group_name,
            'group_type': g.get_group_type_display(),
            'contact': g.contact,
            'address': g.address,
            'email': g.users.email if g.users else None,
            'joined': _iso(g.created_at),
            'programs': len(g_apps),
            'active': len(active),
            'completed': n_completed,
            'failed': n_failed,
            'rejected': sum(1 for a in g_apps if a.status in ('rejected', 'cancelled')),
            'current_site': active[0].site.name if active and active[0].site else None,
            'current_site_id': active[0].site_id if active else None,
            'barangays': barangays,
            'barangay_ids': sorted({a.site.reforestation_area.barangay_id for a in g_apps
                                    if a.site and a.site.reforestation_area and a.site.reforestation_area.barangay_id}),
            'seedlings_released': released,
            'planted': p,
            'alive': alive,
            'dead': d,
            'survival_rate': rate,
            'visits': visits,
            'last_visit': _iso(last_visit),
            'days_since_visit': days,
            'compliance': compliance,
            'standing': standing,
        })
    rows.sort(key=lambda r: (-r['active'], -r['programs'], r['group_name']))
    return rows


@csrf_exempt
def get_head_dashboard_data(request):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    try:
        user = get_user_from_token(request)
    except Exception:
        user = None
    if not user or user.user_role != 'CityENROHead':
        return JsonResponse({'error': 'Unauthorized: Head only'}, status=403)

    now = timezone.now()
    today = timezone.localdate()
    month_start = today.replace(day=1)

    monitoring = _build_monitoring_data(now)
    ms = monitoring['monitoring_summary']

    apps, app_stats = load_programs()

    count = {s: 0 for s in STATUS_LABEL}
    for app in apps:
        count[app.status] = count.get(app.status, 0) + 1
    completed, failed = count['completed'], count['failed']

    # ── Decisions waiting for the Head ─────────────────────────────────────
    pending_apps = [a for a in apps if a.status == 'for_head']
    forwarded_at = {
        r['application_id']: r['last']
        for r in Reason.objects.filter(status='for_head', application__status='for_head')
        .values('application_id').annotate(last=Max('created'))
    }

    group_history = {}
    for app in apps:
        h = group_history.setdefault(app.user_id, {'completed': 0, 'failed': 0, 'total': 0})
        h['total'] += 1
        if app.status in ('completed', 'failed'):
            h[app.status] += 1

    pending_approvals = []
    for app in sorted(pending_apps, key=lambda x: forwarded_at.get(x.application_id) or x.updated_at):
        since = forwarded_at.get(app.application_id) or app.updated_at
        site = app.site
        mv = getattr(site, 'meta_verification', None) if site else None
        hist = group_history.get(app.user_id, {})
        grp = getattr(app.user, 'tree_grower_group', None)
        pending_approvals.append({
            'application_id': app.application_id,
            'ref': f'APP-{app.application_id:04d}',
            'title': app.title,
            'group_name': _group_name(app.user),
            'group_type': grp.get_group_type_display() if grp else None,
            'classification': app.get_classification_display(),
            'participants': app.total_treegrowers_will_participate,
            'site_id': site.site_id if site else None,
            'site_name': site.name if site else None,
            'barangay': _barangay(site),
            'site_hectares': round(site.total_area_hectares or 0, 2) if site else None,
            'site_verified': bool(mv and mv.status == 'verified'),
            'land_classification': mv.verified_land_classification.name if mv and mv.verified_land_classification else None,
            'orientation_date': _iso(app.orientation_date or app.proposed_orientation_date),
            'previous_programs': hist.get('total', 1) - 1,
            'previous_completed': hist.get('completed', 0),
            'previous_failed': hist.get('failed', 0),
            'days_waiting': (now - since).days if since else 0,
            'submitted': _iso(app.created_at),
        })

    pending_closures = []
    for c in (ProgramClosureRequest.objects.filter(status='pending')
              .select_related('application__user__tree_grower_group', 'site__reforestation_area__barangay',
                              'requested_by__profile')
              .order_by('requested_at')):
        st = app_stats.get(c.application_id, {})
        pending_closures.append({
            'id': c.closure_request_id,
            'ref': f'APP-{c.application_id:04d}',
            'title': c.application.title,
            'group_name': _group_name(c.application.user),
            'site_id': c.site_id,
            'site_name': c.site.name if c.site else None,
            'barangay': _barangay(c.site),
            'recommendation': c.get_recommendation_display(),
            'recommendation_key': c.recommendation,
            'reason': c.recommendation_reason,
            'requested_by': _person(c.requested_by),
            'days_waiting': (now - c.requested_at).days,
            'planted': st.get('planted', 0),
            'survival_rate': st.get('rate'),
            'visits': st.get('visits', 0),
        })

    # ── Office backlogs ────────────────────────────────────────────────────
    inspectors = list(User.objects.filter(user_role='OnsiteInspector', is_active=True).values_list('id', flat=True))
    last_fa = dict(Field_assessment.objects.filter(is_submitted=True, assigned_onsite_inspector__user_id__in=inspectors)
                   .values_list('assigned_onsite_inspector__user_id').annotate(last=Max('created_at')))
    last_pr = dict(ProgressReport.objects.filter(submitted_by_id__in=inspectors)
                   .values_list('submitted_by_id').annotate(last=Max('created_at')))
    active_cutoff = now - timedelta(days=INSPECTOR_ACTIVE_DAYS)
    active_inspectors = sum(
        1 for uid in inspectors
        if max([d for d in (last_fa.get(uid), last_pr.get(uid)) if d], default=None) and
        max([d for d in (last_fa.get(uid), last_pr.get(uid)) if d]) >= active_cutoff
    )

    offices = [
        {
            'office': 'Data Manager',
            'items': [
                {'label': 'Applications to evaluate', 'value': count['for_evaluation']},
                {'label': 'Seedling requests to review', 'value': SeedlingRequest.objects.filter(status='pending').count()},
                {'label': 'Progress reports to review',
                 'value': ProgressReport.objects.filter(status='pending', dm_review_status='pending').count()},
                {'label': 'Closures returned by Head',
                 'value': ProgramClosureRequest.objects.filter(status='returned').count()},
            ],
        },
        {
            'office': 'GIS Specialist',
            'items': [
                {'label': 'Planted areas to confirm',
                 'value': ProgressReport.objects.filter(polygon_coordinates__isnull=False, status='pending',
                                                        dm_review_status='approved', gis_review_status='pending').count()},
                {'label': 'Site data to verify',
                 'value': SiteMetaDataVerification.objects.filter(status='pending', site__is_active=True).count()},
                {'label': 'Sites without a boundary',
                 'value': Sites.objects.filter(is_active=True).filter(Q(total_area_hectares__lte=0) | Q(polygon_coordinates__isnull=True)).count()},
            ],
        },
        {
            'office': 'Field Inspectors',
            'items': [
                {'label': f'Inspectors active ({INSPECTOR_ACTIVE_DAYS}d)', 'value': active_inspectors,
                 'total': len(inspectors), 'good': True},
                {'label': f'Sites overdue for a visit (> {OVERDUE_VISIT_DAYS}d)', 'value': ms['overdue_sites']},
                {'label': 'Monitored sites never visited', 'value': ms['sites_without_visit']},
                {'label': 'Seedling handovers to confirm', 'value': SeedlingRequest.objects.filter(status='accepted').count()},
            ],
        },
    ]
    for o in offices:
        o['backlog'] = sum(i['value'] for i in o['items'] if not i.get('good'))

    # ── Monthly trend (last 12 months) ─────────────────────────────────────
    keys = _month_keys(today)
    monthly = {k: {'submitted': 0, 'approved': 0, 'completed': 0, 'failed': 0} for k in keys}
    for app in apps:
        for field, bucket in ((_local_date(app.created_at), 'submitted'), (app.confirmed_at, 'approved')):
            if field and (field.year, field.month) in monthly:
                monthly[(field.year, field.month)][bucket] += 1
        closed = app_stats[app.application_id]['closed']
        if closed and app.status in ('completed', 'failed') and (closed.year, closed.month) in monthly:
            monthly[(closed.year, closed.month)][app.status] += 1
    planting = monitoring['planting_trend']  # same 12 months, same order
    trend = []
    for i, k in enumerate(keys):
        pt = planting[i] if i < len(planting) else {}
        trend.append({
            'month': date(k[0], k[1], 1).strftime("%b '%y"),
            **monthly[k],
            'planted_hectares': pt.get('cumulative_hectares', 0),
            'plants': pt.get('cumulative_seedlings', 0),
            'alive': pt.get('cumulative_survived', 0),
            'dead': max(0, pt.get('cumulative_seedlings', 0) - pt.get('cumulative_survived', 0)),
            'new_plants': pt.get('new_seedlings', 0),
            'new_dead': pt.get('new_dead', 0),
            'new_sites': pt.get('new_sites', 0),
            'sites_planted': pt.get('cumulative_sites', 0),
            'visits': pt.get('visits', 0),
            'survival_rate': pt.get('survival_rate'),
        })

    # ── Recent activity (decisions across offices) ─────────────────────────
    activity = []
    for r in Reason.objects.select_related('user__profile', 'application').order_by('-created')[:10]:
        tone = ('success' if r.status in ('accepted', 'completed', 'under_monitoring')
                else 'danger' if r.status in ('rejected', 'failed', 'cancelled')
                else 'warning' if r.status == 'for_head' else 'info')
        activity.append({
            'when': r.created, 'tone': tone,
            'ref': f'APP-{r.application.application_id:04d}' if r.application else '—',
            'action': f'{r.get_status_layer_display()}: {r.get_status_display()}',
            'detail': (r.reason or '')[:90] or None,
            'actor': _person(r.user), 'role': ROLE_LABEL.get(r.user.user_role, r.user.user_role) if r.user else '',
        })
    for c in (ProgramClosureRequest.objects.filter(decided_at__isnull=False)
              .select_related('application', 'decided_by__profile').order_by('-decided_at')[:5]):
        activity.append({
            'when': c.decided_at, 'tone': 'success' if c.status == 'approved' else 'warning',
            'ref': f'APP-{c.application_id:04d}',
            'action': f'Closure {c.get_status_display().lower()}' + (f' ({c.get_final_outcome_display()})' if c.final_outcome else ''),
            'detail': (c.head_notes or '')[:90] or None,
            'actor': _person(c.decided_by), 'role': 'City ENRO Head',
        })
    activity.sort(key=lambda x: x['when'], reverse=True)
    recent_activity = [{**{k: v for k, v in a.items() if k != 'when'}, 'time': _time_ago(a['when'])} for a in activity[:10]]

    # ── Executive KPIs ─────────────────────────────────────────────────────
    groups = list(TreeGrowerGroup.objects.select_related('users'))
    active_group_users = {a.user_id for a in apps if a.status in ACTIVE_APP}
    released_total = sum(s['released'] for s in app_stats.values())
    kpis = {
        'pending_approvals': len(pending_approvals),
        'oldest_approval_days': pending_approvals[0]['days_waiting'] if pending_approvals else None,
        'pending_closures': len(pending_closures),
        'oldest_closure_days': pending_closures[0]['days_waiting'] if pending_closures else None,
        'active_programs': count['accepted'] + count['under_monitoring'],
        'awaiting_orientation': count['accepted'],
        'completed_programs': completed,
        'failed_programs': failed,
        'rejected_cancelled': count['rejected'] + count['cancelled'],
        'success_rate': round(completed / (completed + failed) * 100, 1) if (completed + failed) else None,
        'total_applications': len(apps),
        'groups': len(groups),
        'groups_active': sum(1 for g in groups if g.users_id in active_group_users),
        'groups_new_month': sum(1 for g in groups if _local_date(g.created_at) and _local_date(g.created_at) >= month_start),
        'official_sites': ms['official_sites'],
        'official_hectares': ms['official_hectares'],
        'available_sites': ms['available_sites'],
        'planted_hectares': ms['planted_hectares'],
        'plants_planted': ms['total_planted'],
        'plants_alive': ms['total_survived'],
        'plants_dead': ms['total_dead'],
        'survival_rate': ms['survival_rate'],
        'survival_target': LOW_SURVIVAL_THRESHOLD,
        'seedlings_released': released_total,
        'reforestation_areas': Reforestation_areas.objects.filter(deleted_at__isnull=True).count(),
    }

    lifecycle = [
        {'key': k, 'name': STATUS_LABEL[k], 'value': count.get(k, 0), 'fill': STATUS_COLOR[k]}
        for k in ['for_evaluation', 'for_head', 'accepted', 'under_monitoring', 'completed', 'failed', 'rejected', 'cancelled']
    ]

    # ── Performance: program outcomes ──────────────────────────────────────
    finished = sorted(
        [a for a in apps if a.status in ('completed', 'failed')],
        key=lambda a: app_stats[a.application_id]['closed'] or _local_date(a.updated_at), reverse=True,
    )[:10]
    program_outcomes = [{
        'ref': f'APP-{a.application_id:04d}',
        'title': a.title,
        'group_name': _group_name(a.user),
        'site_id': a.site_id,
        'site_name': a.site.name if a.site else None,
        'barangay': _barangay(a.site),
        'status': a.status,
        'status_label': STATUS_LABEL[a.status],
        'closed': _iso(app_stats[a.application_id]['closed']),
        'duration_days': app_stats[a.application_id]['duration'],
        'planted': app_stats[a.application_id]['planted'],
        'survival_rate': app_stats[a.application_id]['rate'],
    } for a in finished]

    active_programs = sorted(
        [a for a in apps if a.status in ACTIVE_APP],
        key=lambda a: (app_stats[a.application_id]['rate'] is None, app_stats[a.application_id]['rate'] or 0),
    )
    active_rows = []
    for a in active_programs:
        st = app_stats[a.application_id]
        days = (now - st['last_visit']).days if st['last_visit'] else None
        active_rows.append({
            'ref': f'APP-{a.application_id:04d}',
            'title': a.title,
            'group_name': _group_name(a.user),
            'site_id': a.site_id,
            'site_name': a.site.name if a.site else None,
            'barangay': _barangay(a.site),
            'status_label': STATUS_LABEL[a.status],
            'orientation_date': _iso(a.orientation_date),
            'released': st['released'],
            'planted': st['planted'],
            'survival_rate': st['rate'],
            'visits': st['visits'],
            'days_since_visit': days,
            'overdue': a.status == 'under_monitoring' and (days is None or days > OVERDUE_VISIT_DAYS),
        })

    grower_rows = build_grower_rows(apps, app_stats, groups, now)

    # ── Site uptake: official sites taken by tree growers vs never taken ──
    CURRENT = ['for_evaluation', 'for_head', 'accepted', 'under_monitoring']
    PAST = ['completed', 'failed']
    apps_by_site = {}
    for a in apps:
        if a.site_id:
            apps_by_site.setdefault(a.site_id, []).append(a)
    uptake_rows = []
    for site in (Sites.objects.filter(is_active=True, meta_verification__status='verified',
                                      status__in=OFFICIAL_SITE_STATUSES)
                 .select_related('reforestation_area__barangay')):
        s_apps = sorted(apps_by_site.get(site.site_id, []), key=lambda a: a.created_at, reverse=True)
        current = next((a for a in s_apps if a.status in CURRENT), None)
        past = [a for a in s_apps if a.status in PAST]
        if current:
            category = 'taken_now'
        elif past:
            category = 'taken_before'
        else:
            category = 'no_history'
        last_past = past[0] if past else None
        uptake_rows.append({
            'site_id': site.site_id,
            'name': site.name,
            'barangay': _barangay(site),
            'hectares': round(site.total_area_hectares or 0, 2),
            'category': category,
            'group_name': _group_name(current.user) if current else (_group_name(last_past.user) if last_past else None),
            'program_status': STATUS_LABEL.get(current.status) if current else (STATUS_LABEL.get(last_past.status) if last_past else None),
            'programs_before': len(past),
            'groups_before': len({a.user_id for a in past}),
            'last_closed': _iso(app_stats[last_past.application_id]['closed']) if last_past else None,
        })
    uptake_rows.sort(key=lambda r: (['taken_now', 'taken_before', 'no_history'].index(r['category']), r['name']))

    def _uptake(cat, label, color):
        rows = [r for r in uptake_rows if r['category'] == cat]
        return {'key': cat, 'name': label, 'fill': color, 'value': len(rows),
                'hectares': round(sum(r['hectares'] for r in rows), 2)}

    site_uptake = {
        'total': len(uptake_rows),
        'hectares': round(sum(r['hectares'] for r in uptake_rows), 2),
        'breakdown': [
            _uptake('taken_now', 'Taken now', '#6366f1'),
            _uptake('taken_before', 'Taken before', '#10b981'),
            _uptake('no_history', 'No history', '#d1d5db'),
        ],
        'rows': uptake_rows,
    }

    # ── Barangay coverage ──────────────────────────────────────────────────
    coverage = {}

    def brgy(name):
        return coverage.setdefault(name, {
            'name': name, 'areas': 0, 'sites': 0, 'official_sites': 0, 'official_hectares': 0.0,
            'planted_hectares': 0.0, 'active_programs': 0, 'completed': 0, 'failed': 0,
            'planted': 0, 'dead': 0,
        })

    for ra in Reforestation_areas.objects.filter(deleted_at__isnull=True).select_related('barangay'):
        brgy(ra.barangay.name if ra.barangay else 'Unassigned')['areas'] += 1
    for s in (Sites.objects.filter(is_active=True)
              .select_related('reforestation_area__barangay', 'meta_verification')):
        b = brgy(_barangay(s) or 'Unassigned')
        b['sites'] += 1
        mv = getattr(s, 'meta_verification', None)
        if mv and mv.status == 'verified' and s.status in OFFICIAL_SITE_STATUSES:
            b['official_sites'] += 1
            b['official_hectares'] += s.total_area_hectares or 0
    # Planted area, plants and deaths per barangay come from site visits (same as the overall totals)
    for name, e in monitoring['planted_by_barangay'].items():
        b = brgy(name)
        b['planted_hectares'] += e['hectares']
        b['planted'] += e['planted']
        b['dead'] += e['dead']
    for a in apps:
        b = brgy(_barangay(a.site) or 'Unassigned')
        st = app_stats[a.application_id]
        if a.status in ACTIVE_APP:
            b['active_programs'] += 1
        elif a.status in ('completed', 'failed'):
            b[a.status] += 1
    coverage_rows = []
    for b in coverage.values():
        _, _, rate = _survival(b['planted'], b['dead'])
        coverage_rows.append({**b, 'official_hectares': round(b['official_hectares'], 2),
                              'planted_hectares': round(b['planted_hectares'], 2), 'survival_rate': rate})
    coverage_rows.sort(key=lambda r: (-r['official_hectares'], -r['sites'], r['name']))

    land = {}
    for mv in (SiteMetaDataVerification.objects.filter(status='verified', site__is_active=True)
               .select_related('verified_land_classification', 'site')):
        name = mv.verified_land_classification.name if mv.verified_land_classification else 'Unclassified'
        e = land.setdefault(name, {'name': name, 'sites': 0, 'hectares': 0.0})
        e['sites'] += 1
        e['hectares'] += mv.site.total_area_hectares or 0
    land_rows = sorted(({**v, 'hectares': round(v['hectares'], 2)} for v in land.values()), key=lambda x: -x['sites'])

    return JsonResponse({
        'executive': {
            'kpis': kpis,
            'lifecycle': lifecycle,
            'trend': trend,
            'offices': offices,
            'recent_activity': recent_activity,
            'site_uptake': site_uptake,
        },
        'approvals': {
            'pending_approvals': pending_approvals,
            'pending_closures': pending_closures,
        },
        'performance': {
            'summary': {
                'survival_rate': ms['survival_rate'],
                'survival_target': LOW_SURVIVAL_THRESHOLD,
                'plants_planted': ms['total_planted'],
                'plants_alive': ms['total_survived'],
                'planted_hectares': ms['planted_hectares'],
                'visits_last_30_days': ms['visits_last_30_days'],
                'overdue_sites': ms['overdue_sites'],
                'success_rate': kpis['success_rate'],
                'avg_completed_days': (round(sum(o['duration_days'] for o in program_outcomes if o['status'] == 'completed' and o['duration_days'] is not None)
                                             / max(1, sum(1 for o in program_outcomes if o['status'] == 'completed' and o['duration_days'] is not None)))
                                       if any(o['status'] == 'completed' and o['duration_days'] is not None for o in program_outcomes) else None),
            },
            'trend': trend,
            'species': monitoring['survival_by_species'],
            'active_programs': active_rows,
            'program_outcomes': program_outcomes,
            'top_sites': monitoring['top_performing_sites'],
            'attention_sites': monitoring['sites_needing_attention'],
        },
        'growers': {
            'summary': {
                'total': len(grower_rows),
                'active': sum(1 for r in grower_rows if r['active']),
                'new_this_month': kpis['groups_new_month'],
                'excellent': sum(1 for r in grower_rows if r['standing'] == 'Excellent'),
                'needs_attention': sum(1 for r in grower_rows if r['standing'] == 'Needs attention'),
                'non_compliant': sum(1 for r in grower_rows if r['compliance'] == 'Non-Compliant'),
                'compliant_days': COMPLIANT_DAYS,
            },
            'rows': grower_rows,
        },
        'coverage': {
            'rows': coverage_rows,
            'land_classification': land_rows,
            'summary': {
                'barangays': sum(1 for r in coverage_rows if r['name'] != 'Unassigned' and (r['sites'] or r['areas'])),
                'areas': kpis['reforestation_areas'],
                'official_hectares': kpis['official_hectares'],
                'planted_hectares': kpis['planted_hectares'],
            },
        },
    }, status=200)


"""
City ENRO Head reports (filters + full rows for PDF / Excel export).

  head_report/summary/    accomplishment report for a period (what the office achieved)
  head_report/growers/    tree grower group performance and compliance
  head_report/decisions/  the Head's own decisions: application approvals/rejections and program closures

Programs, sites, monitoring visits and species reuse the Data Manager report endpoints
(dm_report/*), which the Head can also read.
"""
from datetime import date, datetime, timedelta

from django.db.models import Q
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt

from accounts.helper import get_user_from_token
from accounts.models import TreeGrowerGroup
from Field_assessment.models import Field_assessment
from sites.models import SiteMetaDataVerification, Sites
from sites.views import OFFICIAL_SITE_STATUSES

from .dashboard_views import _survival
from .head_dashboard_views import (
    ACTIVE_APP, SEEDLING_RELEASED, STATUS_LABEL, _barangay, _group_name, _iso, _local_date, _person,
    _report_totals, build_grower_rows, load_programs,
)
from .models import ProgramClosureRequest, ProgressReport, Reason, SeedlingRequestSpecies


def _auth(request):
    try:
        user = get_user_from_token(request)
    except Exception:
        return None
    return user if user and user.user_role == 'CityENROHead' else None


def _parse_date(v):
    try:
        return datetime.strptime(v, '%Y-%m-%d').date() if v else None
    except ValueError:
        return None


def _in(d, start, end):
    return d is not None and (start is None or d >= start) and (end is None or d <= end)


def _months_between(start, end):
    keys, y, m = [], start.year, start.month
    while (y, m) <= (end.year, end.month) and len(keys) < 36:
        keys.append((y, m))
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)
    return keys


# ─────────────────────────────────────────────────────────────
# ACCOMPLISHMENT SUMMARY
# ─────────────────────────────────────────────────────────────
@csrf_exempt
def get_head_summary_report(request):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    if not _auth(request):
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    date_from = _parse_date(request.GET.get('date_from'))
    date_to = _parse_date(request.GET.get('date_to'))
    barangay_id = request.GET.get('barangay', '').strip()
    today = timezone.localdate()
    end = date_to or today

    apps, app_stats = load_programs()
    if barangay_id:
        apps = [a for a in apps if a.site and a.site.reforestation_area
                and str(a.site.reforestation_area.barangay_id) == barangay_id]

    # ── Programs in the period ──
    submitted = [a for a in apps if _in(_local_date(a.created_at), date_from, date_to)]
    approved = [a for a in apps if _in(a.confirmed_at, date_from, date_to)]
    closed = [a for a in apps if a.status in ('completed', 'failed')
              and _in(app_stats[a.application_id]['closed'], date_from, date_to)]
    completed = [a for a in closed if a.status == 'completed']
    failed = [a for a in closed if a.status == 'failed']
    rejected = [a for a in apps if a.status in ('rejected', 'cancelled')
                and _in(_local_date(a.updated_at), date_from, date_to)]
    active_now = [a for a in apps if a.status in ACTIVE_APP]
    durations = [app_stats[a.application_id]['duration'] for a in completed
                 if app_stats[a.application_id]['duration'] is not None]

    # ── Seedlings released in the period ──
    seed_qs = SeedlingRequestSpecies.objects.filter(seedling_request__status__in=SEEDLING_RELEASED)
    if barangay_id:
        seed_qs = seed_qs.filter(seedling_request__application__site__reforestation_area__barangay_id=barangay_id)
    if date_from:
        seed_qs = seed_qs.filter(seedling_request__created_at__date__gte=date_from)
    if date_to:
        seed_qs = seed_qs.filter(seedling_request__created_at__date__lte=date_to)
    released = sum(r.quantity or 0 for r in seed_qs)

    # ── Planting & survival from accepted visits ──
    rep_qs = (ProgressReport.objects.filter(status='accepted', site__isnull=False)
              .select_related('site__reforestation_area__barangay').prefetch_related('report_species__tree_species'))
    if barangay_id:
        rep_qs = rep_qs.filter(site__reforestation_area__barangay_id=barangay_id)
    reports = sorted(rep_qs, key=lambda r: r.submitted_at or r.created_at)

    def area_as_of(day):
        latest = {}
        for r in reports:
            d = _local_date(r.submitted_at or r.created_at)
            if day is not None and d > day:
                break
            if r.planted_area_hectares:
                latest[r.site_id] = r.planted_area_hectares
        return round(sum(latest.values()), 2)

    period_p = period_d = 0
    cum_p = cum_d = 0
    visits = 0
    sites_planted = set()
    species = {}
    brgy = {}
    for r in reports:
        d = _local_date(r.submitted_at or r.created_at)
        if d > end:
            continue
        p, dead = _report_totals(r)
        cum_p, cum_d = cum_p + p, cum_d + dead
        if _in(d, date_from, date_to):
            period_p, period_d = period_p + p, period_d + dead
            visits += 1
            if p > 0:
                sites_planted.add(r.site_id)
            b = brgy.setdefault(_barangay(r.site) or 'Unassigned', {'planted': 0, 'dead': 0, 'visits': 0})
            b['planted'] += p
            b['dead'] += dead
            b['visits'] += 1
            for sp in r.report_species.all():
                name = sp.tree_species.name if sp.tree_species else 'Unknown'
                e = species.setdefault(name, {'planted': 0, 'dead': 0})
                e['planted'] += sp.no_planted or 0
                e['dead'] += sp.no_dead or 0
    _, alive_end, survival_end = _survival(cum_p, cum_d)
    area_end = area_as_of(end)
    area_start = area_as_of(date_from - timedelta(days=1)) if date_from else 0.0

    # ── Sites, groups, field work in the period ──
    site_qs = Sites.objects.filter(is_active=True)
    ver_qs = SiteMetaDataVerification.objects.filter(status='verified', site__is_active=True)
    fa_qs = Field_assessment.objects.filter(is_submitted=True)
    if barangay_id:
        site_qs = site_qs.filter(reforestation_area__barangay_id=barangay_id)
        ver_qs = ver_qs.filter(site__reforestation_area__barangay_id=barangay_id)
        fa_qs = fa_qs.filter(Q(site__reforestation_area__barangay_id=barangay_id)
                             | Q(assigned_onsite_inspector__reforestation_area__barangay_id=barangay_id))
    if date_from:
        site_qs_p = site_qs.filter(created_at__date__gte=date_from)
        ver_qs = ver_qs.filter(verified_at__date__gte=date_from)
        fa_qs = fa_qs.filter(created_at__date__gte=date_from)
    else:
        site_qs_p = site_qs
    if date_to:
        site_qs_p = site_qs_p.filter(created_at__date__lte=date_to)
        ver_qs = ver_qs.filter(verified_at__date__lte=date_to)
        fa_qs = fa_qs.filter(created_at__date__lte=date_to)
    groups = TreeGrowerGroup.objects.all()
    new_groups = [g for g in groups if _in(_local_date(g.created_at), date_from, date_to)]
    official_now = site_qs.filter(meta_verification__status='verified', status__in=OFFICIAL_SITE_STATUSES)

    summary = {
        'applications_submitted': len(submitted),
        'applications_approved': len(approved),
        'rejected_cancelled': len(rejected),
        'programs_completed': len(completed),
        'programs_failed': len(failed),
        'success_rate': round(len(completed) / len(closed) * 100, 1) if closed else None,
        'avg_completion_days': round(sum(durations) / len(durations)) if durations else None,
        'active_programs_now': len(active_now),
        'seedlings_released': released,
        'plants_planted': period_p,
        'plants_dead': period_d,
        'sites_planted': len(sites_planted),
        'visits': visits,
        'planted_hectares_end': area_end,
        'planted_hectares_added': round(area_end - area_start, 2),
        'survival_rate_end': survival_end,
        'plants_alive_end': alive_end,
        'plants_total_end': cum_p,
        'new_sites': site_qs_p.count(),
        'sites_verified': ver_qs.count(),
        'official_sites_now': official_now.count(),
        'new_groups': len(new_groups),
        'field_assessments': fa_qs.count(),
    }

    # ── Monthly breakdown ──
    first = date_from
    if first is None:
        candidates = [_local_date(a.created_at) for a in apps] + \
                     [_local_date(r.submitted_at or r.created_at) for r in reports]
        first = min([d for d in candidates if d], default=end.replace(day=1))
    monthly = {k: {'submitted': 0, 'approved': 0, 'completed': 0, 'failed': 0, 'planted': 0, 'dead': 0, 'visits': 0}
               for k in _months_between(first, end)}
    for a in submitted:
        k = (_local_date(a.created_at).year, _local_date(a.created_at).month)
        if k in monthly:
            monthly[k]['submitted'] += 1
    for a in approved:
        k = (a.confirmed_at.year, a.confirmed_at.month)
        if k in monthly:
            monthly[k]['approved'] += 1
    for a in closed:
        c = app_stats[a.application_id]['closed']
        if (c.year, c.month) in monthly:
            monthly[(c.year, c.month)][a.status] += 1
    for r in reports:
        d = _local_date(r.submitted_at or r.created_at)
        if _in(d, date_from, date_to) and (d.year, d.month) in monthly:
            p, dead = _report_totals(r)
            monthly[(d.year, d.month)]['planted'] += p
            monthly[(d.year, d.month)]['dead'] += dead
            monthly[(d.year, d.month)]['visits'] += 1
    monthly_rows = [{'month': date(k[0], k[1], 1).strftime("%b %Y"), **v} for k, v in monthly.items()]

    # ── By barangay ──
    for a in apps:
        name = _barangay(a.site) or 'Unassigned'
        if a in completed or a in failed or a in approved or a in active_now:
            brgy.setdefault(name, {'planted': 0, 'dead': 0, 'visits': 0})
    by_barangay = []
    for name, b in brgy.items():
        b_apps = [a for a in apps if (_barangay(a.site) or 'Unassigned') == name]
        _, _, rate = _survival(b['planted'], b['dead'])
        by_barangay.append({
            'name': name,
            'approved': sum(1 for a in approved if a in b_apps),
            'completed': sum(1 for a in completed if a in b_apps),
            'failed': sum(1 for a in failed if a in b_apps),
            'active_now': sum(1 for a in active_now if a in b_apps),
            'planted': b['planted'],
            'dead': b['dead'],
            'visits': b['visits'],
            'survival_rate': rate,
        })
    by_barangay.sort(key=lambda r: (-r['planted'], r['name']))

    species_rows = []
    for name, e in species.items():
        _, alive, rate = _survival(e['planted'], e['dead'])
        species_rows.append({'name': name, 'planted': e['planted'], 'alive': alive, 'dead': e['dead'], 'survival_rate': rate})
    species_rows.sort(key=lambda r: -r['planted'])

    # ── Plain-language highlights for the report ──
    highlights = []
    if summary['programs_completed'] or summary['programs_failed']:
        highlights.append(f"{summary['programs_completed']} program(s) completed and {summary['programs_failed']} failed"
                          + (f" — {summary['success_rate']}% success rate." if summary['success_rate'] is not None else "."))
    if summary['plants_planted']:
        highlights.append(f"{summary['plants_planted']:,} plants recorded across {summary['sites_planted']} site(s) "
                          f"in {summary['visits']} accepted visit(s); {summary['plants_dead']:,} deaths recorded.")
    if summary['planted_hectares_added']:
        highlights.append(f"Planted area grew by {summary['planted_hectares_added']} ha to {summary['planted_hectares_end']} ha.")
    if survival_end is not None:
        highlights.append(f"Overall survival at the end of the period: {survival_end}% "
                          f"({alive_end:,} of {cum_p:,} plants alive).")
    rated = [s for s in species_rows if s['survival_rate'] is not None and s['planted'] >= 10]
    if rated:
        best = max(rated, key=lambda s: s['survival_rate'])
        highlights.append(f"Best-surviving species: {best['name']} ({best['survival_rate']}%).")
    if by_barangay and by_barangay[0]['planted']:
        highlights.append(f"Most planting happened in {by_barangay[0]['name']} ({by_barangay[0]['planted']:,} plants).")
    if summary['new_groups']:
        highlights.append(f"{summary['new_groups']} new tree grower group(s) registered.")
    if not highlights:
        highlights.append("No program activity recorded in this period.")

    return JsonResponse({
        'summary': summary,
        'highlights': highlights,
        'monthly': monthly_rows,
        'by_barangay': by_barangay,
        'species': species_rows,
        'completed_programs': [{
            'ref': f'APP-{a.application_id:04d}', 'title': a.title, 'group_name': _group_name(a.user),
            'site_name': a.site.name if a.site else None, 'barangay': _barangay(a.site),
            'status': a.status, 'status_label': STATUS_LABEL[a.status],
            'closed': _iso(app_stats[a.application_id]['closed']),
            'duration_days': app_stats[a.application_id]['duration'],
            'planted': app_stats[a.application_id]['planted'],
            'survival_rate': app_stats[a.application_id]['rate'],
        } for a in sorted(closed, key=lambda a: app_stats[a.application_id]['closed'], reverse=True)],
    }, status=200)


# ─────────────────────────────────────────────────────────────
# TREE GROWER GROUPS
# ─────────────────────────────────────────────────────────────
@csrf_exempt
def get_head_growers_report(request):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    if not _auth(request):
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    standing = request.GET.get('standing', '').strip()
    compliance = request.GET.get('compliance', '').strip()
    barangay_id = request.GET.get('barangay', '').strip()
    group_type = request.GET.get('group_type', '').strip()
    search = request.GET.get('search', '').strip().lower()
    date_from = _parse_date(request.GET.get('date_from'))
    date_to = _parse_date(request.GET.get('date_to'))

    apps, app_stats = load_programs()
    groups = list(TreeGrowerGroup.objects.select_related('users'))
    rows = build_grower_rows(apps, app_stats, groups, timezone.now())
    type_by_id = {g.group_id: g.group_type for g in groups}

    def keep(r):
        if standing and r['standing'] != standing:
            return False
        if compliance and r['compliance'] != compliance:
            return False
        if barangay_id and int(barangay_id) not in r['barangay_ids']:
            return False
        if group_type and type_by_id.get(r['group_id']) != group_type:
            return False
        if search and search not in r['group_name'].lower() and search not in (r['current_site'] or '').lower():
            return False
        if (date_from or date_to) and not _in(_parse_date(r['joined']), date_from, date_to):
            return False
        return True

    rows = [r for r in rows if keep(r)]
    planted = sum(r['planted'] for r in rows)
    dead = sum(r['dead'] for r in rows)
    _, alive, rate = _survival(planted, dead)

    def count(key, value):
        return sum(1 for r in rows if r[key] == value)

    return JsonResponse({
        'summary': {
            'total': len(rows),
            'active': sum(1 for r in rows if r['active']),
            'excellent': count('standing', 'Excellent'),
            'good': count('standing', 'Good'),
            'needs_attention': count('standing', 'Needs attention'),
            'new': count('standing', 'New'),
            'compliant': count('compliance', 'Compliant'),
            'warning': count('compliance', 'Warning'),
            'non_compliant': count('compliance', 'Non-Compliant'),
            'programs': sum(r['programs'] for r in rows),
            'completed': sum(r['completed'] for r in rows),
            'failed': sum(r['failed'] for r in rows),
            'seedlings_released': sum(r['seedlings_released'] for r in rows),
            'planted': planted,
            'alive': alive,
            'survival_rate': rate,
        },
        'standing_breakdown': [
            {'name': 'Excellent', 'value': count('standing', 'Excellent'), 'fill': '#10b981'},
            {'name': 'Good', 'value': count('standing', 'Good'), 'fill': '#38bdf8'},
            {'name': 'Needs attention', 'value': count('standing', 'Needs attention'), 'fill': '#ef4444'},
            {'name': 'New', 'value': count('standing', 'New'), 'fill': '#d1d5db'},
        ],
        'rows': rows,
    }, status=200)


# ─────────────────────────────────────────────────────────────
# HEAD DECISIONS LOG
# ─────────────────────────────────────────────────────────────
@csrf_exempt
def get_head_decisions_report(request):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    if not _auth(request):
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    kind = request.GET.get('kind', '').strip()   # application | closure
    outcome = request.GET.get('outcome', '').strip()
    search = request.GET.get('search', '').strip().lower()
    date_from = _parse_date(request.GET.get('date_from'))
    date_to = _parse_date(request.GET.get('date_to'))

    rows = []

    # Application decisions made by a Head account
    reasons = list(Reason.objects.filter(user__user_role='CityENROHead')
                   .select_related('user__profile', 'application__user__tree_grower_group',
                                   'application__site__reforestation_area__barangay')
                   .order_by('created'))
    forwarded = {}
    for r in Reason.objects.filter(status='for_head').values('application_id', 'created'):
        forwarded.setdefault(r['application_id'], []).append(r['created'])
    for r in reasons:
        app = r.application
        if not app:
            continue
        fw = [d for d in forwarded.get(app.application_id, []) if d <= r.created]
        decided = _local_date(r.created)
        decision = {'accepted': 'Approved', 'under_monitoring': 'Approved', 'rejected': 'Rejected',
                    'cancelled': 'Cancelled', 'for_evaluation': 'Returned to Data Manager',
                    'completed': 'Marked completed', 'failed': 'Marked failed'}.get(r.status, r.get_status_display())
        rows.append({
            'kind': 'application',
            'kind_label': f"{r.get_status_layer_display()} decision",
            'date': _iso(decided),
            'ref': f'APP-{app.application_id:04d}',
            'title': app.title,
            'group_name': _group_name(app.user),
            'site_id': app.site_id,
            'site_name': app.site.name if app.site else None,
            'barangay': _barangay(app.site),
            'decision': decision,
            'outcome_key': {'Approved': 'approved', 'Rejected': 'rejected', 'Cancelled': 'rejected',
                            'Returned to Data Manager': 'returned'}.get(decision, 'other'),
            'notes': r.reason,
            'decided_by': _person(r.user),
            'turnaround_days': (r.created - max(fw)).days if fw else None,
            'current_status': STATUS_LABEL.get(app.status, app.status),
        })

    # Program closure decisions
    for c in (ProgramClosureRequest.objects.filter(decided_at__isnull=False)
              .select_related('application__user__tree_grower_group', 'site__reforestation_area__barangay',
                              'decided_by__profile', 'requested_by__profile')):
        if c.status == 'approved':
            decision = f"Closure approved — {c.get_final_outcome_display() if c.final_outcome else 'closed'}"
            key = 'closure_completed' if c.final_outcome == 'completed' else 'closure_failed'
        else:
            decision = 'Closure returned to Data Manager'
            key = 'returned'
        rows.append({
            'kind': 'closure',
            'kind_label': 'Program closure',
            'date': _iso(c.decided_at),
            'ref': f'APP-{c.application_id:04d}',
            'title': c.application.title,
            'group_name': _group_name(c.application.user),
            'site_id': c.site_id,
            'site_name': c.site.name if c.site else None,
            'barangay': _barangay(c.site),
            'decision': decision,
            'outcome_key': key,
            'recommendation': c.get_recommendation_display(),
            'agreed_with_recommendation': (c.status == 'approved' and c.final_outcome == c.recommendation),
            'notes': c.head_notes or c.recommendation_reason,
            'decided_by': _person(c.decided_by),
            'requested_by': _person(c.requested_by),
            'turnaround_days': (c.decided_at - c.requested_at).days,
            'current_status': STATUS_LABEL.get(c.application.status, c.application.status),
        })

    def keep(r):
        if kind and r['kind'] != kind:
            return False
        if outcome and r['outcome_key'] != outcome:
            return False
        if not _in(_parse_date(r['date']), date_from, date_to):
            return False
        if search and not any(search in (r.get(f) or '').lower() for f in ('ref', 'title', 'group_name', 'site_name')):
            return False
        return True

    rows = [r for r in rows if keep(r)]
    rows.sort(key=lambda r: r['date'] or '', reverse=True)
    turn = [r['turnaround_days'] for r in rows if r['turnaround_days'] is not None]

    months = {}
    for r in rows:
        d = _parse_date(r['date'])
        if d:
            k = d.strftime('%b %Y')
            m = months.setdefault(k, {'month': k, 'sort': (d.year, d.month), 'approved': 0, 'rejected': 0,
                                      'returned': 0, 'closures': 0})
            if r['kind'] == 'closure':
                m['closures'] += 1
            elif r['outcome_key'] in ('approved', 'rejected', 'returned'):
                m[r['outcome_key']] += 1
    monthly = sorted(months.values(), key=lambda m: m['sort'])
    for m in monthly:
        m.pop('sort')

    closures = [r for r in rows if r['kind'] == 'closure']
    return JsonResponse({
        'summary': {
            'total': len(rows),
            'approved': sum(1 for r in rows if r['outcome_key'] == 'approved'),
            'rejected': sum(1 for r in rows if r['outcome_key'] == 'rejected'),
            'returned': sum(1 for r in rows if r['outcome_key'] == 'returned'),
            'closures': len(closures),
            'closures_completed': sum(1 for r in closures if r['outcome_key'] == 'closure_completed'),
            'closures_failed': sum(1 for r in closures if r['outcome_key'] == 'closure_failed'),
            'agreed_with_dm': sum(1 for r in closures if r.get('agreed_with_recommendation')),
            'avg_turnaround_days': round(sum(turn) / len(turn), 1) if turn else None,
        },
        'monthly': monthly,
        'rows': rows,
    }, status=200)