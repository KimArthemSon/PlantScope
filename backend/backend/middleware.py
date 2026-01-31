import jwt
from django.conf import settings
from django.http import JsonResponse

class JWTAuthorizationMiddleware:
    EXEMPT_PATHS = ["/api/login","/media/"]

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Skip exempt paths
        if any(request.path.startswith(p) for p in self.EXEMPT_PATHS):
            return self.get_response(request)

        # Get the Authorization header
        auth_header = request.META.get("HTTP_AUTHORIZATION")
        if not auth_header:
            return JsonResponse({"detail": "Missing Authorization header"}, status=401)

        try:
            # Expect format: "Bearer <token>"
            prefix, token = auth_header.split(" ")
            if prefix.lower() != "bearer":
                raise ValueError("Invalid token prefix")

            # Decode JWT using same secret & algorithm as login
            payload = jwt.decode(
                token,
                settings.JWT_SECRET,
                algorithms=[settings.JWT_ALGORITHM]
            )

            # Attach decoded payload to request for use in views
            request.user_data = payload

        except jwt.ExpiredSignatureError:
            return JsonResponse({"detail": "Token expired"}, status=401)
        except (ValueError, jwt.InvalidTokenError):
            return JsonResponse({"detail": "Invalid token"}, status=401)

        return self.get_response(request)
