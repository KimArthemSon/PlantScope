from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from .models import User
import json
import hashlib
import jwt
from datetime import datetime, timedelta

# Secret key for JWT
JWT_SECRET = 'your_super_secret_key_here'
JWT_ALGORITHM = 'HS256'
JWT_EXP_DELTA_SECONDS = 3600  # token valid for 1 hour

# -------------------------
# Register
# -------------------------
@csrf_exempt
def register_user(request):
    if request.method != '4':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)

    try:
        data = json.loads(request.body)
        email = data['email']
        username = data['username']
        password = data['password']
        user_role = data.get('user_role', 'FieldOfficer')
    except KeyError:
        return JsonResponse({'error': 'Missing fields'}, status=400)

    if User.objects.filter(email=email).exists():
        return JsonResponse({'error': 'Email already exists'}, status=400)

    # Hash password with SHA-256
    hashed_password = hashlib.sha256(password.encode()).hexdigest()

    user = User.objects.create(
        email=email,
        username=username,
        password=hashed_password,
        user_role=user_role
    )

    return JsonResponse({'message': 'User registered successfully', 'user_id': user.id})

# -------------------------
# Login
# -------------------------
@csrf_exempt
def login_user(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)

    try:
        data = json.loads(request.body)
        email = data['email']
        password = data['password']
    except KeyError:
        return JsonResponse({'error': 'Missing fields'}, status=400)

    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        return JsonResponse({'error': 'Invalid credentials'}, status=401)

    # Hash the input password and compare
    hashed_password = hashlib.sha256(password.encode()).hexdigest()
    if hashed_password != user.password:
        return JsonResponse({'error': 'Invalid credentials'}, status=401)

    # Create JWT token
    payload = {
        'user_id': user.id,
        'email': user.email,
        'exp': datetime.utcnow() + timedelta(seconds=JWT_EXP_DELTA_SECONDS)
    }

    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return JsonResponse({'token': token, 'user_role': user.user_role})

@csrf_exempt
def list_users(request):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    users = User.objects.all().values('id', 'email', 'username', 'user_role', 'created_at')
    return JsonResponse(list(users), safe=False)
