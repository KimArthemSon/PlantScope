from django.db import models
from sites.models import Sites
from accounts.models import User
from django.core.validators import MaxValueValidator
import json


class Application(models.Model):
    """Application model for tree planting program requests"""
    
    STATUS_CHOICES = [
        ('for_evaluation', 'For Evaluation'),
        ('for_head', 'For Head'),
        ('accepted', 'Accepted'),
        # ('agreed', 'Agreed'),
        ('rejected', 'Rejected'),
        ('cancelled', 'Cancelled'),
        # ('under_monitoring', 'Under Monitoring'),
        ('completed', 'Completed'),
    ]
    
    CLASSIFICATION_CHOICES = [
        ('old', 'Old'),
        ('new', 'New'),
    ]
    
    # Primary Key
    application_id = models.AutoField(primary_key=True)
    
    # Foreign Keys
    # Site is assigned by DataManager during evaluation (nullable on submission)
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
    
    # Classification
    classification = models.CharField(
        max_length=50,
        choices=CLASSIFICATION_CHOICES,
        default='new'
    )
    
    # Basic Information
    title = models.CharField(max_length=255)
    description = models.TextField()
    total_members = models.IntegerField(
        null=True,
        blank=True,
        help_text="Total members in the tree grower group"
    )
    
    # Status and Workflow
    status = models.CharField(
        max_length=50,
        choices=STATUS_CHOICES,
        default='for_evaluation'
    )
    
    # Dates
    orientation_date = models.DateField(
        null=True, 
        blank=True,
        help_text="Assigned by DataManager during evaluation"
    )
    project_duration = models.IntegerField(
        null=True,
        blank=True,
        help_text="Project duration in days"
    )
    confirmed_at = models.DateField(
        null=True, 
        blank=True,
        help_text="Date when Head confirmed the application"
    )
    
    # Files
    maintenance_plan = models.FileField(
        upload_to='application_maintenance_plans/',
        blank=True,
        null=True,
        help_text="Maintenance plan uploaded by tree grower"
    )
    agreement_image = models.ImageField(
        upload_to='agreements/',
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
        ]

    def __str__(self):
        return f"{self.title} - {self.get_status_display()}"


class SeedlingRequest(models.Model):
    """Seedling request model - submitted WITH application for evaluation"""
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
        ('rejected', 'Rejected'),
    ]
    
    # Primary Key
    maintenance_report_id = models.AutoField(primary_key=True)
    
    # Foreign Key to Application
    application = models.ForeignKey(
        Application,
        on_delete=models.CASCADE,
        related_name='seedling_requests'
    )
    
    # Request Information
    description = models.TextField(
        blank=True,
        null=True,
        help_text="Additional details about seedling request"
    )
    request_file = models.FileField(
        upload_to='seedling_request_files/',
        blank=True,
        null=True,
        help_text="Supporting documents for seedling request"
    )
    
    # Seedling Details
    no_request_seedling = models.IntegerField(
        default=0,
        help_text="Number of seedlings requested"
    )
    seedling_type = models.JSONField(
        default=dict,
        null=True,
        blank=True,
        
    )
    
    # Status
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending'
    )
    reason_accepted = models.TextField(
        blank=True,
        null=True,
        help_text="Reason/notes when accepted"
    )
    
    # Timestamps
    submitted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = "Seedling Request"
        verbose_name_plural = "Seedling Requests"
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['application', 'status']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"Seedling Request for {self.application.title} - {self.status}"

    def save(self, *args, **kwargs):
        """Auto-set submitted_at on first save"""
        if not self.submitted_at:
            from django.utils import timezone
            self.submitted_at = timezone.now()
        super().save(*args, **kwargs)


class ProgressReport(models.Model):
    """Progress report model for ongoing monitoring after application acceptance"""
    
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
    
    # Monitoring Data
    no_survived_plants = models.IntegerField(
        default=0,
        help_text="Number of plants that survived"
    )
    no_dead_plants = models.IntegerField(
        default=0,
        help_text="Number of plants that died"
    )
    
    # Proof and Documentation
    proof_image_monitor_required = models.ImageField(
        upload_to='progress_report_proof_images/',
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
        return f"Progress Report for {self.application.title} - {self.status}"

    def save(self, *args, **kwargs):
        """Auto-set submitted_at on first save"""
        if not self.submitted_at:
            from django.utils import timezone
            self.submitted_at = timezone.now()
        super().save(*args, **kwargs)


class Reason(models.Model):
    """Model for tracking rejection/approval reasons"""
    
    STATUS_CHOICES = [
        ('for_evaluation', 'For Evaluation'),
        ('for_head', 'For Head'),
        ('accepted', 'Accepted'),
        ('agreed', 'Agreed'),
        ('rejected', 'Rejected'),
        ('cancelled', 'Cancelled'),
        ('under_monitoring', 'Under Monitoring'),
        ('completed', 'Completed'),
    ]
    
    STATUS_LAYER_CHOICES = [
        ('new_program', 'New Program'),
        ('report', 'Report'),
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