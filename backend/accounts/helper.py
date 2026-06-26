import jwt
from django.conf import settings
from django.shortcuts import get_object_or_404
from accounts.models import User
import cloudinary.uploader
import re


def get_user_from_token(request):
    """
    Extracts and validates JWT token from Authorization header.
    Returns User object if valid.
    Raises Exception if invalid.
    """

    auth_header = request.headers.get('Authorization')

    if not auth_header or not auth_header.startswith('Bearer '):
        raise Exception("Authorization header missing or invalid")

    token = auth_header.split(' ')[1]

    payload = jwt.decode(
        token,
        settings.JWT_SECRET,
        algorithms=[settings.JWT_ALGORITHM]
    )

    user_id = payload.get('user_id')

    if not user_id:
        raise Exception("Invalid token payload")

    user = get_object_or_404(User, id=user_id)

    return user


def get_cloudinary_url(public_id):
    """
    Constructs full Cloudinary URL from database public_id.
    
    Args:
        public_id: The Cloudinary path stored in database (e.g., 'image/upload/v1782467384/profile/uct31mdjishjvhplxyz9.jpg')
    
    Returns:
        Full Cloudinary URL (e.g., 'https://res.cloudinary.com/dmjcsglsk/image/upload/v1782467384/profile/uct31mdjishjvhplxyz9.jpg')
        Returns None if public_id is empty or None
    """
    if not public_id:
        return None
    
    cloud_name = settings.CLOUDINARY_STORAGE.get('CLOUD_NAME', '')
    
    if not cloud_name:
        # Fallback: return as-is if Cloudinary is not configured
        return public_id
    
    # If it's already a full URL, return it
    if public_id.startswith('http://') or public_id.startswith('https://'):
        return public_id
    
    # Construct full Cloudinary URL
    return f'https://res.cloudinary.com/{cloud_name}/{public_id}'

def delete_cloudinary_resource(file_field, resource_type='image'):
    """
    Safely delete a file from Cloudinary, trying with and without extension.
    """
    if not file_field:
        return False
    
    try:
        # Get public_id from CloudinaryField object or string
        if hasattr(file_field, 'public_id') and file_field.public_id:
            public_id = file_field.public_id
        else:
            public_id = str(file_field)
            # Extract folder/filename from path
            match = re.search(r'(.+?)/v\d+/(.+?)(?:\.\w+)?$', public_id)
            if match:
                public_id = f"{match.group(1)}/{match.group(2)}"
            else:
                public_id = re.sub(r'\.\w+$', '', public_id)
        
        # Attempt 1: Delete without extension
        result = cloudinary.uploader.destroy(public_id, resource_type=resource_type, invalidate=True)
        
        # Attempt 2: If not found, try with extension (Cloudinary often needs this)
        if result.get('result') == 'not found':
            extension = '.jpg' if resource_type == 'image' else '.pdf'
            public_id_with_ext = f"{public_id}{extension}"
            result = cloudinary.uploader.destroy(public_id_with_ext, resource_type=resource_type, invalidate=True)
            
        return result.get('result') == 'ok'
        
    except Exception as e:
        print(f"Failed to delete from Cloudinary: {e}")
        return False