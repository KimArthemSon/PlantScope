"""
GIS Specialist dashboard.

Everything here comes from real records — no placeholder targets or weather.
  - Reforestation areas and the sites inside them (count, hectares, statuses)
  - Site verification pipeline and official sites (same rules as the Official Sites page)
  - Planted area from progress-report polygons (latest polygon per site)
  - Planted-area review queue (GIS step after the Data Manager approves)
  - Map layers: hazard areas, classified areas, NDVI candidate areas
"""
import logging
from datetime import date, datetime, timedelta

from django.db.models import Count, Q, Sum, Value
from django.db.models.functions import Coalesce
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt

from accounts.helper import get_user_from_token
from Field_assessment.models import Field_assessment
from hazard_areas.models import HazardArea
from land_classifications.models import Classified_areas
from reforestation_areas.models import Reforestation_areas
from sites.models import Potential_sites, SiteMetaDataVerification, Sites
from sites.views import OFFICIAL_SITE_STATUSES
from tree_planting_programs.models import ProgressReport

logger = logging.getLogger(__name__)

SITE_STATUS_STYLE = {
    'pending':      ('Pending',      '#f59e0b'),
    'under_review': ('Under Review', '#3b82f6'),
    'accepted':     ('Accepted',     '#10b981'),
    'rejected':     ('Rejected',     '#ef4444'),
    'completed':    ('Completed',    '#059669'),
    'failed':       ('Failed',       '#b91c1c'),
}
MONITORING_STYLE = {
    'available':        ('Available',        '#10b981'),
    'reserved':         ('Reserved',         '#f59e0b'),
    'under_monitoring': ('Under Monitoring', '#6366f1'),
    'completed':        ('Completed',        '#059669'),
    'failed':           ('Failed',           '#ef4444'),
    'onhold':           ('On Hold',          '#9ca3af'),
}
VERIFICATION_STYLE = {
    'draft':    ('Draft',          '#9ca3af'),
    'pending':  ('Pending Review', '#f59e0b'),
    'verified': ('Verified',       '#10b981'),
    'rejected': ('Rejected',       '#ef4444'),
}
HAZARD_COLORS = {
    'LANDSLIDE': '#b45309', 'FLOOD': '#2563eb', 'EARTHQUAKE': '#7c3aed',
    'VOLCANIC': '#dc2626', 'STORM_SURGE': '#0891b2', 'OTHER': '#6b7280',
}

PENDING_GIS_REVIEW = Q(
    polygon_coordinates__isnull=False, status='pending',
    dm_review_status='approved', gis_review_status='pending',
)


def _auth(request):
    try:
        user = get_user_from_token(request)
    except Exception:
        return None
    return user if user and user.user_role == 'GISSpecialist' else None


def _local_date(dt):
    if not dt:
        return None
    return timezone.localtime(dt).date() if timezone.is_aware(dt) else dt.date()


def _time_ago(dt):
    if not dt:
        return '—'
    diff = timezone.now() - dt
    if diff.days > 30:
        return timezone.localtime(dt).strftime('%b %d, %Y')
    if diff.days > 1:
        return f'{diff.days}d ago'
    if diff.days == 1:
        return 'Yesterday'
    if diff.seconds > 3600:
        return f'{diff.seconds // 3600}h ago'
    if diff.seconds > 60:
        return f'{diff.seconds // 60}m ago'
    return 'Just now'


def _person(user):
    if not user:
        return 'System'
    profile = getattr(user, 'profile', None)
    if profile and getattr(profile, 'first_name', None):
        return f'{profile.first_name} {profile.last_name}'.strip()
    return user.email.split('@')[0]


def _last_12_months(today):
    keys = []
    y, m = today.year, today.month
    for _ in range(12):
        keys.append((y, m))
        m -= 1
        if m == 0:
            y, m = y - 1, 12
    return list(reversed(keys))


