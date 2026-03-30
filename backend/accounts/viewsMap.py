# backend/accounts/viewsMap.py
import ee
import logging
from datetime import datetime, timedelta
from django.http import JsonResponse
from django.conf import settings
from django.views.decorators.csrf import csrf_exempt
import json

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
# 🎯 VIEW: SUITABLE REFORESTATION SITES (FULLY FIXED)
# ═══════════════════════════════════════════════════════════════

@csrf_exempt
def suitable_sites(request):
    """
    API Endpoint: POST /api/suitable-sites/
    
    Request Body:
    {
        "start": "2024-01-01",
        "end": "2024-12-31",
        "geometry": {GeoJSON polygon},
        "debug": false (optional)
    }
    
    Returns: GeoJSON FeatureCollection of suitable sites
    """
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed. Use POST."}, status=405)

    try:
        data = json.loads(request.body)
        start = data.get("start")
        end = data.get("end")
        geom = data.get("geometry")
        debug = data.get("debug", False)

        if not all([start, end, geom]):
            return JsonResponse(
                {"error": "Missing required fields: 'start', 'end', and 'geometry'"}, 
                status=400
            )

        roi = ee.Geometry(geom)
        s2_median = get_sentinel2_median(roi, start, end)
        
        if s2_median is None:
            return JsonResponse(
                {"error": "No suitable imagery found. Try a different date range or location."}, 
                status=404
            )

        # Calculate NDVI
        ndvi = s2_median.normalizedDifference(["B8", "B4"]).rename("NDVI")
        
        # ✅ DEBUG MODE: Return statistics instead of polygons
        if debug:
            stats = ndvi.reduceRegion(
                reducer=ee.Reducer.minMax().combine(ee.Reducer.mean(), None, True),
                geometry=roi,
                scale=20,
                maxPixels=1e9
            ).getInfo()
            
            histogram = ndvi.reduceRegion(
                reducer=ee.Reducer.fixedHistogram(min=0, max=1, steps=20),
                geometry=roi,
                scale=20,
                maxPixels=1e9
            ).getInfo()
            
            return JsonResponse({
                "debug": True,
                "ndvi_stats": stats,
                "histogram": histogram.get("NDVI_fixed_histogram", {}),
                "threshold_used": 0.41,
                "message": "Debug mode: Use this data to verify NDVI distribution"
            })
        
        # ✅ PRODUCTION MODE: Find suitable areas (NDVI < 0.41)
        suitable = ndvi.lt(0.41).selfMask().rename("suitable")

        # Vectorize raster to polygons
        vectors = suitable.reduceToVectors(
            geometry=roi,
            scale=20,
            maxPixels=1e10,
            geometryType="polygon",
            eightConnected=False,
            labelProperty="site_id",
            bestEffort=True
        )

        geojson = vectors.getInfo()
        features = geojson.get("features", [])
        
        # Enrich with metadata
        enriched_features = []
        total_area = 0
        total_ndvi = 0
        
        for i, feature in enumerate(features):
            site_geometry = ee.Geometry(feature['geometry'])
            
            try:
                stats = ndvi.reduceRegion(
                    reducer=ee.Reducer.mean(),
                    geometry=site_geometry,
                    scale=20,
                    maxPixels=1e9
                ).getInfo()
                
                area_ha = site_geometry.area().divide(10000).getInfo()
                avg_ndvi = stats.get('NDVI', 0)
                
                total_area += area_ha
                total_ndvi += avg_ndvi
                
                feature['properties'].update({
                    'site_id': f'SITE-{str(i+1).zfill(3)}',
                    'area_hectares': round(area_ha, 2),
                    'avg_ndvi': round(avg_ndvi, 3),
                    'suitability_score': round((1 - avg_ndvi) * 100, 1)
                })
                enriched_features.append(feature)
                
            except Exception as e:
                logger.warning(f"⚠️ Could not calculate stats for site {i}: {e}")
                feature['properties']['site_id'] = f'SITE-{str(i+1).zfill(3)}'
                enriched_features.append(feature)
        
        # Calculate average NDVI across all sites
        avg_ndvi_all = total_ndvi / len(enriched_features) if enriched_features else 0
        
        return JsonResponse({
            "success": True,
            "type": "FeatureCollection",
            "features": enriched_features,
            "metadata": {
                "total_sites": len(enriched_features),
                "total_area_hectares": round(total_area, 2),
                "average_ndvi": round(avg_ndvi_all, 3),
                "date_range": f"{start} to {end}",
                "ndvi_threshold": "< 0.41",
                "description": "Areas with low vegetation cover suitable for reforestation",
                "scientific_basis": "NASA/FAO NDVI classification - sparse vegetation (0.2-0.4) + 0.01 buffer"
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


# ═══════════════════════════════════════════════════════════════
# 📈 VIEW: NDVI TIME SERIES TREND
# ═══════════════════════════════════════════════════════════════

@csrf_exempt
def ndvi_trend(request):
    """
    API Endpoint: POST /api/ndvi-trend/
    
    Get NDVI trend over time for a specific polygon.
    """
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed. Use POST."}, status=405)

    try:
        data = json.loads(request.body)
        start = data.get("start")
        end = data.get("end")
        geom = data.get("geometry")
        interval = data.get("interval", "month")
        
        if not all([start, end, geom]):
            return JsonResponse(
                {"error": "Missing required fields: 'start', 'end', and 'geometry'"}, 
                status=400
            )
        
        if interval not in ["month", "week"]:
            interval = "month"
        
        roi = ee.Geometry(geom)
        start_dt = datetime.strptime(start, "%Y-%m-%d")
        end_dt = datetime.strptime(end, "%Y-%m-%d")
        
        time_series = []
        
        if interval == "month":
            current = start_dt
            while current + timedelta(days=30) <= end_dt:
                period_start = current
                period_end = current + timedelta(days=30)
                
                try:
                    s2_median = get_sentinel2_median(
                        roi, 
                        period_start.strftime("%Y-%m-%d"),
                        period_end.strftime("%Y-%m-%d"),
                        cloud_threshold=30
                    )
                    
                    if s2_median is not None:
                        ndvi = s2_median.normalizedDifference(["B8", "B4"]).rename("NDVI")
                        
                        mean_ndvi = ndvi.reduceRegion(
                            reducer=ee.Reducer.mean(),
                            geometry=roi,
                            scale=20,
                            maxPixels=1e9
                        ).getInfo()
                        
                        time_series.append({
                            'date': period_start.strftime("%Y-%m"),
                            'ndvi': round(mean_ndvi.get('NDVI', 0), 3),
                            'start': period_start.strftime("%Y-%m-%d"),
                            'end': period_end.strftime("%Y-%m-%d")
                        })
                        
                except Exception as e:
                    logger.warning(f"⚠️ Could not get NDVI for {period_start}: {e}")
                
                current = current + timedelta(days=30)
        
        else:  # week
            current = start_dt
            while current + timedelta(days=7) <= end_dt:
                period_start = current
                period_end = current + timedelta(days=7)
                
                try:
                    s2_median = get_sentinel2_median(
                        roi,
                        period_start.strftime("%Y-%m-%d"),
                        period_end.strftime("%Y-%m-%d"),
                        cloud_threshold=30
                    )
                    
                    if s2_median is not None:
                        ndvi = s2_median.normalizedDifference(["B8", "B4"]).rename("NDVI")
                        
                        mean_ndvi = ndvi.reduceRegion(
                            reducer=ee.Reducer.mean(),
                            geometry=roi,
                            scale=20,
                            maxPixels=1e9
                        ).getInfo()
                        
                        time_series.append({
                            'date': period_start.strftime("%Y-%m-%d"),
                            'ndvi': round(mean_ndvi.get('NDVI', 0), 3),
                            'start': period_start.strftime("%Y-%m-%d"),
                            'end': period_end.strftime("%Y-%m-%d")
                        })
                        
                except Exception as e:
                    logger.warning(f"⚠️ Could not get NDVI for {period_start}: {e}")
                
                current = current + timedelta(days=7)
        
        if not time_series:
            return JsonResponse(
                {"error": "No NDVI data available for the specified period. Try expanding date range."},
                status=404
            )
        
        # Calculate trend
        if len(time_series) >= 2:
            first_ndvi = time_series[0]['ndvi']
            last_ndvi = time_series[-1]['ndvi']
            trend_change = round(last_ndvi - first_ndvi, 3)
            
            if trend_change < -0.1:
                trend_direction = "declining"
                interpretation = "Declining NDVI suggests land degradation - good candidate for reforestation"
            elif trend_change < 0:
                trend_direction = "slightly_declining"
                interpretation = "Slight decline in vegetation - suitable for enrichment planting"
            elif trend_change < 0.1:
                trend_direction = "stable"
                interpretation = "Stable vegetation cover - verify ground conditions"
            else:
                trend_direction = "increasing"
                interpretation = "Increasing vegetation - may be recovering naturally"
        else:
            trend_change = 0
            trend_direction = "insufficient_data"
            interpretation = "Insufficient data points for trend analysis"
        
        return JsonResponse({
            "success": True,
            "data": {
                "dates": [ts['date'] for ts in time_series],
                "values": [ts['ndvi'] for ts in time_series],
                "details": time_series,
                "trend_direction": trend_direction,
                "trend_change": trend_change,
                "interpretation": interpretation,
                "interval": interval,
                "periods_analyzed": len(time_series)
            },
            "metadata": {
                "date_range": f"{start} to {end}",
                "geometry_area_km2": round(roi.area().divide(1e6).getInfo(), 2)
            }
        })
        
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON in request body"}, status=400)
    except ee.EEException as e:
        logger.error(f"❌ Earth Engine error in ndvi_trend: {e}")
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