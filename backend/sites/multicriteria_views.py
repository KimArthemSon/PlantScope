import json
import logging
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import get_object_or_404
from django.utils import timezone
from .models import Sites, Site_data
from Field_assessment.models import Field_assessment # Importing from onsite app
from mcda_weight_config.models import McdaWeightsConfig

logger = logging.getLogger(__name__)

# ===============================
# READ: GET ALL SUBMISSIONS FOR A LAYER (For Analysis Page)
# ===============================
@csrf_exempt
def get_inspector_submissions(request, site_id, layer_type):
    """
    Fetches all submitted field assessments for a specific site and layer.
    Used by the GIS Specialist to compare Inspector 1 vs Inspector 2.
    """
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    try:
        submissions = Field_assessment.objects.filter(
            site_id=site_id,
            multicriteria_type=layer_type,
            is_sent=True
        ).select_related('assigned_onsite_inspector__user').order_by('-created_at')

        data = [
            {
                "submission_id": sub.field_assessment_id,
                "inspector_name": sub.assigned_onsite_inspector.user.get_full_name() or sub.assigned_onsite_inspector.user.username,
                "inspector_email": sub.assigned_onsite_inspector.user.email,
                "submitted_at": sub.created_at.isoformat(),
                "data": sub.field_assessment_data, # The raw JSON data
                "images_count": sub.field_assessment_images.count()
            }
            for sub in submissions
        ]

        return JsonResponse({
            "site_id": site_id,
            "layer": layer_type,
            "count": len(data),
            "submissions": data
        }, status=200)

    except Exception as e:
        logger.error(f"Error fetching submissions: {str(e)}")
        return JsonResponse({"error": str(e)}, status=500)

# ===============================
# CREATE/UPDATE: SAVE MANUAL CONSENSUS (The "Finalize" Logic)
# ===============================
@csrf_exempt
def save_manual_consensus(request, site_id):
    """
    Called when the GIS Specialist clicks 'Save Consensus' on the Analysis Page.
    Expects the FULL finalized JSON structure in the body.
    This allows the specialist to manually construct the JSON based on what they saw from inspectors.
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)

    try:
        body = json.loads(request.body)
        site = get_object_or_404(Sites, site_id=site_id)
        
        # The frontend sends the fully constructed JSON after the specialist makes their choices
        final_json = body.get("finalized_mcda_json")
        
        if not final_json:
            return JsonResponse({"error": "No finalized JSON provided"}, status=400)

        # Extract score from the provided JSON summary
        summary = final_json.get("final_site_summary", {})
        total_score = summary.get("total_weighted_score", 0.0)
        classification = summary.get("suitability_classification", "PENDING")

        # Save to Site_data
        site_data_obj, created = Site_data.objects.update_or_create(
            site=site,
            defaults={
                "is_current": True,
                "site_data": final_json,
                "score": total_score,
                "suitability_classification": classification
            }
        )
        
        # Archive old versions if any
        if not created:
            Site_data.objects.filter(site=site, is_current=True).exclude(site_data_id=site_data_obj.site_data_id).update(is_current=False)

        # Optionally update site status to official if fully complete
        # (You might want to keep it pending until they explicitly click "Approve Site")
        
        return JsonResponse({
            "message": "Consensus saved successfully",
            "score": total_score,
            "classification": classification
        }, status=200)

    except Exception as e:
        logger.error(f"Consensus save error: {str(e)}")
        return JsonResponse({"error": str(e)}, status=500)

# ===============================
# UPDATE: FINAL SITE STATUS
# ===============================
@csrf_exempt
def update_site_status(request, site_id):
    if request.method != "PUT":
        return JsonResponse({"error": "Only PUT allowed"}, status=405)
    try:
        data = json.loads(request.body)
        new_status = data.get("status")
        valid_statuses = ["pending", "rejected", "official", "re-analysis", "completed"]
        if new_status not in valid_statuses:
            return JsonResponse({"error": "Invalid status."}, status=400)
        site = get_object_or_404(Sites, site_id=site_id)
        site.status = new_status
        site.save()
        return JsonResponse({"message": f"Status updated to {new_status}"}, status=200)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)