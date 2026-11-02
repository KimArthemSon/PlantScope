import csv
import hashlib
import io
import json
import logging
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone as dt_timezone

import requests
from django.conf import settings
from django.core.cache import cache
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
FIRMS_BASE_URL = "https://firms.modaps.eosdis.nasa.gov/api/area/csv"

# Override in settings.py if NASA retires a product (e.g. FIRMS_NRT_SOURCES = [...]).
# Check https://firms.modaps.eosdis.nasa.gov/api/data_availability/ for what is live.
NRT_SOURCES = getattr(settings, "FIRMS_NRT_SOURCES", [
    "VIIRS_SNPP_NRT", "VIIRS_NOAA20_NRT", "VIIRS_NOAA21_NRT", "MODIS_NRT",
])
SP_SOURCES = getattr(settings, "FIRMS_SP_SOURCES", [
    "VIIRS_SNPP_SP", "VIIRS_NOAA20_SP", "MODIS_SP",
])

MAX_DAYS_PER_CALL = 5      # FIRMS day_range per request
MAX_SPAN_DAYS = 31         # max custom date span accepted from clients
NRT_WINDOW_DAYS = 60       # chunks ending within this many days use NRT, older use SP
CACHE_SECONDS = 600        # 10 minutes
MAX_WORKERS = 4            # parallel FIRMS requests

SESSION = requests.Session()


def utc_today():
    """FIRMS dates are UTC, so never use the server's local date."""
    return datetime.now(dt_timezone.utc).date()


def parse_date(value):
    try:
        return datetime.strptime(str(value), '%Y-%m-%d').date()
    except ValueError:
        raise ValueError(f"Invalid date '{value}'. Use YYYY-MM-DD.")


# ---------------------------------------------------------------------------
# Bounding box
# ---------------------------------------------------------------------------
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


# ---------------------------------------------------------------------------
# FIRMS fetching
# ---------------------------------------------------------------------------
def fetch_firms(token, source, bbox, day_range, date=None):
    """
    Fetch fire data from the FIRMS API.

    `date` is the START of the window: FIRMS returns date .. date + day_range - 1.
    If date is None, FIRMS returns the most recent day_range days.

    Returns:
        list  -> success (may be empty = genuinely no fires)
        None  -> failure (timeout, bad key, rate limit, malformed response)
    """
    url = f"{FIRMS_BASE_URL}/{token}/{source}/{bbox}/{day_range}"
    if date:
        url += f"/{date}"

    try:
        response = SESSION.get(url, timeout=30)

        if response.status_code != 200:
            return None

        csv_text = response.text.strip()

        if not csv_text:
            return []

        # A valid CSV always starts with the header row. Anything else is an error message.
        if not csv_text.startswith("latitude"):
            return None

        reader = csv.DictReader(io.StringIO(csv_text))
        fires = []
        for row in reader:
            try:
                fires.append({
                    "latitude": float(row['latitude']),
                    "longitude": float(row['longitude']),
                    # VIIRS uses bright_ti4, MODIS uses brightness
                    "brightness": float(row.get('bright_ti4') or row.get('brightness') or 0),
                    "confidence": row.get('confidence', 'nominal'),
                    "acq_date": row.get('acq_date', ''),
                    "acq_time": row.get('acq_time', ''),
                    "satellite": row.get('satellite', 'N'),
                    "instrument": row.get('instrument', source.split('_')[0]),
                    "daynight": row.get('daynight', ''),
                    "frp": row.get('frp', ''),
                    "dataset": source
                })
            except (ValueError, KeyError, TypeError):
                continue

        return fires

    except requests.RequestException:
        return None
    except Exception:
        return None


