import json
import logging
from django.db import transaction
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.db.models import Count, Q, Sum, F

from accounts.helper import get_user_from_token, create_notification
from accounts.models import User
from tree_species.models import Tree_species

# Adjust these imports based on your actual app structure
from .models import Application, SeedlingRequest, SeedlingRequestSpecies

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# HELPER FUNCTIONS
# ─────────────────────────────────────────────────────────────────────────────

def serialize_seedling_request(req):
    """Serialize a seedling request with all necessary details for mobile/web"""
    inspector_data = None
    if req.assigned_inspector:
        inspector_profile = getattr(req.assigned_inspector, 'profile', None)
        inspector_data = {
            "inspector_id": req.assigned_inspector.id,
            "name": f"{inspector_profile.first_name} {inspector_profile.last_name}".strip() if inspector_profile else req.assigned_inspector.email,
            "contact": inspector_profile.contact if inspector_profile else "",
            "email": req.assigned_inspector.email,
        }

    return {
        "request_id": req.seedling_request_id,
        "application_id": req.application.application_id,
        "application_title": req.application.title,
        "status": req.status,
        "fulfillment_type": req.fulfillment_type,
        "no_request_seedling": req.no_request_seedling,
        "description": req.description,
        "reason": req.reason,
        "reason_accepted": req.reason_accepted,
        "proof_of_delivery": req.proof_of_delivery.url if req.proof_of_delivery else None,
        "submitted_at": req.submitted_at.isoformat() if req.submitted_at else None,
        "assigned_inspector": inspector_data,
        "created_by_admin": req.created_by_id is not None,
        "species": [{
            "species_id": s.tree_species.tree_specie_id,
            "species_name": s.tree_species.name,
            "quantity": s.quantity,
            "provided_by": s.provided_by,
        } for s in req.seedling_species.select_related('tree_species').all()]
    }


# ─────────────────────────────────────────────────────────────────────────────
# TREE GROWER ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

@csrf_exempt
def get_my_seedling_requests(request):
    """TreeGrower: Get list of their seedling requests"""
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    user = get_user_from_token(request)
    if not user or user.user_role != 'treeGrowers':
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    qs = SeedlingRequest.objects.filter(
        application__user=user
    ).select_related('application', 'assigned_inspector').prefetch_related(
        'seedling_species__tree_species'
    ).order_by('-created_at')

    status_filter = request.GET.get('status')
    if status_filter:
        qs = qs.filter(status=status_filter)

    data = [serialize_seedling_request(req) for req in qs]
    return JsonResponse(data, safe=False, status=200)


