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
    is_sent = models.BooleanField(default=False) 
    description = models.CharField(max_length=255)
    legality = models.CharField(
        max_length=20,
        choices=legality_status,
        default='pending',
        null=True,
        blank=True
    )

    safety = models.CharField(
        max_length=20,
        choices=Safety_types,
        default='moderate',
        null=True,
        blank=True
    )

    coordinates = models.JSONField(
        null=True,
        blank=True
    )

    polygon_coordinates = models.JSONField(
        null=True,
        blank=True
    )

    slope = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0.00,
        null=True,
        blank=True
    )

    soil_quality = models.CharField(
        max_length=20,
        choices=Soil_quality_types,
        default='moderate',
        null=True,
        blank=True
    )

    distance_to_water_source = models.CharField(
        max_length=100,
        null=True,
        blank=True
    )

    accessibility = models.CharField(
        max_length=20,
        choices=Accessibility_types,
        default='moderate',
        null=True,
        blank=True
    )

    wildlife_status = models.CharField(
        max_length=20,
        choices=Wildlife_status_types,
        default='moderate',
        null=True,
        blank=True
    )
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

class Field_assessment_multicriteria(models.Model):
    field_assessment_multicriteria_id = models.BigAutoField(primary_key=True)
    
    field_assessment = models.ForeignKey(
        Field_assessment,
        null=True,
        on_delete=models.CASCADE,
        related_name='field_assessment_multicriteria'
    )

    # Info
    legality_disccussion = models.CharField(max_length=255, default='')
    slope_disccussion = models.CharField(max_length=255, default='')
    safety_disccussion = models.CharField(max_length=255, default='')
    soil_quality_disccussion = models.CharField(max_length=255, default='')
    distance_to_water_source_disccussion = models.CharField(max_length=255, default='')
    accessibility_disccussion = models.CharField(max_length=255, default='')
    wildlife_status_disccussion = models.CharField(max_length=255, default='')

    created_at = models.DateTimeField(auto_now_add=True)

class Field_assessment_multicriteria_photos(models.Model):
    field_assessment_multicriteria_photo_id = models.BigAutoField(primary_key=True)
    
    field_assessment = models.ForeignKey(
        Field_assessment,
        null=True,
        on_delete=models.CASCADE,
        related_name='Field_assessment_multicriteria_photos'
    )

    multicriteria_types = (
        ('all', 'All'),
        ('slope', 'Slope'),
        ('soil_quality', 'Soil quality'),
        ('accessibility', 'Accessibility'),
        ('wildlife_status', 'Wildlife status'),
        ('safety', 'Safety'),
        ('legality', 'Legality')
    )
    multicriteria_type = models.CharField(max_length=20, choices=multicriteria_types, default='all')
    
    img = models.ImageField(
        upload_to='field_asessment/',
        blank=True,
        null=True
    )

    created_at = models.DateTimeField(auto_now_add=True)
