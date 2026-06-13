import json
import logging
import math
from django.db import IntegrityError, transaction
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import get_object_or_404
from django.utils import timezone
from accounts.helper import get_user_from_token
from .models import (
    Sites, Site_data, Site_species_recommendation, Site_images,
    Potential_sites, SiteMetaDataVerification, PermitDocument
)
from reforestation_areas.models import Reforestation_areas
from tree_species.models import Tree_species
from Field_assessment.models import Field_assessment
logger = logging.getLogger(__name__)

# Add this to sites/views.py:

@csrf_exempt
def update_site_basic_info(request, site_id):
    """
    PUT/PATCH: Update site name and description.
    
    Body:
    {
        "name": "New Site Name" (optional),
        "description": "Site description text" (optional)
    }
    """
    if request.method not in ["PUT", "PATCH", "POST"]:
        return JsonResponse({"error": "PUT/PATCH/POST only"}, status=405)
    
    try:
        body = json.loads(request.body)
        site = get_object_or_404(Sites, site_id=site_id, is_active=True)
        
        updated_fields = []
        
        # Update name if provided
        if 'name' in body:
            new_name = body['name'].strip()
            if not new_name:
                return JsonResponse({"error": "name cannot be empty"}, status=400)
            
            # Check uniqueness within the same reforestation area
            if Sites.objects.filter(
                reforestation_area=site.reforestation_area,
                name=new_name
            ).exclude(site_id=site_id).exists():
                return JsonResponse({
                    "error": "A site with this name already exists in this area"
                }, status=409)
            
            site.name = new_name
            updated_fields.append('name')
        
        # Update description if provided
        if 'description' in body:
            site.description = body['description'].strip() or None
            updated_fields.append('description')
        
        if not updated_fields:
            return JsonResponse({"error": "No fields to update"}, status=400)
        
        site.save()
        
        logger.info(f"Site {site_id} updated: {', '.join(updated_fields)}")
        
        return JsonResponse({
            "message": "Site information updated successfully",
            "site_id": site.site_id,
            "name": site.name,
            "description": site.description,
            "updated_fields": updated_fields
        }, status=200)
        
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON format"}, status=400)
    except Exception as e:
        logger.error(f"Update site basic info error: {e}", exc_info=True)
        return JsonResponse({"error": str(e)}, status=500)
    
# Add these to sites/views.py:

@csrf_exempt
def list_site_images(request, site_id):
    """GET: List all images for a site."""
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    
    site = get_object_or_404(Sites, site_id=site_id, is_active=True)
    
    images = site.site_images.all().order_by('layer_tag', '-created_at')
    
    data = [{
        'site_image_id': img.site_image_id,
        'layer_tag': img.layer_tag,
        'img_url': img.img.url if img.img else None,
        'caption': img.caption,
        'created_at': img.created_at.isoformat() if img.created_at else None,
    } for img in images]
    
    return JsonResponse({'data': data, 'count': len(data)}, status=200)


@csrf_exempt
def upload_site_image(request, site_id):
    """POST: Upload a new image for a site."""
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)
    
    site = get_object_or_404(Sites, site_id=site_id, is_active=True)
    
    layer_tag = request.POST.get('layer_tag', 'general')
    caption = request.POST.get('caption', '').strip()
    image_file = request.FILES.get('img')
    
    if not image_file:
        return JsonResponse({'error': 'img file is required'}, status=400)
    
    # Validate layer_tag
    valid_layers = [choice[0] for choice in Site_images.LAYER_CHOICES]
    if layer_tag not in valid_layers:
        return JsonResponse({
            'error': f'Invalid layer_tag. Allowed: {valid_layers}'
        }, status=400)
    
    try:
        image = Site_images.objects.create(
            site=site,
            layer_tag=layer_tag,
            img=image_file,
            caption=caption or None
        )
        
        return JsonResponse({
            'message': 'Image uploaded successfully',
            'site_image_id': image.site_image_id,
            'img_url': image.img.url,
            'layer_tag': image.layer_tag,
            'caption': image.caption
        }, status=201)
        
    except Exception as e:
        logger.error(f"Upload site image error: {e}", exc_info=True)
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
def delete_site_image(request, site_image_id):
    """DELETE: Remove an image from a site."""
    if request.method != 'DELETE':
        return JsonResponse({'error': 'Only DELETE allowed'}, status=405)
    
    try:
        image = get_object_or_404(Site_images, site_image_id=site_image_id)
        
        # Delete the file from storage
        if image.img:
            try:
                image.img.delete(save=False)
            except Exception as file_err:
                logger.warning(f"Could not delete file for image {site_image_id}: {file_err}")
        
        image.delete()
        
        return JsonResponse({'message': 'Image deleted successfully'}, status=200)
        
    except Exception as e:
        logger.error(f"Delete site image error: {e}", exc_info=True)
        return JsonResponse({'error': str(e)}, status=500)