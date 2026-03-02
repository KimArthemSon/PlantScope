import jwt
from django.conf import settings
from django.shortcuts import get_object_or_404
from accounts.models import User


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