def _run_jobs(token, jobs):
    """
    Run FIRMS requests in parallel.
    jobs: list of (source, bbox, day_range, date)
    Returns: (fires, failed_sources, all_failed)
    """
    if not jobs:
        return [], [], False

    def work(job):
        source, bbox, days, date = job
        return fetch_firms(token, source, bbox, days, date)

    with ThreadPoolExecutor(max_workers=min(MAX_WORKERS, len(jobs))) as executor:
        results = list(executor.map(work, jobs))

    fires = []
    failed = set()
    for job, result in zip(jobs, results):
        if result is None:
            failed.add(job[0])
        else:
            fires.extend(result)

    all_failed = all(r is None for r in results)
    return fires, sorted(failed), all_failed


def deduplicate_fires(fires):
    seen = set()
    unique = []
    for f in fires:
        key = (round(f['latitude'], 4), round(f['longitude'], 4), f['acq_date'], f['acq_time'])
        if key not in seen:
            seen.add(key)
            unique.append(f)
    return unique


def get_date_ranges(start_date, end_date, max_days_per_call=MAX_DAYS_PER_CALL):
    """
    Split date range into chunks of max_days_per_call days.
    Returns list of (start_date, end_date) tuples (YYYY-MM-DD strings).
    """
    start = datetime.strptime(start_date, '%Y-%m-%d')
    end = datetime.strptime(end_date, '%Y-%m-%d')

    if start > end:
        start, end = end, start

    date_ranges = []
    current_start = start

    while current_start <= end:
        current_end = min(current_start + timedelta(days=max_days_per_call - 1), end)
        date_ranges.append((
            current_start.strftime('%Y-%m-%d'),
            current_end.strftime('%Y-%m-%d')
        ))
        current_start = current_end + timedelta(days=1)

    return date_ranges


def fetch_firms_for_date_range(token, bbox, start_date, end_date):
    """
    Fetch a date range in <=5 day chunks.
    Recent chunks use NRT sources, older chunks use Standard Processing (SP).
    Returns: (fires, failed_sources, all_failed)
    """
    date_ranges = get_date_ranges(start_date, end_date)

    today = utc_today()
    jobs = []

    for range_start, range_end in date_ranges:
        start_dt = datetime.strptime(range_start, '%Y-%m-%d').date()
        end_dt_chunk = datetime.strptime(range_end, '%Y-%m-%d').date()
        days = (end_dt_chunk - start_dt).days + 1

        days_ago = (today - end_dt_chunk).days
        chunk_sources = NRT_SOURCES if days_ago <= NRT_WINDOW_DAYS else SP_SOURCES

        # FIRMS date param = START of window (returns date .. date + days - 1)
        for source in chunk_sources:
            jobs.append((source, bbox, days, range_start))

    fires, failed, all_failed = _run_jobs(token, jobs)
    return fires, failed, all_failed


def filter_last_24h(fires):
    """Keep only detections from the last 24 hours (UTC)."""
    cutoff = datetime.now(dt_timezone.utc) - timedelta(hours=24)
    kept = []
    for f in fires:
        try:
            acq_time = str(f['acq_time']).zfill(4)
            acquired = datetime.strptime(
                f"{f['acq_date']} {acq_time}", "%Y-%m-%d %H%M"
            ).replace(tzinfo=dt_timezone.utc)
        except ValueError:
            kept.append(f)  # can't parse timestamp, don't drop it
            continue
        if acquired >= cutoff:
            kept.append(f)
    return kept


# ---------------------------------------------------------------------------
# Shared core used by both views
# ---------------------------------------------------------------------------
def collect_fires(bbox_str, time_range, start_date=None, end_date=None):
    """Returns (fires, failed_sources, all_failed). Raises ValueError on bad input."""
    token = settings.FIRMS_API_TOKEN
    today = utc_today()

    # Custom date range
    if start_date and end_date:
        start = parse_date(start_date)
        end = parse_date(end_date)
        if start > end:
            start, end = end, start
        end = min(end, today)  # nothing exists in the future
        if start > end:
            return [], [], False
        if (end - start).days + 1 > MAX_SPAN_DAYS:
            raise ValueError(f"Date range too large. Maximum is {MAX_SPAN_DAYS} days.")
        return fetch_firms_for_date_range(token, bbox_str, start.isoformat(), end.isoformat())

    # Preset time ranges
    if time_range == '7days':
        seven_days_ago = today - timedelta(days=6)
        return fetch_firms_for_date_range(
            token, bbox_str, seven_days_ago.isoformat(), today.isoformat()
        )

    if time_range == '24hrs':
        day_range = 2
    else:
        # 'today' and any unknown value
        day_range = 1

    jobs = [(src, bbox_str, day_range, None) for src in NRT_SOURCES]
    fires, failed, all_failed = _run_jobs(token, jobs)

    if time_range == '24hrs':
        fires = filter_last_24h(fires)

    return fires, failed, all_failed


