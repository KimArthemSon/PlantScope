import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ShieldCheck,
  AlertTriangle,
  ClipboardCheck,
  Save,
  X,
} from "lucide-react";
import PlantScopeAlert from "@/components/alert/PlantScopeAlert";

const API = "http://127.0.0.1:8000/api";

interface ReforestationArea {
  reforestation_area_id: number;
  name: string;
  legality: "pending" | "legal" | "illegal";
  safety: "safe" | "slightly" | "moderate" | "danger";
  barangay: { barangay_id: number; name: string };
  barangay_id: number;
  description: string;
}

interface FieldAssessment {
  field_assessment_id: number;
  legality: string | null;
  safety: string | null;
  legality_discussion?: string | null;
  safety_discussion?: string | null;
  created_at: string;
  user: {
    user_id: number;
    full_name: string;
    email: string;
    profile_img: string | null;
  };
}

// ✅ IMPROVED: Collapsible component with proper overflow handling
function CollapsibleText({
  text,
  maxLength = 255,
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
        className={`text-xs text-gray-600 break-words overflow-wrap-anywhere whitespace-pre-wrap ${
          !expanded && isLong ? "max-h-16 overflow-hidden" : ""
        }`}
      >
        {displayText}
      </p>
      {isLong && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-1 text-green-700 font-semibold text-xs hover:underline focus:outline-none transition-colors"
          aria-expanded={expanded}
        >
          {expanded ? "▲ Show less" : "▼ Read more"}
        </button>
      )}
    </div>
  );
}

