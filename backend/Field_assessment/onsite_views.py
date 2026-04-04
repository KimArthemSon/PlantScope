import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import get_object_or_404
from django.utils import timezone
from accounts.helper import get_user_from_token
from .models import Assigned_onsite_inspector, Field_assessment, Field_assessment_details, field_assessment_images
from barangay.models import Barangay
from sites.models import Sites
from soils.models import Soils
from tree_species.models import Tree_species
from reforestation_areas.models import Reforestation_areas

# ---------------- Helper: Check Inspector Assignment ----------------
def check_inspector_assignment(user, reforestation_area_id=None, site_id=None):
    """
    Ensures the user is an onsite inspector and is assigned to the specific area/site.
    """
    if not user or user.user_role != "OnsiteInspector":
        return False
    
    query = Assigned_onsite_inspector.objects.filter(user=user)
    
    if reforestation_area_id:
        query = query.filter(reforestation_area_id=reforestation_area_id)
        
    # If checking by site, we need to link site -> reforestation_area first
    if site_id:
        try:
            site = Sites.objects.get(site_id=site_id)
            if site.reforestation_area_id:
                query = query.filter(reforestation_area_id=site.reforestation_area_id)
            else:
                return False # Site not linked to an area yet
        except Sites.DoesNotExist:
            return False
            
    return query.exists()

# ---------------- 1. Get Assigned Reforestation Areas ----------------
@csrf_exempt
def get_assigned_reforestation_area(request):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    try:
        user = get_user_from_token(request)
        print(user.user_role)
        if not user or user.user_role != "OnsiteInspector":
            return JsonResponse({'error': 'Unauthorized'}, status=403)

        assigned_records = Assigned_onsite_inspector.objects.filter(user=user).select_related('reforestation_area', 'reforestation_area__barangay')
        
        data = [
            {
                "id": record.reforestation_area.reforestation_area_id,
                "name": record.reforestation_area.name,
                "barangay": record.reforestation_area.barangay.name if record.reforestation_area.barangay else None,
                # Adjust 'safety_status' based on your actual Reforestation_areas model field name
                "safety_status": getattr(record.reforestation_area, 'safety_status', 'Unknown'), 
                "legality": record.reforestation_area.legality,
                "coordinate": record.reforestation_area.coordinate,
                "created_at": record.created_at.isoformat()
            }
            for record in assigned_records
        ]
        return JsonResponse(data, safe=False)

    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

