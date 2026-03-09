from django.urls import path
from . import views
from . import onsite_views
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
    'get_field_assessments_by_area/<int:reforestation_area_id>/',
    views.get_field_assessments_by_area,
    name='get_field_assessments_by_area'
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
    )
]