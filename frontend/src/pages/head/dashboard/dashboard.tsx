import NotFoundPage from "../../../components/layout/NotFoundPage";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell,
  AreaChart, Area, RadialBarChart, RadialBar,
} from "recharts";
import { useEffect, useState } from "react";
import {
  TreePine, Activity, FileText, AlertTriangle, TrendingUp,
  TrendingDown, MapPin, Calendar, Users, Droplets, Wind,
  Thermometer, Eye, ArrowUpRight, ArrowDownRight, Minus,
  CheckCircle2, Clock, XCircle, Sprout, Globe2,
} from "lucide-react";

// ─── Mock Data ────────────────────────────────────────────────────────────────
const PRIORITY_DATA = [
  { level: "Critical", count: 3, fill: "#ef4444" },
  { level: "High",     count: 8, fill: "#f97316" },
  { level: "Medium",   count: 12, fill: "#eab308" },
  { level: "Low",      count: 5, fill: "#22c55e"  },
];

const MONITORING_DATA = [
  { month: "Jan", progress: 18, target: 25 },
  { month: "Feb", progress: 32, target: 35 },
  { month: "Mar", progress: 41, target: 45 },
  { month: "Apr", progress: 58, target: 60 },
  { month: "May", progress: 67, target: 70 },
  { month: "Jun", progress: 80, target: 80 },
  { month: "Jul", progress: 88, target: 85 },
];

const STATUS_DATA = [
  { name: "Ongoing",   value: 10, fill: "#10b981" },
  { name: "Completed", value: 6,  fill: "#065f46" },
  { name: "Pending",   value: 4,  fill: "#6ee7b7" },
  { name: "On Hold",   value: 2,  fill: "#a7f3d0" },
];

const SPECIES_DATA = [
  { name: "Narra",       planted: 1200, survived: 1050 },
  { name: "Mahogany",    planted: 980,  survived: 870  },
  { name: "Ipil-ipil",   planted: 1500, survived: 1380 },
  { name: "Dao",         planted: 640,  survived: 590  },
  { name: "Molave",      planted: 820,  survived: 720  },
  { name: "Tindalo",     planted: 450,  survived: 410  },
];

const SURVIVAL_TREND = [
  { month: "Jan", rate: 78 },
  { month: "Feb", rate: 81 },
  { month: "Mar", rate: 83 },
  { month: "Apr", rate: 86 },
  { month: "May", rate: 84 },
  { month: "Jun", rate: 89 },
  { month: "Jul", rate: 91 },
];

const RADIAL_DATA = [
  { name: "Target", value: 100, fill: "#064e3b" },
  { name: "Achieved", value: 73, fill: "#10b981" },
];

const RECENT_ACTIVITIES = [
  { id: 1, type: "success", site: "BNY-03", action: "Monitoring complete", time: "2h ago",    officer: "R. Cruz"    },
  { id: 2, type: "warning", site: "MNL-07", action: "Irrigation overdue",  time: "5h ago",    officer: "J. Reyes"   },
  { id: 3, type: "info",    site: "QZN-01", action: "Seedlings delivered",  time: "Yesterday", officer: "M. Santos"  },
  { id: 4, type: "success", site: "PSG-09", action: "Site inspection done", time: "Yesterday", officer: "A. Dela Cruz"},
  { id: 5, type: "danger",  site: "BGC-02", action: "Pest alert raised",    time: "2 days ago",officer: "K. Lim"     },
];

const SITES = [
  { name: "BNY-03", area: "12.4 ha", trees: 4200, status: "Ongoing",   health: 92 },
  { name: "MNL-07", area: "8.1 ha",  trees: 2800, status: "Warning",   health: 65 },
  { name: "QZN-01", area: "15.0 ha", trees: 6100, status: "Completed", health: 97 },
  { name: "PSG-09", area: "9.7 ha",  trees: 3350, status: "Ongoing",   health: 88 },
  { name: "BGC-02", area: "6.3 ha",  trees: 1900, status: "At Risk",   health: 41 },
];

