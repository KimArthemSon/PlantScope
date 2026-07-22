from django.db import models
from django.utils import timezone
from sites.models import Sites
from accounts.models import User
from tree_species.models import Tree_species
from cloudinary.models import CloudinaryField  # ✅ ADD THIS IMPORT


# ─────────────────────────────────────────────
# APPLICATION (Tree Planting Program Request)
# ─────────────────────────────────────────────
class Application(models.Model):
    """Application model for tree planting program requests"""

    STATUS_CHOICES = [
        ('for_evaluation', 'For Evaluation'),
        ('for_head', 'For Head Approval'),
        ('accepted', 'Accepted'),
        ('under_monitoring', 'Under Monitoring'),
        ('rejected', 'Rejected'),
        ('cancelled', 'Cancelled'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]

    CLASSIFICATION_CHOICES = [
        ('new', 'New (First-Time)'),
        ('old', 'Returning'),
    ]

    # Primary Key
    application_id = models.AutoField(primary_key=True)

    # Foreign Keys
    user = models.ForeignKey(
        User,
        on_delete=models.RESTRICT,
        related_name='applications'
    )

    # ✅ FINALIZED SITE (Assigned by DataManager during evaluation)
    site = models.ForeignKey(
        Sites,
        on_delete=models.CASCADE,
        related_name='applications',
        null=True,
        blank=True,
        help_text="Final site assigned by DataManager"
    )

    # ✅ PROPOSED SITE (For returning growers only - FK to existing Sites)
    proposed_site = models.ForeignKey(
        Sites,
        on_delete=models.SET_NULL,
        related_name='proposed_applications',
        null=True,
        blank=True,
        help_text="Site proposed by returning tree grower (nullable for first-timers)"
    )

    # Classification
    classification = models.CharField(
        max_length=50,
        choices=CLASSIFICATION_CHOICES,
        default='new'
    )

    # Basic Information
    title = models.CharField(max_length=255)

    # ✅ Renamed from total_members
    total_treegrowers_will_participate = models.IntegerField(
        default=2,
        help_text="Total tree growers who will participate (minimum 2)"
    )

    # Status and Workflow
    status = models.CharField(
        max_length=50,
        choices=STATUS_CHOICES,
        default='for_evaluation'
    )

    # Dates
    # ✅ FINALIZED orientation date (Assigned by DataManager)
    orientation_date = models.DateField(
        null=True,
        blank=True,
        help_text="Final orientation date assigned by DataManager"
    )

   
    proposed_orientation_date = models.DateField(
        null=True,
        blank=True,
        help_text="Orientation date proposed by returning tree grower"
    )

    confirmed_at = models.DateField(
        null=True,
        blank=True,
        help_text="Date when Head confirmed the application"
    )

    # ✅ Files (Updated to CloudinaryField)
    maintenance_plan = CloudinaryField(
        'maintenance_plan',
        folder='application_maintenance_plans',
        resource_type='raw',  # Allows PDFs, Docs, etc.
        blank=True,
        null=True,
        help_text="Maintenance plan uploaded by tree grower"
    )
    agreement_image = CloudinaryField(
        'agreement_image',
        folder='agreements',
        blank=True,
        null=True,
        help_text="Signed agreement image"
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Application"
        verbose_name_plural = "Applications"
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['created_at']),
            models.Index(fields=['user', 'status']),
            models.Index(fields=['classification']),
        ]

    def __str__(self):
        return f"{self.title} - {self.get_status_display()}"

    @property
    def is_returning_grower(self):
        """Check if this is a returning tree grower application"""
        return self.classification == 'old'

    @property
    def has_proposed_site(self):
        """Check if grower proposed a site"""
        return self.proposed_site is not None


# ─────────────────────────────────────────────
# SEEDLING REQUEST (Main Request Record)
# ─────────────────────────────────────────────

