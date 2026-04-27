import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell,
  AreaChart, Area,
} from "recharts";
import {
  TreePine, Activity, FileText, AlertTriangle, TrendingUp,
  MapPin, Users, CheckCircle2, Clock, XCircle, Sprout,
  Globe2, Droplets, Wind, Thermometer, Eye,
  ArrowUpRight, ArrowDownRight, Minus, ClipboardList,
} from "lucide-react";

// ─────────────────────────────────────────
// DATA
// ─────────────────────────────────────────
const APPLICATION_TREND = [
  { month: "Jan", submitted: 12, approved: 8,  rejected: 2 },
  { month: "Feb", submitted: 18, approved: 13, rejected: 3 },
  { month: "Mar", submitted: 15, approved: 11, rejected: 2 },
  { month: "Apr", submitted: 22, approved: 17, rejected: 4 },
  { month: "May", submitted: 28, approved: 21, rejected: 3 },
  { month: "Jun", submitted: 31, approved: 25, rejected: 4 },
  { month: "Jul", submitted: 26, approved: 22, rejected: 2 },
];

const STATUS_DATA = [
  { name: "Approved",  value: 117, fill: "#10b981" },
  { name: "Pending",   value: 24,  fill: "#f59e0b" },
  { name: "Rejected",  value: 20,  fill: "#ef4444" },
  { name: "On Review", value: 9,   fill: "#6366f1" },
];

const ASSESSMENT_DATA = [
  { name: "Ormoc North", assessed: 14, approved: 12 },
  { name: "Ormoc South", assessed: 10, approved: 8  },
  { name: "Ipil",        assessed: 8,  approved: 7  },
  { name: "Patag",       assessed: 11, approved: 9  },
  { name: "Bago",        assessed: 6,  approved: 5  },
  { name: "Dolores",     assessed: 9,  approved: 8  },
];

const APPROVAL_RATE = [
  { month: "Jan", rate: 67 },
  { month: "Feb", rate: 72 },
  { month: "Mar", rate: 73 },
  { month: "Apr", rate: 77 },
  { month: "May", rate: 75 },
  { month: "Jun", rate: 81 },
  { month: "Jul", rate: 85 },
];

const RECENT_ACTIVITIES = [
  { id: 1, type: "success", ref: "APP-0234", action: "Application approved",      time: "1h ago",     officer: "R. Cruz"      },
  { id: 2, type: "warning", ref: "APP-0231", action: "Pending site verification", time: "3h ago",     officer: "J. Reyes"     },
  { id: 3, type: "info",    ref: "APP-0229", action: "Documents submitted",       time: "Yesterday",  officer: "M. Santos"    },
  { id: 4, type: "danger",  ref: "APP-0225", action: "Application rejected",      time: "Yesterday",  officer: "A. Dela Cruz" },
  { id: 5, type: "success", ref: "APP-0220", action: "Field assessment done",     time: "2 days ago", officer: "K. Lim"       },
];

const RECENT_APPS = [
  { ref: "APP-0234", area: "Ormoc North", hectares: "4.2 ha", status: "Approved",   score: 91 },
  { ref: "APP-0233", area: "Patag",       hectares: "2.8 ha", status: "Pending",    score: 68 },
  { ref: "APP-0231", area: "Ipil",        hectares: "6.1 ha", status: "On Review",  score: 74 },
  { ref: "APP-0228", area: "Bago",        hectares: "3.5 ha", status: "Approved",   score: 88 },
  { ref: "APP-0225", area: "Dolores",     hectares: "1.9 ha", status: "Rejected",   score: 38 },
];

const ALL_APPS = [
  ...RECENT_APPS,
  { ref: "APP-0219", area: "Ormoc North", hectares: "5.0 ha", status: "Approved",  score: 95 },
  { ref: "APP-0218", area: "Ipil",        hectares: "2.1 ha", status: "Pending",   score: 55 },
  { ref: "APP-0215", area: "Dolores",     hectares: "3.8 ha", status: "Approved",  score: 83 },
  { ref: "APP-0210", area: "Patag",       hectares: "4.4 ha", status: "Rejected",  score: 31 },
  { ref: "APP-0207", area: "Ormoc South", hectares: "2.6 ha", status: "Approved",  score: 79 },
  { ref: "APP-0204", area: "Bago",        hectares: "1.5 ha", status: "On Review", score: 61 },
];

