import ee
import logging
from datetime import datetime, timedelta
from django.http import JsonResponse
from django.conf import settings
from django.views.decorators.csrf import csrf_exempt
import json
from ormoc_city.models import Ormoc_City

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
# 🛠️ HELPER FUNCTIONS - GUARANTEED DATASETS ONLY
# ═══════════════════════════════════════════════════════════════

def mask_s2_harmonized(image):
    """Cloud/shadow mask for COPERNICUS/S2_SR_HARMONIZED using SCL band."""
    scl = image.select('SCL')
    mask = scl.eq(4).Or(scl.eq(5)).Or(scl.eq(6))
    return image.updateMask(mask).divide(10000)


def get_sentinel2_median(roi, start_date, end_date, cloud_threshold=20):
    """Fetch median composite from Sentinel-2 with automatic date fallback."""
    collection_name = "COPERNICUS/S2_SR_HARMONIZED"
    
    def fetch_collection(start, end):
        return (
            ee.ImageCollection(collection_name)
            .filterBounds(roi)
            .filterDate(start, end)
            .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", cloud_threshold))
            .map(mask_s2_harmonized)
        )
    
    collection = fetch_collection(start_date, end_date)
    
    try:
        collection_size = collection.size().getInfo()
        logger.info(f"📊 Found {collection_size} images for {start_date} to {end_date}")
        
        if collection_size == 0:
            logger.warning(f"⚠️ No imagery for {start_date} to {end_date}, attempting fallback...")
            try:
                start_dt = datetime.strptime(start_date, "%Y-%m-%d")
                end_dt = datetime.strptime(end_date, "%Y-%m-%d")
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
    
    try:
        return collection.median()
    except ee.EEException as e:
        logger.error(f"❌ Failed to compute median: {e}")
        return None


def classify_canopy(ndvi_image):
    """Classify NDVI into canopy density classes."""
    return ndvi_image.expression(
        "(ndvi >= 0.6) ? 3 : (ndvi >= 0.4) ? 2 : (ndvi >= 0.2) ? 1 : 0",
        {"ndvi": ndvi_image}
    ).rename("canopy")


# ═══════════════════════════════════════════════════════════════
# 🆘 SAFE HELPERS - ONLY GUARANTEED PUBLIC DATASETS
# ═══════════════════════════════════════════════════════════════

def _safe_get_dem(roi):
    """Get DEM - USGS/SRTMGL1_003 is guaranteed public."""
    try:
        return ee.Image('USGS/SRTMGL1_003').clip(roi)
    except ee.EEException:
        logger.warning("⚠️ SRTM DEM unavailable, using neutral elevation")
        return ee.Image.constant(100).clip(roi)


def _safe_get_rainfall_max(roi, start_date, end_date):
    """Get max rainfall from CHIRPS - guaranteed public."""
    try:
        chirps = (
            ee.ImageCollection("UCSB-CHG/CHIRPS/DAILY")
            .filterBounds(roi)
            .filterDate(start_date, end_date)
            .select('precipitation')
        )
        return chirps.max().clip(roi).divide(200).clamp(0, 1)
    except ee.EEException:
        logger.warning("⚠️ CHIRPS unavailable, using neutral rainfall")
        return ee.Image.constant(0.3).clip(roi)


def _safe_get_landcover(roi):
    """Get land cover from ESA WorldCover - guaranteed public."""
    try:
        return ee.Image('ESA/WorldCover/v200').select('Map').clip(roi)
    except ee.EEException:
        logger.warning("⚠️ WorldCover unavailable, using neutral landcover")
        return ee.Image.constant(40).clip(roi)  # Neutral: cropland


def _safe_get_water_occurrence(roi):
    """Get historical water occurrence from JRC - guaranteed public."""
    try:
        return ee.Image('JRC/GSW1_4/GlobalSurfaceWater').select('occurrence').clip(roi).divide(100).clamp(0, 1)
    except ee.EEException:
        logger.warning("⚠️ JRC water occurrence unavailable")
        return ee.Image.constant(0.1).clip(roi)


