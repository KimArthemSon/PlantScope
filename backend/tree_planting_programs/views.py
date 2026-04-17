from django.utils import timezone
import json
from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from .models import Application, Reason,Maintenance_report, Notification
from django.shortcuts import get_object_or_404
import math
from sites.models import Sites
from django.db import transaction
from accounts.helper import get_user_from_token
from accounts.models import User
# Create your views here.

@csrf_exempt
def get_applications(request):
    
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET Allowed!'}, status=405)  # 405 = Method Not Allowed
    
    status_filter = request.GET.get('status', 'All')
    classification_filter = request.GET.get('classification', 'All')
    search = request.GET.get('search', '').strip()
    
    # Safe integer conversion
    try:
        entries = int(request.GET.get('entries', 10))
        page = int(request.GET.get('page', 1))
    except (ValueError, TypeError):
        entries, page = 10, 1
        
    entries = max(entries, 10)
    page = max(page, 1)
    
    # 1. Use select_related to prevent N+1 query problems
    qs = Application.objects.select_related('user__organization')
    
    # 2. Apply filters FIRST
    if status_filter != 'All':
        qs = qs.filter(status=status_filter)
    if classification_filter != 'All':
        qs = qs.filter(classification=classification_filter)
    if search:
        # 🔍 FIXED: Correct Django ORM traversal syntax
        qs = qs.filter(user__organization__organization_name__icontains=search)
        
    qs = qs.order_by('created_at')
    
    # 3. Count AFTER filtering so pagination is accurate
    total = qs.count()
    total_page = math.ceil(total / entries) if total > 0 else 0
    
    # 4. Apply pagination
    offset = (page - 1) * entries
    paginated_qs = qs[offset:offset + entries]
    
    data = [
        {
            "application_id": app.application_id,
            "organization_name": app.user.organization.organization_name,
            "org_email": app.user.organization.email,
            "org_profile": app.user.organization.profile_img.url if app.user.organization.profile_img else None,
            "title": app.title,
            "classification": app.classification,
            "status": app.status,
            "total_members": app.total_members,
            "total_request_seedling": app.total_request_seedling,
            "created_at": app.created_at.strftime("%d/%m/%Y"),  # Changed %y to %Y for 4-digit year
        } for app in paginated_qs
    ]
    
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
        return JsonResponse({"error": 'Only GET Allowed!'}, status=401)
    
    application = get_object_or_404(Application, application_id=application_id)
    
    # ─── Fetch Data Manager's reason from Reason table ─────────────────────
    # Get the most recent reason entry with status='for_head' for this application
    # This assumes the Data Manager creates a Reason entry when forwarding to Head
    dm_reason_entry = Reason.objects.filter(
        application=application,
        status='for_head',
        status_layer='new_program'  # Adjust if your workflow uses a different layer
    ).order_by('-created').first()
    
    data = {
        "account": {
            "account_id": application.user.id,
            "email": application.user.email,
        },
        "organization_information": {
            "organization_id": application.user.organization.id,
            "organization_name": application.user.organization.organization_name,
            "org_email": application.user.organization.email,
            "org_address": application.user.organization.address,  # ← Fixed: was using .email
            "org_contact": application.user.organization.contact,  # ← Fixed: was using .email
            "org_profile": application.user.organization.profile_img.url if application.user.organization.profile_img else None,
            "created_at": application.created_at,
        },
        "application": {
            "application_id": application.application_id,
            "title": application.title,
            "description": application.description,
            "total_request_seedling": application.total_request_seedling,
            "maintenance_plan": application.maintenance_plan.url if application.maintenance_plan else None,
            "agreement_image": application.agreement_image.url if application.agreement_image else None,
            "total_seedling_provided": application.total_seedling_provided,
            "total_area_planted": application.total_area_planted,  # ← Fixed: was using total_seedling_provided
            "total_seedling_survived": application.total_seedling_survived,  # ← Fixed
            "total_seedling_planted": application.total_seedling_planted,  # ← Fixed
            "updated_at": application.updated_at,
            "created_at": application.created_at,
            # ─── DM Evaluation Fields (for Head Confirmation view) ─────────
            "dm_status": application.status,  # Should be 'for_head'
            "dm_reason": dm_reason_entry.reason if dm_reason_entry else None,
            "orientation_date": application.orientation_date.isoformat() if application.orientation_date else None,
        },
        "profile": None,
        "assigned_site": None
    }

    # Profile data - show for new applications or when needed for review
    if application.user.profile:
        data["profile"] = {
            "first_name": application.user.profile.first_name,
            "middle_name": application.user.profile.middle_name,
            "last_name": application.user.profile.last_name,
            "birthday": application.user.profile.birthday,
            "gender": application.user.profile.gender,
            "contact": application.user.profile.contact,
            "address": application.user.profile.address,
            "profile_img": application.user.profile.profile_img.url if application.user.profile.profile_img else None,
        }

    # Assigned site data (set by Data Manager during evaluation)
    if application.site:
        data["assigned_site"] = {
            "name": application.site.name,
            "reforestation_area": application.site.reforestation_area.name if application.site.reforestation_area else None,
            "land_classification": application.site.reforestation_area.land_classification.name if application.site.reforestation_area and application.site.reforestation_area.land_classification else None,
            "polygon_coordinates": application.site.polygon_coordinates,
            "barangay": application.site.reforestation_area.barangay.name if application.site.reforestation_area and application.site.reforestation_area.barangay else None,
        }

    return JsonResponse(data, status=200)

