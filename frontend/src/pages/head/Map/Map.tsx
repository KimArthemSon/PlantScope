import {
  MapContainer,
  TileLayer,
  useMap,
  GeoJSON,
  Marker,
  Polygon,
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
// ✅ NEW: Import the separated component
import BarangayClassifiedAreas from "./barangay_classified_area";

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

  // ✅ Canopy Guide State
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

  // ✅ NEW: State for tracking selected barangay's classified areas
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

  useEffect(() => {
    if (!showNDVI) {
      setShowCanopyGuide(false);
    }
  }, [showNDVI]);

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
      if (data.success && data.features && data.features.length > 0) {
        setSuitablePolygons(data);
        setNdviTileUrl(null);
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

  useEffect(() => {
    get_classified_area();
    getBarangays();
  }, []);

  useEffect(() => {
    console.log(barangays);
  }, [barangays]);

  // ✅ Cleanup: Clear selected barangay when component unmounts
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

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();
      formData.append("name", form.name);
      formData.append("description", form.description);
      formData.append("barangay_id", String(form.barangay.barangay_id));
      formData.append("legality", form.legality);
      formData.append("safety", form.safety);
      if (form.coordinate)
        formData.append("coordinate", JSON.stringify(form.coordinate));
      if (form.polygon_coordinate.coordinates.length > 0) {
        formData.append(
          "polygon_coordinate",
          JSON.stringify(form.polygon_coordinate.coordinates),
        );
      }
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
      if (!res.ok) {
        alert(
          "Failed to create area: " +
            (data.detail || data.error || "Unknown error"),
        );
        return;
      }
      setPSAlert({
        type: "success",
        title: "Success",
        message: "Successfully added!",
      });
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
      setIsFormPenelOpen(false);
      get_all_reforestation_areas();
    } catch (error) {
      console.error(error);
      alert("Error submitting form.");
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
      // Optional: handle loading state with a spinner if desired
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
        {userRole != "DataManager" && (
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
                    className={`flex items-center justify-center gap-1 ml-auto h-8 px-2 py-1 rounded-lg text-[.7rem] cursor-pointer transition-colors ${isNdviLoading ? "bg-gray-400 cursor-not-allowed" : "bg-[#0f4a2fe0] hover:bg-[#0f4a2f] text-white"}`}
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

        {/* Create PANEL */}
        {userRole != "DataManager" && (
          <div className="relative">
            <form
              onSubmit={onSubmit}
              className={`absolute top-[-485px] w-[14rem] flex flex-col gap-2 p-2 bg-white border border-[#0f4a2fe0] rounded-md ${isFormPenelOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
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
        {userRole != "DataManager" && (
          <div className="relative">
            <div
              className={`absolute top-[-255px] w-[14rem] flex flex-col gap-2 p-2 bg-white border border-[#0f4a2fe0] rounded-md ${isDrawPenelOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
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
                className={`flex items-center justify-center gap-2 h-10 px-3 py-2 rounded-lg text-[.7rem] cursor-pointer ${isProcessing ? "bg-gray-400 cursor-not-allowed" : "bg-[#0f4a2fe0] hover:bg-[#0f4a2f] text-white"}`}
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
            className={`absolute top-[-250px] w-[14rem] flex flex-col gap-2 p-2 bg-white border border-[#0f4a2fe0] rounded-md ${isFilterPenelOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
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

        {/* Suitable Polygons from Analysis */}
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
              layer.bindPopup(
                `<div style="font-size: 12px; min-width: 150px;"><strong style="color: #0f4a2f; font-size: 14px; display: block; margin-bottom: 8px; border-bottom: 1px solid #ddd; padding-bottom: 4px;">${props.site_id}</strong><div style="margin: 4px 0;"><span style="color: #666;">📏 Area:</span><strong> ${props.area_hectares} ha</strong></div><div style="margin: 4px 0;"><span style="color: #666;">🌱 NDVI:</span><strong> ${props.avg_ndvi}</strong></div><div style="margin: 4px 0;"><span style="color: #666;">🎯 Suitability:</span><strong> ${props.suitability_score}%</strong></div></div>`,
              );
            }}
          />
        )}

        {/* ❌ REMOVE OR COMMENT OUT THIS BLOCK - It renders ALL classified areas immediately */}
        {/* 
  {classified_areas.length > 0 &&
    classified_areas.map((area, i) => (
      <Polygon key={i} positions={area.polygon.coordinates} pathOptions={{ color: "red" }}>
        <Popup>{area.name}</Popup>
      </Polygon>
    ))} 
  */}

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
                    {/* ✅ Button triggers barangay-specific classified areas */}
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

        {/* ✅ ONLY this component renders classified areas - and ONLY when selectedBarangayId is set */}
        <BarangayClassifiedAreas
          barangayId={selectedBarangayId}
          token={token}
          onClose={() => setSelectedBarangayId(null)}
          onStatusChange={handleClassifiedAreasStatus} // ✅ Add this prop
        />
      </MapContainer>

      {/* Canopy Guide Modal */}
      <CanopyGuideModal
        isOpen={showCanopyGuide}
        onClose={() => setShowCanopyGuide(false)}
      />
    </div>
  );
}
