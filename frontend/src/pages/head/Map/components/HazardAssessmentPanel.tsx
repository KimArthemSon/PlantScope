import { useState } from "react";
import { Shield, Eye, EyeOff, Info, Map } from "lucide-react";

interface HazardAssessmentPanelProps {
  isOpen: boolean;
  start: string;
  end: string;
  setStart: (val: string) => void;
  setEnd: (val: string) => void;

  // MGB Official Maps Props
  showMgbFlood: boolean;
  setShowMgbFlood: (val: boolean) => void;
  showMgbLandslide: boolean;
  setShowMgbLandslide: (val: boolean) => void;

  showEil: boolean;
  setShowEil: (val: boolean) => void;

  // FIRMS Props
  showFirms: boolean;
  setShowFirms: (val: boolean) => void;
  firmsTimeRange: "today" | "24hrs" | "7days";
  setFirmsTimeRange: (val: "today" | "24hrs" | "7days") => void;
  fireCount: number;
  onFetchFirmsData: () => void;
  onToggleFirms: () => void;
  onUpdateFirmsTimeRange: (range: "today" | "24hrs" | "7days") => void;

  // NEW: Custom Date Range Props
  firmsStartDate: string;
  setFirmsStartDate: (val: string) => void;
  firmsEndDate: string;
  setFirmsEndDate: (val: string) => void;
  useCustomDateRange: boolean;
  setUseCustomDateRange: (val: boolean) => void;
  onApplyCustomDateRange: () => void;

  // ✅ NEW: Loading State Prop
  isFirmsLoading: boolean;
}

// 🏛️ Official MGB & PHIVOLCS Guide Data
const officialGuides = {
  mgbFlood: {
    title: "MGB Flood Susceptibility Guide",
    subtitle: "Official MGB Definitions (Based on Flood Height & Duration)",
    items: [
      {
        class: "Low Susceptibility",
        color: "bg-blue-200",
        desc: "Flood height ≤0.5m and/or duration <1 day. Minimal risk for reforestation activities.",
      },
      {
        class: "Moderate Susceptibility",
        color: "bg-blue-400",
        desc: "Flood height 0.5-1.0m and/or duration 1-3 days. Use flood-resistant species.",
      },
      {
        class: "High Susceptibility",
        color: "bg-blue-600",
        desc: "Flood height 1.0-2.0m and/or duration >3 days. Frequent flooding; limit to riparian vegetation.",
      },
      {
        class: "Very High Susceptibility",
        color: "bg-blue-800",
        desc: "Flood height >2.0m and/or duration >3 days. Perennial flooding; not recommended for planting.",
      },
    ],
  },
  mgbLandslide: {
    title: "MGB Rain-Induced Landslide Guide",
    subtitle: "Official MGB Definitions (Based on Slope & Materials)",
    items: [
      {
        class: "Low Susceptibility",
        color: "bg-green-400",
        desc: "Gently sloping areas with no identified landslides. Stable and safe for reforestation.",
      },
      {
        class: "Moderate Susceptibility",
        color: "bg-yellow-500",
        desc: "Moderately steep slopes. Soil creep and indications of possible landslides present.",
      },
      {
        class: "High Susceptibility",
        color: "bg-orange-500",
        desc: "Steep to very steep slopes with weak materials. Numerous old/inactive landslides present.",
      },
      {
        class: "Very High Susceptibility",
        color: "bg-red-600",
        desc: "Steep to very steep slopes with weak materials. Recent landslides, escarpments, and tension cracks present.",
      },
    ],
  },
  eil: {
    title: "PHIVOLCS Earthquake-Induced Landslide Guide",
    subtitle: "Official PHIVOLCS Definitions (Based on Earthquake Magnitude)",
    items: [
      {
        class: "Low Susceptibility",
        color: "bg-yellow-300",
        desc: "Areas unlikely to experience earthquake-induced landslides. Generally safe for development.",
      },
      {
        class: "Moderate Susceptibility",
        color: "bg-purple-400",
        desc: "Areas that may experience landslides during strong earthquakes (Magnitude ≥6.0).",
      },
      {
        class: "High Susceptibility",
        color: "bg-red-500",
        desc: "Steep slopes prone to earthquake-triggered landslides. Avoid structures; use shallow-rooted vegetation only.",
      },
    ],
  },
};

