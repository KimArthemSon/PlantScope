from django.urls import path
from . import views, treegrowers_views, emailviews, notification_views

urlpatterns = [
    # Basic user management
    path('register/', views.register_user, name='register'),
    path('login/', views.login_user, name='login'),
    path('logout/', views.logout_user, name='logout'),
    path('list_users/', views.list_users, name='list_users'),
    path('get_me/', views.get_me, name="get_me"),
    path('update_user/<int:user_id>', views.update_user, name='update_user'),
    path('delete_user/<int:user_id>', views.delete_user, name='delete_user'),
    path('get_user/<int:user_id>', views.get_user, name='get_user'),
    path('toggle_user_status/<int:user_id>/', views.toggle_user_status, name='toggle_user_status'),
    
    # Tree grower specific
    path('register_tree_grower/', treegrowers_views.register_tree_grower, name='register_tree_grower'),
    path('list_tree_growers/', views.list_tree_growers, name='list_tree_growers'),
    path('get_tree_grower_detail/<int:user_id>/', views.get_tree_grower_detail, name='get_tree_grower_detail'),
    path('update_tree_grower/<int:user_id>/', treegrowers_views.update_tree_grower, name='update_tree_grower'),

    # Email OTP
    path('send_otp/', emailviews.send_otp, name='send_otp'),
    path('verify_otp/', emailviews.verify_otp, name='verify_otp'),

    # Notifications
    path('notifications/', notification_views.get_notifications, name='get_notifications'),
    path('notifications/unread-count/', notification_views.get_unread_notification_count, name='get_unread_notification_count'),
    path('notifications/<int:notification_id>/read/', notification_views.mark_notification_read, name='mark_notification_read'),
    path('notifications/mark-all-read/', notification_views.mark_all_notifications_read, name='mark_all_notifications_read'),
    path('notifications/<int:notification_id>/', notification_views.delete_notification, name='delete_notification'),

]