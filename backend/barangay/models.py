from django.db import models

# Create your models here.

class Barangay(models.Model):
    barangay_id = models.BigAutoField(primary_key=True)
    name = models.CharField(max_length=100, unique=True)
    description = models.CharField(max_length=255)
    coordinate = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)
    