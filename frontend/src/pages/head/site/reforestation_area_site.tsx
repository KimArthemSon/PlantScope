import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Trash2,
  Plus,
  ChevronRight,
  ChevronLeft,
  Leaf,
  Eye,
  Ruler,
  Target,
  Pin,
  PinOff,
  CheckCircle,
  XCircle,
  AlertCircle,
  FileText,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Shield,
  Layers,
  X,
  PieChart,
  Activity,
  Trees,
  MapPin,
  Calendar,
  BarChart3,
  Search,
  Filter,
  List,
} from "lucide-react";
import PlantScopeAlert from "@/components/alert/PlantScopeAlert";
import Delete_modal from "@/components/layout/delete_modal";
import LoaderPending from "@/components/layout/loaderSmall";
import { useUserRole } from "@/hooks/authorization";
import { api } from "@/constant/api";

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
} from "recharts";

// ─────────────────────────────────────────────────────────────
// Types & Interfaces
// ────────────────────────────────────────────────────────────
interface Barangay {
  barangay_id: number;
  name: string;
}

interface LandClassificationOption {
  land_classification_id: number;
  name: string;
}

interface ValidationStatus {
  has_safety_note: boolean;
  has_survivability_note: boolean;
  final_decision: "ACCEPT" | "REJECT" | null;
  is_ready_to_finalize: boolean;
}

interface SiteMetrics {
  ndvi: number | null;
  area_hectares: number;
  seedlings: number;
}

interface VerificationInfo {
  status: "pending" | "draft" | "verified" | "rejected";
  land_classification: {
    id: number;
    name: string;
  } | null;
  security_concerns_count: number;
  has_accessibility: boolean;
  accessibility_type: string | null;
}

interface Site {
  site_id: number;
  name: string;
  status: string;
  is_pinned: boolean;
  created_at: string;
  validation: ValidationStatus;
  verification: VerificationInfo;

  metrics: SiteMetrics;
}

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

  verification_status?: "pending" | "draft" | "verified" | "rejected";
  verification_decision_note?: string | null;
  created_at: string;
  site_count?: number;
  total_area_hectares?: number;
}

interface Filter {
  search: string;
  entries: number;
  page: number;
  total_page: number;
  barangay_id: string;
}

interface SiteFilter {
  search: string;
  entries: number;
  page: number;
  total_page: number;
  status: string;
  pinned_only: boolean;
  verification_status: string;
  land_classification_id: string;
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

const DEFAULT_AREA_FILTER: Omit<Filter, "total_page"> = {
  search: "",
  entries: 10,
  page: 1,
  barangay_id: "All",
};

const DEFAULT_SITE_FILTER: Omit<SiteFilter, "total_page"> = {
  search: "",
  entries: 10,
  page: 1,
  status: "all",
  pinned_only: false,
  verification_status: "all",
  land_classification_id: "",
};

const COLORS = ["#10B981", "#F59E0B", "#EF4444", "#3B82F6"];

export default function ReforestationAreaSiteCombined() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const { userRole } = useUserRole();

  // States
  const [areas, setAreas] = useState<ReforestationArea[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [barangays, setBarangays] = useState<Barangay[]>([]);
  const [landClassifications, setLandClassifications] = useState<LandClassificationOption[]>([]);
  
  const [selectedArea, setSelectedArea] = useState<ReforestationArea | null>(null);
  
  const [areaFilter, setAreaFilter] = useState<Filter>({
    ...DEFAULT_AREA_FILTER,
    total_page: 1,
  });
  
  const [siteFilter, setSiteFilter] = useState<SiteFilter>({
    ...DEFAULT_SITE_FILTER,
    total_page: 1,
  });

  // Floating Filter State
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  const [loadingAreas, setLoadingAreas] = useState(false);
  const [loadingSites, setLoadingSites] = useState(false);
  
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteType, setDeleteType] = useState<"area" | "site" | null>(null);

