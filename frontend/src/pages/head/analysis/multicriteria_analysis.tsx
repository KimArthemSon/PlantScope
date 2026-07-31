import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Leaf,
  Trash2,
  Info,
  Pen,
  MapPin,
  Ruler,
  Layers,
  X,
  CheckCircle,
  Save,
  Undo2,
  Target,
  Shield,
  Edit3,
  Loader2,
  Navigation,
  Eye,
  Plus,
} from "lucide-react";

import PlantScopeAlert from "@/components/alert/PlantScopeAlert";
import PlantScopeConfirm from "@/components/alert/PlantScopeConfirm";
import SiteCoordinatesEditor from "./components/SiteCoordinatesEditor";
import BarangayAreasPanel from "./BarangayAreasPanel";
import FieldAssessmentPanel from "./components/Fieldassessmentpanel";
import HazardAssessmentPanel from "./components/HazardAssessmentPanel";
import SiteList from "./components/SiteList";
import SiteValidationPanel from "./components/SiteValidationPanel";
import HazardAreaFormPanel from "./components/HazardAreaFormPanel";

import { api_second } from "@/constant/api";
import { useBarangayAreas } from "./hooks/useBarangayAreas";
import { usePotentialSites } from "./hooks/usePotentialSites";
import type { PotentialSite } from "./hooks/usePotentialSites";
import { useFieldAssessments } from "./hooks/useFieldAssessments";
import type {
  MCDALayer,
  FieldAssessmentEntry,
} from "./hooks/useFieldAssessments";
import { useHazardLayers } from "./hooks/useHazardLayers";
import { useSites } from "./hooks/useSites";
import type { Site, SiteDetail } from "./hooks/useSites";

import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

L.Marker.prototype.options.icon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

// ── Marker Factory Function ─────────────────────────────────────────────
const createMarkerIcon = (
  type: "barangay" | "reforestation" | "site" | "temp",
  labelText: string = "",
) => {
  let color = "#9CA3AF";
  let iconSvg = "";

  switch (type) {
    case "barangay":
      color = "#EAB308";
      iconSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4 8 4v14"/><path d="M9 21v-6h6v6"/><path d="M9 9h.01"/><path d="M16 9h.01"/><path d="M9 13h.01"/><path d="M16 13h.01"/></svg>`;
      break;
    case "reforestation":
      color = "#3B82F6";
      iconSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22v-8"/><path d="M12 14c-4 0-7-3-7-7 0-2 2-4 4-4 1 0 2 .5 3 1 1-.5 2-1 3-1 2 0 4 2 4 4 0 4-3 7-7 7z"/></svg>`;
      break;
    case "site":
      color = "#22C55E";
      iconSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/></svg>`;
      break;
    case "temp":
      color = "#EF4444";
      iconSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`;
      break;
  }

  const labelHtml = labelText
    ? `<span style="font-size: 11px; font-weight: 600; color: #1f2937; background: rgba(255, 255, 255, 0.95); padding: 2px 8px; border-radius: 4px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15); white-space: nowrap; max-width: 200px; overflow: hidden; text-overflow: ellipsis;">${labelText}</span>`
    : "";

  const estimatedWidth = labelText
    ? Math.min(24 + 6 + labelText.length * 7 + 16, 250)
    : 24;

  return L.divIcon({
    className: "custom-map-marker",
    html: `
      <div style="display: flex; align-items: center; gap: 6px;">
        <div style="position: relative; width: 24px; height: 30px; flex-shrink: 0;">
          <svg width="24" height="30" viewBox="0 0 24 30" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
            <path d="M12 0C5.373 0 0 5.373 0 12C0 18.627 12 30 12 30C12 30 24 18.627 24 12C24 5.373 18.627 0 12 0Z" 
                  fill="${color}" stroke="white" stroke-width="2"/>
          </svg>
          <div style="position: absolute; top: 7px; left: 6px; display: flex; align-items: center; justify-content: center;">
            ${iconSvg}
          </div>
        </div>
        ${labelHtml}
      </div>
    `,
    iconSize: [estimatedWidth, 30],
    iconAnchor: [estimatedWidth / 2, 30],
    popupAnchor: [0, -30],
  });
};

interface AlertState {
  type: "success" | "failed" | "error";
  title: string;
  message: string;
}

