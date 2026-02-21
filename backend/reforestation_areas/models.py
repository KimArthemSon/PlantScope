from django.db import models

# Create your models here.
class Reforestation_areas(models.Model):
    Safety_types = (
        ('safe', 'Low Risk'),
        ('slightly', 'Slightly Unsafe'),
        ('moderate', 'Moderate Risk'),
        ('danger','High Risk')
    )
    reforestation_area_id = models.BigAutoField(primary_key=True)
    name = models.CharField(max_length=100, unique=True)

    legality = models.BooleanField(default=True)
    safety = models.CharField(max_length=20, choices=Safety_types,default='danger')
    polygon_coordinate = models.JSONField(null=True)
    coordinate = models.JSONField(null=True)
    location = models.CharField(max_length=100)
    description = models.CharField(max_length=255)
    area_img = models.ImageField(upload_to='areas/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)



