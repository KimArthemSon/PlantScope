# models.py
from django.db import models
from barangay.models import Barangay

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
    safety = models.CharField(max_length=20, choices=Safety_types, default='danger')
    legality = models.CharField(max_length=20, choices=legality_status, default='pending')
    polygon_coordinate = models.JSONField(null=True, blank=True)
    coordinate = models.JSONField(null=True, blank=True)
    description = models.CharField(max_length=255)
    area_img = models.ImageField(upload_to='areas/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class Potential_sites(models.Model):
    potential_sites_id = models.BigAutoField(primary_key=True)
    
    reforestation_area = models.ForeignKey(
        Reforestation_areas,
        on_delete=models.CASCADE,
        related_name='potential_sites'
    )
    
    site_id = models.CharField(max_length=50, blank=True)
    
    # ✅ Keep nullable to avoid migration issues
    polygon_coordinates = models.JSONField(null=True, blank=True)
    
    area_hectares = models.FloatField(default=0)
    avg_ndvi = models.FloatField(default=0)
    suitability_score = models.FloatField(default=0)
    ndvi_threshold = models.FloatField(default=0.41)
    
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.site_id or f'Site-{self.potential_sites_id}'} - {self.reforestation_area.name}"
    
    def to_dict(self):
        return {
            'potential_sites_id': self.potential_sites_id,
            'site_id': self.site_id,
            'reforestation_area_id': self.reforestation_area.reforestation_area_id,
            'polygon_coordinates': self.polygon_coordinates,
            'area_hectares': self.area_hectares,
            'avg_ndvi': self.avg_ndvi,
            'suitability_score': self.suitability_score,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }