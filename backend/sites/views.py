import json
import logging
from django.db import IntegrityError, transaction
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import get_object_or_404
import math
from django.utils import timezone
from .models import Sites, Site_data, Site_details, Site_images
from reforestation_areas.models import Reforestation_areas
from soils.models import Soils
from tree_species.models import Tree_species
from mcda_weight_config.models import McdaWeightsConfig

logger = logging.getLogger(__name__)

# ==========================================
# MCDA SCORING ENGINE HELPERS
# ==========================================

ALLOWED_LAYERS = [
    'safety', 'legality', 'slope', 'soil_quality', 
    'accessibility', 'hydrology', 
    'wildlife_status', 'tree_species_suitability'
]

def find_nested_value(data, target_key):
    """Recursively search for a key in nested dictionaries."""
    if isinstance(data, dict):
        if target_key in data:
            return data[target_key]
        for value in data.values():
            result = find_nested_value(value, target_key)
            if result is not None:
                return result
    return None

def calculate_layer_result(layer_name, final_agreed_data, config):
    """Dynamically calculate scores based on McdaWeightsConfig."""
    rules_json = config.scoring_rules
    input_field = rules_json.get("input_field")
    rules = rules_json.get("rules", [])
    
    # Find the actual input value from the submitted data
    input_value = find_nested_value(final_agreed_data, input_field)
    if input_value is None:
        raise ValueError(f"Missing required field '{input_field}' for layer '{layer_name}'")
    
    # Match against scoring rules
    matched_rule = None
    for rule in rules:
        if str(rule["status_input"]).strip().lower() == str(input_value).strip().lower():
            matched_rule = rule
            break
        print(str(rule["status_input"]).strip().lower(), "asss")
            
    if not matched_rule:
        raise ValueError(f"No scoring rule found for input value: '{input_value}' in layer '{layer_name}'")
    
    # Calculate scores
    normalized_score = matched_rule["normalized_score"]
    weight_pct = float(config.weight_percentage)
    weighted_score = round(normalized_score * (weight_pct / 100.0), 2)
    is_veto = matched_rule.get("is_veto", False)
    
    # Generate dynamic remarks & mitigations (fallback to config or defaults)
    verdict = matched_rule["verdict"]
    remark = matched_rule.get("remark", f"Scored {normalized_score} based on {input_field}={input_value}")
    mitigation = matched_rule.get("derived_mitigation", "Standard monitoring required.")
    
    # Allow inspector comments to append to mitigation/remark
    comment_keys = [k for k in final_agreed_data.keys() if "comment" in k.lower()]
    for ck in comment_keys:
        val = final_agreed_data[ck]
        if val:
            remark += f" Inspector Note: {val}"
            mitigation += f" Address: {val}"

    return {
        "normalized_score": normalized_score,
        "weight_percentage": weight_pct,
        "weighted_score": weighted_score,
        "status_input": str(input_value),
        "verdict": verdict,
        "critical_flag": is_veto,
        "remark": remark.strip(),
        "derived_mitigation": mitigation.strip()
    }


# ==========================================
# ENDPOINT 1: SUBMIT LAYER DATA
# ==========================================
@csrf_exempt
def submit_mcda_layer(request, site_id, layer_name):
    if request.method != "POST":
        return JsonResponse({"error": "Only POST allowed"}, status=405)

    if layer_name not in ALLOWED_LAYERS:
        return JsonResponse({"error": f"Invalid layer. Must be one of: {ALLOWED_LAYERS}"}, status=400)

    try:
        body = json.loads(request.body)
        final_agreed_data = body.get("final_agreed_data")
        leader_comment = body.get("leader_comment", "")
        print(final_agreed_data, "sdsdasd")
        if not final_agreed_data:
            return JsonResponse({"error": "final_agreed_data is required"}, status=400)

        site = get_object_or_404(Sites, site_id=site_id, isActive=True)
        config = McdaWeightsConfig.objects.filter(layer_name=layer_name, is_active=True).first()
        if not config:
            return JsonResponse({"error": f"Active MCDA config not found for layer '{layer_name}'"}, status=404)

        # Calculate result dynamically
        result_data = calculate_layer_result(layer_name, final_agreed_data, config)

        # Build layer payload
        layer_payload = {
            "final_agreed_data": final_agreed_data,
            "leader_comment": leader_comment,
            "result": result_data,
            "submitted_at": timezone.now().isoformat()
        }

        with transaction.atomic():
            # Get or create Site_data
            site_data_obj, created = Site_data.objects.get_or_create(
                site=site,
                defaults={"is_current": True, "site_data": {"layers": {}, "meta_info": {}}, "score": 0.0}
            )
            
            # Ensure structure exists
            if not site_data_obj.site_data:
                site_data_obj.site_data = {"layers": {}, "meta_info": {}}
            if "layers" not in site_data_obj.site_data:
                site_data_obj.site_data["layers"] = {}
                
            # Merge/Update layer
            site_data_obj.site_data["layers"][layer_name] = layer_payload
            site_data_obj.save()

        return JsonResponse({
            "message": f"Layer '{layer_name}' submitted successfully.",
            "layer": layer_name,
            "result": result_data
        }, status=200)

    except ValueError as ve:
        return JsonResponse({"error": str(ve)}, status=400)
    except Exception as e:
        logger.error(f"submit_mcda_layer error: {str(e)}", exc_info=True)
        return JsonResponse({"error": "Internal server error"}, status=500)


