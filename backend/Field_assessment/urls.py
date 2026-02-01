from django.urls import path
from . import views


urlpatterns = [
    path('get_assigned_list/', views.get_assigned_list, name='get_assigned_list'),
    path('assign_inspector/', views.assign_inspector, name='assign_inspector'),
]
