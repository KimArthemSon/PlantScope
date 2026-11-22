from django.db import models
from barangay.models import Barangay

class LandClassification(models.Model):
    land_classification_id = models.BigAutoField(primary_key=True)
    name = models.CharField(max_length=100, unique=True)
    description = models.CharField(max_length=255)
    OWNERSHIP_CHOICES = (
        ('public', 'Public'),
        ('private', 'Private'),
    )
    ownership_type = models.CharField(
        max_length=20, 
        choices=OWNERSHIP_CHOICES, 
        default='private',
        db_index=True,
        help_text="Land ownership classification (Public or Private)."
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    # Archived records are hidden from lists/dropdowns but kept so they can be restored
    is_archived = models.BooleanField(default=False, db_index=True)
    archived_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.name} ({self.get_ownership_type_display()})"

    class Meta:
        verbose_name = "Land Classification"
        verbose_name_plural = "Land Classifications"
        ordering = ['name']

   
class Classified_areas(models.Model):
    classified_area_id = models.BigAutoField(primary_key=True)
    name = models.CharField(max_length=100, unique=True)
    land_classification = models.ForeignKey(
        LandClassification,
        on_delete=models.RESTRICT,
        related_name="classified_areas"
    )

    barangay = models.ForeignKey(
        Barangay,
        on_delete=models.RESTRICT,
        null=True,
        related_name="classified_areas"
    )
    polygon = models.JSONField()
    description = models.CharField(max_length=255)
    # Archived records are hidden from lists/maps but kept so they can be restored
    is_archived = models.BooleanField(default=False, db_index=True)
    archived_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
