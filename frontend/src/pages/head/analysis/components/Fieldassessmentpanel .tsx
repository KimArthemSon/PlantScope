// src/pages/GISS/multicriteria_analysis/components/FieldAssessmentPanel.tsx

import { useState } from "react";
import {
  Shield, MapPin, Leaf, ChevronRight, User,
  Calendar, AlertTriangle, CheckCircle, XCircle,
  Eye, Image as ImageIcon, Search, RefreshCw, X,
} from "lucide-react";
import type {
  MCDALayer,
  FieldAssessmentEntry,
  SafetyData,
  BoundaryVerificationData,
  SurvivabilityData,
} from "../hooks/useFieldAssessments";

const LAYERS: { 
  id: MCDALayer; label: string; short: string; 
  icon: typeof Shield; color: string; bg: string; border: string; activeBorder: string;
}[] = [
  { id: "safety", label: "Safety", short: "L1", icon: Shield, color: "text-red-600", bg: "bg-red-50", border: "border-red-200", activeBorder: "border-red-500" },
  { id: "boundary_verification", label: "Boundary Verification", short: "L2", icon: MapPin, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200", activeBorder: "border-amber-500" },
  { id: "survivability", label: "Survivability", short: "L3", icon: Leaf, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", activeBorder: "border-emerald-500" },
];

const BASE_URL = "http://127.0.0.1:8000";

const Badge = ({ value, positive }: { value: boolean | null | undefined; positive?: boolean }) => {
  if (value === null || value === undefined) return <span className="text-gray-400 text-xs">—</span>;
  const ok = positive ? value : !value;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${ok ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
      {ok ? <CheckCircle size={10} /> : <XCircle size={10} />}
      {value ? "Yes" : "No"}
    </span>
  );
};

const Chip = ({ label }: { label: string }) => (
  <span className="inline-block bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full border border-gray-200">
    {label.replace(/_/g, " ")}
  </span>
);

const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="mb-3">
    <span className="text-xs font-semibold text-gray-500 block mb-1">{label}</span>
    <div className="text-sm text-gray-800 bg-gray-50 p-2 rounded border border-gray-100">
      {value ?? <span className="text-gray-400 italic">Not reported</span>}
    </div>
  </div>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="mb-6 pb-4 border-b border-gray-200 last:border-0">
    <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">{title}</h4>
    <div>{children}</div>
  </div>
);

// ─── Layer detail renderers (simplified) ────────────────────────────────────

const SafetyDetail = ({ d }: { d: SafetyData }) => (
  <>
    <Section title="🌊 Flood Risk">
      <div className="grid grid-cols-2 gap-3 mb-3">
        <Field label="Water line (cm)" value={d.flood_water_line_cm != null ? `${d.flood_water_line_cm} cm` : null} />
        <Field label="Debris line visible" value={<Badge value={d.flood_debris_line_visible} positive={false} />} />
      </div>
      <Field label="Notes" value={d.flood_notes} />
    </Section>
    <Section title="⛰️ Landslide">
      <Field label="Indicators" value={d.landslide_indicators_observed?.length ? <div className="flex flex-wrap gap-1">{d.landslide_indicators_observed.map(i => <Chip key={i} label={i} />)}</div> : "None"} />
      <Field label="Notes" value={d.landslide_notes} />
    </Section>
    <Section title="🪨 Erosion">
      <div className="grid grid-cols-2 gap-3 mb-3">
        <Field label="Type" value={d.erosion_type ? <Chip label={d.erosion_type} /> : null} />
        <Field label="Area affected" value={d.erosion_area_estimate_pct != null ? `${d.erosion_area_estimate_pct}%` : null} />
      </div>
      <Field label="Signs" value={d.erosion_signs} />
      <Field label="Severity" value={d.erosion_severity_description} />
    </Section>
    <Section title="💬 Notes">
      <Field label="General" value={d.inspector_comment} />
      <Field label="Hazard proximity" value={d.hazard_proximity_notes} />
    </Section>
  </>
);

const BoundaryDetail = ({ d }: { d: BoundaryVerificationData }) => (
  <>
    <Section title="📍 Boundary">
      <div className="grid grid-cols-2 gap-3 mb-3">
        <Field label="Markers" value={d.boundary_markers_status ? <Chip label={d.boundary_markers_status} /> : null} />
        <Field label="Deviation" value={d.boundary_deviation_meters != null ? `${d.boundary_deviation_meters} m` : null} />
      </div>
      <Field label="Notes" value={d.boundary_notes} />
    </Section>
    <Section title="⚠️ Compliance">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Riparian buffer" value={<Badge value={d.within_riparian_buffer_20m} positive={false} />} />
        <Field label="Encroachment" value={<Badge value={d.encroachment_detected} positive={false} />} />
        <Field label="Slope >30°" value={<Badge value={d.slope_boundary_check} positive={false} />} />
        {d.encroachment_detected && <Field label="Type" value={d.encroachment_type ? <Chip label={d.encroachment_type} /> : null} />}
      </div>
    </Section>
    {d.boundary_coordinates_feedback?.length > 0 && (
      <Section title="🗺️ Coordinates">
        {d.boundary_coordinates_feedback.map((pt, i) => (
          <div key={i} className="bg-gray-50 p-3 rounded border border-gray-200 mb-2 text-sm">
            <div className="flex justify-between font-medium"><span>{pt.marker_name}</span><Chip label={pt.confidence} /></div>
            <div className="text-gray-500 font-mono text-xs mt-1">{pt.latitude.toFixed(6)}, {pt.longitude.toFixed(6)}</div>
            {pt.notes && <div className="text-gray-600 italic mt-1">{pt.notes}</div>}
          </div>
        ))}
      </Section>
    )}
  </>
);

const SurvivabilityDetail = ({ d }: { d: SurvivabilityData }) => (
  <>
    <Section title="🌍 Soil">
      <div className="grid grid-cols-2 gap-3 mb-3">
        <Field label="Texture" value={d.soil_texture ? <Chip label={d.soil_texture} /> : null} />
        <Field label="Depth" value={d.soil_depth_cm != null ? `${d.soil_depth_cm} cm` : null} />
        <Field label="Moisture" value={d.soil_moisture_feel ? <Chip label={d.soil_moisture_feel} /> : null} />
        <Field label="Drainage" value={d.soil_drainage_observed ? <Chip label={d.soil_drainage_observed} /> : null} />
      </div>
      <Field label="Notes" value={d.soil_notes} />
    </Section>
    <Section title="💧 Water">
      <div className="grid grid-cols-2 gap-3 mb-3">
        <Field label="Days since rain" value={d.days_since_last_rainfall != null ? `${d.days_since_last_rainfall} days` : null} />
        <Field label="Micro-topography" value={d.micro_topography ? <Chip label={d.micro_topography} /> : null} />
        <Field label="Stress symptoms" value={d.water_stress_symptoms ? <Chip label={d.water_stress_symptoms} /> : null} />
      </div>
      <Field label="Notes" value={d.water_availability_notes} />
    </Section>
    <Section title="🌿 Vegetation">
      <div className="grid grid-cols-2 gap-3 mb-3">
        <Field label="Invasive cover" value={d.invasive_cover_estimate_pct != null ? `${d.invasive_cover_estimate_pct}%` : null} />
        <Field label="Native seedlings" value={d.natural_regeneration_seedlings_count} />
      </div>
      <Field label="Invasive species" value={d.invasive_species_present ? <Chip label={String(d.invasive_species_present)} /> : "None"} />
      <Field label="Notes" value={d.vegetation_notes} />
      <Field label="Microclimate" value={d.microclimate_notes} />
    </Section>
  </>
);

// ─── Assessment Detail - Simple vertical stack ──────────────────────────────

const AssessmentDetail = ({ entry, index, layer }: { entry: FieldAssessmentEntry; index: number; layer: MCDALayer }) => {
  const [imgError, setImgError] = useState<Record<number, boolean>>({});
  const fad = entry.field_assessment_data;
  const innerData = fad.field_assessment_data;
  const loc = fad.location;
  const layerMeta = LAYERS.find(l => l.id === layer)!;

  return (
    <div>
      {/* Header */}
      <div className={`p-4 ${layerMeta.bg} border-b ${layerMeta.border} mb-4`}>
        <div className="flex items-start gap-3">
          {entry.profile_image ? (
            <img src={`${BASE_URL}${entry.profile_image}`} alt={entry.full_name} className="w-12 h-12 rounded-full object-cover border-2 border-white shadow bg-gray-200" onError={(e) => (e.target as HTMLImageElement).style.display = "none"} />
          ) : (
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${layerMeta.bg} border-2 border-white shadow`}>
              <User size={20} className={layerMeta.color} />
            </div>
          )}
          <div>
            <p className="font-bold text-gray-900">F{index + 1} — {entry.full_name}</p>
            <p className="text-xs text-gray-600">{entry.email}</p>
            <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-600">
              <span className="flex items-center gap-1"><Calendar size={12} /> {fad.assessment_date}</span>
              {loc && <span className="flex items-center gap-1"><MapPin size={12} /> {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)} (±{loc.gps_accuracy_meters}m)</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Content - Simple vertical flow */}
      <div className="px-2">
        {layer === "safety" && <SafetyDetail d={innerData as SafetyData} />}
        {layer === "boundary_verification" && <BoundaryDetail d={innerData as BoundaryVerificationData} />}
        {layer === "survivability" && <SurvivabilityDetail d={innerData as SurvivabilityData} />}

        {/* Photos - Simple grid, natural size */}
        {fad.images?.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2"><ImageIcon size={14} /> Photos ({fad.images.length})</h4>
            <div className="flex flex-wrap gap-3">
              {fad.images.map((img) => (
                <div key={img.id} className="w-48 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 cursor-pointer group" onClick={() => img.url && window.open(`${BASE_URL}${img.url}`, '_blank')}>
                  {!imgError[img.id] ? (
                    <img src={`${BASE_URL}${img.url}`} alt={img.caption || "Photo"} className="w-full h-40 object-cover group-hover:scale-105 transition-transform" onError={() => setImgError(p => ({ ...p, [img.id]: true }))} />
                  ) : (
                    <div className="w-full h-40 flex items-center justify-center text-gray-400 bg-gray-100"><ImageIcon size={24} /></div>
                  )}
                  {img.caption && <p className="text-xs text-center p-2 text-gray-600 truncate">{img.caption}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Main Panel - Simple block layout, NO flex/grid constraints ─────────────

interface FieldAssessmentPanelProps {
  areaId: string | null;
  assessments: Record<MCDALayer, FieldAssessmentEntry[]>;
  loading: Record<MCDALayer, boolean>;
  activeLayer: MCDALayer;
  selectedIndex: number | null;
  onLayerChange: (layer: MCDALayer) => void;
  onSelectEntry: (index: number) => void;
  onFetchLayer: (layer: MCDALayer) => void;
}

export default function FieldAssessmentPanel({ areaId, assessments, loading, activeLayer, selectedIndex, onLayerChange, onSelectEntry, onFetchLayer }: FieldAssessmentPanelProps) {
  const [search, setSearch] = useState("");
  const layerMeta = LAYERS.find(l => l.id === activeLayer)!;
  const entries = assessments[activeLayer] ?? [];
  const filtered = search ? entries.filter(e => e.full_name.toLowerCase().includes(search.toLowerCase()) || e.email.toLowerCase().includes(search.toLowerCase())) : entries;
  const selected = selectedIndex !== null ? entries[selectedIndex] ?? null : null;

  const handleLayerTab = (layer: MCDALayer) => { onLayerChange(layer); if (!assessments[layer].length && areaId) onFetchLayer(layer); };

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
        <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2"><Eye size={16} className="text-blue-500" /> Field Assessments</h3>
        {areaId ? (
          <button onClick={() => onFetchLayer(activeLayer)} disabled={loading[activeLayer]} className="text-xs text-blue-600 hover:underline disabled:opacity-50 flex items-center gap-1"><RefreshCw size={12} className={loading[activeLayer] ? "animate-spin" : ""} /> Refresh</button>
        ) : <span className="text-xs text-gray-400 italic">Save site first</span>}
      </div>

      {/* Layer Tabs - Simple horizontal scroll if needed */}
      <div className="flex border-b border-gray-200 overflow-x-auto">
        {LAYERS.map(l => {
          const count = assessments[l.id]?.length ?? 0;
          const active = l.id === activeLayer;
          return (
            <button key={l.id} onClick={() => handleLayerTab(l.id)} className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition ${active ? `${l.color} border-current bg-gray-50` : "text-gray-500 border-transparent hover:text-gray-700"}`}>
              <span className="flex items-center gap-2"><l.icon size={14} /> {l.label} {count > 0 && <span className={`text-xs px-1.5 py-0.5 rounded-full ${l.bg} ${l.color} border ${l.border}`}>{count}</span>}</span>
            </button>
          );
        })}
      </div>

      {/* Content - Natural flow, just scroll the page */}
      {!areaId ? (
        <div className="p-8 text-center text-gray-400 py-12"><Eye size={32} className="mx-auto mb-3 opacity-30" /><p className="text-sm">No site selected</p><p className="text-xs text-gray-400 mt-1">Save the site to view assessments</p></div>
      ) : loading[activeLayer] ? (
        <div className="p-8 text-center text-gray-400 py-12"><RefreshCw size={28} className="animate-spin mx-auto mb-3 text-blue-500" /><p className="text-sm">Loading {layerMeta.label}...</p></div>
      ) : entries.length === 0 ? (
        <div className="p-8 text-center text-gray-400 py-12"><AlertTriangle size={28} className={`mx-auto mb-3 ${layerMeta.color}`} /><p className="text-sm">No {layerMeta.label.toLowerCase()} assessments</p><button onClick={() => onFetchLayer(activeLayer)} className={`mt-3 text-xs px-4 py-2 rounded ${layerMeta.bg} ${layerMeta.color} border ${layerMeta.border}`}>Try again</button></div>
      ) : selected ? (
        <AssessmentDetail entry={selected} index={selectedIndex!} layer={activeLayer} />
      ) : (
        <div className="p-8 text-center text-gray-400 py-12"><ChevronRight size={28} className={`mx-auto mb-3 ${layerMeta.color}`} /><p className="text-sm">Select an assessment from the list</p><p className="text-xs text-gray-400 mt-1">to view details</p></div>
      )}
    </div>
  );
}