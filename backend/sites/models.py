from django.db import models
from django.core.validators import FileExtensionValidator
from reforestation_areas.models import Reforestation_areas
from tree_species.models import Tree_species
from accounts.models import User
from animals.models import Animal
from cloudinary.models import CloudinaryField  # ✅ ADD THIS IMPORT
import math

# ─────────────────────────────────────────────
# SITES (Main Official Entity)
# ─────────────────────────────────────────────
class Sites(models.Model):
    site_id = models.BigAutoField(primary_key=True)

    reforestation_area = models.ForeignKey(
        Reforestation_areas,
        on_delete=models.CASCADE,
        related_name='sites',
        help_text="Parent area container."
    )

    STATUS_CHOICES = (
        ('pending', 'Pending'), ('under_review', 'Under Review'),
        ('accepted', 'Accepted'), ('rejected', 'Rejected'),
        ('completed', 'Completed'), ('under_monitoring', 'Under Monitoring'),
    )
    description = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', db_index=True)
    name = models.CharField(max_length=100, default='Unnamed Site')
    is_active = models.BooleanField(default=True, db_index=True)
    is_pinned = models.BooleanField(default=False, db_index=True)
    
    polygon_coordinates = models.JSONField(null=True, blank=True)
    center_coordinate = models.JSONField(null=True, blank=True)
    marker_coordinate = models.JSONField(null=True, blank=True)

    ndvi_value = models.FloatField(null=True, blank=True)
    total_area_hectares = models.FloatField(default=0.0)
    total_seedlings_planted = models.IntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} [{self.get_status_display()}]"

    class Meta:
        verbose_name = "Site"
        verbose_name_plural = "Sites"
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(fields=['reforestation_area', 'name'], name='unique_site_name_per_area')
        ]

    def calculate_area_from_polygon(self) -> float:
        if not self.polygon_coordinates or len(self.polygon_coordinates) < 3:
            return 0.0
        coords = self.polygon_coordinates
        lat_rad = math.radians(sum(c[0] for c in coords) / len(coords))
        meters_per_deg_lat = 111132.92 - 559.82 * math.cos(2*lat_rad) + 1.175 * math.cos(4*lat_rad)
        meters_per_deg_lng = 111412.84 * math.cos(lat_rad) - 93.5 * math.cos(3*lat_rad)
        local_coords = [((lng - coords[0][1]) * meters_per_deg_lng, (lat - coords[0][0]) * meters_per_deg_lat) for lat, lng in coords]
        area_sqm = sum((local_coords[i][0] * local_coords[(i + 1) % len(local_coords)][1] - local_coords[(i + 1) % len(local_coords)][0] * local_coords[i][1]) for i in range(len(local_coords)))
        return round(abs(area_sqm) / 2 / 10000, 4)


