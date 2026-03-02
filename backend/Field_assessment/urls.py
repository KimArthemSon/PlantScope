from django.urls import path
from . import views

urlpatterns = [
    path(
        'get_assigned_list/<int:reforestation_area_id>/',
        views.get_assigned_list,
        name='get_assigned_list'
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
]