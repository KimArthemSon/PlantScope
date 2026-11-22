from django.db import models

class Animal(models.Model):
    animal_id = models.BigAutoField(primary_key=True)
    name = models.CharField(max_length=150, unique=True)  # Common name
    scientific_name = models.CharField(max_length=150, blank=True)
    description = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    # Archived records are hidden from lists/dropdowns but kept so they can be restored
    is_archived = models.BooleanField(default=False, db_index=True)
    archived_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'animals'
        ordering = ['-created_at']