import json
import logging
import math
from django.db import IntegrityError, transaction
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import get_object_or_404
from django.utils import timezone

# ✅ KEPT: get_cloudinary_url and delete_cloudinary_resource are still needed for Site Images and Field Assessments
from accounts.helper import get_user_from_token, get_cloudinary_url, delete_cloudinary_resource

from .models import (
    Sites, Site_data, Site_species_recommendation, Site_images,
    Potential_sites, SiteMetaDataVerification, PermitDocument, SiteVerifiedAnimal
)
from reforestation_areas.models import Reforestation_areas
from tree_species.models import Tree_species
from animals.models import Animal
from Field_assessment.models import Field_assessment
logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────
# ✅ NEW: Sanitization Helper for Meta Data
# ─────────────────────────────────────────────
def _sanitize_legal_documents(legal_docs):
    """Removes any 'photo_url' or 'photo' keys from legal documents data."""
    if not isinstance(legal_docs, dict):
        return legal_docs
    
    sanitized = {}
    for key, value in legal_docs.items():
        if key in ('land_title', 'tax_declaration', 'land_classification') and isinstance(value, dict):
            # Keep all keys except photo-related ones
            sanitized[key] = {k: v for k, v in value.items() if k not in ('photo_url', 'photo')}
        elif key == 'other_documents' and isinstance(value, list):
            sanitized[key] = [
                {k: v for k, v in doc.items() if k not in ('photo_url', 'photo')} if isinstance(doc, dict) else doc
                for doc in value
            ]
        else:
            sanitized[key] = value
            
    return sanitized


def _sanitize_field_assessment_data(data):
    """
    Recursively removes 'photo_url' or 'photo' from legal_documents 
    in field assessment data to ensure frontend only receives text notes.
    """
    if not isinstance(data, dict):
        return data
    
    sanitized = data.copy()
    if 'meta_data' in sanitized and isinstance(sanitized['meta_data'], dict):
        meta_data = sanitized['meta_data'].copy()
        if 'legal_documents' in meta_data:
            meta_data['legal_documents'] = _sanitize_legal_documents(meta_data['legal_documents'])
        sanitized['meta_data'] = meta_data
        
    return sanitized


# ─────────────────────────────────────────────
# ⚠️  IMPORTANT: Endpoints marked with [KEEP] are used by other modules
# ─────────────────────────────────────────────

@csrf_exempt
def create_site(request):
    """
    ✅ UPDATED: Creates site AND initializes SiteMetaDataVerification record.
    Verification is now at the SITE level, not the AREA level.
    """
    if request.method != "POST": 
        return JsonResponse({"error": "POST only"}, status=405)
    
    try:
        body = json.loads(request.body)
        name = body.get('name', '').strip()
        reforestation_area_id = body.get('reforestation_area_id')
        potential_site_ids = body.get('potential_site_ids', [])
        
        if not name or not reforestation_area_id:
            return JsonResponse({"error": "name and reforestation_area_id are required"}, status=400)

        reforestation_area = get_object_or_404(Reforestation_areas, reforestation_area_id=reforestation_area_id)

        polygon_coordinates = body.get('polygon_coordinates')
        center_coordinate = body.get('center_coordinate')
        
        if not center_coordinate and polygon_coordinates and len(polygon_coordinates) >= 3:
            sum_lat = sum(coord[0] for coord in polygon_coordinates)
            sum_lng = sum(coord[1] for coord in polygon_coordinates)
            center_coordinate = [sum_lat / len(polygon_coordinates), sum_lng / len(polygon_coordinates)]
            logger.info(f"Auto-calculated center coordinate: {center_coordinate}")

        with transaction.atomic():
            site = Sites.objects.create(
                reforestation_area=reforestation_area,
                name=name,
                status='pending',
                is_active=True,
                polygon_coordinates=polygon_coordinates,
                center_coordinate=center_coordinate,
                ndvi_value=body.get('ndvi_value'),
                total_area_hectares=body.get('total_area_hectares', 0.0),
            )
            
            if site.polygon_coordinates:
                site.total_area_hectares = site.calculate_area_from_polygon()
                if not site.center_coordinate:
                    center_coordinate = site.calculate_centroid()
                site.save()

            if potential_site_ids:
                Potential_sites.objects.filter(
                    potential_sites_id__in=potential_site_ids
                ).update(site=site)

            Site_data.objects.create(
                site=site, 
                version=1, 
                is_current=True, 
                site_data={}, 
                field_assessment_snapshot={}
            )

            SiteMetaDataVerification.objects.create(
                site=site,
                status='pending',
                verified_security_concerns=[],
                verified_accessibility={},
                verified_by=None,
                verified_at=None
            )

        return JsonResponse({
            "message": "Site created successfully", 
            "site_id": site.site_id,
            "status": site.status,
            "center_coordinate": site.center_coordinate
        }, status=201)
        
    except IntegrityError:
        return JsonResponse({"error": "Site name already exists in this area."}, status=409)
    except Exception as e:
        logger.error(f"Create site error: {e}", exc_info=True)
        return JsonResponse({"error": str(e)}, status=500)
    

