import logging
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import get_object_or_404

# ✅ ADD THIS IMPORT
from accounts.helper import get_cloudinary_url

logger = logging.getLogger(__name__)
from .models import Sites

@csrf_exempt
def get_site_details_for_tree_grower(request, site_id):

    """
    GET: Fetch detailed site information for tree grower view.
    Includes images, recommended species, accessibility, land classification, etc.
    """
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    site = get_object_or_404(Sites, site_id=site_id, is_active=True, status='accepted')
    
    # Check if site is verified
    if not hasattr(site, 'meta_verification') or site.meta_verification.status != 'verified':
        return JsonResponse({'error': 'Site not available for application'}, status=400)

    # Get general images
    general_images = []
    for img in site.site_images.filter(layer_tag='general').order_by('created_at'):
        general_images.append({
            'image_id': img.site_image_id,
            # ✅ FIX: Use get_cloudinary_url helper instead of .url
            'url': get_cloudinary_url(str(img.img)) if img.img else None,
            'caption': img.caption,
        })

    # Get recommended species
    recommended_species = []
    for rec in site.species_recommendations.select_related('tree_species').order_by('priority_rank'):
        if rec.tree_species:
            recommended_species.append({
                'species_id': rec.tree_species.tree_specie_id,
                'name': rec.tree_species.name,
                'description': rec.tree_species.description,
                'priority_rank': rec.priority_rank,
                'notes': rec.notes,
            })

    # Get accessibility info
    accessibility_info = None
    if site.meta_verification.verified_accessibility:
        acc = site.meta_verification.verified_accessibility
        if isinstance(acc, dict):
            accessibility_info = {
                'type': acc.get('type', 'Unknown'),
                'description': acc.get('description', ''),
            }
        elif isinstance(acc, str):
            accessibility_info = {'type': acc, 'description': ''}

    # Get land classification
    land_classification = None
    if site.meta_verification.verified_land_classification:
        land_classification = {
            'id': site.meta_verification.verified_land_classification.land_classification_id,
            'name': site.meta_verification.verified_land_classification.name,
        }

    data = {
        'site_id': site.site_id,
        'name': site.name,
        'description': site.description,
        'reforestation_area': site.reforestation_area.name,
        'barangay': site.reforestation_area.barangay.name if site.reforestation_area.barangay else 'N/A',
        'total_area_hectares': site.total_area_hectares,
        'ndvi_value': site.ndvi_value,
        'center_coordinate': site.center_coordinate,
        'polygon_coordinates': site.polygon_coordinates,
        'general_images': general_images,
        'recommended_species': recommended_species,
        'accessibility': accessibility_info,
        'land_classification': land_classification,
        'created_at': site.created_at.strftime('%B %d, %Y'),
    }

    return JsonResponse(data, status=200)