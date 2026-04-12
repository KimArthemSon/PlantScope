// src/pages/GISS/multicriteria_analysis/types/types.ts
import type L from "leaflet";

// GeoJSON Types
export type GeoJSONPosition = [number, number]; // either [lng, lat] or [lat, lng] depending on source

export interface GeoJSONPolygon {
  type: "Polygon" | "POLYGON";
  // API returns flat: [ [lat, lng], [lat, lng], ... ]
  // GeoJSON standard is nested rings: [ [ [lng, lat], ... ] ]
  // We handle both formats below
  coordinates: GeoJSONPosition[] | GeoJSONPosition[][];
}

// API Response Types
export interface ReforestationArea {
  name: string;
  description: string;
  coordinate: [number, number]; // [lat, lng]
  area_img: string;
}

export interface Barangay {
  name: string;
  description: string;
  coordinate: [number, number]; // [lat, lng]
}

export interface ClassifiedArea {
  name: string;
  description: string;
  polygon: GeoJSONPolygon;
  land_classification_name: string;
}

export interface RestrictedAreaResponse {
  reforestation_area?: ReforestationArea;  // correct spelling
  reforestation_aree?: ReforestationArea;  // API typo — backend sends this key
  barangay: Barangay;
  classified_area: ClassifiedArea[];
}

// Map Layer State Types
export interface MapLayerState {
  reforestationMarker: L.Marker | null;
  barangayMarker: L.Marker | null;
  classifiedPolygons: Map<string, L.Polygon>;
}

// Color mapping for land classification types
export const LAND_CLASSIFICATION_COLORS: Record<
  string,
  { fill: string; stroke: string }
> = {
  "Timber Land": { fill: "#ff0000", stroke: "#1B5E20" },
  "City Area": { fill: "#ff0000", stroke: "#455A64" },
  "Agricultural Land": { fill: "#ff0000", stroke: "#FF8F00" },
  "Protected Area": { fill: "#ff0000", stroke: "#3949AB" },
  Default: { fill: "#ff0000", stroke: "#616161" },
};

/**
 * Converts the API polygon to Leaflet [lat, lng] pairs.
 *
 * The API sends coordinates in TWO possible shapes:
 *
 *   A) Flat array (what your backend actually returns):
 *      [ [lat, lng], [lat, lng], ... ]
 *      e.g. [ [11.012, 124.604], [11.013, 124.605], ... ]
 *
 *   B) GeoJSON nested rings (standard GeoJSON):
 *      [ [ [lng, lat], [lng, lat], ... ] ]
 *
 * We detect shape A vs B by checking whether the first element is itself
 * an array-of-arrays.  Within shape A we detect coordinate order by
 * checking whether the first value looks like a Philippine latitude
 * (roughly 4–21) or longitude (roughly 117–127).
 */
export const geoJSONPolygonToLatLngs = (
  polygon: GeoJSONPolygon
): [number, number][] => {
  const raw = polygon.coordinates;
  if (!raw || raw.length === 0) return [];

  // ── Shape B: nested rings  [ [ [a, b], ... ] ] ──────────────────────────
  // The first element is itself an array whose first element is an array.
  if (Array.isArray(raw[0]) && Array.isArray((raw[0] as any)[0])) {
    const ring = raw[0] as GeoJSONPosition[];
    // Standard GeoJSON is [lng, lat], so swap
    return ring.map(([lng, lat]) => [lat, lng]);
  }

  // ── Shape A: flat array  [ [a, b], [a, b], ... ] ────────────────────────
  const flat = raw as GeoJSONPosition[];
  const [a, b] = flat[0];

  // Philippine bounding box heuristic:
  //   latitude  ≈  4 – 21
  //   longitude ≈ 117 – 127
  const firstIsLat = a >= 4 && a <= 21;

  if (firstIsLat) {
    // Already [lat, lng] — use as-is
    return flat.map(([lat, lng]) => [lat, lng]);
  } else {
    // Stored as [lng, lat] — swap
    return flat.map(([lng, lat]) => [lat, lng]);
  }
};