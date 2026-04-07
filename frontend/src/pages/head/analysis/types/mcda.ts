export type LayerKey =
  | "safety"
  | "legality"
  | "slope"
  | "soil_quality"
  | "hydrology"
  | "accessibility"
  | "wildlife_status"
  | "tree_species_suitability";

export type Verdict =
  | "PASS"
  | "PASS_WITH_MITIGATION"
  | "HIGHLY_SUITABLE"
  | "OPTIMIZED"
  | "WARNING"
  | "FAIL"
  | "AUTO_REJECT"
  | "HOLD";

export interface LayerResult {
  normalized_score: number;
  weight_percentage: number;
  weighted_score: number;
  status_input: string;
  verdict: Verdict;
  critical_flag: boolean;
  remark: string;
  derived_mitigation: string;
}

export interface LayerData {
  final_agreed_data: Record<string, any>;
  leader_comment?: string;
  result?: LayerResult;
  submitted_at?: string;
}

export interface SiteMCDAData {
  layers: Partial<Record<LayerKey, LayerData>>;
  meta_info?: {
    finalized_date?: string;
    finalized_by_role?: string;
    consensus_note?: string;
  };
  final_site_summary?: {
    total_weighted_score: number;
    suitability_classification: string;
    final_decision: string;
    priority_actions: string[];
    estimated_survival_rate: string;
    public_map_color_code: string;
  };
}

export interface SiteData {
  site_id: number;
  name: string;
  status:
    | "pending"
    | "official"
    | "rejected"
    | "pending_approval"
    | "re-analysis"
    | "completed";
  created_at: string;
  mcda_data?: SiteMCDAData;
  // ... other site fields
}

export interface Notification {
  message: string;
  type: "success" | "error" | "info";
  duration?: number;
}
