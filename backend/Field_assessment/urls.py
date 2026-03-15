from django.urls import path
from . import views
from . import onsite_views
from . import multicriteria_views
urlpatterns = [
    path(
        'get_assigned_list/<int:reforestation_area_id>/',
        views.get_assigned_list,
        name='get_assigned_list'
    ),
    path(
    'get_unassigned_inspectors/<int:reforestation_area_id>/',
    views.get_unassigned_inspectors,
    name='get_unassigned_inspectors'
    ),

    path(
    'get_field_assessments_legality_safety/<int:reforestation_area_id>/',
    views.get_field_assessments_legality_safety,
    name='get_field_assessments_legality_safety'
    ),
    path(
        'assign_inspector/',
        views.assign_inspector,
        name='assign_inspector'
    ),

    path(
        'get_field_assessments/<int:user_id>/',
        views.get_field_assessments,
        name='get_field_assessments'
    ),

    path(
        'get_field_assessment/<int:field_assessment_id>/',
        views.get_field_assessment,
        name='get_field_assessment'
    ),

    path(
        'create_field_assessment/',
        onsite_views.create_field_assessment,
        name='create_field_assessment'
    ),
    
    #multicriteria
    path(
        'get_field_assessments_safety/<int:site_id>/',
        multicriteria_views.get_field_assessments_safety,
        name='get_field_assessments_safety'
    ),
  
    path('get_field_assessments_legality/<int:site_id>/', 
     multicriteria_views.get_field_assessments_legality,
     name='get_field_assessments_legality'),

    path(
        'get_field_assessments_soil_quality/<int:site_id>/',
        multicriteria_views.get_field_assessments_soil_quality,
        name='get_field_assessments_soil_quality'
    ),
    path(
        'get_field_assessments_accessibility/<int:site_id>/',
        multicriteria_views.get_field_assessments_accessibility,
        name='get_field_assessments_accessibility'
    ),
    path(
        'get_field_assessments_slope/<int:site_id>/',
        multicriteria_views.get_field_assessments_slope,
        name='get_field_assessments_slope'
    ),
    path(
        'get_field_assessments_water_accessibility/<int:site_id>/',
        multicriteria_views.get_field_assessments_water_accessibility,
        name='get_field_assessments_water_accessibility'
    ),
    
    path('get_field_assessments_wildlife/<int:site_id>/', 
        multicriteria_views.get_field_assessments_wildlife,
        name='get_field_assessments_wildlife'
     ),

      path('get_sites/<int:site_id>/recent-assessments/', views.get_recent_field_assessments, name='get_recent_field_assessments'),
]