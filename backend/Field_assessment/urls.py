from django.urls import path
from . import onsite_views
from . import views
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
        'assign_inspector/',
        views.assign_inspector,
        name='assign_inspector'
    ),

    # ── Assigned Areas ──────────────────────────────────────────────
    path(
        'get_assigned_reforestation_area/',
        onsite_views.get_assigned_reforestation_area,
        name='get_assigned_reforestation_area'
    ),

    # ── Field Assessment CRUD ───────────────────────────────────────
    path(
        'field_assessments/',
        onsite_views.get_field_assessments,
        name='get_field_assessments'
    ),
    path(
        'field_assessments/<int:field_assessment_id>/',
        onsite_views.get_field_assessment_detail,
        name='get_field_assessment_detail'
    ),
    path(
        'field_assessments/create/',
        onsite_views.create_field_assessment,
        name='create_field_assessment'
    ),
    path(
        'field_assessments/<int:field_assessment_id>/update/',
        onsite_views.update_field_assessment,
        name='update_field_assessment'
    ),
    path(
        'field_assessments/<int:field_assessment_id>/delete/',
        onsite_views.delete_field_assessment,
        name='delete_field_assessment'
    ),

    # ── Submission ──────────────────────────────────────────────────
    path(
        'field_assessments/<int:field_assessment_id>/submit/',
        onsite_views.submit_field_assessment,
        name='submit_field_assessment'
    ),

    # ── Images ──────────────────────────────────────────────────────
    path(
        'field_assessments/<int:field_assessment_id>/images/upload/',
        onsite_views.upload_field_assessment_image,
        name='upload_field_assessment_image'
    ),
    path(
        'field_assessments/images/<int:image_id>/delete/',
        onsite_views.delete_field_assessment_image,
        name='delete_field_assessment_image'
    ),
    path(
        'area/<int:reforestation_area_id>/meta_data/',
        onsite_views.get_area_meta_data,
        name='get_area_meta_data'
    ),
]