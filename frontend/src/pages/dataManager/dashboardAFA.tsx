import { useEffect, useState } from "react";
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
  RadialBarChart,
  RadialBar,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  TrendingUp,
  MapPin,
  Users,
  CheckCircle2,
  Clock,
  XCircle,
  Sprout,
  Globe2,
  Droplets,
  Wind,
  Thermometer,
  Eye,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  ClipboardList,
  Loader2,
  FileText,
  Shield,
  Leaf,
  Building2,
  FileCheck,
  Package,
  AlertCircle,
  TreePine,
  Heart,
} from "lucide-react";

// ─────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────
interface DashboardData {
  stats: {
    total_applications: number;
    approved: number;
    pending: number;
    rejected: number;
    completed_applications: number;
    completed_sites: number;
    total_seedlings_planted: number;
    total_area_planted: number;
    areas_assessed: number;
    assessors: number;
    trees_endorsed: number;
    overall_survival_rate: number;
    active_alerts: number;
  };
  application_trend: {
    month: string;
    submitted: number;
    approved: number;
    rejected: number;
  }[];
  seedlings_planted_trend: {
    month: string;
    seedlings_planted: number;
    cumulative_seedlings: number;
    cumulative_area_hectares: number;
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
  all_apps: {
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
  barangay_breakdown: {
    name: string;
    apps: number;
    trees: number;
    rate: number;
  }[];
  // NEW
  seedling_request_pipeline: { name: string; value: number; fill: string }[];
  site_verification_pipeline: { name: string; value: number; fill: string }[];
  progress_report_stats: {
    total_initial: number;
    initial_completed: number;
    total_ongoing: number;
    ongoing_completed: number;
  };
  survival_by_species: {
    name: string;
    planted: number;
    survived: number;
    dead: number;
    rate: number;
  }[];
  survival_by_barangay: {
    name: string;
    survived: number;
    dead: number;
    rate: number;
  }[];
  documentation_stats: {
    apps_with_maintenance_plan: number;
    apps_total: number;
    sites_with_permits: number;
    sites_total: number;
    initial_visits_with_agreement: number;
    initial_visits_total: number;
    permit_docs_by_type: {
      document_type: string;
      count: number;
      display: string;
    }[];
  };
  top_performing_sites: {
    name: string;
    barangay: string;
    survived: number;
    dead: number;
    total: number;
    rate: number;
  }[];
  sites_needing_attention: {
    name: string;
    barangay: string;
    survived: number;
    dead: number;
    total: number;
    rate: number;
    last_visit: string;
  }[];
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
  {
    id: "documentation",
    label: "Documentation",
    icon: <FileCheck size={13} />,
  },
];

const ACT_STYLE: Record<string, { bg: string; icon: JSX.Element }> = {
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

const ZONE_ACCENTS = [
  "bg-emerald-500",
  "bg-indigo-500",
  "bg-amber-500",
  "bg-blue-500",
  "bg-red-500",
  "bg-violet-500",
];
const ZONE_HEX = [
  "#10b981",
  "#6366f1",
  "#f59e0b",
  "#3b82f6",
  "#ef4444",
  "#8b5cf6",
];

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
          {p.name}: <b>{p.value}</b>
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
  trend,
  trendVal,
  color,
  delay,
}: any) {
  const up = trend === "up",
    down = trend === "down";
  return (
    <div
      className="group relative overflow-hidden rounded-2xl p-5 border border-white/60
        bg-white shadow-[0_2px_20px_rgba(5,120,0,0.06)] hover:shadow-[0_8px_32px_rgba(5,120,0,0.14)]
        transition-all duration-300 hover:-translate-y-0.5 animate-fadeUp"
      style={{ animationDelay: delay }}
    >
      <div className={`absolute top-0 left-0 right-0 h-0.5 ${color}`} />
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#057501]/[0.08]">
          <span className="text-[#057501]">{icon}</span>
        </div>
        {trend && (
          <span
            className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full
            ${
              up
                ? "bg-emerald-50 text-emerald-600"
                : down
                  ? "bg-red-50 text-red-500"
                  : "bg-gray-100 text-gray-500"
            }`}
          >
            {up ? (
              <ArrowUpRight size={11} />
            ) : down ? (
              <ArrowDownRight size={11} />
            ) : (
              <Minus size={11} />
            )}
            {trendVal}
          </span>
        )}
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
    <div className="flex items-start justify-between mb-5">
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

/** Gauge chart built with RadialBarChart (semi-circle) */
function GaugeChart({
  value,
  label,
  color = "#10b981",
  size = 180,
}: {
  value: number;
  label: string;
  color?: string;
  size?: number;
}) {
  const gaugeData = [
    { name: "value", value: value, fill: color },
    { name: "empty", value: 100 - value, fill: "#f1f5f9" },
  ];
  return (
    <div className="flex flex-col items-center justify-center">
      <ResponsiveContainer width={size} height={size * 0.65}>
        <RadialBarChart
          innerRadius="70%"
          outerRadius="100%"
          data={gaugeData}
          startAngle={180}
          endAngle={0}
          barSize={14}
        >
          <RadialBar background dataKey="value" cornerRadius={10} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="text-center -mt-12">
        <p className="dash-title text-[32px] font-extrabold" style={{ color }}>
          {value}%
        </p>
        <p className="text-[11px] text-gray-500 font-medium">{label}</p>
      </div>
    </div>
  );
}

function ComplianceBar({ label, done, total, color = "bg-emerald-500" }: any) {
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

// ─────────────────────────────────────────
// TAB: OVERVIEW
// ─────────────────────────────────────────
function TabOverview({ data }: { data: DashboardData }) {
  const STAT_CARDS = [
    {
      icon: <ClipboardList size={20} />,
      label: "Total Applications",
      value: data.stats.total_applications.toLocaleString(),
      sub: `${data.stats.pending} pending review`,
      trend: "up",
      trendVal: "+12",
      color: "bg-emerald-500",
      delay: "0.05s",
    },
    {
      icon: <CheckCircle2 size={20} />,
      label: "Approved",
      value: data.stats.approved.toLocaleString(),
      sub: `${data.stats.total_applications > 0 ? Math.round((data.stats.approved / data.stats.total_applications) * 100) : 0}% approval rate`,
      trend: "up",
      trendVal: "+8%",
      color: "bg-teal-500",
      delay: "0.1s",
    },
    {
      icon: <Clock size={20} />,
      label: "Pending Review",
      value: data.stats.pending.toLocaleString(),
      sub: "Awaiting evaluation",
      trend: "down",
      trendVal: "-3",
      color: "bg-amber-500",
      delay: "0.15s",
    },
    {
      icon: <Sprout size={20} />,
      label: "Survival Rate",
      value: `${data.stats.overall_survival_rate}%`,
      sub: `From ${data.stats.total_seedlings_planted.toLocaleString()} planted`,
      trend: "up",
      trendVal: "+2.1%",
      color: "bg-green-600",
      delay: "0.2s",
    },
    {
      icon: <TreePine size={20} />,
      label: "Seedlings Planted",
      value: data.stats.total_seedlings_planted.toLocaleString(),
      sub: `${data.stats.total_area_planted} ha covered`,
      trend: "up",
      trendVal: "+15%",
      color: "bg-emerald-600",
      delay: "0.25s",
    },
    {
      icon: <Package size={20} />,
      label: "Seedlings Endorsed",
      value: data.stats.trees_endorsed.toLocaleString(),
      sub: "From accepted requests",
      trend: "up",
      trendVal: "+12%",
      color: "bg-green-500",
      delay: "0.3s",
    },
    {
      icon: <MapPin size={20} />,
      label: "Sites Assessed",
      value: data.stats.areas_assessed.toLocaleString(),
      sub: `${data.stats.completed_sites} sites completed`,
      trend: "up",
      trendVal: "+5",
      color: "bg-teal-600",
      delay: "0.35s",
    },
    {
      icon: <AlertTriangle size={20} />,
      label: "Active Alerts",
      value: data.stats.active_alerts.toLocaleString(),
      sub: "Requires attention",
      trend: "down",
      trendVal: "-1",
      color: "bg-orange-500",
      delay: "0.4s",
    },
  ];

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {STAT_CARDS.map((c) => (
          <StatCard key={c.label} {...c} />
        ))}
      </div>

      {/* Row 1: Application trend + Status pie */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        <Card delay="0.45s" className="lg:col-span-2">
          <SectionHeader
            title="Application Submissions & Approvals"
            sub="Last 7 months • All assessment areas"
            badge="Live Data"
          />
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
                tick={{ fontSize: 12, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "#94a3b8" }}
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
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card delay="0.5s" className="flex flex-col">
          <SectionHeader
            title="Application Status"
            sub={`All ${data.stats.total_applications} applications`}
          />
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={data.status_data}
                dataKey="value"
                nameKey="name"
                outerRadius={72}
                innerRadius={38}
                paddingAngle={3}
              >
                {data.status_data.map((d, i) => (
                  <Cell key={i} fill={d.fill} />
                ))}
              </Pie>
              <Tooltip content={<GreenTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-2 mt-3">
            {data.status_data.map((d) => (
              <div key={d.name} className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: d.fill }}
                />
                <span className="text-[11.5px] text-gray-600">{d.name}</span>
                <span className="ml-auto text-[11.5px] font-bold text-gray-800">
                  {d.value}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Row 2: Pipelines */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        <Card delay="0.52s">
          <SectionHeader
            title="Seedling Request Pipeline"
            sub="Current status of all seedling requests"
          />
          {data.seedling_request_pipeline.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie
                    data={data.seedling_request_pipeline}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={55}
                    innerRadius={30}
                    paddingAngle={2}
                  >
                    {data.seedling_request_pipeline.map((d, i) => (
                      <Cell key={i} fill={d.fill} />
                    ))}
                  </Pie>
                  <Tooltip content={<GreenTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-1.5 mt-2">
                {data.seedling_request_pipeline.map((d) => (
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
          ) : (
            <p className="text-center text-gray-400 text-sm py-10">
              No seedling requests yet
            </p>
          )}
        </Card>

        <Card delay="0.55s">
          <SectionHeader
            title="Site Verification Pipeline"
            sub="DataManager review status"
          />
          {data.site_verification_pipeline.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie
                    data={data.site_verification_pipeline}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={55}
                    innerRadius={30}
                    paddingAngle={2}
                  >
                    {data.site_verification_pipeline.map((d, i) => (
                      <Cell key={i} fill={d.fill} />
                    ))}
                  </Pie>
                  <Tooltip content={<GreenTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-1.5 mt-2">
                {data.site_verification_pipeline.map((d) => (
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
          ) : (
            <p className="text-center text-gray-400 text-sm py-10">
              No verifications yet
            </p>
          )}
        </Card>

        <Card delay="0.58s">
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
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: "#94a3b8" }}
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
                    data.approval_rate.reduce((s, r) => s + r.rate, 0) /
                      data.approval_rate.length,
                  )
                : 0}
              % approval rate
            </span>
          </div>
        </Card>
      </div>

      {/* Row 3: Seedlings trend + Assessors */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        <Card delay="0.6s" className="lg:col-span-2">
          <SectionHeader
            title="Seedlings Planted Over Time"
            sub="Cumulative planting progress with area (2m spacing)"
            badge={`${data.stats.total_area_planted} ha total`}
          />
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={data.seedlings_planted_trend}>
              <defs>
                <linearGradient id="seedlingsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 12, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
                label={{
                  value: "Seedlings",
                  angle: -90,
                  position: "insideLeft",
                  style: { fontSize: 11, fill: "#94a3b8" },
                }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 12, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
                label={{
                  value: "Hectares",
                  angle: 90,
                  position: "insideRight",
                  style: { fontSize: 11, fill: "#94a3b8" },
                }}
              />
              <Tooltip content={<GreenTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="seedlings_planted"
                name="Monthly Planted"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#seedlingsGrad)"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="cumulative_area_hectares"
                name="Cumulative Area (ha)"
                stroke="#6366f1"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "#6366f1", strokeWidth: 0 }}
                activeDot={{ r: 5, fill: "#0F4A2F" }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>

        <Card delay="0.63s">
          <SectionHeader
            title="Assessors"
            sub={`${data.stats.assessors} active inspectors`}
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
                  {a.pending_seedlings > 0 && (
                    <span className="bg-amber-50 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-200">
                      {a.pending_seedlings} pending
                    </span>
                  )}
                </div>
              ))
            ) : (
              <p className="text-center text-gray-400 text-sm py-8">
                No inspectors
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* Bottom row: Recent apps + Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card delay="0.65s" className="lg:col-span-2">
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
              <p className="text-center text-gray-400 text-sm py-8">
                No recent applications
              </p>
            )}
          </div>
        </Card>

        <Card delay="0.7s">
          <div className="flex items-center justify-between mb-4">
            <h2 className="dash-title text-[15px] font-bold text-gray-800">
              Recent Activity
            </h2>
          </div>
          <div className="flex flex-col gap-3">
            {data.recent_activities.length > 0 ? (
              data.recent_activities.slice(0, 6).map((a) => {
                const s = ACT_STYLE[a.type] || ACT_STYLE.info;
                return (
                  <div key={a.id} className="flex items-start gap-3">
                    <div
                      className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${s.bg}`}
                    >
                      {s.icon}
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
              <p className="text-center text-gray-400 text-sm py-8">
                No recent activity
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// TAB: MONITORING & SURVIVAL
// ─────────────────────────────────────────
function TabMonitoring({ data }: { data: DashboardData }) {
  const { progress_report_stats } = data;

  return (
    <div className="flex flex-col gap-5">
      {/* Top: Overall survival gauge + visit stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card>
          <SectionHeader
            title="Overall Survival Rate"
            sub="Across all accepted progress reports"
          />
          <GaugeChart
            value={data.stats.overall_survival_rate}
            label="Survival Rate"
            color="#10b981"
          />
        </Card>

        <Card>
          <SectionHeader
            title="Initial Visits (Orientation)"
            sub="Baseline & agreement signing"
          />
          <div className="flex flex-col gap-4 mt-4">
            <ComplianceBar
              label="Initial visits completed"
              done={progress_report_stats.initial_completed}
              total={progress_report_stats.total_initial}
              color="bg-emerald-500"
            />
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-[10px] text-gray-400 font-medium mb-1">
                  Total Visits
                </p>
                <p className="dash-title text-[22px] font-bold text-gray-800">
                  {progress_report_stats.total_initial}
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-[10px] text-gray-400 font-medium mb-1">
                  Completed
                </p>
                <p className="dash-title text-[22px] font-bold text-emerald-600">
                  {progress_report_stats.initial_completed}
                </p>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <SectionHeader
            title="Ongoing Monitoring"
            sub="Follow-up site visits"
          />
          <div className="flex flex-col gap-4 mt-4">
            <ComplianceBar
              label="Ongoing visits completed"
              done={progress_report_stats.ongoing_completed}
              total={progress_report_stats.total_ongoing}
              color="bg-indigo-500"
            />
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-[10px] text-gray-400 font-medium mb-1">
                  Total Visits
                </p>
                <p className="dash-title text-[22px] font-bold text-gray-800">
                  {progress_report_stats.total_ongoing}
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-[10px] text-gray-400 font-medium mb-1">
                  Completed
                </p>
                <p className="dash-title text-[22px] font-bold text-indigo-600">
                  {progress_report_stats.ongoing_completed}
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Survival by species + Top performing sites */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2">
          <SectionHeader
            title="Survival Rate by Species"
            sub="Which species thrive in Ormoc"
          />
          {data.survival_by_species.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={data.survival_by_species}
                layout="vertical"
                barGap={4}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#f0fdf4"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                  width={100}
                />
                <Tooltip content={<GreenTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar
                  dataKey="rate"
                  name="Survival %"
                  fill="#10b981"
                  radius={[0, 5, 5, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-gray-400 text-sm py-12">
              No survival data yet
            </p>
          )}
        </Card>

        <Card>
          <SectionHeader
            title="Top Performing Sites"
            sub="Highest survival rates"
          />
          <div className="flex flex-col gap-2.5">
            {data.top_performing_sites.length > 0 ? (
              data.top_performing_sites.map((s, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition"
                >
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-white text-[11px] font-bold shrink-0 ${ZONE_ACCENTS[i % ZONE_ACCENTS.length]}`}
                  >
                    #{i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-bold text-gray-800 truncate">
                      {s.name}
                    </p>
                    <p className="text-[10.5px] text-gray-400 truncate">
                      {s.barangay}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className="text-[13px] font-bold"
                      style={{
                        color:
                          s.rate >= 70
                            ? "#10b981"
                            : s.rate >= 50
                              ? "#f59e0b"
                              : "#ef4444",
                      }}
                    >
                      {s.rate}%
                    </p>
                    <p className="text-[9px] text-gray-400">
                      {s.survived}/{s.total}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-gray-400 text-sm py-8">No data</p>
            )}
          </div>
        </Card>
      </div>

      {/* Sites needing attention + survival by barangay */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card>
          <SectionHeader
            title="Sites Needing Attention"
            sub="Low survival or overdue visits"
          />
          <div className="flex flex-col gap-2">
            {data.sites_needing_attention.length > 0 ? (
              data.sites_needing_attention.map((s, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-2.5 rounded-lg border border-red-100 bg-red-50/30"
                >
                  <AlertCircle
                    size={16}
                    className="text-red-500 mt-0.5 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-bold text-gray-800 truncate">
                      {s.name}
                    </p>
                    <p className="text-[10.5px] text-gray-500 truncate">
                      {s.barangay}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-red-600 font-semibold">
                        {s.rate}% survival
                      </span>
                      <span className="text-[10px] text-gray-400">
                        · {s.dead} dead
                      </span>
                      <span className="text-[10px] text-gray-400">
                        · {s.last_visit}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-gray-400 text-sm py-8">
                All sites healthy 🌱
              </p>
            )}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <SectionHeader
            title="Survival by Barangay"
            sub="Geographic performance heatmap"
          />
          {data.survival_by_barangay.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.survival_by_barangay} barGap={4}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#f0fdf4"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<GreenTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar
                  dataKey="survived"
                  name="Survived"
                  fill="#10b981"
                  radius={[5, 5, 0, 0]}
                />
                <Bar
                  dataKey="dead"
                  name="Dead"
                  fill="#f87171"
                  radius={[5, 5, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-gray-400 text-sm py-12">
              No barangay survival data
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// TAB: DOCUMENTATION & COMPLIANCE
// ─────────────────────────────────────────
function TabDocumentation({ data }: { data: DashboardData }) {
  const d = data.documentation_stats;

  return (
    <div className="flex flex-col gap-5">
      {/* Compliance overview bars */}
      <Card>
        <SectionHeader
          title="Documentation Completeness"
          sub="Key records needed for program compliance"
          badge={`${Math.round(((d.apps_with_maintenance_plan / Math.max(d.apps_total, 1) + d.sites_with_permits / Math.max(d.sites_total, 1) + d.initial_visits_with_agreement / Math.max(d.initial_visits_total, 1)) / 3) * 100)}% overall`}
        />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-5">
          <ComplianceBar
            label="Applications with Maintenance Plans"
            done={d.apps_with_maintenance_plan}
            total={d.apps_total}
            color="bg-emerald-500"
          />
          <ComplianceBar
            label="Sites with Permit Documents"
            done={d.sites_with_permits}
            total={d.sites_total}
            color="bg-indigo-500"
          />
          <ComplianceBar
            label="Initial Visits with Signed Agreements"
            done={d.initial_visits_with_agreement}
            total={d.initial_visits_total}
            color="bg-teal-500"
          />
          <ComplianceBar
            label="Applications Fully Completed"
            done={data.stats.completed_applications}
            total={d.apps_total}
            color="bg-green-600"
          />
        </div>
      </Card>

      {/* Permit documents breakdown + Assessors workload */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <SectionHeader
            title="Permit Documents by Type"
            sub="Land titles, tax declarations, and others"
          />
          {d.permit_docs_by_type.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={d.permit_docs_by_type}
                    dataKey="count"
                    nameKey="display"
                    outerRadius={80}
                    innerRadius={42}
                    paddingAngle={3}
                  >
                    {d.permit_docs_by_type.map((p, i) => (
                      <Cell key={i} fill={ZONE_HEX[i % ZONE_HEX.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<GreenTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-2 mt-3">
                {d.permit_docs_by_type.map((p, i) => (
                  <div
                    key={p.document_type}
                    className="flex items-center gap-2"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: ZONE_HEX[i % ZONE_HEX.length] }}
                    />
                    <span className="text-[11.5px] text-gray-600">
                      {p.display}
                    </span>
                    <span className="ml-auto text-[11.5px] font-bold text-gray-800">
                      {p.count}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-center text-gray-400 text-sm py-12">
              No permit documents uploaded yet
            </p>
          )}
        </Card>

        <Card>
          <SectionHeader
            title="Inspector Workload"
            sub="Pending seedling verifications per inspector"
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
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[12px] font-bold text-gray-800 truncate">
                        {a.name}
                      </p>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${a.pending_seedlings > 0 ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}
                      >
                        {a.pending_seedlings > 0
                          ? `${a.pending_seedlings} pending`
                          : "Clear"}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500"
                        style={{
                          width: `${a.assessments > 0 ? Math.min((a.approved / a.assessments) * 100, 100) : 0}%`,
                        }}
                      />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {a.assessments} verified · {a.approved} approved
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-gray-400 text-sm py-8">
                No inspectors
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* Barangay breakdown */}
      <Card>
        <SectionHeader
          title="Barangay Performance"
          sub="Applications, trees planted, and approval rates"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.barangay_breakdown.length > 0 ? (
            data.barangay_breakdown.map((b, i) => (
              <div
                key={b.name}
                className="bg-gray-50 rounded-xl p-4 relative overflow-hidden border border-gray-100"
              >
                <div
                  className={`absolute top-0 left-0 right-0 h-0.5 ${ZONE_ACCENTS[i % ZONE_ACCENTS.length]}`}
                />
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="dash-title text-[15px] font-bold text-gray-800">
                      {b.name}
                    </p>
                    <p className="text-[10px] text-gray-400">Assessment zone</p>
                  </div>
                  <span
                    className="text-[13px] font-bold"
                    style={{ color: ZONE_HEX[i % ZONE_HEX.length] }}
                  >
                    {b.rate}%
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div>
                    <p className="text-[10px] text-gray-400 font-medium">
                      📋 Apps
                    </p>
                    <p className="dash-title text-[18px] font-bold text-gray-800">
                      {b.apps}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 font-medium">
                      🌱 Trees
                    </p>
                    <p className="dash-title text-[18px] font-bold text-gray-800">
                      {b.trees.toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${ZONE_ACCENTS[i % ZONE_ACCENTS.length]}`}
                    style={{ width: `${b.rate}%` }}
                  />
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-gray-400 text-sm py-8 col-span-3">
              No barangay data
            </p>
          )}
        </div>
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
            {activeTab === "documentation" && <TabDocumentation data={data} />}
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
