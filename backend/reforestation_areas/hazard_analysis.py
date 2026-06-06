import requests
import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from shapely.geometry import shape, Point, box
from shapely.ops import unary_union
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

# MGB ArcGIS REST API endpoints
MGB_FLOOD_URL = "https://controlmap.mgb.gov.ph/arcgis/rest/services/GeospatialDataInventory/GDI_Detailed_Flood_Susceptibility/MapServer/0/query"
MGB_LANDSLIDE_URL = "https://controlmap.mgb.gov.ph/arcgis/rest/services/GeospatialDataInventory/GDI_Detailed_Rain_induced_Landslide_Susceptibility/MapServer/0/query"
PHIVOLCS_EIL_URL = "https://gisweb.phivolcs.dost.gov.ph/arcgis/rest/services/PHIVOLCSPublic/EarthquakeInducedLandslide/MapServer/0/query"

# OpenStreetMap Nominatim API for getting barangay boundaries
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"

# Official definitions from MGB/PHIVOLCS
OFFICIAL_DEFINITIONS = {
    'flood': {
        'Very High': {
            'title': 'Very High Susceptibility',
            'description': 'Areas likely to experience flood heights greater than 2 meters and/or flood duration of more than 3 days. Perennial flooding; not recommended for planting.',
            'color': '#084594',
            'source': 'MGB Official Flood Susceptibility Map'
        },
        'High': {
            'title': 'High Susceptibility',
            'description': 'Areas likely to experience flood heights of 1.0 to 2.0 meters and/or flood duration of more than 3 days. Frequent flooding; limit to riparian vegetation.',
            'color': '#2171b5',
            'source': 'MGB Official Flood Susceptibility Map'
        },
        'Moderate': {
            'title': 'Moderate Susceptibility',
            'description': 'Areas likely to experience flood heights between 0.5 and 1 meter and/or flood duration of 1 to 3 days. Shallow, seasonal flooding.',
            'color': '#6baed6',
            'source': 'MGB Official Flood Susceptibility Map'
        },
        'Low': {
            'title': 'Low Susceptibility',
            'description': 'Areas likely to experience flood heights of 0.5 meter or less and/or flood duration of less than 1 day. Minimal risk for reforestation activities.',
            'color': '#bdd7e7',
            'source': 'MGB Official Flood Susceptibility Map'
        }
    },
    'landslide': {
        'Very High': {
            'title': 'Very High Susceptibility',
            'description': 'Areas usually with steep to very steep slopes and underlain by weak materials. Recent landslides, escarpments, and tension cracks present. Strict exclusion zone.',
            'color': '#9C0006',
            'source': 'MGB Official Rain-Induced Landslide Map'
        },
        'High': {
            'title': 'High Susceptibility',
            'description': 'Areas usually with steep to very steep slopes and underlain by weak materials. Areas with numerous old/inactive landslides present.',
            'color': '#cb181d',
            'source': 'MGB Official Rain-Induced Landslide Map'
        },
        'Moderate': {
            'title': 'Moderate Susceptibility',
            'description': 'Areas with moderately steep slopes. Soil creep and indications of possible landslides present.',
            'color': '#fb6a4a',
            'source': 'MGB Official Rain-Induced Landslide Map'
        },
        'Low': {
            'title': 'Low Susceptibility',
            'description': 'Gently sloping areas with no identified landslides. Stable and safe for reforestation.',
            'color': '#fcae91',
            'source': 'MGB Official Rain-Induced Landslide Map'
        }
    },
    'eil': {
        'High': {
            'title': 'High Susceptibility',
            'description': 'Steep slopes prone to earthquake-triggered landslides. Avoid structures; use shallow-rooted vegetation only.',
            'color': '#bd0026',
            'source': 'PHIVOLCS Official Earthquake-Induced Landslide Map'
        },
        'Moderate': {
            'title': 'Moderate Susceptibility',
            'description': 'Areas that may experience landslides during strong earthquakes (Magnitude ≥6.0).',
            'color': '#e31a1c',
            'source': 'PHIVOLCS Official Earthquake-Induced Landslide Map'
        },
        'Low': {
            'title': 'Low Susceptibility',
            'description': 'Areas unlikely to experience earthquake-induced landslides. Generally safe for development.',
            'color': '#fc4e2a',
            'source': 'PHIVOLCS Official Earthquake-Induced Landslide Map'
        }
    }
}


