from django.db import models
from barangay.models import Barangay

# Create your models here.

class Reforestation_areas(models.Model):

    Safety_types = (
        ('safe', 'Low Risk'),
        ('slightly', 'Slightly Unsafe'),
        ('moderate', 'Moderate Risk'),
        ('danger', 'High Risk'),
    )
    legality_status = (
        ('pending', 'Pending'),
        ('legal', 'Legal'),
        ('illegal', 'Illegal'),
    )
    
    barangay = models.ForeignKey(
        Barangay,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='reforestation_areas'
    )
    reforestation_area_id = models.BigAutoField(primary_key=True)
    name = models.CharField(max_length=100, unique=True)

    safety = models.CharField(
        max_length=20,
        choices=Safety_types,
        default='danger'
    )
    
    legality = models.CharField(
        max_length=20,
        choices=legality_status,
        default='pending'
    )

    polygon_coordinate = models.JSONField(null=True)
    coordinate = models.JSONField(null=True)
    
    description = models.CharField(max_length=255)

    area_img = models.ImageField(
        upload_to='areas/',
        blank=True,
        null=True
    )

    created_at = models.DateTimeField(auto_now_add=True)


class Potential_sites(models.Model):

    potential_sites_id = models.BigAutoField(primary_key=True)

    reforestation_area = models.ForeignKey(
        Reforestation_areas,
        on_delete=models.CASCADE,
        related_name='potential_sites'
    )

    polygon_coordinates = models.JSONField(null=True)