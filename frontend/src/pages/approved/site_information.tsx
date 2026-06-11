import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
  Leaf,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  FileText,
  Shield,
  AlertTriangle,
  ShieldAlert,
  Car,
  Route,
  Layers,
  Clock,
  RotateCcw,
  Image as ImageIcon,
  MapPin,
  ArrowLeft,
  Eye,
  Edit3,
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

const API = "http://127.0.0.1:8000/api/";
const API_IMAGE = "http://127.0.0.1:8000";

// ─────────────────────────────────────────────
// INTERFACES
// ─────────────────────────────────────────────
interface MetaVerification {
  status: "pending" | "draft" | "verified" | "rejected";
  verified_security_concerns: string[] | null;
  verified_accessibility: any;
  verified_land_classification_id: number | null;
  decision_note?: string | null;
  verified_by?: string | null;
  verified_at?: string | null;
}

interface PermitItem {
  permit_id: number;
  document_type: string;
  file_url: string | null;
  permit_number?: string | null;
  verification_notes?: string | null;
  uploaded_at?: string;
  uploaded_by?: string | null;
}

interface SpeciesRecommendation {
  id: number;
  name: string;
  rank: number;
  notes: string | null;
}

interface PotentialSite {
  potential_sites_id: number;
  site_id: string;
  polygon_coordinates: any;
  area_hectares: number;
  avg_ndvi: number;
  suitability_score: number;
}

interface SiteResponse {
  site_id: number;
  name: string;
  status: string;
  polygon_coordinates: [number, number][] | null;
  center_coordinate: [number, number] | null;
  ndvi_value: number | null;
  area_hectares: number;
  potential_sites: PotentialSite[];
  meta_verification: MetaVerification | null;
  permits: PermitItem[];
  validation_data?: any;
}

interface TreeSpeciesOption {
  tree_specie_id: number;
  name: string;
  description: string;
}

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  under_review: "bg-purple-100 text-purple-800 border-purple-200",
  accepted: "bg-blue-100 text-blue-800 border-blue-200",
  rejected: "bg-red-100 text-red-800 border-red-200",
  completed: "bg-green-100 text-green-800 border-green-200",
  under_monitoring: "bg-teal-100 text-teal-800 border-teal-200",
};

const VERIFICATION_STATUS_CONFIG: Record<
  string,
  { bg: string; text: string; border: string; icon: any; label: string }
> = {
  pending: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    icon: Clock,
    label: "Pending Review",
  },
  draft: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    icon: RotateCcw,
    label: "Draft",
  },
  verified: {
    bg: "bg-green-50",
    text: "text-green-700",
    border: "border-green-200",
    icon: CheckCircle,
    label: "Verified ✓",
  },
  rejected: {
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200",
    icon: XCircle,
    label: "Rejected ✗",
  },
};

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
function VerificationStatusBadge({ status }: { status: string }) {
  const config = VERIFICATION_STATUS_CONFIG[status] || VERIFICATION_STATUS_CONFIG["pending"];
  const Icon = config.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${config.bg} ${config.text} ${config.border}`}
    >
      <Icon size={12} /> {config.label}
    </span>
  );
}

function SecurityBadge({ concern }: { concern: string }) {
  const map: Record<string, { label: string; color: string; icon: any }> = {
    "Armed Threat / Violence": { label: "Armed Threat", color: "bg-red-100 text-red-700 border-red-200", icon: ShieldAlert },
    "Hostile Person on Site": { label: "Hostile Person", color: "bg-red-100 text-red-700 border-red-200", icon: ShieldAlert },
    "Illegal Activity Observed": { label: "Illegal Activity", color: "bg-orange-100 text-orange-700 border-orange-200", icon: AlertTriangle },
    "Community Resistance": { label: "Community Resistance", color: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: AlertCircle },
    "Land Conflict": { label: "Land Conflict", color: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: AlertCircle },
    other: { label: "Other", color: "bg-gray-100 text-gray-700 border-gray-200", icon: AlertCircle },
  };
  const config = map[concern] || { label: concern, color: "bg-gray-100 text-gray-700 border-gray-200", icon: AlertCircle };
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold border ${config.color}`}>
      <Icon size={10} /> {config.label}
    </span>
  );
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
      <TileLayer url="http://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}" attribution="&copy; Google Maps" />
      <Marker position={coordinates}>
        <Popup>
          <strong>{siteName || "Site Location"}</strong>
          <br />
          Lat: {coordinates[0].toFixed(6)}
          <br />
          Lng: {coordinates[1].toFixed(6)}
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
    <div
      className="absolute top-3 left-3 z-[400] bg-white/95 backdrop-blur px-3 py-1.5 rounded-lg
                    shadow-sm text-xs font-mono text-gray-700 border border-gray-200 flex items-center gap-1.5"
    >
      <MapIcon className="w-3.5 h-3.5 text-[#0F4A2F]" />
      {coordinates[0].toFixed(5)}, {coordinates[1].toFixed(5)}
    </div>
  </div>
);

