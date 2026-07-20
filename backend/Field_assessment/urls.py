from django.urls import path
from . import onsite_views, dashboard_views, views

urlpatterns = [
    # ── Web/Admin: Inspector Assignment Management ──────────────────────
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

    # ── Mobile: Fetch Assigned Areas ───────────────────────────────────
    path(
        'get_assigned_reforestation_area/',
        onsite_views.get_assigned_reforestation_area,
        name='get_assigned_reforestation_area'
    ),

    # ── Mobile: Field Assessment CRUD ──────────────────────────────────
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

    # ── Mobile: Submission Workflow ────────────────────────────────────
    path(
        'field_assessments/<int:field_assessment_id>/submit/',
        onsite_views.submit_field_assessment,
        name='submit_field_assessment'
    ),

    # ── Web/Admin: Head Override Actions ───────────────────────────────
    path(
        'field_assessments/<int:field_assessment_id>/unsent/',
        onsite_views.head_unsent_field_assessment,
        name='head_unsent_field_assessment'
    ),
    path(
        'field_assessments/<int:field_assessment_id>/head_delete/',
        onsite_views.head_delete_field_assessment,
        name='head_delete_field_assessment'
    ),

    # ── Mobile/Web: Image & Geocam Management ──────────────────────────
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

    # ── Web/GIS: Area-Level Assessment Retrieval ───────────────────────
   # ✅ GIS/ENRO Review endpoint (THIS IS WHAT YOU NEED):
    path('area/<int:reforestation_area_id>/meta-data/', onsite_views.get_area_meta_data, name='get_area_meta_data'),

    path('inspector/dashboard-stats/', dashboard_views.get_dashboard_stats, name='dashboard-stats'),
    path('inspector/recent-assessments/', dashboard_views.get_recent_assessments, name='recent-assessments'),
    path('inspector/assessments-over-time/', dashboard_views.get_assessments_over_time, name='assessments-over-time'),
    path('inspector/assigned-areas-summary/', dashboard_views.get_assigned_areas_summary, name='assigned-areas-summary'),
    path('inspector/layer-completion/', dashboard_views.get_layer_completion_detail, name='layer-completion'),

]