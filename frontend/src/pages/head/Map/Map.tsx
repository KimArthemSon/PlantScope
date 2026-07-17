import {
  MapContainer,
  TileLayer,
  useMap,
  GeoJSON,
  Marker,
  Popup,
  Polygon,
  WMSTileLayer,
} from "react-leaflet";
import { useState, useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import "@geoman-io/leaflet-geoman-free";
import {
  Cross,
  Eye,
  House,
  Pointer,
  Activity,
  Trash,
  CloudLightning,
  Pen,
  Filter,
  File,
  AreaChart,
  Info,
  MapPin,
  Search,
  X,
  Shield,
  Target,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  Ruler,
  Leaf,
  Globe,
  Move,
  Plus,
  Loader2,
  Layers,
  EyeOff,
  ChevronRight,
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  TrendingUp,
  RefreshCw,
} from "lucide-react";

import PlantScopeAlert from "@/components/alert/PlantScopeAlert";
import { useUserRole } from "@/hooks/authorization";
import CanopyGuideModal from "./canopy_guide";
import BarangayClassifiedAreas from "./barangay_classified_area";
import PotentialSiteTrends from "./potentialSiteTrends";
import HazardAssessmentPanel from "./components/HazardAssessmentPanel";
import BarangayHazardAnalysis from "./components/BarangayHazardAnalysis";
import SiteInfoPanel from "@/components/map/SiteInfoPanel";
import { useNavigate } from "react-router-dom";
import { api } from "@/constant/api.ts";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function MapInitializer({ setMapRef }: { setMapRef: (map: L.Map) => void }) {
  const map = useMap();
  useEffect(() => {
    setMapRef(map);
  }, [map, setMapRef]);
  return null;
}

function MapController({ center }: { center: [number, number] }) {
  const map = useMap();
  map.setView(center, 12);
  return null;
}

interface PolygonGeometry {
  type: "Polygon";
  coordinates: [number, number][];
}
interface ClassifiedArea {
  classified_area_id: number;
  name: string;
  land_classification_id: number;
  land_classification_name: string;
  polygon: PolygonGeometry;
  description: string;
  created_at: string;
}
export interface ReforestationArea {
  reforestation_area_id: number;
  name: string;
  description: string;
  coordinate: [number, number] | null;
  barangay?: { barangay_id: number; name: string } | null;
  created_at: string;
}
export interface Site {
  site_id: number;
  name: string;
  reforestation_area_id: number;
  center_coordinate: [number, number] | null;
  polygon_coordinates?: any;
  status: string;
  total_area_hectares?: number;
  ndvi_value?: number;
  created_at: string;
}
interface Barangays {
  barangay_id: number;
  name: string;
  description: string;
  coordinate: [number, number];
}
interface SiteStatistics {
  total: number;
  totalArea: number;
  avgNDVI: number;
}
interface HazardArea {
  hazard_area_id: number;
  name: string;
  hazard_type: string;
  barangay_id: number | null;
  polygon: { type: string; coordinates: [number, number][] };
  description: string;
  created_at: string;
}

const decimalToDMS = (value: number, type: "lat" | "lng") => {
  const absolute = Math.abs(value);
  const degrees = Math.floor(absolute);
  const minutesNotTruncated = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesNotTruncated);
  const seconds = ((minutesNotTruncated - minutes) * 60).toFixed(2);
  let direction =
    type === "lat" ? (value >= 0 ? "N" : "S") : value >= 0 ? "E" : "W";
  return `${degrees}° ${minutes}' ${seconds}" ${direction}`;
};

