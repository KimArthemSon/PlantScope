import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import get_object_or_404

from accounts.helper import get_user_from_token
from .models import Assigned_onsite_inspector, Field_assessment, Field_assessment_details
from barangay.models import Barangay
from sites.models import Sites
from soils.models import Soils
from tree_species.models import Tree_species


# ---------------- Get assigned reforestation areas ----------------
@csrf_exempt
def get_assigned_reforestation_area(request):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    try:
        user = get_user_from_token(request)
        if user.user_role != "onsite_inspector":
            return JsonResponse({'error': 'Unauthorized'}, status=403)

        assigned_records = Assigned_onsite_inspector.objects.filter(user=user)
        data = [
            {
                "id": record.reforestation_area.reforestation_area_id,
                "name": record.reforestation_area.name,
                "barangay": record.reforestation_area.barangay.name if hasattr(record.reforestation_area, 'barangay') and record.reforestation_area.barangay else None,
                "safety": record.reforestation_area.safety,
            }
            for record in assigned_records
        ]
        return JsonResponse(data, safe=False)

    except Exception as e:
        return JsonResponse({'error': str(e)}, status=401)


# ---------------- Get field assessments for assigned inspector ----------------
@csrf_exempt
def get_field_assessments(request, assigned_onsite_inspector_id):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    assigned_area = get_object_or_404(Assigned_onsite_inspector, assigned_onsite_inspector_id=assigned_onsite_inspector_id)
    field_assessments = assigned_area.field_assessments.all()

    data = [
        {
            "field_assessment_id": fa.field_assessment_id,
            "title": fa.title,
            "legality": fa.legality,
            "safety": fa.safety,
            "barangay": fa.barangay.name if fa.barangay else None,
            "is_sent": fa.is_sent,
        }
        for fa in field_assessments
    ]
    return JsonResponse({'data': data}, status=200)


# ---------------- Get a single field assessment ----------------
@csrf_exempt
def get_field_assessment(request, field_assessment_id):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    fa = get_object_or_404(Field_assessment, field_assessment_id=field_assessment_id)
    data = {
        "field_assessment_id": fa.field_assessment_id,
        "title": fa.title,
        "legality": fa.legality,
        "safety": fa.safety,
        "barangay": fa.barangay.name if fa.barangay else None,
        "coordinates": fa.coordinates,
        "polygon_coordinates": fa.polygon_coordinates,
        "description": fa.description,
        "is_sent": fa.is_sent,
        "soil_quality": fa.soil_quality,
        "ndvi": fa.ndvi,
        "distance_to_water_source": fa.distance_to_water_source,
        "accessibility": fa.accessibility,
        "wildlife_status": fa.wildlife_status,
        "created_at": fa.created_at.strftime("%Y-%m-%d %H:%M:%S"),
    }
    return JsonResponse({"data": data}, status=200)


# ---------------- Create field assessment ----------------
@csrf_exempt
def create_field_assessment(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)

    try:
        data = json.loads(request.body)

        # Required fields
        title = data.get("title")
        legality = bool(data.get("legality", 'pending'))
        safety = data.get("safety", "moderate")
        barangay_id = data.get("barangay_id")
        coordinates = data.get("coordinates", {})
        polygon_coordinates = data.get("polygon_coordinates", {})
        description = data.get("description", "")
        is_sent = data.get("is_sent", False)
        soil_quality = data.get("soil_quality", "moderate")
        ndvi = data.get("ndvi", "")
        distance_to_water_source = data.get("distance_to_water_source", "")
        accessibility = data.get("accessibility", "moderate")
        wildlife_status = data.get("wildlife_status", "moderate")

        # Optional foreign keys
        site_id = data.get("site_id")
        assigned_inspector_id = data.get("assigned_onsite_inspector_id")

        # Fetch related objects
        barangay = get_object_or_404(Barangay, barangay_id=barangay_id)
        site = get_object_or_404(Sites, site_id=site_id) if site_id else None
        assigned_inspector = get_object_or_404(Assigned_onsite_inspector, assigned_onsite_inspector_id=assigned_inspector_id) if assigned_inspector_id else None

        fa = Field_assessment.objects.create(
            title=title,
            legality=legality,
            safety=safety,
            coordinates=coordinates,
            polygon_coordinates=polygon_coordinates,
            description=description,
            barangay=barangay,
            is_sent=is_sent,
            soil_quality=soil_quality,
            ndvi=ndvi,
            distance_to_water_source=distance_to_water_source,
            accessibility=accessibility,
            wildlife_status=wildlife_status,
            site=site,
            assigned_onsite_inspector=assigned_inspector
        )

        # Create details if provided
        details_list = data.get("details", [])
        for detail in details_list:
            tree_id = detail.get("tree_specie_id")
            soil_id = detail.get("soil_id")
            tree = get_object_or_404(Tree_species, tree_species_id=tree_id) if tree_id else None
            soil = get_object_or_404(Soils, soil_id=soil_id) if soil_id else None

            Field_assessment_details.objects.create(
                field_assessment=fa,
                tree_specie=tree,
                soil=soil
            )

        return JsonResponse({"message": "Field assessment created successfully", "field_assessment_id": fa.field_assessment_id})

    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)


