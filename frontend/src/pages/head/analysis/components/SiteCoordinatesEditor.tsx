import { useState } from "react";
import { Trash2, Plus, Navigation, MapPin } from "lucide-react";

interface SiteCoordinatesEditorProps {
  coordinates: [number, number][];
  center?: [number, number] | null;
  onVertexChange: (index: number, axis: "lat" | "lng", value: string) => void;
  onRemoveVertex: (index: number) => void;
  onAddVertex: () => void;
  onCenterChange?: (axis: "lat" | "lng", value: string) => void;
  title: string;
  isEditing?: boolean; // true for orange (update), false for green (create)
}

export default function SiteCoordinatesEditor({
  coordinates,
  center,
  onVertexChange,
  onRemoveVertex,
  onAddVertex,
  onCenterChange,
  title,
  isEditing = false,
}: SiteCoordinatesEditorProps) {
  const [showCoords, setShowCoords] = useState(true);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden flex flex-col bg-white shadow-sm">
      {/* Header */}
      <button
        onClick={() => setShowCoords(!showCoords)}
        className="bg-gradient-to-r from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200 px-4 py-2.5 flex items-center justify-between transition border-b border-gray-200"
      >
        <div className="flex items-center gap-2">
          <Navigation size={14} className="text-gray-600" />
          <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">
            {title}
          </span>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              isEditing
                ? "bg-orange-100 text-orange-700"
                : "bg-green-100 text-green-700"
            }`}
          >
            {coordinates.length} pts
          </span>
        </div>
        <span className="text-xs text-gray-500">
          {showCoords ? "▲ Collapse" : "▼ Expand"}
        </span>
      </button>

      {/* Content */}
      {showCoords && (
        <div className="p-3 bg-white max-h-[300px] overflow-y-auto">
          <div className="flex flex-col gap-2">
            {coordinates.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-4">
                No vertices yet. Draw on the map or add manually below.
              </p>
            ) : (
              coordinates.map((point, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-lg px-3 py-2 hover:border-gray-300 transition group"
                >
                  <span
                    className={`text-[10px] font-bold min-w-[28px] h-6 flex items-center justify-center rounded-full ${
                      isEditing
                        ? "bg-orange-100 text-orange-700"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    V{i + 1}
                  </span>
                  <div className="flex-1 flex gap-1.5">
                    <div className="flex-1">
                      <label className="text-[9px] text-gray-500 font-medium block mb-0.5">
                        Latitude
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={point[0]}
                        onChange={(e) => onVertexChange(i, "lat", e.target.value)}
                        className="w-full text-[11px] border border-gray-200 rounded px-1.5 py-1 font-mono focus:outline-none focus:ring-1 focus:ring-green-500 bg-white"
                        placeholder="11.007"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-[9px] text-gray-500 font-medium block mb-0.5">
                        Longitude
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={point[1]}
                        onChange={(e) => onVertexChange(i, "lng", e.target.value)}
                        className="w-full text-[11px] border border-gray-200 rounded px-1.5 py-1 font-mono focus:outline-none focus:ring-1 focus:ring-green-500 bg-white"
                        placeholder="124.602"
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => onRemoveVertex(i)}
                    disabled={coordinates.length <= 3}
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 disabled:opacity-30 disabled:cursor-not-allowed transition"
                    title="Remove vertex"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))
            )}

            {/* Add Vertex Button */}
            <button
              onClick={onAddVertex}
              className={`flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-lg border-2 border-dashed transition ${
                isEditing
                  ? "text-orange-600 border-orange-300 bg-orange-50 hover:bg-orange-100"
                  : "text-green-600 border-green-300 bg-green-50 hover:bg-green-100"
              }`}
            >
              <Plus size={14} />
              Add Vertex Manually
            </button>
          </div>

          {/* Center Coordinate (Only for Editing) */}
          {isEditing && center && onCenterChange && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-2 mb-2">
                <MapPin size={14} className="text-orange-600" />
                <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                  Center Coordinate
                </span>
              </div>
              <div className="flex gap-1.5">
                <div className="flex-1">
                  <label className="text-[9px] text-gray-500 font-medium block mb-0.5">
                    Latitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={center[0]}
                    onChange={(e) => onCenterChange("lat", e.target.value)}
                    className="w-full text-[11px] border border-gray-200 rounded px-1.5 py-1 font-mono focus:outline-none focus:ring-1 focus:ring-orange-500 bg-white"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[9px] text-gray-500 font-medium block mb-0.5">
                    Longitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={center[1]}
                    onChange={(e) => onCenterChange("lng", e.target.value)}
                    className="w-full text-[11px] border border-gray-200 rounded px-1.5 py-1 font-mono focus:outline-none focus:ring-1 focus:ring-orange-500 bg-white"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}