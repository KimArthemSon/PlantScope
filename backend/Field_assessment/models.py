from django.db import models
from django.core.exceptions import ValidationError
from accounts.models import User
from reforestation_areas.models import Reforestation_areas

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


class Field_assessment(models.Model):
    """
    📋 Field Assessment: 
    - If 'site' is NULL ➔ GENERAL Assessment (for the whole reforestation area).
    - If 'site' is NOT NULL ➔ SPECIFIC Assessment (for that exact site).
    """
    field_assessment_id = models.BigAutoField(primary_key=True)
    
    assigned_onsite_inspector = models.ForeignKey(
        Assigned_onsite_inspector,
        on_delete=models.CASCADE,
        related_name='field_assessments'
    )
    
    # ✅ YOUR EXACT LOGIC: The switch for General vs. Specific
    site = models.ForeignKey(
        'sites.Sites',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="field_assessment"
    )

    

    assessment_date = models.DateField(null=True, blank=True)
    location = models.JSONField(
        null=True, blank=True,
        help_text="Optional GPS: {latitude, longitude, gps_accuracy_meters}"
    )
    field_assessment_data = models.JSONField(
        default=dict,
        help_text="Stores overall notes, location context, and categorical selections."
    )
    is_submitted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def clean(self):
        super().clean()
        # Ensure it's tied to at least an area or a site
        if not self.site and not self.reforestation_area:
            raise ValidationError("Assessment must be linked to a Reforestation Area (General) or a Site (Specific).")

    def __str__(self):
        target = f"Site: {self.site.name}" if self.site else f"General Area: {self.reforestation_area.name}"
        return f"Assessment #{self.field_assessment_id} for '{target}'"


class Field_assessment_images(models.Model):
    field_assessment_images_id = models.BigAutoField(primary_key=True)
    field_assessment = models.ForeignKey(
        Field_assessment, on_delete=models.CASCADE, related_name='images', null=True, blank=True
    )
    layer = models.CharField(max_length=30, choices=IMAGE_LAYER_CHOICES, null=True, blank=True)
    img = models.ImageField(upload_to='field_assessments/%Y/%m/%d/', null=True, blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    description = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['layer'], name='idx_layer'),
            models.Index(fields=['field_assessment', 'layer'], name='idx_assessment_layer'),
        ]

    def __str__(self):
        return f"Image #{self.field_assessment_images_id} | {self.get_layer_display()}"