@csrf_exempt
def evaluate_application(request, application_id):

    if request.method not in 'PUT POST':
        return JsonResponse({'error': "Only PUT Allowed"}, status=401)
    
    user = get_user_from_token(request)
    if not user:
            return JsonResponse({'error': 'Unauthorized'}, status=403)
    
    #data manager
    site_id = int(request.POST.get('site_id',0))
    total_seedling_provided = int(request.POST.get('total_seedling_provided', 0))
    orientation_date = request.POST.get('orientation_date',"")
    agreement_image = request.FILES.get("agreement_image")
    reason = request.POST.get("reason", "")
    status = request.POST.get("status", "")

    application = get_object_or_404(Application, application_id=application_id)

    print(status)
    print(total_seedling_provided, "asdasd")
    application.status = status
    application.orientation_date = orientation_date

    if total_seedling_provided <= 0 or total_seedling_provided > 50:
        return JsonResponse({'error': "Provided a valid amount for seedling provided!"}, status=400)
    if agreement_image:
        application.agreement_image = agreement_image
    
    application.total_seedling_provided = total_seedling_provided
    site = get_object_or_404(Sites, site_id=site_id)
    application.site = site

    try:
        with transaction.atomic():
            user = get_object_or_404(User, id=user.id)
            application.save()
            Reason.objects.create(
                user=user,
                status=status,
                application=application,
                reason=reason
            )
    except Exception as e:
        return JsonResponse({'error': e})

    return JsonResponse({'message': "Successfully forwarded to Head"})

@csrf_exempt
def confirmation_application(request, application_id):
    
    if request.method != 'PUT':
        return JsonResponse({'error': 'Only PUT Allowed'}, status=405)
    
    user = get_user_from_token(request)
    if not user or user.user_role != 'CityENROHead':  # ← Ensure only Head can confirm
        return JsonResponse({'error': 'Unauthorized'}, status=403)
    
    try:
        data = json.loads(request.body)  # ← Use JSON body for PUT
    except:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)
    
    status = data.get('status')  # 'approved' or 'rejected'
    reason = data.get('reason', '')
    
    if status not in ['approved', 'rejected']:
        return JsonResponse({'error': 'Invalid status'}, status=400)
    if status == 'approved':
        status = 'accepted'
    application = get_object_or_404(Application, application_id=application_id)
    
    # ← Only allow confirmation if forwarded by Data Manager
    if application.status != 'for_head':
        return JsonResponse({'error': 'Application not ready for confirmation'}, status=400)
    
    try:
        with transaction.atomic():
            application.status = status
            application.confirmed_at = timezone.now()
            
            # Activate account ONLY on approval
            if status == 'accepted' and application.classification == 'new':
                application.user.is_active = True
                application.user.save()
            
            application.classification = 'old'
            application.save()
            
            # Log the head's decision
            Reason.objects.create(
                user=user,
                status=status,
                application=application,
                reason=reason,
            )
            
    except Exception as e:
        return JsonResponse({'error': f'Server error: {str(e)}'}, status=500)
    
    return JsonResponse({
        'message': 'Application confirmed successfully',
        'application_id': application.application_id,
        'new_status': status
    }, status=200)

