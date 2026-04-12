import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Shield,
  MapPin,
  Leaf,
  X,
  Save,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  Layers,
  Map,
} from "lucide-react";
import type { SiteDetail } from "../types/siteTypes";

interface SiteValidationPanelProps {
  site: SiteDetail | null;
  isOpen: boolean;
  onClose: () => void;
  onSaveDraft: (layerName: string, data: any) => Promise<boolean>;
  onFinalize: (decision: "ACCEPT" | "REJECT") => Promise<boolean>;
  loading: boolean;
}

// ✅ PLANTSCOPE v5.0: Type-safe layer ID type
type LayerId = "safety" | "boundary_verification" | "survivability";

// ✅ PLANTSCOPE v5.0: Layer Configuration per Documentation (moved outside component)
const LAYERS: Array<{
  id: LayerId;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  bg: string;
  border: string;
  acceptanceField: string;
  riskField?: string;
  complianceField?: string;
  acceptanceOptions: string[];
  riskOptions?: string[];
  complianceOptions?: string[];
  additionalFields: Array<{
    name: string;
    label: string;
    type: "text" | "textarea" | "select" | "checkbox";
    options?: string[];
  }>;
}> = [
  {
    id: "safety",
    label: "Safety",
    icon: Shield,
    color: "text-red-600",
    bg: "bg-red-50",
    border: "border-red-200",
    acceptanceField: "safety_acceptance",
    riskField: "safety_risk_level",
    acceptanceOptions: ["ACCEPT", "REJECT", "ACCEPT_WITH_MITIGATION"],
    riskOptions: ["LOW", "MODERATE", "HIGH"],
    additionalFields: [
      { name: "mitigation_required", label: "Mitigation Required (comma-separated)", type: "text" },
      { name: "validation_notes", label: "Validation Notes", type: "textarea" },
    ],
  },
  {
    id: "boundary_verification",
    label: "Boundary Verification",
    icon: MapPin,
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
    acceptanceField: "boundary_acceptance",
    complianceField: "boundary_compliance_status",
    acceptanceOptions: ["ACCEPT", "REJECT", "ACCEPT_WITH_ADJUSTMENT"],
    complianceOptions: ["FULLY_COMPLIANT", "MINOR_DEVIATION", "NON_COMPLIANT"],
    additionalFields: [
      { name: "polygon_adjustment_required", label: "Polygon Adjustment Required", type: "checkbox" },
      { name: "buffer_violations", label: "Buffer Violations (comma-separated)", type: "text" },
      { name: "validation_notes", label: "Validation Notes", type: "textarea" },
    ],
  },
  {
    id: "survivability",
    label: "Survivability",
    icon: Leaf,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    acceptanceField: "overall_survivability_decision",
    acceptanceOptions: ["ACCEPT", "REJECT", "ACCEPT_WITH_CONDITIONS"],
    additionalFields: [
      { name: "soil_suitability_level", label: "Soil Suitability", type: "select", options: ["HIGH", "MODERATE", "LOW"] },
      { name: "soil_acceptance", label: "Soil Acceptance", type: "select", options: ["ACCEPT", "REJECT", "ACCEPT_WITH_AMENDMENT"] },
      { name: "water_suitability_level", label: "Water Suitability", type: "select", options: ["ADEQUATE", "MARGINAL", "INSUFFICIENT"] },
      { name: "water_acceptance", label: "Water Acceptance", type: "select", options: ["ACCEPT", "REJECT", "ACCEPT_WITH_IRRIGATION"] },
      { name: "competition_level", label: "Competition Level", type: "select", options: ["LOW", "MODERATE", "HIGH"] },
      { name: "competition_acceptance", label: "Competition Acceptance", type: "select", options: ["ACCEPT", "REJECT", "ACCEPT_WITH_CLEARING"] },
      { name: "species_recommendations", label: "Species Recommendations (comma-separated)", type: "text" },
      { name: "validation_notes", label: "Validation Notes", type: "textarea" },
    ],
  },
];

// ✅ HELPER: Type-safe accessor for MCDA layer data (outside component)
const getLayerData = (
  mcda: Record<LayerId, any> | undefined,
  layerId: LayerId,
): any | undefined => {
  return mcda?.[layerId];
};

