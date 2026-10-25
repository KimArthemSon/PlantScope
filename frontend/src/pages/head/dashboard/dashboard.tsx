import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Gavel,
  History,
  Layers,
  Loader2,
  MapPin,
  Package,
  RefreshCw,
  TrendingUp,
  Trophy,
  Users,
  XCircle,
} from "lucide-react";
import NotFoundPage from "../../../components/layout/NotFoundPage";
import { api } from "@/constant/api.ts";
import SiteHistoryModal from "../../dataManager/reports/SiteHistoryModal";
import {
  AXIS_TICK,
  Badge,
  EmptyState,
  GreenTooltip,
  RateBar,
  fmt,
  fmtDate,
  fmtHa,
  fmtPct,
  rateColor,
} from "../../dataManager/reports/reportUi";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Kpis {
  pending_approvals: number;
  oldest_approval_days: number | null;
  pending_closures: number;
  oldest_closure_days: number | null;
  active_programs: number;
  awaiting_orientation: number;
  completed_programs: number;
  failed_programs: number;
  rejected_cancelled: number;
  success_rate: number | null;
  total_applications: number;
  groups: number;
  groups_active: number;
  groups_new_month: number;
  official_sites: number;
  official_hectares: number;
  available_sites: number;
  planted_hectares: number;
  plants_planted: number;
  plants_alive: number;
  plants_dead: number;
  survival_rate: number;
  survival_target: number;
  seedlings_released: number;
  reforestation_areas: number;
}

interface TrendPoint {
  month: string;
  submitted: number;
  approved: number;
  completed: number;
  failed: number;
  planted_hectares: number;
  plants: number;
  alive: number;
  dead: number;
  new_plants: number;
  new_dead: number;
  new_sites: number;
  sites_planted: number;
  visits: number;
  survival_rate: number | null;
}

interface SiteUptakeData {
  total: number;
  hectares: number;
  breakdown: { key: string; name: string; value: number; hectares: number; fill: string }[];
  rows: {
    site_id: number;
    name: string;
    barangay: string | null;
    hectares: number;
    category: "taken_now" | "taken_before" | "no_history";
    group_name: string | null;
    program_status: string | null;
    programs_before: number;
    groups_before: number;
    last_closed: string | null;
  }[];
}

interface HeadDashboard {
  executive: {
    kpis: Kpis;
    lifecycle: { key: string; name: string; value: number; fill: string }[];
    trend: TrendPoint[];
    offices: { office: string; backlog: number; items: { label: string; value: number; total?: number; good?: boolean }[] }[];
    recent_activity: { tone: string; ref: string; action: string; detail: string | null; actor: string; role: string; time: string }[];
    site_uptake: SiteUptakeData;
  };
  approvals: {
    pending_approvals: {
      application_id: number;
      ref: string;
      title: string;
      group_name: string;
      group_type: string | null;
      classification: string;
      participants: number;
      site_id: number | null;
      site_name: string | null;
      barangay: string | null;
      site_hectares: number | null;
      site_verified: boolean;
      land_classification: string | null;
      orientation_date: string | null;
      previous_programs: number;
      previous_completed: number;
      previous_failed: number;
      days_waiting: number;
      submitted: string;
    }[];
    pending_closures: {
      id: number;
      ref: string;
      title: string;
      group_name: string;
      site_id: number | null;
      site_name: string | null;
      barangay: string | null;
      recommendation: string;
      recommendation_key: string;
      reason: string;
      requested_by: string;
      days_waiting: number;
      planted: number;
      survival_rate: number | null;
      visits: number;
    }[];
  };
  performance: {
    summary: {
      survival_rate: number;
      survival_target: number;
      plants_planted: number;
      plants_alive: number;
      planted_hectares: number;
      visits_last_30_days: number;
      overdue_sites: number;
      success_rate: number | null;
      avg_completed_days: number | null;
    };
    trend: TrendPoint[];
    species: { name: string; planted: number; survived: number; dead: number; rate: number }[];
    active_programs: {
      ref: string;
      title: string;
      group_name: string;
      site_id: number | null;
      site_name: string | null;
      barangay: string | null;
      status_label: string;
      orientation_date: string | null;
      released: number;
      planted: number;
      survival_rate: number | null;
      visits: number;
      days_since_visit: number | null;
      overdue: boolean;
    }[];
    program_outcomes: {
      ref: string;
      title: string;
      group_name: string;
      site_id: number | null;
      site_name: string | null;
      barangay: string | null;
      status: string;
      status_label: string;
      closed: string | null;
      duration_days: number | null;
      planted: number;
      survival_rate: number | null;
    }[];
    attention_sites: { site_id: number; name: string; barangay: string; rate: number; reason?: string; overdue: boolean; no_visit: boolean }[];
  };
  growers: {
    summary: {
      total: number;
      active: number;
      new_this_month: number;
      excellent: number;
      needs_attention: number;
      non_compliant: number;
      compliant_days: number;
    };
    rows: {
      group_name: string;
      group_type: string;
      contact: string;
      joined: string | null;
      programs: number;
      active: number;
      completed: number;
      failed: number;
      current_site: string | null;
      seedlings_released: number;
      planted: number;
      alive: number;
      survival_rate: number | null;
      visits: number;
      days_since_visit: number | null;
      compliance: string;
      standing: string;
    }[];
  };
  coverage: {
    summary: { barangays: number; areas: number; official_hectares: number; planted_hectares: number };
    rows: {
      name: string;
      areas: number;
      sites: number;
      official_sites: number;
      official_hectares: number;
      planted_hectares: number;
      active_programs: number;
      completed: number;
      failed: number;
      planted: number;
      dead: number;
      survival_rate: number | null;
    }[];
    land_classification: { name: string; sites: number; hectares: number }[];
  };
}

// ─── Constants ──────────────────────────────────────────────────────────────

const TABS = [
  { id: "overview", label: "Executive Overview", icon: <Activity size={15} /> },
  { id: "approvals", label: "My Decisions", icon: <Gavel size={15} /> },
  { id: "performance", label: "Program Performance", icon: <TrendingUp size={15} /> },
  { id: "growers", label: "Tree Growers", icon: <Users size={15} /> },
  { id: "coverage", label: "Barangay Coverage", icon: <MapPin size={15} /> },
] as const;
type TabId = (typeof TABS)[number]["id"];

const ACT_STYLE: Record<string, { bg: string; icon: ReactNode }> = {
  success: { bg: "bg-emerald-50 text-emerald-700", icon: <CheckCircle2 size={12} /> },
  warning: { bg: "bg-amber-50 text-amber-700", icon: <Clock size={12} /> },
  info: { bg: "bg-sky-50 text-sky-700", icon: <Activity size={12} /> },
  danger: { bg: "bg-red-50 text-red-700", icon: <XCircle size={12} /> },
};