def get_results(bbox_str, time_range, start_date, end_date):
    """Cached wrapper around collect_fires. Both endpoints share this cache."""
    raw_key = json.dumps([bbox_str, time_range, start_date, end_date], sort_keys=True)
    cache_key = "firms:" + hashlib.md5(raw_key.encode()).hexdigest()

    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    all_fires, failed, all_failed = collect_fires(bbox_str, time_range, start_date, end_date)
    unique_fires = deduplicate_fires(all_fires)

    result = {
        "fires": unique_fires,
        "total_detections": len(all_fires),
        "failed_sources": failed,
        "all_failed": all_failed,
    }

    # Don't cache partial/failed results, so the next request retries.
    if not failed:
        cache.set(cache_key, result, CACHE_SECONDS)

    return result


def _read_params(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body or b"{}")
        except json.JSONDecodeError:
            raise ValueError("Invalid JSON body.")
        if not isinstance(data, dict):
            raise ValueError("Invalid JSON body.")
    else:
        data = request.GET
    return (
        data.get('bbox'),
        data.get('time_range', 'today'),
        data.get('start_date'),
        data.get('end_date'),
    )


def _handle_request(request, include_fires, missing_bbox_msg):
    bbox, time_range, start_date, end_date = _read_params(request)

    if not bbox:
        return JsonResponse({"success": False, "error": missing_bbox_msg}, status=400)

    w, s, e, n = validate_and_normalize_bbox(bbox)
    bbox_str = f"{w},{s},{e},{n}"

    result = get_results(bbox_str, time_range, start_date, end_date)

    if result["all_failed"]:
        return JsonResponse({
            "success": False,
            "error": "FIRMS service unavailable. Please try again shortly.",
            "failed_sources": result["failed_sources"],
        }, status=502)

    unique_fires = result["fires"]
    is_custom = bool(start_date and end_date)

    payload = {
        "success": True,
        "fire_count": len(unique_fires),
    }
    if include_fires:
        payload["fires"] = unique_fires
    payload["bbox"] = bbox_str
    payload["time_range"] = "custom" if is_custom else time_range
    if is_custom:
        payload["start_date"] = start_date
        payload["end_date"] = end_date
    payload["total_detections"] = result["total_detections"]
    payload["unique_fires"] = len(unique_fires)
    # Additive field: lets the frontend warn about partial data. Safe to ignore.
    payload["failed_sources"] = result["failed_sources"]

    return JsonResponse(payload)


# ---------------------------------------------------------------------------
# Views (names, methods and response shapes unchanged)
# ---------------------------------------------------------------------------
@csrf_exempt
@require_http_methods(["POST"])
def get_firms_fire_data(request):
    try:
        return _handle_request(request, include_fires=True, missing_bbox_msg="Missing bbox")
    except ValueError as err:
        return JsonResponse({"success": False, "error": str(err)}, status=400)
    except Exception:
        return JsonResponse({"success": False, "error": "Internal server error"}, status=500)


@csrf_exempt
@require_http_methods(["GET", "POST"])
def get_firms_fire_count(request):
    try:
        return _handle_request(request, include_fires=False, missing_bbox_msg="Missing bbox parameter")
    except ValueError as err:
        return JsonResponse({"success": False, "error": str(err)}, status=400)
    except Exception:
        return JsonResponse({"success": False, "error": "Internal server error"}, status=500)