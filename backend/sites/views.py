import json
import logging
from django.db import IntegrityError
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import get_object_or_404
import math
from .models import Sites, Site_data, Site_details, Site_multicriteria
from reforestation_areas.models import Reforestation_areas
from soils.models import Soils
from tree_species.models import Tree_species
from django.db import transaction, IntegrityError
from django.core.exceptions import ObjectDoesNotExist

# ===============================
# GET ALL SITES (PAGINATED)
# ===============================
@csrf_exempt
def get_sites(request, reforestation_area_id):

    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    # =========================
    # QUERY PARAMS
    # =========================
    search = request.GET.get("search", "").strip()
    entries = int(request.GET.get("entries", 10))
    page = int(request.GET.get("page", 1))
    status_filter = request.GET.get("status", "all").strip().lower()

    if entries <= 0:
        entries = 10
    if page <= 0:
        page = 1

    offset = (page - 1) * entries

    # =========================
    # BASE QUERY
    # =========================
    sites = Sites.objects.select_related(
        "site_data__site_multicriteria"
    ).filter(
        reforestation_area_id=reforestation_area_id
    ).order_by("-created_at")

    if search:
        sites = sites.filter(name__icontains=search)
    if status_filter != "all":
        sites = sites.filter(status=status_filter)

    total = sites.count()
    total_page = math.ceil(total / entries) if total > 0 else 1

    # =========================
    # PAGINATION
    # =========================
    sites = sites[offset: offset + entries]

    # =========================
    # BUILD RESPONSE
    # =========================
    data = []
    total_layers = 7  # safety, legality, soil_quality, water, accessibility, wildlife, slope

    for s in sites:
        completed = 0
        rejected = 0
        survival_rate = 0.0
        total_score = 0.0

        if hasattr(s, "site_data") and hasattr(s.site_data, "site_multicriteria"):
            mc = s.site_data.site_multicriteria
            statuses = [
                mc.safety_status,
                mc.legality_status,
                mc.soil_quality_status,
                mc.distance_to_water_source_status,
                mc.accessibility_status,
                mc.wildlife_status,
                mc.slope_status
            ]
            completed = sum(1 for st in statuses if st == "completed")
            rejected = sum(1 for st in statuses if st == "rejected")
            survival_rate = mc.survival_rate
            total_score = mc.total_score

        data.append({
            "site_id": s.site_id,
            "name": s.name,
            "status": s.status,
            "created_at": s.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            "progress": {
                "completed": completed,
                "rejected": rejected,
                "total": total_layers
            },
            "metrics": {
                "survival_rate": survival_rate,
                "total_score": total_score
            }
        })

    return JsonResponse({
        "data": data,
        "total_page": total_page,
        "page": page,
        "entries": entries,
        "total": total
    }, status=200)


# ===============================
# GET SINGLE SITE
# ===============================
@csrf_exempt
def get_site(request, site_id):

    if request.method != "GET":
        return JsonResponse({"error": "Only GET allowed"}, status=405)

    sd = get_object_or_404(
        Site_data.objects.select_related(
            "site",
            "site__site_details",
            "site__site_details__soil",
            "site__site_details__Tree_specie",
            "site_multicriteria"
        ),
        site__site_id=site_id,
        isCurrent=True
    )

    site = sd.site
    details = getattr(site, "site_details", None)
    mc = getattr(sd, "site_multicriteria", None)

    data = {
        "site_id": site.site_id,
        "name": site.name,
        "status": site.status,
        "coordinates": site.coordinates,
        "polygon_coordinates": site.polygon_coordinates,
        "total_area_planted": site.total_area_planted,
        "total_seedling_planted": site.total_seedling_planted,
        "created_at": site.created_at.strftime("%Y-%m-%d %H:%M:%S"),

        "site_data": {
            "site_data_id": sd.site_data_id,
            "safety": sd.Safety,
            "legality": sd.legality,
            "slope": float(sd.slope),
            "soil_quality": sd.soil_quality,
            "distance_to_water_source": sd.distance_to_water_source,
            "accessibility": sd.accessibility,
            "wildlife": sd.wildlife,
            "created_at": sd.created_at.strftime("%Y-%m-%d %H:%M:%S")
        },

        "site_details": {
            "soil_id": details.soil.soil_id if details and details.soil else None,
            "soil_name": details.soil.name if details and details.soil else None,
            "tree_specie_id": details.Tree_specie.tree_species_id if details and details.Tree_specie else None,
            "tree_specie_name": details.Tree_specie.name if details and details.Tree_specie else None,
        } if details else None,

        "multicriteria": {
            "safety_status": mc.safety_status,
            "legality_status": mc.legality_status,
            "soil_quality_status": mc.soil_quality_status,
            "distance_to_water_source_status": mc.distance_to_water_source_status,
            "accessibility_status": mc.accessibility_status,
            "wildlife_status": mc.wildlife_status,
            "slope_status": mc.slope_status,
            "survival_rate": mc.survival_rate,
            "total_score": mc.total_score,
            "remarks": mc.remarks,
            "updated_at": mc.updated_at.strftime("%Y-%m-%d %H:%M:%S") if mc.updated_at else None
        } if mc else None
    }

    return JsonResponse({"data": data}, status=200)

