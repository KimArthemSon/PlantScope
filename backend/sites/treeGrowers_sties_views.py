import logging

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import get_object_or_404
from django.core.exceptions import ObjectDoesNotExist
from django.db.models import Count, Sum

from accounts.helper import get_cloudinary_url
from .models import Sites

from tree_planting_programs.models import (
    Application,
    ProgressReport,
    SeedlingRequest,
    SeedlingRequestSpecies,
)

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────
# CONSTANTS
# ─────────────────────────────────────────────
ACTIVE_APPLICATION_STATUSES = [
    'for_evaluation',
    'for_head',
    'accepted',
    'under_monitoring',
]


# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────
def _format_date(value):
    """Format date/datetime for JSON response."""
    if not value:
        return None
    return value.strftime('%B %d, %Y')


def _build_site_history(site):
    """
    Build ANONYMOUS, PAST-ONLY historical information for the site.

    ✅ PRIVACY: No application titles, no user info, no active applications.
    Only aggregate historical metrics are exposed.
    """

    # ─────────────────────────────────────────────
    # APPLICATION HISTORY (counts only)
    # ─────────────────────────────────────────────
    applications_qs = Application.objects.filter(site=site)
    total_applications = applications_qs.count()

    status_counts = dict(
        applications_qs
        .values('status')
        .annotate(count=Count('status'))
        .values_list('status', 'count')
    )

    # ✅ Programs that actually ran in the past (completed or failed)
    past_program_count = (
        status_counts.get('completed', 0) + status_counts.get('failed', 0)
    )

    # ─────────────────────────────────────────────
    # MONITORING / PROGRESS REPORT HISTORY
    # ─────────────────────────────────────────────
    progress_qs = (
        ProgressReport.objects
        .filter(application__site=site)
        .exclude(status='rejected')
    )

    total_monitoring_visits = progress_qs.count()
    initial_visit_count = progress_qs.filter(visit_type='initial').count()
    ongoing_visit_count = progress_qs.filter(visit_type='ongoing').count()

    latest_monitoring = (
        progress_qs
        .order_by('-submitted_at', '-created_at')
        .first()
    )

    recent_progress_reports = (
        progress_qs
        .annotate(
            total_survived_sum=Sum('report_species__no_survived'),
            total_dead_sum=Sum('report_species__no_dead'),
        )
        .order_by('-submitted_at', '-created_at')[:5]
    )

    recent_monitoring_visits = []

    for report in recent_progress_reports:
        total_survived = report.total_survived_sum or 0
        total_dead = report.total_dead_sum or 0
        total_plants = total_survived + total_dead

        survival_rate = 0.0
        if total_plants > 0:
            survival_rate = round((total_survived / total_plants) * 100, 2)

        recent_monitoring_visits.append({
            'progress_report_id': report.progress_report_id,
            'visit_type': report.visit_type,
            'visit_type_label': report.get_visit_type_display(),
            'status': report.status,
            'status_label': report.get_status_display(),
            'orientation_conducted': report.orientation_conducted,
            'submitted_at': _format_date(report.submitted_at or report.created_at),
            'total_survived': total_survived,
            'total_dead': total_dead,
            'total_plants': total_plants,
            'survival_rate': survival_rate,
        })

    # Survival rate based only on accepted progress reports
    accepted_monitoring_agg = (
        ProgressReport.objects
        .filter(application__site=site, status='accepted')
        .aggregate(
            total_survived=Sum('report_species__no_survived'),
            total_dead=Sum('report_species__no_dead'),
        )
    )

    accepted_survived = accepted_monitoring_agg.get('total_survived') or 0
    accepted_dead = accepted_monitoring_agg.get('total_dead') or 0
    accepted_total_plants = accepted_survived + accepted_dead

    average_survival_rate = 0.0
    if accepted_total_plants > 0:
        average_survival_rate = round((accepted_survived / accepted_total_plants) * 100, 2)

    # ─────────────────────────────────────────────
    # SEEDLING REQUEST HISTORY (aggregate only)
    # ─────────────────────────────────────────────
    seedling_requests_qs = (
        SeedlingRequest.objects
        .filter(application__site=site)
        .exclude(status='cancelled')
    )

    total_seedling_requests = seedling_requests_qs.count()

    seedling_species_qs = (
        SeedlingRequestSpecies.objects
        .filter(seedling_request__application__site=site)
        .exclude(seedling_request__status='cancelled')
    )

    seedling_totals = seedling_species_qs.aggregate(total_requested=Sum('quantity'))

    seedling_confirmed_totals = (
        seedling_species_qs
        .filter(seedling_request__status='confirmed')
        .aggregate(total_confirmed=Sum('quantity'))
    )

    total_seedlings_requested = seedling_totals.get('total_requested') or 0
    total_seedlings_confirmed = seedling_confirmed_totals.get('total_confirmed') or 0

    requested_species_rows = (
        seedling_species_qs
        .values('tree_species__tree_specie_id', 'tree_species__name')
        .annotate(total_quantity=Sum('quantity'))
        .order_by('-total_quantity')[:5]
    )

    requested_species = [
        {
            'species_id': row.get('tree_species__tree_specie_id'),
            'name': row.get('tree_species__name'),
            'total_quantity': row.get('total_quantity') or 0,
        }
        for row in requested_species_rows
    ]

    seedling_summary = {
        'total_requests': total_seedling_requests,
        'total_seedlings_requested': total_seedlings_requested,
        'total_seedlings_confirmed': total_seedlings_confirmed,
        'requested_species': requested_species,
    }

    # ─────────────────────────────────────────────
    # FINAL HISTORY OBJECT (anonymous, past-only)
    # ─────────────────────────────────────────────
    has_history = (
        total_applications > 0 or
        total_monitoring_visits > 0 or
        total_seedling_requests > 0
    )

    return {
        'has_history': has_history,
        'past_program_count': past_program_count,
        'summary': {
            'total_applications': total_applications,
            'past_program_count': past_program_count,
            'completed_application_count': status_counts.get('completed', 0),
            'rejected_application_count': status_counts.get('rejected', 0),
            'cancelled_application_count': status_counts.get('cancelled', 0),
            'failed_application_count': status_counts.get('failed', 0),
            'total_monitoring_visits': total_monitoring_visits,
            'initial_visit_count': initial_visit_count,
            'ongoing_visit_count': ongoing_visit_count,
            'latest_monitoring_date': _format_date(
                latest_monitoring.submitted_at or latest_monitoring.created_at
            ) if latest_monitoring else None,
            'average_survival_rate': average_survival_rate,
            'total_seedling_requests': total_seedling_requests,
            'total_seedlings_requested': total_seedlings_requested,
            'total_seedlings_confirmed': total_seedlings_confirmed,
        },
        'recent_monitoring_visits': recent_monitoring_visits,
        'seedling_summary': seedling_summary,
    }


