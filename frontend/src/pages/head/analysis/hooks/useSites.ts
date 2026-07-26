import { useState, useCallback } from "react";
import { api_second } from "@/constant/api";

const BASE_URL = api_second;

// ✅ FIXED: Backend expects [lat, lng], so we DO NOT convert to GeoJSON [lng, lat]
export const calculateCentroid = (
  coords: [number, number][],
): [number, number] | null => {
  if (!coords || coords.length === 0) return null;
  const sum = coords.reduce(
    (acc, [lat, lng]) => [acc[0] + lat, acc[1] + lng],
    [0, 0],
  );
  const avgLat = sum[0] / coords.length;
  const avgLng = sum[1] / coords.length;
  return [avgLat, avgLng]; // ✅ Returns [lat, lng]
};

// ── Types ─────────────────────────────────────────────────────────────────
export interface ValidationStatus {
  has_safety_note: boolean;
  has_survivability_note: boolean;
  final_decision: "ACCEPT" | "REJECT" | null;
  is_ready_to_finalize: boolean;
}

export interface SiteMetrics {
  area_hectares: number;
  seedlings?: number;
}

export interface Site {
  site_id: number;
  name: string;
  status: "pending" | "under_review" | "accepted" | "rejected" | "completed";
  is_pinned: boolean;
  center_coordinate?: [number, number] | null;
  polygon_coordinates?: [number, number][];
  metrics: SiteMetrics;
  created_at?: string;
  validation?: ValidationStatus;
}

export interface SiteDetail {
  site_id: number;
  name: string;
  status: string;
  polygon_coordinates: [number, number][]; // Leaflet format [lat, lng]
  center_coordinate: [number, number] | null;
  area_hectares: number;
  validation_data?: any;
  field_evidence?: any[];
  species_recommendations?: Array<{
    id: number;
    name: string;
    rank: number;
    notes: string;
  }>;
}

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

