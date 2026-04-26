// src/pages/GISS/multicriteria_analysis/hooks/useFieldAssessments.ts
import { useState, useCallback, useRef } from "react";
import L from "leaflet";

export type MCDALayer = "safety" | "boundary_verification" | "survivability";

export interface AssessmentImage {
  id: number;
  url: string;
  caption: string;
}

export interface AssessmentLocation {
  latitude: number;
  longitude: number;
  gps_accuracy_meters: number;
}

export interface SafetyData {
  layer: "safety";
  location: AssessmentLocation;
  flood_notes: string | null;
  erosion_type: string | null;
  erosion_signs: string | null;
  landslide_notes: string | null;
  inspector_comment: string | null;
  flood_water_line_cm: number | null;
  hazard_proximity_notes: string | null;
  erosion_area_estimate_pct: number | null;
  flood_debris_line_visible: boolean | null;
  erosion_severity_description: string | null;
  landslide_indicators_observed: string[];
}

export interface BoundaryVerificationData {
  layer: "boundary_verification";
  location: AssessmentLocation;
  boundary_notes: string | null;
  encroachment_type: string | null;
  slope_boundary_check: boolean | null;
  encroachment_detected: boolean | null;
  boundary_markers_status: string | null;
  boundary_deviation_meters: number | null;
  within_riparian_buffer_20m: boolean | null;
  boundary_coordinates_feedback: Array<{
    notes: string;
    latitude: number;
    longitude: number;
    confidence: string;
    marker_name: string;
  }>;
}

export interface SurvivabilityData {
  layer: "survivability";
  location: AssessmentLocation;
  soil_notes: string | null;
  soil_texture: string | null;
  soil_depth_cm: number | null;
  micro_topography: string | null;
  vegetation_notes: string | null;
  microclimate_notes: string | null;
  soil_moisture_feel: string | null;
  water_stress_symptoms: string | null;
  soil_drainage_observed: string | null;
  days_since_last_rainfall: number | null;
  invasive_species_present: string | null;
  water_availability_notes: string | null;
  invasive_cover_estimate_pct: number | null;
  natural_regeneration_seedlings_count: number | null;
}

export type LayerData = SafetyData | BoundaryVerificationData | SurvivabilityData;

export interface FieldAssessmentEntry {
  email: string;
  full_name: string;
  profile_image: string;
  field_assessment_data: {
    field_assessment_id: number;
    layer: MCDALayer;
    location: AssessmentLocation;
    field_assessment_data: LayerData;
    assessment_date: string;
    images: AssessmentImage[];
  };
}

export interface FieldAssessmentsResponse {
  data: FieldAssessmentEntry[];
}

const LAYER_MARKER_COLORS: Record<MCDALayer, string> = {
  safety: "#EF4444",
  boundary_verification: "#F59E0B",
  survivability: "#10B981",
};

const LAYER_EMOJIS: Record<MCDALayer, string> = {
  safety: "⚠️",
  boundary_verification: "📍",
  survivability: "🌱",
};

