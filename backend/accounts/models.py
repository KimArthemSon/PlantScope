from django.db import models

class User(models.Model):
    USER_ROLES = (
        ('CityENROHead', 'City ENRO Head'),
        ('FieldOfficer', 'Field Officer'),
        ('GISSpecialist', 'GIS Specialist'),
        ('treeGrowers', 'Tree growers'),
    )

    email = models.EmailField(unique=True)
    password = models.CharField(max_length=128) 
    user_role = models.CharField(max_length=30, choices=USER_ROLES, default='FieldOfficer')
    created_at = models.DateTimeField(auto_now_add=True)

    # Required for AbstractBaseUser
    is_active = models.BooleanField(default=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

class profile(models.Model):
    GENDER_CHOICES = [
        ('M', 'Male'),
        ('F', 'Female'),
        ('O', 'Other'),
    ]
    profile_id = models.BigAutoField(primary_key=True)
    
    users = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='profile'
    )

    first_name = models.CharField(max_length=50)
    middle_name = models.CharField(max_length=50)
    last_name = models.CharField(max_length=50)
    birthday = models.DateField()
    gender = models.CharField(max_length=1,choices=GENDER_CHOICES,default='O')
    contact = models.CharField(max_length=50)
    address = models.CharField(max_length=100)
    created_at = models.DateField(auto_now_add=True)
    profile_img = models.ImageField(upload_to='profile/')


