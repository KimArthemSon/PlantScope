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
  Save,
  X,
  Upload,
  Camera,
  PawPrint,
  Sparkles,
  PenLine,
  ImagePlus,
  FileCheck,
  ExternalLink,
  Pencil,
  ChevronLeft,
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
import { api } from "@/constant/api";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});
L.Marker.prototype.options.icon = DefaultIcon;

const API = api + "api/";

// ─────────────────────────────────────────────
// INTERFACES
// ─────────────────────────────────────────────
interface VerifiedAnimal {
  animal_id: number;
  name: string;
  scientific_name: string;
  admin_notes: string;
}

interface MetaVerification {
  status: "pending" | "draft" | "verified" | "rejected";
  verified_security_concerns: string[] | null;
  verified_accessibility: any;
  verified_land_classification_id: number | null;
  verified_land_classification_name?: string | null;
  decision_note?: string | null;
  verified_by?: string | null;
  verified_at?: string | null;
  verified_animals?: VerifiedAnimal[] | null;
}

// ✅ UPDATED: Removed file_url and permit_number, added notes
interface PermitItem {
  permit_id: number;
  document_type: string;
  notes: string | null;
  verification_notes?: string | null;
  uploaded_at?: string;
  uploaded_by?: string | null;
}

interface SiteImage {
  site_image_id: number;
  layer_tag: "safety" | "survivability" | "general";
  img_url: string | null;
  caption: string | null;
  created_at: string | null;
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

interface ValidationData {
  version?: number;
  site_data?: any;
  field_assessment_snapshot?: any;
  validated_by?: string | null;
  validated_at?: string | null;
}

interface SiteResponse {
  site_id: number;
  name: string;
  description: string | null;
  status: string;
  polygon_coordinates: [number, number][] | null;
  center_coordinate: [number, number] | null;
  ndvi_value: number | null;
  area_hectares: number;
  potential_sites: PotentialSite[];
  meta_verification: MetaVerification | null;
  permits: PermitItem[];
  site_images: SiteImage[];
  validation_data: ValidationData;
}

interface TreeSpeciesOption {
  tree_specie_id: number;
  name: string;
  description: string;
}

interface LandClassificationOption {
  land_classification_id: number;
  name: string;
}

// ────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  under_review: "bg-purple-50 text-purple-700 border-purple-200",
  accepted: "bg-blue-50 text-blue-700 border-blue-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  under_monitoring: "bg-teal-50 text-teal-700 border-teal-200",
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
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    icon: CheckCircle,
    label: "Verified",
  },
  rejected: {
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200",
    icon: XCircle,
    label: "Rejected",
  },
};

const LAYER_TAG_CONFIG: Record<
  string,
  { label: string; color: string; icon: any; bg: string }
> = {
  safety: {
    label: "Safety",
    color: "border-red-200",
    bg: "bg-red-50",
    icon: Shield,
  },
  survivability: {
    label: "Survivability",
    color: "border-emerald-200",
    bg: "bg-emerald-50",
    icon: Leaf,
  },
  general: {
    label: "General",
    color: "border-blue-200",
    bg: "bg-blue-50",
    icon: Camera,
  },
};

