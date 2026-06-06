import ee
import logging
import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

# ✅ IMPORT ORMOC CITY MODEL (Just like views_ndvi.py)
from ormoc_city.models import Ormoc_City 
from . import gee_helpers
from .views_ndvi import get_sentinel2_median
from .models import HazardProneSite, Reforestation_areas

logger = logging.getLogger(__name__)

def compute_landslide_lsi(roi, start_date, end_date):
    """
    Computes the continuous Landslide Susceptibility Index (LSI) from 0.0 to 1.0.
    """
    # 1. Topography: Slope (35%) and Elevation (10%)
    dem = gee_helpers.safe_get_dem(roi)
    slope = ee.Terrain.slope(dem) 
    slope_norm = slope.divide(45).clamp(0, 1) 
    elev_norm = dem.divide(1000).clamp(0, 1)  
    
    # 2. Hydrology: Max Rainfall (25%)
    max_rain_norm = gee_helpers.safe_get_rainfall_max(roi, start_date, end_date)
    
    # 3. Geology: Soil (15%)
    # ⚠️ FIX: OpenLandMap is no longer publicly accessible in GEE.
    # We use a neutral constant (0.5) so it adds a flat baseline without breaking the map.
    # The spatial variance is still accurately captured by Slope, Rain, NDVI, and Elevation.
    soil_norm = ee.Image.constant(0.5).clip(roi) 
    
    # 4. Vegetation: Inverted NDVI (15%)
    s2 = get_sentinel2_median(roi, start_date, end_date)
    if s2:
        ndvi = s2.normalizedDifference(["B8", "B4"]).clamp(0, 1)
        ndvi_inv = ndvi.multiply(-1).add(1) 
    else:
        ndvi_inv = ee.Image.constant(0.5)
        
    # 5. Calculate Final LSI (Weights still equal 100%)
    lsi = (
        slope_norm.multiply(0.35)
        .add(max_rain_norm.multiply(0.25))
        .add(soil_norm.multiply(0.15))      # 15% weight maintained safely
        .add(ndvi_inv.multiply(0.15))
        .add(elev_norm.multiply(0.10))
        .rename('LSI')
    ).clip(roi)
    
    return lsi

def classify_lsi(lsi_image):
    """Classifies the continuous LSI into 5 discrete classes."""
    classified = lsi_image.expression(
        "(LSI < 0.15) ? 1 : " +   # Very Low
        "(LSI < 0.30) ? 2 : " +   # Low
        "(LSI < 0.45) ? 3 : " +   # Moderate
        "(LSI < 0.60) ? 4 : " +   # High
        "5",                       # Very High (>= 0.60)
        {"LSI": lsi_image}
    ).rename('class').toInt()
    return classified


