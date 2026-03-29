# backend/accounts/viewsMap.py
import ee
import logging
from datetime import datetime, timedelta
from django.http import JsonResponse
from django.conf import settings

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════
# 🔑 EARTH ENGINE INITIALIZATION
# ═══════════════════════════════════════════════════════════════
try:
    ee.Initialize(project='plant-scope-ee')
    logger.info("✅ Earth Engine initialized successfully")
except Exception as e:
    logger.error(f"❌ Earth Engine init failed: {e}")
    raise RuntimeError(
        "Earth Engine failed to initialize. "
        "Run: python -c \"import ee; ee.Authenticate()\""
    ) from e


# ═══════════════════════════════════════════════════════════════
# 🛠️ HELPER FUNCTIONS
# ═══════════════════════════════════════════════════════════════

def mask_s2_harmonized(image):
    """
    Cloud/shadow mask for COPERNICUS/S2_SR_HARMONIZED using SCL band.
    """
    scl = image.select('SCL')
    # Keep good quality pixels: vegetation (4), non-vegetated (5), water (6)
    mask = scl.eq(4).Or(scl.eq(5)).Or(scl.eq(6))
    return image.updateMask(mask).divide(10000)


def get_sentinel2_median(roi, start_date, end_date, cloud_threshold=20):
    """
    Fetch median composite from Sentinel-2 with automatic date fallback.
    Returns: ee.Image or None if no data available after fallback
    """
    collection_name = "COPERNICUS/S2_SR_HARMONIZED"
    
    def fetch_collection(start, end):
        return (
            ee.ImageCollection(collection_name)
            .filterBounds(roi)
            .filterDate(start, end)
            .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", cloud_threshold))
            .map(mask_s2_harmonized)
        )
    
    # Try original date range first
    collection = fetch_collection(start_date, end_date)
    
    # ✅ FIXED: Check if collection has images using .size()
    try:

        collection_size = collection.size().getInfo()
        logger.info(f"📊 Found {collection_size} images for {start_date} to {end_date}")
        
        if collection_size == 0:
            logger.warning(f"⚠️ No imagery for {start_date} to {end_date}, attempting fallback...")
            
            # Parse dates and expand window
            try:
                start_dt = datetime.strptime(start_date, "%Y-%m-%d")
                end_dt = datetime.strptime(end_date, "%Y-%m-%d")
                
                # Expand by 30 days on each side
                new_start = (start_dt - timedelta(days=30)).strftime("%Y-%m-%d")
                new_end = (end_dt + timedelta(days=30)).strftime("%Y-%m-%d")
                
                logger.info(f"🔄 Fallback range: {new_start} to {new_end}")
                collection = fetch_collection(new_start, new_end)
                collection_size = collection.size().getInfo()
                logger.info(f"📊 Fallback found {collection_size} images")
                
            except Exception as e:
                logger.error(f"❌ Date fallback failed: {e}")
                return None
        
        if collection_size == 0:
            logger.warning("⚠️ No imagery found even after fallback")
            return None
            
    except ee.EEException as e:
        logger.error(f"❌ Failed to check collection size: {e}")
        return None
    
    # Compute median composite
    
    try:
        median_image = collection.median()
        return median_image
    except ee.EEException as e:
        logger.error(f"❌ Failed to compute median: {e}")
        return None


def classify_canopy(ndvi_image):
    """
    Classify NDVI into canopy density classes.
    """
    return ndvi_image.expression(
        "(ndvi >= 0.6) ? 3 : (ndvi >= 0.4) ? 2 : (ndvi >= 0.2) ? 1 : 0",
        {"ndvi": ndvi_image}
    ).rename("canopy")


# ═══════════════════════════════════════════════════════════════
# 🗺️ VIEW: NDVI CANOPY MAP
# ═══════════════════════════════════════════════════════════════

