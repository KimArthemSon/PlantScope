from django.db import models
from accounts.models import User


class SecurityLog(models.Model):
    """Authentication & session events only."""

    LOGIN_SUCCESS = 'SUCCESS'
    LOGIN_FAILED = 'FAILED'
    LOGOUT = 'LOGOUT'
    PASSWORD_CHANGE = 'PWD_CHANGE'

    EVENT_CHOICES = [
        (LOGIN_SUCCESS, 'Login Success'),
        (LOGIN_FAILED, 'Login Failed'),
        (LOGOUT, 'Logout'),
        (PASSWORD_CHANGE, 'Password Change'),
    ]

    user = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.CASCADE
    )
    email = models.CharField(max_length=150)
    event_type = models.CharField(max_length=20, choices=EVENT_CHOICES)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.email} - {self.event_type} - {self.timestamp}"


class ActivityLog(models.Model):
    """Every user-initiated action: auth events, CRUD, and business operations."""

    # Auth
    LOGIN = 'LOGIN'
    LOGOUT = 'LOGOUT'
    PASSWORD_CHANGE = 'PWD_CHANGE'
    # CRUD
    CREATE = 'CREATE'
    UPDATE = 'UPDATE'
    DELETE = 'DELETE'
    # Business
    APPROVE = 'APPROVE'
    REJECT = 'REJECT'
    SUBMIT = 'SUBMIT'
    STATE_CHANGE = 'STATE_CHANGE'

    ACTION_CHOICES = [
        (LOGIN, 'Login'),
        (LOGOUT, 'Logout'),
        (PASSWORD_CHANGE, 'Password Change'),
        (CREATE, 'Create'),
        (UPDATE, 'Update'),
        (DELETE, 'Delete'),
        (APPROVE, 'Approve'),
        (REJECT, 'Reject'),
        (SUBMIT, 'Submit'),
        (STATE_CHANGE, 'State Change'),
    ]

    performed_by = models.ForeignKey(
        User, null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='activity_logs'
    )
    performed_by_email = models.CharField(max_length=150)
    action_type = models.CharField(max_length=20, choices=ACTION_CHOICES)
    entity_type = models.CharField(max_length=100, blank=True)
    entity_id = models.IntegerField(null=True, blank=True)
    entity_label = models.CharField(max_length=255, blank=True)
    description = models.TextField(blank=True)
    old_data = models.JSONField(null=True, blank=True)
    new_data = models.JSONField(null=True, blank=True)
    changed_fields = models.JSONField(null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.performed_by_email} - {self.action_type} - {self.entity_type}#{self.entity_id} - {self.timestamp}"
