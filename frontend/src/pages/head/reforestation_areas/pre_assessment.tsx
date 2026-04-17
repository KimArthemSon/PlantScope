import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ShieldCheck,
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
  Layers, // ✅ For Land Classification
  ThermometerSun, // ✅ For Safety Level
} from "lucide-react";
import PlantScopeAlert from "@/components/alert/PlantScopeAlert";

const API = "http://127.0.0.1:8000/api";
const API_IMAGE = "http://127.0.0.1:8000/";
const CURRENT_USER_ID = 1; // Replace with actual auth context

// ─────────────────────────────────────────────
// Type Definitions
// ─────────────────────────────────────────────
interface AreaData {
  reforestation_area_id: number;
  name: string;
  barangay: { barangay_id: number; name: string } | null;
  legality: "pending" | "legal" | "illegal";
  pre_assessment_status: "pending" | "approved" | "rejected"; // Keep for backward compat
  safety: "safe" | "slightly" | "moderate" | "danger";
  description: string;
  reforestation_data: Record<string, any> | null;
  permit_count: number;
  area_img: string | null;
  created_at: string;
  // ✅ NEW: Land classification field
  land_classification: { land_classification_id: number; name: string } | null;
}

interface AssessmentImage {
  image_id: number;
  url: string | null;
  caption: string;
  layer: string;
  created_at: string;
}

interface AssessmentItem {
  field_assessment_id: number;
  inspector_id: number;
  inspector_name: string;
  inspector_email: string;
  inspector_profile_img: string | null;
  assessment_date: string | null;
  location: {
    latitude: number;
    longitude: number;
    gps_accuracy_meters?: number;
  } | null;
  field_assessment_data: {
    assessment_type: string;
    assessment_date: string;
    permits_available: string[];
    permit_numbers: Record<string, string>;
    security_concerns: string[];
    security_notes: string;
    general_safety_assessment:
      | "safe"
      | "slightly_unsafe"
      | "moderate_risk"
      | "high_risk";
    accessibility:
      | "vehicle_accessible"
      | "motorcycle_only"
      | "footpath_only"
      | "not_accessible";
    community_support: "strong_support" | "neutral" | "opposition" | "unknown";
    land_use_conflicts: string[];
    conflict_notes: string;
    attached_documents: Array<{
      document_type: string;
      file_url: string;
      uploaded_at: string;
    }>;
    pre_assessment_recommendation:
      | "proceed_to_mcda"
      | "requires_clarification"
      | "reject";
    additional_notes: string;
  };
  is_submitted: boolean;
  image_count: number;
  images: AssessmentImage[];
  created_at: string;
  submitted_at: string;
}

interface PermitItem {
  permit_id: number;
  document_type:
    | "barangay_clearance"
    | "lgu_endorsement"
    | "denr_permit"
    | "landowner_consent"
    | "other";
  permit_number: string | null;
  file_url: string;
  verification_notes: string | null;
  uploaded_at: string;
  uploaded_by: string | null;
}

// ✅ NEW: Land Classification interface
interface LandClassificationOption {
  land_classification_id: number;
  name: string;
  description?: string;
}

