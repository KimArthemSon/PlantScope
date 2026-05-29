import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Shield,
  Leaf,
  X,
  Save,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  Route,
} from "lucide-react";
import type { SiteDetail, FieldAssessmentEvidence } from "../types/siteTypes";
import PlantScopeAlert from "@/components/alert/PlantScopeAlert";
import PlantScopeConfirm from "@/components/alert/PlantScopeConfirm";

interface SiteValidationPanelProps {
  site: SiteDetail | null;
  isOpen: boolean;
  onClose: () => void;
  onSaveDraft: (data: { safety_note?: string; survivability_note?: string; final_note?: string }) => Promise<boolean>;
  onFinalize: (decision: "ACCEPT" | "REJECT", note: string) => Promise<boolean>;
  loading: boolean;
}

type TabId = "safety" | "survivability" | "final";

const TABS: Array<{
  id: TabId;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  bg: string;
  border: string;
}> = [
  {
    id: "safety",
    label: "Safety",
    icon: Shield,
    color: "text-red-600",
    bg: "bg-red-50",
    border: "border-red-200",
  },
  {
    id: "survivability",
    label: "Survivability",
    icon: Leaf,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
  },
  {
    id: "final",
    label: "Final Decision",
    icon: CheckCircle,
    color: "text-green-600",
    bg: "bg-green-50",
    border: "border-green-200",
  },
];

