from django.urls import path
from . import views

urlpatterns = [
    path('get_tree_species/',views.get_tree_species, name="get_tree_species"),
    path('get_tree_specie/<int:tree_specie_id>',views.get_tree_specie, name="get_tree_specie"),
    path('create_tree_specie/',views.create_tree_specie, name="create_tree_specie"),
    path('update_tree_specie/<int:tree_specie_id>', views.update_tree_specie, name="update_tree_specie"),
    path('delete_tree_specie/<int:tree_specie_id>', views.delete_tree_specie, name="delete_tree_specie")
]