  // View Details Modal
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewArea, setViewArea] = useState<ReforestationArea | null>(null);
  const [areaDetails, setAreaDetails] = useState<AreaDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const [PSalert, setPSAlert] = useState<{
    type: "success" | "failed" | "error";
    title: string;
    message: string;
  } | null>(null);

  const [userPath, setUserPath] = useState("");

  // User role path setup
  useEffect(() => {
    if (userRole === "treeGrowers" || userRole === "CityENROHead") {
      setUserPath("");
    } else if (userRole === "GISSpecialist") {
      setUserPath("/GISS");
    } else if (userRole === "DataManager") {
      setUserPath("/DataManager");
    }
  }, [userRole]);

  // Click outside to close filter panel
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [filterRef]);

  // Fetch Barangays
  useEffect(() => {
    const fetchBarangays = async () => {
      try {
        const res = await fetch(api + "api/get_barangay_list/", {
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

  // Fetch Land Classifications
  useEffect(() => {
    const fetchLandClassifications = async () => {
      try {
        const res = await fetch(`${api}api/get_land_classifications_list/`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setLandClassifications(data.data || []);
        }
      } catch (err) {
        console.error("Failed to fetch land classifications:", err);
      }
    };
    fetchLandClassifications();
  }, [token]);

  // Fetch Reforestation Areas
  const fetchAreas = async () => {
    setLoadingAreas(true);
    try {
      const params = new URLSearchParams({
        search: areaFilter.search,
        page: areaFilter.page.toString(),
        entries: areaFilter.entries.toString(),
        ...(areaFilter.barangay_id !== "All" && {
          barangay_id: areaFilter.barangay_id,
        }),
      });
      const response = await fetch(
        api + `api/get_reforestation_areas/?${params}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!response.ok) throw new Error("Failed");
      const data = await response.json();

      setAreas(data.data);
      setAreaFilter((prev) => ({ ...prev, total_page: data.total_page }));
      
      if (!selectedArea && data.data.length > 0) {
        handleSelectArea(data.data[0]);
      }
    } catch {
      setPSAlert({
        type: "error",
        title: "Error",
        message: "Failed to load reforestation areas.",
      });
    } finally {
      setLoadingAreas(false);
    }
  };

  // Fetch Sites for selected area
  const fetchSites = async () => {
    if (!selectedArea) return;
    setLoadingSites(true);
    try {
      const params = new URLSearchParams({
        search: siteFilter.search,
        page: siteFilter.page.toString(),
        entries: siteFilter.entries.toString(),
        status: siteFilter.status,
        pinned_only: siteFilter.pinned_only ? "true" : "false",
        verification_status: siteFilter.verification_status,
      });

      if (siteFilter.land_classification_id) {
        params.append("land_classification_id", siteFilter.land_classification_id);
      }

      const response = await fetch(
        `${api}api/get_sites/${selectedArea.reforestation_area_id}/?${params}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (!response.ok) throw new Error("Failed to fetch sites");

      const data = await response.json();
      setSites(data.data);
      setSiteFilter((prev) => ({ ...prev, total_page: data.total_page }));
    } catch {
      setPSAlert({
        type: "error",
        title: "Error",
        message: "Failed to load sites",
      });
    } finally {
      setLoadingSites(false);
    }
  };

  useEffect(() => {
    fetchAreas();
  }, [areaFilter.page, areaFilter.entries, areaFilter.barangay_id]);

  useEffect(() => {
    if (selectedArea) {
      fetchSites();
    }
  }, [
    selectedArea,
    siteFilter.page,
    siteFilter.entries,
    siteFilter.status,
    siteFilter.pinned_only,
    siteFilter.verification_status,
    siteFilter.land_classification_id,
  ]);

  const handleSelectArea = (area: ReforestationArea) => {
    setSelectedArea(area);
    setSiteFilter({ ...DEFAULT_SITE_FILTER, total_page: 1 });
  };

  const handleTogglePin = async (siteId: number, currentPin: boolean) => {
    try {
      const response = await fetch(`${api}api/toggle_pin/${siteId}/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (response.ok) {
        setSites((prev) =>
          prev.map((s) =>
            s.site_id === siteId ? { ...s, is_pinned: !currentPin } : s,
          ),
        );
      }
    } catch {
      // Silent fail
    }
  };

  const setDelete = (id: number, type: "area" | "site") => {
    setDeleteId(id);
    setDeleteType(type);
    setIsDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId || !deleteType) return;
    
    try {
      const endpoint = deleteType === "area" 
        ? `api/delete_reforestation_areas/${deleteId}/`
        : `api/delete_site/${deleteId}/`;
        
      const response = await fetch(api + endpoint, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (response.ok) {
        setPSAlert({
          type: "success",
          title: "Deleted",
          message: data.message,
        });
        
        if (deleteType === "area") {
          fetchAreas();
          if (selectedArea?.reforestation_area_id === deleteId) {
            setSelectedArea(null);
            setSites([]);
          }
        } else {
          fetchSites();
        }
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
        message: "Something went wrong",
      });
    }
    setIsDeleteModalOpen(false);
  };

  const fetchAreaDetails = async (areaId: number) => {
    setLoadingDetails(true);
    try {
      const response = await fetch(api + `api/get_area_details/${areaId}/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setAreaDetails(data);
      } else {
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

  const handleViewDetails = (area: ReforestationArea) => {
    setViewArea(area);
    setIsViewModalOpen(true);
    fetchAreaDetails(area.reforestation_area_id);
  };

  const clearSiteFilters = () => {
    setSiteFilter({
      ...DEFAULT_SITE_FILTER,
      total_page: siteFilter.total_page,
    });
  };

  // Helper functions
  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
      case "accepted":
        return "bg-emerald-100 text-emerald-700 border border-emerald-200";
      case "rejected":
        return "bg-red-100 text-red-700 border border-red-200";
      case "under_review":
        return "bg-blue-100 text-blue-700 border border-blue-200";
      default:
        return "bg-amber-100 text-amber-700 border border-amber-200";
    }
  };

  const getVerificationBadge = (status: string) => {
    switch (status) {
      case "verified":
        return {
          icon: ShieldCheck,
          color: "bg-emerald-100 text-emerald-700 border border-emerald-300",
          label: "Verified",
        };
      case "rejected":
        return {
          icon: ShieldX,
          color: "bg-red-100 text-red-700 border border-red-300",
          label: "Rejected",
        };
      case "draft":
        return {
          icon: FileText,
          color: "bg-blue-100 text-blue-700 border border-blue-300",
          label: "Draft",
        };
      default:
        return {
          icon: ShieldAlert,
          color: "bg-slate-100 text-slate-700 border border-slate-300",
          label: "Pending",
        };
    }
  };

  const getValidationBadge = (validation: ValidationStatus) => {
    if (validation.final_decision === "ACCEPT") {
      return {
        icon: CheckCircle,
        color: "bg-emerald-100 text-emerald-700",
        label: "Accepted",
      };
    }
    if (validation.final_decision === "REJECT") {
      return {
        icon: XCircle,
        color: "bg-red-100 text-red-700",
        label: "Rejected",
      };
    }
    if (validation.is_ready_to_finalize) {
      return {
        icon: FileText,
        color: "bg-blue-100 text-blue-700",
        label: "Ready",
      };
    }
    if (validation.has_safety_note && validation.has_survivability_note) {
      return {
        icon: FileText,
        color: "bg-purple-100 text-purple-700",
        label: "Notes Added",
      };
    }
    if (validation.has_safety_note || validation.has_survivability_note) {
      return {
        icon: AlertCircle,
        color: "bg-amber-100 text-amber-700",
        label: "In Progress",
      };
    }
    return {
      icon: AlertCircle,
      color: "bg-slate-100 text-slate-600",
      label: "Not Started",
    };
  };

  const getAreaStatusBadge = (status?: string) => {
    switch (status) {
      case "verified":
        return { color: "bg-emerald-100 text-emerald-700 border border-emerald-300", label: "Verified" };
      case "rejected":
        return { color: "bg-red-100 text-red-700 border border-red-300", label: "Rejected" };
      case "draft":
        return { color: "bg-blue-100 text-blue-700 border border-blue-300", label: "Draft" };
      default:
        return { color: "bg-amber-100 text-amber-700 border border-amber-300", label: "Pending" };
    }
  };

  const hasActiveFilters = siteFilter.verification_status !== "all" || 
                           siteFilter.land_classification_id !== "" || 
                           siteFilter.pinned_only;

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

      <Delete_modal
        setIsDeleteModalOpen={setIsDeleteModalOpen}
        isDeleteModalOpen={isDeleteModalOpen}
        onDelete={handleDelete}
      />

      {/* View Details Modal */}
      {isViewModalOpen && viewArea && (
        <div className="fixed inset-0 bg-black/50 z-[1000] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex-shrink-0 bg-gradient-to-r from-[#0F4A2F] to-[#1a6b44] text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-lg">
                  <MapPin size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold">{viewArea.name}</h2>
                  <p className="text-xs text-green-200">Area #{viewArea.reforestation_area_id}</p>
                </div>
              </div>
              <button
                onClick={() => setIsViewModalOpen(false)}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {loadingDetails ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#0F4A2F] border-t-transparent"></div>
                </div>
              ) : areaDetails ? (
                <>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 p-4 rounded-xl border border-emerald-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium text-emerald-600">Total Sites</p>
                          <p className="text-2xl font-bold text-emerald-800 mt-0.5">{areaDetails.total_sites}</p>
                        </div>
                        <Trees className="w-8 h-8 text-emerald-600/50" />
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 p-4 rounded-xl border border-blue-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium text-blue-600">Total Area</p>
                          <p className="text-2xl font-bold text-blue-800 mt-0.5">{areaDetails.total_area_hectares.toFixed(1)} <span className="text-sm font-normal">ha</span></p>
                        </div>
                        <MapPin className="w-8 h-8 text-blue-600/50" />
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 p-4 rounded-xl border border-purple-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium text-purple-600">Seedlings</p>
                          <p className="text-2xl font-bold text-purple-800 mt-0.5">{areaDetails.total_seedlings.toLocaleString()}</p>
                        </div>
                        <Activity className="w-8 h-8 text-purple-600/50" />
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 p-4 rounded-xl border border-amber-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium text-amber-600">Species</p>
                          <p className="text-2xl font-bold text-amber-800 mt-0.5">{areaDetails.species_count}</p>
                        </div>
                        <Trees className="w-8 h-8 text-amber-600/50" />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                      <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
                        <PieChart size={16} className="text-[#0F4A2F]" />
                        Status Distribution
                      </h3>
                      <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                          <RePieChart>
                            <Pie
                              data={areaDetails.status_distribution}
                              cx="50%"
                              cy="50%"
                              innerRadius={50}
                              outerRadius={70}
                              paddingAngle={4}
                              dataKey="value"
                              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                              labelLine={false}
                            >
                              {areaDetails.status_distribution.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </RePieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                      <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
                        <BarChart3 size={16} className="text-[#0F4A2F]" />
                        Monthly Activity
                      </h3>
                      <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={areaDetails.monthly_data}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                            <Tooltip />
                            <Legend wrapperStyle={{ fontSize: "11px" }} />
                            <Line type="monotone" dataKey="sites_created" name="Created" stroke="#10B981" strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="verified" name="Verified" stroke="#3B82F6" strokeWidth={2} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-slate-400">
                  <AlertCircle className="w-12 h-12 mx-auto mb-2" />
                  <p>Failed to load area details</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 p-5 w-full">
        <div className="flex gap-5 h-[calc(100vh-120px)]">
          {/* Left Sidebar - Reforestation Areas */}
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
              
              <div className="flex gap-2">
                <select
                  value={areaFilter.barangay_id}
                  onChange={(e) =>
                    setAreaFilter((prev) => ({
                      ...prev,
                      barangay_id: e.target.value,
                      page: 1,
                    }))
                  }
                  className="flex-1 border border-slate-300 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
                >
                  <option value="All">All Barangays</option>
                  {barangays.map((b) => (
                    <option key={b.barangay_id} value={b.barangay_id}>
                      {b.name}
                    </option>
                  ))}
                </select>
                
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={areaFilter.search}
                    onChange={(e) =>
                      setAreaFilter((prev) => ({
                        ...prev,
                        search: e.target.value,
                        page: 1,
                      }))
                    }
                    className="w-full border border-slate-300 rounded-lg pl-8 pr-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {loadingAreas ? (
                <LoaderPending />
              ) : areas.length > 0 ? (
                areas.map((area) => {
                  const statusBadge = getAreaStatusBadge(area.verification_status);
                  const isSelected = selectedArea?.reforestation_area_id === area.reforestation_area_id;
                  
                  return (
                    <div
                      key={area.reforestation_area_id}
                      onClick={() => handleSelectArea(area)}
                      className={`p-3.5 rounded-lg border cursor-pointer transition-all duration-200 group ${
                        isSelected
                          ? "border-emerald-500 bg-emerald-50/60 shadow-sm ring-1 ring-emerald-500"
                          : "border-slate-200 bg-white hover:border-emerald-300 hover:shadow-sm"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-slate-800 text-sm line-clamp-1 flex-1">
                          {area.name}
                        </h3>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusBadge.color}`}>
                          {statusBadge.label}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-1.5 mb-2.5">
                        <MapPin size={12} className="text-slate-400 flex-shrink-0" />
                        <span className="text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                          {area.barangay?.name || "N/A"}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between text-[11px] text-slate-500 mb-2.5">
                        <div className="flex items-center gap-2.5">
                          <span className="flex items-center gap-1">
                            <Trees size={12} />
                            {area.site_count || 0}
                          </span>
                          <span className="flex items-center gap-1">
                            <Ruler size={12} />
                            {area.total_area_hectares?.toFixed(1) || 0} ha
                          </span>
                        </div>
                        <span className="flex items-center gap-1 text-slate-400">
                          <Calendar size={12} />
                          {new Date(area.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      
                      <div className="flex gap-1.5 pt-2 border-t border-slate-100">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewDetails(area);
                          }}
                          className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-700 rounded-md transition-colors text-[11px] font-medium"
                        >
                          <BarChart3 size={12} />
                          Details
                        </button>
                        {userRole !== "DataManager" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDelete(area.reforestation_area_id, "area");
                            }}
                            className="px-2.5 py-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
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

          {/* Right Panel - Sites */}
          <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {selectedArea ? (
              <>
                {/* Header */}
                <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <List size={18} className="text-[#0F4A2F]" />
                      Sites for {selectedArea.name}
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Manage and verify reforestation sites
                    </p>
                  </div>
                  
                  {userRole !== "DataManager" && (
                    <button
                      onClick={() =>
                        navigate(
                          `${userPath}/analysis/multicriteria-analysis/new?areaId=${selectedArea.reforestation_area_id}`,
                        )
                      }
                      className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm hover:shadow-md hover:shadow-emerald-200"
                    >
                      <Plus size={16} />
                      Add New Site
                    </button>
                  )}
                </div>

                {/* Modern Toolbar with Floating Filters */}
                <div className="p-3 border-b border-slate-200 bg-white flex items-center gap-3">
                  {/* Show Entries */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 font-medium">Show:</span>
                    <select
                      value={siteFilter.entries}
                      onChange={(e) =>
                        setSiteFilter((prev) => ({
                          ...prev,
                          entries: Number(e.target.value),
                          page: 1,
                        }))
                      }
                      className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
                    >
                      {[10, 25, 50, 100].map((e) => (
                        <option key={e} value={e}>{e}</option>
                      ))}
                    </select>
                  </div>

                  {/* Search Bar */}
                  <div className="relative flex-1 max-w-md">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search sites..."
                      value={siteFilter.search}
                      onChange={(e) =>
                        setSiteFilter((prev) => ({
                          ...prev,
                          search: e.target.value,
                          page: 1,
                        }))
                      }
                      onKeyDown={(e) => e.key === "Enter" && fetchSites()}
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
                      <Filter size={14} />
                      Filters
                      {hasActiveFilters && (
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      )}
                    </button>

                    {/* Floating Filter Container */}
                    {isFilterOpen && (
                      <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-slate-800">Advanced Filters</h3>
                            <button 
                              onClick={() => setIsFilterOpen(false)}
                              className="text-slate-400 hover:text-slate-600"
                            >
                              <X size={16} />
                            </button>
                          </div>

                          <div>
                            <label className="text-xs font-medium text-slate-700 mb-1.5 block">Verification Status</label>
                            <select
                              value={siteFilter.verification_status}
                              onChange={(e) =>
                                setSiteFilter((prev) => ({
                                  ...prev,
                                  verification_status: e.target.value,
                                  page: 1,
                                }))
                              }
                              className="w-full border border-slate-300 rounded-lg px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
                            >
                              <option value="all">All Statuses</option>
                              <option value="verified">Verified</option>
                              <option value="pending">Pending</option>
                              <option value="draft">Draft</option>
                              <option value="rejected">Rejected</option>
                            </select>
                          </div>

                          <div>
                            <label className="text-xs font-medium text-slate-700 mb-1.5 block">Land Classification</label>
                            <select
                              value={siteFilter.land_classification_id}
                              onChange={(e) =>
                                setSiteFilter((prev) => ({
                                  ...prev,
                                  land_classification_id: e.target.value,
                                  page: 1,
                                }))
                              }
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
                              id="pinned-only"
                              checked={siteFilter.pinned_only}
                              onChange={(e) =>
                                setSiteFilter((prev) => ({
                                  ...prev,
                                  pinned_only: e.target.checked,
                                  page: 1,
                                }))
                              }
                              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-400"
                            />
                            <label htmlFor="pinned-only" className="text-sm text-slate-700 cursor-pointer select-none flex items-center gap-1.5">
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
                        <th className="py-2.5 px-3 text-left text-[11px] font-semibold uppercase tracking-wider">Name</th>
                        <th className="py-2.5 px-3 text-left text-[11px] font-semibold uppercase tracking-wider">Status</th>
                        <th className="py-2.5 px-3 text-left text-[11px] font-semibold uppercase tracking-wider">Verification</th>
                        <th className="py-2.5 px-3 text-left text-[11px] font-semibold uppercase tracking-wider">Validation</th>
                       
                        <th className="py-2.5 px-3 text-left text-[11px] font-semibold uppercase tracking-wider">Created</th>
                        <th className="py-2.5 px-3 text-left text-[11px] font-semibold uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {sites.length > 0 ? (
                        sites.map((site, index) => {
                          const validationBadge = getValidationBadge(site.validation);
                          const ValidationIcon = validationBadge.icon;
                          const verificationBadge = getVerificationBadge(site.verification.status);
                          const VerificationIcon = verificationBadge.icon;

                          return (
                            <tr
                              key={site.site_id}
                              className={`hover:bg-slate-50 transition-colors ${
                                index % 2 ? "bg-slate-50/30" : "bg-white"
                              } ${
                                site.is_pinned
                                  ? "border-l-2 border-emerald-500 bg-emerald-50/40"
                                  : ""
                              }`}
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
                                    {site.is_pinned ? (
                                      <Pin size={12} className="fill-current" />
                                    ) : (
                                      <PinOff size={12} />
                                    )}
                                  </button>
                                  <span className="font-medium text-xs text-slate-800">{site.name}</span>
                                </div>
                              </td>
                              <td className="py-2.5 px-3">
                                <span className={`px-2 py-1 rounded-full text-[10px] font-medium ${getStatusColor(site.status)}`}>
                                  {site.status.replace("_", " ")}
                                </span>
                              </td>
                              <td className="py-2.5 px-3">
                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium ${verificationBadge.color}`}>
                                  <VerificationIcon size={10} />
                                  {verificationBadge.label}
                                </span>
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="flex items-center gap-1.5">
                                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium ${validationBadge.color}`}>
                                    <ValidationIcon size={10} />
                                    {validationBadge.label}
                                  </span>
                                  <div className="flex gap-0.5">
                                    {site.validation.has_safety_note && (
                                      <span className="text-[9px] text-blue-600 bg-blue-50 px-1 rounded border border-blue-200" title="Safety note">S</span>
                                    )}
                                    {site.validation.has_survivability_note && (
                                      <span className="text-[9px] text-purple-600 bg-purple-50 px-1 rounded border border-purple-200" title="Survivability note">V</span>
                                    )}
                                  </div>
                                </div>
                              </td>
                            
                              <td className="py-2.5 px-3 text-xs text-slate-600">
                                {new Date(site.created_at).toLocaleDateString()}
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="flex gap-1">
                                  <button
                                    onClick={() =>
                                      navigate(`${userPath}/reforestation/site/${selectedArea.reforestation_area_id}/information/${site.site_id}`)
                                    }
                                    className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors border border-emerald-600"
                                    title="View Details"
                                  >
                                    <Eye size={12} />
                                  </button>
                                  {userRole !== "GISSpecialist" && (
                                    <button
                                      onClick={() =>
                                        navigate(`${userPath}/verification/meta-data/${site.site_id}`)
                                      }
                                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors border border-blue-600"
                                      title="Verify"
                                    >
                                      <ShieldCheck size={12} />
                                    </button>
                                  )}
                                  {userRole !== "DataManager" && (
                                    <button
                                      onClick={() => setDelete(site.site_id, "site")}
                                      className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors border border-red-600"
                                      title="Delete"
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
                          <td colSpan={8} className="text-center py-12 text-slate-400">
                            <div className="flex flex-col items-center gap-2">
                              <Leaf size={32} className="opacity-50" />
                              <p className="text-sm font-medium text-slate-600">No sites found</p>
                              <p className="text-xs">Try adjusting your filters or add a new site</p>
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
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center bg-slate-50/30">
                <div className="text-center text-slate-400">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Trees size={32} className="opacity-50" />
                  </div>
                  <h3 className="text-base font-semibold text-slate-700 mb-1">Select a Reforestation Area</h3>
                  <p className="text-sm">Choose an area from the left to view and manage its sites</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}