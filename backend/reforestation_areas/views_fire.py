import requests
import csv
import io
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.conf import settings
import logging

logger = logging.getLogger(__name__)


@csrf_exempt
@require_http_methods(["POST"])
def get_firms_fire_data(request):
    try:
        import json
        data = json.loads(request.body)
        bbox = data.get('bbox')
        time_range = data.get('time_range', '24hrs')
        
        if not bbox:
            return JsonResponse({"success": False, "error": "Missing bbox"}, status=400)
        
        west, south, east, north = [float(x.strip()) for x in bbox.split(',')]
        
        # Determine day range
        if time_range == '24hrs':
            day_range = '1'
        elif time_range == '48hrs':
            day_range = '2'
        else:
            day_range = '7'
        
        # Build URL
        firms_csv_url = f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/{settings.FIRMS_API_TOKEN}/VIIRS_SNPP_NRT/{west},{south},{east},{north}/{day_range}"
        
        logger.info(f"🔥 FIRMS Request URL: {firms_csv_url}")
        
        response = requests.get(firms_csv_url, timeout=15)
        logger.info(f"📊 FIRMS Response Status: {response.status_code}")
        
        if response.status_code == 200:
            csv_text = response.text
            lines = csv_text.strip().split('\n')
            logger.info(f"📄 CSV Lines: {len(lines)}")
            logger.info(f"📄 CSV Preview: {csv_text[:200]}")
            
            # Parse CSV
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
                        "instrument": row.get('instrument', 'VIIRS'),
                        "daynight": row.get('daynight', ''),
                        "frp": row.get('frp', '')
                    })
                except (ValueError, KeyError) as e:
                    logger.warning(f"⚠️ Failed to parse row: {e}")
                    continue
            
            logger.info(f"✅ Parsed {len(fires)} fires")
            
            return JsonResponse({
                "success": True,
                "fire_count": len(fires),
                "fires": fires,
                "bbox": bbox,
                "time_range": time_range
            })
        else:
            logger.error(f"❌ FIRMS API Error {response.status_code}: {response.text[:200]}")
            return JsonResponse({
                "success": False,
                "error": f"FIRMS API returned {response.status_code}",
                "details": response.text[:500]
            }, status=500)
            
    except Exception as e:
        logger.error(f"❌ FIRMS error: {e}", exc_info=True)
        return JsonResponse({
            "success": False,
            "error": str(e)
        }, status=500)

@csrf_exempt
@require_http_methods(["GET", "POST"])
def get_firms_fire_count(request):
    """
    POST /api/firms-fire-count/
    Returns count of active fires (now uses same logic as fire_data)
    """
    try:
        if request.method == "POST":
            import json
            data = json.loads(request.body)
            bbox = data.get('bbox')
            time_range = data.get('time_range', '24hrs')
        else:
            bbox = request.GET.get('bbox')
            time_range = request.GET.get('time_range', '24hrs')
        
        if not bbox:
            return JsonResponse({
                "success": False,
                "error": "Missing bbox parameter"
            }, status=400)
        
        west, south, east, north = [float(x.strip()) for x in bbox.split(',')]
        day_range = '1' if time_range in ['24hrs', '48hrs'] else '7'
        
        firms_csv_url = f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/{settings.FIRMS_API_TOKEN}/VIIRS_SNPP_NRT/{west},{south},{east},{north}/{day_range}"
        
        response = requests.get(firms_csv_url, timeout=15)
        
        if response.status_code == 200:
            lines = response.text.strip().split('\n')
            fire_count = len(lines) - 1 if len(lines) > 1 else 0
            
            return JsonResponse({
                "success": True,
                "fire_count": fire_count,
                "bbox": bbox
            })
        else:
            return JsonResponse({
                "success": True,
                "fire_count": 0,
                "message": "No data available"
            })
            
    except Exception as e:
        logger.error(f"Fire count error: {e}", exc_info=True)
        return JsonResponse({
            "success": False,
            "error": str(e)
        }, status=500)