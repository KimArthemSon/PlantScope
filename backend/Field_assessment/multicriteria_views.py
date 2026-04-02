from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import get_object_or_404
from django.db.models import Q
from .models import (
    Assigned_onsite_inspector,
    Field_assessment,
    Field_assessment_details,
    field_assessment_images
)
from reforestation_areas.models import Reforestation_areas
import json

# ------------------------------------------------------------------
# 1. Get Pre-Assessment Reviews for GIS Specialist
# ------------------------------------------------------------------
@csrf_exempt
def get_pre_assessment_reviews(request, reforestation_area_id):
    """
    Fetches all SENT pre-assessment field assessments for a specific reforestation area.
    Extracts specific data from the JSON field for the frontend.
    """
    if request.method != "GET":
        return JsonResponse({"error": "Only GET allowed"}, status=405)

    try:
        # Verify Area exists
        area = get_object_or_404(Reforestation_areas, reforestation_area_id=reforestation_area_id)

        # Filter: Only Pre-Assessment, Only Sent, Linked to this Area
        assessments = Field_assessment.objects.filter(
            assigned_onsite_inspector__reforestation_area_id=reforestation_area_id,
            multicriteria_type='pre_assessment',
            is_sent=True
        ).select_related(
            "assigned_onsite_inspector",
            "assigned_onsite_inspector__user",
            "assigned_onsite_inspector__user__profile"
        ).order_by('-created_at')

        results = []
        for fa in assessments:
            assignment = fa.assigned_onsite_inspector
            profile = getattr(assignment.user, "profile", None)
            
            # Construct User Info
            full_name = " ".join(filter(None, [
                getattr(profile, 'first_name', ''),
                getattr(profile, 'middle_name', ''),
                getattr(profile, 'last_name', '')
            ])) if profile else assignment.user.get_full_name() or assignment.user.username
            
            profile_img = f"/media/{profile.profile_img}" if profile and getattr(profile, 'profile_img', None) else None
            
            # Extract Data from JSON
            # Structure: data -> pre_assessment_gate -> ...
            gate_data = fa.field_assessment_data.get('pre_assessment_gate', {})
            safety_check = gate_data.get('general_safety_check', {})
            legality_check = gate_data.get('general_legality_check', {})
            
            # Determine Status Labels based on JSON booleans
            safety_status = "Safe" if safety_check.get('is_safe_to_enter') else "Unsafe"
            legality_status = "Accessible" if legality_check.get('is_accessible_legally') else "Blocked"
            
            # Get Reasons if failed
            safety_reason = safety_check.get('blocker_reason')
            legality_reason = legality_check.get('blocker_reason')
            
            statement = gate_data.get('inspector_clearance_statement', '')
            overall_status = gate_data.get('status', 'UNKNOWN') # PASSED or FAILED

            results.append({
                "field_assessment_id": fa.field_assessment_id,
                "created_at": fa.created_at.isoformat(),
                "title": fa.title,
                "description": fa.description,
                "overall_status": overall_status, # PASSED/FAILED
                
                # Safety Details
                "is_safe": safety_check.get('is_safe_to_enter'),
                "safety_status_label": safety_status,
                "safety_reason": safety_reason,
                
                # Legality Details
                "is_legal": legality_check.get('is_accessible_legally'),
                "legality_status_label": legality_status,
                "legality_reason": legality_reason,
                
                # Statement
                "clearance_statement": statement,
                
                # User Info
                "user": {
                    "user_id": assignment.user.id,
                    "full_name": full_name.strip() or assignment.user.username,
                    "email": assignment.user.email,
                    "profile_img": profile_img
                }
            })

        return JsonResponse({
            "reforestation_area_id": reforestation_area_id,
            "area_name": area.name,
            "count": len(results),
            "results": results
        }, status=200)

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

# ------------------------------------------------------------------
# 2. Unsend Field Assessment (For Onsite Inspector)
# ------------------------------------------------------------------
@csrf_exempt
def unsent_field_assessment(request, field_assessment_id):
    """
    Allows an inspector to 'unsend' (revert) their own assessment.
    Only works if is_sent is currently True.
    Sets is_sent back to False so it can be edited/deleted.
    """
    if request.method != "POST":
        return JsonResponse({"error": "Only POST allowed"}, status=405)

    try:
        user = request.user # Assuming standard auth or extract from token helper
        # If using token helper: user = get_user_from_token(request)
        
        fa = get_object_or_404(Field_assessment, field_assessment_id=field_assessment_id)

        # Security: Only the owner can unsend
        if fa.assigned_onsite_inspector.user != user:
            return JsonResponse({"error": "Forbidden. You can only unsend your own assessments."}, status=403)

        # Logic: Must be currently sent to unsend it
        if not fa.is_sent:
            return JsonResponse({"error": "This assessment is not currently submitted."}, status=400)

        # Perform Revert
        fa.is_sent = False
        fa.save()

        return JsonResponse({
            "message": "Assessment reverted to draft successfully.",
            "field_assessment_id": fa.field_assessment_id,
            "is_sent": False
        }, status=200)

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)