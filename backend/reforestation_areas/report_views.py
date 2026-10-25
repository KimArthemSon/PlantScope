from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.db.models import Count, Q, Sum, Avg, F
from django.utils import timezone
from datetime import datetime, timedelta
from Field_assessment.models import (
    Field_assessment, 
    Field_assessment_images,
    Assigned_onsite_inspector
)
from sites.models import Sites, SiteMetaDataVerification
from reforestation_areas.models import Reforestation_areas
from accounts.models import User
from hazard_areas.models import HazardArea
from accounts.helper import get_user_from_token
import json

import logging
logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────
# GIS SPECIALIST REPORTS (Used by Reports Page)
# ─────────────────────────────────────────────

@csrf_exempt
def get_gis_specialist_dashboard(request):
    """
    GET: Main dashboard metrics for GIS Specialist Reports Page
    Returns key stats, layer breakdowns, and recent assessments
    """
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    
    try:
        user = get_user_from_token(request)
        if not user or user.user_role != "GISSpecialist":
            return JsonResponse({'error': 'Unauthorized'}, status=403)

        # ── 1. KEY METRICS ─────────────────────────────────
        
        # Total Assessments (split by General/Specific)
        total_assessments = Field_assessment.objects.filter(is_submitted=True).count()
        general_assessments = Field_assessment.objects.filter(
            is_submitted=True, site__isnull=True
        ).count()
        specific_assessments = Field_assessment.objects.filter(
            is_submitted=True, site__isnull=False
        ).count()

        # Total Sites by Status
        sites_by_status = Sites.objects.aggregate(
            pending=Count('site_id', filter=Q(status='pending')),
            under_review=Count('site_id', filter=Q(status='under_review')),
            accepted=Count('site_id', filter=Q(status='accepted')),
            rejected=Count('site_id', filter=Q(status='rejected')),
            completed=Count('site_id', filter=Q(monitoring_status='completed')),
            under_monitoring=Count('site_id', filter=Q(monitoring_status='under_monitoring')),
        )
        total_sites = Sites.objects.count()

        # Total Reforestation Areas
        total_areas = Reforestation_areas.objects.filter(deleted_at__isnull=True).count()

        # Active Inspectors
        active_inspectors = User.objects.filter(
            user_role="OnsiteInspector",
            assigned_inspections__isnull=False
        ).distinct().count()

        # Verified Sites
        verified_sites = SiteMetaDataVerification.objects.filter(
            status='verified'
        ).count()

        # ── 2. ASSESSMENTS BY LAYER ────────────────────────
        
        assessments_with_meta = Field_assessment.objects.filter(
            is_submitted=True,
            field_assessment_data__has_key='meta_data'
        ).count()
        
        assessments_with_safety = Field_assessment.objects.filter(
            is_submitted=True,
            field_assessment_data__has_key='safety'
        ).count()
        
        assessments_with_survivability = Field_assessment.objects.filter(
            is_submitted=True,
            field_assessment_data__has_key='survivability'
        ).count()
        
        assessments_with_boundary = Field_assessment.objects.filter(
            is_submitted=True,
            field_assessment_data__has_key='boundary_verification'
        ).count()

        # ── 3. META DATA BREAKDOWN ─────────────────────────
        
        land_title_count = Field_assessment_images.objects.filter(layer='meta_land_title').count()
        tax_decl_count = Field_assessment_images.objects.filter(layer='meta_tax_decl').count()
        other_doc_count = Field_assessment_images.objects.filter(layer='meta_other_doc').count()

        # ── 4. SAFETY BREAKDOWN ────────────────────────────
        
        flood_count = Field_assessment_images.objects.filter(layer='safety_flood').count()
        landslide_count = Field_assessment_images.objects.filter(layer='safety_landslide').count()
        erosion_count = Field_assessment_images.objects.filter(layer='safety_erosion').count()
        safety_other_count = Field_assessment_images.objects.filter(layer='safety_other').count()

        # ── 5. SURVIVABILITY BREAKDOWN ─────────────────────
        
        soil_count = Field_assessment_images.objects.filter(layer='surv_soil').count()
        water_count = Field_assessment_images.objects.filter(layer='surv_water').count()
        animal_count = Field_assessment_images.objects.filter(layer='surv_animal').count()
        slope_count = Field_assessment_images.objects.filter(layer='surv_slope').count()

        # ── 6. VERIFICATION STATUS ─────────────────────────
        
        verification_status = SiteMetaDataVerification.objects.aggregate(
            pending=Count('id', filter=Q(status='pending')),
            draft=Count('id', filter=Q(status='draft')),
            verified=Count('id', filter=Q(status='verified')),
            rejected=Count('id', filter=Q(status='rejected')),
        )

        # ── 7. SAFETY ALERTS ───────────────────────────────
        
        high_risk_count = Field_assessment.objects.filter(
            is_submitted=True,
            field_assessment_data__has_key='meta_data'
        ).filter(
            Q(field_assessment_data__meta_data__security_concerns__selected__contains=['Armed Threat / Violence']) |
            Q(field_assessment_data__meta_data__security_concerns__selected__contains=['Hostile Person on Site'])
        ).count()

        # ── 8. RECENT ASSESSMENTS ──────────────────────────
        
        recent_assessments = Field_assessment.objects.filter(
            is_submitted=True
        ).select_related(
            'assigned_onsite_inspector__user',
            'assigned_onsite_inspector__reforestation_area',
            'site'
        ).prefetch_related('images').order_by('-created_at')[:10]
        
        recent_data = []
        for fa in recent_assessments:
            layers_present = []
            if fa.field_assessment_data.get('meta_data'):
                layers_present.append('Meta')
            if fa.field_assessment_data.get('safety'):
                layers_present.append('Safety')
            if fa.field_assessment_data.get('survivability'):
                layers_present.append('Survivability')
            if fa.field_assessment_data.get('boundary_verification'):
                layers_present.append('Boundary')
            
            # ✅ Include site status
            site_status_value = fa.site.status if fa.site else None
            
            recent_data.append({
                'field_assessment_id': fa.field_assessment_id,
                'inspector_name': fa.assigned_onsite_inspector.user.email if fa.assigned_onsite_inspector.user else 'Unknown',
                'area_name': fa.assigned_onsite_inspector.reforestation_area.name if fa.assigned_onsite_inspector.reforestation_area else 'N/A',
                'site_name': fa.site.name if fa.site else 'General Assessment',
                'site_status': site_status_value,
                'assessment_date': fa.assessment_date.isoformat() if fa.assessment_date else None,
                'type': 'Specific' if fa.site else 'General',
                'layers_present': layers_present,
                'image_count': fa.images.count(),
                'created_at': fa.created_at.isoformat(),
            })

        return JsonResponse({
            'stats': {
                'total_assessments': total_assessments,
                'general_assessments': general_assessments,
                'specific_assessments': specific_assessments,
                'total_sites': total_sites,
                'sites_by_status': sites_by_status,
                'total_areas': total_areas,
                'active_inspectors': active_inspectors,
                'verified_sites': verified_sites,
            },
            'layer_breakdown': {
                'meta_data': assessments_with_meta,
                'safety': assessments_with_safety,
                'survivability': assessments_with_survivability,
                'boundary_verification': assessments_with_boundary,
            },
            'meta_details': {
                'land_title': land_title_count,
                'tax_declaration': tax_decl_count,
                'other_documents': other_doc_count,
            },
            'safety_details': {
                'flood': flood_count,
                'landslide': landslide_count,
                'erosion': erosion_count,
                'other': safety_other_count,
            },
            'survivability_details': {
                'soil': soil_count,
                'water': water_count,
                'animal': animal_count,
                'slope': slope_count,
            },
            'verification_status': verification_status,
            'safety_alerts': {
                'high_risk_count': high_risk_count,
                'medium_risk_count': total_assessments - high_risk_count,
            },
            'recent_assessments': recent_data,
        }, status=200)

    except Exception as e:
        logger.error(f"Error in get_gis_specialist_dashboard: {e}", exc_info=True)
        return JsonResponse({'error': str(e)}, status=500)


