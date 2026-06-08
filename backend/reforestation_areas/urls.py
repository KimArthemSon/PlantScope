from django.urls import path
from . import views
from . import views_ndvi
from . import views_fire
from . import hazard_analysis
urlpatterns = [
    # ═══════════════════════════════════════════════════════════
    # 🌳 EXISTING CRUD ENDPOINTS
    # ═══════════════════════════════════════════════════════════
    path('get_all_reforestation_areas/', views.get_all_reforestation_areas, name="get_all_reforestation_areas"),
    path('get_reforestation_areas/', views.get_reforestation_areas, name="get_reforestation_areas"),
    path('get_reforestation_area/<int:reforestation_area_id>/', views.get_reforestation_area, name="get_reforestation_area"),
    path('create_reforestation_areas/', views.create_reforestation_areas, name="create_reforestation_areas"),
    path('update_reforestation_areas/<int:reforestation_area_id>/', views.update_reforestation_areas, name="update_reforestation_areas"),
    path('delete_reforestation_areas/<int:reforestation_area_id>/', views.delete_reforestation_areas, name="delete_reforestation_areas"),
    path('get_potential_sites/', views.get_potential_sites, name="get_potential_sites"),
    path('get_potential_site/<int:potential_sites_id>/', views.get_potential_site, name="get_potential_site"),
    path('delete_potential_site/<int:potential_sites_id>/', views.delete_potential_site, name="delete_potential_site"),
    path('potential-sites/bulk-create/', views.bulk_create_potential_sites, name='bulk_create_potential_sites'),
    path('permits/<int:reforestation_area_id>/list/', views.list_permits, name='list_permits'),
    path('permits/<int:reforestation_area_id>/upload/', views.upload_permit, name='upload_permit'),
    path('permits/<int:permit_id>/delete/', views.delete_permit, name='delete_permit'),
    path('reforestation-areas/<int:reforestation_area_id>/verification/', views.get_area_verification, name='get_area_verification'),
    path('update_reforestation-areas/<int:reforestation_area_id>/verification/', views.update_area_verification, name='update_area_verification'),

    # ═══════════════════════════════════════════════════════════
    # 🗺️ NDVI ENDPOINTS
    # ═══════════════════════════════════════════════════════════
    path('ndvi/', views_ndvi.ndvi_canopy, name='ndvi_canopy'),
    path('suitable-sites/', views_ndvi.suitable_sites, name='suitable_sites'),
    path('ndvi-trend/', views_ndvi.ndvi_trend, name='ndvi_trend'),

    # # ═══════════════════════════════════════════════════════════
    # # 🛡️ HAZARD ENDPOINTS (Storm Surge & Seismic REMOVED)
    # # ═══════════════════════════════════════════════════════════
    # path('landslide-risk/', views_hazard.landslide_risk_map, name='landslide_risk_map'),
    # # path('flood-risk/', views_hazard.flood_risk_map, name='flood_risk_map'),
    # # path('wildfire-risk/', views_hazard.wildfire_risk_map, name='wildfire_risk_map'),
    
    # # path('landslide-prone-sites/', views_hazard.extract_landslide_prone, name='extract_landslide_prone'),
    # # path('flood-prone-sites/', views_hazard.extract_flood_prone, name='extract_flood_prone'),
    # path('wildfire-prone-sites/', views_hazard.extract_wildfire_prone, name='extract_wildfire_prone'),
    # path('hazard-prone-sites/bulk-create/', views_hazard.bulk_create_hazard_sites, name='bulk_create_hazard_sites'),
    # path('debug-landslide-extraction/', views_hazard.debug_landslide_extraction, name='debug_landslide_extraction'),

     path('firms-fire-data/', views_fire.get_firms_fire_data, name='firms_fire_data'),
    path('firms-fire-count/', views_fire.get_firms_fire_count, name='firms_fire_count'),
     path('barangay-hazard-analysis/<int:barangay_id>/', 
         hazard_analysis.analyze_barangay_hazards, 
         name='barangay_hazard_analysis'),
    
]