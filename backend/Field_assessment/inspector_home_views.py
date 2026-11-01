"""
Onsite Inspector home screen (mobile app).

One call with everything the inspector needs to plan the day:
  - who they are and which areas they cover
  - to-do: reports sent back for changes, seedling handovers, upcoming orientations,
    sites due for a monitoring visit, reports waiting for review, assessment drafts
  - this month's field work and acceptance rate
  - recent field assessments (with the ids the app needs to open them)
"""
import logging
from datetime import timedelta

from django.db.models import Max, Q
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt

from accounts.helper import get_cloudinary_url, get_user_from_token
from sites.models import Sites
from tree_planting_programs.models import Application, ProgressReport, SeedlingRequest

from .models import Assigned_onsite_inspector, Field_assessment

logger = logging.getLogger(__name__)

VISIT_DUE_DAYS = 30      # monitoring visit expected about monthly
VISIT_OVERDUE_DAYS = 90  # same overdue rule as the web dashboards


def _local_date(dt):
    if not dt:
        return None
    return timezone.localtime(dt).date() if timezone.is_aware(dt) else dt.date()


def _iso(dt):
    d = _local_date(dt) if hasattr(dt, 'hour') else dt
    return d.isoformat() if d else None


def _group_name(user):
    grp = getattr(user, 'tree_grower_group', None) if user else None
    return grp.group_name if grp else (user.email if user else '—')


def _barangay(site):
    if site and site.reforestation_area and site.reforestation_area.barangay:
        return site.reforestation_area.barangay.name
    return None


def _get_added(sp):
    """Safely get the 'added' count, handling potential model field name variations."""
    return getattr(sp, 'no_added', getattr(sp, 'added', getattr(sp, 'no_added_by_grower', 0))) or 0


def _totals(report):
    p = a = d = 0
    for sp in report.report_species.all():
        p += sp.no_planted or 0
        a += _get_added(sp)
        d += sp.no_dead or 0
    return p, a, d


