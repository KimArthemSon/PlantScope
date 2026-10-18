import { useEffect, useState } from "react";
import {
  Trash2,
  Edit,
  Plus,
  ChevronRight,
  ChevronLeft,
  Info,
  MapPin,
  X,
  Maximize2,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from "lucide-react";
import PlantScopeAlert from "../../../components/alert/PlantScopeAlert";
import Delete_modal from "../../../components/layout/delete_modal";
import LoaderPending from "../../../components/layout/loaderSmall";
import { api } from "@/constant/api";

// 🗺️ Leaflet Imports
import {
  MapContainer,
  TileLayer,
  Marker,
  useMapEvents,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// 📍 Mapbox Token
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

// 📍 Fix Leaflet default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// 📍 Pin + label markers, matching the style used on the main Map page
const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const createMarkerIcon = (type: "barangay" | "selected", labelText = "") => {
  const color = type === "barangay" ? "#EAB308" : "#EF4444";
  const icon =
    type === "barangay"
      ? `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/></svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`;
  const label = escapeHtml(labelText);
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
  ${label ? `<span style="font-size: 11px; font-weight: 600; color: #1f2937; background: rgba(255,255,255,0.9); padding: 2px 6px; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.2); white-space: nowrap;">${label}</span>` : ""}
</div>
`;
  return L.divIcon({
    html,
    className: "custom-marker-icon-small",
    iconSize: [label ? Math.min(200, 28 + labelText.length * 7) : 24, 30],
    iconAnchor: [12, 30],
    popupAnchor: [0, -30],
  });
};

// 🖱️ Handles map clicks to update coordinates
function MapClickHandler({ setBarangay }: any) {
  const map = useMap();
  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      setBarangay((prev: any) => ({ ...prev, lat, lng }));
      map.flyTo(e.latlng, map.getZoom(), { duration: 0.5 });
    },
  });
  return null;
}

// 📏 Fixes map rendering glitches inside animated modals
function MapResizer() {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 100);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

// 🗺️ Shared map contents for the modal map and the full-screen map
function BarangayMapLayers({
  barangay,
  setBarangay,
  existing,
}: {
  barangay: BarangayForm;
  setBarangay: React.Dispatch<React.SetStateAction<BarangayForm>>;
  existing: Barangay[];
}) {
  return (
    <>
      <TileLayer
        url={`https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`}
        tileSize={512}
        zoomOffset={-1}
        attribution='&copy; <a href="https://www.mapbox.com/">Mapbox</a> &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      <MapClickHandler setBarangay={setBarangay} />
      <MapResizer />
      {/* Already-created barangays; marker clicks don't bubble, so they won't move the pin */}
      {existing
        .filter((b) => b.coordinate?.[0] != null && b.coordinate?.[1] != null)
        .map((b) => (
          <Marker
            key={b.barangay_id}
            position={[b.coordinate[0], b.coordinate[1]]}
            icon={createMarkerIcon("barangay", b.name)}
          />
        ))}
      {(barangay.lat !== 0 || barangay.lng !== 0) && (
        <Marker
          position={[barangay.lat, barangay.lng]}
          icon={createMarkerIcon("selected", barangay.name || "New location")}
          zIndexOffset={1000}
        />
      )}
    </>
  );
}

interface Barangay {
  barangay_id: number;
  name: string;
  description: string;
  coordinate: any;
  created_at: string;
}

interface BarangayForm {
  name: string;
  description: string;
  lat: number;
  lng: number;
}

interface Filter {
  search: string;
  entries: number;
  page: number;
  total_page: number;
  sort_by: SortKey;
  order: "asc" | "desc";
}

type SortKey = "name" | "description" | "created_at";

export default function Barangays() {
  const [barangays, setBarangays] = useState<Barangay[]>([]);
  const [barangay, setBarangay] = useState<BarangayForm>({
    name: "",
    description: "",
    lat: 0,
    lng: 0,
  });

  const [filter, setFilter] = useState<Filter>({
    search: "",
    entries: 10,
    page: 1,
    total_page: 1,
    sort_by: "created_at",
    order: "desc",
  });

  const [allBarangays, setAllBarangays] = useState<Barangay[]>([]);
  const [isFullMapOpen, setIsFullMapOpen] = useState(false);
  const [isOpenAddEditModal, setIsOpenAddEditModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form_loading, setForm_loading] = useState(false);
  const [editBarangayId, setEditBarangayId] = useState<number>(0);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [action, setAction] = useState<"Add" | "Edit">("Add");
  const [PSalert, setPSAlert] = useState<{
    type: "success" | "failed" | "error";
    title: string;
    message: string;
  } | null>(null);

  const [barangayIdDelete, setBarangayIdDelete] = useState<number | null>(null);

  const token = localStorage.getItem("token");

  const inputWrapper =
    "flex items-center border border-gray-300 rounded-md " +
    "focus-within:border-green-600 focus-within:ring-1 " +
    "focus-within:ring-green-100 transition-all bg-white";

  const inputField = "flex-1 text-sm p-2 pl-3 outline-none bg-transparent";

  // ------------------ Fetch Barangays ------------------
  const fetchBarangays = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search: filter.search,
        page: filter.page.toString(),
        entries: filter.entries.toString(),
        sort_by: filter.sort_by,
        order: filter.order,
      });

      const response = await fetch(
        api+`api/get_barangays/?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!response.ok) throw new Error("Failed to fetch barangays.");
      const data = await response.json();
      setBarangays(data.data);
      setFilter((prev) => ({ ...prev, total_page: data.total_page }));
    } catch (err) {
      setPSAlert({
        type: "error",
        title: "Failed",
        message: "Failed to load barangays.",
      });
    } finally {
      setLoading(false);
    }
    fetchAllBarangays();
  };

  // Unpaginated list used to plot every existing barangay on the map
  const fetchAllBarangays = async () => {
    try {
      const response = await fetch(api + "api/get_barangay_list/", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return;
      const data = await response.json();
      setAllBarangays(data.data);
    } catch {
      // Map markers are optional; the table still works without them
    }
  };

  useEffect(() => {
    fetchBarangays();
  }, [filter.page, filter.entries, filter.sort_by, filter.order]);

  // Clicking the active column flips the order; a new column starts ascending
  const handleSort = (key: SortKey) => {
    setFilter((prev) => ({
      ...prev,
      sort_by: key,
      order: prev.sort_by === key && prev.order === "asc" ? "desc" : "asc",
      page: 1,
    }));
  };

  const SortableHeader = ({ label, sortKey }: { label: string; sortKey: SortKey }) => (
    <th className="py-3 px-5 text-left text-[.9rem]">
      <button
        type="button"
        onClick={() => handleSort(sortKey)}
        className="flex items-center gap-1.5 cursor-pointer hover:text-green-200"
      >
        {label}
        {filter.sort_by !== sortKey ? (
          <ArrowUpDown size={14} className="opacity-50" />
        ) : filter.order === "asc" ? (
          <ArrowUp size={14} />
        ) : (
          <ArrowDown size={14} />
        )}
      </button>
    </th>
  );

  // Don't reopen straight into the full map next time the modal opens
  useEffect(() => {
    if (!isOpenAddEditModal) setIsFullMapOpen(false);
  }, [isOpenAddEditModal]);

  // Hide the barangay being edited so it only shows as the draggable pin
  const otherBarangays = allBarangays.filter(
    (b) => action === "Add" || b.barangay_id !== editBarangayId,
  );

  const setDelete = (id: number) => {
    setBarangayIdDelete(id);
    setIsDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!barangayIdDelete) return;
    const response = await fetch(
      api+`api/delete_barangay/${barangayIdDelete}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    const data = await response.json();
    if (response.ok) {
      setPSAlert({
        type: "success",
        title: "Deleted",
        message: data.message,
      });
      setIsDeleteModalOpen(false);
      fetchBarangays();
    } else {
      setPSAlert({
        type: "failed",
        title: "Failed",
        message: "Failed to delete barangay.",
      });
      setIsDeleteModalOpen(false);
    }
  };

  const handleSubmit = (e: any) => {
    e.preventDefault();
    action === "Add" ? handleAdd() : handleEdit();
  };

  const handleAdd = async () => {
    try {
      setForm_loading(true);
      if (form_loading) return;

      const res = await fetch(api+"api/create_barangay/", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: barangay.name,
          description: barangay.description,
          coordinate: [barangay.lat, barangay.lng],
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setPSAlert({ type: "error", title: "Error", message: data.error });
        setForm_loading(false);
        return;
      }

      setPSAlert({
        type: "success",
        title: "Success",
        message: "Barangay created successfully!",
      });
      setForm_loading(false);
      setIsOpenAddEditModal(false);
      fetchBarangays();
    } catch (e: any) {
      setPSAlert({ type: "error", title: "Error", message: e.error });
      setForm_loading(false);
    }
  };

  const handleEdit = async () => {
    try {
      setForm_loading(true);
      if (form_loading) return;

      const res = await fetch(
        api+`api/update_barangay/${editBarangayId}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: barangay.name,
            description: barangay.description,
            coordinate: [barangay.lat, barangay.lng],
          }),
        },
      );

      const data = await res.json();
      if (!res.ok) {
        setPSAlert({ type: "error", title: "Error", message: data.error });
        setForm_loading(false);
        return;
      }

      setPSAlert({
        type: "success",
        title: "Success",
        message: "Barangay updated successfully!",
      });
      setForm_loading(false);
      setIsOpenAddEditModal(false);
      fetchBarangays();
    } catch (e: any) {
      setPSAlert({ type: "error", title: "Error", message: e.error });
      setForm_loading(false);
    }
  };

  return (
    <div className="flex min-h-dvh bg-gray-50 justify-center flex-col">
      {PSalert && (
        <PlantScopeAlert
          type={PSalert.type}
          title={PSalert.title}
          message={PSalert.message}
          onClose={() => setPSAlert(null)}
        />
      )}

      <Delete_modal
        setIsDeleteModalOpen={setIsDeleteModalOpen}
        isDeleteModalOpen={isDeleteModalOpen}
        onDelete={handleDelete}
      />

      <main className="flex-1 p-8 flex flex-col items-center">
        {/* Filters */}
        <div className="flex items-center mb-7 gap-4 w-full max-w-406">
          <label>Show entries: </label>
          <select
            value={filter.entries}
            onChange={(e) =>
              setFilter((prev) => ({
                ...prev,
                entries: Number(e.target.value),
                page: 1,
              }))
            }
            className="border border-black p-2 rounded-md text-[.8rem]"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>

          <input
            type="text"
            placeholder="Search Barangays..."
            value={filter.search}
            onChange={(e) =>
              setFilter((prev) => ({
                ...prev,
                search: e.target.value,
                page: 1,
              }))
            }
            onKeyDown={(e) => e.key === "Enter" && fetchBarangays()}
            className="border border-black rounded-md p-2 w-80 text-[.8rem] ml-auto"
          />
          <button
            onClick={() => {
              setIsOpenAddEditModal(true);
              setAction("Add");
              setBarangay({ name: "", description: "", lat: 0, lng: 0 });
            }}
            className="flex items-center justify-center gap-2 bg-[#1a6b44] hover:bg-[#0f4a2f] text-white h-10 px-3 py-2 rounded-lg text-[.8rem] cursor-pointer"
          >
            <Plus size={20} /> Add new Barangay
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto shadow-lg rounded-sm border w-full border-gray-200 max-w-406">
          {loading && <LoaderPending />}
          <table className="relative min-w-full bg-white rounded-sm">
            <thead className="bg-[#0f4a2fe0] text-white">
              <tr>
                <th className="py-3 px-5 text-left text-[.9rem]">No</th>
                <SortableHeader label="Name" sortKey="name" />
                <SortableHeader label="Description" sortKey="description" />
                <th className="py-3 px-5 text-left text-[.9rem]">Coordinate</th>
                <SortableHeader label="Created at" sortKey="created_at" />
                <th className="py-3 px-5 text-left text-[.9rem]">Actions</th>
              </tr>
            </thead>

            <tbody>
              {barangays.length > 0 ? (
                barangays.map((b, index) => (
                  <tr
                    key={b.barangay_id}
                    className={`${index % 2 === 0 ? "" : "bg-[#0F4A2F0D]"} transition`}
                  >
                    <td className="py-3 px-5 text-[.9rem]">
                      {index + 1 + (filter.page - 1) * filter.entries}
                    </td>
                    <td className="py-3 px-5">{b.name}</td>
                    <td className="py-3 px-5">{b.description}</td>
                    <td className="py-3 px-5 text-[.85rem]">
                      Lat: {b.coordinate?.[0]?.toFixed(5)}, Lng: {b.coordinate?.[1]?.toFixed(5)}
                    </td>
                    <td className="py-3 px-5 text-[.9rem]">{b.created_at}</td>

                    <td className="py-3 px-5">
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setIsOpenAddEditModal(true);
                            setEditBarangayId(b.barangay_id);
                            setAction("Edit");

                            setBarangay({
                              name: b.name,
                              description: b.description,
                              lat: b.coordinate?.[0] ?? 0,
                              lng: b.coordinate?.[1] ?? 0,
                            });
                          }}
                          className="text-black px-3 py-1 rounded-md flex items-center gap-1 cursor-pointer"
                        >
                          <Edit size={18} />
                        </button>

                        <button
                          onClick={() => setDelete(b.barangay_id)}
                          className="text-red-500 px-3 py-1 rounded-md flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="text-center py-5 text-gray-500 italic"
                  >
                    No Barangays found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center gap-1 mt-5 w-full max-w-406">
          <button
            disabled={filter.page <= 1}
            onClick={() =>
              setFilter((prev) => ({ ...prev, page: prev.page - 1 }))
            }
            className="px-2 py-1 border rounded-md text-gray-700 hover:bg-gray-100 ml-auto cursor-pointer"
          >
            <ChevronLeft size={19} />
          </button>

          {Array.from({ length: filter.total_page }, (_, i) => i + 1).map(
            (p) => (
              <button
                key={p}
                onClick={() => setFilter((prev) => ({ ...prev, page: p }))}
                className={`px-2 py-1 border rounded-md cursor-pointer text-[.8rem] ${
                  p === filter.page
                    ? "bg-green-600 text-white"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                {p}
              </button>
            ),
          )}

          <button
            disabled={filter.page >= filter.total_page}
            onClick={() =>
              setFilter((prev) => ({ ...prev, page: prev.page + 1 }))
            }
            className="px-2 py-1 border rounded-md text-gray-700 hover:bg-gray-100 cursor-pointer"
          >
            <ChevronRight size={19} />
          </button>
        </div>
      </main>

      {/* Modal */}
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 transition-opacity duration-300 ${
          isOpenAddEditModal
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
      >
        {form_loading && <LoaderPending />}

        <div
          className={`bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[85vh] overflow-hidden
  transform transition-all duration-300
  ${isOpenAddEditModal ? "scale-100 opacity-100" : "scale-95 opacity-0"}`}
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between bg-green-600 px-5 py-3">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-lg">
                {action === "Add" ? (
                  <Plus size={20} className="text-white" />
                ) : (
                  <Edit size={20} className="text-white" />
                )}
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">
                  {action} Barangay
                </h2>
                <p className="text-green-100 text-xs">
                  {action === "Add" ? "Create new barangay" : "Update barangay"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpenAddEditModal(false)}
              className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-md transition-all"
            >
              <X size={20} />
            </button>
          </div>

          {/* Modal Body */}
          <form onSubmit={handleSubmit}>
            <div className="flex flex-col lg:flex-row max-h-[calc(85vh-110px)]">
              {/* Left Column - Form Fields */}
              <div className="flex-1 p-4 overflow-y-auto">
                <div className="space-y-3">
                  {/* Barangay Name */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Barangay Name <span className="text-red-500">*</span>
                    </label>
                    <div className={inputWrapper}>
                      <Info size={16} className="ml-2 text-green-600" />
                      <input
                        required
                        type="text"
                        className={inputField}
                        placeholder="e.g., Barangay San Miguel"
                        value={barangay.name}
                        onChange={(e) =>
                          setBarangay((prev) => ({ ...prev, name: e.target.value }))
                        }
                      />
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Description <span className="text-red-500">*</span>
                    </label>
                    <div className={inputWrapper}>
                      <textarea
                        required
                        className="w-full min-h-20 outline-0 p-2 text-sm resize-none bg-transparent"
                        placeholder="Enter description..."
                        value={barangay.description}
                        onChange={(e) =>
                          setBarangay((prev) => ({
                            ...prev,
                            description: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>

                  {/* Coordinates Section */}
                  <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                    <div className="flex items-center gap-1.5 mb-2">
                      <MapPin size={14} className="text-green-600" />
                      <h3 className="font-semibold text-gray-800 text-xs">
                        Coordinate Information
                      </h3>
                    </div>
                    <p className="text-xs text-gray-600 mb-2">
                      Click map or enter manually
                    </p>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Latitude
                        </label>
                        <div className={inputWrapper}>
                          <input
                            required
                            type="number"
                            step="any"
                            className={inputField}
                            placeholder="11.007"
                            value={barangay.lat || ""}
                            onChange={(e) =>
                              setBarangay((prev) => ({
                                ...prev,
                                lat: Number(e.target.value),
                              }))
                            }
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Longitude
                        </label>
                        <div className={inputWrapper}>
                          <input
                            required
                            type="number"
                            step="any"
                            className={inputField}
                            placeholder="124.602"
                            value={barangay.lng || ""}
                            onChange={(e) =>
                              setBarangay((prev) => ({
                                ...prev,
                                lng: Number(e.target.value),
                              }))
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Map */}
              <div className="lg:w-92 bg-gray-50 border-l border-gray-200 flex flex-col">
                <div className="p-3 bg-white border-b border-gray-200 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-800 text-xs flex items-center gap-1.5">
                    <MapPin size={14} className="text-green-600" />
                    Location Map
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsFullMapOpen(true)}
                    className="flex items-center gap-1 text-xs font-medium text-green-700 hover:text-green-800 hover:bg-green-50 px-2 py-1 rounded-md cursor-pointer"
                  >
                    <Maximize2 size={13} />
                    View full map
                  </button>
                </div>
                <div className="flex-1 p-3">
                  <div className="h-full min-h-64 rounded-md overflow-hidden border border-gray-300">
                    {/* ✅ Only render map when modal is open */}
                    {isOpenAddEditModal && !isFullMapOpen && (
                      <MapContainer
                        center={[barangay.lat || 11.007, barangay.lng || 124.602]}
                        zoom={barangay.lat && barangay.lng ? 15 : 13}
                        style={{ height: "100%", width: "100%" }}
                        key={`map-${isOpenAddEditModal}-${editBarangayId}`}
                        scrollWheelZoom={true}
                      >
                        <BarangayMapLayers
                          barangay={barangay}
                          setBarangay={setBarangay}
                          existing={otherBarangays}
                        />
                      </MapContainer>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex gap-2 px-4 py-3 bg-gray-50 border-t border-gray-200">
              <button
                type="submit"
                className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-semibold transition-colors flex items-center justify-center gap-1.5"
              >
                {action === "Add" ? (
                  <>
                    <Plus size={16} />
                    Create
                  </>
                ) : (
                  <>
                    <Edit size={16} />
                    Update
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setIsOpenAddEditModal(false)}
                className="flex-1 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-md text-sm font-semibold transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Full-screen Map */}
      {isOpenAddEditModal && isFullMapOpen && (
        <div className="fixed inset-0 z-60 flex flex-col bg-black/70 p-6">
          <div className="flex items-center justify-between bg-green-600 px-5 py-3 rounded-t-lg">
            <div className="text-white">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <MapPin size={18} /> Location Map
              </h2>
              <p className="text-green-100 text-xs">
                Click the map to set the location ·{" "}
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 border border-white align-middle" />{" "}
                selected ·{" "}
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-yellow-500 border border-white align-middle" />{" "}
                existing barangays
                {(barangay.lat !== 0 || barangay.lng !== 0) &&
                  ` · Selected: ${barangay.lat.toFixed(5)}, ${barangay.lng.toFixed(5)}`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsFullMapOpen(false)}
              className="bg-white text-green-700 hover:bg-green-50 px-4 py-2 rounded-md text-sm font-semibold cursor-pointer"
            >
              Done
            </button>
          </div>
          <div className="flex-1 rounded-b-lg overflow-hidden">
            <MapContainer
              center={[barangay.lat || 11.007, barangay.lng || 124.602]}
              zoom={barangay.lat && barangay.lng ? 15 : 13}
              style={{ height: "100%", width: "100%" }}
              scrollWheelZoom={true}
            >
              <BarangayMapLayers
                barangay={barangay}
                setBarangay={setBarangay}
                existing={otherBarangays}
              />
            </MapContainer>
          </div>
        </div>
      )}
    </div>
  );
}