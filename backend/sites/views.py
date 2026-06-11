import json
import logging
import math
from django.db import IntegrityError, transaction
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import get_object_or_404
from django.utils import timezone
from accounts.helper import get_user_from_token
from .models import (
    Sites, Site_data, Site_species_recommendation, Site_images, 
    Potential_sites, SiteMetaDataVerification, PermitDocument
)
from reforestation_areas.models import Reforestation_areas
from tree_species.models import Tree_species
from Field_assessment.models import Field_assessment
logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────
# ⚠️  IMPORTANT: Endpoints marked with [KEEP] are used by other modules
# ─────────────────────────────────────────────

@csrf_exempt
def create_site(request):
    """
    ✅ UPDATED: Creates site AND initializes SiteMetaDataVerification record.
    Verification is now at the SITE level, not the AREA level.
    """
    if request.method != "POST": 
        return JsonResponse({"error": "POST only"}, status=405)
    
    try:
        body = json.loads(request.body)
        name = body.get('name', '').strip()
        reforestation_area_id = body.get('reforestation_area_id')
        potential_site_ids = body.get('potential_site_ids', [])
        
        if not name or not reforestation_area_id:
            return JsonResponse({"error": "name and reforestation_area_id are required"}, status=400)

        reforestation_area = get_object_or_404(Reforestation_areas, reforestation_area_id=reforestation_area_id)

        # ✅ Get polygon and center from request
        polygon_coordinates = body.get('polygon_coordinates')
        center_coordinate = body.get('center_coordinate')
        
        # ✅ If center_coordinate is None but we have polygon, calculate centroid
        if not center_coordinate and polygon_coordinates and len(polygon_coordinates) >= 3:
            # Calculate centroid (average of all points)
            sum_lat = sum(coord[0] for coord in polygon_coordinates)
            sum_lng = sum(coord[1] for coord in polygon_coordinates)
            center_coordinate = [sum_lat / len(polygon_coordinates), sum_lng / len(polygon_coordinates)]
            logger.info(f"Auto-calculated center coordinate: {center_coordinate}")

        with transaction.atomic():
            # 1. Create the Site
            site = Sites.objects.create(
                reforestation_area=reforestation_area,
                name=name,
                status='pending',
                is_active=True,
                polygon_coordinates=polygon_coordinates,
                center_coordinate=center_coordinate,  # ✅ Now guaranteed to have a value if polygon exists
                ndvi_value=body.get('ndvi_value'),
                total_area_hectares=body.get('total_area_hectares', 0.0),
            )
            
            # Calculate area if polygon exists
            if site.polygon_coordinates:
                site.total_area_hectares = site.calculate_area_from_polygon()
                # ✅ Recalculate center using model's method (more accurate)
                if not site.center_coordinate:
                    site.center_coordinate = site.calculate_centroid()
                site.save()

            # 2. ✅ CONSOLIDATION: Link pre-marked potential sites to this new official site
            if potential_site_ids:
                Potential_sites.objects.filter(
                    potential_sites_id__in=potential_site_ids
                ).update(site=site)

            # 3. Create Site_data for MCDA validation
            Site_data.objects.create(
                site=site, 
                version=1, 
                is_current=True, 
                site_data={}, 
                field_assessment_snapshot={}
            )

            # 4. ✅ NEW: Create SiteMetaDataVerification record (initialized as pending)
            SiteMetaDataVerification.objects.create(
                site=site,
                status='pending',
                verified_security_concerns=[],
                verified_accessibility={},
                verified_by=None,
                verified_at=None
            )

        return JsonResponse({
            "message": "Site created successfully", 
            "site_id": site.site_id,
            "status": site.status,
            "center_coordinate": site.center_coordinate  # ✅ Return calculated center
        }, status=201)
        
    except IntegrityError:
        return JsonResponse({"error": "Site name already exists in this area."}, status=409)
    except Exception as e:
        logger.error(f"Create site error: {e}", exc_info=True)
        return JsonResponse({"error": str(e)}, status=500)
    

