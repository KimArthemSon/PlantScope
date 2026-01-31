from django.db import models

class LandClassification(models.Model):
    land_classification_id = models.BigAutoField(primary_key=True)
    name = models.CharField(max_length=100)
    description = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

   
class Classified_areas(models.Model):
    classified_area_id = models.BigAutoField(primary_key=True)
    name = models.CharField(max_length=100)
    land_classification = models.ForeignKey(
        LandClassification,
        on_delete=models.CASCADE,
        related_name="classified_areas"
    )
    polygon = models.JSONField()
    description = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
