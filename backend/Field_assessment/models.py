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


class Field_assessment(models.Model):
    field_assessment_id = models.BigAutoField(primary_key=True)
    
    site = models.ForeignKey(
        Sites,
        null=True,
        on_delete=models.CASCADE,
        related_name='field_assessments'
    )

    assigned_onsite_inspector = models.ForeignKey(
        Assigned_onsite_inspector,
        on_delete=models.CASCADE,
        related_name='field_assessments'
    )
    barangay = models.ForeignKey(
        Barangay,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='field_assessments'
    )
    Safety_types = (
        ('safe', 'Low Risk'),
        ('slightly', 'Slightly Unsafe'),
        ('moderate', 'Moderate Risk'),
        ('danger', 'High Risk')
    )

    Soil_quality_types = (
        ('very_good', 'Very Good'),
        ('good', 'Good'),
        ('moderate', 'Moderate'),
        ('poor', 'Poor'),
        ('very_poor', 'Very Poor')
    )
    legality_status = (
        ('pending', 'Pending'),
        ('legal', 'Legal'),
        ('illegal', 'Illegal'),
    )
    Accessibility_types = (
        ('very_good', 'Very Good'),
        ('good', 'Good'),
        ('moderate', 'Moderate'),
        ('poor', 'Poor'),
        ('very_poor', 'Very Poor')
    )

    Wildlife_status_types = (
        ('very_good', 'Very Good'),
        ('good', 'Good'),
        ('moderate', 'Moderate'),
        ('poor', 'Poor'),
        ('very_poor', 'Very Poor')
    )

    # Info
    title = models.CharField(max_length=255)
    legality =models.CharField(max_length=20,choices=legality_status, default='pending')
    safety = models.CharField(max_length=20, choices=Safety_types, default='moderate')
    
    coordinates = models.JSONField()
    polygon_coordinates = models.JSONField()
    description = models.CharField(max_length=255)
    is_sent = models.BooleanField(default=False) 
    # Content
    soil_quality = models.CharField(max_length=20, choices=Soil_quality_types, default='moderate')
    ndvi = models.CharField(max_length=100)
    distance_to_water_source = models.CharField(max_length=100)
    accessibility = models.CharField(max_length=20, choices=Accessibility_types, default='moderate')
    wildlife_status = models.CharField(max_length=20, choices=Wildlife_status_types, default='moderate')
    created_at = models.DateTimeField(auto_now_add=True)


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
        on_delete=models.CASCADE,
        related_name='field_assessment_details'
    )

    soil = models.ForeignKey(
        Soils,
        null=True,
        on_delete=models.CASCADE,
        related_name='field_assessment_details'
    )

    created_at = models.DateTimeField(auto_now_add=True)