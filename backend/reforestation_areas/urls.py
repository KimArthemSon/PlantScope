from django.urls import path
from . import views

urlpatterns = [
     
    path('get_reforestation_areas/', views.get_reforestation_areas, name="get_reforestation_areas"),
    path('get_reforestation_areas/<int:reforestation_area_id>/', views.get_reforestation_areas, name="get_reforestation_areas"),
    path('create_reforestation_areas/', views.create_reforestation_areas, name="create_reforestation_areas"),
    path('update_reforestation_areas/<int:reforestation_area_id>', views.update_reforestation_areas, name="update_reforestation_areas"),
    path('delete_reforestation_areas/<int:reforestation_area_id>', views.delete_reforestation_areas, name="delete_reforestation_areas"),
]
