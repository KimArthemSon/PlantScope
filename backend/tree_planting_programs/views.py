from django.utils import timezone
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import get_object_or_404
from django.db import transaction
import json
import math

from .models import Application, SeedlingRequest, ProgressReport, Reason
from sites.models import Sites
from accounts.helper import get_user_from_token
from accounts.models import User
from django.db.models import Sum, Count, Q
from django.db.models.functions import TruncMonth
from datetime import datetime, timedelta

# ─────────────────────────────────────────────────────────────────────────────
# HELPER FUNCTIONS
# ─────────────────────────────────────────────────────────────────────────────

def normalize_seedling_type(data, default_provider="ENRO Nursery"):
    """
    Convert flat seedling format to nested format for consistency.
    Input: {"Narra": 30} or {"Narra": {"quantity": 30, "provided_by": "ENRO"}}
    Output: {"Narra": {"quantity": 30, "provided_by": "ENRO Nursery"}}
    """
    if not data or not isinstance(data, dict):
        return {}
    
    normalized = {}
    for species, val in data.items():
        if isinstance(val, (int, float)):
            # Flat format: {"Narra": 30}
            normalized[species] = {"quantity": int(val), "provided_by": default_provider}
        elif isinstance(val, dict) and "quantity" in val:
            # Already nested: {"Narra": {"quantity": 30, "provided_by": "ENRO"}}
            normalized[species] = {
                "quantity": int(val["quantity"]),
                "provided_by": val.get("provided_by", default_provider)
            }
        else:
            # Invalid format - skip or use fallback
            continue
    return normalized


def serialize_seedling_type(seedling_type):
    """
    Ensure seedling_type is always in nested format for frontend consumption.
    Handles both old flat format and new nested format.
    """
    if not seedling_type:
        return {}
    
    result = {}
    for species, val in seedling_type.items():
        if isinstance(val, (int, float)):
            # Convert flat to nested
            result[species] = {"quantity": int(val), "provided_by": "Unknown"}
        elif isinstance(val, dict) and "quantity" in val:
            # Already nested - ensure types are correct
            result[species] = {
                "quantity": int(val["quantity"]),
                "provided_by": str(val.get("provided_by", "Unknown"))
            }
        else:
            # Fallback for malformed data
            result[species] = {"quantity": 0, "provided_by": "Unknown"}
    return result


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

    qs = Application.objects.select_related('user__organization').order_by('-created_at')
    
    if status_filter != 'All':
        qs = qs.filter(status=status_filter)
    if classification_filter != 'All':
        qs = qs.filter(classification=classification_filter)
    if search:
        qs = qs.filter(user__organization__organization_name__icontains=search)

    total = qs.count()
    total_page = math.ceil(total / entries) if total > 0 else 1
    offset = (page - 1) * entries

    data = [{
        "application_id": app.application_id,
        "organization_name": app.user.organization.organization_name,
        "org_email": app.user.organization.email,
        "org_profile": app.user.organization.profile_img.url if app.user.organization.profile_img else None,
        "title": app.title,
        "classification": app.classification,
        "status": app.status,
        "total_members": app.total_members,
        "created_at": app.created_at.strftime("%d/%m/%Y")
    } for app in qs[offset:offset + entries]]

    return JsonResponse({'data': data, 'total_page': total_page, 'page': page, 'entries': entries, 'total': total}, status=200)