# ─────────────────────────────────────────────
# [KEEP] GET SITES LIST
# ─────────────────────────────────────────────
@csrf_exempt
def get_sites(request, reforestation_area_id):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    search = request.GET.get("search", "").strip()
    entries = max(1, int(request.GET.get("entries", 50))) # Increased default for better UX
    page = max(1, int(request.GET.get("page", 1)))
    status_filter = request.GET.get("status", "accepted").strip().lower() # Default to accepted
    pinned_filter = request.GET.get("pinned_only", "").strip().lower()
    verification_filter = request.GET.get("verification_status", "verified").strip().lower() # Default to verified
    
    land_classification_filter = request.GET.get("land_classification_id", "").strip()
    all_filter = request.GET.get("all", "").strip().lower() # ✅ NEW: Check for 'all' parameter

    offset = (page - 1) * entries

    # ✅ UPDATED: Conditionally filter by area_id or fetch all active sites
    if all_filter == "true":
        sites = Sites.objects.filter(
            is_active=True
        ).select_related(
            'meta_verification', 'meta_verification__verified_land_classification'
        ).order_by("-is_pinned", "-created_at")
    else:
        sites = Sites.objects.filter(
            reforestation_area_id=reforestation_area_id,
            is_active=True
        ).select_related(
            'meta_verification', 'meta_verification__verified_land_classification'
        ).order_by("-is_pinned", "-created_at")

    if search:
        sites = sites.filter(name__icontains=search)
    if status_filter != "all":
        sites = sites.filter(status=status_filter)
    if pinned_filter == "true":
        sites = sites.filter(is_pinned=True)
    if verification_filter != "all":
        sites = sites.filter(meta_verification__status=verification_filter)
    
    if land_classification_filter:
        try:
            lc_id = int(land_classification_filter)
            sites = sites.filter(meta_verification__verified_land_classification_id=lc_id)
        except (ValueError, TypeError):
            pass

    total = sites.count()
    total_page = max(1, math.ceil(total / entries))
    sites_list = sites[offset: offset + entries]

    data = []
    for s in sites_list:
        current_sd = s.site_data_versions.filter(is_current=True).first()
        
        validation = {
            "has_safety_note": False,
            "has_survivability_note": False,
            "final_decision": None,
            "is_ready_to_finalize": False
        }
        
        if current_sd and current_sd.site_data:
            validation["has_safety_note"] = bool(
                current_sd.site_data.get('safety', {}).get('decision_note', '').strip()
            )
            validation["has_survivability_note"] = bool(
                current_sd.site_data.get('survivability', {}).get('decision_note', '').strip()
            )
            validation["final_decision"] = current_sd.site_data.get('final_decision')
            validation["is_ready_to_finalize"] = bool(validation["final_decision"])

        meta_verification = getattr(s, 'meta_verification', None)
        verification_info = {
            "status": "pending",
            "land_classification": None,
            "security_concerns_count": 0,
            "has_accessibility": False,
            "accessibility_type": None,
            "verified_animals_count": 0,
        }
        
        if meta_verification:
            verification_info["status"] = meta_verification.status
            
            if meta_verification.verified_land_classification:
                verification_info["land_classification"] = {
                    "id": meta_verification.verified_land_classification.land_classification_id,
                    "name": meta_verification.verified_land_classification.name
                }
            
            if meta_verification.verified_security_concerns:
                verification_info["security_concerns_count"] = len(meta_verification.verified_security_concerns)
            
            if meta_verification.verified_accessibility:
                verification_info["has_accessibility"] = True
                if isinstance(meta_verification.verified_accessibility, dict):
                    verification_info["accessibility_type"] = meta_verification.verified_accessibility.get('type', 'Unknown')
            
            verification_info["verified_animals_count"] = meta_verification.animal_relations.count()

        permit_count = s.permit_documents.count()

        data.append({
            "site_id": s.site_id,
            "reforestation_area_id": s.reforestation_area_id, # ✅ ADDED: Required for frontend routing
            "name": s.name,
            "status": s.status,
            "is_pinned": s.is_pinned,
            "validation": validation,
            "verification": verification_info,
            "permit_count": permit_count,
            "metrics": {
                "ndvi": s.ndvi_value,
                "area_hectares": s.total_area_hectares,
                "seedlings": s.total_seedlings_planted,
            },
            "created_at": s.created_at.strftime("%Y-%m-%d %H:%M:%S")
        })

    return JsonResponse({
        "data": data,
        "total_page": total_page,
        "page": page,
        "entries": entries,
        "total": total
    }, status=200)

