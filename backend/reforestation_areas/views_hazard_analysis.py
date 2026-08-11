import requests
import json
import math
import logging
from datetime import datetime, timezone
from functools import partial

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from shapely.geometry import shape
from shapely.ops import unary_union, transform

logger = logging.getLogger(__name__)

# ============================================================
# MGB / PHIVOLCS ArcGIS REST endpoints
# ============================================================
MGB_FLOOD_URL = "https://controlmap.mgb.gov.ph/arcgis/rest/services/GeospatialDataInventory/GDI_Detailed_Flood_Susceptibility/MapServer/0/query"
MGB_LANDSLIDE_URL = "https://controlmap.mgb.gov.ph/arcgis/rest/services/GeospatialDataInventory/GDI_Detailed_Rain_induced_Landslide_Susceptibility/MapServer/0/query"

# ✅ PRIMARY EIL endpoint (currently refuses all queries with HTTP 400)
PHIVOLCS_EIL_URL = "https://gisweb.phivolcs.dost.gov.ph/arcgis/rest/services/PHIVOLCSPublic/EarthquakeInducedLandslide/MapServer/0/query"
# ✅ MIRROR EIL endpoint (GeoRisk.gov.ph hosts the same dataset)
PHIVOLCS_EIL_URL_MIRROR = "https://ulap-hazards.georisk.gov.ph/arcgis/rest/services/PHIVOLCSPublic/EarthquakeInducedLandslide/MapServer/0/query"

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
# Code maps — real REST codes from each service.
# MGB flood  -> FloodSusc: VHF / HF / MF / LF
# MGB ls     -> LndslideSusc: VHL / HL / ML / LL (nulls exist)
# PHIVOLCS   -> eilclass domain: 01=Low, 02=Moderate, 03=High, 04=Depositional
# ============================================================
HAZARD_CODE_MAPS = {
    'flood': {
        'VHF': 'very_high', 'HF': 'high', 'MF': 'moderate', 'LF': 'low',
        'VH': 'very_high', 'H': 'high', 'M': 'moderate', 'L': 'low',
        '4': 'very_high', '3': 'high', '2': 'moderate', '1': 'low',
        'CLASS 4': 'very_high', 'CLASS 3': 'high', 'CLASS 2': 'moderate', 'CLASS 1': 'low',
    },
    'landslide': {
        'VHL': 'very_high', 'HL': 'high', 'ML': 'moderate', 'LL': 'low',
        'VH': 'very_high', 'H': 'high', 'M': 'moderate', 'L': 'low',
        '4': 'very_high', '3': 'high', '2': 'moderate', '1': 'low',
    },
    'eil': {
        # Official PHIVOLCS domain (from layer metadata)
        '01': 'low', '02': 'moderate', '03': 'high', '04': 'moderate',
        '1': 'low', '2': 'moderate', '3': 'high', '4': 'moderate',
        'H': 'high', 'M': 'moderate', 'L': 'low',
        'HIGH': 'high', 'MODERATE': 'moderate', 'LOW': 'low',
    },
}

HAZARD_FIELD_NAMES = {
    'flood': ['FloodSusc', 'FLOODSUSC', 'floodsusc', 'Flood_Susc'],
    'landslide': ['LndslideSusc', 'LNDSLIDESUSC', 'lndslidesusc', 'LandslideSusc'],
    'eil': ['eilclass', 'EILCLASS', 'EIL_Class', 'EIL_CLASS', 'eil_class', 'EILSusc'],
}


# ============================================================
# Susceptibility extraction + matching
# ============================================================
def extract_susceptibility(properties, hazard_type):
    """Return (raw_value, field_name) from feature properties."""
    if not isinstance(properties, dict):
        return None, None

    for name in HAZARD_FIELD_NAMES.get(hazard_type, []):
        if name in properties and properties.get(name) is not None:
            return properties[name], name

    for key, value in properties.items():
        k = key.lower()
        if value is not None and any(t in k for t in ('susc', 'class', 'rating', 'hazard')):
            return value, key

    return None, None


def match_susceptibility_class(raw_value, hazard_type):
    """Map raw REST value to very_high|high|moderate|low. None = unknown (skip)."""
    if raw_value is None:
        return None

    val = str(raw_value).strip().upper()
    if not val or val in ('NULL', 'NONE', 'N/A', '<NULL>'):
        return None

    code_map = HAZARD_CODE_MAPS.get(hazard_type, {})
    if val in code_map:
        return code_map[val]

    if 'VERY HIGH' in val or 'VERYHIGH' in val:
        return 'very_high'
    if 'HIGH' in val:
        return 'high'
    if 'MODERATE' in val or 'MEDIUM' in val:
        return 'moderate'
    if 'LOW' in val:
        return 'low'

    return None


