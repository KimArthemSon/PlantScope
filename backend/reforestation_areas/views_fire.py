import requests
import csv
import io
import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.conf import settings
import logging

logger = logging.getLogger(__name__)

def validate_and_normalize_bbox(bbox_str):
    try:
        west, south, east, north = [float(x.strip()) for x in bbox_str.split(',')]
    except ValueError:
        raise ValueError("Bounding box must contain 4 comma-separated numeric values.")

    if abs(west) > 1000 or abs(east) > 1000 or abs(south) > 1000 or abs(north) > 1000:
        raise ValueError("Invalid coordinates. Ensure EPSG:4326 (degrees).")

    def normalize_longitude(lon):
        while lon > 180: lon -= 360
        while lon < -180: lon += 360
        return lon

    west = normalize_longitude(west)
    east = normalize_longitude(east)
    if west > east: west, east = -180, 180
    south = max(-90, min(90, south))
    north = max(-90, min(90, north))
    return west, south, east, north

def fetch_firms(token, source, bbox, day_range, date=None):
    """
    Fetch fire data from FIRMS API.
    If date is None, it uses the API's current server date.
    """
    if date:
        url = f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/{token}/{source}/{bbox}/{day_range}/{date}"
    else:
        url = f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/{token}/{source}/{bbox}/{day_range}"
    
    try:
        logger.info(f"📡 Fetching {source} | days={day_range} | date={date or 'recent'}")
        logger.info(f"🔗 URL: {url}")
        response = requests.get(url, timeout=15)
        
        if response.status_code != 200:
            logger.warning(f"⚠️ {source} returned {response.status_code}: {response.text[:150]}")
            return []
        
        csv_text = response.text.strip()
        if not csv_text or csv_text.startswith("<!DOCTYPE") or csv_text.startswith("<html") or csv_text.startswith("Error"):
            return []
            
        lines = csv_text.split('\n')
        if len(lines) <= 1: return []
        
        reader = csv.DictReader(io.StringIO(csv_text))
        fires = []
        for row in reader:
            try:
                fires.append({
                    "latitude": float(row.get('latitude', 0)),
                    "longitude": float(row.get('longitude', 0)),
                    "brightness": float(row.get('bright_ti4', 0)),
                    "confidence": row.get('confidence', 'nominal'),
                    "acq_date": row.get('acq_date', ''),
                    "acq_time": row.get('acq_time', ''),
                    "satellite": row.get('satellite', 'N'),
                    "instrument": row.get('instrument', source.split('_')[0]),
                    "daynight": row.get('daynight', ''),
                    "frp": row.get('frp', ''),
                    "dataset": source
                })
            except (ValueError, KeyError):
                continue
        logger.info(f"✅ {source}: Found {len(fires)} fires")
        return fires
    except Exception as e:
        logger.error(f"❌ Error fetching {source}: {e}")
        return []

def deduplicate_fires(fires):
    seen = set()
    unique = []
    for f in fires:
        key = (round(f['latitude'], 4), round(f['longitude'], 4), f['acq_date'], f['acq_time'])
        if key not in seen:
            seen.add(key)
            unique.append(f)
    return unique