# ─────────────────────────────────────────────
# [KEEP] GET SINGLE SITE
# ─────────────────────────────────────────────
@csrf_exempt
def get_site(request, site_id):
    if request.method != "GET": 
        return JsonResponse({"error": "GET only"}, status=405)
    
    site = get_object_or_404(Sites, site_id=site_id, is_active=True)
    
    verification = getattr(site, 'meta_verification', None)
    verification_data = None
    
    if verification:
        verified_animals = [
            {
                "animal_id": rel.animal.animal_id,
                "name": rel.animal.name,
                "scientific_name": rel.animal.scientific_name,
                "admin_notes": rel.admin_notes,
            }
            for rel in verification.animal_relations.select_related('animal').all()
        ]
        
        land_classification_name = None
        if verification.verified_land_classification:
            land_classification_name = verification.verified_land_classification.name
        
        verification_data = {
            'status': verification.status,
            'verified_security_concerns': verification.verified_security_concerns,
            'verified_accessibility': verification.verified_accessibility,
            'verified_land_classification_id': verification.verified_land_classification_id,
            'verified_land_classification_name': land_classification_name,
            'decision_note': verification.decision_note,
            'verified_by': verification.verified_by.email if verification.verified_by else None,
            'verified_at': verification.verified_at.isoformat() if verification.verified_at else None,
            'verified_animals': verified_animals,
        }

    images_data = []
    for img in site.site_images.all():
        images_data.append({
            'site_image_id': img.site_image_id,
            'layer_tag': img.layer_tag,
            'img_url': get_cloudinary_url(str(img.img)) if img.img else None,
            'caption': img.caption,
            'created_at': img.created_at.isoformat() if img.created_at else None,
        })

    current_site_data = site.site_data_versions.filter(is_current=True).first()
    validation_data = {}
    if current_site_data:
        validation_data = {
            'version': current_site_data.version,
            'site_data': _sanitize_field_assessment_data(current_site_data.site_data),
            'field_assessment_snapshot': _sanitize_field_assessment_data(current_site_data.field_assessment_snapshot),
            'validated_by': current_site_data.validated_by,
            'validated_at': current_site_data.validated_at.isoformat() if current_site_data.validated_at else None,
        }

    # ✅ SAFE: Use hasattr to check if to_dict exists, fallback to manual dict
    potential_sites_data = []
    for p in site.potential_sites.all():
        if hasattr(p, 'to_dict'):
            potential_sites_data.append(p.to_dict())
        else:
            # Fallback for safety - won't break other modules
            potential_sites_data.append({
                "potential_sites_id": p.potential_sites_id,
                "site_id": p.site.site_id if p.site else None,
                "polygon_coordinates": p.polygon_coordinates,
                "area_hectares": p.area_hectares,
                "avg_ndvi": p.avg_ndvi,
                "suitability_score": p.suitability_score,
                "ndvi_threshold": p.ndvi_threshold,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            })

    return JsonResponse({
        "site_id": site.site_id,
        "name": site.name,
        "description": site.description,
        "status": site.status,
        "polygon_coordinates": site.polygon_coordinates,
        "center_coordinate": site.center_coordinate,
        "ndvi_value": site.ndvi_value,
        "area_hectares": site.total_area_hectares,
        "potential_sites": potential_sites_data,  # ✅ Now safe
        "meta_verification": verification_data,
        "permits": [{
            "permit_id": p.permit_id,
            "document_type": p.document_type,
            "notes": p.notes,
            "verification_notes": p.verification_notes,
            "uploaded_at": p.uploaded_at.isoformat() if p.uploaded_at else None,
            "uploaded_by": p.uploaded_by.email if p.uploaded_by else None,
        } for p in site.permit_documents.all()],
        "site_images": images_data,
        "validation_data": validation_data, 
        "created_at": site.created_at.isoformat() if site.created_at else None,
    })

# ─────────────────────────────────────────────
# [KEEP] TOGGLE PIN
# ─────────────────────────────────────────────
@csrf_exempt
def toggle_pin(request, site_id):
    if request.method not in ["POST", "PUT"]:
        return JsonResponse({"error": "Only POST/PUT allowed"}, status=405)
    
    try:
        site = get_object_or_404(Sites, site_id=site_id, is_active=True)
        site.is_pinned = not site.is_pinned
        site.save()
        return JsonResponse({
            "message": f"Site {'pinned' if site.is_pinned else 'unpinned'} successfully.",
            "is_pinned": site.is_pinned
        }, status=200)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)


# ─────────────────────────────────────────────
# [KEEP] UPDATE SPECIES
# ─────────────────────────────────────────────
@csrf_exempt
def update_species_recommendations(request, site_id):
    if request.method != "POST":
        return JsonResponse({"error": "Only POST allowed"}, status=405)
    
    try:
        body = json.loads(request.body)
        site = get_object_or_404(Sites, site_id=site_id, is_active=True)
        species_list = body.get("species", [])
        
        if not isinstance(species_list, list):
            return JsonResponse({"error": "'species' must be an array"}, status=400)
        
        with transaction.atomic():
            site.species_recommendations.all().delete()
            
            for i, sp in enumerate(species_list):
                tree_species_id = sp.get("tree_species_id")
                if not tree_species_id:
                    continue
                tree_species = get_object_or_404(Tree_species, tree_specie_id=tree_species_id)
                Site_species_recommendation.objects.create(
                    site=site,
                    tree_species=tree_species,
                    priority_rank=sp.get("priority_rank", i + 1),
                    notes=sp.get("notes", "")
                )
        
        return JsonResponse({"message": "Species recommendations updated."}, status=200)
        
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON format"}, status=400)
    except Exception as e:
        logger.error(f"update_species_recommendations error: {e}", exc_info=True)
        return JsonResponse({"error": "Internal server error"}, status=500)


# ─────────────────────────────────────────────
# [KEEP] UPDATE POLYGON
# ─────────────────────────────────────────────
@csrf_exempt
def save_site_polygon(request, site_id):
    if request.method not in ["PUT", "PATCH"]:
        return JsonResponse({"error": "PUT/PATCH only"}, status=405)
    
    try:
        body = json.loads(request.body)
        site = get_object_or_404(Sites, site_id=site_id, is_active=True)
        
        if 'polygon_coordinates' in body:
            site.polygon_coordinates = body['polygon_coordinates']
            site.total_area_hectares = site.calculate_area_from_polygon()
            site.center_coordinate = site.calculate_centroid()
        if 'ndvi_value' in body:
            site.ndvi_value = body['ndvi_value']
        if 'marker_coordinate' in body:
            site.marker_coordinate = body['marker_coordinate']
            
        site.save()
        return JsonResponse({
            "message": "Polygon & metrics updated", 
            "area_hectares": site.total_area_hectares, 
            "center": site.center_coordinate
        })
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)


