import { useEffect, useState } from "react";
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
  Package,
  Sprout,
  MapPin,
  Car,
  Layers,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import PlantScopeAlert from "../../../components/alert/PlantScopeAlert";
import { api } from "@/constant/api.ts";

// ─── Types ──────────────────────────────────────────────────────────────────

interface SeedlingSpeciesItem {
  species_id: number;
  species_name: string;
  quantity: number;
  provided_by: string;
}

interface ProgressReportSpeciesItem {
  species_id: number;
  species_name: string;
  no_survived: number;
  no_dead: number;
  total: number;
  survival_rate: number;
}

interface ApplicationDetail {
  application: {
    application_id: number;
    title: string;
    classification: "new" | "old";
    status: string;
    total_treegrowers_will_participate: number;
    orientation_date: string | null;
    confirmed_at: string | null;
    maintenance_plan: string | null;
    agreement_image: string | null;
    created_at: string;
    updated_at: string;
  };
  group: {
    group_name: string;
    group_type: string;
    group_contact: string;
    group_address: string;
    group_profile: string | null;
  };
  profile: {
    first_name: string;
    last_name: string;
    contact: string;
    gender: string;
    profile_img: string;
  } | null;
  assigned_site: {
    site_id: number;
    name: string;
    total_area_hectares: number;
    ndvi_value: number | null;
    polygon_coordinates: any;
    reforestation_area_name: string | null;
    barangay_name: string | null;
    accessibility: any;
    land_classification_name: string | null;
    general_images: any[];
    recommended_species: { species_id: number; species_name: string; rank: number }[];
  } | null;
  seedling_requests: Array<{
    request_id: number;
    no_request_seedling: number;
    species: SeedlingSpeciesItem[];
    status: "pending" | "accepted" | "rejected";
    reason_accepted: string | null;
    submitted_at: string | null;
  }>;
  progress_reports: Array<{
    report_id: number;
    total_survived: number;
    total_dead: number;
    species: ProgressReportSpeciesItem[];
    description: string | null;
    status: "pending" | "accepted" | "rejected";
    proof_image: string | null;
    submitted_at: string | null;
  }>;
  latest_reason: { reason: string; status: string; created: string } | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const API_BASE = api;

const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; border: string; icon: React.ReactNode }
> = {
  accepted: {
    label: "Accepted",
    bg: "bg-green-50",
    text: "text-green-700",
    border: "border-green-200",
    icon: <CheckCircle2 size={13} className="text-green-500" />,
  },
  pending: {
    label: "Pending",
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    icon: <Clock size={13} className="text-amber-500" />,
  },
  rejected: {
    label: "Rejected",
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200",
    icon: <XCircle size={13} className="text-red-500" />,
  },
  completed: {
    label: "Completed",
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    icon: <CheckCircle2 size={13} className="text-blue-500" />,
  },
  failed: {
    label: "Failed",
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200",
    icon: <XCircle size={13} className="text-red-500" />,
  },
  under_monitoring: {
    label: "Monitoring",
    bg: "bg-teal-50",
    text: "text-teal-700",
    border: "border-teal-200",
    icon: <TrendingUp size={13} className="text-teal-500" />,
  },
  for_evaluation: {
    label: "For Evaluation",
    bg: "bg-gray-50",
    text: "text-gray-700",
    border: "border-gray-200",
    icon: <Clock size={13} className="text-gray-500" />,
  },
  for_head: {
    label: "For Head",
    bg: "bg-purple-50",
    text: "text-purple-700",
    border: "border-purple-200",
    icon: <Clock size={13} className="text-purple-500" />,
  },
};

