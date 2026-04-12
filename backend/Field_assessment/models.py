from django.db import models
from accounts.models import User
from reforestation_areas.models import Reforestation_areas
from sites.models import Sites
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
    LAYER_CHOICES = (
        ('pre_assessment', 'Pre-Assessment (Area Level)'),
        ('safety', 'Safety (MCDA Layer 1)'),
        ('boundary_verification', 'Boundary Verification (MCDA Layer 2)'),
        ('survivability', 'Survivability (MCDA Layer 3)'),
    )

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

    # ✅ Default set to pre_assessment for Phase 1 mobile flow
    layer = models.CharField(
        max_length=30,
        choices=LAYER_CHOICES,
        default='pre_assessment',
    )

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

    # ✅ Stores raw inspector JSON matching PLANTSCOPE v5.0 schema
    field_assessment_data = models.JSONField(
        default=dict,
        help_text="Layer-specific observational data collected by the onsite inspector."
    )

    is_submitted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        # ✅ UNIQUE CONSTRAINT REMOVED
        # You can now submit multiple assessments for the same layer and inspector.
        pass

    def __str__(self):
        return f"[{self.get_layer_display()}] by {self.assigned_onsite_inspector.user.email} on {self.assessment_date}"


# -------------------- Field Assessment Images --------------------
class Field_assessment_images(models.Model):
    field_assessment_images_id = models.BigAutoField(primary_key=True)
    field_assessment = models.ForeignKey(
        Field_assessment,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name='images'
    )
    layer = models.CharField(
        max_length=30,
        choices=Field_assessment.LAYER_CHOICES,
        null=True,
        blank=True,
        default='pre_assessment',
        help_text="Which assessment layer this image supports."
    )
    img = models.ImageField(
        upload_to='field_assessments/%Y/%m/%d/',
        null=True,
        blank=True,
    )
    caption = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Image for Assessment #{self.field_assessment_id}"