import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  CheckCircle2,
  ClipboardList,
  Clock,
  ExternalLink,
  FileText,
  Flag,
  Link2,
  Link2Off,
  Loader2,
  Mail,
  MapPin,
  MapPinned,
  MonitorDot,
  Phone,
  Ruler,
  Sprout,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { api } from "@/constant/api.ts";
import { exportPdf } from "./reportExport";
import SiteHistoryMap, { type PolygonSnapshot } from "./SiteHistoryMap";
import {
  AXIS_TICK,
  Badge,
  EmptyState,
  GreenTooltip,
  PROGRAM_TONE,
  RateBar,
  VISIT_TONE,
  fmt,
  fmtDate,
  fmtHa,
  fmtPct,
  rateColor,
} from "./reportUi";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Program {
  application_id: number;
  ref: string;
  title: string;
  group_name: string;
  group_type: string | null;
  group_contact: string | null;
  group_address: string | null;
  group_email: string | null;
  classification: string;
  participants: number;
  status: string;
  status_label: string;
  submitted: string;
  orientation_date: string | null;
  closed_date: string | null;
  duration_days: number | null;
  seedlings_released: number;
  planted: number;
  survived: number;
  dead: number;
  survival_rate: number | null;
  visits: number;
  reports_total: number;
  closure_note: string | null;
}

interface Visit {
  id: number;
  date: string;
  visit_type: string;
  status: string;
  program: string | null;
  program_title: string | null;
  group_name: string | null;
  linked: boolean;
  inspector: string;
  planted: number;
  added: number;
  dead: number;
  planted_hectares: number | null;
  dm_review: string;
  gis_review: string;
  has_polygon: boolean;
}

interface SiteHistory {
  site: {
    site_id: number;
    name: string;
    reforestation_area: string | null;
    reforestation_area_id: number | null;
    barangay: string | null;
    hectares: number;
    approval_status: string;
    status: string;
    official: boolean;
    monitoring_status: string;
    monitoring_label: string;
    land_classification: string | null;
    verified_by: string | null;
    verified_at: string | null;
    created_at: string;
    polygon: any;
  };
  metrics: {
    site_hectares: number;
    planted_hectares: number | null;
    coverage_pct: number | null;
    plants_planted: number;
    plants_alive: number;
    plants_dead: number;
    added_by_growers: number;
    survival_rate: number | null;
    programs: number;
    programs_completed: number;
    programs_failed: number;
    programs_active: number;
    groups: number;
    seedlings_released: number;
    visits_total: number;
    visits_accepted: number;
    visits_unlinked: number;
    assessments: number;
    last_visit: string | null;
    days_since_visit: number | null;
  };
  polygon_history: PolygonSnapshot[];
  progress_trend: {
    date: string;
    label: string;
    planted: number;
    alive: number;
    dead: number;
    survival_rate: number | null;
    planted_hectares: number | null;
  }[];
  programs: Program[];
  visits: Visit[];
  assessments: {
    id: number;
    title: string;
    date: string | null;
    inspector: string;
    layers: string[];
    photos: number;
    land_classification: string | null;
  }[];
  timeline: {
    date: string;
    kind: string;
    title: string;
    detail: string | null;
    tone: "success" | "warning" | "danger" | "info";
  }[];
}

type Tab = "overview" | "timeline" | "programs" | "visits" | "assessments";

const TONE_STYLE = {
  success: { dot: "bg-emerald-500", icon: <CheckCircle2 size={12} /> },
  warning: { dot: "bg-amber-500", icon: <Clock size={12} /> },
  danger: { dot: "bg-red-500", icon: <XCircle size={12} /> },
  info: { dot: "bg-sky-500", icon: <Flag size={12} /> },
};

const KIND_LABEL: Record<string, string> = {
  site: "Site",
  program: "Program",
  closure: "Closure",
  visit: "Visit",
  gis: "GIS review",
  assessment: "Assessment",
};

