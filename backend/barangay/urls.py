from django.urls import path
from . import views

# Create your views here.
urlpatterns = [
    path('get_barangay_list/',views.get_barangay_list, name="get_barangay_list"),
    path('get_barangays/',views.get_barangays, name="get_barangays"),
    path('get_barangay/<int:barangay_id>',views.get_barangay, name="get_barangay"),
    path('create_barangay/',views.create_barangay, name="create_barangay"),
    path('update_barangay/<int:barangay_id>', views.update_barangay, name="update_barangay"),
    path('delete_barangay/<int:barangay_id>', views.delete_barangay, name="delete_barangay")
]