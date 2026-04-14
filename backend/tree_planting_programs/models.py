from django.db import models
from sites.models import Sites
from accounts.models import User
from django.core.validators import MaxValueValidator
# Create your models here.
class Application(models.Model):
    """Application model for seedling requests"""
    
    # Status choices
    STATUS_CHOICES = [
        ('save_draft', 'Save Draft'),
        ('for_evaluation', 'For Evaluation'),
        ('for_head', 'For Head'),
        ('accepted', 'Accepted'),
        ('agreed', 'Agreed'),
        ('rejected', 'Rejected'),
        ('cancelled', 'Cancelled'),
        ('under_monitoring', 'Under Monitoring'),
        ('completed', 'Completed'),
    ]
    Classification_choices = [
        ('old', 'Old'),
        ('new', 'new'),
    ]
    
    classification =  models.CharField(
        max_length=50,
        choices=Classification_choices,
        default='old'
    )

    # Primary Key
    application_id = models.AutoField(primary_key=True)
    
    # Foreign Keys
    site = models.ForeignKey(
        Sites,
        on_delete=models.CASCADE,
        related_name='applications',
        null=True,
        blank=True
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='applications'
    )
    
    # Basic Information
    title = models.CharField(max_length=255)
    description = models.TextField()
    
    # Status and Workflow
    status = models.CharField(
        max_length=50,
        choices=STATUS_CHOICES,
        default='save_draft'
    )
    
    # Dates
    orientation_date = models.DateField(null=True, blank=True)
    project_duration = models.IntegerField(
        help_text="Project duration in days",
        null=True,
        blank=True
    )
    
    # Files
    maintenance_plan = models.FileField(
        upload_to='application_maintenance_plans/',
        blank=True,
        null=True
    )
    agreement_image = models.ImageField(
        upload_to='agreements/',
        blank=True,
        null=True
    )
   
    # Seedling and Area Metrics
    total_request_seedling = models.IntegerField(
        default=50,
        validators=[MaxValueValidator(50)],
        help_text="Total seedlings requested"
    )
    total_seedling_provided = models.IntegerField(
        default=0,
        help_text="Total seedlings provided"
    )
    total_area_planted = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        help_text="Total area planted (in hectares)"
    )
    total_seedling_survived = models.IntegerField(
        default=0,
        help_text="Total seedlings survived"
    )
    total_seedling_planted = models.IntegerField(
        default=0,
        help_text="Total seedlings actually planted"
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
        ]

    def __str__(self):
        return f"{self.title} - {self.get_status_display()}"

    def clean(self):
        """Validate that total_request_seedling doesn't exceed organization limit"""
        if self.tree_growers_members and self.tree_growers_members.organization:
            max_seedlings = self.tree_growers_members.organization.request_seedling_max
            if self.total_request_seedling > max_seedlings:
                from django.core.exceptions import ValidationError
                raise ValidationError(
                    f"Cannot request more than {max_seedlings} seedlings"
                )


class MaintenanceReport(models.Model):
    """Maintenance report model for tracking application progress"""
    
    # Status choices
    REPORT_STATUS_CHOICES = [
        ('completed', 'Completed'),
        ('continue', 'Continue'),
        ('rejected', 'Rejected'),
    ]

    # Primary Key
    maintenance_report_id = models.AutoField(primary_key=True)
    
    # Foreign Key to Application
    application = models.ForeignKey(
        Application,
        on_delete=models.CASCADE,
        related_name='maintenance_reports'
    )
    
    # Report Information
    title = models.CharField(max_length=255)
    description = models.TextField()
    
    # File Upload
    maintenance_report_file = models.FileField(
        upload_to='maintenance_reports/',
        blank=True,
        null=True
    )
    
    # Metrics
    total_seedling_planted = models.IntegerField(
        default=0,
        help_text="Total seedlings planted in this report period"
    )
    total_seedling_survived = models.IntegerField(
        default=0,
        help_text="Total seedlings survived in this report period"
    )
    total_area_planted = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        help_text="Total area planted in this report period (in hectares)"
    )
    total_owned_seedling_planted = models.IntegerField(
        default=0,
        help_text="Total owned seedlings planted"
    )
    
    # Status
    status = models.CharField(
        max_length=20,
        choices=REPORT_STATUS_CHOICES,
        default='continue'
    )
    
    # Timestamps
    submitted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Maintenance Report"
        verbose_name_plural = "Maintenance Reports"
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['application', 'status']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"{self.title} - {self.application.title}"

    def save(self, *args, **kwargs):
        """Auto-set submitted_at when status is completed"""
        if self.status == 'completed' and not self.submitted_at:
            from django.utils import timezone
            self.submitted_at = timezone.now()
        super().save(*args, **kwargs)

class SeedlingMax(models.Model):
    """Model for managing seedling maximum and minimum limits"""
    seedling_id = models.AutoField(primary_key=True)
    max = models.IntegerField(help_text="Maximum number of seedlings allowed")
    min = models.IntegerField(help_text="Minimum number of seedlings allowed")
    updated_at = models.DateTimeField(auto_now=True)
    created = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Seedling Max"
        verbose_name_plural = "Seedling Max Limits"
        ordering = ['-created']

    def __str__(self):
        return f"Seedling Limit: {self.min} - {self.max}"

    def clean(self):
        """Validate that max is greater than min"""
        from django.core.exceptions import ValidationError
        if self.max <= self.min:
            raise ValidationError("Maximum must be greater than minimum")


class Reason(models.Model):
    """Model for tracking rejection/cancellation reasons with status"""
    
    # Status choices (same as Application status)
    STATUS_CHOICES = [
        ('save_draft', 'Save Draft'),
        ('for_evaluation', 'For Evaluation'),
        ('for_head', 'For Head'),
        ('accepted', 'Accepted'),
        ('agreed', 'Agreed'),
        ('rejected', 'Rejected'),
        ('cancelled', 'Cancelled'),
        ('under_monitoring', 'Under Monitoring'),
        ('completed', 'Completed'),
    ]

    reason_id = models.AutoField(primary_key=True)
    application = models.ForeignKey(
        Application,
        on_delete=models.CASCADE,
        related_name='reasons'
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='reasons'
    )
    reason = models.TextField(help_text="Reason for rejection/cancellation")
    status = models.CharField(
        max_length=50,
        choices=STATUS_CHOICES,
        default='save_draft'
    )
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
        return f"Reason for {self.application.title} - {self.get_status_display()}"