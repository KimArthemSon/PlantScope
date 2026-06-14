import { Flag, Shield, MapPin } from "lucide-react";
import type { useBarangayAreas } from "./hooks/useBarangayAreas";

interface BarangayAreasPanelProps {
  barangayAreas: ReturnType<typeof useBarangayAreas>;
}

export default function BarangayAreasPanel({ barangayAreas }: BarangayAreasPanelProps) {
  const {
    barangayList, selectedBarangayId, showClassified, showHazards,
    classifiedAreas, hazardAreas, selectBarangay, setShowClassified, 
    setShowHazards, flyToBarangay,
  } = barangayAreas;

  return (
    <div className="flex items-center gap-1.5">
      <div className="w-px h-5 bg-gray-200 mx-0.5" />
      <select
        value={selectedBarangayId || ""}
        onChange={(e) => selectBarangay(e.target.value ? Number(e.target.value) : null)}
        className="text-xs border border-gray-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-green-500 min-w-[140px]"
      >
        <option value="">Filter by Barangay</option>
        {barangayList.map((b) => (
          <option key={b.barangay_id} value={b.barangay_id}>{b.name}</option>
        ))}
      </select>

      {selectedBarangayId && (
        <>
          <button
            onClick={flyToBarangay}
            className="flex items-center gap-1 px-2 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded transition text-xs font-medium border border-blue-200"
            title="Fly to barangay"
          >
            <MapPin size={12} />
          </button>
          <button
            onClick={() => setShowClassified(!showClassified)}
            className={`flex items-center gap-1 px-2 py-1.5 rounded transition text-xs font-medium
              ${showClassified ? "bg-red-600 hover:bg-red-700 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-700"}`}
            title="Toggle Classified Areas"
          >
            <Flag size={12} /> {classifiedAreas.length}
          </button>
          <button
            onClick={() => setShowHazards(!showHazards)}
            className={`flex items-center gap-1 px-2 py-1.5 rounded transition text-xs font-medium
              ${showHazards ? "bg-yellow-500 hover:bg-yellow-600 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-700"}`}
            title="Toggle Hazard Areas"
          >
            <Shield size={12} /> {hazardAreas.length}
          </button>
        </>
      )}
    </div>
  );
}