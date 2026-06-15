from django.urls import path
from . import views

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
    path('get_seedling_requests/', views.get_seedling_requests, name='get_seedling_requests'),
    path('create_seedling_request/', views.create_seedling_request, name='create_seedling_request'),
    path('update_seedling_request/<int:request_id>/', views.update_seedling_request, name='update_seedling_request'),
    path('delete_seedling_request/<int:request_id>/', views.delete_seedling_request, name='delete_seedling_request'),

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
    
]