import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import get_object_or_404
import math
from .models import Sites, Site_data, Site_details,Site_multicriteria
from reforestation_areas.models import Reforestation_areas
from soils.models import Soils
from tree_species.models import Tree_species


# ===============================
# GET ALL SITES
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

    for s in sites:

        completed = 0
        rejected = 0
        total_layers = 7

        if hasattr(s, "site_data") and hasattr(s.site_data, "site_multicriteria"):

            mc = s.site_data.site_multicriteria

            statuses = [
                mc.safety_status,
                mc.legality_status,
                mc.soil_quality_status,
                mc.ndvi_status,
                mc.distance_to_water_source_status,
                mc.accessibility_status,
                mc.wildlife_status
            ]

            completed = sum(1 for st in statuses if st == "completed")
            rejected = sum(1 for st in statuses if st == "rejected")

        data.append({
            "site_id": s.site_id,
            "name": s.name,
            "status": s.status,
            "created_at": s.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            "progress": {
                "completed": completed,
                "rejected": rejected,
                "total": total_layers
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

    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    s = get_object_or_404(
        Sites.objects.select_related(
            "site_data",
            "site_details__soil",
            "site_details__Tree_specie"
        ),
        site_id=site_id
    )

    site_data = None
    if hasattr(s, "site_data"):
        sd = s.site_data
        site_data = {
            "soil_quality": sd.soil_quality,
            "ndvi": sd.ndvi,
            "distance_to_water_source": sd.distance_to_water_source,
            "accessibility": sd.accessibility,
            "wildlife_status": sd.wildlife_status,
        }

    site_details = None
    if hasattr(s, "site_details"):
        d = s.site_details
        site_details = {
            "soil_id": d.soil.soil_id if d.soil else None,
            "soil": d.soil.name if d.soil else None,
            "tree_specie_id": d.Tree_specie.tree_species_id if d.Tree_specie else None,
            "tree_specie": d.Tree_specie.name if d.Tree_specie else None,
        }

    data = {
        "site_id": s.site_id,
        "name": s.name,
        "status": s.status,
        "coordinates": s.coordinates,
        "polygon_coordinates": s.polygon_coordinates,
        "total_area_planted": s.total_area_planted,
        "total_seedling_planted": s.total_seedling_planted,
        "created_at": s.created_at.strftime("%Y-%m-%d %H:%M:%S"),
        "site_data": site_data,
        "site_details": site_details
    }

    return JsonResponse({"data": data})


# ===============================
# CREATE SITE
# ===============================
@csrf_exempt
def create_site(request):

    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)

    try:

        data = json.loads(request.body)

        reforestation_area = get_object_or_404(
            Reforestation_areas,
            reforestation_area_id=data.get("reforestation_area_id")
        )

        site = Sites.objects.create(
            reforestation_area=reforestation_area,
            name=data.get("name", "New Site"),
            status="pending",
            coordinates={},
            polygon_coordinates={},
            total_area_planted=0,
            total_seedling_planted=0
        )

        site_data = Site_data.objects.create(
            site=site,
            Safety="safe",
            legality=True,
            soil_quality="moderate",
            ndvi="",
            distance_to_water_source=0,
            accessibility="moderate",
            wildlife_status="moderate"
        )

        Site_details.objects.create(
            site=site,
            soil=None,
            Tree_specie=None
        )

        Site_multicriteria.objects.create(
            site_data=site_data
        )

        return JsonResponse({
            "message": "Site created successfully",
            "site_id": site.site_id
        })

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)


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

        return JsonResponse({
            "message": "Site name updated successfully"
        })

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

    return JsonResponse({
        "message": "Site deleted successfully"
    })


# ===============================
# UPDATE SITE DATA
# ===============================
@csrf_exempt
def update_site_data(request, site_id):

    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)

    try:

        data = json.loads(request.body)

        site = get_object_or_404(Sites, site_id=site_id)

        site_data, created = Site_data.objects.get_or_create(site=site)

        fields = [
            "soil_quality",
            "ndvi",
            "distance_to_water_source",
            "accessibility",
            "wildlife_status"
        ]

        for field in fields:
            if field in data:
                setattr(site_data, field, data[field])

        site_data.save()

        return JsonResponse({
            "message": "Site data updated successfully"
        })

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)