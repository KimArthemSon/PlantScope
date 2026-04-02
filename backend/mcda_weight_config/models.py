from django.db import models

class McdaWeightsConfig(models.Model):
    LAYER_CHOICES = [
        ('safety', 'Safety (Geophysical & Security)'),
        ('legality', 'Legality (Land Tenure)'),
        ('slope', 'Slope (Topography)'),
        ('soil_quality', 'Soil Quality'),
        ('accessibility', 'Accessibility'),
        ('hydrology', 'Hydrology (Water Source)'), # Updated Name
        ('wildlife_status', 'Wildlife Status'),
        ('tree_species_suitability', 'Tree Species Suitability'),
    ]

    id = models.BigAutoField(primary_key=True)
    layer_name = models.CharField(max_length=50, choices=LAYER_CHOICES, unique=True)
    weight_percentage = models.DecimalField(max_digits=5, decimal_places=2)
    scoring_rules = models.JSONField(default=dict)
    is_active = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.get_layer_name_display()} - {self.weight_percentage}%"

    class Meta:
        verbose_name = "MCDA Weight Configuration"
        verbose_name_plural = "MCDA Weight Configurations"