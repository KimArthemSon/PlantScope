import NotFoundPage from "../../../components/layout/NotFoundPage";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell,
  AreaChart, Area,
} from "recharts";
import { useEffect, useState } from "react";
import {
  TreePine, Activity, FileText, AlertTriangle, TrendingUp,
  MapPin, Users, Droplets, Wind, Thermometer, Eye,
  ArrowUpRight, ArrowDownRight, Minus, CheckCircle2,
  Clock, XCircle, Sprout, Globe2, Loader2, ExternalLink,
  Award, Shield, Target, ClipboardList,
} from "lucide-react";
import { api } from "@/constant/api.ts";

// ─── Types ───────────────────────────────────────────────────────────────────
interface HeadDashboardData {
  tab1_executive: {
    kpis: {
      pending_my_approval: number;
      total_active_programs: number;
      total_tree_grower_groups: number;
      total_hectares: number;
      total_seedlings_distributed: number;
      overall_survival_rate: number;
      completed_programs: number;
      failed_programs: number;
    };
    pipeline_data: {
      for_evaluation: number;
      for_head: number;
      accepted: number;
      under_monitoring: number;
      completed: number;
    };
    monthly_trend: { month: string; submitted: number; approved: number }[];
    species_data: { name: string; survived: number; dead: number; survival_rate: number }[];
    barangay_data: { barangay_name: string; active_programs: number }[];
    recent_activities: { id: number; type: string; ref: string; action: string; time: string; officer: string }[];
  };
  tab2_pending: {
    pending_approvals: any[];
    total_pending: number;
  };
  tab3_performance: {
    kpis: {
      active_monitoring: number;
      total_progress_reports: number;
      avg_survival_rate: number;
      compliance_rate: number;
    };
    survival_rate_trend: { month: string; rate: number }[];
    status_data: { name: string; value: number; fill: string }[];
    monthly_planting: { month: string; seedlings: number }[];
  };
  tab4_treegrowers: {
    kpis: {
      total_groups: number;
      new_groups_this_month: number;
      excellent_groups: number;
      needs_intervention: number;
    };
    tree_grower_analysis: any[];
  };
  tab5_barangay: {
    hectares_by_barangay: any[];
    programs_by_barangay: any[];
    land_classification: any[];
    barangay_table: any[];
  };
}

// ─── Constants ───────────────────────────────────────────────────────────────
const WEATHER = [
  { icon: <Thermometer size={16} />, label: "Temp", value: "27°C" },
  { icon: <Droplets size={16} />, label: "Humidity", value: "74%" },
  { icon: <Wind size={16} />, label: "Wind", value: "12 km/h" },
  { icon: <Eye size={16} />, label: "Visibility", value: "Good" },
];

const TABS = [
  { id: "overview", label: "Executive Overview", icon: <Activity size={16} /> },
  { id: "pending", label: "Pending Approvals", icon: <AlertTriangle size={16} /> },
  { id: "performance", label: "Program Performance", icon: <TrendingUp size={16} /> },
  { id: "treegrowers", label: "Tree Grower Analysis", icon: <Users size={16} /> },
  { id: "barangay", label: "Barangay Coverage", icon: <MapPin size={16} /> },
];

const ACT_STYLE: Record<string, { bg: string; text: string; icon: JSX.Element }> = {
  success: { bg: "bg-emerald-50", text: "text-emerald-700", icon: <CheckCircle2 size={12} /> },
  warning: { bg: "bg-amber-50", text: "text-amber-700", icon: <Clock size={12} /> },
  info:    { bg: "bg-sky-50",    text: "text-sky-700",    icon: <Activity size={12} /> },
  danger:  { bg: "bg-red-50",    text: "text-red-700",    icon: <XCircle size={12} /> },
};

const STATUS_COLORS: Record<string, string> = {
  Ongoing: "#10b981",
  Completed: "#065f46",
  Pending: "#f59e0b",
  "On Hold": "#94a3b8",
};

