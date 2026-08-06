import requests
import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from shapely.geometry import shape, Point, box
from shapely.ops import unary_union
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# MGB ArcGIS REST API endpoints
MGB_FLOOD_URL = "https://controlmap.mgb.gov.ph/arcgis/rest/services/GeospatialDataInventory/GDI_Detailed_Flood_Susceptibility/MapServer/0/query"
MGB_LANDSLIDE_URL = "https://controlmap.mgb.gov.ph/arcgis/rest/services/GeospatialDataInventory/GDI_Detailed_Rain_induced_Landslide_Susceptibility/MapServer/0/query"
PHIVOLCS_EIL_URL = "https://gisweb.phivolcs.dost.gov.ph/arcgis/rest/services/PHIVOLCSPublic/EarthquakeInducedLandslide/MapServer/0/query"

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"

OFFICIAL_DEFINITIONS = {
    'flood': {
        'Very High': {'title': 'Very High Susceptibility', 'description': 'Areas likely to experience flood heights greater than 2 meters and/or flood duration of more than 3 days. Perennial flooding; not recommended for planting.', 'color': '#084594', 'source': 'MGB Official Flood Susceptibility Map'},
        'High': {'title': 'High Susceptibility', 'description': 'Areas likely to experience flood heights of 1.0 to 2.0 meters and/or flood duration of more than 3 days. Frequent flooding; limit to riparian vegetation.', 'color': '#2171b5', 'source': 'MGB Official Flood Susceptibility Map'},
        'Moderate': {'title': 'Moderate Susceptibility', 'description': 'Areas likely to experience flood heights between 0.5 and 1 meter and/or flood duration of 1 to 3 days. Shallow, seasonal flooding.', 'color': '#6baed6', 'source': 'MGB Official Flood Susceptibility Map'},
        'Low': {'title': 'Low Susceptibility', 'description': 'Areas likely to experience flood heights of 0.5 meter or less and/or flood duration of less than 1 day. Minimal risk for reforestation activities.', 'color': '#bdd7e7', 'source': 'MGB Official Flood Susceptibility Map'}
    },
    'landslide': {
        'Very High': {'title': 'Very High Susceptibility', 'description': 'Areas usually with steep to very steep slopes and underlain by weak materials. Recent landslides, escarpments, and tension cracks present. Strict exclusion zone.', 'color': '#9C0006', 'source': 'MGB Official Rain-Induced Landslide Map'},
        'High': {'title': 'High Susceptibility', 'description': 'Areas usually with steep to very steep slopes and underlain by weak materials. Areas with numerous old/inactive landslides present.', 'color': '#cb181d', 'source': 'MGB Official Rain-Induced Landslide Map'},
        'Moderate': {'title': 'Moderate Susceptibility', 'description': 'Areas with moderately steep slopes. Soil creep and indications of possible landslides present.', 'color': '#fb6a4a', 'source': 'MGB Official Rain-Induced Landslide Map'},
        'Low': {'title': 'Low Susceptibility', 'description': 'Gently sloping areas with no identified landslides. Stable and safe for reforestation.', 'color': '#fcae91', 'source': 'MGB Official Rain-Induced Landslide Map'}
    },
    'eil': {
        'High': {'title': 'High Susceptibility', 'description': 'Steep slopes prone to earthquake-triggered landslides. Avoid structures; use shallow-rooted vegetation only.', 'color': '#bd0026', 'source': 'PHIVOLCS Official Earthquake-Induced Landslide Map'},
        'Moderate': {'title': 'Moderate Susceptibility', 'description': 'Areas that may experience landslides during strong earthquakes (Magnitude ≥6.0).', 'color': '#e31a1c', 'source': 'PHIVOLCS Official Earthquake-Induced Landslide Map'},
        'Low': {'title': 'Low Susceptibility', 'description': 'Areas unlikely to experience earthquake-induced landslides. Generally safe for development.', 'color': '#fc4e2a', 'source': 'PHIVOLCS Official Earthquake-Induced Landslide Map'}
    }
}


