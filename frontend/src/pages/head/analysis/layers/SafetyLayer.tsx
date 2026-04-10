// src/pages/multicriteria/layers/SafetyLayer.tsx
import { useState, useEffect } from "react";
import type {
  LayerKey,
  FieldAssessment,
  LayerValidation,
  LeaderDecision,
} from "../types/mcda";
import SideBySideComparison from "../components/SideBySideComparison";

interface Props {
  siteId: number;
  inspectorData?: FieldAssessment;      // ✅ READ-ONLY: Inspector's raw submission (right panel)
  leaderData?: LayerValidation;          // ✅ Leader's validated data (if exists)
  isLoading: boolean;
  onSubmitValidation: (                 // ✅ LEADER SUBMISSION ONLY
    data: Record<string, any>,
    decision: LeaderDecision,
    comment?: string,
    note?: string,
  ) => Promise<boolean>;
}

export default function SafetyLayer({
  siteId,
  inspectorData,
  leaderData,
  isLoading,
  onSubmitValidation,
}: Props) {
  // ✅ Leader's validated/agreed data form (manually input or pre-filled from inspector as suggestion)
  const [formData, setFormData] = useState({
    geophysical_assessment: {
      observed_hazards: [] as string[],
      risk_level: "" as "Low" | "Medium" | "High" | "Critical",
      inspector_comment_hazard: "",
    },
    human_security_assessment: {
      security_threat_level: "" as "Low" | "Medium" | "High" | "Critical",
      specific_threats: [] as string[],
      inspector_comment_security: "",
    },
  });

  // ✅ Leader decision & comments (critical for v2.0)
  const [leaderDecision, setLeaderDecision] = useState<LeaderDecision>(
    leaderData?.leader_decision || "ACCEPT",
  );
  const [leaderComment, setLeaderComment] = useState(
    leaderData?.leader_comment || "",
  );
  const [additionalNote, setAdditionalNote] = useState(
    leaderData?.additional_documentation_note || "",
  );

  // ✅ Form helpers for list management
  const [newHazard, setNewHazard] = useState("");
  const [newThreat, setNewThreat] = useState("");

  // ✅ Initialize form: Pre-fill from inspector data as suggestion (leader can modify)
  useEffect(() => {
    if (inspectorData?.final_agreed_data) {
      setFormData(inspectorData.final_agreed_data);
    }
    if (leaderData?.final_agreed_data) {
      setFormData(leaderData.final_agreed_data);
      setLeaderComment(leaderData.leader_comment || "");
      setAdditionalNote(leaderData.additional_documentation_note || "");
    }
  }, [inspectorData, leaderData]);

  const addHazard = () => {
    if (newHazard.trim()) {
      setFormData((prev) => ({
        ...prev,
        geophysical_assessment: {
          ...prev.geophysical_assessment,
          observed_hazards: [
            ...prev.geophysical_assessment.observed_hazards,
            newHazard.trim(),
          ],
        },
      }));
      setNewHazard("");
    }
  };

  const removeHazard = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      geophysical_assessment: {
        ...prev.geophysical_assessment,
        observed_hazards: prev.geophysical_assessment.observed_hazards.filter(
          (_, i) => i !== index,
        ),
      },
    }));
  };

  const addThreat = () => {
    if (newThreat.trim()) {
      setFormData((prev) => ({
        ...prev,
        human_security_assessment: {
          ...prev.human_security_assessment,
          specific_threats: [
            ...prev.human_security_assessment.specific_threats,
            newThreat.trim(),
          ],
        },
      }));
      setNewThreat("");
    }
  };

  const removeThreat = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      human_security_assessment: {
        ...prev.human_security_assessment,
        specific_threats:
          prev.human_security_assessment.specific_threats.filter(
            (_, i) => i !== index,
          ),
      },
    }));
  };

  // ✅ LEADER SUBMISSION: Validate layer with ACCEPT/REJECT
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await onSubmitValidation(
      formData,
      leaderDecision,
      leaderComment,
      additionalNote,
    );
    if (success) {
      // Keep data for potential edits
    }
  };

  // ✅ Read-only view if leader already validated this layer
  if (leaderData?.leader_decision) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <span>🛡️</span> Safety Assessment
          </h2>
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              leaderData.leader_decision === "ACCEPT"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-rose-100 text-rose-700"
            }`}
          >
            {leaderData.leader_decision}
          </span>
        </div>

        {/* ✅ Side-by-side: Inspector data (left) vs Leader validated (right) */}
        <SideBySideComparison
          layer="safety"
          inspectorData={inspectorData}
          leaderData={leaderData}
          isLeaderView={true}
        />

        {/* ✅ Leader's comment for audit trail */}
        {leaderData.leader_comment && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-xs text-gray-500 uppercase font-medium mb-1">
              Leader Notes
            </p>
            <p className="text-sm text-gray-700">{leaderData.leader_comment}</p>
          </div>
        )}
      </div>
    );
  }

  // ✅ LEADER VALIDATION FORM
  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <span>🛡️</span> Safety Assessment
        </h2>
        {leaderData?.leader_decision && (
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            leaderData.leader_decision === "ACCEPT"
              ? "bg-emerald-100 text-emerald-700"
              : "bg-rose-100 text-rose-700"
          }`}>
            Previously: {leaderData.leader_decision}
          </span>
        )}
      </div>

      {/* ✅ RIGHT PANEL: Inspector's raw submission (READ-ONLY reference) */}
      <div className="mb-6">
        <SideBySideComparison
          layer="safety"
          inspectorData={inspectorData}
          leaderData={leaderData}
          isLeaderView={true}
        />
      </div>

      {/* ✅ LEFT PANEL: Leader's validation form */}
      
      {/* Geophysical Assessment */}
      <fieldset className="mb-6 pb-6 border-b border-gray-100">
        <legend className="font-medium text-gray-700 mb-4">
          Geophysical Hazards (Leader Validation)
        </legend>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Agreed Risk Level *
          </label>
          <select
            required
            value={formData.geophysical_assessment.risk_level}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                geophysical_assessment: {
                  ...prev.geophysical_assessment,
                  risk_level: e.target.value as "Low" | "Medium" | "High" | "Critical",
                },
              }))
            }
            className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">Select agreed risk level...</option>
            <option value="Low">Low - Minimal hazards</option>
            <option value="Medium">Medium - Manageable with controls</option>
            <option value="High">High - Significant intervention needed</option>
            <option value="Critical">Critical - Immediate danger</option>
          </select>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Agreed Observed Hazards
          </label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={newHazard}
              onChange={(e) => setNewHazard(e.target.value)}
              placeholder="e.g., Loose soil on ridge"
              className="flex-1 p-2 border border-gray-200 rounded-lg"
              onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addHazard())}
            />
            <button type="button" onClick={addHazard} className="px-4 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200">
              Add
            </button>
          </div>
          {formData.geophysical_assessment.observed_hazards.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {formData.geophysical_assessment.observed_hazards.map((hazard, idx) => (
                <span key={idx} className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 rounded-full text-sm">
                  {hazard}
                  <button type="button" onClick={() => removeHazard(idx)} className="text-gray-400 hover:text-rose-500">×</button>
                </span>
              ))}
            </div>
          )}
        </div>
      </fieldset>

      {/* Human Security Assessment */}
      <fieldset className="mb-6 pb-6 border-b border-gray-100">
        <legend className="font-medium text-gray-700 mb-4">
          Human Security (Leader Validation)
        </legend>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Agreed Threat Level *
          </label>
          <select
            required
            value={formData.human_security_assessment.security_threat_level}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                human_security_assessment: {
                  ...prev.human_security_assessment,
                  security_threat_level: e.target.value as "Low" | "Medium" | "High" | "Critical",
                },
              }))
            }
            className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">Select agreed threat level...</option>
            <option value="Low">Low - Area secure</option>
            <option value="Medium">Medium - Monitor situation</option>
            <option value="High">High - Coordination required</option>
            <option value="Critical">Critical - Access restricted</option>
          </select>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Agreed Specific Threats
          </label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={newThreat}
              onChange={(e) => setNewThreat(e.target.value)}
              placeholder="e.g., Local land dispute"
              className="flex-1 p-2 border border-gray-200 rounded-lg"
              onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addThreat())}
            />
            <button type="button" onClick={addThreat} className="px-4 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200">
              Add
            </button>
          </div>
          {formData.human_security_assessment.specific_threats.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {formData.human_security_assessment.specific_threats.map((threat, idx) => (
                <span key={idx} className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 rounded-full text-sm">
                  {threat}
                  <button type="button" onClick={() => removeThreat(idx)} className="text-gray-400 hover:text-rose-500">×</button>
                </span>
              ))}
            </div>
          )}
        </div>
      </fieldset>

      {/* ✅ LEADER DECISION CONTROLS (Critical for v2.0) */}
      <div className="mb-6 p-4 bg-amber-50 rounded-xl border border-amber-100">
        <label className="block text-sm font-medium text-amber-800 mb-3">
          Leader Decision *
        </label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="leaderDecision"
              value="ACCEPT"
              checked={leaderDecision === "ACCEPT"}
              onChange={(e) => setLeaderDecision(e.target.value as LeaderDecision)}
              className="text-emerald-600"
            />
            <span className="font-medium text-emerald-700">✅ ACCEPT</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="leaderDecision"
              value="REJECT"
              checked={leaderDecision === "REJECT"}
              onChange={(e) => setLeaderDecision(e.target.value as LeaderDecision)}
              className="text-rose-600"
            />
            <span className="font-medium text-rose-700">❌ REJECT</span>
          </label>
        </div>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Leader Comment
        </label>
        <textarea
          value={leaderComment}
          onChange={(e) => setLeaderComment(e.target.value)}
          placeholder="Rationale for your decision (e.g., 'Geophysical risk manageable with standard terracing')"
          className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
          rows={3}
        />
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Additional Documentation Note
        </label>
        <textarea
          value={additionalNote}
          onChange={(e) => setAdditionalNote(e.target.value)}
          placeholder="Reference documents, maps, or external data (e.g., 'Hazard zones mapped via GPS')"
          className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
          rows={2}
        />
      </div>

      {/* ✅ Submit Button */}
      <button
        type="submit"
        disabled={
          isLoading ||
          !formData.geophysical_assessment.risk_level ||
          !formData.human_security_assessment.security_threat_level ||
          !leaderDecision
        }
        className={`w-full py-3 px-6 rounded-xl font-semibold transition-all ${
          !isLoading &&
          formData.geophysical_assessment.risk_level &&
          formData.human_security_assessment.security_threat_level &&
          leaderDecision
            ? "bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-md hover:shadow-lg"
            : "bg-gray-100 text-gray-400 cursor-not-allowed"
        }`}
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="animate-spin">⏳</span> Submitting...
          </span>
        ) : (
          `💾 Validate Safety Layer as ${leaderDecision}`
        )}
      </button>
    </form>
  );
}