# ─────────────────────────────────────────────
# [KEEP] GET SITES LIST (Alternative)
# ─────────────────────────────────────────────
@csrf_exempt
def get_sites_list(request, reforestation_area_id):
    if request.method != "GET":
        return JsonResponse({"error": "GET only"}, status=405)

    search = request.GET.get("search", "").strip()
    status_filter = request.GET.get("status", "all").strip().lower()
    verification_filter = request.GET.get("verification_status", "all").strip().lower()

    sites = Sites.objects.filter(
        reforestation_area_id=reforestation_area_id, 
        is_active=True
    ).select_related('meta_verification').order_by("-is_pinned", "-created_at")
    
    if search: 
        sites = sites.filter(name__icontains=search)
    if status_filter != "all": 
        sites = sites.filter(status=status_filter)
    if verification_filter != "all":
        sites = sites.filter(meta_verification__status=verification_filter)

    data = []
    for s in sites:
        latest_sd = s.site_data_versions.order_by('-version').first()
        
        validation = {
            "has_safety_note": False,
            "has_survivability_note": False,
            "final_decision": None,
        }
        
        if latest_sd and latest_sd.site_data:
            validation["has_safety_note"] = bool(
                latest_sd.site_data.get('safety', {}).get('decision_note', '').strip()
            )
            validation["has_survivability_note"] = bool(
                latest_sd.site_data.get('survivability', {}).get('decision_note', '').strip()
            )
            validation["final_decision"] = latest_sd.site_data.get('final_decision')

        meta_verification = getattr(s, 'meta_verification', None)
        verification_status = meta_verification.status if meta_verification else 'pending'

        data.append({
            "site_id": s.site_id,
            "name": s.name,
            "status": s.status,
            "is_pinned": s.is_pinned,
            "area_hectares": s.total_area_hectares,
            "ndvi": s.ndvi_value,
            "validation": validation,
            "verification_status": verification_status,
            "created_at": s.created_at.strftime("%Y-%m-%d %H:%M")
        })

    return JsonResponse({"data": data, "count": len(data)})


# ─────────────────────────────────────────────
# [REPLACE] Save Validation Draft
# ─────────────────────────────────────────────
@csrf_exempt
def save_validation_draft(request, site_id):
    if request.method not in ["PUT", "PATCH", "POST"]:
        return JsonResponse({"error": "PUT/PATCH/POST only"}, status=405)
    
    try:
        body = json.loads(request.body)
        site = get_object_or_404(Sites, site_id=site_id, is_active=True)
        
        sd, created = Site_data.objects.get_or_create(
            site=site,
            is_current=True,
            defaults={'version': 1, 'site_data': {}}
        )
        
        if not sd.site_data:
            sd.site_data = {}
        
        if 'safety' in body and 'decision_note' in body['safety']:
            if 'safety' not in sd.site_data:
                sd.site_data['safety'] = {}
            sd.site_data['safety']['decision_note'] = body['safety']['decision_note']
        
        if 'survivability' in body and 'decision_note' in body['survivability']:
            if 'survivability' not in sd.site_data:
                sd.site_data['survivability'] = {}
            sd.site_data['survivability']['decision_note'] = body['survivability']['decision_note']
        
        if 'final_decision_note' in body:
            sd.site_data['final_decision_note'] = body['final_decision_note']
        
        sd.save()
        
        return JsonResponse({
            "message": "Validation draft saved",
            "data": {
                "safety_note": sd.site_data.get('safety', {}).get('decision_note'),
                "survivability_note": sd.site_data.get('survivability', {}).get('decision_note'),
                "final_note": sd.site_data.get('final_decision_note')
            }
        })
        
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON format"}, status=400)
    except Exception as e:
        logger.error(f"save_validation_draft error: {e}", exc_info=True)
        return JsonResponse({"error": str(e)}, status=500)


# ─────────────────────────────────────────────
# [REPLACE] Finalize Site
# ─────────────────────────────────────────────
@csrf_exempt
def finalize_site(request, site_id):
    if request.method != "POST":
        return JsonResponse({"error": "POST only"}, status=405)

    try:
        body = json.loads(request.body)
        final_decision = body.get("final_decision", "").upper()
        
        if final_decision not in ["ACCEPT", "REJECT"]:
            return JsonResponse({
                "error": "final_decision must be 'ACCEPT' or 'REJECT'"
            }, status=400)
        
        final_decision_note = body.get("final_decision_note", "").strip()
        
        site = get_object_or_404(Sites, site_id=site_id, is_active=True)
        current_sd = site.site_data_versions.filter(is_current=True).first()
        
        if not current_sd:
            return JsonResponse({"error": "No active draft found to finalize"}, status=404)
        
        user = get_user_from_token(request)
        
        with transaction.atomic():
            current_sd.site_data['final_decision'] = final_decision
            if final_decision_note:
                current_sd.site_data['final_decision_note'] = final_decision_note
            current_sd.site_data['validated_at'] = timezone.now().isoformat()
            current_sd.site_data['validated_by'] = user.email if user else "system"
            current_sd.save()
            
            current_sd.is_current = False
            current_sd.save()
            
            Site_data.objects.create(
                site=site,
                version=current_sd.version + 1,
                is_current=True,
                site_data={},
                field_assessment_snapshot={}
            )
            
            site.status = "accepted" if final_decision == "ACCEPT" else "rejected"
            site.save()
        
        logger.info(
            f"Site {site_id} finalized: decision={final_decision}, "
            f"archived_version={current_sd.version}, new_version={current_sd.version + 1}"
        )
        
        return JsonResponse({
            "message": f"Site {final_decision}ED successfully",
            "status": site.status,
            "site_id": site.site_id,
            "new_version": current_sd.version + 1
        }, status=200)
        
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON format"}, status=400)
    except Exception as e:
        logger.error(f"finalize_site error: {e}", exc_info=True)
        return JsonResponse({"error": f"Internal server error: {str(e)[:200]}"}, status=500)