class SeedlingRequest(models.Model):
    """
    Seedling request model - submitted WITH application or as additional request.
    Specific species breakdown stored in SeedlingRequestSpecies.
    """

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),       # Approved by DataManager, awaiting handover
        ('confirmed', 'Confirmed'),     # Verified by Onsite Inspector
        ('rejected', 'Rejected'),       # Rejected by DataManager
        ('cancelled', 'Cancelled'),     # Cancelled by Tree Grower or DataManager
    ]

    FULFILLMENT_CHOICES = [
        ('pickup', 'Grower Pickup'),
        ('deliver', 'Delivered to Site'),
    ]

    # Primary Key
    seedling_request_id = models.AutoField(primary_key=True)

    # Foreign Key to Application
    application = models.ForeignKey(
        'Application', # String reference to avoid circular imports if needed, or just Application
        on_delete=models.CASCADE,
        related_name='seedling_requests'
    )

    # Request Information
    description = models.TextField(
        blank=True,
        null=True,
        help_text="Additional details about seedling request"
    )

    # ✅ Summary total (calculated from SeedlingRequestSpecies)
    no_request_seedling = models.IntegerField(
        default=0,
        help_text="Total number of seedlings requested (summary)"
    )

    # ✅ NEW: Workflow & Assignment Fields
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending'
    )
    
    fulfillment_type = models.CharField(
        max_length=10,
        choices=FULFILLMENT_CHOICES,
        null=True,
        blank=True,
        help_text="How the seedlings will be received"
    )
    
    assigned_inspector = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_seedling_requests',
        limit_choices_to={'user_role': 'OnsiteInspector'},
        help_text="Inspector assigned to verify receipt"
    )

    # ✅ NEW: Reason & Proof Fields
    reason = models.TextField(
        blank=True,
        null=True,
        help_text="Reason for rejection or cancellation"
    )
    
    # Keeping reason_accepted for backward compatibility, but 'reason' is now primary for rejections/cancellations
    reason_accepted = models.TextField(
        blank=True,
        null=True,
        help_text="Notes when accepted (Legacy)"
    )

    proof_of_delivery = CloudinaryField(
        'proof_of_delivery',
        folder='seedling_proofs',
        resource_type='image',
        blank=True,
        null=True,
        help_text="Photo proof of seedling handover/delivery"
    )

    # Timestamps
    submitted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Seedling Request"
        verbose_name_plural = "Seedling Requests"
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['application', 'status']),
            models.Index(fields=['assigned_inspector', 'status']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"Seedling Request #{self.seedling_request_id} for {self.application.title} - {self.get_status_display()}"

    def save(self, *args, **kwargs):
        """Auto-set submitted_at on first save"""
        if not self.submitted_at:
            from django.utils import timezone
            self.submitted_at = timezone.now()
        super().save(*args, **kwargs)

    def calculate_total_seedlings(self):
        """Calculate total seedlings from related species records"""
        return sum(
            species.quantity
            for species in self.seedling_species.all()
        )


# ─────────────────────────────────────────────
# SEEDLING REQUEST SPECIES (Normalized Species Breakdown)
# ─────────────────────────────────────────────
class SeedlingRequestSpecies(models.Model):
    """
    Breakdown of seedling request by specific tree species.
    Enables easy reporting and analytics per species.
    """
    seedling_species_id = models.AutoField(primary_key=True)

    # Foreign Keys
    seedling_request = models.ForeignKey(
        SeedlingRequest,
        on_delete=models.CASCADE,
        related_name='seedling_species'
    )
    tree_species = models.ForeignKey(
        Tree_species,
        on_delete=models.CASCADE,
        related_name='seedling_requests'
    )

    # Species Details
    quantity = models.IntegerField(
        default=0,
        help_text="Number of seedlings of this species"
    )
    provided_by = models.CharField(
        max_length=255,
        default='ENRO Nursery',
        help_text="Source/provider of the seedlings"
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Seedling Request Species"
        verbose_name_plural = "Seedling Request Species"
        ordering = ['-quantity']
        constraints = [
            models.UniqueConstraint(
                fields=['seedling_request', 'tree_species'],
                name='unique_species_per_seedling_request'
            )
        ]

    def __str__(self):
        species_name = self.tree_species.name if self.tree_species else "Unknown"
        return f"{species_name} x{self.quantity} (Request #{self.seedling_request_id})"


# ─────────────────────────────────────────────
# PROGRESS REPORT (Onsite Monitoring)
# ─────────────────────────────────────────────
class ProgressReport(models.Model):
    """
    Progress report model for ongoing monitoring after application acceptance.
    Specific species survival data stored in ProgressReportSpecies.
    """

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
        ('rejected', 'Rejected'),
    ]

    # Primary Key
    progress_report_id = models.AutoField(primary_key=True)

    # Foreign Key to Application
    application = models.ForeignKey(
        Application,
        on_delete=models.CASCADE,
        related_name='progress_reports'
    )

    # ✅ Updated to CloudinaryField
    proof_image_monitor_required = CloudinaryField(
        'proof_image_monitor_required',
        folder='progress_report_proof_images',
        blank=True,
        null=True,
        help_text="Proof images of monitoring"
    )
    
    description = models.TextField(
        blank=True,
        null=True,
        help_text="Additional notes about progress"
    )

    # Status
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending'
    )

    # Timestamps
    submitted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Progress Report"
        verbose_name_plural = "Progress Reports"
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['application', 'status']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"Progress Report #{self.progress_report_id} for {self.application.title} - {self.get_status_display()}"

    def save(self, *args, **kwargs):
        """Auto-set submitted_at on first save"""
        if not self.submitted_at:
            self.submitted_at = timezone.now()
        super().save(*args, **kwargs)

    @property
    def total_survived(self):
        """Calculate total survived plants from species records"""
        return sum(
            species.no_survived
            for species in self.report_species.all()
        )

    @property
    def total_dead(self):
        """Calculate total dead plants from species records"""
        return sum(
            species.no_dead
            for species in self.report_species.all()
        )

    @property
    def total_plants(self):
        """Calculate total plants (survived + dead)"""
        return self.total_survived + self.total_dead