# ============================================================
# Geometry helpers
# ============================================================
def _ring_signed_area(ring):
    s = 0.0
    for i in range(len(ring) - 1):
        x1, y1 = ring[i][0], ring[i][1]
        x2, y2 = ring[i + 1][0], ring[i + 1][1]
        s += (x1 * y2) - (x2 * y1)
    return s / 2.0


def to_esri_rings(geom_dict):
    """Convert GeoJSON -> esri JSON rings, enforce esri winding order."""
    gtype = geom_dict.get('type')
    coords = geom_dict.get('coordinates')

    polygons = []
    if gtype == 'Polygon':
        polygons = [coords]
    elif gtype == 'MultiPolygon':
        polygons = coords
    else:
        raise ValueError(f"Unsupported geometry type for esri conversion: {gtype}")

    rings = []
    for poly in polygons:
        for idx, ring in enumerate(poly):
            r = [[float(pt[0]), float(pt[1])] for pt in ring]
            signed = _ring_signed_area(r)
            if idx == 0:                          # outer ring -> clockwise (negative)
                if signed > 0:
                    r = r[::-1]
            else:                                 # hole -> counter-clockwise (positive)
                if signed < 0:
                    r = r[::-1]
            rings.append(r)

    return {"rings": rings, "spatialReference": {"wkid": 4326}}


def esri_feature_to_geojson(feat):
    """Convert an esri JSON feature to GeoJSON."""
    attrs = feat.get('attributes', {}) or {}
    geom = feat.get('geometry')
    geometry = {'type': 'Polygon', 'coordinates': geom['rings']} if geom and 'rings' in geom else None
    return {'type': 'Feature', 'properties': attrs, 'geometry': geometry}


def calculate_area_hectares(geom):
    """Accurate area via UTM projection; latitude-adjusted fallback."""
    if geom.is_empty:
        return 0.0
    try:
        centroid = geom.centroid
        zone = int((centroid.x + 180) / 6) + 1
        epsg = (32600 + zone) if centroid.y >= 0 else (32700 + zone)
        try:
            from pyproj import Transformer
            transformer = Transformer.from_crs("EPSG:4326", f"EPSG:{epsg}", always_xy=True)
            projected = transform(transformer.transform, geom)
            return projected.area / 10000.0
        except Exception:
            lat_rad = math.radians(centroid.y)
            m_lat = 111320.0
            m_lon = 111320.0 * math.cos(lat_rad)
            return geom.area * m_lat * m_lon / 10000.0
    except Exception as e:
        logger.warning(f"⚠️ Area calc failed, using 0: {e}")
        return 0.0


# ============================================================
# ArcGIS query — GET -> POST -> esri-JSON fallbacks.
# Returns (features_list, error_string_or_None).
# Gracefully handles services that refuse queries (e.g. PHIVOLCS EIL).
# ============================================================
def query_arcgis_for_area(arcgis_url, geojson_geometry, hazard_type):
    try:
        esri_geom = to_esri_rings(geojson_geometry)

        base_params = {
            'where': '1=1',
            'geometry': json.dumps(esri_geom),
            'geometryType': 'esriGeometryPolygon',
            'spatialRel': 'esriSpatialRelIntersects',
            'inSR': '4326',
            'outSR': '4326',
            'outFields': '*',
            'returnGeometry': 'true',
        }

        logger.info(f"🔍 Querying {hazard_type.upper()}...")

        data = None

        # ---- attempt 1: GET with geojson output
        try:
            p = dict(base_params); p['f'] = 'geojson'
            r = requests.get(arcgis_url, params=p, timeout=30)
            if r.status_code == 200:
                data = r.json()
        except Exception as e:
            logger.warning(f"   -> GET failed: {e}")

        # ---- attempt 2: POST (some servers block GET with large geometries)
        if data is None or 'error' in data:
            logger.info(f"   -> GET blocked/unusable, trying POST (geojson)...")
            try:
                p = dict(base_params); p['f'] = 'geojson'
                r = requests.post(arcgis_url, data=p, timeout=30)
                if r.status_code == 200:
                    data = r.json()
            except Exception as e:
                logger.warning(f"   -> POST geojson failed: {e}")

        # ---- attempt 3: POST with native esri JSON output (GeoJSON unsupported on some)
        if data is None or 'error' in data:
            logger.info(f"   -> POST geojson failed, trying POST (esri json)...")
            try:
                p = dict(base_params); p['f'] = 'json'
                r = requests.post(arcgis_url, data=p, timeout=30)
                if r.status_code == 200:
                    raw = r.json()
                    if 'error' not in raw:
                        data = {'features': [esri_feature_to_geojson(f) for f in raw.get('features', [])]}
                    else:
                        data = raw
            except Exception as e:
                logger.warning(f"   -> POST esri json failed: {e}")

        # ---- give up gracefully
        if data is None or 'error' in data:
            err = (data or {}).get('error', 'no response')
            logger.warning(f"   -> ⚠️ {hazard_type} service unavailable: {err}")
            return [], str(err)

        # ---- paginate only if server says it truncated the result set
        all_features = list(data.get('features', []))
        while data.get('exceededTransferLimit', False) and len(all_features) < 10000:
            offset = len(all_features)
            try:
                p = dict(base_params); p['f'] = 'geojson'; p['resultOffset'] = offset
                r = requests.get(arcgis_url, params=p, timeout=30)
                if r.status_code != 200:
                    break
                data = r.json()
                if 'error' in data:
                    break
                batch = data.get('features', [])
                if not batch:
                    break
                all_features.extend(batch)
            except Exception:
                break

        logger.info(f"   -> 📊 Returned {len(all_features)} features")
        return all_features, None

    except Exception as e:
        logger.error(f"❌ Error querying {hazard_type}: {e}", exc_info=True)
        return [], str(e)