# ─────────────────────────────────────────────
# [KEEP] GET SITES LIST - Used by dashboard/other modules
# ─────────────────────────────────────────────
@csrf_exempt
def get_sites(request, reforestation_area_id):
    """
    [KEEP] Returns sites with comprehensive information including:
    - Verification status (from SiteMetaDataVerification)
    - Land classification
    - Security concerns
    - Accessibility info
    - Permit count
    """
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    search = request.GET.get("search", "").strip()
    entries = max(1, int(request.GET.get("entries", 10)))
    page = max(1, int(request.GET.get("page", 1)))
    status_filter = request.GET.get("status", "all").strip().lower()
    pinned_filter = request.GET.get("pinned_only", "").strip().lower()
    verification_filter = request.GET.get("verification_status", "all").strip().lower()

    offset = (page - 1) * entries

    sites = Sites.objects.filter(
        reforestation_area_id=reforestation_area_id,
        is_active=True
    ).select_related('meta_verification', 'meta_verification__verified_land_classification').order_by("-is_pinned", "-created_at")

    if search:
        sites = sites.filter(name__icontains=search)
    if status_filter != "all":
        sites = sites.filter(status=status_filter)
    if pinned_filter == "true":
        sites = sites.filter(is_pinned=True)
    if verification_filter != "all":
        sites = sites.filter(meta_verification__status=verification_filter)

    total = sites.count()
    total_page = max(1, math.ceil(total / entries))
    sites_list = sites[offset: offset + entries]

    data = []
    for s in sites_list:
        # Get current validation data
        current_sd = s.site_data_versions.filter(is_current=True).first()
        
        validation = {
            "has_safety_note": False,
            "has_survivability_note": False,
            "final_decision": None,
            "is_ready_to_finalize": False
        }
        
        if current_sd and current_sd.site_data:
            validation["has_safety_note"] = bool(
                current_sd.site_data.get('safety', {}).get('decision_note', '').strip()
            )
            validation["has_survivability_note"] = bool(
                current_sd.site_data.get('survivability', {}).get('decision_note', '').strip()
            )
            validation["final_decision"] = current_sd.site_data.get('final_decision')
            validation["is_ready_to_finalize"] = bool(validation["final_decision"])

        # ✅ NEW: Get SiteMetaDataVerification data
        meta_verification = getattr(s, 'meta_verification', None)
        verification_info = {
            "status": "pending",
            "land_classification": None,
            "security_concerns_count": 0,
            "has_accessibility": False,
            "accessibility_type": None,
        }
        
        if meta_verification:
            verification_info["status"] = meta_verification.status
            
            # Land classification
            if meta_verification.verified_land_classification:
                verification_info["land_classification"] = {
                    "id": meta_verification.verified_land_classification.land_classification_id,
                    "name": meta_verification.verified_land_classification.name
                }
            
            # Security concerns
            if meta_verification.verified_security_concerns:
                verification_info["security_concerns_count"] = len(meta_verification.verified_security_concerns)
            
            # Accessibility
            if meta_verification.verified_accessibility:
                verification_info["has_accessibility"] = True
                if isinstance(meta_verification.verified_accessibility, dict):
                    verification_info["accessibility_type"] = meta_verification.verified_accessibility.get('type', 'Unknown')

        # ✅ NEW: Count permits
        permit_count = s.permit_documents.count()

        data.append({
            "site_id": s.site_id,
            "name": s.name,
            "status": s.status,
            "is_pinned": s.is_pinned,
            "validation": validation,
            "verification": verification_info,  # ✅ NEW
            "permit_count": permit_count,  # ✅ NEW
            "metrics": {
                "ndvi": s.ndvi_value,
                "area_hectares": s.total_area_hectares,
                "seedlings": s.total_seedlings_planted,
            },
            "created_at": s.created_at.strftime("%Y-%m-%d %H:%M:%S")
        })

    return JsonResponse({
        "data": data,
        "total_page": total_page,
        "page": page,
        "entries": entries,
        "total": total
    }, status=200)


# ─────────────────────────────────────────────
# [KEEP] GET SINGLE SITE - Used by map/detail modules
# ─────────────────────────────────────────────
@csrf_exempt
def get_site(request, site_id):
    if request.method != "GET": return JsonResponse({"error": "GET only"}, status=405)
    site = get_object_or_404(Sites, site_id=site_id, is_active=True)
    
    # ✅ Fetch Site-Level Verification
    verification = getattr(site, 'meta_verification', None)
    verification_data = None
    if verification:
        verification_data = {
            'status': verification.status,
            'verified_security_concerns': verification.verified_security_concerns,
            'verified_accessibility': verification.verified_accessibility,
            'verified_land_classification_id': verification.verified_land_classification_id,
        }

    return JsonResponse({
        "site_id": site.site_id,
        "name": site.name,
        "status": site.status,
        "polygon_coordinates": site.polygon_coordinates,
        "center_coordinate": site.center_coordinate,
        "ndvi_value": site.ndvi_value,
        "area_hectares": site.total_area_hectares,
        "potential_sites": [p.to_dict() for p in site.potential_sites.all()], # ✅ Show consolidated markers
        "meta_verification": verification_data,
        "permits": [{
            "permit_id": p.permit_id,
            "document_type": p.document_type,
            "file_url": p.file.url if p.file else None
        } for p in site.permit_documents.all()],
        "validation_data": site.site_data_versions.filter(is_current=True).first().site_data if site.site_data_versions.filter(is_current=True).exists() else {}
    })



