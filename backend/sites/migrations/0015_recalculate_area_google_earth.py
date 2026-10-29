"""
Recalculate stored site and potential-site areas with the Google Earth formula
(geodesic area on a sphere, R = 6,378,137 m). Older rows were saved with a flat
approximation (sites) or Earth Engine's own area (potential sites).

The formula is copied here on purpose so this migration never changes if the
app code changes later.
"""
import math

from django.db import migrations

EARTH_RADIUS = 6378137.0


def _ring_area_sqm(latlng_ring):
    coords = [(float(p[0]), float(p[1])) for p in latlng_ring]
    if len(coords) > 3 and coords[0] == coords[-1]:
        coords = coords[:-1]
    n = len(coords)
    if n < 3:
        return 0.0
    total = 0.0
    for i in range(n):
        lat1, lng1 = coords[i]
        lat2, lng2 = coords[(i + 1) % n]
        total += math.radians(lng2 - lng1) * (2 + math.sin(math.radians(lat1)) + math.sin(math.radians(lat2)))
    return abs(total * EARTH_RADIUS * EARTH_RADIUS / 2.0)


def latlng_list_hectares(points):
    """[lat, lng] list (swapped automatically if stored as [lng, lat])."""
    if not isinstance(points, list) or len(points) < 3:
        return None
    try:
        coords = [(float(p[0]), float(p[1])) for p in points]
    except (IndexError, TypeError, ValueError):
        return None
    a, b = coords[0]
    if abs(a) <= 90 and abs(b) <= 180:
        pass
    elif abs(a) <= 180 and abs(b) <= 90:
        coords = [(y, x) for x, y in coords]
    else:
        return None
    return round(_ring_area_sqm(coords) / 10000, 4)


def geojson_hectares(geometry):
    """GeoJSON Polygon / MultiPolygon in [lng, lat] order; holes subtracted."""
    if isinstance(geometry, list):
        return latlng_list_hectares(geometry)
    if not isinstance(geometry, dict):
        return None
    if geometry.get('type') == 'Feature':
        geometry = geometry.get('geometry') or {}
    gtype, coords = geometry.get('type'), geometry.get('coordinates') or []
    if gtype == 'Polygon':
        polygons = [coords]
    elif gtype == 'MultiPolygon':
        polygons = coords
    else:
        return None
    try:
        sqm = 0.0
        for rings in polygons:
            for idx, ring in enumerate(rings or []):
                ring_area = _ring_area_sqm([(p[1], p[0]) for p in ring])
                sqm += ring_area if idx == 0 else -ring_area
    except (IndexError, TypeError, ValueError):
        return None
    return round(max(sqm, 0.0) / 10000, 4)


def recalculate(apps, schema_editor):
    Sites = apps.get_model('sites', 'Sites')
    Potential_sites = apps.get_model('sites', 'Potential_sites')

    for site in Sites.objects.exclude(polygon_coordinates__isnull=True).only('site_id', 'polygon_coordinates', 'total_area_hectares'):
        ha = latlng_list_hectares(site.polygon_coordinates)
        if ha is not None and ha != site.total_area_hectares:
            # .update() skips Sites.save(), so nothing else on the row changes
            Sites.objects.filter(pk=site.pk).update(total_area_hectares=ha)

    for ps in Potential_sites.objects.exclude(polygon_coordinates__isnull=True).only('potential_sites_id', 'polygon_coordinates', 'area_hectares'):
        ha = geojson_hectares(ps.polygon_coordinates)
        if ha and ha != ps.area_hectares:
            Potential_sites.objects.filter(pk=ps.pk).update(area_hectares=ha)


class Migration(migrations.Migration):

    dependencies = [
        ('sites', '0014_repair_finished_site_status'),
    ]

    operations = [
        # Old values can't be restored, so reversing just leaves the new ones
        migrations.RunPython(recalculate, migrations.RunPython.noop),
    ]
