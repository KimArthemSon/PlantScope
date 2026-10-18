import cloudinary.api
import cloudinary.utils
import mimetypes
import requests
import re
import logging
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
        public_id, _ = extract_public_id_and_version(stored_value)

        if not public_id:
            return JsonResponse({
                'error': 'Invalid file reference',
                'details': 'Could not extract public_id from database.'
            }, status=404)

        # Raw Cloudinary files keep their extension in the public_id, and plans
        # can be PDF or Word, so try the stored format first, then the others.
        base_id = re.sub(r'\.(pdf|docx?)$', '', public_id)
        stored_format = getattr(app.maintenance_plan, 'format', None)
        candidates = []
        for ext in [stored_format, 'pdf', 'docx', 'doc', None]:
            candidate = f"{base_id}.{ext}" if ext else base_id
            if candidate not in candidates:
                candidates.append(candidate)

        logger.info(f"Looking for maintenance plan, candidates: {candidates}")

        actual_public_id = None
        for candidate in candidates:
            try:
                resource = cloudinary.api.resource(candidate, resource_type='raw')
                actual_public_id = resource.get('public_id')
                logger.info(f"✅ Found: {actual_public_id}")
                break
            except cloudinary.exceptions.NotFound:
                continue

        if not actual_public_id:
            logger.error(f"File not found, tried: {candidates}")
            return JsonResponse({
                'error': 'File not found in Cloudinary',
                'details': f'Could not locate {base_id} in Cloudinary storage.'
            }, status=404)

        # Signed API download URL: works even when the account blocks public
        # PDF delivery (the plain delivery URL returns 401 for PDFs)
        download_url = cloudinary.utils.private_download_url(
            actual_public_id, '', resource_type='raw', type='upload'
        )

        logger.info(f"Downloading from Cloudinary: {actual_public_id}")

        response = requests.get(download_url, timeout=60)

        if response.status_code != 200:
            logger.error(f"Failed to download from Cloudinary: {response.status_code}")
            return JsonResponse({
                'error': 'Failed to retrieve file content',
                'details': f'Cloudinary returned status {response.status_code}'
            }, status=500)
        
        # ✅ Serve the file directly to the user
        ext = actual_public_id.rsplit('.', 1)[-1] if '.' in actual_public_id.rsplit('/', 1)[-1] else 'pdf'
        filename = f"maintenance_plan_{application_id}.{ext}"
        content_type = mimetypes.guess_type(filename)[0] or 'application/octet-stream'

        return HttpResponse(
            response.content,
            content_type=content_type,
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