@csrf_exempt
def get_application(request, application_id):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    app = get_object_or_404(Application, application_id=application_id)
    
    # Get latest reason for this application
    latest_reason = Reason.objects.filter(application=app).order_by('-created').first()
    
    # Get seedling requests & progress reports
    seedling_requests = SeedlingRequest.objects.filter(application=app).order_by('-created_at')
    progress_reports = ProgressReport.objects.filter(application=app).order_by('-created_at')

    data = {
        "application": {
            "application_id": app.application_id,
            "title": app.title,
            "description": app.description,
            "classification": app.classification,
            "status": app.status,
            "total_members": app.total_members,
            "project_duration": app.project_duration,
            "orientation_date": app.orientation_date.isoformat() if app.orientation_date else None,
            "confirmed_at": app.confirmed_at.isoformat() if app.confirmed_at else None,
            "maintenance_plan": app.maintenance_plan.url if app.maintenance_plan else None,
            "agreement_image": app.agreement_image.url if app.agreement_image else None,
            "created_at": app.created_at.isoformat(),
            "updated_at": app.updated_at.isoformat(),
        },
        "organization": {
            "organization_name": app.user.organization.organization_name,
            "org_email": app.user.organization.email,
            "org_contact": app.user.organization.contact,
            "org_address": app.user.organization.address,
            "org_profile": app.user.organization.profile_img.url if app.user.organization.profile_img else None,
        },
        "profile": {
            "first_name": app.user.profile.first_name,
            "last_name": app.user.profile.last_name,
            "contact": app.user.profile.contact,
            "gender": app.user.profile.gender,
        } if app.user.profile else None,
        # ✅ FIX #1: Null-safe assigned_site serialization
        "assigned_site": {
            "site_id": app.site.site_id,
            "name": app.site.name,
            "barangay": (
                app.site.reforestation_area.barangay.name 
                if app.site.reforestation_area and app.site.reforestation_area.barangay 
                else None
            ),
            "polygon_coordinates": app.site.polygon_coordinates,
        } if app.site else None,
        # ✅ FIX #4: Backward-compatible seedling_type serialization
        "seedling_requests": [{
            "request_id": sr.maintenance_report_id,
            "no_request_seedling": sr.no_request_seedling,
            "seedling_type": serialize_seedling_type(sr.seedling_type),
            "status": sr.status,
            "reason_accepted": sr.reason_accepted,
            "submitted_at": sr.submitted_at.isoformat() if sr.submitted_at else None
        } for sr in seedling_requests],
        "progress_reports": [{
            "report_id": pr.progress_report_id,
            "no_survived_plants": pr.no_survived_plants,
            "no_dead_plants": pr.no_dead_plants,
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
        'user__organization'
    )
    
    if barangay:
        qs = qs.filter(site__reforestation_area__barangay__name__icontains=barangay)
        
    qs = qs.order_by('-created_at')

    data = [{
        "application_id": app.application_id,
        "title": app.title,
        "organization_name": app.user.organization.organization_name,
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

    # ✅ FIX: Get the LATEST application instead of assuming 1-to-1
    app = Application.objects.filter(user=user).order_by('-created_at').first()
    
    # Base user/org data (always return this so the frontend knows who is logged in)
    org_data = {
        "organization_name": user.organization.organization_name,
        "org_email": user.organization.email,
        "org_contact": user.organization.contact,
        "org_address": user.organization.address,
        "org_profile": user.organization.profile_img.url if user.organization.profile_img else None,
    } if hasattr(user, 'organization') else None
    
    profile_data = {
        "first_name": user.profile.first_name,
        "last_name": user.profile.last_name,
        "contact": user.profile.contact,
        "gender": user.profile.gender,
        "profile_img": user.profile.profile_img.url if user.profile.profile_img else None,
    } if hasattr(user, 'profile') else None

    # ✅ If no application exists, return null application but keep user data
    if not app:
        return JsonResponse({
            "application": None,
            "organization": org_data,
            "profile": profile_data,
            "assigned_site": None,
            "seedling_requests": [],
            "progress_reports": [],
            "latest_reason": None
        }, status=200)

    # --- If application exists, proceed with normal serialization ---
    latest_reason = Reason.objects.filter(application=app).order_by('-created').first()
    seedling_requests = SeedlingRequest.objects.filter(application=app).order_by('-created_at')
    progress_reports = ProgressReport.objects.filter(application=app).order_by('-created_at')

    data = {
        "application": {
            "application_id": app.application_id,
            "title": app.title,
            "description": app.description,
            "classification": app.classification,
            "status": app.status,
            "total_members": app.total_members,
            "project_duration": app.project_duration,
            "orientation_date": app.orientation_date.isoformat() if app.orientation_date else None,
            "confirmed_at": app.confirmed_at.isoformat() if app.confirmed_at else None,
            "maintenance_plan": app.maintenance_plan.url if app.maintenance_plan else None,
            "agreement_image": app.agreement_image.url if app.agreement_image else None,
            "created_at": app.created_at.isoformat(),
            "updated_at": app.updated_at.isoformat(),
        },
        "organization": org_data,
        "profile": profile_data,
        "assigned_site": {
            "site_id": app.site.site_id,
            "name": app.site.name,
            "barangay": (
                app.site.reforestation_area.barangay.name 
                if app.site.reforestation_area and app.site.reforestation_area.barangay 
                else None
            ),
            "polygon_coordinates": app.site.polygon_coordinates,
        } if app.site else None,
        "seedling_requests": [{
            "request_id": sr.maintenance_report_id,
            "no_request_seedling": sr.no_request_seedling,
            "seedling_type": serialize_seedling_type(sr.seedling_type),
            "status": sr.status,
            "reason_accepted": sr.reason_accepted,
            "submitted_at": sr.submitted_at.isoformat() if sr.submitted_at else None
        } for sr in seedling_requests],
        "progress_reports": [{
            "report_id": pr.progress_report_id,
            "no_survived_plants": pr.no_survived_plants,
            "no_dead_plants": pr.no_dead_plants,
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
    DataManager: Assign site, orientation, agreement, provide seedlings 
    (multiple species with individual providers), add reason → forward to Head
    """
    if request.method not in ('PUT', 'POST'):
        return JsonResponse({'error': 'Only PUT/POST allowed'}, status=405)

    user = get_user_from_token(request)
    if not user or user.user_role != 'DataManager':
        return JsonResponse({'error': 'Unauthorized: DataManager only'}, status=403)

    app = get_object_or_404(Application, application_id=application_id)
    if app.status not in ['for_evaluation']:
        return JsonResponse({'error': 'Application not in evaluation stage'}, status=400)

    # ─── Extract form data ─────────────────────────────────────────────
    site_id = request.POST.get('site_id')
    orientation_date = request.POST.get('orientation_date')
    reason_text = request.POST.get('reason', '').strip()
    
    # ─── Parse seedling provision JSON (NEW NESTED FORMAT) ─────────────
    seedling_provision_json = request.POST.get('seedling_provision', '{}')
    
    try:
        seedling_provision = json.loads(seedling_provision_json)
        
        if not isinstance(seedling_provision, dict):
            raise ValueError("seedling_provision must be a JSON object")
        
        # Validate and normalize nested structure for each species
        for species, data in seedling_provision.items():
            if not isinstance(data, dict):
                raise ValueError(f"Data for '{species}' must be an object")
            if 'quantity' not in data or 'provided_by' not in data:
                raise ValueError(f"Missing 'quantity' or 'provided_by' for '{species}'")
            if not isinstance(data['quantity'], (int, float)) or data['quantity'] < 1:
                raise ValueError(f"Invalid quantity for '{species}'")
            if not data['provided_by'] or not isinstance(data['provided_by'], str):
                raise ValueError(f"Invalid provided_by for '{species}'")
                
    except json.JSONDecodeError as e:
        return JsonResponse({'error': f'Invalid JSON format: {str(e)}'}, status=400)
    except ValueError as e:
        return JsonResponse({'error': str(e)}, status=400)

    # ─── Validate required fields ──────────────────────────────────────
    if not site_id:
        return JsonResponse({'error': 'site_id is required'}, status=400)
    if not orientation_date:
        return JsonResponse({'error': 'orientation_date is required'}, status=400)

    site = get_object_or_404(Sites, site_id=site_id)
    
    # Calculate total seedlings from nested structure
    total_seedlings = sum(
        data['quantity'] for data in seedling_provision.values() 
        if isinstance(data, dict) and 'quantity' in data
    )

    try:
        with transaction.atomic():
            # ─── Update Application ───────────────────────────────────
            app.site = site
            app.orientation_date = orientation_date
            app.status = 'for_head'
            
            if 'agreement_image' in request.FILES:
                app.agreement_image = request.FILES['agreement_image']
            app.save()

            # ─── Update or Create SeedlingRequest ─────────────────────
            initial_request = SeedlingRequest.objects.filter(
                application=app, 
                status='pending'
            ).first()
            
            if initial_request:
                # Update existing request with nested provision data
                initial_request.status = 'accepted'
                initial_request.seedling_type = seedling_provision  # Store nested JSON
                initial_request.no_request_seedling = total_seedlings
                initial_request.reason_accepted = f"DM Evaluation: {reason_text}"
                initial_request.save()
            else:
                # Create new provision record
                SeedlingRequest.objects.create(
                    application=app,
                    no_request_seedling=total_seedlings,
                    seedling_type=seedling_provision,  # Store nested JSON
                    description="Provision details set during DM evaluation",
                    status='accepted',
                    reason_accepted=f"DM Evaluation: {reason_text}"
                )

            # ─── Log Reason for audit trail ───────────────────────────
            Reason.objects.create(
                user=user,
                application=app,
                status_layer='new_program',
                reason=reason_text,
                status='for_head'
            )

        # ─── Success Response ─────────────────────────────────────────
        return JsonResponse({
            'message': 'Application evaluated and forwarded to Head', 
            'application_id': app.application_id,
            'seedling_provision': seedling_provision,  # Echo nested structure
            'total_seedlings': total_seedlings
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
            app.confirmed_at = timezone.now()
            
            # ✅ FIX #2: Clear workflow state management
            if status == 'accepted':
                # Activate user account
                app.user.is_active = True
                app.user.save()
                # Move to monitoring phase
                workflow_status = 'accepted'
            else:
                # Rejected - stay as rejected
                workflow_status = 'rejected'
            
            app.status = workflow_status
            app.classification = 'old'
            app.save()

            Reason.objects.create(
                user=user,
                application=app,
                status_layer='new_program',
                reason=reason_text,
                status=status  # Store the decision (accepted/rejected), not workflow state
            )

        return JsonResponse({
            'message': f'Application {status}', 
            'new_status': app.status  # Returns actual stored status (under_monitoring or rejected)
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

    # ✅ Extract the status sent from the frontend ("completed" or "failed")
    new_status = data.get('status', 'completed').strip()
    reason_text = data.get('reason', 'Program finalized.').strip()
    
    # Validate the status
    if new_status not in ['completed', 'failed']:
        return JsonResponse({'error': 'Status must be completed or failed'}, status=400)

    app = get_object_or_404(Application, application_id=application_id)
    
    if app.status not in ['accepted', 'under_monitoring']:
        return JsonResponse({'error': 'Application must be accepted or under monitoring to finalize'}, status=400)

    try:
        with transaction.atomic():
            # 1. Update the application status
            app.status = new_status
            app.save()
            
            # 2. Log the reason for the audit trail
            Reason.objects.create(
                user=user,
                application=app,
                status_layer='new_program',
                reason=reason_text,
                status=new_status
            )
            
            # ✅ 3. NEW: If completed, update the associated Site status to 'completed'
            if new_status == 'completed' and app.site:
                app.site.status = 'completed'
                app.site.save()
            
            # ✅ If failed, the site status remains 'accepted' (we do nothing to the site)

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
    no_request = request.POST.get('no_request_seedling')
    seedling_type_str = request.POST.get('seedling_type')
    description = request.POST.get('description', '').strip()
    
    if not app_id or not no_request or not seedling_type_str:
        return JsonResponse({'error': 'application_id, no_request_seedling, seedling_type required'}, status=400)

    try:
        seedling_type = json.loads(seedling_type_str)
        if not isinstance(seedling_type, dict):
            raise ValueError
    except:
        return JsonResponse({'error': 'seedling_type must be valid JSON object'}, status=400)

    app = get_object_or_404(Application, application_id=app_id, user=user)
    if app.status not in ['accepted', 'under_monitoring', 'completed']:
        return JsonResponse({'error': 'Cannot request seedlings for this application status'}, status=400)

    try:
        with transaction.atomic():
            # ✅ FIX #3: Normalize to nested format for consistency
            normalized_seedling_type = normalize_seedling_type(seedling_type)
            
            req = SeedlingRequest.objects.create(
                application=app,
                no_request_seedling=int(no_request),
                seedling_type=normalized_seedling_type,  # Always store nested format
                description=description,
                status='pending',
                request_file=request.FILES.get('request_file')
            )
        return JsonResponse({'message': 'Seedling request submitted', 'request_id': req.maintenance_report_id}, status=201)
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
    
    # NEW: Optional seedling provision for editing
    seedling_provision = data.get('seedling_provision')
    
    if status not in ['accepted', 'rejected']:
        return JsonResponse({'error': 'Status must be accepted or rejected'}, status=400)

    req = get_object_or_404(SeedlingRequest, maintenance_report_id=request_id)
    if req.status != 'pending':
        return JsonResponse({'error': 'Request already processed'}, status=400)

    try:
        with transaction.atomic():
            # ✅ If DM provided new seedling details and is accepting, update them
            if status == 'accepted' and seedling_provision:
                # Validate nested format using helper
                seedling_provision = normalize_seedling_type(seedling_provision)
                
                if not seedling_provision:
                    return JsonResponse({'error': 'Invalid seedling provision data'}, status=400)
                
                # Calculate total seedlings
                total_seedlings = sum(int(p['quantity']) for p in seedling_provision.values())
                
                if total_seedlings < 1:
                    return JsonResponse({'error': 'Total seedlings must be at least 1'}, status=400)

                # Update the request with DM's provision
                req.seedling_type = seedling_provision
                req.no_request_seedling = total_seedlings
            
            # Update status and reason
            req.status = status
            req.reason_accepted = reason_text
            req.save()
            
            # Log reason for audit
            Reason.objects.create(
                user=user,
                application=req.application,
                status_layer='new_program',
                reason=reason_text,
                status=status
            )
        return JsonResponse({'message': f'Request {status}'}, status=200)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
def delete_seedling_request(request, request_id):
    if request.method != 'DELETE':
        return JsonResponse({'error': 'Only DELETE allowed'}, status=405)

    user = get_user_from_token(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    req = get_object_or_404(SeedlingRequest, maintenance_report_id=request_id)
    
    # Only allow delete if pending and owned by user or DM
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
    
    qs = SeedlingRequest.objects.select_related('application__user__organization').order_by('-created_at')
    
    if user.user_role == 'treeGrowers':
        qs = qs.filter(application__user=user)
    if status_filter:
        qs = qs.filter(status=status_filter)
    if app_id:
        qs = qs.filter(application_id=app_id)

    data = [{
        "request_id": r.maintenance_report_id,
        "application_id": r.application.application_id,
        "application_title": r.application.title,
        "organization_name": r.application.user.organization.organization_name,
        "no_request_seedling": r.no_request_seedling,
        # ✅ FIX #4: Serialize to nested format for frontend
        "seedling_type": serialize_seedling_type(r.seedling_type),
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
    survived = request.POST.get('no_survived_plants', 0)
    dead = request.POST.get('no_dead_plants', 0)
    description = request.POST.get('description', '').strip()
    
    if not app_id:
        return JsonResponse({'error': 'application_id required'}, status=400)

    app = get_object_or_404(Application, application_id=app_id)
    if app.status not in ['accepted', 'under_monitoring']:
        return JsonResponse({'error': 'Application not under monitoring'}, status=400)

    try:
        with transaction.atomic():
            report = ProgressReport.objects.create(
                application=app,
                no_survived_plants=int(survived),
                no_dead_plants=int(dead),
                description=description,
                proof_image_monitor_required=request.FILES.get('proof_image'),
                status='accepted'
            )
        return JsonResponse({'message': 'Progress report submitted', 'report_id': report.progress_report_id}, status=201)
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
        'application__user__organization'
    ).order_by('-created_at')
    
    if status_filter:
        qs = qs.filter(status=status_filter)
    if app_id:
        qs = qs.filter(application_id=app_id)

    data = [{
        "report_id": r.progress_report_id,  # Fixed: Removed space
        "application_id": r.application.application_id, # Fixed: Removed space
        "application_title": r.application.title,
        "application_status": r.application.status,  # ✅ NEW: Added for filtering
        "no_survived_plants": r.no_survived_plants,
        "no_dead_plants": r.no_dead_plants,
        "description": r.description,
        "status": r.status,
        "proof_image": r.proof_image_monitor_required.url if r.proof_image_monitor_required else None,
        "submitted_at": r.submitted_at.isoformat() if r.submitted_at else None
    } for r in qs]

    return JsonResponse(data, safe=False, status=200)


#     @csrf_exempt
# def get_progress_reports(request):
#     if request.method != 'GET':
#         return JsonResponse({'error': 'Only GET allowed'}, status=405)

#     user = get_user_from_token(request)
#     if not user:
#         return JsonResponse({'error': 'Unauthorized'}, status=403)

#     status_filter = request.GET.get('status')
#     app_id = request.GET.get('application_id')
    
#     qs = ProgressReport.objects.select_related('application__user__organization').order_by('-created_at')
    
#     if status_filter:
#         qs = qs.filter(status=status_filter)
#     if app_id:
#         qs = qs.filter(application_id=app_id)

#     data = [{
#         "report_id": r.progress_report_id,
#         "application_id": r.application.application_id,
#         "application_title": r.application.title,
#         "no_survived_plants": r.no_survived_plants,
#         "no_dead_plants": r.no_dead_plants,
#         "description": r.description,
#         "status": r.status,
#         "proof_image": r.proof_image_monitor_required.url if r.proof_image_monitor_required else None,
#         "submitted_at": r.submitted_at.isoformat() if r.submitted_at else None
#     } for r in qs]

#     return JsonResponse(data, safe=False, status=200)

@csrf_exempt
def create_reapplication(request):
    """
    TreeGrower: Apply for a NEW tree planting program.
    Reuses existing User and Organization. Only creates new Application & SeedlingRequest.
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)

    user = get_user_from_token(request)
    if not user or user.user_role != 'treeGrowers':
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    # ✅ Prevent duplicate active applications
    active_statuses = ['for_evaluation', 'for_head', 'accepted', 'under_monitoring']
    if Application.objects.filter(user=user, status__in=active_statuses).exists():
        return JsonResponse({'error': 'You already have an active application. Please wait for it to be completed or rejected.'}, status=400)

    # Extract Application Data
    title = request.POST.get('title')
    description = request.POST.get('description')
    total_members = request.POST.get('total_members')
    project_duration = request.POST.get('project_duration')
    maintenance_plan = request.FILES.get('maintenance_plan')
    
    # Extract Seedling Data
    no_request_seedling = request.POST.get('no_request_seedling')
    seedling_type_str = request.POST.get('seedling_type')
    seedling_description = request.POST.get('seedling_description', '')
    seedling_request_file = request.FILES.get('seedling_request_file')

    if not all([title, description, total_members, project_duration, maintenance_plan, no_request_seedling, seedling_type_str]):
        return JsonResponse({'error': 'Missing required fields.'}, status=400)

    try:
        seedling_type = json.loads(seedling_type_str)
        if not isinstance(seedling_type, dict): raise ValueError
    except:
        return JsonResponse({'error': 'seedling_type must be valid JSON'}, status=400)

    try:
        with transaction.atomic():
            # 1. Create New Application (classification='old' since they are a returning user)
            app = Application.objects.create(
                user=user,
                title=title,
                description=description,
                total_members=int(total_members),
                project_duration=int(project_duration),
                maintenance_plan=maintenance_plan,
                classification='old', 
                status='for_evaluation'
            )
            
            # 2. Create New Seedling Request
            SeedlingRequest.objects.create(
                application=app,
                no_request_seedling=int(no_request_seedling),
                seedling_type=seedling_type,
                description=seedling_description,
                request_file=seedling_request_file,
                status='pending'
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

    # Get ALL applications for this user, ordered by creation date (newest first)
    applications = Application.objects.filter(user=user).order_by('-created_at')
    
    history_data = []
    
    for app in applications:
        # Get all progress reports for this application (NOT MaintenanceReport!)
        reports = ProgressReport.objects.filter(application=app).order_by('-created_at')
        
        # Calculate totals for this application
        total_planted = sum(r.no_dead_plants + r.no_survived_plants for r in reports if r.status == 'accepted')
        total_survived = sum(r.no_survived_plants for r in reports if r.status == 'accepted')
        
        # Get seedling request totals
        seedling_requests = SeedlingRequest.objects.filter(application=app)
        total_requested = sum(sr.no_request_seedling for sr in seedling_requests)
        total_provided = sum(
            sum(data.get('quantity', 0) for data in sr.seedling_type.values() if isinstance(data, dict))
            for sr in seedling_requests if sr.status == 'accepted' and sr.seedling_type
        )
        
        app_data = {
            "application_id": app.application_id,
            "title": app.title,
            "description": app.description,
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
            "total_area_planted": "0.00",  # ProgressReport doesn't track area, set to 0
            "reports": [{
                "maintenance_report_id": r.progress_report_id,  # Map to frontend expectation
                "title": f"Progress Report #{r.progress_report_id}",  # Generate title
                "description": r.description or "No description provided",
                "status": r.status,
                "total_seedling_planted": r.no_dead_plants + r.no_survived_plants,  # Calculate total
                "total_seedling_survived": r.no_survived_plants,
                "total_area_planted": "0.00",  # Not tracked in ProgressReport
                "total_owned_seedling_planted": 0,  # Not tracked in ProgressReport
                "total_member_present": None,  # Not tracked in ProgressReport
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
    - TreeGrowers only see their own orientations.
    - DataManager and CityENROHead see all orientations.
    """
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    user = get_user_from_token(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    # Base queryset: only fetch applications that have an orientation_date assigned
    qs = Application.objects.filter(
        orientation_date__isnull=False
    ).order_by('orientation_date')
    
    # Role-based filtering: Tree Growers should only see their own calendar events
    if user.user_role == 'treeGrowers':
        qs = qs.filter(user=user)
    # DataManager and CityENROHead can see all scheduled orientations

    # Serialize the data to match the frontend's OrientationDate interface
    data = [{
        "application_id": app.application_id,
        "title": app.title,
        "orientation_date": app.orientation_date.isoformat(), # Formats as YYYY-MM-DD
        "status": app.status,
    } for app in qs]

    return JsonResponse(data, safe=False, status=200)

@csrf_exempt
def get_site_applications(request, site_id):
    """Fetch all tree planting applications assigned to a specific site"""
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    try:
        # Fetch applications linked to this site, including organization details
        apps = Application.objects.filter(site_id=site_id).select_related(
            'user__organization'
        ).order_by('-created_at')
        
        data = [{
            "application_id": app.application_id,
            "title": app.title,
            "status": app.status,
            "classification": app.classification,
            "organization_name": app.user.organization.organization_name if hasattr(app.user, 'organization') else "Unknown",
            "total_members": app.total_members,
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

    # ─── 1. Summary Stats ──────────────────────────────────────────────
    total_orgs = User.objects.filter(
        user_role='treeGrowers', 
        applications__isnull=False
    ).distinct().count()
    
    completed_apps = Application.objects.filter(status='completed').count()
    # Count rejected, failed, or cancelled as "failed" programs
    failed_apps = Application.objects.filter(status__in=['rejected', 'failed', 'cancelled']).count()
    ongoing_apps = Application.objects.filter(status__in=['accepted', 'under_monitoring', 'for_head', 'for_evaluation']).count()

    # Seedling Stats (Only count accepted requests)
    seedling_stats = SeedlingRequest.objects.filter(status='accepted').aggregate(
        total_requested=Sum('no_request_seedling')
    )
    total_requested = seedling_stats['total_requested'] or 0

    # Progress Stats (Only count accepted reports)
    progress_stats = ProgressReport.objects.filter(status='accepted').aggregate(
        total_survived=Sum('no_survived_plants'),
        total_dead=Sum('no_dead_plants')
    )
    total_survived = progress_stats['total_survived'] or 0
    total_dead = progress_stats['total_dead'] or 0

    # Site Stats (Only completed sites)
    site_stats = Sites.objects.filter(status='completed').aggregate(
        total_area=Sum('total_area_hectares')
    )
    total_area = site_stats['total_area'] or 0.0

    # ─── 2. Monthly Trend (Last 6 Months) ──────────────────────────────
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

    # ─── 3. Site & Application Correlation ─────────────────────────────
    # Get sites that have at least one application, fetch the latest application for each
    sites_with_apps = Sites.objects.filter(
        applications__isnull=False
    ).select_related(
        'reforestation_area__barangay'
    ).prefetch_related('applications__user__organization').distinct()[:15] # Limit to 15 for performance

    site_applications = []
    for site in sites_with_apps:
        latest_app = site.applications.order_by('-created_at').first()
        if latest_app:
            site_applications.append({
                "site_name": site.name,
                "barangay": site.reforestation_area.barangay.name if site.reforestation_area and site.reforestation_area.barangay else "N/A",
                "app_title": latest_app.title,
                "org": latest_app.user.organization.organization_name if hasattr(latest_app.user, 'organization') else "Unknown",
                "status": latest_app.status
            })

    # ─── Return Payload ────────────────────────────────────────────────
    data = {
        "stats": {
            "total_organizations": total_orgs,
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

# views.py
from django.db.models import Q
import math

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

    # Fetch applications with related site and organization data
    qs = Application.objects.select_related(
        'user__organization', 
        'site__reforestation_area__barangay'
    ).order_by('-created_at')
    
    # Apply filters
    if status_filter and status_filter != 'All':
        qs = qs.filter(status=status_filter)
    if search:
        qs = qs.filter(
            Q(title__icontains=search) | 
            Q(user__organization__organization_name__icontains=search) |
            Q(site__name__icontains=search)
        )
    if date_from:
        qs = qs.filter(created_at__date__gte=date_from)
    if date_to:
        qs = qs.filter(created_at__date__lte=date_to)

    total = qs.count()
    total_page = math.ceil(total / entries) if total > 0 else 1
    offset = (page - 1) * entries

    # Serialize data including linked site information
    data = [{
        "application_id": app.application_id,
        "title": app.title,
        "status": app.status,
        "classification": app.classification,
        "total_members": app.total_members,
        "created_at": app.created_at.strftime("%Y-%m-%d"),
        "organization_name": app.user.organization.organization_name if hasattr(app.user, 'organization') else "Unknown",
        "org_email": app.user.organization.email if hasattr(app.user, 'organization') else "",
        "org_profile": app.user.organization.profile_img.url if hasattr(app.user, 'organization') and app.user.organization.profile_img else None,
        # ✅ Linked Site Info
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