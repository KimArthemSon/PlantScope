import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  Clock,
  Eye,
  Trash2,
  Pin,
  PinOff,
  XCircle,
  AlertCircle,
  FileCheck,
  ShieldCheck,
  Filter as FilterIcon,
  X,
  Activity,
  Trees,
  Search,
  Globe,
  MapPin,
} from "lucide-react";
import PlantScopeAlert from "@/components/alert/PlantScopeAlert";
import Delete_modal from "@/components/layout/delete_modal";
import LoaderPending from "@/components/layout/loaderSmall";
import { useUserRole } from "@/hooks/authorization";
import { api } from "@/constant/api";

// ─────────────────────────────────────────────────────────────
// Types & Interfaces
// ─────────────────────────────────────────────────────────────
interface VerificationInfo {
  status: "pending" | "draft" | "verified" | "rejected";
  land_classification: { id: number; name: string } | null;
  security_concerns_count: number;
  has_accessibility: boolean;
  accessibility_type: string | null;
  verified_animals_count: number;
}

interface ValidationStatus {
  has_safety_note: boolean;
  has_survivability_note: boolean;
  final_decision: "ACCEPT" | "REJECT" | null;
  is_ready_to_finalize: boolean;
}

interface Site {
  site_id: number;
  reforestation_area_id: number;
  reforestation_area: string;
  barangay: string;
  name: string;
  status: string;
  program_status: "available" | "ongoing" | "completed";
  is_pinned: boolean;
  created_at: string;
  validation: ValidationStatus;
  verification: VerificationInfo;
  permit_count: number;
  metrics: { area_hectares: number };
}

interface Barangay {
  barangay_id: number;
  name: string;
}

interface AreaOption {
  reforestation_area_id: number;
  name: string;
  barangay?: { barangay_id: number; name: string } | null;
  site_stats?: {
    total: number;
    accepted_verified: number;
    accepted: number;
    pending: number;
  };
}

interface LandClassificationOption {
  land_classification_id: number;
  name: string;
}

// Parent Level Filters (Areas)
interface AreaFilter {
  search: string;
  entries: number;
  page: number;
  total_page: number;
  barangay_id: string;
}

// Child Level Filters (Sites)
interface SiteFilter {
  search: string;
  entries: number;
  page: number;
  total_page: number;
  pinned_only: boolean;
  land_classification_id: string;
  program_status: string;
  status: string;
}

const DEFAULT_AREA_FILTER: Omit<AreaFilter, "total_page"> = {
  search: "",
  entries: 10,
  page: 1,
  barangay_id: "all",
};

const DEFAULT_SITE_FILTER: Omit<SiteFilter, "total_page"> = {
  search: "",
  entries: 10,
  page: 1,
  pinned_only: false,
  land_classification_id: "",
  program_status: "",
  status: "all",
};

