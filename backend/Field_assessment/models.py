from django.db import models
from django.core.exceptions import ValidationError
from accounts.models import User
from reforestation_areas.models import Reforestation_areas
from animals.models import Animal
from land_classifications.models import LandClassification
from cloudinary.models import CloudinaryField

IMAGE_LAYER_CHOICES = [
    
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
    
    # ✅ FIX 1: Removed quotes around LandClassification
    land_classification = models.ForeignKey(
        LandClassification,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='field_assessments',
        help_text="Official land classification per DENR/CENRO records"
    )
    
    # ✅ FIX 2: Removed quotes around Animal
    animals_present = models.ManyToManyField(
        Animal,
        through='FieldAssessmentAnimal',
        blank=True,
        related_name='field_assessments',
        help_text="Animals observed during field assessment"
    )
    
    # Kept as string 'sites.Sites' because Sites is not imported at the top (prevents circular imports)
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
        if not self.assigned_onsite_inspector:
            raise ValidationError("Assessment must be linked to an assigned inspector.")
        
        if not self.site and not self.assigned_onsite_inspector.reforestation_area:
            raise ValidationError("Assessment must be linked to a Reforestation Area (General) or a Site (Specific).")

    def __str__(self):
        target = f"Site: {self.site.name}" if self.site else f"General Area: {self.assigned_onsite_inspector.reforestation_area.name}"
        return f"Assessment #{self.field_assessment_id} for '{target}'"


class FieldAssessmentAnimal(models.Model):
    """
    Through table for Field_assessment <-> Animal relationship
    """
    field_assessment_animal_id = models.BigAutoField(primary_key=True)
    field_assessment = models.ForeignKey(
        Field_assessment,
        on_delete=models.CASCADE,
        related_name='animal_relations'
    )
    # ✅ FIX 3: Removed quotes around Animal
    animal = models.ForeignKey(
        Animal,
        on_delete=models.CASCADE,
        related_name='assessment_relations'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'field_assessment_animals'
        unique_together = [['field_assessment', 'animal']]
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.field_assessment} - {self.animal.name}"


from cloudinary.models import CloudinaryField

class Field_assessment_images(models.Model):
    field_assessment_images_id = models.BigAutoField(primary_key=True)
    field_assessment = models.ForeignKey(
        Field_assessment, on_delete=models.CASCADE, related_name='images', null=True, blank=True
    )
    layer = models.CharField(max_length=30, choices=IMAGE_LAYER_CHOICES, null=True, blank=True)
    
    # ✅ CHANGED: Use CloudinaryField instead of ImageField
    img = CloudinaryField('image', folder='field_assessments', null=True, blank=True)
    
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