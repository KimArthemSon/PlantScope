from django.db import models
from accounts.models import User

class SecurityLog(models.Model):
  
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
        User,  
        null=True,
        blank=True,
        on_delete=models.SET_NULL
    )

    email = models.CharField(max_length=150)
    event_type = models.CharField(max_length=20, choices=EVENT_CHOICES)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp'] 

    def __str__(self):
       user_str = self.user.username if self.user else self.email
       return f"{user_str} - {self.event_type} - {self.timestamp}"
