from django.db import models
from accounts.models import User
from reforestation_areas.models import Reforestation_areas
from sites.models import Sites

# 📌 Strict layer codes for image categorization & MCDA filtering
IMAGE_LAYER_CHOICES = [
    ('meta_land_title', 'Meta: Land Title'),
    ('meta_tax_decl', 'Meta: Tax Declaration'),
    ('meta_other_doc', 'Meta: Other Document'),
    ('safety_flood', 'Safety: Flood'),
    ('safety_landslide', 'Safety: Landslide'),
    ('safety_erosion', 'Safety: Soil Erosion'),
    ('safety_other', 'Safety: Other Observation'),
    ('surv_soil', 'Survivability: Soil'),
    ('surv_water', 'Survivability: Water Availability'),
    ('surv_animal', 'Survivability: Animal Presence'),
    ('surv_slope', 'Survivability: Slope'),
    ('bound_verification', 'Boundary: Verification'),
]


# -------------------- Assigned Onsite Inspector --------------------
class Assigned_onsite_inspector(models.Model):
    assigned_onsite_inspector_id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='assigned_inspections')
    reforestation_area = models.ForeignKey(
        Reforestation_areas, 
        on_delete=models.CASCADE, 
        related_name='assigned_inspections'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'reforestation_area'],
                name='unique_user_reforestation_assignment'
            )
        ]

    def __str__(self):
        return f"Inspector {self.user.email} - Area {self.reforestation_area.name}"


# -------------------- Field Assessment --------------------
class Field_assessment(models.Model):
    field_assessment_id = models.BigAutoField(primary_key=True)
    
    assigned_onsite_inspector = models.ForeignKey(
        Assigned_onsite_inspector,
        on_delete=models.CASCADE,
        related_name='field_assessments'
    )
    site = models.ForeignKey(
        Sites,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="field_assessment"
    )

    # ✅ REMOVED: 'layer' field. One assessment now holds all layers via JSON.
    
    assessment_date = models.DateField(
        null=True,
        blank=True,
        help_text="Date inspector conducted the assessment."
    )
    
    location = models.JSONField(
        null=True,
        blank=True,
        help_text="Optional GPS: {latitude, longitude, gps_accuracy_meters}. Null = meeting-based collection."
    )
    
    # ✅ Updated help_text to reflect new JSON structure
    field_assessment_data = models.JSONField(
        default=dict,
        help_text="Stores overall notes, location context, and categorical selections for Meta, Safety, Survivability, and Boundary layers."
    )
    
    is_submitted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Assessment #{self.field_assessment_id} by {self.assigned_onsite_inspector.user.email} on {self.assessment_date}"


# -------------------- Field Assessment Images --------------------
class Field_assessment_images(models.Model):
    field_assessment_images_id = models.BigAutoField(primary_key=True)
    
    # ✅ Removed null/blank. Every image must belong to an assessment.
    field_assessment = models.ForeignKey(
        Field_assessment,
        on_delete=models.CASCADE,
        related_name='images',
         null=True,
        blank=True,
    )
    
    layer = models.CharField(
        max_length=30,
        choices=IMAGE_LAYER_CHOICES,
         null=True,
        blank=True,
        help_text="Strict layer code for filtering and MCDA mapping."
    )
    
    img = models.ImageField(
         null=True,
        blank=True,
        upload_to='field_assessments/%Y/%m/%d/',
    )
    
    # ✅ Added Geocam coordinates & per-photo note
    latitude = models.DecimalField(
        null=True,
        blank=True,
        max_digits=9, 
        decimal_places=6,
        help_text="GPS Latitude from Geocam"
    )
    longitude = models.DecimalField(
        null=True,
        blank=True,
        max_digits=9, 
        decimal_places=6,
        help_text="GPS Longitude from Geocam"
    )
    description = models.TextField(
        blank=True,
        default='',
        help_text="Per-photo observation/note"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['layer'], name='idx_layer'),
            models.Index(fields=['field_assessment', 'layer'], name='idx_assessment_layer'),
        ]

    def __str__(self):
        return f"Image #{self.field_assessment_images_id} | {self.get_layer_display()}"