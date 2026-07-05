# reforestation_areas/views_ndvi.py
import ee
import logging
from datetime import datetime, timedelta
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import get_object_or_404
import json

# Import local models/helpers
from ormoc_city.models import Ormoc_City # Assuming this model exists in ormoc_city
from . import gee_helpers

logger = logging.getLogger(__name__)

def mask_s2_harmonized(image):
    """Cloud/shadow mask for COPERNICUS/S2_SR_HARMONIZED"""
    scl = image.select('SCL')
    mask = scl.eq(4).Or(scl.eq(5)).Or(scl.eq(6))
    return image.updateMask(mask).divide(10000)

def get_sentinel2_median(roi, start_date, end_date, cloud_threshold=20):
    """Fetch median composite from Sentinel-2"""
    collection = (
        ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
        .filterBounds(roi)
        .filterDate(start_date, end_date)
        .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", cloud_threshold))
        .map(mask_s2_harmonized)
    )
    try:
        if collection.size().getInfo() == 0:
            # Fallback: expand date range by 30 days
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
            end_dt = datetime.strptime(end_date, "%Y-%m-%d")
            collection = (
                ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
                .filterBounds(roi)
                .filterDate((start_dt - timedelta(days=30)).strftime("%Y-%m-%d"),
                            (end_dt + timedelta(days=30)).strftime("%Y-%m-%d"))
                .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 30))
                .map(mask_s2_harmonized)
            )
        return collection.median()
    except:
        return None

def classify_canopy(ndvi_image):
    """Classify NDVI into canopy classes"""
    return ndvi_image.expression(
        "(ndvi >= 0.6) ? 3 : (ndvi >= 0.4) ? 2 : (ndvi >= 0.2) ? 1 : 0",
        {"ndvi": ndvi_image}
    ).rename("canopy")

@csrf_exempt
def ndvi_canopy(request):
    """GET /api/ndvi/?start=YYYY-MM-DD&end=YYYY-MM-DD"""
    if request.method != "GET":
        return JsonResponse({"error": "Use GET"}, status=405)
    
    start = request.GET.get("start")
    end = request.GET.get("end")
    
    if not start or not end:
        return JsonResponse({"error": "Missing start/end dates"}, status=400)
    
    try:
        ormoc = Ormoc_City.objects.first()
        if not ormoc:
            return JsonResponse({"error": "Ormoc City config not found"}, status=500)
        
        # Convert polygon coordinates [lat,lng] -> [lng,lat]
        poly_coords = [[c[1], c[0]] for c in ormoc.polygon]
        roi = ee.Geometry.Polygon(poly_coords)
        
        s2 = get_sentinel2_median(roi, start, end)
        if not s2:
            return JsonResponse({"error": "No Sentinel-2 data found"}, status=404)
        
        ndvi = s2.normalizedDifference(["B8", "B4"]).rename("NDVI")
        canopy = classify_canopy(ndvi)
        
        # ✅ NEW: Clip canopy to Ormoc City boundary
        # This masks out everything outside the polygon
        canopy_clipped = canopy.clip(roi)
        
        # ✅ Create a mask image for visualization
        # Areas inside Ormoc City will show NDVI colors
        # Areas outside will be gray (no data/transparent)
        map_id = canopy_clipped.getMapId({
            "min": 0, 
            "max": 3, 
            "palette": ["#cccccc", "#f1c40f", "#e67e22", "#27ae60"]  # Gray, Yellow, Orange, Green
        })
        
        return JsonResponse({
            "tile_url": map_id["tile_fetcher"].url_format,
            "date_range": f"{start} to {end}",
            "bounds": roi.getInfo()["coordinates"]
        })
    except Exception as e:
        logger.error(f"❌ NDVI map failed: {e}")
        return JsonResponse({"error": "Map generation failed"}, status=500)

@csrf_exempt
def suitable_sites(request):
    """POST /api/suitable-sites/ - Find low-NDVI areas for reforestation"""
    if request.method != "POST":
        return JsonResponse({"error": "Use POST"}, status=405)
    
    try:
        data = json.loads(request.body)
        roi = ee.Geometry(data['geometry'])
        start, end = data['start'], data['end']
        
        s2 = get_sentinel2_median(roi, start, end)
        if not s2:
            return JsonResponse({"error": "No imagery found"}, status=404)
        
        ndvi = s2.normalizedDifference(["B8", "B4"]).rename("NDVI")
        
        # Find areas with NDVI < 0.41
        suitable = ndvi.lt(0.41).selfMask().rename("suitable")
        vectors = suitable.reduceToVectors(
            geometry=roi, scale=20, maxPixels=1e10,
            geometryType="polygon", labelProperty="site_id", bestEffort=True
        )
        
        features = vectors.getInfo().get("features", [])
        # Enrich with stats
        for i, feat in enumerate(features):
            geom = ee.Geometry(feat['geometry'])
            stats = ndvi.reduceRegion(reducer=ee.Reducer.mean(), geometry=geom, scale=20).getInfo()
            try:
                area_ha = geom.area().divide(10000).getInfo()
            except:
                area_ha = 0
            
            feat['properties'].update({
                'site_id': f'SITE-{str(i+1).zfill(3)}',
                'area_hectares': round(area_ha, 2),
                'avg_ndvi': round(stats.get('NDVI', 0), 3),
                'suitability_score': round((1 - stats.get('NDVI', 0)) * 100, 1)
            })
        
        return JsonResponse({
            "success": True,
            "type": "FeatureCollection",
            "features": features,
            "metadata": {"threshold": "< 0.41", "description": "Low vegetation suitable for reforestation"}
        })
    except Exception as e:
        logger.error(f"❌ Suitable sites error: {e}")
        return JsonResponse({"error": str(e)[:200]}, status=500)

@csrf_exempt
def ndvi_trend(request):
    """POST /api/ndvi-trend/ - NDVI time series"""
    if request.method != "POST":
        return JsonResponse({"error": "Use POST"}, status=405)
    
    try:
        data = json.loads(request.body)
        roi = ee.Geometry(data['geometry'])
        start, end = data['start'], data['end']
        interval = data.get('interval', 'month')
        
        time_series = []
        current = datetime.strptime(start, "%Y-%m-%d")
        end_dt = datetime.strptime(end, "%Y-%m-%d")
        step = timedelta(days=30 if interval == 'month' else 7)
        
        while current + step <= end_dt:
            period_end = current + step
            s2 = get_sentinel2_median(roi, current.strftime("%Y-%m-%d"), period_end.strftime("%Y-%m-%d"), cloud_threshold=30)
            if s2:
                ndvi = s2.normalizedDifference(["B8", "B4"]).rename("NDVI")
                mean = ndvi.reduceRegion(reducer=ee.Reducer.mean(), geometry=roi, scale=20).getInfo()
                time_series.append({
                    'date': current.strftime("%Y-%m"),
                    'ndvi': round(mean.get('NDVI', 0), 3)
                })
            current = period_end
        
        if len(time_series) >= 2:
            change = time_series[-1]['ndvi'] - time_series[0]['ndvi']
            trend = "declining" if change < -0.1 else "stable" if change < 0.1 else "increasing"
        else:
            change, trend = 0, "insufficient_data"
        
        return JsonResponse({
            "success": True,
            "data": {"dates": [t['date'] for t in time_series], "values": [t['ndvi'] for t in time_series], "trend": trend, "change": round(change, 3)}
        })
    except Exception as e:
        logger.error(f"❌ NDVI trend error: {e}")
        return JsonResponse({"error": str(e)[:200]}, status=500)