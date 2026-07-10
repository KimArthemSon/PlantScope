from django.urls import path
from . import views

urlpatterns = [
    path('get_hazard_areas_list/', views.get_hazard_areas_list, name="get_hazard_areas_list"),
    path('get_hazard_areas/', views.get_hazard_areas, name="get_hazard_areas"),
    path('get_hazard_area/<int:hazard_area_id>/', views.get_hazard_area, name="get_hazard_area"),
    path('create_hazard_area/', views.create_hazard_area, name="create_hazard_area"),
    path('update_hazard_area/<int:hazard_area_id>/', views.update_hazard_area, name="update_hazard_area"),
    path('delete_hazard_area/<int:hazard_area_id>/', views.delete_hazard_area, name="delete_hazard_area"),
    
    # Dedicated endpoint to fetch hazards for a specific barangay
    path(
        'barangay/<int:barangay_id>/hazard-areas/', 
        views.get_hazard_areas_by_barangay, 
        name='get_hazard_areas_by_barangay'
    ),

     path('get_all_hazard_polygons/', views.get_all_hazard_polygons, name='get_all_hazard_polygons'),
]