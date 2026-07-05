"""
Reusable email notification service for PlantScope.
Sends branded HTML emails to tree growers at key workflow milestones.
"""
import os
import logging
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from email.mime.image import MIMEImage
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

# Banner image path (reuse from your OTP email)
BANNER_PATH = os.path.join(settings.BASE_DIR, 'static', 'images', 'plantscope_banner.png')


def _get_banner_cid():
    """Attach banner image and return its Content-ID for inline use."""
    if not os.path.exists(BANNER_PATH):
        return None
    with open(BANNER_PATH, 'rb') as f:
        banner_img = MIMEImage(f.read(), _subtype='png')
    banner_img.add_header('Content-ID', '<plantscope_banner>')
    banner_img.add_header('Content-Disposition', 'inline', filename='plantscope_banner.png')
    return banner_img


def _send_email(subject, to_email, html_content, text_content):
    """
    Core email sender. Handles attachment and delivery.
    Returns True on success, False on failure.
    """
    try:
        msg = EmailMultiAlternatives(
            subject=subject,
            body=text_content,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[to_email],
        )
        msg.attach_alternative(html_content, "text/html")

        banner = _get_banner_cid()
        if banner:
            msg.attach(banner)

        msg.send(fail_silently=False)
        logger.info(f"Email sent to {to_email}: {subject}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {str(e)}")
        return False


# ─────────────────────────────────────────────────────────────────────────────
# EMAIL TEMPLATES
# ─────────────────────────────────────────────────────────────────────────────

