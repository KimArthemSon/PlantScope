from django.db.models import Sum, Count, Q, F, Avg
from django.db.models.functions import Coalesce, TruncMonth
from datetime import timedelta
from django.utils import timezone
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

from accounts.models import User, TreeGrowerGroup
from accounts.helper import get_user_from_token
from sites.models import Sites, SiteMetaDataVerification
from reforestation_areas.models import Reforestation_areas
from tree_planting_programs.models import (
    Application, SeedlingRequest, SeedlingRequestSpecies,
    ProgressReport, ProgressReportSpecies, Reason
)
from tree_species.models import Tree_species
from barangay.models import Barangay
from land_classifications.models import LandClassification


@csrf_exempt
def get_head_dashboard_data(request):
    """
    Comprehensive dashboard data for City ENRO Head.
    Returns all data needed for all 5 dashboard tabs.
    """
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    user = get_user_from_token(request)
    if not user or user.user_role != 'CityENROHead':
        return JsonResponse({'error': 'Unauthorized: Head only'}, status=403)

    now = timezone.now()
    seven_months_ago = now - timedelta(days=210)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    quarter_start = now - timedelta(days=90)
    ninety_days_ago = now - timedelta(days=90)

    # ═══════════════════════════════════════════════════════════════════════
    # TAB 1: EXECUTIVE OVERVIEW - KPIs
    # ═══════════════════════════════════════════════════════════════════════
    
    # Pending My Approval (CRITICAL for Head)
    pending_my_approval = Application.objects.filter(status='for_head').count()
    
    # Total Active Programs
    total_active_programs = Application.objects.filter(
        status__in=['accepted', 'under_monitoring']
    ).count()
    
    # Total Tree Grower Groups
    total_tree_grower_groups = TreeGrowerGroup.objects.count()
    
    # Total Hectares Covered
    total_hectares = Sites.objects.filter(
        status__in=['accepted', 'under_monitoring', 'completed']
    ).aggregate(total=Coalesce(Sum('total_area_hectares'), 0.0))['total']
    
    # Total Seedlings Distributed
    total_seedlings_distributed = SeedlingRequestSpecies.objects.filter(
        seedling_request__status='accepted'
    ).aggregate(total=Coalesce(Sum('quantity'), 0))['total']
    
    # Overall Survival Rate
    survival_stats = ProgressReportSpecies.objects.aggregate(
        total_survived=Coalesce(Sum('no_survived'), 0),
        total_dead=Coalesce(Sum('no_dead'), 0)
    )
    total_survived = survival_stats['total_survived']
    total_dead = survival_stats['total_dead']
    total_plants = total_survived + total_dead
    overall_survival_rate = round((total_survived / total_plants * 100), 1) if total_plants > 0 else 0
    
    # Completed Programs
    completed_programs = Application.objects.filter(status='completed').count()
    
    # Failed/Rejected Programs
    failed_programs = Application.objects.filter(
        status__in=['failed', 'rejected', 'cancelled']
    ).count()

    # ═══════════════════════════════════════════════════════════════════════
    # TAB 1: APPLICATION PIPELINE FUNNEL
    # ═══════════════════════════════════════════════════════════════════════
    
    pipeline_data = {
        'for_evaluation': Application.objects.filter(status='for_evaluation').count(),
        'for_head': Application.objects.filter(status='for_head').count(),
        'accepted': Application.objects.filter(status='accepted').count(),
        'under_monitoring': Application.objects.filter(status='under_monitoring').count(),
        'completed': Application.objects.filter(status='completed').count(),
    }

    # ═══════════════════════════════════════════════════════════════════════
    # TAB 1: MONTHLY PROGRAM TREND
    # ═══════════════════════════════════════════════════════════════════════
    
    monthly_apps = Application.objects.filter(
        created_at__gte=seven_months_ago
    ).annotate(
        month=TruncMonth('created_at')
    ).values('month').annotate(
        submitted=Count('application_id'),
        approved=Count('application_id', filter=Q(status__in=['accepted', 'under_monitoring', 'completed']))
    ).order_by('month')

    monthly_trend = [
        {
            "month": entry['month'].strftime('%b'),
            "submitted": entry['submitted'],
            "approved": entry['approved']
        } for entry in monthly_apps
    ]

    # ═══════════════════════════════════════════════════════════════════════
    # TAB 1: SEEDLING SURVIVAL BY SPECIES
    # ═══════════════════════════════════════════════════════════════════════
    
    species_survival = ProgressReportSpecies.objects.values(
        species_name=F('tree_species__name')
    ).annotate(
        total_survived=Coalesce(Sum('no_survived'), 0),
        total_dead=Coalesce(Sum('no_dead'), 0)
    ).filter(total_survived__gt=0).order_by('-total_survived')[:8]

    species_data = []
    for sp in species_survival:
        total = sp['total_survived'] + sp['total_dead']
        rate = round((sp['total_survived'] / total * 100), 1) if total > 0 else 0
        species_data.append({
            'name': sp['species_name'],
            'survived': sp['total_survived'],
            'dead': sp['total_dead'],
            'survival_rate': rate
        })

    # ═══════════════════════════════════════════════════════════════════════
    # TAB 1: BARANGAY COVERAGE
    # ═══════════════════════════════════════════════════════════════════════
    
    barangay_coverage = Application.objects.filter(
        site__reforestation_area__barangay__isnull=False,
        status__in=['accepted', 'under_monitoring', 'completed']
    ).values(
        barangay_name=F('site__reforestation_area__barangay__name')
    ).annotate(
        active_programs=Count('application_id')
    ).order_by('-active_programs')[:6]

    barangay_data = list(barangay_coverage)

    # ═══════════════════════════════════════════════════════════════════════
    # TAB 1: RECENT ACTIVITY FEED
    # ═══════════════════════════════════════════════════════════════════════
    
    recent_reasons = Reason.objects.select_related(
        'user__profile', 'application'
    ).order_by('-created')[:8]

    recent_activities = []
    for reason in recent_reasons:
        if reason.status in ['accepted', 'completed']:
            act_type = 'success'
            action = 'Application approved' if reason.status == 'accepted' else 'Program completed'
        elif reason.status in ['rejected', 'failed', 'cancelled']:
            act_type = 'danger'
            action = 'Application rejected'
        elif reason.status == 'for_head':
            act_type = 'warning'
            action = 'Forwarded for approval'
        else:
            act_type = 'info'
            action = 'Documents submitted'
        
        officer_name = f"{reason.user.profile.first_name[0]}. {reason.user.profile.last_name}" if hasattr(reason.user, 'profile') else reason.user.email.split('@')[0]
        
        time_diff = now - reason.created
        if time_diff.days > 0:
            time_str = f"{time_diff.days} days ago" if time_diff.days > 1 else "Yesterday"
        elif time_diff.seconds > 3600:
            time_str = f"{time_diff.seconds // 3600}h ago"
        else:
            time_str = f"{time_diff.seconds // 60}m ago"
        
        recent_activities.append({
            "id": reason.reason_id,
            "type": act_type,
            "ref": f"APP-{reason.application.application_id:04d}" if reason.application else "N/A",
            "action": action,
            "time": time_str,
            "officer": officer_name
        })

    # ═══════════════════════════════════════════════════════════════════════
    # TAB 2: PENDING APPROVALS QUEUE
    # ═══════════════════════════════════════════════════════════════════════
    
    pending_apps_qs = Application.objects.filter(
        status='for_head'
    ).select_related(
        'user__tree_grower_group',
        'site__reforestation_area__barangay'
    ).order_by('created_at')

    pending_approvals = []
    for app in pending_apps_qs:
        days_waiting = (now - app.created_at).days
        pending_approvals.append({
            "application_id": app.application_id,
            "ref": f"APP-{app.application_id:04d}",
            "group_name": app.user.tree_grower_group.group_name if hasattr(app.user, 'tree_grower_group') else "Unknown",
            "title": app.title,
            "site_name": app.site.name if app.site else "No site assigned",
            "barangay": app.site.reforestation_area.barangay.name if app.site and app.site.reforestation_area and app.site.reforestation_area.barangay else "N/A",
            "area_hectares": round(app.site.total_area_hectares, 2) if app.site else 0,
            "ndvi_score": round(app.site.ndvi_value * 100, 0) if app.site and app.site.ndvi_value else 0,
            "orientation_date": app.orientation_date.isoformat() if app.orientation_date else None,
            "days_waiting": days_waiting,
            "created_at": app.created_at.isoformat(),
        })

    # ═══════════════════════════════════════════════════════════════════════
    # TAB 3: PROGRAM PERFORMANCE
    # ═══════════════════════════════════════════════════════════════════════
    
    # Active monitoring programs count
    active_monitoring = total_active_programs
    
    # Total progress reports submitted
    total_progress_reports = ProgressReport.objects.count()
    
    # Average survival rate (already calculated above)
    avg_survival_rate = overall_survival_rate
    
    # Compliance rate
    compliant_programs = Application.objects.filter(
        status__in=['accepted', 'under_monitoring'],
        progress_reports__created_at__gte=ninety_days_ago
    ).distinct().count()
    compliance_rate = round((compliant_programs / active_monitoring * 100), 1) if active_monitoring > 0 else 0
    
    # Survival rate trend (monthly)
    survival_trend_qs = ProgressReport.objects.filter(
        created_at__gte=seven_months_ago,
        status='accepted'
    ).annotate(
        month=TruncMonth('created_at')
    ).values('month').annotate(
        total_survived_month=Coalesce(Sum('report_species__no_survived'), 0),
        total_dead_month=Coalesce(Sum('report_species__no_dead'), 0)
    ).order_by('month')

    survival_rate_trend = []
    for entry in survival_trend_qs:
        total_month = entry['total_survived_month'] + entry['total_dead_month']
        rate = round((entry['total_survived_month'] / total_month * 100), 1) if total_month > 0 else 0
        survival_rate_trend.append({
            "month": entry['month'].strftime('%b'),
            "rate": rate
        })
    
    # Programs by status (donut chart)
    status_counts = Application.objects.values('status').annotate(count=Count('application_id'))
    
    status_map = {
        'accepted': ('Ongoing', '#10b981'),
        'under_monitoring': ('Ongoing', '#10b981'),
        'completed': ('Completed', '#065f46'),
        'for_evaluation': ('Pending', '#6ee7b7'),
        'for_head': ('Pending', '#6ee7b7'),
        'rejected': ('On Hold', '#a7f3d0'),
        'failed': ('On Hold', '#a7f3d0'),
        'cancelled': ('On Hold', '#a7f3d0'),
    }
    
    status_aggregated = {}
    for item in status_counts:
        status = item['status']
        if status in status_map:
            name, color = status_map[status]
            if name not in status_aggregated:
                status_aggregated[name] = {'name': name, 'value': 0, 'fill': color}
            status_aggregated[name]['value'] += item['count']
    
    status_data = list(status_aggregated.values())
    
    # Monthly planting progress
    monthly_seedling_requests = SeedlingRequest.objects.filter(
        created_at__gte=seven_months_ago,
        status='accepted'
    ).annotate(
        month=TruncMonth('created_at')
    ).values('month').annotate(
        seedlings_provided=Sum('seedling_species__quantity')
    ).order_by('month')

    monthly_planting = [
        {
            "month": entry['month'].strftime('%b'),
            "seedlings": entry['seedlings_provided'] or 0
        } for entry in monthly_seedling_requests
    ]

    # ═══════════════════════════════════════════════════════════════════════
    # TAB 4: TREE GROWER ANALYSIS
    # ═══════════════════════════════════════════════════════════════════════
    
    # New groups this month
    new_groups_this_month = TreeGrowerGroup.objects.filter(
        created_at__gte=month_start
    ).count()
    
    # Get all groups with their performance
    tree_grower_analysis = []
    excellent_groups = 0
    needs_intervention = 0

    groups_with_apps = TreeGrowerGroup.objects.filter(
        users__applications__isnull=False
    ).select_related('users').prefetch_related(
        'users__applications__progress_reports__report_species',
        'users__applications__seedling_requests__seedling_species'
    ).distinct()

    for group in groups_with_apps:
        user = group.users
        apps = user.applications.all()
        
        total_survived_group = 0
        total_dead_group = 0
        total_seedlings_received = 0
        completed_programs_count = 0
        
        for app in apps:
            if app.status == 'completed':
                completed_programs_count += 1
            
            for sr in app.seedling_requests.filter(status='accepted'):
                for species in sr.seedling_species.all():
                    total_seedlings_received += species.quantity
            
            for pr in app.progress_reports.filter(status='accepted'):
                for species in pr.report_species.all():
                    total_survived_group += species.no_survived
                    total_dead_group += species.no_dead
        
        total_plants_group = total_survived_group + total_dead_group
        survival_rate_group = round((total_survived_group / total_plants_group * 100), 1) if total_plants_group > 0 else 0
        
        # Compliance status
        last_report = ProgressReport.objects.filter(application__in=apps).order_by('-created_at').first()
        if last_report:
            days_since = (now - last_report.created_at).days
            if days_since <= 60:
                compliance_status = "Compliant"
            elif days_since <= 90:
                compliance_status = "Warning"
            else:
                compliance_status = "Non-Compliant"
        else:
            compliance_status = "Non-Compliant"
        
        if survival_rate_group >= 80:
            excellent_groups += 1
        elif survival_rate_group < 50 or compliance_status == "Non-Compliant":
            needs_intervention += 1
        
        tree_grower_analysis.append({
            "group_name": group.group_name,
            "group_type": group.get_group_type_display(),
            "completed_programs": completed_programs_count,
            "survival_rate": survival_rate_group,
            "seedlings_received": total_seedlings_received,
            "compliance_status": compliance_status,
        })

    # Sort by survival rate
    tree_grower_analysis.sort(key=lambda x: x['survival_rate'], reverse=True)

    # ═══════════════════════════════════════════════════════════════════════
    # TAB 5: BARANGAY COVERAGE
    # ═══════════════════════════════════════════════════════════════════════
    
    # Hectares per barangay
    hectares_by_barangay = Sites.objects.filter(
        reforestation_area__barangay__isnull=False,
        status__in=['accepted', 'under_monitoring', 'completed']
    ).values(
        barangay_name=F('reforestation_area__barangay__name')
    ).annotate(
        total_hectares=Coalesce(Sum('total_area_hectares'), 0.0),
        site_count=Count('site_id')
    ).order_by('-total_hectares')
    
    # Programs per barangay
    programs_by_barangay = Application.objects.filter(
        site__reforestation_area__barangay__isnull=False
    ).values(
        barangay_name=F('site__reforestation_area__barangay__name')
    ).annotate(
        program_count=Count('application_id'),
        completed_count=Count('application_id', filter=Q(status='completed')),
        active_count=Count('application_id', filter=Q(status__in=['accepted', 'under_monitoring']))
    ).order_by('-program_count')
    
    # Land classification distribution
    land_class_dist = SiteMetaDataVerification.objects.filter(
        verified_land_classification__isnull=False
    ).values(
        classification_name=F('verified_land_classification__name')
    ).annotate(
        count=Count('id')
    ).order_by('-count')
    
    # Barangay table data
    barangay_table = []
    for item in programs_by_barangay:
        barangay_name = item['barangay_name']
        
        # Get hectares for this barangay
        hectares = Sites.objects.filter(
            reforestation_area__barangay__name=barangay_name,
            status__in=['accepted', 'under_monitoring', 'completed']
        ).aggregate(total=Coalesce(Sum('total_area_hectares'), 0.0))['total']
        
        # Count active groups
        active_groups = Application.objects.filter(
            site__reforestation_area__barangay__name=barangay_name,
            status__in=['accepted', 'under_monitoring']
        ).values('user').distinct().count()
        
        # Approval rate
        total_apps = item['program_count']
        approved_apps = item['completed_count'] + item['active_count']
        approval_rate = round((approved_apps / total_apps * 100), 0) if total_apps > 0 else 0
        
        barangay_table.append({
            "barangay_name": barangay_name,
            "total_hectares": round(hectares, 2),
            "total_programs": total_apps,
            "active_groups": active_groups,
            "approval_rate": approval_rate
        })

    # ═══════════════════════════════════════════════════════════════════════
    # RESPONSE
    # ═══════════════════════════════════════════════════════════════════════
    
    return JsonResponse({
        # TAB 1: Executive Overview
        "tab1_executive": {
            "kpis": {
                "pending_my_approval": pending_my_approval,
                "total_active_programs": total_active_programs,
                "total_tree_grower_groups": total_tree_grower_groups,
                "total_hectares": round(total_hectares, 2),
                "total_seedlings_distributed": total_seedlings_distributed,
                "overall_survival_rate": overall_survival_rate,
                "completed_programs": completed_programs,
                "failed_programs": failed_programs,
            },
            "pipeline_data": pipeline_data,
            "monthly_trend": monthly_trend,
            "species_data": species_data,
            "barangay_data": barangay_data,
            "recent_activities": recent_activities,
        },
        
        # TAB 2: Pending Approvals
        "tab2_pending": {
            "pending_approvals": pending_approvals,
            "total_pending": len(pending_approvals),
        },
        
        # TAB 3: Program Performance
        "tab3_performance": {
            "kpis": {
                "active_monitoring": active_monitoring,
                "total_progress_reports": total_progress_reports,
                "avg_survival_rate": avg_survival_rate,
                "compliance_rate": compliance_rate,
            },
            "survival_rate_trend": survival_rate_trend,
            "status_data": status_data,
            "monthly_planting": monthly_planting,
        },
        
        # TAB 4: Tree Grower Analysis
        "tab4_treegrowers": {
            "kpis": {
                "total_groups": total_tree_grower_groups,
                "new_groups_this_month": new_groups_this_month,
                "excellent_groups": excellent_groups,
                "needs_intervention": needs_intervention,
            },
            "tree_grower_analysis": tree_grower_analysis,
        },
        
        # TAB 5: Barangay Coverage
        "tab5_barangay": {
            "hectares_by_barangay": list(hectares_by_barangay),
            "programs_by_barangay": list(programs_by_barangay),
            "land_classification": list(land_class_dist),
            "barangay_table": barangay_table,
        },
    }, status=200)





