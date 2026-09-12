import { useEffect, useState, useCallback, useRef } from "react";
import {
  ChevronRight,
  ChevronLeft,
  Leaf,
  FileCheck2,
  Search,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  Calendar,
  Trees,
  MapPin,
  Globe,
  X,
} from "lucide-react";
import PlantScopeAlert from "../../../components/alert/PlantScopeAlert";
import { useNavigate } from "react-router-dom";
import LoaderPending from "../../../components/layout/loaderSmall";
import { useUserRole } from "@/hooks/authorization";
import { api } from "@/constant/api.ts";

// ─── Types ──────────────────────────────────────────────────────────────────

interface ReforestationArea {
  reforestation_area_id: number;
  name: string;
  barangay: { barangay_id: number; name: string } | null;
  site_count?: number;
  total_area_hectares?: number;
}

interface MonitoringSite {
  site_id: number;
  site_name: string;
  reforestation_area_id: number;
  reforestation_area_name: string | null;
  barangay_name: string | null;
  total_area_hectares: number;
  latest_report_date: string | null;
  days_since_last_report: number | null;
  total_reports: number;
  needs_initial: boolean;
  active_application_status: string; // 'accepted', 'under_monitoring', or 'inactive'
}

interface Filter {
  search: string;
  entries: number;
  page: number;
  total_page: number;
  days_since: string;
  needs_initial: boolean;
  program_status: string; // ✅ NEW: 'all', 'active', 'inactive'
}

interface MonitoringStats {
  total: number;
  accepted: number;
  under_monitoring: number;
  no_report: number;
  days_30_plus: number;
  days_60_plus: number;
  days_90_plus: number;
}

// ─── Days Badge Component ───────────────────────────────────────────────────

