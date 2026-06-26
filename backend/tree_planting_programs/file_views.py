import cloudinary.api
import cloudinary.utils
import requests
import re
import logging
from django.conf import settings
from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import get_object_or_404
from .models import Application
from accounts.helper import get_user_from_token

logger = logging.getLogger(__name__)


def extract_public_id_and_version(stored_value):
    """Extract public_id and version from database storage."""
    if not stored_value:
        return None, None
    
    match = re.search(r'raw/upload/(v\d+)/(.+)$', stored_value)
    if match:
        version = match.group(1)
        public_id = match.group(2)
        if not public_id.endswith(('.pdf', '.doc', '.docx')):
            public_id += '.pdf'
        return public_id, version
    
    public_id = extract_public_id_simple(stored_value)
    return public_id, None


def extract_public_id_simple(stored_value):
    """Simple public_id extraction."""
    if not stored_value:
        return None
    
    if not stored_value.startswith(('http', 'raw/', 'upload/')):
        if not stored_value.endswith(('.pdf', '.doc', '.docx')):
            return f"{stored_value}.pdf"
        return stored_value
    
    match = re.search(r'(?:raw/upload|upload)/v\d+/(.+)$', stored_value)
    if match:
        public_id = match.group(1)
        if not public_id.endswith(('.pdf', '.doc', '.docx')):
            public_id += '.pdf'
        return public_id
    
    if stored_value.startswith('http'):
        match = re.search(r'/raw/upload/(?:v\d+/)?(.+?)(?:\.\w+)?$', stored_value)
        if match:
            return match.group(1) + '.pdf'
    
    return stored_value


@csrf_exempt
def download_maintenance_plan(request, application_id):
    """
    Download maintenance plan by proxying through Django.
    This bypasses all Cloudinary authentication issues.
    """
    user = get_user_from_token(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=401)
    
    app = get_object_or_404(Application, application_id=application_id)
    
    if not app.maintenance_plan:
        return JsonResponse({'error': 'No maintenance plan found'}, status=404)
    
    try:
        stored_value = str(app.maintenance_plan)
        public_id, version = extract_public_id_and_version(stored_value)
        
        if not public_id:
            return JsonResponse({
                'error': 'Invalid file reference',
                'details': 'Could not extract public_id from database.'
            }, status=404)
        
        logger.info(f"Looking for: {public_id}, version: {version}")
        
        # Find the file in Cloudinary
        actual_public_id = None
        
        # Try with .pdf
        try:
            resource = cloudinary.api.resource(public_id, resource_type='raw')
            actual_public_id = resource.get('public_id')
            logger.info(f"✅ Found: {actual_public_id}")
        except cloudinary.exceptions.NotFound:
            # Try without .pdf
            try:
                public_id_no_ext = public_id.rsplit('.', 1)[0]
                resource = cloudinary.api.resource(public_id_no_ext, resource_type='raw')
                actual_public_id = resource.get('public_id')
                logger.info(f"✅ Found (no ext): {actual_public_id}")
            except Exception as e2:
                logger.error(f"File not found: {e2}")
                return JsonResponse({
                    'error': 'File not found in Cloudinary',
                    'details': f'Could not locate {public_id} in Cloudinary storage.'
                }, status=404)
        
        # ✅ Get the secure URL from Cloudinary API
        secure_url = cloudinary.utils.cloudinary_url(
            actual_public_id,
            resource_type='raw',
            secure=True
        )[0]
        
        logger.info(f"Downloading from Cloudinary: {secure_url}")
        
        # ✅ Download file content using Cloudinary API credentials
        response = requests.get(
            secure_url,
            auth=(
                settings.CLOUDINARY_STORAGE['API_KEY'],
                settings.CLOUDINARY_STORAGE['API_SECRET']
            ),
            timeout=30
        )
        
        if response.status_code != 200:
            logger.error(f"Failed to download from Cloudinary: {response.status_code}")
            return JsonResponse({
                'error': 'Failed to retrieve file content',
                'details': f'Cloudinary returned status {response.status_code}'
            }, status=500)
        
        # ✅ Serve the file directly to the user
        filename = f"maintenance_plan_{application_id}.pdf"
        
        return HttpResponse(
            response.content,
            content_type='application/pdf',
            headers={
                'Content-Disposition': f'attachment; filename="{filename}"',
                'Content-Length': len(response.content),
            }
        )
        
    except Exception as e:
        logger.error(f"Download error: {e}", exc_info=True)
        return JsonResponse({
            'error': 'Download failed',
            'details': str(e)
        }, status=500)