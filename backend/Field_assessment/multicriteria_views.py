from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import get_object_or_404
from django.db.models import Q
from .models import (
    Assigned_onsite_inspector,
    Field_assessment,
    Field_assessment_details,
    Field_assessment_multicriteria_photos
)
from sites.models import Sites  # Imported to fetch site details and reforestation area


@csrf_exempt
def get_field_assessments_safety(request, site_id):
    if request.method != "GET":
        return JsonResponse({"error": "Only GET allowed"}, status=405)

    # Get Site object to derive reforestation_area_id
    site = get_object_or_404(Sites, site_id=site_id)
    reforestation_area_id = site.reforestation_area.reforestation_area_id

    # Filter assessments directly by site_id
    assessments = Field_assessment.objects.filter(
        site_id=site_id,
        is_sent=True
    ).select_related(
        "assigned_onsite_inspector",
        "assigned_onsite_inspector__user",
        "assigned_onsite_inspector__user__profile"
    ).prefetch_related(
        "field_assessment_multicriteria", 
        "Field_assessment_multicriteria_photos"
    )

    results = []
    for fa in assessments:
        if not fa.safety or fa.safety in ['', 'pending']:
            continue
        
        assignment = fa.assigned_onsite_inspector
        profile = getattr(assignment.user, "profile", None)
        full_name = " ".join(filter(None, [
            getattr(profile, 'first_name', ''),
            getattr(profile, 'middle_name', ''),
            getattr(profile, 'last_name', '')
        ])) if profile else assignment.user.get_full_name() or assignment.user.username
        
        profile_img = f"/media/{profile.profile_img}" if profile and getattr(profile, 'profile_img', None) else None
        user_info = {
            "user_id": assignment.user.id,
            "full_name": full_name.strip() or assignment.user.username,
            "email": assignment.user.email,
            "profile_img": profile_img
        }

        multicriteria = fa.field_assessment_multicriteria.first()
        discussion = multicriteria.safety_disccussion.strip() if multicriteria and multicriteria.safety_disccussion else None
        
        photos_qs = Field_assessment_multicriteria_photos.objects.filter(
            field_assessment=fa, multicriteria_type='safety'
        )
        photos = [{"photo_id": p.field_assessment_multicriteria_photo_id, "url": f"/media/{p.img}", "type": p.multicriteria_type} 
                 for p in photos_qs if p.img]

        results.append({
            "field_assessment_id": fa.field_assessment_id,
            "created_at": fa.created_at.isoformat() if fa.created_at else None,
            "safety_value": fa.safety,
            "safety_label": fa.get_safety_display(),
            "multicriteria_status": fa.safety,
            "discussion": discussion,
            "photos": photos,
            "photos_count": len(photos),
            "user": user_info
        })

    return JsonResponse({
        "reforestation_area_id": reforestation_area_id,
        "site_id": site_id,
        "criteria": "Safety",
        "count": len(results),
        "results": results
    }, status=200)


