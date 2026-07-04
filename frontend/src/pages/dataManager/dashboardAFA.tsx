import { useEffect, useState } from "react";
import { api } from "@/constant/api.ts";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell,
  AreaChart, Area, ComposedChart,
} from "recharts";
import {
  TreePine, Activity, FileText, AlertTriangle, TrendingUp,
  MapPin, Users, CheckCircle2, Clock, XCircle, Sprout,
  Globe2, Droplets, Wind, Thermometer, Eye,
  ArrowUpRight, ArrowDownRight, Minus, ClipboardList,
  Loader2,
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
    active_alerts: number;
  };
  application_trend: { month: string; submitted: number; approved: number; rejected: number }[];
  seedlings_planted_trend: {
    month: string;
    seedlings_planted: number;
    cumulative_seedlings: number;
    cumulative_area_hectares: number;
  }[];
  status_data: { name: string; value: number; fill: string }[];
  assessment_data: { name: string; assessed: number; approved: number }[];
  approval_rate: { month: string; rate: number }[];
  recent_activities: { id: number; type: string; ref: string; action: string; time: string; officer: string }[];
  recent_apps: { ref: string; area: string; hectares: string; status: string; score: number }[];
  all_apps: { ref: string; area: string; hectares: string; status: string; score: number }[];
  assessors: { name: string; assessments: number; approved: number; status: string; avatar: string }[];
  barangay_breakdown: { name: string; apps: number; trees: number; rate: number }[];
}

// ─────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────
const WEATHER_DATA = [
  { icon: <Thermometer size={14} />, label: "Temp",       value: "27°C"    },
  { icon: <Droplets    size={14} />, label: "Humidity",   value: "74%"     },
  { icon: <Wind        size={14} />, label: "Wind",       value: "12 km/h" },
  { icon: <Eye         size={14} />, label: "Visibility", value: "Good"    },
];

const TABS = [
  { id: "overview",   label: "Overview" },
  { id: "apps",       label: "Applications" },
  { id: "barangays",  label: "Barangays" },
];

const ACT_STYLE: Record<string, { dot: string; bg: string; icon: JSX.Element }> = {
  success: { dot: "bg-emerald-500", bg: "bg-emerald-50 text-emerald-700", icon: <CheckCircle2 size={12} /> },
  warning: { dot: "bg-amber-400",   bg: "bg-amber-50 text-amber-700",     icon: <Clock        size={12} /> },
  info:    { dot: "bg-sky-400",     bg: "bg-sky-50 text-sky-700",         icon: <Activity     size={12} /> },
  danger:  { dot: "bg-red-400",     bg: "bg-red-50 text-red-700",         icon: <XCircle      size={12} /> },
};

const STATUS_BADGE: Record<string, string> = {
  Approved:   "bg-emerald-50 text-emerald-700 border-emerald-200",
  Pending:    "bg-amber-50 text-amber-700 border-amber-200",
  "On Review":"bg-indigo-50 text-indigo-700 border-indigo-200",
  Rejected:   "bg-red-50 text-red-700 border-red-200",
};

const AVATAR_COLORS = [
  "bg-[#0F4A2F]", "bg-blue-700", "bg-violet-700", "bg-teal-700", "bg-orange-700", "bg-rose-700",
];

const ZONE_ACCENTS = ["bg-emerald-500","bg-indigo-500","bg-amber-500","bg-blue-500","bg-red-500","bg-violet-500"];
const ZONE_HEX     = ["#10b981","#6366f1","#f59e0b","#3b82f6","#ef4444","#8b5cf6"];

const scoreColor = (v: number) =>
  v >= 80 ? "bg-emerald-500" : v >= 60 ? "bg-amber-400" : "bg-red-400";

const scoreHex = (v: number) =>
  v >= 80 ? "#10b981" : v >= 60 ? "#f59e0b" : "#ef4444";

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