@csrf_exempt
def get_executive_summary(request):
    """
    Executive Summary Report - High-level overview for stakeholders
    """
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    user = get_user_from_token(request)
    if not user or user.user_role != 'CityENROHead':
        return JsonResponse({'error': 'Unauthorized: Head only'}, status=403)

    now = timezone.now()
    year_start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)

    # ─── PROGRAM OVERVIEW ──────────────────────────────────────────────
    total_programs = Application.objects.count()
    active_programs = Application.objects.filter(status__in=['accepted', 'under_monitoring']).count()
    completed_programs = Application.objects.filter(status='completed').count()
    failed_programs = Application.objects.filter(status__in=['failed', 'rejected', 'cancelled']).count()
    
    total_tree_growers = User.objects.filter(user_role='treeGrowers', is_active=True).count()
    total_groups = Application.objects.values('user').distinct().count()
    
    # ─── IMPACT SUMMARY ────────────────────────────────────────────────
    total_seedlings_distributed = SeedlingRequestSpecies.objects.filter(
        seedling_request__status='accepted'
    ).aggregate(total=Coalesce(Sum('quantity'), 0))['total']
    
    survival_stats = ProgressReportSpecies.objects.aggregate(
        total_survived=Coalesce(Sum('no_survived'), 0),
        total_dead=Coalesce(Sum('no_dead'), 0)
    )
    total_survived = survival_stats['total_survived']
    total_dead = survival_stats['total_dead']
    survival_rate = round((total_survived / (total_survived + total_dead) * 100), 1) if (total_survived + total_dead) > 0 else 0
    
    # Estimated carbon sequestration (avg 22 kg CO2/year per tree after 5 years)
    estimated_carbon_tons = round((total_survived * 22) / 1000, 2)
    
    # Total area
    total_area = Sites.objects.filter(
        status__in=['accepted', 'under_monitoring', 'completed']
    ).aggregate(total=Coalesce(Sum('total_area_hectares'), 0.0))['total']
    
    # ─── KEY ACHIEVEMENTS ──────────────────────────────────────────────
    # Top performing barangay
    top_barangay = Application.objects.filter(
        site__reforestation_area__barangay__isnull=False,
        status__in=['accepted', 'under_monitoring', 'completed']
    ).values(
        barangay_name=F('site__reforestation_area__barangay__name')
    ).annotate(
        count=Count('application_id')
    ).order_by('-count').first()
    
    # Best survival rate species
    best_species = ProgressReportSpecies.objects.values(
        species_name=F('tree_species__name')
    ).annotate(
        total_survived=Sum('no_survived'),
        total_dead=Sum('no_dead')
    ).filter(total_survived__gt=0)
    
    best_species_data = []
    for sp in best_species:
        total = sp['total_survived'] + sp['total_dead']
        rate = round((sp['total_survived'] / total * 100), 1) if total > 0 else 0
        best_species_data.append({
            'name': sp['species_name'],
            'survival_rate': rate,
            'total': total
        })
    
    best_species_data.sort(key=lambda x: x['survival_rate'], reverse=True)
    best_species = best_species_data[0] if best_species_data else None
    
    # Most active group
    most_active_group = Application.objects.filter(
        user__tree_grower_group__isnull=False
    ).values(
        group_name=F('user__tree_grower_group__group_name')
    ).annotate(
        count=Count('application_id')
    ).order_by('-count').first()
    
    # ─── MONTHLY TREND (This Year) ─────────────────────────────────────
    monthly_trend = Application.objects.filter(
        created_at__gte=year_start
    ).annotate(
        month=TruncMonth('created_at')
    ).values('month').annotate(
        submitted=Count('application_id'),
        approved=Count('application_id', filter=Q(status__in=['accepted', 'under_monitoring', 'completed'])),
        completed=Count('application_id', filter=Q(status='completed'))
    ).order_by('month')
    
    monthly_data = [
        {
            "month": entry['month'].strftime('%b'),
            "submitted": entry['submitted'],
            "approved": entry['approved'],
            "completed": entry['completed']
        } for entry in monthly_trend
    ]
    
    # ─── SEEDLINGS DISTRIBUTION TREND ──────────────────────────────────
    seedlings_trend = SeedlingRequest.objects.filter(
        created_at__gte=year_start,
        status='accepted'
    ).annotate(
        month=TruncMonth('created_at')
    ).values('month').annotate(
        seedlings=Coalesce(Sum('seedling_species__quantity'), 0)
    ).order_by('month')
    
    seedlings_data = [
        {
            "month": entry['month'].strftime('%b'),
            "seedlings": entry['seedlings']
        } for entry in seedlings_trend
    ]
    
    return JsonResponse({
        "program_overview": {
            "total_programs": total_programs,
            "active_programs": active_programs,
            "completed_programs": completed_programs,
            "failed_programs": failed_programs,
            "total_tree_growers": total_tree_growers,
            "total_groups": total_groups,
            "approval_rate": round((active_programs + completed_programs) / total_programs * 100, 1) if total_programs > 0 else 0,
            "completion_rate": round(completed_programs / total_programs * 100, 1) if total_programs > 0 else 0,
        },
        "impact_summary": {
            "total_seedlings_distributed": total_seedlings_distributed,
            "total_survived": total_survived,
            "total_dead": total_dead,
            "survival_rate": survival_rate,
            "estimated_carbon_tons": estimated_carbon_tons,
            "total_area_hectares": round(total_area, 2),
        },
        "key_achievements": {
            "top_barangay": top_barangay,
            "best_species": best_species,
            "most_active_group": most_active_group,
        },
        "monthly_trend": monthly_data,
        "seedlings_trend": seedlings_data,
    }, status=200)


