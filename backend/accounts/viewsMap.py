import ee
from django.http import JsonResponse
from django.conf import settings

# Initialize Earth Engine ONCE when the module loads (not per request)
# This assumes you've run ee.Authenticate() locally already
# try:
#     # 🔑 Replace 'plant-scope-ee' with your actual Google Cloud Project ID
#     ee.Initialize(project='plant-scope-ee')
# except Exception as e:
#     # Only for local dev: if not authenticated, guide user
#     raise RuntimeError(
#         "Earth Engine failed to initialize. "
#         "Run this in terminal: python -c \"import ee; ee.Authenticate()\""
#     ) from e


def ndvi_canopy(request):
    

    start = request.GET.get("start")
    end = request.GET.get("end")

    if not start or not end:
        return JsonResponse({"error": "Missing start or end date"}, status=400)

    # Ormoc City ROI
    roi = ee.Geometry.Rectangle([124.43, 11.00, 124.65, 11.15])

    def mask_s2(image):
        qa = image.select("QA60")
        cloud_bit_mask = 1 << 10
        cirrus_bit_mask = 1 << 11
        mask = qa.bitwiseAnd(cloud_bit_mask).eq(0).And(
            qa.bitwiseAnd(cirrus_bit_mask).eq(0)
        )
        return image.updateMask(mask).divide(10000)

    s2 = (
        ee.ImageCollection("COPERNICUS/S2_SR")
        .filterBounds(roi)
        .filterDate(start, end)
        .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 20))
        .map(mask_s2)
        .median()
    )

    # Handle case where no images are found
    if s2.bandNames().getInfo() == []:
        return JsonResponse({"error": "No Sentinel-2 imagery found for the given date range and region."}, status=404)

    ndvi = s2.normalizedDifference(["B8", "B4"]).rename("NDVI")

    canopy = ndvi.expression(
        "(ndvi >= 0.6) ? 3"
        ": (ndvi >= 0.4) ? 2"
        ": (ndvi >= 0.2) ? 1"
        ": 0",
        {"ndvi": ndvi},
    ).rename("canopy")

    vis = {
        "min": 0,
        "max": 3,
        "palette": ["#cccccc", "#f1c40f", "#e67e22", "#27ae60"],
    }

    map_id = canopy.getMapId(vis)

    return JsonResponse({
        "tile_url": map_id["tile_fetcher"].url_format
    })

from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
import json

@csrf_exempt
def suitable_sites(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST only"}, status=405)

    try:
        data = json.loads(request.body)
        start = data.get("start")
        end = data.get("end")
        geom = data.get("geometry")

        if not all([start, end, geom]):
            return JsonResponse({"error": "Missing parameters"}, status=400)

        # Parse user-drawn geometry
        roi = ee.Geometry(geom)

        def mask_s2(image):
            qa = image.select("QA60")
            cloud = qa.bitwiseAnd(1 << 10).eq(0).And(qa.bitwiseAnd(1 << 11).eq(0))
            return image.updateMask(cloud).divide(10000)

        s2 = (
            ee.ImageCollection("COPERNICUS/S2_SR")
            .filterBounds(roi)
            .filterDate(start, end)
            .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 20))
            .map(mask_s2)
            .median()
        )

        if s2.bandNames().getInfo() == []:
            return JsonResponse({"error": "No imagery available"}, status=404)

        ndvi = s2.normalizedDifference(["B8", "B4"])
        # Suitable = NDVI < 0.4 → Classes 0 and 1
        suitable = ndvi.lt(0.4).selfMask()

        # Vectorize suitable areas
        vectors = suitable.reduceToVectors(
            geometry=roi,
            scale=10,  # Sentinel-2 resolution
            maxPixels=1e9,
            geometryType="polygon",
            eightConnected=False,
        )

        # Convert to GeoJSON
        geojson = vectors.getInfo()
        return JsonResponse({"polygons": geojson})

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)