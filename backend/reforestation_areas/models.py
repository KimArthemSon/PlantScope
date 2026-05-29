from django.db import models
from barangay.models import Barangay
from django.core.validators import FileExtensionValidator
from accounts.models import User
from land_classifications.models import LandClassification

class Reforestation_areas(models.Model):
    """
    📍 Core Container: Stores spatial data & basic identification only.
    Verification status lives in AreaMetaDataVerification.
    Raw inspector evidence lives in field_assessment.FieldAssessment (separate app).
    """
    reforestation_area_id = models.BigAutoField(primary_key=True)
    name = models.CharField(max_length=100, unique=True)
    description = models.CharField(max_length=255, blank=True, null=True)
    area_img = models.ImageField(upload_to='areas/', blank=True, null=True)

    barangay = models.ForeignKey(
        Barangay, null=True, blank=True, on_delete=models.SET_NULL,
        related_name='reforestation_areas'
    )
    land_classification = models.ForeignKey(
        LandClassification, on_delete=models.RESTRICT, blank=True, null=True,
        related_name='reforestation_areas'
    )

    # Spatial Fields
    polygon_coordinate = models.JSONField(null=True, blank=True, help_text="Polygon geometry for GIS")
    coordinate = models.JSONField(null=True, blank=True, help_text="Center marker coordinate")

    created_at = models.DateTimeField(auto_now_add=True)
    deleted_at = models.DateTimeField(null=True, blank=True, help_text="Soft delete timestamp")

    class Meta:
        verbose_name_plural = "Reforestation Areas"
        ordering = ['name']

    def __str__(self):
        return self.name


class AreaMetaDataVerification(models.Model):
    """
    ✅ Official Truth (Area-Level): Consolidated decision by Admin/Data Manager.
    OneToOne: Each Reforestation Area has exactly ONE official verified metadata record.
    This is what MCDA, Tree Growers, and Reports query.
    
    Admin reviews multiple FieldAssessments (from separate app) and consolidates
    the correct security concerns, accessibility, and land classification here.
    """
    VERIFICATION_STATUS = (
        ('pending', 'Pending Review'),
        ('draft', 'Draft'),
        ('verified', 'Verified'),
        ('rejected', 'Rejected'),
    )

    id = models.BigAutoField(primary_key=True)
    reforestation_area = models.OneToOneField(
        Reforestation_areas, on_delete=models.CASCADE,
        related_name='meta_verification'
    )

    # === Consolidated Meta Data (Admin's Decision) ===
    
    # 1. Security Concerns - Admin selects the confirmed concerns
    verified_security_concerns = models.JSONField(
        blank=True, null=True,
        help_text="List of confirmed concerns: ['Armed Threat', 'Land Conflict']"
    )
    
    # 2. Accessibility - Admin's final accessibility assessment
    verified_accessibility = models.JSONField(
        blank=True, null=True,
        help_text="{'type': 'Vehicle', 'road_condition': '2km dirt road, 4x4 required'}"
    )
    
    # 3. Land Classification - Admin confirms the official type
    verified_land_classification = models.ForeignKey(
        LandClassification, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='verified_areas',
        help_text="Final confirmed land classification"
    )

    # === Decision & Audit ===
    status = models.CharField(max_length=20, choices=VERIFICATION_STATUS, default='pending')
    decision_note = models.TextField(blank=True, null=True, help_text="Reason for acceptance/rejection")
    
    # Track which FieldAssessments (from other app) were used as evidence
    # Stored as list of IDs since FieldAssessment is in separate app
    referenced_assessment_ids = models.JSONField(
        blank=True, null=True,
        help_text="List of field_assessment.FieldAssessment IDs used as evidence"
    )

    verified_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    verified_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Area Meta Data Verification"
        verbose_name_plural = "Area Meta Data Verifications"

    def __str__(self):
        return f"Verification: {self.reforestation_area.name} ({self.status})"


class PermitDocument(models.Model):
    """
    📄 Legal/Official Documents for the reforestation area.
    Can be uploaded by inspectors (via field_assessment app) 
    or added directly by admins during verification.
    """
    DOCUMENT_TYPES = (
        ('land_title', 'Land Title'),
        ('tax_declaration', 'Tax Declaration'),
        ('barangay_clearance', 'Barangay Clearance'),
        ('lgu_endorsement', 'LGU Endorsement'),
        ('denr_permit', 'DENR Permit'),
        ('landowner_consent', 'Landowner Consent'),
        ('other', 'Other'),
    )

    permit_id = models.BigAutoField(primary_key=True)
    reforestation_area = models.ForeignKey(
        Reforestation_areas, on_delete=models.CASCADE,
        related_name='permit_documents'
    )
    
    # Optional: Track if this permit originated from a specific field assessment
    # Use string reference to avoid tight coupling with separate app
    source_assessment_id = models.BigIntegerField(
        null=True, blank=True,
        help_text="ID from field_assessment.FieldAssessment (if uploaded by inspector)"
    )

    document_type = models.CharField(max_length=30, choices=DOCUMENT_TYPES)
    permit_number = models.CharField(max_length=100, blank=True, null=True)
    file = models.FileField(
        upload_to='permits/%Y/%m/',
        validators=[FileExtensionValidator(['pdf', 'jpg', 'jpeg', 'png'])]
    )
    verification_notes = models.TextField(blank=True, null=True, help_text="Admin notes on this document")
    uploaded_at = models.DateTimeField(auto_now_add=True)
    uploaded_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        help_text="User who uploaded this document"
    )

    class Meta:
        verbose_name_plural = "Permit Documents"
        ordering = ['reforestation_area', '-uploaded_at']

    def __str__(self):
        return f"{self.get_document_type_display()} - {self.reforestation_area.name}"


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