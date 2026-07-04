import { useEffect, useState } from "react";
import {
  ChevronRight,
  ChevronLeft,
  Download,
  FileText,
  Search,
  Leaf,
  Users,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  Lock,
  MapPin,
  TrendingUp,
  Activity,
  Loader2,
  ExternalLink,
  Trash2,
  TreePine,
  BarChart3,
  PieChart as PieChartIcon,
} from "lucide-react";
import PlantScopeAlert from "../../../components/alert/PlantScopeAlert";
import { useNavigate } from "react-router-dom";
import { api } from "@/constant/api.ts";

// ─── Types ──────────────────────────────────────────────────────────────────

interface ReportStats {
  total_groups: number;
  completed_programs: number;
  failed_programs: number;
  ongoing_programs: number;
  total_seedlings_requested: number;
  total_seedlings_survived: number;
  total_seedlings_dead: number;
  total_area_completed: number;
}

interface MonthlyTrend {
  month: string;
  completed: number;
  failed: number;
}

interface HistoryApplication {
  application_id: number;
  title: string;
  status: string;
  classification: string;
  total_treegrowers_will_participate: number;
  created_at: string;
  group_name: string;
  group_profile: string | null;
  site_name: string | null;
  site_status: string | null;
  barangay: string | null;
  site_area: number;
}

interface HistoryFilter {
  search: string;
  status: string;
  date_from: string;
  date_to: string;
  page: number;
  entries: number;
  total_page: number;
  total: number;
}

interface SeedlingAnalytics {
  total_requested: number;
  total_survived: number;
  total_dead: number;
  species_breakdown: {
    species_id: number;
    species_name: string;
    requested: number;
    survived: number;
    dead: number;
    survival_rate: number;
  }[];
}

interface GeographicAnalytics {
  kpis: {
    total_areas: number;
    total_sites: number;
    total_hectares: number;
    pending_verifications: number;
  };
  hectares_by_barangay: {
    barangay_name: string;
    total_hectares: number;
  }[];
  land_classification_distribution: {
    classification_name: string;
    count: number;
  }[];
}

interface MonitoringCompliance {
  kpis: {
    active_programs: number;
    total_reports: number;
    compliance_rate: number;
  };
  monthly_submissions: {
    month: string;
    reports: number;
  }[];
  compliance_tracker: {
    group_name: string;
    site_name: string;
    last_report_date: string | null;
    days_since_last_report: number | null;
    survival_rate: number;
  }[];
}

// ─── Helper Components ──────────────────────────────────────────────────────

const StatusBadge = ({ status }: { status: string }) => {
  let config = { bg: "bg-gray-100", text: "text-gray-700", label: status };
  if (status === "completed")
    config = { bg: "bg-green-100", text: "text-green-700", label: "Completed" };
  if (status === "failed" || status === "rejected" || status === "cancelled")
    config = {
      bg: "bg-red-100",
      text: "text-red-700",
      label: status.charAt(0).toUpperCase() + status.slice(1),
    };
  if (status === "accepted" || status === "under_monitoring")
    config = { bg: "bg-blue-100", text: "text-blue-700", label: "Ongoing" };
  if (
    status === "pending" ||
    status === "for_evaluation" ||
    status === "for_head"
  )
    config = { bg: "bg-amber-100", text: "text-amber-700", label: "Pending" };

  return (
    <span
      className={`px-2.5 py-1 rounded-full text-xs font-semibold ${config.bg} ${config.text}`}
    >
      {config.label}
    </span>
  );
};

const LineChart = ({ data }: { data: MonthlyTrend[] }) => {
  if (data.length === 0)
    return (
      <div className="w-full h-56 flex items-center justify-center text-gray-400 text-sm">
        No trend data available.
      </div>
    );
  const maxVal = Math.max(
    ...data.map((d) => Math.max(d.completed, d.failed)),
    10,
  );
  const width = 600,
    height = 220,
    paddingX = 40,
    paddingY = 20;
  const chartWidth = width - 2 * paddingX,
    chartHeight = height - 2 * paddingY;
  const getX = (i: number) => paddingX + (i / (data.length - 1)) * chartWidth;
  const getY = (val: number) =>
    height - paddingY - (val / maxVal) * chartHeight;
  const completedPath = data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${getX(i)} ${getY(d.completed)}`)
    .join(" ");
  const failedPath = data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${getX(i)} ${getY(d.failed)}`)
    .join(" ");
  const completedArea = `${completedPath} L ${getX(data.length - 1)} ${height - paddingY} L ${getX(0)} ${height - paddingY} Z`;

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-56">
        <defs>
          <linearGradient id="greenGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#16a34a" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#16a34a" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3, 4].map((i) => (
          <line
            key={i}
            x1={paddingX}
            y1={paddingY + i * (chartHeight / 4)}
            x2={width - paddingX}
            y2={paddingY + i * (chartHeight / 4)}
            stroke="#f3f4f6"
            strokeWidth="1"
          />
        ))}
        {[0, 1, 2, 3, 4].map((i) => (
          <text
            key={`y-${i}`}
            x={paddingX - 10}
            y={paddingY + i * (chartHeight / 4) + 4}
            textAnchor="end"
            className="text-[10px] fill-gray-400"
          >
            {Math.round(maxVal - i * (maxVal / 4))}
          </text>
        ))}
        <path d={completedArea} fill="url(#greenGradient)" />
        <path d={completedPath} fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" />
        <path d={failedPath} fill="none" stroke="#dc2626" strokeWidth="3" strokeLinecap="round" strokeDasharray="6 4" />
        {data.map((d, i) => (
          <g key={i}>
            <circle cx={getX(i)} cy={getY(d.completed)} r="5" fill="#fff" stroke="#16a34a" strokeWidth="2" />
            <circle cx={getX(i)} cy={getY(d.failed)} r="5" fill="#fff" stroke="#dc2626" strokeWidth="2" />
            <text x={getX(i)} y={height - 5} textAnchor="middle" className="text-[11px] fill-gray-500 font-medium">
              {d.month}
            </text>
          </g>
        ))}
      </svg>
      <div className="flex items-center justify-center gap-6 mt-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-600"></div>
          <span className="text-xs text-gray-600 font-medium">Completed</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-600 ring-4 ring-red-100"></div>
          <span className="text-xs text-gray-600 font-medium">Failed/Rejected</span>
        </div>
      </div>
    </div>
  );
};

