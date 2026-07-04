import { useEffect, useState } from "react";
import { api } from "@/constant/api.ts";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell,
  AreaChart, Area,
} from "recharts";
import {
  FileText, Download, Search, Calendar, Filter,
  CheckCircle2, XCircle, Clock, AlertTriangle, TrendingUp,
  MapPin, Users, Sprout, Loader2, ExternalLink,
  Leaf, TreePine, Activity, Globe2, Shield,
  Award, Target, BarChart3, TrendingDown, Printer,
} from "lucide-react";
import NotFoundPage from "../../../components/layout/NotFoundPage";

// ─── Types ───────────────────────────────────────────────────────────────────
interface ExecutiveSummary {
  program_overview: {
    total_programs: number;
    active_programs: number;
    completed_programs: number;
    failed_programs: number;
    total_tree_growers: number;
    total_groups: number;
    approval_rate: number;
    completion_rate: number;
  };
  impact_summary: {
    total_seedlings_distributed: number;
    total_survived: number;
    total_dead: number;
    survival_rate: number;
    estimated_carbon_tons: number;
    total_area_hectares: number;
  };
  key_achievements: {
    top_barangay: { barangay_name: string; count: number } | null;
    best_species: { name: string; survival_rate: number; total: number } | null;
    most_active_group: { group_name: string; count: number } | null;
  };
  monthly_trend: { month: string; submitted: number; approved: number; completed: number }[];
  seedlings_trend: { month: string; seedlings: number }[];
}

interface ProgramPerformance {
  lifecycle_stats: { avg_days_to_complete: number; total_programs: number };
  status_breakdown: { status: string; count: number; label: string }[];
  all_programs: any[];
  success_analysis: { by_classification: any[]; failure_by_classification: any[] };
}

interface SpeciesPerformance {
  species_data: any[];
  species_by_survival: any[];
  recommendations: { type: string; message: string }[];
}

interface ComplianceReport {
  overall_stats: {
    total_active_programs: number;
    compliant_count: number;
    warning_count: number;
    non_compliant_count: number;
    overall_compliance_rate: number;
  };
  compliance_data: any[];
  top_performers: any[];
  non_compliant_groups: any[];
}

interface GeographicImpact {
  hectares_by_barangay: any[];
  programs_by_barangay: any[];
  land_classification: { distribution: any[]; compliance_percentage: number };
  ndvi_distribution: { excellent: number; good: number; moderate: number; poor: number };
}

interface AuditTrail {
  head_decisions: any[];
  system_activities: any[];
  activity_summary: any[];
}

// ─── Constants ───────────────────────────────────────────────────────────────
const TABS = [
  { id: "executive", label: "Executive Summary", icon: <FileText size={16} /> },
  { id: "programs", label: "Program Performance", icon: <Activity size={16} /> },
  { id: "species", label: "Species Analysis", icon: <Leaf size={16} /> },
  { id: "compliance", label: "Compliance", icon: <Shield size={16} /> },
  { id: "geographic", label: "Geographic Impact", icon: <Globe2 size={16} /> },
  { id: "audit", label: "Audit Trail", icon: <Shield size={16} /> },
];

const STATUS_COLORS: Record<string, string> = {
  accepted: "#10b981",
  under_monitoring: "#3b82f6",
  completed: "#065f46",
  for_evaluation: "#f59e0b",
  for_head: "#f97316",
  rejected: "#ef4444",
  failed: "#dc2626",
  cancelled: "#991b1b",
};

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

// ─── Reusable Card ───────────────────────────────────────────────────────────
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

