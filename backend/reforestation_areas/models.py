from django.db import models

# Create your models here.
class Reforestation_areas(models.Model):

    reforestation_area_id = models.BigAutoField(primary_key=True)
    name = models.CharField(max_length=100, unique=True)
    description = models.CharField(max_length=255)
    coordinate = models.JSONField()
    location = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)
