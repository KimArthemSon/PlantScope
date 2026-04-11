// src/pages/GISS/multicriteria_analysis/hooks/useRestrictedAreas.ts
import { useState, useRef, useCallback } from "react";
import L from "leaflet";
import type { RestrictedAreaResponse, MapLayerState } from "../types/types";
import { LAND_CLASSIFICATION_COLORS, geoJSONPolygonToLatLngs } from "../types/types";

interface AlertState {
  type: "success" | "failed" | "error";
  title: string;
  message: string;
}

const createCustomIcon = (color: string, emoji: string) =>
  L.divIcon({
    className: "custom-marker",
    html: `<div style="
      background: ${color};
      width: 32px; height: 32px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      display: flex; align-items: center; justify-content: center;
      font-size: 16px;
    ">${emoji}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });

export function useRestrictedAreas(mapRef: React.RefObject<L.Map | null>) {
  const layersRef = useRef<MapLayerState>({
    reforestationMarker: null,
    barangayMarker: null,
    classifiedPolygons: new Map(),
  });

  const [restrictedData, setRestrictedData] =
    useState<RestrictedAreaResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<AlertState | null>(null);

  // Visibility state
  const [showAll, setShowAll] = useState(true);
  const [showReforestation, setShowReforestation] = useState(true);
  const [showBarangay, setShowBarangay] = useState(true);
  const [showPolygons, setShowPolygons] = useState(true);

  // ─── helpers ────────────────────────────────────────────────────────────

  const addOrRemove = (
    layer: L.Layer | null,
    visible: boolean,
    map: L.Map
  ) => {
    if (!layer) return;
    visible ? layer.addTo(map) : map.removeLayer(layer);
  };

  const clearLayers = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const { reforestationMarker, barangayMarker, classifiedPolygons } =
      layersRef.current;

    if (reforestationMarker) map.removeLayer(reforestationMarker);
    if (barangayMarker) map.removeLayer(barangayMarker);
    classifiedPolygons.forEach((p) => map.removeLayer(p));

    layersRef.current = {
      reforestationMarker: null,
      barangayMarker: null,
      classifiedPolygons: new Map(),
    };
  }, [mapRef]);

  // ─── render ─────────────────────────────────────────────────────────────

  const renderAreas = useCallback(
    (data: RestrictedAreaResponse) => {
      const map = mapRef.current;
      if (!map) return;

      clearLayers();

      // 🌱 Reforestation marker
      if (data.reforestation_area?.coordinate) {
        const [lat, lng] = data.reforestation_area.coordinate;
        const marker = L.marker([lat, lng], {
          icon: createCustomIcon("#0F4A2F", "🌱"),
        }).addTo(map);

        marker.bindPopup(`
          <div style="font-weight:bold;color:#1B5E20">🌱 ${data.reforestation_area.name}</div>
          <div style="font-size:12px;color:#555;margin-top:4px">${data.reforestation_area.description}</div>
          <div style="font-size:10px;color:#999;margin-top:6px">Coord: ${lat.toFixed(4)}, ${lng.toFixed(4)}</div>
        `);

        layersRef.current.reforestationMarker = marker;
        if (!showReforestation) map.removeLayer(marker);
      }

      // 🏢 Barangay marker
      if (data.barangay?.coordinate) {
        const [lat, lng] = data.barangay.coordinate;
        const marker = L.marker([lat, lng], {
          icon: createCustomIcon("#5C6BC0", "🏢"),
        }).addTo(map);

        marker.bindPopup(`
          <div style="font-weight:bold;color:#3949AB">🏢 ${data.barangay.name}</div>
          <div style="font-size:12px;color:#555;margin-top:4px">${data.barangay.description}</div>
          <div style="font-size:10px;color:#999;margin-top:6px">Coord: ${lat.toFixed(4)}, ${lng.toFixed(4)}</div>
        `);

        layersRef.current.barangayMarker = marker;
        if (!showBarangay) map.removeLayer(marker);
      }

      // 🗺️ Classified area polygons
      data.classified_area?.forEach((area) => {
        try {
          const latlngs = geoJSONPolygonToLatLngs(area.polygon);

          if (latlngs.length < 3) {
            console.warn(`Skipping ${area.name}: fewer than 3 valid points`);
            return;
          }

          const colors =
            LAND_CLASSIFICATION_COLORS[area.land_classification_name] ??
            LAND_CLASSIFICATION_COLORS["Default"];

          const polygon = L.polygon(latlngs, {
            color: colors.stroke,
            fillColor: colors.fill,
            fillOpacity: 0.35,
            weight: 2,
          }).addTo(map);

          polygon.bindPopup(`
            <div style="font-weight:bold;color:${colors.stroke}">${area.land_classification_name}</div>
            <div style="font-weight:600;margin-top:4px">${area.name}</div>
            <div style="font-size:12px;color:#555;margin-top:4px">${area.description}</div>
            <div style="font-size:10px;color:#999;margin-top:6px;border-top:1px solid #eee;padding-top:4px">
              Points: ${latlngs.length}
            </div>
          `);

          // Use name+index as key to avoid collisions on duplicate names
          const key = `${area.name}-${layersRef.current.classifiedPolygons.size}`;
          layersRef.current.classifiedPolygons.set(key, polygon);

          if (!showPolygons) map.removeLayer(polygon);
        } catch (err) {
          console.error(`Error rendering polygon for "${area.name}":`, err);
        }
      });

      if (!showAll) {
        applyVisibility(false, false, false, false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mapRef, clearLayers]
  );

  // ─── fetch ───────────────────────────────────────────────────────────────

  const fetchAreas = useCallback(
    async (areaId: string) => {
      if (!mapRef.current) return;
      setLoading(true);

      try {
        const token = localStorage.getItem("token");
        const res = await fetch(
          `http://127.0.0.1:8000/api/area/${areaId}/restricted/`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (!res.ok) throw new Error(`Server error: ${res.status}`);

        const raw = await res.json();
        // Normalize API typo: backend sends "reforestation_aree" (double-e)
        const data: RestrictedAreaResponse = {
          ...raw,
          reforestation_area: raw.reforestation_area ?? raw.reforestation_aree,
        };
        setRestrictedData(data);
        renderAreas(data);

        // Center on reforestation area
        if (data.reforestation_area?.coordinate) {
          const [lat, lng] = data.reforestation_area.coordinate;
          mapRef.current?.setView([lat, lng], 14);
        }

        setAlert({
          type: "success",
          title: "Restricted Areas Loaded",
          message: `Loaded ${data.classified_area?.length ?? 0} classified zones`,
        });
      } catch (err: any) {
        console.error("fetchAreas error:", err);
        setAlert({
          type: "error",
          title: "Load Failed",
          message: err.message ?? "Could not load restricted area data",
        });
      } finally {
        setLoading(false);
      }
    },
    [mapRef, renderAreas]
  );

  // ─── visibility helpers ──────────────────────────────────────────────────

  const applyVisibility = (
    all: boolean,
    reforestation: boolean,
    barangay: boolean,
    polygons: boolean
  ) => {
    const map = mapRef.current;
    if (!map) return;
    const { reforestationMarker, barangayMarker, classifiedPolygons } =
      layersRef.current;

    addOrRemove(reforestationMarker, all && reforestation, map);
    addOrRemove(barangayMarker, all && barangay, map);
    classifiedPolygons.forEach((p) => addOrRemove(p, all && polygons, map));
  };

  const toggleAll = () => {
    const next = !showAll;
    setShowAll(next);
    applyVisibility(next, showReforestation, showBarangay, showPolygons);
  };

  const toggleReforestation = () => {
    const next = !showReforestation;
    setShowReforestation(next);
    addOrRemove(
      layersRef.current.reforestationMarker,
      showAll && next,
      mapRef.current!
    );
  };

  const toggleBarangay = () => {
    const next = !showBarangay;
    setShowBarangay(next);
    addOrRemove(
      layersRef.current.barangayMarker,
      showAll && next,
      mapRef.current!
    );
  };

  const togglePolygons = () => {
    const next = !showPolygons;
    setShowPolygons(next);
    layersRef.current.classifiedPolygons.forEach((p) =>
      addOrRemove(p, showAll && next, mapRef.current!)
    );
  };

  return {
    // data
    restrictedData,
    loading,
    alert,
    clearAlert: () => setAlert(null),

    // actions
    fetchAreas,
    clearLayers,

    // visibility state + toggles
    showAll,
    showReforestation,
    showBarangay,
    showPolygons,
    toggleAll,
    toggleReforestation,
    toggleBarangay,
    togglePolygons,
  };
}