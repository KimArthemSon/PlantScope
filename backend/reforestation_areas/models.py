from django.db import models

# Create your models here.
class Reforestation_areas(models.Model):

    reforestation_area_id = models.BigAutoField(primary_key=True)
    name = models.CharField(max_length=100, unique=True)
    legality = models.CharField(max_length=15)
    safety = models.CharField(max_length=50)
    polygon_coordinate = models.JSONField()
    coordinate = models.JSONField()
    location = models.CharField(max_length=100)
    description = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

