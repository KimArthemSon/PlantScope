// src/pages/multicriteria/layers/TreeSpeciesLayer.tsx
import { useState, useEffect, useMemo } from "react";
import {
  TreePine,
  AlertTriangle,
  CheckCircle,
  Search,
  Plus,
  Trash2,
  ArrowRight,
  Info,
} from "lucide-react";
import type { LayerData, SiteData } from "../types/mcda";

// Interface for the API response from get_tree_species_list
interface SpeciesItem {
  tree_species_id: number; // Note: Check if your API returns this key or tree_specie_id
  name: string;
  description: string;
}

// Interface for a species in our lists
interface SelectedSpecies {
  tree_species_id: number;
  name: string;
  confidence_score?: number; // Only for Recommended
  reason: string;
}

interface Props {
  siteData: SiteData | null;
  layerData?: LayerData;
  isLoading: boolean;
  onSubmit: (data: Record<string, any>, comment?: string) => Promise<boolean>;
  onDetailsUpdate?: (payload: {
    tree_species_id?: number | null;
  }) => Promise<void>;
}

export default function TreeSpeciesLayer({
  siteData,
  layerData,
  isLoading,
  onSubmit,
  onDetailsUpdate,
}: Props) {
  // Form State
  const [speciesList, setSpeciesList] = useState<SpeciesItem[]>([]);
  const [loadingSpecies, setLoadingSpecies] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [recommended, setRecommended] = useState<SelectedSpecies[]>([]);
  const [avoid, setAvoid] = useState<SelectedSpecies[]>([]);

  const [matchQuality, setMatchQuality] = useState(""); // "High Match", "Moderate Match", "Low Match", "No Match"
  const [leaderComment, setLeaderComment] = useState(
    layerData?.leader_comment || "",
  );

  // Derived State: Auto-calculate Match Quality based on average confidence
  const avgConfidence = useMemo(() => {
    if (recommended.length === 0) return 0;
    const total = recommended.reduce(
      (sum, s) => sum + (s.confidence_score || 0),
      0,
    );
    return Math.round(total / recommended.length);
  }, [recommended]);

  // Filter species list for search
  const filteredSpecies = speciesList.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Fetch species list on mount
  useEffect(() => {
    const fetchSpecies = async () => {
      try {
        setLoadingSpecies(true);
        // Adjust URL if your API base path is different
        const res = await fetch(
          "http://localhost:8000/api/get_tree_species_list/",
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          },
        );
        if (res.ok) {
          const data = await res.json();
          setSpeciesList(data);
        }
      } catch (err) {
        console.error("Failed to fetch tree species:", err);
      } finally {
        setLoadingSpecies(false);
      }
    };
    fetchSpecies();
  }, []);

  // Load existing data if submitted
  useEffect(() => {
    if (layerData?.final_agreed_data) {
      const d = layerData.final_agreed_data;
      if (d.recommended_species) setRecommended(d.recommended_species);
      if (d.species_to_avoid) setAvoid(d.species_to_avoid);
      setMatchQuality(layerData.result?.status_input || "");
    }
  }, [layerData]);

  // Auto-update match_quality when confidence changes
  useEffect(() => {
    if (recommended.length > 0) {
      if (avgConfidence > 85) setMatchQuality("High Match");
      else if (avgConfidence > 60) setMatchQuality("Moderate Match");
      else setMatchQuality("Low Match");
    } else {
      setMatchQuality("No Match");
    }
  }, [avgConfidence]);

  const addToRecommended = (species: SpeciesItem) => {
    if (
      !recommended.find((s) => s.tree_species_id === species.tree_species_id)
    ) {
      setRecommended((prev) => [
        ...prev,
        {
          tree_species_id: species.tree_species_id,
          name: species.name,
          confidence_score: 80,
          reason: "",
        },
      ]);
    }
    setSearchQuery("");
  };

  const addToAvoid = (species: SpeciesItem) => {
    if (!avoid.find((s) => s.tree_species_id === species.tree_species_id)) {
      setAvoid((prev) => [
        ...prev,
        {
          tree_species_id: species.tree_species_id,
          name: species.name,
          reason: "",
        },
      ]);
    }
    setSearchQuery("");
  };

  const updateRecommended = (index: number, field: string, value: any) => {
    const newList = [...recommended];
    newList[index] = { ...newList[index], [field]: value };
    setRecommended(newList);
  };

  const updateAvoid = (index: number, field: string, value: any) => {
    const newList = [...avoid];
    newList[index] = { ...newList[index], [field]: value };
    setAvoid(newList);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matchQuality) {
      alert("Please determine the match quality");
      return;
    }

    const finalAgreedData = {
      recommended_species: recommended,
      species_to_avoid: avoid,
      match_quality: matchQuality,
    };

    const mcdaSuccess = await onSubmit(finalAgreedData, leaderComment);

    // Update relational DB with the Primary Species (Highest Confidence)
    if (mcdaSuccess && onDetailsUpdate && recommended.length > 0) {
      const sorted = [...recommended].sort(
        (a, b) => (b.confidence_score || 0) - (a.confidence_score || 0),
      );
      const primarySpeciesId = sorted[0].tree_species_id;
      await onDetailsUpdate({ tree_species_id: primarySpeciesId });
    }
  };

  // ============ READ-ONLY VIEW ============
  if (layerData?.result) {
    const isVeto = layerData.result.critical_flag;
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <span>🌳</span> Tree Species Suitability
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Biological matching & species recommendation
            </p>
          </div>
          <span
            className={`px-4 py-1.5 rounded-full text-sm font-bold ${
              isVeto
                ? "bg-red-100 text-red-700"
                : layerData.result.verdict === "OPTIMIZED"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-amber-100 text-amber-700"
            }`}
          >
            {layerData.result.verdict}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Recommended */}
          <div className="bg-gray-50 rounded-xl p-4">
            <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
              <TreePine size={18} className="text-emerald-600" />
              Recommended Species
            </h4>
            {layerData.final_agreed_data.recommended_species?.length > 0 ? (
              <ul className="space-y-2">
                {layerData.final_agreed_data.recommended_species.map(
                  (s: any, i: number) => (
                    <li
                      key={i}
                      className="bg-white p-3 rounded-lg border border-gray-200 text-sm"
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-gray-800">
                          {s.name}
                        </span>
                        <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-medium">
                          {s.confidence_score}% Conf.
                        </span>
                      </div>
                      <p className="text-gray-500 text-xs italic">{s.reason}</p>
                    </li>
                  ),
                )}
              </ul>
            ) : (
              <p className="text-gray-400 text-sm italic">None recommended</p>
            )}
          </div>

          {/* Avoid */}
          <div className="bg-gray-50 rounded-xl p-4">
            <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
              <AlertTriangle size={18} className="text-red-600" />
              Species to Avoid
            </h4>
            {layerData.final_agreed_data.species_to_avoid?.length > 0 ? (
              <ul className="space-y-2">
                {layerData.final_agreed_data.species_to_avoid.map(
                  (s: any, i: number) => (
                    <li
                      key={i}
                      className="bg-white p-3 rounded-lg border border-red-100 text-sm"
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-gray-800">
                          {s.name}
                        </span>
                      </div>
                      <p className="text-red-500 text-xs italic">{s.reason}</p>
                    </li>
                  ),
                )}
              </ul>
            ) : (
              <p className="text-gray-400 text-sm italic">None</p>
            )}
          </div>
        </div>

        <div
          className={`rounded-xl p-5 border-2 ${isVeto ? "bg-red-50 border-red-200" : "bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-100"}`}
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
              <strong className="text-lg">
                {layerData.result.normalized_score}/100
              </strong>
            </div>
            <div>
              <span className="text-gray-500 block text-xs">Weight</span>
              <strong className="text-lg">
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
              <span className="text-gray-500 block text-xs">Match Quality</span>
              <strong className="text-lg text-gray-800">
                {layerData.result.status_input}
              </strong>
            </div>
          </div>
          {layerData.result.derived_mitigation &&
            layerData.result.derived_mitigation !== "None." && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm">
                  <span className="font-medium text-gray-700">
                    Planting Instruction:
                  </span>
                  <span className="text-gray-600 ml-2">
                    {layerData.result.derived_mitigation}
                  </span>
                </p>
              </div>
            )}
        </div>

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

  // ============ EDIT FORM ============
  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
    >
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <span>🌳</span> Tree Species Suitability
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          Match site conditions with biological requirements. Select recommended
          species and those to avoid.
        </p>
      </div>

      {/* 1. Species Selection Tool */}
      <fieldset className="mb-6 pb-6 border-b border-gray-100">
        <legend className="font-semibold text-gray-800 mb-3">
          1. Select Species
        </legend>
        <div className="relative mb-3">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Search species list..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {loadingSpecies ? (
          <div className="flex justify-center py-4 text-gray-500">
            <span className="animate-spin">⏳</span> Loading species...
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-32 overflow-y-auto border border-gray-100 rounded-lg p-2 bg-gray-50">
            {filteredSpecies.map((species) => (
              <div
                key={species.tree_species_id}
                className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded-md hover:border-emerald-300 transition-colors"
              >
                <span className="text-sm font-medium text-gray-700 truncate">
                  {species.name}
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => addToRecommended(species)}
                    className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                    title="Add to Recommended"
                  >
                    ✅
                  </button>
                  <button
                    type="button"
                    onClick={() => addToAvoid(species)}
                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                    title="Add to Avoid"
                  >
                    ❌
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </fieldset>

      {/* 2. Recommended Species List */}
      <fieldset className="mb-6 pb-6 border-b border-gray-100">
        <legend className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <span>🌿</span> Recommended Species
        </legend>
        {recommended.length === 0 ? (
          <p className="text-sm text-gray-400 italic">
            No species recommended yet.
          </p>
        ) : (
          <div className="space-y-3">
            {recommended.map((species, index) => (
              <div
                key={index}
                className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 relative"
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="font-bold text-emerald-900 text-lg">
                    {species.name}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setRecommended((prev) =>
                        prev.filter((_, i) => i !== index),
                      )
                    }
                    className="text-red-400 hover:text-red-600"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Confidence Score (0-100)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={species.confidence_score}
                      onChange={(e) =>
                        updateRecommended(
                          index,
                          "confidence_score",
                          parseInt(e.target.value) || 0,
                        )
                      }
                      className="w-full p-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Reason
                    </label>
                    <input
                      type="text"
                      value={species.reason}
                      onChange={(e) =>
                        updateRecommended(index, "reason", e.target.value)
                      }
                      placeholder="e.g., Ideal soil, Erosion control..."
                      className="w-full p-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </fieldset>

      {/* 3. Species to Avoid */}
      <fieldset className="mb-6 pb-6 border-b border-gray-100">
        <legend className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <span>⚠️</span> Species to Avoid
        </legend>
        {avoid.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No species to avoid.</p>
        ) : (
          <div className="space-y-3">
            {avoid.map((species, index) => (
              <div
                key={index}
                className="bg-red-50 border border-red-100 rounded-xl p-4 relative"
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-red-900">{species.name}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setAvoid((prev) => prev.filter((_, i) => i !== index))
                    }
                    className="text-red-400 hover:text-red-600"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Reason to Avoid
                </label>
                <input
                  type="text"
                  value={species.reason}
                  onChange={(e) => updateAvoid(index, "reason", e.target.value)}
                  placeholder="e.g., Poor drainage tolerance, Invasive..."
                  className="w-full p-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-red-500"
                />
              </div>
            ))}
          </div>
        )}
      </fieldset>

      {/* 4. Overall Match Quality (MCDA Input) */}
      <fieldset className="mb-6 pb-6 border-b border-gray-100">
        <legend className="font-semibold text-gray-800 mb-4">
          4. Overall Match Quality <span className="text-rose-500">*</span>
        </legend>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { value: "High Match", color: "emerald", score: 88 },
            { value: "Moderate Match", color: "amber", score: 60 },
            { value: "Low Match", color: "orange", score: 20 },
            { value: "No Match", color: "red", score: 0 },
          ].map((opt) => (
            <label
              key={opt.value}
              className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 cursor-pointer transition-all ${
                matchQuality === opt.value
                  ? `border-${opt.color}-500 bg-${opt.color}-50`
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <input
                type="radio"
                name="matchQuality"
                value={opt.value}
                checked={matchQuality === opt.value}
                onChange={(e) => setMatchQuality(e.target.value)}
                className="sr-only"
              />
              <span
                className={`font-bold text-sm mb-1 ${matchQuality === opt.value ? `text-${opt.color}-800` : "text-gray-700"}`}
              >
                {opt.value}
              </span>
              <span
                className={`text-xs font-mono px-2 py-0.5 rounded-full ${matchQuality === opt.value ? `bg-${opt.color}-200 text-${opt.color}-900` : "bg-gray-100 text-gray-500"}`}
              >
                {opt.score} pts
              </span>
            </label>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
          <Info size={14} /> Auto-selected based on average confidence score,
          but can be overridden.
        </p>
      </fieldset>

      {/* 5. Leader Comment */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Leader Consensus Comment
        </label>
        <textarea
          value={leaderComment}
          onChange={(e) => setLeaderComment(e.target.value)}
          placeholder="Document team agreement on species selection and planting strategy..."
          className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 resize-none"
          rows={2}
        />
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isLoading || !matchQuality}
        className={`w-full py-3.5 px-6 rounded-xl font-semibold transition-all ${!isLoading && matchQuality ? "bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-md" : "bg-gray-100 text-gray-400 cursor-not-allowed"}`}
      >
        {isLoading
          ? "⏳ Submitting..."
          : "💾 Save Species Suitability (10% Weight)"}
      </button>
    </form>
  );
}
