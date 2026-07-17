import {
  X,
  AlertTriangle,
  CheckCircle,
  MapPin,
  Shield,
  Download,
  Info,
  Database,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";

// ✅ Updated interface to support 4 severity levels
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
  total_area_ha: number;
  flood: HazardSeverityData;
  landslide: HazardSeverityData;
  eil: HazardSeverityData;
  overall_risk: "LOW" | "MODERATE" | "HIGH";
  recommendations: string[];
}

interface HazardReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: HazardReportData | null;
  siteName?: string;
}

// ✅ Color palettes for each hazard type (Based on REST Data Values)
const FLOOD_COLORS = {
  very_high: "#1e3a8a",  // Dark Blue - VH
  high: "#2563eb",       // Blue - H
  moderate: "#60a5fa",   // Light Blue - M
  low: "#93c5fd",        // Lighter Blue - L
  safe: "#86efac",       // Light Green - Safe
};

const LANDSLIDE_COLORS = {
  very_high: "#dc2626",  // Red - VH
  high: "#f97316",       // Orange - H (HL)
  moderate: "#facc15",   // Yellow - M (ML)
  low: "#4ade80",        // Green - L (LL)
  safe: "#86efac",       // Light Green - Safe
};

const EIL_COLORS = {
  very_high: "#dc2626",  // Red - VH
  high: "#dc2626",       // Red - H
  moderate: "#a855f7",   // Purple - M
  low: "#fde047",        // Yellow - L
  safe: "#86efac",       // Light Green - Safe
};

// ✅ Color legend explanations based on REST values (NOT map colors)
const COLOR_LEGENDS = {
  flood: [
    {
      key: "very_high",
      label: "Very High",
      color: FLOOD_COLORS.very_high,
      restValue: "VH",
      description: "Flood height >2.0m and/or duration >3 days. Perennial flooding; not recommended for planting.",
    },
    {
      key: "high",
      label: "High",
      color: FLOOD_COLORS.high,
      restValue: "H",
      description: "Flood height 1.0-2.0m and/or duration >3 days. Frequent flooding; limit to riparian vegetation.",
    },
    {
      key: "moderate",
      label: "Moderate",
      color: FLOOD_COLORS.moderate,
      restValue: "M",
      description: "Flood height 0.5-1.0m and/or duration 1-3 days. Use flood-resistant species.",
    },
    {
      key: "low",
      label: "Low",
      color: FLOOD_COLORS.low,
      restValue: "L",
      description: "Flood height ≤0.5m and/or duration <1 day. Minimal risk for reforestation activities.",
    },
    {
      key: "safe",
      label: "Safe",
      color: FLOOD_COLORS.safe,
      restValue: "N/A",
      description: "No flood susceptibility detected. Suitable for reforestation.",
    },
  ],
  landslide: [
    {
      key: "very_high",
      label: "Very High",
      color: LANDSLIDE_COLORS.very_high,
      restValue: "VH",
      description: "Steep slopes with weak materials. Recent landslides, escarpments, and tension cracks present.",
    },
    {
      key: "high",
      label: "High",
      color: LANDSLIDE_COLORS.high,
      restValue: "HL",
      description: "Steep to very steep slopes with weak materials. Numerous old/inactive landslides present.",
    },
    {
      key: "moderate",
      label: "Moderate",
      color: LANDSLIDE_COLORS.moderate,
      restValue: "ML",
      description: "Moderately steep slopes. Soil creep and indications of possible landslides present.",
    },
    {
      key: "low",
      label: "Low",
      color: LANDSLIDE_COLORS.low,
      restValue: "LL",
      description: "Gently sloping areas with no identified landslides. Stable and safe for reforestation.",
    },
    {
      key: "safe",
      label: "Safe",
      color: LANDSLIDE_COLORS.safe,
      restValue: "N/A",
      description: "No landslide susceptibility detected. Suitable for reforestation.",
    },
  ],
  eil: [
    {
      key: "very_high",
      label: "Very High",
      color: EIL_COLORS.very_high,
      restValue: "VH",
      description: "Steep slopes prone to earthquake-triggered landslides. Avoid structures; use shallow-rooted vegetation only.",
    },
    {
      key: "high",
      label: "High",
      color: EIL_COLORS.high,
      restValue: "H",
      description: "Steep slopes prone to earthquake-triggered landslides. Avoid structures; use shallow-rooted vegetation only.",
    },
    {
      key: "moderate",
      label: "Moderate",
      color: EIL_COLORS.moderate,
      restValue: "M",
      description: "Areas that may experience landslides during strong earthquakes (Magnitude ≥6.0).",
    },
    {
      key: "low",
      label: "Low",
      color: EIL_COLORS.low,
      restValue: "L",
      description: "Areas unlikely to experience earthquake-induced landslides. Generally safe for development.",
    },
    {
      key: "safe",
      label: "Safe",
      color: EIL_COLORS.safe,
      restValue: "N/A",
      description: "No earthquake-induced landslide susceptibility detected. Suitable for reforestation.",
    },
  ],
};

