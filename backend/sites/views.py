import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import get_object_or_404

from .models import Sites, Site_data, Site_details
from reforestation_areas.models import Reforestation_areas
from soils.models import Soils
from tree_species.models import Tree_species


# ===============================
# GET ALL SITES
# ===============================
@csrf_exempt
def get_sites(request):

    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    reforestation_area_id = request.GET.get("reforestation_area_id")

    sites = Sites.objects.all()

    if reforestation_area_id:
        sites = sites.filter(reforestation_area_id=reforestation_area_id)

    data = []

    for s in sites:

        site_data = None
        if hasattr(s, "site_data"):
            site_data = {
                "soil_quality": s.site_data.soil_quality,
                "ndvi": s.site_data.ndvi,
                "distance_to_water_source": s.site_data.distance_to_water_source,
                "accessibility": s.site_data.accessibility,
                "wildlife_status": s.site_data.wildlife_status,
            }

        site_details = None
        if hasattr(s, "site_details"):
            site_details = {
                "soil_id": s.site_details.soil.soil_id if s.site_details.soil else None,
                "soil": s.site_details.soil.name if s.site_details.soil else None,
                "tree_specie_id": s.site_details.Tree_specie.tree_species_id if s.site_details.Tree_specie else None,
                "tree_specie": s.site_details.Tree_specie.name if s.site_details.Tree_specie else None,
            }

        data.append({
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
        })

    return JsonResponse({"data": data}, status=200)


# ===============================
# GET SINGLE SITE
# ===============================
@csrf_exempt
def get_site(request, site_id):

    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    s = get_object_or_404(Sites, site_id=site_id)

    site_data = None
    if hasattr(s, "site_data"):
        site_data = {
            "soil_quality": s.site_data.soil_quality,
            "ndvi": s.site_data.ndvi,
            "distance_to_water_source": s.site_data.distance_to_water_source,
            "accessibility": s.site_data.accessibility,
            "wildlife_status": s.site_data.wildlife_status,
        }

    site_details = None
    if hasattr(s, "site_details"):
        site_details = {
            "soil_id": s.site_details.soil.soil_id if s.site_details.soil else None,
            "soil": s.site_details.soil.name if s.site_details.soil else None,
            "tree_specie_id": s.site_details.Tree_specie.tree_species_id if s.site_details.Tree_specie else None,
            "tree_specie": s.site_details.Tree_specie.name if s.site_details.Tree_specie else None,
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
            name=data.get("name"),
            status=data.get("status"),
            coordinates=data.get("coordinates", {}),
            polygon_coordinates=data.get("polygon_coordinates", {}),
            total_area_planted=data.get("total_area_planted", 0),
            total_seedling_planted=data.get("total_seedling_planted", 0),
        )

        # ----------------
        # SITE DATA
        # ----------------
        if "site_data" in data:

            sd = data["site_data"]

            Site_data.objects.create(
                site=site,
                soil_quality=sd.get("soil_quality", "moderate"),
                ndvi=sd.get("ndvi", ""),
                distance_to_water_source=sd.get("distance_to_water_source", 0),
                accessibility=sd.get("accessibility", "moderate"),
                wildlife_status=sd.get("wildlife_status", "moderate"),
            )

        # ----------------
        # SITE DETAILS
        # ----------------
        if "site_details" in data:

            details = data["site_details"]

            soil = None
            tree = None

            if details.get("soil_id"):
                soil = get_object_or_404(Soils, soil_id=details["soil_id"])

            if details.get("tree_specie_id"):
                tree = get_object_or_404(Tree_species, tree_species_id=details["tree_specie_id"])

            Site_details.objects.create(
                site=site,
                soil=soil,
                Tree_specie=tree
            )

        return JsonResponse({
            "message": "Site created successfully",
            "site_id": site.site_id
        })

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)


# ===============================
# UPDATE SITE
# ===============================
@csrf_exempt
def update_site(request, site_id):

    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)

    try:

        data = json.loads(request.body)

        site = get_object_or_404(Sites, site_id=site_id)

        fields = [
            "name",
            "status",
            "coordinates",
            "polygon_coordinates",
            "total_area_planted",
            "total_seedling_planted",
        ]

        for field in fields:
            if field in data:
                setattr(site, field, data[field])

        site.save()

        return JsonResponse({
            "message": "Site updated successfully"
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

    return JsonResponse({"message": "Site deleted successfully"})


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