# ─────────────────────────────────────────────
# [KEEP] DELETE SITE (Hard Delete)
# ─────────────────────────────────────────────
@csrf_exempt
def delete_site(request, site_id):
    if request.method != "DELETE":
        return JsonResponse({"error": "DELETE only"}, status=405)
    
    try:
        site = get_object_or_404(Sites, site_id=site_id, is_active=True)
        
        # ✅ Delete all associated images from Cloudinary
        deleted_images = 0
        for img in site.site_images.all():
            if img.img:
                print(f"🖼️ Deleting site image {img.site_image_id} from Cloudinary...")
                if delete_cloudinary_resource(img.img, resource_type='image'):
                    deleted_images += 1
        
        # ✅ REMOVED: Permit file deletion loop (no longer storing files)
        
        # ✅ Hard delete the site (CASCADE will delete all related records)
        site.delete()
        
        return JsonResponse({
            "message": "Site permanently deleted",
            "images_deleted": deleted_images
        })
        
    except Exception as e:
        logger.error(f"Delete site error: {e}", exc_info=True)
        return JsonResponse({"error": str(e)}, status=500)


# ─────────────────────────────────────────────
# ✅ UPDATED: Helper function to serialize assessment
# ─────────────────────────────────────────────

def _serialize_assessment(assessment, assessment_type):
    """
    Helper to serialize a Field_assessment with full details.
    ✅ UPDATED: 
    1. Sanitizes field_assessment_data to strip out any legacy 'photo_url' or 'photo' keys.
    2. Explicitly excludes obsolete legal document image layers from the image query.
    """
    inspector = assessment.assigned_onsite_inspector
    user = inspector.user if inspector else None
    
    inspector_name = 'Unknown'
    if user:
        first = getattr(user, 'first_name', '') or ''
        last = getattr(user, 'last_name', '') or ''
        inspector_name = f"{first} {last}".strip()
        if not inspector_name:
            inspector_name = getattr(user, 'email', 'Unknown') or getattr(user, 'username', 'Unknown')

    inspector_profile_img = None
    if user:
        profile = getattr(user, 'profile', None)
        if profile and profile.profile_img:
            try:
                inspector_profile_img = get_cloudinary_url(str(profile.profile_img))
            except:
                pass
    
    images_data = []
    
    # ✅ UPDATED: Explicitly exclude obsolete legal document image layers from the database query
    obsolete_layers = ['meta_land_title', 'meta_tax_decl']
    for img in assessment.images.exclude(layer__in=obsolete_layers):
        images_data.append({
            'image_id': img.field_assessment_images_id,
            'url': get_cloudinary_url(str(img.img)) if img.img else None,
            'layer': img.layer,
            'latitude': float(img.latitude) if img.latitude else None,
            'longitude': float(img.longitude) if img.longitude else None,
            'description': img.description,
            'created_at': img.created_at.isoformat() if img.created_at else None,
        })
    
    land_classification_data = None
    if assessment.land_classification:
        land_classification_data = {
            'id': assessment.land_classification.land_classification_id,
            'name': assessment.land_classification.name,
        }
    
    animals_present_data = []
    try:
        for rel in assessment.animal_relations.select_related('animal').all():
            animals_present_data.append({
                'animal_id': rel.animal.animal_id,
                'name': rel.animal.name,
                'scientific_name': rel.animal.scientific_name or '',
            })
    except Exception as e:
        logger.warning(f"Could not fetch animals for assessment {assessment.field_assessment_id}: {e}")
    
    return {
        'id': assessment.field_assessment_id,
        'type': assessment_type,
        'inspector_id': user.id if user else None,
        'inspector_name': inspector_name,
        'inspector_email': user.email if user else 'Unknown',
        'inspector_profile_img': inspector_profile_img,
        'assessment_date': assessment.assessment_date.isoformat() if assessment.assessment_date else None,
        'location': assessment.location,
        # ✅ SANITIZED: Removes any photo data from legal documents in the payload
        'field_assessment_data': _sanitize_field_assessment_data(assessment.field_assessment_data),
        'is_submitted': assessment.is_submitted,
        'image_count': len(images_data),
        'images': images_data,
        'created_at': assessment.created_at.isoformat() if assessment.created_at else None,
        'submitted_at': assessment.updated_at.isoformat() if assessment.updated_at else None,
        'land_classification': land_classification_data,
        'animals_present': animals_present_data,
    }


