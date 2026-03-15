import { ChevronLeft, MapIcon } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";

// ============ INTERFACES ============
interface SiteData {
  site_data_id: number;
  site_id: number;
  // Site_data fields (actual values)
  Safety: string;
  legality: boolean;
  slope: number;
  soil_quality: string;
  distance_to_water_source: number;
  accessibility: string;
  wildlife: string;
  // Site_multicriteria fields (status + metrics)
  safety_status: string;
  legality_status: string;
  slope_status: string;
  soil_quality_status: string;
  distance_to_water_source_status: string;
  accessibility_status: string;
  wildlife_status: string;
  survival_rate: number;
  total_score: number;
  remarks?: string;
  created_at?: string;
  updated_at?: string;
}

interface CardProps {
  title: string;
  value: string | number | boolean;
  layerKey: string;
  modelField: string;
  options?: string[];
  inputType?: "text" | "number" | "select" | "boolean";
  min?: number;
  max?: number;
  step?: number;
  onSave: (
    layer: string,
    modelField: string,
    value: string | number | boolean,
  ) => Promise<void>;
  status?: string;
  icon?: string;
  helpText?: string;
}

// ✅ Define discussion keys type for type-safe access
type DiscussionKey =
  | "legality"
  | "slope"
  | "safety"
  | "soil_quality"
  | "distance_to_water_source"
  | "accessibility"
  | "wildlife_status";

interface FieldAssessment {
  id: number;
  title: string;
  description: string; // General feedback

  // Inspector details from Assigned_onsite_inspector -> User
  inspector: {
    name: string;
    email: string;
    avatar: string;
    role: string;
  };

  // Status fields from Field_assessment
  status: {
    safety: string;
    soil_quality: string;
    legality: string;
    accessibility: string;
    wildlife_status: string;
  };

  // Technical data
  slope: number;
  coordinates: any; // JSONField
  distance_to_water_source: string;

  // ✅ Discussions with index signature for dynamic access
  discussions: {
    legality?: string;
    slope?: string;
    safety?: string;
    soil_quality?: string;
    distance_to_water_source?: string;
    accessibility?: string;
    wildlife_status?: string;
    [key: string]: string | undefined; // ✅ Allows string indexing
  };

  // ✅ Photos can be string URLs or objects
  photos: (
    | string
    | {
        id: number;
        url: string;
        type:
          | "all"
          | "slope"
          | "soil_quality"
          | "accessibility"
          | "wildlife_status"
          | "safety"
          | "legality";
      }
  )[];

  created_at: string;
  is_sent: boolean;
}

interface BackendFeedbackEntry {
  id: number;
  assessment_id: number;
  feedback: string;
  inspector: {
    name: string;
    email: string;
    avatar: string;
    role: string;
  };
  created_at: string;
}

interface CriteriaSummary {
  total_feedbacks: number;
  recent_feedbacks: BackendFeedbackEntry[];
}

interface SiteAssessmentResponse {
  success: boolean;
  site_id: number;
  reforestation_area_id: number;
  total_assessments: number;
  criteria_summary: {
    safety: CriteriaSummary;
    water_accessibility: CriteriaSummary;
    accessibility: CriteriaSummary;
    soil_quality: CriteriaSummary;
    slope: CriteriaSummary;
    legality: CriteriaSummary;
  };
}

