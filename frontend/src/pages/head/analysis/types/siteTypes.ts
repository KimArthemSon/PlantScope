// ✅ SIMPLIFIED: No more complex per-layer tracking
export interface ValidationStatus {
  has_safety_note: boolean;
  has_survivability_note: boolean;
  final_decision: "ACCEPT" | "REJECT" | null;
  is_ready_to_finalize: boolean;
}

// ✅ REMOVED: ndvi field
export interface SiteMetrics {
  area_hectares: number;
  seedlings: number;
}

export interface Site {
  site_id: number;
  name: string;
  status: "pending" | "under_review" | "accepted" | "rejected" | "completed";
  is_pinned: boolean;
  created_at: string;
  validation: ValidationStatus;
  metrics: SiteMetrics;

  // ✅ ADDED: For direct map rendering without fetching full details
  marker_coordinate?: [number, number] | null;
  polygon_coordinates?: [number, number][];
}

// ✅ SIMPLIFIED: Just decision notes + final decision
export interface ValidationData {
  safety?: {
    decision_note: string;
  };
  survivability?: {
    decision_note: string;
  };
  final_decision?: "ACCEPT" | "REJECT";
  final_decision_note?: string;
  validated_at?: string;
  validated_by?: string;
}

// ✅ Mobile spec data structures
export interface LegalDocument {
  note?: string;
  photo_url?: string | null;
  status?: "uploaded" | "missing";
}

export interface LandClassification {
  type: string; // "Alienable and Disposable" | "Forestland" | etc.
  inspector_notes?: string;
}

export interface SecurityConcerns {
  selected: string[]; // ["Armed Threat / Violence", "Land Conflict", ...]
  note?: string;
}

export interface Accessibility {
  vehicle_access?: string; // "Road" | "Trail" | "None" | "Other"
  notes?: string; // Required if vehicle_access is "Other" or to explain road conditions
}

export interface FieldAssessmentEvidence {
  field_assessment_id: number;
  inspector: { email: string; name: string };
  assessment_date: string | null;
  location: {
    latitude: number;
    longitude: number;
    gps_accuracy_meters?: number;
  } | null;

  // ✅ Mobile spec structure: nested under meta_data
  meta_data?: {
    legal_documents?: {
      land_title?: LegalDocument;
      tax_declaration?: LegalDocument;
      other_documents?: Array<{ note: string; photo_url?: string | null }>;
      land_classification?: LandClassification;
    };
    security_concerns?: SecurityConcerns;
    accessibility?: Accessibility;
  };

  images: Array<{
    url: string | null;
    layer: string; // "meta_land_title" | "meta_tax_decl" | etc.
    description: string;
    latitude: number | null;
    longitude: number | null;
  }>;
}

// ✅ REMOVED: ndvi_value field
export interface SiteDetail {
  site_id: number;
  name: string;
  status: string;
  polygon_coordinates: [number, number][]; // Leaflet format [lat, lng]
  marker_coordinate: [number, number] | null;
  area_hectares: number;

  // ✅ SIMPLIFIED validation data
  validation_data: ValidationData;

  // Field evidence from inspectors (for review)
  field_evidence?: FieldAssessmentEvidence[];

  species_recommendations: Array<{
    id: number;
    name: string;
    rank: number;
    notes: string;
  }>;
}

// ✅ NEW: Type for the unified MCDA API response
export interface MCDADataResponse {
  success: boolean;
  reforestation_area: {
    reforestation_area_id: number;
    name: string;
    coordinate: [number, number] | null;
    barangay: { barangay_id: number; name: string } | null;
  } | null;
  sites: Site[];
}