@csrf_exempt
def get_program_performance_report(request):
    """
    Program Performance Report - Detailed analysis of all programs
    """
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    user = get_user_from_token(request)
    if not user or user.user_role != 'CityENROHead':
        return JsonResponse({'error': 'Unauthorized: Head only'}, status=403)

    # ─── LIFECYCLE STATS ───────────────────────────────────────────────
    # Average time from application to completion
    completed_apps = Application.objects.filter(
        status='completed',
        confirmed_at__isnull=False
    )
    
    avg_days_to_complete = 0
    if completed_apps.exists():
        total_days = 0
        count = 0
        for app in completed_apps:
            if app.confirmed_at:
                days = (app.updated_at.date() - app.confirmed_at).days
                total_days += days
                count += 1
        avg_days_to_complete = round(total_days / count, 1) if count > 0 else 0
    
    # Status breakdown
    status_breakdown = Application.objects.values('status').annotate(
        count=Count('application_id')
    ).order_by('-count')
    
    status_data = [
        {
            "status": item['status'],
            "count": item['count'],
            "label": dict(Application.STATUS_CHOICES).get(item['status'], item['status'])
        } for item in status_breakdown
    ]
    
    # ─── ALL PROGRAMS TABLE ────────────────────────────────────────────
    all_programs_qs = Application.objects.select_related(
        'user__tree_grower_group',
        'site__reforestation_area__barangay'
    ).prefetch_related(
        'seedling_requests__seedling_species',
        'progress_reports__report_species'
    ).order_by('-created_at')
    
    all_programs = []
    for app in all_programs_qs:
        # Calculate seedlings
        seedlings_requested = sum(
            sr.no_request_seedling for sr in app.seedling_requests.all()
        )
        seedlings_provided = sum(
            sum(s.quantity for s in sr.seedling_species.all())
            for sr in app.seedling_requests.filter(status='accepted')
        )
        
        # Calculate survival
        total_survived = sum(
            pr.total_survived for pr in app.progress_reports.filter(status='accepted')
        )
        total_dead = sum(
            pr.total_dead for pr in app.progress_reports.filter(status='accepted')
        )
        survival_rate = round((total_survived / (total_survived + total_dead) * 100), 1) if (total_survived + total_dead) > 0 else 0
        
        all_programs.append({
            "application_id": app.application_id,
            "ref": f"APP-{app.application_id:04d}",
            "group_name": app.user.tree_grower_group.group_name if hasattr(app.user, 'tree_grower_group') else "Unknown",
            "title": app.title,
            "classification": app.classification,
            "status": app.status,
            "status_label": dict(Application.STATUS_CHOICES).get(app.status, app.status),
            "site_name": app.site.name if app.site else "N/A",
            "barangay": app.site.reforestation_area.barangay.name if app.site and app.site.reforestation_area and app.site.reforestation_area.barangay else "N/A",
            "area_hectares": round(app.site.total_area_hectares, 2) if app.site else 0,
            "seedlings_requested": seedlings_requested,
            "seedlings_provided": seedlings_provided,
            "survival_rate": survival_rate,
            "created_at": app.created_at.strftime('%Y-%m-%d'),
            "confirmed_at": app.confirmed_at.strftime('%Y-%m-%d') if app.confirmed_at else None,
        })
    
    # ─── SUCCESS VS FAILURE ANALYSIS ───────────────────────────────────
    # What makes programs succeed? Analyze by classification, area size, etc.
    success_by_classification = Application.objects.filter(
        status__in=['accepted', 'under_monitoring', 'completed']
    ).values('classification').annotate(
        count=Count('application_id')
    ).order_by('-count')
    
    failure_by_classification = Application.objects.filter(
        status__in=['rejected', 'failed', 'cancelled']
    ).values('classification').annotate(
        count=Count('application_id')
    ).order_by('-count')
    
    return JsonResponse({
        "lifecycle_stats": {
            "avg_days_to_complete": avg_days_to_complete,
            "total_programs": Application.objects.count(),
        },
        "status_breakdown": status_data,
        "all_programs": all_programs,
        "success_analysis": {
            "by_classification": list(success_by_classification),
            "failure_by_classification": list(failure_by_classification),
        }
    }, status=200)