// ─── Stat Pill ───────────────────────────────────────────────────────────────
function StatPill({ label, value, color, icon, delay = "0s" }: any) {
  return (
    <div
      className={`${color} rounded-xl p-4 animate-fadeUp relative overflow-hidden`}
      style={{ animationDelay: delay }}
    >
      <div className="absolute top-0 right-0 opacity-10 transform translate-x-2 -translate-y-2">
        {icon}
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-wider opacity-80 mb-1">{label}</p>
      <p className="dash-title text-[26px] font-extrabold leading-none">{value}</p>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function HeadReports() {
  const [isAuthorize, setIsAuthorize] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState("executive");
  const [loading, setLoading] = useState(false);

  const [executiveData, setExecutiveData] = useState<ExecutiveSummary | null>(null);
  const [programData, setProgramData] = useState<ProgramPerformance | null>(null);
  const [speciesData, setSpeciesData] = useState<SpeciesPerformance | null>(null);
  const [complianceData, setComplianceData] = useState<ComplianceReport | null>(null);
  const [geographicData, setGeographicData] = useState<GeographicImpact | null>(null);
  const [auditData, setAuditData] = useState<AuditTrail | null>(null);

  useEffect(() => { checkAuth(); }, []);
  useEffect(() => {
    if (isAuthorize) fetchDataForTab(activeTab);
  }, [activeTab, isAuthorize]);

  const checkAuth = async () => {
    const token = localStorage.getItem("token");
    if (!token) { setIsAuthorize(false); return; }
    try {
      const res = await fetch(api + "api/get_me/", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setIsAuthorize(res.ok && data.user_role === "CityENROHead");
    } catch { setIsAuthorize(false); }
  };

  const fetchDataForTab = async (tab: string) => {
    setLoading(true);
    const token = localStorage.getItem("token");
    const headers = { Authorization: `Bearer ${token}` };
    try {
      const endpoints: Record<string, string> = {
        executive: "get_executive_summary",
        programs: "get_program_performance_report",
        species: "get_species_performance_report",
        compliance: "get_compliance_report",
        geographic: "get_geographic_impact_report",
        audit: "get_audit_trail_report",
      };
      const setters: Record<string, any> = {
        executive: setExecutiveData,
        programs: setProgramData,
        species: setSpeciesData,
        compliance: setComplianceData,
        geographic: setGeographicData,
        audit: setAuditData,
      };
      const currentData = {
        executive: executiveData, programs: programData, species: speciesData,
        compliance: complianceData, geographic: geographicData, audit: auditData,
      }[tab];

      if (!currentData) {
        const res = await fetch(`${api}api/${endpoints[tab]}/`, { headers });
        const data = await res.json();
        setters[tab](data);
      }
    } catch (err) { console.error("Fetch error:", err); }
    finally { setLoading(false); }
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
        {/* ── Header Strip ──────────────────────────────────────────────── */}
        <div
          className="flex items-center justify-between mb-6 bg-[#0F4A2F] rounded-2xl px-6 py-4 shadow-[0_4px_24px_rgba(15,74,47,0.25)] animate-fadeUp"
          style={{ animationDelay: "0s" }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <FileText size={20} className="text-emerald-300" />
            </div>
            <div>
              <h1 className="dash-title text-[22px] font-bold text-white leading-none">
                Reports & Analytics
              </h1>
              <p className="text-[11px] text-emerald-200/80 mt-0.5">
                Strategic reports for City ENRO Head oversight
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-300 text-[11px] font-medium">
              {new Date().toLocaleDateString("en-PH", { weekday: "long", month: "short", day: "numeric", year: "numeric" })}
            </span>
          </div>
        </div>

        {/* ── Tabs ──────────────────────────────────────────────────────── */}
        <div
          className="flex gap-1.5 mb-6 bg-white rounded-xl p-1.5 border border-gray-100 shadow-[0_1px_8px_rgba(0,0,0,0.05)] w-fit animate-fadeUp overflow-x-auto"
          style={{ animationDelay: "0.05s" }}
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-[12px] font-semibold transition-all whitespace-nowrap cursor-pointer
                ${activeTab === tab.id
                  ? "bg-[#0F4A2F] text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* ── Loading ───────────────────────────────────────────────────── */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 animate-fadeUp">
            <Loader2 size={40} className="animate-spin text-[#0F4A2F] mb-4" />
            <p className="text-gray-500 font-medium">Loading report data...</p>
          </div>
        )}

        {/* ── Tab Content ───────────────────────────────────────────────── */}
        {!loading && activeTab === "executive" && executiveData && (
          <ExecutiveSummaryTab data={executiveData} />
        )}
        {!loading && activeTab === "programs" && programData && (
          <ProgramPerformanceTab data={programData} />
        )}
        {!loading && activeTab === "species" && speciesData && (
          <SpeciesPerformanceTab data={speciesData} />
        )}
        {!loading && activeTab === "compliance" && complianceData && (
          <ComplianceTab data={complianceData} />
        )}
        {!loading && activeTab === "geographic" && geographicData && (
          <GeographicImpactTab data={geographicData} />
        )}
        {!loading && activeTab === "audit" && auditData && (
          <AuditTrailTab data={auditData} />
        )}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: EXECUTIVE SUMMARY
// ─────────────────────────────────────────────────────────────────────────────
function ExecutiveSummaryTab({ data }: { data: ExecutiveSummary }) {
  const handleExportPDF = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Executive Summary Report</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Barlow+Condensed:wght@600;700;800&display=swap');
          body { font-family: 'DM Sans', sans-serif; padding: 50px; color: #1f2937; max-width: 900px; margin: 0 auto; }
          .header { border-bottom: 4px solid #0F4A2F; padding-bottom: 20px; margin-bottom: 30px; }
          h1 { font-family: 'Barlow Condensed', sans-serif; color: #0F4A2F; font-size: 32px; margin: 0 0 8px 0; letter-spacing: -0.01em; }
          .subtitle { color: #6b7280; font-size: 13px; margin: 0; }
          .date { color: #9ca3af; font-size: 12px; margin-top: 8px; }
          h2 { font-family: 'Barlow Condensed', sans-serif; color: #0F4A2F; font-size: 20px; margin: 35px 0 15px 0; padding-bottom: 8px; border-bottom: 2px solid #d1fae5; }
          .stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin: 20px 0; }
          .stat-box { background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%); padding: 18px; border-radius: 12px; border-left: 4px solid #10b981; }
          .stat-label { font-size: 10px; color: #059669; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; margin-bottom: 6px; }
          .stat-value { font-family: 'Barlow Condensed', sans-serif; font-size: 28px; font-weight: 700; color: #0F4A2F; line-height: 1; }
          .achievement { background: #fef3c7; padding: 15px 18px; border-radius: 12px; margin: 10px 0; border-left: 4px solid #f59e0b; }
          .achievement strong { color: #92400e; }
          .footer { margin-top: 50px; text-align: center; font-size: 11px; color: #9ca3af; border-top: 2px solid #e5e7eb; padding-top: 20px; }
          .footer strong { color: #0F4A2F; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>EXECUTIVE SUMMARY REPORT</h1>
          <p class="subtitle">PlantScope GIS-Based Site Suitability Assessment System</p>
          <p class="date">Generated: ${new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })} • Ormoc City CENRO</p>
        </div>
        
        <h2>📋 Program Overview</h2>
        <div class="stat-grid">
          <div class="stat-box">
            <div class="stat-label">Total Programs</div>
            <div class="stat-value">${data.program_overview.total_programs}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Active Programs</div>
            <div class="stat-value">${data.program_overview.active_programs}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Completed</div>
            <div class="stat-value">${data.program_overview.completed_programs}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Failed/Rejected</div>
            <div class="stat-value">${data.program_overview.failed_programs}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Approval Rate</div>
            <div class="stat-value">${data.program_overview.approval_rate}%</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Completion Rate</div>
            <div class="stat-value">${data.program_overview.completion_rate}%</div>
          </div>
        </div>

        <h2>🌳 Environmental Impact</h2>
        <div class="stat-grid">
          <div class="stat-box">
            <div class="stat-label">Seedlings Distributed</div>
            <div class="stat-value">${data.impact_summary.total_seedlings_distributed.toLocaleString()}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Trees Survived</div>
            <div class="stat-value">${data.impact_summary.total_survived.toLocaleString()}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Survival Rate</div>
            <div class="stat-value">${data.impact_summary.survival_rate}%</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Est. Carbon Sequestration</div>
            <div class="stat-value">${data.impact_summary.estimated_carbon_tons} tons</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Total Area Reforested</div>
            <div class="stat-value">${data.impact_summary.total_area_hectares} ha</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Tree Grower Groups</div>
            <div class="stat-value">${data.program_overview.total_groups}</div>
          </div>
        </div>

        <h2>🏆 Key Achievements</h2>
        ${data.key_achievements.top_barangay ? `
          <div class="achievement">
            <strong>🏘️ Top Performing Barangay:</strong> ${data.key_achievements.top_barangay.barangay_name} 
            (${data.key_achievements.top_barangay.count} programs)
          </div>
        ` : ''}
        ${data.key_achievements.best_species ? `
          <div class="achievement">
            <strong>🌱 Best Performing Species:</strong> ${data.key_achievements.best_species.name} 
            (${data.key_achievements.best_species.survival_rate}% survival rate)
          </div>
        ` : ''}
        ${data.key_achievements.most_active_group ? `
          <div class="achievement">
            <strong>👥 Most Active Group:</strong> ${data.key_achievements.most_active_group.group_name} 
            (${data.key_achievements.most_active_group.count} programs)
          </div>
        ` : ''}

        <div class="footer">
          <strong>PlantScope MCDA System</strong> — Confidential Report<br>
          Ormoc City CENRO • For Official Use Only
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  return (
    <div className="space-y-6">
      {/* ── Top Row: Export + Program Overview ─────────────────────────── */}
      <div className="flex justify-end animate-fadeUp" style={{ animationDelay: "0.1s" }}>
        <button
          onClick={handleExportPDF}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0F4A2F] text-white text-sm font-semibold hover:bg-[#1a6b44] transition-colors shadow-sm"
        >
          <Printer size={16} /> Export as PDF
        </button>
      </div>

      {/* ── Program Overview ──────────────────────────────────────────── */}
      <Card delay="0.15s">
        <SectionHeader
          icon={<FileText size={20} />}
          title="Program Overview"
          sub="Comprehensive statistics across all tree planting programs"
          badge={`${data.program_overview.total_programs} total`}
        />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatPill label="Total Programs" value={data.program_overview.total_programs} color="bg-blue-50 text-blue-700" icon={<FileText size={40} />} delay="0.2s" />
          <StatPill label="Active" value={data.program_overview.active_programs} color="bg-emerald-50 text-emerald-700" icon={<Activity size={40} />} delay="0.25s" />
          <StatPill label="Completed" value={data.program_overview.completed_programs} color="bg-green-50 text-green-700" icon={<CheckCircle2 size={40} />} delay="0.3s" />
          <StatPill label="Failed/Rejected" value={data.program_overview.failed_programs} color="bg-red-50 text-red-700" icon={<XCircle size={40} />} delay="0.35s" />
          <StatPill label="Approval Rate" value={`${data.program_overview.approval_rate}%`} color="bg-teal-50 text-teal-700" icon={<TrendingUp size={40} />} delay="0.4s" />
          <StatPill label="Completion Rate" value={`${data.program_overview.completion_rate}%`} color="bg-indigo-50 text-indigo-700" icon={<Target size={40} />} delay="0.45s" />
        </div>
      </Card>

      {/* ── Environmental Impact ──────────────────────────────────────── */}
      <Card delay="0.5s">
        <SectionHeader
          icon={<TreePine size={20} />}
          title="Environmental Impact"
          sub="Quantified ecological benefits of reforestation efforts"
        />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "Seedlings Distributed", value: data.impact_summary.total_seedlings_distributed.toLocaleString(), icon: <Sprout size={18} /> },
            { label: "Trees Survived", value: data.impact_summary.total_survived.toLocaleString(), icon: <CheckCircle2 size={18} /> },
            { label: "Survival Rate", value: `${data.impact_summary.survival_rate}%`, icon: <TrendingUp size={18} /> },
            { label: "Carbon Sequestration", value: `${data.impact_summary.estimated_carbon_tons}t`, icon: <Leaf size={18} /> },
            { label: "Area Reforested", value: `${data.impact_summary.total_area_hectares} ha`, icon: <MapPin size={18} /> },
            { label: "Tree Growers", value: data.program_overview.total_tree_growers, icon: <Users size={18} /> },
          ].map((stat, i) => (
            <div
              key={i}
              className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-4 border border-emerald-100 animate-fadeUp relative overflow-hidden"
              style={{ animationDelay: `${0.55 + i * 0.05}s` }}
            >
              <div className="flex items-center gap-2 text-emerald-700 mb-2">
                {stat.icon}
                <p className="text-[10px] font-semibold uppercase tracking-wider">{stat.label}</p>
              </div>
              <p className="dash-title text-[22px] font-extrabold text-gray-800 leading-none">{stat.value}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* ── Key Achievements ──────────────────────────────────────────── */}
      <Card delay="0.85s">
        <SectionHeader
          icon={<Award size={20} />}
          title="Key Achievements"
          sub="Top performers and milestones"
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {data.key_achievements.top_barangay ? (
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-5 relative overflow-hidden">
              <div className="absolute top-0 right-0 opacity-10 transform translate-x-4 -translate-y-4">
                <MapPin size={80} className="text-amber-600" />
              </div>
              <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-2">🏘️ Top Barangay</p>
              <p className="dash-title text-[20px] font-extrabold text-gray-800 leading-tight">{data.key_achievements.top_barangay.barangay_name}</p>
              <p className="text-sm text-gray-600 mt-2">{data.key_achievements.top_barangay.count} programs</p>
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 flex items-center justify-center text-gray-400 text-sm">
              No data yet
            </div>
          )}
          {data.key_achievements.best_species ? (
            <div className="bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-200 rounded-xl p-5 relative overflow-hidden">
              <div className="absolute top-0 right-0 opacity-10 transform translate-x-4 -translate-y-4">
                <Leaf size={80} className="text-emerald-600" />
              </div>
              <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-2">🌱 Best Species</p>
              <p className="dash-title text-[20px] font-extrabold text-gray-800 leading-tight">{data.key_achievements.best_species.name}</p>
              <p className="text-sm text-gray-600 mt-2">{data.key_achievements.best_species.survival_rate}% survival</p>
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 flex items-center justify-center text-gray-400 text-sm">
              No data yet
            </div>
          )}
          {data.key_achievements.most_active_group ? (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5 relative overflow-hidden">
              <div className="absolute top-0 right-0 opacity-10 transform translate-x-4 -translate-y-4">
                <Users size={80} className="text-blue-600" />
              </div>
              <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wider mb-2">👥 Most Active Group</p>
              <p className="dash-title text-[20px] font-extrabold text-gray-800 leading-tight">{data.key_achievements.most_active_group.group_name}</p>
              <p className="text-sm text-gray-600 mt-2">{data.key_achievements.most_active_group.count} programs</p>
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 flex items-center justify-center text-gray-400 text-sm">
              No data yet
            </div>
          )}
        </div>
      </Card>

      {/* ── Charts ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card delay="1.1s">
          <SectionHeader
            title="Monthly Program Trend"
            sub="This year's program activity"
            badge="Live Data"
          />
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={data.monthly_trend}>
              <defs>
                <linearGradient id="colorSubmitted" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorApproved" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip content={<GreenTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="submitted" name="Submitted" stroke="#6366f1" strokeWidth={2} fill="url(#colorSubmitted)" />
              <Area type="monotone" dataKey="approved" name="Approved" stroke="#10b981" strokeWidth={2.5} fill="url(#colorApproved)" />
              <Area type="monotone" dataKey="completed" name="Completed" stroke="#065f46" strokeWidth={2} fill="transparent" strokeDasharray="5 5" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card delay="1.15s">
          <SectionHeader
            title="Seedlings Distribution"
            sub="Monthly seedling distribution this year"
          />
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.seedlings_trend}>
              <defs>
                <linearGradient id="seedlingGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="100%" stopColor="#059669" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip content={<GreenTooltip />} />
              <Bar dataKey="seedlings" name="Seedlings" fill="url(#seedlingGrad)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: PROGRAM PERFORMANCE
// ─────────────────────────────────────────────────────────────────────────────
function ProgramPerformanceTab({ data }: { data: ProgramPerformance }) {
  return (
    <div className="space-y-6">
      {/* Lifecycle Stats */}
      <Card delay="0.1s">
        <SectionHeader
          icon={<Activity size={20} />}
          title="Program Lifecycle Statistics"
          sub="Average processing time and total program count"
        />
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-100">
            <div className="flex items-center gap-2 text-blue-700 mb-2">
              <Clock size={16} />
              <p className="text-[10px] font-semibold uppercase tracking-wider">Avg Days to Complete</p>
            </div>
            <p className="dash-title text-[36px] font-extrabold text-blue-900 leading-none">
              {data.lifecycle_stats.avg_days_to_complete}
            </p>
            <p className="text-xs text-blue-600 mt-1">days average</p>
          </div>
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-5 border border-emerald-100">
            <div className="flex items-center gap-2 text-emerald-700 mb-2">
              <FileText size={16} />
              <p className="text-[10px] font-semibold uppercase tracking-wider">Total Programs</p>
            </div>
            <p className="dash-title text-[36px] font-extrabold text-emerald-900 leading-none">
              {data.lifecycle_stats.total_programs}
            </p>
            <p className="text-xs text-emerald-600 mt-1">all time</p>
          </div>
        </div>
      </Card>

      {/* Status Breakdown */}
      {data.status_breakdown.length > 0 && (
        <Card delay="0.2s">
          <SectionHeader
            title="Status Breakdown"
            sub="Distribution of programs by current status"
          />
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {data.status_breakdown.map((item, i) => (
              <div
                key={item.status}
                className="rounded-xl p-4 border animate-fadeUp"
                style={{
                  background: `${STATUS_COLORS[item.status]}10`,
                  borderColor: `${STATUS_COLORS[item.status]}30`,
                  animationDelay: `${0.25 + i * 0.05}s`,
                }}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: STATUS_COLORS[item.status] }}>
                  {item.label}
                </p>
                <p className="dash-title text-[28px] font-extrabold leading-none" style={{ color: STATUS_COLORS[item.status] }}>
                  {item.count}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* All Programs Table */}
      <Card delay="0.5s">
        <SectionHeader
          icon={<BarChart3 size={20} />}
          title="All Programs"
          sub={`${data.all_programs.length} programs total`}
          badge="Complete List"
        />
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-200">
                {["Ref", "Group", "Site", "Barangay", "Status", "Area", "Survival"].map((h) => (
                  <th key={h} className="py-3 px-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.all_programs.length > 0 ? data.all_programs.map((prog) => (
                <tr key={prog.application_id} className="hover:bg-emerald-50/40 transition-colors">
                  <td className="py-3 px-3 text-[12px] font-bold text-[#0F4A2F]">{prog.ref}</td>
                  <td className="py-3 px-3 text-[12px] text-gray-700 font-medium">{prog.group_name}</td>
                  <td className="py-3 px-3 text-[12px] text-gray-700">{prog.site_name}</td>
                  <td className="py-3 px-3 text-[11px] text-gray-500">{prog.barangay}</td>
                  <td className="py-3 px-3">
                    <span
                      className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                      style={{
                        background: `${STATUS_COLORS[prog.status]}20`,
                        color: STATUS_COLORS[prog.status],
                      }}
                    >
                      {prog.status_label}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-[12px] text-gray-700 font-medium">{prog.area_hectares} ha</td>
                  <td className="py-3 px-3">
                    <span
                      className="text-[12px] font-bold"
                      style={{
                        color: prog.survival_rate >= 80 ? '#10b981' : prog.survival_rate >= 60 ? '#f59e0b' : '#ef4444'
                      }}
                    >
                      {prog.survival_rate}%
                    </span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400 text-sm">
                    No programs found
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

// ─────────────────────────────────────────────────────────────────────────────
// TAB: SPECIES PERFORMANCE
// ─────────────────────────────────────────────────────────────────────────────
function SpeciesPerformanceTab({ data }: { data: SpeciesPerformance }) {
  return (
    <div className="space-y-6">
      {/* Recommendations */}
      {data.recommendations.length > 0 && (
        <Card delay="0.1s">
          <SectionHeader
            icon={<AlertTriangle size={20} />}
            title="Smart Recommendations"
            sub="Auto-generated insights based on species performance data"
            badge={`${data.recommendations.length} insights`}
          />
          <div className="space-y-3">
            {data.recommendations.map((rec, i) => (
              <div
                key={i}
                className={`p-4 rounded-xl border-l-4 animate-fadeUp flex items-start gap-3 ${
                  rec.type === 'success'
                    ? 'bg-gradient-to-r from-emerald-50 to-transparent border-emerald-500'
                    : 'bg-gradient-to-r from-amber-50 to-transparent border-amber-500'
                }`}
                style={{ animationDelay: `${0.15 + i * 0.05}s` }}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  rec.type === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {rec.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                </div>
                <p className="text-sm text-gray-800 leading-relaxed">{rec.message}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Species Chart */}
      {data.species_data.length > 0 && (
        <Card delay="0.3s">
          <SectionHeader
            title="Species Performance Comparison"
            sub="Requested vs survived by species"
          />
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.species_data} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" vertical={false} />
              <XAxis dataKey="species_name" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip content={<GreenTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="total_requested" name="Requested" fill="#d1fae5" radius={[5, 5, 0, 0]} />
              <Bar dataKey="total_survived" name="Survived" fill="#10b981" radius={[5, 5, 0, 0]} />
              <Bar dataKey="total_dead" name="Dead" fill="#fca5a5" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Species Table */}
      <Card delay="0.5s">
        <SectionHeader
          icon={<Leaf size={20} />}
          title="Species Performance Details"
          sub={`${data.species_data.length} species tracked`}
        />
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-200">
                {["Species", "Requested", "Survived", "Dead", "Survival Rate"].map((h) => (
                  <th key={h} className="py-3 px-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.species_data.map((sp, i) => (
                <tr key={i} className="hover:bg-emerald-50/40 transition-colors">
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                        <Leaf size={14} className="text-emerald-600" />
                      </div>
                      <span className="text-sm font-semibold text-gray-800">{sp.species_name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-sm text-gray-700">{sp.total_requested.toLocaleString()}</td>
                  <td className="py-3 px-3 text-sm text-emerald-600 font-semibold">{sp.total_survived.toLocaleString()}</td>
                  <td className="py-3 px-3 text-sm text-red-600 font-semibold">{sp.total_dead.toLocaleString()}</td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            sp.survival_rate >= 80 ? 'bg-emerald-500' : sp.survival_rate >= 60 ? 'bg-amber-400' : 'bg-red-400'
                          }`}
                          style={{ width: `${sp.survival_rate}%` }}
                        />
                      </div>
                      <span
                        className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                        style={{
                          background: sp.survival_rate >= 80 ? '#d1fae5' : sp.survival_rate >= 60 ? '#fef3c7' : '#fee2e2',
                          color: sp.survival_rate >= 80 ? '#065f46' : sp.survival_rate >= 60 ? '#92400e' : '#991b1b'
                        }}
                      >
                        {sp.survival_rate}%
                      </span>
                    </div>
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

// ─────────────────────────────────────────────────────────────────────────────
// TAB: COMPLIANCE
// ─────────────────────────────────────────────────────────────────────────────
function ComplianceTab({ data }: { data: ComplianceReport }) {
  return (
    <div className="space-y-6">
      {/* Overall Stats */}
      <Card delay="0.1s">
        <SectionHeader
          icon={<Shield size={20} />}
          title="Overall Compliance"
          sub="Tree grower reporting compliance across active programs"
          badge={`${data.overall_stats.overall_compliance_rate}% rate`}
        />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatPill label="Active Programs" value={data.overall_stats.total_active_programs} color="bg-blue-50 text-blue-700" icon={<Activity size={40} />} delay="0.15s" />
          <StatPill label="Compliant" value={data.overall_stats.compliant_count} color="bg-emerald-50 text-emerald-700" icon={<CheckCircle2 size={40} />} delay="0.2s" />
          <StatPill label="Warning" value={data.overall_stats.warning_count} color="bg-amber-50 text-amber-700" icon={<AlertTriangle size={40} />} delay="0.25s" />
          <StatPill label="Non-Compliant" value={data.overall_stats.non_compliant_count} color="bg-red-50 text-red-700" icon={<XCircle size={40} />} delay="0.3s" />
          <StatPill label="Compliance Rate" value={`${data.overall_stats.overall_compliance_rate}%`} color="bg-indigo-50 text-indigo-700" icon={<Target size={40} />} delay="0.35s" />
        </div>
      </Card>

      {/* Top Performers */}
      {data.top_performers.length > 0 && (
        <Card delay="0.4s">
          <SectionHeader
            icon={<Award size={20} />}
            title="Top Performers"
            sub="Groups with highest survival rates"
            badge="🏆 Excellence"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.top_performers.slice(0, 6).map((perf, i) => (
              <div
                key={i}
                className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-4 border border-emerald-100 animate-fadeUp flex items-center gap-3"
                style={{ animationDelay: `${0.45 + i * 0.05}s` }}
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white font-bold shrink-0">
                  #{i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-800 truncate">{perf.group_name}</p>
                  <p className="text-xs text-gray-500 truncate">{perf.site_name}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="dash-title text-xl font-extrabold text-emerald-700">{perf.survival_rate}%</p>
                  <p className="text-[10px] text-emerald-600">survival</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Compliance Table */}
      <Card delay="0.7s">
        <SectionHeader
          title="Compliance Details"
          sub={`${data.compliance_data.length} active programs tracked`}
        />
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-200">
                {["Group", "Site", "Last Report", "Survival", "Status"].map((h) => (
                  <th key={h} className="py-3 px-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.compliance_data.length > 0 ? data.compliance_data.map((item, i) => (
                <tr
                  key={i}
                  className={`transition-colors ${
                    item.compliance_status === 'Non-Compliant' ? 'bg-red-50/30' :
                    item.compliance_status === 'Warning' ? 'bg-amber-50/30' : 'hover:bg-emerald-50/40'
                  }`}
                >
                  <td className="py-3 px-3 text-sm font-semibold text-gray-800">{item.group_name}</td>
                  <td className="py-3 px-3 text-sm text-gray-700">{item.site_name}</td>
                  <td className="py-3 px-3 text-sm text-gray-700">
                    {item.days_since_last_report !== null ? (
                      <span className="flex items-center gap-1.5">
                        <Clock size={12} className="text-gray-400" />
                        {item.days_since_last_report} days ago
                      </span>
                    ) : (
                      <span className="text-red-500 italic text-xs">Never reported</span>
                    )}
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className="text-sm font-bold"
                      style={{
                        color: item.survival_rate >= 80 ? '#10b981' : item.survival_rate >= 60 ? '#f59e0b' : '#ef4444'
                      }}
                    >
                      {item.survival_rate}%
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                      style={{
                        background: item.compliance_status === 'Compliant' ? '#d1fae5' : item.compliance_status === 'Warning' ? '#fef3c7' : '#fee2e2',
                        color: item.compliance_status === 'Compliant' ? '#065f46' : item.compliance_status === 'Warning' ? '#92400e' : '#991b1b'
                      }}
                    >
                      {item.compliance_status}
                    </span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-400 text-sm">
                    No compliance data available
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

// ─────────────────────────────────────────────────────────────────────────────
// TAB: GEOGRAPHIC IMPACT
// ─────────────────────────────────────────────────────────────────────────────
function GeographicImpactTab({ data }: { data: GeographicImpact }) {
  return (
    <div className="space-y-6">
      {/* Land Classification */}
      <Card delay="0.1s">
        <SectionHeader
          icon={<Globe2 size={20} />}
          title="Land Classification Compliance"
          sub="Legal compliance of reforestation sites"
          badge={`${data.land_classification.compliance_percentage}% compliant`}
        />
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-2 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-6 border border-emerald-100 flex flex-col items-center justify-center">
            <p className="text-xs text-emerald-700 font-semibold uppercase tracking-wider mb-2">Compliance Rate</p>
            <p className="dash-title text-[56px] font-extrabold text-emerald-900 leading-none">
              {data.land_classification.compliance_percentage}%
            </p>
            <p className="text-xs text-emerald-600 mt-2">of sites on legal land</p>
          </div>
          <div className="md:col-span-3 grid grid-cols-2 gap-3">
            <div className="bg-green-50 rounded-xl p-4 text-center border border-green-100">
              <p className="text-[10px] text-green-700 font-semibold uppercase tracking-wider mb-1">🌿 Excellent NDVI</p>
              <p className="dash-title text-[28px] font-extrabold text-green-900">{data.ndvi_distribution.excellent}</p>
              <p className="text-[10px] text-green-600">sites</p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-4 text-center border border-emerald-100">
              <p className="text-[10px] text-emerald-700 font-semibold uppercase tracking-wider mb-1">🌱 Good NDVI</p>
              <p className="dash-title text-[28px] font-extrabold text-emerald-900">{data.ndvi_distribution.good}</p>
              <p className="text-[10px] text-emerald-600">sites</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-4 text-center border border-amber-100">
              <p className="text-[10px] text-amber-700 font-semibold uppercase tracking-wider mb-1">🍂 Moderate NDVI</p>
              <p className="dash-title text-[28px] font-extrabold text-amber-900">{data.ndvi_distribution.moderate}</p>
              <p className="text-[10px] text-amber-600">sites</p>
            </div>
            <div className="bg-red-50 rounded-xl p-4 text-center border border-red-100">
              <p className="text-[10px] text-red-700 font-semibold uppercase tracking-wider mb-1">🥀 Poor NDVI</p>
              <p className="dash-title text-[28px] font-extrabold text-red-900">{data.ndvi_distribution.poor}</p>
              <p className="text-[10px] text-red-600">sites</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card delay="0.3s">
          <SectionHeader
            title="Hectares Reforested by Barangay"
            sub="Total area coverage per barangay"
          />
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.hectares_by_barangay}>
              <defs>
                <linearGradient id="hectareGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="100%" stopColor="#059669" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" vertical={false} />
              <XAxis dataKey="barangay_name" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip content={<GreenTooltip />} />
              <Bar dataKey="total_hectares" name="Hectares" fill="url(#hectareGrad)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card delay="0.35s">
          <SectionHeader
            title="Programs by Barangay"
            sub="Number of programs per barangay"
          />
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.programs_by_barangay}>
              <defs>
                <linearGradient id="programGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#4f46e5" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" vertical={false} />
              <XAxis dataKey="barangay_name" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip content={<GreenTooltip />} />
              <Bar dataKey="program_count" name="Programs" fill="url(#programGrad)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: AUDIT TRAIL
// ─────────────────────────────────────────────────────────────────────────────
function AuditTrailTab({ data }: { data: AuditTrail }) {
  return (
    <div className="space-y-6">
      {/* Activity Summary */}
      <Card delay="0.1s">
        <SectionHeader
          icon={<BarChart3 size={20} />}
          title="Activity Summary"
          sub="Breakdown of all system actions by type"
        />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {data.activity_summary.map((item, i) => (
            <div
              key={i}
              className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl p-4 border border-gray-100 animate-fadeUp"
              style={{ animationDelay: `${0.15 + i * 0.05}s` }}
            >
              <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider mb-1">{item.action_label}</p>
              <p className="dash-title text-[28px] font-extrabold text-gray-800 leading-none">{item.count}</p>
              <p className="text-[10px] text-gray-400 mt-1">actions</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Head Decisions */}
      <Card delay="0.4s">
        <SectionHeader
          icon={<Shield size={20} />}
          title="Your Decisions"
          sub="Last 50 approval/rejection decisions"
          badge={`${data.head_decisions.length} decisions`}
        />
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-200">
                {["Application", "Decision", "Reason", "Date"].map((h) => (
                  <th key={h} className="py-3 px-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.head_decisions.length > 0 ? data.head_decisions.map((decision) => (
                <tr key={decision.reason_id} className="hover:bg-emerald-50/40 transition-colors">
                  <td className="py-3 px-3">
                    <p className="text-sm font-bold text-[#0F4A2F]">{decision.application_ref}</p>
                    <p className="text-xs text-gray-500 truncate max-w-[200px]">{decision.application_title}</p>
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                      style={{
                        background: decision.decision === 'accepted' ? '#d1fae5' :
                                   decision.decision === 'rejected' ? '#fee2e2' : '#f3f4f6',
                        color: decision.decision === 'accepted' ? '#065f46' :
                               decision.decision === 'rejected' ? '#991b1b' : '#374151'
                      }}
                    >
                      {decision.decision_label}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-sm text-gray-700 max-w-xs truncate">
                    {decision.reason_text}
                  </td>
                  <td className="py-3 px-3 text-xs text-gray-500 font-mono">{decision.decided_at}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-gray-400 text-sm">
                    No decisions recorded yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* System Activities */}
      <Card delay="0.7s">
        <SectionHeader
          icon={<Activity size={20} />}
          title="System Activity Log"
          sub="Last 100 system-wide activities"
          badge={`${data.system_activities.length} activities`}
        />
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-200">
                {["Timestamp", "User", "Role", "Action", "Application", "Details"].map((h) => (
                  <th key={h} className="py-3 px-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.system_activities.length > 0 ? data.system_activities.map((activity) => (
                <tr key={activity.reason_id} className="hover:bg-emerald-50/40 transition-colors">
                  <td className="py-3 px-3 text-[11px] text-gray-500 font-mono">{activity.timestamp}</td>
                  <td className="py-3 px-3 text-sm font-semibold text-gray-800">{activity.user_name}</td>
                  <td className="py-3 px-3">
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                      {activity.user_role}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-sm text-gray-700">{activity.action_label}</td>
                  <td className="py-3 px-3 text-sm font-bold text-[#0F4A2F]">{activity.application_ref}</td>
                  <td className="py-3 px-3 text-xs text-gray-600 max-w-xs truncate">{activity.reason_text}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400 text-sm">
                    No activities recorded yet
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