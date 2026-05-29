from django.urls import path
from . import views
from . import extended_views

urlpatterns = [
    # ─────────────────────────────────────────
    # SITE MANAGEMENT (Core - [KEEP])
    # ─────────────────────────────────────────
    path('get_sites/<int:reforestation_area_id>/', views.get_sites, name='get_sites'),
    path('sites/create_site/', views.create_site, name='create_site'),
    path('list_sites/<int:reforestation_area_id>/', views.get_sites_list, name='get_sites_list'),
    path('get_site/<int:site_id>/', views.get_site, name='get_site'),
    path('update_polygon/<int:site_id>/', views.save_site_polygon, name='save_site_polygon'),
    path('delete_site/<int:site_id>/', views.delete_site, name='delete_site'),
    path('toggle_pin/<int:site_id>/', views.toggle_pin, name='toggle_pin'),
    
    # ─────────────────────────────────────────
    # MCDA VALIDATION (Simplified Workflow)
    # ─────────────────────────────────────────
    
    # ✅ NEW: Save validation draft (decision notes only)
    path('site/<int:site_id>/validation/draft/', views.save_validation_draft, name='save_validation_draft'),
    
    # ✅ UPDATED: Finalize site (ONE Accept/Reject decision)
    path('site/<int:site_id>/validation/finalize/', views.finalize_site, name='finalize_site'),
    
    # ✅ KEEP: Update species recommendations (used by Tree Grower module)
    path('update_species/<int:site_id>/', views.update_species_recommendations, name='update_species'),

    # ─────────────────────────────────────────
    # REMOVED (Simplified - No longer needed)
    # ─────────────────────────────────────────
    # ❌ path('update_layer/<int:site_id>/<str:layer_name>/', views.update_mcda_layer, name='update_mcda_layer'),
    #    Reason: Replaced by simpler save_validation_draft endpoint
    
    # ─────────────────────────────────────────
    # EXTENDED VIEWS (Field Assessment Integration)
    # ─────────────────────────────────────────
    path(
        'area/<int:reforestation_area_id>/restricted/',
        extended_views.get_restricted_zones_for_area,
        name='get_restricted_zones_for_area'
    ),
    path(
        'get_field_assessments_by_layer_mcda/<int:reforestation_area_id>/<str:layer_name>/',
        extended_views.get_field_assessments_by_layer_mcda,
        name='get_field_assessments_by_layer_mcda'
    ),
    path(
        'update_field_assessment_coordinate/',
        extended_views.update_field_assessment_coordinate,
        name='update_field_assessment_coordinate'
    ),
    
    # ✅ OPTIONAL: Add this if you want a dedicated endpoint for MCDA evidence review
    # path('site/<int:site_id>/field-evidence/', views.get_field_evidence_for_site, name='get_field_evidence_for_site'),
]