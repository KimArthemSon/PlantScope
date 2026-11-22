from django.db import models

# Create your models here.

class Barangay(models.Model):
    barangay_id = models.BigAutoField(primary_key=True)
    name = models.CharField(max_length=100, unique=True)
    description = models.CharField(max_length=255)
    coordinate = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)
    # Archived barangays are hidden from lists/dropdowns but kept so they can be restored
    is_archived = models.BooleanField(default=False, db_index=True)
    archived_at = models.DateTimeField(null=True, blank=True)