/** Route prefix of the current role, used for links to site pages. */
function useRolePaths() {
  const { pathname } = useLocation();
  if (pathname.startsWith("/GISS")) return { prefix: "/GISS", monitoring: null as string | null };
  if (pathname.startsWith("/DataManager") || pathname.startsWith("/dashboard-data-manager"))
    return { prefix: "/DataManager", monitoring: "/DataManager/site_monitoring" };
  return { prefix: "", monitoring: "/site_monitoring" };
}

function Metric({
  icon,
  label,
  value,
  sub,
  valueColor,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  valueColor?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-3">
      <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-gray-400">
        <span className="text-emerald-600">{icon}</span>
        {label}
      </div>
      <p className="text-[19px] font-bold text-gray-800 mt-1 leading-none" style={valueColor ? { color: valueColor } : undefined}>
        {value}
      </p>
      {sub && <p className="text-[10.5px] text-gray-400 mt-1 leading-tight">{sub}</p>}
    </div>
  );
}

function SectionCard({ title, sub, children, right }: { title: string; sub?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-[13px] font-bold text-gray-800">{title}</p>
          {sub && <p className="text-[11px] text-gray-400">{sub}</p>}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function SiteHistoryModal({ siteId, onClose }: { siteId: number; onClose: () => void }) {
  const navigate = useNavigate();
  const roles = useRolePaths();
  const [data, setData] = useState<SiteHistory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [selectedPolygon, setSelectedPolygon] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${api}api/dm_report/site_history/${siteId}/`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "Failed to load site history");
        setData(body);
        const polys: PolygonSnapshot[] = body.polygon_history ?? [];
        const latestAccepted = [...polys].reverse().find((p) => p.status === "accepted");
        setSelectedPolygon((latestAccepted ?? polys[polys.length - 1])?.id ?? null);
      } catch (err: any) {
        setError(err.message);
      }
    })();
  }, [siteId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const areaChart = useMemo(
    () =>
      (data?.polygon_history ?? []).map((p) => ({
        label: `${fmtDate(p.date)} · ${p.visit_type.split(" ")[0]}`,
        hectares: p.planted_hectares,
        status: p.status,
        id: p.id,
      })),
    [data],
  );

  const sitePageUrl = data?.site.reforestation_area_id
    ? `${roles.prefix}/${data.site.official ? "official-reforestation" : "reforestation"}/site/${data.site.reforestation_area_id}/information/${data.site.site_id}`
    : null;
  const monitoringUrl = data && roles.monitoring && data.site.official ? `${roles.monitoring}/${data.site.site_id}` : null;

  const handlePdf = () => {
    if (!data) return;
    const s = data.site;
    const m = data.metrics;
    exportPdf({
      title: `Site History — ${s.name}`,
      filename: `site_history_${s.name.replace(/\W+/g, "_").toLowerCase()}`,
      filters: [],
      summary: [
        ["Barangay", s.barangay ?? "—"],
        ["Reforestation area", s.reforestation_area ?? "—"],
        ["Site area", fmtHa(s.hectares)],
        ["Latest planted area", m.planted_hectares !== null ? fmtHa(m.planted_hectares) : "—"],
        ["Coverage of site", fmtPct(m.coverage_pct)],
        ["Land classification", s.land_classification ?? "—"],
        ["Approval / monitoring", `${s.approval_status} / ${s.monitoring_label}`],
        ["Verified by", s.verified_by ? `${s.verified_by} (${fmtDate(s.verified_at)})` : "—"],
        ["Plants planted", fmt(m.plants_planted)],
        ["Plants alive", fmt(m.plants_alive)],
        ["Survival rate", fmtPct(m.survival_rate)],
        ["Seedlings released", fmt(m.seedlings_released)],
        ["Programs (completed / failed)", `${m.programs} (${m.programs_completed} / ${m.programs_failed})`],
        ["Tree grower groups", fmt(m.groups)],
        ["Visits (accepted / total)", `${m.visits_accepted} / ${m.visits_total}`],
        ["Visits not linked to a program", fmt(m.visits_unlinked)],
      ],
      sections: [
        {
          title: "Programs and tree grower groups",
          columns: ["Ref", "Program", "Group", "Type", "Contact", "Participants", "Status", "Orientation", "Closed", "Released", "Planted", "Survival", "Visits"],
          rows: data.programs.map((p) => [
            p.ref, p.title, p.group_name, p.group_type ?? "—", p.group_contact ?? p.group_email ?? "—", p.participants,
            p.status_label, fmtDate(p.orientation_date), fmtDate(p.closed_date), fmt(p.seedlings_released),
            fmt(p.planted), fmtPct(p.survival_rate), `${p.visits}/${p.reports_total}`,
          ]),
        },
        {
          title: "Planted area over time",
          columns: ["Date", "Visit", "Program", "Planted area", "Report status", "GIS review"],
          rows: data.polygon_history.map((p) => [
            fmtDate(p.date), p.visit_type, p.program ?? "Not linked", p.planted_hectares !== null ? `${p.planted_hectares} ha` : "—",
            p.status, p.gis_review,
          ]),
        },
        {
          title: "Monitoring visits",
          columns: ["Date", "Type", "Status", "Program", "Group", "Inspector", "Planted", "Added", "Dead", "Planted area"],
          rows: data.visits.map((v) => [
            fmtDate(v.date), v.visit_type, v.status, v.program ?? "Not linked", v.group_name ?? "—", v.inspector,
            v.planted, v.added, v.dead, v.planted_hectares !== null ? `${v.planted_hectares} ha` : "—",
          ]),
        },
        {
          title: "Field assessments",
          columns: ["Date", "Assessment", "Inspector", "Layers", "Photos", "Land classification"],
          rows: (data.assessments ?? []).map((a) => [
            fmtDate(a.date), a.title, a.inspector, a.layers.join(", ") || "—", a.photos, a.land_classification ?? "—",
          ]),
        },
      ],
      recordsTitle: "Timeline",
      columns: [
        { header: "Date", value: (e) => fmtDate(e.date) },
        { header: "Type", value: (e) => KIND_LABEL[e.kind] ?? e.kind },
        { header: "Event", value: (e) => e.title },
        { header: "Details", value: (e) => e.detail },
      ],
      rows: data.timeline,
    });
  };

  const m = data?.metrics;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div className="w-full max-w-5xl h-full bg-[#f6faf7] shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-gradient-to-r from-[#0b3622] to-[#0F4A2F] text-white px-6 py-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-emerald-300 font-semibold">Site history</p>
              <h2 className="text-xl font-bold truncate">{data?.site.name ?? "Loading…"}</h2>
              {data && (
                <p className="text-xs text-white/60 mt-0.5 flex items-center gap-1">
                  <MapPin size={12} /> {data.site.barangay ?? "—"} · {data.site.reforestation_area ?? "—"} · Created{" "}
                  {fmtDate(data.site.created_at)}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
              {sitePageUrl && (
                <button
                  onClick={() => navigate(sitePageUrl)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white text-[#0F4A2F] text-xs font-bold hover:bg-emerald-50"
                >
                  <ExternalLink size={14} /> Open site page
                </button>
              )}
              {monitoringUrl && (
                <button
                  onClick={() => navigate(monitoringUrl)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold"
                >
                  <MonitorDot size={14} /> Monitoring
                </button>
              )}
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
          {data && (
            <div className="flex flex-wrap gap-2 mt-4 text-[11px]">
              <span className="px-2 py-1 rounded-full bg-white/10">{data.site.monitoring_label}</span>
              <span className="px-2 py-1 rounded-full bg-white/10">Approval: {data.site.approval_status}</span>
              {data.site.official && <span className="px-2 py-1 rounded-full bg-emerald-400/20 text-emerald-200">Official site</span>}
              {data.site.land_classification && (
                <span className="px-2 py-1 rounded-full bg-white/10">{data.site.land_classification}</span>
              )}
              {data.site.verified_by && (
                <span className="px-2 py-1 rounded-full bg-white/10">
                  Verified by {data.site.verified_by} · {fmtDate(data.site.verified_at)}
                </span>
              )}
            </div>
          )}
        </div>

        {error ? (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState text={error} />
          </div>
        ) : !data || !m ? (
          <div className="flex-1 flex justify-center items-center">
            <Loader2 size={32} className="animate-spin text-[#0F4A2F]" />
          </div>
        ) : (
          <>
            {/* Metric strip */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 px-6 pt-4">
              <Metric
                icon={<Ruler size={12} />}
                label="Site area"
                value={fmtHa(m.site_hectares)}
                sub={m.site_hectares <= 0 ? <span className="text-red-500">No boundary drawn</span> : "From site boundary"}
              />
              <Metric
                icon={<MapPinned size={12} />}
                label="Planted area"
                value={m.planted_hectares !== null ? fmtHa(Number(m.planted_hectares.toFixed(2))) : "—"}
                sub={
                  m.coverage_pct !== null ? (
                    <span className={m.coverage_pct > 100 ? "text-red-500 font-semibold" : ""}>{m.coverage_pct}% of site</span>
                  ) : (
                    `${data.polygon_history.length} polygon(s) recorded`
                  )
                }
              />
              <Metric
                icon={<Sprout size={12} />}
                label="Plants"
                value={fmt(m.plants_planted)}
                sub={`${fmt(m.plants_alive)} alive · ${fmt(m.plants_dead)} dead`}
              />
              <Metric
                icon={<Activity size={12} />}
                label="Survival"
                value={fmtPct(m.survival_rate)}
                valueColor={rateColor(m.survival_rate)}
                sub={`${fmt(m.seedlings_released)} seedlings released`}
              />
              <Metric
                icon={<Users size={12} />}
                label="Programs"
                value={fmt(m.programs)}
                sub={`${m.groups} group(s) · ${m.programs_completed} done · ${m.programs_failed} failed`}
              />
              <Metric
                icon={<ClipboardList size={12} />}
                label="Visits"
                value={`${m.visits_accepted}/${m.visits_total}`}
                sub={
                  m.visits_unlinked > 0 ? (
                    <span className="text-amber-600">{m.visits_unlinked} not linked to a program</span>
                  ) : m.days_since_visit !== null ? (
                    `Last visit ${m.days_since_visit}d ago`
                  ) : (
                    "No visits yet"
                  )
                }
              />
            </div>

            {/* Tabs */}
            <div className="flex gap-1 px-6 pt-4 flex-wrap">
              {(
                [
                  ["overview", "Overview"],
                  ["timeline", `Timeline (${data.timeline.length})`],
                  ["programs", `Programs & Growers (${data.programs.length})`],
                  ["visits", `Visits (${data.visits.length})`],
                  ["assessments", `Assessments (${data.assessments?.length ?? 0})`],
                ] as [Tab, string][]
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

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {tab === "overview" && (
                <>
                  <SectionCard
                    title="Planted Area on the Map"
                    sub="Site boundary (dashed white) with every planted-area polygon submitted from the field. Pick a date to highlight it."
                  >
                    <SiteHistoryMap
                      sitePolygon={data.site.polygon}
                      snapshots={data.polygon_history}
                      selectedId={selectedPolygon}
                      height={340}
                    />
                    {data.polygon_history.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {data.polygon_history.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => setSelectedPolygon(p.id)}
                            className={`text-left px-2.5 py-1.5 rounded-lg border text-[11px] transition-colors ${
                              selectedPolygon === p.id
                                ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                                : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                            }`}
                          >
                            <span className="font-semibold">{fmtDate(p.date)}</span> ·{" "}
                            {p.planted_hectares !== null ? `${p.planted_hectares.toFixed(2)} ha` : "—"}
                            <span className={`ml-1 ${p.status === "accepted" ? "text-emerald-600" : p.status === "rejected" ? "text-red-500" : "text-amber-600"}`}>
                              ({p.status})
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </SectionCard>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <SectionCard title="Planted Area Over Time" sub="Area of each submitted polygon vs the site area">
                      {areaChart.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                          <ComposedChart data={areaChart}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" vertical={false} />
                            <XAxis dataKey="label" tick={{ ...AXIS_TICK, fontSize: 10 }} axisLine={false} tickLine={false} />
                            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} unit=" ha" />
                            <Tooltip content={<GreenTooltip />} />
                            {m.site_hectares > 0 && (
                              <ReferenceLine
                                y={m.site_hectares}
                                stroke="#6366f1"
                                strokeDasharray="4 4"
                                label={{ value: "Site area", position: "insideTopRight", fontSize: 10, fill: "#6366f1" }}
                              />
                            )}
                            <Bar dataKey="hectares" name="Planted (ha)" fill="#34d399" radius={[4, 4, 0, 0]} barSize={26} />
                            <Line type="monotone" dataKey="hectares" name="Trend" stroke="#047857" strokeWidth={2} dot={false} legendType="none" />
                          </ComposedChart>
                        </ResponsiveContainer>
                      ) : (
                        <EmptyState text="No planted-area polygons yet" className="py-16" />
                      )}
                    </SectionCard>

                    <SectionCard title="Plants and Survival Over Time" sub="Running totals after each accepted visit">
                      {data.progress_trend.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                          <ComposedChart data={data.progress_trend}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" vertical={false} />
                            <XAxis dataKey="label" tick={{ ...AXIS_TICK, fontSize: 10 }} axisLine={false} tickLine={false} />
                            <YAxis yAxisId="n" allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                            <YAxis yAxisId="pct" orientation="right" domain={[0, 100]} unit="%" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                            <Tooltip content={<GreenTooltip />} />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                            <Bar yAxisId="n" dataKey="planted" name="Planted" fill="#bbf7d0" radius={[4, 4, 0, 0]} barSize={18} />
                            <Bar yAxisId="n" dataKey="alive" name="Alive" fill="#10b981" radius={[4, 4, 0, 0]} barSize={18} />
                            <Line yAxisId="pct" type="monotone" dataKey="survival_rate" name="Survival %" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 3 }} />
                          </ComposedChart>
                        </ResponsiveContainer>
                      ) : (
                        <EmptyState text="No accepted visits yet" className="py-16" />
                      )}
                    </SectionCard>
                  </div>

                  {data.timeline.length > 0 && (
                    <SectionCard
                      title="Latest Activity"
                      right={
                        <button onClick={() => setTab("timeline")} className="text-[11px] font-semibold text-emerald-700 hover:underline">
                          Full timeline →
                        </button>
                      }
                    >
                      <div className="flex flex-col gap-2">
                        {data.timeline.slice(0, 5).map((e, i) => {
                          const st = TONE_STYLE[e.tone] ?? TONE_STYLE.info;
                          return (
                            <div key={i} className="flex items-start gap-2.5">
                              <span className={`mt-0.5 w-5 h-5 rounded-full ${st.dot} text-white flex items-center justify-center shrink-0`}>
                                {st.icon}
                              </span>
                              <div className="min-w-0">
                                <p className="text-[12.5px] font-semibold text-gray-800">{e.title}</p>
                                <p className="text-[11px] text-gray-400">
                                  {fmtDate(e.date)}
                                  {e.detail ? ` · ${e.detail}` : ""}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </SectionCard>
                  )}
                </>
              )}

              {tab === "timeline" &&
                (data.timeline.length === 0 ? (
                  <EmptyState text="No history recorded yet" />
                ) : (
                  <div className="bg-white rounded-xl border border-gray-100 p-5">
                    <ol className="relative border-l-2 border-emerald-100 ml-2">
                      {data.timeline.map((e, i) => {
                        const st = TONE_STYLE[e.tone] ?? TONE_STYLE.info;
                        return (
                          <li key={i} className="ml-5 pb-5 last:pb-0">
                            <span
                              className={`absolute -left-[9px] mt-1 w-4 h-4 rounded-full ${st.dot} text-white flex items-center justify-center ring-4 ring-white`}
                            >
                              {st.icon}
                            </span>
                            <div className="flex items-center gap-2">
                              <p className="text-[11px] text-gray-400 font-medium">{fmtDate(e.date)}</p>
                              <span className="text-[9.5px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                                {KIND_LABEL[e.kind] ?? e.kind}
                              </span>
                            </div>
                            <p className="text-[13px] font-semibold text-gray-800">{e.title}</p>
                            {e.detail && <p className="text-[12px] text-gray-500 mt-0.5">{e.detail}</p>}
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                ))}

              {tab === "programs" &&
                (data.programs.length === 0 ? (
                  <EmptyState text="No tree grower group has taken this site yet" />
                ) : (
                  data.programs.map((p) => (
                    <div key={p.ref} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                      <div className="flex items-start justify-between gap-3 p-4 border-b border-gray-50">
                        <div className="min-w-0">
                          <p className="text-[11px] text-gray-400 font-semibold">
                            {p.ref} · {p.classification}
                          </p>
                          <p className="text-[15px] font-bold text-gray-800 truncate">{p.title}</p>
                        </div>
                        <Badge label={p.status_label} tone={PROGRAM_TONE[p.status] ?? PROGRAM_TONE.cancelled} />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
                        {/* Group */}
                        <div className="p-4 md:border-r border-gray-50 bg-emerald-50/30">
                          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Tree grower group</p>
                          <p className="text-[13.5px] font-bold text-gray-800 flex items-center gap-1.5">
                            <Users size={14} className="text-emerald-600" /> {p.group_name}
                          </p>
                          <p className="text-[11.5px] text-gray-500">
                            {p.group_type ?? "—"} · {p.participants} participants
                          </p>
                          {p.group_contact && (
                            <p className="text-[11.5px] text-gray-600 flex items-center gap-1.5 mt-1.5">
                              <Phone size={11} /> {p.group_contact}
                            </p>
                          )}
                          {p.group_email && (
                            <p className="text-[11.5px] text-gray-600 flex items-center gap-1.5 break-all">
                              <Mail size={11} /> {p.group_email}
                            </p>
                          )}
                          {p.group_address && (
                            <p className="text-[11.5px] text-gray-600 flex items-start gap-1.5">
                              <MapPin size={11} className="mt-0.5" /> {p.group_address}
                            </p>
                          )}
                        </div>
                        {/* Dates */}
                        <div className="p-4 md:border-r border-gray-50 grid grid-cols-2 gap-x-3 gap-y-2 text-[11.5px] content-start">
                          <div>
                            <p className="text-gray-400">Submitted</p>
                            <p className="font-semibold text-gray-700">{fmtDate(p.submitted)}</p>
                          </div>
                          <div>
                            <p className="text-gray-400">Orientation</p>
                            <p className="font-semibold text-gray-700">{fmtDate(p.orientation_date)}</p>
                          </div>
                          <div>
                            <p className="text-gray-400">Closed</p>
                            <p className="font-semibold text-gray-700">{fmtDate(p.closed_date)}</p>
                          </div>
                          <div>
                            <p className="text-gray-400">Duration</p>
                            <p className="font-semibold text-gray-700">{p.duration_days !== null ? `${p.duration_days} days` : "—"}</p>
                          </div>
                          <div className="col-span-2">
                            <p className="text-gray-400">Reports linked to this program</p>
                            <p className="font-semibold text-gray-700">
                              {p.visits} accepted of {p.reports_total} submitted
                            </p>
                          </div>
                        </div>
                        {/* Results */}
                        <div className="p-4 text-[11.5px]">
                          <div className="grid grid-cols-3 gap-2 mb-3">
                            <div>
                              <p className="text-gray-400">Released</p>
                              <p className="font-bold text-gray-800">{fmt(p.seedlings_released)}</p>
                            </div>
                            <div>
                              <p className="text-gray-400">Planted</p>
                              <p className="font-bold text-gray-800">{fmt(p.planted)}</p>
                            </div>
                            <div>
                              <p className="text-gray-400">Dead</p>
                              <p className="font-bold text-red-500">{fmt(p.dead)}</p>
                            </div>
                          </div>
                          <p className="text-gray-400 mb-1">Survival</p>
                          <RateBar rate={p.survival_rate} />
                        </div>
                      </div>
                      {p.closure_note && (
                        <p className="px-4 py-2.5 bg-gray-50 text-[11.5px] text-gray-600 border-t border-gray-100">
                          <span className="font-semibold">Closure note:</span> {p.closure_note}
                        </p>
                      )}
                    </div>
                  ))
                ))}

              {tab === "visits" &&
                (data.visits.length === 0 ? (
                  <EmptyState text="No visits recorded yet" />
                ) : (
                  <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
                    {m.visits_unlinked > 0 && (
                      <p className="px-4 py-2.5 text-[11.5px] text-amber-700 bg-amber-50 border-b border-amber-100 flex items-center gap-1.5">
                        <Link2Off size={13} /> {m.visits_unlinked} visit(s) are not linked to any program — they count toward site totals
                        but not to a tree grower group.
                      </p>
                    )}
                    <table className="min-w-full text-[12px]">
                      <thead className="bg-gray-50 text-gray-500 text-[10.5px] uppercase tracking-wider">
                        <tr>
                          <th className="text-left px-3 py-2">Date</th>
                          <th className="text-left px-3 py-2">Type</th>
                          <th className="text-left px-3 py-2">Program</th>
                          <th className="text-left px-3 py-2">Status</th>
                          <th className="text-left px-3 py-2">Inspector</th>
                          <th className="text-right px-3 py-2">Planted</th>
                          <th className="text-right px-3 py-2">Added</th>
                          <th className="text-right px-3 py-2">Dead</th>
                          <th className="text-right px-3 py-2">Polygon</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {data.visits.map((v) => (
                          <tr key={v.id} className="align-top">
                            <td className="px-3 py-2 whitespace-nowrap">{fmtDate(v.date)}</td>
                            <td className="px-3 py-2">{v.visit_type}</td>
                            <td className="px-3 py-2">
                              {v.linked ? (
                                <>
                                  <p className="flex items-center gap-1 text-emerald-700 font-semibold">
                                    <Link2 size={11} /> {v.program}
                                  </p>
                                  <p className="text-[10.5px] text-gray-400">{v.group_name}</p>
                                </>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                                  <Link2Off size={10} /> Not linked
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <Badge
                                label={v.status.charAt(0).toUpperCase() + v.status.slice(1)}
                                tone={VISIT_TONE[v.status] ?? VISIT_TONE.pending}
                              />
                              <p className="text-[10px] text-gray-400 mt-0.5 whitespace-nowrap">
                                DM {v.dm_review} · GIS {v.gis_review}
                              </p>
                            </td>
                            <td className="px-3 py-2">{v.inspector}</td>
                            <td className="px-3 py-2 text-right">{fmt(v.planted)}</td>
                            <td className="px-3 py-2 text-right">{fmt(v.added)}</td>
                            <td className="px-3 py-2 text-right text-red-500">{fmt(v.dead)}</td>
                            <td className="px-3 py-2 text-right whitespace-nowrap">
                              {v.planted_hectares !== null ? (
                                <button
                                  onClick={() => {
                                    setSelectedPolygon(v.id);
                                    setTab("overview");
                                  }}
                                  className="text-emerald-700 font-semibold hover:underline"
                                  title="Show on map"
                                >
                                  {v.planted_hectares.toFixed(2)} ha
                                </button>
                              ) : (
                                "—"
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}

              {tab === "assessments" &&
                ((data.assessments ?? []).length === 0 ? (
                  <EmptyState text="No field assessments linked to this site" />
                ) : (
                  (data.assessments ?? []).map((a) => (
                    <div key={a.id} className="bg-white rounded-xl border border-gray-100 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[13.5px] font-bold text-gray-800 truncate">{a.title}</p>
                          <p className="text-[12px] text-gray-500">
                            {fmtDate(a.date)} · {a.inspector}
                          </p>
                        </div>
                        <span className="text-[11px] text-gray-500 shrink-0">{a.photos} photos</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {a.layers.length > 0 ? (
                          a.layers.map((l) => (
                            <span key={l} className="text-[10.5px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700">
                              {l}
                            </span>
                          ))
                        ) : (
                          <span className="text-[11px] text-gray-400">No layers recorded</span>
                        )}
                        {a.land_classification && (
                          <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700">
                            {a.land_classification}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
