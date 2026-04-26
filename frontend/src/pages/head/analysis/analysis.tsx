"use client";
import { useEffect, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import {
  ChevronRight,
  Search,
  MapPin,
  Table,
  Leaf,
  TrendingUp,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useNavigate } from "react-router-dom";
import { useUserRole } from "@/hooks/authorization";

// ===============================
// MOCK DATA
// ===============================
const reforestationAreas = [
  {
    id: 1,
    name: "Ormoc Watershed A",
    pending: 5,
    official: 10,
    rejected: 2,
    finishRate: 67,
  },
  {
    id: 2,
    name: "Lake Danao Site",
    pending: 2,
    official: 12,
    rejected: 1,
    finishRate: 80,
  },
  {
    id: 3,
    name: "Forest Zone Leyte",
    pending: 8,
    official: 7,
    rejected: 3,
    finishRate: 50,
  },
  {
    id: 4,
    name: "Ormoc Riverbank",
    pending: 3,
    official: 9,
    rejected: 0,
    finishRate: 75,
  },
];

const monthlyData = [
  { month: "Nov", pending: 5, official: 3 },
  { month: "Dec", pending: 4, official: 5 },
  { month: "Jan", pending: 6, official: 7 },
  { month: "Feb", pending: 3, official: 9 },
  { month: "Mar", pending: 2, official: 12 },
];

const allSites = [
  {
    id: 1,
    name: "Ormoc Watershed A",
    location: "San Jose",
    score: 67,
    coords: [11.024, 124.615],
  },
  {
    id: 2,
    name: "Lake Danao Site",
    location: "Libas",
    score: 80,
    coords: [11.073, 124.615],
  },
  {
    id: 3,
    name: "Forest Zone Leyte",
    location: "Milagro",
    score: 50,
    coords: [11.0, 124.6],
  },
  {
    id: 4,
    name: "Ormoc Riverbank",
    location: "Cogon",
    score: 75,
    coords: [11.015, 124.63],
  },
  {
    id: 5,
    name: "San Miguel Forest",
    location: "San Miguel",
    score: 55,
    coords: [11.02, 124.63],
  },
  {
    id: 6,
    name: "Lake Mahagnao",
    location: "Mahagnao",
    score: 72,
    coords: [11.08, 124.62],
  },
];

// ===============================
// COLOR PALETTE
// ===============================
const COLORS = {
  primary: "#0F4A2F", // Deep forest green (brand)
  primaryLight: "#1a6b44", // Lighter green for hover
  primarySoft: "#e8f5e9", // Soft green background
  success: "#22c55e", // Vibrant green
  warning: "#f59e0b", // Amber
  danger: "#ef4444", // Red
  info: "#3b82f6", // Blue
  earth: {
    soil: "#8D6E63",
    leaf: "#4CAF50",
    sky: "#87CEEB",
    sand: "#D7CCC8",
  },
  chart: ["#0F4A2F", "#22c55e", "#f59e0b", "#3b82f6", "#8D6E63"],
};

// ===============================
// LEAFLET MARKER ICON
// ===============================
const markerIcon = (score: number) =>
  L.icon({
    iconUrl:
      score >= 70
        ? "https://maps.gstatic.com/mapfiles/ms2/micons/green-dot.png"
        : score >= 50
          ? "https://maps.gstatic.com/mapfiles/ms2/micons/yellow-dot.png"
          : "https://maps.gstatic.com/mapfiles/ms2/micons/red-dot.png",
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });

// ===============================
// HELPER COMPONENTS
// ===============================
interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  trend?: string;
  color: string;
}

const StatCard = ({
  title,
  value,
  icon: Icon,
  trend,
  color,
}: StatCardProps) => (
  <div
    className="bg-white rounded-2xl shadow-lg p-5 border-l-4"
    style={{ borderColor: color }}
  >
    <div className="flex items-start justify-between">
      <div>
        <p className="text-gray-500 text-sm font-medium">{title}</p>
        <p className="text-2xl font-bold mt-1" style={{ color }}>
          {value}
        </p>
        {trend && (
          <div
            className="flex items-center gap-1 mt-2 text-sm"
            style={{ color }}
          >
            <TrendingUp size={14} />
            <span>{trend}</span>
          </div>
        )}
      </div>
      <div
        className="p-3 rounded-full"
        style={{ backgroundColor: `${color}15` }}
      >
        <Icon size={24} style={{ color }} />
      </div>
    </div>
  </div>
);

interface AreaCardProps {
  area: {
    id: number;
    name: string;
    pending: number;
    official: number;
    rejected: number;
    finishRate: number;
  };
}

