from django.urls import path
from . import views

urlpatterns = [
    # ==========================
    # 📍 SITES CRUD & LISTING
    # ==========================
    path("get_sites/<int:reforestation_area_id>/", views.get_sites, name="get_sites"),
    path("get_site/<int:site_id>/", views.get_site, name="get_site"),
    path("create_site/", views.create_site, name="create_site"),
    path("update_site/<int:site_id>/", views.update_site, name="update_site"),
    path("delete_site/<int:site_id>/", views.delete_site, name="delete_site"),

    # ==========================
    # 🛠️ SITE METADATA & UTILITIES
    # ==========================
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
]