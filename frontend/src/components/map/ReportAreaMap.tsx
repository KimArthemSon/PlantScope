import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Polygon, CircleMarker, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import * as turf from "@turf/turf";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

export type LatLng = [number, number];

/** Coordinates are stored as [lat, lng]; flip if a polygon was saved as [lng, lat]. */
export function normalizeLatLng(coords: any): LatLng[] {
  if (!Array.isArray(coords)) return [];
  const pts = coords
    .map((c: any) => (Array.isArray(c) ? [Number(c[0]), Number(c[1])] : [Number(c?.latitude), Number(c?.longitude)]))
    .filter((c: number[]) => Number.isFinite(c[0]) && Number.isFinite(c[1])) as LatLng[];
  if (pts.length && Math.abs(pts[0][0]) > 90) return pts.map(([a, b]) => [b, a]);
  return pts;
}

function toTurfPolygon(pts: LatLng[]) {
  if (pts.length < 3) return null;
  const ring = pts.map(([lat, lng]) => [lng, lat]);
  ring.push(ring[0]);
  try {
    return turf.polygon([ring]);
  } catch {
    return null;
  }
}

export interface AreaStats {
  /** Area of the drawn polygon, computed in the browser (m² → ha). */
  areaHa: number;
  /** Share of the drawn polygon that lies outside the site boundary (0–100), or null if unknown. */
  outsidePercent: number | null;
}

export function computeAreaStats(reportPolygon: any, sitePolygon?: any): AreaStats {
  const report = toTurfPolygon(normalizeLatLng(reportPolygon));
  if (!report) return { areaHa: 0, outsidePercent: null };
  const reportArea = turf.area(report);
  const site = toTurfPolygon(normalizeLatLng(sitePolygon));
  let outsidePercent: number | null = null;
  if (site && reportArea > 0) {
    try {
      const inside = turf.intersect(turf.featureCollection([report, site]));
      const insideArea = inside ? turf.area(inside) : 0;
      outsidePercent = Math.max(0, Math.min(100, ((reportArea - insideArea) / reportArea) * 100));
    } catch {
      outsidePercent = null; // self-intersecting shapes can make turf throw
    }
  }
  return { areaHa: reportArea / 10000, outsidePercent };
}

function FitBounds({ points }: { points: LatLng[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    map.fitBounds(L.latLngBounds(points), { padding: [30, 30], maxZoom: 18 });
  }, [map, points]);
  return null;
}

export default function ReportAreaMap({
  reportPolygon,
  sitePolygon,
  height = 320,
  areaHectares,
}: {
  reportPolygon: any;
  sitePolygon?: any;
  height?: number;
  /** Area stored by the server. Shown on the map label. */
  areaHectares?: number | null;
}) {
  const report = useMemo(() => normalizeLatLng(reportPolygon), [reportPolygon]);
  const site = useMemo(() => normalizeLatLng(sitePolygon), [sitePolygon]);
  const allPoints = useMemo(() => [...report, ...site], [report, site]);

  if (report.length < 3) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 text-xs text-gray-400" style={{ height }}>
        No planted-area polygon on this report
      </div>
    );
  }

  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-gray-200" style={{ height }}>
      <MapContainer center={report[0]} zoom={17} scrollWheelZoom style={{ width: "100%", height: "100%", zIndex: 0 }}>
        <TileLayer
          url={`https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`}
          tileSize={512}
          zoomOffset={-1}
          attribution='&copy; <a href="https://www.mapbox.com/">Mapbox</a> &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        {site.length >= 3 && (
          <Polygon positions={site} pathOptions={{ color: "#F8FAFC", weight: 2, dashArray: "6 6", fillOpacity: 0.05 }}>
            <Tooltip sticky>Site boundary</Tooltip>
          </Polygon>
        )}
        <Polygon positions={report} pathOptions={{ color: "#22C55E", weight: 3, fillColor: "#22C55E", fillOpacity: 0.3 }}>
          <Tooltip sticky>Planted area reported by inspector</Tooltip>
        </Polygon>
        {report.map((p, i) => (
          <CircleMarker key={i} center={p} radius={6} pathOptions={{ color: "#FFFFFF", weight: 2, fillColor: "#7C3AED", fillOpacity: 1 }}>
            <Tooltip direction="top">
              Corner {i + 1}: {p[0].toFixed(6)}, {p[1].toFixed(6)}
            </Tooltip>
          </CircleMarker>
        ))}
        <FitBounds points={allPoints} />
      </MapContainer>

      <div className="absolute top-3 left-3 z-[1000] bg-white/95 backdrop-blur px-3 py-2 rounded-lg shadow text-xs border border-gray-200">
        <p className="font-bold text-[#0F4A2F] text-sm">{areaHectares != null ? `${areaHectares.toFixed(4)} ha` : "—"}</p>
        <p className="text-gray-500">{report.length} corners</p>
      </div>
      <div className="absolute bottom-3 left-3 z-[1000] bg-white/95 backdrop-blur px-3 py-2 rounded-lg shadow text-[11px] border border-gray-200 space-y-1">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm bg-green-500/60 border-2 border-green-500" /> Planted area
        </div>
        {site.length >= 3 && (
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm border-2 border-dashed border-gray-500" /> Site boundary
          </div>
        )}
      </div>
    </div>
  );
}
