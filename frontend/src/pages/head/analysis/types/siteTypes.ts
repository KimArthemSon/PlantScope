// src/pages/GISS/multicriteria_analysis/types/siteTypes.ts

export interface SiteValidationProgress {
  completed: number;
  total: number;
  layer_status: {
    safety?: string;
    boundary_verification?: string;
    survivability?: string;
  };
}

export interface SiteMetrics {
  ndvi: number | null;
  area_hectares: number;
  seedlings: number;
}

export interface Site {
  site_id: number;
  name: string;
  status: "pending" | "under_review" | "accepted" | "rejected" | "completed";
  is_pinned: boolean;
  area_hectares: number;
  ndvi: number | null;
  validation_progress: SiteValidationProgress;
  created_at: string;
}

export interface SiteDetail {
  site_id: number;
  name: string;
  status: string;
  polygon_coordinates: [number, number][];
  center_coordinate: [number, number] | null;
  ndvi_value: number | null;
  area_hectares: number;
  current_draft_mcda: {
    safety?: any;
    boundary_verification?: any;
    survivability?: any;
    [key: string]: any; // ← This allows layer.id (string) to index safely
  };
  finalized_mcda: {
    safety?: any;
    boundary_verification?: any;
    survivability?: any;
    [key: string]: any; // ← Same for finalized
  };

  inspector_snapshots: any;
  species_recommendations: Array<{
    id: number;
    name: string;
    rank: number;
    notes: string;
  }>;
}
