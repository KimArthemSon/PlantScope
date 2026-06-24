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
} from "lucide-react";
import PlantScopeAlert from "../../../components/alert/PlantScopeAlert";
import Delete_modal from "../../../components/layout/delete_modal";
import LoaderPending from "../../../components/layout/loaderSmall";
import { api } from "@/constant/api";

// 🗺️ Leaflet Imports
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// 📍 Fix Leaflet default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// 🖱️ Handles map clicks to update coordinates
function MapClickHandler({ setBarangay }: any) {
  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      setBarangay((prev: any) => ({ ...prev, lat, lng }));
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
}

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
  });

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
  };

  useEffect(() => {
    fetchBarangays();
  }, [filter.page, filter.entries]);

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
                <th className="py-3 px-5 text-left text-[.9rem]">Name</th>
                <th className="py-3 px-5 text-left text-[.9rem]">
                  Description
                </th>
                <th className="py-3 px-5 text-left text-[.9rem]">Coordinate</th>
                <th className="py-3 px-5 text-left text-[.9rem]">Created at</th>
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
                <div className="p-3 bg-white border-b border-gray-200">
                  <h3 className="font-semibold text-gray-800 text-xs flex items-center gap-1.5">
                    <MapPin size={14} className="text-green-600" />
                    Location Map
                  </h3>
                </div>
                <div className="flex-1 p-3">
                  <div className="h-full min-h-64 rounded-md overflow-hidden border border-gray-300">
                    <MapContainer
                      center={[barangay.lat || 11.007, barangay.lng || 124.602]}
                      zoom={barangay.lat && barangay.lng ? 15 : 13}
                      style={{ height: "100%", width: "100%" }}
                      key={`map-${isOpenAddEditModal}-${editBarangayId}-${barangay.lat}-${barangay.lng}`}
                      scrollWheelZoom={true} // ✅ Enabled scroll wheel zoom
                    >
                      <TileLayer url="http://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}" />
                      <MapClickHandler setBarangay={setBarangay} />
                      <MapResizer />
                      {(barangay.lat !== 0 || barangay.lng !== 0) && (
                        <Marker position={[barangay.lat, barangay.lng]} />
                      )}
                    </MapContainer>
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
    </div>
  );
}