@csrf_exempt
def landslide_risk_map(request):
    """
    POST /api/landslide-risk/
    Generates a 5-class colored raster map tile URL for Landslide Susceptibility.
    Only Classes 3-5 (Moderate to Very High) within ROI are visible.
    """
    if request.method != "POST":
        return JsonResponse({"error": "Use POST"}, status=405)
    
    try:
        data = json.loads(request.body)
        start = data.get('start')
        end = data.get('end')
        
        if not start or not end:
            return JsonResponse({"error": "Missing start/end dates"}, status=400)
            
        ormoc = Ormoc_City.objects.first()
        if not ormoc:
            return JsonResponse({"error": "Ormoc City config not found"}, status=500)
        
        poly_coords = [[c[1], c[0]] for c in ormoc.polygon]
        roi = ee.Geometry.Polygon(poly_coords)
        
        logger.info(f"🌋 Computing Landslide LSI for Ormoc City from {start} to {end}")
        
        # 1. Compute the continuous LSI
        lsi = compute_landslide_lsi(roi, start, end)
        
        # 2. Classify into 5 discrete classes
        classified = classify_lsi(lsi)
        
        # 3. ✅ FIRST: Create ROI mask (mask outside ROI)
        roi_mask = ee.Image.constant(1).clip(roi).mask()
        
        # 4. ✅ SECOND: Create class mask (only keep Classes 3-5)
        class_mask = classified.gte(3)
        
        # 5. ✅ Combine both masks: Must be inside ROI AND Class >= 3
        combined_mask = roi_mask.And(class_mask)
        
        # 6. Apply combined mask
        classified_masked = classified.updateMask(combined_mask)
        
        # 7. Palette for Classes 3-5 only
        palette = [
            '#FFEB9C', # 3: Moderate (Yellow)
            '#FFC000', # 4: High (Orange)
            '#9C0006'  # 5: Very High (Dark Red)
        ]
        
        map_id = classified_masked.getMapId({
            'min': 3,
            'max': 5,
            'palette': palette
        })
        
        logger.info("✅ Landslide map tiles generated successfully (Only Classes 3-5 in ROI visible)")
        
        return JsonResponse({
            "success": True,
            "tile_url": map_id["tile_fetcher"].url_format,
            "date_range": f"{start} to {end}",
            "legend": {
                "3": {"name": "Moderate", "color": "#FFEB9C"},
                "4": {"name": "High", "color": "#FFC000"},
                "5": {"name": "Very High", "color": "#9C0006"}
            },
            "bounds": roi.getInfo()["coordinates"]
        })
        
    except Exception as e:
        logger.error(f"❌ Landslide map error: {e}", exc_info=True)
        return JsonResponse({
            "success": False,
            "error": "Map generation failed", 
            "details": str(e)[:200]
        }, status=500)


# ═══════════════════════════════════════════════════════════════
# 🌊 FLOOD SUSCEPTIBILITY INDEX (FSI) LOGIC - FINAL FIX
# Aligned with PLANTSCOPE Documentation v3.0
# CALIBRATED to match HazardHunterPH patterns
# ═══════════════════════════════════════════════════════════════
def compute_flood_fsi(roi, start_date, end_date):
    """
    Computes the continuous Flood Susceptibility Index (FSI) from 0.0 to 1.0.
    MOUNTAIN-OPTIMIZED PARAMETERS
    """
    dem = gee_helpers.safe_get_dem(roi)
    slope = ee.Terrain.slope(dem)
    
    # ✅ ELEVATION: 0m = 1.0 risk, 250m = 0.0 risk (increased from 150m)
    # Mountains >200m should have near-zero elevation risk
    elev_norm = dem.multiply(-1).add(250).divide(250).clamp(0, 1)
    
    # ✅ SLOPE: 0° = 1.0 risk, 25° = 0.0 risk (increased from 15°)
    # Very steep slopes (>20°) drain extremely well
    slope_norm = slope.multiply(-1).add(25).divide(25).clamp(0, 1)
    
    # ✅ Use v4 which excludes mountain lakes
    water_dist_risk = gee_helpers.safe_get_distance_to_water_v4(roi)
    
    # ✅ RAINFALL: 5000mm threshold (increased from 4000mm)
    # Even heavy mountain rain (3000mm) gets low risk score
    total_rain = gee_helpers.safe_get_total_rainfall(roi, start_date, end_date)
    total_rain_norm = total_rain.divide(5000).clamp(0, 1)
    
    fsi = (
        elev_norm.multiply(0.35)
        .add(slope_norm.multiply(0.25))
        .add(water_dist_risk.multiply(0.25))
        .add(total_rain_norm.multiply(0.15))
        .rename('FSI')
    ).clip(roi)
    
    return fsi


def classify_fsi(fsi_image):
    """
    ADJUSTED THRESHOLDS - More realistic for coastal cities:
    - FSI < 0.25 = Class 1 (Very Low)
    - FSI 0.25-0.40 = Class 2 (Low)
    - FSI 0.40-0.55 = Class 3 (Moderate)
    - FSI 0.55-0.70 = Class 4 (High)
    - FSI > 0.70 = Class 5 (Very High) ← More restrictive
    """
    classified = fsi_image.expression(
        "(FSI < 0.25) ? 1 : " +
        "(FSI < 0.40) ? 2 : " +
        "(FSI < 0.55) ? 3 : " +
        "(FSI < 0.70) ? 4 : " +
        "5",
        {"FSI": fsi_image}
    ).rename('class').toInt()
    return classified


