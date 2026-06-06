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
  MapPin,
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
} from "lucide-react";
import PlantScopeAlert from "@/components/alert/PlantScopeAlert";
import PlantScopeConfirm from "@/components/alert/PlantScopeConfirm";

const API = "http://127.0.0.1:8000/api";
const API_IMAGE = "http://127.0.0.1:8000/";

// ─────────────────────────────────────────────
// Type Definitions (UPDATED to match actual API + image linking)
// ─────────────────────────────────────────────
interface AreaData {
  reforestation_area_id: number;
  name: string;
  barangay: { barangay_id: number; name: string } | null;
  land_classification: { land_classification_id: number; name: string } | null;
  description: string;
  permit_count: number;
  area_img: string | null;
  created_at: string;
  verification_status: "pending" | "draft" | "verified" | "rejected";
  verification_decision_note: string | null;
}

// ✅ UPDATED: Extended to support image metadata from merged API response
interface LegalDocument {
  note?: string;
  photo_url?: string | null;
  status?: "uploaded" | "missing";
  // ✅ Added for image linking from assessment.images array
  document_type?: string;
  label?: string;
  image_id?: number;
  image_description?: string;
  image_coords?: { lat: number; lng: number } | null;
}

interface FieldAssessment {
  field_assessment_id: number;
  inspector_id: number;
  inspector_name: string;
  inspector_email: string;
  inspector_profile_img: string | null;
  assessment_date: string;
  location: any;
  field_assessment_data: {
    meta_data?: {
      legal_documents?: {
        land_title?: LegalDocument;
        tax_declaration?: LegalDocument;
        other_documents?: Array<{ note: string; photo_url?: string | null }>;
        land_classification?: {
          type: string;
          inspector_notes?: string;
        };
      };
      security_concerns?: {
        selected: string[];
        note?: string;
      };
      accessibility?: {
        vehicle_access?: string;
        notes?: string;
        type?: string;
        route_description?: string;
      };
    };
    accessibility?: string;
    security_concerns?: string[];
    land_classification_type?: string;
    land_classification_note?: string;
  };
  is_submitted: boolean;
  image_count: number;
  images: Array<{
    image_id: number;
    url: string;
    layer: string;
    latitude: number | null;
    longitude: number | null;
    description: string;
    created_at: string;
  }>;
  created_at: string;
  submitted_at: string;
}

interface VerificationRecord {
  id: number;
  status: "pending" | "draft" | "verified" | "rejected";
  verified_security_concerns: string[] | null;
  verified_accessibility: Array<{ type: string; description?: string }> | null;
  verified_land_classification_id: number | null;
  verified_land_classification_name: string | null;
  decision_note: string | null;
  referenced_assessment_ids: number[] | null;
  verified_by: string | null;
  verified_at: string | null;
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
  description?: string;
}

interface AccessibilityEntry {
  id: string;
  type: string;
  description: string;
}

