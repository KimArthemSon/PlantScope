import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import get_object_or_404
from accounts.helper import get_user_from_token
from .models import Assigned_onsite_inspector, Field_assessment, Field_assessment_images
from reforestation_areas.models import Reforestation_areas

def check_inspector_assignment(user, reforestation_area_id):
    if not user or user.user_role != "OnsiteInspector":
        return False
    return Assigned_onsite_inspector.objects.filter(
        user=user,
        reforestation_area_id=reforestation_area_id
    ).exists()

# ─────────────────────────────────────────────
# 1. GET ASSIGNED REFORESTATION AREAS
# ─────────────────────────────────────────────
@csrf_exempt
def get_assigned_reforestation_area(request):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    try:
        user = get_user_from_token(request)
        if not user or user.user_role != "OnsiteInspector":
            return JsonResponse({'error': 'Unauthorized'}, status=403)

        records = Assigned_onsite_inspector.objects.filter(user=user).select_related('reforestation_area', 'reforestation_area__barangay')
        data = [{
            "assigned_onsite_inspector_id": r.assigned_onsite_inspector_id,
            "reforestation_area_id": r.reforestation_area.reforestation_area_id,
            "name": r.reforestation_area.name,
            "barangay": r.reforestation_area.barangay.name if r.reforestation_area.barangay else None,
            "coordinate": r.reforestation_area.coordinate,
            "pre_assessment_status": r.reforestation_area.pre_assessment_status,
            "assigned_at": r.created_at.isoformat()
        } for r in records]
        return JsonResponse(data, safe=False, status=200)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

# ─────────────────────────────────────────────
# 2. GET FIELD ASSESSMENTS (LIST)
# ─────────────────────────────────────────────
@csrf_exempt
def get_field_assessments(request):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    try:
        user = get_user_from_token(request)
        if not user or user.user_role != "OnsiteInspector":
            return JsonResponse({'error': 'Unauthorized'}, status=403)

        q = Field_assessment.objects.filter(assigned_onsite_inspector__user=user).select_related('assigned_onsite_inspector__reforestation_area')
        if aid := request.GET.get('reforestation_area_id'): q = q.filter(assigned_onsite_inspector__reforestation_area_id=aid)
        if layer := request.GET.get('layer'): q = q.filter(layer=layer)
        if request.GET.get('is_submitted') is not None: q = q.filter(is_submitted=(request.GET['is_submitted'].lower() == 'true'))
        q = q.order_by('-updated_at')

        data = [{
            "field_assessment_id": fa.field_assessment_id,
            "reforestation_area_id": fa.assigned_onsite_inspector.reforestation_area_id,
            "reforestation_area_name": fa.assigned_onsite_inspector.reforestation_area.name,
            "layer": fa.layer,
            "layer_display": fa.get_layer_display(),
            "assessment_date": fa.assessment_date.isoformat() if fa.assessment_date else None,
            "location": fa.location,
            "is_submitted": fa.is_submitted,
            "image_count": fa.images.count(),
            "created_at": fa.created_at.isoformat(),
            "updated_at": fa.updated_at.isoformat(),
        } for fa in q]
        return JsonResponse(data, safe=False, status=200)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

# ─────────────────────────────────────────────
# 3. GET FIELD ASSESSMENT DETAIL
# ─────────────────────────────────────────────
@csrf_exempt
def get_field_assessment_detail(request, field_assessment_id):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    try:
        user = get_user_from_token(request)
        if not user or user.user_role != "OnsiteInspector":
            return JsonResponse({'error': 'Unauthorized'}, status=403)

        fa = get_object_or_404(
            Field_assessment.objects.select_related('assigned_onsite_inspector__user', 'assigned_onsite_inspector__reforestation_area'),
            field_assessment_id=field_assessment_id
        )
        if fa.assigned_onsite_inspector.user != user:
            return JsonResponse({'error': 'Forbidden'}, status=403)

        images = [{
            "image_id": img.field_assessment_images_id,
            "layer": img.layer,
            "url": img.img.url if img.img else None,
            "caption": img.caption or "",
            "created_at": img.created_at.isoformat(),
        } for img in fa.images.order_by('created_at')]

        return JsonResponse({
            "field_assessment_id": fa.field_assessment_id,
            "layer": fa.layer,
            "assessment_date": fa.assessment_date.isoformat() if fa.assessment_date else None,
            "location": fa.location,
            "field_assessment_data": fa.field_assessment_data,
            "is_submitted": fa.is_submitted,
            "images": images,
            "created_at": fa.created_at.isoformat(),
            "updated_at": fa.updated_at.isoformat(),
        }, status=200)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