function DaysBadge({ days }: { days: number | null }) {
  if (days === null) {
    return (
      <span className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-full text-xs font-semibold flex items-center gap-1">
        <XCircle size={12} />
        No Report
      </span>
    );
  }

  if (days >= 90) {
    return (
      <span className="px-3 py-1.5 bg-red-100 text-red-700 rounded-full text-xs font-semibold flex items-center gap-1 animate-pulse">
        <AlertTriangle size={12} />
        {days} days (URGENT)
      </span>
    );
  }
  if (days >= 60) {
    return (
      <span className="px-3 py-1.5 bg-orange-100 text-orange-700 rounded-full text-xs font-semibold flex items-center gap-1">
        <AlertTriangle size={12} />
        {days} days (Warning)
      </span>
    );
  }
  if (days >= 30) {
    return (
      <span className="px-3 py-1.5 bg-yellow-100 text-yellow-700 rounded-full text-xs font-semibold flex items-center gap-1">
        <Clock size={12} />
        {days} days
      </span>
    );
  }
  return (
    <span className="px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-xs font-semibold flex items-center gap-1">
      <CheckCircle2 size={12} />
      {days} days
    </span>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function Monitoring() {
  const [areas, setAreas] = useState<ReforestationArea[]>([]);
  const [sites, setSites] = useState<MonitoringSite[]>([]);
  const [selectedArea, setSelectedArea] = useState<ReforestationArea | null>(null);
  
  const [stats, setStats] = useState<MonitoringStats>({
    total: 0,
    accepted: 0,
    under_monitoring: 0,
    no_report: 0,
    days_30_plus: 0,
    days_60_plus: 0,
    days_90_plus: 0,
  });

  const [filter, setFilter] = useState<Filter>({
    search: "",
    entries: 10,
    page: 1,
    total_page: 1,
    days_since: "all",
    needs_initial: false,
    program_status: "all", // ✅ NEW: Default to all programs
  });

  const [loadingAreas, setLoadingAreas] = useState(false);
  const [loadingSites, setLoadingSites] = useState(false);
  const [PSalert, setPSAlert] = useState<{
    type: "success" | "failed" | "error";
    title: string;
    message: string;
  } | null>(null);

  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const API_BASE = api;
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const { userRole } = useUserRole();
  const [userPath, setUserPath] = useState("");

  useEffect(() => {
    if (userRole === "treeGrowers" || userRole === "CityENROHead") {
      setUserPath("");
      return;
    }
    if (userRole === "GISSpecialist") {
      setUserPath("/GISS");
      return;
    }
    if (userRole === "DataManager") {
      setUserPath("/DataManager");
      return;
    }
  }, [userRole]);

  // Fetch Stats
  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}api/get_monitoring_stats/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.error("Failed to fetch monitoring stats:", err);
    }
  }, [token, API_BASE]);

  // Fetch Areas for Sidebar
  const fetchAreas = async () => {
    setLoadingAreas(true);
    try {
      const response = await fetch(`${API_BASE}api/get_reforestation_areas/?entries=100`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setAreas(data.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch areas:", err);
    } finally {
      setLoadingAreas(false);
    }
  };

  // Fetch Sites for Right Panel
  const fetchSites = async () => {
    setLoadingSites(true);
    try {
      const params = new URLSearchParams({
        search: filter.search,
        page: filter.page.toString(),
        entries: filter.entries.toString(),
        reforestation_area_id: selectedArea ? selectedArea.reforestation_area_id.toString() : "all",
        days_since: filter.days_since,
        needs_initial: filter.needs_initial ? "true" : "false",
        program_status: filter.program_status, // ✅ NEW: Pass program status
      });

      const response = await fetch(`${API_BASE}api/get_monitoring_sites/?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!response.ok) throw new Error("Failed to fetch monitoring sites.");

      const data = await response.json();
      setSites(data.data || []);
      setFilter((prev) => ({ ...prev, total_page: data.total_page }));
    } catch (err: any) {
      setPSAlert({
        type: "error",
        title: "Failed",
        message: err.message || "Failed to load sites.",
      });
    } finally {
      setLoadingSites(false);
    }
  };

  useEffect(() => {
    fetchAreas();
    fetchStats();
  }, []);

  useEffect(() => {
    fetchSites();
  }, [
    selectedArea,
    filter.page,
    filter.entries,
    filter.days_since,
    filter.needs_initial,
    filter.program_status, // ✅ NEW: Trigger fetch on program status change
    filter.search,
  ]);

  useEffect(() => {
    fetchStats();
    intervalRef.current = setInterval(fetchStats, 60000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchStats]);

  const handleViewHistory = (siteId: number) => {
    navigate(`${userPath}/site_monitoring/${siteId}`);
  };

  const clearFilters = () => {
    setFilter((prev) => ({
      ...prev,
      days_since: "all",
      needs_initial: false,
      program_status: "all", // ✅ NEW: Reset program status
      search: "",
      page: 1,
    }));
  };

  const hasActiveFilters = filter.days_since !== "all" || filter.needs_initial || filter.program_status !== "all" || filter.search !== "";

  return (
    <div className="flex min-h-dvh bg-slate-50">
      {PSalert && (
        <PlantScopeAlert
          type={PSalert.type}
          title={PSalert.title}
          message={PSalert.message}
          onClose={() => setPSAlert(null)}
        />
      )}

      <main className="flex-1 p-5 w-full">
        <div className="flex gap-5 h-[calc(100vh-120px)]">
          
          {/* ───────────────────────────────────────────── */}
          {/* Left Sidebar - Reforestation Areas */}
          {/* ───────────────────────────────────────────── */}
          <div className="w-80 flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-shrink-0">
            <div className="p-4 border-b border-slate-200 bg-slate-50/50">
              <h2 className="font-semibold text-slate-800 flex items-center gap-2 mb-3">
                <Trees size={18} className="text-[#0F4A2F]" />
                Reforestation Areas
              </h2>
              <div
                onClick={() => setSelectedArea(null)}
                className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                  selectedArea === null
                    ? "border-[#0F4A2F] bg-[#0F4A2F]/5 shadow-sm ring-1 ring-[#0F4A2F]/20"
                    : "border-slate-200 bg-white hover:border-[#0F4A2F]/50 hover:shadow-sm"
                }`}
              >
                <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                  <Globe size={14} className="text-[#0F4A2F]" />
                  All Areas
                </h3>
                <p className="text-[10px] text-slate-500 mt-1">
                  View all monitored sites
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {loadingAreas ? (
                <LoaderPending />
              ) : areas.length > 0 ? (
                areas.map((area) => {
                  const isSelected = selectedArea?.reforestation_area_id === area.reforestation_area_id;
                  return (
                    <div
                      key={area.reforestation_area_id}
                      onClick={() => setSelectedArea(area)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 group ${
                        isSelected
                          ? "border-[#0F4A2F] bg-[#0F4A2F]/5 shadow-sm ring-1 ring-[#0F4A2F]/20"
                          : "border-slate-200 bg-white hover:border-[#0F4A2F]/50 hover:shadow-sm"
                      }`}
                    >
                      <h3 className="font-semibold text-slate-800 text-sm line-clamp-1 mb-1">
                        {area.name}
                      </h3>
                      <div className="flex items-center gap-1.5 mb-2">
                        <MapPin size={12} className="text-slate-400 flex-shrink-0" />
                        <span className="text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                          {area.barangay?.name || "N/A"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <Trees size={12} />
                          {area.site_count || 0} Sites
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 text-slate-400">
                  <Trees size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-xs">No areas found</p>
                </div>
              )}
            </div>
          </div>

          {/* ───────────────────────────────────────────── */}
          {/* Right Panel - Sites Table */}
          {/* ───────────────────────────────────────────── */}
          <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-w-0">
            <div className="p-4 border-b border-slate-200 bg-slate-50/50">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <FileCheck2 className="text-[#0F4A2F]" size={22} />
                  <h2 className="text-lg font-bold text-slate-800">
                    {selectedArea ? `Sites in ${selectedArea.name}` : "All Monitored Sites"}
                  </h2>
                </div>
                <span className="text-xs text-slate-500 bg-slate-200 px-2 py-1 rounded-full">
                  {sites.length} sites
                </span>
              </div>
              <p className="text-xs text-slate-500 ml-9">
                Track monitoring progress, urgency, and report history
              </p>
            </div>

            {/* Filters Bar */}
            <div className="p-3 border-b border-slate-200 bg-white flex flex-col gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium text-slate-600 flex items-center mr-1">
                  Urgency:
                </span>
                <button
                  onClick={() => setFilter((prev) => ({ ...prev, days_since: "all", page: 1 }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    filter.days_since === "all"
                      ? "bg-slate-800 text-white"
                      : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200"
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilter((prev) => ({ ...prev, days_since: "30_plus", page: 1 }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
                    filter.days_since === "30_plus"
                      ? "bg-yellow-500 text-white"
                      : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200"
                  }`}
                >
                  <Clock size={12} /> 30+ Days
                </button>
                <button
                  onClick={() => setFilter((prev) => ({ ...prev, days_since: "60_plus", page: 1 }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
                    filter.days_since === "60_plus"
                      ? "bg-orange-500 text-white"
                      : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200"
                  }`}
                >
                  <AlertTriangle size={12} /> 60+ Days
                </button>
                <button
                  onClick={() => setFilter((prev) => ({ ...prev, days_since: "90_plus", page: 1 }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
                    filter.days_since === "90_plus"
                      ? "bg-red-600 text-white"
                      : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200"
                  }`}
                >
                  <AlertTriangle size={12} /> 90+ Days
                </button>
                
                <div className="h-4 w-px bg-slate-300 mx-1"></div>

                <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white cursor-pointer hover:bg-slate-50 transition-all">
                  <input
                    type="checkbox"
                    checked={filter.needs_initial}
                    onChange={(e) => setFilter((prev) => ({ ...prev, needs_initial: e.target.checked, page: 1 }))}
                    className="rounded accent-[#0F4A2F]"
                  />
                  <span className="text-xs font-medium text-slate-700 flex items-center gap-1">
                    <Calendar size={12} /> Needs Initial Visit
                  </span>
                </label>

                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="ml-auto px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-all flex items-center gap-1"
                  >
                    <X size={12} /> Clear Filters
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3">
                {/* ✅ NEW: Program Status Dropdown */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-600">Program:</span>
                  <select
                    value={filter.program_status}
                    onChange={(e) => setFilter((prev) => ({ ...prev, program_status: e.target.value, page: 1 }))}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4A2F]/50 focus:border-[#0F4A2F] bg-white"
                  >
                    <option value="all">All Programs</option>
                    <option value="active">Active Programs</option>
                    <option value="inactive">Inactive / No Program</option>
                  </select>
                </div>

                <div className="relative flex-1 max-w-md">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search site or area name..."
                    value={filter.search}
                    onChange={(e) => setFilter((prev) => ({ ...prev, search: e.target.value, page: 1 }))}
                    onKeyDown={(e) => { if (e.key === "Enter") fetchSites(); }}
                    className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4A2F]/50 focus:border-[#0F4A2F] transition-shadow"
                  />
                </div>
                <select
                  value={filter.entries}
                  onChange={(e) => setFilter((prev) => ({ ...prev, entries: Number(e.target.value), page: 1 }))}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4A2F]/50 focus:border-[#0F4A2F] bg-white"
                >
                  {[10, 25, 50, 100].map((e) => (
                    <option key={e} value={e}>{e} per page</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
              {loadingSites && <LoaderPending />}
              <table className="min-w-full">
                <thead className="bg-[#0F4A2F] text-white sticky top-0 z-10">
                  <tr>
                    <th className="py-3 px-4 text-left text-[11px] font-semibold uppercase tracking-wider">No</th>
                    <th className="py-3 px-4 text-left text-[11px] font-semibold uppercase tracking-wider">Site Name</th>
                    <th className="py-3 px-4 text-left text-[11px] font-semibold uppercase tracking-wider">Area / Barangay</th>
                    <th className="py-3 px-4 text-left text-[11px] font-semibold uppercase tracking-wider">Last Report</th>
                    <th className="py-3 px-4 text-left text-[11px] font-semibold uppercase tracking-wider">Days Since</th>
                    <th className="py-3 px-4 text-left text-[11px] font-semibold uppercase tracking-wider">Status</th>
                    <th className="py-3 px-4 text-left text-[11px] font-semibold uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {sites.length > 0 ? (
                    sites.map((site, index) => {
                      const isUrgent = site.days_since_last_report !== null && site.days_since_last_report >= 90;
                      const isActive = site.active_application_status === "accepted" || site.active_application_status === "under_monitoring";

                      return (
                        <tr
                          key={site.site_id}
                          className={`hover:bg-slate-50 transition-colors ${index % 2 ? "bg-slate-50/30" : "bg-white"} ${isUrgent ? "bg-red-50/40 hover:bg-red-50/60" : ""}`}
                        >
                          <td className="py-3 px-4 text-xs text-slate-600">
                            {index + 1 + (filter.page - 1) * filter.entries}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-xs text-slate-800">{site.site_name}</span>
                              {site.needs_initial && (
                                <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-bold border border-blue-200">
                                  NEEDS INITIAL
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-col">
                              <span className="text-xs text-slate-700 font-medium">{site.reforestation_area_name || "N/A"}</span>
                              <span className="text-[10px] text-slate-500">{site.barangay_name || "N/A"}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-600">
                            {site.latest_report_date ? (
                              new Date(site.latest_report_date).toLocaleDateString("en-PH", {
                                month: "short", day: "numeric", year: "numeric",
                              })
                            ) : (
                              <span className="text-slate-400 italic">Never</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <DaysBadge days={site.days_since_last_report} />
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 rounded-full text-[10px] font-semibold border ${
                              isActive 
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                                : "bg-slate-100 text-slate-600 border-slate-200"
                            }`}>
                              {isActive ? "Active Program" : "Inactive / On Hold"}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <button
                              onClick={() => handleViewHistory(site.site_id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-semibold transition-colors shadow-sm bg-[#0F4A2F] hover:bg-[#1a6b44]"
                              title="View monitoring history and reports"
                            >
                              <FileCheck2 size={14} />
                              View History
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-400">
                        <div className="flex flex-col items-center gap-2">
                          <Leaf size={32} className="opacity-50" />
                          <p className="text-sm font-medium text-slate-600">
                            {filter.search || hasActiveFilters ? "No sites match your filters" : "No sites found"}
                          </p>
                          <p className="text-xs">
                            {hasActiveFilters ? "Try clearing filters to see more results" : "Add a site to start monitoring"}
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {filter.total_page > 1 && (
              <div className="p-3 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between">
                <span className="text-xs text-slate-600">
                  Page {filter.page} of {filter.total_page}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    disabled={filter.page <= 1}
                    onClick={() => setFilter((prev) => ({ ...prev, page: prev.page - 1 }))}
                    className="p-1.5 border border-slate-300 rounded-md disabled:opacity-50 hover:bg-white transition-colors"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  {Array.from({ length: Math.min(5, filter.total_page) }, (_, i) => {
                    let pageNum = i + 1;
                    if (filter.total_page > 5 && filter.page > 3) {
                      pageNum = Math.min(filter.page - 2 + i, filter.total_page);
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setFilter((prev) => ({ ...prev, page: pageNum }))}
                        className={`px-3 py-1.5 border rounded-md text-xs transition-colors ${
                          pageNum === filter.page
                            ? "bg-[#0F4A2F] text-white border-[#0F4A2F]"
                            : "border-slate-300 hover:bg-white"
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button
                    disabled={filter.page >= filter.total_page}
                    onClick={() => setFilter((prev) => ({ ...prev, page: prev.page + 1 }))}
                    className="p-1.5 border border-slate-300 rounded-md disabled:opacity-50 hover:bg-white transition-colors"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}