# ==========================================
# ENDPOINT 2: FINALIZE SITE MCDA
# ==========================================
@csrf_exempt
def finalize_site_mcda(request, site_id):
    if request.method != "POST":
        return JsonResponse({"error": "Only POST allowed"}, status=405)

    try:
        body = json.loads(request.body)
        consensus_note = body.get("consensus_note", "Finalized by Project Leader.")
        
        site = get_object_or_404(Sites, site_id=site_id, isActive=True)
        site_data_obj = get_object_or_404(Site_data, site=site, is_current=True)
        
        layers_data = site_data_obj.site_data.get("layers", {})
        
        # 1. Validate all 8 layers are present
        missing_layers = [l for l in ALLOWED_LAYERS if l not in layers_data]
        if missing_layers:
            return JsonResponse({
                "error": f"Incomplete assessment. Missing layers: {missing_layers}",
                "missing_layers": missing_layers
            }, status=400)

        # 2. Aggregate scores & check vetoes
        total_weighted_score = 0.0
        critical_veto_triggered = False
        priority_actions = []
        
        for layer_name, layer_obj in layers_data.items():
            result = layer_obj.get("result", {})
            total_weighted_score += result.get("weighted_score", 0.0)
            
            if result.get("critical_flag", False):
                critical_veto_triggered = True
                
            # Collect mitigations as priority actions
            mitigation = result.get("derived_mitigation")
            if mitigation and mitigation.lower() != "none.":
                priority_actions.append(f"[{layer_name.replace('_', ' ').title()}] {mitigation}")

        total_weighted_score = round(total_weighted_score, 2)

        # 3. Determine Classification & Color
        if critical_veto_triggered:
            classification = "NOT_SUITABLE"
            color_code = "#FF0000"
            final_decision = "REJECTED"
        elif total_weighted_score >= 85:
            classification = "HIGHLY_SUITABLE"
            color_code = "#2E8B57"
            final_decision = "APPROVED_FOR_REFORESTATION"
        elif total_weighted_score >= 60:
            classification = "MODERATELY_SUITABLE"
            color_code = "#FFD700"
            final_decision = "APPROVED_WITH_MITIGATIONS"
        else:
            classification = "MARGINALLY_SUITABLE"
            color_code = "#FFA500"
            final_decision = "NEEDS_RE_EVALUATION"

        # 4. Estimate survival rate based on score
        if total_weighted_score >= 85: survival_rate = "85% - 90%"
        elif total_weighted_score >= 60: survival_rate = "70% - 84%"
        elif total_weighted_score >= 40: survival_rate = "50% - 69%"
        else: survival_rate = "< 50%"

        # 5. Build Final Summary
        final_summary = {
            "total_weighted_score": total_weighted_score,
            "suitability_classification": classification,
            "final_decision": final_decision,
            "priority_actions": priority_actions[:5], # Top 5 actions
            "estimated_survival_rate": survival_rate,
            "public_map_color_code": color_code
        }

        # 6. Update Site Data JSON
        with transaction.atomic():
            site_data_obj.site_data["final_site_summary"] = final_summary
            site_data_obj.site_data["meta_info"] = {
                "finalized_date": timezone.now().isoformat(),
                "finalized_by_role": "Project Leader",
                "consensus_note": consensus_note
            }
            site_data_obj.score = total_weighted_score
            site_data_obj.suitability_classification = classification
            site_data_obj.save()

            # Optionally update Site status (keep as pending_approval or move to official)
            site.status = "official" if final_decision.startswith("APPROVED") else "pending_approval"
            site.save()

        return JsonResponse({
            "message": "Site MCDA finalized successfully.",
            "summary": final_summary,
            "site_status": site.status
        }, status=200)

    except Exception as e:
        logger.error(f"finalize_site_mcda error: {str(e)}", exc_info=True)
        return JsonResponse({"error": "Internal server error"}, status=500)


