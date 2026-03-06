from django.urls import path
from . import views

urlpatterns = [
    
    path('get_all_reforestation_areas/', views.get_all_reforestation_areas, name="get_all_reforestation_areas"),
    path('get_reforestation_areas/', views.get_reforestation_areas, name="get_reforestation_areas"),
    path('get_reforestation_area/<int:reforestation_area_id>/', views.get_reforestation_area, name="get_reforestation_area"),
    path('create_reforestation_areas/', views.create_reforestation_areas, name="create_reforestation_areas"),
    path('update_reforestation_areas/<int:reforestation_area_id>/', views.update_reforestation_areas, name="update_reforestation_areas"),
    path('delete_reforestation_areas/<int:reforestation_area_id>/', views.delete_reforestation_areas, name="delete_reforestation_areas"),

    path('get_potential_sites/', views.get_potential_sites, name="get_potential_sites"),
    path('get_potential_site/<int:potential_sites_id>/', views.get_potential_site, name="get_potential_site"),
    path('create_potential_site/', views.create_potential_site, name="create_potential_site"),
    path('update_potential_site/<int:potential_sites_id>/', views.update_potential_site, name="update_potential_site"),
    path('delete_potential_site/<int:potential_sites_id>/', views.delete_potential_site, name="delete_potential_site"),
]