# ─────────────────────────────────────────────
# [KEEP] TOGGLE PIN - Used by dashboard
# ─────────────────────────────────────────────
@csrf_exempt
def toggle_pin(request, site_id):
    """[KEEP] Toggle the is_pinned boolean for dashboard prioritization."""
    if request.method not in ["POST", "PUT"]:
        return JsonResponse({"error": "Only POST/PUT allowed"}, status=405)
    
    try:
        site = get_object_or_404(Sites, site_id=site_id, is_active=True)
        site.is_pinned = not site.is_pinned
        site.save()
        return JsonResponse({
            "message": f"Site {'pinned' if site.is_pinned else 'unpinned'} successfully.",
            "is_pinned": site.is_pinned
        }, status=200)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)


# ─────────────────────────────────────────────
# [KEEP] UPDATE SPECIES - Used by tree grower module
# ─────────────────────────────────────────────
@csrf_exempt
def update_species_recommendations(request, site_id):
    """[KEEP] GIS Specialist updates recommended tree species for a site."""
    if request.method != "POST":
        return JsonResponse({"error": "Only POST allowed"}, status=405)
    
    try:
        body = json.loads(request.body)
        site = get_object_or_404(Sites, site_id=site_id, is_active=True)
        species_list = body.get("species", [])
        
        if not isinstance(species_list, list):
            return JsonResponse({"error": "'species' must be an array"}, status=400)
        
        with transaction.atomic():
            site.species_recommendations.all().delete()
            
            for i, sp in enumerate(species_list):
                tree_species_id = sp.get("tree_species_id")
                if not tree_species_id:
                    continue
                tree_species = get_object_or_404(Tree_species, tree_specie_id=tree_species_id)
                Site_species_recommendation.objects.create(
                    site=site,
                    tree_species=tree_species,
                    priority_rank=sp.get("priority_rank", i + 1),
                    notes=sp.get("notes", "")
                )
        
        return JsonResponse({"message": "Species recommendations updated."}, status=200)
        
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON format"}, status=400)
    except Exception as e:
        logger.error(f"update_species_recommendations error: {e}", exc_info=True)
        return JsonResponse({"error": "Internal server error"}, status=500)


# ─────────────────────────────────────────────
# [KEEP] UPDATE POLYGON - Core GIS functionality
# ─────────────────────────────────────────────
@csrf_exempt
def save_site_polygon(request, site_id):
    """[KEEP] Update site polygon and auto-calculate metrics."""
    if request.method not in ["PUT", "PATCH"]:
        return JsonResponse({"error": "PUT/PATCH only"}, status=405)
    
    try:
        body = json.loads(request.body)
        site = get_object_or_404(Sites, site_id=site_id, is_active=True)
        
        if 'polygon_coordinates' in body:
            site.polygon_coordinates = body['polygon_coordinates']
            site.total_area_hectares = site.calculate_area_from_polygon()
            site.center_coordinate = site.calculate_centroid()
        if 'ndvi_value' in body:
            site.ndvi_value = body['ndvi_value']
        if 'marker_coordinate' in body:
            site.marker_coordinate = body['marker_coordinate']
            
        site.save()
        return JsonResponse({
            "message": "Polygon & metrics updated", 
            "area_hectares": site.total_area_hectares, 
            "center": site.center_coordinate
        })
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)


# ─────────────────────────────────────────────
# [KEEP] GET SITES LIST (Alternative) - Used by other module
# ─────────────────────────────────────────────
# In your sites/views.py, update the get_sites_list function:

