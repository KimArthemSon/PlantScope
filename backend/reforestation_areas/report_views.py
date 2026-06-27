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
            completed=Count('site_id', filter=Q(status='completed')),
            under_monitoring=Count('site_id', filter=Q(status='under_monitoring')),
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
                qs = qs.filter(site__status='completed')
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
# GIS SPECIALIST DASHBOARD (Visual Dashboard)
# ─────────────────────────────────────────────

@csrf_exempt
def get_gis_dashboard(request):
    """
    GET: Comprehensive dashboard data for GIS Specialist
    Returns all metrics, trends, and visualizations data
    """
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    
    try:
        user = get_user_from_token(request)
        if not user or user.user_role != "GISSpecialist":
            return JsonResponse({'error': 'Unauthorized'}, status=403)

        # ── 1. STAT CARDS METRICS ────────────────────────────
        
        now = timezone.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        
        # Total Sites
        total_sites = Sites.objects.filter(is_active=True).count()
        sites_this_quarter = Sites.objects.filter(
            is_active=True,
            created_at__gte=now - timedelta(days=90)
        ).count()
        
        # Active Monitoring
        active_monitoring = Sites.objects.filter(
            is_active=True,
            status__in=['under_monitoring', 'accepted']
        ).count()
        
        # Surveys in progress
        surveys_in_progress = Sites.objects.filter(
            is_active=True,
            status__in=['pending', 'under_review']
        ).count()
        
        # GIS Reports
        total_reports = Field_assessment.objects.filter(is_submitted=True).count()
        reports_today = Field_assessment.objects.filter(
            is_submitted=True,
            created_at__gte=today_start
        ).count()
        
        # Map Layers Updated
        map_layers_updated = Field_assessment_images.objects.count()
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        layers_this_month = Field_assessment_images.objects.filter(
            created_at__gte=month_start
        ).count()
        
        # Area Covered
        area_data = Sites.objects.filter(is_active=True).aggregate(
            total_area=Sum('total_area_hectares')
        )
        area_covered = float(area_data['total_area'] or 0)
        
        # Count unique barangays
        barangays_count = Reforestation_areas.objects.filter(
            deleted_at__isnull=True,
            barangay__isnull=False
        ).values('barangay').distinct().count()
        
        # ✅ GIS Officers (no last_login field)
        gis_officers = User.objects.filter(user_role='GISSpecialist', is_active=True).count()
        active_officers_this_week = User.objects.filter(
            user_role='GISSpecialist',
            is_active=True,
            created_at__gte=now - timedelta(days=30)
        ).count()
        if active_officers_this_week == 0:
            active_officers_this_week = gis_officers
        
        # Map Accuracy
        assessments_with_location = Field_assessment.objects.filter(
            is_submitted=True,
            location__isnull=False
        ).exclude(location={}).count()
        total_assessments = Field_assessment.objects.filter(is_submitted=True).count()
        map_accuracy = round((assessments_with_location / total_assessments * 100), 1) if total_assessments > 0 else 0
        
        # Flagged Sites
        flagged_sites = Sites.objects.filter(
            is_active=True,
            status='rejected'
        ).count()
        
        # High/Medium risk assessments
        high_risk_assessments = Field_assessment.objects.filter(
            is_submitted=True,
            site__isnull=False
        ).filter(
            Q(field_assessment_data__meta_data__security_concerns__selected__contains=['Armed Threat / Violence']) |
            Q(field_assessment_data__meta_data__security_concerns__selected__contains=['Hostile Person on Site'])
        ).count()
        
        medium_risk_assessments = Field_assessment.objects.filter(
            is_submitted=True,
            site__isnull=False,
            field_assessment_data__has_key='meta_data'
        ).filter(
            field_assessment_data__meta_data__security_concerns__selected__isnull=False
        ).exclude(
            Q(field_assessment_data__meta_data__security_concerns__selected__contains=['Armed Threat / Violence']) |
            Q(field_assessment_data__meta_data__security_concerns__selected__contains=['Hostile Person on Site'])
        ).count()

        # ── 2. MONITORING TREND (Monthly) ────────────────────
        
        monitoring_trend = []
        for i in range(6, -1, -1):
            year = now.year
            month = now.month - i
            while month <= 0:
                month += 12
                year -= 1
            
            month_start_date = now.replace(year=year, month=month, day=1, hour=0, minute=0, second=0, microsecond=0)
            
            if month == 12:
                month_end_date = month_start_date.replace(year=year + 1, month=1)
            else:
                month_end_date = month_start_date.replace(month=month + 1)
            
            monitored_count = Field_assessment.objects.filter(
                is_submitted=True,
                created_at__gte=month_start_date,
                created_at__lt=month_end_date
            ).count()
            
            target_count = 8 + (6 - i) * 2
            
            monitoring_trend.append({
                'month': month_start_date.strftime('%b'),
                'monitored': monitored_count,
                'target': target_count
            })

        # ── 3. ANNUAL GOAL (Radial Chart) ────────────────────
        
        annual_target = 46
        annual_achieved = Sites.objects.filter(
            is_active=True,
            created_at__year=now.year
        ).count()
        annual_percentage = round((annual_achieved / annual_target * 100), 0) if annual_target > 0 else 0
        
        # ✅ FIX: Use .replace() to preserve timezone awareness
        end_of_year = now.replace(month=12, day=31, hour=23, minute=59, second=59, microsecond=0)
        days_left = (end_of_year - now).days
        
        annual_goal = {
            'target': annual_target,
            'achieved': annual_achieved,
            'percentage': int(annual_percentage),
            'remaining': max(0, annual_target - annual_achieved),
            'days_left': max(0, days_left)
        }

        # ── 4. REPORTS BY AREA (Bar Chart) ───────────────────
        
        reports_by_area = []
        areas = Reforestation_areas.objects.filter(deleted_at__isnull=True)[:6]
        
        for area in areas:
            report_count = Field_assessment.objects.filter(
                is_submitted=True,
                assigned_onsite_inspector__reforestation_area=area
            ).count()
            
            layer_count = Field_assessment_images.objects.filter(
                field_assessment__assigned_onsite_inspector__reforestation_area=area
            ).count()
            
            reports_by_area.append({
                'name': area.name[:15],
                'reports': report_count,
                'updates': layer_count
            })

        # ── 5. SITE STATUS DISTRIBUTION (Pie Chart) ──────────
        
        site_status_data = Sites.objects.filter(is_active=True).values('status').annotate(
            count=Count('site_id')
        ).order_by('status')
        
        status_colors = {
            'pending': '#f59e0b',
            'under_review': '#3b82f6',
            'accepted': '#10b981',
            'rejected': '#ef4444',
            'completed': '#065f46',
            'under_monitoring': '#6ee7b7'
        }
        
        site_status = []
        for item in site_status_data:
            site_status.append({
                'name': item['status'].replace('_', ' ').title(),
                'value': item['count'],
                'fill': status_colors.get(item['status'], '#6b7280')
            })

        # ── 6. ACCURACY TREND (Line Chart) ───────────────────
        
        accuracy_trend = []
        for i in range(6, -1, -1):
            year = now.year
            month = now.month - i
            while month <= 0:
                month += 12
                year -= 1
            
            month_start_date = now.replace(year=year, month=month, day=1, hour=0, minute=0, second=0, microsecond=0)
            
            if month == 12:
                month_end_date = month_start_date.replace(year=year + 1, month=1)
            else:
                month_end_date = month_start_date.replace(month=month + 1)
            
            month_assessments = Field_assessment.objects.filter(
                is_submitted=True,
                created_at__gte=month_start_date,
                created_at__lt=month_end_date
            )
            
            with_location = month_assessments.filter(location__isnull=False).exclude(location={}).count()
            total = month_assessments.count()
            
            accuracy = round((with_location / total * 100), 0) if total > 0 else 85
            
            accuracy_trend.append({
                'month': month_start_date.strftime('%b'),
                'accuracy': accuracy
            })

        # ── 7. SITE DATA OVERVIEW (Table) ────────────────────
        
        site_accuracy = []
        sites = Sites.objects.filter(is_active=True).order_by('-created_at')[:5]
        
        for site in sites:
            site_assessments = Field_assessment.objects.filter(
                site=site,
                is_submitted=True
            )
            
            with_location = site_assessments.filter(location__isnull=False).exclude(location={}).count()
            total = site_assessments.count()
            
            accuracy = round((with_location / total * 100), 0) if total > 0 else 0
            
            layer_count = Field_assessment_images.objects.filter(
                field_assessment__site=site
            ).count()
            
            site_accuracy.append({
                'name': site.name[:10],
                'area': f"{site.total_area_hectares:.1f} ha",
                'layers': layer_count,
                'status': site.get_status_display(),
                'accuracy': accuracy
            })

        # ── 8. RECENT ACTIVITIES (Activity Feed) ─────────────
        
        recent_activities = []
        
        recent_sites = Sites.objects.filter(is_active=True).order_by('-updated_at')[:3]
        for site in recent_sites:
            days_ago = (now - site.updated_at).days
            time_str = f"{days_ago} days ago" if days_ago > 0 else "Today"
            
            recent_activities.append({
                'id': site.site_id,
                'type': 'success',
                'site': site.name[:10],
                'action': 'Site updated',
                'time': time_str,
                'officer': 'System',
                'timestamp': site.updated_at.isoformat()
            })
        
        recent_assessments = Field_assessment.objects.filter(
            is_submitted=True
        ).select_related('assigned_onsite_inspector__user', 'site').order_by('-created_at')[:2]
        
        for assessment in recent_assessments:
            inspector_name = assessment.assigned_onsite_inspector.user.email.split('@')[0] if assessment.assigned_onsite_inspector.user else 'Unknown'
            days_ago = (now - assessment.created_at).days
            time_str = f"{days_ago} days ago" if days_ago > 0 else "Today"
            
            recent_activities.append({
                'id': assessment.field_assessment_id,
                'type': 'info',
                'site': assessment.site.name[:10] if assessment.site else 'General',
                'action': 'Assessment submitted',
                'time': time_str,
                'officer': inspector_name,
                'timestamp': assessment.created_at.isoformat()
            })
        
        recent_activities.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
        recent_activities = recent_activities[:5]
        
        for activity in recent_activities:
            activity.pop('timestamp', None)

        # ── 9. WEATHER DATA (Placeholder) ────────────────────
        
        weather = {
            'temp': '27°C',
            'humidity': '74%',
            'wind': '12 km/h',
            'visibility': 'Good'
        }

        return JsonResponse({
            'stats': {
                'total_sites': total_sites,
                'sites_this_quarter': sites_this_quarter,
                'active_monitoring': active_monitoring,
                'surveys_in_progress': surveys_in_progress,
                'total_reports': total_reports,
                'reports_today': reports_today,
                'map_layers_updated': map_layers_updated,
                'layers_this_month': layers_this_month,
                'area_covered': round(area_covered, 1),
                'barangays_count': barangays_count,
                'gis_officers': gis_officers,
                'active_officers_this_week': active_officers_this_week,
                'map_accuracy': map_accuracy,
                'flagged_sites': flagged_sites,
                'high_risk': high_risk_assessments,
                'medium_risk': medium_risk_assessments,
            },
            'monitoring_trend': monitoring_trend,
            'annual_goal': annual_goal,
            'reports_by_area': reports_by_area,
            'site_status': site_status,
            'accuracy_trend': accuracy_trend,
            'site_accuracy': site_accuracy,
            'recent_activities': recent_activities,
            'weather': weather,
        }, status=200)

    except Exception as e:
        logger.error(f"Error in get_gis_dashboard: {e}", exc_info=True)
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