from django.test import TestCase, Client
from django.urls import reverse
from .models import LandClassification, Polygon
import json

class LandClassificationAPITest(TestCase):
    def setUp(self):
        self.client = Client()
        # Create initial LandClassification
        self.land_classification = LandClassification.objects.create(
            name="Agricultural Land",
            description="Land suitable for farming"
        )

    def test_get_land_classifications(self):
        response = self.client.get(reverse('get_land_classifications'))
        self.assertEqual(response.status_code, 200)
        self.assertTrue('data' in response.json())

    def test_get_single_land_classification(self):
        response = self.client.get(reverse('get_land_classification', args=[self.land_classification.land_classification_id]))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['data']['name'], "Agricultural Land")

    def test_create_land_classification(self):
        payload = {
            "name": "Forest Land",
            "description": "Dense forest areas"
        }
        response = self.client.post(
            reverse('create_land_classification'),
            data=json.dumps(payload),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue('data' in response.json())

    def test_update_land_classification(self):
        payload = {
            "name": "Updated Land",
            "description": "Updated description"
        }
        response = self.client.put(
            reverse('update_land_classification', args=[self.land_classification.land_classification_id]),
            data=json.dumps(payload),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        self.land_classification.refresh_from_db()
        self.assertEqual(self.land_classification.name, "Updated Land")

    def test_delete_land_classification(self):
        response = self.client.delete(
            reverse('delete_land_classification', args=[self.land_classification.land_classification_id])
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(LandClassification.objects.filter(pk=self.land_classification.land_classification_id).exists())


# ------------------- Polygon Tests -------------------

class PolygonAPITest(TestCase):
    def setUp(self):
        self.client = Client()
        self.land_classification = LandClassification.objects.create(
            name="Agricultural Land",
            description="Land suitable for farming"
        )
        self.polygon = Polygon.objects.create(
            name="Farm Plot A",
            land_classification=self.land_classification,
            polygon={
                "type": "Polygon",
                "coordinates": [
                    [
                        [124.5641, 11.0123],
                        [124.5650, 11.0123],
                        [124.5650, 11.0130],
                        [124.5641, 11.0130],
                        [124.5641, 11.0123]
                    ]
                ]
            },
            description="Rice field"
        )

    def test_get_polygons(self):
        response = self.client.get(reverse('get_polygons'))
        self.assertEqual(response.status_code, 200)
        self.assertTrue('data' in response.json())

    def test_get_single_polygon(self):
        response = self.client.get(reverse('get_polygon', args=[self.polygon.polygon_id]))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['data']['name'], "Farm Plot A")

    def test_create_polygon(self):
        payload = {
            "name": "Orchard Plot B",
            "land_classification_id": self.land_classification.land_classification_id,
            "polygon": {
                "type": "Polygon",
                "coordinates": [
                    [
                        [124.5660, 11.0140],
                        [124.5670, 11.0140],
                        [124.5670, 11.0150],
                        [124.5660, 11.0150],
                        [124.5660, 11.0140]
                    ]
                ]
            },
            "description": "Mango orchard"
        }
        response = self.client.post(
            reverse('create_polygon'),
            data=json.dumps(payload),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue('data' in response.json())

    def test_update_polygon(self):
        payload = {
            "name": "Updated Polygon",
            "land_classification_id": self.land_classification.land_classification_id,
            "polygon": {
                "type": "Polygon",
                "coordinates": [
                    [
                        [124.5680, 11.0160],
                        [124.5690, 11.0160],
                        [124.5690, 11.0170],
                        [124.5680, 11.0170],
                        [124.5680, 11.0160]
                    ]
                ]
            },
            "description": "Updated description"
        }
        response = self.client.put(
            reverse('update_polygon', args=[self.polygon.polygon_id]),
            data=json.dumps(payload),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        self.polygon.refresh_from_db()
        self.assertEqual(self.polygon.name, "Updated Polygon")

    def test_delete_polygon(self):
        response = self.client.delete(
            reverse('delete_polygon', args=[self.polygon.polygon_id])
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(Polygon.objects.filter(pk=self.polygon.polygon_id).exists())