# ===============================
# CREATE SITE
# ===============================
@csrf_exempt
def create_site(request):
    """
    Create a minimal new site - only name is required.
    All other fields are set to null/defaults and can be updated later.
    """
    if request.method != "POST":
        return JsonResponse({"error": "Only POST allowed"}, status=405)
    
    try:
        # Parse JSON body
        try:
            body = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON format"}, status=400)
        
        # === ONLY REQUIRED FIELD: name + reforestation_area_id (FK) ===
        if 'name' not in body or not body['name'].strip():
            return JsonResponse({"error": "Field 'name' is required"}, status=400)
        
        if 'reforestation_area_id' not in body:
            return JsonResponse({"error": "Field 'reforestation_area_id' is required"}, status=400)
        
        # Validate reforestation_area exists
        try:
            reforestation_area = Reforestation_areas.objects.get(
                reforestation_area_id=body['reforestation_area_id']
            )
        except ObjectDoesNotExist:
            return JsonResponse({
                "error": f"Reforestation area with ID {body['reforestation_area_id']} not found"
            }, status=404)
        
        # === ATOMIC TRANSACTION: Create minimal site structure ===
        with transaction.atomic():
            # 1. Create Sites (minimal required fields + safe defaults)
            site = Sites.objects.create(
                reforestation_area=reforestation_area,
                name=body['name'].strip(),
                status='pending',           # Default status
                isActive=True,              # Default active
                coordinates=[0.0, 0.0],     # Placeholder - update later
                polygon_coordinates=[],     # Empty - update later
                total_area_planted=0.0,     # Default
                total_seedling_planted=0,   # Default
            )
            
            # 2. Create Site_data (all defaults/nulls)
            site_data = Site_data.objects.create(
                site=site,
                isCurrent=True,
                # All choice fields use model defaults
                # distance_to_water_source is required in model, set to 0.0 as placeholder
                distance_to_water_source=0.0,
            )
            
            # 3. Create Site_details (empty - no soil/tree assigned yet)
            Site_details.objects.create(
                site=site,
                soil=None,
                Tree_specie=None
            )
            
            # 4. Create Site_multicriteria (all pending, zero scores)
            Site_multicriteria.objects.create(
                site_data=site_data,
                # All status fields default to 'pending' via model
                survival_rate=0.00,
                total_score=0.00,
                remarks=None
            )
        
        # === RETURN CREATED SITE (same format as get_site for consistency) ===
        created_sd = Site_data.objects.select_related(
            "site",
            "site__site_details",
            "site__site_details__soil",
            "site__site_details__Tree_specie",
            "site_multicriteria"
        ).get(site=site)
        
        created_site = created_sd.site
        details = getattr(created_site, "site_details", None)
        mc = getattr(created_sd, "site_multicriteria", None)
        
        response_data = {
            "site_id": created_site.site_id,
            "name": created_site.name,
            "status": created_site.status,
            "coordinates": created_site.coordinates,
            "polygon_coordinates": created_site.polygon_coordinates,
            "total_area_planted": created_site.total_area_planted,
            "total_seedling_planted": created_site.total_seedling_planted,
            "created_at": created_site.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            
            "site_data": {
                "site_data_id": created_sd.site_data_id,
                "safety": created_sd.Safety,
                "legality": created_sd.legality,
                "slope": float(created_sd.slope),
                "soil_quality": created_sd.soil_quality,
                "distance_to_water_source": created_sd.distance_to_water_source,
                "accessibility": created_sd.accessibility,
                "wildlife": created_sd.wildlife,
                "created_at": created_sd.created_at.strftime("%Y-%m-%d %H:%M:%S")
            },
            
            "site_details": {
                "soil_id": details.soil.soil_id if details and details.soil else None,
                "soil_name": details.soil.name if details and details.soil else None,
                "tree_specie_id": details.Tree_specie.tree_species_id if details and details.Tree_specie else None,
                "tree_specie_name": details.Tree_specie.name if details and details.Tree_specie else None,
            } if details else None,
            
            "multicriteria": {
                "safety_status": mc.safety_status if mc else None,
                "legality_status": mc.legality_status if mc else None,
                "soil_quality_status": mc.soil_quality_status if mc else None,
                "distance_to_water_source_status": mc.distance_to_water_source_status if mc else None,
                "accessibility_status": mc.accessibility_status if mc else None,
                "wildlife_status": mc.wildlife_status if mc else None,
                "slope_status": mc.slope_status if mc else None,
                "survival_rate": mc.survival_rate if mc else 0.0,
                "total_score": mc.total_score if mc else 0.0,
                "remarks": mc.remarks if mc else None,
                "updated_at": mc.updated_at.strftime("%Y-%m-%d %H:%M:%S") if mc and mc.updated_at else None
            } if mc else None
        }
        
        return JsonResponse({
            "data": response_data, 
            "message": "Site created successfully. Complete details can be added later."
        }, status=201)
        
    except IntegrityError as e:
        error_msg = str(e).lower()
        if 'unique constraint' in error_msg or 'duplicate' in error_msg:
            return JsonResponse({"error": "A site with this name already exists in this area"}, status=409)
        logging.error(f"create_site IntegrityError: {str(e)}", exc_info=True)
        return JsonResponse({"error": "Database error. Please try again."}, status=500)
        
    except Exception as e:
        logging.error(f"create_site error: {str(e)}", exc_info=True)
        return JsonResponse({"error": "Internal server error"}, status=500)

