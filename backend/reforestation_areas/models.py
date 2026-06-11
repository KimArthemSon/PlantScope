from django.db import models
from barangay.models import Barangay
class Reforestation_areas(models.Model):
    """
    📍 Core Container: Stores spatial data & basic identification only.
    Verification status lives in SiteMetaDataVerification (sites app).
    Raw inspector evidence lives in field_assessment.Field_assessment.
    """
    reforestation_area_id = models.BigAutoField(primary_key=True)
    name = models.CharField(max_length=100, unique=True)
    description = models.CharField(max_length=255, blank=True, null=True)
    coordinate = models.JSONField(null=True, blank=True, help_text="Center marker coordinate")
    barangay = models.ForeignKey(
        Barangay, null=True, blank=True, on_delete=models.SET_NULL,
        related_name='reforestation_areas'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    deleted_at = models.DateTimeField(null=True, blank=True, help_text="Soft delete timestamp")

    class Meta:
        verbose_name_plural = "Reforestation Areas"
        ordering = ['name']

    def __str__(self):
        return self.name