import { useEffect, useState, useRef } from "react";
import {
  Trash2,
  Edit,
  Plus,
  ChevronRight,
  ChevronLeft,
  User,
  VerifiedIcon,
  Leaf,
  SlidersHorizontal,
  X,
  RotateCcw,
} from "lucide-react";
import PlantScopeAlert from "@/components/alert/PlantScopeAlert";
import Delete_modal from "@/components/layout/delete_modal";
import LoaderPending from "@/components/layout/loaderSmall";
import { useNavigate } from "react-router-dom";
import { useUserRole } from "@/hooks/authorization";

// ─────────────────────────────────────────────────────────────
// Types & Interfaces
// ─────────────────────────────────────────────────────────────
interface Barangay {
  barangay_id: number;
  name: string;
}

interface LandClassification {
  land_classification_id: number;
  name: string;
}

interface ReforestationArea {
  reforestation_area_id: number;
  name: string;
  legality: string;
  safety: string;
  polygon_coordinate: any;
  coordinate: any;
  barangay: {
    barangay_id: number;
    name: string;
  };
  land_classification: {
    land_classification_id: number;
    name: string;
  } | null;
  pre_assessment_status: string;
  description: string;
  area_img: string | null;
  created_at: string;
}

interface Filter {
  search: string;
  entries: number;
  page: number;
  total_page: number;
  legality: string;
  safety: string;
  pre_assessment_status: string;
  barangay_id: string;
  land_classification_id: string;
}

const DEFAULT_FILTER: Omit<Filter, "total_page"> = {
  search: "",
  entries: 10,
  page: 1,
  legality: "All",
  safety: "All",
  pre_assessment_status: "All",
  barangay_id: "All",
  land_classification_id: "All",
};

// ─────────────────────────────────────────────────────────────
// Helper: count active (non-default) filters
// ─────────────────────────────────────────────────────────────
function countActiveFilters(filter: Filter): number {
  let count = 0;
  if (filter.legality !== "All") count++;
  if (filter.safety !== "All") count++;
  if (filter.pre_assessment_status !== "All") count++;
  if (filter.barangay_id !== "All") count++;
  if (filter.land_classification_id !== "All") count++;
  return count;
}

