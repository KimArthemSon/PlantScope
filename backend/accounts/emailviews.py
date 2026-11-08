import random
import string
import time
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.core.cache import cache
import json
import re
from django.conf import settings
import resend
from .models import User

# ✅ Initialize Resend with your API key from settings
resend.api_key = settings.RESEND_API_KEY
# Give up on Resend well before the mobile app's 45s request timeout, so a
# stalled send returns a clear error instead of "server took too long".
resend.default_http_client = resend.RequestsClient(timeout=15)

@csrf_exempt
def send_otp(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)

    try:
        body = json.loads(request.body)
    except Exception:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    email = body.get('email', '').strip().lower()
    if not email or not re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', email):
        return JsonResponse({'error': 'A valid email is required.'}, status=400)

    # Timings are printed so a slow or stuck request shows which step stalled
    started = time.monotonic()
    try:
        already_registered = User.objects.filter(email=email).exists()
    except Exception as e:
        print(f"[send_otp] database check failed after {time.monotonic() - started:.1f}s: {e}")
        return JsonResponse({'error': 'Could not reach the database. Please try again shortly.'}, status=503)
    print(f"[send_otp] database check took {time.monotonic() - started:.1f}s")

    if already_registered:
        return JsonResponse({'error': 'This email is already registered. Please use another email or log in.'}, status=400)

    if cache.get(f'otp_cooldown_{email}'):
        return JsonResponse({'error': 'Please wait before requesting a new code.'}, status=429)

    otp_code = ''.join(random.choices(string.digits, k=6))
    cache.set(f'otp_{email}', otp_code, timeout=600)
    cache.set(f'otp_cooldown_{email}', True, timeout=60)

    # ✅ HTML Content for the email
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0; padding:0; background-color:#f4f7f4; font-family: 'Segoe UI', Arial, sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="background-color:#f4f7f4; padding:30px 0;">
        <tr>
          <td align="center">
            <table role="presentation" width="600" cellpadding="0" cellspacing="0"
                   style="background-color:#ffffff; border-radius:12px; overflow:hidden;
                          box-shadow:0 4px 20px rgba(0,0,0,0.08);">
              <tr>
                <td style="padding:0; line-height:0;">
                  <div style="background-color: #0F4A2F; padding: 20px; text-align: center;">
                      <h1 style="color: white; margin: 0; font-family: Arial, sans-serif;">PlantScope</h1>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding:40px 40px 30px 40px; text-align:center;">
                  <h1 style="margin:0 0 10px 0; color:#2d5a2d; font-size:22px; font-weight:600;">
                    Email Verification
                  </h1>
                  <p style="margin:0 0 25px 0; color:#555555; font-size:15px; line-height:1.6;">
                    Hello,<br>
                    Your PlantScope verification code is:
                  </p>
                  <div style="background:#eaf5ea; border:2px dashed #2d5a2d; border-radius:10px;
                              padding:20px; margin:0 auto 25px auto; max-width:320px;">
                    <span style="font-size:36px; font-weight:700; letter-spacing:8px;
                                 color:#2d5a2d; font-family:'Courier New', monospace;">
                      {otp_code}
                    </span>
                  </div>
                  <p style="margin:0 0 10px 0; color:#555555; font-size:14px; line-height:1.6;">
                    This code expires in <strong>10 minutes</strong>.<br>
                    Do not share it with anyone.
                  </p>
                  <p style="margin:20px 0 0 0; color:#999999; font-size:13px; line-height:1.5;">
                    If you did not request this code, please ignore this email.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="background-color:#2d5a2d; padding:18px 40px; text-align:center;">
                  <p style="margin:0; color:#ffffff; font-size:13px;">
                    🌿 PlantScope — Identify. Explore. Grow.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    """

    send_started = time.monotonic()
    try:
        # ✅ Send email using Resend API with your verified domain
        params = {
            "from": "PlantScope <noreply@plantscope.org>",  # ✅ Using your verified domain
            "to": [email],
            "subject": "PlantScope – Email Verification Code",
            "html": html_content,
        }

        resend.Emails.send(params)
        print(f"[send_otp] Resend send took {time.monotonic() - send_started:.1f}s")

    except Exception as e:
        cache.delete(f'otp_{email}')
        cache.delete(f'otp_cooldown_{email}')
        print(f"Resend Error after {time.monotonic() - send_started:.1f}s: {str(e)}")
        return JsonResponse({'error': f'Failed to send email: {str(e)}'}, status=500)

    return JsonResponse({'message': 'Verification code sent to your email.'}, status=200)


@csrf_exempt
def verify_otp(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)
    try:
        body = json.loads(request.body)
    except Exception:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    email = body.get('email', '').strip().lower()
    otp_code = body.get('otp', '').strip()

    if not email or not otp_code:
        return JsonResponse({'error': 'Email and code are required.'}, status=400)

    stored = cache.get(f'otp_{email}')
    if stored is None:
        return JsonResponse({'error': 'Code expired or not found. Please request a new one.'}, status=400)
    if stored != otp_code:
        return JsonResponse({'error': 'Incorrect code. Please try again.'}, status=400)

    cache.delete(f'otp_{email}')
    cache.delete(f'otp_cooldown_{email}')
    return JsonResponse({'message': 'Email verified successfully.'}, status=200)


# ─────────────────────────────────────────────────────────────
# CHANGE EMAIL (signed-in users; the new address must be verified)
# ─────────────────────────────────────────────────────────────
EMAIL_RE = r'^[^\s@]+@[^\s@]+\.[^\s@]+$'
EMAIL_CHANGE_TTL = 600        # code valid for 10 minutes
EMAIL_CHANGE_COOLDOWN = 60    # one code per minute
EMAIL_CHANGE_MAX_TRIES = 5    # wrong guesses before the code is thrown away


def _code_email_html(code, heading, message):
    """Branded email body with a large one-time code."""
    return f"""
    <!DOCTYPE html>
    <html><body style="margin:0; padding:0; background-color:#f4f7f4; font-family:'Segoe UI', Arial, sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f7f4; padding:30px 0;">
        <tr><td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0"
                 style="background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,0.08);">
            <tr><td style="background-color:#0F4A2F; padding:20px; text-align:center;">
              <h1 style="color:white; margin:0; font-family:Arial, sans-serif;">PlantScope</h1>
            </td></tr>
            <tr><td style="padding:40px 40px 30px 40px; text-align:center;">
              <h1 style="margin:0 0 10px 0; color:#2d5a2d; font-size:22px; font-weight:600;">{heading}</h1>
              <p style="margin:0 0 25px 0; color:#555555; font-size:15px; line-height:1.6;">{message}</p>
              <div style="background:#eaf5ea; border:2px dashed #2d5a2d; border-radius:10px; padding:20px; margin:0 auto 25px auto; max-width:320px;">
                <span style="font-size:36px; font-weight:700; letter-spacing:8px; color:#2d5a2d; font-family:'Courier New', monospace;">{code}</span>
              </div>
              <p style="margin:0; color:#555555; font-size:14px; line-height:1.6;">
                This code expires in <strong>10 minutes</strong>. Do not share it with anyone.
              </p>
              <p style="margin:20px 0 0 0; color:#999999; font-size:13px;">If you did not request this, you can ignore this email.</p>
            </td></tr>
            <tr><td style="background-color:#2d5a2d; padding:18px 40px; text-align:center;">
              <p style="margin:0; color:#ffffff; font-size:13px;">PlantScope — Identify. Explore. Grow.</p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body></html>
    """


def _signed_in_user(request):
    from .helper import get_user_from_token
    try:
        return get_user_from_token(request)
    except Exception:
        return None


def _json_body(request):
    try:
        return json.loads(request.body or b'{}')
    except Exception:
        return None


@csrf_exempt
def request_email_change(request):
    """Step 1: send a 6-digit code to the new email address."""
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)
    user = _signed_in_user(request)
    if not user:
        return JsonResponse({'error': 'Please log in again.'}, status=401)
    body = _json_body(request)
    if body is None:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    new_email = (body.get('email') or '').strip().lower()
    if not re.match(EMAIL_RE, new_email):
        return JsonResponse({'error': 'Enter a valid email address.'}, status=400)
    if new_email == (user.email or '').lower():
        return JsonResponse({'error': 'This is already your email address.'}, status=400)
    if User.objects.filter(email__iexact=new_email).exclude(id=user.id).exists():
        return JsonResponse({'error': 'This email is already used by another account.'}, status=400)
    if cache.get(f'email_change_cooldown_{user.id}'):
        return JsonResponse({'error': 'Please wait a minute before requesting a new code.'}, status=429)

    code = ''.join(random.choices(string.digits, k=6))
    cache.set(f'email_change_{user.id}', {'email': new_email, 'code': code, 'tries': 0}, timeout=EMAIL_CHANGE_TTL)
    cache.set(f'email_change_cooldown_{user.id}', True, timeout=EMAIL_CHANGE_COOLDOWN)

    try:
        resend.Emails.send({
            "from": "PlantScope <noreply@plantscope.org>",
            "to": [new_email],
            "subject": "PlantScope – Confirm your new email",
            "html": _code_email_html(
                code, "Confirm your new email",
                "Someone asked to use this address for a PlantScope account.<br>"
                "Enter this code in PlantScope to confirm the change:",
            ),
        })
    except Exception as e:
        cache.delete(f'email_change_{user.id}')
        cache.delete(f'email_change_cooldown_{user.id}')
        print(f"[request_email_change] Resend error: {e}")
        return JsonResponse({'error': 'Could not send the code. Please try again shortly.'}, status=500)

    return JsonResponse({'message': f'A verification code was sent to {new_email}.',
                         'expires_in': EMAIL_CHANGE_TTL, 'resend_in': EMAIL_CHANGE_COOLDOWN}, status=200)


@csrf_exempt
def confirm_email_change(request):
    """Step 2: check the code and switch the account to the new email."""
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)
    user = _signed_in_user(request)
    if not user:
        return JsonResponse({'error': 'Please log in again.'}, status=401)
    body = _json_body(request)
    if body is None:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    new_email = (body.get('email') or '').strip().lower()
    code = (body.get('otp') or '').strip()
    pending = cache.get(f'email_change_{user.id}')
    if not pending or pending['email'] != new_email:
        return JsonResponse({'error': 'Code expired or not found. Please request a new one.'}, status=400)
    if pending['code'] != code:
        pending['tries'] += 1
        if pending['tries'] >= EMAIL_CHANGE_MAX_TRIES:
            cache.delete(f'email_change_{user.id}')
            return JsonResponse({'error': 'Too many wrong codes. Please request a new one.'}, status=400)
        cache.set(f'email_change_{user.id}', pending, timeout=EMAIL_CHANGE_TTL)
        left = EMAIL_CHANGE_MAX_TRIES - pending['tries']
        return JsonResponse({'error': f'Incorrect code. {left} attempt(s) left.'}, status=400)

    # Someone may have taken the address while the code was pending
    if User.objects.filter(email__iexact=new_email).exclude(id=user.id).exists():
        cache.delete(f'email_change_{user.id}')
        return JsonResponse({'error': 'This email is already used by another account.'}, status=400)

    old_email = user.email
    user.email = new_email
    user.save(update_fields=['email'])
    cache.delete(f'email_change_{user.id}')
    cache.delete(f'email_change_cooldown_{user.id}')

    # Let the old address know, in case the change was not made by its owner
    try:
        resend.Emails.send({
            "from": "PlantScope <noreply@plantscope.org>",
            "to": [old_email],
            "subject": "PlantScope – Your email was changed",
            "html": f"<p>Your PlantScope account email was changed to <b>{new_email}</b>.</p>"
                    "<p>If you did not do this, contact the City ENRO office right away.</p>",
        })
    except Exception as e:
        print(f"[confirm_email_change] could not notify old email: {e}")

    return JsonResponse({'message': 'Email updated.', 'email': new_email}, status=200)
