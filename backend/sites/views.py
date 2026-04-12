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
from reforestation_areas.models import Reforestation_areas
from tree_species.models import Tree_species
from Field_assessment.models import Field_assessment
from land_classifications.models import Classified_areas

#create site
#submit/update site
#get existing sites
#get existing site
#delete site


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
        # Get finalized (archived) site_data for validation progress
        finalized_sd = s.site_data_versions.filter(is_current=False).order_by('-version').first()
        validated_count = 0
        rejected_count = 0
        layer_status = {}
        
        if finalized_sd and finalized_sd.site_data:
            for layer_name in ALLOWED_LAYERS:
                layer = finalized_sd.site_data.get(layer_name, {})
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
                "layer_status": layer_status,
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

@csrf_exempt
def get_site(request, site_id):
    if request.method != "GET":
        return JsonResponse({"error": "GET only"}, 405)

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
        "inspector_snapshots": (current_sd or finalized_sd).field_assessment_snapshot if (current_sd or finalized_sd) else {},
        "species_recommendations": [
            {"id": r.tree_species.tree_specie_id, "name": r.tree_species.name, "rank": r.priority_rank, "notes": r.notes}
            for r in site.species_recommendations.order_by('priority_rank')
        ]
    })

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

@csrf_exempt
def update_species_recommendations(request, site_id):
    """POST: GIS Specialist updates recommended tree species for a site."""
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

