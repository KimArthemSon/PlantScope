import json
import logging
import math
from django.db import IntegrityError, transaction
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import get_object_or_404
from django.utils import timezone
from .models import Sites, Site_data, Site_species_recommendation, Site_images
from reforestation_areas.models import Reforestation_areas
from tree_species.models import Tree_species

logger = logging.getLogger(__name__)

# ✅ PLANTSCOPE v5.0: 3-Layer MCDA Framework
ALLOWED_LAYERS = ['safety', 'boundary_verification', 'survivability']

# ✅ Acceptance Decision Enums (v5.0)
ACCEPTANCE_CHOICES = [
    'ACCEPT',
    'REJECT',
    'ACCEPT_WITH_MITIGATION',   # Safety layer
    'ACCEPT_WITH_ADJUSTMENT',   # Boundary layer
    'ACCEPT_WITH_CONDITIONS',   # Survivability layer
]

# ==========================================
# 1. INSPECTOR: Submit Raw Field Assessment
# ==========================================
@csrf_exempt
def submit_field_assessment(request, site_id, layer_name):
    """
    POST: Onsite Inspector submits raw observational data for a specific MCDA layer.
    Payload: { "field_assessment_data": {...} }
    """
    if request.method != "POST":
        return JsonResponse({"error": "Only POST allowed"}, status=405)
    if layer_name not in ALLOWED_LAYERS:
        return JsonResponse({"error": f"Invalid layer. Must be one of: {ALLOWED_LAYERS}"}, status=400)

    try:
        body = json.loads(request.body)
        field_assessment_data = body.get("field_assessment_data")
        inspector_comment = body.get("inspector_comment", "")

        if not field_assessment_data:
            return JsonResponse({"error": "field_assessment_data is required"}, status=400)

        site = get_object_or_404(Sites, site_id=site_id, is_active=True)
        
        # Auto-transition workflow state
        if site.status == 'pending':
            site.status = 'under_review'
            site.save()

        # Get or create current Site_data record
        site_data_obj, _ = Site_data.objects.get_or_create(
            site=site,
            is_current=True,
            defaults={"site_data": {}, "field_assessment_snapshot": {}}
        )

        # Store raw inspector data snapshot
        if not site_data_obj.field_assessment_snapshot:
            site_data_obj.field_assessment_snapshot = {}
        
        site_data_obj.field_assessment_snapshot[layer_name] = {
            "data": field_assessment_data,
            "inspector_comment": inspector_comment,
            "submitted_at": timezone.now().isoformat()
        }
        site_data_obj.save()

        return JsonResponse({
            "message": f"Field assessment for '{layer_name}' saved.",
            "site_id": site.site_id,
            "layer": layer_name
        }, status=200)
        
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON format"}, status=400)
    except Exception as e:
        logger.error(f"submit_field_assessment error: {e}", exc_info=True)
        return JsonResponse({"error": "Internal server error"}, status=500)


# ==========================================
# 2. GIS SPECIALIST: Validate Layer (Manual Decision)
# ==========================================
@csrf_exempt
def validate_mcda_layer(request, site_id, layer_name):
    """
    POST: GIS Specialist reviews inspector data and makes manual ACCEPT/REJECT decision.
    Payload: {
        "acceptance": "ACCEPT|REJECT|ACCEPT_WITH_MITIGATION|...",
        "validation_notes": "...",
        "mitigation_required": [...],  // optional
        "species_recommendations": [...] // for survivability layer
    }
    """
    if request.method != "POST":
        return JsonResponse({"error": "Only POST allowed"}, status=405)
    if layer_name not in ALLOWED_LAYERS:
        return JsonResponse({"error": f"Invalid layer. Must be one of: {ALLOWED_LAYERS}"}, status=400)

    try:
        body = json.loads(request.body)
        acceptance = body.get("acceptance", "").strip().upper()
        validation_notes = body.get("validation_notes", "")
        
        if acceptance not in ACCEPTANCE_CHOICES:
            return JsonResponse({"error": f"Invalid acceptance. Must be one of: {ACCEPTANCE_CHOICES}"}, status=400)

        site = get_object_or_404(Sites, site_id=site_id, is_active=True)
        site_data_obj = get_object_or_404(Site_data, site=site, is_current=True)

        if not site_data_obj.site_data:
            site_data_obj.site_data = {}

        # Build layer validation record per v5.0 schema
        layer_validation = {
            "acceptance": acceptance,
            "validation_notes": validation_notes,
            "validated_at": timezone.now().isoformat(),
            "validated_by": body.get("validated_by", "GIS-SPECIALIST"),
        }
        
        # Add layer-specific optional fields
        if acceptance in ["ACCEPT_WITH_MITIGATION", "ACCEPT_WITH_ADJUSTMENT", "ACCEPT_WITH_CONDITIONS"]:
            if "mitigation_required" in body:
                layer_validation["mitigation_required"] = body["mitigation_required"]
            if "adjustment_notes" in body:
                layer_validation["adjustment_notes"] = body["adjustment_notes"]
            if "conditions" in body:
                layer_validation["conditions"] = body["conditions"]
        
        # Survivability layer: species recommendations
        if layer_name == "survivability" and "species_recommendations" in body:
            layer_validation["species_recommendations"] = body["species_recommendations"]

        # Save to site_data JSON
        site_data_obj.site_data[layer_name] = layer_validation
        site_data_obj.save()

        return JsonResponse({
            "message": f"Layer '{layer_name}' validated as {acceptance}.",
            "layer": layer_name,
            "acceptance": acceptance
        }, status=200)
        
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON format"}, status=400)
    except Exception as e:
        logger.error(f"validate_mcda_layer error: {e}", exc_info=True)
        return JsonResponse({"error": "Internal server error"}, status=500)