export default function HazardReportModal({
  isOpen,
  onClose,
  data,
  siteName,
}: HazardReportModalProps) {
  if (!isOpen || !data) return null;

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case "HIGH":
        return "bg-red-100 text-red-700 border-red-200";
      case "MODERATE":
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
      default:
        return "bg-green-100 text-green-700 border-green-200";
    }
  };

  // Prepare multi-segment chart data with hazard-specific colors
  const prepareChartData = (
    hazardData: HazardSeverityData,
    colorPalette: typeof FLOOD_COLORS,
  ) => {
    const segments = [];

    if (hazardData.very_high_ha > 0) {
      segments.push({
        name: "Very High",
        value: hazardData.very_high_ha,
        color: colorPalette.very_high,
      });
    }
    if (hazardData.high_ha > 0) {
      segments.push({
        name: "High",
        value: hazardData.high_ha,
        color: colorPalette.high,
      });
    }
    if (hazardData.moderate_ha > 0) {
      segments.push({
        name: "Moderate",
        value: hazardData.moderate_ha,
        color: colorPalette.moderate,
      });
    }
    if (hazardData.low_ha > 0) {
      segments.push({
        name: "Low",
        value: hazardData.low_ha,
        color: colorPalette.low,
      });
    }
    if (hazardData.safe_ha > 0) {
      segments.push({
        name: "Safe",
        value: hazardData.safe_ha,
        color: colorPalette.safe,
      });
    }

    if (segments.length === 0) {
      segments.push({
        name: "Safe",
        value: data.total_area_ha,
        color: colorPalette.safe,
      });
    }

    return segments;
  };

  const floodChartData = prepareChartData(data.flood, FLOOD_COLORS);
  const landslideChartData = prepareChartData(data.landslide, LANDSLIDE_COLORS);
  const eilChartData = prepareChartData(data.eil, EIL_COLORS);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-2 border border-gray-200 rounded shadow-lg text-xs">
          <p className="font-bold text-gray-700">{data.name}</p>
          <p className="text-gray-600">{data.value.toFixed(2)} ha</p>
          <p className="text-gray-500">
            {((data.value / data.totalArea) * 100).toFixed(1)}%
          </p>
        </div>
      );
    }
    return null;
  };

  // ✅ Color Legend Component for each hazard type
  const ColorLegend = ({
    legends,
    hazardData,
    totalArea,
    hazardType,
  }: {
    legends: typeof COLOR_LEGENDS.flood;
    hazardData: HazardSeverityData;
    totalArea: number;
    hazardType: string;
  }) => {
    return (
      <div className="space-y-1.5">
        {legends.map((item) => {
          // Get the percentage for this severity level
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

          // Only show if there's actually data for this segment
          if (percentage === 0 && item.key !== "safe") return null;

          return (
            <div
              key={item.key}
              className="flex items-start gap-2 p-1.5 rounded hover:bg-gray-50 transition-colors"
            >
              <div
                className="w-4 h-4 rounded-full flex-shrink-0 mt-0.5 border border-gray-200"
                style={{ backgroundColor: item.color }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-700">
                    {item.label}
                  </span>
                  <span className="text-xs font-bold text-gray-900">
                    {percentage.toFixed(1)}%
                  </span>
                </div>
                <p className="text-[10px] text-gray-500 leading-tight mt-0.5">
                  {item.description}
                </p>
                {item.restValue && item.restValue !== "N/A" && (
                  <p className="text-[9px] text-gray-400 mt-0.5">
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

  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto border border-gray-200">
        {/* --- HEADER --- */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#0f4a2f] rounded-lg">
              <Shield className="text-white" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Hazard Assessment Report
              </h2>
              {siteName && (
                <p className="text-sm text-gray-500 mt-0.5">
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
            className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500 hover:text-gray-700"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* --- TOP STATS ROW --- */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <MapPin size={14} /> Total Area Analyzed
              </p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {data.total_area_ha.toFixed(2)}{" "}
                <span className="text-sm font-normal text-gray-500">
                  hectares
                </span>
              </p>
            </div>

            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <AlertTriangle size={14} /> Overall Risk Level
              </p>
              <span
                className={`inline-block mt-2 px-4 py-1.5 rounded-full text-sm font-bold border ${getRiskColor(data.overall_risk)}`}
              >
                {data.overall_risk} RISK
              </span>
            </div>

            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex flex-col justify-center">
              <button
                onClick={() => window.print()}
                className="flex items-center justify-center gap-2 w-full h-full bg-[#0f4a2f] hover:bg-[#0a3522] text-white rounded-lg transition-colors text-sm font-semibold shadow-sm"
              >
                <Download size={16} /> Print / Save as PDF
              </button>
            </div>
          </div>

          {/* --- DATA SOURCE DISCLAIMER --- */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Database size={18} className="text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-blue-800">Data Source</p>
                <p className="text-xs text-blue-700">
                  MGB/PHIVOLCS REST Feature Service
                </p>
                <p className="text-[10px] text-blue-600 mt-1">
                  Percentages are calculated from feature data intersecting the selected polygon.
                  Map tile layers are for visual reference only and may show generalized data.
                  This report uses the official feature service data as the authoritative source.
                </p>
              </div>
            </div>
          </div>

          {/* --- CHARTS + LEGENDS ROW (2-Column Layout) --- */}
          <div className="space-y-6">
            {/* Flood Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <div className="flex flex-col">
                <h3 className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-600"></span>{" "}
                  Flood Susceptibility
                </h3>
                <div className="flex-1 min-h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={floodChartData.map((d) => ({
                          ...d,
                          totalArea: data.total_area_ha,
                        }))}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {floodChartData.map((entry, index) => (
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
                <p className="text-center text-xs text-gray-500 mt-2 font-medium">
                  {(
                    data.flood.very_high_percentage +
                    data.flood.high_percentage +
                    data.flood.moderate_percentage +
                    data.flood.low_percentage
                  ).toFixed(1)}
                  % has flood susceptibility
                </p>
              </div>

              <div className="flex flex-col">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Info size={12} /> Color Legend & Meaning
                </h4>
                <div className="flex-1 overflow-y-auto max-h-[250px] pr-2">
                  <ColorLegend
                    legends={COLOR_LEGENDS.flood}
                    hazardData={data.flood}
                    totalArea={data.total_area_ha}
                    hazardType="flood"
                  />
                </div>
              </div>
            </div>

            {/* Landslide Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <div className="flex flex-col">
                <h3 className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-orange-500"></span>{" "}
                  Rain-Induced Landslide
                </h3>
                <div className="flex-1 min-h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={landslideChartData.map((d) => ({
                          ...d,
                          totalArea: data.total_area_ha,
                        }))}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {landslideChartData.map((entry, index) => (
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
                <p className="text-center text-xs text-gray-500 mt-2 font-medium">
                  {(
                    data.landslide.very_high_percentage +
                    data.landslide.high_percentage +
                    data.landslide.moderate_percentage +
                    data.landslide.low_percentage
                  ).toFixed(1)}
                  % has landslide susceptibility
                </p>
              </div>

              <div className="flex flex-col">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Info size={12} /> Color Legend & Meaning
                </h4>
                <div className="flex-1 overflow-y-auto max-h-[250px] pr-2">
                  <ColorLegend
                    legends={COLOR_LEGENDS.landslide}
                    hazardData={data.landslide}
                    totalArea={data.total_area_ha}
                    hazardType="landslide"
                  />
                </div>
              </div>
            </div>

            {/* EIL Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <div className="flex flex-col">
                <h3 className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-500"></span>{" "}
                  Earthquake-Induced Landslide
                </h3>
                <div className="flex-1 min-h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={eilChartData.map((d) => ({
                          ...d,
                          totalArea: data.total_area_ha,
                        }))}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {eilChartData.map((entry, index) => (
                          <Cell key={`cell-eil-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend content={<CustomLegend />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-center text-xs text-gray-500 mt-2 font-medium">
                  {(
                    data.eil.very_high_percentage +
                    data.eil.high_percentage +
                    data.eil.moderate_percentage +
                    data.eil.low_percentage
                  ).toFixed(1)}
                  % has EIL susceptibility
                </p>
              </div>

              <div className="flex flex-col">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Info size={12} /> Color Legend & Meaning
                </h4>
                <div className="flex-1 overflow-y-auto max-h-[250px] pr-2">
                  <ColorLegend
                    legends={COLOR_LEGENDS.eil}
                    hazardData={data.eil}
                    totalArea={data.total_area_ha}
                    hazardType="eil"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* --- RECOMMENDATIONS --- */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
            <h3 className="text-sm font-bold text-blue-900 mb-3 flex items-center gap-2">
              <AlertTriangle size={18} /> System Recommendations
            </h3>
            <ul className="space-y-3">
              {data.recommendations.map((rec, idx) => {
                const isWarning = rec.includes("⚠️");
                return (
                  <li
                    key={idx}
                    className="flex items-start gap-3 text-sm text-blue-900 bg-white/60 p-3 rounded-lg border border-blue-100"
                  >
                    {isWarning ? (
                      <AlertTriangle
                        size={18}
                        className="mt-0.5 flex-shrink-0 text-yellow-600"
                      />
                    ) : (
                      <CheckCircle
                        size={18}
                        className="mt-0.5 flex-shrink-0 text-green-600"
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
          <div className="text-center text-[10px] text-gray-400 border-t border-gray-100 pt-4">
            <p>
              Report generated using MGB/PHIVOLCS REST Feature Service data.
              Map tile layers are for visual reference only.
            </p>
            <p className="mt-1">
              © {new Date().getFullYear()} PlantScope • ENRO Ormoc City
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ✅ Custom Legend renderer for the charts
const CustomLegend = ({ payload }: any) => {
  return (
    <div className="flex flex-wrap justify-center gap-2 mt-2">
      {payload.map((entry: any, index: number) => (
        <div key={`legend-${index}`} className="flex items-center gap-1">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-xs text-gray-600">{entry.value}</span>
        </div>
      ))}
    </div>
  );
};