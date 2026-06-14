import { useEffect, useState } from "react";
import { Trash2, Edit, Plus, ChevronRight, ChevronLeft, X } from "lucide-react";
import PlantScopeAlert from "@/components/alert/PlantScopeAlert";
import Delete_modal from "@/components/layout/delete_modal";
import { useNavigate } from "react-router-dom";
import LoaderPending from "@/components/layout/loaderSmall";
import { useUserRole } from "@/hooks/authorization";
import { api } from "@/constant/api";

interface HazardArea {
  hazard_area_id: number;
  name: string;
  hazard_type: string;
  barangay_id: number | null;
  polygon: any;
  description: string;
  created_at: string;
  updated_at: string;
}

interface Filter {
  search: string;
  entries: number;
  page: number;
  total_page: number;
  hazard_type: string;
  barangay_id: number | "";
}

interface Barangay {
  barangay_id: number;
  name: string;
}

// Fixed hazard types matching your Django backend choices
const HAZARD_TYPES = [
  { value: "LANDSLIDE", label: "Landslide" },
  { value: "FLOOD", label: "Flood" },
  { value: "EARTHQUAKE", label: "Earthquake" },
  { value: "VOLCANIC", label: "Volcanic Hazard" },
  { value: "STORM_SURGE", label: "Storm Surge" },
  { value: "LIQUEFACTION", label: "Soil Liquefaction" },
  { value: "COASTAL_EROSION", label: "Coastal Erosion" },
  { value: "OTHER", label: "Other" },
];

