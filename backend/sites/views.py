import json
import logging
from django.db import IntegrityError
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import get_object_or_404
import math
from django.utils import timezone
from .models import Sites, Site_data, Site_details, Site_images
from reforestation_areas.models import Reforestation_areas
from soils.models import Soils
from tree_species.models import Tree_species
from django.db import transaction
from django.core.exceptions import ObjectDoesNotExist

logger = logging.getLogger(__name__)

# ===============================
# READ: GET ALL SITES (PAGINATED)
# ===============================
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
    # We still calculate progress here for the dashboard view
    LAYER_KEYS = ['safety', 'legality', 'slope', 'soil_quality', 'accessibility', 'distance_to_water_source', 'wildlife_status', 'tree_species_suitability']

    for s in sites:
        completed = 0
        rejected = 0
        total_score = 0.0
        
        if hasattr(s, 'site_data') and s.site_data:
            mc_json = s.site_data.site_data
            layers = mc_json.get("layers", {})
            for key in LAYER_KEYS:
                if key in layers:
                    result = layers[key].get("result", {})
                    verdict = result.get("verdict", "")
                    if verdict in ["PASS", "PASS_WITH_MITIGATION", "HIGHLY_SUITABLE", "OPTIMIZED"]:
                        completed += 1
                    elif verdict == "AUTO_REJECT":
                        rejected += 1
            
            summary = mc_json.get("final_site_summary", {})
            total_score = summary.get("total_weighted_score", 0.0)

        data.append({
            "site_id": s.site_id,
            "name": s.name,
            "status": s.status,
            "created_at": s.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            "progress": { "completed": completed, "rejected": rejected, "total": len(LAYER_KEYS) },
            "metrics": { "survival_rate": float(total_score), "total_score": float(total_score) }
        })

    return JsonResponse({ "data": data, "total_page": total_page, "page": page, "entries": entries, "total": total }, status=200)

# ===============================
# READ: GET SINGLE SITE
# ===============================
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

# ===============================
# CREATE: NEW SITE
# ===============================
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
            Site_data.objects.create(site=site, is_current=True, site_data={}, score=0.0, suitability_classification=None)
            Site_details.objects.create(site=site, soil=None, tree_species=None)

        return JsonResponse({"message": "Site created successfully.", "site_id": site.site_id}, status=201)
        
    except IntegrityError:
        return JsonResponse({"error": "A site with this name already exists in this area"}, status=409)
    except Exception as e:
        logger.error(f"create_site error: {str(e)}", exc_info=True)
        return JsonResponse({"error": "Internal server error"}, status=500)

# ===============================
# UPDATE: SITE NAME
# ===============================
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

# ===============================
# DELETE: SITE
# ===============================
@csrf_exempt
def delete_site(request, site_id):
    if request.method != 'DELETE':
        return JsonResponse({'error': 'Only DELETE allowed'}, status=405)
    site = get_object_or_404(Sites, site_id=site_id)
    site.delete()
    return JsonResponse({"message": "Site deleted successfully"})

# ===============================
# UPDATE: COORDINATES (Helper)
# ===============================
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