@csrf_exempt
def create_site(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST only"}, status=405)  # ✅ Fixed
    
    try:
        body = json.loads(request.body)
        name = body.get('name', '').strip()
        area_id = body.get('reforestation_area_id')
        
        if not name or not area_id:
            return JsonResponse({"error": "name and reforestation_area_id are required"}, status=400)  # ✅ Fixed

        area = get_object_or_404(Reforestation_areas, reforestation_area_id=area_id)
        if area.pre_assessment_status != "approved":
            return JsonResponse({"error": "Parent area not approved for site creation"}, status=400)  # ✅ Fixed

        with transaction.atomic():
            site = Sites.objects.create(
                reforestation_area=area,
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

            Site_data.objects.create(site=site, version=1, is_current=True, site_data={}, field_assessment_snapshot={})

        return JsonResponse({"message": "Site created", "site_id": site.site_id, "status": site.status}, status=201)  # ✅ Fixed
        
    except IntegrityError:
        # ✅ Fixed: Proper error response for duplicate name
        return JsonResponse({"error": "Site name already exists in this area. Please choose a different name."}, status=409)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON format"}, status=400)  # ✅ Fixed
    except Exception as e:
        logger.error(f"create_site: {e}", exc_info=True)
        return JsonResponse({"error": f"Internal server error: {str(e)}"}, status=500)  # ✅ Fixed

@csrf_exempt
def save_site_polygon(request, site_id):
    if request.method not in ["PUT", "PATCH"]:
        return JsonResponse({"error": "PUT/PATCH only"}, 405)
    
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
        return JsonResponse({"message": "Polygon & metrics updated", "area_hectares": site.total_area_hectares, "center": site.center_coordinate})
    except Exception as e:
        return JsonResponse({"error": str(e)}, 400)
    
@csrf_exempt
def get_sites_list(request, reforestation_area_id):
    if request.method != "GET":
        return JsonResponse({"error": "GET only"}, 405)

    search = request.GET.get("search", "").strip()
    status_filter = request.GET.get("status", "all").strip().lower()

    sites = Sites.objects.filter(reforestation_area_id=reforestation_area_id, is_active=True).order_by("-is_pinned", "-created_at")
    if search: sites = sites.filter(name__icontains=search)
    if status_filter != "all": sites = sites.filter(status=status_filter)

    data = []
    for s in sites:
        # Check latest version (draft or finalized)
        latest_sd = s.site_data_versions.order_by('-version').first()
        layer_status = {}
        validated_count = 0
        
        if latest_sd and latest_sd.site_data:
            for layer in ALLOWED_LAYERS:
                l_data = latest_sd.site_data.get(layer, {})
                if l_data.get("acceptance"):
                    validated_count += 1
                    layer_status[layer] = l_data["acceptance"]

        data.append({
            "site_id": s.site_id,
            "name": s.name,
            "status": s.status,
            "is_pinned": s.is_pinned,
            "area_hectares": s.total_area_hectares,
            "ndvi": s.ndvi_value,
            "validation_progress": {
                "completed": validated_count,
                "total": len(ALLOWED_LAYERS),
                "layer_status": layer_status
            },
            "created_at": s.created_at.strftime("%Y-%m-%d %H:%M")
        })

    return JsonResponse({"data": data, "count": len(data)})

@csrf_exempt
def update_mcda_layer(request, site_id, layer_name):
    if request.method not in ["PUT", "PATCH"]:
        return JsonResponse({"error": "PUT/PATCH only"}, 405)
    if layer_name not in ALLOWED_LAYERS:
        return JsonResponse({"error": "Invalid layer"}, 400)

    try:
        body = json.loads(request.body)
        site = get_object_or_404(Sites, site_id=site_id, is_active=True)
        sd = site.site_data_versions.filter(is_current=True).first()
        if not sd: return JsonResponse({"error": "No active draft found"}, 404)

        if not sd.site_data: sd.site_data = {}
        
        # Merge incoming data into layer
        sd.site_data[layer_name] = {**sd.site_data.get(layer_name, {}), **body}
        sd.save()

        return JsonResponse({"message": f"Layer '{layer_name}' draft saved", "data": sd.site_data[layer_name]})
    except Exception as e:
        return JsonResponse({"error": str(e)}, 400)

@csrf_exempt
def finalize_site(request, site_id):
    """
    POST: Finalize site validation after all 3 MCDA layers have acceptance decisions.
    Per PLANTSCOPE v5.0: Each layer has a SPECIFIC acceptance field name.
    """
    if request.method != "POST":
        return JsonResponse({"error": "POST only"}, status=405)

    try:
        body = json.loads(request.body)
        decision = body.get("decision", "").upper()
        if decision not in ["ACCEPT", "REJECT"]:
            return JsonResponse({"error": "decision must be ACCEPT or REJECT"}, status=400)

        site = get_object_or_404(Sites, site_id=site_id, is_active=True)
        current_sd = site.site_data_versions.filter(is_current=True).first()
        if not current_sd:
            return JsonResponse({"error": "No active draft found to finalize"}, status=404)

        # ✅ PLANTSCOPE v5.0: Layer-specific acceptance field mapping
        # Per documentation: each layer has its OWN acceptance field name
        ACCEPTANCE_FIELD_MAP = {
            "safety": "safety_acceptance",                    # Layer 1
            "boundary_verification": "boundary_acceptance",   # Layer 2  
            "survivability": "overall_survivability_decision", # Layer 3
        }

        # ✅ Validate ALL 3 layers have their SPECIFIC acceptance field set
        missing_fields = []
        for layer in ALLOWED_LAYERS:
            layer_data = current_sd.site_data.get(layer, {})
            acceptance_field = ACCEPTANCE_FIELD_MAP.get(layer)
            
            if not layer_data or not layer_data.get(acceptance_field):
                missing_fields.append(f"{layer}.{acceptance_field}")
                logger.warning(
                    f"Finalize blocked for site {site_id}: layer '{layer}' missing '{acceptance_field}'. "
                    f"Current data: {layer_data}"
                )
        
        if missing_fields:
            return JsonResponse({
                "error": f"Incomplete validation. Missing acceptance decisions in: {', '.join(missing_fields)}. "
                        f"Please complete all 3 MCDA layers before finalizing."
            }, status=400)

        # ✅ All layers validated - proceed with finalization
        with transaction.atomic():
            # 1. Archive current draft (set is_current=False)
            current_sd.is_current = False
            current_sd.save()

            # 2. Create new empty current version for future edits (versioning)
            Site_data.objects.create(
                site=site,
                version=current_sd.version + 1,
                is_current=True,
                site_data={},  # Fresh empty draft
                field_assessment_snapshot={}
            )

            # 3. Update site status based on decision
            site.status = "accepted" if decision == "ACCEPT" else "rejected"
            site.save()

        logger.info(
            f"Site {site_id} finalized successfully: decision={decision}, "
            f"archived_version={current_sd.version}, new_version={current_sd.version + 1}"
        )
        
        return JsonResponse({
            "message": f"Site {decision}ED successfully",
            "status": site.status,
            "site_id": site.site_id,
            "new_version": current_sd.version + 1
        }, status=200)
        
    except json.JSONDecodeError:
        logger.error(f"finalize_site JSON decode error for site {site_id}")
        return JsonResponse({"error": "Invalid JSON format in request body"}, status=400)
        
    except Exception as e:
        logger.error(f"finalize_site unexpected error for site {site_id}: {e}", exc_info=True)
        return JsonResponse({"error": f"Internal server error: {str(e)[:200]}"}, status=500)

@csrf_exempt
def delete_site(request, site_id):
    if request.method != "DELETE":
        return JsonResponse({"error": "DELETE only"}, 405)
    site = get_object_or_404(Sites, site_id=site_id, is_active=True)
    site.is_active = False
    site.save()
    return JsonResponse({"message": "Site deleted"})
