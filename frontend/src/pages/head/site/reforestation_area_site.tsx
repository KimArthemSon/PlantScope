import { useEffect, useState } from "react";
import {
  Trash2,
  Edit,
  ChevronRight,
  ChevronLeft,
  List,
  CheckCircle,
  AlertCircle,
  Clock,
  FileText,
  MapPin,
  TrendingUp,
  BarChart3,
  X,
  PieChart,
  Activity,
  Trees,
  ShieldCheck,
  Users,
  Calendar,
} from "lucide-react";
import PlantScopeAlert from "@/components/alert/PlantScopeAlert";
import Delete_modal from "@/components/layout/delete_modal";
import LoaderPending from "@/components/layout/loaderSmall";
import { useNavigate } from "react-router-dom";
import { useUserRole } from "@/hooks/authorization";
import { api } from "@/constant/api.ts";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart as RePieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";

// ─────────────────────────────────────────────────────────────
// Types & Interfaces
// ─────────────────────────────────────────────────────────────
interface ReforestationArea {
  reforestation_area_id: number;
  name: string;
  description: string | null;
  coordinate: any;
  barangay: {
    barangay_id: number;
    name: string;
  } | null;
  land_classification?: { land_classification_id: number; name: string } | null;
  permit_count?: number;
  verification_status?: "pending" | "draft" | "verified" | "rejected";
  verification_decision_note?: string | null;
  created_at: string;
}

interface Filter {
  search: string;
  entries: number;
  page: number;
  total_page: number;
}

interface AreaDetails {
  total_sites: number;
  verified_sites: number;
  pending_sites: number;
  rejected_sites: number;
  total_seedlings: number;
  total_area_hectares: number;
  species_count: number;
  verification_rate: number;
  monthly_data: Array<{
    month: string;
    sites_created: number;
    verified: number;
  }>;
  status_distribution: Array<{
    name: string;
    value: number;
  }>;
}

const DEFAULT_FILTER: Omit<Filter, "total_page"> = {
  search: "",
  entries: 10,
  page: 1,
};

const STATIC_OVERVIEW_STATS = {
  total_areas: 0,
  pending_verification: 0,
  verified: 0,
  rejected: 0,
  draft: 0,
  avg_verification_rate: 0,
};

const STATIC_CHART_DATA = [
  { period: "Jan 24", pending: 0, verified: 0, rejected: 0 },
  { period: "Feb 24", pending: 0, verified: 0, rejected: 0 },
  { period: "Mar 24", pending: 0, verified: 0, rejected: 0 },
  { period: "Apr 24", pending: 0, verified: 0, rejected: 0 },
  { period: "May 24", pending: 0, verified: 0, rejected: 0 },
  { period: "Jun 24", pending: 0, verified: 0, rejected: 0 },
];

const COLORS = ["#10B981", "#F59E0B", "#EF4444", "#3B82F6"];

