from django.db import models
from accounts.models import User
from reforestation_areas.models import Reforestation_areas
# Create your models here.
class Assigned_onsite_inspector(models.Model):
    assigned_onsite_inspector_id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='assigned_onsite_inspector'
    )
    reforestation_area = models.ForeignKey(
        Reforestation_areas,
        on_delete=models.CASCADE,
        related_name='assigned_onsite_inspector'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'reforestation_area'],
                name='unique_user_reforestation_assignment'
            )
        ]

class Field_assessment(models.Model):
    field_assessment_id = models.BigAutoField(primary_key=True)

    #fk
    site_id = models.CharField(max_length=255)
    assigned_onsite_inspector_id = models.CharField(max_length=255)

    #info
    tile = models.CharField(max_length=255)
    legality = models.CharField(max_length=15)
    safety = models.CharField(max_length=50)
    location = models.CharField(max_length=100)
    coordinates =  models.JSONField()
    polygon_coordinates =  models.JSONField()
    description = models.CharField(max_length=255)
    
    #content
    soil_quality = models.CharField(max_length=100)
    ndvi = models.CharField(max_length=100)
    distance_to_water_source =  models.CharField(max_length=100)
    accessibility = models.CharField(max_length=100)
    Wildlife_satatus = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)

class Field_assessment_details(models.Model):
    field_assessment_detail_id = models.BigAutoField(primary_key=True)

    field_assessment_id = models.CharField(max_length=50)
    soild_id = models.CharField(max_length=50)
    tree_specie_id = models.CharField(max_length=50)
    created_at = models.DateTimeField(auto_now_add=True)
   

