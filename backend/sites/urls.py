from django.urls import path
from . import views

urlpatterns = [
    # # ==========================
    # # SITES CRUD
    # # ==========================
    path("get_sites/<int:reforestation_area_id>/", views.get_sites, name="get_sites"),
    path("get_site/<int:site_id>/", views.get_site, name="get_site"),
    path("create_site/", views.create_site, name="create_site"),
    path("update_site/<int:site_id>/", views.update_site, name="update_site"),
    path("delete_site/<int:site_id>/", views.delete_site, name="delete_site"),

    # # ==========================
    # # SITE DATA
    # # ==========================
    # path("site/data/update/<int:site_id>/", views.update_site_data, name="update_site_data"),
    
   
    # path("update_site_coordinates/", views.update_site_coordinates, name="update_site_coordinates"),
    # path("get_site_coordinates/", views.get_site_coordinates, name="get_site_coordinates"),
]
