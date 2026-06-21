import { useState, useCallback } from "react";
import {api_second } from "@/constant/api";
const BASE_URL = api_second;

export interface PotentialSite {
  potential_sites_id: number;
  site_id: string;
  reforestation_area_id: number;
  polygon_coordinates: {
    type: string;
    coordinates: number[][][];
  } | null;
  area_hectares: number;
  avg_ndvi: number;
  suitability_score: number;
  created_at: string | null;
}

export function usePotentialSites() {
  const [potentialSites, setPotentialSites] = useState<PotentialSite[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPotentialSites = useCallback(async (areaId: string) => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${BASE_URL}/api/get_potential_sites/?reforestation_area_id=${areaId}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPotentialSites(data.data || []);
    } catch (err: any) {
      setError(err.message || "Failed to fetch potential sites");
      setPotentialSites([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return { potentialSites, loading, error, fetchPotentialSites };
}
