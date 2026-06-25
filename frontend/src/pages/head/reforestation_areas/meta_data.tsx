import { useEffect, useState, useRef } from "react";
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
  Upload,
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
} from "lucide-react";
import PlantScopeAlert from "@/components/alert/PlantScopeAlert";
import PlantScopeConfirm from "@/components/alert/PlantScopeConfirm";
import { api } from "@/constant/api.ts";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// 📍 Mapbox Token
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

const API = api + "api/";
const API_IMAGE = api;

// Fix Leaflet default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Custom colored icons
const greenIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const blueIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const redIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
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
  // ✅ NEW: FK fields from backend
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
  // ✅ NEW
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
  permit_number: string | null;
  file_url: string;
  verification_notes: string | null;
  uploaded_at: string;
  uploaded_by: string | null;
}

interface LandClassificationOption {
  land_classification_id: number;
  name: string;
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
  const { bg, text, border, icon: Icon, label } = config[status] || config["pending"];
  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${bg} ${text} ${border}`}>
      <Icon size={12} /> {label}
    </span>
  );
}

function AssessmentTypeBadge({ type }: { type: "specific" | "general" }) {
  if (type === "specific") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700 border border-green-200">
        <Target size={10} /> Specific
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">
      <Building2 size={10} /> General
    </span>
  );
}

function SecurityBadge({ concern }: { concern: string }) {
  const map: Record<string, { label: string; color: string; icon: any }> = {
    "Armed Threat / Violence": { label: "Armed Threat", color: "bg-red-100 text-red-700 border-red-200", icon: AlertTriangle },
    "Hostile Person on Site": { label: "Hostile Person", color: "bg-red-100 text-red-700 border-red-200", icon: AlertTriangle },
    "Illegal Activity Observed": { label: "Illegal Activity", color: "bg-orange-100 text-orange-700 border-orange-200", icon: AlertTriangle },
    "Community Resistance": { label: "Community Resistance", color: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: Users },
    "Land Conflict": { label: "Land Conflict", color: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: AlertCircle },
    other: { label: "Other", color: "bg-gray-100 text-gray-700 border-gray-200", icon: AlertCircle },
  };
  const config = map[concern] || { label: concern, color: "bg-gray-100 text-gray-700", icon: AlertCircle };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold border ${config.color}`}>
      <config.icon size={10} /> {config.label}
    </span>
  );
}

// ✅ NEW: Animal Badge Component
function AnimalBadge({ animal }: { animal: AnimalInfo }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
      <PawPrint size={10} /> {animal.name}
    </span>
  );
}