@csrf_exempt
def get_species_performance_report(request):
    """
    Species Performance Report - Biological insights
    """
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    user = get_user_from_token(request)
    if not user or user.user_role != 'CityENROHead':
        return JsonResponse({'error': 'Unauthorized: Head only'}, status=403)

    # ─── SPECIES DISTRIBUTION ──────────────────────────────────────────
    species_requested = SeedlingRequestSpecies.objects.filter(
        seedling_request__status='accepted'
    ).values(
        species_id=F('tree_species__tree_specie_id'),
        species_name=F('tree_species__name')
    ).annotate(
        total_requested=Sum('quantity')
    ).order_by('-total_requested')
    
    # ─── SPECIES SURVIVAL ──────────────────────────────────────────────
    species_survival = ProgressReportSpecies.objects.values(
        species_id=F('tree_species__tree_specie_id'),
        species_name=F('tree_species__name')
    ).annotate(
        total_survived=Coalesce(Sum('no_survived'), 0),
        total_dead=Coalesce(Sum('no_dead'), 0)
    )
    
    # Merge data
    survival_map = {item['species_id']: item for item in species_survival}
    
    species_data = []
    for sp in species_requested:
        surv = survival_map.get(sp['species_id'], {'total_survived': 0, 'total_dead': 0})
        total = surv['total_survived'] + surv['total_dead']
        survival_rate = round((surv['total_survived'] / total * 100), 1) if total > 0 else 0
        
        species_data.append({
            "species_id": sp['species_id'],
            "species_name": sp['species_name'],
            "total_requested": sp['total_requested'],
            "total_survived": surv['total_survived'],
            "total_dead": surv['total_dead'],
            "survival_rate": survival_rate,
        })
    
    # Sort by survival rate for recommendations
    species_by_survival = sorted(species_data, key=lambda x: x['survival_rate'], reverse=True)
    
    # ─── RECOMMENDATIONS ───────────────────────────────────────────────
    recommendations = []
    if species_by_survival:
        top_performer = species_by_survival[0]
        if top_performer['survival_rate'] >= 80:
            recommendations.append({
                "type": "success",
                "message": f"{top_performer['species_name']} shows excellent survival rate ({top_performer['survival_rate']}%). Consider increasing propagation."
            })
        
        low_performers = [sp for sp in species_by_survival if sp['survival_rate'] < 50 and sp['total_survived'] + sp['total_dead'] > 0]
        if low_performers:
            names = ", ".join([sp['species_name'] for sp in low_performers[:3]])
            recommendations.append({
                "type": "warning",
                "message": f"{names} show low survival rates. Review planting techniques or site suitability."
            })
    
    return JsonResponse({
        "species_data": species_data,
        "species_by_survival": species_by_survival[:10],  # Top 10
        "recommendations": recommendations,
    }, status=200)