@csrf_exempt
def flood_risk_map(request):
    """
    POST /api/flood-risk/
    Generates a 5-class colored raster map tile URL for Flood Susceptibility.
    Only Classes 3-5 (Moderate to Very High) within ROI are visible.
    """
    if request.method != "POST":
        return JsonResponse({"error": "Use POST"}, status=405)
    
    try:
        data = json.loads(request.body)
        start = data.get('start')
        end = data.get('end')
        
        if not start or not end:
            return JsonResponse({"error": "Missing start/end dates"}, status=400)
            
        ormoc = Ormoc_City.objects.first()
        if not ormoc:
            return JsonResponse({"error": "Ormoc City config not found"}, status=500)
        
        poly_coords = [[c[1], c[0]] for c in ormoc.polygon]
        roi = ee.Geometry.Polygon(poly_coords)
        
        logger.info(f"🌊 Computing Flood FSI for Ormoc City from {start} to {end}")
        
        # 1. Compute the continuous FSI
        fsi = compute_flood_fsi(roi, start, end)
        
        # 2. Classify into 5 discrete classes
        classified = classify_fsi(fsi)
        
        # 3. ✅ FIRST: Create ROI mask (mask outside ROI)
        roi_mask = ee.Image.constant(1).clip(roi).mask()
        
        # 4. ✅ SECOND: Create class mask (only keep Classes 3-5)
        class_mask = classified.gte(3)
        
        # 5. ✅ Combine both masks: Must be inside ROI AND Class >= 3
        combined_mask = roi_mask.And(class_mask)
        
        # 6. Apply combined mask
        classified_masked = classified.updateMask(combined_mask)
        
        # 7. Palette for Classes 3-5 only
        palette = [
            '#4292C6', # 3: Moderate (Medium Blue)
            '#2171B5', # 4: High (Dark Blue)
            '#084594'  # 5: Very High (Navy Blue)
        ]
        
        map_id = classified_masked.getMapId({
            'min': 3,
            'max': 5,
            'palette': palette
        })
        
        logger.info("✅ Flood map tiles generated successfully (Only Classes 3-5 in ROI visible)")
        
        return JsonResponse({
            "success": True,
            "tile_url": map_id["tile_fetcher"].url_format,
            "date_range": f"{start} to {end}",
            "legend": {
                "3": {"name": "Moderate", "color": "#4292C6"},
                "4": {"name": "High", "color": "#2171B5"},
                "5": {"name": "Very High", "color": "#084594"}
            },
            "bounds": roi.getInfo()["coordinates"]
        })
        
    except Exception as e:
        logger.error(f"❌ Flood map error: {e}", exc_info=True)
        return JsonResponse({
            "success": False,
            "error": "Map generation failed", 
            "details": str(e)[:200]
        }, status=500)

# ═══════════════════════════════════════════════════════════════
# 🔥 WILDFIRE SUSCEPTIBILITY INDEX (WSI) LOGIC
# Aligned with PLANTSCOPE Documentation v3.0
# Based on Tien Bui et al. (2017) & Chuvieco et al. (2004)
# ═══════════════════════════════════════════════════════════════

