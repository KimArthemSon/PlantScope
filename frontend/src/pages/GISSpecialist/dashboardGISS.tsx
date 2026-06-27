import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell,
  AreaChart, Area, RadialBarChart, RadialBar,
} from "recharts";
import {
  Activity, FileText, AlertTriangle, TrendingUp,
  MapPin, Users, CheckCircle2, Clock, XCircle, Sprout,
  Globe2, Droplets, Wind, Thermometer, Eye,
  ArrowUpRight, ArrowDownRight, Minus, Layers, ScanLine,
  Loader2, RefreshCw,
} from "lucide-react";
import { api } from "@/constant/api";
import { useUserRole } from "@/hooks/authorization";
import NotFoundPage from "../../components/layout/NotFoundPage";
import PlantScopeAlert from "@/components/alert/PlantScopeAlert";

// ─── Types ──────────────────────────────────────────────────────────────────

interface DashboardStats {
  total_sites: number;
  sites_this_quarter: number;
  active_monitoring: number;
  surveys_in_progress: number;
  total_reports: number;
  reports_today: number;
  map_layers_updated: number;
  layers_this_month: number;
  area_covered: number;
  barangays_count: number;
  gis_officers: number;
  active_officers_this_week: number;
  map_accuracy: number;
  flagged_sites: number;
  high_risk: number;
  medium_risk: number;
}

interface MonitoringTrendItem {
  month: string;
  monitored: number;
  target: number;
}

interface AnnualGoal {
  target: number;
  achieved: number;
  percentage: number;
  remaining: number;
  days_left: number;
}

interface ReportAreaItem {
  name: string;
  reports: number;
  updates: number;
}

interface SiteStatusItem {
  name: string;
  value: number;
  fill: string;
}

interface AccuracyTrendItem {
  month: string;
  accuracy: number;
}

interface SiteAccuracyItem {
  name: string;
  area: string;
  layers: number;
  status: string;
  accuracy: number;
}

interface ActivityItem {
  id: number;
  type: "success" | "warning" | "info" | "danger";
  site: string;
  action: string;
  time: string;
  officer: string;
}

interface WeatherData {
  temp: string;
  humidity: string;
  wind: string;
  visibility: string;
}

// ─── Helper Components ──────────────────────────────────────────────────────