const AreaCard = ({ area }: AreaCardProps) => {
  const rateColor =
    area.finishRate >= 70
      ? COLORS.success
      : area.finishRate >= 50
        ? COLORS.warning
        : COLORS.danger;
  return (
    <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl hover:border-green-200 transition-all duration-300 group">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-lg text-gray-800 group-hover:text-[#0F4A2F] transition-colors">
          {area.name}
        </h3>
        <span
          className="px-3 py-1 rounded-full text-xs font-semibold text-white"
          style={{ backgroundColor: rateColor }}
        >
          {area.finishRate}%
        </span>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Official</span>
          <span className="font-medium text-green-600">{area.official}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Pending</span>
          <span className="font-medium text-amber-500">{area.pending}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Rejected</span>
          <span className="font-medium text-red-500">{area.rejected}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
        <div
          className="h-2 rounded-full transition-all duration-500"
          style={{
            width: `${area.finishRate}%`,
            background: `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.success})`,
          }}
        />
      </div>

      <button
        className="w-full flex items-center justify-center gap-2 py-2 rounded-lg font-medium text-sm transition-colors"
        style={{
          backgroundColor: `${COLORS.primary}10`,
          color: COLORS.primary,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = COLORS.primary;
          e.currentTarget.style.color = "white";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = `${COLORS.primary}10`;
          e.currentTarget.style.color = COLORS.primary;
        }}
      >
        View Details <ChevronRight size={16} />
      </button>
    </div>
  );
};

