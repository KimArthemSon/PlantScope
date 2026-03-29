import {
  MapContainer,
  TileLayer,
  useMap,
  GeoJSON,
  Marker,
  Polygon,
  Popup,
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
  FormInput,
  File,
  AreaChart,
} from "lucide-react";
import PlantScopeAlert from "@/components/alert/PlantScopeAlert";
import { useUserRole } from "@/hooks/authorization";

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
  // Array of [latitude, longitude] pairs
}

// Main Classified Area interface
interface ClassifiedArea {
  classified_area_id: number;
  name: string;
  land_classification_id: number;
  land_classification_name: string;
  polygon: PolygonGeometry;
  description: string;
  created_at: string; // ISO date string
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

export default function Map() {
  const token = localStorage.getItem("token");
  let ORMOCCITY: [number, number] = [11.02, 124.61];
  const mapRef = useRef<L.Map | null>(null);
  const drawnLayerRef = useRef<any>(null); // For managing map layer
  const [classified_areas, setClassified_areas] = useState<ClassifiedArea[]>(
    [],
  );

  const [barangays, setBarangays] = useState<Barangays[]>([]);
  const [selectedBarangay, SetSelectedBarangay] = useState<[number, number]>([
    1, 1,
  ]);

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

  // Analysis State
  const [suitablePolygons, setSuitablePolygons] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [drawnGeometry, setDrawnGeometry] = useState<any>(null); // Track geometry

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

  // Initialize Geoman drawing
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    (window as any).L = L;

    map.off("pm:create");
    map.on("pm:create", (e: any) => {
      // Remove previous layer if exists
      if (drawnLayerRef.current) {
        map.removeLayer(drawnLayerRef.current);
        drawnLayerRef.current = null;
      }

      const layer = e.layer;
      drawnLayerRef.current = layer;
      layer.setStyle({ color: "#3b82f6", weight: 2, fill: false });
      layer.addTo(map);

      // Save geometry to state → triggers UI update
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

      setForm({
        ...form,
        coordinate: [lat, lng],
      });

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
  // Render NDVI (city-wide)
  const renderNDVI = async () => {
    const res = await fetch(
      `http://127.0.0.1:8000/api/ndvi/?start=${start}&end=${end}`,
      {
        headers: { Authorization: "Bearer " + token },
      },
    );
    const data = await res.json();
    if (data.tile_url) {
      setNdviTileUrl(data.tile_url);
      setSuitablePolygons(null);
      setDrawnGeometry(null);
      if (drawnLayerRef.current && mapRef.current) {
        mapRef.current.removeLayer(drawnLayerRef.current);
        drawnLayerRef.current = null;
      }
    } else {
      alert("Could not generate NDVI map. Try a different date range.");
    }
  };

  // Analyze drawn area
  const analyzeArea = async () => {
    if (!drawnGeometry) {
      alert("Please draw a rectangle first.");
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
      if (data.polygons && data.polygons.features?.length > 0) {
        setSuitablePolygons(data.polygons);
        setNdviTileUrl(null);
      } else {
        alert("No suitable planting sites found in this area.");
        setSuitablePolygons(null);
      }
    } catch (err) {
      console.error(err);
      alert("Error analyzing area. Try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Cancel current drawing
  const cancelDrawing = () => {
    if (mapRef.current && drawnLayerRef.current) {
      mapRef.current.removeLayer(drawnLayerRef.current);
      drawnLayerRef.current = null;
    }
    setDrawnGeometry(null);
  };

  const handleHome = () => {
    setGoHome(true);
    // console.log('[11.02, 124.61]: ',ORMOCCITY)
    setTimeout(() => setGoHome(false), 100);
  };

  const clearAnalysis = () => {
    setSuitablePolygons(null);
    setDrawnGeometry(null);
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

  const hasDrawnArea = !!drawnGeometry;
  useEffect(() => {
    get_classified_area();
    getBarangays();
  }, []);
  useEffect(() => {
    console.log(barangays);
  }, [barangays]);

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

      if (!res.ok) {
        return;
      }
    } catch (e: any) {}
  }
  async function getBarangays() {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/get_barangay_list/", {
        headers: {
          Authorization: "Bearer " + token,
        },
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

      if (form.coordinate) {
        formData.append("coordinate", JSON.stringify(form.coordinate));
      }

      if (form.polygon_coordinate.coordinates.length > 0) {
        formData.append(
          "polygon_coordinate",
          JSON.stringify(form.polygon_coordinate.coordinates),
        );
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
          },
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
        barangay: {
          barangay_id: 0,
          name: "",
        },
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
      const token = localStorage.getItem("token"); // If using auth
      const res = await fetch(
        "http://127.0.0.1:8000/api/get_all_reforestation_areas/",
        {
          method: "GET",
          headers: {
            Authorization: token ? `Bearer ${token}` : "",
          },
        },
      );

      if (!res.ok) throw new Error("Failed to fetch reforestation areas");

      const data = await res.json();
      setReforestation_areas(data.data); // Save areas to state
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
      <div className="absolute z-[1000] flex gap-1 bottom-2 border border-2 border-green-700 rounded rounded-2xl left-1/2 -translate-x-1/2 bg-white p-2 w-[40rem]">
        <button
          onClick={handleHome}
          className="flex items-center justify-center gap-2 bg-[#0f4a2fe0] hover:bg-[#0f4a2f] text-white h-10 px-3 py-2 rounded-lg text-[.7rem] cursor-pointer"
        >
          <House size={16} /> Home
        </button>

        {/* NDVI PANEL */}

        {userRole != "DataManager" && (
          <div className=" relative ml-auto ">
            {isNdviPenelOpen && (
              <div className="absolute top-[-240px] w-[12rem] flex flex-col gap-2 p-2 bg-white border border-[#0f4a2fe0] rounded-md">
                <div className="text-center font-bold w-full p-1 bg-[#0f4a2fe0] border border-[#0f4a2fe0] rounded-md">
                  <h1 className="text-white [word-spacing:10px] ">NDVI</h1>
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
                  <button
                    onClick={renderNDVI}
                    className="flex items-center justify-center gap-1 ml-auto bg-[#0f4a2fe0] hover:bg-[#0f4a2f] text-white h-8 px-2 py-1 rounded-lg text-[.7rem] cursor-pointer"
                  >
                    <CloudLightning size={16} /> Run
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
          <div className=" relative ">
            <form
              onSubmit={onSubmit}
              className={`absolute top-[-485px] w-[14rem] flex flex-col gap-2 p-2 bg-white border border-[#0f4a2fe0] rounded-md ${
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

              {/* Location */}
              <div>
                <label className="text-[.7rem] text-gray-600">Barangay:</label>
                <select
                  value={form.barangay.barangay_id || ""} // ✅ Handle empty state
                  onChange={(e) => {
                    const selectedId = parseInt(e.target.value, 10);
                    const selectedBarangay = barangays.find(
                      (b) => b.barangay_id === selectedId,
                    );

                    setForm({
                      ...form,
                      barangay: {
                        barangay_id: selectedId,
                        name: selectedBarangay?.name || "", // ✅ Auto-fill name
                      },
                    });
                  }}
                  className="w-full text-[.7rem] mt-1 p-1 border rounded-md focus:ring-2 focus:ring-green-500"
                  required
                >
                  <option value="">-- Select Barangay --</option>{" "}
                  {/* ✅ Default option */}
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

                      setForm({
                        ...form,
                        coordinate: [lat, lng],
                      });
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
                    setForm({
                      ...form,
                      safety: e.target.value as SafetyType,
                    })
                  }
                  className="w-full text-[.7rem] mt-1 p-1 border rounded-md focus:ring-2 focus:ring-green-500"
                >
                  <option value="safe">Low Risk</option>
                  <option value="slightly">Slightly Unsafe</option>
                  <option value="moderate">Moderate Risk</option>
                  <option value="danger">High Risk</option>
                </select>
              </div>

              {/* Image */}
              <div>
                <label className="text-[.7rem] text-gray-600">Area Image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    setForm({
                      ...form,
                      area_img: e.target.files?.[0] || null,
                    })
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
                className="flex items-center justify-center gap-2 bg-[#0f4a2fe0] hover:bg-[#0f4a2f] text-white h-10 px-3 py-2 rounded-lg text-[.7rem] cursor-pointer"
              >
                <CloudLightning size={16} /> Analyze
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

            {/* Toggle Button */}
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
          {/* Toggle Button */}
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

      <MapContainer center={ORMOCCITY} zoom={12} className="h-full w-full">
        {/* Capture map instance */}
        <MapInitializer setMapRef={(map) => (mapRef.current = map)} />

        {/* Google Hybrid Basemap */}
        <TileLayer
          url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
          attribution='Map data &copy; <a href="https://www.google.com/maps">Google</a>'
        />

        {/* NDVI Layer */}
        {ndviTileUrl && showNDVI && (
          <TileLayer url={ndviTileUrl} opacity={0.7} />
        )}

        {/* Suitable Polygons */}
        {suitablePolygons && (
          <GeoJSON
            data={suitablePolygons}
            style={{
              color: "#dc2626",
              weight: 2,
              fillColor: "#fecaca",
              fillOpacity: 0.6,
            }}
          />
        )}

        {/* Classified Areas */}
        {classified_areas.length > 0 &&
          classified_areas.map((area, i) => (
            <Polygon
              key={i}
              positions={area.polygon.coordinates}
              pathOptions={{ color: "red" }}
            >
              <Popup>{area.name}</Popup>
            </Polygon>
          ))}

        {/* Reforestation Area Markers */}
        {reforestation_areas.length > 0 &&
          reforestation_areas.map((area) => {
            // Skip if no coordinates or invalid
            if (!area.coordinate || area.coordinate.length !== 2) return null;

            // Ensure numbers
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

        {barangays.length > 0 &&
          barangays.map((area) => {
            // Skip if no coordinates or invalid
            if (!area.coordinate || area.coordinate.length !== 2) return null;

            // Ensure numbers
            const lat = Number(area.coordinate[0]);
            const lng = Number(area.coordinate[1]);
            if (isNaN(lat) || isNaN(lng)) return null;

            return (
              <Marker key={area.name} position={[lat, lng]} icon={yellowIcon}>
                <Popup>
                  <div className="text-sm flex flex-col gap-1">
                    <strong>{area.name}</strong>
                    <span>Description: {area.description}</span>
                    <button className="flex items-center justify-center gap-1 ml-auto mt-3 bg-[#920505] hover:bg-[#690909] text-white h-8 px-2 py-1 rounded-lg text-[.7rem] cursor-pointer">
                      <AreaChart size={16} /> View restricted area
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
      </MapContainer>
    </div>
  );
}
