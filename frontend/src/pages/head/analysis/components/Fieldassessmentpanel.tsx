import { useState, useEffect } from "react";
import {
  Shield, MapPin, Leaf, ChevronRight, User,
  Calendar, AlertTriangle, CheckCircle, XCircle,
  Eye, Image as ImageIcon, RefreshCw, X, Camera,
  ZoomIn, FileText, Maximize2
} from "lucide-react";
import type {
  MCDALayer, FieldAssessmentEntry, LayerData,
} from "../hooks/useFieldAssessments";
import { api, api_second } from "@/constant/api";

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
  return api_second+`${url}`;
};

// ✅ Enhanced LayerDataRenderer with better visual hierarchy
const LayerDataRenderer = ({ data, level = 0 }: { data: LayerData; level?: number }) => {
  const entries = Object.entries(data);
  
  if (entries.length === 0) {
    return <p className="text-sm text-gray-400 italic bg-gray-50 p-3 rounded-lg">No data recorded</p>;
  }

  return (
    <div className={`space-y-3 ${level > 0 ? 'ml-3 border-l-2 border-gray-200 pl-3' : ''}`}>
      {entries.map(([key, value]) => {
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          return (
            <div key={key} className="space-y-2 bg-gray-50/50 p-3 rounded-lg">
              <p className={`text-xs font-bold uppercase text-gray-700 flex items-center gap-2 ${level === 0 ? 'border-b border-gray-200 pb-2' : ''}`}>
                <FileText size={14} className="text-gray-500" />
                {key.replace(/_/g, ' ')}
              </p>
              <LayerDataRenderer data={value as LayerData} level={level + 1} />
            </div>
          );
        }
        
        if (Array.isArray(value)) {
          return (
            <div key={key} className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wider text-gray-600 font-semibold">
                {key.replace(/_/g, ' ')}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {value.map((item, i) => (
                  <span key={i} className="inline-block bg-white text-gray-700 text-xs font-medium px-2.5 py-1 rounded-md border border-gray-200 shadow-sm">
                    {String(item).replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          );
        }
        
        // ✅ Highlight important notes with better styling
        const isNote = key.toLowerCase().includes('note') || key.toLowerCase().includes('comment') || key.toLowerCase().includes('observation');
        
        return (
          <div key={key} className={`flex flex-col gap-1 ${isNote ? 'bg-blue-50 border border-blue-200 p-3 rounded-lg' : ''}`}>
            <span className={`text-xs uppercase tracking-wider font-semibold ${isNote ? 'text-blue-700' : 'text-gray-600'}`}>
              {key.replace(/_/g, ' ')}
            </span>
            <div className={`text-sm font-medium leading-relaxed ${isNote ? 'text-blue-900' : 'text-gray-800'}`}>
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

// ✅ Full Image Modal Component
interface ImageModalProps {
  imageUrl: string;
  alt: string;
  onClose: () => void;
  metadata?: {
    layer?: string;
    description?: string;
    coordinates?: { lat: number; lng: number };
  };
}

const ImageModal = ({ imageUrl, alt, onClose, metadata }: ImageModalProps) => {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <div 
      className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/80 hover:text-white p-2 rounded-full bg-white/10 hover:bg-white/20 transition"
      >
        <X size={24} />
      </button>
      
      <div className="max-w-5xl max-h-[90vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
        <img 
          src={imageUrl} 
          alt={alt} 
          className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-2xl"
        />
        
        {metadata && (
          <div className="mt-4 bg-white/10 backdrop-blur-md text-white px-6 py-3 rounded-lg max-w-2xl w-full">
            <div className="flex items-start gap-4 text-sm">
              {metadata.layer && (
                <div className="flex items-center gap-2">
                  <Camera size={16} className="text-blue-300" />
                  <span className="capitalize">{metadata.layer.replace(/_/g, ' ')}</span>
                </div>
              )}
              {metadata.description && (
                <p className="flex-1">{metadata.description}</p>
              )}
              {metadata.coordinates && (
                <div className="flex items-center gap-2 text-xs text-white/70">
                  <MapPin size={14} />
                  <span>{metadata.coordinates.lat.toFixed(5)}, {metadata.coordinates.lng.toFixed(5)}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
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
  const [viewImage, setViewImage] = useState<{ url: string; alt: string; metadata: any } | null>(null);
  const loc = entry.location;
  const layerMeta = LAYERS.find((l) => l.id === layer)!;
  const hasLocation = !!loc?.latitude;

  const handleImageClick = (img: any) => {
    const imgUrl = getImageUrl(img.url);
    if (imgUrl) {
      setViewImage({
        url: imgUrl,
        alt: img.description || 'Assessment photo',
        metadata: {
          layer: img.layer,
          description: img.description,
          coordinates: img.latitude && img.longitude ? { lat: img.latitude, lng: img.longitude } : undefined
        }
      });
    }
    onPhotoClick?.(img);
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className={`p-4 ${layerMeta.bg} border-b ${layerMeta.border}`}>
        <div className="flex items-center gap-3">
          {entry.inspector.profile_image ? (
            <img src={getImageUrl(entry.inspector.profile_image)} alt={entry.inspector.full_name}
              className="w-10 h-10 rounded-full object-cover border-2 border-white shadow"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          ) : (
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${layerMeta.bg} border ${layerMeta.border}`}>
              <User size={18} className={layerMeta.color} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-gray-900 truncate">F{index + 1} — {entry.inspector.full_name}</p>
            <p className="text-xs text-gray-500 truncate">{entry.inspector.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 mt-3 text-xs text-gray-600 flex-wrap">
          <span className="flex items-center gap-1.5 bg-white/60 px-2.5 py-1 rounded-full">
            <Calendar size={12} /> {entry.assessment_date}
          </span>
          {loc ? (
            <span className="flex items-center gap-1.5 bg-white/60 px-2.5 py-1 rounded-full">
              <MapPin size={12} />
              {loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)}
              <span className="text-gray-400">(±{loc.gps_accuracy_meters}m)</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-orange-600 bg-orange-100/60 px-2.5 py-1 rounded-full italic">
              <MapPin size={12} /> No location set
            </span>
          )}
        </div>

        <div className="mt-3">
          {isPickingLocation ? (
            <button
              onClick={onCancelLocation}
              className="flex items-center gap-2 text-sm bg-orange-100 text-orange-700 border border-orange-300 px-4 py-2 rounded-full font-medium animate-pulse w-full justify-center hover:bg-orange-200 transition"
            >
              <X size={14} /> Click map to place location • Click to cancel
            </button>
          ) : (
            <button
              onClick={onAddLocation}
              className={`flex items-center gap-2 text-sm px-4 py-2 rounded-full font-medium border transition w-full justify-center
                ${hasLocation
                  ? "bg-green-100 text-green-700 border-green-300 hover:bg-green-200"
                  : "bg-orange-100 text-orange-700 border-orange-300 hover:bg-orange-200"}`}
            >
              <MapPin size={14} />
              {hasLocation ? "Update Location on Map" : "Add Location on Map"}
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex-1 overflow-y-auto space-y-6">
        {/* ✅ Enhanced Notes/Layer Data Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 border-b-2 border-gray-200 pb-2">
            <FileText size={18} className={layerMeta.color} />
            <p className="text-sm font-bold uppercase tracking-wider text-gray-700">
              {layerMeta.label} Assessment Notes
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <LayerDataRenderer data={entry.layer_data} />
          </div>
        </div>

        {/* ✅ Smaller Images with Better Grid */}
        {entry.images?.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 border-b-2 border-gray-200 pb-2">
              <Camera size={18} className="text-purple-600" />
              <p className="text-sm font-bold uppercase tracking-wider text-gray-700">
                Photos ({entry.images.length})
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {entry.images.map((img) => {
                const imgUrl = getImageUrl(img.url);
                return (
                  <div 
                    key={img.id} 
                    className="relative group rounded-lg overflow-hidden border-2 border-gray-200 bg-gray-50 aspect-square cursor-pointer hover:shadow-lg transition-all hover:border-blue-300"
                    onClick={() => handleImageClick(img)}
                  >
                    {imgUrl && !imgError[img.id] ? (
                      <>
                        <img src={imgUrl} alt={img.description}
                          className="w-full h-full object-cover transition group-hover:scale-110"
                          onError={() => setImgError((p) => ({ ...p, [img.id]: true }))} />
                        {/* Overlay on hover */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <div className="bg-white/90 text-gray-800 px-3 py-1.5 rounded-full flex items-center gap-1.5 text-xs font-medium">
                            <Maximize2 size={14} />
                            View Full
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-gray-400">
                        <ImageIcon size={24} />
                        <span className="text-[10px] mt-1 text-center px-2">Unavailable</span>
                      </div>
                    )}
                    
                    {/* GPS badge */}
                    {img.latitude && img.longitude && (
                      <div className="absolute top-1.5 right-1.5 bg-blue-500 text-white text-[9px] px-2 py-0.5 rounded-full shadow-md flex items-center gap-1">
                        <Camera size={10} /> GPS
                      </div>
                    )}
                    
                    {/* Layer badge */}
                    <div className="absolute bottom-1.5 left-1.5 right-1.5 bg-black/60 text-white text-[9px] px-1.5 py-1 rounded truncate opacity-0 group-hover:opacity-100 transition">
                      {img.description || img.layer.replace(/_/g, ' ')}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-gray-500 text-center italic">
              Click any photo to view full size
            </p>
          </div>
        )}
      </div>

      {/* Full Image Modal */}
      {viewImage && (
        <ImageModal
          imageUrl={viewImage.url}
          alt={viewImage.alt}
          metadata={viewImage.metadata}
          onClose={() => setViewImage(null)}
        />
      )}
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
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
        <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
          <Eye size={16} className="text-blue-500" /> Field Assessments
        </h3>
        {areaId ? (
          <button onClick={() => onFetchLayer(activeLayer)} disabled={loading[activeLayer]}
            className="text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2 py-1 rounded flex items-center gap-1 disabled:opacity-50 transition">
            <RefreshCw size={12} className={loading[activeLayer] ? "animate-spin" : ""} /> Refresh
          </button>
        ) : (
          <span className="text-xs text-gray-400 italic">No area selected</span>
        )}
      </div>

      <div className="flex border-b border-gray-100 bg-gray-50">
        {LAYERS.map((l) => {
          const count = assessments[l.id]?.length ?? 0;
          const active = l.id === activeLayer;
          return (
            <button key={l.id} onClick={() => handleLayerTab(l.id)}
              className={`flex-1 py-2.5 text-xs font-semibold transition relative ${active ? `${l.color} bg-white border-b-2` : "text-gray-500 hover:text-gray-700 hover:bg-white"}`}
              style={active ? { borderBottomColor: "currentColor" } : {}}>
              <l.icon size={12} className="mx-auto mb-1" />
              {l.short}
              {count > 0 && (
                <span className={`absolute top-1.5 right-2 text-[9px] font-bold ${l.color} ${l.bg} px-1.5 py-0.5 rounded-full border ${l.border}`}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Toggle Photo Markers Button */}
      {selected && selected.images?.length > 0 && (
        <div className="px-4 py-2.5 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
          <button
            onClick={() => onTogglePhotoMarkers(!showPhotoMarkers)}
            className={`flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg transition w-full justify-center shadow-sm
              ${showPhotoMarkers 
                ? 'bg-blue-600 text-white hover:bg-blue-700' 
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'}`}
          >
            <Camera size={14} />
            {showPhotoMarkers ? 'Hide Photo Locations on Map' : 'Show Photo Locations on Map'}
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${showPhotoMarkers ? 'bg-white/20' : 'bg-gray-200'}`}>
              {selected.images.length} photos
            </span>
          </button>
        </div>
      )}

      {!areaId ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-gray-400">
          <Eye size={32} className="mb-3 opacity-30" />
          <p className="text-sm font-medium text-gray-500">No area selected</p>
          <p className="text-xs mt-1">Select a reforestation area to view assessments</p>
        </div>
      ) : loading[activeLayer] ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-400">
            <RefreshCw size={24} className="animate-spin mx-auto mb-3" />
            <p className="text-sm">Loading {layerMeta.label} assessments...</p>
          </div>
        </div>
      ) : entries.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-gray-400">
          <AlertTriangle size={28} className="mb-3 opacity-40" />
          <p className="text-sm font-medium text-gray-500">No assessments found</p>
          <p className="text-xs mt-1">No {layerMeta.label} data for this area</p>
          <button onClick={() => onFetchLayer(activeLayer)} className={`mt-4 text-xs font-semibold ${layerMeta.color} hover:underline px-3 py-1.5 bg-white border border-gray-200 rounded-lg shadow-sm`}>
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
              <div className="flex-1 h-full flex flex-col items-center justify-center text-center p-6 text-gray-400 bg-gray-50">
                <ChevronRight size={24} className="mb-3 opacity-30" />
                <p className="text-sm font-medium text-gray-500">Select an assessment</p>
                <p className="text-xs mt-1">Click on an entry from the list to view details</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}