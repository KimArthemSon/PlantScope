import { useEffect, useState, type ReactElement } from "react";
import { api } from "@/constant/api.ts";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  ComposedChart,
  ReferenceLine,
} from "recharts";
import {
  Activity,
  TrendingUp,
  MapPin,
  CheckCircle2,
  Clock,
  XCircle,
  Sprout,
  Globe2,
  Droplets,
  Wind,
  Thermometer,
  Eye,
  ClipboardList,
  Loader2,
  Package,
  AlertCircle,
  TreePine,
  Heart,
  Layers,
  MonitorDot,
  Trophy,
  CalendarClock,
  FileClock,
} from "lucide-react";

// ─────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────
interface SiteProgress {
  site_id: number;
  name: string;
  barangay: string;
  monitoring_status: string;
  site_hectares: number;
  planted_hectares: number;
  planted: number;
  survived: number;
  dead: number;
  rate: number;
  visits: number;
  last_visit: string;
  days_since_visit: number | null;
  overdue: boolean;
  no_visit: boolean;
  reason?: string;
}

interface DashboardData {
  stats: {
    total_applications: number;
    approved: number;
    pending: number;
    rejected: number;
    under_monitoring_applications: number;
    completed_applications: number;
    completed_sites: number;
    total_seedlings_planted: number;
    total_area_planted: number;
    areas_assessed: number;
    assessors: number;
    trees_endorsed: number;
    overall_survival_rate: number;
    official_sites: number;
    official_hectares: number;
  };
  application_trend: {
    month: string;
    submitted: number;
    approved: number;
    rejected: number;
  }[];
  status_data: { name: string; value: number; fill: string }[];
  assessment_data: { name: string; assessed: number; approved: number }[];
  approval_rate: { month: string; rate: number }[];
  recent_activities: {
    id: number;
    type: string;
    ref: string;
    action: string;
    time: string;
    officer: string;
    layer?: string;
  }[];
  recent_apps: {
    ref: string;
    title: string;
    classification: string;
    area: string;
    hectares: string;
    status: string;
    created_at: string;
  }[];
  assessors: {
    name: string;
    assessments: number;
    approved: number;
    pending_seedlings: number;
    status: string;
    avatar: string;
  }[];
  seedling_request_pipeline: { name: string; value: number; fill: string }[];
  site_verification_pipeline: { name: string; value: number; fill: string }[];
  progress_report_stats: {
    total_initial: number;
    initial_completed: number;
    total_ongoing: number;
    ongoing_completed: number;
  };
  // Monitoring
  monitoring_summary: {
    official_sites: number;
    official_hectares: number;
    sites_under_monitoring: number;
    hectares_under_monitoring: number;
    available_sites: number;
    sites_planted: number;
    planted_hectares: number;
    total_planted: number;
    total_survived: number;
    total_dead: number;
    survival_rate: number;
    overdue_sites: number;
    sites_without_visit: number;
    pending_reports: number;
    visits_last_30_days: number;
    overdue_days: number;
  };
  monitoring_status_breakdown: {
    key: string;
    name: string;
    value: number;
    hectares: number;
    fill: string;
  }[];
  planting_trend: {
    month: string;
    new_seedlings: number;
    new_dead: number;
    new_sites: number;
    visits: number;
    cumulative_sites: number;
    cumulative_seedlings: number;
    cumulative_survived: number;
    cumulative_hectares: number;
    survival_rate: number | null;
  }[];
  site_progress: SiteProgress[];
  survival_by_species: {
    name: string;
    planted: number;
    survived: number;
    dead: number;
    rate: number;
  }[];
  top_performing_sites: SiteProgress[];
  sites_needing_attention: SiteProgress[];
}

// ─────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────
const WEATHER_DATA = [
  { icon: <Thermometer size={14} />, label: "Temp", value: "27°C" },
  { icon: <Droplets size={14} />, label: "Humidity", value: "74%" },
  { icon: <Wind size={14} />, label: "Wind", value: "12 km/h" },
  { icon: <Eye size={14} />, label: "Visibility", value: "Good" },
];

const TABS = [
  { id: "overview", label: "Overview", icon: <Activity size={13} /> },
  { id: "monitoring", label: "Monitoring", icon: <Heart size={13} /> },
];

const ACT_STYLE: Record<string, { bg: string; icon: ReactElement }> = {
  success: {
    bg: "bg-emerald-50 text-emerald-700",
    icon: <CheckCircle2 size={12} />,
  },
  warning: { bg: "bg-amber-50 text-amber-700", icon: <Clock size={12} /> },
  info: { bg: "bg-sky-50 text-sky-700", icon: <Activity size={12} /> },
  danger: { bg: "bg-red-50 text-red-700", icon: <XCircle size={12} /> },
};

