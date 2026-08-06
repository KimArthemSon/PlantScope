import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  ClipboardCheck,
  Save,
  X,
  FileText,
  Users,
  Trash2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Image as ImageIcon,
  Layers,
  RotateCcw,
  Loader2,
  Plus,
  Route,
  Clock,
  MapPin,
  Target,
  Building2,
  Filter,
  ChevronDown,
  ChevronRight,
  Shield,
  Car,
  Check,
  Navigation,
  Edit3,
  Map as MapIcon,
  PawPrint,
  Landmark,
  ArrowRight,
} from "lucide-react";
import PlantScopeAlert from "@/components/alert/PlantScopeAlert";
import PlantScopeConfirm from "@/components/alert/PlantScopeConfirm";
import { api } from "@/constant/api.ts";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useUserRole } from "@/hooks/authorization";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const API = api + "api/";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const greenIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const redIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

// ─────────────────────────────────────────────
// Type Definitions
// ─────────────────────────────────────────────
interface SiteInfo {
  site_id: number;
  name: string;
  status: string;
  reforestation_area_id: number;
  reforestation_area_name: string;
}

interface AnimalInfo {
  animal_id: number;
  name: string;
  scientific_name: string;
}

interface FieldAssessment {
  id: number;
  type: "specific" | "general";
  inspector_id: number | null;
  inspector_name: string;
  inspector_email: string;
  inspector_profile_img: string | null;
  assessment_date: string | null;
  location: any;
  field_assessment_data: any;
  is_submitted: boolean;
  image_count: number;
  images: Array<{
    image_id: number;
    url: string | null;
    layer: string;
    latitude: number | null;
    longitude: number | null;
    description: string;
    created_at: string;
  }>;
  created_at: string;
  submitted_at: string;
  land_classification: { id: number; name: string } | null;
  animals_present: AnimalInfo[];
}

interface VerifiedAnimal {
  animal_id: number;
  name: string;
  scientific_name: string;
  admin_notes: string;
}

interface VerificationRecord {
  id: number;
  status: "pending" | "draft" | "verified" | "rejected";
  verified_security_concerns: string[] | null;
  verified_accessibility: any;
  verified_land_classification_id: number | null;
  verified_land_classification_name: string | null;
  decision_note: string | null;
  referenced_assessment_ids: number[] | null;
  verified_by: string | null;
  verified_at: string | null;
  verified_animals: VerifiedAnimal[];
}

interface AssessmentCounts {
  total: number;
  specific: number;
  general: number;
}

interface PermitItem {
  permit_id: number;
  document_type: string;
  notes: string | null;
  verification_notes: string | null;
  uploaded_at: string;
  uploaded_by: string | null;
}

interface LandClassificationOption {
  land_classification_id: number;
  name: string;
  ownership_type: "public" | "private";
}

interface AnimalOption {
  animal_id: number;
  name: string;
  scientific_name: string;
  description: string;
}

interface AccessibilityEntry {
  id: string;
  type: string;
  description: string;
}

type AssessmentFilter = "all" | "specific" | "general";

