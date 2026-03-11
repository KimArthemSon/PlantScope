import { ChevronLeft } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";

// ============ INTERFACES ============
interface SiteData {
  site_data_id: number;
  site_id: number;
  Safety: string;
  safety_status: string;
  legality: boolean;
  legality_status: string;
  soil_quality: string;
  soil_quality_status: string;
  ndvi: string;
  ndvi_status: string;
  distance_to_water_source: number;
  distance_to_water_source_status: string;
  accessibility: string;
  accessibility_status: string;
  wildlife_status: string;
  wildlife_status_multicriteria: string;
  total_score: number;
  created_at?: string;
}

interface CardProps {
  title: string;
  value: string | number | boolean;
  layerKey: string;
  modelField: string;
  options?: string[];
  onSave: (
    layer: string,
    modelField: string,
    value: string | number | boolean,
  ) => Promise<void>;
  status?: string;
  icon?: string;
}

interface FieldAssessment {
  id: number;
  layer: string;
  inspector: {
    name: string;
    email: string;
    avatar: string;
    role: string;
  };
  feedback: string;
  description?: string;
  rating?: number;
  photos?: string[];
  visited_at: string;
  verified?: boolean;
}

// ============ MOCK FIELD ASSESSMENTS (No Backend) ============
const mockAssessments: FieldAssessment[] = [
  {
    id: 1,
    layer: "safety",
    inspector: {
      name: "Maria Santos",
      email: "maria.s@plantscope.gov",
      avatar:
        "https://ui-avatars.com/api/?name=Maria+Santos&background=0D9488&color=fff",
      role: "Field Inspector",
    },
    feedback:
      "Site perimeter is secure. No signs of unauthorized access or hazards detected.",
    description:
      "Conducted perimeter walk-through. All warning signs intact. Emergency access route clear.",
    rating: 5,
    visited_at: "2024-03-10",
    verified: true,
  },
  {
    id: 2,
    layer: "safety",
    inspector: {
      name: "Juan Dela Cruz",
      email: "juan.dc@plantscope.gov",
      avatar:
        "https://ui-avatars.com/api/?name=Juan+Dela+Cruz&background=059669&color=fff",
      role: "Safety Officer",
    },
    feedback:
      "Minor erosion observed on northern slope. Recommend monitoring after heavy rain.",
    rating: 4,
    visited_at: "2024-03-08",
  },
  {
    id: 3,
    layer: "legality",
    inspector: {
      name: "Atty. Elena Reyes",
      email: "elena.reyes@plantscope.gov",
      avatar:
        "https://ui-avatars.com/api/?name=Elena+Reyes&background=7C3AED&color=fff",
      role: "Legal Compliance Officer",
    },
    feedback:
      "All land ownership documents verified. No conflicting claims found.",
    description:
      "Reviewed DENR clearance, LGU endorsement, and land title. All documents valid and current.",
    rating: 5,
    visited_at: "2024-03-12",
    verified: true,
  },
  {
    id: 4,
    layer: "soil_quality",
    inspector: {
      name: "Dr. Roberto Lim",
      email: "roberto.lim@plantscope.gov",
      avatar:
        "https://ui-avatars.com/api/?name=Roberto+Lim&background=047857&color=fff",
      role: "Soil Scientist",
    },
    feedback:
      "Soil pH: 6.2 (optimal). Organic matter: 3.8%. Good structure for reforestation.",
    description:
      "Collected 5 core samples. Lab results show adequate nitrogen (0.15%), phosphorus (12ppm), potassium (180ppm). Minor compaction in Zone B.",
    rating: 5,
    photos: [
      "https://picsum.photos/seed/soil1/200/150",
      "https://picsum.photos/seed/soil2/200/150",
    ],
    visited_at: "2024-03-11",
    verified: true,
  },
  {
    id: 5,
    layer: "soil_quality",
    inspector: {
      name: "Ana Mercado",
      email: "ana.m@plantscope.gov",
      avatar:
        "https://ui-avatars.com/api/?name=Ana+Mercado&background=10B981&color=fff",
      role: "Field Technician",
    },
    feedback:
      "Surface layer shows good moisture retention. Recommend mulching for seedling establishment.",
    rating: 4,
    visited_at: "2024-03-09",
  },
  {
    id: 6,
    layer: "ndvi",
    inspector: {
      name: "GIS Team - Plantscope",
      email: "gis@plantscope.gov",
      avatar:
        "https://ui-avatars.com/api/?name=GIS+Team&background=0891B2&color=fff",
      role: "Remote Sensing Analyst",
    },
    feedback:
      "NDVI avg: 0.42 (moderate vegetation). Healthy canopy cover in 68% of site area.",
    description:
      "Analyzed Sentinel-2 imagery (2024-03-01). Cloud cover <5%. NDVI range: 0.18-0.71. Low values in recently cleared zones expected.",
    rating: 4,
    visited_at: "2024-03-13",
    verified: true,
  },
  {
    id: 7,
    layer: "distance_to_water_source",
    inspector: {
      name: "Carlos Mendez",
      email: "carlos.m@plantscope.gov",
      avatar:
        "https://ui-avatars.com/api/?name=Carlos+Mendez&background=0284C7&color=fff",
      role: "Hydrology Specialist",
    },
    feedback:
      "Nearest perennial stream: 120m. Seasonal creek at 45m (dry season may affect flow).",
    description:
      "GPS-mapped water sources. Stream flow measured at 2.3 L/s. Recommend rainwater harvesting system for dry months.",
    rating: 4,
    visited_at: "2024-03-07",
  },
  {
    id: 8,
    layer: "accessibility",
    inspector: {
      name: "Linda Torres",
      email: "linda.t@plantscope.gov",
      avatar:
        "https://ui-avatars.com/api/?name=Linda+Torres&background=0369A1&color=fff",
      role: "Logistics Coordinator",
    },
    feedback:
      "Main access road passable for 4x4 vehicles. Foot trails need clearing for planting crews.",
    description:
      "Assessed 3 entry points. Primary gate functional. Secondary trail requires brush clearing (~200m). Equipment transport feasible with minor preparations.",
    rating: 4,
    visited_at: "2024-03-10",
  },
  {
    id: 9,
    layer: "wildlife",
    inspector: {
      name: "Dr. Sofia Alvarez",
      email: "sofia.a@plantscope.gov",
      avatar:
        "https://ui-avatars.com/api/?name=Sofia+Alvarez&background=7E22CE&color=fff",
      role: "Wildlife Biologist",
    },
    feedback:
      "Low human disturbance. Observed 3 native bird species. No endangered species conflicts identified.",
    description:
      "Conducted dawn/dusk surveys. Signs of wild pig activity (manageable). Recommended buffer zone near nesting area (marked on map). Planting plan adjusted accordingly.",
    rating: 5,
    photos: ["https://picsum.photos/seed/wildlife1/200/150"],
    visited_at: "2024-03-06",
    verified: true,
  },
];