# @csrf_exempt
# def create_maintenance_report(request):
#     if request.method != 'POST':
#         return JsonResponse({'error': 'Only GET Allowed'}, status=401)
    
#     application_id = int(request.POST.get('application_id',0))
#     title = request.POST.get('title')
#     total_member_present = request.POST.get('total_member_present')
#     description = request.POST.get('description')
#     # Dates
#     project_duration = int(request.POST.get('project_duration', 0))
#     #Files 
#     maintenance_report_file = request.FILES.get('maintenance_report_file')
#     group_picture = request.FILES.get('group_picture')
#     #Seedling and Area Metrics
#     total_seedling_planted = int(request.POST.get('total_seedling_planted', 0))
#     total_seedling_survived = int(request.POST.get('total_seedling_survived', 0))
#     total_area_planted = int(request.POST.get('total_area_planted', 0))
#     total_owned_seedling_planted = int(request.POST.get('total_owned_seedling_planted', 0))

#     application = get_object_or_404(Application, application_id=application_id)
    
#     Maintenance_report.objects.create(
#         application=application,
#         status="for_evaluation",
#         title=title,
#         total_member_present=total_member_present,
#         description=description,
#         project_duration=project_duration,
#         maintenance_report_file=maintenance_report_file,
#         total_seedling_survived=total_seedling_survived,
#         total_area_planted=total_area_planted,
#         total_owned_seedling_planted=total_owned_seedling_planted,
#         total_seedling_planted=total_seedling_planted,
        
#     )
#     return JsonResponse({'message': 'Successfully Submitted!'}, status=200)
 
@csrf_exempt
def evaluate_miantenance_report(request, maintenance_report_id):
    if request.method != 'PUT':
        return JsonResponse({'error': "Only PUT Allowed"}, status=401)
    
    user = get_user_from_token(request)
    if not user: 
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    reason = request.POST.get("reason", "")
    status = request.POST.get("status", "")
    
    maintenance_report = get_object_or_404(Maintenance_report, maintenance_report_id=maintenance_report_id)
    maintenance_report.status = status
    
    try:
        with transaction.atomic():
            user = get_object_or_404(User, id=user.user_id)
            maintenance_report.save()
            Reason.objects.create(
                user=user,
                maintenance_report=maintenance_report,
                reason=reason
            )
    except Exception as e:
        return JsonResponse({'error': "Error"})
    
    maintenance_report.save()
    
    return JsonResponse({'message': "Successfully Decided!"})

@csrf_exempt
def confirmation_maintenance(request, maintenance_report_id):

    if request.method != 'PUT':
        return JsonResponse({'error': "Only PUT Allowed"}, status=401)
    
    user = get_user_from_token(request)
    if not user: 
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    reason = request.POST.get("reason", "")
    status = request.POST.get("status", "")
    
    maintenance_report = get_object_or_404(Maintenance_report, maintenance_report_id=maintenance_report_id)
    maintenance_report.status = status
    
    try:
        with transaction.atomic():
            user = get_object_or_404(User, id=user.user_id)
            maintenance_report.save()
            Reason.objects.create(
                user=user,
                maintenance_report=maintenance_report,
                reason=reason
            )
    except Exception as e:
        return JsonResponse({'error': "Error"})
    
    maintenance_report.save()
    
    return JsonResponse({'message': "Successfully Decided!"})

