from django.shortcuts import render
from .models import Ormoc_City
from django.views.decorators.csrf import csrf_exempt
import json
from django.shortcuts import get_object_or_404
from django.http import JsonResponse
# Create your views here
@csrf_exempt
def get_ormoc(request):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    obj = get_object_or_404(Ormoc_City, ormoc_city_id = 1)
    data = {
        'marker': obj.marker,
        'polygon': obj.polygon,
    }

    return JsonResponse(data)

@csrf_exempt
def update_ormoc_city(request):

    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)
    try:
        data = json.loads(request.body)
        marker = data['marker']
        polygon = data['polygon']
    except Exception as e:
        return JsonResponse({'error': 'Something went wrong: ' + str(e)}, status=400)
  
    
    obj, created = Ormoc_City.objects.get_or_create(
        ormoc_city_id=1,
        defaults={
            'marker': marker,
            'polygon': polygon
        }
    )

    if not created:
        obj.marker = marker   # ✅ removed comma
        obj.polygon = polygon # ✅ removed comma
        obj.save()

    return JsonResponse({
        'message': 'Created' if created else 'Updated'
    })