def compute_wildfire_wsi(roi, start_date, end_date):
    """
    Computes the continuous Wildfire Susceptibility Index (WSI) from 0.0 to 1.0.
    Formula: VegDry(30%) + FireHist(25%) + Slope(15%) + DistRoads(15%) + Fuel(15%)
    """
    # 1. VEGETATION DRYNESS (30%) - Inverted NDVI
    s2 = get_sentinel2_median(roi, start_date, end_date)
    if s2:
        ndvi = s2.normalizedDifference(["B8", "B4"]).clamp(0, 1)
        veg_dry = ndvi.multiply(-1).add(1)
        veg_dry = veg_dry.updateMask(ndvi.gt(0)).unmask(0)
    else:
        veg_dry = ee.Image.constant(0.3)
    
    # 2. HISTORICAL FIRE OCCURRENCE (25%)
    fire_hist = gee_helpers.safe_get_fire_count(roi, start_date, end_date)
    
    # 3. SLOPE (15%)
    dem = gee_helpers.safe_get_dem(roi)
    slope = ee.Terrain.slope(dem)
    slope_norm = slope.divide(45).clamp(0, 1)
    
    # 4. DISTANCE TO ROADS/SETTLEMENTS (15%)
    road_dist_risk = gee_helpers.safe_get_distance_to_roads(roi)
    
    # 5. LAND COVER / FUEL TYPE (15%)
    # ✅ FIX: Use the corrected safe_get_landcover function
    landcover = gee_helpers.safe_get_landcover(roi)
    
    # ESA WorldCover codes: 30=Grassland, 40=Cropland (high fuel)
    # 10=Trees, 20=Shrubs (moderate), others (low)
    fuel = landcover.eq(30).Or(landcover.eq(40)).toFloat().multiply(1.0) \
           .add(landcover.eq(10).Or(landcover.eq(20)).toFloat().multiply(0.5)) \
           .clamp(0, 1)
    
    # Calculate final WSI
    wsi = (
        veg_dry.multiply(0.30)
        .add(fire_hist.multiply(0.25))
        .add(slope_norm.multiply(0.15))
        .add(road_dist_risk.multiply(0.15))
        .add(fuel.multiply(0.15))
        .rename('WSI')
    ).clip(roi)
    
    return wsi


def classify_wsi(wsi_image):
    """
    Classifies the continuous WSI into 5 discrete classes.
    Using Equal Interval thresholds for consistent distribution:
    - WSI < 0.20 = Class 1 (Very Low)
    - WSI 0.20-0.40 = Class 2 (Low)
    - WSI 0.40-0.60 = Class 3 (Moderate)
    - WSI 0.60-0.80 = Class 4 (High)
    - WSI > 0.80 = Class 5 (Very High)
    """
    classified = wsi_image.expression(
        "(WSI < 0.20) ? 1 : " +
        "(WSI < 0.40) ? 2 : " +
        "(WSI < 0.60) ? 3 : " +
        "(WSI < 0.80) ? 4 : 5",
        {"WSI": wsi_image}
    ).rename('class').toInt()
    return classified


@csrf_exempt
def wildfire_risk_map(request):
    """
    POST /api/wildfire-risk/
    Generates a 5-class colored raster map tile URL for Wildfire Susceptibility.
    Only Classes 3-5 (Moderate to Very High) within ROI are visible.
    """
    if request.method != "POST":
        return JsonResponse({"error": "Use POST"}, status=405)
    
    try:
        data = json.loads(request.body)
        start = data.get('start')
        end = data.get('end')
        
        if not start or not end:
            return JsonResponse({"error": "Missing start/end dates"}, status=400)
            
        ormoc = Ormoc_City.objects.first()
        if not ormoc:
            return JsonResponse({"error": "Ormoc City config not found"}, status=500)
        
        poly_coords = [[c[1], c[0]] for c in ormoc.polygon]
        roi = ee.Geometry.Polygon(poly_coords)
        
        logger.info(f"🔥 Computing Wildfire WSI for Ormoc City from {start} to {end}")
        
        # 1. Compute the continuous WSI
        wsi = compute_wildfire_wsi(roi, start, end)
        
        # 2. Classify into 5 discrete classes
        classified = classify_wsi(wsi)
        
        # 3. ✅ FIRST: Create ROI mask (mask outside ROI)
        roi_mask = ee.Image.constant(1).clip(roi).mask()
        
        # 4. ✅ SECOND: Create class mask (only keep Classes 3-5)
        class_mask = classified.gte(3)
        
        # 5. ✅ Combine both masks: Must be inside ROI AND Class >= 3
        combined_mask = roi_mask.And(class_mask)
        
        # 6. Apply combined mask
        classified_masked = classified.updateMask(combined_mask)
        
        # 7. Palette for Classes 3-5 only
        palette = [
            '#FD8D3C', # 3: Moderate (Orange)
            '#E31A1C', # 4: High (Red)
            '#800026'  # 5: Very High (Dark Maroon)
        ]
        
        map_id = classified_masked.getMapId({
            'min': 3,
            'max': 5,
            'palette': palette
        })
        
        logger.info("✅ Wildfire map tiles generated successfully (Only Classes 3-5 in ROI visible)")
        
        return JsonResponse({
            "success": True,
            "tile_url": map_id["tile_fetcher"].url_format,
            "date_range": f"{start} to {end}",
            "legend": {
                "3": {"name": "Moderate", "color": "#FD8D3C"},
                "4": {"name": "High", "color": "#E31A1C"},
                "5": {"name": "Very High", "color": "#800026"}
            },
            "bounds": roi.getInfo()["coordinates"]
        })
        
    except Exception as e:
        logger.error(f"❌ Wildfire map error: {e}", exc_info=True)
        return JsonResponse({
            "success": False,
            "error": "Map generation failed", 
            "details": str(e)[:200]
        }, status=500)


