from django.db import models
from barangay.models import Barangay  # Adjust import path if needed

class HazardArea(models.Model):
    # Fixed hazard types for Philippine context (Ormoc City)
    HAZARD_TYPES = [
        ('LANDSLIDE', 'Landslide'),
        ('FLOOD', 'Flood'),
        ('EARTHQUAKE', 'Earthquake'),
        ('VOLCANIC', 'Volcanic Hazard'),
        ('STORM_SURGE', 'Storm Surge'),
        ('OTHER', 'Other'),
    ]

    hazard_area_id = models.BigAutoField(primary_key=True)
    name = models.CharField(max_length=100, unique=True)
    hazard_type = models.CharField(max_length=20, choices=HAZARD_TYPES, default='LANDSLIDE')
    
    barangay = models.ForeignKey(
        Barangay,
        on_delete=models.RESTRICT,
        null=True,
        blank=True,
        related_name="hazard_areas"
    )
    
    # Expects valid GeoJSON geometry (Polygon/MultiPolygon)
    polygon = models.JSONField()
    description = models.CharField(max_length=255, blank=True, default="")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "hazard_areas"
        verbose_name = "Hazard Area"
        verbose_name_plural = "Hazard Areas"
        ordering = ["hazard_type", "name"]

    def __str__(self):
        return f"{self.name} ({self.get_hazard_type_display()})"