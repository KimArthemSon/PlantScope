from django.urls import path
from . import views, extended_views, views_matrix, update_views, treeGrowers_sties_views, potentialsite_views,hazardreports_views


urlpatterns = [
    # ─────────────────────────────────────────
    # SITE MANAGEMENT (Core)
    # ─────────────────────────────────────────
    path('get_sites/<int:reforestation_area_id>/', views.get_sites, name='get_sites'),
    path('sites/create_site/', views.create_site, name='create_site'),
    path('list_sites/<int:reforestation_area_id>/', views.get_sites_list, name='get_sites_list'),
    path('get_site/<int:site_id>/', views.get_site, name='get_site'),
    path('update_polygon/<int:site_id>/', views.save_site_polygon, name='save_site_polygon'),
    path('delete_site/<int:site_id>/', views.delete_site, name='delete_site'),
    path('toggle_pin/<int:site_id>/', views.toggle_pin, name='toggle_pin'),
    path('update_species/<int:site_id>/', views.update_species_recommendations, name='update_species'),
    path('get_all_sites/', views.get_all_sites, name='get_all_sites'),
    path('site/<int:site_id>/update_coordinates/', views.update_site_coordinates, name='update_site_coordinates'),
    # ─────────────────────────────────────────
    # MCDA VALIDATION (Simplified Workflow)
    # ─────────────────────────────────────────
    path('site/<int:site_id>/validation/draft/', views.save_validation_draft, name='save_validation_draft'),
    path('site/<int:site_id>/validation/finalize/', views.finalize_site, name='finalize_site'),

    # ─────────────────────────────────────────
    # ✅ SITE-LEVEL VERIFICATION & PERMITS
    # ─────────────────────────────────────────
    path('site/<int:site_id>/verification/', views.get_site_verification, name='get_site_verification'),
    path('site/<int:site_id>/verification/update/', views.update_site_verification, name='update_site_verification'),
    path('site/<int:site_id>/permits/', views.list_site_permits, name='list_site_permits'),
    path('site/<int:site_id>/permits/upload/', views.upload_site_permit, name='upload_site_permit'),
    path('site/permits/<int:permit_id>/delete/', views.delete_site_permit, name='delete_site_permit'),  # ✅ NEW

    # ─────────────────────────────────────────
    # EXTENDED VIEWS
    # ─────────────────────────────────────────
    path('area/<int:reforestation_area_id>/restricted/', extended_views.get_restricted_zones_for_area, name='get_restricted_zones_for_area'),
    path('get_field_assessments_by_layer_mcda/<int:reforestation_area_id>/<str:layer_name>/', extended_views.get_field_assessments_by_layer_mcda, name='get_field_assessments_by_layer_mcda'),
    path('update_field_assessment_coordinate/', extended_views.update_field_assessment_coordinate, name='update_field_assessment_coordinate'),
    path('get_area_details/<int:area_id>/', views_matrix.get_area_details, name='get_area_details'),

     # ✅ NEW: Site basic info update
    path('update_site_basic_info/<int:site_id>/', update_views.update_site_basic_info, name='update_site_basic_info'),
    
    # ✅ NEW: Site images management
    path('list_site_images/<int:site_id>/', update_views.list_site_images, name='list_site_images'),
    path('upload_site_image/<int:site_id>/', update_views.upload_site_image, name='upload_site_image'),
    path('delete_site_image/<int:site_image_id>/', update_views.delete_site_image, name='delete_site_image'),
     path('get_site_details_for_tree_grower/<int:site_id>/', treeGrowers_sties_views.get_site_details_for_tree_grower, name='get_site_details_for_tree_grower'),


      # ═══════════════════════════════════════════════════════════
    # 🎯 POTENTIAL SITES (NDVI Analytical Markers)
    # ═══════════════════════════════════════════════════════════
    path('get_potential_sites/', potentialsite_views.get_potential_sites, name="get_potential_sites"),
 
    path('delete_potential_site/<int:potential_sites_id>/', potentialsite_views.delete_potential_site, name="delete_potential_site"),
    path('potential-sites/bulk-create/', potentialsite_views.bulk_create_potential_sites, name='bulk_create_potential_sites'),
    path('potential-sites/update/<int:potential_sites_id>/', potentialsite_views.update_potential_site, name='update_potential_site'),
    path('analyze-hazard/', hazardreports_views.analyze_hazard_area, name='analyze_hazard_area'),
    path('get_available_sites/<int:reforestation_area_id>/', views.get_available_sites, name='get_available_sites')

]