const StatusBadge = ({ status }: { status: string }) => {
  const conf = STATUS_CONFIG[status] ?? {
    label: status,
    bg: "bg-gray-50",
    text: "text-gray-600",
    border: "border-gray-200",
    icon: null,
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${conf.bg} ${conf.text} ${conf.border}`}
    >
      {conf.icon}
      {conf.label}
    </span>
  );
};

const getAccessibilityText = (accessibility: any) => {
  if (!accessibility) return "Not specified";
  if (typeof accessibility === 'string') return accessibility;
  if (typeof accessibility === 'object') {
    if (accessibility.type) return accessibility.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    if (accessibility.description) return accessibility.description;
  }
  return "Specified";
};

// ─── Main Component ──────────────────────────────────────────────────────────

export default function Maintenance_report() {
  const { application_id } = useParams<{ application_id: string }>();
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const [detail, setDetail] = useState<ApplicationDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Completion decision modal
  const [completionModal, setCompletionModal] = useState<{
    open: boolean;
    type: "completed" | "failed" | null;
    reason: string;
  }>({ open: false, type: null, reason: "" });
  const [submitting, setSubmitting] = useState(false);

  // Alert tree grower modal
  const [alertModal, setAlertModal] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [sendingAlert, setSendingAlert] = useState(false);

  const [PSalert, setPSAlert] = useState<{
    type: "success" | "failed" | "error";
    title: string;
    message: string;
  } | null>(null);

  // ─── Fetch Application Details ─────────────────────────────────────────────
  const fetchApplication = async () => {
    if (!application_id) return;
    
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}api/get_application/${application_id}/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load application");
      const data = await res.json();
      setDetail(data);
    } catch (err: any) {
      setPSAlert({ type: "error", title: "Error", message: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplication();
  }, [application_id]);

  // ─── Filter Accepted Items & Calculate Metrics ─────────────────────────────
  const acceptedSeedlingRequests = detail?.seedling_requests.filter(r => r.status === "accepted") || [];
  
  // ✅ UPDATED: Show ALL progress reports (both pending and accepted)
  const allProgressReports = detail?.progress_reports || [];

  const totalSeedlingsProvided = acceptedSeedlingRequests.reduce((sum, req) => {
    return sum + (req.species?.reduce((sSum, sp) => sSum + sp.quantity, 0) || 0);
  }, 0);

  const totalSurvived = allProgressReports.reduce((sum, rep) => sum + (rep.total_survived || 0), 0);
  const totalDead = allProgressReports.reduce((sum, rep) => sum + (rep.total_dead || 0), 0);
  const totalPlantsMonitored = totalSurvived + totalDead;
  const survivalRate = totalPlantsMonitored > 0 ? ((totalSurvived / totalPlantsMonitored) * 100).toFixed(1) : "0.0";
  const survivalRateNum = parseFloat(survivalRate);
  
  const survivalColor = survivalRateNum >= 80 ? "text-green-600 bg-green-50 border-green-200" :
                        survivalRateNum >= 50 ? "text-amber-600 bg-amber-50 border-amber-200" :
                        "text-red-600 bg-red-50 border-red-200";

  // ─── Complete Application (Completed/Failed) ───────────────────────────────
  const handleCompleteApplication = async () => {
    if (!application_id || !completionModal.type) return;
    if (!completionModal.reason.trim()) {
      setPSAlert({ type: "failed", title: "Missing", message: "Please provide a reason for this decision." });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}api/complete_application/${application_id}/`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status: completionModal.type, reason: completionModal.reason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Action failed");

      setPSAlert({
        type: "success",
        title: completionModal.type === "completed" ? "Completed!" : "Marked as Failed",
        message: data.message ?? `Application ${completionModal.type}.`,
      });
      
      setCompletionModal({ open: false, type: null, reason: "" });
      fetchApplication();
    } catch (err: any) {
      setPSAlert({ type: "failed", title: "Failed", message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Send Alert to Tree Grower ─────────────────────────────────────────────
  const handleSendAlert = async () => {
    if (!application_id || !alertMessage.trim()) {
      setPSAlert({ type: "failed", title: "Missing", message: "Please enter a message." });
      return;
    }
    setSendingAlert(true);
    try {
      const fd = new FormData();
      fd.append("application_id", application_id);
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

  const formatDate = (iso: string) =>
    iso ? new Date(iso).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) : "—";

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#0F4A2F] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-500">Loading application…</span>
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <FileText size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">Application not found</p>
          <button onClick={() => navigate(-1)} className="mt-4 text-[#0F4A2F] hover:underline text-sm font-medium">
            ← Go back
          </button>
        </div>
      </div>
    );
  }

  const { application, group, assigned_site } = detail;
  const appStatus = application.status;

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {PSalert && (
        <PlantScopeAlert type={PSalert.type} title={PSalert.title} message={PSalert.message} onClose={() => setPSAlert(null)} />
      )}

      {/* ── Header ── */}
      <header className="bg-gradient-to-r from-[#0F4A2F] to-[#1a6b44] text-white px-6 py-5 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2.5">
            <Leaf size={22} className="text-green-300" />
            <div>
              <h1 className="text-xl font-bold leading-tight">Program Monitoring</h1>
              <p className="text-xs text-green-200 mt-0.5 truncate max-w-md">{application.title}</p>
            </div>
          </div>
          <div className="ml-auto">
            <StatusBadge status={appStatus} />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        <div className="flex gap-6">
          {/* ── Left: Application Info + Metrics + Reports ── */}
          <div className="flex-1 min-w-0 space-y-6">
            
            {/* Application Summary */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-[#0F4A2F]">{application.title}</h2>
                  <p className="text-sm text-gray-600 mt-1">{group.group_name} • {group.group_type}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">Classification</p>
                  <p className="text-sm font-semibold capitalize">{application.classification}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-3 py-2">
                  <Users size={12} className="text-gray-400" />
                  <span className="text-xs text-gray-500">Growers:</span>
                  <span className="text-xs font-bold text-gray-800">{application.total_treegrowers_will_participate}</span>
                </div>
                {application.orientation_date && (
                  <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-3 py-2">
                    <Calendar size={12} className="text-gray-400" />
                    <span className="text-xs text-gray-500">Orientation:</span>
                    <span className="text-xs font-bold text-gray-800">{formatDate(application.orientation_date)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* ✅ Program Progress Summary */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h3 className="text-sm font-bold text-[#0F4A2F] mb-4 flex items-center gap-2">
                <TrendingUp size={16} /> Program Progress Summary
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 text-center">
                  <Package size={20} className="text-blue-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-blue-800">{totalSeedlingsProvided.toLocaleString()}</p>
                  <p className="text-xs text-blue-600 font-medium">Seedlings Provided</p>
                </div>
                <div className="p-4 bg-green-50 rounded-xl border border-green-100 text-center">
                  <Sprout size={20} className="text-green-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-green-800">{totalSurvived.toLocaleString()}</p>
                  <p className="text-xs text-green-600 font-medium">Total Survived</p>
                </div>
                <div className="p-4 bg-red-50 rounded-xl border border-red-100 text-center">
                  <XCircle size={20} className="text-red-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-red-800">{totalDead.toLocaleString()}</p>
                  <p className="text-xs text-red-600 font-medium">Total Dead</p>
                </div>
                <div className={`p-4 rounded-xl border text-center ${survivalColor}`}>
                  <TrendingUp size={20} className="mx-auto mb-2" />
                  <p className="text-2xl font-bold">{survivalRate}%</p>
                  <p className="text-xs font-medium">Survival Rate</p>
                </div>
              </div>
            </div>

            {/* ✅ UPGRADED: Assigned Site (Rich Data) */}
            {assigned_site && (
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl border border-green-100 shadow-sm p-6">
                <h3 className="text-sm font-bold text-[#0F4A2F] mb-4 flex items-center gap-2">
                  <MapPin size={16} /> Assigned Planting Site
                </h3>
                
                <div className="flex justify-between items-start gap-4 mb-4">
                  <div>
                    <h4 className="text-lg font-bold text-[#0F4A2F]">{assigned_site.name}</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      {assigned_site.reforestation_area_name || "Reforestation Area"} 
                      {assigned_site.barangay_name && ` • ${assigned_site.barangay_name}`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <div className="text-center px-3 py-2 bg-white rounded-lg shadow-sm border border-green-100">
                      <p className="text-[10px] font-bold text-gray-500 uppercase">Area</p>
                      <p className="text-sm font-bold text-[#0F4A2F]">{assigned_site.total_area_hectares?.toFixed(2) || '0.00'} ha</p>
                    </div>
                    <div className="text-center px-3 py-2 bg-white rounded-lg shadow-sm border border-green-100">
                      <p className="text-[10px] font-bold text-gray-500 uppercase">NDVI</p>
                      <p className="text-sm font-bold text-[#0F4A2F]">{assigned_site.ndvi_value?.toFixed(2) || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-white p-3 rounded-lg border border-green-100 flex items-start gap-2">
                    <Car size={16} className="text-[#0F4A2F] mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-gray-500 uppercase">Accessibility</p>
                      <p className="text-xs font-semibold text-gray-800 truncate" title={getAccessibilityText(assigned_site.accessibility)}>
                        {getAccessibilityText(assigned_site.accessibility)}
                      </p>
                    </div>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-green-100 flex items-start gap-2">
                    <Layers size={16} className="text-[#0F4A2F] mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-gray-500 uppercase">Land Class</p>
                      <p className="text-xs font-semibold text-gray-800 truncate" title={assigned_site.land_classification_name || 'Not classified'}>
                        {assigned_site.land_classification_name || 'Not classified'}
                      </p>
                    </div>
                  </div>
                </div>

                {assigned_site.recommended_species && assigned_site.recommended_species.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <ShieldCheck size={14} className="text-[#0F4A2F]" />
                      <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">Recommended Species</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {assigned_site.recommended_species.map((sp) => (
                        <div key={sp.species_id} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white text-[#0F4A2F] text-xs font-semibold border border-green-200 shadow-sm">
                          <Sprout size={12} />
                          <span>{sp.species_name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Approved Seedling Requests */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-[#0F4A2F] flex items-center gap-2">
                  <Package size={16} /> Approved Seedling Requests
                </h3>
                <span className="text-xs text-gray-400">{acceptedSeedlingRequests.length} accepted</span>
              </div>

              {acceptedSeedlingRequests.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No accepted seedling requests yet.</p>
              ) : (
                <div className="space-y-3">
                  {acceptedSeedlingRequests.map((req) => (
                    <div key={req.request_id} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-semibold text-gray-400">
                          Submitted: {formatDate(req.submitted_at || "")}
                        </span>
                        <StatusBadge status={req.status} />
                      </div>
                      <div className="space-y-2">
                        {req.species.map((item, i) => (
                          <div key={i} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <Sprout size={14} className="text-[#0F4A2F]" />
                              <span className="font-medium">{item.species_name}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-semibold text-[#0F4A2F]">{item.quantity.toLocaleString()}</span>
                              <span className="text-xs text-gray-500">• {item.provided_by}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      {req.reason_accepted && (
                        <p className="text-xs text-gray-500 mt-3 pt-3 border-t border-gray-200">
                          <strong>Note:</strong> {req.reason_accepted}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ✅ UPDATED: ALL Progress Reports (Pending & Accepted) */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-[#0F4A2F] flex items-center gap-2">
                  <FileText size={16} /> Progress Reports
                </h3>
                <span className="text-xs text-gray-400">{allProgressReports.length} total</span>
              </div>

              {allProgressReports.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No progress reports submitted yet.</p>
              ) : (
                <div className="space-y-3">
                  {allProgressReports.map((report) => (
                    // ✅ Pending reports get a light amber background to stand out
                    <div key={report.report_id} className={`p-4 rounded-xl border ${report.status === 'pending' ? 'bg-amber-50/50 border-amber-200' : 'bg-gray-50 border-gray-100'}`}>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-semibold text-gray-400">
                          Submitted: {formatDate(report.submitted_at || "")}
                        </span>
                        <StatusBadge status={report.status} />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div className="bg-white rounded-lg p-2 text-center">
                          <p className="text-lg font-bold text-green-600">{report.total_survived.toLocaleString()}</p>
                          <p className="text-[10px] text-gray-400">Survived</p>
                        </div>
                        <div className="bg-white rounded-lg p-2 text-center">
                          <p className="text-lg font-bold text-red-600">{report.total_dead.toLocaleString()}</p>
                          <p className="text-[10px] text-gray-400">Dead</p>
                        </div>
                      </div>

                      {report.species && report.species.length > 0 && (
                        <div className="mb-3 pt-3 border-t border-gray-200">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">Species Breakdown</p>
                          <div className="space-y-1.5">
                            {report.species.map((sp, idx) => (
                              <div key={idx} className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-1.5">
                                  <Sprout size={12} className="text-[#0F4A2F]" />
                                  <span className="font-medium text-gray-700">{sp.species_name}</span>
                                </div>
                                <div className="flex items-center gap-2 text-gray-500">
                                  <span className="text-green-600 font-semibold">{sp.no_survived}</span>
                                  <span>/</span>
                                  <span className="text-red-600 font-semibold">{sp.no_dead}</span>
                                  <span className="text-gray-400">({sp.survival_rate}%)</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {report.description && (
                        <p className="text-sm text-gray-700 mb-3 pt-3 border-t border-gray-200">
                          {report.description}
                        </p>
                      )}

                      {report.proof_image && (
                        <a href={`${API_BASE}${report.proof_image}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-[#0F4A2F] hover:underline">
                          <Download size={12} /> View proof image
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Right: Actions Panel ── */}
          <div className="w-80 flex-shrink-0">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm sticky top-6">
              <div className="p-5 border-b border-gray-100">
                <h3 className="font-bold text-gray-900">Program Actions</h3>
                <p className="text-xs text-gray-400 mt-1">Manage this application's status</p>
              </div>

              <div className="p-5 space-y-4">
                {/* Completion Decision */}
                {appStatus === "accepted" || appStatus === "under_monitoring" ? (
                  <>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Final Decision</p>
                    <div className="space-y-2">
                      <button
                        onClick={() => setCompletionModal({ open: true, type: "completed", reason: "" })}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-green-600 text-white text-sm font-bold hover:bg-green-700 transition-colors"
                      >
                        <CheckCircle2 size={16} /> Mark as Completed
                      </button>
                      <button
                        onClick={() => setCompletionModal({ open: true, type: "failed", reason: "" })}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 transition-colors"
                      >
                        <XCircle size={16} /> Mark as Failed
                      </button>
                    </div>
                  </>
                ) : appStatus === "completed" ? (
                  <div className="p-4 bg-green-50 rounded-xl border border-green-200 text-center">
                    <CheckCircle2 size={24} className="text-green-600 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-green-800">Program Completed</p>
                    <p className="text-xs text-green-600 mt-1">This application has been successfully concluded.</p>
                  </div>
                ) : appStatus === "failed" ? (
                  <div className="p-4 bg-red-50 rounded-xl border border-red-200 text-center">
                    <XCircle size={24} className="text-red-600 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-red-800">Program Failed</p>
                    <p className="text-xs text-red-600 mt-1">This application did not meet objectives.</p>
                  </div>
                ) : null}

                {/* Alert Tree Grower */}
                <div className="pt-4 border-t border-gray-100">
                  <button
                    onClick={() => setAlertModal(true)}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-amber-200 text-amber-600 text-sm font-bold hover:bg-amber-50 transition-colors"
                  >
                    <BellRing size={16} /> Alert Tree Grower
                  </button>
                </div>

                {/* Info Box */}
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                  <p className="text-xs text-blue-800 flex items-start gap-2">
                    <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                    <span>Reports highlighted in amber are pending your review and approval.</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ── Completion Decision Modal ── */}
      {completionModal.open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${completionModal.type === "completed" ? "bg-green-100" : "bg-red-100"}`}>
              {completionModal.type === "completed" ? <CheckCircle2 size={28} className="text-green-600" /> : <XCircle size={28} className="text-red-500" />}
            </div>
            <h3 className="text-lg font-bold text-center text-gray-800 mb-1">
              {completionModal.type === "completed" ? "Mark as Completed?" : "Mark as Failed?"}
            </h3>
            <p className="text-sm text-center text-gray-500 mb-5">"{application.title}"</p>

            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Reason *</label>
            <textarea
              rows={4}
              value={completionModal.reason}
              onChange={(e) => setCompletionModal((p) => ({ ...p, reason: e.target.value }))}
              placeholder={completionModal.type === "completed" ? "e.g. All objectives met, final report submitted" : "e.g. Insufficient survival rate, project abandoned"}
              className="w-full border border-gray-200 rounded-xl p-3 text-sm text-gray-700 resize-none focus:outline-none focus:border-[#0F4A2F] focus:ring-1 focus:ring-[#0F4A2F] mb-5 transition-colors"
            />

            <div className="flex gap-3">
              <button onClick={() => setCompletionModal({ open: false, type: null, reason: "" })} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleCompleteApplication}
                disabled={submitting || !completionModal.reason.trim()}
                className={`flex-1 py-2.5 rounded-xl text-white text-sm font-bold transition-all ${completionModal.type === "completed" ? "bg-green-600 hover:bg-green-700" : "bg-red-500 hover:bg-red-600"} ${(submitting || !completionModal.reason.trim()) ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {submitting ? "Processing…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Alert Tree Grower Modal ── */}
      {alertModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
              <BellRing size={28} className="text-amber-500" />
            </div>
            <h3 className="text-lg font-bold text-center text-gray-800 mb-1">Alert Tree Grower</h3>
            <p className="text-sm text-center text-gray-500 mb-5">
              Send a message to <span className="font-semibold">{group.group_name}</span>
            </p>

            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Message *</label>
            <textarea
              rows={4}
              value={alertMessage}
              onChange={(e) => setAlertMessage(e.target.value)}
              placeholder="e.g. Please submit an updated progress report with current seedling data…"
              className="w-full border border-gray-200 rounded-xl p-3 text-sm text-gray-700 resize-none focus:outline-none focus:ring-1 focus:ring-amber-300 mb-2 transition-colors"
            />
            <div className="flex items-start gap-1.5 mb-5 text-amber-600 bg-amber-50 rounded-xl px-3 py-2">
              <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
              <p className="text-xs">The tree grower will receive this message as a notification.</p>
            </div>

            <div className="flex gap-3">
              <button onClick={() => { setAlertModal(false); setAlertMessage(""); }} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSendAlert}
                disabled={sendingAlert || !alertMessage.trim()}
                className={`flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold transition-all ${sendingAlert || !alertMessage.trim() ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {sendingAlert ? "Sending…" : "Send Alert"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}