/**
 * Everything one tree grower group has done: each program with its site, orientation,
 * seedling requests, monitoring visits and closure decision, plus one timeline.
 * Opened from the Head's Accomplishments and Tree Growers reports.
 */
import { useEffect, useState, type ReactNode } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  Flag,
  Gavel,
  History,
  Loader2,
  MapPin,
  Package,
  Sprout,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { api } from "@/constant/api.ts";
import { exportPdf } from "../../dataManager/reports/reportExport";
import { Badge, EmptyState, PROGRAM_TONE, RateBar, fmt, fmtDate, fmtHa, fmtPct, rateColor } from "../../dataManager/reports/reportUi";

// ─── Types ──────────────────────────────────────────────────────────────────

interface SeedlingRequest {
  id: number;
  date: string | null;
  requested: number;
  released: number;
  species: { name: string; quantity: number }[];
  status: string;
  status_label: string;
  fulfillment: string | null;
  inspector: string | null;
  notes: string | null;
}

interface Visit {
  id: number;
  date: string | null;
  visit_type: string;
  status: string;
  inspector: string;
  planted: number;
  dead: number;
  planted_hectares: number | null;
  total_planted: number | null;
  survival_rate: number | null;
}

interface Program {
  application_id: number;
  ref: string;
  title: string;
  classification: string;
  participants: number;
  status: string;
  status_label: string;
  site_id: number | null;
  site_name: string | null;
  barangay: string | null;
  site_hectares: number | null;
  land_classification: string | null;
  submitted: string | null;
  approved: string | null;
  orientation_date: string | null;
  closed: string | null;
  duration_days: number | null;
  planted: number;
  alive: number;
  dead: number;
  survival_rate: number | null;
  planted_hectares: number | null;
  seedling_requests: SeedlingRequest[];
  visits: Visit[];
  closure: {
    recommendation: string;
    reason: string;
    requested_by: string;
    requested_at: string | null;
    status: string;
    final_outcome: string | null;
    decided_by: string | null;
    decided_at: string | null;
    notes: string | null;
  } | null;
}

interface GroupHistory {
  group: { group_id: number; name: string; type: string; contact: string; address: string; email: string | null; joined: string | null };
  summary: {
    programs: number;
    completed: number;
    failed: number;
    active: number;
    sites: number;
    seedlings_requested: number;
    seedlings_released: number;
    planted: number;
    alive: number;
    dead: number;
    survival_rate: number | null;
    visits: number;
  };
  programs: Program[];
  timeline: { date: string | null; kind: string; title: string; detail: string | null; ref: string | null }[];
}

const REQUEST_TONE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  accepted: "bg-blue-50 text-blue-700 border-blue-200",
  confirmed: "bg-green-50 text-green-700 border-green-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
  cancelled: "bg-gray-100 text-gray-600 border-gray-200",
};
const VISIT_STATUS: Record<string, { label: string; tone: string }> = {
  accepted: { label: "Accepted", tone: "text-emerald-600" },
  pending: { label: "Pending review", tone: "text-amber-600" },
  rejected: { label: "Changes requested", tone: "text-red-500" },
};
const KIND_STYLE: Record<string, { icon: ReactNode; dot: string; label: string }> = {
  group: { icon: <Users size={12} />, dot: "bg-gray-400", label: "Group" },
  program: { icon: <ClipboardList size={12} />, dot: "bg-indigo-500", label: "Program" },
  orientation: { icon: <CalendarDays size={12} />, dot: "bg-sky-500", label: "Orientation" },
  seedlings: { icon: <Package size={12} />, dot: "bg-teal-500", label: "Seedlings" },
  visit: { icon: <Sprout size={12} />, dot: "bg-emerald-500", label: "Visit" },
  closure: { icon: <Gavel size={12} />, dot: "bg-amber-500", label: "Closure" },
};

