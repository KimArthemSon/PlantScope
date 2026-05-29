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
    """
    TreeGrower: Fetch their own application using auth token.
    No application_id in URL - fetched from authenticated user.
    GET /api/get_tree_grower_application/
    """
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    user = get_user_from_token(request)
    if not user or user.user_role != 'treeGrowers':
        return JsonResponse({'error': 'Unauthorized: TreeGrowers only'}, status=403)

    # Get the TreeGrower's application (assuming one app per user)
    app = get_object_or_404(Application, user=user)
    
    # Get related data
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
        "organization": {
            "organization_name": user.organization.organization_name,
            "org_email": user.organization.email,
            "org_contact": user.organization.contact,
            "org_address": user.organization.address,
            "org_profile": user.organization.profile_img.url if user.organization.profile_img else None,
        } if hasattr(user, 'organization') else None,
        "profile": {
            "first_name": user.profile.first_name,
            "last_name": user.profile.last_name,
            "contact": user.profile.contact,
            "gender": user.profile.gender,
            "profile_img": user.profile.profile_img.url if user.profile.profile_img else None,
        } if hasattr(user, 'profile') else None,
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
    """DataManager: Finalize program as completed"""
    if request.method != 'PUT':
        return JsonResponse({'error': 'Only PUT allowed'}, status=405)

    user = get_user_from_token(request)
    if not user or user.user_role != 'DataManager':
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    reason_text = data.get('reason', 'Program completed successfully.').strip()
    app = get_object_or_404(Application, application_id=application_id)
    
    if app.status not in ['accepted', 'under_monitoring']:
        return JsonResponse({'error': 'Application must be under monitoring to complete'}, status=400)

    try:
        with transaction.atomic():
            app.status = 'completed'
            app.save()
            Reason.objects.create(
                user=user,
                application=app,
                status_layer='new_program',
                reason=reason_text,
                status='completed'
            )
        return JsonResponse({'message': 'Application marked as completed'}, status=200)
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

