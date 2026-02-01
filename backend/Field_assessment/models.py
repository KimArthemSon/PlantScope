from django.db import models
from accounts.models import User
from reforestation_areas.models import Reforestation_areas
# Create your models here.
class Assigned_onsite_inspector(models.Model):
    assigned_onsite_inspector_id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='assigned_onsite_inspector'
    )
    reforestation_area = models.ForeignKey(
        Reforestation_areas,
        on_delete=models.CASCADE,
        related_name='assigned_onsite_inspector'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'reforestation_area'],
                name='unique_user_reforestation_assignment'
            )
        ]

# class Field_assessment()
# class Field_assessment_details()