@csrf_exempt
def get_site_verification(request, site_id):
    """
    GET: Return the saved verification record for a SPECIFIC SITE.
    """
    if request.method != 'GET': 
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    
    site = get_object_or_404(Sites, site_id=site_id, is_active=True)
    verification, _ = SiteMetaDataVerification.objects.get_or_create(
        site=site, defaults={'status': 'pending'}
    )
    
    assessments_data = []
    
    if Field_assessment is not None:
        try:
            specific_assessments = Field_assessment.objects.filter(
                site=site, 
                is_submitted=True,
                field_assessment_data__has_key='meta_data'
            ).select_related(
                'assigned_onsite_inspector', 
                'assigned_onsite_inspector__user',
                'land_classification'
            ).prefetch_related('images', 'animal_relations__animal').order_by('-assessment_date')
            
            for a in specific_assessments:
                assessments_data.append(_serialize_assessment(a, 'specific'))
            
            general_assessments = Field_assessment.objects.filter(
                site__isnull=True,  
                assigned_onsite_inspector__reforestation_area=site.reforestation_area,
                is_submitted=True,
                field_assessment_data__has_key='meta_data'
            ).select_related(
                'assigned_onsite_inspector', 
                'assigned_onsite_inspector__user',
                'assigned_onsite_inspector__reforestation_area',
                'land_classification'
            ).prefetch_related('images', 'animal_relations__animal').order_by('-assessment_date')
            
            for a in general_assessments:
                assessments_data.append(_serialize_assessment(a, 'general'))
                
        except Exception as e:
            logger.warning(f"Could not fetch field assessments: {e}")

    sec_concerns = verification.verified_security_concerns
    if isinstance(sec_concerns, set):
        sec_concerns = list(sec_concerns)
    elif not sec_concerns:
        sec_concerns = []

    acc = verification.verified_accessibility
    if isinstance(acc, set):
        acc = list(acc)
    elif not acc:
        acc = {}

    verified_animals = []
    try:
        for rel in verification.animal_relations.select_related('animal').all():
            verified_animals.append({
                'animal_id': rel.animal.animal_id,
                'name': rel.animal.name,
                'scientific_name': rel.animal.scientific_name or '',
                'admin_notes': rel.admin_notes or '',
            })
    except Exception as e:
        logger.warning(f"Could not fetch verified animals: {e}")

    return JsonResponse({
        'verification': {
            'id': verification.id, 
            'status': verification.status,
            'verified_security_concerns': sec_concerns,
            'verified_accessibility': acc,
            'verified_land_classification_id': verification.verified_land_classification_id,
            'verified_land_classification_name': verification.verified_land_classification.name if verification.verified_land_classification else None,
            'decision_note': verification.decision_note or '',
            'referenced_assessment_ids': verification.referenced_assessment_ids or [],
            'verified_by': verification.verified_by.email if verification.verified_by else None,
            'verified_at': verification.verified_at.isoformat() if verification.verified_at else None,
            'verified_animals': verified_animals,
        },
        'site_info': {
            'site_id': site.site_id,
            'name': site.name,
            'status': site.status,
            'reforestation_area_id': site.reforestation_area_id,
            'reforestation_area_name': site.reforestation_area.name,
        },
        'field_assessments': assessments_data,
        'assessment_counts': {
            'total': len(assessments_data),
            'specific': len([a for a in assessments_data if a['type'] == 'specific']),
            'general': len([a for a in assessments_data if a['type'] == 'general']),
        }
    }, status=200)


@csrf_exempt
def update_site_verification(request, site_id):
    """
    PUT/POST: Save Draft, Accept, or Reject for a SPECIFIC SITE.
    """
    if request.method not in ['PUT', 'POST']: 
        return JsonResponse({'error': 'Only PUT/POST allowed'}, status=405)

    site = get_object_or_404(Sites, site_id=site_id, is_active=True)
    user = get_user_from_token(request)

    try:
        data = json.loads(request.body)
        verification, created = SiteMetaDataVerification.objects.get_or_create(
            site=site, defaults={'status': 'draft', 'verified_by': user}
        )

        if 'verified_security_concerns' in data: 
            verification.verified_security_concerns = data['verified_security_concerns']
        if 'verified_accessibility' in data: 
            verification.verified_accessibility = data['verified_accessibility']
        if 'verified_land_classification_id' in data: 
            verification.verified_land_classification_id = data['verified_land_classification_id']
        if 'decision_note' in data: 
            verification.decision_note = data['decision_note']
        if 'status' in data: 
            verification.status = data['status']
        if 'referenced_assessment_ids' in data:
            verification.referenced_assessment_ids = data['referenced_assessment_ids']

        if verification.status in ['verified', 'rejected']:
            verification.verified_by = user
            verification.verified_at = timezone.now()

        verification.save()
        
        if 'verified_animals' in data:
            verified_animals = data['verified_animals']
            
            if not isinstance(verified_animals, list):
                return JsonResponse({
                    'error': 'verified_animals must be an array'
                }, status=400)
            
            with transaction.atomic():
                verification.animal_relations.all().delete()
                
                for animal_data in verified_animals:
                    animal_id = animal_data.get('animal_id')
                    notes = animal_data.get('notes', '')
                    
                    if not animal_id:
                        continue
                    
                    try:
                        animal = Animal.objects.get(animal_id=animal_id)
                        SiteVerifiedAnimal.objects.create(
                            verification=verification,
                            animal=animal,
                            admin_notes=notes or ''
                        )
                    except Animal.DoesNotExist:
                        logger.warning(f"Animal {animal_id} not found, skipping.")
                        continue
        
        return JsonResponse({
            'message': f'Verification {verification.status}', 
            'status': verification.status,
            'verification_id': verification.id
        }, status=200)
    except Exception as e:
        logger.error(f"Update site verification error: {e}", exc_info=True)
        return JsonResponse({'error': str(e)}, status=500)


# ─────────────────────────────────────────────
# SITE PERMIT DOCUMENTS
# ─────────────────────────────────────────────
@csrf_exempt
def list_site_permits(request, site_id):
    if request.method != 'GET': 
        return JsonResponse({'error': 'Only GET allowed'}, status=405)
    site = get_object_or_404(Sites, site_id=site_id, is_active=True)
    permits = site.permit_documents.select_related('uploaded_by').order_by('-uploaded_at')

    # ✅ UPDATED: Removed file_url and permit_number, added notes
    data = [{
        'permit_id': p.permit_id, 
        'document_type': p.document_type,
        'notes': p.notes,
        'verification_notes': p.verification_notes,
        'uploaded_at': p.uploaded_at.isoformat(),
        'uploaded_by': p.uploaded_by.email if p.uploaded_by else None,
    } for p in permits]
    return JsonResponse({'data': data}, status=200)