@csrf_exempt
def get_sites_list(request, reforestation_area_id):
    """
    [KEEP - DO NOT REMOVE] Alternative site list endpoint.
    ✅ UPDATED: Now supports verification_status filter
    """
    if request.method != "GET":
        return JsonResponse({"error": "GET only"}, status=405)

    search = request.GET.get("search", "").strip()
    status_filter = request.GET.get("status", "all").strip().lower()
    verification_filter = request.GET.get("verification_status", "all").strip().lower()  # ✅ NEW

    sites = Sites.objects.filter(
        reforestation_area_id=reforestation_area_id, 
        is_active=True
    ).select_related('meta_verification').order_by("-is_pinned", "-created_at")
    
    if search: 
        sites = sites.filter(name__icontains=search)
    if status_filter != "all": 
        sites = sites.filter(status=status_filter)
    
    # ✅ NEW: Filter by verification status
    if verification_filter != "all":
        sites = sites.filter(meta_verification__status=verification_filter)

    data = []
    for s in sites:
        latest_sd = s.site_data_versions.order_by('-version').first()
        
        validation = {
            "has_safety_note": False,
            "has_survivability_note": False,
            "final_decision": None,
        }
        
        if latest_sd and latest_sd.site_data:
            validation["has_safety_note"] = bool(
                latest_sd.site_data.get('safety', {}).get('decision_note', '').strip()
            )
            validation["has_survivability_note"] = bool(
                latest_sd.site_data.get('survivability', {}).get('decision_note', '').strip()
            )
            validation["final_decision"] = latest_sd.site_data.get('final_decision')

        # ✅ NEW: Include verification status in response
        meta_verification = getattr(s, 'meta_verification', None)
        verification_status = meta_verification.status if meta_verification else 'pending'

        data.append({
            "site_id": s.site_id,
            "name": s.name,
            "status": s.status,
            "is_pinned": s.is_pinned,
            "area_hectares": s.total_area_hectares,
            "ndvi": s.ndvi_value,
            "validation": validation,
            "verification_status": verification_status,  # ✅ NEW
            "created_at": s.created_at.strftime("%Y-%m-%d %H:%M")
        })

    return JsonResponse({"data": data, "count": len(data)})


# ─────────────────────────────────────────────
# [REPLACE] Simplified: Save Validation Draft
# ─────────────────────────────────────────────
@csrf_exempt
def save_validation_draft(request, site_id):
    """
    PUT/PATCH: Save decision notes for Safety and Survivability layers.
    Simplified workflow: Just notes, no per-layer accept/reject.
    """
    if request.method not in ["PUT", "PATCH", "POST"]:
        return JsonResponse({"error": "PUT/PATCH/POST only"}, status=405)
    
    try:
        body = json.loads(request.body)
        site = get_object_or_404(Sites, site_id=site_id, is_active=True)
        
        # Get or create current draft
        sd, created = Site_data.objects.get_or_create(
            site=site,
            is_current=True,
            defaults={'version': 1, 'site_data': {}}
        )
        
        if not sd.site_data:
            sd.site_data = {}
        
        # ✅ Save decision notes for each layer (no accept/reject fields)
        if 'safety' in body and 'decision_note' in body['safety']:
            if 'safety' not in sd.site_data:
                sd.site_data['safety'] = {}
            sd.site_data['safety']['decision_note'] = body['safety']['decision_note']
        
        if 'survivability' in body and 'decision_note' in body['survivability']:
            if 'survivability' not in sd.site_data:
                sd.site_data['survivability'] = {}
            sd.site_data['survivability']['decision_note'] = body['survivability']['decision_note']
        
        # Optional: Save final decision note (overall reasoning)
        if 'final_decision_note' in body:
            sd.site_data['final_decision_note'] = body['final_decision_note']
        
        sd.save()
        
        return JsonResponse({
            "message": "Validation draft saved",
            "data": {
                "safety_note": sd.site_data.get('safety', {}).get('decision_note'),
                "survivability_note": sd.site_data.get('survivability', {}).get('decision_note'),
                "final_note": sd.site_data.get('final_decision_note')
            }
        })
        
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON format"}, status=400)
    except Exception as e:
        logger.error(f"save_validation_draft error: {e}", exc_info=True)
        return JsonResponse({"error": str(e)}, status=500)


