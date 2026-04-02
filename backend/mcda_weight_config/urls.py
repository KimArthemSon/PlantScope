from django.urls import path
from . import views

urlpatterns = [
    path('get_mcda_config/', views.get_mcda_config, name='get_mcda_config'),
    path('update_mcda_config/<str:layer_name>/', views.update_mcda_config, name='update_mcda_config'),
]
