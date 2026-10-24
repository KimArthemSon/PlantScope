"""Forgot-password flow: request code -> verify code -> set new password.

Limits (per account):
  - MAX_REQUESTS_PER_DAY codes in any rolling 24 hours
  - RESEND_COOLDOWN_SECONDS between two requests
  - MAX_VERIFY_ATTEMPTS wrong guesses per code before it is burned
"""
import hashlib
import json
import re
import secrets
from datetime import timedelta

import resend
from django.conf import settings
from django.db.models import F
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt

from security.models import SecurityLog
from security.views import log_event
from .models import User, PasswordResetCode

resend.api_key = settings.RESEND_API_KEY

MAX_REQUESTS_PER_DAY = 3
RESEND_COOLDOWN_SECONDS = 60
CODE_TTL_MINUTES = 10
RESET_TOKEN_TTL_MINUTES = 10
MAX_VERIFY_ATTEMPTS = 5

EMAIL_REGEX = r'^[^\s@]+@[^\s@]+\.[^\s@]+$'

# Field roles reset their password only in the mobile app;
# every other role resets only on the website.
MOBILE_ONLY_ROLES = {'treeGrowers', 'OnsiteInspector'}
# Same rule as registration
PASSWORD_REGEX = r'^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$'


def _sha256(value):
    return hashlib.sha256(value.encode()).hexdigest()


def _client_ip(request):
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    if forwarded:
        return forwarded.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


def _parse_body(request):
    try:
        return json.loads(request.body)
    except Exception:
        return None


def _find_user(email):
    return User.objects.filter(email__iexact=email).first()


def _platform_error(user, platform):
    """Return an error response if this user may not reset from this platform."""
    if platform not in ('web', 'mobile'):
        return JsonResponse({'error': 'Unknown platform.'}, status=400)
    mobile_role = user.user_role in MOBILE_ONLY_ROLES
    if platform == 'web' and mobile_role:
        return JsonResponse({
            'error': 'Tree Grower and Onsite Inspector accounts can only reset their password in the PlantScope mobile app.',
            'wrong_platform': True,
        }, status=403)
    if platform == 'mobile' and not mobile_role:
        return JsonResponse({
            'error': 'This account can only reset its password on the PlantScope website.',
            'wrong_platform': True,
        }, status=403)
    return None


def _latest_active_code(user):
    """Newest code that is not used and not expired."""
    return (
        PasswordResetCode.objects
        .filter(user=user, used_at__isnull=True, expires_at__gt=timezone.now())
        .order_by('-created_at')
        .first()
    )


def _email_html(code):
    return f"""
    <!DOCTYPE html>
    <html>
    <body style="margin:0; padding:0; background-color:#f4f7f4; font-family:'Segoe UI', Arial, sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:30px 0;">
        <tr><td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0"
                 style="background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,0.08);">
            <tr><td style="background:#0F4A2F; padding:20px; text-align:center;">
              <h1 style="color:#fff; margin:0; font-family:Arial, sans-serif;">PlantScope</h1>
            </td></tr>
            <tr><td style="padding:40px; text-align:center;">
              <h2 style="margin:0 0 10px 0; color:#2d5a2d; font-size:22px;">Reset your password</h2>
              <p style="margin:0 0 25px 0; color:#555; font-size:15px; line-height:1.6;">
                Use this code to reset your PlantScope password:
              </p>
              <div style="background:#eaf5ea; border:2px dashed #2d5a2d; border-radius:10px;
                          padding:20px; margin:0 auto 25px auto; max-width:320px;">
                <span style="font-size:36px; font-weight:700; letter-spacing:8px; color:#2d5a2d;
                             font-family:'Courier New', monospace;">{code}</span>
              </div>
              <p style="margin:0; color:#555; font-size:14px; line-height:1.6;">
                This code expires in <strong>{CODE_TTL_MINUTES} minutes</strong>. Do not share it with anyone.
              </p>
              <p style="margin:20px 0 0 0; color:#999; font-size:13px;">
                If you did not ask to reset your password, you can ignore this email. Your password stays the same.
              </p>
            </td></tr>
            <tr><td style="background:#2d5a2d; padding:18px; text-align:center;">
              <p style="margin:0; color:#fff; font-size:13px;">🌿 PlantScope — Identify. Explore. Grow.</p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
    """


