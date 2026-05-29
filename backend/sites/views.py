import json
import logging
import math
from django.db import IntegrityError, transaction
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import get_object_or_404
from django.utils import timezone
from accounts.helper import get_user_from_token
from .models import Sites, Site_data, Site_species_recommendation, Site_images
from reforestation_areas.models import AreaMetaDataVerification, Reforestation_areas
from reforestation_areas.models import Reforestation_areas
from tree_species.models import Tree_species

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────
# ⚠️  IMPORTANT: Endpoints marked with [KEEP] are used by other modules
# ─────────────────────────────────────────────


# ─────────────────────────────────────────────
# [KEEP] GET SITES LIST - Used by dashboard/other modules
# ─────────────────────────────────────────────
@csrf_exempt
def get_sites(request, reforestation_area_id):
    """
    [KEEP] Returns sites with simplified validation status.
    Used by: Dashboard, Site List modules.
    """
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    search = request.GET.get("search", "").strip()
    entries = max(1, int(request.GET.get("entries", 10)))
    page = max(1, int(request.GET.get("page", 1)))
    status_filter = request.GET.get("status", "all").strip().lower()
    pinned_filter = request.GET.get("pinned_only", "").strip().lower()

    offset = (page - 1) * entries

    sites = Sites.objects.filter(
        reforestation_area_id=reforestation_area_id,
        is_active=True
    ).order_by("-is_pinned", "-created_at")

    if search:
        sites = sites.filter(name__icontains=search)
    if status_filter != "all":
        sites = sites.filter(status=status_filter)
    if pinned_filter == "true":
        sites = sites.filter(is_pinned=True)

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

        data.append({
            "site_id": s.site_id,
            "name": s.name,
            "status": s.status,
            "is_pinned": s.is_pinned,
            "validation": validation,
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
    """
    [KEEP] Returns full site details + validation data.
    Used by: Map drawing, Site Detail modules.
    """
    if request.method != "GET":
        return JsonResponse({"error": "GET only"}, status=405)

    site = get_object_or_404(Sites, site_id=site_id, is_active=True)
    current_sd = site.site_data_versions.filter(is_current=True).first()
    finalized_sd = site.site_data_versions.filter(is_current=False).order_by('-version').first()

    return JsonResponse({
        "site_id": site.site_id,
        "name": site.name,
        "status": site.status,
        "polygon_coordinates": site.polygon_coordinates,
        "center_coordinate": site.center_coordinate,
        "ndvi_value": site.ndvi_value,
        "area_hectares": site.total_area_hectares,
        "current_draft_mcda": current_sd.site_data if current_sd else {},
        "finalized_mcda": finalized_sd.site_data if finalized_sd else {},
        "species_recommendations": [
            {"id": r.tree_species.tree_specie_id, "name": r.tree_species.name, "rank": r.priority_rank, "notes": r.notes}
            for r in site.species_recommendations.order_by('priority_rank')
        ]
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
# [KEEP] CREATE SITE - Core functionality (FIXED)
# ─────────────────────────────────────────────
@csrf_exempt
def create_site(request):
    """
    [KEEP] Create new site WITHIN an existing reforestation area.
    Prerequisite: Parent area must have verified meta data (status = 'verified').
    """
    if request.method != "POST":
        return JsonResponse({"error": "POST only"}, status=405)
    
    try:
        body = json.loads(request.body)
        name = body.get('name', '').strip()
        reforestation_area_id = body.get('reforestation_area_id')
        
        if not name or not reforestation_area_id:
            return JsonResponse({
                "error": "name and reforestation_area_id are required"
            }, status=400)

        # ✅ Verify parent reforestation area exists
        reforestation_area = get_object_or_404(
            Reforestation_areas, 
            reforestation_area_id=reforestation_area_id
        )
        
        # ✅ Check if area has verified meta data (prerequisite for site creation)
        try:
            # Access via reverse OneToOne relation: area.meta_verification
            meta_verification = reforestation_area.meta_verification
            if meta_verification.status != 'verified':
                return JsonResponse({
                    "error": f"Cannot create site: Parent area meta data must be verified first (current status: {meta_verification.status})"
                }, status=400)
        except AreaMetaDataVerification.DoesNotExist:  # ← Correct exception
            return JsonResponse({
                "error": "Cannot create site: Parent area has no meta data verification record. Please verify area meta data first."
            }, status=400)

        with transaction.atomic():
            site = Sites.objects.create(
                reforestation_area=reforestation_area,
                name=name,
                status='pending',
                is_active=True,
                is_pinned=body.get('is_pinned', False),
                polygon_coordinates=body.get('polygon_coordinates'),
                center_coordinate=body.get('center_coordinate'),
                ndvi_value=body.get('ndvi_value'),
                total_area_hectares=body.get('total_area_hectares', 0.0),
            )
            
            if site.polygon_coordinates:
                site.total_area_hectares = site.calculate_area_from_polygon()
                site.center_coordinate = site.calculate_centroid()
                site.save()

            Site_data.objects.create(
                site=site, 
                version=1, 
                is_current=True, 
                site_data={}, 
                field_assessment_snapshot={}
            )

        return JsonResponse({
            "message": "Site created successfully", 
            "site_id": site.site_id,
            "reforestation_area_id": reforestation_area.reforestation_area_id,
            "reforestation_area_name": reforestation_area.name,
            "status": site.status
        }, status=201)
        
    except IntegrityError:
        return JsonResponse({
            "error": "Site name already exists in this area. Please choose a different name."
        }, status=409)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON format"}, status=400)
    except Exception as e:
        logger.error(f"create_site: {e}", exc_info=True)
        return JsonResponse({"error": f"Internal server error: {str(e)}"}, status=500)

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
@csrf_exempt
def get_sites_list(request, reforestation_area_id):
    """
    [KEEP - DO NOT REMOVE] Alternative site list endpoint.
    Used by: Another module (confirm which one before removing).
    """
    if request.method != "GET":
        return JsonResponse({"error": "GET only"}, status=405)

    search = request.GET.get("search", "").strip()
    status_filter = request.GET.get("status", "all").strip().lower()

    sites = Sites.objects.filter(
        reforestation_area_id=reforestation_area_id, 
        is_active=True
    ).order_by("-is_pinned", "-created_at")
    
    if search: 
        sites = sites.filter(name__icontains=search)
    if status_filter != "all": 
        sites = sites.filter(status=status_filter)

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

        data.append({
            "site_id": s.site_id,
            "name": s.name,
            "status": s.status,
            "is_pinned": s.is_pinned,
            "area_hectares": s.total_area_hectares,
            "ndvi": s.ndvi_value,
            "validation": validation,
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