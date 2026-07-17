import json
import math
import logging
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from sites.models import Potential_sites, Sites


logger = logging.getLogger(__name__)

# =====================================================
# POTENTIAL SITES
# =====================================================

@csrf_exempt
def get_potential_sites(request):
    """
    Fetches potential sites filtered by site_id or reforestation_area_id.
    """
    if request.method != 'GET': 
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    
    site_id = request.GET.get('site_id')
    area_id = request.GET.get('reforestation_area_id')
    
    qs = Potential_sites.objects.all()
    
    if site_id:
        qs = qs.filter(site_id=site_id)
    elif area_id:
        qs = qs.filter(site__reforestation_area_id=area_id)
        
    # Ensure to_dict() in your model returns 'polygon_coordinates'
    return JsonResponse({'data': [s.to_dict() for s in qs]}, status=200)



@csrf_exempt
def delete_potential_site(request, potential_sites_id):
    """
    Deletes a specific potential site.
    """
    if request.method != 'DELETE':
        return JsonResponse({'error': 'Only DELETE allowed'}, status=405)
    
    site = get_object_or_404(Potential_sites, potential_sites_id=potential_sites_id)
    site.delete()
    
    return JsonResponse({'message': 'Successfully deleted'}, status=200)


@csrf_exempt
def bulk_create_potential_sites(request):
    """
    Creates multiple potential sites for a given Official Site.
    Supports 'replace_existing' flag to clear old analysis before adding new ones.
    """
    if request.method != "POST": 
        return JsonResponse({"error": "POST only."}, status=405)
    
    try:
        data = json.loads(request.body)
        site_id = data.get('site_id') 
        sites_data = data.get('sites')
        replace_existing = data.get('replace_existing', False)
        
        # ✅ DEBUG LOGGING: See exactly what the frontend is sending
        logger.info(f"📥 Received bulk create request: site_id={site_id}, sites_count={len(sites_data) if sites_data else 0}, replace={replace_existing}")
        
        if not site_id or not sites_data:
            logger.error("❌ Missing site_id or sites_data in payload")
            return JsonResponse({"error": "site_id and sites array are required"}, status=400)

        # Fetch the parent Official Site
        site = get_object_or_404(Sites, site_id=site_id, is_active=True)
        
        # ✅ DELETE OLD POTENTIAL SITES IF FLAG IS SET (Re-analyze flow)
        if replace_existing:
            deleted_count = Potential_sites.objects.filter(site=site).count()
            Potential_sites.objects.filter(site=site).delete()
            logger.info(f"🗑️ Re-analyze: Deleted {deleted_count} old potential sites for site_id {site_id}")
        
        created_count = 0
        for idx, site_data in enumerate(sites_data):
            # ✅ DEBUG LOGGING: Check each item's keys
            logger.info(f"🔍 Processing item {idx}: keys = {list(site_data.keys())}")
            
            # Check for geometry in multiple possible keys (frontend might send 'geometry' or 'polygon_coordinates')
            geometry = site_data.get('geometry') or site_data.get('polygon_coordinates')
            
            if not geometry:
                logger.warning(f"⚠️ Skipping item {idx} due to missing geometry. Data received: {site_data}")
                continue
                
            Potential_sites.objects.create(
                site=site,
                polygon_coordinates=geometry,
                area_hectares=float(site_data.get('area_hectares', 0) or 0),
                avg_ndvi=float(site_data.get('avg_ndvi', 0) or 0),
                suitability_score=float(site_data.get('suitability_score', 0) or 0),
                ndvi_threshold=0.41
            )
            created_count += 1
            
        logger.info(f"✅ Successfully created {created_count} potential sites for site_id {site_id}")
            
        return JsonResponse({
            "success": True, 
            "created_count": created_count,
            "replaced": replace_existing
        }, status=201)
        
    except json.JSONDecodeError:
        logger.error("❌ Bulk create potential sites: Invalid JSON payload")
        return JsonResponse({"error": "Invalid JSON payload"}, status=400)
    except Exception as e:
        logger.error(f"❌ Bulk create potential sites error: {e}", exc_info=True)
        return JsonResponse({"error": str(e)}, status=500)
    
@csrf_exempt
def update_potential_site(request, potential_sites_id):
    """
    Updates a specific potential site with new geometry/analysis.
    Does NOT affect other potential sites.
    """
    if request.method != "PUT": 
        return JsonResponse({"error": "PUT only."}, status=405)
    
    try:
        potential_site = get_object_or_404(Potential_sites, potential_sites_id=potential_sites_id)
        data = json.loads(request.body)
        
        # Update fields
        if 'geometry' in data:
            potential_site.polygon_coordinates = data['geometry']
        if 'area_hectares' in data:
            potential_site.area_hectares = float(data['area_hectares'])
        if 'avg_ndvi' in data:
            potential_site.avg_ndvi = float(data['avg_ndvi'])
        if 'suitability_score' in data:
            potential_site.suitability_score = float(data['suitability_score'])
            
        potential_site.save()
        
        logger.info(f"✅ Updated potential site {potential_sites_id}")
        
        return JsonResponse({
            "success": True,
            "message": "Potential site updated successfully",
            "data": potential_site.to_dict()
        }, status=200)
        
    except Exception as e:
        logger.error(f"❌ Update potential site error: {e}", exc_info=True)
        return JsonResponse({"error": str(e)}, status=500)