@csrf_exempt
def request_reset_code(request):
    """POST {email, platform} -> emails a 6-digit code. platform is "web" or "mobile"."""
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)

    body = _parse_body(request)
    if body is None:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    email = str(body.get('email', '')).strip().lower()
    if not email or not re.match(EMAIL_REGEX, email):
        return JsonResponse({'error': 'Please enter a valid email address.'}, status=400)

    user = _find_user(email)
    if not user:
        return JsonResponse({'error': 'No account found with that email.'}, status=404)
    if not user.is_active:
        return JsonResponse({'error': 'This account is deactivated. Please contact the administrator.'}, status=403)
    platform_error = _platform_error(user, str(body.get('platform', '')))
    if platform_error:
        return platform_error

    now = timezone.now()
    recent = list(
        PasswordResetCode.objects
        .filter(user=user, created_at__gte=now - timedelta(hours=24))
        .order_by('created_at')
        .values_list('created_at', flat=True)
    )

    if len(recent) >= MAX_REQUESTS_PER_DAY:
        # The oldest request in the window frees up a slot 24h after it was made
        retry_after = int((recent[0] + timedelta(hours=24) - now).total_seconds()) + 1
        return JsonResponse({
            'error': f'You have reached the limit of {MAX_REQUESTS_PER_DAY} reset codes per day. Please try again later.',
            'limit_reached': True,
            'retry_after': retry_after,
            'requests_left': 0,
        }, status=429)

    if recent:
        since_last = (now - recent[-1]).total_seconds()
        if since_last < RESEND_COOLDOWN_SECONDS:
            wait = int(RESEND_COOLDOWN_SECONDS - since_last) + 1
            return JsonResponse({
                'error': f'Please wait {wait} seconds before requesting a new code.',
                'retry_after': wait,
                'requests_left': MAX_REQUESTS_PER_DAY - len(recent),
            }, status=429)

    code = ''.join(secrets.choice('0123456789') for _ in range(6))

    # A new code replaces any older unused one
    PasswordResetCode.objects.filter(user=user, used_at__isnull=True).update(used_at=now)
    record = PasswordResetCode.objects.create(
        user=user,
        code_hash=_sha256(code),
        ip_address=_client_ip(request),
        expires_at=now + timedelta(minutes=CODE_TTL_MINUTES),
    )

    try:
        resend.Emails.send({
            "from": "PlantScope <noreply@plantscope.org>",
            "to": [user.email],
            "subject": "PlantScope – Password Reset Code",
            "html": _email_html(code),
        })
    except Exception as e:
        # Failed sends should not use up one of the day's requests
        record.delete()
        print(f"[password_reset] Resend error: {e}")
        return JsonResponse({'error': 'Failed to send the email. Please try again.'}, status=500)

    return JsonResponse({
        'message': f'A reset code was sent to {user.email}.',
        'requests_left': MAX_REQUESTS_PER_DAY - len(recent) - 1,
        'cooldown': RESEND_COOLDOWN_SECONDS,
        'expires_in': CODE_TTL_MINUTES * 60,
    }, status=200)


@csrf_exempt
def verify_reset_code(request):
    """POST {email, code} -> returns a short-lived reset_token."""
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)

    body = _parse_body(request)
    if body is None:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    email = str(body.get('email', '')).strip().lower()
    code = str(body.get('code', '')).strip()
    if not email or not code:
        return JsonResponse({'error': 'Email and code are required.'}, status=400)

    user = _find_user(email)
    record = _latest_active_code(user) if user else None
    if not record:
        return JsonResponse({'error': 'Code expired or not found. Please request a new one.'}, status=400)

    if record.failed_attempts >= MAX_VERIFY_ATTEMPTS:
        return JsonResponse({'error': 'Too many wrong attempts. Please request a new code.'}, status=400)

    if not secrets.compare_digest(record.code_hash, _sha256(code)):
        PasswordResetCode.objects.filter(pk=record.pk).update(failed_attempts=F('failed_attempts') + 1)
        attempts_left = MAX_VERIFY_ATTEMPTS - record.failed_attempts - 1
        if attempts_left <= 0:
            return JsonResponse({'error': 'Too many wrong attempts. Please request a new code.', 'attempts_left': 0}, status=400)
        return JsonResponse({'error': 'Incorrect code. Please try again.', 'attempts_left': attempts_left}, status=400)

    reset_token = secrets.token_urlsafe(32)
    record.reset_token_hash = _sha256(reset_token)
    record.verified_at = timezone.now()
    record.save(update_fields=['reset_token_hash', 'verified_at'])

    return JsonResponse({'message': 'Code verified.', 'reset_token': reset_token}, status=200)


@csrf_exempt
def confirm_password_reset(request):
    """POST {email, reset_token, new_password, platform} -> changes the password."""
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)

    body = _parse_body(request)
    if body is None:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    email = str(body.get('email', '')).strip().lower()
    reset_token = str(body.get('reset_token', '')).strip()
    new_password = body.get('new_password') or ''
    if not email or not reset_token or not new_password:
        return JsonResponse({'error': 'Missing required fields.'}, status=400)

    user = _find_user(email)
    now = timezone.now()
    record = None
    if user and user.is_active:
        record = (
            PasswordResetCode.objects
            .filter(
                user=user,
                reset_token_hash=_sha256(reset_token),
                used_at__isnull=True,
                verified_at__gte=now - timedelta(minutes=RESET_TOKEN_TTL_MINUTES),
            )
            .first()
        )
    if not record:
        return JsonResponse({'error': 'Your reset session has expired. Please start again.'}, status=400)

    platform_error = _platform_error(user, str(body.get('platform', '')))
    if platform_error:
        return platform_error

    if not re.match(PASSWORD_REGEX, new_password):
        return JsonResponse({
            'error': 'Password must contain uppercase, lowercase, number, special character, and be at least 8 characters long.'
        }, status=400)

    new_hash = _sha256(new_password)
    if new_hash == user.password:
        return JsonResponse({'error': 'Your new password must be different from your current password.'}, status=400)

    user.password = new_hash
    user.save(update_fields=['password'])
    PasswordResetCode.objects.filter(user=user, used_at__isnull=True).update(used_at=now)

    log_event(user, user.email, SecurityLog.PASSWORD_CHANGE,
              ip_address=_client_ip(request), user_agent=request.META.get('HTTP_USER_AGENT'))

    return JsonResponse({'message': 'Your password has been reset. You can now log in.'}, status=200)
