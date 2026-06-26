"""
Django settings for backend project.
"""

from pathlib import Path
import os
from decouple import config

# Cloudinary imports
import cloudinary
import cloudinary.uploader
import cloudinary.api

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = config('SECRET_KEY', default='django-insecure-u$t)l#xc06*hpi4-#h-&xsv3!=8zy0!z)tf=!m-+5uze+4f*+m')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = config('DEBUG', default=True, cast=bool)

# ✅ BULLETPROOF ALLOWED_HOSTS (Fixes Render/Production crashes)
ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='localhost,127.0.0.1').split(',')
# Clean up any empty strings or whitespace
ALLOWED_HOSTS = [host.strip() for host in ALLOWED_HOSTS if host.strip()]
# Fallback to ensure it's NEVER empty
if not ALLOWED_HOSTS:
    ALLOWED_HOSTS = ['localhost', '127.0.0.1']

# Application definition
INSTALLED_APPS = [
    'corsheaders',
    'cloudinary',
    'cloudinary_storage',
    'rest_framework',
    'accounts',
    'security',
    'tree_species',
    'barangay',
    'land_classifications',
    'reforestation_areas',
    'Field_assessment',
    'sites',
    'ormoc_city',
    'tree_planting_programs',
    'animals',
    'hazard_areas'
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',  # Add WhiteNoise for static files
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    "backend.middleware.JWTAuthorizationMiddleware",
]

ROOT_URLCONF = 'backend.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'backend.wsgi.application'

# CORS Configuration
CORS_ALLOWED_ORIGINS = config('CORS_ALLOWED_ORIGINS', default='http://localhost:5173').split(',')
CORS_ALLOW_CREDENTIALS = True

# CSRF Configuration
CSRF_TRUSTED_ORIGINS = config('CORS_ALLOWED_ORIGINS', default='http://localhost:5173').split(',')

# Database
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': config('DB_NAME', default='plantscope'),
        'USER': config('DB_USER', default='postgres'),
        'PASSWORD': config('DB_PASSWORD', default='246246'),
        'HOST': config('DB_HOST', default='localhost'),
        'PORT': config('DB_PORT', default='5432'),
    }
}

# Cloudinary Configuration (For file uploads - Images, PDFs, Word docs)
CLOUDINARY_STORAGE = {
    'CLOUD_NAME': config('CLOUDINARY_CLOUD_NAME', default=''),
    'API_KEY': config('CLOUDINARY_API_KEY', default=''),
    'API_SECRET': config('CLOUDINARY_API_SECRET', default=''),
}

# Configure the base Cloudinary library
if CLOUDINARY_STORAGE['CLOUD_NAME']:
    cloudinary.config(
        cloud_name=CLOUDINARY_STORAGE['CLOUD_NAME'],
        api_key=CLOUDINARY_STORAGE['API_KEY'],
        api_secret=CLOUDINARY_STORAGE['API_SECRET'],
    )

# Static files (CSS, JavaScript, Images)
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

# Media files (User uploads)
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# ✅ DJANGO 4.2+ STORAGE CONFIGURATION (Replaces deprecated DEFAULT_FILE_STORAGE)
if CLOUDINARY_STORAGE['CLOUD_NAME']:
    STORAGES = {
        "default": {
            "BACKEND": "cloudinary_storage.storage.MediaCloudinaryStorage",
        },
        "staticfiles": {
            "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
        },
    }
else:
    STORAGES = {
        "default": {
            "BACKEND": "django.core.files.storage.FileSystemStorage",
        },
        "staticfiles": {
            "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
        },
    }

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# JWT Configuration
JWT_SECRET = config('JWT_SECRET', default='AKOANISECRET_super_secret_key_here')
JWT_ALGORITHM = 'HS256'
JWT_EXP_DELTA_SECONDS = 3600 * 5

# Email Configuration
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = 'smtp.gmail.com'
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = config('EMAIL_HOST_USER', default='sonkimarthem@gmail.com')
EMAIL_HOST_PASSWORD = config('EMAIL_HOST_PASSWORD', default='')
DEFAULT_FROM_EMAIL = config('DEFAULT_FROM_EMAIL', default='noreply@plantscope.ph')

# In-memory cache for OTP storage
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'plantscope-otp-cache',
    }
}

# NASA FIRMS API
FIRMS_API_TOKEN = config('FIRMS_API_TOKEN', default='c777ac613cd493b3a6f045edc974ce62')
FIRMS_API_BASE_URL = "https://firms.modaps.eosdis.nasa.gov/api"
API_BASE = config('API_BASE', default='http://127.0.0.1:8000')

# DEBUG: Check if Cloudinary is configured
print(f"☁️ Cloudinary Cloud Name: {CLOUDINARY_STORAGE['CLOUD_NAME']}")
if CLOUDINARY_STORAGE['CLOUD_NAME']:
    print("✅ Cloudinary is ACTIVE!")
else:
    print("❌ Cloudinary is NOT configured - using local storage!")