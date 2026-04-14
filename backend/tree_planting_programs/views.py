from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from .models import Application, Reason
from django.shortcuts import get_object_or_404
import math
from sites.models import Sites
from django.db import transaction
from accounts.helper import get_user_from_token
from accounts.models import User
# Create your views here.
@csrf_exempt
def get_applications(request):

    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET Allowed!'}, status=401)
    
    status = request.GET.get('status','All')
    classification = request.GET.get('classification', 'All')
    
    search = request.GET.get('search', '').strip()
    entries = int(request.GET.get('entries', 10))
    page = int(request.GET.get('page', 1))
    
    if entries <= 0:
        entries = 10
    if page <= 0:
        page = 1
    
    offset = (page - 1) * entries
    applications = Application.objects.all()
    total = applications.count()

    total_page = math.ceil(total / entries) if total > 0 else 0
    if status != 'All':
        applications = applications.filter(status=status)
    if classification != 'All':
        applications = applications.filter(classification=classification)
    if search:
        applications = applications.filter(organization_name__icontains=search)
    
    applications = applications.order_by('-created_at')
    applications = applications[offset:offset+entries]

    data = [
        {
          "application_id": application.application_id,
          "organization_name": application.user.organization.organization_name,
          "org_email": application.user.organization.email,
          "org_profile": application.user.organization.profile_img.url if application.user.organization.profile_img else None,
          "title": application.title,
          "description": application.description,
          "total_request_seedling": application.total_request_seedling,
          "created_at": application.created_at,
        } for application in applications
    ]

    return JsonResponse({
        'data': data,
        'total_page': total_page,
        'page': page,
        'entries': entries,
        'total': total
    }, status=200)
    
@csrf_exempt
def get_application(request, application_id):

    if request.method != 'GET':
        return JsonResponse({"error": 'Only GET Allowed!'}, status=401)
    
    application = get_object_or_404(Application, application_id=application_id)
    data = {
        "account": {
          "account_id": application.user.id,
          "email": application.user.email,
        },
        "organization_information": {
          "organization_id": application.user.organization.id,
          "organization_name": application.user.organization.organization_name,
          "org_email": application.user.organization.email,
          "org_address": application.user.organization.email,
          "org_contact": application.user.organization.email,
          "org_profile": application.user.organization.profile_img.url if application.user.organization.profile_img else None,
          "created_at": application.created_at,
        },
        "application": {
          "application_id": application.application_id,
          "title": application.title,
          "description": application.description,
          "total_request_seedling": application.total_request_seedling,
          "maintenance_plan": application.maintenance_plan.url if application.maintenance_plan else None,
          "agreement_image": application.agreement_image.url if application.agreement_image else None,
          "total_seedling_provided": application.total_seedling_provided,
          "total_area_planted": application.total_seedling_provided,
          "total_seedling_survived": application.total_seedling_provided,
          "total_seedling_planted": application.total_seedling_provided,
          "updated_at": application.updated_at,
          "created_at": application.created_at,
        },
        "profile": None
    }

    
    if application.status == 'new':
        data.profile = {
            "full_name": f"{application.user.profile.first_name} {application.user.profile.middle_name} {application.user.profile.last_name}",
            "birthday": application.user.profile.birthday,
            "gender": application.user.profile.gender,
            "contact": application.user.profile.contact,
            "address": application.user.profile.address,
            "profile_img": application.user.profile.profile_img.url if application.user.profile.profile_img else None,
        }
    return JsonResponse(data, status=200)

@csrf_exempt
def evaluate_application(request):

    if request.method != 'PUT':
        return JsonResponse({'error': "Only PUT Allowed"}, status=401)
    
    user = get_user_from_token(request)
    if not user:
            return JsonResponse({'error': 'Unauthorized'}, status=403)
    
    #data manager
    application_id = int(request.POST.get('application_id',0))
    site_id = int(request.POST.get('site_id',0))
    total_seedling_provided = int(request.POST.get('total_seedling_provided',0))
    orientation_date = request.POST.get('orientation_date',"")
    agreement_image = request.FILES.get("agreement_image")
    reason = request.POST.get("reason", "")

    application = get_object_or_404(Application, application_id=application_id)
    
    if application.classification == 'new':
        application.user.is_active = True

    application.classification = 'old'
    application.status = 'for_head'
    application.orientation_date = orientation_date
    if not(total_seedling_provided and agreement_image):
        return JsonResponse({'error': "Missing fields, please try again!"}, status=400)
        
    application.total_seedling_provided = total_seedling_provided
    site = get_object_or_404(Sites, site_id=site_id)
    application.site = site

    try:
        with transaction.atomic():
            user = get_object_or_404(User, id=user.user_id)
            application.save()
            Reason.objects.create(
                user=user,
                application=application,
                reason=reason
            )
    except Exception as e:
        return JsonResponse({'error': "Error"})
    
    application.save()

    return JsonResponse({'message': "Successfully forwarded to Head"})

@csrf_exempt
def confirmation_application(request):

    if request.method != 'PUT':
        return JsonResponse({'error': "Only PUT Allowed"}, status=401)
    
    user = get_user_from_token(request)
    if not user:
            return JsonResponse({'error': 'Unauthorized'}, status=403)
    
    #data manager
    application_id = int(request.POST.get('application_id',0))
    reason = request.POST.get("reason", "")
    status = request.POST.get("status", "")
    
    application = get_object_or_404(Application, application_id=application_id)
    application.status = status
    
    try:
        with transaction.atomic():
            user = get_object_or_404(User, id=user.user_id)
            application.save()
            Reason.objects.create(
                user=user,
                application=application,
                reason=reason
            )
    except Exception as e:
        return JsonResponse({'error': "Error"})
    
    application.save()
    
    
    return JsonResponse({'message': "Successfully Decided!"})

@csrf_exempt
def create_maintenance_report(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Only GET Allowed'}, status=401)
    
     
# @csrf_exempt
# def evaluate_miantenance_report(request):


    
    
   




