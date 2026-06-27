import { useEffect, useState } from "react";
import {
  ChevronRight,
  ChevronLeft,
  Download,
  FileText,
  Search,
  Leaf,
  Users,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  TrendingUp,
  Activity,
  Loader2,
  AlertTriangle,
  Shield,
  Layers,
  PawPrint,
  Droplets,
  Mountain,
  FileCheck,
  Filter,
  BarChart3,
  PieChart as PieChartIcon,
  TreePine,
  Pin,
} from "lucide-react";
import PlantScopeAlert from "@/components/alert/PlantScopeAlert";
import { api } from "@/constant/api.ts";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

// ─── Types ──────────────────────────────────────────────────────────────────

interface ReportStats {
  total_assessments: number;
  general_assessments: number;
  specific_assessments: number;
  total_sites: number;
  sites_by_status: {
    pending: number;
    under_review: number;
    accepted: number;
    rejected: number;
    completed: number;
    under_monitoring: number;
  };
  total_areas: number;
  active_inspectors: number;
  verified_sites: number;
}

interface LayerBreakdown {
  meta_data: number;
  safety: number;
  survivability: number;
  boundary_verification: number;
}

interface MetaDetails {
  land_title: number;
  tax_declaration: number;
  other_documents: number;
}

interface SafetyDetails {
  flood: number;
  landslide: number;
  erosion: number;
  other: number;
}

interface SurvivabilityDetails {
  soil: number;
  water: number;
  animal: number;
  slope: number;
}

interface VerificationStatus {
  pending: number;
  draft: number;
  verified: number;
  rejected: number;
}

interface SafetyAlerts {
  high_risk_count: number;
  medium_risk_count: number;
}

interface RecentAssessment {
  field_assessment_id: number;
  inspector_email: string;
  area_name: string;
  site_name: string;
  site_status: string | null;
  assessment_date: string | null;
  type: "General" | "Specific";
  layers_present: string[];
  image_count: number;
  created_at: string;
}

interface SiteRecord {
  site_id: number;
  name: string;
  status: string;
  status_display: string;
  area_hectares: number;
  seedlings_planted: number;
  barangay: string;
  reforestation_area: string;
  reforestation_area_id: number;
  assessments_count: number;
  verification_status: string | null;
  land_classification: string | null;
  ndvi_value: number | null;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

interface AssessmentFilter {
  search: string;
  date_from: string;
  date_to: string;
  area_id: string;
  barangay_id: string;
  layer_type: string;
  type: string;
  site_status: string;
  page: number;
  entries: number;
  total_page: number;
  total: number;
}

interface SiteFilter {
  search: string;
  status: string;
  area_id: string;
  barangay_id: string;
  date_from: string;
  date_to: string;
  page: number;
  entries: number;
  total_page: number;
  total: number;
}

// ─── Helper Components ──────────────────────────────────────────────────────

const StatusBadge = ({ status }: { status: string }) => {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    pending: { bg: "bg-amber-100", text: "text-amber-700", label: "Pending" },
    under_review: { bg: "bg-blue-100", text: "text-blue-700", label: "Under Review" },
    accepted: { bg: "bg-green-100", text: "text-green-700", label: "Accepted" },
    rejected: { bg: "bg-red-100", text: "text-red-700", label: "Rejected" },
    completed: { bg: "bg-emerald-100", text: "text-emerald-700", label: "Completed" },
    under_monitoring: { bg: "bg-indigo-100", text: "text-indigo-700", label: "Monitoring" },
  };
  const { bg, text, label } = config[status] || { bg: "bg-gray-100", text: "text-gray-700", label: status };
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${bg} ${text}`}>
      {label}
    </span>
  );
};

const VerificationBadge = ({ status }: { status: string | null }) => {
  if (!status) return <span className="text-xs text-gray-400 italic">Not Verified</span>;
  
  const config: Record<string, { bg: string; text: string; label: string }> = {
    pending: { bg: "bg-amber-100", text: "text-amber-700", label: "Pending" },
    draft: { bg: "bg-gray-100", text: "text-gray-700", label: "Draft" },
    verified: { bg: "bg-green-100", text: "text-green-700", label: "Verified ✓" },
    rejected: { bg: "bg-red-100", text: "text-red-700", label: "Rejected" },
  };
  const { bg, text, label } = config[status] || { bg: "bg-gray-100", text: "text-gray-700", label: status };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${bg} ${text}`}>
      {label}
    </span>
  );
};

