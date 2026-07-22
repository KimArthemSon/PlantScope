from django.urls import path
from . import head_views, views, file_views,dashboard_views,request_views

urlpatterns = [
    # ─── APPLICATIONS ───────────────────────────────────────────────
    path('get_applications/', views.get_applications, name='get_applications'),
    path('get_application/<int:application_id>/', views.get_application, name='get_application'),
    path('get_ongoing_applications/', views.get_ongoing_applications, name='get_ongoing_applications'),
    path('get_tree_grower_application/', views.get_tree_grower_application, name='get_tree_grower_application'),
    # ─── WORKFLOW & STATUS TRANSITIONS ──────────────────────────────
    path('evaluate_application/<int:application_id>/', views.evaluate_application, name='evaluate_application'),
    path('confirm_application/<int:application_id>/', views.confirm_application, name='confirm_application'),
    path('complete_application/<int:application_id>/', views.complete_application, name='complete_application'),

    # ─── SEEDLING REQUESTS (Assistance / Additional) ────────────────
    path('create_seedling_request/', views.create_seedling_request, name='create_seedling_request'),
  

    # ─── PROGRESS REPORTS (Onsite Monitoring) ───────────────────────
    path('get_progress_reports/', views.get_progress_reports, name='get_progress_reports'),
   
    path('create_progress_report/', views.create_progress_report, name='create_progress_report'),
    path('update_progress_report/<int:report_id>/', views.update_progress_report, name='update_progress_report'),
    path('create_reapplication/', views.create_reapplication, name='create_reapplication'),
    path('get_tree_grower_application_history/', views.get_tree_grower_application_history, name='get_tree_grower_application_history'),

     # ─── CALENDAR / ORIENTATION DATES ───────────────────────────────
    path('get_orientation_dates/', views.get_orientation_dates, name='get_orientation_dates'),
    path('get_site_applications/<int:site_id>/', views.get_site_applications, name='get_site_applications'),
    path('get_general_report_data/', views.get_general_report_data, name='get_general_report_data'),
    path('get_program_history/', views.get_program_history, name='get_program_history'),
    path('delete_application/<int:application_id>/', views.delete_application, name='delete_application'),
    path('get_available_sites_for_tree_grower/', views.get_available_sites_for_tree_grower, name='get_available_sites_for_tree_grower'),
    path('application/<int:application_id>/download-maintenance-plan/', file_views.download_maintenance_plan, name='download_maintenance_plan'),
    path('get_seedling_analytics/', views.get_seedling_analytics, name='get_seedling_analytics'),
    path('get_geographic_analytics/', views.get_geographic_analytics, name='get_geographic_analytics'),
    path('get_monitoring_compliance/', views.get_monitoring_compliance, name='get_monitoring_compliance'),
    path('get_dashboard_data/', dashboard_views.get_dashboard_data, name='get_dashboard_data'),
    path('get_pending_dm_application_count/', dashboard_views.get_pending_dm_application_count, name='get_pending_dm_application_count'),
    path('get_pending_request_count/', dashboard_views.get_pending_request_count, name='get_pending_request_count'),

    #head
    path('get_head_dashboard_data/', head_views.get_head_dashboard_data, name='get_head_dashboard_data'),

    path('get_executive_summary/', head_views.get_executive_summary, name='get_executive_summary'),
    path('get_program_performance_report/', head_views.get_program_performance_report, name='get_program_performance_report'),
    path('get_species_performance_report/', head_views.get_species_performance_report, name='get_species_performance_report'),
    path('get_compliance_report/', head_views.get_compliance_report, name='get_compliance_report'),
    path('get_geographic_impact_report/', head_views.get_geographic_impact_report, name='get_geographic_impact_report'),
    path('get_audit_trail_report/', head_views.get_audit_trail_report, name='get_audit_trail_report'),
    path('get_pending_head_count/', head_views.get_pending_head_count, name='get_pending_head_count'),

    path('update_application_orientation/<int:application_id>/', views.update_application_orientation, name='update_application_orientation'),
    path('get_monitoring_stats/', views.get_monitoring_stats, name='get_monitoring_stats'),
     # In urls.py
    #   path('application/<int:application_id>/download-maintenance-plan-debug/', file_views.download_maintenance_plan_debug, name="download_maintenance_plan_debug"),

        # Tree Grower Endpoints
    path('requests/my-requests/', request_views.get_my_seedling_requests, name='get_my_seedling_requests'),
    path('requests/<int:request_id>/detail/', request_views.get_seedling_request_detail, name='get_seedling_request_detail'),
    path('requests/<int:request_id>/cancel/', request_views.cancel_seedling_request, name='cancel_seedling_request'),

    # DataManager Endpoints
    path('requests/manager-list/', request_views.get_manager_seedling_requests, name='get_manager_seedling_requests'),
    path('requests/inspectors/', request_views.get_available_inspectors, name='get_available_inspectors'), # ✅ ADDED THIS ONE
    path('requests/<int:request_id>/approve/', request_views.approve_seedling_request, name='approve_seedling_request'),
    path('requests/<int:request_id>/reject/', request_views.reject_seedling_request, name='reject_seedling_request'),

    # Onsite Inspector Endpoints
    path('requests/inspector-tasks/', request_views.get_inspector_seedling_tasks, name='get_inspector_seedling_tasks'),
    path('requests/<int:request_id>/confirm/', request_views.confirm_seedling_delivery, name='confirm_seedling_delivery'),
]