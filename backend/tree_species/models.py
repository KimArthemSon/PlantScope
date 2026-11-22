from django.db import models

# Create your models here.
class Tree_species(models.Model):
    tree_specie_id = models.BigAutoField(primary_key=True)
    name = models.CharField(max_length=150, unique=True)
    description = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    # Archived records are hidden from lists/dropdowns but kept so they can be restored
    is_archived = models.BooleanField(default=False, db_index=True)
    archived_at = models.DateTimeField(null=True, blank=True)
