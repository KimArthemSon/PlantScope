"""
Onsite Inspector "My Reports" screen (mobile app).

The inspector's own work history:
  type=visits       progress reports they submitted (status, reviewer notes, plants recorded)
  type=assessments  field assessments they created (submitted / draft, layers, photos)

Filters: period (month | quarter | year | all), status, search.
"""
import logging
from datetime import date, timedelta

from django.db.models import Q
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt

from accounts.helper import get_user_from_token
from tree_planting_programs.models import ProgressReport

from .models import Field_assessment

logger = logging.getLogger(__name__)

LAYERS = ('meta_data', 'safety', 'survivability', 'boundary_verification')


def _local_date(dt):
    if not dt:
        return None
    return timezone.localtime(dt).date() if timezone.is_aware(dt) else dt.date()


def _period_start(period, today):
    if period == 'month':
        return today.replace(day=1)
    if period == 'quarter':
        return today - timedelta(days=90)
    if period == 'year':
        return today.replace(month=1, day=1)
    return None


def _last_months(today, n=6):
    keys, y, m = [], today.year, today.month
    for _ in range(n):
        keys.append((y, m))
        m -= 1
        if m == 0:
            y, m = y - 1, 12
    return list(reversed(keys))


def _barangay(site):
    if site and site.reforestation_area and site.reforestation_area.barangay:
        return site.reforestation_area.barangay.name
    return None


def _visit_status(r):
    if r.status == 'accepted':
        return 'accepted'
    if r.status == 'rejected':
        return 'returned'
    return 'pending'


def _review_stage(r):
    if r.status == 'accepted':
        return 'Accepted by Data Manager and GIS'
    if r.status == 'rejected':
        return 'Returned by GIS Specialist' if r.gis_review_status == 'changes_requested' else 'Returned by Data Manager'
    if r.dm_review_status == 'approved':
        return 'Waiting for GIS review'
    return 'Waiting for Data Manager review'