function StatCard({ icon, label, value, sub, trend, trendVal, color, delay }: any) {
  const up = trend === "up", down = trend === "down";
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
          <span className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full
            ${up   ? "bg-emerald-50 text-emerald-600"
             : down ? "bg-red-50 text-red-500"
                    : "bg-gray-100 text-gray-500"}`}>
            {up ? <ArrowUpRight size={11} /> : down ? <ArrowDownRight size={11} /> : <Minus size={11} />}
            {trendVal}
          </span>
        )}
      </div>
      <p className="text-[13px] text-gray-500 font-medium mb-0.5">{label}</p>
      <p className="text-[26px] font-bold text-gray-800 leading-none dash-title">{value}</p>
      {sub && <p className="text-[11.5px] text-gray-400 mt-1.5">{sub}</p>}
    </div>
  );
}

function SectionHeader({ title, sub, badge }: any) {
  return (
    <div className="flex items-start justify-between mb-5">
      <div>
        <h2 className="dash-title text-[15px] font-bold text-gray-800">{title}</h2>
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

// ─────────────────────────────────────────
// TAB: OVERVIEW
// ─────────────────────────────────────────
function TabOverview({ data }: { data: DashboardData }) {
  const STAT_CARDS = [
    { icon: <ClipboardList size={20} />, label: "Total Applications", value: data.stats.total_applications.toLocaleString(), sub: `${data.stats.pending} pending review`, trend: "up", trendVal: "+12", color: "bg-emerald-500", delay: "0.05s" },
    { icon: <CheckCircle2  size={20} />, label: "Approved", value: data.stats.approved.toLocaleString(), sub: `${data.stats.total_applications > 0 ? Math.round((data.stats.approved / data.stats.total_applications) * 100) : 0}% approval rate`, trend: "up", trendVal: "+8%", color: "bg-teal-500", delay: "0.1s" },
    { icon: <Clock         size={20} />, label: "Pending Review", value: data.stats.pending.toLocaleString(), sub: "Awaiting evaluation", trend: "down", trendVal: "-3", color: "bg-amber-500", delay: "0.15s" },
    { icon: <CheckCircle2  size={20} />, label: "Completed Programs", value: data.stats.completed_applications.toLocaleString(), sub: `${data.stats.completed_sites} sites finished`, trend: "up", trendVal: "+5", color: "bg-green-600", delay: "0.25s" },
    { icon: <Sprout        size={20} />, label: "Seedlings Planted", value: data.stats.total_seedlings_planted.toLocaleString(), sub: "From progress reports", trend: "up", trendVal: "+15%", color: "bg-emerald-600", delay: "0.3s" },
    { icon: <MapPin        size={20} />, label: "Area Planted", value: `${data.stats.total_area_planted} ha`, sub: "Based on 2m spacing", trend: "up", trendVal: "+0.5 ha", color: "bg-teal-600", delay: "0.35s" },
    { icon: <Sprout        size={20} />, label: "Trees Endorsed", value: data.stats.trees_endorsed.toLocaleString(), sub: "Seedlings distributed", trend: "up", trendVal: "+12%", color: "bg-green-500", delay: "0.5s" },
    { icon: <AlertTriangle size={20} />, label: "Active Alerts", value: data.stats.active_alerts.toLocaleString(), sub: "Requires attention", trend: "down", trendVal: "-1", color: "bg-orange-500", delay: "0.55s" },
  ];

  return (
    <div>
      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {STAT_CARDS.map((c) => <StatCard key={c.label} {...c} />)}
      </div>

      {/* Row 1 */}
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
                  <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="appGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#10b981" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip content={<GreenTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="submitted" name="Submitted" stroke="#6366f1" strokeWidth={2} fill="url(#submGrad)" strokeDasharray="5 3" />
              <Area type="monotone" dataKey="approved"  name="Approved"  stroke="#10b981" strokeWidth={2.5} fill="url(#appGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card delay="0.5s" className="flex flex-col">
          <SectionHeader title="Application Status" sub={`All ${data.stats.total_applications} submitted applications`} />
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={data.status_data} dataKey="value" nameKey="name" outerRadius={72} innerRadius={38} paddingAngle={3}>
                {data.status_data.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Pie>
              <Tooltip content={<GreenTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-2 mt-3">
            {data.status_data.map((d) => (
              <div key={d.name} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.fill }} />
                <span className="text-[11.5px] text-gray-600">{d.name}</span>
                <span className="ml-auto text-[11.5px] font-bold text-gray-800">{d.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Row 2 - NEW: Seedlings Planted Trend */}
     
        <div className="grid grid-cols-1 gap-5 mb-5">
          <Card delay="0.52s" className="lg:col-span-1">
            <SectionHeader
              title="Seedlings Planted Over Time"
              sub="Cumulative planting progress with area calculation (2m spacing)"
              badge={`${data.stats.total_area_planted} ha total`}
            />
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={data.seedlings_planted_trend}>
                <defs>
                  <linearGradient id="seedlingsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} label={{ value: 'Seedlings', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#94a3b8' } }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} label={{ value: 'Hectares', angle: 90, position: 'insideRight', style: { fontSize: 11, fill: '#94a3b8' } }} />
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
        </div>
     

      {/* Row 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        <Card delay="0.55s" className="lg:col-span-2">
          <SectionHeader title="Assessments by Area — Assessed vs Approved" sub="Cumulative across all barangays" />
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={data.assessment_data} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip content={<GreenTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="assessed" name="Assessed" fill="#c7d2fe" radius={[5, 5, 0, 0]} />
              <Bar dataKey="approved" name="Approved" fill="#6366f1" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card delay="0.6s">
          <SectionHeader title="Approval Rate Trend" sub="Monthly approval rate %" />
          <ResponsiveContainer width="100%" height={190}>
            <LineChart data={data.approval_rate}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip content={<GreenTooltip />} />
              <Line
                type="monotone" dataKey="rate" name="Approval %"
                stroke="#10b981" strokeWidth={2.5}
                dot={{ r: 3, fill: "#10b981", strokeWidth: 0 }}
                activeDot={{ r: 5, fill: "#0F4A2F" }}
              />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-2 mt-3 bg-emerald-50 rounded-xl px-4 py-2.5">
            <TrendingUp size={14} className="text-emerald-600" />
            <span className="text-[12px] text-emerald-700 font-medium">
              Avg {data.approval_rate.length > 0 ? Math.round(data.approval_rate.reduce((sum, r) => sum + r.rate, 0) / data.approval_rate.length) : 0}% approval rate
            </span>
          </div>
        </Card>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card delay="0.65s" className="lg:col-span-2">
          <SectionHeader title="Recent Applications Overview" />
          <div className="flex flex-col gap-3">
            {data.recent_apps.length > 0 ? data.recent_apps.map((a) => (
              <div key={a.ref} className="flex items-center gap-3">
                <div className="w-20 shrink-0">
                  <p className="text-[12px] font-bold text-gray-800">{a.ref}</p>
                  <p className="text-[10.5px] text-gray-400">{a.hectares}</p>
                </div>
                <div className="w-20 shrink-0">
                  <p className="text-[11.5px] text-gray-600">{a.area}</p>
                </div>
                <div className="flex-1">
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${scoreColor(a.score)}`}
                      style={{ width: `${a.score}%` }}
                    />
                  </div>
                </div>
                <span className="text-[12px] font-semibold text-gray-700 w-8 text-right">{a.score}%</span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_BADGE[a.status] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>
                  {a.status}
                </span>
              </div>
            )) : (
              <p className="text-center text-gray-400 text-sm py-8">No recent applications</p>
            )}
          </div>
        </Card>

        <Card delay="0.7s">
          <div className="flex items-center justify-between mb-4">
            <h2 className="dash-title text-[15px] font-bold text-gray-800">Recent Activity</h2>
            <button className="text-[11px] text-emerald-600 hover:text-emerald-800 font-semibold transition-colors cursor-pointer">
              View all →
            </button>
          </div>
          <div className="flex flex-col gap-3">
            {data.recent_activities.length > 0 ? data.recent_activities.map((a) => {
              const s = ACT_STYLE[a.type] || ACT_STYLE.info;
              return (
                <div key={a.id} className="flex items-start gap-3">
                  <div className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${s.bg}`}>
                    {s.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-bold text-gray-800">{a.ref}</span>
                      <span className="text-[10.5px] text-gray-400">{a.time}</span>
                    </div>
                    <p className="text-[11.5px] text-gray-500 leading-tight">{a.action}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">by {a.officer}</p>
                  </div>
                </div>
              );
            }) : (
              <p className="text-center text-gray-400 text-sm py-8">No recent activity</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// TAB: APPLICATIONS
// ─────────────────────────────────────────
function TabApplications({ data }: { data: DashboardData }) {
  const [filter, setFilter] = useState("All");
  const filters = ["All", "Approved", "Pending", "On Review", "Rejected"];
  const filtered = filter === "All" ? data.all_apps : data.all_apps.filter((a) => a.status === filter);

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <SectionHeader title="All Applications" sub={`${filtered.length} results${filter !== "All" ? ` · filtered by ${filter}` : " · sorted by most recent"}`} />

        {/* Filter pills */}
        <div className="flex gap-2 flex-wrap mb-5">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-all cursor-pointer
                ${filter === f
                  ? "bg-[#0F4A2F] text-white border-[#0F4A2F]"
                  : "bg-white text-gray-500 border-gray-200 hover:border-emerald-300 hover:text-emerald-700"
                }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Table header */}
        <div className="grid grid-cols-[90px_1fr_70px_60px_1fr_100px] gap-3 px-3 py-2 bg-gray-50 rounded-xl mb-2">
          {["Ref", "Area", "Size", "Score", "Progress", "Status"].map((h) => (
            <span key={h} className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{h}</span>
          ))}
        </div>

        {/* Table rows */}
        <div className="flex flex-col gap-1">
          {filtered.length > 0 ? filtered.map((a, i) => (
            <div
              key={a.ref}
              className="grid grid-cols-[90px_1fr_70px_60px_1fr_100px] gap-3 px-3 py-3 rounded-xl items-center
                hover:bg-emerald-50/60 transition-colors cursor-default"
            >
              <span className="text-[12px] font-bold text-[#0F4A2F]">{a.ref}</span>
              <span className="text-[12px] text-gray-700">{a.area}</span>
              <span className="text-[11px] text-gray-500">{a.hectares}</span>
              <span className="text-[12px] font-bold" style={{ color: scoreHex(a.score) }}>{a.score}%</span>
              <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className={`h-full rounded-full ${scoreColor(a.score)}`}
                  style={{ width: `${a.score}%` }}
                />
              </div>
              <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border w-fit ${STATUS_BADGE[a.status] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>
                {a.status}
              </span>
            </div>
          )) : (
            <p className="text-center text-gray-400 text-sm py-8">No applications found</p>
          )}
        </div>
      </Card>

      <Card>
        <SectionHeader title="Submission Volume by Month" sub="With rejection breakdown" />
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data.application_trend} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <Tooltip content={<GreenTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="submitted" name="Submitted" fill="#c7d2fe" radius={[5, 5, 0, 0]} />
            <Bar dataKey="approved"  name="Approved"  fill="#10b981" radius={[5, 5, 0, 0]} />
            <Bar dataKey="rejected"  name="Rejected"  fill="#f87171" radius={[5, 5, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}



// ─────────────────────────────────────────
// TAB: BARANGAYS
// ─────────────────────────────────────────
function TabBarangays({ data }: { data: DashboardData }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.barangay_breakdown.length > 0 ? data.barangay_breakdown.map((b, i) => (
          <div
            key={b.name}
            className="bg-white rounded-2xl p-5 border border-gray-100 relative overflow-hidden
              shadow-[0_2px_16px_rgba(5,120,0,0.05)]
              hover:shadow-[0_8px_28px_rgba(5,120,0,0.12)] hover:-translate-y-0.5
              transition-all duration-300 animate-fadeUp"
            style={{ animationDelay: `${i * 0.06}s` }}
          >
            <div className={`absolute top-0 left-0 right-0 h-0.5 ${ZONE_ACCENTS[i % ZONE_ACCENTS.length]}`} />
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="dash-title text-[17px] font-extrabold text-gray-800">{b.name}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Assessment zone</p>
              </div>
              <span className="text-[13px] font-extrabold" style={{ color: ZONE_HEX[i % ZONE_HEX.length] }}>{b.rate}%</span>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4">
              {[["📋 Applications", b.apps], ["🌱 Trees", b.trees.toLocaleString()]].map(([label, val]) => (
                <div key={label} className="bg-gray-50 rounded-xl p-3">
                  <p className="text-[10px] text-gray-400 font-medium mb-1">{label}</p>
                  <p className="dash-title text-[20px] font-extrabold text-gray-800">{val}</p>
                </div>
              ))}
            </div>

            <div>
              <div className="flex justify-between mb-1.5">
                <span className="text-[11px] text-gray-500">Approval Rate</span>
                <span className="text-[11px] font-bold" style={{ color: ZONE_HEX[i % ZONE_HEX.length] }}>{b.rate}%</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${ZONE_ACCENTS[i % ZONE_ACCENTS.length]}`}
                  style={{ width: `${b.rate}%` }}
                />
              </div>
            </div>
          </div>
        )) : (
          <p className="text-center text-gray-400 text-sm py-8 col-span-3">No barangay data available</p>
        )}
      </div>

      <Card>
        <SectionHeader title="Trees Endorsed per Barangay" sub="Total cumulative endorsed tree count" />
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data.barangay_breakdown}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <Tooltip content={<GreenTooltip />} />
            <Bar dataKey="trees" name="Trees Endorsed" fill="#10b981" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card>
        <SectionHeader title="Applications per Barangay" sub="Volume of submitted applications" />
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data.barangay_breakdown}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <Tooltip content={<GreenTooltip />} />
            <Bar dataKey="apps" name="Applications" fill="#6366f1" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────
