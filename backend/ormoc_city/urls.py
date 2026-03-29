from django.urls import path
from . import views

urlpatterns = [
    path('update_ormoc_city/', views.update_ormoc_city, name ='update_ormoc_city'),
    path('get_ormoc/', views.get_ormoc, name ='get_ormoc'),
]