# ─────────────────────────────────────────────
# 4. CREATE FIELD ASSESSMENT (DRAFT)
# ─────────────────────────────────────────────
@csrf_exempt
def create_field_assessment(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)
    try:
        user = get_user_from_token(request)
        if not user or user.user_role != "OnsiteInspector":
            return JsonResponse({'error': 'Unauthorized'}, status=403)

        body = json.loads(request.body)
        reforestation_area_id = body.get('reforestation_area_id')
        layer = body.get('layer', 'pre_assessment')
        assessment_date = body.get('assessment_date')
        location = body.get('location')
        field_data = body.get('field_assessment_data', {})

        if not reforestation_area_id or not assessment_date:
            return JsonResponse({'error': 'reforestation_area_id and assessment_date are required'}, status=400)
        if layer not in dict(Field_assessment.LAYER_CHOICES):
            return JsonResponse({'error': f'Invalid layer. Allowed: {list(dict(Field_assessment.LAYER_CHOICES).keys())}'}, status=400)
        if not check_inspector_assignment(user, reforestation_area_id):
            return JsonResponse({'error': 'You are not assigned to this area'}, status=403)

        assignment = Assigned_onsite_inspector.objects.get(user=user, reforestation_area_id=reforestation_area_id)
        fa = Field_assessment.objects.create(
            assigned_onsite_inspector=assignment,
            layer=layer,
            assessment_date=assessment_date,
            location=location,
            field_assessment_data=field_data,
            is_submitted=False
        )
        return JsonResponse({'message': 'Draft created', 'field_assessment_id': fa.field_assessment_id, 'layer': fa.layer}, status=201)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

# ─────────────────────────────────────────────
# 5. UPDATE FIELD ASSESSMENT (DRAFT ONLY)
# ─────────────────────────────────────────────
@csrf_exempt
def update_field_assessment(request, field_assessment_id):
    if request.method not in ['POST', 'PUT']:
        return JsonResponse({'error': 'Only POST/PUT allowed'}, status=405)
    try:
        user = get_user_from_token(request)
        if not user or user.user_role != "OnsiteInspector":
            return JsonResponse({'error': 'Unauthorized'}, status=403)

        fa = get_object_or_404(Field_assessment, field_assessment_id=field_assessment_id)
        if fa.assigned_onsite_inspector.user != user:
            return JsonResponse({'error': 'Forbidden'}, status=403)
        if fa.is_submitted:
            return JsonResponse({'error': 'Cannot edit a submitted assessment'}, status=400)

        body = json.loads(request.body)
        if 'assessment_date' in body: fa.assessment_date = body['assessment_date']
        if 'location' in body: fa.location = body['location']
        if 'field_assessment_data' in body: fa.field_assessment_data = body['field_assessment_data']
        fa.save()

        return JsonResponse({'message': 'Draft updated', 'updated_at': fa.updated_at.isoformat()}, status=200)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

# ─────────────────────────────────────────────
# 6. SUBMIT FIELD ASSESSMENT
# ─────────────────────────────────────────────
@csrf_exempt
def submit_field_assessment(request, field_assessment_id):
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)
    try:
        user = get_user_from_token(request)
        if not user or user.user_role != "OnsiteInspector":
            return JsonResponse({'error': 'Unauthorized'}, status=403)

        fa = get_object_or_404(Field_assessment, field_assessment_id=field_assessment_id)
        if fa.assigned_onsite_inspector.user != user:
            return JsonResponse({'error': 'Forbidden'}, status=403)
        if fa.is_submitted:
            return JsonResponse({'error': 'Already submitted'}, status=400)
        if not fa.field_assessment_data:
            return JsonResponse({'error': 'Cannot submit empty assessment'}, status=400)

        fa.is_submitted = True
        fa.save()
        return JsonResponse({'message': f'{fa.get_layer_display()} submitted', 'submitted_at': fa.updated_at.isoformat()}, status=200)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

# ─────────────────────────────────────────────
# 7. DELETE FIELD ASSESSMENT (DRAFT ONLY)
# ─────────────────────────────────────────────
@csrf_exempt
def delete_field_assessment(request, field_assessment_id):
    if request.method != 'DELETE':
        return JsonResponse({'error': 'Only DELETE allowed'}, status=405)
    try:
        user = get_user_from_token(request)
        if not user or user.user_role != "OnsiteInspector":
            return JsonResponse({'error': 'Unauthorized'}, status=403)

        fa = get_object_or_404(Field_assessment, field_assessment_id=field_assessment_id)
        if fa.assigned_onsite_inspector.user != user:
            return JsonResponse({'error': 'Forbidden'}, status=403)
        if fa.is_submitted:
            return JsonResponse({'error': 'Cannot delete submitted'}, status=400)

        fa.delete()
        return JsonResponse({'message': 'Deleted successfully'}, status=200)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