# ============================================================
# ✅ FIXED: Historical seismic trend analytics (USGS API)
# ============================================================
def query_usgs_seismic_history(geometry, min_magnitude=4.0, years=55):
    """Returns historical earthquake stats near the site (USGS open API)."""
    try:
        g = geometry
        if isinstance(g, dict) and g.get('type') == 'Feature':
            g = g.get('geometry')

        coords = []
        def walk(c):
            if isinstance(c[0], (int, float)):
                coords.append(c)
            else:
                for x in c:
                    walk(x)
        walk(g['coordinates'])

        lons = [c[0] for c in coords]
        lats = [c[1] for c in coords]
        
        # ✅ FIXED: Use separate min/max parameters instead of bbox
        min_lon = round(min(lons) - 0.5, 4)
        min_lat = round(min(lats) - 0.5, 4)
        max_lon = round(max(lons) + 0.5, 4)
        max_lat = round(max(lats) + 0.5, 4)

        params = {
            'format': 'geojson',
            'minmagnitude': min_magnitude,
            'starttime': f'{datetime.now().year - years}-01-01',
            'endtime': datetime.now().strftime('%Y-%m-%d'),
            'minlongitude': min_lon,
            'minlatitude': min_lat,
            'maxlongitude': max_lon,
            'maxlatitude': max_lat,
            'limit': 1000,
            'orderby': 'time',
        }
        
        logger.info(f"🌐 Querying USGS seismic history for bbox: [{min_lon}, {min_lat}, {max_lon}, {max_lat}]")
        
        resp = requests.get(
            'https://earthquake.usgs.gov/fdsnws/event/1/query',
            params=params,
            timeout=20,
        )
        
        if resp.status_code != 200:
            logger.error(f"❌ USGS returned status {resp.status_code}: {resp.text[:200]}")
            return None

        feats = resp.json().get('features', [])
        logger.info(f"✅ USGS returned {len(feats)} earthquakes")
        
        per_decade = {}
        max_mag, max_year = 0, None

        for f in feats:
            mag = f.get('properties', {}).get('mag') or 0
            ts = f.get('properties', {}).get('time')
            year = datetime.fromtimestamp(ts / 1000, timezone.utc).year if ts else None
            if year:
                dec = f"{(year // 10) * 10}s"
                per_decade[dec] = per_decade.get(dec, 0) + 1
            if mag > max_mag:
                max_mag, max_year = mag, year

        return {
            'total_events': len(feats),
            'max_magnitude': round(max_mag, 1),
            'max_magnitude_year': max_year,
            'events_per_decade': [
                {'decade': k, 'count': per_decade[k]} for k in sorted(per_decade)
            ],
        }
    except Exception as e:
        logger.error(f"USGS seismic history failed: {e}", exc_info=True)
        return None


def get_barangay_boundary(barangay_name, city_name="Ormoc City"):
    try:
        query = f"{barangay_name}, {city_name}, Philippines"
        params = {'q': query, 'format': 'geojson', 'addressdetails': 1, 'polygon_geojson': 1}
        headers = {'User-Agent': 'PlantScope Capstone Project'}
        
        logger.info(f"🗺️ Fetching boundary for {barangay_name}...")
        response = requests.get(NOMINATIM_URL, params=params, headers=headers, timeout=15)
        
        if response.status_code == 200:
            data = response.json()
            if data and len(data) > 0:
                feature = data[0]
                if 'geometry' in feature:
                    logger.info(f"✅ Found boundary for {barangay_name}")
                    return feature['geometry']
        
        logger.warning(f"⚠️ No boundary found for {barangay_name}, using coordinate-based box")
        return None
        
    except Exception as e:
        logger.error(f"❌ Error fetching boundary: {e}")
        return None


def create_boundary_from_coordinate(lat, lng, radius_degrees=0.05):
    try:
        min_lng = lng - radius_degrees
        max_lng = lng + radius_degrees
        min_lat = lat - radius_degrees
        max_lat = lat + radius_degrees
        
        boundary = {
            "type": "Polygon",
            "coordinates": [[
                [min_lng, min_lat],
                [max_lng, min_lat],
                [max_lng, max_lat],
                [min_lng, max_lat],
                [min_lng, min_lat]
            ]]
        }
        
        logger.info(f"📍 Created boundary box around {lat}, {lng}")
        return boundary
        
    except Exception as e:
        logger.error(f"❌ Error creating boundary box: {e}")
        return None


