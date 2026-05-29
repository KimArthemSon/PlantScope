import { useEffect, useState, useRef } from "react";
import {
  Trash2,
  Edit,
  ChevronRight,
  ChevronLeft,
  VerifiedIcon,
  Leaf,
  SlidersHorizontal,
  X,
  RotateCcw,
  List,
  CheckCircle,
  AlertCircle,
  Clock,
  FileText,
  MapPin,
  TrendingUp,
  BarChart3,
} from "lucide-react";
import PlantScopeAlert from "@/components/alert/PlantScopeAlert";
import Delete_modal from "@/components/layout/delete_modal";
import LoaderPending from "@/components/layout/loaderSmall";
import { useNavigate } from "react-router-dom";
import { useUserRole } from "@/hooks/authorization";

// ✅ NEW: Recharts imports
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// ─────────────────────────────────────────────────────────────
// Types & Interfaces (UPDATED)
// ─────────────────────────────────────────────────────────────
interface Barangay {
  barangay_id: number;
  name: string;
}

interface LandClassification {
  land_classification_id: number;
  name: string;
}

// ✅ UPDATED: Removed legality, safety, pre_assessment_status
// Added verification_status from AreaMetaDataVerification
interface ReforestationArea {
  reforestation_area_id: number;
  name: string;
  polygon_coordinate: any;
  coordinate: any;
  barangay: {
    barangay_id: number;
    name: string;
  } | null;
  land_classification: {
    land_classification_id: number;
    name: string;
  } | null;
  description: string;
  area_img: string | null;
  permit_count: number;
  verification_status: "pending" | "draft" | "verified" | "rejected";
  verification_decision_note: string | null;
  created_at: string;
}

// ✅ UPDATED: Filter interface matches new backend params
interface Filter {
  search: string;
  entries: number;
  page: number;
  total_page: number;
  verification_status: string; // Replaces pre_assessment_status
  barangay_id: string;
  land_classification_id: string;
}

interface OverviewStats {
  total_areas: number;
  pending_verification: number;
  verified: number;
  rejected: number;
  draft: number;
  avg_verification_rate: number;
}

// ✅ NEW: Chart data point interface (uses verification status)
interface ChartDataPoint {
  period: string;
  pending: number;
  verified: number;
  rejected: number;
}

const DEFAULT_FILTER: Omit<Filter, "total_page"> = {
  search: "",
  entries: 10,
  page: 1,
  verification_status: "All", // Changed from pre_assessment_status
  barangay_id: "All",
  land_classification_id: "All",
};

// ─────────────────────────────────────────────────────────────
// Helper: count active filters (UPDATED)
// ─────────────────────────────────────────────────────────────
function countActiveFilters(filter: Filter): number {
  let count = 0;
  if (filter.verification_status !== "All") count++;
  if (filter.barangay_id !== "All") count++;
  if (filter.land_classification_id !== "All") count++;
  return count;
}

