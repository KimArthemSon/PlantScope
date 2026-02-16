from django.db import models

# Create your models here.
class Sites(models.Model):
    site_id = models.BigAutoField(primary_key=True)
    reforestation_area_id = models.CharField(max_length=50)
    status = models.CharField(max_length=50)
    area_img = models.CharField(max_length=50)
    coordinates =  models.JSONField()
    polygon_coordinates =  models.JSONField()
    total_area_planted = models.FloatField()
    total_seedling_planted = models.IntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

class Site_data(models.Model):
    site_data_id = models.BigAutoField(primary_key=True)

    soil_quality = models.CharField(max_length=100)
    ndvi = models.CharField(max_length=100)
    erosion_risk = models.CharField(max_length=50)
    distance_to_water_source =  models.CharField(max_length=100)
    accessibility = models.CharField(max_length=100)
    Wildlife_satatus = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)

class Site_details(models.Model):
    site_detail_id = models.BigAutoField(primary_key=True)
    
    soild_id = models.CharField(max_length=50)
    tree_specie_id = models.CharField(max_length=50)
    created_at = models.DateTimeField(auto_now_add=True)
