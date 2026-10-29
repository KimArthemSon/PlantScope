// Earth radius used by Google Maps / Google Earth for geodesic measurements
const EARTH_RADIUS = 6378137;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/**
 * Geodesic polygon area in square meters, measured on the curved Earth.
 * Same method as Google Maps `computeArea` (and Google Earth), so results
 * match their measurements. Must stay in sync with
 * backend/sites/models.py `_ring_area_sqm`.
 *
 * @param coords Polygon vertices as [lat, lng] (Leaflet order). Open or closed ring.
 */
export const polygonAreaSqm = (coords: [number, number][]): number => {
  let pts = coords;
  if (
    pts.length > 3 &&
    pts[0][0] === pts[pts.length - 1][0] &&
    pts[0][1] === pts[pts.length - 1][1]
  ) {
    pts = pts.slice(0, -1);
  }
  if (pts.length < 3) return 0;

  let total = 0;
  for (let i = 0; i < pts.length; i++) {
    const [lat1, lng1] = pts[i];
    const [lat2, lng2] = pts[(i + 1) % pts.length];
    total +=
      toRad(lng2 - lng1) * (2 + Math.sin(toRad(lat1)) + Math.sin(toRad(lat2)));
  }
  return Math.abs((total * EARTH_RADIUS * EARTH_RADIUS) / 2);
};

export const polygonAreaHa = (coords: [number, number][]): number =>
  polygonAreaSqm(coords) / 10000;

/**
 * Center of a polygon's area (not just the average of its corners, which drifts
 * toward wherever corners are bunched up). Input/output are [lat, lng].
 * Falls back to the corner average for degenerate shapes.
 */
export const polygonCentroid = (
  coords: [number, number][],
): [number, number] | null => {
  if (!coords || coords.length === 0) return null;
  let pts = coords;
  if (
    pts.length > 3 &&
    pts[0][0] === pts[pts.length - 1][0] &&
    pts[0][1] === pts[pts.length - 1][1]
  ) {
    pts = pts.slice(0, -1);
  }
  const avg: [number, number] = [
    pts.reduce((s, p) => s + p[0], 0) / pts.length,
    pts.reduce((s, p) => s + p[1], 0) / pts.length,
  ];
  if (pts.length < 3) return avg;

  // Shoelace centroid, relative to the first point for numeric stability
  const [lat0, lng0] = pts[0];
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const x1 = pts[i][1] - lng0;
    const y1 = pts[i][0] - lat0;
    const x2 = pts[(i + 1) % pts.length][1] - lng0;
    const y2 = pts[(i + 1) % pts.length][0] - lat0;
    const cross = x1 * y2 - x2 * y1;
    a += cross;
    cx += (x1 + x2) * cross;
    cy += (y1 + y2) * cross;
  }
  if (Math.abs(a) < 1e-15) return avg;
  return [lat0 + cy / (3 * a), lng0 + cx / (3 * a)];
};
