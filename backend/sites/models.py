from django.db import models
from reforestation_areas.models import Reforestation_areas
from soils.models import Soils
from tree_species.models import Tree_species

class Sites(models.Model):
    site_id = models.BigAutoField(primary_key=True)

    reforestation_area = models.ForeignKey(
        Reforestation_areas,
        on_delete=models.CASCADE,
        related_name='sites'
    )

    status = models.CharField(max_length=50)
    coordinates = models.JSONField()
    polygon_coordinates = models.JSONField()
    total_area_planted = models.FloatField()
    total_seedling_planted = models.IntegerField()
    created_at = models.DateTimeField(auto_now_add=True)


class Site_data(models.Model):
    site_data_id = models.BigAutoField(primary_key=True)

    site = models.OneToOneField(
        Sites,
        on_delete=models.CASCADE,
        related_name='site_data'
    )

    Soil_quality_types = (
        ('very_good', 'Very Good'),
        ('good', 'Good'),
        ('moderate', 'Moderate'),
        ('poor', 'Poor'),
        ('very_poor', 'Very Poor')
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

    soil_quality = models.CharField(max_length=20, choices=Soil_quality_types, default='moderate')
    ndvi = models.CharField(max_length=100)
    distance_to_water_source = models.FloatField()
    accessibility = models.CharField(max_length=20, choices=Accessibility_types, default='moderate')
    wildlife_status = models.CharField(max_length=20, choices=Wildlife_status_types, default='moderate')
    created_at = models.DateTimeField(auto_now_add=True)


class Site_details(models.Model):
    site_detail_id = models.BigAutoField(primary_key=True)

    site = models.OneToOneField(
        Sites,
        on_delete=models.CASCADE,
        related_name='site_details'
    )

    soil = models.ForeignKey(
        Soils,
        null=True,
        on_delete=models.CASCADE,
        related_name='site_details_soils'
    )

    Tree_specie = models.ForeignKey(
        Tree_species,
        null=True,
        on_delete=models.CASCADE,
        related_name='site_details_tree_species'
    )

    tree_specie_id = models.CharField(max_length=50)
    created_at = models.DateTimeField(auto_now_add=True)