// ─────────────────────────────────────────────
// Helper Components
// ─────────────────────────────────────────────
function CollapsibleText({
  text,
  maxLength = 150,
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

function StatusBadge({ status }: { status: "SUBMITTED" | "DRAFT" }) {
  return (
    <span
      className={`px-2 py-1 rounded text-xs font-bold ${
        status === "SUBMITTED"
          ? "bg-green-100 text-green-700"
          : "bg-yellow-100 text-yellow-700"
      }`}
    >
      {status}
    </span>
  );
}

function RecommendationBadge({ recommendation }: { recommendation: string }) {
  const config: Record<string, { bg: string; text: string; icon: any }> = {
    proceed_to_mcda: {
      bg: "bg-green-100",
      text: "text-green-700",
      icon: CheckCircle,
    },
    reject: { bg: "bg-red-100", text: "text-red-700", icon: XCircle },
    requires_clarification: {
      bg: "bg-yellow-100",
      text: "text-yellow-700",
      icon: AlertCircle,
    },
  };
  const {
    bg,
    text,
    icon: Icon,
  } = config[recommendation] || config["requires_clarification"];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ${bg} ${text}`}
    >
      <Icon size={12} />
      {recommendation.replace("_", " ").toUpperCase()}
    </span>
  );
}

// ✅ Image Gallery Component
function ImageGallery({ images }: { images: AssessmentImage[] }) {
  if (!images || images.length === 0) return null;
  const validImages = images.filter((img) => img.url);
  if (validImages.length === 0) return null;

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
        <ImageIcon size={12} /> Field Photos ({validImages.length})
      </p>
      <div className="grid grid-cols-3 gap-2">
        {validImages.map((img) => (
          <div key={img.image_id} className="relative group">
            <img
              src={`${API_IMAGE}${img.url}`}
              alt={img.caption || "Field photo"}
              className="w-full h-20 object-cover rounded-lg border border-gray-200 hover:border-green-500 transition-colors cursor-pointer"
              onClick={() => window.open(`${API_IMAGE}${img.url}`, "_blank")}
            />
            {img.caption && (
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] p-1 rounded-b-lg truncate">
                {img.caption}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Component: Meta Data Verification
// ─────────────────────────────────────────────
export default function MetaDataVerification() {
  const { id } = useParams<{ id: string }>();
  const token = localStorage.getItem("token");
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State
  const [areaData, setAreaData] = useState<AreaData | null>(null);
  const [metaDataStatus, setMetaDataStatus] =
    useState<AreaData["pre_assessment_status"]>("pending");
  const [legality, setLegality] = useState<AreaData["legality"]>("pending");

  // ✅ NEW: Safety level & Land Classification state
  const [safetyLevel, setSafetyLevel] = useState<AreaData["safety"]>("safe");
  const [landClassificationId, setLandClassificationId] = useState<number | "">(
    "",
  );
  const [landClassifications, setLandClassifications] = useState<
    LandClassificationOption[]
  >([]);

  const [assessments, setAssessments] = useState<AssessmentItem[]>([]);
  const [permits, setPermits] = useState<PermitItem[]>([]);
  const [PSalert, setPSAlert] = useState<{
    type: "success" | "failed" | "error";
    title: string;
    message: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPermit, setUploadingPermit] = useState(false);

  const [newPermit, setNewPermit] = useState({
    document_type: "barangay_clearance" as PermitItem["document_type"],
    permit_number: "",
    verification_notes: "",
    file: null as File | null,
  });

  // ─────────────────────────────────────────────
  // Data Fetching Functions
  // ─────────────────────────────────────────────
  async function fetchArea() {
    if (!id || !token) return;
    try {
      const res = await fetch(`${API}/get_reforestation_area/${id}/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.data) {
        const area: AreaData = data.data;
        setAreaData(area);
        setMetaDataStatus(area.pre_assessment_status || "pending");
        setLegality(area.legality || "pending");
        setSafetyLevel(area.safety || "safe");
        setLandClassificationId(
          area.land_classification?.land_classification_id || "",
        );
      }
    } catch (err) {
      console.error("Failed to fetch area:", err);
      setPSAlert({
        type: "error",
        title: "Error",
        message: "Failed to load area data.",
      });
    }
  }

   async function fetchAssessments() {
    if (!id || !token) return;
    try {
      const res = await fetch(`${API}/area/${id}/meta_data/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setAssessments(data);
        console.log(data)
      }
    } catch (err) {
      console.error("Failed to fetch assessments:", err);
      setPSAlert({
        type: "error",
        title: "Error",
        message: "Failed to load assessments.",
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
      if (res.ok && data.data) {
        setPermits(data.data);
      }
    } catch (err) {
      console.error("Failed to fetch permits:", err);
    }
  }

  // ✅ NEW: Fetch Land Classifications
  async function fetchLandClassifications() {
    if (!token) return;
    try {
      const res = await fetch(`${API}/get_land_classifications_list/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.data) {
        setLandClassifications(data.data);
      }
    } catch (err) {
      console.error("Failed to fetch land classifications:", err);
    }
  }

  // ─────────────────────────────────────────────
  // Action Handlers
  // ─────────────────────────────────────────────
  async function handleSubmitStatus() {
    if (!areaData || !id || !token) return;

    const reforestationData = {
      assessment_type: "meta_data" as const, // ✅ Updated type
      validated_by: `GIS-SPEC-${CURRENT_USER_ID}`,
      validation_date: new Date().toISOString(),
      permits_verified: legality === "legal" && permits.length > 0,
      security_clearance: metaDataStatus === "approved" ? "cleared" : "pending",
      legal_status_decision: legality,
      // ✅ NEW: Safety & Land Classification decisions
      verified_safety_level: safetyLevel,
      verified_land_classification_id: landClassificationId || null,
      rejection_reason:
        metaDataStatus === "rejected"
          ? "Failed meta data verification criteria"
          : null,
      required_actions:
        metaDataStatus === "approved" ? ["proceed_to_mcda_layers"] : [],
      document_verification_notes: `Legality: ${legality}, Status: ${metaDataStatus}, Safety: ${safetyLevel}, Land Class: ${landClassificationId}, Permits: ${permits.length} verified`,
      meta_data_acceptance:
        metaDataStatus === "approved"
          ? "ACCEPT"
          : metaDataStatus === "rejected"
            ? "REJECT"
            : "PENDING",
    };

    setSaving(true);
    try {
      const res = await fetch(`${API}/update_reforestation_areas/${id}/`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          pre_assessment_status: metaDataStatus, // Keep for backward compat
          legality,
          safety: safetyLevel, // ✅ Save verified safety
          land_classification_id: landClassificationId || null, // ✅ Save land classification
          reforestation_data: reforestationData,
        }),
      });
      const data = await res.json();

      if (res.ok) {
        setPSAlert({
          type: "success",
          title: "Success",
          message: "Meta Data verification finalized.",
        });
        fetchArea();
        fetchPermits();
      } else {
        setPSAlert({
          type: "error",
          title: "Error",
          message: data.error || "Failed to save status.",
        });
      }
    } catch (err) {
      console.error("Submit error:", err);
      setPSAlert({
        type: "error",
        title: "Error",
        message: "Network error while saving.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleUploadPermit() {
    if (!newPermit.file || !id || !token) {
      setPSAlert({
        type: "error",
        title: "Missing File",
        message: "Please select a permit file.",
      });
      return;
    }

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
          document_type: "barangay_clearance",
          permit_number: "",
          verification_notes: "",
          file: null,
        });
        if (fileInputRef.current) fileInputRef.current.value = "";
        fetchPermits();
      } else {
        setPSAlert({
          type: "error",
          title: "Failed",
          message: data.error || "Upload failed.",
        });
      }
    } catch (err) {
      console.error("Upload error:", err);
      setPSAlert({ type: "error", title: "Error", message: "Upload failed." });
    } finally {
      setUploadingPermit(false);
    }
  }

  async function handleDeletePermit(permitId: number) {
    if (!confirm("Delete this verified permit? This cannot be undone.")) return;

    try {
      const res = await fetch(`${API}/permits/${permitId}/delete/`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setPSAlert({
          type: "success",
          title: "Deleted",
          message: "Permit removed.",
        });
        fetchPermits();
      } else {
        const err = await res.json();
        setPSAlert({
          type: "error",
          title: "Failed",
          message: err.error || "Could not delete.",
        });
      }
    } catch {
      setPSAlert({ type: "error", title: "Error", message: "Network error." });
    }
  }

  // ─────────────────────────────────────────────
  // Effects
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (id && token) {
      setLoading(true);
      Promise.all([
        fetchArea(),
        fetchAssessments(),
        fetchPermits(),
        fetchLandClassifications(), // ✅ Fetch land classifications
      ]).finally(() => setLoading(false));
    }
  }, [id]);

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-700 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading meta data verification...</p>
        </div>
      </div>
    );
  }

  if (!areaData) {
    return (
      <div className="p-10 text-center text-gray-600">
        <AlertCircle className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
        <p>Could not load area data.</p>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 text-green-700 hover:underline"
        >
          ← Go Back
        </button>
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

      {/* LEFT PANEL - Inspector Meta Data Submissions */}
      <div className="w-112.5 bg-white rounded-2xl shadow flex flex-col min-h-0 border border-gray-200">
        <div className="border-b p-5 bg-gray-50 rounded-t-2xl">
          <h2 className="text-xl font-bold text-green-700 flex items-center gap-2">
            <ClipboardCheck size={20} /> Meta Data Reviews
          </h2>
          <p className="text-sm text-gray-500 truncate mt-1">{areaData.name}</p>
          <p className="text-xs text-gray-400 mt-1">
            {assessments.length} submission(s) • {permits.length} verified
            permit(s)
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
          {assessments.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">
              <ClipboardCheck className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No meta data submissions yet.</p>
              <p className="text-xs mt-1">
                Onsite inspectors will appear here after submission.
              </p>
            </div>
          ) : (
            assessments.map((item) => {
              const faData = item.field_assessment_data;
              const isSubmitted = item.is_submitted;

              return (
                <div
                  key={item.field_assessment_id}
                  className={`bg-white rounded-xl p-4 border shadow-sm ${
                    isSubmitted ? "border-green-200" : "border-yellow-200"
                  }`}
                >
                  {/* Inspector Header */}
                  <div className="flex items-start gap-3 mb-3">
                    <img
                      src={
                        item.inspector_profile_img
                          ? `${API_IMAGE}${item.inspector_profile_img}`
                          : `https://ui-avatars.com/api/?name=${encodeURIComponent(item.inspector_name)}&background=random`
                      }
                      alt={item.inspector_name}
                      className="w-10 h-10 rounded-full object-cover border border-gray-200"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-800 truncate">
                        {item.inspector_name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {item.assessment_date
                          ? new Date(item.assessment_date).toLocaleDateString()
                          : new Date(item.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <StatusBadge status={isSubmitted ? "SUBMITTED" : "DRAFT"} />
                  </div>

                  {/* Permits Reported */}
                  {faData?.permits_available?.length > 0 && (
                    <div className="mb-3 p-2 bg-green-50 rounded-lg border border-green-100">
                      <div className="font-bold text-xs text-green-800 flex items-center gap-1 mb-1">
                        <FileText size={12} /> Permits Reported
                      </div>
                      <div className="text-xs text-green-700">
                        {faData.permits_available
                          .map((p: string) => p.replace("_", " "))
                          .join(", ")}
                      </div>
                      {Object.keys(faData.permit_numbers || {}).length > 0 && (
                        <div className="text-xs text-green-600 mt-1">
                          {Object.entries(faData.permit_numbers).map(
                            ([k, v]) => (
                              <span key={k} className="mr-2">
                                {k.replace("_", " ")}: {v}
                              </span>
                            ),
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Safety & Community Grid */}
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div
                      className={`p-2 rounded-lg text-xs ${
                        faData?.general_safety_assessment === "safe"
                          ? "bg-green-50 text-green-800 border border-green-100"
                          : "bg-red-50 text-red-800 border border-red-100"
                      }`}
                    >
                      <div className="font-bold flex items-center gap-1 mb-1">
                        <AlertTriangle size={12} /> Safety
                      </div>
                      <div>
                        {faData?.general_safety_assessment?.replace("_", " ") ||
                          "N/A"}
                      </div>
                    </div>
                    <div
                      className={`p-2 rounded-lg text-xs ${
                        faData?.community_support === "strong_support"
                          ? "bg-green-50 text-green-800 border border-green-100"
                          : faData?.community_support === "opposition"
                            ? "bg-red-50 text-red-800 border border-red-100"
                            : "bg-yellow-50 text-yellow-800 border border-yellow-100"
                      }`}
                    >
                      <div className="font-bold flex items-center gap-1 mb-1">
                        <Users size={12} /> Community
                      </div>
                      <div>
                        {faData?.community_support?.replace("_", " ") || "N/A"}
                      </div>
                    </div>
                  </div>

                  {/* Security Concerns */}
                  {!faData?.security_concerns?.includes("none") &&
                    faData?.security_concerns?.length > 0 && (
                      <div className="mb-3 p-2 bg-red-50 rounded-lg border border-red-100">
                        <div className="font-bold text-xs text-red-800 flex items-center gap-1 mb-1">
                          <ShieldCheck size={12} /> Security Concerns
                        </div>
                        <div className="text-xs text-red-700">
                          {faData.security_concerns
                            .map((s: string) => s.replace("_", " "))
                            .join(", ")}
                        </div>
                        {faData.security_notes && (
                          <CollapsibleText
                            text={faData.security_notes}
                            maxLength={60}
                          />
                        )}
                      </div>
                    )}

                  {/* Inspector Recommendation */}
                  {faData?.pre_assessment_recommendation && (
                    <div className="mb-2">
                      <RecommendationBadge
                        recommendation={faData.pre_assessment_recommendation}
                      />
                    </div>
                  )}

                  {/* Additional Notes */}
                  {faData?.additional_notes && (
                    <div className="mt-2">
                      <p className="text-xs font-semibold text-gray-500 mb-1">
                        Notes:
                      </p>
                      <CollapsibleText
                        text={faData.additional_notes}
                        maxLength={80}
                      />
                    </div>
                  )}

                  {/* Field Assessment Images Gallery */}
                  <ImageGallery images={item.images} />

                  {/* Location Info */}
                  {item.location && (
                    <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 text-xs text-gray-500">
                      <MapPin size={12} />
                      <span>
                        {item.location.latitude.toFixed(4)},{" "}
                        {item.location.longitude.toFixed(4)}
                      </span>
                      {item.location.gps_accuracy_meters && (
                        <span className="text-gray-400">
                          ±{item.location.gps_accuracy_meters}m
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT PANEL - GIS Specialist Meta Data Finalization */}
      <div className="flex-1 bg-white rounded-2xl shadow p-8 flex flex-col gap-6 min-h-0 border border-gray-200 overflow-y-auto">
        <div>
          <h2 className="text-2xl font-bold text-green-700">
            Meta Data Verification
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Review inspector submissions, verify permits, set safety level &
            land classification, and finalize area status.
          </p>
        </div>

        {/* Permit Upload Section */}
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h3 className="font-bold text-blue-800 flex items-center gap-2 mb-3">
            <Upload size={16} /> Upload Verified Permit
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <select
              value={newPermit.document_type}
              onChange={(e) =>
                setNewPermit({
                  ...newPermit,
                  document_type: e.target.value as PermitItem["document_type"],
                })
              }
              className="border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none"
            >
              <option value="barangay_clearance">Barangay Clearance</option>
              <option value="lgu_endorsement">LGU Endorsement</option>
              <option value="denr_permit">DENR Permit</option>
              <option value="landowner_consent">Landowner Consent</option>
              <option value="other">Other</option>
            </select>
            <input
              type="text"
              placeholder="Permit Number (optional)"
              value={newPermit.permit_number}
              onChange={(e) =>
                setNewPermit({ ...newPermit, permit_number: e.target.value })
              }
              className="border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none"
            />
            <input
              type="text"
              placeholder="Verification Notes"
              value={newPermit.verification_notes}
              onChange={(e) =>
                setNewPermit({
                  ...newPermit,
                  verification_notes: e.target.value,
                })
              }
              className="border border-gray-300 rounded-lg p-2 text-sm col-span-2 focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none"
            />
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) =>
                setNewPermit({
                  ...newPermit,
                  file: e.target.files?.[0] || null,
                })
              }
              className="col-span-2 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200"
              accept=".pdf,.jpg,.jpeg,.png"
            />
            <button
              onClick={handleUploadPermit}
              disabled={uploadingPermit || !newPermit.file}
              className="col-span-2 bg-blue-600 text-white rounded-lg p-2 text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {uploadingPermit ? "Uploading..." : "Upload & Verify Permit"}
            </button>
          </div>

          {permits.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-semibold text-blue-700">
                Verified Permits ({permits.length})
              </p>
              {permits.map((p) => (
                <div
                  key={p.permit_id}
                  className="flex items-center justify-between p-3 bg-white rounded-lg border border-blue-100 hover:border-blue-300 transition-colors"
                >
                  <div className="text-xs flex-1 min-w-0">
                    <div className="font-semibold text-gray-800">
                      {p.document_type.replace("_", " ")}
                    </div>
                    {p.permit_number && (
                      <span className="text-gray-500">#{p.permit_number}</span>
                    )}
                    {p.verification_notes && (
                      <CollapsibleText
                        text={p.verification_notes}
                        maxLength={50}
                      />
                    )}
                    <div className="text-gray-400 text-xs mt-1">
                      Uploaded: {new Date(p.uploaded_at).toLocaleDateString()}
                      {p.uploaded_by && ` by ${p.uploaded_by}`}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeletePermit(p.permit_id)}
                    className="text-red-600 hover:text-red-800 p-2 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete permit"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ✅ NEW: Safety Level & Land Classification Section */}
        <div className="grid grid-cols-2 gap-4">
          {/* Safety Level */}
          <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
            <h3 className="font-bold text-orange-800 flex items-center gap-2 mb-3">
              <ThermometerSun size={16} /> Verified Safety Level
            </h3>
            <select
              value={safetyLevel}
              onChange={(e) =>
                setSafetyLevel(e.target.value as AreaData["safety"])
              }
              className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-500 outline-none bg-white"
            >
              <option value="safe">✅ Safe</option>
              <option value="slightly">⚠️ Slightly Unsafe</option>
              <option value="moderate">⚡ Moderate Risk</option>
              <option value="danger">🚫 High Risk / Dangerous</option>
            </select>
            <p className="text-xs text-orange-700 mt-2">
              Set based on inspector reports & site conditions.
            </p>
          </div>

          {/* Land Classification */}
          <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
            <h3 className="font-bold text-purple-800 flex items-center gap-2 mb-3">
              <Layers size={16} /> Land Classification
            </h3>
            <select
              value={landClassificationId}
              onChange={(e) =>
                setLandClassificationId(parseInt(e.target.value) || "")
              }
              className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-purple-300 focus:border-purple-500 outline-none bg-white"
              disabled={landClassifications.length === 0}
            >
              <option value="">-- Select Classification --</option>
              {landClassifications.map((lc) => (
                <option
                  key={lc.land_classification_id}
                  value={lc.land_classification_id}
                >
                  {lc.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-purple-700 mt-2">
              Official land use designation for planning purposes.
            </p>
          </div>
        </div>

        {/* Status Decision Section */}
        <div className="space-y-6 max-w-2xl">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold flex items-center gap-2 text-gray-700">
              <ShieldCheck size={18} className="text-green-600" /> Legal Status
              Decision
            </label>
            <select
              value={legality}
              onChange={(e) =>
                setLegality(e.target.value as AreaData["legality"])
              }
              className="border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-green-300 focus:border-green-500 outline-none bg-white text-gray-700"
            >
              <option value="pending">⏳ Pending Review</option>
              <option value="legal">✅ Legal / Cleared</option>
              <option value="illegal">❌ Illegal / Disputed</option>
            </select>
            <p className="text-xs text-gray-500">
              Set to "Legal" only after verifying all required permits above.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold flex items-center gap-2 text-gray-700">
              <ClipboardCheck size={18} className="text-green-600" /> Meta Data
              Status
            </label>
            <select
              value={metaDataStatus}
              onChange={(e) =>
                setMetaDataStatus(
                  e.target.value as AreaData["pre_assessment_status"],
                )
              }
              className="border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-green-300 focus:border-green-500 outline-none bg-white text-gray-700"
            >
              <option value="pending">⏳ Pending Finalization</option>
              <option value="approved">
                ✅ Approved (Proceed to MCDA Layers)
              </option>
              <option value="rejected">❌ Rejected (Area Excluded)</option>
            </select>
            <p className="text-xs text-gray-500">
              "Approved" enables Safety, Boundary, and Survivability layers.
              "Rejected" excludes this area.
            </p>
          </div>

          {areaData.description && (
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                Area Context
              </p>
              {areaData.barangay?.name && (
                <p className="text-sm text-gray-700 mb-1">
                  <span className="font-semibold">Barangay:</span>{" "}
                  {areaData.barangay.name}
                </p>
              )}
              <CollapsibleText text={areaData.description} maxLength={200} />
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-auto pt-6 border-t border-gray-200 flex gap-4">
          <button
            onClick={() => navigate(-1)}
            className="flex-1 border border-gray-300 rounded-lg p-3 flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors text-gray-700 font-medium disabled:opacity-50"
            disabled={saving}
          >
            <X size={18} /> Cancel
          </button>
          <button
            onClick={handleSubmitStatus}
            className="flex-1 bg-green-700 text-white rounded-lg p-3 flex items-center justify-center gap-2 hover:bg-green-800 transition-colors font-bold shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={saving}
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <Save size={18} /> Save Verification
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