# ─────────────────────────────────────────────
# GIS ASSESSMENTS LIST (Filterable Table)
# ─────────────────────────────────────────────

@csrf_exempt
def get_gis_assessments_list(request):
    """
    GET: Filterable list of assessments for the table
    Supports: date range, area, barangay, layer type, assessment type, site status
    """
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    
    try:
        user = get_user_from_token(request)
        if not user or user.user_role != "GISSpecialist":
            return JsonResponse({'error': 'Unauthorized'}, status=403)

        # ── Filters ────────────────────────────────────────
        
        date_from = request.GET.get('date_from')
        date_to = request.GET.get('date_to')
        area_id = request.GET.get('area_id')
        barangay_id = request.GET.get('barangay_id')
        layer_type = request.GET.get('layer_type')
        assessment_type = request.GET.get('type')
        site_status = request.GET.get('site_status')  # ✅ NEW: Filter by site status
        search = request.GET.get('search', '')
        
        page = int(request.GET.get('page', 1))
        entries = int(request.GET.get('entries', 10))

        # Base query
        qs = Field_assessment.objects.filter(
            is_submitted=True
        ).select_related(
            'assigned_onsite_inspector__user',
            'assigned_onsite_inspector__reforestation_area',
            'assigned_onsite_inspector__reforestation_area__barangay',
            'site',
            'site__reforestation_area',
            'site__reforestation_area__barangay'
        ).prefetch_related('images')

        # Apply filters
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from) if hasattr(qs, 'created_at__date__gte') else qs.filter(created_at__gte=f"{date_from} 00:00:00")
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to) if hasattr(qs, 'created_at__date__lte') else qs.filter(created_at__lte=f"{date_to} 23:59:59")
        
        if area_id:
            qs = qs.filter(assigned_onsite_inspector__reforestation_area_id=area_id)
        
        if barangay_id:
            qs = qs.filter(
                Q(assigned_onsite_inspector__reforestation_area__barangay_id=barangay_id) |
                Q(site__reforestation_area__barangay_id=barangay_id)
            )
        
        if assessment_type == 'general':
            qs = qs.filter(site__isnull=True)
        elif assessment_type == 'specific':
            qs = qs.filter(site__isnull=False)
        
        # ✅ NEW: Filter by site status
        if site_status:
            if site_status == 'general_only':
                qs = qs.filter(site__isnull=True)
            elif site_status == 'completed':
                qs = qs.filter(site__monitoring_status='completed')
            elif site_status == 'accepted':
                qs = qs.filter(site__status='accepted')
            elif site_status == 'pending':
                qs = qs.filter(site__status='pending')
            elif site_status == 'under_review':
                qs = qs.filter(site__status='under_review')
            elif site_status == 'rejected':
                qs = qs.filter(site__status='rejected')
            elif site_status == 'under_monitoring':
                qs = qs.filter(site__status='under_monitoring')
        
        if layer_type:
            layer_map = {
                'meta': 'meta_data',
                'safety': 'safety',
                'survivability': 'survivability',
                'boundary': 'boundary_verification',
            }
            layer_key = layer_map.get(layer_type)
            if layer_key:
                qs = qs.filter(field_assessment_data__has_key=layer_key)
        
        if search:
            qs = qs.filter(
                Q(assigned_onsite_inspector__user__email__icontains=search) |
                Q(assigned_onsite_inspector__reforestation_area__name__icontains=search) |
                Q(site__name__icontains=search)
            )

        # ── Pagination ────────────────────────────────────
        
        total = qs.count()
        total_page = (total + entries - 1) // entries
        
        start = (page - 1) * entries
        end = start + entries
        qs = qs.order_by('-created_at')[start:end]

        # ── Serialize ──────────────────────────────────────
        
        data = []
        for fa in qs:
            layers_present = []
            if fa.field_assessment_data.get('meta_data'):
                layers_present.append('Meta')
            if fa.field_assessment_data.get('safety'):
                layers_present.append('Safety')
            if fa.field_assessment_data.get('survivability'):
                layers_present.append('Survivability')
            if fa.field_assessment_data.get('boundary_verification'):
                layers_present.append('Boundary')
            
            # ✅ Safely get barangay name
            barangay_name = 'N/A'
            if fa.site and fa.site.reforestation_area and fa.site.reforestation_area.barangay:
                barangay_name = fa.site.reforestation_area.barangay.name
            elif fa.assigned_onsite_inspector.reforestation_area and fa.assigned_onsite_inspector.reforestation_area.barangay:
                barangay_name = fa.assigned_onsite_inspector.reforestation_area.barangay.name
            
            # ✅ Include site status in response
            site_status_value = fa.site.status if fa.site else None
            
            data.append({
                'field_assessment_id': fa.field_assessment_id,
                'inspector_email': fa.assigned_onsite_inspector.user.email if fa.assigned_onsite_inspector.user else 'Unknown',
                'area_name': fa.assigned_onsite_inspector.reforestation_area.name if fa.assigned_onsite_inspector.reforestation_area else 'N/A',
                'site_name': fa.site.name if fa.site else 'General',
                'site_status': site_status_value,
                'barangay': barangay_name,
                'assessment_date': fa.assessment_date.isoformat() if fa.assessment_date else None,
                'type': 'Specific' if fa.site else 'General',
                'layers_present': layers_present,
                'image_count': fa.images.count(),
                'created_at': fa.created_at.isoformat(),
            })

        return JsonResponse({
            'data': data,
            'total': total,
            'total_page': total_page,
            'current_page': page,
        }, status=200)

    except Exception as e:
        import traceback
        print(f"❌ Error in get_gis_assessments_list: {e}")
        traceback.print_exc()
        return JsonResponse({'error': str(e)}, status=500)
    

