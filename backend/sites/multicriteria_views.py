import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import get_object_or_404

from .models import Sites, Site_data, Site_details
from reforestation_areas.models import Reforestation_areas
from soils.models import Soils
from tree_species.models import Tree_species