@csrf_exempt
def upload_site_permit(request, site_id):
    if request.method != 'POST': 
        return JsonResponse({'error': 'Only POST allowed'}, status=405)
    site = get_object_or_404(Sites, site_id=site_id, is_active=True)
    user = get_user_from_token(request)
    
    # ✅ UPDATED: Removed permit_file and permit_number, added notes
    document_type = request.POST.get('document_type')
    notes = request.POST.get('notes', '').strip()
    verification_notes = request.POST.get('verification_notes', '').strip()
    
    if not document_type:
        return JsonResponse({'error': 'document_type is required'}, status=400)

    valid_types = [t[0] for t in PermitDocument.DOCUMENT_TYPES]
    if document_type not in valid_types:
        return JsonResponse({'error': f'Invalid document type. Allowed: {valid_types}'}, status=400)

    try:
        permit = PermitDocument.objects.create(
            site=site, 
            document_type=document_type,
            notes=notes or None,
            verification_notes=verification_notes or None,
            uploaded_by=user
        )
        return JsonResponse({
            'message': 'Permit record created', 
            'permit_id': permit.permit_id,
        }, status=201)
    except Exception as e:
        logger.error(f"Upload site permit error: {e}", exc_info=True)
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
def delete_site_permit(request, permit_id):
    if request.method != 'DELETE': 
        return JsonResponse({'error': 'Only DELETE allowed'}, status=405)
    
    try:
        user = get_user_from_token(request)
        permit = get_object_or_404(PermitDocument, permit_id=permit_id)
        
        # ✅ UPDATED: Removed Cloudinary deletion logic (no files to delete)
        permit.delete()
        return JsonResponse({'message': 'Permit record deleted'}, status=200)
    except Exception as e:
        logger.error(f"Delete site permit error: {e}", exc_info=True)
        return JsonResponse({'error': str(e)}, status=500)


# ─────────────────────────────────────────────
# GET ALL SITES (For Map Initialization)
# ─────────────────────────────────────────────
@csrf_exempt
def get_all_sites(request):
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    try:
        sites = Sites.objects.filter(is_active=True).order_by("-created_at")
        
        data = []
        for s in sites:
            data.append({
                "site_id": s.site_id,
                "name": s.name,
                "status": s.status,
                "reforestation_area_id": s.reforestation_area_id,
                "center_coordinate": s.center_coordinate,
                "polygon_coordinates": s.polygon_coordinates,
                "total_area_hectares": s.total_area_hectares,
                "ndvi_value": s.ndvi_value,
                "created_at": s.created_at.strftime("%Y-%m-%d %H:%M:%S")
            })
            
        return JsonResponse({"data": data}, status=200)
    except Exception as e:
        logger.error(f"get_all_sites error: {e}", exc_info=True)
        return JsonResponse({"error": str(e)}, status=500)