const WEATHER = [
  { icon: <Thermometer size={16} />, label: "Temp",      value: "27°C"  },
  { icon: <Droplets    size={16} />, label: "Humidity",  value: "74%"   },
  { icon: <Wind        size={16} />, label: "Wind",      value: "12 km/h"},
  { icon: <Eye         size={16} />, label: "Visibility",value: "Good"  },
];

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, trend, trendVal, color, delay }) {
  const up = trend === "up", down = trend === "down";
  return (
    <div className="dash-card group relative overflow-hidden rounded-2xl p-5 border border-white/60
      bg-white shadow-[0_2px_20px_rgba(5,120,0,0.06)] hover:shadow-[0_8px_32px_rgba(5,120,0,0.14)]
      transition-all duration-300 hover:-translate-y-0.5 animate-fadeUp"
      style={{ animationDelay: delay }}>
      {/* accent strip */}
      <div className={`absolute top-0 left-0 right-0 h-0.5 ${color}`} />
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color.replace("bg-","bg-").replace("-500","")}/10`}
          style={{ background: "rgba(5,117,1,0.08)" }}>
          <span className="text-[#057501]">{icon}</span>
        </div>
        {trend && (
          <span className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full
            ${up   ? "bg-emerald-50 text-emerald-600"
             : down ? "bg-red-50 text-red-500"
                    : "bg-gray-100 text-gray-500"}`}>
            {up ? <ArrowUpRight size={11}/> : down ? <ArrowDownRight size={11}/> : <Minus size={11}/>}
            {trendVal}
          </span>
        )}
      </div>
      <p className="text-[13px] text-gray-500 font-medium mb-0.5">{label}</p>
      <p className="text-[26px] font-bold text-gray-800 leading-none" style={{ fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:"-0.02em", fontWeight:700 }}>{value}</p>
      {sub && <p className="text-[11.5px] text-gray-400 mt-1.5">{sub}</p>}
    </div>
  );
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
const GreenTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0F4A2F] text-white text-xs rounded-xl px-3 py-2 shadow-xl border border-white/10">
      <p className="font-semibold mb-1 text-emerald-300">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color ?? "#86efac" }}>{p.name}: <b>{p.value}</b></p>
      ))}
    </div>
  );
};

// ─── Activity dot ─────────────────────────────────────────────────────────────
const ACT_STYLE = {
  success: { dot: "bg-emerald-500", bg: "bg-emerald-50",  text: "text-emerald-700", icon: <CheckCircle2 size={12}/> },
  warning: { dot: "bg-amber-400",   bg: "bg-amber-50",   text: "text-amber-700",   icon: <Clock        size={12}/> },
  info:    { dot: "bg-sky-400",     bg: "bg-sky-50",     text: "text-sky-700",     icon: <Activity     size={12}/> },
  danger:  { dot: "bg-red-400",     bg: "bg-red-50",     text: "text-red-700",     icon: <XCircle      size={12}/> },
};

const HEALTH_COLOR = (v) =>
  v >= 85 ? "bg-emerald-500" : v >= 60 ? "bg-amber-400" : "bg-red-400";