@csrf_exempt
def get_field_assessments_soil_quality(request, site_id):
    """
    Get soil quality assessments with discussion, status, photos, site details, and soil names.
    """
    if request.method != "GET":
        return JsonResponse({"error": "Only GET allowed"}, status=405)

    # Get Site object to derive reforestation_area_id
    site = get_object_or_404(Sites, site_id=site_id)
    reforestation_area_id = site.reforestation_area.reforestation_area_id

    # Filter assessments directly by site_id
    assessments = Field_assessment.objects.filter(
        site_id=site_id,
        is_sent=True,
    ).select_related(
        "assigned_onsite_inspector",
        "assigned_onsite_inspector__user",
        "assigned_onsite_inspector__user__profile",
        "site"
    ).prefetch_related(
        "field_assessment_multicriteria",
        "Field_assessment_multicriteria_photos",
        "field_assessment_details__soil"
    )

    results = []

    for fa in assessments:
        # Skip if no soil quality value
        if not fa.soil_quality or fa.soil_quality in ['', 'moderate']:
            continue
        
        assignment = fa.assigned_onsite_inspector
        # Build user info
        profile = getattr(assignment.user, "profile", None)
        full_name = (
            " ".join(filter(None, [
                getattr(profile, 'first_name', ''),
                getattr(profile, 'middle_name', ''),
                getattr(profile, 'last_name', '')
            ]))
            if profile
            else assignment.user.get_full_name() or assignment.user.username
        )
        profile_img = f"/media/{profile.profile_img}" if profile and getattr(profile, 'profile_img', None) else None
        
        user_info = {
            "user_id": assignment.user.id,
            "full_name": full_name.strip() or assignment.user.username,
            "email": assignment.user.email,
            "profile_img": profile_img
        }

        # Get multicriteria (discussion + status)
        multicriteria = fa.field_assessment_multicriteria.first()
        base_discussion = None
        
        if multicriteria:
            base_discussion = multicriteria.soil_quality_disccussion
            if base_discussion and isinstance(base_discussion, str):
                base_discussion = base_discussion.strip()
        
        # ✅ Get soil details and append to discussion as formatted string
        soil_details_qs = Field_assessment_details.objects.filter(
            field_assessment=fa
        ).select_related('soil')
        
        soil_lines = []
        for detail in soil_details_qs:
            if detail.soil:
                if detail.soil.description:
                    soil_lines.append(f"• {detail.soil.name}: {detail.soil.description}")
                else:
                    soil_lines.append(f"• {detail.soil.name}")
        
        # ✅ Combine base discussion + soil details with newline separator
        if base_discussion and soil_lines:
            discussion = f"{base_discussion}\n\nSoils Identified:\n" + "\n".join(soil_lines)
        elif soil_lines:
            discussion = "Soils Identified:\n" + "\n".join(soil_lines)
        else:
            discussion = base_discussion

        # Get soil quality photos
        photos_qs = Field_assessment_multicriteria_photos.objects.filter(
            field_assessment=fa,
            multicriteria_type='soil_quality'
        )
        
        photos = []
        for photo in photos_qs:
            if photo.img:
                photos.append({
                    "photo_id": photo.field_assessment_multicriteria_photo_id,
                    "url": f"/media/{photo.img}",
                    "type": photo.multicriteria_type,
                    "uploaded_at": photo.created_at.isoformat() if photo.created_at else None
                })

        # Get site details
        site_details = None
        if fa.site:
            site_details = {
                "site_id": fa.site.site_id,
                "site_name": getattr(fa.site, 'site_name', None),
                "location": getattr(fa.site, 'location', None),
                "area_hectares": float(fa.site.area_hectares) if getattr(fa.site, 'area_hectares', None) else None,
            }

        results.append({
            "field_assessment_id": fa.field_assessment_id,
            "assigned_onsite_inspector_id": assignment.assigned_onsite_inspector_id,
            "site_id": fa.site_id,
            "created_at": fa.created_at.isoformat() if fa.created_at else None,
            
            # Soil Quality Data
            "soil_quality_value": fa.soil_quality,
            "soil_quality_label": fa.get_soil_quality_display(),
            "multicriteria_status": fa.soil_quality,
            
            # ✅ Discussion now includes soil details as formatted string
            "discussion": discussion,
            
            # Photos
            "photos": photos,
            "photos_count": len(photos),
            
            # Site Details (if available)
            "site_details": site_details,
            
            # ✅ Soil count only (details are in discussion string)
            "soils_count": len(soil_lines),
            
            # User Info
            "user": user_info
        })

    return JsonResponse({
        "reforestation_area_id": reforestation_area_id,
        "site_id": site_id,
        "criteria": "Soil Quality",
        "count": len(results),
        "results": results
    }, status=200)