// ✅ UPDATED: Component to render field assessment data nicely
function AssessmentDataViewer({ data, landClassification, animalsPresent }: { 
  data: any; 
  landClassification?: { id: number; name: string } | null;
  animalsPresent?: AnimalInfo[];
}) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    accessibility: true,
    legal_documents: true,
    security_concerns: true,
    land_classification: true,
    animals: true,
  });

  if (!data || !data.meta_data) {
    return <p className="text-xs text-gray-400 italic">No meta data available</p>;
  }

  const metaData = data.meta_data;

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <div className="space-y-3">
      {/* ✅ NEW: Land Classification (FK) Section */}
      {landClassification && (
        <div className="border border-purple-200 rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection("land_classification")}
            className="w-full flex items-center justify-between px-3 py-2 bg-purple-50 hover:bg-purple-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Layers size={14} className="text-purple-600" />
              <span className="text-xs font-bold text-purple-800">Land Classification</span>
            </div>
            {expandedSections.land_classification ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          {expandedSections.land_classification && (
            <div className="p-3 bg-white">
              <div className="flex items-center gap-2">
                <CheckCircle size={12} className="text-purple-600" />
                <p className="text-xs font-bold text-purple-800">{landClassification.name}</p>
              </div>
              {metaData.legal_documents?.land_classification?.inspector_notes && (
                <p className="text-xs text-purple-600 mt-2 italic">
                  "{metaData.legal_documents.land_classification.inspector_notes}"
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ✅ NEW: Animals Present Section */}
      {animalsPresent && animalsPresent.length > 0 && (
        <div className="border border-emerald-200 rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection("animals")}
            className="w-full flex items-center justify-between px-3 py-2 bg-emerald-50 hover:bg-emerald-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <PawPrint size={14} className="text-emerald-600" />
              <span className="text-xs font-bold text-emerald-800">
                Animals Observed ({animalsPresent.length})
              </span>
            </div>
            {expandedSections.animals ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          {expandedSections.animals && (
            <div className="p-3 bg-white">
              <div className="flex flex-wrap gap-1">
                {animalsPresent.map((animal) => (
                  <div key={animal.animal_id} className="p-2 bg-emerald-50 rounded border border-emerald-200">
                    <p className="text-xs font-bold text-emerald-800">{animal.name}</p>
                    {animal.scientific_name && (
                      <p className="text-[10px] text-emerald-600 italic">{animal.scientific_name}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ✅ Accessibility Section */}
      {metaData.accessibility && (
        <div className="border border-blue-200 rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection("accessibility")}
            className="w-full flex items-center justify-between px-3 py-2 bg-blue-50 hover:bg-blue-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Car size={14} className="text-blue-600" />
              <span className="text-xs font-bold text-blue-800">Accessibility</span>
            </div>
            {expandedSections.accessibility ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          {expandedSections.accessibility && (
            <div className="p-3 bg-white space-y-2">
              {metaData.accessibility.vehicle_access && (
                <div>
                  <p className="text-[10px] uppercase font-semibold text-gray-400">Vehicle Access</p>
                  {/* ✅ UPDATED: Handle both array (new) and string (old) formats */}
                  {Array.isArray(metaData.accessibility.vehicle_access) ? (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {metaData.accessibility.vehicle_access.map((access: string, idx: number) => (
                        <span key={idx} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-semibold">
                          {access}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-700">{metaData.accessibility.vehicle_access}</p>
                  )}
                </div>
              )}
              {metaData.accessibility.notes && (
                <div>
                  <p className="text-[10px] uppercase font-semibold text-gray-400">Notes</p>
                  <p className="text-xs text-gray-700">{metaData.accessibility.notes}</p>
                </div>
              )}
              {metaData.accessibility.route_description && (
                <div>
                  <p className="text-[10px] uppercase font-semibold text-gray-400">Route Description</p>
                  <p className="text-xs text-gray-700">{metaData.accessibility.route_description}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ✅ Legal Documents Section */}
      {metaData.legal_documents && (
        <div className="border border-green-200 rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection("legal_documents")}
            className="w-full flex items-center justify-between px-3 py-2 bg-green-50 hover:bg-green-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <FileText size={14} className="text-green-600" />
              <span className="text-xs font-bold text-green-800">Legal Documents</span>
            </div>
            {expandedSections.legal_documents ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          {expandedSections.legal_documents && (
            <div className="p-3 bg-white space-y-3">
              {metaData.legal_documents.land_title && (
                <div className="p-2 bg-gray-50 rounded border border-gray-200">
                  <div className="flex items-center gap-1 mb-1">
                    <CheckCircle size={12} className="text-green-600" />
                    <p className="text-xs font-bold text-gray-800">Land Title</p>
                  </div>
                  {metaData.legal_documents.land_title.note && (
                    <p className="text-xs text-gray-600">{metaData.legal_documents.land_title.note}</p>
                  )}
                </div>
              )}

              {metaData.legal_documents.tax_declaration && (
                <div className="p-2 bg-gray-50 rounded border border-gray-200">
                  <div className="flex items-center gap-1 mb-1">
                    <CheckCircle size={12} className="text-green-600" />
                    <p className="text-xs font-bold text-gray-800">Tax Declaration</p>
                  </div>
                  {metaData.legal_documents.tax_declaration.note && (
                    <p className="text-xs text-gray-600">{metaData.legal_documents.tax_declaration.note}</p>
                  )}
                </div>
              )}

              {metaData.legal_documents.other_documents && Array.isArray(metaData.legal_documents.other_documents) && (
                <div>
                  <p className="text-[10px] uppercase font-semibold text-gray-400 mb-2">Other Documents</p>
                  {metaData.legal_documents.other_documents.map((doc: any, idx: number) => (
                    <div key={idx} className="p-2 bg-gray-50 rounded border border-gray-200 mb-2">
                      {doc.note && <p className="text-xs text-gray-600">{doc.note}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ✅ Security Concerns Section */}
      {metaData.security_concerns && (
        <div className="border border-orange-200 rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection("security_concerns")}
            className="w-full flex items-center justify-between px-3 py-2 bg-orange-50 hover:bg-orange-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <ShieldAlert size={14} className="text-orange-600" />
              <span className="text-xs font-bold text-orange-800">Security Concerns</span>
            </div>
            {expandedSections.security_concerns ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          {expandedSections.security_concerns && (
            <div className="p-3 bg-white space-y-2">
              {metaData.security_concerns.selected &&
                Array.isArray(metaData.security_concerns.selected) &&
                metaData.security_concerns.selected.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase font-semibold text-gray-400 mb-2">Selected Concerns</p>
                    <div className="flex flex-wrap gap-1">
                      {metaData.security_concerns.selected.map((concern: string, idx: number) => (
                        <SecurityBadge key={idx} concern={concern} />
                      ))}
                    </div>
                  </div>
                )}
              {metaData.security_concerns.note && (
                <div>
                  <p className="text-[10px] uppercase font-semibold text-gray-400">Additional Notes</p>
                  <p className="text-xs text-gray-700">{metaData.security_concerns.note}</p>
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [siteInfo, setSiteInfo] = useState<SiteInfo | null>(null);
  const [verification, setVerification] = useState<VerificationRecord | null>(null);
  const [assessmentCounts, setAssessmentCounts] = useState<AssessmentCounts>({
    total: 0,
    specific: 0,
    general: 0,
  });

  const [verifiedSecurityConcerns, setVerifiedSecurityConcerns] = useState<string[]>([]);
  const [verifiedAccessibility, setVerifiedAccessibility] = useState<AccessibilityEntry[]>([]);
  const [verifiedLandClassificationId, setVerifiedLandClassificationId] = useState<number | "">("");
  const [decisionNote, setDecisionNote] = useState("");
  const [referencedAssessmentIds, setReferencedAssessmentIds] = useState<number[]>([]);
  
  // ✅ NEW: Verified Animals State
  const [verifiedAnimals, setVerifiedAnimals] = useState<VerifiedAnimal[]>([]);

  const [fieldAssessments, setFieldAssessments] = useState<FieldAssessment[]>([]);
  const [assessmentFilter, setAssessmentFilter] = useState<AssessmentFilter>("all");
  const [permits, setPermits] = useState<PermitItem[]>([]);
  const [landClassifications, setLandClassifications] = useState<LandClassificationOption[]>([]);
  
  // ✅ NEW: Master Animals List
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
    permit_number: "",
    verification_notes: "",
    file: null as File | null,
  });
  const [newAccessibility, setNewAccessibility] = useState<AccessibilityEntry>({
    id: "",
    type: "",
    description: "",
  });
  
  // ✅ NEW: New Animal Entry State
  const [newAnimalId, setNewAnimalId] = useState<number | "">("");
  const [newAnimalNotes, setNewAnimalNotes] = useState("");

  // Map Modal States
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [selectedAssessment, setSelectedAssessment] = useState<FieldAssessment | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isPickingLocation, setIsPickingLocation] = useState(false);
  const [manualLat, setManualLat] = useState<string>("");
  const [manualLng, setManualLng] = useState<string>("");
  const [mapMarkerPosition, setMapMarkerPosition] = useState<[number, number] | null>(null);
  const [savingLocation, setSavingLocation] = useState(false);

  const filteredAssessments = fieldAssessments.filter((a) => {
    if (assessmentFilter === "all") return true;
    return a.type === assessmentFilter;
  });

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
        setAssessmentCounts(verificationData.assessment_counts || { total: 0, specific: 0, general: 0 });
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
        } else if (backendAcc && typeof backendAcc === "object" && Object.keys(backendAcc).length > 0) {
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

        setVerifiedLandClassificationId(ver.verified_land_classification_id || "");
        setDecisionNote(ver.decision_note || "");
        setReferencedAssessmentIds(ver.referenced_assessment_ids || []);
        setFieldAssessments(verificationData.field_assessments || []);
        
        // ✅ NEW: Load verified animals
        setVerifiedAnimals(ver.verified_animals || []);
      } else {
        setPSAlert({
          type: "error",
          title: "Error",
          message: "Failed to load verification data.",
        });
      }
    } catch (err) {
      console.error("Failed to fetch verification:", err);
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
      const res = await fetch(`${API}get_land_classifications_list/?for_reforestation=true`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.data) setLandClassifications(data.data);
    } catch (err) {
      console.error(err);
    }
  }

  // ✅ NEW: Fetch Animals List
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
      setPSAlert({ type: "failed", title: "Validation Error", message: "Decision note is required." });
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
        verified_accessibility: verifiedAccessibility.map(({ type, description }) => ({ type, description })),
        verified_land_classification_id: verifiedLandClassificationId || null,
        decision_note: decisionNote,
        referenced_assessment_ids: referencedAssessmentIds,
        status: status,
        // ✅ NEW: Include verified animals
        verified_animals: verifiedAnimals.map((a) => ({
          animal_id: a.animal_id,
          notes: a.admin_notes || "",
        })),
      };

      const res = await fetch(`${API}site/${id}/verification/update/`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        const action = status === "draft" ? "saved as draft" : status === "verified" ? "approved" : "rejected";
        setPSAlert({ type: "success", title: "Success", message: `Verification ${action}.` });
        await fetchSiteVerification();
      } else {
        setPSAlert({ type: "error", title: "Error", message: data.error || "Failed to save verification." });
      }
    } catch (err) {
      setPSAlert({ type: "error", title: "Error", message: "Network error." });
    } finally {
      setSaving(false);
    }
  }

  async function handleUploadPermit() {
    if (!newPermit.file || !id || !token) return;
    setUploadingPermit(true);
    try {
      const formData = new FormData();
      formData.append("document_type", newPermit.document_type);
      formData.append("permit_number", newPermit.permit_number);
      formData.append("verification_notes", newPermit.verification_notes);
      formData.append("file", newPermit.file);

      const res = await fetch(`${API}site/${id}/permits/upload/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();

      if (res.ok) {
        setPSAlert({ type: "success", title: "Uploaded", message: "Permit verified & saved." });
        setNewPermit({ document_type: "land_title", permit_number: "", verification_notes: "", file: null });
        fetchPermits();
      } else {
        setPSAlert({ type: "error", title: "Failed", message: data.error || "Upload failed." });
      }
    } catch (err) {
      setPSAlert({ type: "error", title: "Error", message: "Upload failed." });
    } finally {
      setUploadingPermit(false);
    }
  }

  async function handleDeletePermit(permitId: number) {
    setConfirmDialog({
      title: "Delete Permit",
      message: "Delete this permit document?",
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
            setPSAlert({ type: "success", title: "Deleted", message: "Permit deleted." });
            fetchPermits();
          } else {
            setPSAlert({ type: "error", title: "Failed", message: "Could not delete." });
          }
        } catch {
          setPSAlert({ type: "error", title: "Error", message: "Network error." });
        }
      },
    });
  }

  function toggleAssessmentReference(assessmentId: number) {
    setReferencedAssessmentIds((prev) =>
      prev.includes(assessmentId) ? prev.filter((id) => id !== assessmentId) : [...prev, assessmentId],
    );
  }

  function addAccessibilityEntry() {
    if (!newAccessibility.type) {
      setPSAlert({ type: "failed", title: "Required", message: "Please select an access type." });
      return;
    }
    if (newAccessibility.type === "other" && !newAccessibility.description.trim()) {
      setPSAlert({ type: "failed", title: "Required", message: "Please describe access for 'Other' type." });
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

  // ✅ NEW: Add Verified Animal
  function addVerifiedAnimal() {
    if (!newAnimalId) {
      setPSAlert({ type: "failed", title: "Required", message: "Please select an animal." });
      return;
    }
    
    // Check if already added
    if (verifiedAnimals.some((a) => a.animal_id === newAnimalId)) {
      setPSAlert({ type: "failed", title: "Duplicate", message: "This animal is already in the verified list." });
      return;
    }
    
    const animal = animals.find((a) => a.animal_id === newAnimalId);
    if (!animal) return;
    
    const verifiedAnimal: VerifiedAnimal = {
      animal_id: animal.animal_id,
      name: animal.name,
      scientific_name: animal.scientific_name,
      admin_notes: newAnimalNotes,
    };
    
    setVerifiedAnimals((prev) => [...prev, verifiedAnimal]);
    setNewAnimalId("");
    setNewAnimalNotes("");
  }

  // ✅ NEW: Remove Verified Animal
  function removeVerifiedAnimal(animalId: number) {
    setVerifiedAnimals((prev) => prev.filter((a) => a.animal_id !== animalId));
  }

  // ✅ NEW: Update Verified Animal Notes
  function updateVerifiedAnimalNotes(animalId: number, notes: string) {
    setVerifiedAnimals((prev) =>
      prev.map((a) => (a.animal_id === animalId ? { ...a, admin_notes: notes } : a))
    );
  }

  // Map Modal Functions
  function openMapModal(assessment: FieldAssessment) {
    setSelectedAssessment(assessment);
    setIsMapModalOpen(true);
    setIsEditMode(false);
    setIsPickingLocation(false);

    if (assessment.location && assessment.location.latitude && assessment.location.longitude) {
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

    if (isNaN(lat) || isNaN(lng)) {
      setPSAlert({
        type: "failed",
        title: "Invalid Coordinates",
        message: "Please enter valid latitude and longitude values.",
      });
      return;
    }

    if (lat < -90 || lat > 90) {
      setPSAlert({
        type: "failed",
        title: "Invalid Latitude",
        message: "Latitude must be between -90 and 90.",
      });
      return;
    }

    if (lng < -180 || lng > 180) {
      setPSAlert({
        type: "failed",
        title: "Invalid Longitude",
        message: "Longitude must be between -180 and 180.",
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

    if (isNaN(lat) || isNaN(lng)) {
      setPSAlert({
        type: "failed",
        title: "Invalid Location",
        message: "Please set a valid location first.",
      });
      return;
    }

    setSavingLocation(true);
    try {
      const payload = {
        field_assessment_id: selectedAssessment.id,
        coordinate: {
          latitude: lat,
          longitude: lng,
          gps_accuracy_meters: selectedAssessment.location?.gps_accuracy_meters || 20,
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
          message: data.message || "Assessment location has been updated successfully.",
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
    } catch (err) {
      console.error("Failed to save location:", err);
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
        fetchAnimals(),  // ✅ NEW
      ]).finally(() => setLoading(false));
    }
  }, [id, token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <Loader2 className="animate-spin h-10 w-10 text-green-700" />
      </div>
    );
  }

  return (
    <div className="flex w-full h-screen bg-gray-100 p-6 gap-6 overflow-hidden">
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
      <div className="w-112.5 bg-white rounded-2xl shadow flex flex-col min-h-0 border border-gray-200">
        <div className="border-b p-5 bg-gray-50 rounded-t-2xl">
          <h2 className="text-xl font-bold text-green-700 flex items-center gap-2">
            <ClipboardCheck size={20} /> Inspector Submissions
          </h2>
          <p className="text-sm text-gray-500 truncate mt-1">{siteInfo?.name || `Site #${id}`}</p>
          {siteInfo?.reforestation_area_name && (
            <p className="text-xs text-gray-400 mt-0.5">Area: {siteInfo.reforestation_area_name}</p>
          )}

          <div className="mt-3 flex gap-1 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setAssessmentFilter("all")}
              className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                assessmentFilter === "all"
                  ? "bg-white text-green-700 shadow-sm"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              <Filter size={12} />
              All ({assessmentCounts.total})
            </button>
            <button
              onClick={() => setAssessmentFilter("specific")}
              className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                assessmentFilter === "specific"
                  ? "bg-white text-green-700 shadow-sm"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              <Target size={12} />
              Specific ({assessmentCounts.specific})
            </button>
            <button
              onClick={() => setAssessmentFilter("general")}
              className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                assessmentFilter === "general"
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              <Building2 size={12} />
              General ({assessmentCounts.general})
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
          {filteredAssessments.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">
              <ClipboardCheck className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>
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
              const hasLocation = item.location && item.location.latitude && item.location.longitude;

              return (
                <div
                  key={item.id}
                  className={`bg-white rounded-xl p-4 border shadow-sm transition-all ${
                    isSelected ? "border-green-400 ring-2 ring-green-100" : "border-gray-200 hover:border-green-300"
                  }`}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold text-sm overflow-hidden">
                      {item.inspector_profile_img ? (
                        <img
                          src={
                            item.inspector_profile_img.startsWith("http")
                              ? item.inspector_profile_img
                              : `${API_IMAGE}${item.inspector_profile_img}`
                          }
                          alt={item.inspector_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        item.inspector_name.charAt(0)
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-800 truncate">{item.inspector_name}</p>
                      <p className="text-xs text-gray-400">
                        {item.assessment_date
                          ? new Date(item.assessment_date).toLocaleDateString()
                          : "No date"}
                      </p>
                    </div>
                    <AssessmentTypeBadge type={item.type} />
                  </div>

                  {/* ✅ NEW: Show Land Classification & Animals Reported */}
                  {(item.land_classification || (item.animals_present && item.animals_present.length > 0)) && (
                    <div className="mb-3 p-2 bg-gray-50 rounded-lg border border-gray-200 space-y-2">
                      {item.land_classification && (
                        <div className="flex items-center gap-1">
                          <Layers size={10} className="text-purple-600" />
                          <span className="text-[10px] font-semibold text-purple-700">
                            {item.land_classification.name}
                          </span>
                        </div>
                      )}
                      {item.animals_present && item.animals_present.length > 0 && (
                        <div>
                          <div className="flex items-center gap-1 mb-1">
                            <PawPrint size={10} className="text-emerald-600" />
                            <span className="text-[10px] font-semibold text-emerald-700">
                              Animals ({item.animals_present.length})
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {item.animals_present.slice(0, 3).map((animal) => (
                              <AnimalBadge key={animal.animal_id} animal={animal} />
                            ))}
                            {item.animals_present.length > 3 && (
                              <span className="text-[9px] text-gray-500 self-center">
                                +{item.animals_present.length - 3} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <label className="flex items-center gap-2 mb-3 p-2 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleAssessmentReference(item.id)}
                      className="rounded text-green-600 focus:ring-green-500"
                    />
                    <span className="text-xs font-medium text-gray-700">Use as evidence</span>
                  </label>

                  {item.images && item.images.length > 0 && (
                    <div className="mb-3">
                      <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">
                        Attachments ({item.images.length})
                      </p>
                      <div className="grid grid-cols-3 gap-1">
                        {item.images.slice(0, 6).map((img) => (
                          <a
                            key={img.image_id}
                            href={
                              img.url
                                ? img.url.startsWith("http")
                                  ? img.url
                                  : `${API_IMAGE}${img.url}`
                                : "#"
                            }
                            target="_blank"
                            rel="noreferrer"
                            className="block aspect-square rounded overflow-hidden border border-gray-200 hover:border-green-400 transition"
                            title={img.description || img.layer}
                          >
                            {img.url ? (
                              <img
                                src={
                                  img.url.startsWith("http") ? img.url : `${API_IMAGE}${img.url}`
                                }
                                alt={img.description || img.layer}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = "none";
                                }}
                              />
                            ) : (
                              <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                                <ImageIcon size={12} className="text-gray-400" />
                              </div>
                            )}
                          </a>
                        ))}
                        {item.images.length > 6 && (
                          <div className="aspect-square rounded bg-gray-100 flex items-center justify-center text-xs text-gray-500 font-bold">
                            +{item.images.length - 6}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="mb-2 flex items-center justify-between gap-2">
                    {hasLocation ? (
                      <div className="flex items-center gap-1 text-[10px] text-gray-500 flex-1">
                        <MapPin size={10} />
                        <span>
                          {Number(item.location.latitude).toFixed(5)},{" "}
                          {Number(item.location.longitude).toFixed(5)}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-[10px] text-orange-500 flex-1">
                        <AlertCircle size={10} />
                        <span>No location recorded</span>
                      </div>
                    )}
                    <button
                      onClick={() => openMapModal(item)}
                      className="flex items-center gap-1 px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-[10px] font-semibold transition-colors border border-blue-200"
                    >
                      <MapIcon size={10} />
                      {hasLocation ? "View Map" : "Set Location"}
                    </button>
                  </div>

                  {item.field_assessment_data && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-gray-500 hover:text-gray-700 font-medium mb-2">
                        View assessment data
                      </summary>
                      <AssessmentDataViewer 
                        data={item.field_assessment_data} 
                        landClassification={item.land_classification}
                        animalsPresent={item.animals_present}
                      />
                    </details>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ───────── RIGHT PANEL: Verification Form ───────── */}
      <div className="flex-1 bg-white rounded-2xl shadow p-8 flex flex-col gap-6 min-h-0 border border-gray-200 overflow-y-auto">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-green-700">Meta Data Verification</h2>
            <p className="text-sm text-gray-500 mt-1">{siteInfo?.name || `Site #${id}`}</p>
          </div>
          {verification && <VerificationStatusBadge status={verification.status} />}
        </div>

        {/* Legal Documents Upload */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <FileText size={18} className="text-green-600" /> Legal Documents
            </h3>
            <span className="text-xs text-gray-500">{permits.length} uploaded</span>
          </div>
          {permits.length > 0 && (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {permits.map((permit) => (
                <div key={permit.permit_id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-800 capitalize">
                        {permit.document_type.replace(/_/g, " ")}
                      </p>
                      {permit.permit_number && (
                        <p className="text-xs text-gray-500">No. {permit.permit_number}</p>
                      )}
                      {permit.file_url && (
                        <a
                          href={`${API_IMAGE}${permit.file_url}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1"
                        >
                          <ImageIcon size={12} /> View
                        </a>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeletePermit(permit.permit_id)}
                      className="text-red-500 hover:text-red-700 p-1"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <h4 className="text-sm font-bold text-green-800 mb-3 flex items-center gap-2">
              <Upload size={14} /> Upload Document
            </h4>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Document Type *</label>
                <select
                  value={newPermit.document_type}
                  onChange={(e) => setNewPermit({ ...newPermit, document_type: e.target.value })}
                  className="w-full border rounded-lg p-2 text-sm bg-white"
                >
                  <option value="land_title">Land Title</option>
                  <option value="tax_declaration">Tax Declaration</option>
                  <option value="barangay_clearance">Barangay Clearance</option>
                  <option value="lgu_endorsement">LGU Endorsement</option>
                  <option value="denr_permit">DENR Permit</option>
                  <option value="landowner_consent">Landowner Consent</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">
                  Permit Number (Optional)
                </label>
                <input
                  type="text"
                  value={newPermit.permit_number}
                  onChange={(e) => setNewPermit({ ...newPermit, permit_number: e.target.value })}
                  className="w-full border rounded-lg p-2 text-sm bg-white"
                  placeholder="Ex: LT-2024-001"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Upload File *</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setNewPermit({ ...newPermit, file: e.target.files?.[0] || null })}
                  className="w-full text-sm"
                />
              </div>
              <button
                onClick={handleUploadPermit}
                disabled={uploadingPermit || !newPermit.file}
                className="w-full bg-green-700 text-white rounded-lg p-2 flex items-center justify-center gap-2 hover:bg-green-800 font-semibold text-sm disabled:opacity-50"
              >
                {uploadingPermit ? (
                  <>
                    <Loader2 className="animate-spin" size={16} /> Uploading...
                  </>
                ) : (
                  <>
                    <Upload size={16} /> Upload
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Verification Form */}
        <div className="space-y-6">
          {/* Security */}
          <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
            <h3 className="font-bold text-orange-800 flex items-center gap-2 mb-3">
              <ShieldAlert size={16} /> Verified Security Concerns
            </h3>
            <div className="flex flex-wrap gap-2">
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
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer ${
                    verifiedSecurityConcerns.includes(concern)
                      ? "bg-orange-100 border-orange-400"
                      : "bg-white"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={verifiedSecurityConcerns.includes(concern)}
                    onChange={(e) => {
                      if (e.target.checked)
                        setVerifiedSecurityConcerns([...verifiedSecurityConcerns, concern]);
                      else
                        setVerifiedSecurityConcerns(
                          verifiedSecurityConcerns.filter((c) => c !== concern),
                        );
                    }}
                    className="rounded text-orange-600"
                  />
                  <span className="text-sm">{concern}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Accessibility */}
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h3 className="font-bold text-blue-800 flex items-center gap-2 mb-3">
              <Route size={16} /> Verified Accessibility
            </h3>
            {verifiedAccessibility.length > 0 && (
              <div className="space-y-2 mb-4">
                {verifiedAccessibility.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-start gap-2 p-3 bg-white rounded-lg border border-blue-100"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-semibold capitalize">
                        {entry.type.replace(/_/g, " ")}
                      </p>
                      {entry.description && (
                        <p className="text-xs text-gray-600 mt-1">{entry.description}</p>
                      )}
                    </div>
                    <button
                      onClick={() => removeAccessibilityEntry(entry.id)}
                      className="text-red-500 p-1"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="p-3 bg-blue-100/50 rounded-lg border border-blue-200">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-gray-600 mb-1 block">Type *</label>
                  <select
                    value={newAccessibility.type}
                    onChange={(e) =>
                      setNewAccessibility({ ...newAccessibility, type: e.target.value, description: "" })
                    }
                    className="w-full border rounded-lg p-2 text-sm bg-white"
                  >
                    <option value="">-- Select --</option>
                    <option value="vehicle_accessible">Vehicle Accessible</option>
                    <option value="motorcycle_only">Motorcycle Only</option>
                    <option value="footpath_only">Footpath Only</option>
                    <option value="not_accessible">Not Accessible</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-gray-600 mb-1 block">
                    Description
                  </label>
                  <input
                    type="text"
                    value={newAccessibility.description}
                    onChange={(e) =>
                      setNewAccessibility({ ...newAccessibility, description: e.target.value })
                    }
                    className="w-full border rounded-lg p-2 text-sm bg-white"
                    placeholder="Ex: 2km dirt road, 4x4 required"
                  />
                </div>
              </div>
              <button
                onClick={addAccessibilityEntry}
                disabled={!newAccessibility.type}
                className="mt-3 w-full bg-blue-600 text-white rounded-lg p-2 flex items-center justify-center gap-2 hover:bg-blue-700 font-semibold text-sm disabled:opacity-50"
              >
                <Plus size={14} /> Add
              </button>
            </div>
          </div>

          {/* Land Classification */}
          <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
            <h3 className="font-bold text-purple-800 flex items-center gap-2 mb-3">
              <Layers size={16} /> Verified Land Classification
            </h3>
            <select
              value={verifiedLandClassificationId}
              onChange={(e) => setVerifiedLandClassificationId(parseInt(e.target.value) || "")}
              className="w-full border rounded-lg p-3 text-sm bg-white"
              disabled={landClassifications.length === 0}
            >
              <option value="">-- Select --</option>
              {landClassifications.map((lc) => (
                <option key={lc.land_classification_id} value={lc.land_classification_id}>
                  {lc.name}
                </option>
              ))}
            </select>
          </div>

          {/* ✅ NEW: Verified Animals */}
          <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
            <h3 className="font-bold text-emerald-800 flex items-center gap-2 mb-3">
              <PawPrint size={16} /> Verified Animals ({verifiedAnimals.length})
            </h3>
            
            {verifiedAnimals.length > 0 && (
              <div className="space-y-2 mb-4">
                {verifiedAnimals.map((animal) => (
                  <div
                    key={animal.animal_id}
                    className="p-3 bg-white rounded-lg border border-emerald-100"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className="text-sm font-bold text-emerald-800">{animal.name}</p>
                        {animal.scientific_name && (
                          <p className="text-[10px] text-emerald-600 italic">{animal.scientific_name}</p>
                        )}
                      </div>
                      <button
                        onClick={() => removeVerifiedAnimal(animal.animal_id)}
                        className="text-red-500 p-1 hover:bg-red-50 rounded"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <input
                      type="text"
                      value={animal.admin_notes}
                      onChange={(e) => updateVerifiedAnimalNotes(animal.animal_id, e.target.value)}
                      placeholder="Admin notes (optional)"
                      className="w-full border border-emerald-200 rounded p-2 text-xs bg-emerald-50/50"
                    />
                  </div>
                ))}
              </div>
            )}
            
            <div className="p-3 bg-emerald-100/50 rounded-lg border border-emerald-200">
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-semibold text-gray-600 mb-1 block">Select Animal *</label>
                  <select
                    value={newAnimalId}
                    onChange={(e) => setNewAnimalId(parseInt(e.target.value) || "")}
                    className="w-full border rounded-lg p-2 text-sm bg-white"
                    disabled={animals.length === 0}
                  >
                    <option value="">-- Select Animal --</option>
                    {animals.map((animal) => (
                      <option key={animal.animal_id} value={animal.animal_id}>
                        {animal.name} {animal.scientific_name ? `(${animal.scientific_name})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-gray-600 mb-1 block">
                    Admin Notes (Optional)
                  </label>
                  <input
                    type="text"
                    value={newAnimalNotes}
                    onChange={(e) => setNewAnimalNotes(e.target.value)}
                    className="w-full border rounded-lg p-2 text-sm bg-white"
                    placeholder="Ex: Commonly spotted near water source"
                  />
                </div>
                <button
                  onClick={addVerifiedAnimal}
                  disabled={!newAnimalId}
                  className="w-full bg-emerald-600 text-white rounded-lg p-2 flex items-center justify-center gap-2 hover:bg-emerald-700 font-semibold text-sm disabled:opacity-50"
                >
                  <Plus size={14} /> Add Animal
                </button>
              </div>
            </div>
          </div>

          {/* Decision Note */}
          <div>
            <label className="text-sm font-bold text-gray-700 flex items-center gap-2 mb-2">
              <FileText size={18} className="text-green-600" /> Decision Note *
            </label>
            <textarea
              placeholder="Explain reason for acceptance or rejection..."
              value={decisionNote}
              onChange={(e) => setDecisionNote(e.target.value)}
              className="w-full border rounded-lg p-3 text-sm"
              rows={3}
              required
            />
          </div>

          {/* Evidence Summary */}
          {referencedAssessmentIds.length > 0 && (
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-xs font-semibold text-gray-600 mb-2">
                Referenced Assessments: {referencedAssessmentIds.length}
              </p>
              <div className="flex flex-wrap gap-2">
                {referencedAssessmentIds.map((refId) => {
                  const a = fieldAssessments.find((x) => x.id === refId);
                  return (
                    <span
                      key={refId}
                      className={`text-[10px] px-2 py-1 rounded-full border ${
                        a?.type === "specific"
                          ? "bg-green-100 text-green-700 border-green-200"
                          : "bg-blue-100 text-blue-700 border-blue-200"
                      }`}
                    >
                      #{refId} - {a?.inspector_name || "Unknown"} ({a?.type || "unknown"})
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-auto pt-6 border-t flex gap-4">
          <button
            onClick={() => navigate(-1)}
            className="flex-1 border border-gray-300 rounded-lg p-3 flex items-center justify-center gap-2 hover:bg-gray-50"
            disabled={saving}
          >
            <X size={18} /> Cancel
          </button>
          <button
            onClick={() => saveVerification("draft")}
            className="flex-1 border border-blue-600 text-blue-700 rounded-lg p-3 flex items-center justify-center gap-2 hover:bg-blue-50 font-semibold"
            disabled={saving}
          >
            {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} Save Draft
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => saveVerification("rejected")}
              className="px-6 py-3 bg-red-600 text-white rounded-lg flex items-center gap-2 hover:bg-red-700 font-bold shadow-md disabled:opacity-50"
              disabled={saving || !decisionNote.trim()}
            >
              <XCircle size={18} /> Reject
            </button>
            <button
              onClick={() => saveVerification("verified")}
              className="px-6 py-3 bg-green-700 text-white rounded-lg flex items-center gap-2 hover:bg-green-800 font-bold shadow-md disabled:opacity-50"
              disabled={saving || !decisionNote.trim() || !verifiedLandClassificationId}
            >
              <CheckCircle size={18} /> Accept
            </button>
          </div>
        </div>
      </div>

      {/* Map Modal */}
      {isMapModalOpen && selectedAssessment && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b bg-gradient-to-r from-green-50 to-blue-50">
              <div>
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <MapIcon size={20} className="text-green-700" />
                  Assessment Location
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  {selectedAssessment.inspector_name} •{" "}
                  {selectedAssessment.assessment_date
                    ? new Date(selectedAssessment.assessment_date).toLocaleDateString()
                    : "No date"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!isEditMode && (
                  <button
                    onClick={() => setIsEditMode(true)}
                    className="flex items-center gap-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors"
                  >
                    <Edit3 size={14} />
                    Edit Location
                  </button>
                )}
                <button
                  onClick={closeMapModal}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X size={20} className="text-gray-600" />
                </button>
              </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
              <div className="flex-1 relative">
                <MapContainer
                  center={mapMarkerPosition || [11.02, 124.61]}
                  zoom={mapMarkerPosition ? 16 : 12}
                  className="h-full w-full"
                  style={{ minHeight: "100%" }}
                >
                  {/* ✅ NEW: Mapbox Satellite Hybrid */}
                  <TileLayer
                    url={`https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`}
                    tileSize={512}
                    zoomOffset={-1}
                    attribution='&copy; <a href="https://www.mapbox.com/">Mapbox</a> &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
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
                          <div className="text-xs text-gray-600 mt-1">
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
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-orange-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm font-semibold z-[1000]">
                    <Navigation size={16} className="animate-pulse" />
                    Click on map to set location
                  </div>
                )}
              </div>

              {isEditMode && (
                <div className="w-80 border-l bg-gray-50 p-4 overflow-y-auto">
                  <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <MapPin size={16} className="text-green-700" />
                    Set Location
                  </h4>

                  <div className="space-y-3 mb-4">
                    <div>
                      <label className="text-xs font-semibold text-gray-600 mb-1 block">
                        Latitude *
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={manualLat}
                        onChange={(e) => setManualLat(e.target.value)}
                        className="w-full border rounded-lg p-2 text-sm bg-white"
                        placeholder="e.g., 11.047541"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 mb-1 block">
                        Longitude *
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={manualLng}
                        onChange={(e) => setManualLng(e.target.value)}
                        className="w-full border rounded-lg p-2 text-sm bg-white"
                        placeholder="e.g., 124.632806"
                      />
                    </div>
                    <button
                      onClick={handleManualCoordinateSubmit}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg p-2 text-sm font-semibold transition-colors"
                    >
                      Apply Coordinates
                    </button>
                  </div>

                  <div className="border-t border-gray-200 pt-4 mb-4">
                    <p className="text-xs text-gray-500 mb-3">Or click on map:</p>
                    <button
                      onClick={startPickingLocation}
                      disabled={isPickingLocation}
                      className="w-full bg-green-600 hover:bg-green-700 text-white rounded-lg p-2 text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <Navigation size={14} />
                      {isPickingLocation ? "Picking..." : "Pick from Map"}
                    </button>
                  </div>

                  {mapMarkerPosition && (
                    <div className="p-3 bg-green-50 rounded-lg border border-green-200 mb-4">
                      <p className="text-xs font-semibold text-green-800 mb-1">Current Location:</p>
                      <p className="text-xs text-green-700 font-mono">
                        {mapMarkerPosition[0].toFixed(6)}, {mapMarkerPosition[1].toFixed(6)}
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <button
                      onClick={saveLocation}
                      disabled={savingLocation || !mapMarkerPosition}
                      className="w-full bg-green-700 hover:bg-green-800 text-white rounded-lg p-3 text-sm font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {savingLocation ? (
                        <>
                          <Loader2 className="animate-spin" size={16} />
                          Saving...
                        </>
                      ) : (
                        <>
                          <CheckCircle size={16} />
                          Save Location
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
                          const lat = Number(selectedAssessment.location.latitude);
                          const lng = Number(selectedAssessment.location.longitude);
                          setMapMarkerPosition([lat, lng]);
                          setManualLat(lat.toString());
                          setManualLng(lng.toString());
                        }
                      }}
                      className="w-full border border-gray-300 rounded-lg p-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t p-4 bg-gray-50">
              <div className="flex items-center justify-between text-xs text-gray-600">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    Existing Location
                  </span>
                  <span className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    New/Edited Location
                  </span>
                </div>
                <span>Press ESC or click X to close</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}