@csrf_exempt
def get_tree_grower_application(request):
    if request.method != 'GET':
        return JsonResponse({"error": 'Only GET Allowed!'}, status=401)
    
    
    user = get_user_from_token(request)
    if not user and user != 'treeGrowers':
        return JsonResponse({'error': 'Unauthorized'}, status=403)
    
    application = get_object_or_404(Application, user=user)
    
    data = {
       
        "application": {
            "application_id": application.application_id,
            "title": application.title,
            "description": application.description,
            "total_request_seedling": application.total_request_seedling,
            "maintenance_plan": application.maintenance_plan.url if application.maintenance_plan else None,
            "agreement_image": application.agreement_image.url if application.agreement_image else None,
            "total_seedling_provided": application.total_seedling_provided,
            "total_area_planted": application.total_area_planted,  # ← Fixed: was using total_seedling_provided
            "total_seedling_survived": application.total_seedling_survived,  # ← Fixed
            "total_seedling_planted": application.total_seedling_planted,  # ← Fixed
            "updated_at": application.updated_at,
            "created_at": application.created_at,
            "status": application.status, 
            "orientation_date": application.orientation_date.isoformat() if application.orientation_date else None,
        },
        "assigned_site": {
            "name": application.site.name,
            "reforestation_area": application.site.reforestation_area.name if application.site.reforestation_area else None,
            "land_classification": application.site.reforestation_area.land_classification.name if application.site.reforestation_area and application.site.reforestation_area.land_classification else None,
            "polygon_coordinates": application.site.polygon_coordinates,
            "barangay": application.site.reforestation_area.barangay.name if application.site.reforestation_area and application.site.reforestation_area.barangay else None,
        }
    }

    return JsonResponse(data, status=200)

@csrf_exempt
def get_tree_grower_maintenance_report(request):
    if request.method != 'GET':
        return JsonResponse({"error": 'Only GET Allowed!'}, status=401)
    
    
    user = get_user_from_token(request)
    if not user and user != 'treeGrowers':
        return JsonResponse({'error': 'Unauthorized'}, status=403)
    
    application = get_object_or_404(Application, user=user)
    
    data = {
       
        "application": {
            "application_id": application.application_id,
            "title": application.title,
            "description": application.description,
            "total_request_seedling": application.total_request_seedling,
            "maintenance_plan": application.maintenance_plan.url if application.maintenance_plan else None,
            "agreement_image": application.agreement_image.url if application.agreement_image else None,
            "total_seedling_provided": application.total_seedling_provided,
            "total_area_planted": application.total_area_planted,  # ← Fixed: was using total_seedling_provided
            "total_seedling_survived": application.total_seedling_survived,  # ← Fixed
            "total_seedling_planted": application.total_seedling_planted,  # ← Fixed
            "updated_at": application.updated_at,
            "created_at": application.created_at,
            "status": application.status, 
            "orientation_date": application.orientation_date.isoformat() if application.orientation_date else None,
        },
        "assigned_site": {
            "name": application.site.name,
            "reforestation_area": application.site.reforestation_area.name if application.site.reforestation_area else None,
            "land_classification": application.site.reforestation_area.land_classification.name if application.site.reforestation_area and application.site.reforestation_area.land_classification else None,
            "polygon_coordinates": application.site.polygon_coordinates,
            "barangay": application.site.reforestation_area.barangay.name if application.site.reforestation_area and application.site.reforestation_area.barangay else None,
        }
    }

    return JsonResponse(data, status=200)

