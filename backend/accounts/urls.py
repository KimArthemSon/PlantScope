from django.urls import path
from . import viewsMap
from . import views

urlpatterns = [
    path('register/', views.register_user, name='register'),
    path('login/', views.login_user, name='login'),
    path('logout/',views.logout_user, name='logout'),
    path('list_users/', views.list_users, name='list_users'),
    path('get_me/', views.get_me, name="get_me"),
    path('update_user/<int:user_id>', views.update_user, name='update_user'),
    path('delete_user/<int:user_id>', views.delete_user, name='delete_user'),
    path('ndvi/', viewsMap.ndvi_canopy, name="ndvi_canopy"),
    path('suitable-sites/', viewsMap.suitable_sites, name='suitable_sites'),
    path('get_user/<int:user_id>',views.get_user, name='get_user')
]