# ─────────────────────────────────────────────
# [REPLACE] Simplified: Finalize Site (ONE Decision)
# ─────────────────────────────────────────────
@csrf_exempt
def finalize_site(request, site_id):
    """
    POST: Make ONE final decision to Accept or Reject the entire site.
    Simplified: No per-layer validation required, just final decision + notes.
    """
    if request.method != "POST":
        return JsonResponse({"error": "POST only"}, status=405)

    try:
        body = json.loads(request.body)
        final_decision = body.get("final_decision", "").upper()
        
        if final_decision not in ["ACCEPT", "REJECT"]:
            return JsonResponse({
                "error": "final_decision must be 'ACCEPT' or 'REJECT'"
            }, status=400)
        
        final_decision_note = body.get("final_decision_note", "").strip()
        
        site = get_object_or_404(Sites, site_id=site_id, is_active=True)
        current_sd = site.site_data_versions.filter(is_current=True).first()
        
        if not current_sd:
            return JsonResponse({"error": "No active draft found to finalize"}, status=404)
        
        user = get_user_from_token(request)
        
        with transaction.atomic():
            # 1. Update current draft with final decision
            current_sd.site_data['final_decision'] = final_decision
            if final_decision_note:
                current_sd.site_data['final_decision_note'] = final_decision_note
            current_sd.site_data['validated_at'] = timezone.now().isoformat()
            current_sd.site_data['validated_by'] = user.email if user else "system"
            current_sd.save()
            
            # 2. Archive current version (set is_current=False)
            current_sd.is_current = False
            current_sd.save()
            
            # 3. Create new empty current version for future edits
            Site_data.objects.create(
                site=site,
                version=current_sd.version + 1,
                is_current=True,
                site_data={},
                field_assessment_snapshot={}
            )
            
            # 4. Update site status
            site.status = "accepted" if final_decision == "ACCEPT" else "rejected"
            site.save()
        
        logger.info(
            f"Site {site_id} finalized: decision={final_decision}, "
            f"archived_version={current_sd.version}, new_version={current_sd.version + 1}"
        )
        
        return JsonResponse({
            "message": f"Site {final_decision}ED successfully",
            "status": site.status,
            "site_id": site.site_id,
            "new_version": current_sd.version + 1
        }, status=200)
        
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON format"}, status=400)
    except Exception as e:
        logger.error(f"finalize_site error: {e}", exc_info=True)
        return JsonResponse({"error": f"Internal server error: {str(e)[:200]}"}, status=500)


# ─────────────────────────────────────────────
# [KEEP] DELETE SITE - Core functionality
# ─────────────────────────────────────────────
@csrf_exempt
def delete_site(request, site_id):
    """[KEEP] Soft-delete a site by setting is_active=False."""
    if request.method != "DELETE":
        return JsonResponse({"error": "DELETE only"}, status=405)
    site = get_object_or_404(Sites, site_id=site_id, is_active=True)
    site.is_active = False
    site.save()
    return JsonResponse({"message": "Site deleted"})



# ✅ FIXED: Helper function to serialize assessment
def _serialize_assessment(assessment, assessment_type):
    """Helper to serialize a Field_assessment with full details including images."""
    inspector = assessment.assigned_onsite_inspector
    user = inspector.user if inspector else None
    
    # ✅ FIX 1: Safely get user name (fallback to email if first_name doesn't exist)
    inspector_name = 'Unknown'
    if user:
        first = getattr(user, 'first_name', '') or ''
        last = getattr(user, 'last_name', '') or ''
        inspector_name = f"{first} {last}".strip()
        if not inspector_name:
            inspector_name = getattr(user, 'email', 'Unknown') or getattr(user, 'username', 'Unknown')

    # Get inspector profile image safely
    inspector_profile_img = None
    if user and hasattr(user, 'profile_img') and user.profile_img:
        try:
            inspector_profile_img = user.profile_img.url
        except:
            pass
    
    # Get images
    images_data = []
    for img in assessment.images.all():
        images_data.append({
            'image_id': img.field_assessment_images_id,
            'url': img.img.url if img.img else None,
            'layer': img.layer,
            'latitude': float(img.latitude) if img.latitude else None,
            'longitude': float(img.longitude) if img.longitude else None,
            'description': img.description,
            'created_at': img.created_at.isoformat() if img.created_at else None,
        })
    
    return {
        'id': assessment.field_assessment_id,
        'type': assessment_type,
        'inspector_id': user.id if user else None,
        'inspector_name': inspector_name,
        'inspector_email': user.email if user else 'Unknown',
        'inspector_profile_img': inspector_profile_img,
        'assessment_date': assessment.assessment_date.isoformat() if assessment.assessment_date else None,
        'location': assessment.location,
        'field_assessment_data': assessment.field_assessment_data,
        'is_submitted': assessment.is_submitted,
        'image_count': len(images_data),
        'images': images_data,
        'created_at': assessment.created_at.isoformat() if assessment.created_at else None,
        'submitted_at': assessment.updated_at.isoformat() if assessment.updated_at else None,
    }


