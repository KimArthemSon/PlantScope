import json
import logging
import math
from datetime import datetime, timedelta

import cloudinary.uploader
from django.db import transaction
from django.db.models import Case, Count, F, Max, Q, Sum, When, fields
from django.db.models.functions import Coalesce, TruncMonth
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt

from accounts.helper import (
    create_notification,
    delete_cloudinary_resource,
    get_cloudinary_url,
    get_user_from_token,
)
from accounts.models import User
from reforestation_areas.models import Reforestation_areas
from sites.models import SiteMetaDataVerification, Sites
from tree_species.models import Tree_species

from .email_service import (
    send_application_accepted_email,
    send_application_evaluated_email,
    send_application_rejected_email,
    send_program_completed_email,
    send_program_failed_email,
    send_seedling_request_accepted_email,
    send_seedling_request_rejected_email,
)
from .models import (
    Application,
    ProgressReport,
    ProgressReportSpecies,
    Reason,
    SeedlingRequest,
    SeedlingRequestSpecies,
)
from django.db.models.functions import TruncDate
from django.db.models import DateField

# Define the logger at the module level (outside any function)
logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# HELPER FUNCTIONS
# ─────────────────────────────────────────────────────────────────────────────

def serialize_seedling_request_species(seedling_request):
    """
    Serialize all species for a seedling request.
    Returns a list of species with their details.
    """
    return [{
        "species_id": s.tree_species.tree_specie_id,
        "species_name": s.tree_species.name,
        "quantity": s.quantity,
        "provided_by": s.provided_by,
    } for s in seedling_request.seedling_species.select_related('tree_species').all()]


def serialize_progress_report_species(progress_report):
    """
    Serialize all species for a progress report.
    Returns a list of species with survival data including baseline and additions.
    """
    return [{
        "species_id": s.tree_species.tree_specie_id,
        "species_name": s.tree_species.name,
        "no_planted": s.no_planted,
        "no_added_by_grower": s.no_added_by_grower,
        "no_survived": s.no_survived,
        "no_dead": s.no_dead,
        "total_accounted": s.no_planted + s.no_added_by_grower,
        "total": s.no_survived + s.no_dead,
        "survival_rate": s.survival_rate,
    } for s in progress_report.report_species.select_related('tree_species').all()]


# ─────────────────────────────────────────────────────────────────────────────
# APPLICATIONS (For DataManager Web Monitoring Page)
# ─────────────────────────────────────────────────────────────────────────────

@csrf_exempt
def get_applications(request):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    status_filter = request.GET.get('status', 'All')
    classification_filter = request.GET.get('classification', 'All')
    search = request.GET.get('search', '').strip()
    days_since_filter = request.GET.get('days_since', '').strip()
    
    try:
        entries = max(int(request.GET.get('entries', 10)), 10)
        page = max(int(request.GET.get('page', 1)), 1)
    except (ValueError, TypeError):
        entries, page = 10, 1

    qs = Application.objects.select_related('user__tree_grower_group').order_by('-created_at')
    
    # Annotate with effective date (last_report OR orientation_date)
    qs = qs.annotate(
        last_report_date=Max('progress_reports__created_at'),
        total_reports=Count('progress_reports'),
        effective_date=Case(
            When(last_report_date__isnull=False, 
                 then=TruncDate('last_report_date')),
            When(orientation_date__isnull=False, 
                 then=F('orientation_date')),
            default=None,
            output_field=DateField()
        )
    )
    
    if status_filter != 'All':
        qs = qs.filter(status=status_filter)
    if classification_filter != 'All':
        qs = qs.filter(classification=classification_filter)
    if search:
        qs = qs.filter(user__tree_grower_group__group_name__icontains=search)
    
    # Filter by effective date with MUTUALLY EXCLUSIVE ranges
    today = timezone.now().date()
    
    if days_since_filter == 'no_report':
        qs = qs.filter(total_reports=0)
    elif days_since_filter == '30_plus':
        cutoff_30 = today - timedelta(days=30)
        cutoff_60 = today - timedelta(days=60)
        qs = qs.filter(
            Q(effective_date__gte=cutoff_60, effective_date__lt=cutoff_30)
        )
    elif days_since_filter == '60_plus':
        cutoff_60 = today - timedelta(days=60)
        cutoff_90 = today - timedelta(days=90)
        qs = qs.filter(
            Q(effective_date__gte=cutoff_90, effective_date__lt=cutoff_60)
        )
    elif days_since_filter == '90_plus':
        cutoff_90 = today - timedelta(days=90)
        qs = qs.filter(effective_date__lt=cutoff_90)

    total = qs.count()
    total_page = math.ceil(total / entries) if total > 0 else 1
    offset = (page - 1) * entries

    data = []
    for app in qs[offset:offset + entries]:
        effective_date = app.effective_date 
        
        days_since = None
        last_report_date_str = None
        
        if effective_date:
            days_since = (today - effective_date).days
                
        if app.last_report_date:
            last_report_date_str = app.last_report_date.isoformat()
        
        data.append({
            "application_id": app.application_id,
            "group_name": app.user.tree_grower_group.group_name if hasattr(app.user, 'tree_grower_group') else "N/A",
            "group_type": app.user.tree_grower_group.get_group_type_display() if hasattr(app.user, 'tree_grower_group') else "N/A",
            "group_profile": get_cloudinary_url(str(app.user.tree_grower_group.profile_img)) if hasattr(app.user, 'tree_grower_group') and app.user.tree_grower_group.profile_img else None,
            "title": app.title,
            "orientation_date": app.orientation_date.isoformat() if app.orientation_date else None,
            "classification": app.classification,
            "status": app.status,
            "total_treegrowers_will_participate": app.total_treegrowers_will_participate,
            "created_at": app.created_at.strftime("%d/%m/%Y"),
            "last_report_date": last_report_date_str,
            "days_since_last_report": days_since,
        })

    return JsonResponse({
        'data': data, 
        'total_page': total_page, 
        'page': page, 
        'entries': entries, 
        'total': total
    }, status=200)


