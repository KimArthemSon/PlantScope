from django.urls import path
from . import views
from . import extended_views
urlpatterns = [
    # ==========================
    # 📍 SITES CRUD & LISTING
    # ==========================
    path("get_sites/<int:reforestation_area_id>/", views.get_sites, name="get_sites"),
    path("get_site/<int:site_id>/", views.get_site, name="get_site"),
    path("create_site/", views.create_site, name="create_site"),
    path("update_site/<int:site_id>/", views.update_site, name="update_site"),
    path("delete_site/<int:site_id>/", views.delete_site, name="delete_site"),

   
    path("toggle_pin/<int:site_id>/", views.toggle_pin, name="toggle_pin"),
    path("update_site_coordinates/", views.update_site_coordinates, name="update_site_coordinates"),
    path("update_species_recommendations/<int:site_id>/", views.update_species_recommendations, name="update_species_recommendations"),
    

    # ==========================
    # 📋 MCDA WORKFLOW (3-Layer Validation - PLANTSCOPE v5.0)
    # ==========================
    # 1. Inspector submits raw field observations for a layer
    path("submit_field_assessment/<int:site_id>/<str:layer_name>/", 
         views.submit_field_assessment, 
         name="submit_field_assessment"),
         
    # 2. GIS Specialist validates a layer with manual ACCEPT/REJECT decision
    path("validate_mcda_layer/<int:site_id>/<str:layer_name>/", 
         views.validate_mcda_layer, 
         name="validate_mcda_layer"),
         
    # 3. GIS Specialist locks the record once all 3 layers are validated (v5.0 cascade logic)
    path("finalize_site_mcda/<int:site_id>/", 
         views.finalize_site_mcda, 
         name="finalize_site_mcda"),
#          path(
#     'area/<int:reforestation_area_id>/restricted-zones/',
#     views.get_restricted_zones_for_area,
#     name='get_restricted_zones_for_area'
# ),
#    path('area/<int:reforestation_area_id>/restricted-zones/', views.get_restricted_zones_for_area, name='get_restricted_zones_for_area'),
#    path('site/<int:site_id>/available-assessments/', views.get_available_field_assessments_for_site, name='get_available_field_assessments_for_site'),
#    path('site/<int:site_id>/link-assessment/', views.link_field_assessment_to_site, name='link_field_assessment_to_site'),
#    path('site/<int:site_id>/assign-coordinates/<str:layer_name>/', views.assign_validated_coordinates, name='assign_validated_coordinates'),
#    path('site/<int:site_id>/update-polygon/', views.update_polygon_with_area, name='update_polygon_with_area'),
   
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
]