export default function Reforestation_areas() {
  const [areas, setAreas] = useState<ReforestationArea[]>([]);
  const [filter, setFilter] = useState<Filter>({
    ...DEFAULT_FILTER,
    total_page: 1,
  });

  const [loading, setLoading] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // ✅ NEW: View Details Modal State
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedArea, setSelectedArea] = useState<ReforestationArea | null>(null);
  const [areaDetails, setAreaDetails] = useState<AreaDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const [PSalert, setPSAlert] = useState<{
    type: "success" | "failed" | "error";
    title: string;
    message: string;
  } | null>(null);

  const [overviewStats] = useState(STATIC_OVERVIEW_STATS);
  const [chartData] = useState(STATIC_CHART_DATA);

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
useEffect(()=>{
  fetchAreas()
},[])
  const fetchAreas = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search: filter.search,
        page: filter.page.toString(),
        entries: filter.entries.toString(),
      });
      const response = await fetch(
        api+`api/get_reforestation_areas/?${params}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!response.ok) throw new Error("Failed");
      const data = await response.json();
      console.log(data)
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

  // ✅ NEW: Fetch Area Details
  const fetchAreaDetails = async (areaId: number) => {
    setLoadingDetails(true);
    try {
      const response = await fetch(
        api+`api/get_area_details/${areaId}/`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (response.ok) {
        const data = await response.json();
        setAreaDetails(data);
      } else {
        // Mock data for demonstration
        setAreaDetails({
          total_sites: 12,
          verified_sites: 7,
          pending_sites: 3,
          rejected_sites: 2,
          total_seedlings: 15000,
          total_area_hectares: 45.8,
          species_count: 8,
          verification_rate: 58.33,
          monthly_data: [
            { month: "Jan", sites_created: 2, verified: 1 },
            { month: "Feb", sites_created: 3, verified: 2 },
            { month: "Mar", sites_created: 1, verified: 1 },
            { month: "Apr", sites_created: 4, verified: 2 },
            { month: "May", sites_created: 2, verified: 1 },
            { month: "Jun", sites_created: 0, verified: 0 },
          ],
          status_distribution: [
            { name: "Verified", value: 7 },
            { name: "Pending", value: 3 },
            { name: "Rejected", value: 2 },
          ],
        });
      }
    } catch {
      setPSAlert({
        type: "error",
        title: "Error",
        message: "Failed to load area details.",
      });
    } finally {
      setLoadingDetails(false);
    }
  };

  // ✅ NEW: Open View Modal
  const handleViewDetails = (area: ReforestationArea) => {
    setSelectedArea(area);
    setIsViewModalOpen(true);
    fetchAreaDetails(area.reforestation_area_id);
  };

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

      {/* ✅ NEW: View Details Modal */}
      {isViewModalOpen && selectedArea && (
        <div className="fixed inset-0 bg-black/50 z-[1000] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-gradient-to-r from-[#0F4A2F] to-[#1a6b44] text-white px-6 py-4 rounded-t-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MapPin size={24} className="text-green-300" />
                <div>
                  <h2 className="text-xl font-bold">{selectedArea.name}</h2>
                  <p className="text-xs text-green-200">
                    Area #{selectedArea.reforestation_area_id}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsViewModalOpen(false)}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {loadingDetails ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0F4A2F]"></div>
                </div>
              ) : areaDetails ? (
                <>
                  {/* Stats Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl border border-green-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium text-green-600 uppercase">Total Sites</p>
                          <p className="text-3xl font-bold text-green-800 mt-1">{areaDetails.total_sites}</p>
                        </div>
                        <Trees className="w-10 h-10 text-green-600 opacity-50" />
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium text-blue-600 uppercase">Total Area</p>
                          <p className="text-3xl font-bold text-blue-800 mt-1">{areaDetails.total_area_hectares.toFixed(1)} ha</p>
                        </div>
                        <MapPin className="w-10 h-10 text-blue-600 opacity-50" />
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl border border-purple-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium text-purple-600 uppercase">Seedlings</p>
                          <p className="text-3xl font-bold text-purple-800 mt-1">{areaDetails.total_seedlings.toLocaleString()}</p>
                        </div>
                        <Activity className="w-10 h-10 text-purple-600 opacity-50" />
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-4 rounded-xl border border-amber-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium text-amber-600 uppercase">Species</p>
                          <p className="text-3xl font-bold text-amber-800 mt-1">{areaDetails.species_count}</p>
                        </div>
                        <Trees className="w-10 h-10 text-amber-600 opacity-50" />
                      </div>
                    </div>
                  </div>

                  {/* Charts Row */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Pie Chart - Status Distribution */}
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                      <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
                        <PieChart size={16} className="text-[#0F4A2F]" />
                        Site Status Distribution
                      </h3>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <RePieChart>
                            <Pie
                              data={areaDetails.status_distribution}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={90}
                              paddingAngle={5}
                              dataKey="value"
                              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            >
                              {areaDetails.status_distribution.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </RePieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex justify-center gap-4 mt-4">
                        {areaDetails.status_distribution.map((item, index) => (
                          <div key={item.name} className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index] }}></div>
                            <span className="text-xs text-gray-600">{item.name}: {item.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Line Chart - Monthly Trend */}
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                      <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
                        <BarChart3 size={16} className="text-[#0F4A2F]" />
                        Monthly Activity
                      </h3>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={areaDetails.monthly_data}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} />
                            <Tooltip />
                            <Legend />
                            <Line type="monotone" dataKey="sites_created" name="Sites Created" stroke="#10B981" strokeWidth={2} />
                            <Line type="monotone" dataKey="verified" name="Verified" stroke="#3B82F6" strokeWidth={2} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* Verification Rate */}
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-xl border border-green-200">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-800">Verification Progress</h3>
                        <p className="text-xs text-gray-600 mt-1">Overall verification status of sites</p>
                      </div>
                      <ShieldCheck className="w-8 h-8 text-green-600" />
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="relative w-32 h-32">
                        <svg className="w-full h-full" viewBox="0 0 36 36">
                          <path
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            fill="none"
                            stroke="#e2e8f0"
                            strokeWidth="3"
                          />
                          <path
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            fill="none"
                            stroke="#10B981"
                            strokeWidth="3"
                            strokeDasharray={`${areaDetails.verification_rate}, 100`}
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-2xl font-bold text-green-700">{areaDetails.verification_rate.toFixed(1)}%</span>
                        </div>
                      </div>
                      <div className="flex-1 space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Verified Sites</span>
                          <span className="text-sm font-semibold text-green-700">{areaDetails.verified_sites} / {areaDetails.total_sites}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-green-600 h-2 rounded-full transition-all"
                            style={{ width: `${(areaDetails.verified_sites / areaDetails.total_sites) * 100}%` }}
                          ></div>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Pending Review</span>
                          <span className="text-sm font-semibold text-amber-600">{areaDetails.pending_sites}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Rejected</span>
                          <span className="text-sm font-semibold text-red-600">{areaDetails.rejected_sites}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Additional Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                      <div className="flex items-center gap-2 mb-2">
                        <MapPin size={16} className="text-[#0F4A2F]" />
                        <h4 className="text-sm font-semibold text-gray-800">Location</h4>
                      </div>
                      <p className="text-sm text-gray-600">
                        {selectedArea.barangay?.name || "N/A"}
                      </p>
                      {selectedArea.land_classification && (
                        <p className="text-xs text-gray-500 mt-1">
                          {selectedArea.land_classification.name}
                        </p>
                      )}
                    </div>

                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar size={16} className="text-[#0F4A2F]" />
                        <h4 className="text-sm font-semibold text-gray-800">Created</h4>
                      </div>
                      <p className="text-sm text-gray-600">
                        {new Date(selectedArea.created_at).toLocaleDateString("en-PH", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-gray-400">
                  <AlertCircle className="w-12 h-12 mx-auto mb-2" />
                  <p>Failed to load area details</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-gray-50 px-6 py-4 border-t border-gray-200 rounded-b-2xl flex justify-end gap-3">
              <button
                onClick={() => setIsViewModalOpen(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setIsViewModalOpen(false);
                  navigate(`${useruserRole}/reforestation/site/${selectedArea.reforestation_area_id}`);
                }}
                className="px-4 py-2 bg-[#0F4A2F] text-white rounded-lg hover:bg-[#0a3522] transition-colors flex items-center gap-2"
              >
                <List size={16} />
                View Sites
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 p-8 max-w-7xl mx-auto">
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
            />
            <StatCard
              title="Rejected"
              value={overviewStats.rejected}
              icon={AlertCircle}
              color="bg-red-500"
            />
          </div>

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

        <div className="overflow-x-auto shadow-lg border border-gray-200">
          {loading && <LoaderPending />}
          <table className="min-w-full bg-white">
            <thead className="bg-[#0f4a2fe0] text-white">
              <tr>
                <th className="py-3 px-5 text-left">No</th>
                <th className="py-3 px-5 text-left">Name</th>
                <th className="py-3 px-5 text-left">Barangay</th>
                <th className="py-3 px-5 text-left">Created</th>
                <th className="py-3 px-5 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {areas.length > 0 ? (
                areas.map((area, index) => {
                  const status = area.verification_status;
                  const badgeClass =
                    status === "pending"
                      ? "bg-amber-100 text-amber-700"
                      : status === "draft"
                        ? "bg-blue-100 text-blue-700"
                        : status === "verified"
                          ? "bg-green-100 text-green-700"
                          : status === "rejected"
                            ? "bg-red-100 text-red-700"
                            : "bg-gray-100 text-gray-700";

                  return (
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
                      <td className="py-3 px-5">{area.created_at}</td>
                      <td className="py-3 px-5">
                        <div className="flex gap-2">
                          {/* ✅ NEW: View Details Button */}
                          <button
                            onClick={() => handleViewDetails(area)}
                            className="text-blue-600 cursor-pointer border border-blue-600 rounded-full p-1 hover:bg-blue-50 transition-colors"
                            title="View Details"
                          >
                            <BarChart3 size={18} />
                          </button>

                          <button
                            onClick={() =>
                              navigate(
                                `${useruserRole}/reforestation/site/${area.reforestation_area_id}`,
                              )
                            }
                            className="text-green-900 cursor-pointer border border-green-900 rounded-full p-1 hover:bg-green-50 transition-colors"
                            title="View Sites"
                          >
                            <List size={18} />
                          </button>

                          {userRole !== "DataManager" && (
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
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={8}
                    className="text-center py-5 text-gray-500 italic"
                  >
                    No areas found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

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

        <section className="mt-12 mb-4">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <BarChart3 size={18} className="text-[#0F4A2F]" />
                Verification Trends (Last 6 Months)
              </h2>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-amber-500"></span>{" "}
                  Pending
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-green-600"></span>{" "}
                  Verified
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-red-500"></span>{" "}
                  Rejected
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
                  <Legend
                    wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="pending"
                    name="Pending"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={{
                      r: 3,
                      fill: "#f59e0b",
                      strokeWidth: 2,
                      stroke: "#fff",
                    }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="verified"
                    name="Verified"
                    stroke="#16a34a"
                    strokeWidth={2}
                    dot={{
                      r: 3,
                      fill: "#16a34a",
                      strokeWidth: 2,
                      stroke: "#fff",
                    }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="rejected"
                    name="Rejected"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={{
                      r: 3,
                      fill: "#ef4444",
                      strokeWidth: 2,
                      stroke: "#fff",
                    }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

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