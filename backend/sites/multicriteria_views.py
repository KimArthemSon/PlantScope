import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import get_object_or_404
from .models import Sites, Site_data, Site_multicriteria


# ===============================
# GET CURRENT SITE DATA (for analysis)
# ===============================
@csrf_exempt
def get_current_site_data(request, site_id):
    """Fetch current site data with multicriteria status"""
    
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
                "wildlife_status": mc.wildlife_status,  # ✅ FIXED: was mc.wildlife (doesn't exist)
                "slope_status": mc.slope_status,
                "survival_rate": mc.survival_rate,
                "total_score": mc.total_score,
                "remarks": mc.remarks
            }

        data = {
            "site_data_id": sd.site_data_id,
            "site_id": sd.site.site_id,
            # Site_data values
            "Safety": sd.Safety,
            "legality": sd.legality,
            "slope": float(sd.slope),
            "soil_quality": sd.soil_quality,
            "distance_to_water_source": sd.distance_to_water_source,
            "accessibility": sd.accessibility,
            "wildlife": sd.wildlife,  # ✅ Site_data field (the actual value)
            # Multicriteria statuses
            "safety_status": multicriteria["safety_status"] if multicriteria else "pending",
            "legality_status": multicriteria["legality_status"] if multicriteria else "pending",
            "slope_status": multicriteria["slope_status"] if multicriteria else "pending",
            "soil_quality_status": multicriteria["soil_quality_status"] if multicriteria else "pending",
            "distance_to_water_source_status": multicriteria["distance_to_water_source_status"] if multicriteria else "pending",
            "accessibility_status": multicriteria["accessibility_status"] if multicriteria else "pending",
            "wildlife_status": multicriteria["wildlife_status"] if multicriteria else "pending",  # ✅ Status from multicriteria
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
# UPDATE SITE STATUS
# ===============================
@csrf_exempt
def update_site_status(request, site_id):
    """Update overall site status: pending → approved → rejected"""
    
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


# ===============================
# UPDATE MULTICRITERIA
# ===============================
@csrf_exempt
def update_multicriteria(request, site_data_id):
    
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
            "wildlife": "wildlife",  # ✅ Matches Site_data.wildlife field
        }

        for layer_key, model_field in field_map.items():
            if layer_key in data and hasattr(site_data, model_field):
                setattr(site_data, model_field, data[layer_key])

        # ✅ Update Site_multicriteria fields (status + metrics)
        mc_fields = [
            "safety_status", "legality_status", "soil_quality_status",
            "distance_to_water_source_status", "accessibility_status",
            "wildlife_status", "slope_status",  # ✅ wildlife_status is the status field
            "survival_rate", "total_score", "remarks"
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