def ndvi_canopy(request):
    """
    API Endpoint: GET /api/ndvi/?start=YYYY-MM-DD&end=YYYY-MM-DD
    """
    start = request.GET.get("start")
    end = request.GET.get("end")

    if not start or not end:
        return JsonResponse(
            {"error": "Missing required parameters: 'start' and 'end' dates (YYYY-MM-DD)"}, 
            status=400
        )

    # Validate date format
    try:
        datetime.strptime(start, "%Y-%m-%d")
        datetime.strptime(end, "%Y-%m-%d")
    except ValueError as e:
        return JsonResponse(
            {"error": f"Invalid date format. Use YYYY-MM-DD. Details: {str(e)}"}, 
            status=400
        )

    # Ormoc City ROI
    roi = ee.Geometry.Rectangle([124.43, 11.00, 124.65, 11.15])
    
    # Fetch processed Sentinel-2 median image
    s2_median = get_sentinel2_median(roi, start, end)
    
    if s2_median is None:
        return JsonResponse(
            {"error": "No suitable Sentinel-2 imagery found. Try expanding your date range."}, 
            status=404
        )
    

    # Calculate NDVI
    ndvi = s2_median.normalizedDifference(["B8", "B4"]).rename("NDVI")
    
    # Classify canopy density
    canopy = classify_canopy(ndvi)

    # Visualization parameters
    vis_params = {
        "min": 0,
        "max": 3,
        "palette": ["#cccccc", "#f1c40f", "#e67e22", "#27ae60"],
    }

    try:
        map_id = canopy.getMapId(vis_params)
        return JsonResponse({
            "tile_url": map_id["tile_fetcher"].url_format,
            "date_range_used": f"{start} to {end}",
            "bounds": roi.getInfo()["coordinates"]
        })
    except ee.EEException as e:
        logger.error(f"❌ Map generation failed: {e}")
        return JsonResponse(
            {"error": "Failed to generate map tiles. Please try again or contact support."}, 
            status=500
        )


# ═══════════════════════════════════════════════════════════════
# 🎯 VIEW: SUITABLE REFORESTATION SITES
# ═══════════════════════════════════════════════════════════════

from django.views.decorators.csrf import csrf_exempt
import json

@csrf_exempt
def suitable_sites(request):
    """
    API Endpoint: POST /api/suitable-sites/
    """
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed. Use POST."}, status=405)

    try:
        data = json.loads(request.body)
        start = data.get("start")
        end = data.get("end")
        geom = data.get("geometry")

        if not all([start, end, geom]):
            return JsonResponse(
                {"error": "Missing required fields: 'start', 'end', and 'geometry'"}, 
                status=400
            )

        # Parse user-drawn geometry
        roi = ee.Geometry(geom)

        # Fetch processed Sentinel-2 median image with auto-fallback
        s2_median = get_sentinel2_median(roi, start, end)
        
        if s2_median is None:
            return JsonResponse(
                {"error": "No suitable imagery found. Try a different date range or location."}, 
                status=404
            )

        # Calculate NDVI
        ndvi = s2_median.normalizedDifference(["B8", "B4"])
        
        # Identify suitable areas: NDVI < 0.4
        suitable = ndvi.lt(0.4).selfMask().rename("suitable")

        # Vectorize raster to polygons
        vectors = suitable.reduceToVectors(
            geometry=roi,
            scale=20,
            maxPixels=1e10,
            geometryType="polygon",
            eightConnected=False,
            labelProperty="suitable",
            bestEffort=True
        )

        # Convert to GeoJSON
        geojson = vectors.getInfo()
        
        return JsonResponse({
            "type": "FeatureCollection",
            "features": geojson.get("features", []),
            "metadata": {
                "date_range": f"{start} to {end}",
                "ndvi_threshold": "< 0.4",
                "description": "Areas with low vegetation cover suitable for reforestation"
            }
        })

    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON in request body"}, status=400)
    except ee.EEException as e:
        logger.error(f"❌ Earth Engine error in suitable_sites: {e}")
        return JsonResponse(
            {"error": f"Processing error: {str(e)[:200]}"},
            status=500
        )
    except Exception as e:
        logger.error(f"❌ Unexpected error: {e}", exc_info=True)
        return JsonResponse(
            {"error": "Internal server error. Please try again later."}, 
            status=500
        )