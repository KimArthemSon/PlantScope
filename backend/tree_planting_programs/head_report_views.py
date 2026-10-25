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

    period_p = period_a = period_d = 0
    cum_p = cum_a = cum_d = 0
    visits = 0
    sites_planted = set()
    species = {}
    brgy = {}
    for r in reports:
        d = _local_date(r.submitted_at or r.created_at)
        if d > end:
            continue
        p, a, dead = _report_totals(r)
        cum_p, cum_a, cum_d = cum_p + p, cum_a + a, cum_d + dead
        if _in(d, date_from, date_to):
            period_p, period_a, period_d = period_p + p, period_a + a, period_d + dead
            visits += 1
            if p + a > 0:
                sites_planted.add(r.site_id)
            b = brgy.setdefault(_barangay(r.site) or 'Unassigned', {'planted': 0, 'dead': 0, 'visits': 0})
            b['planted'] += p + a
            b['dead'] += dead
            b['visits'] += 1
            for sp in r.report_species.all():
                name = sp.tree_species.name if sp.tree_species else 'Unknown'
                e = species.setdefault(name, {'planted': 0, 'dead': 0})
                e['planted'] += (sp.no_planted or 0) + (sp.no_added_by_grower or 0)
                e['dead'] += sp.no_dead or 0
    _, alive_end, survival_end = _survival(cum_p, cum_a, cum_d)
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
        'plants_planted': period_p + period_a,
        'plants_added_by_growers': period_a,
        'plants_dead': period_d,
        'sites_planted': len(sites_planted),
        'visits': visits,
        'planted_hectares_end': area_end,
        'planted_hectares_added': round(area_end - area_start, 2),
        'survival_rate_end': survival_end,
        'plants_alive_end': alive_end,
        'plants_total_end': cum_p + cum_a,
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
            p, a2, dead = _report_totals(r)
            monthly[(d.year, d.month)]['planted'] += p + a2
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
        _, _, rate = _survival(b['planted'], 0, b['dead'])
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
        _, alive, rate = _survival(e['planted'], 0, e['dead'])
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
                          f"({alive_end:,} of {cum_p + cum_a:,} plants alive).")
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
    _, alive, rate = _survival(planted, 0, dead)

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