# ==========================================
# 3. FINALIZE SITE: Lock Version & Set Status (v5.0 Cascade Logic)
# ==========================================
@csrf_exempt
def finalize_site_mcda(request, site_id):
    """
    POST: Verifies all 3 layers are validated, applies v5.0 approval cascade,
    locks the record (is_current=false for old version), and updates site status.
    
    Approval Cascade (v5.0):
    - If ANY layer = REJECT → Site REJECTED
    - Else → Site ACCEPTED (with conditions if any layer is CONDITIONAL)
    """
    if request.method != "POST":
        return JsonResponse({"error": "Only POST allowed"}, status=405)

    try:
        body = json.loads(request.body)
        validated_by = body.get("validated_by", "GIS-SPECIALIST")

        site = get_object_or_404(Sites, site_id=site_id, is_active=True)
        site_data_obj = get_object_or_404(Site_data, site=site, is_current=True)

        layers_data = site_data_obj.site_data or {}
        
        # Check all 3 layers have decisions
        missing_layers = [
            l for l in ALLOWED_LAYERS 
            if l not in layers_data or not layers_data[l].get("acceptance")
        ]
        if missing_layers:
            return JsonResponse({
                "error": f"Incomplete validation. Missing decisions for: {missing_layers}",
                "missing_layers": missing_layers
            }, status=400)

        # ✅ v5.0 Approval Cascade Logic
        final_status = "accepted"
        rejection_reason = None
        
        for layer_name in ALLOWED_LAYERS:
            layer = layers_data[layer_name]
            acceptance = layer.get("acceptance")
            
            if acceptance == "REJECT":
                final_status = "rejected"
                rejection_reason = f"{layer_name} layer rejected: {layer.get('validation_notes', 'No reason provided')}"
                break  # First REJECT wins
        
        # If not rejected, check for conditional acceptances
        if final_status == "accepted":
            has_conditions = any(
                layers_data[l].get("acceptance") in 
                ["ACCEPT_WITH_MITIGATION", "ACCEPT_WITH_ADJUSTMENT", "ACCEPT_WITH_CONDITIONS"]
                for l in ALLOWED_LAYERS
            )
            if has_conditions:
                final_status = "accepted"  # Still accepted, but with conditions noted

        # Archive current version (create new version for future edits)
        site_data_obj.is_current = False
        site_data_obj.validated_by = validated_by
        site_data_obj.validated_at = timezone.now()
        site_data_obj.save()
        
        # Create new current version (empty, ready for re-assessment if needed)
        Site_data.objects.create(
            site=site,
            version=site_data_obj.version + 1,
            is_current=True,
            site_data={},
            field_assessment_snapshot={},
            created_by=validated_by
        )

        # Update site status
        site.status = final_status
        if rejection_reason:
            site.save(update_fields=['status'])  # Could add rejection_reason field if needed
        else:
            site.save()

        return JsonResponse({
            "message": "Site MCDA finalized and locked.",
            "site_id": site.site_id,
            "site_status": site.status,
            "rejection_reason": rejection_reason,
            "archived_version": site_data_obj.version,
            "new_version": site_data_obj.version + 1
        }, status=200)
        
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON format"}, status=400)
    except Exception as e:
        logger.error(f"finalize_site_mcda error: {e}", exc_info=True)
        return JsonResponse({"error": "Internal server error"}, status=500)