@csrf_exempt
def get_site_verification(request, site_id):
    """
    GET: Return the saved verification record for a SPECIFIC SITE.
    ✅ UPDATED: Filters to show ONLY assessments with 'meta_data' in field_assessment_data.
    """
    if request.method != 'GET': 
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    
    site = get_object_or_404(Sites, site_id=site_id, is_active=True)
    verification, _ = SiteMetaDataVerification.objects.get_or_create(
        site=site, defaults={'status': 'pending'}
    )
    
    assessments_data = []
    
    if Field_assessment is not None:
        try:
            # ✅ SPECIFIC assessments: Linked directly to this site
            # ✅ FILTER: Only if field_assessment_data has 'meta_data' key
            specific_assessments = Field_assessment.objects.filter(
                site=site, 
                is_submitted=True,
                field_assessment_data__has_key='meta_data'  # ✅ NEW FILTER
            ).select_related(
                'assigned_onsite_inspector', 
                'assigned_onsite_inspector__user'
            ).prefetch_related('images').order_by('-assessment_date')
            
            for a in specific_assessments:
                assessments_data.append(_serialize_assessment(a, 'specific'))
            
            # ✅ GENERAL assessments: site is NULL, area matches via inspector
            # ✅ FILTER: Only if field_assessment_data has 'meta_data' key
            general_assessments = Field_assessment.objects.filter(
                site__isnull=True,  
                assigned_onsite_inspector__reforestation_area=site.reforestation_area,
                is_submitted=True,
                field_assessment_data__has_key='meta_data'  # ✅ NEW FILTER
            ).select_related(
                'assigned_onsite_inspector', 
                'assigned_onsite_inspector__user',
                'assigned_onsite_inspector__reforestation_area'
            ).prefetch_related('images').order_by('-assessment_date')
            
            for a in general_assessments:
                assessments_data.append(_serialize_assessment(a, 'general'))
                
        except Exception as e:
            logger.warning(f"Could not fetch field assessments: {e}")

    # ✅ FIX: Ensure sets are converted to lists for JSON serialization
    sec_concerns = verification.verified_security_concerns
    if isinstance(sec_concerns, set):
        sec_concerns = list(sec_concerns)
    elif not sec_concerns:
        sec_concerns = []

    acc = verification.verified_accessibility
    if isinstance(acc, set):
        acc = list(acc)
    elif not acc:
        acc = {}

    return JsonResponse({
        'verification': {
            'id': verification.id, 
            'status': verification.status,
            'verified_security_concerns': sec_concerns,
            'verified_accessibility': acc,
            'verified_land_classification_id': verification.verified_land_classification_id,
            'verified_land_classification_name': verification.verified_land_classification.name if verification.verified_land_classification else None,
            'decision_note': verification.decision_note or '',
            'referenced_assessment_ids': verification.referenced_assessment_ids or [],
            'verified_by': verification.verified_by.email if verification.verified_by else None,
            'verified_at': verification.verified_at.isoformat() if verification.verified_at else None,
        },
        'site_info': {
            'site_id': site.site_id,
            'name': site.name,
            'status': site.status,
            'reforestation_area_id': site.reforestation_area_id,
            'reforestation_area_name': site.reforestation_area.name,
        },
        'field_assessments': assessments_data,
        'assessment_counts': {
            'total': len(assessments_data),
            'specific': len([a for a in assessments_data if a['type'] == 'specific']),
            'general': len([a for a in assessments_data if a['type'] == 'general']),
        }
    }, status=200)


@csrf_exempt
def update_site_verification(request, site_id):
    """PUT/POST: Save Draft, Accept, or Reject for a SPECIFIC SITE."""
    if request.method not in ['PUT', 'POST']: 
        return JsonResponse({'error': 'Only PUT/POST allowed'}, status=405)

    site = get_object_or_404(Sites, site_id=site_id, is_active=True)
    user = get_user_from_token(request)

    try:
        data = json.loads(request.body)
        verification, created = SiteMetaDataVerification.objects.get_or_create(
            site=site, defaults={'status': 'draft', 'verified_by': user}
        )

        if 'verified_security_concerns' in data: 
            verification.verified_security_concerns = data['verified_security_concerns']
        if 'verified_accessibility' in data: 
            verification.verified_accessibility = data['verified_accessibility']
        if 'verified_land_classification_id' in data: 
            verification.verified_land_classification_id = data['verified_land_classification_id']
        if 'decision_note' in data: 
            verification.decision_note = data['decision_note']
        if 'status' in data: 
            verification.status = data['status']

        if verification.status in ['verified', 'rejected']:
            verification.verified_by = user
            verification.verified_at = timezone.now()

        verification.save()
        
        return JsonResponse({
            'message': f'Verification {verification.status}', 
            'status': verification.status,
            'verification_id': verification.id
        }, status=200)
    except Exception as e:
        logger.error(f"Update site verification error: {e}", exc_info=True)
        return JsonResponse({'error': str(e)}, status=500)




