import { useEffect, useState, useCallback } from "react";
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
  Image,
  Info,
  Clipboard,
  MapPin,
  Loader2,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────
// Types & Interfaces
// ─────────────────────────────────────────────────────────────
interface Barangay {
  barangay_id: number;
  name: string;
  description: string;
  coordinate: [number, number];
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
  area_img: string | null;
  barangay: { barangay_id: number; name: string } | null;
  created_at: string;
}

interface FormState {
  name: string;
  legality: "pending" | "legal" | "illegal";
  safety: "safe" | "slightly" | "moderate" | "danger";
  barangay_id: number | "";
  description: string;
  coordinate: [number, number] | null;
  polygon_coordinate: { coordinates: [number, number][] } | null;
  area_img: File | null;
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
export default function UpdateReforestationArea() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const API = "http://127.0.0.1:8000/api";

  // ── State ──────────────────────────────────────────────────
  const [placingMarker, setPlacingMarker] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [barangays, setBarangays] = useState<Barangay[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>({
    name: "",
    legality: "pending",
    safety: "moderate",
    barangay_id: "",
    description: "",
    coordinate: null,
    polygon_coordinate: null,
    area_img: null,
  });

  const token = localStorage.getItem("token");

  // ── Fetch Barangays ────────────────────────────────────────
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
        setError(null);

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
          description: area.description || "",
          coordinate: area.coordinate,
          polygon_coordinate: area.polygon_coordinate,
          area_img: null,
        });

        if (area.area_img) {
          const imgUrl = area.area_img.startsWith("http")
            ? area.area_img
            : `http://127.0.0.1:8000${area.area_img}`;
          setImagePreview(imgUrl);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load area");
      } finally {
        setLoading(false);
      }
    };

    fetchArea();
  }, [id, token]);

  // ── Cleanup blob URLs on unmount ───────────────────────────
  useEffect(() => {
    return () => {
      if (imagePreview?.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  // ── Image Handler ──────────────────────────────────────────
  const handleImageChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Validate file type
      if (!file.type.startsWith("image/")) {
        setError("Please select a valid image file");
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError("Image must be less than 5MB");
        return;
      }

      // Cleanup previous blob URL
      if (imagePreview?.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }

      setForm((prev) => ({ ...prev, area_img: file }));
      setImagePreview(URL.createObjectURL(file));
      setError(null);
    },
    [imagePreview],
  );

  // ── Form Submission ────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !id) return;

    // Validation
    if (!form.name.trim()) {
      setError("Area name is required");
      return;
    }
    if (!form.barangay_id) {
      setError("Please select a barangay");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append("name", form.name.trim());
      formData.append("legality", form.legality);
      formData.append("safety", form.safety);
      formData.append("barangay_id", String(form.barangay_id));
      formData.append("description", form.description.trim());

      if (form.coordinate) {
        formData.append("coordinate", JSON.stringify(form.coordinate));
      }
      if (form.polygon_coordinate) {
        formData.append(
          "polygon_coordinate",
          JSON.stringify(form.polygon_coordinate),
        );
      }
      if (form.area_img) {
        formData.append("area_img", form.area_img);
      }

      const res = await fetch(`${API}/update_reforestation_areas/${id}/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess("Area updated successfully! 🎉");
        setTimeout(() => navigate(-1), 1500);
      } else {
        setError(data.error || data.detail || "Update failed");
      }
    } catch (err) {
      setError("Network error. Please check your connection.");
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Cancel Handler ─────────────────────────────────────────
  const handleCancel = () => {
    // Cleanup blob URL if exists
    if (imagePreview?.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }
    navigate(-1);
  };

  // ── Get selected barangay name for display ─────────────────
  const selectedBarangayName = barangays.find(
    (b) => b.barangay_id === form.barangay_id,
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

  // ── Error State ────────────────────────────────────────────
  if (error && !form.name) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-green-50 to-emerald-100">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-black mb-2">
            Error Loading Area
          </h3>
          <p className="text-black mb-6">{error}</p>
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
      {/* ── IMAGE MODAL ───────────────────────────────────── */}
      {showModal && imagePreview && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="relative max-w-[95%] max-h-[90%] bg-white rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 bg-white/90 hover:bg-white rounded-full p-2 shadow-lg transition-all hover:scale-110 z-10"
              aria-label="Close modal"
            >
              <X size={20} className="text-black" />
            </button>
            <img
              src={imagePreview}
              alt="Area preview"
              className="max-h-[85vh] max-w-[90vw] object-contain"
            />
          </div>
        </div>
      )}

      {/* ── LEFT PANEL: FORM ──────────────────────────────── */}
      <form
        onSubmit={handleSubmit}
        className="w-full md:w-[420px] bg-white/95 backdrop-blur rounded-3xl shadow-xl border border-green-100 p-6 flex flex-col gap-5 overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-green-100">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-green-700 to-emerald-600 bg-clip-text text-transparent">
            Update Area
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

        {/* Alerts */}
        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
            <CheckCircle size={18} className="mt-0.5 flex-shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Name Field */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-black flex items-center gap-2">
            <Info size={16} className="text-green-600" />
            Area Name <span className="text-red-500">*</span>
          </label>
          <input
            value={form.name}
            onChange={(e) => {
              setForm({ ...form, name: e.target.value });
              setError(null);
            }}
            placeholder="e.g., Reforestation Site Alpha"
            className="w-full border border-black p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent transition-all bg-black50"
            required
            disabled={submitting}
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
            onChange={(e) => {
              setForm({ ...form, barangay_id: parseInt(e.target.value) || "" });
              setError(null);
            }}
            className="w-full border border-black p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent transition-all bg-black50 appearance-none cursor-pointer"
            required
            disabled={submitting || barangays.length === 0}
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
            disabled={submitting}
          />
        </div>

        {/* Legality & Safety Row */}
        

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
              disabled={submitting}
            />
            <button
              type="button"
              onClick={() => setPlacingMarker(true)}
              disabled={submitting}
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

        {/* Image Upload */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-black flex items-center gap-2">
            <Image size={16} className="text-green-600" />
            Area Image
          </label>
          <div className="border-2 border-dashed border-black rounded-xl p-4 text-center hover:border-green-300 transition-colors bg-black30">
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
              id="image-upload"
              disabled={submitting}
            />
            <label
              htmlFor="image-upload"
              className="cursor-pointer flex flex-col items-center gap-2"
            >
              <Image size={24} className="text-black" />
              <span className="text-sm text-black">
                {form.area_img ? form.area_img.name : "Click to upload image"}
              </span>
              <span className="text-xs text-black">PNG, JPG up to 5MB</span>
            </label>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2 border-t border-green-100">
          <button
            type="button"
            onClick={handleCancel}
            disabled={submitting}
            className="flex-1 border border-black p-3 rounded-xl hover:bg-blacktransition-colors font-medium text-black disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 text-white p-3 rounded-xl flex items-center justify-center gap-2 hover:from-green-700 hover:to-emerald-700 transition-all font-medium shadow-lg shadow-green-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <File size={18} />
                Update Area
              </>
            )}
          </button>
        </div>
      </form>

      {/* ── RIGHT PANEL: MAP & PREVIEW ───────────────────── */}
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
                      <span className="text-black">
                        {selectedBarangayName}
                      </span>
                    )}
                  </div>
                </Popup>
              </Marker>
            )}
          </MapContainer>
        </div>

        {/* Image Preview Card */}
        {imagePreview && (
          <div className="bg-white/95 backdrop-blur rounded-2xl shadow-lg border border-green-100 p-4">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-semibold text-black flex items-center gap-2">
                <Image size={16} className="text-green-600" />
                Preview
              </span>
              <button
                type="button"
                onClick={() => setShowModal(true)}
                className="text-sm bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors font-medium"
              >
                <Image size={14} />
                Expand
              </button>
            </div>
            <div className="relative group">
              <img
                src={imagePreview}
                alt="Area preview"
                className="w-full h-40 object-cover rounded-xl border border-black"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 rounded-xl transition-colors flex items-center justify-center">
                <span className="opacity-0 group-hover:opacity-100 text-white text-sm font-medium bg-black/50 px-3 py-1 rounded-full transition-opacity">
                  Click to enlarge
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Info Card */}
        <div className="bg-white/80 backdrop-blur rounded-2xl shadow-lg border border-green-100 p-4">
          <h4 className="text-sm font-semibold text-black mb-2 flex items-center gap-2">
            <Info size={16} className="text-green-600" />
            Tips
          </h4>
          <ul className="text-xs text-black space-y-1.5">
            <li className="flex items-start gap-2">
              <span className="text-green-500">•</span>
              Click "Pick" then click on the map to set exact coordinates
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500">•</span>
              Select a barangay from the dropdown to link this area
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500">•</span>
              Upload a clear photo showing the current state of the area
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