# ==========================================
# EXISTING ENDPOINTS (Preserved & Slightly Optimized)
# ==========================================

@csrf_exempt
def get_sites(request, reforestation_area_id):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    search = request.GET.get("search", "").strip()
    entries = int(request.GET.get("entries", 10))
    page = int(request.GET.get("page", 1))
    status_filter = request.GET.get("status", "all").strip().lower()

    if entries <= 0: entries = 10
    if page <= 0: page = 1
    offset = (page - 1) * entries

    sites = Sites.objects.filter(
        reforestation_area_id=reforestation_area_id,
        isActive=True
    ).order_by("-created_at")

    if search:
        sites = sites.filter(name__icontains=search)
    if status_filter != "all":
        sites = sites.filter(status=status_filter)

    total = sites.count()
    total_page = math.ceil(total / entries) if total > 0 else 1
    sites = sites[offset: offset + entries]

    data = []
    for s in sites:
        completed = 0
        rejected = 0
        total_score = 0.0
        
        sd = getattr(s, 'site_data', None)
        if sd and sd.site_data:
            layers = sd.site_data.get("layers", {})
            for key in ALLOWED_LAYERS:
                if key in layers:
                    verdict = layers[key].get("result", {}).get("verdict", "")
                    if verdict in ["PASS", "PASS_WITH_MITIGATION", "HIGHLY_SUITABLE", "OPTIMIZED"]:
                        completed += 1
                    elif verdict in ["AUTO_REJECT", "FAIL"]:
                        rejected += 1
            
            summary = sd.site_data.get("final_site_summary", {})
            total_score = summary.get("total_weighted_score", 0.0)

        data.append({
            "site_id": s.site_id,
            "name": s.name,
            "status": s.status,
            "created_at": s.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            "progress": { "completed": completed, "rejected": rejected, "total": len(ALLOWED_LAYERS) },
            "metrics": { "survival_rate": float(total_score), "total_score": float(total_score) }
        })

    return JsonResponse({ "data": data, "total_page": total_page, "page": page, "entries": entries, "total": total }, status=200)

@csrf_exempt
def get_site(request, site_id):
    if request.method != "GET":
        return JsonResponse({"error": "Only GET allowed"}, status=405)

    site = get_object_or_404(Sites, site_id=site_id)
    site_data_obj = getattr(site, 'site_data', None)
    details = getattr(site, 'site_details', None)
    
    response = {
        "site_id": site.site_id,
        "name": site.name,
        "status": site.status,
        "coordinates": site.center_coordinate,
        "polygon_coordinates": site.polygon_coordinates,
        "marker_coordinate": site.marker_coordinate,
        "total_area_planted": site.total_area_planted,
        "total_seedling_planted": site.total_seedling_planted,
        "created_at": site.created_at.strftime("%Y-%m-%d %H:%M:%S"),
        "mcda_data": site_data_obj.site_data if site_data_obj else {},
        "site_details": {
            "soil_id": details.soil.soil_id if details and details.soil else None,
            "soil_name": details.soil.name if details and details.soil else None,
            "tree_species_id": details.tree_species.tree_species_id if details and details.tree_species else None,
            "tree_species_name": details.tree_species.name if details and details.tree_species else None,
        } if details else None
    }
    return JsonResponse({"data": response}, status=200)

