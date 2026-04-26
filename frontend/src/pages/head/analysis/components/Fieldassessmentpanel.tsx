// src/pages/GISS/multicriteria_analysis/components/FieldAssessmentPanel.tsx
import { useState } from "react";
import {
  Shield, MapPin, Leaf, ChevronRight, User,
  Calendar, AlertTriangle, CheckCircle, XCircle,
  Eye, Image as ImageIcon, RefreshCw, X,
} from "lucide-react";
import type {
  MCDALayer, FieldAssessmentEntry,
  SafetyData, BoundaryVerificationData, SurvivabilityData,
} from "../hooks/useFieldAssessments";

const LAYERS: {
  id: MCDALayer; label: string; short: string;
  icon: typeof Shield; color: string; bg: string; border: string;
}[] = [
  { id: "safety",                label: "Safety",               short: "L1", icon: Shield, color: "text-red-600",    bg: "bg-red-50",     border: "border-red-200"    },
  { id: "boundary_verification", label: "Boundary Verification",short: "L2", icon: MapPin, color: "text-amber-600",  bg: "bg-amber-50",   border: "border-amber-200"  },
  { id: "survivability",         label: "Survivability",        short: "L3", icon: Leaf,   color: "text-emerald-600",bg: "bg-emerald-50", border: "border-emerald-200"},
];

const BASE_URL = "http://127.0.0.1:8000";

const Badge = ({ value, positive }: { value: boolean | null; positive?: boolean }) => {
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
  <span className="inline-block bg-gray-100 text-gray-700 text-[10px] font-medium px-2 py-0.5 rounded-full border border-gray-200">
    {label.replace(/_/g, " ")}
  </span>
);

const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-[9px] uppercase tracking-widest text-gray-400 font-semibold">{label}</span>
    <div className="text-xs text-gray-800 font-medium">{value ?? <span className="text-gray-300 italic">not reported</span>}</div>
  </div>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="space-y-2">
    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 border-b border-gray-100 pb-1">{title}</p>
    <div className="space-y-2">{children}</div>
  </div>
);

const SafetyDetail = ({ d }: { d: SafetyData }) => (
  <div className="space-y-4">
    <Section title="🌊 Flood">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Water line (cm)" value={d.flood_water_line_cm != null ? `${d.flood_water_line_cm} cm` : null} />
        <Field label="Debris line visible" value={<Badge value={d.flood_debris_line_visible} positive={false} />} />
      </div>
      <Field label="Flood notes" value={d.flood_notes} />
    </Section>
    <Section title="⛰️ Landslide">
      <Field label="Indicators observed" value={
        d.landslide_indicators_observed?.length
          ? <div className="flex flex-wrap gap-1">{d.landslide_indicators_observed.map(i => <Chip key={i} label={i} />)}</div>
          : null
      } />
      <Field label="Landslide notes" value={d.landslide_notes} />
    </Section>
    <Section title="🪨 Erosion">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type" value={d.erosion_type ? <Chip label={d.erosion_type} /> : null} />
        <Field label="Area affected" value={d.erosion_area_estimate_pct != null ? `${d.erosion_area_estimate_pct}%` : null} />
      </div>
      <Field label="Signs" value={d.erosion_signs} />
      <Field label="Severity" value={d.erosion_severity_description} />
    </Section>
    <Section title="💬 Inspector Notes">
      <Field label="General comment" value={d.inspector_comment} />
      <Field label="Hazard proximity" value={d.hazard_proximity_notes} />
    </Section>
  </div>
);

