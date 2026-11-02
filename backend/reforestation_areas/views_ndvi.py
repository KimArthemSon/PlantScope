import json
import logging
from datetime import datetime, timedelta

import ee
from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

# Import local models/helpers
from ormoc_city.models import Ormoc_City
from sites.models import geojson_area_hectares
from . import gee_helpers  # noqa: F401  (kept from the original file)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration (tune these without touching the logic below)
# ---------------------------------------------------------------------------
S2_COLLECTION = "COPERNICUS/S2_SR_HARMONIZED"
CLOUD_SCORE_COLLECTION = "GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED"
WORLDCOVER_COLLECTION = "ESA/WorldCover/v200"  # verify the ID in the EE catalog

# Scene-level filter is deliberately loose: the real cloud removal is done
# per pixel with Cloud Score+. A strict value (e.g. 20) often returns nothing
# in cloudy tropical areas.
SCENE_CLOUD_MAX = 80
# Cloud Score+ cs_cdf threshold. 0.50-0.65 generally works well; higher
# values remove thin cloud and haze more aggressively.
CLEAR_THRESHOLD = 0.60

# If no imagery is found, retry with the start date moved earlier by these
# many days (0 = the exact range the user asked for).
WINDOW_EXPANSIONS_DAYS = (0, 60, 120)

# Reforestation candidate rules
SITE_NDVI_MIN = 0.10   # excludes bare surfaces / roads / buildings / water
SITE_NDVI_MAX = 0.41   # empirical threshold for degraded tropical land
MIN_PATCH_PIXELS = 50  # 50 px * 100 m2 = 0.5 ha minimum patch size
MAX_SITES = 500        # cap on polygons returned (largest are kept)
USE_WORLDCOVER = True
# ESA WorldCover classes allowed as candidates: 20 shrub, 30 grass, 60 bare/sparse
SUITABLE_LANDCOVER = (20, 30, 60)

# Request limits (protect your Earth Engine quota)
MAX_AREA_HA = 100_000
MAX_TREND_STEPS = 60
TREND_SCALE = 30  # metres; a regional mean does not need 10 m

DATE_FMT = "%Y-%m-%d"


# ---------------------------------------------------------------------------
# Small helpers
# ---------------------------------------------------------------------------
def _fmt(d):
    return d.strftime(DATE_FMT)


def _auth_error(request):
    """Optional gate. Set GEE_REQUIRE_AUTH = True in Django settings to enable."""
    if getattr(settings, "GEE_REQUIRE_AUTH", False):
        user = getattr(request, "user", None)
        if user is None or not user.is_authenticated:
            return JsonResponse({"error": "Authentication required"}, status=401)
    return None


def _parse_dates(start, end):
    """Return (start_dt, end_dt_exclusive). The end date is made inclusive,
    because ee filterDate() treats the end as exclusive."""
    try:
        start_dt = datetime.strptime(start, DATE_FMT)
        end_dt = datetime.strptime(end, DATE_FMT)
    except (TypeError, ValueError):
        raise ValueError("Dates must use the YYYY-MM-DD format") from None
    if end_dt < start_dt:
        raise ValueError("End date must not be before start date")
    return start_dt, end_dt + timedelta(days=1)


def _read_json(request):
    try:
        data = json.loads(request.body or b"{}")
    except json.JSONDecodeError:
        raise ValueError("Request body must be valid JSON") from None
    if not isinstance(data, dict):
        raise ValueError("Request body must be a JSON object")
    return data


def _parse_geometry(geojson):
    """Validate user geometry and enforce the area cap."""
    if isinstance(geojson, dict) and geojson.get("type") == "Feature":
        geojson = geojson.get("geometry")
    if not isinstance(geojson, dict) or geojson.get("type") not in ("Polygon", "MultiPolygon"):
        raise ValueError("geometry must be a GeoJSON Polygon or MultiPolygon")
    roi = ee.Geometry(geojson)
    area_ha = roi.area(10).getInfo() / 10000.0
    if area_ha > MAX_AREA_HA:
        raise ValueError(
            f"Area is too large ({area_ha:,.0f} ha). Maximum allowed is {MAX_AREA_HA:,} ha."
        )
    return roi


def _ndvi(image):
    return image.normalizedDifference(["B8", "B4"]).rename("NDVI")


