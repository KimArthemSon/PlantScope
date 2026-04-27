import { useEffect, useState } from "react";
import { Map, Clipboard, Info, Trash, Upload, Download } from "lucide-react";
import PlantScopeAlert from "@/components/alert/PlantScopeAlert";
import LoaderPending from "@/components/layout/loaderSmall";
import GoToCenterButton from "@/components/helper/gotocenter";
import { MapContainer, TileLayer, Marker, Popup, Polygon } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useNavigate, useParams } from "react-router-dom";
import { useRef } from "react";
import { useUserRole } from "@/hooks/authorization";

interface Polygon {
  coordinates: [number, number][];
  type: string;
}

interface Classified_area {
  name: string;
  description: string;
  land_classification_id: number;
  barangay_id: number;
  polygon: Polygon;
}

interface land_classification {
  land_classification_id: number;
  name: string;
}

interface Barangay {
  barangay_id: number;
  name: string;
}

export default function Classified_area_form() {
  const { id } = useParams();
  const mapRef = useRef<any>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const action = id ? "Edit" : "Add";

  const [PSalert, setPSAlert] = useState<{
    type: "success" | "failed" | "error";
    title: string;
    message: string;
  } | null>(null);

  const [land_classification, setLand_classification] = useState<land_classification[]>([
    { land_classification_id: 0, name: "land 1" },
  ]);

  const [barangay_list, setBarangay_list] = useState<Barangay[]>([]);

  const [classified_area, setClassified_area] = useState<Classified_area>({
    name: "",
    description: "",
    land_classification_id: 0,
    barangay_id: 0,
    polygon: { coordinates: [[1, 1]], type: "POLYGON" },
  });

  const { userRole } = useUserRole();
  const [useruserRole, setUseruserRole] = useState("");

  useEffect(() => {
    if (userRole === "treeGrowers" || userRole === "CityENROHead") {
      setUseruserRole("");
      return;
    }
    if (userRole === "DataManager") {
      setUseruserRole("/DataManager");
      return;
    }
  }, [userRole]);

  const token = localStorage.getItem("token");
  const [loading, setLoading] = useState(false);

  const inputWrapper =
    "flex items-center border border-gray-300 rounded-lg mt-1.5 p-1 bg-gray-50 " +
    "focus-within:border-green-600 focus-within:ring-2 focus-within:ring-green-200 " +
    "focus-within:bg-white transition-all";

  const inputField = "flex-1 text-[.8rem] p-2 outline-none bg-transparent text-gray-800";
  const navigate = useNavigate();

  const currentPosition: [number, number] = [11.007, 124.602];

  useEffect(() => {
    get_land_classification_list();
    get_barangay_list();
  }, []);

  async function get_barangay_list() {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/get_barangay_list/", {
        headers: { Authorization: "Bearer " + token },
      });
      const data = await res.json();
      if (res.ok && data.data?.length > 0) {
        setBarangay_list(data.data);
        if (!id && data.data[0]) {
          setClassified_area((prev) => ({ ...prev, barangay_id: data.data[0].barangay_id }));
        }
      }
    } catch (e) {
      console.error("Failed to load barangays:", e);
    }
  }

  async function get_classified_area() {
    setLoading(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/get_classified_area/" + id, {
        headers: { Authorization: "Bearer " + token },
      });
      const data = await res.json();
      if (!res.ok) {
        setLoading(false);
        setPSAlert({ type: "error", title: "Error", message: data.error });
        return;
      }
      setClassified_area({
        name: data.data.name,
        description: data.data.description,
        land_classification_id: data.data.land_classification_id,
        barangay_id: data.data.barangay_id,
        polygon: data.data.polygon,
      });
      setLoading(false);
    } catch (e: any) {
      setLoading(false);
      setPSAlert({ type: "error", title: "Error", message: "Failed to load area." });
    }
  }

  async function get_land_classification_list() {
    setLoading(true);
    try {
      const res = await fetch(
        "http://127.0.0.1:8000/api/get_land_classifications_list/?for_reforestation=false",
        { headers: { Authorization: "Bearer " + token } },
      );
      const data = await res.json();
      if (!res.ok) {
        setLoading(false);
        setPSAlert({ type: "error", title: "Error", message: data.error });
        return;
      }
      if (data.data.length === 0) {
        navigate(`${useruserRole}/maintenance/Classified_areas`);
        return;
      }
      setLand_classification(data.data);
      setClassified_area((prev) => ({
        ...prev,
        land_classification_id: data.data[0].land_classification_id,
      }));
      setLoading(false);
      if (id) get_classified_area();
    } catch (e: any) {
      setLoading(false);
      setPSAlert({ type: "error", title: "Error", message: e.error?.message });
    }
  }

  function handleCSVImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.trim().split(/\r?\n/);
      if (lines.length < 2) return;

      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
      const latIdx = headers.findIndex((h) => h === "lat" || h === "latitude");
      const lngIdx = headers.findIndex(
        (h) => h === "lng" || h === "longitude" || h === "lon",
      );

      if (latIdx === -1 || lngIdx === -1) {
        setPSAlert({
          type: "error",
          title: "Invalid CSV",
          message: "CSV must have 'lat' and 'lng' (or 'latitude'/'longitude') columns.",
        });
        return;
      }

      const coords: [number, number][] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",");
        const lat = parseFloat(cols[latIdx]);
        const lng = parseFloat(cols[lngIdx]);
        if (!isNaN(lat) && !isNaN(lng)) {
          coords.push([lng, lat]); // internal format: [lng, lat]
        }
      }

      if (coords.length === 0) {
        setPSAlert({ type: "error", title: "Invalid CSV", message: "No valid coordinates found." });
        return;
      }

      setClassified_area((prev) => ({
        ...prev,
        polygon: { ...prev.polygon, coordinates: coords },
      }));

      if (mapRef.current && coords.length > 0) {
        mapRef.current.flyTo(coords[0], 16);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function handleCSVExport() {
    const coords = classified_area.polygon.coordinates;
    if (coords.length === 0) return;

    const header = "lat,lng";
    const rows = coords.map((c) => `${c[1]},${c[0]}`); // [lng, lat] → export as lat, lng
    const csvContent = [header, ...rows].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${classified_area.name || "classified_area"}_coordinates.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function hanle_submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (action === "Add") handleAdd();
    else handleEdit();
  }

  async function handleAdd() {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://127.0.0.1:8000/api/create_classified_area/", {
        method: "POST",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify(classified_area),
      });
      const data = await res.json();
      if (!res.ok) {
        setPSAlert({ type: "error", title: "Error", message: data.error });
        return;
      }
      setPSAlert({ type: "success", title: "Success", message: "Successfully Created" });
      setTimeout(() => navigate(`${useruserRole}/maintenance/Classified_areas`), 2000);
    } catch (e: any) {
      setPSAlert({ type: "error", title: "Error", message: e.error });
    }
  }

  async function handleEdit() {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://127.0.0.1:8000/api/update_classified_area/" + id, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify(classified_area),
      });
      const data = await res.json();
      if (!res.ok) {
        setPSAlert({ type: "error", title: "Error", message: data.error });
        return;
      }
      setPSAlert({ type: "success", title: "Success", message: "Successfully Updated" });
      setTimeout(() => navigate(`${useruserRole}/maintenance/Classified_areas`), 2000);
    } catch (e: any) {
      setPSAlert({ type: "error", title: "Error", message: e.error });
    }
  }

  return (
    <div className="flex flex-col flex-1 w-full min-w-150 h-full bg-gray-50 items-center">
      {PSalert && (
        <PlantScopeAlert
          type={PSalert.type}
          title={PSalert.title}
          message={PSalert.message}
          onClose={() => setPSAlert(null)}
        />
      )}
      {loading && <LoaderPending />}

      {/* Page Header */}
      <div className="w-full bg-white border-b border-gray-200 px-10 py-4 flex items-center gap-3 shadow-sm">
        <div className="bg-green-700 p-2 rounded-lg">
          <Map size={18} className="text-white" />
        </div>
        <div>
          <h1 className="font-bold text-base text-gray-800">{action} Classified Area</h1>
          <p className="text-xs text-gray-400">Define the area name, classification, and map polygon</p>
        </div>
      </div>

      <main className="flex flex-col w-full flex-1 max-w-700 max-h-400 gap-8 min-w-200 p-8 pb-5">
        <div className="flex gap-6 w-full h-full">

          {/* Left panel — form */}
          <form
            className="flex flex-col w-[42%] gap-4 min-w-100"
            onSubmit={hanle_submit}
          >

            {/* Name */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <label className="text-[.7rem] font-semibold text-gray-400 uppercase tracking-widest">
                Area Name
              </label>
              <div className={inputWrapper}>
                <Info size={15} className="ml-3 text-green-700 shrink-0" />
                <input
                  required
                  type="text"
                  className={inputField}
                  placeholder="Ex: Zone A"
                  value={classified_area.name}
                  onChange={(e) =>
                    setClassified_area((prev) => ({ ...prev, name: e.target.value }))
                  }
                />
              </div>
            </div>

            {/* Description */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <label className="text-[.7rem] font-semibold text-gray-400 uppercase tracking-widest">
                Description
              </label>
              <div className={inputWrapper}>
                <Clipboard size={15} className="ml-3 text-green-700 shrink-0" />
                <textarea
                  required
                  rows={3}
                  className={inputField + " resize-none"}
                  placeholder="Describe this classified area..."
                  value={classified_area.description}
                  onChange={(e) =>
                    setClassified_area((prev) => ({ ...prev, description: e.target.value }))
                  }
                />
              </div>
            </div>

            {/* Land Classification + Barangay side by side */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex gap-3">
              <div className="flex flex-col flex-1 min-w-0">
                <label className="text-[.7rem] font-semibold text-gray-400 uppercase tracking-widest">
                  Land Classification
                </label>
                <div className={inputWrapper}>
                  <Map size={14} className="ml-3 text-green-700 shrink-0" />
                  <select
                    required
                    className={inputField}
                    value={classified_area.land_classification_id}
                    onChange={(e) =>
                      setClassified_area((prev) => ({
                        ...prev,
                        land_classification_id: Number(e.target.value),
                      }))
                    }
                  >
                    {land_classification.map((e) => (
                      <option key={e.land_classification_id} value={e.land_classification_id}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex flex-col flex-1 min-w-0">
                <label className="text-[.7rem] font-semibold text-gray-400 uppercase tracking-widest">
                  Barangay
                </label>
                <div className={inputWrapper}>
                  <Map size={14} className="ml-3 text-green-700 shrink-0" />
                  <select
                    required
                    className={inputField}
                    value={classified_area.barangay_id}
                    onChange={(e) =>
                      setClassified_area((prev) => ({
                        ...prev,
                        barangay_id: Number(e.target.value),
                      }))
                    }
                  >
                    <option value="" disabled>Select</option>
                    {barangay_list.map((b) => (
                      <option key={b.barangay_id} value={b.barangay_id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Polygon Coordinates */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col flex-1 min-h-0">

              {/* Section header */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                <Map size={14} className="text-green-700" />
                <span className="text-[.75rem] font-semibold text-gray-500 uppercase tracking-widest">
                  Polygon Coordinates
                </span>
                <span className="bg-green-100 text-green-700 text-[.65rem] font-bold px-2 py-0.5 rounded-full">
                  {classified_area.polygon.coordinates.length} pts
                </span>
                <button
                  className="ml-auto text-[.7rem] px-2.5 py-1 bg-gray-100 hover:bg-gray-200 rounded-md text-gray-600 font-medium transition-colors"
                  onClick={(e) => {
                    e.preventDefault();
                    if (!mapRef.current || classified_area.polygon.coordinates.length === 0) return;
                    mapRef.current.flyTo(classified_area.polygon.coordinates[0], 16);
                  }}
                >
                  Go to Polygon
                </button>
              </div>

              {/* Coordinate list */}
              <div className="flex flex-col gap-2 overflow-y-auto p-3 flex-1 max-h-52">
                {classified_area.polygon.coordinates.map((element, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2"
                  >
                    <span className="text-[.7rem] font-bold text-gray-400 min-w-6">#{i + 1}</span>
                    <div className="flex gap-2 flex-1">
                      <div className="flex flex-col flex-1">
                        <label className="text-[.65rem] text-gray-400 font-medium mb-0.5">Lat (X)</label>
                        <input
                          type="number"
                          step="any"
                          className="text-[.75rem] border border-gray-200 rounded-md px-2 py-1 outline-none focus:border-green-500 bg-white w-full"
                          placeholder="10.9695"
                          value={element[1]}
                          onChange={(e) =>
                            setClassified_area((prev) => ({
                              ...prev,
                              polygon: {
                                ...prev.polygon,
                                coordinates: prev.polygon.coordinates.map((coord, ind) =>
                                  ind === i ? [coord[0], Number(e.target.value)] : coord,
                                ),
                              },
                            }))
                          }
                        />
                      </div>
                      <div className="flex flex-col flex-1">
                        <label className="text-[.65rem] text-gray-400 font-medium mb-0.5">Lng (Y)</label>
                        <input
                          type="number"
                          step="any"
                          className="text-[.75rem] border border-gray-200 rounded-md px-2 py-1 outline-none focus:border-green-500 bg-white w-full"
                          placeholder="124.603"
                          value={element[0]}
                          onChange={(e) =>
                            setClassified_area((prev) => ({
                              ...prev,
                              polygon: {
                                ...prev.polygon,
                                coordinates: prev.polygon.coordinates.map((coord, ind) =>
                                  ind === i ? [Number(e.target.value), coord[1]] : coord,
                                ),
                              },
                            }))
                          }
                        />
                      </div>
                    </div>
                    {classified_area.polygon.coordinates.length > 1 && (
                      <button
                        className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 transition-colors shrink-0"
                        onClick={(e) => {
                          e.preventDefault();
                          setClassified_area((prev) => ({
                            ...prev,
                            polygon: {
                              ...prev.polygon,
                              coordinates: prev.polygon.coordinates.filter((_, il) => il !== i),
                            },
                          }));
                        }}
                      >
                        <Trash size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Coordinate action buttons */}
              <div className="flex gap-2 px-3 py-3 border-t border-gray-100">
                <input
                  ref={csvInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleCSVImport}
                />
                <button
                  className="flex-1 flex items-center justify-center gap-1.5 text-[.72rem] font-semibold py-2 bg-green-700 hover:bg-green-800 text-white rounded-lg transition-colors"
                  onClick={(e) => {
                    e.preventDefault();
                    setClassified_area((prev) => ({
                      ...prev,
                      polygon: {
                        ...prev.polygon,
                        coordinates: [...prev.polygon.coordinates, [1, 1]],
                      },
                    }));
                  }}
                >
                  + Add Point
                </button>
                <button
                  className="flex-1 flex items-center justify-center gap-1.5 text-[.72rem] font-semibold py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                  onClick={(e) => {
                    e.preventDefault();
                    csvInputRef.current?.click();
                  }}
                >
                  <Upload size={12} /> Import CSV
                </button>
                <button
                  className="flex-1 flex items-center justify-center gap-1.5 text-[.72rem] font-semibold py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors"
                  onClick={(e) => {
                    e.preventDefault();
                    handleCSVExport();
                  }}
                >
                  <Download size={12} /> Export CSV
                </button>
              </div>
            </div>

            {/* Form action buttons */}
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                className="flex-1 py-2.5 rounded-xl text-[.8rem] font-semibold border border-gray-300 text-gray-600 bg-white hover:bg-gray-50 transition-colors"
                onClick={() => navigate(`${useruserRole}/maintenance/Classified_areas`)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl text-[.8rem] font-semibold bg-green-700 hover:bg-green-800 text-white transition-colors shadow-sm"
              >
                {action === "Add" ? "Create Area" : "Save Changes"}
              </button>
            </div>
          </form>

          {/* Right panel — map */}
          <div className="flex flex-col flex-1 min-w-0 gap-3">
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm px-4 py-2.5 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[.75rem] font-semibold text-gray-500">Live Preview Map</span>
              <span className="ml-auto text-[.7rem] text-gray-400">
                {classified_area.polygon.coordinates.length} coordinate{classified_area.polygon.coordinates.length !== 1 ? "s" : ""} plotted
              </span>
            </div>
            <div className="border border-gray-200 flex-1 rounded-xl overflow-hidden shadow-sm">
              <MapContainer
                center={currentPosition}
                zoom={16}
                scrollWheelZoom={true}
                style={{ width: "100%", height: "100%" }}
                ref={(map) => { if (map != null) mapRef.current = map; }}
              >
                <TileLayer
                  url="http://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
                  attribution='&copy; <a href="https://www.google.com/intl/en/help/terms_maps.html">Google Maps</a>'
                />
                <GoToCenterButton center={currentPosition} />
                <Marker position={currentPosition}>
                  <Popup>Center Point</Popup>
                </Marker>
                <Polygon
                  positions={classified_area.polygon.coordinates}
                  pathOptions={{ color: "#15803d", fillColor: "#16a34a", fillOpacity: 0.2 }}
                >
                  <Popup>{classified_area.name || "Classified Area"}</Popup>
                </Polygon>
              </MapContainer>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