# ============================================================
# Stats — real codes, union per class, gap = SAFE
# ============================================================
def calculate_hazard_stats(features, site_geom, hazard_type, total_area_ha):
    class_geoms = {'very_high': [], 'high': [], 'moderate': [], 'low': []}
    detected = {}
    unmatched = set()

    for feature in features:
        try:
            props = feature.get('properties', {}) or {}
            raw_value, field_used = extract_susceptibility(props, hazard_type)

            key = str(raw_value)
            detected[key] = detected.get(key, 0) + 1

            matched_class = match_susceptibility_class(raw_value, hazard_type)

            if matched_class is None:
                unmatched.add(key)
                logger.warning(f"   -> ⚠️ {hazard_type}: unmatched value '{raw_value}' (field={field_used}) — excluded, counted as Safe")
                continue

            logger.info(f"   -> {field_used}: {raw_value} = {matched_class.upper()}")

            geometry = feature.get('geometry')
            if not geometry:
                continue

            hazard_geom = shape(geometry)
            if not hazard_geom.is_valid:
                hazard_geom = hazard_geom.buffer(0)

            clipped = hazard_geom.intersection(site_geom)
            if clipped.is_empty:
                continue

            class_geoms[matched_class].append(clipped)

        except Exception as e:
            logger.warning(f"⚠️ Error processing {hazard_type} feature: {e}")
            continue

    logger.info(f"   -> Detected unique values: {set(detected.keys())}")
    if unmatched:
        logger.warning(f"   -> ⚠️ Unmatched values for {hazard_type}: {unmatched}")

    areas = {}
    for cls, geoms in class_geoms.items():
        areas[cls] = calculate_area_hectares(unary_union(geoms)) if geoms else 0.0

    total_hazard_ha = sum(areas.values())

    if total_hazard_ha > total_area_ha > 0:
        logger.warning(f"   -> ⚠️ Hazard total ({total_hazard_ha:.2f}) > site ({total_area_ha:.2f}); scaling")
        factor = total_area_ha / total_hazard_ha
        areas = {k: v * factor for k, v in areas.items()}
        total_hazard_ha = total_area_ha

    safe_ha = max(0.0, total_area_ha - total_hazard_ha)

    def pct(ha):
        return (ha / total_area_ha * 100) if total_area_ha > 0 else 0

    logger.info(f"   -> FINAL for {hazard_type.upper()} (NO gap redistribution):")
    logger.info(f"      🔴 VERY HIGH: {areas['very_high']:.2f} ha ({pct(areas['very_high']):.1f}%)")
    logger.info(f"      🟠 HIGH:      {areas['high']:.2f} ha ({pct(areas['high']):.1f}%)")
    logger.info(f"      🟡 MODERATE:  {areas['moderate']:.2f} ha ({pct(areas['moderate']):.1f}%)")
    logger.info(f"      🟢 LOW:       {areas['low']:.2f} ha ({pct(areas['low']):.1f}%)")
    logger.info(f"      ⚪ SAFE:      {safe_ha:.2f} ha ({pct(safe_ha):.1f}%)")

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
        'detected_codes': sorted(detected.keys()),
    }