@csrf_exempt
def get_compliance_report(request):
    """
    Tree Grower Compliance Report - Accountability
    """
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    user = get_user_from_token(request)
    if not user or user.user_role != 'CityENROHead':
        return JsonResponse({'error': 'Unauthorized: Head only'}, status=403)

    now = timezone.now()
    ninety_days_ago = now - timedelta(days=90)

    # ─── COMPLIANCE RATE BY GROUP ──────────────────────────────────────
    active_apps = Application.objects.filter(
        status__in=['accepted', 'under_monitoring']
    ).select_related(
        'user__tree_grower_group'
    ).prefetch_related('progress_reports')
    
    compliance_data = []
    for app in active_apps:
        group_name = app.user.tree_grower_group.group_name if hasattr(app.user, 'tree_grower_group') else "Unknown"
        
        # Check if submitted reports in last 90 days
        recent_reports = app.progress_reports.filter(
            created_at__gte=ninety_days_ago
        ).count()
        
        last_report = app.progress_reports.order_by('-created_at').first()
        days_since_last = (now - last_report.created_at).days if last_report else None
        
        # Calculate survival rate
        total_survived = sum(pr.total_survived for pr in app.progress_reports.filter(status='accepted'))
        total_dead = sum(pr.total_dead for pr in app.progress_reports.filter(status='accepted'))
        survival_rate = round((total_survived / (total_survived + total_dead) * 100), 1) if (total_survived + total_dead) > 0 else 0
        
        # Compliance status
        if days_since_last is None or days_since_last > 90:
            compliance_status = "Non-Compliant"
        elif days_since_last > 60:
            compliance_status = "Warning"
        else:
            compliance_status = "Compliant"
        
        compliance_data.append({
            "application_id": app.application_id,
            "group_name": group_name,
            "site_name": app.site.name if app.site else "N/A",
            "recent_reports": recent_reports,
            "days_since_last_report": days_since_last,
            "survival_rate": survival_rate,
            "compliance_status": compliance_status,
        })
    
    # ─── TOP PERFORMERS ────────────────────────────────────────────────
    top_performers = sorted(
        [c for c in compliance_data if c['compliance_status'] == 'Compliant'],
        key=lambda x: x['survival_rate'],
        reverse=True
    )[:5]
    
    # ─── NON-COMPLIANT GROUPS ──────────────────────────────────────────
    non_compliant = [c for c in compliance_data if c['compliance_status'] == 'Non-Compliant']
    
    # ─── OVERALL STATS ─────────────────────────────────────────────────
    total_active = len(compliance_data)
    compliant_count = len([c for c in compliance_data if c['compliance_status'] == 'Compliant'])
    warning_count = len([c for c in compliance_data if c['compliance_status'] == 'Warning'])
    non_compliant_count = len([c for c in compliance_data if c['compliance_status'] == 'Non-Compliant'])
    
    overall_compliance_rate = round((compliant_count / total_active * 100), 1) if total_active > 0 else 0
    
    return JsonResponse({
        "overall_stats": {
            "total_active_programs": total_active,
            "compliant_count": compliant_count,
            "warning_count": warning_count,
            "non_compliant_count": non_compliant_count,
            "overall_compliance_rate": overall_compliance_rate,
        },
        "compliance_data": compliance_data,
        "top_performers": top_performers,
        "non_compliant_groups": non_compliant,
    }, status=200)