# ---------------- 2. Get Field Assessments (Filtered) ----------------
@csrf_exempt
def get_field_assessments(request, multicriteria_type=None):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    try:
        user = get_user_from_token(request)
        if not user or user.user_role != "OnsiteInspector":
            return JsonResponse({'error': 'Unauthorized'}, status=403)
        
        # Filters
        site_id = request.GET.get('site_id')
        reforestation_area_id = request.GET.get('reforestation_area_id')
        is_sent = request.GET.get('is_sent')
        
        # Base query: Only assessments belonging to this user
        query = Field_assessment.objects.filter(assigned_onsite_inspector__user=user)
        
        if multicriteria_type:
            query = query.filter(multicriteria_type=multicriteria_type)
        
        if site_id:
            query = query.filter(site_id=site_id)
            
        # Filter by Reforestation Area
        if reforestation_area_id:
            query = query.filter(assigned_onsite_inspector__reforestation_area_id=reforestation_area_id)
            
        if is_sent is not None:
            query = query.filter(is_sent=(is_sent.lower() == 'true'))
        
        # ✅ ORDER BY updated_at DESC (most recent first)
        query = query.order_by('-updated_at')
        
        # Serialize
        data = []
        for fa in query.select_related('site', 'assigned_onsite_inspector__reforestation_area'):
            item = {
                "field_assessment_id": fa.field_assessment_id,
                "site_id": fa.site_id,
                "site_name": fa.site.name if fa.site else "New Site Proposal",
                "reforestation_area_id": fa.assigned_onsite_inspector.reforestation_area_id,
                "type": fa.multicriteria_type,
                "title": fa.title,
                "description": fa.description,
                "data": fa.field_assessment_data,
                "is_sent": fa.is_sent,
                "created_at": fa.created_at.isoformat(),
                "updated_at": fa.updated_at.isoformat(),
                "image_count": fa.field_assessment_images.count()
            }
            data.append(item)

        return JsonResponse(data, safe=False)

    except Exception as e:
        import logging
        logging.error(f"Error fetching assessments: {str(e)}")
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
def get_field_assessment_detail_view(request, field_assessment_id):
    """
    GET: Fetch complete field assessment data including:
    - Core assessment fields
    - Related Field_assessment_details (tree/soil links)
    - Related field_assessment_images (with URLs)
    """
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    
    try:
        user = get_user_from_token(request)
        fa = get_object_or_404(
            Field_assessment.objects.select_related(
                'site', 
                'assigned_onsite_inspector',
                'assigned_onsite_inspector__user'
            ),
            field_assessment_id=field_assessment_id
        )
        
        # 🔐 Security: Only the assigned inspector can view details
        if fa.assigned_onsite_inspector.user != user:
            return JsonResponse({'error': 'Forbidden'}, status=403)
        
        # ✅ Serialize Field_assessment_details (tree/soil links)
        details_data = []
        for detail in fa.field_assessment_details.all().select_related('tree_specie', 'soil'):
            details_data.append({
                "detail_id": detail.field_assessment_detail_id,
                "tree_specie": {
                    "id": detail.tree_specie.tree_specie_id if detail.tree_specie else None,
                    "name": detail.tree_specie.name if detail.tree_specie else None,
                    "scientific_name": detail.tree_specie.scientific_name if detail.tree_specie else None,
                } if detail.tree_specie else None,
                "soil": {
                    "id": detail.soil.soil_id if detail.soil else None,
                    "name": detail.soil.name if detail.soil else None,
                    "type": detail.soil.type if detail.soil else None,
                } if detail.soil else None,
                "created_at": detail.created_at.isoformat() if detail.created_at else None
            })
        
        # ✅ Serialize field_assessment_images (with full URLs)
        images_data = []
        for img in fa.field_assessment_images.all().order_by('created_at'):
            images_data.append({
                "image_id": img.field_assessment_images_id,
                "url": img.img.url if img.img else None,  # Django auto-generates relative URL
                "caption": img.caption or "",
                "created_at": img.created_at.isoformat() if img.created_at else None
            })
        
        # ✅ Main assessment data
        data = {
            "field_assessment_id": fa.field_assessment_id,
            "site_id": fa.site_id,
            "site_name": fa.site.name if fa.site else "New Site Proposal",
            "reforestation_area_id": fa.assigned_onsite_inspector.reforestation_area_id,
            "type": fa.multicriteria_type,
            "title": fa.title,
            "description": fa.description,
            "data": fa.field_assessment_data,  # The JSON field with layer-specific data
            "is_sent": fa.is_sent,
            "created_at": fa.created_at.isoformat(),
            "updated_at": fa.updated_at.isoformat(),
            
            # ✅ Include related data
            "details": details_data,      # Tree/Soil relational links
            "images": images_data,        # Uploaded photos with metadata
            "image_count": len(images_data)  # Quick count for UI badges
        }
        
        return JsonResponse(data, status=200)
        
    except Exception as e:
        import logging
        logging.error(f"Error fetching assessment {field_assessment_id}: {str(e)}")
        return JsonResponse({'error': str(e)}, status=500)

