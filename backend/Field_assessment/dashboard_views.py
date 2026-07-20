
from django.db.models import Count, Q, Case, When, IntegerField, Max
from django.db.models.functions import TruncMonth
from django.utils import timezone
from datetime import timedelta
from django.core.serializers.json import DjangoJSONEncoder
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

from accounts.helper import get_user_from_token
from .models import (
    Assigned_onsite_inspector, Field_assessment
)

import logging

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────
# HELPER FUNCTIONS
# ─────────────────────────────────────────────────────────────────────

def _parse_coordinate(coordinate):
    default_lat, default_lng = 11.0, 124.6
    if not coordinate: 
        return default_lat, default_lng, "No Coordinates"
    try:
        if isinstance(coordinate, list) and len(coordinate) >= 2:
            lat, lng = float(coordinate[0]), float(coordinate[1])
            return lat, lng, f"{lat:.4f}° N, {lng:.4f}° E"
        if isinstance(coordinate, dict):
            lat = float(coordinate.get('latitude', default_lat))
            lng = float(coordinate.get('longitude', default_lng))
            return lat, lng, f"{lat:.4f}° N, {lng:.4f}° E"
        if isinstance(coordinate, str) and ',' in coordinate:
            parts = coordinate.split(',')
            if len(parts) >= 2:
                lat, lng = float(parts[0].strip()), float(parts[1].strip())
                return lat, lng, f"{lat:.4f}° N, {lng:.4f}° E"
    except (ValueError, TypeError, KeyError): 
        pass
    return default_lat, default_lng, "No Coordinates"

def check_inspector_assignment(user, reforestation_area_id):
    """Helper to verify if an inspector is assigned to a specific area."""
    if not user or user.user_role != "OnsiteInspector": 
        return False
    return Assigned_onsite_inspector.objects.filter(
        user=user, 
        reforestation_area_id=reforestation_area_id
    ).exists()


# ─────────────────────────────────────────────────────────────────────
# DASHBOARD ENDPOINTS FOR ONSITE INSPECTOR
# ─────────────────────────────────────────────────────────────────────

@csrf_exempt
def get_dashboard_stats(request):
    """
    📊 GET Dashboard Statistics
    Returns: 4 stat cards + overall progress + layer completion %
    """
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    
    try:
        user = get_user_from_token(request)
        if not user or user.user_role != "OnsiteInspector":
            return JsonResponse({'error': 'Unauthorized'}, status=403)

        # ─ 1. COUNT ASSIGNED AREAS ─────────────────────────────────
        total_areas = Assigned_onsite_inspector.objects.filter(user=user).count()

        # ── 2. COUNT ALL ASSESSMENTS ────────────────────────────────
        all_assessments = Field_assessment.objects.filter(
            assigned_onsite_inspector__user=user
        )
        
        total_assessments = all_assessments.count()
        submitted_count = all_assessments.filter(is_submitted=True).count()
        draft_count = all_assessments.filter(is_submitted=False).count()
        returned_count = 0  # Placeholder for future 'returned_at' tracking

        # ─ 3. CALCULATE LAYER COMPLETION ──────────────────────────
        layer_keys = {
            'meta_data': 'meta_data',
            'safety': 'safety',
            'survivability': 'survivability',
            'boundary_verification': 'boundary_verification'
        }
        
        layer_completion = {}
        # Count distinct sites that have assessments (including NULL for general)
        total_sites_with_assessments = all_assessments.values('site_id').distinct().count()
        
        if total_sites_with_assessments > 0:
            for layer_key, db_key in layer_keys.items():
                count = all_assessments.filter(
                    is_submitted=True,
                    field_assessment_data__has_key=db_key
                ).count()
                
                percentage = round((count / total_sites_with_assessments) * 100)
                layer_completion[layer_key] = {
                    'count': count,
                    'total': total_sites_with_assessments,
                    'percentage': min(percentage, 100)
                }
        else:
            for layer_key in layer_keys.keys():
                layer_completion[layer_key] = {
                    'count': 0,
                    'total': 0,
                    'percentage': 0
                }

        # ── 4. CALCULATE OVERALL PROGRESS ──────────────────────────
        assigned_area_ids = Assigned_onsite_inspector.objects.filter(
            user=user
        ).values_list('reforestation_area_id', flat=True)
        
        from sites.models import Sites
        total_sites = Sites.objects.filter(
            reforestation_area_id__in=assigned_area_ids
        ).count()
        
        sites_with_submitted = all_assessments.filter(
            is_submitted=True
        ).values('site_id').distinct().count()
        
        has_general_assessment = all_assessments.filter(
            is_submitted=True,
            site_id__isnull=True
        ).exists()
        
        if total_sites > 0:
            overall_percentage = round((sites_with_submitted / total_sites) * 100)
        elif has_general_assessment:
            overall_percentage = 100
            total_sites = 1
            sites_with_submitted = 1
        else:
            overall_percentage = 0

        # ── 5. PREPARE RESPONSE ────────────────────────────────────
        return JsonResponse({
            'success': True,
            'data': {
                'stats': {
                    'total_areas': total_areas,
                    'total_assessments': total_assessments,
                    'submitted_count': submitted_count,
                    'draft_count': draft_count,
                    'returned_count': returned_count,
                },
                'overall_progress': {
                    'total_sites': total_sites,
                    'assessed_sites': sites_with_submitted,
                    'percentage': min(overall_percentage, 100),
                },
                'layer_completion': layer_completion,
            }
        }, encoder=DjangoJSONEncoder, status=200)
        
    except Exception as e:
        logger.error(f"Error in get_dashboard_stats: {e}", exc_info=True)
        return JsonResponse({
            'success': False,
            'error': f'Server error: {str(e)}'
        }, status=500)


