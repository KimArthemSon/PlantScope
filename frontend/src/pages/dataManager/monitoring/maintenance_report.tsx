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
import ReportAreaMap, { computeAreaStats } from "@/components/map/ReportAreaMap";
import ClosureDecisionPanel, { formatClosureDate } from "@/components/monitoring/ClosureDecisionPanel";
import type { ClosureRequest } from "@/components/monitoring/ClosureDecisionPanel";
import { useUserRole } from "@/hooks/authorization";
import { api } from "@/constant/api.ts";

interface ReviewStep {
  status: "pending" | "approved" | "changes_requested" | "not_required";
  notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
}

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

interface SeedlingProvidedEntry {
  seedling_request_id: number;
  application_id: number;
  application_title: string;
  application_status: string;
  group_name: string;
  fulfillment_type: "pickup" | "deliver" | null;
  inspector_name: string | null;
  total_quantity: number;
  species: { species_id: number; species_name: string; quantity: number; provided_by: string }[];
  proof_of_delivery: string | null;
  requested_at: string | null;
  confirmed_at: string | null;
}

interface HistoricalApplication {
  application_id: number;
  group_name: string;
  status: string;
  created_at: string | null;
  group_type?: string | null;
  group_contact?: string | null;
  representative_name?: string | null;
  representative_contact?: string | null;
  title?: string;
  classification?: string;
  participants?: number;
  confirmed_at?: string | null;
  orientation_date?: string | null;
  ended_at?: string | null;
  seedlings_provided?: number;
  reports_submitted?: number;
  reports_accepted?: number;
  trees_planted?: number;
  survival_rate?: number | null;
}

interface SiteVerification {
  status: string;
  verified_by: string | null;
  verified_at: string | null;
  decision_note: string | null;
  accessibility_type: string | null;
  accessibility_description: string | null;
  security_concerns: string[];
  animals: { name: string; scientific_name: string | null; notes: string | null }[];
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
    polygon_coordinates: [number, number][] | null;
    marker_coordinate?: [number, number] | null;
    status?: string;
    created_at?: string | null;
    main_image?: string | null;
    verification?: SiteVerification | null;
    recommended_species?: { species_id: number; species_name: string; priority_rank: number; notes: string | null }[];
    potential_sites_count?: number;
    program_summary?: { total: number; completed: number; failed: number; active: number };
    first_program_at?: string | null;
  };
  metrics: {
    total_planted: number;
    total_added: number;
    total_dead: number;
    total_survived: number;
    survival_rate: number;
    planted_area_hectares: number | null;
    planted_area_percent: number | null;
    planted_area_as_of: string | null;
  };
  total_seedlings_provided: number;
  seedling_requests_breakdown: SeedlingRequestSpeciesItem[];
  seedlings_provided_list?: SeedlingProvidedEntry[];
  current_application: {
    application_id: number;
    group_name: string;
    group_contact: string;
    status: string;
    group?: {
      group_type: string | null;
      address: string | null;
      email: string | null;
      profile_img: string | null;
      member_since: string | null;
    };
    representative?: {
      full_name: string | null;
      gender: string | null;
      contact: string | null;
      address: string | null;
      profile_img: string | null;
      email?: string | null;
      age?: number | null;
    } | null;
    program?: {
      title: string;
      classification: string;
      participants: number;
      applied_at: string | null;
      confirmed_at: string | null;
      orientation_date: string | null;
      has_maintenance_plan: boolean;
      agreement_image: string | null;
      seedlings_provided: number;
      reports_submitted: number;
      reports_accepted: number;
      last_report_at: string | null;
    };
    track_record?: { total_programs: number; completed: number; failed: number; other_sites?: string[] };
  } | null;
  historical_applications: HistoricalApplication[];
  closure_request: ClosureRequest | null;
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
    inspector_name: string;
    polygon_coordinates: [number, number][] | null;
    planted_area_hectares: number | null;
    review_stage: "data_manager" | "gis_specialist" | "done";
    dm_review: ReviewStep;
    gis_review: ReviewStep;
  }>;
}