# ---------------- 3. Create Field Assessment (Save Draft) ----------------
@csrf_exempt
def create_field_assessment(request):
    if request.method != "POST":
        return JsonResponse({"error": "Only POST allowed"}, status=405)

    try:
        user = get_user_from_token(request)
        if not user or user.user_role != "OnsiteInspector":
            return JsonResponse({'error': 'Unauthorized'}, status=403)

        body = json.loads(request.body)
        
        site_id = body.get("site_id") # Can be None for new site proposals
        reforestation_area_id = body.get("reforestation_area_id") # MUST be present
        multicriteria_type = body.get("multicriteria_type")
        title = body.get("title", f"Draft {multicriteria_type}")
        description = body.get("description", "")
        field_data = body.get("field_assessment_data", {})

        if not reforestation_area_id:
            return JsonResponse({
                "error": "reforestation_area_id is required to associate data with an area."
            }, status=400)

        if not multicriteria_type:
            return JsonResponse({"error": "multicriteria_type is required"}, status=400)

        # Validate Assignment (Works even if site_id is None)
        if not check_inspector_assignment(user, reforestation_area_id=reforestation_area_id):
            return JsonResponse({"error": "You are not assigned to this reforestation area"}, status=403)

        # Get Assignment Object
        assignment = Assigned_onsite_inspector.objects.filter(
            user=user, 
            reforestation_area_id=reforestation_area_id
        ).first()
        
        if not assignment:
             return JsonResponse({"error": "No active assignment found for this area"}, status=400)

        # Create Record
        fa = Field_assessment.objects.create(
            site_id=site_id,  # Saves as NULL if not provided
            assigned_onsite_inspector=assignment,
            multicriteria_type=multicriteria_type,
            title=title,
            description=description,
            field_assessment_data=field_data,
            is_sent=False # Always start as draft
        )

        return JsonResponse({
            "message": "Assessment created successfully" if site_id else "New site proposal created successfully",
            "field_assessment_id": fa.field_assessment_id,
            "is_new_site_proposal": site_id is None
        }, status=201)

    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

# ---------------- 4. Update Field Assessment ----------------
@csrf_exempt
def update_field_assessment(request, field_assessment_id):
    """
    PUT/POST: Update field assessment data + AUTO-LINK soil/tree if provided
    """
    if request.method not in ['POST', 'PUT']:
        return JsonResponse({'error': 'Only POST/PUT allowed'}, status=405)

    try:
        user = get_user_from_token(request)
        fa = get_object_or_404(Field_assessment, field_assessment_id=field_assessment_id)

        # Security: Only the owner can update
        if fa.assigned_onsite_inspector.user != user:
            return JsonResponse({'error': 'Forbidden'}, status=403)

        # Cannot update if already sent
        if fa.is_sent:
            return JsonResponse({'error': 'Cannot update a submitted assessment. Contact admin.'}, status=400)

        body = json.loads(request.body)
        
        # Update core fields if provided
        if 'title' in body: fa.title = body['title']
        if 'description' in body: fa.description = body['description']
        if 'field_assessment_data' in body: 
            fa.field_assessment_data = body['field_assessment_data']
        
        fa.save()

        # ✅ AUTO-LINKING: Check for selected_soil_id or selected_tree_specie_id in payload
        field_data = body.get("field_assessment_data", {})
        
        # Auto-link soil if provided and not already linked
        if "selected_soil_id" in field_data and field_data["selected_soil_id"]:
            soil_id = field_data["selected_soil_id"]
            # Avoid duplicate links
            if not Field_assessment_details.objects.filter(
                field_assessment=fa, 
                soil_id=soil_id
            ).exists():
                Field_assessment_details.objects.create(
                    field_assessment=fa,
                    soil_id=soil_id,
                    tree_specie_id=None
                )
        
        # Auto-link tree species if provided (for TreeSpeciesForm)
        if "selected_tree_specie_id" in field_data and field_data["selected_tree_specie_id"]:
            tree_id = field_data["selected_tree_specie_id"]
            if not Field_assessment_details.objects.filter(
                field_assessment=fa,
                tree_specie_id=tree_id
            ).exists():
                Field_assessment_details.objects.create(
                    field_assessment=fa,
                    soil_id=None,
                    tree_specie_id=tree_id
                )

        return JsonResponse({
            "message": "Updated successfully",
            "data": fa.field_assessment_data,
            "auto_linked": {
                "soil_id": field_data.get("selected_soil_id"),
                "tree_specie_id": field_data.get("selected_tree_specie_id")
            }
        })

    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)
    except Exception as e:
        import logging
        logging.error(f"Error updating assessment {field_assessment_id}: {str(e)}")
        return JsonResponse({"error": str(e)}, status=500)
    
