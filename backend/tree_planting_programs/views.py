from django.utils import timezone
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import get_object_or_404
from django.db import transaction
import json
import math

from .models import (
    Application, SeedlingRequest, SeedlingRequestSpecies,
    ProgressReport, ProgressReportSpecies, Reason
)
from sites.models import Sites
from accounts.helper import get_user_from_token
from accounts.models import User
from tree_species.models import Tree_species
from django.db.models import Sum, Count, Q
from django.db.models.functions import TruncMonth
from datetime import datetime, timedelta


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
    Returns a list of species with survival data.
    """
    return [{
        "species_id": s.tree_species.tree_specie_id,
        "species_name": s.tree_species.name,
        "no_survived": s.no_survived,
        "no_dead": s.no_dead,
        "total": s.no_survived + s.no_dead,
        "survival_rate": s.survival_rate,
    } for s in progress_report.report_species.select_related('tree_species').all()]


# ─────────────────────────────────────────────────────────────────────────────
# APPLICATION LIST & DETAILS
# ─────────────────────────────────────────────────────────────────────────────

@csrf_exempt
def get_applications(request):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    status_filter = request.GET.get('status', 'All')
    classification_filter = request.GET.get('classification', 'All')
    search = request.GET.get('search', '').strip()
    
    try:
        entries = max(int(request.GET.get('entries', 10)), 10)
        page = max(int(request.GET.get('page', 1)), 1)
    except (ValueError, TypeError):
        entries, page = 10, 1

    qs = Application.objects.select_related('user__tree_grower_group').order_by('-created_at')
    
    if status_filter != 'All':
        qs = qs.filter(status=status_filter)
    if classification_filter != 'All':
        qs = qs.filter(classification=classification_filter)
    if search:
        qs = qs.filter(user__tree_grower_group__group_name__icontains=search)

    total = qs.count()
    total_page = math.ceil(total / entries) if total > 0 else 1
    offset = (page - 1) * entries

    data = [{
        "application_id": app.application_id,
        "group_name": app.user.tree_grower_group.group_name if hasattr(app.user, 'tree_grower_group') else "N/A",
        "group_type": app.user.tree_grower_group.get_group_type_display() if hasattr(app.user, 'tree_grower_group') else "N/A",
        "group_profile": app.user.tree_grower_group.profile_img.url if hasattr(app.user, 'tree_grower_group') and app.user.tree_grower_group.profile_img else None,
        "title": app.title,
        "orientation_date": app.orientation_date,
        "classification": app.classification,
        "status": app.status,
        "total_treegrowers_will_participate": app.total_treegrowers_will_participate,
        "created_at": app.created_at.strftime("%d/%m/%Y")
    } for app in qs[offset:offset + entries]]

    return JsonResponse({'data': data, 'total_page': total_page, 'page': page, 'entries': entries, 'total': total}, status=200)


@csrf_exempt
def get_application(request, application_id):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    # ✅ Optimize query to fetch all rich site data in one go
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

    # ─── RICH SITE SERIALIZATION ────────────────────────────────────────────
    assigned_site_data = None
    if app.site:
        site = app.site
        meta = getattr(site, 'meta_verification', None)
        
        # Fetch General Images
        general_images = [
            {"image_url": img.img.url if img.img else None, "caption": img.caption} 
            for img in site.site_images.filter(layer_tag='general').order_by('-created_at')
        ]
        
        # Fetch Recommended Species
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
            "ndvi_value": site.ndvi_value,
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
            "maintenance_plan": app.maintenance_plan.url if app.maintenance_plan else None,
            "agreement_image": app.agreement_image.url if app.agreement_image else None,
            "created_at": app.created_at.isoformat(),
            "updated_at": app.updated_at.isoformat(),
        },
        "group": {
            "group_name": app.user.tree_grower_group.group_name if hasattr(app.user, 'tree_grower_group') else "N/A",
            "group_type": app.user.tree_grower_group.get_group_type_display() if hasattr(app.user, 'tree_grower_group') else "N/A",
            "group_contact": app.user.tree_grower_group.contact if hasattr(app.user, 'tree_grower_group') else "",
            "group_address": app.user.tree_grower_group.address if hasattr(app.user, 'tree_grower_group') else "",
            "group_profile": app.user.tree_grower_group.profile_img.url if hasattr(app.user, 'tree_grower_group') and app.user.tree_grower_group.profile_img else None,
        },
        "profile": {
            "first_name": app.user.profile.first_name,
            "last_name": app.user.profile.last_name,
            "contact": app.user.profile.contact,
            "gender": app.user.profile.gender,
        } if hasattr(app.user, 'profile') and app.user.profile else None,
        "assigned_site": assigned_site_data,
        "proposed_site": proposed_site_data,
        "seedling_requests": [{
            "request_id": sr.seedling_request_id,
            "no_request_seedling": sr.no_request_seedling,
            "species": serialize_seedling_request_species(sr),
            "status": sr.status,
            "reason_accepted": sr.reason_accepted,
            "submitted_at": sr.submitted_at.isoformat() if sr.submitted_at else None
        } for sr in seedling_requests],
        "progress_reports": [{
            "report_id": pr.progress_report_id,
            "total_survived": pr.total_survived,
            "total_dead": pr.total_dead,
            "species": serialize_progress_report_species(pr),
            "description": pr.description,
            "status": pr.status,
            "proof_image": pr.proof_image_monitor_required.url if pr.proof_image_monitor_required else None,
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
    """GET /api/ongoing-applications/?barangay=San+Isidro"""
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    user = get_user_from_token(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    barangay = request.GET.get('barangay', '').strip()
    status_list = ['accepted', 'under_monitoring']
    
    qs = Application.objects.filter(status__in=status_list).select_related(
        'site__reforestation_area__barangay', 
        'user__tree_grower_group'
    )
    
    if barangay:
        qs = qs.filter(site__reforestation_area__barangay__name__icontains=barangay)
        
    qs = qs.order_by('-created_at')

    data = [{
        "application_id": app.application_id,
        "title": app.title,
        "group_name": app.user.tree_grower_group.group_name if hasattr(app.user, 'tree_grower_group') else "N/A",
        "status": app.status,
        "site_name": app.site.name if app.site else None,
        "barangay": (
            app.site.reforestation_area.barangay.name 
            if app.site and app.site.reforestation_area and app.site.reforestation_area.barangay 
            else None
        ),
        "orientation_date": app.orientation_date.isoformat() if app.orientation_date else None,
        "created_at": app.created_at.strftime("%d/%m/%Y")
    } for app in qs]

    return JsonResponse(data, safe=False, status=200)


@csrf_exempt
def get_tree_grower_application(request):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    user = get_user_from_token(request)
    if not user or user.user_role != 'treeGrowers':
        return JsonResponse({'error': 'Unauthorized: TreeGrowers only'}, status=403)

    # Optimize query to fetch all related site data in one go
    # We use select_related for FK/O2O and prefetch_related for Reverse Relations
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
    
    # Base user/group data
    group_data = {
        "group_name": user.tree_grower_group.group_name,
        "group_type": user.tree_grower_group.get_group_type_display(),
        "group_contact": user.tree_grower_group.contact,
        "group_address": user.tree_grower_group.address,
        "group_profile": user.tree_grower_group.profile_img.url if user.tree_grower_group.profile_img else None,
    } if hasattr(user, 'tree_grower_group') else None
    
    profile_data = {
        "first_name": user.profile.first_name,
        "last_name": user.profile.last_name,
        "contact": user.profile.contact,
        "gender": user.profile.gender,
        "profile_img": user.profile.profile_img.url if user.profile.profile_img else None,
    } if hasattr(user, 'profile') and user.profile else None

    # If no application exists
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

    # Get seedling requests & progress reports
    seedling_requests = SeedlingRequest.objects.filter(application=app).order_by('-created_at')
    progress_reports = ProgressReport.objects.filter(application=app).order_by('-created_at')
    latest_reason = Reason.objects.filter(application=app).order_by('-created').first()

    # ─── Helper to serialize assigned site with all new details ─────────────
    assigned_site_data = None
    if app.site:
        site = app.site
        meta = getattr(site, 'meta_verification', None)
        
        # Fetch General Images (Filtered for 'general' tag only)
        general_images = [
            {
                "image_url": img.img.url if img.img else None,
                "caption": img.caption
            } 
            for img in site.site_images.filter(layer_tag='general').order_by('-created_at')
        ]
        
        # Fetch Recommended Species
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
            "total_area_hectares": site.total_area_hectares,
            "ndvi_value": site.ndvi_value,
            "polygon_coordinates": site.polygon_coordinates,
            
            # 📍 Location Context
            "reforestation_area_name": site.reforestation_area.name if site.reforestation_area else None,
            "barangay_name": (
                site.reforestation_area.barangay.name 
                if site.reforestation_area and site.reforestation_area.barangay 
                else None
            ),
            
            # 🛡️ Metadata (Accessibility & Land Classification)
            "accessibility": meta.verified_accessibility if meta else None,
            "land_classification_name": (
                meta.verified_land_classification.name 
                if meta and meta.verified_land_classification else None
            ),
            
            # 🖼️ General Images Carousel
            "general_images": general_images,
            
            # 🌳 Recommended Species
            "recommended_species": recommended_species,
        }

    # ─── Helper to serialize proposed site ──────────────────────────────────
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
            "maintenance_plan": app.maintenance_plan.url if app.maintenance_plan else None,
            "agreement_image": app.agreement_image.url if app.agreement_image else None,
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
            "reason_accepted": sr.reason_accepted,
            "submitted_at": sr.submitted_at.isoformat() if sr.submitted_at else None
        } for sr in seedling_requests],
        "progress_reports": [{
            "report_id": pr.progress_report_id,
            "total_survived": pr.total_survived,
            "total_dead": pr.total_dead,
            "species": serialize_progress_report_species(pr),
            "description": pr.description,
            "status": pr.status,
            "proof_image": pr.proof_image_monitor_required.url if pr.proof_image_monitor_required else None,
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
    """
    DataManager: Assign site and orientation date, add reason → forward to Head
    NOTE: Seedling provisioning happens AFTER application acceptance via create_seedling_request
    """
    if request.method not in ('PUT', 'POST'):
        return JsonResponse({'error': 'Only PUT/POST allowed'}, status=405)

    user = get_user_from_token(request)
    if not user or user.user_role != 'DataManager':
        return JsonResponse({'error': 'Unauthorized: DataManager only'}, status=403)

    app = get_object_or_404(Application, application_id=application_id)
    if app.status not in ['for_evaluation']:
        return JsonResponse({'error': 'Application not in evaluation stage'}, status=400)

    # Extract form data
    site_id = request.POST.get('site_id')
    orientation_date = request.POST.get('orientation_date')
    reason_text = request.POST.get('reason', '').strip()

    # Validate required fields
    if not site_id:
        return JsonResponse({'error': 'site_id is required'}, status=400)
    if not orientation_date:
        return JsonResponse({'error': 'orientation_date is required'}, status=400)

    site = get_object_or_404(Sites, site_id=site_id)

    try:
        with transaction.atomic():
            # Update Application
            app.site = site
            app.orientation_date = orientation_date
            app.status = 'for_head'
            
            if 'agreement_image' in request.FILES:
                app.agreement_image = request.FILES['agreement_image']
            app.save()

            # Log Reason for audit trail
            Reason.objects.create(
                user=user,
                application=app,
                status_layer='new_program',
                reason=reason_text,
                status='for_head'
            )

        # Success Response
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
                # Activate user account
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

        return JsonResponse({
            'message': f'Application marked as {new_status}',
            'new_status': new_status
        }, status=200)
        
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


# ─────────────────────────────────────────────────────────────────────────────
# SEEDLING REQUESTS (Assistance Requests)
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
                request_file=request.FILES.get('request_file')
            )

            # Create species records
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

            # Update total
            req.no_request_seedling = total_seedlings
            req.save()

        return JsonResponse({'message': 'Seedling request submitted', 'request_id': req.seedling_request_id}, status=201)
    except Tree_species.DoesNotExist as e:
        return JsonResponse({'error': f'Tree species not found: {str(e)}'}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
def update_seedling_request(request, request_id):
    """
    DataManager: Approve/Reject additional seedling request.
    Allows DM to EDIT seedling details (species, quantity, provider) when accepting.
    """
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
    seedling_provision = data.get('seedling_provision')
    
    if status not in ['accepted', 'rejected']:
        return JsonResponse({'error': 'Status must be accepted or rejected'}, status=400)

    req = get_object_or_404(SeedlingRequest, seedling_request_id=request_id)
    if req.status != 'pending':
        return JsonResponse({'error': 'Request already processed'}, status=400)

    try:
        with transaction.atomic():
            if status == 'accepted' and seedling_provision:
                if not isinstance(seedling_provision, list):
                    return JsonResponse({'error': 'seedling_provision must be a JSON array'}, status=400)

                # Clear existing species
                req.seedling_species.all().delete()

                # Create new species records
                total_seedlings = 0
                for item in seedling_provision:
                    if not isinstance(item, dict):
                        raise ValueError("Each seedling provision must be an object")
                    
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
            
            req.status = status
            req.reason_accepted = reason_text
            req.save()
            
            Reason.objects.create(
                user=user,
                application=req.application,
                status_layer='seedling_request',
                reason=reason_text,
                status=status
            )

        return JsonResponse({'message': f'Request {status}'}, status=200)
    except Tree_species.DoesNotExist as e:
        return JsonResponse({'error': f'Tree species not found: {str(e)}'}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
def delete_seedling_request(request, request_id):
    if request.method != 'DELETE':
        return JsonResponse({'error': 'Only DELETE allowed'}, status=405)

    user = get_user_from_token(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    req = get_object_or_404(SeedlingRequest, seedling_request_id=request_id)
    
    if req.status != 'pending':
        return JsonResponse({'error': 'Cannot delete processed request'}, status=400)
    if user.user_role != 'DataManager' and req.application.user != user:
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    req.delete()
    return JsonResponse({'message': 'Request deleted'}, status=200)


@csrf_exempt
def get_seedling_requests(request):
    """List seedling requests with optional status filter"""
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    user = get_user_from_token(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    status_filter = request.GET.get('status')
    app_id = request.GET.get('application_id')
    
    # ✅ Added 'application__site' to select_related to prevent N+1 queries
    qs = SeedlingRequest.objects.select_related(
        'application__user__tree_grower_group', 
        'application__site'
    ).order_by('-created_at')
    
    if user.user_role == 'treeGrowers':
        qs = qs.filter(application__user=user)
    if status_filter:
        qs = qs.filter(status=status_filter)
    if app_id:
        qs = qs.filter(application_id=app_id)

    data = [{
        "request_id": r.seedling_request_id,
        "application_id": r.application.application_id,
        "application_title": r.application.title,
        "group_name": r.application.user.tree_grower_group.group_name if hasattr(r.application.user, 'tree_grower_group') else "N/A",
        "site_name": r.application.site.name if r.application.site else None, # ✅ NEW: Site Name
        "no_request_seedling": r.no_request_seedling,
        "species": serialize_seedling_request_species(r), # ✅ Uses new normalized array
        "status": r.status,
        "reason_accepted": r.reason_accepted,
        "description": r.description,
        "submitted_at": r.submitted_at.isoformat() if r.submitted_at else None
    } for r in qs]

    return JsonResponse(data, safe=False, status=200)


# ─────────────────────────────────────────────────────────────────────────────
# PROGRESS REPORTS (Onsite Monitoring)
# ─────────────────────────────────────────────────────────────────────────────

@csrf_exempt
def create_progress_report(request):
    """OnsiteInspector: Submit monitoring report"""
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)

    user = get_user_from_token(request)
    if not user or user.user_role != 'OnsiteInspector':
        return JsonResponse({'error': 'Unauthorized: OnsiteInspector only'}, status=403)

    app_id = request.POST.get('application_id')
    description = request.POST.get('description', '').strip()
    report_species_json = request.POST.get('report_species')
    
    if not app_id or not report_species_json:
        return JsonResponse({'error': 'application_id and report_species required'}, status=400)

    try:
        report_species = json.loads(report_species_json)
        if not isinstance(report_species, list):
            raise ValueError("report_species must be a JSON array")
    except (ValueError, json.JSONDecodeError) as e:
        return JsonResponse({'error': f'Invalid report_species format: {str(e)}'}, status=400)

    app = get_object_or_404(Application, application_id=app_id)
    if app.status not in ['accepted', 'under_monitoring']:
        return JsonResponse({'error': 'Application not under monitoring'}, status=400)

    try:
        with transaction.atomic():
            report = ProgressReport.objects.create(
                application=app,
                description=description,
                proof_image_monitor_required=request.FILES.get('proof_image'),
                status='pending'
            )

            # Create species records
            for item in report_species:
                if not isinstance(item, dict):
                    raise ValueError("Each report species must be an object")
                
                tree_species_id = item.get('tree_species_id')
                no_survived = item.get('no_survived', 0)
                no_dead = item.get('no_dead', 0)

                if not tree_species_id:
                    raise ValueError(f"Missing tree_species_id: {item}")

                tree_species = get_object_or_404(Tree_species, tree_specie_id=tree_species_id)

                ProgressReportSpecies.objects.create(
                    progress_report=report,
                    tree_species=tree_species,
                    no_survived=int(no_survived),
                    no_dead=int(no_dead),
                )

        return JsonResponse({'message': 'Progress report submitted', 'report_id': report.progress_report_id}, status=201)
    except Tree_species.DoesNotExist as e:
        return JsonResponse({'error': f'Tree species not found: {str(e)}'}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
def update_progress_report(request, report_id):
    """DataManager: Accept/Reject progress report"""
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
            
            Reason.objects.create(
                user=user,
                application=report.application,
                status_layer='report',
                reason=reason_text,
                status=status
            )

        return JsonResponse({'message': f'Report {status}'}, status=200)
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
        "application_id": r.application.application_id,
        "application_title": r.application.title,
        "application_status": r.application.status,
        "total_survived": r.total_survived,
        "total_dead": r.total_dead,
        "species": serialize_progress_report_species(r),
        "description": r.description,
        "status": r.status,
        "proof_image": r.proof_image_monitor_required.url if r.proof_image_monitor_required else None,
        "submitted_at": r.submitted_at.isoformat() if r.submitted_at else None
    } for r in qs]

    return JsonResponse(data, safe=False, status=200)


@csrf_exempt
def create_reapplication(request):
    """
    TreeGrower: Apply for a NEW tree planting program.
    Reuses existing User and Group. Only creates new Application.
    NOTE: Seedling requests happen AFTER application acceptance via create_seedling_request
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)

    user = get_user_from_token(request)
    if not user or user.user_role != 'treeGrowers':
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    # Prevent duplicate active applications
    active_statuses = ['for_evaluation', 'for_head', 'accepted', 'under_monitoring']
    if Application.objects.filter(user=user, status__in=active_statuses).exists():
        return JsonResponse({'error': 'You already have an active application. Please wait for it to be completed or rejected.'}, status=400)

    # Extract Application Data
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

    # Optional proposed_site and proposed_orientation_date
    proposed_site_id = request.POST.get('proposed_site_id') or None
    proposed_orientation_date = request.POST.get('proposed_orientation_date')
    
    if proposed_orientation_date:
        try:
            proposed_orientation_date = datetime.strptime(proposed_orientation_date, '%Y-%m-%d').date()
        except ValueError:
            return JsonResponse({'error': 'Invalid proposed_orientation_date format. Use YYYY-MM-DD.'}, status=400)

    try:
        with transaction.atomic():
            # Create New Application (classification='old' since they are a returning user)
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
    """
    TreeGrower: Fetch ALL their applications with progress reports
    Returns complete history grouped by application
    """
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    user = get_user_from_token(request)
    if not user or user.user_role != 'treeGrowers':
        return JsonResponse({'error': 'Unauthorized: TreeGrowers only'}, status=403)

    applications = Application.objects.filter(user=user).order_by('-created_at')
    
    history_data = []
    
    for app in applications:
        reports = ProgressReport.objects.filter(application=app).order_by('-created_at')
        
        # Calculate totals from species records
        total_planted = 0
        total_survived = 0
        for r in reports:
            if r.status == 'accepted':
                total_planted += r.total_plants
                total_survived += r.total_survived
        
        # Get seedling request totals
        seedling_requests = SeedlingRequest.objects.filter(application=app)
        total_requested = sum(sr.no_request_seedling for sr in seedling_requests)
        
        # Calculate total provided from species records
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
    """
    Fetch all applications with scheduled orientation dates for the Calendar.
    """
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
    """
    Aggregates all data needed for the General Program Report Dashboard.
    """
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    user = get_user_from_token(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    # Summary Stats
    total_groups = User.objects.filter(
        user_role='treeGrowers', 
        applications__isnull=False
    ).distinct().count()
    
    completed_apps = Application.objects.filter(status='completed').count()
    failed_apps = Application.objects.filter(status__in=['rejected', 'failed', 'cancelled']).count()
    ongoing_apps = Application.objects.filter(status__in=['accepted', 'under_monitoring', 'for_head', 'for_evaluation']).count()

    # Seedling Stats (from normalized species table)
    total_requested = SeedlingRequestSpecies.objects.filter(
        seedling_request__status='accepted'
    ).aggregate(total=Sum('quantity'))['total'] or 0

    # Progress Stats (from normalized species table)
    progress_stats = ProgressReportSpecies.objects.filter(
        progress_report__status='accepted'
    ).aggregate(
        total_survived=Sum('no_survived'),
        total_dead=Sum('no_dead')
    )
    total_survived = progress_stats['total_survived'] or 0
    total_dead = progress_stats['total_dead'] or 0

    # Site Stats
    site_stats = Sites.objects.filter(status='completed').aggregate(
        total_area=Sum('total_area_hectares')
    )
    total_area = site_stats['total_area'] or 0.0

    # Monthly Trend
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

    # Site & Application Correlation
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
        "group_profile": app.user.tree_grower_group.profile_img.url if hasattr(app.user, 'tree_grower_group') and app.user.tree_grower_group.profile_img else None,
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
    """
    Delete an application and all related data (Seedling Requests, Progress Reports, Reasons).
    Allowed for DataManager or the TreeGrower owner.
    """
    if request.method != 'DELETE':
        return JsonResponse({'error': 'Only DELETE allowed'}, status=405)

    user = get_user_from_token(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    app = get_object_or_404(Application, application_id=application_id)
    
    # Security: Only DataManager or the owner (TreeGrower) can delete
    if user.user_role != 'DataManager' and app.user != user:
        return JsonResponse({'error': 'Unauthorized to delete this application'}, status=403)

    # Safety: Prevent deletion of completed programs to preserve historical data
    if app.status == 'completed':
        return JsonResponse({
            'error': 'Cannot delete a completed application. It is preserved for historical records.'
        }, status=400)

    try:
        app_title = app.title
        
        # ✅ MAGIC HAPPENS HERE: 
        # Because of on_delete=models.CASCADE in your models.py, this single line 
        # automatically deletes all related SeedlingRequests, ProgressReports, and Reasons!
        app.delete() 
        
        return JsonResponse({
            'message': f'Application "{app_title}" and all related records deleted successfully.'
        }, status=200)
        
    except Exception as e:
        return JsonResponse({'error': f'Failed to delete application: {str(e)}'}, status=500)


@csrf_exempt
def get_available_sites_for_tree_grower(request):
    """
    GET: Fetch sites available for tree grower application with pagination.
    Returns sites that are:
    - status = 'accepted'
    - meta_verification.status = 'verified'
    
    ✅ Supports pagination, search, and barangay filter
    """
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    user = get_user_from_token(request)
    if not user or user.user_role != 'treeGrowers':
        return JsonResponse({'error': 'Unauthorized: TreeGrowers only'}, status=403)

    # ✅ Check if user has ongoing application
    ongoing_statuses = ['for_evaluation', 'for_head', 'accepted', 'under_monitoring']
    has_ongoing = Application.objects.filter(
        user=user, 
        status__in=ongoing_statuses
    ).exists()

    # ✅ Pagination parameters
    try:
        page = max(int(request.GET.get('page', 1)), 1)
        entries = max(int(request.GET.get('entries', 10)), 10)
        entries = min(entries, 50)  # Max 50 per page
    except (ValueError, TypeError):
        page, entries = 1, 10

    # ✅ Filters
    search = request.GET.get('search', '').strip()
    barangay_filter = request.GET.get('barangay', '').strip()

    # ✅ Base query
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

    # ✅ Apply filters
    if search:
        sites = sites.filter(
            Q(name__icontains=search) |
            Q(reforestation_area__name__icontains=search)
        )
    
    if barangay_filter:
        sites = sites.filter(
            reforestation_area__barangay__name__icontains=barangay_filter
        )

    # ✅ Pagination
    total = sites.count()
    total_page = math.ceil(total / entries) if total > 0 else 1
    offset = (page - 1) * entries
    has_next = page < total_page

    # ✅ Serialize sites for current page
    data = []
    for site in sites[offset:offset + entries]:
        general_images = site.site_images.filter(layer_tag='general').order_by('-created_at')
        images_data = []
        for img in general_images:
            if img.img:
                images_data.append({
                    'image_id': img.site_image_id,
                    'url': img.img.url,
                    'caption': img.caption
                })

        data.append({
            'site_id': site.site_id,
            'name': site.name,
            'reforestation_area': site.reforestation_area.name,
            'barangay': site.reforestation_area.barangay.name if site.reforestation_area.barangay else 'N/A',
            'total_area_hectares': site.total_area_hectares,
            'ndvi_value': site.ndvi_value,
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