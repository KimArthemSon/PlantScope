import { useEffect, useState } from "react";
import {
  Trash2,
  Edit,
  Plus,
  ChevronRight,
  ChevronLeft,
  User,
  Eye,
  CheckCircle,
  Clock,
} from "lucide-react";
import PlantScopeAlert from "@/components/alert/PlantScopeAlert";
import Delete_modal from "@/components/layout/delete_modal";
import LoaderPending from "@/components/layout/loaderSmall";
import { useNavigate } from "react-router-dom";
import { useUserRole } from "@/hooks/authorization";
import { api } from "@/constant/api.ts";
// ─────────────────────────────────────────────────────────────
// Types & Interfaces (UPDATED to new backend structure)
// ─────────────────────────────────────────────────────────────
interface Barangay {
  barangay_id: number;
  name: string;
}

// ✅ Stripped down to match the new minimal Reforestation Area model
interface ReforestationArea {
  reforestation_area_id: number;
  name: string;
  description: string;
  coordinate: any;
  barangay: {
    barangay_id: number;
    name: string;
  } | null;
  created_at: string;
  site_stats?: {
    total: number;
    accepted_verified: number;
    accepted: number;
    pending: number;
  };
}

interface Filter {
  search: string;
  entries: number;
  page: number;
  total_page: number;
  barangay_id: string;
}

const DEFAULT_FILTER: Omit<Filter, "total_page"> = {
  search: "",
  entries: 10,
  page: 1,
  barangay_id: "All",
};