const ASSESSORS = [
  { name: "R. Cruz",      assessments: 24, approved: 21, status: "Active",   avatar: "RC" },
  { name: "J. Reyes",     assessments: 19, approved: 15, status: "Active",   avatar: "JR" },
  { name: "M. Santos",    assessments: 17, approved: 14, status: "Active",   avatar: "MS" },
  { name: "A. Dela Cruz", assessments: 15, approved: 11, status: "On Field", avatar: "AD" },
  { name: "K. Lim",       assessments: 13, approved: 12, status: "Active",   avatar: "KL" },
  { name: "P. Villanueva",assessments: 11, approved: 9,  status: "Active",   avatar: "PV" },
];

const BARANGAY_BREAKDOWN = [
  { name: "Ormoc North", apps: 38, trees: 3200, rate: 86 },
  { name: "Ormoc South", apps: 29, trees: 2780, rate: 80 },
  { name: "Ipil",        apps: 22, trees: 1940, rate: 88 },
  { name: "Patag",       apps: 31, trees: 2650, rate: 82 },
  { name: "Bago",        apps: 19, trees: 1110, rate: 79 },
  { name: "Dolores",     apps: 26, trees: 1800, rate: 87 },
];

const WEATHER_DATA = [
  { icon: <Thermometer size={14} />, label: "Temp",       value: "27°C"    },
  { icon: <Droplets    size={14} />, label: "Humidity",   value: "74%"     },
  { icon: <Wind        size={14} />, label: "Wind",       value: "12 km/h" },
  { icon: <Eye         size={14} />, label: "Visibility", value: "Good"    },
];

const TABS = [
  { id: "overview",   label: "Overview" },
  { id: "apps",       label: "Applications" },
  { id: "assessors",  label: "Assessors" },
  { id: "barangays",  label: "Barangays" },
];

const STAT_CARDS = [
  { icon: <ClipboardList size={20} />, label: "Total Applications", value: "170",    sub: "24 pending review",      trend: "up",   trendVal: "+12",  color: "bg-emerald-500", delay: "0.05s" },
  { icon: <CheckCircle2  size={20} />, label: "Approved",           value: "117",    sub: "85% approval rate",      trend: "up",   trendVal: "+8%",  color: "bg-teal-500",    delay: "0.1s"  },
  { icon: <Clock         size={20} />, label: "Pending Review",     value: "24",     sub: "9 awaiting documents",   trend: "down", trendVal: "-3",   color: "bg-amber-500",   delay: "0.15s" },
  { icon: <XCircle       size={20} />, label: "Rejected",           value: "20",     sub: "3 under appeal",         trend: "down", trendVal: "-2",   color: "bg-red-500",     delay: "0.2s"  },
  { icon: <MapPin        size={20} />, label: "Areas Assessed",     value: "38",     sub: "Across 6 barangays",     trend: "up",   trendVal: "+5",   color: "bg-blue-500",    delay: "0.25s" },
  { icon: <Users         size={20} />, label: "Field Assessors",    value: "11",     sub: "8 active this week",     trend: "up",   trendVal: "+2",   color: "bg-violet-500",  delay: "0.3s"  },
  { icon: <Sprout        size={20} />, label: "Trees Endorsed",     value: "12,480", sub: "↑ 1,340 this month",    trend: "up",   trendVal: "+12%", color: "bg-green-500",   delay: "0.35s" },
  { icon: <AlertTriangle size={20} />, label: "Active Alerts",      value: "4",      sub: "2 critical, 2 medium",  trend: "down", trendVal: "-1",   color: "bg-orange-500",  delay: "0.4s"  },
];

// ─────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────
const ACT_STYLE = {
  success: { dot: "bg-emerald-500", bg: "bg-emerald-50 text-emerald-700", icon: <CheckCircle2 size={12} /> },
  warning: { dot: "bg-amber-400",   bg: "bg-amber-50 text-amber-700",     icon: <Clock        size={12} /> },
  info:    { dot: "bg-sky-400",     bg: "bg-sky-50 text-sky-700",         icon: <Activity     size={12} /> },
  danger:  { dot: "bg-red-400",     bg: "bg-red-50 text-red-700",         icon: <XCircle      size={12} /> },
};

