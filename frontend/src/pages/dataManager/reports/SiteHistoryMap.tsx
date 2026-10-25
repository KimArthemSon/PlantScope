import { useEffect, useMemo } from "react";
import { CircleMarker, MapContainer, Polygon, TileLayer, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { normalizeLatLng, type LatLng } from "@/components/map/ReportAreaMap";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

export interface PolygonSnapshot {
  id: number;
  date: string;
  visit_type: string;
  status: string;
  gis_review: string;
  program: string | null;
  planted_hectares: number | null;
  polygon: any;
}

function FitBounds({ points }: { points: LatLng[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    map.fitBounds(L.latLngBounds(points), { padding: [30, 30], maxZoom: 18 });
  }, [map, points]);
  return null;
}

/** Older snapshots fade from light to darker green; the selected one is drawn on top. */
function snapshotColor(index: number, total: number) {
  const shades = ["#bbf7d0", "#86efac", "#4ade80", "#22c55e", "#16a34a"];
  if (total <= 1) return shades[3];
  return shades[Math.round((index / (total - 1)) * (shades.length - 1))];
}

export default function SiteHistoryMap({
  sitePolygon,
  snapshots,
  selectedId,
  height = 320,
}: {
  sitePolygon: any;
  snapshots: PolygonSnapshot[];
  selectedId: number | null;
  height?: number;
}) {
  const site = useMemo(() => normalizeLatLng(sitePolygon), [sitePolygon]);
  const shapes = useMemo(
    () => snapshots.map((s) => ({ ...s, points: normalizeLatLng(s.polygon) })).filter((s) => s.points.length >= 3),
    [snapshots],
  );
  const selected = shapes.find((s) => s.id === selectedId) ?? shapes[shapes.length - 1];
  const allPoints = useMemo(() => [...site, ...shapes.flatMap((s) => s.points)], [site, shapes]);

  if (allPoints.length < 3) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 text-center px-6"
        style={{ height }}
      >
        <p className="text-sm font-medium text-gray-500">No map data for this site yet</p>
        <p className="text-[11.5px] text-gray-400 mt-1">The site has no boundary and no planted-area polygons have been submitted.</p>
      </div>
    );
  }

  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-gray-200" style={{ height }}>
      <MapContainer center={allPoints[0]} zoom={16} scrollWheelZoom style={{ width: "100%", height: "100%", zIndex: 0 }}>
        <TileLayer
          url={`https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`}
          tileSize={512}
          zoomOffset={-1}
          attribution='&copy; <a href="https://www.mapbox.com/">Mapbox</a> &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        {site.length >= 3 && (
          <Polygon positions={site} pathOptions={{ color: "#F8FAFC", weight: 2.5, dashArray: "6 6", fillOpacity: 0.06 }}>
            <Tooltip sticky>Site boundary</Tooltip>
          </Polygon>
        )}
        {shapes
          .filter((s) => s.id !== selected?.id)
          .map((s) => {
            const color = snapshotColor(shapes.indexOf(s), shapes.length);
            return (
              <Polygon key={s.id} positions={s.points} pathOptions={{ color, weight: 1.5, fillColor: color, fillOpacity: 0.12, dashArray: "3 4" }}>
                <Tooltip sticky>
                  {s.date} · {s.visit_type} · {s.planted_hectares ?? "—"} ha ({s.status})
                </Tooltip>
              </Polygon>
            );
          })}
        {selected && (
          <>
            <Polygon
              positions={selected.points}
              pathOptions={{
                color: selected.status === "rejected" ? "#f97316" : "#22C55E",
                weight: 3,
                fillColor: selected.status === "rejected" ? "#f97316" : "#22C55E",
                fillOpacity: 0.3,
              }}
            >
              <Tooltip sticky>
                Selected: {selected.date} · {selected.planted_hectares ?? "—"} ha
              </Tooltip>
            </Polygon>
            {selected.points.map((p, i) => (
              <CircleMarker key={i} center={p} radius={5} pathOptions={{ color: "#fff", weight: 2, fillColor: "#7C3AED", fillOpacity: 1 }}>
                <Tooltip direction="top">
                  Corner {i + 1}: {p[0].toFixed(6)}, {p[1].toFixed(6)}
                </Tooltip>
              </CircleMarker>
            ))}
          </>
        )}
        <FitBounds points={allPoints} />
      </MapContainer>

      {selected && (
        <div className="absolute top-3 left-3 z-[1000] bg-white/95 backdrop-blur px-3 py-2 rounded-lg shadow text-xs border border-gray-200">
          <p className="font-bold text-[#0F4A2F] text-sm">
            {selected.planted_hectares != null ? `${selected.planted_hectares.toFixed(4)} ha` : "—"}
          </p>
          <p className="text-gray-500">
            {selected.date} · {selected.visit_type}
          </p>
        </div>
      )}
      <div className="absolute bottom-3 left-3 z-[1000] bg-white/95 backdrop-blur px-3 py-2 rounded-lg shadow text-[11px] border border-gray-200 space-y-1">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm bg-green-500/60 border-2 border-green-500" /> Selected planted area
        </div>
        {shapes.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm border border-dashed border-green-400 bg-green-200/40" /> Earlier polygons
          </div>
        )}
        {site.length >= 3 ? (
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm border-2 border-dashed border-gray-500" /> Site boundary
          </div>
        ) : (
          <div className="text-red-500 font-medium">No site boundary drawn</div>
        )}
      </div>
    </div>
  );
}
