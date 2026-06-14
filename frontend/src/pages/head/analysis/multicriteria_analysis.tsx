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
  Pin,
  X,
  Camera,
  CheckCircle,
  Save,
  Undo2,
  Target,
  Shield,
  Edit3,
  Loader2,
} from "lucide-react";
import PlantScopeAlert from "@/components/alert/PlantScopeAlert";
import PlantScopeConfirm from "@/components/alert/PlantScopeConfirm";
import { useState, useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import * as esri from "esri-leaflet";

import { useBarangayAreas } from "./hooks/useBarangayAreas";
import BarangayAreasPanel from "./BarangayAreasPanel";

import { usePotentialSites } from "./hooks/usePotentialSites";
import type { PotentialSite } from "./hooks/usePotentialSites";

import { useFieldAssessments } from "./hooks/useFieldAssessments";
import type {
  MCDALayer,
  FieldAssessmentEntry,
} from "./hooks/useFieldAssessments";
import FieldAssessmentPanel from "./components/Fieldassessmentpanel";
import { useHazardLayers } from "./hooks/useHazardLayers";
import HazardAssessmentPanel from "./components/HazardAssessmentPanel";

import SiteList from "./components/SiteList";
import SiteValidationPanel from "./components/SiteValidationPanel";
import { useSites } from "./hooks/useSites";
import type { Site, SiteDetail } from "./types/siteTypes";

import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";
import HazardAreaFormPanel from "./components/HazardAreaFormPanel";

L.Marker.prototype.options.icon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

let parseGeoraster: any;
let GeoRasterLayer: any;

const loadGeoRasterLibs = async () => {
  if (!parseGeoraster) {
    const mod = await import("georaster");
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
  const locationTempMarkerRef = useRef<L.Marker | null>(null);

  // View/Edit mode states
  const [viewingSite, setViewingSite] = useState<SiteDetail | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedPolygon, setEditedPolygon] = useState<[number, number][] | null>(
    null,
  );
  const [editedCenter, setEditedCenter] = useState<[number, number] | null>(
    null,
  );
  const [isSavingCoordinates, setIsSavingCoordinates] = useState(false);

  const editablePolygonRef = useRef<L.Polygon | null>(null);
  const vertexMarkersRef = useRef<L.Marker[]>([]);
  const addVertexMarkersRef = useRef<L.Marker[]>([]);
  const editableCenterMarkerRef = useRef<L.Marker | null>(null);

  // ✅ NEW: Draw from scratch states
  const [isDrawingNewPolygon, setIsDrawingNewPolygon] = useState(false);
  const [newPolygonPoints, setNewPolygonPoints] = useState<[number, number][]>(
    [],
  );
  const [isPlacingNewCenter, setIsPlacingNewCenter] = useState(false);
  const newPolygonMarkersRef = useRef<L.Marker[]>([]);
  const newPolygonLineRef = useRef<L.Polyline | null>(null);

  // ✅ Ref to break circular dependency
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
  const [selectedSiteIdForFilter, setSelectedSiteIdForFilter] = useState<
    string | null
  >(null);
  const [siteName, setSiteName] = useState("");
  const [showNameInput, setShowNameInput] = useState(false);
  const drawingPointsRef = useRef<L.Marker[]>([]);

  const [showPotentialSites, setShowPotentialSites] = useState(false);
  const potentialSiteLayersRef = useRef<L.Polygon[]>([]);

  const [showValidationPanel, setShowValidationPanel] = useState(false);
  const [validatingSite, setValidatingSite] = useState<SiteDetail | null>(null);

  const [assessmentType, setAssessmentType] = useState<
    "specific" | "general" | "all"
  >("all");

  const fieldAssessments = useFieldAssessments(mapRef);
  const sites = useSites();
  const potentialSitesHook = usePotentialSites();
  const hazardLayers = useHazardLayers(mapRef); // ← ADD HERE
  const barangayAreas = useBarangayAreas(mapRef); // ← ADD HERE

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

  // ✅ View site handler
  const handleViewSite = useCallback(
    async (site: Site) => {
      try {
        const detail = await sites.fetchSiteDetail(site.site_id);
        if (detail) {
          setViewingSite(detail);

          if (
            detail.polygon_coordinates &&
            detail.polygon_coordinates.length > 0
          ) {
            if (polygonRef.current) {
              mapRef.current?.removeLayer(polygonRef.current);
            }
            polygonRef.current = L.polygon(detail.polygon_coordinates, {
              color: "#0F4A2F",
              fillColor: "#0F4A2F",
              fillOpacity: 0.3,
              weight: 2,
            }).addTo(mapRef.current!);
            mapRef.current?.fitBounds(polygonRef.current.getBounds(), {
              padding: [50, 50],
            });
          } else if (detail.center_coordinate) {
            mapRef.current?.setView(detail.center_coordinate, 16);
          } else if (areaId) {
            setAlert({
              type: "failed",
              title: "No Location Data",
              message: "This site has no polygon or center coordinates.",
            });
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
    [sites, areaId],
  );

  // ✅ Clear all edit markers
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

  // ✅ Render all vertex and add-vertex markers
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
          html: `<div style="
            background:#FF6B00;width:20px;height:20px;border-radius:50%;
            border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);
            display:flex;align-items:center;justify-content:center;
            font-size:10px;color:white;font-weight:bold;cursor:grab;
          ">${index + 1}</div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        }),
      }).addTo(map);

      vertexMarker.on("drag", (e) => {
        const latlng = e.target.getLatLng();
        const newCoords = [...coordinates];
        newCoords[index] = [latlng.lat, latlng.lng];
        setEditedPolygon(newCoords);

        if (editablePolygonRef.current) {
          editablePolygonRef.current.setLatLngs(newCoords);
        }

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

        if (editablePolygonRef.current) {
          editablePolygonRef.current.setLatLngs(newCoords);
        }

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
          html: `<div style="
            background:#10B981;width:18px;height:18px;border-radius:50%;
            border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);
            display:flex;align-items:center;justify-content:center;
            font-size:12px;color:white;font-weight:bold;cursor:pointer;
          ">+</div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        }),
      }).addTo(map);

      addMarker.on("click", () => {
        const newCoords = [...coordinates];
        newCoords.splice(i + 1, 0, [midLat, midLng]);
        setEditedPolygon(newCoords);

        if (editablePolygonRef.current) {
          editablePolygonRef.current.setLatLngs(newCoords);
        }

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

  // ✅ NEW: Handle click when drawing new polygon from scratch
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
          html: `<div style="
            background:#FF6B00;width:16px;height:16px;border-radius:50%;
            border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);
            display:flex;align-items:center;justify-content:center;
            font-size:8px;color:white;font-weight:bold;
          ">${updatedPoints.length}</div>`,
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
                html: `<div style="
                  background:#FF6B00;width:16px;height:16px;border-radius:50%;
                  border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);
                  display:flex;align-items:center;justify-content:center;
                  font-size:8px;color:white;font-weight:bold;
                ">${i + 1}</div>`,
                iconSize: [16, 16],
                iconAnchor: [8, 8],
              }),
            );
          });
        }
      });

      newPolygonMarkersRef.current.push(marker);

      if (newPolygonLineRef.current) {
        map.removeLayer(newPolygonLineRef.current);
      }

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

  // ✅ NEW: Finish drawing the new polygon
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
      color: "#FF6B00",
      fillColor: "#FF6B00",
      fillOpacity: 0.2,
      weight: 3,
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

  // ✅ NEW: Cancel drawing new polygon
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

  // ✅ NEW: Handle click for placing new center
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
          html: `<div style="
            background:#FF6B00;width:24px;height:24px;border-radius:50%;
            border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);
            display:flex;align-items:center;justify-content:center;
          "><div style="width:8px;height:8px;background:white;border-radius:50%;"></div></div>`,
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

  // ✅ NEW: Auto-calculate center from polygon
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

    if (editableCenterMarkerRef.current) {
      mapRef.current?.removeLayer(editableCenterMarkerRef.current);
    }

    const map = mapRef.current;
    if (!map) return;

    const centerMarker = L.marker(center, {
      draggable: true,
      icon: L.divIcon({
        className: "center-marker-edit",
        html: `<div style="
          background:#FF6B00;width:24px;height:24px;border-radius:50%;
          border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);
          display:flex;align-items:center;justify-content:center;
        "><div style="width:8px;height:8px;background:white;border-radius:50%;"></div></div>`,
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

  // ✅ Exit edit mode
  const exitEditMode = useCallback(() => {
    setIsEditMode(false);
    setEditedPolygon(null);
    setEditedCenter(null);
    setIsDrawingNewPolygon(false);
    setIsPlacingNewCenter(false);
    setNewPolygonPoints([]);
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
        color: "#0F4A2F",
        fillColor: "#0F4A2F",
        fillOpacity: 0.3,
        weight: 2,
      }).addTo(mapRef.current!);
    }
  }, [viewingSite, clearEditMarkers]);

  // ✅ Enter edit mode
  const handleEnterEditMode = useCallback(() => {
    if (!viewingSite) return;

    setIsEditMode(true);
    setEditedPolygon(
      viewingSite.polygon_coordinates &&
        viewingSite.polygon_coordinates.length > 0
        ? [...viewingSite.polygon_coordinates]
        : null,
    );
    setEditedCenter(
      viewingSite.center_coordinate ? [...viewingSite.center_coordinate] : null,
    );

    if (polygonRef.current) {
      mapRef.current?.removeLayer(polygonRef.current);
      polygonRef.current = null;
    }

    const hasPolygon =
      viewingSite.polygon_coordinates &&
      viewingSite.polygon_coordinates.length > 0;
    const hasCenter = !!viewingSite.center_coordinate;

    if (hasPolygon) {
      const editablePolygon = L.polygon(viewingSite.polygon_coordinates!, {
        color: "#FF6B00",
        fillColor: "#FF6B00",
        fillOpacity: 0.2,
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
        message: "Click on the map to add vertices. Need at least 3 points.",
      });
    }

    if (hasCenter) {
      const centerMarker = L.marker(viewingSite.center_coordinate!, {
        draggable: true,
        icon: L.divIcon({
          className: "center-marker-edit",
          html: `<div style="
            background:#FF6B00;width:24px;height:24px;border-radius:50%;
            border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);
            display:flex;align-items:center;justify-content:center;
          "><div style="width:8px;height:8px;background:white;border-radius:50%;"></div></div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
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

  // ✅ Save coordinates
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

        if (areaId) {
          await sites.fetchSites(areaId);
        }
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

  // ✅ Cancel edit
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

  // ✅ Close site view
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

  // ✅ Handler for site selection from SiteList
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

  // ✅ Handle map clicks for drawing polygons/centers/hazards/editing
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
        // ✅ NEW: Add vertex during map edit mode
        barangayAreas.addVertexOnMap(e.latlng.lat, e.latlng.lng);
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
      (barangayAreas.isMapEditMode && barangayAreas.showHazardForm);

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
    barangayAreas.hazardPolygonPoints.length,
    barangayAreas.isMapEditMode,
    barangayAreas.showHazardForm,
    handleMapClickForNewPolygon,
    handleMapClickForNewCenter,
    barangayAreas.addHazardPoint,
    barangayAreas.finishDrawingHazard,
    barangayAreas.addVertexOnMap,
  ]);

  // ── Map init ──────────────────────────────────────────────────────────────
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
      if (areaId) {
        const initialSiteId = siteId || undefined;
        fieldAssessments.fetchLayer(
          areaId,
          "safety",
          assessmentType,
          initialSiteId,
        );
        sites.fetchSites(areaId);
      }

      return () => {
        mapRef.current?.remove();
        mapRef.current = null;
      };
    }
  }, [areaId]);

  useEffect(() => {
    if (areaId) sites.fetchSites(areaId);
  }, [areaId]);

  useEffect(() => {
    if (areaId) potentialSitesHook.fetchPotentialSites(areaId);
  }, [areaId]);

  useEffect(() => {
    geotiffLayerRef.current?.setOpacity(opacity);
  }, [opacity]);

  // ── Potential sites rendering ─────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    potentialSiteLayersRef.current.forEach((l) => map.removeLayer(l));
    potentialSiteLayersRef.current = [];

    if (!showPotentialSites) return;

    potentialSitesHook.potentialSites.forEach((site: PotentialSite) => {
      if (!site.polygon_coordinates?.coordinates?.length) return;
      const coords = site.polygon_coordinates.coordinates[0].map(
        ([lng, lat]) => [lat, lng] as [number, number],
      );
      const score = site.suitability_score;
      const color =
        score >= 0.7 ? "#16a34a" : score >= 0.4 ? "#ca8a04" : "#dc2626";
      const poly = L.polygon(coords, {
        color,
        fillColor: color,
        fillOpacity: 0.3,
        weight: 2,
        dashArray: "5 5",
      })
        .bindPopup(
          `<div style="min-width:160px;font-family:sans-serif">
            <strong style="font-size:12px">${site.site_id || `Potential Site ${site.potential_sites_id}`}</strong><br/>
            <span style="font-size:11px;color:#555">Area: <b>${site.area_hectares.toFixed(2)} ha</b></span><br/>
            <span style="font-size:11px;color:#555">Avg NDVI: <b>${site.avg_ndvi.toFixed(3)}</b></span><br/>
            <span style="font-size:11px;color:#555">Suitability: <b>${(score * 100).toFixed(1)}%</b></span>
          </div>`,
        )
        .addTo(map);
      potentialSiteLayersRef.current.push(poly);
    });
  }, [showPotentialSites, potentialSitesHook.potentialSites]);

  // ── FIX: Robust map size invalidation with ResizeObserver ─────────────────
  const isPickingLocation = fieldAssessments.locationTargetId !== null;

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    let timeoutId: ReturnType<typeof setTimeout>;
    let resizeObserver: ResizeObserver | null = null;

    const invalidate = () => {
      const container = map.getContainer();
      const width = container.clientWidth;
      const height = container.clientHeight;

      if (width > 0 && height > 0) {
        map.invalidateSize({
          animate: false,
          pan: false,
          debounceMoveend: true,
        });
      }
    };

    if ("ResizeObserver" in window) {
      resizeObserver = new ResizeObserver(() => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(invalidate, 50);
      });
      resizeObserver.observe(map.getContainer());
    } else {
      const win = window as Window;
      const onResize = () => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(invalidate, 100);
      };
      win.addEventListener("resize", onResize);
      return () => {
        clearTimeout(timeoutId);
        win.removeEventListener("resize", onResize);
      };
    }

    timeoutId = setTimeout(invalidate, 100);

    return () => {
      clearTimeout(timeoutId);
      resizeObserver?.disconnect();
    };
  }, [
    isPickingLocation,
    isPlacingMarker,
    isDrawing,
    isDrawingNewPolygon,
    isPlacingNewCenter,
  ]);

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

  // ── LOCATION PLACEMENT ────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const targetId = fieldAssessments.locationTargetId;

    if (targetId === null) {
      if (locationTempMarkerRef.current) {
        map.removeLayer(locationTempMarkerRef.current);
        locationTempMarkerRef.current = null;
      }
      map.getContainer().style.cursor = "";
      return;
    }

    map.getContainer().style.cursor = "crosshair";

    let isCancelled = false;

    const handleClick = async (e: L.LeafletMouseEvent) => {
      if (locationTempMarkerRef.current) {
        map.removeLayer(locationTempMarkerRef.current);
        locationTempMarkerRef.current = null;
      }

      locationTempMarkerRef.current = L.marker(e.latlng, {
        icon: L.divIcon({
          className: "",
          html: `<div style="width:22px;height:22px;border-radius:50%;background:#6366f1;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);animation:pulse 1s infinite;"></div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        }),
      }).addTo(map);

      map.off("click", handleClick);
      map.getContainer().style.cursor = "";

      const result = await fieldAssessments.updateLocation(
        targetId,
        e.latlng.lat,
        e.latlng.lng,
        20,
      );

      if (isCancelled) return;

      if (locationTempMarkerRef.current) {
        map.removeLayer(locationTempMarkerRef.current);
        locationTempMarkerRef.current = null;
      }

      fieldAssessments.setLocationTargetId(null);

      if (result.success) {
        setAlert({
          type: "success",
          title: "Location Saved",
          message: "Assessment location updated successfully.",
        });

        if (areaId) {
          const siteIdToPass =
            assessmentType === "specific" ? siteId || undefined : undefined;
          await fieldAssessments.refreshLayer(
            areaId,
            fieldAssessments.activeLayer,
            assessmentType,
            siteIdToPass,
          );
        }
      } else {
        setAlert({
          type: "error",
          title: "Save Failed",
          message: result.message ?? "Could not save location.",
        });
      }
    };

    map.on("click", handleClick);

    return () => {
      isCancelled = true;
      map.off("click", handleClick);
      map.getContainer().style.cursor = "";
    };
  }, [fieldAssessments.locationTargetId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const selectedEntry =
      fieldAssessments.assessments[fieldAssessments.activeLayer]?.[
        fieldAssessments.selectedIndex
      ];

    if (selectedEntry && fieldAssessments.showPhotoMarkers) {
      fieldAssessments.placePhotoMarkers(selectedEntry);
    } else if (selectedEntry) {
      fieldAssessments.removePhotoMarkers(selectedEntry.field_assessment_id);
    }
  }, [
    fieldAssessments.selectedIndex,
    fieldAssessments.activeLayer,
    fieldAssessments.assessments,
    fieldAssessments.showPhotoMarkers,
  ]);

  const handlePhotoClick = useCallback((photo: any) => {
    const map = mapRef.current;
    if (!map || !photo.latitude || !photo.longitude) return;
    map.flyTo([photo.latitude, photo.longitude], 18, {
      animate: true,
      duration: 0.8,
    });
  }, []);

  // ── Color helpers ─────────────────────────────────────────────────────────
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

  const startDrawing = () => {
    if (!mapRef.current) return;
    setIsDrawing(true);
    setPolygonCoordinates([]);
    setPolygonArea(null);
    drawingPointsRef.current.forEach((m) => mapRef.current?.removeLayer(m));
    drawingPointsRef.current = [];

    setAlert({
      type: "success",
      title: "Drawing Mode",
      message:
        "Click to place points. Double-click or press 'Finish' to complete.",
    });

    const coords: [number, number][] = [];

    const onClick = (e: L.LeafletMouseEvent) => {
      coords.push([e.latlng.lat, e.latlng.lng]);
      const marker = L.marker(e.latlng, {
        icon: L.divIcon({
          className: "drawing-point-marker",
          html: `<div style="background:#ef4444;width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);"></div>`,
          iconSize: [12, 12],
          iconAnchor: [6, 6],
        }),
      }).addTo(mapRef.current!);
      drawingPointsRef.current.push(marker);
      setPolygonCoordinates([...coords]);
    };

    const onDblClick = () => finishDrawing(coords);

    mapRef.current.on("click", onClick);
    mapRef.current.on("dblclick", onDblClick);
  };

  const finishDrawing = (coords: [number, number][]) => {
    if (!mapRef.current) return;
    mapRef.current.off("click");
    mapRef.current.off("dblclick");

    if (coords.length < 3) {
      setAlert({
        type: "failed",
        title: "Invalid Polygon",
        message: "Need at least 3 points to create a polygon.",
      });
      setIsDrawing(false);
      drawingPointsRef.current.forEach((m) => mapRef.current!.removeLayer(m));
      drawingPointsRef.current = [];
      setPolygonCoordinates([]);
      return;
    }

    drawingPointsRef.current.forEach((m) => mapRef.current!.removeLayer(m));
    drawingPointsRef.current = [];

    polygonRef.current?.remove();
    polygonRef.current = L.polygon(coords, {
      color: "#0F4A2F",
      fillColor: "#0F4A2F",
      fillOpacity: 0.3,
      weight: 2,
    }).addTo(mapRef.current!);

    const area = calculatePolygonArea(coords);
    setPolygonArea(area);
    setIsDrawing(false);
    setShowNameInput(true);
    setAlert({
      type: "success",
      title: "Polygon Created",
      message: `${coords.length} points drawn. Enter site name to save.`,
    });
  };

  const undoLastPoint = () => {
    if (polygonCoordinates.length > 0 && mapRef.current) {
      const newCoords = polygonCoordinates.slice(0, -1);
      setPolygonCoordinates(newCoords);
      const lastMarker = drawingPointsRef.current.pop();
      if (lastMarker) mapRef.current.removeLayer(lastMarker);
      if (newCoords.length >= 3) {
        setPolygonArea(calculatePolygonArea(newCoords));
      } else {
        setPolygonArea(null);
        if (polygonRef.current) {
          mapRef.current.removeLayer(polygonRef.current);
          polygonRef.current = null;
        }
      }
    }
  };

  const clearPolygon = () => {
    if (polygonRef.current && mapRef.current) {
      mapRef.current.removeLayer(polygonRef.current);
      polygonRef.current = null;
    }
    drawingPointsRef.current.forEach((m) => mapRef.current?.removeLayer(m));
    drawingPointsRef.current = [];
    setPolygonCoordinates([]);
    setPolygonArea(null);
    setIsDrawing(false);
    setShowNameInput(false);
    setSiteName("");
    mapRef.current?.off("click");
    mapRef.current?.off("dblclick");
  };

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
          html: `<div style="background:#7C3AED;width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;"><span style="transform:rotate(45deg);color:white;font-size:9px;font-weight:700;">${label}</span></div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 28],
          popupAnchor: [0, -30],
        }),
        draggable: true,
      }).addTo(mapRef.current);
      marker.bindPopup(`
        <strong>${label}</strong><br/>
        <span style="font-size:11px;font-family:monospace">${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}</span><br/>
        <button onclick="window.__removePlacedMarker(${id})" style="margin-top:4px;background:#ef4444;color:white;border:none;padding:2px 8px;border-radius:4px;font-size:11px;cursor:pointer">Remove</button>
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

  if (typeof window !== "undefined")
    (window as any).__removePlacedMarker = removePlacedMarker;

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
        setShowNameInput(false);
        setSiteName("");
      } else {
        const errorMsg = sites.error?.includes("already exists")
          ? "A site with this name already exists. Please choose a different name."
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

  const handleSelectSite = useCallback(
    async (site: Site) => {
      try {
        const detail = await sites.fetchSiteDetail(site.site_id);
        if (detail && detail.polygon_coordinates?.length) {
          if (polygonRef.current)
            mapRef.current?.removeLayer(polygonRef.current);
          polygonRef.current = L.polygon(detail.polygon_coordinates, {
            color: "#0F4A2F",
            fillColor: "#0F4A2F",
            fillOpacity: 0.3,
            weight: 2,
          }).addTo(mapRef.current!);
          mapRef.current?.fitBounds(polygonRef.current.getBounds(), {
            padding: [20, 20],
          });
          setPolygonCoordinates(detail.polygon_coordinates);
          setPolygonArea(detail.area_hectares);
        }
      } catch (err: any) {
        setAlert({
          type: "error",
          title: "Load Failed",
          message: err.message || "Could not load site details.",
        });
      }
    },
    [mapRef, polygonRef, sites],
  );

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
      {confirmDialog && (
        <PlantScopeConfirm
          title={confirmDialog.title}
          message={confirmDialog.message}
          variant={confirmDialog.variant}
          confirmLabel={confirmDialog.confirmLabel}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
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

      <main className="flex-1 p-3 flex flex-col gap-3">
        {/* Toolbar */}
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
              {isLayerVisible ? <Eye size={12} /> : <EyeOff size={12} />}{" "}
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
              <Pen size={12} /> {isDrawing ? "Drawing..." : "Draw Polygon"}
            </button>
            <button
              onClick={clearPolygon}
              disabled={!polygonCoordinates.length && !isDrawing}
              className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded transition text-xs font-medium disabled:opacity-40"
            >
              <Trash2 size={12} /> Clear
            </button>
            <div className="w-px h-5 bg-gray-200 mx-0.5" />
            {areaId && (
              <>
                <div className="w-px h-5 bg-gray-200 mx-0.5" />

                <button
                  onClick={() => setShowPotentialSites((v) => !v)}
                  disabled={potentialSitesHook.loading}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition text-xs font-medium disabled:opacity-40
                    ${showPotentialSites ? "bg-teal-600 hover:bg-teal-700 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-700"}`}
                >
                  <Target size={12} />
                  {potentialSitesHook.loading
                    ? "Loading..."
                    : showPotentialSites
                      ? `Hide Potential (${potentialSitesHook.potentialSites.length})`
                      : `Potential Sites (${potentialSitesHook.potentialSites.length})`}
                </button>
              </>
            )}
            <div className="w-px h-5 bg-gray-200 mx-0.5" />
            <button
              onClick={() =>
                hazardLayers.setIsPanelOpen(!hazardLayers.isPanelOpen)
              }
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition text-xs font-medium
                ${hazardLayers.isPanelOpen ? "bg-red-600 hover:bg-red-700 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-700"}`}
            >
              <Shield size={12} /> Hazards
            </button>
          </div>
          <BarangayAreasPanel barangayAreas={barangayAreas} />

          {/* ✅ Draw Hazard Area Button */}
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
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition text-xs font-medium
    ${
      barangayAreas.isDrawingHazard
        ? "bg-yellow-500 text-white cursor-wait"
        : !barangayAreas.selectedBarangayId
          ? "bg-gray-100 text-gray-400 cursor-not-allowed"
          : "bg-yellow-500 hover:bg-yellow-600 text-white"
    }`}
            title={
              !barangayAreas.selectedBarangayId
                ? "Select a barangay first"
                : "Draw a new hazard area"
            }
          >
            <Pen size={12} />
            {barangayAreas.isDrawingHazard ? "Drawing..." : "Draw Hazard"}
          </button>

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

        {/* ✅ Site View/Edit Panel */}
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
                    {viewingSite?.total_area_hectares
                      ? `${viewingSite?.total_area_hectares.toFixed(2)} ha`
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
                      )}
                      Save
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="flex items-center gap-1 px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-medium rounded"
                    >
                      <X size={12} />
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleEnterEditMode}
                      className="flex items-center gap-1 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium rounded"
                    >
                      <Edit3 size={12} />
                      Edit
                    </button>
                    <button
                      onClick={handleCloseSiteView}
                      className="flex items-center gap-1 px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-medium rounded"
                    >
                      <X size={12} />
                      Close
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Show warning if no coordinates */}
            {(!viewingSite.polygon_coordinates ||
              viewingSite.polygon_coordinates.length === 0) &&
              !isEditMode && (
                <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-xs text-yellow-800 font-medium">
                    ⚠️ No polygon coordinates
                  </p>
                  <p className="text-[10px] text-yellow-700 mt-1">
                    Click "Edit" to draw the site polygon and set the center
                    location.
                  </p>
                </div>
              )}

            {isEditMode && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                {/* ✅ Show drawing controls if drawing new polygon */}
                {isDrawingNewPolygon && (
                  <div className="mb-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <p className="text-xs font-bold text-orange-800 mb-2">
                      🎯 Drawing Polygon ({newPolygonPoints.length} points)
                    </p>
                    <p className="text-[10px] text-orange-700 mb-2">
                      Click on the map to add vertices. Double-click a vertex to
                      delete it.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleFinishNewPolygon}
                        disabled={newPolygonPoints.length < 3}
                        className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <CheckCircle size={12} />
                        Finish Polygon ({newPolygonPoints.length}/3+)
                      </button>
                      <button
                        onClick={handleCancelNewPolygon}
                        className="flex items-center gap-1 px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-medium rounded"
                      >
                        <X size={12} />
                        Cancel Drawing
                      </button>
                    </div>
                  </div>
                )}

                {/* ✅ Show center placement controls */}
                {isPlacingNewCenter && !isDrawingNewPolygon && (
                  <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs font-bold text-blue-800 mb-2">
                      📍 Place Center Marker
                    </p>
                    <p className="text-[10px] text-blue-700 mb-2">
                      Click on the map to place the center, or auto-calculate
                      from polygon.
                    </p>
                    <div className="flex gap-2">
                      {editedPolygon && editedPolygon.length >= 3 && (
                        <button
                          onClick={handleAutoCenter}
                          className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded"
                        >
                          <Target size={12} />
                          Auto-Calculate Center
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setIsPlacingNewCenter(false);
                          setAlert({
                            type: "success",
                            title: "Manual Placement",
                            message:
                              "Click on the map to place the center marker.",
                          });
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded"
                      >
                        <MapPin size={12} />
                        Click Map to Place
                      </button>
                    </div>
                  </div>
                )}

                {/* ✅ Show edit instructions when not in drawing mode */}
                {!isDrawingNewPolygon && !isPlacingNewCenter && (
                  <>
                    <div className="flex items-center gap-4 text-xs text-gray-600">
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                        <span>Drag vertices to reshape</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        <span>Click + to add vertex</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-orange-500">Double-click</span>
                        <span>vertex to delete</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full bg-orange-500 border-2 border-white"></div>
                        <span>Drag center to reposition</span>
                      </div>
                    </div>

                    {editedPolygon && (
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => {
                            if (editablePolygonRef.current) {
                              mapRef.current?.removeLayer(
                                editablePolygonRef.current,
                              );
                              editablePolygonRef.current = null;
                            }
                            vertexMarkersRef.current.forEach((m) =>
                              mapRef.current?.removeLayer(m),
                            );
                            vertexMarkersRef.current = [];
                            addVertexMarkersRef.current.forEach((m) =>
                              mapRef.current?.removeLayer(m),
                            );
                            addVertexMarkersRef.current = [];

                            setEditedPolygon(null);
                            setIsDrawingNewPolygon(true);
                            setNewPolygonPoints([]);

                            setAlert({
                              type: "success",
                              title: "Redraw Mode",
                              message:
                                "Click on the map to draw a new polygon.",
                            });
                          }}
                          className="flex items-center gap-1 px-2 py-1 bg-orange-100 hover:bg-orange-200 text-orange-700 text-[10px] font-medium rounded"
                        >
                          <Pen size={10} />
                          Redraw Polygon
                        </button>

                        {editedPolygon.length >= 3 && (
                          <button
                            onClick={handleAutoCenter}
                            className="flex items-center gap-1 px-2 py-1 bg-purple-100 hover:bg-purple-200 text-purple-700 text-[10px] font-medium rounded"
                          >
                            <Target size={10} />
                            Recalculate Center
                          </button>
                        )}
                      </div>
                    )}
                  </>
                )}

                {editedPolygon && (
                  <div className="mt-2 text-xs text-gray-500">
                    Vertices: {editedPolygon.length} • Center:{" "}
                    {editedCenter
                      ? `${editedCenter[0].toFixed(5)}, ${editedCenter[1].toFixed(5)}`
                      : "Not set"}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Main content: Map + Sidebar */}
        <div className="flex gap-3 flex-1 min-h-0">
          {/* MAP COLUMN */}
          <div className="flex-[3] flex flex-col gap-2 min-w-0">
            <div
              ref={mapContainerRef}
              className="w-full rounded-lg shadow-inner border-2 border-gray-300 relative overflow-hidden h-[65vh] min-h-[450px]"
            >
              {(isPickingLocation || isPlacingMarker || isDrawing) && (
                <div
                  className={`absolute inset-0 pointer-events-none z-[400] transition-opacity duration-200
                  ${isPickingLocation ? "opacity-100" : "opacity-0"}`}
                >
                  {isPickingLocation && (
                    <div className="absolute inset-4 border-2 border-dashed border-orange-400/50 rounded-lg animate-pulse" />
                  )}
                  {isPlacingMarker && (
                    <div className="absolute inset-4 border-2 border-dashed border-purple-400/50 rounded-lg animate-pulse" />
                  )}
                </div>
              )}

              {!mapRef.current && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                  <div className="text-center text-gray-400">
                    <MapPin size={32} className="mx-auto mb-2" />
                    <p className="text-sm">Loading Map...</p>
                  </div>
                </div>
              )}
              {isPickingLocation && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-orange-600/90 text-white px-4 py-2 rounded-full shadow-lg z-[1000] flex items-center gap-2 text-xs font-medium">
                  <MapPin size={12} className="animate-bounce" />
                  Click on the map to set this assessment's location •{" "}
                  <button
                    onClick={() => fieldAssessments.setLocationTargetId(null)}
                    className="underline ml-1"
                  >
                    Cancel
                  </button>
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

              {isDrawing && (
                <div className="absolute top-3 left-3 bg-white/95 px-3 py-1.5 rounded-lg shadow-md border border-green-200 z-[1000]">
                  <p className="text-xs font-semibold text-green-800">
                    🎯 Drawing Mode
                  </p>
                  <p className="text-[10px] text-gray-600">
                    Click to add • Double-click or press 'Finish' to complete
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
              {showPotentialSites &&
                potentialSitesHook.potentialSites.length > 0 && (
                  <div className="absolute top-3 right-3 bg-white/95 p-2.5 rounded-lg shadow-md border border-teal-200 z-[1000]">
                    <p className="text-[10px] font-bold text-gray-700 mb-1.5 flex items-center gap-1">
                      <Target size={10} className="text-teal-600" /> Potential
                      Sites
                    </p>
                    <div className="flex flex-col gap-1 text-[9px] text-gray-600">
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-sm bg-[#16a34a]" />
                        <span>≥70% suitability</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-sm bg-[#ca8a04]" />
                        <span>40–70%</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-sm bg-[#dc2626]" />
                        <span>&lt;40%</span>
                      </div>
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
              {barangayAreas.selectedBarangayId &&
                (barangayAreas.classifiedAreas.length > 0 ||
                  barangayAreas.hazardAreas.length > 0) && (
                  <div className="absolute bottom-3 left-3 bg-white/95 p-2.5 rounded-lg shadow-md border border-gray-200 z-[1000]">
                    <p className="text-[10px] font-bold text-gray-700 mb-1.5 flex items-center gap-1">
                      <MapPin size={10} className="text-green-600" />{" "}
                      {
                        barangayAreas.barangayList.find(
                          (b) =>
                            b.barangay_id === barangayAreas.selectedBarangayId,
                        )?.name
                      }
                    </p>
                    {barangayAreas.showClassified &&
                      barangayAreas.classifiedAreas.length > 0 && (
                        <div className="flex items-center gap-1.5 text-[9px] text-gray-600 mb-1">
                          <div className="w-3 h-3 rounded-sm bg-red-500 border border-red-700" />
                          <span>
                            Classified Areas (
                            {barangayAreas.classifiedAreas.length})
                          </span>
                        </div>
                      )}
                    {barangayAreas.showHazards &&
                      barangayAreas.hazardAreas.length > 0 && (
                        <div className="flex items-center gap-1.5 text-[9px] text-gray-600">
                          <div className="w-3 h-3 rounded-sm bg-yellow-500 border border-yellow-700" />
                          <span>
                            Hazard Areas ({barangayAreas.hazardAreas.length})
                          </span>
                        </div>
                      )}
                  </div>
                )}
              {/* ✅ Hazard Drawing Overlay */}
              {barangayAreas.isDrawingHazard && (
                <div className="absolute top-3 left-3 bg-yellow-500/95 text-white px-4 py-2 rounded-lg shadow-lg z-[1000] flex items-center gap-2 text-xs font-medium">
                  <Pen size={12} className="animate-pulse" />
                  Drawing Hazard Area • Click to add points • Double-click to
                  finish
                  <span className="bg-white/20 px-2 py-0.5 rounded-full text-[10px]">
                    {barangayAreas.hazardPolygonPoints.length} pts
                  </span>
                </div>
              )}

              {/* ✅ Map Edit Mode Floating Panel */}
              {barangayAreas.isMapEditMode && barangayAreas.showHazardForm && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-white rounded-xl shadow-2xl border-2 border-blue-400 overflow-hidden min-w-[320px]">
                  {/* Header */}
                  <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-2 flex items-center gap-2">
                    <Edit3 size={14} />
                    <span className="text-xs font-bold">
                      Adding Vertices on Map
                    </span>
                    <span className="bg-white/20 px-2 py-0.5 rounded-full text-[10px] font-bold ml-auto">
                      {barangayAreas.hazardPolygonPoints.length} pts
                    </span>
                  </div>

                  {/* Body */}
                  <div className="px-4 py-3 bg-white">
                    <p className="text-[11px] text-gray-600 mb-3">
                      🖱️ Click on the map to add vertices • Double-click a
                      vertex to remove
                    </p>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => barangayAreas.exitMapEditMode()}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition shadow-sm"
                      >
                        <Eye size={12} />
                        Show Form
                      </button>
                      <button
                        onClick={() => barangayAreas.removeLastVertexOnMap()}
                        disabled={
                          barangayAreas.hazardPolygonPoints.length === 0
                        }
                        className="flex items-center justify-center gap-1 px-3 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 text-white text-xs font-semibold rounded-lg transition shadow-sm disabled:cursor-not-allowed"
                      >
                        <Undo2 size={12} />
                        Undo
                      </button>
                      <button
                        onClick={() => {
                          if (
                            confirm("Cancel editing? All changes will be lost.")
                          ) {
                            barangayAreas.cancelDrawingHazard();
                          }
                        }}
                        className="flex items-center justify-center gap-1 px-3 py-2 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded-lg transition shadow-sm"
                      >
                        <X size={12} />
                        Cancel
                      </button>
                    </div>

                    {/* Vertex count warning */}
                    {barangayAreas.hazardPolygonPoints.length < 3 && (
                      <p className="text-[10px] text-red-500 mt-2 flex items-center gap-1">
                        <Info size={10} />
                        Need at least 3 vertices to save
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
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
            {/* Status bar */}
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
                    <Pin size={12} /> {placedMarkers.length} marker
                    {placedMarkers.length !== 1 ? "s" : ""}
                  </span>
                )}

                {showPotentialSites &&
                  potentialSitesHook.potentialSites.length > 0 && (
                    <span className="flex items-center gap-1 text-teal-600">
                      <Target size={12} />{" "}
                      {potentialSitesHook.potentialSites.length} potential site
                      {potentialSitesHook.potentialSites.length !== 1
                        ? "s"
                        : ""}
                    </span>
                  )}
                {isPickingLocation && (
                  <span className="flex items-center gap-1 text-orange-600 font-medium animate-pulse">
                    <MapPin size={12} /> Picking location...
                  </span>
                )}
                {hazardLayers.showMgbFlood && (
                  <span className="flex items-center gap-1 text-blue-600 font-medium">
                    🌊 Flood
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

                {/* ✅ ADD BARANGAY STATUS ITEMS HERE */}
                {barangayAreas.loading && (
                  <span className="flex items-center gap-1 text-blue-600 font-medium animate-pulse">
                    <Loader2 size={12} className="animate-spin" /> Loading
                    areas...
                  </span>
                )}
                {barangayAreas.selectedBarangayId &&
                  barangayAreas.showClassified &&
                  barangayAreas.classifiedAreas.length > 0 && (
                    <span className="flex items-center gap-1 text-red-600 font-medium">
                      <Flag size={12} /> {barangayAreas.classifiedAreas.length}{" "}
                      classified
                    </span>
                  )}
                {barangayAreas.selectedBarangayId &&
                  barangayAreas.showHazards &&
                  barangayAreas.hazardAreas.length > 0 && (
                    <span className="flex items-center gap-1 text-yellow-600 font-medium">
                      ⚠️ {barangayAreas.hazardAreas.length} hazards
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
                      onClick={undoLastPoint}
                      disabled={polygonCoordinates.length === 0}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 text-white text-xs font-semibold rounded transition flex items-center gap-1"
                    >
                      <Undo2 size={12} /> Undo
                    </button>
                  </>
                )}
                {/* ✅ HAZARD DRAWING CONTROLS */}
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
                {showNameInput && (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={siteName}
                      onChange={(e) => setSiteName(e.target.value)}
                      placeholder="Enter site name..."
                      className="px-3 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500 w-40"
                      onKeyDown={(e) => e.key === "Enter" && handleSaveSite()}
                      autoFocus
                    />
                    <button
                      onClick={handleSaveSite}
                      disabled={!polygonArea}
                      className={`px-4 py-1.5 rounded text-xs font-semibold transition flex items-center gap-1
                        ${polygonArea ? "bg-green-600 hover:bg-green-700 text-white" : "bg-gray-200 text-gray-400 cursor-not-allowed"}`}
                    >
                      <Save size={12} /> Save
                    </button>
                    <button
                      onClick={() => {
                        setShowNameInput(false);
                        setSiteName("");
                        clearPolygon();
                      }}
                      className="px-3 py-1.5 bg-gray-500 hover:bg-gray-600 text-white text-xs font-semibold rounded transition"
                    >
                      Cancel
                    </button>
                  </div>
                )}
                {!showNameInput && !isDrawing && (
                  <button
                    onClick={startDrawing}
                    className="px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded transition flex items-center gap-1"
                  >
                    <Pen size={12} /> Draw Polygon
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* SIDEBAR: GeoTIFF info + Assessment list */}
          <div className="flex-[2] flex flex-col gap-3 min-w-0">
            {/* GeoTIFF status */}
            {/* ✅ CREATE HAZARD AREA PANEL */}

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

            {/* Assessment list */}
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

              {/* ✅ Assessment Type Toggle Buttons */}
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
                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-md text-[10px] font-semibold transition ${
                      assessmentType === "specific"
                        ? "bg-green-500 text-white shadow-sm"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    <Target size={10} />
                    Specific
                  </button>
                  <button
                    onClick={() => {
                      setAssessmentType("general");
                      handleFetchLayer(fieldAssessments.activeLayer, "general");
                    }}
                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-md text-[10px] font-semibold transition ${
                      assessmentType === "general"
                        ? "bg-blue-500 text-white shadow-sm"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    <MapPin size={10} />
                    General
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

                {selectedSiteIdForFilter && assessmentType === "specific" && (
                  <div className="mt-2 flex items-center justify-between gap-2 p-2 bg-green-50 rounded border border-green-200">
                    <p className="text-[10px] text-green-700 font-medium">
                      🎯 Site #{selectedSiteIdForFilter}
                    </p>
                    <button
                      onClick={() => handleSiteSelectForFilter(null)}
                      className="text-[9px] text-green-600 hover:text-green-800 underline"
                    >
                      Clear
                    </button>
                  </div>
                )}

                {!selectedSiteIdForFilter && assessmentType === "specific" && (
                  <p className="text-[9px] text-orange-600 mt-1 text-center font-medium">
                    ⚠️ Select a site from the list below to filter
                  </p>
                )}
              </div>

              {/* Layer tabs */}
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

              {/* Assessment entries */}
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
                        className={`w-full text-left px-3 py-2.5 border-b border-gray-50 transition
                          ${isSelected ? "bg-blue-50 border-l-2 border-l-blue-500" : "hover:bg-gray-50"}`}
                      >
                        <div className="flex items-center gap-2">
                          {entry.inspector.profile_image && (
                            <img
                              src={`http://127.0.0.1:8000${entry.inspector.profile_image}`}
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
                                  className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium border transition
                                    ${hasLocation ? "bg-green-50 text-green-700 border-green-300 hover:bg-green-100" : "bg-orange-50 text-orange-700 border-orange-300 hover:bg-orange-100"}`}
                                >
                                  <MapPin size={9} />
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

        {/* Bottom row: Site List + Assessment Detail */}
        <div className="flex gap-3">
          {/* Site List */}
          <div className="w-[50%] bg-white rounded-lg border border-gray-200 flex flex-col min-h-[120px]">
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

          {/* Assessment Detail Panel */}
          <div className="w-[45%]">
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

      {/* Site Validation Panel */}
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
