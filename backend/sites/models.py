from django.db import models, transaction
from reforestation_areas.models import Reforestation_areas
from tree_species.models import Tree_species
import math

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
            models.UniqueConstraint(
                fields=['reforestation_area', 'name'],
                name='unique_site_name_per_area'
            )
        ]

    # ─────────────────────────────────────────
    # PURE-PYTHON AREA CALCULATION (No GDAL Required)
    # ─────────────────────────────────────────
    def calculate_area_from_polygon(self) -> float:
        """
        Calculate area in hectares from polygon_coordinates using Haversine + Shoelace.
        Pure Python implementation - NO GDAL/GeoDjango dependency.
        Suitable for site-scale polygons (< 100 ha) in Philippines.
        """
        if not self.polygon_coordinates or len(self.polygon_coordinates) < 3:
            return 0.0
        
        return self._calculate_area_haversine(self.polygon_coordinates)

    def _calculate_area_haversine(self, coords: list) -> float:
        """
        Approximate polygon area using Shoelace formula with Haversine distance.
        Accurate enough for small areas (< 100 ha) at Philippine latitudes.
        Returns area in hectares.
        """
        if len(coords) < 3:
            return 0.0
        
        # Convert coordinates to meters using local scale factor
        # Philippines average latitude ~10°N
        lat_rad = math.radians(sum(c[0] for c in coords) / len(coords))
        
        # Scale factors at latitude (meters per degree)
        meters_per_deg_lat = 111132.92 - 559.82 * math.cos(2*lat_rad) + 1.175 * math.cos(4*lat_rad)
        meters_per_deg_lng = 111412.84 * math.cos(lat_rad) - 93.5 * math.cos(3*lat_rad)
        
        # Convert coords to local meters (easting, northing)
        local_coords = []
        for lat, lng in coords:
            x = (lng - coords[0][1]) * meters_per_deg_lng  # relative to first point
            y = (lat - coords[0][0]) * meters_per_deg_lat
            local_coords.append((x, y))
        
        # Shoelace formula for area
        area_sqm = 0
        n = len(local_coords)
        for i in range(n):
            x1, y1 = local_coords[i]
            x2, y2 = local_coords[(i + 1) % n]
            area_sqm += (x1 * y2 - x2 * y1)
        
        area_hectares = abs(area_sqm) / 2 / 10000  # sq meters → hectares
        return round(area_hectares, 4)

    def calculate_centroid(self) -> list | None:
        """Auto-calculate centroid [lat, lng] from polygon."""
        if not self.polygon_coordinates or len(self.polygon_coordinates) < 3:
            return None
        
        lats = [p[0] for p in self.polygon_coordinates]
        lngs = [p[1] for p in self.polygon_coordinates]
        return [round(sum(lats) / len(lats), 6), round(sum(lngs) / len(lngs), 6)]


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

    version = models.PositiveIntegerField(default=1)
    is_current = models.BooleanField(
        default=True,
        db_index=True,
        help_text="True = active/official record. False = historical archive (read-only)."
    )

    created_by = models.CharField(max_length=100, null=True, blank=True)
    validated_by = models.CharField(max_length=100, null=True, blank=True)
    validated_at = models.DateTimeField(null=True, blank=True)

    site_data = models.JSONField(default=dict)
    field_assessment_snapshot = models.JSONField(default=dict)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        state = "CURRENT" if self.is_current else "ARCHIVED"
        return f"Site #{self.site.site_id} — v{self.version} [{state}]"

    class Meta:
        verbose_name = "Site MCDA Data"
        verbose_name_plural = "Site MCDA Data"
        ordering = ['-version']
        constraints = [
            models.UniqueConstraint(
                fields=['site'],
                condition=models.Q(is_current=True),
                name='unique_current_site_data_per_site'
            )
        ]

    # ─────────────────────────────────────────
    # SCHEMA VALIDATION HELPERS (Document 2)
    # ─────────────────────────────────────────
    ALLOWED_LAYERS = ['safety', 'boundary_verification', 'survivability']
    REQUIRED_BASE_FIELDS = ['acceptance', 'validation_notes', 'validated_location', 'inspector_reference']
    
    LAYER_SPECIFIC_FIELDS = {
        'safety': ['safety_risk_level'],
        'boundary_verification': ['boundary_compliance_status'],
        'survivability': ['overall_survivability_decision', 'species_recommendations'],
    }

    def get_layer_validation(self, layer_name: str) -> dict:
        """Return layer data with Document 2 schema guarantees."""
        layer_data = self.site_data.get(layer_name, {})
        base = {
            "acceptance": layer_data.get("acceptance"),
            "validation_notes": layer_data.get("validation_notes", ""),
            "validated_location": layer_data.get("validated_location"),
            "inspector_reference": layer_data.get("inspector_reference"),
            "validated_at": layer_data.get("validated_at"),
            "validated_by": layer_data.get("validated_by"),
        }
        if layer_name in self.LAYER_SPECIFIC_FIELDS:
            for field in self.LAYER_SPECIFIC_FIELDS[layer_name]:
                base[field] = layer_data.get(field)
        return base

    def is_layer_complete(self, layer_name: str) -> tuple[bool, list[str]]:
        """Check if layer has all Document 2 required fields."""
        layer_data = self.site_data.get(layer_name, {})
        missing = []
        
        for field in self.REQUIRED_BASE_FIELDS:
            if field not in layer_data or not layer_data[field]:
                missing.append(field)
        
        if layer_name in self.LAYER_SPECIFIC_FIELDS:
            for field in self.LAYER_SPECIFIC_FIELDS[layer_name]:
                if field not in layer_data:
                    missing.append(field)
        
        if 'validated_location' in layer_data and layer_data['validated_location']:
            loc = layer_data['validated_location']
            for loc_field in ['latitude', 'longitude', 'assigned_by', 'assignment_method']:
                if loc_field not in loc:
                    missing.append(f"validated_location.{loc_field}")
        
        if 'inspector_reference' in layer_data and layer_data['inspector_reference']:
            ref = layer_data['inspector_reference']
            if 'source_assessment_id' not in ref:
                missing.append("inspector_reference.source_assessment_id")
        
        return (len(missing) == 0, missing)

    def can_finalize(self) -> tuple[bool, dict]:
        """Check if site can be finalized per Document 2 approval cascade."""
        details = {
            'all_layers_validated': True,
            'all_layers_complete': True,
            'has_rejection': False,
            'rejection_layer': None,
            'missing_fields': {}
        }
        
        for layer in self.ALLOWED_LAYERS:
            layer_data = self.site_data.get(layer, {})
            if not layer_data.get('acceptance'):
                details['all_layers_validated'] = False
                continue
            
            is_complete, missing = self.is_layer_complete(layer)
            if not is_complete:
                details['all_layers_complete'] = False
                details['missing_fields'][layer] = missing
            
            if layer_data.get('acceptance') == 'REJECT':
                details['has_rejection'] = True
                details['rejection_layer'] = layer
        
        if details['has_rejection']:
            return (False, {**details, 'reason': 'REJECT found in layer'})
        if not details['all_layers_validated']:
            return (False, {**details, 'reason': 'Not all layers have acceptance decision'})
        if not details['all_layers_complete']:
            return (False, {**details, 'reason': 'Schema incomplete for some layers'})
        
        return (True, {**details, 'reason': 'Ready for finalization'})


