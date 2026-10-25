"""
GIS Specialist reports.

Each endpoint takes optional filters and returns "summary", chart data and every
matching "rows" record (not paginated, so PDF/Excel exports include everything).

  gis_report/sites/            every active site: approval, verification, boundary, planted area
  gis_report/planted_reviews/  planted-area polygons and their DM → GIS review history
  gis_report/assessments/      submitted field assessments with layers and evidence photos
"""
import logging
from datetime import date, datetime, timedelta

from django.db.models import Count, Max, Prefetch, Q
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt

from accounts.helper import get_user_from_token
from accounts.models import User
from Field_assessment.models import Assigned_onsite_inspector, Field_assessment
from sites.models import Sites
from sites.views import OFFICIAL_SITE_STATUSES
from tree_planting_programs.models import Application, ProgressReport, SeedlingRequest

logger = logging.getLogger(__name__)

MAX_ROWS = 2000

SITE_STATUS_STYLE = {
    'pending':      ('Pending',      '#f59e0b'),
    'under_review': ('Under Review', '#3b82f6'),
    'accepted':     ('Accepted',     '#10b981'),
    'rejected':     ('Rejected',     '#ef4444'),
    'completed':    ('Completed',    '#059669'),
    'failed':       ('Failed',       '#b91c1c'),
}
VERIFICATION_STYLE = {
    'none':     ('Not started',    '#d1d5db'),
    'draft':    ('Draft',          '#9ca3af'),
    'pending':  ('Pending Review', '#f59e0b'),
    'verified': ('Verified',       '#10b981'),
    'rejected': ('Rejected',       '#ef4444'),
}
MONITORING_LABELS = {
    'available': 'Available', 'reserved': 'Reserved', 'under_monitoring': 'Under Monitoring',
    'completed': 'Completed', 'failed': 'Failed', 'onhold': 'On Hold',
}
GIS_REVIEW_STYLE = {
    'awaiting_dm':       ('With Data Manager', '#9ca3af'),
    'dm_returned':       ('Returned by Data Manager', '#f97316'),
    'pending':           ('Waiting for GIS',   '#f59e0b'),
    'approved':          ('Confirmed',         '#10b981'),
    'changes_requested': ('Changes Requested', '#ef4444'),
    'not_required':      ('Not Required',      '#6b7280'),
}
LAYER_KEYS = {
    'meta': ('meta_data', 'Meta Data'),
    'safety': ('safety', 'Safety'),
    'survivability': ('survivability', 'Survivability'),
    'boundary': ('boundary_verification', 'Boundary'),
}
PHOTO_LAYERS = {
    'meta_land_title': 'Land title', 'meta_tax_decl': 'Tax declaration', 'meta_other_doc': 'Other document',
    'safety_flood': 'Flood', 'safety_landslide': 'Landslide', 'safety_erosion': 'Soil erosion',
    'safety_other': 'Other safety', 'surv_soil': 'Soil', 'surv_water': 'Water availability',
    'surv_animal': 'Animal presence', 'surv_slope': 'Slope', 'bound_verification': 'Boundary',
}
HIGH_RISK_CONCERNS = {'Armed Threat / Violence', 'Hostile Person on Site'}


# ─────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────
def _auth(request):
    try:
        user = get_user_from_token(request)
    except Exception:
        return None
    return user if user and user.user_role in ('GISSpecialist', 'DataManager', 'CityENROHead') else None


def _parse_date(value):
    try:
        return datetime.strptime(value, '%Y-%m-%d').date() if value else None
    except ValueError:
        return None


def _local_date(dt):
    if not dt:
        return None
    if isinstance(dt, datetime):
        return timezone.localtime(dt).date() if timezone.is_aware(dt) else dt.date()
    return dt


def _iso(dt):
    d = _local_date(dt)
    return d.isoformat() if d else None


def _person(user):
    if not user:
        return None
    profile = getattr(user, 'profile', None)
    if profile and getattr(profile, 'first_name', None):
        return f'{profile.first_name} {profile.last_name}'.strip()
    return user.email