# ---------------------------------------------------------------------------
# Sentinel-2 compositing
# ---------------------------------------------------------------------------
def get_masked_collection(roi, start_date, end_date,
                          cloud_threshold=SCENE_CLOUD_MAX, clear=CLEAR_THRESHOLD):
    """Sentinel-2 SR collection with per-pixel masking.

    Pixels are kept only if Cloud Score+ says they are clear AND the scene
    classification (SCL) says they are not water. Only B4 and B8 are kept,
    which is all NDVI needs. (No /10000 scaling: NDVI is a ratio, so the
    scale factor cancels out.)
    """
    s2 = (
        ee.ImageCollection(S2_COLLECTION)
        .filterBounds(roi)
        .filterDate(start_date, end_date)
        .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", cloud_threshold))
    )
    cs = (
        ee.ImageCollection(CLOUD_SCORE_COLLECTION)
        .filterBounds(roi)
        .filterDate(start_date, end_date)
    )

    def _mask(img):
        clear_px = img.select("cs_cdf").gte(clear)
        not_water = img.select("SCL").neq(6)
        return img.select(["B4", "B8"]).updateMask(clear_px.And(not_water))

    return s2.linkCollection(cs, ["cs_cdf"]).map(_mask)


def get_sentinel2_median(roi, start_date, end_date, cloud_threshold=SCENE_CLOUD_MAX):
    """Median composite, or None if no scenes match the filters."""
    collection = get_masked_collection(roi, start_date, end_date, cloud_threshold)

    # Prevents the "No band named 'B8'" error that median() of an empty
    # collection causes later on.
    if collection.size().getInfo() == 0:
        return None
    return collection.median()


def get_composite_with_fallback(roi, start_dt, end_dt):
    """Try the requested window first, then widen the start date backwards.

    Returns (image | None, start_dt_used, was_expanded)."""
    for extra_days in WINDOW_EXPANSIONS_DAYS:
        window_start = start_dt - timedelta(days=extra_days)
        image = get_sentinel2_median(roi, _fmt(window_start), _fmt(end_dt))
        if image is not None:
            return image, window_start, extra_days > 0
    return None, start_dt, False


def classify_canopy(ndvi_image):
    """Classify NDVI into canopy classes"""
    return ndvi_image.expression(
        "(ndvi >= 0.6) ? 3 : (ndvi >= 0.4) ? 2 : (ndvi >= 0.2) ? 1 : 0",
        {"ndvi": ndvi_image},
    ).rename("canopy")


# ---------------------------------------------------------------------------
# Views
# ---------------------------------------------------------------------------
@csrf_exempt
def ndvi_canopy(request):
    """GET /api/ndvi/?start=YYYY-MM-DD&end=YYYY-MM-DD"""
    if request.method != "GET":
        return JsonResponse({"error": "Use GET"}, status=405)

    denied = _auth_error(request)
    if denied:
        return denied

    start = request.GET.get("start")
    end = request.GET.get("end")

    if not start or not end:
        return JsonResponse({"error": "Missing start/end dates"}, status=400)

    try:
        start_dt, end_dt = _parse_dates(start, end)

        ormoc = Ormoc_City.objects.first()
        if not ormoc:
            return JsonResponse({"error": "Ormoc City config not found"}, status=500)

        poly_coords = [[c[1], c[0]] for c in ormoc.polygon]
        roi = ee.Geometry.Polygon(poly_coords)

        s2, used_start, expanded = get_composite_with_fallback(roi, start_dt, end_dt)

        if s2 is None:
            return JsonResponse(
                {
                    "error": (
                        f"No usable Sentinel-2 imagery found between {start} and {end}, "
                        f"even after widening the start date by up to "
                        f"{max(WINDOW_EXPANSIONS_DAYS)} days. "
                        "Try a later end date or a longer date range."
                    )
                },
                status=404,
            )

        ndvi = _ndvi(s2)
        canopy = classify_canopy(ndvi)
        canopy_clipped = canopy.clip(roi)

        map_id = canopy_clipped.getMapId({
            "min": 0,
            "max": 3,
            "palette": ["#cccccc", "#f1c40f", "#e67e22", "#27ae60"],
        })

        return JsonResponse({
            "tile_url": map_id["tile_fetcher"].url_format,
            "date_range": f"{start} to {end}",
            "date_range_used": f"{_fmt(used_start)} to {end}",
            "window_expanded": expanded,
            "bounds": roi.getInfo()["coordinates"],
        })
    except ValueError as e:
        return JsonResponse({"error": str(e)}, status=400)
    except Exception:
        logger.exception("NDVI map failed")
        return JsonResponse({"error": "Map generation failed"}, status=500)