# ─────────────────────────────────────────────
# SITE SPECIES RECOMMENDATIONS
# ─────────────────────────────────────────────
class Site_species_recommendation(models.Model):
    site_species_id = models.BigAutoField(primary_key=True)
    site = models.ForeignKey(Sites, on_delete=models.CASCADE, related_name='species_recommendations')
    tree_species = models.ForeignKey(
        Tree_species,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='recommended_for_sites'
    )
    priority_rank = models.PositiveIntegerField(default=1)
    notes = models.TextField(blank=True, null=True)
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
    site = models.ForeignKey(Sites, null=True, blank=True, on_delete=models.CASCADE, related_name='site_images')

    LAYER_CHOICES = (
        ('safety', 'Safety'),
        ('boundary_verification', 'Boundary Verification'),
        ('survivability', 'Survivability'),
        ('general', 'General'),
    )
    layer_tag = models.CharField(max_length=30, choices=LAYER_CHOICES, default='general')

    img = models.ImageField(upload_to='sites/%Y/%m/%d/', blank=True, null=True)
    caption = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Image [{self.layer_tag}] for Site #{self.site.site_id if self.site else 'Unknown'}"

    class Meta:
        verbose_name = "Site Image"
        verbose_name_plural = "Site Images"
        ordering = ['layer_tag', 'created_at']