function StatCard({ 
  icon, label, value, sub, trend, trendVal, color, delay 
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  trend?: "up" | "down" | null;
  trendVal?: string | null;
  color: string;
  delay: string;
}) {
  const up = trend === "up", down = trend === "down";
  return (
    <div 
      className="dash-card group relative overflow-hidden rounded-2xl p-5 border border-white/60
        bg-white shadow-[0_2px_20px_rgba(5,120,0,0.06)] hover:shadow-[0_8px_32px_rgba(5,120,0,0.14)]
        transition-all duration-300 hover:-translate-y-0.5 animate-fadeUp"
      style={{ animationDelay: delay }}
    >
      <div className={`absolute top-0 left-0 right-0 h-0.5 ${color}`} />
      <div className="flex items-start justify-between mb-3">
        <div 
          className="w-10 h-10 rounded-xl flex items-center justify-center" 
          style={{ background: "rgba(5,117,1,0.08)" }}
        >
          <span className="text-[#057501]">{icon}</span>
        </div>
        {trend && trendVal && (
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
      <p 
        className="text-[26px] font-bold text-gray-800 leading-none"
        style={{ fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: "-0.02em", fontWeight: 700 }}
      >
        {value}
      </p>
      {sub && <p className="text-[11.5px] text-gray-400 mt-1.5">{sub}</p>}
    </div>
  );
}

const GreenTooltip = ({ active, payload, label }: any) => {
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
};

const ACT_STYLE: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  success: { bg: "bg-emerald-50", text: "text-emerald-700", icon: <CheckCircle2 size={12}/> },
  warning: { bg: "bg-amber-50",   text: "text-amber-700",   icon: <Clock        size={12}/> },
  info:    { bg: "bg-sky-50",     text: "text-sky-700",     icon: <Activity     size={12}/> },
  danger:  { bg: "bg-red-50",     text: "text-red-700",     icon: <XCircle      size={12}/> },
};

const ACCURACY_COLOR = (v: number) =>
  v >= 85 ? "bg-emerald-500" : v >= 60 ? "bg-amber-400" : "bg-red-400";

const STATUS_BADGE: Record<string, string> = {
  "Active":          "bg-blue-50 text-blue-700 border-blue-200",
  "Accepted":        "bg-blue-50 text-blue-700 border-blue-200",
  "Completed":       "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Pending":         "bg-amber-50 text-amber-700 border-amber-200",
  "Pending Review":  "bg-amber-50 text-amber-700 border-amber-200",
  "Under Review":    "bg-blue-50 text-blue-700 border-blue-200",
  "Rejected":        "bg-red-50 text-red-700 border-red-200",
  "Flagged":         "bg-red-50 text-red-700 border-red-200",
  "Under Monitoring":"bg-indigo-50 text-indigo-700 border-indigo-200",
};

// ─── Main Component ─────────────────────────────────────────────────────────

export default function DashboardGISS() {
  // ─── ALL HOOKS MUST BE AT THE TOP (NO CONDITIONAL RETURNS BEFORE THIS) ──
  const { userRole, isLoading: roleLoading } = useUserRole();
  const token = localStorage.getItem("token");
  const API_BASE = api;

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [monitoringTrend, setMonitoringTrend] = useState<MonitoringTrendItem[]>([]);
  const [annualGoal, setAnnualGoal] = useState<AnnualGoal | null>(null);
  const [reportsByArea, setReportsByArea] = useState<ReportAreaItem[]>([]);
  const [siteStatus, setSiteStatus] = useState<SiteStatusItem[]>([]);
  const [accuracyTrend, setAccuracyTrend] = useState<AccuracyTrendItem[]>([]);
  const [siteAccuracy, setSiteAccuracy] = useState<SiteAccuracyItem[]>([]);
  const [recentActivities, setRecentActivities] = useState<ActivityItem[]>([]);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [PSalert, setPSAlert] = useState<{
    type: "success" | "failed" | "error";
    title: string;
    message: string;
  } | null>(null);

  // ─── useEffect AFTER all useState ────────────────────────────────────────
  useEffect(() => {
    fetchDashboardData();
  }, []);

  // ─── Fetch Dashboard Data ────────────────────────────────────────────────
  const fetchDashboardData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const response = await fetch(`${API_BASE}api/gis_dashboard/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!response.ok) throw new Error("Failed to fetch dashboard data.");
      
      const data = await response.json();
      
      setStats(data.stats);
      setMonitoringTrend(data.monitoring_trend || []);
      setAnnualGoal(data.annual_goal);
      setReportsByArea(data.reports_by_area || []);
      setSiteStatus(data.site_status || []);
      setAccuracyTrend(data.accuracy_trend || []);
      setSiteAccuracy(data.site_accuracy || []);
      setRecentActivities(data.recent_activities || []);
      setWeather(data.weather);
    } catch (err: any) {
      setPSAlert({ 
        type: "error", 
        title: "Failed to Load", 
        message: err.message || "Could not load dashboard data." 
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    fetchDashboardData(true);
    setPSAlert({ type: "success", title: "Refreshing", message: "Dashboard data is being updated..." });
  };

  // ─── NOW IT'S SAFE TO HAVE CONDITIONAL RETURNS (after all hooks) ────────
  
  // Loading state for role check
  if (roleLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <Loader2 size={40} className="animate-spin text-[#0F4A2F]" />
      </div>
    );
  }

  // Authorization check
  if (!token || userRole !== "GISSpecialist") {
    return <NotFoundPage />;
  }

  // Loading state for dashboard data
  if (loading && !stats) {
    return (
      <div className="dash-root bg-[#f5faf6] min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={48} className="animate-spin text-[#0F4A2F] mx-auto mb-4" />
          <p className="text-gray-500 font-medium">Loading GIS Dashboard...</p>
        </div>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────
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
        .recharts-cartesian-grid-horizontal line,
        .recharts-cartesian-grid-vertical   line { stroke: #f0fdf4; }
      `}</style>

      {PSalert && (
        <PlantScopeAlert 
          type={PSalert.type} 
          title={PSalert.title} 
          message={PSalert.message} 
          onClose={() => setPSAlert(null)} 
        />
      )}

      <div className="dash-root bg-[#f5faf6] min-h-screen p-6 overflow-x-hidden">

        {/* Weather strip */}
        <div 
          className="flex items-center gap-6 mb-6 bg-[#0F4A2F] rounded-2xl px-5 py-3
            shadow-[0_4px_24px_rgba(15,74,47,0.25)] animate-fadeUp" 
          style={{ animationDelay: "0s" }}
        >
          <div className="flex items-center gap-2 mr-2">
            <Globe2 size={16} className="text-emerald-300" />
            <span className="text-emerald-200 text-[12px] font-semibold tracking-wider uppercase">
              Ormoc City — Live Conditions
            </span>
          </div>
          <div className="w-px h-5 bg-white/20" />
          {weather && [
            { icon: <Thermometer size={16} />, label: "Temp",      value: weather.temp },
            { icon: <Droplets    size={16} />, label: "Humidity",  value: weather.humidity },
            { icon: <Wind        size={16} />, label: "Wind",      value: weather.wind },
            { icon: <Eye         size={16} />, label: "Visibility",value: weather.visibility },
          ].map((w) => (
            <div key={w.label} className="flex items-center gap-1.5 text-white/70 text-[12.5px]">
              <span className="text-emerald-400">{w.icon}</span>
              <span className="text-white/40">{w.label}</span>
              <span className="text-white font-semibold">{w.value}</span>
            </div>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-400/70 text-[11px] font-medium">
              {new Date().toLocaleDateString("en-PH", { weekday: "long", month: "short", day: "numeric", year: "numeric" })}
            </span>
          </div>
        </div>

        {/* Header */}
        <div className="mb-6 flex items-center justify-between animate-fadeUp" style={{ animationDelay: "0.02s" }}>
          <div>
            <h1 className="dash-title text-[28px] font-bold text-[#0F4A2F]">GIS Specialist Dashboard</h1>
            <p className="text-[13px] text-gray-500 mt-0.5">Overview of GIS site monitoring, spatial data, and mapping analytics.</p>
          </div>
          <button 
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0F4A2F] text-white text-sm font-semibold 
              hover:bg-[#1a6b44] transition-colors shadow-sm disabled:opacity-60"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {/* Stat Cards */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard 
              icon={<MapPin size={20}/>} 
              label="Total Sites" 
              value={stats.total_sites} 
              sub={`${stats.sites_this_quarter} added this quarter`} 
              trend={stats.sites_this_quarter > 0 ? "up" : null}
              trendVal={stats.sites_this_quarter > 0 ? `+${stats.sites_this_quarter}` : null}
              color="bg-emerald-500" 
              delay="0.05s"
            />
            <StatCard 
              icon={<ScanLine size={20}/>} 
              label="Active Monitoring" 
              value={stats.active_monitoring} 
              sub={`${stats.surveys_in_progress} surveys in progress`} 
              trend="up" 
              trendVal={`+${stats.surveys_in_progress}`} 
              color="bg-blue-500" 
              delay="0.1s" 
            />
            <StatCard 
              icon={<FileText size={20}/>} 
              label="GIS Reports" 
              value={stats.total_reports} 
              sub={`${stats.reports_today} generated today`} 
              trend={stats.reports_today > 0 ? "up" : null}
              trendVal={stats.reports_today > 0 ? `+${stats.reports_today}` : null}
              color="bg-violet-500" 
              delay="0.15s"
            />
            <StatCard 
              icon={<Layers size={20}/>} 
              label="Map Layers Updated" 
              value={stats.map_layers_updated} 
              sub={`↑ ${stats.layers_this_month} this month`} 
              trend="up" 
              trendVal={`+${stats.layers_this_month}`} 
              color="bg-teal-500" 
              delay="0.2s" 
            />
            <StatCard 
              icon={<Sprout size={20}/>} 
              label="Area Covered" 
              value={`${stats.area_covered} ha`} 
              sub={`Across ${stats.barangays_count} barangays`} 
              trend={null} 
              trendVal={null} 
              color="bg-orange-500" 
              delay="0.25s"
            />
            <StatCard 
              icon={<Users size={20}/>} 
              label="GIS Officers" 
              value={stats.gis_officers} 
              sub={`${stats.active_officers_this_week} active this week`} 
              trend="up" 
              trendVal={`+${stats.active_officers_this_week}`} 
              color="bg-pink-500" 
              delay="0.3s" 
            />
            <StatCard 
              icon={<CheckCircle2 size={20}/>} 
              label="Map Accuracy" 
              value={`${stats.map_accuracy}%`} 
              sub="Target: 90% ✓" 
              trend={stats.map_accuracy >= 90 ? "up" : "down"}
              trendVal={stats.map_accuracy >= 90 ? "On Target" : "Below Target"}
              color="bg-emerald-500" 
              delay="0.35s"
            />
            <StatCard 
              icon={<AlertTriangle size={20}/>} 
              label="Flagged Sites" 
              value={stats.flagged_sites} 
              sub={`${stats.high_risk} critical, ${stats.medium_risk} medium`} 
              trend={stats.flagged_sites > 0 ? "down" : "up"}
              trendVal={stats.flagged_sites > 0 ? `${stats.flagged_sites} flagged` : "All clear"}
              color="bg-red-500" 
              delay="0.4s" 
            />
          </div>
        )}

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
          {/* Area chart — monitoring trend */}
          <div 
            className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-6
              shadow-[0_2px_20px_rgba(5,120,0,0.05)] animate-fadeUp" 
            style={{ animationDelay: "0.45s" }}
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="dash-title text-[15px] font-bold text-gray-800">Sites Monitored vs Target</h2>
                <p className="text-[12px] text-gray-400 mt-0.5">Monthly comparison of monitored sites against targets</p>
              </div>
              {monitoringTrend.length > 0 && (
                <span className="bg-emerald-50 text-emerald-700 text-[11px] font-semibold px-3 py-1 rounded-full border border-emerald-200">
                  {monitoringTrend[monitoringTrend.length - 1]?.monitored || 0} this month
                </span>
              )}
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={monitoringTrend}>
                <defs>
                  <linearGradient id="targGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#0F4A2F" stopOpacity={0.10}/>
                    <stop offset="95%" stopColor="#0F4A2F" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="monGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#10b981" stopOpacity={0.18}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false}/>
                <Tooltip content={<GreenTooltip/>}/>
                <Legend wrapperStyle={{ fontSize: 12 }}/>
                <Area type="monotone" dataKey="target"    name="Target"    stroke="#0F4A2F" strokeWidth={2} fill="url(#targGrad)" strokeDasharray="5 3"/>
                <Area type="monotone" dataKey="monitored" name="Monitored" stroke="#10b981" strokeWidth={2.5} fill="url(#monGrad)"/>
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Radial — annual monitoring goal */}
          <div 
            className="bg-white rounded-2xl border border-gray-100 p-6
              shadow-[0_2px_20px_rgba(5,120,0,0.05)] flex flex-col animate-fadeUp" 
            style={{ animationDelay: "0.5s" }}
          >
            <h2 className="dash-title text-[15px] font-bold text-gray-800 mb-1">Annual Goal</h2>
            <p className="text-[12px] text-gray-400 mb-4">
              Sites mapped vs {annualGoal?.target || 0}-site target
            </p>
            <div className="flex-1 flex flex-col items-center justify-center">
              <ResponsiveContainer width="100%" height={180}>
                <RadialBarChart 
                  innerRadius={52} 
                  outerRadius={82} 
                  data={[
                    { name: "Target",   value: 100, fill: "#064e3b" },
                    { name: "Achieved", value: annualGoal?.percentage || 0,  fill: "#10b981" },
                  ]} 
                  startAngle={220} 
                  endAngle={-40}
                >
                  <RadialBar dataKey="value" cornerRadius={8} background={{ fill: "#f0fdf4" }}>
                    <Cell fill="#064e3b"/>
                    <Cell fill="#10b981"/>
                  </RadialBar>
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="text-center -mt-4">
                <p 
                  className="text-[32px] text-gray-800 leading-none"
                  style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, letterSpacing: "-0.02em" }}
                >
                  {annualGoal?.percentage || 0}%
                </p>
                <p className="text-[12px] text-gray-400 mt-1">
                  {annualGoal?.achieved || 0} / {annualGoal?.target || 0} sites completed
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="bg-emerald-50 rounded-xl p-3 text-center">
                <p className="text-[11px] text-emerald-600 font-medium">Remaining</p>
                <p 
                  className="text-[18px] font-bold text-emerald-800" 
                  style={{ fontFamily: "'Barlow Condensed',sans-serif" }}
                >
                  {annualGoal?.remaining || 0}
                </p>
              </div>
              <div className="bg-[#0F4A2F]/5 rounded-xl p-3 text-center">
                <p className="text-[11px] text-gray-500 font-medium">Days Left</p>
                <p 
                  className="text-[18px] font-bold text-gray-800" 
                  style={{ fontFamily: "'Barlow Condensed',sans-serif" }}
                >
                  {annualGoal?.days_left || 0}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
          {/* Bar — reports by area */}
          <div 
            className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-6
              shadow-[0_2px_20px_rgba(5,120,0,0.05)] animate-fadeUp" 
            style={{ animationDelay: "0.55s" }}
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="dash-title text-[15px] font-bold text-gray-800">Reports & Layer Updates by Area</h2>
                <p className="text-[12px] text-gray-400 mt-0.5">Cumulative across all barangays</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={reportsByArea} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" vertical={false}/>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false}/>
                <Tooltip content={<GreenTooltip/>}/>
                <Legend wrapperStyle={{ fontSize: 12 }}/>
                <Bar dataKey="reports" name="Reports"       fill="#bfdbfe" radius={[5,5,0,0]}/>
                <Bar dataKey="updates" name="Layer Updates" fill="#3b82f6" radius={[5,5,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Pie — site status */}
          <div 
            className="bg-white rounded-2xl border border-gray-100 p-6
              shadow-[0_2px_20px_rgba(5,120,0,0.05)] animate-fadeUp" 
            style={{ animationDelay: "0.6s" }}
          >
            <h2 className="dash-title text-[15px] font-bold text-gray-800 mb-1">Site Status Distribution</h2>
            <p className="text-[12px] text-gray-400 mb-3">
              All {stats?.total_sites || 0} monitored sites
            </p>
            <ResponsiveContainer width="100%" height={170}>
              <PieChart>
                <Pie 
                  data={siteStatus} 
                  dataKey="value" 
                  nameKey="name" 
                  outerRadius={72} 
                  innerRadius={38} 
                  paddingAngle={3}
                >
                  {siteStatus.map((d, i) => <Cell key={i} fill={d.fill}/>)}
                </Pie>
                <Tooltip content={<GreenTooltip/>}/>
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-2 mt-3">
              {siteStatus.map((d) => (
                <div key={d.name} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.fill }}/>
                  <span className="text-[11.5px] text-gray-600 truncate">{d.name}</span>
                  <span className="ml-auto text-[11.5px] font-bold text-gray-800">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Accuracy trend */}
          <div 
            className="bg-white rounded-2xl border border-gray-100 p-6
              shadow-[0_2px_20px_rgba(5,120,0,0.05)] animate-fadeUp" 
            style={{ animationDelay: "0.65s" }}
          >
            <h2 className="dash-title text-[15px] font-bold text-gray-800 mb-1">Map Accuracy Trend</h2>
            <p className="text-[12px] text-gray-400 mb-4">Monthly average across all sites</p>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={accuracyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" vertical={false}/>
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false}/>
                <YAxis domain={[70, 100]} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false}/>
                <Tooltip content={<GreenTooltip/>}/>
                <Line 
                  type="monotone" 
                  dataKey="accuracy" 
                  name="Accuracy %" 
                  stroke="#057501" 
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "#057501", strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: "#0F4A2F" }}
                />
              </LineChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-2 mt-3 bg-emerald-50 rounded-xl px-4 py-2.5">
              <TrendingUp size={14} className="text-emerald-600"/>
              <span className="text-[12px] text-emerald-700 font-medium">
                {accuracyTrend.length > 0 
                  ? `Avg ${Math.round(accuracyTrend.reduce((sum, d) => sum + d.accuracy, 0) / accuracyTrend.length)}% — ${
                      (accuracyTrend[accuracyTrend.length - 1]?.accuracy || 0) >= 90 ? "exceeding" : "approaching"
                    } 90% target`
                  : "No accuracy data yet"}
              </span>
            </div>
          </div>

          {/* Site accuracy table */}
          <div 
            className="bg-white rounded-2xl border border-gray-100 p-6
              shadow-[0_2px_20px_rgba(5,120,0,0.05)] animate-fadeUp" 
            style={{ animationDelay: "0.7s" }}
          >
            <h2 className="dash-title text-[15px] font-bold text-gray-800 mb-4">Site Data Overview</h2>
            <div className="flex flex-col gap-3">
              {siteAccuracy.length > 0 ? (
                siteAccuracy.map((s) => (
                  <div key={s.name} className="flex items-center gap-3">
                    <div className="w-16 shrink-0">
                      <p className="text-[12px] font-bold text-gray-800 truncate">{s.name}</p>
                      <p className="text-[10.5px] text-gray-400">{s.area}</p>
                    </div>
                    <div className="flex-1">
                      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-700 ${ACCURACY_COLOR(s.accuracy)}`}
                          style={{ width: `${s.accuracy}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-[12px] font-semibold text-gray-700 w-8 text-right">
                      {s.accuracy}%
                    </span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_BADGE[s.status] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>
                      {s.status}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-400 text-center py-4">No sites available</p>
              )}
            </div>
          </div>

          {/* Activity feed */}
          <div 
            className="bg-white rounded-2xl border border-gray-100 p-6
              shadow-[0_2px_20px_rgba(5,120,0,0.05)] animate-fadeUp" 
            style={{ animationDelay: "0.75s" }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="dash-title text-[15px] font-bold text-gray-800">Recent Activity</h2>
              <button className="text-[11px] text-emerald-600 hover:text-emerald-800 font-semibold transition-colors cursor-pointer">
                View all →
              </button>
            </div>
            <div className="flex flex-col gap-3">
              {recentActivities.length > 0 ? (
                recentActivities.map((a) => {
                  const s = ACT_STYLE[a.type] || ACT_STYLE.info;
                  return (
                    <div key={a.id} className="flex items-start gap-3">
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
                })
              ) : (
                <p className="text-sm text-gray-400 text-center py-4">No recent activity</p>
              )}
            </div>
          </div>
        </div>

      </div>
    </>
  );
}