def _barangay(site):
    if site and site.reforestation_area and site.reforestation_area.barangay:
        return site.reforestation_area.barangay.name
    return None


def _months(date_from, date_to, default=12):
    end = date_to or timezone.localdate()
    if date_from:
        start = date_from
    else:
        y, m = end.year, end.month - (default - 1)
        while m <= 0:
            y, m = y - 1, m + 12
        start = date(y, m, 1)
    keys, y, m = [], start.year, start.month
    while (y, m) <= (end.year, end.month) and len(keys) < 36:
        keys.append((y, m))
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)
    return keys


def _label(key):
    return date(key[0], key[1], 1).strftime("%b '%y")


def _style_list(counts, style):
    return [{'key': k, 'name': label, 'fill': color, 'value': counts.get(k, 0)}
            for k, (label, color) in style.items()]


def _layers_present(data):
    data = data or {}
    return [label for _, (key, label) in LAYER_KEYS.items() if data.get(key)]


def _security_concerns(data):
    try:
        selected = (data or {}).get('meta_data', {}).get('security_concerns', {}).get('selected') or []
        return [c for c in selected if isinstance(c, str)]
    except AttributeError:
        return []


# ─────────────────────────────────────────────────────────────
# SITE REGISTRY
# ─────────────────────────────────────────────────────────────
@csrf_exempt
def get_gis_sites_report(request):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    if not _auth(request):
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    status = request.GET.get('status', '').strip()
    verification = request.GET.get('verification', '').strip()
    monitoring = request.GET.get('monitoring_status', '').strip()
    barangay_id = request.GET.get('barangay', '').strip()
    area_id = request.GET.get('area', '').strip()
    issue = request.GET.get('issue', '').strip()       # any | boundary | oversized | no_class
    search = request.GET.get('search', '').strip()
    date_from = _parse_date(request.GET.get('date_from'))
    date_to = _parse_date(request.GET.get('date_to'))

    try:
        qs = (Sites.objects.filter(is_active=True)
              .select_related('reforestation_area__barangay', 'meta_verification__verified_by__profile',
                              'meta_verification__verified_land_classification')
              .prefetch_related(
                  Prefetch('progress_reports',
                           queryset=ProgressReport.objects.filter(status='accepted', planted_area_hectares__isnull=False)
                           .order_by('submitted_at', 'created_at'),
                           to_attr='planted_reports'),
                  Prefetch('field_assessment',
                           queryset=Field_assessment.objects.filter(is_submitted=True).order_by('created_at'),
                           to_attr='submitted_assessments'),
                  Prefetch('applications',
                           queryset=Application.objects.select_related('user__tree_grower_group').order_by('-created_at')),
              )
              .order_by('reforestation_area__barangay__name', 'reforestation_area__name', 'name'))

        if status in SITE_STATUS_STYLE:
            qs = qs.filter(status=status)
        if verification == 'none':
            qs = qs.filter(meta_verification__isnull=True)
        elif verification in VERIFICATION_STYLE:
            qs = qs.filter(meta_verification__status=verification)
        if monitoring in MONITORING_LABELS:
            qs = qs.filter(monitoring_status=monitoring)
        if barangay_id:
            qs = qs.filter(reforestation_area__barangay_id=barangay_id)
        if area_id:
            qs = qs.filter(reforestation_area_id=area_id)
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(reforestation_area__name__icontains=search))
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)

        rows = []
        for s in qs[:MAX_ROWS]:
            mv = getattr(s, 'meta_verification', None)
            site_ha = s.total_area_hectares or 0
            planted_ha = s.planted_reports[-1].planted_area_hectares if s.planted_reports else None
            issues = []
            if not s.polygon_coordinates or site_ha <= 0:
                issues.append('No site boundary / 0 ha')
            if planted_ha and site_ha > 0 and planted_ha > site_ha * 1.05:
                issues.append('Planted polygon larger than site')
            if planted_ha and site_ha <= 0:
                issues.append('Planted polygon but no site area')
            if mv and mv.status == 'verified' and not mv.verified_land_classification_id:
                issues.append('Verified without land classification')

            if issue == 'any' and not issues:
                continue
            if issue == 'boundary' and not any('boundary' in i.lower() or 'no site area' in i for i in issues):
                continue
            if issue == 'oversized' and 'Planted polygon larger than site' not in issues:
                continue
            if issue == 'no_class' and 'Verified without land classification' not in issues:
                continue

            apps = list(s.applications.all())
            active = next((a for a in apps if a.status in ('for_evaluation', 'for_head', 'accepted', 'under_monitoring')), None)
            official = bool(mv and mv.status == 'verified' and s.status in OFFICIAL_SITE_STATUSES)
            assessments = s.submitted_assessments

            rows.append({
                'site_id': s.site_id,
                'name': s.name,
                'reforestation_area': s.reforestation_area.name if s.reforestation_area else None,
                'barangay': _barangay(s),
                'status': s.status,
                'status_label': SITE_STATUS_STYLE.get(s.status, (s.get_status_display(), ''))[0],
                'verification': mv.status if mv else 'none',
                'verification_label': VERIFICATION_STYLE.get(mv.status if mv else 'none', ('—', ''))[0],
                'verified_by': _person(mv.verified_by) if mv else None,
                'verified_at': _iso(mv.verified_at) if mv else None,
                'official': official,
                'monitoring_status': s.monitoring_status if official else None,
                'monitoring_label': MONITORING_LABELS.get(s.monitoring_status) if official else None,
                'land_classification': (mv.verified_land_classification.name
                                        if mv and mv.verified_land_classification else None),
                'site_hectares': round(site_ha, 2),
                'planted_hectares': round(planted_ha, 2) if planted_ha else None,
                'planted_pct': round(planted_ha / site_ha * 100, 1) if planted_ha and site_ha > 0 else None,
                'assessments': len(assessments),
                'last_assessment': _iso(assessments[-1].created_at) if assessments else None,
                'programs': len(apps),
                'current_program': active.title if active else None,
                'current_group': (active.user.tree_grower_group.group_name
                                  if active and hasattr(active.user, 'tree_grower_group') else None),
                'created_at': _iso(s.created_at),
                'updated_at': _iso(s.updated_at),
                'issues': issues,
            })

        status_counts, verification_counts, brgy = {}, {}, {}
        for r in rows:
            status_counts[r['status']] = status_counts.get(r['status'], 0) + 1
            verification_counts[r['verification']] = verification_counts.get(r['verification'], 0) + 1
            b = brgy.setdefault(r['barangay'] or 'Unassigned',
                                {'name': r['barangay'] or 'Unassigned', 'sites': 0, 'official': 0,
                                 'hectares': 0.0, 'planted_hectares': 0.0})
            b['sites'] += 1
            b['official'] += 1 if r['official'] else 0
            b['hectares'] += r['site_hectares']
            b['planted_hectares'] += r['planted_hectares'] or 0

        months = _months(date_from, date_to)
        monthly = {k: {'created': 0, 'verified': 0} for k in months}
        for r in rows:
            for field, bucket in (('created_at', 'created'), ('verified_at', 'verified')):
                d = _parse_date(r[field]) if r[field] else None
                if field == 'verified_at' and r['verification'] != 'verified':
                    d = None
                if d and (d.year, d.month) in monthly:
                    monthly[(d.year, d.month)][bucket] += 1

        official_rows = [r for r in rows if r['official']]
        summary = {
            'total': len(rows),
            'hectares': round(sum(r['site_hectares'] for r in rows), 2),
            'official': len(official_rows),
            'official_hectares': round(sum(r['site_hectares'] for r in official_rows), 2),
            'planted_hectares': round(sum(r['planted_hectares'] or 0 for r in rows), 2),
            'pending': sum(1 for r in rows if r['status'] in ('pending', 'under_review')),
            'verification_pending': verification_counts.get('pending', 0),
            'not_verified': verification_counts.get('none', 0) + verification_counts.get('draft', 0),
            'with_issues': sum(1 for r in rows if r['issues']),
            'assessments': sum(r['assessments'] for r in rows),
            'areas': len({r['reforestation_area'] for r in rows if r['reforestation_area']}),
        }

        return JsonResponse({
            'summary': summary,
            'status_breakdown': [s for s in _style_list(status_counts, SITE_STATUS_STYLE)
                                 if s['value'] or s['key'] in ('pending', 'under_review', 'accepted', 'rejected')],
            'verification_breakdown': _style_list(verification_counts, VERIFICATION_STYLE),
            'by_barangay': [
                {**b, 'hectares': round(b['hectares'], 2), 'planted_hectares': round(b['planted_hectares'], 2)}
                for b in sorted(brgy.values(), key=lambda x: -x['hectares'])
            ],
            'monthly': [{'month': _label(k), **v} for k, v in monthly.items()],
            'rows': rows,
        }, status=200)
    except Exception as e:
        logger.error(f'Error in get_gis_sites_report: {e}', exc_info=True)
        return JsonResponse({'error': str(e)}, status=500)