// ✅ LayerField component moved OUTSIDE main component to avoid re-creation
const LayerField = ({
  label,
  field,
  type = "text",
  options,
  required = false,
  value,
  onChange,
  error,
}: {
  label: string;
  field: string;
  type?: "text" | "textarea" | "select" | "checkbox";
  options?: string[];
  required?: boolean;
  value: any;
  onChange: (field: string,  any) => void;
  error?: string;
}) => {
  return (
    <div className="mb-4">
      <label className="block text-[10px] font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      {type === "textarea" ? (
        <textarea
          value={value ?? ""}
          onChange={(e) => onChange(field, e.target.value)}
          className={`w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 transition ${
            error ? "border-red-300 bg-red-50" : "border-gray-200"
          }`}
          rows={3}
          placeholder={`Enter ${label.toLowerCase()}...`}
        />
      ) : type === "select" ? (
        <select
          value={value ?? ""}
          onChange={(e) => onChange(field, e.target.value)}
          className={`w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 transition ${
            error ? "border-red-300 bg-red-50" : "border-gray-200"
          }`}
        >
          <option value="">Select {label.toLowerCase()}...</option>
          {options?.map((opt) => (
            <option key={opt} value={opt}>{opt.replace(/_/g, " ")}</option>
          ))}
        </select>
      ) : type === "checkbox" ? (
        <label className="flex items-center gap-2 text-xs text-gray-700">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(field, e.target.checked)}
            className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
          />
          {label}
        </label>
      ) : (
        <input
          type={type}
          value={value ?? ""}
          onChange={(e) => onChange(field, e.target.value)}
          className={`w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 transition ${
            error ? "border-red-300 bg-red-50" : "border-gray-200"
          }`}
          placeholder={`Enter ${label.toLowerCase()}...`}
        />
      )}

      {error && (
        <p className="mt-1 text-[10px] text-red-500 flex items-center gap-1">
          <AlertTriangle size={10} /> {error}
        </p>
      )}
    </div>
  );
};