const BoundaryDetail = ({ d }: { d: BoundaryVerificationData }) => (
  <div className="space-y-4">
    <Section title="📍 Markers & Boundary">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Markers status" value={d.boundary_markers_status ? <Chip label={d.boundary_markers_status} /> : null} />
        <Field label="Deviation" value={d.boundary_deviation_meters != null ? `${d.boundary_deviation_meters} m` : null} />
      </div>
      <Field label="Boundary notes" value={d.boundary_notes} />
    </Section>
    <Section title="⚠️ Compliance Checks">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Within 20m riparian buffer" value={<Badge value={d.within_riparian_buffer_20m} positive={false} />} />
        <Field label="Encroachment detected" value={<Badge value={d.encroachment_detected} positive={false} />} />
        <Field label="Slope >30° crossing" value={<Badge value={d.slope_boundary_check} positive={false} />} />
        {d.encroachment_detected && (
          <Field label="Encroachment type" value={d.encroachment_type ? <Chip label={d.encroachment_type} /> : null} />
        )}
      </div>
    </Section>
    {d.boundary_coordinates_feedback?.length > 0 && (
      <Section title="🗺️ Coordinate Feedback">
        <div className="space-y-2">
          {d.boundary_coordinates_feedback.map((pt, i) => (
            <div key={i} className="bg-gray-50 rounded-lg p-2 border border-gray-200 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-800">{pt.marker_name}</span>
                <Chip label={pt.confidence} />
              </div>
              <div className="text-gray-500 font-mono text-[10px]">{pt.latitude}, {pt.longitude}</div>
              {pt.notes && <div className="text-gray-600">{pt.notes}</div>}
            </div>
          ))}
        </div>
      </Section>
    )}
  </div>
);

const SurvivabilityDetail = ({ d }: { d: SurvivabilityData }) => (
  <div className="space-y-4">
    <Section title="🌍 Soil">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Texture" value={d.soil_texture ? <Chip label={d.soil_texture} /> : null} />
        <Field label="Depth" value={d.soil_depth_cm != null ? `${d.soil_depth_cm} cm` : null} />
        <Field label="Moisture feel" value={d.soil_moisture_feel ? <Chip label={d.soil_moisture_feel} /> : null} />
        <Field label="Drainage" value={d.soil_drainage_observed ? <Chip label={d.soil_drainage_observed} /> : null} />
      </div>
      <Field label="Soil notes" value={d.soil_notes} />
    </Section>
    <Section title="💧 Water">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Days since rainfall" value={d.days_since_last_rainfall != null ? `${d.days_since_last_rainfall} days` : null} />
        <Field label="Micro-topography" value={d.micro_topography ? <Chip label={d.micro_topography} /> : null} />
        <Field label="Stress symptoms" value={d.water_stress_symptoms ? <Chip label={d.water_stress_symptoms} /> : null} />
      </div>
      <Field label="Water availability" value={d.water_availability_notes} />
    </Section>
    <Section title="🌿 Vegetation">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Invasive cover" value={d.invasive_cover_estimate_pct != null ? `${d.invasive_cover_estimate_pct}%` : null} />
        <Field label="Native seedlings / 100m²" value={d.natural_regeneration_seedlings_count != null ? `${d.natural_regeneration_seedlings_count}` : null} />
      </div>
      <Field label="Invasive species" value={d.invasive_species_present ? <Chip label={String(d.invasive_species_present)} /> : null} />
      <Field label="Vegetation notes" value={d.vegetation_notes} />
      <Field label="Microclimate notes" value={d.microclimate_notes} />
    </Section>
  </div>
);

