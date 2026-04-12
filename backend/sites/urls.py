from django.urls import path
from . import views
from . import extended_views
urlpatterns = [
    # Site Management

    path('sites/create_site/', views.create_site, name='create_site'),
    path('list_sites/<int:reforestation_area_id>/', views.get_sites_list, name='get_sites_list'),
    path('get_site/<int:site_id>/', views.get_site, name='get_site'),
    path('update_polygon/<int:site_id>/', views.save_site_polygon, name='save_site_polygon'),
    path('delete_site/<int:site_id>/', views.delete_site, name='delete_site'),
    path('toggle_pin/<int:site_id>/', views.toggle_pin, name='toggle_pin'),
    
    # MCDA Validation
    path('update_layer/<int:site_id>/<str:layer_name>/', views.update_mcda_layer, name='update_mcda_layer'),
    path('finalize_site/<int:site_id>/', views.finalize_site, name='finalize_site'),
    path('update_species/<int:site_id>/', views.update_species_recommendations, name='update_species'),

   path(
        'area/<int:reforestation_area_id>/restricted/',
        extended_views.get_restricted_zones_for_area,  # or views. if in views.py
        name='get_restricted_zones_for_area'
    ),
    path(
        'get_field_assessments_by_layer_mcda/<int:reforestation_area_id>/<str:layer_name>/',
        extended_views.get_field_assessments_by_layer_mcda,  # or views. if in views.py
        name='get_field_assessments_by_layer_mcda'
    ),
     path(
        'update_field_assessment_location/',
        extended_views.update_field_assessment_coordinate,  # or views. if in views.py
        name='update_field_assessment_coordinate'
    ),
]