// ─────────────────────────────────────────────
// BENTO CARD
// ─────────────────────────────────────────────
const BentoCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  header?: {
    icon: any;
    title: string;
    badge?: string;
    action?: React.ReactNode;
  };
}> = ({ children, className = "", header }) => {
  return (
    <div
      className={`bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden ${className}`}
    >
      {header && (
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-gray-100 text-gray-600">
              <header.icon className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-semibold text-gray-800">
              {header.title}
            </h3>
            {header.badge && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-200 text-gray-700">
                {header.badge}
              </span>
            )}
          </div>
          {header.action && <div>{header.action}</div>}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
};

// ─────────────────────────────────────────────
// EDITABLE FIELD (Now More Obvious)
// ─────────────────────────────────────────────
const EditableField: React.FC<{
  value: string;
  placeholder?: string;
  onSave: (value: string) => Promise<void>;
  multiline?: boolean;
  className?: string;
  label?: string;
  icon?: any;
  variant?: "default" | "prominent";
}> = ({
  value,
  placeholder = "Click to edit...",
  onSave,
  multiline = false,
  className = "",
  label,
  icon: Icon,
  variant = "default",
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(editValue);
      setIsEditing(false);
    } catch (error) {
      console.error("Save failed:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className={`space-y-3 ${className}`}>
        {label && (
          <label className="text-xs font-medium text-gray-600 uppercase tracking-wide flex items-center gap-1.5">
            {Icon && <Icon size={12} />}
            {label}
          </label>
        )}
        {multiline ? (
          <textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            placeholder={placeholder}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100 resize-none"
            rows={4}
            autoFocus
          />
        ) : (
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            placeholder={placeholder}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
            autoFocus
          />
        )}
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gray-800 text-white rounded-md text-xs font-medium hover:bg-gray-900 transition-colors disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Save className="w-3 h-3" />
            )}
            Save
          </button>
          <button
            onClick={handleCancel}
            disabled={saving}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white text-gray-600 rounded-md text-xs font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 border border-gray-300"
          >
            <X className="w-3 h-3" />
            Cancel
          </button>
        </div>
      </div>
    );
  }

  const isProminent = variant === "prominent";

  return (
    <div
      onClick={() => setIsEditing(true)}
      className={`cursor-pointer group ${className} ${
        isProminent
          ? "bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-gray-400 hover:bg-gray-100 transition-all"
          : "hover:bg-gray-50 rounded-md p-2 -m-2 transition-colors"
      }`}
      title="Click to edit"
    >
      {label && (
        <label className={`text-xs font-medium uppercase tracking-wide flex items-center gap-1.5 mb-2 ${
          isProminent ? "text-gray-600" : "text-gray-500"
        }`}>
          {Icon && <Icon size={12} />}
          {label}
          {isProminent && (
            <span className="text-[10px] font-normal text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full ml-2">
              Click to edit
            </span>
          )}
        </label>
      )}
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          {value ? (
            multiline ? (
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                {value}
              </p>
            ) : (
              <p className={`text-sm ${isProminent ? "text-gray-800 font-medium" : "text-gray-700"}`}>
                {value}
              </p>
            )
          ) : (
            <p className="text-sm text-gray-400 italic flex items-center gap-1.5">
              <Edit3 size={12} className="opacity-60" />
              {placeholder}
            </p>
          )}
        </div>
        <div className={`flex-shrink-0 mt-0.5 ${
          isProminent 
            ? "opacity-100 text-gray-400" 
            : "opacity-0 group-hover:opacity-100 text-gray-400 transition-opacity"
        }`}>
          <Pencil className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// STAT CARD
// ─────────────────────────────────────────────
const StatCard: React.FC<{
  icon: any;
  label: string;
  value: string | number;
  subtext?: string;
  accent?: "emerald" | "blue" | "purple" | "gray";
}> = ({ icon: Icon, label, value, subtext, accent = "gray" }) => {
  const accentStyles = {
    emerald: {
      bg: "bg-emerald-50",
      border: "border-emerald-100",
      iconBg: "bg-emerald-100",
      iconColor: "text-emerald-600",
      valueColor: "text-emerald-700",
    },
    blue: {
      bg: "bg-blue-50",
      border: "border-blue-100",
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      valueColor: "text-blue-700",
    },
    purple: {
      bg: "bg-purple-50",
      border: "border-purple-100",
      iconBg: "bg-purple-100",
      iconColor: "text-purple-600",
      valueColor: "text-purple-700",
    },
    gray: {
      bg: "bg-gray-50",
      border: "border-gray-200",
      iconBg: "bg-gray-100",
      iconColor: "text-gray-600",
      valueColor: "text-gray-700",
    },
  };

  const style = accentStyles[accent];

  return (
    <div
      className={`p-4 rounded-lg border ${style.bg} ${style.border}`}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium text-gray-600 uppercase tracking-wide">
            {label}
          </p>
          <p className={`text-xl font-semibold ${style.valueColor} mt-1 truncate`}>
            {value}
          </p>
          {subtext && (
            <p className="text-[10px] text-gray-500 mt-0.5">{subtext}</p>
          )}
        </div>
        <div className={`p-1.5 rounded-md ${style.iconBg} flex-shrink-0`}>
          <Icon className={`w-4 h-4 ${style.iconColor}`} />
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────
function VerificationStatusBadge({ status }: { status: string }) {
  const config =
    VERIFICATION_STATUS_CONFIG[status] || VERIFICATION_STATUS_CONFIG["pending"];
  const Icon = config.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border ${config.bg} ${config.text} ${config.border}`}
    >
      <Icon size={12} /> {config.label}
    </span>
  );
}

function SecurityBadge({ concern }: { concern: string }) {
  const map: Record<string, { label: string; color: string; icon: any }> = {
    "Armed Threat / Violence": {
      label: "Armed Threat",
      color: "bg-red-50 text-red-700 border-red-200",
      icon: ShieldAlert,
    },
    "Hostile Person on Site": {
      label: "Hostile Person",
      color: "bg-red-50 text-red-700 border-red-200",
      icon: ShieldAlert,
    },
    "Illegal Activity Observed": {
      label: "Illegal Activity",
      color: "bg-orange-50 text-orange-700 border-orange-200",
      icon: AlertTriangle,
    },
    "Community Resistance": {
      label: "Community Resistance",
      color: "bg-amber-50 text-amber-700 border-amber-200",
      icon: AlertCircle,
    },
    "Land Conflict": {
      label: "Land Conflict",
      color: "bg-amber-50 text-amber-700 border-amber-200",
      icon: AlertCircle,
    },
    other: {
      label: "Other",
      color: "bg-gray-50 text-gray-700 border-gray-200",
      icon: AlertCircle,
    },
  };
  const config = map[concern] || {
    label: concern,
    color: "bg-gray-50 text-gray-700 border-gray-200",
    icon: AlertCircle,
  };
  const Icon = config.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border ${config.color}`}
    >
      <Icon size={10} /> {config.label}
    </span>
  );
}

// ─────────────────────────────────────────────
// MAP
// ─────────────────────────────────────────────
const GoToCenterButton: React.FC<{ center: [number, number] }> = ({
  center,
}) => {
  const map = useMap();
  return (
    <button
      onClick={() => map.flyTo(center, 16, { animate: true, duration: 1.5 })}
      style={{
        position: "absolute",
        bottom: "16px",
        right: "16px",
        zIndex: 1000,
      }}
      className="bg-gray-800 text-white px-3 py-2 rounded-md shadow-lg
                 hover:bg-gray-900 transition-colors flex items-center gap-2 text-xs font-medium"
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
  <div
    style={{ position: "relative", width: "100%", height: "100%" }}
    className="rounded-lg overflow-hidden border border-gray-200"
  >
    <MapContainer
      center={coordinates}
      zoom={16}
      scrollWheelZoom
      style={{ width: "100%", height: "100%", zIndex: 0 }}
    >
      <TileLayer
        url={`https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`}
        tileSize={512}
        zoomOffset={-1}
        attribution='&copy; <a href="https://www.mapbox.com/">Mapbox</a> &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
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
          pathOptions={{
            color: "#374151",
            fillColor: "#374151",
            fillOpacity: 0.2,
            weight: 2,
          }}
        />
      )}
      <GoToCenterButton center={coordinates} />
    </MapContainer>
    <div
      style={{
        position: "absolute",
        top: "12px",
        left: "12px",
        zIndex: 1000,
      }}
      className="bg-white/95 backdrop-blur px-3 py-1.5 rounded-md
                    shadow-sm text-xs font-mono text-gray-700 border border-gray-200 flex items-center gap-1.5"
    >
      <MapIcon className="w-3.5 h-3.5 text-gray-600" />
      {coordinates[0].toFixed(5)}, {coordinates[1].toFixed(5)}
    </div>
  </div>
);

// ─────────────────────────────────────────────
// IMAGES GALLERY
// ────────────────────────────────────────────
const SiteImagesGallery: React.FC<{
  siteId: number;
  images: SiteImage[];
  onImagesUpdate: () => void;
  token: string | null;
}> = ({ siteId, images, onImagesUpdate, token }) => {
  const [uploading, setUploading] = useState(false);
  const [selectedLayer, setSelectedLayer] = useState<
    "safety" | "survivability" | "general"
  >("general");
  const [caption, setCaption] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setUploadError(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadError("Please select an image file");
      return;
    }

    setUploading(true);
    setUploadError(null);
    setUploadSuccess(false);

    const formData = new FormData();
    formData.append("img", selectedFile);
    formData.append("layer_tag", selectedLayer);
    formData.append("caption", caption);

    try {
      const res = await fetch(`${API}upload_site_image/${siteId}/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (res.ok) {
        setUploadSuccess(true);
        setSelectedFile(null);
        setPreviewUrl(null);
        setCaption("");
        onImagesUpdate();
        setTimeout(() => setUploadSuccess(false), 3000);
      } else {
        const error = await res.json();
        setUploadError(error.error || "Upload failed");
      }
    } catch (error) {
      setUploadError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (imageId: number) => {
    if (!confirm("Are you sure you want to delete this image?")) return;

    try {
      const res = await fetch(`${API}delete_site_image/${imageId}/`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        onImagesUpdate();
      }
    } catch (error) {
      console.error("Delete failed:", error);
    }
  };

  const groupedImages = images.reduce(
    (acc, img) => {
      if (!acc[img.layer_tag]) acc[img.layer_tag] = [];
      acc[img.layer_tag].push(img);
      return acc;
    },
    {} as Record<string, SiteImage[]>,
  );

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div className="bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 p-4 hover:border-gray-400 transition-colors">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 bg-gray-200 rounded-md">
            <ImagePlus className="w-4 h-4 text-gray-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-800">
              Upload New Image
            </p>
            <p className="text-xs text-gray-500">
              Add photos for documentation
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Layer Tag
              </label>
              <select
                value={selectedLayer}
                onChange={(e) => setSelectedLayer(e.target.value as any)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:border-gray-400"
              >
                <option value="general">General</option>
                <option value="safety">Safety</option>
                <option value="survivability">Survivability</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Caption (optional)
              </label>
              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Image description..."
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:border-gray-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Image File
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-gray-700 file:text-white hover:file:bg-gray-800 file:cursor-pointer bg-white"
            />
          </div>

          {previewUrl && (
            <div className="relative rounded-md overflow-hidden border border-gray-200">
              <img
                src={previewUrl}
                alt="Preview"
                className="w-full h-48 object-cover"
              />
              <button
                onClick={() => {
                  setSelectedFile(null);
                  setPreviewUrl(null);
                }}
                className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full hover:bg-red-600 transition-colors shadow-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {uploadError && (
            <div className="flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {uploadError}
            </div>
          )}

          {uploadSuccess && (
            <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2 text-xs">
              <CheckCircle className="w-4 h-4" />
              Image uploaded successfully!
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={uploading || !selectedFile}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-md text-sm font-medium hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Upload Image
              </>
            )}
          </button>
        </div>
      </div>

      {/* Gallery */}
      {images.length > 0 ? (
        <div className="space-y-4">
          {Object.entries(groupedImages).map(([layerTag, layerImages]) => {
            const config =
              LAYER_TAG_CONFIG[layerTag] || LAYER_TAG_CONFIG.general;
            const Icon = config.icon;
            return (
              <div key={layerTag}>
                <div className="flex items-center gap-2 mb-3">
                  <div className={`p-1.5 rounded-md ${config.bg}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <h3 className="text-sm font-medium text-gray-700">
                    {config.label}
                  </h3>
                  <span className="text-xs text-gray-500">
                    ({layerImages.length})
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {layerImages.map((img) => (
                    <div key={img.site_image_id} className="relative group">
                      <div
                        className={`aspect-square rounded-md overflow-hidden border ${config.color} bg-white`}
                      >
                        {img.img_url ? (
                          <img
                            src={`${img.img_url}`}
                            alt={img.caption || "Site image"}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                            <ImageIcon className="w-8 h-8 text-gray-300" />
                          </div>
                        )}
                      </div>
                      {img.caption && (
                        <p className="text-xs text-gray-600 mt-1.5 line-clamp-2 px-1">
                          {img.caption}
                        </p>
                      )}
                      <button
                        onClick={() => handleDelete(img.site_image_id)}
                        className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-lg"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-400">
          <Camera className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No images uploaded yet</p>
          <p className="text-xs mt-1">Upload your first image above</p>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────
// METADATA VERIFICATION
// ─────────────────────────────────────────────
const MetadataVerificationCard: React.FC<{
  verification: MetaVerification | null;
  landClassificationName?: string | null;
}> = ({ verification, landClassificationName }) => {
  if (!verification) {
    return (
      <BentoCard
        header={{ icon: ShieldCheck, title: "Metadata Verification" }}
      >
        <div className="text-center py-4 text-gray-400">
          <ShieldCheck className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No verification record yet</p>
        </div>
      </BentoCard>
    );
  }

  const statusConfig =
    VERIFICATION_STATUS_CONFIG[verification.status] ||
    VERIFICATION_STATUS_CONFIG["pending"];
  const StatusIcon = statusConfig.icon;

  let accessibilityType = "Not specified";
  let accessibilityDescription = "";
  if (verification.verified_accessibility) {
    if (
      Array.isArray(verification.verified_accessibility) &&
      verification.verified_accessibility.length > 0
    ) {
      accessibilityType =
        verification.verified_accessibility[0].type || "Not specified";
      accessibilityDescription =
        verification.verified_accessibility[0].description || "";
    } else if (typeof verification.verified_accessibility === "object") {
      accessibilityType =
        verification.verified_accessibility.type || "Not specified";
      accessibilityDescription =
        verification.verified_accessibility.description || "";
    }
  }

  const verifiedAnimals = verification.verified_animals || [];

  const displayLandClassification = () => {
    if (landClassificationName && landClassificationName.trim() !== "") {
      return (
        <div className="p-3 bg-purple-50 rounded-md border border-purple-200">
          <span className="text-sm font-medium text-purple-800">
            {landClassificationName}
          </span>
        </div>
      );
    }
    if (
      verification.verified_land_classification_name &&
      verification.verified_land_classification_name.trim() !== ""
    ) {
      return (
        <div className="p-3 bg-purple-50 rounded-md border border-purple-200">
          <span className="text-sm font-medium text-purple-800">
            {verification.verified_land_classification_name}
          </span>
        </div>
      );
    }
    if (verification.verified_land_classification_id) {
      return (
        <div className="p-3 bg-amber-50 rounded-md border border-amber-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            <span className="text-sm text-amber-800">
              Classification ID: {verification.verified_land_classification_id}
            </span>
          </div>
        </div>
      );
    }
    return (
      <div className="p-3 bg-gray-50 rounded-md border border-gray-200">
        <span className="text-sm text-gray-500 italic">Not classified</span>
      </div>
    );
  };

  return (
    <BentoCard
      header={{
        icon: ShieldCheck,
        title: "Metadata Verification",
        badge: statusConfig.label,
      }}
    >
      <div className="space-y-4">
        <div
          className={`p-3 rounded-md border ${statusConfig.bg} ${statusConfig.border}`}
        >
          <div className="flex items-center gap-2">
            <StatusIcon size={16} className={statusConfig.text} />
            <span className={`text-sm font-medium ${statusConfig.text}`}>
              {statusConfig.label}
            </span>
          </div>
          {(verification.verified_by || verification.verified_at) && (
            <div className="flex items-center gap-3 text-xs text-gray-500 mt-2 pt-2 border-t border-gray-200/50">
              {verification.verified_by && (
                <span className="flex items-center gap-1">
                  <ShieldCheck size={10} /> {verification.verified_by}
                </span>
              )}
              {verification.verified_at && (
                <span className="flex items-center gap-1">
                  <Clock size={10} />{" "}
                  {new Date(verification.verified_at).toLocaleDateString()}
                </span>
              )}
            </div>
          )}
        </div>

        {verification.decision_note && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-gray-500" />
              <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                Decision Note
              </p>
            </div>
            <div className="p-3 bg-gray-50 rounded-md border border-gray-200">
              <p className="text-sm text-gray-700">
                {verification.decision_note}
              </p>
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center gap-2 mb-2">
            <ShieldAlert className="w-4 h-4 text-orange-600" />
            <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">
              Security Concerns
            </p>
          </div>
          {verification.verified_security_concerns &&
          verification.verified_security_concerns.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {verification.verified_security_concerns.map((concern, idx) => (
                <SecurityBadge key={idx} concern={concern} />
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-md border border-emerald-200">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span className="text-sm text-emerald-700 font-medium">
                No security concerns
              </span>
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <Route className="w-4 h-4 text-blue-600" />
            <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">
              Accessibility
            </p>
          </div>
          <div className="p-3 bg-blue-50 rounded-md border border-blue-200">
            <div className="flex items-center gap-2 mb-1">
              <Car className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-800 capitalize">
                {accessibilityType.replace(/_/g, " ")}
              </span>
            </div>
            {accessibilityDescription && (
              <p className="text-xs text-blue-700 mt-1">
                {accessibilityDescription}
              </p>
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <Layers className="w-4 h-4 text-purple-600" />
            <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">
              Land Classification
            </p>
          </div>
          {displayLandClassification()}
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <PawPrint className="w-4 h-4 text-emerald-600" />
            <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">
              Verified Animals ({verifiedAnimals.length})
            </p>
          </div>
          {verifiedAnimals.length > 0 ? (
            <div className="space-y-2">
              {verifiedAnimals.map((animal) => (
                <div
                  key={animal.animal_id}
                  className="p-3 bg-emerald-50 rounded-md border border-emerald-200"
                >
                  <div className="flex items-start gap-2">
                    <PawPrint className="w-3.5 h-3.5 text-emerald-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-emerald-800">
                        {animal.name}
                      </p>
                      {animal.scientific_name && (
                        <p className="text-xs text-emerald-600 italic">
                          {animal.scientific_name}
                        </p>
                      )}
                    </div>
                  </div>
                  {animal.admin_notes && (
                    <div className="mt-2 pl-5 border-l-2 border-emerald-300 ml-5">
                      <p className="text-xs text-gray-600">
                        <span className="font-medium text-gray-700">
                          Notes:
                        </span>{" "}
                        {animal.admin_notes}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-md border border-gray-200">
              <PawPrint className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-500 italic">
                No animals verified
              </span>
            </div>
          )}
        </div>
      </div>
    </BentoCard>
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
  const [species, setSpecies] =
    useState<SpeciesRecommendation[]>(initialSpecies);
  const [allSpecies, setAllSpecies] = useState<TreeSpeciesOption[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingSpecies, setLoadingSpecies] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

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
    const found = allSpecies.find(
      (s) => s.tree_specie_id === Number(selectedId),
    );
    if (!found || species.find((s) => s.id === found.tree_specie_id)) return;
    setSpecies((prev) => [
      ...prev,
      {
        id: found.tree_specie_id,
        name: found.name,
        rank: prev.length + 1,
        notes: notes || null,
      },
    ]);
    setSelectedId("");
    setNotes("");
  };

  const handleRemove = (id: number) => {
    setSpecies((prev) =>
      prev.filter((s) => s.id !== id).map((s, i) => ({ ...s, rank: i + 1 })),
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      const res = await fetch(`${API}update_species/${siteId}/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          species: species.map((s) => ({
            tree_species_id: s.id,
            priority_rank: s.rank,
            notes: s.notes || "",
          })),
        }),
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch {
      /* silent */
    }
    setSaving(false);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-all duration-200">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-gray-100">
              <Leaf className="w-4 h-4 text-gray-600" />
            </div>
            <div>
              <h2 className="text-sm font-medium text-gray-800 flex items-center gap-2">
                Species Recommendations
                {canEdit && (
                  <span className="text-[10px] font-normal text-gray-600 bg-gray-200 px-2 py-0.5 rounded">
                    Editable
                  </span>
                )}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {species.length > 0
                  ? `${species.length} species configured`
                  : "Add recommended tree species"}
              </p>
            </div>
          </div>
          {species.length > 0 && (
            <span className="px-2.5 py-1 rounded-md text-xs bg-gray-800 text-white font-medium">
              {species.length}
            </span>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {species.length > 0 ? (
          <div className="space-y-2">
            {species.map((sp) => (
              <div
                key={sp.id}
                className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-md px-3 py-2.5 hover:border-gray-300 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="w-7 h-7 rounded-full bg-gray-800 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {sp.rank}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {sp.name}
                    </p>
                    {sp.notes && (
                      <p className="text-xs text-gray-500 truncate">
                        {sp.notes}
                      </p>
                    )}
                  </div>
                </div>
                {canEdit && (
                  <button
                    onClick={() => handleRemove(sp.id)}
                    className="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 rounded-md transition-colors flex-shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-gray-400 bg-gray-50 rounded-md border border-dashed border-gray-200">
            <Leaf className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium text-gray-600">
              No species recommended yet
            </p>
            <p className="text-xs mt-1">Add species below to get started</p>
          </div>
        )}

        {canEdit && (
          <div className="bg-gray-50 rounded-md border-2 border-dashed border-gray-300 p-4 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Plus className="w-4 h-4 text-gray-600" />
              <p className="text-xs font-medium text-gray-700 uppercase tracking-wide">
                Add New Species
              </p>
            </div>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              disabled={loadingSpecies}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-gray-400 bg-white"
            >
              <option value="">
                {loadingSpecies ? "Loading species..." : "Select a tree species..."}
              </option>
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
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-gray-400 bg-white"
            />
            <button
              onClick={handleAdd}
              disabled={!selectedId}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-md text-sm font-medium hover:bg-gray-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" /> Add Species
            </button>
          </div>
        )}

        {saveSuccess && (
          <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2 text-xs font-medium">
            <CheckCircle className="w-4 h-4" /> Saved successfully
          </div>
        )}

        {canEdit && species.length > 0 && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-md text-sm font-medium hover:bg-gray-900 transition-colors disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? "Saving..." : "Save Recommendations"}
          </button>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// PERMITS
// ────────────────────────────────────────────
const PermitsCard: React.FC<{ permits: PermitItem[] }> = ({ permits }) => {
  return (
    <BentoCard
      header={{
        icon: FileCheck,
        title: "Legal Documents",
        badge: permits.length > 0 ? `${permits.length}` : undefined,
      }}
    >
      {permits.length > 0 ? (
        <div className="space-y-2">
          {permits.map((permit) => (
            <div
              key={permit.permit_id}
              className="flex flex-col p-3 bg-gray-50 rounded-md border border-gray-200 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-start gap-2.5 w-full">
                <div className="p-1.5 bg-blue-100 rounded-md flex-shrink-0 mt-0.5">
                  <FileText className="w-4 h-4 text-blue-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium text-gray-800 capitalize block">
                    {permit.document_type.replace(/_/g, " ")}
                  </span>
                  {/* ✅ UPDATED: Display notes instead of permit_number */}
                  {permit.notes && (
                    <p className="text-xs text-gray-600 mt-1 italic break-words">
                      "{permit.notes}"
                    </p>
                  )}
                  <div className="flex items-center gap-2 text-[10px] text-gray-500 mt-1.5">
                    {permit.uploaded_at && (
                      <span>
                        Added: {new Date(permit.uploaded_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6 text-gray-400">
          <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No documents recorded</p>
        </div>
      )}
    </BentoCard>
  );
};

// ─────────────────────────────────────────────
// VALIDATION DATA
// ────────────────────────────────────────────
const ValidationDataCard: React.FC<{
  validationData: ValidationData | null;
}> = ({ validationData }) => {
  const [expanded, setExpanded] = useState(false);

  if (
    !validationData ||
    !validationData.site_data ||
    Object.keys(validationData.site_data).length === 0
  ) {
    return null;
  }

  const siteData = validationData.site_data;
  const hasSafetyNote = siteData.safety?.decision_note;
  const hasSurvivabilityNote = siteData.survivability?.decision_note;
  const hasFinalDecision = siteData.final_decision;

  return (
    <BentoCard
      header={{
        icon: ShieldCheck,
        title: "Validation Data",
        badge: validationData.version ? `v${validationData.version}` : undefined,
        action: (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-gray-400 hover:text-gray-600"
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        ),
      }}
    >
      {expanded ? (
        <div className="space-y-4">
          {hasSafetyNote && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-red-600" />
                <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                  Safety Note
                </p>
              </div>
              <div className="p-3 bg-red-50 rounded-md border border-red-200">
                <p className="text-sm text-gray-700">
                  {siteData.safety.decision_note}
                </p>
              </div>
            </div>
          )}

          {hasSurvivabilityNote && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Leaf className="w-4 h-4 text-emerald-600" />
                <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                  Survivability Note
                </p>
              </div>
              <div className="p-3 bg-emerald-50 rounded-md border border-emerald-200">
                <p className="text-sm text-gray-700">
                  {siteData.survivability.decision_note}
                </p>
              </div>
            </div>
          )}

          {hasFinalDecision && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-4 h-4 text-blue-600" />
                <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                  Final Decision
                </p>
              </div>
              <div
                className={`p-3 rounded-md border ${
                  siteData.final_decision === "ACCEPT"
                    ? "bg-emerald-50 border-emerald-200"
                    : "bg-red-50 border-red-200"
                }`}
              >
                <p
                  className={`text-sm font-medium ${
                    siteData.final_decision === "ACCEPT"
                      ? "text-emerald-800"
                      : "text-red-800"
                  }`}
                >
                  {siteData.final_decision}
                </p>
                {siteData.final_decision_note && (
                  <p className="text-sm text-gray-700 mt-2">
                    {siteData.final_decision_note}
                  </p>
                )}
              </div>
            </div>
          )}

          {(validationData.validated_by || validationData.validated_at) && (
            <div className="flex items-center gap-4 text-xs text-gray-500 pt-3 border-t border-gray-100">
              {validationData.validated_by && (
                <span className="flex items-center gap-1">
                  <ShieldCheck size={10} /> Validated by:{" "}
                  {validationData.validated_by}
                </span>
              )}
              {validationData.validated_at && (
                <span className="flex items-center gap-1">
                  <Clock size={10} />{" "}
                  {new Date(validationData.validated_at).toLocaleDateString()}
                </span>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-4 text-gray-400">
          <p className="text-xs">Click to expand validation details</p>
        </div>
      )}
    </BentoCard>
  );
};

// ─────────────────────────────────────────────
// POTENTIAL SITES
// ─────────────────────────────────────────────
const PotentialSitesCard: React.FC<{ sites: PotentialSite[] }> = ({
  sites,
}) => {
  if (sites.length === 0) return null;

  return (
    <BentoCard
      header={{
        icon: MapPin,
        title: "Consolidated Potential Sites",
        badge: `${sites.length}`,
      }}
    >
      <div className="space-y-2">
        {sites.map((site) => (
          <div
            key={site.potential_sites_id}
            className="p-3 bg-gray-50 rounded-md border border-gray-200 hover:border-gray-300 transition-colors"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium text-gray-800">
                {site.site_id || `Potential #${site.potential_sites_id}`}
              </span>
              <span className="text-xs text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded">
                {site.area_hectares.toFixed(2)} ha
              </span>
            </div>
            <div className="flex gap-3 text-xs text-gray-600">
              <span className="flex items-center gap-1">
                <Leaf size={10} /> NDVI: {site.avg_ndvi.toFixed(3)}
              </span>
              <span className="flex items-center gap-1">
                <Sparkles size={10} /> Score: {site.suitability_score.toFixed(2)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </BentoCard>
  );
};

// ────────────────────────────────────────────
// SKELETON
// ─────────────────────────────────────────────
const SiteSkeleton: React.FC = () => (
  <div className="min-h-screen bg-gray-50 p-6 md:p-8 animate-pulse">
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="h-8 w-64 bg-gray-200 rounded" />
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-7 h-80 bg-gray-200 rounded-lg" />
        <div className="col-span-12 lg:col-span-5 space-y-4">
          <div className="h-24 bg-gray-200 rounded-lg" />
          <div className="h-32 bg-gray-200 rounded-lg" />
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
  const [landClassificationName, setLandClassificationName] = useState<
    string | null
  >(null);
  const [allLandClassifications, setAllLandClassifications] = useState<
    LandClassificationOption[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState<string | null>(null);

  const canEdit = true;
  const resolvedId = site_id || id || "0";

  const fetchLandClassifications = async () => {
    try {
      const res = await fetch(`${API}get_land_classifications_list/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data: LandClassificationOption[] = await res.json();
        setAllLandClassifications(data);
      }
    } catch (err) {
      console.error("Failed to fetch land classifications:", err);
    }
  };

  const fetchSiteData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API}get_site/${resolvedId}/`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        if (response.status === 401)
          throw new Error("Authentication required. Please log in.");
        if (response.status === 403) throw new Error("Access denied.");
        throw new Error(`HTTP ${response.status}`);
      }
      const result: SiteResponse = await response.json();
      setSiteData(result);

      const lcId = result.meta_verification?.verified_land_classification_id;
      if (lcId) {
        if (result.meta_verification?.verified_land_classification_name) {
          setLandClassificationName(
            result.meta_verification.verified_land_classification_name,
          );
        } else if (allLandClassifications.length > 0) {
          const found = allLandClassifications.find(
            (lc) => lc.land_classification_id === lcId,
          );
          setLandClassificationName(found ? found.name : null);
        } else {
          try {
            const lcRes = await fetch(
              `${API}get_land_classifications_list/`,
              {
                headers: { Authorization: `Bearer ${token}` },
              },
            );
            if (lcRes.ok) {
              const lcData: LandClassificationOption[] = await lcRes.json();
              setAllLandClassifications(lcData);
              const found = lcData.find(
                (lc) => lc.land_classification_id === lcId,
              );
              setLandClassificationName(found ? found.name : null);
            }
          } catch (err) {
            console.error("Failed to fetch land classifications:", err);
            setLandClassificationName(null);
          }
        }
      } else {
        setLandClassificationName(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load site data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLandClassifications();
    fetchSiteData();
  }, [resolvedId]);

  useEffect(() => {
    if (
      siteData?.meta_verification?.verified_land_classification_id &&
      !landClassificationName &&
      allLandClassifications.length > 0
    ) {
      const lcId = siteData.meta_verification.verified_land_classification_id;
      const found = allLandClassifications.find(
        (lc) => lc.land_classification_id === lcId,
      );
      if (found) {
        setLandClassificationName(found.name);
      }
    }
  }, [siteData, allLandClassifications, landClassificationName]);

  const handleUpdateName = async (newName: string) => {
    if (!siteData) return;

    try {
      const res = await fetch(
        `${API}update_site_basic_info/${siteData.site_id}/`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ name: newName }),
        },
      );

      if (res.ok) {
        setSiteData({ ...siteData, name: newName });
        setUpdateSuccess("Name updated successfully");
        setTimeout(() => setUpdateSuccess(null), 3000);
      } else {
        const error = await res.json();
        throw new Error(error.error || "Failed to update name");
      }
    } catch (error) {
      throw error;
    }
  };

  const handleUpdateDescription = async (newDescription: string) => {
    if (!siteData) return;

    try {
      const res = await fetch(
        `${API}update_site_basic_info/${siteData.site_id}/`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ description: newDescription }),
        },
      );

      if (res.ok) {
        setSiteData({ ...siteData, description: newDescription || null });
        setUpdateSuccess("Description updated successfully");
        setTimeout(() => setUpdateSuccess(null), 3000);
      } else {
        const error = await res.json();
        throw new Error(error.error || "Failed to update description");
      }
    } catch (error) {
      throw error;
    }
  };

  if (loading && !siteData) return <SiteSkeleton />;

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-lg shadow-sm border border-red-200 p-8 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            Failed to Load Site
          </h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={fetchSiteData}
            className="px-4 py-2 bg-gray-800 text-white rounded-md text-sm font-medium hover:bg-gray-900 transition-colors inline-flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!siteData) return <></>;

  const coordinates: [number, number] = siteData.center_coordinate ?? [
    10.1015, 124.6012,
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans text-gray-800">
      <div className="max-w-7xl mx-auto">
        {/* ── HEADER ── */}
        <div className="mb-6">
          {/* PROMINENT BACK BUTTON */}
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50 hover:border-gray-400 transition-all shadow-sm mb-4"
          >
            <ChevronLeft size={18} strokeWidth={2.5} />
            Back to Sites
          </button>

          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 md:p-6">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                {/* Editable Name - NOW MORE OBVIOUS */}
                <div className="mb-4">
                  {canEdit ? (
                    <EditableField
                      value={siteData.name}
                      onSave={handleUpdateName}
                      placeholder="Enter site name..."
                      label="Site Name"
                      icon={MapPin}
                      variant="prominent"
                    />
                  ) : (
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">
                      {siteData.name}
                    </h1>
                  )}
                </div>

                {/* Status Badges */}
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span
                    className={`px-3 py-1.5 rounded-md text-xs font-medium border capitalize ${
                      STATUS_COLORS[siteData.status] ?? STATUS_COLORS.pending
                    }`}
                  >
                    {siteData.status.replace(/_/g, " ")}
                  </span>
                  {siteData.meta_verification && (
                    <VerificationStatusBadge
                      status={siteData.meta_verification.status}
                    />
                  )}
                </div>

                {/* Site IDs */}
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                  <span className="font-mono bg-gray-100 px-2 py-1 rounded border border-gray-200">
                    Site #{siteData.site_id}
                  </span>
                  <span className="w-1 h-1 bg-gray-300 rounded-full" />
                  <span className="font-mono bg-gray-100 px-2 py-1 rounded border border-gray-200">
                    Area #{id}
                  </span>
                </div>

                {updateSuccess && (
                  <div className="mt-3 flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2 text-xs font-medium w-fit">
                    <CheckCircle className="w-4 h-4" />
                    {updateSuccess}
                  </div>
                )}
              </div>

              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={fetchSiteData}
                  disabled={loading}
                  className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50 hover:border-gray-400 transition-all disabled:opacity-50 inline-flex items-center gap-2 shadow-sm"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  Refresh
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ─ BENTO GRID LAYOUT ── */}
        <div className="grid grid-cols-12 gap-4">
          {/* ROW 1: Map (7 cols) + Stats & Description (5 cols) */}
          <div className="col-span-12 lg:col-span-7">
            <BentoCard
              header={{ icon: MapIcon, title: "Site Location" }}
              className="h-full"
            >
              <div style={{ height: "320px" }}>
                <SiteMap
                  coordinates={coordinates}
                  polygon={siteData.polygon_coordinates}
                  siteName={siteData.name}
                />
              </div>
            </BentoCard>
          </div>

          <div className="col-span-12 lg:col-span-5 space-y-4">
            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-3">
              <StatCard
                icon={Ruler}
                label="Area"
                value={`${siteData.area_hectares.toFixed(2)} ha`}
                accent="emerald"
              />
              <StatCard
                icon={FileText}
                label="Documents"
                value={siteData.permits.length}
                subtext="recorded"
                accent="blue"
              />
              <StatCard
                icon={PawPrint}
                label="Animals"
                value={siteData.meta_verification?.verified_animals?.length || 0}
                subtext="verified"
                accent="purple"
              />
            </div>

            {/* Description Card */}
            <BentoCard
              header={{ icon: FileText, title: "Description" }}
            >
              {canEdit ? (
                <EditableField
                  value={siteData.description || ""}
                  onSave={handleUpdateDescription}
                  placeholder="Add a description for this site..."
                  multiline
                  label="Site Description"
                  icon={Pencil}
                  variant="prominent"
                />
              ) : (
                <p className="text-sm text-gray-700">
                  {siteData.description || (
                    <span className="text-gray-400 italic">No description provided</span>
                  )}
                </p>
              )}
            </BentoCard>
          </div>

          {/* ROW 2: Verification (6 cols) + Species (6 cols) */}
          <div className="col-span-12 lg:col-span-6">
            <MetadataVerificationCard
              verification={siteData.meta_verification}
              landClassificationName={landClassificationName}
            />
          </div>

          <div className="col-span-12 lg:col-span-6">
            <SpeciesRecommendationsPanel
              siteId={siteData.site_id}
              initialSpecies={[]}
              token={token}
              canEdit={canEdit}
            />
          </div>

          {/* ROW 3: Images (Full Width) */}
          <div className="col-span-12">
            <BentoCard
              header={{
                icon: Camera,
                title: "Site Images",
                badge: siteData.site_images.length > 0 ? `${siteData.site_images.length}` : undefined,
              }}
            >
              <SiteImagesGallery
                siteId={siteData.site_id}
                images={siteData.site_images}
                onImagesUpdate={fetchSiteData}
                token={token}
              />
            </BentoCard>
          </div>

          {/* ROW 4: Documents (6 cols) + Validation (6 cols) */}
          <div className="col-span-12 lg:col-span-6">
            <PermitsCard permits={siteData.permits} />
          </div>

          <div className="col-span-12 lg:col-span-6">
            <ValidationDataCard validationData={siteData.validation_data} />
          </div>

          {/* ROW 5: Potential Sites (Full Width) */}
          {siteData.potential_sites.length > 0 && (
            <div className="col-span-12">
              <PotentialSitesCard sites={siteData.potential_sites} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}