# ═══════════════════════════════════════════════════════════════
# 🛠️ CORE EXTRACTION LOGIC (Optimized with ee.Reducer.mean)
# ═══════════════════════════════════════════════════════════════

def extract_hazard_prone_polygons(roi, index_image, hazard_type, threshold_class4):
    """
    Extracts Class 4 and Class 5 polygons SEPARATELY.
    Hazard-specific thresholds:
    - Landslide: Class 4 (0.45-0.6), Class 5 (>=0.6)
    - Flood: Class 4 (0.6-0.75), Class 5 (>=0.75)
    - Wildfire: Class 4 (0.6-0.8), Class 5 (>=0.8)
    """
    all_features = []
    
    # ✅ Determine Class 5 threshold based on hazard type
    if hazard_type == 'landslide':
        threshold_class5 = 0.60
    elif hazard_type == 'flood':
        threshold_class5 = 0.75
    elif hazard_type == 'wildfire':
        threshold_class5 = 0.80
    else:
        threshold_class5 = 0.60  # default
    
    logger.info(f"\n{'='*60}")
    logger.info(f"🔍 STARTING EXTRACTION FOR: {hazard_type.upper()}")
    logger.info(f"   Class 4 threshold: {threshold_class4} - {threshold_class5}")
    logger.info(f"   Class 5 threshold: >= {threshold_class5}")
    logger.info(f"{'='*60}\n")
    
    # ✅ STEP 1: Count pixels in each class
    class4_count = index_image.gte(threshold_class4).And(index_image.lt(threshold_class5)).reduceRegion(
        reducer=ee.Reducer.count(),
        geometry=roi,
        scale=30,
        bestEffort=True,
        maxPixels=1e9
    ).getInfo()
    
    class5_count = index_image.gte(threshold_class5).reduceRegion(
        reducer=ee.Reducer.count(),
        geometry=roi,
        scale=30,
        bestEffort=True,
        maxPixels=1e9
    ).getInfo()
    
    logger.info(f"📊 Pixel counts:")
    logger.info(f"   Class 4 ({threshold_class4}-{threshold_class5}): {class4_count.get('LSI', 0) if 'LSI' in class4_count else class4_count.get('FSI', 0) if 'FSI' in class4_count else class4_count.get('WSI', 0)} pixels")
    logger.info(f"   Class 5 (>={threshold_class5}): {class5_count.get('LSI', 0) if 'LSI' in class5_count else class5_count.get('FSI', 0) if 'FSI' in class5_count else class5_count.get('WSI', 0)} pixels")
    logger.info(f"{'='*60}\n")
    
    # ✅ STEP 2: Extract Class 4 (High)
    logger.info(f"🔍 Extracting Class 4 ({hazard_type})...")
    class4_mask = index_image.gte(threshold_class4).And(index_image.lt(threshold_class5)).selfMask()
    
    try:
        vectors_class4 = class4_mask.reduceToVectors(
            geometry=roi,
            scale=30,
            maxPixels=1e10,
            geometryType="polygon",
            bestEffort=True
        )
        
        features_class4 = vectors_class4.getInfo().get("features", [])
        logger.info(f"   ✅ Found {len(features_class4)} Class 4 polygon(s)")
        
        for i, feat in enumerate(features_class4):
            geom = ee.Geometry(feat['geometry'])
            
            try:
                stats = index_image.reduceRegion(
                    reducer=ee.Reducer.mean(),
                    geometry=geom,
                    scale=30,
                    bestEffort=True,
                    maxPixels=1e9
                ).getInfo()
                avg_index = list(stats.values())[0] if stats and len(stats) > 0 else 0.5
            except Exception as e:
                logger.warning(f"   ⚠️ Failed to get stats: {e}")
                avg_index = 0.5
            
            try:
                area_ha = geom.area().divide(10000).getInfo()
            except:
                area_ha = 0
            
            feat['properties'].update({
                'site_id': f'{hazard_type.upper()}-C4-{str(len(all_features)+1).zfill(3)}',
                'area_hectares': round(area_ha, 2),
                'avg_hazard_index': round(avg_index, 3),
                'risk_class': 4,
                'hazard_type': hazard_type
            })
            all_features.append(feat)
            logger.info(f"   ✅ Class 4 Polygon #{len(all_features)}: {area_ha}ha, Index={avg_index}")
    
    except Exception as e:
        logger.error(f"   ❌ Class 4 extraction failed: {e}")
    
    # ✅ STEP 3: Extract Class 5 (Very High) - USING CORRECT THRESHOLD
    logger.info(f"\n🔍 Extracting Class 5 ({hazard_type})...")
    class5_mask = index_image.gte(threshold_class5).selfMask()
    
    try:
        vectors_class5 = class5_mask.reduceToVectors(
            geometry=roi,
            scale=30,
            maxPixels=1e10,
            geometryType="polygon",
            bestEffort=True
        )
        
        features_class5 = vectors_class5.getInfo().get("features", [])
        logger.info(f"   ✅ Found {len(features_class5)} Class 5 polygon(s)")
        
        for i, feat in enumerate(features_class5):
            geom = ee.Geometry(feat['geometry'])
            
            try:
                stats = index_image.reduceRegion(
                    reducer=ee.Reducer.mean(),
                    geometry=geom,
                    scale=30,
                    bestEffort=True,
                    maxPixels=1e9
                ).getInfo()
                avg_index = list(stats.values())[0] if stats and len(stats) > 0 else threshold_class5 + 0.05
            except Exception as e:
                logger.warning(f"   ⚠️ Failed to get stats: {e}")
                avg_index = threshold_class5 + 0.05
            
            try:
                area_ha = geom.area().divide(10000).getInfo()
            except:
                area_ha = 0
            
            feat['properties'].update({
                'site_id': f'{hazard_type.upper()}-C5-{str(len(all_features)+1).zfill(3)}',
                'area_hectares': round(area_ha, 2),
                'avg_hazard_index': round(avg_index, 3),
                'risk_class': 5,
                'hazard_type': hazard_type
            })
            all_features.append(feat)
            logger.info(f"   ✅ Class 5 Polygon #{len(all_features)}: {area_ha}ha, Index={avg_index}")
    
    except Exception as e:
        logger.error(f"   ❌ Class 5 extraction failed: {e}")
    
    logger.info(f"\n{'='*60}")
    logger.info(f"🎯 EXTRACTION COMPLETE")
    logger.info(f"   Total: {len(features_class4)} Class 4 + {len(features_class5)} Class 5 = {len(all_features)} polygons")
    logger.info(f"{'='*60}\n")
    
    return all_features