// ============ MAIN COMPONENT ============
export default function MulticriteriaAnalysis() {
  const { id } = useParams<{ id: string }>();
  const token = localStorage.getItem("token");
  const navigate = useNavigate();

  const [siteData, setSiteData] = useState<SiteData | null>(null);
  const [selectedLayer, setSelectedLayer] = useState<string>("safety");
  const [loading, setLoading] = useState(true);
  const [assessmentsLoading, setAssessmentsLoading] = useState(false);
  const [notification, setNotification] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  // ✅ Field assessments from backend
  const [fieldAssessments, setFieldAssessments] = useState<FieldAssessment[]>(
    [],
  );

  // ✅ Updated layers: removed ndvi, added slope
  const layers = [
    { key: "safety", label: "Safety", icon: "🛡️" },
    { key: "legality", label: "Legality", icon: "⚖️" },
    { key: "soil_quality", label: "Soil Quality", icon: "🌱" },
    { key: "slope", label: "Slope Analysis", icon: "📐" },
    { key: "distance_to_water_source", label: "Water Access", icon: "💧" },
    { key: "accessibility", label: "Accessibility", icon: "🚶" },
    { key: "wildlife", label: "Wildlife Impact", icon: "🦌" },
  ];

  // ✅ Updated field options (no ndvi)
  const fieldOptions: Record<string, string[]> = {
    safety: ["safe", "slightly", "moderate", "danger"],
    soil_quality: ["very_good", "good", "moderate", "poor", "very_poor"],
    accessibility: ["very_good", "good", "moderate", "poor", "very_poor"],
    wildlife: ["very_good", "good", "moderate", "poor", "very_poor"],
  };

  // ✅ Updated mapping: layer key → model field name in Site_data
  const layerToModelField: Record<string, string> = {
    safety: "Safety",
    legality: "legality",
    soil_quality: "soil_quality",
    slope: "slope",
    distance_to_water_source: "distance_to_water_source",
    accessibility: "accessibility",
    wildlife: "wildlife",
  };

  // ✅ Input type configuration per layer
  const layerInputConfig: Record<
    string,
    { type: string; min?: number; max?: number; step?: number }
  > = {
    safety: { type: "select" },
    legality: { type: "boolean" },
    soil_quality: { type: "select" },
    slope: { type: "number", min: 0, max: 90, step: 0.1 },
    distance_to_water_source: { type: "number", min: 0, step: 0.1 },
    accessibility: { type: "select" },
    wildlife: { type: "select" },
  };

  // 🍞 Notification helper
  const showNotification = (
    message: string,
    type: "success" | "error" | "info",
  ) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // ✅ Type-safe getter for SiteData fields with fallback defaults
  const getFieldValue = useCallback(
    (fieldKey: string): string | number | boolean => {
      if (!siteData) return getDefaultValue(fieldKey);
      const value = siteData[fieldKey as keyof SiteData];
      if (value === undefined || value === null) {
        return getDefaultValue(fieldKey);
      }
      return value as string | number | boolean;
    },
    [siteData],
  );

  // ✅ Helper: Return sensible defaults for each field type
  const getDefaultValue = (field: string): string | number | boolean => {
    switch (field) {
      case "legality":
        return true;
      case "slope":
      case "distance_to_water_source":
      case "survival_rate":
      case "total_score":
        return 0;
      case "Safety":
        return "safe";
      case "soil_quality":
      case "accessibility":
      case "wildlife":
        return "moderate";
      default:
        return "";
    }
  };

  // ✅ Type-safe getter for status fields
  const getStatusValue = useCallback(
    (statusKey: string): string => {
      if (!siteData) return "pending";
      const value = siteData[statusKey as keyof SiteData];
      return (value as string) ?? "pending";
    },
    [siteData],
  );

  // 🌐 Fetch field assessments from backend
  const fetchFieldAssessments = useCallback(
    async (layerKey: string) => {
      if (!id || !token) return;

      setAssessmentsLoading(true);
      try {
        // ✅ UPDATED: Use the new endpoint that aggregates by criteria
        const res = await fetch(
          `http://127.0.0.1:8000/api/get_sites/${id}/recent-assessments/`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (!res.ok) {
          if (res.status === 404) throw new Error("Site not found");
          throw new Error("Failed to fetch assessments");
        }

        const data: SiteAssessmentResponse = await res.json();

        // ✅ Map criteria name to layer key (backend uses snake_case)
        const criteriaToLayer: Record<string, string> = {
          safety: "safety",
          water_accessibility: "distance_to_water_source",
          accessibility: "accessibility",
          soil_quality: "soil_quality",
          slope: "slope",
          legality: "legality",
        };

        // ✅ Get the criteria key that matches our selected layer
        const backendCriteriaKey = Object.entries(criteriaToLayer).find(
          ([, layer]) => layer === layerKey,
        )?.[0];

        if (!backendCriteriaKey || !data.criteria_summary[backendCriteriaKey]) {
          setFieldAssessments([]);
          return;
        }

        // ✅ Transform backend feedbacks to match FieldAssessment interface
        const transformed: FieldAssessment[] = data.criteria_summary[
          backendCriteriaKey
        ].recent_feedbacks.map((item: BackendFeedbackEntry) => ({
          id: item.id,
          title: `${layerKey.replace(/_/g, " ")} assessment`,
          description: item.feedback, // General feedback
          feedback: item.feedback, // Keep for backward compat
          inspector: item.inspector,
          // Map status from layerKey
          status: {
            safety: layerKey === "safety" ? "moderate" : "",
            soil_quality: layerKey === "soil_quality" ? "moderate" : "",
            legality: layerKey === "legality" ? "pending" : "",
            accessibility: layerKey === "accessibility" ? "moderate" : "",
            wildlife_status: "",
          },
          slope: layerKey === "slope" ? 0 : 0,
          coordinates: null,
          distance_to_water_source: "",
          discussions: {
            // Put feedback in the matching discussion field
            [layerKey]: item.feedback,
          },
          photos: [], // Backend doesn't return photos in this endpoint yet
          created_at: item.created_at,
          is_sent: true,
        }));

        setFieldAssessments(transformed);
      } catch (err) {
        console.error("Assessment fetch error:", err);
        setFieldAssessments([]);
        showNotification("Failed to load field assessments", "error");
      } finally {
        setAssessmentsLoading(false);
      }
    },
    [id, token],
  );

  // Fetch site data from backend
  useEffect(() => {
    const fetchData = async () => {
      if (!id || !token) return;
      try {
        setLoading(true);
        const res = await fetch(
          `http://127.0.0.1:8000/api/site/data/current/${id}/`,
          { headers: { Authorization: `Bearer ${token}` } },
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

  // Fetch field assessments when layer changes
  useEffect(() => {
    if (siteData) {
      fetchFieldAssessments(selectedLayer);
    }
  }, [selectedLayer, siteData, fetchFieldAssessments]);

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

  // ✅ Update individual layer + multicriteria status
  const updateMulticriteria = useCallback(
    async (
      layer: string,
      modelField: string,
      value: string | number | boolean,
    ) => {
      if (!siteData || !token) return;

      const body: Record<string, any> = {
        // Update Site_data field
        [layer]: value,
        // Update Site_multicriteria status
        [`${layer}_status`]: "completed",
        // Keep total_score (backend may recalculate)
        total_score: siteData.total_score,
      };

      // ✅ Special handling for survival_rate (only in multicriteria, not in site_data)
      if (layer === "survival_rate") {
        body.survival_rate = value;
        delete body[layer]; // Remove duplicate
      }

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
          showNotification(`${layer.replace(/_/g, " ")} updated!`, "success");
          // ✅ Update local state with correct field names
          setSiteData((prev) => {
            if (!prev) return null;
            const updated = { ...prev };
            // Update Site_data value (if not survival_rate)
            if (layer !== "survival_rate") {
              updated[modelField as keyof SiteData] =
                value as SiteData[keyof SiteData];
            }
            // Update multicriteria status
            updated[`${layer}_status` as keyof SiteData] =
              "completed" as SiteData[keyof SiteData];
            // Update survival_rate if applicable
            if (layer === "survival_rate") {
              updated.survival_rate = value as number;
            }
            return updated;
          });
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

  // ✅ FIXED: Sort by created_at instead of visited_at
  const selectedAssessments = [...fieldAssessments].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  // Get most recent assessment
  const recentAssessment = selectedAssessments[0] || null;

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
    (layer) => getStatusValue(`${layer.key}_status`) === "completed",
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
                  const statusValue = getStatusValue(`${layer.key}_status`);
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
                    getStatusValue(`${selectedLayer}_status`),
                  )}`}
                >
                  {getStatusValue(`${selectedLayer}_status`)}
                </span>
              </div>

              {/* ✅ Render ONLY the selected layer's card */}
              {selectedLayerData && siteData && (
                <div className="max-w-md mx-auto">
                  <Card
                    title={selectedLayerData.label}
                    icon={selectedLayerData.icon}
                    value={getFieldValue(
                      layerToModelField[selectedLayerData.key],
                    )}
                    layerKey={selectedLayerData.key}
                    modelField={layerToModelField[selectedLayerData.key]}
                    options={fieldOptions[selectedLayerData.key]}
                    inputType={layerInputConfig[selectedLayerData.key]?.type}
                    min={layerInputConfig[selectedLayerData.key]?.min}
                    max={layerInputConfig[selectedLayerData.key]?.max}
                    step={layerInputConfig[selectedLayerData.key]?.step}
                    onSave={updateMulticriteria}
                    status={getStatusValue(`${selectedLayerData.key}_status`)}
                    helpText={
                      selectedLayerData.key === "slope"
                        ? "Enter slope in degrees (0-90°)"
                        : selectedLayerData.key === "distance_to_water_source"
                          ? "Distance in meters to nearest water source"
                          : undefined
                    }
                  />
                  {selectedLayer == "legality" && (
                    <div className="flex gap-2 mt-5">
                      <p className="font-semibold text-gray-800 flex items-center gap-2">
                        Manipulate Map:{" "}
                      </p>
                      <button
                        onClick={() =>
                          navigate(
                            `/analysis/multicriteria-analysis/${id}/geo-spatial/`,
                          )
                        }
                        className="text-green-900 cursor-pointer border border-green-900 rounded-full p-1 hover:bg-green-50 transition-colors"
                        title="View on Map"
                      >
                        <MapIcon size={20} />
                      </button>
                    </div>
                  )}
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

          {/* 📝 Right Panel: Field Assessments (BACKEND DATA) */}
          <div className="xl:col-span-1 space-y-6">
            {/* Selected Layer Header */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">{selectedLayerData?.icon}</span>
                <div>
                  <h4 className="font-semibold text-gray-800">
                    {selectedLayerData?.label}
                  </h4>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">Evaluation Status</span>
                <span
                  className={`text-xs px-2.5 py-1 rounded-full border font-medium ${getStatusBadge(
                    getStatusValue(`${selectedLayer}_status`),
                  )}`}
                >
                  {getStatusValue(`${selectedLayer}_status`)}
                </span>
              </div>
            </div>

            {/* 📋 Recent Assessment Card - Only Show Most Recent */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                  <span>👥</span> Latest Inspector Feedback
                </h4>
              </div>

              {assessmentsLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-500 border-t-transparent mx-auto mb-2"></div>
                  <p className="text-gray-500 text-sm">
                    Loading assessments...
                  </p>
                </div>
              ) : selectedAssessments.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-3">🔍</div>
                  <p className="text-gray-500 text-sm">
                    No field assessments yet for this layer.
                  </p>
                </div>
              ) : recentAssessment ? (
                <>
                  {/* ✅ Pass selectedLayer to AssessmentCard */}
                  <AssessmentCard
                    assessment={recentAssessment}
                    isCompact
                    selectedLayer={selectedLayer}
                  />

                  {/* Show "View All" button if more than 1 assessment */}
                  {selectedAssessments.length > 1 && (
                    <button
                      onClick={() =>
                        navigate(
                          `/analysis/multicriteria-analysis/${id}/field_assessment/${selectedLayer}`,
                        )
                      }
                      className="w-full mt-4 py-2.5 px-4 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors flex items-center justify-center gap-2 border border-emerald-200"
                    >
                      View All Assessments
                      <ChevronLeft className="rotate-180" size={16} />
                    </button>
                  )}
                </>
              ) : null}
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
                    {siteData.total_score?.toFixed(1) ?? "0.0"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-emerald-100">Survival Rate</span>
                  <span className="font-bold text-lg">
                    {siteData.survival_rate?.toFixed(1) ?? "0.0"}%
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
interface AssessmentCardProps {
  assessment: FieldAssessment;
  isCompact?: boolean;
  selectedLayer: string; // ✅ Required for navigation & discussion lookup
}

function AssessmentCard({
  assessment,
  isCompact = false,
  selectedLayer,
}: AssessmentCardProps) {
  const [expanded, setExpanded] = useState(!isCompact);
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  // ✅ Safe discussion access helper
  const getDiscussion = (layer: string): string | undefined => {
    const key = layer as DiscussionKey;
    return assessment.discussions?.[key];
  };

  const discussionValue = getDiscussion(selectedLayer);

  // ✅ Helper to get photo URL (supports both string and object)
  const getPhotoUrl = (
    photo: string | { id: number; url: string; type: string },
  ): string => {
    return typeof photo === "string" ? photo : photo.url;
  };

  return (
    <div
      className={`border border-gray-200 rounded-xl p-4 hover:border-emerald-300 transition-colors bg-gradient-to-br from-white to-gray-50 ${
        isCompact ? "cursor-pointer hover:shadow-md" : ""
      }`}
      onClick={
        isCompact
          ? () =>
              navigate(
                `/analysis/multicriteria-analysis/${id}/field_assessment/${selectedLayer}`,
              )
          : undefined
      }
    >
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
          </div>
          <p className="text-xs text-gray-500">{assessment.inspector.role}</p>
          {!isCompact && (
            <p className="text-xs text-gray-400 truncate">
              {assessment.inspector.email}
            </p>
          )}
        </div>
      </div>

      <div className="mb-3">
        {/* ✅ Use description (mapped from backend feedback) */}
        <p className="text-sm text-gray-700 leading-relaxed">
          {assessment.description || assessment.feedback}
        </p>
        {/* ✅ Type-safe discussion display */}
        {discussionValue && discussionValue !== assessment.description && (
          <p className="text-xs text-gray-500 mt-2 italic">
            💬 {discussionValue}
          </p>
        )}
      </div>

      {/* ✅ FIXED: Photos handling - support both string[] and object[] */}
      {!isCompact && assessment.photos && assessment.photos.length > 0 && (
        <div className="flex gap-2 mb-3">
          {assessment.photos.slice(0, 3).map((photo, idx) => (
            <img
              key={idx}
              src={getPhotoUrl(photo)}
              alt={`Evidence ${idx + 1}`}
              className="w-16 h-12 object-cover rounded-lg border border-gray-200 hover:scale-105 transition-transform cursor-pointer flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                window.open(getPhotoUrl(photo), "_blank");
              }}
            />
          ))}
          {assessment.photos.length > 3 && (
            <div className="w-16 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-xs text-gray-500 border border-gray-200 flex-shrink-0">
              +{assessment.photos.length - 3}
            </div>
          )}
        </div>
      )}

      {/* ✅ FIXED: Date display using created_at instead of visited_at */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-400">
          📅{" "}
          {new Date(assessment.created_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      </div>

      {!isCompact && (
        <div className="flex gap-2 pt-3 border-t border-gray-100">
          <button
            className="flex-1 text-xs py-1.5 px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            📧 View Details
          </button>
        </div>
      )}
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
  inputType = "text",
  min,
  max,
  step,
  onSave,
  status,
  icon = "📍",
  helpText,
}: CardProps) {
  const [val, setVal] = useState<string | number | boolean>(value);
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
        {/* ✅ Dynamic input based on type */}
        {inputType === "select" && options ? (
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
        ) : inputType === "boolean" ? (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setVal(true)}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                val === true
                  ? "bg-emerald-500 text-white shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
              disabled={saving}
            >
              ✓ Legal
            </button>
            <button
              type="button"
              onClick={() => setVal(false)}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                val === false
                  ? "bg-rose-500 text-white shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
              disabled={saving}
            >
              ✗ Illegal
            </button>
          </div>
        ) : (
          <input
            type={inputType}
            value={String(val)}
            onChange={(e) =>
              setVal(
                inputType === "number"
                  ? parseFloat(e.target.value) || 0
                  : e.target.value,
              )
            }
            min={min}
            max={max}
            step={step}
            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-shadow"
            disabled={saving}
          />
        )}

        {helpText && <p className="text-xs text-gray-400">{helpText}</p>}

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
