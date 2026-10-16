import { useEffect, useState } from "react";
import { Layers, Download } from "lucide-react";

export interface AssessmentBoundaryPolygon {
  id: number;
  label: string;
  coords: [number, number][];
}

interface AssessmentBoundaryImporterProps {
  polygons: AssessmentBoundaryPolygon[];
  onApply: (assessmentId: number) => void;
  accent?: "green" | "orange";
}

export default function AssessmentBoundaryImporter({
  polygons,
  onApply,
  accent = "green",
}: AssessmentBoundaryImporterProps) {
  const [selectedId, setSelectedId] = useState<number | "">("");

  // Reset the selection if that assessment is no longer loaded
  useEffect(() => {
    if (selectedId !== "" && !polygons.some((p) => p.id === selectedId))
      setSelectedId("");
  }, [polygons, selectedId]);

  const buttonClass =
    accent === "orange"
      ? "bg-orange-500 hover:bg-orange-600"
      : "bg-green-600 hover:bg-green-700";

  return (
    <div className="mb-3 p-3 rounded-lg border border-purple-200 bg-purple-50">
      <div className="flex items-center gap-1.5 mb-2">
        <Layers size={13} className="text-purple-700" />
        <span className="text-[11px] font-bold text-purple-800 uppercase tracking-wide">
          Use Boundary from Field Assessment
        </span>
      </div>
      {polygons.length === 0 ? (
        <p className="text-[11px] text-purple-700/80">
          No loaded field assessment has a boundary polygon. Open the L1/L2/L3
          tabs in Field Assessments to load them.
        </p>
      ) : (
        <div className="flex gap-2">
          <select
            value={selectedId}
            onChange={(e) =>
              setSelectedId(e.target.value ? Number(e.target.value) : "")
            }
            className="flex-1 min-w-0 text-xs border border-purple-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-purple-500"
          >
            <option value="">Select an assessment…</option>
            {polygons.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={selectedId === ""}
            onClick={() => selectedId !== "" && onApply(selectedId)}
            className={`flex items-center gap-1 px-3 py-1.5 text-white text-xs font-semibold rounded disabled:opacity-50 disabled:cursor-not-allowed ${buttonClass}`}
          >
            <Download size={12} /> Use
          </button>
        </div>
      )}
    </div>
  );
}