@csrf_exempt
def create_site(request):
    if request.method != "POST":
        return JsonResponse({"error": "Only POST allowed"}, status=405)
    
    try:
        body = json.loads(request.body)
        if 'name' not in body or not body['name'].strip():
            return JsonResponse({"error": "Field 'name' is required"}, status=400)
        if 'reforestation_area_id' not in body:
            return JsonResponse({"error": "Field 'reforestation_area_id' is required"}, status=400)
        
        area = get_object_or_404(Reforestation_areas, reforestation_area_id=body['reforestation_area_id'])
        
        with transaction.atomic():
            site = Sites.objects.create(
                reforestation_area=area,
                name=body['name'].strip(),
                status='pending',
                isActive=True,
                center_coordinate=[0.0, 0.0],
                polygon_coordinates=[],
                marker_coordinate=None,
                total_area_planted=0.0,
                total_seedling_planted=0,
            )
            # Initialize with proper structure
            Site_data.objects.create(
                site=site, 
                is_current=True, 
                site_data={"layers": {}, "meta_info": {}}, 
                score=0.0, 
                suitability_classification=None
            )
            Site_details.objects.create(site=site, soil=None, tree_species=None)

        return JsonResponse({"message": "Site created successfully.", "site_id": site.site_id}, status=201)
        
    except IntegrityError:
        return JsonResponse({"error": "A site with this name already exists in this area"}, status=409)
    except Exception as e:
        logger.error(f"create_site error: {str(e)}", exc_info=True)
        return JsonResponse({"error": "Internal server error"}, status=500)

@csrf_exempt
def update_site(request, site_id):
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)
    try:
        data = json.loads(request.body)
        if "name" not in data:
            return JsonResponse({"error": "Name is required"}, status=400)
        site = get_object_or_404(Sites, site_id=site_id)
        site.name = data["name"]
        site.save()
        return JsonResponse({"message": "Site name updated successfully"})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)

@csrf_exempt
def delete_site(request, site_id):
    if request.method != 'DELETE':
        return JsonResponse({'error': 'Only DELETE allowed'}, status=405)
    site = get_object_or_404(Sites, site_id=site_id)
    site.delete()
    return JsonResponse({"message": "Site deleted successfully"})

@csrf_exempt
def update_site_coordinates(request):
    if request.method != "PUT":
        return JsonResponse({"error": "Invalid method"}, status=405)
    try:
        data = json.loads(request.body)
        site = Sites.objects.get(site_id=data.get("site_id"))
        if data.get("center_coordinate"): site.center_coordinate = data["center_coordinate"]
        if data.get("polygon_coordinates"): site.polygon_coordinates = data["polygon_coordinates"]
        if data.get("marker_coordinate"): site.marker_coordinate = data["marker_coordinate"]
        site.save()
        return JsonResponse({"message": "Coordinates updated"})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)

@csrf_exempt
def update_site_details(request, site_id):
    """
    POST: Update relational Site_details (soil_id, tree_species_id)
    Payload: { "soil_id": 123, "tree_species_id": 456 }
    Pass null to clear a field.
    """
    if request.method != "POST":
        return JsonResponse({"error": "Only POST allowed"}, status=405)

    try:
        body = json.loads(request.body)
        site = get_object_or_404(Sites, site_id=site_id)
        
        # Get or create details record
        details, created = Site_details.objects.get_or_create(site=site)
        updated_fields = []

        # Handle Soil
        if "soil_id" in body:
            if body["soil_id"] is None:
                details.soil = None
                updated_fields.append("soil cleared")
            else:
                soil = get_object_or_404(Soils, soil_id=body["soil_id"])
                details.soil = soil
                updated_fields.append(f"soil set to {soil.name}")

        # Handle Tree Species
        if "tree_species_id" in body:
            if body["tree_species_id"] is None:
                details.tree_species = None
                updated_fields.append("tree_species cleared")
            else:
                species = get_object_or_404(Tree_species, tree_species_id=body["tree_species_id"])
                details.tree_species = species
                updated_fields.append(f"tree_species set to {species.name}")

        details.save()

        return JsonResponse({
            "message": "Site details updated successfully",
            "updated": updated_fields,
            "details": {
                "soil_id": details.soil.soil_id if details.soil else None,
                "soil_name": details.soil.name if details.soil else None,
                "tree_species_id": details.tree_species.tree_species_id if details.tree_species else None,
                "tree_species_name": details.tree_species.name if details.tree_species else None
            }
        }, status=200)

    except Exception as e:
        import logging
        logging.error(f"update_site_details error: {str(e)}", exc_info=True)
        return JsonResponse({"error": str(e)}, status=500)