// ─────────────────────────────────────────────
// METADATA VERIFICATION CARD
// ─────────────────────────────────────────────
const MetadataVerificationCard: React.FC<{
  verification: MetaVerification | null;
  landClassificationName?: string | null;
}> = ({ verification, landClassificationName }) => {
  const [expanded, setExpanded] = useState(true);

  if (!verification) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-800">Metadata Verification</h2>
        </div>
        <div className="p-5 text-center text-gray-400">
          <ShieldCheck className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No verification record yet</p>
        </div>
      </div>
    );
  }

  const statusConfig = VERIFICATION_STATUS_CONFIG[verification.status] || VERIFICATION_STATUS_CONFIG["pending"];
  const StatusIcon = statusConfig.icon;

  let accessibilityType = "Not specified";
  let accessibilityDescription = "";
  if (verification.verified_accessibility) {
    if (Array.isArray(verification.verified_accessibility) && verification.verified_accessibility.length > 0) {
      accessibilityType = verification.verified_accessibility[0].type || "Not specified";
      accessibilityDescription = verification.verified_accessibility[0].description || "";
    } else if (typeof verification.verified_accessibility === "object") {
      accessibilityType = verification.verified_accessibility.type || "Not specified";
      accessibilityDescription = verification.verified_accessibility.description || "";
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50/50 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#0F4A2F]" />
          <h2 className="text-sm font-semibold text-gray-800">Metadata Verification</h2>
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}
          >
            <StatusIcon size={10} /> {statusConfig.label}
          </span>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {expanded && (
        <div className="p-5 space-y-4">
          {/* Decision Note */}
          {verification.decision_note && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-gray-600" />
                <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Decision Note</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-700">{verification.decision_note}</p>
              </div>
            </div>
          )}

          {/* Verified By & Date */}
          {(verification.verified_by || verification.verified_at) && (
            <div className="flex items-center gap-4 text-xs text-gray-500">
              {verification.verified_by && (
                <span className="flex items-center gap-1">
                  <ShieldCheck size={10} /> Verified by: {verification.verified_by}
                </span>
              )}
              {verification.verified_at && (
                <span className="flex items-center gap-1">
                  <Clock size={10} /> {new Date(verification.verified_at).toLocaleDateString()}
                </span>
              )}
            </div>
          )}

          {/* Security Concerns */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <ShieldAlert className="w-4 h-4 text-orange-600" />
              <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Security Concerns</p>
            </div>
            {verification.verified_security_concerns && verification.verified_security_concerns.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {verification.verified_security_concerns.map((concern, idx) => (
                  <SecurityBadge key={idx} concern={concern} />
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
                <ShieldCheck className="w-4 h-4 text-green-600" />
                <span className="text-sm text-green-700 font-medium">No security concerns</span>
              </div>
            )}
          </div>

          {/* Accessibility */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Route className="w-4 h-4 text-blue-600" />
              <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Accessibility</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 mb-1">
                <Car className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-semibold text-blue-800 capitalize">
                  {accessibilityType.replace(/_/g, " ")}
                </span>
              </div>
              {accessibilityDescription && (
                <p className="text-xs text-blue-700 mt-1">{accessibilityDescription}</p>
              )}
            </div>
          </div>

          {/* Land Classification */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Layers className="w-4 h-4 text-purple-600" />
              <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Land Classification</p>
            </div>
            {landClassificationName ? (
              <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                <span className="text-sm font-semibold text-purple-800">{landClassificationName}</span>
              </div>
            ) : (
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <span className="text-sm text-gray-500 italic">Not classified</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────
// PERMITS CARD
// ─────────────────────────────────────────────
const PermitsCard: React.FC<{ permits: PermitItem[] }> = ({ permits }) => {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50/50 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#0F4A2F]" />
          <h2 className="text-sm font-semibold text-gray-800">Legal Documents</h2>
          {permits.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs bg-[#0F4A2F]/10 text-[#0F4A2F] font-semibold">
              {permits.length}
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {expanded && (
        <div className="p-5">
          {permits.length > 0 ? (
            <div className="space-y-2">
              {permits.map((permit) => (
                <div key={permit.permit_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-green-600" />
                    <div>
                      <span className="text-sm font-medium text-gray-800 capitalize block">
                        {permit.document_type.replace(/_/g, " ")}
                      </span>
                      {permit.permit_number && (
                        <span className="text-xs text-gray-500">No. {permit.permit_number}</span>
                      )}
                      {permit.uploaded_at && (
                        <span className="text-[10px] text-gray-400 block">
                          {new Date(permit.uploaded_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  {permit.file_url && (
                    <a
                      href={`${API_IMAGE}${permit.file_url}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <ImageIcon size={12} /> View
                    </a>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-gray-400">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No documents uploaded</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────
// POTENTIAL SITES CARD
// ─────────────────────────────────────────────
const PotentialSitesCard: React.FC<{ sites: PotentialSite[] }> = ({ sites }) => {
  const [expanded, setExpanded] = useState(true);

  if (sites.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50/50 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-[#0F4A2F]" />
          <h2 className="text-sm font-semibold text-gray-800">Consolidated Potential Sites</h2>
          <span className="px-2 py-0.5 rounded-full text-xs bg-[#0F4A2F]/10 text-[#0F4A2F] font-semibold">
            {sites.length}
          </span>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {expanded && (
        <div className="p-5 space-y-2">
          {sites.map((site) => (
            <div key={site.potential_sites_id} className="p-3 bg-green-50/50 rounded-lg border border-green-100">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-800">
                  {site.site_id || `Potential #${site.potential_sites_id}`}
                </span>
                <span className="text-xs text-green-700 font-semibold">{site.area_hectares.toFixed(2)} ha</span>
              </div>
              <div className="flex gap-3 text-xs text-gray-600">
                <span>NDVI: {site.avg_ndvi.toFixed(3)}</span>
                <span>Score: {site.suitability_score.toFixed(2)}</span>
              </div>
            </div>
          ))}
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
  canEdit?: boolean;
}> = ({ siteId, initialSpecies, token, canEdit = false }) => {
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
        const res = await fetch(`${API}get_tree_species_list/`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data: TreeSpeciesOption[] = await res.json();
          setAllSpecies(data);
        }
      } catch {
        /* silent */
      }
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
      const res = await fetch(`${API}update_species/${siteId}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          species: species.map((s) => ({ tree_species_id: s.id, priority_rank: s.rank, notes: s.notes || "" })),
        }),
      });
      if (res.ok) setSaveSuccess(true);
    } catch {
      /* silent */
    }
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
                  {canEdit && (
                    <button onClick={() => handleRemove(sp.id)} className="text-red-400 hover:text-red-600 p-1 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-gray-400">
              <Leaf className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No species recommended yet</p>
            </div>
          )}

          {canEdit && (
            <>
              <div className="border-t border-gray-100 pt-4 space-y-2">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Add Species</p>
                <select
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  disabled={loadingSpecies}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-[#0F4A2F] focus:ring-1 focus:ring-[#0F4A2F]"
                >
                  <option value="">{loadingSpecies ? "Loading species..." : "Select a tree species..."}</option>
                  {allSpecies
                    .filter((s) => !species.find((r) => r.id === s.tree_specie_id))
                    .map((s) => (
                      <option key={s.tree_specie_id} value={s.tree_specie_id}>
                        {s.name}
                      </option>
                    ))}
                </select>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notes (optional)"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-[#0F4A2F] focus:ring-1 focus:ring-[#0F4A2F]"
                />
                <button
                  onClick={handleAdd}
                  disabled={!selectedId}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#0F4A2F]/10 text-[#0F4A2F] rounded-lg text-sm font-medium hover:bg-[#0F4A2F]/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#0F4A2F] text-white rounded-lg text-sm font-medium hover:bg-[#0a3522] transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                {saving ? "Saving..." : "Save Recommendations"}
              </button>
            </>
          )}
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
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-gray-200 rounded-xl" />
            ))}
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
  const navigate = useNavigate();

  const [siteData, setSiteData] = useState<SiteResponse | null>(null);
  const [landClassificationName, setLandClassificationName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ✅ Determine if user can edit (GIS Specialist only for now)
  const canEdit = true; // Set to true for all users who can access this page

  const resolvedId = site_id || id || "0";

  const fetchSiteData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API}get_site/${resolvedId}/`, {
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        if (response.status === 401) throw new Error("Authentication required. Please log in.");
        if (response.status === 403) throw new Error("Access denied.");
        throw new Error(`HTTP ${response.status}`);
      }
      const result: SiteResponse = await response.json();
      setSiteData(result);

      // Fetch land classification name if ID exists
      if (result.meta_verification?.verified_land_classification_id) {
        try {
          const lcRes = await fetch(`${API}get_land_classifications_list/`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (lcRes.ok) {
            const lcData = await lcRes.json();
            const found = lcData.find(
              (lc: any) => lc.land_classification_id === result.meta_verification?.verified_land_classification_id,
            );
            if (found) setLandClassificationName(found.name);
          }
        } catch {
          /* silent */
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load site data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSiteData();
  }, [resolvedId]);

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

  const coordinates: [number, number] = siteData.center_coordinate ?? [10.1015, 124.6012];

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans text-gray-800">
      {/* ── HEADER ── */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            {/* Back Button */}
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#0F4A2F] transition-colors mb-2"
            >
              <ArrowLeft size={14} /> Back
            </button>

            <div className="flex flex-wrap items-center gap-3 mb-1.5">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">{siteData.name}</h1>
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold border capitalize ${
                  STATUS_COLORS[siteData.status] ?? STATUS_COLORS.pending
                }`}
              >
                {siteData.status.replace(/_/g, " ")}
              </span>
              {siteData.meta_verification && (
                <VerificationStatusBadge status={siteData.meta_verification.status} />
              )}
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
              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Refresh
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
                <span className="text-gray-500 text-xs font-medium">NDVI</span>
                <Layers className="w-4 h-4 text-gray-300" />
              </div>
              <p className="text-xl font-bold text-gray-800">{siteData.ndvi_value?.toFixed(3) ?? "N/A"}</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm col-span-2 md:col-span-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-500 text-xs font-medium">Documents</span>
                <FileText className="w-4 h-4 text-gray-300" />
              </div>
              <p className="text-xl font-bold text-gray-800">{siteData.permits.length}</p>
              <p className="text-xs text-gray-400 mt-0.5">uploaded</p>
            </div>
          </div>

          {/* Potential Sites */}
          <PotentialSitesCard sites={siteData.potential_sites} />
        </div>

        {/* ── RIGHT ── */}
        <div className="space-y-6">
          <MetadataVerificationCard
            verification={siteData.meta_verification}
            landClassificationName={landClassificationName}
          />

          <PermitsCard permits={siteData.permits} />

          <SpeciesRecommendationsPanel
            siteId={siteData.site_id}
            initialSpecies={[]}
            token={token}
            canEdit={canEdit}
          />
        </div>
      </div>
    </div>
  );
}