@csrf_exempt
def get_application(request, application_id):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    app = get_object_or_404(
        Application.objects.select_related(
            'user__tree_grower_group', 'user__profile',
            'site__reforestation_area__barangay',
            'site__meta_verification__verified_land_classification',
            'proposed_site__reforestation_area__barangay'
        ).prefetch_related(
            'site__site_images',
            'site__species_recommendations__tree_species'
        ),
        application_id=application_id
    )
    
    latest_reason = Reason.objects.filter(application=app).order_by('-created').first()
    seedling_requests = SeedlingRequest.objects.filter(application=app).order_by('-created_at')
    progress_reports = ProgressReport.objects.filter(application=app).order_by('-created_at')

    assigned_site_data = None
    if app.site:
        site = app.site
        meta = getattr(site, 'meta_verification', None)
        
        general_images = [
            {"image_url": get_cloudinary_url(str(img.img)) if img.img else None, "caption": img.caption} 
            for img in site.site_images.filter(layer_tag='general').order_by('-created_at')
        ]
        
        recommended_species = [
            {
                "species_id": rec.tree_species.tree_specie_id if rec.tree_species else None,
                "species_name": rec.tree_species.name if rec.tree_species else "Unknown",
                "rank": rec.priority_rank,
                "notes": rec.notes
            } 
            for rec in site.species_recommendations.select_related('tree_species').all().order_by('priority_rank')
        ]

        assigned_site_data = {
            "site_id": site.site_id,
            "name": site.name,
            "total_area_hectares": site.total_area_hectares,
            "polygon_coordinates": site.polygon_coordinates,
            "reforestation_area_name": site.reforestation_area.name if site.reforestation_area else None,
            "barangay_name": (site.reforestation_area.barangay.name if site.reforestation_area and site.reforestation_area.barangay else None),
            "accessibility": meta.verified_accessibility if meta else None,
            "land_classification_name": (meta.verified_land_classification.name if meta and meta.verified_land_classification else None),
            "general_images": general_images,
            "recommended_species": recommended_species,
        }

    proposed_site_data = None
    if app.proposed_site:
        prop = app.proposed_site
        proposed_site_data = {
            "site_id": prop.site_id,
            "name": prop.name,
            "barangay": (prop.reforestation_area.barangay.name if prop.reforestation_area and prop.reforestation_area.barangay else None),
        }

    data = {
        "application": {
            "application_id": app.application_id,
            "title": app.title,
            "classification": app.classification,
            "status": app.status,
            "total_treegrowers_will_participate": app.total_treegrowers_will_participate,
            "orientation_date": app.orientation_date.isoformat() if app.orientation_date else None,
            "proposed_orientation_date": app.proposed_orientation_date.isoformat() if app.proposed_orientation_date else None,
            "confirmed_at": app.confirmed_at.isoformat() if app.confirmed_at else None,
            "maintenance_plan": get_cloudinary_url(str(app.maintenance_plan)) if app.maintenance_plan else None,
            "agreement_image": get_cloudinary_url(str(app.agreement_image)) if app.agreement_image else None,
            "created_at": app.created_at.isoformat(),
            "updated_at": app.updated_at.isoformat(),
        },
        "group": {
            "group_name": app.user.tree_grower_group.group_name if hasattr(app.user, 'tree_grower_group') else "N/A",
            "group_type": app.user.tree_grower_group.get_group_type_display() if hasattr(app.user, 'tree_grower_group') else "N/A",
            "group_contact": app.user.tree_grower_group.contact if hasattr(app.user, 'tree_grower_group') else "",
            "group_address": app.user.tree_grower_group.address if hasattr(app.user, 'tree_grower_group') else "",
            "group_profile": get_cloudinary_url(str(app.user.tree_grower_group.profile_img)) if hasattr(app.user, 'tree_grower_group') and app.user.tree_grower_group.profile_img else None,
        },
        "profile": {
            "first_name": app.user.profile.first_name,
            "last_name": app.user.profile.last_name,
            "contact": app.user.profile.contact,
            "gender": app.user.profile.gender,
        } if hasattr(app.user, 'profile') and app.user.profile else None,
        "assigned_site": assigned_site_data,
        "proposed_site": proposed_site_data,
        
        # ✅ UPDATED: Seedling Requests Serialization with new fields
        "seedling_requests": [{
            "request_id": sr.seedling_request_id,
            "no_request_seedling": sr.no_request_seedling,
            "species": serialize_seedling_request_species(sr),
            "status": sr.status,
            "fulfillment_type": sr.fulfillment_type,
            "reason": sr.reason,
            "reason_accepted": sr.reason_accepted,
            "proof_of_delivery": get_cloudinary_url(str(sr.proof_of_delivery)) if sr.proof_of_delivery else None,
            "assigned_inspector": {
                "name": f"{sr.assigned_inspector.profile.first_name} {sr.assigned_inspector.profile.last_name}".strip() if hasattr(sr.assigned_inspector, 'profile') and sr.assigned_inspector.profile else (sr.assigned_inspector.email if sr.assigned_inspector else "Unassigned"),
                "contact": sr.assigned_inspector.profile.contact if hasattr(sr.assigned_inspector, 'profile') and sr.assigned_inspector.profile else "",
            } if sr.assigned_inspector else None,
            "submitted_at": sr.submitted_at.isoformat() if sr.submitted_at else None
        } for sr in seedling_requests],
        
        # ✅ UPDATED: Progress Reports with visit_type and agreement_image
        "progress_reports": [{
            "report_id": pr.progress_report_id,
            "visit_type": pr.visit_type,
            "orientation_conducted": pr.orientation_conducted,
            "total_survived": pr.total_survived,
            "total_dead": pr.total_dead,
            "total_added_by_grower": pr.total_added_by_grower,
            "species": serialize_progress_report_species(pr),
            "description": pr.description,
            "status": pr.status,
            "proof_image": get_cloudinary_url(str(pr.proof_image_monitor_required)) if pr.proof_image_monitor_required else None,
            "agreement_image": get_cloudinary_url(str(pr.agreement_image)) if pr.agreement_image else None,
            "submitted_at": pr.submitted_at.isoformat() if pr.submitted_at else None
        } for pr in progress_reports],
        "latest_reason": {
            "reason": latest_reason.reason,
            "status": latest_reason.status,
            "created": latest_reason.created.isoformat()
        } if latest_reason else None
    }
    return JsonResponse(data, status=200)