const STATUS_BADGE = {
  Ongoing:   "bg-blue-50 text-blue-700 border-blue-200",
  Completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Warning:   "bg-amber-50 text-amber-700 border-amber-200",
  "At Risk": "bg-red-50 text-red-700 border-red-200",
};

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [isAuthorize, setIsAuthorize] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    checkIfStillLogin();
  }, []);

  const checkIfStillLogin = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const response = await fetch("http://127.0.0.1:8000/api/get_me/", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.ok && !(data.user_role === "CityENROHead")) setIsAuthorize(false);
    } catch { setIsAuthorize(false); }
  };

  if (!localStorage.getItem("token") || !isAuthorize) return <NotFoundPage />;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Barlow+Condensed:wght@600;700;800&family=Barlow:wght@600;700&display=swap');
        .dash-root  { font-family:'DM Sans',sans-serif; }
        .dash-title { font-family:'Barlow Condensed',sans-serif; letter-spacing:-0.01em; }

        @keyframes fadeUp {
          from { opacity:0; transform:translateY(16px); }
          to   { opacity:1; transform:translateY(0);    }
        }
        .animate-fadeUp { animation: fadeUp .5s ease both; }

        .dash-card:hover .card-glow { opacity:1; }
        .recharts-cartesian-grid-horizontal line,
        .recharts-cartesian-grid-vertical   line { stroke: #f0fdf4; }
      `}</style>

      <div className="dash-root bg-[#f5faf6] min-h-screen p-6 overflow-x-hidden">

        {/* ── Weather strip ──────────────────────────────────────────────── */}
        <div className="flex items-center gap-6 mb-6 bg-[#0F4A2F] rounded-2xl px-5 py-3
          shadow-[0_4px_24px_rgba(15,74,47,0.25)] animate-fadeUp" style={{ animationDelay: "0s" }}>
          <div className="flex items-center gap-2 mr-2">
            <Globe2 size={16} className="text-emerald-300" />
            <span className="text-emerald-200 text-[12px] font-semibold tracking-wider uppercase">Cebu City — Live Conditions</span>
          </div>
          <div className="w-px h-5 bg-white/20" />
          {WEATHER.map((w) => (
            <div key={w.label} className="flex items-center gap-1.5 text-white/70 text-[12.5px]">
              <span className="text-emerald-400">{w.icon}</span>
              <span className="text-white/40">{w.label}</span>
              <span className="text-white font-semibold">{w.value}</span>
            </div>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-400/70 text-[11px] font-medium">
              {new Date().toLocaleDateString("en-PH", { weekday:"long", month:"short", day:"numeric", year:"numeric" })}
            </span>
          </div>
        </div>

        {/* ── Stat Cards ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 gap-4 mb-6">
          <StatCard icon={<TreePine size={20}/>}    label="Active Sites"       value="12"     sub="3 new this quarter"     trend="up"   trendVal="+3"   color="bg-emerald-500" delay="0.05s"/>
          <StatCard icon={<Activity size={20}/>}    label="Ongoing Projects"   value="5"      sub="2 nearing completion"   trend="down" trendVal="-2"   color="bg-blue-500"    delay="0.1s"/>
          <StatCard icon={<Sprout size={20}/>}      label="Trees Planted"      value="18,340" sub="↑ 2,100 this month"    trend="up"   trendVal="+13%" color="bg-teal-500"    delay="0.15s"/>
          <StatCard icon={<FileText size={20}/>}    label="Reports Generated"  value="23"     sub="Last: 2 days ago"       trend="up"   trendVal="+4"   color="bg-violet-500"  delay="0.2s"/>
          <StatCard icon={<MapPin size={20}/>}      label="Total Area"         value="51.5 ha" sub="Across 5 barangays"    trend={null} trendVal={null} color="bg-orange-500"  delay="0.25s"/>
          <StatCard icon={<Users size={20}/>}       label="Field Officers"     value="14"     sub="9 active today"         trend="up"   trendVal="+2"   color="bg-pink-500"    delay="0.3s"/>
          <StatCard icon={<CheckCircle2 size={20}/>}label="Survival Rate"      value="91%"    sub="Target: 85% ✓"         trend="up"   trendVal="+6%"  color="bg-emerald-500" delay="0.35s"/>
          <StatCard icon={<AlertTriangle size={20}/>}label="Active Alerts"     value="3"      sub="1 critical, 2 medium"  trend="down" trendVal="-1"   color="bg-red-500"     delay="0.4s"/>
        </div>

        {/* ── Charts Row 1 ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">

          {/* Area chart — monitoring progress */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-6
            shadow-[0_2px_20px_rgba(5,120,0,0.05)] animate-fadeUp" style={{ animationDelay:"0.45s" }}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="dash-title text-[15px] font-bold text-gray-800">Monitoring Progress vs Target</h2>
                <p className="text-[12px] text-gray-400 mt-0.5">Jan – Jul 2024 • All active sites</p>
              </div>
              <span className="bg-emerald-50 text-emerald-700 text-[11px] font-semibold px-3 py-1 rounded-full border border-emerald-200">
                +12% vs last year
              </span>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={MONITORING_DATA}>
                <defs>
                  <linearGradient id="progGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#10b981" stopOpacity={0.18}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="targGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#0F4A2F" stopOpacity={0.10}/>
                    <stop offset="95%" stopColor="#0F4A2F" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" />
                <XAxis dataKey="month" tick={{ fontSize:12, fill:"#94a3b8" }} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fontSize:12, fill:"#94a3b8" }} axisLine={false} tickLine={false}/>
                <Tooltip content={<GreenTooltip/>}/>
                <Legend wrapperStyle={{ fontSize:12 }}/>
                <Area type="monotone" dataKey="target"   name="Target"   stroke="#0F4A2F" strokeWidth={2} fill="url(#targGrad)" strokeDasharray="5 3"/>
                <Area type="monotone" dataKey="progress" name="Progress" stroke="#10b981" strokeWidth={2.5} fill="url(#progGrad)"/>
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Radial — annual target */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6
            shadow-[0_2px_20px_rgba(5,120,0,0.05)] flex flex-col animate-fadeUp" style={{ animationDelay:"0.5s" }}>
            <h2 className="dash-title text-[15px] font-bold text-gray-800 mb-1">Annual Goal</h2>
            <p className="text-[12px] text-gray-400 mb-4">Trees planted vs 25,000 target</p>
            <div className="flex-1 flex flex-col items-center justify-center">
              <ResponsiveContainer width="100%" height={180}>
                <RadialBarChart innerRadius={52} outerRadius={82} data={RADIAL_DATA} startAngle={220} endAngle={-40}>
                  <RadialBar dataKey="value" cornerRadius={8} background={{ fill:"#f0fdf4" }}>
                    {RADIAL_DATA.map((d, i) => <Cell key={i} fill={d.fill}/>)}
                  </RadialBar>
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="text-center -mt-4">
                <p className="text-[32px] text-gray-800 leading-none" style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, letterSpacing:"-0.02em" }}>73%</p>
                <p className="text-[12px] text-gray-400 mt-1">18,340 / 25,000 trees</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="bg-emerald-50 rounded-xl p-3 text-center">
                <p className="text-[11px] text-emerald-600 font-medium">Remaining</p>
                <p className="text-[18px] font-bold text-emerald-800" style={{ fontFamily:"'Barlow Condensed',sans-serif" }}>6,660</p>
              </div>
              <div className="bg-[#0F4A2F]/5 rounded-xl p-3 text-center">
                <p className="text-[11px] text-gray-500 font-medium">Days Left</p>
                <p className="text-[18px] font-bold text-gray-800" style={{ fontFamily:"'Barlow Condensed',sans-serif" }}>163</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Charts Row 2 ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">

          {/* Bar — species */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-6
            shadow-[0_2px_20px_rgba(5,120,0,0.05)] animate-fadeUp" style={{ animationDelay:"0.55s" }}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="dash-title text-[15px] font-bold text-gray-800">Species — Planted vs Survived</h2>
                <p className="text-[12px] text-gray-400 mt-0.5">Cumulative across all sites</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={SPECIES_DATA} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" vertical={false}/>
                <XAxis dataKey="name" tick={{ fontSize:11, fill:"#94a3b8" }} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fontSize:11, fill:"#94a3b8" }} axisLine={false} tickLine={false}/>
                <Tooltip content={<GreenTooltip/>}/>
                <Legend wrapperStyle={{ fontSize:12 }}/>
                <Bar dataKey="planted"  name="Planted"  fill="#d1fae5" radius={[5,5,0,0]}/>
                <Bar dataKey="survived" name="Survived" fill="#10b981" radius={[5,5,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Pie — status */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6
            shadow-[0_2px_20px_rgba(5,120,0,0.05)] animate-fadeUp" style={{ animationDelay:"0.6s" }}>
            <h2 className="dash-title text-[15px] font-bold text-gray-800 mb-1">Status Distribution</h2>
            <p className="text-[12px] text-gray-400 mb-3">All 22 reforestation projects</p>
            <ResponsiveContainer width="100%" height={170}>
              <PieChart>
                <Pie data={STATUS_DATA} dataKey="value" nameKey="name" outerRadius={72} innerRadius={38} paddingAngle={3}>
                  {STATUS_DATA.map((d, i) => <Cell key={i} fill={d.fill}/>)}
                </Pie>
                <Tooltip content={<GreenTooltip/>}/>
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-2 mt-3">
              {STATUS_DATA.map((d) => (
                <div key={d.name} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.fill }}/>
                  <span className="text-[11.5px] text-gray-600">{d.name}</span>
                  <span className="ml-auto text-[11.5px] font-bold text-gray-800">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Bottom row ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Survival trend line */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6
            shadow-[0_2px_20px_rgba(5,120,0,0.05)] animate-fadeUp" style={{ animationDelay:"0.65s" }}>
            <h2 className="dash-title text-[15px] font-bold text-gray-800 mb-1">Survival Rate Trend</h2>
            <p className="text-[12px] text-gray-400 mb-4">Monthly average across all sites</p>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={SURVIVAL_TREND}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" vertical={false}/>
                <XAxis dataKey="month" tick={{ fontSize:11, fill:"#94a3b8" }} axisLine={false} tickLine={false}/>
                <YAxis domain={[70,100]} tick={{ fontSize:11, fill:"#94a3b8" }} axisLine={false} tickLine={false}/>
                <Tooltip content={<GreenTooltip/>}/>
                <Line type="monotone" dataKey="rate" name="Survival %" stroke="#057501" strokeWidth={2.5}
                  dot={{ r:3, fill:"#057501", strokeWidth:0 }}
                  activeDot={{ r:5, fill:"#0F4A2F" }}/>
              </LineChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-2 mt-3 bg-emerald-50 rounded-xl px-4 py-2.5">
              <TrendingUp size={14} className="text-emerald-600"/>
              <span className="text-[12px] text-emerald-700 font-medium">Avg 91% — exceeding 85% target</span>
            </div>
          </div>

          {/* Site health table */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6
            shadow-[0_2px_20px_rgba(5,120,0,0.05)] animate-fadeUp" style={{ animationDelay:"0.7s" }}>
            <h2 className="dash-title text-[15px] font-bold text-gray-800 mb-4">Site Health Overview</h2>
            <div className="flex flex-col gap-3">
              {SITES.map((s) => (
                <div key={s.name} className="flex items-center gap-3">
                  <div className="w-14 shrink-0">
                    <p className="text-[12px] font-bold text-gray-800">{s.name}</p>
                    <p className="text-[10.5px] text-gray-400">{s.area}</p>
                  </div>
                  <div className="flex-1">
                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-700 ${HEALTH_COLOR(s.health)}`}
                        style={{ width: `${s.health}%` }}/>
                    </div>
                  </div>
                  <span className="text-[12px] font-semibold text-gray-700 w-8 text-right">{s.health}%</span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_BADGE[s.status] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>
                    {s.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Activity feed */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6
            shadow-[0_2px_20px_rgba(5,120,0,0.05)] animate-fadeUp" style={{ animationDelay:"0.75s" }}>
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
                  <div key={a.id} className="flex items-start gap-3 group">
                    <div className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${s.bg} ${s.text}`}>
                      {s.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] font-bold text-gray-800">{a.site}</span>
                        <span className="text-[10.5px] text-gray-400">{a.time}</span>
                      </div>
                      <p className="text-[11.5px] text-gray-500 leading-tight">{a.action}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">by {a.officer}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>
    </>
  );
}