# ─────────────────────────────────────────────────────────────
# PLANTED-AREA REVIEW HISTORY
# ─────────────────────────────────────────────────────────────
def _review_stage(r):
    if r.dm_review_status == 'changes_requested':
        return 'dm_returned'
    if r.dm_review_status == 'pending' and r.status == 'pending':
        return 'awaiting_dm'
    return r.gis_review_status


@csrf_exempt
def get_gis_planted_reviews_report(request):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    if not _auth(request):
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    stage = request.GET.get('stage', '').strip()
    barangay_id = request.GET.get('barangay', '').strip()
    search = request.GET.get('search', '').strip()
    oversized_only = request.GET.get('oversized', '') in ('1', 'true')
    date_from = _parse_date(request.GET.get('date_from'))
    date_to = _parse_date(request.GET.get('date_to'))

    try:
        qs = (ProgressReport.objects.filter(polygon_coordinates__isnull=False)
              .select_related('site__reforestation_area__barangay', 'application__user__tree_grower_group',
                              'submitted_by__profile', 'dm_reviewed_by__profile', 'gis_reviewed_by__profile')
              .order_by('-submitted_at', '-created_at'))
        if barangay_id:
            qs = qs.filter(site__reforestation_area__barangay_id=barangay_id)
        if search:
            qs = qs.filter(Q(site__name__icontains=search) | Q(site__reforestation_area__name__icontains=search)
                           | Q(application__user__tree_grower_group__group_name__icontains=search))
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)

        rows = []
        for r in qs[:MAX_ROWS]:
            st = _review_stage(r)
            if stage and stage != st:
                continue
            site_ha = (r.site.total_area_hectares or 0) if r.site else 0
            planted = r.planted_area_hectares
            oversized = bool(planted and site_ha > 0 and planted > site_ha * 1.05)
            if oversized_only and not oversized:
                continue
            turnaround = None
            if r.gis_reviewed_at and r.dm_reviewed_at and r.gis_reviewed_at >= r.dm_reviewed_at:
                turnaround = round((r.gis_reviewed_at - r.dm_reviewed_at).total_seconds() / 86400, 1)
            waiting = None
            if st == 'pending' and r.dm_reviewed_at:
                waiting = (timezone.now() - r.dm_reviewed_at).days
            rows.append({
                'id': r.progress_report_id,
                'submitted': _iso(r.submitted_at or r.created_at),
                'site_id': r.site_id,
                'site_name': r.site.name if r.site else None,
                'barangay': _barangay(r.site),
                'program': f'APP-{r.application.application_id:04d}' if r.application else None,
                'group_name': (r.application.user.tree_grower_group.group_name
                               if r.application and hasattr(r.application.user, 'tree_grower_group') else None),
                'visit_type': r.get_visit_type_display().split(' (')[0],
                'inspector': _person(r.submitted_by),
                'report_status': r.status,
                'dm_review': r.get_dm_review_status_display(),
                'dm_reviewer': _person(r.dm_reviewed_by),
                'dm_reviewed_at': _iso(r.dm_reviewed_at),
                'stage': st,
                'stage_label': GIS_REVIEW_STYLE.get(st, (st, ''))[0],
                'gis_reviewer': _person(r.gis_reviewed_by),
                'gis_reviewed_at': _iso(r.gis_reviewed_at),
                'gis_notes': r.gis_review_notes,
                'planted_hectares': round(planted, 2) if planted else None,
                'site_hectares': round(site_ha, 2),
                'planted_pct': round(planted / site_ha * 100, 1) if planted and site_ha > 0 else None,
                'oversized': oversized,
                'turnaround_days': turnaround,
                'waiting_days': waiting,
            })

        counts = {}
        for r in rows:
            counts[r['stage']] = counts.get(r['stage'], 0) + 1
        turnarounds = [r['turnaround_days'] for r in rows if r['turnaround_days'] is not None]

        months = _months(date_from, date_to)
        monthly = {k: {'submitted': 0, 'approved': 0, 'changes_requested': 0} for k in months}
        for r in rows:
            d = _parse_date(r['submitted'])
            if d and (d.year, d.month) in monthly:
                monthly[(d.year, d.month)]['submitted'] += 1
            g = _parse_date(r['gis_reviewed_at']) if r['gis_reviewed_at'] else None
            if g and (g.year, g.month) in monthly and r['stage'] in ('approved', 'changes_requested'):
                monthly[(g.year, g.month)][r['stage']] += 1

        reviewers = {}
        for r in rows:
            if r['gis_reviewer'] and r['stage'] in ('approved', 'changes_requested'):
                v = reviewers.setdefault(r['gis_reviewer'], {'name': r['gis_reviewer'], 'reviews': 0, 'approved': 0})
                v['reviews'] += 1
                v['approved'] += 1 if r['stage'] == 'approved' else 0

        summary = {
            'total': len(rows),
            'awaiting_dm': counts.get('awaiting_dm', 0),
            'dm_returned': counts.get('dm_returned', 0),
            'pending': counts.get('pending', 0),
            'approved': counts.get('approved', 0),
            'changes_requested': counts.get('changes_requested', 0),
            'oversized': sum(1 for r in rows if r['oversized']),
            'avg_turnaround_days': round(sum(turnarounds) / len(turnarounds), 1) if turnarounds else None,
            'oldest_waiting_days': max((r['waiting_days'] for r in rows if r['waiting_days'] is not None), default=None),
            'confirmed_hectares': round(sum(r['planted_hectares'] or 0 for r in rows if r['stage'] == 'approved'), 2),
            'sites': len({r['site_id'] for r in rows if r['site_id']}),
        }

        return JsonResponse({
            'summary': summary,
            'stage_breakdown': _style_list(counts, GIS_REVIEW_STYLE),
            'monthly': [{'month': _label(k), **v} for k, v in monthly.items()],
            'by_reviewer': sorted(reviewers.values(), key=lambda x: -x['reviews']),
            'rows': rows,
        }, status=200)
    except Exception as e:
        logger.error(f'Error in get_gis_planted_reviews_report: {e}', exc_info=True)
        return JsonResponse({'error': str(e)}, status=500)