@csrf_exempt
def get_field_assessments_accessibility(request, site_id):
    if request.method != "GET":
        return JsonResponse({"error": "Only GET allowed"}, status=405)

    # Get Site object to derive reforestation_area_id
    site = get_object_or_404(Sites, site_id=site_id)
    reforestation_area_id = site.reforestation_area.reforestation_area_id

    assessments = Field_assessment.objects.filter(
        site_id=site_id,
        is_sent=True
    ).select_related(
        "assigned_onsite_inspector",
        "assigned_onsite_inspector__user",
        "assigned_onsite_inspector__user__profile"
    ).prefetch_related(
        "field_assessment_multicriteria", 
        "Field_assessment_multicriteria_photos"
    )

    results = []
    for fa in assessments:
        if not fa.accessibility or fa.accessibility in ['', 'moderate']:
            continue
        
        assignment = fa.assigned_onsite_inspector
        profile = getattr(assignment.user, "profile", None)
        full_name = " ".join(filter(None, [
            getattr(profile, 'first_name', ''),
            getattr(profile, 'middle_name', ''),
            getattr(profile, 'last_name', '')
        ])) if profile else assignment.user.get_full_name() or assignment.user.username
        profile_img = f"/media/{profile.profile_img}" if profile and getattr(profile, 'profile_img', None) else None
        
        user_info = {
            "user_id": assignment.user.id,
            "full_name": full_name.strip() or assignment.user.username,
            "email": assignment.user.email,
            "profile_img": profile_img
        }

        multicriteria = fa.field_assessment_multicriteria.first()
        base_discussion = multicriteria.accessibility_disccussion.strip() if multicriteria and multicriteria.accessibility_disccussion else None
        
        # ✅ Append route/transport notes if available in coordinates or other fields
        route_lines = []
        if fa.coordinates and isinstance(fa.coordinates, dict):
            access_notes = fa.coordinates.get('access_notes')
            if access_notes:
                route_lines.append(f"• Notes: {access_notes}")
            transport = fa.coordinates.get('primary_transport')
            if transport:
                route_lines.append(f"• Transport: {transport}")
        
        if base_discussion and route_lines:
            discussion = f"{base_discussion}\n\n🚶 Access Route Details:\n" + "\n".join(route_lines)
        elif route_lines:
            discussion = "🚶 Access Route Details:\n" + "\n".join(route_lines)
        else:
            discussion = base_discussion

        photos_qs = Field_assessment_multicriteria_photos.objects.filter(
            field_assessment=fa, multicriteria_type='accessibility'
        )
        photos = [{"photo_id": p.field_assessment_multicriteria_photo_id, "url": f"/media/{p.img}", "type": p.multicriteria_type} 
                 for p in photos_qs if p.img]

        results.append({
            "field_assessment_id": fa.field_assessment_id,
            "created_at": fa.created_at.isoformat() if fa.created_at else None,
            "accessibility_value": fa.accessibility,
            "accessibility_label": fa.get_accessibility_display(),
            "multicriteria_status": fa.accessibility,
            "discussion": discussion,
            "photos": photos,
            "photos_count": len(photos),
            "user": user_info
        })

    return JsonResponse({
        "reforestation_area_id": reforestation_area_id,
        "site_id": site_id,
        "criteria": "Accessibility",
        "count": len(results),
        "results": results
    }, status=200)


