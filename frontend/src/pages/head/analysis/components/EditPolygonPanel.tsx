import { polygonAreaHa } from "@/utils/geoArea";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Download,
  GripHorizontal,
  Layers,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Save,
  Target,
  Trash2,
  X,
} from "lucide-react";
import type { AssessmentBoundaryPolygon } from "./AssessmentBoundaryImporter";

interface EditPolygonPanelProps {
  siteName: string;
  coordinates: [number, number][];
  center: [number, number] | null;
  boundaryPolygons: AssessmentBoundaryPolygon[];
  isPickingMarker: boolean;
  isSaving: boolean;
  onVertexChange: (index: number, axis: "lat" | "lng", value: string) => void;
  onRemoveVertex: (index: number) => void;
  onAddVertex: () => void;
  onCenterChange: (axis: "lat" | "lng", value: string) => void;
  onApplyBoundary: (assessmentId: number) => void;
  onAutoMarker: () => void;
  onTogglePickMarker: () => void;
  onSave: () => void;
  onClose: () => void;
}

// Show at most 6 decimals (~0.1 m), without trailing zeros
const fmt = (n: number) => Number(n.toFixed(6));

const inputCls =
  "w-full font-mono border border-gray-300 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-orange-500";

// Compact, draggable floating panel for editing an existing site's polygon
export default function EditPolygonPanel({
  siteName,
  coordinates,
  center,
  boundaryPolygons,
  isPickingMarker,
  isSaving,
  onVertexChange,
  onRemoveVertex,
  onAddVertex,
  onCenterChange,
  onApplyBoundary,
  onAutoMarker,
  onTogglePickMarker,
  onSave,
  onClose,
}: EditPolygonPanelProps) {
  const [position, setPosition] = useState(() => ({
    x: Math.max(16, window.innerWidth - 420),
    y: 140,
  }));
  const [boundaryId, setBoundaryId] = useState<number | "">("");
  const dragOffsetRef = useRef<{ dx: number; dy: number } | null>(null);

  const areaHa = useMemo(() => polygonAreaHa(coordinates), [coordinates]);

  // Reset the boundary selection if that assessment is no longer loaded
  useEffect(() => {
    if (boundaryId !== "" && !boundaryPolygons.some((p) => p.id === boundaryId))
      setBoundaryId("");
  }, [boundaryPolygons, boundaryId]);

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

  const canSave = !isSaving && !!center && coordinates.length >= 3;

  return createPortal(
    <div
      style={{ left: position.x, top: position.y }}
      className="fixed z-[1200] w-[380px] max-h-[75vh] flex flex-col bg-white rounded-lg shadow-2xl border border-gray-200"
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
        className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-orange-50 rounded-t-lg cursor-move select-none"
      >
        <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5 min-w-0">
          <GripHorizontal size={13} className="text-gray-400 shrink-0" />
          <Pencil size={13} className="text-orange-600 shrink-0" />
          <span className="truncate">Edit Polygon · {siteName}</span>
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 p-0.5 rounded"
          title="Close"
        >
          <X size={14} />
        </button>
      </div>

      {/* Actions */}
      <div className="px-3 py-2 border-b border-gray-100 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={onAutoMarker}
          disabled={coordinates.length < 3}
          className="flex items-center gap-1 px-2.5 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 text-[11px] font-medium disabled:opacity-40"
          title="Place the site marker at the polygon center"
        >
          <Target size={11} /> Auto Marker
        </button>
        <button
          type="button"
          onClick={onTogglePickMarker}
          className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium ${
            isPickingMarker
              ? "bg-amber-500 hover:bg-amber-600 text-white"
              : "bg-gray-100 hover:bg-gray-200 text-gray-700"
          }`}
        >
          <MapPin size={11} /> {isPickingMarker ? "Cancel Pick" : "Pick Marker"}
        </button>
      </div>

      {isPickingMarker && (
        <p className="px-3 py-1.5 text-[11px] text-orange-700 bg-orange-50 border-b border-orange-100">
          Click the map or an assessment marker to place the site marker.
        </p>
      )}

      {/* Boundary from field assessment */}
      {boundaryPolygons.length > 0 && (
        <div className="px-3 py-2 border-b border-gray-100">
          <p className="text-[10px] font-semibold uppercase text-gray-500 mb-1 flex items-center gap-1">
            <Layers size={11} /> Use field assessment boundary
          </p>
          <div className="flex gap-1.5">
            <select
              value={boundaryId}
              onChange={(e) =>
                setBoundaryId(e.target.value ? Number(e.target.value) : "")
              }
              className="flex-1 min-w-0 text-[11px] border border-gray-300 rounded px-1.5 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-orange-500"
            >
              <option value="">Select an assessment…</option>
              {boundaryPolygons.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={boundaryId === ""}
              onClick={() => boundaryId !== "" && onApplyBoundary(boundaryId)}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-orange-500 hover:bg-orange-600 text-white text-[11px] font-semibold disabled:opacity-40"
            >
              <Download size={11} /> Use
            </button>
          </div>
        </div>
      )}

      {/* Editable coordinate list */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {coordinates.length === 0 ? (
          <p className="text-[11px] text-gray-400 text-center py-4">
            No vertices yet. Add a point below.
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
              {coordinates.map((point, i) => (
                <tr key={i}>
                  <td className="text-gray-500 font-semibold pr-1">{i + 1}</td>
                  <td className="py-0.5 pr-1">
                    <input
                      type="number"
                      step="any"
                      value={fmt(point[0])}
                      onChange={(e) => onVertexChange(i, "lat", e.target.value)}
                      className={inputCls}
                    />
                  </td>
                  <td className="py-0.5 pr-1">
                    <input
                      type="number"
                      step="any"
                      value={fmt(point[1])}
                      onChange={(e) => onVertexChange(i, "lng", e.target.value)}
                      className={inputCls}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => onRemoveVertex(i)}
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
          onClick={onAddVertex}
          className="w-full mt-2 flex items-center justify-center gap-1 py-1 border border-dashed border-gray-300 rounded text-[11px] text-gray-600 hover:bg-gray-50"
        >
          <Plus size={11} /> Add Point
        </button>

        {/* Site marker */}
        <p className="mt-3 mb-1 text-[10px] font-semibold uppercase text-gray-500 flex items-center gap-1">
          <MapPin size={11} className="text-orange-600" /> Site Marker
        </p>
        <div className="grid grid-cols-2 gap-1 text-[11px]">
          <input
            type="number"
            step="any"
            placeholder="Latitude"
            value={center ? fmt(center[0]) : ""}
            onChange={(e) => onCenterChange("lat", e.target.value)}
            className={inputCls}
          />
          <input
            type="number"
            step="any"
            placeholder="Longitude"
            value={center ? fmt(center[1]) : ""}
            onChange={(e) => onCenterChange("lng", e.target.value)}
            className={inputCls}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-gray-200 bg-gray-50 rounded-b-lg flex items-center justify-between gap-2 text-[11px]">
        <span className="text-gray-600">
          <strong>{coordinates.length}</strong> vertices · Area:{" "}
          <strong className="text-gray-700">
            {coordinates.length >= 3 ? `${areaHa.toFixed(2)} ha` : "—"}
          </strong>
        </span>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={onClose}
            className="px-2.5 py-1 rounded text-[11px] text-gray-600 hover:bg-gray-200"
          >
            Close
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!canSave}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-green-600 hover:bg-green-700 text-white text-[11px] font-semibold disabled:opacity-40"
          >
            {isSaving ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <Save size={11} />
            )}
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