export default function Legality_and_Safety() {
  const { id } = useParams();
  const token = localStorage.getItem("token");
  const navigate = useNavigate();

  const [areaData, setAreaData] = useState<ReforestationArea | null>(null);
  const [legality, setLegality] =
    useState<ReforestationArea["legality"]>("pending");
  const [safety, setSafety] = useState<ReforestationArea["safety"]>("danger");
  const [activeTab, setActiveTab] = useState<"legality" | "safety">("legality");
  const [assessments, setAssessments] = useState<FieldAssessment[]>([]);
  const [PSalert, setPSAlert] = useState<{
    type: "success" | "failed" | "error";
    title: string;
    message: string;
  } | null>(null);

  // Fetch area
  async function fetchArea() {
    if (!id || !token) return;
    try {
      const res = await fetch(`${API}/get_reforestation_area/${id}/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        const area = data.data;
        setAreaData({ ...area, barangay_id: area.barangay.barangay_id });
        setLegality(area.legality);
        setSafety(area.safety);
      }
    } catch (err) {
      console.error(err);
    }
  }

  // Fetch assessments
  async function fetchAssessments() {
    if (!id || !token) return;
    try {
      const res = await fetch(
        `${API}/get_field_assessments_legality_safety/${id}/`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await res.json();
      if (res.ok) setAssessments(data.results);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    fetchArea();
    fetchAssessments();
  }, [id]);

  // Update status
  async function handleSubmit() {
    if (!areaData || !token) return;
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
              message: "Updated successfully",
            }
          : {
              type: "error",
              title: "Error",
              message: data.error || "Update failed",
            },
      );
      if (res.ok) fetchArea();
    } catch (err) {
      console.error(err);
    }
  }

  function handleCancel() {
    navigate(-1);
  }

  const filteredAssessments =
    activeTab === "legality"
      ? assessments.filter((a) => a.legality !== null)
      : assessments.filter((a) => a.safety !== null);

  if (!areaData) return <div className="p-10 text-gray-600">Loading...</div>;

  return (
    <div className="flex w-full h-screen bg-gray-100 p-6 gap-6">
      {PSalert && (
        <PlantScopeAlert
          type={PSalert.type}
          title={PSalert.title}
          message={PSalert.message}
          onClose={() => setPSAlert(null)}
        />
      )}

      {/* LEFT PANEL - Inspector Feedback */}
      <div className="w-[420px] bg-white rounded-2xl shadow flex flex-col min-h-0">
        <div className="border-b p-5">
          <h2 className="text-xl font-bold text-green-700">
            Inspector Feedback
          </h2>
          <p className="text-sm text-gray-500 truncate">{areaData.name}</p>
        </div>

        <div className="flex border-b">
          <button
            onClick={() => setActiveTab("legality")}
            className={`flex-1 p-3 flex items-center justify-center gap-2 text-sm font-semibold transition-colors ${
              activeTab === "legality"
                ? "border-b-2 border-green-700 text-green-700"
                : "text-gray-500 hover:text-green-600"
            }`}
          >
            <ClipboardCheck size={16} /> Legality
          </button>
          <button
            onClick={() => setActiveTab("safety")}
            className={`flex-1 p-3 flex items-center justify-center gap-2 text-sm font-semibold transition-colors ${
              activeTab === "safety"
                ? "border-b-2 border-green-700 text-green-700"
                : "text-gray-500 hover:text-green-600"
            }`}
          >
            <AlertTriangle size={16} /> Safety
          </button>
        </div>

        {/* ✅ Fixed: Added min-h-0 and proper overflow handling for scrollable area */}
        <div className="flex-1 p-5 overflow-y-auto space-y-3 min-h-0">
          {filteredAssessments.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">
              No feedback submitted yet.
            </p>
          )}

          {filteredAssessments.map((item) => (
            <div
              key={item.field_assessment_id}
              className="bg-gray-50 rounded-xl p-3 flex gap-3 border border-green-100 hover:border-green-300 transition-colors"
            >
              <img
                src={
                  item.user.profile_img
                    ? `http://127.0.0.1:8000${item.user.profile_img}`
                    : `https://ui-avatars.com/api/?name=${encodeURIComponent(item.user.full_name)}&background=random`
                }
                alt={item.user.full_name}
                className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(item.user.full_name)}&background=random`;
                }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">
                  {item.user.full_name}
                </p>
                <p className="text-xs text-gray-400">
                  {new Date(item.created_at).toLocaleString()}
                </p>

                {activeTab === "legality" && item.legality && (
                  <>
                    <p className="text-sm mt-1">
                      Legality:{" "}
                      <span className="font-semibold capitalize text-green-700">
                        {item.legality}
                      </span>
                    </p>
                    {item.legality_discussion && (
                      <CollapsibleText text={item.legality_discussion} />
                    )}
                  </>
                )}

                {activeTab === "safety" && item.safety && (
                  <>
                    <p className="text-sm mt-1">
                      Safety:{" "}
                      <span className="font-semibold capitalize text-green-700">
                        {item.safety}
                      </span>
                    </p>
                    {item.safety_discussion && (
                      <CollapsibleText text={item.safety_discussion} />
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT PANEL - Review Form */}
      <div className="flex-1 bg-white rounded-2xl shadow p-6 flex flex-col gap-6 min-h-0">
        <div>
          <h2 className="text-2xl font-bold text-green-700">
            Legality & Safety Review
          </h2>
          <p className="text-sm text-gray-500">
            Update inspection result for this reforestation area
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold flex items-center gap-2 text-gray-700">
            <ShieldCheck size={16} className="text-green-600" /> Legality Status
          </label>
          <select
            value={legality}
            onChange={(e) =>
              setLegality(e.target.value as ReforestationArea["legality"])
            }
            className="border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-green-300 focus:border-green-500 outline-none transition-shadow bg-white"
          >
            <option value="pending">⏳ Pending Review</option>
            <option value="legal"> Legal</option>
            <option value="illegal"> Illegal</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold flex items-center gap-2 text-gray-700">
            <AlertTriangle size={16} className="text-green-600" /> Safety Status
          </label>
          <select
            value={safety}
            onChange={(e) =>
              setSafety(e.target.value as ReforestationArea["safety"])
            }
            className="border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-green-300 focus:border-green-500 outline-none transition-shadow bg-white"
          >
            <option value="safe"> Low Risk (Safe)</option>
            <option value="slightly"> Slightly Unsafe</option>
            <option value="moderate"> Moderate Risk</option>
            <option value="danger"> High Risk (Danger)</option>
          </select>
        </div>

        {/* Discussion Preview Section */}
        {areaData.description && (
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
            <p className="text-xs font-semibold text-gray-600 mb-1">
              Area Description:
            </p>
            <CollapsibleText text={areaData.description} maxLength={150} />
          </div>
        )}

        <div className="flex gap-3 mt-auto pt-4 border-t">
          <button
            onClick={handleCancel}
            className="flex-1 border border-gray-300 rounded-lg p-2.5 flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors text-gray-700"
          >
            <X size={16} /> Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 bg-green-700 text-white rounded-lg p-2.5 flex items-center justify-center gap-2 hover:bg-green-800 transition-colors font-medium"
          >
            <Save size={16} /> Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