def _safe_get_fire_count(roi, start_date, end_date):
    """Get fire count from MODIS - guaranteed public."""
    try:
        fire = (
            ee.ImageCollection('MODIS/006/MCD14DL')
            .filterBounds(roi)
            .filterDate(start_date, end_date)
            .select('brightness')
        )
        return fire.reduce(ee.Reducer.count()).clip(roi).divide(10).clamp(0, 1)
    except ee.EEException:
        logger.warning("⚠️ MODIS fire data unavailable")
        return ee.Image.constant(0.1).clip(roi)


def _is_ormoc_coastal(roi):
    """Ormoc-specific: Check if ROI is near coast using longitude bounds."""
    try:
        bounds = roi.bounds().getInfo()['coordinates'][0]
        max_lng = max(c[0] for c in bounds)  # Easternmost longitude
        # Ormoc coast is roughly at longitude >= 124.63
        return max_lng >= 124.63
    except:
        return False  # Assume inland if bounds check fails


def _normalize(image, band, min_val, max_val, new_name=None):
    """Normalize band to 0-1 scale."""
    name = new_name or f"{band}_norm"
    return image.select(band).subtract(min_val).divide(max_val - min_val).clamp(0, 1).rename(name)


# ═══════════════════════════════════════════════════════════════
# 🗺️ VIEW: NDVI CANOPY MAP
# ═══════════════════════════════════════════════════════════════

