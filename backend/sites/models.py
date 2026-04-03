from django.db import models
from reforestation_areas.models import Reforestation_areas
from soils.models import Soils
from tree_species.models import Tree_species
from django.core.validators import MinValueValidator, MaxValueValidator

# -------------------- Sites (Main Entity) --------------------

class Sites(models.Model):
    site_id = models.BigAutoField(primary_key=True)

    reforestation_area = models.ForeignKey(
        Reforestation_areas,
        on_delete=models.CASCADE,
        related_name='sites'
    )
    
    status_types = (
        ('pending', 'Pending'),
        ('official', 'Official'),
        ('rejected', 'Rejected'),
        ('re-analysis', 'Re-Analysis'),
        ('completed', 'Completed'),
    )
    
    name = models.CharField(max_length=100, default='Unnamed Site')
    isActive = models.BooleanField(default=True)
    status = models.CharField(max_length=20, choices=status_types, default='pending')
    
    # Geometry Fields
    center_coordinate = models.JSONField(help_text="Single point [lat, lng] for map marker", null=True)
    polygon_coordinates = models.JSONField(help_text="Full GeoJSON polygon for boundary")
    marker_coordinate = models.JSONField(null=True, blank=True, help_text="Legal verification point [lat, lng]")
    
    # Metrics (Quick access without parsing JSON)
    total_area_planted = models.FloatField(default=0.0, help_text="Area in hectares")
    total_seedling_planted = models.IntegerField(default=0)
    survival_status = models.CharField(max_length=50, null=True, blank=True, help_text="e.g., 'High', 'Medium', 'Low'")
    score = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True, help_text="Final MCDA Score")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.get_status_display()})"

    class Meta:
        verbose_name = "Site"
        verbose_name_plural = "Sites"


# -------------------- Site Data (The Complex MCDA Result) --------------------

class Site_data(models.Model):
    """
    Stores the complete finalized MCDA analysis result for a site.
    Contains meta_info, all 8 layers (agreed_data + result), and final_site_summary.
    """
    site_data_id = models.BigAutoField(primary_key=True)

    site = models.OneToOneField(
        Sites,
        on_delete=models.CASCADE,
        related_name='site_data'
    )
    
    is_current = models.BooleanField(default=True, help_text="False if this is an archived version after re-analysis")
    
    # The Big JSON Field containing the entire structure you provided
    site_data = models.JSONField(
        default=dict,
        help_text="Full MCDA result: meta_info, layers (safety, legality...), final_site_summary"
    )
    
    score = models.DecimalField(
        max_digits=5, 
        decimal_places=2, 
        null=True,
        help_text="Total weighted score extracted from JSON for easy querying"
    )
    
    suitability_classification = models.CharField(
        max_length=50, 
        null=True, 
        blank=True, 
        help_text="e.g., 'HIGHLY SUITABLE', 'MARGINALLY SUITABLE'"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Data for Site #{self.site.site_id} - Score: {self.score}"

    class Meta:
        verbose_name = "Site MCDA Data"
        verbose_name_plural = "Site MCDA Data"


# -------------------- Site Details (Relational Links) --------------------

class Site_details(models.Model):
    """
    Optional relational links to specific Soil and Tree Species master tables.
    Useful for filtering "All sites with Mahogany" without parsing JSON.
    Primary data still lives in Site_data JSON.
    """
    site_detail_id = models.BigAutoField(primary_key=True)

    site = models.OneToOneField(
        Sites,
        on_delete=models.CASCADE,
        related_name='site_details'
    )

    soil = models.ForeignKey(
        Soils,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='site_details_soils'
    )

    tree_species = models.ForeignKey(  # Renamed from Tree_specie to standard convention
        Tree_species,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='site_details_tree_species'
    )

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Details for Site #{self.site.site_id}"

    class Meta:
        verbose_name = "Site Detail"
        verbose_name_plural = "Site Details"


# -------------------- Site Images --------------------

class Site_images(models.Model):
    site_image_id = models.BigAutoField(primary_key=True)
    
    site = models.ForeignKey(
        Sites,
        null=True,
        on_delete=models.CASCADE,
        related_name='site_images'
    )
    
    img = models.ImageField(
        upload_to='sites/%Y/%m/%d/',
        blank=True,
        null=True
    )
    
    caption = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Image for Site #{self.site.site_id if self.site else 'Unknown'}"

    class Meta:
        verbose_name = "Site Image"
        verbose_name_plural = "Site Images"