import { useState, useEffect } from "react";
import {
  Shield, MapPin, Leaf, ChevronRight, User,
  Calendar, AlertTriangle, CheckCircle, XCircle,
  Eye, Image as ImageIcon, RefreshCw, X, Camera,
} from "lucide-react";
import type {
  MCDALayer, FieldAssessmentEntry, LayerData,
} from "../hooks/useFieldAssessments";

const LAYERS: {
  id: MCDALayer; label: string; short: string;
  icon: typeof Shield; color: string; bg: string; border: string;
}[] = [
  { id: "safety",                label: "Safety",               short: "L1", icon: Shield, color: "text-red-600",    bg: "bg-red-50",     border: "border-red-200"    },
  { id: "boundary_verification", label: "Boundary Verification",short: "L2", icon: MapPin, color: "text-amber-600",  bg: "bg-amber-50",   border: "border-amber-200"  },
  { id: "survivability",         label: "Survivability",        short: "L3", icon: Leaf,   color: "text-emerald-600",bg: "bg-emerald-50", border: "border-emerald-200"},
];

const getImageUrl = (url: string | null): string | null => {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return `http://127.0.0.1:8000${url}`;
};

const LayerDataRenderer = ({ data, level = 0 }: { data: LayerData; level?: number }) => {
  const entries = Object.entries(data);
  
  if (entries.length === 0) {
    return <p className="text-xs text-gray-400 italic">No data recorded</p>;
  }

  return (
    <div className={`space-y-2 ${level > 0 ? 'ml-2 border-l-2 border-gray-100 pl-2' : ''}`}>
      {entries.map(([key, value]) => {
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          return (
            <div key={key} className="space-y-1">
              <p className={`text-[10px] font-bold uppercase text-gray-500 ${level === 0 ? 'border-b border-gray-100 pb-1' : ''}`}>
                {key.replace(/_/g, ' ')}
              </p>
              <LayerDataRenderer data={value as LayerData} level={level + 1} />
            </div>
          );
        }
        
        if (Array.isArray(value)) {
          return (
            <div key={key} className="flex flex-col gap-0.5">
              <span className="text-[9px] uppercase tracking-widest text-gray-400 font-semibold">
                {key.replace(/_/g, ' ')}
              </span>
              <div className="flex flex-wrap gap-1">
                {value.map((item, i) => (
                  <span key={i} className="inline-block bg-gray-100 text-gray-700 text-[10px] font-medium px-2 py-0.5 rounded-full border border-gray-200">
                    {String(item).replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          );
        }
        
        return (
          <div key={key} className="flex flex-col gap-0.5">
            <span className="text-[9px] uppercase tracking-widest text-gray-400 font-semibold">
              {key.replace(/_/g, ' ')}
            </span>
            <div className="text-xs text-gray-800 font-medium">
              {value != null && value !== '' 
                ? String(value) 
                : <span className="text-gray-300 italic">not reported</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
};

interface AssessmentDetailProps {
  entry: FieldAssessmentEntry;
  index: number;
  layer: MCDALayer;
  isPickingLocation: boolean;
  onAddLocation: () => void;
  onCancelLocation: () => void;
  onPhotoClick?: (photo: any) => void;
}

const AssessmentDetail = ({
  entry, index, layer,
  isPickingLocation,
  onAddLocation,
  onCancelLocation,
  onPhotoClick,
}: AssessmentDetailProps) => {
  const [imgError, setImgError] = useState<Record<number, boolean>>({});
  const loc = entry.location;
  const layerMeta = LAYERS.find((l) => l.id === layer)!;
  const hasLocation = !!loc?.latitude;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className={`p-3 ${layerMeta.bg} border-b ${layerMeta.border}`}>
        <div className="flex items-center gap-3">
          {entry.inspector.profile_image ? (
            <img src={getImageUrl(entry.inspector.profile_image)} alt={entry.inspector.full_name}
              className="w-9 h-9 rounded-full object-cover border-2 border-white shadow"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          ) : (
            <div className={`w-9 h-9 rounded-full flex items-center justify-center ${layerMeta.bg} border ${layerMeta.border}`}>
              <User size={16} className={layerMeta.color} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate">F{index + 1} — {entry.inspector.full_name}</p>
            <p className="text-[10px] text-gray-500 truncate">{entry.inspector.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-600 flex-wrap">
          <span className="flex items-center gap-1">
            <Calendar size={10} /> {entry.assessment_date}
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

      <div className="p-3 flex-1 overflow-y-auto space-y-4">
        <div className="space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 border-b border-gray-100 pb-1">
            {layerMeta.label} Assessment
          </p>
          <LayerDataRenderer data={entry.layer_data} />
        </div>

        {entry.images?.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 border-b border-gray-100 pb-1">
              📸 Photos ({entry.images.length})
            </p>
            <div className="grid grid-cols-2 gap-2">
              {entry.images.map((img) => {
                const imgUrl = getImageUrl(img.url);
                return (
                  <div 
                    key={img.id} 
                    className="relative group rounded-lg overflow-hidden border border-gray-200 bg-gray-50 aspect-square cursor-pointer"
                    onClick={() => onPhotoClick?.(img)}
                  >
                    {imgUrl && !imgError[img.id] ? (
                      <img src={imgUrl} alt={img.description}
                        className="w-full h-full object-cover transition group-hover:scale-105"
                        onError={() => setImgError((p) => ({ ...p, [img.id]: true }))} />
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-gray-400">
                        <ImageIcon size={20} />
                        <span className="text-[9px] mt-1">Photo unavailable</span>
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[9px] px-1.5 py-0.5 truncate opacity-0 group-hover:opacity-100 transition">
                      {img.layer.replace(/_/g, ' ')} - {img.description}
                    </div>
                    {/* GPS indicator badge */}
                    {img.latitude && img.longitude && (
                      <div className="absolute top-1 right-1 bg-blue-500 text-white text-[8px] px-1.5 py-0.5 rounded-full shadow flex items-center gap-0.5">
                        <Camera size={8} /> GPS
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
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
  onAddLocation: (fieldAssessmentId: number | null) => void;
  onPhotoClick?: (photo: any) => void;
  showPhotoMarkers: boolean;
  onTogglePhotoMarkers: (show: boolean) => void;
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
  onPhotoClick,
  showPhotoMarkers,
  onTogglePhotoMarkers,
}: FieldAssessmentPanelProps) {
  const [search, setSearch] = useState("");

  const layerMeta = LAYERS.find((l) => l.id === activeLayer)!;
  const entries = assessments[activeLayer] ?? [];
  const filtered = search
    ? entries.filter(
        (e) =>
          e.inspector.full_name.toLowerCase().includes(search.toLowerCase()) ||
          e.inspector.email.toLowerCase().includes(search.toLowerCase())
      )
    : entries;

  const selected = selectedIndex !== null ? entries[selectedIndex] ?? null : null;

  const handleLayerTab = (layer: MCDALayer) => {
    onLayerChange(layer);
    if (!assessments[layer].length && areaId) onFetchLayer(layer);
  };

  return (
    <div className="bg-white rounded-lg shadow-md flex flex-col overflow-hidden" style={{ height: "100%" }}>
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
          <span className="text-[10px] text-gray-400 italic">No area selected</span>
        )}
      </div>

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

      {/* ✅ Toggle Photo Markers Button */}
      {selected && selected.images?.length > 0 && (
        <div className="px-3 py-2 border-b border-gray-100 bg-blue-50">
          <button
            onClick={() => onTogglePhotoMarkers(!showPhotoMarkers)}
            className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg transition w-full justify-center
              ${showPhotoMarkers 
                ? 'bg-blue-500 text-white hover:bg-blue-600' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
          >
            <Camera size={14} />
            {showPhotoMarkers ? 'Hide Photo Locations' : 'Show Photo Locations'}
            <span className="text-[10px] opacity-75">({selected.images.length} photos)</span>
          </button>
        </div>
      )}

      {!areaId ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-4 text-gray-400">
          <Eye size={28} className="mb-2 opacity-30" />
          <p className="text-sm font-medium text-gray-500">No area selected</p>
          <p className="text-xs mt-1">Select a reforestation area to view assessments</p>
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
          <p className="text-xs mt-1">No {layerMeta.label} data for this area</p>
          <button onClick={() => onFetchLayer(activeLayer)} className={`mt-3 text-xs font-medium ${layerMeta.color} hover:underline`}>
            Try again
          </button>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 overflow-hidden">
            {selected ? (
              <AssessmentDetail
                entry={selected}
                index={selectedIndex!}
                layer={activeLayer}
                isPickingLocation={locationTargetId === selected.field_assessment_id}
                onAddLocation={() => onAddLocation(selected.field_assessment_id)}
                onCancelLocation={() => onAddLocation(null)}
                onPhotoClick={onPhotoClick}
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