# ============================================================
# USGS historical seismic trend
# ============================================================
def query_usgs_seismic_history(geometry, min_magnitude=4.0, years=55):
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

        params = {
            'format': 'geojson',
            'minmagnitude': min_magnitude,
            'starttime': f'{datetime.now().year - years}-01-01',
            'endtime': datetime.now().strftime('%Y-%m-%d'),
            'minlongitude': round(min(lons) - 0.5, 4),
            'minlatitude': round(min(lats) - 0.5, 4),
            'maxlongitude': round(max(lons) + 0.5, 4),
            'maxlatitude': round(max(lats) + 0.5, 4),
            'limit': 1000,
            'orderby': 'time',
        }

        resp = requests.get('https://earthquake.usgs.gov/fdsnws/event/1/query', params=params, timeout=20)
        if resp.status_code != 200:
            logger.error(f"❌ USGS status {resp.status_code}")
            return None

        feats = resp.json().get('features', [])
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
            'events_per_decade': [{'decade': k, 'count': per_decade[k]} for k in sorted(per_decade)],
        }
    except Exception as e:
        logger.error(f"USGS seismic history failed: {e}", exc_info=True)
        return None


# ============================================================
# Barangay boundary helpers
# ============================================================
def get_barangay_boundary(barangay_name, city_name="Ormoc City"):
    try:
        query = f"{barangay_name}, {city_name}, Philippines"
        params = {'q': query, 'format': 'geojson', 'addressdetails': 1, 'polygon_geojson': 1}
        headers = {'User-Agent': 'PlantScope Capstone Project'}

        response = requests.get(NOMINATIM_URL, params=params, headers=headers, timeout=15)
        if response.status_code == 200:
            data = response.json()
            if data and len(data) > 0 and 'geometry' in data[0]:
                return data[0]['geometry']
        return None
    except Exception as e:
        logger.error(f"❌ Error fetching boundary: {e}")
        return None


def create_boundary_from_coordinate(lat, lng, radius_degrees=0.05):
    try:
        return {
            "type": "Polygon",
            "coordinates": [[
                [lng - radius_degrees, lat - radius_degrees],
                [lng + radius_degrees, lat - radius_degrees],
                [lng + radius_degrees, lat + radius_degrees],
                [lng - radius_degrees, lat + radius_degrees],
                [lng - radius_degrees, lat - radius_degrees]
            ]]
        }
    except Exception as e:
        logger.error(f"❌ Error creating boundary box: {e}")
        return None


# ============================================================
# Risk + recommendations
# ============================================================
def determine_overall_risk(flood_stats, landslide_stats, eil_stats):
    try:
        def risk_score(s):
            return (s.get('very_high_percentage', 0) * 1.0 +
                    s.get('high_percentage', 0) * 0.75 +
                    s.get('moderate_percentage', 0) * 0.4)

        avg = sum([risk_score(flood_stats), risk_score(landslide_stats), risk_score(eil_stats)]) / 3
        if avg > 30:
            return 'HIGH'
        if avg > 15:
            return 'MODERATE'
        return 'LOW'
    except Exception as e:
        logger.error(f"Error determining overall risk: {e}")
        return 'LOW'


def generate_recommendations(flood_stats, landslide_stats, eil_stats, eil_unavailable=False):
    recs = []

    flood_vh_h = flood_stats.get('very_high_percentage', 0) + flood_stats.get('high_percentage', 0)
    if flood_vh_h > 20:
        recs.append("⚠️ High flood risk detected (>20%). Avoid planting in perennial flood zones; prioritize riparian buffer zones.")
    elif flood_vh_h > 0:
        recs.append("✅ Moderate/Low flood risk. Use flood-resistant species in affected patches.")

    ls_vh_h = landslide_stats.get('very_high_percentage', 0) + landslide_stats.get('high_percentage', 0)
    if ls_vh_h > 15:
        recs.append("⚠️ Significant landslide susceptibility (>15%). Strictly exclude steep slopes from heavy machinery operations.")
    elif ls_vh_h > 0:
        recs.append("✅ Monitor moderately steep areas for soil creep during heavy monsoon seasons.")

    eil_h = eil_stats.get('high_percentage', 0) + eil_stats.get('very_high_percentage', 0)
    if eil_h > 10:
        recs.append("⚠️ Seismic vulnerability detected. Avoid constructing permanent structures on EIL zones; plant deep-rooted native trees to stabilize soil.")

    if eil_unavailable:
        recs.append("⚠️ PHIVOLCS EIL feature service is currently unavailable. EIL is shown as no-data — refer to the official PHIVOLCS EIL map overlay for visual reference.")

    if not recs:
        recs.append("✅ Site exhibits excellent stability across all hazard vectors. Proceed with standard reforestation protocols.")

    return recs