const createMarkerIcon = (
  type: "barangay" | "reforestation" | "site" | "temp",
  labelText: string = "",
) => {
  const colors = {
    barangay: "#EAB308",
    reforestation: "#3B82F6",
    site: "#22C55E",
    temp: "#EF4444",
  };
  const icons = {
    barangay: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/></svg>`,
    reforestation: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19v3"/><path d="M12 19l-4-4"/><path d="M12 19l4-4"/><path d="M12 11l-5-5"/><path d="M12 11l5-5"/><path d="M12 11v8"/><path d="M7 14l-3 3"/><path d="M17 14l3 3"/><path d="M12 2v4"/><path d="M8 6h8"/></svg>`,
    site: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/></svg>`,
    temp: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
  };
  const color = colors[type];
  const icon = icons[type];
  const html = `
    <div style="display: flex; align-items: center; gap: 4px;">
      <div style="position: relative; width: 24px; height: 30px; flex-shrink: 0;">
        <svg width="24" height="30" viewBox="0 0 24 30" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 0C5.373 0 0 5.373 0 12C0 18.627 12 30 12 30C12 30 24 18.627 24 12C24 5.373 18.627 0 12 0Z" fill="${color}" stroke="white" stroke-width="2"/>
        </svg>
        <div style="position: absolute; top: 5px; left: 6px; width: 12px; height: 12px; display: flex; align-items: center; justify-content: center;">
          ${icon}
        </div>
      </div>
      ${labelText ? `<span style="font-size: 11px; font-weight: 600; color: #1f2937; background: rgba(255,255,255,0.9); padding: 2px 6px; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.2); white-space: nowrap;">${labelText}</span>` : ""}
    </div>
  `;
  return L.divIcon({
    html,
    className: "custom-marker-icon-small",
    iconSize: [labelText ? Math.min(200, 28 + labelText.length * 7) : 24, 30],
    iconAnchor: [
      labelText ? Math.min(200, 28 + labelText.length * 7) / 2 : 12,
      30,
    ],
    popupAnchor: [0, -30],
  });
};

export default function Map() {
  const token = localStorage.getItem("token");
  const ORMOCCITY: [number, number] = [11.02, 124.61];
  const mapRef = useRef<L.Map | null>(null);
  const drawnLayerRef = useRef<any>(null);

  const [classified_areas, setClassified_areas] = useState<ClassifiedArea[]>(
    [],
  );
  const [barangays, setBarangays] = useState<Barangays[]>([]);
  const [showCanopyGuide, setShowCanopyGuide] = useState(false);
  const [hazard_areas, setHazard_areas] = useState<HazardArea[]>([]);
  const [visibleHazardBarangayId, setVisibleHazardBarangayId] = useState<
    number | null
  >(null);

  const getHazardColor = (hazardType: string) => {
    const colors: { [key: string]: { stroke: string; fill: string } } = {
      LANDSLIDE: { stroke: "#dc2626", fill: "#ef4444" },
      FLOOD: { stroke: "#2563eb", fill: "#3b82f6" },
      EARTHQUAKE: { stroke: "#7c3aed", fill: "#8b5cf6" },
      VOLCANIC: { stroke: "#ea580c", fill: "#f97316" },
      STORM_SURGE: { stroke: "#0891b2", fill: "#06b6d4" },
      LIQUEFACTION: { stroke: "#ca8a04", fill: "#eab308" },
      COASTAL_EROSION: { stroke: "#0d9488", fill: "#14b8a6" },
      OTHER: { stroke: "#6b7280", fill: "#9ca3af" },
    };
    return colors[hazardType] || colors.OTHER;
  };

  const [areaForm, setAreaForm] = useState({
    name: "",
    description: "",
    barangay_id: 0,
    coordinate: null as [number, number] | null,
  });
  const [siteForm, setSiteForm] = useState({
    reforestation_area_id: 0,
    name: "",
    center_coordinate: null as [number, number] | null,
  });
  const [selectedPotentialSiteIds, setSelectedPotentialSiteIds] = useState<
    number[]
  >([]);
  const [reforestation_areas, setReforestation_areas] = useState<
    ReforestationArea[]
  >([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [markerPosition, setMarkerPosition] = useState<[number, number] | null>(
    null,
  );
  const [siteMarkerPosition, setSiteMarkerPosition] = useState<
    [number, number] | null
  >(null);
  const [showSiteTrends, setShowSiteTrends] = useState(false);
  const [selectedSiteGeometry, setSelectedSiteGeometry] = useState<any>(null);
  const [selectedSiteId, setSelectedSiteId] = useState<string>("");
  const [selectedSiteName, setSelectedSiteName] = useState<string>("");
  const [searchLat, setSearchLat] = useState("");
  const [searchLng, setSearchLng] = useState("");
  const [searchMarkerPosition, setSearchMarkerPosition] = useState<
    [number, number] | null
  >(null);
  const [areaSearchQuery, setAreaSearchQuery] = useState("");
  const [showAreaDropdown, setShowAreaDropdown] = useState(false);
  const [isPickingMarker, setIsPickingMarker] = useState(false);
  const [isNdviPenelOpen, setIsNdviPenelOpen] = useState(false);
  const [isAreaFormPenelOpen, setIsAreaFormPenelOpen] = useState(false);
  const [isSiteFormPenelOpen, setIsSiteFormPenelOpen] = useState(false);
  const [isDrawPenelOpen, setIsDrawPenelOpen] = useState(false);
  const [isFilterPenelOpen, setIsFilterPenelOpen] = useState(false);
  const [isHazardPanelOpen, setIsHazardPanelOpen] = useState(false);
  const [ndviTileUrl, setNdviTileUrl] = useState<string | null>(null);
  const [showNDVI, setShowNDVI] = useState(true);
  const [isNdviLoading, setIsNdviLoading] = useState(false);
  const [suitablePolygons, setSuitablePolygons] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [drawnGeometry, setDrawnGeometry] = useState<any>(null);
  const [siteStats, setSiteStats] = useState<SiteStatistics>({
    total: 0,
    totalArea: 0,
    avgNDVI: 0,
  });
  const [isFirmsLoading, setIsFirmsLoading] = useState(false);
  const [isSitePanelOpen, setIsSitePanelOpen] = useState(false);
  const navigate = useNavigate();
  const [isPickingSiteMarker, setIsPickingSiteMarker] = useState(false);
  const [showMgbFlood, setShowMgbFlood] = useState(false);
  const [showMgbLandslide, setShowMgbLandslide] = useState(false);
  const [showEil, setShowEil] = useState(false);
  const MGB_FLOOD_TILE_URL =
    "https://controlmap.mgb.gov.ph/arcgis/rest/services/GeospatialDataInventory/GDI_Detailed_Flood_Susceptibility/MapServer/tile/{z}/{y}/{x}";
  const MGB_LANDSLIDE_TILE_URL =
    "https://controlmap.mgb.gov.ph/arcgis/rest/services/GeospatialDataInventory/GDI_Detailed_Rain_induced_Landslide_Susceptibility/MapServer/tile/{z}/{y}/{x}";
  const PHIVOLCS_EIL_WMS_URL =
    "https://gisweb.phivolcs.dost.gov.ph/arcgis/services/PHIVOLCSPublic/EarthquakeInducedLandslide/MapServer/WMSServer";
  const [showFirms, setShowFirms] = useState(false);
  const [fireCount, setFireCount] = useState(0);
  const [firmsTimeRange, setFirmsTimeRange] = useState<
    "today" | "24hrs" | "7days"
  >("today");
  const [firmsGeoJsonLayer, setFirmsGeoJsonLayer] = useState<any>(null);

  const formatDate = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const today = new Date();
  const fiveMonthsAgo = new Date(
    today.getFullYear(),
    today.getMonth() - 5,
    today.getDate(),
  );
  const [start, setStart] = useState(formatDate(fiveMonthsAgo));
  const [end, setEnd] = useState(formatDate(today));
  const [goHome, setGoHome] = useState(false);
  const [PSalert, setPSAlert] = useState<{
    type: "success" | "failed" | "error";
    title: string;
    message: string;
  } | null>(null);
  const [selectedBarangayId, setSelectedBarangayId] = useState<number | null>(
    null,
  );
  const [showBarangayAnalysis, setShowBarangayAnalysis] = useState(false);
  const [selectedBarangayForAnalysis, setSelectedBarangayForAnalysis] =
    useState<{ id: number; name: string } | null>(null);
  const [mouseCoords, setMouseCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [showDMS, setShowDMS] = useState(false);
  const [showSites, setShowSites] = useState(false);
  const [showLegend, setShowLegend] = useState(false);

  // ✅ SEPARATED STATE FOR SITE AND POTENTIAL SITES
  const [showSitePolygon, setShowSitePolygon] = useState(false);
  const [showPotentialSites, setShowPotentialSites] = useState(false);
  const [currentSitePolygon, setCurrentSitePolygon] = useState<any>(null);
  const [activePotentialSites, setActivePotentialSites] = useState<any[]>([]);
  const [activeShownSiteId, setActiveShownSiteId] = useState<number | null>(
    null,
  );
  const [reanalyzeTargetSiteId, setReanalyzeTargetSiteId] = useState<
    number | null
  >(null);

  // ✅ NEW: Custom Confirmation Modal State
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false);
  const [pendingNewSites, setPendingNewSites] = useState<any[]>([]);
  const [pendingNewCount, setPendingNewCount] = useState(0);

  const { userRole } = useUserRole();
  const [firmsStartDate, setFirmsStartDate] = useState<string>(() =>
    formatDate(new Date()),
  );
  const [firmsEndDate, setFirmsEndDate] = useState<string>(() =>
    formatDate(new Date()),
  );
  const [useCustomDateRange, setUseCustomDateRange] = useState(false);

  useEffect(() => {
    if (!showNDVI) setShowCanopyGuide(false);
  }, [showNDVI]);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "g" && showNDVI && !isNdviPenelOpen)
        setShowCanopyGuide((prev) => !prev);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showNDVI, isNdviPenelOpen]);

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    if (!map.pm) return;
    map.off("pm:create");
    const handleCreate = (e: any) => {
      const newLayer = e.layer;
      if (!newLayer) return;
      map.eachLayer((layer: any) => {
        if (
          layer instanceof L.Rectangle ||
          (layer instanceof L.Polygon && !layer.options.fill)
        ) {
          if (layer !== newLayer) map.removeLayer(layer);
        }
      });
      drawnLayerRef.current = null;
      newLayer.setStyle({ color: "#3b82f6", weight: 2, fill: false });
      if (!map.hasLayer(newLayer)) newLayer.addTo(map);
      drawnLayerRef.current = newLayer;
      map.pm.disableDraw();
      try {
        const geoJson = newLayer.toGeoJSON();
        if (geoJson && geoJson.geometry) setDrawnGeometry(geoJson.geometry);
      } catch (err) {
        console.error("Error extracting GeoJSON:", err);
      }
    };
    map.on("pm:create", handleCreate);
    map.on("pm:edit", (e: any) => {
      const layer = e.layer;
      if (layer === drawnLayerRef.current) {
        try {
          const geoJson = layer.toGeoJSON();
          if (geoJson && geoJson.geometry) setDrawnGeometry(geoJson.geometry);
        } catch (err) {
          console.error("Error updating geometry on edit:", err);
        }
      }
    });
    return () => {
      map.off("pm:create", handleCreate);
      map.off("pm:edit");
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const handleClick = (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      if (isPickingMarker) {
        setMarkerPosition([lat, lng]);
        setAreaForm({ ...areaForm, coordinate: [lat, lng] });
        setIsPickingMarker(false);
        setPSAlert({
          type: "success",
          title: "Marker Placed",
          message: "Area center location set.",
        });
      }
      if (isPickingSiteMarker) {
        setSiteMarkerPosition([lat, lng]);
        setSiteForm({ ...siteForm, center_coordinate: [lat, lng] });
        setIsPickingSiteMarker(false);
        setPSAlert({
          type: "success",
          title: "Marker Placed",
          message: "Site center location set.",
        });
      }
    };
    map.on("click", handleClick);
    return () => map.off("click", handleClick);
  }, [isPickingMarker, isPickingSiteMarker, areaForm, siteForm]);

  // ==========================================================
  // ✅ CORE FEATURES IMPLEMENTATION
  // ==========================================================

  const handleShowSiteInMap = async (siteId: number, polygon: any) => {
    setShowPotentialSites(false);
    setActivePotentialSites([]);
    if (!polygon || !Array.isArray(polygon) || polygon.length === 0) {
      setPSAlert({
        type: "failed",
        title: "No Polygon",
        message: "This site doesn't have valid polygon coordinates.",
      });
      return;
    }
    try {
      const coordinates = polygon.map((coord: number[]) =>
        Array.isArray(coord) && coord.length === 2
          ? [coord[1], coord[0]]
          : coord,
      );
      const firstPoint = coordinates[0];
      const lastPoint = coordinates[coordinates.length - 1];
      if (firstPoint[0] !== lastPoint[0] || firstPoint[1] !== lastPoint[1])
        coordinates.push([...firstPoint]);
      const geoJsonPolygon = {
        type: "Polygon" as const,
        coordinates: [coordinates],
      };
      setActiveShownSiteId(siteId);
      setCurrentSitePolygon(geoJsonPolygon);
      setShowSitePolygon(true);
      if (mapRef.current) {
        try {
          const geoJsonLayer = L.geoJSON(geoJsonPolygon);
          const bounds = geoJsonLayer.getBounds();
          if (bounds.isValid())
            mapRef.current.fitBounds(bounds, {
              padding: [50, 50],
              maxZoom: 18,
            });
        } catch (mapError) {
          console.error("❌ Map bounds error:", mapError);
        }
      }
      setPSAlert({
        type: "success",
        title: "Site Highlighted",
        message: "Site boundary displayed.",
      });
    } catch (error) {
      console.error("❌ Error showing site on map:", error);
      setPSAlert({
        type: "error",
        title: "Error",
        message: "Failed to display site on map.",
      });
    }
  };

  const handleShowPotentialSites = async (siteId: number) => {
    setShowSitePolygon(false);
    setCurrentSitePolygon(null);
    setActiveShownSiteId(siteId);
    setShowPotentialSites(true);
    try {
      const res = await fetch(
        `${api}api/get_potential_sites/?site_id=${siteId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.ok) {
        const data = await res.json();
        setActivePotentialSites(data.data || []);
        setPSAlert({
          type: "success",
          title: "Potential Sites Loaded",
          message: `Showing ${data.data?.length || 0} potential site(s).`,
        });
      }
    } catch (error) {
      console.error("Error fetching potential sites:", error);
      setPSAlert({
        type: "error",
        title: "Error",
        message: "Failed to load potential sites.",
      });
    }
  };

  const handleHideAll = () => {
    setShowSitePolygon(false);
    setShowPotentialSites(false);
    setCurrentSitePolygon(null);
    setActivePotentialSites([]);
    setActiveShownSiteId(null);
  };

  const handleDeletePotentialSite = async (potential_sites_id: number) => {
    try {
      const res = await fetch(
        `${api}api/delete_potential_site/${potential_sites_id}/`,
        { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.ok) {
        setActivePotentialSites((prev) =>
          prev.filter((p) => p.potential_sites_id !== potential_sites_id),
        );
        setPSAlert({
          type: "success",
          title: "Deleted",
          message: "Potential site removed successfully.",
        });
      } else {
        throw new Error("Failed to delete");
      }
    } catch (err) {
      setPSAlert({
        type: "error",
        title: "Error",
        message: "Failed to delete potential site.",
      });
    }
  };

  const handleViewTrend = (siteId: number, polygon: any) => {
    setSelectedSiteId(siteId.toString());
    let geometryToUse = polygon;
    if (polygon && Array.isArray(polygon) && polygon.length > 0) {
      const coordinates = polygon.map((coord: number[]) =>
        Array.isArray(coord) && coord.length === 2
          ? [coord[1], coord[0]]
          : coord,
      );
      const firstPoint = coordinates[0];
      const lastPoint = coordinates[coordinates.length - 1];
      if (firstPoint[0] !== lastPoint[0] || firstPoint[1] !== lastPoint[1])
        coordinates.push([...firstPoint]);
      geometryToUse = { type: "Polygon", coordinates: [coordinates] };
    }
    setSelectedSiteGeometry(geometryToUse);
    setShowSiteTrends(true);
  };

  const handleReanalyze = (siteId: number) => {
    if (mapRef.current && drawnLayerRef.current) {
      mapRef.current.removeLayer(drawnLayerRef.current);
      drawnLayerRef.current = null;
    }
    setDrawnGeometry(null);
    setSuitablePolygons(null);
    setSiteStats({ total: 0, totalArea: 0, avgNDVI: 0 });
    setReanalyzeTargetSiteId(siteId);
    setIsDrawPenelOpen(true);
    setPSAlert({
      type: "success",
      title: "Re-analyze Mode",
      message:
        "Draw a new area. You will see a preview of the new results before confirming replacement.",
    });
  };

  // ✅ NEW: Handle Custom Confirmation
  const handleConfirmReplace = async () => {
    if (!reanalyzeTargetSiteId || pendingNewSites.length === 0) return;

    setIsProcessing(true);
    setShowReplaceConfirm(false);

    try {
      const sitesPayload = pendingNewSites.map((f: any) => ({
        site_id: String(
          f.properties.potential_sites_id ||
            f.properties.site_id ||
            `new_${Date.now()}`,
        ),
        geometry: f.geometry,
        area_hectares: f.properties.area_hectares || 0,
        avg_ndvi: f.properties.avg_ndvi || 0,
        suitability_score: f.properties.suitability_score || 0,
      }));

      const bulkRes = await fetch(`${api}api/potential-sites/bulk-create/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          site_id: reanalyzeTargetSiteId,
          sites: sitesPayload,
          replace_existing: true,
        }),
      });

      if (bulkRes.ok) {
        const result = await bulkRes.json();
        setPSAlert({
          type: "success",
          title: "Updated Successfully",
          message: `Replaced ALL old sites with ${result.created_count} new potential site(s).`,
        });
        handleShowPotentialSites(reanalyzeTargetSiteId);
      } else {
        throw new Error("Failed to save new potential sites");
      }
    } catch (err: any) {
      setPSAlert({
        type: "error",
        title: "Update Failed",
        message: err.message,
      });
    } finally {
      setIsProcessing(false);
      setReanalyzeTargetSiteId(null);
      setPendingNewSites([]);
      setPendingNewCount(0);
      setDrawnGeometry(null);
      if (mapRef.current && drawnLayerRef.current) {
        mapRef.current.removeLayer(drawnLayerRef.current);
        drawnLayerRef.current = null;
      }
    }
  };

  const handleCancelReplace = () => {
    setShowReplaceConfirm(false);
    setReanalyzeTargetSiteId(null);
    setPendingNewSites([]);
    setPendingNewCount(0);
    setDrawnGeometry(null);
    setIsProcessing(false);
    if (mapRef.current && drawnLayerRef.current) {
      mapRef.current.removeLayer(drawnLayerRef.current);
      drawnLayerRef.current = null;
    }
    setPSAlert({
      type: "failed",
      title: "Cancelled",
      message: "Analysis discarded. Existing potential sites remain unchanged.",
    });
  };

  // ==========================================================
  // END CORE FEATURES
  // ==========================================================

  const startMarkerPlacement = () => {
    setIsPickingMarker(true);
    setPSAlert({
      type: "success",
      title: "Pick Location",
      message: "Click on the map to place the area center marker.",
    });
  };
  const startSiteMarkerPlacement = () => {
    setIsPickingSiteMarker(true);
    setPSAlert({
      type: "success",
      title: "Pick Location",
      message: "Click on the map to place the site center marker.",
    });
  };

  const renderNDVI = async () => {
    setIsNdviLoading(true);
    try {
      const res = await fetch(`${api}api/ndvi/?start=${start}&end=${end}`, {
        headers: { Authorization: "Bearer " + token },
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      if (data.tile_url) {
        setNdviTileUrl(data.tile_url);
        setShowNDVI(true);
        setShowCanopyGuide(true);
        setSuitablePolygons(null);
        setDrawnGeometry(null);
        setSiteStats({ total: 0, totalArea: 0, avgNDVI: 0 });
        setSelectedPotentialSiteIds([]);
        if (drawnLayerRef.current && mapRef.current) {
          mapRef.current.removeLayer(drawnLayerRef.current);
          drawnLayerRef.current = null;
        }
        setPSAlert({
          type: "success",
          title: "NDVI Loaded",
          message: "Canopy guide opened.",
        });
      } else throw new Error("No tile URL returned");
    } catch (error: any) {
      setPSAlert({
        type: "error",
        title: "NDVI Failed",
        message: error.message,
      });
      setShowCanopyGuide(false);
    } finally {
      setIsNdviLoading(false);
    }
  };

  const analyzeArea = async () => {
    let geometryToUse = drawnGeometry;
    if (!geometryToUse && drawnLayerRef.current) {
      try {
        const geoJson = drawnLayerRef.current.toGeoJSON();
        if (geoJson && geoJson.geometry) {
          geometryToUse = geoJson.geometry;
          setDrawnGeometry(geometryToUse);
        }
      } catch (err) {
        console.error("Failed to get geometry from layer ref:", err);
      }
    }
    if (!geometryToUse && mapRef.current) {
      mapRef.current.eachLayer((layer: any) => {
        if (
          !geometryToUse &&
          (layer instanceof L.Rectangle ||
            (layer instanceof L.Polygon && !layer.options.fill))
        ) {
          try {
            const geoJson = layer.toGeoJSON();
            if (geoJson && geoJson.geometry) {
              geometryToUse = geoJson.geometry;
              drawnLayerRef.current = layer;
              setDrawnGeometry(geometryToUse);
            }
          } catch (err) {
            console.error("Failed to extract from layer:", err);
          }
        }
      });
    }
    if (!geometryToUse) {
      setPSAlert({
        type: "failed",
        title: "No Area Drawn",
        message: "Please draw a rectangle first.",
      });
      return;
    }

    setSuitablePolygons(null);
    setSiteStats({ total: 0, totalArea: 0, avgNDVI: 0 });
    setSelectedPotentialSiteIds([]);
    setIsProcessing(true);

    try {
      const res = await fetch(`${api}api/suitable-sites/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({ start, end, geometry: geometryToUse }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to analyze");

      if (data.success && data.features && data.features.length > 0) {
        // ✅ RE-ANALYZE MODE: Show custom confirmation WITH PREVIEW instead of auto-replacing
        if (reanalyzeTargetSiteId) {
          setPendingNewSites(data.features);
          setPendingNewCount(data.features.length);
          setShowReplaceConfirm(true);
          setIsProcessing(false); // Stop spinner so user can interact with modal and see preview
          return; // Exit early, wait for user confirmation
        }

        // Normal flow for creating a NEW site
        setSuitablePolygons(data);
        const totalArea = data.features.reduce(
          (sum: number, f: any) => sum + (f.properties.area_hectares || 0),
          0,
        );
        const avgNDVI =
          data.features.reduce(
            (sum: number, f: any) => sum + (f.properties.avg_ndvi || 0),
            0,
          ) / data.features.length;
        setSiteStats({ total: data.features.length, totalArea, avgNDVI });
        setPSAlert({
          type: "success",
          title: "Analysis Complete",
          message: `Found ${data.features.length} potential site(s).`,
        });
      } else {
        setPSAlert({
          type: "failed",
          title: "No Sites Found",
          message:
            "No suitable sites found. Try adjusting the date range or drawing a different area.",
        });
      }
    } catch (err: any) {
      setPSAlert({
        type: "error",
        title: "Analysis Failed",
        message: err.message || "Failed to analyze area",
      });
    }

    // Only reset processing if we didn't open the confirmation modal
    if (!showReplaceConfirm) {
      setIsProcessing(false);
    }
  };

  const cancelDrawing = () => {
    if (mapRef.current && drawnLayerRef.current) {
      if (mapRef.current.hasLayer(drawnLayerRef.current))
        mapRef.current.removeLayer(drawnLayerRef.current);
      drawnLayerRef.current = null;
    }
    setDrawnGeometry(null);
    setReanalyzeTargetSiteId(null);
    setShowReplaceConfirm(false);
    setPendingNewSites([]);
    setPendingNewCount(0);
    setIsProcessing(false);
    setPSAlert({
      type: "success",
      title: "Drawing Cancelled",
      message: "Analysis area removed.",
    });
  };

  const handleHome = () => {
    setGoHome(true);
    setTimeout(() => setGoHome(false), 100);
  };

  const clearAnalysis = () => {
    setSuitablePolygons(null);
    setDrawnGeometry(null);
    setSiteStats({ total: 0, totalArea: 0, avgNDVI: 0 });
    setSelectedPotentialSiteIds([]);
    setReanalyzeTargetSiteId(null);
    setShowReplaceConfirm(false);
    setPendingNewSites([]);
    setPendingNewCount(0);
    setIsProcessing(false);
    if (mapRef.current && drawnLayerRef.current) {
      if (mapRef.current.hasLayer(drawnLayerRef.current))
        mapRef.current.removeLayer(drawnLayerRef.current);
      drawnLayerRef.current = null;
    }
    if (mapRef.current) {
      mapRef.current.eachLayer((layer: any) => {
        if (
          layer instanceof L.Rectangle ||
          (layer instanceof L.Polygon && !layer.options.fill)
        )
          mapRef.current!.removeLayer(layer);
      });
    }
    setPSAlert({
      type: "success",
      title: "Cleared",
      message: "All analysis data and drawings removed.",
    });
  };

  const startDrawingAnalysis = () => {
    if (!mapRef.current) {
      setPSAlert({
        type: "error",
        title: "Map Error",
        message: "Map not ready. Please refresh the page.",
      });
      return;
    }
    mapRef.current.eachLayer((layer: any) => {
      if (
        layer instanceof L.Rectangle ||
        (layer instanceof L.Polygon && !layer.options.fill)
      )
        mapRef.current!.removeLayer(layer);
    });
    drawnLayerRef.current = null;
    setDrawnGeometry(null);
    if (!mapRef.current.pm) {
      setPSAlert({
        type: "error",
        title: "Drawing Error",
        message: "Drawing tools not available. Please refresh the page.",
      });
      return;
    }
    mapRef.current.pm.disableDraw();
    setTimeout(() => {
      if (mapRef.current && mapRef.current.pm) {
        try {
          mapRef.current.pm.enableDraw("Rectangle", {
            snappable: false,
            cursorMarker: true,
            allowSelfIntersection: false,
            templineStyle: { color: "#3b82f6", dashArray: "5,5", weight: 2 },
            hintlineStyle: { color: "#3b82f6", dashArray: "5,5", weight: 2 },
            pathOptions: {
              color: "#3b82f6",
              fillColor: "#3b82f6",
              fillOpacity: 0.1,
              weight: 2,
            },
          });
          setPSAlert({
            type: "success",
            title: "Draw Mode Active",
            message:
              "Click and drag on the map to draw a rectangle, then click Analyze.",
          });
        } catch (err) {
          setPSAlert({
            type: "error",
            title: "Drawing Error",
            message: "Failed to enable drawing mode. Please try again.",
          });
        }
      }
    }, 150);
  };

  const togglePotentialSiteSelection = (featureId: number) => {
    setSelectedPotentialSiteIds((prev) =>
      prev.includes(featureId)
        ? prev.filter((id) => id !== featureId)
        : [...prev, featureId],
    );
  };

  useEffect(() => {
    get_classified_area();
    getBarangays();
    get_all_reforestation_areas();
    get_all_sites();
  }, []);
  async function get_classified_area() {
    try {
      const res = await fetch(`${api}api/get_classified_areas/`, {
        headers: { Authorization: "Bearer " + token },
      });
      const data = await res.json();
      setClassified_areas(data.data);
    } catch (e) {}
  }
  async function getBarangays() {
    try {
      const res = await fetch(`${api}api/get_barangay_list/`, {
        headers: { Authorization: "Bearer " + token },
      });
      const data = await res.json();
      setBarangays(data.data);
    } catch (error) {}
  }
  async function get_all_reforestation_areas() {
    try {
      const res = await fetch(`${api}api/get_all_reforestation_areas/`, {
        headers: { Authorization: token ? `Bearer ${token}` : "" },
      });
      const data = await res.json();
      setReforestation_areas(data.data);
    } catch (err) {}
  }
  async function get_all_sites() {
    try {
      const res = await fetch(`${api}api/get_all_sites/`, {
        headers: { Authorization: token ? `Bearer ${token}` : "" },
      });
      if (res.ok) {
        const data = await res.json();
        setSites(data.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch sites:", err);
    }
  }
  function closeAll() {
    setIsNdviPenelOpen(false);
    setIsAreaFormPenelOpen(false);
    setIsSiteFormPenelOpen(false);
    setIsDrawPenelOpen(false);
    setIsFilterPenelOpen(false);
    setIsHazardPanelOpen(false);
  }
  const goToCoordinate = () => {
    const lat = parseFloat(searchLat);
    const lng = parseFloat(searchLng);
    if (isNaN(lat) || isNaN(lng)) {
      setPSAlert({
        type: "failed",
        title: "Invalid",
        message: "Enter valid coordinates.",
      });
      return;
    }
    setSearchMarkerPosition([lat, lng]);
    mapRef.current?.setView([lat, lng], 16);
  };

  async function onSubmitArea(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!areaForm.name.trim() || !areaForm.barangay_id) {
      setPSAlert({
        type: "failed",
        title: "Validation Error",
        message: "Name and Barangay are required",
      });
      return;
    }
    try {
      const formData = new FormData();
      formData.append("name", areaForm.name.trim());
      formData.append("description", areaForm.description.trim());
      formData.append("barangay_id", String(areaForm.barangay_id));
      if (areaForm.coordinate)
        formData.append("coordinate", JSON.stringify(areaForm.coordinate));
      const res = await fetch(`${api}api/create_reforestation_areas/`, {
        method: "POST",
        headers: { Authorization: "Bearer " + token },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Create failed");
      setPSAlert({
        type: "success",
        title: "Success",
        message: "Reforestation Area created!",
      });
      setAreaForm({
        name: "",
        description: "",
        barangay_id: 0,
        coordinate: null,
      });
      setMarkerPosition(null);
      setIsAreaFormPenelOpen(false);
      get_all_reforestation_areas();
    } catch (error: any) {
      setPSAlert({ type: "error", title: "Error", message: error.message });
    }
  }

  async function onSubmitSite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (
      !siteForm.name.trim() ||
      !siteForm.reforestation_area_id ||
      !siteForm.center_coordinate
    ) {
      setPSAlert({
        type: "failed",
        title: "Validation Error",
        message: "Name, Parent Area, and Center Coordinate are required",
      });
      return;
    }
    try {
      const payload = {
        name: siteForm.name.trim(),
        reforestation_area_id: siteForm.reforestation_area_id,
        center_coordinate: siteForm.center_coordinate,
      };
      const res = await fetch(`${api}api/sites/create_site/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Site creation failed");

      if (selectedPotentialSiteIds.length > 0 && suitablePolygons?.features) {
        const selectedFeatures = suitablePolygons.features.filter((f: any) =>
          selectedPotentialSiteIds.includes(f.properties.potential_sites_id),
        );
        const sitesPayload = selectedFeatures.map((f: any) => ({
          site_id: String(f.properties.potential_sites_id),
          geometry: f.geometry,
          area_hectares: f.properties.area_hectares || 0,
          avg_ndvi: f.properties.avg_ndvi || 0,
          suitability_score: f.properties.suitability_score || 0,
        }));
        const bulkRes = await fetch(`${api}api/potential-sites/bulk-create/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            site_id: data.site_id,
            sites: sitesPayload,
            replace_existing: false,
          }),
        });
        if (!bulkRes.ok) console.error("⚠️ Bulk create failed");
      }
      setPSAlert({
        type: "success",
        title: "Site Created",
        message: `Site "${siteForm.name}" created successfully!`,
      });
      setSiteForm({
        reforestation_area_id: 0,
        name: "",
        center_coordinate: null,
      });
      setSiteMarkerPosition(null);
      setSelectedPotentialSiteIds([]);
      setIsSiteFormPenelOpen(false);
      get_all_sites();
    } catch (error: any) {
      setPSAlert({ type: "error", title: "Error", message: error.message });
    }
  }

  const fetchFirmsData = async (
    timeRange?: "today" | "24hrs" | "7days",
    startDate?: string,
    endDate?: string,
  ) => {
    if (!mapRef.current) return;
    const effectiveTimeRange = timeRange || firmsTimeRange;
    const isExplicitCustom = startDate !== undefined && endDate !== undefined;
    const payloadStartDate = isExplicitCustom ? startDate : firmsStartDate;
    const payloadEndDate = isExplicitCustom ? endDate : firmsEndDate;
    try {
      const bounds = mapRef.current.getBounds();
      const bbox = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`;
      const requestBody: any = { bbox: bbox, time_range: effectiveTimeRange };
      if (isExplicitCustom) {
        requestBody.start_date = payloadStartDate;
        requestBody.end_date = payloadEndDate;
      }
      const response = await fetch(`${api}api/firms-fire-data/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || `HTTP ${response.status}`);
      if (data.success) {
        setFireCount(data.fire_count);
        if (firmsGeoJsonLayer && mapRef.current) {
          mapRef.current.removeLayer(firmsGeoJsonLayer);
          setFirmsGeoJsonLayer(null);
        }
        if (data.fires && Array.isArray(data.fires) && data.fires.length > 0) {
          const geoJsonData = {
            type: "FeatureCollection",
            features: data.fires.map((fire: any) => ({
              type: "Feature",
              geometry: {
                type: "Point",
                coordinates: [fire.longitude, fire.latitude],
              },
              properties: fire,
            })),
          };
          const geoJsonLayer = L.geoJSON(geoJsonData, {
            pointToLayer: (feature, latlng) => {
              const confidence = feature.properties.confidence?.toLowerCase();
              let color = "#ff6600",
                radius = 5;
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
                  ? "High"
                  : p.confidence === "l" || p.confidence === "low"
                    ? "Low"
                    : "Nominal";
              layer.bindPopup(
                `<div style="font-size: 12px; min-width: 200px;"><div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid #ddd;"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg><strong style="color: #dc2626; font-size: 14px;">Fire Hotspot</strong></div><div style="margin-bottom: 4px;"><strong>Location:</strong> ${p.latitude.toFixed(4)}, ${p.longitude.toFixed(4)}</div><div style="margin-bottom: 4px;"><strong>Brightness:</strong> ${p.brightness ? p.brightness.toFixed(1) : "N/A"} K</div><div style="margin-bottom: 4px;"><strong>FRP:</strong> ${p.frp || "N/A"} GW</div><div style="margin-bottom: 4px;"><strong>Confidence:</strong> <span style="color: ${confidenceLabel === "High" ? "#dc2626" : confidenceLabel === "Low" ? "#fbbf24" : "#ff6600"}; font-weight: bold;">${confidenceLabel}</span></div><div style="margin-bottom: 4px;"><strong>Date:</strong> ${p.acq_date || "N/A"}</div><div style="margin-bottom: 4px;"><strong>Time:</strong> ${p.acq_time || "N/A"}</div><div><strong>Satellite:</strong> ${p.satellite} (${p.instrument})</div></div>`,
              );
            },
          }).addTo(mapRef.current);
          setFirmsGeoJsonLayer(geoJsonLayer);
          const dateInfo = isExplicitCustom
            ? `${payloadStartDate} to ${payloadEndDate}`
            : effectiveTimeRange;
          setPSAlert({
            type: "success",
            title: "Fires Detected",
            message: `Found ${data.fires.length} active fire hotspot${data.fires.length > 1 ? "s" : ""} (${dateInfo})`,
          });
        } else {
          const dateInfo = isExplicitCustom
            ? `${payloadStartDate} to ${payloadEndDate}`
            : effectiveTimeRange;
          setPSAlert({
            type: "success",
            title: "All Clear",
            message: `No active fires detected in current view (${dateInfo})`,
          });
        }
      }
    } catch (error) {
      setFireCount(0);
      setPSAlert({
        type: "error",
        title: "FIRMS Error",
        message:
          (error as Error).message || "Failed to connect to fire data service",
      });
    } finally {
      setIsFirmsLoading(false);
    }
  };

  const toggleFirms = () => {
    const newState = !showFirms;
    setShowFirms(newState);
    if (!newState) {
      if (firmsGeoJsonLayer && mapRef.current) {
        mapRef.current.removeLayer(firmsGeoJsonLayer);
        setFirmsGeoJsonLayer(null);
      }
      setFireCount(0);
      setIsFirmsLoading(false);
    } else {
      setIsFirmsLoading(true);
      setTimeout(() => {
        if (useCustomDateRange)
          fetchFirmsData(firmsTimeRange, firmsStartDate, firmsEndDate);
        else fetchFirmsData();
      }, 500);
    }
  };
  const updateFirmsTimeRange = (range: "today" | "24hrs" | "7days") => {
    setFirmsTimeRange(range);
    setUseCustomDateRange(false);
    if (showFirms) {
      if (firmsGeoJsonLayer && mapRef.current) {
        mapRef.current.removeLayer(firmsGeoJsonLayer);
        setFirmsGeoJsonLayer(null);
      }
      setIsFirmsLoading(true);
      setTimeout(() => fetchFirmsData(range, undefined, undefined), 300);
    }
  };
  const applyCustomDateRange = () => {
    setUseCustomDateRange(true);
    if (showFirms) {
      if (firmsGeoJsonLayer && mapRef.current) {
        mapRef.current.removeLayer(firmsGeoJsonLayer);
        setFirmsGeoJsonLayer(null);
      }
      setIsFirmsLoading(true);
      setTimeout(
        () => fetchFirmsData(firmsTimeRange, firmsStartDate, firmsEndDate),
        300,
      );
    }
  };

  function MouseTracker({
    onCoordsChange,
  }: {
    onCoordsChange: (coords: { lat: number; lng: number } | null) => void;
  }) {
    const map = useMap();
    useEffect(() => {
      const handleMouseMove = (e: L.LeafletMouseEvent) =>
        onCoordsChange({ lat: e.latlng.lat, lng: e.latlng.lng });
      const handleMouseOut = () => onCoordsChange(null);
      map.on("mousemove", handleMouseMove);
      map.on("mouseout", handleMouseOut);
      return () => {
        map.off("mousemove", handleMouseMove);
        map.off("mouseout", handleMouseOut);
      };
    }, [map, onCoordsChange]);
    return null;
  }

  (window as any).handleDeletePotentialSite = (potential_sites_id: number) => {
    handleDeletePotentialSite(potential_sites_id);
  };
  (window as any).handleViewTrend = (potential_sites_id?: number) => {
    const targetPolygon = potential_sites_id
      ? activePotentialSites.find(
          (p: any) => p.potential_sites_id === potential_sites_id,
        )?.polygon_coordinates
      : currentSitePolygon;
    handleViewTrend(
      selectedSiteId ? parseInt(selectedSiteId) : 0,
      targetPolygon,
    );
  };
  (window as any).handleReanalyze = () => {
    handleReanalyze(selectedSiteId ? parseInt(selectedSiteId) : 0);
  };

  return (
    <div className="relative h-screen w-full">
      {PSalert && (
        <PlantScopeAlert
          type={PSalert.type}
          title={PSalert.title}
          message={PSalert.message}
          onClose={() => setPSAlert(null)}
        />
      )}

      {/* ✅ CUSTOM CONFIRMATION MODAL FOR RE-ANALYZE WITH EXPLICIT RESULTS */}
      {showReplaceConfirm && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 border border-gray-200 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Activity className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">
                Analysis Results Ready
              </h3>
            </div>

            <p className="text-sm text-gray-600 mb-6 leading-relaxed">
              The new analysis found{" "}
              <strong className="text-blue-600">{pendingNewCount}</strong>{" "}
              potential site(s){" "}
              <span className="text-gray-400">(shown in blue on the map)</span>.
              <br />
              <br />
              Proceeding will{" "}
              <strong className="text-red-600">
                permanently delete all {activePotentialSites.length} existing
              </strong>{" "}
              potential site(s) for this area and replace them with these new
              results.
            </p>

            <div className="flex gap-3 justify-end">
              <button
                onClick={handleCancelReplace}
                disabled={isProcessing}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel & Keep Old
              </button>
              <button
                onClick={handleConfirmReplace}
                disabled={isProcessing}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Updating...
                  </>
                ) : (
                  "Yes, Replace All"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="absolute top-4 right-4 z-[1001] bg-white px-3 py-2 rounded-lg shadow-lg border border-gray-300 text-xs font-mono">
        <div className="flex items-center gap-2">
          <Globe size={14} className="text-[#0f4a2f]" />
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
            <span className="text-gray-400">Move mouse to see coordinates</span>
          )}
          <button
            onClick={() => setShowDMS(!showDMS)}
            className="ml-2 px-2 py-0.5 bg-gray-100 hover:bg-gray-200 rounded text-[10px] font-semibold text-gray-600 transition-colors"
          >
            {showDMS ? "DMS" : "DD"}
          </button>
        </div>
      </div>

      <div className="absolute top-4 left-[90px] z-[1001] w-[280px]">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200">
          <div className="flex items-center gap-2 px-3 py-2.5">
            <Search size={15} className="text-gray-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search reforestation areas..."
              value={areaSearchQuery}
              onChange={(e) => {
                setAreaSearchQuery(e.target.value);
                setShowAreaDropdown(e.target.value.length > 0);
              }}
              onFocus={() => {
                if (areaSearchQuery.length > 0) setShowAreaDropdown(true);
              }}
              onBlur={() => setTimeout(() => setShowAreaDropdown(false), 200)}
              className="flex-1 text-[.75rem] outline-none placeholder-gray-400 bg-transparent"
            />
            {areaSearchQuery && (
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setAreaSearchQuery("");
                  setShowAreaDropdown(false);
                }}
                className="text-gray-400 hover:text-gray-600 flex-shrink-0"
              >
                <X size={13} />
              </button>
            )}
          </div>
          {showAreaDropdown && (
            <div className="border-t border-gray-100 max-h-[300px] overflow-y-auto rounded-b-xl">
              {reforestation_areas.filter((area) =>
                area.name.toLowerCase().includes(areaSearchQuery.toLowerCase()),
              ).length > 0 ? (
                reforestation_areas
                  .filter((area) =>
                    area.name
                      .toLowerCase()
                      .includes(areaSearchQuery.toLowerCase()),
                  )
                  .map((area, idx) => (
                    <button
                      key={idx}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        if (area.coordinate) {
                          const lat = Number(area.coordinate[0]);
                          const lng = Number(area.coordinate[1]);
                          if (!isNaN(lat) && !isNaN(lng))
                            mapRef.current?.setView([lat, lng], 16);
                        }
                        setAreaSearchQuery(area.name);
                        setShowAreaDropdown(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 flex flex-col gap-0.5 border-b border-gray-50 last:border-b-0 transition-colors"
                    >
                      <span className="text-[.75rem] font-semibold text-[#0f4a2f] truncate">
                        {area.name}
                      </span>
                      {area.description && (
                        <span className="text-[.65rem] text-gray-500 truncate">
                          {area.description}
                        </span>
                      )}
                      {area.barangay && (
                        <span className="text-[.6rem] text-gray-400 flex items-center gap-1">
                          <MapPin size={8} /> {area.barangay.name}
                        </span>
                      )}
                    </button>
                  ))
              ) : (
                <div className="px-3 py-3 text-[.75rem] text-gray-500 text-center">
                  No areas found
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="absolute left-4 top-1/2 -translate-y-1/2 z-[1001] space-y-3">
        {showLegend && (
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4 w-[220px]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                <Layers size={16} className="text-[#0f4a2f]" /> Map Legend
              </h3>
              <button
                onClick={() => setShowLegend(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={14} />
              </button>
            </div>
            <div className="space-y-2.5">
              <div className="flex items-center gap-3">
                <div className="w-6 h-8 flex items-center justify-center">
                  <div
                    style={{
                      width: "24px",
                      height: "30px",
                      position: "relative",
                    }}
                  >
                    <svg width="24" height="30" viewBox="0 0 24 30">
                      <path
                        d="M12 0C5.373 0 0 5.373 0 12C0 18.627 12 30 12 30C12 30 24 18.627 24 12C24 5.373 18.627 0 12 0Z"
                        fill="#EAB308"
                        stroke="white"
                        strokeWidth="2"
                      />
                    </svg>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-800">
                    Barangay
                  </p>
                  <p className="text-[10px] text-gray-500">
                    Administrative area
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-6 h-8 flex items-center justify-center">
                  <div
                    style={{
                      width: "24px",
                      height: "30px",
                      position: "relative",
                    }}
                  >
                    <svg width="24" height="30" viewBox="0 0 24 30">
                      <path
                        d="M12 0C5.373 0 0 5.373 0 12C0 18.627 12 30 12 30C12 30 24 18.627 24 12C24 5.373 18.627 0 12 0Z"
                        fill="#3B82F6"
                        stroke="white"
                        strokeWidth="2"
                      />
                    </svg>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-800">
                    Reforestation Area
                  </p>
                  <p className="text-[10px] text-gray-500">Project zone</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-6 h-8 flex items-center justify-center">
                  <div
                    style={{
                      width: "24px",
                      height: "30px",
                      position: "relative",
                    }}
                  >
                    <svg width="24" height="30" viewBox="0 0 24 30">
                      <path
                        d="M12 0C5.373 0 0 5.373 0 12C0 18.627 12 30 12 30C12 30 24 18.627 24 12C24 5.373 18.627 0 12 0Z"
                        fill="#22C55E"
                        stroke="white"
                        strokeWidth="2"
                      />
                    </svg>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-800">Site</p>
                  <p className="text-[10px] text-gray-500">Planting location</p>
                </div>
              </div>
            </div>
          </div>
        )}
        {!showLegend && (
          <button
            onClick={() => setShowLegend(true)}
            className="bg-white p-2 rounded-lg shadow-lg border border-gray-200 hover:bg-gray-50"
          >
            <Layers size={20} className="text-[#0f4a2f]" />
          </button>
        )}
      </div>

      {suitablePolygons && siteStats.total > 0 && (
        <div className="absolute top-4 right-4 bg-white p-4 rounded-lg shadow-lg z-[1000] min-w-[250px]">
          <h3 className="font-bold text-sm mb-3 text-[#0f4a2f] border-b pb-2 flex items-center gap-2">
            <BarChart3 size={16} /> Analysis Results
          </h3>
          <div className="text-xs space-y-2">
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1">
                <MapPin size={12} className="text-gray-500" /> Total Sites:
              </span>
              <strong className="text-[#0f4a2f]">{siteStats.total}</strong>
            </div>
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1">
                <Ruler size={12} className="text-gray-500" /> Total Area:
              </span>
              <strong className="text-[#0f4a2f]">
                {siteStats.totalArea.toFixed(2)} ha
              </strong>
            </div>
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1">
                <Leaf size={12} className="text-gray-500" /> Avg NDVI:
              </span>
              <strong className="text-[#0f4a2f]">
                {siteStats.avgNDVI.toFixed(3)}
              </strong>
            </div>
            <div className="flex justify-between items-center pt-2 border-t mt-2">
              <span className="flex items-center gap-1">
                <CheckCircle size={12} className="text-green-600" /> Selected:
              </span>
              <strong className="text-green-600">
                {selectedPotentialSiteIds.length}
              </strong>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={clearAnalysis}
              className="flex-1 text-xs bg-red-50 hover:bg-red-100 text-red-600 py-2 px-3 rounded border border-red-200 transition-colors flex items-center justify-center gap-1"
            >
              <Trash size={12} /> Clear
            </button>
            <button
              onClick={() => {
                closeAll();
                setIsSiteFormPenelOpen(true);
              }}
              className="flex-1 text-xs bg-green-600 hover:bg-green-700 text-white py-2 px-3 rounded transition-colors flex items-center justify-center gap-1"
            >
              <CheckCircle size={12} /> Create Site
            </button>
          </div>
        </div>
      )}

      {isNdviLoading && (
        <div className="absolute inset-0 z-[1500] flex items-center justify-center bg-[#00000083] pointer-events-none">
          <div className="bg-white p-4 rounded-lg shadow-lg flex items-center gap-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#0f4a2f]"></div>
            <span className="text-sm font-medium text-gray-700">
              Loading NDVI...
            </span>
          </div>
        </div>
      )}

      <div className="absolute z-[1000] flex gap-1 bottom-2 border border-2 border-green-700 rounded rounded-2xl left-1/2 -translate-x-1/2 bg-white p-2 w-[55rem]">
        <button
          onClick={handleHome}
          className="flex items-center justify-center gap-2 bg-[#0f4a2fe0] hover:bg-[#0f4a2f] text-white h-10 px-3 py-2 rounded-lg text-[.7rem] cursor-pointer"
        >
          <House size={16} /> Home
        </button>
        <div className="flex gap-1 ml-auto">
          {userRole != "DataManager" && userRole != "CityENROHead" && (
            <div className="relative ml-auto">
              {isNdviPenelOpen && (
                <div className="absolute bottom-14 left-0 w-[16rem] flex flex-col gap-2 p-2 bg-white border border-[#0f4a2fe0] rounded-md">
                  <div className="text-center font-bold w-full p-1 bg-[#0f4a2fe0] rounded-md">
                    <h1 className="text-white flex items-center justify-center gap-2">
                      <Activity size={16} /> NDVI
                    </h1>
                  </div>
                  <div>
                    <label className="text-[.7rem] text-gray-600">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={start}
                      onChange={(e) => setStart(e.target.value)}
                      className="w-full text-[.7rem] mt-1 p-1 border rounded-md"
                    />
                  </div>
                  <div>
                    <label className="text-[.7rem] text-gray-600">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={end}
                      onChange={(e) => setEnd(e.target.value)}
                      className="w-full text-[.7rem] mt-1 p-1 border rounded-md"
                    />
                  </div>
                  <div className="flex flex-row gap-1 mt-2">
                    {showNDVI && (
                      <button
                        onClick={() => setShowCanopyGuide(!showCanopyGuide)}
                        className="flex items-center justify-center gap-1 bg-blue-600 hover:bg-blue-700 text-white h-8 px-2 py-1 rounded-lg text-[.7rem]"
                      >
                        <Info size={14} /> Guide
                      </button>
                    )}
                    <button
                      onClick={renderNDVI}
                      disabled={isNdviLoading}
                      className={`flex items-center justify-center gap-1 ml-auto h-8 px-2 py-1 rounded-lg text-[.7rem] ${isNdviLoading ? "bg-gray-400" : "bg-[#0f4a2fe0] hover:bg-[#0f4a2f] text-white"}`}
                    >
                      {isNdviLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>{" "}
                          Loading...
                        </>
                      ) : (
                        <>
                          <CloudLightning size={16} /> Run
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => setShowNDVI(!showNDVI)}
                      className="flex items-center justify-center gap-1 bg-[#0f4a2fe0] hover:bg-[#0f4a2f] text-white h-8 px-2 py-1 rounded-lg text-[.7rem]"
                    >
                      <Eye size={16} /> {showNDVI ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>
              )}
              <button
                onClick={() => {
                  closeAll();
                  setIsNdviPenelOpen(!isNdviPenelOpen);
                }}
                className={`flex items-center justify-center gap-2 h-10 px-3 py-2 rounded-lg text-[.7rem] transition-all ${isNdviPenelOpen ? "bg-green-600 text-white shadow-lg ring-2 ring-green-400" : "bg-[#0f4a2fe0] hover:bg-[#0f4a2f] text-white"}`}
              >
                <Activity size={16} /> NDVI
              </button>
            </div>
          )}
          {userRole != "DataManager" && userRole != "CityENROHead" && (
            <div className="relative">
              <div
                className={`absolute bottom-14 right-0 w-[280px] flex flex-col gap-2 p-3 bg-white border border-gray-200 rounded-lg shadow-xl z-[1001] transition-all ${isDrawPenelOpen ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-2 pointer-events-none"}`}
              >
                <div className="bg-[#0f4a2f] rounded-md p-2 text-white text-center">
                  <h2 className="text-sm font-bold flex items-center justify-center gap-2">
                    <Pen size={16} /> Analysis Tools
                  </h2>
                </div>
                <button
                  onClick={startDrawingAnalysis}
                  className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white h-10 px-3 py-2 rounded-lg text-sm font-medium"
                >
                  <Pen size={16} /> Draw Analysis Area
                </button>
                <button
                  onClick={analyzeArea}
                  disabled={isProcessing}
                  className={`flex items-center justify-center gap-2 h-10 px-3 py-2 rounded-lg text-sm font-medium ${isProcessing ? "bg-gray-300 text-gray-500 cursor-not-allowed" : "bg-green-600 hover:bg-green-700 text-white"}`}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />{" "}
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Activity size={16} /> Analyze
                    </>
                  )}
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={cancelDrawing}
                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 h-9 px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1"
                  >
                    <X size={14} /> Cancel
                  </button>
                  <button
                    onClick={clearAnalysis}
                    className="flex-1 bg-red-100 hover:bg-red-200 text-red-700 h-9 px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1"
                  >
                    <Trash size={14} /> Clear
                  </button>
                </div>
              </div>
              <button
                onClick={() => {
                  closeAll();
                  setIsDrawPenelOpen(!isDrawPenelOpen);
                }}
                className={`flex items-center justify-center gap-2 h-10 px-3 py-2 rounded-lg text-[.7rem] transition-all ${isDrawPenelOpen ? "bg-green-600 text-white shadow-lg ring-2 ring-green-400" : "bg-[#0f4a2fe0] hover:bg-[#0f4a2f] text-white"}`}
              >
                <Pen size={16} /> Analyze
              </button>
            </div>
          )}
          <div className="relative">
            <div
              className={`absolute top-[-280px] right-0 w-[16rem] flex flex-col gap-3 p-3 bg-white border border-[#0f4a2fe0] rounded-md ${isFilterPenelOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
            >
              <div className="text-center font-bold w-full p-1 bg-[#0f4a2fe0] rounded-md">
                <h2 className="text-white text-[.8rem] flex items-center justify-center gap-2">
                  <Filter size={16} /> Filters & Search
                </h2>
              </div>
              <div className="border-b border-gray-200 pb-2">
                <label className="text-[.7rem] text-gray-600 font-semibold flex items-center gap-1">
                  <MapPin size={12} /> Filter by Barangay
                </label>
                <select
                  onChange={(e) => {
                    const id = parseInt(e.target.value, 10);
                    const b = barangays.find((x) => x.barangay_id === id);
                    if (b && mapRef.current)
                      mapRef.current.setView(
                        b.coordinate as [number, number],
                        16,
                      );
                  }}
                  className="w-full text-[.7rem] mt-1 p-1.5 border rounded-md bg-gray-50"
                >
                  <option value={0}>-- Select Barangay --</option>
                  {barangays.map((b) => (
                    <option key={b.barangay_id} value={b.barangay_id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[.7rem] text-gray-600 font-semibold flex items-center gap-1">
                  <Globe size={12} /> Search by Coordinates
                </label>
                <div className="space-y-2 mt-1">
                  <div>
                    <input
                      type="number"
                      placeholder="Latitude"
                      value={searchLat}
                      onChange={(e) => setSearchLat(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && goToCoordinate()}
                      className="w-full text-[.7rem] p-1.5 border rounded-md"
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      placeholder="Longitude"
                      value={searchLng}
                      onChange={(e) => setSearchLng(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && goToCoordinate()}
                      className="w-full text-[.7rem] p-1.5 border rounded-md"
                    />
                  </div>
                  <button
                    onClick={goToCoordinate}
                    className="w-full flex items-center justify-center gap-2 bg-[#0f4a2fe0] hover:bg-[#0f4a2f] text-white h-8 px-2 py-1 rounded-lg text-[.7rem] mt-1"
                  >
                    <Move size={14} /> Go to Location
                  </button>
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                closeAll();
                setIsFilterPenelOpen(!isFilterPenelOpen);
              }}
              className={`flex items-center justify-center gap-2 h-10 px-3 py-2 rounded-lg text-[.7rem] transition-all ${isFilterPenelOpen ? "bg-green-600 text-white shadow-lg ring-2 ring-green-400" : "bg-[#0f4a2fe0] hover:bg-[#0f4a2f] text-white"}`}
            >
              <Filter size={16} /> Filter
            </button>
          </div>
          <div className="relative">
            <HazardAssessmentPanel
              isOpen={isHazardPanelOpen}
              start={start}
              end={end}
              setStart={setStart}
              setEnd={setEnd}
              showMgbFlood={showMgbFlood}
              setShowMgbFlood={setShowMgbFlood}
              showMgbLandslide={showMgbLandslide}
              setShowMgbLandslide={setShowMgbLandslide}
              showEil={showEil}
              setShowEil={setShowEil}
              showFirms={showFirms}
              setShowFirms={setShowFirms}
              firmsTimeRange={firmsTimeRange}
              setFirmsTimeRange={setFirmsTimeRange}
              fireCount={fireCount}
              onFetchFirmsData={fetchFirmsData}
              onToggleFirms={toggleFirms}
              onUpdateFirmsTimeRange={updateFirmsTimeRange}
              firmsStartDate={firmsStartDate}
              setFirmsStartDate={setFirmsStartDate}
              firmsEndDate={firmsEndDate}
              setFirmsEndDate={setFirmsEndDate}
              useCustomDateRange={useCustomDateRange}
              setUseCustomDateRange={setUseCustomDateRange}
              onApplyCustomDateRange={applyCustomDateRange}
              isFirmsLoading={isFirmsLoading}
            />
            <button
              onClick={() => {
                closeAll();
                setIsHazardPanelOpen(!isHazardPanelOpen);
              }}
              className={`flex items-center justify-center gap-2 h-10 px-3 py-2 rounded-lg text-[.7rem] transition-all ${isHazardPanelOpen ? "bg-green-600 text-white shadow-lg ring-2 ring-green-400" : "bg-[#0f4a2fe0] hover:bg-[#0f4a2f] text-white"}`}
            >
              <Shield size={16} /> Hazards
            </button>
          </div>
          {userRole != "DataManager" && userRole != "CityENROHead" && (
            <div className="relative">
              <form
                onSubmit={onSubmitArea}
                className={`absolute top-[-360px] right-0 w-[14rem] flex flex-col gap-2 p-2 bg-white border border-[#0f4a2fe0] rounded-md ${isAreaFormPenelOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
              >
                <div className="text-center font-bold w-full p-1 bg-[#0f4a2fe0] border border-[#0f4a2fe0] rounded-md">
                  <h2 className="text-white text-[.8rem] flex items-center justify-center gap-2">
                    <File size={16} /> Create Reforestation Area
                  </h2>
                </div>
                <div>
                  <label className="text-[.7rem] text-gray-600">Name</label>
                  <input
                    type="text"
                    placeholder="Ex: Cabingtan Area"
                    value={areaForm.name}
                    onChange={(e) =>
                      setAreaForm({ ...areaForm, name: e.target.value })
                    }
                    className="w-full text-[.7rem] mt-1 p-1 border rounded-md focus:ring-2 focus:ring-green-500"
                    required
                  />
                </div>
                <div>
                  <label className="text-[.7rem] text-gray-600">
                    Description
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: North sector"
                    value={areaForm.description}
                    onChange={(e) =>
                      setAreaForm({ ...areaForm, description: e.target.value })
                    }
                    className="w-full text-[.7rem] mt-1 p-1 border rounded-md focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="text-[.7rem] text-gray-600">Barangay</label>
                  <select
                    value={areaForm.barangay_id || ""}
                    onChange={(e) =>
                      setAreaForm({
                        ...areaForm,
                        barangay_id: parseInt(e.target.value),
                      })
                    }
                    className="w-full text-[.7rem] mt-1 p-1 border rounded-md focus:ring-2 focus:ring-green-500"
                    required
                  >
                    <option value={0}>-- Select Barangay --</option>
                    {barangays.map((b) => (
                      <option key={b.barangay_id} value={b.barangay_id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[.7rem] text-gray-600">
                    Center Coordinate
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={
                        areaForm.coordinate
                          ? `${areaForm.coordinate[0].toFixed(6)}, ${areaForm.coordinate[1].toFixed(6)}`
                          : ""
                      }
                      readOnly
                      className="w-full text-[.7rem] mt-1 p-1 border rounded-md bg-gray-50"
                    />
                    <button
                      type="button"
                      onClick={startMarkerPlacement}
                      className="flex items-center justify-center gap-1 bg-[#0f4a2fe0] hover:bg-[#0f4a2f] text-white h-8 px-2 py-1 rounded-full text-[.7rem] cursor-pointer"
                    >
                      <Pointer size={16} />
                    </button>
                  </div>
                </div>
                <div className="flex flex-row gap-1 mt-2">
                  <button
                    type="submit"
                    className="flex items-center justify-center gap-1 ml-auto bg-[#0f4a2fe0] hover:bg-[#0f4a2f] text-white h-8 px-2 py-1 rounded-lg text-[.7rem] cursor-pointer"
                  >
                    <CheckCircle size={16} /> Submit Area
                  </button>
                </div>
              </form>
              <button
                onClick={() => {
                  if (isAreaFormPenelOpen) {
                    closeAll();
                  } else {
                    closeAll();
                    setIsAreaFormPenelOpen(!isAreaFormPenelOpen);
                  }
                }}
                className={`flex items-center justify-center gap-2 h-10 px-3 py-2 rounded-lg text-[.7rem] cursor-pointer transition-all ${isAreaFormPenelOpen ? "bg-green-600 text-white shadow-lg ring-2 ring-green-400" : "bg-[#0f4a2fe0] hover:bg-[#0f4a2f] text-white"}`}
              >
                <Plus size={16} /> Create Area
              </button>
            </div>
          )}
          {userRole != "DataManager" && userRole != "CityENROHead" && (
            <div className="relative">
              <form
                onSubmit={onSubmitSite}
                className={`absolute ${suitablePolygons?.features?.length ? "top-[-400px]" : "top-[-295px]"} right-0 w-[14rem] flex flex-col gap-2 p-2 bg-white border border-green-600 rounded-md shadow-xl transition-all duration-200 ${isSiteFormPenelOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
              >
                <div className="text-center font-bold w-full p-1 bg-green-700 rounded-md">
                  <h2 className="text-white text-[.8rem] flex items-center justify-center gap-2">
                    <Target size={16} /> Create Official Site
                  </h2>
                </div>
                <div>
                  <label className="text-[.7rem] text-gray-600">
                    Parent Reforestation Area
                  </label>
                  <select
                    value={siteForm.reforestation_area_id}
                    onChange={(e) =>
                      setSiteForm({
                        ...siteForm,
                        reforestation_area_id: parseInt(e.target.value),
                      })
                    }
                    className="w-full text-[.7rem] mt-1 p-1 border rounded-md focus:ring-2 focus:ring-green-500"
                    required
                  >
                    <option value={0}>-- Select Area --</option>
                    {reforestation_areas.map((area) => (
                      <option
                        key={area.reforestation_area_id}
                        value={area.reforestation_area_id}
                      >
                        {area.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[.7rem] text-gray-600">
                    Site Name
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Site A - North"
                    value={siteForm.name}
                    onChange={(e) =>
                      setSiteForm({ ...siteForm, name: e.target.value })
                    }
                    className="w-full text-[.7rem] mt-1 p-1 border rounded-md focus:ring-2 focus:ring-green-500"
                    required
                  />
                </div>
                <div>
                  <label className="text-[.7rem] text-gray-600">
                    Center Coordinate
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={
                        siteForm.center_coordinate
                          ? `${siteForm.center_coordinate[0].toFixed(6)}, ${siteForm.center_coordinate[1].toFixed(6)}`
                          : ""
                      }
                      readOnly
                      className="w-full text-[.7rem] mt-1 p-1 border rounded-md bg-gray-50"
                    />
                    <button
                      type="button"
                      onClick={startSiteMarkerPlacement}
                      className="flex items-center justify-center gap-1 bg-[#0f4a2fe0] hover:bg-[#0f4a2f] text-white h-8 px-2 py-1 rounded-full text-[.7rem] cursor-pointer"
                    >
                      <Pointer size={16} />
                    </button>
                  </div>
                </div>
                {suitablePolygons && suitablePolygons.features && (
                  <div className="border-t border-gray-200 pt-2 mt-1">
                    <label className="text-[.7rem] text-gray-600 block mb-1">
                      Assigned Potential Sites (Optional)
                    </label>
                    <div className="bg-gray-50 p-2 rounded border text-[.7rem] text-center">
                      <strong className="text-green-700 text-lg">
                        {selectedPotentialSiteIds.length}
                      </strong>
                      <span className="text-gray-500 block">
                        Click red polygons on map to select
                      </span>
                    </div>
                  </div>
                )}
                <div className="flex flex-row gap-1 mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsSiteFormPenelOpen(false);
                      setSiteForm({
                        reforestation_area_id: 0,
                        name: "",
                        center_coordinate: null,
                      });
                      setSiteMarkerPosition(null);
                      setSelectedPotentialSiteIds([]);
                    }}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-700 h-8 px-2 py-1 rounded-lg text-[.7rem]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex items-center justify-center gap-1 ml-auto bg-green-600 hover:bg-green-700 text-white h-8 px-2 py-1 rounded-lg text-[.7rem] cursor-pointer"
                  >
                    <CheckCircle size={16} /> Create Site
                  </button>
                </div>
              </form>
              <button
                onClick={() => {
                  closeAll();
                  setIsSiteFormPenelOpen(!isSiteFormPenelOpen);
                }}
                className={`flex items-center justify-center gap-2 h-10 px-3 py-2 rounded-lg text-[.7rem] cursor-pointer transition-all ${isSiteFormPenelOpen ? "bg-green-600 text-white shadow-lg ring-2 ring-green-400" : "bg-green-600 hover:bg-green-700 text-white"}`}
              >
                <Target size={16} /> Create Site
              </button>
            </div>
          )}
        </div>
      </div>

      <MapContainer
        center={ORMOCCITY}
        zoom={12}
        className="h-full w-full"
        style={{ minHeight: "100vh" }}
      >
        <MapInitializer setMapRef={(map) => (mapRef.current = map)} />
        <MouseTracker onCoordsChange={setMouseCoords} />
        <TileLayer
          url={`https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`}
          tileSize={512}
          zoomOffset={-1}
          attribution='&copy; <a href="https://www.mapbox.com/">Mapbox</a> &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        {ndviTileUrl && showNDVI && (
          <TileLayer
            url={ndviTileUrl}
            opacity={0.7}
            attribution="NDVI &copy; GEE"
          />
        )}

        {suitablePolygons && suitablePolygons.features && (
          <GeoJSON
            data={{
              type: suitablePolygons.type,
              features: suitablePolygons.features,
            }}
            style={(feature) => {
              const isSelected = selectedPotentialSiteIds.includes(
                feature?.properties?.potential_sites_id,
              );
              return {
                color: isSelected ? "#16a34a" : "#dc2626",
                weight: 2,
                fillColor: isSelected ? "#bbf7d0" : "#fecaca",
                fillOpacity: 0.6,
              };
            }}
            onEachFeature={(feature, layer) => {
              const props = feature.properties;
              const isSelected = selectedPotentialSiteIds.includes(
                props.potential_sites_id,
              );
              const popupContent = `<div style="font-size: 12px; min-width: 180px;"><div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid #ddd;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${isSelected ? "#16a34a" : "#dc2626"}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg><strong style="color: ${isSelected ? "#16a34a" : "#dc2626"};">${props.site_id || "Potential Site"}</strong></div><div style="margin-bottom: 4px;"><strong>Area:</strong> ${props.area_hectares?.toFixed(2)} ha</div><div style="margin-bottom: 4px;"><strong>NDVI:</strong> ${props.avg_ndvi?.toFixed(3)}</div><hr style="margin: 6px 0;"/><button id="select-site-btn-${props.potential_sites_id}" style="width:100%; padding:6px; background:${isSelected ? "#dc2626" : "#16a34a"}; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold; margin-bottom:4px;">${isSelected ? "Deselect" : "Select for Site"}</button><button id="view-trends-btn-${props.site_id}" style="width:100%; padding:4px; background:#0f4a2f; color:white; border:none; border-radius:4px; cursor:pointer;">View Trends</button></div>`;
              layer.bindPopup(popupContent);
              layer.on("popupopen", () => {
                const selectBtn = document.getElementById(
                  `select-site-btn-${props.potential_sites_id}`,
                );
                if (selectBtn)
                  selectBtn.onclick = () => {
                    togglePotentialSiteSelection(props.potential_sites_id);
                    layer.closePopup();
                  };
                const trendBtn = document.getElementById(
                  `view-trends-btn-${props.site_id}`,
                );
                if (trendBtn)
                  trendBtn.onclick = () => {
                    layer.closePopup();
                    setSelectedSiteGeometry(feature.geometry);
                    setSelectedSiteId(props.site_id);
                    setShowSiteTrends(true);
                  };
              });
            }}
          />
        )}

        {/* ✅ PREVIEW NEW POTENTIAL SITES BEFORE CONFIRMATION (Blue Dashed) */}
        {showReplaceConfirm && pendingNewSites.length > 0 && (
          <GeoJSON
            key="preview-new-sites"
            data={{
              type: "FeatureCollection",
              features: pendingNewSites.map((f: any) => ({
                type: "Feature",
                geometry: f.geometry,
                properties: f.properties,
              })),
            }}
            style={() => ({
              color: "#3B82F6", // Blue for preview
              weight: 2,
              fillColor: "#93C5FD",
              fillOpacity: 0.4,
              dashArray: "5, 5",
            })}
          />
        )}

        {reforestation_areas.length > 0 &&
          reforestation_areas.map((area) => {
            if (!area.coordinate || area.coordinate.length !== 2) return null;
            const lat = Number(area.coordinate[0]);
            const lng = Number(area.coordinate[1]);
            if (isNaN(lat) || isNaN(lng)) return null;
            return (
              <Marker
                key={area.reforestation_area_id}
                position={[lat, lng]}
                icon={createMarkerIcon("reforestation", area.name)}
              >
                <Popup>
                  <div className="min-w-[200px]">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-8 flex items-center justify-center flex-shrink-0">
                        <svg width="20" height="24" viewBox="0 0 24 30">
                          <path
                            d="M12 0C5.373 0 0 5.373 0 12C0 18.627 12 30 12 30C12 30 24 18.627 24 12C24 5.373 18.627 0 12 0Z"
                            fill="#3B82F6"
                            stroke="white"
                            strokeWidth="2"
                          />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-gray-900">
                          {area.name}
                        </h3>
                        {area.barangay && (
                          <p className="text-xs text-gray-500 flex items-center gap-1">
                            <MapPin size={10} /> {area.barangay.name}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        const areaSites = sites.filter(
                          (s) =>
                            s.reforestation_area_id ===
                            area.reforestation_area_id,
                        );
                        if (areaSites.length > 0) {
                          setShowSites(true);
                          const validCoords = areaSites
                            .filter(
                              (s) =>
                                s.center_coordinate &&
                                s.center_coordinate.length === 2,
                            )
                            .map((s) =>
                              L.latLng(
                                s.center_coordinate![0],
                                s.center_coordinate![1],
                              ),
                            );
                          if (validCoords.length > 0) {
                            const bounds = L.latLngBounds(validCoords);
                            mapRef.current?.fitBounds(bounds, {
                              padding: [50, 50],
                              maxZoom: 17,
                            });
                          }
                          setPSAlert({
                            type: "success",
                            title: "Sites Loaded",
                            message: `Showing ${areaSites.length} site(s).`,
                          });
                        } else {
                          setPSAlert({
                            type: "failed",
                            title: "No Sites",
                            message: `No sites found.`,
                          });
                        }
                      }}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Target size={12} /> Show Sites
                    </button>
                  </div>
                </Popup>
              </Marker>
            );
          })}

        {showSites &&
          sites.length > 0 &&
          sites.map((site) => {
            if (!site.center_coordinate || site.center_coordinate.length !== 2)
              return null;
            const lat = Number(site.center_coordinate[0]);
            const lng = Number(site.center_coordinate[1]);
            if (isNaN(lat) || isNaN(lng)) return null;
            return (
              <Marker
                key={site.site_id}
                position={[lat, lng]}
                icon={createMarkerIcon("site", site.name)}
                eventHandlers={{
                  click: () => {
                    setSelectedSiteId(site.site_id.toString());
                    setSelectedSiteName(site.name);
                    setIsSitePanelOpen(true);
                  },
                }}
              />
            );
          })}

        {barangays.length > 0 &&
          barangays.map((area) => {
            if (!area.coordinate || area.coordinate.length !== 2) return null;
            const lat = Number(area.coordinate[0]);
            const lng = Number(area.coordinate[1]);
            if (isNaN(lat) || isNaN(lng)) return null;
            return (
              <Marker
                key={area.barangay_id}
                position={[lat, lng]}
                icon={createMarkerIcon("barangay", area.name)}
              >
                <Popup>
                  <div className="text-sm flex flex-col gap-2 min-w-[200px]">
                    <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
                      <div className="w-3 h-3 rounded-full bg-yellow-500 flex-shrink-0"></div>
                      <strong className="text-[#0f4a2f] text-base flex-1">
                        {area.name}
                      </strong>
                    </div>
                    <button
                      onClick={() => setSelectedBarangayId(area.barangay_id)}
                      className="flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-700 text-white h-8 px-3 py-1.5 rounded text-[.75rem] font-semibold w-full transition-colors shadow-sm"
                    >
                      <AreaChart size={14} /> View Classified Areas
                    </button>
                    <button
                      onClick={() => {
                        const barangayHazards = hazard_areas.filter(
                          (h) => h.barangay_id === area.barangay_id,
                        );
                        if (barangayHazards.length > 0) {
                          setVisibleHazardBarangayId(area.barangay_id);
                          const allCoords: [number, number][] = [];
                          barangayHazards.forEach((h) => {
                            if (h.polygon && h.polygon.coordinates) {
                              h.polygon.coordinates.forEach((coord) =>
                                allCoords.push(coord),
                              );
                            }
                          });
                          if (allCoords.length > 0) {
                            const bounds = L.latLngBounds(
                              allCoords.map((c) => L.latLng(c[0], c[1])),
                            );
                            mapRef.current?.fitBounds(bounds, {
                              padding: [50, 50],
                              maxZoom: 16,
                            });
                          }
                          setPSAlert({
                            type: "success",
                            title: "Hazard Areas Loaded",
                            message: `Showing ${barangayHazards.length} hazard area(s).`,
                          });
                        } else {
                          setPSAlert({
                            type: "failed",
                            title: "No Hazard Areas",
                            message: `No hazard areas found.`,
                          });
                        }
                      }}
                      className="flex items-center justify-center gap-1.5 bg-yellow-500 hover:bg-yellow-600 text-white h-8 px-3 py-1.5 rounded text-[.75rem] font-semibold w-full transition-colors shadow-sm"
                    >
                      <AlertTriangle size={14} /> View Hazard Areas
                    </button>
                  </div>
                </Popup>
              </Marker>
            );
          })}

        {goHome && <MapController center={ORMOCCITY} />}
        {markerPosition && (
          <Marker
            position={markerPosition}
            icon={createMarkerIcon("reforestation", "New Area")}
          >
            <Popup>
              <div className="text-sm">
                <strong className="text-blue-700">
                  Reforestation Area Center
                </strong>
              </div>
            </Popup>
          </Marker>
        )}
        {siteMarkerPosition && (
          <Marker
            position={siteMarkerPosition}
            icon={createMarkerIcon("site", "New Site")}
          >
            <Popup>
              <div className="text-sm">
                <strong className="text-green-700">Site Center</strong>
              </div>
            </Popup>
          </Marker>
        )}
        {searchMarkerPosition && (
          <Marker
            position={searchMarkerPosition}
            icon={createMarkerIcon("temp", "Location")}
          >
            <Popup>Searched Location</Popup>
          </Marker>
        )}

        {/* ✅ RENDER SITE POLYGON */}
        {showSitePolygon && currentSitePolygon && (
          <GeoJSON
            key={`site-polygon-${activeShownSiteId}`}
            data={currentSitePolygon}
            style={{
              color: "#10B981",
              weight: 3,
              fillColor: "#BBF7D0",
              fillOpacity: 0.25,
            }}
            onEachFeature={(feature, layer) => {
              layer.bindPopup(
                `<div style="font-weight: bold; color: #10B981; font-size: 14px;">Site Polygon</div>`,
              );
            }}
          />
        )}

        {/* ✅ RENDER POTENTIAL SITES (No Re-analyze button here) */}
        {showPotentialSites && activePotentialSites.length > 0 && (
          <GeoJSON
            key={`potential-sites-${activeShownSiteId}`}
            data={{
              type: "FeatureCollection",
              features: activePotentialSites.map((p: any) => ({
                type: "Feature",
                geometry: p.polygon_coordinates,
                properties: p,
              })),
            }}
            style={() => ({
              color: "#dc2626",
              weight: 2,
              fillColor: "#fecaca",
              fillOpacity: 0.5,
              dashArray: "4, 4",
            })}
            onEachFeature={(feature, layer) => {
              const p = feature.properties;
              const popupContent = `
                <div style="min-width: 200px; font-family: system-ui;">
                  <h3 style="margin-bottom: 8px; font-weight: bold; color: #dc2626; font-size: 14px; border-bottom: 1px solid #eee; padding-bottom: 4px;">Potential Site</h3>
                  <div style="font-size: 12px; margin-bottom: 4px;"><strong>Area:</strong> ${p.area_hectares?.toFixed(2) || "N/A"} ha</div>
                  <div style="font-size: 12px; margin-bottom: 8px;"><strong>Avg NDVI:</strong> ${p.avg_ndvi?.toFixed(3) || "N/A"}</div>
                  <button onclick="window.handleViewTrend(${p.potential_sites_id})" style="width: 100%; margin-bottom: 6px; padding: 6px; background: #3B82F6; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 12px;">View NDVI Trend</button>
                  <button onclick="window.handleDeletePotentialSite(${p.potential_sites_id})" style="width: 100%; margin-bottom: 6px; padding: 6px; background: #EF4444; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 12px;">Delete Potential Site</button>
                </div>`;
              layer.bindPopup(popupContent);
            }}
          />
        )}

        <BarangayClassifiedAreas
          barangayId={selectedBarangayId}
          token={token}
          onClose={() => setSelectedBarangayId(null)}
          onStatusChange={() => {}}
        />
        {showMgbFlood && (
          <TileLayer
            url={MGB_FLOOD_TILE_URL}
            opacity={0.75}
            attribution="Flood Susceptibility &copy; MGB Philippines"
            maxZoom={19}
            maxNativeZoom={17}
          />
        )}
        {showMgbLandslide && (
          <TileLayer
            url={MGB_LANDSLIDE_TILE_URL}
            opacity={0.75}
            attribution="Landslide Susceptibility &copy; MGB Philippines"
            maxZoom={19}
            maxNativeZoom={17}
          />
        )}
        {showEil && (
          <WMSTileLayer
            url={PHIVOLCS_EIL_WMS_URL}
            layers="0"
            format="image/png"
            transparent={true}
            opacity={0.75}
            attribution="Earthquake-Induced Landslide &copy; PHIVOLCS"
            version="1.3.0"
            crs={L.CRS.EPSG4326}
            maxZoom={19}
            maxNativeZoom={17}
          />
        )}

        {visibleHazardBarangayId !== null &&
          hazard_areas
            .filter((h) => h.barangay_id === visibleHazardBarangayId)
            .map((hazard) => {
              if (!hazard.polygon || !hazard.polygon.coordinates) return null;
              const colors = getHazardColor(hazard.hazard_type);
              const barangay = barangays.find(
                (b) => b.barangay_id === hazard.barangay_id,
              );
              return (
                <Polygon
                  key={hazard.hazard_area_id}
                  positions={hazard.polygon.coordinates}
                  pathOptions={{
                    color: colors.stroke,
                    fillColor: colors.fill,
                    fillOpacity: 0.3,
                    weight: 2,
                  }}
                >
                  <Popup>
                    <div className="text-sm min-w-[200px]">
                      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-200">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: colors.fill }}
                        ></div>
                        <strong className="text-base text-gray-800 flex-1">
                          {hazard.name}
                        </strong>
                      </div>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-start gap-2">
                          <AlertTriangle
                            size={14}
                            className="text-gray-500 mt-0.5 flex-shrink-0"
                          />
                          <div>
                            <span className="text-gray-500">Type:</span>
                            <span
                              className="ml-1 font-semibold px-2 py-0.5 rounded text-white text-[10px]"
                              style={{ backgroundColor: colors.fill }}
                            >
                              {hazard.hazard_type}
                            </span>
                          </div>
                        </div>
                        {barangay && (
                          <div className="flex items-start gap-2">
                            <MapPin
                              size={14}
                              className="text-gray-500 mt-0.5 flex-shrink-0"
                            />
                            <div>
                              <span className="text-gray-500">Barangay:</span>
                              <span className="ml-1 font-medium text-gray-700">
                                {barangay.name}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          setVisibleHazardBarangayId(null);
                          setPSAlert({
                            type: "success",
                            title: "Hazards Hidden",
                            message: `Hazard areas hidden.`,
                          });
                        }}
                        className="mt-3 w-full flex items-center justify-center gap-1 bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-semibold py-1.5 px-2 rounded transition-colors"
                      >
                        <X size={12} /> Hide
                      </button>
                    </div>
                  </Popup>
                </Polygon>
              );
            })}
      </MapContainer>

      {selectedBarangayForAnalysis && (
        <BarangayHazardAnalysis
          isOpen={showBarangayAnalysis}
          onClose={() => {
            setShowBarangayAnalysis(false);
            setSelectedBarangayForAnalysis(null);
          }}
          barangayId={selectedBarangayForAnalysis.id}
          barangayName={selectedBarangayForAnalysis.name}
          token={token || ""}
        />
      )}
      <CanopyGuideModal
        isOpen={showCanopyGuide}
        onClose={() => setShowCanopyGuide(false)}
      />
      <PotentialSiteTrends
        isOpen={showSiteTrends}
        onClose={() => setShowSiteTrends(false)}
        siteGeometry={selectedSiteGeometry}
        siteId={selectedSiteId}
        siteName={selectedSiteName}
        token={token}
      />

      <SiteInfoPanel
        siteId={selectedSiteId ? parseInt(selectedSiteId) : null}
        token={token}
        isOpen={isSitePanelOpen}
        onClose={() => setIsSitePanelOpen(false)}
        onViewDetails={(siteId) => {
          setIsSitePanelOpen(false);
        }}
        onShowSiteInMap={handleShowSiteInMap}
        onShowPotentialSites={handleShowPotentialSites}
        onHideAll={handleHideAll}
        isShowingSite={
          showSitePolygon &&
          activeShownSiteId ===
            (selectedSiteId ? parseInt(selectedSiteId) : null)
        }
        isShowingPotentialSites={
          showPotentialSites &&
          activeShownSiteId ===
            (selectedSiteId ? parseInt(selectedSiteId) : null)
        }
        onViewTrend={handleViewTrend}
        onReanalyze={handleReanalyze}
      />
    </div>
  );
}
