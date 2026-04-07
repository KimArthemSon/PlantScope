// src/pages/multicriteria/MulticriteriaAnalysis.tsx
import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { useUserRole } from "@/hooks/authorization";

// Types
import type { LayerKey, SiteData } from "./types/mcda";

// Hooks
import { useSiteAssessment } from "./hooks/useSiteAssessment";

// Components
import LayerNavigation from "./components/LayerNavigation";
import ActionPanel from "./components/ActionPanel";

// Layer Components (lazy load for performance)
import SafetyLayer from "./layers/SafetyLayer";
import LegalityLayer from "./layers/LegalityLayer";
import SlopeLayer from "./layers/SlopeLayer";
import SoilQualityLayer from "./layers/SoilQualityLayer";
import HydrologyLayer from "./layers/HydrologyLayer";
import AccessibilityLayer from "./layers/AccessibilityLayer";
import WildlifeLayer from "./layers/WildlifeLayer";
import TreeSpeciesLayer from "./layers/TreeSpeciesLayer";

// ============ CONFIG ============
const LAYERS: Array<{
  key: LayerKey;
  label: string;
  icon: string;
  weight: number;
}> = [
  { key: "safety", label: "Safety", icon: "🛡️", weight: 15 },
  { key: "legality", label: "Legality", icon: "⚖️", weight: 20 },
  { key: "slope", label: "Slope", icon: "📐", weight: 10 },
  { key: "soil_quality", label: "Soil Quality", icon: "🌱", weight: 15 },
  { key: "hydrology", label: "Hydrology", icon: "💧", weight: 10 },
  { key: "accessibility", label: "Accessibility", icon: "🚶", weight: 10 },
  { key: "wildlife_status", label: "Wildlife", icon: "🦌", weight: 10 },
  {
    key: "tree_species_suitability",
    label: "Tree Species",
    icon: "🌳",
    weight: 10,
  },
];
const API_BASE = "http://localhost:8000/api";
// ============ MAIN COMPONENT ============
export default function MulticriteriaAnalysis() {
  const { id } = useParams<{ id: string }>();
  const siteId = id ? parseInt(id) : undefined;
  const navigate = useNavigate();

  // Custom hook for all API + state logic
  const {
    siteData,
    loading,
    submittingLayer,
    finalizing,
    notification,
    submitLayer,
    finalizeSite,
    updateSiteStatus,
    getLayerStatus,
  } = useSiteAssessment(siteId);

  const [selectedLayer, setSelectedLayer] = useState<LayerKey>("safety");
  const [consensusNote, setConsensusNote] = useState("");

  // Role-based access (keep your existing logic)
  const { userRole } = useUserRole();
  const basePath = useCallback(() => {
    if (userRole === "GISSpecialist") return "/GISS";
    if (userRole === "DataManager") return "/DataManager";
    return "";
  }, [userRole]);

  // Count completed layers
  const completedCount = LAYERS.filter(
    (layer) => siteData?.mcda_data?.layers?.[layer.key]?.result?.verdict,
  ).length;

  // ============ LAYER RENDERER ============
  const renderLayerContent = useCallback(() => {
    const layerData = siteData?.mcda_data?.layers?.[selectedLayer];
    const commonProps = {
      siteData,
      layerData,
      isLoading: submittingLayer === selectedLayer,
      onSubmit: (data: Record<string, any>, comment?: string) =>
        submitLayer(selectedLayer, data, comment),
      onCommentChange: setConsensusNote, // for final consensus
    };

    switch (selectedLayer) {
      case "safety":
        return <SafetyLayer {...commonProps} />;
      case "legality":
        return <LegalityLayer {...commonProps} />;
      case "slope":
        return <SlopeLayer {...commonProps} />;
      case "soil_quality":
        return (
          <SoilQualityLayer
            {...commonProps}
            onDetailsUpdate={async (payload) => {
              await fetch(`${API_BASE}/update_site_details/${siteId}/`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${localStorage.getItem("token")}`,
                },
                body: JSON.stringify(payload),
              });
            }}
          />
        );
      case "hydrology":
        return <HydrologyLayer {...commonProps} />;
      case "accessibility":
        return <AccessibilityLayer {...commonProps} />;
      case "wildlife_status":
        return <WildlifeLayer {...commonProps} />;
      case "tree_species_suitability":
        return (
          <TreeSpeciesLayer
            {...commonProps}
            onDetailsUpdate={async (payload) => {
              try {
                await fetch(`${API_BASE}/update_site_details/${siteId}/`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${localStorage.getItem("token")}`,
                  },
                  body: JSON.stringify({
                    tree_species_id: payload.tree_species_id,
                  }),
                });
              } catch (error) {
                console.error("Failed to update tree species FK:", error);
              }
            }}
          />
        );
      default:
        return <div className="p-6 text-gray-500">Select a layer to begin</div>;
    }
  }, [selectedLayer, siteData, submittingLayer, submitLayer]);

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
            onClick={() => navigate(`${basePath()}/sites`)}
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
              completedCount={completedCount}
              totalCount={LAYERS.length}
            />
          </div>

          {/* 🎯 Center: Active Layer Content */}
          <div className="xl:col-span-2 space-y-6">
            {renderLayerContent()}

            {/* ✅ Action Panel: Accept/Reject/Finalize */}
            <ActionPanel
              siteStatus={siteData.status}
              isFinalizable={completedCount === LAYERS.length}
              isFinalizing={finalizing}
              consensusNote={consensusNote}
              onConsensusNoteChange={setConsensusNote}
              onFinalize={() => finalizeSite(consensusNote)}
              onAccept={() => updateSiteStatus("official")}
              onReject={() => updateSiteStatus("rejected")}
            />
          </div>

          {/* 📝 Right: Inspector Submissions (Placeholder for now) */}
          <div className="xl:col-span-1">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sticky top-24">
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <span>👥</span> Inspector Submissions
              </h3>
              <p className="text-sm text-gray-500 italic">
                Inspector comparison view coming soon...
              </p>
              {/* We'll build this in the next iteration */}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