@csrf_exempt
def get_inspector_reports(request):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    try:
        user = get_user_from_token(request)
    except Exception:
        user = None
    if not user or user.user_role != 'OnsiteInspector':
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    kind = request.GET.get('type', 'visits')
    period = request.GET.get('period', 'all')
    status = request.GET.get('status', 'all')
    search = request.GET.get('search', '').strip()
    today = timezone.localdate()
    start = _period_start(period, today)
    months = _last_months(today)

    try:
        if kind == 'assessments':
            qs = (Field_assessment.objects.filter(assigned_onsite_inspector__user=user)
                  .select_related('assigned_onsite_inspector__reforestation_area__barangay', 'site')
                  .prefetch_related('images')
                  .order_by('-updated_at'))
            if start:
                qs = qs.filter(updated_at__date__gte=start)
            if search:
                qs = qs.filter(Q(title__icontains=search) | Q(site__name__icontains=search)
                               | Q(assigned_onsite_inspector__reforestation_area__name__icontains=search))
            all_rows = []
            for fa in qs[:300]:
                data = fa.field_assessment_data or {}
                area = fa.assigned_onsite_inspector.reforestation_area if fa.assigned_onsite_inspector else None
                all_rows.append({
                    'id': fa.field_assessment_id,
                    'title': fa.title or (fa.site.name if fa.site else 'General assessment'),
                    'date': _local_date(fa.sent_date or fa.updated_at).isoformat(),
                    'area_id': area.reforestation_area_id if area else None,
                    'area_name': area.name if area else '—',
                    'barangay': area.barangay.name if area and area.barangay else None,
                    'site_id': fa.site_id,
                    'site_name': fa.site.name if fa.site else None,
                    'status': 'submitted' if fa.is_submitted else 'draft',
                    'layers': [k for k in LAYERS if data.get(k)],
                    'photos': fa.images.count(),
                })
            counts = {'submitted': sum(1 for r in all_rows if r['status'] == 'submitted'),
                      'draft': sum(1 for r in all_rows if r['status'] == 'draft')}
            rows = [r for r in all_rows if status == 'all' or r['status'] == status]

            monthly = {k: 0 for k in months}
            for fa in Field_assessment.objects.filter(assigned_onsite_inspector__user=user, is_submitted=True):
                d = _local_date(fa.sent_date or fa.created_at)
                if d and (d.year, d.month) in monthly:
                    monthly[(d.year, d.month)] += 1

            return JsonResponse({'success': True, 'data': {
                'type': 'assessments',
                'summary': {
                    'total': len(all_rows),
                    'submitted': counts['submitted'],
                    'draft': counts['draft'],
                    'photos': sum(r['photos'] for r in all_rows),
                },
                'counts': counts,
                'monthly': [{'month': date(k[0], k[1], 1).strftime('%b'), 'submitted': v} for k, v in monthly.items()],
                'rows': rows,
            }}, status=200)

        # ── Monitoring visit reports ──
        qs = (ProgressReport.objects.filter(submitted_by=user)
              .select_related('site__reforestation_area__barangay', 'application__user__tree_grower_group')
              .prefetch_related('report_species__tree_species')
              .order_by('-created_at'))
        if start:
            qs = qs.filter(created_at__date__gte=start)
        if search:
            qs = qs.filter(Q(site__name__icontains=search) | Q(application__title__icontains=search)
                           | Q(application__user__tree_grower_group__group_name__icontains=search))
        all_rows = []
        for r in qs[:300]:
            planted = added = dead = 0
            species = []
            for sp in r.report_species.all():
                planted += sp.no_planted or 0
                added += sp.no_added_by_grower or 0
                dead += sp.no_dead or 0
                if sp.tree_species:
                    species.append(sp.tree_species.name)
            st = _visit_status(r)
            grp = getattr(r.application.user, 'tree_grower_group', None) if r.application else None
            notes = None
            if st == 'returned':
                notes = (r.gis_review_notes if r.gis_review_status == 'changes_requested' else r.dm_review_notes) or None
            all_rows.append({
                'id': r.progress_report_id,
                'date': _local_date(r.submitted_at or r.created_at).isoformat(),
                'site_id': r.site_id,
                'site_name': r.site.name if r.site else '—',
                'barangay': _barangay(r.site),
                'program': f'APP-{r.application.application_id:04d}' if r.application else None,
                'group_name': grp.group_name if grp else None,
                'visit_type': r.get_visit_type_display().split(' (')[0],
                'status': st,
                'stage': _review_stage(r),
                'notes': notes,
                'planted': planted + added,
                'dead': dead,
                'species': species[:3],
                'planted_hectares': round(r.planted_area_hectares, 2) if r.planted_area_hectares else None,
            })
        counts = {s: sum(1 for x in all_rows if x['status'] == s) for s in ('accepted', 'pending', 'returned')}
        rows = [x for x in all_rows if status == 'all' or x['status'] == status]
        decided = counts['accepted'] + counts['returned']

        monthly = {k: {'accepted': 0, 'returned': 0} for k in months}
        for r in ProgressReport.objects.filter(submitted_by=user, status__in=['accepted', 'rejected']):
            d = _local_date(r.submitted_at or r.created_at)
            if d and (d.year, d.month) in monthly:
                monthly[(d.year, d.month)]['accepted' if r.status == 'accepted' else 'returned'] += 1

        return JsonResponse({'success': True, 'data': {
            'type': 'visits',
            'summary': {
                'total': len(all_rows),
                'accepted': counts['accepted'],
                'pending': counts['pending'],
                'returned': counts['returned'],
                'acceptance_rate': round(counts['accepted'] / decided * 100) if decided else None,
                'plants_recorded': sum(x['planted'] for x in all_rows if x['status'] == 'accepted'),
                'deaths_recorded': sum(x['dead'] for x in all_rows if x['status'] == 'accepted'),
                'sites': len({x['site_id'] for x in all_rows if x['site_id']}),
            },
            'counts': counts,
            'monthly': [{'month': date(k[0], k[1], 1).strftime('%b'), **v} for k, v in monthly.items()],
            'rows': rows,
        }}, status=200)
    except Exception as e:
        logger.error(f'Error in get_inspector_reports: {e}', exc_info=True)
        return JsonResponse({'success': False, 'error': str(e)}, status=500)