const STATUS_BADGE = {
  Approved:   "bg-emerald-50 text-emerald-700 border-emerald-200",
  Pending:    "bg-amber-50 text-amber-700 border-amber-200",
  "On Review":"bg-indigo-50 text-indigo-700 border-indigo-200",
  Rejected:   "bg-red-50 text-red-700 border-red-200",
};

const AVATAR_COLORS = [
  "bg-[#0F4A2F]", "bg-blue-700", "bg-violet-700", "bg-teal-700", "bg-orange-700", "bg-rose-700",
];

const scoreColor = (v) =>
  v >= 80 ? "bg-emerald-500" : v >= 60 ? "bg-amber-400" : "bg-red-400";

const scoreHex = (v) =>
  v >= 80 ? "#10b981" : v >= 60 ? "#f59e0b" : "#ef4444";

// ─────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────
function GreenTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0F4A2F] text-white text-xs rounded-xl px-3 py-2 shadow-xl border border-white/10">
      <p className="font-semibold mb-1 text-emerald-300">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color ?? "#86efac" }}>
          {p.name}: <b>{p.value}</b>
        </p>
      ))}
    </div>
  );
}

function StatCard({ icon, label, value, sub, trend, trendVal, color, delay }) {
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

function SectionHeader({ title, sub, badge }) {
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

function Card({ children, delay = "0s", className = "" }) {
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
function TabOverview() {
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
            sub="Jan – Jul 2024 • All assessment areas"
            badge="+18% vs last year"
          />
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={APPLICATION_TREND}>
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
              <Area type="monotone" dataKey="submitted" name="Submitted" stroke="#6366f1" strokeWidth={2}     fill="url(#submGrad)" strokeDasharray="5 3" />
              <Area type="monotone" dataKey="approved"  name="Approved"  stroke="#10b981" strokeWidth={2.5}   fill="url(#appGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card delay="0.5s" className="flex flex-col">
          <SectionHeader title="Application Status" sub="All 170 submitted applications" />
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={STATUS_DATA} dataKey="value" nameKey="name" outerRadius={72} innerRadius={38} paddingAngle={3}>
                {STATUS_DATA.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Pie>
              <Tooltip content={<GreenTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-2 mt-3">
            {STATUS_DATA.map((d) => (
              <div key={d.name} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.fill }} />
                <span className="text-[11.5px] text-gray-600">{d.name}</span>
                <span className="ml-auto text-[11.5px] font-bold text-gray-800">{d.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        <Card delay="0.55s" className="lg:col-span-2">
          <SectionHeader title="Assessments by Area — Assessed vs Approved" sub="Cumulative across all barangays" />
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={ASSESSMENT_DATA} barGap={4}>
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
            <LineChart data={APPROVAL_RATE}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis domain={[50, 100]} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
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
            <span className="text-[12px] text-emerald-700 font-medium">Avg 85% — above 80% target</span>
          </div>
        </Card>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card delay="0.65s" className="lg:col-span-2">
          <SectionHeader title="Recent Applications Overview" />
          <div className="flex flex-col gap-3">
            {RECENT_APPS.map((a) => (
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
            ))}
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
            {RECENT_ACTIVITIES.map((a) => {
              const s = ACT_STYLE[a.type];
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
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// TAB: APPLICATIONS
// ─────────────────────────────────────────
function TabApplications() {
  const [filter, setFilter] = useState("All");
  const filters = ["All", "Approved", "Pending", "On Review", "Rejected"];
  const filtered = filter === "All" ? ALL_APPS : ALL_APPS.filter((a) => a.status === filter);

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
          {filtered.map((a, i) => (
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
          ))}
        </div>
      </Card>

      <Card>
        <SectionHeader title="Submission Volume by Month" sub="With rejection breakdown" />
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={APPLICATION_TREND} barGap={4}>
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
// TAB: ASSESSORS
// ─────────────────────────────────────────
function TabAssessors() {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {ASSESSORS.map((a, i) => {
          const rate = Math.round((a.approved / a.assessments) * 100);
          return (
            <div
              key={a.name}
              className="bg-white rounded-2xl p-5 border border-gray-100
                shadow-[0_2px_16px_rgba(5,120,0,0.05)]
                hover:shadow-[0_8px_28px_rgba(5,120,0,0.12)] hover:-translate-y-0.5
                transition-all duration-300 animate-fadeUp"
              style={{ animationDelay: `${i * 0.06}s` }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-11 h-11 rounded-2xl ${AVATAR_COLORS[i % AVATAR_COLORS.length]}
                  flex items-center justify-center text-white text-[13px] font-extrabold shrink-0`}>
                  {a.avatar}
                </div>
                <div>
                  <p className="text-[13px] font-bold text-gray-800">{a.name}</p>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border
                    ${a.status === "On Field"
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : "bg-emerald-50 text-emerald-700 border-emerald-200"
                    }`}>
                    {a.status}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-4">
                {[["Assessments", a.assessments], ["Approved", a.approved]].map(([label, val]) => (
                  <div key={label} className="bg-gray-50 rounded-xl p-3">
                    <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-1">{label}</p>
                    <p className="dash-title text-[22px] font-extrabold text-gray-800">{val}</p>
                  </div>
                ))}
              </div>

              <div>
                <div className="flex justify-between mb-1.5">
                  <span className="text-[11px] text-gray-500">Approval Rate</span>
                  <span className="text-[12px] font-bold" style={{ color: scoreHex(rate) }}>{rate}%</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${scoreColor(rate)}`}
                    style={{ width: `${rate}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Card>
        <SectionHeader title="Assessor Performance Comparison" sub="Total assessed vs approved by officer" />
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={ASSESSORS} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <Tooltip content={<GreenTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="assessments" name="Total Assessed" fill="#c7d2fe" radius={[5, 5, 0, 0]} />
            <Bar dataKey="approved"    name="Approved"       fill="#10b981" radius={[5, 5, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────
// TAB: BARANGAYS
// ─────────────────────────────────────────
const ZONE_ACCENTS = ["bg-emerald-500","bg-indigo-500","bg-amber-500","bg-blue-500","bg-red-500","bg-violet-500"];
const ZONE_HEX     = ["#10b981","#6366f1","#f59e0b","#3b82f6","#ef4444","#8b5cf6"];

function TabBarangays() {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {BARANGAY_BREAKDOWN.map((b, i) => (
          <div
            key={b.name}
            className="bg-white rounded-2xl p-5 border border-gray-100 relative overflow-hidden
              shadow-[0_2px_16px_rgba(5,120,0,0.05)]
              hover:shadow-[0_8px_28px_rgba(5,120,0,0.12)] hover:-translate-y-0.5
              transition-all duration-300 animate-fadeUp"
            style={{ animationDelay: `${i * 0.06}s` }}
          >
            <div className={`absolute top-0 left-0 right-0 h-0.5 ${ZONE_ACCENTS[i]}`} />
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="dash-title text-[17px] font-extrabold text-gray-800">{b.name}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Assessment zone</p>
              </div>
              <span className="text-[13px] font-extrabold" style={{ color: ZONE_HEX[i] }}>{b.rate}%</span>
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
                <span className="text-[11px] font-bold" style={{ color: ZONE_HEX[i] }}>{b.rate}%</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${ZONE_ACCENTS[i]}`}
                  style={{ width: `${b.rate}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <Card>
        <SectionHeader title="Trees Endorsed per Barangay" sub="Total cumulative endorsed tree count" />
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={BARANGAY_BREAKDOWN}>
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
          <BarChart data={BARANGAY_BREAKDOWN}>
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
  const [isAuthorized, setIsAuthorized] = useState(null); // null = loading
  const [activeTab, setActiveTab]       = useState("overview");
  const [time, setTime]                 = useState(new Date());

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
        const res  = await fetch("http://127.0.0.1:8000/api/get_me/", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setIsAuthorized(res.ok && data.user_role === "DataManager");
      } catch {
        setIsAuthorized(false);
      }
    })();
  }, []);

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
            You are not authorized to view this page. Please log in with an AFA account.
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
            Agricultural Field Assessor Dashboard
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

        {/* ── Tab Content ── */}
        {activeTab === "overview"   && <TabOverview />}
        {activeTab === "apps"       && <TabApplications />}
        {activeTab === "assessors"  && <TabAssessors />}
        {activeTab === "barangays"  && <TabBarangays />}

      </div>
    </>
  );
}