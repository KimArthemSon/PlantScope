import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileSearch,
  Layers,
  Loader2,
  MapPin,
  MapPinned,
  RefreshCw,
  ShieldAlert,
  Sprout,
  TreePine,
  XCircle,
} from "lucide-react";
import { api } from "@/constant/api";
import { useUserRole } from "@/hooks/authorization";
import NotFoundPage from "../../components/layout/NotFoundPage";

// ─── Types ──────────────────────────────────────────────────────────────────

interface StatusItem {
  key: string;
  name: string;
  value: number;
  hectares: number;
  fill: string;
}

interface GisDashboard {
  summary: {
    areas_total: number;
    areas_this_month: number;
    barangays_covered: number;
    sites_total: number;
    sites_hectares: number;
    sites_this_month: number;
    sites_pending: number;
    official_sites: number;
    official_hectares: number;
    verification_pending: number;
    sites_without_verification: number;
    planted_hectares: number;
    planted_sites: number;
    planted_coverage: number | null;
    pending_reviews: number;
    awaiting_dm: number;
    oldest_pending_days: number | null;
    reviewed_this_month: number;
    approved_this_month: number;
    changes_this_month: number;
    avg_review_days: number | null;
    assessments_total: number;
    assessments_this_month: number;
    hazard_areas: number;
    classified_areas: number;
    ndvi_candidates: number;
    ndvi_candidate_hectares: number;
    ndvi_candidates_linked: number;
    data_issues: number;
  };
  site_status: StatusItem[];
  verification: StatusItem[];
  monitoring_status: StatusItem[];
  trend: {
    month: string;
    new_sites: number;
    new_areas: number;
    sites_verified: number;
    cumulative_sites: number;
    verified_hectares: number;
    planted_hectares: number;
  }[];
  by_barangay: { name: string; sites: number; official: number; hectares: number }[];
  areas: {
    id: number;
    name: string;
    barangay: string;
    sites: number;
    verified: number;
    pending: number;
    under_monitoring: number;
    hectares: number;
  }[];
  review_queue: {
    id: number;
    site: string;
    barangay: string;
    visit_type: string;
    planted_hectares: number | null;
    site_hectares: number | null;
    inspector: string;
    waiting_days: number;
  }[];
  hazards: { name: string; value: number; fill: string }[];
  classified: { name: string; value: number }[];
  recent_activity: {
    id: number;
    type: "success" | "warning" | "info" | "danger";
    site: string;
    action: string;
    officer: string;
    time: string;
  }[];
  data_issues: {
    site_id: number;
    site: string;
    barangay: string;
    issue: string;
    severity: "high" | "medium";
  }[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmt = (n: number | null | undefined) => (n ?? 0).toLocaleString();
const fmtHa = (n: number | null | undefined) =>
  `${(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} ha`;
const AXIS_TICK = { fontSize: 11, fill: "#94a3b8" };

const ACT_STYLE: Record<string, { bg: string; icon: ReactNode }> = {
  success: { bg: "bg-emerald-50 text-emerald-700", icon: <CheckCircle2 size={12} /> },
  warning: { bg: "bg-amber-50 text-amber-700", icon: <Clock size={12} /> },
  info: { bg: "bg-sky-50 text-sky-700", icon: <Activity size={12} /> },
  danger: { bg: "bg-red-50 text-red-700", icon: <XCircle size={12} /> },
};

function GreenTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0F4A2F] text-white text-xs rounded-xl px-3 py-2 shadow-xl border border-white/10">
      <p className="font-semibold mb-1 text-emerald-300">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color ?? "#86efac" }}>
          {p.name}: <b>{p.value ?? "—"}</b>
        </p>
      ))}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  accent,
  delay,
  alert,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accent: string;
  delay: string;
  alert?: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden rounded-2xl p-5 border border-white/60 bg-white
        shadow-[0_2px_20px_rgba(5,120,0,0.06)] hover:shadow-[0_8px_32px_rgba(5,120,0,0.14)]
        transition-all duration-300 hover:-translate-y-0.5 animate-fadeUp ${onClick ? "cursor-pointer" : ""}`}
      style={{ animationDelay: delay }}
    >
      <div className={`absolute top-0 left-0 right-0 h-0.5 ${accent}`} />
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#057501]/[0.08]">
          <span className="text-[#057501]">{icon}</span>
        </div>
        {alert && (
          <span className="text-[10.5px] font-semibold px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            {alert}
          </span>
        )}
      </div>
      <p className="text-[13px] text-gray-500 font-medium mb-0.5">{label}</p>
      <p className="dash-title text-[26px] font-bold text-gray-800 leading-none">{value}</p>
      {sub && <p className="text-[11.5px] text-gray-400 mt-1.5">{sub}</p>}
    </div>
  );
}

function Card({
  children,
  className = "",
  delay = "0s",
}: {
  children: ReactNode;
  className?: string;
  delay?: string;
}) {
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
        <h2 className="dash-title text-[15px] font-bold text-gray-800">{title}</h2>
        {sub && <p className="text-[12px] text-gray-400 mt-0.5">{sub}</p>}
      </div>
      {badge && (
        <span className="bg-emerald-50 text-emerald-700 text-[11px] font-semibold px-3 py-1 rounded-full border border-emerald-200 shrink-0">
          {badge}
        </span>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="flex items-center gap-1 text-[11.5px] text-emerald-700 hover:text-emerald-900 font-semibold shrink-0"
        >
          {action.label} <ArrowRight size={12} />
        </button>
      )}
    </div>
  );
}

function EmptyState({ text, className = "py-10" }: { text: string; className?: string }) {
  return <p className={`text-center text-gray-400 text-sm ${className}`}>{text}</p>;
}

function StatusDonut({ data, showHectares }: { data: StatusItem[]; showHectares?: boolean }) {
  const visible = data.filter((d) => d.value > 0);
  if (visible.length === 0) return <EmptyState text="No data yet" />;
  return (
    <>
      <ResponsiveContainer width="100%" height={160}>
        <PieChart>
          <Pie data={visible} dataKey="value" nameKey="name" outerRadius={66} innerRadius={38} paddingAngle={2}>
            {visible.map((d, i) => (
              <Cell key={i} fill={d.fill} />
            ))}
          </Pie>
          <Tooltip content={<GreenTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-col gap-1.5 mt-3">
        {data.map((d) => (
          <div key={d.key} className="flex items-center gap-2 text-[12px]">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.fill }} />
            <span className="text-gray-600">{d.name}</span>
            {showHectares && <span className="ml-auto text-[11px] text-gray-400">{fmtHa(d.hectares)}</span>}
            <span className={`${showHectares ? "" : "ml-auto"} w-7 text-right font-bold text-gray-800`}>
              {d.value}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function DashboardGISS() {
  const { userRole, isLoading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const [data, setData] = useState<GisDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${api}api/gis_dashboard/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to load dashboard data.");
      setData(body);
    } catch (err: any) {
      setError(err.message || "Could not load dashboard data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <Loader2 size={40} className="animate-spin text-[#0F4A2F]" />
      </div>
    );
  }
  if (!token || userRole !== "GISSpecialist") return <NotFoundPage />;

  if (loading && !data) {
    return (
      <div className="bg-[#f5faf6] min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={44} className="animate-spin text-[#0F4A2F] mx-auto mb-4" />
          <p className="text-gray-500 font-medium">Loading GIS dashboard…</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-[#f5faf6] min-h-screen flex flex-col items-center justify-center gap-3">
        <p className="text-gray-500">{error ?? "Failed to load dashboard data."}</p>
        <button
          onClick={() => fetchDashboardData()}
          className="px-4 py-2 rounded-lg bg-[#0F4A2F] text-white text-sm font-semibold hover:bg-[#1a6b44]"
        >
          Retry
        </button>
      </div>
    );
  }

  const s = data.summary;
  const coverageLabel =
    s.planted_coverage === null
      ? "No official site area yet"
      : s.planted_coverage > 100
        ? "Exceeds official site area — check boundaries"
        : `${s.planted_coverage}% of official site area`;
  const hasTrend = data.trend.some((t) => t.cumulative_sites > 0 || t.new_areas > 0);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Barlow+Condensed:wght@600;700;800&display=swap');
        .dash-root  { font-family:'DM Sans',sans-serif; }
        .dash-title { font-family:'Barlow Condensed',sans-serif; letter-spacing:-0.01em; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        .animate-fadeUp { animation: fadeUp .5s ease both; }
        .recharts-cartesian-grid-horizontal line,
        .recharts-cartesian-grid-vertical   line { stroke: #f0fdf4; }
      `}</style>

      <div className="dash-root bg-[#f5faf6] min-h-screen p-6 overflow-x-hidden">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3 animate-fadeUp">
          <div>
            <h1 className="dash-title text-[28px] font-bold text-[#0F4A2F]">GIS Specialist Dashboard</h1>
            <p className="text-[13px] text-gray-500 mt-0.5">
              Reforestation areas, site boundaries and statuses, planted-area reviews and map layers ·{" "}
              {new Date().toLocaleDateString("en-PH", { weekday: "long", month: "short", day: "numeric", year: "numeric" })}
            </p>
          </div>
          <button
            onClick={() => fetchDashboardData(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0F4A2F] text-white text-sm font-semibold hover:bg-[#1a6b44] transition-colors shadow-sm disabled:opacity-60"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {/* KPI row 1 — what exists */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <StatCard
            icon={<ClipboardList size={20} />}
            label="Reforestation Areas"
            value={fmt(s.areas_total)}
            sub={`${s.barangays_covered} barangays · ${s.areas_this_month} added this month`}
            accent="bg-emerald-500"
            delay="0.04s"
            onClick={() => navigate("/GISS/reforestation-areas")}
          />
          <StatCard
            icon={<MapPin size={20} />}
            label="Total Sites"
            value={fmt(s.sites_total)}
            sub={`${fmtHa(s.sites_hectares)} mapped · ${s.sites_this_month} added this month`}
            accent="bg-teal-500"
            delay="0.08s"
            alert={s.sites_pending > 0 ? `${s.sites_pending} pending` : undefined}
            onClick={() => navigate("/GISS/reforestation_area_site")}
          />
          <StatCard
            icon={<TreePine size={20} />}
            label="Official Sites"
            value={fmt(s.official_sites)}
            sub={`${fmtHa(s.official_hectares)} verified area`}
            accent="bg-green-600"
            delay="0.12s"
            onClick={() => navigate("/GISS/official-reforestation")}
          />
          <StatCard
            icon={<Sprout size={20} />}
            label="Planted Area"
            value={fmtHa(s.planted_hectares)}
            sub={`${s.planted_sites} sites · ${coverageLabel}`}
            accent={s.planted_coverage !== null && s.planted_coverage > 100 ? "bg-red-500" : "bg-emerald-600"}
            delay="0.16s"
          />
        </div>

        {/* KPI row 2 — what needs work */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            icon={<MapPinned size={20} />}
            label="Planted Areas to Review"
            value={fmt(s.pending_reviews)}
            sub={
              s.pending_reviews > 0 && s.oldest_pending_days !== null
                ? `Oldest waiting ${s.oldest_pending_days} days · ${s.awaiting_dm} with Data Manager`
                : `${s.awaiting_dm} still with Data Manager`
            }
            accent="bg-indigo-500"
            delay="0.2s"
            alert={s.pending_reviews > 0 ? "Action needed" : undefined}
            onClick={() => navigate("/GISS/planting-area-reviews")}
          />
          <StatCard
            icon={<CheckCircle2 size={20} />}
            label="Reviewed This Month"
            value={fmt(s.reviewed_this_month)}
            sub={`${s.approved_this_month} confirmed · ${s.changes_this_month} changes requested${
              s.avg_review_days !== null ? ` · avg ${s.avg_review_days}d` : ""
            }`}
            accent="bg-green-500"
            delay="0.24s"
          />
          <StatCard
            icon={<FileSearch size={20} />}
            label="Site Data Pending Verification"
            value={fmt(s.verification_pending)}
            sub={`${s.sites_without_verification} sites with no verification yet · ${s.assessments_this_month} field assessments this month`}
            accent="bg-amber-500"
            delay="0.28s"
          />
          <StatCard
            icon={<ShieldAlert size={20} />}
            label="Map Data Checks"
            value={fmt(s.data_issues)}
            sub={s.data_issues > 0 ? "Boundaries or classifications to fix" : "All site boundaries look consistent"}
            accent={s.data_issues > 0 ? "bg-red-500" : "bg-green-500"}
            delay="0.32s"
          />
        </div>

        {/* Growth trend + site approval status */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
          <Card className="lg:col-span-2" delay="0.36s">
            <SectionHeader
              title="Site Mapping Progress"
              sub="New reforestation areas and sites each month, with the running total of sites"
              badge={`${s.sites_total} sites total`}
            />
            {hasTrend ? (
              <ResponsiveContainer width="100%" height={250}>
                <ComposedChart data={data.trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" />
                  <XAxis dataKey="month" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <Tooltip content={<GreenTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="new_areas" name="New Areas" fill="#a5b4fc" radius={[4, 4, 0, 0]} barSize={14} />
                  <Bar dataKey="new_sites" name="New Sites" fill="#6ee7b7" radius={[4, 4, 0, 0]} barSize={14} />
                  <Bar dataKey="sites_verified" name="Sites Verified" fill="#059669" radius={[4, 4, 0, 0]} barSize={14} />
                  <Line
                    type="monotone"
                    dataKey="cumulative_sites"
                    name="Total Sites"
                    stroke="#0F4A2F"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: "#0F4A2F", strokeWidth: 0 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState text="No sites mapped in the last 12 months" className="py-16" />
            )}
          </Card>
          <Card delay="0.4s">
            <SectionHeader title="Site Approval Status" sub={`All ${s.sites_total} active sites · ${fmtHa(s.sites_hectares)}`} />
            <StatusDonut data={data.site_status} showHectares />
          </Card>
        </div>

        {/* Area trend + monitoring status */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
          <Card className="lg:col-span-2" delay="0.44s">
            <SectionHeader
              title="Verified vs Planted Area"
              sub="Running total of verified site area compared with area actually planted (latest planted polygon per site)"
            />
            {hasTrend ? (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={data.trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" vertical={false} />
                  <XAxis dataKey="month" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} unit=" ha" />
                  <Tooltip content={<GreenTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    type="monotone"
                    dataKey="verified_hectares"
                    name="Verified area (ha)"
                    stroke="#6366f1"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: "#6366f1", strokeWidth: 0 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="planted_hectares"
                    name="Planted area (ha)"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: "#10b981", strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState text="No area data yet" className="py-16" />
            )}
          </Card>
          <Card delay="0.48s">
            <SectionHeader title="Official Site Monitoring" sub={`${s.official_sites} official sites`} />
            <StatusDonut data={data.monitoring_status} showHectares />
          </Card>
        </div>

        {/* Sites by barangay + verification pipeline */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
          <Card className="lg:col-span-2" delay="0.52s">
            <SectionHeader title="Sites by Barangay" sub="Number of sites (all vs official) and mapped area" />
            {data.by_barangay.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={data.by_barangay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" vertical={false} />
                  <XAxis dataKey="name" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="right" orientation="right" tick={AXIS_TICK} axisLine={false} tickLine={false} unit=" ha" />
                  <Tooltip content={<GreenTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar yAxisId="left" dataKey="sites" name="All sites" fill="#bbf7d0" radius={[4, 4, 0, 0]} barSize={22} />
                  <Bar yAxisId="left" dataKey="official" name="Official" fill="#059669" radius={[4, 4, 0, 0]} barSize={22} />
                  <Line yAxisId="right" type="monotone" dataKey="hectares" name="Area (ha)" stroke="#6366f1" strokeWidth={2.5} />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState text="No sites yet" className="py-16" />
            )}
          </Card>
          <Card delay="0.56s">
            <SectionHeader title="Site Data Verification" sub="Where each site's data is in the review process" />
            <ResponsiveContainer width="100%" height={170}>
              <BarChart data={data.verification} layout="vertical" barSize={16}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <Tooltip content={<GreenTooltip />} />
                <Bar dataKey="value" name="Sites" radius={[0, 4, 4, 0]}>
                  {data.verification.map((d, i) => (
                    <Cell key={i} fill={d.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            {s.sites_without_verification > 0 && (
              <p className="text-[11.5px] text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mt-3">
                {s.sites_without_verification} site(s) have no verification record yet.
              </p>
            )}
          </Card>
        </div>

        {/* Reforestation areas + review queue */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
          <Card className="lg:col-span-2" delay="0.6s">
            <SectionHeader
              title="Reforestation Areas"
              sub="Largest areas by mapped site area"
              action={{ label: "All areas", onClick: () => navigate("/GISS/reforestation-areas") }}
            />
            {data.areas.length > 0 ? (
              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-left min-w-[560px]">
                  <thead>
                    <tr className="text-[10.5px] uppercase tracking-wider text-gray-400 border-b border-gray-100">
                      <th className="px-2 py-2 font-semibold">Area</th>
                      <th className="px-2 py-2 font-semibold text-right">Sites</th>
                      <th className="px-2 py-2 font-semibold">Verified</th>
                      <th className="px-2 py-2 font-semibold text-right">Pending</th>
                      <th className="px-2 py-2 font-semibold text-right">Monitoring</th>
                      <th className="px-2 py-2 font-semibold text-right">Area</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.areas.map((a) => {
                      const pct = a.sites > 0 ? Math.round((a.verified / a.sites) * 100) : 0;
                      return (
                        <tr key={a.id} className="border-b border-gray-50 text-[12.5px] hover:bg-gray-50/70">
                          <td className="px-2 py-2.5">
                            <p className="font-bold text-gray-800">{a.name}</p>
                            <p className="text-[11px] text-gray-400">{a.barangay}</p>
                          </td>
                          <td className="px-2 py-2.5 text-right text-gray-700">{a.sites}</td>
                          <td className="px-2 py-2.5">
                            {a.sites > 0 ? (
                              <div className="flex items-center gap-2 min-w-[110px]">
                                <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                                </div>
                                <span className="text-[11px] text-gray-600 w-10 text-right">
                                  {a.verified}/{a.sites}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[11px] text-gray-400">No sites yet</span>
                            )}
                          </td>
                          <td className={`px-2 py-2.5 text-right ${a.pending > 0 ? "text-amber-600 font-semibold" : "text-gray-500"}`}>
                            {a.pending}
                          </td>
                          <td className="px-2 py-2.5 text-right text-gray-700">{a.under_monitoring}</td>
                          <td className="px-2 py-2.5 text-right font-semibold text-gray-800">{fmtHa(a.hectares)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState text="No reforestation areas yet" />
            )}
          </Card>

          <Card delay="0.64s">
            <SectionHeader
              title="Planted Area Review Queue"
              sub="Approved by the Data Manager, waiting for map confirmation"
              action={{ label: "Open", onClick: () => navigate("/GISS/planting-area-reviews") }}
            />
            {data.review_queue.length > 0 ? (
              <div className="flex flex-col gap-2.5">
                {data.review_queue.map((r) => {
                  const oversized =
                    r.planted_hectares !== null && r.site_hectares !== null && r.site_hectares > 0 && r.planted_hectares > r.site_hectares;
                  return (
                    <div key={r.id} className="p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[12.5px] font-bold text-gray-800 truncate">{r.site}</p>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            r.waiting_days > 7 ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {r.waiting_days === 0 ? "Today" : `${r.waiting_days}d waiting`}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400">
                        {r.barangay} · {r.visit_type} · {r.inspector}
                      </p>
                      <p className={`text-[11px] mt-0.5 ${oversized ? "text-red-500 font-semibold" : "text-gray-500"}`}>
                        Planted {r.planted_hectares !== null ? fmtHa(r.planted_hectares) : "—"} of site {fmtHa(r.site_hectares)}
                        {oversized && " — larger than site"}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <CheckCircle2 size={28} className="text-emerald-500 mb-2" />
                <p className="text-sm text-gray-600 font-medium">Queue is clear</p>
                <p className="text-[11.5px] text-gray-400">
                  {s.awaiting_dm > 0 ? `${s.awaiting_dm} report(s) are still with the Data Manager` : "No planted areas waiting"}
                </p>
              </div>
            )}
          </Card>
        </div>

        {/* Data checks + map layers + activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Card delay="0.68s">
            <SectionHeader title="Map Data Checks" sub="Site boundaries and records that need fixing" />
            {data.data_issues.length > 0 ? (
              <div className="flex flex-col gap-2">
                {data.data_issues.map((d, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-2.5 p-2.5 rounded-lg border ${
                      d.severity === "high" ? "border-red-100 bg-red-50/40" : "border-amber-100 bg-amber-50/40"
                    }`}
                  >
                    <AlertTriangle
                      size={14}
                      className={`mt-0.5 shrink-0 ${d.severity === "high" ? "text-red-500" : "text-amber-500"}`}
                    />
                    <div className="min-w-0">
                      <p className="text-[12px] font-bold text-gray-800 truncate">
                        {d.site} <span className="font-normal text-gray-400">· {d.barangay}</span>
                      </p>
                      <p className="text-[11.5px] text-gray-600">{d.issue}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <CheckCircle2 size={28} className="text-emerald-500 mb-2" />
                <p className="text-sm text-gray-600 font-medium">No issues found</p>
              </div>
            )}
          </Card>

          <Card delay="0.72s">
            <SectionHeader title="Map Layers" sub="Reference layers used for site suitability" />
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-[10px] text-gray-400 font-medium">Hazard areas</p>
                <p className="dash-title text-[22px] font-bold text-gray-800">{s.hazard_areas}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-[10px] text-gray-400 font-medium">Classified areas</p>
                <p className="dash-title text-[22px] font-bold text-gray-800">{s.classified_areas}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-[10px] text-gray-400 font-medium">NDVI candidates</p>
                <p className="dash-title text-[22px] font-bold text-gray-800">{s.ndvi_candidates}</p>
              </div>
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Hazards by type</p>
            {data.hazards.length > 0 ? (
              <div className="flex flex-col gap-1.5 mb-4">
                {data.hazards.map((h) => (
                  <div key={h.name} className="flex items-center gap-2 text-[12px]">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: h.fill }} />
                    <span className="text-gray-600">{h.name}</span>
                    <span className="ml-auto font-bold text-gray-800">{h.value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[12px] text-gray-400 mb-4">No hazard areas drawn</p>
            )}
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Land classification</p>
            {data.classified.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                {data.classified.map((c) => (
                  <div key={c.name} className="flex items-center gap-2 text-[12px]">
                    <Layers size={12} className="text-emerald-600" />
                    <span className="text-gray-600 truncate">{c.name}</span>
                    <span className="ml-auto font-bold text-gray-800">{c.value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[12px] text-gray-400">No classified areas drawn</p>
            )}
            {s.ndvi_candidates > 0 && (
              <p className="text-[11px] text-gray-400 mt-3">
                {s.ndvi_candidates_linked} of {s.ndvi_candidates} NDVI candidate areas linked to a site
              </p>
            )}
          </Card>

          <Card delay="0.76s">
            <SectionHeader title="Recent Activity" sub="Sites, verifications, reviews and field assessments" />
            {data.recent_activity.length > 0 ? (
              <div className="flex flex-col gap-3">
                {data.recent_activity.map((a) => {
                  const st = ACT_STYLE[a.type] ?? ACT_STYLE.info;
                  return (
                    <div key={a.id} className="flex items-start gap-3">
                      <div className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${st.bg}`}>
                        {st.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[12px] font-bold text-gray-800 truncate">{a.site}</span>
                          <span className="text-[10.5px] text-gray-400 shrink-0">{a.time}</span>
                        </div>
                        <p className="text-[11.5px] text-gray-500 leading-tight">{a.action}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">by {a.officer}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState text="No recent activity" />
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