// ===============================
// MAIN COMPONENT
// ===============================
export default function AnalysisPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [scoreFilter, setScoreFilter] = useState<number | null>(null);
  const [viewMap, setViewMap] = useState(false);
  const navigate = useNavigate();
  const filteredSites = allSites.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
      (scoreFilter === null || s.score >= scoreFilter),
  );

  // Calculate summary stats
  const totalSites = allSites.length;
  const avgScore = Math.round(
    allSites.reduce((acc, s) => acc + s.score, 0) / totalSites,
  );
  const totalOfficial = reforestationAreas.reduce(
    (acc, a) => acc + a.official,
    0,
  );
  const totalPending = reforestationAreas.reduce(
    (acc, a) => acc + a.pending,
    0,
  );
  const { userRole, isLoading } = useUserRole();
  const [useruserRole, setUseruserRole] = useState("");

  useEffect(() => {
    if (userRole === "treeGrowers" || userRole === "CityENROHead") {
      setUseruserRole("");
      return;
    }

    if (userRole === "GISSpecialist") {
      setUseruserRole("/GISS");
      return;
    }

    if (userRole === "DataManager") {
      setUseruserRole("/DataManager");
      return;
    }
  }, [userRole]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-green-50/30 to-gray-50">
      {/* ================= HEADER ================= */}
     

      <main className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
        {/* ================= STATS ROW ================= */}
        {/* <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Sites"
            value={totalSites}
            icon={MapPin}
            color={COLORS.info}
            trend="+2 this month"
          />
          <StatCard
            title="Avg. Suitability"
            value={`${avgScore}%`}
            icon={TrendingUp}
            color={COLORS.success}
            trend="+5% vs last quarter"
          />
          <StatCard
            title="Official Reports"
            value={totalOfficial}
            icon={CheckCircle}
            color={COLORS.primary}
          />
          <StatCard
            title="Pending Review"
            value={totalPending}
            icon={AlertCircle}
            color={COLORS.warning}
          />
        </div> */}

        {/* ================= TOP SECTION: CARDS + PIE ================= */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Area Cards Section */}
          <div className="lg:col-span-2">
            {/* Section Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <h3
                  className="text-xl font-bold flex items-center gap-2"
                  style={{ color: COLORS.primary }}
                >
                  <Leaf size={20} /> Top 4 Reforestation Areas Close to
                  Completed
                </h3>
                <p className="text-gray-500 text-sm mt-1">
                  Sites with highest finish rates, prioritized for final
                  monitoring
                </p>
              </div>
              {/* ✅ Fixed: Using Next.js Link component */}
              <button
                onClick={() =>
                  navigate(`${useruserRole}/reforestation_area_analysis`)
                }
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm self-start sm:self-auto transition-colors text-white bg-[#0F4A2F] hover:bg-[#1a6b44]"
              >
                View All Areas <ChevronRight size={16} />
              </button>
            </div>

            {/* Area Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {reforestationAreas
                .sort((a, b) => b.finishRate - a.finishRate)
                .map((area) => (
                  <AreaCard key={area.id} area={area} />
                ))}
            </div>
          </div>

          {/* Right Column: Pie Chart */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
            <h3
              className="font-bold text-xl mb-4 flex items-center gap-2"
              style={{ color: COLORS.primary }}
            >
              Overall Site Distribution
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={reforestationAreas.map((a) => ({
                    name: a.name,
                    value: a.pending + a.official + a.rejected,
                  }))}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  label={({ name, percent }) =>
                    `${name} ${((percent || 0) * 100).toFixed(0)}%`
                  }
                  labelLine={false}
                  outerRadius={75}
                  innerRadius={40}
                  paddingAngle={3}
                >
                  {reforestationAreas.map((_, idx) => (
                    <Cell
                      key={idx}
                      fill={COLORS.chart[idx % COLORS.chart.length]}
                      stroke="white"
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: "12px",
                    border: "none",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                    backgroundColor: "white",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap justify-center gap-3 mt-4">
              {reforestationAreas.map((area, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{
                      backgroundColor: COLORS.chart[idx % COLORS.chart.length],
                    }}
                  />
                  <span className="text-gray-600">{area.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ================= MID SECTION: CHART + TABLE ================= */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Line Chart */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
            <h3
              className="font-bold text-xl mb-4 flex items-center gap-2"
              style={{ color: COLORS.primary }}
            >
              <TrendingUp size={20} /> Progress Trend: Last 5 Months
            </h3>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart
                data={monthlyData}
                margin={{ top: 10, right: 20, bottom: 0, left: 0 }}
              >
                <defs>
                  <linearGradient
                    id="officialGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor={COLORS.success}
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="95%"
                      stopColor={COLORS.success}
                      stopOpacity={0}
                    />
                  </linearGradient>
                  <linearGradient
                    id="pendingGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor={COLORS.warning}
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="95%"
                      stopColor={COLORS.warning}
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke="#e5e7eb" />
                <XAxis
                  dataKey="month"
                  axisLine={{ stroke: "#9ca3af" }}
                  tick={{ fill: "#6b7280", fontSize: 12 }}
                />
                <YAxis
                  axisLine={{ stroke: "#9ca3af" }}
                  tick={{ fill: "#6b7280", fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "12px",
                    border: "none",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                    backgroundColor: "white",
                  }}
                />
                <Legend wrapperStyle={{ paddingTop: "10px" }} />
                <Line
                  type="monotone"
                  dataKey="official"
                  stroke={COLORS.success}
                  strokeWidth={3}
                  dot={{ fill: COLORS.success, strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, stroke: "white", strokeWidth: 2 }}
                  name="Official Reports"
                />
                <Line
                  type="monotone"
                  dataKey="pending"
                  stroke={COLORS.warning}
                  strokeWidth={3}
                  dot={{ fill: COLORS.warning, strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, stroke: "white", strokeWidth: 2 }}
                  name="Pending Review"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Recent Updates Table */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 overflow-hidden">
            <h3
              className="font-bold text-xl mb-4 flex items-center gap-2"
              style={{ color: COLORS.primary }}
            >
              <Table size={20} /> Recent Site Updates
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr
                    className="border-b-2"
                    style={{ borderColor: `${COLORS.primary}20` }}
                  >
                    <th
                      className="py-3 px-4 font-semibold"
                      style={{ color: COLORS.primary }}
                    >
                      Site
                    </th>
                    <th
                      className="py-3 px-4 font-semibold"
                      style={{ color: COLORS.primary }}
                    >
                      Location
                    </th>
                    <th
                      className="py-3 px-4 font-semibold"
                      style={{ color: COLORS.primary }}
                    >
                      Score
                    </th>
                    <th
                      className="py-3 px-4 font-semibold"
                      style={{ color: COLORS.primary }}
                    >
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {allSites.slice(0, 5).map((s, idx) => (
                    <tr
                      key={s.id}
                      className="border-b hover:bg-green-50/50 transition-colors"
                      style={{
                        borderColor: idx < 4 ? "#f3f4f6" : "transparent",
                      }}
                    >
                      <td className="py-3 px-4 font-medium text-gray-800">
                        {s.name}
                      </td>
                      <td className="py-3 px-4 text-gray-600">{s.location}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            s.score >= 70
                              ? "bg-green-100 text-green-700"
                              : s.score >= 50
                                ? "bg-amber-100 text-amber-700"
                                : "bg-red-100 text-red-700"
                          }`}
                        >
                          {s.score}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          Analysis
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-end">
              <button className="px-5 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 flex items-center gap-2 text-white bg-[#0F4A2F] hover:bg-[#1a6b44]">
                View All Updates <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* ================= BOTTOM SECTION: SEARCH + MAP/TABLE TOGGLE ================= */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
            <h3
              className="font-bold text-xl flex items-center gap-2"
              style={{ color: COLORS.primary }}
            >
              <MapPin size={20} /> All Reforestation Sites
            </h3>
            <div className="flex gap-2">
              <button
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                  viewMap
                    ? "text-white shadow-md bg-[#0F4A2F]"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
                onClick={() => setViewMap(true)}
              >
                <MapPin size={16} /> Map View
              </button>
              <button
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                  !viewMap
                    ? "text-white shadow-md bg-[#0F4A2F]"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
                onClick={() => setViewMap(false)}
              >
                <Table size={16} /> Table View
              </button>
            </div>
          </div>

          {/* Search & Filter */}
          <div
            className="flex flex-col sm:flex-row gap-3 mb-5 p-4 rounded-xl"
            style={{ backgroundColor: COLORS.primarySoft }}
          >
            <div className="relative flex-1">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                placeholder="Search by site name..."
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0F4A2F] focus:border-transparent outline-none transition-shadow"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select
              className="px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0F4A2F] focus:border-transparent outline-none bg-white"
              value={scoreFilter || ""}
              onChange={(e) =>
                setScoreFilter(e.target.value ? Number(e.target.value) : null)
              }
            >
              <option value="">All Scores</option>
              <option value={50}>50+ (Minimum)</option>
              <option value={60}>60+ (Good)</option>
              <option value={70}>70+ (Excellent)</option>
              <option value={80}>80+ (Priority)</option>
            </select>
          </div>

          {/* Map or Table View */}
          {viewMap ? (
            <div className="w-full h-[500px] rounded-xl overflow-hidden border-2 border-gray-200">
              <MapContainer
                center={[11.0168, 124.6075]}
                zoom={12}
                className="h-full w-full"
                scrollWheelZoom={true}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {filteredSites.map((s) => (
                  <Marker
                    key={s.id}
                    position={s.coords as [number, number]}
                    icon={markerIcon(s.score)}
                  >
                    <Popup>
                      <div className="p-2 min-w-[200px]">
                        <h4 className="font-bold text-gray-800 mb-1">
                          {s.name}
                        </h4>
                        <p className="text-sm text-gray-600 mb-2">
                          📍 {s.location}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            Suitability Score:
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-bold ${
                              s.score >= 70
                                ? "bg-green-100 text-green-700"
                                : s.score >= 50
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-red-100 text-red-700"
                            }`}
                          >
                            {s.score}%
                          </span>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr style={{ backgroundColor: `${COLORS.primary}08` }}>
                    <th
                      className="py-3 px-4 font-semibold"
                      style={{ color: COLORS.primary }}
                    >
                      Site Name
                    </th>
                    <th
                      className="py-3 px-4 font-semibold"
                      style={{ color: COLORS.primary }}
                    >
                      Location
                    </th>
                    <th
                      className="py-3 px-4 font-semibold"
                      style={{ color: COLORS.primary }}
                    >
                      Suitability Score
                    </th>
                    <th
                      className="py-3 px-4 font-semibold"
                      style={{ color: COLORS.primary }}
                    >
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSites.map((s) => (
                    <tr
                      key={s.id}
                      className="border-b hover:bg-green-50/40 transition-colors"
                    >
                      <td className="py-3 px-4 font-medium text-gray-800">
                        {s.name}
                      </td>
                      <td className="py-3 px-4 text-gray-600">{s.location}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-16 bg-gray-200 rounded-full h-2">
                            <div
                              className="h-2 rounded-full transition-all duration-500"
                              style={{
                                width: `${s.score}%`,
                                background:
                                  s.score >= 70
                                    ? COLORS.success
                                    : s.score >= 50
                                      ? COLORS.warning
                                      : COLORS.danger,
                              }}
                            />
                          </div>
                          <span
                            className="font-semibold"
                            style={{ color: COLORS.primary }}
                          >
                            {s.score}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <button className="px-4 py-1.5 rounded-lg text-xs font-medium transition-colors text-[#0F4A2F] bg-[#0F4A2F10] hover:bg-[#0F4A2F] hover:text-white">
                          Run Analysis
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredSites.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  No sites match your search criteria. Try adjusting filters.
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* ================= FOOTER ================= */}
      <footer className="mt-8 py-6 px-6 text-center text-gray-500 text-sm border-t border-gray-200">
        <p>🌿 PLANTSCOPE • GIS-Based Reforestation Monitoring • Ormoc City</p>
        <p className="mt-1">
          Data updated:{" "}
          {new Date().toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
          })}
        </p>
      </footer>
    </div>
  );
}