def get_barangay_boundary(barangay_name, city_name="Ormoc City"):
    """
    Fetch barangay boundary from OpenStreetMap Nominatim API
    Returns GeoJSON polygon
    """
    try:
        # Search for barangay boundary
        query = f"{barangay_name}, {city_name}, Philippines"
        params = {
            'q': query,
            'format': 'geojson',
            'addressdetails': 1,
            'polygon_geojson': 1
        }
        
        headers = {
            'User-Agent': 'PlantScope Capstone Project'
        }
        
        logger.info(f"🗺️ Fetching boundary for {barangay_name}...")
        response = requests.get(NOMINATIM_URL, params=params, headers=headers, timeout=15)
        
        if response.status_code == 200:
            data = response.json()
            
            if data and len(data) > 0:
                # Get the first result (most relevant)
                feature = data[0]
                
                # Extract geometry
                if 'geometry' in feature:
                    logger.info(f"✅ Found boundary for {barangay_name}")
                    return feature['geometry']
        
        # If no boundary found, create a bounding box from coordinates
        logger.warning(f"⚠️ No boundary found for {barangay_name}, using coordinate-based box")
        return None
        
    except Exception as e:
        logger.error(f"❌ Error fetching boundary: {e}")
        return None


def create_boundary_from_coordinate(lat, lng, radius_degrees=0.05):
    """
    Create a bounding box around a coordinate
    radius_degrees: approximately 5.5km per 0.05 degrees
    """
    try:
        # Create a box around the point
        min_lng = lng - radius_degrees
        max_lng = lng + radius_degrees
        min_lat = lat - radius_degrees
        max_lat = lat + radius_degrees
        
        # Create GeoJSON polygon
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
    """
    Query ArcGIS REST API to get hazard data intersecting with barangay polygon
    """
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


def calculate_zonal_statistics(features, barangay_geojson, hazard_type):
    """
    Calculate area statistics for each susceptibility class
    """
    try:
        barangay_geom = shape(barangay_geojson)
        
        # Get official definitions for this hazard type
        definitions = OFFICIAL_DEFINITIONS.get(hazard_type, {})
        
        # Initialize statistics with official definitions
        stats = {}
        for class_name, definition in definitions.items():
            stats[class_name] = {
                'area': 0,
                'count': 0,
                'color': definition['color'],
                'official_title': definition['title'],
                'official_description': definition['description'],
                'source': definition['source']
            }
        
        total_hazard_area = 0
        
        for feature in features:
            try:
                properties = feature.get('properties', {})
                
                # Get susceptibility class from properties
                susceptibility = (
                    properties.get('SUSCEPTIBILITY') or
                    properties.get('susceptibility') or
                    properties.get('CLASS') or
                    properties.get('class') or
                    properties.get('Susceptibility') or
                    'Unknown'
                )
                
                # Match to official class names
                susceptibility_lower = str(susceptibility).lower()
                matched_class = None
                
                for class_name in definitions.keys():
                    if class_name.lower() in susceptibility_lower:
                        matched_class = class_name
                        break
                
                if not matched_class:
                    matched_class = 'Low'  # Default if no match
                
                # Get geometry and calculate area
                geometry = feature.get('geometry')
                if geometry:
                    hazard_geom = shape(geometry)
                    clipped = hazard_geom.intersection(barangay_geom)
                    
                    if not clipped.is_empty:
                        area_sq_degrees = clipped.area
                        area_sq_meters = area_sq_degrees * (111000 ** 2)
                        area_hectares = area_sq_meters / 10000
                        
                        stats[matched_class]['area'] += area_hectares
                        stats[matched_class]['count'] += 1
                        total_hazard_area += area_hectares
                        
            except Exception as e:
                logger.warning(f"⚠️ Error processing feature: {e}")
                continue
        
        # Calculate percentages and format result
        result = []
        for class_name, data in stats.items():
            if data['area'] > 0:
                percentage = (data['area'] / total_hazard_area * 100) if total_hazard_area > 0 else 0
                result.append({
                    'class': data['official_title'],
                    'area_hectares': round(data['area'], 2),
                    'percentage': round(percentage, 1),
                    'count': data['count'],
                    'color': data['color'],
                    'official_description': data['official_description'],
                    'source': data['source']
                })
        
        result.sort(key=lambda x: x['percentage'], reverse=True)
        
        return {
            'total_hazard_area_hectares': round(total_hazard_area, 2),
            'breakdown': result,
            'feature_count': len(features),
            'official_definitions': definitions
        }
        
    except Exception as e:
        logger.error(f"❌ Error calculating statistics: {e}", exc_info=True)
        return {
            'total_hazard_area_hectares': 0,
            'breakdown': [],
            'feature_count': 0,
            'official_definitions': OFFICIAL_DEFINITIONS.get(hazard_type, {})
        }