# ---------------- 5. Delete Field Assessment ----------------
@csrf_exempt
def delete_field_assessment(request, field_assessment_id):
    if request.method != 'DELETE':
        return JsonResponse({'error': 'Only DELETE allowed'}, status=405)

    try:
        user = get_user_from_token(request)
        fa = get_object_or_404(Field_assessment, field_assessment_id=field_assessment_id)

        if fa.assigned_onsite_inspector.user != user:
            return JsonResponse({'error': 'Forbidden'}, status=403)

        if fa.is_sent:
            return JsonResponse({'error': 'Cannot delete a submitted assessment'}, status=400)

        fa.delete()
        return JsonResponse({"message": "Field assessment deleted successfully"})
    
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


# ---------------- 6. Update Is Sent (Submit) ----------------
@csrf_exempt
def update_field_assessment_is_sent(request, field_assessment_id):
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)

    try:
        user = get_user_from_token(request)
        fa = get_object_or_404(Field_assessment, field_assessment_id=field_assessment_id)

        if fa.assigned_onsite_inspector.user != user:
            return JsonResponse({'error': 'Forbidden'}, status=403)

        body = json.loads(request.body)
        is_sent = body.get("is_sent")
        
        if not isinstance(is_sent, bool):
            return JsonResponse({"error": "is_sent must be boolean"}, status=400)

        # Prevent un-sending
        if fa.is_sent and is_sent is False:
            return JsonResponse({"error": "Cannot revert a submitted assessment"}, status=400)

        fa.is_sent = is_sent
        fa.save()

        return JsonResponse({
            "message": "Status updated",
            "is_sent": fa.is_sent
        })
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

# ---------------- 7. Image Upload Handling ----------------
@csrf_exempt
def upload_field_assessment_image(request, field_assessment_id):
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)

    try:
        user = get_user_from_token(request)
        fa = get_object_or_404(Field_assessment, field_assessment_id=field_assessment_id)

        if fa.assigned_onsite_inspector.user != user:
            return JsonResponse({'error': 'Forbidden'}, status=403)
        
        if fa.is_sent:
            return JsonResponse({'error': 'Cannot add images to submitted assessment'}, status=400)

        if 'image' not in request.FILES:
            return JsonResponse({'error': 'No image file provided'}, status=400)

        img_file = request.FILES['image']
        caption = request.POST.get('caption', '')

        new_img = field_assessment_images.objects.create(
            field_assessment=fa,
            img=img_file,
            caption=caption
        )

        return JsonResponse({
            "message": "Image uploaded",
            "image_id": new_img.field_assessment_images_id,
            "url": new_img.img.url if new_img.img else None
        }, status=201)

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

