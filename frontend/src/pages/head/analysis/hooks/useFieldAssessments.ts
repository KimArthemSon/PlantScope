import { useState, useCallback, useRef } from "react";
import L from "leaflet";

export type MCDALayer = "safety" | "boundary_verification" | "survivability";
export type AssessmentType = "specific" | "general" | "all";

export interface AssessmentImage {
  id: number;
  url: string;
  layer: string;
  description: string;
  latitude: number | null;
  longitude: number | null;
}

export interface AssessmentLocation {
  latitude: number;
  longitude: number;
  gps_accuracy_meters: number;
}

export interface LayerData {
  [key: string]: any;
}

export interface InspectorInfo {
  email: string;
  full_name: string;
  profile_image: string | null;
}

export interface FieldAssessmentEntry {
  field_assessment_id: number;
  assessment_type?: "specific" | "general";
  site_name?: string | null;
  inspector: InspectorInfo;
  assessment_date: string;
  location: AssessmentLocation | null;
  layer_data: LayerData;
  images: AssessmentImage[];
  created_at: string;
  updated_at: string;
}

export interface FieldAssessmentsResponse {
  data: FieldAssessmentEntry[];
  count: number;
  counts?: {
    specific: number;
    general: number;
    all: number;
  };
}



const LAYER_EMOJIS: Record<MCDALayer, string> = {
  safety: "⚠️",
  boundary_verification: "📍",
  survivability: "🌱",
};

const PHOTO_MARKER_COLOR = "#3B82F6";
const SPECIFIC_MARKER_COLOR = "#10B981";
const GENERAL_MARKER_COLOR = "#3B82F6";

