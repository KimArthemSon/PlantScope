import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, XCircle, Search, MapPin, Clock, FileText, Download, Trees, ShieldCheck, Ruler, AlertTriangle, History } from "lucide-react";
import PlantScopeAlert from "@/components/alert/PlantScopeAlert";
import ReportAreaMap, { computeAreaStats } from "@/components/map/ReportAreaMap";
import { api } from "@/constant/api";

// GIS Specialist step (2 of 2): confirm the planted-area polygon that the
// Onsite Inspector drew, after the Data Manager has approved the report.

interface ReviewStep {
  status: "pending" | "approved" | "changes_requested" | "not_required";
  notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
}

interface GisReviewReport {
  report_id: number;
  visit_type: "initial" | "ongoing" | "inactive_check";
  status: "pending" | "accepted" | "rejected";
  description: string | null;
  submitted_at: string | null;
  proof_image: string | null;
  group_name: string;
  total_added_by_grower: number;
  total_dead: number;
  total_planted: number;
  polygon_coordinates: [number, number][];
  planted_area_hectares: number | null;
  submitted_by_name: string | null;
  review_stage: string;
  dm_review: ReviewStep;
  gis_review: ReviewStep;
  site: {
    site_id: number;
    name: string;
    reforestation_area_name: string | null;
    barangay_name: string | null;
    polygon_coordinates: [number, number][] | null;
    total_area_hectares: number;
  };
}

const VISIT_LABEL: Record<string, string> = {
  initial: "Initial Orientation",
  ongoing: "Ongoing Monitoring",
  inactive_check: "Inactive Check",
};

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) : "—";