@csrf_exempt
def get_recent_assessments(request):
    """
    📋 GET Recent Assessments (Last 5-10)
    """
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    
    try:
        user = get_user_from_token(request)
        if not user or user.user_role != "OnsiteInspector":
            return JsonResponse({'error': 'Unauthorized'}, status=403)

        limit = int(request.GET.get('limit', 5))
        
        assessments = Field_assessment.objects.filter(
            assigned_onsite_inspector__user=user
        ).select_related(
            'assigned_onsite_inspector__reforestation_area',
            'site',
            'land_classification'
        ).prefetch_related('images', 'animal_relations__animal').order_by(
            '-created_at'
        )[:limit]

        data = []
        for fa in assessments:
            if fa.is_submitted:
                status = 'submitted'
                status_color = '#22C55E'
            else:
                days_since_update = (timezone.now() - fa.updated_at).days
                if days_since_update <= 3 and fa.field_assessment_data:
                    status = 'returned'
                    status_color = '#EF4444'
                else:
                    status = 'draft'
                    status_color = '#F59E0B'

            area_name = fa.assigned_onsite_inspector.reforestation_area.name
            site_name = fa.site.name if fa.site else "General Assessment"
            
            present_layers = []
            if fa.field_assessment_data:
                if 'meta_data' in fa.field_assessment_data: present_layers.append('meta_data')
                if 'safety' in fa.field_assessment_data: present_layers.append('safety')
                if 'survivability' in fa.field_assessment_data: present_layers.append('survivability')
                if 'boundary_verification' in fa.field_assessment_data: present_layers.append('boundary_verification')

            data.append({
                'field_assessment_id': fa.field_assessment_id,
                'site_name': site_name,
                'area_name': area_name,
                'assessment_date': fa.assessment_date.isoformat() if fa.assessment_date else None,
                'status': status,
                'status_color': status_color,
                'image_count': fa.images.count(),
                'present_layers': present_layers,
                'layer_count': len(present_layers),
                'created_at': fa.created_at.isoformat(),
                'updated_at': fa.updated_at.isoformat(),
            })

        return JsonResponse({
            'success': True,
            'data': data,
            'count': len(data)
        }, encoder=DjangoJSONEncoder, status=200)
        
    except Exception as e:
        logger.error(f"Error in get_recent_assessments: {e}", exc_info=True)
        return JsonResponse({
            'success': False,
            'error': f'Server error: {str(e)}'
        }, status=500)