export default function SiteValidationPanel({
  site,
  isOpen,
  onClose,
  onSaveDraft,
  onFinalize,
  loading,
}: SiteValidationPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>("safety");
  const [safetyNote, setSafetyNote] = useState("");
  const [survivabilityNote, setSurvivabilityNote] = useState("");
  const [finalDecision, setFinalDecision] = useState<"ACCEPT" | "REJECT" | "">("");
  const [finalNote, setFinalNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [psAlert, setPsAlert] = useState<{ type: "success" | "failed" | "error"; title: string; message: string } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; message: string; variant: "danger" | "warning"; confirmLabel: string; onConfirm: () => void } | null>(null);

  // Load existing data when site or tab changes
  useEffect(() => {
    if (!site?.validation_data) return;
    setSafetyNote(site.validation_data.safety?.decision_note || "");
    setSurvivabilityNote(site.validation_data.survivability?.decision_note || "");
    setFinalDecision(site.validation_data.final_decision || "");
    setFinalNote(site.validation_data.final_decision_note || "");
  }, [site, activeTab]);

  const activeTabConfig = useMemo(() => TABS.find(t => t.id === activeTab) || TABS[0], [activeTab]);

  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      const success = await onSaveDraft({
        safety_note: safetyNote.trim() || undefined,
        survivability_note: survivabilityNote.trim() || undefined,
        final_note: finalNote.trim() || undefined,
      });
      setPsAlert(
        success
          ? { type: "success", title: "Draft Saved", message: "Validation notes saved successfully!" }
          : { type: "error", title: "Save Failed", message: "Failed to save draft. Please try again." }
      );
    } catch (err) {
      setPsAlert({ type: "error", title: "Save Error", message: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const handleFinalize = () => {
    if (!finalDecision) {
      setPsAlert({ type: "failed", title: "Decision Required", message: "Please select Accept or Reject before finalizing." });
      return;
    }
    if (!finalNote.trim()) {
      setPsAlert({ type: "failed", title: "Note Required", message: "Please add a brief explanation for your decision." });
      return;
    }
    if (!site) return;

    setConfirmDialog({
      title: `Confirm ${finalDecision === "ACCEPT" ? "Accept" : "Reject"}`,
      message: `Are you sure you want to ${finalDecision.toLowerCase()} the site "${site.name}"? This action cannot be undone.`,
      variant: finalDecision === "ACCEPT" ? "warning" : "danger",
      confirmLabel: finalDecision,
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          const success = await onFinalize(finalDecision, finalNote.trim());
          if (success) {
            setPsAlert({
              type: "success",
              title: finalDecision === "ACCEPT" ? "Site Accepted" : "Site Rejected",
              message: finalDecision === "ACCEPT"
                ? `"${site.name}" is now ready for tree growers.`
                : `"${site.name}" has been rejected and requires re-inspection.`,
            });
            onClose();
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("sitesListRefresh"));
            }
          } else {
            setPsAlert({ type: "error", title: "Finalize Failed", message: "The server could not process your request. Please try again." });
          }
        } catch (err: any) {
          setPsAlert({ type: "error", title: "Finalize Error", message: err.message || "Unknown error" });
        }
      },
    });
  };

  // ✅ Helper: Extract safety evidence from field assessments
  const getSafetyEvidence = () => {
    if (!site?.field_evidence) return [];
    return site.field_evidence.filter(e => 
      e.meta_data?.security_concerns?.selected?.length || e.meta_data?.security_concerns?.note
    );
  };

  // ✅ Helper: Extract survivability evidence from field assessments
  const getSurvivabilityEvidence = () => {
    if (!site?.field_evidence) return [];
    return site.field_evidence.filter(e => 
      e.meta_data?.accessibility?.vehicle_access || e.meta_data?.accessibility?.notes
    );
  };

  if (!isOpen || !site) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[2000] flex items-center justify-center p-4">
      {psAlert && (
        <PlantScopeAlert
          type={psAlert.type}
          title={psAlert.title}
          message={psAlert.message}
          onClose={() => setPsAlert(null)}
        />
      )}
      {confirmDialog && (
        <PlantScopeConfirm
          title={confirmDialog.title}
          message={confirmDialog.message}
          variant={confirmDialog.variant}
          confirmLabel={confirmDialog.confirmLabel}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className={`px-4 py-3 ${activeTabConfig.bg} border-b ${activeTabConfig.border} rounded-t-xl`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <activeTabConfig.icon size={20} className={activeTabConfig.color} />
              <div>
                <h3 className="font-bold text-gray-900">Validate Site: {site.name}</h3>
                <p className="text-xs text-gray-600">Tab: {activeTabConfig.label} • Status: {site.status}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-white/50 rounded-lg transition" title="Close panel">
              <X size={18} className="text-gray-600" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-4 bg-gray-50">
          {TABS.map((tab) => {
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-2.5 text-xs font-semibold transition relative border-b-2 flex items-center justify-center gap-1 ${
                  isActive ? `${tab.color} border-current bg-white` : "text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-100"
                }`}
              >
                <tab.icon size={12} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto p-4 bg-white">
          {/* Safety Tab */}
          {activeTab === "safety" && (
            <div>
              <div className="mb-4 p-3 rounded-lg border border-red-200 bg-red-50">
                <div className="flex items-start gap-2">
                  <Info size={14} className="text-red-600 mt-0.5 flex-shrink-0" />
                  <p className="text-[10px] text-gray-700">
                    Review inspector's safety observations (armed threats, illegal activity, land conflicts). Add your assessment notes below.
                  </p>
                </div>
              </div>
              
              {/* Field Evidence Preview - Mobile Spec Structure */}
              {getSafetyEvidence().length > 0 && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-[10px] font-semibold text-gray-600 uppercase mb-2">Inspector Safety Evidence</p>
                  {getSafetyEvidence().map((e: FieldAssessmentEvidence, i: number) => (
                    <div key={i} className="text-[10px] text-gray-700 mb-2 last:mb-0">
                      <strong>{e.inspector.name}</strong> ({new Date(e.assessment_date || "").toLocaleDateString()}):
                      {e.meta_data?.security_concerns?.selected?.length > 0 && (
                        <span className="block text-red-600">
                          Concerns: {e.meta_data.security_concerns.selected.join(", ")}
                        </span>
                      )}
                      {e.meta_data?.security_concerns?.note && (
                        <span className="block italic">"{e.meta_data.security_concerns.note}"</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <label className="block text-[10px] font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Safety Decision Note
              </label>
              <textarea
                value={safetyNote}
                onChange={(e) => setSafetyNote(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 transition"
                rows={4}
                placeholder="Explain your safety assessment based on field evidence (e.g., 'No armed threats observed, land conflict resolved')..."
              />
            </div>
          )}

          {/* Survivability Tab */}
          {activeTab === "survivability" && (
            <div>
              <div className="mb-4 p-3 rounded-lg border border-emerald-200 bg-emerald-50">
                <div className="flex items-start gap-2">
                  <Info size={14} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                  <p className="text-[10px] text-gray-700">
                    Review inspector's accessibility observations (vehicle access, road conditions, route descriptions). Add your assessment notes below.
                  </p>
                </div>
              </div>
              
              {/* Field Evidence Preview - Mobile Spec Structure */}
              {getSurvivabilityEvidence().length > 0 && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-[10px] font-semibold text-gray-600 uppercase mb-2">Inspector Accessibility Evidence</p>
                  {getSurvivabilityEvidence().map((e: FieldAssessmentEvidence, i: number) => (
                    <div key={i} className="text-[10px] text-gray-700 mb-2 last:mb-0">
                      <strong>{e.inspector.name}</strong> ({new Date(e.assessment_date || "").toLocaleDateString()}):
                      {e.meta_data?.accessibility?.vehicle_access && (
                        <span className="block">Access: {e.meta_data.accessibility.vehicle_access}</span>
                      )}
                      {e.meta_data?.accessibility?.notes && (
                        <span className="block italic">"{e.meta_data.accessibility.notes}"</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <label className="block text-[10px] font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Survivability Decision Note
              </label>
              <textarea
                value={survivabilityNote}
                onChange={(e) => setSurvivabilityNote(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                rows={4}
                placeholder="Explain your survivability assessment based on field evidence (e.g., 'Vehicle accessible via 2km dirt road, suitable for tree transport')..."
              />
            </div>
          )}

          {/* Final Decision Tab */}
          {activeTab === "final" && (
            <div>
              <div className="mb-4 p-3 rounded-lg border border-green-200 bg-green-50">
                <div className="flex items-start gap-2">
                  <Info size={14} className="text-green-600 mt-0.5 flex-shrink-0" />
                  <p className="text-[10px] text-gray-700">
                    Make your final decision for the entire site based on Safety and Survivability assessments.
                  </p>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-[10px] font-semibold text-gray-700 uppercase tracking-wider mb-2">
                  Final Decision *
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="final_decision"
                      value="ACCEPT"
                      checked={finalDecision === "ACCEPT"}
                      onChange={(e) => setFinalDecision(e.target.value as "ACCEPT")}
                      className="w-4 h-4 text-green-600 border-gray-300 focus:ring-green-500"
                    />
                    <span className="font-medium text-green-700 flex items-center gap-1">
                      <CheckCircle size={14} /> Accept Site
                    </span>
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="final_decision"
                      value="REJECT"
                      checked={finalDecision === "REJECT"}
                      onChange={(e) => setFinalDecision(e.target.value as "REJECT")}
                      className="w-4 h-4 text-red-600 border-gray-300 focus:ring-red-500"
                    />
                    <span className="font-medium text-red-700 flex items-center gap-1">
                      <XCircle size={14} /> Reject Site
                    </span>
                  </label>
                </div>
              </div>

              <label className="block text-[10px] font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Final Decision Note *
              </label>
              <textarea
                value={finalNote}
                onChange={(e) => setFinalNote(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 transition"
                rows={4}
                placeholder="Explain your overall reasoning for accepting or rejecting this site (reference safety and accessibility observations)..."
                required
              />
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between gap-2 rounded-b-xl bg-gray-50">
          <button 
            onClick={handleSaveDraft} 
            disabled={saving || loading} 
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition"
          >
            <Save size={14} /> {saving ? "Saving..." : "Save Draft"}
          </button>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleFinalize} 
              disabled={loading || saving || !finalDecision || !finalNote.trim()} 
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition"
              title="Reject this site"
            >
              <XCircle size={14} /> Reject
            </button>
            <button 
              onClick={handleFinalize} 
              disabled={loading || saving || !finalDecision || !finalNote.trim()} 
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition"
              title="Accept this site"
            >
              <CheckCircle size={14} /> Accept
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}