# ─────────────────────────────────────────────────────────────
# ONSITE INSPECTOR TRACKING (used by the field assessments report)
# ─────────────────────────────────────────────────────────────
ACTIVE_DAYS = 30     # active if they did field work in the last 30 days
INACTIVE_DAYS = 90   # inactive if nothing in 90 days (or never)


def _inspector_tracking(assessment_rows, barangay_id, area_id, date_from, date_to):
    """
    One row per onsite inspector: assigned areas, field assessments, monitoring
    visits (progress reports they submitted) and seedling handovers.
    Assessment numbers follow the report filters; visits and handovers follow
    the same barangay/area/date filters.
    """
    today = timezone.localdate()

    inspectors = list(User.objects.filter(user_role='OnsiteInspector').select_related('profile').order_by('email'))
    ids = [u.id for u in inspectors]

    assignments = {}
    for a in (Assigned_onsite_inspector.objects.filter(user_id__in=ids)
              .select_related('reforestation_area__barangay')):
        if a.reforestation_area and a.reforestation_area.deleted_at:
            continue
        assignments.setdefault(a.user_id, []).append(a)

    visits_qs = ProgressReport.objects.filter(submitted_by_id__in=ids)
    handover_qs = SeedlingRequest.objects.filter(assigned_inspector_id__in=ids)
    if barangay_id:
        visits_qs = visits_qs.filter(site__reforestation_area__barangay_id=barangay_id)
        handover_qs = handover_qs.filter(application__site__reforestation_area__barangay_id=barangay_id)
    if area_id:
        visits_qs = visits_qs.filter(site__reforestation_area_id=area_id)
        handover_qs = handover_qs.filter(application__site__reforestation_area_id=area_id)
    if date_from:
        visits_qs = visits_qs.filter(created_at__date__gte=date_from)
        handover_qs = handover_qs.filter(created_at__date__gte=date_from)
    if date_to:
        visits_qs = visits_qs.filter(created_at__date__lte=date_to)
        handover_qs = handover_qs.filter(created_at__date__lte=date_to)

    visits = {}
    for v in visits_qs.values('submitted_by_id', 'status', 'site_id', 'polygon_coordinates', 'submitted_at', 'created_at'):
        visits.setdefault(v['submitted_by_id'], []).append(v)
    handovers = {}
    for h in handover_qs.values('assigned_inspector_id', 'status'):
        handovers.setdefault(h['assigned_inspector_id'], []).append(h['status'])

    # All-time last activity (not affected by filters) decides active / idle / inactive
    last_fa_all = {
        r['assigned_onsite_inspector__user_id']: r['last']
        for r in Field_assessment.objects.filter(is_submitted=True, assigned_onsite_inspector__user_id__in=ids)
        .values('assigned_onsite_inspector__user_id').annotate(last=Max('created_at'))
    }
    last_v_all = {
        r['submitted_by_id']: r['last']
        for r in ProgressReport.objects.filter(submitted_by_id__in=ids)
        .values('submitted_by_id').annotate(last=Max('created_at'))
    }

    by_user = {}
    for r in assessment_rows:
        if r.get('inspector_id'):
            by_user.setdefault(r['inspector_id'], []).append(r)

    rows = []
    for u in inspectors:
        fa = by_user.get(u.id, [])
        vs = visits.get(u.id, [])
        hs = handovers.get(u.id, [])
        areas = assignments.get(u.id, [])

        last_fa = _local_date(last_fa_all.get(u.id))
        last_v = _local_date(last_v_all.get(u.id))
        last_active = max([d for d in (last_fa, last_v) if d], default=None)
        days_idle = (today - last_active).days if last_active else None
        if days_idle is not None and days_idle <= ACTIVE_DAYS:
            activity = 'active'
        elif days_idle is not None and days_idle <= INACTIVE_DAYS:
            activity = 'idle'
        else:
            activity = 'inactive'

        accepted = sum(1 for v in vs if v['status'] == 'accepted')
        rejected = sum(1 for v in vs if v['status'] == 'rejected')
        decided = accepted + rejected
        sites = {r['site_id'] for r in fa if r['site_id']} | {v['site_id'] for v in vs if v['site_id']}

        rows.append({
            'id': u.id,
            'name': _person(u),
            'email': u.email,
            'is_active': u.is_active,
            'areas': [a.reforestation_area.name for a in areas if a.reforestation_area],
            'barangays': sorted({a.reforestation_area.barangay.name for a in areas
                                 if a.reforestation_area and a.reforestation_area.barangay}),
            'assigned_since': _iso(min((a.created_at for a in areas), default=None)),
            'assessments': len(fa),
            'general': sum(1 for r in fa if r['type'] == 'General'),
            'specific': sum(1 for r in fa if r['type'] == 'Specific'),
            'photos': sum(r['photos'] for r in fa),
            'avg_photos': round(sum(r['photos'] for r in fa) / len(fa), 1) if fa else None,
            'avg_layers': round(sum(len(r['layers']) for r in fa) / len(fa), 1) if fa else None,
            'without_gps': sum(1 for r in fa if not r['has_location']),
            'concerns_reported': sum(1 for r in fa if r['security_concerns']),
            'visits': len(vs),
            'visits_accepted': accepted,
            'visits_pending': sum(1 for v in vs if v['status'] == 'pending'),
            'visits_rejected': rejected,
            'visits_with_polygon': sum(1 for v in vs if v['polygon_coordinates']),
            'acceptance_rate': round(accepted / decided * 100, 1) if decided else None,
            'handovers_waiting': sum(1 for s in hs if s == 'accepted'),
            'handovers_confirmed': sum(1 for s in hs if s == 'confirmed'),
            'sites_covered': len(sites),
            'last_assessment': _iso(last_fa),
            'last_visit': _iso(last_v),
            'last_active': _iso(last_active),
            'days_idle': days_idle,
            'activity': activity,
        })

    # Most active first, then by name
    rows.sort(key=lambda r: (-(r['assessments'] + r['visits']), r['name']))
    return {
        'summary': {
            'total': len(rows),
            'active': sum(1 for r in rows if r['activity'] == 'active'),
            'idle': sum(1 for r in rows if r['activity'] == 'idle'),
            'inactive': sum(1 for r in rows if r['activity'] == 'inactive'),
            'unassigned': sum(1 for r in rows if not r['areas']),
            'visits': sum(r['visits'] for r in rows),
            'visits_rejected': sum(r['visits_rejected'] for r in rows),
            'handovers_waiting': sum(r['handovers_waiting'] for r in rows),
            'active_days': ACTIVE_DAYS,
            'inactive_days': INACTIVE_DAYS,
        },
        'rows': rows,
    }