@csrf_exempt
def get_ongoing_applications(request):
    """GET /api/ongoing-applications/?barangay=San+Isidro&urgency=all&sort=newest"""
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    user = get_user_from_token(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    barangay = request.GET.get('barangay', '').strip()
    urgency_filter = request.GET.get('urgency', 'all').strip()
    sort_by = request.GET.get('sort', 'newest').strip()
    classification = request.GET.get('classification', 'all').strip()
    
    status_list = ['accepted', 'under_monitoring']
    
    qs = Application.objects.filter(status__in=status_list).select_related(
        'site__reforestation_area__barangay', 
        'site__meta_verification__verified_land_classification',
        'site__meta_verification',
        'user__tree_grower_group',
        'user__profile'
    ).prefetch_related(
        'progress_reports__report_species__tree_species',
        'site__species_recommendations__tree_species'
    ).annotate(
        last_report_date=Max('progress_reports__created_at'),
        total_survived=Coalesce(Sum('progress_reports__report_species__no_survived', 
                                   filter=Q(progress_reports__status='accepted')), 0),
        total_dead=Coalesce(Sum('progress_reports__report_species__no_dead',
                               filter=Q(progress_reports__status='accepted')), 0),
        total_reports=Count('progress_reports'),
        effective_date=Case(
            When(last_report_date__isnull=False, 
                 then=TruncDate('last_report_date')),
            When(orientation_date__isnull=False, 
                 then=F('orientation_date')),
            default=None,
            output_field=DateField()
        )
    )
    
    if barangay:
        qs = qs.filter(site__reforestation_area__barangay__name__icontains=barangay)
    
    if classification != 'all':
        qs = qs.filter(classification=classification)
    
    today = timezone.now().date()
    
    if urgency_filter != 'all':
        if urgency_filter == 'no_report':
            qs = qs.filter(total_reports=0)
        elif urgency_filter == '90_plus':
            cutoff_date = today - timedelta(days=90)
            qs = qs.filter(effective_date__lt=cutoff_date)
        elif urgency_filter == '60_plus':
            cutoff_60 = today - timedelta(days=60)
            cutoff_90 = today - timedelta(days=90)
            qs = qs.filter(
                Q(effective_date__gte=cutoff_90, effective_date__lt=cutoff_60)
            )
        elif urgency_filter == '30_plus':
            cutoff_30 = today - timedelta(days=30)
            cutoff_60 = today - timedelta(days=60)
            qs = qs.filter(
                Q(effective_date__gte=cutoff_60, effective_date__lt=cutoff_30)
            )
    
    if sort_by == 'newest':
        qs = qs.order_by('-created_at')
    elif sort_by == 'oldest':
        qs = qs.order_by('created_at')
    elif sort_by == 'urgent':
        qs = qs.order_by(F('effective_date').asc(nulls_first=True))
    
    data = []
    for app in qs:
        effective_date = app.effective_date
        
        days_since = None
        if effective_date:
            days_since = (today - effective_date).days
        
        total_plants = app.total_survived + app.total_dead
        survival_rate = round((app.total_survived / total_plants * 100), 1) if total_plants > 0 else 0
        
        site_data = None
        recommended_species = []
        if app.site:
            meta = getattr(app.site, 'meta_verification', None)
            
            recommended_species = [
                {
                    "species_id": rec.tree_species.tree_specie_id if rec.tree_species else None,
                    "species_name": rec.tree_species.name if rec.tree_species else "Unknown",
                    "priority_rank": rec.priority_rank,
                    "notes": rec.notes
                }
                for rec in app.site.species_recommendations.select_related('tree_species').all().order_by('priority_rank')[:3]
            ]
            
            site_data = {
                "site_id": app.site.site_id,
                "name": app.site.name,
                "total_area_hectares": app.site.total_area_hectares,
                "accessibility": meta.verified_accessibility if meta else None,
                "land_classification": (
                    meta.verified_land_classification.name 
                    if meta and meta.verified_land_classification else None
                ),
                "recommended_species": recommended_species,
            }
        
        group_contact = None
        if hasattr(app.user, 'profile') and app.user.profile:
            group_contact = {
                "contact": app.user.profile.contact,
                "full_name": f"{app.user.profile.first_name} {app.user.profile.last_name}",
            }
        
        # ✅ NEW: Add visit_type_hint for mobile app
        visit_type_hint = "needs_orientation" if app.status == 'accepted' else "needs_ongoing"
        
        data.append({
            "application_id": app.application_id,
            "title": app.title,
            "group_name": app.user.tree_grower_group.group_name if hasattr(app.user, 'tree_grower_group') else "N/A",
            "group_contact": group_contact,
            "status": app.status,
            "classification": app.classification,
            "visit_type_hint": visit_type_hint,  # ✅ NEW
            "site_name": app.site.name if app.site else None,
            "barangay": (
                app.site.reforestation_area.barangay.name 
                if app.site and app.site.reforestation_area and app.site.reforestation_area.barangay 
                else None
            ),
            "orientation_date": app.orientation_date.isoformat() if app.orientation_date else None,
            "last_report_date": app.last_report_date.isoformat() if app.last_report_date else None,
            "days_since_last_report": days_since,
            "total_survived": app.total_survived,
            "total_dead": app.total_dead,
            "survival_rate": survival_rate,
            "total_reports": app.total_reports,
            "site_details": site_data,
        })

    return JsonResponse(data, safe=False, status=200)


@csrf_exempt
def get_tree_grower_application(request):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    user = get_user_from_token(request)
    if not user or user.user_role != 'treeGrowers':
        return JsonResponse({'error': 'Unauthorized: TreeGrowers only'}, status=403)

    app = Application.objects.select_related(
        'user__tree_grower_group',
        'user__profile',
        'site__reforestation_area__barangay',
        'site__meta_verification',
        'site__meta_verification__verified_land_classification'
    ).prefetch_related(
        'site__site_images',
        'site__species_recommendations',
        'site__species_recommendations__tree_species'
    ).filter(user=user).order_by('-created_at').first()
    
    group_data = {
        "group_name": user.tree_grower_group.group_name,
        "group_type": user.tree_grower_group.get_group_type_display(),
        "group_contact": user.tree_grower_group.contact,
        "group_address": user.tree_grower_group.address,
        "group_profile": get_cloudinary_url(str(user.tree_grower_group.profile_img)) if user.tree_grower_group.profile_img else None,
    } if hasattr(user, 'tree_grower_group') else None
    
    profile_data = {
        "first_name": user.profile.first_name,
        "last_name": user.profile.last_name,
        "contact": user.profile.contact,
        "gender": user.profile.gender,
        "profile_img": get_cloudinary_url(str(user.profile.profile_img)) if user.profile.profile_img else None,
    } if hasattr(user, 'profile') and user.profile else None

    if not app:
        return JsonResponse({
            "application": None,
            "group": group_data,
            "profile": profile_data,
            "assigned_site": None,
            "proposed_site": None,
            "seedling_requests": [],
            "progress_reports": [],
            "latest_reason": None
        }, status=200)

    seedling_requests = SeedlingRequest.objects.filter(application=app).order_by('-created_at')
    progress_reports = ProgressReport.objects.filter(application=app).order_by('-created_at')
    latest_reason = Reason.objects.filter(application=app).order_by('-created').first()

    assigned_site_data = None
    if app.site:
        site = app.site
        meta = getattr(site, 'meta_verification', None)
        
        general_images = [
            {
                "image_url": get_cloudinary_url(str(img.img)) if img.img else None,
                "caption": img.caption
            } 
            for img in site.site_images.filter(layer_tag='general').order_by('-created_at')
        ]
        
        recommended_species = [
            {
                "species_id": rec.tree_species.tree_specie_id if rec.tree_species else None,
                "species_name": rec.tree_species.name if rec.tree_species else "Unknown",
                "rank": rec.priority_rank
            } 
            for rec in site.species_recommendations.select_related('tree_species').all().order_by('priority_rank')
        ]

        assigned_site_data = {
            "site_id": site.site_id,
            "name": site.name,
            "description": site.description,
            "total_area_hectares": site.total_area_hectares,
           
            "polygon_coordinates": site.polygon_coordinates,
            "reforestation_area_name": site.reforestation_area.name if site.reforestation_area else None,
            "barangay_name": (
                site.reforestation_area.barangay.name 
                if site.reforestation_area and site.reforestation_area.barangay 
                else None
            ),
            "accessibility": meta.verified_accessibility if meta else None,
            "land_classification_name": (
                meta.verified_land_classification.name 
                if meta and meta.verified_land_classification else None
            ),
            "general_images": general_images,
            "recommended_species": recommended_species,
        }

    proposed_site_data = None
    if app.proposed_site:
        prop = app.proposed_site
        proposed_site_data = {
            "site_id": prop.site_id,
            "name": prop.name,
            "barangay": (
                prop.reforestation_area.barangay.name 
                if prop.reforestation_area and prop.reforestation_area.barangay 
                else None
            ),
        }

    data = {
        "application": {
            "application_id": app.application_id,
            "title": app.title,
            "classification": app.classification,
            "status": app.status,
            "total_treegrowers_will_participate": app.total_treegrowers_will_participate,
            "orientation_date": app.orientation_date.isoformat() if app.orientation_date else None,
            "proposed_orientation_date": app.proposed_orientation_date.isoformat() if app.proposed_orientation_date else None,
            "confirmed_at": app.confirmed_at.isoformat() if app.confirmed_at else None,
            "maintenance_plan": get_cloudinary_url(str(app.maintenance_plan)) if app.maintenance_plan else None,
            "agreement_image": get_cloudinary_url(str(app.agreement_image)) if app.agreement_image else None,
            "created_at": app.created_at.isoformat(),
            "updated_at": app.updated_at.isoformat(),
        },
        "group": group_data,
        "profile": profile_data,
        "assigned_site": assigned_site_data,
        "proposed_site": proposed_site_data,
        
        # ✅ UPDATED: Seedling Requests Serialization with new fields
        "seedling_requests": [{
            "request_id": sr.seedling_request_id,
            "no_request_seedling": sr.no_request_seedling,
            "species": serialize_seedling_request_species(sr),
            "status": sr.status,
            "fulfillment_type": sr.fulfillment_type,
            "reason": sr.reason,
            "reason_accepted": sr.reason_accepted,
            "proof_of_delivery": get_cloudinary_url(str(sr.proof_of_delivery)) if sr.proof_of_delivery else None,
            "assigned_inspector": {
                "name": f"{sr.assigned_inspector.profile.first_name} {sr.assigned_inspector.profile.last_name}".strip() if hasattr(sr.assigned_inspector, 'profile') and sr.assigned_inspector.profile else (sr.assigned_inspector.email if sr.assigned_inspector else "Unassigned"),
                "contact": sr.assigned_inspector.profile.contact if hasattr(sr.assigned_inspector, 'profile') and sr.assigned_inspector.profile else "",
            } if sr.assigned_inspector else None,
            "submitted_at": sr.submitted_at.isoformat() if sr.submitted_at else None
        } for sr in seedling_requests],
        
        # ✅ UPDATED: Progress Reports with visit_type and agreement_image
        "progress_reports": [{
            "report_id": pr.progress_report_id,
            "visit_type": pr.visit_type,
            "orientation_conducted": pr.orientation_conducted,
            "total_survived": pr.total_survived,
            "total_dead": pr.total_dead,
            "total_added_by_grower": pr.total_added_by_grower,
            "species": serialize_progress_report_species(pr),
            "description": pr.description,
            "status": pr.status,
            "proof_image": get_cloudinary_url(str(pr.proof_image_monitor_required)) if pr.proof_image_monitor_required else None,
            "agreement_image": get_cloudinary_url(str(pr.agreement_image)) if pr.agreement_image else None,
            "submitted_at": pr.submitted_at.isoformat() if pr.submitted_at else None
        } for pr in progress_reports],
        "latest_reason": {
            "reason": latest_reason.reason,
            "status": latest_reason.status,
            "created": latest_reason.created.isoformat()
        } if latest_reason else None
    }
    return JsonResponse(data, status=200)

# ─────────────────────────────────────────────────────────────────────────────
# EVALUATION & CONFIRMATION WORKFLOW
# ─────────────────────────────────────────────────────────────────────────────

@csrf_exempt
def evaluate_application(request, application_id):
    """DataManager: Assign site and orientation date, add reason → forward to Head"""
    if request.method not in ('PUT', 'POST'):
        return JsonResponse({'error': 'Only PUT/POST allowed'}, status=405)

    user = get_user_from_token(request)
    if not user or user.user_role != 'DataManager':
        return JsonResponse({'error': 'Unauthorized: DataManager only'}, status=403)

    app = get_object_or_404(Application, application_id=application_id)
    if app.status not in ['for_evaluation']:
        return JsonResponse({'error': 'Application not in evaluation stage'}, status=400)

    site_id = request.POST.get('site_id')
    orientation_date_str = request.POST.get('orientation_date')
    status = request.POST.get('status')
    reason_text = request.POST.get('reason', '').strip()
    
    site = None
    if site_id:
        site = get_object_or_404(Sites, site_id=site_id)
        
    if not orientation_date_str:
        return JsonResponse({'error': 'orientation_date is required'}, status=400)

    try:
        orientation_date = datetime.strptime(orientation_date_str, '%Y-%m-%d').date()
    except ValueError:
        return JsonResponse({'error': 'Invalid date format. Please use YYYY-MM-DD.'}, status=400)

    try:
        with transaction.atomic():
            app.site = site
            app.orientation_date = orientation_date
            app.status = status
            
            # ️ DEPRECATED: Agreement image upload removed from evaluation
            # Agreement is now uploaded during initial visit by inspector
            app.save()

            Reason.objects.create(
                user=user,
                application=app,
                status_layer='new_program',
                reason=reason_text,
                status=status
            )

        try:
            site_info = f" at {site.name}" if site else ""
            orientation_info = f" Orientation scheduled for {orientation_date.strftime('%B %d, %Y')}." if orientation_date else ""
            
            create_notification(
                user=app.user,
                type='info',
                title='📋 Application Evaluated',
                description=f'Your application "{app.title}" has been evaluated by the Data Manager and forwarded to the City ENRO Head for final approval.{site_info}.{orientation_info}',
                link='/tree-growers/applications'
            )
        except Exception as notif_err:
            logger.error(f"Failed to create evaluation notification: {str(notif_err)}")

        try:
            send_application_evaluated_email(app.user, app)
        except Exception as email_err:
            logger.error(f"Failed to send evaluation email: {str(email_err)}")

        return JsonResponse({
            'message': 'Application evaluated and forwarded to Head', 
            'application_id': app.application_id
        }, status=200)
        
    except Sites.DoesNotExist:
        return JsonResponse({'error': 'Selected site not found'}, status=404)
    except Exception as e:
        return JsonResponse({'error': f'Server error: {str(e)}'}, status=500)


@csrf_exempt
def confirm_application(request, application_id):
    """City ENRO Head: Accept or Reject"""
    if request.method != 'PUT':
        return JsonResponse({'error': 'Only PUT allowed'}, status=405)

    user = get_user_from_token(request)
    if not user or user.user_role != 'CityENROHead':
        return JsonResponse({'error': 'Unauthorized: Head only'}, status=403)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    status = data.get('status')
    reason_text = data.get('reason', '').strip()
    
    if status not in ['accepted', 'rejected']:
        return JsonResponse({'error': 'Status must be accepted or rejected'}, status=400)

    app = get_object_or_404(Application, application_id=application_id)
    if app.status != 'for_head':
        return JsonResponse({'error': 'Application not ready for confirmation'}, status=400)

    try:
        with transaction.atomic():
            app.confirmed_at = timezone.now().date()
            
            if status == 'accepted':
                app.user.is_active = True
                app.user.save()
                workflow_status = 'accepted'
            else:
                workflow_status = 'rejected'
            
            app.status = workflow_status
            app.classification = 'old'
            app.save()

            Reason.objects.create(
                user=user,
                application=app,
                status_layer='new_program',
                reason=reason_text,
                status=status
            )

        try:
            if status == 'accepted':
                create_notification(
                    user=app.user,
                    type='success',
                    title=' Application Approved!',
                    description=f'Congratulations! Your application "{app.title}" has been approved by the City ENRO Head. Please prepare for the orientation and coordinate with the ENRO office for next steps.',
                    link='/tree-growers/applications'
                )
            else:
                reason_display = f" Reason: {reason_text}" if reason_text else ""
                create_notification(
                    user=app.user,
                    type='alert',
                    title='❌ Application Rejected',
                    description=f'Your application "{app.title}" was not approved by the City ENRO Head.{reason_display}',
                    link='/tree-growers/applications'
                )
        except Exception as notif_err:
            logger.error(f"Failed to create confirmation notification: {str(notif_err)}")

        try:
            if status == 'accepted':
                send_application_accepted_email(app.user, app)
            else:
                send_application_rejected_email(app.user, app, reason_text)
        except Exception as email_err:
            logger.error(f"Failed to send confirmation email: {str(email_err)}")

        return JsonResponse({
            'message': f'Application {status}', 
            'new_status': app.status
        }, status=200)
        
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
def complete_application(request, application_id):
    """DataManager: Finalize program as completed or failed"""
    if request.method != 'PUT':
        return JsonResponse({'error': 'Only PUT allowed'}, status=405)

    user = get_user_from_token(request)
    if not user or user.user_role != 'DataManager':
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    new_status = data.get('status', 'completed').strip()
    reason_text = data.get('reason', 'Program finalized.').strip()
    
    if new_status not in ['completed', 'failed']:
        return JsonResponse({'error': 'Status must be completed or failed'}, status=400)

    app = get_object_or_404(Application, application_id=application_id)
    
    if app.status not in ['accepted', 'under_monitoring']:
        return JsonResponse({'error': 'Application must be accepted or under monitoring to finalize'}, status=400)

    try:
        with transaction.atomic():
            app.status = new_status
            app.save()
            
            Reason.objects.create(
                user=user,
                application=app,
                status_layer='new_program',
                reason=reason_text,
                status=new_status
            )
            
            if new_status == 'completed' and app.site:
                app.site.status = 'completed'
                app.site.save()

        try:
            if new_status == 'completed':
                create_notification(
                    user=app.user,
                    type='success',
                    title=' Program Completed!',
                    description=f'Congratulations! Your tree planting program "{app.title}" has been successfully completed. Thank you for your valuable contribution to Ormoc City\'s reforestation efforts! You are now eligible to apply for future programs.',
                    link='/tree-growers/applications'
                )
            else:
                reason_display = f" Reason: {reason_text}" if reason_text else ""
                create_notification(
                    user=app.user,
                    type='alert',
                    title='️ Program Failed',
                    description=f'Your tree planting program "{app.title}" has been marked as failed.{reason_display} Please coordinate with the ENRO office to discuss next steps.',
                    link='/tree-growers/applications'
                )
        except Exception as notif_err:
            logger.error(f"Failed to create completion notification: {str(notif_err)}")

        try:
            if new_status == 'completed':
                send_program_completed_email(app.user, app)
            else:
                send_program_failed_email(app.user, app, reason_text)
        except Exception as email_err:
            logger.error(f"Failed to send completion email: {str(email_err)}")

        return JsonResponse({
            'message': f'Application marked as {new_status}',
            'new_status': new_status
        }, status=200)
        
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)
    

