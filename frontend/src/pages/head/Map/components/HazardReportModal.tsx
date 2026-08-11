import { useState, useEffect } from "react";
import {
  X,
  AlertTriangle,
  CheckCircle,
  MapPin,
  Shield,
  Info,
  Database,
  RefreshCw,
  WifiOff,
  Radar as RadarIcon,
  TrendingUp,
  Waves,
  Mountain,
  Activity,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";
import { api } from "@/constant/api.ts";

export interface HazardSeverityData {
  very_high_ha: number;
  high_ha: number;
  moderate_ha: number;
  low_ha: number;
  safe_ha: number;
  very_high_percentage: number;
  high_percentage: number;
  moderate_percentage: number;
  low_percentage: number;
  safe_percentage: number;
}

export interface HazardReportData {
  success?: boolean;
  latest?: boolean;
  total_area_ha: number;
  flood: HazardSeverityData;
  landslide: HazardSeverityData;
  eil: HazardSeverityData;
  data_availability?: {
    flood: boolean;
    landslide: boolean;
    eil: boolean;
  };
  overall_risk: "LOW" | "MODERATE" | "HIGH";
  recommendations: string[];
  seismic_history?: any;
}

interface HazardReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  geometry: any;
  siteName?: string;
}

const FLOOD_COLORS = {
  very_high: "#1e3a8a",
  high: "#2563eb",
  moderate: "#60a5fa",
  low: "#93c5fd",
  safe: "#86efac",
};
const LANDSLIDE_COLORS = {
  very_high: "#dc2626",
  high: "#f97316",
  moderate: "#facc15",
  low: "#4ade80",
  safe: "#86efac",
};
const EIL_COLORS = {
  very_high: "#dc2626",
  high: "#dc2626",
  moderate: "#a855f7",
  low: "#fde047",
  safe: "#86efac",
};

const COLOR_LEGENDS = {
  flood: [
    {
      key: "very_high",
      label: "Very High",
      color: FLOOD_COLORS.very_high,
      restValue: "VHF",
      description:
        "Flood height >2.0m and/or duration >3 days. Perennial flooding; not recommended for planting.",
    },
    {
      key: "high",
      label: "High",
      color: FLOOD_COLORS.high,
      restValue: "HF",
      description:
        "Flood height 1.0-2.0m and/or duration >3 days. Frequent flooding; limit to riparian vegetation.",
    },
    {
      key: "moderate",
      label: "Moderate",
      color: FLOOD_COLORS.moderate,
      restValue: "MF",
      description:
        "Flood height 0.5-1.0m and/or duration 1-3 days. Use flood-resistant species.",
    },
    {
      key: "low",
      label: "Low",
      color: FLOOD_COLORS.low,
      restValue: "LF",
      description:
        "Flood height ≤0.5m and/or duration <1 day. Minimal risk for reforestation activities.",
    },
    {
      key: "safe",
      label: "Safe",
      color: FLOOD_COLORS.safe,
      restValue: "N/A",
      description:
        "No flood susceptibility detected. Suitable for reforestation.",
    },
  ],
  landslide: [
    {
      key: "very_high",
      label: "Very High",
      color: LANDSLIDE_COLORS.very_high,
      restValue: "VHL",
      description:
        "Steep slopes with weak materials. Recent landslides, escarpments, and tension cracks present.",
    },
    {
      key: "high",
      label: "High",
      color: LANDSLIDE_COLORS.high,
      restValue: "HL",
      description:
        "Steep to very steep slopes with weak materials. Numerous old/inactive landslides present.",
    },
    {
      key: "moderate",
      label: "Moderate",
      color: LANDSLIDE_COLORS.moderate,
      restValue: "ML",
      description:
        "Moderately steep slopes. Soil creep and indications of possible landslides present.",
    },
    {
      key: "low",
      label: "Low",
      color: LANDSLIDE_COLORS.low,
      restValue: "LL",
      description:
        "Gently sloping areas with no identified landslides. Stable and safe for reforestation.",
    },
    {
      key: "safe",
      label: "Safe",
      color: LANDSLIDE_COLORS.safe,
      restValue: "N/A",
      description:
        "No landslide susceptibility detected. Suitable for reforestation.",
    },
  ],
  eil: [
    {
      key: "very_high",
      label: "Very High",
      color: EIL_COLORS.very_high,
      restValue: "03",
      description:
        "Steep slopes prone to earthquake-triggered landslides. Avoid structures; use shallow-rooted vegetation only.",
    },
    {
      key: "high",
      label: "High",
      color: EIL_COLORS.high,
      restValue: "03",
      description:
        "Steep slopes prone to earthquake-triggered landslides. Avoid structures; use shallow-rooted vegetation only.",
    },
    {
      key: "moderate",
      label: "Moderate",
      color: EIL_COLORS.moderate,
      restValue: "02",
      description:
        "Areas that may experience landslides during strong earthquakes (Magnitude ≥6.0).",
    },
    {
      key: "low",
      label: "Low",
      color: EIL_COLORS.low,
      restValue: "01",
      description:
        "Areas unlikely to experience earthquake-induced landslides. Generally safe for development.",
    },
    {
      key: "safe",
      label: "Safe",
      color: EIL_COLORS.safe,
      restValue: "N/A",
      description:
        "No earthquake-induced landslide susceptibility detected. Suitable for reforestation.",
    },
  ],
};

