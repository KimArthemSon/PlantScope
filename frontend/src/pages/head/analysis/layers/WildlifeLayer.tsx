// src/pages/multicriteria/layers/WildlifeStatusLayer.tsx
import { useState, useEffect } from "react";
import {
  
  Leaf,
  AlertTriangle,
  CheckCircle,
  Bug,
  Trash2,
  Plus,
  Info,
} from "lucide-react";
import type { LayerData, SiteData } from "../types/mcda";

interface Props {
  siteData: SiteData | null;
  layerData?: LayerData;
  isLoading: boolean;
  onSubmit: (data: Record<string, any>, comment?: string) => Promise<boolean>;
}

// Ecological status options mapped directly to MCDA scoring rules
const ECOLOGICAL_OPTIONS = [
  {
    value: "Healthy",
    label: "🌿 Healthy Ecosystem",
    desc: "Native species present, balanced biodiversity",
    score: 85,
    verdict: "PASS",
    color: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
  {
    value: "Degraded",
    label: "🥀 Degraded Area",
    desc: "Reduced biodiversity, some native species missing",
    score: 50,
    verdict: "WARNING",
    color: "bg-amber-100 text-amber-800 border-amber-200",
  },
  {
    value: "Infested",
    label: "🐛 Invasive Infestation",
    desc: "Dominant invasive plants (e.g., Hagonoy, Cogon)",
    score: 10,
    verdict: "FAIL",
    color: "bg-red-100 text-red-800 border-red-200",
  },
  {
    value: "Critical Habitat",
    label: "🚫 Critical Habitat",
    desc: "Endangered species nesting/feeding ground",
    score: 0,
    verdict: "AUTO_REJECT",
    color: "bg-red-100 text-red-800 border-red-200",
    veto: true,
  },
];

export default function WildlifeStatusLayer({
  siteData,
  layerData,
  isLoading,
  onSubmit,
}: Props) {
  // Form state
  const [ecologicalStatus, setEcologicalStatus] = useState("");
  const [speciesSighted, setSpeciesSighted] = useState<string[]>([]);
  const [newSpecies, setNewSpecies] = useState("");
  const [signsOfActivity, setSignsOfActivity] = useState("");
  const [invasivePlantsPresent, setInvasivePlantsPresent] = useState(false);
  const [biodiversityNotes, setBiodiversityNotes] = useState("");
  const [leaderComment, setLeaderComment] = useState(
    layerData?.leader_comment || "",
  );

  // Load existing data if already submitted
  useEffect(() => {
    if (layerData?.final_agreed_data) {
      setEcologicalStatus(layerData.final_agreed_data.ecological_status || "");
      setSpeciesSighted(layerData.final_agreed_data.species_sighted || []);
      setSignsOfActivity(layerData.final_agreed_data.signs_of_activity || "");
      setInvasivePlantsPresent(
        layerData.final_agreed_data.invasive_plants_present ?? false,
      );
      setBiodiversityNotes(
        layerData.final_agreed_data.biodiversity_notes || "",
      );
    }
  }, [layerData]);

  // Add species to sighting list
  const addSpecies = () => {
    const trimmed = newSpecies.trim();
    if (trimmed && !speciesSighted.includes(trimmed)) {
      setSpeciesSighted((prev) => [...prev, trimmed]);
      setNewSpecies("");
    }
  };

  // Remove species from sighting list
  const removeSpecies = (species: string) => {
    setSpeciesSighted((prev) => prev.filter((s) => s !== species));
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!ecologicalStatus) {
      alert("Please select an ecological status");
      return;
    }
    if (ecologicalStatus === "Critical Habitat") {
      if (
        !window.confirm(
          '⚠️ WARNING: "Critical Habitat" triggers automatic rejection (Veto). This site cannot proceed with reforestation. Continue?',
        )
      ) {
        return;
      }
    }

    const finalAgreedData = {
      ecological_status: ecologicalStatus,
      species_sighted: speciesSighted,
      signs_of_activity: signsOfActivity || "None observed",
      invasive_plants_present: invasivePlantsPresent,
      biodiversity_notes: biodiversityNotes,
    };

    await onSubmit(finalAgreedData, leaderComment);
  };

  // Get selected option data
  const selectedOption = ECOLOGICAL_OPTIONS.find(
    (o) => o.value === ecologicalStatus,
  );

  // ============ READ-ONLY VIEW (After Submission) ============
  if (layerData?.result) {
    const isVeto = layerData.result.critical_flag;
    const isCritical = ecologicalStatus === "Critical Habitat";

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <span>🦌</span> Wildlife & Ecology Assessment
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Biodiversity impact & habitat protection
            </p>
          </div>
          <span
            className={`px-4 py-1.5 rounded-full text-sm font-bold ${
              isVeto
                ? "bg-red-100 text-red-700"
                : layerData.result.verdict === "PASS"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-amber-100 text-amber-700"
            }`}
          >
            {layerData.result.verdict}
          </span>
        </div>

        {/* Critical Habitat Warning */}
        {isCritical && (
          <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle
                size={24}
                className="text-red-600 flex-shrink-0 mt-0.5"
              />
              <div>
                <h4 className="font-bold text-red-800">
                  ⚠️ Critical Habitat Designated
                </h4>
                <p className="text-sm text-red-700 mt-1">
                  This area contains endangered species habitats. Reforestation
                  is prohibited to protect native wildlife. Project must be
                  relocated.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Submitted Data Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Ecology Status */}
          <div className="bg-gray-50 rounded-xl p-4">
            <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
              <Leaf size={18} className="text-emerald-600" />
              Ecological Status
            </h4>
            <div
              className={`p-3 rounded-lg border ${selectedOption?.color || "bg-gray-100 text-gray-700 border-gray-200"}`}
            >
              <span className="font-bold text-sm">
                {selectedOption?.label || ecologicalStatus}
              </span>
              <p className="text-xs mt-1 opacity-80">{selectedOption?.desc}</p>
            </div>
            <div className="mt-3 text-sm">
              <span className="text-gray-500">Invasive Plants Present:</span>
              <p
                className={`font-semibold ${layerData.final_agreed_data.invasive_plants_present ? "text-red-600" : "text-emerald-600"}`}
              >
                {layerData.final_agreed_data.invasive_plants_present
                  ? "⚠️ Yes - Clearing required"
                  : "✅ No - Safe to proceed"}
              </p>
            </div>
          </div>

          {/* Species & Activity */}
          <div className="bg-gray-50 rounded-xl p-4">
            <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
              <Bug size={18} className="text-blue-600" />
              Wildlife Observations
            </h4>
            {speciesSighted.length > 0 && (
              <div className="mb-3">
                <span className="text-xs text-gray-500 uppercase font-medium">
                  Species Sighted
                </span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {speciesSighted.map((species, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center px-2.5 py-1 bg-white border border-gray-200 rounded-full text-xs font-medium text-gray-700"
                    >
                      🐾 {species}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="text-sm">
              <span className="text-gray-500">Signs of Activity:</span>
              <p className="text-gray-700 mt-0.5">
                {layerData.final_agreed_data.signs_of_activity}
              </p>
            </div>
            <div className="mt-2 text-sm">
              <span className="text-gray-500">Biodiversity Notes:</span>
              <p className="text-gray-600 italic mt-0.5">
                {layerData.final_agreed_data.biodiversity_notes || "None"}
              </p>
            </div>
          </div>
        </div>

        {/* Calculated Result */}
        <div
          className={`rounded-xl p-5 border-2 ${
            isVeto
              ? "bg-red-50 border-red-200"
              : "bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-100"
          }`}
        >
          <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            📊 Calculated Result
            {isVeto && <AlertTriangle size={18} className="text-red-600" />}
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500 block text-xs">
                Normalized Score
              </span>
              <strong className="text-lg text-gray-800">
                {layerData.result.normalized_score}/100
              </strong>
            </div>
            <div>
              <span className="text-gray-500 block text-xs">Weight</span>
              <strong className="text-lg text-gray-800">
                {layerData.result.weight_percentage}%
              </strong>
            </div>
            <div>
              <span className="text-gray-500 block text-xs">
                Weighted Score
              </span>
              <strong
                className={`text-lg ${isVeto ? "text-red-600" : "text-emerald-600"}`}
              >
                +{layerData.result.weighted_score}
              </strong>
            </div>
            <div>
              <span className="text-gray-500 block text-xs">Veto</span>
              <strong
                className={`text-lg ${isVeto ? "text-red-600" : "text-emerald-600"}`}
              >
                {isVeto ? "⚠️ YES" : "No"}
              </strong>
            </div>
          </div>

          {layerData.result.derived_mitigation &&
            layerData.result.derived_mitigation !== "None." && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm">
                  <span className="font-medium text-gray-700">
                    Ecological Action:
                  </span>
                  <span className="text-gray-600 ml-2">
                    {layerData.result.derived_mitigation}
                  </span>
                </p>
              </div>
            )}
        </div>

        {/* Leader Comment */}
        {layerData.leader_comment && (
          <div className="mt-4 p-4 bg-indigo-50 rounded-lg border border-indigo-100">
            <p className="text-xs text-indigo-600 uppercase font-semibold mb-1">
              Leader Consensus Notes
            </p>
            <p className="text-sm text-gray-700">{layerData.leader_comment}</p>
          </div>
        )}
      </div>
    );
  }

  // ============ EDIT FORM (Leader Input) ============
  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
    >
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <span>🦌</span> Wildlife & Ecology Assessment
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          Evaluate biodiversity impact and identify critical habitats or
          invasive threats
        </p>
      </div>

      {/* Ecological Status Selection */}
      <fieldset className="mb-6 pb-6 border-b border-gray-100">
        <legend className="font-semibold text-gray-800 mb-4">
          1. Ecological Status <span className="text-rose-500">*</span>
        </legend>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {ECOLOGICAL_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                ecologicalStatus === option.value
                  ? `${option.color} border-current`
                  : "border-gray-200 hover:border-gray-300"
              } ${option.veto ? "border-red-200" : ""}`}
            >
              <input
                type="radio"
                name="ecologicalStatus"
                value={option.value}
                checked={ecologicalStatus === option.value}
                onChange={(e) => setEcologicalStatus(e.target.value)}
                className="mt-1 w-4 h-4 text-emerald-600"
              />
              <div className="flex-1">
                <span
                  className={`font-semibold block ${option.veto ? "text-red-800" : ""}`}
                >
                  {option.label}
                </span>
                <span className="text-xs opacity-80">{option.desc}</span>
                <div className="flex items-center gap-2 mt-2 text-xs font-medium">
                  <span className="bg-white/60 px-2 py-0.5 rounded">
                    Score: {option.score}
                  </span>
                  <span className="bg-white/60 px-2 py-0.5 rounded">
                    {option.verdict}
                  </span>
                  {option.veto && (
                    <span className="bg-red-200 text-red-800 px-2 py-0.5 rounded">
                      ⚠️ VETO
                    </span>
                  )}
                </div>
              </div>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Species & Activity Observations */}
      <fieldset className="mb-6 pb-6 border-b border-gray-100">
        <legend className="font-semibold text-gray-800 mb-4">
          2. Field Observations
        </legend>

        {/* Species Sighted */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Species Sighted (Fauna)
          </label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={newSpecies}
              onChange={(e) => setNewSpecies(e.target.value)}
              placeholder="e.g., Wild Boar, Monitor Lizard, Philippine Eagle"
              className="flex-1 p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
              onKeyPress={(e) =>
                e.key === "Enter" && (e.preventDefault(), addSpecies())
              }
            />
            <button
              type="button"
              onClick={addSpecies}
              className="flex items-center gap-1 px-3 py-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 text-sm font-medium"
            >
              <Plus size={16} /> Add
            </button>
          </div>
          {speciesSighted.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {speciesSighted.map((species, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 border border-gray-200 rounded-full text-sm text-gray-700"
                >
                  🐾 {species}
                  <button
                    type="button"
                    onClick={() => removeSpecies(species)}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Signs of Activity */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Signs of Activity
          </label>
          <input
            type="text"
            value={signsOfActivity}
            onChange={(e) => setSignsOfActivity(e.target.value)}
            placeholder="e.g., Footprints near water source, bird nests in canopy"
            className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Invasive Plants Toggle */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Invasive Plants Present?
          </label>
          <div className="flex gap-4">
            <label
              className={`flex-1 flex items-center justify-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                !invasivePlantsPresent
                  ? "border-emerald-500 bg-emerald-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <input
                type="radio"
                name="invasivePlants"
                checked={!invasivePlantsPresent}
                onChange={() => setInvasivePlantsPresent(false)}
                className="w-4 h-4 text-emerald-600"
              />
              <span className="font-semibold text-emerald-700">
                ✅ No Invasives
              </span>
              <span className="text-sm text-gray-500">- Safe to proceed</span>
            </label>

            <label
              className={`flex-1 flex items-center justify-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                invasivePlantsPresent
                  ? "border-red-500 bg-red-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <input
                type="radio"
                name="invasivePlants"
                checked={invasivePlantsPresent}
                onChange={() => setInvasivePlantsPresent(true)}
                className="w-4 h-4 text-red-600"
              />
              <span className="font-semibold text-red-700">
                ⚠️ Invasives Present
              </span>
              <span className="text-sm text-gray-500">- Clearing required</span>
            </label>
          </div>
        </div>

        {/* Biodiversity Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Biodiversity Notes
          </label>
          <textarea
            value={biodiversityNotes}
            onChange={(e) => setBiodiversityNotes(e.target.value)}
            placeholder="e.g., Healthy undergrowth observed. No critical species nesting detected..."
            className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
            rows={3}
          />
        </div>
      </fieldset>

      {/* Leader Consensus Comment */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Leader Consensus Comment
        </label>
        <textarea
          value={leaderComment}
          onChange={(e) => setLeaderComment(e.target.value)}
          placeholder="Document team agreement on ecological impact and monitoring requirements..."
          className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
          rows={2}
        />
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading || !ecologicalStatus}
        className={`w-full py-3.5 px-6 rounded-xl font-semibold transition-all ${
          !isLoading && ecologicalStatus
            ? ecologicalStatus === "Critical Habitat"
              ? "bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white shadow-md hover:shadow-lg"
              : "bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-md hover:shadow-lg"
            : "bg-gray-100 text-gray-400 cursor-not-allowed"
        }`}
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="animate-spin">⏳</span> Submitting Wildlife
            Assessment...
          </span>
        ) : ecologicalStatus === "Critical Habitat" ? (
          "🚫 Submit with Critical Habitat (Auto-Reject)"
        ) : (
          "💾 Save Wildlife Assessment (10% Weight)"
        )}
      </button>

      {/* Validation & Info */}
      {!ecologicalStatus && (
        <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-800 font-medium mb-1">
            ⚠️ Incomplete Assessment
          </p>
          <p className="text-xs text-amber-700">
            • Select an ecological status to proceed
          </p>
        </div>
      )}

      <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-lg">
        <div className="flex items-start gap-2">
          <Info size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-blue-800 font-medium">
              💡 Scientific Note
            </p>
            <p className="text-xs text-blue-700 mt-1">
              Reforestation should enhance native biodiversity. "Critical
              Habitat" designation triggers immediate veto to protect endangered
              species. Invasive species require clearing before planting to
              prevent competition.
            </p>
          </div>
        </div>
      </div>
    </form>
  );
}