export default function HazardAssessmentPanel({
  isOpen,
  start,
  end,
  setStart,
  setEnd,
  showMgbFlood,
  setShowMgbFlood,
  showMgbLandslide,
  setShowMgbLandslide,
  showEil,
  setShowEil,
  showFirms,
  setShowFirms,
  firmsTimeRange,
  setFirmsTimeRange,
  fireCount,
  onFetchFirmsData,
  onToggleFirms,
  onUpdateFirmsTimeRange,
  firmsStartDate,
  setFirmsStartDate,
  firmsEndDate,
  setFirmsEndDate,
  useCustomDateRange,
  setUseCustomDateRange,
  onApplyCustomDateRange,
  isFirmsLoading, // ✅ NEW
}: HazardAssessmentPanelProps) {
  const [activeInfo, setActiveInfo] = useState<
    "mgbFlood" | "mgbLandslide" | "eil" | "firms" | null
  >(null);

  if (!isOpen) return null;

  const OfficialInfoGuide = ({
    type,
  }: {
    type: "mgbFlood" | "mgbLandslide" | "eil";
  }) => {
    const guide = officialGuides[type];
    return (
      <div className="mt-2 p-2 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-300 rounded-md text-[.6rem] text-gray-700 space-y-2 shadow-inner">
        <div className="border-b border-blue-200 pb-1 mb-2">
          <p className="font-bold text-blue-900 text-[.65rem] flex items-center gap-1">
            <Map size={10} /> {guide.title}
          </p>
          <p className="text-[.55rem] text-blue-600 italic">{guide.subtitle}</p>
        </div>
        {guide.items.map((item, idx) => (
          <div
            key={idx}
            className="flex gap-2 items-start bg-white/50 p-1.5 rounded"
          >
            <div
              className={`w-3 h-3 mt-0.5 rounded-sm flex-shrink-0 border border-gray-300 ${item.color}`}
            ></div>
            <div>
              <span className="font-bold text-gray-800 text-[.62rem]">
                {item.class}:
              </span>
              <p className="text-gray-600 mt-0.5 leading-tight">{item.desc}</p>
            </div>
          </div>
        ))}
        <div className="mt-2 pt-2 border-t border-blue-200 text-[.55rem] text-blue-700 italic">
          Source:{" "}
          {type === "eil"
            ? "PHIVOLCS (Philippine Institute of Volcanology and Seismology)"
            : "MGB (Mines and Geosciences Bureau) - Official Hazard Maps"}
        </div>
      </div>
    );
  };

  return (
    <div className="absolute bottom-14 right-0 w-[18rem] max-h-[80vh] overflow-y-auto flex flex-col gap-3 p-3 bg-white border border-[#0f4a2fe0] rounded-lg shadow-2xl z-[1001]">
      {/* Header */}
      <div className="text-center font-bold w-full p-1.5 bg-[#0f4a2fe0] rounded-md">
        <h1 className="text-white text-sm flex items-center justify-center gap-2">
          <Shield size={16} /> Hazard Assessment
        </h1>
      </div>

      {/* Official Gov Maps Section */}
      <div className="border-b border-gray-200 pb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Map size={12} className="text-blue-600" />
            <span className="text-[.7rem] font-bold text-blue-800">
              Official Gov Maps
            </span>
            <span className="text-[.5rem] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-bold">
              FREE
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <button
            onClick={() => setShowMgbFlood(!showMgbFlood)}
            className={`flex items-center justify-between w-full h-8 px-2 rounded-md text-[.65rem] font-medium transition-all ${
              showMgbFlood
                ? "bg-blue-600 text-white shadow-md"
                : "bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
            }`}
          >
            <span className="flex items-center gap-1.5">
              {showMgbFlood ? <Eye size={12} /> : <EyeOff size={12} />}
              🌊 MGB Flood Map
            </span>
            {showMgbFlood && (
              <span className="text-[.5rem] bg-white/20 px-1.5 py-0.5 rounded">
                ON
              </span>
            )}
          </button>

          <button
            onClick={() => setShowMgbLandslide(!showMgbLandslide)}
            className={`flex items-center justify-between w-full h-8 px-2 rounded-md text-[.65rem] font-medium transition-all ${
              showMgbLandslide
                ? "bg-orange-600 text-white shadow-md"
                : "bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100"
            }`}
          >
            <span className="flex items-center gap-1.5">
              {showMgbLandslide ? <Eye size={12} /> : <EyeOff size={12} />}
              ⛰️ MGB Rain-Landslide
            </span>
            {showMgbLandslide && (
              <span className="text-[.5rem] bg-white/20 px-1.5 py-0.5 rounded">
                ON
              </span>
            )}
          </button>

          <button
            onClick={() => setShowEil(!showEil)}
            className={`flex items-center justify-between w-full h-8 px-2 rounded-md text-[.65rem] font-medium transition-all ${
              showEil
                ? "bg-purple-600 text-white shadow-md"
                : "bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100"
            }`}
          >
            <span className="flex items-center gap-1.5">
              {showEil ? <Eye size={12} /> : <EyeOff size={12} />}
              🌋 PHIVOLCS Quake Landslide
            </span>
            {showEil && (
              <span className="text-[.5rem] bg-white/20 px-1.5 py-0.5 rounded">
                ON
              </span>
            )}
          </button>
        </div>

        {/* Official Maps Info Guides */}
        <div className="mt-2 space-y-2">
          <button
            onClick={() =>
              setActiveInfo(activeInfo === "mgbFlood" ? null : "mgbFlood")
            }
            className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-[.62rem] font-medium transition-all ${
              activeInfo === "mgbFlood"
                ? "bg-blue-100 text-blue-700 border border-blue-300"
                : "bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Info size={10} /> MGB Flood Guide
            </span>
            <span className="text-[.5rem]">
              {activeInfo === "mgbFlood" ? "▲" : "▼"}
            </span>
          </button>
          {activeInfo === "mgbFlood" && <OfficialInfoGuide type="mgbFlood" />}

          <button
            onClick={() =>
              setActiveInfo(
                activeInfo === "mgbLandslide" ? null : "mgbLandslide",
              )
            }
            className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-[.62rem] font-medium transition-all ${
              activeInfo === "mgbLandslide"
                ? "bg-orange-100 text-orange-700 border border-orange-300"
                : "bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Info size={10} /> MGB Landslide Guide
            </span>
            <span className="text-[.5rem]">
              {activeInfo === "mgbLandslide" ? "▲" : "▼"}
            </span>
          </button>
          {activeInfo === "mgbLandslide" && (
            <OfficialInfoGuide type="mgbLandslide" />
          )}

          <button
            onClick={() => setActiveInfo(activeInfo === "eil" ? null : "eil")}
            className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-[.62rem] font-medium transition-all ${
              activeInfo === "eil"
                ? "bg-purple-100 text-purple-700 border border-purple-300"
                : "bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Info size={10} /> PHIVOLCS EIL Guide
            </span>
            <span className="text-[.5rem]">
              {activeInfo === "eil" ? "▲" : "▼"}
            </span>
          </button>
          {activeInfo === "eil" && <OfficialInfoGuide type="eil" />}
        </div>

        <p className="text-[.55rem] text-gray-500 mt-2 italic">
          Official maps from MGB & PHIVOLCS. No computation needed.
        </p>
      </div>

      {/* ================= NASA FIRMS SECTION ================= */}
      <div className="border-t border-gray-200 pt-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Map size={12} className="text-red-600" />
            <span className="text-[.7rem] font-bold text-red-800">
              NASA FIRMS - Live Fires
            </span>
            <span className="text-[.5rem] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-bold">
              LIVE
            </span>
          </div>
        </div>

        {/* ✅ UPDATED: Button with Loading State */}
        <button
          onClick={() => onToggleFirms()}
          disabled={isFirmsLoading}
          className={`flex items-center justify-between w-full h-8 px-2 rounded-md text-[.65rem] font-medium transition-all ${
            showFirms
              ? "bg-red-600 text-white shadow-md"
              : "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
          } ${isFirmsLoading ? "opacity-70 cursor-not-allowed" : ""}`}
        >
          <span className="flex items-center gap-1.5">
            {isFirmsLoading ? (
              <svg
                className="animate-spin h-3 w-3 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            ) : showFirms ? (
              <Eye size={12} />
            ) : (
              <EyeOff size={12} />
            )}
            {isFirmsLoading ? "Loading Fires..." : "🔥 Active Fire Hotspots"}
          </span>
          {showFirms && !isFirmsLoading && (
            <span className="text-[.5rem] bg-white/20 px-1.5 py-0.5 rounded">
              {fireCount} fires
            </span>
          )}
        </button>

        {showFirms && !isFirmsLoading && (
          <div className="mt-2 space-y-2">
            {/* Preset Time Range Buttons */}
            <div className="flex gap-1">
              {(["today", "24hrs", "7days"] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => {
                    setUseCustomDateRange(false);
                    onUpdateFirmsTimeRange(range);
                  }}
                  className={`flex-1 text-[.6rem] py-1 px-1 rounded transition-all ${
                    firmsTimeRange === range && !useCustomDateRange
                      ? "bg-red-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {range === "today"
                    ? "TODAY"
                    : range === "24hrs"
                      ? "24H"
                      : "7D"}
                </button>
              ))}
            </div>

            {/* Custom Date Range Toggle */}
            <button
              onClick={() => setUseCustomDateRange(!useCustomDateRange)}
              className={`w-full text-[.6rem] py-1.5 px-2 rounded-md transition-all flex items-center justify-center gap-1 ${
                useCustomDateRange
                  ? "bg-red-100 text-red-700 border border-red-300"
                  : "bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100"
              }`}
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              {useCustomDateRange ? "Hide Date Range" : "Custom Date Range"}
            </button>

            {/* Custom Date Range Inputs */}
            {useCustomDateRange && (
              <div className="bg-red-50 border border-red-200 rounded-md p-2 space-y-2">
                <div>
                  <label className="text-[.55rem] text-gray-600 block mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={firmsStartDate}
                    onChange={(e) => setFirmsStartDate(e.target.value)}
                    disabled={isFirmsLoading} // ✅ Disable while loading
                    className="w-full text-[.6rem] p-1 border border-red-200 rounded bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                    max={new Date().toISOString().split("T")[0]}
                  />
                </div>
                <div>
                  <label className="text-[.55rem] text-gray-600 block mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={firmsEndDate}
                    onChange={(e) => setFirmsEndDate(e.target.value)}
                    disabled={isFirmsLoading} // ✅ Disable while loading
                    className="w-full text-[.6rem] p-1 border border-red-200 rounded bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                    max={new Date().toISOString().split("T")[0]}
                  />
                </div>
                {/* ✅ UPDATED: Apply Date Range Button with Loading Animation */}
                <button
                  onClick={onApplyCustomDateRange}
                  disabled={isFirmsLoading}
                  className={`w-full text-[.6rem] font-medium py-1.5 px-2 rounded-md transition-colors flex items-center justify-center gap-1.5 ${
                    isFirmsLoading
                      ? "bg-red-300 text-white cursor-not-allowed"
                      : "bg-red-600 hover:bg-red-700 text-white"
                  }`}
                >
                  {isFirmsLoading ? (
                    <>
                      <svg
                        className="animate-spin h-3 w-3 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      <span>Applying...</span>
                    </>
                  ) : (
                    <>
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <rect
                          x="3"
                          y="4"
                          width="18"
                          height="18"
                          rx="2"
                          ry="2"
                        ></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                      </svg>
                      <span>Apply Date Range</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Fire Info */}
            <div className="bg-red-50 border border-red-200 rounded p-2 text-[.6rem]">
              <div className="flex items-center justify-between mb-1">
                <span className="text-gray-600">Active Fires:</span>
                <span className="font-bold text-red-700">{fireCount}</span>
              </div>
              <div className="text-gray-500 text-[.55rem]">
                Source: NASA VIIRS/MODIS
              </div>
              {useCustomDateRange && (
                <div className="mt-1 text-[.55rem] text-red-700 font-medium">
                  📅 {firmsStartDate} to {firmsEndDate}
                </div>
              )}
              <div className="mt-1 text-[.55rem] text-gray-600 italic">
                ⚠️ Fire hotspots detected by satellite
              </div>
            </div>

            {/* FIRMS Guide */}
            <button
              onClick={() =>
                setActiveInfo(activeInfo === "firms" ? null : "firms")
              }
              className="w-full flex items-center justify-between px-2 py-1.5 rounded-md text-[.62rem] font-medium bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200"
            >
              <span className="flex items-center gap-1.5">
                <Info size={10} /> Fire Detection Guide
              </span>
              <span className="text-[.5rem]">
                {activeInfo === "firms" ? "▲" : "▼"}
              </span>
            </button>

            {activeInfo === "firms" && (
              <div className="p-2 bg-gradient-to-br from-red-50 to-orange-50 border border-red-200 rounded-md text-[.6rem] space-y-2">
                <p className="font-bold text-red-900 text-[.65rem]">
                  NASA FIRMS Fire Detection
                </p>
                <div className="space-y-1.5">
                  <div className="flex gap-2 items-start">
                    <div className="w-2 h-2 bg-red-600 rounded-full flex-shrink-0"></div>
                    <p className="text-gray-700">
                      <strong>VIIRS:</strong> 375m resolution, detects smaller
                      fires
                    </p>
                  </div>
                  <div className="flex gap-2 items-start">
                    <div className="w-2 h-2 bg-orange-500 rounded-full flex-shrink-0"></div>
                    <p className="text-gray-700">
                      <strong>MODIS:</strong> 1km resolution, broader coverage
                    </p>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-red-200 text-[.55rem] text-red-700">
                  <strong>Update Frequency:</strong> Near real-time (within 3
                  hours)
                </div>
                <div className="text-[.55rem] text-red-600 italic">
                  Source: NASA Fire Information for Resource Management System
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
