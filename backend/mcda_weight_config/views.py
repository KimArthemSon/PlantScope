from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import get_object_or_404
from .models import McdaWeightsConfig
import json

# ------------------------------------------------------------------
# 1. Get All MCDA Configurations
# ------------------------------------------------------------------
@csrf_exempt
def get_mcda_config(request):
    if request.method != "GET":
        return JsonResponse({"error": "Only GET allowed"}, status=405)

    try:
        configs = McdaWeightsConfig.objects.filter(is_active=True).order_by('layer_name')
        
        data = [
            {
                "id": c.id,
                "layer_name": c.layer_name,
                "layer_display": c.get_layer_name_display(),
                "weight_percentage": float(c.weight_percentage),
                "scoring_rules": c.scoring_rules,
                "updated_at": c.updated_at.isoformat()
            }
            for c in configs
        ]
        
        # Calculate total weight to validate integrity
        total_weight = sum(float(c['weight_percentage']) for c in data)
        
        return JsonResponse({
            "count": len(data),
            "total_weight": total_weight,
            "is_valid": abs(total_weight - 100.0) < 0.01, # Check if sum is approx 100
            "configurations": data
        }, status=200)

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

# ------------------------------------------------------------------
# 2. Update or Save MCDA Configuration (Single Layer)
# ------------------------------------------------------------------
@csrf_exempt
def update_mcda_config(request, layer_name):
    if request.method not in ["POST", "PUT"]:
        return JsonResponse({"error": "Only POST/PUT allowed"}, status=405)

    try:
        body = json.loads(request.body)
        weight = body.get("weight_percentage")
        rules = body.get("scoring_rules")

        if weight is None or rules is None:
            return JsonResponse({"error": "weight_percentage and scoring_rules are required"}, status=400)

        # Validate Weight
        try:
            weight_val = float(weight)
            if weight_val < 0 or weight_val > 100:
                raise ValueError("Weight must be between 0 and 100")
        except ValueError:
            return JsonResponse({"error": "Invalid weight value"}, status=400)

        # Get or Create the config for this layer
        config, created = McdaWeightsConfig.objects.update_or_create(
            layer_name=layer_name,
            defaults={
                "weight_percentage": weight_val,
                "scoring_rules": rules,
                "is_active": True
            }
        )

        return JsonResponse({
            "message": "Configuration updated successfully",
            "created": created,
            "data": {
                "id": config.id,
                "layer_name": config.layer_name,
                "weight_percentage": float(config.weight_percentage),
                "scoring_rules": config.scoring_rules
            }
        }, status=200)

    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)