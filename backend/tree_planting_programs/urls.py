from django.urls import path
from . import views
urlpatterns = [
    path('get_applications/', views.get_applications, name='get_applications'),
    path('get_tree_grower_application/', views.get_tree_grower_application, name='get_tree_grower_application'),
    path('get_application/<int:application_id>/', views.get_application, name='get_application'),
    path('evaluate_application/<int:application_id>/', views.evaluate_application, name='evaluate_application'),
    path('confirmation_application/<int:application_id>/', views.confirmation_application, name='confirmation_application'),
    path('create_maintenance_report/', views.create_maintenance_report, name='create_maintenance_report'),
    path('evaluate_miantenance_report/<int:maintenance_report_id>/', views.evaluate_miantenance_report, name='evaluate_miantenance_report'),
    path('confirmation_maintenance/<int:maintenance_report_id>/', views.confirmation_maintenance, name='confirmation_maintenance'),
    path('get_all_maintenance_reports/', views.get_all_maintenance_reports,name='get_all_maintenance_reports'),
    path('get_tree_grower_maintenance_reports/<int:application_id>/', views.get_tree_grower_maintenance_reports, name='get_tree_grower_maintenance_reports'),
    path('alert_tree_grower/', views.alert_tree_grower,name='alert_tree_grower'),
    path('get_notifications/', views.get_notifications, name='get_notifications'),
    path('mark_notification_read/<int:notification_id>/', views.mark_notification_read, name='mark_notification_read'),
    path('get_orientation_dates/', views.get_orientation_dates, name='get_orientation_dates'),

]