def _base_html(body_html, greeting="Hello"):
    """Wraps body content in the branded PlantScope email template."""
    return f"""
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
                  <img src="cid:plantscope_banner" alt="PlantScope"
                       style="width:100%; height:auto; display:block;">
                </td>
              </tr>

              <tr>
                <td style="padding:40px 40px 30px 40px;">
                  <p style="margin:0 0 20px 0; color:#555555; font-size:15px; line-height:1.6;">
                    {greeting},
                  </p>
                  {body_html}
                  <p style="margin:30px 0 0 0; color:#999999; font-size:13px; line-height:1.5;">
                    Best regards,<br>
                    <strong style="color:#2d5a2d;">PlantScope System</strong><br>
                    City ENRO — Ormoc City
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


# ─────────────────────────────────────────────────────────────────────────────
# PUBLIC API
# ─────────────────────────────────────────────────────────────────────────────

def send_application_accepted_email(user, application):
    """
    Sent when the City ENRO Head accepts an application.
    Includes orientation date and site details if available.
    """
    if not user or not user.email:
        return False

    first_name = ""
    if hasattr(user, 'profile') and user.profile:
        first_name = user.profile.first_name or ""

    greeting = f"Hello {first_name}" if first_name else "Hello"
    app_title = application.title or "Your Tree Planting Program"

    # Build orientation info
    orientation_html = ""
    if application.orientation_date:
        formatted_date = application.orientation_date.strftime("%B %d, %Y")
        orientation_html = f"""
        <div style="background:#fff8e1; border-left:4px solid #f59e0b; padding:15px; margin:20px 0; border-radius:6px;">
          <p style="margin:0; color:#92400e; font-size:14px;">
            📅 <strong>Orientation Date:</strong> {formatted_date}<br>
            <span style="font-size:13px;">Please be present on this date for program orientation.</span>
          </p>
        </div>
        """

    # Build site info
    site_html = ""
    if application.site:
        site_name = application.site.name or "Assigned Site"
        barangay = ""
        if application.site.reforestation_area and application.site.reforestation_area.barangay:
            barangay = f", {application.site.reforestation_area.barangay.name}"
        area = f"{application.site.total_area_hectares} hectares" if application.site.total_area_hectares else ""
        site_html = f"""
        <div style="background:#eaf5ea; border-left:4px solid #10b981; padding:15px; margin:20px 0; border-radius:6px;">
          <p style="margin:0 0 5px 0; color:#065f46; font-size:14px;">
            📍 <strong>Assigned Site:</strong> {site_name}{barangay}
          </p>
          {f'<p style="margin:0; color:#065f46; font-size:13px;">🌳 Area: {area}</p>' if area else ''}
        </div>
        """

    body_html = f"""
      <h1 style="margin:0 0 15px 0; color:#2d5a2d; font-size:22px; font-weight:600;">
        🎉 Congratulations! Your Application Has Been Approved
      </h1>
      <p style="margin:0 0 15px 0; color:#555555; font-size:15px; line-height:1.6;">
        We are pleased to inform you that your tree planting program application 
        <strong>"{app_title}"</strong> has been <strong style="color:#10b981;">approved</strong> 
        by the City ENRO Head.
      </p>
      {site_html}
      {orientation_html}
      <p style="margin:15px 0 0 0; color:#555555; font-size:14px; line-height:1.6;">
        Please coordinate with the ENRO office for the next steps of your reforestation program.
        We look forward to your contribution to Ormoc City's greening efforts! 🌱
      </p>
    """

    html_content = _base_html(body_html, greeting)
    text_content = (
        f"{greeting},\n\n"
        f"Congratulations! Your application '{app_title}' has been approved.\n\n"
        f"Please coordinate with the ENRO office for the next steps.\n\n"
        f"— PlantScope System"
    )

    return _send_email(
        subject="PlantScope – Your Application Has Been Approved! 🎉",
        to_email=user.email,
        html_content=html_content,
        text_content=text_content,
    )


def send_application_rejected_email(user, application, reason_text=""):
    """Sent when the City ENRO Head rejects an application."""
    if not user or not user.email:
        return False

    first_name = ""
    if hasattr(user, 'profile') and user.profile:
        first_name = user.profile.first_name or ""
    greeting = f"Hello {first_name}" if first_name else "Hello"
    app_title = application.title or "Your Tree Planting Program"

    reason_html = ""
    if reason_text:
        reason_html = f"""
        <div style="background:#fef2f2; border-left:4px solid #ef4444; padding:15px; margin:20px 0; border-radius:6px;">
          <p style="margin:0 0 5px 0; color:#991b1b; font-size:14px;"><strong>Reason:</strong></p>
          <p style="margin:0; color:#7f1d1d; font-size:14px; font-style:italic;">"{reason_text}"</p>
        </div>
        """

    body_html = f"""
      <h1 style="margin:0 0 15px 0; color:#991b1b; font-size:22px; font-weight:600;">
        Application Update
      </h1>
      <p style="margin:0 0 15px 0; color:#555555; font-size:15px; line-height:1.6;">
        We regret to inform you that your tree planting program application 
        <strong>"{app_title}"</strong> was <strong style="color:#ef4444;">not approved</strong> 
        at this time.
      </p>
      {reason_html}
      <p style="margin:15px 0 0 0; color:#555555; font-size:14px; line-height:1.6;">
        You may review the requirements and submit a new application in the future. 
        Thank you for your interest in contributing to Ormoc City's reforestation efforts.
      </p>
    """

    html_content = _base_html(body_html, greeting)
    text_content = (
        f"{greeting},\n\n"
        f"Your application '{app_title}' was not approved.\n"
        f"{'Reason: ' + reason_text if reason_text else ''}\n\n"
        f"— PlantScope System"
    )

    return _send_email(
        subject="PlantScope – Application Update",
        to_email=user.email,
        html_content=html_content,
        text_content=text_content,
    )


def send_program_completed_email(user, application):
    """Sent when DataManager marks a program as completed."""
    if not user or not user.email:
        return False

    first_name = ""
    if hasattr(user, 'profile') and user.profile:
        first_name = user.profile.first_name or ""
    greeting = f"Hello {first_name}" if first_name else "Hello"
    app_title = application.title or "Your Tree Planting Program"

    body_html = f"""
      <h1 style="margin:0 0 15px 0; color:#2d5a2d; font-size:22px; font-weight:600;">
         Program Successfully Completed!
      </h1>
      <p style="margin:0 0 15px 0; color:#555555; font-size:15px; line-height:1.6;">
        Congratulations! Your tree planting program 
        <strong>"{app_title}"</strong> has been marked as 
        <strong style="color:#10b981;">completed</strong>.
      </p>
      <div style="background:#eaf5ea; border-left:4px solid #10b981; padding:15px; margin:20px 0; border-radius:6px;">
        <p style="margin:0; color:#065f46; font-size:14px;">
          🌳 Thank you for your valuable contribution to Ormoc City's reforestation efforts. 
          Your group's dedication helps build a greener, healthier community.
        </p>
      </div>
      <p style="margin:15px 0 0 0; color:#555555; font-size:14px; line-height:1.6;">
        As a returning grower, you are now eligible to apply for future tree planting programs. 
        We look forward to partnering with you again! 🌱
      </p>
    """

    html_content = _base_html(body_html, greeting)
    text_content = (
        f"{greeting},\n\n"
        f"Congratulations! Your program '{app_title}' has been completed.\n"
        f"Thank you for your contribution to Ormoc City's reforestation efforts.\n\n"
        f"— PlantScope System"
    )

    return _send_email(
        subject="PlantScope – Program Completed Successfully! 🏆",
        to_email=user.email,
        html_content=html_content,
        text_content=text_content,
    )


def send_program_failed_email(user, application, reason_text=""):
    """Sent when DataManager marks a program as failed."""
    if not user or not user.email:
        return False

    first_name = ""
    if hasattr(user, 'profile') and user.profile:
        first_name = user.profile.first_name or ""
    greeting = f"Hello {first_name}" if first_name else "Hello"
    app_title = application.title or "Your Tree Planting Program"

    reason_html = ""
    if reason_text:
        reason_html = f"""
        <div style="background:#fef2f2; border-left:4px solid #ef4444; padding:15px; margin:20px 0; border-radius:6px;">
          <p style="margin:0 0 5px 0; color:#991b1b; font-size:14px;"><strong>Reason:</strong></p>
          <p style="margin:0; color:#7f1d1d; font-size:14px; font-style:italic;">"{reason_text}"</p>
        </div>
        """

    body_html = f"""
      <h1 style="margin:0 0 15px 0; color:#991b1b; font-size:22px; font-weight:600;">
        Program Update
      </h1>
      <p style="margin:0 0 15px 0; color:#555555; font-size:15px; line-height:1.6;">
        Your tree planting program <strong>"{app_title}"</strong> has been marked as 
        <strong style="color:#ef4444;">failed</strong>.
      </p>
      {reason_html}
      <p style="margin:15px 0 0 0; color:#555555; font-size:14px; line-height:1.6;">
        Please coordinate with the ENRO office to discuss next steps or remedial actions.
      </p>
    """

    html_content = _base_html(body_html, greeting)
    text_content = (
        f"{greeting},\n\n"
        f"Your program '{app_title}' has been marked as failed.\n"
        f"{'Reason: ' + reason_text if reason_text else ''}\n\n"
        f"— PlantScope System"
    )

    return _send_email(
        subject="PlantScope – Program Update",
        to_email=user.email,
        html_content=html_content,
        text_content=text_content,
    )


def send_seedling_request_accepted_email(user, application, seedling_request):
    """Sent when DataManager approves a seedling request."""
    if not user or not user.email:
        return False

    first_name = ""
    if hasattr(user, 'profile') and user.profile:
        first_name = user.profile.first_name or ""
    greeting = f"Hello {first_name}" if first_name else "Hello"
    app_title = application.title or "Your Program"
    total_seedlings = seedling_request.no_request_seedling or 0

    body_html = f"""
      <h1 style="margin:0 0 15px 0; color:#2d5a2d; font-size:22px; font-weight:600;">
         Seedling Request Approved!
      </h1>
      <p style="margin:0 0 15px 0; color:#555555; font-size:15px; line-height:1.6;">
        Good news! Your additional seedling request for 
        <strong>"{app_title}"</strong> has been <strong style="color:#10b981;">approved</strong>.
      </p>
      <div style="background:#eaf5ea; border-left:4px solid #10b981; padding:15px; margin:20px 0; border-radius:6px;">
        <p style="margin:0 0 5px 0; color:#065f46; font-size:14px;">
          🌳 <strong>Total Seedlings Approved:</strong> {total_seedlings:,}
        </p>
      </div>
      <p style="margin:15px 0 0 0; color:#555555; font-size:14px; line-height:1.6;">
        Please coordinate with the ENRO Nursery to schedule the pickup/distribution of your seedlings.
        Kindly bring your valid ID and application reference when claiming.
      </p>
    """

    html_content = _base_html(body_html, greeting)
    text_content = (
        f"{greeting},\n\n"
        f"Your seedling request for '{app_title}' has been approved.\n"
        f"Total seedlings approved: {total_seedlings:,}\n\n"
        f"Please coordinate with the ENRO Nursery for pickup.\n\n"
        f"— PlantScope System"
    )

    return _send_email(
        subject=f"PlantScope – Seedling Request Approved ({total_seedlings:,} seedlings) 🌱",
        to_email=user.email,
        html_content=html_content,
        text_content=text_content,
    )


def send_seedling_request_rejected_email(user, application, seedling_request, reason_text=""):
    """Sent when DataManager rejects a seedling request."""
    if not user or not user.email:
        return False

    first_name = ""
    if hasattr(user, 'profile') and user.profile:
        first_name = user.profile.first_name or ""
    greeting = f"Hello {first_name}" if first_name else "Hello"
    app_title = application.title or "Your Program"

    reason_html = ""
    if reason_text:
        reason_html = f"""
        <div style="background:#fef2f2; border-left:4px solid #ef4444; padding:15px; margin:20px 0; border-radius:6px;">
          <p style="margin:0 0 5px 0; color:#991b1b; font-size:14px;"><strong>Reason:</strong></p>
          <p style="margin:0; color:#7f1d1d; font-size:14px; font-style:italic;">"{reason_text}"</p>
        </div>
        """

    body_html = f"""
      <h1 style="margin:0 0 15px 0; color:#991b1b; font-size:22px; font-weight:600;">
        Seedling Request Update
      </h1>
      <p style="margin:0 0 15px 0; color:#555555; font-size:15px; line-height:1.6;">
        Your additional seedling request for <strong>"{app_title}"</strong> was 
        <strong style="color:#ef4444;">not approved</strong> at this time.
      </p>
      {reason_html}
      <p style="margin:15px 0 0 0; color:#555555; font-size:14px; line-height:1.6;">
        You may submit a new request after addressing the concerns above. 
        Thank you for your understanding.
      </p>
    """

    html_content = _base_html(body_html, greeting)
    text_content = (
        f"{greeting},\n\n"
        f"Your seedling request for '{app_title}' was not approved.\n"
        f"{'Reason: ' + reason_text if reason_text else ''}\n\n"
        f"— PlantScope System"
    )

    return _send_email(
        subject="PlantScope – Seedling Request Update",
        to_email=user.email,
        html_content=html_content,
        text_content=text_content,
    )

def send_application_evaluated_email(user, application):
    """Sent when DataManager evaluates application and forwards to Head."""
    if not user or not user.email:
        return False

    first_name = ""
    if hasattr(user, 'profile') and user.profile:
        first_name = user.profile.first_name or ""
    greeting = f"Hello {first_name}" if first_name else "Hello"
    app_title = application.title or "Your Tree Planting Program"

    # ✅ FIX: Safely handle orientation_date whether it's a string or a date object
    orientation_html = ""
    if application.orientation_date:
        if isinstance(application.orientation_date, str):
            # If it's a string, try to parse it, otherwise just use the string
            try:
                parsed_date = datetime.strptime(application.orientation_date, '%Y-%m-%d').date()
                formatted_date = parsed_date.strftime("%B %d, %Y")
            except ValueError:
                formatted_date = application.orientation_date
        else:
            # If it's already a date object
            formatted_date = application.orientation_date.strftime("%B %d, %Y")

        orientation_html = f"""
        <div style="background:#fff8e1; border-left:4px solid #f59e0b; padding:15px; margin:20px 0; border-radius:6px;">
          <p style="margin:0; color:#92400e; font-size:14px;">
            📅 <strong>Scheduled Orientation Date:</strong> {formatted_date}<br>
            <span style="font-size:13px;">Please be present on this date.</span>
          </p>
        </div>
        """

    # Build site info
    site_html = ""
    if application.site:
        site_name = application.site.name or "Assigned Site"
        barangay = ""
        if application.site.reforestation_area and application.site.reforestation_area.barangay:
            barangay = f", {application.site.reforestation_area.barangay.name}"
        area = f"{application.site.total_area_hectares} hectares" if application.site.total_area_hectares else ""
        site_html = f"""
        <div style="background:#eaf5ea; border-left:4px solid #10b981; padding:15px; margin:20px 0; border-radius:6px;">
          <p style="margin:0 0 5px 0; color:#065f46; font-size:14px;">
            📍 <strong>Assigned Site:</strong> {site_name}{barangay}
          </p>
          {f'<p style="margin:0; color:#065f46; font-size:13px;">🌳 Area: {area}</p>' if area else ''}
        </div>
        """

    body_html = f"""
      <h1 style="margin:0 0 15px 0; color:#2d5a2d; font-size:22px; font-weight:600;">
        📋 Application Evaluated & Forwarded
      </h1>
      <p style="margin:0 0 15px 0; color:#555555; font-size:15px; line-height:1.6;">
        Your tree planting program application <strong>"{app_title}"</strong> has been evaluated by the Data Manager and forwarded to the City ENRO Head for final approval.
      </p>
      {site_html}
      {orientation_html}
      <p style="margin:15px 0 0 0; color:#555555; font-size:14px; line-height:1.6;">
        You will receive another email once the Head has made a final decision.
      </p>
    """

    html_content = _base_html(body_html, greeting)
    text_content = (
        f"{greeting},\n\n"
        f"Your application '{app_title}' has been evaluated and forwarded to the Head.\n\n"
        f"— PlantScope System"
    )

    return _send_email(
        subject="PlantScope – Application Evaluated & Forwarded to Head 📋",
        to_email=user.email,
        html_content=html_content,
        text_content=text_content,
    )