const DonutChart = ({ survived, dead }: { survived: number; dead: number }) => {
  const total = survived + dead || 1;
  const pct = (survived / total) * 100;
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <div className="relative w-44 h-44">
        <svg width="176" height="176" viewBox="0 0 100 100" className="transform -rotate-90 w-full h-full">
          <circle cx="50" cy="50" r="45" fill="transparent" stroke="#fee2e2" strokeWidth="8" />
          <circle cx="50" cy="50" r="45" fill="transparent" stroke="#16a34a" strokeWidth="8" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-1000 ease-out" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-gray-800">
            {survived + dead > 0 ? pct.toFixed(1) : "0.0"}%
          </span>
          <span className="text-xs text-gray-500 font-medium">Survival Rate</span>
        </div>
      </div>
      <div className="flex gap-6 mt-6">
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-2.5 h-2.5 rounded-full bg-green-600"></div>
            <span className="text-xs text-gray-500 font-medium">Survived</span>
          </div>
          <span className="text-lg font-bold text-gray-800">{survived.toLocaleString()}</span>
        </div>
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-2.5 h-2.5 rounded-full bg-red-200"></div>
            <span className="text-xs text-gray-500 font-medium">Dead</span>
          </div>
          <span className="text-lg font-bold text-gray-800">{dead.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
};

const HorizontalBarChart = ({ data }: { data: { name: string; value: number }[] }) => {
  if (data.length === 0) {
    return (
      <div className="w-full h-64 flex items-center justify-center text-gray-400 text-sm">
        No data available.
      </div>
    );
  }

  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="space-y-3">
      {data.map((item, index) => (
        <div key={index} className="flex items-center gap-3">
          <div className="w-32 text-sm text-gray-700 font-medium truncate" title={item.name}>
            {item.name}
          </div>
          <div className="flex-1 bg-gray-100 rounded-full h-8 relative overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-green-600 rounded-full transition-all duration-500 flex items-center justify-end pr-3"
              style={{ width: `${(item.value / maxValue) * 100}%` }}
            >
              <span className="text-white text-xs font-bold">{item.value.toLocaleString()}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

const VerticalBarChart = ({ data }: { data: { name: string; value: number }[] }) => {
  if (data.length === 0) {
    return (
      <div className="w-full h-64 flex items-center justify-center text-gray-400 text-sm">
        No data available.
      </div>
    );
  }

  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const width = 600;
  const height = 250;
  const paddingX = 50;
  const paddingY = 30;
  const chartWidth = width - 2 * paddingX;
  const chartHeight = height - 2 * paddingY;
  const barWidth = chartWidth / data.length - 10;

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-64">
        {[0, 1, 2, 3, 4].map((i) => (
          <line
            key={i}
            x1={paddingX}
            y1={paddingY + i * (chartHeight / 4)}
            x2={width - paddingX}
            y2={paddingY + i * (chartHeight / 4)}
            stroke="#f3f4f6"
            strokeWidth="1"
          />
        ))}
        {data.map((item, i) => {
          const barHeight = (item.value / maxValue) * chartHeight;
          const x = paddingX + i * (chartWidth / data.length) + 5;
          const y = height - paddingY - barHeight;

          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                fill="url(#barGradient)"
                rx="4"
              />
              <text
                x={x + barWidth / 2}
                y={y - 5}
                textAnchor="middle"
                className="text-[10px] fill-gray-600 font-semibold"
              >
                {item.value.toFixed(1)}
              </text>
              <text
                x={x + barWidth / 2}
                y={height - 10}
                textAnchor="middle"
                className="text-[10px] fill-gray-500"
              >
                {item.name.length > 10 ? item.name.substring(0, 10) + "..." : item.name}
              </text>
            </g>
          );
        })}
        <defs>
          <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
};

// ─── Main Component ─────────────────────────────────────────────────────────

export default function Reports() {
  const [activeTab, setActiveTab] = useState<'program' | 'seedling' | 'geographic' | 'monitoring'>('program');
  
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrend[]>([]);
  const [loading, setLoading] = useState(true);

  const [historyData, setHistoryData] = useState<HistoryApplication[]>([]);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>({
    search: "",
    status: "All",
    date_from: "",
    date_to: "",
    page: 1,
    entries: 10,
    total_page: 1,
    total: 0,
  });
  const [historyLoading, setHistoryLoading] = useState(false);

  const [seedlingData, setSeedlingData] = useState<SeedlingAnalytics | null>(null);
  const [seedlingLoading, setSeedlingLoading] = useState(false);

  const [geographicData, setGeographicData] = useState<GeographicAnalytics | null>(null);
  const [geographicLoading, setGeographicLoading] = useState(false);

  const [monitoringData, setMonitoringData] = useState<MonitoringCompliance | null>(null);
  const [monitoringLoading, setMonitoringLoading] = useState(false);

  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    appId: number | null;
    appTitle: string;
  }>({ open: false, appId: null, appTitle: "" });
  const [deleting, setDeleting] = useState(false);

  const [PSalert, setPSAlert] = useState<{
    type: "success" | "failed" | "error";
    title: string;
    message: string;
  } | null>(null);
  
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const API_BASE = api;

  const tabs = [
    { key: 'program', label: 'Program History', icon: <FileText size={16} /> },
    { key: 'seedling', label: 'Seedling Analytics', icon: <Leaf size={16} /> },
    { key: 'geographic', label: 'Geographic & Land', icon: <MapPin size={16} /> },
    { key: 'monitoring', label: 'Monitoring Compliance', icon: <Activity size={16} /> },
  ];

  // ─── Fetch Functions ──────────────────────────────────────────────────
  const fetchReportData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}api/get_general_report_data/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to fetch report data.");
      const data = await response.json();
      setStats(data.stats);
      setMonthlyTrend(data.monthly_trend);
    } catch (err: any) {
      setPSAlert({ type: "error", title: "Failed", message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams({
        page: historyFilter.page.toString(),
        entries: historyFilter.entries.toString(),
      });
      if (historyFilter.status !== "All") params.append("status", historyFilter.status);
      if (historyFilter.search) params.append("search", historyFilter.search);
      if (historyFilter.date_from) params.append("date_from", historyFilter.date_from);
      if (historyFilter.date_to) params.append("date_to", historyFilter.date_to);

      const res = await fetch(`${API_BASE}api/get_program_history/?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch history");
      const data = await res.json();
      setHistoryData(data.data);
      setHistoryFilter((prev) => ({ ...prev, total_page: data.total_page, total: data.total }));
    } catch (err: any) {
      setPSAlert({ type: "error", title: "Failed", message: err.message });
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchSeedlingAnalytics = async () => {
    setSeedlingLoading(true);
    try {
      const res = await fetch(`${API_BASE}api/get_seedling_analytics/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch seedling analytics");
      const data = await res.json();
      setSeedlingData(data);
    } catch (err: any) {
      setPSAlert({ type: "error", title: "Failed", message: err.message });
    } finally {
      setSeedlingLoading(false);
    }
  };

  const fetchGeographicAnalytics = async () => {
    setGeographicLoading(true);
    try {
      const res = await fetch(`${API_BASE}api/get_geographic_analytics/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch geographic analytics");
      const data = await res.json();
      setGeographicData(data);
    } catch (err: any) {
      setPSAlert({ type: "error", title: "Failed", message: err.message });
    } finally {
      setGeographicLoading(false);
    }
  };

  const fetchMonitoringCompliance = async () => {
    setMonitoringLoading(true);
    try {
      const res = await fetch(`${API_BASE}api/get_monitoring_compliance/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch monitoring data");
      const data = await res.json();
      setMonitoringData(data);
    } catch (err: any) {
      setPSAlert({ type: "error", title: "Failed", message: err.message });
    } finally {
      setMonitoringLoading(false);
    }
  };

  const handleDeleteApplication = async () => {
    if (!deleteModal.appId) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE}api/delete_application/${deleteModal.appId}/`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete");
      
      setPSAlert({ type: "success", title: "Deleted", message: data.message });
      setDeleteModal({ open: false, appId: null, appTitle: "" });
      
      fetchHistory();
      fetchReportData();
    } catch (err: any) {
      setPSAlert({ type: "failed", title: "Error", message: err.message });
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => { 
    fetchReportData();
    fetchHistory();
  }, []);

  useEffect(() => {
    if (activeTab === 'seedling' && !seedlingData) fetchSeedlingAnalytics();
    if (activeTab === 'geographic' && !geographicData) fetchGeographicAnalytics();
    if (activeTab === 'monitoring' && !monitoringData) fetchMonitoringCompliance();
  }, [activeTab]);

  useEffect(() => { 
    fetchHistory();
  }, [historyFilter.page, historyFilter.entries]);

  const formatDate = (iso: string) =>
    iso ? new Date(iso).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) : "—";

  // ─── EXPORT FUNCTIONS ─────────────────────────────────────────────────
  const handleExportExcel = () => {
    if (historyData.length === 0) {
      setPSAlert({ type: "failed", title: "No Data", message: "No history data to export." });
      return;
    }

    const headers = ["Group Name", "Program Title", "Application Status", "Linked Site", "Site Status", "Barangay", "Area (ha)", "Created Date"];
    const rows = historyData.map((app) => [
      app.group_name, app.title, app.status, app.site_name || "N/A", app.site_status || "N/A",
      app.barangay || "N/A", app.site_area && app.site_area > 0 ? app.site_area.toFixed(2) : "0", formatDate(app.created_at),
    ]);

    const BOM = "\uFEFF";
    const csvContent = BOM + [headers.join(","), ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `program_history_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setPSAlert({ type: "success", title: "Exported!", message: "Report downloaded as Excel (CSV)." });
  };

  const handleExportPDF = () => {
    if (historyData.length === 0) {
      setPSAlert({ type: "failed", title: "No Data", message: "No history data to export." });
      return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      setPSAlert({ type: "error", title: "Popup Blocked", message: "Please allow popups to export PDF." });
      return;
    }

    const statusLabel = (status: string) => {
      if (status === "completed") return "Completed";
      if (["failed", "rejected", "cancelled"].includes(status)) return status.charAt(0).toUpperCase() + status.slice(1);
      if (["accepted", "under_monitoring"].includes(status)) return "Ongoing";
      if (["pending", "for_evaluation", "for_head"].includes(status)) return "Pending";
      return status;
    };

    const htmlContent = `
      <!DOCTYPE html><html><head><title>Program History Report</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #333; }
        h1 { color: #0F4A2F; margin-bottom: 5px; }
        .subtitle { color: #666; font-size: 14px; margin-bottom: 30px; }
        .filters { background: #f9fafb; padding: 15px; border-radius: 8px; margin-bottom: 20px; font-size: 13px; color: #555; border: 1px solid #e5e7eb; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th { background-color: #0F4A2F; color: white; padding: 10px; text-align: left; }
        td { padding: 10px; border-bottom: 1px solid #e5e7eb; }
        tr:nth-child(even) { background-color: #f9fafb; }
        .badge { padding: 3px 8px; border-radius: 12px; font-size: 10px; font-weight: bold; display: inline-block; }
        .badge-green { background: #dcfce7; color: #166534; } .badge-red { background: #fee2e2; color: #991b1b; }
        .badge-blue { background: #dbeafe; color: #1e40af; } .badge-amber { background: #fef3c7; color: #92400e; }
        .badge-gray { background: #f3f4f6; color: #374151; }
        .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #999; border-top: 1px solid #e5e7eb; padding-top: 20px; }
        @media print { body { padding: 20px; } .no-print { display: none; } }
      </style></head><body>
        <h1>Program History & Site Status Report</h1>
        <p class="subtitle">Generated on ${new Date().toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })}</p>
        <div class="filters"><strong>Filters Applied:</strong> Status: ${historyFilter.status === "All" ? "All Statuses" : statusLabel(historyFilter.status)} | Date Range: ${historyFilter.date_from || "Start"} to ${historyFilter.date_to || "Present"} | Search: ${historyFilter.search || "None"}</div>
        <table><thead><tr><th>Group Name</th><th>Program Title</th><th>Application Status</th><th>Linked Site</th><th>Site Status</th><th>Barangay</th><th>Area (ha)</th><th>Date</th></tr></thead><tbody>
          ${historyData.map((app) => {
            let appBadgeClass = "badge-gray";
            let siteBadgeClass = "badge-gray";
            
            if (app.status === "completed") appBadgeClass = "badge-green";
            else if (["failed", "rejected", "cancelled"].includes(app.status)) appBadgeClass = "badge-red";
            else if (["accepted", "under_monitoring"].includes(app.status)) appBadgeClass = "badge-blue";
            else if (["pending", "for_evaluation", "for_head"].includes(app.status)) appBadgeClass = "badge-amber";
            
            if (app.site_status === "completed") siteBadgeClass = "badge-green";
            else if (["failed", "rejected", "cancelled"].includes(app.site_status || "")) siteBadgeClass = "badge-red";
            else if (["accepted", "under_monitoring"].includes(app.site_status || "")) siteBadgeClass = "badge-blue";
            else if (["pending", "for_evaluation", "for_head"].includes(app.site_status || "")) siteBadgeClass = "badge-amber";
            
            return `<tr>
              <td><strong>${app.group_name}</strong></td>
              <td>${app.title}</td>
              <td><span class="badge ${appBadgeClass}">${statusLabel(app.status)}</span></td>
              <td>${app.site_name || "N/A"}</td>
              <td><span class="badge ${siteBadgeClass}">${app.site_status ? statusLabel(app.site_status) : "N/A"}</span></td>
              <td>${app.barangay || "N/A"}</td>
              <td>${app.site_area && app.site_area > 0 ? app.site_area.toFixed(2) : "—"}</td>
              <td>${formatDate(app.created_at)}</td>
            </tr>`;
          }).join("")}
        </tbody></table><div class="footer">PlantScope MCDA System - Confidential Report</div>
        <script>window.onload = function() { window.print(); }</script>
      </body></html>
    `;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {PSalert && <PlantScopeAlert type={PSalert.type} title={PSalert.title} message={PSalert.message} onClose={() => setPSAlert(null)} />}

      <main className="max-w-7xl mx-auto p-6 space-y-6">
        {/* ── Header ── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Activity size={24} className="text-[#0F4A2F]" /> Analytics & Reports
            </h1>
            <p className="text-sm text-gray-500 mt-1">Comprehensive analytics for tree planting programs, seedling inventory, and monitoring compliance.</p>
          </div>
          <button onClick={() => {
            if (activeTab === 'program') { fetchReportData(); fetchHistory(); }
            else if (activeTab === 'seedling') fetchSeedlingAnalytics();
            else if (activeTab === 'geographic') fetchGeographicAnalytics();
            else if (activeTab === 'monitoring') fetchMonitoringCompliance();
          }} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0F4A2F] text-white text-sm font-semibold hover:bg-[#1a6b44] transition-colors shadow-sm">
            <Loader2 size={16} className={(loading || seedlingLoading || geographicLoading || monitoringLoading) ? "animate-spin" : ""} /> Refresh Data
          </button>
        </div>

        {/* ── Tab Navigation ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-1">
          <nav className="flex space-x-2">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  activeTab === tab.key
                    ? 'bg-[#0F4A2F] text-white shadow-sm'
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* ── Tab Content ── */}
        {activeTab === 'program' && (
          <>
            {/* Dashboard Stats & Charts */}
            {loading && !stats ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 size={40} className="animate-spin text-[#0F4A2F] mb-4" />
                <p className="text-gray-500 font-medium">Calculating report metrics...</p>
              </div>
            ) : stats ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                  {[
                    { title: "Total Tree Growers", value: stats.total_groups || 0, icon: <Users size={22} />, bg: "bg-indigo-50", iconColor: "text-indigo-600" },
                    { title: "Completed Programs", value: stats.completed_programs || 0, icon: <CheckCircle2 size={22} />, bg: "bg-green-50", iconColor: "text-green-600" },
                    { title: "Failed/Rejected", value: stats.failed_programs || 0, icon: <XCircle size={22} />, bg: "bg-red-50", iconColor: "text-red-600" },
                    { title: "Ongoing Programs", value: stats.ongoing_programs || 0, icon: <Clock size={22} />, bg: "bg-amber-50", iconColor: "text-amber-600" },
                  ].map((stat, i) => (
                    <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
                      <div className={`w-11 h-11 rounded-xl ${stat.bg} flex items-center justify-center ${stat.iconColor} mb-3`}>{stat.icon}</div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">{stat.title}</p>
                      <p className="text-2xl font-bold text-gray-800 mt-1">{(stat.value || 0).toLocaleString()}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <h3 className="text-base font-bold text-gray-800 flex items-center gap-2 mb-1">
                      <TrendingUp size={18} className="text-[#0F4A2F]" /> Program Status Trend
                    </h3>
                    <p className="text-xs text-gray-500 mb-4">Monthly comparison of completed vs failed programs (Last 6 Months)</p>
                    <LineChart data={monthlyTrend} />
                  </div>
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col">
                    <h3 className="text-base font-bold text-gray-800 flex items-center gap-2 mb-1">
                      <Leaf size={18} className="text-[#0F4A2F]" /> Seedling Survival Rate
                    </h3>
                    <p className="text-xs text-gray-500 mb-4">Based on all accepted progress reports</p>
                    <div className="flex-1 flex items-center justify-center">
                      <DonutChart survived={stats.total_seedlings_survived || 0} dead={stats.total_seedlings_dead || 0} />
                    </div>
                  </div>
                </div>
              </>
            ) : null}

            {/* Program History Table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
                    <FileText size={18} className="text-[#0F4A2F]" /> Program History & Site Status
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">Filter and view detailed history of tree growers and their linked sites.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={handleExportPDF} disabled={historyData.length === 0} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    <FileText size={14} /> Export PDF
                  </button>
                  <button onClick={handleExportExcel} disabled={historyData.length === 0} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-green-200 text-green-700 text-xs font-semibold hover:bg-green-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    <Download size={14} /> Export Excel
                  </button>
                </div>
              </div>

              {/* Filters */}
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex flex-wrap items-center gap-3">
                <select value={historyFilter.status} onChange={(e) => setHistoryFilter((prev) => ({ ...prev, status: e.target.value, page: 1 }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-[#0F4A2F] focus:outline-none bg-white">
                  <option value="All">All Statuses</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                  <option value="rejected">Rejected</option>
                  <option value="accepted">Accepted (Ongoing)</option>
                  <option value="under_monitoring">Under Monitoring</option>
                  <option value="for_evaluation">Pending Evaluation</option>
                </select>

                <div className="flex items-center gap-2">
                  <Calendar size={14} className="text-gray-400" />
                  <input type="date" value={historyFilter.date_from} onChange={(e) => setHistoryFilter((prev) => ({ ...prev, date_from: e.target.value, page: 1 }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-[#0F4A2F] focus:outline-none bg-white" />
                  <span className="text-gray-400 text-sm">to</span>
                  <input type="date" value={historyFilter.date_to} onChange={(e) => setHistoryFilter((prev) => ({ ...prev, date_to: e.target.value, page: 1 }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-[#0F4A2F] focus:outline-none bg-white" />
                </div>

                <div className="relative ml-auto">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" placeholder="Search group, program, or site..." value={historyFilter.search} onChange={(e) => setHistoryFilter((prev) => ({ ...prev, search: e.target.value, page: 1 }))} onKeyDown={(e) => { if (e.key === "Enter") fetchHistory(); }} className="border border-gray-300 rounded-lg pl-8 pr-3 py-2 w-64 text-sm focus:border-[#0F4A2F] focus:outline-none bg-white" />
                </div>

                <button onClick={fetchHistory} className="px-4 py-2 rounded-lg bg-[#0F4A2F] text-white text-sm font-medium hover:bg-[#1a6b44] transition-colors">Apply Filters</button>
              </div>

              {/* Table */}
              <div className="overflow-x-auto relative">
                {historyLoading && (
                  <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
                    <Loader2 size={32} className="animate-spin text-[#0F4A2F]" />
                  </div>
                )}
                <table className="min-w-full">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="py-3 px-6 text-left text-xs font-semibold uppercase tracking-wider">Group / Program</th>
                      <th className="py-3 px-6 text-left text-xs font-semibold uppercase tracking-wider">Application Status</th>
                      <th className="py-3 px-6 text-left text-xs font-semibold uppercase tracking-wider">Linked Site</th>
                      <th className="py-3 px-6 text-left text-xs font-semibold uppercase tracking-wider">Site Status</th>
                      <th className="py-3 px-6 text-left text-xs font-semibold uppercase tracking-wider">Barangay</th>
                      <th className="py-3 px-6 text-left text-xs font-semibold uppercase tracking-wider">Area (ha)</th>
                      <th className="py-3 px-6 text-left text-xs font-semibold uppercase tracking-wider">Date</th>
                      <th className="py-3 px-6 text-left text-xs font-semibold uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {historyData.length > 0 ? (
                      historyData.map((app, i) => (
                        <tr key={app.application_id} className="hover:bg-gray-50 transition-colors">
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              {app.group_profile ? (
                                <img src={app.group_profile.startsWith('http') ? app.group_profile : `${app.group_profile}`} className="w-9 h-9 rounded-full object-cover border border-gray-200" alt="Group" />
                              ) : (
                                <div className="w-9 h-9 rounded-full bg-green-50 flex items-center justify-center border border-gray-200">
                                  <Leaf size={16} className="text-green-300" />
                                </div>
                              )}
                              <div>
                                <p className="text-sm font-semibold text-gray-800">{app.group_name}</p>
                                <p className="text-xs text-gray-500 truncate max-w-[200px]" title={app.title}>{app.title}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <StatusBadge status={app.status} />
                          </td>
                          <td className="py-4 px-6 text-sm font-medium text-gray-800">
                            {app.site_name || <span className="text-gray-400 italic">No site assigned</span>}
                          </td>
                          <td className="py-4 px-6">
                            {app.site_status ? <StatusBadge status={app.site_status} /> : <span className="text-gray-400 text-xs">N/A</span>}
                          </td>
                          <td className="py-4 px-6 text-sm text-gray-600">{app.barangay || "—"}</td>
                          <td className="py-4 px-6 text-sm font-medium text-gray-800">{app.site_area && app.site_area > 0 ? app.site_area.toFixed(2) : "—"}</td>
                          <td className="py-4 px-6 text-sm text-gray-500">{formatDate(app.created_at)}</td>
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-2">
                              <button onClick={() => navigate(`/DataManager/maintenance_evaluation/${app.application_id}`)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-100 transition-colors">
                                <ExternalLink size={12} /> View
                              </button>
                              {app.site_status !== "completed" && (
                                <button
                                  onClick={() => setDeleteModal({ open: true, appId: app.application_id, appTitle: app.title })}
                                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-red-200 text-red-500 text-xs font-medium hover:bg-red-50 transition-colors"
                                  title="Delete Application"
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-gray-400 text-sm">No applications match your filters.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {historyFilter.total_page > 1 && (
                <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50">
                  <p className="text-sm text-gray-500">
                    Showing {(historyFilter.page - 1) * historyFilter.entries + 1} to {Math.min(historyFilter.page * historyFilter.entries, historyFilter.total)} of {historyFilter.total} results
                  </p>
                  <div className="flex items-center gap-1">
                    <button disabled={historyFilter.page <= 1} onClick={() => setHistoryFilter((prev) => ({ ...prev, page: prev.page - 1 }))} className="px-3 py-1.5 border rounded-lg text-gray-700 hover:bg-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 text-sm">
                      <ChevronLeft size={14} /> Prev
                    </button>
                    {Array.from({ length: Math.min(5, historyFilter.total_page) }, (_, i) => {
                      let pageNum = historyFilter.total_page <= 5 ? i + 1 : historyFilter.page <= 3 ? i + 1 : historyFilter.page >= historyFilter.total_page - 2 ? historyFilter.total_page - 4 + i : historyFilter.page - 2 + i;
                      return (
                        <button key={pageNum} onClick={() => setHistoryFilter((prev) => ({ ...prev, page: pageNum }))} className={`px-3 py-1.5 border rounded-lg cursor-pointer text-sm ${pageNum === historyFilter.page ? "bg-[#0F4A2F] text-white" : "text-gray-700 hover:bg-white"}`}>
                          {pageNum}
                        </button>
                      );
                    })}
                    <button disabled={historyFilter.page >= historyFilter.total_page} onClick={() => setHistoryFilter((prev) => ({ ...prev, page: prev.page + 1 }))} className="px-3 py-1.5 border rounded-lg text-gray-700 hover:bg-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 text-sm">
                      Next <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'seedling' && (
          <div className="space-y-6">
            {seedlingLoading && !seedlingData ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 size={40} className="animate-spin text-[#0F4A2F] mb-4" />
                <p className="text-gray-500 font-medium">Loading seedling analytics...</p>
              </div>
            ) : seedlingData ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                  {[
                    { title: "Total Distributed", value: seedlingData.total_requested, icon: <TreePine size={22} />, bg: "bg-green-50", iconColor: "text-green-600" },
                    { title: "Total Survived", value: seedlingData.total_survived, icon: <CheckCircle2 size={22} />, bg: "bg-emerald-50", iconColor: "text-emerald-600" },
                    { title: "Total Dead", value: seedlingData.total_dead, icon: <XCircle size={22} />, bg: "bg-red-50", iconColor: "text-red-600" },
                    { title: "Survival Rate", value: seedlingData.total_survived + seedlingData.total_dead > 0 ? `${((seedlingData.total_survived / (seedlingData.total_survived + seedlingData.total_dead)) * 100).toFixed(1)}%` : "0%", icon: <TrendingUp size={22} />, bg: "bg-blue-50", iconColor: "text-blue-600" },
                  ].map((stat, i) => (
                    <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
                      <div className={`w-11 h-11 rounded-xl ${stat.bg} flex items-center justify-center ${stat.iconColor} mb-3`}>{stat.icon}</div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">{stat.title}</p>
                      <p className="text-2xl font-bold text-gray-800 mt-1">{stat.value}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <h3 className="text-base font-bold text-gray-800 flex items-center gap-2 mb-4">
                      <BarChart3 size={18} className="text-[#0F4A2F]" /> Top 5 Most Requested Species
                    </h3>
                    <HorizontalBarChart data={seedlingData.species_breakdown.map(s => ({ name: s.species_name, value: s.requested }))} />
                  </div>

                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <h3 className="text-base font-bold text-gray-800 flex items-center gap-2 mb-4">
                      <Leaf size={18} className="text-[#0F4A2F]" /> Species Survival Breakdown
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase">Species</th>
                            <th className="py-3 px-4 text-center text-xs font-semibold text-gray-600 uppercase">Requested</th>
                            <th className="py-3 px-4 text-center text-xs font-semibold text-gray-600 uppercase">Survived</th>
                            <th className="py-3 px-4 text-center text-xs font-semibold text-gray-600 uppercase">Dead</th>
                            <th className="py-3 px-4 text-center text-xs font-semibold text-gray-600 uppercase">Rate</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {seedlingData.species_breakdown.map((species, i) => (
                            <tr key={i} className="hover:bg-gray-50">
                              <td className="py-3 px-4 text-sm font-medium text-gray-800">{species.species_name}</td>
                              <td className="py-3 px-4 text-sm text-center text-gray-600">{species.requested.toLocaleString()}</td>
                              <td className="py-3 px-4 text-sm text-center text-green-600 font-semibold">{species.survived.toLocaleString()}</td>
                              <td className="py-3 px-4 text-sm text-center text-red-600 font-semibold">{species.dead.toLocaleString()}</td>
                              <td className="py-3 px-4 text-sm text-center">
                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                  species.survival_rate >= 70 ? 'bg-green-100 text-green-700' :
                                  species.survival_rate >= 40 ? 'bg-amber-100 text-amber-700' :
                                  'bg-red-100 text-red-700'
                                }`}>
                                  {species.survival_rate.toFixed(1)}%
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        )}

        {activeTab === 'geographic' && (
          <div className="space-y-6">
            {geographicLoading && !geographicData ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 size={40} className="animate-spin text-[#0F4A2F] mb-4" />
                <p className="text-gray-500 font-medium">Loading geographic analytics...</p>
              </div>
            ) : geographicData ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                  {[
                    { title: "Reforestation Areas", value: geographicData.kpis.total_areas, icon: <MapPin size={22} />, bg: "bg-indigo-50", iconColor: "text-indigo-600" },
                    { title: "Official Sites", value: geographicData.kpis.total_sites, icon: <CheckCircle2 size={22} />, bg: "bg-green-50", iconColor: "text-green-600" },
                    { title: "Total Hectares", value: geographicData.kpis.total_hectares.toFixed(2), icon: <TreePine size={22} />, bg: "bg-emerald-50", iconColor: "text-emerald-600" },
                    { title: "Pending Verifications", value: geographicData.kpis.pending_verifications, icon: <Clock size={22} />, bg: "bg-amber-50", iconColor: "text-amber-600" },
                  ].map((stat, i) => (
                    <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
                      <div className={`w-11 h-11 rounded-xl ${stat.bg} flex items-center justify-center ${stat.iconColor} mb-3`}>{stat.icon}</div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">{stat.title}</p>
                      <p className="text-2xl font-bold text-gray-800 mt-1">{stat.value}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <h3 className="text-base font-bold text-gray-800 flex items-center gap-2 mb-4">
                      <BarChart3 size={18} className="text-[#0F4A2F]" /> Hectares Reforested per Barangay
                    </h3>
                    <VerticalBarChart data={geographicData.hectares_by_barangay.map(b => ({ name: b.barangay_name, value: b.total_hectares }))} />
                  </div>

                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <h3 className="text-base font-bold text-gray-800 flex items-center gap-2 mb-4">
                      <PieChartIcon size={18} className="text-[#0F4A2F]" /> Land Classification Distribution
                    </h3>
                    <div className="space-y-3">
                      {geographicData.land_classification_distribution.map((item, i) => {
                        const total = geographicData.land_classification_distribution.reduce((sum, curr) => sum + curr.count, 0);
                        const percentage = ((item.count / total) * 100).toFixed(1);
                        return (
                          <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <span className="text-sm font-medium text-gray-700">{item.classification_name}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-sm text-gray-500">{item.count} sites</span>
                              <span className="text-sm font-bold text-[#0F4A2F]">{percentage}%</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        )}

        {activeTab === 'monitoring' && (
          <div className="space-y-6">
            {monitoringLoading && !monitoringData ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 size={40} className="animate-spin text-[#0F4A2F] mb-4" />
                <p className="text-gray-500 font-medium">Loading monitoring data...</p>
              </div>
            ) : monitoringData ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {[
                    { title: "Active Programs", value: monitoringData.kpis.active_programs, icon: <Activity size={22} />, bg: "bg-blue-50", iconColor: "text-blue-600" },
                    { title: "Total Reports", value: monitoringData.kpis.total_reports, icon: <FileText size={22} />, bg: "bg-green-50", iconColor: "text-green-600" },
                    { title: "Compliance Rate", value: `${monitoringData.kpis.compliance_rate.toFixed(1)}%`, icon: <CheckCircle2 size={22} />, bg: "bg-emerald-50", iconColor: "text-emerald-600" },
                  ].map((stat, i) => (
                    <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
                      <div className={`w-11 h-11 rounded-xl ${stat.bg} flex items-center justify-center ${stat.iconColor} mb-3`}>{stat.icon}</div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">{stat.title}</p>
                      <p className="text-2xl font-bold text-gray-800 mt-1">{stat.value}</p>
                    </div>
                  ))}
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                  <h3 className="text-base font-bold text-gray-800 flex items-center gap-2 mb-4">
                    <TrendingUp size={18} className="text-[#0F4A2F]" /> Monthly Report Submissions
                  </h3>
                  <VerticalBarChart data={monitoringData.monthly_submissions.map(m => ({ name: m.month, value: m.reports }))} />
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100">
                    <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
                      <FileText size={18} className="text-[#0F4A2F]" /> Monitoring Compliance Tracker
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">Track tree grower compliance with progress report submissions.</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="py-3 px-6 text-left text-xs font-semibold text-gray-600 uppercase">Group Name</th>
                          <th className="py-3 px-6 text-left text-xs font-semibold text-gray-600 uppercase">Assigned Site</th>
                          <th className="py-3 px-6 text-left text-xs font-semibold text-gray-600 uppercase">Last Report</th>
                          <th className="py-3 px-6 text-left text-xs font-semibold text-gray-600 uppercase">Days Since</th>
                          <th className="py-3 px-6 text-left text-xs font-semibold text-gray-600 uppercase">Survival Rate</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {monitoringData.compliance_tracker.map((item, i) => (
                          <tr key={i} className={`hover:bg-gray-50 ${item.days_since_last_report && item.days_since_last_report > 90 ? 'bg-red-50' : ''}`}>
                            <td className="py-4 px-6 text-sm font-medium text-gray-800">{item.group_name}</td>
                            <td className="py-4 px-6 text-sm text-gray-600">{item.site_name}</td>
                            <td className="py-4 px-6 text-sm text-gray-600">{item.last_report_date ? formatDate(item.last_report_date) : 'Never'}</td>
                            <td className="py-4 px-6 text-sm">
                              {item.days_since_last_report !== null ? (
                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                  item.days_since_last_report > 90 ? 'bg-red-100 text-red-700' :
                                  item.days_since_last_report > 60 ? 'bg-amber-100 text-amber-700' :
                                  'bg-green-100 text-green-700'
                                }`}>
                                  {item.days_since_last_report} days
                                </span>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                            <td className="py-4 px-6 text-sm">
                              <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                item.survival_rate >= 70 ? 'bg-green-100 text-green-700' :
                                item.survival_rate >= 40 ? 'bg-amber-100 text-amber-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                                {item.survival_rate.toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        )}
      </main>

      {/* Delete Confirmation Modal */}
      {deleteModal.open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={28} className="text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-center text-gray-800 mb-1">Delete Application?</h3>
            <p className="text-sm text-center text-gray-500 mb-5">
              Are you sure you want to delete <strong>"{deleteModal.appTitle}"</strong>? 
              This will permanently delete all related seedling requests and progress reports.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteModal({ open: false, appId: null, appTitle: "" })}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteApplication}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                {deleting ? "Deleting..." : "Delete Permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}