export default function Reforestation_areas() {
  const [areas, setAreas] = useState<ReforestationArea[]>([]);
  const [barangays, setBarangays] = useState<Barangay[]>([]);

  const [filter, setFilter] = useState<Filter>({
    ...DEFAULT_FILTER,
    total_page: 1,
  });

  const [loading, setLoading] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [PSalert, setPSAlert] = useState<{
    type: "success" | "failed" | "error";
    title: string;
    message: string;
  } | null>(null);

  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const { userRole } = useUserRole();
  const [useruserRole, setUseruserRole] = useState("");

  useEffect(() => {
    if (userRole === "treeGrowers" || userRole === "CityENROHead") {
      setUseruserRole("");
      return;
    }
    if (userRole === "GISSpecialist") {
      setUseruserRole("/GISS");
      return;
    }
    if (userRole === "DataManager") {
      setUseruserRole("/DataManager");
      return;
    }
  }, [userRole]);

  // ── Fetch Barangays ─────────────────────────────────────────
  useEffect(() => {
    const fetchBarangays = async () => {
      try {
        const res = await fetch(
          api+"api/get_barangay_list/",
          { headers: { Authorization: `Bearer ${token}` } },
        );
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

  // ── Fetch Areas ────────────────────────────────────────────
  const fetchAreas = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search: filter.search,
        page: filter.page.toString(),
        entries: filter.entries.toString(),
        ...(filter.barangay_id !== "All" && {
          barangay_id: filter.barangay_id,
        }),
      });
      const response = await fetch(
        api+`api/get_reforestation_areas/?${params}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!response.ok) throw new Error("Failed");
      const data = await response.json();
      setAreas(data.data);
      setFilter((prev) => ({ ...prev, total_page: data.total_page }));
    } catch {
      setPSAlert({
        type: "error",
        title: "Error",
        message: "Failed to load reforestation areas.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAreas();
  }, [filter.page, filter.entries, filter.barangay_id]);

  // ── Delete ─────────────────────────────────────────────────
  const setDelete = (id: number) => {
    setDeleteId(id);
    setIsDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const response = await fetch(
        api+`api/delete_reforestation_areas/${deleteId}/`,
        { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
      );
      const data = await response.json();
      if (response.ok) {
        setPSAlert({
          type: "success",
          title: "Deleted",
          message: data.message,
        });
        fetchAreas();
      } else {
        setPSAlert({
          type: "failed",
          title: "Failed",
          message: data.message || "Delete failed",
        });
      }
    } catch {
      setPSAlert({
        type: "error",
        title: "Error",
        message: "Something went wrong.",
      });
    }
    setIsDeleteModalOpen(false);
  };

  // ── Render ─────────────────────────────────────────────────
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
        {/* ── TOOLBAR ───────────────────────────────────────── */}
        <div className="flex items-center flex-wrap mb-4 gap-3">
          {/* Entries */}
          <label className="text-sm text-gray-600">Show:</label>
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

          {/* ✅ Barangay Filter (Kept simple in the toolbar) */}
          <label className="text-sm text-gray-600">Barangay:</label>
          <select
            value={filter.barangay_id}
            onChange={(e) =>
              setFilter((prev) => ({
                ...prev,
                barangay_id: e.target.value,
                page: 1,
              }))
            }
            className="border border-gray-300 p-2 rounded-lg text-[.8rem] focus:outline-none focus:ring-2 focus:ring-green-400"
          >
            <option value="All">All</option>
            {barangays.map((b) => (
              <option key={b.barangay_id} value={b.barangay_id}>
                {b.name}
              </option>
            ))}
          </select>

          {/* Search */}
          <input
            type="text"
            placeholder="Search reforestation areas..."
            value={filter.search}
            onChange={(e) =>
              setFilter((prev) => ({
                ...prev,
                search: e.target.value,
                page: 1,
              }))
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") fetchAreas();
            }}
            className="border border-black rounded-md p-2 w-80 text-[.8rem] ml-auto"
          />
          
          {userRole !== "DataManager" && (
            <button
              onClick={() => navigate(`${useruserRole}/map`)}
              className="flex items-center gap-2 bg-[#0f4a2f] text-white h-10 px-3 py-2 rounded-lg text-[.8rem] cursor-pointer hover:bg-[#0a3321] transition-colors"
            >
              <Plus size={20} /> Add new area
            </button>
          )}
        </div>

        {/* ── TABLE ─────────────────────────────────────────── */}
        <div className="overflow-x-auto shadow-lg border border-gray-200">
          {loading && <LoaderPending />}
          <table className="min-w-full bg-white">
            <thead className="bg-[#0f4a2fe0] text-white">
              <tr>
                <th className="py-3 px-5 text-left">No</th>
                <th className="py-3 px-5 text-left">Name</th>
                <th className="py-3 px-5 text-left">Barangay</th>
                <th className="py-3 px-5 text-left">Description</th>
                <th className="py-3 px-5 text-left">Sites</th>
                <th className="py-3 px-5 text-left">Created At</th>
                <th className="py-3 px-5 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {areas.length > 0 ? (
                areas.map((area, index) => (
                  <tr
                    key={area.reforestation_area_id}
                    className={`${index % 2 ? "bg-[#0F4A2F0D]" : ""}`}
                  >
                    <td className="py-3 px-5">
                      {index + 1 + (filter.page - 1) * filter.entries}
                    </td>
                    <td className="py-3 px-5 font-medium">{area.name}</td>
                    <td className="py-3 px-5">
                      {area.barangay?.name ?? (
                        <span className="text-gray-400 italic">N/A</span>
                      )}
                    </td>
                    <td className="py-3 px-5 text-sm text-gray-600 max-w-xs truncate">
                      {area.description || (
                        <span className="text-gray-400 italic">No description</span>
                      )}
                    </td>

                    {/* ✅ Sites Column */}
                    <td className="py-3 px-5">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1">
                          <CheckCircle size={12} className="text-green-600" />
                          <span className="text-xs font-bold text-green-700">
                            {area.site_stats?.accepted_verified ?? 0}
                          </span>
                          <span className="text-[10px] text-gray-500">verified</span>
                        </div>
                        <div className="flex gap-2 text-[10px]">
                          <span className="flex items-center gap-0.5 text-blue-600">
                            <CheckCircle size={10} />
                            {area.site_stats?.accepted ?? 0}
                          </span>
                          <span className="flex items-center gap-0.5 text-amber-600">
                            <Clock size={10} />
                            {area.site_stats?.pending ?? 0}
                          </span>
                          <span className="text-gray-400">
                            / {area.site_stats?.total ?? 0}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-5 text-sm">{area.created_at}</td>

                    {/* ✅ ACTIONS COLUMN - LOGIC KEPT THE SAME */}
                    <td className="py-3 px-5">
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            navigate(
                              `${useruserRole}/maintenance/view_reforestation_area/${area.reforestation_area_id}`,
                            )
                          }
                          className="cursor-pointer"
                          title="View Details"
                        >
                          <Eye size={18} />
                        </button>
                        {userRole !== "DataManager" && (
                          <button
                            onClick={() =>
                              navigate(
                                `${useruserRole}/assign_onsite_inpsector/${area.reforestation_area_id}`,
                              )
                            }
                            className="cursor-pointer"
                            title="Assign Inspector"
                          >
                            <User size={18} />
                          </button>
                        )}
                        {userRole !== "GISSpecialist" && (
                          <button
                            onClick={() =>
                              navigate(
                                `${useruserRole}/maintenance/reforestation_area_form/${area.reforestation_area_id}`,
                              )
                            }
                            className="cursor-pointer"
                            title="Edit Area"
                          >
                            <Edit size={18} />
                          </button>
                        )}
                        {userRole !== "DataManager" && (
                          <button
                            onClick={() =>
                              setDelete(area.reforestation_area_id)
                            }
                            className="text-red-500 cursor-pointer"
                            title="Delete Area"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={7}
                    className="text-center py-5 text-gray-500 italic"
                  >
                    No areas found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── PAGINATION ────────────────────────────────────── */}
        <div className="flex items-center gap-1 mt-5">
          <button
            disabled={filter.page <= 1}
            onClick={() =>
              setFilter((prev) => ({ ...prev, page: prev.page - 1 }))
            }
            className="px-2 py-1 border rounded-md ml-auto"
          >
            <ChevronLeft size={19} />
          </button>
          {Array.from({ length: filter.total_page }, (_, i) => i + 1).map(
            (p) => (
              <button
                key={p}
                onClick={() => setFilter((prev) => ({ ...prev, page: p }))}
                className={`px-2 py-1 border rounded-md text-[.8rem] ${
                  p === filter.page ? "bg-green-600 text-white" : ""
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
            className="px-2 py-1 border rounded-md"
          >
            <ChevronRight size={19} />
          </button>
        </div>
      </main>
    </div>
  );
}