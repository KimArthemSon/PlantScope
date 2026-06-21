import { useState, useEffect } from "react";
import {
  X,
  Save,
  MapPin,
  AlertTriangle,
  Info,
  Loader2,
  Trash2,
  Plus,
  Edit3,
  Navigation,
  Target,
} from "lucide-react";
import { HAZARD_TYPES } from "../hooks/useBarangayAreas";
import type { useBarangayAreas } from "../hooks/useBarangayAreas";


interface HazardAreaFormPanelProps {
  barangayAreas: ReturnType<typeof useBarangayAreas>;
  onClose: () => void;
  onSaveSuccess: (message: string) => void;
  onSaveError: (message: string) => void;
}

export default function HazardAreaFormPanel({
  barangayAreas,
  onClose,
  onSaveSuccess,
  onSaveError,
}: HazardAreaFormPanelProps) {
  const {
    selectedBarangayId,
    barangayList,
    isSavingHazard,
    createHazardArea,
    updateHazardArea,
    editingHazardArea,
    hazardPolygonPoints,
    setHazardPolygonPoints,
    startMapEditMode,
  } = barangayAreas;

  const isEditMode = !!editingHazardArea;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [hazardType, setHazardType] = useState("LANDSLIDE");
  const [showCoords, setShowCoords] = useState(true);

  // Pre-fill form when editing
  useEffect(() => {
    if (editingHazardArea) {
      setName(editingHazardArea.name);
      setDescription(editingHazardArea.description || "");
      setHazardType(editingHazardArea.hazard_type);
    } else {
      setName("");
      setDescription("");
      setHazardType("LANDSLIDE");
    }
  }, [editingHazardArea]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSavingHazard) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose, isSavingHazard]);

  const selectedBarangay = barangayList.find(
    (b) => b.barangay_id === selectedBarangayId
  );
  // ✅ FIX: Use hazardPolygonPoints instead of completedHazardPolygon
  const vertexCount = hazardPolygonPoints.length;

  const handleSubmit = async () => {
    if (!name.trim()) {
      onSaveError("Please enter a name for the hazard area.");
      return;
    }
    if (vertexCount < 3) {
      onSaveError("Polygon must have at least 3 vertices.");
      return;
    }

    let result;
    if (isEditMode && editingHazardArea) {
      result = await updateHazardArea(
        editingHazardArea.hazard_area_id,
        name.trim(),
        description.trim(),
        hazardType
      );
    } else {
      result = await createHazardArea(
        name.trim(),
        description.trim(),
        hazardType
      );
    }

    if (result.success) {
      onSaveSuccess(result.message || (isEditMode ? "Updated!" : "Created!"));
      onClose();
    } else {
      onSaveError(result.message || "Operation failed.");
    }
  };

  const handleVertexChange = (
    index: number,
    axis: "lat" | "lng",
    value: string
  ) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return;

    const newPoints = [...hazardPolygonPoints];
    if (axis === "lat") {
      newPoints[index] = [numValue, newPoints[index][1]];
    } else {
      newPoints[index] = [newPoints[index][0], numValue];
    }
    setHazardPolygonPoints(newPoints);
  };

  const handleRemoveVertex = (index: number) => {
    if (vertexCount <= 3) {
      onSaveError("Polygon must have at least 3 vertices.");
      return;
    }
    const newPoints = hazardPolygonPoints.filter((_, i) => i !== index);
    setHazardPolygonPoints(newPoints);
  };

  const handleAddVertex = () => {
    if (vertexCount === 0) {
      setHazardPolygonPoints([[11.007, 124.602]]);
      return;
    }
    const lastPoint = hazardPolygonPoints[vertexCount - 1];
    const newPoint: [number, number] = [
      lastPoint[0] + 0.001,
      lastPoint[1] + 0.001,
    ];
    setHazardPolygonPoints([...hazardPolygonPoints, newPoint]);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isSavingHazard) {
      onClose();
    }
  };

  return (
    <div
      onClick={handleBackdropClick}
      className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn"
    >
      <div
        className={`bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-slideUp ${
          isEditMode ? "ring-2 ring-blue-400" : "ring-2 ring-yellow-400"
        }`}
      >
        {/* ── Modal Header ─────────────────────────────────────────────── */}
        <div
          className={`px-6 py-4 flex items-center justify-between flex-shrink-0 ${
            isEditMode
              ? "bg-gradient-to-r from-blue-600 to-blue-700"
              : "bg-gradient-to-r from-yellow-500 to-yellow-600"
          } text-white`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
              {isEditMode ? <Edit3 size={20} /> : <AlertTriangle size={20} />}
            </div>
            <div>
              <h2 className="text-lg font-bold">
                {isEditMode ? "Edit Hazard Area" : "Create Hazard Area"}
              </h2>
              <p className="text-xs text-white/80">
                {isEditMode
                  ? `Editing: ${editingHazardArea?.name}`
                  : "Fill in the details below"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSavingHazard}
            className="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center transition disabled:opacity-50"
            title="Close (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Modal Body ───────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left Column: Form Fields */}
            <div className="flex flex-col gap-4">
              {/* Barangay Info Card */}
              <div
                className={`rounded-lg p-3 flex items-center gap-3 border ${
                  isEditMode
                    ? "bg-blue-50 border-blue-200"
                    : "bg-yellow-50 border-yellow-200"
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center ${
                    isEditMode ? "bg-blue-200" : "bg-yellow-200"
                  }`}
                >
                  <MapPin
                    size={16}
                    className={isEditMode ? "text-blue-700" : "text-yellow-700"}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-[10px] font-semibold uppercase tracking-wide ${
                      isEditMode ? "text-blue-600" : "text-yellow-600"
                    }`}
                  >
                    Assigned Barangay
                  </p>
                  <p
                    className={`text-sm font-bold truncate ${
                      isEditMode ? "text-blue-900" : "text-yellow-900"
                    }`}
                  >
                    {selectedBarangay?.name || "None"}
                  </p>
                </div>
              </div>

              {/* Name Field */}
              <div>
                <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wide mb-1.5 block">
                  Zone Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Landslide Prone Zone A"
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition"
                  autoFocus
                />
              </div>

              {/* Hazard Type */}
              <div>
                <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wide mb-1.5 block">
                  Hazard Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={hazardType}
                  onChange={(e) => setHazardType(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 bg-white transition"
                >
                  {HAZARD_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wide mb-1.5 block">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe this hazard area..."
                  rows={3}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 resize-none transition"
                />
              </div>

              {/* Stats Card */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target
                      size={16}
                      className={isEditMode ? "text-blue-600" : "text-yellow-600"}
                    />
                    <span className="text-xs font-semibold text-gray-700">
                      Polygon Vertices
                    </span>
                  </div>
                  <span
                    className={`text-lg font-bold ${
                      vertexCount >= 3
                        ? isEditMode
                          ? "text-blue-600"
                          : "text-yellow-600"
                        : "text-red-500"
                    }`}
                  >
                    {vertexCount}
                  </span>
                </div>
                {vertexCount < 3 && (
                  <p className="text-[10px] text-red-500 mt-1 flex items-center gap-1">
                    <Info size={10} />
                    Need at least 3 vertices to save
                  </p>
                )}
              </div>
            </div>

            {/* Right Column: Coordinates */}
            <div className="flex flex-col">
              <div className="border border-gray-200 rounded-lg overflow-hidden flex flex-col h-full">
                {/* Coordinates Header */}
                <button
                  onClick={() => setShowCoords(!showCoords)}
                  className="bg-gradient-to-r from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200 px-4 py-2.5 flex items-center justify-between transition border-b border-gray-200"
                >
                  <div className="flex items-center gap-2">
                    <Navigation size={14} className="text-gray-600" />
                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                      Vertex Coordinates
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isEditMode
                          ? "bg-blue-100 text-blue-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {vertexCount} pts
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {showCoords ? "▲ Collapse" : "▼ Expand"}
                  </span>
                </button>

                {/* Coordinates List */}
                {showCoords && (
                  <div className="flex-1 overflow-y-auto p-3 bg-white min-h-[200px] max-h-[300px]">
                    {vertexCount === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center py-8">
                        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-2">
                          <MapPin size={20} className="text-gray-400" />
                        </div>
                        <p className="text-xs text-gray-500 font-medium">
                          No vertices yet
                        </p>
                        <p className="text-[10px] text-gray-400 mt-1">
                          Draw on the map or add manually below
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {hazardPolygonPoints.map((point, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-2 bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-lg px-3 py-2 hover:border-gray-300 transition group"
                          >
                            <span
                              className={`text-[10px] font-bold min-w-[28px] h-6 flex items-center justify-center rounded-full ${
                                isEditMode
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-yellow-100 text-yellow-700"
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
                                  onChange={(e) =>
                                    handleVertexChange(i, "lat", e.target.value)
                                  }
                                  className="w-full text-[11px] border border-gray-200 rounded px-1.5 py-1 font-mono focus:outline-none focus:ring-1 focus:ring-yellow-500 bg-white"
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
                                  onChange={(e) =>
                                    handleVertexChange(i, "lng", e.target.value)
                                  }
                                  className="w-full text-[11px] border border-gray-200 rounded px-1.5 py-1 font-mono focus:outline-none focus:ring-1 focus:ring-yellow-500 bg-white"
                                  placeholder="124.602"
                                />
                              </div>
                            </div>
                            <button
                              onClick={() => handleRemoveVertex(i)}
                              disabled={vertexCount <= 3}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 disabled:opacity-30 disabled:cursor-not-allowed transition"
                              title="Remove vertex"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}

                        {/* Add Vertex Button */}
                        <button
                          onClick={handleAddVertex}
                          className={`flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-lg border-2 border-dashed transition ${
                            isEditMode
                              ? "text-blue-600 border-blue-300 bg-blue-50 hover:bg-blue-100"
                              : "text-yellow-600 border-yellow-300 bg-yellow-50 hover:bg-yellow-100"
                          }`}
                        >
                          <Plus size={14} />
                          Add Vertex Manually
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Modal Footer ─────────────────────────────────────────────── */}
        <div className="border-t border-gray-200 px-6 py-3 flex items-center justify-between flex-shrink-0 bg-gray-50">
          <div className="flex items-center gap-2">
            <p className="text-[10px] text-gray-500 italic">
              💡 Press{" "}
              <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-[9px] font-mono">
                Esc
              </kbd>{" "}
              to close
            </p>
            {/* ✅ NEW: Add Vertices on Map button (only in edit mode) */}
            {isEditMode && (
              <button
                onClick={() => {
                  startMapEditMode();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-semibold rounded-lg transition border border-blue-200"
                title="Hide form and click on map to add vertices"
              >
                <Navigation size={12} />
                Add Vertices on Map
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={isSavingHazard}
              className="px-4 py-2 bg-white hover:bg-gray-100 text-gray-700 text-xs font-semibold rounded-lg transition border border-gray-300 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSavingHazard || !name.trim() || vertexCount < 3}
              className={`flex items-center justify-center gap-1.5 px-5 py-2 text-white text-xs font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm ${
                isEditMode
                  ? "bg-blue-600 hover:bg-blue-700"
                  : "bg-yellow-600 hover:bg-yellow-700"
              }`}
            >
              {isSavingHazard ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Saving...
                </>
              ) : isEditMode ? (
                <>
                  <Save size={14} /> Update Hazard Area
                </>
              ) : (
                <>
                  <Save size={14} /> Create Hazard Area
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── Animations ─────────────────────────────────────────────────── */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { 
            opacity: 0; 
            transform: translateY(20px) scale(0.95); 
          }
          to { 
            opacity: 1; 
            transform: translateY(0) scale(1); 
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
        .animate-slideUp {
          animation: slideUp 0.25s ease-out;
        }
      `}</style>
    </div>
  );
}