// ── Hook ──────────────────────────────────────────────────────────────────
export function useSites() {
  const [sites, setSites] = useState<Site[]>([]);
  const [reforestationArea, setReforestationArea] =
    useState<MCDADataResponse["reforestation_area"]>(null);
  const [loading, setLoading] = useState(false);
  const [selectedSite, setSelectedSite] = useState<SiteDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchWithAuth = useCallback(
    async (url: string, options: RequestInit = {}) => {
      const token = localStorage.getItem("token");
      const headers = {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      };
      const res = await fetch(url, { ...options, headers });
      const contentType = res.headers.get("content-type");

      if (!res.ok || !contentType?.includes("application/json")) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}: ${res.statusText}`);
      }
      return res.json();
    },
    [],
  );

  const fetchMCDAData = useCallback(
    async (areaId: string) => {
      setLoading(true);
      setError(null);
      try {
        const data: MCDADataResponse = await fetchWithAuth(
          `${BASE_URL}/api/get_mcda_data/${areaId}/`,
        );
        setReforestationArea(data.reforestation_area);
        setSites(data.sites || []);
      } catch (err: any) {
        console.error("❌ [useSites] fetchMCDAData error:", err);
        setError(err.message || "Failed to fetch MCDA data");
      } finally {
        setLoading(false);
      }
    },
    [fetchWithAuth],
  );

  const fetchSites = useCallback(
    async (areaId: string) => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchWithAuth(
          `${BASE_URL}/api/get_sites/${areaId}/`,
        );
        setSites(data.data || []);
      } catch (err: any) {
        console.error("❌ [useSites] fetchSites error:", err);
        setError(err.message || "Failed to fetch sites");
      } finally {
        setLoading(false);
      }
    },
    [fetchWithAuth],
  );

  const fetchSiteDetail = useCallback(
    async (siteId: number) => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchWithAuth(`${BASE_URL}/api/get_site/${siteId}/`);
        setSelectedSite(data);
        return data;
      } catch (err: any) {
        console.error("❌ [useSites] fetchSiteDetail error:", err);
        setError(err.message || "Failed to fetch site details");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [fetchWithAuth],
  );

  // ✅ FIXED: No coordinate conversion. Backend expects [lat, lng].
  const createSite = useCallback(
    async (
      areaId: string,
      name: string,
      polygon_coordinates: [number, number][],
      total_area_hectares: number,
      ndvi_value?: number,
    ) => {
      try {
        const centerCoordinate = calculateCentroid(polygon_coordinates);

        const data = await fetchWithAuth(`${BASE_URL}/api/sites/create_site/`, {
          method: "POST",
          body: JSON.stringify({
            reforestation_area_id: parseInt(areaId),
            name,
            polygon_coordinates: polygon_coordinates,
            total_area_hectares,
            ndvi_value,
            center_coordinate: centerCoordinate,
          }),
        });
        // ✅ FIXED: Use fetchMCDAData instead of fetchSites to get complete data
        await fetchMCDAData(areaId);
        return data;
      } catch (err: any) {
        console.error("❌ [useSites] createSite error:", err);
        setError(err.message || "Failed to create site");
        return null;
      }
    },
    [fetchWithAuth, fetchMCDAData],
  );

  // ✅ FIXED: No coordinate conversion.
  const updatePolygon = useCallback(
    async (
      siteId: number,
      polygon_coordinates: [number, number][],
      ndvi_value?: number,
    ) => {
      try {
        const data = await fetchWithAuth(
          `${BASE_URL}/api/update_polygon/${siteId}/`,
          {
            method: "PUT",
            body: JSON.stringify({
              polygon_coordinates: polygon_coordinates, // ✅ Send [lat, lng] directly
              ndvi_value,
            }),
          },
        );
        return data;
      } catch (err: any) {
        console.error("❌ [useSites] updatePolygon error:", err);
        setError(err.message || "Failed to update polygon");
        return null;
      }
    },
    [fetchWithAuth],
  );

  const deleteSite = useCallback(
    async (siteId: number, areaId: string) => {
      try {
        await fetchWithAuth(`${BASE_URL}/api/delete_site/${siteId}/`, {
          method: "DELETE",
        });
        // ✅ FIXED: Use fetchMCDAData instead of fetchSites to get complete data with center_coordinate
        await fetchMCDAData(areaId);
        return true;
      } catch (err: any) {
        console.error("❌ [useSites] deleteSite error:", err);
        setError(err.message || "Failed to delete site");
        return false;
      }
    },
    [fetchWithAuth, fetchMCDAData],
  );

  // ✅ FIXED: No coordinate conversion.
  const updateSiteCoordinates = useCallback(
    async (
      siteId: number,
      polygonCoordinates?: [number, number][],
      centerCoordinate?: [number, number],
    ) => {
      try {
        const body: any = {};
        if (polygonCoordinates) body.polygon_coordinates = polygonCoordinates; // ✅ Send [lat, lng] directly
        if (centerCoordinate) body.center_coordinate = centerCoordinate;

        const data = await fetchWithAuth(
          `${BASE_URL}/api/site/${siteId}/update_coordinates/`,
          { method: "PUT", body: JSON.stringify(body) },
        );

        if (selectedSite && selectedSite.site_id === siteId) {
          await fetchSiteDetail(siteId);
        }
        return data;
      } catch (err: any) {
        console.error("❌ [useSites] updateSiteCoordinates error:", err);
        setError(err.message || "Failed to update coordinates");
        return null;
      }
    },
    [fetchWithAuth, fetchSiteDetail, selectedSite],
  );

  const saveValidationDraft = useCallback(
    async (data: {
      safety_note?: string;
      survivability_note?: string;
      final_note?: string;
    }) => {
      try {
        if (!selectedSite) return false;
        const payload: Record<string, any> = {};
        if (data.safety_note)
          payload.safety = { decision_note: data.safety_note };
        if (data.survivability_note)
          payload.survivability = { decision_note: data.survivability_note };
        if (data.final_note) payload.final_decision_note = data.final_note;

        const result = await fetchWithAuth(
          `${BASE_URL}/api/site/${selectedSite.site_id}/validation/draft/`,
          { method: "PUT", body: JSON.stringify(payload) },
        );
        await fetchSiteDetail(selectedSite.site_id);
        return !!result;
      } catch (err: any) {
        console.error("❌ [useSites] saveValidationDraft error:", err);
        setError(err.message || "Failed to save validation draft");
        return false;
      }
    },
    [fetchWithAuth, selectedSite, fetchSiteDetail],
  );

  const finalizeSite = useCallback(
    async (decision: "ACCEPT" | "REJECT", note: string) => {
      try {
        if (!selectedSite) return false;
        const result = await fetchWithAuth(
          `${BASE_URL}/api/site/${selectedSite.site_id}/validation/finalize/`,
          {
            method: "POST",
            body: JSON.stringify({
              final_decision: decision,
              final_decision_note: note,
            }),
          },
        );
        if (result) {
          const urlAreaId = new URLSearchParams(window.location.search).get(
            "areaId",
          );
          if (urlAreaId) await fetchSites(urlAreaId);
        }
        return !!result;
      } catch (err: any) {
        console.error("❌ [useSites] finalizeSite error:", err);
        setError(err.message || "Failed to finalize site");
        return false;
      }
    },
    [fetchWithAuth, selectedSite, fetchSites],
  );

  const togglePin = useCallback(
    async (siteId: number) => {
      try {
        await fetchWithAuth(`${BASE_URL}/api/toggle_pin/${siteId}/`, {
          method: "POST",
        });
        return true;
      } catch (err: any) {
        console.error("❌ [useSites] togglePin error:", err);
        setError(err.message || "Failed to toggle pin");
        return false;
      }
    },
    [fetchWithAuth],
  );

  return {
    sites,
    reforestationArea,
    loading,
    error,
    selectedSite,
    fetchMCDAData,
    fetchSites,
    fetchSiteDetail,
    createSite,
    updatePolygon,
    updateSiteCoordinates,
    deleteSite,
    saveValidationDraft,
    finalizeSite,
    togglePin,
    setSelectedSite,
    setError,
  };
}