@csrf_exempt
def get_field_assessments_slope(request, site_id):
    if request.method != "GET":
        return JsonResponse({"error": "Only GET allowed"}, status=405)

    # Get Site object to derive reforestation_area_id
    site = get_object_or_404(Sites, site_id=site_id)
    reforestation_area_id = site.reforestation_area.reforestation_area_id

    assessments = Field_assessment.objects.filter(
        site_id=site_id,
        is_sent=True
    ).select_related(
        "assigned_onsite_inspector",
        "assigned_onsite_inspector__user",
        "assigned_onsite_inspector__user__profile"
    ).prefetch_related(
        "field_assessment_multicriteria", 
        "Field_assessment_multicriteria_photos"
    )

    results = []
    for fa in assessments:
        if fa.slope is None or fa.slope == 0.00:
            continue
        
        assignment = fa.assigned_onsite_inspector
        profile = getattr(assignment.user, "profile", None)
        full_name = " ".join(filter(None, [
            getattr(profile, 'first_name', ''),
            getattr(profile, 'middle_name', ''),
            getattr(profile, 'last_name', '')
        ])) if profile else assignment.user.get_full_name() or assignment.user.username
        profile_img = f"/media/{profile.profile_img}" if profile and getattr(profile, 'profile_img', None) else None
        
        user_info = {
            "user_id": assignment.user.id,
            "full_name": full_name.strip() or assignment.user.username,
            "email": assignment.user.email,
            "profile_img": profile_img
        }

        multicriteria = fa.field_assessment_multicriteria.first()
        base_discussion = multicriteria.slope_disccussion.strip() if multicriteria and multicriteria.slope_disccussion else None
        
        # ✅ Append coordinate info if available
        coord_lines = []
        if fa.coordinates:
            try:
                coords = fa.coordinates if isinstance(fa.coordinates, dict) else {}
                if coords.get('lat') and coords.get('lng'):
                    coord_lines.append(f"• Location: {coords['lat']}, {coords['lng']}")
                if coords.get('elevation'):
                    coord_lines.append(f"• Elevation: {coords['elevation']}m")
            except:
                pass
        
        if fa.polygon_coordinates:
            coord_lines.append("• Polygon boundary defined")
        
        # Combine discussion + coordinates
        if base_discussion and coord_lines:
            discussion = f"{base_discussion}\n\n📍 Survey Coordinates:\n" + "\n".join(coord_lines)
        elif coord_lines:
            discussion = "📍 Survey Coordinates:\n" + "\n".join(coord_lines)
        else:
            discussion = base_discussion

        photos_qs = Field_assessment_multicriteria_photos.objects.filter(
            field_assessment=fa, multicriteria_type='slope'
        )
        photos = [{"photo_id": p.field_assessment_multicriteria_photo_id, "url": f"/media/{p.img}", "type": p.multicriteria_type} 
                 for p in photos_qs if p.img]

        results.append({
            "field_assessment_id": fa.field_assessment_id,
            "created_at": fa.created_at.isoformat() if fa.created_at else None,
            "slope_value": float(fa.slope),
            "slope_label": f"{fa.slope}°",
            "multicriteria_status": str(fa.slope),
            "discussion": discussion,
            "photos": photos,
            "photos_count": len(photos),
            "user": user_info
        })

    return JsonResponse({
        "reforestation_area_id": reforestation_area_id,
        "site_id": site_id,
        "criteria": "Slope",
        "count": len(results),
        "results": results
    }, status=200)