@csrf_exempt
def get_all_maintenance_reports(request):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET Allowed'}, status=405)
 
    user = get_user_from_token(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=403)
 
    status_filter = request.GET.get('status', None)
    reports_qs = Maintenance_report.objects.select_related(
        'application__user__profile',
        'application__user__organization'
    ).order_by('-created_at')
 
    if status_filter:
        reports_qs = reports_qs.filter(status=status_filter)
 
    data = []
    for r in reports_qs:
        app = r.application
        # Try to get org name
        org_name = "—"
        try:
            org_name = app.user.organization.organization_name
        except Exception:
            pass
 
        data.append({
            "maintenance_report_id": r.maintenance_report_id,
            "application_id": app.application_id,
            "application_title": app.title,
            "organization_name": org_name,
            "title": r.title,
            "description": r.description,
            "status": r.status,
            "total_seedling_planted": r.total_seedling_planted,
            "total_seedling_survived": r.total_seedling_survived,
            "total_area_planted": str(r.total_area_planted),
            "total_owned_seedling_planted": r.total_owned_seedling_planted,
            "total_member_present": r.total_member_present,
            "maintenance_report_file": r.maintenance_report_file.url if r.maintenance_report_file else None,
            "group_picture": r.group_picture.url if r.group_picture else None,
            "created_at": r.created_at.isoformat(),
            "submitted_at": r.submitted_at.isoformat() if r.submitted_at else None,
        })
 
    return JsonResponse(data, safe=False, status=200)
 
 
# ─────────────────────────────────────────────────────────────────────────────
# GET TREE GROWER'S OWN MAINTENANCE REPORTS
# GET /api/get_tree_grower_maintenance_reports/<application_id>/
# ─────────────────────────────────────────────────────────────────────────────
@csrf_exempt
def get_tree_grower_maintenance_reports(request, application_id):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET Allowed'}, status=405)
 
    user = get_user_from_token(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=403)
 
    application = get_object_or_404(Application, application_id=application_id, user=user)
    reports_qs = Maintenance_report.objects.filter(
        application=application
    ).order_by('-created_at')
 
    data = []
    for r in reports_qs:
        data.append({
            "maintenance_report_id": r.maintenance_report_id,
            "title": r.title,
            "description": r.description,
            "status": r.status,
            "total_seedling_planted": r.total_seedling_planted,
            "total_seedling_survived": r.total_seedling_survived,
            "total_area_planted": str(r.total_area_planted),
            "total_owned_seedling_planted": r.total_owned_seedling_planted,
            "total_member_present": r.total_member_present,
            "maintenance_report_file": r.maintenance_report_file.url if r.maintenance_report_file else None,
            "group_picture": r.group_picture.url if r.group_picture else None,
            "created_at": r.created_at.isoformat(),
            "submitted_at": r.submitted_at.isoformat() if r.submitted_at else None,
        })
 
    return JsonResponse(data, safe=False, status=200)
 
 
