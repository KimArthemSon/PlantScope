from django.db import models
from cloudinary.models import CloudinaryField

# ─────────────────────────────────────────────
# USER (Authentication & Roles)
# ─────────────────────────────────────────────
class User(models.Model):
    """Core user model for authentication and role management"""
    USER_ROLES = (
        ('CityENROHead', 'City ENRO Head'),
        ('OnsiteInspector', 'Onsite Inspector'),
        ('GISSpecialist', 'GIS Specialist'),
        ('treeGrowers', 'Tree Growers'),
        ('DataManager', 'DataManager'),
    )

    email = models.EmailField(unique=True)
    password = models.CharField(max_length=128)
    user_role = models.CharField(max_length=30, choices=USER_ROLES, default='OnsiteInspector')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    def __str__(self):
        return f"{self.email} ({self.get_user_role_display()})"

    class Meta:
        verbose_name = "User"
        verbose_name_plural = "Users"
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['email']),
            models.Index(fields=['user_role']),
        ]


# ─────────────────────────────────────────────
# PROFILE (Personal Information)
# ─────────────────────────────────────────────
class profile(models.Model):
    """Personal profile linked to a User account"""
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
    middle_name = models.CharField(max_length=50, blank=True, default='')
    last_name = models.CharField(max_length=50)
    gender = models.CharField(max_length=1, choices=GENDER_CHOICES, default='O')
    contact = models.CharField(max_length=50)
    address = models.CharField(max_length=100)

    # ✅ Made optional for Tree Growers
    birthday = models.DateField(null=True, blank=True)
    profile_img = CloudinaryField('image', folder='profile', null=True, blank=True)


    created_at = models.DateField(auto_now_add=True)

    class Meta:
        verbose_name = "Profile"
        verbose_name_plural = "Profiles"

    def __str__(self):
        return f"{self.first_name} {self.last_name}"


# ─────────────────────────────────────────────
# TREE GROWER GROUP (Formerly Organization)
# ─────────────────────────────────────────────
class TreeGrowerGroup(models.Model):
    """
    Represents a group of tree growers applying for a tree planting program.
    Can be a formal organization, community group, or informal group (min 2 members).
    """
    GROUP_TYPE_CHOICES = [
        ('formal_org', 'Formal Organization'),
        ('community_group', 'Community Group'),
        ('informal_group', 'Informal Group'),
    ]

    group_id = models.BigAutoField(primary_key=True)

    # ✅ Renamed from organization_name
    group_name = models.CharField(max_length=255)

    # ✅ One-to-one with User (the group representative/leader)
    users = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='tree_grower_group'
    )

    # ✅ Removed 'email' field - uses User's email instead
    group_type = models.CharField(
        max_length=30,
        choices=GROUP_TYPE_CHOICES,
        default='informal_group',
        help_text="Classification of the tree grower group"
    )

    address = models.TextField()
    contact = models.CharField(max_length=255)

    # ✅ Now optional
    profile_img = CloudinaryField('image', folder='group_profiles', null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Tree Grower Group"
        verbose_name_plural = "Tree Grower Groups"
        ordering = ['group_name']
        indexes = [
            models.Index(fields=['group_type']),
        ]

    def __str__(self):
        return f"{self.group_name} ({self.get_group_type_display()})"