// ============ MAIN COMPONENT ============
export default function MulticriteriaAnalysis() {
  const { id } = useParams<{ id: string }>();
  const token = localStorage.getItem("token");
  const navigate = useNavigate();

  const [siteData, setSiteData] = useState<SiteData | null>(null);
  const [selectedLayer, setSelectedLayer] = useState<string>("safety");
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  const layers = [
    { key: "safety", label: "Safety", icon: "🛡️" },
    { key: "legality", label: "Legality", icon: "⚖️" },
    { key: "soil_quality", label: "Soil Quality", icon: "🌱" },
    { key: "ndvi", label: "NDVI Index", icon: "📊" },
    { key: "distance_to_water_source", label: "Water Access", icon: "💧" },
    { key: "accessibility", label: "Accessibility", icon: "🚶" },
    { key: "wildlife", label: "Wildlife Impact", icon: "🦌" },
  ];

  const fieldOptions: Record<string, string[]> = {
    safety: ["safe", "slightly", "moderate", "danger"],
    soil_quality: ["very_good", "good", "moderate", "poor", "very_poor"],
    accessibility: ["very_good", "good", "moderate", "poor", "very_poor"],
    wildlife: ["very_good", "good", "moderate", "poor", "very_poor"],
    legality: ["Legal", "Illegal"],
  };

  const layerToModelField: Record<string, string> = {
    safety: "Safety",
    legality: "legality",
    soil_quality: "soil_quality",
    ndvi: "ndvi",
    distance_to_water_source: "distance_to_water_source",
    accessibility: "accessibility",
    wildlife: "wildlife_status",
  };

  // 🍞 Notification helper
  const showNotification = (
    message: string,
    type: "success" | "error" | "info",
  ) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Fetch site data
  useEffect(() => {
    const fetchData = async () => {
      if (!id || !token) return;
      try {
        setLoading(true);
        const res = await fetch(
          `http://127.0.0.1:8000/api/site/data/current/${id}/`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (!res.ok) throw new Error("Failed to fetch");
        const result = await res.json();
        setSiteData(result.data);
      } catch (err) {
        console.error("Fetch error:", err);
        showNotification("Failed to load site data", "error");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, token]);

  // Update overall site status: Accept → "official", Reject → "rejected"
  const updateSiteStatus = async (newStatus: "official" | "rejected") => {
    if (!id || !token) return;
    try {
      const res = await fetch(
        `http://127.0.0.1:8000/api/site/status/update/${id}/`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: newStatus }),
        },
      );
      const data = await res.json();
      if (res.ok) {
        showNotification(
          `Site ${newStatus === "official" ? "approved" : "rejected"} successfully!`,
          "success",
        );
      } else {
        showNotification(data.error || "Update failed", "error");
      }
    } catch (err) {
      showNotification("Network error", "error");
    }
  };

  // Update individual layer
  const updateMulticriteria = useCallback(
    async (
      layer: string,
      modelField: string,
      value: string | number | boolean,
    ) => {
      if (!siteData || !token) return;

      const body: Record<string, any> = {
        total_score: siteData.total_score,
        [`${layer}_status`]: "completed",
        [layer]: value,
        [modelField]: value,
      };

      try {
        const res = await fetch(
          `http://127.0.0.1:8000/api/multicriteria/update/${siteData.site_data_id}/`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(body),
          },
        );
        const data = await res.json();
        if (res.ok) {
          showNotification(`${layer.replace("_", " ")} updated!`, "success");
          setSiteData((prev) =>
            prev
              ? {
                  ...prev,
                  [`${layer}_status`]: "completed",
                  [modelField]: value,
                }
              : null,
          );
        } else {
          showNotification(data.error || "Save failed", "error");
        }
      } catch (err) {
        showNotification("Failed to save", "error");
      }
    },
    [siteData, token],
  );

  // 🔑 Filter: Only show selected layer card in center panel
  const selectedLayerData = layers.find((l) => l.key === selectedLayer);

  // Filter assessments for selected layer (right panel)
  const selectedAssessments = mockAssessments.filter(
    (a) => a.layer === selectedLayer,
  );

  // Status badge helper
  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
      pending: "bg-amber-100 text-amber-700 border-amber-200",
      rejected: "bg-rose-100 text-rose-700 border-rose-200",
    };
    return styles[status] || "bg-gray-100 text-gray-600 border-gray-200";
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">
            Loading assessment data...
          </p>
        </div>
      </div>
    );
  }

  // No data state
  if (!siteData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center p-8 bg-white rounded-xl shadow-lg">
          <p className="text-red-500 text-lg font-medium mb-2">
            ⚠️ No Data Found
          </p>
          <p className="text-gray-500">
            Please verify the site ID and try again.
          </p>
        </div>
      </div>
    );
  }

  const completedLayers = layers.filter(
    (layer) =>
      siteData[`${layer.key}_status` as keyof SiteData] === "completed",
  ).length;
  const progress = (completedLayers / layers.length) * 100;

  // ============ RENDER ============
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50 to-teal-50">
      {/* 🍞 Toast Notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg transform transition-all duration-300 ${
            notification.type === "success"
              ? "bg-emerald-500 text-white"
              : notification.type === "error"
                ? "bg-rose-500 text-white"
                : "bg-blue-500 text-white"
          }`}
        >
          {notification.message}
        </div>
      )}

      {/* Header */}
      <header className="bg-gradient-to-r from-[#0F4A2F] to-[#1a6b44] border-b border-emerald-700/30 sticky top-0 z-40 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <span>🌿</span> Site Suitability Assessment
              </h1>
              <p className="text-sm text-emerald-100 mt-1">
                Site ID:{" "}
                <span className="font-mono font-medium">
                  {siteData.site_id}
                </span>
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-emerald-100/80">
                Created: {siteData.created_at?.split(" ")[0] || "N/A"}
              </span>
              <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 bg-[#0f4a2fe0] hover:bg-[#0f4a2f] text-white h-10 px-3 py-2 rounded-lg text-[.8rem] transition-colors"
              >
                <ChevronLeft size={20} />
                <span className="hidden sm:inline">Back</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 📊 Progress Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">
                Assessment Progress
              </h2>
              <p className="text-sm text-gray-500">
                Complete all layers to finalize evaluation
              </p>
            </div>
            <div className="text-right">
              <span className="text-3xl font-bold text-emerald-600">
                {Math.round(progress)}%
              </span>
              <p className="text-sm text-gray-500">
                {completedLayers} of {layers.length} completed
              </p>
            </div>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-emerald-400 to-teal-500 h-3 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* 🗂️ Left Panel: Layer Navigation */}
          <div className="xl:col-span-1">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sticky top-24">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <span>📋</span> Criteria Layers
              </h3>
              <div className="space-y-2">
                {layers.map((layer) => {
                  const statusKey = `${layer.key}_status` as keyof SiteData;
                  const statusValue = siteData[statusKey] as string;

                  return (
                    <button
                      key={layer.key}
                      onClick={() => setSelectedLayer(layer.key)}
                      className={`w-full flex items-center justify-between p-3 rounded-xl transition-all duration-200 text-left ${
                        selectedLayer === layer.key
                          ? "bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-300 shadow-sm"
                          : "hover:bg-gray-50 border-2 border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{layer.icon}</span>
                        <span className="font-medium text-gray-700">
                          {layer.label}
                        </span>
                      </div>
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full border font-medium ${getStatusBadge(
                          statusValue,
                        )}`}
                      >
                        {statusValue}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 🎯 Center Panel: ONLY Selected Layer Card */}
          <div className="xl:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                  <span>{selectedLayerData?.icon}</span>
                  {selectedLayerData?.label} Evaluation
                </h3>
                <span
                  className={`text-xs px-3 py-1 rounded-full border font-medium ${getStatusBadge(
                    siteData[
                      `${selectedLayer}_status` as keyof SiteData
                    ] as string,
                  )}`}
                >
                  {
                    siteData[
                      `${selectedLayer}_status` as keyof SiteData
                    ] as string
                  }
                </span>
              </div>

              {/* ✅ Render ONLY the selected layer's card */}
              {selectedLayerData && (
                <div className="max-w-md mx-auto">
                  <Card
                    title={selectedLayerData.label}
                    icon={selectedLayerData.icon}
                    value={
                      siteData[
                        layerToModelField[
                          selectedLayerData.key
                        ] as keyof SiteData
                      ]
                    }
                    layerKey={selectedLayerData.key}
                    modelField={layerToModelField[selectedLayerData.key]}
                    options={fieldOptions[selectedLayerData.key]}
                    onSave={updateMulticriteria}
                    status={
                      siteData[
                        `${selectedLayerData.key}_status` as keyof SiteData
                      ] as string
                    }
                  />
                </div>
              )}

              {/* Layer Info Hint */}
              <p className="text-xs text-gray-400 text-center mt-4">
                Click a different layer on the left to evaluate another
                criterion
              </p>
            </div>

            {/* ✅ Action Buttons: Accept / Reject */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-800 mb-4">
                Final Decision
              </h3>
              <p className="text-sm text-gray-500 mb-6">
                Review all criteria and approve or reject this site for
                reforestation.
              </p>
              <div className="flex flex-wrap gap-4">
                <button
                  onClick={() => updateSiteStatus("official")}
                  className="flex-1 min-w-[140px] flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold py-3 px-6 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 transform hover:-translate-y-0.5"
                >
                  <span>✅</span> Accept Site
                </button>
                <button
                  onClick={() => updateSiteStatus("rejected")}
                  className="flex-1 min-w-[140px] flex items-center justify-center gap-2 bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white font-semibold py-3 px-6 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 transform hover:-translate-y-0.5"
                >
                  <span>❌</span> Reject Site
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-4 text-center">
                Accept → Status:{" "}
                <code className="bg-gray-100 px-1 rounded">official</code>
                &nbsp;|&nbsp; Reject → Status:{" "}
                <code className="bg-gray-100 px-1 rounded">rejected</code>
              </p>
            </div>
          </div>

          {/* 📝 Right Panel: Field Assessments (Dynamic by Layer) */}
          <div className="xl:col-span-1 space-y-6">
            {/* Selected Layer Header */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">{selectedLayerData?.icon}</span>
                <div>
                  <h4 className="font-semibold text-gray-800">
                    {selectedLayerData?.label}
                  </h4>
                  <p className="text-xs text-gray-500">
                    {selectedAssessments.length} field assessment
                    {selectedAssessments.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">Evaluation Status</span>
                <span
                  className={`text-xs px-2.5 py-1 rounded-full border font-medium ${getStatusBadge(
                    siteData[
                      `${selectedLayer}_status` as keyof SiteData
                    ] as string,
                  )}`}
                >
                  {
                    siteData[
                      `${selectedLayer}_status` as keyof SiteData
                    ] as string
                  }
                </span>
              </div>
            </div>

            {/* 📋 Field Assessments List */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <span>👥</span> Inspector Feedback
              </h4>

              {selectedAssessments.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-3">🔍</div>
                  <p className="text-gray-500 text-sm">
                    No field assessments yet for this layer.
                  </p>
                  <button
                    onClick={() =>
                      showNotification(
                        "Demo mode: Add assessment feature coming soon!",
                        "info",
                      )
                    }
                    className="mt-3 text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                  >
                    + Add Assessment (Demo)
                  </button>
                </div>
              ) : (
                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1 custom-scrollbar">
                  {selectedAssessments.map((assessment) => (
                    <AssessmentCard
                      key={assessment.id}
                      assessment={assessment}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* 📈 Quick Summary */}
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl shadow-lg p-5 text-white">
              <h4 className="font-semibold mb-4 flex items-center gap-2">
                <span>📈</span> Quick Summary
              </h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-emerald-100">Completed</span>
                  <span className="font-bold text-lg">
                    {completedLayers}/{layers.length}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-emerald-100">Total Score</span>
                  <span className="font-bold text-lg">
                    {siteData.total_score?.toFixed(1) || 0}
                  </span>
                </div>
                <div className="pt-3 border-t border-white/20">
                  <p className="text-sm text-emerald-100">
                    {completedLayers === layers.length
                      ? "🎉 All criteria evaluated!"
                      : `⏳ ${layers.length - completedLayers} layer${layers.length - completedLayers > 1 ? "s" : ""} remaining`}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// ============ ASSESSMENT CARD COMPONENT ============
function AssessmentCard({ assessment }: { assessment: FieldAssessment }) {
  const [expanded, setExpanded] = useState(false);

  const StarRating = ({ rating }: { rating?: number }) => {
    if (!rating) return null;
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <span
            key={star}
            className={`text-sm ${star <= rating ? "text-amber-400" : "text-gray-300"}`}
          >
            ★
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="border border-gray-200 rounded-xl p-4 hover:border-emerald-300 transition-colors bg-gradient-to-br from-white to-gray-50">
      <div className="flex items-start gap-3 mb-3">
        <img
          src={assessment.inspector.avatar}
          alt={assessment.inspector.name}
          className="w-10 h-10 rounded-full border-2 border-white shadow-sm flex-shrink-0"
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              `https://ui-avatars.com/api/?name=${encodeURIComponent(
                assessment.inspector.name,
              )}&background=047857&color=fff&size=128`;
          }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h5 className="font-medium text-gray-800 text-sm truncate">
              {assessment.inspector.name}
            </h5>
            {assessment.verified && (
              <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex-shrink-0 ml-2">
                ✓ Verified
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500">{assessment.inspector.role}</p>
          <p className="text-xs text-gray-400 truncate">
            {assessment.inspector.email}
          </p>
        </div>
      </div>

      <div className="mb-3">
        <p className="text-sm text-gray-700 leading-relaxed">
          {assessment.feedback}
        </p>
        {assessment.description && (
          <>
            <p
              className={`text-xs text-gray-500 mt-2 leading-relaxed ${!expanded ? "line-clamp-2" : ""}`}
            >
              {assessment.description}
            </p>
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-emerald-600 hover:text-emerald-700 font-medium mt-1"
            >
              {expanded ? "Show less" : "Read more"}
            </button>
          </>
        )}
      </div>

      <div className="flex items-center justify-between mb-3">
        <StarRating rating={assessment.rating} />
        <span className="text-xs text-gray-400">
          📅{" "}
          {new Date(assessment.visited_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      </div>

      {assessment.photos && assessment.photos.length > 0 && (
        <div className="flex gap-2 mb-3">
          {assessment.photos.slice(0, 3).map((photo, idx) => (
            <img
              key={idx}
              src={photo}
              alt={`Evidence ${idx + 1}`}
              className="w-16 h-12 object-cover rounded-lg border border-gray-200 hover:scale-105 transition-transform cursor-pointer flex-shrink-0"
              onClick={() => window.open(photo, "_blank")}
            />
          ))}
          {assessment.photos.length > 3 && (
            <div className="w-16 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-xs text-gray-500 border border-gray-200 flex-shrink-0">
              +{assessment.photos.length - 3}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 pt-3 border-t border-gray-100">
        <button className="flex-1 text-xs py-1.5 px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors">
          📧 view more
        </button>
      </div>
    </div>
  );
}

// ============ DATA CARD COMPONENT ============
function Card({
  title,
  value,
  layerKey,
  modelField,
  options,
  onSave,
  status,
  icon = "📍",
}: CardProps) {
  const [val, setVal] = useState(value);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setVal(value);
  }, [value]);

  const handleSave = async () => {
    if (val === value) return;
    setSaving(true);
    await onSave(layerKey, modelField, val);
    setSaving(false);
  };

  const getStatusStyle = (s: string) => {
    if (s === "completed")
      return "text-emerald-600 bg-emerald-50 border-emerald-200";
    if (s === "rejected") return "text-rose-600 bg-rose-50 border-rose-200";
    return "text-amber-600 bg-amber-50 border-amber-200";
  };

  return (
    <div className="group bg-gradient-to-br from-white to-gray-50 rounded-xl border border-gray-200 p-4 hover:shadow-md hover:border-emerald-300 transition-all duration-200">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <h4 className="font-semibold text-gray-800">{title}</h4>
        </div>
        {status && (
          <span
            className={`text-xs px-2.5 py-1 rounded-full border font-medium capitalize ${getStatusStyle(status)}`}
          >
            {status}
          </span>
        )}
      </div>

      <div className="space-y-3">
        {options ? (
          <select
            value={String(val)}
            onChange={(e) => setVal(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-shadow capitalize"
            disabled={saving}
          >
            {options.map((opt) => (
              <option key={opt} value={opt} className="capitalize">
                {opt.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        ) : (
          <input
            type={typeof value === "number" ? "number" : "text"}
            value={String(val)}
            onChange={(e) => setVal(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-shadow"
            disabled={saving}
          />
        )}

        <button
          onClick={handleSave}
          disabled={saving || val === value}
          className={`w-full py-2 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${
            saving || val === value
              ? "bg-gray-200 text-gray-400 cursor-not-allowed"
              : "bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm hover:shadow"
          }`}
        >
          {saving ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
              Saving...
            </span>
          ) : val === value ? (
            "✓ Saved"
          ) : (
            "💾 Save Changes"
          )}
        </button>
      </div>
    </div>
  );
}