# ─────────────────────────────────────────────
# SITE PERMIT DOCUMENTS (MOVED FROM AREA)
# ─────────────────────────────────────────────
@csrf_exempt
def list_site_permits(request, site_id):
    if request.method != 'GET': 
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    site = get_object_or_404(Sites, site_id=site_id, is_active=True)
    permits = site.permit_documents.select_related('uploaded_by').order_by('-uploaded_at')

    data = [{
        'permit_id': p.permit_id, 
        'document_type': p.document_type,
        'permit_number': p.permit_number,
        'file_url': p.file.url if p.file else None, 
        'verification_notes': p.verification_notes,
        'uploaded_at': p.uploaded_at.isoformat(),
        'uploaded_by': p.uploaded_by.email if p.uploaded_by else None,
    } for p in permits]
    return JsonResponse({'data': data}, status=200)

@csrf_exempt
def upload_site_permit(request, site_id):
    if request.method != 'POST': 
        return JsonResponse({'error': 'Only POST allowed'}, status=405)
    site = get_object_or_404(Sites, site_id=site_id, is_active=True)
    user = get_user_from_token(request)
    
    document_type = request.POST.get('document_type')
    permit_number = request.POST.get('permit_number', '').strip()
    verification_notes = request.POST.get('verification_notes', '').strip()
    permit_file = request.FILES.get('file')
    
    if not document_type or not permit_file:
        return JsonResponse({'error': 'document_type and file are required'}, status=400)

    # ✅ Validate document type
    valid_types = [t[0] for t in PermitDocument.DOCUMENT_TYPES]
    if document_type not in valid_types:
        return JsonResponse({'error': f'Invalid document type. Allowed: {valid_types}'}, status=400)

    try:
        permit = PermitDocument.objects.create(
            site=site, 
            document_type=document_type,
            permit_number=permit_number or None,
            file=permit_file, 
            verification_notes=verification_notes or None,
            uploaded_by=user
        )
        return JsonResponse({
            'message': 'Permit uploaded', 
            'permit_id': permit.permit_id,
            'file_url': permit.file.url
        }, status=201)
    except Exception as e:
        logger.error(f"Upload site permit error: {e}", exc_info=True)
        return JsonResponse({'error': str(e)}, status=500)
# ✅ NEW: Delete Site Permit
@csrf_exempt
def delete_site_permit(request, permit_id):
    """DELETE: Remove a permit document from a site."""
    if request.method != 'DELETE': 
        return JsonResponse({'error': 'Only DELETE allowed'}, status=405)
    
    try:
        user = get_user_from_token(request)
        permit = get_object_or_404(PermitDocument, permit_id=permit_id)
        
        # Delete the file from storage
        if permit.file:
            try:
                permit.file.delete(save=False)
            except Exception as file_err:
                logger.warning(f"Could not delete file for permit {permit_id}: {file_err}")
        
        permit.delete()
        return JsonResponse({'message': 'Permit deleted'}, status=200)
    except Exception as e:
        logger.error(f"Delete site permit error: {e}", exc_info=True)
        return JsonResponse({'error': str(e)}, status=500)

# ─────────────────────────────────────────────
# GET ALL SITES (For Map Initialization)
# ─────────────────────────────────────────────
@csrf_exempt
def get_all_sites(request):
    """
    GET: Returns ALL active sites across all reforestation areas.
    Used by the main map to display site markers on startup.
    """
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    try:
        # Fetch all active sites
        sites = Sites.objects.filter(is_active=True).order_by("-created_at")
        
        data = []
        for s in sites:
            data.append({
                "site_id": s.site_id,
                "name": s.name,
                "status": s.status,
                "reforestation_area_id": s.reforestation_area_id,
                "center_coordinate": s.center_coordinate,
                "polygon_coordinates": s.polygon_coordinates,
                "total_area_hectares": s.total_area_hectares, # ✅ ADDED
                "ndvi_value": s.ndvi_value,                   # ✅ ADDED
                "created_at": s.created_at.strftime("%Y-%m-%d %H:%M:%S")
            })
            
        return JsonResponse({"data": data}, status=200)
    except Exception as e:
        logger.error(f"get_all_sites error: {e}", exc_info=True)
        return JsonResponse({"error": str(e)}, status=500)