export default function OfficialSites() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const { userRole } = useUserRole();

  const [areas, setAreas] = useState<AreaOption[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [barangays, setBarangays] = useState<Barangay[]>([]);
  const [landClassifications, setLandClassifications] = useState<LandClassificationOption[]>([]);
  
  const [selectedArea, setSelectedArea] = useState<AreaOption | null>(null);
  
  const [areaFilter, setAreaFilter] = useState<AreaFilter>({
    ...DEFAULT_AREA_FILTER,
    total_page: 1,
  });

  const [siteFilter, setSiteFilter] = useState<SiteFilter>({
    ...DEFAULT_SITE_FILTER,
    total_page: 1,
  });

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  
  const [loadingAreas, setLoadingAreas] = useState(false);
  const [loadingSites, setLoadingSites] = useState(false);
  
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const [PSalert, setPSAlert] = useState<{
    type: "success" | "failed" | "error";
    title: string;
    message: string;
  } | null>(null);

  const [userPath, setUserPath] = useState("");

  useEffect(() => {
    if (userRole === "treeGrowers" || userRole === "CityENROHead") setUserPath("");
    else if (userRole === "GISSpecialist") setUserPath("/GISS");
    else if (userRole === "DataManager") setUserPath("/DataManager");
  }, [userRole]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [filterRef]);

  // Fetch Dropdown Options
  useEffect(() => {
    const fetchDropdowns = async () => {
      try {
        const [bRes, lcRes] = await Promise.all([
          fetch(`${api}api/get_barangay_list/`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${api}api/get_land_classifications_list/`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        if (bRes.ok) setBarangays((await bRes.json()).data || []);
        if (lcRes.ok) setLandClassifications((await lcRes.json()).data || []);
      } catch (err) {
        console.error("Failed to fetch dropdowns:", err);
      }
    };
    fetchDropdowns();
  }, [token]);

  // Fetch Reforestation Areas (Parent Level)
  const fetchAreas = async () => {
    setLoadingAreas(true);
    try {
      const params = new URLSearchParams({
        search: areaFilter.search,
        page: areaFilter.page.toString(),
        entries: areaFilter.entries.toString(),
      });
      if (areaFilter.barangay_id && areaFilter.barangay_id !== "all") {
        params.append("barangay_id", areaFilter.barangay_id);
      }

      const response = await fetch(`${api}api/get_reforestation_areas/?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setAreas(data.data || []);
        setAreaFilter((prev) => ({ ...prev, total_page: data.total_page }));
      }
    } catch (err) {
      console.error("Failed to fetch areas:", err);
    } finally {
      setLoadingAreas(false);
    }
  };

  // Fetch Official Sites (Child Level)
  const fetchSites = async () => {
    setLoadingSites(true);
    try {
      const params = new URLSearchParams({
        search: siteFilter.search,
        page: siteFilter.page.toString(),
        entries: siteFilter.entries.toString(),
        status: siteFilter.status,
        pinned_only: siteFilter.pinned_only ? "true" : "false",
      });

      // Context: Which area are we looking at?
      if (selectedArea) {
        params.append("reforestation_area_id", selectedArea.reforestation_area_id.toString());
      }

      // Site-specific filters
      if (siteFilter.land_classification_id) params.append("land_classification_id", siteFilter.land_classification_id);
      if (siteFilter.program_status) params.append("program_status", siteFilter.program_status);

      const response = await fetch(`${api}api/get_official_sites/?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error("Failed to fetch official sites");

      const data = await response.json();
      setSites(data.data || []);
      setSiteFilter((prev) => ({ ...prev, total_page: data.total_page }));
    } catch {
      setPSAlert({ type: "error", title: "Error", message: "Failed to load official sites" });
    } finally {
      setLoadingSites(false);
    }
  };

  // Triggers for Parent (Areas)
  useEffect(() => {
    const timer = setTimeout(() => { fetchAreas(); }, 400);
    return () => clearTimeout(timer);
  }, [areaFilter.page, areaFilter.entries, areaFilter.barangay_id, areaFilter.search]);

  // Triggers for Child (Sites)
  useEffect(() => {
    const timer = setTimeout(() => { fetchSites(); }, 400);
    return () => clearTimeout(timer);
  }, [
    selectedArea,
    siteFilter.page,
    siteFilter.entries,
    siteFilter.pinned_only,
    siteFilter.land_classification_id,
    siteFilter.program_status,
    siteFilter.status,
    siteFilter.search,
  ]);

  const handleSelectArea = (area: AreaOption | null) => {
    setSelectedArea(area);
    // Reset child filters when changing parent context
    setSiteFilter({ ...DEFAULT_SITE_FILTER, total_page: 1 });
  };

  const handleTogglePin = async (siteId: number, currentPin: boolean) => {
    try {
      const response = await fetch(`${api}api/toggle_pin/${siteId}/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      if (response.ok) {
        setSites((prev) => prev.map((s) => s.site_id === siteId ? { ...s, is_pinned: !currentPin } : s));
      }
    } catch {}
  };

  const setDelete = (siteId: number) => {
    setDeleteId(siteId);
    setIsDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const response = await fetch(`${api}api/delete_site/${deleteId}/`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.ok) {
        setPSAlert({ type: "success", title: "Deleted", message: data.message });
        fetchSites();
      } else {
        setPSAlert({ type: "failed", title: "Failed", message: data.message || "Delete failed" });
      }
    } catch {
      setPSAlert({ type: "error", title: "Error", message: "Something went wrong" });
    }
    setIsDeleteModalOpen(false);
  };

  const clearSiteFilters = () => {
    setSiteFilter({ ...DEFAULT_SITE_FILTER, total_page: siteFilter.total_page });
  };

  const getSiteStatusBadge = (status: string) => {
    switch (status) {
      case "accepted": return { icon: CheckCircle, color: "bg-emerald-100 text-emerald-700", label: "Accepted" };
      case "under_monitoring": return { icon: Activity, color: "bg-blue-100 text-blue-700", label: "Monitoring" };
      case "completed": return { icon: FileCheck, color: "bg-purple-100 text-purple-700", label: "Completed" };
      case "rejected": return { icon: XCircle, color: "bg-red-100 text-red-700", label: "Rejected" };
      default: return { icon: AlertCircle, color: "bg-slate-100 text-slate-600", label: status };
    }
  };

  const getProgramStatusBadge = (ps: string) => {
    switch (ps) {
      case "ongoing": return { icon: Clock, color: "bg-blue-100 text-blue-700 border border-blue-300", label: "Ongoing" };
      case "completed": return { icon: FileCheck, color: "bg-purple-100 text-purple-700 border border-purple-300", label: "Completed" };
      default: return { icon: ShieldCheck, color: "bg-emerald-100 text-emerald-700 border border-emerald-300", label: "Available" };
    }
  };

  const hasActiveFilters =
    siteFilter.land_classification_id !== "" ||
    siteFilter.program_status !== "" ||
    siteFilter.status !== "all" ||
    siteFilter.pinned_only;

  return (
    <div className="flex min-h-dvh bg-slate-50">
      {PSalert && <PlantScopeAlert type={PSalert.type} title={PSalert.title} message={PSalert.message} onClose={() => setPSAlert(null)} />}
      <Delete_modal setIsDeleteModalOpen={setIsDeleteModalOpen} isDeleteModalOpen={isDeleteModalOpen} onDelete={handleDelete} />

      <main className="flex-1 p-5 w-full">
        <div className="flex gap-5 h-[calc(100vh-120px)]">
          
          {/* ───────────────────────────────────────────── */}
          {/* Left Sidebar - Reforestation Areas (Parent) */}
          {/* ───────────────────────────────────────────── */}
          <div className="w-96 flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50/50">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                  <Trees size={18} className="text-[#0F4A2F]" />
                  Reforestation Areas
                </h2>
                <span className="text-xs text-slate-500 bg-slate-200 px-2 py-1 rounded-full">
                  {areas.length}
                </span>
              </div>
              
              {/* Area Search */}
              <div className="relative mb-2">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search areas..."
                  value={areaFilter.search}
                  onChange={(e) => setAreaFilter((prev) => ({ ...prev, search: e.target.value, page: 1 }))}
                  className="w-full border border-slate-300 rounded-lg pl-8 pr-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>

              {/* Area Barangay Filter */}
              <select
                value={areaFilter.barangay_id}
                onChange={(e) => setAreaFilter((prev) => ({ ...prev, barangay_id: e.target.value, page: 1 }))}
                className="w-full border border-slate-300 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
              >
                <option value="all">All Barangays</option>
                {barangays.map((b) => (
                  <option key={b.barangay_id} value={b.barangay_id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {/* "All Reforestation Areas" option */}
              <div
                onClick={() => handleSelectArea(null)}
                className={`p-3.5 rounded-lg border cursor-pointer transition-all duration-200 ${
                  selectedArea === null
                    ? "border-emerald-500 bg-emerald-50/60 shadow-sm ring-1 ring-emerald-500"
                    : "border-slate-200 bg-white hover:border-emerald-300 hover:shadow-sm"
                }`}
              >
                <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2 mb-1">
                  <Globe size={14} className="text-[#0F4A2F]" />
                  All Reforestation Areas
                </h3>
                <p className="text-[10px] text-slate-500">View official sites from all areas</p>
              </div>

              {/* Individual Areas */}
              {loadingAreas ? (
                <LoaderPending />
              ) : areas.length > 0 ? (
                areas.map((area) => {
                  const isSelected = selectedArea?.reforestation_area_id === area.reforestation_area_id;
                  return (
                    <div
                      key={area.reforestation_area_id}
                      onClick={() => handleSelectArea(area)}
                      className={`p-3.5 rounded-lg border cursor-pointer transition-all duration-200 ${
                        isSelected
                          ? "border-emerald-500 bg-emerald-50/60 shadow-sm ring-1 ring-emerald-500"
                          : "border-slate-200 bg-white hover:border-emerald-300 hover:shadow-sm"
                      }`}
                    >
                      <h3 className="font-semibold text-slate-800 text-sm line-clamp-1 flex-1 mb-1">
                        {area.name}
                      </h3>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <MapPin size={12} className="text-slate-400 flex-shrink-0" />
                        <span className="text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                          {area.barangay?.name || "N/A"}
                        </span>
                      </div>
                      <div className="flex gap-2 text-[10px] text-slate-500">
                        <span className="flex items-center gap-0.5 text-emerald-600">
                          <CheckCircle size={10} />
                          {area.site_stats?.accepted_verified ?? 0} verified
                        </span>
                        <span className="text-slate-400">
                          / {area.site_stats?.total ?? 0} total
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

            {/* Area Pagination */}
            <div className="p-2.5 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between">
              <button
                disabled={areaFilter.page <= 1}
                onClick={() => setAreaFilter((prev) => ({ ...prev, page: prev.page - 1 }))}
                className="p-1.5 border border-slate-300 rounded-md disabled:opacity-50 hover:bg-white transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-xs text-slate-600">
                Page {areaFilter.page} of {areaFilter.total_page}
              </span>
              <button
                disabled={areaFilter.page >= areaFilter.total_page}
                onClick={() => setAreaFilter((prev) => ({ ...prev, page: prev.page + 1 }))}
                className="p-1.5 border border-slate-300 rounded-md disabled:opacity-50 hover:bg-white transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          {/* ───────────────────────────────────────────── */}
          {/* Right Panel - Official Sites (Child) */}
          {/* ───────────────────────────────────────────── */}
          <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 bg-slate-50/50">
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="text-emerald-600" size={22} />
                <h2 className="text-lg font-bold text-slate-800">
                  {selectedArea
                    ? `Official Sites for ${selectedArea.name}`
                    : "Official Sites — All Areas"}
                </h2>
              </div>
              <p className="text-xs text-slate-500 ml-9">
                {selectedArea
                  ? "Verified sites in this reforestation area"
                  : "Verified sites across all reforestation areas"}
              </p>
            </div>

            {/* Toolbar */}
            <div className="p-3 border-b border-slate-200 bg-white flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-medium">Show:</span>
                <select
                  value={siteFilter.entries}
                  onChange={(e) => setSiteFilter((prev) => ({ ...prev, entries: Number(e.target.value), page: 1 }))}
                  className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
                >
                  {[10, 25, 50, 100].map((e) => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>
              </div>

              <div className="relative flex-1 max-w-md">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search sites..."
                  value={siteFilter.search}
                  onChange={(e) => setSiteFilter((prev) => ({ ...prev, search: e.target.value, page: 1 }))}
                  className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 transition-shadow"
                />
              </div>

              {/* Filter Button & Floating Panel */}
              <div className="relative ml-auto" ref={filterRef}>
                <button
                  onClick={() => setIsFilterOpen(!isFilterOpen)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                    isFilterOpen
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm"
                      : hasActiveFilters
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                        : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <FilterIcon size={14} />
                  Filters
                  {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-emerald-500"></span>}
                </button>

                {isFilterOpen && (
                  <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-slate-800">Site Filters</h3>
                        <button onClick={() => setIsFilterOpen(false)} className="text-slate-400 hover:text-slate-600">
                          <X size={16} />
                        </button>
                      </div>

                      {/* Site Status */}
                      <div>
                        <label className="text-xs font-medium text-slate-700 mb-1.5 block">Site Status</label>
                        <select
                          value={siteFilter.status}
                          onChange={(e) => setSiteFilter((prev) => ({ ...prev, status: e.target.value, page: 1 }))}
                          className="w-full border border-emerald-300 bg-emerald-50 rounded-lg px-2.5 py-2 text-sm text-emerald-800 outline-none focus:ring-2 focus:ring-emerald-400"
                        >
                          <option value="all">All Statuses</option>
                          <option value="accepted">Accepted</option>
                          <option value="under_monitoring">Under Monitoring</option>
                          <option value="completed">Completed</option>
                          <option value="rejected">Rejected</option>
                        </select>
                      </div>

                      {/* Program Status */}
                      <div>
                        <label className="text-xs font-medium text-slate-700 mb-1.5 block">Program Status</label>
                        <select
                          value={siteFilter.program_status}
                          onChange={(e) => setSiteFilter((prev) => ({ ...prev, program_status: e.target.value, page: 1 }))}
                          className="w-full border border-slate-300 rounded-lg px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400"
                        >
                          <option value="">All Programs</option>
                          <option value="available">Available (No Program)</option>
                          <option value="ongoing">Ongoing Program</option>
                          <option value="completed">Completed Program</option>
                        </select>
                      </div>

                      {/* Land Classification */}
                      <div>
                        <label className="text-xs font-medium text-slate-700 mb-1.5 block">Land Classification</label>
                        <select
                          value={siteFilter.land_classification_id}
                          onChange={(e) => setSiteFilter((prev) => ({ ...prev, land_classification_id: e.target.value, page: 1 }))}
                          className="w-full border border-purple-200 bg-purple-50 rounded-lg px-2.5 py-2 text-sm text-purple-800 outline-none focus:ring-2 focus:ring-purple-400"
                        >
                          <option value="">All Classifications</option>
                          {landClassifications.map((lc) => (
                            <option key={lc.land_classification_id} value={lc.land_classification_id}>
                              {lc.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                        <input
                          type="checkbox"
                          id="pinned-only-official"
                          checked={siteFilter.pinned_only}
                          onChange={(e) => setSiteFilter((prev) => ({ ...prev, pinned_only: e.target.checked, page: 1 }))}
                          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-400"
                        />
                        <label htmlFor="pinned-only-official" className="text-sm text-slate-700 cursor-pointer select-none flex items-center gap-1.5">
                          <Pin size={14} className={siteFilter.pinned_only ? "text-emerald-600" : "text-slate-400"} />
                          Pinned only
                        </label>
                      </div>

                      <div className="flex gap-2 pt-3">
                        <button
                          onClick={clearSiteFilters}
                          className="flex-1 px-3 py-2 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                        >
                          Clear All
                        </button>
                        <button
                          onClick={() => setIsFilterOpen(false)}
                          className="flex-1 px-3 py-2 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
                        >
                          Apply & Close
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Sites Table */}
            <div className="flex-1 overflow-auto">
              {loadingSites && <LoaderPending />}
              <table className="min-w-full">
                <thead className="bg-[#0F4A2F] text-white sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3 text-left text-[11px] font-semibold uppercase tracking-wider">No</th>
                    <th className="py-2.5 px-3 text-left text-[11px] font-semibold uppercase tracking-wider">
                      <Pin size={12} className="inline mr-1 -mt-0.5" /> Name
                    </th>
                    <th className="py-2.5 px-3 text-left text-[11px] font-semibold uppercase tracking-wider">
                      <MapPin size={12} className="inline mr-1 -mt-0.5" /> Location
                    </th>
                    <th className="py-2.5 px-3 text-left text-[11px] font-semibold uppercase tracking-wider">Site Status</th>
                    <th className="py-2.5 px-3 text-left text-[11px] font-semibold uppercase tracking-wider">Program</th>
                    <th className="py-2.5 px-3 text-left text-[11px] font-semibold uppercase tracking-wider">Land Class.</th>
                    <th className="py-2.5 px-3 text-left text-[11px] font-semibold uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {sites.length > 0 ? (
                    sites.map((site, index) => {
                      const siteBadge = getSiteStatusBadge(site.status);
                      const SiteIcon = siteBadge.icon;
                      const programBadge = getProgramStatusBadge(site.program_status);
                      const ProgramIcon = programBadge.icon;

                      return (
                        <tr
                          key={site.site_id}
                          className={`hover:bg-slate-50 transition-colors ${
                            index % 2 ? "bg-slate-50/30" : "bg-white"
                          } ${site.is_pinned ? "border-l-2 border-emerald-500 bg-emerald-50/40" : ""}`}
                        >
                          <td className="py-2.5 px-3 text-xs text-slate-600">
                            {index + 1 + (siteFilter.page - 1) * siteFilter.entries}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleTogglePin(site.site_id, site.is_pinned)}
                                className={`p-0.5 rounded hover:bg-slate-200 transition ${
                                  site.is_pinned ? "text-emerald-600" : "text-slate-400"
                                }`}
                              >
                                {site.is_pinned ? <Pin size={12} className="fill-current" /> : <PinOff size={12} />}
                              </button>
                              <span className="font-medium text-xs text-slate-800">{site.name}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex flex-col">
                              <span className="text-xs text-slate-700 font-medium">{site.barangay}</span>
                              <span className="text-[10px] text-slate-500">{site.reforestation_area}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium ${siteBadge.color}`}>
                              <SiteIcon size={10} /> {siteBadge.label}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium ${programBadge.color}`}>
                              <ProgramIcon size={10} /> {programBadge.label}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            {site.verification.land_classification ? (
                              <span className="text-xs font-medium text-slate-700 bg-blue-50 px-2 py-1 rounded border border-blue-200">
                                {site.verification.land_classification.name}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400 italic">Not set</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex gap-1">
                              <button
                                onClick={() => navigate(`${userPath}/official-reforestation/site/${site.reforestation_area_id}/information/${site.site_id}`)}
                                className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded-md transition-colors border border-emerald-700"
                                title="View Details"
                              >
                                <Eye size={12} />
                              </button>
                              {userRole !== "DataManager" && (
                                <button
                                  onClick={() => setDelete(site.site_id)}
                                  className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors border border-red-600"
                                  title="Delete Site"
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-400">
                        <div className="flex flex-col items-center gap-2">
                          <ShieldCheck size={32} className="opacity-50" />
                          <p className="text-sm font-medium text-slate-600">No official sites found</p>
                          <p className="text-xs">Sites must be accepted/official and verified to appear here</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Site Pagination */}
            <div className="p-2.5 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between">
              <button
                disabled={siteFilter.page <= 1}
                onClick={() => setSiteFilter((prev) => ({ ...prev, page: prev.page - 1 }))}
                className="p-1.5 border border-slate-300 rounded-md disabled:opacity-50 hover:bg-white transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              <div className="flex gap-1">
                {Array.from({ length: Math.min(siteFilter.total_page, 5) }, (_, i) => {
                  let pageNum = i + 1;
                  if (siteFilter.total_page > 5 && siteFilter.page > 3) {
                    pageNum = Math.min(siteFilter.page - 2 + i, siteFilter.total_page);
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setSiteFilter((prev) => ({ ...prev, page: pageNum }))}
                      className={`px-2.5 py-1.5 border rounded-md text-xs transition-colors ${
                        pageNum === siteFilter.page
                          ? "bg-[#0F4A2F] text-white border-[#0F4A2F]"
                          : "border-slate-300 hover:bg-white"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              <button
                disabled={siteFilter.page >= siteFilter.total_page}
                onClick={() => setSiteFilter((prev) => ({ ...prev, page: prev.page + 1 }))}
                className="p-1.5 border border-slate-300 rounded-md disabled:opacity-50 hover:bg-white transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}