@csrf_exempt
def get_field_assessments_water_accessibility(request, site_id):
    if request.method != "GET":
        return JsonResponse({"error": "Only GET allowed"}, status=405)

    # Get Site object to derive reforestation_area_id
    site = get_object_or_404(Sites, site_id=site_id)
    reforestation_area_id = site.reforestation_area.reforestation_area_id

    assessments = Field_assessment.objects.filter(
        site_id=site_id,
        is_sent=True
    ).select_related(
        "assigned_onsite_inspector",
        "assigned_onsite_inspector__user",
        "assigned_onsite_inspector__user__profile"
    ).prefetch_related(
        "field_assessment_multicriteria", 
        "Field_assessment_multicriteria_photos"
    )

    results = []
    for fa in assessments:
        if not fa.distance_to_water_source or fa.distance_to_water_source.strip() == '':
            continue
        
        assignment = fa.assigned_onsite_inspector
        profile = getattr(assignment.user, "profile", None)
        full_name = " ".join(filter(None, [
            getattr(profile, 'first_name', ''),
            getattr(profile, 'middle_name', ''),
            getattr(profile, 'last_name', '')
        ])) if profile else assignment.user.get_full_name() or assignment.user.username
        profile_img = f"/media/{profile.profile_img}" if profile and getattr(profile, 'profile_img', None) else None
        
        user_info = {
            "user_id": assignment.user.id,
            "full_name": full_name.strip() or assignment.user.username,
            "email": assignment.user.email,
            "profile_img": profile_img
        }

        multicriteria = fa.field_assessment_multicriteria.first()
        base_discussion = multicriteria.distance_to_water_source_disccussion.strip() if multicriteria and multicriteria.distance_to_water_source_disccussion else None
        
        # ✅ Append water source type info
        source_lines = []
        distance = fa.distance_to_water_source.strip()
        if distance:
            source_lines.append(f"• Distance: {distance}")
        
        if fa.coordinates and isinstance(fa.coordinates, dict):
            source_type = fa.coordinates.get('water_source_type')
            if source_type:
                source_lines.append(f"• Source Type: {source_type}")
        
        if base_discussion and source_lines:
            discussion = f"{base_discussion}\n\n💧 Water Source Details:\n" + "\n".join(source_lines)
        elif source_lines:
            discussion = "💧 Water Source Details:\n" + "\n".join(source_lines)
        else:
            discussion = base_discussion

        photos_qs = Field_assessment_multicriteria_photos.objects.filter(
            field_assessment=fa, multicriteria_type='water_accessibility'
        )
        photos = [{"photo_id": p.field_assessment_multicriteria_photo_id, "url": f"/media/{p.img}", "type": p.multicriteria_type} 
                 for p in photos_qs if p.img]

        results.append({
            "field_assessment_id": fa.field_assessment_id,
            "created_at": fa.created_at.isoformat() if fa.created_at else None,
            "distance_value": fa.distance_to_water_source,
            "distance_label": fa.distance_to_water_source,
            "multicriteria_status": fa.distance_to_water_source,
            "discussion": discussion,
            "photos": photos,
            "photos_count": len(photos),
            "user": user_info
        })

    return JsonResponse({
        "reforestation_area_id": reforestation_area_id,
        "site_id": site_id,
        "criteria": "Water Accessibility",
        "count": len(results),
        "results": results
    }, status=200)


@csrf_exempt
def get_field_assessments_wildlife(request, site_id):
    if request.method != "GET":
        return JsonResponse({"error": "Only GET allowed"}, status=405)

    # Get Site object to derive reforestation_area_id
    site = get_object_or_404(Sites, site_id=site_id)
    reforestation_area_id = site.reforestation_area.reforestation_area_id

    assessments = Field_assessment.objects.filter(
        site_id=site_id,
        is_sent=True
    ).select_related(
        "assigned_onsite_inspector",
        "assigned_onsite_inspector__user",
        "assigned_onsite_inspector__user__profile"
    ).prefetch_related(
        "field_assessment_multicriteria", 
        "Field_assessment_multicriteria_photos",
        "field_assessment_details__tree_specie"
    )

    results = []
    for fa in assessments:
        if not fa.wildlife_status or fa.wildlife_status in ['', 'moderate']:
            continue
        
        assignment = fa.assigned_onsite_inspector
        profile = getattr(assignment.user, "profile", None)
        full_name = " ".join(filter(None, [
            getattr(profile, 'first_name', ''),
            getattr(profile, 'middle_name', ''),
            getattr(profile, 'last_name', '')
        ])) if profile else assignment.user.get_full_name() or assignment.user.username
        profile_img = f"/media/{profile.profile_img}" if profile and getattr(profile, 'profile_img', None) else None
        
        user_info = {
            "user_id": assignment.user.id,
            "full_name": full_name.strip() or assignment.user.username,
            "email": assignment.user.email,
            "profile_img": profile_img
        }

        multicriteria = fa.field_assessment_multicriteria.first()
        base_discussion = multicriteria.wildlife_status_disccussion.strip() if multicriteria and multicriteria.wildlife_status_disccussion else None
        
        # ✅ Append observed species from Field_assessment_details
        species_lines = []
        details_qs = Field_assessment_details.objects.filter(
            field_assessment=fa
        ).select_related('tree_specie')
        
        for detail in details_qs:
            if detail.tree_specie:
                species_name = detail.tree_specie.common_name or detail.tree_specie.scientific_name
                if species_name:
                    species_lines.append(f"• {species_name}")
        
        if base_discussion and species_lines:
            discussion = f"{base_discussion}\n\n🦌 Observed Species:\n" + "\n".join(species_lines)
        elif species_lines:
            discussion = "🦌 Observed Species:\n" + "\n".join(species_lines)
        else:
            discussion = base_discussion

        photos_qs = Field_assessment_multicriteria_photos.objects.filter(
            field_assessment=fa, multicriteria_type='wildlife_status'
        )
        photos = [{"photo_id": p.field_assessment_multicriteria_photo_id, "url": f"/media/{p.img}", "type": p.multicriteria_type} 
                 for p in photos_qs if p.img]

        results.append({
            "field_assessment_id": fa.field_assessment_id,
            "created_at": fa.created_at.isoformat() if fa.created_at else None,
            "wildlife_value": fa.wildlife_status,
            "wildlife_label": fa.get_wildlife_status_display(),
            "multicriteria_status": fa.wildlife_status,
            "discussion": discussion,
            "photos": photos,
            "photos_count": len(photos),
            "user": user_info
        })

    return JsonResponse({
        "reforestation_area_id": reforestation_area_id,
        "site_id": site_id,
        "criteria": "Wildlife Impact",
        "count": len(results),
        "results": results
    }, status=200)


