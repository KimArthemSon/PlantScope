from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager
import hashlib

class UserManager(BaseUserManager):
    def create_user(self, email, password=None, user_role='FieldOfficer', **extra_fields):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email)
        user = self.model(email=email, user_role=user_role, **extra_fields)
        # Hash password using SHA-256
        user.password = hashlib.sha256(password.encode()).hexdigest()
        user.save(using=self._db)
        return user

class User(AbstractBaseUser):
    USER_ROLES = (
        ('Superadmin', 'Superadmin'),
        ('Researcher', 'Researcher'),
        ('FieldOfficer', 'FieldOfficer'),
    )

    email = models.EmailField(unique=True)
    username = models.CharField(max_length=50)
    user_role = models.CharField(max_length=20, choices=USER_ROLES, default='FieldOfficer')
    created_at = models.DateTimeField(auto_now_add=True)

    # Required for AbstractBaseUser
    is_active = models.BooleanField(default=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    objects = UserManager()

    def __str__(self):
        return self.email