# ─────────────────────────────────────────────
# PROGRESS REPORT SPECIES (Normalized Species Monitoring)
# ─────────────────────────────────────────────
class ProgressReportSpecies(models.Model):
    """
    Breakdown of progress report by specific tree species.
    Tracks survival and mortality per species for detailed analytics.
    """
    report_species_id = models.AutoField(primary_key=True)

    # Foreign Keys
    progress_report = models.ForeignKey(
        ProgressReport,
        on_delete=models.CASCADE,
        related_name='report_species'
    )
    tree_species = models.ForeignKey(
        Tree_species,
        on_delete=models.CASCADE,
        related_name='progress_reports'
    )

    # Monitoring Data per Species
    no_survived = models.IntegerField(
        default=0,
        help_text="Number of plants of this species that survived"
    )
    no_dead = models.IntegerField(
        default=0,
        help_text="Number of plants of this species that died"
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Progress Report Species"
        verbose_name_plural = "Progress Report Species"
        ordering = ['-no_survived']
        constraints = [
            models.UniqueConstraint(
                fields=['progress_report', 'tree_species'],
                name='unique_species_per_progress_report'
            )
        ]

    def __str__(self):
        species_name = self.tree_species.name if self.tree_species else "Unknown"
        return f"{species_name} - Survived: {self.no_survived}, Dead: {self.no_dead}"

    @property
    def total_plants(self):
        """Total plants of this species in this report"""
        return self.no_survived + self.no_dead

    @property
    def survival_rate(self):
        """Calculate survival rate percentage"""
        total = self.total_plants
        if total == 0:
            return 0.0
        return round((self.no_survived / total) * 100, 2)


# ─────────────────────────────────────────────
# REASON (Audit Trail)
# ─────────────────────────────────────────────
class Reason(models.Model):
    """Model for tracking rejection/approval reasons (audit trail)"""

    STATUS_CHOICES = [
        ('for_evaluation', 'For Evaluation'),
        ('for_head', 'For Head'),
        ('accepted', 'Accepted'),
        ('rejected', 'Rejected'),
        ('cancelled', 'Cancelled'),
        ('under_monitoring', 'Under Monitoring'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]

    STATUS_LAYER_CHOICES = [
        ('new_program', 'New Program'),
        ('report', 'Report'),
        ('seedling_request', 'Seedling Request'),
    ]

    # Primary Key
    reason_id = models.AutoField(primary_key=True)

    # Status Layer - what is this reason for?
    status_layer = models.CharField(
        max_length=50,
        choices=STATUS_LAYER_CHOICES,
        default='new_program'
    )

    # Foreign Keys
    application = models.ForeignKey(
        Application,
        on_delete=models.CASCADE,
        related_name='reasons',
        null=True,
        blank=True
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='reasons'
    )

    # Reason Details
    reason = models.TextField(
        help_text="Reason for rejection/cancellation/approval"
    )
    status = models.CharField(
        max_length=50,
        choices=STATUS_CHOICES,
        default='for_evaluation'
    )

    # Timestamps
    created = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Reason"
        verbose_name_plural = "Reasons"
        ordering = ['-created']
        indexes = [
            models.Index(fields=['application', 'status']),
            models.Index(fields=['user', 'status']),
        ]

    def __str__(self):
        app_title = self.application.title if self.application else "N/A"
        return f"Reason for {app_title} - {self.get_status_display()}"