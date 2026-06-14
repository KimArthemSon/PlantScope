import { useState, useEffect, useCallback, useRef } from "react";
import L from "leaflet";

export interface Barangay {
  barangay_id: number;
  name: string;
  coordinate: [number, number];
}

export interface ClassifiedArea {
  classified_area_id: number;
  name: string;
  description: string;
  land_classification?: { name: string } | null;
  polygon: {
    type: string;
    coordinates: [number, number][] | [number, number][][];
  };
  created_at: string;
}

export interface HazardArea {
  hazard_area_id: number;
  name: string;
  hazard_type: string;
  description: string;
  barangay_id: number | null;
  polygon: {
    type: string;
    coordinates: [number, number][] | [number, number][][];
  };
  created_at: string;
}

export const HAZARD_TYPES = [
  { value: "LANDSLIDE", label: "Landslide" },
  { value: "FLOOD", label: "Flood" },
  { value: "EARTHQUAKE", label: "Earthquake" },
  { value: "VOLCANIC", label: "Volcanic Hazard" },
  { value: "STORM_SURGE", label: "Storm Surge" },
  { value: "LIQUEFACTION", label: "Soil Liquefaction" },
  { value: "COASTAL_EROSION", label: "Coastal Erosion" },
  { value: "OTHER", label: "Other" },
];