// ✅ UPDATED: Generate chart data using verification_status
function generateChartData(areas: ReforestationArea[]): ChartDataPoint[] {
  const monthlyData: Record<
    string,
    { pending: number; verified: number; rejected: number }
  > = {};

  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  // Initialize last 6 months
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${months[date.getMonth()]} ${String(date.getFullYear()).slice(-2)}`;
    monthlyData[key] = { pending: 0, verified: 0, rejected: 0 };
  }

  // Populate with actual data
  areas.forEach((area) => {
    const created = new Date(area.created_at);
    const key = `${months[created.getMonth()]} ${String(created.getFullYear()).slice(-2)}`;
    if (monthlyData[key]) {
      if (area.verification_status === "pending" || area.verification_status === "draft") {
        monthlyData[key].pending++;
      } else if (area.verification_status === "verified") {
        monthlyData[key].verified++;
      } else if (area.verification_status === "rejected") {
        monthlyData[key].rejected++;
      }
    }
  });

  return Object.entries(monthlyData).map(([period, data]) => ({
    period,
    ...data,
  }));
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

  const [overviewStats, setOverviewStats] = useState<OverviewStats>({
    total_areas: 0,
    pending_verification: 0,
    verified: 0,
    rejected: 0,
    draft: 0,
    avg_verification_rate: 0,
  });

  // ✅ NEW: Chart data state
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);

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
        const res = await fetch(
          "http://127.0.0.1:8000/api/get_barangay_list/",
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
    const fetchLandClassifications = async () => {
      try {
        const res = await fetch(
          "http://127.0.0.1:8000/api/get_land_classifications_list/?for_reforestation=true",
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

  // ── Fetch Areas (UPDATED API CALL) ─────────────────────────
  const fetchAreas = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search: filter.search,
        page: filter.page.toString(),
        entries: filter.entries.toString(),
        // ✅ REMOVED: legality, safety, pre_assessment_status
        verification_status: filter.verification_status, // ✅ NEW
        barangay_id: filter.barangay_id,
        land_classification_id: filter.land_classification_id,
      });
      const response = await fetch(
        `http://127.0.0.1:8000/api/get_reforestation_areas/?${params}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!response.ok) throw new Error("Failed");
      const data = await response.json();
      console.log(data)
      setAreas(data.data);
      setFilter((prev) => ({ ...prev, total_page: data.total_page }));

      // Update overview stats with new verification-based logic
      setOverviewStats(computeOverviewStats(data.data));
      // ✅ Update chart data with verification trends
      setChartData(generateChartData(data.data));
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
    filter.verification_status, // ✅ UPDATED
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

  // ── Reset all filters ──────────────────────────────────────
  const resetFilters = () => {
    setFilter((prev) => ({
      ...prev,
      ...DEFAULT_FILTER,
      total_page: prev.total_page,
    }));
  };

  const activeFilterCount = countActiveFilters(filter);

  // ✅ UPDATED: Helper to compute overview stats using verification_status
  function computeOverviewStats(areas: ReforestationArea[]): OverviewStats {
    const total = areas.length;
    const pending = areas.filter(
      (a) => a.verification_status === "pending" || a.verification_status === "draft"
    ).length;
    const verified = areas.filter((a) => a.verification_status === "verified").length;
    const rejected = areas.filter((a) => a.verification_status === "rejected").length;
    const draft = areas.filter((a) => a.verification_status === "draft").length;
    
    const verificationRate = total > 0 ? Math.round((verified / total) * 100) : 0;

    return {
      total_areas: total,
      pending_verification: pending,
      verified,
      rejected,
      draft,
      avg_verification_rate: verificationRate,
    };
  }

  // ✅ Stat card component (unchanged structure, updated usage)
  const StatCard = ({
    title,
    value,
    icon: Icon,
    color,
    trend,
  }: {
    title: string;
    value: number | string;
    icon: any;
    color: string;
    trend?: string;
  }) => (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            {title}
          </p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {trend && (
            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
              <TrendingUp size={10} />
              {trend}
            </p>
          )}
        </div>
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon size={20} className="text-white" />
        </div>
      </div>
    </div>
  );

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

      <main className="flex-1 p-8 max-w-7xl mx-auto">
        {/* Overview Stats Dashboard (UPDATED) */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <FileText size={18} className="text-[#0F4A2F]" />
              Verification Overview
            </h2>
            <button
              onClick={fetchAreas}
              className="text-xs text-[#0F4A2F] hover:underline flex items-center gap-1"
            >
              <RotateCcw size={12} />
              Refresh
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            <StatCard
              title="Total Areas"
              value={overviewStats.total_areas}
              icon={MapPin}
              color="bg-[#0F4A2F]"
            />
            <StatCard
              title="Pending Verification"
              value={overviewStats.pending_verification}
              icon={Clock}
              color="bg-amber-500"
            />
            <StatCard
              title="Draft"
              value={overviewStats.draft}
              icon={Edit}
              color="bg-blue-500"
            />
            <StatCard
              title="Verified"
              value={overviewStats.verified}
              icon={CheckCircle}
              color="bg-green-600"
              trend={overviewStats.verified > 0 ? "+2 this week" : undefined}
            />
            <StatCard
              title="Rejected"
              value={overviewStats.rejected}
              icon={AlertCircle}
              color="bg-red-500"
            />
            {/* Removed Completion Rate - replaced with Verification Rate below */}
          </div>
          
          {/* Verification Rate Summary */}
          <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-center justify-between">
              <span className="text-sm text-green-800 font-medium">
                Overall Verification Rate
              </span>
              <span className="text-lg font-bold text-green-700">
                {overviewStats.avg_verification_rate}%
              </span>
            </div>
            <div className="mt-2 h-2 bg-green-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-green-600 rounded-full transition-all duration-300"
                style={{ width: `${overviewStats.avg_verification_rate}%` }}
              />
            </div>
          </div>
        </section>

        {/* ── TOOLBAR (UPDATED FILTERS) ────────────────────── */}
        <div className="flex items-center flex-wrap mb-4 gap-3">
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

          {/* Filter button + dropdown */}
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

            {showFilters && (
              <div className="absolute top-full left-0 mt-2 z-50 bg-white border border-gray-200 rounded-xl shadow-2xl p-5 w-[520px]">
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

                <div className="grid grid-cols-2 gap-4">
                  {/* ✅ REMOVED: Legality, Safety, Pre-assessment filters */}
                  
                  {/* ✅ NEW: Verification Status Filter */}
                  <div className="flex flex-col gap-1 col-span-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Verification Status
                    </label>
                    <select
                      value={filter.verification_status}
                      onChange={(e) =>
                        setFilter((prev) => ({
                          ...prev,
                          verification_status: e.target.value,
                          page: 1,
                        }))
                      }
                      className="border border-gray-300 p-2 rounded-lg text-[.8rem] focus:outline-none focus:ring-2 focus:ring-green-400"
                    >
                      <option value="All">All</option>
                      <option value="pending">Pending Review</option>
                      <option value="draft">Draft</option>
                      <option value="verified">Verified ✓</option>
                      <option value="rejected">Rejected ✗</option>
                    </select>
                  </div>
                  
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Barangay
                    </label>
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
                  </div>
                  <div className="flex flex-col gap-1">
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

          {/* Active filter badges (UPDATED) */}
          {activeFilterCount > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {filter.verification_status !== "All" && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded-full text-[.7rem] font-medium">
                  Verification: {filter.verification_status}
                  <button
                    onClick={() =>
                      setFilter((p) => ({ ...p, verification_status: "All", page: 1 }))
                    }
                  >
                    <X size={11} />
                  </button>
                </span>
              )}
              {filter.barangay_id !== "All" && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded-full text-[.7rem] font-medium">
                  Barangay:{" "}
                  {barangays.find(
                    (b) => String(b.barangay_id) === filter.barangay_id,
                  )?.name ?? filter.barangay_id}
                  <button
                    onClick={() =>
                      setFilter((p) => ({ ...p, barangay_id: "All", page: 1 }))
                    }
                  >
                    <X size={11} />
                  </button>
                </span>
              )}
              {filter.land_classification_id !== "All" && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded-full text-[.7rem] font-medium">
                  Land:{" "}
                  {landClassifications.find(
                    (lc) =>
                      String(lc.land_classification_id) ===
                      filter.land_classification_id,
                  )?.name ?? filter.land_classification_id}
                  <button
                    onClick={() =>
                      setFilter((p) => ({
                        ...p,
                        land_classification_id: "All",
                        page: 1,
                      }))
                    }
                  >
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
        </div>

        {/* ── TABLE (UPDATED COLUMNS) ───────────────────────── */}
        <div className="overflow-x-auto shadow-lg border border-gray-200">
          {loading && <LoaderPending />}
          <table className="min-w-full bg-white">
            <thead className="bg-[#0f4a2fe0] text-white">
              <tr>
                <th className="py-3 px-5 text-left">No</th>
                <th className="py-3 px-5 text-left">Name</th>
                <th className="py-3 px-5 text-left">Status</th>
                <th className="py-3 px-5 text-left">Barangay</th>
                <th className="py-3 px-5 text-left">Land Classification</th>
                <th className="py-3 px-5 text-left">Permits</th>
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
                    <td className="py-3 px-5 font-medium">{area.name}</td>
                    
                    {/* ✅ UPDATED: Verification Status Badge */}
                    <td className="py-3 px-5">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${
                          area.verification_status === "pending"
                            ? "bg-amber-100 text-amber-700"
                            : area.verification_status === "draft"
                            ? "bg-blue-100 text-blue-700"
                            : area.verification_status === "verified"
                            ? "bg-green-100 text-green-700"
                            : area.verification_status === "rejected"
                            ? "bg-red-100 text-red-700"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {area.verification_status === "verified" && <CheckCircle size={12} />}
                        {area.verification_status === "rejected" && <AlertCircle size={12} />}
                        {area.verification_status === "pending" && <Clock size={12} />}
                        {area.verification_status === "draft" && <Edit size={12} />}
                        {area.verification_status.charAt(0).toUpperCase() + area.verification_status.slice(1)}
                      </span>
                      {area.verification_decision_note && (
                        <p className="text-[.65rem] text-gray-500 mt-1 max-w-[180px] truncate" title={area.verification_decision_note}>
                          {area.verification_decision_note}
                        </p>
                      )}
                    </td>

                    <td className="py-3 px-5">{area.barangay?.name ?? <span className="text-gray-400 italic">N/A</span>}</td>
                    <td className="py-3 px-5">
                      {area.land_classification?.name ?? (
                        <span className="text-gray-400 italic">N/A</span>
                      )}
                    </td>
                    
                    {/* ✅ NEW: Permit Count Column */}
                    <td className="py-3 px-5">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-700 text-xs font-bold">
                        {area.permit_count}
                      </span>
                    </td>
                    
                    <td className="py-3 px-5">{area.created_at}</td>
                    <td className="py-3 px-5">
                      <div className="flex gap-2">
                        {/* ✅ UPDATED: Navigate to Meta Data Verification */}
                        {userRole !== "GISSpecialist" && (
                          <button
                            onClick={() =>
                              navigate(
                                `${useruserRole}/verification/meta-data/${area.reforestation_area_id}`,
                              )
                            }
                            className="cursor-pointer text-green-700 hover:text-green-900 p-1 rounded hover:bg-green-50"
                            title="Verify Meta Data"
                          >
                            <VerifiedIcon size={18} />
                          </button>
                        )}

                        <button
                          onClick={() =>
                            navigate(
                              `${useruserRole}/reforestation/site/${area.reforestation_area_id}`,
                            )
                          }
                          className="text-green-900 cursor-pointer border border-green-900 rounded-full p-1 hover:bg-green-50"
                          title="View Sites"
                        >
                          <List size={18} />
                        </button>
                        
                        {userRole !== "DataManager" &&
                          area.verification_status === "rejected" && (
                            <button
                              onClick={() =>
                                setDelete(area.reforestation_area_id)
                              }
                              className="text-red-500 cursor-pointer hover:bg-red-50 p-1 rounded"
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
                className={`px-2 py-1 border rounded-md text-[.8rem] ${p === filter.page ? "bg-green-600 text-white" : ""}`}
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

        {/* ✅ Line Graph Section (UPDATED: Verification Trends) */}
        <section className="mt-12 mb-4">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <BarChart3 size={18} className="text-[#0F4A2F]" />
                Verification Trends (Last 6 Months)
              </h2>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-amber-500"></span> Pending
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-green-600"></span> Verified
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-red-500"></span> Rejected
                </span>
              </div>
            </div>

            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="period"
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    axisLine={{ stroke: "#e2e8f0" }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    axisLine={{ stroke: "#e2e8f0" }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    labelStyle={{ fontWeight: "600", color: "#0F4A2F" }}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />

                  <Line
                    type="monotone"
                    dataKey="pending"
                    name="Pending"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "#f59e0b", strokeWidth: 2, stroke: "#fff" }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="verified"
                    name="Verified"
                    stroke="#16a34a"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "#16a34a", strokeWidth: 2, stroke: "#fff" }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="rejected"
                    name="Rejected"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "#ef4444", strokeWidth: 2, stroke: "#fff" }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Summary stats below chart */}
            <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-amber-600">
                  {chartData.reduce((sum, d) => sum + d.pending, 0)}
                </p>
                <p className="text-xs text-gray-500">Total Pending</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">
                  {chartData.reduce((sum, d) => sum + d.verified, 0)}
                </p>
                <p className="text-xs text-gray-500">Total Verified</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">
                  {chartData.reduce((sum, d) => sum + d.rejected, 0)}
                </p>
                <p className="text-xs text-gray-500">Total Rejected</p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}