function Metric({ label, value, sub, color }: { label: string; value: ReactNode; sub?: ReactNode; color?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
      <p className="text-[18px] font-bold text-gray-800 leading-tight" style={color ? { color } : undefined}>
        {value}
      </p>
      {sub && <p className="text-[10.5px] text-gray-400">{sub}</p>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
      <div className="text-[12.5px] text-gray-800">{children}</div>
    </div>
  );
}

// ─── Program card ───────────────────────────────────────────────────────────

function ProgramCard({ p, onSiteHistory }: { p: Program; onSiteHistory?: (id: number) => void }) {
  const [open, setOpen] = useState(p.status === "completed" || p.status === "under_monitoring" || p.status === "accepted");
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full text-left px-4 py-3 flex items-start justify-between gap-3 hover:bg-gray-50/60">
        <div className="min-w-0">
          <p className="text-[11px] text-gray-400 font-semibold">
            {p.ref} · {p.classification} · {p.participants} participants
          </p>
          <p className="text-[14px] font-bold text-gray-800 truncate">{p.title}</p>
          <p className="text-[11.5px] text-gray-500 flex items-center gap-1">
            <MapPin size={11} /> {p.site_name ?? "No site"}
            {p.barangay ? ` · ${p.barangay}` : ""}
            {p.land_classification ? ` · ${p.land_classification}` : ""}
          </p>
        </div>
        <div className="text-right shrink-0">
          <Badge label={p.status_label} tone={PROGRAM_TONE[p.status] ?? PROGRAM_TONE.cancelled} />
          <p className="text-[11px] mt-1 font-semibold" style={{ color: rateColor(p.survival_rate) }}>
            {p.planted > 0 ? `${fmtPct(p.survival_rate)} survival` : "No planting yet"}
          </p>
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-50">
          {/* Key dates and results */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3">
            <Field label="Submitted">{fmtDate(p.submitted)}</Field>
            <Field label="Approved">{fmtDate(p.approved)}</Field>
            <Field label="Orientation">
              <span className={p.orientation_date ? "font-semibold text-sky-700" : "text-gray-400"}>{fmtDate(p.orientation_date)}</span>
            </Field>
            <Field label="Closed">
              {fmtDate(p.closed)}
              {p.duration_days !== null && <span className="text-[11px] text-gray-400"> · {p.duration_days} days</span>}
            </Field>
            <Field label="Planted / alive">
              {fmt(p.planted)} / {fmt(p.alive)} <span className="text-[11px] text-red-500">· {fmt(p.dead)} dead</span>
            </Field>
            <Field label="Survival">
              <RateBar rate={p.survival_rate} />
            </Field>
            <Field label="Planted area">
              {fmtHa(p.planted_hectares)}
              {p.site_hectares ? <span className="text-[11px] text-gray-400"> of {fmtHa(p.site_hectares)}</span> : null}
            </Field>
            <Field label="Site">
              {p.site_id && onSiteHistory ? (
                <button onClick={() => onSiteHistory(p.site_id!)} className="text-emerald-700 hover:underline flex items-center gap-1">
                  <History size={11} /> Site history
                </button>
              ) : (
                <span className="text-gray-400">—</span>
              )}
            </Field>
          </div>

          {/* Seedling requests */}
          <div>
            <p className="text-[12px] font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
              <Package size={13} className="text-teal-600" /> Seedling requests ({p.seedling_requests.length})
            </p>
            {p.seedling_requests.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-gray-100">
                <table className="min-w-full text-[12px]">
                  <thead className="bg-gray-50 text-gray-500 text-[10.5px] uppercase tracking-wider">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">Date</th>
                      <th className="px-3 py-2 text-left font-semibold">Species</th>
                      <th className="px-3 py-2 text-right font-semibold">Requested</th>
                      <th className="px-3 py-2 text-right font-semibold">Released</th>
                      <th className="px-3 py-2 text-left font-semibold">Status</th>
                      <th className="px-3 py-2 text-left font-semibold">Handover</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {p.seedling_requests.map((r) => (
                      <tr key={r.id} className="align-top">
                        <td className="px-3 py-2 whitespace-nowrap">{fmtDate(r.date)}</td>
                        <td className="px-3 py-2">
                          {r.species.length > 0 ? r.species.map((sp) => `${sp.name} × ${fmt(sp.quantity)}`).join(", ") : "—"}
                        </td>
                        <td className="px-3 py-2 text-right">{fmt(r.requested)}</td>
                        <td className="px-3 py-2 text-right">{r.released ? fmt(r.released) : "—"}</td>
                        <td className="px-3 py-2">
                          <Badge label={r.status_label} tone={REQUEST_TONE[r.status] ?? REQUEST_TONE.cancelled} />
                        </td>
                        <td className="px-3 py-2 text-gray-600">
                          {r.fulfillment ?? "—"}
                          {r.inspector && <p className="text-[10.5px] text-gray-400">{r.inspector}</p>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-[12px] text-gray-400">No seedling requests</p>
            )}
          </div>

          {/* Monitoring visits */}
          <div>
            <p className="text-[12px] font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
              <Sprout size={13} className="text-emerald-600" /> Monitoring visits ({p.visits.length})
            </p>
            {p.visits.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-gray-100">
                <table className="min-w-full text-[12px]">
                  <thead className="bg-gray-50 text-gray-500 text-[10.5px] uppercase tracking-wider">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">Date</th>
                      <th className="px-3 py-2 text-left font-semibold">Visit</th>
                      <th className="px-3 py-2 text-right font-semibold">Planted</th>
                      <th className="px-3 py-2 text-right font-semibold">Dead</th>
                      <th className="px-3 py-2 text-right font-semibold">Area</th>
                      <th className="px-3 py-2 text-left font-semibold">Running survival</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {p.visits.map((v) => {
                      const st = VISIT_STATUS[v.status] ?? VISIT_STATUS.pending;
                      return (
                        <tr key={v.id} className={`align-top ${v.status !== "accepted" ? "text-gray-400" : ""}`}>
                          <td className="px-3 py-2 whitespace-nowrap">{fmtDate(v.date)}</td>
                          <td className="px-3 py-2">
                            <p className={v.status === "accepted" ? "text-gray-800" : ""}>{v.visit_type}</p>
                            <p className={`text-[10.5px] ${st.tone}`}>
                              {st.label}
                              {v.inspector && v.inspector !== "—" ? ` · ${v.inspector}` : ""}
                            </p>
                          </td>
                          <td className="px-3 py-2 text-right">{fmt(v.planted)}</td>
                          <td className="px-3 py-2 text-right">{fmt(v.dead)}</td>
                          <td className="px-3 py-2 text-right">{v.planted_hectares !== null ? fmtHa(v.planted_hectares) : "—"}</td>
                          <td className="px-3 py-2">
                            {v.survival_rate !== null ? (
                              <span className="font-semibold" style={{ color: rateColor(v.survival_rate) }}>
                                {v.survival_rate}% <span className="text-gray-400 font-normal">of {fmt(v.total_planted)}</span>
                              </span>
                            ) : (
                              <span className="text-[11px]">Not counted</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-[12px] text-gray-400">No monitoring visits yet</p>
            )}
          </div>

          {/* Closure */}
          {p.closure && (
            <div
              className={`rounded-lg border p-3 text-[12px] ${
                p.closure.final_outcome === "completed"
                  ? "bg-green-50 border-green-200"
                  : p.closure.final_outcome === "failed"
                    ? "bg-red-50 border-red-200"
                    : "bg-amber-50 border-amber-200"
              }`}
            >
              <p className="font-bold text-gray-800 flex items-center gap-1.5">
                <Gavel size={13} /> Closure — {p.closure.status}
                {p.closure.final_outcome && ` (${p.closure.final_outcome})`}
              </p>
              <p className="text-gray-600 mt-0.5">
                Data Manager recommended <b>{p.closure.recommendation}</b> ({p.closure.requested_by}, {fmtDate(p.closure.requested_at)}):{" "}
                “{p.closure.reason}”
              </p>
              {p.closure.decided_at && (
                <p className="text-gray-600 mt-0.5">
                  Decided by {p.closure.decided_by} on {fmtDate(p.closure.decided_at)}
                  {p.closure.notes ? ` — “${p.closure.notes}”` : ""}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Modal ──────────────────────────────────────────────────────────────────

export default function GroupHistoryModal({
  groupId,
  onClose,
  onSiteHistory,
}: {
  groupId: number;
  onClose: () => void;
  onSiteHistory?: (siteId: number) => void;
}) {
  const [data, setData] = useState<GroupHistory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"programs" | "timeline">("programs");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${api}api/head_report/group_history/${groupId}/`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "Failed to load group history");
        setData(body);
      } catch (err: any) {
        setError(err.message);
      }
    })();
  }, [groupId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handlePdf = () => {
    if (!data) return;
    const g = data.group;
    const s = data.summary;
    exportPdf({
      title: `Tree Grower Group History — ${g.name}`,
      filename: `group_history_${g.name.replace(/\W+/g, "_").toLowerCase()}`,
      filters: [
        ["Group type", g.type],
        ["Contact", g.contact],
        ["Joined", fmtDate(g.joined)],
      ],
      summary: [
        ["Programs", `${s.programs} (${s.completed} completed · ${s.failed} failed · ${s.active} active)`],
        ["Sites", fmt(s.sites)],
        ["Seedlings requested / released", `${fmt(s.seedlings_requested)} / ${fmt(s.seedlings_released)}`],
        ["Trees planted / alive", `${fmt(s.planted)} / ${fmt(s.alive)}`],
        ["Survival", fmtPct(s.survival_rate)],
        ["Accepted visits", fmt(s.visits)],
      ],
      sections: [
        {
          title: "Programs",
          columns: ["Ref", "Program", "Site", "Status", "Orientation", "Closed", "Planted", "Survival"],
          rows: data.programs.map((p) => [
            p.ref, p.title, p.site_name ?? "—", p.status_label, fmtDate(p.orientation_date), fmtDate(p.closed), fmt(p.planted), fmtPct(p.survival_rate),
          ]),
        },
        {
          title: "Seedling requests",
          columns: ["Program", "Date", "Species", "Requested", "Released", "Status"],
          rows: data.programs.flatMap((p) =>
            p.seedling_requests.map((r) => [
              p.ref, fmtDate(r.date), r.species.map((sp) => `${sp.name} × ${sp.quantity}`).join(", ") || "—", r.requested, r.released, r.status_label,
            ]),
          ),
        },
        {
          title: "Monitoring visits",
          columns: ["Program", "Date", "Visit", "Status", "Planted", "Dead", "Running survival"],
          rows: data.programs.flatMap((p) =>
            p.visits.map((v) => [
              p.ref, fmtDate(v.date), v.visit_type, VISIT_STATUS[v.status]?.label ?? v.status, v.planted, v.dead, fmtPct(v.survival_rate),
            ]),
          ),
        },
      ],
      recordsTitle: "Timeline",
      columns: [
        { header: "Date", value: (e) => fmtDate(e.date) },
        { header: "Type", value: (e) => KIND_STYLE[e.kind]?.label ?? e.kind },
        { header: "Program", value: (e) => e.ref },
        { header: "Event", value: (e) => e.title },
        { header: "Details", value: (e) => e.detail },
      ],
      rows: data.timeline,
    });
  };

  const s = data?.summary;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div className="w-full max-w-5xl h-full bg-[#f6faf7] shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-gradient-to-r from-[#0b3622] to-[#0F4A2F] text-white px-6 py-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-emerald-300 font-semibold">Tree grower group history</p>
              <h2 className="text-xl font-bold truncate">{data?.group.name ?? "Loading…"}</h2>
              {data && (
                <p className="text-xs text-white/60 mt-0.5">
                  {data.group.type} · joined {fmtDate(data.group.joined)} · {data.group.contact}
                  {data.group.email ? ` · ${data.group.email}` : ""}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handlePdf}
                disabled={!data}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold disabled:opacity-50"
              >
                <FileText size={14} /> Export PDF
              </button>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10" aria-label="Close">
                <X size={18} />
              </button>
            </div>
          </div>
          {data?.group.address && <p className="text-[11px] text-white/50 mt-2">{data.group.address}</p>}
        </div>

        {error ? (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState text={error} />
          </div>
        ) : !data || !s ? (
          <div className="flex-1 flex justify-center items-center">
            <Loader2 size={32} className="animate-spin text-[#0F4A2F]" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 px-6 pt-4">
              <Metric label="Programs" value={s.programs} sub={`${s.completed} completed · ${s.failed} failed · ${s.active} active`} />
              <Metric label="Sites" value={s.sites} />
              <Metric label="Seedlings" value={fmt(s.seedlings_released)} sub={`released of ${fmt(s.seedlings_requested)} requested`} />
              <Metric label="Trees planted" value={fmt(s.planted)} sub={`${fmt(s.alive)} alive · ${fmt(s.dead)} dead`} />
              <Metric label="Survival" value={fmtPct(s.survival_rate)} color={rateColor(s.survival_rate)} />
              <Metric label="Accepted visits" value={s.visits} />
            </div>

            <div className="flex gap-1 px-6 pt-4">
              {(
                [
                  ["programs", `Programs (${data.programs.length})`],
                  ["timeline", `Timeline (${data.timeline.length})`],
                ] as ["programs" | "timeline", string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                    tab === key ? "bg-[#0F4A2F] text-white shadow-sm" : "text-gray-500 hover:bg-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {tab === "programs" &&
                (data.programs.length > 0 ? (
                  data.programs.map((p) => <ProgramCard key={p.application_id} p={p} onSiteHistory={onSiteHistory} />)
                ) : (
                  <EmptyState text="This group has not applied for a program yet" />
                ))}

              {tab === "timeline" &&
                (data.timeline.length > 0 ? (
                  <div className="relative pl-6">
                    <div className="absolute left-2 top-1 bottom-1 w-px bg-gray-200" />
                    {data.timeline.map((e, i) => {
                      const k = KIND_STYLE[e.kind] ?? { icon: <Flag size={12} />, dot: "bg-gray-400", label: e.kind };
                      const bad = /rejected|failed|changes requested|returned|cancelled/i.test(e.title);
                      const good = /completed|approved|accepted|handed over/i.test(e.title);
                      return (
                        <div key={i} className="relative pb-3">
                          <span className={`absolute -left-[19px] top-1.5 w-2.5 h-2.5 rounded-full ring-4 ring-[#f6faf7] ${k.dot}`} />
                          <div className="bg-white rounded-lg border border-gray-100 px-3 py-2">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[12.5px] font-semibold text-gray-800 flex items-center gap-1.5">
                                {bad ? (
                                  <XCircle size={12} className="text-red-500" />
                                ) : good ? (
                                  <CheckCircle2 size={12} className="text-emerald-600" />
                                ) : (
                                  <span className="text-gray-400">{k.icon}</span>
                                )}
                                {e.title}
                              </p>
                              <span className="text-[10.5px] text-gray-400 shrink-0">{fmtDate(e.date)}</span>
                            </div>
                            <p className="text-[11px] text-gray-500">
                              {k.label}
                              {e.ref ? ` · ${e.ref}` : ""}
                              {e.detail ? ` · ${e.detail}` : ""}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState text="No history yet" />
                ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
