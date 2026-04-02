from django.db import models
from accounts.models import User
from sites.models import Sites
from soils.models import Soils
from barangay.models import Barangay
from tree_species.models import Tree_species
from reforestation_areas.models import Reforestation_areas

# -------------------- Assigned Onsite Inspector --------------------

class Assigned_onsite_inspector(models.Model):
    assigned_onsite_inspector_id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='assigned_inspections'
    )
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
        return f"Inspector {self.user.email} - Area {self.reforestation_area_id}"


# -------------------- Field Assessment (Modular) --------------------

class Field_assessment(models.Model):
    field_assessment_id = models.BigAutoField(primary_key=True)
    
    site = models.ForeignKey(
        Sites,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name='field_assessments'
    )

    assigned_onsite_inspector = models.ForeignKey(
        Assigned_onsite_inspector,
        on_delete=models.CASCADE,
        related_name='field_assessments'
    )
    
    # Fixed: Added missing comma after 'Legality' and corrected spelling in labels
    multicriteria_layers = (
        ('pre_assessment', 'Pre-Assessment'),
        ('safety', 'Safety'),
        ('legality', 'Legality'),  # Comma added here
        ('slope', 'Slope'),
        ('soil_quality', 'Soil Quality'),
        ('tree_species_suitability', 'Tree Species Suitability'),
        ('accessibility', 'Accessibility'),
        ('hydrology', 'Hydrology'),
        ('wildlife_status', 'Wildlife Status'),
    )

    multicriteria_type = models.CharField(
        max_length=30, 
        choices=multicriteria_layers, 
        default='pre_assessment'
    )
    
    # Fixed: Typo 'fied' -> 'field'
    field_assessment_data = models.JSONField(
        default=dict, 
        help_text="JSON data specific to the selected layer type"
    )
    
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    is_sent = models.BooleanField(default=False) 

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        site_name = self.site.name if self.site else "New Site"
        return f"[{self.get_multicriteria_type_display()}] for {site_name}"

    class Meta:
        # Prevents duplicate submissions of the same layer by the same inspector for the same site
        constraints = [
            models.UniqueConstraint(
                fields=['site', 'assigned_onsite_inspector', 'multicriteria_type'],
                name='unique_layer_submission',
                condition=models.Q(is_sent=True)
            )
        ]


# -------------------- Field Assessment Details --------------------

class Field_assessment_details(models.Model):
    field_assessment_detail_id = models.BigAutoField(primary_key=True)

    field_assessment = models.ForeignKey(
        Field_assessment,
        null=True,
        on_delete=models.CASCADE,
        related_name='field_assessment_details'
    )

    tree_specie = models.ForeignKey(
        Tree_species,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='field_assessment_details'
    )

    soil = models.ForeignKey(
        Soils,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='field_assessment_details'
    )

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Details for Assessment #{self.field_assessment_id}"


# -------------------- Field Assessment Images --------------------

class field_assessment_images(models.Model):
    field_assessment_images_id = models.BigAutoField(primary_key=True)
    
    field_assessment = models.ForeignKey(
        Field_assessment,
        null=True,
        on_delete=models.CASCADE,
        related_name='field_assessment_images'
    )
    
    img = models.ImageField(
        upload_to='field_assessments/%Y/%m/%d/',
        blank=True,
        null=True
    )
    
    caption = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Image for Assessment #{self.field_assessment_id}"