@csrf_exempt
def get_field_assessments_legality(request, site_id):
    if request.method != "GET":
        return JsonResponse({"error": "Only GET allowed"}, status=405)

    # Get Site object to derive reforestation_area_id
    site = get_object_or_404(Sites, site_id=site_id)
    reforestation_area_id = site.reforestation_area.reforestation_area_id

    assessments = Field_assessment.objects.filter(
        site_id=site_id,
        is_sent=True
    ).select_related(
        "assigned_onsite_inspector",
        "assigned_onsite_inspector__user",
        "assigned_onsite_inspector__user__profile"
    ).prefetch_related(
        "field_assessment_multicriteria", 
        "Field_assessment_multicriteria_photos"
    )

    results = []
    for fa in assessments:
        if not fa.legality or fa.legality in ['', 'pending']:
            continue
        
        assignment = fa.assigned_onsite_inspector
        profile = getattr(assignment.user, "profile", None)
        full_name = " ".join(filter(None, [
            getattr(profile, 'first_name', ''),
            getattr(profile, 'middle_name', ''),
            getattr(profile, 'last_name', '')
        ])) if profile else assignment.user.get_full_name() or assignment.user.username
        profile_img = f"/media/{profile.profile_img}" if profile and getattr(profile, 'profile_img', None) else None
        
        user_info = {
            "user_id": assignment.user.id,
            "full_name": full_name.strip() or assignment.user.username,
            "email": assignment.user.email,
            "profile_img": profile_img
        }

        multicriteria = fa.field_assessment_multicriteria.first()
        discussion = multicriteria.legality_disccussion.strip() if multicriteria and multicriteria.legality_disccussion else None
        
        photos_qs = Field_assessment_multicriteria_photos.objects.filter(
            field_assessment=fa, multicriteria_type='legality'
        )
        photos = [{"photo_id": p.field_assessment_multicriteria_photo_id, "url": f"/media/{p.img}", "type": p.multicriteria_type} 
                 for p in photos_qs if p.img]

        results.append({
            "field_assessment_id": fa.field_assessment_id,
            "created_at": fa.created_at.isoformat() if fa.created_at else None,
            "legality_value": fa.legality,
            "legality_label": fa.get_legality_display(),
            "multicriteria_status": fa.legality,
            "discussion": discussion,
            "photos": photos,
            "photos_count": len(photos),
            "user": user_info
        })

    return JsonResponse({
        "reforestation_area_id": reforestation_area_id,
        "site_id": site_id,
        "criteria": "Legality",
        "count": len(results),
        "results": results
    }, status=200)