// ROOT COMPONENT
// ─────────────────────────────────────────
export default function DashboardAFA() {
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [activeTab, setActiveTab]       = useState("overview");
  const [time, setTime]                 = useState(new Date());
  const [data, setData]                 = useState<DashboardData | null>(null);
  const [loading, setLoading]           = useState(true);

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Auth check
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { setIsAuthorized(false); return; }

    (async () => {
      try {
        const res  = await fetch(api+"api/get_me/", {
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

  // Fetch dashboard data
  useEffect(() => {
    if (isAuthorized) {
      fetchDashboardData();
    }
  }, [isAuthorized]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${api}api/get_dashboard_data/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch dashboard data");
      const result = await res.json();
      setData(result);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (isAuthorized === null) {
    return (
      <div className="min-h-screen bg-[#f5faf6] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
          <p className="text-[13px] text-gray-400 font-medium">Verifying access…</p>
        </div>
      </div>
    );
  }

  // Unauthorized
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-[#f5faf6] flex items-center justify-center">
        <div className="bg-white rounded-2xl p-10 border border-gray-100 shadow-[0_4px_32px_rgba(0,0,0,.07)]
          text-center max-w-sm w-full mx-4">
          <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <XCircle size={28} className="text-red-400" />
          </div>
          <h2 className="dash-title text-[22px] font-bold text-gray-800 mb-2">Access Denied</h2>
          <p className="text-[13px] text-gray-500 leading-relaxed">
            You are not authorized to view this page. Please log in with a DataManager account.
          </p>
          <button
            onClick={() => { localStorage.removeItem("token"); window.location.href = "/login"; }}
            className="mt-6 w-full bg-[#0F4A2F] text-white text-[13px] font-semibold py-3 rounded-xl
              hover:bg-[#0a3522] transition-colors cursor-pointer"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  const dateStr = time.toLocaleDateString("en-PH", { weekday: "long", month: "short", day: "numeric", year: "numeric" });
  const timeStr = time.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

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

        {/* ── Weather strip ── */}
        <div className="flex items-center gap-4 lg:gap-6 mb-6 bg-[#0F4A2F] rounded-2xl px-5 py-3
          shadow-[0_4px_24px_rgba(15,74,47,0.25)] animate-fadeUp flex-wrap"
          style={{ animationDelay: "0s" }}>
          <div className="flex items-center gap-2">
            <Globe2 size={15} className="text-emerald-300" />
            <span className="text-emerald-200 text-[11px] font-bold tracking-wider uppercase">
              Ormoc City — Live Conditions
            </span>
          </div>
          <div className="w-px h-5 bg-white/20 hidden sm:block" />
          {WEATHER_DATA.map((w) => (
            <div key={w.label} className="flex items-center gap-1.5 text-white/70 text-[12.5px]">
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

        {/* ── Header ── */}
        <div className="mb-6 animate-fadeUp" style={{ animationDelay: "0.02s" }}>
          <h1 className="dash-title text-[28px] font-bold text-[#0F4A2F]">
            DataManager Dashboard
          </h1>
          <p className="text-[13px] text-gray-500 mt-0.5">
            Overview of field assessments, applications, and reforestation activity · Ormoc City CENRO
          </p>
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1.5 mb-6 bg-white rounded-xl p-1.5 border border-gray-100
          shadow-[0_1px_8px_rgba(0,0,0,0.05)] w-fit animate-fadeUp" style={{ animationDelay: "0.04s" }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-5 py-2 rounded-lg text-[12px] font-semibold transition-all cursor-pointer
                ${activeTab === t.id
                  ? "bg-[#0F4A2F] text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Loading State ── */}
        {loading && !data ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 size={40} className="animate-spin text-[#0F4A2F] mb-4" />
            <p className="text-gray-500 font-medium">Loading dashboard data...</p>
          </div>
        ) : data ? (
          <>
            {/* ── Tab Content ── */}
            {activeTab === "overview"   && <TabOverview data={data} />}
            {activeTab === "apps"       && <TabApplications data={data} />}
           
            {activeTab === "barangays"  && <TabBarangays data={data} />}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-20">
            <p className="text-gray-500 font-medium">Failed to load dashboard data</p>
            <button onClick={fetchDashboardData} className="mt-4 px-4 py-2 bg-[#0F4A2F] text-white rounded-lg text-sm font-semibold hover:bg-[#1a6b44]">
              Retry
            </button>
          </div>
        )}

      </div>
    </>
  );
}