from django.db import models
from reforestation_areas.models import Reforestation_areas
from tree_species.models import Tree_species

# ─────────────────────────────────────────────
# SITES (Main Entity)
# ─────────────────────────────────────────────
class Sites(models.Model):
    site_id = models.BigAutoField(primary_key=True)

    reforestation_area = models.ForeignKey(
        Reforestation_areas,
        on_delete=models.CASCADE,
        related_name='sites',
        help_text="Parent area. Sites can only be created if area.pre_assessment_status = 'approved'"
    )

    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('under_review', 'Under Review'),
        ('accepted', 'Accepted'),
        ('rejected', 'Rejected'),
        ('completed', 'Completed'),
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending',
        db_index=True
    )

    name = models.CharField(max_length=100, default='Unnamed Site')
    is_active = models.BooleanField(default=True, db_index=True)
    is_pinned = models.BooleanField(
        default=False,
        db_index=True,
        help_text="Pin site to top of dashboard for priority tracking."
    )

    # Spatial Fields
    polygon_coordinates = models.JSONField(
        null=True,
        blank=True,
        help_text="GeoJSON polygon array [[lat,lng], ...] — boundary drawn by GIS Specialist."
    )
    center_coordinate = models.JSONField(
        null=True,
        blank=True,
        help_text="Single point [lat, lng] — auto-computed centroid of polygon."
    )
    marker_coordinate = models.JSONField(
        null=True,
        blank=True,
        help_text="Optional GPS verification point [lat, lng] for boundary corner reference."
    )

    # NDVI & Metrics
    ndvi_value = models.FloatField(
        null=True,
        blank=True,
        help_text="Raw NDVI from satellite. Target: 0.2–0.4 (degraded/grassland)."
    )
    total_area_hectares = models.FloatField(
        default=0.0,
        help_text="Calculated from polygon_coordinates by GIS Specialist."
    )
    total_seedlings_planted = models.IntegerField(default=0, help_text="Updated post-planting.")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} [{self.get_status_display()}]"

    class Meta:
        verbose_name = "Site"
        verbose_name_plural = "Sites"
        ordering = ['-created_at']
        constraints = [
            # Ensure site name is unique within its parent area
            models.UniqueConstraint(
                fields=['reforestation_area', 'name'],
                name='unique_site_name_per_area'
            )
        ]


# ─────────────────────────────────────────────
# SITE DATA (MCDA Result — Versioned, 3-Layer)
# ─────────────────────────────────────────────
class Site_data(models.Model):
    site_data_id = models.BigAutoField(primary_key=True)

    site = models.ForeignKey(
        Sites,
        on_delete=models.CASCADE,
        related_name='site_data_versions'
    )

    version = models.PositiveIntegerField(
        default=1,
        help_text="Increments with each re-assessment. Starts at 1."
    )
    is_current = models.BooleanField(
        default=True,
        db_index=True,
        help_text="True = active/official record. False = historical archive (read-only)."
    )

    created_by = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        help_text="User ID or name of GIS Specialist who created this version."
    )
    validated_by = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        help_text="User ID or name of Project Manager who approved this version."
    )
    validated_at = models.DateTimeField(null=True, blank=True)

    # ✅ FINALIZED MCDA RESULTS (GIS Specialist output)
    site_data = models.JSONField(
        default=dict,
        help_text=(
            "GIS Specialist finalized MCDA results for 3 layers: "
            "safety, boundary_verification, survivability. "
            "Each layer contains: acceptance (ACCEPT/REJECT/CONDITIONAL), risk levels, validation notes."
        )
    )

    # ✅ RAW INSPECTOR DATA SNAPSHOT (read-only reference)
    field_assessment_snapshot = models.JSONField(
        default=dict,
        help_text=(
            "Read-only snapshot of inspector field_assessment_data used during this validation. "
            "Keys: safety, boundary_verification, survivability — each containing raw inspector JSON."
        )
    )

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        state = "CURRENT" if self.is_current else "ARCHIVED"
        return f"Site #{self.site.site_id} — v{self.version} [{state}]"

    class Meta:
        verbose_name = "Site MCDA Data"
        verbose_name_plural = "Site MCDA Data"
        ordering = ['-version']
        constraints = [
            # Only ONE current version per site
            models.UniqueConstraint(
                fields=['site'],
                condition=models.Q(is_current=True),
                name='unique_current_site_data_per_site'
            )
        ]


# ─────────────────────────────────────────────
# SITE SPECIES RECOMMENDATIONS
# ─────────────────────────────────────────────
class Site_species_recommendation(models.Model):
    site_species_id = models.BigAutoField(primary_key=True)

    site = models.ForeignKey(
        Sites,
        on_delete=models.CASCADE,
        related_name='species_recommendations'
    )
    tree_species = models.ForeignKey(
        Tree_species,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='recommended_for_sites'
    )

    priority_rank = models.PositiveIntegerField(
        default=1,
        help_text="1 = highest priority species for this site."
    )
    notes = models.TextField(
        blank=True,
        null=True,
        help_text="GIS Specialist note on why this species suits this site."
    )

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        species_name = self.tree_species.name if self.tree_species else "Unknown"
        return f"{species_name} → Site #{self.site.site_id} (Rank #{self.priority_rank})"

    class Meta:
        verbose_name = "Site Species Recommendation"
        verbose_name_plural = "Site Species Recommendations"
        ordering = ['priority_rank']
        constraints = [
            models.UniqueConstraint(
                fields=['site', 'tree_species'],
                name='unique_species_per_site'
            )
        ]


# ─────────────────────────────────────────────
# SITE IMAGES (Evidence for MCDA Layers)
# ─────────────────────────────────────────────
class Site_images(models.Model):
    site_image_id = models.BigAutoField(primary_key=True)

    site = models.ForeignKey(
        Sites,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name='site_images'
    )

    LAYER_CHOICES = (
        ('safety', 'Safety'),
        ('boundary_verification', 'Boundary Verification'),
        ('survivability', 'Survivability'),
        ('general', 'General'),
    )
    layer_tag = models.CharField(
        max_length=30,
        choices=LAYER_CHOICES,
        default='general',
        help_text="Which MCDA layer this photo is evidence for."
    )

    img = models.ImageField(
        upload_to='sites/%Y/%m/%d/',
        blank=True,
        null=True
    )
    caption = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Image [{self.layer_tag}] for Site #{self.site.site_id if self.site else 'Unknown'}"

    class Meta:
        verbose_name = "Site Image"
        verbose_name_plural = "Site Images"
        ordering = ['layer_tag', 'created_at']