# ─────────────────────────────────────────────
# POTENTIAL SITES (NDVI Analytical Markers)
# ─────────────────────────────────────────────
class Potential_sites(models.Model):
    potential_sites_id = models.BigAutoField(primary_key=True)
    
    site = models.ForeignKey(
        Sites, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='potential_sites',
        help_text="Linked to official Site upon consolidation. Null if still just a raw marker."
    )
    
    polygon_coordinates = models.JSONField(null=True, blank=True)
    area_hectares = models.FloatField(default=0)
    avg_ndvi = models.FloatField(default=0)
    suitability_score = models.FloatField(default=0)
    ndvi_threshold = models.FloatField(default=0.41)
    created_at = models.DateTimeField(auto_now_add=True)

    @property
    def reforestation_area(self):
        return self.site.reforestation_area if self.site else None
    
    # ✅ ADD THIS METHOD
    def to_dict(self):
        return {
            "potential_sites_id": self.potential_sites_id,
            "site_id": self.site.site_id if self.site else None,
            "polygon_coordinates": self.polygon_coordinates,  # Already in [lng, lat] GeoJSON format
            "area_hectares": self.area_hectares,
            "avg_ndvi": self.avg_ndvi,
            "suitability_score": self.suitability_score,
            "ndvi_threshold": self.ndvi_threshold,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
    

    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        target = self.site.name if self.site else "Unassigned Marker"
        return f"Potential-{self.potential_sites_id} -> {target}"


# ─────────────────────────────────────────────
# SITE META DATA VERIFICATION (Official Truth)
# ─────────────────────────────────────────────
class SiteMetaDataVerification(models.Model):
    VERIFICATION_STATUS = (
        ('pending', 'Pending Review'), ('draft', 'Draft'),
        ('verified', 'Verified'), ('rejected', 'Rejected'),
    )

    id = models.BigAutoField(primary_key=True)
    site = models.OneToOneField(
        Sites, on_delete=models.CASCADE, related_name='meta_verification'
    )

    verified_security_concerns = models.JSONField(blank=True, null=True)
    verified_accessibility = models.JSONField(blank=True, null=True)
    verified_land_classification = models.ForeignKey(
        'land_classifications.LandClassification', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='verified_sites'
    )
    
    verified_animals = models.ManyToManyField(
        Animal,
        through='SiteVerifiedAnimal',
        blank=True,
        related_name='verified_sites',
        help_text="Animals verified by admin for this site"
    )

    status = models.CharField(max_length=20, choices=VERIFICATION_STATUS, default='pending')
    decision_note = models.TextField(blank=True, null=True)
    referenced_assessment_ids = models.JSONField(blank=True, null=True)
    verified_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    verified_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Site Meta Data Verification"
        verbose_name_plural = "Site Meta Data Verifications"

    def __str__(self):
        return f"Verification: {self.site.name} ({self.status})"


# ─────────────────────────────────────────────
# SITE VERIFIED ANIMAL (Through Table)
# ─────────────────────────────────────────────
class SiteVerifiedAnimal(models.Model):
    site_verified_animal_id = models.BigAutoField(primary_key=True)
    verification = models.ForeignKey(
        SiteMetaDataVerification,
        on_delete=models.CASCADE,
        related_name='animal_relations'
    )
    animal = models.ForeignKey(
        Animal,
        on_delete=models.CASCADE,
        related_name='site_verification_relations'
    )
    admin_notes = models.TextField(
        blank=True,
        null=True,
        help_text="Admin notes about this animal observation"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'site_verified_animals'
        unique_together = [['verification', 'animal']]
        ordering = ['-created_at']
        verbose_name = "Site Verified Animal"
        verbose_name_plural = "Site Verified Animals"

    def __str__(self):
        return f"{self.verification.site.name} - {self.animal.name}"


# ─────────────────────────────────────────────
# PERMIT DOCUMENTS (Site-Specific)
# ─────────────────────────────────────────────

class PermitDocument(models.Model):
    # ✅ UPDATED: Only 3 document types now
    DOCUMENT_TYPES = (
        ('land_title', 'Land Title'), 
        ('tax_declaration', 'Tax Declaration'), 
        ('other', 'Other'),
    )

    permit_id = models.BigAutoField(primary_key=True)
    site = models.ForeignKey(Sites, on_delete=models.CASCADE, related_name='permit_documents')
    source_assessment_id = models.BigIntegerField(null=True, blank=True)
    document_type = models.CharField(max_length=30, choices=DOCUMENT_TYPES)
    
    # ✅ UPDATED: Removed 'permit_number' and 'file', added 'notes' for text-based tracking
    notes = models.TextField(
        blank=True, 
        null=True, 
        help_text="Details, reference numbers, or notes regarding this document/permit."
    )
    
    verification_notes = models.TextField(blank=True, null=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    @property
    def reforestation_area(self):
        return self.site.reforestation_area

    class Meta:
        verbose_name_plural = "Permit Documents"
        ordering = ['site', '-uploaded_at']

    def __str__(self):
        return f"{self.get_document_type_display()} - Site: {self.site.name}"

# ─────────────────────────────────────────────
# SITE DATA, SPECIES & IMAGES
# ─────────────────────────────────────────────
class Site_data(models.Model):
    site_data_id = models.BigAutoField(primary_key=True)
    site = models.ForeignKey(Sites, on_delete=models.CASCADE, related_name='site_data_versions')
    version = models.PositiveIntegerField(default=1)
    is_current = models.BooleanField(default=True, db_index=True)
    created_by = models.CharField(max_length=100, null=True, blank=True)
    validated_by = models.CharField(max_length=100, null=True, blank=True)
    validated_at = models.DateTimeField(null=True, blank=True)
    site_data = models.JSONField(default=dict)
    field_assessment_snapshot = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-version']
        constraints = [
            models.UniqueConstraint(fields=['site'], condition=models.Q(is_current=True), name='unique_current_site_data_per_site')
        ]

    def __str__(self):
        return f"Site #{self.site.site_id} — v{self.version} [{'CURRENT' if self.is_current else 'ARCHIVED'}]"


class Site_species_recommendation(models.Model):
    site_species_id = models.BigAutoField(primary_key=True)
    site = models.ForeignKey(Sites, on_delete=models.CASCADE, related_name='species_recommendations')
    tree_species = models.ForeignKey(Tree_species, null=True, blank=True, on_delete=models.SET_NULL, related_name='recommended_for_sites')
    priority_rank = models.PositiveIntegerField(default=1)
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['priority_rank']
        constraints = [models.UniqueConstraint(fields=['site', 'tree_species'], name='unique_species_per_site')]

    def __str__(self):
        name = self.tree_species.name if self.tree_species else "Unknown"
        return f"{name} → Site #{self.site.site_id} (Rank #{self.priority_rank})"


class Site_images(models.Model):
    site_image_id = models.BigAutoField(primary_key=True)
    site = models.ForeignKey(Sites, null=True, blank=True, on_delete=models.CASCADE, related_name='site_images')
    LAYER_CHOICES = (('safety', 'Safety'), ('survivability', 'Survivability'), ('general', 'General'))
    layer_tag = models.CharField(max_length=30, choices=LAYER_CHOICES, default='general')
    
    # ✅ CHANGED: Use CloudinaryField instead of ImageField
    img = CloudinaryField('image', folder='sites', blank=True, null=True)
    
    caption = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['layer_tag', 'created_at']

    def __str__(self):
        return f"Image [{self.layer_tag}] for Site: {self.site.name if self.site else 'Unknown'}"