@csrf_exempt
def get_geographic_impact_report(request):
    """
    Geographic Impact Report - GIS-focused analysis
    """
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    user = get_user_from_token(request)
    if not user or user.user_role != 'CityENROHead':
        return JsonResponse({'error': 'Unauthorized: Head only'}, status=403)

    # ─── HECTARES BY BARANGAY ──────────────────────────────────────────
    hectares_by_barangay = Sites.objects.filter(
        reforestation_area__barangay__isnull=False,
        status__in=['accepted', 'under_monitoring', 'completed']
    ).values(
        barangay_name=F('reforestation_area__barangay__name')
    ).annotate(
        total_hectares=Coalesce(Sum('total_area_hectares'), 0.0),
        site_count=Count('site_id')
    ).order_by('-total_hectares')
    
    # ─── PROGRAMS BY BARANGAY ──────────────────────────────────────────
    programs_by_barangay = Application.objects.filter(
        site__reforestation_area__barangay__isnull=False
    ).values(
        barangay_name=F('site__reforestation_area__barangay__name')
    ).annotate(
        program_count=Count('application_id'),
        completed_count=Count('application_id', filter=Q(status='completed')),
        active_count=Count('application_id', filter=Q(status__in=['accepted', 'under_monitoring']))
    ).order_by('-program_count')
    
    # ─── LAND CLASSIFICATION COMPLIANCE ────────────────────────────────
    land_class_dist = SiteMetaDataVerification.objects.filter(
        verified_land_classification__isnull=False
    ).values(
        classification_name=F('verified_land_classification__name'),
        for_reforestation=F('verified_land_classification__for_reforestation')
    ).annotate(
        count=Count('id')
    ).order_by('-count')
    
    total_verified = sum(item['count'] for item in land_class_dist)
    compliant_count = sum(item['count'] for item in land_class_dist if item['for_reforestation'])
    compliance_percentage = round((compliant_count / total_verified * 100), 1) if total_verified > 0 else 0
    
    # ─── NDVI SCORE DISTRIBUTION ───────────────────────────────────────
    ndvi_scores = Sites.objects.filter(
        ndvi_value__isnull=False,
        status__in=['accepted', 'under_monitoring', 'completed']
    ).values_list('ndvi_value', flat=True)
    
    ndvi_distribution = {
        "excellent": len([s for s in ndvi_scores if s >= 0.7]),
        "good": len([s for s in ndvi_scores if 0.5 <= s < 0.7]),
        "moderate": len([s for s in ndvi_scores if 0.3 <= s < 0.5]),
        "poor": len([s for s in ndvi_scores if s < 0.3]),
    }
    
    return JsonResponse({
        "hectares_by_barangay": list(hectares_by_barangay),
        "programs_by_barangay": list(programs_by_barangay),
        "land_classification": {
            "distribution": list(land_class_dist),
            "compliance_percentage": compliance_percentage,
        },
        "ndvi_distribution": ndvi_distribution,
    }, status=200)


