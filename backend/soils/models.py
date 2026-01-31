from django.db import models

# Create your models here.

class Soils(models.Model):
    
    soil_id = models.BigAutoField(primary_key=True)
    name = models.CharField(max_length=100, null=False, blank=False, unique=True)
    description = models.CharField(max_length=255,null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    