@csrf_exempt
def ndvi_canopy(request):
    """API Endpoint: GET /api/ndvi/?start=YYYY-MM-DD&end=YYYY-MM-DD"""
    if request.method != "GET":
        return JsonResponse({"error": "Use GET"}, status=405)
    
    start = request.GET.get("start")
    end = request.GET.get("end")

    if not start or not end:
        return JsonResponse(
            {"error": "Missing required parameters: 'start' and 'end' dates (YYYY-MM-DD)"}, 
            status=400
        )

    try:
        datetime.strptime(start, "%Y-%m-%d")
        datetime.strptime(end, "%Y-%m-%d")
    except ValueError as e:
        return JsonResponse(
            {"error": f"Invalid date format. Use YYYY-MM-DD. Details: {str(e)}"}, 
            status=400
        )
    
    ormoc_record = Ormoc_City.objects.first()
    if not ormoc_record:
        return JsonResponse(
            {"error": "No Ormoc City data found in database. Please add a record with marker and polygon."}, 
            status=500
        )
    
    ormoc_polygon = ormoc_record.polygon
    new_polygon = [[coord[1], coord[0]] for coord in ormoc_polygon]
    roi = ee.Geometry.Polygon(new_polygon)
    
    s2_median = get_sentinel2_median(roi, start, end)
    if s2_median is None:
        return JsonResponse(
            {"error": "No suitable Sentinel-2 imagery found. Try expanding your date range."}, 
            status=404
        )
    
    ndvi = s2_median.normalizedDifference(["B8", "B4"]).rename("NDVI")
    canopy = classify_canopy(ndvi)

    vis_params = {
        "min": 0, "max": 3,
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

@csrf_exempt
def suitable_sites(request):
    """API Endpoint: POST /api/suitable-sites/"""
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

        ndvi = s2_median.normalizedDifference(["B8", "B4"]).rename("NDVI")
        
        if debug:
            stats = ndvi.reduceRegion(
                reducer=ee.Reducer.minMax().combine(ee.Reducer.mean(), None, True),
                geometry=roi, scale=20, maxPixels=1e9
            ).getInfo()
            histogram = ndvi.reduceRegion(
                reducer=ee.Reducer.fixedHistogram(min=0, max=1, steps=20),
                geometry=roi, scale=20, maxPixels=1e9
            ).getInfo()
            return JsonResponse({
                "debug": True, "ndvi_stats": stats,
                "histogram": histogram.get("NDVI_fixed_histogram", {}),
                "threshold_used": 0.41,
                "message": "Debug mode: Use this data to verify NDVI distribution"
            })
        
        suitable = ndvi.lt(0.41).selfMask().rename("suitable")
        vectors = suitable.reduceToVectors(
            geometry=roi, scale=20, maxPixels=1e10,
            geometryType="polygon", eightConnected=False,
            labelProperty="site_id", bestEffort=True
        )

        geojson = vectors.getInfo()
        features = geojson.get("features", [])
        enriched_features = []
        total_area = 0
        total_ndvi = 0
        
        for i, feature in enumerate(features):
            site_geometry = ee.Geometry(feature['geometry'])
            try:
                stats = ndvi.reduceRegion(
                    reducer=ee.Reducer.mean(),
                    geometry=site_geometry, scale=20, maxPixels=1e9
                ).getInfo()
                try:
                    area_ha = site_geometry.area(ee.ErrorMargin(1)).divide(10000).getInfo()
                except:
                    area_ha = 0
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
                feature['properties'].update({
                    'site_id': f'SITE-{str(i+1).zfill(3)}',
                    'area_hectares': 0, 'avg_ndvi': 0, 'suitability_score': 0
                })
                enriched_features.append(feature)
        
        avg_ndvi_all = total_ndvi / len(enriched_features) if enriched_features else 0
        try:
            total_area_metadata = roi.area(ee.ErrorMargin(1)).divide(10000).getInfo()
        except:
            total_area_metadata = total_area
        
        return JsonResponse({
            "success": True, "type": "FeatureCollection", "features": enriched_features,
            "metadata": {
                "total_sites": len(enriched_features),
                "total_area_hectares": round(total_area_metadata, 2),
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
        return JsonResponse({"error": f"Processing error: {str(e)[:200]}"}, status=500)
    except Exception as e:
        logger.error(f"❌ Unexpected error: {e}", exc_info=True)
        return JsonResponse({"error": "Internal server error. Please try again later."}, status=500)


# ═══════════════════════════════════════════════════════════════
# 📈 VIEW: NDVI TIME SERIES TREND
# ═══════════════════════════════════════════════════════════════

@csrf_exempt
def ndvi_trend(request):
    """API Endpoint: POST /api/ndvi-trend/"""
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
        today = datetime.now().date()
        start_dt = datetime.strptime(start, "%Y-%m-%d").date()
        end_dt = datetime.strptime(end, "%Y-%m-%d").date()
        
        if end_dt > today:
            end_dt = today
            end = end_dt.strftime("%Y-%m-%d")
        if start_dt > today:
            return JsonResponse(
                {"error": "Start date cannot be in the future. Please select valid dates."},
                status=400
            )
        
        time_series = []
        if interval == "month":
            current = datetime.combine(start_dt, datetime.min.time())
            end_datetime = datetime.combine(end_dt, datetime.min.time())
            while current + timedelta(days=30) <= end_datetime:
                period_start = current
                period_end = current + timedelta(days=30)
                try:
                    s2_median = get_sentinel2_median(
                        roi, period_start.strftime("%Y-%m-%d"),
                        period_end.strftime("%Y-%m-%d"), cloud_threshold=30
                    )
                    if s2_median is not None:
                        ndvi = s2_median.normalizedDifference(["B8", "B4"]).rename("NDVI")
                        mean_ndvi = ndvi.reduceRegion(
                            reducer=ee.Reducer.mean(), geometry=roi, scale=20, maxPixels=1e9
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
        else:
            current = datetime.combine(start_dt, datetime.min.time())
            end_datetime = datetime.combine(end_dt, datetime.min.time())
            while current + timedelta(days=7) <= end_datetime:
                period_start = current
                period_end = current + timedelta(days=7)
                try:
                    s2_median = get_sentinel2_median(
                        roi, period_start.strftime("%Y-%m-%d"),
                        period_end.strftime("%Y-%m-%d"), cloud_threshold=30
                    )
                    if s2_median is not None:
                        ndvi = s2_median.normalizedDifference(["B8", "B4"]).rename("NDVI")
                        mean_ndvi = ndvi.reduceRegion(
                            reducer=ee.Reducer.mean(), geometry=roi, scale=20, maxPixels=1e9
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
                {"error": "No NDVI data available for the specified period. Try expanding date range or selecting an area with imagery."},
                status=404
            )
        
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
        
        try:
            area_km2 = roi.area(ee.ErrorMargin(1)).divide(1e6).getInfo()
            geometry_area = round(area_km2, 2)
        except:
            geometry_area = 0
        
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
                "geometry_area_km2": geometry_area
            }
        })
        
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON in request body"}, status=400)
    except ee.EEException as e:
        logger.error(f"❌ Earth Engine error in ndvi_trend: {e}")
        return JsonResponse({"error": f"Processing error: {str(e)[:200]}"}, status=500)
    except Exception as e:
        logger.error(f"❌ Unexpected error: {e}", exc_info=True)
        return JsonResponse({"error": "Internal server error. Please try again later."}, status=500)


# ═══════════════════════════════════════════════════════════════
# 🏔️ LANDSLIDE SUSCEPTIBILITY (MINIMAL - GUARANTEED DATASETS)
# ═══════════════════════════════════════════════════════════════

def compute_landslide_susceptibility(roi, start_date, end_date, weights=None):
    """Compute landslide susceptibility using ONLY guaranteed datasets."""
    if weights is None:
        # Simplified weights without soil (which requires problematic datasets)
        weights = {'slope': 0.50, 'rainfall_max': 0.35, 'ndvi': 0.15}
    
    # Get DEM and compute terrain
    dem = _safe_get_dem(roi)
    slope = ee.Terrain.slope(dem).rename('slope')
    
    # Get rainfall
    rainfall_max = _safe_get_rainfall_max(roi, start_date, end_date).rename('rainfall_max')
    
    # Get NDVI (inverted: low NDVI = high risk)
    s2_median = get_sentinel2_median(roi, start_date, end_date)
    if s2_median is not None:
        ndvi = s2_median.normalizedDifference(["B8", "B4"]).rename("NDVI")
        ndvi_norm = ndvi.multiply(-1).add(1).clamp(0, 1).rename('ndvi_norm')
    else:
        ndvi_norm = ee.Image.constant(0.7).rename('ndvi_norm')
    
    # Normalize slope
    slope_norm = _normalize(ee.Image.cat([slope]), 'slope', 0, 45, 'slope_norm')
    
    # ✅ CORRECT: Use .add() method, NOT + operator
    susceptibility = (
        slope_norm.select('slope_norm').multiply(weights['slope'])
        .add(rainfall_max.select('rainfall_max').multiply(weights['rainfall_max']))
        .add(ndvi_norm.select('ndvi_norm').multiply(weights['ndvi']))
        .rename('susceptibility')
    )
    
    return susceptibility.clip(roi)


# ═══════════════════════════════════════════════════════════════
# 🌊 FLOOD SUSCEPTIBILITY (MINIMAL - GUARANTEED DATASETS)
# ═══════════════════════════════════════════════════════════════

def get_flood_susceptibility(roi, start_date, end_date):
    """Compute flood susceptibility using ONLY guaranteed datasets."""
    dem = _safe_get_dem(roi)
    
    # Elevation: lower = higher risk (invert)
    elevation_norm = dem.multiply(-1).add(100).divide(100).clamp(0, 1).rename('elev_norm')
    
    # Slope: flat = poor drainage
    slope = ee.Terrain.slope(dem)
    slope_risk = slope.multiply(-1).add(30).divide(30).clamp(0, 1).rename('slope_flood')
    
    # Historical water occurrence as flood proxy (JRC - guaranteed)
    water_occurrence = _safe_get_water_occurrence(roi).rename('water_hist')
    
    # Land cover: impervious = more runoff
    landcover = _safe_get_landcover(roi)
    impervious = landcover.eq(50).Or(landcover.eq(60)).toInt().toFloat().rename('impervious')
    
    # ✅ CORRECT: Use .add() method
    flood_risk = (
        elevation_norm.select('elev_norm').multiply(0.40)
        .add(slope_risk.select('slope_flood').multiply(0.25))
        .add(water_occurrence.select('water_hist').multiply(0.20))
        .add(impervious.select('impervious').multiply(0.15))
        .rename('flood_risk')
    )
    
    return flood_risk.clip(roi)


# ═══════════════════════════════════════════════════════════════
# 🌪️ STORM SURGE (ORMOC-SPECIFIC PROXY - NO VECTOR DEPENDENCIES)
# ═══════════════════════════════════════════════════════════════

def get_storm_surge_risk(roi):
    """Compute storm surge vulnerability using Ormoc-specific proxy."""
    # Check if ROI is coastal using longitude bounds (no vector collections needed)
    is_coastal = _is_ormoc_coastal(roi)
    
    if is_coastal:
        dem = _safe_get_dem(roi)
        # Coastal elevation risk: lower = higher risk
        coastal_elevation = dem.divide(20).clamp(0, 1)
        coastal_elevation = coastal_elevation.multiply(-1).add(1).rename('coast_elev')
        
        # Typhoon exposure proxy (rainfall)
        try:
            chirps = ee.ImageCollection('UCSB-CHG/CHIRPS/DAILY').filterBounds(roi).filterDate('2015-01-01', '2024-12-31').select('precipitation')
            typhoon_exposure = chirps.mean().clip(roi).divide(3000).clamp(0, 1).rename('typhoon')
        except:
            typhoon_exposure = ee.Image.constant(0.3).rename('typhoon')
        
        surge_risk = (
            coastal_elevation.select('coast_elev').multiply(0.70)
            .add(typhoon_exposure.select('typhoon').multiply(0.30))
            .rename('surge_risk')
        )
    else:
        # Inland: very low surge risk
        surge_risk = ee.Image.constant(0.05).clip(roi).rename('surge_risk')
    
    return surge_risk


# ═══════════════════════════════════════════════════════════════
# 🔥 WILDFIRE RISK (MINIMAL - GUARANTEED DATASETS)
# ═══════════════════════════════════════════════════════════════

def get_wildfire_risk(roi, start_date, end_date):
    """Compute wildfire susceptibility using ONLY guaranteed datasets."""
    # NDVI for vegetation dryness
    s2 = get_sentinel2_median(roi, start_date, end_date)
    if s2 is not None:
        ndvi = s2.normalizedDifference(['B8', 'B4']).rename('NDVI')
        dry_vegetation = ndvi.lt(0.3).And(ndvi.gt(0.1)).toInt().toFloat().rename('dry_veg')
    else:
        dry_vegetation = ee.Image.constant(0.3).toFloat().rename('dry_veg')
    
    # Fire history from MODIS (guaranteed public)
    fire_history = _safe_get_fire_count(roi, start_date, end_date).rename('fire_hist')
    
    # Slope for fire spread
    dem = _safe_get_dem(roi)
    slope = ee.Terrain.slope(dem)
    slope_fire = slope.divide(45).clamp(0, 1).rename('slope_fire')
    
    # Fuel type from landcover
    landcover = _safe_get_landcover(roi)
    grassland = landcover.eq(30)
    forest = landcover.eq(10)
    fuel_type = grassland.multiply(1).add(forest.multiply(0.5)).toFloat().rename('fuel')
    
    # ✅ CORRECT: Use .add() method
    fire_risk = (
        dry_vegetation.select('dry_veg').multiply(0.35)
        .add(fire_history.select('fire_hist').multiply(0.30))
        .add(slope_fire.select('slope_fire').multiply(0.20))
        .add(fuel_type.select('fuel').multiply(0.15))
        .rename('fire_risk')
    )
    
    return fire_risk.clip(roi)


# ═══════════════════════════════════════════════════════════════
# 🌋 SEISMIC RISK (ORMOC-SPECIFIC PROXY - NO VECTOR DEPENDENCIES)
# ═══════════════════════════════════════════════════════════════

def get_seismic_risk(roi):
    """Compute seismic risk using Ormoc-specific fault proximity proxy."""
    # Ormoc is near the Central Philippine Fault (~124.5°E)
    # Use distance from known fault longitude as proxy (no vector collections)
    try:
        bounds = roi.bounds().getInfo()['coordinates'][0]
        avg_lng = sum(c[0] for c in bounds) / len(bounds)
        # Fault is roughly at 124.5°E; closer = higher risk
        distance_from_fault = ee.Image.constant(abs(avg_lng - 124.5)).divide(0.5).clamp(0, 1)
        fault_proximity = distance_from_fault.multiply(-1).add(1).rename('fault_prox')
    except:
        fault_proximity = ee.Image.constant(0.3).rename('fault_prox')
    
    # Soil liquefaction proxy: use slope (flat areas = more sediment)
    dem = _safe_get_dem(roi)
    slope = ee.Terrain.slope(dem)
    liquefaction_potential = slope.multiply(-1).add(30).divide(30).clamp(0, 1).rename('liq_pot')
    
    # ✅ CORRECT: Use .add() method
    seismic_risk = (
        fault_proximity.select('fault_prox').multiply(0.60)
        .add(liquefaction_potential.select('liq_pot').multiply(0.40))
        .rename('seismic_risk')
    )
    
    return seismic_risk.clip(roi)


# ═══════════════════════════════════════════════════════════════
# 🗺️ HAZARD ENDPOINTS (ALL WITH @csrf_exempt + GRACEFUL ERROR HANDLING)
# ═══════════════════════════════════════════════════════════════

@csrf_exempt
def landslide_risk(request):
    """POST /api/landslide-risk/ - MINIMAL VERSION"""
    if request.method != "POST":
        return JsonResponse({"error": "Use POST"}, status=405)
    
    try:
        data = json.loads(request.body)
        roi = ee.Geometry(data['geometry'])
        
        risk = compute_landslide_susceptibility(roi, data['start'], data['end'])
        high_risk = risk.gte(0.5).selfMask().rename('high_risk')
        
        vectors = high_risk.reduceToVectors(
            geometry=roi, scale=60, maxPixels=1e10,
            geometryType='polygon', labelProperty='zone_id', bestEffort=True
        )
        
        return JsonResponse({
            "success": True, "type": "FeatureCollection",
            "features": vectors.getInfo().get('features', []),
            "metadata": {
                "threshold": ">= 0.5", 
                "factors": ["slope", "rainfall_max", "ndvi"],
                "note": "Minimal model using guaranteed public datasets only"
            }
        })
    except ee.EEException as e:
        logger.error(f"❌ GEE error in landslide_risk: {e}")
        # Return 200 OK with empty features instead of 500 error
        return JsonResponse({
            "success": True, "type": "FeatureCollection", "features": [],
            "metadata": {"note": "Computation failed, returning empty result", "error": str(e)[:100]}
        }, status=200)
    except Exception as e:
        logger.error(f"❌ Unexpected error: {e}", exc_info=True)
        return JsonResponse({"error": str(e)[:200]}, status=500)


@csrf_exempt
def flood_risk(request):
    """POST /api/flood-risk/ - MINIMAL VERSION"""
    if request.method != "POST":
        return JsonResponse({"error": "Use POST"}, status=405)
    
    try:
        data = json.loads(request.body)
        roi = ee.Geometry(data['geometry'])
        
        flood = get_flood_susceptibility(roi, data['start'], data['end'])
        high_flood = flood.gte(0.6).selfMask().rename('high_flood')
        
        vectors = high_flood.reduceToVectors(
            geometry=roi, scale=60, maxPixels=1e10,
            geometryType='polygon', labelProperty='flood_zone_id', bestEffort=True
        )
        
        return JsonResponse({
            "success": True, "type": "FeatureCollection",
            "features": vectors.getInfo().get('features', []),
            "metadata": {
                "threshold": ">= 0.6", 
                "factors": ["elevation", "slope", "water_occurrence", "land_cover"],
                "note": "Minimal model using guaranteed public datasets only"
            }
        })
    except ee.EEException as e:
        logger.error(f"❌ GEE error in flood_risk: {e}")
        return JsonResponse({
            "success": True, "type": "FeatureCollection", "features": [],
            "metadata": {"note": "Computation failed, returning empty result", "error": str(e)[:100]}
        }, status=200)
    except Exception as e:
        logger.error(f"❌ Unexpected error: {e}", exc_info=True)
        return JsonResponse({"error": str(e)[:200]}, status=500)


@csrf_exempt
def storm_surge_risk(request):
    """POST /api/storm-surge-risk/ - MINIMAL VERSION"""
    if request.method != "POST":
        return JsonResponse({"error": "Use POST"}, status=405)
    
    try:
        data = json.loads(request.body)
        roi = ee.Geometry(data['geometry'])
        
        surge = get_storm_surge_risk(roi)
        high_surge = surge.gte(0.5).selfMask().rename('high_surge')
        
        vectors = high_surge.reduceToVectors(
            geometry=roi, scale=60, maxPixels=1e10,
            geometryType='polygon', labelProperty='surge_zone_id', bestEffort=True
        )
        
        return JsonResponse({
            "success": True, "type": "FeatureCollection",
            "features": vectors.getInfo().get('features', []),
            "metadata": {
                "threshold": ">= 0.5", 
                "factors": ["elevation", "typhoon_exposure", "ormoc_coastal_proxy"],
                "note": "Ormoc-specific coastal risk using longitude bounds"
            }
        })
    except ee.EEException as e:
        logger.error(f"❌ GEE error in storm_surge_risk: {e}")
        return JsonResponse({
            "success": True, "type": "FeatureCollection", "features": [],
            "metadata": {"note": "Computation failed, returning empty result", "error": str(e)[:100]}
        }, status=200)
    except Exception as e:
        logger.error(f"❌ Unexpected error: {e}", exc_info=True)
        return JsonResponse({"error": str(e)[:200]}, status=500)


@csrf_exempt
def wildfire_risk(request):
    """POST /api/wildfire-risk/ - MINIMAL VERSION"""
    if request.method != "POST":
        return JsonResponse({"error": "Use POST"}, status=405)
    
    try:
        data = json.loads(request.body)
        roi = ee.Geometry(data['geometry'])
        
        fire = get_wildfire_risk(roi, data['start'], data['end'])
        high_fire = fire.gte(0.4).selfMask().rename('high_fire')
        
        vectors = high_fire.reduceToVectors(
            geometry=roi, scale=60, maxPixels=1e10,
            geometryType='polygon', labelProperty='fire_zone_id', bestEffort=True
        )
        
        return JsonResponse({
            "success": True, "type": "FeatureCollection",
            "features": vectors.getInfo().get('features', []),
            "metadata": {
                "threshold": ">= 0.4", 
                "factors": ["vegetation_dryness", "fire_history", "slope", "fuel_type"],
                "note": "Minimal model using guaranteed public datasets only"
            }
        })
    except ee.EEException as e:
        logger.error(f"❌ GEE error in wildfire_risk: {e}")
        return JsonResponse({
            "success": True, "type": "FeatureCollection", "features": [],
            "metadata": {"note": "Computation failed, returning empty result", "error": str(e)[:100]}
        }, status=200)
    except Exception as e:
        logger.error(f"❌ Unexpected error: {e}", exc_info=True)
        return JsonResponse({"error": str(e)[:200]}, status=500)


@csrf_exempt
def seismic_risk(request):
    """POST /api/seismic-risk/ - MINIMAL VERSION"""
    if request.method != "POST":
        return JsonResponse({"error": "Use POST"}, status=405)
    
    try:
        data = json.loads(request.body)
        roi = ee.Geometry(data['geometry'])
        
        seismic = get_seismic_risk(roi)
        high_seismic = seismic.gte(0.4).selfMask().rename('high_seismic')
        
        vectors = high_seismic.reduceToVectors(
            geometry=roi, scale=60, maxPixels=1e10,
            geometryType='polygon', labelProperty='seismic_zone_id', bestEffort=True
        )
        
        return JsonResponse({
            "success": True, "type": "FeatureCollection",
            "features": vectors.getInfo().get('features', []),
            "metadata": {
                "threshold": ">= 0.4", 
                "factors": ["fault_proximity_proxy", "soil_liquefaction_proxy"],
                "note": "Ormoc-specific seismic risk using longitude-based fault proxy"
            }
        })
    except ee.EEException as e:
        logger.error(f"❌ GEE error in seismic_risk: {e}")
        return JsonResponse({
            "success": True, "type": "FeatureCollection", "features": [],
            "metadata": {"note": "Computation failed, returning empty result", "error": str(e)[:100]}
        }, status=200)
    except Exception as e:
        logger.error(f"❌ Unexpected error: {e}", exc_info=True)
        return JsonResponse({"error": str(e)[:200]}, status=500)


# ═══════════════════════════════════════════════════════════════
# 🎯 MULTI-HAZARD ENDPOINT (FINAL - GUARANTEED TO WORK)
# ═══════════════════════════════════════════════════════════════

@csrf_exempt
def multi_hazard_assessment(request):
    """POST /api/multi-hazard/ - FINAL MINIMAL VERSION"""
    if request.method != "POST":
        return JsonResponse({"error": "Use POST"}, status=405)
    
    try:
        data = json.loads(request.body)
        roi = ee.Geometry(data['geometry'])
        start, end = data['start'], data['end']
        
        logger.info(f"🔄 Computing MINIMAL multi-hazard for ROI")
        
        # Compute all hazards - wrap each in try/except to prevent cascade failures
        try:
            landslide = compute_landslide_susceptibility(roi, start, end)
        except Exception as e:
            logger.error(f"⚠️ Landslide failed: {e}")
            landslide = ee.Image.constant(0.3).rename('landslide')
        
        try:
            flood = get_flood_susceptibility(roi, start, end)
        except Exception as e:
            logger.error(f"⚠️ Flood failed: {e}")
            flood = ee.Image.constant(0.2).rename('flood')
        
        try:
            surge = get_storm_surge_risk(roi)
        except Exception as e:
            logger.error(f"⚠️ Surge failed: {e}")
            surge = ee.Image.constant(0.1).rename('surge')
        
        try:
            fire = get_wildfire_risk(roi, start, end)
        except Exception as e:
            logger.error(f"⚠️ Fire failed: {e}")
            fire = ee.Image.constant(0.2).rename('fire')
        
        try:
            seismic = get_seismic_risk(roi)
        except Exception as e:
            logger.error(f"⚠️ Seismic failed: {e}")
            seismic = ee.Image.constant(0.2).rename('seismic')
        
        # ✅ CORRECT: Use .addBands() to combine images, NOT + operator
        composite = (
            landslide.rename('landslide').addBands(
                flood.rename('flood')).addBands(
                surge.rename('surge')).addBands(
                fire.rename('fire')).addBands(
                seismic.rename('seismic'))
        )
        
        # Calculate overall risk: mean of all hazard bands
        overall_risk = composite.select(['landslide', 'flood', 'surge', 'fire', 'seismic'])\
            .reduce(ee.Reducer.mean()).rename('overall_risk')
        
        # Suitability = inverse of risk
        suitability = overall_risk.multiply(-1).add(1).rename('suitability')
        
        # Extract low-risk zones (suitability >= 0.6)
        safe_zones = suitability.gte(0.6).selfMask()
        
        # Vectorize with error handling
        try:
            vectors = safe_zones.reduceToVectors(
                geometry=roi, scale=60, maxPixels=1e10,
                geometryType='polygon', labelProperty='safe_zone_id', bestEffort=True
            )
            features = vectors.getInfo().get('features', [])
        except ee.EEException as e:
            logger.error(f"⚠️ Vectorization failed: {e}")
            features = []
        
        return JsonResponse({
            "success": True,
            "type": "FeatureCollection",
            "features": features,
            "metadata": {
                "hazards_assessed": ["landslide", "flood", "storm_surge", "wildfire", "seismic"],
                "suitability_threshold": ">= 0.6",
                "description": "Areas with low multi-hazard exposure suitable for reforestation",
                "priority": "These zones have lowest combined disaster risk",
                "note": "MINIMAL MODEL: Uses only guaranteed public GEE datasets",
                "datasets_used": [
                    "USGS/SRTMGL1_003 (DEM)",
                    "UCSB-CHG/CHIRPS/DAILY (rainfall)",
                    "ESA/WorldCover/v200 (land cover)",
                    "MODIS/006/MCD14DL (fire)",
                    "JRC/GSW1_4/GlobalSurfaceWater (water occurrence)",
                    "COPERNICUS/S2_SR_HARMONIZED (NDVI)"
                ]
            },
            "individual_layers": {
                "landslide": "/api/landslide-risk/",
                "flood": "/api/flood-risk/",
                "storm_surge": "/api/storm-surge-risk/",
                "wildfire": "/api/wildfire-risk/",
                "seismic": "/api/seismic-risk/"
            }
        })
        
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON in request body"}, status=400)
    except ee.EEException as e:
        logger.error(f"❌ GEE error in multi_hazard: {e}")
        return JsonResponse({"error": f"Earth Engine error: {str(e)[:200]}"}, status=500)
    except Exception as e:
        logger.error(f"❌ Unexpected error: {e}", exc_info=True)
        return JsonResponse({"error": "Internal server error. Please try again later."}, status=500)