@csrf_exempt
def extract_landslide_prone(request):
    if request.method != "POST":
        return JsonResponse({"error": "Use POST"}, status=405)
    
    try:
        data = json.loads(request.body)
        roi = ee.Geometry(data['geometry'])
        start, end = data['start'], data['end']
        
        logger.info(f"🚀 Starting landslide extraction for ROI")
        
        # Compute LSI
        lsi = compute_landslide_lsi(roi, start, end)
        
        # ✅ Landslide: Class 4 starts at 0.45, Class 5 at 0.60
        features = extract_hazard_prone_polygons(roi, lsi, 'landslide', threshold_class4=0.45)
        
        logger.info(f"✅ Extraction complete. Returning {len(features)} features")
        
        return JsonResponse({
            "success": True,
            "type": "FeatureCollection",
            "features": features,
            "metadata": {
                "hazard": "landslide",
                "class_4_range": "0.45 - 0.60",
                "class_5_threshold": ">= 0.60"
            }
        })
    except Exception as e:
        logger.error(f"❌ Landslide extraction error: {e}", exc_info=True)
        return JsonResponse({"error": str(e)[:200]}, status=500)


@csrf_exempt
def extract_flood_prone(request):
    if request.method != "POST":
        return JsonResponse({"error": "Use POST"}, status=405)
    
    try:
        data = json.loads(request.body)
        roi = ee.Geometry(data['geometry'])
        start, end = data['start'], data['end']
        
        # Compute FSI
        fsi = compute_flood_fsi(roi, start, end)
        
        # ✅ Flood: Class 4 starts at 0.60, Class 5 at 0.75
        features = extract_hazard_prone_polygons(roi, fsi, 'flood', threshold_class4=0.60)
        
        return JsonResponse({
            "success": True,
            "type": "FeatureCollection",
            "features": features,
            "metadata": {
                "hazard": "flood",
                "class_4_range": "0.60 - 0.75",
                "class_5_threshold": ">= 0.75"
            }
        })
    except Exception as e:
        logger.error(f"❌ Flood extraction error: {e}")
        return JsonResponse({"error": str(e)[:200]}, status=500)