@csrf_exempt
def get_audit_trail_report(request):
    """
    Audit Trail Report - Security and integrity logs
    """
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    user = get_user_from_token(request)
    if not user or user.user_role != 'CityENROHead':
        return JsonResponse({'error': 'Unauthorized: Head only'}, status=403)

    # ─── HEAD'S DECISIONS ──────────────────────────────────────────────
    head_decisions = Reason.objects.filter(
        user__user_role='CityENROHead'
    ).select_related(
        'user__profile', 'application'
    ).order_by('-created')[:50]  # Last 50 decisions
    
    decisions_data = []
    for reason in head_decisions:
        decisions_data.append({
            "reason_id": reason.reason_id,
            "application_ref": f"APP-{reason.application.application_id:04d}" if reason.application else "N/A",
            "application_title": reason.application.title if reason.application else "N/A",
            "decision": reason.status,
            "decision_label": dict(Reason.STATUS_CHOICES).get(reason.status, reason.status),
            "reason_text": reason.reason,
            "decided_by": f"{reason.user.profile.first_name} {reason.user.profile.last_name}" if hasattr(reason.user, 'profile') else reason.user.email,
            "decided_at": reason.created.strftime('%Y-%m-%d %H:%M'),
        })
    
    # ─── SYSTEM ACTIVITY LOG ───────────────────────────────────────────
    all_activities = Reason.objects.select_related(
        'user__profile', 'application'
    ).order_by('-created')[:100]  # Last 100 activities
    
    activities_data = []
    for reason in all_activities:
        activities_data.append({
            "reason_id": reason.reason_id,
            "user_role": reason.user.user_role,
            "user_name": f"{reason.user.profile.first_name} {reason.user.profile.last_name}" if hasattr(reason.user, 'profile') else reason.user.email,
            "action": reason.status_layer,
            "action_label": dict(Reason.STATUS_LAYER_CHOICES).get(reason.status_layer, reason.status_layer),
            "application_ref": f"APP-{reason.application.application_id:04d}" if reason.application else "N/A",
            "status": reason.status,
            "reason_text": reason.reason[:100] + "..." if len(reason.reason) > 100 else reason.reason,
            "timestamp": reason.created.strftime('%Y-%m-%d %H:%M:%S'),
        })
    
    # ─── ACTIVITY SUMMARY ──────────────────────────────────────────────
    activity_summary = Reason.objects.values(
        'status_layer'
    ).annotate(
        count=Count('reason_id')
    ).order_by('-count')
    
    summary_data = [
        {
            "action": item['status_layer'],
            "action_label": dict(Reason.STATUS_LAYER_CHOICES).get(item['status_layer'], item['status_layer']),
            "count": item['count']
        } for item in activity_summary
    ]
    
    return JsonResponse({
        "head_decisions": decisions_data,
        "system_activities": activities_data,
        "activity_summary": summary_data,
    }, status=200)




@csrf_exempt
def get_pending_head_count(request):
    """
    Returns the count of applications pending Head's confirmation.
    Used for real-time badge updates in sidebar.
    """
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    
    user = get_user_from_token(request)
    if not user or user.user_role != 'CityENROHead':
        return JsonResponse({'error': 'Unauthorized'}, status=403)
    
    # Efficient count query - only counts applications waiting for Head
    pending_count = Application.objects.filter(status='for_head').count()
    
    return JsonResponse({
        'pending_count': pending_count,
        'timestamp': timezone.now().isoformat()
    }, status=200)