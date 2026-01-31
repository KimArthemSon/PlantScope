"use client";
import { useState } from "react";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

type Status = "pass" | "warn" | "fail";

export default function SiteSuitability() {
  const [inputs, setInputs] = useState({
    vegetation: 60,
    slope: "Moderate",
    soil: "Good",
    rainfall: "Adequate",
    flood: "Low",
    landuse: "Allowed",
    hazard: "Low",
    access: "Near",
  });

  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  const [score, setScore] = useState<number | null>(null);
  const [decision, setDecision] = useState("");
  const [loading, setLoading] = useState(false);

  const rows = [
    { key: "vegetation", label: "Vegetation Coverage (%)" },
    {
      key: "slope",
      label: "Topography (Slope)",
      options: ["Low", "Moderate", "Steep"],
    },
    { key: "soil", label: "Soil Quality", options: ["Good", "Fair", "Poor"] },
    {
      key: "rainfall",
      label: "Climate (Rainfall)",
      options: ["Adequate", "Low"],
    },
    { key: "flood", label: "Flood Risk", options: ["Low", "Medium", "High"] },
    {
      key: "landuse",
      label: "Land Use Compatibility",
      options: ["Allowed", "Restricted"],
    },
    { key: "hazard", label: "Hazard Risk", options: ["Low", "Medium", "High"] },
    { key: "access", label: "Accessibility", options: ["Near", "Far"] },
  ];

  const evaluateStatus = (key: string, value: any): Status => {
    if (key === "vegetation") return value >= 50 ? "pass" : "fail";
    if (["Low", "Good", "Adequate", "Allowed", "Near"].includes(value))
      return "pass";
    if (["Moderate", "Fair", "Medium"].includes(value)) return "warn";
    return "fail";
  };

  const analyzeSite = async () => {
    setLoading(true);
    setStatuses({});
    setScore(null);
    setDecision("");

    for (const row of rows) {
      await new Promise((res) => setTimeout(res, 300));
      setStatuses((prev) => ({
        ...prev,
        [row.key]: evaluateStatus(row.key, (inputs as any)[row.key]),
      }));
    }

    let total = 0;
    total += inputs.vegetation * 0.25;
    total += inputs.slope === "Low" ? 15 : inputs.slope === "Moderate" ? 10 : 5;
    total += inputs.soil === "Good" ? 15 : inputs.soil === "Fair" ? 10 : 5;
    total += inputs.rainfall === "Adequate" ? 10 : 5;
    total += inputs.flood === "Low" ? 10 : inputs.flood === "Medium" ? 5 : 0;
    total += inputs.landuse === "Allowed" ? 10 : 0;
    total += inputs.hazard === "Low" ? 10 : inputs.hazard === "Medium" ? 5 : 0;
    total += inputs.access === "Near" ? 5 : 2;

    const finalScore = Math.round(total);
    setScore(finalScore);

    if (finalScore >= 70) setDecision("Suitable for Reforestation");
    else if (finalScore >= 50) setDecision("Conditionally Suitable");
    else setDecision("Not Suitable");

    setLoading(false);
  };

  const renderStatus = (key: string) => {
    if (loading && !statuses[key])
      return <Loader2 className="animate-spin text-gray-400" />;

    const status = statuses[key];
    if (!status) return null;

    if (status === "pass") return <CheckCircle className="text-green-600" />;
    if (status === "warn") return <CheckCircle className="text-yellow-500" />;
    return <XCircle className="text-red-600" />;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="w-full max-w-[1400px] mx-auto bg-white p-10 rounded-xl shadow-md border">
        <h1 className="text-3xl font-bold text-[#052e87] mb-2">
          🌱 Site Suitability Assessment
        </h1>
        <p className="text-gray-600 mb-8">
          GIS-based Multi-Criteria Decision Analysis (MCDA) for reforestation.
        </p>

        <div className="space-y-5">
          {rows.map(({ key, label, options }) => (
            <div key={key} className="grid grid-cols-12 items-center gap-4">
              <label className="col-span-4 font-medium">{label}</label>

              {key === "vegetation" ? (
                <input
                  type="number"
                  className="col-span-6 border rounded-md p-2"
                  value={inputs.vegetation}
                  onChange={(e) =>
                    setInputs({ ...inputs, vegetation: +e.target.value })
                  }
                />
              ) : (
                <select
                  className="col-span-6 border rounded-md p-2"
                  value={(inputs as any)[key]}
                  onChange={(e) =>
                    setInputs({ ...inputs, [key]: e.target.value })
                  }
                >
                  {options!.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              )}

              <div className="col-span-2 flex justify-center">
                {renderStatus(key)}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={analyzeSite}
          disabled={loading}
          className={`w-full mt-10 py-4 rounded-lg text-white font-semibold transition ${
            loading ? "bg-gray-400" : "bg-green-600 hover:bg-green-700"
          }`}
        >
          {loading ? "Analyzing Site..." : "Run Suitability Analysis"}
        </button>

        {score !== null && (
          <div className="mt-8 p-6 border rounded-lg bg-gray-50">
            <h3 className="text-lg font-semibold mb-2">
              Final Score: {score} / 100
            </h3>
            <span
              className={`inline-block px-4 py-1 rounded-full font-semibold ${
                decision.includes("Suitable")
                  ? "bg-green-100 text-green-700"
                  : decision.includes("Conditionally")
                    ? "bg-yellow-100 text-yellow-700"
                    : "bg-red-100 text-red-700"
              }`}
            >
              {decision}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