# ─────────────────────────────────────────────
# SITE DETAILS FOR TREE GROWER
# ─────────────────────────────────────────────
@csrf_exempt
def get_site_details_for_tree_grower(request, site_id):
    """
    GET: Fetch detailed site information for tree grower view.
    Occupied sites are blocked with a clear error message.
    """

    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    site = get_object_or_404(
        Sites.objects.select_related('reforestation_area__barangay'),
        site_id=site_id,
        is_active=True,
        status='accepted',
    )

    # ─────────────────────────────────────────────
    # SAFE META VERIFICATION CHECK
    # ─────────────────────────────────────────────
    try:
        verification = site.meta_verification
    except ObjectDoesNotExist:
        verification = None

    if verification is None or verification.status != 'verified':
        return JsonResponse({'error': 'Site not available for application'}, status=400)

    # ─────────────────────────────────────────────
    # ✅ OCCUPANCY GUARD
    # If the site has an active application, block access entirely.
    # ─────────────────────────────────────────────
    is_occupied = Application.objects.filter(
        site=site,
        status__in=ACTIVE_APPLICATION_STATUSES
    ).exists()

    if is_occupied:
        return JsonResponse(
            {'error': 'This site is currently occupied and not open for new applications.'},
            status=400
        )

    # ─────────────────────────────────────────────
    # GENERAL IMAGES
    # ─────────────────────────────────────────────
    general_images = []

    for img in site.site_images.filter(layer_tag='general').order_by('created_at'):
        general_images.append({
            'image_id': img.site_image_id,
            'url': get_cloudinary_url(str(img.img)) if img.img else None,
            'caption': img.caption,
        })

    # ─────────────────────────────────────────────
    # RECOMMENDED SPECIES
    # ─────────────────────────────────────────────
    recommended_species = []

    for rec in site.species_recommendations.select_related('tree_species').order_by('priority_rank'):
        if rec.tree_species:
            recommended_species.append({
                'species_id': rec.tree_species.tree_specie_id,
                'name': rec.tree_species.name,
                'description': rec.tree_species.description,
                'priority_rank': rec.priority_rank,
                'notes': rec.notes,
            })

    # ─────────────────────────────────────────────
    # ACCESSIBILITY
    # ─────────────────────────────────────────────
    accessibility_info = None

    if verification.verified_accessibility:
        acc = verification.verified_accessibility

        if isinstance(acc, dict):
            accessibility_info = {
                'type': acc.get('type', 'Unknown'),
                'description': acc.get('description', ''),
            }
        elif isinstance(acc, str):
            accessibility_info = {'type': acc, 'description': ''}
        elif isinstance(acc, list):
            accessibility_info = {
                'type': 'Unknown',
                'description': ', '.join([str(item) for item in acc]),
            }

    # ─────────────────────────────────────────────
    # LAND CLASSIFICATION
    # ─────────────────────────────────────────────
    land_classification = None

    if verification.verified_land_classification:
        land_classification = {
            'id': verification.verified_land_classification.land_classification_id,
            'name': verification.verified_land_classification.name,
        }

    # ─────────────────────────────────────────────
    # SITE HISTORY (anonymous, past-only)
    # ─────────────────────────────────────────────
    site_history = _build_site_history(site)

    # ─────────────────────────────────────────────
    # SAFE AREA DETAILS
    # ─────────────────────────────────────────────
    reforestation_area = site.reforestation_area
    reforestation_area_name = reforestation_area.name if reforestation_area else 'N/A'

    barangay = getattr(reforestation_area, 'barangay', None) if reforestation_area else None
    barangay_name = barangay.name if barangay else 'N/A'

    # ─────────────────────────────────────────────
    # RESPONSE
    # ─────────────────────────────────────────────
    data = {
        'site_id': site.site_id,
        'name': site.name,
        'description': site.description,
        'reforestation_area': reforestation_area_name,
        'barangay': barangay_name,
        'total_area_hectares': site.total_area_hectares,
        'marker_coordinate': site.marker_coordinate,
        'polygon_coordinates': site.polygon_coordinates,
        'general_images': general_images,
        'recommended_species': recommended_species,
        'accessibility': accessibility_info,
        'land_classification': land_classification,
        'created_at': _format_date(site.created_at),
        'site_history': site_history,
    }

    return JsonResponse(data, status=200)