# ─────────────────────────────────────────────
# UPDATE SITE COORDINATES
# ─────────────────────────────────────────────
@csrf_exempt
def update_site_coordinates(request, site_id):
    if request.method not in ["PUT", "PATCH"]:
        return JsonResponse({"error": "PUT/PATCH only"}, status=405)
    
    try:
        body = json.loads(request.body)
        site = get_object_or_404(Sites, site_id=site_id, is_active=True)
        
        polygon_updated = False
        center_updated = False
        
        if 'polygon_coordinates' in body:
            new_polygon = body['polygon_coordinates']
            
            if not isinstance(new_polygon, list):
                return JsonResponse({"error": "polygon_coordinates must be an array"}, status=400)
            
            if len(new_polygon) < 3:
                return JsonResponse({"error": "polygon_coordinates must have at least 3 points"}, status=400)
            
            for i, coord in enumerate(new_polygon):
                if not isinstance(coord, (list, tuple)) or len(coord) != 2:
                    return JsonResponse({
                        "error": f"Invalid coordinate at index {i}. Expected [lat, lng]"
                    }, status=400)
                
                try:
                    lat, lng = float(coord[0]), float(coord[1])
                    if not (4 <= lat <= 21):
                        return JsonResponse({
                            "error": f"Invalid latitude at index {i}: {lat}. Must be between 4 and 21"
                        }, status=400)
                    if not (117 <= lng <= 127):
                        return JsonResponse({
                            "error": f"Invalid longitude at index {i}: {lng}. Must be between 117 and 127"
                        }, status=400)
                except (ValueError, TypeError):
                    return JsonResponse({
                        "error": f"Invalid coordinate values at index {i}"
                    }, status=400)
            
            site.polygon_coordinates = new_polygon
            site.total_area_hectares = site.calculate_area_from_polygon()
            polygon_updated = True
            
            logger.info(f"Site {site_id} polygon updated: {len(new_polygon)} vertices, area: {site.total_area_hectares} ha")
        
        if 'center_coordinate' in body:
            new_center = body['center_coordinate']
            
            if not isinstance(new_center, (list, tuple)) or len(new_center) != 2:
                return JsonResponse({
                    "error": "center_coordinate must be [lat, lng]"
                }, status=400)
            
            try:
                lat, lng = float(new_center[0]), float(new_center[1])
                if not (4 <= lat <= 21):
                    return JsonResponse({
                        "error": f"Invalid center latitude: {lat}. Must be between 4 and 21"
                    }, status=400)
                if not (117 <= lng <= 127):
                    return JsonResponse({
                        "error": f"Invalid center longitude: {lng}. Must be between 117 and 127"
                    }, status=400)
            except (ValueError, TypeError):
                return JsonResponse({
                    "error": "Invalid center coordinate values"
                }, status=400)
            
            site.center_coordinate = new_center
            center_updated = True
            
            logger.info(f"Site {site_id} center updated: [{lat}, {lng}]")
        
        if polygon_updated and not center_updated:
            site.center_coordinate = site.calculate_centroid()
            center_updated = True
            logger.info(f"Site {site_id} center auto-calculated from polygon: {site.center_coordinate}")
        
        if polygon_updated or center_updated:
            site.save()
            
            return JsonResponse({
                "message": "Site coordinates updated successfully",
                "site_id": site.site_id,
                "polygon_coordinates": site.polygon_coordinates,
                "center_coordinate": site.center_coordinate,
                "total_area_hectares": site.total_area_hectares,
                "polygon_updated": polygon_updated,
                "center_updated": center_updated
            }, status=200)
        else:
            return JsonResponse({
                "error": "No coordinates provided to update"
            }, status=400)
            
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON format"}, status=400)
    except Exception as e:
        logger.error(f"Update site coordinates error: {e}", exc_info=True)
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
def get_available_sites(request, reforestation_area_id):
    """
    Fetches sites available for assignment.
    Excludes sites tied to active/ongoing applications.
    """
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET allowed'}, status=405)

    search = request.GET.get("search", "").strip()
    entries = max(1, int(request.GET.get("entries", 50)))
    page = max(1, int(request.GET.get("page", 1)))
    
    # Defaults to accepted and verified for assignment
    status_filter = request.GET.get("status", "accepted").strip().lower() 
    verification_filter = request.GET.get("verification_status", "verified").strip().lower() 
    
    pinned_filter = request.GET.get("pinned_only", "").strip().lower()
    land_classification_filter = request.GET.get("land_classification_id", "").strip()
    all_filter = request.GET.get("all", "").strip().lower()

    offset = (page - 1) * entries

    # 1. Base Query
    sites = Sites.objects.filter(
        is_active=True
    ).select_related(
        'meta_verification', 'meta_verification__verified_land_classification'
    ).order_by("-is_pinned", "-created_at")

    # 2. Area Filter
    if all_filter != "true":
        sites = sites.filter(reforestation_area_id=reforestation_area_id)

    # 3. Status & Verification Filters
    if status_filter != "all":
        sites = sites.filter(status=status_filter)
    if verification_filter != "all":
        sites = sites.filter(meta_verification__status=verification_filter)
        
    if pinned_filter == "true":
        sites = sites.filter(is_pinned=True)
    
    if land_classification_filter:
        try:
            lc_id = int(land_classification_filter)
            sites = sites.filter(meta_verification__verified_land_classification_id=lc_id)
        except (ValueError, TypeError):
            pass

    # 4. ✅ AVAILABILITY FILTER (Crucial Step)
    # Exclude sites that are currently tied to active, ongoing, or finalized applications.
    active_statuses = [
        'accepted', 'under_monitoring', 'completed', 'failed', 
        'for_evaluation', 'for_head'
    ]
    sites = sites.exclude(applications__status__in=active_statuses)

    # 5. Search Filter
    if search:
        sites = sites.filter(name__icontains=search)

    total = sites.count()
    total_page = max(1, math.ceil(total / entries))
    sites_list = sites[offset: offset + entries]

    data = []
    for s in sites_list:
        # (Keep the exact same serialization logic as get_sites)
        current_sd = s.site_data_versions.filter(is_current=True).first()
        validation = {
            "has_safety_note": False, "has_survivability_note": False,
            "final_decision": None, "is_ready_to_finalize": False
        }
        if current_sd and current_sd.site_data:
            validation["has_safety_note"] = bool(current_sd.site_data.get('safety', {}).get('decision_note', '').strip())
            validation["has_survivability_note"] = bool(current_sd.site_data.get('survivability', {}).get('decision_note', '').strip())
            validation["final_decision"] = current_sd.site_data.get('final_decision')
            validation["is_ready_to_finalize"] = bool(validation["final_decision"])

        meta_verification = getattr(s, 'meta_verification', None)
        verification_info = {
            "status": "pending", "land_classification": None,
            "security_concerns_count": 0, "has_accessibility": False,
            "accessibility_type": None, "verified_animals_count": 0,
        }
        if meta_verification:
            verification_info["status"] = meta_verification.status
            if meta_verification.verified_land_classification:
                verification_info["land_classification"] = {
                    "id": meta_verification.verified_land_classification.land_classification_id,
                    "name": meta_verification.verified_land_classification.name
                }
            if meta_verification.verified_security_concerns:
                verification_info["security_concerns_count"] = len(meta_verification.verified_security_concerns)
            if meta_verification.verified_accessibility:
                verification_info["has_accessibility"] = True
                if isinstance(meta_verification.verified_accessibility, dict):
                    verification_info["accessibility_type"] = meta_verification.verified_accessibility.get('type', 'Unknown')
            verification_info["verified_animals_count"] = meta_verification.animal_relations.count()

        permit_count = s.permit_documents.count()

        data.append({
            "site_id": s.site_id,
            "reforestation_area_id": s.reforestation_area_id,
            "name": s.name,
            "status": s.status,
            "is_pinned": s.is_pinned,
            "validation": validation,
            "verification": verification_info,
            "permit_count": permit_count,
            "metrics": {
                "ndvi": s.ndvi_value,
                "area_hectares": s.total_area_hectares,
                "seedlings": s.total_seedlings_planted,
            },
            "created_at": s.created_at.strftime("%Y-%m-%d %H:%M:%S")
        })

    return JsonResponse({
        "data": data, "total_page": total_page,
        "page": page, "entries": entries, "total": total
    }, status=200)