export default function Reforestation_areas() {
  const [areas, setAreas] = useState<ReforestationArea[]>([]);
  const [barangays, setBarangays] = useState<Barangay[]>([]);
  const [landClassifications, setLandClassifications] = useState<LandClassification[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const filterPanelRef = useRef<HTMLDivElement>(null);

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

  // ── Close panel on outside click ──────────────────────────
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        filterPanelRef.current &&
        !filterPanelRef.current.contains(e.target as Node)
      ) {
        setShowFilters(false);
      }
    };
    if (showFilters) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showFilters]);

  // ── Fetch Barangays & Land Classifications ─────────────────
  useEffect(() => {
    const fetchBarangays = async () => {
      try {
        const res = await fetch("http://127.0.0.1:8000/api/get_barangay_list/", {
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
    const fetchLandClassifications = async () => {
      try {
        const res = await fetch(
          "http://127.0.0.1:8000/api/get_land_classifications_list/",
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (res.ok) {
          const data = await res.json();
          setLandClassifications(data.data || []);
        }
      } catch (err) {
        console.error("Failed to fetch land classifications:", err);
      }
    };
    fetchBarangays();
    fetchLandClassifications();
  }, [token]);

  // ── Fetch Areas ────────────────────────────────────────────
  const fetchAreas = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search: filter.search,
        page: filter.page.toString(),
        entries: filter.entries.toString(),
        legality: filter.legality,
        safety: filter.safety,
        pre_assessment_status: filter.pre_assessment_status,
        barangay_id: filter.barangay_id,
        land_classification_id: filter.land_classification_id,
      });
      const response = await fetch(
        `http://127.0.0.1:8000/api/get_reforestation_areas/?${params}`,
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
  }, [
    filter.page,
    filter.entries,
    filter.legality,
    filter.safety,
    filter.pre_assessment_status,
    filter.barangay_id,
    filter.land_classification_id,
  ]);

  // ── Delete ─────────────────────────────────────────────────
  const setDelete = (id: number) => {
    setDeleteId(id);
    setIsDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const response = await fetch(
        `http://127.0.0.1:8000/api/delete_reforestation_areas/${deleteId}/`,
        { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
      );
      const data = await response.json();
      if (response.ok) {
        setPSAlert({ type: "success", title: "Deleted", message: data.message });
        fetchAreas();
      } else {
        setPSAlert({
          type: "failed",
          title: "Failed",
          message: data.message || "Delete failed",
        });
      }
    } catch {
      setPSAlert({ type: "error", title: "Error", message: "Something went wrong." });
    }
    setIsDeleteModalOpen(false);
  };

  // ── Reset all filters ──────────────────────────────────────
  const resetFilters = () => {
    setFilter((prev) => ({ ...prev, ...DEFAULT_FILTER, total_page: prev.total_page }));
  };

  const activeFilterCount = countActiveFilters(filter);

  // ── Render ─────────────────────────────────────────────────
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

      {/* ── HEADER ────────────────────────────────────────── */}
      <header className="bg-gradient-to-r from-[#0F4A2F] to-[#1a6b44] text-white py-3 px-6 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-center">
          <div className="flex items-center gap-3 mb-2">
            <Leaf size={32} className="text-green-300" />
            <h1 className="text-3xl md:text-4xl font-bold">
              Reforestation Areas
            </h1>
          </div>
          <div className="flex items-center mt-5 mb-10 ml-auto">
            {userRole !== "DataManager" && (
              <button
                onClick={() => navigate(`${useruserRole}/map`)}
                className="flex items-center gap-2 bg-white hover:bg-white text-black h-10 px-3 py-2 ml-auto rounded-lg text-[.8rem]"
              >
                <Plus size={20} /> Add new area
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 p-8 max-w-409">

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

          {/* ── Filter button + dropdown ───────────────────── */}
          <div className="relative" ref={filterPanelRef}>
            <button
              onClick={() => setShowFilters((prev) => !prev)}
              className={`flex items-center gap-2 px-3 py-2 rounded-md border text-[.8rem] font-medium transition-colors ${
                showFilters || activeFilterCount > 0
                  ? "bg-green-700 text-white border-green-700"
                  : "bg-white text-gray-700 border-black hover:bg-gray-50"
              }`}
            >
              <SlidersHorizontal size={15} />
              Filters
              {activeFilterCount > 0 && (
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white text-green-700 text-[.7rem] font-bold leading-none">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* Dropdown panel */}
            {showFilters && (
              <div className="absolute top-full left-0 mt-2 z-50 bg-white border border-gray-200 rounded-xl shadow-2xl p-5 w-[520px]">
                {/* Panel header */}
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                  <span className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                    <SlidersHorizontal size={15} className="text-green-700" />
                    Filter Areas
                  </span>
                  <div className="flex items-center gap-2">
                    {activeFilterCount > 0 && (
                      <button
                        onClick={resetFilters}
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-500 transition-colors"
                      >
                        <RotateCcw size={12} />
                        Reset all
                      </button>
                    )}
                    <button
                      onClick={() => setShowFilters(false)}
                      className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                    >
                      <X size={15} className="text-gray-500" />
                    </button>
                  </div>
                </div>

                {/* Filter grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Legality
                    </label>
                    <select
                      value={filter.legality}
                      onChange={(e) =>
                        setFilter((prev) => ({ ...prev, legality: e.target.value, page: 1 }))
                      }
                      className="border border-gray-300 p-2 rounded-lg text-[.8rem] focus:outline-none focus:ring-2 focus:ring-green-400"
                    >
                      <option value="All">All</option>
                      <option value="legal">Legal</option>
                      <option value="pending">Pending</option>
                      <option value="illegal">Illegal</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Safety
                    </label>
                    <select
                      value={filter.safety}
                      onChange={(e) =>
                        setFilter((prev) => ({ ...prev, safety: e.target.value, page: 1 }))
                      }
                      className="border border-gray-300 p-2 rounded-lg text-[.8rem] focus:outline-none focus:ring-2 focus:ring-green-400"
                    >
                      <option value="All">All</option>
                      <option value="safe">Safe</option>
                      <option value="slightly">Slightly Unsafe</option>
                      <option value="moderate">Moderate Risk</option>
                      <option value="danger">High Risk</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Pre-assessment
                    </label>
                    <select
                      value={filter.pre_assessment_status}
                      onChange={(e) =>
                        setFilter((prev) => ({
                          ...prev,
                          pre_assessment_status: e.target.value,
                          page: 1,
                        }))
                      }
                      className="border border-gray-300 p-2 rounded-lg text-[.8rem] focus:outline-none focus:ring-2 focus:ring-green-400"
                    >
                      <option value="All">All</option>
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Barangay
                    </label>
                    <select
                      value={filter.barangay_id}
                      onChange={(e) =>
                        setFilter((prev) => ({ ...prev, barangay_id: e.target.value, page: 1 }))
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
                  </div>

                  <div className="flex flex-col gap-1 col-span-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Land Classification
                    </label>
                    <select
                      value={filter.land_classification_id}
                      onChange={(e) =>
                        setFilter((prev) => ({
                          ...prev,
                          land_classification_id: e.target.value,
                          page: 1,
                        }))
                      }
                      className="border border-gray-300 p-2 rounded-lg text-[.8rem] focus:outline-none focus:ring-2 focus:ring-green-400"
                    >
                      <option value="All">All</option>
                      {landClassifications.map((lc) => (
                        <option
                          key={lc.land_classification_id}
                          value={lc.land_classification_id}
                        >
                          {lc.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Active filter badges */}
          {activeFilterCount > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {filter.legality !== "All" && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded-full text-[.7rem] font-medium">
                  Legality: {filter.legality}
                  <button onClick={() => setFilter((p) => ({ ...p, legality: "All", page: 1 }))}>
                    <X size={11} />
                  </button>
                </span>
              )}
              {filter.safety !== "All" && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded-full text-[.7rem] font-medium">
                  Safety: {filter.safety}
                  <button onClick={() => setFilter((p) => ({ ...p, safety: "All", page: 1 }))}>
                    <X size={11} />
                  </button>
                </span>
              )}
              {filter.pre_assessment_status !== "All" && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded-full text-[.7rem] font-medium">
                  Pre-assessment: {filter.pre_assessment_status}
                  <button onClick={() => setFilter((p) => ({ ...p, pre_assessment_status: "All", page: 1 }))}>
                    <X size={11} />
                  </button>
                </span>
              )}
              {filter.barangay_id !== "All" && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded-full text-[.7rem] font-medium">
                  Barangay: {barangays.find((b) => String(b.barangay_id) === filter.barangay_id)?.name ?? filter.barangay_id}
                  <button onClick={() => setFilter((p) => ({ ...p, barangay_id: "All", page: 1 }))}>
                    <X size={11} />
                  </button>
                </span>
              )}
              {filter.land_classification_id !== "All" && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded-full text-[.7rem] font-medium">
                  Land: {landClassifications.find((lc) => String(lc.land_classification_id) === filter.land_classification_id)?.name ?? filter.land_classification_id}
                  <button onClick={() => setFilter((p) => ({ ...p, land_classification_id: "All", page: 1 }))}>
                    <X size={11} />
                  </button>
                </span>
              )}
            </div>
          )}

          {/* Search */}
          <input
            type="text"
            placeholder="Search reforestation areas..."
            value={filter.search}
            onChange={(e) =>
              setFilter((prev) => ({ ...prev, search: e.target.value, page: 1 }))
            }
            onKeyDown={(e) => { if (e.key === "Enter") fetchAreas(); }}
            className="border border-black rounded-md p-2 w-80 text-[.8rem] ml-auto"
          />
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
                <th className="py-3 px-5 text-left">Land Classification</th>
                <th className="py-3 px-5 text-left">Legality</th>
                <th className="py-3 px-5 text-left">Safety</th>
                <th className="py-3 px-5 text-left">Created</th>
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
                    <td className="py-3 px-5">{area.name}</td>
                    <td className="py-3 px-5">{area.barangay.name}</td>
                    <td className="py-3 px-5">
                      {area.land_classification?.name ?? (
                        <span className="text-gray-400 italic">N/A</span>
                      )}
                    </td>
                    <td className="py-3 px-5">
                      {area.legality === "legal"
                        ? "Legal"
                        : area.legality === "pending"
                          ? "Pending"
                          : "Illegal"}
                    </td>
                    <td className="py-3 px-5">{area.safety}</td>
                    <td className="py-3 px-5">{area.created_at}</td>
                    <td className="py-3 px-5">
                      <div className="flex gap-2">
                        {userRole !== "DataManager" && (
                          <button
                            onClick={() =>
                              navigate(`${useruserRole}/assign_onsite_inpsector/${area.reforestation_area_id}`)
                            }
                            className="cursor-pointer"
                          >
                            <User size={18} />
                          </button>
                        )}
                        {userRole !== "DataManager" && (
                          <button
                            onClick={() =>
                              navigate(`${useruserRole}/legality-and-safety/${area.reforestation_area_id}`)
                            }
                            className="cursor-pointer"
                          >
                            <VerifiedIcon size={18} />
                          </button>
                        )}
                        <button
                          onClick={() =>
                            navigate(`${useruserRole}/maintenance/reforestation_area_form/${area.reforestation_area_id}`)
                          }
                          className="cursor-pointer"
                        >
                          <Edit size={18} />
                        </button>
                        {userRole !== "DataManager" && (
                          <button
                            onClick={() => setDelete(area.reforestation_area_id)}
                            className="text-red-500 cursor-pointer"
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
                  <td colSpan={8} className="text-center py-5 text-gray-500 italic">
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
            onClick={() => setFilter((prev) => ({ ...prev, page: prev.page - 1 }))}
            className="px-2 py-1 border rounded-md ml-auto"
          >
            <ChevronLeft size={19} />
          </button>
          {Array.from({ length: filter.total_page }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setFilter((prev) => ({ ...prev, page: p }))}
              className={`px-2 py-1 border rounded-md text-[.8rem] ${
                p === filter.page ? "bg-green-600 text-white" : ""
              }`}
            >
              {p}
            </button>
          ))}
          <button
            disabled={filter.page >= filter.total_page}
            onClick={() => setFilter((prev) => ({ ...prev, page: prev.page + 1 }))}
            className="px-2 py-1 border rounded-md"
          >
            <ChevronRight size={19} />
          </button>
        </div>
      </main>
    </div>
  );
}