# ─────────────────────────────────────────────
# GIS SITES LIST (Filterable Table)
# ─────────────────────────────────────────────

@csrf_exempt
def get_gis_sites_list(request):
    """
    GET: Filterable list of sites for the table
    Supports: status, area, barangay, date range, search
    """
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    
    try:
        user = get_user_from_token(request)
        if not user or user.user_role != "GISSpecialist":
            return JsonResponse({'error': 'Unauthorized'}, status=403)

        # ── Filters ────────────────────────────────────────
        status_filter = request.GET.get('status')  # completed, accepted, pending, etc.
        area_id = request.GET.get('area_id')
        barangay_id = request.GET.get('barangay_id')
        date_from = request.GET.get('date_from')
        date_to = request.GET.get('date_to')
        search = request.GET.get('search', '')
        
        page = int(request.GET.get('page', 1))
        entries = int(request.GET.get('entries', 10))

        # Base query - only active sites
        qs = Sites.objects.filter(is_active=True).select_related(
            'reforestation_area',
            'reforestation_area__barangay',
            'meta_verification',
            'meta_verification__verified_land_classification'
        ).prefetch_related(
            'field_assessment'
        )

        # Apply filters
        if status_filter:
            qs = qs.filter(status=status_filter)
        
        if area_id:
            qs = qs.filter(reforestation_area_id=area_id)
        
        if barangay_id:
            qs = qs.filter(reforestation_area__barangay_id=barangay_id)
        
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)
        
        if search:
            qs = qs.filter(
                Q(name__icontains=search) |
                Q(reforestation_area__name__icontains=search) |
                Q(reforestation_area__barangay__name__icontains=search)
            )

        # ── Pagination ────────────────────────────────────
        total = qs.count()
        total_page = (total + entries - 1) // entries
        
        start = (page - 1) * entries
        end = start + entries
        qs = qs.order_by('-created_at')[start:end]

        # ── Serialize ──────────────────────────────────────
        data = []
        for site in qs:
            # Count assessments for this site
            assessments_count = Field_assessment.objects.filter(
                site=site,
                is_submitted=True
            ).count()
            
            # Get verification status
            verification_status = None
            try:
                if hasattr(site, 'meta_verification') and site.meta_verification:
                    verification_status = site.meta_verification.status
            except:
                verification_status = None
            
            # Get barangay name safely
            barangay_name = 'N/A'
            if site.reforestation_area and site.reforestation_area.barangay:
                barangay_name = site.reforestation_area.barangay.name
            
            # Get land classification if verified
            land_classification = None
            try:
                if (hasattr(site, 'meta_verification') and 
                    site.meta_verification and 
                    site.meta_verification.verified_land_classification):
                    land_classification = site.meta_verification.verified_land_classification.name
            except:
                land_classification = None
            
            data.append({
                'site_id': site.site_id,
                'name': site.name,
                'status': site.status,
                'status_display': site.get_status_display(),
                'area_hectares': float(site.total_area_hectares or 0),
                'seedlings_planted': site.total_seedlings_planted or 0,
                'barangay': barangay_name,
                'reforestation_area': site.reforestation_area.name if site.reforestation_area else 'N/A',
                'reforestation_area_id': site.reforestation_area_id,
                'assessments_count': assessments_count,
                'verification_status': verification_status,
                'land_classification': land_classification,
                'ndvi_value': site.ndvi_value,
                'is_pinned': site.is_pinned,
                'created_at': site.created_at.isoformat(),
                'updated_at': site.updated_at.isoformat(),
            })

        return JsonResponse({
            'data': data,
            'total': total,
            'total_page': total_page,
            'current_page': page,
        }, status=200)

    except Exception as e:
        import traceback
        print(f"❌ Error in get_gis_sites_list: {e}")
        traceback.print_exc()
        return JsonResponse({'error': str(e)}, status=500)