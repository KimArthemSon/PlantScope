import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  Ruler,
  ShieldCheck,
  CheckCircle,
  AlertCircle,
  XCircle,
  Loader2,
  RefreshCw,
  Map as MapIcon,
  Navigation,
  Layers,
  Leaf,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  FileText,
} from "lucide-react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polygon,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});
L.Marker.prototype.options.icon = DefaultIcon;

// ─────────────────────────────────────────────
// ACCEPTANCE FIELD MAP — matches backend exactly
// ─────────────────────────────────────────────
const ACCEPTANCE_FIELD_MAP: Record<string, string> = {
  safety: "safety_acceptance",
  boundary_verification: "boundary_acceptance",
  survivability: "overall_survivability_decision",
};

// ─────────────────────────────────────────────
// INTERFACES
// ─────────────────────────────────────────────
type LayerData = Record<string, unknown>;

interface SiteData {
  safety?: LayerData;
  boundary_verification?: LayerData;
  survivability?: LayerData;
}

interface SpeciesRecommendation {
  id: number;
  name: string;
  rank: number;
  notes: string | null;
}

interface SiteResponse {
  site_id: number;
  name: string;
  status: string;
  polygon_coordinates: [number, number][] | null;
  center_coordinate: [number, number] | null;
  ndvi_value: number | null;
  area_hectares: number;
  current_draft_mcda: SiteData;
  finalized_mcda: SiteData;
  inspector_snapshots: Record<string, unknown>;
  species_recommendations: SpeciesRecommendation[];
}

interface TreeSpeciesOption {
  tree_specie_id: number;
  name: string;
  description: string;
}

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────
const LAYER_LABELS: Record<string, string> = {
  safety: "Safety",
  boundary_verification: "Boundary Verification",
  survivability: "Survivability",
};

const LAYERS = ["safety", "boundary_verification", "survivability"] as const;
type LayerKey = typeof LAYERS[number];

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  under_review: "bg-purple-100 text-purple-800 border-purple-200",
  accepted: "bg-blue-100 text-blue-800 border-blue-200",
  rejected: "bg-red-100 text-red-800 border-red-200",
  completed: "bg-green-100 text-green-800 border-green-200",
};

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

/** Get the acceptance value for a layer using the correct field name */
function getLayerAcceptance(layerData: LayerData | undefined, layerKey: string): string | undefined {
  if (!layerData) return undefined;
  const field = ACCEPTANCE_FIELD_MAP[layerKey];
  const val = layerData[field];
  return typeof val === "string" ? val : undefined;
}

function getAcceptanceColor(acceptance?: string) {
  if (!acceptance) return { bg: "bg-gray-100", text: "text-gray-500", dot: "bg-gray-300" };
  if (acceptance === "ACCEPT") return { bg: "bg-green-100", text: "text-green-700", dot: "bg-green-500" };
  if (acceptance === "REJECT") return { bg: "bg-red-100", text: "text-red-700", dot: "bg-red-500" };
  if (acceptance.startsWith("ACCEPT_WITH")) return { bg: "bg-yellow-100", text: "text-yellow-700", dot: "bg-yellow-500" };
  return { bg: "bg-gray-100", text: "text-gray-500", dot: "bg-gray-300" };
}

function computeValidationProgress(mcda: SiteData) {
  let validated = 0;
  let rejected = 0;
  for (const layer of LAYERS) {
    const acceptance = getLayerAcceptance(mcda[layer], layer);
    if (acceptance) {
      validated++;
      if (acceptance === "REJECT") rejected++;
    }
  }
  return {
    validated_layers: validated,
    total_layers: LAYERS.length,
    rejected_layers: rejected,
    is_complete: validated === LAYERS.length && rejected === 0,
  };
}

/** Safely cast unknown to string */
function asStr(val: unknown): string {
  if (val === null || val === undefined) return "";
  return String(val);
}