@csrf_exempt
def get_inspector_home(request):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    try:
        user = get_user_from_token(request)
    except Exception:
        user = None
    if not user or user.user_role != 'OnsiteInspector':
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    try:
        now = timezone.now()
        today = timezone.localdate()
        month_start = today.replace(day=1)

        profile = getattr(user, 'profile', None)
        first_name = (getattr(profile, 'first_name', None) or user.email.split('@')[0]).strip()
        full_name = (f"{profile.first_name} {profile.last_name}".strip()
                     if profile and getattr(profile, 'first_name', None) else user.email)
        profile_img = (get_cloudinary_url(str(profile.profile_img))
                       if profile and getattr(profile, 'profile_img', None) else None)

        # ── Assigned areas ──
        assignments = list(Assigned_onsite_inspector.objects.filter(user=user)
                           .select_related('reforestation_area__barangay'))
        area_ids = [a.reforestation_area_id for a in assignments
                    if a.reforestation_area and not a.reforestation_area.deleted_at]
        site_counts = {}
        for s in Sites.objects.filter(is_active=True, reforestation_area_id__in=area_ids).values('reforestation_area_id'):
            site_counts[s['reforestation_area_id']] = site_counts.get(s['reforestation_area_id'], 0) + 1
        areas = [{
            'id': a.reforestation_area_id,
            'name': a.reforestation_area.name,
            'barangay': a.reforestation_area.barangay.name if a.reforestation_area.barangay else None,
            'sites': site_counts.get(a.reforestation_area_id, 0),
        } for a in assignments if a.reforestation_area_id in area_ids]

        # ── Reports sent back for changes (latest report per site, still not redone) ──
        my_reports = list(ProgressReport.objects.filter(submitted_by=user)
                          .select_related('site__reforestation_area__barangay', 'application__user__tree_grower_group')
                          .prefetch_related('report_species')
                          .order_by('-created_at'))
        latest_per_site = dict(ProgressReport.objects.filter(site_id__in={r.site_id for r in my_reports if r.site_id})
                               .values_list('site_id').annotate(last=Max('created_at')))
        returned = []
        for r in my_reports:
            if r.status != 'rejected' or not r.site_id:
                continue
            if latest_per_site.get(r.site_id) and latest_per_site[r.site_id] > r.created_at:
                continue  # a newer report already replaced it
            by = 'GIS Specialist' if r.gis_review_status == 'changes_requested' else 'Data Manager'
            returned.append({
                'id': r.progress_report_id,
                'site_id': r.site_id,
                'site_name': r.site.name,
                'barangay': _barangay(r.site),
                'visit_type': r.visit_type,  # Raw value to match frontend checks ("initial", "ongoing")
                'returned_by': by,
                'notes': (r.gis_review_notes if by == 'GIS Specialist' else r.dm_review_notes) or None,
                'date': _iso(r.gis_reviewed_at or r.dm_reviewed_at or r.updated_at),
            })

        pending_review = [r for r in my_reports if r.status == 'pending']

        # ── Seedling handovers assigned to me ──
        handovers = []
        for h in (SeedlingRequest.objects.filter(assigned_inspector=user, status='accepted')
                  .select_related('application__user__tree_grower_group', 'application__site__reforestation_area__barangay')
                  .prefetch_related('seedling_species__tree_species')
                  .order_by('created_at')):
            site = h.application.site if h.application else None
            qty = sum(sp.quantity or 0 for sp in h.seedling_species.all())
            handovers.append({
                'id': h.seedling_request_id,
                'group_name': _group_name(h.application.user) if h.application else '—',
                'site_name': site.name if site else None,
                'barangay': _barangay(site),
                'quantity': qty or h.no_request_seedling,
                'species': [sp.tree_species.name for sp in h.seedling_species.all() if sp.tree_species][:3],
                'fulfillment': h.get_fulfillment_type_display() if h.fulfillment_type else None,
                'waiting_days': (now - (h.updated_at or h.created_at)).days,
            })

        # ── Upcoming orientations (accepted programs in my areas) ──
        orientation_qs = Application.objects.filter(status='accepted', orientation_date__gte=today - timedelta(days=7))
        if area_ids:
            orientation_qs = orientation_qs.filter(site__reforestation_area_id__in=area_ids)
        orientations = [{
            'application_id': a.application_id,
            'ref': f'APP-{a.application_id:04d}',
            'title': a.title,
            'group_name': _group_name(a.user),
            'site_id': a.site_id,
            'site_name': a.site.name if a.site else None,
            'barangay': _barangay(a.site),
            'date': _iso(a.orientation_date),
            'days_until': (a.orientation_date - today).days,
            'participants': a.total_treegrowers_will_participate,
        } for a in orientation_qs.select_related('user__tree_grower_group', 'site__reforestation_area__barangay')
            .order_by('orientation_date')[:10]]

        # ── Sites due for a monitoring visit (active programs in my areas) ──
        active_apps = Application.objects.filter(status='under_monitoring', site__isnull=False)
        if area_ids:
            active_apps = active_apps.filter(site__reforestation_area_id__in=area_ids)
        active_apps = list(active_apps.select_related('user__tree_grower_group', 'site__reforestation_area__barangay'))
        site_ids = [a.site_id for a in active_apps]
        last_accepted = dict(ProgressReport.objects.filter(site_id__in=site_ids, status='accepted')
                             .values_list('site_id').annotate(last=Max('created_at')))
        has_initial = set(ProgressReport.objects.filter(site_id__in=site_ids, status='accepted', visit_type='initial')
                          .values_list('site_id', flat=True))
        has_pending = set(ProgressReport.objects.filter(site_id__in=site_ids, status='pending')
                          .values_list('site_id', flat=True))
        returned_sites = {r['site_id'] for r in returned}
        sites_due = []
        for a in active_apps:
            last = last_accepted.get(a.site_id)
            days = (now - last).days if last else None
            needs_initial = a.site_id not in has_initial
            if needs_initial:
                urgency, reason = 'high', 'Initial visit not done yet'
            elif days is None or days > VISIT_OVERDUE_DAYS:
                urgency, reason = 'high', f'No accepted visit in {days} days' if days is not None else 'Never visited'
            elif days > VISIT_DUE_DAYS:
                urgency, reason = 'medium', f'Last visit {days} days ago'
            else:
                urgency, reason = 'ok', f'Visited {days} day(s) ago'
            sites_due.append({
                'site_id': a.site_id,
                'site_name': a.site.name,
                'barangay': _barangay(a.site),
                'group_name': _group_name(a.user),
                'days_since_visit': days,
                'urgency': urgency,
                'reason': reason,
                'report_pending': a.site_id in has_pending,
                'report_returned': a.site_id in returned_sites,
            })
        order = {'high': 0, 'medium': 1, 'ok': 2}
        sites_due.sort(key=lambda s: (order[s['urgency']], -(s['days_since_visit'] or 9999)))

        # ── Assessment drafts ──
        my_fa = Field_assessment.objects.filter(assigned_onsite_inspector__user=user)
        drafts = my_fa.filter(is_submitted=False).count()

        # ── This month ──
        month_reports = [r for r in my_reports if _local_date(r.created_at) >= month_start]
        planted = dead = 0
        for r in month_reports:
            if r.status == 'accepted':
                p, a2, d = _totals(r)
                planted += p + a2
                dead += d
        decided = [r for r in my_reports if r.status in ('accepted', 'rejected')]
        accepted_all = sum(1 for r in decided if r.status == 'accepted')
        this_month = {
            'visits_submitted': len(month_reports),
            'visits_accepted': sum(1 for r in month_reports if r.status == 'accepted'),
            'visits_returned': sum(1 for r in month_reports if r.status == 'rejected'),
            'plants_recorded': planted,
            'deaths_recorded': dead,
            'assessments_submitted': my_fa.filter(is_submitted=True, created_at__date__gte=month_start).count(),
            'handovers_confirmed': SeedlingRequest.objects.filter(
                assigned_inspector=user, status='confirmed', updated_at__date__gte=month_start).count(),
        }

        last_fa = my_fa.order_by('-created_at').values_list('created_at', flat=True).first()
        last_report = my_reports[0].created_at if my_reports else None
        last_active = max([d for d in (last_fa, last_report) if d], default=None)

        # ── Recent assessments ──
        recent = []
        for fa in (my_fa.select_related('assigned_onsite_inspector__reforestation_area', 'site')
                   .prefetch_related('images').order_by('-updated_at')[:5]):
            data = fa.field_assessment_data or {}
            area = fa.assigned_onsite_inspector.reforestation_area if fa.assigned_onsite_inspector else None
            recent.append({
                'field_assessment_id': fa.field_assessment_id,
                'area_id': area.reforestation_area_id if area else None,
                'area_name': area.name if area else '—',
                'site_id': fa.site_id,
                'site_name': fa.site.name if fa.site else 'General assessment',
                'status': 'submitted' if fa.is_submitted else 'draft',
                'layers': [k for k in ('meta_data', 'safety', 'survivability', 'boundary_verification') if data.get(k)],
                'image_count': fa.images.count(),
                'date': _iso(fa.sent_date or fa.updated_at),
            })

        todo_count = len(returned) + len(handovers) + \
            sum(1 for o in orientations if 0 <= o['days_until'] <= 7) + \
            sum(1 for s in sites_due if s['urgency'] != 'ok' and not s['report_pending'] and not s['report_returned'])

        return JsonResponse({
            'success': True,
            'data': {
                'inspector': {
                    'first_name': first_name,
                    'full_name': full_name,
                    'email': user.email,
                    'profile_img': profile_img,
                    'last_active': _iso(last_active),
                },
                'areas': areas,
                'todo_count': todo_count,
                'returned_reports': returned,
                'handovers': handovers,
                'orientations': orientations,
                'sites_due': sites_due,
                'pending_review': len(pending_review),
                'drafts': drafts,
                'this_month': this_month,
                'acceptance_rate': round(accepted_all / len(decided) * 100) if decided else None,
                'recent_assessments': recent,
                'visit_due_days': VISIT_DUE_DAYS,
            },
        }, status=200)
    except Exception as e:
        logger.error(f'Error in get_inspector_home: {e}', exc_info=True)
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


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
                added += _get_added(sp)  # Safely fetches the added count regardless of exact model field name
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
                'visit_type': r.visit_type,  # Raw value ("initial", "ongoing") to match frontend checks
                'status': st,
                'stage': _review_stage(r),
                'notes': notes,
                'planted': planted,          # Separated: officially planted count
                'added': added,              # Separated: added by grower count
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
                # Updated to sum both planted and added for accurate total plants recorded
                'plants_recorded': sum(x['planted'] + x['added'] for x in all_rows if x['status'] == 'accepted'),
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