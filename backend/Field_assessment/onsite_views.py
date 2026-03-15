import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import get_object_or_404

from accounts.helper import get_user_from_token
from .models import Assigned_onsite_inspector, Field_assessment, Field_assessment_details,Field_assessment_multicriteria,Field_assessment_multicriteria_photos
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
def create_field_assessment(request):
    if request.method != "POST":
        return JsonResponse({"error": "Only POST allowed"}, status=405)

    try:
        # -------- BASIC FIELDS --------
        title = request.POST.get("title")
        legality = request.POST.get("legality", "pending")
        safety = request.POST.get("safety")
        description = request.POST.get("description", "")
        is_sent = request.POST.get("is_sent", "True").lower() == "true"
        slope = request.POST.get("slope")

        coordinates = request.POST.get("coordinates")
        polygon_coordinates = request.POST.get("polygon_coordinates")

        soil_quality = request.POST.get("soil_quality")
        distance_to_water_source = request.POST.get("distance_to_water_source")
        accessibility = request.POST.get("accessibility")
        wildlife_status = request.POST.get("wildlife_status")

        site_id = request.POST.get("site_id")
        assigned_inspector_id = request.POST.get("assigned_onsite_inspector_id")

        site = Sites.objects.filter(site_id=site_id).first() if site_id else None
        assigned_inspector = Assigned_onsite_inspector.objects.filter(
            assigned_onsite_inspector_id=assigned_inspector_id
        ).first()

        # -------- CREATE FIELD ASSESSMENT --------

        fa = Field_assessment.objects.create(
            title=title,
            legality=legality,
            safety=safety,
            coordinates=coordinates,
            polygon_coordinates=polygon_coordinates,
            description=description,
            is_sent=is_sent,
            slope=slope,
            soil_quality=soil_quality,
            distance_to_water_source=distance_to_water_source,
            accessibility=accessibility,
            wildlife_status=wildlife_status,
            site=site,
            assigned_onsite_inspector=assigned_inspector
        )

        # -------- DETAILS --------
        details = request.POST.get("details")

        if details:
            details = json.loads(details)

            for d in details:
                tree = Tree_species.objects.filter(
                    tree_species_id=d.get("tree_specie_id")
                ).first()

                soil = Soils.objects.filter(
                    soil_id=d.get("soil_id")
                ).first()

                Field_assessment_details.objects.create(
                    field_assessment=fa,
                    tree_specie=tree,
                    soil=soil
                )

        # -------- MULTICRITERIA DISCUSSION --------

        Field_assessment_multicriteria.objects.create(
            field_assessment=fa,
            legality_disccussion=request.POST.get("legality_discussion", ""),
            slope_disccussion=request.POST.get("slope_discussion", ""),
            safety_disccussion=request.POST.get("safety_discussion", ""),
            soil_quality_disccussion=request.POST.get("soil_quality_discussion", ""),
            distance_to_water_source_disccussion=request.POST.get("distance_to_water_source_discussion", ""),
            accessibility_disccussion=request.POST.get("accessibility_discussion", ""),
            wildlife_status_disccussion=request.POST.get("wildlife_status_discussion", "")
        )

        # -------- MULTICRITERIA PHOTOS --------

        photos = request.FILES.getlist("photos")

        for img in photos:
            photo_type = request.POST.get("photo_type", "all")

            Field_assessment_multicriteria_photos.objects.create(
                field_assessment=fa,
                multicriteria_type=photo_type,
                img=img
            )

        return JsonResponse({
            "message": "Field assessment created successfully",
            "field_assessment_id": fa.field_assessment_id
        })

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)


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