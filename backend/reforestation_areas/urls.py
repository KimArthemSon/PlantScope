from django.urls import path
from . import views
from . import views_ndvi
from . import views_fire
from . import report_views

urlpatterns = [
    # ═══════════════════════════════════════════════════════════
    # 🌳 REFORESTATION AREA CRUD (Core Container Only)
    # ═══════════════════════════════════════════════════════════
    path('get_all_reforestation_areas/', views.get_all_reforestation_areas, name="get_all_reforestation_areas"),
    path('get_reforestation_areas/', views.get_reforestation_areas, name="get_reforestation_areas"),
    path('get_reforestation_area/<int:reforestation_area_id>/', views.get_reforestation_area, name="get_reforestation_area"),
    path('create_reforestation_areas/', views.create_reforestation_areas, name="create_reforestation_areas"),
    path('update_reforestation_areas/<int:reforestation_area_id>/', views.update_reforestation_areas, name="update_reforestation_areas"),
    path('delete_reforestation_areas/<int:reforestation_area_id>/', views.delete_reforestation_areas, name="delete_reforestation_areas"),

   

    # ═══════════════════════════════════════════════════════════
    # 🌐 NDVI & FIRE DATA ENDPOINTS
    # ═══════════════════════════════════════════════════════════
    path('ndvi/', views_ndvi.ndvi_canopy, name='ndvi_canopy'),
    path('suitable-sites/', views_ndvi.suitable_sites, name='suitable_sites'),
    path('ndvi-trend/', views_ndvi.ndvi_trend, name='ndvi_trend'),
    
    path('firms-fire-data/', views_fire.get_firms_fire_data, name='firms_fire_data'),
    path('firms-fire-count/', views_fire.get_firms_fire_count, name='firms_fire_count'),

     path('gis_specialist_dashboard/', report_views.get_gis_specialist_dashboard, name='gis_specialist_dashboard'),
     path('gis_assessments_list/', report_views.get_gis_assessments_list, name='gis_assessments_list'),
      path('gis_dashboard/', report_views.get_gis_dashboard, name='gis_dashboard'),
      path('gis_sites_list/', report_views.get_gis_sites_list, name='gis_sites_list'),
]