# ─────────────────────────────────────────────────────────────────────────────
# CREATE MAINTENANCE REPORT  (Tree Grower)
# POST /api/create_maintenance_report/
# ─────────────────────────────────────────────────────────────────────────────
@csrf_exempt
def create_maintenance_report(request):
    """
    Existing endpoint — updated to also trigger a notification to admin.
    Replace the existing create_maintenance_report view with this.
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST Allowed'}, status=405)
 
    user = get_user_from_token(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=403)
 
    application_id = int(request.POST.get('application_id', 0))
    title = request.POST.get('title', '').strip()
    total_member_present = request.POST.get('total_member_present', 0)
    description = request.POST.get('description', '').strip()
    maintenance_report_file = request.FILES.get('maintenance_report_file')
    group_picture = request.FILES.get('group_picture')
    total_seedling_planted = int(request.POST.get('total_seedling_planted', 0))
    total_seedling_survived = int(request.POST.get('total_seedling_survived', 0))
    total_area_planted = request.POST.get('total_area_planted', 0)
    total_owned_seedling_planted = int(request.POST.get('total_owned_seedling_planted', 0))
 
    if not title:
        return JsonResponse({'error': 'Title is required.'}, status=400)
    if not description:
        return JsonResponse({'error': 'Description is required.'}, status=400)
 
    application = get_object_or_404(Application, application_id=application_id, user=user)
 
    report = Maintenance_report.objects.create(
        application=application,
        status="for_evaluation",
        title=title,
        total_member_present=total_member_present,
        description=description,
        maintenance_report_file=maintenance_report_file,
        group_picture=group_picture,
        total_seedling_survived=total_seedling_survived,
        total_area_planted=total_area_planted,
        total_owned_seedling_planted=total_owned_seedling_planted,
        total_seedling_planted=total_seedling_planted,
    )
 
    # Optional: Create in-app notification for admins/staff
    # Uncomment if you have a Notification model
    # Notification.objects.create(
    #     message=f"New maintenance report submitted: '{title}' by {application.user.email}",
    #     notification_type="maintenance_report",
    #     reference_id=report.maintenance_report_id,
    # )
 
    return JsonResponse({
        'message': 'Maintenance report submitted successfully!',
        'maintenance_report_id': report.maintenance_report_id,
    }, status=200)
 
 
# ─────────────────────────────────────────────────────────────────────────────
# ALERT TREE GROWER  (Admin / Staff)
# POST /api/alert_tree_grower/
# ─────────────────────────────────────────────────────────────────────────────
@csrf_exempt
def alert_tree_grower(request):
    """
    Admin sends an update request / alert to a specific tree grower.
    The tree grower will see this as a notification in the mobile app.
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST Allowed'}, status=405)
 
    admin_user = get_user_from_token(request)
    if not admin_user:
        return JsonResponse({'error': 'Unauthorized'}, status=403)
 
    application_id = request.POST.get('application_id')
    message = request.POST.get('message', '').strip()
 
    if not application_id:
        return JsonResponse({'error': 'application_id is required.'}, status=400)
    if not message:
        return JsonResponse({'error': 'Message is required.'}, status=400)
 
    application = get_object_or_404(Application, application_id=application_id)
    tree_grower = application.user
 
    try:
        with transaction.atomic():
            # Create notification for the tree grower
            # Adjust to your actual Notification model fields
            Notification.objects.create(
                user=tree_grower,
                title="📋 Update Required",
                message=message,
                notification_type="maintenance_alert",
                reference_id=int(application_id),
                is_read=False,
            )
    except Exception as e:
        return JsonResponse({'error': f'Failed to create notification: {str(e)}'}, status=500)
 
    return JsonResponse({
        'message': f'Alert sent to tree grower successfully.',
        'recipient': tree_grower.email,
    }, status=200)
 
 
# ─────────────────────────────────────────────────────────────────────────────
# GET TREE GROWER NOTIFICATIONS  (Mobile App)
# GET /api/get_notifications/
# ─────────────────────────────────────────────────────────────────────────────
@csrf_exempt
def get_notifications(request):
    """
    Tree grower fetches their notifications (including maintenance alerts).
    """
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET Allowed'}, status=405)
 
    user = get_user_from_token(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=403)
 
    notifs = Notification.objects.filter(user=user).order_by('-created_at')[:50]
 
    data = []
    for n in notifs:
        data.append({
            "notification_id": n.id,  # adjust field name if different
            "title": n.title,
            "message": n.message,
            "notification_type": n.notification_type,
            "reference_id": n.reference_id,
            "is_read": n.is_read,
            "created_at": n.created_at.isoformat(),
        })
 
    return JsonResponse(data, safe=False, status=200)
 
 
# ─────────────────────────────────────────────────────────────────────────────
# MARK NOTIFICATION AS READ  (Mobile App)
# PUT /api/mark_notification_read/<notification_id>/
# ─────────────────────────────────────────────────────────────────────────────
@csrf_exempt
def mark_notification_read(request, notification_id):
    if request.method != 'PUT':
        return JsonResponse({'error': 'Only PUT Allowed'}, status=405)
 
    user = get_user_from_token(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=403)
 
    notif = get_object_or_404(Notification, id=notification_id, user=user)
    notif.is_read = True
    notif.save()
 
    return JsonResponse({'message': 'Notification marked as read.'}, status=200)

    
   