@csrf_exempt
def get_assessments_over_time(request):
    """
    📈 GET Assessments Over Time (Chart Data)
    """
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    
    try:
        user = get_user_from_token(request)
        if not user or user.user_role != "OnsiteInspector":
            return JsonResponse({'error': 'Unauthorized'}, status=403)

        months = int(request.GET.get('months', 6))
        end_date = timezone.now().date()
        start_date = end_date - timedelta(days=months*30)

        assessments = Field_assessment.objects.filter(
            assigned_onsite_inspector__user=user,
            created_at__date__gte=start_date,
            created_at__date__lte=end_date
        )

        monthly_data = assessments.annotate(
            month=TruncMonth('created_at')
        ).values('month').annotate(
            submitted=Count(Case(When(is_submitted=True, then=1), output_field=IntegerField())),
            draft=Count(Case(When(is_submitted=False, then=1), output_field=IntegerField())),
            total=Count('field_assessment_id')
        ).order_by('month')

        labels = []
        submitted_data = []
        draft_data = []
        
        from dateutil.relativedelta import relativedelta
        current = start_date.replace(day=1)
        
        while current <= end_date:
            month_label = current.strftime("%b")
            labels.append(month_label)
            
            month_data = next(
                (m for m in monthly_data if m['month'].month == current.month and m['month'].year == current.year),
                None
            )
            
            if month_data:
                submitted_data.append(month_data['submitted'])
                draft_data.append(month_data['draft'])
            else:
                submitted_data.append(0)
                draft_data.append(0)
            
            current += relativedelta(months=1)

        return JsonResponse({
            'success': True,
            'data': {
                'labels': labels,
                'datasets': [
                    {'label': 'Submitted', 'data': submitted_data, 'color': '#22C55E'},
                    {'label': 'Draft', 'data': draft_data, 'color': '#F59E0B'}
                ],
                'period': {
                    'start': start_date.isoformat(),
                    'end': end_date.isoformat(),
                    'months': months
                }
            }
        }, encoder=DjangoJSONEncoder, status=200)
        
    except Exception as e:
        logger.error(f"Error in get_assessments_over_time: {e}", exc_info=True)
        return JsonResponse({
            'success': False,
            'error': f'Server error: {str(e)}'
        }, status=500)


@csrf_exempt
def get_assigned_areas_summary(request):
    """
    🗺️ GET Assigned Areas with Progress Summary
    """
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    
    try:
        user = get_user_from_token(request)
        if not user or user.user_role != "OnsiteInspector":
            return JsonResponse({'error': 'Unauthorized'}, status=403)

        assignments = Assigned_onsite_inspector.objects.filter(
            user=user
        ).select_related('reforestation_area').annotate(
            total_assessments=Count('field_assessments'),
            submitted_assessments=Count('field_assessments', filter=Q(field_assessments__is_submitted=True)),
            draft_assessments=Count('field_assessments', filter=Q(field_assessments__is_submitted=False)),
            last_assessment_date=Max('field_assessments__created_at') # ✅ Max is now imported
        )

        data = []
        for assignment in assignments:
            area = assignment.reforestation_area
            lat, lng, coord_display = _parse_coordinate(area.coordinate)
            
            total = assignment.total_assessments or 0
            submitted = assignment.submitted_assessments or 0
            progress = round((submitted / total * 100)) if total > 0 else 0

            data.append({
                'assigned_onsite_inspector_id': assignment.assigned_onsite_inspector_id,
                'reforestation_area_id': area.reforestation_area_id,
                'name': area.name,
                'description': area.description or '',
                'coordinate': area.coordinate,
                'latitude': lat,
                'longitude': lng,
                'coord_display': coord_display,
                'stats': {
                    'total_assessments': total,
                    'submitted': submitted,
                    'draft': assignment.draft_assessments or 0,
                    'progress_percentage': progress,
                },
                'last_assessment_date': assignment.last_assessment_date.isoformat() if assignment.last_assessment_date else None,
                'assigned_at': assignment.created_at.isoformat(),
            })

        return JsonResponse({
            'success': True,
            'data': data,
            'count': len(data)
        }, encoder=DjangoJSONEncoder, status=200)
        
    except Exception as e:
        logger.error(f"Error in get_assigned_areas_summary: {e}", exc_info=True)
        return JsonResponse({
            'success': False,
            'error': f'Server error: {str(e)}'
        }, status=500)


