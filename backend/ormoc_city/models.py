from django.db import models

# Create your models here.

class Ormoc_City(models.Model):
    ormoc_city_id = models.BigAutoField(primary_key=True)
    marker = models.JSONField()
    polygon = models.JSONField()
    