# ==========================================
# 4. LIST SITES (Dashboard View)
# ==========================================
@csrf_exempt
def get_sites(request, reforestation_area_id):
    """GET: List sites for a reforestation area with validation progress."""
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
        # Get current site_data for validation progress
        current_sd = s.site_data_versions.filter(is_current=False).first()  # Archived = finalized
        validated_count = 0
        rejected_count = 0
        layer_status = {}
        
        if current_sd and current_sd.site_data:
            for layer_name in ALLOWED_LAYERS:
                layer = current_sd.site_data.get(layer_name, {})
                acceptance = layer.get("acceptance")
                if acceptance:
                    validated_count += 1
                    layer_status[layer_name] = acceptance
                    if acceptance == "REJECT":
                        rejected_count += 1

        data.append({
            "site_id": s.site_id,
            "name": s.name,
            "status": s.status,
            "is_pinned": s.is_pinned,
            "validation_progress": {
                "validated_layers": validated_count,
                "total_layers": len(ALLOWED_LAYERS),
                "rejected_layers": rejected_count,
                "layer_status": layer_status,  # {safety: "ACCEPT", boundary: "REJECT", ...}
                "is_complete": validated_count == len(ALLOWED_LAYERS)
            },
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


# ==========================================
# 5. GET SINGLE SITE DETAILS (Full MCDA Data)
# ==========================================
@csrf_exempt
def get_site(request, site_id):
    """GET: Full site details including finalized MCDA data and inspector snapshots."""
    if request.method != "GET":
        return JsonResponse({"error": "Only GET allowed"}, status=405)

    site = get_object_or_404(Sites, site_id=site_id)
    
    # Get archived (finalized) site_data
    finalized_sd = site.site_data_versions.filter(is_current=False).order_by('-version').first()
    # Get current (draft) site_data if exists
    current_sd = site.site_data_versions.filter(is_current=True).first()

    response = {
        "site_id": site.site_id,
        "name": site.name,
        "status": site.status,
        "is_pinned": site.is_pinned,
        "center_coordinate": site.center_coordinate,
        "polygon_coordinates": site.polygon_coordinates,
        "marker_coordinate": site.marker_coordinate,
        "ndvi_value": site.ndvi_value,
        "total_area_hectares": site.total_area_hectares,
        "total_seedlings_planted": site.total_seedlings_planted,
        "created_at": site.created_at.strftime("%Y-%m-%d %H:%M:%S"),
        
        # Finalized MCDA results (read-only)
        "finalized_mcda_data": finalized_sd.site_data if finalized_sd else {},
        "finalized_validation_info": {
            "validated_by": finalized_sd.validated_by if finalized_sd else None,
            "validated_at": finalized_sd.validated_at.isoformat() if finalized_sd and finalized_sd.validated_at else None,
            "version": finalized_sd.version if finalized_sd else None,
        } if finalized_sd else None,
        
        # Draft MCDA work-in-progress (editable)
        "draft_mcda_data": current_sd.site_data if current_sd and current_sd.is_current else {},
        
        # Inspector raw data snapshots (reference only)
        "inspector_snapshots": finalized_sd.field_assessment_snapshot if finalized_sd else {},
        
        # Species recommendations
        "species_recommendations": [
            {
                "species_id": rec.tree_species.tree_specie_id if rec.tree_species else None,
                "species_name": rec.tree_species.name if rec.tree_species else "Unknown",
                "priority_rank": rec.priority_rank,
                "notes": rec.notes,
            }
            for rec in site.species_recommendations.order_by('priority_rank')
        ],
    }
    return JsonResponse({"data": response}, status=200)


# ==========================================
# 6. CREATE SITE (With Parent Area Gate Check)
# ==========================================
@csrf_exempt
def create_site(request):
    """
    POST: Create new site. 
    ⚠️  Gate: Parent Reforestation Area must have pre_assessment_status = 'approved'
    """
    if request.method != "POST":
        return JsonResponse({"error": "Only POST allowed"}, status=405)
    
    try:
        body = json.loads(request.body)
        if 'name' not in body or not body['name'].strip():
            return JsonResponse({"error": "Field 'name' is required"}, status=400)
        if 'reforestation_area_id' not in body:
            return JsonResponse({"error": "Field 'reforestation_area_id' is required"}, status=400)
        
        area = get_object_or_404(Reforestation_areas, reforestation_area_id=body['reforestation_area_id'])
        
        # ✅ v5.0 Gate: Only allow site creation if area is approved
        if area.pre_assessment_status != "approved":
            return JsonResponse({
                "error": "Cannot create site: Parent area pre-assessment is not approved.",
                "area_status": area.pre_assessment_status
            }, status=400)
        
        with transaction.atomic():
            site = Sites.objects.create(
                reforestation_area=area,
                name=body['name'].strip(),
                status='pending',
                is_active=True,
                is_pinned=body.get('is_pinned', False),
                center_coordinate=body.get("center_coordinate", [0.0, 0.0]),
                polygon_coordinates=body.get("polygon_coordinates", []),
                marker_coordinate=body.get("marker_coordinate"),
                ndvi_value=body.get("ndvi_value"),
                total_area_hectares=body.get("total_area_hectares", 0.0),
                total_seedlings_planted=body.get("total_seedlings_planted", 0),
            )
            
            # Initialize empty MCDA structures per v5.0
            Site_data.objects.create(
                site=site, 
                version=1,
                is_current=True, 
                site_data={}, 
                field_assessment_snapshot={}
            )

        return JsonResponse({"message": "Site created successfully.", "site_id": site.site_id}, status=201)
        
    except IntegrityError:
        return JsonResponse({"error": "A site with this name already exists in this area"}, status=409)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON format"}, status=400)
    except Exception as e:
        logger.error(f"create_site error: {e}", exc_info=True)
        return JsonResponse({"error": "Internal server error"}, status=500)


# ==========================================
# 7. TOGGLE PIN (Dashboard Priority)
# ==========================================
@csrf_exempt
def toggle_pin(request, site_id):
    """POST/PUT: Toggle the is_pinned boolean for dashboard prioritization."""
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


# ==========================================
# 8. UPDATE SITE SPECIES RECOMMENDATIONS
# ==========================================
@csrf_exempt
def update_species_recommendations(request, site_id):
    """
    POST: GIS Specialist updates recommended tree species for a site.
    Payload: { "species": [{"tree_species_id": 123, "priority_rank": 1, "notes": "..."}, ...] }
    """
    if request.method != "POST":
        return JsonResponse({"error": "Only POST allowed"}, status=405)
    
    try:
        body = json.loads(request.body)
        site = get_object_or_404(Sites, site_id=site_id, is_active=True)
        species_list = body.get("species", [])
        
        if not isinstance(species_list, list):
            return JsonResponse({"error": "'species' must be an array"}, status=400)
        
        with transaction.atomic():
            # Clear existing recommendations
            site.species_recommendations.all().delete()
            
            # Add new recommendations
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


# ==========================================
# UTILITY ENDPOINTS (Preserved)
# ==========================================
@csrf_exempt
def update_site(request, site_id):
    if request.method not in ['POST', 'PUT']:
        return JsonResponse({'error': 'Only POST/PUT allowed'}, status=405)
    try:
        data = json.loads(request.body)
        site = get_object_or_404(Sites, site_id=site_id)
        if "name" in data:
            site.name = data["name"]
        if "status" in data and data["status"] in dict(Sites.STATUS_CHOICES):
            site.status = data["status"]
        site.save()
        return JsonResponse({"message": "Site updated successfully"})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)

@csrf_exempt
def delete_site(request, site_id):
    if request.method != 'DELETE':
        return JsonResponse({'error': 'Only DELETE allowed'}, status=405)
    site = get_object_or_404(Sites, site_id=site_id)
    site.is_active = False  # Soft delete
    site.save()
    return JsonResponse({"message": "Site deactivated successfully"})

@csrf_exempt
def update_site_coordinates(request):
    if request.method not in ["PUT", "POST"]:
        return JsonResponse({"error": "Invalid method"}, status=405)
    try:
        data = json.loads(request.body)
        site = get_object_or_404(Sites, site_id=data.get("site_id"))
        if data.get("center_coordinate"):
            site.center_coordinate = data["center_coordinate"]
        if data.get("polygon_coordinates"):
            site.polygon_coordinates = data["polygon_coordinates"]
        if data.get("marker_coordinate"):
            site.marker_coordinate = data["marker_coordinate"]
        if data.get("ndvi_value") is not None:
            site.ndvi_value = data["ndvi_value"]
        if data.get("total_area_hectares") is not None:
            site.total_area_hectares = data["total_area_hectares"]
        site.save()
        return JsonResponse({"message": "Coordinates & metrics updated"})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)