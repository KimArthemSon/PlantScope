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
import { useState, useEffect, useRef, useCallback } from "react";
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

// 📍 Mapbox Token
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

// ✅ NEW: Site Interface
export interface Site {
  site_id: number;
  name: string;
  reforestation_area_id: number;
  center_coordinate: [number, number] | null;
  polygon_coordinates?: any;
  status: string;
  total_area_hectares?: number; // ✅ ADDED
  ndvi_value?: number; // ✅ ADDED
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
  polygon: {
    type: string;
    coordinates: [number, number][];
  };
  description: string;
  created_at: string;
}

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
      LANDSLIDE: { stroke: "#dc2626", fill: "#ef4444" }, // Red
      FLOOD: { stroke: "#2563eb", fill: "#3b82f6" }, // Blue
      EARTHQUAKE: { stroke: "#7c3aed", fill: "#8b5cf6" }, // Purple
      VOLCANIC: { stroke: "#ea580c", fill: "#f97316" }, // Orange
      STORM_SURGE: { stroke: "#0891b2", fill: "#06b6d4" }, // Cyan
      LIQUEFACTION: { stroke: "#ca8a04", fill: "#eab308" }, // Yellow
      COASTAL_EROSION: { stroke: "#0d9488", fill: "#14b8a6" }, // Teal
      OTHER: { stroke: "#6b7280", fill: "#9ca3af" }, // Gray
    };
    return colors[hazardType] || colors.OTHER;
  };

  const getHazardLabel = (hazardType: string) => {
    const labels: { [key: string]: string } = {
      LANDSLIDE: "Landslide",
      FLOOD: "Flood",
      EARTHQUAKE: "Earthquake",
      VOLCANIC: "Volcanic Hazard",
      STORM_SURGE: "Storm Surge",
      LIQUEFACTION: "Soil Liquefaction",
      COASTAL_EROSION: "Coastal Erosion",
      OTHER: "Other",
    };
    return labels[hazardType] || hazardType;
  };

  const [areaForm, setAreaForm] = useState({
    name: "",
    description: "",
    barangay_id: 0,
    coordinate: null as [number, number] | null,
  });

  // ✅ UPDATED: Official Site Form State (uses marker instead of polygon)
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

  // ✅ NEW: Sites state
  const [sites, setSites] = useState<Site[]>([]);

  const [markerPosition, setMarkerPosition] = useState<[number, number] | null>(
    null,
  );

  // ✅ NEW: Site marker position
  const [siteMarkerPosition, setSiteMarkerPosition] = useState<
    [number, number] | null
  >(null);

  const [showSiteTrends, setShowSiteTrends] = useState(false);
  const [selectedSiteGeometry, setSelectedSiteGeometry] = useState<any>(null);
  const [selectedSiteId, setSelectedSiteId] = useState<string>("");
  const [selectedSiteName, setSelectedSiteName] = useState<string>("");

  const [isSearchPanelOpen, setIsSearchPanelOpen] = useState(false);
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

  const [isSitePanelOpen, setIsSitePanelOpen] = useState(false);
  const navigate = useNavigate();

  // ✅ NEW: Site marker placement
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

  // ✅ Helper function to format date to YYYY-MM-DD
  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // ✅ Calculate today and exactly 5 months ago
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
    useState<{
      id: number;
      name: string;
    } | null>(null);

  const [mouseCoords, setMouseCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  const greenIcon = new L.Icon({
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
  });
  const yellowIcon = new L.Icon({
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-yellow.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
  });
  const redIcon = new L.Icon({
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
  });

  // ✅ NEW: Blue icon for sites
  const blueIcon = new L.Icon({
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
  });

  const { userRole } = useUserRole();

  // Add these new state variables
  const [firmsStartDate, setFirmsStartDate] = useState<string>(() => {
    const today = new Date();
    return formatDate(today);
  });
  const [firmsEndDate, setFirmsEndDate] = useState<string>(() => {
    const today = new Date();
    return formatDate(today);
  });
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

  async function get_hazard_areas() {
    try {
      const res = await fetch(api + "api/get_hazard_areas/", {
        headers: { Authorization: "Bearer " + token },
      });
      const data = await res.json();
      if (res.ok && data.data) {
        setHazard_areas(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch hazard areas:", error);
    }
  }

  // ✅ FIXED: Map Drawing Events - More robust implementation
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    // ✅ Ensure Geoman is ready
    if (!map.pm) {
      console.error("❌ Leaflet-Geoman not initialized");
      return;
    }

    // Remove any existing listeners first
    map.off("pm:create");

    const handleCreate = (e: any) => {
      console.log("📐 pm:create event fired!");
      console.log("Event object:", e);

      const layer = e.layer;

      if (!layer) {
        console.error("❌ No layer in event");
        return;
      }

      console.log("✏️ Capturing analysis rectangle");
      console.log("Layer type:", layer.constructor.name);

      // Remove old layer if exists
      if (drawnLayerRef.current) {
        try {
          map.removeLayer(drawnLayerRef.current);
        } catch (err) {
          console.warn("Could not remove old layer:", err);
        }
      }

      drawnLayerRef.current = layer;

      // Style the rectangle
      layer.setStyle({
        color: "#3b82f6",
        weight: 2,
        fill: false,
      });

      // ✅ Add to map if not already added
      if (!map.hasLayer(layer)) {
        layer.addTo(map);
      }

      // ✅ Extract geometry with better error handling
      try {
        // Wait a tick to ensure layer is fully initialized
        setTimeout(() => {
          try {
            const geoJson = layer.toGeoJSON();
            console.log("✅ GeoJSON extracted:", geoJson);

            if (geoJson && geoJson.geometry) {
              console.log("✅ Setting drawnGeometry:", geoJson.geometry);
              setDrawnGeometry(geoJson.geometry);

              // ✅ Verify it was set
              setTimeout(() => {
                console.log("🔍 Verifying drawnGeometry state...");
              }, 100);
            } else {
              console.error("❌ GeoJSON has no geometry:", geoJson);
            }
          } catch (innerErr) {
            console.error(
              "❌ Error in setTimeout GeoJSON extraction:",
              innerErr,
            );
          }
        }, 50);
      } catch (err) {
        console.error("❌ Error getting analysis GeoJSON:", err);
        console.error("Layer object:", layer);
      }
    };

    // ✅ Attach the listener
    map.on("pm:create", handleCreate);
    console.log("✅ pm:create listener attached to map");

    // ✅ Also listen to pm:edit and pm:cut in case user modifies the shape
    map.on("pm:edit", (e: any) => {
      console.log("✏️ pm:edit event - updating geometry");
      const layer = e.layer;
      if (layer === drawnLayerRef.current) {
        try {
          const geoJson = layer.toGeoJSON();
          if (geoJson && geoJson.geometry) {
            setDrawnGeometry(geoJson.geometry);
          }
        } catch (err) {
          console.error("❌ Error updating geometry on edit:", err);
        }
      }
    });

    return () => {
      console.log("🧹 Cleaning up drawing listeners");
      map.off("pm:create", handleCreate);
      map.off("pm:edit");
    };
  }, []); // Empty dependency array - attach once on mount

  // ✅ UPDATED: Map click handler for area marker, site marker
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
    return () => {
      map.off("click", handleClick);
    };
  }, [isPickingMarker, isPickingSiteMarker, areaForm, siteForm]);

  function startMarkerPlacement() {
    setIsPickingMarker(true);
    setPSAlert({
      type: "success",
      title: "Pick Location",
      message: "Click on the map to place the area center marker.",
    });
  }

  function startSiteMarkerPlacement() {
    setIsPickingSiteMarker(true);
    setPSAlert({
      type: "success",
      title: "Pick Location",
      message: "Click on the map to place the site center marker.",
    });
  }

  const renderNDVI = async () => {
    setIsNdviLoading(true);
    try {
      const res = await fetch(api + `api/ndvi/?start=${start}&end=${end}`, {
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
    console.log("🔍 Analyzing area...");
    console.log("drawnGeometry:", drawnGeometry);
    console.log("drawnLayerRef.current:", drawnLayerRef.current);

    // ✅ Get geometry from state or ref
    let geometryToUse = drawnGeometry;

    // Fallback 1: Get from layer ref
    if (!geometryToUse && drawnLayerRef.current) {
      console.log("⚠️ drawnGeometry is null, trying to get from layer ref...");
      try {
        const geoJson = drawnLayerRef.current.toGeoJSON();
        if (geoJson && geoJson.geometry) {
          geometryToUse = geoJson.geometry;
          console.log("✅ Got geometry from layer ref");
          // Update state for next time
          setDrawnGeometry(geometryToUse);
        }
      } catch (err) {
        console.error("❌ Failed to get geometry from layer ref:", err);
      }
    }

    // Fallback 2: Search map for rectangle layers
    if (!geometryToUse && mapRef.current) {
      console.log("⚠️ Still no geometry, searching map for rectangles...");
      mapRef.current.eachLayer((layer: any) => {
        if (!geometryToUse) {
          // Check if it's a rectangle or polygon (but not other layers)
          if (
            layer instanceof L.Rectangle ||
            (layer instanceof L.Polygon && layer !== drawnLayerRef.current)
          ) {
            try {
              const geoJson = layer.toGeoJSON();
              if (geoJson && geoJson.geometry) {
                geometryToUse = geoJson.geometry;
                console.log("✅ Found geometry from map layer");
                drawnLayerRef.current = layer;
                setDrawnGeometry(geometryToUse);
              }
            } catch (err) {
              console.error("❌ Failed to get geometry from found layer:", err);
            }
          }
        }
      });
    }

    if (!geometryToUse) {
      console.error("❌ No geometry found from any source");
      setPSAlert({
        type: "failed",
        title: "No Area Drawn",
        message:
          "Please click 'Draw Analysis Area' button first, then click and drag on the map to draw a rectangle.",
      });
      return;
    }

    console.log("✅ Using geometry for analysis:", geometryToUse);
    setIsProcessing(true);

    try {
      console.log("📡 Sending analysis request to backend...");

      const res = await fetch(api + `api/suitable-sites/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({ start, end, geometry: geometryToUse }),
      });

      const data = await res.json();
      console.log("📊 Analysis response:", data);

      if (!res.ok) throw new Error(data.error || "Failed to analyze");

      if (data.success && data.features && data.features.length > 0) {
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
        setSuitablePolygons(null);
        setSiteStats({ total: 0, totalArea: 0, avgNDVI: 0 });
        setPSAlert({
          type: "failed",
          title: "No Sites Found",
          message:
            "No suitable sites found. Try adjusting the date range or drawing a different area.",
        });
      }
    } catch (err: any) {
      console.error("❌ Analysis error:", err);
      setPSAlert({
        type: "error",
        title: "Analysis Failed",
        message: err.message || "Failed to analyze area",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const cancelDrawing = () => {
    if (mapRef.current && drawnLayerRef.current) {
      mapRef.current.removeLayer(drawnLayerRef.current);
      drawnLayerRef.current = null;
    }
    setDrawnGeometry(null);
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
    if (mapRef.current && drawnLayerRef.current) {
      mapRef.current.removeLayer(drawnLayerRef.current);
      drawnLayerRef.current = null;
    }
  };

  const startDrawingAnalysis = () => {
    if (!mapRef.current) {
      console.error("❌ Map not initialized");
      setPSAlert({
        type: "error",
        title: "Map Error",
        message: "Map not ready. Please refresh the page.",
      });
      return;
    }

    console.log("📐 Starting analysis drawing mode");

    // Clean up any existing drawings
    if (drawnLayerRef.current) {
      console.log("🗑️ Removing existing drawing");
      mapRef.current.removeLayer(drawnLayerRef.current);
      drawnLayerRef.current = null;
    }
    setDrawnGeometry(null);

    // ✅ Ensure Geoman is available
    if (!mapRef.current.pm) {
      console.error("❌ Leaflet-Geoman not available");
      setPSAlert({
        type: "error",
        title: "Drawing Error",
        message: "Drawing tools not available. Please refresh the page.",
      });
      return;
    }

    // ✅ Disable any active drawing first
    mapRef.current.pm.disableDraw();

    // ✅ Small delay to ensure disable completes
    setTimeout(() => {
      if (mapRef.current && mapRef.current.pm) {
        try {
          console.log("🎨 Enabling Rectangle drawing...");
          mapRef.current.pm.enableDraw("Rectangle", {
            snappable: false,
            cursorMarker: true,
            allowSelfIntersection: false,
            templineStyle: {
              color: "#3b82f6",
              dashArray: "5,5",
              weight: 2,
            },
            hintlineStyle: {
              color: "#3b82f6",
              dashArray: "5,5",
              weight: 2,
            },
            pathOptions: {
              color: "#3b82f6",
              fillColor: "#3b82f6",
              fillOpacity: 0.1,
              weight: 2,
            },
          });

          console.log("✅ Rectangle drawing enabled successfully");

          setPSAlert({
            type: "success",
            title: "Draw Mode Active",
            message:
              "Click and drag on the map to draw a rectangle, then click Analyze.",
          });
        } catch (err) {
          console.error("❌ Error enabling draw:", err);
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
    get_hazard_areas(); // ✅ NEW: Fetch hazard areas
  }, []);

  async function get_classified_area() {
    try {
      const res = await fetch(api + "api/get_classified_areas/", {
        headers: { Authorization: "Bearer " + token },
      });
      const data = await res.json();
      setClassified_areas(data.data);
    } catch (e) {}
  }

  async function getBarangays() {
    try {
      const res = await fetch(api + "api/get_barangay_list/", {
        headers: { Authorization: "Bearer " + token },
      });
      const data = await res.json();
      setBarangays(data.data);
    } catch (error) {}
  }

  async function get_all_reforestation_areas() {
    try {
      const res = await fetch(api + "api/get_all_reforestation_areas/", {
        headers: { Authorization: token ? `Bearer ${token}` : "" },
      });
      const data = await res.json();
      setReforestation_areas(data.data);
    } catch (err) {}
  }

  // ✅ NEW: Fetch all sites
  async function get_all_sites() {
    try {
      const res = await fetch(api + "api/get_all_sites/", {
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
    setIsSearchPanelOpen(false);
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
    mapRef.current?.flyTo([lat, lng], 16);
  };

  async function onSubmitArea(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!areaForm.name.trim()) {
      setPSAlert({
        type: "failed",
        title: "Validation Error",
        message: "Name is required",
      });
      return;
    }
    if (!areaForm.barangay_id) {
      setPSAlert({
        type: "failed",
        title: "Validation Error",
        message: "Please select a barangay",
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

      const res = await fetch(api + "api/create_reforestation_areas/", {
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

  // ✅ UPDATED: Submit Site - uses center_coordinate
  async function onSubmitSite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!siteForm.name.trim() || !siteForm.reforestation_area_id) {
      setPSAlert({
        type: "failed",
        title: "Validation Error",
        message: "Name and Parent Area are required",
      });
      return;
    }
    if (!siteForm.center_coordinate) {
      setPSAlert({
        type: "failed",
        title: "Validation Error",
        message: "Please place a marker for the site center.",
      });
      return;
    }

    try {
      const payload = {
        name: siteForm.name.trim(),
        reforestation_area_id: siteForm.reforestation_area_id,
        center_coordinate: siteForm.center_coordinate,
        potential_site_ids: selectedPotentialSiteIds,
      };

      const res = await fetch(api + "api/sites/create_site/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Site creation failed");

      setPSAlert({
        type: "success",
        title: "Site Created",
        message: `Site "${siteForm.name}" created successfully!${selectedPotentialSiteIds.length > 0 ? ` ${selectedPotentialSiteIds.length} potential sites assigned.` : ""}`,
      });

      setSiteForm({
        reforestation_area_id: 0,
        name: "",
        center_coordinate: null,
      });
      setSiteMarkerPosition(null);
      setSelectedPotentialSiteIds([]);
      setIsSiteFormPenelOpen(false);
      get_all_sites(); // ✅ Refresh sites list
    } catch (error: any) {
      setPSAlert({ type: "error", title: "Error", message: error.message });
    }
  }

  const handleClassifiedAreasStatus = useCallback(
    (status: { loading: boolean; error: string | null; count: number }) => {
      if (status.error)
        setPSAlert({
          type: "error",
          title: "Load Failed",
          message: status.error,
        });
      else if (status.count > 0 && !status.loading)
        setPSAlert({
          type: "success",
          title: "Areas Loaded",
          message: `Showing ${status.count} area(s).`,
        });
    },
    [],
  );

  // Update fetchFirmsData function
  const fetchFirmsData = async (
    timeRange?: "today" | "24hrs" | "7days",
    startDate?: string,
    endDate?: string,
  ) => {
    if (!mapRef.current) {
      console.error("❌ Map reference not available");
      return;
    }

    const effectiveTimeRange = timeRange || firmsTimeRange;
    const useCustom = startDate && endDate;
    const payloadStartDate = useCustom ? startDate : firmsStartDate;
    const payloadEndDate = useCustom ? endDate : firmsEndDate;

    try {
      const bounds = mapRef.current.getBounds();
      const bbox = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`;

      const requestBody: any = {
        bbox: bbox,
        time_range: effectiveTimeRange,
      };

      // Add custom date range if using it
      if (useCustom || useCustomDateRange) {
        requestBody.start_date = payloadStartDate;
        requestBody.end_date = payloadEndDate;
      }

      const response = await fetch(api + "api/firms-fire-data/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

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
                radius: radius,
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
                <div><strong> Date:</strong> ${p.acq_date || "N/A"}</div>
                <div><strong>⏰ Time:</strong> ${p.acq_time || "N/A"}</div>
                <div><strong>🛰️ Satellite:</strong> ${p.satellite} (${p.instrument})</div>
              </div>
            `);
            },
          }).addTo(mapRef.current);

          setFirmsGeoJsonLayer(geoJsonLayer);

          const dateInfo =
            useCustom || useCustomDateRange
              ? `${payloadStartDate} to ${payloadEndDate}`
              : effectiveTimeRange;

          setPSAlert({
            type: "success",
            title: "Fires Detected",
            message: `Found ${data.fires.length} active fire hotspot${data.fires.length > 1 ? "s" : ""} (${dateInfo})`,
          });
        } else {
          const dateInfo =
            useCustom || useCustomDateRange
              ? `${payloadStartDate} to ${payloadEndDate}`
              : effectiveTimeRange;

          setPSAlert({
            type: "success",
            title: "All Clear",
            message: `No active fires detected in current view (${dateInfo})`,
          });
        }
      } else {
        setPSAlert({
          type: "error",
          title: "FIRMS Error",
          message: data.error || "Failed to fetch fire data",
        });
      }
    } catch (error) {
      setFireCount(0);
      setPSAlert({
        type: "error",
        title: "FIRMS Error",
        message:
          (error as Error).message || "Failed to connect to fire data service",
      });
    }
  };

  // Update toggleFirms function
  const toggleFirms = () => {
    const newState = !showFirms;
    setShowFirms(newState);

    if (!newState) {
      if (firmsGeoJsonLayer && mapRef.current) {
        mapRef.current.removeLayer(firmsGeoJsonLayer);
        setFirmsGeoJsonLayer(null);
      }
      setFireCount(0);
    } else {
      setTimeout(() => {
        if (useCustomDateRange) {
          fetchFirmsData(firmsTimeRange, firmsStartDate, firmsEndDate);
        } else {
          fetchFirmsData();
        }
      }, 500);
    }
  };

  // Update updateFirmsTimeRange function
  const updateFirmsTimeRange = (range: "today" | "24hrs" | "7days") => {
    setFirmsTimeRange(range);
    setUseCustomDateRange(false);
    if (showFirms) {
      if (firmsGeoJsonLayer && mapRef.current) {
        mapRef.current.removeLayer(firmsGeoJsonLayer);
        setFirmsGeoJsonLayer(null);
      }
      setTimeout(() => fetchFirmsData(range), 300);
    }
  };

  // Add new function for custom date range
  const applyCustomDateRange = () => {
    setUseCustomDateRange(true);
    if (showFirms) {
      if (firmsGeoJsonLayer && mapRef.current) {
        mapRef.current.removeLayer(firmsGeoJsonLayer);
        setFirmsGeoJsonLayer(null);
      }
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
      const handleMouseMove = (e: L.LeafletMouseEvent) => {
        onCoordsChange({
          lat: e.latlng.lat,
          lng: e.latlng.lng,
        });
      };

      const handleMouseOut = () => {
        onCoordsChange(null);
      };

      map.on("mousemove", handleMouseMove);
      map.on("mouseout", handleMouseOut);

      return () => {
        map.off("mousemove", handleMouseMove);
        map.off("mouseout", handleMouseOut);
      };
    }, [map, onCoordsChange]);

    return null;
  }

  useEffect(() => {
    if (mapRef.current && showFirms) {
      const bounds = mapRef.current.getBounds();
      const rectangle = L.rectangle(bounds, {
        color: "#ff0000",
        weight: 2,
        fill: false,
        dashArray: "5, 5",
      }).addTo(mapRef.current);

      setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.removeLayer(rectangle);
        }
      }, 5000);
    }
  }, [showFirms, firmsTimeRange]);

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

      {/* Mouse Coordinate Display */}
      <div className="absolute top-4 right-4 z-[1001] bg-white px-3 py-2 rounded-lg shadow-lg border border-gray-300 text-xs font-mono">
        <div className="flex items-center gap-2">
          <MapPin size={14} className="text-[#0f4a2f]" />
          <span className="text-gray-600">
            <strong>Lat:</strong> {mouseCoords?.lat.toFixed(6) || "0.000000"}
          </span>
          <span className="text-gray-600 ml-2">
            <strong>Lng:</strong> {mouseCoords?.lng.toFixed(6) || "0.000000"}
          </span>
        </div>
      </div>

      {/* Search Reforestation Areas */}
      <div className="absolute top-4 left-15 z-[1001] w-[280px]">
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
                  .map((area, idx) => {
                    return (
                      <button
                        key={idx}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          if (area.coordinate) {
                            const lat = Number(area.coordinate[0]);
                            const lng = Number(area.coordinate[1]);
                            if (!isNaN(lat) && !isNaN(lng))
                              mapRef.current?.flyTo([lat, lng], 16);
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
                    );
                  })
              ) : (
                <div className="px-3 py-3 text-[.75rem] text-gray-500 text-center">
                  No areas found
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Statistics Panel */}
      {suitablePolygons && siteStats.total > 0 && (
        <div className="absolute top-4 right-4 bg-white p-4 rounded-lg shadow-lg z-[1000] min-w-[250px]">
          <h3 className="font-bold text-sm mb-3 text-[#0f4a2f] border-b pb-2">
            📊 Analysis Results
          </h3>
          <div className="text-xs space-y-2">
            <div className="flex justify-between">
              <span>📍 Total Potential Sites:</span>
              <strong className="text-[#0f4a2f]">{siteStats.total}</strong>
            </div>
            <div className="flex justify-between">
              <span>📏 Total Area:</span>
              <strong className="text-[#0f4a2f]">
                {siteStats.totalArea.toFixed(2)} ha
              </strong>
            </div>
            <div className="flex justify-between">
              <span>🌱 Avg NDVI:</span>
              <strong className="text-[#0f4a2f]">
                {siteStats.avgNDVI.toFixed(3)}
              </strong>
            </div>
            <div className="flex justify-between pt-2 border-t mt-2">
              <span>✅ Selected for Site:</span>
              <strong className="text-green-600">
                {selectedPotentialSiteIds.length}
              </strong>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={clearAnalysis}
              className="flex-1 text-xs bg-red-50 hover:bg-red-100 text-red-600 py-2 px-3 rounded border border-red-200 transition-colors"
            >
              Clear
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

      {/* Bottom Control Panel */}
      <div className="absolute z-[1000] flex gap-1 bottom-2 border border-2 border-green-700 rounded rounded-2xl left-1/2 -translate-x-1/2 bg-white p-2 w-[55rem]">
        <button
          onClick={handleHome}
          className="flex items-center justify-center gap-2 bg-[#0f4a2fe0] hover:bg-[#0f4a2f] text-white h-10 px-3 py-2 rounded-lg text-[.7rem] cursor-pointer"
        >
          <House size={16} /> Home
        </button>
        <div className="flex gap-1 ml-auto">
          {/* NDVI PANEL */}
          {userRole != "DataManager" && userRole != "CityENROHead" && (
            <div className="relative ml-auto">
              {isNdviPenelOpen && (
                <div className="absolute top-[-240px] w-[16rem] flex flex-col gap-2 p-2 bg-white border border-[#0f4a2fe0] rounded-md">
                  <div className="text-center font-bold w-full p-1 bg-[#0f4a2fe0] rounded-md">
                    <h1 className="text-white">NDVI</h1>
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
                className="flex items-center justify-center gap-2 bg-[#0f4a2fe0] hover:bg-[#0f4a2f] text-white h-10 px-3 py-2 rounded-lg text-[.7rem]"
              >
                <Activity size={16} /> NDVI
              </button>
            </div>
          )}

          {/* Draw PANEL (For Analysis) */}
          {userRole != "DataManager" && userRole != "CityENROHead" && (
            <div className="relative">
              <div
                className={`absolute top-[-255px] w-[14rem] flex flex-col gap-2 p-2 bg-white border border-[#0f4a2fe0] rounded-md ${isDrawPenelOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
              >
                <div className="text-center font-bold w-full p-1 bg-[#0f4a2fe0] rounded-md">
                  <h2 className="text-white text-[.8rem]">Analysis Tools</h2>
                </div>
                <button
                  onClick={startDrawingAnalysis}
                  className="flex items-center justify-center gap-2 bg-[#0f4a2fe0] hover:bg-[#0f4a2f] text-white h-10 px-3 py-2 rounded-lg text-[.7rem]"
                >
                  <Pen size={16} /> Draw Analysis Area
                </button>
                <button
                  onClick={analyzeArea}
                  disabled={isProcessing}
                  className={`flex items-center justify-center gap-2 h-10 px-3 py-2 rounded-lg text-[.7rem] ${isProcessing ? "bg-gray-400" : "bg-[#0f4a2fe0] hover:bg-[#0f4a2f] text-white"}`}
                >
                  {isProcessing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>{" "}
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <CloudLightning size={16} /> Analyze
                    </>
                  )}
                </button>
                <button
                  onClick={cancelDrawing}
                  className="flex items-center justify-center gap-2 bg-[#0f4a2fe0] hover:bg-[#0f4a2f] text-white h-10 px-3 py-2 rounded-lg text-[.7rem]"
                >
                  <Cross size={16} /> Cancel
                </button>
                <button
                  onClick={clearAnalysis}
                  className="flex items-center justify-center gap-2 bg-[#0f4a2fe0] hover:bg-[#0f4a2f] text-white h-10 px-3 py-2 rounded-lg text-[.7rem]"
                >
                  <Trash size={16} /> Clear
                </button>
              </div>
              <button
                onClick={() => {
                  closeAll();
                  setIsDrawPenelOpen(!isDrawPenelOpen);
                }}
                className="flex items-center justify-center gap-2 bg-[#0f4a2fe0] hover:bg-[#0f4a2f] text-white h-10 px-3 py-2 rounded-lg text-[.7rem]"
              >
                <Pen size={16} /> Analyze
              </button>
            </div>
          )}

          <div className="relative">
            <div
              className={`absolute top-[-120px] w-[14rem] flex flex-col gap-2 p-2 bg-white border border-[#0f4a2fe0] rounded-md ${isFilterPenelOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
            >
              <div className="text-center font-bold w-full p-1 bg-[#0f4a2fe0] rounded-md">
                <h2 className="text-white text-[.8rem]">Filters</h2>
              </div>
              <select
                onChange={(e) => {
                  const id = parseInt(e.target.value, 10);
                  const b = barangays.find((x) => x.barangay_id === id);
                  if (b && mapRef.current)
                    mapRef.current.flyTo(b.coordinate as [number, number], 16);
                }}
                className="w-full text-[.7rem] mt-1 p-1 border rounded-md"
              >
                <option value={0}>--Select Baranagay--</option>
                {barangays.map((b) => (
                  <option key={b.barangay_id} value={b.barangay_id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={() => {
                closeAll();
                setIsFilterPenelOpen(!isFilterPenelOpen);
              }}
              className="flex items-center justify-center gap-2 bg-[#0f4a2fe0] hover:bg-[#0f4a2f] text-white h-10 px-3 py-2 rounded-lg text-[.7rem]"
            >
              <Filter size={16} /> Filter
            </button>
          </div>

          {/* Search Coordinate PANEL */}
          <div className="relative">
            <div
              className={`absolute top-[-230px] right-0 w-[16rem] flex flex-col gap-2 p-2 bg-white border border-[#0f4a2fe0] rounded-md ${isSearchPanelOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
            >
              <div className="text-center font-bold w-full p-1 bg-[#0f4a2fe0] rounded-md">
                <h2 className="text-white text-[.8rem]">Search</h2>
              </div>
              <div>
                <label className="text-[.7rem] text-gray-600">Latitude</label>
                <input
                  type="number"
                  value={searchLat}
                  onChange={(e) => setSearchLat(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && goToCoordinate()}
                  className="w-full text-[.7rem] mt-1 p-1 border rounded-md"
                />
              </div>
              <div>
                <label className="text-[.7rem] text-gray-600">Longitude</label>
                <input
                  type="number"
                  value={searchLng}
                  onChange={(e) => setSearchLng(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && goToCoordinate()}
                  className="w-full text-[.7rem] mt-1 p-1 border rounded-md"
                />
              </div>
              <button
                onClick={goToCoordinate}
                className="flex items-center justify-center gap-2 bg-[#0f4a2fe0] hover:bg-[#0f4a2f] text-white h-8 px-2 py-1 rounded-lg text-[.7rem] mt-1"
              >
                <MapPin size={14} /> Go
              </button>
            </div>
            <button
              onClick={() => {
                closeAll();
                setIsSearchPanelOpen(!isSearchPanelOpen);
              }}
              className="flex items-center justify-center gap-2 bg-[#0f4a2fe0] hover:bg-[#0f4a2f] text-white h-10 px-3 py-2 rounded-lg text-[.7rem]"
            >
              <MapPin size={16} /> Search
            </button>
          </div>

          {/* HAZARD PANEL */}

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
              // NEW PROPS
              firmsStartDate={firmsStartDate}
              setFirmsStartDate={setFirmsStartDate}
              firmsEndDate={firmsEndDate}
              setFirmsEndDate={setFirmsEndDate}
              useCustomDateRange={useCustomDateRange}
              setUseCustomDateRange={setUseCustomDateRange}
              onApplyCustomDateRange={applyCustomDateRange}
            />
            <button
              onClick={() => {
                closeAll();
                setIsHazardPanelOpen(!isHazardPanelOpen);
              }}
              className="flex items-center justify-center gap-2 bg-[#0f4a2fe0] hover:bg-[#0f4a2f] text-white h-10 px-3 py-2 rounded-lg text-[.7rem]"
            >
              <Shield size={16} /> Hazards
            </button>
          </div>

          {/* CREATE AREA PANEL */}
          {userRole != "DataManager" && userRole != "CityENROHead" && (
            <div className="relative">
              <form
                onSubmit={onSubmitArea}
                className={`absolute top-[-360px] w-[14rem] flex flex-col gap-2 p-2 bg-white border border-[#0f4a2fe0] rounded-md ${isAreaFormPenelOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
              >
                <div className="text-center font-bold w-full p-1 bg-[#0f4a2fe0] border border-[#0f4a2fe0] rounded-md">
                  <h2 className="text-white text-[.8rem]">
                    Create Reforestation Area
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
                    <File size={16} /> Submit Area
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
                className="flex items-center justify-center gap-2 bg-[#0f4a2fe0] hover:bg-[#0f4a2f] text-white h-10 px-3 py-2 rounded-lg text-[.7rem] cursor-pointer"
              >
                <Cross size={16} /> Create Area
              </button>
            </div>
          )}

          {/* ✅ CREATE SITE PANEL - Uses marker like Area form */}
          {userRole != "DataManager" && userRole != "CityENROHead" && (
            <div className="relative">
              <form
                onSubmit={onSubmitSite}
                className={`absolute ${
                  suitablePolygons?.features?.length
                    ? "top-[-400px]"
                    : "top-[-295px]"
                } w-[14rem] flex flex-col gap-2 p-2 bg-white border border-green-600 rounded-md shadow-xl transition-all duration-200 ${
                  isSiteFormPenelOpen
                    ? "opacity-100 pointer-events-auto"
                    : "opacity-0 pointer-events-none"
                }`}
              >
                <div className="text-center font-bold w-full p-1 bg-green-700 rounded-md">
                  <h2 className="text-white text-[.8rem]">
                    Create Official Site
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

                {/* ✅ OPTIONAL: Potential Sites Selection */}
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
                className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white h-10 px-3 py-2 rounded-lg text-[.7rem] cursor-pointer"
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

        {/* ✅ NEW: Mapbox Satellite Hybrid */}
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

        {/* Suitable Polygons (Clickable for Selection) */}
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

              const popupContent = `
                <div style="font-size: 12px; min-width: 180px;">
                  <strong style="color: ${isSelected ? "#16a34a" : "#dc2626"};">${props.site_id || "Potential Site"}</strong>
                  <div>📏 Area: ${props.area_hectares?.toFixed(2)} ha</div>
                  <div>🌱 NDVI: ${props.avg_ndvi?.toFixed(3)}</div>
                  <hr style="margin: 6px 0;"/>
                  <button id="select-site-btn-${props.potential_sites_id}" style="width:100%; padding:6px; background:${isSelected ? "#dc2626" : "#16a34a"}; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">
                    ${isSelected ? "❌ Deselect" : "✅ Select for Site"}
                  </button>
                  <button id="view-trends-btn-${props.site_id}" style="margin-top:4px; width:100%; padding:4px; background:#0f4a2f; color:white; border:none; border-radius:4px; cursor:pointer;">📈 View Trends</button>
                </div>
              `;
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

        {/* Reforestation Areas Markers */}
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
                icon={new L.Icon.Default()}
              >
                <Popup>
                  <div className="text-sm flex flex-col gap-1">
                    <strong>{area.name}</strong>
                    {area.description && (
                      <span className="text-xs text-gray-600">
                        {area.description}
                      </span>
                    )}
                    {area.barangay && (
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <MapPin size={10} /> {area.barangay.name}
                      </span>
                    )}
                    {/* ✅ UPDATED: Button to view and zoom to sites for this area */}

                    <button
                      onClick={() => {
                        const areaSites = sites.filter(
                          (s) =>
                            s.reforestation_area_id ===
                            area.reforestation_area_id,
                        );

                        if (areaSites.length > 0) {
                          // ✅ Create bounds to fit ALL sites in the view
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
                            // Fly to the bounds with some padding so all markers are visible
                            mapRef.current?.flyToBounds(bounds, {
                              padding: [50, 50],
                              maxZoom: 17,
                            });
                          }

                          setPSAlert({
                            type: "success",
                            title: "Sites Loaded",
                            message: `Showing ${areaSites.length} site(s) for ${area.name}. Click the blue markers to view status.`,
                          });
                        } else {
                          setPSAlert({
                            type: "failed",
                            title: "No Sites",
                            message: `No sites found in ${area.name}`,
                          });
                        }
                      }}
                      className="mt-1 text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded flex items-center gap-1 w-fit"
                    >
                      <Target size={12} /> View Sites
                    </button>
                  </div>
                </Popup>
              </Marker>
            );
          })}

        {sites.length > 0 &&
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
                icon={greenIcon}
                eventHandlers={{
                  click: () => {
                    setSelectedSiteId(site.site_id);
                    setIsSitePanelOpen(true);
                  },
                }}
              />
            );
          })}

        {/* Barangay Markers */}
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
                icon={yellowIcon}
              >
                <Popup>
                  <div className="text-sm flex flex-col gap-2 min-w-[220px]">
                    {/* Header */}
                    <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
                      <div className="w-3 h-3 rounded-full bg-yellow-500 flex-shrink-0"></div>
                      <strong className="text-[#0f4a2f] text-base flex-1">
                        {area.name}
                      </strong>
                    </div>

                    {/* View Classified Areas - RED (matches red polygons) */}
                    <button
                      onClick={() => setSelectedBarangayId(area.barangay_id)}
                      className="flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-700 text-white h-8 px-3 py-1.5 rounded text-[.75rem] font-semibold w-full transition-colors shadow-sm"
                    >
                      <AreaChart size={14} /> View Classified Areas
                    </button>

                    {/* View Hazard Areas - YELLOW (matches yellow polygons) */}
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
                              h.polygon.coordinates.forEach((coord) => {
                                allCoords.push(coord);
                              });
                            }
                          });

                          if (allCoords.length > 0) {
                            const bounds = L.latLngBounds(
                              allCoords.map((c) => L.latLng(c[0], c[1])),
                            );
                            mapRef.current?.flyToBounds(bounds, {
                              padding: [50, 50],
                              maxZoom: 16,
                            });
                          }

                          setPSAlert({
                            type: "success",
                            title: "Hazard Areas Loaded",
                            message: `Showing ${barangayHazards.length} hazard area(s) for ${area.name}. Click "Hide" on any polygon to close.`,
                          });
                        } else {
                          setPSAlert({
                            type: "failed",
                            title: "No Hazard Areas",
                            message: `No hazard areas found for ${area.name}.`,
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
          <Marker position={markerPosition} icon={greenIcon}>
            <Popup>Area Center</Popup>
          </Marker>
        )}
        {siteMarkerPosition && (
          <Marker position={siteMarkerPosition} icon={blueIcon}>
            <Popup>Site Center</Popup>
          </Marker>
        )}
        {searchMarkerPosition && (
          <Marker position={searchMarkerPosition} icon={redIcon}>
            <Popup>Searched Location</Popup>
          </Marker>
        )}

        <BarangayClassifiedAreas
          barangayId={selectedBarangayId}
          token={token}
          onClose={() => setSelectedBarangayId(null)}
          onStatusChange={handleClassifiedAreasStatus}
        />

        {showMgbFlood && (
          <TileLayer
            url={MGB_FLOOD_TILE_URL}
            opacity={0.75}
            attribution="Flood Susceptibility &copy; MGB Philippines"
            maxZoom={19}
            maxNativeZoom={17}
            errorTileUrl="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
          />
        )}

        {showMgbLandslide && (
          <TileLayer
            url={MGB_LANDSLIDE_TILE_URL}
            opacity={0.75}
            attribution="Landslide Susceptibility &copy; MGB Philippines"
            maxZoom={19}
            maxNativeZoom={17}
            errorTileUrl="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
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
                    <div className="text-sm min-w-[220px]">
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
                              {getHazardLabel(hazard.hazard_type)}
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

                        {hazard.description && (
                          <div className="flex items-start gap-2">
                            <Info
                              size={14}
                              className="text-gray-500 mt-0.5 flex-shrink-0"
                            />
                            <div className="flex-1">
                              <span className="text-gray-500">
                                Description:
                              </span>
                              <p className="mt-0.5 text-gray-600 text-[11px] leading-relaxed">
                                {hazard.description}
                              </p>
                            </div>
                          </div>
                        )}

                        <div className="flex items-start gap-2 pt-1 border-t border-gray-100 mt-2">
                          <span className="text-gray-400 text-[10px]">
                            Created:{" "}
                            {new Date(hazard.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      {/* ✅ HIDE BUTTON - YELLOW to match hazard polygons */}
                      <button
                        onClick={() => {
                          setVisibleHazardBarangayId(null);
                          setPSAlert({
                            type: "success",
                            title: "Hazards Hidden",
                            message: `Hazard areas for ${barangay?.name || "this barangay"} are now hidden.`,
                          });
                        }}
                        className="mt-3 w-full flex items-center justify-center gap-1 bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-semibold py-1.5 px-2 rounded transition-colors"
                      >
                        <X size={12} /> Hide Hazard Areas
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
        siteId={selectedSiteId}
        token={token}
        isOpen={isSitePanelOpen}
        onClose={() => setIsSitePanelOpen(false)}
        onViewDetails={(siteId) => {
          setIsSitePanelOpen(false);
          // Navigate to site information page - adjust route as needed
          navigate(`/areas/${id}/site/${siteId}`);
        }}
      />
    </div>
  );
}
