import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ShieldCheck,
  AlertTriangle,
  ClipboardCheck,
  Save,
  X,
  Undo2,
  CheckCircle2,
  XCircle,
  User,
} from "lucide-react";
import PlantScopeAlert from "@/components/alert/PlantScopeAlert";

const API = "http://127.0.0.1:8000/api";

// Mock current user ID - Replace with actual auth context
const CURRENT_USER_ID = 1;

interface AreaData {
  reforestation_area_id: number;
  name: string;
  legality: "pending" | "legal" | "illegal";
  safety: "safe" | "slightly" | "moderate" | "danger";
  description: string;
}

interface AssessmentItem {
  field_assessment_id: number;
  created_at: string;
  title: string;
  description: string;
  overall_status: "PASSED" | "FAILED" | "UNKNOWN";
  is_safe: boolean;
  safety_status_label: string;
  safety_reason: string | null;
  is_legal: boolean;
  legality_status_label: string;
  legality_reason: string | null;
  clearance_statement: string;
  user: {
    user_id: number;
    full_name: string;
    email: string;
    profile_img: string | null;
  };
}

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

export default function Legality_and_Safety() {
  const { id } = useParams();
  const token = localStorage.getItem("token");
  const navigate = useNavigate();

  const [areaData, setAreaData] = useState<AreaData | null>(null);
  const [legality, setLegality] = useState<AreaData["legality"]>("pending");
  const [safety, setSafety] = useState<AreaData["safety"]>("danger");

  // We removed the tab state because Pre-Assessment contains BOTH legality and safety together
  const [assessments, setAssessments] = useState<AssessmentItem[]>([]);
  const [PSalert, setPSAlert] = useState<{
    type: "success" | "failed" | "error";
    title: string;
    message: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchArea() {
    if (!id || !token) return;
    try {
      const res = await fetch(`${API}/get_reforestation_area/${id}/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        const area = data.data;
        setAreaData({ ...area, barangay_id: area.barangay?.barangay_id });
        setLegality(area.legality);
        setSafety(area.safety);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function fetchAssessments() {
    if (!id || !token) return;
    setLoading(true);
    try {
      // UPDATED ENDPOINT
      const res = await fetch(`${API}/get_pre_assessment_reviews/${id}/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setAssessments(data.results);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleUnsend(idToUnsend: number) {
    if (
      !confirm(
        "Are you sure? This will revert the assessment to 'Draft' status, allowing you to edit or delete it again.",
      )
    )
      return;

    try {
      const res = await fetch(`${API}/unsent_field_assessment/${idToUnsend}/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (res.ok) {
        setPSAlert({
          type: "success",
          title: "Reverted",
          message: "Assessment is now a draft.",
        });
        fetchAssessments(); // Refresh list
      } else {
        setPSAlert({
          type: "error",
          title: "Failed",
          message: data.error || "Could not unsend.",
        });
      }
    } catch (err) {
      setPSAlert({ type: "error", title: "Error", message: "Network error." });
    }
  }

  async function handleSubmitStatus() {
    if (!areaData || !id || !token) return;
    try {
      const res = await fetch(`${API}/update_reforestation_areas/${id}/`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...areaData, legality, safety }),
      });
      const data = await res.json();
      setPSAlert(
        res.ok
          ? {
              type: "success",
              title: "Success",
              message: "Area status updated.",
            }
          : { type: "error", title: "Error", message: data.error },
      );
      if (res.ok) fetchArea();
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    fetchArea();
    fetchAssessments();
  }, [id]);

  if (!areaData) return <div className="p-10 text-gray-600">Loading...</div>;

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

      {/* LEFT PANEL - Inspector Pre-Assessment Feedback */}
      <div className="w-112.5 bg-white rounded-2xl shadow flex flex-col min-h-0 border border-gray-200">
        <div className="border-b p-5 bg-gray-50 rounded-t-2xl">
          <h2 className="text-xl font-bold text-green-700 flex items-center gap-2">
            <ClipboardCheck size={20} /> Pre-Assessment Reviews
          </h2>
          <p className="text-sm text-gray-500 truncate mt-1">{areaData.name}</p>
          <p className="text-xs text-gray-400 mt-1">
            {assessments.length} submission(s) found
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
          {loading ? (
            <div className="text-center py-10 text-gray-400">
              Loading reviews...
            </div>
          ) : assessments.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">
              No pre-assessments submitted yet.
            </div>
          ) : (
            assessments.map((item) => {
              const isOwner = item.user.user_id === CURRENT_USER_ID;
              const isPassed = item.overall_status === "PASSED";

              return (
                <div
                  key={item.field_assessment_id}
                  className={`bg-white rounded-xl p-4 border shadow-sm relative ${isPassed ? "border-green-200" : "border-red-200"}`}
                >
                  {/* Header */}
                  <div className="flex items-start gap-3 mb-3">
                    <img
                      src={
                        item.user.profile_img
                          ? `http://127.0.0.1:8000${item.user.profile_img}`
                          : `https://ui-avatars.com/api/?name=${encodeURIComponent(item.user.full_name)}&background=random`
                      }
                      alt={item.user.full_name}
                      className="w-10 h-10 rounded-full object-cover border border-gray-200"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-800 truncate">
                        {item.user.full_name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(item.created_at).toLocaleString()}
                      </p>
                    </div>
                    {/* Status Badge */}
                    <div
                      className={`px-2 py-1 rounded text-xs font-bold flex items-center gap-1 ${isPassed ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                    >
                      {isPassed ? (
                        <CheckCircle2 size={14} />
                      ) : (
                        <XCircle size={14} />
                      )}
                      {item.overall_status}
                    </div>
                  </div>

                  {/* Content Grid */}
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    {/* Safety Box */}
                    <div
                      className={`p-2 rounded-lg text-xs ${item.is_safe ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}
                    >
                      <div className="font-bold flex items-center gap-1 mb-1">
                        <AlertTriangle size={12} /> Safety
                      </div>
                      <div>{item.safety_status_label}</div>
                      {item.safety_reason && (
                        <div className="mt-1 italic opacity-80">
                          "{item.safety_reason}"
                        </div>
                      )}
                    </div>
                    {/* Legality Box */}
                    <div
                      className={`p-2 rounded-lg text-xs ${item.is_legal ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}
                    >
                      <div className="font-bold flex items-center gap-1 mb-1">
                        <ShieldCheck size={12} /> Legality
                      </div>
                      <div>{item.legality_status_label}</div>
                      {item.legality_reason && (
                        <div className="mt-1 italic opacity-80">
                          "{item.legality_reason}"
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Statement */}
                  {item.clearance_statement && (
                    <div className="mb-3">
                      <p className="text-xs font-semibold text-gray-500 mb-1">
                        Inspector Statement:
                      </p>
                      <CollapsibleText
                        text={item.clearance_statement}
                        maxLength={80}
                      />
                    </div>
                  )}

                  {/* Actions */}
                  {isOwner && (
                    <div className="pt-3 border-t border-gray-100 flex justify-end">
                      <button
                        onClick={() => handleUnsend(item.field_assessment_id)}
                        className="text-xs flex items-center gap-1 text-orange-600 hover:text-orange-800 font-medium transition-colors"
                      >
                        <Undo2 size={14} /> Unsend (Edit)
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT PANEL - GIS Specialist Review Form */}
      <div className="flex-1 bg-white rounded-2xl shadow p-8 flex flex-col gap-6 min-h-0 border border-gray-200">
        <div>
          <h2 className="text-2xl font-bold text-green-700">
            Final Status Review
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Based on inspector pre-assessments, finalize the area status.
          </p>
        </div>

        <div className="space-y-6 max-w-2xl">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold flex items-center gap-2 text-gray-700">
              <ShieldCheck size={18} className="text-green-600" /> Final
              Legality Status
            </label>
            <select
              value={legality}
              onChange={(e) => setLegality(e.target.value as any)}
              className="border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-green-300 focus:border-green-500 outline-none bg-white text-gray-700"
            >
              <option value="pending">⏳ Pending Review</option>
              <option value="legal">✅ Legal / Cleared</option>
              <option value="illegal">❌ Illegal / Disputed</option>
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold flex items-center gap-2 text-gray-700">
              <AlertTriangle size={18} className="text-green-600" /> Final
              Safety Status
            </label>
            <select
              value={safety}
              onChange={(e) => setSafety(e.target.value as any)}
              className="border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-green-300 focus:border-green-500 outline-none bg-white text-gray-700"
            >
              <option value="safe">🟢 Low Risk (Safe)</option>
              <option value="slightly">🟡 Slightly Unsafe</option>
              <option value="moderate">🟠 Moderate Risk</option>
              <option value="danger">🔴 High Risk (Danger)</option>
            </select>
          </div>

          {areaData.description && (
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                Area Description
              </p>
              <CollapsibleText text={areaData.description} maxLength={200} />
            </div>
          )}
        </div>

        <div className="mt-auto pt-6 border-t flex gap-4">
          <button
            onClick={() => navigate(-1)}
            className="flex-1 border border-gray-300 rounded-lg p-3 flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors text-gray-700 font-medium"
          >
            <X size={18} /> Cancel
          </button>
          <button
            onClick={handleSubmitStatus}
            className="flex-1 bg-green-700 text-white rounded-lg p-3 flex items-center justify-center gap-2 hover:bg-green-800 transition-colors font-bold shadow-md"
          >
            <Save size={18} /> Save Final Status
          </button>
        </div>
      </div>
    </div>
  );
}
