import { polygonAreaHa } from "@/utils/geoArea";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import { createPortal } from "react-dom";
import L from "leaflet";
import {
  ClipboardCopy,
  ClipboardPaste,
  Eye,
  EyeOff,
  GripHorizontal,
  Hexagon,
  Maximize2,
  Pen,
  Plus,
  Square,
  Trash2,
  X,
} from "lucide-react";

interface DrawPolygonToolProps {
  mapRef: MutableRefObject<L.Map | null>;
}

// Coordinates are kept as strings so the user can type freely (e.g. "11.")
interface PointRow {
  lat: string;
  lng: string;
}

const COLOR = "#0EA5E9";

const toRow = (lat: number, lng: number): PointRow => ({
  lat: lat.toFixed(6),
  lng: lng.toFixed(6),
});

const parseRow = (row: PointRow): [number, number] | null => {
  const lat = parseFloat(row.lat);
  const lng = parseFloat(row.lng);
  if (isNaN(lat) || isNaN(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return [lat, lng];
};

// Geodesic area (same method as Google Earth)
const calculateAreaHa = (coords: [number, number][]): number =>
  polygonAreaHa(coords);

// Accepts one "lat, lng" pair per line (comma, space, tab or semicolon separated)
const parseBulk = (text: string): PointRow[] =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim().split(/[\s,;]+/).filter(Boolean))
    .filter((parts) => parts.length >= 2)
    .map(([lat, lng]) => ({ lat, lng }))
    .filter((row) => parseRow(row) !== null);

export default function DrawPolygonTool({ mapRef }: DrawPolygonToolProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [isDrawing, setIsDrawing] = useState(false);
  const [rows, setRows] = useState<PointRow[]>([]);
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [copied, setCopied] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [hasPosition, setHasPosition] = useState(false);

  const shapeRef = useRef<L.Polygon | L.Polyline | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const dragOffsetRef = useRef<{ dx: number; dy: number } | null>(null);

  // Only rows with valid numbers are drawn; index map keeps marker → row link
  const validPoints = useMemo(
    () =>
      rows
        .map((row, index) => ({ coord: parseRow(row), index }))
        .filter(
          (p): p is { coord: [number, number]; index: number } =>
            p.coord !== null,
        ),
    [rows],
  );
  const coords = useMemo(() => validPoints.map((p) => p.coord), [validPoints]);
  const areaHa = useMemo(() => calculateAreaHa(coords), [coords]);

  const clearLayers = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    if (shapeRef.current) map.removeLayer(shapeRef.current);
    shapeRef.current = null;
    markersRef.current.forEach((m) => map.removeLayer(m));
    markersRef.current = [];
  }, [mapRef]);

  // Redraw the polygon and its draggable vertices whenever the points change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    clearLayers();
    if (!isVisible || coords.length === 0) return;

    const style = {
      color: COLOR,
      weight: 3,
      fillColor: COLOR,
      fillOpacity: 0.2,
      dashArray: isDrawing ? "6, 6" : undefined,
    };
    shapeRef.current =
      coords.length >= 3
        ? L.polygon(coords, style).addTo(map)
        : L.polyline(coords, style).addTo(map);

    validPoints.forEach(({ coord, index }, i) => {
      const marker = L.marker(coord, {
        draggable: true,
        icon: L.divIcon({
          className: "draw-polygon-vertex",
          html: `<div style="background:${COLOR};width:20px;height:20px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:10px;color:white;font-weight:bold;cursor:grab;">${index + 1}</div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        }),
      }).addTo(map);
      marker.bindTooltip("Drag to move", { direction: "top" });
      // Move the outline live while dragging, commit to state on drop
      marker.on("drag", (e) => {
        const ll = (e.target as L.Marker).getLatLng();
        const live = [...coords];
        live[i] = [ll.lat, ll.lng];
        shapeRef.current?.setLatLngs(live);
      });
      marker.on("dragend", (e) => {
        const ll = (e.target as L.Marker).getLatLng();
        setRows((prev) =>
          prev.map((r, ri) => (ri === index ? toRow(ll.lat, ll.lng) : r)),
        );
      });
      markersRef.current.push(marker);
    });
  }, [coords, validPoints, isVisible, isDrawing, mapRef, clearLayers]);

  // Remove layers when the page unmounts
  useEffect(() => clearLayers, [clearLayers]);

  // Click-to-add vertices while in drawing mode
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isDrawing) return;
    const handleClick = (e: L.LeafletMouseEvent) =>
      setRows((prev) => [...prev, toRow(e.latlng.lat, e.latlng.lng)]);
    const container = map.getContainer();
    container.style.cursor = "crosshair";
    map.doubleClickZoom.disable();
    map.on("click", handleClick);
    return () => {
      map.off("click", handleClick);
      map.doubleClickZoom.enable();
      container.style.cursor = "";
    };
  }, [isDrawing, mapRef]);

  // Esc stops drawing
  useEffect(() => {
    if (!isDrawing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsDrawing(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isDrawing]);

  // Dragging the floating modal by its header
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

  const openModal = () => {
    if (!hasPosition) {
      setPosition({ x: Math.max(16, window.innerWidth - 400), y: 140 });
      setHasPosition(true);
    }
    setIsOpen(true);
  };

  const startDrawing = () => {
    setIsVisible(true);
    setIsDrawing(true);
  };

  const updateRow = (index: number, field: keyof PointRow, value: string) => {
    // Pasting "lat, lng" into one field fills both
    const parts = value.trim().split(/[\s,;]+/).filter(Boolean);
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== index) return r;
        if (parts.length === 2) return { lat: parts[0], lng: parts[1] };
        return { ...r, [field]: value };
      }),
    );
  };

  const addRow = () => {
    const center = mapRef.current?.getCenter();
    setRows((prev) => [
      ...prev,
      center ? toRow(center.lat, center.lng) : { lat: "", lng: "" },
    ]);
  };

  const removeRow = (index: number) =>
    setRows((prev) => prev.filter((_, i) => i !== index));

  const clearAll = () => {
    setRows([]);
    setIsDrawing(false);
  };

  const zoomToPolygon = () => {
    if (!mapRef.current || coords.length === 0) return;
    setIsVisible(true);
    if (coords.length === 1) mapRef.current.setView(coords[0], 17);
    else
      mapRef.current.fitBounds(L.latLngBounds(coords), {
        padding: [40, 40],
        maxZoom: 18,
      });
  };

  const applyPaste = () => {
    const parsed = parseBulk(pasteText);
    if (parsed.length === 0) return;
    setRows(parsed);
    setPasteText("");
    setShowPaste(false);
    setIsVisible(true);
  };

  const copyCoordinates = async () => {
    const text = coords.map(([lat, lng]) => `${lat}, ${lng}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard not available */
    }
  };

  const invalidCount = rows.length - validPoints.length;

  return (
    <>
      <button
        type="button"
        onClick={() => (isOpen ? setIsOpen(false) : openModal())}
        className={`flex items-center gap-1 px-3 py-1.5 rounded transition text-xs font-medium ${
          isOpen || isDrawing
            ? "bg-sky-600 hover:bg-sky-700 text-white"
            : "bg-gray-100 hover:bg-gray-200 text-gray-700"
        }`}
        title="Draw a polygon and edit its coordinates"
      >
        <Hexagon size={12} /> Draw Polygon
        {rows.length > 0 && !isOpen && (
          <span className="ml-0.5 px-1.5 rounded-full bg-sky-500 text-white text-[10px]">
            {validPoints.length}
          </span>
        )}
      </button>

      {isOpen &&
        createPortal(
          <div
            style={{ left: position.x, top: position.y }}
            className="fixed z-[1200] w-[360px] max-h-[75vh] flex flex-col bg-white rounded-lg shadow-2xl border border-gray-200"
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
              className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-sky-50 rounded-t-lg cursor-move select-none"
            >
              <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                <GripHorizontal size={13} className="text-gray-400" />
                <Hexagon size={13} className="text-sky-600" /> Draw Polygon
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setIsVisible((v) => !v)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${
                    isVisible
                      ? "bg-sky-100 text-sky-700 hover:bg-sky-200"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                  title={isVisible ? "Hide on map" : "Show on map"}
                >
                  {isVisible ? <Eye size={12} /> : <EyeOff size={12} />}
                  {isVisible ? "Shown" : "Hidden"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    setIsDrawing(false);
                  }}
                  className="text-gray-400 hover:text-gray-600 p-0.5 rounded"
                  title="Close (polygon stays on the map)"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="px-3 py-2 border-b border-gray-100 flex flex-wrap gap-1.5">
              {isDrawing ? (
                <button
                  type="button"
                  onClick={() => setIsDrawing(false)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-semibold"
                >
                  <Square size={11} /> Stop Drawing
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startDrawing}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-semibold"
                >
                  <Pen size={11} /> {rows.length ? "Continue Drawing" : "Start Drawing"}
                </button>
              )}
              <button
                type="button"
                onClick={zoomToPolygon}
                disabled={coords.length === 0}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 text-[11px] font-medium disabled:opacity-40"
              >
                <Maximize2 size={11} /> Zoom To
              </button>
              <button
                type="button"
                onClick={() => setShowPaste((s) => !s)}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 text-[11px] font-medium"
              >
                <ClipboardPaste size={11} /> Paste
              </button>
              <button
                type="button"
                onClick={copyCoordinates}
                disabled={coords.length === 0}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 text-[11px] font-medium disabled:opacity-40"
              >
                <ClipboardCopy size={11} /> {copied ? "Copied!" : "Copy"}
              </button>
              <button
                type="button"
                onClick={clearAll}
                disabled={rows.length === 0}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-red-50 hover:bg-red-100 text-red-600 text-[11px] font-medium disabled:opacity-40"
              >
                <Trash2 size={11} /> Clear
              </button>
            </div>

            {isDrawing && (
              <p className="px-3 py-1.5 text-[11px] text-sky-700 bg-sky-50 border-b border-sky-100">
                Click on the map to add vertices. Press Esc or "Stop Drawing" when done.
              </p>
            )}

            {showPaste && (
              <div className="px-3 py-2 border-b border-gray-100">
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  rows={4}
                  placeholder={"One \"lat, lng\" per line\n11.0086, 124.6086\n11.0090, 124.6100"}
                  className="w-full text-[11px] font-mono border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
                <div className="flex justify-end gap-1.5 mt-1">
                  <button
                    type="button"
                    onClick={() => setShowPaste(false)}
                    className="px-2.5 py-1 rounded text-[11px] text-gray-600 hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={applyPaste}
                    disabled={parseBulk(pasteText).length === 0}
                    className="px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-semibold disabled:opacity-40"
                  >
                    Replace Points ({parseBulk(pasteText).length})
                  </button>
                </div>
              </div>
            )}

            {/* Editable coordinate list */}
            <div className="flex-1 overflow-y-auto px-3 py-2">
              {rows.length === 0 ? (
                <p className="text-[11px] text-gray-400 text-center py-4">
                  No vertices yet. Start drawing, paste coordinates, or add a point
                  manually.
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
                    {rows.map((row, i) => {
                      const invalid = parseRow(row) === null;
                      const inputCls = `w-full font-mono border rounded px-1.5 py-1 focus:outline-none focus:ring-1 ${
                        invalid
                          ? "border-red-300 focus:ring-red-400"
                          : "border-gray-300 focus:ring-sky-500"
                      }`;
                      return (
                        <tr key={i}>
                          <td className="text-gray-500 font-semibold pr-1">{i + 1}</td>
                          <td className="py-0.5 pr-1">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={row.lat}
                              onChange={(e) => updateRow(i, "lat", e.target.value)}
                              className={inputCls}
                            />
                          </td>
                          <td className="py-0.5 pr-1">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={row.lng}
                              onChange={(e) => updateRow(i, "lng", e.target.value)}
                              className={inputCls}
                            />
                          </td>
                          <td>
                            <button
                              type="button"
                              onClick={() => removeRow(i)}
                              className="text-gray-400 hover:text-red-600 p-0.5"
                              title="Remove vertex"
                            >
                              <Trash2 size={12} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              <button
                type="button"
                onClick={addRow}
                className="w-full mt-2 flex items-center justify-center gap-1 py-1 border border-dashed border-gray-300 rounded text-[11px] text-gray-600 hover:bg-gray-50"
                title="Adds a point at the map center"
              >
                <Plus size={11} /> Add Point
              </button>
            </div>

            {/* Footer summary */}
            <div className="px-3 py-2 border-t border-gray-200 bg-gray-50 rounded-b-lg flex items-center justify-between text-[11px]">
              <span className="text-gray-600">
                <strong>{validPoints.length}</strong> vertices
                {invalidCount > 0 && (
                  <span className="text-red-600"> · {invalidCount} invalid</span>
                )}
              </span>
              <span className="text-gray-700">
                Area:{" "}
                <strong>
                  {coords.length >= 3
                    ? `${areaHa.toFixed(2)} ha (${Math.round(areaHa * 10000).toLocaleString()} m²)`
                    : "—"}
                </strong>
              </span>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