@csrf_exempt
@require_http_methods(["GET", "POST"])
def analyze_barangay_hazards(request, barangay_id):
    """
    GET /api/barangay-hazard-analysis/<barangay_id>/
    Analyzes all hazard types for a specific barangay
    AUTOMATICALLY fetches barangay boundary - NO polygon field needed in database!
    """
    try:
        from barangay.models import Barangay
        
        # Get barangay from database
        barangay = Barangay.objects.get(barangay_id=barangay_id)
        
        # Try to get boundary from OpenStreetMap
        barangay_geojson = get_barangay_boundary(barangay.name, "Ormoc City")
        
        # If no boundary found, create from coordinate
        if not barangay_geojson and hasattr(barangay, 'coordinate') and barangay.coordinate:
            logger.info(f"📍 Using coordinate to create boundary for {barangay.name}")
            # Assuming coordinate is [lat, lng]
            lat = barangay.coordinate[0] if isinstance(barangay.coordinate, list) else float(barangay.coordinate.split(',')[0])
            lng = barangay.coordinate[1] if isinstance(barangay.coordinate, list) else float(barangay.coordinate.split(',')[1])
            barangay_geojson = create_boundary_from_coordinate(lat, lng, radius_degrees=0.03)
        
        if not barangay_geojson:
            return JsonResponse({
                'success': False,
                'error': f'Could not fetch or create boundary for {barangay.name}'
            }, status=400)
        
        logger.info(f"🏘️ Analyzing hazards for {barangay.name}...")
        
        results = {}
        
        # 1. Flood Analysis
        flood_features = query_arcgis_for_area(MGB_FLOOD_URL, barangay_geojson, 'flood')
        flood_stats = calculate_zonal_statistics(flood_features, barangay_geojson, 'flood')
        
        results['flood'] = {
            'statistics': flood_stats,
            'hazard_type': 'Flood Susceptibility',
            'agency': 'MGB (Mines and Geosciences Bureau)',
            'data_source': 'https://controlmap.mgb.gov.ph'
        }
        
        # 2. Landslide Analysis
        landslide_features = query_arcgis_for_area(MGB_LANDSLIDE_URL, barangay_geojson, 'landslide')
        landslide_stats = calculate_zonal_statistics(landslide_features, barangay_geojson, 'landslide')
        
        results['landslide'] = {
            'statistics': landslide_stats,
            'hazard_type': 'Rain-Induced Landslide Susceptibility',
            'agency': 'MGB (Mines and Geosciences Bureau)',
            'data_source': 'https://controlmap.mgb.gov.ph'
        }
        
        # 3. Earthquake-Induced Landslide Analysis
        eil_features = query_arcgis_for_area(PHIVOLCS_EIL_URL, barangay_geojson, 'eil')
        eil_stats = calculate_zonal_statistics(eil_features, barangay_geojson, 'eil')
        
        results['eil'] = {
            'statistics': eil_stats,
            'hazard_type': 'Earthquake-Induced Landslide Susceptibility',
            'agency': 'PHIVOLCS (Philippine Institute of Volcanology and Seismology)',
            'data_source': 'https://gisweb.phivolcs.dost.gov.ph'
        }
        
        overall_risk = calculate_overall_risk(results)
        
        return JsonResponse({
            'success': True,
            'barangay': {
                'id': barangay.barangay_id,
                'name': barangay.name,
                'description': barangay.description
            },
            'analysis': results,
            'overall_risk': overall_risk,
            'methodology': 'Barangay boundary automatically fetched from OpenStreetMap or created from coordinate center point',
            'note': 'All susceptibility definitions and classifications are from official MGB and PHIVOLCS hazard maps.',
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"❌ Error analyzing barangay: {e}", exc_info=True)
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


def calculate_overall_risk(results):
    """
    Calculate overall risk score
    """
    try:
        risk_scores = []
        
        for hazard_type, data in results.items():
            stats = data['statistics']
            very_high_pct = next((s['percentage'] for s in stats['breakdown'] if 'very high' in s['class'].lower()), 0)
            high_pct = next((s['percentage'] for s in stats['breakdown'] if 'high' in s['class'].lower() and 'very' not in s['class'].lower()), 0)
            
            risk_score = (very_high_pct * 100 + high_pct * 75) / 100
            risk_scores.append(risk_score)
        
        avg_risk = sum(risk_scores) / len(risk_scores) if risk_scores else 0
        
        if avg_risk > 50:
            level = 'Very High'
            color = '#dc2626'
        elif avg_risk > 30:
            level = 'High'
            color = '#ea580c'
        elif avg_risk > 15:
            level = 'Moderate'
            color = '#eab308'
        else:
            level = 'Low'
            color = '#22c55e'
        
        return {
            'score': round(avg_risk, 1),
            'level': level,
            'color': color
        }
    except Exception as e:
        logger.error(f"❌ Error calculating overall risk: {e}")
        return {
            'score': 0,
            'level': 'Unknown',
            'color': '#9ca3af'
        }