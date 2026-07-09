import requests
import csv
import io
import json
from datetime import datetime, timedelta
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
        response = requests.get(url, timeout=30)
        
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

def get_date_ranges(start_date, end_date, max_days_per_call=5):
    """
    Split date range into chunks of max_days_per_call days.
    Returns list of (start_date, end_date) tuples.
    """
    start = datetime.strptime(start_date, '%Y-%m-%d')
    end = datetime.strptime(end_date, '%Y-%m-%d')
    
    if start > end:
        start, end = end, start
    
    date_ranges = []
    current_start = start
    
    while current_start <= end:
        current_end = min(current_start + timedelta(days=max_days_per_call-1), end)
        date_ranges.append((
            current_start.strftime('%Y-%m-%d'),
            current_end.strftime('%Y-%m-%d')
        ))
        current_start = current_end + timedelta(days=1)
    
    return date_ranges

def fetch_firms_for_date_range(token, bbox, start_date, end_date):
    """
    Fetch FIRMS data for a custom date range by making multiple API calls.
    """
    all_fires = []
    date_ranges = get_date_ranges(start_date, end_date, max_days_per_call=5)
    
    logger.info(f"📅 Fetching FIRMS data from {start_date} to {end_date}")
    logger.info(f"📊 Split into {len(date_ranges)} API call(s)")
    
    # Determine which sources to use based on date range
    today = datetime.now().date()
    end_dt = datetime.strptime(end_date, '%Y-%m-%d').date()
    
    # Use NRT for recent data (last 2 days), SP for older data
    if (today - end_dt).days <= 2:
        sources = ['VIIRS_SNPP_NRT', 'VIIRS_NOAA20_NRT', 'MODIS_NRT']
    else:
        sources = ['VIIRS_SNPP_SP', 'VIIRS_NOAA20_SP', 'MODIS_SP']
    
    for range_start, range_end in date_ranges:
        # Calculate days in this range
        start_dt = datetime.strptime(range_start, '%Y-%m-%d')
        end_dt = datetime.strptime(range_end, '%Y-%m-%d')
        days = (end_dt - start_dt).days + 1
        
        logger.info(f"  🔸 Fetching {range_start} to {range_end} ({days} days)")
        
        for source in sources:
            fires = fetch_firms(token, source, bbox, days, range_end)
            all_fires.extend(fires)
    
    return all_fires

@csrf_exempt
@require_http_methods(["POST"])
def get_firms_fire_data(request):
    try:
        data = json.loads(request.body)
        bbox = data.get('bbox')
        time_range = data.get('time_range', 'today')
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        
        if not bbox:
            return JsonResponse({"success": False, "error": "Missing bbox"}, status=400)
        
        try:
            w, s, e, n = validate_and_normalize_bbox(bbox)
        except ValueError as err:
            return JsonResponse({"success": False, "error": str(err)}, status=400)
        
        bbox_str = f"{w},{s},{e},{n}"
        
        # Handle custom date range
        if start_date and end_date:
            logger.info(f" FIRMS Request - Custom Date Range: {start_date} to {end_date}")
            all_fires = fetch_firms_for_date_range(settings.FIRMS_API_TOKEN, bbox_str, start_date, end_date)
            unique_fires = deduplicate_fires(all_fires)
            
            return JsonResponse({
                "success": True,
                "fire_count": len(unique_fires),
                "fires": unique_fires,
                "bbox": bbox_str,
                "time_range": "custom",
                "start_date": start_date,
                "end_date": end_date,
                "total_detections": len(all_fires),
                "unique_fires": len(unique_fires)
            })
        
        # Handle preset time ranges
        logger.info(f"🔥 FIRMS Request - BBox: {bbox_str}, Time Range: {time_range}")
        all_fires = []
        
        # NRT (Near Real-Time) - for TODAY and 24H
        nrt_sources = ['VIIRS_SNPP_NRT', 'VIIRS_NOAA20_NRT', 'MODIS_NRT']
        
        # Standard Processing (Historical) - for 7D
        sp_sources = ['VIIRS_SNPP_SP', 'VIIRS_NOAA20_SP', 'MODIS_SP']
        
        if time_range == 'today':
            logger.info("📅 Using TODAY (NRT, day_range=1)")
            for src in nrt_sources:
                all_fires.extend(fetch_firms(settings.FIRMS_API_TOKEN, src, bbox_str, 1))
                
        elif time_range == '24hrs':
            logger.info(" Using 24HRS (NRT, day_range=2)")
            for src in nrt_sources:
                all_fires.extend(fetch_firms(settings.FIRMS_API_TOKEN, src, bbox_str, 2))
                
        elif time_range == '7days':
            logger.info("📅 Using 7DAYS (Standard sources, multiple calls)")
            # Fetch last 7 days using multiple API calls
            today = datetime.now().date()
            seven_days_ago = today - timedelta(days=6)
            
            all_fires = fetch_firms_for_date_range(
                settings.FIRMS_API_TOKEN, 
                bbox_str, 
                seven_days_ago.strftime('%Y-%m-%d'),
                today.strftime('%Y-%m-%d')
            )
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
            start_date = data.get('start_date')
            end_date = data.get('end_date')
        else:
            bbox = request.GET.get('bbox')
            time_range = request.GET.get('time_range', 'today')
            start_date = request.GET.get('start_date')
            end_date = request.GET.get('end_date')
        
        if not bbox:
            return JsonResponse({"success": False, "error": "Missing bbox parameter"}, status=400)
            
        try:
            w, s, e, n = validate_and_normalize_bbox(bbox)
        except ValueError as err:
            return JsonResponse({"success": False, "error": str(err)}, status=400)
        
        bbox_str = f"{w},{s},{e},{n}"
        
        # Handle custom date range
        if start_date and end_date:
            all_fires = fetch_firms_for_date_range(settings.FIRMS_API_TOKEN, bbox_str, start_date, end_date)
            unique_fires = deduplicate_fires(all_fires)
            
            return JsonResponse({
                "success": True,
                "fire_count": len(unique_fires),
                "bbox": bbox_str,
                "time_range": "custom",
                "start_date": start_date,
                "end_date": end_date,
                "total_detections": len(all_fires),
                "unique_fires": len(unique_fires)
            })
        
        # Handle preset time ranges
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
            today = datetime.now().date()
            seven_days_ago = today - timedelta(days=6)
            all_fires = fetch_firms_for_date_range(
                settings.FIRMS_API_TOKEN, 
                bbox_str, 
                seven_days_ago.strftime('%Y-%m-%d'),
                today.strftime('%Y-%m-%d')
            )
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