// ────────────────────────────────────────────
// Helper Components
// ─────────────────────────────────────────────
function CollapsibleText({
  text,
  maxLength = 100,
}: {
  text: string;
  maxLength?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!text) return null;
  const isLong = text.length > maxLength;
  const displayText =
    !expanded && isLong ? text.slice(0, maxLength) + "..." : text;
  return (
    <div className="mt-1">
      <p
        className={`text-sm text-gray-600 break-words whitespace-pre-wrap ${!expanded && isLong ? "line-clamp-3" : ""}`}
      >
        {displayText}
      </p>
      {isLong && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-green-700 font-semibold hover:underline mt-1"
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ${status ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}
    >
      {status ? "SUBMITTED" : "DRAFT"}
    </span>
  );
}

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
  const {
    bg,
    text,
    border,
    icon: Icon,
    label,
  } = config[status] || config["pending"];
  return (
    <span
      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${bg} ${text} ${border}`}
    >
      <Icon size={12} /> {label}
    </span>
  );
}

// ✅ UPDATED: DocumentCard with proper URL handling
function DocumentCard({ doc, label }: { doc: LegalDocument; label: string }) {
  // Check if we have a photo URL (from either JSON or merged image)
  const hasPhoto = doc.photo_url && doc.photo_url !== "null";
  
  // ✅ FIX: Check if URL is already absolute (starts with http)
  const imageUrl = doc.photo_url 
    ? (doc.photo_url.startsWith('http') 
        ? doc.photo_url  // Already absolute
        : `${API_IMAGE}${doc.photo_url}`  // Needs base URL prepended
      )
    : null;
  
  // Check if we have image preview data (merged from assessment.images)
  const hasImagePreview = doc.image_id && imageUrl;

  return (
    <div className="p-3 rounded-lg border bg-green-50 border-green-200">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <CheckCircle size={16} className="text-green-600" />
          <span className="font-bold text-xs text-green-800">{label}</span>
        </div>
        {/* Show image ID badge if we have merged image data */}
        {doc.image_id && (
          <span className="text-[10px] text-gray-500 bg-white px-2 py-0.5 rounded">
            IMG #{doc.image_id}
          </span>
        )}
      </div>

      {/* ✅ Image Preview Section - Shows when image is merged from assessment.images */}
      {hasImagePreview && imageUrl && (
        <div className="mb-2">
          <a
            href={imageUrl}
            target="_blank"
            rel="noreferrer"
            className="block rounded-lg overflow-hidden border border-green-200 hover:border-green-400 transition"
          >
            <img 
              src={imageUrl} 
              alt={doc.image_description || label}
              className="w-full h-24 object-cover"
              onError={(e) => {
                console.error('Image failed to load:', imageUrl);
                // Hide broken images gracefully
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </a>
          {/* Show image description if available */}
          {doc.image_description && (
            <p className="text-[10px] text-gray-500 mt-1 italic">
              "{doc.image_description}"
            </p>
          )}
          {/* Show GPS coordinates if available */}
          {doc.image_coords && (
            <p className="text-[9px] text-gray-400">
              📍 {doc.image_coords.lat.toFixed(4)}, {doc.image_coords.lng.toFixed(4)}
            </p>
          )}
        </div>
      )}

      {/* Fallback: Show "View Document" link if we have photo_url but no preview data */}
      {hasPhoto && !hasImagePreview && imageUrl && (
        <a
          href={imageUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 text-xs text-blue-600 hover:underline mb-2"
        >
          <ImageIcon size={14} /> View Document
        </a>
      )}

      {/* Inspector Note */}
      {doc.note && (
        <div className="bg-white p-2 rounded border border-gray-100">
          <p className="text-[10px] uppercase font-semibold text-gray-400 mb-1">
            Inspector Note:
          </p>
          <p className="text-xs text-gray-600">{doc.note}</p>
        </div>
      )}
    </div>
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
    land_dispute: {
      label: "Land Dispute",
      color: "bg-yellow-100 text-yellow-700 border-yellow-200",
      icon: AlertCircle,
    },
    other: {
      label: "Other",
      color: "bg-gray-100 text-gray-700 border-gray-200",
      icon: AlertCircle,
    },
  };
  const config = map[concern] || {
    label: concern,
    color: "bg-gray-100 text-gray-700",
    icon: AlertCircle,
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold border ${config.color}`}
    >
      <config.icon size={10} /> {config.label}
    </span>
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

  const [areaData, setAreaData] = useState<AreaData | null>(null);
  const [verification, setVerification] = useState<VerificationRecord | null>(
    null,
  );

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

  const [fieldAssessments, setFieldAssessments] = useState<FieldAssessment[]>(
    [],
  );
  const [permits, setPermits] = useState<PermitItem[]>([]);
  const [landClassifications, setLandClassifications] = useState<
    LandClassificationOption[]
  >([]);

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

  // ─────────────────────────────────────────────
  // API Calls
  // ─────────────────────────────────────────────
  async function fetchAreaVerification() {
    if (!id || !token) return;
    try {
      // 1. Fetch field assessments with meta-data images
      const assessmentsRes = await fetch(`${API}/area/${id}/meta-data/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (assessmentsRes.ok) {
        const assessmentsData = await assessmentsRes.json();
        setFieldAssessments(assessmentsData || []);
      }

      // 2. Fetch saved verification record
      const verificationRes = await fetch(
        `${API}/reforestation-areas/${id}/verification/`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (verificationRes.ok) {
        const verificationData = await verificationRes.json();

        setVerifiedSecurityConcerns(
          verificationData.verified_security_concerns || [],
        );

        const backendAcc = verificationData.verified_accessibility;
        if (Array.isArray(backendAcc)) {
          setVerifiedAccessibility(
            backendAcc.map((a: any, i: number) => ({
              id: `acc-${i}`,
              type: a.type,
              description: a.description || "",
            })),
          );
        } else if (backendAcc && typeof backendAcc === "object") {
          setVerifiedAccessibility([
            {
              id: "acc-0",
              type: backendAcc.type,
              description: backendAcc.description || "",
            },
          ]);
        } else {
          setVerifiedAccessibility([]);
        }

        setVerifiedLandClassificationId(
          verificationData.verified_land_classification_id || "",
        );
        setDecisionNote(verificationData.decision_note || "");
        setReferencedAssessmentIds(
          verificationData.referenced_assessment_ids || [],
        );
      }

      // 3. Fetch area info
      try {
        const areaRes = await fetch(`${API}/get_reforestation_area/${id}/`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (areaRes.ok) {
          const areaData = await areaRes.json();
          setAreaData({
            ...areaData.data,
            verification_status: verificationRes.ok
              ? (await verificationRes.clone().json()).status
              : "pending",
            verification_decision_note: null,
          });
        }
      } catch (err) {
        console.warn("Could not fetch area data:", err);
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
      const res = await fetch(`${API}/permits/${id}/list/`, {
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
      const res = await fetch(
        `${API}/get_land_classifications_list/?for_reforestation=true`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const data = await res.json();
      if (res.ok && data.data) setLandClassifications(data.data);
    } catch (err) {
      console.error(err);
    }
  }

  async function saveVerification(status: "draft" | "verified" | "rejected") {
    if (!id || !token) return;
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
      };

      const res = await fetch(
        `${API}/update_reforestation-areas/${id}/verification/`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        },
      );

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
        fetchAreaVerification();
      } else {
        setPSAlert({
          type: "error",
          title: "Error",
          message: data.error || "Failed to save verification.",
        });
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

      const res = await fetch(`${API}/permits/${id}/upload/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();

      if (res.ok) {
        setPSAlert({
          type: "success",
          title: "Uploaded",
          message: "Permit verified & saved.",
        });
        setNewPermit({
          document_type: "land_title",
          permit_number: "",
          verification_notes: "",
          file: null,
        });
        fetchPermits();
      } else {
        setPSAlert({
          type: "error",
          title: "Failed",
          message: data.error || "Upload failed.",
        });
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
          const res = await fetch(`${API}/permits/${permitId}/delete/`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            setPSAlert({
              type: "success",
              title: "Deleted",
              message: "Permit deleted.",
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

  function handleUnsentAssessment(assessmentId: number) {
    setConfirmDialog({
      title: "Mark as Unsent",
      message: "Mark this assessment as unsent?",
      variant: "warning",
      confirmLabel: "Unsent",
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          const res = await fetch(
            `${API}/field_assessments/${assessmentId}/unsent/`,
            { method: "POST", headers: { Authorization: `Bearer ${token}` } },
          );
          if (res.ok) {
            setPSAlert({
              type: "success",
              title: "Unsent",
              message: "Assessment marked as unsent.",
            });
            fetchAreaVerification();
          } else {
            setPSAlert({
              type: "error",
              title: "Failed",
              message: "Could not unsent.",
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

  function handleDeleteAssessment(assessmentId: number) {
    setConfirmDialog({
      title: "Delete Assessment",
      message: "Delete this assessment?",
      variant: "danger",
      confirmLabel: "Delete",
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          const res = await fetch(
            `${API}/field_assessments/${assessmentId}/head_delete/`,
            { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
          );
          if (res.ok) {
            setPSAlert({
              type: "success",
              title: "Deleted",
              message: "Assessment deleted.",
            });
            fetchAreaVerification();
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

  // ✅ UPDATED: Extract legal documents AND attach matching images from assessment.images
  function getLegalDocuments(assessment: FieldAssessment): LegalDocument[] {
    const metaData = assessment.field_assessment_data.meta_data;
    if (!metaData?.legal_documents) return [];

    const docs: LegalDocument[] = [];
    const legalDocs = metaData.legal_documents;
    
    // ✅ Build a Map of images by layer code for O(1) lookup
    const imagesByLayer = new Map(
      assessment.images.map(img => [img.layer, img])
    );

    // ── Land Title ─────────────────────────────────────
    if (legalDocs.land_title) {
      const landTitleImg = imagesByLayer.get('meta_land_title');
      docs.push({
        ...legalDocs.land_title,
        document_type: "land_title",
        label: "Land Title",
        // ✅ Prioritize image URL from assessment.images over JSON photo_url
        photo_url: landTitleImg?.url || legalDocs.land_title.photo_url,
        image_id: landTitleImg?.image_id,
        image_description: landTitleImg?.description,
        image_coords: landTitleImg?.latitude && landTitleImg?.longitude 
          ? { lat: landTitleImg.latitude, lng: landTitleImg.longitude } 
          : null,
      });
    }
    
    // ── Tax Declaration ─────────────────────────────────
    if (legalDocs.tax_declaration) {
      const taxDeclImg = imagesByLayer.get('meta_tax_decl');
      docs.push({
        ...legalDocs.tax_declaration,
        document_type: "tax_declaration",
        label: "Tax Declaration",
        photo_url: taxDeclImg?.url || legalDocs.tax_declaration.photo_url,
        image_id: taxDeclImg?.image_id,
        image_description: taxDeclImg?.description,
        image_coords: taxDeclImg?.latitude && taxDeclImg?.longitude 
          ? { lat: taxDeclImg.latitude, lng: taxDeclImg.longitude } 
          : null,
      });
    }
    
    // ── Other Documents (array) ─────────────────────────
    if (legalDocs.other_documents?.length) {
      legalDocs.other_documents.forEach((doc, idx) => {
        // For other docs, use the first meta_other_doc image
        // (If you have multiple other docs, enhance this logic to match by index or ID)
        const otherImg = assessment.images.find(img => img.layer === 'meta_other_doc');
        docs.push({
          ...doc,
          document_type: "other",
          label: `Other Document ${idx + 1}`,
          photo_url: otherImg?.url || doc.photo_url,
          image_id: otherImg?.image_id,
          image_description: otherImg?.description,
          image_coords: otherImg?.latitude && otherImg?.longitude 
            ? { lat: otherImg.latitude, lng: otherImg.longitude } 
            : null,
        });
      });
    }
    // ✅ EDGE CASE: If other_documents is empty but we have a meta_other_doc image, show it anyway
    else if (imagesByLayer.has('meta_other_doc')) {
      const otherImg = imagesByLayer.get('meta_other_doc');
      if (otherImg) {
        docs.push({
          document_type: "other",
          label: "Other Document",
          photo_url: otherImg.url,
          image_id: otherImg.image_id,
          image_description: otherImg.description,
          image_coords: otherImg.latitude && otherImg.longitude 
            ? { lat: otherImg.latitude, lng: otherImg.longitude } 
            : null,
          note: "", // Empty note since no JSON data
        });
      }
    }

    return docs;
  }

  // ✅ Helper to extract land classification
  function getLandClassification(assessment: FieldAssessment) {
    const metaData = assessment.field_assessment_data.meta_data;
    return metaData?.legal_documents?.land_classification || null;
  }

  // ✅ Helper to extract security concerns
  function getSecurityConcerns(assessment: FieldAssessment) {
    const metaData = assessment.field_assessment_data.meta_data;
    return metaData?.security_concerns || null;
  }

  // ✅ Helper to extract accessibility
  function getAccessibility(assessment: FieldAssessment) {
    const metaData = assessment.field_assessment_data.meta_data;
    return metaData?.accessibility || null;
  }

  useEffect(() => {
    if (id && token) {
      setLoading(true);
      Promise.all([
        fetchAreaVerification(),
        fetchPermits(),
        fetchLandClassifications(),
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
          <p className="text-sm text-gray-500 truncate mt-1">
            {areaData?.name || `Area #${id}`}
          </p>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
          {fieldAssessments.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">
              <ClipboardCheck className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No field assessments found.</p>
            </div>
          ) : (
            fieldAssessments.map((item) => {
              const isSelected = referencedAssessmentIds.includes(
                item.field_assessment_id,
              );
              const legalDocs = getLegalDocuments(item);
              const landClass = getLandClassification(item);
              const security = getSecurityConcerns(item);
              const accessibility = getAccessibility(item);

              return (
                <div
                  key={item.field_assessment_id}
                  className={`bg-white rounded-xl p-4 border shadow-sm transition-all ${isSelected ? "border-green-400 ring-2 ring-green-100" : "border-gray-200 hover:border-green-300"}`}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold text-sm">
                      {item.inspector_name.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-gray-800">
                        {item.inspector_name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(item.assessment_date).toLocaleDateString()}
                      </p>
                    </div>
                    <StatusBadge status={item.is_submitted} />
                  </div>

                  <label className="flex items-center gap-2 mb-3 p-2 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() =>
                        toggleAssessmentReference(item.field_assessment_id)
                      }
                      className="rounded text-green-600 focus:ring-green-500"
                    />
                    <span className="text-xs font-medium text-gray-700">
                      Use as evidence
                    </span>
                  </label>

                  {/* Legal Documents */}
                  <div className="mb-4">
                    <h3 className="text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-1">
                      <FileText size={12} /> Legal Documents
                    </h3>
                    <div className="grid gap-2">
                      {legalDocs.map((doc, idx) => (
                        <DocumentCard 
                          key={`${doc.document_type}-${idx}`} 
                          doc={doc} 
                          label={doc.label || doc.document_type || "Document"} 
                        />
                      ))}
                      {!legalDocs.length && (
                        <p className="text-xs text-gray-400 italic">
                          No documents recorded.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Land Classification */}
                  {landClass && (
                    <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                      <h3 className="text-xs font-bold text-purple-800 mb-1 flex items-center gap-1">
                        <Layers size={12} /> Land Classification
                      </h3>
                      <p className="text-sm font-semibold text-purple-900 mb-1 capitalize">
                        {landClass.type}
                      </p>
                      {landClass.inspector_notes && (
                        <p className="text-xs text-purple-700 bg-white/50 p-2 rounded">
                          {landClass.inspector_notes}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Security Concerns */}
                  {security?.selected?.length > 0 && (
                    <div className="mb-4">
                      <h3 className="text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-1">
                        <ShieldAlert size={12} /> Security Concerns
                      </h3>
                      <div className="flex flex-wrap gap-1 mb-1">
                        {security.selected.map((concern, idx) => (
                          <SecurityBadge key={idx} concern={concern} />
                        ))}
                      </div>
                      {security.note && (
                        <CollapsibleText text={security.note} maxLength={50} />
                      )}
                    </div>
                  )}

                  {/* Accessibility */}
                  {accessibility && (
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <h3 className="text-xs font-bold text-blue-800 mb-1 flex items-center gap-1">
                        <Route size={12} /> Accessibility
                      </h3>
                      <p className="text-sm font-semibold text-blue-900 capitalize mb-1">
                        {accessibility.vehicle_access ||
                          accessibility.type ||
                          "N/A"}
                      </p>
                      {accessibility.notes && (
                        <div className="bg-white p-2 rounded border border-blue-100">
                          <p className="text-[10px] uppercase text-gray-400 font-bold">
                            Notes:
                          </p>
                          <p className="text-xs text-gray-700">
                            {accessibility.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="mt-3 pt-3 border-t flex gap-2">
                    <button
                      onClick={() =>
                        handleUnsentAssessment(item.field_assessment_id)
                      }
                      className="flex-1 flex items-center justify-center gap-1 text-xs font-semibold text-yellow-700 bg-yellow-50 hover:bg-yellow-100 border border-yellow-200 rounded-lg py-1.5 transition-colors"
                    >
                      <RotateCcw size={12} /> Unsent
                    </button>
                    <button
                      onClick={() =>
                        handleDeleteAssessment(item.field_assessment_id)
                      }
                      className="flex-1 flex items-center justify-center gap-1 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg py-1.5 transition-colors"
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ───────── RIGHT PANEL: Verification Form ───────── */}
      <div className="flex-1 bg-white rounded-2xl shadow p-8 flex flex-col gap-6 min-h-0 border border-gray-200 overflow-y-auto">
        <div>
          <h2 className="text-2xl font-bold text-green-700">
            Meta Data Verification
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Review submissions and finalize verification.
          </p>
        </div>

        {/* Legal Documents Upload */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <FileText size={18} className="text-green-600" /> Legal Documents
            </h3>
            <span className="text-xs text-gray-500">
              {permits.length} uploaded
            </span>
          </div>
          {permits.length > 0 && (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {permits.map((permit) => (
                <div
                  key={permit.permit_id}
                  className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-800 capitalize">
                        {permit.document_type.replace(/_/g, " ")}
                      </p>
                      {permit.permit_number && (
                        <p className="text-xs text-gray-500">
                          No. {permit.permit_number}
                        </p>
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
                <label className="text-xs font-semibold text-gray-600 mb-1 block">
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
                  className="w-full border rounded-lg p-2 text-sm bg-white"
                >
                  <option value="land_title">Land Title</option>
                  <option value="tax_declaration">Tax Declaration</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">
                  Upload File *
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) =>
                    setNewPermit({
                      ...newPermit,
                      file: e.target.files?.[0] || null,
                    })
                  }
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
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer ${verifiedSecurityConcerns.includes(concern) ? "bg-orange-100 border-orange-400" : "bg-white"}`}
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
                        <p className="text-xs text-gray-600 mt-1">
                          {entry.description}
                        </p>
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
                  <label className="text-[10px] font-semibold text-gray-600 mb-1 block">
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
                    className="w-full border rounded-lg p-2 text-sm bg-white"
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
                  <label className="text-[10px] font-semibold text-gray-600 mb-1 block">
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
                    className="w-full border rounded-lg p-2 text-sm bg-white"
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
              onChange={(e) =>
                setVerifiedLandClassificationId(parseInt(e.target.value) || "")
              }
              className="w-full border rounded-lg p-3 text-sm bg-white"
              disabled={landClassifications.length === 0}
            >
              <option value="">-- Select --</option>
              {landClassifications.map((lc) => (
                <option
                  key={lc.land_classification_id}
                  value={lc.land_classification_id}
                >
                  {lc.name}
                </option>
              ))}
            </select>
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
                Referenced: {referencedAssessmentIds.length}
              </p>
              <div className="flex flex-wrap gap-2">
                {referencedAssessmentIds.map((id) => {
                  const a = fieldAssessments.find(
                    (x) => x.field_assessment_id === id,
                  );
                  return (
                    <span
                      key={id}
                      className="text-[10px] px-2 py-1 bg-green-100 text-green-700 rounded-full"
                    >
                      #{id}
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
            {saving ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              <Save size={18} />
            )}{" "}
            Save Draft
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
              disabled={
                saving || !decisionNote.trim() || !verifiedLandClassificationId
              }
            >
              <CheckCircle size={18} /> Accept
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}