@csrf_exempt
def delete_field_assessment_image(request, image_id):
    """
    DELETE: Remove an image from a field assessment
    
    Security Rules:
    1. Only the assigned onsite inspector can delete their images
    2. Cannot delete images from submitted (is_sent=True) assessments
    3. Image file is deleted from storage + database record removed
    """
    if request.method != 'DELETE':
        return JsonResponse({'error': 'Only DELETE allowed'}, status=405)
    
    try:
        # 1. Authenticate user
        user = get_user_from_token(request)
        
        # 2. Get image object with related assessment
        img = get_object_or_404(
            field_assessment_images.objects.select_related(
                'field_assessment',
                'field_assessment__assigned_onsite_inspector',
                'field_assessment__assigned_onsite_inspector__user'
            ),
            field_assessment_images_id=image_id
        )
        
        fa = img.field_assessment
        
        # 3. 🔐 Security: Only the owner can delete
        if fa.assigned_onsite_inspector.user != user:
            return JsonResponse({'error': 'Forbidden'}, status=403)
        
        # 4. 🚫 Prevent deletion from submitted assessments
        if fa.is_sent:
            return JsonResponse({
                'error': 'Cannot delete images from a submitted assessment. Contact admin to revert submission first.'
            }, status=400)
        
        # 5. 🗑️ Delete image file from storage (if exists)
        if img.img and hasattr(img.img, 'delete'):
            try:
                img.img.delete(save=False)  # Delete file without saving model first
            except Exception as file_err:
                # Log but continue - we still want to remove the DB record
                import logging
                logging.warning(f"Could not delete file for image {image_id}: {file_err}")
        
        # 6. Delete database record
        image_id_deleted = img.field_assessment_images_id
        img.delete()
        
        return JsonResponse({
            "message": "Image deleted successfully",
            "deleted_image_id": image_id_deleted
        }, status=200)
        
    except Exception as e:
        import logging
        logging.error(f"Error deleting image {image_id}: {str(e)}")
        return JsonResponse({"error": str(e)}, status=500)
    
# ---------------- 8. Details (Tree/Soil Links) ----------------
@csrf_exempt
def get_field_assessment_details(request, field_assessment_id):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    
    try:
        details = Field_assessment_details.objects.filter(field_assessment_id=field_assessment_id)
        data = [
            {
                "detail_id": d.field_assessment_detail_id,
                "tree_specie_id": d.tree_specie_id,
                "tree_name": d.tree_specie.name if d.tree_specie else None,
                "soil_id": d.soil_id,
                "soil_name": d.soil.name if d.soil else None
            }
            for d in details
        ]
        return JsonResponse(data, safe=False)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

@csrf_exempt
def create_field_detail(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)

    try:
        data = json.loads(request.body)
        fa_id = data.get("field_assessment_id")
        tree_id = data.get("tree_specie_id")
        soil_id = data.get("soil_id")

        if not fa_id:
            return JsonResponse({"error": "field_assessment_id required"}, status=400)

        fa = get_object_or_404(Field_assessment, field_assessment_id=fa_id)
        tree = get_object_or_404(Tree_species, tree_species_id=tree_id) if tree_id else None
        soil = get_object_or_404(Soils, soil_id=soil_id) if soil_id else None

        detail = Field_assessment_details.objects.create(
            field_assessment=fa,
            tree_specie=tree,
            soil=soil
        )
        return JsonResponse({"message": "Detail linked", "id": detail.field_assessment_detail_id}, status=201)

    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)
    
@csrf_exempt
def delete_field_detail(request, field_assessment_detail_id):
    if request.method != 'DELETE':
        return JsonResponse({'error': 'Only DELETE allowed'}, status=405)

    detail = get_object_or_404(Field_assessment_details, field_assessment_detail_id=field_assessment_detail_id)
    detail.delete()
    return JsonResponse({"message": "Detail deleted successfully"})

@csrf_exempt
def get_sites_by_area(request, reforestation_area_id):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    
    try:
        # Fetch sites linked to this area
        sites = Sites.objects.filter(
            reforestation_area_id=reforestation_area_id,
            isActive=True
        ).order_by('-created_at')
        
        data = [
            {
                "site_id": s.site_id,
                "name": s.name,
                "status": s.status,
                "score": float(s.score) if s.score else None,
                "polygon_coordinates": s.polygon_coordinates,
                "center_coordinate": s.center_coordinate,
                "created_at": s.created_at.isoformat()
            }
            for s in sites
        ]
        
        return JsonResponse({
            "reforestation_area_id": reforestation_area_id,
            "count": len(data),
            "sites": data
        }, status=200)
        
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)