export default function Hazard_areas() {
  const [hazardAreas, setHazardAreas] = useState<HazardArea[]>([]);
  const [filter, setFilter] = useState<Filter>({
    search: "",
    entries: 10,
    page: 1,
    total_page: 1,
    hazard_type: "",
    barangay_id: "",
  });
  const [barangayList, setBarangayList] = useState<Barangay[]>([]);
  const [loading, setLoading] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [PSalert, setPSAlert] = useState<{
    type: "success" | "failed" | "error";
    title: string;
    message: string;
  } | null>(null);
  const [hazardAreaIdDelete, setHazardAreaIdDelete] = useState<number | null>(
    null
  );
  const navigate = useNavigate();

  const { userRole } = useUserRole();
  const [useruserRole, setUseruserRole] = useState("");
  const token = localStorage.getItem("token");

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

  // Fetch filter options on mount
  useEffect(() => {
    async function fetchOptions() {
      try {
        const brRes = await fetch(`${api}api/get_barangay_list/`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const brData = await brRes.json();
        if (brRes.ok && brData.data) setBarangayList(brData.data);
      } catch {
        // silently fail — filters will just be empty
      }
    }
    fetchOptions();
  }, []);

  const fetchHazardAreas = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search: filter.search,
        page: filter.page.toString(),
        entries: filter.entries.toString(),
      });
      if (filter.hazard_type !== "")
        params.append("hazard_type", filter.hazard_type);
      if (filter.barangay_id !== "")
        params.append("barangay_id", filter.barangay_id.toString());

      const response = await fetch(
        `${api}api/get_hazard_areas/?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) throw new Error("Failed to fetch hazard areas");
      const data = await response.json();
      setHazardAreas(data.data);
      setFilter((prev) => ({ ...prev, total_page: data.total_page }));
    } catch {
      setPSAlert({
        type: "error",
        title: "Failed",
        message: "Failed to load hazard areas.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHazardAreas();
  }, [filter.page, filter.entries, filter.hazard_type, filter.barangay_id]);

  const activeFilterCount =
    (filter.hazard_type !== "" ? 1 : 0) + (filter.barangay_id !== "" ? 1 : 0);

  const setDelete = (id: number) => {
    setHazardAreaIdDelete(id);
    setIsDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!hazardAreaIdDelete) return;
    const response = await fetch(
      `${api}api/delete_hazard_area/${hazardAreaIdDelete}/`,
      { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await response.json();
    if (response.ok) {
      setPSAlert({ type: "success", title: "Deleted", message: data.message });
      setIsDeleteModalOpen(false);
      fetchHazardAreas();
    } else {
      setPSAlert({
        type: "failed",
        title: "Failed",
        message: data.message || "Failed to delete",
      });
      setIsDeleteModalOpen(false);
    }
  };

  // Helper to resolve barangay name from the fetched list
  const getBarangayName = (id: number | null) => {
    if (!id) return "N/A (City-wide)";
    const b = barangayList.find((b) => b.barangay_id === id);
    return b ? b.name : "Unknown";
  };

  // Helper to convert backend key (e.g., 'LANDSLIDE') to readable label
  const getHazardTypeLabel = (value: string) => {
    const type = HAZARD_TYPES.find((t) => t.value === value);
    return type ? type.label : value;
  };

  return (
    <div className="flex min-h-dvh bg-gray-50 justify-center items-center flex-col">
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

      <main className="flex-1 p-8 w-full max-w-609">
        {/* ── Top bar: entries + search + add ── */}
        <div className="flex items-center mb-3 gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 whitespace-nowrap">
              Show entries:
            </label>
            <select
              value={filter.entries}
              onChange={(e) =>
                setFilter((prev) => ({
                  ...prev,
                  entries: Number(e.target.value),
                  page: 1,
                }))
              }
              className="border border-gray-300 p-2 rounded-md text-[.8rem]"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Filter by:
          </span>

          {/* Hazard Type Filter */}
          <div className="relative">
            <select
              value={filter.hazard_type}
              onChange={(e) =>
                setFilter((prev) => ({
                  ...prev,
                  hazard_type: e.target.value,
                  page: 1,
                }))
              }
              className={`border rounded-lg px-3 py-1.5 text-[.8rem] pr-8 appearance-none cursor-pointer transition-colors ${
                filter.hazard_type !== ""
                  ? "border-red-500 bg-red-50 text-red-800 font-medium"
                  : "border-gray-300 text-gray-600"
              }`}
            >
              <option value="">All Hazard Types</option>
              {HAZARD_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            {filter.hazard_type !== "" && (
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 text-red-600 hover:text-red-800"
                onClick={() =>
                  setFilter((prev) => ({
                    ...prev,
                    hazard_type: "",
                    page: 1,
                  }))
                }
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Barangay Filter */}
          <div className="relative">
            <select
              value={filter.barangay_id}
              onChange={(e) =>
                setFilter((prev) => ({
                  ...prev,
                  barangay_id:
                    e.target.value === "" ? "" : Number(e.target.value),
                  page: 1,
                }))
              }
              className={`border rounded-lg px-3 py-1.5 text-[.8rem] pr-8 appearance-none cursor-pointer transition-colors ${
                filter.barangay_id !== ""
                  ? "border-red-500 bg-red-50 text-red-800 font-medium"
                  : "border-gray-300 text-gray-600"
              }`}
            >
              <option value="">All Barangays</option>
              {barangayList.map((b) => (
                <option key={b.barangay_id} value={b.barangay_id}>
                  {b.name}
                </option>
              ))}
            </select>
            {filter.barangay_id !== "" && (
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 text-red-600 hover:text-red-800"
                onClick={() =>
                  setFilter((prev) => ({ ...prev, barangay_id: "", page: 1 }))
                }
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Clear all active filters */}
          {activeFilterCount > 0 && (
            <button
              onClick={() =>
                setFilter((prev) => ({
                  ...prev,
                  hazard_type: "",
                  barangay_id: "",
                  page: 1,
                }))
              }
              className="text-[.75rem] text-red-500 hover:text-red-700 flex items-center gap-1 font-medium"
            >
              <X size={12} /> Clear filters ({activeFilterCount})
            </button>
          )}
          <input
            type="text"
            placeholder="Search hazard areas..."
            value={filter.search}
            onChange={(e) =>
              setFilter((prev) => ({
                ...prev,
                search: e.target.value,
                page: 1,
              }))
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") fetchHazardAreas();
            }}
            className="border border-gray-300 rounded-md p-2 w-72 text-[.8rem] ml-auto"
          />
          <button
            onClick={() =>
              navigate(`${useruserRole}/maintenance/hazard_area_form/`)
            }
            className="flex items-center justify-center gap-2 bg-[#1a6b44] hover:bg-[#0f4a2f] text-white h-10 px-3 py-2 rounded-lg text-[.8rem] cursor-pointer whitespace-nowrap"
          >
            <Plus size={18} /> Add hazard area
          </button>
        </div>

        {/* ── Table ── */}
        <div className="overflow-x-auto shadow-lg rounded-sm border border-gray-200">
          {loading && <LoaderPending />}
          <table className="relative min-w-full bg-white rounded-sm">
            <thead className="bg-[#0f4a2fe0] text-white">
              <tr>
                <th className="py-3 px-5 text-left text-[.9rem]">No</th>
                <th className="py-3 px-5 text-left text-[.9rem]">Name</th>
                <th className="py-3 px-5 text-left text-[.9rem]">
                  Hazard Type
                </th>
                <th className="py-3 px-5 text-left text-[.9rem]">Barangay</th>
                <th className="py-3 px-5 text-left text-[.9rem]">
                  Description
                </th>
                <th className="py-3 px-5 text-left text-[.9rem]">Created At</th>
                <th className="py-3 px-5 text-left text-[.9rem]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {hazardAreas.length > 0 ? (
                hazardAreas.map((area, index) => (
                  <tr
                    key={area.hazard_area_id}
                    className={`${
                      index % 2 === 0 ? "" : "bg-[#0F4A2F0D]"
                    } transition`}
                  >
                    <td className="py-3 px-5 text-[.9rem]">
                      {index + 1 + (filter.page - 1) * filter.entries}
                    </td>
                    <td className="py-3 px-5 text-[.9rem] font-medium">
                      {area.name}
                    </td>
                    <td className="py-3 px-5 text-[.9rem]">
                      {/* Red badge for hazard types */}
                      <span className="bg-red-100 text-red-800 text-[.75rem] font-medium px-2 py-0.5 rounded-full">
                        {getHazardTypeLabel(area.hazard_type)}
                      </span>
                    </td>
                    <td className="py-3 px-5 text-[.9rem]">
                      {getBarangayName(area.barangay_id)}
                    </td>
                    <td className="py-3 px-5 text-[.9rem] break-words max-w-60">
                      {area.description}
                    </td>
                    <td className="py-3 px-5 text-[.9rem] whitespace-nowrap">
                      {area.created_at}
                    </td>
                    <td className="py-3 px-5">
                      <div className="flex gap-1">
                        <button
                          onClick={() =>
                            navigate(
                              `${useruserRole}/maintenance/hazard_area_form/${area.hazard_area_id}`
                            )
                          }
                          className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 cursor-pointer transition-colors"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => setDelete(area.hazard_area_id)}
                          className="p-2 rounded-lg hover:bg-red-50 text-red-500 cursor-pointer transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={7}
                    className="text-center py-8 text-gray-400 italic text-sm"
                  >
                    No hazard areas found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        <div className="flex items-center gap-1 mt-5 w-full">
          <button
            disabled={filter.page <= 1}
            onClick={() =>
              setFilter((prev) => ({ ...prev, page: prev.page - 1 }))
            }
            className="px-2 py-1 border rounded-md text-gray-700 hover:bg-gray-100 ml-auto cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
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
                    ? "bg-red-600 text-white border-red-600" // Red theme for active page
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                {p}
              </button>
            )
          )}

          <button
            disabled={filter.page >= filter.total_page}
            onClick={() =>
              setFilter((prev) => ({ ...prev, page: prev.page + 1 }))
            }
            className="px-2 py-1 border rounded-md text-gray-700 hover:bg-gray-100 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronRight size={19} />
          </button>
        </div>
      </main>
    </div>
  );
}