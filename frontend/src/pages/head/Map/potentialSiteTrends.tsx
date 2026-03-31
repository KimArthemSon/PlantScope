// frontend/src/components/PotentialSiteTrends.tsx

import { useState, useEffect } from "react";
import {
  X,
  Calendar,
  Activity,
  Loader2,
  TrendingDown,
  TrendingUp,
  Minus,
} from "lucide-react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

interface PotentialSiteTrendsProps {
  isOpen: boolean;
  onClose: () => void;
  siteGeometry: any; // GeoJSON geometry
  siteId: string;
  siteName?: string;
  token: string | null;
}

interface TrendDataPoint {
  date: string;
  ndvi: number;
}

export default function PotentialSiteTrends({
  isOpen,
  onClose,
  siteGeometry,
  siteId,
  siteName,
  token,
}: PotentialSiteTrendsProps) {
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [interval, setInterval] = useState<"month" | "week">("month");
  const [isLoading, setIsLoading] = useState(false);
  const [trendData, setTrendData] = useState<TrendDataPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [trendDirection, setTrendDirection] = useState<string>("");
  const [interpretation, setInterpretation] = useState<string>("");

  // Set default dates (last 5 months) when modal opens
  useEffect(() => {
    if (isOpen) {
      const today = new Date();
      const end = new Date(today);
      const start = new Date(today);
      start.setMonth(start.getMonth() - 5);

      // Format as YYYY-MM-DD
      const formatDate = (date: Date) => date.toISOString().split("T")[0];

      setEndDate(formatDate(end));
      setStartDate(formatDate(start));
      setTrendData([]);
      setError(null);
      setTrendDirection("");
      setInterpretation("");
    }
  }, [isOpen]);

  const fetchTrendData = async () => {
    if (!startDate || !endDate || !siteGeometry) {
      setError("Please select valid dates and ensure geometry is available");
      return;
    }

    // ✅ Validate dates aren't in future
    const today = new Date().toISOString().split("T")[0];
    if (endDate > today) {
      setError("End date cannot be in the future. Please select valid dates.");
      return;
    }
    if (startDate > today) {
      setError(
        "Start date cannot be in the future. Please select valid dates.",
      );
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("http://127.0.0.1:8000/api/ndvi-trend/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({
          start: startDate,
          end: endDate,
          geometry: siteGeometry,
          interval: interval,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch trend data");
      }

      if (data.success && data.data) {
        // Transform API response to chart-friendly format
        const transformedData: TrendDataPoint[] = data.data.dates.map(
          (date: string, index: number) => ({
            date,
            ndvi: data.data.values[index],
          }),
        );

        setTrendData(transformedData);
        setTrendDirection(data.data.trend_direction);
        setInterpretation(data.data.interpretation);
      } else {
        throw new Error("Invalid response format from server");
      }
    } catch (err: any) {
      console.error("Trend fetch error:", err);
      setError(err.message || "Failed to load trend data. Please try again.");
      setTrendData([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Prepare chart data
  const chartData = {
    labels: trendData.map((d) => d.date),
    datasets: [
      {
        label: "NDVI Value",
        data: trendData.map((d) => d.ndvi),
        borderColor: "#0f4a2f",
        backgroundColor: "rgba(15, 74, 47, 0.1)",
        borderWidth: 2,
        pointRadius: 4,
        pointBackgroundColor: "#0f4a2f",
        pointHoverRadius: 6,
        fill: true,
        tension: 0.3,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (context: any) => `NDVI: ${context.parsed.y.toFixed(3)}`,
        },
      },
    },
    scales: {
      y: {
        min: 0,
        max: 1,
        title: {
          display: true,
          text: "NDVI Value",
          font: { size: 11 },
        },
        grid: {
          color: "rgba(0, 0, 0, 0.05)",
        },
      },
      x: {
        title: {
          display: true,
          text: interval === "month" ? "Month" : "Week",
          font: { size: 11 },
        },
        grid: {
          display: false,
        },
      },
    },
  };

  // Get trend icon and color
  const getTrendIndicator = () => {
    switch (trendDirection) {
      case "declining":
        return {
          icon: TrendingDown,
          color: "text-red-600",
          label: "Declining",
        };
      case "slightly_declining":
        return {
          icon: TrendingDown,
          color: "text-orange-600",
          label: "Slightly Declining",
        };
      case "increasing":
        return {
          icon: TrendingUp,
          color: "text-green-600",
          label: "Increasing",
        };
      case "stable":
        return { icon: Minus, color: "text-gray-600", label: "Stable" };
      default:
        return { icon: null, color: "", label: "" };
    }
  };

  const trendIndicator = getTrendIndicator();

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[2999] bg-[#0000003d] "
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[3000] w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="bg-[#0f4a2f] text-white px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-lg">📈 NDVI Trend Analysis</h2>
            <p className="text-sm text-gray-200">
              {siteName || siteId} •{" "}
              {interval === "month" ? "Monthly" : "Weekly"} View
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Controls */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-700 flex items-center gap-1">
                <Calendar size={12} /> Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full mt-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f4a2f] focus:border-transparent"
                max={endDate || undefined}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700 flex items-center gap-1">
                <Calendar size={12} /> End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full mt-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f4a2f] focus:border-transparent"
                min={startDate || undefined}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700 flex items-center gap-1">
                <Activity size={12} /> Interval
              </label>
              <select
                value={interval}
                onChange={(e) =>
                  setInterval(e.target.value as "month" | "week")
                }
                className="w-full mt-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f4a2f] focus:border-transparent bg-white"
              >
                <option value="month">Monthly</option>
                <option value="week">Weekly</option>
              </select>
            </div>
          </div>

          {/* Run Button */}
          <button
            onClick={fetchTrendData}
            disabled={isLoading || !startDate || !endDate}
            className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-medium text-sm transition-all
              ${
                isLoading || !startDate || !endDate
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-[#0f4a2f] hover:bg-[#0a3a25] text-white shadow-sm hover:shadow"
              }`}
          >
            {isLoading ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                Analyzing Trend...
              </>
            ) : (
              <>
                <Activity size={16} />
                Run Analysis
              </>
            )}
          </button>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
              ⚠️ {error}
            </div>
          )}

          {/* Trend Summary */}
          {trendData.length > 0 && !error && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                {trendIndicator.icon && (
                  <trendIndicator.icon
                    className={`${trendIndicator.color} mt-0.5 flex-shrink-0`}
                    size={20}
                  />
                )}
                <div>
                  <p className="font-medium text-blue-900">
                    {trendIndicator.label} Trend
                  </p>
                  <p className="text-sm text-blue-800 mt-1">{interpretation}</p>
                </div>
              </div>
            </div>
          )}

          {/* Chart */}
          {trendData.length > 0 && !error && (
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <div className="h-64">
                <Line data={chartData} options={chartOptions} />
              </div>
              <div className="mt-3 text-center text-xs text-gray-500">
                NDVI Range: 0.0 (bare) to 1.0 (dense vegetation) • Threshold for
                suitability: {"<"} 0.41
              </div>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && trendData.length === 0 && !error && (
            <div className="text-center py-8 text-gray-500">
              <Activity size={40} className="mx-auto mb-3 opacity-50" />
              <p className="text-sm">
                Select dates and click "Run Analysis" to view NDVI trend
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
}