const CustomLegend = ({ payload }: any) => {
  return (
    <div className="flex flex-wrap justify-center gap-2 mt-3">
      {payload.map((entry: any, index: number) => (
        <div
          key={`legend-${index}`}
          className="flex items-center gap-1.5 bg-gray-50 px-2.5 py-1 rounded-full border border-gray-100"
        >
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-xs font-medium text-gray-600">
            {entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};

export default function HazardReportModal({
  isOpen,
  onClose,
  geometry,
  siteName,
}: HazardReportModalProps) {
  const [reportData, setReportData] = useState<HazardReportData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && geometry) {
      fetchHazardReport();
    } else {
      setReportData(null);
      setError(null);
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, geometry]);

  const fetchHazardReport = async () => {
    if (!geometry) return;

    setIsLoading(true);
    setError(null);
    setReportData(null);

    if (!navigator.onLine) {
      setError(
        "You appear to be offline. Please check your internet connection and try again.",
      );
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const token = localStorage.getItem("token");

      const response = await fetch(`${api}api/analyze-hazard/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ geometry }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 504 || response.status === 502) {
          throw new Error("NETWORK_TIMEOUT");
        }
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP_ERROR_${response.status}`);
      }

      const result = await response.json();
      setReportData(result);
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error("Hazard Analysis Error:", err);

      if (err.name === "AbortError" || err.message === "NETWORK_TIMEOUT") {
        setError(
          "The request took too long. Your internet connection might be too slow or unstable. Please check your connection and try again.",
        );
      } else if (
        err.name === "TypeError" ||
        err.message?.includes("Failed to fetch")
      ) {
        setError(
          "Network Error: Unable to connect to the server. Please check your internet connection and try again.",
        );
      } else {
        setError(
          err.message ||
            "An unexpected error occurred while generating the report. Please try again.",
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case "HIGH":
        return "bg-red-50 text-red-700 border-red-200";
      case "MODERATE":
        return "bg-amber-50 text-amber-700 border-amber-200";
      default:
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
    }
  };

  const getRiskIconColor = (risk: string) => {
    switch (risk) {
      case "HIGH":
        return "bg-red-100 text-red-600";
      case "MODERATE":
        return "bg-amber-100 text-amber-600";
      default:
        return "bg-emerald-100 text-emerald-600";
    }
  };

  const prepareChartData = (
    hazardData: HazardSeverityData,
    colorPalette: typeof FLOOD_COLORS,
  ) => {
    const segments = [];
    if (hazardData.very_high_ha > 0)
      segments.push({
        name: "Very High",
        value: hazardData.very_high_ha,
        color: colorPalette.very_high,
      });
    if (hazardData.high_ha > 0)
      segments.push({
        name: "High",
        value: hazardData.high_ha,
        color: colorPalette.high,
      });
    if (hazardData.moderate_ha > 0)
      segments.push({
        name: "Moderate",
        value: hazardData.moderate_ha,
        color: colorPalette.moderate,
      });
    if (hazardData.low_ha > 0)
      segments.push({
        name: "Low",
        value: hazardData.low_ha,
        color: colorPalette.low,
      });
    if (hazardData.safe_ha > 0)
      segments.push({
        name: "Safe",
        value: hazardData.safe_ha,
        color: colorPalette.safe,
      });

    if (segments.length === 0 && reportData) {
      segments.push({
        name: "Safe",
        value: reportData.total_area_ha,
        color: colorPalette.safe,
      });
    }
    return segments;
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-xl shadow-xl text-xs">
          <p className="font-bold text-gray-800 mb-1">{data.name}</p>
          <p className="text-gray-600">{data.value.toFixed(2)} ha</p>
          <p className="text-gray-400 mt-0.5">
            {((data.value / data.totalArea) * 100).toFixed(1)}% of total area
          </p>
        </div>
      );
    }
    return null;
  };

  const RadarTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-gray-900 text-white px-4 py-2.5 rounded-xl shadow-2xl text-xs border border-gray-700">
          <p className="font-semibold text-sm">{data.subject}</p>
          <p className="text-gray-300 mt-0.5">
            {data.value.toFixed(1)}% of site area is susceptible
          </p>
        </div>
      );
    }
    return null;
  };

  const ColorLegend = ({
    legends,
    hazardData,
    totalArea,
  }: {
    legends: typeof COLOR_LEGENDS.flood;
    hazardData: HazardSeverityData;
    totalArea: number;
  }) => {
    return (
      <div className="space-y-2">
        {legends.map((item) => {
          let percentage = 0;
          switch (item.key) {
            case "very_high":
              percentage = hazardData.very_high_percentage;
              break;
            case "high":
              percentage = hazardData.high_percentage;
              break;
            case "moderate":
              percentage = hazardData.moderate_percentage;
              break;
            case "low":
              percentage = hazardData.low_percentage;
              break;
            case "safe":
              percentage = hazardData.safe_percentage;
              break;
          }
          if (percentage === 0 && item.key !== "safe") return null;

          return (
            <div
              key={item.key}
              className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100"
            >
              <div
                className="w-4 h-4 rounded-full flex-shrink-0 mt-0.5 border-2 border-white shadow-sm"
                style={{ backgroundColor: item.color }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-gray-700">
                    {item.label}
                  </span>
                  <span className="text-xs font-bold text-gray-900 tabular-nums">
                    {percentage.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1.5">
                  <div
                    className="h-1.5 rounded-full transition-all duration-500"
                    style={{
                      width: `${percentage}%`,
                      backgroundColor: item.color,
                    }}
                  />
                </div>
                <p className="text-[11px] text-gray-500 leading-relaxed mt-1.5">
                  {item.description}
                </p>
                {item.restValue && item.restValue !== "N/A" && (
                  <p className="text-[10px] text-gray-400 mt-1 font-medium">
                    REST Value: {item.restValue}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const radarData = reportData
    ? [
        {
          subject: "Flood",
          value:
            (reportData.flood?.very_high_percentage || 0) +
            (reportData.flood?.high_percentage || 0) +
            (reportData.flood?.moderate_percentage || 0) +
            (reportData.flood?.low_percentage || 0),
          icon: Waves,
          color: "#2563eb",
        },
        {
          subject: "Landslide",
          value:
            (reportData.landslide?.very_high_percentage || 0) +
            (reportData.landslide?.high_percentage || 0) +
            (reportData.landslide?.moderate_percentage || 0) +
            (reportData.landslide?.low_percentage || 0),
          icon: Mountain,
          color: "#f97316",
        },
        {
          subject: "EIL",
          value:
            (reportData.eil?.very_high_percentage || 0) +
            (reportData.eil?.high_percentage || 0) +
            (reportData.eil?.moderate_percentage || 0) +
            (reportData.eil?.low_percentage || 0),
          icon: Activity,
          color: "#a855f7",
        },
      ]
    : [];

  const dominantHazard = radarData.length
    ? radarData.reduce(
        (max, item) => (item.value > max.value ? item : max),
        radarData[0],
      )
    : null;

  // Check if EIL data is unavailable
  const eilUnavailable = reportData?.data_availability?.eil === false;

  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] overflow-y-auto border border-gray-200 flex flex-col">
        {/* --- HEADER --- */}
        <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-gray-200 p-6 flex items-center justify-between z-10 rounded-t-2xl">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-[#0f4a2f] rounded-xl shadow-sm">
              <Shield className="text-white" size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 tracking-tight">
                Hazard Assessment Report
              </h2>
              {siteName && (
                <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-1.5">
                  <MapPin size={13} className="text-gray-400" />
                  Analyzing:{" "}
                  <span className="font-semibold text-[#0f4a2f]">
                    {siteName}
                  </span>
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 hover:bg-gray-100 rounded-xl transition-colors text-gray-400 hover:text-gray-700"
          >
            <X size={22} />
          </button>
        </div>

        <div className="p-6 space-y-8 flex-1 overflow-y-auto">
          {/* ✅ LOADING STATE */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-gray-100 border-t-[#0f4a2f] rounded-full animate-spin" />
                <Database
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[#0f4a2f]"
                  size={24}
                />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mt-6">
                Analyzing Spatial Data
              </h3>
              <p className="text-sm text-gray-500 max-w-md mt-2">
                Intersecting site boundaries with MGB/PHIVOLCS REST feature
                services. This may take a few moments depending on your
                connection.
              </p>
            </div>
          )}

          {/* ✅ NETWORK ERROR STATE */}
          {error && !isLoading && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-4">
                <WifiOff size={40} className="text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">
                Connection Issue
              </h3>
              <p className="text-sm text-gray-600 max-w-md mt-2 mb-6">
                {error}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={fetchHazardReport}
                  className="px-5 py-2.5 text-sm font-medium text-white bg-[#0f4a2f] rounded-xl hover:bg-[#0a3522] transition-colors flex items-center gap-2 shadow-sm"
                >
                  <RefreshCw size={16} /> Retry
                </button>
              </div>
            </div>
          )}

          {/* ✅ SUCCESS STATE (DATA LOADED) */}
          {reportData && !isLoading && !error && (
            <>
              {/* --- TOP STATS ROW --- */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-50/80 p-5 rounded-2xl border border-gray-200/80 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[#0f4a2f]/10 flex items-center justify-center flex-shrink-0">
                    <MapPin size={22} className="text-[#0f4a2f]" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                      Total Area Analyzed
                    </p>
                    <p className="text-2xl font-bold text-gray-900 mt-0.5">
                      {reportData.total_area_ha.toFixed(2)}{" "}
                      <span className="text-sm font-medium text-gray-500">
                        ha
                      </span>
                    </p>
                  </div>
                </div>

                <div className="bg-gray-50/80 p-5 rounded-2xl border border-gray-200/80 flex items-center gap-4">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${getRiskIconColor(reportData.overall_risk)}`}
                  >
                    <AlertTriangle size={22} />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                      Overall Risk Level
                    </p>
                    <span
                      className={`inline-block mt-1.5 px-4 py-1 rounded-full text-sm font-bold border ${getRiskColor(reportData.overall_risk)}`}
                    >
                      {reportData.overall_risk} RISK
                    </span>
                  </div>
                </div>

                <div className="bg-gray-50/80 p-5 rounded-2xl border border-gray-200/80 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gray-200/80 flex items-center justify-center flex-shrink-0">
                    <TrendingUp size={22} className="text-gray-600" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                      Dominant Hazard
                    </p>
                    <p className="text-lg font-bold text-gray-900 mt-1">
                      {dominantHazard && dominantHazard.value > 0
                        ? dominantHazard.subject
                        : "None Detected"}
                    </p>
                    {dominantHazard && dominantHazard.value > 0 && (
                      <p className="text-xs text-gray-500 font-medium">
                        {dominantHazard.value.toFixed(1)}% susceptible
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* ============================================================ */}
              {/* ✅ ADVANCED ANALYTICS (Radar Chart)                          */}
              {/* ============================================================ */}
              <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                    <RadarIcon size={18} className="text-[#0f4a2f]" />
                    Composite Risk Profile
                  </h3>
                  {dominantHazard && dominantHazard.value > 0 && (
                    <span className="text-xs font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                      Highest: {dominantHazard.subject} (
                      {dominantHazard.value.toFixed(1)}%)
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mb-6">
                  Share of site area with any susceptibility per hazard type
                  (0–100%).
                </p>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
                  {/* Radar Chart */}
                  <div className="lg:col-span-2 h-[340px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart
                        data={radarData}
                        cx="50%"
                        cy="50%"
                        outerRadius="75%"
                      >
                        <defs>
                          <linearGradient
                            id="radarFill"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor="#0f4a2f"
                              stopOpacity={0.35}
                            />
                            <stop
                              offset="100%"
                              stopColor="#0f4a2f"
                              stopOpacity={0.05}
                            />
                          </linearGradient>
                        </defs>
                        <PolarGrid stroke="#e5e7eb" strokeDasharray="4 4" />
                        <PolarAngleAxis
                          dataKey="subject"
                          tick={{
                            fontSize: 13,
                            fill: "#374151",
                            fontWeight: 600,
                          }}
                        />
                        <PolarRadiusAxis
                          angle={90}
                          domain={[0, 100]}
                          tick={{ fontSize: 11, fill: "#9ca3af" }}
                          tickCount={6}
                          stroke="#e5e7eb"
                        />
                        <Radar
                          name="Susceptibility %"
                          dataKey="value"
                          stroke="#0f4a2f"
                          strokeWidth={2.5}
                          fill="url(#radarFill)"
                        />
                        <Tooltip content={<RadarTooltip />} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Mini Hazard Stats */}
                  <div className="space-y-3">
                    {radarData.map((item) => {
                      const Icon = item.icon;
                      const isEilNoData =
                        item.subject === "EIL" && eilUnavailable;
                      return (
                        <div
                          key={item.subject}
                          className={`p-4 rounded-xl border ${isEilNoData ? "border-amber-200 bg-amber-50/50" : "border-gray-100 bg-gray-50/50"} hover:bg-gray-50 transition-colors`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Icon size={16} style={{ color: item.color }} />
                              <span className="text-sm font-semibold text-gray-700">
                                {item.subject}
                              </span>
                              {isEilNoData && (
                                <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
                                  NO DATA
                                </span>
                              )}
                            </div>
                            <span className="text-sm font-bold text-gray-900 tabular-nums">
                              {isEilNoData ? "—" : `${item.value.toFixed(1)}%`}
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="h-2 rounded-full transition-all duration-700"
                              style={{
                                width: isEilNoData ? "0%" : `${item.value}%`,
                                backgroundColor: item.color,
                              }}
                            />
                          </div>
                          <p className="text-[11px] text-gray-400 mt-1.5">
                            {isEilNoData
                              ? "Service unavailable — see map overlay"
                              : item.value > 50
                                ? "Majority of area is susceptible"
                                : item.value > 0
                                  ? "Partial susceptibility detected"
                                  : "No susceptibility detected"}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* --- DATA SOURCE DISCLAIMER --- */}
              <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <Database
                    size={18}
                    className="text-blue-500 mt-0.5 flex-shrink-0"
                  />
                  <div>
                    <p className="text-sm font-bold text-blue-800">
                      Data Source
                    </p>
                    <p className="text-xs text-blue-600 mt-0.5">
                      MGB/PHIVOLCS REST Feature Service
                    </p>
                    <p className="text-[11px] text-blue-500/80 mt-1 leading-relaxed">
                      Percentages are calculated from feature data intersecting
                      the selected polygon. Map tile layers are for visual
                      reference only.
                    </p>
                  </div>
                </div>
              </div>

              {/* --- CHARTS + LEGENDS ROW --- */}
              <div className="space-y-6">
                {/* Flood Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="relative">
                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 rounded-l" />
                    <div className="pl-4">
                      <h3 className="text-sm font-bold text-gray-800 mb-1 flex items-center gap-2">
                        <Waves size={16} className="text-blue-500" />
                        Flood Susceptibility
                      </h3>
                      <p className="text-xs text-gray-400 mb-4">
                        Rain-induced and fluvial flood hazard assessment
                      </p>
                      <div className="h-[220px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={prepareChartData(
                                reportData.flood,
                                FLOOD_COLORS,
                              ).map((d) => ({
                                ...d,
                                totalArea: reportData.total_area_ha,
                              }))}
                              cx="50%"
                              cy="50%"
                              innerRadius={55}
                              outerRadius={80}
                              paddingAngle={4}
                              dataKey="value"
                              stroke="none"
                            >
                              {prepareChartData(
                                reportData.flood,
                                FLOOD_COLORS,
                              ).map((entry, index) => (
                                <Cell
                                  key={`cell-flood-${index}`}
                                  fill={entry.color}
                                />
                              ))}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                            <Legend content={<CustomLegend />} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex items-center justify-center gap-2 mt-2">
                        <span className="text-xs font-semibold text-gray-500">
                          Susceptible Area:
                        </span>
                        <span className="text-xs font-bold text-blue-600">
                          {(
                            reportData.flood.very_high_percentage +
                            reportData.flood.high_percentage +
                            reportData.flood.moderate_percentage +
                            reportData.flood.low_percentage
                          ).toFixed(1)}
                          %
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Info size={12} /> Severity Breakdown
                    </h4>
                    <div className="flex-1 overflow-y-auto max-h-[280px] pr-1 custom-scrollbar">
                      <ColorLegend
                        legends={COLOR_LEGENDS.flood}
                        hazardData={reportData.flood}
                        totalArea={reportData.total_area_ha}
                      />
                    </div>
                  </div>
                </div>

                {/* Landslide Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="relative">
                    <div className="absolute top-0 left-0 w-1 h-full bg-orange-500 rounded-l" />
                    <div className="pl-4">
                      <h3 className="text-sm font-bold text-gray-800 mb-1 flex items-center gap-2">
                        <Mountain size={16} className="text-orange-500" />
                        Rain-Induced Landslide
                      </h3>
                      <p className="text-xs text-gray-400 mb-4">
                        Slope stability and soil saturation hazard assessment
                      </p>
                      <div className="h-[220px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={prepareChartData(
                                reportData.landslide,
                                LANDSLIDE_COLORS,
                              ).map((d) => ({
                                ...d,
                                totalArea: reportData.total_area_ha,
                              }))}
                              cx="50%"
                              cy="50%"
                              innerRadius={55}
                              outerRadius={80}
                              paddingAngle={4}
                              dataKey="value"
                              stroke="none"
                            >
                              {prepareChartData(
                                reportData.landslide,
                                LANDSLIDE_COLORS,
                              ).map((entry, index) => (
                                <Cell
                                  key={`cell-landslide-${index}`}
                                  fill={entry.color}
                                />
                              ))}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                            <Legend content={<CustomLegend />} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex items-center justify-center gap-2 mt-2">
                        <span className="text-xs font-semibold text-gray-500">
                          Susceptible Area:
                        </span>
                        <span className="text-xs font-bold text-orange-600">
                          {(
                            reportData.landslide.very_high_percentage +
                            reportData.landslide.high_percentage +
                            reportData.landslide.moderate_percentage +
                            reportData.landslide.low_percentage
                          ).toFixed(1)}
                          %
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Info size={12} /> Severity Breakdown
                    </h4>
                    <div className="flex-1 overflow-y-auto max-h-[280px] pr-1 custom-scrollbar">
                      <ColorLegend
                        legends={COLOR_LEGENDS.landslide}
                        hazardData={reportData.landslide}
                        totalArea={reportData.total_area_ha}
                      />
                    </div>
                  </div>
                </div>

                {/* EIL Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="relative">
                    <div className="absolute top-0 left-0 w-1 h-full bg-purple-500 rounded-l" />
                    <div className="pl-4">
                      <h3 className="text-sm font-bold text-gray-800 mb-1 flex items-center gap-2">
                        <Activity size={16} className="text-purple-500" />
                        Earthquake-Induced Landslide
                        {eilUnavailable && (
                          <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full ml-2">
                            NO DATA
                          </span>
                        )}
                      </h3>
                      <p className="text-xs text-gray-400 mb-4">
                        Seismic-triggered slope failure hazard assessment
                      </p>
                      {eilUnavailable ? (
                        <div className="h-[220px] flex flex-col items-center justify-center text-center px-6 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                          <WifiOff size={32} className="text-gray-300 mb-3" />
                          <p className="text-sm font-semibold text-gray-600">
                            No EIL Data Available
                          </p>
                          <p className="text-xs text-gray-400 mt-2 leading-relaxed max-w-xs">
                            The PHIVOLCS EIL feature service is not returning
                            data (server limitation). Refer to the official
                            PHIVOLCS EIL map overlay on the main map for visual
                            reference.
                          </p>
                        </div>
                      ) : (
                        <div className="h-[220px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={prepareChartData(
                                  reportData.eil,
                                  EIL_COLORS,
                                ).map((d) => ({
                                  ...d,
                                  totalArea: reportData.total_area_ha,
                                }))}
                                cx="50%"
                                cy="50%"
                                innerRadius={55}
                                outerRadius={80}
                                paddingAngle={4}
                                dataKey="value"
                                stroke="none"
                              >
                                {prepareChartData(
                                  reportData.eil,
                                  EIL_COLORS,
                                ).map((entry, index) => (
                                  <Cell
                                    key={`cell-eil-${index}`}
                                    fill={entry.color}
                                  />
                                ))}
                              </Pie>
                              <Tooltip content={<CustomTooltip />} />
                              <Legend content={<CustomLegend />} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                      {!eilUnavailable && (
                        <div className="flex items-center justify-center gap-2 mt-2">
                          <span className="text-xs font-semibold text-gray-500">
                            Susceptible Area:
                          </span>
                          <span className="text-xs font-bold text-purple-600">
                            {(
                              reportData.eil.very_high_percentage +
                              reportData.eil.high_percentage +
                              reportData.eil.moderate_percentage +
                              reportData.eil.low_percentage
                            ).toFixed(1)}
                            %
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Info size={12} /> Severity Breakdown
                    </h4>
                    <div className="flex-1 overflow-y-auto max-h-[280px] pr-1 custom-scrollbar">
                      <ColorLegend
                        legends={eilUnavailable ? [] : COLOR_LEGENDS.eil}
                        hazardData={reportData.eil}
                        totalArea={reportData.total_area_ha}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* --- RECOMMENDATIONS --- */}
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6">
                <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <AlertTriangle size={18} className="text-gray-600" />
                  System Recommendations
                </h3>
                <ul className="space-y-3">
                  {reportData.recommendations.map((rec, idx) => {
                    const isWarning = rec.includes("⚠️");
                    return (
                      <li
                        key={idx}
                        className={`flex items-start gap-3 text-sm text-gray-700 bg-white p-4 rounded-xl border-l-4 shadow-sm ${
                          isWarning
                            ? "border-l-amber-400"
                            : "border-l-emerald-400"
                        }`}
                      >
                        {isWarning ? (
                          <AlertTriangle
                            size={18}
                            className="mt-0.5 flex-shrink-0 text-amber-500"
                          />
                        ) : (
                          <CheckCircle
                            size={18}
                            className="mt-0.5 flex-shrink-0 text-emerald-500"
                          />
                        )}
                        <span className="leading-relaxed">
                          {rec.replace("⚠️ ", "").replace("✅ ", "")}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* --- FOOTER DISCLAIMER --- */}
              <div className="text-center text-[11px] text-gray-400 border-t border-gray-100 pt-5 pb-2">
                <p>
                  Report generated using MGB/PHIVOLCS REST Feature Service data.
                  Map tile layers are for visual reference only.
                </p>
                <p className="mt-1">
                  © {new Date().getFullYear()} PlantScope • ENRO Ormoc City
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