const REVIEW_LOOK: Record<ReviewStep["status"], { label: string; cls: string }> = {
  pending: { label: "Waiting", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  approved: { label: "Approved", cls: "bg-green-50 text-green-700 border-green-200" },
  changes_requested: { label: "Changes requested", cls: "bg-red-50 text-red-700 border-red-200" },
  not_required: { label: "Not required", cls: "bg-gray-50 text-gray-500 border-gray-200" },
};

function ReviewSteps({ dm, gis, stage }: { dm: ReviewStep; gis: ReviewStep; stage: string }) {
  const steps = [
    { n: 1, label: "Data Manager", step: dm, active: stage === "data_manager" },
    { n: 2, label: "GIS Specialist · Map", step: gis, active: stage === "gis_specialist" },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {steps.map(({ n, label, step, active }) => {
        const look = REVIEW_LOOK[step?.status ?? "pending"];
        return (
          <span key={n} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${look.cls} ${active ? "ring-2 ring-amber-300" : ""}`}>
            <span className="font-bold">{n}.</span> {label}: {active ? "In review" : look.label}
            {step?.reviewed_by && !active && <span className="font-normal opacity-70">· {step.reviewed_by}</span>}
          </span>
        );
      })}
    </div>
  );
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
  cancelled: { label: "Cancelled", bg: "bg-gray-50", text: "text-gray-600", border: "border-gray-200", icon: <XCircle size={13} className="text-gray-400" /> },
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

// Group, representative, program and track record of the current tree grower
function TreeGrowerDetails({
  app,
  onDownloadPlan,
}: {
  app: NonNullable<SiteMonitoringDetail["current_application"]>;
  onDownloadPlan: () => void;
}) {
  const { group, representative: rep, program, track_record: record } = app;
  const avatar = group?.profile_img || rep?.profile_img;
  const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-xs text-gray-800 font-medium mt-0.5 break-words">{value || "—"}</p>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Group */}
      <div className="flex items-start gap-3">
        {avatar ? (
          <img src={avatar} alt={app.group_name} className="w-12 h-12 rounded-xl object-cover border border-emerald-200 bg-white shrink-0" />
        ) : (
          <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white font-bold flex items-center justify-center shrink-0">
            {app.group_name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-gray-900">{app.group_name}</p>
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            {group?.group_type && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white border border-emerald-200 text-emerald-700">{group.group_type}</span>
            )}
            {group?.member_since && <span className="text-[11px] text-gray-500">Registered {formatDate(group.member_since)}</span>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 bg-white rounded-lg border border-emerald-100 p-3">
        <Field label="Group Contact" value={app.group_contact} />
        <Field label="Email" value={group?.email} />
        <div className="col-span-2"><Field label="Group Address" value={group?.address} /></div>
      </div>

      {/* Representative */}
      {rep && (
        <div className="bg-white rounded-lg border border-emerald-100 p-3">
          <p className="text-[11px] font-bold text-emerald-800 mb-2">Group Representative</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name" value={rep.full_name} />
            <Field label="Gender / Age" value={[rep.gender, rep.age != null ? `${rep.age} yrs old` : null].filter(Boolean).join(" · ")} />
            <Field label="Contact" value={rep.contact} />
            <Field label="Email" value={rep.email} />
            <div className="col-span-2"><Field label="Address" value={rep.address} /></div>
          </div>
        </div>
      )}

      {/* Program */}
      {program && (
        <div className="bg-white rounded-lg border border-emerald-100 p-3">
          <p className="text-[11px] font-bold text-emerald-800 mb-2">Program: {program.title}</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Field label="Type" value={program.classification === "new" ? "New application" : "Re-application"} />
            <Field label="Participants" value={`${program.participants} tree growers`} />
            <Field label="Applied" value={formatDate(program.applied_at)} />
            <Field label="Confirmed" value={formatDate(program.confirmed_at)} />
            <Field label="Orientation" value={formatDate(program.orientation_date)} />
            <Field label="Seedlings Provided" value={program.seedlings_provided.toLocaleString()} />
            <Field label="Reports" value={`${program.reports_accepted} accepted / ${program.reports_submitted} submitted`} />
            <Field label="Last Report" value={formatDate(program.last_report_at)} />
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {program.has_maintenance_plan && (
              <button onClick={onDownloadPlan} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs font-semibold hover:bg-emerald-100">
                <Download size={12} /> Maintenance Plan
              </button>
            )}
            {program.agreement_image && (
              <a href={program.agreement_image} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs font-semibold hover:bg-emerald-100">
                <FileText size={12} /> Signed Agreement
              </a>
            )}
          </div>
        </div>
      )}

      {/* Track record */}
      {record && (
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="font-semibold text-gray-600">Track record:</span>
          <span className="px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-700">{record.total_programs} program{record.total_programs === 1 ? "" : "s"}</span>
          <span className="px-2 py-0.5 rounded-full bg-green-50 border border-green-200 text-green-700">{record.completed} completed</span>
          <span className="px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-700">{record.failed} failed</span>
          {record.other_sites && record.other_sites.length > 0 && (
            <span className="text-gray-500 w-full sm:w-auto">
              Also worked on: <span className="font-medium text-gray-700">{record.other_sites.join(", ")}</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────

export default function SiteMonitoringDetails() {
  const { site_id } = useParams<{ site_id: string }>();
  const navigate = useNavigate();
  // Same page for the Data Manager and the City ENRO Head; the Head makes final closure decisions
  const { userRole } = useUserRole();
  const isHead = userRole === "CityENROHead";
  const token = localStorage.getItem("token");

  const [detail, setDetail] = useState<SiteMonitoringDetail | null>(null);
  const [loading, setLoading] = useState(true);
  // Date range filter (YYYY-MM-DD). Empty = all time.
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filtering, setFiltering] = useState(false);
  const isFiltered = !!(dateFrom || dateTo);

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

    if (dateFrom && dateTo && dateFrom > dateTo) {
      setPSAlert({ type: "failed", title: "Invalid range", message: "The start date must be before the end date." });
      return;
    }

    // Full-page spinner only on first load; filter changes keep the page visible
    if (detail) setFiltering(true);
    else setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.append("date_from", dateFrom);
      if (dateTo) params.append("date_to", dateTo);
      const url = `${API_BASE}api/get_site_monitoring_details/${site_id}/${params.toString() ? `?${params}` : ""}`;
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
      setFiltering(false);
    }
  };

  useEffect(() => {
    fetchSiteDetails();
  }, [site_id, dateFrom, dateTo]);

  const applyPreset = (preset: "all" | "30d" | "90d" | "year") => {
    const iso = (d: Date) => d.toLocaleDateString("en-CA"); // YYYY-MM-DD in local time
    const today = new Date();
    if (preset === "all") {
      setDateFrom("");
      setDateTo("");
    } else if (preset === "year") {
      setDateFrom(`${today.getFullYear()}-01-01`);
      setDateTo(iso(today));
    } else {
      const start = new Date(today);
      start.setDate(start.getDate() - (preset === "30d" ? 30 : 90));
      setDateFrom(iso(start));
      setDateTo(iso(today));
    }
  };

  const downloadMaintenancePlan = async (applicationId: number) => {
    try {
      const res = await fetch(`${API_BASE}api/application/${applicationId}/download-maintenance-plan/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Download failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      // Plans can be PDF or Word; name the file after the type the server sent
      const ext = blob.type.includes("wordprocessingml") ? "docx" : blob.type === "application/msword" ? "doc" : "pdf";
      link.download = `maintenance_plan_${applicationId}.${ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setPSAlert({ type: "error", title: "Download Failed", message: err.message });
    }
  };

  // Step 1 of 2: Data Manager approves (→ GIS Specialist) or requests changes (→ inspector)
  const handleUpdateProgressReport = async (reportId: number, status: "accepted" | "rejected", reason: string) => {
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}api/review_progress_report/${reportId}/`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: status === "accepted" ? "approve" : "request_changes", notes: reason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Action failed");
      setPSAlert({ type: "success", title: status === "accepted" ? "Report Approved" : "Changes Requested", message: data.message ?? `Report has been ${status}.` });
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
      const appId = detail.current_application.application_id;
      // Data Manager recommends; the City ENRO Head decides. The Head can also decide directly.
      const res = isHead
        ? await fetch(`${API_BASE}api/complete_application/${appId}/`, {
            method: "PUT",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ status: completionModal.type, reason: completionModal.reason.trim() }),
          })
        : await fetch(`${API_BASE}api/request_program_closure/${appId}/`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ recommendation: completionModal.type, reason: completionModal.reason.trim() }),
          });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Action failed");

      setPSAlert({
        type: "success",
        title: isHead ? (completionModal.type === "completed" ? "Program Completed" : "Program Marked Failed") : "Recommendation Sent",
        message: data.message,
      });

      setCompletionModal({ open: false, type: null, reason: "" });
      fetchSiteDetails(); // Refresh to show the new "failed" or "completed" site status
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
    const allReports = detail?.progress_reports || [];
    const acceptedReports = allReports.filter((r) => r.status === "accepted");
    
    // Only consider non-rejected initial reports (pending or accepted) for baseline
    const initialReports = allReports.filter((r) => r.visit_type === "initial" && r.status !== "rejected");
    const oldestInitialReport = initialReports.length > 0 
      ? initialReports.sort((a, b) => new Date(a.submitted_at || 0).getTime() - new Date(b.submitted_at || 0).getTime())[0] 
      : null;

    const ongoingReports = acceptedReports.filter((r) => r.visit_type !== "initial");

    const allSpeciesIds = new Set<number>();
    const speciesNameMap = new Map<number, string>();
    allReports.forEach((report) => report.species.forEach((sp) => { 
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

      // FIX: Only include species if they have meaningful data (not all zeros)
      if (officially_planted > 0 || total_added > 0 || total_dead > 0 || calculated_survived > 0) {
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
    }
    return breakdown;
  };

  const speciesBreakdown = calculateSpeciesBreakdown();
  // Only reports at the Data Manager step need action here; the rest wait on the GIS Specialist
  const pendingReports = detail?.progress_reports.filter((r) => r.status === "pending" && r.review_stage === "data_manager") || [];
  const firstPendingReport = pendingReports[0];
  const awaitingGisReport = detail?.progress_reports.find((r) => r.status === "pending" && r.review_stage === "gis_specialist");
  // Any report still in review (Data Manager or GIS Specialist step) blocks recommending completion
  const hasReportInReview = detail?.progress_reports.some((r) => r.status === "pending") ?? false;
  const appStatus = detail?.current_application?.status || "";
  const isNeedsOrientation = appStatus === "accepted";

  // Check for accepted initial report
  const hasAcceptedInitialReport = detail?.progress_reports.some(
    (r) => r.visit_type === "initial" && r.status === "accepted"
  );

  // Check for rejected initial report to allow early failure
  const hasRejectedInitialReport = detail?.progress_reports.some(
    (r) => r.visit_type === "initial" && r.status === "rejected"
  );

  // Find the baseline report ID (oldest non-rejected initial report)
  const baselineReportId = useMemo(() => {
    if (!detail) return null;
    const initialReports = detail.progress_reports
      .filter((r) => r.visit_type === "initial" && r.status !== "rejected")
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
  const seedlingsProvidedList = detail.seedlings_provided_list ?? [];
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

      {/*  Header */}
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

              {/* Photo + description */}
              {(site.main_image || site.description) && (
                <div className="flex flex-col sm:flex-row gap-4 mb-5">
                  {site.main_image && (
                    <a href={site.main_image} target="_blank" rel="noopener noreferrer" className="shrink-0">
                      <img src={site.main_image} alt={site.name} className="w-full sm:w-56 h-36 object-cover rounded-xl border border-gray-200" />
                    </a>
                  )}
                  {site.description && (
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Description</p>
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{site.description}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 mb-5">
                <div className="flex flex-col gap-0.5 py-2 border-b border-gray-100">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Location</span>
                  <span className="text-sm text-gray-800 font-medium">
                    {[site.barangay_name && `Brgy. ${site.barangay_name}`, site.reforestation_area_name].filter(Boolean).join(" · ") || "—"}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5 py-2 border-b border-gray-100">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Center Coordinate</span>
                  {site.marker_coordinate ? (
                    <span className="text-sm text-gray-800 font-medium font-mono">
                      {Number(site.marker_coordinate[0]).toFixed(6)}, {Number(site.marker_coordinate[1]).toFixed(6)}{" "}
                      <a
                        href={`https://www.google.com/maps?q=${site.marker_coordinate[0]},${site.marker_coordinate[1]}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-sans text-xs font-semibold text-[#0F4A2F] hover:underline"
                      >
                        Open in Google Maps
                      </a>
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">Not set</span>
                  )}
                </div>
                <div className="flex flex-col gap-0.5 py-2 border-b border-gray-100">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Total Area</span>
                  <span className="text-sm text-gray-800 font-medium">
                    {site.total_area_hectares.toFixed(2)} hectares
                    <span className="text-gray-500"> · {Math.round(site.total_area_hectares * 10000).toLocaleString()} m²</span>
                  </span>
                </div>
                <div className="flex flex-col gap-0.5 py-2 border-b border-gray-100">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Planted Area (confirmed)</span>
                  <span className="text-sm text-gray-800 font-medium">
                    {metrics.planted_area_hectares != null ? (
                      <>
                        {metrics.planted_area_hectares.toFixed(4)} ha
                        {metrics.planted_area_percent != null && <span className="text-gray-500"> · {metrics.planted_area_percent}% of site</span>}
                        <span className="block text-xs text-gray-400 font-normal">From the latest accepted report ({formatDate(metrics.planted_area_as_of)})</span>
                      </>
                    ) : (
                      <span className="text-gray-400">No accepted planted-area map yet</span>
                    )}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5 py-2 border-b border-gray-100">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Land Classification</span>
                  <span className="text-sm text-gray-800 font-medium">{site.land_classification_name || "Not classified"}</span>
                </div>
                <div className="flex flex-col gap-0.5 py-2 border-b border-gray-100">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1"><Car size={12} /> Accessibility</span>
                  <span className="text-sm text-gray-800 font-medium">
                    {site.verification?.accessibility_type
                      ? site.verification.accessibility_type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
                      : getAccessibilityText(site.accessibility)}
                    {site.verification?.accessibility_description && (
                      <span className="block text-xs text-gray-500 font-normal">{site.verification.accessibility_description}</span>
                    )}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5 py-2 border-b border-gray-100">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Site Added</span>
                  <span className="text-sm text-gray-800 font-medium">
                    {formatDate(site.created_at ?? null)}
                    {site.status && <span className="text-gray-500 capitalize"> · {site.status.replace(/_/g, " ")}</span>}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5 py-2 border-b border-gray-100">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Program History</span>
                  <span className="text-sm text-gray-800 font-medium">
                    {site.program_summary ? (
                      <>
                        {site.program_summary.total} program{site.program_summary.total === 1 ? "" : "s"}
                        <span className="text-gray-500">
                          {" "}· {site.program_summary.completed} completed · {site.program_summary.failed} failed
                          {site.program_summary.active > 0 && ` · ${site.program_summary.active} active`}
                        </span>
                        {site.first_program_at && <span className="block text-xs text-gray-400 font-normal">First program confirmed {formatDate(site.first_program_at)}</span>}
                      </>
                    ) : "—"}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5 py-2 border-b border-gray-100">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1"><Layers size={12} /> Potential Planting Zones</span>
                  <span className="text-sm text-gray-800 font-medium">
                    {site.potential_sites_count ? `${site.potential_sites_count} zone${site.potential_sites_count === 1 ? "" : "s"} from NDVI analysis` : "None analysed"}
                  </span>
                </div>
              </div>

              {/* Recommended species */}
              {site.recommended_species && site.recommended_species.length > 0 && (
                <div className="mb-5">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Recommended Species</p>
                  <div className="flex flex-wrap gap-2">
                    {site.recommended_species.map((sp) => (
                      <span
                        key={sp.species_id}
                        title={sp.notes ?? undefined}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-medium"
                      >
                        <span className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[9px] font-bold flex items-center justify-center">{sp.priority_rank}</span>
                        {sp.species_name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Field verification: safety, wildlife, who verified */}
              {site.verification && (
                <div className="mb-6 p-4 rounded-xl border border-gray-200 bg-gray-50">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <p className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
                      <ShieldCheck size={14} className="text-[#0F4A2F]" /> Field Verification
                    </p>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border capitalize ${
                      site.verification.status === "verified"
                        ? "bg-green-50 text-green-700 border-green-200"
                        : site.verification.status === "rejected"
                          ? "bg-red-50 text-red-700 border-red-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                    }`}>
                      {site.verification.status.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Security Concerns</p>
                      {site.verification.security_concerns.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {site.verification.security_concerns.map((c, i) => (
                            <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-[11px] text-red-700 font-medium capitalize">
                              <AlertTriangle size={11} /> {c.replace(/_/g, " ")}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-green-700 font-medium flex items-center gap-1"><ShieldCheck size={12} /> None reported</p>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Wildlife Observed</p>
                      {site.verification.animals.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {site.verification.animals.map((a, i) => (
                            <span
                              key={i}
                              title={[a.scientific_name, a.notes].filter(Boolean).join(" — ") || undefined}
                              className="px-2 py-0.5 rounded-full bg-white border border-gray-200 text-[11px] text-gray-700 font-medium"
                            >
                              {a.name}
                              {a.scientific_name && <span className="italic text-gray-400"> ({a.scientific_name})</span>}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500">None recorded</p>
                      )}
                    </div>
                  </div>
                  {(site.verification.verified_by || site.verification.decision_note) && (
                    <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-600">
                      {site.verification.verified_by && (
                        <p>
                          Verified by <span className="font-semibold text-gray-800">{site.verification.verified_by}</span>
                          {site.verification.verified_at && <> on {formatDate(site.verification.verified_at)}</>}
                        </p>
                      )}
                      {site.verification.decision_note && <p className="mt-1 italic">“{site.verification.decision_note}”</p>}
                    </div>
                  )}
                </div>
              )}

              {/* Current vs Historical Tree Growers */}
              <div className="pt-6 border-t border-gray-100">
                {current_application ? (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Users size={16} className="text-emerald-700" />
                      <h3 className="text-sm font-bold text-emerald-800">Current Tree Grower (Active Program)</h3>
                    </div>

                    <TreeGrowerDetails
                      app={current_application}
                      onDownloadPlan={() => downloadMaintenancePlan(current_application.application_id)}
                    />

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
                    <div className="mt-3 space-y-3 pl-4 border-l-2 border-gray-200">
                      {historical_applications.map((app) => (
                        <div key={app.application_id} className="p-3 rounded-xl border border-gray-200 bg-gray-50">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-gray-800">
                                {app.group_name}
                                {app.group_type && <span className="ml-2 text-[10px] font-semibold text-gray-500 uppercase">{app.group_type}</span>}
                              </p>
                              {app.title && <p className="text-xs text-gray-600 mt-0.5">{app.title}</p>}
                            </div>
                            <StatusBadge status={app.status} />
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-2 mt-3 text-xs">
                            <div>
                              <p className="text-[10px] font-semibold text-gray-400 uppercase">Period</p>
                              <p className="text-gray-700 font-medium">
                                {formatDate(app.confirmed_at ?? app.created_at)} – {app.ended_at ? formatDate(app.ended_at) : "—"}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] font-semibold text-gray-400 uppercase">Participants</p>
                              <p className="text-gray-700 font-medium">{app.participants ?? "—"}{app.classification && <span className="text-gray-400"> · {app.classification === "new" ? "New" : "Returning"}</span>}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-semibold text-gray-400 uppercase">Seedlings / Planted</p>
                              <p className="text-gray-700 font-medium">
                                {(app.seedlings_provided ?? 0).toLocaleString()} / {(app.trees_planted ?? 0).toLocaleString()}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] font-semibold text-gray-400 uppercase">Survival · Reports</p>
                              <p className="text-gray-700 font-medium">
                                {app.survival_rate != null ? `${app.survival_rate}%` : "—"}
                                <span className="text-gray-400"> · {app.reports_accepted ?? 0}/{app.reports_submitted ?? 0}</span>
                              </p>
                            </div>
                          </div>
                          {(app.representative_name || app.group_contact) && (
                            <p className="text-[11px] text-gray-500 mt-2">
                              {app.representative_name && <>Representative: <span className="font-medium text-gray-700">{app.representative_name}</span></>}
                              {(app.representative_contact || app.group_contact) && <> · {app.representative_contact || app.group_contact}</>}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            </div>

            {/* Lifetime Metrics */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-sm font-bold text-[#0F4A2F] flex items-center gap-2">
                    <TrendingUp size={16} /> {isFiltered ? "Site Metrics (Filtered)" : "Lifetime Site Metrics"}
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {isFiltered
                      ? `${dateFrom ? formatDate(dateFrom) : "Start"} – ${dateTo ? formatDate(dateTo) : "Today"} · reports, seedlings and counts in this period`
                      : "All reports and seedlings since the site started"}
                  </p>
                </div>
                {filtering && <span className="text-xs text-gray-400 flex items-center gap-1.5"><span className="w-3 h-3 border-2 border-[#0F4A2F] border-t-transparent rounded-full animate-spin" /> Updating…</span>}
              </div>

              {/* Date filter */}
              <div className="flex flex-wrap items-end gap-3 p-3 mb-4 bg-gray-50 rounded-xl border border-gray-100">
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">From</label>
                  <input type="date" value={dateFrom} max={dateTo || undefined} onChange={(e) => setDateFrom(e.target.value)} className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:border-[#0F4A2F]" />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">To</label>
                  <input type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => setDateTo(e.target.value)} className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:border-[#0F4A2F]" />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {([
                    ["all", "All time"],
                    ["30d", "Last 30 days"],
                    ["90d", "Last 90 days"],
                    ["year", "This year"],
                  ] as const).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => applyPreset(key)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                        key === "all" && !isFiltered ? "bg-[#0F4A2F] text-white border-[#0F4A2F]" : "bg-white text-gray-600 border-gray-200 hover:border-[#0F4A2F]"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 text-center">
                  <Package size={20} className="text-emerald-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-emerald-800">{total_seedlings_provided.toLocaleString()}</p>
                  <p className="text-xs text-emerald-600 font-medium">Total Seedlings Provided</p>
                </div>
                <div className="p-4 bg-teal-50 rounded-xl border border-teal-100 text-center">
                  <MapPin size={20} className="text-teal-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-teal-800">
                    {metrics.planted_area_hectares != null ? metrics.planted_area_hectares.toFixed(2) : "—"}
                    <span className="text-sm font-semibold"> ha</span>
                  </p>
                  <p className="text-xs text-teal-600 font-medium">Total Area Planted</p>
                  <p className="text-[10px] text-teal-500 mt-0.5">
                    {metrics.planted_area_hectares != null
                      ? `${metrics.planted_area_percent != null ? `${metrics.planted_area_percent}% of site · ` : ""}as of ${formatDate(metrics.planted_area_as_of)}`
                      : "No confirmed map yet"}
                  </p>
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

            {/* Seedling Request Breakdown */}
            {seedling_requests_breakdown.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <SectionHeader icon={<Package size={16} />} title="Seedling Request Breakdown" subtitle="Total confirmed seedlings provided by ENRO across all applications" />
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

            {/* Seedlings Provided — each confirmed request and the tree grower who received it */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <SectionHeader
                icon={<Sprout size={16} />}
                title={`Seedlings Provided (${seedlingsProvidedList.length})`}
                subtitle="Confirmed seedling handovers to this site, with the tree grower who received them"
              />
              {seedlingsProvidedList.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">
                  No confirmed seedling handovers {isFiltered ? "in this period" : "for this site yet"}.
                </p>
              ) : (
                <div className="space-y-3">
                  {seedlingsProvidedList.map((sr) => (
                    <div key={sr.seedling_request_id} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Users size={14} className="text-[#0F4A2F] shrink-0" />
                            <span className="font-bold text-gray-800 truncate">{sr.group_name}</span>
                            <StatusBadge status={sr.application_status} />
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            Request #{sr.seedling_request_id} · {sr.application_title}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            Requested {formatDate(sr.requested_at)} · Confirmed {formatDate(sr.confirmed_at)}
                            {sr.fulfillment_type && ` · ${sr.fulfillment_type === "deliver" ? "Delivered to site" : "Grower pickup"}`}
                            {sr.inspector_name && ` · Verified by ${sr.inspector_name}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          {sr.proof_of_delivery && (
                            <a href={sr.proof_of_delivery} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-[#0F4A2F] hover:underline">
                              View proof
                            </a>
                          )}
                          <div className="text-right">
                            <span className="text-xl font-bold text-emerald-700">{sr.total_quantity.toLocaleString()}</span>
                            <span className="block text-[10px] text-gray-500 font-medium uppercase">seedlings</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {sr.species.map((sp) => (
                          <span
                            key={sp.species_id}
                            title={`Provided by ${sp.provided_by}`}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-emerald-100 rounded-full text-xs text-gray-700"
                          >
                            <Leaf size={12} className="text-emerald-600" />
                            {sp.species_name}
                            <span className="font-bold text-emerald-700">×{sp.quantity.toLocaleString()}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

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
              <SectionHeader icon={<FileText size={16} />} title="Progress Reports" subtitle={isFiltered ? `${progress_reports.length} reports in the selected dates` : `${progress_reports.length} total reports submitted`} />

              {progress_reports.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">
                  {isFiltered ? "No progress reports in the selected dates." : "No progress reports submitted yet."}
                </p>
              ) : (
                <div className="space-y-4">
                  {progress_reports.map((report) => {
                    const isPending = report.status === "pending";
                    const isMyStep = isPending && report.review_stage === "data_manager" && !isHead;
                    const isInitial = report.visit_type === "initial";
                    const isBaseline = isInitial && report.report_id === baselineReportId;
                    const hasPolygon = (report.polygon_coordinates?.length ?? 0) >= 3;
                    const areaStats = hasPolygon ? computeAreaStats(report.polygon_coordinates, site.polygon_coordinates) : null;

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

                        {report.dm_review && (
                          <div className="mb-4">
                            <ReviewSteps dm={report.dm_review} gis={report.gis_review} stage={report.review_stage} />
                          </div>
                        )}

                        {hasPolygon && (
                          <div className="mb-4">
                            <ReportAreaMap
                              reportPolygon={report.polygon_coordinates}
                              sitePolygon={site.polygon_coordinates}
                              areaHectares={report.planted_area_hectares}
                              height={isPending ? 320 : 220}
                            />
                            <div className="grid grid-cols-3 gap-2 mt-2 text-center">
                              <div className="bg-white rounded-lg p-2 border border-gray-100">
                                <p className="text-sm font-bold text-[#0F4A2F]">{report.planted_area_hectares?.toFixed(4) ?? "—"} ha</p>
                                <p className="text-[10px] text-gray-500 uppercase">Planted Area</p>
                              </div>
                              <div className="bg-white rounded-lg p-2 border border-gray-100">
                                <p className="text-sm font-bold text-gray-700">
                                  {site.total_area_hectares && report.planted_area_hectares != null ? `${((report.planted_area_hectares / site.total_area_hectares) * 100).toFixed(1)}%` : "—"}
                                </p>
                                <p className="text-[10px] text-gray-500 uppercase">Of Site Area</p>
                              </div>
                              <div className="bg-white rounded-lg p-2 border border-gray-100">
                                <p className={`text-sm font-bold ${areaStats?.outsidePercent && areaStats.outsidePercent > 5 ? "text-red-600" : "text-gray-700"}`}>
                                  {areaStats?.outsidePercent != null ? `${areaStats.outsidePercent.toFixed(1)}%` : "—"}
                                </p>
                                <p className="text-[10px] text-gray-500 uppercase">Outside Boundary</p>
                              </div>
                            </div>
                          </div>
                        )}

                        {[
                          { by: "Data Manager", step: report.dm_review },
                          { by: "GIS Specialist", step: report.gis_review },
                        ]
                          .filter((r) => r.step?.status === "changes_requested")
                          .map((r) => (
                            <div key={r.by} className="bg-red-50 p-3 rounded-lg border border-red-200 mb-3">
                              <p className="text-xs font-bold text-red-600 uppercase tracking-wide mb-1">
                                Changes requested by {r.by}{r.step.reviewed_by ? ` (${r.step.reviewed_by})` : ""}
                              </p>
                              <p className="text-sm text-gray-700">{r.step.notes}</p>
                            </div>
                          ))}

                        {/* 2-Column Grid based on Baseline vs Others */}
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

                        {isPending && report.review_stage === "gis_specialist" && (
                          <div className="mt-4 pt-4 border-t border-amber-200 text-xs text-amber-700 flex items-center gap-2">
                            <Clock size={14} /> Approved by you. Waiting for the GIS Specialist to confirm the planted-area map.
                          </div>
                        )}

                        {isMyStep && (
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

          {/*  Right: Actions Panel ── */}
          <div className="w-full lg:w-80 flex-shrink-0">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm sticky top-6">
              <div className="p-5 border-b border-gray-100">
                <h3 className="font-bold text-gray-900">Site Actions</h3>
                <p className="text-xs text-gray-400 mt-1">Manage monitoring & status</p>
              </div>

              {isFiltered ? (
                <div className="p-5">
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-center">
                    <Calendar size={22} className="text-gray-500 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-gray-700">Date filter is on</p>
                    <p className="text-xs text-gray-500 mt-1">Approvals and status changes use all reports, so they're hidden while you view a date range.</p>
                    <button onClick={() => applyPreset("all")} className="mt-3 w-full py-2 rounded-lg bg-[#0F4A2F] text-white text-xs font-bold hover:bg-[#1a6b44] transition-colors">
                      Clear Filter
                    </button>
                  </div>
                </div>
              ) : (
              <div className="p-5 space-y-4">
                {!firstPendingReport && awaitingGisReport ? (
                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-200 text-center">
                    <Clock size={24} className="text-blue-600 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-blue-800">Waiting for GIS Specialist</p>
                    <p className="text-xs text-blue-600 mt-1">
                      You approved the report from <strong>{awaitingGisReport.group_name}</strong>. It will be accepted once the GIS Specialist confirms the planted-area map
                      ({awaitingGisReport.planted_area_hectares?.toFixed(2) ?? "—"} ha).
                    </p>
                  </div>
                ) : !firstPendingReport ? (
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
                      {isHead ? (
                        <>A report from <strong>{firstPendingReport.group_name}</strong> is waiting for the Data Manager's review.</>
                      ) : (
                        <>A report submitted by <strong>{firstPendingReport.group_name}</strong> is pending your review (step 1 of 2). After you approve, the GIS Specialist confirms the planted-area map.</>
                      )}
                    </p>
                    {!isHead && <div className="space-y-2">
                      <button onClick={() => handleUpdateProgressReport(firstPendingReport.report_id, "accepted", "Report approved")} disabled={submitting} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#0F4A2F] text-white text-sm font-bold hover:bg-[#1a6b44] transition-colors disabled:opacity-50">
                        <CheckCircle2 size={16} /> {submitting ? "Processing..." : "Approve Report"}
                      </button>
                      <button onClick={() => setRejectReportModal({ open: true, reportId: firstPendingReport.report_id, reason: "" })} disabled={submitting} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white border border-red-200 text-red-600 text-sm font-bold hover:bg-red-50 transition-colors disabled:opacity-50">
                        <XCircle size={16} /> Request Changes
                      </button>
                    </div>}
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

                  {/* Program closure: Data Manager recommends → City ENRO Head decides */}
                  {site.monitoring_status === "under_monitoring" && current_application && (() => {
                    const closure = detail.closure_request;
                    const pendingClosure = closure?.status === "pending" ? closure : null;
                    const returnedClosure = closure?.status === "returned" ? closure : null;

                    if (pendingClosure) {
                      return isHead ? (
                        <ClosureDecisionPanel
                          closure={pendingClosure}
                          onDone={(message) => { setPSAlert({ type: "success", title: "Decision Saved", message }); fetchSiteDetails(); }}
                          onError={(message) => setPSAlert({ type: "failed", title: "Failed", message })}
                        />
                      ) : (
                        <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
                          <p className="text-xs font-bold text-indigo-800 flex items-center gap-1.5"><Clock size={14} /> Waiting for City ENRO Head</p>
                          <p className="text-xs text-indigo-700 mt-1">
                            You recommended <strong className="uppercase">{pendingClosure.recommendation}</strong> on {formatClosureDate(pendingClosure.requested_at)}. The Head makes the final decision.
                          </p>
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-2">
                        {returnedClosure && !isHead && (
                          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                            <p className="text-xs font-bold text-amber-800">Returned by {returnedClosure.decided_by ?? "the City ENRO Head"}</p>
                            <p className="text-xs text-gray-700 mt-1">“{returnedClosure.head_notes}”</p>
                          </div>
                        )}
                        {!isHead && (
                          <p className="text-[11px] text-gray-500">Recommend an outcome. The City ENRO Head makes the final decision.</p>
                        )}
                        {/* Only offer Completed once there's an accepted initial report.
                            The Data Manager must also wait until no report is still in review (DM or GIS step). */}
                        {hasAcceptedInitialReport && (() => {
                          const blocked = !isHead && hasReportInReview;
                          return (
                            <>
                              <button
                                onClick={() => setCompletionModal({ open: true, type: "completed", reason: "" })}
                                disabled={blocked}
                                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-600 text-white text-sm font-bold hover:bg-green-700 transition-colors disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed"
                              >
                                <CheckCircle2 size={16} /> {isHead ? "Mark Program Completed" : "Recommend Completion"}
                              </button>
                              {blocked && (
                                <p className="text-[11px] text-amber-700 flex items-start gap-1.5">
                                  <Clock size={12} className="mt-0.5 shrink-0" />
                                  {awaitingGisReport && !firstPendingReport
                                    ? "A report is waiting for the GIS Specialist's map check. You can recommend completion once it's reviewed."
                                    : "Review the pending progress report first. You can recommend completion once every report is reviewed."}
                                </p>
                              )}
                            </>
                          );
                        })()}
                        {/* Failure can follow an accepted OR rejected initial report */}
                        {(hasAcceptedInitialReport || hasRejectedInitialReport) && (
                          <button onClick={() => setCompletionModal({ open: true, type: "failed", reason: "" })} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 transition-colors">
                            <XCircle size={16} /> {isHead ? "Mark Program Failed" : "Recommend Failure"}
                          </button>
                        )}
                      </div>
                    );
                  })()}

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
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Modals */}
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
            <h3 className="text-lg font-bold text-center text-gray-800 mb-1">
              {isHead
                ? completionModal.type === "completed" ? "Mark as Completed?" : "Mark as Failed?"
                : completionModal.type === "completed" ? "Recommend Completion?" : "Recommend Failure?"}
            </h3>
            <p className="text-sm text-center text-gray-500 mb-5">
              "{current_application?.group_name}"
              {!isHead && <span className="block text-xs mt-1">This goes to the City ENRO Head for the final decision. Nothing changes until they approve.</span>}
            </p>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{isHead ? "Reason *" : "Reason for the Head *"}</label>
            <textarea rows={4} value={completionModal.reason} onChange={(e) => setCompletionModal((p) => ({ ...p, reason: e.target.value }))} placeholder={completionModal.type === "completed" ? "e.g. All objectives met" : "e.g. Insufficient survival rate"} className="w-full border border-gray-200 rounded-xl p-3 text-sm text-gray-700 resize-none focus:outline-none focus:border-[#0F4A2F] focus:ring-1 focus:ring-[#0F4A2F] mb-5 transition-colors" />
            <div className="flex gap-3">
              <button onClick={() => setCompletionModal({ open: false, type: null, reason: "" })} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleCompleteApplication} disabled={submitting || !completionModal.reason.trim()} className={`flex-1 py-2.5 rounded-xl text-white text-sm font-bold transition-all ${completionModal.type === "completed" ? "bg-green-600 hover:bg-green-700" : "bg-red-500 hover:bg-red-600"} ${submitting || !completionModal.reason.trim() ? "opacity-50 cursor-not-allowed" : ""}`}>
                {submitting ? "Processing…" : isHead ? "Confirm" : "Send to Head"}
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
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">What needs to change? *</label>
            <textarea rows={4} value={rejectReportModal.reason} onChange={(e) => setRejectReportModal((p) => ({ ...p, reason: e.target.value }))} placeholder="e.g. Proof image is blurry, or the planted-area outline misses the north side." className="w-full border border-gray-200 rounded-xl p-3 text-sm text-gray-700 resize-none focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 mb-5 transition-colors" />
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