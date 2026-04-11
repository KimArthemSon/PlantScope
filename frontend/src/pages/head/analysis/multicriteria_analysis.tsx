// src/pages/GISS/multicriteria_analysis/index.tsx

import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Leaf,
  Upload,
  Eye,
  EyeOff,
  Trash2,
  Info,
  Pen,
  MapPin,
  Ruler,
  Layers,
  Palette,
  Flag,
  Building2,
  Pin,
  X,
  CheckCircle,
} from "lucide-react";
import PlantScopeAlert from "@/components/alert/PlantScopeAlert";
import { useState, useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import * as esri from "esri-leaflet";

import { LAND_CLASSIFICATION_COLORS } from "./types/types";
import { useRestrictedAreas } from "./hooks/useRestrictedAreas";
import { useFieldAssessments } from "./hooks/useFieldAssessments";
import type { MCDALayer } from "./hooks/useFieldAssessments";
import FieldAssessmentPanel from "./components/Fieldassessmentpanel ";

import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";

L.Marker.prototype.options.icon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

// Dynamic georaster imports
let parseGeoraster: any;
let GeoRasterLayer: any;

const loadGeoRasterLibs = async () => {
  if (!parseGeoraster) {
    const mod = await import("georaster");
    //mod.parseGeoraster
    parseGeoraster = mod.default || mod;
  }
  if (!GeoRasterLayer) {
    const mod = await import("georaster-layer-for-leaflet");
    GeoRasterLayer = mod.default || mod;
  }
};

interface LayerInfo {
  name: string;
  size: string;
  bounds: { N: string; S: string; E: string; W: string };
  bands?: number;
  dataType?: string;
}

interface AlertState {
  type: "success" | "failed" | "error";
  title: string;
  message: string;
}

type RenderMode = "auto" | "ndvi" | "grayscale" | "rgb";

export default function MulticriteriaAnalysis() {
  const [searchParams] = useSearchParams();
  const areaId = searchParams.get("areaId");
  const siteId = searchParams.get("siteId");
  const navigate = useNavigate();

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const geotiffLayerRef = useRef<any>(null);
  const polygonRef = useRef<L.Polygon | null>(null);
  const currentGeorasterRef = useRef<any>(null);

  const [alert, setAlert] = useState<AlertState | null>(null);
  const [opacity, setOpacity] = useState(0.8);
  const [isLayerVisible, setIsLayerVisible] = useState(true);
  const [uploadStatus, setUploadStatus] = useState("Ready");
  const [layerInfo, setLayerInfo] = useState<LayerInfo | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [polygonArea, setPolygonArea] = useState<number | null>(null);
  const [polygonCoordinates, setPolygonCoordinates] = useState<
    [number, number][]
  >([]);
  const [renderMode, setRenderMode] = useState<RenderMode>("auto");
  const [isPlacingMarker, setIsPlacingMarker] = useState(false);
  const [placedMarkers, setPlacedMarkers] = useState<
    { id: number; latlng: L.LatLng; label: string }[]
  >([]);
  const placedMarkersRef = useRef<Map<number, L.Marker>>(new Map());
  const markerIdCounter = useRef(0);

  // ── restricted areas hook ────────────────────────────────────────────────
  const restricted = useRestrictedAreas(mapRef);

  // ── field assessments hook ─────────────────────────────────────────────────
  const fieldAssessments = useFieldAssessments(mapRef);

  // Merge hook alerts into local alert state
  useEffect(() => {
    if (restricted.alert) {
      setAlert(restricted.alert);
      restricted.clearAlert();
    }
  }, [restricted.alert]);

  // ── Map init ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mapContainerRef.current && !mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current, {
        zoomControl: true,
        attributionControl: true,
      }).setView([11.00860051288406, 124.60859604113544], 15);

      esri.basemapLayer("Imagery").addTo(mapRef.current);
      esri.basemapLayer("ImageryLabels").addTo(mapRef.current);
      L.control
        .scale({ imperial: false, position: "bottomleft" })
        .addTo(mapRef.current);

      loadGeoRasterLibs();

      if (areaId) restricted.fetchAreas(areaId);
      if (areaId) fieldAssessments.fetchLayer(areaId, "safety");

      return () => {
        mapRef.current?.remove();
        mapRef.current = null;
      };
    }
  }, [areaId]);

  // ── Opacity sync ─────────────────────────────────────────────────────────
  useEffect(() => {
    geotiffLayerRef.current?.setOpacity(opacity);
  }, [opacity]);

  // ── Re-render on renderMode change ───────────────────────────────────────
  useEffect(() => {
    if (
      currentGeorasterRef.current &&
      geotiffLayerRef.current &&
      mapRef.current
    ) {
      mapRef.current.removeLayer(geotiffLayerRef.current);
      createGeoRasterLayer(currentGeorasterRef.current);
    }
  }, [renderMode]);

  // ── Color helpers ────────────────────────────────────────────────────────
  const ndviToColor = (ndvi: number) => {
    const v = Math.max(-1, Math.min(1, ndvi));
    if (v < 0) {
      const t = v + 1;
      return `rgba(255, ${Math.round(100 + 155 * t)}, 0, 1)`;
    }
    return `rgba(${Math.round(255 * (1 - v * 0.3))}, ${Math.round(200 + 55 * v)}, ${Math.round(50 * v)}, 1)`;
  };

  const grayscaleToColor = (value: number, min: number, max: number) => {
    if (max === min) return "rgba(128,128,128,1)";
    const g = Math.round(
      Math.max(0, Math.min(1, (value - min) / (max - min))) * 255,
    );
    return `rgba(${g},${g},${g},1)`;
  };

  const autoScaleBand = (value: number, bandIndex: number, georaster: any) => {
    const min = georaster.mins?.[bandIndex] ?? 0;
    const max = georaster.maxes?.[bandIndex] ?? 255;
    return max === min
      ? 128
      : Math.max(
          0,
          Math.min(255, Math.round(((value - min) / (max - min)) * 255)),
        );
  };

  const createColorFunction =
    (georaster: any, mode: RenderMode) =>
    (pixelValues: number[]): string => {
      const valid = pixelValues.filter(
        (v) => v != null && !isNaN(v) && v !== georaster.noDataValue,
      );
      if (!valid.length) return "rgba(0,0,0,0)";

      const numBands = pixelValues.length;
      const alpha =
        numBands >= 4 ? Math.max(0, Math.min(1, pixelValues[3] / 255)) : 1;

      if (mode === "ndvi" || (mode === "auto" && numBands === 1)) {
        const value = pixelValues[0];
        const min = georaster.mins?.[0] ?? -1;
        const max = georaster.maxes?.[0] ?? 1;
        const ndviValue =
          min < -1 || max > 1 ? ((value - min) / (max - min)) * 2 - 1 : value;
        return ndviToColor(ndviValue).replace(", 1)", `, ${alpha})`);
      }

      if (mode === "rgb" || (mode === "auto" && numBands >= 3)) {
        const r = autoScaleBand(pixelValues[0], 0, georaster);
        const g = autoScaleBand(pixelValues[1], 1, georaster);
        const b = autoScaleBand(pixelValues[2], 2, georaster);
        return `rgba(${r},${g},${b},${alpha})`;
      }

      const min = georaster.mins?.[0] ?? 0;
      const max = georaster.maxes?.[0] ?? 255;
      return grayscaleToColor(pixelValues[0], min, max).replace(
        ", 1)",
        `, ${alpha})`,
      );
    };

  const createGeoRasterLayer = (georaster: any) => {
    geotiffLayerRef.current = new GeoRasterLayer({
      georaster,
      opacity,
      resolution: 256,
      resampleMethod: "bilinear",
      pixelValuesToColorFn: createColorFunction(georaster, renderMode),
      debugLevel: 0,
    });
    geotiffLayerRef.current.addTo(mapRef.current!);
    mapRef.current?.fitBounds(geotiffLayerRef.current.getBounds(), {
      padding: [20, 20],
    });
  };

  // ── File upload ──────────────────────────────────────────────────────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !mapRef.current) return;

    try {
      await loadGeoRasterLibs();
      if (typeof parseGeoraster !== "function")
        throw new Error("parseGeoraster failed to load.");

      setUploadStatus("⏳ Reading file...");
      const georaster = await parseGeoraster(await file.arrayBuffer());
      currentGeorasterRef.current = georaster;

      setUploadStatus("⏳ Rendering layer...");
      if (geotiffLayerRef.current)
        mapRef.current.removeLayer(geotiffLayerRef.current);
      createGeoRasterLayer(georaster);
      setIsLayerVisible(true);

      const range = (georaster.maxes?.[0] ?? 0) - (georaster.mins?.[0] ?? 0);
      let dataType = "Unknown";
      if (georaster.numberOfRasters === 1) {
        dataType =
          range <= 2.1 && georaster.mins?.[0] >= -1.5
            ? "NDVI / Index"
            : georaster.maxes?.[0] > 1000
              ? "Elevation / Continuous"
              : "Grayscale";
      } else if (georaster.numberOfRasters >= 3) {
        dataType = "RGB / Multispectral";
      }

      const bounds = geotiffLayerRef.current.getBounds();
      setLayerInfo({
        name: file.name,
        size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
        bounds: {
          N: bounds.getNorth().toFixed(4),
          S: bounds.getSouth().toFixed(4),
          E: bounds.getEast().toFixed(4),
          W: bounds.getWest().toFixed(4),
        },
        bands: georaster.numberOfRasters,
        dataType,
      });

      setRenderMode(
        dataType === "NDVI / Index"
          ? "ndvi"
          : dataType === "RGB / Multispectral"
            ? "rgb"
            : "auto",
      );
      setUploadStatus("✅ Loaded successfully!");
      setAlert({
        type: "success",
        title: "Upload Complete",
        message: `GeoTIFF loaded: ${dataType}.`,
      });
    } catch (err: any) {
      setUploadStatus(`❌ Error: ${err.message}`);
      setAlert({ type: "error", title: "Upload Failed", message: err.message });
    }
  };

  const toggleLayerVisibility = () => {
    if (!geotiffLayerRef.current || !mapRef.current) return;
    isLayerVisible
      ? mapRef.current.removeLayer(geotiffLayerRef.current)
      : geotiffLayerRef.current.addTo(mapRef.current);
    setIsLayerVisible(!isLayerVisible);
  };

  const clearLayer = () => {
    if (geotiffLayerRef.current && mapRef.current) {
      mapRef.current.removeLayer(geotiffLayerRef.current);
      geotiffLayerRef.current = null;
    }
    currentGeorasterRef.current = null;
    setIsLayerVisible(false);
    setLayerInfo(null);
    setUploadStatus("Cleared");
    const input = document.getElementById("geotiff-input") as HTMLInputElement;
    if (input) input.value = "";
  };

  // ── Polygon drawing ──────────────────────────────────────────────────────
  const startDrawing = () => {
    if (!mapRef.current) return;
    setIsDrawing(true);
    setAlert({
      type: "success",
      title: "Drawing Mode",
      message: "Click to place points. Double-click to finish.",
    });

    const coords: [number, number][] = [];

    const onClick = (e: L.LeafletMouseEvent) => {
      coords.push([e.latlng.lat, e.latlng.lng]);
      L.marker(e.latlng, {
        icon: L.divIcon({
          className: "bg-red-500 rounded-full w-3 h-3 border-2 border-white",
          iconSize: [12, 12],
        }),
      }).addTo(mapRef.current!);
    };

    const onDblClick = () => {
      mapRef.current?.off("click", onClick);
      mapRef.current?.off("dblclick", onDblClick);

      if (coords.length < 3) {
        setAlert({
          type: "failed",
          title: "Invalid Polygon",
          message: "Need at least 3 points.",
        });
        setIsDrawing(false);
        return;
      }

      polygonRef.current?.remove();
      polygonRef.current = L.polygon(coords, {
        color: "#0F4A2F",
        fillColor: "#0F4A2F",
        fillOpacity: 0.3,
        weight: 2,
      }).addTo(mapRef.current!);

      polygonRef.current.bindPopup(`
        <strong>Site Polygon</strong><br>Points: ${coords.length}<br>
        <button id="calc-area" style="background:#16a34a;color:white;padding:2px 8px;border-radius:4px;font-size:12px;margin-top:4px;cursor:pointer">
          Calculate Area
        </button>
      `);

      setTimeout(() => {
        document
          .getElementById("calc-area")
          ?.addEventListener("click", () => calculatePolygonArea(coords));
      }, 100);

      setPolygonCoordinates(coords);
      setIsDrawing(false);
      setAlert({
        type: "success",
        title: "Polygon Created",
        message: `${coords.length} points drawn.`,
      });
    };

    mapRef.current.on("click", onClick);
    mapRef.current.on("dblclick", onDblClick);
  };

  const calculatePolygonArea = (coords: [number, number][]) => {
    const latRad =
      ((coords.reduce((s, c) => s + c[0], 0) / coords.length) * Math.PI) / 180;
    const mLat =
      111132.92 - 559.82 * Math.cos(2 * latRad) + 1.175 * Math.cos(4 * latRad);
    const mLng = 111412.84 * Math.cos(latRad) - 93.5 * Math.cos(3 * latRad);
    const local = coords.map(([lat, lng]) => [
      (lng - coords[0][1]) * mLng,
      (lat - coords[0][0]) * mLat,
    ]);

    let area = 0;
    for (let i = 0; i < local.length; i++) {
      const [x1, y1] = local[i];
      const [x2, y2] = local[(i + 1) % local.length];
      area += x1 * y2 - x2 * y1;
    }

    const ha = Math.round((Math.abs(area) / 2 / 10000) * 100) / 100;
    setPolygonArea(ha);
    setAlert({
      type: "success",
      title: "Area Calculated",
      message: `Site area: ${ha.toFixed(2)} hectares`,
    });

    polygonRef.current?.setPopupContent(`
      <strong>Site Polygon</strong><br>
      Points: ${coords.length}<br>
      <strong>Area: ${ha.toFixed(2)} ha</strong>
    `);
  };

  const clearPolygon = () => {
    if (polygonRef.current && mapRef.current) {
      mapRef.current.removeLayer(polygonRef.current);
      polygonRef.current = null;
    }
    setPolygonCoordinates([]);
    setPolygonArea(null);
    setIsDrawing(false);
    mapRef.current?.off("click");
    mapRef.current?.off("dblclick");
  };

  // ── Add Marker mode ──────────────────────────────────────────────────────
  const startPlacingMarker = () => {
    if (!mapRef.current) return;
    setIsPlacingMarker(true);
    mapRef.current.getContainer().style.cursor = "crosshair";

    const handler = (e: L.LeafletMouseEvent) => {
      if (!mapRef.current) return;

      const id = ++markerIdCounter.current;
      const label = `M${id}`;

      const marker = L.marker(e.latlng, {
        icon: L.divIcon({
          className: "placed-marker",
          html: `<div style="
            background:#7C3AED;
            width:28px;height:28px;border-radius:50% 50% 50% 0;
            transform:rotate(-45deg);
            border:3px solid white;
            box-shadow:0 2px 8px rgba(0,0,0,0.3);
            display:flex;align-items:center;justify-content:center;
          ">
            <span style="transform:rotate(45deg);color:white;font-size:9px;font-weight:700;">${label}</span>
          </div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 28],
          popupAnchor: [0, -30],
        }),
        draggable: true,
      }).addTo(mapRef.current);

      marker.bindPopup(`
        <strong>${label}</strong><br/>
        <span style="font-size:11px;font-family:monospace">
          ${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}
        </span><br/>
        <button onclick="window.__removePlacedMarker(${id})"
          style="margin-top:4px;background:#ef4444;color:white;border:none;padding:2px 8px;border-radius:4px;font-size:11px;cursor:pointer">
          Remove
        </button>
      `);

      placedMarkersRef.current.set(id, marker);
      setPlacedMarkers((prev) => [...prev, { id, latlng: e.latlng, label }]);

      mapRef.current.off("click", handler);
      mapRef.current.getContainer().style.cursor = "";
      setIsPlacingMarker(false);
    };

    mapRef.current.on("click", handler);
  };

  const removePlacedMarker = (id: number) => {
    const marker = placedMarkersRef.current.get(id);
    if (marker && mapRef.current) {
      mapRef.current.removeLayer(marker);
      placedMarkersRef.current.delete(id);
    }
    setPlacedMarkers((prev) => prev.filter((m) => m.id !== id));
  };

  const cancelPlacingMarker = () => {
    if (!mapRef.current) return;
    mapRef.current.off("click");
    mapRef.current.getContainer().style.cursor = "";
    setIsPlacingMarker(false);
  };

  if (typeof window !== "undefined") {
    (window as any).__removePlacedMarker = removePlacedMarker;
  }

  // ── Save site ────────────────────────────────────────────────────────────
  const handleSaveSite = async () => {
    if (!polygonCoordinates.length || !areaId) {
      setAlert({
        type: "failed",
        title: "Missing Data",
        message: "Draw a polygon and ensure Area ID is set.",
      });
      return;
    }
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://127.0.0.1:8000/api/create_site/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: `Site-${Date.now().toString().slice(-4)}`,
          reforestation_area_id: parseInt(areaId),
          polygon_coordinates: polygonCoordinates,
          total_area_hectares: polygonArea ?? 0,
          center_coordinate:
            polygonCoordinates.length > 0
              ? [
                  polygonCoordinates.reduce((s, c) => s + c[0], 0) /
                    polygonCoordinates.length,
                  polygonCoordinates.reduce((s, c) => s + c[1], 0) /
                    polygonCoordinates.length,
                ]
              : null,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setAlert({
          type: "success",
          title: "Site Created",
          message: data.message ?? "Saved.",
        });
        setTimeout(
          () =>
            navigate(
              `/GISS/analysis/multicriteria-analysis/${data.site_id}/geo-spatial/`,
            ),
          1500,
        );
      } else {
        setAlert({
          type: "error",
          title: "Save Failed",
          message: data.error ?? "Failed.",
        });
      }
    } catch {
      setAlert({
        type: "error",
        title: "Network Error",
        message: "Could not connect to server.",
      });
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-dvh bg-gray-50 flex-col">
      {alert && (
        <PlantScopeAlert
          type={alert.type}
          title={alert.title}
          message={alert.message}
          onClose={() => setAlert(null)}
        />
      )}

      <header className="bg-gradient-to-r from-[#0F4A2F] to-[#1a6b44] text-white py-3 px-6 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Leaf size={32} className="text-green-300" />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">MCDA Workspace</h1>
              <p className="text-xs text-green-100 opacity-90">
                Area ID: {areaId}{" "}
                {siteId ? `| Site ID: ${siteId}` : "| New Site Creation"}
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate(-1)}
            className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm transition"
          >
            Back to List
          </button>
        </div>
      </header>

      {/* MAIN - Allow page scrolling, remove overflow-hidden */}
      <main className="flex-1 p-3 flex flex-col gap-3">
        {/* ── TOP FILTER BAR ────────────────────────────────────────────────── */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 px-3 py-2 flex flex-wrap gap-2 items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <label className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded cursor-pointer transition text-xs font-medium">
              <Upload size={12} />
              <span>Upload GeoTIFF</span>
              <input
                id="geotiff-input"
                type="file"
                accept=".tif,.tiff"
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>

            <button
              onClick={toggleLayerVisibility}
              disabled={!geotiffLayerRef.current}
              className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded transition text-xs font-medium disabled:opacity-40"
            >
              {isLayerVisible ? <Eye size={12} /> : <EyeOff size={12} />}
              {isLayerVisible ? "Hide" : "Show"}
            </button>

            <button
              onClick={clearLayer}
              disabled={!geotiffLayerRef.current}
              className="flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-3 py-1.5 rounded transition text-xs font-medium disabled:opacity-40"
            >
              <Trash2 size={12} /> Clear TIFF
            </button>

            <div className="w-px h-5 bg-gray-200 mx-0.5" />

            <button
              onClick={isDrawing ? undefined : startDrawing}
              disabled={isDrawing}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition text-xs font-medium
                ${isDrawing ? "bg-green-600 text-white cursor-wait" : "bg-green-600 hover:bg-green-700 text-white"}`}
            >
              <Pen size={12} />
              {isDrawing ? "Drawing..." : "Draw Polygon"}
            </button>

            <button
              onClick={clearPolygon}
              disabled={!polygonCoordinates.length}
              className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded transition text-xs font-medium disabled:opacity-40"
            >
              <Trash2 size={12} /> Clear Poly
            </button>

            <div className="w-px h-5 bg-gray-200 mx-0.5" />

            {isPlacingMarker ? (
              <button
                onClick={cancelPlacingMarker}
                className="flex items-center gap-1.5 bg-purple-600 text-white px-3 py-1.5 rounded text-xs font-medium animate-pulse"
              >
                <X size={12} /> Cancel Marker
              </button>
            ) : (
              <button
                onClick={startPlacingMarker}
                className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded transition text-xs font-medium"
              >
                <Pin size={12} /> Add Marker
              </button>
            )}

            {areaId && (
              <>
                <div className="w-px h-5 bg-gray-200 mx-0.5" />
                <button
                  onClick={restricted.toggleAll}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition text-xs font-medium
                    ${restricted.showAll ? "bg-indigo-600 hover:bg-indigo-700 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-700"}`}
                >
                  <Flag size={12} />
                  {restricted.showAll ? "Hide" : "Show"} Restricted
                </button>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {layerInfo && (
              <div className="flex items-center gap-1 border-r border-gray-200 pr-3 mr-1">
                <Palette size={12} className="text-gray-400" />
                <select
                  value={renderMode}
                  onChange={(e) => setRenderMode(e.target.value as RenderMode)}
                  className="text-xs border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-green-500"
                >
                  <option value="auto">🤖 Auto</option>
                  <option value="ndvi">🌿 NDVI</option>
                  <option value="rgb">🎨 RGB</option>
                  <option value="grayscale">⚪ Gray</option>
                </select>
              </div>
            )}
            <span className="text-xs text-gray-500">Opacity:</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={opacity}
              onChange={(e) => setOpacity(parseFloat(e.target.value))}
              className="w-20 accent-green-600 disabled:opacity-40"
              disabled={!geotiffLayerRef.current}
            />
            <span className="text-xs font-mono w-8 text-right">
              {Math.round(opacity * 100)}%
            </span>
          </div>
        </div>

        {/* ── MAIN CONTENT: Map (left) + Sidebar (right) ───────────────────── */}
        <div className="flex gap-3 flex-1 min-h-0">
          {/* MAP COLUMN - 3/5 width, BIGGER HEIGHT */}
          <div className="flex-[3] flex flex-col gap-2 min-w-0">
            {/* Map container - FIXED: bigger height */}
            <div
              ref={mapContainerRef}
              className={`w-full rounded-lg shadow-inner border-2 relative overflow-hidden transition-all
                ${isPlacingMarker ? "border-purple-400 ring-2 ring-purple-300" : "border-gray-300"}
                h-[65vh] min-h-[450px]`}
            >
              {!mapRef.current && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                  <div className="text-center text-gray-400">
                    <MapPin size={32} className="mx-auto mb-2" />
                    <p className="text-sm">Loading Map...</p>
                  </div>
                </div>
              )}

              {isPlacingMarker && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-purple-700/90 text-white px-4 py-2 rounded-full shadow-lg z-[1000] flex items-center gap-2 text-xs font-medium">
                  <Pin size={12} className="animate-bounce" />
                  Click on map to place marker •{" "}
                  <button onClick={cancelPlacingMarker} className="underline">
                    Cancel
                  </button>
                </div>
              )}

              {restricted.loading && (
                <div className="absolute top-3 right-3 bg-white/95 px-3 py-1.5 rounded-lg shadow-md border border-indigo-200 z-[1000]">
                  <p className="text-xs font-medium text-indigo-700">
                    🔄 Loading restricted areas...
                  </p>
                </div>
              )}

              {isDrawing && (
                <div className="absolute top-3 left-3 bg-white/95 px-3 py-1.5 rounded-lg shadow-md border border-green-200 z-[1000]">
                  <p className="text-xs font-semibold text-green-800">
                    🎯 Drawing Mode
                  </p>
                  <p className="text-[10px] text-gray-600">
                    Click to add • Double-click to finish
                  </p>
                </div>
              )}

              {polygonArea !== null && (
                <div className="absolute bottom-3 left-3 bg-white/95 px-2.5 py-1.5 rounded-lg shadow-md border border-green-200 z-[1000]">
                  <div className="flex items-center gap-1.5">
                    <Ruler size={12} className="text-green-600" />
                    <span className="text-xs font-semibold text-gray-800">
                      {polygonArea.toFixed(2)} ha
                    </span>
                  </div>
                </div>
              )}

              {layerInfo?.dataType === "NDVI / Index" &&
                renderMode !== "grayscale" && (
                  <div className="absolute bottom-3 right-3 bg-white/95 p-2.5 rounded-lg shadow-md border border-green-200 z-[1000]">
                    <p className="text-[10px] font-bold text-gray-700 mb-1.5 flex items-center gap-1">
                      <Leaf size={10} className="text-green-600" /> NDVI
                    </p>
                    <div className="flex items-center gap-1.5 text-[9px]">
                      <div className="w-20 h-2.5 bg-gradient-to-r from-red-500 via-yellow-300 to-green-600 rounded" />
                      <span className="text-gray-500">-1 → +1</span>
                    </div>
                    <div className="flex justify-between text-[8px] text-gray-400 mt-0.5">
                      <span>Bare</span>
                      <span>Dense</span>
                    </div>
                  </div>
                )}
            </div>

            {/* Map status bar */}
            <div className="bg-white rounded-lg border border-gray-200 px-3 py-2 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <Layers size={12} />
                  {geotiffLayerRef.current
                    ? `${layerInfo?.bands ?? "?"} band(s)`
                    : "No TIFF"}
                </span>
                <span className="flex items-center gap-1">
                  <Pen size={12} />
                  {polygonCoordinates.length > 0
                    ? `${polygonCoordinates.length} pts`
                    : "No polygon"}
                </span>
                {placedMarkers.length > 0 && (
                  <span className="flex items-center gap-1 text-purple-600">
                    <Pin size={12} />
                    {placedMarkers.length} marker
                    {placedMarkers.length !== 1 ? "s" : ""}
                  </span>
                )}
                {areaId && restricted.restrictedData && (
                  <span className="flex items-center gap-1 text-indigo-600">
                    <Flag size={12} />
                    {restricted.restrictedData.classified_area?.length ??
                      0}{" "}
                    zones
                  </span>
                )}
              </div>
              <button
                onClick={handleSaveSite}
                disabled={!polygonCoordinates.length || !polygonArea}
                className={`px-4 py-1.5 rounded text-xs font-semibold transition
                  ${
                    polygonCoordinates.length && polygonArea
                      ? "bg-green-600 hover:bg-green-700 text-white"
                      : "bg-gray-200 text-gray-400 cursor-not-allowed"
                  }`}
              >
                💾 Save Site & Continue
              </button>
            </div>
          </div>

          {/* SIDEBAR COLUMN - 2/5 width: GeoTIFF + Restricted + Assessment List */}
          <div className="flex-[2] flex flex-col gap-3 min-w-0">
            {/* GeoTIFF Status */}
            <div className="bg-white rounded-lg border border-gray-200 px-3 py-2 flex-shrink-0">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                  <Info size={13} className="text-blue-500" /> GeoTIFF
                </h3>
                <span
                  className={`text-[10px] font-medium ${uploadStatus.includes("✅") ? "text-green-600" : uploadStatus.includes("❌") ? "text-red-500" : "text-blue-500"}`}
                >
                  {uploadStatus}
                </span>
              </div>
              {layerInfo && (
                <div className="flex gap-2 text-[10px] text-gray-600 flex-wrap">
                  <span className="bg-gray-100 px-1.5 py-0.5 rounded">
                    {layerInfo.dataType}
                  </span>
                  <span className="bg-gray-100 px-1.5 py-0.5 rounded">
                    {layerInfo.bands}B
                  </span>
                  <span className="bg-gray-100 px-1.5 py-0.5 rounded">
                    {layerInfo.size}
                  </span>
                  <span
                    className="bg-gray-100 px-1.5 py-0.5 rounded font-mono truncate max-w-[100px]"
                    title={layerInfo.name}
                  >
                    {layerInfo.name}
                  </span>
                </div>
              )}
            </div>

            {/* Restricted Areas */}
            {areaId && restricted.restrictedData && (
              <div className="bg-white rounded-lg border border-gray-200 px-3 py-2 flex-shrink-0">
                <div className="flex items-center justify-between mb-1.5">
                  <h3 className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                    <Flag size={13} className="text-indigo-500" /> Restricted
                    Zones
                  </h3>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={restricted.toggleReforestation}
                      className={`text-[9px] px-1.5 py-0.5 rounded border transition ${restricted.showReforestation ? "bg-green-100 border-green-300 text-green-700" : "bg-gray-100 border-gray-200 text-gray-400"}`}
                    >
                      🌱
                    </button>
                    <button
                      onClick={restricted.toggleBarangay}
                      className={`text-[9px] px-1.5 py-0.5 rounded border transition ${restricted.showBarangay ? "bg-indigo-100 border-indigo-300 text-indigo-700" : "bg-gray-100 border-gray-200 text-gray-400"}`}
                    >
                      🏢
                    </button>
                    <button
                      onClick={restricted.togglePolygons}
                      className={`text-[9px] px-1.5 py-0.5 rounded border transition ${restricted.showPolygons ? "bg-blue-100 border-blue-300 text-blue-700" : "bg-gray-100 border-gray-200 text-gray-400"}`}
                    >
                      🗺️
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {restricted.restrictedData.classified_area
                    ?.slice(0, 4)
                    .map((area, idx) => {
                      const colors =
                        LAND_CLASSIFICATION_COLORS[
                          area.land_classification_name
                        ] ?? LAND_CLASSIFICATION_COLORS["Default"];
                      return (
                        <span
                          key={idx}
                          className="flex items-center gap-1 text-[9px] bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5"
                        >
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: colors.fill }}
                          />
                          <span className="truncate max-w-[70px]">
                            {area.name}
                          </span>
                        </span>
                      );
                    })}
                  {(restricted.restrictedData.classified_area?.length ?? 0) >
                    4 && (
                    <span className="text-[9px] text-gray-400 px-1">
                      +{restricted.restrictedData.classified_area.length - 4}{" "}
                      more
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Field Assessment LIST - FIXED: Scrollable */}
            <div className="flex-1 bg-white rounded-lg border border-gray-200 flex flex-col min-h-0">
              {/* Header */}
              <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
                <h3 className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                  <Eye size={13} className="text-blue-500" /> Field Assessments
                </h3>
                {areaId && (
                  <button
                    onClick={() =>
                      fieldAssessments.fetchLayer(
                        areaId,
                        fieldAssessments.activeLayer,
                      )
                    }
                    disabled={
                      fieldAssessments.loading[fieldAssessments.activeLayer]
                    }
                    className="text-[10px] text-blue-500 hover:underline disabled:opacity-40 flex items-center gap-0.5"
                  >
                    <Layers
                      size={9}
                      className={
                        fieldAssessments.loading[fieldAssessments.activeLayer]
                          ? "animate-spin"
                          : ""
                      }
                    />
                    Refresh
                  </button>
                )}
              </div>

              {/* Layer tabs */}
              <div className="flex border-b border-gray-100 flex-shrink-0">
                {[
                  {
                    id: "safety" as MCDALayer,
                    label: "Safety",
                    short: "L1",
                    color: "text-red-600",
                    activeBorder: "#dc2626",
                  },
                  {
                    id: "boundary_verification" as MCDALayer,
                    label: "Boundary",
                    short: "L2",
                    color: "text-amber-600",
                    activeBorder: "#d97706",
                  },
                  {
                    id: "survivability" as MCDALayer,
                    label: "Surviv.",
                    short: "L3",
                    color: "text-emerald-600",
                    activeBorder: "#059669",
                  },
                ].map((l) => {
                  const count = fieldAssessments.assessments[l.id]?.length ?? 0;
                  const active = l.id === fieldAssessments.activeLayer;
                  return (
                    <button
                      key={l.id}
                      onClick={() => {
                        fieldAssessments.setActiveLayer(l.id);
                        if (
                          !fieldAssessments.assessments[l.id].length &&
                          areaId
                        ) {
                          fieldAssessments.fetchLayer(areaId, l.id);
                        }
                      }}
                      className={`flex-1 py-2 text-xs font-semibold transition relative border-b-2
                        ${active ? `${l.color} border-current` : "text-gray-400 border-transparent hover:text-gray-600"}`}
                    >
                      {l.short}
                      {count > 0 && (
                        <span className="ml-1 text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Assessment list - FIXED: Scrollable with overflow-y-auto */}
              <div className="flex-1 overflow-y-auto min-h-0">
                {!areaId ? (
                  <div className="p-4 text-center text-gray-400">
                    <p className="text-xs">No area selected</p>
                  </div>
                ) : fieldAssessments.loading[fieldAssessments.activeLayer] ? (
                  <div className="p-4 text-center text-gray-400">
                    <p className="text-xs">Loading...</p>
                  </div>
                ) : (
                    fieldAssessments.assessments[
                      fieldAssessments.activeLayer
                    ] ?? []
                  ).length === 0 ? (
                  <div className="p-4 text-center text-gray-400">
                    <p className="text-xs">No assessments</p>
                    <button
                      onClick={() =>
                        areaId &&
                        fieldAssessments.fetchLayer(
                          areaId,
                          fieldAssessments.activeLayer,
                        )
                      }
                      className="mt-2 text-xs text-blue-500 hover:underline"
                    >
                      Try again
                    </button>
                  </div>
                ) : (
                  (
                    fieldAssessments.assessments[
                      fieldAssessments.activeLayer
                    ] ?? []
                  ).map((entry, idx) => {
                    const isSelected = idx === fieldAssessments.selectedIndex;
                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          fieldAssessments.setSelectedIndex(idx);
                          fieldAssessments.flyToMarker(
                            fieldAssessments.activeLayer,
                            idx,
                          );
                        }}
                        className={`w-full text-left px-3 py-2.5 border-b border-gray-50 transition
                          ${isSelected ? "bg-blue-50 border-l-2 border-l-blue-500" : "hover:bg-gray-50"}`}
                      >
                        <div className="flex items-center gap-2">
                          {entry.profile_image && (
                            <img
                              src={`http://127.0.0.1:8000${entry.profile_image}`}
                              alt=""
                              className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-gray-200"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display =
                                  "none";
                              }}
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-xs font-semibold text-gray-800 truncate">
                                {entry.full_name}
                              </span>
                              <span className="text-[10px] font-bold text-gray-400 flex-shrink-0">
                                F{idx + 1}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-gray-500">
                                {entry.field_assessment_data.assessment_date}
                              </span>
                              {entry.field_assessment_data.images?.length >
                                0 && (
                                <span className="text-[10px] text-blue-500 flex items-center gap-0.5">
                                  📷 {entry.field_assessment_data.images.length}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── BOTTOM ROW: Site List (coming soon) + Assessment Detail ──────── */}
        <div className="flex gap-3">
          {/* Coming soon */}
          <div className=" w-[50%] bg-white rounded-lg border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-center p-4 min-h-[120px]">
            <div className="bg-gray-100 p-3 rounded-full mb-2">
              <Layers size={20} className="text-gray-400" />
            </div>
            <h3 className="font-bold text-gray-600 text-sm">Site List</h3>
            <p className="text-xs text-gray-400 mt-1">
              View and manage all sites
            </p>
            <span className="mt-2 px-2.5 py-1 bg-yellow-100 text-yellow-700 text-xs font-bold rounded-full">
              Coming Soon
            </span>
          </div>

          {/* Assessment Detail Panel */}
          <div className="w-[45%]">
            {fieldAssessments.selectedIndex === null ||
            !(fieldAssessments.assessments[fieldAssessments.activeLayer] ?? [])
              .length ? (
              <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-400 min-h-[120px] flex items-center justify-center">
                <div>
                  <CheckCircle size={32} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">
                    Select an assessment to view details
                  </p>
                </div>
              </div>
            ) : (
              <FieldAssessmentPanel
                areaId={areaId}
                assessments={fieldAssessments.assessments}
                loading={fieldAssessments.loading}
                activeLayer={fieldAssessments.activeLayer}
                selectedIndex={fieldAssessments.selectedIndex}
                onLayerChange={(layer: MCDALayer) => {
                  fieldAssessments.setActiveLayer(layer);
                  if (!fieldAssessments.assessments[layer].length && areaId) {
                    fieldAssessments.fetchLayer(areaId, layer);
                  }
                }}
                onSelectEntry={(idx) => {
                  fieldAssessments.setSelectedIndex(idx);
                  fieldAssessments.flyToMarker(
                    fieldAssessments.activeLayer,
                    idx,
                  );
                }}
                onFetchLayer={(layer: MCDALayer) => {
                  if (areaId) fieldAssessments.fetchLayer(areaId, layer);
                }}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