// ─── Stat Card ───────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, color, delay, alert }: any) {
  return (
    <div
      className={`dash-card group relative overflow-hidden rounded-2xl p-5 border ${
        alert ? 'border-red-300 bg-red-50/30' : 'border-white/60 bg-white'
      } shadow-[0_2px_20px_rgba(5,120,0,0.06)] hover:shadow-[0_8px_32px_rgba(5,120,0,0.14)]
      transition-all duration-300 hover:-translate-y-0.5 animate-fadeUp`}
      style={{ animationDelay: delay }}
    >
      <div className={`absolute top-0 left-0 right-0 h-0.5 ${color}`} />
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(5,117,1,0.08)" }}>
          <span className="text-[#057501]">{icon}</span>
        </div>
        {alert && (
          <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
            ACTION
          </span>
        )}
      </div>
      <p className="text-[13px] text-gray-500 font-medium mb-0.5">{label}</p>
      <p className="text-[26px] font-bold text-gray-800 leading-none" style={{ fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: "-0.02em", fontWeight: 700 }}>
        {value}
      </p>
      {sub && <p className="text-[11.5px] text-gray-400 mt-1.5">{sub}</p>}
    </div>
  );
}

// ─── Custom Tooltip ──────────────────────────────────────────────────────────
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

// ─── Card Component ──────────────────────────────────────────────────────────
function Card({ children, delay = "0s", className = "" }: any) {
  return (
    <div
      className={`bg-white rounded-2xl border border-gray-100 p-6 shadow-[0_2px_20px_rgba(5,120,0,0.05)] animate-fadeUp ${className}`}
      style={{ animationDelay: delay }}
    >
      {children}
    </div>
  );
}

// ─── Section Header ──────────────────────────────────────────────────────────
function SectionHeader({ title, sub, badge, icon }: any) {
  return (
    <div className="flex items-start justify-between mb-5">
      <div className="flex items-start gap-3">
        {icon && (
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#057501]/[0.08] shrink-0">
            <span className="text-[#057501]">{icon}</span>
          </div>
        )}
        <div>
          <h2 className="dash-title text-[17px] font-bold text-gray-800">{title}</h2>
          {sub && <p className="text-[12px] text-gray-400 mt-0.5">{sub}</p>}
        </div>
      </div>
      {badge && (
        <span className="bg-emerald-50 text-emerald-700 text-[11px] font-semibold px-3 py-1 rounded-full border border-emerald-200 shrink-0">
          {badge}
        </span>
      )}
    </div>
  );
}

