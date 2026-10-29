from django.test import SimpleTestCase, TestCase

from .models import Sites, calculate_polygon_area_hectares, geojson_area_hectares

# ~1.1 km square near Ormoc, [lat, lng]
SQUARE = [[11.005, 124.605], [11.005, 124.615], [11.015, 124.615], [11.015, 124.605]]
# Same square as GeoJSON ([lng, lat], closed ring)
SQUARE_GEOJSON = {"type": "Polygon", "coordinates": [[[lng, lat] for lat, lng in SQUARE + [SQUARE[0]]]]}


class GoogleEarthAreaTests(SimpleTestCase):
    def test_matches_google_earth_formula(self):
        # Reference value from the spherical formula Google uses (R = 6,378,137 m)
        self.assertAlmostEqual(calculate_polygon_area_hectares(SQUARE), 121.6394, places=3)

    def test_closed_ring_and_lng_lat_order_give_same_area(self):
        expected = calculate_polygon_area_hectares(SQUARE)
        self.assertEqual(calculate_polygon_area_hectares(SQUARE + [SQUARE[0]]), expected)
        self.assertEqual(calculate_polygon_area_hectares([[lng, lat] for lat, lng in SQUARE]), expected)

    def test_geojson_polygon_matches_site_formula(self):
        self.assertEqual(geojson_area_hectares(SQUARE_GEOJSON), calculate_polygon_area_hectares(SQUARE))
        self.assertEqual(geojson_area_hectares({"type": "Feature", "geometry": SQUARE_GEOJSON}),
                         calculate_polygon_area_hectares(SQUARE))

    def test_geojson_multipolygon_and_holes(self):
        one = geojson_area_hectares(SQUARE_GEOJSON)
        multi = {"type": "MultiPolygon", "coordinates": [SQUARE_GEOJSON["coordinates"]] * 2}
        self.assertAlmostEqual(geojson_area_hectares(multi), one * 2, places=3)

        outer = SQUARE_GEOJSON["coordinates"][0]
        holed = {"type": "Polygon", "coordinates": [outer, outer]}  # hole as big as the outer ring
        self.assertEqual(geojson_area_hectares(holed), 0.0)

    def test_bad_input_returns_zero(self):
        self.assertEqual(geojson_area_hectares(None), 0.0)
        self.assertEqual(geojson_area_hectares({"type": "Point", "coordinates": [124.6, 11.0]}), 0.0)
        self.assertEqual(calculate_polygon_area_hectares([[1, 2]]), 0.0)


class CreateSiteTests(TestCase):
    def setUp(self):
        from reforestation_areas.models import Reforestation_areas
        from accounts.models import User
        self.area = Reforestation_areas.objects.create(name="Create Area")
        self.user = User.objects.create(email="head-create@test.ph", password="x", user_role="CityENROHead")

    def _post(self, **body):
        import json
        import jwt
        from django.conf import settings
        token = jwt.encode({"user_id": self.user.id}, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
        body = {"reforestation_area_id": self.area.reforestation_area_id, **body}
        return self.client.post("/api/sites/create_site/", data=json.dumps(body), content_type="application/json",
                                HTTP_AUTHORIZATION=f"Bearer {token}")

    def test_marker_only_site_is_allowed(self):
        res = self._post(name="Marker Only", marker_coordinate=[11.0064, 124.6075])
        self.assertEqual(res.status_code, 201)
        site = Sites.objects.get(site_id=res.json()["site_id"])
        self.assertIsNone(site.polygon_coordinates)
        self.assertEqual(site.marker_coordinate, [11.0064, 124.6075])

    def test_polygon_with_custom_center(self):
        res = self._post(name="With Polygon", polygon_coordinates=SQUARE, marker_coordinate=[11.006, 124.606])
        self.assertEqual(res.status_code, 201)
        site = Sites.objects.get(site_id=res.json()["site_id"])
        self.assertEqual(site.marker_coordinate, [11.006, 124.606])
        self.assertGreater(site.total_area_hectares, 0)

    def test_needs_center_or_polygon(self):
        self.assertEqual(self._post(name="Nothing").status_code, 400)
        self.assertEqual(self._post(name="Bad Poly", polygon_coordinates=SQUARE[:2]).status_code, 400)
        self.assertEqual(self._post(name="Bad Center", marker_coordinate=[200, 124]).status_code, 400)