@csrf_exempt
def extract_wildfire_prone(request):
    if request.method != "POST":
        return JsonResponse({"error": "Use POST"}, status=405)
    
    try:
        data = json.loads(request.body)
        roi = ee.Geometry(data['geometry'])
        start, end = data['start'], data['end']
        
        # Compute WSI
        wsi = compute_wildfire_wsi(roi, start, end)
        
        # ✅ Wildfire: Class 4 starts at 0.60, Class 5 at 0.80
        features = extract_hazard_prone_polygons(roi, wsi, 'wildfire', threshold_class4=0.60)
        
        return JsonResponse({
            "success": True,
            "type": "FeatureCollection",
            "features": features,
            "metadata": {
                "hazard": "wildfire",
                "class_4_range": "0.60 - 0.80",
                "class_5_threshold": ">= 0.80"
            }
        })
    except Exception as e:
        logger.error(f"❌ Wildfire extraction error: {e}")
        return JsonResponse({"error": str(e)[:200]}, status=500)

# ═══════════════════════════════════════════════════════════════
# 💾 BULK SAVE ENDPOINT (Called when submitting Reforestation Area)
# ═══════════════════════════════════════════════════════════════

@csrf_exempt
def bulk_create_hazard_sites(request):
    """POST /api/hazard-prone-sites/bulk-create/"""
    if request.method != "POST": return JsonResponse({"error": "Use POST"}, status=405)
    try:
        data = json.loads(request.body)
        area_id = data.get('reforestation_area_id')
        sites = data.get('sites', [])
        
        if not area_id:
            return JsonResponse({"error": "Missing reforestation_area_id"}, status=400)
            
        area = Reforestation_areas.objects.get(reforestation_area_id=area_id)
        created_count = 0
        
        for site in sites:
            # Fix coordinate order if necessary (GEE returns [lng, lat], DB might need [lat, lng] depending on your setup)
            geom = site.get('geometry') or site.get('polygon_coordinates')
            
            HazardProneSite.objects.create(
                reforestation_area=area,
                site_id=site.get('site_id', ''),
                polygon_coordinates=geom,
                area_hectares=site.get('area_hectares', 0),
                hazard_type=site.get('hazard_type', 'landslide'),
                risk_class=site.get('risk_class', 4),
                avg_hazard_index=site.get('avg_hazard_index', 0)
            )
            created_count += 1
            
        return JsonResponse({
            "success": True, 
            "created_count": created_count,
            "message": f"Saved {created_count} hazard prone zones."
        })
    except Exception as e:
        logger.error(f"❌ Bulk create hazard sites error: {e}")
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
def debug_landslide_extraction(request):
    """
    Debug endpoint to check LSI values in the drawn AOI
    Uses NEW thresholds: Class 4 (0.45-0.6), Class 5 (>=0.6)
    """
    if request.method != "POST":
        return JsonResponse({"error": "Use POST"}, status=405)
    
    try:
        data = json.loads(request.body)
        roi = ee.Geometry(data['geometry'])
        start, end = data['start'], data['end']
        
        logger.info(f"🔍 DEBUG: Starting landslide analysis for AOI")
        
        # Compute LSI
        lsi = compute_landslide_lsi(roi, start, end)
        
        # ✅ SEPARATE calls for each statistic
        lsi_min = lsi.reduceRegion(
            reducer=ee.Reducer.min(),
            geometry=roi,
            scale=30,
            bestEffort=True,
            maxPixels=1e9
        ).getInfo()
        
        lsi_max = lsi.reduceRegion(
            reducer=ee.Reducer.max(),
            geometry=roi,
            scale=30,
            bestEffort=True,
            maxPixels=1e9
        ).getInfo()
        
        lsi_mean = lsi.reduceRegion(
            reducer=ee.Reducer.mean(),
            geometry=roi,
            scale=30,
            bestEffort=True,
            maxPixels=1e9
        ).getInfo()
        
        # ✅ Count pixels with NEW thresholds
        class1_count = lsi.lt(0.15).reduceRegion(
            reducer=ee.Reducer.sum(),
            geometry=roi,
            scale=30,
            bestEffort=True,
            maxPixels=1e9
        ).getInfo().get('LSI', 0)
        
        class2_count = lsi.gte(0.15).And(lsi.lt(0.30)).reduceRegion(
            reducer=ee.Reducer.sum(),
            geometry=roi,
            scale=30,
            bestEffort=True,
            maxPixels=1e9
        ).getInfo().get('LSI', 0)
        
        class3_count = lsi.gte(0.30).And(lsi.lt(0.45)).reduceRegion(
            reducer=ee.Reducer.sum(),
            geometry=roi,
            scale=30,
            bestEffort=True,
            maxPixels=1e9
        ).getInfo().get('LSI', 0)
        
        class4_count = lsi.gte(0.45).And(lsi.lt(0.6)).reduceRegion(
            reducer=ee.Reducer.sum(),
            geometry=roi,
            scale=30,
            bestEffort=True,
            maxPixels=1e9
        ).getInfo().get('LSI', 0)
        
        class5_count = lsi.gte(0.6).reduceRegion(  # ← NEW: >= 0.6 instead of >= 0.8
            reducer=ee.Reducer.sum(),
            geometry=roi,
            scale=30,
            bestEffort=True,
            maxPixels=1e9
        ).getInfo().get('LSI', 0)
        
        class_counts = {
            'Class 1 (<0.15)': class1_count,
            'Class 2 (0.15-0.30)': class2_count,
            'Class 3 (0.30-0.45)': class3_count,
            'Class 4 (0.45-0.6)': class4_count,
            'Class 5 (>=0.6)': class5_count,  # ← NEW threshold
        }
        
        logger.info(f"📊 DEBUG - Landslide Stats:")
        logger.info(f"   Min: {lsi_min.get('LSI', 'N/A')}")
        logger.info(f"   Max: {lsi_max.get('LSI', 'N/A')}")
        logger.info(f"   Mean: {lsi_mean.get('LSI', 'N/A')}")
        logger.info(f"📊 DEBUG - Class Counts (NEW thresholds):")
        for cls, count in class_counts.items():
            logger.info(f"   {cls}: {count} pixels")
        
        return JsonResponse({
            "success": True,
            "stats": {
                "min": lsi_min.get('LSI', 0),
                "max": lsi_max.get('LSI', 0),
                "mean": lsi_mean.get('LSI', 0)
            },
            "class_counts": class_counts,
            "message": "Check Django console for detailed logs"
        })
    except Exception as e:
        logger.error(f"❌ Debug error: {e}", exc_info=True)
        return JsonResponse({"error": str(e)[:200]}, status=500)