from django.urls import path
from . import views

urlpatterns = [
    path('get_recent_logs/',   views.get_recent_logs,   name='get_recent_logs'),
    path('get_activity_log/',  views.get_activity_log,  name='get_activity_log'),
]
