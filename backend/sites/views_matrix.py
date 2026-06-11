import json
import logging
import math
from django.db import IntegrityError, transaction
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import get_object_or_404
from django.utils import timezone
from accounts.helper import get_user_from_token
from .models import (
    Sites, Site_data, Site_species_recommendation, Site_images, 
    Potential_sites, SiteMetaDataVerification, PermitDocument
)
from reforestation_areas.models import Reforestation_areas
from tree_species.models import Tree_species
from Field_assessment.models import Field_assessment
logger = logging.getLogger(__name__)
from django.db.models import Count, Sum, Q
from django.db.models.functions import TruncMonth
from datetime import datetime, timedelta


@csrf_exempt
def get_area_details(request, area_id):
    """
    GET: Returns comprehensive statistics and data for a reforestation area.
    """
    if request.method != "GET":
        return JsonResponse({"error": "GET only"}, status=405)
    
    try:
        # Get the reforestation area
        area = get_object_or_404(Reforestation_areas, reforestation_area_id=area_id)
        
        # Get all sites in this area
        sites = Sites.objects.filter(reforestation_area=area, is_active=True)
        
        # Total sites count
        total_sites = sites.count()
        
        # Get verification data for sites
        verified_sites = sites.filter(
            meta_verification__status='verified'
        ).count()
        
        pending_sites = sites.filter(
            Q(meta_verification__status='pending') | Q(meta_verification__status='draft')
        ).count()
        
        rejected_sites = sites.filter(
            meta_verification__status='rejected'
        ).count()
        
        # Calculate total area and seedlings
        total_area_hectares = sites.aggregate(
            total_area=Sum('total_area_hectares')
        )['total_area'] or 0
        
        total_seedlings = sites.aggregate(
            total_seedlings=Sum('total_seedlings_planted')
        )['total_seedlings'] or 0
        
        # Count unique species recommended across all sites
        species_count = Site_species_recommendation.objects.filter(
            site__reforestation_area=area
        ).values('tree_species').distinct().count()
        
        # Calculate verification rate
        verification_rate = (verified_sites / total_sites * 100) if total_sites > 0 else 0
        
        # Monthly data for the last 6 months
        six_months_ago = datetime.now() - timedelta(days=180)
        
        monthly_data = sites.filter(
            created_at__gte=six_months_ago
        ).annotate(
            month=TruncMonth('created_at')
        ).values('month').annotate(
            sites_created=Count('site_id'),
            verified=Count('site_id', filter=Q(meta_verification__status='verified'))
        ).order_by('month')
        
        # Format monthly data for chart
        monthly_chart_data = []
        for item in monthly_data:
            monthly_chart_data.append({
                'month': item['month'].strftime('%b'),
                'sites_created': item['sites_created'],
                'verified': item['verified']
            })
        
        # If no data, provide empty months
        if not monthly_chart_data:
            months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
            monthly_chart_data = [{'month': m, 'sites_created': 0, 'verified': 0} for m in months]
        
        # Status distribution for pie chart
        status_distribution = [
            {'name': 'Verified', 'value': verified_sites},
            {'name': 'Pending', 'value': pending_sites},
            {'name': 'Rejected', 'value': rejected_sites},
        ]
        
        # Get barangay and land classification info
        barangay_name = area.barangay.name if area.barangay else None
        land_classification = None
        
        # Try to get land classification from first verified site
        first_verified_site = sites.filter(
            meta_verification__status='verified',
            meta_verification__verified_land_classification__isnull=False
        ).first()
        
        if first_verified_site and first_verified_site.meta_verification.verified_land_classification:
            land_classification = first_verified_site.meta_verification.verified_land_classification.name
        
        return JsonResponse({
            'total_sites': total_sites,
            'verified_sites': verified_sites,
            'pending_sites': pending_sites,
            'rejected_sites': rejected_sites,
            'total_seedlings': total_seedlings,
            'total_area_hectares': total_area_hectares,
            'species_count': species_count,
            'verification_rate': round(verification_rate, 2),
            'monthly_data': monthly_chart_data,
            'status_distribution': status_distribution,
            'barangay': barangay_name,
            'land_classification': land_classification,
        }, status=200)
        
    except Exception as e:
        return JsonResponse({
            'error': str(e),
            'total_sites': 0,
            'verified_sites': 0,
            'pending_sites': 0,
            'rejected_sites': 0,
            'total_seedlings': 0,
            'total_area_hectares': 0,
            'species_count': 0,
            'verification_rate': 0,
            'monthly_data': [],
            'status_distribution': [],
        }, status=500)