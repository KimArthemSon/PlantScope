import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ShieldCheck,
  AlertTriangle,
  ClipboardCheck,
  Save,
  X,
} from "lucide-react";

const API = "http://127.0.0.1:8000/api";

interface ReforestationArea {
  reforestation_area_id: number;
  name: string;
  legality: "pending" | "legal" | "illegal";
  safety: "safe" | "slightly" | "moderate" | "danger";
  location: string;
  description: string;
}

interface FieldAssessment {
  field_assessment_id: number;
  legality: string;
  safety: string;
  created_at: string;
  user_id: number;
  full_name: string;
  email: string;
  profile_img: string | null;
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

  // FETCH AREA
  async function fetchArea() {
    if (!id || !token) return;

    const res = await fetch(`${API}/get_reforestation_area/${id}/`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json();

    if (res.ok) {
      const area = data.data;
      setAreaData(area);
      setLegality(area.legality);
      setSafety(area.safety);
    }
  }

  // FETCH FEEDBACK
  async function fetchAssessments() {
    if (!id || !token) return;

    const res = await fetch(`${API}/get_field_assessments_by_area/${id}/`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json();
    console.log(data);
    if (res.ok) {
      setAssessments(data.results);
    }
  }

  useEffect(() => {
    fetchArea();
    fetchAssessments();
  }, [id]);

  // UPDATE STATUS
  async function handleSubmit() {
    if (!areaData || !token) return;

    const res = await fetch(`${API}/update_reforestation_areas/${id}/`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        ...areaData,
        legality,
        safety,
      }),
    });

    const data = await res.json();

    if (res.ok) {
      alert("Updated successfully");
      fetchArea();
    } else {
      alert(data.error || "Update failed");
    }
  }

  function handleCancel() {
    navigate(-1);
  }

  // FILTERED FEEDBACK
  const filteredAssessments =
    activeTab === "legality"
      ? assessments.filter((a) => a.legality)
      : assessments.filter((a) => a.safety);

  if (!areaData) return <div className="p-10 text-gray-600">Loading...</div>;

  return (
    <div className="flex w-full h-screen bg-gray-100 p-6 gap-6">
      {/* LEFT PANEL */}
      <div className="w-[420px] bg-white rounded-2xl shadow flex flex-col">
        {/* HEADER */}
        <div className="border-b p-5">
          <h2 className="text-xl font-bold text-green-700">
            Inspector Feedback
          </h2>
          <p className="text-sm text-gray-500">{areaData.name}</p>
        </div>

        {/* TABS */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab("legality")}
            className={`flex-1 p-3 flex items-center justify-center gap-2 text-sm font-semibold ${
              activeTab === "legality"
                ? "border-b-2 border-green-700 text-green-700"
                : "text-gray-500"
            }`}
          >
            <ClipboardCheck size={16} />
            Legality
          </button>

          <button
            onClick={() => setActiveTab("safety")}
            className={`flex-1 p-3 flex items-center justify-center gap-2 text-sm font-semibold ${
              activeTab === "safety"
                ? "border-b-2 border-green-700 text-green-700"
                : "text-gray-500"
            }`}
          >
            <AlertTriangle size={16} />
            Safety
          </button>
        </div>

        {/* FEEDBACK LIST */}
        <div className="flex-1 p-5 overflow-y-auto space-y-3">
          {filteredAssessments.length === 0 && (
            <p className="text-sm text-gray-500">No feedback submitted yet.</p>
          )}

          {filteredAssessments.map((item) => (
            <div
              key={item.field_assessment_id}
              className="bg-gray-50 rounded-xl p-3 flex gap-3 border border-green-600"
            >
              <img
                src={
                  item.profile_img
                    ? `http://127.0.0.1:8000${item.profile_img}`
                    : `https://ui-avatars.com/api/?name=${item.full_name}`
                }
                className="w-10 h-10 rounded-full object-cover"
              />

              <div className="flex-1">
                <p className="text-sm font-semibold">{item.full_name}</p>

                <p className="text-xs text-gray-400">
                  {new Date(item.created_at).toLocaleString()}
                </p>

                {activeTab === "legality" && (
                  <p className="text-sm mt-1">
                    Legality:{" "}
                    <span className="font-semibold capitalize">
                      {item.legality}
                    </span>
                  </p>
                )}

                {activeTab === "safety" && (
                  <p className="text-sm mt-1">
                    Safety:{" "}
                    <span className="font-semibold capitalize">
                      {item.safety}
                    </span>
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="flex-1 bg-white rounded-2xl shadow p-6 flex flex-col gap-6">
        <div>
          <h2 className="text-2xl font-bold text-green-700">
            Legality & Safety Review
          </h2>
          <p className="text-sm text-gray-500">
            Update inspection result for this reforestation area
          </p>
        </div>

        {/* LEGALITY */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold flex items-center gap-2">
            <ShieldCheck size={16} />
            Legality Status
          </label>

          <select
            value={legality}
            onChange={(e) =>
              setLegality(e.target.value as ReforestationArea["legality"])
            }
            className="border rounded-lg p-2 focus:ring-2 focus:ring-green-300"
          >
            <option value="pending">Pending</option>
            <option value="legal">Legal</option>
            <option value="illegal">Illegal</option>
          </select>
        </div>

        {/* SAFETY */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold flex items-center gap-2">
            <AlertTriangle size={16} />
            Safety Status
          </label>

          <select
            value={safety}
            onChange={(e) =>
              setSafety(e.target.value as ReforestationArea["safety"])
            }
            className="border rounded-lg p-2 focus:ring-2 focus:ring-green-300"
          >
            <option value="safe">Low Risk</option>
            <option value="slightly">Slightly Unsafe</option>
            <option value="moderate">Moderate Risk</option>
            <option value="danger">High Risk</option>
          </select>
        </div>

        {/* BUTTONS */}
        <div className="flex gap-3 mt-auto">
          <button
            onClick={handleCancel}
            className="flex-1 border rounded-lg p-2 flex items-center justify-center gap-2 hover:bg-gray-100"
          >
            <X size={16} />
            Cancel
          </button>

          <button
            onClick={handleSubmit}
            className="flex-1 bg-green-700 text-white rounded-lg p-2 flex items-center justify-center gap-2 hover:bg-green-800"
          >
            <Save size={16} />
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