// ─── Main Dashboard Component ────────────────────────────────────────────────
export default function HeadDashboard() {
  const [isAuthorize, setIsAuthorize] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [data, setData] = useState<HeadDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkIfStillLogin();
  }, []);

  useEffect(() => {
    if (isAuthorize) {
      fetchDashboardData();
    }
  }, [isAuthorize]);

  const checkIfStillLogin = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setIsAuthorize(false);
      return;
    }
    try {
      const response = await fetch(api + "api/get_me/", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const resData = await response.json();
      setIsAuthorize(response.ok && resData.user_role === "CityENROHead");
    } catch {
      setIsAuthorize(false);
    }
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${api}api/get_head_dashboard_data/`, {
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

  if (isAuthorize === null) {
    return (
      <div className="min-h-screen bg-[#f5faf6] flex items-center justify-center">
        <Loader2 size={40} className="animate-spin text-[#0F4A2F]" />
      </div>
    );
  }

  if (!isAuthorize) return <NotFoundPage />;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Barlow+Condensed:wght@600;700;800&display=swap');
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

      <div className="dash-root bg-[#f5faf6] min-h-screen p-6 overflow-x-hidden">
        {/* ── Weather strip ── */}
        <div className="flex items-center gap-6 mb-6 bg-[#0F4A2F] rounded-2xl px-5 py-3 shadow-[0_4px_24px_rgba(15,74,47,0.25)] animate-fadeUp flex-wrap" style={{ animationDelay: "0s" }}>
          <div className="flex items-center gap-2 mr-2">
            <Globe2 size={16} className="text-emerald-300" />
            <span className="text-emerald-200 text-[12px] font-semibold tracking-wider uppercase">
              Ormoc City — Live Conditions
            </span>
          </div>
          <div className="w-px h-5 bg-white/20 hidden sm:block" />
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
              {new Date().toLocaleDateString("en-PH", { weekday: "long", month: "short", day: "numeric", year: "numeric" })}
            </span>
          </div>
        </div>

        {/* ── Header ── */}
        <div className="mb-6 animate-fadeUp" style={{ animationDelay: "0.02s" }}>
          <h1 className="dash-title text-[28px] font-bold text-[#0F4A2F]">
            City ENRO Head Dashboard
          </h1>
          <p className="text-[13px] text-gray-500 mt-0.5">
            Strategic oversight of reforestation programs · Ormoc City CENRO
          </p>
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1.5 mb-6 bg-white rounded-xl p-1.5 border border-gray-100 shadow-[0_1px_8px_rgba(0,0,0,0.05)] w-fit animate-fadeUp overflow-x-auto" style={{ animationDelay: "0.04s" }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-[12px] font-semibold transition-all cursor-pointer whitespace-nowrap
                ${activeTab === tab.id
                  ? "bg-[#0F4A2F] text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
            >
              {tab.icon} {tab.label}
              {tab.id === "pending" && data?.tab2_pending.total_pending > 0 && (
                <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full ml-1">
                  {data.tab2_pending.total_pending}
                </span>
              )}
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
            {activeTab === "overview" && <TabOverview data={data.tab1_executive} />}
            {activeTab === "pending" && <TabPending data={data.tab2_pending} />}
            {activeTab === "performance" && <TabPerformance data={data.tab3_performance} />}
            {activeTab === "treegrowers" && <TabTreeGrowers data={data.tab4_treegrowers} />}
            {activeTab === "barangay" && <TabBarangay data={data.tab5_barangay} />}
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

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 1: EXECUTIVE OVERVIEW
// ═══════════════════════════════════════════════════════════════════════════════
function TabOverview({ data }: { data: any }) {
  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<AlertTriangle size={20} />}
          label="Pending My Approval"
          value={data.kpis.pending_my_approval}
          sub="Requires immediate action"
          color="bg-red-500"
          delay="0.05s"
          alert={data.kpis.pending_my_approval > 0}
        />
        <StatCard
          icon={<Activity size={20} />}
          label="Active Programs"
          value={data.kpis.total_active_programs}
          sub="Currently under monitoring"
          color="bg-blue-500"
          delay="0.1s"
        />
        <StatCard
          icon={<Users size={20} />}
          label="Tree Grower Groups"
          value={data.kpis.total_tree_grower_groups}
          sub="Active community groups"
          color="bg-emerald-500"
          delay="0.15s"
        />
        <StatCard
          icon={<MapPin size={20} />}
          label="Total Hectares"
          value={`${data.kpis.total_hectares} ha`}
          sub="Reforestation coverage"
          color="bg-teal-500"
          delay="0.2s"
        />
        <StatCard
          icon={<Sprout size={20} />}
          label="Seedlings Distributed"
          value={data.kpis.total_seedlings_distributed.toLocaleString()}
          sub="Total seedlings provided"
          color="bg-green-500"
          delay="0.25s"
        />
        <StatCard
          icon={<TrendingUp size={20} />}
          label="Survival Rate"
          value={`${data.kpis.overall_survival_rate}%`}
          sub={`Target: 85% ${data.kpis.overall_survival_rate >= 85 ? '✓' : '✗'}`}
          color={data.kpis.overall_survival_rate >= 85 ? "bg-emerald-500" : "bg-amber-500"}
          delay="0.3s"
        />
        <StatCard
          icon={<CheckCircle2 size={20} />}
          label="Completed Programs"
          value={data.kpis.completed_programs}
          sub="Successfully finished"
          color="bg-green-600"
          delay="0.35s"
        />
        <StatCard
          icon={<XCircle size={20} />}
          label="Failed/Rejected"
          value={data.kpis.failed_programs}
          sub="Programs not approved"
          color="bg-red-500"
          delay="0.4s"
        />
      </div>

      {/* Pipeline Funnel & Monthly Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Application Pipeline Funnel */}
        <Card delay="0.45s">
          <SectionHeader
            icon={<ClipboardList size={20} />}
            title="Application Pipeline"
            sub="Current workflow distribution"
          />
          <div className="space-y-3">
            {[
              { label: "For Evaluation", value: data.pipeline_data.for_evaluation, color: "bg-amber-400" },
              { label: "Pending Approval", value: data.pipeline_data.for_head, color: "bg-orange-500" },
              { label: "Accepted", value: data.pipeline_data.accepted, color: "bg-blue-500" },
              { label: "Under Monitoring", value: data.pipeline_data.under_monitoring, color: "bg-indigo-500" },
              { label: "Completed", value: data.pipeline_data.completed, color: "bg-emerald-500" },
            ].map((item, i) => {
              const max = Math.max(...Object.values(data.pipeline_data));
              const width = max > 0 ? (item.value / max) * 100 : 0;
              return (
                <div key={i}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[11px] font-medium text-gray-600">{item.label}</span>
                    <span className="text-[12px] font-bold text-gray-800">{item.value}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${item.color} transition-all duration-700`} style={{ width: `${width}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Monthly Trend */}
        <Card delay="0.5s" className="lg:col-span-2">
          <SectionHeader
            title="Monthly Program Trend"
            sub="Applications submitted vs approved"
            badge="Last 7 months"
          />
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={data.monthly_trend}>
              <defs>
                <linearGradient id="submittedGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="approvedGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip content={<GreenTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="submitted" name="Submitted" stroke="#6366f1" strokeWidth={2} fill="url(#submittedGrad)" />
              <Area type="monotone" dataKey="approved" name="Approved" stroke="#10b981" strokeWidth={2.5} fill="url(#approvedGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Species Survival & Barangay Coverage */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Species Survival */}
        <Card delay="0.55s" className="lg:col-span-2">
          <SectionHeader
            title="Seedling Survival by Species"
            sub="Top performing species"
          />
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.species_data} layout="vertical" margin={{ left: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <Tooltip content={<GreenTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="survived" name="Survived" fill="#10b981" radius={[0, 5, 5, 0]} />
              <Bar dataKey="dead" name="Dead" fill="#fca5a5" radius={[0, 5, 5, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Barangay Coverage */}
        <Card delay="0.6s">
          <SectionHeader
            title="Barangay Coverage"
            sub="Active programs per area"
          />
          <div className="space-y-3">
            {data.barangay_data.map((b: any, i: number) => {
              const max = Math.max(...data.barangay_data.map((x: any) => x.active_programs));
              const width = max > 0 ? (b.active_programs / max) * 100 : 0;
              const colors = ["bg-emerald-500", "bg-blue-500", "bg-indigo-500", "bg-amber-500", "bg-pink-500", "bg-violet-500"];
              return (
                <div key={i}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[11px] font-medium text-gray-700 truncate">{b.barangay_name}</span>
                    <span className="text-[12px] font-bold text-gray-800">{b.active_programs}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${colors[i % colors.length]} transition-all duration-700`} style={{ width: `${width}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Recent Activity Feed */}
      <Card delay="0.65s">
        <SectionHeader
          icon={<Activity size={20} />}
          title="Recent Activity"
          sub="Latest system events and decisions"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {data.recent_activities.length > 0 ? data.recent_activities.map((a: any) => {
            const s = ACT_STYLE[a.type] || ACT_STYLE.info;
            return (
              <div key={a.id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                <div className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${s.bg} ${s.text}`}>
                  {s.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-bold text-gray-800">{a.ref}</span>
                    <span className="text-[10.5px] text-gray-400">{a.time}</span>
                  </div>
                  <p className="text-[11.5px] text-gray-600 leading-tight mt-0.5">{a.action}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">by {a.officer}</p>
                </div>
              </div>
            );
          }) : (
            <p className="text-center text-gray-400 text-sm py-8 col-span-2">No recent activity</p>
          )}
        </div>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 2: PENDING APPROVALS
