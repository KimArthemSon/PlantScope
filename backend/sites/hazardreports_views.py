import json
import logging
import requests
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

# ✅ PURE PYTHON SPATIAL LIBRARIES (No GDAL required)
from shapely.geometry import shape
from shapely.validation import make_valid
from shapely.ops import unary_union
import pyproj

logger = logging.getLogger(__name__)

def get_esri_geometry(geom):
    """Converts a Shapely geometry to Esri JSON format for ArcGIS REST API."""
    if geom.geom_type == 'Polygon':
        rings = [[list(coord) for coord in geom.exterior.coords]]
        for interior in geom.interiors:
            rings.append([list(coord) for coord in interior.coords])
        return {"rings": rings, "spatialReference": {"wkid": 4326}}
    elif geom.geom_type == 'MultiPolygon':
        rings = []
        for poly in geom.geoms:
            rings.append([list(coord) for coord in poly.exterior.coords])
            for interior in poly.interiors:
                rings.append([list(coord) for coord in interior.coords])
        return {"rings": rings, "spatialReference": {"wkid": 4326}}
    else:
        raise ValueError(f"Unsupported geometry type: {geom.geom_type}")

def detect_color_mapping(features):
    """
    Automatically detect how MGB maps values to colors based on the actual data.
    """
    default_mapping = {
        "VH": "very_high", "VHL": "very_high", "VERY HIGH": "very_high", "VERYHIGH": "very_high",
        "4": "very_high", "CLASS 4": "very_high", "CLASS4": "very_high",
        "HL": "high", "HIGH": "high", "3": "high", "CLASS 3": "high", "CLASS3": "high", "H": "high",
        "ML": "moderate", "MODERATE": "moderate", "2": "moderate", "CLASS 2": "moderate", "CLASS2": "moderate", "M": "moderate",
        "LL": "low", "LOW": "low", "1": "low", "CLASS 1": "low", "CLASS1": "low", "L": "low"
    }
    
    unique_values = set()
    for feature in features:
        props = feature.get("properties", {})
        for key, value in props.items():
            if value is None:
                continue
            key_upper = key.upper()
            if "SUSC" in key_upper or "CLASS" in key_upper or "TYPE" in key_upper or "LND" in key_upper:
                value_str = str(value).upper().strip()
                unique_values.add(value_str)
    
    print(f"   -> Detected unique values: {unique_values}")
    
    # Pattern detection - map REST values to severity levels
    if "LL" in unique_values and "ML" in unique_values and "HL" in unique_values:
        print("   -> Pattern: LL + ML + HL = Low, Moderate, High")
        return {
            "LL": "low",
            "ML": "moderate",
            "HL": "high",
            **{k: v for k, v in default_mapping.items() if k not in ["LL", "ML", "HL"]}
        }
    
    if "LL" in unique_values and "ML" in unique_values:
        print("   -> Pattern: LL + ML = Low, Moderate")
        return {
            "LL": "low",
            "ML": "moderate",
            **{k: v for k, v in default_mapping.items() if k not in ["LL", "ML"]}
        }
    
    if "ML" in unique_values and "HL" in unique_values and "LL" not in unique_values:
        print("   -> Pattern: ML + HL = Moderate, High")
        return {
            "ML": "moderate",
            "HL": "high",
            **{k: v for k, v in default_mapping.items() if k not in ["ML", "HL"]}
        }
    
    print("   -> Using default mapping")
    return default_mapping