export function useFieldAssessments(mapRef: React.RefObject<L.Map | null>) {
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  
  const [assessments, setAssessments] = useState<Record<MCDALayer, FieldAssessmentEntry[]>>({
    safety: [],
    boundary_verification: [],
    survivability: [],
  });

  const [loading, setLoading] = useState<Record<MCDALayer, boolean>>({
    safety: false,
    boundary_verification: false,
    survivability: false,
  });

  const [activeLayer, setActiveLayer] = useState<MCDALayer>("safety");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [locationTargetId, setLocationTargetId] = useState<number | null>(null);

  const removeLayerMarkers = useCallback(
    (layer: MCDALayer) => {
      const map = mapRef.current;
      if (!map) return;

      const keysToRemove: string[] = [];
      markersRef.current.forEach((_, key) => {
        if (key.startsWith(`${layer}-`)) keysToRemove.push(key);
      });

      keysToRemove.forEach((key) => {
        const marker = markersRef.current.get(key);
        if (marker) {
          try {
            map.removeLayer(marker);
          } catch {
            // marker may already be detached — ignore
          }
          markersRef.current.delete(key);
        }
      });
    },
    [mapRef]
  );

  const placeMarkers = useCallback(
    (entries: FieldAssessmentEntry[], layer: MCDALayer) => {
      const map = mapRef.current;
      if (!map) return;

      removeLayerMarkers(layer);

      const color = LAYER_MARKER_COLORS[layer];
      const emoji = LAYER_EMOJIS[layer];

      entries.forEach((entry, idx) => {
        const loc = entry.field_assessment_data?.location;
        if (!loc?.latitude || !loc?.longitude) return;

        const marker = L.marker([loc.latitude, loc.longitude], {
          icon: L.divIcon({
            className: "field-assessment-marker",
            html: `<div style="
              background:${color};width:30px;height:30px;border-radius:50%;
              border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.35);
              display:flex;align-items:center;justify-content:center;
              font-size:13px;cursor:pointer;
            ">${emoji}</div>
            <div style="
              position:absolute;top:-6px;right:-6px;background:white;color:${color};
              font-size:9px;font-weight:700;width:16px;height:16px;border-radius:50%;
              display:flex;align-items:center;justify-content:center;border:1px solid ${color};
            ">F${idx + 1}</div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 30],
            popupAnchor: [0, -30],
          }),
        }).addTo(map);

        marker.bindPopup(`
          <strong>F${idx + 1} — ${entry.full_name}</strong><br/>
          <span style="font-size:11px;color:#666">${entry.field_assessment_data.assessment_date}</span><br/>
          <span style="font-size:10px;color:#999">GPS ±${loc.gps_accuracy_meters}m</span>
        `);

        markersRef.current.set(`${layer}-${idx}`, marker);
      });
    },
    [mapRef, removeLayerMarkers]
  );

  const fetchLayer = useCallback(
    async (areaId: string, layer: MCDALayer) => {
      setLoading((prev) => ({ ...prev, [layer]: true }));
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(
          `http://127.0.0.1:8000/api/get_field_assessments_by_layer_mcda/${areaId}/${layer}/`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: FieldAssessmentsResponse = await res.json();
        const entries = json.data ?? [];

        setAssessments((prev) => ({ ...prev, [layer]: entries }));
        placeMarkers(entries, layer);
        setActiveLayer(layer);
        setSelectedIndex(entries.length > 0 ? 0 : null);
      } catch (err) {
        console.error(`fetchLayer(${layer}) error:`, err);
      } finally {
        setLoading((prev) => ({ ...prev, [layer]: false }));
      }
    },
    [placeMarkers]
  );

  const refreshLayer = useCallback(
    async (areaId: string, layer: MCDALayer) => {
      setLoading((prev) => ({ ...prev, [layer]: true }));
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(
          `http://127.0.0.1:8000/api/get_field_assessments_by_layer_mcda/${areaId}/${layer}/`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: FieldAssessmentsResponse = await res.json();
        const entries = json.data ?? [];

        setAssessments((prev) => ({ ...prev, [layer]: entries }));
        placeMarkers(entries, layer);
      } catch (err) {
        console.error(`refreshLayer(${layer}) error:`, err);
      } finally {
        setLoading((prev) => ({ ...prev, [layer]: false }));
      }
    },
    [placeMarkers]
  );

  const flyToMarker = useCallback(
    (layer: MCDALayer, idx: number) => {
      const map = mapRef.current;
      if (!map) return;
      const marker = markersRef.current.get(`${layer}-${idx}`);
      if (marker) {
        map.flyTo(marker.getLatLng(), 17, { animate: true, duration: 0.8 });
        marker.openPopup();
      }
    },
    [mapRef]
  );

  const updateLocation = useCallback(
    async (
      fieldAssessmentId: number,
      latitude: number,
      longitude: number,
      gps_accuracy_meters: number = 20
    ): Promise<{ success: boolean; message?: string }> => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(
          "http://127.0.0.1:8000/api/update_field_assessment_location/",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              field_assessment_id: fieldAssessmentId,
              coordinate: { latitude, longitude, gps_accuracy_meters },
            }),
          }
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json.message ?? `HTTP ${res.status}`);

        setAssessments((prev) => {
          const updated = { ...prev };
          (Object.keys(updated) as MCDALayer[]).forEach((layer) => {
            updated[layer] = updated[layer].map((entry) => {
              if (
                entry.field_assessment_data.field_assessment_id ===
                fieldAssessmentId
              ) {
                return {
                  ...entry,
                  field_assessment_data: {
                    ...entry.field_assessment_data,
                    location: { latitude, longitude, gps_accuracy_meters },
                  },
                };
              }
              return entry;
            });
          });
          return updated;
        });

        return { success: true, message: json.message };
      } catch (err: any) {
        console.error("updateLocation error:", err);
        return { success: false, message: err.message };
      }
    },
    []
  );

  return {
    assessments,
    loading,
    activeLayer,
    setActiveLayer,
    selectedIndex,
    setSelectedIndex,
    fetchLayer,
    refreshLayer,
    flyToMarker,
    updateLocation,
    locationTargetId,
    setLocationTargetId,
  };
}