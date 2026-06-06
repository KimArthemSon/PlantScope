import ee
import logging

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════
# 🔑 EARTH ENGINE INITIALIZATION
# ═══════════════════════════════════════════════════════════════

def initialize_earth_engine():
    """Initialize GEE - call once at app startup"""
    try:
        ee.Initialize(project='plant-scope-ee')
        logger.info("✅ Earth Engine initialized")
        return True
    except Exception as e:
        logger.error(f"❌ GEE init failed: {e}")
        raise RuntimeError(
            "Earth Engine failed. Run: python -c \"import ee; ee.Authenticate()\""
        ) from e


# ═══════════════════════════════════════════════════════════════
# 🛠️ SAFE DATASET HELPERS (Guaranteed Public Datasets Only)
# ═══════════════════════════════════════════════════════════════

def safe_get_dem(roi):
    """Get DEM with fallback"""
    try:
        return ee.Image('USGS/SRTMGL1_003').clip(roi)
    except:
        logger.warning("⚠️ DEM fallback to constant")
        return ee.Image.constant(100).clip(roi)

def safe_get_rainfall_max(roi, start_date, end_date):
    """Get max rainfall from CHIRPS (Normalized 0-1)"""
    try:
        chirps = ee.ImageCollection("UCSB-CHG/CHIRPS/DAILY")\
            .filterBounds(roi).filterDate(start_date, end_date)\
            .select('precipitation')
        return chirps.max().clip(roi).divide(200).clamp(0, 1)
    except:
        return ee.Image.constant(0.3).clip(roi)

def safe_get_total_rainfall(roi, start_date, end_date):
    """Get total cumulative rainfall from CHIRPS"""
    try:
        chirps = ee.ImageCollection("UCSB-CHG/CHIRPS/DAILY")\
            .filterBounds(roi).filterDate(start_date, end_date)\
            .select('precipitation')
        return chirps.sum().clip(roi)
    except:
        return ee.Image.constant(500).clip(roi)

def safe_get_landcover(roi):
    """Get land cover with robust fallbacks"""
    try:
        # ✅ FIX: Use .first() to get an Image from the ImageCollection
        return ee.ImageCollection('ESA/WorldCover/v200').first().select('Map').clip(roi)
    except ee.EEException:
        try:
            # Fallback to v100
            return ee.ImageCollection('ESA/WorldCover/v100').first().select('Map').clip(roi)
        except ee.EEException:
            try:
                # Fallback to MODIS
                return ee.Image('MODIS/006/MCD12Q1/2020').select('LC_Type1').clip(roi)
            except:
                logger.warning("⚠️ All landcover datasets unavailable, using neutral value")
                return ee.Image.constant(40).clip(roi)

def safe_get_water_occurrence(roi):
    """Get historical water occurrence (Normalized 0-1)"""
    try:
        gsw = ee.Image('JRC/GSW1_4/GlobalSurfaceWater')
        occurrence_band = gsw.select('occurrence')
        return occurrence_band.clip(roi).divide(100).clamp(0, 1)
    except Exception as e:
        logger.warning(f"⚠️ Water occurrence data unavailable: {e}")
        return ee.Image.constant(0.1).clip(roi)

def safe_get_fire_count(roi, start_date, end_date):
    """Get fire count using FIRMS (Normalized 0-1)"""
    try:
        firms = ee.ImageCollection('FIRMS')\
            .filterBounds(roi)\
            .filterDate(start_date, end_date)
        
        try:
            size = firms.size().getInfo()
            if size == 0:
                return ee.Image.constant(0.1).clip(roi)
        except:
            pass
        
        count_img = firms.reduceToImage(
            properties=['confidence'], 
            reducer=ee.Reducer.count()
        ).clip(roi)
        
        risk = count_img.divide(10).clamp(0, 1).rename('fire')
        return risk
    except Exception as e:
        logger.warning(f"⚠️ Fire data (FIRMS) unavailable: {e}")
        return ee.Image.constant(0.1).clip(roi)

def safe_get_soil_sand_content(roi):
    """Get soil sand content (Normalized 0-1) using OpenLandMap"""
    try:
        # OpenLandMap is highly stable in GEE. Band 'b0' is sand fraction 0-5cm in %
        soil = ee.Image("OpenLandMap/SOL/SOL_SAND-WFRACTION_USDA-3A1A1C_M/v02").select('b0')
        return soil.clip(roi).divide(100).clamp(0, 1)
    except Exception as e:
        logger.warning(f"⚠️ Soil data unavailable: {e}")
        return ee.Image.constant(0.3).clip(roi)

