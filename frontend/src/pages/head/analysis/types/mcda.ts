// src/pages/multicriteria/types/mcda.ts

export type LayerKey =
  | "safety"
  | "legality"
  | "slope"
  | "soil_quality"
  | "hydrology"
  | "accessibility"
  | "wildlife_status"
  | "tree_species_suitability";

// ✅ v2.0: Only manual decision, no scoring
export type LeaderDecision = "ACCEPT" | "REJECT";

// ✅ v2.0: Leader validation metadata (no result/scoring)
export interface LayerValidation {
  final_agreed_data: Record<string, any>;
  additional_documentation_note?: string;
  leader_decision?: LeaderDecision;
  leader_comment?: string;
  validated_at?: string;
}

// ✅ v2.0: Raw inspector submission (no validation fields)
export interface FieldAssessment {
  final_agreed_data: Record<string, any>;
  inspector_comment?: string;
  submitted_at?: string;
}

// ✅ v2.0: Complete MCDA data structure
export interface SiteMCDAData {
  // Leader-validated final data (8 layers)
  site_data?: Partial<Record<LayerKey, LayerValidation>>;
  
  // Raw inspector submissions (8 layers)
  field_assessment_data?: Partial<Record<LayerKey, FieldAssessment>>;
  
  // Versioning metadata
  meta_info?: {
    finalized_date?: string;
    finalized_by_role?: string;
    consensus_note?: string;
  };
}

// ✅ v2.0: Site status matches backend exactly
export type SiteStatus = "pending" | "under_review" | "accepted" | "rejected" | "completed";

export interface SiteData {
  site_id: number;
  name: string;
  status: SiteStatus;
  is_pinned: boolean;
  created_at: string;
  center_coordinate?: [number, number];
  polygon_coordinates?: any;
  marker_coordinate?: [number, number];
  ndvi_value?: number | null;
  total_area_hectares?: number;
  total_seedlings_planted?: number;
  
  // ✅ v2.0: Dual JSON structure
  validated_mcda_data?: SiteMCDAData["site_data"];
  raw_field_assessment?: SiteMCDAData["field_assessment_data"];
  
  // Versioning
  versioning?: {
    is_current: boolean;
    validated_by?: string;
    validated_at?: string;
  };
}

export interface Notification {
  message: string;
  type: "success" | "error" | "info";
  duration?: number;
}

// ✅ v2.0: Layer config (no weights)
export interface LayerConfig {
  key: LayerKey;
  label: string;
  icon: string;
  description: string;
}