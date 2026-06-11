import { useState, useCallback } from "react";
import type { Site, SiteDetail } from "../types/siteTypes";

const BASE_URL = "http://127.0.0.1:8000";

export const toGeoJSONCoords = (
  coords: [number, number][],
): [number, number][] => {
  return coords.map(([lat, lng]) => [lat, lng]); // Leaflet [lat,lng] → GeoJSON [lng,lat]
};

export const calculateGeoJSONCentroid = (
  coords: [number, number][],
): [number, number] | null => {
  if (!coords || coords.length === 0) return null;
  const sum = coords.reduce(
    (acc, [lat, lng]) => [acc[0] + lat, acc[1] + lng],
    [0, 0],
  );
  const avgLat = sum[0] / coords.length;
  const avgLng = sum[1] / coords.length;
  return [avgLng, avgLat]; // GeoJSON format [lng, lat]
};

export function useSites() {
  const [sites, setSites] = useState<Site[]>([]);
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
        console.error("fetchSites error:", err);
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
        console.error("fetchSiteDetail error:", err);
        setError(err.message || "Failed to fetch site details");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [fetchWithAuth],
  );

  const createSite = useCallback(
    async (
      areaId: string,
      name: string,
      polygon_coordinates: [number, number][],
      total_area_hectares: number,
      ndvi_value?: number,
    ) => {
      try {
        const geojsonCoords = toGeoJSONCoords(polygon_coordinates);
        const centerCoordinate = calculateGeoJSONCentroid(polygon_coordinates);
        const data = await fetchWithAuth(`${BASE_URL}/api/sites/create_site/`, {
          method: "POST",
          body: JSON.stringify({
            reforestation_area_id: parseInt(areaId),
            name,
            polygon_coordinates: geojsonCoords,
            total_area_hectares,
            ndvi_value,
            center_coordinate: centerCoordinate,
          }),
        });
        await fetchSites(areaId);
        return data;
      } catch (err: any) {
        console.error("createSite error:", err);
        setError(err.message || "Failed to create site");
        return null;
      }
    },
    [fetchWithAuth, fetchSites],
  );

  const updatePolygon = useCallback(
    async (
      siteId: number,
      polygon_coordinates: [number, number][],
      ndvi_value?: number,
    ) => {
      try {
        const geojsonCoords = toGeoJSONCoords(polygon_coordinates);
        const data = await fetchWithAuth(
          `${BASE_URL}/api/update_polygon/${siteId}/`,
          {
            method: "PUT",
            body: JSON.stringify({
              polygon_coordinates: geojsonCoords,
              ndvi_value,
            }),
          },
        );
        return data;
      } catch (err: any) {
        console.error("updatePolygon error:", err);
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
        await fetchSites(areaId);
        return true;
      } catch (err: any) {
        console.error("deleteSite error:", err);
        setError(err.message || "Failed to delete site");
        return false;
      }
    },
    [fetchWithAuth, fetchSites],
  );

  // ✅ UPDATED: Save validation draft (simplified - matches mobile spec)
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
        // Refresh site detail to get updated validation data
        await fetchSiteDetail(selectedSite.site_id);
        return !!result;
      } catch (err: any) {
        console.error("saveValidationDraft error:", err);
        setError(err.message || "Failed to save validation draft");
        return false;
      }
    },
    [fetchWithAuth, selectedSite, fetchSiteDetail],
  );

  // ✅ UPDATED: Finalize site (simplified - ONE decision for entire site)
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
        // Refresh sites list after finalization
        if (result) {
          const areaId = new URLSearchParams(window.location.search).get(
            "areaId",
          );
          if (areaId) await fetchSites(areaId);
        }
        return !!result;
      } catch (err: any) {
        console.error("finalizeSite error:", err);
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
        console.error("togglePin error:", err);
        setError(err.message || "Failed to toggle pin");
        return false;
      }
    },
    [fetchWithAuth],
  );
 const updateSiteCoordinates = useCallback(
  async (
    siteId: number,
    polygonCoordinates?: [number, number][],
    centerCoordinate?: [number, number]
  ) => {
    try {
      const body: any = {};
      if (polygonCoordinates) body.polygon_coordinates = polygonCoordinates;
      if (centerCoordinate) body.center_coordinate = centerCoordinate;
      
      const data = await fetchWithAuth(
        `${BASE_URL}/api/site/${siteId}/update_coordinates/`,
        {
          method: "PUT",
          body: JSON.stringify(body),
        }
      );
      
      // Refresh the site detail
      if (selectedSite) {
        await fetchSiteDetail(siteId);
      }
      return data;
    } catch (err: any) {
      console.error("updateSiteCoordinates error:", err);
      setError(err.message || "Failed to update coordinates");
      return null;
    }
  },
  [fetchWithAuth, fetchSiteDetail, selectedSite]
);

  return {
    sites,
    loading,
    error,
    selectedSite,
    fetchSites,
    fetchSiteDetail,
    createSite,
    updatePolygon,
    updateSiteCoordinates,
    deleteSite,
    saveValidationDraft, // ✅ Renamed from updateLayer
    finalizeSite, // ✅ Updated signature
    togglePin,
    setSelectedSite,
    setError,
  };
}
