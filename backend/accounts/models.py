from django.db import models

class User(models.Model):
    USER_ROLES = (
        ('CityENROHead', 'City ENRO Head'),
        ('FieldOfficer', 'Field Officer'),
        ('AFA', 'Agricultural Field Assessor (AFA)'),
        ('GISSpecialist', 'GIS Specialist'),
        ('MonitoringOfficer', 'Monitoring Officer'),
    )

    email = models.EmailField(unique=True)
    username = models.CharField(max_length=50)
    password = models.CharField(max_length=128) 
    user_role = models.CharField(max_length=30, choices=USER_ROLES, default='FieldOfficer')
    created_at = models.DateTimeField(auto_now_add=True)

    # Required for AbstractBaseUser
    is_active = models.BooleanField(default=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    def __str__(self):
        return self.email