const LayerBadge = ({ layer }: { layer: string }) => {
  const config: Record<string, { bg: string; text: string; icon: any }> = {
    Meta: { bg: "bg-purple-100", text: "text-purple-700", icon: FileCheck },
    Safety: { bg: "bg-orange-100", text: "text-orange-700", icon: Shield },
    Survivability: { bg: "bg-green-100", text: "text-green-700", icon: Leaf },
    Boundary: { bg: "bg-blue-100", text: "text-blue-700", icon: MapPin },
  };
  const { bg, text, icon: Icon } = config[layer] || { bg: "bg-gray-100", text: "text-gray-700", icon: Layers };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold ${bg} ${text}`}>
      <Icon size={10} /> {layer}
    </span>
  );
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#0F4A2F] text-white text-xs rounded-lg px-3 py-2 shadow-lg border border-white/10">
        <p className="font-semibold mb-1 text-emerald-300">{label}</p>
        <p className="text-white/90">
          Count: <b>{payload[0].value}</b>
        </p>
      </div>
    );
  }
  return null;
};

// ─── Main Component ─────────────────────────────────────────────────────────

export default function GISReports() {
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [layerBreakdown, setLayerBreakdown] = useState<LayerBreakdown | null>(null);
  const [metaDetails, setMetaDetails] = useState<MetaDetails | null>(null);
  const [safetyDetails, setSafetyDetails] = useState<SafetyDetails | null>(null);
  const [survivabilityDetails, setSurvivabilityDetails] = useState<SurvivabilityDetails | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus | null>(null);
  const [safetyAlerts, setSafetyAlerts] = useState<SafetyAlerts | null>(null);
  const [recentAssessments, setRecentAssessments] = useState<RecentAssessment[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Assessments State
  const [assessmentData, setAssessmentData] = useState<RecentAssessment[]>([]);
  const [assessmentFilter, setAssessmentFilter] = useState<AssessmentFilter>({
    search: "",
    date_from: "",
    date_to: "",
    area_id: "",
    barangay_id: "",
    layer_type: "",
    type: "all",
    site_status: "",
    page: 1,
    entries: 10,
    total_page: 1,
    total: 0,
  });
  const [assessmentLoading, setAssessmentLoading] = useState(false);

  // ── Sites State
  const [sitesData, setSitesData] = useState<SiteRecord[]>([]);
  const [siteFilter, setSiteFilter] = useState<SiteFilter>({
    search: "",
    status: "",
    area_id: "",
    barangay_id: "",
    date_from: "",
    date_to: "",
    page: 1,
    entries: 10,
    total_page: 1,
    total: 0,
  });
  const [sitesLoading, setSitesLoading] = useState(false);

  const [PSalert, setPSAlert] = useState<{
    type: "success" | "failed" | "error";
    title: string;
    message: string;
  } | null>(null);

  const token = localStorage.getItem("token");
  const API_BASE = api;

  // ─── Fetch Dashboard Data ─────────────────────────────────────────────
  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}api/gis_specialist_dashboard/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to fetch dashboard data.");
      const data = await response.json();
      
      setStats(data.stats);
      setLayerBreakdown(data.layer_breakdown);
      setMetaDetails(data.meta_details);
      setSafetyDetails(data.safety_details);
      setSurvivabilityDetails(data.survivability_details);
      setVerificationStatus(data.verification_status);
      setSafetyAlerts(data.safety_alerts);
      setRecentAssessments(data.recent_assessments);
    } catch (err: any) {
      setPSAlert({ type: "error", title: "Failed", message: err.message });
    } finally {
      setLoading(false);
    }
  };

  // ─── Fetch Assessments List ───────────────────────────────────────────
  const fetchAssessments = async () => {
    setAssessmentLoading(true);
    try {
      const params = new URLSearchParams({
        page: assessmentFilter.page.toString(),
        entries: assessmentFilter.entries.toString(),
      });
      if (assessmentFilter.date_from) params.append("date_from", assessmentFilter.date_from);
      if (assessmentFilter.date_to) params.append("date_to", assessmentFilter.date_to);
      if (assessmentFilter.area_id) params.append("area_id", assessmentFilter.area_id);
      if (assessmentFilter.barangay_id) params.append("barangay_id", assessmentFilter.barangay_id);
      if (assessmentFilter.layer_type) params.append("layer_type", assessmentFilter.layer_type);
      if (assessmentFilter.type !== "all") params.append("type", assessmentFilter.type);
      if (assessmentFilter.site_status) params.append("site_status", assessmentFilter.site_status);
      if (assessmentFilter.search) params.append("search", assessmentFilter.search);

      const res = await fetch(`${API_BASE}api/gis_assessments_list/?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch assessments");
      const data = await res.json();
      setAssessmentData(data.data);
      setAssessmentFilter((prev) => ({
        ...prev,
        total_page: data.total_page,
        total: data.total,
      }));
    } catch (err: any) {
      setPSAlert({ type: "error", title: "Failed", message: err.message });
    } finally {
      setAssessmentLoading(false);
    }
  };

  // ─── Fetch Sites List ─────────────────────────────────────────────────
  const fetchSites = async () => {
    setSitesLoading(true);
    try {
      const params = new URLSearchParams({
        page: siteFilter.page.toString(),
        entries: siteFilter.entries.toString(),
      });
      if (siteFilter.status) params.append("status", siteFilter.status);
      if (siteFilter.area_id) params.append("area_id", siteFilter.area_id);
      if (siteFilter.barangay_id) params.append("barangay_id", siteFilter.barangay_id);
      if (siteFilter.date_from) params.append("date_from", siteFilter.date_from);
      if (siteFilter.date_to) params.append("date_to", siteFilter.date_to);
      if (siteFilter.search) params.append("search", siteFilter.search);

      const res = await fetch(`${API_BASE}api/gis_sites_list/?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch sites");
      const data = await res.json();
      setSitesData(data.data);
      setSiteFilter((prev) => ({
        ...prev,
        total_page: data.total_page,
        total: data.total,
      }));
    } catch (err: any) {
      setPSAlert({ type: "error", title: "Failed", message: err.message });
    } finally {
      setSitesLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    fetchAssessments();
  }, [assessmentFilter.page, assessmentFilter.entries]);

  useEffect(() => {
    fetchSites();
  }, [siteFilter.page, siteFilter.entries]);

  const formatDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) : "—";

  // ─── Export Functions ─────────────────────────────────────────────────
  const handleExportAssessmentsExcel = () => {
    if (assessmentData.length === 0) {
      setPSAlert({ type: "failed", title: "No Data", message: "No assessment data to export." });
      return;
    }

    const headers = ["ID", "Inspector", "Area", "Site", "Site Status", "Type", "Layers", "Images", "Assessment Date", "Created"];
    const rows = assessmentData.map((a) => [
      a.field_assessment_id,
      a.inspector_email,
      a.area_name,
      a.site_name,
      a.site_status || "N/A",
      a.type,
      a.layers_present.join(", "),
      a.image_count,
      formatDate(a.assessment_date),
      formatDate(a.created_at),
    ]);

    const BOM = "\uFEFF";
    const csvContent = BOM + [headers.join(","), ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `gis_assessments_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setPSAlert({ type: "success", title: "Exported!", message: "Assessments report downloaded." });
  };

  const handleExportSitesExcel = () => {
    if (sitesData.length === 0) {
      setPSAlert({ type: "failed", title: "No Data", message: "No sites data to export." });
      return;
    }

    const headers = ["ID", "Name", "Status", "Area (ha)", "Seedlings", "Barangay", "Reforestation Area", "Assessments", "Verification", "Land Class", "Created"];
    const rows = sitesData.map((s) => [
      s.site_id,
      s.name,
      s.status_display,
      s.area_hectares.toFixed(2),
      s.seedlings_planted,
      s.barangay,
      s.reforestation_area,
      s.assessments_count,
      s.verification_status || "N/A",
      s.land_classification || "N/A",
      formatDate(s.created_at),
    ]);

    const BOM = "\uFEFF";
    const csvContent = BOM + [headers.join(","), ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `gis_sites_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setPSAlert({ type: "success", title: "Exported!", message: "Sites report downloaded." });
  };

  // ─── Prepare Chart Data ───────────────────────────────────────────────
  const layerChartData = layerBreakdown
    ? [
        { name: "Meta Data", value: layerBreakdown.meta_data, color: "#9333ea" },
        { name: "Safety", value: layerBreakdown.safety, color: "#f97316" },
        { name: "Survivability", value: layerBreakdown.survivability, color: "#16a34a" },
        { name: "Boundary", value: layerBreakdown.boundary_verification, color: "#3b82f6" },
      ]
    : [];

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {PSalert && <PlantScopeAlert type={PSalert.type} title={PSalert.title} message={PSalert.message} onClose={() => setPSAlert(null)} />}

      <main className="max-w-7xl mx-auto p-6 space-y-6">
        {/* ── Header ── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Activity size={24} className="text-[#0F4A2F]" /> GIS Specialist Reports
            </h1>
            <p className="text-sm text-gray-500 mt-1">Comprehensive analysis of field assessments, site verification, and hazard monitoring.</p>
          </div>
          <button onClick={fetchDashboardData} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0F4A2F] text-white text-sm font-semibold hover:bg-[#1a6b44] transition-colors shadow-sm">
            <Loader2 size={16} className={loading ? "animate-spin" : ""} /> Refresh Data
          </button>
        </div>

        {/* ── Dashboard Stats ── */}
        {loading && !stats ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 size={40} className="animate-spin text-[#0F4A2F] mb-4" />
            <p className="text-gray-500 font-medium">Loading report metrics...</p>
          </div>
        ) : stats ? (
          <>
            {/* Key Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5">
              {[
                { title: "Total Assessments", value: stats.total_assessments, sub: `${stats.general_assessments} General / ${stats.specific_assessments} Specific`, icon: <FileText size={22} />, bg: "bg-blue-50", iconColor: "text-blue-600", border: "border-blue-200" },
                { title: "Total Sites", value: stats.total_sites, sub: `${stats.sites_by_status.pending} Pending`, icon: <MapPin size={22} />, bg: "bg-purple-50", iconColor: "text-purple-600", border: "border-purple-200" },
                { title: "Reforestation Areas", value: stats.total_areas, sub: "Active Areas", icon: <Leaf size={22} />, bg: "bg-green-50", iconColor: "text-green-600", border: "border-green-200" },
                { title: "Active Inspectors", value: stats.active_inspectors, sub: "On-site Inspectors", icon: <Users size={22} />, bg: "bg-indigo-50", iconColor: "text-indigo-600", border: "border-indigo-200" },
                { title: "Verified Sites", value: stats.verified_sites, sub: "Meta Data Verified", icon: <CheckCircle2 size={22} />, bg: "bg-emerald-50", iconColor: "text-emerald-600", border: "border-emerald-200" },
              ].map((stat, i) => (
                <div key={i} className={`bg-white rounded-2xl border-2 ${stat.border} shadow-sm p-5 hover:shadow-md transition-all hover:-translate-y-0.5`}>
                  <div className={`w-11 h-11 rounded-xl ${stat.bg} flex items-center justify-center ${stat.iconColor} mb-3`}>{stat.icon}</div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-800 mt-1">{stat.value.toLocaleString()}</p>
                  <p className="text-xs text-gray-400 mt-1">{stat.sub}</p>
                </div>
              ))}
            </div>

            {/* Layer Analysis Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
                      <BarChart3 size={18} className="text-[#0F4A2F]" /> Assessments by Layer Type
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">Distribution of assessments across different data layers</p>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={layerChartData} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 12, fill: "#64748b", fontWeight: 500 }} axisLine={false} tickLine={false} width={100} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                      {layerChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                
                <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-100">
                  <div className="bg-purple-50 rounded-xl p-3 border border-purple-100">
                    <p className="text-xs font-bold text-purple-700 mb-2 flex items-center gap-1">
                      <FileCheck size={12} /> Meta Documents
                    </p>
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center"><span className="text-xs text-gray-600">Land Title</span><span className="text-sm font-bold text-purple-800">{metaDetails?.land_title}</span></div>
                      <div className="flex justify-between items-center"><span className="text-xs text-gray-600">Tax Decl</span><span className="text-sm font-bold text-purple-800">{metaDetails?.tax_declaration}</span></div>
                      <div className="flex justify-between items-center"><span className="text-xs text-gray-600">Other Docs</span><span className="text-sm font-bold text-purple-800">{metaDetails?.other_documents}</span></div>
                    </div>
                  </div>
                  <div className="bg-orange-50 rounded-xl p-3 border border-orange-100">
                    <p className="text-xs font-bold text-orange-700 mb-2 flex items-center gap-1">
                      <Shield size={12} /> Safety Concerns
                    </p>
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center"><span className="text-xs text-gray-600">Flood</span><span className="text-sm font-bold text-orange-800">{safetyDetails?.flood}</span></div>
                      <div className="flex justify-between items-center"><span className="text-xs text-gray-600">Landslide</span><span className="text-sm font-bold text-orange-800">{safetyDetails?.landslide}</span></div>
                      <div className="flex justify-between items-center"><span className="text-xs text-gray-600">Erosion</span><span className="text-sm font-bold text-orange-800">{safetyDetails?.erosion}</span></div>
                    </div>
                  </div>
                  <div className="bg-green-50 rounded-xl p-3 border border-green-100">
                    <p className="text-xs font-bold text-green-700 mb-2 flex items-center gap-1">
                      <Leaf size={12} /> Survivability
                    </p>
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center"><span className="text-xs text-gray-600">Soil</span><span className="text-sm font-bold text-green-800">{survivabilityDetails?.soil}</span></div>
                      <div className="flex justify-between items-center"><span className="text-xs text-gray-600">Water</span><span className="text-sm font-bold text-green-800">{survivabilityDetails?.water}</span></div>
                      <div className="flex justify-between items-center"><span className="text-xs text-gray-600">Animals</span><span className="text-sm font-bold text-green-800">{survivabilityDetails?.animal}</span></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                  <h3 className="text-base font-bold text-gray-800 flex items-center gap-2 mb-4">
                    <FileCheck size={18} className="text-[#0F4A2F]" /> Verification Status
                  </h3>
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-200">
                      <div className="flex items-center gap-2"><Clock size={14} className="text-amber-600" /><span className="text-sm font-medium text-amber-800">Pending Review</span></div>
                      <span className="text-lg font-bold text-amber-700">{verificationStatus?.pending}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center gap-2"><FileText size={14} className="text-blue-600" /><span className="text-sm font-medium text-blue-800">Draft</span></div>
                      <span className="text-lg font-bold text-blue-700">{verificationStatus?.draft}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                      <div className="flex items-center gap-2"><CheckCircle2 size={14} className="text-green-600" /><span className="text-sm font-medium text-green-800">Verified</span></div>
                      <span className="text-lg font-bold text-green-700">{verificationStatus?.verified}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
                      <div className="flex items-center gap-2"><XCircle size={14} className="text-red-600" /><span className="text-sm font-medium text-red-800">Rejected</span></div>
                      <span className="text-lg font-bold text-red-700">{verificationStatus?.rejected}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                  <h3 className="text-base font-bold text-gray-800 flex items-center gap-2 mb-4">
                    <AlertTriangle size={18} className="text-orange-600" /> Safety Alerts
                  </h3>
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-center gap-2"><XCircle size={16} className="text-red-600" /><span className="text-sm font-medium text-red-800">High Risk</span></div>
                      <span className="text-xl font-bold text-red-700">{safetyAlerts?.high_risk_count}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="flex items-center gap-2"><AlertTriangle size={16} className="text-amber-600" /><span className="text-sm font-medium text-amber-800">Medium Risk</span></div>
                      <span className="text-xl font-bold text-amber-700">{safetyAlerts?.medium_risk_count}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Site Status Pipeline */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h3 className="text-base font-bold text-gray-800 flex items-center gap-2 mb-5">
                <TrendingUp size={18} className="text-[#0F4A2F]" /> Site Status Pipeline
              </h3>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 rounded-lg border border-amber-200">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
                  <span className="text-sm text-amber-800">Pending: <strong>{stats.sites_by_status.pending}</strong></span>
                </div>
                <ChevronRight size={18} className="text-gray-300" />
                <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
                  <span className="text-sm text-blue-800">Under Review: <strong>{stats.sites_by_status.under_review}</strong></span>
                </div>
                <ChevronRight size={18} className="text-gray-300" />
                <div className="flex items-center gap-2 px-4 py-2.5 bg-green-50 rounded-lg border border-green-200">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
                  <span className="text-sm text-green-800">Accepted: <strong>{stats.sites_by_status.accepted}</strong></span>
                </div>
                <ChevronRight size={18} className="text-gray-300" />
                <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 rounded-lg border border-emerald-200">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                  <span className="text-sm text-emerald-800">Completed: <strong>{stats.sites_by_status.completed}</strong></span>
                </div>
                <div className="ml-auto flex items-center gap-3">
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-red-50 rounded-lg border border-red-200">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                    <span className="text-sm text-red-800">Rejected: <strong>{stats.sites_by_status.rejected}</strong></span>
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 rounded-lg border border-indigo-200">
                    <div className="w-2.5 h-2.5 rounded-full bg-indigo-500"></div>
                    <span className="text-sm text-indigo-800">Monitoring: <strong>{stats.sites_by_status.under_monitoring}</strong></span>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : null}

        {/* ── SITES LIST TABLE (NEW) ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
                <TreePine size={18} className="text-[#0F4A2F]" /> Reforestation Sites
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">Complete list of all monitored reforestation sites.</p>
            </div>
            <button onClick={handleExportSitesExcel} disabled={sitesData.length === 0} className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-green-200 text-green-700 text-xs font-semibold hover:bg-green-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              <Download size={14} /> Export Sites
            </button>
          </div>

          {/* Sites Filters */}
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex flex-wrap items-center gap-3">
            <select
              value={siteFilter.status}
              onChange={(e) => setSiteFilter((prev) => ({ ...prev, status: e.target.value, page: 1 }))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-[#0F4A2F] focus:outline-none bg-white"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="under_review">Under Review</option>
              <option value="accepted">Accepted</option>
              <option value="completed">Completed</option>
              <option value="rejected">Rejected</option>
              <option value="under_monitoring">Under Monitoring</option>
            </select>

            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-gray-400" />
              <input
                type="date"
                value={siteFilter.date_from}
                onChange={(e) => setSiteFilter((prev) => ({ ...prev, date_from: e.target.value, page: 1 }))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-[#0F4A2F] focus:outline-none bg-white"
              />
              <span className="text-gray-400 text-sm">to</span>
              <input
                type="date"
                value={siteFilter.date_to}
                onChange={(e) => setSiteFilter((prev) => ({ ...prev, date_to: e.target.value, page: 1 }))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-[#0F4A2F] focus:outline-none bg-white"
              />
            </div>

            <div className="relative ml-auto">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search site name, area, barangay..."
                value={siteFilter.search}
                onChange={(e) => setSiteFilter((prev) => ({ ...prev, search: e.target.value, page: 1 }))}
                onKeyDown={(e) => { if (e.key === "Enter") fetchSites(); }}
                className="border border-gray-300 rounded-lg pl-8 pr-3 py-2 w-72 text-sm focus:border-[#0F4A2F] focus:outline-none bg-white"
              />
            </div>

            <button
              onClick={fetchSites}
              className="px-4 py-2 rounded-lg bg-[#0F4A2F] text-white text-sm font-medium hover:bg-[#1a6b44] transition-colors flex items-center gap-1"
            >
              <Filter size={14} /> Apply
            </button>
          </div>

          {/* Sites Table */}
          <div className="overflow-x-auto relative">
            {sitesLoading && (
              <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
                <Loader2 size={32} className="animate-spin text-[#0F4A2F]" />
              </div>
            )}
            <table className="min-w-full">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="py-3 px-6 text-left text-xs font-semibold uppercase tracking-wider">Site Name</th>
                  <th className="py-3 px-6 text-left text-xs font-semibold uppercase tracking-wider">Status</th>
                  <th className="py-3 px-6 text-left text-xs font-semibold uppercase tracking-wider">Area (ha)</th>
                  <th className="py-3 px-6 text-left text-xs font-semibold uppercase tracking-wider">Barangay / Area</th>
                  <th className="py-3 px-6 text-left text-xs font-semibold uppercase tracking-wider">Assessments</th>
                  <th className="py-3 px-6 text-left text-xs font-semibold uppercase tracking-wider">Verification</th>
                  <th className="py-3 px-6 text-left text-xs font-semibold uppercase tracking-wider">Land Class</th>
                  <th className="py-3 px-6 text-left text-xs font-semibold uppercase tracking-wider">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sitesData.length > 0 ? (
                  sitesData.map((site) => (
                    <tr key={site.site_id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          {site.is_pinned && <Pin size={12} className="text-amber-500 fill-amber-500" />}
                          <div>
                            <p className="text-sm font-bold text-gray-800">{site.name}</p>
                            <p className="text-xs text-gray-500">ID: #{site.site_id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <StatusBadge status={site.status} />
                      </td>
                      <td className="py-4 px-6">
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{site.area_hectares.toFixed(2)} ha</p>
                          {site.seedlings_planted > 0 && (
                            <p className="text-[10px] text-gray-500 flex items-center gap-1">
                              <TreePine size={10} /> {site.seedlings_planted} seedlings
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div>
                          <p className="text-sm font-medium text-gray-800">{site.reforestation_area}</p>
                          <p className="text-xs text-gray-500">{site.barangay}</p>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`px-2 py-1 rounded-md text-xs font-semibold ${
                          site.assessments_count > 0 ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"
                        }`}>
                          {site.assessments_count} assessment{site.assessments_count !== 1 ? 's' : ''}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <VerificationBadge status={site.verification_status} />
                      </td>
                      <td className="py-4 px-6">
                        {site.land_classification ? (
                          <span className="text-xs font-medium text-purple-700 bg-purple-50 px-2 py-1 rounded">
                            {site.land_classification}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 italic">—</span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-sm text-gray-500">{formatDate(site.created_at)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-gray-400 text-sm">
                      No sites match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Sites Pagination */}
          {siteFilter.total_page > 1 && (
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50">
              <p className="text-sm text-gray-500">
                Showing {(siteFilter.page - 1) * siteFilter.entries + 1} to{" "}
                {Math.min(siteFilter.page * siteFilter.entries, siteFilter.total)} of {siteFilter.total} sites
              </p>
              <div className="flex items-center gap-1">
                <button
                  disabled={siteFilter.page <= 1}
                  onClick={() => setSiteFilter((prev) => ({ ...prev, page: prev.page - 1 }))}
                  className="px-3 py-1.5 border rounded-lg text-gray-700 hover:bg-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 text-sm"
                >
                  <ChevronLeft size={14} /> Prev
                </button>
                {Array.from({ length: Math.min(5, siteFilter.total_page) }, (_, i) => {
                  let pageNum = siteFilter.total_page <= 5 ? i + 1 : siteFilter.page <= 3 ? i + 1 : siteFilter.page >= siteFilter.total_page - 2 ? siteFilter.total_page - 4 + i : siteFilter.page - 2 + i;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setSiteFilter((prev) => ({ ...prev, page: pageNum }))}
                      className={`px-3 py-1.5 border rounded-lg cursor-pointer text-sm ${
                        pageNum === siteFilter.page ? "bg-[#0F4A2F] text-white" : "text-gray-700 hover:bg-white"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  disabled={siteFilter.page >= siteFilter.total_page}
                  onClick={() => setSiteFilter((prev) => ({ ...prev, page: prev.page + 1 }))}
                  className="px-3 py-1.5 border rounded-lg text-gray-700 hover:bg-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 text-sm"
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Assessments Table ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
                <FileText size={18} className="text-[#0F4A2F]" /> Field Assessments
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">Filter and analyze submitted assessments with detailed information.</p>
            </div>
            <button onClick={handleExportAssessmentsExcel} disabled={assessmentData.length === 0} className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-green-200 text-green-700 text-xs font-semibold hover:bg-green-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              <Download size={14} /> Export Assessments
            </button>
          </div>

          {/* Assessments Filters */}
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex flex-wrap items-center gap-3">
            <select
              value={assessmentFilter.type}
              onChange={(e) => setAssessmentFilter((prev) => ({ ...prev, type: e.target.value, page: 1 }))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-[#0F4A2F] focus:outline-none bg-white"
            >
              <option value="all">All Types</option>
              <option value="general">General</option>
              <option value="specific">Specific</option>
            </select>

            <select
              value={assessmentFilter.site_status}
              onChange={(e) => setAssessmentFilter((prev) => ({ ...prev, site_status: e.target.value, page: 1 }))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-[#0F4A2F] focus:outline-none bg-white"
            >
              <option value="">All Site Statuses</option>
              <option value="pending">Pending</option>
              <option value="under_review">Under Review</option>
              <option value="accepted">Accepted</option>
              <option value="completed">Completed</option>
              <option value="rejected">Rejected</option>
              <option value="under_monitoring">Under Monitoring</option>
            </select>

            <select
              value={assessmentFilter.layer_type}
              onChange={(e) => setAssessmentFilter((prev) => ({ ...prev, layer_type: e.target.value, page: 1 }))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-[#0F4A2F] focus:outline-none bg-white"
            >
              <option value="">All Layers</option>
              <option value="meta">Meta Data</option>
              <option value="safety">Safety</option>
              <option value="survivability">Survivability</option>
              <option value="boundary">Boundary</option>
            </select>

            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-gray-400" />
              <input
                type="date"
                value={assessmentFilter.date_from}
                onChange={(e) => setAssessmentFilter((prev) => ({ ...prev, date_from: e.target.value, page: 1 }))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-[#0F4A2F] focus:outline-none bg-white"
              />
              <span className="text-gray-400 text-sm">to</span>
              <input
                type="date"
                value={assessmentFilter.date_to}
                onChange={(e) => setAssessmentFilter((prev) => ({ ...prev, date_to: e.target.value, page: 1 }))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-[#0F4A2F] focus:outline-none bg-white"
              />
            </div>

            <div className="relative ml-auto">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search inspector, area, or site..."
                value={assessmentFilter.search}
                onChange={(e) => setAssessmentFilter((prev) => ({ ...prev, search: e.target.value, page: 1 }))}
                onKeyDown={(e) => { if (e.key === "Enter") fetchAssessments(); }}
                className="border border-gray-300 rounded-lg pl-8 pr-3 py-2 w-64 text-sm focus:border-[#0F4A2F] focus:outline-none bg-white"
              />
            </div>

            <button
              onClick={fetchAssessments}
              className="px-4 py-2 rounded-lg bg-[#0F4A2F] text-white text-sm font-medium hover:bg-[#1a6b44] transition-colors flex items-center gap-1"
            >
              <Filter size={14} /> Apply Filters
            </button>
          </div>

          {/* Assessments Table */}
          <div className="overflow-x-auto relative">
            {assessmentLoading && (
              <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
                <Loader2 size={32} className="animate-spin text-[#0F4A2F]" />
              </div>
            )}
            <table className="min-w-full">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="py-3 px-6 text-left text-xs font-semibold uppercase tracking-wider">ID / Inspector</th>
                  <th className="py-3 px-6 text-left text-xs font-semibold uppercase tracking-wider">Area / Site</th>
                  <th className="py-3 px-6 text-left text-xs font-semibold uppercase tracking-wider">Site Status</th>
                  <th className="py-3 px-6 text-left text-xs font-semibold uppercase tracking-wider">Type</th>
                  <th className="py-3 px-6 text-left text-xs font-semibold uppercase tracking-wider">Layers</th>
                  <th className="py-3 px-6 text-left text-xs font-semibold uppercase tracking-wider">Images</th>
                  <th className="py-3 px-6 text-left text-xs font-semibold uppercase tracking-wider">Assessment Date</th>
                  <th className="py-3 px-6 text-left text-xs font-semibold uppercase tracking-wider">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {assessmentData.length > 0 ? (
                  assessmentData.map((assessment) => (
                    <tr key={assessment.field_assessment_id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-4 px-6">
                        <p className="text-sm font-bold text-gray-800">#{assessment.field_assessment_id}</p>
                        <p className="text-xs text-gray-500">{assessment.inspector_email}</p>
                      </td>
                      <td className="py-4 px-6">
                        <p className="text-sm font-semibold text-gray-800">{assessment.area_name}</p>
                        <p className="text-xs text-gray-500">{assessment.site_name}</p>
                      </td>
                      <td className="py-4 px-6">
                        {assessment.site_status ? (
                          <StatusBadge status={assessment.site_status} />
                        ) : (
                          <span className="text-xs text-gray-400 italic">General</span>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                          assessment.type === "General" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"
                        }`}>
                          {assessment.type}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex flex-wrap gap-1">
                          {assessment.layers_present.map((layer) => (
                            <LayerBadge key={layer} layer={layer} />
                          ))}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-sm font-semibold text-gray-700">{assessment.image_count}</span>
                      </td>
                      <td className="py-4 px-6 text-sm text-gray-600">{formatDate(assessment.assessment_date)}</td>
                      <td className="py-4 px-6 text-sm text-gray-500">{formatDate(assessment.created_at)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-gray-400 text-sm">
                      No assessments match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Assessments Pagination */}
          {assessmentFilter.total_page > 1 && (
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50">
              <p className="text-sm text-gray-500">
                Showing {(assessmentFilter.page - 1) * assessmentFilter.entries + 1} to{" "}
                {Math.min(assessmentFilter.page * assessmentFilter.entries, assessmentFilter.total)} of {assessmentFilter.total} results
              </p>
              <div className="flex items-center gap-1">
                <button
                  disabled={assessmentFilter.page <= 1}
                  onClick={() => setAssessmentFilter((prev) => ({ ...prev, page: prev.page - 1 }))}
                  className="px-3 py-1.5 border rounded-lg text-gray-700 hover:bg-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 text-sm"
                >
                  <ChevronLeft size={14} /> Prev
                </button>
                {Array.from({ length: Math.min(5, assessmentFilter.total_page) }, (_, i) => {
                  let pageNum = assessmentFilter.total_page <= 5 ? i + 1 : assessmentFilter.page <= 3 ? i + 1 : assessmentFilter.page >= assessmentFilter.total_page - 2 ? assessmentFilter.total_page - 4 + i : assessmentFilter.page - 2 + i;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setAssessmentFilter((prev) => ({ ...prev, page: pageNum }))}
                      className={`px-3 py-1.5 border rounded-lg cursor-pointer text-sm ${
                        pageNum === assessmentFilter.page ? "bg-[#0F4A2F] text-white" : "text-gray-700 hover:bg-white"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  disabled={assessmentFilter.page >= assessmentFilter.total_page}
                  onClick={() => setAssessmentFilter((prev) => ({ ...prev, page: prev.page + 1 }))}
                  className="px-3 py-1.5 border rounded-lg text-gray-700 hover:bg-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 text-sm"
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}