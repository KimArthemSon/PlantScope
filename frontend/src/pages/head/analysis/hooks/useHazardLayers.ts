import { useState, useRef, useEffect, useCallback } from "react";
import L from "leaflet";
import { api, api_second } from "@/constant/api";

export type FirmsTimeRange = "today" | "24hrs" | "7days";

export interface HazardLayersState {
  // Official Gov Maps
  showMgbFlood: boolean;
  setShowMgbFlood: (v: boolean) => void;
  showMgbLandslide: boolean;
  setShowMgbLandslide: (v: boolean) => void;
  showEil: boolean;
  setShowEil: (v: boolean) => void;

  // NASA FIRMS
  showFirms: boolean;
  setShowFirms: (v: boolean) => void;
  fireCount: number;
  firmsTimeRange: FirmsTimeRange;
  setFirmsTimeRange: (v: FirmsTimeRange) => void;

  // Panel
  isPanelOpen: boolean;
  setIsPanelOpen: (v: boolean) => void;

  // Actions
  toggleFirms: () => void;
  updateFirmsTimeRange: (range: FirmsTimeRange) => void;
  fetchFirmsData: (range?: FirmsTimeRange) => Promise<void>;
}

export function useHazardLayers(
  mapRef: React.MutableRefObject<L.Map | null>,
): HazardLayersState {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  // ── State ────────────────────────────────────────────────────────────────
  const [showMgbFlood, setShowMgbFlood] = useState(false);
  const [showMgbLandslide, setShowMgbLandslide] = useState(false);
  const [showEil, setShowEil] = useState(false);
  const [showFirms, setShowFirms] = useState(false);
  const [fireCount, setFireCount] = useState(0);
  const [firmsTimeRange, setFirmsTimeRange] = useState<FirmsTimeRange>("today");
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  // ── Layer Refs ───────────────────────────────────────────────────────────
  const mgbFloodLayerRef = useRef<L.TileLayer | null>(null);
  const mgbLandslideLayerRef = useRef<L.TileLayer | null>(null);
  const eilLayerRef = useRef<L.TileLayer.WMS | null>(null);
  const firmsLayerRef = useRef<L.GeoJSON | null>(null);

  // ── URLs ─────────────────────────────────────────────────────────────────
  const MGB_FLOOD_TILE_URL =
    "https://controlmap.mgb.gov.ph/arcgis/rest/services/GeospatialDataInventory/GDI_Detailed_Flood_Susceptibility/MapServer/tile/{z}/{y}/{x}";
  const MGB_LANDSLIDE_TILE_URL =
    "https://controlmap.mgb.gov.ph/arcgis/rest/services/GeospatialDataInventory/GDI_Detailed_Rain_induced_Landslide_Susceptibility/MapServer/tile/{z}/{y}/{x}";
  const PHIVOLCS_EIL_WMS_URL =
    "https://gisweb.phivolcs.dost.gov.ph/arcgis/services/PHIVOLCSPublic/EarthquakeInducedLandslide/MapServer/WMSServer";

  // ── Helper: Remove layer safely ──────────────────────────────────────────
  const removeLayer = (layerRef: React.MutableRefObject<any>) => {
    if (layerRef.current && mapRef.current) {
      mapRef.current.removeLayer(layerRef.current);
      layerRef.current = null;
    }
  };

  // ── MGB Flood Toggle ─────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (showMgbFlood) {
      if (!mgbFloodLayerRef.current) {
        mgbFloodLayerRef.current = L.tileLayer(MGB_FLOOD_TILE_URL, {
          opacity: 0.75,
          maxZoom: 19,
          maxNativeZoom: 17,
          attribution: "Flood Susceptibility &copy; MGB Philippines",
          errorTileUrl:
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
        }).addTo(map);
      }
    } else {
      removeLayer(mgbFloodLayerRef);
    }

    return () => {
      removeLayer(mgbFloodLayerRef);
    };
  }, [showMgbFlood, mapRef.current]);

  // ── MGB Landslide Toggle ─────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (showMgbLandslide) {
      if (!mgbLandslideLayerRef.current) {
        mgbLandslideLayerRef.current = L.tileLayer(MGB_LANDSLIDE_TILE_URL, {
          opacity: 0.75,
          maxZoom: 19,
          maxNativeZoom: 17,
          attribution: "Landslide Susceptibility &copy; MGB Philippines",
          errorTileUrl:
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
        }).addTo(map);
      }
    } else {
      removeLayer(mgbLandslideLayerRef);
    }

    return () => {
      removeLayer(mgbLandslideLayerRef);
    };
  }, [showMgbLandslide, mapRef.current]);

  // ── PHIVOLCS EIL Toggle ──────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (showEil) {
      if (!eilLayerRef.current) {
        eilLayerRef.current = L.tileLayer.wms(PHIVOLCS_EIL_WMS_URL, {
          layers: "0",
          format: "image/png",
          transparent: true,
          opacity: 0.75,
          attribution: "Earthquake-Induced Landslide &copy; PHIVOLCS",
          version: "1.3.0",
          crs: L.CRS.EPSG4326 as any,
          maxZoom: 19,
          maxNativeZoom: 17,
        }).addTo(map);
      }
    } else {
      removeLayer(eilLayerRef);
    }

    return () => {
      removeLayer(eilLayerRef);
    };
  }, [showEil, mapRef.current]);

  // ── FIRMS: Fetch fire data ───────────────────────────────────────────────
  const fetchFirmsData = useCallback(
    async (range?: FirmsTimeRange) => {
      const map = mapRef.current;
      if (!map) return;

      const effectiveRange = range || firmsTimeRange;

      try {
        const bounds = map.getBounds();
        const bbox = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`;

        const response = await fetch(api+"api/firms-fire-data/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: token ? `Bearer ${token}` : "",
          },
          body: JSON.stringify({
            bbox,
            time_range: effectiveRange,
          }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);

        if (data.success) {
          setFireCount(data.fire_count || 0);

          // Remove old layer
          removeLayer(firmsLayerRef);

          if (data.fires && Array.isArray(data.fires) && data.fires.length > 0) {
            const geoJsonData = {
              type: "FeatureCollection" as const,
              features: data.fires.map((fire: any) => ({
                type: "Feature" as const,
                geometry: {
                  type: "Point" as const,
                  coordinates: [fire.longitude, fire.latitude],
                },
                properties: fire,
              })),
            };

            firmsLayerRef.current = L.geoJSON(geoJsonData, {
              pointToLayer: (feature, latlng) => {
                const confidence = feature.properties.confidence?.toLowerCase();
                let color = "#ff6600";
                let radius = 5;

                if (confidence === "h" || confidence === "high") {
                  color = "#dc2626";
                  radius = 7;
                } else if (confidence === "l" || confidence === "low") {
                  color = "#fbbf24";
                  radius = 4;
                }

                return L.circleMarker(latlng, {
                  radius,
                  fillColor: color,
                  color: "#fff",
                  weight: 2,
                  opacity: 1,
                  fillOpacity: 0.8,
                });
              },
              onEachFeature: (feature, layer) => {
                const p = feature.properties;
                const confidenceLabel =
                  p.confidence === "h" || p.confidence === "high"
                    ? "🔴 High"
                    : p.confidence === "l" || p.confidence === "low"
                      ? "🟡 Low"
                      : "🟠 Nominal";

                layer.bindPopup(`
                  <div style="font-size: 12px; min-width: 200px;">
                    <strong style="color: #dc2626; font-size: 14px;">🔥 Fire Hotspot</strong>
                    <hr style="margin: 6px 0; border-color: #ddd;"/>
                    <div><strong>📍 Location:</strong> ${p.latitude.toFixed(4)}, ${p.longitude.toFixed(4)}</div>
                    <div><strong>🌡️ Brightness:</strong> ${p.brightness ? p.brightness.toFixed(1) : "N/A"} K</div>
                    <div><strong>🔥 FRP:</strong> ${p.frp || "N/A"} GW</div>
                    <div><strong>📊 Confidence:</strong> ${confidenceLabel}</div>
                    <div><strong>📅 Date:</strong> ${p.acq_date || "N/A"}</div>
                    <div><strong>⏰ Time:</strong> ${p.acq_time || "N/A"}</div>
                    <div><strong>🛰️ Satellite:</strong> ${p.satellite} (${p.instrument})</div>
                  </div>
                `);
              },
            }).addTo(map);
          }
        }
      } catch (error: any) {
        console.error("FIRMS fetch error:", error);
        setFireCount(0);
      }
    },
    [firmsTimeRange, mapRef.current, token],
  );

  // ── FIRMS: Toggle ────────────────────────────────────────────────────────
  const toggleFirms = useCallback(() => {
    const newState = !showFirms;
    setShowFirms(newState);

    if (!newState) {
      removeLayer(firmsLayerRef);
      setFireCount(0);
    } else {
      setTimeout(() => fetchFirmsData(), 300);
    }
  }, [showFirms, fetchFirmsData]);

  // ── FIRMS: Update time range ─────────────────────────────────────────────
  const updateFirmsTimeRange = useCallback(
    (range: FirmsTimeRange) => {
      setFirmsTimeRange(range);
      if (showFirms) {
        removeLayer(firmsLayerRef);
        setTimeout(() => fetchFirmsData(range), 200);
      }
    },
    [showFirms, fetchFirmsData],
  );

  // ── Cleanup on unmount ───────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      removeLayer(mgbFloodLayerRef);
      removeLayer(mgbLandslideLayerRef);
      removeLayer(eilLayerRef);
      removeLayer(firmsLayerRef);
    };
  }, []);

  return {
    showMgbFlood,
    setShowMgbFlood,
    showMgbLandslide,
    setShowMgbLandslide,
    showEil,
    setShowEil,
    showFirms,
    setShowFirms,
    fireCount,
    firmsTimeRange,
    setFirmsTimeRange,
    isPanelOpen,
    setIsPanelOpen,
    toggleFirms,
    updateFirmsTimeRange,
    fetchFirmsData,
  };
}