# ============================================================
# MAIN ENDPOINT: POST /api/analyze-hazard/
# ============================================================
@csrf_exempt
@require_http_methods(["POST"])
def analyze_hazard_area(request):
    try:
        body = json.loads(request.body)
        geometry = body.get('geometry')

        if isinstance(geometry, dict) and geometry.get('type') == 'Feature':
            geometry = geometry.get('geometry')
        if not geometry:
            return JsonResponse({'success': False, 'error': 'No geometry provided'}, status=400)

        site_geom = shape(geometry)
        if not site_geom.is_valid:
            site_geom = site_geom.buffer(0)

        total_area_ha = calculate_area_hectares(site_geom)
        logger.info(f"✅✅✅ ANALYZE_HAZARD_AREA CALLED — site {total_area_ha:.2f} ha ✅✅✅")
        logger.info(f"is use latest file")

        # Flood + landslide
        flood_features, flood_err = query_arcgis_for_area(MGB_FLOOD_URL, geometry, 'flood')
        landslide_features, landslide_err = query_arcgis_for_area(MGB_LANDSLIDE_URL, geometry, 'landslide')

        # ✅ EIL: primary server -> if it fails, try GeoRisk mirror
        eil_features, eil_err = query_arcgis_for_area(PHIVOLCS_EIL_URL, geometry, 'eil')
        if eil_err:
            logger.info("   -> primary EIL server refused queries, trying GeoRisk mirror...")
            eil_features, eil_err = query_arcgis_for_area(PHIVOLCS_EIL_URL_MIRROR, geometry, 'eil')

        flood_stats = calculate_hazard_stats(flood_features, site_geom, 'flood', total_area_ha)
        landslide_stats = calculate_hazard_stats(landslide_features, site_geom, 'landslide', total_area_ha)
        eil_stats = calculate_hazard_stats(eil_features, site_geom, 'eil', total_area_ha)

        overall_risk = determine_overall_risk(flood_stats, landslide_stats, eil_stats)
        recommendations = generate_recommendations(
            flood_stats, landslide_stats, eil_stats,
            eil_unavailable=bool(eil_err),
        )
        seismic_history = query_usgs_seismic_history(geometry)

        return JsonResponse({
            'success': True,
            'latest': True,
            'total_area_ha': round(total_area_ha, 2),
            'flood': flood_stats,
            'landslide': landslide_stats,
            'eil': eil_stats,
            'data_availability': {
                'flood': flood_err is None,
                'landslide': landslide_err is None,
                'eil': eil_err is None,
            },
            'overall_risk': overall_risk,
            'recommendations': recommendations,
            'seismic_history': seismic_history,
        })

    except Exception as e:
        logger.error(f"❌ Error in analyze_hazard_area: {e}", exc_info=True)
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


# ============================================================
# Barangay endpoint
# ============================================================
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

        site_geom = shape(barangay_geojson)
        total_area_ha = calculate_area_hectares(site_geom)

        results = {}

        flood_features, _ = query_arcgis_for_area(MGB_FLOOD_URL, barangay_geojson, 'flood')
        flood_stats = calculate_hazard_stats(flood_features, site_geom, 'flood', total_area_ha)
        results['flood'] = {'statistics': flood_stats, 'hazard_type': 'Flood Susceptibility', 'agency': 'MGB', 'data_source': 'https://controlmap.mgb.gov.ph'}

        landslide_features, _ = query_arcgis_for_area(MGB_LANDSLIDE_URL, barangay_geojson, 'landslide')
        landslide_stats = calculate_hazard_stats(landslide_features, site_geom, 'landslide', total_area_ha)
        results['landslide'] = {'statistics': landslide_stats, 'hazard_type': 'Rain-Induced Landslide Susceptibility', 'agency': 'MGB', 'data_source': 'https://controlmap.mgb.gov.ph'}

        eil_features, _ = query_arcgis_for_area(PHIVOLCS_EIL_URL, barangay_geojson, 'eil')
        if not eil_features:
            eil_features, _ = query_arcgis_for_area(PHIVOLCS_EIL_URL_MIRROR, barangay_geojson, 'eil')
        eil_stats = calculate_hazard_stats(eil_features, site_geom, 'eil', total_area_ha)
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