@csrf_exempt
def suitable_sites(request):
    """POST /api/suitable-sites/ - Find low-NDVI areas for reforestation"""
    if request.method != "POST":
        return JsonResponse({"error": "Use POST"}, status=405)

    denied = _auth_error(request)
    if denied:
        return denied

    try:
        data = _read_json(request)
        if "geometry" not in data or "start" not in data or "end" not in data:
            raise ValueError("geometry, start and end are required")

        start_dt, end_dt = _parse_dates(data["start"], data["end"])
        roi = _parse_geometry(data["geometry"])

        s2, used_start, expanded = get_composite_with_fallback(roi, start_dt, end_dt)

        if s2 is None:
            return JsonResponse(
                {"error": "No usable imagery found for the selected date range. "
                          "Try a longer range."},
                status=404,
            )

        ndvi = _ndvi(s2)

        # Candidate = low (but not bare/negative) NDVI ...
        candidate = ndvi.gte(SITE_NDVI_MIN).And(ndvi.lt(SITE_NDVI_MAX))

        # ... on land cover that can actually be planted (not roads, buildings,
        # water, existing forest). WorldCover is a 2021 map, so recent land
        # changes may be misclassified.
        if USE_WORLDCOVER:
            wc = ee.ImageCollection(WORLDCOVER_COLLECTION).first().select("Map")
            allowed = ee.Image(0)
            for cls in SUITABLE_LANDCOVER:
                allowed = allowed.Or(wc.eq(cls))
            candidate = candidate.And(allowed)

        suitable = candidate.selfMask()

        # Drop tiny specks: keep only patches of at least MIN_PATCH_PIXELS.
        connected = suitable.connectedPixelCount(maxSize=128, eightConnected=True)
        suitable = suitable.updateMask(connected.gte(MIN_PATCH_PIXELS)).rename("suitable")

        # Native 10 m resolution of Sentinel-2 B4 and B8.
        vectors = suitable.reduceToVectors(
            geometry=roi,
            scale=10,
            maxPixels=1e10,
            geometryType="polygon",
            labelProperty="site_id",
            tileScale=4,
        )

        def _with_area(f):
            f = ee.Feature(f)
            return f.set("area_m2", f.geometry().area(1))

        # Keep the largest polygons; fetch one extra to detect truncation.
        vectors = vectors.map(_with_area).sort("area_m2", False).limit(MAX_SITES + 1)

        # One server-side call for all polygons (instead of one getInfo each).
        stats = ndvi.reduceRegions(
            collection=vectors,
            reducer=ee.Reducer.mean(),
            scale=10,
            tileScale=4,
        )
        features = stats.getInfo().get("features", [])

        truncated = len(features) > MAX_SITES
        features = features[:MAX_SITES]

        span = SITE_NDVI_MAX - SITE_NDVI_MIN
        for i, feat in enumerate(features):
            props = feat.setdefault("properties", {})

            # Single-band reduceRegions names the output after the reducer ("mean").
            ndvi_val = props.pop("mean", props.get("NDVI"))
            avg_ndvi = round(ndvi_val, 3) if ndvi_val is not None else 0.0

            props.pop("area_m2", None)
            props.pop("count", None)

            # Same Google Earth formula used when sites/potential sites are saved
            area_ha = geojson_area_hectares(feat.get("geometry"))

            # Restoration priority: the lower the NDVI within the candidate
            # range, the more degraded the land, so the higher the score (0-100).
            if ndvi_val is not None:
                score = (SITE_NDVI_MAX - avg_ndvi) / span * 100
                score = round(max(0.0, min(100.0, score)), 1)
            else:
                score = 0.0

            props.update({
                "site_id": f"SITE-{str(i + 1).zfill(3)}",
                "area_hectares": area_ha,
                "avg_ndvi": avg_ndvi,
                "suitability_score": score,
            })

        return JsonResponse({
            "success": True,
            "type": "FeatureCollection",
            "features": features,
            "metadata": {
                "threshold": f"{SITE_NDVI_MIN} <= NDVI < {SITE_NDVI_MAX}",
                "description": (
                    "Low-vegetation, plantable land (shrub/grass/sparse) suitable for "
                    "reforestation. Empirical NDVI threshold for degraded tropical land."
                ),
                "land_cover_filter": list(SUITABLE_LANDCOVER) if USE_WORLDCOVER else None,
                "min_patch_hectares": MIN_PATCH_PIXELS * 100 / 10000,
                "resolution_meters": 10,
                "date_range_used": f"{_fmt(used_start)} to {data['end']}",
                "window_expanded": expanded,
                "truncated": truncated,
                "max_sites": MAX_SITES,
            },
        })
    except ValueError as e:
        return JsonResponse({"error": str(e)}, status=400)
    except Exception:
        logger.exception("Suitable sites error")
        return JsonResponse(
            {"error": "Analysis failed. Try a smaller area or a shorter date range."},
            status=500,
        )


