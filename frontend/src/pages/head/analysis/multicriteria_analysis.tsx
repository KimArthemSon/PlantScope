// src/pages/multicriteria/MulticriteriaAnalysis.tsx
import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { useUserRole } from "@/hooks/authorization";

// Types
import type {
  LayerKey,
  SiteData,
  LayerConfig,
  LeaderDecision,
  LayerValidation,
  FieldAssessment,
} from "./types/mcda";

// Hooks
import { useSiteAssessment } from "./hooks/useSiteAssessment";

// Components
import LayerNavigation from "./components/LayerNavigation";
import SideBySideComparison from "./components/SideBySideComparison";
import ActionPanel from "./components/ActionPanel";

// Layer Components
import SafetyLayer from "./layers/SafetyLayer";
// Import other 7 layers similarly when created:
// import LegalityLayer from "./layers/LegalityLayer";
// import SlopeLayer from "./layers/SlopeLayer";
// etc.

// ============ CONFIG ============
const LAYERS: LayerConfig[] = [
  {
    key: "safety",
    label: "Safety",
    icon: "🛡️",
    description: "Geophysical & human security",
  },
  {
    key: "legality",
    label: "Legality",
    icon: "⚖️",
    description: "Land tenure & boundaries",
  },
  {
    key: "slope",
    label: "Slope",
    icon: "📐",
    description: "Topography & erosion",
  },
  {
    key: "soil_quality",
    label: "Soil Quality",
    icon: "🌱",
    description: "Edaphic factors",
  },
  {
    key: "hydrology",
    label: "Hydrology",
    icon: "💧",
    description: "Water access & reliability",
  },
  {
    key: "accessibility",
    label: "Accessibility",
    icon: "🚶",
    description: "Logistics & transport",
  },
  {
    key: "wildlife_status",
    label: "Wildlife",
    icon: "🦌",
    description: "Ecological impact",
  },
  {
    key: "tree_species_suitability",
    label: "Tree Species",
    icon: "🌳",
    description: "Species matching",
  },
];