export default function MulticriteriaAnalysis() {
  const [searchParams] = useSearchParams();
  const areaId = searchParams.get("areaId");
  const siteId = searchParams.get("siteId");

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const polygonRef = useRef<L.Polygon | null>(null);
  const locationTempMarkerRef = useRef<L.Marker | null>(null);
  const barangayMarkersRef = useRef<L.Marker[]>([]);
  const siteMarkersRef = useRef<L.Marker[]>([]);
  const areaMarkerRef = useRef<L.Marker | null>(null);

  const [viewingSite, setViewingSite] = useState<SiteDetail | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedPolygon, setEditedPolygon] = useState<[number, number][] | null>(
    null,
  );
  const [editedCenter, setEditedCenter] = useState<[number, number] | null>(
    null,
  );
  const [isSavingCoordinates, setIsSavingCoordinates] = useState(false);
  const [showCoordinateModal, setShowCoordinateModal] = useState(false);

  const editablePolygonRef = useRef<L.Polygon | null>(null);
  const vertexMarkersRef = useRef<L.Marker[]>([]);
  const addVertexMarkersRef = useRef<L.Marker[]>([]);
  const editableCenterMarkerRef = useRef<L.Marker | null>(null);

  const [isDrawingNewPolygon, setIsDrawingNewPolygon] = useState(false);
  const [newPolygonPoints, setNewPolygonPoints] = useState<[number, number][]>(
    [],
  );
  const [isPlacingNewCenter, setIsPlacingNewCenter] = useState(false);
  const newPolygonMarkersRef = useRef<L.Marker[]>([]);
  const newPolygonLineRef = useRef<L.Polyline | null>(null);

  const renderAllMarkersRef = useRef<(coords: [number, number][]) => void>(
    () => {},
  );

  const [alert, setAlert] = useState<AlertState | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    variant: "danger" | "warning";
    confirmLabel: string;
    onConfirm: () => void;
  } | null>(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [polygonArea, setPolygonArea] = useState<number | null>(null);
  const [polygonCoordinates, setPolygonCoordinates] = useState<
    [number, number][]
  >([]);

  const [showCoordPanel, setShowCoordPanel] = useState(true);

  const drawingLineRef = useRef<L.Polyline | null>(null);
  const drawingPointsRef = useRef<L.Marker[]>([]);

  const [isPlacingMarker, setIsPlacingMarker] = useState(false);

  const [showPotentialSites, setShowPotentialSites] = useState(false);
  const potentialSiteLayersRef = useRef<L.Polygon[]>([]);

  const [showSites, setShowSites] = useState(true);
  const [showReforestationArea, setShowReforestationArea] = useState(true);

  const [showValidationPanel, setShowValidationPanel] = useState(false);
  const [validatingSite, setValidatingSite] = useState<SiteDetail | null>(null);

  const [assessmentType, setAssessmentType] = useState<
    "specific" | "general" | "all"
  >("all");
  const [selectedSiteIdForFilter, setSelectedSiteIdForFilter] = useState<
    string | null
  >(null);
  const [siteName, setSiteName] = useState("");
  const [showNameInput, setShowNameInput] = useState(false);

  const fieldAssessments = useFieldAssessments(mapRef);
  const sites = useSites();
  const potentialSitesHook = usePotentialSites();
  const hazardLayers = useHazardLayers(mapRef);
  const barangayAreas = useBarangayAreas(mapRef);

  // ── FIELD ASSESSMENT LOCATION PICKER STATE ────────────────────────────
  const tempFaLocationMarkerRef = useRef<L.Marker | null>(null);
  const [tempFaLocationCoords, setTempFaLocationCoords] = useState<
    [number, number] | null
  >(null);

  // ✅ BULLETPROOF FIX: Ignore map clicks that happen immediately after button clicks
  const isProcessingActionRef = useRef(false);

  const updateTempFaLocationMarker = useCallback((coords: [number, number]) => {
    if (!mapRef.current) return;
    if (tempFaLocationMarkerRef.current) {
      tempFaLocationMarkerRef.current.setLatLng(coords);
    } else {
      const icon = L.divIcon({
        className: "temp-fa-location-marker",
        html: `<div style="background:#F97316;width:24px;height:24px;border-radius:50%;border:4px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;"><div style="width:8px;height:8px;background:white;border-radius:50%;"></div></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 24],
      });
      tempFaLocationMarkerRef.current = L.marker(coords, { icon }).addTo(
        mapRef.current,
      );
    }
  }, []);

  const handleMapClickForFaLocation = useCallback(
    (e: L.LeafletMouseEvent) => {
      // ✅ If we just clicked a button, ignore this map click entirely
      if (isProcessingActionRef.current) {
        isProcessingActionRef.current = false; // Reset for next time
        return;
      }

      const coords: [number, number] = [e.latlng.lat, e.latlng.lng];
      setTempFaLocationCoords(coords);
      updateTempFaLocationMarker(coords);
    },
    [updateTempFaLocationMarker],
  );

  // Cleanup effect for FA location picking
  useEffect(() => {
    if (!fieldAssessments.locationTargetId) {
      if (tempFaLocationMarkerRef.current && mapRef.current) {
        mapRef.current.removeLayer(tempFaLocationMarkerRef.current);
        tempFaLocationMarkerRef.current = null;
      }
      setTempFaLocationCoords(null);
    }
  }, [fieldAssessments.locationTargetId]);

  const handleFetchLayer = useCallback(
    (
      layer: MCDALayer,
      overrideType?: "specific" | "general" | "all",
      overrideSiteId?: string | null,
    ) => {
      if (areaId) {
        const typeToUse = overrideType ?? assessmentType;
        const siteIdToPass =
          typeToUse === "specific"
            ? overrideSiteId !== undefined
              ? overrideSiteId
              : selectedSiteIdForFilter
            : null;
        fieldAssessments.fetchLayer(
          areaId,
          layer,
          typeToUse,
          siteIdToPass || undefined,
        );
      }
    },
    [areaId, assessmentType, selectedSiteIdForFilter, fieldAssessments],
  );

  const handleViewSite = useCallback(
    async (site: Site) => {
      try {
        const detail = await sites.fetchSiteDetail(site.site_id);
        if (detail) {
          setViewingSite(detail);
          if (polygonRef.current) {
            mapRef.current?.removeLayer(polygonRef.current);
            polygonRef.current = null;
          }
          if (
            detail.polygon_coordinates &&
            detail.polygon_coordinates.length > 0
          ) {
            polygonRef.current = L.polygon(detail.polygon_coordinates, {
              color: "#22C55E",
              fillColor: "#81C784",
              fillOpacity: 0.6,
              weight: 4,
            }).addTo(mapRef.current!);
            mapRef.current?.fitBounds(polygonRef.current.getBounds(), {
              padding: [50, 50],
            });
          } else if (detail.center_coordinate) {
            const centerMarker = L.marker(detail.center_coordinate, {
              icon: createMarkerIcon("site", detail.name),
            }).addTo(mapRef.current!);
            centerMarker.bindPopup(`
            <div style="text-align:center;font-family:sans-serif;">
              <strong style="color:#22C55E;font-size:14px;">${detail.name}</strong><br/>
              <span style="font-size:11px;color:#666;">Center Location</span><br/>
              <span style="font-size:10px;color:#999;font-family:monospace;">
                ${detail.center_coordinate[0].toFixed(6)}, ${detail.center_coordinate[1].toFixed(6)}
              </span>
            </div>`);
            mapRef.current?.setView(detail.center_coordinate, 17);
          }
        }
      } catch (err: any) {
        setAlert({
          type: "error",
          title: "Load Failed",
          message: err.message || "Could not load site details.",
        });
      }
    },
    [sites],
  );

  const clearEditMarkers = useCallback(() => {
    vertexMarkersRef.current.forEach((m) => mapRef.current?.removeLayer(m));
    vertexMarkersRef.current = [];
    addVertexMarkersRef.current.forEach((m) => mapRef.current?.removeLayer(m));
    addVertexMarkersRef.current = [];
    if (editableCenterMarkerRef.current) {
      mapRef.current?.removeLayer(editableCenterMarkerRef.current);
      editableCenterMarkerRef.current = null;
    }
    if (editablePolygonRef.current) {
      mapRef.current?.removeLayer(editablePolygonRef.current);
      editablePolygonRef.current = null;
    }
  }, []);

  const renderAllMarkers = useCallback((coordinates: [number, number][]) => {
    const map = mapRef.current;
    if (!map) return;
    vertexMarkersRef.current.forEach((m) => map.removeLayer(m));
    vertexMarkersRef.current = [];
    addVertexMarkersRef.current.forEach((m) => map.removeLayer(m));
    addVertexMarkersRef.current = [];
    if (!coordinates || coordinates.length < 3) return;

    coordinates.forEach((coord, index) => {
      const vertexMarker = L.marker(coord, {
        draggable: true,
        icon: L.divIcon({
          className: "vertex-marker",
          html: `<div style="background:#FF6B00;width:20px;height:20px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:10px;color:white;font-weight:bold;cursor:grab;">${index + 1}</div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        }),
      }).addTo(map);
      vertexMarker.on("drag", (e) => {
        const latlng = e.target.getLatLng();
        const newCoords = [...coordinates];
        newCoords[index] = [latlng.lat, latlng.lng];
        setEditedPolygon(newCoords);
        if (editablePolygonRef.current)
          editablePolygonRef.current.setLatLngs(newCoords);
        renderAllMarkersRef.current(newCoords);
      });
      vertexMarker.on("dblclick", () => {
        if (coordinates.length <= 3) {
          setAlert({
            type: "failed",
            title: "Cannot Delete",
            message: "Polygon must have at least 3 vertices.",
          });
          return;
        }
        const newCoords = coordinates.filter((_, i) => i !== index);
        setEditedPolygon(newCoords);
        if (editablePolygonRef.current)
          editablePolygonRef.current.setLatLngs(newCoords);
        renderAllMarkersRef.current(newCoords);
      });
      vertexMarker.bindTooltip("Double-click to delete", {
        permanent: false,
        direction: "top",
      });
      vertexMarkersRef.current.push(vertexMarker);
    });

    for (let i = 0; i < coordinates.length; i++) {
      const nextIndex = (i + 1) % coordinates.length;
      const midLat = (coordinates[i][0] + coordinates[nextIndex][0]) / 2;
      const midLng = (coordinates[i][1] + coordinates[nextIndex][1]) / 2;
      const addMarker = L.marker([midLat, midLng], {
        icon: L.divIcon({
          className: "add-vertex-marker",
          html: `<div style="background:#10B981;width:18px;height:18px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:12px;color:white;font-weight:bold;cursor:pointer;">+</div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        }),
      }).addTo(map);
      addMarker.on("click", () => {
        const newCoords = [...coordinates];
        newCoords.splice(i + 1, 0, [midLat, midLng]);
        setEditedPolygon(newCoords);
        if (editablePolygonRef.current)
          editablePolygonRef.current.setLatLngs(newCoords);
        renderAllMarkersRef.current(newCoords);
      });
      addMarker.bindTooltip("Click to add vertex", {
        permanent: false,
        direction: "top",
      });
      addVertexMarkersRef.current.push(addMarker);
    }
  }, []);

  useEffect(() => {
    renderAllMarkersRef.current = renderAllMarkers;
  }, [renderAllMarkers]);

  // ========================================================================
  // ✅ 1. MAP INITIALIZATION & CENTERING
  // ========================================================================
  useEffect(() => {
    if (mapContainerRef.current && !mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current, {
        zoomControl: true,
        attributionControl: true,
      }).setView([11.00860051288406, 124.60859604113544], 13);

      L.tileLayer(
        `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`,
        {
          attribution:
            '&copy; <a href="https://www.mapbox.com/">Mapbox</a> &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          tileSize: 512,
          zoomOffset: -1,
          maxZoom: 19,
        },
      ).addTo(mapRef.current);

      L.control
        .scale({ imperial: false, position: "bottomleft" })
        .addTo(mapRef.current);

      if (areaId) {
        sites.fetchMCDAData(areaId);
        const initialSiteId = siteId || undefined;
        fieldAssessments.fetchLayer(
          areaId,
          "safety",
          assessmentType,
          initialSiteId,
        );
      }

      return () => {
        mapRef.current?.remove();
        mapRef.current = null;
      };
    }
  }, [areaId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const reforestationArea = sites.reforestationArea;
    if (reforestationArea && reforestationArea.coordinate) {
      const [lat, lng] = reforestationArea.coordinate;
      map.flyTo([lat, lng], 14, { duration: 1.2 });
    }
  }, [sites.reforestationArea]);

  // ========================================================================
  // ✅ 2. AUTO-LOAD SITE MARKERS
  // ========================================================================
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    siteMarkersRef.current.forEach((marker) => map.removeLayer(marker));
    siteMarkersRef.current = [];
    if (!showSites || !sites.sites.length) return;

    sites.sites.forEach((site) => {
      const center = site.center_coordinate;
      if (center) {
        const marker = L.marker(center, {
          icon: createMarkerIcon("site", site.name),
        }).addTo(map);
        marker.bindPopup(`
          <div style="text-align:center;font-family:sans-serif;">
            <strong style="color:#22C55E;font-size:13px;">${site.name}</strong><br/>
            <span style="font-size:11px;color:#666;">${site.metrics?.area_hectares?.toFixed(2) || "0.00"} ha</span><br/>
            <span style="font-size:11px;color:#666; text-transform:capitalize;">${site.status}</span>
          </div>
        `);
        marker.on("click", () => handleViewSite(site));
        siteMarkersRef.current.push(marker);
      }
    });
    return () => {
      siteMarkersRef.current.forEach((marker) => map.removeLayer(marker));
      siteMarkersRef.current = [];
    };
  }, [sites.sites, handleViewSite, showSites]);

  // ========================================================================
  // ✅ 3. AUTO-LOAD BARANGAY MARKERS
  // ========================================================================
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    barangayMarkersRef.current.forEach((marker) => map.removeLayer(marker));
    barangayMarkersRef.current = [];
    if (!barangayAreas.barangayList.length) return;

    barangayAreas.barangayList.forEach((barangay) => {
      const lat = barangay.coordinate[0];
      const lng = barangay.coordinate[1];
      if (lat && lng) {
        const marker = L.marker([lat, lng], {
          icon: createMarkerIcon("barangay", barangay.name),
        }).addTo(map);
        marker.bindPopup(
          `<div style="text-align:center;font-family:sans-serif;"><strong style="color:#ca8a04;font-size:13px;">${barangay.name}</strong><br/><span style="font-size:11px;color:#666;">Barangay</span></div>`,
        );
        barangayMarkersRef.current.push(marker);
      }
    });
    return () => {
      barangayMarkersRef.current.forEach((marker) => map.removeLayer(marker));
      barangayMarkersRef.current = [];
    };
  }, [barangayAreas.barangayList]);

  // ========================================================================
  // ✅ 4. REFORESTATION AREA MARKER
  // ========================================================================
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !areaId) return;
    if (areaMarkerRef.current) {
      map.removeLayer(areaMarkerRef.current);
      areaMarkerRef.current = null;
    }
    if (!showReforestationArea) return;

    const reforestationArea = sites.reforestationArea;
    if (reforestationArea && reforestationArea.coordinate) {
      const [lat, lng] = reforestationArea.coordinate;
      areaMarkerRef.current = L.marker([lat, lng], {
        icon: createMarkerIcon("reforestation", reforestationArea.name),
      }).addTo(map);
      areaMarkerRef.current.bindPopup(
        `<div style="text-align:center;font-family:sans-serif;"><strong style="color:#2563eb;font-size:14px;">${reforestationArea.name}</strong><br/><span style="font-size:11px;color:#666;">Area ID: ${areaId}</span></div>`,
      );
    }
    return () => {
      if (areaMarkerRef.current) map.removeLayer(areaMarkerRef.current);
    };
  }, [areaId, sites.reforestationArea, showReforestationArea]);

  // ========================================================================
  // ✅ 5. POTENTIAL SITES RENDERING (Lighter Blue)
  // ========================================================================
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    potentialSiteLayersRef.current.forEach((layer) => map.removeLayer(layer));
    potentialSiteLayersRef.current = [];

    if (!showPotentialSites || !potentialSitesHook.potentialSites.length)
      return;

    potentialSitesHook.potentialSites.forEach((site: any) => {
      if (site.polygon_coordinates && site.polygon_coordinates.length >= 3) {
        const score =
          site.suitability_score ?? site.score ?? site.suitability ?? 50;

        let color = "#93C5FD";
        let fillColor = "#BFDBFE";

        if (score >= 70) {
          color = "#3B82F6";
          fillColor = "#93C5FD";
        } else if (score >= 40) {
          color = "#60A5FA";
          fillColor = "#BFDBFE";
        } else {
          color = "#93C5FD";
          fillColor = "#DBEAFE";
        }

        const polygon = L.polygon(site.polygon_coordinates, {
          color: color,
          fillColor: fillColor,
          fillOpacity: 0.5,
          weight: 2,
          dashArray: "4, 4",
        }).addTo(map);

        polygon.bindPopup(`
          <div style="text-align:center;font-family:sans-serif;">
            <strong style="color:#2563eb;font-size:13px;">Potential Site</strong><br/>
            <span style="font-size:11px;color:#666;">Suitability: ${score}%</span>
          </div>
        `);

        potentialSiteLayersRef.current.push(polygon);
      }
    });

    return () => {
      potentialSiteLayersRef.current.forEach((layer) => map.removeLayer(layer));
      potentialSiteLayersRef.current = [];
    };
  }, [showPotentialSites, potentialSitesHook.potentialSites]);

  // ========================================================================
  // ✅ GIS SPECIALIST: REAL-TIME DRAWING SYNC & COORDINATE EDITOR
  // ========================================================================
  useEffect(() => {
    if (!isDrawing || !mapRef.current) return;
    if (drawingLineRef.current)
      mapRef.current.removeLayer(drawingLineRef.current);
    if (polygonCoordinates.length >= 2) {
      drawingLineRef.current = L.polyline(polygonCoordinates, {
        color: "#22C55E",
        weight: 3,
        dashArray: "5, 5",
        opacity: 0.8,
      }).addTo(mapRef.current);
    }
    drawingPointsRef.current.forEach((m) => mapRef.current!.removeLayer(m));
    drawingPointsRef.current = [];
    polygonCoordinates.forEach((coord, idx) => {
      const marker = L.marker(coord, {
        icon: L.divIcon({
          className: "drawing-point-marker",
          html: `<div style="background:#ef4444;width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:white;font-size:10px;font-weight:bold;">${idx + 1}</div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        }),
      }).addTo(mapRef.current!);
      drawingPointsRef.current.push(marker);
    });
  }, [polygonCoordinates, isDrawing]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const handleMapClick = (e: L.LeafletMouseEvent) => {
      if (isDrawing) {
        setPolygonCoordinates((prev) => [
          ...prev,
          [e.latlng.lat, e.latlng.lng],
        ]);
      }
    };
    if (isDrawing) {
      map.on("click", handleMapClick);
      map.getContainer().style.cursor = "crosshair";
    } else {
      map.getContainer().style.cursor = "";
    }
    return () => {
      map.off("click", handleMapClick);
      if (!isDrawing) map.getContainer().style.cursor = "";
    };
  }, [isDrawing]);

  const handleCoordChange = useCallback(
    (index: number, axis: "lat" | "lng", value: string) => {
      const num = parseFloat(value);
      if (isNaN(num)) return;
      setPolygonCoordinates((prev) => {
        const next = [...prev];
        next[index] =
          axis === "lat" ? [num, next[index][1]] : [next[index][0], num];
        return next;
      });
    },
    [],
  );

  const handleAddVertex = useCallback((index: number) => {
    setPolygonCoordinates((prev) => {
      const next = [...prev];
      const base = next[index] || [11.0086, 124.6086];
      next.splice(index + 1, 0, [base[0] + 0.0001, base[1] + 0.0001]);
      return next;
    });
  }, []);

  const handleRemoveVertex = useCallback(
    (index: number) => {
      if (polygonCoordinates.length <= 3) {
        setAlert({
          type: "failed",
          title: "Cannot Remove",
          message: "Polygon must have at least 3 vertices.",
        });
        return;
      }
      setPolygonCoordinates((prev) => prev.filter((_, i) => i !== index));
    },
    [polygonCoordinates.length],
  );

  const startDrawing = () => {
    if (!mapRef.current) return;
    setIsDrawing(true);
    setShowCoordPanel(true);
    setPolygonCoordinates([]);
    setPolygonArea(null);
    setShowNameInput(false);
    if (drawingLineRef.current) {
      mapRef.current.removeLayer(drawingLineRef.current);
      drawingLineRef.current = null;
    }
    drawingPointsRef.current.forEach((m) => mapRef.current?.removeLayer(m));
    drawingPointsRef.current = [];
    setAlert({
      type: "success",
      title: "Drawing Mode",
      message: "Click on the map or manually enter exact coordinates below.",
    });
  };

  const finishDrawing = (coords: [number, number][]) => {
    if (!mapRef.current) return;
    if (coords.length < 3) {
      setAlert({
        type: "failed",
        title: "Invalid Polygon",
        message: "Need at least 3 points to create a polygon.",
      });
      return;
    }
    setIsDrawing(false);
    drawingPointsRef.current.forEach((m) => mapRef.current!.removeLayer(m));
    drawingPointsRef.current = [];
    if (drawingLineRef.current) {
      mapRef.current.removeLayer(drawingLineRef.current);
      drawingLineRef.current = null;
    }
    polygonRef.current?.remove();
    polygonRef.current = L.polygon(coords, {
      color: "#22C55E",
      fillColor: "#81C784",
      fillOpacity: 0.6,
      weight: 4,
    }).addTo(mapRef.current!);
    updateCreationMarkers(coords);
    setPolygonArea(calculatePolygonArea(coords));
    setShowNameInput(true);
    setAlert({
      type: "success",
      title: "Polygon Created",
      message: `${coords.length} points defined. Please name your site.`,
    });
  };

  const clearPolygon = () => {
    if (polygonRef.current && mapRef.current) {
      mapRef.current.removeLayer(polygonRef.current);
      polygonRef.current = null;
    }
    drawingPointsRef.current.forEach((m) => mapRef.current?.removeLayer(m));
    drawingPointsRef.current = [];
    if (drawingLineRef.current && mapRef.current) {
      mapRef.current.removeLayer(drawingLineRef.current);
      drawingLineRef.current = null;
    }
    creationVertexMarkersRef.current.forEach((m) =>
      mapRef.current?.removeLayer(m),
    );
    creationVertexMarkersRef.current = [];
    setPolygonCoordinates([]);
    setPolygonArea(null);
    setIsDrawing(false);
    setShowNameInput(false);
    setSiteName("");
  };

  const calculatePolygonArea = (coords: [number, number][]): number => {
    if (coords.length < 3) return 0;
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
    return Math.round((Math.abs(area) / 2 / 10000) * 100) / 100;
  };

  const handleSaveSite = async () => {
    if (!polygonCoordinates.length || !areaId || !polygonArea) {
      setAlert({
        type: "failed",
        title: "Missing Data",
        message: "Draw a valid polygon with at least 3 points.",
      });
      return;
    }
    const nameToUse =
      siteName.trim() || `Site-${Date.now().toString().slice(-4)}`;
    try {
      const data = await sites.createSite(
        areaId,
        nameToUse,
        polygonCoordinates,
        polygonArea,
      );
      if (data) {
        setAlert({
          type: "success",
          title: "Site Created",
          message: data.message ?? "Saved.",
        });
        clearPolygon();
      } else {
        const errorMsg = sites.error?.includes("already exists")
          ? "A site with this name already exists."
          : (sites.error ?? "Failed to save site.");
        setAlert({ type: "error", title: "Save Failed", message: errorMsg });
      }
    } catch (err: any) {
      setAlert({
        type: "error",
        title: "Network Error",
        message: err.message || "Could not connect to server.",
      });
    }
  };

  const handleValidateSite = useCallback(
    async (site: Site) => {
      try {
        sites.setError(null);
        setAlert({
          type: "success",
          title: "Loading",
          message: `Loading details for "${site.name}"...`,
        });
        const detail = await sites.fetchSiteDetail(site.site_id);
        if (sites.error) {
          setAlert({
            type: "error",
            title: "Validation Error",
            message: sites.error,
          });
          sites.setError(null);
          return;
        }
        if (!detail) {
          setAlert({
            type: "error",
            title: "Data Not Found",
            message: `Could not load details for site "${site.name}".`,
          });
          return;
        }
        setValidatingSite(detail);
        setShowValidationPanel(true);
        setAlert(null);
      } catch (err: any) {
        setAlert({
          type: "error",
          title: "Validation Failed",
          message: err.message || "An unexpected error occurred.",
        });
      }
    },
    [sites],
  );

  const handleDeleteSite = (siteId: number, name: string) => {
    setConfirmDialog({
      title: "Delete Site",
      message: `Are you sure you want to delete "${name}"? This action cannot be undone.`,
      variant: "danger",
      confirmLabel: "Delete",
      onConfirm: async () => {
        setConfirmDialog(null);
        const success = await sites.deleteSite(siteId, areaId!);
        if (success) {
          setAlert({
            type: "success",
            title: "Site Deleted",
            message: `"${name}" has been deleted.`,
          });
          if (areaId) await sites.fetchMCDAData(areaId);
        } else {
          setAlert({
            type: "error",
            title: "Delete Failed",
            message: sites.error ?? "Could not delete site.",
          });
        }
      },
    });
  };

  const handleTogglePin = async (siteId: number) => {
    try {
      await sites.togglePin(siteId);
      if (areaId) await sites.fetchSites(areaId);
    } catch (err: any) {
      setAlert({
        type: "error",
        title: "Pin Update Failed",
        message: err.message || "Could not update pin status.",
      });
    }
  };

  const handleSaveDraft = useCallback(
    async (data: {
      safety_note?: string;
      survivability_note?: string;
      final_note?: string;
    }): Promise<boolean> => {
      if (!validatingSite) return false;
      try {
        const result = await sites.saveValidationDraft(data);
        if (result) {
          await sites.fetchSiteDetail(validatingSite.site_id);
          return true;
        }
        return false;
      } catch (err: any) {
        setAlert({
          type: "error",
          title: "Save Failed",
          message: err.message || "Could not save draft.",
        });
        return false;
      }
    },
    [validatingSite, sites],
  );

  const handleFinalizeSite = useCallback(
    async (decision: "ACCEPT" | "REJECT", note: string): Promise<boolean> => {
      if (!validatingSite) return false;
      try {
        const result = await sites.finalizeSite(decision, note);
        if (result) {
          if (areaId) await sites.fetchSites(areaId);
          return true;
        }
        return false;
      } catch (err: any) {
        setAlert({
          type: "error",
          title: "Finalize Failed",
          message: err.message || "Could not finalize site.",
        });
        return false;
      }
    },
    [validatingSite, sites, areaId],
  );

  const handlePhotoClick = useCallback((photo: any) => {
    const map = mapRef.current;
    if (!map || !photo.latitude || !photo.longitude) return;
    map.flyTo([photo.latitude, photo.longitude], 18, {
      animate: true,
      duration: 0.8,
    });
  }, []);

  const creationVertexMarkersRef = useRef<L.Marker[]>([]);
  const updateCreationMarkers = useCallback((coords: [number, number][]) => {
    const map = mapRef.current;
    if (!map) return;
    creationVertexMarkersRef.current.forEach((m) => map.removeLayer(m));
    creationVertexMarkersRef.current = [];
    coords.forEach((coord, i) => {
      const marker = L.marker(coord, {
        icon: L.divIcon({
          className: "creation-vertex-marker",
          html: `<div style="background:#22C55E;width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:8px;color:white;font-weight:bold;">${i + 1}</div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        }),
      }).addTo(map);
      creationVertexMarkersRef.current.push(marker);
    });
  }, []);

  const handleCreateVertexChange = useCallback(
    (index: number, axis: "lat" | "lng", value: string) => {
      const numValue = parseFloat(value);
      if (isNaN(numValue)) return;
      const newCoords = [...polygonCoordinates];
      if (axis === "lat") newCoords[index] = [numValue, newCoords[index][1]];
      else newCoords[index] = [newCoords[index][0], numValue];
      setPolygonCoordinates(newCoords);
      if (polygonRef.current) polygonRef.current.setLatLngs(newCoords);
      updateCreationMarkers(newCoords);
      if (newCoords.length >= 3)
        setPolygonArea(calculatePolygonArea(newCoords));
    },
    [polygonCoordinates, updateCreationMarkers],
  );

  const handleCreateRemoveVertex = useCallback(
    (index: number) => {
      if (polygonCoordinates.length <= 3) {
        setAlert({
          type: "failed",
          title: "Cannot Remove",
          message: "Polygon must have at least 3 vertices.",
        });
        return;
      }
      const newCoords = polygonCoordinates.filter((_, i) => i !== index);
      setPolygonCoordinates(newCoords);
      if (polygonRef.current) polygonRef.current.setLatLngs(newCoords);
      updateCreationMarkers(newCoords);
      if (newCoords.length >= 3)
        setPolygonArea(calculatePolygonArea(newCoords));
      else {
        setPolygonArea(null);
        if (polygonRef.current) {
          mapRef.current?.removeLayer(polygonRef.current);
          polygonRef.current = null;
        }
      }
    },
    [polygonCoordinates, updateCreationMarkers],
  );

  const handleCreateAddVertex = useCallback(() => {
    let newPoint: [number, number];
    if (polygonCoordinates.length === 0) newPoint = [11.0086, 124.6086];
    else {
      const lastPoint = polygonCoordinates[polygonCoordinates.length - 1];
      newPoint = [lastPoint[0] + 0.001, lastPoint[1] + 0.001];
    }
    const newCoords = [...polygonCoordinates, newPoint];
    setPolygonCoordinates(newCoords);
    if (polygonRef.current) polygonRef.current.setLatLngs(newCoords);
    else if (newCoords.length >= 3) {
      polygonRef.current = L.polygon(newCoords, {
        color: "#22C55E",
        fillColor: "#81C784",
        fillOpacity: 0.6,
        weight: 4,
      }).addTo(mapRef.current!);
      setPolygonArea(calculatePolygonArea(newCoords));
    }
    updateCreationMarkers(newCoords);
  }, [polygonCoordinates, updateCreationMarkers]);

  const handleSiteSelectForFilter = useCallback(
    (site: Site | null) => {
      if (site) {
        setSelectedSiteIdForFilter(String(site.site_id));
        setAssessmentType("specific");
        handleFetchLayer(
          fieldAssessments.activeLayer,
          "specific",
          String(site.site_id),
        );
      } else {
        setSelectedSiteIdForFilter(null);
        setAssessmentType("all");
        handleFetchLayer(fieldAssessments.activeLayer, "all", null);
      }
    },
    [fieldAssessments.activeLayer, handleFetchLayer],
  );

  const handleMapClickForNewPolygon = useCallback(
    (e: L.LeafletMouseEvent) => {
      if (!isDrawingNewPolygon) return;
      const map = mapRef.current;
      if (!map) return;
      const newPoint: [number, number] = [e.latlng.lat, e.latlng.lng];
      const updatedPoints = [...newPolygonPoints, newPoint];
      setNewPolygonPoints(updatedPoints);
      const marker = L.marker(newPoint, {
        icon: L.divIcon({
          className: "new-polygon-vertex",
          html: `<div style="background:#FF6B00;width:16px;height:16px;border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:8px;color:white;font-weight:bold;">${updatedPoints.length}</div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        }),
      }).addTo(map);
      marker.on("dblclick", () => {
        const idx = updatedPoints.findIndex(
          (p) => p[0] === newPoint[0] && p[1] === newPoint[1],
        );
        if (idx !== -1) {
          const newPoints = updatedPoints.filter((_, i) => i !== idx);
          setNewPolygonPoints(newPoints);
          map.removeLayer(marker);
          newPolygonMarkersRef.current = newPolygonMarkersRef.current.filter(
            (m) => m !== marker,
          );
          if (newPolygonLineRef.current) {
            map.removeLayer(newPolygonLineRef.current);
            newPolygonLineRef.current = null;
          }
          if (newPoints.length >= 2) {
            newPolygonLineRef.current = L.polyline(newPoints, {
              color: "#FF6B00",
              weight: 3,
              dashArray: "5, 5",
            }).addTo(map);
          }
          newPolygonMarkersRef.current.forEach((m, i) => {
            m.setIcon(
              L.divIcon({
                className: "new-polygon-vertex",
                html: `<div style="background:#FF6B00;width:16px;height:16px;border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:8px;color:white;font-weight:bold;">${i + 1}</div>`,
                iconSize: [16, 16],
                iconAnchor: [8, 8],
              }),
            );
          });
        }
      });
      newPolygonMarkersRef.current.push(marker);
      if (newPolygonLineRef.current) map.removeLayer(newPolygonLineRef.current);
      if (updatedPoints.length >= 2) {
        newPolygonLineRef.current = L.polyline(updatedPoints, {
          color: "#FF6B00",
          weight: 3,
          dashArray: "5, 5",
        }).addTo(map);
      }
      if (updatedPoints.length >= 3) {
        setAlert({
          type: "success",
          title: "Drawing",
          message: `${updatedPoints.length} points added. Click "Finish Polygon" to complete.`,
        });
      }
    },
    [isDrawingNewPolygon, newPolygonPoints],
  );

  const handleFinishNewPolygon = useCallback(() => {
    if (newPolygonPoints.length < 3) {
      setAlert({
        type: "failed",
        title: "Not Enough Points",
        message: "Need at least 3 points to create a polygon.",
      });
      return;
    }
    const map = mapRef.current;
    if (!map) return;
    newPolygonMarkersRef.current.forEach((m) => map.removeLayer(m));
    newPolygonMarkersRef.current = [];
    if (newPolygonLineRef.current) {
      map.removeLayer(newPolygonLineRef.current);
      newPolygonLineRef.current = null;
    }
    // Transfer drawn points to editedPolygon so the form populates
    setEditedPolygon([...newPolygonPoints]);
    setIsDrawingNewPolygon(false);
    setNewPolygonPoints([]);
    const editablePolygon = L.polygon(newPolygonPoints, {
      color: "#22C55E",
      fillColor: "#81C784",
      fillOpacity: 0.6,
      weight: 4,
      dashArray: "5, 5",
    }).addTo(map);
    editablePolygonRef.current = editablePolygon;
    renderAllMarkersRef.current(newPolygonPoints);
    setAlert({
      type: "success",
      title: "Polygon Created",
      message:
        "Polygon created! Drag vertices to adjust. Click + to add more vertices.",
    });
  }, [newPolygonPoints]);

  const handleCancelNewPolygon = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    newPolygonMarkersRef.current.forEach((m) => map.removeLayer(m));
    newPolygonMarkersRef.current = [];
    if (newPolygonLineRef.current) {
      map.removeLayer(newPolygonLineRef.current);
      newPolygonLineRef.current = null;
    }
    setIsDrawingNewPolygon(false);
    setNewPolygonPoints([]);
    setEditedPolygon(null);
  }, []);

  const handleMapClickForNewCenter = useCallback(
    (e: L.LeafletMouseEvent) => {
      if (!isPlacingNewCenter) return;
      const map = mapRef.current;
      if (!map) return;
      const newCenter: [number, number] = [e.latlng.lat, e.latlng.lng];
      setEditedCenter(newCenter);
      setIsPlacingNewCenter(false);
      const centerMarker = L.marker(newCenter, {
        draggable: true,
        icon: L.divIcon({
          className: "center-marker-edit",
          html: `<div style="background:#FF6B00;width:24px;height:24px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;"><div style="width:8px;height:8px;background:white;border-radius:50%;"></div></div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        }),
      }).addTo(map);
      centerMarker.on("drag", (ev) => {
        const latlng = ev.target.getLatLng();
        setEditedCenter([latlng.lat, latlng.lng]);
      });
      editableCenterMarkerRef.current = centerMarker;
      setAlert({
        type: "success",
        title: "Center Placed",
        message: "Center marker placed. Drag to adjust position.",
      });
    },
    [isPlacingNewCenter],
  );

  const handleAutoCenter = useCallback(() => {
    if (!editedPolygon || editedPolygon.length < 3) {
      setAlert({
        type: "failed",
        title: "Need Polygon",
        message: "Draw a polygon first before auto-calculating center.",
      });
      return;
    }
    const sumLat = editedPolygon.reduce((sum, p) => sum + p[0], 0);
    const sumLng = editedPolygon.reduce((sum, p) => sum + p[1], 0);
    const center: [number, number] = [
      sumLat / editedPolygon.length,
      sumLng / editedPolygon.length,
    ];
    setEditedCenter(center);
    setIsPlacingNewCenter(false);
    if (editableCenterMarkerRef.current)
      mapRef.current?.removeLayer(editableCenterMarkerRef.current);
    const map = mapRef.current;
    if (!map) return;
    const centerMarker = L.marker(center, {
      draggable: true,
      icon: L.divIcon({
        className: "center-marker-edit",
        html: `<div style="background:#FF6B00;width:24px;height:24px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;"><div style="width:8px;height:8px;background:white;border-radius:50%;"></div></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      }),
    }).addTo(map);
    centerMarker.on("drag", (e) => {
      const latlng = e.target.getLatLng();
      setEditedCenter([latlng.lat, latlng.lng]);
    });
    editableCenterMarkerRef.current = centerMarker;
    setAlert({
      type: "success",
      title: "Center Calculated",
      message: "Center auto-calculated from polygon. You can drag to adjust.",
    });
  }, [editedPolygon]);

  const exitEditMode = useCallback(() => {
    setIsEditMode(false);
    setEditedPolygon(null);
    setEditedCenter(null);
    setIsDrawingNewPolygon(false);
    setIsPlacingNewCenter(false);
    setNewPolygonPoints([]);
    setShowCoordinateModal(false);
    clearEditMarkers();
    const map = mapRef.current;
    if (map) {
      newPolygonMarkersRef.current.forEach((m) => map.removeLayer(m));
      newPolygonMarkersRef.current = [];
      if (newPolygonLineRef.current) {
        map.removeLayer(newPolygonLineRef.current);
        newPolygonLineRef.current = null;
      }
    }
    if (viewingSite?.polygon_coordinates?.length) {
      polygonRef.current = L.polygon(viewingSite.polygon_coordinates, {
        color: "#22C55E",
        fillColor: "#81C784",
        fillOpacity: 0.6,
        weight: 4,
      }).addTo(mapRef.current!);
    }
  }, [viewingSite, clearEditMarkers]);

  // ✅ FIXED: handleEnterEditMode now ensures form shows even if no coordinates exist
  const handleEnterEditMode = useCallback(() => {
    if (!viewingSite) return;
    setIsEditMode(true);

    // Initialize to empty array instead of null so the form condition passes
    const initialPolygon =
      viewingSite.polygon_coordinates &&
      viewingSite.polygon_coordinates.length > 0
        ? [...viewingSite.polygon_coordinates]
        : [];
    setEditedPolygon(initialPolygon);

    setEditedCenter(
      viewingSite.center_coordinate ? [...viewingSite.center_coordinate] : null,
    );

    if (polygonRef.current) {
      mapRef.current?.removeLayer(polygonRef.current);
      polygonRef.current = null;
    }

    const hasPolygon = initialPolygon.length > 0;
    const hasCenter = !!viewingSite.center_coordinate;

    if (hasPolygon) {
      const editablePolygon = L.polygon(viewingSite.polygon_coordinates!, {
        color: "#F97316",
        fillColor: "#FDBA74",
        fillOpacity: 0.4,
        weight: 3,
        dashArray: "5, 5",
      }).addTo(mapRef.current!);
      editablePolygonRef.current = editablePolygon;
      renderAllMarkersRef.current(viewingSite.polygon_coordinates!);
    } else {
      // No polygon exists yet, enter drawing mode
      setIsDrawingNewPolygon(true);
      setNewPolygonPoints([]);
      setAlert({
        type: "success",
        title: "Draw Polygon",
        message:
          "Click on the map to add vertices or use the form to add coordinates manually.",
      });
    }

    // ✅ CRITICAL FIX: Always show the modal in edit mode so the form is visible
    setShowCoordinateModal(true);

    if (hasCenter) {
      const centerMarker = L.marker(viewingSite.center_coordinate!, {
        draggable: true,
        icon: L.divIcon({
          className: "center-marker-edit",
          html: `<div style="background:#F97316;width:28px;height:28px;border-radius:50%;border:4px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;"><div style="width:10px;height:10px;background:white;border-radius:50%;"></div></div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 28],
        }),
      }).addTo(mapRef.current!);
      centerMarker.on("drag", (e) => {
        const latlng = e.target.getLatLng();
        setEditedCenter([latlng.lat, latlng.lng]);
      });
      editableCenterMarkerRef.current = centerMarker;
    } else {
      setIsPlacingNewCenter(true);
    }
  }, [viewingSite]);

  const handleSaveCoordinates = useCallback(async () => {
    if (!viewingSite || !editedPolygon || !editedCenter) {
      setAlert({
        type: "failed",
        title: "Missing Data",
        message: "Both polygon and center coordinates are required.",
      });
      return;
    }
    setIsSavingCoordinates(true);
    try {
      const result = await sites.updateSiteCoordinates(
        viewingSite.site_id,
        editedPolygon,
        editedCenter,
      );
      if (result) {
        setAlert({
          type: "success",
          title: "Saved",
          message: "Site coordinates updated successfully.",
        });
        exitEditMode();
        await sites.fetchSiteDetail(viewingSite.site_id);
        if (areaId) await sites.fetchMCDAData(areaId);
      } else {
        setAlert({
          type: "error",
          title: "Save Failed",
          message: "Could not update coordinates.",
        });
      }
    } catch (err: any) {
      setAlert({
        type: "error",
        title: "Error",
        message: err.message || "Failed to save coordinates.",
      });
    } finally {
      setIsSavingCoordinates(false);
    }
  }, [viewingSite, editedPolygon, editedCenter, sites, areaId, exitEditMode]);

  const handleCancelEdit = useCallback(() => {
    setConfirmDialog({
      title: "Cancel Editing",
      message: "Discard all changes?",
      variant: "warning",
      confirmLabel: "Discard",
      onConfirm: () => {
        setConfirmDialog(null);
        exitEditMode();
        setAlert({
          type: "success",
          title: "Cancelled",
          message: "Changes discarded.",
        });
      },
    });
  }, [exitEditMode]);

  const handleCloseSiteView = useCallback(() => {
    if (isEditMode) {
      setConfirmDialog({
        title: "Close View",
        message: "You are in edit mode. Discard changes and close?",
        variant: "warning",
        confirmLabel: "Close",
        onConfirm: () => {
          setConfirmDialog(null);
          exitEditMode();
          setViewingSite(null);
          if (polygonRef.current) {
            mapRef.current?.removeLayer(polygonRef.current);
            polygonRef.current = null;
          }
        },
      });
    } else {
      setViewingSite(null);
      if (polygonRef.current) {
        mapRef.current?.removeLayer(polygonRef.current);
        polygonRef.current = null;
      }
    }
  }, [isEditMode, exitEditMode]);

  const handleEditVertexChange = useCallback(
    (index: number, axis: "lat" | "lng", value: string) => {
      const numValue = parseFloat(value);
      if (isNaN(numValue) || !editedPolygon) return;
      const newCoords = [...editedPolygon];
      if (axis === "lat") newCoords[index] = [numValue, newCoords[index][1]];
      else newCoords[index] = [newCoords[index][0], numValue];
      setEditedPolygon(newCoords);
      if (editablePolygonRef.current)
        editablePolygonRef.current.setLatLngs(newCoords);
      renderAllMarkersRef.current(newCoords);
    },
    [editedPolygon],
  );

  const handleEditRemoveVertex = useCallback(
    (index: number) => {
      if (!editedPolygon || editedPolygon.length <= 3) {
        setAlert({
          type: "failed",
          title: "Cannot Remove",
          message: "Polygon must have at least 3 vertices.",
        });
        return;
      }
      const newCoords = editedPolygon.filter((_, i) => i !== index);
      setEditedPolygon(newCoords);
      if (editablePolygonRef.current)
        editablePolygonRef.current.setLatLngs(newCoords);
      renderAllMarkersRef.current(newCoords);
    },
    [editedPolygon],
  );

  const handleEditAddVertex = useCallback(() => {
    if (!editedPolygon) return;
    let newPoint: [number, number];
    if (editedPolygon.length === 0) newPoint = [11.0086, 124.6086];
    else {
      const lastPoint = editedPolygon[editedPolygon.length - 1];
      newPoint = [lastPoint[0] + 0.001, lastPoint[1] + 0.001];
    }
    const newCoords = [...editedPolygon, newPoint];
    setEditedPolygon(newCoords);
    if (editablePolygonRef.current)
      editablePolygonRef.current.setLatLngs(newCoords);
    renderAllMarkersRef.current(newCoords);
  }, [editedPolygon]);

  const handleEditCenterChange = useCallback(
    (axis: "lat" | "lng", value: string) => {
      const numValue = parseFloat(value);
      if (isNaN(numValue)) return;
      const newCenter: [number, number] = editedCenter
        ? [...editedCenter]
        : [0, 0];
      if (axis === "lat") newCenter[0] = numValue;
      else newCenter[1] = numValue;
      setEditedCenter(newCenter);
      if (editableCenterMarkerRef.current)
        editableCenterMarkerRef.current.setLatLng(newCenter);
    },
    [editedCenter],
  );

  // ========================================================================
  // ✅ HAZARD DRAWING CLICK HANDLER & FA LOCATION PICKER
  // ========================================================================
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const handleClick = (e: L.LeafletMouseEvent) => {
      if (isDrawingNewPolygon) {
        handleMapClickForNewPolygon(e);
      } else if (isPlacingNewCenter) {
        handleMapClickForNewCenter(e);
      } else if (barangayAreas.isDrawingHazard) {
        barangayAreas.addHazardPoint(e.latlng.lat, e.latlng.lng);
      } else if (barangayAreas.isMapEditMode && barangayAreas.showHazardForm) {
        barangayAreas.addVertexOnMap(e.latlng.lat, e.latlng.lng);
      } else if (fieldAssessments.locationTargetId) {
        handleMapClickForFaLocation(e);
      }
    };
    const handleDblClick = () => {
      if (
        barangayAreas.isDrawingHazard &&
        barangayAreas.hazardPolygonPoints.length >= 3
      ) {
        barangayAreas.finishDrawingHazard();
      }
    };
    const isAnyDrawing =
      isDrawingNewPolygon ||
      isPlacingNewCenter ||
      barangayAreas.isDrawingHazard ||
      (barangayAreas.isMapEditMode && barangayAreas.showHazardForm) ||
      !!fieldAssessments.locationTargetId;

    if (isAnyDrawing) {
      map.getContainer().style.cursor = "crosshair";
      map.on("click", handleClick);
      if (barangayAreas.isDrawingHazard) {
        map.on("dblclick", handleDblClick);
      }
    } else {
      map.getContainer().style.cursor = "";
    }
    return () => {
      map.off("click", handleClick);
      map.off("dblclick", handleDblClick);
      if (!isAnyDrawing) {
        map.getContainer().style.cursor = "";
      }
    };
  }, [
    isDrawingNewPolygon,
    isPlacingNewCenter,
    barangayAreas.isDrawingHazard,
    barangayAreas.isMapEditMode,
    barangayAreas.showHazardForm,
    barangayAreas.hazardPolygonPoints,
    handleMapClickForNewPolygon,
    handleMapClickForNewCenter,
    barangayAreas.addHazardPoint,
    barangayAreas.addVertexOnMap,
    barangayAreas.finishDrawingHazard,
    fieldAssessments.locationTargetId,
    handleMapClickForFaLocation,
  ]);

  // ========================================================================
  // RENDER UI
  // ========================================================================
  return (
    <div className="flex min-h-screen bg-gray-50 flex-col relative">
      {alert && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none">
          <div className="pointer-events-auto [&>div]:w-full [&>div]:min-w-[400px]">
            <PlantScopeAlert
              type={alert.type}
              title={alert.title}
              message={alert.message}
              onClose={() => setAlert(null)}
            />
          </div>
        </div>
      )}
      {confirmDialog && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-auto">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setConfirmDialog(null)}
          />
          <div className="relative z-10 w-full max-w-md">
            <PlantScopeConfirm
              title={confirmDialog.title}
              message={confirmDialog.message}
              variant={confirmDialog.variant}
              confirmLabel={confirmDialog.confirmLabel}
              onConfirm={confirmDialog.onConfirm}
              onCancel={() => setConfirmDialog(null)}
            />
          </div>
        </div>
      )}

      <main className="flex-1 p-3 flex flex-col gap-3">
        {/* Toolbar */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowSites(!showSites)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition text-xs font-medium ${showSites ? "bg-green-600 hover:bg-green-700 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-700"}`}
            >
              <MapPin size={12} /> {showSites ? "Hide Sites" : "Show Sites"}
            </button>
            <button
              onClick={() => setShowReforestationArea(!showReforestationArea)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition text-xs font-medium ${showReforestationArea ? "bg-blue-600 hover:bg-blue-700 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-700"}`}
            >
              <Leaf size={12} />{" "}
              {showReforestationArea ? "Hide Area" : "Show Area"}
            </button>
            <div className="w-px h-5 bg-gray-200 mx-0.5" />
            <button
              onClick={() => setShowPotentialSites((v) => !v)}
              disabled={potentialSitesHook.loading}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition text-xs font-medium disabled:opacity-40 ${showPotentialSites ? "bg-blue-600 hover:bg-blue-700 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-700"}`}
            >
              <Target size={12} />{" "}
              {potentialSitesHook.loading
                ? "Loading..."
                : showPotentialSites
                  ? `Hide Potential (${potentialSitesHook.potentialSites.length})`
                  : `Potential Sites (${potentialSitesHook.potentialSites.length})`}
            </button>
            <div className="w-px h-5 bg-gray-200 mx-0.5" />
            <button
              onClick={() =>
                hazardLayers.setIsPanelOpen(!hazardLayers.isPanelOpen)
              }
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition text-xs font-medium ${hazardLayers.isPanelOpen ? "bg-red-600 hover:bg-red-700 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-700"}`}
            >
              <Shield size={12} /> Hazards
            </button>
            <div className="flex items-center gap-2">
              <BarangayAreasPanel barangayAreas={barangayAreas} />
              <button
                onClick={() => {
                  if (!barangayAreas.selectedBarangayId) {
                    setAlert({
                      type: "failed",
                      title: "Select Barangay",
                      message:
                        "Please select a barangay first before drawing a hazard area.",
                    });
                    return;
                  }
                  barangayAreas.startDrawingHazard();
                  setAlert({
                    type: "success",
                    title: "Drawing Mode",
                    message:
                      "Click on the map to add vertices. Double-click to finish (min 3 points).",
                  });
                }}
                disabled={
                  !barangayAreas.selectedBarangayId ||
                  barangayAreas.isDrawingHazard ||
                  barangayAreas.showHazardForm
                }
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition text-xs font-medium ${barangayAreas.isDrawingHazard ? "bg-yellow-500 text-white cursor-wait" : !barangayAreas.selectedBarangayId ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-yellow-500 hover:bg-yellow-600 text-white"}`}
              >
                <Pen size={12} />{" "}
                {barangayAreas.isDrawingHazard ? "Drawing..." : "Draw Hazard"}
              </button>
            </div>
          </div>
        </div>

        {/* Site View/Edit Panel */}
        {viewingSite && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 px-4 py-3 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <MapPin size={20} className="text-green-700" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">
                    {viewingSite.name}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {viewingSite?.area_hectares
                      ? `${viewingSite.area_hectares.toFixed(2)} ha`
                      : "Area not calculated"}{" "}
                    • {viewingSite.status}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isEditMode ? (
                  <>
                    <span className="text-xs text-orange-600 font-medium bg-orange-50 px-2 py-1 rounded">
                      ✏️ Edit Mode
                    </span>
                    <button
                      onClick={() => setShowCoordinateModal(true)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded"
                    >
                      <Navigation size={12} /> Edit Coordinates
                    </button>
                    <button
                      onClick={handleSaveCoordinates}
                      disabled={
                        isSavingCoordinates || !editedPolygon || !editedCenter
                      }
                      className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded disabled:opacity-50"
                    >
                      {isSavingCoordinates ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Save size={12} />
                      )}{" "}
                      Save
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="flex items-center gap-1 px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-medium rounded"
                    >
                      <X size={12} /> Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleEnterEditMode}
                      className="flex items-center gap-1 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium rounded"
                    >
                      <Edit3 size={12} /> Edit
                    </button>
                    <button
                      onClick={handleCloseSiteView}
                      className="flex items-center gap-1 px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-medium rounded"
                    >
                      <X size={12} /> Close
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {showCoordinateModal && editedPolygon && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
              <div className="px-6 py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                    <Navigation size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">
                      Edit Polygon Coordinates
                    </h2>
                    <p className="text-xs text-white/80">
                      {viewingSite?.name || "Site"} • {editedPolygon.length}{" "}
                      vertices
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCoordinateModal(false)}
                  className="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center transition"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                <SiteCoordinatesEditor
                  coordinates={editedPolygon}
                  center={editedCenter}
                  onVertexChange={handleEditVertexChange}
                  onRemoveVertex={handleEditRemoveVertex}
                  onAddVertex={handleEditAddVertex}
                  onCenterChange={handleEditCenterChange}
                  title="Polygon Vertices"
                  isEditing={true}
                />
                {editedPolygon && editedPolygon.length >= 3 && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <button
                      onClick={handleAutoCenter}
                      className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg transition"
                    >
                      <Target size={14} /> Auto-Calculate Center from Polygon
                    </button>
                  </div>
                )}
              </div>
              <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-between bg-gray-50">
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <Info size={14} />{" "}
                  <span>Drag vertices on map or edit coordinates above</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowCoordinateModal(false)}
                    className="px-4 py-2 bg-white hover:bg-gray-100 text-gray-700 text-xs font-semibold rounded-lg border border-gray-300"
                  >
                    Close
                  </button>
                  <button
                    onClick={handleSaveCoordinates}
                    disabled={
                      isSavingCoordinates || !editedPolygon || !editedCenter
                    }
                    className="flex items-center gap-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50"
                  >
                    {isSavingCoordinates ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Save size={12} />
                    )}{" "}
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-3 flex-1 min-h-0">
          <div className="flex-[4] flex flex-col gap-2 min-w-0 relative">
            {/* Map Container */}
            <div
              ref={mapContainerRef}
              className="w-full rounded-lg shadow-inner border-2 border-gray-300 relative overflow-hidden h-[75vh] min-h-[450px]"
            >
              {/* Drawing Mode Indicator */}
              {isDrawing && (
                <div className="absolute top-3 left-3 bg-white/95 px-3 py-1.5 rounded-lg shadow-md border border-green-200 z-[100]">
                  <p className="text-xs font-semibold text-green-800">
                    Drawing Mode
                  </p>
                  <p className="text-[10px] text-gray-600">
                    Click map or edit form on the right
                  </p>
                </div>
              )}

              {/* Area Indicator */}
              {polygonArea !== null && !isDrawing && (
                <div className="absolute bottom-3 left-3 bg-white/95 px-2.5 py-1.5 rounded-lg shadow-md border border-green-200 z-[100]">
                  <div className="flex items-center gap-1.5">
                    <Ruler size={12} className="text-green-600" />
                    <span className="text-xs font-semibold text-gray-800">
                      {polygonArea.toFixed(2)} ha
                    </span>
                  </div>
                </div>
              )}

              {/* Potential Sites Legend (Lighter Blue) */}
              {showPotentialSites &&
                potentialSitesHook.potentialSites.length > 0 && (
                  <div className="absolute top-3 right-3 bg-white/95 p-2.5 rounded-lg shadow-md border border-blue-200 z-[100]">
                    <p className="text-[10px] font-bold text-gray-700 mb-1.5 flex items-center gap-1">
                      <Target size={10} className="text-blue-600" /> Potential
                      Sites
                    </p>
                    <div className="flex flex-col gap-1 text-[9px] text-gray-600">
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-sm bg-[#93C5FD] border border-[#3B82F6]" />
                        <span>≥70% suitability</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-sm bg-[#BFDBFE] border border-[#60A5FA]" />
                        <span>40–70%</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-sm bg-[#DBEAFE] border border-[#93C5FD]" />
                        <span>&lt;40%</span>
                      </div>
                    </div>
                  </div>
                )}

              {/* FA Location Picking Panel */}
              {fieldAssessments.locationTargetId && (
                <div
                  className="absolute bottom-6 right-6 z-[9999] bg-white p-4 rounded-xl shadow-2xl border-2 border-orange-500 w-96 max-w-[calc(100%-3rem)]"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (e.nativeEvent) e.nativeEvent.stopPropagation();
                  }}
                >
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200">
                    <h4 className="font-bold text-sm text-orange-800 flex items-center gap-2">
                      <MapPin size={16} /> Set Assessment Location
                    </h4>
                    <button
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        isProcessingActionRef.current = true;
                        setTimeout(() => {
                          isProcessingActionRef.current = false;
                        }, 200);
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        if (e.nativeEvent) {
                          e.nativeEvent.stopPropagation();
                          e.nativeEvent.preventDefault();
                        }
                        fieldAssessments.setLocationTargetId(null);
                      }}
                      className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 p-1 rounded transition"
                      title="Cancel location picking"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <p className="text-xs text-gray-600 mb-3">
                    Click on the map to place a marker, or enter exact
                    coordinates below.
                  </p>
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div>
                      <label className="text-[10px] text-gray-600 font-semibold uppercase">
                        Latitude
                      </label>
                      <input
                        type="text"
                        value={
                          tempFaLocationCoords
                            ? tempFaLocationCoords[0].toFixed(6)
                            : ""
                        }
                        onChange={(e) => {
                          const lat = parseFloat(e.target.value);
                          if (!isNaN(lat)) {
                            const lng = tempFaLocationCoords
                              ? tempFaLocationCoords[1]
                              : 124.6086;
                            setTempFaLocationCoords([lat, lng]);
                            updateTempFaLocationMarker([lat, lng]);
                          }
                        }}
                        placeholder="e.g. 11.0086"
                        className="w-full text-xs border-2 border-gray-300 rounded px-2 py-1.5 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none font-mono font-semibold text-gray-800"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-600 font-semibold uppercase">
                        Longitude
                      </label>
                      <input
                        type="text"
                        value={
                          tempFaLocationCoords
                            ? tempFaLocationCoords[1].toFixed(6)
                            : ""
                        }
                        onChange={(e) => {
                          const lng = parseFloat(e.target.value);
                          if (!isNaN(lng)) {
                            const lat = tempFaLocationCoords
                              ? tempFaLocationCoords[0]
                              : 11.0086;
                            setTempFaLocationCoords([lat, lng]);
                            updateTempFaLocationMarker([lat, lng]);
                          }
                        }}
                        placeholder="e.g. 124.6086"
                        className="w-full text-xs border-2 border-gray-300 rounded px-2 py-1.5 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none font-mono font-semibold text-gray-800"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        isProcessingActionRef.current = true;
                        setTimeout(() => {
                          isProcessingActionRef.current = false;
                        }, 200);
                      }}
                      onClick={async (e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        if (e.nativeEvent) {
                          e.nativeEvent.stopPropagation();
                          e.nativeEvent.preventDefault();
                        }

                        console.log("💾 [UI] Save Location button clicked");

                        if (
                          tempFaLocationMarkerRef.current &&
                          fieldAssessments.locationTargetId
                        ) {
                          const latlng =
                            tempFaLocationMarkerRef.current.getLatLng();
                          const lat = latlng.lat;
                          const lng = latlng.lng;

                          console.log(
                            "📍 [UI] Saving coordinates directly from marker ref:",
                            { lat, lng },
                          );

                          const result = await fieldAssessments.updateLocation(
                            fieldAssessments.locationTargetId,
                            lat,
                            lng,
                            20, // gps_accuracy_meters
                          );

                          if (result.success) {
                            setAlert({
                              type: "success",
                              title: "Location Saved",
                              message:
                                result.message ||
                                "Assessment location updated successfully.",
                            });
                            fieldAssessments.setLocationTargetId(null);
                            if (areaId) {
                              handleFetchLayer(fieldAssessments.activeLayer);
                            }
                          } else {
                            setAlert({
                              type: "error",
                              title: "Save Failed",
                              message:
                                result.message || "Could not update location.",
                            });
                          }
                        }
                      }}
                      disabled={!tempFaLocationMarkerRef.current}
                      className="flex-1 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg transition flex items-center justify-center gap-2"
                    >
                      <Save size={14} /> Save Location
                    </button>
                    <button
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        isProcessingActionRef.current = true;
                        setTimeout(() => {
                          isProcessingActionRef.current = false;
                        }, 200);
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        if (e.nativeEvent) {
                          e.nativeEvent.stopPropagation();
                          e.nativeEvent.preventDefault();
                        }
                        fieldAssessments.setLocationTargetId(null);
                      }}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* GIS SPECIALIST: REAL-TIME COORDINATE EDITOR FORM */}
            {isDrawing && showCoordPanel && (
              <div className="fixed top-28 right-6 z-[9999] bg-white p-4 rounded-xl shadow-2xl border-2 border-green-500 w-96 max-h-[65vh] flex flex-col">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200">
                  <h4 className="font-bold text-sm text-green-800 flex items-center gap-2">
                    <Pen size={16} /> Polygon Vertices
                  </h4>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full font-bold">
                      {polygonCoordinates.length} pts
                    </span>
                    <button
                      onClick={() => setShowCoordPanel(false)}
                      className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 p-1 rounded transition"
                      title="Hide coordinate panel"
                    >
                      <Eye size={16} className="opacity-50" />
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-1 mb-3 max-h-[35vh]">
                  {polygonCoordinates.map((coord, idx) => (
                    <div
                      key={idx}
                      className="bg-white p-3 rounded-lg border-2 border-gray-200 hover:border-green-400 transition"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-1 rounded">
                          Vertex {idx + 1}
                        </span>
                        <button
                          onClick={() => handleRemoveVertex(idx)}
                          className="text-red-500 hover:bg-red-50 p-1 rounded transition"
                          title="Remove vertex"
                        >
                          <X size={14} />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-gray-600 font-semibold uppercase">
                            Latitude
                          </label>
                          <input
                            type="text"
                            value={coord[0].toFixed(6)}
                            onChange={(e) =>
                              handleCoordChange(idx, "lat", e.target.value)
                            }
                            className="w-full text-xs border-2 border-gray-300 rounded px-2 py-1.5 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none font-mono font-semibold text-gray-800"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-600 font-semibold uppercase">
                            Longitude
                          </label>
                          <input
                            type="text"
                            value={coord[1].toFixed(6)}
                            onChange={(e) =>
                              handleCoordChange(idx, "lng", e.target.value)
                            }
                            className="w-full text-xs border-2 border-gray-300 rounded px-2 py-1.5 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none font-mono font-semibold text-gray-800"
                          />
                        </div>
                      </div>
                      <button
                        onClick={() => handleAddVertex(idx)}
                        className="w-full mt-2 text-[10px] text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded py-1.5 flex items-center justify-center gap-1 transition font-semibold"
                      >
                        <Plus size={12} /> Add vertex after this
                      </button>
                    </div>
                  ))}
                  {polygonCoordinates.length === 0 && (
                    <div className="text-center py-8 text-gray-500 text-sm bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                      <MapPin size={32} className="mx-auto mb-2 opacity-50" />
                      <p>Click on the map to place your first vertex</p>
                      <p className="text-xs mt-1 text-gray-400">
                        or manually enter coordinates below
                      </p>
                    </div>
                  )}
                </div>

                <div className="border-t-2 border-gray-200 pt-3 space-y-2">
                  <button
                    onClick={() => {
                      const last =
                        polygonCoordinates.length > 0
                          ? polygonCoordinates[polygonCoordinates.length - 1]
                          : [11.0086, 124.6086];
                      setPolygonCoordinates((prev) => [
                        ...prev,
                        [last[0] + 0.0001, last[1] + 0.0001],
                      ]);
                    }}
                    className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg transition flex items-center justify-center gap-2 border-2 border-gray-300"
                  >
                    <Plus size={14} /> Add Final Vertex
                  </button>
                  <button
                    onClick={() => finishDrawing(polygonCoordinates)}
                    disabled={polygonCoordinates.length < 3}
                    className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg transition flex items-center justify-center gap-2 shadow-lg"
                  >
                    <CheckCircle size={18} /> Finish & Name Site
                  </button>
                </div>
              </div>
            )}

            {/* Floating "Show" Button when panel is hidden */}
            {isDrawing && !showCoordPanel && (
              <button
                onClick={() => setShowCoordPanel(true)}
                className="fixed top-28 right-6 z-[9999] bg-white p-2.5 rounded-full shadow-xl border-2 border-green-500 hover:bg-green-50 transition flex items-center gap-2 group"
                title="Show coordinate panel"
              >
                <Eye size={18} className="text-green-600" />
                <span className="text-xs font-bold text-green-700 pr-1 group-hover:block hidden transition-all">
                  Show Vertices
                </span>
              </button>
            )}

            {/* Prominent Center Modal for Name Input */}
            {showNameInput && (
              <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
                <div className="bg-white p-6 rounded-2xl shadow-2xl border-2 border-green-500 w-[450px] max-w-[90vw] mx-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <MapPin size={24} className="text-green-700" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-green-800 text-lg">
                        Name Your New Site
                      </h4>
                      <p className="text-xs text-gray-500">
                        Area:{" "}
                        <span className="font-semibold text-green-700">
                          {polygonArea?.toFixed(2)} ha
                        </span>{" "}
                        • Vertices:{" "}
                        <span className="font-semibold text-green-700">
                          {polygonCoordinates.length}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="mb-4">
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                      Site Name
                    </label>
                    <input
                      type="text"
                      value={siteName}
                      onChange={(e) => setSiteName(e.target.value)}
                      placeholder="Enter site name (e.g., Site A - North Field)"
                      className="w-full px-4 py-3 text-sm border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                      onKeyDown={(e) => e.key === "Enter" && handleSaveSite()}
                      autoFocus
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={handleSaveSite}
                      disabled={!polygonArea}
                      className={`flex-1 py-3 rounded-lg text-sm font-bold transition flex items-center justify-center gap-2 ${polygonArea ? "bg-green-600 hover:bg-green-700 text-white shadow-lg" : "bg-gray-200 text-gray-400 cursor-not-allowed"}`}
                    >
                      <Save size={16} /> Save Site
                    </button>
                    <button
                      onClick={() => {
                        setShowNameInput(false);
                        setSiteName("");
                        clearPolygon();
                      }}
                      className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold rounded-lg transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Hazard Assessment Panel (Below Map) */}
            <HazardAssessmentPanel
              isOpen={hazardLayers.isPanelOpen}
              onClose={() => hazardLayers.setIsPanelOpen(false)}
              showMgbFlood={hazardLayers.showMgbFlood}
              setShowMgbFlood={hazardLayers.setShowMgbFlood}
              showMgbLandslide={hazardLayers.showMgbLandslide}
              setShowMgbLandslide={hazardLayers.setShowMgbLandslide}
              showEil={hazardLayers.showEil}
              setShowEil={hazardLayers.setShowEil}
              showFirms={hazardLayers.showFirms}
              firmsTimeRange={hazardLayers.firmsTimeRange}
              fireCount={hazardLayers.fireCount}
              onToggleFirms={hazardLayers.toggleFirms}
              onUpdateFirmsTimeRange={hazardLayers.updateFirmsTimeRange}
            />

            {/* Bottom Toolbar (Below Map) */}
            <div className="bg-white rounded-lg border border-gray-200 px-3 py-2 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <Pen size={12} />
                  {polygonCoordinates.length > 0
                    ? `${polygonCoordinates.length} pts`
                    : "No polygon"}
                </span>
                {showPotentialSites &&
                  potentialSitesHook.potentialSites.length > 0 && (
                    <span className="flex items-center gap-1 text-blue-600">
                      <Target size={12} />{" "}
                      {potentialSitesHook.potentialSites.length} potential site
                      {potentialSitesHook.potentialSites.length !== 1
                        ? "s"
                        : ""}
                    </span>
                  )}
                {hazardLayers.showMgbFlood && (
                  <span className="flex items-center gap-1 text-blue-600 font-medium">
                    Flood
                  </span>
                )}
                {hazardLayers.showMgbLandslide && (
                  <span className="flex items-center gap-1 text-orange-600 font-medium">
                    ⛰️ Landslide
                  </span>
                )}
                {hazardLayers.showEil && (
                  <span className="flex items-center gap-1 text-purple-600 font-medium">
                    🌋 EIL
                  </span>
                )}
                {hazardLayers.showFirms && (
                  <span className="flex items-center gap-1 text-red-600 font-medium">
                    🔥 {hazardLayers.fireCount} fires
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {isDrawing && (
                  <>
                    <button
                      onClick={() => finishDrawing(polygonCoordinates)}
                      disabled={polygonCoordinates.length < 3}
                      className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white text-xs font-semibold rounded transition flex items-center gap-1"
                    >
                      <CheckCircle size={12} /> Finish
                    </button>
                    <button
                      onClick={() => {
                        const newCoords = polygonCoordinates.slice(0, -1);
                        setPolygonCoordinates(newCoords);
                      }}
                      disabled={polygonCoordinates.length === 0}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 text-white text-xs font-semibold rounded transition flex items-center gap-1"
                    >
                      <Undo2 size={12} /> Undo
                    </button>
                  </>
                )}

                {/* ✅ NEW: Controls for Editing a Site with No Coordinates (Orange Drawing Mode) */}
                {isDrawingNewPolygon && (
                  <>
                    <button
                      onClick={handleFinishNewPolygon}
                      disabled={newPolygonPoints.length < 3}
                      className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white text-xs font-semibold rounded transition flex items-center gap-1"
                    >
                      <CheckCircle size={12} /> Finish Polygon
                    </button>
                    <button
                      onClick={handleCancelNewPolygon}
                      className="px-3 py-1.5 bg-gray-500 hover:bg-gray-600 text-white text-xs font-semibold rounded transition flex items-center gap-1"
                    >
                      <X size={12} /> Cancel
                    </button>
                  </>
                )}

                {barangayAreas.isDrawingHazard && (
                  <>
                    <button
                      onClick={() => barangayAreas.finishDrawingHazard()}
                      disabled={barangayAreas.hazardPolygonPoints.length < 3}
                      className="px-3 py-1.5 bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-300 text-white text-xs font-semibold rounded transition flex items-center gap-1"
                    >
                      <CheckCircle size={12} /> Finish Hazard
                    </button>
                    <button
                      onClick={() => barangayAreas.removeLastHazardPoint()}
                      disabled={barangayAreas.hazardPolygonPoints.length === 0}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 text-white text-xs font-semibold rounded transition flex items-center gap-1"
                    >
                      <Undo2 size={12} /> Undo
                    </button>
                    <button
                      onClick={() => barangayAreas.cancelDrawingHazard()}
                      className="px-3 py-1.5 bg-gray-500 hover:bg-gray-600 text-white text-xs font-semibold rounded transition flex items-center gap-1"
                    >
                      <X size={12} /> Cancel
                    </button>
                  </>
                )}
                {!showNameInput && !isDrawing && !isDrawingNewPolygon && (
                  <button
                    onClick={startDrawing}
                    disabled={!!fieldAssessments.locationTargetId}
                    className="px-4 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-xs font-semibold rounded transition flex items-center gap-1"
                  >
                    <Pen size={12} /> Draw Polygon
                  </button>
                )}
                <button
                  onClick={clearPolygon}
                  disabled={!polygonCoordinates.length && !isDrawing}
                  className="flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-3 py-1.5 rounded transition text-xs font-medium disabled:opacity-40"
                >
                  <Trash2 size={12} /> Clear
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Field Assessments */}
          <div className="flex-[2] flex flex-col gap-3 min-w-0">
            <div className="flex-1 bg-white rounded-lg border border-gray-200 flex flex-col min-h-0">
              <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
                <h3 className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                  <Eye size={13} className="text-blue-500" /> Field Assessments
                </h3>
                {areaId && (
                  <button
                    onClick={() =>
                      handleFetchLayer(fieldAssessments.activeLayer)
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
                    />{" "}
                    Refresh
                  </button>
                )}
              </div>
              <div className="px-3 py-2 border-b border-gray-100 bg-gray-50">
                <div className="flex gap-1 bg-white rounded-lg p-1 border border-gray-200">
                  <button
                    onClick={() => {
                      setAssessmentType("specific");
                      handleFetchLayer(
                        fieldAssessments.activeLayer,
                        "specific",
                      );
                    }}
                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-md text-[10px] font-semibold transition ${assessmentType === "specific" ? "bg-green-500 text-white shadow-sm" : "text-gray-600 hover:bg-gray-100"}`}
                  >
                    <Target size={10} /> Specific
                  </button>
                  <button
                    onClick={() => {
                      setAssessmentType("general");
                      handleFetchLayer(fieldAssessments.activeLayer, "general");
                    }}
                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-md text-[10px] font-semibold transition ${assessmentType === "general" ? "bg-blue-500 text-white shadow-sm" : "text-gray-600 hover:bg-gray-100"}`}
                  >
                    <MapPin size={10} /> General
                  </button>
                  <button
                    onClick={() => {
                      setAssessmentType("all");
                      setSelectedSiteIdForFilter(null);
                      handleFetchLayer(fieldAssessments.activeLayer, "all");
                    }}
                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-md text-[10px] font-semibold transition ${assessmentType === "all" ? "bg-gray-700 text-white shadow-sm" : "text-gray-600 hover:bg-gray-100"}`}
                  >
                    All
                  </button>
                </div>
              </div>
              <div className="flex border-b border-gray-100 flex-shrink-0">
                {[
                  {
                    id: "safety" as MCDALayer,
                    short: "L1",
                    color: "text-red-600",
                  },
                  {
                    id: "boundary_verification" as MCDALayer,
                    short: "L2",
                    color: "text-amber-600",
                  },
                  {
                    id: "survivability" as MCDALayer,
                    short: "L3",
                    color: "text-emerald-600",
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
                        )
                          handleFetchLayer(l.id);
                      }}
                      className={`flex-1 py-2 text-xs font-semibold transition relative border-b-2 ${active ? `${l.color} border-current` : "text-gray-400 border-transparent hover:text-gray-600"}`}
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
                        areaId && handleFetchLayer(fieldAssessments.activeLayer)
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
                  ).map((entry: FieldAssessmentEntry, idx) => {
                    const isSelected = idx === fieldAssessments.selectedIndex;
                    const faId = entry.field_assessment_id;
                    const hasLocation = !!entry.location?.latitude;
                    const isThisPickingLocation =
                      fieldAssessments.locationTargetId === faId;
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
                        className={`w-full text-left px-3 py-2.5 border-b border-gray-50 transition ${isSelected ? "bg-blue-50 border-l-2 border-l-blue-500" : "hover:bg-gray-50"}`}
                      >
                        <div className="flex items-center gap-2">
                          {entry.inspector.profile_image && (
                            <img
                              src={
                                api_second + `${entry.inspector.profile_image}`
                              }
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
                                {entry.inspector.full_name}
                              </span>
                              <span className="text-[10px] font-bold text-gray-400 flex-shrink-0">
                                F{idx + 1}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-gray-500">
                                {entry.assessment_date}
                              </span>
                              {entry.images?.length > 0 && (
                                <span className="text-[10px] text-blue-500 flex items-center gap-0.5">
                                  📷 {entry.images.length}
                                </span>
                              )}
                            </div>
                            <div
                              className="mt-1.5"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {isThisPickingLocation ? (
                                <button
                                  onClick={() =>
                                    fieldAssessments.setLocationTargetId(null)
                                  }
                                  className="flex items-center gap-1 text-[10px] bg-orange-100 text-orange-700 border border-orange-300 px-2 py-0.5 rounded-full font-medium animate-pulse"
                                >
                                  <X size={9} /> Cancel
                                </button>
                              ) : (
                                <button
                                  onClick={() =>
                                    fieldAssessments.setLocationTargetId(faId)
                                  }
                                  className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium border transition ${hasLocation ? "bg-green-50 text-green-700 border-green-300 hover:bg-green-100" : "bg-orange-50 text-orange-700 border-orange-300 hover:bg-orange-100"}`}
                                >
                                  <MapPin size={9} />{" "}
                                  {hasLocation
                                    ? "Update Location"
                                    : "Add Location"}
                                </button>
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

        {/* Bottom Row: Site List and Field Assessment Details */}
        <div className="flex gap-3">
          <div className="w-[40%] bg-white rounded-lg border border-gray-200 flex flex-col min-h-[120px]">
            <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
                <Layers size={15} className="text-green-600" /> Site List (
                {sites.sites.length})
              </h3>
              {areaId && (
                <button
                  onClick={() => sites.fetchSites(areaId)}
                  disabled={sites.loading}
                  className="text-[10px] text-blue-600 hover:underline disabled:opacity-50"
                >
                  Refresh
                </button>
              )}
            </div>
            <div className="flex-1 min-h-[200px]">
              <SiteList
                sites={sites.sites}
                loading={sites.loading}
                onSelectSite={handleViewSite}
                onValidateSite={handleValidateSite}
                onDeleteSite={handleDeleteSite}
                onTogglePin={handleTogglePin}
                areaId={areaId}
                selectedSiteId={selectedSiteIdForFilter}
                onSiteSelectForFilter={handleSiteSelectForFilter}
              />
            </div>
          </div>
          <div className="w-[60%]">
            {(fieldAssessments.assessments[fieldAssessments.activeLayer] ?? [])
              .length === 0 ? (
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
                locationTargetId={fieldAssessments.locationTargetId}
                onLayerChange={(layer) => {
                  fieldAssessments.setActiveLayer(layer);
                  if (!fieldAssessments.assessments[layer].length && areaId)
                    handleFetchLayer(layer);
                }}
                onSelectEntry={(idx) => {
                  fieldAssessments.setSelectedIndex(idx);
                  fieldAssessments.flyToMarker(
                    fieldAssessments.activeLayer,
                    idx,
                  );
                }}
                onFetchLayer={handleFetchLayer}
                onAddLocation={(faId) =>
                  fieldAssessments.setLocationTargetId(faId)
                }
                onPhotoClick={handlePhotoClick}
                showPhotoMarkers={fieldAssessments.showPhotoMarkers}
                onTogglePhotoMarkers={fieldAssessments.setShowPhotoMarkers}
              />
            )}
          </div>
        </div>
      </main>

      <SiteValidationPanel
        site={validatingSite}
        isOpen={showValidationPanel}
        onClose={() => {
          setShowValidationPanel(false);
          setValidatingSite(null);
        }}
        onSaveDraft={handleSaveDraft}
        onFinalize={handleFinalizeSite}
        loading={sites.loading}
      />
      {barangayAreas.showHazardForm && !barangayAreas.isMapEditMode && (
        <HazardAreaFormPanel
          barangayAreas={barangayAreas}
          onClose={() => {
            barangayAreas.cancelDrawingHazard();
          }}
          onSaveSuccess={(msg) => {
            setAlert({ type: "success", title: "Success", message: msg });
          }}
          onSaveError={(msg) => {
            setAlert({ type: "error", title: "Error", message: msg });
          }}
        />
      )}
    </div>
  );
}