const AssessmentDetail = ({
  entry, index, layer,
  isPickingLocation,
  onAddLocation,
  onCancelLocation,
}: {
  entry: FieldAssessmentEntry;
  index: number;
  layer: MCDALayer;
  isPickingLocation: boolean;
  onAddLocation: () => void;
  onCancelLocation: () => void;
}) => {
  const [imgError, setImgError] = useState<Record<number, boolean>>({});
  const fad = entry.field_assessment_data;
  const innerData = fad.field_assessment_data;
  const loc = fad.location;
  const layerMeta = LAYERS.find((l) => l.id === layer)!;
  const hasLocation = !!loc?.latitude;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className={`p-3 ${layerMeta.bg} border-b ${layerMeta.border}`}>
        <div className="flex items-center gap-3">
          {entry.profile_image ? (
            <img src={`${BASE_URL}${entry.profile_image}`} alt={entry.full_name}
              className="w-9 h-9 rounded-full object-cover border-2 border-white shadow"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          ) : (
            <div className={`w-9 h-9 rounded-full flex items-center justify-center ${layerMeta.bg} border ${layerMeta.border}`}>
              <User size={16} className={layerMeta.color} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate">F{index + 1} — {entry.full_name}</p>
            <p className="text-[10px] text-gray-500 truncate">{entry.email}</p>
          </div>
        </div>

        {/* Date + GPS row */}
        <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-600 flex-wrap">
          <span className="flex items-center gap-1">
            <Calendar size={10} /> {fad.assessment_date}
          </span>
          {loc ? (
            <span className="flex items-center gap-1">
              <MapPin size={10} />
              {loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)}
              <span className="text-gray-400">(±{loc.gps_accuracy_meters}m)</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-orange-500 italic">
              <MapPin size={10} /> No location set
            </span>
          )}
        </div>

        {/* Add / Update Location button */}
        <div className="mt-2">
          {isPickingLocation ? (
            <button
              onClick={onCancelLocation}
              className="flex items-center gap-1.5 text-xs bg-orange-100 text-orange-700 border border-orange-300 px-3 py-1 rounded-full font-medium animate-pulse w-full justify-center"
            >
              <X size={11} /> Click map to place • Cancel
            </button>
          ) : (
            <button
              onClick={onAddLocation}
              className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-full font-medium border transition w-full justify-center
                ${hasLocation
                  ? "bg-green-50 text-green-700 border-green-300 hover:bg-green-100"
                  : "bg-orange-50 text-orange-700 border-orange-300 hover:bg-orange-100"}`}
            >
              <MapPin size={11} />
              {hasLocation ? "Update Location on Map" : "Add Location on Map"}
            </button>
          )}
        </div>
      </div>

      {/* Layer data */}
      <div className="p-3 flex-1 overflow-y-auto space-y-4">
        {layer === "safety" && <SafetyDetail d={innerData as SafetyData} />}
        {layer === "boundary_verification" && <BoundaryDetail d={innerData as BoundaryVerificationData} />}
        {layer === "survivability" && <SurvivabilityDetail d={innerData as SurvivabilityData} />}

        {/* Photos */}
        {fad.images?.length > 0 && (
          <Section title={`📸 Photos (${fad.images.length})`}>
            <div className="grid grid-cols-2 gap-2">
              {fad.images.map((img) => (
                <div key={img.id} className="relative group rounded-lg overflow-hidden border border-gray-200 bg-gray-50 aspect-square">
                  {!imgError[img.id] ? (
                    <img src={`${BASE_URL}${img.url}`} alt={img.caption}
                      className="w-full h-full object-cover transition group-hover:scale-105"
                      onError={() => setImgError((p) => ({ ...p, [img.id]: true }))} />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                      <ImageIcon size={20} />
                      <span className="text-[9px] mt-1">Photo unavailable</span>
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[9px] px-1.5 py-0.5 truncate opacity-0 group-hover:opacity-100 transition">
                    {img.caption}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
};

interface FieldAssessmentPanelProps {
  areaId: string | null;
  assessments: Record<MCDALayer, FieldAssessmentEntry[]>;
  loading: Record<MCDALayer, boolean>;
  activeLayer: MCDALayer;
  selectedIndex: number | null;
  locationTargetId: number | null;
  onLayerChange: (layer: MCDALayer) => void;
  onSelectEntry: (index: number) => void;
  onFetchLayer: (layer: MCDALayer) => void;
  onAddLocation: (fieldAssessmentId: number | null) => void;  // ✅ Accept null
}

export default function FieldAssessmentPanel({
  areaId,
  assessments,
  loading,
  activeLayer,
  selectedIndex,
  locationTargetId,
  onLayerChange,
  onSelectEntry,
  onFetchLayer,
  onAddLocation,
}: FieldAssessmentPanelProps) {
  const [search, setSearch] = useState("");

  const layerMeta = LAYERS.find((l) => l.id === activeLayer)!;
  const entries = assessments[activeLayer] ?? [];
  const filtered = search
    ? entries.filter(
        (e) =>
          e.full_name.toLowerCase().includes(search.toLowerCase()) ||
          e.email.toLowerCase().includes(search.toLowerCase())
      )
    : entries;

  const selected = selectedIndex !== null ? entries[selectedIndex] ?? null : null;

  const handleLayerTab = (layer: MCDALayer) => {
    onLayerChange(layer);
    if (!assessments[layer].length && areaId) onFetchLayer(layer);
  };

  return (
    <div className="bg-white rounded-lg shadow-md flex flex-col overflow-hidden" style={{ height: "100%" }}>
      {/* Title */}
      <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
          <Eye size={15} className="text-blue-500" /> Field Assessments
        </h3>
        {areaId ? (
          <button onClick={() => onFetchLayer(activeLayer)} disabled={loading[activeLayer]}
            className="text-[10px] text-blue-600 hover:underline flex items-center gap-1 disabled:opacity-50">
            <RefreshCw size={10} className={loading[activeLayer] ? "animate-spin" : ""} /> Refresh
          </button>
        ) : (
          <span className="text-[10px] text-gray-400 italic">Save site first</span>
        )}
      </div>

      {/* Layer tabs */}
      <div className="flex border-b border-gray-100">
        {LAYERS.map((l) => {
          const count = assessments[l.id]?.length ?? 0;
          const active = l.id === activeLayer;
          return (
            <button key={l.id} onClick={() => handleLayerTab(l.id)}
              className={`flex-1 py-2 text-[10px] font-semibold transition relative ${active ? `${l.color} bg-white border-b-2` : "text-gray-400 hover:text-gray-600"}`}
              style={active ? { borderBottomColor: "currentColor" } : {}}>
              <l.icon size={11} className="mx-auto mb-0.5" />
              {l.short}
              {count > 0 && (
                <span className={`absolute top-1 right-1 text-[8px] font-bold ${l.color} ${l.bg} px-1 rounded-full border ${l.border}`}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {!areaId ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-4 text-gray-400">
          <Eye size={28} className="mb-2 opacity-30" />
          <p className="text-sm font-medium text-gray-500">No site selected</p>
          <p className="text-xs mt-1">No area selected</p>
        </div>
      ) : loading[activeLayer] ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-400">
            <RefreshCw size={20} className="animate-spin mx-auto mb-2" />
            <p className="text-xs">Loading {layerMeta.label}...</p>
          </div>
        </div>
      ) : entries.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-4 text-gray-400">
          <AlertTriangle size={24} className="mb-2 opacity-40" />
          <p className="text-sm font-medium text-gray-500">No assessments</p>
          <p className="text-xs mt-1">No {layerMeta.label} data for this site</p>
          <button onClick={() => onFetchLayer(activeLayer)} className={`mt-3 text-xs font-medium ${layerMeta.color} hover:underline`}>
            Try again
          </button>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Detail */}
          <div className="flex-1 overflow-hidden">
            {selected ? (
              <AssessmentDetail
                entry={selected}
                index={selectedIndex!}
                layer={activeLayer}
                isPickingLocation={locationTargetId === selected.field_assessment_data.field_assessment_id}
                onAddLocation={() => onAddLocation(selected.field_assessment_data.field_assessment_id)}
                onCancelLocation={() => onAddLocation(null)} 
              />
            ) : (
              <div className="flex-1 h-full flex flex-col items-center justify-center text-center p-4 text-gray-400">
                <ChevronRight size={20} className="mb-2 opacity-30" />
                <p className="text-xs">Select an entry from the list</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}