const STATUS_BADGE: Record<string, string> = {
  Approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Pending: "bg-amber-50 text-amber-700 border-amber-200",
  "On Review": "bg-indigo-50 text-indigo-700 border-indigo-200",
  Monitoring: "bg-sky-50 text-sky-700 border-sky-200",
  Rejected: "bg-red-50 text-red-700 border-red-200",
  Cancelled: "bg-orange-50 text-orange-700 border-orange-200",
  Completed: "bg-green-50 text-green-700 border-green-200",
};

const MONITORING_BADGE: Record<string, string> = {
  "Under Monitoring": "bg-indigo-50 text-indigo-700 border-indigo-200",
  Completed: "bg-green-50 text-green-700 border-green-200",
  Failed: "bg-red-50 text-red-700 border-red-200",
  Available: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Reserved: "bg-amber-50 text-amber-700 border-amber-200",
  "On Hold": "bg-gray-50 text-gray-600 border-gray-200",
};

const ZONE_ACCENTS = [
  "bg-emerald-500",
  "bg-indigo-500",
  "bg-amber-500",
  "bg-blue-500",
  "bg-red-500",
  "bg-violet-500",
];

const AXIS_TICK = { fontSize: 11, fill: "#94a3b8" };

// Matches LOW_SURVIVAL_THRESHOLD in the backend
const SURVIVAL_TARGET = 70;

function rateColor(rate: number) {
  if (rate >= SURVIVAL_TARGET) return "#10b981";
  if (rate >= 50) return "#f59e0b";
  return "#ef4444";
}

const fmt = (n: number | undefined | null) => (n ?? 0).toLocaleString();
const fmtHa = (n: number | undefined | null) =>
  `${(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} ha`;

// ─────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────
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

function StatCard({ icon, label, value, sub, color, delay }: any) {
  return (
    <div
      className="group relative overflow-hidden rounded-2xl p-5 border border-white/60
        bg-white shadow-[0_2px_20px_rgba(5,120,0,0.06)] hover:shadow-[0_8px_32px_rgba(5,120,0,0.14)]
        transition-all duration-300 hover:-translate-y-0.5 animate-fadeUp"
      style={{ animationDelay: delay }}
    >
      <div className={`absolute top-0 left-0 right-0 h-0.5 ${color}`} />
      <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#057501]/[0.08] mb-3">
        <span className="text-[#057501]">{icon}</span>
      </div>
      <p className="text-[13px] text-gray-500 font-medium mb-0.5">{label}</p>
      <p className="text-[26px] font-bold text-gray-800 leading-none dash-title">
        {value}
      </p>
      {sub && <p className="text-[11.5px] text-gray-400 mt-1.5">{sub}</p>}
    </div>
  );
}

function SectionHeader({ title, sub, badge }: any) {
  return (
    <div className="flex items-start justify-between mb-5 gap-3">
      <div>
        <h2 className="dash-title text-[15px] font-bold text-gray-800">
          {title}
        </h2>
        {sub && <p className="text-[12px] text-gray-400 mt-0.5">{sub}</p>}
      </div>
      {badge && (
        <span className="bg-emerald-50 text-emerald-700 text-[11px] font-semibold px-3 py-1 rounded-full border border-emerald-200 shrink-0">
          {badge}
        </span>
      )}
    </div>
  );
}

function Card({ children, delay = "0s", className = "" }: any) {
  return (
    <div
      className={`bg-white rounded-2xl border border-gray-100 p-6
        shadow-[0_2px_20px_rgba(5,120,0,0.05)] animate-fadeUp ${className}`}
      style={{ animationDelay: delay }}
    >
      {children}
    </div>
  );
}

function EmptyState({ text, className = "py-10" }: any) {
  return (
    <p className={`text-center text-gray-400 text-sm ${className}`}>{text}</p>
  );
}

