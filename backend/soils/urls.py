from django.urls import path
from . import views

urlpatterns = [
    path('get_soils/',views.get_soils, name="get_soils"),
    path('get_soil/<int:soil_id>',views.get_soil, name="get_soil"),
    path('create_soil/',views.create_soil, name="create_soil"),
    path('update_soil/<int:soil_id>', views.update_soil, name="update_soil"),
    path('delete_soil/<int:soil_id>', views.delete_soil, name="delete_soil")
]