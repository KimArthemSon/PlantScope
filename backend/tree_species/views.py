import json
import math
from django.shortcuts import get_object_or_404
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.db import IntegrityError
from .models import Tree_species


# =========================
# GET TREE SPECIES (LIST)
# =========================
@csrf_exempt
def get_tree_species(request):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    search = request.GET.get('search', '').strip()
    entries = int(request.GET.get('entries', 10))
    page = int(request.GET.get('page', 1))

    if entries <= 0:
        entries = 10
    if page <= 0:
        page = 1

    offset = (page - 1) * entries

    tree_species = Tree_species.objects.all().order_by('-created_at')

    if search:
        tree_species = tree_species.filter(name__icontains=search)

    total = tree_species.count()
    total_page = math.ceil(total / entries) if total > 0 else 0

    data = list(
        tree_species[offset: offset + entries].values()
    )

    return JsonResponse({
        'data': data,
        'total_page': total_page,
        'page': page,
        'entries': entries,
        'total': total
    }, status=200)


# =========================
# GET SINGLE TREE SPECIE
# =========================
def get_tree_specie(request, tree_specie_id):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    tree_specie = get_object_or_404(
        Tree_species,
        tree_specie_id=tree_specie_id
    )

    data = {
        'tree_specie_id': tree_specie.tree_specie_id,
        'name': tree_specie.name,
        'description': tree_specie.description,
        'created_at': tree_specie.created_at
    }

    return JsonResponse({'data': data}, status=200)


# =========================
# CREATE TREE SPECIE
# =========================
@csrf_exempt
def create_tree_specie(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)

    try:
        data = json.loads(request.body)
        name = data['name'].strip()
        description = data['description']
    except (KeyError, json.JSONDecodeError):
        return JsonResponse(
            {'error': 'Missing or invalid fields'},
            status=400
        )

    # Prevent duplicate names (case-insensitive)
    if Tree_species.objects.filter(name__iexact=name).exists():
        return JsonResponse(
            {'error': 'Tree species with this name already exists'},
            status=409
        )

    try:
        Tree_species.objects.create(
            name=name,
            description=description
        )
    except IntegrityError:
        return JsonResponse(
            {'error': 'Tree species with this name already exists'},
            status=409
        )

    return JsonResponse(
        {'message': 'Successfully added'},
        status=201
    )


# =========================
# UPDATE TREE SPECIE
# =========================
@csrf_exempt
def update_tree_specie(request, tree_specie_id):
    if request.method != 'PUT':
        return JsonResponse({'error': 'Only PUT allowed'}, status=405)

    try:
        data = json.loads(request.body)
        name = data['name'].strip()
        description = data['description']
    except (KeyError, json.JSONDecodeError):
        return JsonResponse(
            {'error': 'Missing or invalid fields'},
            status=400
        )

    tree_specie = get_object_or_404(
        Tree_species,
        tree_specie_id=tree_specie_id
    )

    # Prevent duplicate name on update
    if Tree_species.objects.exclude(
        tree_specie_id=tree_specie_id
    ).filter(name__iexact=name).exists():
        return JsonResponse(
            {'error': 'Tree species with this name already exists'},
            status=409
        )

    tree_specie.name = name
    tree_specie.description = description
    tree_specie.save()

    return JsonResponse(
        {'message': 'Successfully updated'},
        status=200
    )


# =========================
# DELETE TREE SPECIE
# =========================
@csrf_exempt
def delete_tree_specie(request, tree_specie_id):
    if request.method != 'DELETE':
        return JsonResponse({'error': 'Only DELETE allowed'}, status=405)

    tree_specie = get_object_or_404(
        Tree_species,
        tree_specie_id=tree_specie_id
    )
    tree_specie.delete()

    return JsonResponse(
        {'message': 'Successfully deleted'},
        status=200
    )
