
import logging
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt

from accounts.helper import (
    get_cloudinary_url,
    get_user_from_token,
)



from .models import (
    Application,
    ProgressReport,
    Reason,
    SeedlingRequest,
)


# Define the logger at the module level (outside any function)
logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# HELPER FUNCTIONS (Ensure these are in your file)
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
# TREE GROWER APPLICATION DETAIL
# ─────────────────────────────────────────────────────────────────────────────

@csrf_exempt
def get_tree_grower_application_detail(request, application_id):
    """TreeGrower: Fetch full details of a specific application by ID"""
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    user = get_user_from_token(request)
    if not user or user.user_role != 'treeGrowers':
        return JsonResponse({'error': 'Unauthorized: TreeGrowers only'}, status=403)

    # ✅ Fetch the specific application AND ensure it belongs to the current user (Security)
    app = get_object_or_404(
        Application.objects.select_related(
            'user__tree_grower_group',
            'user__profile',
            'site__reforestation_area__barangay',
            'site__meta_verification',
            'site__meta_verification__verified_land_classification',
            'proposed_site__reforestation_area__barangay'
        ).prefetch_related(
            'site__site_images',
            'site__species_recommendations',
            'site__species_recommendations__tree_species'
        ),
        application_id=application_id,
        user=user  # This ensures the user can only view their own applications
    )
    
    group_data = {
        "group_name": app.user.tree_grower_group.group_name,
        "group_type": app.user.tree_grower_group.get_group_type_display(),
        "group_contact": app.user.tree_grower_group.contact,
        "group_address": app.user.tree_grower_group.address,
        "group_profile": get_cloudinary_url(str(app.user.tree_grower_group.profile_img)) if app.user.tree_grower_group.profile_img else None,
    } if hasattr(app.user, 'tree_grower_group') and app.user.tree_grower_group else None
    
    profile_data = {
        "first_name": app.user.profile.first_name,
        "last_name": app.user.profile.last_name,
        "contact": app.user.profile.contact,
        "gender": app.user.profile.gender,
        "profile_img": get_cloudinary_url(str(app.user.profile.profile_img)) if app.user.profile.profile_img else None,
    } if hasattr(app.user, 'profile') and app.user.profile else None

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