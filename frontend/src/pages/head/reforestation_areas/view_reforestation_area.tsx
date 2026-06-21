import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Pointer,
  File,
  X,
  Info,
  Clipboard,
  MapPin,
  Loader2,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import PlantScopeAlert from "@/components/alert/PlantScopeAlert";
import { api } from "@/constant/api.ts";
// ─────────────────────────────────────────────────────────────
// Types & Interfaces
// ─────────────────────────────────────────────────────────────
interface Barangay {
  barangay_id: number;
  name: string;
  description: string;
  coordinate: [number, number];
}

interface Land_classification {
  land_classification_id: number;
  name: string;
  description: string;
}

interface ReforestationAreaData {
  reforestation_area_id: number;
  name: string;
  legality: "pending" | "legal" | "illegal";
  safety: "safe" | "slightly" | "moderate" | "danger";
  location: string;
  description: string;
  coordinate: [number, number] | null;
  polygon_coordinate: { coordinates: [number, number][] } | null;
  barangay: { barangay_id: number; name: string } | null;
  land_classification: { land_classification_id: number; name: string } | null;
  created_at: string;
}

interface FormState {
  name: string;
  legality: "pending" | "legal" | "illegal";
  safety: "safe" | "slightly" | "moderate" | "danger";
  barangay_id: number | "";
  land_classification_id: number | "";
  description: string;
  coordinate: [number, number] | null;
  polygon_coordinate: { coordinates: [number, number][] } | null;
}

// ─────────────────────────────────────────────────────────────
// Leaflet Icon Setup
// ─────────────────────────────────────────────────────────────
const greenIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [0, -41],
});

// ─────────────────────────────────────────────────────────────
// Map Click Handler Component
// ─────────────────────────────────────────────────────────────
interface MapClickHandlerProps {
  placingMarker: boolean;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  setPlacingMarker: React.Dispatch<React.SetStateAction<boolean>>;
}