def query_arcgis_for_area(arcgis_url, barangay_geojson, hazard_type):
    try:
        params = {
            'geometry': json.dumps(barangay_geojson),
            'geometryType': 'esriGeometryPolygon',
            'spatialRel': 'esriSpatialRelIntersects',
            'outFields': '*',
            'returnGeometry': 'true',
            'f': 'geojson',
            'outSR': '4326'
        }
        
        logger.info(f"🔍 Querying {hazard_type} data...")
        response = requests.get(arcgis_url, params=params, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            features = data.get('features', [])
            logger.info(f"✅ Found {len(features)} {hazard_type} features")
            return features
        else:
            logger.error(f"❌ ArcGIS query failed: {response.status_code}")
            return []
            
    except Exception as e:
        logger.error(f"❌ Error querying {hazard_type}: {e}")
        return []


# ============================================================
# ✅ THE ENDPOINT YOUR FRONTEND CALLS: POST /api/analyze-hazard/
# ============================================================
@csrf_exempt
@require_http_methods(["POST"])
def analyze_hazard_area(request):
    """
    POST /api/analyze-hazard/
    Body: { "geometry": { "type": "Polygon", "coordinates": [...] } }
    Returns flat format matching the frontend HazardReportData interface.
    """
    try:
        body = json.loads(request.body)
        geometry = body.get('geometry')

        # Accept either raw geometry or a Feature wrapper
        if isinstance(geometry, dict) and geometry.get('type') == 'Feature':
            geometry = geometry.get('geometry')
        if not geometry:
            return JsonResponse({'success': False, 'error': 'No geometry provided'}, status=400)

        site_geom = shape(geometry)

        # 1. Calculate total site area in hectares
        total_area_sq_degrees = site_geom.area
        total_area_sq_meters = total_area_sq_degrees * (111000 ** 2)
        total_area_ha = total_area_sq_meters / 10000

        logger.info(f"✅✅✅ ANALYZE_HAZARD_AREA FUNCTION WAS CALLED ✅✅✅")
        logger.info(f"Total site area: {total_area_ha:.2f} ha")

        # 2. Query all 3 hazard layers
        flood_features = query_arcgis_for_area(MGB_FLOOD_URL, geometry, 'flood')
        landslide_features = query_arcgis_for_area(MGB_LANDSLIDE_URL, geometry, 'landslide')
        eil_features = query_arcgis_for_area(PHIVOLCS_EIL_URL, geometry, 'eil')

        # 3. Calculate statistics for each hazard
        flood_stats = calculate_hazard_stats(flood_features, site_geom, 'flood', total_area_ha)
        landslide_stats = calculate_hazard_stats(landslide_features, site_geom, 'landslide', total_area_ha)
        eil_stats = calculate_hazard_stats(eil_features, site_geom, 'eil', total_area_ha)

        # 4. Determine overall risk
        overall_risk = determine_overall_risk(flood_stats, landslide_stats, eil_stats)

        # 5. Generate recommendations
        recommendations = generate_recommendations(flood_stats, landslide_stats, eil_stats)

        # 6. ✅ FIXED: Query USGS for historical seismic trend
        seismic_history = query_usgs_seismic_history(geometry)

        return JsonResponse({
            'success': True,
            'total_area_ha': round(total_area_ha, 2),
            'flood': flood_stats,
            'landslide': landslide_stats,
            'eil': eil_stats,
            'overall_risk': overall_risk,
            'recommendations': recommendations,
            'seismic_history': seismic_history,
        })

    except Exception as e:
        logger.error(f"❌ Error in analyze_hazard_area: {e}", exc_info=True)
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


def calculate_hazard_stats(features, site_geom, hazard_type, total_area_ha):
    """
    Calculates hectares and percentages for each susceptibility class.
    Returns the flat format the frontend expects:
    {
        very_high_ha, high_ha, moderate_ha, low_ha, safe_ha,
        very_high_percentage, high_percentage, moderate_percentage, low_percentage, safe_percentage
    }
    """
    definitions = OFFICIAL_DEFINITIONS.get(hazard_type, {})
    
    # Initialize with all classes
    areas = {
        'very_high': 0,
        'high': 0,
        'moderate': 0,
        'low': 0,
    }

    for feature in features:
        try:
            properties = feature.get('properties', {})
            
            # Get susceptibility class (case-insensitive matching)
            susceptibility = (
                properties.get('SUSCEPTIBILITY') or
                properties.get('susceptibility') or
                properties.get('CLASS') or
                properties.get('class') or
                properties.get('Susceptibility') or
                'Unknown'
            )
            
            susceptibility_lower = str(susceptibility).lower()
            matched_class = None
            
            # Match to our 4 keys
            for class_name in definitions.keys():
                if class_name.lower() in susceptibility_lower:
                    matched_class = class_name.lower().replace(' ', '_')
                    break
            
            if not matched_class or matched_class not in areas:
                matched_class = 'low'  # Default

            geometry = feature.get('geometry')
            if geometry:
                hazard_geom = shape(geometry)
                clipped = hazard_geom.intersection(site_geom)
                
                if not clipped.is_empty:
                    area_sq_degrees = clipped.area
                    area_sq_meters = area_sq_degrees * (111000 ** 2)
                    area_hectares = area_sq_meters / 10000
                    
                    areas[matched_class] += area_hectares
                    
        except Exception as e:
            logger.warning(f"⚠️ Error processing feature in {hazard_type}: {e}")
            continue

    # Calculate total hazard area
    total_hazard_ha = sum(areas.values())
    
    # Calculate safe area (the rest of the site)
    safe_ha = max(0, total_area_ha - total_hazard_ha)

    # Calculate percentages based on TOTAL site area
    def pct(ha):
        return (ha / total_area_ha * 100) if total_area_ha > 0 else 0

    return {
        'very_high_ha': round(areas['very_high'], 2),
        'high_ha': round(areas['high'], 2),
        'moderate_ha': round(areas['moderate'], 2),
        'low_ha': round(areas['low'], 2),
        'safe_ha': round(safe_ha, 2),
        'very_high_percentage': round(pct(areas['very_high']), 1),
        'high_percentage': round(pct(areas['high']), 1),
        'moderate_percentage': round(pct(areas['moderate']), 1),
        'low_percentage': round(pct(areas['low']), 1),
        'safe_percentage': round(pct(safe_ha), 1),
    }


def determine_overall_risk(flood_stats, landslide_stats, eil_stats):
    """
    Determines the overall risk level as a string: "LOW", "MODERATE", or "HIGH"
    """
    try:
        # Calculate a weighted score for each hazard
        def risk_score(stats):
            vh = stats.get('very_high_percentage', 0)
            h = stats.get('high_percentage', 0)
            m = stats.get('moderate_percentage', 0)
            return (vh * 1.0) + (h * 0.75) + (m * 0.4)

        scores = [
            risk_score(flood_stats),
            risk_score(landslide_stats),
            risk_score(eil_stats),
        ]
        
        avg_score = sum(scores) / len(scores) if scores else 0
        
        if avg_score > 30:
            return 'HIGH'
        elif avg_score > 15:
            return 'MODERATE'
        else:
            return 'LOW'
            
    except Exception as e:
        logger.error(f"Error determining overall risk: {e}")
        return 'LOW'


def generate_recommendations(flood_stats, landslide_stats, eil_stats):
    """
    Generates a list of recommendation strings based on the hazard analysis.
    """
    recs = []
    
    # Flood recommendations
    flood_vh_h = flood_stats.get('very_high_percentage', 0) + flood_stats.get('high_percentage', 0)
    if flood_vh_h > 20:
        recs.append("⚠️ High flood risk detected (>20%). Avoid planting in perennial flood zones; prioritize riparian buffer zones.")
    elif flood_vh_h > 0:
        recs.append("✅ Moderate/Low flood risk. Use flood-resistant species in affected patches.")
    
    # Landslide recommendations
    ls_vh_h = landslide_stats.get('very_high_percentage', 0) + landslide_stats.get('high_percentage', 0)
    if ls_vh_h > 15:
        recs.append("⚠️ Significant landslide susceptibility (>15%). Strictly exclude steep slopes from heavy machinery operations.")
    elif ls_vh_h > 0:
        recs.append("✅ Monitor moderately steep areas for soil creep during heavy monsoon seasons.")
    
    # EIL recommendations
    eil_h = eil_stats.get('high_percentage', 0) + eil_stats.get('very_high_percentage', 0)
    if eil_h > 10:
        recs.append("⚠️ Seismic vulnerability detected. Avoid constructing permanent structures on EIL zones; plant deep-rooted native trees to stabilize soil.")
    
    # Default if all safe
    if not recs:
        recs.append("✅ Site exhibits excellent stability across all hazard vectors. Proceed with standard reforestation protocols.")
    
    return recs


# Keep your existing analyze_barangay_hazards function here if you use it elsewhere
@csrf_exempt
@require_http_methods(["GET", "POST"])
def analyze_barangay_hazards(request, barangay_id):
    try:
        from barangay.models import Barangay
        barangay = Barangay.objects.get(barangay_id=barangay_id)
        barangay_geojson = get_barangay_boundary(barangay.name, "Ormoc City")
        
        if not barangay_geojson and hasattr(barangay, 'coordinate') and barangay.coordinate:
            lat = float(barangay.coordinate.split(',')[0])
            lng = float(barangay.coordinate.split(',')[1])
            barangay_geojson = create_boundary_from_coordinate(lat, lng, radius_degrees=0.03)
        
        if not barangay_geojson:
            return JsonResponse({'success': False, 'error': f'Could not fetch or create boundary for {barangay.name}'}, status=400)
        
        results = {}
        
        flood_features = query_arcgis_for_area(MGB_FLOOD_URL, barangay_geojson, 'flood')
        flood_stats = calculate_hazard_stats(flood_features, shape(barangay_geojson), 'flood', shape(barangay_geojson).area * (111000 ** 2) / 10000)
        results['flood'] = {'statistics': flood_stats, 'hazard_type': 'Flood Susceptibility', 'agency': 'MGB', 'data_source': 'https://controlmap.mgb.gov.ph'}
        
        landslide_features = query_arcgis_for_area(MGB_LANDSLIDE_URL, barangay_geojson, 'landslide')
        landslide_stats = calculate_hazard_stats(landslide_features, shape(barangay_geojson), 'landslide', shape(barangay_geojson).area * (111000 ** 2) / 10000)
        results['landslide'] = {'statistics': landslide_stats, 'hazard_type': 'Rain-Induced Landslide Susceptibility', 'agency': 'MGB', 'data_source': 'https://controlmap.mgb.gov.ph'}
        
        eil_features = query_arcgis_for_area(PHIVOLCS_EIL_URL, barangay_geojson, 'eil')
        eil_stats = calculate_hazard_stats(eil_features, shape(barangay_geojson), 'eil', shape(barangay_geojson).area * (111000 ** 2) / 10000)
        results['eil'] = {'statistics': eil_stats, 'hazard_type': 'Earthquake-Induced Landslide Susceptibility', 'agency': 'PHIVOLCS', 'data_source': 'https://gisweb.phivolcs.dost.gov.ph'}
        
        return JsonResponse({
            'success': True,
            'barangay': {'id': barangay.barangay_id, 'name': barangay.name, 'description': getattr(barangay, 'description', '')},
            'analysis': results,
            'overall_risk': determine_overall_risk(flood_stats, landslide_stats, eil_stats),
            'methodology': 'Barangay boundary automatically fetched from OpenStreetMap or created from coordinate center point',
            'note': 'All susceptibility definitions and classifications are from official MGB and PHIVOLCS hazard maps.',
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"❌ Error analyzing barangay: {e}", exc_info=True)
        return JsonResponse({'success': False, 'error': str(e)}, status=500)