import {
  MapContainer,
  TileLayer,
  useMap,
  GeoJSON,
  Marker,
  Popup,
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
} from "lucide-react";
import PlantScopeAlert from "@/components/alert/PlantScopeAlert";
import { useUserRole } from "@/hooks/authorization";
import CanopyGuideModal from "./canopy_guide";
import BarangayClassifiedAreas from "./barangay_classified_area";
import PotentialSiteTrends from "./potentialSiteTrends";

// Fix Leaflet marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Helper component to capture map instance
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
  polygon_coordinate: {
    coordinates: [number, number][];
  } | null;
  coordinate: [number, number] | null;
  barangay: {
    barangay_id: number;
    name: string;
  };
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
  const [classified_areas, setClassified_areas] = useState<ClassifiedArea[]>(
    [],
  );
  const [barangays, setBarangays] = useState<Barangays[]>([]);

  // Canopy Guide State
  const [showCanopyGuide, setShowCanopyGuide] = useState(false);

  const [form, setForm] = useState({
    name: "",
    legality: "pending",
    safety: "moderate",
    polygon_coordinate: { coordinates: [] as number[][] },
    coordinate: null as number[] | null,
    barangay: {
      barangay_id: 0,
      name: "",
    },
    description: "",
    area_img: null as File | null,
  });

  const [reforestation_areas, setReforestation_areas] = useState<
    ReforestationArea[]
  >([]);
  const [markerPosition, setMarkerPosition] = useState<[number, number] | null>(
    null,
  );

  // ✅ Potential Site Trends Modal State
  const [showSiteTrends, setShowSiteTrends] = useState(false);
  const [selectedSiteGeometry, setSelectedSiteGeometry] = useState<any>(null);
  const [selectedSiteId, setSelectedSiteId] = useState<string>("");
  const [selectedSiteName, setSelectedSiteName] = useState<string>("");

  // ✅ Potential Sites Integration State
  const [isUsingPotentialSites, setIsUsingPotentialSites] = useState(false);
  const [analyzedSitesForSave, setAnalyzedSitesForSave] = useState<any[]>([]);

  const [isPickingMarker, setIsPickingMarker] = useState(false);
  const [isNdviPenelOpen, setIsNdviPenelOpen] = useState(false);
  const [isFormPenelOpen, setIsFormPenelOpen] = useState(false);
  const [isDrawPenelOpen, setIsDrawPenelOpen] = useState(false);
  const [isFilterPenelOpen, setIsFilterPenelOpen] = useState(false);

  // NDVI State
  const [ndviTileUrl, setNdviTileUrl] = useState<string | null>(null);
  const [showNDVI, setShowNDVI] = useState(true);
  const [isNdviLoading, setIsNdviLoading] = useState(false);

  // Analysis State
  const [suitablePolygons, setSuitablePolygons] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [drawnGeometry, setDrawnGeometry] = useState<any>(null);
  const [siteStats, setSiteStats] = useState<SiteStatistics>({
    total: 0,
    totalArea: 0,
    avgNDVI: 0,
  });

  // Shared date state
  const [start, setStart] = useState("2023-01-01");
  const [end, setEnd] = useState("2023-12-31");
  const [panelOpen, setPanelOpen] = useState(true);
  const [goHome, setGoHome] = useState(false);
  const [PSalert, setPSAlert] = useState<{
    type: "success" | "failed" | "error";
    title: string;
    message: string;
  } | null>(null);

  // State for tracking selected barangay's classified areas
  const [selectedBarangayId, setSelectedBarangayId] = useState<number | null>(
    null,
  );

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

  const { userRole, isLoading } = useUserRole();
  const [useruserRole, setUseruserRole] = useState("");

  useEffect(() => {
    if (userRole === "treeGrowers" || userRole === "CityENROHead") {
      setUseruserRole("");
      return;
    }
    if (userRole === "GISSpecialist") {
      setUseruserRole("GISS");
      return;
    }
    if (userRole === "DataManager") {
      setUseruserRole("DataManager");
      return;
    }
  }, [userRole]);

  // Auto-hide canopy guide when NDVI is hidden
  useEffect(() => {
    if (!showNDVI) {
      setShowCanopyGuide(false);
    }
  }, [showNDVI]);

  // Keyboard shortcut: Press 'G' to toggle guide
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "g" && showNDVI && !isNdviPenelOpen) {
        setShowCanopyGuide((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showNDVI, isNdviPenelOpen]);

  // Initialize Geoman drawing
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
      const geojson = layer.toGeoJSON();
      setDrawnGeometry(geojson.geometry);
    });

    return () => {
      map.off("pm:create");
      if (drawnLayerRef.current) {
        map.removeLayer(drawnLayerRef.current);
        drawnLayerRef.current = null;
      }
    };
  }, [mapRef.current]);

  // Marker placement click handler
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

  // ✅ ADD THIS HELPER: Format analyzed sites for backend API
  const formatSitesForBackend = (sites: any[]) => {
    return sites.map((site) => {
      // Ensure geometry is valid GeoJSON Polygon
      const geometry = site.geometry || site.polygon_coordinates;

      // Convert coordinates if needed: Leaflet [lat,lng] → GeoJSON [lng,lat]
      let coords = geometry?.coordinates;
      if (coords && coords[0] && typeof coords[0][0] === "number") {
        // Check if first coord looks like [lat, lng] (lat between -90 to 90)
        if (
          coords[0][0] >= -90 &&
          coords[0][0] <= 90 &&
          coords[0][1] >= -180 &&
          coords[0][1] <= 180
        ) {
          // Convert [lat, lng] → [lng, lat] for GeoJSON
          coords = coords.map((c: [number, number]) => [c[1], c[0]]);
        }
      }

      return {
        site_id:
          site.properties?.site_id ||
          site.site_id ||
          `SITE-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        geometry: {
          type: "Polygon",
          coordinates: coords || [],
        },
        area_hectares:
          site.properties?.area_hectares || site.area_hectares || 0,
        avg_ndvi: site.properties?.avg_ndvi || site.avg_ndvi || 0,
        suitability_score:
          site.properties?.suitability_score || site.suitability_score || 0,
      };
    });
  };

  const saveAnalyzedSitesToArea = async (
    reforestationAreaId: number,
  ): Promise<boolean> => {
    if (analyzedSitesForSave.length === 0) return false;

    try {
      const formattedSites = formatSitesForBackend(analyzedSitesForSave);

      const response = await fetch(
        "http://127.0.0.1:8000/api/potential-sites/bulk-create/",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: token ? `Bearer ${token}` : "",
          },
          body: JSON.stringify({
            reforestation_area_id: reforestationAreaId,
            sites: formattedSites,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || "Failed to save sites");
      }

      setPSAlert({
        type: "success",
        title: "Sites Saved",
        message: `Saved ${data.created_count || formattedSites.length} potential site(s)`,
      });

      setAnalyzedSitesForSave([]);
      return true;
    } catch (err: any) {
      console.error("Save error:", err);
      setPSAlert({
        type: "error",
        title: "Save Failed",
        message: err.message || "Error saving sites",
      });
      return false;
    }
  };

  // Render NDVI (city-wide)
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
          message:
            "Canopy guide opened. Close it to see the NDVI layer on the map.",
        });
      } else {
        throw new Error("No tile URL returned from API");
      }
    } catch (error: any) {
      console.error("NDVI Error:", error);
      setPSAlert({
        type: "error",
        title: "NDVI Loading Failed",
        message:
          error.message ||
          "Could not generate NDVI map. Check console for details.",
      });
      setShowCanopyGuide(false);
    } finally {
      setIsNdviLoading(false);
    }
  };

  // Analyze drawn area for suitable sites
  const analyzeArea = async () => {
    if (!drawnGeometry) {
      setPSAlert({
        type: "failed",
        title: "No Area Drawn",
        message: "Please draw a rectangle first before analyzing.",
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
        body: JSON.stringify({
          start,
          end,
          geometry: drawnGeometry,
          debug: false,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to analyze area");

      // Handle debug mode (development only)
      if (data.debug) {
        console.log("📊 NDVI Debug Data:", data);
        const histogram = data.histogram;
        let suitablePixels = 0;
        for (const [range, count] of Object.entries(histogram)) {
          const maxVal = parseFloat(range.split("-")[1]);
          if (maxVal < 0.41) suitablePixels += count as number;
        }
        setPSAlert({
          type: "success",
          title: "Debug Mode",
          message: `Found ${suitablePixels} suitable pixels. Check console for details.`,
        });
        return;
      }

      // Production mode: Display suitable sites
      if (data.success && data.features && data.features.length > 0) {
        setSuitablePolygons(data);
        setNdviTileUrl(null);

        // ✅ Capture sites for potential saving
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
          message: `Found ${data.features.length} potential reforestation sites covering ${totalArea.toFixed(2)} hectares.`,
        });
      } else {
        setSuitablePolygons(null);
        setSiteStats({ total: 0, totalArea: 0, avgNDVI: 0 });
        setPSAlert({
          type: "failed",
          title: "No Sites Found",
          message:
            "No suitable planting sites found in this area. Try adjusting the date range or drawing a different area.",
        });
      }
    } catch (err: any) {
      console.error("Analysis error:", err);
      setPSAlert({
        type: "error",
        title: "Analysis Failed",
        message: err.message || "Error analyzing area. Please try again.",
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

  // Fetch initial data
  useEffect(() => {
    get_classified_area();
    getBarangays();
  }, []);

  useEffect(() => {
    console.log(barangays);
  }, [barangays]);

  // Cleanup: Clear selected barangay when component unmounts
  useEffect(() => {
    return () => setSelectedBarangayId(null);
  }, []);

  async function get_classified_area() {
    try {
      const res = await fetch(
        "http://127.0.0.1:8000/api/get_classified_areas/",
        {
          headers: { Authorization: "Bearer " + token },
        },
      );
      const data = await res.json();
      setClassified_areas(data.data);
      if (!res.ok) return;
    } catch (e: any) {}
  }

  async function getBarangays() {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/get_barangay_list/", {
        headers: { Authorization: "Bearer " + token },
      });
      const data = await res.json();
      setBarangays(data.data);
      if (!res.ok) {
        alert(
          "Failed to create area: " +
            (data.detail || data.error || "Unknown error"),
        );
        return;
      }
    } catch (error) {
      console.error(error);
      alert("Error submitting form.");
    }
  }

  function closeAll() {
    setIsNdviPenelOpen(false);
    setIsFormPenelOpen(false);
    setIsDrawPenelOpen(false);
    setIsFilterPenelOpen(false);
  }

  // ✅ REPLACE onSubmit WITH THIS FIXED VERSION (only the relevant parts changed)
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    // Basic validation
    if (!form.name.trim() || form.barangay.barangay_id === 0) {
      setPSAlert({
        type: "failed",
        title: "Validation Error",
        message: "Name and Barangay are required",
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

      // ✅ FIX: Send coordinate as [lat, lng] array string
      if (form.coordinate) {
        formData.append("coordinate", JSON.stringify(form.coordinate));
      }

      // ✅ FIX: Send polygon_coordinate as proper GeoJSON object string
      if (form.polygon_coordinate?.coordinates?.length > 0) {
        const geojsonPoly = {
          type: "Polygon" as const,
          coordinates: [form.polygon_coordinate.coordinates], // Wrap in array for GeoJSON ring
        };
        formData.append("polygon_coordinate", JSON.stringify(geojsonPoly));
      }

      if (form.area_img) {
        formData.append("area_img", form.area_img);
      }

      const res = await fetch(
        "http://127.0.0.1:8000/api/create_reforestation_areas/",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer " + token,
            // ⚠️ Do NOT set Content-Type for FormData - browser sets it with boundary
          },
          body: formData,
        },
      );

      const data = await res.json();

      if (!res.ok) {
        setPSAlert({
          type: "error",
          title: "Create Failed",
          message: data.error || data.detail || "Unknown error",
        });
        return;
      }

      setPSAlert({
        type: "success",
        title: "Success",
        message: "Reforestation area created!",
      });

      // ✅ FIX: Save potential sites with proper ID extraction
      const newAreaId =
        data.data?.reforestation_area_id || data.reforestation_area_id;

      if (
        isUsingPotentialSites &&
        analyzedSitesForSave.length > 0 &&
        newAreaId
      ) {
        // Wait for sites to save, but don't block form completion
        saveAnalyzedSitesToArea(newAreaId).then((success) => {
          if (success) {
            setIsUsingPotentialSites(false);
          }
        });
      }

      // Reset form
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
      setAnalyzedSitesForSave([]); // Clear sites after submission
      setIsFormPenelOpen(false);
      get_all_reforestation_areas();
    } catch (error: any) {
      console.error("Form submission error:", error);
      setPSAlert({
        type: "error",
        title: "Submission Error",
        message: error.message || "Error submitting form",
      });
    }
  }

  async function get_all_reforestation_areas() {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        "http://127.0.0.1:8000/api/get_all_reforestation_areas/",
        {
          method: "GET",
          headers: { Authorization: token ? `Bearer ${token}` : "" },
        },
      );
      if (!res.ok) throw new Error("Failed to fetch reforestation areas");
      const data = await res.json();
      setReforestation_areas(data.data);
    } catch (err) {
      console.error(err);
      setPSAlert({
        type: "error",
        title: "Error",
        message: "Error fetching reforestation areas",
      });
    }
  }

  useEffect(() => {
    get_all_reforestation_areas();
  }, []);

  const handleClassifiedAreasStatus = useCallback(
    (status: { loading: boolean; error: string | null; count: number }) => {
      if (status.error) {
        setPSAlert({
          type: "error",
          title: "Load Failed",
          message: status.error,
        });
      } else if (status.count > 0 && !status.loading) {
        setPSAlert({
          type: "success",
          title: "Areas Loaded",
          message: `Showing ${status.count} classified area(s) for this barangay.`,
        });
      }
    },
    [],
  );

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
            <div className="flex justify-between">
              <span>🎯 Threshold:</span>
              <strong className="text-[#0f4a2f]">&lt; 0.41</strong>
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

      {/* NDVI Loading Overlay */}
      {isNdviLoading && (
        <div className="absolute inset-0 z-[1500] flex items-center justify-center bg-[#00000083] bg-opacity-10 pointer-events-none">
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
                <div className="text-center font-bold w-full p-1 bg-[#0f4a2fe0] border border-[#0f4a2fe0] rounded-md">
                  <h1 className="text-white [word-spacing:10px]">NDVI</h1>
                </div>
                <div>
                  <label className="text-[.7rem] text-gray-600">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                    className="w-full text-[.7rem] mt-1 p-1 border rounded-md focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="text-[.7rem] text-gray-600">End Date</label>
                  <input
                    type="date"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                    className="w-full text-[.7rem] mt-1 p-1 border rounded-md focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div className="flex flex-row gap-1 mt-2">
                  {showNDVI && (
                    <button
                      onClick={() => setShowCanopyGuide(!showCanopyGuide)}
                      className="flex items-center justify-center gap-1 bg-blue-600 hover:bg-blue-700 text-white h-8 px-2 py-1 rounded-lg text-[.7rem] cursor-pointer"
                      title="Toggle Guide (Press G)"
                    >
                      <Info size={14} /> {showCanopyGuide ? "Hide" : "Show"}{" "}
                      Guide
                    </button>
                  )}
                  <button
                    onClick={renderNDVI}
                    disabled={isNdviLoading}
                    className={`flex items-center justify-center gap-1 ml-auto h-8 px-2 py-1 rounded-lg text-[.7rem] cursor-pointer transition-colors ${
                      isNdviLoading
                        ? "bg-gray-400 cursor-not-allowed"
                        : "bg-[#0f4a2fe0] hover:bg-[#0f4a2f] text-white"
                    }`}
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
                    className="flex items-center justify-center gap-1 bg-[#0f4a2fe0] hover:bg-[#0f4a2f] text-white h-8 px-2 py-1 rounded-lg text-[.7rem] cursor-pointer"
                  >
                    <Eye size={16} /> {showNDVI ? "Hide" : "Show"}
                  </button>
                </div>
              </div>
            )}
            <button
              onClick={() => {
                if (isNdviPenelOpen) {
                  closeAll();
                } else {
                  closeAll();
                  setIsNdviPenelOpen(!isNdviPenelOpen);
                }
              }}
              className="flex items-center justify-center gap-2 bg-[#0f4a2fe0] hover:bg-[#0f4a2f] text-white h-10 px-3 py-2 rounded-lg text-[.7rem] cursor-pointer"
            >
              <Activity size={16} /> NDVI
            </button>
          </div>
        )}

        {/* Create PANEL - With Potential Sites Integration */}
        {userRole != "DataManager" && userRole != "CityENROHead" &&  (
          <div className="relative">
            <form
              onSubmit={onSubmit}
              className={`absolute ${
                isUsingPotentialSites && analyzedSitesForSave.length > 0
                  ? "top-[-580px]" // Extra height for "Save Sites" button
                  : "top-[-530px]" // Normal form height
              } w-[14rem] flex flex-col gap-2 p-2 bg-white border border-[#0f4a2fe0] rounded-md ${
                isFormPenelOpen
                  ? "opacity-100"
                  : "opacity-0 pointer-events-none"
              }`}
            >
              <div className="text-center font-bold w-full p-1 bg-[#0f4a2fe0] border border-[#0f4a2fe0] rounded-md">
                <h2 className="text-white text-[.8rem]">
                  Create Reforestation Area
                </h2>
              </div>

              {/* Name */}
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

              {/* Description */}
              <div>
                <label className="text-[.7rem] text-gray-600">
                  Description
                </label>
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

              {/* Barangay */}
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

              {/* Coordinate */}
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

              {/* Safety */}
              <div>
                <label className="text-[.7rem] text-gray-600">
                  Safety Level
                </label>
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

              {/* Area Image */}
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

              {/* ✅ Use Potential Sites Toggle */}
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
                    🔍 Use Potential Sites
                  </span>
                </label>
              </div>

              {/* ✅ Save Sites Button (shows when sites are analyzed) */}
              {isUsingPotentialSites && analyzedSitesForSave.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (!form.name || form.barangay.barangay_id === 0) {
                      setPSAlert({
                        type: "failed",
                        title: "Fill Form First",
                        message:
                          "Enter area name and select barangay before saving sites.",
                      });
                      return;
                    }
                    setPSAlert({
                      type: "success",
                      title: "Ready",
                      message: `${analyzedSitesForSave.length} sites will save when you submit.`,
                    });
                  }}
                  className="w-full flex items-center justify-center gap-1 bg-blue-600 hover:bg-blue-700 text-white h-7 px-2 py-1 rounded text-[.7rem]"
                >
                  <CloudLightning size={14} /> Save{" "}
                  {analyzedSitesForSave.length} Sites
                </button>
              )}

              {/* Submit Button */}
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
              className={`absolute top-[-255px] w-[14rem] flex flex-col gap-2 p-2 bg-white border border-[#0f4a2fe0] rounded-md ${
                isDrawPenelOpen
                  ? "opacity-100 pointer-events-auto"
                  : "opacity-0 pointer-events-none"
              }`}
            >
              <div className="text-center font-bold w-full p-1 bg-[#0f4a2fe0] border border-[#0f4a2fe0] rounded-md">
                <h2 className="text-white text-[.8rem]">Draw Tools</h2>
              </div>
              <button
                onClick={startDrawing}
                className="flex items-center justify-center gap-2 bg-[#0f4a2fe0] hover:bg-[#0f4a2f] text-white h-10 px-3 py-2 rounded-lg text-[.7rem] cursor-pointer"
              >
                <Pen size={16} /> Draw
              </button>
              <button
                onClick={analyzeArea}
                disabled={isProcessing}
                className={`flex items-center justify-center gap-2 h-10 px-3 py-2 rounded-lg text-[.7rem] cursor-pointer ${
                  isProcessing
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-[#0f4a2fe0] hover:bg-[#0f4a2f] text-white"
                }`}
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
                className="flex items-center justify-center gap-2 bg-[#0f4a2fe0] hover:bg-[#0f4a2f] text-white h-10 px-3 py-2 rounded-lg text-[.7rem] cursor-pointer"
              >
                <Cross size={16} /> Cancel
              </button>
              <button
                onClick={clearAnalysis}
                className="flex items-center justify-center gap-2 bg-[#0f4a2fe0] hover:bg-[#0f4a2f] text-white h-10 px-3 py-2 rounded-lg text-[.7rem] cursor-pointer"
              >
                <Trash size={16} /> Clear
              </button>
            </div>
            <button
              onClick={() => {
                if (isDrawPenelOpen) {
                  closeAll();
                } else {
                  closeAll();
                  setIsDrawPenelOpen(!isDrawPenelOpen);
                }
              }}
              className="flex items-center justify-center gap-2 bg-[#0f4a2fe0] hover:bg-[#0f4a2f] text-white h-10 px-3 py-2 rounded-lg text-[.7rem] cursor-pointer"
            >
              <Pen size={16} /> Draw Tools
            </button>
          </div>
        )}

        {/* Filter PANEL */}
        <div className="relative">
          <div
            className={`absolute top-[-250px] w-[14rem] flex flex-col gap-2 p-2 bg-white border border-[#0f4a2fe0] rounded-md ${
              isFilterPenelOpen
                ? "opacity-100 pointer-events-auto"
                : "opacity-0 pointer-events-none"
            }`}
          >
            <div className="text-center font-bold w-full p-1 bg-[#0f4a2fe0] border border-[#0f4a2fe0] rounded-md">
              <h2 className="text-white text-[.8rem]">Filters</h2>
            </div>
            <div>
              <label className="text-[.7rem] text-gray-600">Barangays</label>
              <select
                onChange={(e) => {
                  const barangayId = parseInt(e.target.value, 10);
                  const selectedBarangay = barangays.find(
                    (b) => b.barangay_id === barangayId,
                  );
                  if (selectedBarangay && mapRef.current) {
                    mapRef.current.flyTo(
                      selectedBarangay.coordinate as [number, number],
                      16,
                    );
                  }
                }}
                className="w-full text-[.7rem] mt-1 p-1 border rounded-md focus:ring-2 focus:ring-green-500"
              >
                {barangays.map((b) => (
                  <option key={b.barangay_id} value={b.barangay_id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            onClick={() => {
              if (isFilterPenelOpen) {
                closeAll();
              } else {
                closeAll();
                setIsFilterPenelOpen(!isFilterPenelOpen);
              }
            }}
            className="flex items-center justify-center gap-2 bg-[#0f4a2fe0] hover:bg-[#0f4a2f] text-white h-10 px-3 py-2 rounded-lg text-[.7rem] cursor-pointer"
          >
            <Filter size={16} /> Filter
          </button>
        </div>
      </div>

      <MapContainer
        center={ORMOCCITY}
        zoom={12}
        className="h-full w-full"
        style={{ minHeight: "100vh" }}
      >
        <MapInitializer setMapRef={(map) => (mapRef.current = map)} />
        <TileLayer
          url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
          attribution='Map data &copy; <a href="https://www.google.com/maps">Google</a>'
        />

        {ndviTileUrl && showNDVI && (
          <TileLayer
            url={ndviTileUrl}
            opacity={0.7}
            attribution="NDVI Data &copy; Google Earth Engine"
          />
        )}

        {/* ✅ Suitable Polygons with "View Trends" Button */}
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

              // Create popup content with View Trends button
              const popupContent = `
                <div style="font-size: 12px; min-width: 180px;">
                  <strong style="color: #0f4a2f; font-size: 14px; display: block; margin-bottom: 8px; border-bottom: 1px solid #ddd; padding-bottom: 4px;">
                    ${props.site_id}
                  </strong>
                  <div style="margin: 4px 0;">
                    <span style="color: #666;">📏 Area:</span>
                    <strong> ${props.area_hectares} ha</strong>
                  </div>
                  <div style="margin: 4px 0;">
                    <span style="color: #666;">🌱 NDVI:</span>
                    <strong> ${props.avg_ndvi}</strong>
                  </div>
                  <div style="margin: 4px 0;">
                    <span style="color: #666;">🎯 Suitability:</span>
                    <strong> ${props.suitability_score}%</strong>
                  </div>
                  <div style="margin-top: 12px; padding-top: 8px; border-top: 1px dashed #ddd;">
                    <button id="view-trends-btn-${props.site_id}" style="
                      width: 100%;
                      padding: 6px 12px;
                      background: #0f4a2f;
                      color: white;
                      border: none;
                      border-radius: 4px;
                      font-size: 11px;
                      cursor: pointer;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      gap: 4px;
                    ">
                      📈 View Trends
                    </button>
                  </div>
                </div>
              `;

              layer.bindPopup(popupContent);

              // Add event listener for the View Trends button after popup opens
              layer.on("popupopen", () => {
                const btn = document.getElementById(
                  `view-trends-btn-${props.site_id}`,
                );
                if (btn) {
                  btn.onclick = (e: Event) => {
                    e.preventDefault();
                    e.stopPropagation();

                    // Close popup first
                    layer.closePopup();

                    // Set selected site data and open trends modal
                    setSelectedSiteGeometry(feature.geometry);
                    setSelectedSiteId(props.site_id);
                    setSelectedSiteName(`Site ${props.site_id}`);
                    setShowSiteTrends(true);
                  };
                }
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
                    <span>Location: {area.barangay.name}</span>
                    <span>Safety: {area.safety}</span>
                    <span>Description: {area.description}</span>
                    {area.area_img && (
                      <img
                        src={"http://127.0.0.1:8000" + area.area_img}
                        alt={area.name}
                        className="w-32 h-20 object-cover mt-1 rounded"
                      />
                    )}
                    <button className="flex items-center justify-center gap-1 ml-auto bg-[#0f4a2fe0] hover:bg-[#0f4a2f] text-white h-8 px-2 py-1 rounded-lg text-[.7rem] cursor-pointer">
                      <AreaChart size={16} /> View Sites
                    </button>
                  </div>
                </Popup>
              </Marker>
            );
          })}

        {/* Barangay Markers with "View Restricted Areas" Button */}
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
                    <div>
                      <strong className="text-[#0f4a2f]">{area.name}</strong>
                      <p className="text-gray-600 text-xs mt-1">
                        {area.description}
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedBarangayId(area.barangay_id)}
                      className="flex items-center justify-center gap-1 bg-[#0f4a2fe0] hover:bg-[#0f4a2f] text-white h-7 px-2 py-1 rounded text-[.7rem] cursor-pointer transition-colors w-fit"
                    >
                      <AreaChart size={14} /> View Restricted Areas
                    </button>
                    <button
                      onClick={() => mapRef.current?.closePopup()}
                      className="absolute top-1 right-1 text-gray-400 hover:text-gray-600 text-lg leading-none"
                      aria-label="Close popup"
                    >
                      ×
                    </button>
                  </div>
                </Popup>
              </Marker>
            );
          })}

        {goHome && <MapController center={ORMOCCITY} />}
        {markerPosition && (
          <Marker position={markerPosition} icon={greenIcon}>
            <Popup>Selected Location</Popup>
          </Marker>
        )}

        {/* Barangay Classified Areas Component */}
        <BarangayClassifiedAreas
          barangayId={selectedBarangayId}
          token={token}
          onClose={() => setSelectedBarangayId(null)}
          onStatusChange={handleClassifiedAreasStatus}
        />
      </MapContainer>

      {/* Canopy Guide Modal */}
      <CanopyGuideModal
        isOpen={showCanopyGuide}
        onClose={() => setShowCanopyGuide(false)}
      />

      {/* ✅ Potential Site Trends Modal */}
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