# ─────────────────────────────────────────────
# ✅ NEW: UPDATE SITE COORDINATES (Polygon + Center)
# ─────────────────────────────────────────────
@csrf_exempt
def update_site_coordinates(request, site_id):
    """
    PUT/PATCH: Update both polygon_coordinates and center_coordinate for a site.
    
    Body:
    {
        "polygon_coordinates": [[lat, lng], ...] (optional),
        "center_coordinate": [lat, lng] (optional)
    }
    
    - If polygon is updated, area is recalculated
    - If center is not provided but polygon is updated, center is auto-calculated from polygon centroid
    - If only center is provided, only center is updated
    """
    if request.method not in ["PUT", "PATCH"]:
        return JsonResponse({"error": "PUT/PATCH only"}, status=405)
    
    try:
        body = json.loads(request.body)
        site = get_object_or_404(Sites, site_id=site_id, is_active=True)
        
        polygon_updated = False
        center_updated = False
        
        # ✅ Update polygon if provided
        if 'polygon_coordinates' in body:
            new_polygon = body['polygon_coordinates']
            
            # Validate polygon format
            if not isinstance(new_polygon, list):
                return JsonResponse({"error": "polygon_coordinates must be an array"}, status=400)
            
            if len(new_polygon) < 3:
                return JsonResponse({"error": "polygon_coordinates must have at least 3 points"}, status=400)
            
            # Validate each coordinate pair
            for i, coord in enumerate(new_polygon):
                if not isinstance(coord, (list, tuple)) or len(coord) != 2:
                    return JsonResponse({
                        "error": f"Invalid coordinate at index {i}. Expected [lat, lng]"
                    }, status=400)
                
                try:
                    lat, lng = float(coord[0]), float(coord[1])
                    # Basic validation for Philippines coordinates
                    if not (4 <= lat <= 21):
                        return JsonResponse({
                            "error": f"Invalid latitude at index {i}: {lat}. Must be between 4 and 21"
                        }, status=400)
                    if not (117 <= lng <= 127):
                        return JsonResponse({
                            "error": f"Invalid longitude at index {i}: {lng}. Must be between 117 and 127"
                        }, status=400)
                except (ValueError, TypeError):
                    return JsonResponse({
                        "error": f"Invalid coordinate values at index {i}"
                    }, status=400)
            
            site.polygon_coordinates = new_polygon
            site.total_area_hectares = site.calculate_area_from_polygon()
            polygon_updated = True
            
            logger.info(f"Site {site_id} polygon updated: {len(new_polygon)} vertices, area: {site.total_area_hectares} ha")
        
        # ✅ Update center if provided
        if 'center_coordinate' in body:
            new_center = body['center_coordinate']
            
            # Validate center format
            if not isinstance(new_center, (list, tuple)) or len(new_center) != 2:
                return JsonResponse({
                    "error": "center_coordinate must be [lat, lng]"
                }, status=400)
            
            try:
                lat, lng = float(new_center[0]), float(new_center[1])
                # Basic validation
                if not (4 <= lat <= 21):
                    return JsonResponse({
                        "error": f"Invalid center latitude: {lat}. Must be between 4 and 21"
                    }, status=400)
                if not (117 <= lng <= 127):
                    return JsonResponse({
                        "error": f"Invalid center longitude: {lng}. Must be between 117 and 127"
                    }, status=400)
            except (ValueError, TypeError):
                return JsonResponse({
                    "error": "Invalid center coordinate values"
                }, status=400)
            
            site.center_coordinate = new_center
            center_updated = True
            
            logger.info(f"Site {site_id} center updated: [{lat}, {lng}]")
        
        # ✅ If polygon was updated but center was not provided, auto-calculate center
        if polygon_updated and not center_updated:
            site.center_coordinate = site.calculate_centroid()
            center_updated = True
            logger.info(f"Site {site_id} center auto-calculated from polygon: {site.center_coordinate}")
        
        # ✅ Save if anything was updated
        if polygon_updated or center_updated:
            site.save()
            
            return JsonResponse({
                "message": "Site coordinates updated successfully",
                "site_id": site.site_id,
                "polygon_coordinates": site.polygon_coordinates,
                "center_coordinate": site.center_coordinate,
                "total_area_hectares": site.total_area_hectares,
                "polygon_updated": polygon_updated,
                "center_updated": center_updated
            }, status=200)
        else:
            return JsonResponse({
                "error": "No coordinates provided to update"
            }, status=400)
            
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON format"}, status=400)
    except Exception as e:
        logger.error(f"Update site coordinates error: {e}", exc_info=True)
        return JsonResponse({"error": str(e)}, status=500)

