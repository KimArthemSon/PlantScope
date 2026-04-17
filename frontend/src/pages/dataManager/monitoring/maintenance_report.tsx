import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
  Search,
  Filter,
  Eye,
  FileText,
  Trees,
  Users,
  Calendar,
  Layers,
  AlertTriangle,
  BellRing,
  ArrowLeft,
  Download,
  Leaf,
} from "lucide-react";
import PlantScopeAlert from "../../../components/alert/PlantScopeAlert";

// ─── Types ──────────────────────────────────────────────────────────────────

type ReportStatus = "for_evaluation" | "for_head" | "accepted" | "rejected";

interface MaintenanceReport {
  maintenance_report_id: number;
  application_id: number;
  application_title: string;
  organization_name: string;
  title: string;
  description: string;
  status: ReportStatus;
  total_seedling_planted: number;
  total_seedling_survived: number;
  total_area_planted: string;
  total_owned_seedling_planted: number;
  total_member_present: number | null;
  project_duration: number;
  maintenance_report_file: string | null;
  group_picture: string | null;
  created_at: string;
  submitted_at: string | null;
}

interface AlertPayload {
  application_id: number;
  message: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ReportStatus, { label: string; bg: string; text: string; border: string; icon: React.ReactNode }> = {
  for_evaluation: {
    label: "For Evaluation",
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    icon: <Clock size={13} className="text-amber-500" />,
  },
  for_head: {
    label: "For Head Review",
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    icon: <ChevronRight size={13} className="text-blue-500" />,
  },
  accepted: {
    label: "Accepted",
    bg: "bg-green-50",
    text: "text-green-700",
    border: "border-green-200",
    icon: <CheckCircle2 size={13} className="text-green-500" />,
  },
  rejected: {
    label: "Rejected",
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200",
    icon: <XCircle size={13} className="text-red-500" />,
  },
};

const StatusBadge = ({ status }: { status: ReportStatus }) => {
  const conf = STATUS_CONFIG[status] ?? {
    label: status,
    bg: "bg-gray-50",
    text: "text-gray-600",
    border: "border-gray-200",
    icon: null,
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${conf.bg} ${conf.text} ${conf.border}`}>
      {conf.icon}
      {conf.label}
    </span>
  );
};

const MetricChip = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) => (
  <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-3 py-2">
    <span className="text-gray-400">{icon}</span>
    <span className="text-xs text-gray-500">{label}:</span>
    <span className="text-xs font-bold text-gray-800">{value}</span>
  </div>
);

// ─── Main Component ──────────────────────────────────────────────────────────

export default function Maintenance_report() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const [reports, setReports] = useState<MaintenanceReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<ReportStatus | "all">("all");

  // Selected report for detail panel
  const [selected, setSelected] = useState<MaintenanceReport | null>(null);

  // Evaluation modal
  const [evalModal, setEvalModal] = useState<{
    open: boolean;
    action: "accept" | "reject" | "forward" | null;
  }>({ open: false, action: null });
  const [evalReason, setEvalReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Alert tree grower modal
  const [alertModal, setAlertModal] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [alertTarget, setAlertTarget] = useState<{ application_id: number; org_name: string } | null>(null);
  const [sendingAlert, setSendingAlert] = useState(false);

  const [PSalert, setPSAlert] = useState<{
    type: "success" | "failed" | "error";
    title: string;
    message: string;
  } | null>(null);

  // ─── Fetch reports ─────────────────────────────────────────────────────────
  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/get_all_maintenance_reports/", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load reports");
      const data = await res.json();
      setReports(Array.isArray(data) ? data : data.reports ?? []);
    } catch (err: any) {
      setPSAlert({ type: "error", title: "Error", message: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReports(); }, []);

  // ─── Evaluate ──────────────────────────────────────────────────────────────
  const handleEvaluate = async () => {
    if (!selected || !evalModal.action) return;
    const statusMap = { accept: "accepted", reject: "rejected", forward: "for_head" };
    const status = statusMap[evalModal.action];

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("status", status);
      fd.append("reason", evalReason);

      const res = await fetch(
        `http://127.0.0.1:8000/api/evaluate_miantenance_report/${selected.maintenance_report_id}/`,
        { method: "PUT", headers: { Authorization: `Bearer ${token}` }, body: fd }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Evaluation failed");

      setPSAlert({ type: "success", title: "Done!", message: data.message ?? "Report evaluated." });
      setEvalModal({ open: false, action: null });
      setEvalReason("");
      setSelected(null);
      fetchReports();
    } catch (err: any) {
      setPSAlert({ type: "failed", title: "Failed", message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Send alert to tree grower ──────────────────────────────────────────────
  const handleSendAlert = async () => {
    if (!alertTarget || !alertMessage.trim()) {
      setPSAlert({ type: "failed", title: "Missing", message: "Please enter a message." });
      return;
    }
    setSendingAlert(true);
    try {
      const fd = new FormData();
      fd.append("application_id", String(alertTarget.application_id));
      fd.append("message", alertMessage);

      const res = await fetch("http://127.0.0.1:8000/api/alert_tree_grower/", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to send alert");

      setPSAlert({ type: "success", title: "Alert Sent!", message: `Tree grower has been notified.` });
      setAlertModal(false);
      setAlertMessage("");
      setAlertTarget(null);
    } catch (err: any) {
      setPSAlert({ type: "failed", title: "Failed", message: err.message });
    } finally {
      setSendingAlert(false);
    }
  };

  // ─── Filter ────────────────────────────────────────────────────────────────
  const filtered = reports.filter((r) => {
    const matchStatus = filterStatus === "all" || r.status === filterStatus;
    const q = search.toLowerCase();
    const matchSearch =
      r.title.toLowerCase().includes(q) ||
      r.application_title?.toLowerCase().includes(q) ||
      r.organization_name?.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const statusCounts = {
    all: reports.length,
    for_evaluation: reports.filter((r) => r.status === "for_evaluation").length,
    for_head: reports.filter((r) => r.status === "for_head").length,
    accepted: reports.filter((r) => r.status === "accepted").length,
    rejected: reports.filter((r) => r.status === "rejected").length,
  };

  const formatDate = (iso: string) =>
    iso ? new Date(iso).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) : "—";

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

      {/* ── Header ── */}
      <header className="bg-gradient-to-r from-[#0F4A2F] to-[#1a6b44] text-white px-6 py-5 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2.5">
            <Leaf size={22} className="text-green-300" />
            <div>
              <h1 className="text-xl font-bold leading-tight">Maintenance Reports</h1>
              <p className="text-xs text-green-200 mt-0.5">Review and evaluate tree grower submissions</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="bg-white/10 text-white text-xs px-3 py-1.5 rounded-lg font-semibold">
              {statusCounts.for_evaluation} pending review
            </span>
          </div>
        </div>
      </header>

      {/* ── Filter Tabs ── */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 flex items-center gap-1 overflow-x-auto py-2">
          {(["all", "for_evaluation", "for_head", "accepted", "rejected"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`flex-shrink-0 px-4 py-2 rounded-lg text-xs font-semibold transition-all
                ${filterStatus === s
                  ? "bg-[#0F4A2F] text-white shadow-sm"
                  : "text-gray-500 hover:bg-gray-100"}`}
            >
              {s === "all" ? "All" : STATUS_CONFIG[s as ReportStatus]?.label ?? s}
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold
                ${filterStatus === s ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"}`}>
                {statusCounts[s]}
              </span>
            </button>
          ))}

          <div className="ml-auto flex items-center gap-2 flex-shrink-0">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search reports…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-[#0F4A2F] w-52 transition-colors"
              />
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-3 border-[#0F4A2F] border-t-transparent rounded-full animate-spin" />
            <span className="ml-3 text-sm text-gray-500">Loading reports…</span>
          </div>
        ) : (
          <div className="flex gap-6">
            {/* ── Report List ── */}
            <div className="flex-1 min-w-0">
              {filtered.length === 0 ? (
                <div className="text-center py-20">
                  <FileText size={40} className="text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-400 font-medium">No reports found</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {filtered.map((report) => (
                    <div
                      key={report.maintenance_report_id}
                      onClick={() => setSelected(report)}
                      className={`bg-white rounded-2xl border p-5 cursor-pointer transition-all hover:shadow-md
                        ${selected?.maintenance_report_id === report.maintenance_report_id
                          ? "border-[#0F4A2F] ring-1 ring-[#0F4A2F]/20"
                          : "border-gray-100 hover:border-green-200"}`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-900 truncate">{report.title}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {report.organization_name} · {report.application_title}
                          </p>
                        </div>
                        <StatusBadge status={report.status} />
                      </div>

                      <p className="text-sm text-gray-500 line-clamp-2 mb-3">{report.description}</p>

                      <div className="flex flex-wrap gap-2">
                        <MetricChip icon={<Trees size={12} />} label="Planted" value={report.total_seedling_planted} />
                        <MetricChip icon={<Layers size={12} />} label="Area" value={`${parseFloat(report.total_area_planted).toFixed(1)} ha`} />
                        <MetricChip icon={<Users size={12} />} label="Members" value={report.total_member_present ?? "—"} />
                        <MetricChip icon={<Calendar size={12} />} label="Submitted" value={formatDate(report.created_at)} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Detail Panel ── */}
            {selected && (
              <div className="w-96 flex-shrink-0">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm sticky top-20">
                  {/* Panel Header */}
                  <div className="p-5 border-b border-gray-100">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h3 className="font-bold text-gray-900 leading-tight">{selected.title}</h3>
                      <button onClick={() => setSelected(null)} className="text-gray-300 hover:text-gray-500 text-lg leading-none flex-shrink-0">✕</button>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={selected.status} />
                      <span className="text-xs text-gray-400">{formatDate(selected.created_at)}</span>
                    </div>
                  </div>

                  <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
                    {/* Org + Application */}
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">Organization</p>
                      <p className="text-sm font-semibold text-gray-800">{selected.organization_name}</p>
                      <p className="text-xs text-gray-400">{selected.application_title}</p>
                    </div>

                    {/* Description */}
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">Description</p>
                      <p className="text-sm text-gray-700 leading-relaxed">{selected.description}</p>
                    </div>

                    {/* Metrics */}
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Metrics</p>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { label: "Seedlings Planted", value: selected.total_seedling_planted },
                          { label: "Survived", value: selected.total_seedling_survived },
                          { label: "Area (ha)", value: parseFloat(selected.total_area_planted).toFixed(2) },
                          { label: "Owned Seedlings", value: selected.total_owned_seedling_planted },
                          { label: "Members", value: selected.total_member_present ?? "—" },
                          { label: "Duration", value: `${selected.project_duration}d` },
                        ].map((m, i) => (
                          <div key={i} className="bg-gray-50 rounded-xl p-3">
                            <p className="text-xs text-gray-400">{m.label}</p>
                            <p className="text-sm font-bold text-[#0F4A2F] mt-0.5">{m.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Files */}
                    {(selected.maintenance_report_file || selected.group_picture) && (
                      <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Attachments</p>
                        <div className="space-y-2">
                          {selected.maintenance_report_file && (
                            <a
                              href={`http://127.0.0.1:8000${selected.maintenance_report_file}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2.5 p-3 bg-green-50 rounded-xl border border-green-100 hover:bg-green-100 transition-colors group"
                            >
                              <FileText size={16} className="text-[#0F4A2F]" />
                              <span className="flex-1 text-xs font-semibold text-[#0F4A2F] truncate">
                                {selected.maintenance_report_file.split("/").pop()}
                              </span>
                              <Download size={14} className="text-green-400 group-hover:text-[#0F4A2F]" />
                            </a>
                          )}
                          {selected.group_picture && (
                            <div>
                              <img
                                src={`http://127.0.0.1:8000${selected.group_picture}`}
                                alt="Group"
                                className="w-full rounded-xl border border-gray-100 object-cover max-h-36"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {selected.status === "for_evaluation" && (
                    <div className="p-5 border-t border-gray-100 space-y-2">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Evaluation Actions</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEvalModal({ open: true, action: "reject" })}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-red-200 text-red-500 text-xs font-bold hover:bg-red-50 transition-colors"
                        >
                          <XCircle size={14} /> Reject
                        </button>
                        <button
                          onClick={() => setEvalModal({ open: true, action: "forward" })}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-blue-200 text-blue-600 text-xs font-bold hover:bg-blue-50 transition-colors"
                        >
                          <ChevronRight size={14} /> For Head
                        </button>
                        <button
                          onClick={() => setEvalModal({ open: true, action: "accept" })}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#0F4A2F] text-white text-xs font-bold hover:bg-[#1a6b44] transition-colors"
                        >
                          <CheckCircle2 size={14} /> Accept
                        </button>
                      </div>

                      {/* Alert Tree Grower */}
                      <button
                        onClick={() => {
                          setAlertTarget({ application_id: selected.application_id, org_name: selected.organization_name });
                          setAlertModal(true);
                        }}
                        className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-amber-200 text-amber-600 text-xs font-bold hover:bg-amber-50 transition-colors"
                      >
                        <BellRing size={14} /> Alert Tree Grower for Update
                      </button>
                    </div>
                  )}

                  {/* Alert button for any status */}
                  {selected.status !== "for_evaluation" && (
                    <div className="p-5 border-t border-gray-100">
                      <button
                        onClick={() => {
                          setAlertTarget({ application_id: selected.application_id, org_name: selected.organization_name });
                          setAlertModal(true);
                        }}
                        className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-amber-200 text-amber-600 text-xs font-bold hover:bg-amber-50 transition-colors"
                      >
                        <BellRing size={14} /> Alert Tree Grower for Update
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Evaluation Confirm Modal ── */}
      {evalModal.open && selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4
              ${evalModal.action === "accept" ? "bg-green-100" : evalModal.action === "reject" ? "bg-red-100" : "bg-blue-100"}`}>
              {evalModal.action === "accept"
                ? <CheckCircle2 size={28} className="text-green-600" />
                : evalModal.action === "reject"
                ? <XCircle size={28} className="text-red-500" />
                : <ChevronRight size={28} className="text-blue-500" />}
            </div>
            <h3 className="text-lg font-bold text-center text-gray-800 mb-1">
              {evalModal.action === "accept" ? "Accept Report?" : evalModal.action === "reject" ? "Reject Report?" : "Forward to Head?"}
            </h3>
            <p className="text-sm text-center text-gray-500 mb-5">
              "{selected.title}"
            </p>

            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Reason / Remarks
            </label>
            <textarea
              rows={3}
              value={evalReason}
              onChange={(e) => setEvalReason(e.target.value)}
              placeholder="Enter evaluation remarks…"
              className="w-full border border-gray-200 rounded-xl p-3 text-sm text-gray-700 resize-none focus:outline-none focus:border-[#0F4A2F] focus:ring-1 focus:ring-[#0F4A2F] mb-5 transition-colors"
            />

            <div className="flex gap-3">
              <button
                onClick={() => { setEvalModal({ open: false, action: null }); setEvalReason(""); }}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEvaluate}
                disabled={submitting}
                className={`flex-1 py-2.5 rounded-xl text-white text-sm font-bold transition-all
                  ${evalModal.action === "accept"
                    ? "bg-[#0F4A2F] hover:bg-[#1a6b44]"
                    : evalModal.action === "reject"
                    ? "bg-red-500 hover:bg-red-600"
                    : "bg-blue-600 hover:bg-blue-700"}
                  ${submitting ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {submitting ? "Processing…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Alert Tree Grower Modal ── */}
      {alertModal && alertTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
              <BellRing size={28} className="text-amber-500" />
            </div>
            <h3 className="text-lg font-bold text-center text-gray-800 mb-1">Alert Tree Grower</h3>
            <p className="text-sm text-center text-gray-500 mb-5">
              Send an update request to <span className="font-semibold">{alertTarget.org_name}</span>
            </p>

            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Message *
            </label>
            <textarea
              rows={4}
              value={alertMessage}
              onChange={(e) => setAlertMessage(e.target.value)}
              placeholder="e.g. Please submit an updated maintenance report with current seedling survival data…"
              className="w-full border border-gray-200 rounded-xl p-3 text-sm text-gray-700 resize-none focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-300 mb-2 transition-colors"
            />
            <div className="flex items-start gap-1.5 mb-5 text-amber-600 bg-amber-50 rounded-xl px-3 py-2">
              <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
              <p className="text-xs">The tree grower will receive a notification to submit a new maintenance report.</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setAlertModal(false); setAlertMessage(""); setAlertTarget(null); }}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSendAlert}
                disabled={sendingAlert}
                className={`flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold transition-all
                  ${sendingAlert ? "opacity-50 cursor-not-allowed" : ""}`}
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