export function useBarangayAreas(mapRef: React.RefObject<L.Map | null>) {
  // ── States ──────────────────────────────────────────────────────────────
  const [barangayList, setBarangayList] = useState<Barangay[]>([]);
  const [selectedBarangayId, setSelectedBarangayId] = useState<number | null>(null);
  const [showClassified, setShowClassified] = useState(true);
  const [showHazards, setShowHazards] = useState(true);
  const [classifiedAreas, setClassifiedAreas] = useState<ClassifiedArea[]>([]);
  const [hazardAreas, setHazardAreas] = useState<HazardArea[]>([]);
  const [loading, setLoading] = useState(false);

  // ── Drawing States ──────────────────────────────────────────────────────
  const [isDrawingHazard, setIsDrawingHazard] = useState(false);
  const [hazardPolygonPoints, setHazardPolygonPoints] = useState<[number, number][]>([]);
  const [completedHazardPolygon, setCompletedHazardPolygon] = useState<[number, number][] | null>(null);
  const [isSavingHazard, setIsSavingHazard] = useState(false);
  const [showHazardForm, setShowHazardForm] = useState(false);

  // ── Editing State ───────────────────────────────────────────────────────
  const [editingHazardArea, setEditingHazardArea] = useState<HazardArea | null>(null);

  // ── NEW: Map Edit Mode States ───────────────────────────────────────────
  const [isMapEditMode, setIsMapEditMode] = useState(false);

  // ── Refs ────────────────────────────────────────────────────────────────
  const classifiedLayersRef = useRef<L.Polygon[]>([]);
  const hazardLayersRef = useRef<L.Polygon[]>([]);
  const hazardDrawingMarkersRef = useRef<L.Marker[]>([]);
  const hazardDrawingLineRef = useRef<L.Polyline | null>(null);
  const hazardCompletedPolygonRef = useRef<L.Polygon | null>(null);

  // ── NEW: Map Edit Preview Refs ──────────────────────────────────────────
  const previewPolygonRef = useRef<L.Polygon | null>(null);
  const previewMarkersRef = useRef<L.Marker[]>([]);
  const previewLineRef = useRef<L.Polyline | null>(null);

  // ── Fetch Functions ─────────────────────────────────────────────────────
  const fetchBarangayList = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://127.0.0.1:8000/api/get_barangay_list/", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.data) setBarangayList(data.data);
    } catch (err) {
      console.error("Failed to fetch barangay list:", err);
    }
  }, []);

  const fetchClassifiedAreas = useCallback(async (barangayId: number) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `http://127.0.0.1:8000/api/barangay/${barangayId}/classified-areas/`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      setClassifiedAreas(res.ok && data.data ? data.data : []);
    } catch (err) {
      console.error("Failed to fetch classified areas:", err);
      setClassifiedAreas([]);
    }
  }, []);

  const fetchHazardAreas = useCallback(async (barangayId: number) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `http://127.0.0.1:8000/api/barangay/${barangayId}/hazard-areas/`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      setHazardAreas(res.ok && data.data ? data.data : []);
    } catch (err) {
      console.error("Failed to fetch hazard areas:", err);
      setHazardAreas([]);
    }
  }, []);

  const clearLayers = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    classifiedLayersRef.current.forEach((l) => map.removeLayer(l));
    classifiedLayersRef.current = [];
    hazardLayersRef.current.forEach((l) => map.removeLayer(l));
    hazardLayersRef.current = [];
  }, [mapRef]);

  // ── Drawing Functions ───────────────────────────────────────────────────
  const clearHazardDrawing = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    hazardDrawingMarkersRef.current.forEach((m) => map.removeLayer(m));
    hazardDrawingMarkersRef.current = [];
    if (hazardDrawingLineRef.current) {
      map.removeLayer(hazardDrawingLineRef.current);
      hazardDrawingLineRef.current = null;
    }
    if (hazardCompletedPolygonRef.current) {
      map.removeLayer(hazardCompletedPolygonRef.current);
      hazardCompletedPolygonRef.current = null;
    }
  }, [mapRef]);

  // ── NEW: Clear Map Edit Preview ─────────────────────────────────────────
  const clearEditPreview = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    previewMarkersRef.current.forEach((m) => map.removeLayer(m));
    previewMarkersRef.current = [];
    if (previewLineRef.current) {
      map.removeLayer(previewLineRef.current);
      previewLineRef.current = null;
    }
    if (previewPolygonRef.current) {
      map.removeLayer(previewPolygonRef.current);
      previewPolygonRef.current = null;
    }
  }, [mapRef]);

  const startDrawingHazard = useCallback(() => {
    clearHazardDrawing();
    clearEditPreview();
    setHazardPolygonPoints([]);
    setCompletedHazardPolygon(null);
    setShowHazardForm(false);
    setEditingHazardArea(null);
    setIsDrawingHazard(true);
    setIsMapEditMode(false);
  }, [clearHazardDrawing, clearEditPreview]);

  const addHazardPoint = useCallback(
    (lat: number, lng: number) => {
      const map = mapRef.current;
      if (!map) return;

      const newPoint: [number, number] = [lat, lng];
      setHazardPolygonPoints((prev) => {
        const updated = [...prev, newPoint];

        const marker = L.marker(newPoint, {
          icon: L.divIcon({
            className: "hazard-draw-vertex",
            html: `<div style="
              background:#eab308;width:14px;height:14px;border-radius:50%;
              border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);
              display:flex;align-items:center;justify-content:center;
              font-size:8px;color:white;font-weight:bold;
            ">${updated.length}</div>`,
            iconSize: [14, 14],
            iconAnchor: [7, 7],
          }),
        }).addTo(map);

        marker.on("dblclick", () => {
          const idx = updated.findIndex((p) => p[0] === lat && p[1] === lng);
          if (idx !== -1) {
            const newPoints = updated.filter((_, i) => i !== idx);
            setHazardPolygonPoints(newPoints);
            map.removeLayer(marker);
            hazardDrawingMarkersRef.current = hazardDrawingMarkersRef.current.filter((m) => m !== marker);
            if (hazardDrawingLineRef.current) map.removeLayer(hazardDrawingLineRef.current);
            if (newPoints.length >= 2) {
              hazardDrawingLineRef.current = L.polyline(newPoints, {
                color: "#ca8a04", weight: 3, dashArray: "5, 5",
              }).addTo(map);
            }
            hazardDrawingMarkersRef.current.forEach((m, i) => {
              m.setIcon(
                L.divIcon({
                  className: "hazard-draw-vertex",
                  html: `<div style="
                    background:#eab308;width:14px;height:14px;border-radius:50%;
                    border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);
                    display:flex;align-items:center;justify-content:center;
                    font-size:8px;color:white;font-weight:bold;
                  ">${i + 1}</div>`,
                  iconSize: [14, 14],
                  iconAnchor: [7, 7],
                })
              );
            });
          }
        });

        hazardDrawingMarkersRef.current.push(marker);

        if (hazardDrawingLineRef.current) map.removeLayer(hazardDrawingLineRef.current);
        if (updated.length >= 2) {
          hazardDrawingLineRef.current = L.polyline(updated, {
            color: "#ca8a04", weight: 3, dashArray: "5, 5",
          }).addTo(map);
        }

        return updated;
      });
    },
    [mapRef]
  );

  const removeLastHazardPoint = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    setHazardPolygonPoints((prev) => {
      if (prev.length === 0) return prev;
      const lastMarker = hazardDrawingMarkersRef.current.pop();
      if (lastMarker) map.removeLayer(lastMarker);
      const newPoints = prev.slice(0, -1);
      if (hazardDrawingLineRef.current) map.removeLayer(hazardDrawingLineRef.current);
      if (newPoints.length >= 2) {
        hazardDrawingLineRef.current = L.polyline(newPoints, {
          color: "#ca8a04", weight: 3, dashArray: "5, 5",
        }).addTo(map);
      } else {
        hazardDrawingLineRef.current = null;
      }
      return newPoints;
    });
  }, [mapRef]);

  const finishDrawingHazard = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    if (hazardPolygonPoints.length < 3) return;

    hazardDrawingMarkersRef.current.forEach((m) => map.removeLayer(m));
    hazardDrawingMarkersRef.current = [];
    if (hazardDrawingLineRef.current) {
      map.removeLayer(hazardDrawingLineRef.current);
      hazardDrawingLineRef.current = null;
    }

    const polygon = L.polygon(hazardPolygonPoints, {
      color: "#ca8a04",
      fillColor: "#eab308",
      fillOpacity: 0.3,
      weight: 3,
      dashArray: "5, 5",
    }).addTo(map);
    hazardCompletedPolygonRef.current = polygon;

    setCompletedHazardPolygon([...hazardPolygonPoints]);
    setIsDrawingHazard(false);
    setShowHazardForm(true);
  }, [hazardPolygonPoints, mapRef]);

  const cancelDrawingHazard = useCallback(() => {
    clearHazardDrawing();
    clearEditPreview();
    setHazardPolygonPoints([]);
    setCompletedHazardPolygon(null);
    setIsDrawingHazard(false);
    setIsMapEditMode(false);
    setShowHazardForm(false);
    setEditingHazardArea(null);
  }, [clearHazardDrawing, clearEditPreview]);

  // ── Start Editing Existing Hazard ───────────────────────────────────────
  const startEditingHazard = useCallback(
    (hazard: HazardArea) => {
      clearHazardDrawing();
      clearEditPreview();
      setEditingHazardArea(hazard);

      // Extract coordinates
      let coords: [number, number][] = [];
      if (Array.isArray(hazard.polygon.coordinates[0])) {
        coords = typeof hazard.polygon.coordinates[0][0] === "number"
          ? (hazard.polygon.coordinates as [number, number][])
          : (hazard.polygon.coordinates as [number, number][][])[0];
      }

      // Draw the existing polygon on map
      const map = mapRef.current;
      if (map && coords.length >= 3) {
        const polygon = L.polygon(coords, {
          color: "#ca8a04",
          fillColor: "#eab308",
          fillOpacity: 0.3,
          weight: 3,
          dashArray: "5, 5",
        }).addTo(map);
        hazardCompletedPolygonRef.current = polygon;

        // Add vertex markers
        coords.forEach((point, i) => {
          const marker = L.marker(point, {
            icon: L.divIcon({
              className: "hazard-draw-vertex",
              html: `<div style="
                background:#eab308;width:14px;height:14px;border-radius:50%;
                border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);
                display:flex;align-items:center;justify-content:center;
                font-size:8px;color:white;font-weight:bold;
              ">${i + 1}</div>`,
              iconSize: [14, 14],
              iconAnchor: [7, 7],
            }),
          }).addTo(map);
          hazardDrawingMarkersRef.current.push(marker);
        });

        // Fit bounds
        map.fitBounds(polygon.getBounds(), { padding: [50, 50] });
      }

      setHazardPolygonPoints(coords);
      setCompletedHazardPolygon(coords);
      setShowHazardForm(true);
      setIsMapEditMode(false);
    },
    [clearHazardDrawing, clearEditPreview, mapRef]
  );

  // ── NEW: Map Edit Mode Functions ────────────────────────────────────────
  const startMapEditMode = useCallback(() => {
    // Clear the original polygon markers so user can see map clearly
    clearHazardDrawing();
    setIsMapEditMode(true);
  }, [clearHazardDrawing]);

  const exitMapEditMode = useCallback(() => {
    setIsMapEditMode(false);
  }, []);

  const addVertexOnMap = useCallback(
    (lat: number, lng: number) => {
      setHazardPolygonPoints((prev) => [...prev, [lat, lng]]);
    },
    []
  );

  const removeLastVertexOnMap = useCallback(() => {
    setHazardPolygonPoints((prev) => (prev.length > 0 ? prev.slice(0, -1) : prev));
  }, []);

  // ── NEW: Render preview polygon during map edit mode ────────────────────
  const renderEditPreview = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear previous preview
    previewMarkersRef.current.forEach((m) => map.removeLayer(m));
    previewMarkersRef.current = [];
    if (previewLineRef.current) {
      map.removeLayer(previewLineRef.current);
      previewLineRef.current = null;
    }
    if (previewPolygonRef.current) {
      map.removeLayer(previewPolygonRef.current);
      previewPolygonRef.current = null;
    }

    if (!isMapEditMode || hazardPolygonPoints.length === 0) return;

    // Draw polygon fill if 3+ points
    if (hazardPolygonPoints.length >= 3) {
      previewPolygonRef.current = L.polygon(hazardPolygonPoints, {
        color: "#3b82f6",
        fillColor: "#60a5fa",
        fillOpacity: 0.3,
        weight: 3,
        dashArray: "5, 5",
      }).addTo(map);
    }

    // Draw connecting line
    if (hazardPolygonPoints.length >= 2) {
      previewLineRef.current = L.polyline(hazardPolygonPoints, {
        color: "#3b82f6",
        weight: 3,
        dashArray: "5, 5",
      }).addTo(map);
    }

    // Add vertex markers
    hazardPolygonPoints.forEach((point, i) => {
      const marker = L.marker(point, {
        icon: L.divIcon({
          className: "edit-preview-vertex",
          html: `<div style="
            background:#3b82f6;width:18px;height:18px;border-radius:50%;
            border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);
            display:flex;align-items:center;justify-content:center;
            font-size:9px;color:white;font-weight:bold;
          ">${i + 1}</div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        }),
      }).addTo(map);

      // Double-click to remove vertex
      marker.on("dblclick", () => {
        if (hazardPolygonPoints.length <= 3) return;
        const newPoints = hazardPolygonPoints.filter((_, idx) => idx !== i);
        setHazardPolygonPoints(newPoints);
      });

      previewMarkersRef.current.push(marker);
    });
  }, [isMapEditMode, hazardPolygonPoints]);

  // ── API Functions ───────────────────────────────────────────────────────
  const createHazardArea = useCallback(
    async (name: string, description: string, hazardType: string) => {
      if (hazardPolygonPoints.length < 3 || !selectedBarangayId) {
        return { success: false, message: "Missing data or need at least 3 vertices" };
      }

      setIsSavingHazard(true);
      try {
        const token = localStorage.getItem("token");
        const payload = {
          name,
          description,
          hazard_type: hazardType,
          barangay_id: selectedBarangayId,
          polygon: {
            type: "POLYGON",
            coordinates: hazardPolygonPoints,
          },
        };

        const res = await fetch("http://127.0.0.1:8000/api/create_hazard_area/", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok) {
          return { success: false, message: data.error || "Failed to create hazard area" };
        }

        await fetchHazardAreas(selectedBarangayId);
        clearHazardDrawing();
        clearEditPreview();
        setCompletedHazardPolygon(null);
        setHazardPolygonPoints([]);
        setShowHazardForm(false);
        setIsMapEditMode(false);
        setEditingHazardArea(null);

        return { success: true, message: "Hazard area created successfully!" };
      } catch (err: any) {
        return { success: false, message: err.message || "Network error" };
      } finally {
        setIsSavingHazard(false);
      }
    },
    [hazardPolygonPoints, selectedBarangayId, fetchHazardAreas, clearHazardDrawing, clearEditPreview]
  );

  const updateHazardArea = useCallback(
    async (id: number, name: string, description: string, hazardType: string) => {
      if (hazardPolygonPoints.length < 3) {
        return { success: false, message: "Need at least 3 vertices" };
      }

      setIsSavingHazard(true);
      try {
        const token = localStorage.getItem("token");
        const payload = {
          name,
          description,
          hazard_type: hazardType,
          barangay_id: selectedBarangayId,
          polygon: {
            type: "POLYGON",
            coordinates: hazardPolygonPoints,
          },
        };

        const res = await fetch(`http://127.0.0.1:8000/api/update_hazard_area/${id}/`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok) {
          return { success: false, message: data.error || "Failed to update hazard area" };
        }

        if (selectedBarangayId) await fetchHazardAreas(selectedBarangayId);
        clearHazardDrawing();
        clearEditPreview();
        setCompletedHazardPolygon(null);
        setHazardPolygonPoints([]);
        setShowHazardForm(false);
        setIsMapEditMode(false);
        setEditingHazardArea(null);

        return { success: true, message: "Hazard area updated successfully!" };
      } catch (err: any) {
        return { success: false, message: err.message || "Network error" };
      } finally {
        setIsSavingHazard(false);
      }
    },
    [hazardPolygonPoints, selectedBarangayId, fetchHazardAreas, clearHazardDrawing, clearEditPreview]
  );

  const deleteHazardArea = useCallback(
    async (id: number): Promise<{ success: boolean; message: string }> => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`http://127.0.0.1:8000/api/delete_hazard_area/${id}/`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          return { success: false, message: data.error || "Failed to delete" };
        }

        if (selectedBarangayId) await fetchHazardAreas(selectedBarangayId);
        return { success: true, message: "Hazard area deleted successfully!" };
      } catch (err: any) {
        return { success: false, message: err.message || "Network error" };
      }
    },
    [selectedBarangayId, fetchHazardAreas]
  );

  // ── Render Functions ────────────────────────────────────────────────────
  const renderClassifiedAreas = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    classifiedLayersRef.current.forEach((l) => map.removeLayer(l));
    classifiedLayersRef.current = [];
    if (!showClassified || classifiedAreas.length === 0) return;

    classifiedAreas.forEach((area) => {
      if (!area.polygon?.coordinates) return;
      let coords: [number, number][] = [];
      if (Array.isArray(area.polygon.coordinates[0])) {
        coords = typeof area.polygon.coordinates[0][0] === "number"
          ? (area.polygon.coordinates as [number, number][])
          : (area.polygon.coordinates as [number, number][][])[0];
      }
      if (coords.length < 3) return;

      const poly = L.polygon(coords, {
        color: "#dc2626", fillColor: "#ef4444", fillOpacity: 0.3, weight: 2,
      }).bindPopup(`
        <div style="min-width:200px;font-family:sans-serif">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid #e5e7eb">
            <div style="width:12px;height:12px;border-radius:50%;background:#ef4444"></div>
            <strong style="color:#dc2626;font-size:14px">${area.name}</strong>
          </div>
          <div style="font-size:11px;color:#555">
            <div style="margin-bottom:4px">
              <span style="color:#6b7280">Classification:</span>
              <span style="background:#ef4444;color:white;padding:2px 6px;border-radius:4px;font-size:10px;margin-left:4px">
                ${area.land_classification?.name || "N/A"}
              </span>
            </div>
            ${area.description ? `<div style="margin-top:6px;color:#374151;font-size:10px;line-height:1.4">${area.description}</div>` : ""}
          </div>
        </div>
      `).addTo(map);
      classifiedLayersRef.current.push(poly);
    });
  }, [showClassified, classifiedAreas, mapRef]);

  const renderHazardAreas = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    hazardLayersRef.current.forEach((l) => map.removeLayer(l));
    hazardLayersRef.current = [];
    if (!showHazards || hazardAreas.length === 0) return;

    hazardAreas.forEach((area) => {
      if (!area.polygon?.coordinates) return;
      let coords: [number, number][] = [];
      if (Array.isArray(area.polygon.coordinates[0])) {
        coords = typeof area.polygon.coordinates[0][0] === "number"
          ? (area.polygon.coordinates as [number, number][])
          : (area.polygon.coordinates as [number, number][][])[0];
      }
      if (coords.length < 3) return;

      const coordsHtml = coords
        .map((c, i) => `
          <div style="display:flex;justify-content:space-between;padding:2px 0;border-bottom:1px dashed #f3f4f6;font-family:monospace;font-size:10px">
            <span style="color:#6b7280">V${i + 1}</span>
            <span style="color:#374151">${c[0].toFixed(6)}, ${c[1].toFixed(6)}</span>
          </div>
        `)
        .join("");

      const hazardTypeLabel = HAZARD_TYPES.find((t) => t.value === area.hazard_type)?.label || area.hazard_type;

      const poly = L.polygon(coords, {
        color: "#ca8a04", fillColor: "#eab308", fillOpacity: 0.3, weight: 2,
      }).bindPopup(
        `
        <div style="min-width:280px;max-width:320px;font-family:sans-serif">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid #e5e7eb">
            <div style="width:12px;height:12px;border-radius:50%;background:#eab308"></div>
            <strong style="color:#ca8a04;font-size:14px;flex:1">${area.name}</strong>
          </div>
          
          <div style="font-size:11px;color:#555;margin-bottom:8px">
            <div style="margin-bottom:4px">
              <span style="color:#6b7280">Type:</span>
              <span style="background:#eab308;color:white;padding:2px 6px;border-radius:4px;font-size:10px;margin-left:4px">
                ${hazardTypeLabel}
              </span>
            </div>
            ${area.description ? `<div style="margin-top:6px;color:#374151;font-size:10px;line-height:1.4">${area.description}</div>` : ""}
          </div>

          <details style="margin-bottom:8px;border:1px solid #e5e7eb;border-radius:4px;padding:4px 8px">
            <summary style="cursor:pointer;font-size:10px;font-weight:600;color:#ca8a04;user-select:none">
              📍 Vertices (${coords.length})
            </summary>
            <div style="max-height:120px;overflow-y:auto;margin-top:4px">
              ${coordsHtml}
            </div>
          </details>

          <div style="display:flex;gap:4px;padding-top:8px;border-top:1px solid #e5e7eb">
            <button 
              onclick="window.__editHazardArea_${area.hazard_area_id}()" 
              style="flex:1;background:#3b82f6;color:white;border:none;padding:6px;border-radius:4px;font-size:11px;cursor:pointer;font-weight:600"
            >
              ✏️ Edit
            </button>
            <button 
              onclick="window.__deleteHazardArea_${area.hazard_area_id}()" 
              style="flex:1;background:#dc2626;color:white;border:none;padding:6px;border-radius:4px;font-size:11px;cursor:pointer;font-weight:600"
            >
              🗑️ Delete
            </button>
          </div>
        </div>
      `,
        { maxWidth: 350 }
      ).addTo(map);

      (window as any)[`__editHazardArea_${area.hazard_area_id}`] = () => {
        startEditingHazard(area);
        map.closePopup();
      };

      (window as any)[`__deleteHazardArea_${area.hazard_area_id}`] = () => {
        if (confirm(`Delete hazard area "${area.name}"? This cannot be undone.`)) {
          deleteHazardArea(area.hazard_area_id).then((result) => {
            if (result.success) {
              alert("✅ " + result.message);
            } else {
              alert("❌ " + result.message);
            }
          });
        }
      };

      hazardLayersRef.current.push(poly);
    });
  }, [showHazards, hazardAreas, mapRef, startEditingHazard, deleteHazardArea]);

  const selectBarangay = useCallback(
    async (barangayId: number | null) => {
      setSelectedBarangayId(barangayId);
      clearLayers();
      cancelDrawingHazard();
      if (!barangayId) {
        setClassifiedAreas([]);
        setHazardAreas([]);
        return;
      }
      setLoading(true);
      try {
        await Promise.all([fetchClassifiedAreas(barangayId), fetchHazardAreas(barangayId)]);
      } finally {
        setLoading(false);
      }
    },
    [clearLayers, fetchClassifiedAreas, fetchHazardAreas, cancelDrawingHazard]
  );

  const flyToBarangay = useCallback(() => {
    if (!selectedBarangayId || !mapRef.current) return;
    const b = barangayList.find((x) => x.barangay_id === selectedBarangayId);
    if (b?.coordinate) mapRef.current.flyTo(b.coordinate, 16, { duration: 1.5 });
  }, [selectedBarangayId, barangayList, mapRef]);

  // ── Effects ─────────────────────────────────────────────────────────────
  useEffect(() => { fetchBarangayList(); }, [fetchBarangayList]);
  useEffect(() => { renderClassifiedAreas(); }, [renderClassifiedAreas]);
  useEffect(() => { renderHazardAreas(); }, [renderHazardAreas]);

  // ── NEW: Update preview when in map edit mode ──────────────────────────
  useEffect(() => {
    if (isMapEditMode) {
      renderEditPreview();
    } else {
      clearEditPreview();
    }
  }, [isMapEditMode, hazardPolygonPoints, renderEditPreview, clearEditPreview]);

  useEffect(() => {
    return () => {
      clearLayers();
      clearHazardDrawing();
      clearEditPreview();
    };
  }, [clearLayers, clearHazardDrawing, clearEditPreview]);

  // ── Cleanup window handlers on unmount ──────────────────────────────────
  useEffect(() => {
    return () => {
      hazardAreas.forEach((area) => {
        delete (window as any)[`__editHazardArea_${area.hazard_area_id}`];
        delete (window as any)[`__deleteHazardArea_${area.hazard_area_id}`];
      });
    };
  }, [hazardAreas]);

  // ── Return API ──────────────────────────────────────────────────────────
  return {
    barangayList, selectedBarangayId, showClassified, showHazards,
    classifiedAreas, hazardAreas, loading,
    selectBarangay, setShowClassified, setShowHazards, flyToBarangay,
    isDrawingHazard, hazardPolygonPoints, completedHazardPolygon,
    isSavingHazard, showHazardForm, editingHazardArea,
    startDrawingHazard, addHazardPoint, removeLastHazardPoint,
    finishDrawingHazard, cancelDrawingHazard,
    createHazardArea, updateHazardArea, deleteHazardArea,
    startEditingHazard, setHazardPolygonPoints,
    setShowHazardForm,
    // NEW: Map Edit Mode
    isMapEditMode,
    startMapEditMode,
    exitMapEditMode,
    addVertexOnMap,
    removeLastVertexOnMap,
  };
}