function MapClickHandler({
  placingMarker,
  setForm,
  setPlacingMarker,
}: MapClickHandlerProps) {
  useMapEvents({
    click(e) {
      if (!placingMarker) return;
      const { lat, lng } = e.latlng;
      setForm((prev) => ({
        ...prev,
        coordinate: [lat, lng],
      }));
      setPlacingMarker(false);
    },
  });
  return null;
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────
export default function ViewReforestationArea() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const API = api+"api";
  
  // ── State ──────────────────────────────────────────────────
  const [placingMarker, setPlacingMarker] = useState(false);
  const [barangays, setBarangays] = useState<Barangay[]>([]);
  const [land_classification, setLand_classification] = useState<
    Land_classification[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [PSalert, setPSAlert] = useState<{
    type: "success" | "failed" | "error";
    title: string;
    message: string;
  } | null>(null);

  const [form, setForm] = useState<FormState>({
    name: "",
    legality: "pending",
    safety: "moderate",
    barangay_id: "",
    land_classification_id: "",
    description: "",
    coordinate: null,
    polygon_coordinate: null,
  });

  const token = localStorage.getItem("token");

  // ── Fetch Barangays & Land Classifications ─────────────────
  useEffect(() => {
    const fetchBarangays = async () => {
      try {
        const res = await fetch(`${API}/get_barangay_list/`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setBarangays(data.data || []);
        }
      } catch (err) {
        console.error("Failed to fetch barangays:", err);
      }
    };

    const fetchLand_classification = async () => {
      try {
        const res = await fetch(`${API}/get_land_classifications_list/`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setLand_classification(data.data || []);
        }
      } catch (err) {
        console.error("Failed to fetch land classifications:", err);
      }
    };

    fetchLand_classification();
    fetchBarangays();
  }, [token]);

  // ── Fetch Existing Area Data ───────────────────────────────
  useEffect(() => {
    const fetchArea = async () => {
      if (!id || !token) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setLoadError(null);

        const res = await fetch(`${API}/get_reforestation_area/${id}/`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        });

        if (!res.ok) throw new Error("Failed to fetch area data");

        const result = await res.json();
        const area: ReforestationAreaData = result.data;

        setForm({
          name: area.name,
          legality: area.legality,
          safety: area.safety,
          barangay_id: area.barangay?.barangay_id || "",
          land_classification_id:
            area.land_classification?.land_classification_id || "",
          description: area.description || "",
          coordinate: area.coordinate,
          polygon_coordinate: area.polygon_coordinate,
        });
      } catch (err) {
        setLoadError(
          err instanceof Error ? err.message : "Failed to load area",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchArea();
  }, [id, token]);

  // ── Cancel Handler ─────────────────────────────────────────
  const handleCancel = () => {
    navigate(-1);
  };

  // ── Derived display values ─────────────────────────────────
  const selectedBarangayName = barangays.find(
    (b) => b.barangay_id === form.barangay_id,
  )?.name;

  const selectedLandClassificationName = land_classification.find(
    (lc) => lc.land_classification_id === form.land_classification_id,
  )?.name;

  // ── Loading State ──────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-green-50 to-emerald-100">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-green-600 animate-spin mx-auto mb-4" />
          <p className="text-black font-medium">Loading area data...</p>
        </div>
      </div>
    );
  }

  // ── Error State (fatal load error) ────────────────────────
  if (loadError && !form.name) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-green-50 to-emerald-100">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-black mb-2">
            Error Loading Area
          </h3>
          <p className="text-black mb-6">{loadError}</p>
          <button
            onClick={() => navigate(-1)}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // ── Main Render ────────────────────────────────────────────
  return (
    <div className="flex w-full h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 p-4 md:p-6">
      {/* ── PLANTSCOPEALERT ───────────────────────────────── */}
      {PSalert && (
        <PlantScopeAlert
          type={PSalert.type}
          title={PSalert.title}
          message={PSalert.message}
          onClose={() => setPSAlert(null)}
        />
      )}

      {/* ── LEFT PANEL: FORM ──────────────────────────────── */}
      <form
        onSubmit={(e) => e.preventDefault()} // Prevent default since it's view-only
        className="w-full md:w-[420px] bg-white/95 backdrop-blur rounded-3xl shadow-xl border border-green-100 p-6 flex flex-col gap-5 overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-green-100">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-green-700 to-emerald-600 bg-clip-text text-transparent">
            View Area
          </h2>
          <button
            type="button"
            onClick={handleCancel}
            className="p-2 hover:bg-black rounded-full transition-colors"
            aria-label="Cancel"
          >
            <X size={20} className="text-black" />
          </button>
        </div>

        {/* Name Field */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-black flex items-center gap-2">
            <Info size={16} className="text-green-600" />
            Area Name <span className="text-red-500">*</span>
          </label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g., Reforestation Site Alpha"
            className="w-full border border-black p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent transition-all bg-black50"
            required
            disabled={true}
          />
        </div>

        {/* Barangay Dropdown */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-black flex items-center gap-2">
            <MapPin size={16} className="text-green-600" />
            Barangay <span className="text-red-500">*</span>
          </label>
          <select
            value={form.barangay_id}
            onChange={(e) =>
              setForm({ ...form, barangay_id: parseInt(e.target.value) || "" })
            }
            className="w-full border border-black p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent transition-all bg-black50 appearance-none cursor-pointer"
            required
            disabled={true}
          >
            <option value="">-- Select Barangay --</option>
            {barangays.map((b) => (
              <option key={b.barangay_id} value={b.barangay_id}>
                {b.name}
              </option>
            ))}
          </select>
          {selectedBarangayName && (
            <p className="text-xs text-green-600 flex items-center gap-1">
              <CheckCircle size={12} /> Selected: {selectedBarangayName}
            </p>
          )}
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-black flex items-center gap-2">
            <Clipboard size={16} className="text-green-600" />
            Description
          </label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Add details about this reforestation area..."
            className="w-full border border-black p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent transition-all bg-black50 resize-none"
            rows={3}
            disabled={true}
          />
        </div>

        {/* Coordinate Input */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-black flex items-center gap-2">
            <Pointer size={16} className="text-green-600" />
            Coordinates
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={
                form.coordinate
                  ? `${form.coordinate[0].toFixed(6)}, ${form.coordinate[1].toFixed(6)}`
                  : ""
              }
              onChange={(e) => {
                const parts = e.target.value
                  .split(",")
                  .map((v) => parseFloat(v.trim()));
                if (
                  parts.length === 2 &&
                  !isNaN(parts[0]) &&
                  !isNaN(parts[1])
                ) {
                  setForm({ ...form, coordinate: [parts[0], parts[1]] });
                }
              }}
              placeholder="11.007123, 124.602456"
              className="flex-1 border border-black p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent transition-all bg-black50 font-mono text-sm"
              disabled={true}
            />
            <button
              type="button"
              onClick={() => setPlacingMarker(true)}
              disabled={true}
              className={`px-4 rounded-xl text-white font-medium transition-all flex items-center gap-1.5 ${
                placingMarker
                  ? "bg-orange-500 hover:bg-orange-600 animate-pulse"
                  : "bg-green-600 hover:bg-green-700"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              title={
                placingMarker
                  ? "Click on map to place marker"
                  : "Place marker on map"
              }
            >
              <Pointer size={16} />
              {placingMarker ? "Placing..." : "Pick"}
            </button>
          </div>
          {form.coordinate && (
            <p className="text-xs text-black font-mono">
              Lat: {form.coordinate[0].toFixed(6)} | Lng:{" "}
              {form.coordinate[1].toFixed(6)}
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2 border-t border-green-100">
          <button
            type="button"
            onClick={handleCancel}
            disabled={false}
            className="flex-1 border border-black p-3 rounded-xl hover:bg-black transition-colors font-medium text-black disabled:opacity-50"
          >
            Back
          </button>
        </div>
      </form>

      {/* ── RIGHT PANEL: MAP & INFO ─────────────────────── */}
      <div className="flex-1 flex flex-col gap-4 ml-0 md:ml-6 mt-4 md:mt-0">
        {/* Map Container */}
        <div className="flex-1 rounded-3xl overflow-hidden shadow-xl border border-green-100 bg-white/50 backdrop-blur">
          <MapContainer
            center={form.coordinate || [11.02, 124.61]}
            zoom={form.coordinate ? 17 : 13}
            style={{ height: "100%", width: "100%" }}
            scrollWheelZoom={true}
          >
            <TileLayer
              url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
              attribution='&copy; <a href="https://www.google.com/maps">Google</a>'
            />
            <MapClickHandler
              placingMarker={placingMarker}
              setForm={setForm}
              setPlacingMarker={setPlacingMarker}
            />
            {form.coordinate && (
              <Marker position={form.coordinate} icon={greenIcon}>
                <Popup>
                  <div className="text-sm font-medium">
                    <strong>{form.name || "Selected Location"}</strong>
                    {selectedBarangayName && <br />}
                    {selectedBarangayName && (
                      <span className="text-black">{selectedBarangayName}</span>
                    )}
                  </div>
                </Popup>
              </Marker>
            )}
          </MapContainer>
        </div>

        {/* Info Card */}
        <div className="bg-white/80 backdrop-blur rounded-2xl shadow-lg border border-green-100 p-4">
          <h4 className="text-sm font-semibold text-black mb-2 flex items-center gap-2">
            <Info size={16} className="text-green-600" />
            Area Details
          </h4>
          <ul className="text-xs text-black space-y-1.5">
            <li className="flex items-start gap-2">
              <span className="text-green-500">•</span>
              This is a read-only view of the reforestation area.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500">•</span>
              The map shows the exact coordinate marker for this area.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500">•</span>
              Click "Back" to return to the list of areas.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}