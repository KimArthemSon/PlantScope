from django.urls import path
from . import views

urlpatterns = [
    path('get_animals/', views.get_animals, name="get_animals"),
    path('get_animal/<int:animal_id>', views.get_animal, name="get_animal"),
    path('create_animal/', views.create_animal, name="create_animal"),
    path('update_animal/<int:animal_id>', views.update_animal, name="update_animal"),
    path('delete_animal/<int:animal_id>', views.delete_animal, name="delete_animal"),
    path('get_animals_list/', views.get_animals_list, name='get_animals_list'),
]