function ProgressBar({ label, done, total, color = "bg-emerald-500" }: any) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-[12px] font-medium text-gray-700">{label}</span>
        <span className="text-[11px] text-gray-500">
          <b className="text-gray-800">{done}</b> / {total}{" "}
          <span className="ml-1 text-gray-400">({pct}%)</span>
        </span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function DonutWithLegend({
  data,
  height = 140,
  emptyText,
}: {
  data: { name: string; value: number; fill: string }[];
  height?: number;
  emptyText: string;
}) {
  const visible = data.filter((d) => d.value > 0);
  if (visible.length === 0) return <EmptyState text={emptyText} />;
  return (
    <>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={visible}
            dataKey="value"
            nameKey="name"
            outerRadius={height * 0.4}
            innerRadius={height * 0.22}
            paddingAngle={2}
          >
            {visible.map((d, i) => (
              <Cell key={i} fill={d.fill} />
            ))}
          </Pie>
          <Tooltip content={<GreenTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-col gap-1.5 mt-2">
        {visible.map((d) => (
          <div key={d.name} className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ background: d.fill }}
            />
            <span className="text-[11px] text-gray-600">{d.name}</span>
            <span className="ml-auto text-[11px] font-bold text-gray-800">
              {d.value}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

function MiniStat({ label, value, tone = "text-gray-800" }: any) {
  return (
    <div className="bg-gray-50 rounded-xl p-3">
      <p className="text-[10px] text-gray-400 font-medium mb-1">{label}</p>
      <p className={`dash-title text-[22px] font-bold ${tone}`}>{value}</p>
    </div>
  );
}

// ─────────────────────────────────────────
// TAB: OVERVIEW
// ─────────────────────────────────────────
function TabOverview({ data }: { data: DashboardData }) {
  const s = data.stats;
  const approvalPct =
    s.total_applications > 0
      ? Math.round((s.approved / s.total_applications) * 100)
      : 0;

  const STAT_CARDS = [
    {
      icon: <ClipboardList size={20} />,
      label: "Total Applications",
      value: fmt(s.total_applications),
      sub: `${s.rejected} rejected or cancelled`,
      color: "bg-emerald-500",
    },
    {
      icon: <Clock size={20} />,
      label: "Pending Review",
      value: fmt(s.pending),
      sub: "For evaluation or head approval",
      color: "bg-amber-500",
    },
    {
      icon: <CheckCircle2 size={20} />,
      label: "Approved",
      value: fmt(s.approved),
      sub: `${approvalPct}% of all applications · awaiting orientation`,
      color: "bg-teal-500",
    },
    {
      icon: <MonitorDot size={20} />,
      label: "Programs Under Monitoring",
      value: fmt(s.under_monitoring_applications),
      sub: `${s.completed_applications} programs completed`,
      color: "bg-indigo-500",
    },
    {
      icon: <TreePine size={20} />,
      label: "Official Sites",
      value: fmt(s.official_sites),
      sub: `${fmtHa(s.official_hectares)} total area`,
      color: "bg-emerald-600",
    },
    {
      icon: <MapPin size={20} />,
      label: "Sites Verified",
      value: fmt(s.areas_assessed),
      sub: `${s.completed_sites} sites with completed programs`,
      color: "bg-teal-600",
    },
    {
      icon: <Package size={20} />,
      label: "Seedlings Released",
      value: fmt(s.trees_endorsed),
      sub: "From accepted seedling requests",
      color: "bg-green-500",
    },
    {
      icon: <Sprout size={20} />,
      label: "Seedlings Planted",
      value: fmt(s.total_seedlings_planted),
      sub: `${fmtHa(s.total_area_planted)} planted`,
      color: "bg-green-600",
    },
  ];

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {STAT_CARDS.map((c, i) => (
          <StatCard key={c.label} {...c} delay={`${0.05 + i * 0.04}s`} />
        ))}
      </div>

      {/* Row 1: Application trend + Status pie */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        <Card delay="0.4s" className="lg:col-span-2">
          <SectionHeader
            title="Application Submissions & Approvals"
            sub="Last 7 months"
            badge="Live Data"
          />
          {data.application_trend.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={data.application_trend}>
                <defs>
                  <linearGradient id="submGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="appGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" />
                <XAxis
                  dataKey="month"
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<GreenTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area
                  type="monotone"
                  dataKey="submitted"
                  name="Submitted"
                  stroke="#6366f1"
                  strokeWidth={2}
                  fill="url(#submGrad)"
                  strokeDasharray="5 3"
                />
                <Area
                  type="monotone"
                  dataKey="approved"
                  name="Approved"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fill="url(#appGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="rejected"
                  name="Rejected"
                  stroke="#ef4444"
                  strokeWidth={1.5}
                  fill="none"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState text="No applications in the last 7 months" />
          )}
        </Card>

        <Card delay="0.45s" className="flex flex-col">
          <SectionHeader
            title="Application Status"
            sub={`All ${s.total_applications} applications`}
          />
          <DonutWithLegend
            data={data.status_data}
            height={180}
            emptyText="No applications yet"
          />
        </Card>
      </div>

      {/* Row 2: Pipelines */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        <Card delay="0.5s">
          <SectionHeader
            title="Seedling Request Pipeline"
            sub="Current status of all seedling requests"
          />
          <DonutWithLegend
            data={data.seedling_request_pipeline}
            emptyText="No seedling requests yet"
          />
        </Card>

        <Card delay="0.53s">
          <SectionHeader
            title="Site Verification Pipeline"
            sub="Site data review status"
          />
          <DonutWithLegend
            data={data.site_verification_pipeline}
            emptyText="No verifications yet"
          />
        </Card>

        <Card delay="0.56s">
          <SectionHeader
            title="Approval Rate Trend"
            sub="Monthly approval rate %"
          />
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={data.approval_rate}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#f0fdf4"
                vertical={false}
              />
              <XAxis
                dataKey="month"
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<GreenTooltip />} />
              <Line
                type="monotone"
                dataKey="rate"
                name="Approval %"
                stroke="#10b981"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "#10b981", strokeWidth: 0 }}
                activeDot={{ r: 5, fill: "#0F4A2F" }}
              />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-2 mt-3 bg-emerald-50 rounded-xl px-4 py-2.5">
            <TrendingUp size={14} className="text-emerald-600" />
            <span className="text-[12px] text-emerald-700 font-medium">
              Avg{" "}
              {data.approval_rate.length > 0
                ? Math.round(
                    data.approval_rate.reduce((sum, r) => sum + r.rate, 0) /
                      data.approval_rate.length,
                  )
                : 0}
              % approval rate
            </span>
          </div>
        </Card>
      </div>

      {/* Row 3: Sites by barangay + Assessors */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        <Card delay="0.6s" className="lg:col-span-2">
          <SectionHeader
            title="Sites by Barangay"
            sub="Top barangays by number of proposed sites"
          />
          {data.assessment_data.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.assessment_data} barGap={4}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#f0fdf4"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<GreenTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar
                  dataKey="assessed"
                  name="Total Sites"
                  fill="#c7d2fe"
                  radius={[5, 5, 0, 0]}
                />
                <Bar
                  dataKey="approved"
                  name="Accepted"
                  fill="#10b981"
                  radius={[5, 5, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState text="No site data yet" className="py-12" />
          )}
        </Card>

        <Card delay="0.63s">
          <SectionHeader
            title="Inspectors"
            sub={`${s.assessors} active onsite inspectors`}
          />
          <div className="flex flex-col gap-2.5">
            {data.assessors.length > 0 ? (
              data.assessors.map((a, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center text-white text-[11px] font-bold shrink-0 ${["bg-[#0F4A2F]", "bg-blue-700", "bg-violet-700", "bg-teal-700", "bg-orange-700", "bg-rose-700"][i % 6]}`}
                  >
                    {a.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-bold text-gray-800 truncate">
                      {a.name}
                    </p>
                    <p className="text-[10.5px] text-gray-400">
                      {a.assessments} verified · {a.approved} approved
                    </p>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${a.pending_seedlings > 0 ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}
                  >
                    {a.pending_seedlings > 0
                      ? `${a.pending_seedlings} pending`
                      : "Clear"}
                  </span>
                </div>
              ))
            ) : (
              <EmptyState text="No inspectors" className="py-8" />
            )}
          </div>
        </Card>
      </div>

      {/* Bottom row: Recent apps + Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card delay="0.66s" className="lg:col-span-2">
          <SectionHeader title="Recent Applications" />
          <div className="flex flex-col gap-2.5">
            {data.recent_apps.length > 0 ? (
              data.recent_apps.map((a) => (
                <div
                  key={a.ref}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition"
                >
                  <div className="w-20 shrink-0">
                    <p className="text-[12px] font-bold text-gray-800">
                      {a.ref}
                    </p>
                    <p className="text-[10px] text-gray-400">{a.created_at}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11.5px] text-gray-700 truncate">
                      {a.title}
                    </p>
                    <p className="text-[10.5px] text-gray-400 truncate">
                      {a.area} · {a.hectares}
                    </p>
                  </div>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${STATUS_BADGE[a.status] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}
                  >
                    {a.status}
                  </span>
                </div>
              ))
            ) : (
              <EmptyState text="No recent applications" className="py-8" />
            )}
          </div>
        </Card>

        <Card delay="0.7s">
          <SectionHeader title="Recent Activity" />
          <div className="flex flex-col gap-3">
            {data.recent_activities.length > 0 ? (
              data.recent_activities.slice(0, 6).map((a) => {
                const st = ACT_STYLE[a.type] || ACT_STYLE.info;
                return (
                  <div key={a.id} className="flex items-start gap-3">
                    <div
                      className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${st.bg}`}
                    >
                      {st.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] font-bold text-gray-800">
                          {a.ref}
                        </span>
                        <span className="text-[10.5px] text-gray-400">
                          {a.time}
                        </span>
                      </div>
                      <p className="text-[11.5px] text-gray-500 leading-tight">
                        {a.action}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        by {a.officer}
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <EmptyState text="No recent activity" className="py-8" />
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// TAB: MONITORING & PROGRESS
// ─────────────────────────────────────────
function TabMonitoring({ data }: { data: DashboardData }) {
  const m = data.monitoring_summary;
  const prs = data.progress_report_stats;
  const trend = data.planting_trend;

  const KPI_CARDS = [
    {
      icon: <TreePine size={20} />,
      label: "Official Sites",
      value: fmt(m.official_sites),
      sub: `${fmtHa(m.official_hectares)} total area`,
      color: "bg-emerald-600",
    },
    {
      icon: <MonitorDot size={20} />,
      label: "Under Monitoring",
      value: fmt(m.sites_under_monitoring),
      sub: `${fmtHa(m.hectares_under_monitoring)} being monitored`,
      color: "bg-indigo-500",
    },
    {
      icon: <Layers size={20} />,
      label: "Available Sites",
      value: fmt(m.available_sites),
      sub: "Open for new programs",
      color: "bg-teal-500",
    },
    {
      icon: <MapPin size={20} />,
      label: "Sites Planted",
      value: fmt(m.sites_planted),
      sub: `${fmtHa(m.planted_hectares)} planted area`,
      color: "bg-green-600",
    },
    {
      icon: <Sprout size={20} />,
      label: "Total Plants Planted",
      value: fmt(m.total_planted),
      sub: `${fmt(m.total_survived)} alive · ${fmt(m.total_dead)} dead`,
      color: "bg-emerald-500",
    },
    {
      icon: <Heart size={20} />,
      label: "Survival Rate",
      value: `${m.survival_rate}%`,
      sub:
        m.survival_rate >= SURVIVAL_TARGET
          ? `On target (≥ ${SURVIVAL_TARGET}%)`
          : `Below ${SURVIVAL_TARGET}% target`,
      color: m.survival_rate >= SURVIVAL_TARGET ? "bg-green-500" : "bg-red-500",
    },
  ];

  const hasTrend = trend.some((t) => t.cumulative_seedlings > 0 || t.visits > 0);

  return (
    <div className="flex flex-col gap-5">
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {KPI_CARDS.map((c, i) => (
          <StatCard key={c.label} {...c} delay={`${0.05 + i * 0.04}s`} />
        ))}
      </div>

      {/* Planting progress + Site status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2" delay="0.3s">
          <SectionHeader
            title="Planting Progress"
            sub="Plants planted each month, with running totals of plants and planted area"
            badge={`${fmtHa(m.planted_hectares)} planted`}
          />
          {hasTrend ? (
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={trend}>
                <defs>
                  <linearGradient id="cumGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" />
                <XAxis
                  dataKey="month"
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="left"
                  allowDecimals={false}
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  unit=" ha"
                />
                <Tooltip content={<GreenTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="cumulative_seedlings"
                  name="Total Plants"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#cumGrad)"
                />
                <Bar
                  yAxisId="left"
                  dataKey="new_seedlings"
                  name="Planted This Month"
                  fill="#86efac"
                  radius={[4, 4, 0, 0]}
                  barSize={18}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="cumulative_hectares"
                  name="Planted Area (ha)"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "#6366f1", strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: "#0F4A2F" }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState text="No accepted progress reports yet" className="py-16" />
          )}
        </Card>

        <Card delay="0.34s">
          <SectionHeader
            title="Official Site Status"
            sub={`${m.official_sites} sites · ${fmtHa(m.official_hectares)}`}
          />
          {m.official_sites > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie
                    data={data.monitoring_status_breakdown.filter((d) => d.value > 0)}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={62}
                    innerRadius={36}
                    paddingAngle={2}
                  >
                    {data.monitoring_status_breakdown
                      .filter((d) => d.value > 0)
                      .map((d, i) => (
                        <Cell key={i} fill={d.fill} />
                      ))}
                  </Pie>
                  <Tooltip content={<GreenTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-2 mt-3">
                {data.monitoring_status_breakdown.map((d) => (
                  <div key={d.key} className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: d.fill }}
                    />
                    <span className="text-[11.5px] text-gray-600">{d.name}</span>
                    <span className="ml-auto text-[11px] text-gray-400">
                      {fmtHa(d.hectares)}
                    </span>
                    <span className="w-6 text-right text-[11.5px] font-bold text-gray-800">
                      {d.value}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState text="No official sites yet" />
          )}
        </Card>
      </div>

      {/* Sites planted trend + Survival trend + Visit compliance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card delay="0.38s">
          <SectionHeader
            title="Sites Planted"
            sub="New planted sites per month and running total"
          />
          {hasTrend ? (
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={trend}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#f0fdf4"
                  vertical={false}
                />
                <XAxis
                  dataKey="month"
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  allowDecimals={false}
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<GreenTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar
                  dataKey="new_sites"
                  name="New Sites"
                  fill="#a5b4fc"
                  radius={[4, 4, 0, 0]}
                  barSize={14}
                />
                <Line
                  type="stepAfter"
                  dataKey="cumulative_sites"
                  name="Total Sites"
                  stroke="#4f46e5"
                  strokeWidth={2.5}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState text="No planted sites yet" className="py-16" />
          )}
        </Card>

        <Card delay="0.42s">
          <SectionHeader
            title="Survival Rate Trend"
            sub={`Running survival rate · target ${SURVIVAL_TARGET}%`}
          />
          {trend.some((t) => t.survival_rate !== null) ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trend}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#f0fdf4"
                  vertical={false}
                />
                <XAxis
                  dataKey="month"
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={[0, 100]}
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  unit="%"
                />
                <Tooltip content={<GreenTooltip />} />
                <ReferenceLine
                  y={SURVIVAL_TARGET}
                  stroke="#f59e0b"
                  strokeDasharray="4 4"
                  label={{
                    value: "Target",
                    position: "insideTopRight",
                    fontSize: 10,
                    fill: "#f59e0b",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="survival_rate"
                  name="Survival %"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  connectNulls
                  dot={{ r: 3, fill: "#10b981", strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: "#0F4A2F" }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState text="No survival data yet" className="py-16" />
          )}
        </Card>

        <Card delay="0.46s">
          <SectionHeader
            title="Visit Compliance"
            sub="Field visits and report reviews"
          />
          <div className="grid grid-cols-2 gap-3 mb-4">
            <MiniStat
              label="Visits (last 30 days)"
              value={m.visits_last_30_days}
              tone="text-emerald-600"
            />
            <MiniStat
              label={`Overdue (> ${m.overdue_days} days)`}
              value={m.overdue_sites}
              tone={m.overdue_sites > 0 ? "text-red-500" : "text-gray-800"}
            />
            <MiniStat
              label="No visit yet"
              value={m.sites_without_visit}
              tone={m.sites_without_visit > 0 ? "text-amber-600" : "text-gray-800"}
            />
            <MiniStat
              label="Reports to review"
              value={m.pending_reports}
              tone={m.pending_reports > 0 ? "text-amber-600" : "text-gray-800"}
            />
          </div>
          <div className="flex flex-col gap-3">
            <ProgressBar
              label="Initial visits accepted"
              done={prs.initial_completed}
              total={prs.total_initial}
              color="bg-emerald-500"
            />
            <ProgressBar
              label="Ongoing visits accepted"
              done={prs.ongoing_completed}
              total={prs.total_ongoing}
              color="bg-indigo-500"
            />
          </div>
        </Card>
      </div>

      {/* Site progress table */}
      <Card delay="0.5s">
        <SectionHeader
          title="Site Progress"
          sub="Planted area, plant count and survival per monitored site"
          badge={`${data.site_progress.length} sites`}
        />
        {data.site_progress.length > 0 ? (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-left min-w-[860px]">
              <thead>
                <tr className="text-[10.5px] uppercase tracking-wider text-gray-400 border-b border-gray-100">
                  <th className="px-2 py-2 font-semibold">Site</th>
                  <th className="px-2 py-2 font-semibold">Status</th>
                  <th className="px-2 py-2 font-semibold text-right">Site Area</th>
                  <th className="px-2 py-2 font-semibold text-right">Planted Area</th>
                  <th className="px-2 py-2 font-semibold text-right">Planted</th>
                  <th className="px-2 py-2 font-semibold text-right">Alive</th>
                  <th className="px-2 py-2 font-semibold w-[160px]">Survival</th>
                  <th className="px-2 py-2 font-semibold text-right">Visits</th>
                  <th className="px-2 py-2 font-semibold">Last Visit</th>
                </tr>
              </thead>
              <tbody>
                {data.site_progress.map((s) => {
                  const coverage =
                    s.site_hectares > 0
                      ? Math.min(Math.round((s.planted_hectares / s.site_hectares) * 100), 100)
                      : null;
                  return (
                    <tr
                      key={s.site_id}
                      className="border-b border-gray-50 hover:bg-gray-50/70 transition text-[12px]"
                    >
                      <td className="px-2 py-2.5">
                        <p className="font-bold text-gray-800 truncate max-w-[200px]">
                          {s.name}
                        </p>
                        <p className="text-[10.5px] text-gray-400">{s.barangay}</p>
                      </td>
                      <td className="px-2 py-2.5">
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${MONITORING_BADGE[s.monitoring_status] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}
                        >
                          {s.monitoring_status}
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-right text-gray-600">
                        {fmtHa(s.site_hectares)}
                      </td>
                      <td className="px-2 py-2.5 text-right">
                        <span className="text-gray-800 font-semibold">
                          {fmtHa(s.planted_hectares)}
                        </span>
                        {coverage !== null && (
                          <p className="text-[10px] text-gray-400">{coverage}% of site</p>
                        )}
                      </td>
                      <td className="px-2 py-2.5 text-right text-gray-700">
                        {fmt(s.planted)}
                      </td>
                      <td className="px-2 py-2.5 text-right text-gray-700">
                        {fmt(s.survived)}
                      </td>
                      <td className="px-2 py-2.5">
                        {s.planted > 0 ? (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${s.rate}%`,
                                  background: rateColor(s.rate),
                                }}
                              />
                            </div>
                            <span
                              className="text-[11.5px] font-bold w-11 text-right"
                              style={{ color: rateColor(s.rate) }}
                            >
                              {s.rate}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-2 py-2.5 text-right text-gray-700">
                        {s.visits}
                      </td>
                      <td className="px-2 py-2.5">
                        <span
                          className={`text-[11px] ${s.overdue ? "text-red-500 font-semibold" : s.no_visit ? "text-amber-600 font-semibold" : "text-gray-500"}`}
                        >
                          {s.last_visit}
                        </span>
                        {s.overdue && (
                          <p className="text-[10px] text-red-400">Overdue</p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState text="No monitored sites yet" />
        )}
      </Card>

      {/* Survival by species + Top performing sites */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2" delay="0.54s">
          <SectionHeader
            title="Survival Rate by Species"
            sub="Which species do best — useful for choosing seedlings for new programs"
          />
          {data.survival_by_species.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.survival_by_species} layout="vertical">
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#f0fdf4"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  unit="%"
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                  width={110}
                />
                <Tooltip content={<GreenTooltip />} />
                <ReferenceLine
                  x={SURVIVAL_TARGET}
                  stroke="#f59e0b"
                  strokeDasharray="4 4"
                />
                <Bar dataKey="rate" name="Survival %" radius={[0, 5, 5, 0]}>
                  {data.survival_by_species.map((sp, i) => (
                    <Cell key={i} fill={rateColor(sp.rate)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState text="No survival data yet" className="py-12" />
          )}
        </Card>

        <Card delay="0.58s">
          <SectionHeader
            title="Top Performing Sites"
            sub="Highest survival rates"
          />
          <div className="flex flex-col gap-2.5">
            {data.top_performing_sites.length > 0 ? (
              data.top_performing_sites.map((s, i) => (
                <div
                  key={s.site_id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition"
                >
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0 ${ZONE_ACCENTS[i % ZONE_ACCENTS.length]}`}
                  >
                    {i === 0 ? (
                      <Trophy size={13} />
                    ) : (
                      <span className="text-[11px] font-bold">#{i + 1}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-bold text-gray-800 truncate">
                      {s.name}
                    </p>
                    <p className="text-[10.5px] text-gray-400 truncate">
                      {s.barangay} · {fmtHa(s.planted_hectares)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className="text-[13px] font-bold"
                      style={{ color: rateColor(s.rate) }}
                    >
                      {s.rate}%
                    </p>
                    <p className="text-[9px] text-gray-400">
                      {fmt(s.survived)}/{fmt(s.planted)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState text="No data yet" className="py-8" />
            )}
          </div>
        </Card>
      </div>

      {/* Sites needing attention */}
      <Card delay="0.62s">
        <SectionHeader
          title="Sites Needing Attention"
          sub={`Overdue visits (> ${m.overdue_days} days), no visit yet, or survival below ${SURVIVAL_TARGET}%`}
        />
        {data.sites_needing_attention.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.sites_needing_attention.map((s) => {
              const Icon = s.overdue
                ? CalendarClock
                : s.no_visit
                  ? FileClock
                  : AlertCircle;
              const tone = s.overdue || (!s.no_visit && s.rate < 50)
                ? "border-red-100 bg-red-50/40 text-red-500"
                : "border-amber-100 bg-amber-50/40 text-amber-600";
              return (
                <div
                  key={s.site_id}
                  className={`flex items-start gap-3 p-3 rounded-xl border ${tone}`}
                >
                  <Icon size={16} className="mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-bold text-gray-800 truncate">
                      {s.name}
                    </p>
                    <p className="text-[10.5px] text-gray-500 truncate">
                      {s.barangay}
                    </p>
                    <p className="text-[11px] font-semibold mt-1">{s.reason}</p>
                    {!s.no_visit && (
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {s.rate}% survival · {fmt(s.dead)} dead · last visit{" "}
                        {s.last_visit}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState text="All monitored sites are on track 🌱" className="py-8" />
        )}
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────
// ROOT COMPONENT
// ─────────────────────────────────────────
export default function DashboardAFA() {
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [time, setTime] = useState(new Date());
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setIsAuthorized(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch(api + "api/get_me/", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        const resData = await res.json();
        setIsAuthorized(res.ok && resData.user_role === "DataManager");
      } catch {
        setIsAuthorized(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (isAuthorized) fetchDashboardData();
  }, [isAuthorized]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${api}api/get_dashboard_data/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch dashboard data");
      setData(await res.json());
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  if (isAuthorized === null) {
    return (
      <div className="min-h-screen bg-[#f5faf6] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
          <p className="text-[13px] text-gray-400 font-medium">
            Verifying access…
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-[#f5faf6] flex items-center justify-center">
        <div className="bg-white rounded-2xl p-10 border border-gray-100 shadow-[0_4px_32px_rgba(0,0,0,.07)] text-center max-w-sm w-full mx-4">
          <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <XCircle size={28} className="text-red-400" />
          </div>
          <h2 className="dash-title text-[22px] font-bold text-gray-800 mb-2">
            Access Denied
          </h2>
          <p className="text-[13px] text-gray-500 leading-relaxed">
            You are not authorized to view this page. Please log in with a
            DataManager account.
          </p>
          <button
            onClick={() => {
              localStorage.removeItem("token");
              window.location.href = "/login";
            }}
            className="mt-6 w-full bg-[#0F4A2F] text-white text-[13px] font-semibold py-3 rounded-xl hover:bg-[#0a3522] transition-colors cursor-pointer"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  const dateStr = time.toLocaleDateString("en-PH", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const timeStr = time.toLocaleTimeString("en-PH", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Barlow+Condensed:wght@600;700;800&display=swap');
        .dash-root  { font-family: 'DM Sans', sans-serif; }
        .dash-title { font-family: 'Barlow Condensed', sans-serif; letter-spacing: -0.01em; }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeUp { animation: fadeUp .5s ease both; }
        .recharts-cartesian-grid-horizontal line,
        .recharts-cartesian-grid-vertical   line { stroke: #f0fdf4; }
      `}</style>

      <div className="dash-root bg-[#f5faf6] min-h-screen p-6 overflow-x-hidden">
        {/* Weather strip */}
        <div className="flex items-center gap-4 lg:gap-6 mb-6 bg-[#0F4A2F] rounded-2xl px-5 py-3 shadow-[0_4px_24px_rgba(15,74,47,0.25)] animate-fadeUp flex-wrap">
          <div className="flex items-center gap-2">
            <Globe2 size={15} className="text-emerald-300" />
            <span className="text-emerald-200 text-[11px] font-bold tracking-wider uppercase">
              Ormoc City — Live Conditions
            </span>
          </div>
          <div className="w-px h-5 bg-white/20 hidden sm:block" />
          {WEATHER_DATA.map((w) => (
            <div
              key={w.label}
              className="flex items-center gap-1.5 text-white/70 text-[12.5px]"
            >
              <span className="text-emerald-400">{w.icon}</span>
              <span className="text-white/40">{w.label}</span>
              <span className="text-white font-semibold">{w.value}</span>
            </div>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-400/80 text-[11px] font-medium tabular-nums">
              {dateStr} · {timeStr}
            </span>
          </div>
        </div>

        {/* Header */}
        <div
          className="mb-6 animate-fadeUp"
          style={{ animationDelay: "0.02s" }}
        >
          <h1 className="dash-title text-[28px] font-bold text-[#0F4A2F]">
            DataManager Dashboard
          </h1>
          <p className="text-[13px] text-gray-500 mt-0.5">
            GIS-based site suitability · Reforestation monitoring · Geospatial
            analytics · Ormoc City CENRO
          </p>
        </div>

        {/* Tabs */}
        <div
          className="flex gap-1.5 mb-6 bg-white rounded-xl p-1.5 border border-gray-100 shadow-[0_1px_8px_rgba(0,0,0,0.05)] w-fit animate-fadeUp"
          style={{ animationDelay: "0.04s" }}
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-5 py-2 rounded-lg text-[12px] font-semibold transition-all cursor-pointer
                ${activeTab === t.id ? "bg-[#0F4A2F] text-white shadow-sm" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"}`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading && !data ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 size={40} className="animate-spin text-[#0F4A2F] mb-4" />
            <p className="text-gray-500 font-medium">
              Loading dashboard data...
            </p>
          </div>
        ) : data ? (
          <>
            {activeTab === "overview" && <TabOverview data={data} />}
            {activeTab === "monitoring" && <TabMonitoring data={data} />}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-20">
            <p className="text-gray-500 font-medium">
              Failed to load dashboard data
            </p>
            <button
              onClick={fetchDashboardData}
              className="mt-4 px-4 py-2 bg-[#0F4A2F] text-white rounded-lg text-sm font-semibold hover:bg-[#1a6b44]"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </>
  );
}