export default function SiteValidationPanel({
  site,
  isOpen,
  onClose,
  onSaveDraft,
  onFinalize,
  loading,
}: SiteValidationPanelProps) {
  // ✅ ALL HOOKS CALLED FIRST - No early returns before this point
  const [activeLayer, setActiveLayer] = useState<LayerId>("safety");
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // ✅ useMemo hooks - always called, never skipped
  const activeLayerConfig = useMemo(() => {
    return LAYERS.find((l) => l.id === activeLayer) || LAYERS[0];
  }, [activeLayer]);

  const currentLayerData = useMemo(() => {
    if (!site) return {};
    return (
      getLayerData(site.current_draft_mcda, activeLayer) ||
      getLayerData(site.finalized_mcda, activeLayer) ||
      {}
    );
  }, [site, activeLayer]);

  // ✅ Reset form when layer or site changes
  useEffect(() => {
    if (!site) return;
    const layerData =
      getLayerData(site.current_draft_mcda, activeLayer) ||
      getLayerData(site.finalized_mcda, activeLayer);
    setFormData(layerData ? { ...layerData } : {});
    setFormErrors({});
  }, [activeLayer, site]);

  // ✅ Validate form before save/finalize
  const validateForm = useCallback((): boolean => {
    const errors: Record<string, string> = {};

    if (!formData[activeLayerConfig.acceptanceField]) {
      errors[activeLayerConfig.acceptanceField] = "Acceptance decision is required";
    }

    if (activeLayer === "safety" && formData.safety_acceptance === "ACCEPT_WITH_MITIGATION") {
      if (!formData.mitigation_required || formData.mitigation_required.trim() === "") {
        errors.mitigation_required = "Please specify required mitigations";
      }
    }

    if (activeLayer === "boundary_verification" && formData.boundary_acceptance === "ACCEPT_WITH_ADJUSTMENT") {
      if (!formData.polygon_adjustment_required) {
        errors.polygon_adjustment_required = "Mark if polygon adjustment is needed";
      }
    }

    if (activeLayer === "survivability" && !formData.overall_survivability_decision) {
      errors.overall_survivability_decision = "Overall survivability decision is required";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData, activeLayer, activeLayerConfig]);

  // ✅ Memoized layer completion check
  const isLayerComplete = useCallback(
    (layerId: LayerId): boolean => {
      if (!site) return false;
      const layerData =
        getLayerData(site.current_draft_mcda, layerId) ||
        getLayerData(site.finalized_mcda, layerId);
      const config = LAYERS.find((l) => l.id === layerId);
      return !!(config && layerData?.[config.acceptanceField]);
    },
    [site],
  );

  const handleSaveDraft = async () => {
    if (!validateForm()) {
      alert("Please fix validation errors before saving.");
      return;
    }
    setSaving(true);
    try {
      const success = await onSaveDraft(activeLayer, formData);
      alert(success ? "Draft saved successfully!" : "Failed to save draft. Please try again.");
    } catch (err) {
      console.error("Save draft error:", err);
      alert("Error saving draft: " + (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleFinalize = async (decision: "ACCEPT" | "REJECT") => {
    if (!validateForm()) {
      alert("Please complete all required fields in this layer before finalizing.");
      return;
    }

    if (!site) return;

    console.log("🔍 Finalize check - Draft MCDA data:", {
      safety: getLayerData(site.current_draft_mcda, "safety"),
      boundary_verification: getLayerData(site.current_draft_mcda, "boundary_verification"),
      survivability: getLayerData(site.current_draft_mcda, "survivability"),
    });

    const incompleteLayers = LAYERS.filter((layer) => {
      const layerData = getLayerData(site.current_draft_mcda, layer.id);
      const acceptanceValue = layerData?.[layer.acceptanceField];
      console.log(`Layer ${layer.id}: acceptanceField="${layer.acceptanceField}", value="${acceptanceValue}"`);
      return !acceptanceValue || acceptanceValue.trim() === "";
    });

    if (incompleteLayers.length > 0) {
      const layerNames = incompleteLayers.map((l) => l.label).join(", ");
      const missingFields = incompleteLayers.map((l) => `${l.label} (${l.acceptanceField})`).join(", ");
      alert(
        `❌ Incomplete Validation\n\nThe following layers are missing acceptance decisions:\n• ${layerNames}\n\nRequired fields:\n• ${missingFields}\n\nPlease complete all 3 MCDA layers before finalizing the site.`
      );
      return;
    }

    const actionText = decision === "ACCEPT" ? "ACCEPT" : "REJECT";
    if (!confirm(`⚠️ Confirm ${actionText}\n\nAre you sure you want to ${actionText.toLowerCase()} the site "${site.name}"?\n\nThis action will:\n• Archive the current draft version\n• Set site status to "${decision.toLowerCase()}"\n• Cannot be undone\n\nClick OK to proceed.`)) {
      return;
    }

    try {
      console.log(`🚀 Calling finalize API: decision=${decision}, siteId=${site.site_id}`);
      const success = await onFinalize(decision);

      if (success) {
        const successMsg = decision === "ACCEPT"
          ? `✅ Site "${site.name}" ACCEPTED successfully!\n\nThe site is now ready for planting allocation.`
          : `❌ Site "${site.name}" REJECTED.\n\nThe site has been excluded from reforestation planning.`;
        alert(successMsg);
        onClose();
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("sitesListRefresh"));
        }
      } else {
        console.error("Finalize API returned failure:", success);
        alert(`❌ Finalize Failed\n\nThe server could not process your request.\nPlease check:\n• All 3 layers have acceptance decisions saved\n• Your internet connection\n• Then try again.`);
      }
    } catch (err: any) {
      console.error("💥 Finalize exception:", err);
      let errorMsg = (err as Error).message || "Unknown error";
      if (errorMsg.includes("missing") && errorMsg.includes("acceptance")) {
        alert(`❌ Validation Error\n\n${errorMsg}\n\nPlease save drafts for all incomplete layers first, then try finalizing again.`);
      } else if (errorMsg.includes("No draft") || errorMsg.includes("404")) {
        alert(`❌ Data Error\n\n${errorMsg}\n\nThe site draft could not be found. Please refresh the page and try again.`);
      } else if (errorMsg.includes("500") || errorMsg.includes("Internal")) {
        alert(`❌ Server Error\n\n${errorMsg}\n\nPlease contact your system administrator if this persists.`);
      } else {
        alert(`❌ Error Finalizing Site\n\n${errorMsg}\n\nPlease try again or contact support if the issue persists.`);
      }
    }
  };

  // ✅ Handler for LayerField onChange
  const handleFieldChange = useCallback((field: string,  any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  // ✅ RENDER LOGIC - Conditional display via CSS/JSX, NOT early return
  if (!isOpen || !site) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-[2000] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className={`px-4 py-3 ${activeLayerConfig.bg} border-b ${activeLayerConfig.border} rounded-t-xl`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <activeLayerConfig.icon size={20} className={activeLayerConfig.color} />
              <div>
                <h3 className="font-bold text-gray-900">Validate Site: {site.name}</h3>
                <p className="text-xs text-gray-600">Layer: {activeLayerConfig.label} • Status: {site.status}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-white/50 rounded-lg transition" title="Close panel">
              <X size={18} className="text-gray-600" />
            </button>
          </div>
        </div>

        {/* Layer Tabs */}
        <div className="flex border-b border-gray-200 px-4 bg-gray-50">
          {LAYERS.map((layer) => {
            const isActive = layer.id === activeLayer;
            const isComplete = isLayerComplete(layer.id);
            return (
              <button
                key={layer.id}
                onClick={() => setActiveLayer(layer.id)}
                className={`flex-1 py-2.5 text-xs font-semibold transition relative border-b-2 flex items-center justify-center gap-1 ${
                  isActive ? `${layer.color} border-current bg-white` : "text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-100"
                }`}
              >
                <layer.icon size={12} />
                {layer.label}
                {isComplete && <CheckCircle size={10} className="text-green-600" />}
                {!isComplete && isActive && <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-400 rounded-full animate-pulse" />}
              </button>
            );
          })}
        </div>

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto p-4 bg-white">
          <div className={`mb-4 p-3 rounded-lg border ${activeLayerConfig.border} ${activeLayerConfig.bg}`}>
            <div className="flex items-start gap-2">
              <Info size={14} className={`${activeLayerConfig.color} mt-0.5 flex-shrink-0`} />
              <p className="text-[10px] text-gray-700">
                {activeLayer === "safety" && "Assess geophysical hazards: landslides, floods, erosion. Safety is non-negotiable."}
                {activeLayer === "boundary_verification" && "Verify spatial compliance: markers, riparian buffers, slope limits per DENR guidelines."}
                {activeLayer === "survivability" && "Evaluate ecological capacity: soil, water, competition. Recommend suitable species."}
              </p>
            </div>
          </div>

          {activeLayer === "safety" && (
            <>
              <LayerField label="Safety Risk Level" field="safety_risk_level" type="select" options={activeLayerConfig.riskOptions} required value={formData.safety_risk_level} onChange={handleFieldChange} error={formErrors.safety_risk_level} />
              <LayerField label="Safety Acceptance Decision" field="safety_acceptance" type="select" options={activeLayerConfig.acceptanceOptions} required value={formData.safety_acceptance} onChange={handleFieldChange} error={formErrors.safety_acceptance} />
              {formData.safety_acceptance === "ACCEPT_WITH_MITIGATION" && (
                <LayerField label="Required Mitigations (comma-separated)" field="mitigation_required" type="text" required value={formData.mitigation_required} onChange={handleFieldChange} error={formErrors.mitigation_required} />
              )}
              <LayerField label="Validation Notes" field="validation_notes" type="textarea" value={formData.validation_notes} onChange={handleFieldChange} error={formErrors.validation_notes} />
            </>
          )}

          {activeLayer === "boundary_verification" && (
            <>
              <LayerField label="Boundary Compliance Status" field="boundary_compliance_status" type="select" options={activeLayerConfig.complianceOptions} required value={formData.boundary_compliance_status} onChange={handleFieldChange} error={formErrors.boundary_compliance_status} />
              <LayerField label="Boundary Acceptance Decision" field="boundary_acceptance" type="select" options={activeLayerConfig.acceptanceOptions} required value={formData.boundary_acceptance} onChange={handleFieldChange} error={formErrors.boundary_acceptance} />
              <LayerField label="Polygon Adjustment Required" field="polygon_adjustment_required" type="checkbox" value={formData.polygon_adjustment_required} onChange={handleFieldChange} error={formErrors.polygon_adjustment_required} />
              {formData.boundary_acceptance === "ACCEPT_WITH_ADJUSTMENT" && (
                <LayerField label="Buffer Violations (comma-separated)" field="buffer_violations" type="text" value={formData.buffer_violations} onChange={handleFieldChange} error={formErrors.buffer_violations} />
              )}
              <LayerField label="Validation Notes" field="validation_notes" type="textarea" value={formData.validation_notes} onChange={handleFieldChange} error={formErrors.validation_notes} />
            </>
          )}

          {activeLayer === "survivability" && (
            <>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <LayerField label="Soil Suitability" field="soil_suitability_level" type="select" options={["HIGH", "MODERATE", "LOW"]} value={formData.soil_suitability_level} onChange={handleFieldChange} error={formErrors.soil_suitability_level} />
                <LayerField label="Soil Acceptance" field="soil_acceptance" type="select" options={["ACCEPT", "REJECT", "ACCEPT_WITH_AMENDMENT"]} value={formData.soil_acceptance} onChange={handleFieldChange} error={formErrors.soil_acceptance} />
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <LayerField label="Water Suitability" field="water_suitability_level" type="select" options={["ADEQUATE", "MARGINAL", "INSUFFICIENT"]} value={formData.water_suitability_level} onChange={handleFieldChange} error={formErrors.water_suitability_level} />
                <LayerField label="Water Acceptance" field="water_acceptance" type="select" options={["ACCEPT", "REJECT", "ACCEPT_WITH_IRRIGATION"]} value={formData.water_acceptance} onChange={handleFieldChange} error={formErrors.water_acceptance} />
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <LayerField label="Competition Level" field="competition_level" type="select" options={["LOW", "MODERATE", "HIGH"]} value={formData.competition_level} onChange={handleFieldChange} error={formErrors.competition_level} />
                <LayerField label="Competition Acceptance" field="competition_acceptance" type="select" options={["ACCEPT", "REJECT", "ACCEPT_WITH_CLEARING"]} value={formData.competition_acceptance} onChange={handleFieldChange} error={formErrors.competition_acceptance} />
              </div>
              <LayerField label="Overall Survivability Decision" field="overall_survivability_decision" type="select" options={activeLayerConfig.acceptanceOptions} required value={formData.overall_survivability_decision} onChange={handleFieldChange} error={formErrors.overall_survivability_decision} />
              <LayerField label="Species Recommendations (comma-separated)" field="species_recommendations" type="text" value={formData.species_recommendations} onChange={handleFieldChange} error={formErrors.species_recommendations} />
              <LayerField label="Validation Notes" field="validation_notes" type="textarea" value={formData.validation_notes} onChange={handleFieldChange} error={formErrors.validation_notes} />
            </>
          )}

          {currentLayerData.inspector_reference && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-[10px] font-semibold text-gray-600 uppercase mb-2 flex items-center gap-1">
                <Map size={10} /> Inspector Reference
              </p>
              <div className="text-[10px] text-gray-700 space-y-1">
                <p><strong>Source Assessment:</strong> {currentLayerData.inspector_reference.source_assessment_id}</p>
                <p><strong>Fields Considered:</strong> {currentLayerData.inspector_reference.points_considered?.join(", ") || "N/A"}</p>
                {currentLayerData.validated_location && (
                  <p className="pt-1 border-t border-gray-200 mt-1">
                    <strong>Validated Location:</strong> {currentLayerData.validated_location.latitude?.toFixed(6)}, {currentLayerData.validated_location.longitude?.toFixed(6)}<br />
                    <em className="text-gray-500">Assigned by: {currentLayerData.validated_location.assigned_by}</em>
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between gap-2 rounded-b-xl bg-gray-50">
          <button onClick={handleSaveDraft} disabled={saving || loading} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition">
            <Save size={14} /> {saving ? "Saving..." : "Save Draft"}
          </button>
          <div className="flex items-center gap-2">
            <button onClick={() => handleFinalize("REJECT")} disabled={loading || saving} className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition" title="Reject this site">
              <XCircle size={14} /> Reject
            </button>
            <button onClick={() => handleFinalize("ACCEPT")} disabled={loading || saving} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition" title="Accept this site">
              <CheckCircle size={14} /> Accept
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}