# ─────────────────────────────────────────────────────────────────────────────
# SEEDLING REQUESTS (Only Creation remains here, Management moved to request_views.py)
# ─────────────────────────────────────────────────────────────────────────────

@csrf_exempt
def create_seedling_request(request):
    """TreeGrower: Request additional seedlings/assistance"""
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)

    user = get_user_from_token(request)
    if not user or user.user_role != 'treeGrowers':
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    app_id = request.POST.get('application_id')
    description = request.POST.get('description', '').strip()
    seedling_species_json = request.POST.get('seedling_species')
    
    if not app_id or not seedling_species_json:
        return JsonResponse({'error': 'application_id and seedling_species required'}, status=400)

    try:
        seedling_species = json.loads(seedling_species_json)
        if not isinstance(seedling_species, list):
            raise ValueError("seedling_species must be a JSON array")
    except (ValueError, json.JSONDecodeError) as e:
        return JsonResponse({'error': f'Invalid seedling_species format: {str(e)}'}, status=400)

    app = get_object_or_404(Application, application_id=app_id, user=user)
    if app.status not in ['accepted', 'under_monitoring', 'completed']:
        return JsonResponse({'error': 'Cannot request seedlings for this application status'}, status=400)

    try:
        with transaction.atomic():
            req = SeedlingRequest.objects.create(
                application=app,
                description=description,
                status='pending',
            )

            total_seedlings = 0
            for item in seedling_species:
                if not isinstance(item, dict):
                    raise ValueError("Each seedling species must be an object")
                
                tree_species_id = item.get('tree_species_id')
                quantity = item.get('quantity', 0)
                provided_by = item.get('provided_by', 'ENRO Nursery')

                if not tree_species_id or quantity < 1:
                    raise ValueError(f"Invalid species data: {item}")

                tree_species = get_object_or_404(Tree_species, tree_specie_id=tree_species_id)

                SeedlingRequestSpecies.objects.create(
                    seedling_request=req,
                    tree_species=tree_species,
                    quantity=int(quantity),
                    provided_by=provided_by,
                )
                total_seedlings += int(quantity)

            req.no_request_seedling = total_seedlings
            req.save()

        return JsonResponse({'message': 'Seedling request submitted', 'request_id': req.seedling_request_id}, status=201)
    except Tree_species.DoesNotExist as e:
        return JsonResponse({'error': f'Tree species not found: {str(e)}'}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


# ─────────────────────────────────────────────────────────────────────────────
# PROGRESS REPORTS (Onsite Monitoring) - ✅ UPDATED
# ─────────────────────────────────────────────────────────────────────────────

@csrf_exempt
def create_progress_report(request):
    """OnsiteInspector: Submit monitoring report (Initial or Ongoing)"""
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)

    user = get_user_from_token(request)
    if not user or user.user_role != 'OnsiteInspector':
        return JsonResponse({'error': 'Unauthorized: OnsiteInspector only'}, status=403)

    app_id = request.POST.get('application_id')
    visit_type = request.POST.get('visit_type', 'initial')
    description = request.POST.get('description', '').strip()
    report_species_json = request.POST.get('report_species')
    
    if not app_id or not report_species_json:
        return JsonResponse({'error': 'application_id and report_species required'}, status=400)

    # ✅ NEW: ENFORCE PROOF IMAGE FOR ALL VISITS (Initial & Ongoing)
    if 'proof_image' not in request.FILES:
        return JsonResponse({'error': 'Proof image is required for all monitoring visits'}, status=400)

    try:
        report_species = json.loads(report_species_json)
        if not isinstance(report_species, list):
            raise ValueError("report_species must be a JSON array")
    except (ValueError, json.JSONDecodeError) as e:
        return JsonResponse({'error': f'Invalid report_species format: {str(e)}'}, status=400)

    app = get_object_or_404(Application, application_id=app_id)
    if app.status not in ['accepted', 'under_monitoring']:
        return JsonResponse({'error': 'Application not under monitoring'}, status=400)

    if visit_type not in ['initial', 'ongoing']:
        return JsonResponse({'error': 'visit_type must be "initial" or "ongoing"'}, status=400)

    # ✅ Initial visit specific validations
    if visit_type == 'initial':
        if 'agreement_image' not in request.FILES:
            return JsonResponse({'error': 'agreement_image is required for initial visit'}, status=400)
        
        orientation_conducted = request.POST.get('orientation_conducted', 'false').lower() == 'true'
        if not orientation_conducted:
            return JsonResponse({'error': 'orientation_conducted must be true for initial visit'}, status=400)

    try:
        with transaction.atomic():
            report = ProgressReport.objects.create(
                application=app,
                visit_type=visit_type,
                description=description,
                proof_image_monitor_required=request.FILES['proof_image'],  # ✅ Now strictly required
                agreement_image=request.FILES.get('agreement_image') if visit_type == 'initial' else None,
                orientation_conducted=(request.POST.get('orientation_conducted', 'false').lower() == 'true') if visit_type == 'initial' else False,
                status='pending'
            )

            for item in report_species:
                if not isinstance(item, dict):
                    raise ValueError("Each report species must be an object")
                
                tree_species_id = item.get('tree_species_id')
                no_survived = item.get('no_survived', 0)
                no_dead = item.get('no_dead', 0)
                no_planted = item.get('no_planted', 0)
                no_added_by_grower = item.get('no_added_by_grower', 0)

                if not tree_species_id:
                    raise ValueError(f"Missing tree_species_id: {item}")

                tree_species = get_object_or_404(Tree_species, tree_specie_id=tree_species_id)

                ProgressReportSpecies.objects.create(
                    progress_report=report,
                    tree_species=tree_species,
                    no_planted=int(no_planted),
                    no_added_by_grower=int(no_added_by_grower),
                    no_survived=int(no_survived),
                    no_dead=int(no_dead),
                )

        return JsonResponse({
            'message': 'Progress report submitted', 
            'report_id': report.progress_report_id,
            'visit_type': report.visit_type
        }, status=201)
    except Tree_species.DoesNotExist as e:
        return JsonResponse({'error': f'Tree species not found: {str(e)}'}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
def update_progress_report(request, report_id):
    """DataManager: Accept/Reject progress report with auto status transition"""
    if request.method != 'PUT':
        return JsonResponse({'error': 'Only PUT allowed'}, status=405)

    user = get_user_from_token(request)
    if not user or user.user_role != 'DataManager':
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    status = data.get('status')
    reason_text = data.get('reason', '').strip()
    
    if status not in ['accepted', 'rejected']:
        return JsonResponse({'error': 'Status must be accepted or rejected'}, status=400)

    report = get_object_or_404(ProgressReport, progress_report_id=report_id)
    if report.status != 'pending':
        return JsonResponse({'error': 'Report already processed'}, status=400)

    try:
        with transaction.atomic():
            report.status = status
            report.save()
            
            # ✅ NEW: Auto-transition Application status from 'accepted' to 'under_monitoring'
            # when approving an INITIAL visit report
            if status == 'accepted' and report.visit_type == 'initial':
                if report.application.status == 'accepted':
                    report.application.status = 'under_monitoring'
                    report.application.save()
            
            Reason.objects.create(
                user=user,
                application=report.application,
                status_layer='report',
                reason=reason_text,
                status=status
            )

        return JsonResponse({
            'message': f'Report {status}',
            'application_status': report.application.status  # ✅ Return updated status
        }, status=200)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
def get_progress_reports(request):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    user = get_user_from_token(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    status_filter = request.GET.get('status')
    app_id = request.GET.get('application_id')
    
    qs = ProgressReport.objects.select_related(
        'application__user__tree_grower_group'
    ).order_by('-created_at')
    
    if status_filter:
        qs = qs.filter(status=status_filter)
    if app_id:
        qs = qs.filter(application_id=app_id)

    data = [{
        "report_id": r.progress_report_id,
        "visit_type": r.visit_type,
        "orientation_conducted": r.orientation_conducted,
        "application_id": r.application.application_id,
        "application_title": r.application.title,
        "application_status": r.application.status,
        "total_survived": r.total_survived,
        "total_dead": r.total_dead,
        "total_added_by_grower": r.total_added_by_grower,
        "species": serialize_progress_report_species(r),
        "description": r.description,
        "status": r.status,
        "proof_image": get_cloudinary_url(str(r.proof_image_monitor_required)) if r.proof_image_monitor_required else None,
        "agreement_image": get_cloudinary_url(str(r.agreement_image)) if r.agreement_image else None,
        "submitted_at": r.submitted_at.isoformat() if r.submitted_at else None
    } for r in qs]

    return JsonResponse(data, safe=False, status=200)


@csrf_exempt
def create_reapplication(request):
    """TreeGrower: Apply for a NEW tree planting program."""
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)

    user = get_user_from_token(request)
    if not user or user.user_role != 'treeGrowers':
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    active_statuses = ['for_evaluation', 'for_head', 'accepted', 'under_monitoring']
    if Application.objects.filter(user=user, status__in=active_statuses).exists():
        return JsonResponse({'error': 'You already have an active application. Please wait for it to be completed or rejected.'}, status=400)

    title = request.POST.get('title')
    total_treegrowers = request.POST.get('total_treegrowers_will_participate')
    maintenance_plan = request.FILES.get('maintenance_plan')

    if not all([title, total_treegrowers, maintenance_plan]):
        return JsonResponse({'error': 'Missing required fields: title, total_treegrowers_will_participate, maintenance_plan'}, status=400)

    try:
        total_treegrowers = int(total_treegrowers)
        if total_treegrowers < 2:
            return JsonResponse({'error': 'Minimum 2 tree growers required'}, status=400)
    except ValueError:
        return JsonResponse({'error': 'total_treegrowers_will_participate must be a valid integer'}, status=400)

    proposed_site_id = request.POST.get('proposed_site_id') or None
    proposed_orientation_date = request.POST.get('proposed_orientation_date')
    
    if proposed_orientation_date:
        try:
            proposed_orientation_date = datetime.strptime(proposed_orientation_date, '%Y-%m-%d').date()
        except ValueError:
            return JsonResponse({'error': 'Invalid proposed_orientation_date format. Use YYYY-MM-DD.'}, status=400)

    try:
        with transaction.atomic():
            app = Application.objects.create(
                user=user,
                title=title,
                total_treegrowers_will_participate=total_treegrowers,
                maintenance_plan=maintenance_plan,
                classification='old', 
                status='for_evaluation',
                proposed_site_id=proposed_site_id,
                proposed_orientation_date=proposed_orientation_date,
            )
            
        return JsonResponse({
            'message': 'Re-application submitted successfully!', 
            'application_id': app.application_id
        }, status=201)
        
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
def get_tree_grower_application_history(request):
    """TreeGrower: Fetch ALL their applications with progress reports"""
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    user = get_user_from_token(request)
    if not user or user.user_role != 'treeGrowers':
        return JsonResponse({'error': 'Unauthorized: TreeGrowers only'}, status=403)

    applications = Application.objects.filter(user=user).order_by('-created_at')
    
    history_data = []
    
    for app in applications:
        reports = ProgressReport.objects.filter(application=app).order_by('-created_at')
        
        total_planted = 0
        total_survived = 0
        for r in reports:
            if r.status == 'accepted':
                total_planted += r.total_plants
                total_survived += r.total_survived
        
        seedling_requests = SeedlingRequest.objects.filter(application=app)
        total_requested = sum(sr.no_request_seedling for sr in seedling_requests)
        
        total_provided = 0
        for sr in seedling_requests:
            if sr.status == 'accepted':
                total_provided += sum(s.quantity for s in sr.seedling_species.all())
        
        app_data = {
            "application_id": app.application_id,
            "title": app.title,
            "status": app.status,
            "classification": app.classification,
            "created_at": app.created_at.isoformat(),
            "updated_at": app.updated_at.isoformat(),
            "orientation_date": app.orientation_date.isoformat() if app.orientation_date else None,
            "confirmed_at": app.confirmed_at.isoformat() if app.confirmed_at else None,
            "total_request_seedling": total_requested,
            "total_seedling_provided": total_provided,
            "total_seedling_planted": total_planted,
            "total_seedling_survived": total_survived,
            "reports": [{
                "report_id": r.progress_report_id,
                "visit_type": r.visit_type,
                "description": r.description or "No description provided",
                "status": r.status,
                "total_seedling_planted": r.total_plants,
                "total_seedling_survived": r.total_survived,
                "species": serialize_progress_report_species(r),
                "created_at": r.created_at.isoformat(),
                "submitted_at": r.submitted_at.isoformat() if r.submitted_at else None,
            } for r in reports]
        }
        history_data.append(app_data)
    
    return JsonResponse({
        "applications": history_data,
        "total_applications": len(history_data)
    }, status=200)


@csrf_exempt
def get_orientation_dates(request):
    """Fetch all applications with scheduled orientation dates for the Calendar."""
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    user = get_user_from_token(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    qs = Application.objects.filter(
        orientation_date__isnull=False
    ).order_by('orientation_date')
    
    if user.user_role == 'treeGrowers':
        qs = qs.filter(user=user)

    data = [{
        "application_id": app.application_id,
        "title": app.title,
        "orientation_date": app.orientation_date.isoformat(),
        "status": app.status,
    } for app in qs]

    return JsonResponse(data, safe=False, status=200)


@csrf_exempt
def get_site_applications(request, site_id):
    """Fetch all tree planting applications assigned to a specific site"""
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    try:
        apps = Application.objects.filter(site_id=site_id).select_related(
            'user__tree_grower_group'
        ).order_by('-created_at')
        
        data = [{
            "application_id": app.application_id,
            "title": app.title,
            "status": app.status,
            "classification": app.classification,
            "group_name": app.user.tree_grower_group.group_name if hasattr(app.user, 'tree_grower_group') else "Unknown",
            "total_treegrowers_will_participate": app.total_treegrowers_will_participate,
            "orientation_date": app.orientation_date.isoformat() if app.orientation_date else None,
            "created_at": app.created_at.strftime("%b %d, %Y"),
        } for app in apps]
        
        return JsonResponse({"applications": data}, status=200)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
def get_general_report_data(request):
    """Aggregates all data needed for the General Program Report Dashboard."""
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    user = get_user_from_token(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    total_groups = User.objects.filter(
        user_role='treeGrowers', 
        applications__isnull=False
    ).distinct().count()
    
    completed_apps = Application.objects.filter(status='completed').count()
    failed_apps = Application.objects.filter(status__in=['rejected', 'failed', 'cancelled']).count()
    ongoing_apps = Application.objects.filter(status__in=['accepted', 'under_monitoring', 'for_head', 'for_evaluation']).count()

    total_requested = SeedlingRequestSpecies.objects.filter(
        seedling_request__status='accepted'
    ).aggregate(total=Sum('quantity'))['total'] or 0

    progress_stats = ProgressReportSpecies.objects.filter(
        progress_report__status='accepted'
    ).aggregate(
        total_survived=Sum('no_survived'),
        total_dead=Sum('no_dead')
    )
    total_survived = progress_stats['total_survived'] or 0
    total_dead = progress_stats['total_dead'] or 0

    site_stats = Sites.objects.filter(status='completed').aggregate(
        total_area=Sum('total_area_hectares')
    )
    total_area = site_stats['total_area'] or 0.0

    six_months_ago = datetime.now() - timedelta(days=180)
    monthly_apps = Application.objects.filter(
        created_at__gte=six_months_ago
    ).annotate(
        month=TruncMonth('created_at')
    ).values('month').annotate(
        completed=Count('application_id', filter=Q(status='completed')),
        failed=Count('application_id', filter=Q(status__in=['rejected', 'failed', 'cancelled']))
    ).order_by('month')

    monthly_trend = [
        {
            "month": entry['month'].strftime('%b'),
            "completed": entry['completed'],
            "failed": entry['failed']
        } for entry in monthly_apps
    ]

    sites_with_apps = Sites.objects.filter(
        applications__isnull=False
    ).select_related(
        'reforestation_area__barangay'
    ).prefetch_related('applications__user__tree_grower_group').distinct()[:15]

    site_applications = []
    for site in sites_with_apps:
        latest_app = site.applications.order_by('-created_at').first()
        if latest_app:
            site_applications.append({
                "site_name": site.name,
                "barangay": site.reforestation_area.barangay.name if site.reforestation_area and site.reforestation_area.barangay else "N/A",
                "app_title": latest_app.title,
                "group": latest_app.user.tree_grower_group.group_name if hasattr(latest_app.user, 'tree_grower_group') else "Unknown",
                "status": latest_app.status
            })

    data = {
        "stats": {
            "total_groups": total_groups,
            "completed_programs": completed_apps,
            "failed_programs": failed_apps,
            "ongoing_programs": ongoing_apps,
            "total_seedlings_requested": total_requested,
            "total_seedlings_survived": total_survived,
            "total_seedlings_dead": total_dead,
            "total_area_completed": round(total_area, 2)
        },
        "monthly_trend": monthly_trend,
        "site_applications": site_applications
    }

    return JsonResponse(data, status=200)


@csrf_exempt
def get_program_history(request):
    """Fetch application history with linked site details, supporting filters"""
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    user = get_user_from_token(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    status_filter = request.GET.get('status', 'All')
    search = request.GET.get('search', '').strip()
    date_from = request.GET.get('date_from')
    date_to = request.GET.get('date_to')
    
    try:
        entries = max(int(request.GET.get('entries', 10)), 10)
        page = max(int(request.GET.get('page', 1)), 1)
    except (ValueError, TypeError):
        entries, page = 10, 1

    qs = Application.objects.select_related(
        'user__tree_grower_group', 
        'site__reforestation_area__barangay'
    ).order_by('-created_at')
    
    if status_filter and status_filter != 'All':
        qs = qs.filter(status=status_filter)
    if search:
        qs = qs.filter(
            Q(title__icontains=search) | 
            Q(user__tree_grower_group__group_name__icontains=search) |
            Q(site__name__icontains=search)
        )
    if date_from:
        qs = qs.filter(created_at__date__gte=date_from)
    if date_to:
        qs = qs.filter(created_at__date__lte=date_to)

    total = qs.count()
    total_page = math.ceil(total / entries) if total > 0 else 1
    offset = (page - 1) * entries

    data = [{
        "application_id": app.application_id,
        "title": app.title,
        "status": app.status,
        "classification": app.classification,
        "total_treegrowers_will_participate": app.total_treegrowers_will_participate,
        "created_at": app.created_at.strftime("%Y-%m-%d"),
        "group_name": app.user.tree_grower_group.group_name if hasattr(app.user, 'tree_grower_group') else "Unknown",
        "group_profile": get_cloudinary_url(str(app.user.tree_grower_group.profile_img)) if hasattr(app.user, 'tree_grower_group') and app.user.tree_grower_group.profile_img else None,
        "site_name": app.site.name if app.site else None,
        "site_status": app.site.status if app.site else None,
        "barangay": app.site.reforestation_area.barangay.name if app.site and app.site.reforestation_area and app.site.reforestation_area.barangay else None,
        "site_area": round(app.site.total_area_hectares, 2) if app.site else 0,
    } for app in qs[offset:offset + entries]]

    return JsonResponse({
        'data': data, 
        'total_page': total_page, 
        'page': page, 
        'entries': entries, 
        'total': total
    }, status=200)


@csrf_exempt
def delete_application(request, application_id):
    """Delete an application and all related data. Also deletes all associated files from Cloudinary."""
    if request.method != 'DELETE':
        return JsonResponse({'error': 'Only DELETE allowed'}, status=405)

    user = get_user_from_token(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    app = get_object_or_404(Application, application_id=application_id)
    
    if user.user_role != 'DataManager' and app.user != user:
        return JsonResponse({'error': 'Unauthorized to delete this application'}, status=403)

    if app.status == 'completed':
        return JsonResponse({
            'error': 'Cannot delete a completed application. It is preserved for historical records.'
        }, status=400)

    try:
        app_title = app.title
        deleted_files = []
        failed_files = []
        
        if app.maintenance_plan:
            try:
                success = delete_cloudinary_resource(app.maintenance_plan, resource_type='raw')
                if success:
                    deleted_files.append('maintenance_plan')
                else:
                    failed_files.append('maintenance_plan (not found in Cloudinary)')
            except Exception as e:
                failed_files.append(f'maintenance_plan: {str(e)}')
        
        if app.agreement_image:
            try:
                success = delete_cloudinary_resource(app.agreement_image, resource_type='image')
                if success:
                    deleted_files.append('agreement_image')
                else:
                    failed_files.append('agreement_image (not found in Cloudinary)')
            except Exception as e:
                failed_files.append(f'agreement_image: {str(e)}')
        
        for pr in app.progress_reports.all():
            if pr.proof_image_monitor_required:
                try:
                    success = delete_cloudinary_resource(pr.proof_image_monitor_required, resource_type='image')
                    if success:
                        deleted_files.append(f'progress_report_{pr.progress_report_id}')
                    else:
                        failed_files.append(f'progress_report_{pr.progress_report_id} (not found)')
                except Exception as e:
                    failed_files.append(f'progress_report_{pr.progress_report_id}: {str(e)}')
            
            if pr.agreement_image:
                try:
                    success = delete_cloudinary_resource(pr.agreement_image, resource_type='image')
                    if success:
                        deleted_files.append(f'progress_report_{pr.progress_report_id}_agreement')
                    else:
                        failed_files.append(f'progress_report_{pr.progress_report_id}_agreement (not found)')
                except Exception as e:
                    failed_files.append(f'progress_report_{pr.progress_report_id}_agreement: {str(e)}')
        
        app.delete()
        
        return JsonResponse({
            'message': f'Application "{app_title}" deleted successfully.',
            'files_deleted': deleted_files,
            'files_failed': failed_files,
            'total_deleted': len(deleted_files),
            'total_failed': len(failed_files)
        }, status=200)
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({'error': f'Failed to delete application: {str(e)}'}, status=500)


@csrf_exempt
def get_available_sites_for_tree_grower(request):
    """GET: Fetch sites available for tree grower application with pagination."""
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    user = get_user_from_token(request)
    if not user or user.user_role != 'treeGrowers':
        return JsonResponse({'error': 'Unauthorized: TreeGrowers only'}, status=403)

    ongoing_statuses = ['for_evaluation', 'for_head', 'accepted', 'under_monitoring']
    has_ongoing = Application.objects.filter(
        user=user, 
        status__in=ongoing_statuses
    ).exists()

    try:
        page = max(int(request.GET.get('page', 1)), 1)
        entries = max(int(request.GET.get('entries', 10)), 10)
        entries = min(entries, 50)
    except (ValueError, TypeError):
        page, entries = 1, 10

    search = request.GET.get('search', '').strip()
    barangay_filter = request.GET.get('barangay', '').strip()

    sites = Sites.objects.filter(
        status='accepted',
        meta_verification__status='verified',
        is_active=True
    ).select_related(
        'reforestation_area__barangay',
        'meta_verification'
    ).prefetch_related(
        'site_images'
    ).order_by('-is_pinned', '-created_at')

    if search:
        sites = sites.filter(
            Q(name__icontains=search) |
            Q(reforestation_area__name__icontains=search)
        )
    
    if barangay_filter:
        sites = sites.filter(
            reforestation_area__barangay__name__icontains=barangay_filter
        )

    total = sites.count()
    total_page = math.ceil(total / entries) if total > 0 else 1
    offset = (page - 1) * entries
    has_next = page < total_page

    data = []
    for site in sites[offset:offset + entries]:
        general_images = site.site_images.filter(layer_tag='general').order_by('-created_at')
        images_data = []
        for img in general_images:
            if img.img:
                images_data.append({
                    'image_id': img.site_image_id,
                    'url': get_cloudinary_url(str(img.img)),
                    'caption': img.caption
                })

        data.append({
            'site_id': site.site_id,
            'name': site.name,
            'reforestation_area': site.reforestation_area.name,
            'barangay': site.reforestation_area.barangay.name if site.reforestation_area.barangay else 'N/A',
            'total_area_hectares': site.total_area_hectares,
            'images': images_data,
            'is_pinned': site.is_pinned,
            'created_at': site.created_at.strftime('%Y-%m-%d')
        })

    return JsonResponse({
        'data': data,
        'total': total,
        'total_page': total_page,
        'page': page,
        'entries': entries,
        'has_next': has_next,
        'has_ongoing_application': has_ongoing
    }, status=200)


@csrf_exempt
def get_seedling_analytics(request):
    """Aggregates seedling distribution and survival data per species."""
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    total_requested = SeedlingRequestSpecies.objects.filter(
        seedling_request__status='accepted'
    ).aggregate(total=Coalesce(Sum('quantity'), 0))['total']

    progress_stats = ProgressReportSpecies.objects.aggregate(
        total_survived=Coalesce(Sum('no_survived'), 0),
        total_dead=Coalesce(Sum('no_dead'), 0)
    )

    requested_by_species = SeedlingRequestSpecies.objects.filter(
        seedling_request__status='accepted'
    ).values(
        species_id=F('tree_species__tree_specie_id'),
        species_name=F('tree_species__name')
    ).annotate(
        total_requested=Sum('quantity')
    ).order_by('-total_requested')[:5]

    survived_by_species = ProgressReportSpecies.objects.values(
        species_id=F('tree_species__tree_specie_id'),
        species_name=F('tree_species__name')
    ).annotate(
        total_survived=Sum('no_survived'),
        total_dead=Sum('no_dead')
    )

    species_map = {item['species_id']: item for item in survived_by_species}
    final_species_data = []
    
    for req in requested_by_species:
        sid = req['species_id']
        surv_data = species_map.get(sid, {'total_survived': 0, 'total_dead': 0})
        total_plants = surv_data['total_survived'] + surv_data['total_dead']
        survival_rate = round((surv_data['total_survived'] / total_plants) * 100, 2) if total_plants > 0 else 0
        
        final_species_data.append({
            "species_id": sid,
            "species_name": req['species_name'],
            "requested": req['total_requested'],
            "survived": surv_data['total_survived'],
            "dead": surv_data['total_dead'],
            "survival_rate": survival_rate
        })

    return JsonResponse({
        "total_requested": total_requested,
        "total_survived": progress_stats['total_survived'],
        "total_dead": progress_stats['total_dead'],
        "species_breakdown": final_species_data
    }, status=200)


@csrf_exempt
def get_geographic_analytics(request):
    """Aggregates spatial and land classification data."""
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    total_areas = Reforestation_areas.objects.filter(deleted_at__isnull=True).count()
    total_sites = Sites.objects.filter(status__in=['accepted', 'completed', 'under_monitoring']).count()
    total_hectares = Sites.objects.aggregate(total=Coalesce(Sum('total_area_hectares'), 0.0))['total']
    pending_verifications = SiteMetaDataVerification.objects.filter(status='pending').count()

    hectares_by_barangay = Sites.objects.filter(
        reforestation_area__barangay__isnull=False
    ).values(
        barangay_name=F('reforestation_area__barangay__name')
    ).annotate(
        total_hectares=Sum('total_area_hectares')
    ).order_by('-total_hectares')

    land_class_dist = SiteMetaDataVerification.objects.filter(
        verified_land_classification__isnull=False
    ).values(
        classification_name=F('verified_land_classification__name')
    ).annotate(
        count=Count('id')
    ).order_by('-count')

    return JsonResponse({
        "kpis": {
            "total_areas": total_areas,
            "total_sites": total_sites,
            "total_hectares": round(total_hectares, 2),
            "pending_verifications": pending_verifications
        },
        "hectares_by_barangay": list(hectares_by_barangay),
        "land_classification_distribution": list(land_class_dist)
    }, status=200)


@csrf_exempt
def get_monitoring_compliance(request):
    """Aggregates monitoring compliance data for tree planting programs."""
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    user = get_user_from_token(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    active_programs = Application.objects.filter(status__in=['accepted', 'under_monitoring']).count()
    total_reports = ProgressReport.objects.count()
    
    programs_with_reports = Application.objects.filter(
        status__in=['accepted', 'under_monitoring'],
        progress_reports__isnull=False
    ).distinct().count()
    
    compliance_rate = (programs_with_reports / active_programs * 100) if active_programs > 0 else 0

    six_months_ago = datetime.now() - timedelta(days=180)
    monthly_submissions = ProgressReport.objects.filter(
        created_at__gte=six_months_ago
    ).annotate(
        month=TruncMonth('created_at')
    ).values('month').annotate(
        reports=Count('progress_report_id')
    ).order_by('month')

    monthly_data = [
        {
            "month": entry['month'].strftime('%b'),
            "reports": entry['reports']
        } for entry in monthly_submissions
    ]

    active_apps = Application.objects.filter(
        status__in=['accepted', 'under_monitoring']
    ).select_related(
        'user__tree_grower_group',
        'site'
    ).prefetch_related(
        'progress_reports__report_species'
    ).order_by('-created_at')

    compliance_tracker = []
    for app in active_apps:
        latest_report = app.progress_reports.order_by('-created_at').first()
        
        days_since = None
        last_report_date = None
        if latest_report:
            last_report_date = latest_report.created_at
            days_since = (timezone.now().date() - last_report_date.date()).days
        
        total_survived = 0
        total_dead = 0
        for report in app.progress_reports.all():
            if report.status == 'accepted':
                total_survived += report.total_survived
                total_dead += report.total_dead
        
        total_plants = total_survived + total_dead
        survival_rate = (total_survived / total_plants * 100) if total_plants > 0 else 0

        compliance_tracker.append({
            "group_name": app.user.tree_grower_group.group_name if hasattr(app.user, 'tree_grower_group') else "Unknown",
            "site_name": app.site.name if app.site else "No site assigned",
            "last_report_date": last_report_date.isoformat() if last_report_date else None,
            "days_since_last_report": days_since,
            "survival_rate": round(survival_rate, 1)
        })

    return JsonResponse({
        "kpis": {
            "active_programs": active_programs,
            "total_reports": total_reports,
            "compliance_rate": round(compliance_rate, 1)
        },
        "monthly_submissions": monthly_data,
        "compliance_tracker": compliance_tracker
    }, status=200)


@csrf_exempt
def update_application_orientation(request, application_id):
    """Update orientation date for an application (called from calendar scheduling)."""
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)

    user = get_user_from_token(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    app = get_object_or_404(Application, application_id=application_id)
    
    orientation_date_str = request.POST.get('orientation_date')
    if not orientation_date_str:
        return JsonResponse({'error': 'orientation_date is required'}, status=400)

    try:
        orientation_date = datetime.strptime(orientation_date_str, '%Y-%m-%d').date()
    except ValueError:
        return JsonResponse({'error': 'Invalid date format. Use YYYY-MM-DD.'}, status=400)

    try:
        with transaction.atomic():
            app.orientation_date = orientation_date
            if user.user_role in ['DataManager', 'CityENROHead']:
                app.save()
            else:
                return JsonResponse({'error': 'Unauthorized to update orientation'}, status=403)

        return JsonResponse({
            'message': 'Orientation date updated successfully',
            'application_id': app.application_id,
            'orientation_date': orientation_date.isoformat()
        }, status=200)
        
    except Exception as e:
        return JsonResponse({'error': f'Server error: {str(e)}'}, status=500)
    
@csrf_exempt
def get_monitoring_stats(request):
    """Get live counts for monitoring priority levels"""
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    user = get_user_from_token(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    active_apps = Application.objects.filter(
        status__in=['accepted', 'under_monitoring']
    )

    apps_with_dates = active_apps.annotate(
        last_report_date=Max('progress_reports__created_at'),
        total_reports=Count('progress_reports'),
        effective_date=Case(
            When(last_report_date__isnull=False, 
                 then=TruncDate('last_report_date')),
            When(orientation_date__isnull=False, 
                 then=F('orientation_date')),
            default=None,
            output_field=DateField()
        )
    )

    today = timezone.now().date()
    
    total = apps_with_dates.count()
    no_report = apps_with_dates.filter(total_reports=0).count()
    
    days_90_plus = apps_with_dates.filter(
        effective_date__lt=today - timedelta(days=90)
    ).count()
    
    days_60_plus = apps_with_dates.filter(
        effective_date__gte=today - timedelta(days=90),
        effective_date__lt=today - timedelta(days=60)
    ).count()
    
    days_30_plus = apps_with_dates.filter(
        effective_date__gte=today - timedelta(days=60),
        effective_date__lt=today - timedelta(days=30)
    ).count()

    # ✅ NEW: Counts for the frontend workflow tabs
    accepted_count = active_apps.filter(status='accepted').count()
    under_monitoring_count = active_apps.filter(status='under_monitoring').count()

    return JsonResponse({
        'total': total,
        'accepted': accepted_count,               # ✅ ADDED
        'under_monitoring': under_monitoring_count, # ✅ ADDED
        'no_report': no_report,
        'days_30_plus': days_30_plus,
        'days_60_plus': days_60_plus,
        'days_90_plus': days_90_plus,
    }, status=200)

@csrf_exempt
def get_monitoring_baseline(request, application_id):
    """
    Fetches the latest accepted progress report for an application.
    Used by the mobile app to pre-fill the 'Ongoing' monitoring form 
    with the previous visit's baseline data.
    """
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    user = get_user_from_token(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    app = get_object_or_404(Application, application_id=application_id)
    
    # Find the latest ACCEPTED report
    latest_report = ProgressReport.objects.filter(
        application=app, 
        status='accepted'
    ).order_by('-created_at').first()

    if not latest_report:
        return JsonResponse({
            'message': 'No baseline found. This is the first visit.',
            'baseline': None
        }, status=200)

    # Serialize the species data from the last report
    baseline_species = []
    for species_record in latest_report.report_species.select_related('tree_species').all():
        baseline_species.append({
            "species_id": species_record.tree_species.tree_specie_id,
            "species_name": species_record.tree_species.name,
            "previous_planted": species_record.no_planted,
            "previous_added": species_record.no_added_by_grower,
            "previous_survived": species_record.no_survived,
            "previous_dead": species_record.no_dead,
        })

    return JsonResponse({
        'baseline': {
            "report_id": latest_report.progress_report_id,
            "visit_date": latest_report.created_at.isoformat(),
            "species_data": baseline_species
        }
    }, status=200)