# ─────────────────────────────────────────────
# 8. UPLOAD IMAGE
# ─────────────────────────────────────────────
@csrf_exempt
def upload_field_assessment_image(request, field_assessment_id):
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)
    try:
        user = get_user_from_token(request)
        if not user or user.user_role != "OnsiteInspector":
            return JsonResponse({'error': 'Unauthorized'}, status=403)

        fa = get_object_or_404(Field_assessment, field_assessment_id=field_assessment_id)
        if fa.assigned_onsite_inspector.user != user:
            return JsonResponse({'error': 'Forbidden'}, status=403)
        if fa.is_submitted:
            return JsonResponse({'error': 'Cannot add to submitted'}, status=400)
        if 'image' not in request.FILES:
            return JsonResponse({'error': 'No image provided'}, status=400)

        img = Field_assessment_images.objects.create(
            field_assessment=fa,
            layer=request.POST.get('layer', fa.layer),
            img=request.FILES['image'],
            caption=request.POST.get('caption', '')
        )
        return JsonResponse({'message': 'Uploaded', 'image_id': img.field_assessment_images_id, 'url': img.img.url if img.img else None}, status=201)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

# ─────────────────────────────────────────────
# 9. DELETE IMAGE
# ─────────────────────────────────────────────
@csrf_exempt
def delete_field_assessment_image(request, image_id):
    if request.method != 'DELETE':
        return JsonResponse({'error': 'Only DELETE allowed'}, status=405)
    try:
        user = get_user_from_token(request)
        if not user or user.user_role != "OnsiteInspector":
            return JsonResponse({'error': 'Unauthorized'}, status=403)

        img = get_object_or_404(
            Field_assessment_images.objects.select_related('field_assessment__assigned_onsite_inspector__user'),
            field_assessment_images_id=image_id
        )
        if img.field_assessment.assigned_onsite_inspector.user != user:
            return JsonResponse({'error': 'Forbidden'}, status=403)
        if img.field_assessment.is_submitted:
            return JsonResponse({'error': 'Cannot delete from submitted'}, status=400)

        if img.img:
            try: img.img.delete(save=False)
            except: pass
        img.delete()
        return JsonResponse({'message': 'Image deleted'}, status=200)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
def get_area_meta_data(request, reforestation_area_id):
    """
    GET: For GIS Specialists only.
    Fetches ALL submitted pre-assessments for a specific Reforestation Area,
    regardless of which onsite inspector submitted them.
    Includes full image data from Field_assessment_images.
    """
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    
    try:
        user = get_user_from_token(request)
        
        # ✅ Role check
        allowed_roles = ["DataManager", "CityENROHead"]
        if not user or user.user_role not in allowed_roles:
            return JsonResponse({'error': 'Unauthorized'}, status=403)

        # ✅ Optimized query: prefetch images to avoid N+1
        assessments = Field_assessment.objects.filter(
            assigned_onsite_inspector__reforestation_area_id=reforestation_area_id,
            layer='meta_data',
            is_submitted=True
        ).select_related(
            'assigned_onsite_inspector__user',
            'assigned_onsite_inspector__user__profile'
        ).prefetch_related(
            'images'  # ✅ Prefetch all related images in ONE query
        ).order_by('-created_at')

        data = []
        for fa in assessments:
            inspector_user = fa.assigned_onsite_inspector.user if fa.assigned_onsite_inspector else None
            profile = getattr(inspector_user, 'profile', None) if inspector_user else None
            
            # Build full name & profile img safely
            if profile:
                full_name = f"{profile.first_name} {profile.middle_name + ' ' if profile.middle_name else ''}{profile.last_name}".strip()
                profile_img_url = profile.profile_img.url if profile.profile_img else None
            else:
                full_name = inspector_user.email if inspector_user else "Unknown Inspector"
                profile_img_url = None

            # ✅ BUILD IMAGES ARRAY from prefetched data
            images_data = [
                {
                    "image_id": img.field_assessment_images_id,
                    "url": img.img.url if img.img else None,
                    "caption": img.caption or "",
                    "layer": img.layer,
                    "created_at": img.created_at.isoformat(),
                }
                for img in fa.images.all()  # ✅ No extra query - already prefetched
            ]

            data.append({
                "field_assessment_id": fa.field_assessment_id,
                "inspector_id": inspector_user.id if inspector_user else None,
                "inspector_name": full_name,
                "inspector_email": inspector_user.email if inspector_user else None,
                "inspector_profile_img": profile_img_url,
                "assessment_date": fa.assessment_date.isoformat() if fa.assessment_date else None,
                "location": fa.location,
                "field_assessment_data": fa.field_assessment_data,
                "is_submitted": fa.is_submitted,
                "image_count": len(images_data),  # ✅ Accurate count from actual list
                "images": images_data,            # ✅ SEND ACTUAL IMAGE DATA
                "created_at": fa.created_at.isoformat(),
                "submitted_at": fa.updated_at.isoformat(),
            })

        return JsonResponse(data, safe=False, status=200)
        
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"❌ Error in get_area_pre_assessments_for_gis: {e}", exc_info=True)
        return JsonResponse({'error': f'Server error: {str(e)}'}, status=500)

