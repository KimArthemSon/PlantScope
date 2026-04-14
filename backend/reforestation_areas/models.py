from django.db import models
from barangay.models import Barangay
from django.core.validators import FileExtensionValidator
from accounts.models import User
from land_classifications.models import LandClassification

class Reforestation_areas(models.Model):
    # Kept for backward compatibility with your existing create form
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
    PRE_ASSESSMENT_STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    )

    land_classification = models.ForeignKey(LandClassification, on_delete=models.RESTRICT, blank=True, null=True, related_name='reforesatation_areas')
    reforestation_area_id = models.BigAutoField(primary_key=True)
    barangay = models.ForeignKey(Barangay, null=True, blank=True, on_delete=models.SET_NULL, related_name='reforestation_areas')
    name = models.CharField(max_length=100, unique=True)
    description = models.CharField(max_length=255, blank=True, null=True)
    area_img = models.ImageField(upload_to='areas/', blank=True, null=True)

    # Phase 1: Pre-Assessment Fields (Nullable/Defaults for form compatibility)
    legality = models.CharField(max_length=20, choices=legality_status, default='pending', blank=True)
    pre_assessment_status = models.CharField(max_length=20, choices=PRE_ASSESSMENT_STATUS_CHOICES, default='pending', blank=True)
    reforestation_data = models.JSONField(null=True, blank=True, help_text="GIS Specialist manual validation JSON. Stored after right-panel review.")
    
    # Kept to not break your existing create form
    safety = models.CharField(max_length=20, choices=Safety_types, default='danger', blank=True)

    # Spatial Fields
    polygon_coordinate = models.JSONField(null=True, blank=True)
    coordinate = models.JSONField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class PermitDocument(models.Model):
    DOCUMENT_TYPES = (
        ('barangay_clearance', 'Barangay Clearance'),
        ('lgu_endorsement', 'LGU Endorsement'),
        ('denr_permit', 'DENR Permit'),
        ('landowner_consent', 'Landowner Consent'),
        ('other', 'Other'),
    )

    permit_id = models.BigAutoField(primary_key=True)
    reforestation_area = models.ForeignKey(
        'Reforestation_areas',
        on_delete=models.CASCADE,
        related_name='permit_documents'
    )
    document_type = models.CharField(max_length=30, choices=DOCUMENT_TYPES)
    permit_number = models.CharField(max_length=100, blank=True, null=True)
    file = models.FileField(
        upload_to='permits/%Y/%m/',
        validators=[FileExtensionValidator(['pdf', 'jpg', 'jpeg', 'png'])]
    )
    verification_notes = models.TextField(blank=True, null=True, help_text="GIS Specialist notes on why this permit was accepted")
    uploaded_at = models.DateTimeField(auto_now_add=True)
    uploaded_by = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL,
        help_text="GIS Specialist who verified & uploaded"
    )

    class Meta:
        ordering = ['-uploaded_at']

    def __str__(self):
        return f"{self.get_document_type_display()} → {self.reforestation_area.name}"

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