@csrf_exempt
def get_seedling_request_detail(request, request_id):
    """TreeGrower / Inspector: Get detailed view of a specific request"""
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    user = get_user_from_token(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    qs = SeedlingRequest.objects.select_related(
        'application__user__tree_grower_group',
        'application__user__profile',
        'application__site__reforestation_area__barangay',
        'assigned_inspector'
    ).prefetch_related('seedling_species__tree_species')

    if user.user_role == 'treeGrowers':
        req = get_object_or_404(qs, seedling_request_id=request_id, application__user=user)
    elif user.user_role == 'OnsiteInspector':
        req = get_object_or_404(qs, seedling_request_id=request_id, assigned_inspector=user)
    else:
        req = get_object_or_404(qs, seedling_request_id=request_id)

    grower_group = getattr(req.application.user, 'tree_grower_group', None)
    grower_profile = getattr(req.application.user, 'profile', None)
    
    detail_data = serialize_seedling_request(req)
    detail_data["grower_info"] = {
        "group_name": grower_group.group_name if grower_group else "N/A",
        "group_contact": grower_group.contact if grower_group else "",
        "representative_name": f"{grower_profile.first_name} {grower_profile.last_name}".strip() if grower_profile else "N/A",
        "representative_contact": grower_profile.contact if grower_profile else "",
    }
    detail_data["site_info"] = {
        "site_name": req.application.site.name if req.application.site else "No site assigned",
        "barangay": (req.application.site.reforestation_area.barangay.name 
                     if req.application.site and req.application.site.reforestation_area and req.application.site.reforestation_area.barangay 
                     else "N/A")
    }

    return JsonResponse(detail_data, status=200)


@csrf_exempt
def cancel_seedling_request(request, request_id):
    """TreeGrower: Cancel a pending seedling request"""
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)

    user = get_user_from_token(request)
    if not user or user.user_role != 'treeGrowers':
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    reason_text = data.get('reason', '').strip()
    if len(reason_text) < 5:
        return JsonResponse({'error': 'Please provide a valid reason for cancellation (min 5 characters).'}, status=400)

    req = get_object_or_404(SeedlingRequest, seedling_request_id=request_id, application__user=user)
    if req.status != 'pending':
        return JsonResponse({'error': 'Only pending requests can be cancelled.'}, status=400)

    try:
        with transaction.atomic():
            req.status = 'cancelled'
            req.reason = reason_text
            req.save()

        create_notification(
            user=user,
            type='info',
            title='📋 Request Cancelled',
            description=f'Your seedling request for "{req.application.title}" has been cancelled.',
            link=f'/tree_growers/SeedlingRequestDetail?id={req.seedling_request_id}'
        )

        return JsonResponse({'message': 'Request cancelled successfully'}, status=200)
    except Exception as e:
        logger.error(f"Cancel request error: {str(e)}")
        return JsonResponse({'error': 'Server error'}, status=500)


# ─────────────────────────────────────────────────────────────────────────────
# DATA MANAGER ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

@csrf_exempt
def get_manager_seedling_requests(request):
    """DataManager: Get list of all seedling requests with filters"""
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    user = get_user_from_token(request)
    if not user or user.user_role not in ['DataManager', 'CityENROHead']:
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    status_filter = request.GET.get('status', 'all')
    search = request.GET.get('search', '').strip()

    qs = SeedlingRequest.objects.select_related(
        'application__user__tree_grower_group',
        'application__site',
        'assigned_inspector__profile'
    ).prefetch_related('seedling_species__tree_species').order_by('-created_at')

    if status_filter != 'all':
        qs = qs.filter(status=status_filter)
    
    if search:
        qs = qs.filter(
            Q(application__user__tree_grower_group__group_name__icontains=search) |
            Q(application__title__icontains=search)
        )

    data = []
    for req in qs:
        group = getattr(req.application.user, 'tree_grower_group', None)
        inspector = req.assigned_inspector
        inspector_profile = getattr(inspector, 'profile', None) if inspector else None

        data.append({
            "request_id": req.seedling_request_id,
            "application_title": req.application.title,
            "group_name": group.group_name if group else "N/A",
            "group_contact": group.contact if group else "",
            "site_name": req.application.site.name if req.application.site else "N/A",
            "no_request_seedling": req.no_request_seedling,
            "status": req.status,
            "fulfillment_type": req.fulfillment_type,
            "inspector_name": f"{inspector_profile.first_name} {inspector_profile.last_name}".strip() if inspector_profile else "Unassigned",
            "submitted_at": req.submitted_at.isoformat() if req.submitted_at else None,
            "created_by_admin": req.created_by_id is not None,
            # ✅ ADDED: Species breakdown for the rich frontend table
            "species": [{
                "species_id": s.tree_species.tree_specie_id,
                "species_name": s.tree_species.name,
                "quantity": s.quantity,
                "provided_by": s.provided_by,
            } for s in req.seedling_species.all()],
        })

    return JsonResponse(data, safe=False, status=200)


SEEDLING_ELIGIBLE_STATUSES = ['accepted', 'under_monitoring']