// ═══════════════════════════════════════════════════════════════════════════════
function TabPending({ data }: { data: any }) {
  return (
    <div className="space-y-6">
      <Card delay="0.1s">
        <SectionHeader
          icon={<AlertTriangle size={20} />}
          title="Pending Approvals Queue"
          sub={`${data.total_pending} applications awaiting your decision`}
          badge={data.total_pending > 0 ? "Action Required" : "All Clear"}
        />
        
        {data.pending_approvals.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  {["Ref", "Group", "Program", "Site", "Barangay", "Area", "NDVI", "Waiting", "Action"].map((h) => (
                    <th key={h} className="py-3 px-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.pending_approvals.map((app: any) => (
                  <tr key={app.application_id} className="hover:bg-amber-50/40 transition-colors">
                    <td className="py-3 px-3 text-[12px] font-bold text-[#0F4A2F]">{app.ref}</td>
                    <td className="py-3 px-3 text-[12px] text-gray-700 font-medium">{app.group_name}</td>
                    <td className="py-3 px-3 text-[12px] text-gray-700 truncate max-w-[150px]">{app.title}</td>
                    <td className="py-3 px-3 text-[12px] text-gray-700">{app.site_name}</td>
                    <td className="py-3 px-3 text-[11px] text-gray-500">{app.barangay}</td>
                    <td className="py-3 px-3 text-[12px] text-gray-700">{app.area_hectares} ha</td>
                    <td className="py-3 px-3">
                      <span className={`text-[11px] font-bold ${app.ndvi_score >= 80 ? 'text-emerald-600' : app.ndvi_score >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                        {app.ndvi_score}%
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        app.days_waiting > 7 ? 'bg-red-100 text-red-700' : 
                        app.days_waiting > 3 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                      }`}>
                        {app.days_waiting} days
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <button className="flex items-center gap-1 text-[11px] font-semibold text-[#0F4A2F] hover:text-emerald-700 transition-colors">
                        <ExternalLink size={12} /> Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <CheckCircle2 size={48} className="text-emerald-500 mx-auto mb-3" />
            <p className="text-gray-600 font-medium">All caught up!</p>
            <p className="text-gray-400 text-sm mt-1">No pending approvals at this time</p>
          </div>
        )}
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 3: PROGRAM PERFORMANCE
// ═══════════════════════════════════════════════════════════════════════════════
function TabPerformance({ data }: { data: any }) {
  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Activity size={20} />}
          label="Active Monitoring"
          value={data.kpis.active_monitoring}
          sub="Programs under watch"
          color="bg-blue-500"
          delay="0.05s"
        />
        <StatCard
          icon={<FileText size={20} />}
          label="Progress Reports"
          value={data.kpis.total_progress_reports}
          sub="Total submitted"
          color="bg-emerald-500"
          delay="0.1s"
        />
        <StatCard
          icon={<TrendingUp size={20} />}
          label="Avg Survival Rate"
          value={`${data.kpis.avg_survival_rate}%`}
          sub="Across all programs"
          color={data.kpis.avg_survival_rate >= 80 ? "bg-green-500" : "bg-amber-500"}
          delay="0.15s"
        />
        <StatCard
          icon={<Target size={20} />}
          label="Compliance Rate"
          value={`${data.kpis.compliance_rate}%`}
          sub="Reporting on time"
          color="bg-indigo-500"
          delay="0.2s"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Survival Rate Trend */}
        <Card delay="0.25s">
          <SectionHeader
            title="Survival Rate Trend"
            sub="Monthly average across all programs"
            badge={`${data.kpis.avg_survival_rate}% avg`}
          />
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data.survival_rate_trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip content={<GreenTooltip />} />
              <Line
                type="monotone"
                dataKey="rate"
                name="Survival Rate %"
                stroke="#10b981"
                strokeWidth={3}
                dot={{ r: 4, fill: "#10b981", strokeWidth: 0 }}
                activeDot={{ r: 6, fill: "#0F4A2F" }}
              />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-2 mt-4 bg-emerald-50 rounded-xl px-4 py-3">
            <TrendingUp size={16} className="text-emerald-600" />
            <span className="text-sm text-emerald-700 font-medium">
              {data.kpis.avg_survival_rate >= 80 
                ? `Excellent! ${data.kpis.avg_survival_rate}% average survival rate exceeds 80% target`
                : data.kpis.avg_survival_rate >= 60
                ? `Good progress at ${data.kpis.avg_survival_rate}%. Target: 80%`
                : `Needs improvement at ${data.kpis.avg_survival_rate}%. Target: 80%`}
            </span>
          </div>
        </Card>

        {/* Status Distribution */}
        <Card delay="0.3s">
          <SectionHeader
            title="Programs by Status"
            sub="Distribution of all programs"
          />
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={data.status_data} dataKey="value" nameKey="name" outerRadius={85} innerRadius={45} paddingAngle={3}>
                {data.status_data.map((d: any, i: number) => (<Cell key={i} fill={d.fill} />))}
              </Pie>
              <Tooltip content={<GreenTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-2 mt-4">
            {data.status_data.map((d: any) => (
              <div key={d.name} className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: d.fill }} />
                <span className="text-xs text-gray-600">{d.name}</span>
                <span className="ml-auto text-xs font-bold text-gray-800">{d.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Monthly Planting Progress */}
      <Card delay="0.35s">
        <SectionHeader
          title="Monthly Planting Progress"
          sub="Seedlings provided per month"
        />
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={data.monthly_planting}>
            <defs>
              <linearGradient id="plantingGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <Tooltip content={<GreenTooltip />} />
            <Area
              type="monotone"
              dataKey="seedlings"
              name="Seedlings Planted"
              stroke="#10b981"
              strokeWidth={2.5}
              fill="url(#plantingGrad)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 4: TREE GROWER ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════════
function TabTreeGrowers({ data }: { data: any }) {
  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Users size={20} />}
          label="Total Groups"
          value={data.kpis.total_groups}
          sub="Active tree grower groups"
          color="bg-blue-500"
          delay="0.05s"
        />
        <StatCard
          icon={<Sprout size={20} />}
          label="New This Month"
          value={data.kpis.new_groups_this_month}
          sub="Groups joined this month"
          color="bg-emerald-500"
          delay="0.1s"
        />
        <StatCard
          icon={<Award size={20} />}
          label="Excellent Performance"
          value={data.kpis.excellent_groups}
          sub="≥80% survival rate"
          color="bg-green-500"
          delay="0.15s"
        />
        <StatCard
          icon={<AlertTriangle size={20} />}
          label="Needs Intervention"
          value={data.kpis.needs_intervention}
          sub="<50% survival or non-compliant"
          color="bg-red-500"
          delay="0.2s"
        />
      </div>

      {/* Tree Grower Table */}
      <Card delay="0.25s">
        <SectionHeader
          icon={<Users size={20} />}
          title="Tree Grower Group Analysis"
          sub={`${data.tree_grower_analysis.length} groups tracked`}
          badge="Performance Ranking"
        />
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-200">
                {["Group Name", "Type", "Completed", "Survival Rate", "Seedlings", "Compliance"].map((h) => (
                  <th key={h} className="py-3 px-4 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.tree_grower_analysis.length > 0 ? data.tree_grower_analysis.map((group: any, i: number) => (
                <tr key={i} className="hover:bg-emerald-50/40 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                        <Users size={14} className="text-emerald-600" />
                      </div>
                      <span className="text-sm font-semibold text-gray-800">{group.group_name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                      {group.group_type}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-700">{group.completed_programs}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            group.survival_rate >= 80 ? 'bg-emerald-500' : 
                            group.survival_rate >= 60 ? 'bg-amber-400' : 'bg-red-400'
                          }`}
                          style={{ width: `${group.survival_rate}%` }}
                        />
                      </div>
                      <span
                        className="text-xs font-bold"
                        style={{
                          color: group.survival_rate >= 80 ? '#10b981' : 
                                 group.survival_rate >= 60 ? '#f59e0b' : '#ef4444'
                        }}
                      >
                        {group.survival_rate}%
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-700">{group.seedlings_received.toLocaleString()}</td>
                  <td className="py-3 px-4">
                    <span
                      className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                      style={{
                        background: group.compliance_status === 'Compliant' ? '#d1fae5' : 
                                   group.compliance_status === 'Warning' ? '#fef3c7' : '#fee2e2',
                        color: group.compliance_status === 'Compliant' ? '#065f46' : 
                               group.compliance_status === 'Warning' ? '#92400e' : '#991b1b'
                      }}
                    >
                      {group.compliance_status}
                    </span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400 text-sm">
                    No tree grower data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 5: BARANGAY COVERAGE
// ═══════════════════════════════════════════════════════════════════════════════
function TabBarangay({ data }: { data: any }) {
  return (
    <div className="space-y-6">
      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Hectares by Barangay */}
        <Card delay="0.1s">
          <SectionHeader
            title="Hectares Reforested by Barangay"
            sub="Total area coverage per barangay"
          />
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.hectares_by_barangay}>
              <defs>
                <linearGradient id="hectareGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="100%" stopColor="#059669" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" vertical={false} />
              <XAxis dataKey="barangay_name" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} angle={-20} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip content={<GreenTooltip />} />
              <Bar dataKey="total_hectares" name="Hectares" fill="url(#hectareGrad)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Programs by Barangay */}
        <Card delay="0.15s">
          <SectionHeader
            title="Programs by Barangay"
            sub="Number of programs per barangay"
          />
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.programs_by_barangay}>
              <defs>
                <linearGradient id="programGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#4f46e5" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" vertical={false} />
              <XAxis dataKey="barangay_name" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} angle={-20} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip content={<GreenTooltip />} />
              <Bar dataKey="program_count" name="Programs" fill="url(#programGrad)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Land Classification */}
      {data.land_classification.length > 0 && (
        <Card delay="0.2s">
          <SectionHeader
            icon={<Shield size={20} />}
            title="Land Classification Distribution"
            sub="Legal compliance of reforestation sites"
          />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {data.land_classification.map((item: any, i: number) => {
              const colors = ["bg-emerald-500", "bg-blue-500", "bg-amber-500", "bg-violet-500"];
              return (
                <div key={i} className={`${colors[i % colors.length]} rounded-xl p-4 text-white`}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider opacity-80 mb-1">{item.classification_name}</p>
                  <p className="dash-title text-[28px] font-extrabold leading-none">{item.count}</p>
                  <p className="text-[10px] opacity-80 mt-1">sites</p>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Barangay Table */}
      <Card delay="0.25s">
        <SectionHeader
          icon={<MapPin size={20} />}
          title="Barangay Coverage Details"
          sub={`${data.barangay_table.length} barangays with reforestation activity`}
        />
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-200">
                {["Barangay", "Total Hectares", "Total Programs", "Active Groups", "Approval Rate"].map((h) => (
                  <th key={h} className="py-3 px-4 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.barangay_table.length > 0 ? data.barangay_table.map((item: any, i: number) => (
                <tr key={i} className="hover:bg-emerald-50/40 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                        <MapPin size={14} className="text-blue-600" />
                      </div>
                      <span className="text-sm font-semibold text-gray-800">{item.barangay_name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-700 font-medium">{item.total_hectares} ha</td>
                  <td className="py-3 px-4 text-sm text-gray-700">{item.total_programs}</td>
                  <td className="py-3 px-4 text-sm text-gray-700">{item.active_groups}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            item.approval_rate >= 80 ? 'bg-emerald-500' : 
                            item.approval_rate >= 60 ? 'bg-amber-400' : 'bg-red-400'
                          }`}
                          style={{ width: `${item.approval_rate}%` }}
                        />
                      </div>
                      <span
                        className="text-xs font-bold"
                        style={{
                          color: item.approval_rate >= 80 ? '#10b981' : 
                                 item.approval_rate >= 60 ? '#f59e0b' : '#ef4444'
                        }}
                      >
                        {item.approval_rate}%
                      </span>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-400 text-sm">
                    No barangay data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}