from django.urls import path
from . import views

urlpatterns = [
     
    path('get_land_classifications_list/', views.get_land_classifications_list, name="get_land_classifications_list"),
    path('get_land_classifications/', views.get_land_classifications, name="get_land_classifications"),
    path('get_land_classification/<int:classification_id>/', views.get_land_classification, name="get_land_classification"),
    path('create_land_classification/', views.create_land_classification, name="create_land_classification"),
    path('update_land_classification/<int:classification_id>', views.update_land_classification, name="update_land_classification"),
    path('delete_land_classification/<int:classification_id>', views.delete_land_classification, name="delete_land_classification"),
    path('get_classified_areas/', views.get_classified_areas, name="get_classified_areas"),
    path('get_classified_area/<int:classified_area_id>', views.get_classified_area, name="get_classified_area"),
    path('create_classified_area/', views.create_classified_area, name="create_classified_area"),
    path('update_classified_area/<int:classified_area_id>', views.update_classified_area, name="update_classified_area"),
    path('delete_classified_area/<int:classified_area_id>', views.delete_classified_area, name="delete_classified_area"),
]