// ============ MAIN COMPONENT ============
export default function MulticriteriaAnalysis() {
  const { id } = useParams<{ id: string }>();
  const siteId = id ? parseInt(id) : undefined;
  const navigate = useNavigate();

  // Custom hook for all API + state logic (LEADER ONLY)
  const {
    siteData,
    loading,
    submittingLayer,
    finalizing,
    notification,
    submitLeaderValidation, // ✅ Leader validation only
    finalizeSite,
    updateSiteStatus,
    isLayerValidated,
    getLayerStatus,
    getValidationProgress,
  } = useSiteAssessment(siteId);

  const [selectedLayer, setSelectedLayer] = useState<LayerKey>("safety");
  const [consensusNote, setConsensusNote] = useState("");
  const [finalStatus, setFinalStatus] = useState<
    "accepted" | "rejected" | "completed"
  >("accepted");

  // Role-based access: This page is for LEADERS only
  // const { userRole } = useUserRole();
  // const isLeaderView =
  //   userRole === "GISSpecialist" || userRole === "CityENROHead";

  // const basePath = useCallback(() => {
  //   if (userRole === "GISSpecialist") return "/GISS";
  //   if (userRole === "DataManager") return "/DataManager";
  //   return "";
  // }, [userRole]);

  // // Redirect non-leaders away from this page
  // useEffect(() => {
  //   if (!isLeaderView) {
  //     navigate(`${basePath()}/sites`);
  //   }
  // }, [isLeaderView, navigate, basePath]);
  const isLeaderView = true;
  // Validation progress
  const validationProgress = getValidationProgress();
  const isFinalizable = validationProgress.validated === 8;

  // ============ LAYER RENDERER (Leader Validation Only) ============
  const renderLayerContent = useCallback(() => {
    // ✅ Inspector data: READ-ONLY reference for leader (from field_assessment_data)
    const inspectorData: FieldAssessment | undefined =
      siteData?.raw_field_assessment?.[selectedLayer];

    // ✅ Leader data: Already validated data (from site_data)
    const leaderData: LayerValidation | undefined =
      siteData?.validated_mcda_data?.[selectedLayer];

    // ✅ Props for layer components: Leader validates based on inspector reference
    const layerProps = {
      siteId: siteId!,
      inspectorData, // 🔹 READ-ONLY: What inspector submitted
      leaderData, // ✅ Leader's validated data (if exists)
      isLoading: submittingLayer === selectedLayer,
      // ✅ Leader submits validation (ACCEPT/REJECT + comments)
      onSubmitValidation: (
        data: Record<string, any>,
        decision: LeaderDecision,
        comment?: string,
        note?: string,
      ) => submitLeaderValidation(selectedLayer, data, decision, comment, note),
    };

    switch (selectedLayer) {
      case "safety":
        return <SafetyLayer {...layerProps} />;
      // Add other layers here when created:
      // case "legality": return <LegalityLayer {...layerProps} />;
      // case "slope": return <SlopeLayer {...layerProps} />;
      // etc.
      default:
        return (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
            <p className="text-gray-500">
              Select a layer from the navigation to begin validation
            </p>
          </div>
        );
    }
  }, [
    selectedLayer,
    siteData,
    submittingLayer,
    submitLeaderValidation,
    siteId,
  ]);

  // ============ LOADING / ERROR STATES ============
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-500 border-t-transparent mx-auto mb-4" />
          <p className="text-gray-600 font-medium">
            Loading assessment data...
          </p>
        </div>
      </div>
    );
  }

  if (!siteData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center p-8 bg-white rounded-xl shadow-lg">
          <p className="text-red-500 text-lg font-medium mb-2">
            ⚠️ Site Not Found
          </p>
          <p className="text-gray-500 mb-4">
            Please verify the site ID and try again.
          </p>
          <button
            onClick={() => navigate(-1)}
            className="text-emerald-600 hover:underline"
          >
            ← Back to Sites
          </button>
        </div>
      </div>
    );
  }

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

      {/* 🧭 Header */}
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
                </span>{" "}
                • {siteData.name}
              </p>
              {siteData.versioning && (
                <p className="text-xs text-emerald-200">
                  Version:{" "}
                  {siteData.versioning.is_current ? "Active" : "Archived"}
                  {siteData.versioning.validated_by &&
                    ` • Validated by ${siteData.versioning.validated_by}`}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-emerald-100/80">
                Created: {siteData.created_at?.split(" ")[0] || "N/A"}
              </span>
              <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 bg-[#0f4a2fe0] hover:bg-[#0f4a2f] text-white h-10 px-4 py-2 rounded-lg text-sm transition-colors"
              >
                <ChevronLeft size={18} /> Back
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 📦 Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* 🗂️ Left: Layer Navigation */}
          <div className="xl:col-span-1">
            <LayerNavigation
              layers={LAYERS}
              selectedLayer={selectedLayer}
              onSelectLayer={setSelectedLayer}
              getLayerStatus={getLayerStatus}
              validationProgress={validationProgress}
            />
          </div>

          {/* 🎯 Center: Active Layer Content (Leader Validation Form) */}
          <div className="xl:col-span-2 space-y-6">
            {renderLayerContent()}

            {/* ✅ Action Panel: Finalize Site (no scoring - just lock version) */}
            <ActionPanel
              siteStatus={siteData.status}
              isFinalizable={isFinalizable}
              isFinalizing={finalizing}
              consensusNote={consensusNote}
              finalStatus={finalStatus}
              onConsensusNoteChange={setConsensusNote}
              onFinalStatusChange={setFinalStatus}
              onFinalize={() => finalizeSite(consensusNote, finalStatus)}
            />
          </div>

          {/* 📝 Right: Side-by-Side Comparison (Leader Reference Panel) */}
          <div className="xl:col-span-1">
            {/* ✅ Inspector's raw submission - READ-ONLY for leader */}
            {siteData && (
              <SideBySideComparison
                layer={selectedLayer}
                inspectorData={siteData.raw_field_assessment?.[selectedLayer]}
                leaderData={siteData.validated_mcda_data?.[selectedLayer]}
                isLeaderView={true}
              />
            )}

            {/* ✅ NDVI Quick Reference (Assessment Phase - Scientific Threshold) */}
            {siteData.ndvi_value !== undefined && (
              <div className="mt-4 bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <span>💧</span> NDVI Reference
                </h3>
                <div className="text-sm">
                  <p className="text-gray-600">
                    Current:{" "}
                    <span
                      className={`font-medium ${
                        siteData.ndvi_value !== null &&
                        siteData.ndvi_value >= 0.2 &&
                        siteData.ndvi_value <= 0.4
                          ? "text-green-600"
                          : siteData.ndvi_value !== null &&
                              siteData.ndvi_value < 0.2
                            ? "text-red-600"
                            : "text-amber-600"
                      }`}
                    >
                      {siteData.ndvi_value !== null
                        ? siteData.ndvi_value.toFixed(2)
                        : "Pending"}
                    </span>
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    ✅ Ideal: 0.2–0.4 (degraded land for reforestation)
                  </p>
                  <p className="text-xs text-gray-500">
                    ⚠️ &lt;0.2: Non-plantable | &gt;0.4: Dense vegetation
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
