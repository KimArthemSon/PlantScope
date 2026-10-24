import json

import jwt
from django.conf import settings
from django.test import TestCase

from accounts.models import User
from reforestation_areas.models import Reforestation_areas
from sites.models import Sites, calculate_polygon_area_hectares

from .models import ProgressReport
from .views import parse_report_polygon

# ~100 m x ~100 m square near Ormoc (≈ 1 ha)
SQUARE = [[11.0000, 124.6000], [11.0000, 124.60092], [11.0009, 124.60092], [11.0009, 124.6000]]


class PolygonParsingTests(TestCase):
    def test_valid_polygon_and_area(self):
        coords, err = parse_report_polygon(json.dumps(SQUARE + [SQUARE[0]]))  # closing point is dropped
        self.assertIsNone(err)
        self.assertEqual(len(coords), 4)
        self.assertAlmostEqual(calculate_polygon_area_hectares(coords), 1.0, delta=0.05)

    def test_rejects_missing_or_short_polygons(self):
        self.assertIsNotNone(parse_report_polygon(None)[1])
        self.assertIsNotNone(parse_report_polygon(json.dumps(SQUARE[:2]))[1])
        self.assertIsNotNone(parse_report_polygon(json.dumps([[95, 124], [11, 124], [11, 125]]))[1])
        self.assertIsNotNone(parse_report_polygon("not json")[1])


class TwoStepReviewTests(TestCase):
    def setUp(self):
        self.dm = User.objects.create(email="dm@test.ph", password="x", user_role="DataManager")
        self.gis = User.objects.create(email="gis@test.ph", password="x", user_role="GISSpecialist")
        self.inspector = User.objects.create(email="oi@test.ph", password="x", user_role="OnsiteInspector")
        area = Reforestation_areas.objects.create(name="Test Area")
        self.site = Sites.objects.create(reforestation_area=area, name="Site A", polygon_coordinates=SQUARE)

    def _report(self, **kwargs):
        defaults = dict(
            site=self.site, visit_type="inactive_check", status="pending", submitted_by=self.inspector,
            polygon_coordinates=SQUARE, planted_area_hectares=calculate_polygon_area_hectares(SQUARE),
        )
        defaults.update(kwargs)
        return ProgressReport.objects.create(**defaults)

    def _review(self, user, report, action, notes=""):
        token = jwt.encode({"user_id": user.id}, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
        return self.client.put(
            f"/api/review_progress_report/{report.progress_report_id}/",
            data=json.dumps({"action": action, "notes": notes}),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )

    def test_both_steps_required_to_accept(self):
        report = self._report()

        # GIS can't go first
        self.assertEqual(self._review(self.gis, report, "approve").status_code, 400)

        self.assertEqual(self._review(self.dm, report, "approve").status_code, 200)
        report.refresh_from_db()
        self.assertEqual(report.status, "pending")
        self.assertEqual(report.review_stage, "gis_specialist")

        # DM can't approve twice
        self.assertEqual(self._review(self.dm, report, "approve").status_code, 400)

        self.assertEqual(self._review(self.gis, report, "approve").status_code, 200)
        report.refresh_from_db()
        self.assertEqual(report.status, "accepted")
        self.assertEqual(report.gis_reviewed_by, self.gis)

    def test_gis_request_changes_rejects_with_notes(self):
        report = self._report()
        self._review(self.dm, report, "approve")

        self.assertEqual(self._review(self.gis, report, "request_changes", "").status_code, 400)  # notes required
        res = self._review(self.gis, report, "request_changes", "Outline crosses the creek")
        self.assertEqual(res.status_code, 200)
        report.refresh_from_db()
        self.assertEqual(report.status, "rejected")
        self.assertEqual(report.gis_review_status, "changes_requested")
        self.assertEqual(report.gis_review_notes, "Outline crosses the creek")

    def test_dm_request_changes_skips_gis(self):
        report = self._report()
        self.assertEqual(self._review(self.dm, report, "request_changes", "Blurry photo").status_code, 200)
        report.refresh_from_db()
        self.assertEqual(report.status, "rejected")
        self.assertEqual(report.review_stage, "done")

    def test_legacy_report_without_polygon_accepts_after_dm(self):
        report = self._report(polygon_coordinates=None, planted_area_hectares=None)
        self._review(self.dm, report, "approve")
        report.refresh_from_db()
        self.assertEqual(report.status, "accepted")
        self.assertEqual(report.gis_review_status, "not_required")

    def test_site_details_report_planted_area(self):
        self._report(status="accepted", dm_review_status="approved", gis_review_status="approved")
        token = jwt.encode({"user_id": self.dm.id}, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
        res = self.client.get(f"/api/get_site_monitoring_details/{self.site.site_id}/", HTTP_AUTHORIZATION=f"Bearer {token}")
        self.assertEqual(res.status_code, 200)
        metrics = res.json()["metrics"]
        self.assertAlmostEqual(metrics["planted_area_hectares"], 1.0, delta=0.05)
        self.assertAlmostEqual(metrics["planted_area_percent"], 100, delta=1)

    def test_monitoring_list_review_status(self):
        report = self._report()
        token = jwt.encode({"user_id": self.dm.id}, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
        auth = {"HTTP_AUTHORIZATION": f"Bearer {token}"}

        data = self.client.get("/api/get_monitoring_sites/", {"review_status": "data_manager"}, **auth).json()
        self.assertEqual([s["review_status"] for s in data["data"]], ["data_manager"])
        self.assertEqual(data["to_review_count"], 1)

        self._review(self.dm, report, "approve")
        data = self.client.get("/api/get_monitoring_sites/", **auth).json()
        self.assertEqual(data["data"][0]["review_status"], "gis_specialist")
        self.assertEqual(data["to_review_count"], 0)

        self._review(self.gis, report, "request_changes", "Fix corner 2")
        data = self.client.get("/api/get_monitoring_sites/", {"review_status": "changes_requested"}, **auth).json()
        self.assertEqual(data["data"][0]["review_status"], "changes_requested")

    def test_site_details_date_filter(self):
        from datetime import datetime
        from django.utils import timezone

        old = self._report(status="accepted", dm_review_status="approved", gis_review_status="approved")
        ProgressReport.objects.filter(pk=old.pk).update(submitted_at=timezone.make_aware(datetime(2026, 1, 10)))
        token = jwt.encode({"user_id": self.dm.id}, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
        url = f"/api/get_site_monitoring_details/{self.site.site_id}/"
        auth = {"HTTP_AUTHORIZATION": f"Bearer {token}"}

        # Report is outside the range → not listed, but planted area "as of" date_to still counts it
        data = self.client.get(url, {"date_from": "2026-06-01", "date_to": "2026-12-31"}, **auth).json()
        self.assertEqual(data["progress_reports"], [])
        self.assertIsNotNone(data["metrics"]["planted_area_hectares"])

        # End date before the report → no area yet
        data = self.client.get(url, {"date_to": "2025-12-31"}, **auth).json()
        self.assertIsNone(data["metrics"]["planted_area_hectares"])

        self.assertEqual(self.client.get(url, {"date_from": "bad"}, **auth).status_code, 400)
