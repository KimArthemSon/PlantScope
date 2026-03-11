import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import get_object_or_404
from .models import Sites, Site_data, Site_multicriteria


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
                "ndvi_status": mc.ndvi_status,
                "distance_to_water_source_status": mc.distance_to_water_source_status,
                "accessibility_status": mc.accessibility_status,
                "wildlife_status": mc.wildlife_status,
                "total_score": mc.total_score
            }

        data = {
            "site_data_id": sd.site_data_id,
            "site_id": sd.site.site_id,
            "Safety": sd.Safety,
            "safety_status": multicriteria["safety_status"] if multicriteria else "pending",
            "legality": sd.legality,
            "legality_status": multicriteria["legality_status"] if multicriteria else "pending",
            "soil_quality": sd.soil_quality,
            "soil_quality_status": multicriteria["soil_quality_status"] if multicriteria else "pending",
            "ndvi": sd.ndvi,
            "ndvi_status": multicriteria["ndvi_status"] if multicriteria else "pending",
            "distance_to_water_source": sd.distance_to_water_source,
            "distance_to_water_source_status": multicriteria["distance_to_water_source_status"] if multicriteria else "pending",
            "accessibility": sd.accessibility,
            "accessibility_status": multicriteria["accessibility_status"] if multicriteria else "pending",
            "wildlife_status": sd.wildlife_status,
            "wildlife_status_multicriteria": multicriteria["wildlife_status"] if multicriteria else "pending",
            "total_score": multicriteria["total_score"] if multicriteria else 0,
            "created_at": sd.created_at.strftime("%Y-%m-%d %H:%M:%S"),
        }

        return JsonResponse({"data": data, "message": "Success"}, status=200)
        
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
def update_site_status(request, site_id):
    """Update overall site status: pending → approved → rejected"""
    
    if request.method != "PUT":
        return JsonResponse({"error": "Only PUT allowed"}, status=405)

    try:
        data = json.loads(request.body)
        new_status = data.get("status")
        
        # Validate against your model's choices
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
def update_multicriteria(request, site_data_id):
    """Update individual multicriteria layer values and status"""
    
    if request.method != "PUT":
        return JsonResponse({"error": "Only PUT allowed"}, status=405)

    try:
        data = json.loads(request.body)
        site_data = get_object_or_404(Site_data, site_data_id=site_data_id)
        
        # Get or create associated multicriteria record
        multicriteria, created = Site_multicriteria.objects.get_or_create(
            site_data=site_data,
            defaults={
                "safety_status": "pending",
                "legality_status": "pending",
                "soil_quality_status": "pending",
                "ndvi_status": "pending",
                "distance_to_water_source_status": "pending",
                "accessibility_status": "pending",
                "wildlife_status": "pending",
                "total_score": 0.00
            }
        )

        # ✅ Update Site_data fields (the actual criterion values)
        # Map frontend layer keys to model field names
        field_map = {
            "safety": "Safety",  # Note: Capital S in model
            "legality": "legality",
            "soil_quality": "soil_quality",
            "ndvi": "ndvi",
            "distance_to_water_source": "distance_to_water_source",
            "accessibility": "accessibility",
            "wildlife": "wildlife_status",  # Note: model uses wildlife_status
        }

        for layer_key, model_field in field_map.items():
            if layer_key in data and hasattr(site_data, model_field):
                setattr(site_data, model_field, data[layer_key])

        # ✅ Update Site_multicriteria status fields + total_score
        mc_status_fields = [
            "safety_status", "legality_status", "soil_quality_status",
            "ndvi_status", "distance_to_water_source_status",
            "accessibility_status", "wildlife_status", "total_score"
        ]
        
        for field in mc_status_fields:
            if field in data:
                setattr(multicriteria, field, data[field])

        # Save both records
        site_data.save()
        multicriteria.save()

        return JsonResponse({
            "message": "Multicriteria updated successfully",
            "site_data_id": site_data.site_data_id,
            "updated_fields": [k for k in data.keys() if k in field_map.values() or k in mc_status_fields]
        }, status=200)
        
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON format"}, status=400)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)