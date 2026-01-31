from django.urls import path
from . import views

urlpatterns = [

    path('get_recent_logs/',views.get_recent_logs, name='get_recent_logs')
]