# ---------------- Update field assessment ----------------
@csrf_exempt
def update_field_assessment(request, field_assessment_id):
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)

    try:
        data = json.loads(request.body)
        fa = get_object_or_404(Field_assessment, field_assessment_id=field_assessment_id)

        for field in ["title", "legality", "safety", "coordinates", "polygon_coordinates", "description",
                      "is_sent", "soil_quality", "ndvi", "distance_to_water_source", "accessibility", "wildlife_status"]:
            if field in data:
                setattr(fa, field, data[field] if field != "legality" else bool(data[field]))

        if "barangay_id" in data:
            fa.barangay = get_object_or_404(Barangay, barangay_id=data["barangay_id"])
        if "site_id" in data:
            fa.site = get_object_or_404(Sites, site_id=data["site_id"])
        if "assigned_onsite_inspector_id" in data:
            fa.assigned_onsite_inspector = get_object_or_404(Assigned_onsite_inspector, assigned_onsite_inspector_id=data["assigned_onsite_inspector_id"])

        fa.save()
        return JsonResponse({"message": "Field assessment updated successfully", "field_assessment_id": fa.field_assessment_id})

    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)


# ---------------- Delete field assessment ----------------
@csrf_exempt
def delete_field_assessment(request, field_assessment_id):
    if request.method != 'DELETE':
        return JsonResponse({'error': 'Only DELETE allowed'}, status=405)

    fa = get_object_or_404(Field_assessment, field_assessment_id=field_assessment_id)
    fa.delete()
    return JsonResponse({"message": "Field assessment deleted successfully"})


# ---------------- Field assessment details ----------------
@csrf_exempt
def get_field_assessment_details(request, field_assessment_id):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    fa = get_object_or_404(Field_assessment, field_assessment_id=field_assessment_id)
    details = fa.field_assessment_details.all()  # use correct related_name

    data = [
        {
            "field_assessment_detail_id": d.field_assessment_detail_id,
            "tree_specie_id": d.tree_specie.tree_species_id if d.tree_specie else None,
            "tree_specie": d.tree_specie.name if d.tree_specie else None,
            "soil_id": d.soil.soil_id if d.soil else None,
            "soil": d.soil.name if d.soil else None,
        }
        for d in details
    ]
    return JsonResponse({"data": data}, status=200)


@csrf_exempt
def create_field_detail(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)

    try:
        data = json.loads(request.body)
        fa = get_object_or_404(Field_assessment, field_assessment_id=data.get("field_assessment_id"))
        tree = get_object_or_404(Tree_species, tree_species_id=data.get("tree_specie_id")) if data.get("tree_specie_id") else None
        soil = get_object_or_404(Soils, soil_id=data.get("soil_id")) if data.get("soil_id") else None

        detail = Field_assessment_details.objects.create(
            field_assessment=fa,
            tree_specie=tree,
            soil=soil
        )
        return JsonResponse({"message": "Field assessment detail created successfully",
                             "field_assessment_detail_id": detail.field_assessment_detail_id}, status=201)

    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)


@csrf_exempt
def delete_field_detail(request, field_assessment_detail_id):
    if request.method != 'DELETE':
        return JsonResponse({'error': 'Only DELETE allowed'}, status=405)

    detail = get_object_or_404(Field_assessment_details, field_assessment_detail_id=field_assessment_detail_id)
    detail.delete()
    return JsonResponse({"message": "Field assessment detail deleted successfully"})