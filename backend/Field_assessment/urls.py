from django.urls import path
from . import views
from . import onsite_views
# from . import multicriteria_views
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

     # --- Inspector Dashboard ---
    path(
        'get_assigned_reforestation_area/',
        onsite_views.get_assigned_reforestation_area,
        name='get_assigned_reforestation_area'
    ),

    # --- Field Assessment CRUD ---
    # Get all assessments (optional filter by type in query params or url)
    path(
        'get_field_assessments/',
        onsite_views.get_field_assessments,
        name='get_field_assessments'
    ),
    
    # Get assessments filtered by specific type (e.g., /safety/)
    path(
        'get_field_assessments/<str:multicriteria_type>/',
        onsite_views.get_field_assessments,
        name='get_field_assessments_by_type'
    ),
    
    path('get_field_assessment/<int:field_assessment_id>/', onsite_views.get_field_assessment_detail_view, name='assessment-detail'),

    # Create a new assessment (Draft)
    path(
        'create_field_assessment/',
        onsite_views.create_field_assessment,
        name='create_field_assessment'
    ),
    
    # Update an existing assessment (Draft only)
    path(
        'update_field_assessment/<int:field_assessment_id>/',
        onsite_views.update_field_assessment,
        name='update_field_assessment'
    ),
    
    # Delete an assessment (Draft only)
    path(
        'delete_field_assessment/<int:field_assessment_id>/',
        onsite_views.delete_field_assessment,
        name='delete_field_assessment'
    ),

    # --- Submission Workflow ---
    # Submit or Un-submit (Lock/Unlock)
    path(
        'update_field_assessment_is_sent/<int:field_assessment_id>/',
        onsite_views.update_field_assessment_is_sent,
        name='update_field_assessment_is_sent'
    ),

    # --- Images ---
    # Upload image to a specific assessment
    path(
        'upload_field_assessment_image/<int:field_assessment_id>/',
        onsite_views.upload_field_assessment_image,
        name='upload_field_assessment_image'
    ),

    # --- Details (Tree/Soil Links) ---
    # Get linked details for an assessment
    path(
        'get_field_assessment_details/<int:field_assessment_id>/',
        onsite_views.get_field_assessment_details,
        name='get_field_assessment_details'
    ),
    # Link a tree/soil to an assessment
    path(
        'create_field_detail/',
        onsite_views.create_field_detail,
        name='create_field_detail'
    ),
    # Remove a link
    path(
        'delete_field_detail/<int:field_assessment_detail_id>/',
        onsite_views.delete_field_detail,
        name='delete_field_detail'
    ),

  ]