@csrf_exempt
def get_layer_completion_detail(request):
    """
    📊 GET Detailed Layer Completion per Area/Site (Matrix)
    """
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    
    try:
        user = get_user_from_token(request)
        if not user or user.user_role != "OnsiteInspector":
            return JsonResponse({'error': 'Unauthorized'}, status=403)

        area_id = request.GET.get('reforestation_area_id')
        if not area_id:
            return JsonResponse({'error': 'reforestation_area_id is required'}, status=400)

        # ✅ check_inspector_assignment is now defined above
        if not check_inspector_assignment(user, area_id):
            return JsonResponse({'error': 'You are not assigned to this area'}, status=403)

        from sites.models import Sites
        sites = Sites.objects.filter(reforestation_area_id=area_id)
        
        assessments = Field_assessment.objects.filter(
            assigned_onsite_inspector__user=user,
            assigned_onsite_inspector__reforestation_area_id=area_id
        )

        layer_keys = ['meta_data', 'safety', 'survivability', 'boundary_verification']
        matrix = []
        
        # General assessment (site_id IS NULL)
        general_assessments = assessments.filter(site_id__isnull=True)
        general_row = {'site_id': None, 'site_name': 'General Assessment', 'layers': {}}
        
        for layer in layer_keys:
            has_submitted = general_assessments.filter(is_submitted=True, field_assessment_data__has_key=layer).exists()
            has_draft = general_assessments.filter(is_submitted=False, field_assessment_data__has_key=layer).exists()
            
            general_row['layers'][layer] = {
                'status': 'completed' if has_submitted else ('draft' if has_draft else 'none'),
                'has_submitted': has_submitted,
                'has_draft': has_draft,
            }
        matrix.append(general_row)
        
        # Specific sites
        for site in sites:
            site_assessments = assessments.filter(site_id=site.sites_id)
            row = {'site_id': site.sites_id, 'site_name': site.name, 'layers': {}}
            
            for layer in layer_keys:
                has_submitted = site_assessments.filter(is_submitted=True, field_assessment_data__has_key=layer).exists()
                has_draft = site_assessments.filter(is_submitted=False, field_assessment_data__has_key=layer).exists()
                
                row['layers'][layer] = {
                    'status': 'completed' if has_submitted else ('draft' if has_draft else 'none'),
                    'has_submitted': has_submitted,
                    'has_draft': has_draft,
                }
            matrix.append(row)

        # Calculate overall coverage per layer
        coverage = {}
        total_rows = len(matrix)
        for layer in layer_keys:
            completed_count = sum(1 for row in matrix if row['layers'][layer]['has_submitted'])
            coverage[layer] = {
                'completed': completed_count,
                'total': total_rows,
                'percentage': round((completed_count / total_rows * 100)) if total_rows > 0 else 0
            }

        # ✅ Cleaned up the walrus operator for better readability and safety
        area_assignment = Assigned_onsite_inspector.objects.filter(
            user=user, reforestation_area_id=area_id
        ).select_related('reforestation_area').first()
        
        area_name = area_assignment.reforestation_area.name if area_assignment else ''

        return JsonResponse({
            'success': True,
            'data': {
                'reforestation_area_id': area_id,
                'area_name': area_name,
                'matrix': matrix,
                'coverage': coverage,
                'layer_keys': layer_keys,
            }
        }, encoder=DjangoJSONEncoder, status=200)
        
    except Exception as e:
        logger.error(f"Error in get_layer_completion_detail: {e}", exc_info=True)
        return JsonResponse({
            'success': False,
            'error': f'Server error: {str(e)}'
        }, status=500)