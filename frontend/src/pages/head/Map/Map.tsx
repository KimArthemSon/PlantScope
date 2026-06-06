import {
  MapContainer,
  TileLayer,
  useMap,
  GeoJSON,
  Marker,
  Popup,
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
} from "lucide-react";

import PlantScopeAlert from "@/components/alert/PlantScopeAlert";
import { useUserRole } from "@/hooks/authorization";
import CanopyGuideModal from "./canopy_guide";
import BarangayClassifiedAreas from "./barangay_classified_area";
import PotentialSiteTrends from "./potentialSiteTrends";
import HazardAssessmentPanel from "./components/HazardAssessmentPanel";
import BarangayHazardAnalysis from "./components/BarangayHazardAnalysis";

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
export type SafetyType = "safe" | "slightly" | "moderate" | "danger";
export type Legality = "pending" | "legal" | "illegal";
export interface ReforestationArea {
  name: string;
  legality: Legality;
  safety: SafetyType;
  polygon_coordinate: { coordinates: [number, number][] } | null;
  coordinate: [number, number] | null;
  barangay: { barangay_id: number; name: string };
  description: string;
  area_img: File | string | null;
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

export default function Map() {
  const token = localStorage.getItem("token");
  let ORMOCCITY: [number, number] = [11.02, 124.61];
  const mapRef = useRef<L.Map | null>(null);
  const drawnLayerRef = useRef<any>(null);
  const [classified_areas, setClassified_areas] = useState<ClassifiedArea[]>([]);
  const [barangays, setBarangays] = useState<Barangays[]>([]);

  const [showCanopyGuide, setShowCanopyGuide] = useState(false);
  const [form, setForm] = useState({
    name: "",
    legality: "pending",
    safety: "moderate",
    polygon_coordinate: { coordinates: [] as number[][] },
    coordinate: null as number[] | null,
    barangay: { barangay_id: 0, name: "" },
    description: "",
    area_img: null as File | null,
  });
  const [reforestation_areas, setReforestation_areas] = useState<ReforestationArea[]>([]);
  const [markerPosition, setMarkerPosition] = useState<[number, number] | null>(null);

  const [showSiteTrends, setShowSiteTrends] = useState(false);
  const [selectedSiteGeometry, setSelectedSiteGeometry] = useState<any>(null);
  const [selectedSiteId, setSelectedSiteId] = useState<string>("");
  const [selectedSiteName, setSelectedSiteName] = useState<string>("");

  const [isUsingPotentialSites, setIsUsingPotentialSites] = useState(false);
  const [analyzedSitesForSave, setAnalyzedSitesForSave] = useState<any[]>([]);

  const [isSearchPanelOpen, setIsSearchPanelOpen] = useState(false);
  const [searchLat, setSearchLat] = useState("");
  const [searchLng, setSearchLng] = useState("");
  const [searchMarkerPosition, setSearchMarkerPosition] = useState<[number, number] | null>(null);
  const [areaSearchQuery, setAreaSearchQuery] = useState("");
  const [showAreaDropdown, setShowAreaDropdown] = useState(false);

  const [isPickingMarker, setIsPickingMarker] = useState(false);
  const [isNdviPenelOpen, setIsNdviPenelOpen] = useState(false);
  const [isFormPenelOpen, setIsFormPenelOpen] = useState(false);
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

  // ✅ OFFICIAL GOVERNMENT MAPS
  const [showMgbFlood, setShowMgbFlood] = useState(false);
  const [showMgbLandslide, setShowMgbLandslide] = useState(false);
  const [showEil, setShowEil] = useState(false);

  const MGB_FLOOD_TILE_URL = "https://controlmap.mgb.gov.ph/arcgis/rest/services/GeospatialDataInventory/GDI_Detailed_Flood_Susceptibility/MapServer/tile/{z}/{y}/{x}";
  const MGB_LANDSLIDE_TILE_URL = "https://controlmap.mgb.gov.ph/arcgis/rest/services/GeospatialDataInventory/GDI_Detailed_Rain_induced_Landslide_Susceptibility/MapServer/tile/{z}/{y}/{x}";
  const PHIVOLCS_EIL_WMS_URL = "https://gisweb.phivolcs.dost.gov.ph/arcgis/services/PHIVOLCSPublic/EarthquakeInducedLandslide/MapServer/WMSServer";

  // ✅ NASA FIRMS - FIRE MONITORING
  const [showFirms, setShowFirms] = useState(false);
  const [fireCount, setFireCount] = useState(0);
  const [firmsTimeRange, setFirmsTimeRange] = useState<"24hrs" | "48hrs" | "7days">("24hrs");
  const [firmsGeoJsonLayer, setFirmsGeoJsonLayer] = useState<any>(null);

  const [start, setStart] = useState("2023-01-01");
  const [end, setEnd] = useState("2023-12-31");
  const [goHome, setGoHome] = useState(false);
  const [PSalert, setPSAlert] = useState<{
    type: "success" | "failed" | "error";
    title: string;
    message: string;
  } | null>(null);
  const [selectedBarangayId, setSelectedBarangayId] = useState<number | null>(null);

  const [showBarangayAnalysis, setShowBarangayAnalysis] = useState(false);
  const [selectedBarangayForAnalysis, setSelectedBarangayForAnalysis] = useState<{
    id: number;
    name: string;
  } | null>(null);
 
  // Mouse coordinate tracking
const [mouseCoords, setMouseCoords] = useState<{ lat: number; lng: number } | null>(null);

  const greenIcon = new L.Icon({
    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
  });
  const yellowIcon = new L.Icon({
    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-yellow.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
  });
  const redIcon = new L.Icon({
    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
  });

  const { userRole } = useUserRole();

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
    (window as any).L = L;
    map.off("pm:create");
    map.on("pm:create", (e: any) => {
      if (drawnLayerRef.current) {
        map.removeLayer(drawnLayerRef.current);
        drawnLayerRef.current = null;
      }
      const layer = e.layer;
      drawnLayerRef.current = layer;
      layer.setStyle({ color: "#3b82f6", weight: 2, fill: false });
      layer.addTo(map);
      setDrawnGeometry(layer.toGeoJSON().geometry);
    });
    return () => {
      map.off("pm:create");
      if (drawnLayerRef.current) {
        map.removeLayer(drawnLayerRef.current);
        drawnLayerRef.current = null;
      }
    };
  }, [mapRef.current]);

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const handleClick = (e: L.LeafletMouseEvent) => {
      if (!isPickingMarker) return;
      const { lat, lng } = e.latlng;
      setMarkerPosition([lat, lng]);
      setForm({ ...form, coordinate: [lat, lng] });
      setIsPickingMarker(false);
    };
    map.on("click", handleClick);
    return () => {
      map.off("click", handleClick);
    };
  }, [isPickingMarker, form]);

  function startMarkerPlacement() {
    setIsPickingMarker(true);
  }

  const formatSitesForBackend = (sites: any[]) => {
    return sites.map((site) => {
      const geometry = site.geometry || site.polygon_coordinates;
      let coords = geometry?.coordinates;
      if (coords && coords[0] && typeof coords[0][0] === "number") {
        if (
          coords[0][0] >= -90 &&
          coords[0][0] <= 90 &&
          coords[0][1] >= -180 &&
          coords[0][1] <= 180
        ) {
          coords = coords.map((c: [number, number]) => [c[1], c[0]]);
        }
      }
      return {
        site_id: site.properties?.site_id || site.site_id || `SITE-${Date.now()}`,
        geometry: { type: "Polygon", coordinates: coords || [] },
        area_hectares: site.properties?.area_hectares || 0,
        avg_ndvi: site.properties?.avg_ndvi || 0,
        suitability_score: site.properties?.suitability_score || 0,
      };
    });
  };

  const saveAnalyzedSitesToArea = async (reforestationAreaId: number): Promise<boolean> => {
    if (analyzedSitesForSave.length === 0) return false;
    try {
      const formattedSites = formatSitesForBackend(analyzedSitesForSave);
      const response = await fetch("http://127.0.0.1:8000/api/potential-sites/bulk-create/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({
          reforestation_area_id: reforestationAreaId,
          sites: formattedSites,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to save sites");
      setPSAlert({
        type: "success",
        title: "Sites Saved",
        message: `Saved ${data.created_count || formattedSites.length} potential site(s)`,
      });
      setAnalyzedSitesForSave([]);
      return true;
    } catch (err: any) {
      setPSAlert({ type: "error", title: "Save Failed", message: err.message });
      return false;
    }
  };

  const renderNDVI = async () => {
    setIsNdviLoading(true);
    try {
      const res = await fetch(
        `http://127.0.0.1:8000/api/ndvi/?start=${start}&end=${end}`,
        { headers: { Authorization: "Bearer " + token } },
      );
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      if (data.tile_url) {
        setNdviTileUrl(data.tile_url);
        setShowNDVI(true);
        setShowCanopyGuide(true);
        setSuitablePolygons(null);
        setDrawnGeometry(null);
        setSiteStats({ total: 0, totalArea: 0, avgNDVI: 0 });
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
    if (!drawnGeometry) {
      setPSAlert({
        type: "failed",
        title: "No Area Drawn",
        message: "Please draw a rectangle first.",
      });
      return;
    }
    setIsProcessing(true);
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/suitable-sites/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({ start, end, geometry: drawnGeometry }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to analyze");
      if (data.success && data.features && data.features.length > 0) {
        setSuitablePolygons(data);
        setNdviTileUrl(null);
        setAnalyzedSitesForSave(data.features);
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
          message: `Found ${data.features.length} sites.`,
        });
      } else {
        setSuitablePolygons(null);
        setSiteStats({ total: 0, totalArea: 0, avgNDVI: 0 });
        setPSAlert({
          type: "failed",
          title: "No Sites Found",
          message: "Try adjusting the date range.",
        });
      }
    } catch (err: any) {
      setPSAlert({
        type: "error",
        title: "Analysis Failed",
        message: err.message,
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
    if (mapRef.current && drawnLayerRef.current) {
      mapRef.current.removeLayer(drawnLayerRef.current);
      drawnLayerRef.current = null;
    }
  };

  const startDrawing = () => {
    if (mapRef.current) {
      if (drawnLayerRef.current) {
        mapRef.current.removeLayer(drawnLayerRef.current);
        drawnLayerRef.current = null;
        setDrawnGeometry(null);
      }
      mapRef.current.pm.enableDraw("Rectangle", {
        snappable: false,
        cursorMarker: false,
        allowSelfIntersection: false,
      });
    }
  };

  useEffect(() => {
    get_classified_area();
    getBarangays();
    get_all_reforestation_areas();
  }, []);

  async function get_classified_area() {
    try {
      const res = await fetch(
        "http://127.0.0.1:8000/api/get_classified_areas/",
        { headers: { Authorization: "Bearer " + token } },
      );
      const data = await res.json();
      setClassified_areas(data.data);
    } catch (e) {}
  }

  async function getBarangays() {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/get_barangay_list/", {
        headers: { Authorization: "Bearer " + token },
      });
      const data = await res.json();
      setBarangays(data.data);
    } catch (error) {}
  }

  async function get_all_reforestation_areas() {
    try {
      const res = await fetch(
        "http://127.0.0.1:8000/api/get_all_reforestation_areas/",
        { headers: { Authorization: token ? `Bearer ${token}` : "" } },
      );
      const data = await res.json();
      setReforestation_areas(data.data);
    } catch (err) {}
  }

  function closeAll() {
    setIsNdviPenelOpen(false);
    setIsFormPenelOpen(false);
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

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form.name.trim() || form.barangay.barangay_id === 0) {
      setPSAlert({
        type: "failed",
        title: "Validation Error",
        message: "Name and Barangay required",
      });
      return;
    }
    try {
      const formData = new FormData();
      formData.append("name", form.name.trim());
      formData.append("description", form.description.trim());
      formData.append("barangay_id", String(form.barangay.barangay_id));
      formData.append("legality", form.legality);
      formData.append("safety", form.safety);
      if (form.coordinate)
        formData.append("coordinate", JSON.stringify(form.coordinate));
      if (form.polygon_coordinate?.coordinates?.length > 0)
        formData.append(
          "polygon_coordinate",
          JSON.stringify({
            type: "Polygon",
            coordinates: [form.polygon_coordinate.coordinates],
          }),
        );
      if (form.area_img) formData.append("area_img", form.area_img);

      const res = await fetch(
        "http://127.0.0.1:8000/api/create_reforestation_areas/",
        {
          method: "POST",
          headers: { Authorization: "Bearer " + token },
          body: formData,
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Create failed");
      setPSAlert({
        type: "success",
        title: "Success",
        message: "Area created!",
      });

      const newAreaId = data.data?.reforestation_area_id || data.reforestation_area_id;
      if (isUsingPotentialSites && analyzedSitesForSave.length > 0 && newAreaId)
        await saveAnalyzedSitesToArea(newAreaId);

      setForm({
        name: "",
        legality: "pending",
        safety: "moderate",
        polygon_coordinate: { coordinates: [] },
        coordinate: null,
        barangay: { barangay_id: 0, name: "" },
        description: "",
        area_img: null,
      });
      setAnalyzedSitesForSave([]);
      setIsFormPenelOpen(false);
      get_all_reforestation_areas();
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

  // ✅ NASA FIRMS - Fetch actual fire data and render on map
  const fetchFirmsData = async () => {
    if (!mapRef.current) return;

    try {
      const bounds = mapRef.current.getBounds();
      const bbox = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`;

      console.log("🔥 Fetching FIRMS data for bbox:", bbox);

      const response = await fetch("http://127.0.0.1:8000/api/firms-fire-data/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          bbox: bbox,
          time_range: firmsTimeRange,
        }),
      });

      const data = await response.json();
      console.log("🔥 FIRMS Response:", data);

      if (data.success) {
        setFireCount(data.fire_count);

        if (firmsGeoJsonLayer && mapRef.current) {
          mapRef.current.removeLayer(firmsGeoJsonLayer);
        }

        if (data.fires && data.fires.length > 0 && mapRef.current) {
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
              const confidence = feature.properties.confidence;
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
                  <strong style="color: #dc2626; font-size: 14px;">🔥 Fire Hotspot Detected</strong>
                  <hr style="margin: 6px 0; border-color: #ddd;"/>
                  <div style="margin: 4px 0;"><strong>📍 Location:</strong> ${p.latitude.toFixed(4)}, ${p.longitude.toFixed(4)}</div>
                  <div style="margin: 4px 0;"><strong>🌡️ Brightness:</strong> ${p.brightness ? p.brightness.toFixed(1) : "N/A"} K</div>
                  <div style="margin: 4px 0;"><strong>🔥 FRP:</strong> ${p.frp || "N/A"} GW</div>
                  <div style="margin: 4px 0;"><strong>📊 Confidence:</strong> ${confidenceLabel}</div>
                  <div style="margin: 4px 0;"><strong>📅 Date:</strong> ${p.acq_date || "N/A"}</div>
                  <div style="margin: 4px 0;"><strong>⏰ Time:</strong> ${p.acq_time || "N/A"}</div>
                  <div style="margin: 4px 0;"><strong>🛰️ Satellite:</strong> ${p.satellite} (${p.instrument})</div>
                  <hr style="margin: 6px 0; border-color: #ddd;"/>
                  <em style="color: #666; font-size: 10px;">Source: NASA FIRMS VIIRS</em>
                </div>
              `);
            },
          }).addTo(mapRef.current);

          setFirmsGeoJsonLayer(geoJsonLayer);

          setPSAlert({
            type: "success",
            title: "Fires Detected",
            message: `Found ${data.fires.length} active fire hotspot${data.fires.length > 1 ? "s" : ""}`,
          });
        } else {
          setPSAlert({
            type: "success",
            title: "All Clear",
            message: "No active fires detected in current view",
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
      console.error("FIRMS fetch error:", error);
      setFireCount(0);
      setPSAlert({
        type: "error",
        title: "FIRMS Error",
        message: "Failed to connect to fire data service",
      });
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
    } else {
      setTimeout(() => fetchFirmsData(), 500);
    }
  };

  const updateFirmsTimeRange = (range: "24hrs" | "48hrs" | "7days") => {
    setFirmsTimeRange(range);
    if (showFirms) {
      if (firmsGeoJsonLayer && mapRef.current) {
        mapRef.current.removeLayer(firmsGeoJsonLayer);
        setFirmsGeoJsonLayer(null);
      }
      setTimeout(() => fetchFirmsData(), 300);
    }
  };

  // Track mouse position on map
function MouseTracker({ onCoordsChange }: { onCoordsChange: (coords: { lat: number; lng: number } | null) => void }) {
  const map = useMap();
  
  useEffect(() => {
    const handleMouseMove = (e: L.LeafletMouseEvent) => {
      onCoordsChange({
        lat: e.latlng.lat,
        lng: e.latlng.lng
      });
    };
    
    const handleMouseOut = () => {
      onCoordsChange(null);
    };
    
    map.on('mousemove', handleMouseMove);
    map.on('mouseout', handleMouseOut);
    
    return () => {
      map.off('mousemove', handleMouseMove);
      map.off('mouseout', handleMouseOut);
    };
  }, [map, onCoordsChange]);
  
  return null;
}

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
      <strong>Lat:</strong> {mouseCoords?.lat.toFixed(6) || '0.000000'}
    </span>
    <span className="text-gray-600 ml-2">
      <strong>Lng:</strong> {mouseCoords?.lng.toFixed(6) || '0.000000'}
    </span>
  </div>
</div>

      {/* Search Reforestation Areas */}
      <div className="absolute top-4 left-4 z-[1001] w-[280px]">
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
              {reforestation_areas.filter(
                (area) =>
                  area.name.toLowerCase().includes(areaSearchQuery.toLowerCase()) ||
                  area.barangay.name.toLowerCase().includes(areaSearchQuery.toLowerCase()),
              ).length > 0 ? (
                reforestation_areas
                  .filter(
                    (area) =>
                      area.name.toLowerCase().includes(areaSearchQuery.toLowerCase()) ||
                      area.barangay.name.toLowerCase().includes(areaSearchQuery.toLowerCase()),
                  )
                  .map((area, idx) => {
                    const safetyColor: Record<string, string> = {
                      safe: "bg-green-100 text-green-700",
                      slightly: "bg-yellow-100 text-yellow-700",
                      moderate: "bg-orange-100 text-orange-700",
                      danger: "bg-red-100 text-red-700",
                    };
                    const safetyLabel: Record<string, string> = {
                      safe: "Low Risk",
                      slightly: "Slight Risk",
                      moderate: "Moderate",
                      danger: "High Risk",
                    };
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
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[.75rem] font-semibold text-[#0f4a2f] truncate">
                            {area.name}
                          </span>
                          <span
                            className={`text-[.6rem] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${safetyColor[area.safety] || "bg-gray-100 text-gray-600"}`}
                          >
                            {safetyLabel[area.safety] || area.safety}
                          </span>
                        </div>
                        <span className="text-[.68rem] text-gray-500 flex items-center gap-1">
                          <MapPin size={10} /> {area.barangay.name}
                        </span>
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
              <span>📍 Total Sites:</span>
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
          </div>
          <button
            onClick={clearAnalysis}
            className="mt-3 w-full text-xs bg-red-50 hover:bg-red-100 text-red-600 py-2 px-3 rounded border border-red-200 transition-colors"
          >
            Clear Results
          </button>
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
      <div className="absolute z-[1000] flex gap-1 bottom-2 border border-2 border-green-700 rounded rounded-2xl left-1/2 -translate-x-1/2 bg-white p-2 w-[40rem]">
        <button
          onClick={handleHome}
          className="flex items-center justify-center gap-2 bg-[#0f4a2fe0] hover:bg-[#0f4a2f] text-white h-10 px-3 py-2 rounded-lg text-[.7rem] cursor-pointer"
        >
          <House size={16} /> Home
        </button>

        {/* NDVI PANEL */}
        {userRole != "DataManager" && userRole != "CityENROHead" && (
          <div className="relative ml-auto">
            {isNdviPenelOpen && (
              <div className="absolute top-[-240px] w-[16rem] flex flex-col gap-2 p-2 bg-white border border-[#0f4a2fe0] rounded-md">
                <div className="text-center font-bold w-full p-1 bg-[#0f4a2fe0] rounded-md">
                  <h1 className="text-white">NDVI</h1>
                </div>
                <div>
                  <label className="text-[.7rem] text-gray-600">Start Date</label>
                  <input
                    type="date"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                    className="w-full text-[.7rem] mt-1 p-1 border rounded-md"
                  />
                </div>
                <div>
                  <label className="text-[.7rem] text-gray-600">End Date</label>
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

        {/* Create PANEL */}
        {userRole != "DataManager" && userRole != "CityENROHead" && (
          <div className="relative">
            <form
              onSubmit={onSubmit}
              className={`absolute ${isUsingPotentialSites && analyzedSitesForSave.length > 0 ? "top-[-650px]" : "top-[-530px]"} w-[14rem] flex flex-col gap-2 p-2 bg-white border border-[#0f4a2fe0] rounded-md ${isFormPenelOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
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
                  placeholder="Ex: RS_1"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full text-[.7rem] mt-1 p-1 border rounded-md focus:ring-2 focus:ring-green-500"
                  required
                />
              </div>
              <div>
                <label className="text-[.7rem] text-gray-600">Description</label>
                <input
                  type="text"
                  placeholder="Ex: Area"
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  className="w-full text-[.7rem] mt-1 p-1 border rounded-md focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="text-[.7rem] text-gray-600">Barangay:</label>
                <select
                  value={form.barangay.barangay_id || ""}
                  onChange={(e) => {
                    const selectedId = parseInt(e.target.value, 10);
                    const selectedBarangay = barangays.find(
                      (b) => b.barangay_id === selectedId,
                    );
                    setForm({
                      ...form,
                      barangay: {
                        barangay_id: selectedId,
                        name: selectedBarangay?.name || "",
                      },
                    });
                  }}
                  className="w-full text-[.7rem] mt-1 p-1 border rounded-md focus:ring-2 focus:ring-green-500"
                  required
                >
                  <option value="">-- Select Barangay --</option>
                  {barangays.map((b) => (
                    <option key={b.barangay_id} value={b.barangay_id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[.7rem] text-gray-600">
                  Coordinate (Lat, Lng)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={
                      form.coordinate
                        ? `${form.coordinate[0]}, ${form.coordinate[1]}`
                        : ""
                    }
                    onChange={(e) => {
                      const [lat, lng] = e.target.value.split(",").map(Number);
                      setForm({ ...form, coordinate: [lat, lng] });
                    }}
                    className="w-full text-[.7rem] mt-1 p-1 border rounded-md focus:ring-2 focus:ring-green-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={startMarkerPlacement}
                    className="flex items-center justify-center gap-1 bg-[#0f4a2fe0] hover:bg-[#0f4a2f] text-white h-8 px-2 py-1 rounded-full text-[.7rem] cursor-pointer"
                  >
                    <Pointer size={16} /> Marker
                  </button>
                </div>
              </div>
              <div>
                <label className="text-[.7rem] text-gray-600">Safety Level</label>
                <select
                  value={form.safety}
                  onChange={(e) =>
                    setForm({ ...form, safety: e.target.value as SafetyType })
                  }
                  className="w-full text-[.7rem] mt-1 p-1 border rounded-md focus:ring-2 focus:ring-green-500"
                >
                  <option value="safe">Low Risk</option>
                  <option value="slightly">Slightly Unsafe</option>
                  <option value="moderate">Moderate Risk</option>
                  <option value="danger">High Risk</option>
                </select>
              </div>
              <div>
                <label className="text-[.7rem] text-gray-600">Area Image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    setForm({ ...form, area_img: e.target.files?.[0] || null })
                  }
                  className="w-full text-[.7rem] mt-1 p-1 border rounded-md focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div className="border-t border-gray-200 pt-3 mt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isUsingPotentialSites}
                    onChange={(e) => {
                      setIsUsingPotentialSites(e.target.checked);
                      if (!e.target.checked) setAnalyzedSitesForSave([]);
                    }}
                    className="rounded border-gray-300 text-[#0f4a2f] focus:ring-[#0f4a2f]"
                  />
                  <span className="text-[.7rem] text-gray-700">
                    🔍 Use Potential Sites ({analyzedSitesForSave.length})
                  </span>
                </label>
              </div>

              <div className="flex flex-row gap-1 mt-2">
                <button
                  type="submit"
                  className="flex items-center justify-center gap-1 ml-auto bg-[#0f4a2fe0] hover:bg-[#0f4a2f] text-white h-8 px-2 py-1 rounded-lg text-[.7rem] cursor-pointer"
                >
                  <File size={16} /> Submit
                </button>
              </div>
            </form>
            <button
              onClick={() => {
                if (isFormPenelOpen) {
                  closeAll();
                } else {
                  closeAll();
                  setIsFormPenelOpen(!isFormPenelOpen);
                }
              }}
              className="flex items-center justify-center gap-2 bg-[#0f4a2fe0] hover:bg-[#0f4a2f] text-white h-10 px-3 py-2 rounded-lg text-[.7rem] cursor-pointer"
            >
              <Cross size={16} /> Create
            </button>
          </div>
        )}

        {/* Draw PANEL */}
        {userRole != "DataManager" && userRole != "CityENROHead" && (
          <div className="relative">
            <div
              className={`absolute top-[-255px] w-[14rem] flex flex-col gap-2 p-2 bg-white border border-[#0f4a2fe0] rounded-md ${isDrawPenelOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
            >
              <div className="text-center font-bold w-full p-1 bg-[#0f4a2fe0] rounded-md">
                <h2 className="text-white text-[.8rem]">Draw Tools</h2>
              </div>
              <button
                onClick={startDrawing}
                className="flex items-center justify-center gap-2 bg-[#0f4a2fe0] hover:bg-[#0f4a2f] text-white h-10 px-3 py-2 rounded-lg text-[.7rem]"
              >
                <Pen size={16} /> Draw
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
              <Pen size={16} /> Draw
            </button>
          </div>
        )}

        {/* Filter PANEL */}
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
        {userRole != "DataManager" && userRole != "CityENROHead" && (
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
        )}
      </div>

      <MapContainer
        center={ORMOCCITY}
        zoom={12}
        className="h-full w-full"
        style={{ minHeight: "100vh" }}
      >
        <MapInitializer setMapRef={(map) => (mapRef.current = map)} />

          {/* ✅ ADD THIS - Mouse coordinate tracker */}
      <MouseTracker onCoordsChange={setMouseCoords} />

        <TileLayer
          url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
          attribution="Map data &copy; Google"
        />

        {ndviTileUrl && showNDVI && (
          <TileLayer
            url={ndviTileUrl}
            opacity={0.7}
            attribution="NDVI &copy; GEE"
          />
        )}

        {/* Suitable Polygons */}
        {suitablePolygons && suitablePolygons.features && (
          <GeoJSON
            data={{
              type: suitablePolygons.type,
              features: suitablePolygons.features,
            }}
            style={{
              color: "#dc2626",
              weight: 2,
              fillColor: "#fecaca",
              fillOpacity: 0.6,
            }}
            onEachFeature={(feature, layer) => {
              const props = feature.properties;
              const popupContent = `<div style="font-size: 12px; min-width: 180px;"><strong style="color: #0f4a2f;">${props.site_id}</strong><div>📏 Area: ${props.area_hectares} ha</div><div>🌱 NDVI: ${props.avg_ndvi}</div><button id="view-trends-btn-${props.site_id}" style="margin-top:8px; width:100%; padding:4px; background:#0f4a2f; color:white; border:none; border-radius:4px; cursor:pointer;">📈 View Trends</button></div>`;
              layer.bindPopup(popupContent);
              layer.on("popupopen", () => {
                const btn = document.getElementById(
                  `view-trends-btn-${props.site_id}`,
                );
                if (btn)
                  btn.onclick = () => {
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
                key={area.name}
                position={[lat, lng]}
                icon={new L.Icon.Default()}
              >
                <Popup>
                  <div className="text-sm flex flex-col gap-1">
                    <strong>{area.name}</strong>
                    <span>{area.barangay.name}</span>
                  </div>
                </Popup>
              </Marker>
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
                  <div className="text-sm flex flex-col gap-2 min-w-[200px]">
                    <strong className="text-[#0f4a2f]">{area.name}</strong>
                    <button
                      onClick={() => setSelectedBarangayId(area.barangay_id)}
                      className="flex items-center justify-center gap-1 bg-[#0f4a2fe0] hover:bg-[#0f4a2f] text-white h-7 px-2 py-1 rounded text-[.7rem] w-fit"
                    >
                      <AreaChart size={14} /> View Areas
                    </button>
                    <button
                      onClick={() => {
                        setSelectedBarangayForAnalysis({
                          id: area.barangay_id,
                          name: area.name,
                        });
                        setShowBarangayAnalysis(true);
                      }}
                      className="flex items-center justify-center gap-1 bg-red-600 hover:bg-red-700 text-white h-7 px-2 py-1 rounded text-[.7rem] w-fit"
                    >
                      <AlertTriangle size={14} /> Analyze Hazards
                    </button>
                  </div>
                </Popup>
              </Marker>
            );
          })}

        {goHome && <MapController center={ORMOCCITY} />}
        {markerPosition && (
          <Marker position={markerPosition} icon={greenIcon}>
            <Popup>Selected</Popup>
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

        {/* ✅ MGB OFFICIAL FLOOD MAP LAYER */}
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

        {/* ✅ MGB OFFICIAL LANDSLIDE MAP LAYER */}
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

        {/* ✅ PHIVOLCS EARTHQUAKE-INDUCED LANDSLIDE MAP */}
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
      </MapContainer>

      {/* Barangay Hazard Analysis Modal */}
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
    </div>
  );
}