/** Safely cast unknown to string[] */
function asStrArr(val: unknown): string[] {
  if (Array.isArray(val)) return val.map(String);
  return [];
}

// ─────────────────────────────────────────────
// MAP
// ─────────────────────────────────────────────
const GoToCenterButton: React.FC<{ center: [number, number] }> = ({ center }) => {
  const map = useMap();
  return (
    <button
      onClick={() => map.flyTo(center, 16, { animate: true, duration: 1.5 })}
      className="absolute bottom-4 right-4 z-[400] bg-[#0F4A2F] text-white px-3 py-2 rounded-lg shadow-lg
                 hover:bg-[#0a3522] transition-colors flex items-center gap-2 text-xs font-medium"
    >
      <Navigation size={14} /> Fly to Site
    </button>
  );
};

const SiteMap: React.FC<{
  coordinates: [number, number];
  polygon?: [number, number][] | null;
  siteName?: string;
}> = ({ coordinates, polygon, siteName }) => (
  <div className="relative w-full h-64 md:h-80 rounded-xl overflow-hidden border border-gray-200">
    <MapContainer center={coordinates} zoom={16} scrollWheelZoom style={{ width: "100%", height: "100%" }}>
      <TileLayer
        url="http://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
        attribution="&copy; Google Maps"
      />
      <Marker position={coordinates}>
        <Popup>
          <strong>{siteName || "Site Location"}</strong>
          <br />Lat: {coordinates[0].toFixed(6)}
          <br />Lng: {coordinates[1].toFixed(6)}
        </Popup>
      </Marker>
      {polygon && polygon.length >= 3 && (
        <Polygon
          positions={polygon}
          pathOptions={{ color: "#0F4A2F", fillColor: "#0F4A2F", fillOpacity: 0.2, weight: 2 }}
        />
      )}
      <GoToCenterButton center={coordinates} />
    </MapContainer>
    <div className="absolute top-3 left-3 z-[400] bg-white/95 backdrop-blur px-3 py-1.5 rounded-lg
                    shadow-sm text-xs font-mono text-gray-700 border border-gray-200 flex items-center gap-1.5">
      <MapIcon className="w-3.5 h-3.5 text-[#0F4A2F]" />
      {coordinates[0].toFixed(5)}, {coordinates[1].toFixed(5)}
    </div>
  </div>
);

// ─────────────────────────────────────────────
// VALIDATION PROGRESS CARD
// ─────────────────────────────────────────────
const ValidationProgressCard: React.FC<{ mcda: SiteData }> = ({ mcda }) => {
  const { validated_layers, total_layers, rejected_layers, is_complete } = computeValidationProgress(mcda);
  const percent = total_layers > 0 ? (validated_layers / total_layers) * 100 : 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
        <Layers className="w-4 h-4 text-[#0F4A2F]" />
        <h2 className="text-sm font-semibold text-gray-800">MCDA Validation Layers</h2>
      </div>

      <div className="px-5 pt-4 pb-2">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-xs text-gray-500">{validated_layers}/{total_layers} layers validated</span>
          <span className="text-xs font-semibold text-gray-700">{Math.round(percent)}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
          <div
            className={`h-2 rounded-full transition-all duration-500 ${
              rejected_layers > 0 ? "bg-red-500" : is_complete ? "bg-green-600" : "bg-blue-500"
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>
        {rejected_layers > 0 && (
          <p className="text-xs text-red-600 mt-1.5 font-medium">⚠ {rejected_layers} layer(s) rejected</p>
        )}
        {is_complete && (
          <p className="text-xs text-green-600 mt-1.5 font-medium">✓ All layers validated — ready to finalize</p>
        )}
      </div>

      <div className="px-5 pb-4 space-y-2 mt-2">
        {LAYERS.map((layerKey) => {
          const acceptance = getLayerAcceptance(mcda[layerKey], layerKey);
          const colors = getAcceptanceColor(acceptance);
          return (
            <div key={layerKey} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
              <div className="flex items-center gap-2.5">
                <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
                <span className="text-sm text-gray-700 font-medium">{LAYER_LABELS[layerKey]}</span>
              </div>
              <div className="flex items-center gap-2">
                {acceptance ? (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${colors.bg} ${colors.text}`}>
                    {acceptance.replace(/_/g, " ")}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-400">
                    Pending
                  </span>
                )}
                {acceptance === "ACCEPT" && <CheckCircle className="w-4 h-4 text-green-500" />}
                {acceptance === "REJECT" && <XCircle className="w-4 h-4 text-red-500" />}
                {acceptance?.startsWith("ACCEPT_WITH") && <AlertCircle className="w-4 h-4 text-yellow-500" />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// LAYER DETAIL CARD
// ─────────────────────────────────────────────
const LayerDetailCard: React.FC<{ layerKey: LayerKey; layerData: LayerData }> = ({ layerKey, layerData }) => {
  const [expanded, setExpanded] = useState(false);
  const acceptance = getLayerAcceptance(layerData, layerKey);
  const colors = getAcceptanceColor(acceptance);

  // Common fields
  const validationNotes = asStr(layerData.validation_notes);
  const validatedBy = asStr(layerData.validated_by);
  const validatedAt = asStr(layerData.validated_at);

  // Safety fields
  const safetyRiskLevel = asStr(layerData.safety_risk_level);
  const mitigationRequired = asStrArr(layerData.mitigation_required);

  // Boundary fields
  const boundaryComplianceStatus = asStr(layerData.boundary_compliance_status);

  // Survivability fields
  const soilAcceptance = asStr(layerData.soil_acceptance);
  const waterAcceptance = asStr(layerData.water_acceptance);
  const competitionAcceptance = asStr(layerData.competition_acceptance);
  const competitionLevel = asStr(layerData.competition_level);
  const soilSuitabilityLevel = asStr(layerData.soil_suitability_level);
  const waterSuitabilityLevel = asStr(layerData.water_suitability_level);
  const speciesRecommendations = asStr(layerData.species_recommendations);
  const overallSurvivabilityDecision = asStr(layerData.overall_survivability_decision);

  const borderColor =
    acceptance === "REJECT"
      ? "border-red-200"
      : acceptance === "ACCEPT"
      ? "border-green-200"
      : acceptance?.startsWith("ACCEPT_WITH")
      ? "border-yellow-200"
      : "border-gray-200";

  return (
    <div className={`border rounded-xl overflow-hidden ${borderColor}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-gray-50/50 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full ${colors.dot}`} />
          <span className="text-sm font-semibold text-gray-800">{LAYER_LABELS[layerKey]}</span>
          {acceptance && (
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${colors.bg} ${colors.text}`}>
              {acceptance.replace(/_/g, " ")}
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {expanded && (
        <div className="px-5 py-4 space-y-3 bg-white">

          {/* Validation Notes */}
          {validationNotes && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Validation Notes</p>
              <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 leading-relaxed">{validationNotes}</p>
            </div>
          )}

          {/* ── SAFETY ── */}
          {layerKey === "safety" && (
            <>
              {safetyRiskLevel && (
                <div className="flex items-center gap-3">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Risk Level:</p>
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                    safetyRiskLevel === "HIGH" ? "bg-red-100 text-red-700" :
                    safetyRiskLevel === "MODERATE" ? "bg-yellow-100 text-yellow-700" :
                    "bg-green-100 text-green-700"
                  }`}>
                    {safetyRiskLevel}
                  </span>
                </div>
              )}
              {mitigationRequired.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Mitigation Required</p>
                  <div className="flex flex-wrap gap-1.5">
                    {mitigationRequired.map((m, i) => (
                      <span key={i} className="px-2 py-0.5 bg-orange-50 text-orange-700 rounded text-xs font-medium border border-orange-200">
                        {m.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── BOUNDARY VERIFICATION ── */}
          {layerKey === "boundary_verification" && boundaryComplianceStatus && (
            <div className="flex items-center gap-3">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Compliance Status:</p>
              <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                boundaryComplianceStatus === "FULLY_COMPLIANT" ? "bg-green-100 text-green-700" :
                boundaryComplianceStatus === "PARTIALLY_COMPLIANT" ? "bg-yellow-100 text-yellow-700" :
                "bg-red-100 text-red-700"
              }`}>
                {boundaryComplianceStatus.replace(/_/g, " ")}
              </span>
            </div>
          )}

          {/* ── SURVIVABILITY ── */}
          {layerKey === "survivability" && (
            <>
              {/* Sub-acceptance grid */}
              {(soilAcceptance || waterAcceptance || competitionAcceptance) && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Sub-Layer Decisions</p>
                  <div className="grid grid-cols-3 gap-2">
                    {soilAcceptance && (
                      <div className="bg-gray-50 rounded-lg p-2 text-center">
                        <p className="text-xs text-gray-400 mb-1">Soil</p>
                        <span className={`text-xs font-bold ${soilAcceptance === "ACCEPT" ? "text-green-600" : "text-red-600"}`}>
                          {soilAcceptance}
                        </span>
                      </div>
                    )}
                    {waterAcceptance && (
                      <div className="bg-gray-50 rounded-lg p-2 text-center">
                        <p className="text-xs text-gray-400 mb-1">Water</p>
                        <span className={`text-xs font-bold ${waterAcceptance === "ACCEPT" ? "text-green-600" : "text-red-600"}`}>
                          {waterAcceptance}
                        </span>
                      </div>
                    )}
                    {competitionAcceptance && (
                      <div className="bg-gray-50 rounded-lg p-2 text-center">
                        <p className="text-xs text-gray-400 mb-1">Competition</p>
                        <span className={`text-xs font-bold ${competitionAcceptance === "ACCEPT" ? "text-green-600" : "text-red-600"}`}>
                          {competitionAcceptance}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Suitability levels */}
              {(soilSuitabilityLevel || waterSuitabilityLevel || competitionLevel) && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Suitability Levels</p>
                  <div className="space-y-1.5">
                    {soilSuitabilityLevel && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Soil Suitability</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                          soilSuitabilityLevel === "HIGH" ? "bg-green-100 text-green-700" :
                          soilSuitabilityLevel === "MODERATE" ? "bg-yellow-100 text-yellow-700" :
                          "bg-red-100 text-red-700"
                        }`}>{soilSuitabilityLevel}</span>
                      </div>
                    )}
                    {waterSuitabilityLevel && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Water Suitability</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                          waterSuitabilityLevel === "ADEQUATE" || waterSuitabilityLevel === "HIGH"
                            ? "bg-green-100 text-green-700"
                            : waterSuitabilityLevel === "MODERATE"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-red-100 text-red-700"
                        }`}>{waterSuitabilityLevel}</span>
                      </div>
                    )}
                    {competitionLevel && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Competition Level</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                          competitionLevel === "LOW" ? "bg-green-100 text-green-700" :
                          competitionLevel === "MODERATE" ? "bg-yellow-100 text-yellow-700" :
                          "bg-red-100 text-red-700"
                        }`}>{competitionLevel}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Inspector species notes */}
              {speciesRecommendations && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Inspector Species Notes</p>
                  <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 leading-relaxed">{speciesRecommendations}</p>
                </div>
              )}

              {/* Overall decision badge */}
              {overallSurvivabilityDecision && (
                <div className="flex items-center gap-3">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Overall Decision:</p>
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                    overallSurvivabilityDecision === "ACCEPT" ? "bg-green-100 text-green-700" :
                    overallSurvivabilityDecision === "REJECT" ? "bg-red-100 text-red-700" :
                    "bg-yellow-100 text-yellow-700"
                  }`}>{overallSurvivabilityDecision.replace(/_/g, " ")}</span>
                </div>
              )}
            </>
          )}

          {/* Validator footer */}
          {validatedBy && (
            <p className="text-xs text-gray-400 pt-2 border-t border-gray-50">
              Validated by <span className="font-medium text-gray-600">{validatedBy}</span>
              {validatedAt && ` · ${new Date(validatedAt).toLocaleDateString()}`}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────
// SPECIES RECOMMENDATIONS
// ─────────────────────────────────────────────
const SpeciesRecommendationsPanel: React.FC<{
  siteId: number;
  initialSpecies: SpeciesRecommendation[];
  token: string | null;
}> = ({ siteId, initialSpecies, token }) => {
  const [species, setSpecies] = useState<SpeciesRecommendation[]>(initialSpecies);
  const [allSpecies, setAllSpecies] = useState<TreeSpeciesOption[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingSpecies, setLoadingSpecies] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    const fetchAllSpecies = async () => {
      setLoadingSpecies(true);
      try {
        const res = await fetch("http://127.0.0.1:8000/api/get_tree_species_list/", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data: TreeSpeciesOption[] = await res.json();
          setAllSpecies(data);
        }
      } catch { /* silent */ }
      setLoadingSpecies(false);
    };
    fetchAllSpecies();
  }, [token]);

  const handleAdd = () => {
    if (!selectedId) return;
    const found = allSpecies.find((s) => s.tree_specie_id === Number(selectedId));
    if (!found || species.find((s) => s.id === found.tree_specie_id)) return;
    setSpecies((prev) => [
      ...prev,
      { id: found.tree_specie_id, name: found.name, rank: prev.length + 1, notes: notes || null },
    ]);
    setSelectedId("");
    setNotes("");
  };

  const handleRemove = (id: number) => {
    setSpecies((prev) => prev.filter((s) => s.id !== id).map((s, i) => ({ ...s, rank: i + 1 })));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/update_species/${siteId}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          species: species.map((s) => ({
            tree_species_id: s.id,
            priority_rank: s.rank,
            notes: s.notes || "",
          })),
        }),
      });
      if (res.ok) setSaveSuccess(true);
    } catch { /* silent */ }
    setSaving(false);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50/50 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Leaf className="w-4 h-4 text-[#0F4A2F]" />
          <h2 className="text-sm font-semibold text-gray-800">Species Recommendations</h2>
          {species.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs bg-[#0F4A2F]/10 text-[#0F4A2F] font-semibold">
              {species.length}
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {expanded && (
        <div className="p-5 space-y-4">
          {species.length > 0 ? (
            <div className="space-y-2">
              {species.map((sp) => (
                <div key={sp.id} className="flex items-center justify-between bg-green-50/50 border border-green-100 rounded-lg px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-full bg-[#0F4A2F]/10 text-[#0F4A2F] flex items-center justify-center text-xs font-bold">
                      {sp.rank}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{sp.name}</p>
                      {sp.notes && <p className="text-xs text-gray-500">{sp.notes}</p>}
                    </div>
                  </div>
                  <button onClick={() => handleRemove(sp.id)} className="text-red-400 hover:text-red-600 p-1 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-gray-400">
              <Leaf className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No species recommended yet</p>
            </div>
          )}

          <div className="border-t border-gray-100 pt-4 space-y-2">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Add Species</p>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              disabled={loadingSpecies}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700
                         focus:outline-none focus:border-[#0F4A2F] focus:ring-1 focus:ring-[#0F4A2F]"
            >
              <option value="">{loadingSpecies ? "Loading species..." : "Select a tree species..."}</option>
              {allSpecies
                .filter((s) => !species.find((r) => r.id === s.tree_specie_id))
                .map((s) => (
                  <option key={s.tree_specie_id} value={s.tree_specie_id}>{s.name}</option>
                ))}
            </select>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes (optional)"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700
                         focus:outline-none focus:border-[#0F4A2F] focus:ring-1 focus:ring-[#0F4A2F]"
            />
            <button
              onClick={handleAdd}
              disabled={!selectedId}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#0F4A2F]/10 text-[#0F4A2F]
                         rounded-lg text-sm font-medium hover:bg-[#0F4A2F]/20 transition-colors
                         disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" /> Add Species
            </button>
          </div>

          {saveSuccess && (
            <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs font-medium">
              <CheckCircle className="w-4 h-4" /> Saved successfully
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#0F4A2F] text-white
                       rounded-lg text-sm font-medium hover:bg-[#0a3522] transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            {saving ? "Saving..." : "Save Recommendations"}
          </button>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────
// SKELETON
// ─────────────────────────────────────────────
const SiteSkeleton: React.FC = () => (
  <div className="min-h-screen bg-gray-50 p-6 md:p-8 animate-pulse">
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="h-8 w-64 bg-gray-200 rounded" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="h-80 bg-gray-200 rounded-xl" />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-gray-200 rounded-xl" />)}
          </div>
          <div className="h-48 bg-gray-200 rounded-xl" />
        </div>
        <div className="space-y-4">
          <div className="h-64 bg-gray-200 rounded-xl" />
          <div className="h-48 bg-gray-200 rounded-xl" />
        </div>
      </div>
    </div>
  </div>
);

// ─────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────
export default function SiteInformation(): JSX.Element {
  const { id, site_id } = useParams<{ id: string; site_id: string }>();
  const token = localStorage.getItem("token");

  const [siteData, setSiteData] = useState<SiteResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const resolvedId = site_id || id || "0";

  const fetchSiteData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/get_site/${resolvedId}/`, {
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        if (response.status === 401) throw new Error("Authentication required. Please log in.");
        if (response.status === 403) throw new Error("Access denied.");
        throw new Error(`HTTP ${response.status}`);
      }
      const result: SiteResponse = await response.json();
      setSiteData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load site data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSiteData(); }, [resolvedId]);

  if (loading && !siteData) return <SiteSkeleton />;

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-xl shadow-sm border border-red-200 p-8 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Failed to Load Site</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={fetchSiteData}
            className="px-4 py-2 bg-[#0F4A2F] text-white rounded-lg text-sm font-medium hover:bg-[#0a3522] transition-colors inline-flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!siteData) return <></>;

  const activeMcda: SiteData =
    Object.keys(siteData.current_draft_mcda).length > 0
      ? siteData.current_draft_mcda
      : siteData.finalized_mcda;

  const validationProgress = computeValidationProgress(activeMcda);
  const coordinates: [number, number] = siteData.center_coordinate ?? [10.1015, 124.6012];

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans text-gray-800">

      {/* ── HEADER ── */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-1.5">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">{siteData.name}</h1>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold border capitalize ${STATUS_COLORS[siteData.status] ?? STATUS_COLORS.pending}`}>
                {siteData.status.replace(/_/g, " ")}
              </span>
            </div>
            <p className="text-gray-500 text-sm flex flex-wrap items-center gap-2">
              <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">Site #{siteData.site_id}</span>
              <span className="w-1 h-1 bg-gray-300 rounded-full" />
              <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">Area #{id}</span>
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={fetchSiteData}
              disabled={loading}
              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium
                         hover:bg-gray-50 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Refresh
            </button>
            <button className="px-4 py-2 bg-[#0F4A2F] text-white rounded-lg text-sm font-medium hover:bg-[#0a3522] shadow-sm transition-colors inline-flex items-center gap-2">
              <FileText className="w-4 h-4" /> Download Report
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── LEFT ── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Map */}
          <div className="bg-white p-1 rounded-xl shadow-sm border border-gray-200">
            <SiteMap coordinates={coordinates} polygon={siteData.polygon_coordinates} siteName={siteData.name} />
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-500 text-xs font-medium">Area</span>
                <Ruler className="w-4 h-4 text-gray-300" />
              </div>
              <p className="text-xl font-bold text-gray-800">{siteData.area_hectares.toFixed(2)} ha</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-500 text-xs font-medium">Validation</span>
                <Layers className="w-4 h-4 text-gray-300" />
              </div>
              <p className="text-xl font-bold text-gray-800">
                {validationProgress.validated_layers}/{validationProgress.total_layers}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">layers complete</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm col-span-2 md:col-span-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-500 text-xs font-medium">Species</span>
                <Leaf className="w-4 h-4 text-gray-300" />
              </div>
              <p className="text-xl font-bold text-gray-800">{siteData.species_recommendations.length}</p>
              <p className="text-xs text-gray-400 mt-0.5">recommended</p>
            </div>
          </div>

          {/* Layer Details */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#0F4A2F]" />
              <h2 className="text-sm font-semibold text-gray-800">Layer Assessment Details</h2>
              {Object.keys(siteData.finalized_mcda).length > 0 && (
                <span className="ml-auto px-2 py-0.5 rounded text-xs bg-blue-50 text-blue-600 font-medium border border-blue-100">
                  Finalized
                </span>
              )}
            </div>
            <div className="p-4 space-y-3">
              {LAYERS.map((layerKey) => {
                const layerData = activeMcda[layerKey];
                if (!layerData || Object.keys(layerData).length === 0) {
                  return (
                    <div key={layerKey} className="border border-dashed border-gray-200 rounded-xl px-5 py-3 flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full bg-gray-200" />
                      <span className="text-sm text-gray-400">{LAYER_LABELS[layerKey]}</span>
                      <span className="ml-auto text-xs text-gray-300">Not started</span>
                    </div>
                  );
                }
                return <LayerDetailCard key={layerKey} layerKey={layerKey} layerData={layerData} />;
              })}
            </div>
          </div>
        </div>

        {/* ── RIGHT ── */}
        <div className="space-y-6">
          <ValidationProgressCard mcda={activeMcda} />

          {/* Status Banner */}
          <div className={`rounded-xl p-5 text-white ${
            validationProgress.rejected_layers > 0
              ? "bg-gradient-to-br from-red-600 to-red-800"
              : validationProgress.is_complete
              ? "bg-gradient-to-br from-[#0F4A2F] to-[#1a6b44]"
              : "bg-gradient-to-br from-gray-600 to-gray-800"
          }`}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-white/70 text-xs font-medium">Assessment Status</p>
                <p className="text-lg font-bold mt-0.5">
                  {validationProgress.rejected_layers > 0
                    ? "Has Rejections"
                    : validationProgress.is_complete
                    ? "All Criteria Met"
                    : `${validationProgress.validated_layers}/${validationProgress.total_layers} Validated`}
                </p>
              </div>
              <div className="p-2 bg-white/20 rounded-lg">
                {validationProgress.rejected_layers > 0 ? (
                  <XCircle className="w-5 h-5" />
                ) : validationProgress.is_complete ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  <Layers className="w-5 h-5" />
                )}
              </div>
            </div>
            <div className="w-full bg-white/20 rounded-full h-1.5 mb-2">
              <div
                className="bg-white h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${(validationProgress.validated_layers / validationProgress.total_layers) * 100}%` }}
              />
            </div>
            <p className="text-xs text-white/60">
              {validationProgress.is_complete
                ? "Site is ready for finalization"
                : `${validationProgress.total_layers - validationProgress.validated_layers} layer(s) remaining`}
            </p>
          </div>

          <SpeciesRecommendationsPanel
            siteId={siteData.site_id}
            initialSpecies={siteData.species_recommendations}
            token={token}
          />
        </div>
      </div>
    </div>
  );
}