@csrf_exempt
def analyze_hazard_area(request):
    print("✅✅✅ ANALYZE_HAZARD_AREA FUNCTION WAS CALLED ✅✅✅")
    
    if request.method != "POST":
        return JsonResponse({"error": "POST only."}, status=405)
    
    try:
        data = json.loads(request.body)
        geometry = data.get('geometry')
        
        if not geometry:
            return JsonResponse({"error": "Geometry (GeoJSON) is required"}, status=400)
            
        try:
            input_geom = shape(geometry)
            if not input_geom.is_valid:
                input_geom = make_valid(input_geom)
        except Exception as e:
            print(f"❌ Invalid geometry: {e}")
            return JsonResponse({"error": "Invalid geometry format"}, status=400)
            
        geod = pyproj.Geod(ellps='WGS84')
        total_area_sq_m = abs(geod.geometry_area_perimeter(input_geom)[0])
        total_area_ha = total_area_sq_m / 10000.0
        
        if total_area_ha == 0:
            return JsonResponse({"error": "Geometry area is zero"}, status=400)

        urls = {
            "flood": "https://controlmap.mgb.gov.ph/arcgis/rest/services/GeospatialDataInventory/GDI_Detailed_Flood_Susceptibility/MapServer/0/query",
            "landslide": "https://controlmap.mgb.gov.ph/arcgis/rest/services/GeospatialDataInventory/GDI_Detailed_Rain_induced_Landslide_Susceptibility/MapServer/0/query",
            "eil": "https://gisweb.phivolcs.dost.gov.ph/arcgis/rest/services/PHIVOLCSPublic/EarthquakeInducedLandslide/MapServer/0/query"
        }
        
        esri_geom = get_esri_geometry(input_geom)
        
        params = {
            "geometry": json.dumps(esri_geom),
            "geometryType": "esriGeometryPolygon",
            "inSR": 4326,
            "outSR": 4326,
            "spatialRel": "esriSpatialRelIntersects",
            "outFields": "*",
            "returnGeometry": "true",
            "f": "geojson"
        }
        
        hazard_severity_ha = {
            "flood": {"very_high": 0.0, "high": 0.0, "moderate": 0.0, "low": 0.0, "safe": 0.0},
            "landslide": {"very_high": 0.0, "high": 0.0, "moderate": 0.0, "low": 0.0, "safe": 0.0},
            "eil": {"very_high": 0.0, "high": 0.0, "moderate": 0.0, "low": 0.0, "safe": 0.0}
        }
        
        for hazard_type, url in urls.items():
            print(f"4. Querying {hazard_type.upper()}...")
            try:
                response = requests.get(url, params=params, timeout=15)
                
                if response.status_code != 200:
                    continue
                    
                geojson_data = response.json()
                features = geojson_data.get("features", [])
                print(f"   -> 📊 Returned {len(features)} features")
                
                if not features:
                    hazard_severity_ha[hazard_type]["safe"] = total_area_ha
                    continue
                
                color_mapping = detect_color_mapping(features)
                print(f"   -> Using color mapping: {color_mapping}")
                
                very_high_geoms = []
                high_risk_geoms = []
                moderate_risk_geoms = []
                low_risk_geoms = []
                
                for idx, feature in enumerate(features):
                    try:
                        hazard_geom = shape(feature["geometry"])
                        if not hazard_geom.is_valid:
                            hazard_geom = make_valid(hazard_geom)
                        
                        props = feature.get("properties", {})
                        severity_level = "low"
                        
                        for key, value in props.items():
                            if value is None:
                                continue
                            value_str = str(value).upper().strip()
                            key_upper = key.upper()
                            
                            if "SUSC" in key_upper or "CLASS" in key_upper or "TYPE" in key_upper or "LND" in key_upper:
                                if value_str in color_mapping:
                                    severity_level = color_mapping[value_str]
                                    emoji = "🟢" if severity_level == "low" else "🟡" if severity_level == "moderate" else "🟠" if severity_level == "high" else "🔴"
                                    print(f"      -> {emoji} {key}: {value} = {severity_level.upper()}")
                                    break
                        
                        if severity_level == "very_high":
                            very_high_geoms.append(hazard_geom)
                        elif severity_level == "high":
                            high_risk_geoms.append(hazard_geom)
                        elif severity_level == "moderate":
                            moderate_risk_geoms.append(hazard_geom)
                        else:
                            low_risk_geoms.append(hazard_geom)
                            
                    except Exception as geom_err:
                        print(f"   -> ⚠️ Geometry error: {geom_err}")
                        continue
                
                severity_groups = [
                    ("very_high", very_high_geoms),
                    ("high", high_risk_geoms),
                    ("moderate", moderate_risk_geoms),
                    ("low", low_risk_geoms)
                ]
                
                for level_name, geoms in severity_groups:
                    if geoms:
                        merged = unary_union(geoms)
                        intersection = input_geom.intersection(merged)
                        if not intersection.is_empty and intersection.area > 0:
                            overlap_sq_m = abs(geod.geometry_area_perimeter(intersection)[0])
                            hazard_severity_ha[hazard_type][level_name] = overlap_sq_m / 10000.0
                
                total_identified_hazard_ha = (
                    hazard_severity_ha[hazard_type]["very_high"] +
                    hazard_severity_ha[hazard_type]["high"] +
                    hazard_severity_ha[hazard_type]["moderate"] +
                    hazard_severity_ha[hazard_type]["low"]
                )
                
                if total_identified_hazard_ha < total_area_ha:
                    gap_ha = total_area_ha - total_identified_hazard_ha
                    active_levels = [level for level in ["very_high", "high", "moderate", "low"] 
                                   if hazard_severity_ha[hazard_type][level] > 0]
                    if active_levels:
                        gap_per_level = gap_ha / len(active_levels)
                        for level in active_levels:
                            hazard_severity_ha[hazard_type][level] += gap_per_level
                        print(f"   -> 📊 Distributed {gap_ha:.2f} ha gap across {len(active_levels)} active levels")
                    else:
                        hazard_severity_ha[hazard_type]["low"] = total_area_ha
                        print(f"   -> 📊 No hazard data found, treating all as Low")
                
                hazard_severity_ha[hazard_type]["safe"] = 0.0
                
                print(f"   -> FINAL for {hazard_type.upper()}:")
                print(f"      🔴 VERY HIGH: {hazard_severity_ha[hazard_type]['very_high']:.2f} ha")
                print(f"      🟠 HIGH: {hazard_severity_ha[hazard_type]['high']:.2f} ha")
                print(f"      🟡 MODERATE: {hazard_severity_ha[hazard_type]['moderate']:.2f} ha")
                print(f"      🟢 LOW: {hazard_severity_ha[hazard_type]['low']:.2f} ha")
                        
            except Exception as e:
                print(f"   -> ❌ FAILED: {e}")
        
        results = {}
        max_percentage = 0.0
        
        for h_type in ["flood", "landslide", "eil"]:
            very_high_pct = min(100.0, round((hazard_severity_ha[h_type]["very_high"] / total_area_ha) * 100, 1)) if total_area_ha > 0 else 0.0
            high_pct = min(100.0, round((hazard_severity_ha[h_type]["high"] / total_area_ha) * 100, 1)) if total_area_ha > 0 else 0.0
            moderate_pct = min(100.0, round((hazard_severity_ha[h_type]["moderate"] / total_area_ha) * 100, 1)) if total_area_ha > 0 else 0.0
            low_pct = min(100.0, round((hazard_severity_ha[h_type]["low"] / total_area_ha) * 100, 1)) if total_area_ha > 0 else 0.0
            safe_pct = min(100.0, round((hazard_severity_ha[h_type]["safe"] / total_area_ha) * 100, 1)) if total_area_ha > 0 else 0.0
            
            results[h_type] = {
                "very_high_ha": round(hazard_severity_ha[h_type]["very_high"], 2),
                "high_ha": round(hazard_severity_ha[h_type]["high"], 2),
                "moderate_ha": round(hazard_severity_ha[h_type]["moderate"], 2),
                "low_ha": round(hazard_severity_ha[h_type]["low"], 2),
                "safe_ha": round(hazard_severity_ha[h_type]["safe"], 2),
                "very_high_percentage": very_high_pct,
                "high_percentage": high_pct,
                "moderate_percentage": moderate_pct,
                "low_percentage": low_pct,
                "safe_percentage": safe_pct
            }
            
            risk_pct = very_high_pct + high_pct
            if risk_pct > max_percentage:
                max_percentage = risk_pct
        
        print(f"5. FINAL RESULTS:")
        for h_type in ["flood", "landslide", "eil"]:
            print(f"  {h_type.upper()}: VH={results[h_type]['very_high_percentage']}%, H={results[h_type]['high_percentage']}%, M={results[h_type]['moderate_percentage']}%, L={results[h_type]['low_percentage']}%, Safe={results[h_type]['safe_percentage']}%")
        
        recommendations = []
        if max_percentage > 30:
            overall_risk = "HIGH"
            recommendations.append("⚠️ HIGH RISK: Significant hazard overlap detected.")
        elif max_percentage > 10:
            overall_risk = "MODERATE"
            recommendations.append("⚠️ MODERATE RISK: Some hazard exposure detected.")
        else:
            overall_risk = "LOW"
            recommendations.append("✅ LOW RISK: Area is suitable for reforestation.")
            
        if results["flood"]["very_high_percentage"] > 10 or results["flood"]["high_percentage"] > 20:
            recommendations.append("🌊 Flood Risk: Consider flood-tolerant species.")
        if results["landslide"]["very_high_percentage"] > 10 or results["landslide"]["high_percentage"] > 20:
            recommendations.append("⛰️ Rain-Induced Landslide Risk: Use terracing and shallow roots.")
        if results["eil"]["very_high_percentage"] > 10 or results["eil"]["high_percentage"] > 20:
            recommendations.append("🌋 EIL Risk: Avoid permanent structures.")

        return JsonResponse({
            "success": True,
            "total_area_ha": round(total_area_ha, 2),
            "flood": results["flood"],
            "landslide": results["landslide"],
            "eil": results["eil"],
            "overall_risk": overall_risk,
            "recommendations": recommendations
        }, status=200)
        
    except Exception as e:
        print(f"❌❌❌ CRITICAL ERROR: {e}")
        import traceback
        traceback.print_exc()
        return JsonResponse({"error": str(e)}, status=500)