@csrf_exempt
@require_http_methods(["POST"])
def get_firms_fire_data(request):
    try:
        data = json.loads(request.body)
        bbox = data.get('bbox')
        time_range = data.get('time_range', 'today')
        
        if not bbox:
            return JsonResponse({"success": False, "error": "Missing bbox"}, status=400)
        
        try:
            w, s, e, n = validate_and_normalize_bbox(bbox)
        except ValueError as err:
            return JsonResponse({"success": False, "error": str(err)}, status=400)
        
        bbox_str = f"{w},{s},{e},{n}"
        logger.info(f"🔥 FIRMS Request - BBox: {bbox_str}, Time Range: {time_range}")
        
        all_fires = []
        
        # NRT (Near Real-Time) - for TODAY and 24H
        nrt_sources = ['VIIRS_SNPP_NRT', 'VIIRS_NOAA20_NRT', 'MODIS_NRT']
        
        # Standard Processing (Historical) - for 7D
        # ✅ FIXED: Use correct source names with _SP suffix
        sp_sources = ['VIIRS_SNPP_SP', 'VIIRS_NOAA20_SP', 'MODIS_SP']
        
        if time_range == 'today':
            logger.info("📅 Using TODAY (NRT, day_range=1)")
            for src in nrt_sources:
                all_fires.extend(fetch_firms(settings.FIRMS_API_TOKEN, src, bbox_str, 1))
                
        elif time_range == '24hrs':
            logger.info("📅 Using 24HRS (NRT, day_range=2)")
            for src in nrt_sources:
                all_fires.extend(fetch_firms(settings.FIRMS_API_TOKEN, src, bbox_str, 2))
                
        elif time_range == '7days':
            logger.info("📅 Using 7DAYS (Standard sources, day_range=5 max)")
            # ✅ FIXED: 
            # 1. Use correct source names (_SP suffix)
            # 2. Use day_range=5 (maximum allowed by API)
            # 3. DO NOT pass date parameter (avoids using server's incorrect 2026 date)
            # Note: API limits day_range to 1-5. We get 5 days of recent data.
            for src in sp_sources:
                all_fires.extend(fetch_firms(settings.FIRMS_API_TOKEN, src, bbox_str, 5))
        else:
            for src in nrt_sources:
                all_fires.extend(fetch_firms(settings.FIRMS_API_TOKEN, src, bbox_str, 1))
        
        unique_fires = deduplicate_fires(all_fires)
        logger.info(f"✅ Total: {len(all_fires)} detections, {len(unique_fires)} unique fires")
        
        return JsonResponse({
            "success": True,
            "fire_count": len(unique_fires),
            "fires": unique_fires,
            "bbox": bbox_str,
            "time_range": time_range,
            "total_detections": len(all_fires),
            "unique_fires": len(unique_fires)
        })
        
    except Exception as e:
        logger.error(f"❌ FIRMS error: {e}", exc_info=True)
        return JsonResponse({"success": False, "error": str(e)}, status=500)

@csrf_exempt
@require_http_methods(["GET", "POST"])
def get_firms_fire_count(request):
    try:
        if request.method == "POST":
            data = json.loads(request.body)
            bbox = data.get('bbox')
            time_range = data.get('time_range', 'today')
        else:
            bbox = request.GET.get('bbox')
            time_range = request.GET.get('time_range', 'today')
        
        if not bbox:
            return JsonResponse({"success": False, "error": "Missing bbox parameter"}, status=400)
            
        try:
            w, s, e, n = validate_and_normalize_bbox(bbox)
        except ValueError as err:
            return JsonResponse({"success": False, "error": str(err)}, status=400)
        
        bbox_str = f"{w},{s},{e},{n}"
        all_fires = []
        
        nrt_sources = ['VIIRS_SNPP_NRT', 'VIIRS_NOAA20_NRT', 'MODIS_NRT']
        sp_sources = ['VIIRS_SNPP_SP', 'VIIRS_NOAA20_SP', 'MODIS_SP']
        
        if time_range == 'today':
            for src in nrt_sources:
                all_fires.extend(fetch_firms(settings.FIRMS_API_TOKEN, src, bbox_str, 1))
        elif time_range == '24hrs':
            for src in nrt_sources:
                all_fires.extend(fetch_firms(settings.FIRMS_API_TOKEN, src, bbox_str, 2))
        elif time_range == '7days':
            # ✅ FIXED: Use day_range=5 with correct _SP sources
            for src in sp_sources:
                all_fires.extend(fetch_firms(settings.FIRMS_API_TOKEN, src, bbox_str, 5))
        else:
            for src in nrt_sources:
                all_fires.extend(fetch_firms(settings.FIRMS_API_TOKEN, src, bbox_str, 1))
        
        unique_fires = deduplicate_fires(all_fires)
        
        return JsonResponse({
            "success": True,
            "fire_count": len(unique_fires),
            "bbox": bbox_str,
            "time_range": time_range,
            "total_detections": len(all_fires),
            "unique_fires": len(unique_fires)
        })
        
    except Exception as e:
        logger.error(f"Fire count error: {e}", exc_info=True)
        return JsonResponse({"success": False, "error": str(e)}, status=500)