def safe_get_distance_to_water(roi):
    """
    Distance to INLAND water bodies only (rivers, lakes).
    Excludes ocean/coastal water using elevation threshold.
    Closer = Higher Risk, Normalized 0-1
    
    CALIBRATED FOR ORMOC CITY:
    - Excludes ocean (elevation < 5m)
    - Max distance threshold: 1000m (urban flooding range)
    """
    try:
        # Get JRC Global Surface Water
        gsw = ee.Image('JRC/GSW1_4/GlobalSurfaceWater').select('occurrence')
        
        # Get DEM for elevation filtering
        dem = ee.Image('USGS/SRTMGL1_003').select('elevation')
        
        # Create binary mask: permanent water (>50% occurrence)
        permanent_water = gsw.gt(50)
        
        # Exclude ocean: only keep water above 5m elevation
        # Ocean is at 0-2m, rivers/lakes can be at any elevation
        above_sea_level = dem.gt(5)
        
        # Inland water = permanent water that's above sea level
        inland_water = permanent_water.And(above_sea_level)
        
        # Calculate distance transform
        # fastDistanceTransform works on binary images
        water_binary = inland_water.selfMask()
        dist = water_binary.mask().eq(0).fastDistanceTransform(100)
        
        # Convert from pixels to meters (GSW is ~30m resolution)
        dist_meters = dist.multiply(30)
        
        # Invert and normalize: 0m = 1.0 risk, 1000m = 0.0 risk
        # 1000m is realistic for urban flood risk
        risk = dist_meters.multiply(-1).add(1000).divide(1000).clamp(0, 1)
        
        return risk.clip(roi)
        
    except Exception as e:
        logger.warning(f"⚠️ Distance to water failed: {e}")
        # Fallback: return low-moderate risk everywhere
        return ee.Image.constant(0.2).clip(roi)


def safe_get_distance_to_roads(roi):
    """Distance to settlements/roads (Closer = Higher Risk, Normalized 0-1)
       Uses ESA WorldCover 'Built-up' as a robust proxy for roads/settlements"""
    try:
        # ✅ FIX: Use .first() to get an Image from the ImageCollection
        lc = ee.ImageCollection('ESA/WorldCover/v200').first().select('Map')
        built_up = lc.eq(50)  # ESA WorldCover code 50 = Built-up areas
        
        # ✅ FIX: Use fastDistanceTransform on binary image
        dist = built_up.fastDistanceTransform(150)  # Max 150 pixel radius
        
        # Convert from pixels to meters (~10m resolution)
        dist_meters = dist.multiply(10)
        
        # Invert: 0m = 1.0 risk, 1500m = 0.0 risk
        risk = dist_meters.multiply(-1).add(1500).divide(1500).clamp(0, 1)
        return risk.clip(roi)
    except Exception as e:
        logger.warning(f"⚠️ Distance to roads/settlements failed: {e}")
        return ee.Image.constant(0.3).clip(roi)

def normalize_band(image, band, min_val, max_val, new_name=None):
    """Normalize band to 0-1 scale"""
    name = new_name or f"{band}_norm"
    return image.select(band).subtract(min_val).divide(max_val - min_val).clamp(0, 1).rename(name)

def safe_get_distance_to_water_v4(roi):
    """
    Distance to RIVERS only - EXCLUDES mountain lakes like Lake Danao!
    Only water below 50m elevation causes floods.
    """
    try:
        gsw = ee.Image('JRC/GSW1_4/GlobalSurfaceWater').select('occurrence')
        dem = ee.Image('USGS/SRTMGL1_003').select('elevation')
        
        # Permanent water (>75% occurrence)
        permanent_water = gsw.gt(75)
        
        # ✅ Only LOW elevation water (<50m) causes floods
        # Mountain lakes (Lake Danao ~300m) are filtered out
        low_elevation = dem.lt(50)
        
        # Flood-relevant water = permanent water AND low elevation
        flood_water = permanent_water.And(low_elevation)
        
        # Calculate distance
        water_binary = flood_water.selfMask()
        dist = water_binary.mask().eq(0).fastDistanceTransform(200)
        dist_meters = dist.multiply(30)
        
        # 0m = 1.0 risk, 3000m = 0.0 risk
        risk = dist_meters.multiply(-1).add(3000).divide(3000).clamp(0, 1)
        
        return risk.clip(roi)
        
    except Exception as e:
        logger.warning(f"⚠️ Distance to water failed: {e}")
        return ee.Image.constant(0.1).clip(roi)