export default function PlantingAreaReviews() {
  const token = localStorage.getItem("token");
  const [scope, setScope] = useState<"pending" | "awaiting_dm" | "reviewed">("pending");
  const [awaitingDmCount, setAwaitingDmCount] = useState(0);
  const [search, setSearch] = useState("");
  const [reports, setReports] = useState<GisReviewReport[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [changesModal, setChangesModal] = useState<{ open: boolean; notes: string }>({ open: false, notes: "" });
  const [confirmModal, setConfirmModal] = useState<{ open: boolean; notes: string }>({ open: false, notes: "" });
  const [alert, setAlert] = useState<{ type: "success" | "failed" | "error"; title: string; message: string } | null>(null);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ scope });
      if (search.trim()) params.append("search", search.trim());
      const res = await fetch(`${api}api/get_gis_review_reports/?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load reports");
      setReports(data.data);
      setPendingCount(data.pending_count);
      setAwaitingDmCount(data.awaiting_dm_count ?? 0);
      setSelectedId((prev) => (data.data.some((r: GisReviewReport) => r.report_id === prev) ? prev : data.data[0]?.report_id ?? null));
    } catch (err: any) {
      setAlert({ type: "error", title: "Error", message: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(fetchReports, 300);
    return () => clearTimeout(t);
  }, [scope, search]);

  const selected = reports.find((r) => r.report_id === selectedId) ?? null;
  const stats = useMemo(
    () => (selected ? computeAreaStats(selected.polygon_coordinates, selected.site.polygon_coordinates) : null),
    [selected],
  );
  const percentOfSite =
    selected && selected.planted_area_hectares != null && selected.site.total_area_hectares
      ? (selected.planted_area_hectares / selected.site.total_area_hectares) * 100
      : null;

  const review = async (action: "approve" | "request_changes", notes: string) => {
    if (!selected) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${api}api/review_progress_report/${selected.report_id}/`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action, notes: notes.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Action failed");
      setAlert({ type: "success", title: action === "approve" ? "Map Confirmed" : "Changes Requested", message: data.message });
      setChangesModal({ open: false, notes: "" });
      setConfirmModal({ open: false, notes: "" });
      fetchReports();
    } catch (err: any) {
      setAlert({ type: "failed", title: "Failed", message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {alert && <PlantScopeAlert type={alert.type} title={alert.title} message={alert.message} onClose={() => setAlert(null)} />}

      <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
        <div>
          <h2 className="text-xl font-bold text-[#0F4A2F]">Planted Area Reviews</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Confirm the planted-area outline sent by Onsite Inspectors. Reports reach you after the Data Manager approves them.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-white border border-gray-200 rounded-xl p-1">
            {(["pending", "awaiting_dm", "reviewed"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setScope(s)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${scope === s ? "bg-[#0F4A2F] text-white" : "text-gray-600 hover:bg-gray-50"}`}
              >
                {s === "pending" ? `Waiting for me (${pendingCount})` : s === "awaiting_dm" ? `With Data Manager (${awaitingDmCount})` : "Reviewed"}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search site or area"
              className="pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#0F4A2F] w-56"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-5">
        {/* List */}
        <div className="w-full lg:w-80 shrink-0 space-y-2">
          {loading ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-sm text-gray-400">Loading…</div>
          ) : reports.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
              <ShieldCheck size={32} className="mx-auto text-green-500 mb-2" />
              <p className="text-sm font-semibold text-gray-700">
                {scope === "pending" ? "Nothing to review" : scope === "awaiting_dm" ? "No reports with the Data Manager" : "No reviewed reports yet"}
              </p>
              {scope === "pending" && (
                <p className="text-xs text-gray-400 mt-1">
                  New reports appear here once the Data Manager approves them.
                  {awaitingDmCount > 0 && (
                    <button onClick={() => setScope("awaiting_dm")} className="block mx-auto mt-2 text-[#0F4A2F] font-semibold hover:underline">
                      {awaitingDmCount} report{awaitingDmCount === 1 ? " is" : "s are"} still with the Data Manager →
                    </button>
                  )}
                </p>
              )}
            </div>
          ) : (
            reports.map((r) => {
              const active = r.report_id === selectedId;
              const g = r.gis_review.status;
              return (
                <button
                  key={r.report_id}
                  onClick={() => setSelectedId(r.report_id)}
                  className={`w-full text-left bg-white rounded-xl border p-3.5 transition-all ${active ? "border-[#0F4A2F] ring-2 ring-[#0F4A2F]/15" : "border-gray-100 hover:border-gray-300"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-bold text-gray-800 leading-tight">{r.site.name}</p>
                    <span className="text-xs font-bold text-[#0F4A2F] whitespace-nowrap">{r.planted_area_hectares?.toFixed(2) ?? "—"} ha</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                    <MapPin size={11} /> {r.site.reforestation_area_name ?? "Unknown area"}
                    {r.site.barangay_name ? ` · ${r.site.barangay_name}` : ""}
                  </p>
                  <div className="flex items-center justify-between mt-2 text-[11px] text-gray-400">
                    <span>{VISIT_LABEL[r.visit_type]} · {formatDate(r.submitted_at)}</span>
                    {scope === "reviewed" && (
                      <span className={`font-semibold ${g === "approved" ? "text-green-600" : "text-red-600"}`}>
                        {g === "approved" ? "Confirmed" : "Changes requested"}
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Detail */}
        <div className="flex-1 min-w-0">
          {selected ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{selected.site.name}</h3>
                  <p className="text-xs text-gray-500">
                    {VISIT_LABEL[selected.visit_type]} · {selected.group_name} · submitted {formatDate(selected.submitted_at)}
                    {selected.submitted_by_name ? ` by ${selected.submitted_by_name}` : ""}
                  </p>
                </div>
                {selected.dm_review.status === "pending" ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                    <Clock size={13} /> Step 1: waiting for Data Manager
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
                    <CheckCircle2 size={13} /> Step 1 approved by {selected.dm_review.reviewed_by ?? "Data Manager"} · {formatDate(selected.dm_review.reviewed_at)}
                  </span>
                )}
              </div>

              <ReportAreaMap
                reportPolygon={selected.polygon_coordinates}
                sitePolygon={selected.site.polygon_coordinates}
                areaHectares={selected.planted_area_hectares}
                height={440}
              />

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat icon={<Ruler size={16} />} label="Planted area" value={`${selected.planted_area_hectares?.toFixed(4) ?? "—"} ha`} tone="green" />
                <Stat icon={<MapPin size={16} />} label="Site area" value={`${selected.site.total_area_hectares?.toFixed(4) ?? "—"} ha`} />
                <Stat icon={<Trees size={16} />} label="Of site area" value={percentOfSite != null ? `${percentOfSite.toFixed(1)}%` : "—"} tone={percentOfSite != null && percentOfSite > 100 ? "red" : undefined} />
                <Stat
                  icon={<AlertTriangle size={16} />}
                  label="Outside boundary"
                  value={stats?.outsidePercent != null ? `${stats.outsidePercent.toFixed(1)}%` : "—"}
                  tone={stats?.outsidePercent != null && stats.outsidePercent > 5 ? "red" : undefined}
                />
              </div>
              {stats && selected.planted_area_hectares != null && Math.abs(stats.areaHa - selected.planted_area_hectares) / Math.max(selected.planted_area_hectares, 1e-9) > 0.02 && (
                <p className="text-xs text-amber-600 flex items-center gap-1.5">
                  <AlertTriangle size={13} /> Browser measurement is {stats.areaHa.toFixed(4)} ha. The shape may cross over itself; check the corner order.
                </p>
              )}

              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5"><FileText size={13} /> Report summary</p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div><p className="text-lg font-bold text-blue-600">{selected.total_planted}</p><p className="text-[10px] text-gray-500 uppercase">Planted</p></div>
                    <div><p className="text-lg font-bold text-emerald-600">{selected.total_added_by_grower}</p><p className="text-[10px] text-gray-500 uppercase">Added</p></div>
                    <div><p className="text-lg font-bold text-red-600">{selected.total_dead}</p><p className="text-[10px] text-gray-500 uppercase">Dead</p></div>
                  </div>
                  {selected.description && <p className="text-sm text-gray-700 mt-3"><span className="font-semibold">Inspector notes:</span> {selected.description}</p>}
                  {selected.proof_image && (
                    <a href={selected.proof_image} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs text-[#0F4A2F] font-semibold hover:underline bg-green-50 px-3 py-1.5 rounded-lg border border-green-200">
                      <Download size={12} /> View proof image
                    </a>
                  )}
                </div>
                <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5"><History size={13} /> Review trail</p>
                  <ol className="space-y-2 text-sm">
                    <li>
                      <span className="font-semibold text-gray-800">1. Data Manager</span> —{" "}
                      {selected.dm_review.status === "pending" ? <span className="text-amber-600">reviewing</span> : "approved"}
                      {selected.dm_review.notes && <span className="block text-xs text-gray-500">“{selected.dm_review.notes}”</span>}
                    </li>
                    <li>
                      <span className="font-semibold text-gray-800">2. GIS Specialist</span> —{" "}
                      {selected.dm_review.status === "pending" ? (
                        <span className="text-gray-400">not started</span>
                      ) : selected.gis_review.status === "pending" ? (
                        <span className="text-amber-600 inline-flex items-center gap-1"><Clock size={12} /> waiting for you</span>
                      ) : selected.gis_review.status === "approved" ? (
                        <span className="text-green-600">confirmed by {selected.gis_review.reviewed_by} · {formatDate(selected.gis_review.reviewed_at)}</span>
                      ) : (
                        <span className="text-red-600">changes requested by {selected.gis_review.reviewed_by} · {formatDate(selected.gis_review.reviewed_at)}</span>
                      )}
                      {selected.gis_review.notes && <span className="block text-xs text-gray-500">“{selected.gis_review.notes}”</span>}
                    </li>
                  </ol>
                </div>
              </div>

              {selected.dm_review.status === "pending" && (
                <div className="pt-4 border-t border-gray-100 text-sm text-amber-700 flex items-center gap-2">
                  <Clock size={15} /> Preview only. You can confirm or request changes after the Data Manager approves this report.
                </div>
              )}

              {selected.dm_review.status === "approved" && selected.gis_review.status === "pending" && selected.status === "pending" && (
                <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-100">
                  <button
                    onClick={() => setConfirmModal({ open: true, notes: "" })}
                    disabled={submitting}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#0F4A2F] text-white text-sm font-bold hover:bg-[#1a6b44] transition-colors disabled:opacity-50"
                  >
                    <CheckCircle2 size={16} /> Confirm Map & Accept Report
                  </button>
                  <button
                    onClick={() => setChangesModal({ open: true, notes: "" })}
                    disabled={submitting}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white border border-red-200 text-red-600 text-sm font-bold hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    <XCircle size={16} /> Request Changes
                  </button>
                </div>
              )}
            </div>
          ) : (
            !loading && (
              <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-sm text-gray-400">Select a report to review its planted area.</div>
            )
          )}
        </div>
      </div>

      {confirmModal.open && selected && (
        <Modal
          tone="green"
          title="Confirm planted area?"
          subtitle={`${selected.planted_area_hectares?.toFixed(4) ?? "—"} ha at ${selected.site.name}. This accepts the report.`}
          label="Note (optional)"
          placeholder="e.g. Outline matches satellite imagery."
          notes={confirmModal.notes}
          onNotes={(notes) => setConfirmModal({ open: true, notes })}
          onCancel={() => setConfirmModal({ open: false, notes: "" })}
          onSubmit={() => review("approve", confirmModal.notes)}
          submitLabel="Confirm"
          submitting={submitting}
          requireNotes={false}
        />
      )}

      {changesModal.open && selected && (
        <Modal
          tone="red"
          title="Request changes to the map?"
          subtitle="The inspector will be notified to redo the planted-area outline and resubmit. The Data Manager is also notified."
          label="What needs to change? *"
          placeholder="e.g. The outline extends past the site boundary on the east side. Re-walk the boundary."
          notes={changesModal.notes}
          onNotes={(notes) => setChangesModal({ open: true, notes })}
          onCancel={() => setChangesModal({ open: false, notes: "" })}
          onSubmit={() => review("request_changes", changesModal.notes)}
          submitLabel="Send Request"
          submitting={submitting}
          requireNotes
        />
      )}
    </div>
  );
}

function Stat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone?: "green" | "red" }) {
  const cls = tone === "green" ? "bg-emerald-50 border-emerald-100 text-emerald-800" : tone === "red" ? "bg-red-50 border-red-100 text-red-700" : "bg-gray-50 border-gray-100 text-gray-800";
  return (
    <div className={`p-3 rounded-xl border ${cls}`}>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide opacity-70">{icon} {label}</div>
      <p className="text-lg font-bold mt-1">{value}</p>
    </div>
  );
}

function Modal(props: {
  tone: "green" | "red";
  title: string;
  subtitle: string;
  label: string;
  placeholder: string;
  notes: string;
  onNotes: (v: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
  submitLabel: string;
  submitting: boolean;
  requireNotes: boolean;
}) {
  const disabled = props.submitting || (props.requireNotes && !props.notes.trim());
  const green = props.tone === "green";
  return (
    <div className="fixed inset-0 bg-black/50 z-[2000] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${green ? "bg-green-100" : "bg-red-100"}`}>
          {green ? <CheckCircle2 size={28} className="text-green-600" /> : <XCircle size={28} className="text-red-500" />}
        </div>
        <h3 className="text-lg font-bold text-center text-gray-800 mb-1">{props.title}</h3>
        <p className="text-sm text-center text-gray-500 mb-5">{props.subtitle}</p>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{props.label}</label>
        <textarea
          rows={4}
          value={props.notes}
          onChange={(e) => props.onNotes(e.target.value)}
          placeholder={props.placeholder}
          className="w-full border border-gray-200 rounded-xl p-3 text-sm text-gray-700 resize-none focus:outline-none focus:border-[#0F4A2F] mb-5"
        />
        <div className="flex gap-3">
          <button onClick={props.onCancel} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50">Cancel</button>
          <button
            onClick={props.onSubmit}
            disabled={disabled}
            className={`flex-1 py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed ${green ? "bg-[#0F4A2F] hover:bg-[#1a6b44]" : "bg-red-500 hover:bg-red-600"}`}
          >
            {props.submitting ? "Processing…" : props.submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