# ===============================
# UPDATE SITE NAME
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
# DELETE SITE
# ===============================
@csrf_exempt
def delete_site(request, site_id):

    if request.method != 'DELETE':
        return JsonResponse({'error': 'Only DELETE allowed'}, status=405)

    site = get_object_or_404(Sites, site_id=site_id)
    site.delete()

    return JsonResponse({"message": "Site deleted successfully"})


# ===============================
# UPDATE SITE DATA (Criterion Values)
# ===============================
@csrf_exempt
def update_site_data(request, site_id):
    """Update actual criterion values in Site_data model"""
    
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)

    try:
        data = json.loads(request.body)
        site = get_object_or_404(Sites, site_id=site_id)
        site_data, created = Site_data.objects.get_or_create(site=site)

        # ✅ Updated fields: removed ndvi, added slope, safety, legality
        fields = [
            "Safety",           # Note: Capital S in model
            "legality",
            "slope",
            "soil_quality",
            "distance_to_water_source",
            "accessibility",
            "wildlife",         # Note: Site_data uses 'wildlife', not 'wildlife_status'
        ]

        for field in fields:
            if field in data:
                setattr(site_data, field, data[field])

        site_data.save()

        return JsonResponse({
            "message": "Site data updated successfully",
            "updated": [f for f in fields if f in data]
        })

    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON format"}, status=400)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)


# ===============================
# UPDATE MULTICRITERIA (Status + Metrics)
# ===============================
@csrf_exempt
def update_multicriteria(request, site_data_id):
    """Update criterion statuses and metrics in Site_multicriteria model"""
    
    if request.method != "PUT":
        return JsonResponse({"error": "Only PUT allowed"}, status=405)

    try:
        data = json.loads(request.body)
        site_data = get_object_or_404(Site_data, site_data_id=site_data_id)
        
        multicriteria, created = Site_multicriteria.objects.get_or_create(
            site_data=site_data,
            defaults={
                "safety_status": "pending",
                "legality_status": "pending",
                "soil_quality_status": "pending",
                "distance_to_water_source_status": "pending",
                "accessibility_status": "pending",
                "wildlife_status": "pending",
                "slope_status": "pending",
                "survival_rate": 0.00,
                "total_score": 0.00
            }
        )

        # ✅ Update Site_data fields (the actual criterion values)
        field_map = {
            "safety": "Safety",
            "legality": "legality",
            "slope": "slope",
            "soil_quality": "soil_quality",
            "distance_to_water_source": "distance_to_water_source",
            "accessibility": "accessibility",
            "wildlife": "wildlife",  # Site_data field name
        }

        for layer_key, model_field in field_map.items():
            if layer_key in data and hasattr(site_data, model_field):
                setattr(site_data, model_field, data[layer_key])

        # ✅ Update Site_multicriteria fields (status + metrics)
        mc_fields = [
            "safety_status", "legality_status", "soil_quality_status",
            "distance_to_water_source_status", "accessibility_status",
            "wildlife_status", "slope_status",  # Status fields
            "survival_rate", "total_score", "remarks"  # Metrics
        ]

        for field in mc_fields:
            if field in data:
                setattr(multicriteria, field, data[field])

        site_data.save()
        multicriteria.save()

        return JsonResponse({
            "message": "Multicriteria updated successfully",
            "site_data_id": site_data.site_data_id,
            "created": created,
            "updated_fields": [k for k in data.keys() if k in field_map or k in mc_fields]
        }, status=200)
        
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON format"}, status=400)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