export function useFieldAssessments(mapRef: React.RefObject<L.Map | null>) {
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const photoMarkersRef = useRef<Map<number, L.Marker[]>>(new Map());
  
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

  const [counts, setCounts] = useState<Record<MCDALayer, { specific: number; general: number; all: number }>>({
    safety: { specific: 0, general: 0, all: 0 },
    boundary_verification: { specific: 0, general: 0, all: 0 },
    survivability: { specific: 0, general: 0, all: 0 },
  });

  const [activeLayer, setActiveLayer] = useState<MCDALayer>("safety");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [locationTargetId, setLocationTargetId] = useState<number | null>(null);
  const [showPhotoMarkers, setShowPhotoMarkers] = useState(true);

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
            // ignore
          }
          markersRef.current.delete(key);
        }
      });
    },
    [mapRef]
  );

  const removePhotoMarkers = useCallback((assessmentId: number) => {
    const map = mapRef.current;
    if (!map) return;

    const markers = photoMarkersRef.current.get(assessmentId);
    if (markers) {
      markers.forEach((marker) => {
        try {
          map.removeLayer(marker);
        } catch {
          // ignore
        }
      });
      photoMarkersRef.current.delete(assessmentId);
    }
  }, [mapRef]);

  const removeAllPhotoMarkers = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    photoMarkersRef.current.forEach((markers) => {
      markers.forEach((marker) => {
        try {
          map.removeLayer(marker);
        } catch {
          // ignore
        }
      });
    });
    photoMarkersRef.current.clear();
  }, [mapRef]);

  const placeMarkers = useCallback(
    (entries: FieldAssessmentEntry[], layer: MCDALayer) => {
      const map = mapRef.current;
      if (!map) return;

      removeLayerMarkers(layer);
      removeAllPhotoMarkers();

      const emoji = LAYER_EMOJIS[layer];

      entries.forEach((entry, idx) => {
        const loc = entry.location;
        if (!loc?.latitude || !loc?.longitude) return;

        const isSpecific = entry.assessment_type === "specific";
        const markerColor = isSpecific ? SPECIFIC_MARKER_COLOR : GENERAL_MARKER_COLOR;
        const markerLabel = isSpecific ? "S" : "G";

        const marker = L.marker([loc.latitude, loc.longitude], {
          icon: L.divIcon({
            className: "field-assessment-marker",
            html: `<div style="
              background:${markerColor};width:32px;height:32px;border-radius:50%;
              border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.35);
              display:flex;align-items:center;justify-content:center;
              font-size:13px;cursor:pointer;position:relative;
            ">${emoji}<div style="
              position:absolute;top:-6px;right:-6px;background:white;color:${markerColor};
              font-size:8px;font-weight:700;width:14px;height:14px;border-radius:50%;
              display:flex;align-items:center;justify-content:center;border:1px solid ${markerColor};
            ">${markerLabel}</div></div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 32],
            popupAnchor: [0, -32],
          }),
        }).addTo(map);

        const typeLabel = isSpecific ? "Specific" : "General";
        const siteInfo = isSpecific && entry.site_name ? `<br/><span style="font-size:10px;color:#666">Site: ${entry.site_name}</span>` : "";
        
        marker.bindPopup(`
          <strong>${typeLabel} F${idx + 1} — ${entry.inspector.full_name}</strong>${siteInfo}<br/>
          <span style="font-size:11px;color:#666">${entry.assessment_date}</span><br/>
          <span style="font-size:10px;color:#999">GPS ±${loc.gps_accuracy_meters}m</span>
        `);

        markersRef.current.set(`${layer}-${idx}`, marker);
      });
    },
    [mapRef, removeLayerMarkers, removeAllPhotoMarkers]
  );

  const placePhotoMarkers = useCallback((entry: FieldAssessmentEntry) => {
    const map = mapRef.current;
    if (!map || !entry.images || entry.images.length === 0) return;

    removePhotoMarkers(entry.field_assessment_id);

    const photoMarkers: L.Marker[] = [];

    entry.images.forEach((img, idx) => {
      if (!img.latitude || !img.longitude) return;

      const marker = L.marker([img.latitude, img.longitude], {
        icon: L.divIcon({
          className: "photo-marker",
          html: `<div style="
            background:${PHOTO_MARKER_COLOR};width:24px;height:24px;border-radius:50%;
            border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);
            display:flex;align-items:center;justify-content:center;
            font-size:11px;cursor:pointer;
          ">📷</div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 24],
          popupAnchor: [0, -24],
        }),
      }).addTo(map);

      const layerName = img.layer.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      marker.bindPopup(`
        <div style="min-width:150px;">
          <strong style="font-size:12px;color:${PHOTO_MARKER_COLOR}">📷 Photo ${idx + 1}</strong><br/>
          <span style="font-size:11px;color:#666">${layerName}</span><br/>
          <span style="font-size:10px;color:#999">${img.description || 'No description'}</span><br/>
          <span style="font-size:9px;color:#aaa">${img.latitude.toFixed(5)}, ${img.longitude.toFixed(5)}</span>
        </div>
      `);

      photoMarkers.push(marker);
    });

    if (photoMarkers.length > 0) {
      photoMarkersRef.current.set(entry.field_assessment_id, photoMarkers);
    }
  }, [mapRef, removePhotoMarkers]);

  // ✅ UPDATED: fetchLayer now accepts siteId parameter
  const fetchLayer = useCallback(
    async (areaId: string, layer: MCDALayer, assessmentType?: AssessmentType, siteId?: string) => {
      setLoading((prev) => ({ ...prev, [layer]: true }));
      try {
        const token = localStorage.getItem("token");
        
        // ✅ Build query parameters - include site_id when provided
        const params = new URLSearchParams();
        if (assessmentType && assessmentType !== "all") {
          params.append("assessment_type", assessmentType);
        }
        // ✅ NEW: Add site_id if provided
        if (siteId) {
          params.append("site_id", siteId);
        }
        
        const queryString = params.toString();
        const url = queryString 
          ? `http://127.0.0.1:8000/api/get_field_assessments_by_layer_mcda/${areaId}/${layer}/?${queryString}`
          : `http://127.0.0.1:8000/api/get_field_assessments_by_layer_mcda/${areaId}/${layer}/`;
        
        console.log('🔍 Fetching assessments:', url); // Debug log
        
        const res = await fetch(url, { 
          headers: { Authorization: `Bearer ${token}` } 
        });
        
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`HTTP ${res.status}: ${errorText}`);
        }
        
        const json: FieldAssessmentsResponse = await res.json();
        const entries = json.data ?? [];
       
        setAssessments((prev) => ({ ...prev, [layer]: entries }));
        
        if (json.counts) {
          setCounts((prev) => ({ ...prev, [layer]: json.counts! }));
        }
        
        placeMarkers(entries, layer);
        setActiveLayer(layer);
        setSelectedIndex(entries.length > 0 ? 0 : null);
        
        if (entries.length > 0 && showPhotoMarkers) {
          placePhotoMarkers(entries[0]);
        }
      } catch (err) {
        console.error(`fetchLayer(${layer}) error:`, err);
      } finally {
        setLoading((prev) => ({ ...prev, [layer]: false }));
      }
    },
    [placeMarkers, placePhotoMarkers, showPhotoMarkers]
  );

  // ✅ UPDATED: refreshLayer also accepts siteId
  const refreshLayer = useCallback(
    async (areaId: string, layer: MCDALayer, assessmentType?: AssessmentType, siteId?: string) => {
      setLoading((prev) => ({ ...prev, [layer]: true }));
      try {
        const token = localStorage.getItem("token");
        
        const params = new URLSearchParams();
        if (assessmentType && assessmentType !== "all") {
          params.append("assessment_type", assessmentType);
        }
        if (siteId) {
          params.append("site_id", siteId);
        }
        
        const queryString = params.toString();
        const url = queryString 
          ? `http://127.0.0.1:8000/api/get_field_assessments_by_layer_mcda/${areaId}/${layer}/?${queryString}`
          : `http://127.0.0.1:8000/api/get_field_assessments_by_layer_mcda/${areaId}/${layer}/`;
        
        const res = await fetch(url, { 
          headers: { Authorization: `Bearer ${token}` } 
        });
        
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: FieldAssessmentsResponse = await res.json();
        const entries = json.data ?? [];

        setAssessments((prev) => ({ ...prev, [layer]: entries }));
        
        if (json.counts) {
          setCounts((prev) => ({ ...prev, [layer]: json.counts! }));
        }
        
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
          "http://127.0.0.1:8000/api/update_field_assessment_coordinate/",
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
              if (entry.field_assessment_id === fieldAssessmentId) {
                return {
                  ...entry,
                  location: { latitude, longitude, gps_accuracy_meters },
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
    counts,
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
    placePhotoMarkers,
    removePhotoMarkers,
    showPhotoMarkers,
    setShowPhotoMarkers,
  };
}