def _breakdown(rows, style, key='status'):
    counts = {r[key]: r for r in rows}
    out = []
    for k, (label, color) in style.items():
        r = counts.get(k)
        out.append({
            'key': k, 'name': label, 'fill': color,
            'value': r['count'] if r else 0,
            'hectares': round(r.get('hectares') or 0, 2) if r else 0.0,
        })
    return out


@csrf_exempt
def get_gis_pending_review_count(request):
    """Sidebar badge: planted-area reports waiting for the GIS Specialist."""
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    if not _auth(request):
        return JsonResponse({'error': 'Unauthorized'}, status=403)
    return JsonResponse({'pending_count': ProgressReport.objects.filter(PENDING_GIS_REVIEW).count()})


@csrf_exempt
def get_gis_dashboard(request):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    if not _auth(request):
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    try:
        now = timezone.now()
        today = timezone.localdate()
        month_start = today.replace(day=1)
        hectares = Coalesce(Sum('total_area_hectares'), Value(0.0))

        # ── Reforestation areas ──
        areas = Reforestation_areas.objects.filter(deleted_at__isnull=True)
        areas_total = areas.count()
        areas_this_month = areas.filter(created_at__date__gte=month_start).count()
        barangays_covered = areas.filter(barangay__isnull=False).values('barangay').distinct().count()

        # ── Sites ──
        sites = Sites.objects.filter(is_active=True)
        site_totals = sites.aggregate(count=Count('site_id'), hectares=hectares)
        sites_this_month = sites.filter(created_at__date__gte=month_start).count()
        site_status = _breakdown(
            sites.values('status').annotate(count=Count('site_id'), hectares=hectares), SITE_STATUS_STYLE)
        site_status = [s for s in site_status if s['value'] > 0 or s['key'] in ('pending', 'under_review', 'accepted', 'rejected')]

        # Verification pipeline (site data review)
        verification = _breakdown(
            SiteMetaDataVerification.objects.filter(site__is_active=True)
            .values('status').annotate(count=Count('id')),
            VERIFICATION_STYLE)
        sites_without_verification = sites.filter(meta_verification__isnull=True).count()

        # Official sites (same rule as the Official Sites page)
        official = sites.filter(meta_verification__status='verified', status__in=OFFICIAL_SITE_STATUSES)
        official_totals = official.aggregate(count=Count('site_id'), hectares=hectares)
        monitoring_status = _breakdown(
            official.values('monitoring_status').annotate(count=Count('site_id'), hectares=hectares),
            MONITORING_STYLE, key='monitoring_status')

        # ── Planted area: latest accepted polygon per site ──
        planted_reports = (ProgressReport.objects
                           .filter(status='accepted', planted_area_hectares__isnull=False, site__isnull=False)
                           .order_by('submitted_at', 'created_at')
                           .values('site_id', 'planted_area_hectares', 'submitted_at', 'created_at'))
        planted_events = [
            (_local_date(r['submitted_at'] or r['created_at']), r['site_id'], r['planted_area_hectares'])
            for r in planted_reports
        ]
        latest_planted = {}
        for _, site_id, ha in planted_events:
            latest_planted[site_id] = ha
        planted_hectares = round(sum(latest_planted.values()), 2)

        # ── Planted-area review queue ──
        pending_qs = (ProgressReport.objects.filter(PENDING_GIS_REVIEW)
                      .select_related('site__reforestation_area__barangay', 'submitted_by__profile')
                      .order_by('dm_reviewed_at'))
        pending_reviews = pending_qs.count()
        awaiting_dm = ProgressReport.objects.filter(
            polygon_coordinates__isnull=False, status='pending', dm_review_status='pending').count()
        reviewed_month = ProgressReport.objects.filter(
            gis_review_status__in=['approved', 'changes_requested'], gis_reviewed_at__date__gte=month_start)
        approved_month = reviewed_month.filter(gis_review_status='approved').count()
        changes_month = reviewed_month.filter(gis_review_status='changes_requested').count()
        turnaround = [
            (r['gis_reviewed_at'] - r['dm_reviewed_at']).total_seconds() / 86400
            for r in ProgressReport.objects.filter(
                gis_reviewed_at__isnull=False, dm_reviewed_at__isnull=False,
                gis_reviewed_at__gte=now - timedelta(days=90),
            ).values('gis_reviewed_at', 'dm_reviewed_at')
            if r['gis_reviewed_at'] >= r['dm_reviewed_at']
        ]
        review_queue = []
        for r in pending_qs[:6]:
            waiting_since = r.dm_reviewed_at or r.submitted_at or r.created_at
            review_queue.append({
                'id': r.progress_report_id,
                'site': r.site.name if r.site else 'Unknown site',
                'barangay': (r.site.reforestation_area.barangay.name
                             if r.site and r.site.reforestation_area and r.site.reforestation_area.barangay
                             else '—'),
                'visit_type': r.get_visit_type_display().split(' (')[0],
                'planted_hectares': round(r.planted_area_hectares, 2) if r.planted_area_hectares else None,
                'site_hectares': round(r.site.total_area_hectares or 0, 2) if r.site else None,
                'inspector': _person(r.submitted_by),
                'waiting_days': (now - waiting_since).days if waiting_since else 0,
            })

        # ── Monthly trend (last 12 months) ──
        keys = _last_12_months(today)
        first_key = keys[0]
        site_dates = [_local_date(d) for d in sites.values_list('created_at', flat=True)]
        area_dates = [_local_date(d) for d in areas.values_list('created_at', flat=True)]
        verified = list(SiteMetaDataVerification.objects
                        .filter(status='verified', verified_at__isnull=False, site__is_active=True)
                        .values_list('verified_at', 'site__total_area_hectares'))
        verified = [(_local_date(d), ha or 0) for d, ha in verified]

        def mk(d):
            return (d.year, d.month)

        trend = []
        for key in keys:
            end = (date(key[0] + (key[1] == 12), key[1] % 12 + 1, 1) - timedelta(days=1))
            as_of = {}
            for d, site_id, ha in planted_events:
                if d and d <= end:
                    as_of[site_id] = ha
            trend.append({
                'month': date(key[0], key[1], 1).strftime("%b '%y"),
                'new_sites': sum(1 for d in site_dates if d and mk(d) == key),
                'new_areas': sum(1 for d in area_dates if d and mk(d) == key),
                'sites_verified': sum(1 for d, _ in verified if d and mk(d) == key),
                'cumulative_sites': sum(1 for d in site_dates if d and d <= end),
                'verified_hectares': round(sum(ha for d, ha in verified if d and d <= end), 2),
                'planted_hectares': round(sum(as_of.values()), 2),
            })
        sites_before_window = sum(1 for d in site_dates if d and mk(d) < first_key)

        # ── Sites by barangay ──
        by_barangay = list(
            sites.values(brgy=Coalesce('reforestation_area__barangay__name', Value('Unassigned')))
            .annotate(
                sites=Count('site_id'),
                hectares=hectares,
                official=Count('site_id', filter=Q(meta_verification__status='verified',
                                                    status__in=OFFICIAL_SITE_STATUSES)),
            )
            .order_by('-hectares')[:10]
        )
        for b in by_barangay:
            b['name'] = b.pop('brgy')
            b['hectares'] = round(b['hectares'], 2)

        # ── Reforestation area table ──
        area_rows = []
        for a in (areas.select_related('barangay')
                  .annotate(
                      site_count=Count('sites', filter=Q(sites__is_active=True)),
                      verified_count=Count('sites', filter=Q(sites__is_active=True,
                                                             sites__meta_verification__status='verified')),
                      pending_count=Count('sites', filter=Q(sites__is_active=True,
                                                            sites__status__in=['pending', 'under_review'])),
                      monitoring_count=Count('sites', filter=Q(sites__is_active=True,
                                                               sites__monitoring_status='under_monitoring')),
                      area_ha=Coalesce(Sum('sites__total_area_hectares', filter=Q(sites__is_active=True)),
                                       Value(0.0)),
                  )
                  .order_by('-area_ha', 'name')[:8]):
            area_rows.append({
                'id': a.reforestation_area_id,
                'name': a.name,
                'barangay': a.barangay.name if a.barangay else '—',
                'sites': a.site_count,
                'verified': a.verified_count,
                'pending': a.pending_count,
                'under_monitoring': a.monitoring_count,
                'hectares': round(a.area_ha, 2),
            })

        # ── Map layers ──
        hazard_rows = HazardArea.objects.values('hazard_type').annotate(count=Count('hazard_area_id'))
        hazard_labels = dict(HazardArea.HAZARD_TYPES)
        hazards = [
            {'name': hazard_labels.get(h['hazard_type'], h['hazard_type']), 'value': h['count'],
             'fill': HAZARD_COLORS.get(h['hazard_type'], '#6b7280')}
            for h in hazard_rows
        ]
        classified = [
            {'name': c['lc'], 'value': c['value']}
            for c in Classified_areas.objects
            .values(lc=Coalesce('land_classification__name', Value('Unclassified')))
            .annotate(value=Count('classified_area_id')).order_by('-value')
        ]
        candidates = Potential_sites.objects.aggregate(
            count=Count('potential_sites_id'),
            hectares=Coalesce(Sum('area_hectares'), Value(0.0)),
            linked=Count('potential_sites_id', filter=Q(site__isnull=False)),
        )

        # ── Map data checks (things a GIS Specialist should fix) ──
        data_issues = []
        site_lookup = {}
        for s in sites.select_related('reforestation_area__barangay', 'meta_verification'):
            site_lookup[s.site_id] = s
            brgy = (s.reforestation_area.barangay.name
                    if s.reforestation_area and s.reforestation_area.barangay else '—')
            if not s.polygon_coordinates or (s.total_area_hectares or 0) <= 0:
                data_issues.append({'site_id': s.site_id, 'site': s.name, 'barangay': brgy,
                                    'issue': 'No site boundary / area is 0 ha', 'severity': 'high'})
            mv = getattr(s, 'meta_verification', None)
            if mv and mv.status == 'verified' and not mv.verified_land_classification_id:
                data_issues.append({'site_id': s.site_id, 'site': s.name, 'barangay': brgy,
                                    'issue': 'Verified without a land classification', 'severity': 'medium'})
        for site_id, ha in latest_planted.items():
            s = site_lookup.get(site_id)
            if s and (s.total_area_hectares or 0) > 0 and ha > s.total_area_hectares * 1.05:
                data_issues.append({
                    'site_id': site_id, 'site': s.name,
                    'barangay': (s.reforestation_area.barangay.name
                                 if s.reforestation_area and s.reforestation_area.barangay else '—'),
                    'issue': f'Planted polygon ({ha:.2f} ha) is larger than the site ({s.total_area_hectares:.2f} ha)',
                    'severity': 'high',
                })
            elif s and (s.total_area_hectares or 0) <= 0:
                data_issues.append({
                    'site_id': site_id, 'site': s.name,
                    'barangay': (s.reforestation_area.barangay.name
                                 if s.reforestation_area and s.reforestation_area.barangay else '—'),
                    'issue': f'Has a {ha:.2f} ha planted polygon but no site area to compare against',
                    'severity': 'high',
                })
        data_issues.sort(key=lambda i: 0 if i['severity'] == 'high' else 1)

        # ── Field assessments ──
        assessments = Field_assessment.objects.filter(is_submitted=True)
        assessments_total = assessments.count()
        assessments_month = assessments.filter(created_at__date__gte=month_start).count()

        # ── Recent activity (real events) ──
        events = []
        for s in sites.select_related('reforestation_area').order_by('-created_at')[:5]:
            events.append((s.created_at, 'info', s.name, 'Site created',
                           s.reforestation_area.name if s.reforestation_area else '—'))
        for v in (SiteMetaDataVerification.objects.filter(verified_at__isnull=False)
                  .select_related('site', 'verified_by__profile').order_by('-verified_at')[:5]):
            tone = 'success' if v.status == 'verified' else 'danger' if v.status == 'rejected' else 'warning'
            events.append((v.verified_at, tone, v.site.name, f'Site data {v.get_status_display().lower()}',
                           _person(v.verified_by)))
        for r in (ProgressReport.objects.filter(gis_reviewed_at__isnull=False)
                  .select_related('site', 'gis_reviewed_by__profile').order_by('-gis_reviewed_at')[:5]):
            approved = r.gis_review_status == 'approved'
            events.append((r.gis_reviewed_at, 'success' if approved else 'warning',
                           r.site.name if r.site else '—',
                           'Planted area confirmed' if approved else 'Planted area: changes requested',
                           _person(r.gis_reviewed_by)))
        for fa in (assessments.select_related('site', 'assigned_onsite_inspector__user__profile')
                   .order_by('-created_at')[:5]):
            inspector = fa.assigned_onsite_inspector.user if fa.assigned_onsite_inspector else None
            events.append((fa.created_at, 'info', fa.site.name if fa.site else (fa.title or 'Field assessment'),
                           'Field assessment submitted', _person(inspector)))
        events.sort(key=lambda e: e[0], reverse=True)
        recent_activity = [
            {'id': i, 'type': tone, 'site': site, 'action': action, 'officer': who, 'time': _time_ago(when)}
            for i, (when, tone, site, action, who) in enumerate(events[:8])
        ]

        official_ha = official_totals['hectares'] or 0
        summary = {
            'areas_total': areas_total,
            'areas_this_month': areas_this_month,
            'barangays_covered': barangays_covered,
            'sites_total': site_totals['count'],
            'sites_hectares': round(site_totals['hectares'] or 0, 2),
            'sites_this_month': sites_this_month,
            'sites_pending': sum(s['value'] for s in site_status if s['key'] in ('pending', 'under_review')),
            'official_sites': official_totals['count'],
            'official_hectares': round(official_ha, 2),
            'verification_pending': next((v['value'] for v in verification if v['key'] == 'pending'), 0),
            'sites_without_verification': sites_without_verification,
            'planted_hectares': planted_hectares,
            'planted_sites': len(latest_planted),
            'planted_coverage': round(planted_hectares / official_ha * 100, 1) if official_ha else None,
            'pending_reviews': pending_reviews,
            'awaiting_dm': awaiting_dm,
            'oldest_pending_days': review_queue[0]['waiting_days'] if review_queue else None,
            'reviewed_this_month': approved_month + changes_month,
            'approved_this_month': approved_month,
            'changes_this_month': changes_month,
            'avg_review_days': round(sum(turnaround) / len(turnaround), 1) if turnaround else None,
            'assessments_total': assessments_total,
            'assessments_this_month': assessments_month,
            'hazard_areas': sum(h['value'] for h in hazards),
            'classified_areas': sum(c['value'] for c in classified),
            'ndvi_candidates': candidates['count'],
            'ndvi_candidate_hectares': round(candidates['hectares'] or 0, 2),
            'ndvi_candidates_linked': candidates['linked'],
            'sites_before_window': sites_before_window,
            'data_issues': len(data_issues),
        }

        return JsonResponse({
            'summary': summary,
            'site_status': site_status,
            'verification': verification,
            'monitoring_status': monitoring_status,
            'trend': trend,
            'by_barangay': by_barangay,
            'areas': area_rows,
            'review_queue': review_queue,
            'hazards': hazards,
            'classified': classified,
            'recent_activity': recent_activity,
            'data_issues': data_issues[:10],
        }, status=200)

    except Exception as e:
        logger.error(f'Error in get_gis_dashboard: {e}', exc_info=True)
        return JsonResponse({'error': str(e)}, status=500)