# ─────────────────────────────────────────────────────────────
# FIELD ASSESSMENTS
# ─────────────────────────────────────────────────────────────
@csrf_exempt
def get_gis_assessments_report(request):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    if not _auth(request):
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    kind = request.GET.get('type', '').strip()          # general | specific
    layer = request.GET.get('layer', '').strip()
    barangay_id = request.GET.get('barangay', '').strip()
    area_id = request.GET.get('area', '').strip()
    risk = request.GET.get('risk', '').strip()          # any | high
    search = request.GET.get('search', '').strip()
    date_from = _parse_date(request.GET.get('date_from'))
    date_to = _parse_date(request.GET.get('date_to'))

    try:
        qs = (Field_assessment.objects.filter(is_submitted=True)
              .select_related('assigned_onsite_inspector__user__profile',
                              'assigned_onsite_inspector__reforestation_area__barangay',
                              'site__reforestation_area__barangay', 'land_classification')
              .prefetch_related('images')
              .order_by('-created_at'))
        if kind == 'general':
            qs = qs.filter(site__isnull=True)
        elif kind == 'specific':
            qs = qs.filter(site__isnull=False)
        if layer in LAYER_KEYS:
            qs = qs.filter(field_assessment_data__has_key=LAYER_KEYS[layer][0])
        if barangay_id:
            qs = qs.filter(Q(site__reforestation_area__barangay_id=barangay_id)
                           | Q(assigned_onsite_inspector__reforestation_area__barangay_id=barangay_id))
        if area_id:
            qs = qs.filter(Q(site__reforestation_area_id=area_id)
                           | Q(assigned_onsite_inspector__reforestation_area_id=area_id))
        if search:
            qs = qs.filter(Q(title__icontains=search) | Q(site__name__icontains=search)
                           | Q(assigned_onsite_inspector__user__email__icontains=search)
                           | Q(assigned_onsite_inspector__reforestation_area__name__icontains=search))
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)

        rows = []
        photo_counts = {}
        for fa in qs[:MAX_ROWS]:
            concerns = _security_concerns(fa.field_assessment_data)
            high = any(c in HIGH_RISK_CONCERNS for c in concerns)
            if risk == 'any' and not concerns:
                continue
            if risk == 'high' and not high:
                continue
            assign = fa.assigned_onsite_inspector
            area = assign.reforestation_area if assign else None
            images = list(fa.images.all())
            for img in images:
                if img.layer:
                    photo_counts[img.layer] = photo_counts.get(img.layer, 0) + 1
            rows.append({
                'id': fa.field_assessment_id,
                'title': fa.title or f'Assessment #{fa.field_assessment_id}',
                'type': 'Specific' if fa.site_id else 'General',
                'inspector': _person(assign.user) if assign else None,
                'inspector_id': assign.user_id if assign else None,
                'reforestation_area': (fa.site.reforestation_area.name
                                       if fa.site and fa.site.reforestation_area else area.name if area else None),
                'barangay': _barangay(fa.site) or (area.barangay.name if area and area.barangay else None),
                'site_id': fa.site_id,
                'site_name': fa.site.name if fa.site else None,
                'site_status': fa.site.get_status_display() if fa.site else None,
                'land_classification': fa.land_classification.name if fa.land_classification else None,
                'layers': _layers_present(fa.field_assessment_data),
                'photos': len(images),
                'has_location': bool(fa.location),
                'security_concerns': concerns,
                'high_risk': high,
                'assessment_date': _iso(fa.assessment_date),
                'submitted': _iso(fa.sent_date or fa.created_at),
            })

        layer_counts = {label: 0 for _, (_, label) in LAYER_KEYS.items()}
        inspectors, months = {}, _months(date_from, date_to)
        monthly = {k: {'general': 0, 'specific': 0} for k in months}
        for r in rows:
            for l in r['layers']:
                layer_counts[l] = layer_counts.get(l, 0) + 1
            if r['inspector']:
                i = inspectors.setdefault(r['inspector'], {'name': r['inspector'], 'assessments': 0, 'photos': 0})
                i['assessments'] += 1
                i['photos'] += r['photos']
            d = _parse_date(r['submitted'])
            if d and (d.year, d.month) in monthly:
                monthly[(d.year, d.month)]['specific' if r['type'] == 'Specific' else 'general'] += 1

        summary = {
            'total': len(rows),
            'general': sum(1 for r in rows if r['type'] == 'General'),
            'specific': sum(1 for r in rows if r['type'] == 'Specific'),
            'photos': sum(r['photos'] for r in rows),
            'with_concerns': sum(1 for r in rows if r['security_concerns']),
            'high_risk': sum(1 for r in rows if r['high_risk']),
            'without_location': sum(1 for r in rows if not r['has_location']),
            'sites': len({r['site_id'] for r in rows if r['site_id']}),
            'inspectors': len(inspectors),
        }

        return JsonResponse({
            'summary': summary,
            'layers': [{'name': k, 'value': v} for k, v in layer_counts.items()],
            'photos_by_layer': [
                {'name': PHOTO_LAYERS.get(k, k), 'group': k.split('_')[0], 'value': v}
                for k, v in sorted(photo_counts.items(), key=lambda x: -x[1])
            ],
            'monthly': [{'month': _label(k), **v} for k, v in monthly.items()],
            'by_inspector': sorted(inspectors.values(), key=lambda x: -x['assessments']),
            'inspector_tracking': _inspector_tracking(rows, barangay_id, area_id, date_from, date_to),
            'rows': rows,
        }, status=200)
    except Exception as e:
        logger.error(f'Error in get_gis_assessments_report: {e}', exc_info=True)
        return JsonResponse({'error': str(e)}, status=500)