# ===============================
# GET CURRENT SITE DATA (for analysis page)
# ===============================
@csrf_exempt
def get_current_site_data(request, site_id):
    """Fetch current site data with multicriteria status for analysis"""
    
    if request.method != "GET":
        return JsonResponse({"error": "Only GET allowed"}, status=405)

    try:
        sd = get_object_or_404(
            Site_data.objects.select_related("site", "site_multicriteria"),
            site__site_id=site_id,
            isCurrent=True
        )

        multicriteria = None
        if hasattr(sd, "site_multicriteria") and sd.site_multicriteria:
            mc = sd.site_multicriteria
            multicriteria = {
                "safety_status": mc.safety_status,
                "legality_status": mc.legality_status,
                "soil_quality_status": mc.soil_quality_status,
                "distance_to_water_source_status": mc.distance_to_water_source_status,
                "accessibility_status": mc.accessibility_status,
                "wildlife_status": mc.wildlife_status,  # ✅ Correct field name
                "slope_status": mc.slope_status,
                "survival_rate": mc.survival_rate,
                "total_score": mc.total_score,
                "remarks": mc.remarks
            }

        data = {
            "site_data_id": sd.site_data_id,
            "site_id": sd.site.site_id,
            # Site_data values (actual criterion data)
            "Safety": sd.Safety,
            "legality": sd.legality,
            "slope": float(sd.slope),
            "soil_quality": sd.soil_quality,
            "distance_to_water_source": sd.distance_to_water_source,
            "accessibility": sd.accessibility,
            "wildlife": sd.wildlife,  # ✅ Site_data field
            # Multicriteria statuses
            "safety_status": multicriteria["safety_status"] if multicriteria else "pending",
            "legality_status": multicriteria["legality_status"] if multicriteria else "pending",
            "slope_status": multicriteria["slope_status"] if multicriteria else "pending",
            "soil_quality_status": multicriteria["soil_quality_status"] if multicriteria else "pending",
            "distance_to_water_source_status": multicriteria["distance_to_water_source_status"] if multicriteria else "pending",
            "accessibility_status": multicriteria["accessibility_status"] if multicriteria else "pending",
            "wildlife_status": multicriteria["wildlife_status"] if multicriteria else "pending",  # ✅ Status field
            # Metrics
            "survival_rate": multicriteria["survival_rate"] if multicriteria else 0.0,
            "total_score": multicriteria["total_score"] if multicriteria else 0.0,
            "remarks": multicriteria["remarks"] if multicriteria else "",
            "created_at": sd.created_at.strftime("%Y-%m-%d %H:%M:%S"),
        }

        return JsonResponse({"data": data, "message": "Success"}, status=200)
        
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


# ===============================
# UPDATE OVERALL SITE STATUS
# ===============================
@csrf_exempt
def update_site_status(request, site_id):
    """Update overall site status: pending → official → rejected"""
    
    if request.method != "PUT":
        return JsonResponse({"error": "Only PUT allowed"}, status=405)

    try:
        data = json.loads(request.body)
        new_status = data.get("status")
        
        valid_statuses = ["pending", "rejected", "official", "re-analysis", "completed"]
        if new_status not in valid_statuses:
            return JsonResponse({"error": f"Invalid status. Must be one of: {valid_statuses}"}, status=400)

        site = get_object_or_404(Sites, site_id=site_id)
        site.status = new_status
        site.save()

        return JsonResponse({
            "message": f"Site status updated to {new_status}",
            "site_id": site.site_id,
            "new_status": site.status
        }, status=200)
        
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON format"}, status=400)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
def update_site_coordinates(request):
    if request.method != "PUT":
        return JsonResponse({"error": "Invalid request method"}, status=405)

    try:
        data = json.loads(request.body)

        site_id = data.get("site_id")
        coordinates = data.get("coordinates")
        polygon_coordinates = data.get("polygon_coordinates")

        site = Sites.objects.get(site_id=site_id)

        if coordinates is not None:
            site.coordinates = coordinates

        if polygon_coordinates is not None:
            site.polygon_coordinates = polygon_coordinates

        site.save()

        return JsonResponse({
            "message": "Coordinates updated successfully",
            "site_id": site.site_id,
            "coordinates": site.coordinates,
            "polygon_coordinates": site.polygon_coordinates
        })

    except Sites.DoesNotExist:
        return JsonResponse({"error": "Site not found"}, status=404)

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)
    
@csrf_exempt
def get_site_coordinates(request):
    if request.method != "GET":
        return JsonResponse({"error": "Invalid request method"}, status=405)

    site_id = request.GET.get("site_id")

    if not site_id:
        return JsonResponse({"error": "Missing site_id parameter"}, status=400)

    try:
        site = Sites.objects.get(site_id=site_id)
        return JsonResponse({
            "site_id": site.site_id,
            "coordinates": site.coordinates,
            "polygon_coordinates": site.polygon_coordinates
        })
    except Sites.DoesNotExist:
        return JsonResponse({"error": "Site not found"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)