@csrf_exempt
def get_request_eligible_growers(request):
    """DataManager: Tree growers with an active application that can receive seedlings"""
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    user = get_user_from_token(request)
    if not user or user.user_role not in ['DataManager', 'CityENROHead']:
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    apps = Application.objects.filter(
        status__in=SEEDLING_ELIGIBLE_STATUSES,
        user__is_active=True,
    ).select_related(
        'user__tree_grower_group',
        'site__reforestation_area__barangay',
    ).order_by('user__tree_grower_group__group_name', '-created_at')

    data = []
    for app in apps:
        group = getattr(app.user, 'tree_grower_group', None)
        site = app.site
        area = site.reforestation_area if site else None
        data.append({
            "user_id": app.user.id,
            "email": app.user.email,
            "group_name": group.group_name if group else app.user.email,
            "application_id": app.application_id,
            "application_title": app.title,
            "application_status": app.get_status_display(),
            "site_name": site.name if site else None,
            "barangay": area.barangay.name if area and area.barangay else None,
            "pending_requests": app.seedling_requests.filter(status='pending').count(),
        })

    return JsonResponse(data, safe=False, status=200)


@csrf_exempt
def admin_create_seedling_request(request):
    """
    DataManager: Create a seedling request on behalf of a tree grower.
    Since the admin is the one providing, the request is created already
    ACCEPTED with fulfillment + inspector assigned (no separate approval step).
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)

    user = get_user_from_token(request)
    if not user or user.user_role != 'DataManager':
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    application_id = data.get('application_id')
    species_items = data.get('species') or []
    description = (data.get('description') or '').strip()
    inspector_id = data.get('inspector_id')
    fulfillment_type = data.get('fulfillment_type')

    if not application_id:
        return JsonResponse({'error': 'application_id is required'}, status=400)
    if fulfillment_type not in dict(SeedlingRequest.FULFILLMENT_CHOICES):
        return JsonResponse({'error': 'fulfillment_type must be "pickup" or "deliver"'}, status=400)
    if not inspector_id:
        return JsonResponse({'error': 'inspector_id is required'}, status=400)
    inspector = User.objects.filter(id=inspector_id, user_role='OnsiteInspector', is_active=True).first()
    if not inspector:
        return JsonResponse({'error': 'Selected inspector was not found or is inactive'}, status=400)
    if not isinstance(species_items, list) or not species_items:
        return JsonResponse({'error': 'Add at least one seedling species'}, status=400)

    app = get_object_or_404(
        Application.objects.select_related('user'),
        application_id=application_id,
    )
    if app.status not in SEEDLING_ELIGIBLE_STATUSES:
        return JsonResponse({'error': 'Application is not active (must be accepted or under monitoring).'}, status=400)

    # Validate species rows
    cleaned = {}
    for item in species_items:
        try:
            species_id = int(item.get('tree_species_id'))
            quantity = int(item.get('quantity', 0))
        except (TypeError, ValueError):
            return JsonResponse({'error': 'Invalid species or quantity'}, status=400)
        if quantity <= 0:
            return JsonResponse({'error': 'Quantity must be greater than 0'}, status=400)
        if species_id in cleaned:
            return JsonResponse({'error': 'Each species can only be added once'}, status=400)
        cleaned[species_id] = {
            'species': get_object_or_404(Tree_species, tree_specie_id=species_id),
            'quantity': quantity,
            'provided_by': (item.get('provided_by') or 'ENRO Nursery').strip() or 'ENRO Nursery',
        }

    try:
        with transaction.atomic():
            req = SeedlingRequest.objects.create(
                application=app,
                reason_accepted=description or None,
                status='accepted',
                fulfillment_type=fulfillment_type,
                assigned_inspector=inspector,
                created_by=user,
                no_request_seedling=sum(c['quantity'] for c in cleaned.values()),
            )
            for c in cleaned.values():
                SeedlingRequestSpecies.objects.create(
                    seedling_request=req,
                    tree_species=c['species'],
                    quantity=c['quantity'],
                    provided_by=c['provided_by'],
                )

        create_notification(
            user=app.user,
            type='success',
            title='🌱 Seedlings Prepared For You',
            description=(
                f'ENRO has prepared {req.no_request_seedling} seedlings for "{app.title}". '
                f'Fulfillment: {req.get_fulfillment_type_display()}. Tap to view details.'
            ),
            link=f'/tree_growers/SeedlingRequestDetail?id={req.seedling_request_id}'
        )

        create_notification(
            user=inspector,
            type='info',
            title='📋 New Inspection Task',
            description=f'You have been assigned to verify seedling delivery for "{app.title}".',
            link='/inspector/tasks'
        )

        return JsonResponse({
            'message': 'Seedling request created successfully',
            'request_id': req.seedling_request_id,
        }, status=201)
    except Exception as e:
        logger.error(f"Admin create request error: {str(e)}")
        return JsonResponse({'error': 'Server error'}, status=500)


@csrf_exempt
def alert_tree_grower(request):
    """DataManager: Send an alert notification to the tree grower of an application"""
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)

    try:
        user = get_user_from_token(request)
    except Exception:
        return JsonResponse({'error': 'Unauthorized'}, status=401)
    if user.user_role != 'DataManager':
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    # Accept both multipart/form-data and JSON bodies
    if request.content_type and request.content_type.startswith('application/json'):
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON'}, status=400)
    else:
        data = request.POST

    application_id = data.get('application_id')
    message = (data.get('message') or '').strip()

    if not application_id:
        return JsonResponse({'error': 'application_id is required'}, status=400)
    if not message:
        return JsonResponse({'error': 'Message is required'}, status=400)

    app = get_object_or_404(
        Application.objects.select_related('user'),
        application_id=application_id,
    )
    if not app.user:
        return JsonResponse({'error': 'This application has no tree grower account linked'}, status=400)

    notification = create_notification(
        user=app.user,
        type='alert',
        title=f'⚠️ Alert from ENRO: {app.title}',
        description=message,
        link='/tree_growers/application'
    )
    if not notification:
        return JsonResponse({'error': 'Failed to send alert'}, status=500)

    return JsonResponse({'message': 'Alert sent to tree grower'}, status=201)


@csrf_exempt
def approve_seedling_request(request, request_id):
    """DataManager: Approve request, assign inspector, set fulfillment, and optionally adjust provision"""
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)

    user = get_user_from_token(request)
    if not user or user.user_role != 'DataManager':
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    inspector_id = data.get('inspector_id')
    fulfillment_type = data.get('fulfillment_type')
    notes = data.get('notes', '').strip()
    seedling_provision = data.get('seedling_provision')

    if not inspector_id or not fulfillment_type:
        return JsonResponse({'error': 'inspector_id and fulfillment_type are required'}, status=400)

    req = get_object_or_404(SeedlingRequest, seedling_request_id=request_id)
    if req.status != 'pending':
        return JsonResponse({'error': 'Request is not pending'}, status=400)

    inspector = get_object_or_404(User, id=inspector_id, user_role='OnsiteInspector')

    try:
        with transaction.atomic():
            req.status = 'accepted'
            req.assigned_inspector = inspector
            req.fulfillment_type = fulfillment_type
            if notes:
                req.reason_accepted = notes
            
            # ✅ Allow DataManager to adjust the approved quantities if needed
            if seedling_provision and isinstance(seedling_provision, list):
                req.seedling_species.all().delete()
                total_seedlings = 0
                for item in seedling_provision:
                    tree_species = get_object_or_404(Tree_species, tree_specie_id=item.get('tree_species_id'))
                    SeedlingRequestSpecies.objects.create(
                        seedling_request=req,
                        tree_species=tree_species,
                        quantity=int(item.get('quantity', 0)),
                        provided_by=item.get('provided_by', 'ENRO Nursery')
                    )
                    total_seedlings += int(item.get('quantity', 0))
                req.no_request_seedling = total_seedlings

            req.save()

        create_notification(
            user=req.application.user,
            type='success',
            title='🌱 Seedling Request Approved',
            description=f'Your request for {req.no_request_seedling} seedlings has been approved. Fulfillment: {req.get_fulfillment_type_display()}.',
            link=f'/tree_growers/SeedlingRequestDetail?id={req.seedling_request_id}'
        )

        create_notification(
            user=inspector,
            type='info',
            title='📋 New Inspection Task',
            description=f'You have been assigned to verify seedling delivery for "{req.application.title}".',
            link='/inspector/tasks'
        )

        return JsonResponse({'message': 'Request approved and assigned successfully'}, status=200)
    except Exception as e:
        logger.error(f"Approve request error: {str(e)}")
        return JsonResponse({'error': 'Server error'}, status=500)


@csrf_exempt
def reject_seedling_request(request, request_id):
    """DataManager: Reject a seedling request"""
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)

    user = get_user_from_token(request)
    if not user or user.user_role != 'DataManager':
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    reason_text = data.get('reason', '').strip()
    if not reason_text:
        return JsonResponse({'error': 'Reason is required for rejection'}, status=400)

    req = get_object_or_404(SeedlingRequest, seedling_request_id=request_id)
    if req.status != 'pending':
        return JsonResponse({'error': 'Request is not pending'}, status=400)

    try:
        with transaction.atomic():
            req.status = 'rejected'
            req.reason = reason_text
            req.save()

        create_notification(
            user=req.application.user,
            type='alert',
            title='❌ Seedling Request Rejected',
            description=f'Your seedling request was rejected. Reason: {reason_text}',
            link=f'/tree_growers/SeedlingRequestDetail?id={req.seedling_request_id}'
        )

        return JsonResponse({'message': 'Request rejected successfully'}, status=200)
    except Exception as e:
        logger.error(f"Reject request error: {str(e)}")
        return JsonResponse({'error': 'Server error'}, status=500)


# ─────────────────────────────────────────────────────────────────────────────
# ONSITE INSPECTOR ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

@csrf_exempt
def get_inspector_seedling_tasks(request):
    """OnsiteInspector: Get list of requests assigned to them (supports status filtering)"""
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    user = get_user_from_token(request)
    if not user or user.user_role != 'OnsiteInspector':
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    # ✅ Get status filter from query params (default: 'accepted' for backwards compatibility)
    status_filter = request.GET.get('status', 'accepted')
    
    # Build base queryset
    qs = SeedlingRequest.objects.filter(
        assigned_inspector=user
    ).select_related(
        'application__user__tree_grower_group',
        'application__site__reforestation_area__barangay'
    ).prefetch_related('seedling_species__tree_species').order_by('-created_at')

    # ✅ Apply status filter dynamically
    if status_filter and status_filter != 'all':
        qs = qs.filter(status=status_filter)

    data = []
    for req in qs:
        group = getattr(req.application.user, 'tree_grower_group', None)
        data.append({
            "request_id": req.seedling_request_id,
            "application_title": req.application.title,
            "group_name": group.group_name if group else "N/A",
            "group_contact": group.contact if group else "",
            "site_name": req.application.site.name if req.application.site else "N/A",
            "fulfillment_type": req.fulfillment_type,
            "no_request_seedling": req.no_request_seedling,
            "submitted_at": req.submitted_at.isoformat() if req.submitted_at else None,
            # ✅ ADDED: Status field so frontend can filter/display correctly
            "status": req.status,
            # ✅ ADDED: Species breakdown so inspector knows what to verify
            "species": [{
                "species_id": s.tree_species.tree_specie_id,
                "species_name": s.tree_species.name,
                "quantity": s.quantity,
            } for s in req.seedling_species.all()],
        })

    return JsonResponse(data, safe=False, status=200)


@csrf_exempt
def confirm_seedling_delivery(request, request_id):
    """OnsiteInspector: Confirm receipt of seedlings with proof of delivery"""
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)

    user = get_user_from_token(request)
    if not user or user.user_role != 'OnsiteInspector':
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    req = get_object_or_404(SeedlingRequest, seedling_request_id=request_id, assigned_inspector=user)
    if req.status != 'accepted':
        return JsonResponse({'error': 'Request is not in accepted state'}, status=400)

    notes = request.POST.get('notes', '').strip()
    proof_image = request.FILES.get('proof_of_delivery')

    if not proof_image:
        return JsonResponse({'error': 'Proof of delivery image is required'}, status=400)

    try:
        with transaction.atomic():
            req.status = 'confirmed'
            req.proof_of_delivery = proof_image
            if notes:
                req.reason_accepted = f"{req.reason_accepted or ''} | Inspector Notes: {notes}".strip()
            req.save()

        create_notification(
            user=req.application.user,
            type='success',
            title='✅ Seedlings Confirmed',
            description=f'Onsite Inspector has confirmed the receipt of your seedlings for "{req.application.title}".',
            link=f'/tree_growers/SeedlingRequestDetail?id={req.seedling_request_id}'
        )

        return JsonResponse({'message': 'Delivery confirmed successfully'}, status=200)
    except Exception as e:
        logger.error(f"Confirm delivery error: {str(e)}")
        return JsonResponse({'error': 'Server error'}, status=500)
    

@csrf_exempt
def inspector_cancel_seedling_delivery(request, request_id):
    """OnsiteInspector: Cancel an assigned delivery that is still awaiting handover"""
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)

    user = get_user_from_token(request)
    if not user or user.user_role != 'OnsiteInspector':
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    reason_text = (data.get('reason') or '').strip()
    if len(reason_text) < 5:
        return JsonResponse({'error': 'Please provide a valid reason (min 5 characters).'}, status=400)

    req = get_object_or_404(SeedlingRequest, seedling_request_id=request_id, assigned_inspector=user)
    if req.status != 'accepted':
        return JsonResponse({'error': 'Only deliveries awaiting handover can be cancelled.'}, status=400)

    try:
        with transaction.atomic():
            req.status = 'cancelled'
            req.reason = reason_text
            req.save()

        create_notification(
            user=req.application.user,
            type='alert',
            title='❌ Seedling Delivery Cancelled',
            description=f'The seedling delivery for "{req.application.title}" was cancelled by the inspector. Reason: {reason_text}',
            link=f'/tree_growers/SeedlingRequestDetail?id={req.seedling_request_id}'
        )

        return JsonResponse({'message': 'Delivery cancelled successfully'}, status=200)
    except Exception as e:
        logger.error(f"Inspector cancel error: {str(e)}")
        return JsonResponse({'error': 'Server error'}, status=500)


@csrf_exempt
def get_available_inspectors(request):
    """Get a list of active Onsite Inspectors for assignment dropdown"""
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    user = get_user_from_token(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    # ✅ Ongoing workload = seedling requests assigned but not yet confirmed
    inspectors = User.objects.filter(
        user_role='OnsiteInspector',
        is_active=True
    ).select_related('profile').annotate(
        ongoing_count=Count(
            'assigned_seedling_requests',
            filter=Q(assigned_seedling_requests__status='accepted'),
        )
    ).values(
        'id',
        'email',
        'ongoing_count',
        first_name=F('profile__first_name'),
        last_name=F('profile__last_name')
    ).order_by('ongoing_count', 'profile__first_name')

    data = [{
        "id": insp['id'],
        "name": f"{insp['first_name'] or ''} {insp['last_name'] or ''}".strip() or insp['email'],
        "email": insp['email'],
        "ongoing_count": insp['ongoing_count'],
    } for insp in inspectors]

    return JsonResponse(data, safe=False, status=200)