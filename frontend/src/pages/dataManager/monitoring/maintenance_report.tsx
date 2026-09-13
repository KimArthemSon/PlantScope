import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  Trees,
  Users,
  Calendar,
  AlertTriangle,
  BellRing,
  ArrowLeft,
  Download,
  Leaf,
  Sprout,
  MapPin,
  TrendingUp,
  FileCheck,
  Edit2,
  Globe,
  Info,
  History,
  Car,
  Layers,
  PauseCircle,
  ShieldCheck,
  Package,
} from "lucide-react";
import PlantScopeAlert from "../../../components/alert/PlantScopeAlert";
import { api } from "@/constant/api.ts";

// ─── Types ─────────────────────────────────────────────────────────────────

interface ProgressReportSpeciesItem {
  species_id: number;
  species_name: string;
  no_planted: number;
  no_added_by_grower: number;
  no_survived: number;
  no_dead: number;
  survival_rate: number;
}

interface SeedlingRequestSpeciesItem {
  species_id: number;
  species_name: string;
  total_requested: number;
}

interface HistoricalApplication {
  application_id: number;
  group_name: string;
  status: string;
  created_at: string | null;
}

interface SiteMonitoringDetail {
  site: {
    site_id: number;
    name: string;
    description: string | null;
    total_area_hectares: number;
    reforestation_area_name: string | null;
    barangay_name: string | null;
    accessibility: any;
    land_classification_name: string | null;
    monitoring_status: string;
  };
  metrics: {
    total_planted: number;
    total_added: number;
    total_dead: number;
    total_survived: number;
    survival_rate: number;
  };
  total_seedlings_provided: number;
  seedling_requests_breakdown: SeedlingRequestSpeciesItem[];
  current_application: {
    application_id: number;
    group_name: string;
    group_contact: string;
    status: string;
  } | null;
  historical_applications: HistoricalApplication[];
  progress_reports: Array<{
    report_id: number;
    visit_type: "initial" | "ongoing" | "inactive_check";
    orientation_conducted: boolean;
    application_id: number | null;
    application_title: string | null;
    group_name: string;
    total_survived: number;
    total_dead: number;
    total_added_by_grower: number;
    species: ProgressReportSpeciesItem[];
    description: string | null;
    status: "pending" | "accepted" | "rejected";
    proof_image: string | null;
    submitted_at: string | null;
  }>;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = api;

const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; border: string; icon: React.ReactNode }
> = {
  accepted: { label: "Needs Orientation", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", icon: <Clock size={13} className="text-blue-500" /> },
  under_monitoring: { label: "Under Monitoring", bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-200", icon: <TrendingUp size={13} className="text-teal-500" /> },
  pending: { label: "Pending Review", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", icon: <Clock size={13} className="text-amber-500" /> },
  rejected: { label: "Rejected", bg: "bg-red-50", text: "text-red-700", border: "border-red-200", icon: <XCircle size={13} className="text-red-500" /> },
  completed: { label: "Completed", bg: "bg-green-50", text: "text-green-700", border: "border-green-200", icon: <CheckCircle2 size={13} className="text-green-500" /> },
  failed: { label: "Failed", bg: "bg-red-50", text: "text-red-700", border: "border-red-200", icon: <XCircle size={13} className="text-red-500" /> },
  inactive: { label: "Inactive / No Active Program", bg: "bg-slate-50", text: "text-slate-700", border: "border-slate-200", icon: <AlertTriangle size={13} className="text-slate-500" /> },
};

const StatusBadge = ({ status }: { status: string }) => {
  const conf = STATUS_CONFIG[status] ?? STATUS_CONFIG.inactive;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${conf.bg} ${conf.text} ${conf.border}`}>
      {conf.icon}
      {conf.label}
    </span>
  );
};

const getMonitoringStatusBadge = (status: string) => {
  switch (status) {
    case "available": return { icon: ShieldCheck, color: "bg-emerald-50 text-emerald-700 border border-emerald-200", label: "Available" };
    case "reserved": return { icon: Clock, color: "bg-amber-50 text-amber-700 border border-amber-200", label: "Reserved" };
    case "under_monitoring": return { icon: Trees, color: "bg-blue-50 text-blue-700 border border-blue-200", label: "Under Monitoring" };
    case "completed": return { icon: CheckCircle2, color: "bg-purple-50 text-purple-700 border border-purple-200", label: "Completed" };
    case "failed": return { icon: XCircle, color: "bg-red-50 text-red-700 border border-red-200", label: "Failed" };
    case "onhold": return { icon: PauseCircle, color: "bg-gray-100 text-gray-700 border border-gray-300", label: "On Hold" };
    default: return { icon: AlertTriangle, color: "bg-slate-100 text-slate-600 border border-slate-200", label: status };
  }
};

const getAccessibilityText = (accessibility: any) => {
  if (!accessibility) return "Not specified";
  if (typeof accessibility === "string") return accessibility;
  if (typeof accessibility === "object") {
    if (accessibility.type) return accessibility.type.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase());
    if (accessibility.description) return accessibility.description;
  }
  return "Specified";
};

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) : "—";

function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="w-10 h-10 rounded-xl bg-[#0F4A2F] flex items-center justify-center text-green-300 flex-shrink-0">{icon}</div>
      <div>
        <h2 className="text-lg font-bold text-[#0F4A2F] leading-tight">{title}</h2>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────

export default function SiteMonitoringDetails() {
  const { site_id } = useParams<{ site_id: string }>();
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const [detail, setDetail] = useState<SiteMonitoringDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Modals
  const [completionModal, setCompletionModal] = useState<{ open: boolean; type: "completed" | "failed" | null; reason: string }>({ open: false, type: null, reason: "" });
  const [rejectReportModal, setRejectReportModal] = useState<{ open: boolean; reportId: number | null; reason: string }>({ open: false, reportId: null, reason: "" });
  const [alertModal, setAlertModal] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [updateOrientationModal, setUpdateOrientationModal] = useState<{ open: boolean; newDate: string; reason: string }>({ open: false, newDate: "", reason: "" });
  const [statusChangeModal, setStatusChangeModal] = useState<{ open: boolean; newStatus: string; reason: string }>({ open: false, newStatus: "", reason: "" });

  // States
  const [submitting, setSubmitting] = useState(false);
  const [sendingAlert, setSendingAlert] = useState(false);
  const [PSalert, setPSAlert] = useState<{ type: "success" | "failed" | "error"; title: string; message: string } | null>(null);

  const fetchSiteDetails = async () => {
    if (!site_id) {
      console.error("No site_id in URL params");
      setPSAlert({ type: "error", title: "Error", message: "No Site ID provided in URL." });
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const url = `${API_BASE}api/get_site_monitoring_details/${site_id}/`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to load site details: ${res.status} ${errorText}`);
      }

      const data = await res.json();
      setDetail(data);
    } catch (err: any) {
      console.error("Fetch error:", err);
      setPSAlert({ type: "error", title: "Error", message: err.message || "Failed to load site details. Check console for details." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSiteDetails();
  }, [site_id]);

  const handleUpdateProgressReport = async (reportId: number, status: "accepted" | "rejected", reason: string) => {
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}api/update_progress_report/${reportId}/`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status, reason: reason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Action failed");
      setPSAlert({ type: "success", title: status === "accepted" ? "Report Approved!" : "Report Rejected", message: data.message ?? `Report has been ${status}.` });
      setRejectReportModal({ open: false, reportId: null, reason: "" });
      fetchSiteDetails();
    } catch (err: any) {
      setPSAlert({ type: "failed", title: "Failed", message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteApplication = async () => {
    if (!detail?.current_application || !completionModal.type) return;
    if (!completionModal.reason.trim()) {
      setPSAlert({ type: "failed", title: "Missing", message: "Please provide a reason for this decision." });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}api/complete_application/${detail.current_application.application_id}/`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status: completionModal.type, reason: completionModal.reason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Action failed");
      setPSAlert({ type: "success", title: completionModal.type === "completed" ? "Completed!" : "Marked as Failed", message: data.message ?? `Application ${completionModal.type}.` });
      setCompletionModal({ open: false, type: null, reason: "" });
      fetchSiteDetails();
    } catch (err: any) {
      setPSAlert({ type: "failed", title: "Failed", message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendAlert = async () => {
    if (!detail?.current_application || !alertMessage.trim()) {
      setPSAlert({ type: "failed", title: "Missing", message: "Please enter a message." });
      return;
    }
    setSendingAlert(true);
    try {
      const fd = new FormData();
      fd.append("application_id", String(detail.current_application.application_id));
      fd.append("message", alertMessage);
      const res = await fetch(`${API_BASE}api/alert_tree_grower/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to send alert");
      setPSAlert({ type: "success", title: "Alert Sent!", message: "Tree grower has been notified." });
      setAlertModal(false);
      setAlertMessage("");
    } catch (err: any) {
      setPSAlert({ type: "failed", title: "Failed", message: err.message });
    } finally {
      setSendingAlert(false);
    }
  };

  const handleUpdateOrientationDate = async () => {
    if (!updateOrientationModal.newDate || !updateOrientationModal.reason.trim()) {
      setPSAlert({ type: "failed", title: "Missing Fields", message: "Please provide both new date and reason for change." });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}api/update_orientation_date/${detail?.current_application?.application_id}/`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ orientation_date: updateOrientationModal.newDate, reason: updateOrientationModal.reason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update orientation date");
      setPSAlert({ type: "success", title: "Orientation Date Updated", message: `New orientation date: ${formatDate(updateOrientationModal.newDate)}` });
      setUpdateOrientationModal({ open: false, newDate: "", reason: "" });
      fetchSiteDetails();
    } catch (err: any) {
      setPSAlert({ type: "failed", title: "Failed", message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateSiteStatus = async () => {
    if (!statusChangeModal.newStatus || !statusChangeModal.reason.trim()) {
      setPSAlert({ type: "failed", title: "Missing", message: "Please provide a reason for this status change." });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}api/update_site_monitoring_status/${site_id}/`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ monitoring_status: statusChangeModal.newStatus, reason: statusChangeModal.reason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Action failed");
      setPSAlert({ type: "success", title: "Status Updated", message: data.message });
      setStatusChangeModal({ open: false, newStatus: "", reason: "" });
      fetchSiteDetails();
    } catch (err: any) {
      setPSAlert({ type: "failed", title: "Failed", message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const calculateSpeciesBreakdown = () => {
    const acceptedReports = detail?.progress_reports.filter((r) => r.status === "accepted") || [];
    
    const initialReports = acceptedReports.filter((r) => r.visit_type === "initial");
    const oldestInitialReport = initialReports.length > 0 
      ? initialReports.sort((a, b) => new Date(a.submitted_at || 0).getTime() - new Date(b.submitted_at || 0).getTime())[0] 
      : null;

    const ongoingReports = acceptedReports.filter((r) => r.visit_type !== "initial");

    const allSpeciesIds = new Set<number>();
    const speciesNameMap = new Map<number, string>();
    acceptedReports.forEach((report) => report.species.forEach((sp) => { 
      allSpeciesIds.add(sp.species_id); 
      speciesNameMap.set(sp.species_id, sp.species_name); 
    }));

    const breakdown = [];
    for (const speciesId of allSpeciesIds) {
      const speciesName = speciesNameMap.get(speciesId) || "Unknown";
      
      const initialSpecies = oldestInitialReport?.species.find((sp) => sp.species_id === speciesId);
      const officially_planted = initialSpecies?.no_planted || 0;

      let total_added = 0;
      acceptedReports.forEach((report) => { 
        const sp = report.species.find((s) => s.species_id === speciesId); 
        total_added += sp?.no_added_by_grower || 0; 
      });

      const sortedOngoing = [...ongoingReports].sort((a, b) => new Date(b.submitted_at || 0).getTime() - new Date(a.submitted_at || 0).getTime());
      let total_dead = 0;
      for (let i = 0; i < sortedOngoing.length; i++) { 
        const sp = sortedOngoing[i].species.find((s) => s.species_id === speciesId); 
        if (sp) { 
          total_dead = sp.no_dead; 
          break; 
        } 
      }
      if (total_dead === 0 && initialSpecies) total_dead = initialSpecies.no_dead || 0;

      const total_accounted = officially_planted + total_added;
      const calculated_survived = Math.max(0, total_accounted - total_dead);
      const survival_rate = total_accounted > 0 ? (calculated_survived / total_accounted) * 100 : 0;

      breakdown.push({ 
        tree_species_id: speciesId, 
        species_name: speciesName, 
        officially_planted, 
        total_added, 
        total_dead, 
        calculated_survived, 
        survival_rate 
      });
    }
    return breakdown;
  };

  const speciesBreakdown = calculateSpeciesBreakdown();
  const pendingReports = detail?.progress_reports.filter((r) => r.status === "pending") || [];
  const firstPendingReport = pendingReports[0];
  const appStatus = detail?.current_application?.status || "";
  const isNeedsOrientation = appStatus === "accepted";

  // ✅ NEW: Check if an initial orientation report has been accepted
  const hasAcceptedInitialReport = detail?.progress_reports.some(
    (r) => r.visit_type === "initial" && r.status === "accepted"
  );

  // ✅ NEW: Find the baseline report ID (oldest accepted initial report)
  const baselineReportId = useMemo(() => {
    if (!detail) return null;
    const initialReports = detail.progress_reports
      .filter((r) => r.visit_type === "initial" && r.status === "accepted")
      .sort((a, b) => new Date(a.submitted_at || 0).getTime() - new Date(b.submitted_at || 0).getTime());
    return initialReports.length > 0 ? initialReports[0].report_id : null;
  }, [detail]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#0F4A2F] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-500">Loading site details…</span>
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <FileText size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">Site not found or failed to load</p>
          <button onClick={() => navigate(-1)} className="mt-4 text-[#0F4A2F] hover:underline text-sm font-medium">← Go back</button>
        </div>
      </div>
    );
  }

  const { site, metrics, total_seedlings_provided, seedling_requests_breakdown, current_application, historical_applications, progress_reports } = detail;
  const monitoringBadge = getMonitoringStatusBadge(site.monitoring_status);
  const MonitoringIcon = monitoringBadge.icon;

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {PSalert && (
        <PlantScopeAlert
          type={PSalert.type}
          title={PSalert.title}
          message={PSalert.message}
          onClose={() => setPSAlert(null)}
        />
      )}

      {/* ─ Header */}
      <header className="bg-gradient-to-r from-[#0F4A2F] to-[#1a6b44] text-white px-6 py-5 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2.5 flex-1">
            <Leaf size={22} className="text-green-300" />
            <div>
              <h1 className="text-xl font-bold leading-tight">Site Monitoring Details</h1>
              <p className="text-xs text-green-200 mt-0.5 truncate max-w-md">{site.name} • {site.reforestation_area_name || "Unknown Area"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={current_application ? current_application.status : "inactive"} />
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${monitoringBadge.color}`}>
              <MonitoringIcon size={13} /> {monitoringBadge.label}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        <div className="flex gap-6 flex-col lg:flex-row">
          {/*  Left: Site Info + Metrics + Reports ─ */}
          <div className="flex-1 min-w-0 space-y-6">
            
            {/* Site Information & Tree Growers */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <SectionHeader icon={<MapPin size={18} />} title="Site Information" subtitle="Details of the monitored planting site" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="flex flex-col gap-0.5 py-2 border-b border-gray-100">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Total Area</span>
                  <span className="text-sm text-gray-800 font-medium">{site.total_area_hectares.toFixed(2)} hectares</span>
                </div>
                <div className="flex flex-col gap-0.5 py-2 border-b border-gray-100">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Land Classification</span>
                  <span className="text-sm text-gray-800 font-medium">{site.land_classification_name || "Not classified"}</span>
                </div>
                <div className="flex flex-col gap-0.5 py-2 border-b border-gray-100 md:col-span-2">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Accessibility</span>
                  <span className="text-sm text-gray-800 font-medium">{getAccessibilityText(site.accessibility)}</span>
                </div>
              </div>

              {/* Current vs Historical Tree Growers */}
              <div className="pt-6 border-t border-gray-100">
                {current_application ? (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Users size={16} className="text-emerald-700" />
                      <h3 className="text-sm font-bold text-emerald-800">Current Tree Grower (Active Program)</h3>
                    </div>
                    <p className="text-sm font-semibold text-gray-800">{current_application.group_name}</p>
                    <p className="text-xs text-gray-600 mt-1">Contact: {current_application.group_contact || "N/A"}</p>
                    
                    {isNeedsOrientation && (
                      <div className="mt-3 flex gap-2">
                        <button onClick={() => setUpdateOrientationModal({ open: true, newDate: "", reason: "" })} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors">
                          <Edit2 size={12} /> Update Orientation Date
                        </button>
                        <button onClick={() => navigate(`/DataManager/calendar?from=evaluation&appId=${current_application.application_id}`)} className="flex items-center gap-1.5 px-3 py-1.5 border border-[#0F4A2F] text-[#0F4A2F] rounded-lg text-xs font-semibold hover:bg-[#0F4A2F]/10 transition-colors">
                          <Globe size={12} /> Open Calendar
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle size={16} className="text-slate-600" />
                      <h3 className="text-sm font-bold text-slate-800">No Active Tree Grower</h3>
                    </div>
                    <p className="text-xs text-slate-600">This site is currently inactive. Monitoring can continue, or a new application can be assigned.</p>
                  </div>
                )}

                {historical_applications.length > 0 && (
                  <details className="group">
                    <summary className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-gray-600 hover:text-[#0F4A2F] transition-colors">
                      <History size={16} />
                      View Historical Tree Growers ({historical_applications.length})
                      <span className="ml-auto group-open:rotate-180 transition-transform">▼</span>
                    </summary>
                    <div className="mt-3 space-y-2 pl-6 border-l-2 border-gray-200">
                      {historical_applications.map((app) => (
                        <div key={app.application_id} className="flex items-center justify-between py-2">
                          <div>
                            <p className="text-sm font-medium text-gray-800">{app.group_name}</p>
                            <p className="text-xs text-gray-500">Started: {formatDate(app.created_at)}</p>
                          </div>
                          <StatusBadge status={app.status} />
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            </div>

            {/* ✅ UPDATED: Lifetime Metrics */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h3 className="text-sm font-bold text-[#0F4A2F] mb-4 flex items-center gap-2">
                <TrendingUp size={16} /> Lifetime Site Metrics
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 text-center">
                  <Package size={20} className="text-emerald-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-emerald-800">{total_seedlings_provided.toLocaleString()}</p>
                  <p className="text-xs text-emerald-600 font-medium">Total Seedlings Provided</p>
                </div>
                <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100 text-center">
                  <Trees size={20} className="text-indigo-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-indigo-800">{(metrics.total_planted + metrics.total_added).toLocaleString()}</p>
                  <p className="text-xs text-indigo-600 font-medium">Total Planted</p>
                </div>
                <div className="p-4 bg-red-50 rounded-xl border border-red-100 text-center">
                  <XCircle size={20} className="text-red-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-red-800">{metrics.total_dead.toLocaleString()}</p>
                  <p className="text-xs text-red-600 font-medium">Total Dead</p>
                </div>
                <div className="p-4 bg-green-50 rounded-xl border border-green-100 text-center">
                  <CheckCircle2 size={20} className="text-green-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-green-800">{metrics.total_survived.toLocaleString()}</p>
                  <p className="text-xs text-green-600 font-medium">Total Survived</p>
                </div>
              </div>
              <div className={`mt-4 p-4 rounded-xl border text-center ${metrics.survival_rate >= 80 ? "bg-green-50 border-green-200 text-green-700" : metrics.survival_rate >= 50 ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-red-50 border-red-200 text-red-700"}`}>
                <TrendingUp size={20} className="mx-auto mb-2" />
                <p className="text-2xl font-bold">{metrics.survival_rate.toFixed(1)}%</p>
                <p className="text-xs font-medium">Overall Survival Rate</p>
              </div>
            </div>

            {/* ✅ NEW: Seedling Request Breakdown */}
            {seedling_requests_breakdown.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <SectionHeader icon={<Package size={16} />} title="Seedling Request Breakdown" subtitle="Total accepted seedlings provided by ENRO across all applications" />
                <div className="space-y-3">
                  {seedling_requests_breakdown.map((sp, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                          <Leaf size={16} className="text-emerald-600" />
                        </div>
                        <span className="font-bold text-gray-800">{sp.species_name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold text-emerald-700">{sp.total_requested.toLocaleString()}</span>
                        <span className="text-xs text-gray-500 font-medium uppercase">seedlings</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Species Progress Breakdown */}
            {speciesBreakdown.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <SectionHeader icon={<Trees size={16} />} title="Species Progress Breakdown" subtitle="Survived is auto-calculated: (Planted + Added) - Dead" />
                <div className="space-y-3">
                  {speciesBreakdown.map((sp) => (
                    <div key={sp.tree_species_id} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Sprout size={16} className="text-[#0F4A2F]" />
                          <span className="font-bold text-gray-800">{sp.species_name}</span>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${sp.survival_rate >= 80 ? "bg-green-50 text-green-700 border-green-200" : sp.survival_rate >= 50 ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-red-50 text-red-700 border-red-200"}`}>
                          {sp.survival_rate.toFixed(1)}% Survival
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                        <div><p className="text-xs text-gray-500 mb-1">Officially Planted</p><p className="font-bold text-blue-700">{sp.officially_planted}</p></div>
                        <div><p className="text-xs text-gray-500 mb-1">Added by Grower</p><p className="font-bold text-emerald-700">{sp.total_added}</p></div>
                        <div><p className="text-xs text-gray-500 mb-1">Total Planted</p><p className="font-bold text-indigo-700">{sp.officially_planted + sp.total_added}</p></div>
                        <div><p className="text-xs text-gray-500 mb-1">Total Dead</p><p className="font-bold text-red-700">{sp.total_dead}</p></div>
                        <div><p className="text-xs text-gray-500 mb-1">Calculated Survived</p><p className="font-bold text-green-700">{sp.calculated_survived}</p></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Progress Reports */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <SectionHeader icon={<FileText size={16} />} title="Progress Reports" subtitle={`${progress_reports.length} total reports submitted`} />

              {progress_reports.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">No progress reports submitted yet.</p>
              ) : (
                <div className="space-y-4">
                  {progress_reports.map((report) => {
                    const isPending = report.status === "pending";
                    const isInitial = report.visit_type === "initial";
                    const isBaseline = isInitial && report.report_id === baselineReportId;

                    return (
                      <div key={report.report_id} className={`p-5 rounded-xl border transition-all ${isPending ? "bg-amber-50/50 border-amber-200" : "bg-gray-50 border-gray-100"}`}>
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-bold text-gray-800">{report.group_name}</span>
                              <span className="text-xs text-gray-400">•</span>
                              <span className="text-xs text-gray-500">{formatDate(report.submitted_at)}</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wide ${isInitial ? "bg-blue-100 text-blue-700" : report.visit_type === "inactive_check" ? "bg-slate-200 text-slate-700" : "bg-purple-100 text-purple-700"}`}>
                                {isInitial ? "Initial Orientation" : report.visit_type === "inactive_check" ? "Inactive Check" : "Ongoing Monitoring"}
                              </span>
                              {report.application_title && (
                                <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                                  App: {report.application_title}
                                </span>
                              )}
                            </div>
                          </div>
                          <StatusBadge status={report.status} />
                        </div>

                        {/* ✅ UPDATED: 2-Column Grid based on Baseline vs Others */}
                        <div className="grid grid-cols-2 gap-3 mb-4">
                          {isBaseline ? (
                            <>
                              <div className="bg-white rounded-lg p-3 text-center border border-gray-100">
                                <p className="text-lg font-bold text-blue-600">
                                  {report.species.reduce((sum, sp) => sum + sp.no_planted, 0).toLocaleString()}
                                </p>
                                <p className="text-[10px] text-gray-500 font-medium uppercase">Officially Planted</p>
                              </div>
                              <div className="bg-white rounded-lg p-3 text-center border border-gray-100">
                                <p className="text-lg font-bold text-red-600">{report.total_dead.toLocaleString()}</p>
                                <p className="text-[10px] text-gray-500 font-medium uppercase">Dead</p>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="bg-white rounded-lg p-3 text-center border border-gray-100">
                                <p className="text-lg font-bold text-emerald-600">{report.total_added_by_grower.toLocaleString()}</p>
                                <p className="text-[10px] text-gray-500 font-medium uppercase">Added</p>
                              </div>
                              <div className="bg-white rounded-lg p-3 text-center border border-gray-100">
                                <p className="text-lg font-bold text-red-600">{report.total_dead.toLocaleString()}</p>
                                <p className="text-[10px] text-gray-500 font-medium uppercase">Dead</p>
                              </div>
                            </>
                          )}
                        </div>

                        {report.species && report.species.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-gray-100">
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                              Species Details
                            </p>
                            <div className="space-y-2">
                              {report.species.map((sp, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-100">
                                  <div className="flex items-center gap-2">
                                    <Trees size={14} className="text-gray-400" />
                                    <span className="text-sm font-medium text-gray-700">{sp.species_name}</span>
                                  </div>
                                  <div className="flex items-center gap-4 text-xs">
                                    {/* ✅ UPDATED: Show Planted ONLY for baseline, Added for others */}
                                    {isBaseline && sp.no_planted > 0 && (
                                      <div className="text-center">
                                        <p className="text-gray-400">Planted</p>
                                        <p className="font-semibold text-blue-600">{sp.no_planted}</p>
                                      </div>
                                    )}
                                    {!isBaseline && sp.no_added_by_grower > 0 && (
                                      <div className="text-center">
                                        <p className="text-gray-400">Added</p>
                                        <p className="font-semibold text-emerald-600">{sp.no_added_by_grower}</p>
                                      </div>
                                    )}
                                    <div className="text-center">
                                      <p className="text-gray-400">Dead</p>
                                      <p className="font-semibold text-red-600">{sp.no_dead}</p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {report.description && (
                          <div className="bg-white p-3 rounded-lg border border-gray-100 mb-3">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Inspector Notes</p>
                            <p className="text-sm text-gray-700">{report.description}</p>
                          </div>
                        )}

                        {report.proof_image && (
                          <a href={report.proof_image} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-[#0F4A2F] font-semibold hover:underline bg-green-50 px-3 py-1.5 rounded-lg border border-green-200">
                            <Download size={12} /> View Proof Image
                          </a>
                        )}

                        {isPending && (
                          <div className="flex gap-2 mt-4 pt-4 border-t border-amber-200">
                            <button onClick={() => handleUpdateProgressReport(report.report_id, "accepted", "Report approved")} disabled={submitting} className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-[#0F4A2F] text-white text-xs font-bold hover:bg-[#1a6b44] transition-colors disabled:opacity-50">
                              <CheckCircle2 size={14} /> Approve
                            </button>
                            <button onClick={() => setRejectReportModal({ open: true, reportId: report.report_id, reason: "" })} disabled={submitting} className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-white border border-red-200 text-red-600 text-xs font-bold hover:bg-red-50 transition-colors disabled:opacity-50">
                              <XCircle size={14} /> Request Changes
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ─ Right: Actions Panel ── */}
          <div className="w-full lg:w-80 flex-shrink-0">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm sticky top-6">
              <div className="p-5 border-b border-gray-100">
                <h3 className="font-bold text-gray-900">Site Actions</h3>
                <p className="text-xs text-gray-400 mt-1">Manage monitoring & status</p>
              </div>

              <div className="p-5 space-y-4">
                {!firstPendingReport ? (
                  <div className="p-4 bg-green-50 rounded-xl border border-green-200 text-center">
                    <CheckCircle2 size={24} className="text-green-600 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-green-800">All Reports Up to Date</p>
                    <p className="text-xs text-green-600 mt-1">No pending reports require your attention.</p>
                  </div>
                ) : (
                  <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                    <p className="text-xs font-bold text-amber-800 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                      <BellRing size={14} /> Action Required
                    </p>
                    <p className="text-xs text-amber-700 mb-4 leading-relaxed">
                      A report submitted by <strong>{firstPendingReport.group_name}</strong> is pending your review.
                    </p>
                    <div className="space-y-2">
                      <button onClick={() => handleUpdateProgressReport(firstPendingReport.report_id, "accepted", "Report approved")} disabled={submitting} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#0F4A2F] text-white text-sm font-bold hover:bg-[#1a6b44] transition-colors disabled:opacity-50">
                        <CheckCircle2 size={16} /> {submitting ? "Processing..." : "Approve Report"}
                      </button>
                      <button onClick={() => setRejectReportModal({ open: true, reportId: firstPendingReport.report_id, reason: "" })} disabled={submitting} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white border border-red-200 text-red-600 text-sm font-bold hover:bg-red-50 transition-colors disabled:opacity-50">
                        <XCircle size={16} /> Request Changes
                      </button>
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t border-gray-100">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Status Management</p>
                  
                  {site.monitoring_status === "available" && (
                    <button onClick={() => setStatusChangeModal({ open: true, newStatus: "onhold", reason: "" })} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gray-600 text-white text-sm font-bold hover:bg-gray-700 transition-colors">
                      <PauseCircle size={16} /> Put Site On Hold
                    </button>
                  )}

                  {site.monitoring_status === "onhold" && (
                    <button onClick={() => setStatusChangeModal({ open: true, newStatus: "available", reason: "" })} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors">
                      <ShieldCheck size={16} /> Release Site (Make Available)
                    </button>
                  )}

                  {/* ✅ UPDATED: Only show Completed/Failed buttons if Initial Report is Accepted */}
                  {site.monitoring_status === "under_monitoring" && current_application && hasAcceptedInitialReport && (
                    <div className="space-y-2">
                      <button onClick={() => setCompletionModal({ open: true, type: "completed", reason: "" })} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-600 text-white text-sm font-bold hover:bg-green-700 transition-colors">
                        <CheckCircle2 size={16} /> Mark Application Completed
                      </button>
                      <button onClick={() => setCompletionModal({ open: true, type: "failed", reason: "" })} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 transition-colors">
                        <XCircle size={16} /> Mark Application Failed
                      </button>
                    </div>
                  )}

                  {(site.monitoring_status === "completed" || site.monitoring_status === "failed") && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                      <p className="text-xs text-slate-600 font-medium">
                        This site is currently <span className="font-bold capitalize">{site.monitoring_status.replace("_", " ")}</span>. 
                        Independent monitoring checks are still permitted, but new applications are blocked.
                      </p>
                      <button onClick={() => setStatusChangeModal({ open: true, newStatus: "available", reason: "" })} className="mt-3 w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors">
                        <ShieldCheck size={14} /> Re-open Site (Make Available)
                      </button>
                    </div>
                  )}
                  
                  {site.monitoring_status === "reserved" && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center">
                      <p className="text-xs text-amber-700 font-medium flex items-center justify-center gap-1">
                        <Clock size={14} /> Site is reserved — pending Head approval
                      </p>
                    </div>
                  )}
                </div>

                {current_application && (
                  <div className="pt-4 border-t border-gray-100">
                    <button onClick={() => setAlertModal(true)} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-amber-200 text-amber-600 text-sm font-bold hover:bg-amber-50 transition-colors">
                      <BellRing size={16} /> Alert Tree Grower
                    </button>
                  </div>
                )}

                <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                  <p className="text-xs text-blue-800 flex items-start gap-2">
                    <Info size={14} className="flex-shrink-0 mt-0.5" />
                    <span>
                      {current_application 
                        ? "An active program is running. Metrics reflect lifetime data across all historical and current applications." 
                        : "This site is currently inactive. You can still submit independent monitoring reports to track its condition."}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Modals remain the same... */}
      {updateOrientationModal.open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4"><Calendar size={28} className="text-blue-600" /></div>
            <h3 className="text-lg font-bold text-center text-gray-800 mb-1">Update Orientation Date</h3>
            <p className="text-sm text-center text-gray-500 mb-5">"{current_application?.group_name}"</p>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">New Orientation Date *</label>
            <input type="date" value={updateOrientationModal.newDate} onChange={(e) => setUpdateOrientationModal((p) => ({ ...p, newDate: e.target.value }))} className="w-full border border-gray-200 rounded-xl p-3 text-sm text-gray-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 mb-4 transition-colors" />
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Reason for Change *</label>
            <textarea rows={4} value={updateOrientationModal.reason} onChange={(e) => setUpdateOrientationModal((p) => ({ ...p, reason: e.target.value }))} placeholder="e.g. Schedule conflict, weather conditions..." className="w-full border border-gray-200 rounded-xl p-3 text-sm text-gray-700 resize-none focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 mb-5 transition-colors" />
            <div className="flex gap-3">
              <button onClick={() => setUpdateOrientationModal({ open: false, newDate: "", reason: "" })} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleUpdateOrientationDate} disabled={submitting || !updateOrientationModal.newDate || !updateOrientationModal.reason.trim()} className={`flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-all ${submitting || !updateOrientationModal.newDate || !updateOrientationModal.reason.trim() ? "opacity-50 cursor-not-allowed" : ""}`}>
                {submitting ? "Updating…" : "Update Date"}
              </button>
            </div>
          </div>
        </div>
      )}

      {completionModal.open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${completionModal.type === "completed" ? "bg-green-100" : "bg-red-100"}`}>
              {completionModal.type === "completed" ? <CheckCircle2 size={28} className="text-green-600" /> : <XCircle size={28} className="text-red-500" />}
            </div>
            <h3 className="text-lg font-bold text-center text-gray-800 mb-1">{completionModal.type === "completed" ? "Mark as Completed?" : "Mark as Failed?"}</h3>
            <p className="text-sm text-center text-gray-500 mb-5">"{current_application?.group_name}"</p>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Reason *</label>
            <textarea rows={4} value={completionModal.reason} onChange={(e) => setCompletionModal((p) => ({ ...p, reason: e.target.value }))} placeholder={completionModal.type === "completed" ? "e.g. All objectives met" : "e.g. Insufficient survival rate"} className="w-full border border-gray-200 rounded-xl p-3 text-sm text-gray-700 resize-none focus:outline-none focus:border-[#0F4A2F] focus:ring-1 focus:ring-[#0F4A2F] mb-5 transition-colors" />
            <div className="flex gap-3">
              <button onClick={() => setCompletionModal({ open: false, type: null, reason: "" })} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleCompleteApplication} disabled={submitting || !completionModal.reason.trim()} className={`flex-1 py-2.5 rounded-xl text-white text-sm font-bold transition-all ${completionModal.type === "completed" ? "bg-green-600 hover:bg-green-700" : "bg-red-500 hover:bg-red-600"} ${submitting || !completionModal.reason.trim() ? "opacity-50 cursor-not-allowed" : ""}`}>
                {submitting ? "Processing…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {rejectReportModal.open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4"><XCircle size={28} className="text-red-500" /></div>
            <h3 className="text-lg font-bold text-center text-gray-800 mb-1">Request Changes?</h3>
            <p className="text-sm text-center text-gray-500 mb-5">The inspector will be notified to revise and resubmit this report.</p>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Reason for Rejection *</label>
            <textarea rows={4} value={rejectReportModal.reason} onChange={(e) => setRejectReportModal((p) => ({ ...p, reason: e.target.value }))} placeholder="e.g. Proof image is blurry, please retake." className="w-full border border-gray-200 rounded-xl p-3 text-sm text-gray-700 resize-none focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 mb-5 transition-colors" />
            <div className="flex gap-3">
              <button onClick={() => setRejectReportModal({ open: false, reportId: null, reason: "" })} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={() => rejectReportModal.reportId && handleUpdateProgressReport(rejectReportModal.reportId, "rejected", rejectReportModal.reason)} disabled={submitting || !rejectReportModal.reason.trim()} className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                {submitting ? "Processing…" : "Send Request"}
              </button>
            </div>
          </div>
        </div>
      )}

      {alertModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4"><BellRing size={28} className="text-amber-500" /></div>
            <h3 className="text-lg font-bold text-center text-gray-800 mb-1">Alert Tree Grower</h3>
            <p className="text-sm text-center text-gray-500 mb-5">Send a message to <span className="font-semibold">{current_application?.group_name}</span></p>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Message *</label>
            <textarea rows={4} value={alertMessage} onChange={(e) => setAlertMessage(e.target.value)} placeholder="e.g. Please submit an updated progress report..." className="w-full border border-gray-200 rounded-xl p-3 text-sm text-gray-700 resize-none focus:outline-none focus:ring-1 focus:ring-amber-300 mb-2 transition-colors" />
            <div className="flex items-start gap-1.5 mb-5 text-amber-600 bg-amber-50 rounded-xl px-3 py-2">
              <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
              <p className="text-xs">The tree grower will receive this message as a notification.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setAlertModal(false); setAlertMessage(""); }} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleSendAlert} disabled={sendingAlert || !alertMessage.trim()} className={`flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold transition-all ${sendingAlert || !alertMessage.trim() ? "opacity-50 cursor-not-allowed" : ""}`}>
                {sendingAlert ? "Sending…" : "Send Alert"}
              </button>
            </div>
          </div>
        </div>
      )}

      {statusChangeModal.open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={28} className="text-amber-600" />
            </div>
            <h3 className="text-lg font-bold text-center text-gray-800 mb-1">Change Site Status?</h3>
            <p className="text-sm text-center text-gray-500 mb-5">
              You are about to change the status to <span className="font-bold capitalize">{statusChangeModal.newStatus.replace("_", " ")}</span>.
            </p>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Reason *</label>
            <textarea 
              rows={4} 
              value={statusChangeModal.reason} 
              onChange={(e) => setStatusChangeModal((p) => ({ ...p, reason: e.target.value }))} 
              placeholder="e.g. Land dispute resolved, ready for new applicants..." 
              className="w-full border border-gray-200 rounded-xl p-3 text-sm text-gray-700 resize-none focus:outline-none focus:border-[#0F4A2F] focus:ring-1 focus:ring-[#0F4A2F] mb-5 transition-colors" 
            />
            <div className="flex gap-3">
              <button 
                onClick={() => setStatusChangeModal({ open: false, newStatus: "", reason: "" })} 
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleUpdateSiteStatus} 
                disabled={submitting || !statusChangeModal.reason.trim()} 
                className={`flex-1 py-2.5 rounded-xl text-white text-sm font-bold transition-all ${submitting || !statusChangeModal.reason.trim() ? "opacity-50 cursor-not-allowed bg-gray-400" : "bg-[#0F4A2F] hover:bg-[#1a6b44]"}`}
              >
                {submitting ? "Processing…" : "Confirm Change"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}