const STANDING_TONE: Record<string, string> = {
  Excellent: "bg-green-50 text-green-700 border-green-200",
  Good: "bg-sky-50 text-sky-700 border-sky-200",
  "Needs attention": "bg-red-50 text-red-700 border-red-200",
  New: "bg-gray-50 text-gray-600 border-gray-200",
};
const COMPLIANCE_TONE: Record<string, string> = {
  Compliant: "text-emerald-600",
  Warning: "text-amber-600",
  "Non-Compliant": "text-red-600",
  "No active program": "text-gray-400",
};
const OUTCOME_TONE: Record<string, string> = {
  completed: "bg-green-50 text-green-700 border-green-200",
  failed: "bg-red-50 text-red-700 border-red-200",
};

// ─── Small components ───────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  sub,
  accent,
  delay,
  valueColor,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accent: string;
  delay: string;
  valueColor?: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden rounded-2xl p-5 border border-white/60 bg-white shadow-[0_2px_20px_rgba(5,120,0,0.06)]
        hover:shadow-[0_8px_32px_rgba(5,120,0,0.14)] transition-all duration-300 hover:-translate-y-0.5 animate-fadeUp ${onClick ? "cursor-pointer" : ""}`}
      style={{ animationDelay: delay }}
    >
      <div className={`absolute top-0 left-0 right-0 h-0.5 ${accent}`} />
      <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#057501]/[0.08] mb-3">
        <span className="text-[#057501]">{icon}</span>
      </div>
      <p className="text-[13px] text-gray-500 font-medium mb-0.5">{label}</p>
      <p className="dash-title text-[26px] font-bold text-gray-800 leading-none" style={valueColor ? { color: valueColor } : undefined}>
        {value}
      </p>
      {sub && <p className="text-[11.5px] text-gray-400 mt-1.5">{sub}</p>}
    </div>
  );
}

function Card({ children, className = "", delay = "0s" }: { children: ReactNode; className?: string; delay?: string }) {
  return (
    <div
      className={`bg-white rounded-2xl border border-gray-100 p-6 shadow-[0_2px_20px_rgba(5,120,0,0.05)] animate-fadeUp ${className}`}
      style={{ animationDelay: delay }}
    >
      {children}
    </div>
  );
}

function SectionHeader({
  title,
  sub,
  badge,
  action,
}: {
  title: string;
  sub?: string;
  badge?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex items-start justify-between gap-3 mb-5">
      <div>
        <h2 className="dash-title text-[16px] font-bold text-gray-800">{title}</h2>
        {sub && <p className="text-[12px] text-gray-400 mt-0.5">{sub}</p>}
      </div>
      {badge && (
        <span className="bg-emerald-50 text-emerald-700 text-[11px] font-semibold px-3 py-1 rounded-full border border-emerald-200 shrink-0">
          {badge}
        </span>
      )}
      {action && (
        <button onClick={action.onClick} className="flex items-center gap-1 text-[11.5px] font-semibold text-emerald-700 hover:text-emerald-900 shrink-0">
          {action.label} <ArrowRight size={12} />
        </button>
      )}
    </div>
  );
}

function Tile({ label, value, sub, tone = "text-gray-800" }: { label: string; value: ReactNode; sub?: ReactNode; tone?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <p className="text-[10.5px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
      <p className={`dash-title text-[24px] font-bold leading-tight ${tone}`}>{value}</p>
      {sub && <p className="text-[11px] text-gray-400">{sub}</p>}
    </div>
  );
}

// ─── REFORESTATION HEALTH (trendlines) ──────────────────────────────────────

/**
 * Adds a straight least-squares trendline for `key` as `${key}_trend`.
 * The fit starts at the first month with planting data, so empty months
 * before the first program don't drag the line down.
 */
function withTrend<T extends Record<string, any>>(rows: T[], key: keyof T & string) {
  const start = rows.findIndex((r) => (r.plants ?? 0) > 0 || (r[key] ?? 0) > 0);
  const pts = rows
    .map((r, i) => ({ x: i, y: r[key] }))
    .filter((p) => start >= 0 && p.x >= start && p.y !== null && p.y !== undefined) as { x: number; y: number }[];
  if (pts.length < 2) return { rows: rows.map((r) => ({ ...r, [`${key}_trend`]: null })), slope: null as number | null };
  const n = pts.length;
  const sx = pts.reduce((a, p) => a + p.x, 0);
  const sy = pts.reduce((a, p) => a + p.y, 0);
  const sxy = pts.reduce((a, p) => a + p.x * p.y, 0);
  const sxx = pts.reduce((a, p) => a + p.x * p.x, 0);
  const denom = n * sxx - sx * sx;
  const slope = denom === 0 ? 0 : (n * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / n;
  return {
    rows: rows.map((r, i) => ({
      ...r,
      [`${key}_trend`]: i >= start ? Math.round((slope * i + intercept) * 100) / 100 : null,
    })),
    slope,
  };
}

/** Value `months` back from the latest month that has data. */
function valueAgo(rows: TrendPoint[], key: keyof TrendPoint, months: number) {
  const withData = rows.filter((r) => r[key] !== null && r[key] !== undefined && (r.plants > 0 || key !== "survival_rate"));
  if (withData.length === 0) return { latest: null as number | null, previous: null as number | null };
  const latest = withData[withData.length - 1][key] as number;
  const idx = rows.indexOf(withData[withData.length - 1]) - months;
  const prev = idx >= 0 ? (rows[idx][key] as number | null) : null;
  return { latest, previous: prev };
}

function ReforestationHealth({ trend }: { trend: TrendPoint[] }) {
  const area = withTrend(trend, "planted_hectares");
  const survival = withTrend(area.rows, "survival_rate");
  const rows = survival.rows as unknown as (TrendPoint & { planted_hectares_trend: number | null; survival_rate_trend: number | null })[];
  const last = trend[trend.length - 1];
  const hasData = trend.some((t) => t.plants > 0 || t.planted_hectares > 0);

  const surv = valueAgo(trend, "survival_rate", 3);
  const ha = valueAgo(trend, "planted_hectares", 3);
  const survDelta = surv.latest !== null && surv.previous !== null ? Math.round((surv.latest - surv.previous) * 10) / 10 : null;
  const haDelta = ha.latest !== null ? Math.round((ha.latest - (ha.previous ?? 0)) * 100) / 100 : null;
  const direction =
    survival.slope === null ? "stable" : survival.slope > 0.5 ? "improving" : survival.slope < -0.5 ? "declining" : "stable";
  const mortalityThisMonth = last && last.new_plants > 0 ? Math.round((last.new_dead / last.new_plants) * 1000) / 10 : null;

  let verdict: { label: string; tone: string; text: string };
  if (!hasData) {
    verdict = { label: "No data yet", tone: "bg-gray-100 text-gray-600", text: "No accepted monitoring visits yet." };
  } else if (direction !== "declining") {
    verdict = {
      label: "Going well",
      tone: "bg-emerald-100 text-emerald-800",
      text: `Survival is ${surv.latest}% and ${direction === "improving" ? "improving" : "holding steady"}.`,
    };
  } else {
    verdict = {
      label: "Watch closely",
      tone: "bg-amber-100 text-amber-800",
      text: `Survival is ${surv.latest}% and trending down. Check the sites needing attention.`,
    };
  }

  const indicators = [
    {
      label: "Total area planted",
      value: fmtHa(last?.planted_hectares ?? 0),
      sub: haDelta !== null ? `${haDelta >= 0 ? "+" : ""}${haDelta} ha in the last 3 months` : "—",
      tone: "text-gray-800",
    },
    {
      label: "Plants alive / planted",
      value: `${fmt(last?.alive)} / ${fmt(last?.plants)}`,
      sub: `${fmt(last?.dead)} dead`,
      tone: "text-gray-800",
    },
    {
      label: "Survival rate",
      value: surv.latest !== null ? `${surv.latest}%` : "—",
      sub:
        survDelta !== null
          ? `${survDelta >= 0 ? "▲ +" : "▼ "}${survDelta} pts vs 3 months ago`
          : `Trend: ${direction}`,
      tone: direction === "declining" ? "text-red-500" : "text-emerald-600",
    },
    {
      label: "This month",
      value: `+${fmt(last?.new_plants)} plants`,
      sub:
        last && last.new_plants > 0
          ? `${fmt(last.new_dead)} died (${mortalityThisMonth}% of new) · ${last.visits} visits`
          : `${fmt(last?.new_dead ?? 0)} deaths recorded · ${last?.visits ?? 0} visits`,
      tone: "text-gray-800",
    },
  ];

  return (
    <Card delay="0.34s">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h2 className="dash-title text-[16px] font-bold text-gray-800">Reforestation Health</h2>
          <p className="text-[12px] text-gray-400 mt-0.5">
            Is reforestation going well? Planted area, plant survival and their trendlines over the last 12 months
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[12px] font-bold px-3 py-1.5 rounded-full ${verdict.tone}`}>{verdict.label}</span>
        </div>
      </div>
      <p className="text-[12.5px] text-gray-600 -mt-2 mb-4">{verdict.text}</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {indicators.map((i) => (
          <div key={i.label} className="bg-gray-50 rounded-xl p-3">
            <p className="text-[10.5px] font-semibold uppercase tracking-wider text-gray-400">{i.label}</p>
            <p className={`dash-title text-[22px] font-bold leading-tight ${i.tone}`}>{i.value}</p>
            <p className="text-[11px] text-gray-500">{i.sub}</p>
          </div>
        ))}
      </div>

      {hasData ? (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <div>
            <p className="text-[12.5px] font-semibold text-gray-700 mb-1">Total Area Planted</p>
            <p className="text-[11px] text-gray-400 mb-2">Cumulative hectares (latest planted polygon per site) with trendline</p>
            <ResponsiveContainer width="100%" height={230}>
              <ComposedChart data={rows}>
                <defs>
                  <linearGradient id="haGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" vertical={false} />
                <XAxis dataKey="month" tick={{ ...AXIS_TICK, fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis yAxisId="ha" tick={AXIS_TICK} axisLine={false} tickLine={false} unit=" ha" />
                <YAxis yAxisId="n" orientation="right" allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} hide />
                <Tooltip content={<GreenTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="n" dataKey="new_sites" name="New sites planted" fill="#c7d2fe" radius={[3, 3, 0, 0]} barSize={10} />
                <Area yAxisId="ha" type="monotone" dataKey="planted_hectares" name="Area planted (ha)" stroke="#059669" strokeWidth={2.5} fill="url(#haGrad)" />
                <Line yAxisId="ha" type="linear" dataKey="planted_hectares_trend" name="Trendline" stroke="#0F4A2F" strokeWidth={1.5} strokeDasharray="6 4" dot={false} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div>
            <p className="text-[12.5px] font-semibold text-gray-700 mb-1">Plants Planted, Alive & Dead</p>
            <p className="text-[11px] text-gray-400 mb-2">Running totals, with new plants added each month</p>
            <ResponsiveContainer width="100%" height={230}>
              <ComposedChart data={rows}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" vertical={false} />
                <XAxis dataKey="month" tick={{ ...AXIS_TICK, fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <Tooltip content={<GreenTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="new_plants" name="New this month" fill="#d1fae5" radius={[3, 3, 0, 0]} barSize={12} />
                <Line type="monotone" dataKey="plants" name="Planted" stroke="#64748b" strokeWidth={2} dot={{ r: 2.5 }} />
                <Line type="monotone" dataKey="alive" name="Alive" stroke="#10b981" strokeWidth={2.5} dot={{ r: 2.5 }} />
                <Line type="monotone" dataKey="dead" name="Dead" stroke="#ef4444" strokeWidth={2} dot={{ r: 2.5 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div>
            <p className="text-[12.5px] font-semibold text-gray-700 mb-1">Survival Rate</p>
            <p className="text-[11px] text-gray-400 mb-2">
              Running survival with trendline · trend <b className="text-gray-600">{direction}</b>
            </p>
            <ResponsiveContainer width="100%" height={230}>
              <ComposedChart data={rows}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" vertical={false} />
                <XAxis dataKey="month" tick={{ ...AXIS_TICK, fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis domain={[0, 100]} unit="%" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <Tooltip content={<GreenTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="survival_rate" name="Survival %" stroke="#059669" strokeWidth={2.5} connectNulls dot={{ r: 3 }} />
                <Line type="linear" dataKey="survival_rate_trend" name="Trendline" stroke="#0F4A2F" strokeWidth={1.5} strokeDasharray="6 4" dot={false} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <EmptyState text="No planting recorded in the last 12 months" className="py-14" />
      )}
    </Card>
  );
}

// ─── SITE UPTAKE (taken by tree growers vs no history) ──────────────────────

function SiteUptake({ data, onSiteHistory }: { data: SiteUptakeData; onSiteHistory: (id: number) => void }) {
  const [view, setView] = useState<SiteUptakeData["rows"][number]["category"] | "all">("all");
  const rows = data.rows.filter((r) => view === "all" || r.category === view);
  const total = Math.max(1, data.total);

  return (
    <Card className="lg:col-span-2" delay="0.48s">
      <SectionHeader
        title="Site Uptake"
        sub="Official sites taken up by tree grower groups vs sites that have never been taken"
        badge={`${data.total} official sites · ${fmtHa(data.hectares)}`}
      />

      {data.total > 0 ? (
        <>
          {/* Share bar */}
          <div className="flex h-3 w-full rounded-full overflow-hidden bg-gray-100 mb-4">
            {data.breakdown.map((b) =>
              b.value > 0 ? <div key={b.key} style={{ width: `${(b.value / total) * 100}%`, background: b.fill }} title={`${b.name}: ${b.value}`} /> : null,
            )}
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            {data.breakdown.map((b) => (
              <button
                key={b.key}
                onClick={() => setView(view === b.key ? "all" : (b.key as any))}
                className={`text-left rounded-xl border p-3 transition-colors ${
                  view === b.key ? "border-emerald-500 bg-emerald-50/50" : "border-gray-100 bg-gray-50 hover:bg-gray-100"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: b.fill }} />
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{b.name}</p>
                </div>
                <p className="dash-title text-[24px] font-bold text-gray-800 leading-tight">{b.value}</p>
                <p className="text-[11px] text-gray-400">
                  {fmtHa(b.hectares)} · {Math.round((b.value / total) * 100)}%
                </p>
              </button>
            ))}
          </div>
          <p className="text-[11px] text-gray-400 mb-2">
            <b>Taken now</b>: a group currently holds the site (application or active program). <b>Taken before</b>: past
            programs only, free again. <b>No history</b>: never taken by any group.
          </p>

          <div className="overflow-x-auto -mx-2 max-h-[260px] overflow-y-auto">
            <table className="w-full text-left min-w-[520px]">
              <thead className="sticky top-0 bg-white">
                <tr className="text-[10.5px] uppercase tracking-wider text-gray-400 border-b border-gray-100">
                  <th className="px-2 py-2 font-semibold">Site</th>
                  <th className="px-2 py-2 font-semibold">Uptake</th>
                  <th className="px-2 py-2 font-semibold">Tree Grower Group</th>
                  <th className="px-2 py-2 font-semibold text-right">Area</th>
                </tr>
              </thead>
              <tbody>
                {rows.length > 0 ? (
                  rows.map((r) => {
                    const b = data.breakdown.find((x) => x.key === r.category)!;
                    return (
                      <tr key={r.site_id} className="border-b border-gray-50 text-[12.5px] align-top">
                        <td className="px-2 py-2">
                          <button onClick={() => onSiteHistory(r.site_id)} className="text-left hover:underline">
                            <p className="font-semibold text-gray-800 flex items-center gap-1">
                              <History size={11} className="text-emerald-600" /> {r.name}
                            </p>
                            <p className="text-[11px] text-gray-400">{r.barangay ?? "—"}</p>
                          </button>
                        </td>
                        <td className="px-2 py-2">
                          <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-gray-700">
                            <span className="w-2 h-2 rounded-full" style={{ background: b.fill }} /> {b.name}
                          </span>
                        </td>
                        <td className="px-2 py-2">
                          {r.category === "no_history" ? (
                            <span className="text-[11.5px] text-gray-400">Available — never taken</span>
                          ) : (
                            <>
                              <p className="text-gray-800">{r.group_name}</p>
                              <p className="text-[11px] text-gray-400">
                                {r.category === "taken_now"
                                  ? `${r.program_status}${r.programs_before > 0 ? ` · ${r.programs_before} past program(s)` : ""}`
                                  : `${r.program_status} · closed ${fmtDate(r.last_closed)}${r.groups_before > 1 ? ` · ${r.groups_before} groups` : ""}`}
                              </p>
                            </>
                          )}
                        </td>
                        <td className="px-2 py-2 text-right">{fmtHa(r.hectares)}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={4}>
                      <EmptyState text="No sites in this group" className="py-6" />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <EmptyState text="No official sites yet" />
      )}
    </Card>
  );
}

// ─── TAB: EXECUTIVE OVERVIEW ────────────────────────────────────────────────

function TabOverview({
  data,
  goTo,
  onSiteHistory,
}: {
  data: HeadDashboard["executive"];
  goTo: (tab: TabId) => void;
  onSiteHistory: (id: number) => void;
}) {
  const navigate = useNavigate();
  const k = data.kpis;
  const decisions = k.pending_approvals + k.pending_closures;
  const lifecycleMax = Math.max(1, ...data.lifecycle.map((l) => l.value));

  return (
    <div className="space-y-5">
      {/* Decisions banner */}
      <div
        className={`rounded-2xl p-5 border animate-fadeUp flex flex-wrap items-center gap-4 ${
          decisions > 0 ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200"
        }`}
      >
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${decisions > 0 ? "bg-amber-500" : "bg-emerald-500"} text-white`}>
          {decisions > 0 ? <Gavel size={20} /> : <CheckCircle2 size={20} />}
        </div>
        <div className="flex-1 min-w-[200px]">
          <p className={`text-[15px] font-bold ${decisions > 0 ? "text-amber-900" : "text-emerald-900"}`}>
            {decisions > 0 ? `${decisions} decision${decisions > 1 ? "s" : ""} waiting for you` : "No decisions waiting for you"}
          </p>
          <p className={`text-[12px] ${decisions > 0 ? "text-amber-800/80" : "text-emerald-800/80"}`}>
            {k.pending_approvals} application approval{k.pending_approvals !== 1 ? "s" : ""}
            {k.oldest_approval_days !== null ? ` (oldest ${k.oldest_approval_days}d)` : ""} · {k.pending_closures} program closure
            {k.pending_closures !== 1 ? "s" : ""}
            {k.oldest_closure_days !== null ? ` (oldest ${k.oldest_closure_days}d)` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate("/applications")}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-gray-200 text-[12px] font-semibold text-gray-700 hover:bg-gray-50"
          >
            <ClipboardCheck size={14} /> Applications {k.pending_approvals > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 rounded-full">{k.pending_approvals}</span>}
          </button>
          <button
            onClick={() => navigate("/program-closures")}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-gray-200 text-[12px] font-semibold text-gray-700 hover:bg-gray-50"
          >
            <Gavel size={14} /> Closures {k.pending_closures > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 rounded-full">{k.pending_closures}</span>}
          </button>
          {decisions > 0 && (
            <button
              onClick={() => goTo("approvals")}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0F4A2F] text-white text-[12px] font-semibold hover:bg-[#1a6b44]"
            >
              Review details <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Activity size={20} />}
          label="Active Programs"
          value={fmt(k.active_programs)}
          sub={`${k.awaiting_orientation} awaiting orientation · ${k.total_applications} applications all-time`}
          accent="bg-indigo-500"
          delay="0.04s"
        />
        <StatCard
          icon={<Trophy size={20} />}
          label="Program Success Rate"
          value={fmtPct(k.success_rate)}
          sub={`${k.completed_programs} completed · ${k.failed_programs} failed · ${k.rejected_cancelled} rejected/cancelled`}
          accent="bg-green-600"
          delay="0.08s"
        />
        <StatCard
          icon={<Users size={20} />}
          label="Tree Grower Groups"
          value={fmt(k.groups)}
          sub={`${k.groups_active} with an active program · ${k.groups_new_month} new this month`}
          accent="bg-teal-500"
          delay="0.12s"
          onClick={() => goTo("growers")}
        />
        <StatCard
          icon={<Package size={20} />}
          label="Seedlings Released"
          value={fmt(k.seedlings_released)}
          sub="Accepted + confirmed seedling requests"
          accent="bg-teal-600"
          delay="0.16s"
        />
      </div>

      {/* Reforestation health with trendlines */}
      <ReforestationHealth trend={data.trend} />

      {/* Office backlog */}
      <Card delay="0.36s">
        <SectionHeader title="Operations by Office" sub="Work waiting in each office right now" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {data.offices.map((o) => (
            <div key={o.office} className="rounded-xl border border-gray-100 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
                <p className="text-[13px] font-bold text-gray-800 flex items-center gap-2">
                  <Building2 size={14} className="text-emerald-600" /> {o.office}
                </p>
                <span
                  className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full ${
                    o.backlog > 0 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                  }`}
                >
                  {o.backlog > 0 ? `${o.backlog} pending` : "Clear"}
                </span>
              </div>
              <div className="divide-y divide-gray-50">
                {o.items.map((i) => (
                  <div key={i.label} className="flex items-center justify-between px-4 py-2.5 text-[12.5px]">
                    <span className="text-gray-600">{i.label}</span>
                    <span
                      className={`font-bold ${
                        i.good ? "text-emerald-600" : i.value > 0 ? "text-amber-600" : "text-gray-400"
                      }`}
                    >
                      {i.value}
                      {i.total !== undefined && <span className="text-gray-400 font-normal"> / {i.total}</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Trend + lifecycle */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2" delay="0.4s">
          <SectionHeader
            title="Program Activity — Last 12 Months"
            sub="Applications submitted, approved by you, and programs completed or failed"
          />
          <ResponsiveContainer width="100%" height={270}>
            <BarChart data={data.trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" vertical={false} />
              <XAxis dataKey="month" tick={AXIS_TICK} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
              <Tooltip content={<GreenTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="submitted" name="Submitted" fill="#c7d2fe" radius={[3, 3, 0, 0]} />
              <Bar dataKey="approved" name="Approved" fill="#38bdf8" radius={[3, 3, 0, 0]} />
              <Bar dataKey="completed" name="Completed" fill="#10b981" radius={[3, 3, 0, 0]} />
              <Bar dataKey="failed" name="Failed" fill="#f87171" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card delay="0.44s">
          <SectionHeader title="Program Lifecycle" sub="Where every application is right now" />
          <div className="flex flex-col gap-2.5">
            {data.lifecycle.map((l) => (
              <div key={l.key}>
                <div className="flex justify-between text-[12px] mb-1">
                  <span className="text-gray-600">{l.name}</span>
                  <span className="font-bold text-gray-800">{l.value}</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(l.value / lifecycleMax) * 100}%`, background: l.fill }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Site uptake + activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <SiteUptake data={data.site_uptake} onSiteHistory={onSiteHistory} />
        <Card delay="0.52s">
          <SectionHeader title="Recent Decisions & Activity" sub="Across all offices" action={{ label: "Audit trail", onClick: () => navigate("/Log-trail") }} />
          {data.recent_activity.length > 0 ? (
            <div className="flex flex-col gap-3">
              {data.recent_activity.map((a, i) => {
                const st = ACT_STYLE[a.tone] ?? ACT_STYLE.info;
                return (
                  <div key={i} className="flex items-start gap-3">
                    <div className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${st.bg}`}>{st.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[12.5px] font-bold text-gray-800">
                          {a.ref} <span className="font-medium text-gray-500">· {a.action}</span>
                        </span>
                        <span className="text-[10.5px] text-gray-400 shrink-0">{a.time}</span>
                      </div>
                      {a.detail && <p className="text-[11.5px] text-gray-500 truncate">“{a.detail}”</p>}
                      <p className="text-[11px] text-gray-400">
                        {a.actor} · {a.role}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState text="No activity yet" />
          )}
        </Card>
      </div>
    </div>
  );
}

// ─── TAB: MY DECISIONS ──────────────────────────────────────────────────────

function TabApprovals({ data, onSiteHistory }: { data: HeadDashboard["approvals"]; onSiteHistory: (id: number) => void }) {
  const navigate = useNavigate();
  return (
    <div className="space-y-5">
      <Card>
        <SectionHeader
          title="Applications Waiting for Your Approval"
          sub="Evaluated by the Data Manager and forwarded to you — oldest first"
          badge={`${data.pending_approvals.length} pending`}
        />
        {data.pending_approvals.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {data.pending_approvals.map((a) => (
              <div key={a.application_id} className="rounded-xl border border-gray-100 p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] text-gray-400 font-semibold">
                      {a.ref} · {a.classification}
                    </p>
                    <p className="text-[14.5px] font-bold text-gray-800 truncate">{a.title}</p>
                    <p className="text-[12px] text-gray-500">
                      {a.group_name} · {a.group_type ?? "—"} · {a.participants} participants
                    </p>
                  </div>
                  <span
                    className={`text-[10.5px] font-bold px-2 py-1 rounded-full shrink-0 ${
                      a.days_waiting > 7 ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {a.days_waiting === 0 ? "Today" : `${a.days_waiting}d waiting`}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3 mt-3 text-[11.5px]">
                  <div>
                    <p className="text-gray-400">Site</p>
                    {a.site_id ? (
                      <button onClick={() => onSiteHistory(a.site_id!)} className="font-semibold text-emerald-700 hover:underline text-left">
                        {a.site_name}
                      </button>
                    ) : (
                      <p className="font-semibold text-gray-700">—</p>
                    )}
                    <p className="text-gray-400">
                      {a.barangay ?? "—"} · {fmtHa(a.site_hectares)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400">Site data</p>
                    <p className={`font-semibold ${a.site_verified ? "text-emerald-600" : "text-amber-600"}`}>
                      {a.site_verified ? "Verified" : "Not verified"}
                    </p>
                    <p className="text-gray-400">{a.land_classification ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Group history</p>
                    <p className="font-semibold text-gray-700">
                      {a.previous_programs > 0 ? `${a.previous_programs} past program(s)` : "First program"}
                    </p>
                    {a.previous_programs > 0 && (
                      <p className="text-gray-400">
                        {a.previous_completed} completed · {a.previous_failed} failed
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-4">
                  <p className="text-[11px] text-gray-400">Orientation: {fmtDate(a.orientation_date)}</p>
                  <button
                    onClick={() => navigate(`/evaluation/${a.application_id}`)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0F4A2F] text-white text-[12px] font-semibold hover:bg-[#1a6b44]"
                  >
                    Review & decide <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center py-10 text-center">
            <CheckCircle2 size={30} className="text-emerald-500 mb-2" />
            <p className="text-sm text-gray-600 font-medium">No applications waiting for your approval</p>
          </div>
        )}
      </Card>

      <Card>
        <SectionHeader
          title="Program Closure Requests"
          sub="The Data Manager recommends ending these programs — you make the final call"
          badge={`${data.pending_closures.length} pending`}
          action={{ label: "Open closures", onClick: () => navigate("/program-closures") }}
        />
        {data.pending_closures.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {data.pending_closures.map((c) => (
              <div key={c.id} className="rounded-xl border border-gray-100 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] text-gray-400 font-semibold">{c.ref}</p>
                    <p className="text-[14.5px] font-bold text-gray-800 truncate">{c.title}</p>
                    <p className="text-[12px] text-gray-500">{c.group_name}</p>
                  </div>
                  <Badge
                    label={`Recommends: ${c.recommendation}`}
                    tone={c.recommendation_key === "completed" ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"}
                  />
                </div>
                <p className="text-[12px] text-gray-600 bg-gray-50 rounded-lg px-3 py-2 mt-3">“{c.reason}”</p>
                <div className="grid grid-cols-3 gap-3 mt-3 text-[11.5px]">
                  <div>
                    <p className="text-gray-400">Site</p>
                    {c.site_id ? (
                      <button onClick={() => onSiteHistory(c.site_id!)} className="font-semibold text-emerald-700 hover:underline text-left">
                        {c.site_name}
                      </button>
                    ) : (
                      <p className="font-semibold">—</p>
                    )}
                    <p className="text-gray-400">{c.barangay ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Planted / visits</p>
                    <p className="font-semibold text-gray-700">
                      {fmt(c.planted)} · {c.visits} visits
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400">Survival</p>
                    <p className="font-bold" style={{ color: rateColor(c.survival_rate) }}>
                      {fmtPct(c.survival_rate)}
                    </p>
                  </div>
                </div>
                <p className="text-[11px] text-gray-400 mt-3">
                  Requested by {c.requested_by} · {c.days_waiting === 0 ? "today" : `${c.days_waiting} days ago`}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center py-10 text-center">
            <CheckCircle2 size={30} className="text-emerald-500 mb-2" />
            <p className="text-sm text-gray-600 font-medium">No closure requests waiting</p>
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── TAB: PROGRAM PERFORMANCE ───────────────────────────────────────────────

function TabPerformance({ data, onSiteHistory }: { data: HeadDashboard["performance"]; onSiteHistory: (id: number) => void }) {
  const s = data.summary;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Tile label="Active programs" value={data.active_programs.length} sub={`${data.active_programs.filter((p) => p.overdue).length} overdue for a visit`} />
        <Tile label="Avg. days to complete" value={s.avg_completed_days !== null ? s.avg_completed_days : "—"} sub="Orientation to closure, completed programs" />
        <Tile label="Visits (last 30 days)" value={s.visits_last_30_days} sub="Accepted monitoring visits" />
        <Tile label="Sites overdue for a visit" value={s.overdue_sites} tone={s.overdue_sites > 0 ? "text-red-500" : "text-gray-800"} sub="No accepted visit in 90+ days" />
      </div>

      <Card>
        <SectionHeader title="Active Programs" sub="Lowest survival first — check visit recency and progress" badge={`${data.active_programs.length} active`} />
        {data.active_programs.length > 0 ? (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-left min-w-[760px]">
              <thead>
                <tr className="text-[10.5px] uppercase tracking-wider text-gray-400 border-b border-gray-100">
                  <th className="px-2 py-2 font-semibold">Program</th>
                  <th className="px-2 py-2 font-semibold">Site</th>
                  <th className="px-2 py-2 font-semibold">Orientation</th>
                  <th className="px-2 py-2 font-semibold text-right">Released</th>
                  <th className="px-2 py-2 font-semibold text-right">Planted</th>
                  <th className="px-2 py-2 font-semibold">Survival</th>
                  <th className="px-2 py-2 font-semibold">Last Visit</th>
                </tr>
              </thead>
              <tbody>
                {data.active_programs.map((p) => (
                  <tr key={p.ref} className="border-b border-gray-50 text-[12.5px] align-top">
                    <td className="px-2 py-2.5">
                      <p className="text-[11px] text-gray-400 font-semibold">{p.ref} · {p.status_label}</p>
                      <p className="font-bold text-gray-800">{p.title}</p>
                      <p className="text-[11px] text-gray-500">{p.group_name}</p>
                    </td>
                    <td className="px-2 py-2.5">
                      {p.site_id ? (
                        <button onClick={() => onSiteHistory(p.site_id!)} className="text-left hover:underline">
                          <p className="font-semibold text-emerald-700 flex items-center gap-1">
                            <History size={11} /> {p.site_name}
                          </p>
                          <p className="text-[11px] text-gray-400">{p.barangay}</p>
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-2 py-2.5 whitespace-nowrap">{fmtDate(p.orientation_date)}</td>
                    <td className="px-2 py-2.5 text-right">{fmt(p.released)}</td>
                    <td className="px-2 py-2.5 text-right">{fmt(p.planted)}</td>
                    <td className="px-2 py-2.5">
                      <RateBar rate={p.survival_rate} />
                    </td>
                    <td className={`px-2 py-2.5 whitespace-nowrap ${p.overdue ? "text-red-500 font-semibold" : "text-gray-600"}`}>
                      {p.days_since_visit !== null ? `${p.days_since_visit}d ago` : "No visit yet"}
                      <p className="text-[10.5px] text-gray-400 font-normal">{p.visits} accepted visit(s)</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState text="No active programs" />
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <SectionHeader title="Recent Program Outcomes" sub="Last completed or failed programs" />
          {data.program_outcomes.length > 0 ? (
            <div className="flex flex-col gap-2.5">
              {data.program_outcomes.map((o) => (
                <div key={o.ref} className="flex items-center gap-3 p-2.5 rounded-xl border border-gray-100">
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-bold text-gray-800 truncate">
                      {o.ref} · {o.title}
                    </p>
                    <p className="text-[11px] text-gray-400 truncate">
                      {o.group_name} · {o.site_name ?? "—"} · closed {fmtDate(o.closed)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge label={o.status_label} tone={OUTCOME_TONE[o.status]} />
                    <p className="text-[11px] mt-1" style={{ color: rateColor(o.survival_rate) }}>
                      {fmtPct(o.survival_rate)} survival
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState text="No programs closed yet" />
          )}
        </Card>
        <Card>
          <SectionHeader title="Survival by Species" sub="Guides which species to fund in new programs" />
          {data.species.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(180, data.species.length * 38)}>
              <BarChart data={data.species} layout="vertical" barSize={14}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} unit="%" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <Tooltip content={<GreenTooltip />} />
                <Bar dataKey="rate" name="Survival %" radius={[0, 4, 4, 0]}>
                  {data.species.map((sp, i) => (
                    <Cell key={i} fill={rateColor(sp.rate)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState text="No survival data yet" />
          )}
        </Card>
      </div>

      {data.attention_sites.length > 0 && (
        <Card>
          <SectionHeader title="Sites Needing Attention" sub="Overdue visits, never visited, or low survival" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.attention_sites.map((a) => (
              <button
                key={a.site_id}
                onClick={() => onSiteHistory(a.site_id)}
                className="flex items-start gap-3 p-3 rounded-xl border border-amber-100 bg-amber-50/40 text-left hover:bg-amber-50"
              >
                <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[12.5px] font-bold text-gray-800 truncate">{a.name}</p>
                  <p className="text-[11px] text-gray-500">{a.barangay}</p>
                  <p className="text-[11px] font-semibold text-amber-700 mt-0.5">{a.reason}</p>
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── TAB: TREE GROWERS ──────────────────────────────────────────────────────

function TabGrowers({ data }: { data: HeadDashboard["growers"] }) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState("all");
  const s = data.summary;
  const rows = data.rows.filter((r) =>
    filter === "all" ? true : filter === "active" ? r.active > 0 : r.standing === filter,
  );
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Tile label="Groups" value={s.total} sub={`${s.new_this_month} joined this month`} />
        <Tile label="With an active program" value={s.active} tone="text-indigo-600" />
        <Tile label="Excellent" value={s.excellent} tone="text-emerald-600" sub="≥ 80% survival, no failed programs" />
        <Tile label="Needs attention" value={s.needs_attention} tone={s.needs_attention > 0 ? "text-red-500" : "text-gray-800"} sub="Low survival, failed or non-compliant" />
        <Tile label="Non-compliant" value={s.non_compliant} tone={s.non_compliant > 0 ? "text-red-500" : "text-gray-800"} sub={`Active but no visit in 90+ days`} />
      </div>
      <Card>
        <SectionHeader
          title="Tree Grower Groups"
          sub={`Programs, planting results and monitoring compliance (compliant = accepted visit within ${s.compliant_days} days)`}
          action={{ label: "Manage groups", onClick: () => navigate("/tree-growers") }}
        />
        <div className="flex flex-wrap gap-1.5 mb-4">
          {[
            ["all", "All"],
            ["active", "Active program"],
            ["Excellent", "Excellent"],
            ["Good", "Good"],
            ["Needs attention", "Needs attention"],
            ["New", "New"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 rounded-lg text-[11.5px] font-semibold ${filter === key ? "bg-[#0F4A2F] text-white" : "bg-gray-50 text-gray-600 hover:bg-gray-100"}`}
            >
              {label}
            </button>
          ))}
        </div>
        {rows.length > 0 ? (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-left min-w-[860px]">
              <thead>
                <tr className="text-[10.5px] uppercase tracking-wider text-gray-400 border-b border-gray-100">
                  <th className="px-2 py-2 font-semibold">Group</th>
                  <th className="px-2 py-2 font-semibold">Programs</th>
                  <th className="px-2 py-2 font-semibold text-right">Released</th>
                  <th className="px-2 py-2 font-semibold text-right">Planted</th>
                  <th className="px-2 py-2 font-semibold">Survival</th>
                  <th className="px-2 py-2 font-semibold">Compliance</th>
                  <th className="px-2 py-2 font-semibold">Standing</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.group_name} className="border-b border-gray-50 text-[12.5px] align-top">
                    <td className="px-2 py-2.5">
                      <p className="font-bold text-gray-800">{r.group_name}</p>
                      <p className="text-[11px] text-gray-400">
                        {r.group_type} · joined {fmtDate(r.joined)}
                      </p>
                      {r.current_site && <p className="text-[11px] text-emerald-700">Now at {r.current_site}</p>}
                    </td>
                    <td className="px-2 py-2.5">
                      <p className="font-semibold">{r.programs}</p>
                      <p className="text-[11px] text-gray-400 whitespace-nowrap">
                        {r.active} active · {r.completed} done · {r.failed} failed
                      </p>
                    </td>
                    <td className="px-2 py-2.5 text-right">{fmt(r.seedlings_released)}</td>
                    <td className="px-2 py-2.5 text-right">
                      <p>{fmt(r.planted)}</p>
                      <p className="text-[11px] text-gray-400">{fmt(r.alive)} alive</p>
                    </td>
                    <td className="px-2 py-2.5">
                      <RateBar rate={r.survival_rate} />
                    </td>
                    <td className="px-2 py-2.5">
                      <p className={`font-semibold ${COMPLIANCE_TONE[r.compliance] ?? "text-gray-600"}`}>{r.compliance}</p>
                      <p className="text-[11px] text-gray-400">
                        {r.days_since_visit !== null ? `Last visit ${r.days_since_visit}d ago` : "No visits"}
                      </p>
                    </td>
                    <td className="px-2 py-2.5">
                      <Badge label={r.standing} tone={STANDING_TONE[r.standing] ?? STANDING_TONE.New} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState text="No groups match this filter" />
        )}
      </Card>
    </div>
  );
}

// ─── TAB: BARANGAY COVERAGE ─────────────────────────────────────────────────

function TabCoverage({ data }: { data: HeadDashboard["coverage"] }) {
  const s = data.summary;
  const chartRows = data.rows.filter((r) => r.sites > 0 || r.official_hectares > 0 || r.planted_hectares > 0);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Tile label="Barangays covered" value={s.barangays} sub="With a reforestation area or site" />
        <Tile label="Reforestation areas" value={s.areas} />
        <Tile label="Official site area" value={fmtHa(s.official_hectares)} />
        <Tile label="Planted area" value={fmtHa(s.planted_hectares)} tone="text-emerald-600" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2">
          <SectionHeader title="Area by Barangay" sub="Official site area vs area actually planted" />
          {chartRows.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartRows} barGap={3}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" vertical={false} />
                <XAxis dataKey="name" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} unit=" ha" />
                <Tooltip content={<GreenTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="official_hectares" name="Official area (ha)" fill="#a7f3d0" radius={[4, 4, 0, 0]} />
                <Bar dataKey="planted_hectares" name="Planted (ha)" fill="#059669" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState text="No sites yet" />
          )}
        </Card>
        <Card>
          <SectionHeader title="Land Classification" sub="Verified sites by classification" />
          {data.land_classification.length > 0 ? (
            <div className="flex flex-col gap-2.5">
              {data.land_classification.map((l) => {
                const total = data.land_classification.reduce((sum, x) => sum + x.sites, 0) || 1;
                return (
                  <div key={l.name}>
                    <div className="flex justify-between text-[12px] mb-1">
                      <span className="text-gray-700 font-medium truncate flex items-center gap-1.5">
                        <Layers size={12} className="text-emerald-600" /> {l.name}
                      </span>
                      <span className="text-gray-500 shrink-0">
                        {l.sites} · {fmtHa(l.hectares)}
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(l.sites / total) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState text="No verified sites yet" />
          )}
        </Card>
      </div>
      <Card>
        <SectionHeader title="Barangay Summary" />
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-left min-w-[760px]">
            <thead>
              <tr className="text-[10.5px] uppercase tracking-wider text-gray-400 border-b border-gray-100">
                <th className="px-2 py-2 font-semibold">Barangay</th>
                <th className="px-2 py-2 font-semibold text-right">Areas</th>
                <th className="px-2 py-2 font-semibold text-right">Sites (official)</th>
                <th className="px-2 py-2 font-semibold text-right">Official Area</th>
                <th className="px-2 py-2 font-semibold text-right">Planted</th>
                <th className="px-2 py-2 font-semibold">Programs</th>
                <th className="px-2 py-2 font-semibold">Survival</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.name} className="border-b border-gray-50 text-[12.5px]">
                  <td className="px-2 py-2.5 font-bold text-gray-800">{r.name}</td>
                  <td className="px-2 py-2.5 text-right">{r.areas}</td>
                  <td className="px-2 py-2.5 text-right">
                    {r.sites} <span className="text-gray-400">({r.official_sites})</span>
                  </td>
                  <td className="px-2 py-2.5 text-right">{fmtHa(r.official_hectares)}</td>
                  <td className="px-2 py-2.5 text-right">
                    <p>{fmtHa(r.planted_hectares)}</p>
                    <p className="text-[11px] text-gray-400">{fmt(r.planted)} plants</p>
                  </td>
                  <td className="px-2 py-2.5 text-[11.5px] text-gray-600 whitespace-nowrap">
                    {r.active_programs} active · {r.completed} done · {r.failed} failed
                  </td>
                  <td className="px-2 py-2.5">
                    <RateBar rate={r.survival_rate} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─── Main ───────────────────────────────────────────────────────────────────

export default function HeadDashboard() {
  const [isAuthorize, setIsAuthorize] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [data, setData] = useState<HeadDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [historySiteId, setHistorySiteId] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const token = localStorage.getItem("token");
      if (!token) return setIsAuthorize(false);
      try {
        const res = await fetch(api + "api/get_me/", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
        const body = await res.json();
        setIsAuthorize(res.ok && body.user_role === "CityENROHead");
      } catch {
        setIsAuthorize(false);
      }
    })();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${api}api/get_head_dashboard_data/`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to load dashboard");
      setData(body);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthorize) fetchDashboardData();
  }, [isAuthorize]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isAuthorize === null) {
    return (
      <div className="min-h-screen bg-[#f5faf6] flex items-center justify-center">
        <Loader2 size={40} className="animate-spin text-[#0F4A2F]" />
      </div>
    );
  }
  if (!isAuthorize) return <NotFoundPage />;

  const pendingDecisions = data ? data.executive.kpis.pending_approvals + data.executive.kpis.pending_closures : 0;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Barlow+Condensed:wght@600;700;800&display=swap');
        .dash-root  { font-family:'DM Sans',sans-serif; }
        .dash-title { font-family:'Barlow Condensed',sans-serif; letter-spacing:-0.01em; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        .animate-fadeUp { animation: fadeUp .5s ease both; }
        .recharts-cartesian-grid-horizontal line, .recharts-cartesian-grid-vertical line { stroke: #f0fdf4; }
      `}</style>

      <div className="dash-root bg-[#f5faf6] min-h-screen p-6 overflow-x-hidden">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3 animate-fadeUp">
          <div>
            <h1 className="dash-title text-[28px] font-bold text-[#0F4A2F]">City ENRO Head Dashboard</h1>
            <p className="text-[13px] text-gray-500 mt-0.5">
              Oversight of every office and reforestation program · Ormoc City ·{" "}
              {new Date().toLocaleDateString("en-PH", { weekday: "long", month: "short", day: "numeric", year: "numeric" })}
            </p>
          </div>
          <button
            onClick={fetchDashboardData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0F4A2F] text-white text-sm font-semibold hover:bg-[#1a6b44] disabled:opacity-60"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        <div className="flex gap-1.5 mb-6 bg-white rounded-xl p-1.5 border border-gray-100 shadow-[0_1px_8px_rgba(0,0,0,0.05)] w-fit max-w-full overflow-x-auto animate-fadeUp">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-[12px] font-semibold transition-all whitespace-nowrap ${
                activeTab === tab.id ? "bg-[#0F4A2F] text-white shadow-sm" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              {tab.icon} {tab.label}
              {tab.id === "approvals" && pendingDecisions > 0 && (
                <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{pendingDecisions}</span>
              )}
            </button>
          ))}
        </div>

        {loading && !data ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 size={40} className="animate-spin text-[#0F4A2F] mb-4" />
            <p className="text-gray-500 font-medium">Loading dashboard…</p>
          </div>
        ) : !data ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <p className="text-gray-500">{error ?? "Failed to load dashboard data"}</p>
            <button onClick={fetchDashboardData} className="px-4 py-2 bg-[#0F4A2F] text-white rounded-lg text-sm font-semibold">
              Retry
            </button>
          </div>
        ) : (
          <>
            {activeTab === "overview" && <TabOverview data={data.executive} goTo={setActiveTab} onSiteHistory={setHistorySiteId} />}
            {activeTab === "approvals" && <TabApprovals data={data.approvals} onSiteHistory={setHistorySiteId} />}
            {activeTab === "performance" && <TabPerformance data={data.performance} onSiteHistory={setHistorySiteId} />}
            {activeTab === "growers" && <TabGrowers data={data.growers} />}
            {activeTab === "coverage" && <TabCoverage data={data.coverage} />}
          </>
        )}
      </div>

      {historySiteId !== null && <SiteHistoryModal siteId={historySiteId} onClose={() => setHistorySiteId(null)} />}
    </>
  );
}
