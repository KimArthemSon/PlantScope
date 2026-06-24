import random
import string
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.core.cache import cache
from django.core.mail import send_mail
import json
import re
from django.conf import settings

from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from email.mime.image import MIMEImage
import os


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

    # Rate-limit: block if a fresh OTP was sent in the last 60 seconds
    if cache.get(f'otp_cooldown_{email}'):
        return JsonResponse({'error': 'Please wait before requesting a new code.'}, status=429)

    otp_code = ''.join(random.choices(string.digits, k=6))
    cache.set(f'otp_{email}', otp_code, timeout=600)       # 10-minute TTL
    cache.set(f'otp_cooldown_{email}', True, timeout=60)   # 60-second resend lock

    # --- Build HTML email with banner ---
    banner_path = os.path.join(settings.BASE_DIR, 'static', 'images', 'plantscope_banner.png')
    print(banner_path)
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

              <!-- Banner -->
              <tr>
                <td style="padding:0; line-height:0;">
                  <img src="cid:plantscope_banner" alt="PlantScope"
                       style="width:100%; height:auto; display:block;">
                </td>
              </tr>

              <!-- Body -->
              <tr>
                <td style="padding:40px 40px 30px 40px; text-align:center;">
                  <h1 style="margin:0 0 10px 0; color:#2d5a2d; font-size:22px; font-weight:600;">
                    Email Verification
                  </h1>
                  <p style="margin:0 0 25px 0; color:#555555; font-size:15px; line-height:1.6;">
                    Hello,<br>
                    Your PlantScope verification code is:
                  </p>

                  <!-- OTP Code Box -->
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

              <!-- Footer -->
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

    # Plain-text fallback for clients that don't render HTML
    text_content = (
        f"Hello,\n\n"
        f"Your PlantScope verification code is: {otp_code}\n\n"
        f"This code expires in 10 minutes. Do not share it with anyone.\n\n"
        f"If you did not request this code, please ignore this email.\n\n"
        f"— PlantScope System"
    )

    try:
        msg = EmailMultiAlternatives(
            subject='PlantScope – Email Verification Code',
            body=text_content,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[email],
        )
        msg.attach_alternative(html_content, "text/html")

        # Attach banner image inline (referenced via cid:plantscope_banner in HTML)
        if os.path.exists(banner_path):
            with open(banner_path, 'rb') as f:
                banner_img = MIMEImage(f.read(), _subtype='png')
            banner_img.add_header('Content-ID', '<plantscope_banner>')
            banner_img.add_header('Content-Disposition', 'inline', filename='plantscope_banner.png')
            msg.attach(banner_img)

        msg.send(fail_silently=False)

    except Exception as e:
        cache.delete(f'otp_{email}')
        cache.delete(f'otp_cooldown_{email}')
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

