from django.urls import path
from . import views
urlpatterns = [
    path('get_applications/', views.get_applications, name='get_applications'),
    path('get_application/<int:application_id>/', views.get_application, name='get_application')
]
