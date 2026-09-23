import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
  EyeOff,
  Plus,
  Globe,
  Search,
  ArrowUpDown,
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

const isValidLatLng = (coord: [number, number]): boolean => {
  const [lat, lng] = coord;
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    !isNaN(lat) &&
    !isNaN(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
};

const normalizeCoordinates = (
  coords: [number, number][],
): [number, number][] => {
  if (!coords || !Array.isArray(coords)) return [];
  return coords
    .map((coord) => {
      if (!Array.isArray(coord) || coord.length < 2) return coord;
      const [first, second] = coord;
      if (Math.abs(first) > 90 || Math.abs(second) > 90) {
        if (Math.abs(first) > 90 && Math.abs(second) <= 90)
          return [second, first] as [number, number];
        return coord;
      }
      return coord;
    })
    .filter(isValidLatLng);
};

const normalizeMarkerCoordinate = (
  coord: [number, number] | null | undefined,
): [number, number] | null => {
  if (!coord || !Array.isArray(coord) || coord.length < 2) return null;
  const [first, second] = coord;
  if (isValidLatLng([first, second])) return [first, second];
  if (isValidLatLng([second, first])) return [second, first];
  return null;
};

const decimalToDMS = (value: number, type: "lat" | "lng") => {
  const absolute = Math.abs(value);
  const degrees = Math.floor(absolute);
  const minutesNotTruncated = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesNotTruncated);
  const seconds = ((minutesNotTruncated - minutes) * 60).toFixed(2);
  const direction =
    type === "lat" ? (value >= 0 ? "N" : "S") : value >= 0 ? "E" : "W";
  return `${degrees}° ${minutes}' ${seconds}" ${direction}`;
};

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
    iconAnchor: [12, 30],
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
  const userRole =
    typeof window !== "undefined" ? localStorage.getItem("user_role") : null;

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const polygonRef = useRef<L.Polygon | null>(null);
  const locationTempMarkerRef = useRef<L.Marker | null>(null);
  const barangayMarkersRef = useRef<L.Marker[]>([]);
  const siteMarkersRef = useRef<L.Marker[]>([]);
  const areaMarkerRef = useRef<L.Marker | null>(null);
  const probeMarkerRef = useRef<L.Marker | null>(null);

  // ✅ NEW: Refs and state for showing assessment boundary polygons
  const boundaryPolygonRef = useRef<L.Polygon | null>(null);
  const boundaryVertexMarkersRef = useRef<L.Marker[]>([]);
  const [showingPolygonId, setShowingPolygonId] = useState<number | null>(null);

  const [viewingSite, setViewingSite] = useState<SiteDetail | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedPolygon, setEditedPolygon] = useState<[number, number][] | null>(
    null,
  );
  const [editedMarker, setEditedMarker] = useState<[number, number] | null>(
    null,
  );
  const [isSavingCoordinates, setIsSavingCoordinates] = useState(false);
  const [showCoordinateModal, setShowCoordinateModal] = useState(false);
  const [showViewingSitePolygon, setShowViewingSitePolygon] = useState(true);
  const [isPickingMarkerLocation, setIsPickingMarkerLocation] = useState(false);

  const editablePolygonRef = useRef<L.Polygon | null>(null);
  const vertexMarkersRef = useRef<L.Marker[]>([]);
  const addVertexMarkersRef = useRef<L.Marker[]>([]);
  const editableMarkerRef = useRef<L.Marker | null>(null);

  const [isDrawingNewPolygon, setIsDrawingNewPolygon] = useState(false);
  const [newPolygonPoints, setNewPolygonPoints] = useState<[number, number][]>(
    [],
  );
  const [isPlacingNewMarker, setIsPlacingNewMarker] = useState(false);
  const newPolygonMarkersRef = useRef<L.Marker[]>([]);
  const newPolygonLineRef = useRef<L.Polyline | null>(null);

  const renderAllMarkersRef = useRef<(coords: [number, number][]) => void>(
    () => {},
  );
  const hasInitialAreaLoadRef = useRef(false);

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

  const [isCoordinateProbeMode, setIsCoordinateProbeMode] = useState(false);
  const [mouseCoords, setMouseCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [showDMS, setShowDMS] = useState(false);
  const [isDrawingFinished, setIsDrawingFinished] = useState(false);
  const [areaUnit, setAreaUnit] = useState<"ha" | "sqm">("ha");
  const [viewAreaUnit, setViewAreaUnit] = useState<"ha" | "sqm">("ha");

  const [dateFilter, setDateFilter] = useState<{
    start_date?: string;
    end_date?: string;
  }>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<
    "date_desc" | "date_asc" | "inspector_asc" | "inspector_desc"
  >("date_desc");

  const [showReassignModal, setShowReassignModal] = useState(false);
  const [reassignTargetAssessment, setReassignTargetAssessment] =
    useState<FieldAssessmentEntry | null>(null);
  const [availableSites, setAvailableSites] = useState<Site[]>([]);
  const [reassignSearchQuery, setReassignSearchQuery] = useState("");
  const [isReassigning, setIsReassigning] = useState(false);

  const displayArea = useCallback(
    (area: number | null): string => {
      if (area === null) return "0";
      return areaUnit === "ha"
        ? `${area.toFixed(2)} ha`
        : `${(area * 10000).toFixed(2)} m²`;
    },
    [areaUnit],
  );

  useEffect(() => {
    setViewAreaUnit("ha");
  }, [viewingSite?.site_id]);

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

  const getDisplayAreaValue = useCallback((): number | null => {
    if (isEditMode && editedPolygon && editedPolygon.length >= 3)
      return calculatePolygonArea(editedPolygon);
    return viewingSite?.area_hectares ?? null;
  }, [isEditMode, editedPolygon, viewingSite?.area_hectares]);

  const formatDisplayArea = useCallback((): string => {
    const area = getDisplayAreaValue();
    if (area === null) return "Area not calculated";
    return viewAreaUnit === "ha"
      ? `${area.toFixed(2)} ha`
      : `${(area * 10000).toFixed(2)} m²`;
  }, [getDisplayAreaValue, viewAreaUnit]);

  const addNewPolygonPoint = useCallback(
    (newPoint: [number, number]) => {
      const map = mapRef.current;
      if (!map) return;
      const updatedPoints = [...newPolygonPoints, newPoint];
      setEditedPolygon(updatedPoints);
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
          setEditedPolygon(newPoints);
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
    [newPolygonPoints],
  );

  const handleSnapToMarker = useCallback(
    (lat: number, lng: number) => {
      const snapped: [number, number] = [lat, lng];
      const map = mapRef.current;
      if (isDrawing) {
        setPolygonCoordinates((prev) => [...prev, snapped]);
        setAlert({
          type: "success",
          title: "Snapped to Assessment",
          message: "Vertex added from field assessment marker.",
        });
        return;
      }
      if (isDrawingNewPolygon) {
        addNewPolygonPoint(snapped);
        return;
      }
      if (isPickingMarkerLocation) {
        if (!map) return;
        setEditedMarker(snapped);
        if (editableMarkerRef.current) {
          editableMarkerRef.current.setLatLng(snapped);
        } else {
          const marker = L.marker(snapped, {
            draggable: true,
            icon: L.divIcon({
              className: "marker-edit",
              html: `<div style="background:#F97316;width:28px;height:28px;border-radius:50%;border:4px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;"><div style="width:10px;height:10px;background:white;border-radius:50%;"></div></div>`,
              iconSize: [28, 28],
              iconAnchor: [14, 28],
            }),
          }).addTo(map);
          marker.on("drag", (ev) => {
            const ll = ev.target.getLatLng();
            setEditedMarker([ll.lat, ll.lng]);
          });
          editableMarkerRef.current = marker;
        }
        setIsPickingMarkerLocation(false);
        setAlert({
          type: "success",
          title: "Snapped to Assessment",
          message: "Site marker set from field assessment marker.",
        });
        return;
      }
      if (isPlacingNewMarker) {
        if (!map) return;
        setEditedMarker(snapped);
        setIsPlacingNewMarker(false);
        const marker = L.marker(snapped, {
          draggable: true,
          icon: L.divIcon({
            className: "marker-edit",
            html: `<div style="background:#FF6B00;width:24px;height:24px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;"><div style="width:8px;height:8px;background:white;border-radius:50%;"></div></div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          }),
        }).addTo(map);
        marker.on("drag", (ev) => {
          const ll = ev.target.getLatLng();
          setEditedMarker([ll.lat, ll.lng]);
        });
        editableMarkerRef.current = marker;
        setAlert({
          type: "success",
          title: "Snapped to Assessment",
          message:
            "Site marker placed from field assessment marker. Drag to fine-tune.",
        });
        return;
      }
      if (isEditMode) {
        if (editedPolygon && editedPolygon.length >= 3) {
          const newCoords = [...editedPolygon, snapped];
          setEditedPolygon(newCoords);
          if (editablePolygonRef.current)
            editablePolygonRef.current.setLatLngs(newCoords);
          renderAllMarkersRef.current(newCoords);
          setAlert({
            type: "success",
            title: "Snapped to Assessment",
            message: `Vertex ${newCoords.length} added from field assessment marker.`,
          });
        } else {
          addNewPolygonPoint(snapped);
        }
        return;
      }
    },
    [
      isDrawing,
      isDrawingNewPolygon,
      isPickingMarkerLocation,
      isPlacingNewMarker,
      isEditMode,
      editedPolygon,
      addNewPolygonPoint,
    ],
  );

  const isDrawingMode =
    isDrawing ||
    isDrawingNewPolygon ||
    isPickingMarkerLocation ||
    isPlacingNewMarker ||
    isEditMode;

  const onMarkerClickRef = useRef<(id: number) => void>(() => {});

  const fieldAssessments = useFieldAssessments(
    mapRef,
    true,
    isDrawingMode,
    handleSnapToMarker,
    (id: number) => onMarkerClickRef.current(id),
  );

  const handleMarkerClick = useCallback(
    (fieldAssessmentId: number) => {
      const currentAssessments =
        fieldAssessments.assessments[fieldAssessments.activeLayer];
      const originalIdx = currentAssessments.findIndex(
        (a) => a.field_assessment_id === fieldAssessmentId,
      );
      if (originalIdx !== -1) {
        fieldAssessments.setSelectedIndex(originalIdx);
      }
    },
    [
      fieldAssessments.assessments,
      fieldAssessments.activeLayer,
      fieldAssessments.setSelectedIndex,
    ],
  );

  useEffect(() => {
    onMarkerClickRef.current = handleMarkerClick;
  }, [handleMarkerClick]);

  // ✅ UPDATED: Effect to draw/remove the boundary polygon with clickable vertices
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clean up previous polygon and markers
    if (boundaryPolygonRef.current) {
      map.removeLayer(boundaryPolygonRef.current);
      boundaryPolygonRef.current = null;
    }
    boundaryVertexMarkersRef.current.forEach((marker) => {
      map.removeLayer(marker);
    });
    boundaryVertexMarkersRef.current = [];

    if (showingPolygonId) {
      const allAssessments = Object.values(fieldAssessments.assessments).flat();
      const entry = allAssessments.find(
        (a) => a.field_assessment_id === showingPolygonId,
      );

      if (entry) {
        const polygonPoints = entry.layer_data?.polygon_points;
        if (Array.isArray(polygonPoints) && polygonPoints.length >= 3) {
          const sortedPoints = [...polygonPoints].sort(
            (a, b) => (a.order || 0) - (b.order || 0),
          );
          const coords: [number, number][] = sortedPoints.map((p) => [
            p.latitude,
            p.longitude,
          ]);

          // Draw the polygon
          const polygon = L.polygon(coords, {
            color: "#7C3AED",
            fillColor: "rgba(124, 58, 237, 0.15)",
            fillOpacity: 0.4,
            weight: 3,
            dashArray: "5, 5",
          }).addTo(map);

          polygon.bindPopup(
            `<div style="font-family:sans-serif;"><strong>Boundary Polygon</strong><br/>Vertices: ${coords.length}</div>`,
          );
          boundaryPolygonRef.current = polygon;

          // ✅ NEW: Add clickable vertex markers
          coords.forEach((coord, idx) => {
            const vertexMarker = L.marker(coord, {
              icon: L.divIcon({
                className: "boundary-vertex-marker",
                html: `<div style="background:#7C3AED;width:18px;height:18px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:10px;color:white;font-weight:bold;cursor:pointer;">${idx + 1}</div>`,
                iconSize: [18, 18],
                iconAnchor: [9, 9],
              }),
            }).addTo(map);

            vertexMarker.bindTooltip(
              isDrawing ? "Click to add vertex" : `Vertex ${idx + 1}`,
              { permanent: false, direction: "top" },
            );

            vertexMarker.on("click", (e: L.LeafletMouseEvent) => {
              L.DomEvent.stopPropagation(e);
              if (isDrawing) {
                setPolygonCoordinates((prev) => [...prev, coord]);
                setAlert({
                  type: "success",
                  title: "Vertex Added",
                  message: `Added vertex ${idx + 1} from boundary polygon.`,
                });
              }
            });

            boundaryVertexMarkersRef.current.push(vertexMarker);
          });
        }
      }
    }
  }, [showingPolygonId, fieldAssessments.assessments, isDrawing]);

  // ✅ NEW: Handler to use all coordinates from boundary polygon
  const handleUseAllPolygonCoordinates = useCallback(() => {
    if (!showingPolygonId) return;

    const allAssessments = Object.values(fieldAssessments.assessments).flat();
    const entry = allAssessments.find(
      (a) => a.field_assessment_id === showingPolygonId,
    );

    if (entry) {
      const polygonPoints = entry.layer_data?.polygon_points;
      if (Array.isArray(polygonPoints) && polygonPoints.length >= 3) {
        const sortedPoints = [...polygonPoints].sort(
          (a, b) => (a.order || 0) - (b.order || 0),
        );
        const coords: [number, number][] = sortedPoints.map((p) => [
          p.latitude,
          p.longitude,
        ]);

        // If user already has some vertices, ask for confirmation
        if (polygonCoordinates.length > 0) {
          setConfirmDialog({
            title: "Replace Current Vertices?",
            message: `You have ${polygonCoordinates.length} vertex/vertices. Do you want to replace them with all ${coords.length} vertices from the boundary polygon?`,
            variant: "warning",
            confirmLabel: "Replace All",
            onConfirm: () => {
              setPolygonCoordinates(coords);
              setConfirmDialog(null);
              setAlert({
                type: "success",
                title: "Vertices Copied",
                message: `Added all ${coords.length} vertices from boundary polygon.`,
              });
            },
          });
        } else {
          setPolygonCoordinates(coords);
          setAlert({
            type: "success",
            title: "Vertices Copied",
            message: `Added all ${coords.length} vertices from boundary polygon.`,
          });
        }
      }
    }
  }, [showingPolygonId, fieldAssessments.assessments, polygonCoordinates]);

  const sites = useSites();
  const potentialSitesHook = usePotentialSites();
  const hazardLayers = useHazardLayers(mapRef);
  const barangayAreas = useBarangayAreas(mapRef);

  const tempFaLocationMarkerRef = useRef<L.Marker | null>(null);
  const [tempFaLocationCoords, setTempFaLocationCoords] = useState<
    [number, number] | null
  >(null);
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
      if (isProcessingActionRef.current) {
        isProcessingActionRef.current = false;
        return;
      }
      const coords: [number, number] = [e.latlng.lat, e.latlng.lng];
      setTempFaLocationCoords(coords);
      updateTempFaLocationMarker(coords);
    },
    [updateTempFaLocationMarker],
  );

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
          dateFilter,
        );
      }
    },
    [
      areaId,
      assessmentType,
      selectedSiteIdForFilter,
      fieldAssessments,
      dateFilter,
    ],
  );

  const openReassignModal = async (assessment: FieldAssessmentEntry) => {
    setReassignTargetAssessment(assessment);
    setReassignSearchQuery("");
    setShowReassignModal(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${api_second}/api/get_all_sites_for_reassignment/${areaId}/`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (res.ok) {
        const data = await res.json();
        setAvailableSites(data.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch sites for reassignment", err);
    }
  };

  const handleReassign = async (siteId: number | null) => {
    if (!reassignTargetAssessment) return;
    setIsReassigning(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${api_second}/api/field_assessments/${reassignTargetAssessment.field_assessment_id}/reassign/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ site_id: siteId }),
        },
      );
      const data = await res.json();
      if (res.ok) {
        setAlert({ type: "success", title: "Success", message: data.message });
        setShowReassignModal(false);
        setReassignTargetAssessment(null);
        handleFetchLayer(fieldAssessments.activeLayer);
      } else {
        setAlert({
          type: "error",
          title: "Failed",
          message: data.error || "Failed to reassign",
        });
      }
    } catch (err: any) {
      setAlert({
        type: "error",
        title: "Error",
        message: err.message || "Network error",
      });
    } finally {
      setIsReassigning(false);
    }
  };

  const handleDropProbe = useCallback((lat: number, lng: number) => {
    const map = mapRef.current;
    if (!map) return;
    if (probeMarkerRef.current) map.removeLayer(probeMarkerRef.current);
    const latDMS = decimalToDMS(lat, "lat");
    const lngDMS = decimalToDMS(lng, "lng");
    const popupContent = `
<div style="font-family: sans-serif; min-width: 180px;">
  <h4 style="margin: 0 0 8px 0; font-size: 13px; font-weight: bold; color: #7e22ce; border-bottom: 1px solid #e9d5ff; padding-bottom: 4px;"> Dropped Pin</h4>
  <div style="margin-bottom: 8px;">
    <div style="font-size: 10px; color: #666; text-transform: uppercase; font-weight: bold; margin-bottom: 2px;">Latitude</div>
    <div style="font-size: 12px; font-weight: 600; font-family: monospace; color: #1f2937;">${lat.toFixed(6)}</div>
    <div style="font-size: 10px; color: #888;">${latDMS}</div>
  </div>
  <div style="margin-bottom: 12px;">
    <div style="font-size: 10px; color: #666; text-transform: uppercase; font-weight: bold; margin-bottom: 2px;">Longitude</div>
    <div style="font-size: 12px; font-weight: 600; font-family: monospace; color: #1f2937;">${lng.toFixed(6)}</div>
    <div style="font-size: 10px; color: #888;">${lngDMS}</div>
  </div>
  <button id="clear-probe-btn" style="width: 100%; padding: 6px; background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 12px; transition: background 0.2s;">Clear Pin</button>
</div>`;
    const marker = L.marker([lat, lng], {
      icon: createMarkerIcon("temp", "Probe"),
    }).addTo(map);
    marker.bindPopup(popupContent).openPopup();
    marker.on("popupopen", () => {
      const btn = document.getElementById("clear-probe-btn");
      if (btn) {
        btn.onclick = () => {
          if (probeMarkerRef.current && mapRef.current) {
            mapRef.current.removeLayer(probeMarkerRef.current);
            probeMarkerRef.current = null;
          }
        };
        btn.onmouseover = () => (btn.style.background = "#dc2626");
        btn.onmouseout = () => (btn.style.background = "#ef4444");
      }
    });
    probeMarkerRef.current = marker;
  }, []);

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
            const normalizedCoords = normalizeCoordinates(
              detail.polygon_coordinates,
            );
            if (normalizedCoords.length >= 3) {
              polygonRef.current = L.polygon(normalizedCoords, {
                color: "#22C55E",
                fillColor: "#81C784",
                fillOpacity: 0.6,
                weight: 4,
              }).addTo(mapRef.current!);
              mapRef.current?.fitBounds(polygonRef.current.getBounds(), {
                padding: [50, 50],
              });
            }
          } else if (detail.marker_coordinate) {
            const normalizedMarker = normalizeMarkerCoordinate(
              detail.marker_coordinate,
            );
            if (normalizedMarker) {
              const siteMarker = L.marker(normalizedMarker, {
                icon: createMarkerIcon("site", detail.name),
              }).addTo(mapRef.current!);
              siteMarker.bindPopup(
                `<div style="text-align:center;font-family:sans-serif;"><strong style="color:#22C55E;font-size:14px;">${detail.name}</strong><br/><span style="font-size:11px;color:#666;">Site Location</span><br/><span style="font-size:10px;color:#999;font-family:monospace;">${normalizedMarker[0].toFixed(6)}, ${normalizedMarker[1].toFixed(6)}</span></div>`,
              );
              mapRef.current?.setView(normalizedMarker, 17);
            }
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
    if (editableMarkerRef.current) {
      mapRef.current?.removeLayer(editableMarkerRef.current);
      editableMarkerRef.current = null;
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
          maxZoom: 22,
          maxNativeZoom: 19,
        },
      ).addTo(mapRef.current);
      L.control
        .scale({ imperial: false, position: "bottomleft" })
        .addTo(mapRef.current);
      const handleMouseMove = (e: L.LeafletMouseEvent) =>
        setMouseCoords({ lat: e.latlng.lat, lng: e.latlng.lng });
      const handleMouseOut = () => setMouseCoords(null);
      mapRef.current.on("mousemove", handleMouseMove);
      mapRef.current.on("mouseout", handleMouseOut);
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
        if (mapRef.current) {
          mapRef.current.off("mousemove", handleMouseMove);
          mapRef.current.off("mouseout", handleMouseOut);
          mapRef.current?.remove();
        }
        mapRef.current = null;
      };
    }
  }, [areaId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const reforestationArea = sites.reforestationArea;
    if (reforestationArea && reforestationArea.coordinate) {
      if (!hasInitialAreaLoadRef.current) {
        const [lat, lng] = reforestationArea.coordinate;
        map.flyTo([lat, lng], 14, { duration: 1.2 });
        hasInitialAreaLoadRef.current = true;
      }
    }
  }, [sites.reforestationArea]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    siteMarkersRef.current.forEach((marker) => map.removeLayer(marker));
    siteMarkersRef.current = [];
    if (!showSites || !sites.sites.length) return;
    sites.sites.forEach((site) => {
      const normalizedCoord = normalizeMarkerCoordinate(site.marker_coordinate);
      if (normalizedCoord) {
        const marker = L.marker(normalizedCoord, {
          icon: createMarkerIcon("site", site.name),
        }).addTo(map);
        marker.bindPopup(
          `<div style="text-align:center;font-family:sans-serif;"><strong style="color:#22C55E;font-size:13px;">${site.name}</strong><br/><span style="font-size:11px;color:#666;">${site.metrics?.area_hectares?.toFixed(2) || "0.00"} ha</span><br/><span style="font-size:11px;color:#666; text-transform:capitalize;">${site.status}</span></div>`,
        );
        marker.on("click", () => handleViewSite(site));
        siteMarkersRef.current.push(marker);
      }
    });
    return () => {
      siteMarkersRef.current.forEach((marker) => map.removeLayer(marker));
      siteMarkersRef.current = [];
    };
  }, [sites.sites, handleViewSite, showSites]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    barangayMarkersRef.current.forEach((marker) => map.removeLayer(marker));
    barangayMarkersRef.current = [];
    if (!barangayAreas.barangayList.length) return;
    barangayAreas.barangayList.forEach((barangay) => {
      const normalizedCoord = normalizeMarkerCoordinate([
        barangay.coordinate[0],
        barangay.coordinate[1],
      ]);
      if (normalizedCoord) {
        const marker = L.marker(normalizedCoord, {
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
      const normalizedCoord = normalizeMarkerCoordinate(
        reforestationArea.coordinate,
      );
      if (normalizedCoord) {
        const [lat, lng] = normalizedCoord;
        areaMarkerRef.current = L.marker([lat, lng], {
          icon: createMarkerIcon("reforestation", reforestationArea.name),
        }).addTo(map);
        areaMarkerRef.current.bindPopup(
          `<div style="text-align:center;font-family:sans-serif;"><strong style="color:#2563eb;font-size:14px;">${reforestationArea.name}</strong><br/><span style="font-size:11px;color:#666;">Area ID: ${areaId}</span></div>`,
        );
      }
    }
    return () => {
      if (areaMarkerRef.current) map.removeLayer(areaMarkerRef.current);
    };
  }, [areaId, sites.reforestationArea, showReforestationArea]);

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
          color,
          fillColor,
          fillOpacity: 0.5,
          weight: 2,
          dashArray: "4, 4",
        }).addTo(map);
        polygon.bindPopup(
          `<div style="text-align:center;font-family:sans-serif;"><strong style="color:#2563eb;font-size:13px;">Potential Site</strong><br/><span style="font-size:11px;color:#666;">Suitability: ${score}%</span></div>`,
        );
        potentialSiteLayersRef.current.push(polygon);
      }
    });
    return () => {
      potentialSiteLayersRef.current.forEach((layer) => map.removeLayer(layer));
      potentialSiteLayersRef.current = [];
    };
  }, [showPotentialSites, potentialSitesHook.potentialSites]);

  useEffect(() => {
    if (!isDrawing || !mapRef.current) return;
    if (drawingLineRef.current) mapRef.current.removeLayer(drawingLineRef.current);
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
      if (isDrawing)
        setPolygonCoordinates((prev) => [
          ...prev,
          [e.latlng.lat, e.latlng.lng],
        ]);
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
    setIsDrawingFinished(false);
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
      message: "Click the map, snap to markers, or click boundary polygon vertices.",
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
    setIsDrawingFinished(true);
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
    setAlert({
      type: "success",
      title: "Drawing Finished",
      message: `${coords.length} points defined. Preview the polygon and continue to name your site.`,
    });
  };

  const continueToNameSite = () => setShowNameInput(true);

  const redrawPolygon = () => {
    if (polygonRef.current && mapRef.current) {
      mapRef.current.removeLayer(polygonRef.current);
      polygonRef.current = null;
    }
    creationVertexMarkersRef.current.forEach((m) =>
      mapRef.current?.removeLayer(m),
    );
    creationVertexMarkersRef.current = [];
    setIsDrawingFinished(false);
    setIsDrawing(true);
    setPolygonCoordinates([]);
    setPolygonArea(null);
    setAlert({
      type: "success",
      title: "Redrawing",
      message: "Click the map to place new vertices.",
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
    setIsDrawingFinished(false);
    setShowNameInput(false);
    setSiteName("");
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
    const map = mapRef.current;
    const currentZoom = map?.getZoom();
    const currentCenter = map?.getCenter();
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
        if (areaId) await sites.fetchMCDAData(areaId);
        setTimeout(() => {
          if (map && currentZoom !== undefined && currentCenter) {
            map.invalidateSize();
            map.setView(currentCenter, currentZoom, { animate: false });
          }
        }, 100);
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
      if (newCoords.length >= 3) setPolygonArea(calculatePolygonArea(newCoords));
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
      if (newCoords.length >= 3) setPolygonArea(calculatePolygonArea(newCoords));
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
      addNewPolygonPoint([e.latlng.lat, e.latlng.lng]);
    },
    [isDrawingNewPolygon, addNewPolygonPoint],
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

  const handleMapClickForNewMarker = useCallback(
    (e: L.LeafletMouseEvent) => {
      if (!isPlacingNewMarker) return;
      const map = mapRef.current;
      if (!map) return;
      const newMarker: [number, number] = [e.latlng.lat, e.latlng.lng];
      setEditedMarker(newMarker);
      setIsPlacingNewMarker(false);
      const marker = L.marker(newMarker, {
        draggable: true,
        icon: L.divIcon({
          className: "marker-edit",
          html: `<div style="background:#FF6B00;width:24px;height:24px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;"><div style="width:8px;height:8px;background:white;border-radius:50%;"></div></div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        }),
      }).addTo(map);
      marker.on("drag", (ev) => {
        const latlng = ev.target.getLatLng();
        setEditedMarker([latlng.lat, latlng.lng]);
      });
      editableMarkerRef.current = marker;
      setAlert({
        type: "success",
        title: "Marker Placed",
        message: "Site marker placed. Drag to adjust position.",
      });
    },
    [isPlacingNewMarker],
  );

  const handleAutoMarker = useCallback(() => {
    if (!editedPolygon || editedPolygon.length < 3) {
      setAlert({
        type: "failed",
        title: "Need Polygon",
        message: "Draw a polygon first before auto-calculating marker.",
      });
      return;
    }
    const sumLat = editedPolygon.reduce((sum, p) => sum + p[0], 0);
    const sumLng = editedPolygon.reduce((sum, p) => sum + p[1], 0);
    const marker: [number, number] = [
      sumLat / editedPolygon.length,
      sumLng / editedPolygon.length,
    ];
    setEditedMarker(marker);
    setIsPlacingNewMarker(false);
    if (editableMarkerRef.current)
      mapRef.current?.removeLayer(editableMarkerRef.current);
    const map = mapRef.current;
    if (!map) return;
    const markerIcon = L.marker(marker, {
      draggable: true,
      icon: L.divIcon({
        className: "marker-edit",
        html: `<div style="background:#FF6B00;width:24px;height:24px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;"><div style="width:8px;height:8px;background:white;border-radius:50%;"></div></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      }),
    }).addTo(map);
    markerIcon.on("drag", (e) => {
      const latlng = e.target.getLatLng();
      setEditedMarker([latlng.lat, latlng.lng]);
    });
    editableMarkerRef.current = markerIcon;
    setAlert({
      type: "success",
      title: "Marker Calculated",
      message: "Marker auto-calculated from polygon. You can drag to adjust.",
    });
  }, [editedPolygon]);

  const exitEditMode = useCallback(() => {
    setIsEditMode(false);
    setEditedPolygon(null);
    setEditedMarker(null);
    setIsDrawingNewPolygon(false);
    setIsPlacingNewMarker(false);
    setIsPickingMarkerLocation(false);
    setNewPolygonPoints([]);
    setShowCoordinateModal(false);
    setShowViewingSitePolygon(true);
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

  const handleEnterEditMode = useCallback(() => {
    if (!viewingSite) return;
    setIsEditMode(true);
    const initialPolygon =
      viewingSite.polygon_coordinates &&
      viewingSite.polygon_coordinates.length > 0
        ? [...viewingSite.polygon_coordinates]
        : [];
    setEditedPolygon(initialPolygon);
    setEditedMarker(
      viewingSite.marker_coordinate ? [...viewingSite.marker_coordinate] : null,
    );
    if (polygonRef.current) {
      mapRef.current?.removeLayer(polygonRef.current);
      polygonRef.current = null;
    }
    const hasPolygon = initialPolygon.length > 0;
    const hasMarker = !!viewingSite.marker_coordinate;
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
      setIsDrawingNewPolygon(true);
      setNewPolygonPoints([]);
      setAlert({
        type: "success",
        title: "Draw Polygon",
        message:
          "Click the map or click an assessment marker to snap a vertex.",
      });
    }
    setShowCoordinateModal(true);
    if (hasMarker) {
      const marker = L.marker(viewingSite.marker_coordinate!, {
        draggable: true,
        icon: L.divIcon({
          className: "marker-edit",
          html: `<div style="background:#F97316;width:28px;height:28px;border-radius:50%;border:4px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;"><div style="width:10px;height:10px;background:white;border-radius:50%;"></div></div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 28],
        }),
      }).addTo(mapRef.current!);
      marker.on("drag", (e) => {
        const latlng = e.target.getLatLng();
        setEditedMarker([latlng.lat, latlng.lng]);
      });
      editableMarkerRef.current = marker;
    } else {
      setIsPlacingNewMarker(true);
    }
  }, [viewingSite]);

  const handleSaveCoordinates = useCallback(async () => {
    if (
      !viewingSite ||
      !editedPolygon ||
      editedPolygon.length < 3 ||
      !editedMarker
    ) {
      setAlert({
        type: "failed",
        title: "Missing Data",
        message:
          "Polygon must have at least 3 vertices and a marker coordinate is required.",
      });
      return;
    }
    const map = mapRef.current;
    const currentZoom = map?.getZoom();
    const currentCenter = map?.getCenter();
    setIsSavingCoordinates(true);
    try {
      const result = await sites.updateSiteCoordinates(
        viewingSite.site_id,
        editedPolygon,
        editedMarker,
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
        setTimeout(() => {
          if (map && currentZoom !== undefined && currentCenter) {
            map.invalidateSize();
            map.setView(currentCenter, currentZoom, { animate: false });
          }
        }, 100);
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
  }, [viewingSite, editedPolygon, editedMarker, sites, areaId, exitEditMode]);

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
          setShowViewingSitePolygon(true);
          if (polygonRef.current) {
            mapRef.current?.removeLayer(polygonRef.current);
            polygonRef.current = null;
          }
        },
      });
    } else {
      setViewingSite(null);
      setShowViewingSitePolygon(true);
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
      if (isDrawingNewPolygon) {
        setNewPolygonPoints(newCoords);
        const map = mapRef.current;
        if (map) {
          newPolygonMarkersRef.current.forEach((m) => map.removeLayer(m));
          newPolygonMarkersRef.current = [];
          if (newPolygonLineRef.current) {
            map.removeLayer(newPolygonLineRef.current);
            newPolygonLineRef.current = null;
          }
          newCoords.forEach((pt, idx) => {
            const marker = L.marker(pt, {
              icon: L.divIcon({
                className: "new-polygon-vertex",
                html: `<div style="background:#FF6B00;width:16px;height:16px;border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:8px;color:white;font-weight:bold;">${idx + 1}</div>`,
                iconSize: [16, 16],
                iconAnchor: [8, 8],
              }),
            }).addTo(map);
            newPolygonMarkersRef.current.push(marker);
          });
          if (newCoords.length >= 2)
            newPolygonLineRef.current = L.polyline(newCoords, {
              color: "#FF6B00",
              weight: 3,
              dashArray: "5, 5",
            }).addTo(map);
        }
      }
      if (editablePolygonRef.current)
        editablePolygonRef.current.setLatLngs(newCoords);
      renderAllMarkersRef.current(newCoords);
    },
    [editedPolygon, isDrawingNewPolygon],
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
      if (isDrawingNewPolygon) {
        setNewPolygonPoints(newCoords);
        const map = mapRef.current;
        if (map) {
          newPolygonMarkersRef.current.forEach((m) => map.removeLayer(m));
          newPolygonMarkersRef.current = [];
          if (newPolygonLineRef.current) {
            map.removeLayer(newPolygonLineRef.current);
            newPolygonLineRef.current = null;
          }
          newCoords.forEach((pt, idx) => {
            const marker = L.marker(pt, {
              icon: L.divIcon({
                className: "new-polygon-vertex",
                html: `<div style="background:#FF6B00;width:16px;height:16px;border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:8px;color:white;font-weight:bold;">${idx + 1}</div>`,
                iconSize: [16, 16],
                iconAnchor: [8, 8],
              }),
            }).addTo(map);
            newPolygonMarkersRef.current.push(marker);
          });
          if (newCoords.length >= 2)
            newPolygonLineRef.current = L.polyline(newCoords, {
              color: "#FF6B00",
              weight: 3,
              dashArray: "5, 5",
            }).addTo(map);
        }
      }
      if (editablePolygonRef.current)
        editablePolygonRef.current.setLatLngs(newCoords);
      renderAllMarkersRef.current(newCoords);
    },
    [editedPolygon, isDrawingNewPolygon],
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
    if (isDrawingNewPolygon) {
      setNewPolygonPoints(newCoords);
      const map = mapRef.current;
      if (map) {
        newPolygonMarkersRef.current.forEach((m) => map.removeLayer(m));
        newPolygonMarkersRef.current = [];
        if (newPolygonLineRef.current) {
          map.removeLayer(newPolygonLineRef.current);
          newPolygonLineRef.current = null;
        }
        newCoords.forEach((pt, idx) => {
          const marker = L.marker(pt, {
            icon: L.divIcon({
              className: "new-polygon-vertex",
              html: `<div style="background:#FF6B00;width:16px;height:16px;border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:8px;color:white;font-weight:bold;">${idx + 1}</div>`,
              iconSize: [16, 16],
              iconAnchor: [8, 8],
            }),
          }).addTo(map);
          newPolygonMarkersRef.current.push(marker);
        });
        if (newCoords.length >= 2)
          newPolygonLineRef.current = L.polyline(newCoords, {
            color: "#FF6B00",
            weight: 3,
            dashArray: "5, 5",
          }).addTo(map);
      }
    }
    if (editablePolygonRef.current)
      editablePolygonRef.current.setLatLngs(newCoords);
    renderAllMarkersRef.current(newCoords);
  }, [editedPolygon, isDrawingNewPolygon]);

  const handleEditMarkerChange = useCallback(
    (axis: "lat" | "lng", value: string) => {
      const numValue = parseFloat(value);
      if (isNaN(numValue)) return;
      const newMarker: [number, number] = editedMarker ? [...editedMarker] : [0, 0];
      if (axis === "lat") newMarker[0] = numValue;
      else newMarker[1] = numValue;
      setEditedMarker(newMarker);
      if (editableMarkerRef.current)
        editableMarkerRef.current.setLatLng(newMarker);
    },
    [editedMarker],
  );

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const handleClick = (e: L.LeafletMouseEvent) => {
      if (isCoordinateProbeMode) {
        handleDropProbe(e.latlng.lat, e.latlng.lng);
        return;
      }
      if (isPickingMarkerLocation) {
        const newMarker: [number, number] = [e.latlng.lat, e.latlng.lng];
        setEditedMarker(newMarker);
        if (editableMarkerRef.current) {
          editableMarkerRef.current.setLatLng(newMarker);
        } else {
          const marker = L.marker(newMarker, {
            draggable: true,
            icon: L.divIcon({
              className: "marker-edit",
              html: `<div style="background:#F97316;width:28px;height:28px;border-radius:50%;border:4px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;"><div style="width:10px;height:10px;background:white;border-radius:50%;"></div></div>`,
              iconSize: [28, 28],
              iconAnchor: [14, 28],
            }),
          }).addTo(map);
          marker.on("drag", (ev) => {
            const latlng = ev.target.getLatLng();
            setEditedMarker([latlng.lat, latlng.lng]);
          });
          editableMarkerRef.current = marker;
        }
        setIsPickingMarkerLocation(false);
        setAlert({
          type: "success",
          title: "Marker Placed",
          message: "Site marker updated from map click.",
        });
        return;
      }
      if (isDrawingNewPolygon) handleMapClickForNewPolygon(e);
      else if (isPlacingNewMarker) handleMapClickForNewMarker(e);
      else if (barangayAreas.isDrawingHazard)
        barangayAreas.addHazardPoint(e.latlng.lat, e.latlng.lng);
      else if (barangayAreas.isMapEditMode && barangayAreas.showHazardForm)
        barangayAreas.addVertexOnMap(e.latlng.lat, e.latlng.lng);
      else if (fieldAssessments.locationTargetId)
        handleMapClickForFaLocation(e);
    };
    const handleDblClick = () => {
      if (
        barangayAreas.isDrawingHazard &&
        barangayAreas.hazardPolygonPoints.length >= 3
      )
        barangayAreas.finishDrawingHazard();
    };
    const isAnyDrawing =
      isDrawingNewPolygon ||
      isPlacingNewMarker ||
      isPickingMarkerLocation ||
      isCoordinateProbeMode ||
      barangayAreas.isDrawingHazard ||
      (barangayAreas.isMapEditMode && barangayAreas.showHazardForm) ||
      !!fieldAssessments.locationTargetId;
    if (isAnyDrawing) {
      map.getContainer().style.cursor = "crosshair";
      map.on("click", handleClick);
      if (barangayAreas.isDrawingHazard) map.on("dblclick", handleDblClick);
    } else {
      map.getContainer().style.cursor = "";
    }
    return () => {
      map.off("click", handleClick);
      map.off("dblclick", handleDblClick);
      if (!isAnyDrawing) map.getContainer().style.cursor = "";
    };
  }, [
    isDrawingNewPolygon,
    isPlacingNewMarker,
    isPickingMarkerLocation,
    isCoordinateProbeMode,
    barangayAreas.isDrawingHazard,
    barangayAreas.isMapEditMode,
    barangayAreas.showHazardForm,
    barangayAreas.hazardPolygonPoints,
    handleMapClickForNewPolygon,
    handleMapClickForNewMarker,
    barangayAreas.addHazardPoint,
    barangayAreas.addVertexOnMap,
    barangayAreas.finishDrawingHazard,
    fieldAssessments.locationTargetId,
    handleMapClickForFaLocation,
    handleDropProbe,
  ]);

  const activeAssessments =
    fieldAssessments.assessments[fieldAssessments.activeLayer] ?? [];

  const processedAssessments = useMemo(() => {
    let result = [...activeAssessments];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((entry) => {
        const title = (
          entry.title || `Assessment ${entry.field_assessment_id}`
        ).toLowerCase();
        const inspector = entry.inspector.full_name.toLowerCase();
        const faId = entry.field_assessment_id.toString();
        return (
          title.includes(q) || inspector.includes(q) || faId.includes(q)
        );
      });
    }
    if (dateFilter.start_date || dateFilter.end_date) {
      result = result.filter((entry) => {
        const entryDateStr = entry.assessment_date || entry.created_at;
        if (!entryDateStr) return false;
        const d = new Date(entryDateStr);
        if (dateFilter.start_date && d < new Date(dateFilter.start_date))
          return false;
        if (
          dateFilter.end_date &&
          d > new Date(dateFilter.end_date + "T23:59:59")
        )
          return false;
        return true;
      });
    }
    result.sort((a, b) => {
      const dateA = new Date(a.assessment_date || a.created_at).getTime();
      const dateB = new Date(b.assessment_date || b.created_at).getTime();
      if (sortBy === "date_desc") return dateB - dateA;
      if (sortBy === "date_asc") return dateA - dateB;
      if (sortBy === "inspector_asc")
        return a.inspector.full_name.localeCompare(b.inspector.full_name);
      if (sortBy === "inspector_desc")
        return b.inspector.full_name.localeCompare(a.inspector.full_name);
      return 0;
    });
    return result;
  }, [activeAssessments, searchQuery, sortBy, dateFilter]);

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
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowSites(!showSites)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition text-xs font-medium ${
                showSites
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "bg-gray-100 hover:bg-gray-200 text-gray-700"
              }`}
            >
              <MapPin size={12} /> {showSites ? "Hide Sites" : "Show Sites"}
            </button>
            <button
              onClick={() => setShowReforestationArea(!showReforestationArea)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition text-xs font-medium ${
                showReforestationArea
                  ? "bg-blue-600 hover:bg-blue-700 text-white"
                  : "bg-gray-100 hover:bg-gray-200 text-gray-700"
              }`}
            >
              <Leaf size={12} />{" "}
              {showReforestationArea ? "Hide Area" : "Show Area"}
            </button>
            <div className="w-px h-5 bg-gray-200 mx-0.5" />
            <button
              onClick={() => setShowPotentialSites((v) => !v)}
              disabled={potentialSitesHook.loading}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition text-xs font-medium disabled:opacity-40 ${
                showPotentialSites
                  ? "bg-blue-600 hover:bg-blue-700 text-white"
                  : "bg-gray-100 hover:bg-gray-200 text-gray-700"
              }`}
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
              onClick={() => setIsCoordinateProbeMode(!isCoordinateProbeMode)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition text-xs font-medium ${
                isCoordinateProbeMode
                  ? "bg-purple-600 hover:bg-purple-700 text-white"
                  : "bg-gray-100 hover:bg-gray-200 text-gray-700"
              }`}
            >
              <Target size={12} />{" "}
              {isCoordinateProbeMode ? "Exit Probe" : "Drop Pin"}
            </button>
            <div className="w-px h-5 bg-gray-200 mx-0.5" />
            <button
              onClick={() =>
                hazardLayers.setIsPanelOpen(!hazardLayers.isPanelOpen)
              }
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition text-xs font-medium ${
                hazardLayers.isPanelOpen
                  ? "bg-red-600 hover:bg-red-700 text-white"
                  : "bg-gray-100 hover:bg-gray-200 text-gray-700"
              }`}
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
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition text-xs font-medium ${
                  barangayAreas.isDrawingHazard
                    ? "bg-yellow-500 text-white cursor-wait"
                    : !barangayAreas.selectedBarangayId
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-yellow-500 hover:bg-yellow-600 text-white"
                }`}
              >
                <Pen size={12} />{" "}
                {barangayAreas.isDrawingHazard ? "Drawing..." : "Draw Hazard"}
              </button>
            </div>
          </div>
        </div>

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
                  <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                    {getDisplayAreaValue() !== null ? (
                      <button
                        onClick={() =>
                          setViewAreaUnit(viewAreaUnit === "ha" ? "sqm" : "ha")
                        }
                        className="flex items-center gap-1 hover:text-green-700 hover:bg-green-50 px-1.5 py-0.5 rounded transition cursor-pointer group border border-transparent hover:border-green-200"
                        title="Click to toggle between hectares and square meters"
                      >
                        <Ruler size={10} />
                        <span className="font-semibold">
                          {formatDisplayArea()}
                        </span>
                        <span className="text-[9px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                          ({viewAreaUnit === "ha" ? "m²" : "ha"})
                        </span>
                      </button>
                    ) : (
                      <span>
                        {isEditMode &&
                        (!editedPolygon || editedPolygon.length < 3)
                          ? "Add vertices to calculate area"
                          : "Area not calculated"}
                      </span>
                    )}
                    <span>• {viewingSite.status}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {viewingSite.polygon_coordinates?.length ||
                (isEditMode && editedPolygon?.length) ? (
                  <button
                    onClick={() => {
                      const show = !showViewingSitePolygon;
                      setShowViewingSitePolygon(show);
                      if (isEditMode && editablePolygonRef.current) {
                        if (show)
                          editablePolygonRef.current.addTo(mapRef.current!);
                        else
                          mapRef.current?.removeLayer(
                            editablePolygonRef.current,
                          );
                      } else if (polygonRef.current) {
                        if (show) polygonRef.current.addTo(mapRef.current!);
                        else
                          mapRef.current?.removeLayer(polygonRef.current);
                      }
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded"
                  >
                    <Eye size={12} />{" "}
                    {showViewingSitePolygon ? "Hide Polygon" : "Show Polygon"}
                  </button>
                ) : null}
                {isEditMode ? (
                  <>
                    <span className="text-xs text-orange-600 font-medium bg-orange-50 px-2 py-1 rounded">
                      ️ Edit Mode
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
                        isSavingCoordinates ||
                        !editedPolygon ||
                        !editedMarker ||
                        editedPolygon.length < 3
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
                  center={editedMarker}
                  onVertexChange={handleEditVertexChange}
                  onRemoveVertex={handleEditRemoveVertex}
                  onAddVertex={handleEditAddVertex}
                  onCenterChange={handleEditMarkerChange}
                  title="Polygon Vertices"
                  isEditing={true}
                />
                {editedPolygon && editedPolygon.length >= 3 && (
                  <div className="mt-4 pt-4 border-t border-gray-200 flex gap-2 flex-wrap">
                    <button
                      onClick={handleAutoMarker}
                      className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg transition"
                    >
                      <Target size={14} /> Auto-Calculate Marker from Polygon
                    </button>
                    <button
                      onClick={() => {
                        const newState = !isPickingMarkerLocation;
                        setIsPickingMarkerLocation(newState);
                        if (newState)
                          setAlert({
                            type: "success",
                            title: "Pick Marker Mode",
                            message:
                              "Click the map or an assessment marker to place the site marker.",
                          });
                      }}
                      className={`flex items-center gap-2 px-4 py-2 text-white text-xs font-semibold rounded-lg transition ${
                        isPickingMarkerLocation
                          ? "bg-red-600 hover:bg-red-700"
                          : "bg-blue-600 hover:bg-blue-700"
                      }`}
                    >
                      <MapPin size={14} />{" "}
                      {isPickingMarkerLocation
                        ? "Cancel Pick"
                        : "Pick from Map"}
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
                      isSavingCoordinates ||
                      !editedPolygon ||
                      !editedMarker ||
                      editedPolygon.length < 3
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
            <div
              ref={mapContainerRef}
              className="w-full rounded-lg shadow-inner border-2 border-gray-300 relative overflow-hidden h-[75vh] min-h-[450px]"
            >
              <div className="absolute top-4 right-4 z-[1001] bg-white px-3 py-2 rounded-lg shadow-lg border border-gray-300 text-xs font-mono">
                <div className="flex items-center gap-2">
                  <Globe size={14} className="text-green-700" />
                  {mouseCoords ? (
                    <>
                      <span className="text-gray-600">
                        <strong>Lat:</strong>{" "}
                        {showDMS
                          ? decimalToDMS(mouseCoords.lat, "lat")
                          : mouseCoords.lat.toFixed(6)}
                      </span>
                      <span className="text-gray-600 ml-2">
                        <strong>Lng:</strong>{" "}
                        {showDMS
                          ? decimalToDMS(mouseCoords.lng, "lng")
                          : mouseCoords.lng.toFixed(6)}
                      </span>
                    </>
                  ) : (
                    <span className="text-gray-400">
                      Move mouse to see coordinates
                    </span>
                  )}
                  <button
                    onClick={() => setShowDMS(!showDMS)}
                    className="ml-2 px-2 py-0.5 bg-gray-100 hover:bg-gray-200 rounded text-[10px] font-semibold text-gray-600 transition-colors"
                  >
                    {showDMS ? "DMS" : "DD"}
                  </button>
                </div>
              </div>

              {isDrawing && (
                <div className="absolute top-3 left-3 bg-white/95 px-3 py-1.5 rounded-lg shadow-md border border-green-200 z-[100]">
                  <p className="text-xs font-semibold text-green-800">
                    Drawing Mode
                  </p>
                  <p className="text-[10px] text-gray-600">
                    Click map, snap to markers, or click boundary polygon vertices
                  </p>
                </div>
              )}
              {isDrawingFinished && (
                <div className="absolute top-3 left-3 bg-white/95 px-3 py-1.5 rounded-lg shadow-md border border-green-300 z-[100]">
                  <p className="text-xs font-semibold text-green-800">
                    ✓ Preview Mode
                  </p>
                  <p className="text-[10px] text-gray-600">
                    Polygon complete. Review and continue.
                  </p>
                </div>
              )}
              {polygonArea !== null &&
                (isDrawingFinished ||
                  (!isDrawing && polygonCoordinates.length >= 3)) && (
                  <button
                    onClick={() => setAreaUnit(areaUnit === "ha" ? "sqm" : "ha")}
                    className="absolute bottom-3 left-3 bg-white/95 px-2.5 py-1.5 rounded-lg shadow-md border border-green-200 z-[100] hover:bg-green-50 transition cursor-pointer"
                    title="Click to toggle between hectares and square meters"
                  >
                    <div className="flex items-center gap-1.5">
                      <Ruler size={12} className="text-green-600" />
                      <span className="text-xs font-semibold text-gray-800">
                        {displayArea(polygonArea)}
                      </span>
                      <span className="text-[9px] text-gray-400 ml-1">
                        ({areaUnit === "ha" ? "click for m²" : "click for ha"})
                      </span>
                    </div>
                  </button>
                )}
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
                        if (
                          tempFaLocationMarkerRef.current &&
                          fieldAssessments.locationTargetId
                        ) {
                          const latlng =
                            tempFaLocationMarkerRef.current.getLatLng();
                          const result =
                            await fieldAssessments.updateLocation(
                              fieldAssessments.locationTargetId,
                              latlng.lat,
                              latlng.lng,
                              20,
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
                            if (areaId)
                              handleFetchLayer(fieldAssessments.activeLayer);
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
                      <MapPin
                        size={32}
                        className="mx-auto mb-2 opacity-50"
                      />
                      <p>Click on the map to place your first vertex</p>
                      <p className="text-xs mt-1 text-gray-400">
                        or click boundary polygon vertices if visible
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
                    <CheckCircle size={18} /> Finish Drawing
                  </button>
                </div>
              </div>
            )}

            {isDrawingFinished && showCoordPanel && (
              <div className="fixed top-28 right-6 z-[9999] bg-white p-4 rounded-xl shadow-2xl border-2 border-green-500 w-96 max-h-[65vh] flex flex-col">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200">
                  <h4 className="font-bold text-sm text-green-800 flex items-center gap-2">
                    <CheckCircle size={16} /> Polygon Preview
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
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-lg p-3 mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-semibold text-gray-600 uppercase tracking-wide">
                      Total Area
                    </span>
                    <div className="flex items-center bg-white rounded-md border border-gray-200 overflow-hidden">
                      <button
                        onClick={() => setAreaUnit("ha")}
                        className={`px-2 py-1 text-[10px] font-bold transition ${
                          areaUnit === "ha"
                            ? "bg-green-600 text-white"
                            : "text-gray-600 hover:bg-gray-100"
                        }`}
                      >
                        ha
                      </button>
                      <button
                        onClick={() => setAreaUnit("sqm")}
                        className={`px-2 py-1 text-[10px] font-bold transition ${
                          areaUnit === "sqm"
                            ? "bg-green-600 text-white"
                            : "text-gray-600 hover:bg-gray-100"
                        }`}
                      >
                        m²
                      </button>
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-green-800">
                    {displayArea(polygonArea)}
                  </p>
                  <p className="text-[10px] text-gray-500 mt-1">
                    {areaUnit === "ha"
                      ? `≈ ${((polygonArea ?? 0) * 10000).toFixed(2)} m²`
                      : `≈ ${(polygonArea ?? 0).toFixed(2)} ha`}
                  </p>
                </div>
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 mb-3 max-h-[25vh]">
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
                          onClick={() => handleCreateRemoveVertex(idx)}
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
                              handleCreateVertexChange(
                                idx,
                                "lat",
                                e.target.value,
                              )
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
                              handleCreateVertexChange(
                                idx,
                                "lng",
                                e.target.value,
                              )
                            }
                            className="w-full text-xs border-2 border-gray-300 rounded px-2 py-1.5 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none font-mono font-semibold text-gray-800"
                          />
                        </div>
                      </div>
                      <button
                        onClick={() => handleCreateAddVertex()}
                        className="w-full mt-2 text-[10px] text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded py-1.5 flex items-center justify-center gap-1 transition font-semibold"
                      >
                        <Plus size={12} /> Add vertex
                      </button>
                    </div>
                  ))}
                </div>
                <div className="border-t-2 border-gray-200 pt-3 space-y-2">
                  <button
                    onClick={continueToNameSite}
                    className="w-full py-3 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-lg transition flex items-center justify-center gap-2 shadow-lg"
                  >
                    <CheckCircle size={18} /> Continue to Name Site
                  </button>
                  <button
                    onClick={redrawPolygon}
                    className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg transition flex items-center justify-center gap-2"
                  >
                    <Undo2 size={14} /> Redraw Polygon
                  </button>
                </div>
              </div>
            )}

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
            {isDrawingFinished && !showCoordPanel && (
              <button
                onClick={() => setShowCoordPanel(true)}
                className="fixed top-28 right-6 z-[9999] bg-white p-2.5 rounded-full shadow-xl border-2 border-green-500 hover:bg-green-50 transition flex items-center gap-2 group"
                title="Show preview panel"
              >
                <CheckCircle size={18} className="text-green-600" />
                <span className="text-xs font-bold text-green-700 pr-1 group-hover:block hidden transition-all">
                  Show Preview
                </span>
              </button>
            )}

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
                        (
                        <span className="font-semibold text-green-700">
                          {((polygonArea ?? 0) * 10000).toFixed(2)} m²
                        </span>
                        ) • Vertices:{" "}
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
                      className={`flex-1 py-3 rounded-lg text-sm font-bold transition flex items-center justify-center gap-2 ${
                        polygonArea
                          ? "bg-green-600 hover:bg-green-700 text-white shadow-lg"
                          : "bg-gray-200 text-gray-400 cursor-not-allowed"
                      }`}
                    >
                      <Save size={16} /> Save Site
                    </button>
                    <button
                      onClick={() => {
                        setShowNameInput(false);
                        setSiteName("");
                      }}
                      className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold rounded-lg transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

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

            <div className="bg-white rounded-lg border border-gray-200 px-3 py-2 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <Pen size={12} />{" "}
                  {polygonCoordinates.length > 0
                    ? `${polygonCoordinates.length} pts`
                    : "No polygon"}
                </span>
                {isDrawingFinished && polygonArea !== null && (
                  <button
                    onClick={() => setAreaUnit(areaUnit === "ha" ? "sqm" : "ha")}
                    className="flex items-center gap-1 text-green-700 font-semibold bg-green-50 hover:bg-green-100 px-2 py-0.5 rounded transition cursor-pointer"
                    title="Click to toggle between hectares and square meters"
                  >
                    <Ruler size={12} /> {displayArea(polygonArea)}
                  </button>
                )}
                {showPotentialSites &&
                  potentialSitesHook.potentialSites.length > 0 && (
                    <span className="flex items-center gap-1 text-blue-600">
                      <Target size={12} />{" "}
                      {potentialSitesHook.potentialSites.length} potential
                      site{potentialSitesHook.potentialSites.length !== 1
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
                      <CheckCircle size={12} /> Finish Drawing
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
                {isDrawingFinished && (
                  <>
                    <button
                      onClick={continueToNameSite}
                      className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded transition flex items-center gap-1"
                    >
                      <CheckCircle size={12} /> Continue to Name
                    </button>
                    <button
                      onClick={redrawPolygon}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded transition flex items-center gap-1"
                    >
                      <Undo2 size={12} /> Redraw
                    </button>
                  </>
                )}
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
                      disabled={
                        barangayAreas.hazardPolygonPoints.length === 0
                      }
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
                {!showNameInput &&
                  !isDrawing &&
                  !isDrawingFinished &&
                  !isDrawingNewPolygon && (
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
                  disabled={
                    !polygonCoordinates.length &&
                    !isDrawing &&
                    !isDrawingFinished
                  }
                  className="flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-3 py-1.5 rounded transition text-xs font-medium disabled:opacity-40"
                >
                  <Trash2 size={12} /> Clear
                </button>
              </div>
            </div>
          </div>

          {/* ✅ RIGHT PANEL: Field Assessments */}
          <div className="flex-[2] flex flex-col gap-3 min-w-0">
            <div className="flex-1 bg-white rounded-lg border border-gray-200 flex flex-col min-h-0">
              <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
                <h3 className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                  <Eye size={13} className="text-blue-500" /> Field Assessments
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      fieldAssessments.setShowAssessmentMarkers(
                        !fieldAssessments.showAssessmentMarkers,
                      )
                    }
                    className={`p-1 rounded transition ${
                      fieldAssessments.showAssessmentMarkers
                        ? "text-blue-500 hover:bg-blue-50"
                        : "text-gray-400 hover:bg-gray-100"
                    }`}
                    title={
                      fieldAssessments.showAssessmentMarkers
                        ? "Hide assessment markers on map"
                        : "Show assessment markers on map"
                    }
                  >
                    {fieldAssessments.showAssessmentMarkers ? (
                      <Eye size={14} />
                    ) : (
                      <EyeOff size={14} />
                    )}
                  </button>
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
                          fieldAssessments.loading[
                            fieldAssessments.activeLayer
                          ]
                            ? "animate-spin"
                            : ""
                        }
                      />{" "}
                      Refresh
                    </button>
                  )}
                </div>
              </div>

              <div className="px-3 py-2 border-b border-gray-100 bg-gray-50 flex flex-col gap-2">
                <div className="flex gap-1 bg-white rounded-lg p-1 border border-gray-200">
                  <button
                    onClick={() => {
                      setAssessmentType("specific");
                      const targetSiteId = viewingSite
                        ? String(viewingSite.site_id)
                        : selectedSiteIdForFilter;
                      handleFetchLayer(
                        fieldAssessments.activeLayer,
                        "specific",
                        targetSiteId,
                      );
                    }}
                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-md text-[10px] font-semibold transition ${
                      assessmentType === "specific"
                        ? "bg-green-500 text-white shadow-sm"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    <Target size={10} /> Specific{" "}
                    {viewingSite && (
                      <span className="text-[8px] opacity-80 ml-1">
                        (This Site)
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setAssessmentType("general");
                      handleFetchLayer(
                        fieldAssessments.activeLayer,
                        "general",
                      );
                    }}
                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-md text-[10px] font-semibold transition ${
                      assessmentType === "general"
                        ? "bg-blue-500 text-white shadow-sm"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    <MapPin size={10} /> General
                  </button>
                  <button
                    onClick={() => {
                      setAssessmentType("all");
                      setSelectedSiteIdForFilter(null);
                      handleFetchLayer(fieldAssessments.activeLayer, "all");
                    }}
                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-md text-[10px] font-semibold transition ${
                      assessmentType === "all"
                        ? "bg-gray-700 text-white shadow-sm"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    All
                  </button>
                </div>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search
                      size={12}
                      className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search title, inspector, or ID..."
                      className="w-full text-[10px] border border-gray-300 rounded-md pl-7 pr-8 py-1.5 focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="text-[10px] border border-gray-300 rounded-md px-2 py-1.5 focus:ring-1 focus:ring-blue-500 outline-none bg-white flex-shrink-0"
                  >
                    <option value="date_desc">Newest First</option>
                    <option value="date_asc">Oldest First</option>
                    <option value="inspector_asc">Inspector (A-Z)</option>
                    <option value="inspector_desc">Inspector (Z-A)</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="date"
                    value={dateFilter.start_date || ""}
                    onChange={(e) =>
                      setDateFilter((prev) => ({
                        ...prev,
                        start_date: e.target.value,
                      }))
                    }
                    className="text-[10px] border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500 outline-none"
                    placeholder="From"
                  />
                  <span className="text-[10px] text-gray-500">to</span>
                  <input
                    type="date"
                    value={dateFilter.end_date || ""}
                    onChange={(e) =>
                      setDateFilter((prev) => ({
                        ...prev,
                        end_date: e.target.value,
                      }))
                    }
                    className="text-[10px] border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500 outline-none"
                    placeholder="To"
                  />
                  <button
                    onClick={() =>
                      handleFetchLayer(fieldAssessments.activeLayer)
                    }
                    className="text-[10px] bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 transition"
                  >
                    Apply
                  </button>
                  {(dateFilter.start_date || dateFilter.end_date) && (
                    <button
                      onClick={() => {
                        setDateFilter({});
                        handleFetchLayer(fieldAssessments.activeLayer);
                      }}
                      className="text-[10px] text-gray-600 hover:text-red-600 px-2 py-1 rounded transition"
                    >
                      Clear
                    </button>
                  )}
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
                  const count =
                    fieldAssessments.assessments[l.id]?.length ?? 0;
                  const active = l.id === fieldAssessments.activeLayer;
                  return (
                    <button
                      key={l.id}
                      onClick={() => {
                        fieldAssessments.setActiveLayer(l.id);
                        if (
                          !fieldAssessments.assessments[l.id]?.length &&
                          areaId
                        )
                          handleFetchLayer(l.id);
                      }}
                      className={`flex-1 py-2 text-xs font-semibold transition relative border-b-2 ${
                        active
                          ? `${l.color} border-current`
                          : "text-gray-400 border-transparent hover:text-gray-600"
                      }`}
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

              <div className="flex-1 overflow-y-auto min-h-0 max-h-[60vh]">
                {!areaId ? (
                  <div className="p-4 text-center text-gray-400">
                    <p className="text-xs">No area selected</p>
                  </div>
                ) : fieldAssessments.loading[
                    fieldAssessments.activeLayer
                  ] ? (
                  <div className="p-4 text-center text-gray-400">
                    <p className="text-xs">Loading...</p>
                  </div>
                ) : processedAssessments.length === 0 ? (
                  <div className="p-4 text-center text-gray-400">
                    <p className="text-xs">
                      {searchQuery
                        ? "No matching assessments found."
                        : "No assessments"}
                    </p>
                    {!searchQuery && areaId && (
                      <button
                        onClick={() =>
                          areaId &&
                          handleFetchLayer(fieldAssessments.activeLayer)
                        }
                        className="mt-2 text-xs text-blue-500 hover:underline"
                      >
                        Try again
                      </button>
                    )}
                  </div>
                ) : (
                  processedAssessments.map(
                    (entry: FieldAssessmentEntry, idx: number) => {
                      const originalIdx = activeAssessments.findIndex(
                        (a) =>
                          a.field_assessment_id === entry.field_assessment_id,
                      );
                      const isSelected =
                        originalIdx === fieldAssessments.selectedIndex;
                      const faId = entry.field_assessment_id;
                      const hasLocation = !!entry.location?.latitude;
                      const isThisPickingLocation =
                        fieldAssessments.locationTargetId === faId;
                      const displayTitle =
                        entry.title || `Assessment #${faId}`;

                      // ✅ Check for polygon points in layer_data
                      const polygonPoints = entry.layer_data?.polygon_points;
                      const hasPolygon = Array.isArray(polygonPoints) && polygonPoints.length >= 3;
                      const isShowingPolygon = showingPolygonId === faId;

                      return (
                        <button
                          key={faId}
                          onClick={() => {
                            if (originalIdx !== -1) {
                              fieldAssessments.setSelectedIndex(originalIdx);
                              fieldAssessments.openPopup(fieldAssessments.activeLayer, originalIdx);
                            }
                          }}
                          className={`w-full text-left px-3 py-2.5 border-b border-gray-50 transition ${
                            isSelected
                              ? "bg-blue-50 border-l-2 border-l-blue-500"
                              : "hover:bg-gray-50"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {entry.inspector.profile_image && (
                              <img
                                src={
                                  api_second +
                                  `${entry.inspector.profile_image}`
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
                                  {displayTitle}
                                </span>
                                <span className="text-[10px] font-bold text-gray-400 flex-shrink-0 bg-gray-100 px-1.5 py-0.5 rounded">
                                  {entry.assessment_type === "specific"
                                    ? "Specific"
                                    : "General"}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-gray-600 font-medium">
                                  {entry.inspector.full_name}
                                </span>
                                <span className="text-[10px] text-gray-400">
                                  •
                                </span>
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
                                className="mt-1.5 flex items-center gap-2 flex-wrap"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {isThisPickingLocation ? (
                                  <button
                                    onClick={() =>
                                      fieldAssessments.setLocationTargetId(
                                        null,
                                      )
                                    }
                                    className="flex items-center gap-1 text-[10px] bg-orange-100 text-orange-700 border border-orange-300 px-2 py-0.5 rounded-full font-medium animate-pulse"
                                  >
                                    <X size={9} /> Cancel
                                  </button>
                                ) : (
                                  <button
                                    onClick={() =>
                                      fieldAssessments.setLocationTargetId(
                                        faId,
                                      )
                                    }
                                    className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium border transition ${
                                      hasLocation
                                        ? "bg-green-50 text-green-700 border-green-300 hover:bg-green-100"
                                        : "bg-orange-50 text-orange-700 border-orange-300 hover:bg-orange-100"
                                    }`}
                                  >
                                    <MapPin size={9} />{" "}
                                    {hasLocation
                                      ? "Update Location"
                                      : "Add Location"}
                                  </button>
                                )}

                                {/* ✅ UPDATED: Show/Hide Polygon Button */}
                                {hasPolygon && (
                                  <>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setShowingPolygonId(isShowingPolygon ? null : faId);
                                      }}
                                      className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium border transition ${
                                        isShowingPolygon
                                          ? "bg-purple-100 text-purple-700 border-purple-300 hover:bg-purple-200"
                                          : "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100"
                                      }`}
                                      title={isShowingPolygon ? "Hide boundary polygon on map" : "Show boundary polygon on map"}
                                    >
                                      <Layers size={9} /> {isShowingPolygon ? "Hide Polygon" : "Show Polygon"}
                                      <span className="text-[8px] opacity-75">({polygonPoints.length})</span>
                                    </button>

                                    {/* ✅ NEW: Use All Coordinates Button - only shows when in drawing mode */}
                                    {isDrawing && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleUseAllPolygonCoordinates();
                                        }}
                                        className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium border bg-green-50 text-green-700 border-green-300 hover:bg-green-100 transition"
                                        title="Copy all vertices from this polygon to your drawing"
                                      >
                                        <CheckCircle size={9} /> Use All ({polygonPoints.length})
                                      </button>
                                    )}
                                  </>
                                )}

                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (originalIdx !== -1) {
                                      fieldAssessments.flyToMarker(fieldAssessments.activeLayer, originalIdx);
                                    }
                                  }}
                                  className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium border bg-indigo-50 text-indigo-700 border-indigo-300 hover:bg-indigo-100 transition"
                                  title="Fly to this assessment on the map"
                                >
                                  <Navigation size={9} /> Fly To
                                </button>

                                <button
                                  onClick={() => openReassignModal(entry)}
                                  className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium border bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100 transition"
                                  title="Reassign to another site or make general"
                                >
                                  <MapPin size={9} /> Reassign
                                </button>
                                <button
                                  onClick={async () => {
                                    setConfirmDialog({
                                      title: "Unsent Assessment",
                                      message:
                                        "Are you sure you want to mark this assessment as unsent? It will be removed from the submitted list.",
                                      variant: "warning",
                                      confirmLabel: "Unsent",
                                      onConfirm: async () => {
                                        setConfirmDialog(null);
                                        const result =
                                          await fieldAssessments.unsentAssessment(
                                            entry.field_assessment_id,
                                          );
                                        if (result.success) {
                                          setAlert({
                                            type: "success",
                                            title: "Success",
                                            message:
                                              result.message ||
                                              "Assessment marked as unsent.",
                                          });
                                          handleFetchLayer(
                                            fieldAssessments.activeLayer,
                                          );
                                        } else {
                                          setAlert({
                                            type: "error",
                                            title: "Failed",
                                            message:
                                              result.message ||
                                              "Could not unsent assessment.",
                                          });
                                        }
                                      },
                                    });
                                  }}
                                  className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium border bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100 transition"
                                  title="Mark as unsent (GISSpecialist)"
                                >
                                  <Undo2 size={9} /> Unsent
                                </button>
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    },
                  )
                )}
              </div>
            </div>
          </div>
        </div>

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
            {activeAssessments.length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-400 min-h-[120px] flex items-center justify-center">
                <div>
                  <CheckCircle
                    size={32}
                    className="mx-auto mb-3 opacity-30"
                  />
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
                  if (
                    !fieldAssessments.assessments[layer].length &&
                    areaId
                  )
                    handleFetchLayer(layer);
                }}
                onSelectEntry={(idx) => {
                  fieldAssessments.setSelectedIndex(idx);
                  fieldAssessments.openPopup(fieldAssessments.activeLayer, idx);
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

      {showReassignModal && reassignTargetAssessment && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-600" /> Reassign
                Assessment
              </h3>
              <button
                onClick={() => setShowReassignModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-800 font-medium mb-1">
                  Currently Assigned To:
                </p>
                <p className="text-sm text-blue-900 font-semibold">
                  {reassignTargetAssessment.assessment_type === "specific" &&
                  reassignTargetAssessment.site_name
                    ? `Site: ${reassignTargetAssessment.site_name}`
                    : "General Area (No specific site)"}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">
                  Search Sites in this Area
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={reassignSearchQuery}
                    onChange={(e) => setReassignSearchQuery(e.target.value)}
                    placeholder="Type site name..."
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>
              <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-md divide-y divide-gray-100">
                <button
                  onClick={() => handleReassign(null)}
                  disabled={
                    isReassigning ||
                    reassignTargetAssessment.assessment_type !== "specific"
                  }
                  className={`w-full text-left px-4 py-3 flex items-center gap-3 transition ${
                    reassignTargetAssessment.assessment_type !== "specific"
                      ? "opacity-50 cursor-not-allowed bg-gray-50"
                      : "hover:bg-blue-50 cursor-pointer"
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <Globe className="w-4 h-4 text-gray-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">
                      Make General Assessment
                    </p>
                    <p className="text-xs text-gray-500">
                      Remove site assignment (applies to whole area)
                    </p>
                  </div>
                </button>
                {availableSites
                  .filter((s) =>
                    s.name
                      .toLowerCase()
                      .includes(reassignSearchQuery.toLowerCase()),
                  )
                  .map((site) => (
                    <button
                      key={site.site_id}
                      onClick={() => handleReassign(site.site_id)}
                      disabled={
                        isReassigning ||
                        (reassignTargetAssessment.assessment_type ===
                          "specific" &&
                          reassignTargetAssessment.site_name === site.name)
                      }
                      className={`w-full text-left px-4 py-3 flex items-center gap-3 transition ${
                        reassignTargetAssessment.assessment_type ===
                          "specific" &&
                        reassignTargetAssessment.site_name === site.name
                          ? "opacity-50 cursor-not-allowed bg-gray-50"
                          : "hover:bg-blue-50 cursor-pointer"
                      }`}
                    >
                      <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                        <MapPin className="w-4 h-4 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">
                          {site.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {site.metrics?.area_hectares?.toFixed(2)} ha
                        </p>
                      </div>
                    </button>
                  ))}
                {availableSites.filter((s) =>
                  s.name
                    .toLowerCase()
                    .includes(reassignSearchQuery.toLowerCase()),
                ).length === 0 && (
                  <div className="p-4 text-center text-gray-500 text-xs">
                    No sites found matching "{reassignSearchQuery}"
                  </div>
                )}
              </div>
            </div>
            <div className="px-5 py-4 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setShowReassignModal(false)}
                disabled={isReassigning}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}