import { useState, useCallback } from "react";
import type { Site, SiteDetail } from "../types/siteTypes";

const BASE_URL = "http://127.0.0.1:8000";

// ✅ HELPER: Convert Leaflet [lat, lng] → GeoJSON [lng, lat]
export const toGeoJSONCoords = (coords: [number, number][]): [number, number][] => {
  return coords.map(([lat, lng]) => [lng, lat]);
};

// ✅ HELPER: Calculate centroid in GeoJSON format [lng, lat]
export const calculateGeoJSONCentroid = (coords: [number, number][]): [number, number] | null => {
  if (!coords || coords.length === 0) return null;
  const sum = coords.reduce((acc, [lat, lng]) => {
    return [acc[0] + lat, acc[1] + lng];
  }, [0, 0]);
  const avgLat = sum[0] / coords.length;
  const avgLng = sum[1] / coords.length;
  return [avgLng, avgLat]; // ✅ Return [lng, lat] for GeoJSON
};

export function useSites() {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSite, setSelectedSite] = useState<SiteDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ✅ Helper: Robust fetch with JSON validation
  const fetchWithAuth = useCallback(async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem("token");
    const headers = {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    };

    const res = await fetch(url, { ...options, headers });
    
    // Handle non-JSON error responses
    const contentType = res.headers.get("content-type");
    if (!res.ok || !contentType?.includes("application/json")) {
      const text = await res.text();
      throw new Error(text || `HTTP ${res.status}: ${res.statusText}`);
    }
    
    return res.json();
  }, []);

  const fetchSites = useCallback(async (areaId: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWithAuth(`${BASE_URL}/api/list_sites/${areaId}/`);
      setSites(data.data || []);
    } catch (err: any) {
      console.error("fetchSites error:", err);
      setError(err.message || "Failed to fetch sites");
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  const fetchSiteDetail = useCallback(async (siteId: number) => {
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
  }, [fetchWithAuth]);

  const createSite = useCallback(
    async (
      areaId: string,
      name: string,
      polygon_coordinates: [number, number][], // ✅ Input: Leaflet [lat, lng]
      total_area_hectares: number,
      ndvi_value?: number,
    ) => {
      try {
        // ✅ CONVERT: Leaflet [lat,lng] → GeoJSON [lng,lat]
        const geojsonCoords = toGeoJSONCoords(polygon_coordinates);
        const centerCoordinate = calculateGeoJSONCentroid(polygon_coordinates);
        
        console.log("Creating site:", {
          name,
          areaId,
          coordsCount: polygon_coordinates.length,
          firstLeaflet: polygon_coordinates[0],
          firstGeoJSON: geojsonCoords[0],
        });

        const data = await fetchWithAuth(`${BASE_URL}/api/sites/create_site/`, {
          method: "POST",
          body: JSON.stringify({
            reforestation_area_id: parseInt(areaId),
            name,
            polygon_coordinates: geojsonCoords, // ✅ Send GeoJSON format
            total_area_hectares,
            ndvi_value,
            center_coordinate: centerCoordinate, // ✅ GeoJSON [lng, lat]
          }),
        });

        // ✅ Refresh sites list after successful creation
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
      polygon_coordinates: [number, number][], // ✅ Input: Leaflet [lat, lng]
      ndvi_value?: number,
    ) => {
      try {
        // ✅ CONVERT coordinates
        const geojsonCoords = toGeoJSONCoords(polygon_coordinates);
        
        const data = await fetchWithAuth(`${BASE_URL}/api/update_polygon/${siteId}/`, {
          method: "PUT",
          body: JSON.stringify({
            polygon_coordinates: geojsonCoords, // ✅ Send GeoJSON format
            ndvi_value,
          }),
        });
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

  const updateLayer = useCallback(
    async (siteId: number, layerName: string, layerData: any) => {
      try {
        const data = await fetchWithAuth(
          `${BASE_URL}/api/update_layer/${siteId}/${layerName}/`,
          {
            method: "PUT",
            body: JSON.stringify(layerData),
          },
        );
        return data;
      } catch (err: any) {
        console.error("updateLayer error:", err);
        setError(err.message || "Failed to update layer");
        return null;
      }
    },
    [fetchWithAuth],
  );

  const finalizeSite = useCallback(
    async (siteId: number, decision: "ACCEPT" | "REJECT") => {
      try {
        const data = await fetchWithAuth(`${BASE_URL}/api/finalize_site/${siteId}/`, {
          method: "POST",
          body: JSON.stringify({ decision }),
        });
        return data;
      } catch (err: any) {
        console.error("finalizeSite error:", err);
        setError(err.message || "Failed to finalize site");
        return null;
      }
    },
    [fetchWithAuth],
  );

  const togglePin = useCallback(async (siteId: number) => {
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
  }, [fetchWithAuth]);

  return {
    sites,
    loading,
    error,
    selectedSite,
    fetchSites,
    fetchSiteDetail,
    createSite,
    updatePolygon,
    deleteSite,
    updateLayer,
    finalizeSite,
    togglePin,
    setSelectedSite,
    setError,
  };
}