// ─────────────────────────────────────────────
// Map Click Handler Component
// ─────────────────────────────────────────────
function MapClickHandler({
  isPickingLocation,
  onLocationPick,
}: {
  isPickingLocation: boolean;
  onLocationPick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      if (isPickingLocation) {
        onLocationPick(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

// ─────────────────────────────────────────────
// Helper Components
// ─────────────────────────────────────────────
function VerificationStatusBadge({
  status,
}: {
  status: "pending" | "draft" | "verified" | "rejected";
}) {
  const config: Record<
    string,
    {
      bg: string;
      text: string;
      border: string;
      icon: any;
      label: string;
      dot: string;
    }
  > = {
    pending: {
      bg: "bg-amber-50",
      text: "text-amber-700",
      border: "border-amber-200",
      icon: Clock,
      label: "Pending Review",
      dot: "bg-amber-500",
    },
    draft: {
      bg: "bg-slate-50",
      text: "text-slate-700",
      border: "border-slate-200",
      icon: RotateCcw,
      label: "Draft",
      dot: "bg-slate-400",
    },
    verified: {
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      border: "border-emerald-200",
      icon: CheckCircle,
      label: "Verified",
      dot: "bg-emerald-500",
    },
    rejected: {
      bg: "bg-red-50",
      text: "text-red-700",
      border: "border-red-200",
      icon: XCircle,
      label: "Rejected",
      dot: "bg-red-500",
    },
  };
  const {
    bg,
    text,
    border,
    icon: Icon,
    label,
    dot,
  } = config[status] || config["pending"];
  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${bg} ${text} ${border}`}
    >
      <div className={`w-2 h-2 rounded-full ${dot}`}></div>
      <Icon size={14} />
      {label}
    </div>
  );
}

function AssessmentTypeBadge({ type }: { type: "specific" | "general" }) {
  if (type === "specific") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
        <Target size={12} /> Specific
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
      <Building2 size={12} /> General
    </span>
  );
}

function SecurityBadge({ concern }: { concern: string }) {
  const map: Record<string, { label: string; color: string; icon: any }> = {
    "Armed Threat / Violence": {
      label: "Armed Threat",
      color: "bg-red-100 text-red-700 border-red-200",
      icon: AlertTriangle,
    },
    "Hostile Person on Site": {
      label: "Hostile Person",
      color: "bg-red-100 text-red-700 border-red-200",
      icon: AlertTriangle,
    },
    "Illegal Activity Observed": {
      label: "Illegal Activity",
      color: "bg-orange-100 text-orange-700 border-orange-200",
      icon: AlertTriangle,
    },
    "Community Resistance": {
      label: "Community Resistance",
      color: "bg-yellow-100 text-yellow-700 border-yellow-200",
      icon: Users,
    },
    "Land Conflict": {
      label: "Land Conflict",
      color: "bg-yellow-100 text-yellow-700 border-yellow-200",
      icon: AlertCircle,
    },
    other: {
      label: "Other",
      color: "bg-slate-100 text-slate-700 border-slate-200",
      icon: AlertCircle,
    },
  };
  const config = map[concern] || {
    label: concern,
    color: "bg-slate-100 text-slate-700 border-slate-200",
    icon: AlertCircle,
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border ${config.color}`}
    >
      <config.icon size={12} /> {config.label}
    </span>
  );
}

function AnimalBadge({ animal }: { animal: AnimalInfo }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
      <PawPrint size={11} /> {animal.name}
    </span>
  );
}

function AssessmentDataViewer({
  data,
  landClassification,
  animalsPresent,
}: {
  data: any;
  landClassification?: { id: number; name: string } | null;
  animalsPresent?: AnimalInfo[];
}) {
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({
    accessibility: true,
    legal_documents: true,
    security_concerns: true,
    land_classification: true,
    animals: true,
  });

  if (!data || !data.meta_data)
    return (
      <p className="text-xs text-slate-400 italic">
        No assessment data available
      </p>
    );
  const metaData = data.meta_data;
  const toggleSection = (section: string) =>
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));

  return (
    <div className="space-y-2.5">
      {landClassification && (
        <div className="border border-slate-200 rounded-lg overflow-hidden bg-white hover:border-slate-300 transition-colors">
          <button
            onClick={() => toggleSection("land_classification")}
            className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Layers size={16} className="text-emerald-600" />
              <span className="text-sm font-semibold text-slate-800">
                Land Classification
              </span>
            </div>
            {expandedSections.land_classification ? (
              <ChevronDown size={16} className="text-slate-400" />
            ) : (
              <ChevronRight size={16} className="text-slate-400" />
            )}
          </button>
          {expandedSections.land_classification && (
            <div className="p-4 bg-slate-50 border-t border-slate-200">
              <div className="flex items-center gap-2">
                <CheckCircle size={14} className="text-emerald-600" />
                <p className="text-sm font-semibold text-slate-800">
                  {landClassification.name}
                </p>
              </div>
              {metaData.legal_documents?.land_classification
                ?.inspector_notes && (
                <p className="text-xs text-slate-600 mt-3 italic">
                  "
                  {metaData.legal_documents.land_classification.inspector_notes}
                  "
                </p>
              )}
            </div>
          )}
        </div>
      )}
      {animalsPresent && animalsPresent.length > 0 && (
        <div className="border border-slate-200 rounded-lg overflow-hidden bg-white hover:border-slate-300 transition-colors">
          <button
            onClick={() => toggleSection("animals")}
            className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <PawPrint size={16} className="text-emerald-600" />
              <span className="text-sm font-semibold text-slate-800">
                Animals Observed ({animalsPresent.length})
              </span>
            </div>
            {expandedSections.animals ? (
              <ChevronDown size={16} className="text-slate-400" />
            ) : (
              <ChevronRight size={16} className="text-slate-400" />
            )}
          </button>
          {expandedSections.animals && (
            <div className="p-4 bg-slate-50 border-t border-slate-200">
              <div className="flex flex-wrap gap-2">
                {animalsPresent.map((animal) => (
                  <div
                    key={animal.animal_id}
                    className="p-3 bg-white rounded-lg border border-emerald-200 hover:border-emerald-300 transition-colors"
                  >
                    <p className="text-xs font-bold text-slate-800">
                      {animal.name}
                    </p>
                    {animal.scientific_name && (
                      <p className="text-[11px] text-slate-500 italic mt-1">
                        {animal.scientific_name}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {metaData.accessibility && (
        <div className="border border-slate-200 rounded-lg overflow-hidden bg-white hover:border-slate-300 transition-colors">
          <button
            onClick={() => toggleSection("accessibility")}
            className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Car size={16} className="text-emerald-600" />
              <span className="text-sm font-semibold text-slate-800">
                Accessibility
              </span>
            </div>
            {expandedSections.accessibility ? (
              <ChevronDown size={16} className="text-slate-400" />
            ) : (
              <ChevronRight size={16} className="text-slate-400" />
            )}
          </button>
          {expandedSections.accessibility && (
            <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-4">
              {metaData.accessibility.vehicle_access && (
                <div>
                  <p className="text-xs uppercase font-semibold text-slate-500 mb-2">
                    Vehicle Access
                  </p>
                  {Array.isArray(metaData.accessibility.vehicle_access) ? (
                    <div className="flex flex-wrap gap-2">
                      {metaData.accessibility.vehicle_access.map(
                        (access: string, idx: number) => (
                          <span
                            key={idx}
                            className="px-3 py-1.5 bg-white text-slate-700 rounded-lg text-xs font-medium border border-slate-200"
                          >
                            {access}
                          </span>
                        ),
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-700">
                      {metaData.accessibility.vehicle_access}
                    </p>
                  )}
                </div>
              )}
              {metaData.accessibility.notes && (
                <div>
                  <p className="text-xs uppercase font-semibold text-slate-500 mb-2">
                    Notes
                  </p>
                  <p className="text-sm text-slate-700">
                    {metaData.accessibility.notes}
                  </p>
                </div>
              )}
              {metaData.accessibility.route_description && (
                <div>
                  <p className="text-xs uppercase font-semibold text-slate-500 mb-2">
                    Route Description
                  </p>
                  <p className="text-sm text-slate-700">
                    {metaData.accessibility.route_description}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {metaData.legal_documents && (
        <div className="border border-slate-200 rounded-lg overflow-hidden bg-white hover:border-slate-300 transition-colors">
          <button
            onClick={() => toggleSection("legal_documents")}
            className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <FileText size={16} className="text-emerald-600" />
              <span className="text-sm font-semibold text-slate-800">
                Legal Documents
              </span>
            </div>
            {expandedSections.legal_documents ? (
              <ChevronDown size={16} className="text-slate-400" />
            ) : (
              <ChevronRight size={16} className="text-slate-400" />
            )}
          </button>
          {expandedSections.legal_documents && (
            <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-3">
              {metaData.legal_documents.land_title && (
                <div className="p-3 bg-white rounded-lg border border-slate-200">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle size={14} className="text-emerald-600" />
                    <p className="text-xs font-semibold text-slate-800">
                      Land Title
                    </p>
                  </div>
                  {metaData.legal_documents.land_title.note && (
                    <p className="text-xs text-slate-600 italic">
                      "{metaData.legal_documents.land_title.note}"
                    </p>
                  )}
                </div>
              )}
              {metaData.legal_documents.tax_declaration && (
                <div className="p-3 bg-white rounded-lg border border-slate-200">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle size={14} className="text-emerald-600" />
                    <p className="text-xs font-semibold text-slate-800">
                      Tax Declaration
                    </p>
                  </div>
                  {metaData.legal_documents.tax_declaration.note && (
                    <p className="text-xs text-slate-600 italic">
                      "{metaData.legal_documents.tax_declaration.note}"
                    </p>
                  )}
                </div>
              )}
              {metaData.legal_documents.other_documents &&
                Array.isArray(metaData.legal_documents.other_documents) && (
                  <div>
                    <p className="text-xs uppercase font-semibold text-slate-500 mb-2">
                      Other Documents
                    </p>
                    {metaData.legal_documents.other_documents.map(
                      (doc: any, idx: number) => (
                        <div
                          key={idx}
                          className="p-3 bg-white rounded-lg border border-slate-200 mb-2"
                        >
                          {doc.note && (
                            <p className="text-xs text-slate-600 italic">
                              "{doc.note}"
                            </p>
                          )}
                        </div>
                      ),
                    )}
                  </div>
                )}
            </div>
          )}
        </div>
      )}

      {metaData.security_concerns && (
        <div className="border border-slate-200 rounded-lg overflow-hidden bg-white hover:border-slate-300 transition-colors">
          <button
            onClick={() => toggleSection("security_concerns")}
            className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <ShieldAlert size={16} className="text-emerald-600" />
              <span className="text-sm font-semibold text-slate-800">
                Security Concerns
              </span>
            </div>
            {expandedSections.security_concerns ? (
              <ChevronDown size={16} className="text-slate-400" />
            ) : (
              <ChevronRight size={16} className="text-slate-400" />
            )}
          </button>
          {expandedSections.security_concerns && (
            <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-4">
              {metaData.security_concerns.selected &&
                Array.isArray(metaData.security_concerns.selected) &&
                metaData.security_concerns.selected.length > 0 && (
                  <div>
                    <p className="text-xs uppercase font-semibold text-slate-500 mb-2">
                      Selected Concerns
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {metaData.security_concerns.selected.map(
                        (concern: string, idx: number) => (
                          <SecurityBadge key={idx} concern={concern} />
                        ),
                      )}
                    </div>
                  </div>
                )}
              {metaData.security_concerns.note && (
                <div>
                  <p className="text-xs uppercase font-semibold text-slate-500 mb-2">
                    Additional Notes
                  </p>
                  <p className="text-sm text-slate-700">
                    {metaData.security_concerns.note}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────
export default function MetaDataVerification() {
  const { id } = useParams<{ id: string }>();
  const token = localStorage.getItem("token");
  const navigate = useNavigate();

  const { userRole } = useUserRole();
  const canManageAssessments =
    userRole === "DataManager" || userRole === "CityENROHead";

  const [siteInfo, setSiteInfo] = useState<SiteInfo | null>(null);
  const [verification, setVerification] = useState<VerificationRecord | null>(
    null,
  );
  const [assessmentCounts, setAssessmentCounts] = useState<AssessmentCounts>({
    total: 0,
    specific: 0,
    general: 0,
  });

  const [verifiedSecurityConcerns, setVerifiedSecurityConcerns] = useState<
    string[]
  >([]);
  const [verifiedAccessibility, setVerifiedAccessibility] = useState<
    AccessibilityEntry[]
  >([]);
  const [verifiedLandClassificationId, setVerifiedLandClassificationId] =
    useState<number | "">("");
  const [decisionNote, setDecisionNote] = useState("");
  const [referencedAssessmentIds, setReferencedAssessmentIds] = useState<
    number[]
  >([]);
  const [verifiedAnimals, setVerifiedAnimals] = useState<VerifiedAnimal[]>([]);

  const [fieldAssessments, setFieldAssessments] = useState<FieldAssessment[]>(
    [],
  );
  const [assessmentFilter, setAssessmentFilter] =
    useState<AssessmentFilter>("all");
  const [filterDateFrom, setFilterDateFrom] = useState<string>("");
  const [filterDateTo, setFilterDateTo] = useState<string>("");

  const [permits, setPermits] = useState<PermitItem[]>([]);
  const [landClassifications, setLandClassifications] = useState<
    LandClassificationOption[]
  >([]);
  const [animals, setAnimals] = useState<AnimalOption[]>([]);

  const [PSalert, setPSAlert] = useState<{
    type: "success" | "failed" | "error";
    title: string;
    message: string;
  } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    variant: "danger" | "warning";
    confirmLabel: string;
    onConfirm: () => void;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPermit, setUploadingPermit] = useState(false);

  const [newPermit, setNewPermit] = useState({
    document_type: "land_title",
    notes: "",
    verification_notes: "",
  });

  const [newAccessibility, setNewAccessibility] = useState<AccessibilityEntry>({
    id: "",
    type: "",
    description: "",
  });
  const [newAnimalId, setNewAnimalId] = useState<number | "">("");
  const [newAnimalNotes, setNewAnimalNotes] = useState("");

  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [selectedAssessment, setSelectedAssessment] =
    useState<FieldAssessment | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isPickingLocation, setIsPickingLocation] = useState(false);
  const [manualLat, setManualLat] = useState<string>("");
  const [manualLng, setManualLng] = useState<string>("");
  const [mapMarkerPosition, setMapMarkerPosition] = useState<
    [number, number] | null
  >(null);
  const [savingLocation, setSavingLocation] = useState(false);

  const selectedLC = landClassifications.find(
    (lc) => lc.land_classification_id === verifiedLandClassificationId,
  );
  const derivedOwnershipType = selectedLC?.ownership_type || null;

  const filteredAssessments = fieldAssessments.filter((a) => {
    if (assessmentFilter !== "all" && a.type !== assessmentFilter) return false;
    if (filterDateFrom || filterDateTo) {
      if (!a.assessment_date) return false;
      const assessmentDate = new Date(a.assessment_date);
      assessmentDate.setHours(0, 0, 0, 0);
      if (filterDateFrom) {
        const fromDate = new Date(filterDateFrom);
        fromDate.setHours(0, 0, 0, 0);
        if (assessmentDate < fromDate) return false;
      }
      if (filterDateTo) {
        const toDate = new Date(filterDateTo);
        toDate.setHours(23, 59, 59, 999);
        if (assessmentDate > toDate) return false;
      }
    }
    return true;
  });

  async function handleUnsendAssessment(assessmentId: number) {
    setConfirmDialog({
      title: "Unsend Assessment",
      message:
        "Are you sure you want to unsend this assessment? It will be reverted to a draft state.",
      variant: "warning",
      confirmLabel: "Unsend",
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          const res = await fetch(
            `${API}field_assessments/${assessmentId}/unsent/`,
            { method: "POST", headers: { Authorization: `Bearer ${token}` } },
          );
          const data = await res.json();
          if (res.ok) {
            setPSAlert({
              type: "success",
              title: "Success",
              message: data.message || "Assessment marked as unsent.",
            });
            await fetchSiteVerification();
          } else {
            setPSAlert({
              type: "error",
              title: "Error",
              message: data.error || "Failed to unsend assessment.",
            });
          }
        } catch {
          setPSAlert({
            type: "error",
            title: "Error",
            message: "Network error while unsending.",
          });
        }
      },
    });
  }

  async function handleDeleteAssessment(assessmentId: number) {
    setConfirmDialog({
      title: "Delete Assessment",
      message:
        "Permanently delete this field assessment? This action cannot be undone.",
      variant: "danger",
      confirmLabel: "Delete",
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          const res = await fetch(
            `${API}field_assessments/${assessmentId}/head_delete/`,
            { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
          );
          const data = await res.json();
          if (res.ok) {
            setPSAlert({
              type: "success",
              title: "Deleted",
              message: data.message || "Assessment deleted successfully.",
            });
            await fetchSiteVerification();
          } else {
            setPSAlert({
              type: "error",
              title: "Error",
              message: data.error || "Failed to delete assessment.",
            });
          }
        } catch {
          setPSAlert({
            type: "error",
            title: "Error",
            message: "Network error while deleting.",
          });
        }
      },
    });
  }

  async function fetchSiteVerification() {
    if (!id || !token) return;
    try {
      const verificationRes = await fetch(`${API}site/${id}/verification/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (verificationRes.ok) {
        const verificationData = await verificationRes.json();
        const ver = verificationData.verification;
        setSiteInfo(verificationData.site_info);
        setAssessmentCounts(
          verificationData.assessment_counts || {
            total: 0,
            specific: 0,
            general: 0,
          },
        );
        setVerification(ver);
        setVerifiedSecurityConcerns(ver.verified_security_concerns || []);

        const backendAcc = ver.verified_accessibility;
        if (Array.isArray(backendAcc) && backendAcc.length > 0) {
          setVerifiedAccessibility(
            backendAcc.map((a: any, i: number) => ({
              id: `acc-${i}`,
              type: a.type || "vehicle_accessible",
              description: a.description || "",
            })),
          );
        } else if (
          backendAcc &&
          typeof backendAcc === "object" &&
          Object.keys(backendAcc).length > 0
        ) {
          setVerifiedAccessibility([
            {
              id: "acc-0",
              type: backendAcc.type || "vehicle_accessible",
              description: backendAcc.description || "",
            },
          ]);
        } else {
          setVerifiedAccessibility([]);
        }

        setVerifiedLandClassificationId(
          ver.verified_land_classification_id || "",
        );
        setDecisionNote(ver.decision_note || "");
        setReferencedAssessmentIds(ver.referenced_assessment_ids || []);
        setFieldAssessments(verificationData.field_assessments || []);
        setVerifiedAnimals(ver.verified_animals || []);
      } else {
        setPSAlert({
          type: "error",
          title: "Error",
          message: "Failed to load verification data.",
        });
      }
    } catch {
      setPSAlert({
        type: "error",
        title: "Error",
        message: "Failed to load verification data.",
      });
    }
  }

  async function fetchPermits() {
    if (!id || !token) return;
    try {
      const res = await fetch(`${API}site/${id}/permits/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.data) setPermits(data.data);
    } catch (err) {
      console.error(err);
    }
  }

  async function fetchLandClassifications() {
    if (!token) return;
    try {
      const res = await fetch(`${API}get_land_classifications_list/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.data) setLandClassifications(data.data);
    } catch (err) {
      console.error(err);
    }
  }

  async function fetchAnimals() {
    if (!token) return;
    try {
      const res = await fetch(`${API}get_animals_list/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAnimals(data || []);
      }
    } catch (err) {
      console.error("Failed to fetch animals:", err);
    }
  }

  async function saveVerification(status: "draft" | "verified" | "rejected") {
    if (!id || !token) return;
    if (!decisionNote.trim()) {
      setPSAlert({
        type: "failed",
        title: "Validation Error",
        message: "Decision note is required.",
      });
      return;
    }
    if (status === "verified" && !verifiedLandClassificationId) {
      setPSAlert({
        type: "failed",
        title: "Validation Error",
        message: "Land classification is required for acceptance.",
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        verified_security_concerns: verifiedSecurityConcerns,
        verified_accessibility: verifiedAccessibility.map(
          ({ type, description }) => ({ type, description }),
        ),
        verified_land_classification_id: verifiedLandClassificationId || null,
        decision_note: decisionNote,
        referenced_assessment_ids: referencedAssessmentIds,
        status: status,
        verified_animals: verifiedAnimals.map((a) => ({
          animal_id: a.animal_id,
          notes: a.admin_notes || "",
        })),
      };

      const res = await fetch(`${API}site/${id}/verification/update/`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        const action =
          status === "draft"
            ? "saved as draft"
            : status === "verified"
              ? "approved"
              : "rejected";
        setPSAlert({
          type: "success",
          title: "Success",
          message: `Verification ${action}.`,
        });
        await fetchSiteVerification();
      } else {
        setPSAlert({
          type: "error",
          title: "Error",
          message: data.error || "Failed to save verification.",
        });
      }
    } catch {
      setPSAlert({ type: "error", title: "Error", message: "Network error." });
    } finally {
      setSaving(false);
    }
  }

  async function handleAddPermitRecord() {
    if (!id || !token) return;
    if (!newPermit.notes.trim()) {
      setPSAlert({
        type: "failed",
        title: "Required",
        message: "Notes/details are required.",
      });
      return;
    }
    setUploadingPermit(true);
    try {
      const formData = new FormData();
      formData.append("document_type", newPermit.document_type);
      formData.append("notes", newPermit.notes);
      formData.append("verification_notes", newPermit.verification_notes);

      const res = await fetch(`${API}site/${id}/permits/upload/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();

      if (res.ok) {
        setPSAlert({
          type: "success",
          title: "Added",
          message: "Document record saved.",
        });
        setNewPermit({
          document_type: "land_title",
          notes: "",
          verification_notes: "",
        });
        fetchPermits();
      } else {
        setPSAlert({
          type: "error",
          title: "Failed",
          message: data.error || "Failed to add record.",
        });
      }
    } catch {
      setPSAlert({ type: "error", title: "Error", message: "Network error." });
    } finally {
      setUploadingPermit(false);
    }
  }

  async function handleDeletePermit(permitId: number) {
    setConfirmDialog({
      title: "Delete Permit Record",
      message: "Delete this document record?",
      variant: "danger",
      confirmLabel: "Delete",
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          const res = await fetch(`${API}site/permits/${permitId}/delete/`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            setPSAlert({
              type: "success",
              title: "Deleted",
              message: "Record deleted.",
            });
            fetchPermits();
          } else {
            setPSAlert({
              type: "error",
              title: "Failed",
              message: "Could not delete.",
            });
          }
        } catch {
          setPSAlert({
            type: "error",
            title: "Error",
            message: "Network error.",
          });
        }
      },
    });
  }

  function toggleAssessmentReference(assessmentId: number) {
    setReferencedAssessmentIds((prev) =>
      prev.includes(assessmentId)
        ? prev.filter((id) => id !== assessmentId)
        : [...prev, assessmentId],
    );
  }

  function addAccessibilityEntry() {
    if (!newAccessibility.type) {
      setPSAlert({
        type: "failed",
        title: "Required",
        message: "Please select an access type.",
      });
      return;
    }
    if (
      newAccessibility.type === "other" &&
      !newAccessibility.description.trim()
    ) {
      setPSAlert({
        type: "failed",
        title: "Required",
        message: "Please describe access for 'Other' type.",
      });
      return;
    }
    const entry: AccessibilityEntry = {
      id: `acc-${Date.now()}`,
      type: newAccessibility.type,
      description: newAccessibility.description,
    };
    setVerifiedAccessibility((prev) => [...prev, entry]);
    setNewAccessibility({ id: "", type: "", description: "" });
  }

  function removeAccessibilityEntry(entryId: string) {
    setVerifiedAccessibility((prev) => prev.filter((e) => e.id !== entryId));
  }

  function addVerifiedAnimal() {
    if (!newAnimalId) {
      setPSAlert({
        type: "failed",
        title: "Required",
        message: "Please select an animal.",
      });
      return;
    }
    if (verifiedAnimals.some((a) => a.animal_id === newAnimalId)) {
      setPSAlert({
        type: "failed",
        title: "Duplicate",
        message: "This animal is already in the verified list.",
      });
      return;
    }
    const animal = animals.find((a) => a.animal_id === newAnimalId);
    if (!animal) return;

    setVerifiedAnimals((prev) => [
      ...prev,
      {
        animal_id: animal.animal_id,
        name: animal.name,
        scientific_name: animal.scientific_name,
        admin_notes: newAnimalNotes,
      },
    ]);
    setNewAnimalId("");
    setNewAnimalNotes("");
  }

  function removeVerifiedAnimal(animalId: number) {
    setVerifiedAnimals((prev) => prev.filter((a) => a.animal_id !== animalId));
  }

  function updateVerifiedAnimalNotes(animalId: number, notes: string) {
    setVerifiedAnimals((prev) =>
      prev.map((a) =>
        a.animal_id === animalId ? { ...a, admin_notes: notes } : a,
      ),
    );
  }

  function openMapModal(assessment: FieldAssessment) {
    setSelectedAssessment(assessment);
    setIsMapModalOpen(true);
    setIsEditMode(false);
    setIsPickingLocation(false);
    if (
      assessment.location &&
      assessment.location.latitude &&
      assessment.location.longitude
    ) {
      const lat = Number(assessment.location.latitude);
      const lng = Number(assessment.location.longitude);
      setMapMarkerPosition([lat, lng]);
      setManualLat(lat.toString());
      setManualLng(lng.toString());
    } else {
      setMapMarkerPosition(null);
      setManualLat("");
      setManualLng("");
      setIsEditMode(true);
    }
  }

  function closeMapModal() {
    setIsMapModalOpen(false);
    setSelectedAssessment(null);
    setIsEditMode(false);
    setIsPickingLocation(false);
    setMapMarkerPosition(null);
    setManualLat("");
    setManualLng("");
  }

  function handleLocationPick(lat: number, lng: number) {
    setMapMarkerPosition([lat, lng]);
    setManualLat(lat.toFixed(6));
    setManualLng(lng.toFixed(6));
    setIsPickingLocation(false);
    setPSAlert({
      type: "success",
      title: "Location Set",
      message: `Location updated to ${lat.toFixed(6)}, ${lng.toFixed(6)}`,
    });
  }

  function handleManualCoordinateSubmit() {
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);
    if (
      isNaN(lat) ||
      isNaN(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      setPSAlert({
        type: "failed",
        title: "Invalid Coordinates",
        message:
          "Please enter valid latitude (-90 to 90) and longitude (-180 to 180).",
      });
      return;
    }
    setMapMarkerPosition([lat, lng]);
    setPSAlert({
      type: "success",
      title: "Location Set",
      message: `Location updated to ${lat.toFixed(6)}, ${lng.toFixed(6)}`,
    });
  }

  async function saveLocation() {
    if (!selectedAssessment || !mapMarkerPosition || !token) return;
    const [lat, lng] = mapMarkerPosition;
    setSavingLocation(true);
    try {
      const payload = {
        field_assessment_id: selectedAssessment.id,
        coordinate: {
          latitude: lat,
          longitude: lng,
          gps_accuracy_meters:
            selectedAssessment.location?.gps_accuracy_meters || 20,
        },
      };
      const res = await fetch(`${API}update_field_assessment_coordinate/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setPSAlert({
          type: "success",
          title: "Location Saved",
          message: data.message || "Assessment location updated.",
        });
        setFieldAssessments((prev) =>
          prev.map((a) =>
            a.id === selectedAssessment.id
              ? {
                  ...a,
                  location: {
                    latitude: lat,
                    longitude: lng,
                    gps_accuracy_meters: payload.coordinate.gps_accuracy_meters,
                  },
                }
              : a,
          ),
        );
        setSelectedAssessment({
          ...selectedAssessment,
          location: {
            latitude: lat,
            longitude: lng,
            gps_accuracy_meters: payload.coordinate.gps_accuracy_meters,
          },
        });
        setIsEditMode(false);
      } else {
        setPSAlert({
          type: "error",
          title: "Save Failed",
          message: data.message || data.error || "Failed to save location.",
        });
      }
    } catch {
      setPSAlert({
        type: "error",
        title: "Error",
        message: "Network error while saving location.",
      });
    } finally {
      setSavingLocation(false);
    }
  }

  function startPickingLocation() {
    setIsPickingLocation(true);
    setPSAlert({
      type: "success",
      title: "Pick Location",
      message: "Click on the map to set the location.",
    });
  }

  useEffect(() => {
    if (id && token) {
      setLoading(true);
      Promise.all([
        fetchSiteVerification(),
        fetchPermits(),
        fetchLandClassifications(),
        fetchAnimals(),
      ]).finally(() => setLoading(false));
    }
  }, [id, token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <Loader2 className="animate-spin h-8 w-8 text-emerald-600 mx-auto mb-3" />
          <p className="text-sm text-slate-600">Loading verification data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full h-screen bg-slate-50 gap-5 overflow-hidden p-5">
      {PSalert && (
        <PlantScopeAlert
          type={PSalert.type}
          title={PSalert.title}
          message={PSalert.message}
          onClose={() => setPSAlert(null)}
        />
      )}
      {confirmDialog && (
        <PlantScopeConfirm
          title={confirmDialog.title}
          message={confirmDialog.message}
          variant={confirmDialog.variant}
          confirmLabel={confirmDialog.confirmLabel}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}

      {/* ───────── LEFT PANEL: Field Assessments List ───────── */}
      <div className="w-[420px] bg-white rounded-2xl shadow-sm flex flex-col min-h-0 border border-slate-200">
        <div className="border-b border-slate-200 p-5 bg-gradient-to-br from-white to-slate-50">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-emerald-100 rounded-lg">
              <ClipboardCheck size={20} className="text-emerald-700" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Inspector Submissions
              </h2>
              <p className="text-sm text-slate-600 mt-0.5">
                {siteInfo?.name || `Site #${id}`}
              </p>
            </div>
          </div>

          {siteInfo?.reforestation_area_name && (
            <p className="text-xs text-slate-500 bg-slate-100 px-2.5 py-1.5 rounded-lg inline-block mt-2">
              📍 {siteInfo.reforestation_area_name}
            </p>
          )}

          <div className="mt-4 flex gap-1.5 bg-slate-100 p-1.5 rounded-xl">
            <button
              onClick={() => setAssessmentFilter("all")}
              className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                assessmentFilter === "all"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Filter size={13} /> All ({assessmentCounts.total})
            </button>
            <button
              onClick={() => setAssessmentFilter("specific")}
              className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                assessmentFilter === "specific"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Target size={13} /> Specific ({assessmentCounts.specific})
            </button>
            <button
              onClick={() => setAssessmentFilter("general")}
              className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                assessmentFilter === "general"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Building2 size={13} /> General ({assessmentCounts.general})
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">
                From Date
              </label>
              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">
                To Date
              </label>
              <input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
              />
            </div>
          </div>
          {(filterDateFrom || filterDateTo) && (
            <button
              onClick={() => {
                setFilterDateFrom("");
                setFilterDateTo("");
              }}
              className="mt-2.5 w-full text-xs text-red-600 hover:text-red-700 font-semibold flex items-center justify-center gap-1.5 py-1.5 hover:bg-red-50 rounded-lg transition-colors"
            >
              <X size={12} /> Clear Dates
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
          {filteredAssessments.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <div className="w-12 h-12 mx-auto mb-3 bg-slate-200 rounded-full flex items-center justify-center">
                <ClipboardCheck className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-sm font-medium">
                {assessmentFilter === "all"
                  ? "No field assessments found."
                  : assessmentFilter === "specific"
                    ? "No site-specific assessments found."
                    : "No general area assessments found."}
              </p>
            </div>
          ) : (
            filteredAssessments.map((item) => {
              const isSelected = referencedAssessmentIds.includes(item.id);
              const hasLocation =
                item.location &&
                item.location.latitude &&
                item.location.longitude;
              return (
                <div
                  key={item.id}
                  className={`bg-white rounded-xl p-4 border-2 transition-all hover:shadow-md ${
                    isSelected
                      ? "border-emerald-300 bg-emerald-50/30"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-bold text-sm overflow-hidden flex-shrink-0 shadow-sm">
                      {item.inspector_profile_img ? (
                        <img
                          src={
                            item.inspector_profile_img.startsWith("http")
                              ? item.inspector_profile_img
                              : `${item.inspector_profile_img}`
                          }
                          alt={item.inspector_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        item.inspector_name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {item.inspector_name}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {item.assessment_date
                          ? new Date(item.assessment_date).toLocaleDateString()
                          : "No date"}
                      </p>
                    </div>
                    <AssessmentTypeBadge type={item.type} />
                  </div>

                  {(item.land_classification ||
                    (item.animals_present &&
                      item.animals_present.length > 0)) && (
                    <div className="mb-3 space-y-2">
                      {item.land_classification && (
                        <div className="flex items-center gap-2 p-2 bg-emerald-50 rounded-lg">
                          <Layers
                            size={12}
                            className="text-emerald-600 flex-shrink-0"
                          />
                          <span className="text-xs font-semibold text-emerald-900">
                            {item.land_classification.name}
                          </span>
                        </div>
                      )}
                      {item.animals_present &&
                        item.animals_present.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-2 px-2">
                              <PawPrint
                                size={12}
                                className="text-emerald-600"
                              />
                              <span className="text-xs font-semibold text-emerald-900">
                                {item.animals_present.length} animal
                                {item.animals_present.length !== 1 ? "s" : ""}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1.5 px-2">
                              {item.animals_present
                                .slice(0, 3)
                                .map((animal) => (
                                  <AnimalBadge
                                    key={animal.animal_id}
                                    animal={animal}
                                  />
                                ))}
                              {item.animals_present.length > 3 && (
                                <span className="text-xs text-slate-500 self-center font-medium">
                                  +{item.animals_present.length - 3}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                    </div>
                  )}

                  <label className="flex items-center gap-2 mb-3 p-2.5 bg-emerald-50/50 rounded-lg cursor-pointer hover:bg-emerald-100/50 transition-colors border border-emerald-200/50">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleAssessmentReference(item.id)}
                      className="rounded accent-emerald-600"
                    />
                    <span className="text-xs font-semibold text-emerald-900">
                      Use as evidence
                    </span>
                  </label>

                  {item.images && item.images.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs uppercase font-bold text-slate-500 mb-2">
                        📎 Attachments ({item.images.length})
                      </p>
                      <div className="grid grid-cols-4 gap-1.5">
                        {item.images.slice(0, 8).map((img) => (
                          <a
                            key={img.image_id}
                            href={
                              img.url
                                ? img.url.startsWith("http")
                                  ? img.url
                                  : `${img.url}`
                                : "#"
                            }
                            target="_blank"
                            rel="noreferrer"
                            className="block aspect-square rounded-lg overflow-hidden border-2 border-slate-200 hover:border-emerald-400 transition-all hover:shadow-md"
                            title={img.description || img.layer}
                          >
                            {img.url ? (
                              <img
                                src={
                                  img.url.startsWith("http")
                                    ? img.url
                                    : `${img.url}`
                                }
                                alt={img.description || img.layer}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display =
                                    "none";
                                }}
                              />
                            ) : (
                              <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                                <ImageIcon
                                  size={14}
                                  className="text-slate-400"
                                />
                              </div>
                            )}
                          </a>
                        ))}
                        {item.images.length > 8 && (
                          <div className="aspect-square rounded-lg bg-slate-200 flex items-center justify-center text-xs text-slate-600 font-bold">
                            +{item.images.length - 8}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="mb-2.5 flex flex-col gap-2.5">
                    <div className="flex items-center gap-2">
                      {hasLocation ? (
                        <div className="flex items-center gap-1.5 text-xs text-emerald-700 flex-1 bg-emerald-50 px-2.5 py-1.5 rounded-lg font-medium">
                          <MapPin size={12} className="text-emerald-600" />
                          <span>
                            {Number(item.location.latitude).toFixed(5)},{" "}
                            {Number(item.location.longitude).toFixed(5)}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs text-orange-700 flex-1 bg-orange-50 px-2.5 py-1.5 rounded-lg font-medium">
                          <AlertCircle size={12} className="text-orange-600" />
                          <span>No location</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {canManageAssessments && (
                        <>
                          <button
                            onClick={() => handleUnsendAssessment(item.id)}
                            title="Unsend Assessment"
                            className="flex items-center justify-center p-2 text-slate-600 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all border border-slate-200 hover:border-amber-200"
                          >
                            <RotateCcw size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteAssessment(item.id)}
                            title="Delete Assessment"
                            className="flex items-center justify-center p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all border border-slate-200 hover:border-red-200"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => openMapModal(item)}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-all shadow-sm hover:shadow-md"
                      >
                        <MapIcon size={14} />
                        {hasLocation ? "View Map" : "Set Location"}
                      </button>
                    </div>
                  </div>

                  {item.field_assessment_data && (
                    <details className="text-xs mt-3 border-t border-slate-200 pt-3">
                      <summary className="cursor-pointer text-slate-600 hover:text-slate-900 font-semibold text-xs select-none">
                        📋 View assessment data
                      </summary>
                      <div className="mt-3">
                        <AssessmentDataViewer
                          data={item.field_assessment_data}
                          landClassification={item.land_classification}
                          animalsPresent={item.animals_present}
                        />
                      </div>
                    </details>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ───────── RIGHT PANEL: Verification Form ───────── */}
      <div className="flex-1 bg-white rounded-2xl shadow-sm flex flex-col min-h-0 border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="border-b border-slate-200 px-6 py-5 bg-gradient-to-r from-white via-emerald-50/30 to-white flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <ShieldCheck size={20} className="text-emerald-700" />
              </div>
              Verification Form
            </h1>
            <p className="text-sm text-slate-600 mt-2">
              {siteInfo?.name || `Site #${id}`}
            </p>
          </div>
          {verification && (
            <VerificationStatusBadge status={verification.status} />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-6 py-6 space-y-8">
            {/* Land Classification */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <Layers size={18} className="text-emerald-700" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">
                    Land Classification
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Step 1 of 3 - Required
                  </p>
                </div>
              </div>
              <select
                value={verifiedLandClassificationId}
                onChange={(e) =>
                  setVerifiedLandClassificationId(
                    parseInt(e.target.value) || "",
                  )
                }
                className="w-full border-2 border-slate-300 rounded-lg px-4 py-3 text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all font-medium"
                disabled={landClassifications.length === 0}
              >
                <option value="">-- Select Classification --</option>
                {landClassifications.map((lc) => (
                  <option
                    key={lc.land_classification_id}
                    value={lc.land_classification_id}
                  >
                    {lc.name}{" "}
                    {lc.ownership_type === "public" ? "(Public)" : "(Private)"}
                  </option>
                ))}
              </select>

              {selectedLC && (
                <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                  <Check size={16} className="text-emerald-600 flex-shrink-0" />
                  <span className="text-sm font-medium text-emerald-900">
                    {selectedLC.ownership_type === "public"
                      ? "Public / Government Land"
                      : "Private Land"}
                  </span>
                </div>
              )}
            </div>

            {/* Legal Documents Section */}
            {!verifiedLandClassificationId ? (
              <div className="p-4 bg-slate-50 rounded-xl border-2 border-dashed border-slate-300 flex items-start gap-3">
                <AlertCircle
                  size={20}
                  className="text-slate-600 mt-0.5 flex-shrink-0"
                />
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">
                    Select Land Classification First
                  </h4>
                  <p className="text-xs text-slate-600 mt-1">
                    This determines if legal documents are required for
                    verification.
                  </p>
                </div>
              </div>
            ) : derivedOwnershipType === "private" ? (
              <div className="space-y-4 border-2 border-slate-200 rounded-xl p-5 bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-emerald-100 rounded-lg">
                    <FileText size={18} className="text-emerald-700" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">
                      Legal Documents
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Step 2 of 3 - {permits.length} records
                    </p>
                  </div>
                </div>

                {permits.length > 0 && (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {permits.map((permit) => (
                      <div
                        key={permit.permit_id}
                        className="p-3 bg-white rounded-lg border border-slate-200 hover:border-slate-300 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-slate-900 capitalize">
                              {permit.document_type.replace(/_/g, " ")}
                            </p>
                            {permit.notes && (
                              <p className="text-xs text-slate-600 mt-1.5 italic">
                                "{permit.notes}"
                              </p>
                            )}
                            {permit.verification_notes && (
                              <p className="text-xs text-slate-500 mt-1.5 bg-slate-100 px-2 py-1 rounded">
                                ✓ {permit.verification_notes}
                              </p>
                            )}
                            <p className="text-xs text-slate-500 mt-2">
                              Added{" "}
                              {new Date(
                                permit.uploaded_at,
                              ).toLocaleDateString()}
                            </p>
                          </div>
                          <button
                            onClick={() => handleDeletePermit(permit.permit_id)}
                            className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-3 pt-4 border-t border-slate-300">
                  <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    <Plus size={16} className="text-emerald-600" /> Add Document
                    Record
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 mb-2 block">
                        Document Type *
                      </label>
                      <select
                        value={newPermit.document_type}
                        onChange={(e) =>
                          setNewPermit({
                            ...newPermit,
                            document_type: e.target.value,
                          })
                        }
                        className="w-full border-2 border-slate-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                      >
                        <option value="land_title">Land Title</option>
                        <option value="tax_declaration">Tax Declaration</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700 mb-2 block">
                        Notes / Reference Details *
                      </label>
                      <textarea
                        value={newPermit.notes}
                        onChange={(e) =>
                          setNewPermit({ ...newPermit, notes: e.target.value })
                        }
                        className="w-full border-2 border-slate-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                        placeholder="Ex: TCT No. 12345, Registered under Juan Dela Cruz"
                        rows={2}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700 mb-2 block">
                        Verification Notes (Optional)
                      </label>
                      <input
                        type="text"
                        value={newPermit.verification_notes}
                        onChange={(e) =>
                          setNewPermit({
                            ...newPermit,
                            verification_notes: e.target.value,
                          })
                        }
                        className="w-full border-2 border-slate-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                        placeholder="Ex: Verified against municipal records"
                      />
                    </div>
                    <button
                      onClick={handleAddPermitRecord}
                      disabled={uploadingPermit || !newPermit.notes.trim()}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-4 py-2.5 flex items-center justify-center gap-2 font-semibold text-sm disabled:opacity-40 transition-all shadow-sm hover:shadow-md"
                    >
                      {uploadingPermit ? (
                        <>
                          <Loader2 className="animate-spin" size={16} />{" "}
                          Saving...
                        </>
                      ) : (
                        <>
                          <Plus size={16} /> Add Record
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-emerald-50 rounded-xl border-2 border-emerald-200 flex items-start gap-3">
                <Landmark
                  size={20}
                  className="text-emerald-600 mt-0.5 flex-shrink-0"
                />
                <div>
                  <h4 className="text-sm font-semibold text-emerald-900">
                    No Legal Documents Required
                  </h4>
                  <p className="text-xs text-emerald-700 mt-1">
                    This public land does not require legal document
                    verification.
                  </p>
                </div>
              </div>
            )}

            {/* Security Concerns */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-red-100 rounded-lg">
                  <ShieldAlert size={18} className="text-red-700" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">
                    Security Concerns
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Step 3 of 3 - Multi-select
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  "Armed Threat / Violence",
                  "Hostile Person on Site",
                  "Illegal Activity Observed",
                  "Community Resistance",
                  "Land Conflict",
                  "Other",
                ].map((concern) => (
                  <label
                    key={concern}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border-2 cursor-pointer transition-all font-medium text-sm ${
                      verifiedSecurityConcerns.includes(concern)
                        ? "bg-red-50 border-red-300"
                        : "bg-white border-slate-300 hover:border-slate-400"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={verifiedSecurityConcerns.includes(concern)}
                      onChange={(e) => {
                        if (e.target.checked)
                          setVerifiedSecurityConcerns([
                            ...verifiedSecurityConcerns,
                            concern,
                          ]);
                        else
                          setVerifiedSecurityConcerns(
                            verifiedSecurityConcerns.filter(
                              (c) => c !== concern,
                            ),
                          );
                      }}
                      className="rounded accent-red-600"
                    />
                    <span className="text-sm">{concern}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Accessibility */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Route size={18} className="text-blue-700" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">
                    Accessibility
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {verifiedAccessibility.length} recorded
                  </p>
                </div>
              </div>

              {verifiedAccessibility.length > 0 && (
                <div className="space-y-2 mb-4">
                  {verifiedAccessibility.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-slate-900 capitalize">
                          {entry.type.replace(/_/g, " ")}
                        </p>
                        {entry.description && (
                          <p className="text-xs text-slate-600 mt-1.5">
                            {entry.description}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => removeAccessibilityEntry(entry.id)}
                        className="text-red-500 hover:text-red-700 p-1 hover:bg-white rounded-lg transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="p-4 bg-slate-50 rounded-lg border-2 border-slate-300 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 mb-2 block">
                      Type *
                    </label>
                    <select
                      value={newAccessibility.type}
                      onChange={(e) =>
                        setNewAccessibility({
                          ...newAccessibility,
                          type: e.target.value,
                          description: "",
                        })
                      }
                      className="w-full border-2 border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    >
                      <option value="">-- Select --</option>
                      <option value="vehicle_accessible">
                        Vehicle Accessible
                      </option>
                      <option value="motorcycle_only">Motorcycle Only</option>
                      <option value="footpath_only">Footpath Only</option>
                      <option value="not_accessible">Not Accessible</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 mb-2 block">
                      Description
                    </label>
                    <input
                      type="text"
                      value={newAccessibility.description}
                      onChange={(e) =>
                        setNewAccessibility({
                          ...newAccessibility,
                          description: e.target.value,
                        })
                      }
                      className="w-full border-2 border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                      placeholder="Ex: 2km dirt road, 4x4 required"
                    />
                  </div>
                </div>
                <button
                  onClick={addAccessibilityEntry}
                  disabled={!newAccessibility.type}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-3 py-2.5 flex items-center justify-center gap-2 font-semibold text-sm disabled:opacity-40 transition-all shadow-sm"
                >
                  <Plus size={16} /> Add
                </button>
              </div>
            </div>

            {/* Animals */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <PawPrint size={18} className="text-emerald-700" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">
                    Verified Animals ({verifiedAnimals.length})
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Optional - Document wildlife
                  </p>
                </div>
              </div>

              {verifiedAnimals.length > 0 && (
                <div className="space-y-2 mb-4">
                  {verifiedAnimals.map((animal) => (
                    <div
                      key={animal.animal_id}
                      className="p-3 bg-white rounded-lg border-2 border-emerald-200"
                    >
                      <div className="flex items-start justify-between mb-2.5">
                        <div className="flex-1">
                          <p className="text-sm font-bold text-slate-900">
                            {animal.name}
                          </p>
                          {animal.scientific_name && (
                            <p className="text-xs text-slate-500 italic mt-0.5">
                              {animal.scientific_name}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => removeVerifiedAnimal(animal.animal_id)}
                          className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <X size={16} />
                        </button>
                      </div>
                      <input
                        type="text"
                        value={animal.admin_notes}
                        onChange={(e) =>
                          updateVerifiedAnimalNotes(
                            animal.animal_id,
                            e.target.value,
                          )
                        }
                        placeholder="Admin notes (optional)"
                        className="w-full border-2 border-slate-300 rounded-lg p-2.5 text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className="p-4 bg-slate-50 rounded-lg border-2 border-slate-300 space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-2 block">
                    Select Animal *
                  </label>
                  <select
                    value={newAnimalId}
                    onChange={(e) =>
                      setNewAnimalId(parseInt(e.target.value) || "")
                    }
                    className="w-full border-2 border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                    disabled={animals.length === 0}
                  >
                    <option value="">-- Select Animal --</option>
                    {animals.map((animal) => (
                      <option key={animal.animal_id} value={animal.animal_id}>
                        {animal.name}{" "}
                        {animal.scientific_name
                          ? `(${animal.scientific_name})`
                          : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-2 block">
                    Admin Notes (Optional)
                  </label>
                  <input
                    type="text"
                    value={newAnimalNotes}
                    onChange={(e) => setNewAnimalNotes(e.target.value)}
                    className="w-full border-2 border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                    placeholder="Ex: Commonly spotted near water source"
                  />
                </div>
                <button
                  onClick={addVerifiedAnimal}
                  disabled={!newAnimalId}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-3 py-2.5 flex items-center justify-center gap-2 font-semibold text-sm disabled:opacity-40 transition-all shadow-sm"
                >
                  <Plus size={16} /> Add Animal
                </button>
              </div>
            </div>

            {/* Decision Note */}
            <div className="space-y-3 border-t-2 border-slate-200 pt-6">
              <div className="flex items-start gap-2">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <FileText size={18} className="text-purple-700" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">
                    Decision Note *
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Explain your decision
                  </p>
                </div>
              </div>
              <textarea
                placeholder="Provide detailed explanation for acceptance or rejection..."
                value={decisionNote}
                onChange={(e) => setDecisionNote(e.target.value)}
                className="w-full border-2 border-slate-300 rounded-lg p-3.5 text-sm bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all font-medium"
                rows={4}
                required
              />
            </div>

            {/* Evidence Summary */}
            {referencedAssessmentIds.length > 0 && (
              <div className="p-4 bg-emerald-50 rounded-lg border-2 border-emerald-300">
                <p className="text-xs font-semibold text-emerald-900 mb-3 flex items-center gap-2">
                  <CheckCircle size={14} /> Evidence:{" "}
                  {referencedAssessmentIds.length} assessment
                  {referencedAssessmentIds.length !== 1 ? "s" : ""}
                </p>
                <div className="flex flex-wrap gap-2">
                  {referencedAssessmentIds.map((refId) => {
                    const a = fieldAssessments.find((x) => x.id === refId);
                    return (
                      <span
                        key={refId}
                        className={`text-xs px-3 py-1.5 rounded-lg font-semibold border ${
                          a?.type === "specific"
                            ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                            : "bg-slate-100 text-slate-900 border-slate-300"
                        }`}
                      >
                        #{refId} • {a?.inspector_name || "Unknown"}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="shrink-0 border-t-2 border-slate-200 px-6 py-4 bg-gradient-to-r from-white to-slate-50 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2.5 text-sm text-slate-700 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors font-medium"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={() => saveVerification("draft")}
            className="flex-1 border-2 border-slate-400 text-slate-900 hover:bg-slate-100 rounded-lg p-2.5 flex items-center justify-center gap-2 font-semibold transition-all disabled:opacity-40"
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              <Save size={18} />
            )}
            Save Draft
          </button>
          <div className="flex gap-2.5">
            <button
              onClick={() => saveVerification("rejected")}
              className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-2 font-semibold text-sm disabled:opacity-40 transition-all shadow-sm hover:shadow-md"
              disabled={saving || !decisionNote.trim()}
            >
              <XCircle size={18} /> Reject
            </button>
            <button
              onClick={() => saveVerification("verified")}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-2 font-semibold text-sm disabled:opacity-40 transition-all shadow-sm hover:shadow-md"
              disabled={saving || !decisionNote.trim()}
            >
              <CheckCircle size={18} /> Accept
            </button>
          </div>
        </div>
      </div>

      {/* Map Modal */}
      {isMapModalOpen && selectedAssessment && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b-2 border-slate-200 bg-gradient-to-r from-white to-slate-50">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-3">
                  <MapIcon size={22} className="text-emerald-600" /> Assessment
                  Location
                </h3>
                <p className="text-xs text-slate-600 mt-2">
                  {selectedAssessment.inspector_name} •{" "}
                  {selectedAssessment.assessment_date
                    ? new Date(
                        selectedAssessment.assessment_date,
                      ).toLocaleDateString()
                    : "No date"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!isEditMode && (
                  <button
                    onClick={() => setIsEditMode(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition-all shadow-sm"
                  >
                    <Edit3 size={16} /> Edit Location
                  </button>
                )}
                <button
                  onClick={closeMapModal}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X size={22} className="text-slate-600" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 flex overflow-hidden">
              <div className="flex-1 relative">
                <MapContainer
                  center={mapMarkerPosition || [11.02, 124.61]}
                  zoom={mapMarkerPosition ? 16 : 12}
                  className="h-full w-full"
                  style={{ minHeight: "100%" }}
                >
                  <TileLayer
                    url={`https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`}
                    tileSize={512}
                    zoomOffset={-1}
                    attribution='&copy; <a href="https://www.mapbox.com/">Mapbox</a>'
                  />
                  <MapClickHandler
                    isPickingLocation={isPickingLocation}
                    onLocationPick={handleLocationPick}
                  />
                  {mapMarkerPosition && (
                    <Marker
                      position={mapMarkerPosition}
                      icon={isEditMode ? redIcon : greenIcon}
                    >
                      <Popup>
                        <div className="text-sm">
                          <strong>Assessment Location</strong>
                          <div className="text-xs text-slate-600 mt-2">
                            Lat: {mapMarkerPosition[0].toFixed(6)}
                            <br />
                            Lng: {mapMarkerPosition[1].toFixed(6)}
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  )}
                </MapContainer>
                {isPickingLocation && (
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 text-sm font-semibold z-[1000]">
                    <Navigation size={16} className="animate-pulse" /> Click on
                    map to set location
                  </div>
                )}
              </div>

              {isEditMode && (
                <div className="w-72 border-l-2 border-slate-200 bg-slate-50 p-5 overflow-y-auto">
                  <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <MapPin size={18} className="text-emerald-600" /> Set
                    Location
                  </h4>

                  <div className="space-y-4 mb-5">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 mb-2 block">
                        Latitude *
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={manualLat}
                        onChange={(e) => setManualLat(e.target.value)}
                        className="w-full border-2 border-slate-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all font-medium"
                        placeholder="e.g., 11.047541"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700 mb-2 block">
                        Longitude *
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={manualLng}
                        onChange={(e) => setManualLng(e.target.value)}
                        className="w-full border-2 border-slate-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all font-medium"
                        placeholder="e.g., 124.632806"
                      />
                    </div>
                    <button
                      onClick={handleManualCoordinateSubmit}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-3 py-2.5 text-sm font-semibold transition-all shadow-sm"
                    >
                      Apply Coordinates
                    </button>
                  </div>

                  <div className="border-t-2 border-slate-300 pt-4 mb-5">
                    <p className="text-xs text-slate-600 mb-3 font-medium">
                      Or click on map:
                    </p>
                    <button
                      onClick={startPickingLocation}
                      disabled={isPickingLocation}
                      className="w-full bg-slate-800 hover:bg-slate-900 text-white rounded-lg px-3 py-2.5 text-sm font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-40"
                    >
                      <Navigation size={16} />
                      {isPickingLocation ? "Picking..." : "Pick from Map"}
                    </button>
                  </div>

                  {mapMarkerPosition && (
                    <div className="p-3 bg-emerald-50 rounded-lg border-2 border-emerald-300 mb-4">
                      <p className="text-xs font-semibold text-emerald-900 mb-1.5">
                        Current Location:
                      </p>
                      <p className="text-xs text-emerald-800 font-mono">
                        {mapMarkerPosition[0].toFixed(6)},{" "}
                        {mapMarkerPosition[1].toFixed(6)}
                      </p>
                    </div>
                  )}

                  <div className="space-y-2.5">
                    <button
                      onClick={saveLocation}
                      disabled={savingLocation || !mapMarkerPosition}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-3 py-2.5 text-sm font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-40 shadow-sm"
                    >
                      {savingLocation ? (
                        <>
                          <Loader2 className="animate-spin" size={16} />{" "}
                          Saving...
                        </>
                      ) : (
                        <>
                          <CheckCircle size={16} /> Save Location
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setIsEditMode(false);
                        setIsPickingLocation(false);
                        if (
                          selectedAssessment.location &&
                          selectedAssessment.location.latitude &&
                          selectedAssessment.location.longitude
                        ) {
                          setMapMarkerPosition([
                            Number(selectedAssessment.location.latitude),
                            Number(selectedAssessment.location.longitude),
                          ]);
                          setManualLat(
                            selectedAssessment.location.latitude.toString(),
                          );
                          setManualLng(
                            selectedAssessment.location.longitude.toString(),
                          );
                        }
                      }}
                      className="w-full border-2 border-slate-400 text-slate-900 hover:bg-slate-100 rounded-lg px-3 py-2.5 text-sm font-semibold transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t-2 border-slate-200 p-4 bg-slate-50">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                    Verified Location
                  </span>
                  <span className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    Editing Location
                  </span>
                </div>
                <span className="font-medium">
                  Press ESC or click X to close
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
