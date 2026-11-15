import { polygonAreaHa } from "@/utils/geoArea";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  Edit3,
  GripHorizontal,
  Loader2,
  Pen,
  Plus,
  Save,
  Square,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { HAZARD_TYPES } from "../hooks/useBarangayAreas";
import type { useBarangayAreas } from "../hooks/useBarangayAreas";

interface HazardAreaFormPanelProps {
  barangayAreas: ReturnType<typeof useBarangayAreas>;
  onClose: () => void;
  onSaveSuccess: (message: string) => void;
  onSaveError: (message: string) => void;
}

// Show at most 6 decimals (~0.1 m), without trailing zeros
const fmt = (n: number) => Number(n.toFixed(6));

const inputCls =
  "w-full font-mono border border-gray-300 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-yellow-500";
const fieldCls =
  "w-full text-[11px] border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-yellow-500 bg-white";

// Compact, draggable floating panel for drawing / editing a hazard area.
// It is open the whole time while drawing, so vertices show up as you click.
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
    isDrawingHazard,
    startMapEditMode,
    finishDrawingHazard,
    removeLastHazardPoint,
  } = barangayAreas;

  const isEditMode = !!editingHazardArea;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [hazardType, setHazardType] = useState("LANDSLIDE");
  const [position, setPosition] = useState(() => ({
    x: Math.max(16, window.innerWidth - 420),
    y: 140,
  }));
  const dragOffsetRef = useRef<{ dx: number; dy: number } | null>(null);

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

  // Esc stops drawing
  useEffect(() => {
    if (!isDrawingHazard) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finishDrawingHazard();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isDrawingHazard, finishDrawingHazard]);

  // Dragging the panel by its header
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragOffsetRef.current) return;
      setPosition({
        x: Math.max(
          0,
          Math.min(window.innerWidth - 120, e.clientX - dragOffsetRef.current.dx),
        ),
        y: Math.max(
          0,
          Math.min(window.innerHeight - 60, e.clientY - dragOffsetRef.current.dy),
        ),
      });
    };
    const onUp = () => (dragOffsetRef.current = null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const selectedBarangay = barangayList.find(
    (b) => b.barangay_id === selectedBarangayId,
  );
  const vertexCount = hazardPolygonPoints.length;
  const areaHa = useMemo(
    () => polygonAreaHa(hazardPolygonPoints),
    [hazardPolygonPoints],
  );

  const handleSubmit = async () => {
    if (!name.trim()) {
      onSaveError("Please enter a name for the hazard area.");
      return;
    }
    if (vertexCount < 3) {
      onSaveError("Polygon must have at least 3 vertices.");
      return;
    }
    if (isDrawingHazard) finishDrawingHazard();

    const result =
      isEditMode && editingHazardArea
        ? await updateHazardArea(
            editingHazardArea.hazard_area_id,
            name.trim(),
            description.trim(),
            hazardType,
          )
        : await createHazardArea(name.trim(), description.trim(), hazardType);

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
    value: string,
  ) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return;
    setHazardPolygonPoints(
      hazardPolygonPoints.map((p, i) =>
        i !== index ? p : axis === "lat" ? [numValue, p[1]] : [p[0], numValue],
      ),
    );
  };

  const handleRemoveVertex = (index: number) =>
    setHazardPolygonPoints(hazardPolygonPoints.filter((_, i) => i !== index));

  const handleAddVertex = () => {
    const last = hazardPolygonPoints[vertexCount - 1];
    const newPoint: [number, number] = last
      ? [last[0] + 0.001, last[1] + 0.001]
      : [11.007, 124.602];
    setHazardPolygonPoints([...hazardPolygonPoints, newPoint]);
  };

  const accentHeader = isEditMode ? "bg-blue-50" : "bg-yellow-50";

  return createPortal(
    <div
      style={{ left: position.x, top: position.y }}
      className="fixed z-[1200] w-[380px] max-h-[80vh] flex flex-col bg-white rounded-lg shadow-2xl border border-gray-200"
    >
      {/* Header (drag handle) */}
      <div
        onMouseDown={(e) => {
          if ((e.target as HTMLElement).closest("button")) return;
          dragOffsetRef.current = {
            dx: e.clientX - position.x,
            dy: e.clientY - position.y,
          };
        }}
        className={`flex items-center justify-between px-3 py-2 border-b border-gray-200 ${accentHeader} rounded-t-lg cursor-move select-none`}
      >
        <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5 min-w-0">
          <GripHorizontal size={13} className="text-gray-400 shrink-0" />
          {isEditMode ? (
            <Edit3 size={13} className="text-blue-600 shrink-0" />
          ) : (
            <AlertTriangle size={13} className="text-yellow-600 shrink-0" />
          )}
          <span className="truncate">
            {isEditMode ? "Edit Hazard Area" : "Draw Hazard Area"} ·{" "}
            {selectedBarangay?.name || "No barangay"}
          </span>
        </span>
        <button
          type="button"
          onClick={onClose}
          disabled={isSavingHazard}
          className="text-gray-400 hover:text-gray-600 p-0.5 rounded disabled:opacity-50"
          title="Cancel"
        >
          <X size={14} />
        </button>
      </div>

      {/* Actions */}
      <div className="px-3 py-2 border-b border-gray-100 flex flex-wrap gap-1.5">
        {isDrawingHazard ? (
          <button
            type="button"
            onClick={finishDrawingHazard}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-semibold"
          >
            <Square size={11} /> Stop Drawing
          </button>
        ) : (
          <button
            type="button"
            onClick={startMapEditMode}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-yellow-500 hover:bg-yellow-600 text-white text-[11px] font-semibold"
          >
            <Pen size={11} /> {vertexCount ? "Continue Drawing" : "Start Drawing"}
          </button>
        )}
        <button
          type="button"
          onClick={removeLastHazardPoint}
          disabled={vertexCount === 0}
          className="flex items-center gap-1 px-2.5 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 text-[11px] font-medium disabled:opacity-40"
        >
          <Undo2 size={11} /> Undo
        </button>
        <button
          type="button"
          onClick={() => setHazardPolygonPoints([])}
          disabled={vertexCount === 0}
          className="flex items-center gap-1 px-2.5 py-1 rounded bg-red-50 hover:bg-red-100 text-red-600 text-[11px] font-medium disabled:opacity-40"
        >
          <Trash2 size={11} /> Clear
        </button>
      </div>

      {isDrawingHazard && (
        <p className="px-3 py-1.5 text-[11px] text-yellow-800 bg-yellow-50 border-b border-yellow-100">
          Click on the map to add vertices. Press Esc or "Stop Drawing" when
          done.
        </p>
      )}

      <div className="flex-1 overflow-y-auto px-3 py-2">
        {/* Details */}
        <div className="flex flex-col gap-1.5">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Zone name * (e.g. Landslide Prone Zone A)"
            className={fieldCls}
          />
          <select
            value={hazardType}
            onChange={(e) => setHazardType(e.target.value)}
            className={fieldCls}
          >
            {HAZARD_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            rows={2}
            className={`${fieldCls} resize-none`}
          />
        </div>

        {/* Editable coordinate list */}
        <div className="mt-2 pt-2 border-t border-gray-100">
          {vertexCount === 0 ? (
            <p className="text-[11px] text-gray-400 text-center py-3">
              No vertices yet. Click on the map or add a point manually.
            </p>
          ) : (
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-gray-500 uppercase text-[10px]">
                  <th className="text-left font-semibold w-6">#</th>
                  <th className="text-left font-semibold">Latitude</th>
                  <th className="text-left font-semibold">Longitude</th>
                  <th className="w-6" />
                </tr>
              </thead>
              <tbody>
                {hazardPolygonPoints.map((point, i) => (
                  <tr key={i}>
                    <td className="text-gray-500 font-semibold pr-1">{i + 1}</td>
                    <td className="py-0.5 pr-1">
                      <input
                        type="number"
                        step="any"
                        value={fmt(point[0])}
                        onChange={(e) =>
                          handleVertexChange(i, "lat", e.target.value)
                        }
                        className={inputCls}
                      />
                    </td>
                    <td className="py-0.5 pr-1">
                      <input
                        type="number"
                        step="any"
                        value={fmt(point[1])}
                        onChange={(e) =>
                          handleVertexChange(i, "lng", e.target.value)
                        }
                        className={inputCls}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => handleRemoveVertex(i)}
                        className="text-gray-400 hover:text-red-600 p-0.5"
                        title="Remove vertex"
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <button
            type="button"
            onClick={handleAddVertex}
            className="w-full mt-2 flex items-center justify-center gap-1 py-1 border border-dashed border-gray-300 rounded text-[11px] text-gray-600 hover:bg-gray-50"
          >
            <Plus size={11} /> Add Point
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-gray-200 bg-gray-50 rounded-b-lg flex items-center justify-between gap-2 text-[11px]">
        <span className="text-gray-600">
          <strong className={vertexCount < 3 ? "text-red-600" : undefined}>
            {vertexCount}
          </strong>{" "}
          vertices · Area:{" "}
          <strong className="text-gray-700">
            {vertexCount >= 3 ? `${areaHa.toFixed(2)} ha` : "—"}
          </strong>
        </span>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isSavingHazard}
            className="px-2.5 py-1 rounded text-[11px] text-gray-600 hover:bg-gray-200 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSavingHazard || !name.trim() || vertexCount < 3}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-white text-[11px] font-semibold disabled:opacity-40 ${
              isEditMode
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-yellow-600 hover:bg-yellow-700"
            }`}
            title={
              !name.trim()
                ? "Enter a zone name"
                : vertexCount < 3
                  ? "Need at least 3 vertices"
                  : undefined
            }
          >
            {isSavingHazard ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <Save size={11} />
            )}
            {isEditMode ? "Update" : "Save"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