def _month_periods(start_dt, end_dt):
    periods, current = [], start_dt
    while current < end_dt:
        nxt = datetime(current.year + (current.month == 12), current.month % 12 + 1, 1)
        periods.append((current, min(nxt, end_dt), current.strftime("%Y-%m")))
        current = nxt
    return periods


def _week_periods(start_dt, end_dt):
    periods, current = [], start_dt
    while current < end_dt:
        nxt = current + timedelta(days=7)
        periods.append((current, min(nxt, end_dt), current.strftime(DATE_FMT)))
        current = nxt
    return periods


def _fitted_change(values):
    """Total change along the least-squares line (less noisy than last - first)."""
    n = len(values)
    mean_x = (n - 1) / 2
    mean_y = sum(values) / n
    sxx = sum((x - mean_x) ** 2 for x in range(n))
    sxy = sum((x - mean_x) * (v - mean_y) for x, v in enumerate(values))
    return (sxy / sxx) * (n - 1) if sxx else 0.0


@csrf_exempt
def ndvi_trend(request):
    """POST /api/ndvi-trend/ - NDVI time series"""
    if request.method != "POST":
        return JsonResponse({"error": "Use POST"}, status=405)

    denied = _auth_error(request)
    if denied:
        return denied

    try:
        data = _read_json(request)
        if "geometry" not in data or "start" not in data or "end" not in data:
            raise ValueError("geometry, start and end are required")

        start_dt, end_dt = _parse_dates(data["start"], data["end"])
        roi = _parse_geometry(data["geometry"])
        interval = data.get("interval", "month")

        periods = (
            _month_periods(start_dt, end_dt) if interval == "month"
            else _week_periods(start_dt, end_dt)
        )
        if len(periods) > MAX_TREND_STEPS:
            raise ValueError(
                f"Date range too long for '{interval}' steps "
                f"(max {MAX_TREND_STEPS} periods). Use a shorter range."
            )

        # Build everything server-side and fetch with ONE getInfo() call,
        # instead of one round trip per time step.
        feats = []
        for p_start, p_end, label in periods:
            col = get_masked_collection(roi, _fmt(p_start), _fmt(p_end))
            ndvi = _ndvi(col.median())
            mean = ee.Algorithms.If(
                col.size().gt(0),
                ndvi.reduceRegion(
                    reducer=ee.Reducer.mean(),
                    geometry=roi,
                    scale=TREND_SCALE,
                    maxPixels=1e9,
                    tileScale=4,
                ).get("NDVI"),
                None,
            )
            feats.append(ee.Feature(None, {"date": label, "mean_ndvi": mean}))

        features = ee.FeatureCollection(feats).getInfo().get("features", [])

        # Periods with no clear imagery come back as None and are dropped;
        # the frontend chart must handle missing time steps gracefully.
        time_series = []
        for feat in features:
            props = feat.get("properties", {})
            val = props.get("mean_ndvi")
            if val is not None:
                time_series.append({"date": props.get("date"), "ndvi": round(val, 3)})

        if not time_series:
            return JsonResponse({
                "success": True,
                "data": {"dates": [], "values": [], "trend": "insufficient_data", "change": 0},
            })

        values = [t["ndvi"] for t in time_series]
        if len(values) >= 2:
            change = _fitted_change(values)
            trend = "declining" if change < -0.1 else "stable" if change < 0.1 else "increasing"
        else:
            change, trend = 0, "insufficient_data"

        return JsonResponse({
            "success": True,
            "data": {
                "dates": [t["date"] for t in time_series],
                "values": values,
                "trend": trend,
                "change": round(change, 3),
            },
        })
    except ValueError as e:
        return JsonResponse({"error": str(e)}, status=400)
    except Exception:
        logger.exception("NDVI trend error")
        return JsonResponse(
            {"error": "Trend analysis failed. Try a smaller area or a shorter date range."},
            status=500,
        )