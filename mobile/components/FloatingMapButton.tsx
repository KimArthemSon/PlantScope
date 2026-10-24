import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Dimensions,
  Pressable,
  ScrollView,
  Alert,
  Platform,
  Animated,
  Easing,
} from "react-native";
import { WebView } from "react-native-webview";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "@/constants/url_fixed";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNetworkStatus } from "@/utils/networkStatus";
import { useAlert, ToastHost } from "@/components/AlertContext";
import { usePolygonAlerts } from "@/hooks/usePolygonAlerts";
import PolygonAlertModal from "@/components/map/PolygonAlertModal";
import PolygonDownloadService from "@/services/PolygonDownloadService";
import PolygonStorageService from "@/services/PolygonStorageService";

const { height: screenHeight } = Dimensions.get("window");
const API_BASE_URL = api + "/api";

// ─────────────────────────────────────────────
// ✅ GPS-REFACTOR: Constants
// ─────────────────────────────────────────────
const GPS_READY_HOURS = 2;
const GPS_AGING_HOURS = 6;
const GPS_LIVE_TIMEOUT_MS = 30000; // 30 seconds

// Remembers that the map background was saved, per area, so the status
// survives leaving the page (the tiles themselves live in the WebView cache).
const mapBackgroundKey = (areaId: number) =>
  `@plantscope_map_background_${areaId}`;

type MapBackgroundInfo = {
  savedAt: string;
  tiles: number;
  failed: number;
  minZoom?: number;
  maxZoom?: number;
  areaKm2?: number;
};

/* ── Offline map download planning ─────────────────────────────────
   Instead of one fixed box/zoom, we save:
   • "context" zooms (10–13) over the area plus ~3 km around it, so you can
     zoom out and still see roads/landmarks offline;
   • "detail" zooms (14 up to 18) only over the real planting extent
     (site polygon, potential sites, or the area's sites), so you can zoom
     right in on the ground you're walking.
   The deepest zoom is reduced automatically for very large areas so the
   download stays reasonable. */
type LatLngBounds = [[number, number], [number, number]]; // [[minLat,minLng],[maxLat,maxLng]]
type ZoomLevelPlan = { z: number; bounds: LatLngBounds };

const CONTEXT_ZOOMS = [10, 11, 12, 13];
const DETAIL_MIN_ZOOM = 14;
const DETAIL_MAX_ZOOM = 18;
const DETAIL_FLOOR_ZOOM = 15; // never go shallower than this for the detail area
const MAX_TILES = 3000;
const AVG_TILE_KB = 15;
const CONTEXT_PAD_DEG = 0.03; // ≈ 3.3 km
const MIN_DETAIL_PAD_DEG = 0.003; // ≈ 330 m

const lngToTileX = (lng: number, z: number) =>
  Math.floor(((lng + 180) / 360) * Math.pow(2, z));
const latToTileY = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) *
      Math.pow(2, z),
  );
};

const tilesInBounds = (b: LatLngBounds, z: number) => {
  const xs = lngToTileX(b[1][1], z) - lngToTileX(b[0][1], z) + 1;
  const ys = latToTileY(b[0][0], z) - latToTileY(b[1][0], z) + 1;
  return Math.max(xs, 0) * Math.max(ys, 0);
};

const boundsFromPoints = (pts: [number, number][]): LatLngBounds | null => {
  const valid = pts.filter(
    (p) => p && isFinite(p[0]) && isFinite(p[1]) && p[0] !== 0 && p[1] !== 0,
  );
  if (!valid.length) return null;
  return [
    [Math.min(...valid.map((p) => p[0])), Math.min(...valid.map((p) => p[1]))],
    [Math.max(...valid.map((p) => p[0])), Math.max(...valid.map((p) => p[1]))],
  ];
};

const padBounds = (b: LatLngBounds, pad: number): LatLngBounds => [
  [b[0][0] - pad, b[0][1] - pad],
  [b[1][0] + pad, b[1][1] + pad],
];

const boundsAreaKm2 = (b: LatLngBounds) => {
  const midLat = ((b[0][0] + b[1][0]) / 2) * (Math.PI / 180);
  const h = (b[1][0] - b[0][0]) * 111.32;
  const w = (b[1][1] - b[0][1]) * 111.32 * Math.cos(midLat);
  return Math.max(h * w, 0);
};

/* ── User-adjustable save settings ─────────────────────────────── */
const HARD_MAX_TILES = 10000; // downloads above this are blocked
const KM_PER_DEG = 111.32;

type DetailMargin = "tight" | "normal" | "wide";
type SaveOptions = {
  maxZoom: "auto" | 15 | 16 | 17 | 18; // closest zoom for the close-up area
  detailMargin: DetailMargin; // extra ground around the planting area
  contextKm: 0 | 1 | 3 | 5; // surroundings saved at zoom 10–13
};
const DEFAULT_SAVE_OPTIONS: SaveOptions = {
  maxZoom: "auto",
  detailMargin: "normal",
  contextKm: 3,
};
const SAVE_OPTIONS_KEY = "@plantscope_map_save_options";

const detailPadFor = (margin: DetailMargin, spanDeg: number) => {
  if (margin === "tight") return 0.001; // ≈ 110 m
  if (margin === "wide") return Math.max(spanDeg * 0.2, MIN_DETAIL_PAD_DEG) + 0.009; // + ≈ 1 km
  return Math.max(spanDeg * 0.2, MIN_DETAIL_PAD_DEG); // 20%, at least ≈ 330 m
};

/** Approximate ground width of one map tile at a zoom (Ormoc latitude). */
const tileWidthMeters = (z: number) =>
  Math.round(((40075016 * Math.cos((11 * Math.PI) / 180)) / Math.pow(2, z)));

const buildDownloadPlan = (
  extent: LatLngBounds,
  opts: SaveOptions = DEFAULT_SAVE_OPTIONS,
) => {
  const span = Math.max(extent[1][0] - extent[0][0], extent[1][1] - extent[0][1]);
  const detail = padBounds(extent, detailPadFor(opts.detailMargin, span));
  const context =
    opts.contextKm > 0 ? padBounds(detail, opts.contextKm / KM_PER_DEG) : detail;

  const make = (maxZ: number): ZoomLevelPlan[] => [
    ...CONTEXT_ZOOMS.map((z) => ({ z, bounds: context })),
    ...Array.from({ length: maxZ - DETAIL_MIN_ZOOM + 1 }, (_, i) => ({
      z: DETAIL_MIN_ZOOM + i,
      bounds: detail,
    })),
  ];
  const count = (levels: ZoomLevelPlan[]) =>
    levels.reduce((sum, l) => sum + tilesInBounds(l.bounds, l.z), 0);

  let maxZoom: number;
  let levels: ZoomLevelPlan[];
  if (opts.maxZoom === "auto") {
    // Deepest zoom that keeps the download around MAX_TILES
    maxZoom = DETAIL_MAX_ZOOM;
    levels = make(maxZoom);
    while (count(levels) > MAX_TILES && maxZoom > DETAIL_FLOOR_ZOOM) {
      maxZoom--;
      levels = make(maxZoom);
    }
  } else {
    maxZoom = opts.maxZoom;
    levels = make(maxZoom);
  }

  const perZoom = levels.map((l) => ({ z: l.z, tiles: tilesInBounds(l.bounds, l.z) }));
  const tiles = perZoom.reduce((s, l) => s + l.tiles, 0);
  return {
    levels,
    perZoom,
    tiles,
    minZoom: CONTEXT_ZOOMS[0],
    maxZoom,
    detailKm2: boundsAreaKm2(detail),
    contextKm2: boundsAreaKm2(context),
    estimateMB: (tiles * AVG_TILE_KB) / 1024,
    reducedZoom: opts.maxZoom === "auto" && maxZoom < DETAIL_MAX_ZOOM,
    tooLarge: tiles > MAX_TILES,
    blocked: tiles > HARD_MAX_TILES,
  };
};

type DownloadPlan = ReturnType<typeof buildDownloadPlan>;
type SaveTarget = { key: string; label: string; detail: string; extent: LatLngBounds };

const formatMB = (mb: number) =>
  mb < 1 ? `${Math.max(1, Math.round(mb * 1024))} KB` : `${mb.toFixed(1)} MB`;
const formatArea = (km2: number) =>
  km2 < 1 ? `${Math.round(km2 * 100)} ha` : `${km2.toFixed(1)} km²`;

/* ── In-app guide for the "Save Map Offline" screen ────────────────
   Uses the user's current settings/estimate when available, otherwise an
   example (~2 × 2 km site with default settings). Visuals are plain Views
   so they work offline. */
const EXAMPLE_EXTENT: LatLngBounds = [
  [11.04, 124.6],
  [11.058, 124.618],
];

const GuideHeading: React.FC<{ n: number; title: string }> = ({ n, title }) => (
  <View style={styles.gHeadRow}>
    <View style={styles.guideNum}>
      <Text style={styles.guideNumText}>{n}</Text>
    </View>
    <Text style={styles.guideSection}>{title}</Text>
  </View>
);

/** A square split into n × n tiles — shows how tiles multiply per zoom. */
const TileGrid: React.FC<{ n: number; size: number; color: string }> = ({
  n,
  size,
  color,
}) => {
  const cell = size / n;
  return (
    <View style={{ width: size, height: size, flexDirection: "row", flexWrap: "wrap" }}>
      {Array.from({ length: n * n }).map((_, i) => (
        <View
          key={i}
          style={{
            width: cell,
            height: cell,
            backgroundColor: color,
            borderWidth: 0.5,
            borderColor: "#FFFFFF",
          }}
        />
      ))}
    </View>
  );
};

const SaveMapGuide: React.FC<{
  plan: DownloadPlan | null;
  opts: SaveOptions;
  isExample: boolean;
}> = ({ plan: livePlan, opts, isExample }) => {
  const plan = livePlan || buildDownloadPlan(EXAMPLE_EXTENT, DEFAULT_SAVE_OPTIONS);
  const o = livePlan ? opts : DEFAULT_SAVE_OPTIONS;
  const maxTiles = Math.max(...plan.perZoom.map((l) => l.tiles), 1);
  const deepest = plan.perZoom[plan.perZoom.length - 1];
  const deepestPct = Math.round((deepest.tiles / Math.max(plan.tiles, 1)) * 100);
  const contextTiles = plan.perZoom
    .filter((l) => l.z < DETAIL_MIN_ZOOM)
    .reduce((s, l) => s + l.tiles, 0);

  return (
    <View>
      <Text style={styles.gIntro}>
        This screen decides <Text style={styles.gBold}>which part of the map</Text> is saved
        and <Text style={styles.gBold}>how close you can zoom</Text> without internet.
        {isExample
          ? " Numbers below are an example."
          : " Numbers below are from your current settings."}
      </Text>

      {/* ── Big picture ── */}
      <Text style={styles.gTitle}>What gets saved</Text>
      <View style={styles.gOuter}>
        <Text style={styles.gOuterLabel}>
          Surroundings · zoom 10–13{o.contextKm ? ` · ${o.contextKm} km` : " · none"}
        </Text>
        <View style={styles.gMiddle}>
          <Text style={styles.gMiddleLabel}>
            Close-up margin · zoom 14–{plan.maxZoom}
          </Text>
          <View style={styles.gInner}>
            <MaterialCommunityIcons name="pine-tree" size={16} color="#fff" />
            <Text style={styles.gInnerText}>Cover (your planting ground)</Text>
          </View>
        </View>
      </View>
      <Text style={styles.gCaption}>
        Inner box: the ground you chose in Cover. Middle box: that ground plus the margin,
        saved in full detail. Outer box: a zoomed-out view around it for roads and landmarks.
        Outside the outer box the map is grey offline.
      </Text>

      {/* ── 1. Cover ── */}
      <GuideHeading n={1} title="Cover" />
      <Text style={styles.gText}>
        <Text style={styles.gBold}>This site</Text> – the site outline, its pin and its potential
        sites. Best detail for one site.{"\n"}
        <Text style={styles.gBold}>Whole area</Text> – every site in the reforestation area.{"\n"}
        <Text style={styles.gBold}>Around me</Text> – your GPS position, if location is on.
      </Text>
      <Text style={styles.gNote}>
        The number on the right (e.g. 36.0 km²) is the close-up area: the ground plus the
        margin. It does not include the surroundings.
      </Text>

      {/* ── 2. Closest zoom ── */}
      <GuideHeading n={2} title="Closest zoom" />
      <Text style={styles.gText}>
        How far you can zoom in offline. Each step closer splits every tile into 4, so the
        close-up part of the download grows about <Text style={styles.gBold}>4× per step</Text>.
      </Text>
      <View style={styles.gZoomRow}>
        {[15, 16, 17, 18].map((z, i) => {
          const active = z === plan.maxZoom;
          return (
            <View key={z} style={styles.gZoomCol}>
              <View style={[styles.gZoomFrame, active && styles.gZoomFrameActive]}>
                <TileGrid n={Math.pow(2, i)} size={52} color={active ? "#0F4A2F" : "#86B79C"} />
              </View>
              <Text style={[styles.gZoomZ, active && { color: "#0F4A2F" }]}>Zoom {z}</Text>
              <Text style={styles.gZoomSub}>×{Math.pow(4, i)} tiles</Text>
              <Text style={styles.gZoomSub}>
                1 tile ≈ {tileWidthMeters(z) >= 1000
                  ? `${(tileWidthMeters(z) / 1000).toFixed(1)} km`
                  : `${tileWidthMeters(z)} m`}
              </Text>
            </View>
          );
        })}
      </View>
      <Text style={styles.gText}>
        <Text style={styles.gBold}>15</Text> roads and land shapes ·{" "}
        <Text style={styles.gBold}>16</Text> fields and small roads ·{" "}
        <Text style={styles.gBold}>17</Text> houses and trails ·{" "}
        <Text style={styles.gBold}>18</Text> paths and tree clusters.{"\n"}
        <Text style={styles.gBold}>Auto</Text> uses the closest zoom that keeps the download near{" "}
        {MAX_TILES.toLocaleString()} tiles.
      </Text>

      {/* ── 3. Close-up margin ── */}
      <GuideHeading n={3} title="Close-up margin" />
      <View style={styles.gMarginRow}>
        {([
          ["tight", "Tight", "~110 m", 4],
          ["normal", "Normal", "20% (min 330 m)", 10],
          ["wide", "Wide", "+1 km more", 18],
        ] as const).map(([k, label, sub, pad]) => {
          const active = o.detailMargin === k;
          return (
            <View key={k} style={styles.gMarginCol}>
              <View
                style={[
                  styles.gMarginBox,
                  { padding: pad },
                  active && { borderColor: "#0F4A2F", backgroundColor: "#DCFCE7" },
                ]}
              >
                <View style={styles.gMarginCore} />
              </View>
              <Text style={[styles.gZoomZ, active && { color: "#0F4A2F" }]}>{label}</Text>
              <Text style={styles.gZoomSub}>{sub}</Text>
            </View>
          );
        })}
      </View>
      <Text style={styles.gText}>
        Extra land around your planting ground that also gets full detail. Use{" "}
        <Text style={styles.gBold}>Wide</Text> if you walk in from far away, and{" "}
        <Text style={styles.gBold}>Tight</Text> to keep the download small.
      </Text>

      {/* ── 4. Surroundings ── */}
      <GuideHeading n={4} title="Surroundings (zoom 10–13)" />
      <Text style={styles.gText}>
        A zoomed-out map around everything, so you can still zoom out to find roads, rivers and
        barangays. It's cheap: in this download zoom 10–13 is only{" "}
        <Text style={styles.gBold}>{contextTiles.toLocaleString()} tiles</Text>. Choose{" "}
        <Text style={styles.gBold}>None</Text> to skip it.
      </Text>

      {/* ── 5. Reading the estimate ── */}
      <GuideHeading n={5} title="Reading the estimate" />
      <View style={styles.estimateCard}>
        <View style={styles.estimateRow}>
          <View style={styles.estimateStat}>
            <Text style={styles.estimateValue}>{plan.tiles.toLocaleString()}</Text>
            <Text style={styles.estimateLabel}>Ⓐ tiles</Text>
          </View>
          <View style={styles.estimateStat}>
            <Text style={styles.estimateValue}>{formatMB(plan.estimateMB)}</Text>
            <Text style={styles.estimateLabel}>Ⓑ about</Text>
          </View>
          <View style={styles.estimateStat}>
            <Text style={styles.estimateValue}>
              {plan.minZoom}–{plan.maxZoom}
            </Text>
            <Text style={styles.estimateLabel}>Ⓒ zoom</Text>
          </View>
        </View>
        <Text style={styles.estimateLine}>
          Ⓓ Close-up area: {formatArea(plan.detailKm2)} · Total covered:{" "}
          {formatArea(plan.contextKm2)}
        </Text>
      </View>
      <View style={styles.gLegend}>
        <Text style={styles.gText}>
          <Text style={styles.gBold}>Ⓐ Tiles</Text> – small square map pictures that get saved.{"\n"}
          <Text style={styles.gBold}>Ⓑ Size</Text> – rough storage needed (about {AVG_TILE_KB} KB per tile;
          real size varies).{"\n"}
          <Text style={styles.gBold}>Ⓒ Zoom</Text> – farthest out to closest in that works offline.{"\n"}
          <Text style={styles.gBold}>Ⓓ Areas</Text> – close-up = middle box; total = outer box.
        </Text>
      </View>

      <Text style={styles.gTitle}>Ⓔ Tiles per zoom level</Text>
      <View style={styles.gBars}>
        {plan.perZoom.map((l) => (
          <View key={l.z} style={styles.gBarRow}>
            <Text style={styles.gBarZ}>z{l.z}</Text>
            <View style={styles.gBarTrack}>
              <View
                style={[
                  styles.gBarFill,
                  {
                    width: `${Math.max((l.tiles / maxTiles) * 100, 1.5)}%`,
                    backgroundColor: l.z < DETAIL_MIN_ZOOM ? "#9CA3AF" : "#0F4A2F",
                  },
                ]}
              />
            </View>
            <Text style={styles.gBarN}>{l.tiles.toLocaleString()}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.gCaption}>
        Grey = surroundings, green = close-up. Zoom {deepest.z} alone is{" "}
        <Text style={styles.gBold}>{deepestPct}%</Text> of this download. That's why lowering
        the closest zoom shrinks it the most.
      </Text>

      {/* ── Tips ── */}
      <GuideHeading n={6} title="If the download is too big" />
      <Text style={styles.gText}>
        1. Lower <Text style={styles.gBold}>Closest zoom</Text> by one step (about ¼ of the close-up tiles).{"\n"}
        2. Pick <Text style={styles.gBold}>This site</Text> instead of Whole area, or a{" "}
        <Text style={styles.gBold}>Tight</Text> margin.{"\n"}
        3. Surroundings barely matter. Change them last.
      </Text>
      <View style={styles.gLimits}>
        <Text style={styles.gLimitText}>
          Above {MAX_TILES.toLocaleString()} tiles: use Wi-Fi.{"  "}Above{" "}
          {HARD_MAX_TILES.toLocaleString()} tiles: Download is disabled.
        </Text>
        <Text style={styles.gLimitText}>
          Keep the map open and the screen on until it says “Map Saved Offline”.
        </Text>
      </View>
    </View>
  );
};

// Cached potential sites per official site, so they can be shown offline
const potentialSitesKey = (siteId: number) =>
  `@plantscope_potential_sites_${siteId}`;

// Cached area pin + extent, so "Go to Area" works offline
const areaViewKey = (areaId: number) => `@plantscope_area_view_${areaId}`;

// Cached official site boundary + pin, so they can be shown offline
const siteBoundaryKey = (siteId: number) =>
  `@plantscope_site_boundary_${siteId}`;

type SiteBoundary = {
  name: string;
  coordinates: [number, number][]; // [lat, lng]
  marker: [number, number] | null; // [lat, lng]
  area_hectares: number | null;
  status: string | null;
  savedAt: string;
};

/** Ensures a point is [lat, lng] (Ormoc: lat ~11, lng ~124). */
const toLatLng = (p: any): [number, number] | null => {
  if (!Array.isArray(p) || p.length < 2) return null;
  const a = Number(p[0]);
  const b = Number(p[1]);
  if (!isFinite(a) || !isFinite(b)) return null;
  return Math.abs(a) > 90 ? [b, a] : [a, b]; // swap if given as [lng, lat]
};

/** Builds a SiteBoundary from a get_site response. */
const parseSiteBoundary = (site: any): SiteBoundary => {
  let raw = site?.polygon_coordinates;
  // Accept GeoJSON geometry too: { type: "Polygon", coordinates: [[[lng, lat], ...]] }
  if (raw && !Array.isArray(raw) && Array.isArray(raw.coordinates)) {
    raw = raw.coordinates;
  }
  if (Array.isArray(raw) && Array.isArray(raw[0]) && Array.isArray(raw[0][0])) {
    raw = raw[0];
  }
  const coordinates = (Array.isArray(raw) ? raw : [])
    .map(toLatLng)
    .filter(Boolean) as [number, number][];

  const pinRaw = site?.marker_coordinate;
  const marker = Array.isArray(pinRaw)
    ? toLatLng(pinRaw)
    : pinRaw?.latitude != null
      ? toLatLng([pinRaw.latitude, pinRaw.longitude])
      : null;

  return {
    name: site?.name || "Site",
    coordinates,
    marker,
    area_hectares: site?.area_hectares ?? null,
    status: site?.status ?? null,
    savedAt: new Date().toISOString(),
  };
};

//  Official Hazard Tile URLs
const MGB_FLOOD_TILE_URL =
  "https://controlmap.mgb.gov.ph/arcgis/rest/services/GeospatialDataInventory/GDI_Detailed_Flood_Susceptibility/MapServer/tile/{z}/{y}/{x}";
const MGB_LANDSLIDE_TILE_URL =
  "https://controlmap.mgb.gov.ph/arcgis/rest/services/GeospatialDataInventory/GDI_Detailed_Rain_induced_Landslide_Susceptibility/MapServer/tile/{z}/{y}/{x}";

interface Barangay {
  barangay_id: number;
  name: string;
  coordinate: [number, number];
}

// ✅ NEW: MapPoint Interface for Assessment Coordinates
export interface MapPoint {
  id: string;
  type: "assessment" | "photo" | "manual" | "polygon_vertex";
  latitude: number;
  longitude: number;
  label: string;
  accuracy?: number;
  timestamp?: string;
  description?: string;
}

interface FloatingMapButtonProps {
  areaId: number;
  areaName?: string;
  siteId?: number;
  siteName?: string;
  userLat?: number;
  userLng?: number;
  mapPoints?: MapPoint[]; // ✅ NEW PROP
  initialOpen?: boolean; // ✅ ADD THIS
}

type GPSReadiness = "ready" | "aging" | "cold" | "checking";

// ─────────────────────────────────────────────
// GPS READINESS BANNER COMPONENT
// ─────────────────────────────────────────────
const GPSReadinessBanner: React.FC<{
  readiness: GPSReadiness;
  ageText: string;
  onRefresh: () => void;
}> = ({ readiness, ageText, onRefresh }) => {
  const config = {
    ready: {
      bg: "#DCFCE7",
      border: "#86EFAC",
      icon: "checkmark-circle" as const,
      iconColor: "#15803D",
      title: "GPS Ready",
      titleColor: "#15803D",
      message: `Last fix: ${ageText}. Safe to go offline.`,
    },
    aging: {
      bg: "#FEF3C7",
      border: "#FCD34D",
      icon: "time-outline" as const,
      iconColor: "#92400E",
      title: "GPS Cache Aging",
      titleColor: "#92400E",
      message: `Last fix: ${ageText}. Consider brief internet to warm up.`,
    },
    cold: {
      bg: "#FEE2E2",
      border: "#FCA5A5",
      icon: "snow-outline" as const,
      iconColor: "#991B1B",
      title: "GPS Cold",
      titleColor: "#991B1B",
      message: "No recent fix. Connect to internet briefly before field work.",
    },
  };
  const c = config[readiness];

  return (
    <View
      style={[
        styles.gpsBanner,
        { backgroundColor: c.bg, borderColor: c.border },
      ]}
    >
      <Ionicons name={c.icon} size={18} color={c.iconColor} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.gpsBannerTitle, { color: c.titleColor }]}>
          {c.title}
        </Text>
        <Text style={[styles.gpsBannerMessage, { color: c.titleColor }]}>
          {c.message}
        </Text>
      </View>
      <TouchableOpacity onPress={onRefresh} style={styles.gpsBannerRefresh}>
        <Ionicons name="refresh-outline" size={18} color={c.iconColor} />
      </TouchableOpacity>
    </View>
  );
};

// ─────────────────────────────────────────────
// 🚨 HAZARD ALERT BANNER COMPONENT
// ─────────────────────────────────────────────
const HazardAlertBanner: React.FC<{
  alerts: any[];
  visible: boolean;
  onPress: () => void;
}> = ({ alerts, visible, onPress }) => {
  const slideAnim = useRef(new Animated.Value(-140)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        friction: 8,
        tension: 40,
      }).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.03,
            duration: 600,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease),
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease),
          }),
        ]),
      ).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: -140,
        duration: 300,
        useNativeDriver: true,
        easing: Easing.inOut(Easing.ease),
      }).start();
      pulseAnim.setValue(1);
    }
  }, [visible]);

  if (!visible) return null;

  const hazardNames = alerts
    .map((a) => a.name || a.type || "Unknown Hazard")
    .join(", ");
  const isMultiple = alerts.length > 1;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.hazardBanner, { transform: [{ translateY: slideAnim }] }]}
    >
      <Animated.View
        style={[
          styles.hazardBannerInner,
          { transform: [{ scale: pulseAnim }] },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={onPress}
          style={styles.hazardBannerTouchable}
        >
          <View style={styles.hazardBannerIconWrap}>
            <Ionicons name="warning" size={28} color="#fff" />
          </View>
          <View style={styles.hazardBannerTextWrap}>
            <Text style={styles.hazardBannerTitle}>
              {isMultiple
                ? `${alerts.length} HAZARD ZONES DETECTED`
                : "HAZARD ZONE DETECTED"}
            </Text>
            <Text style={styles.hazardBannerSubtitle} numberOfLines={1}>
              {hazardNames}
            </Text>
            <Text style={styles.hazardBannerTap}>Tap for details</Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={20}
            color="rgba(255,255,255,0.7)"
          />
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
};

// ─────────────────────────────────────────────
//  ENHANCED FLOATING HAZARD INDICATOR
// ─────────────────────────────────────────────
const HazardIndicator: React.FC<{
  alerts: any[];
  onPress: () => void;
}> = ({ alerts, onPress }) => {
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  const isHazard = alerts.length > 0;

  useEffect(() => {
    if (isHazard) {
      const createPulse = (anim: Animated.Value, delay: number) =>
        Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(anim, {
              toValue: 1,
              duration: 1500,
              useNativeDriver: true,
              easing: Easing.out(Easing.ease),
            }),
            Animated.timing(anim, {
              toValue: 0,
              duration: 0,
              useNativeDriver: true,
            }),
          ]),
        );

      createPulse(ring1, 0).start();
      createPulse(ring2, 500).start();
      createPulse(ring3, 1000).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(shake, {
            toValue: 1,
            duration: 80,
            useNativeDriver: true,
          }),
          Animated.timing(shake, {
            toValue: -1,
            duration: 80,
            useNativeDriver: true,
          }),
          Animated.timing(shake, {
            toValue: 1,
            duration: 80,
            useNativeDriver: true,
          }),
          Animated.timing(shake, {
            toValue: 0,
            duration: 80,
            useNativeDriver: true,
          }),
          Animated.delay(2200),
        ]),
      ).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 1.12,
            duration: 700,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease),
          }),
          Animated.timing(scale, {
            toValue: 1,
            duration: 700,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease),
          }),
        ]),
      ).start();
    } else {
      ring1.setValue(0);
      ring2.setValue(0);
      ring3.setValue(0);
      shake.setValue(0);
      scale.setValue(1);
    }
  }, [isHazard]);

  const shakeInterpolation = shake.interpolate({
    inputRange: [-1, 1],
    outputRange: [-5, 5],
  });

  const ringStyle = (anim: Animated.Value) => ({
    position: "absolute" as const,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#ef4444",
    opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
    transform: [
      {
        scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.8] }),
      },
    ],
  });

  return (
    <View style={styles.hazardIndicatorWrap}>
      {isHazard && (
        <>
          <Animated.View style={ringStyle(ring1)} />
          <Animated.View style={ringStyle(ring2)} />
          <Animated.View style={ringStyle(ring3)} />
        </>
      )}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPress}
        disabled={!isHazard}
      >
        <Animated.View
          style={[
            styles.hazardIndicatorBall,
            {
              backgroundColor: isHazard ? "#ef4444" : "#10b981",
              transform: [
                { translateX: isHazard ? shakeInterpolation : 0 },
                { scale: isHazard ? scale : 1 },
              ],
            },
          ]}
        >
          <Ionicons
            name={isHazard ? "warning" : "shield-checkmark"}
            size={28}
            color="#fff"
          />
          {isHazard && alerts.length > 1 && (
            <View style={styles.hazardCountBadge}>
              <Text style={styles.hazardCountText}>{alerts.length}</Text>
            </View>
          )}
        </Animated.View>
      </TouchableOpacity>
      <View style={styles.hazardIndicatorLabelWrap}>
        <Text
          style={[
            styles.hazardIndicatorLabel,
            { color: isHazard ? "#ef4444" : "#10b981" },
          ]}
        >
          {isHazard
            ? alerts.length === 1
              ? "INSIDE HAZARD ZONE"
              : `${alerts.length} HAZARD ZONES`
            : "SAFE"}
        </Text>
      </View>
    </View>
  );
};

// ─────────────────────────────────────────────
// 🚨 AMBIENT VIGNETTE OVERLAY
// ─────────────────────────────────────────────
const HazardVignette: React.FC<{ visible: boolean }> = ({ visible }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: visible ? 1 : 0,
      duration: 600,
      useNativeDriver: true,
      easing: Easing.inOut(Easing.ease),
    }).start();
  }, [visible]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFillObject,
        styles.vignetteOverlay,
        { opacity: fadeAnim },
      ]}
    />
  );
};

// ─────────────────────────────────────────────
// 🗺️ MAIN FLOATING MAP BUTTON COMPONENT
// ─────────────────────────────────────────────
export default function FloatingMapButton({
  areaId,
  areaName,
  siteId,
  siteName,
  userLat,
  userLng,
  mapPoints = [],
  initialOpen // ✅ Default to empty array
}: FloatingMapButtonProps) {
  const insets = useSafeAreaInsets();
  // Modals draw behind the system bars on Android, so sheets pad for the nav bar.
  const sheetSafeBottom = { paddingBottom: insets.bottom + 28 };
  const [showMap, setShowMap] = useState(initialOpen); 

  const [loading, setLoading] = useState(false);
  const [barangays, setBarangays] = useState<Barangay[]>([]);
  const [areaCoords, setAreaCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [siteCoords, setSiteCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(userLat && userLng ? { lat: userLat, lng: userLng } : null);

  const [userCoordinates, setUserCoordinates] = useState<{
    lat: number;
    lng: number;
    accuracy: number | null;
    isFallback?: boolean;
  } | null>(null);

  const [locationSubscription, setLocationSubscription] = useState<any>(null);
  const [isLocationEnabled, setIsLocationEnabled] = useState(false);
  const [isAcquiringLocation, setIsAcquiringLocation] = useState(false);

  const [gpsReadiness, setGpsReadiness] = useState<GPSReadiness>("cold");
  const [gpsReadinessAge, setGpsReadinessAge] = useState<number | null>(null);
  const [gpsCountdown, setGpsCountdown] = useState(30);

  const [selectedBarangay, setSelectedBarangay] = useState<Barangay | null>(
    null,
  );
  const [showBarangaySheet, setShowBarangaySheet] = useState(false);
  const [loadingClassified, setLoadingClassified] = useState(false);
  const [loadingHazards, setLoadingHazards] = useState(false);

  const [showFlood, setShowFlood] = useState(false);
  const [showBarangays, setShowBarangays] = useState(true);
  const [showLandslide, setShowLandslide] = useState(false);
  const [showLayerPanel, setShowLayerPanel] = useState(false);

  // ✅ UPDATED: Separate visibility states for each point type
  const [showAssessmentLocation, setShowAssessmentLocation] = useState(true);
  const [showBoundaryMarkers, setShowBoundaryMarkers] = useState(true);
  const [showBoundaryPolygon, setShowBoundaryPolygon] = useState(true);

  const [selectedAlert, setSelectedAlert] = useState<any>(null);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [hasDownloadedPolygons, setHasDownloadedPolygons] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadStatus, setDownloadStatus] = useState("");
  const [showDownloadModal, setShowDownloadModal] = useState(false);

  const [showDownloadOptions, setShowDownloadOptions] = useState(false);
  const [selectedBarangays, setSelectedBarangays] = useState<number[]>([]);
  const [downloadOption, setDownloadOption] = useState<
    "all" | "barangay" | "high_priority"
  >("all");
  const [availableBarangays, setAvailableBarangays] = useState<any[]>([]);

  const [showOfflineWarning, setShowOfflineWarning] = useState(false);

  const [downloadedStats, setDownloadedStats] = useState({
    classified: 0,
    hazards: 0,
    size: "0 KB",
  });

  const [isMapBackgroundDownloaded, setIsMapBackgroundDownloaded] =
    useState(false);
  const [mapBackgroundInfo, setMapBackgroundInfo] =
    useState<MapBackgroundInfo | null>(null);

  // Potential sites (from the web GIS analysis) for the selected site
  const [potentialSites, setPotentialSites] = useState<any[]>([]);
  const [showPotentialSites, setShowPotentialSites] = useState(false);
  const [loadingPotentialSites, setLoadingPotentialSites] = useState(false);
  const [potentialSitesFromCache, setPotentialSitesFromCache] = useState(false);

  // Reset offline data sheet
  const [showResetSheet, setShowResetSheet] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetSel, setResetSel] = useState({
    tiles: true,
    locations: true,
    polygons: false,
  });

  // Save-map settings sheet + user guide
  const [showSaveSheet, setShowSaveSheet] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [saveTargets, setSaveTargets] = useState<SaveTarget[]>([]);
  const [saveTargetKey, setSaveTargetKey] = useState<string | null>(null);
  const [saveOpts, setSaveOpts] = useState<SaveOptions>(DEFAULT_SAVE_OPTIONS);

  // Real-world extent of the whole reforestation area (from the backend)
  const [areaBounds, setAreaBounds] = useState<LatLngBounds | null>(null);
  // Details of the download in progress, saved once it completes
  const pendingDownloadRef = useRef<{
    minZoom: number;
    maxZoom: number;
    areaKm2: number;
  } | null>(null);

  // Restore the cached area location (used offline / before the server answers)
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(areaViewKey(areaId))
      .then((raw) => {
        if (!active || !raw) return;
        const cached = JSON.parse(raw);
        if (cached.coords) setAreaCoords((prev) => prev || cached.coords);
        if (cached.bounds) setAreaBounds((prev) => prev || cached.bounds);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [areaId]);

  // Keep the cached area location up to date
  useEffect(() => {
    if (!areaCoords && !areaBounds) return;
    AsyncStorage.setItem(
      areaViewKey(areaId),
      JSON.stringify({ coords: areaCoords, bounds: areaBounds }),
    ).catch(() => {});
  }, [areaId, areaCoords, areaBounds]);

  // Official site boundary polygon + pin
  const [siteBoundary, setSiteBoundary] = useState<SiteBoundary | null>(null);
  const [showSiteBoundary, setShowSiteBoundary] = useState(false);
  const [loadingSiteBoundary, setLoadingSiteBoundary] = useState(false);
  const [siteBoundaryFromCache, setSiteBoundaryFromCache] = useState(false);

  // Restore the saved-map status whenever the component mounts or the area changes
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(mapBackgroundKey(areaId))
      .then((raw) => {
        if (!active) return;
        const info: MapBackgroundInfo | null = raw ? JSON.parse(raw) : null;
        setMapBackgroundInfo(info);
        setIsMapBackgroundDownloaded(!!info);
      })
      .catch((e) => console.warn("Failed to read map background status:", e));
    return () => {
      active = false;
    };
  }, [areaId]);
  const [isLoadingPolygons, setIsLoadingPolygons] = useState(false);
  const [shouldShowAlertIndicator, setShouldShowAlertIndicator] =
    useState(false);
  const hasFitted = useRef(false);
  // True once the map page inside the WebView has loaded and can take commands
  const [mapReady, setMapReady] = useState(false);

  const webViewRef = useRef<any>(null);
  const isOnline = useNetworkStatus();
  const alertContext = useAlert();
  const alert = alertContext;

  const {
    isRunning: geofencingActive,
    alerts,
    hasActiveAlerts,
    start: startGeofencing,
    stop: stopGeofencing,
    refreshPolygonStatus,
  } = usePolygonAlerts();

  // ✅ Filter valid map points (remove 0,0 or NaN)
  const validMapPoints = mapPoints.filter(
    (point) =>
      !isNaN(point.latitude) &&
      !isNaN(point.longitude) &&
      point.latitude !== 0 &&
      point.longitude !== 0
  );

  // ✅ Separate points by type
  const assessmentLocationPoints = validMapPoints.filter(
    (p) => p.type === "assessment"
  );
  const boundaryMarkerPoints = validMapPoints.filter(
    (p) => p.type === "photo"
  );
  const polygonVertices = validMapPoints.filter(
    (p) => p.type === "polygon_vertex"
  );

  useEffect(() => {
    if (!showMap) {
      stopLocationTracking();
      setIsLocationEnabled(false);
      setIsAcquiringLocation(false);
      setShouldShowAlertIndicator(false);
      setGpsReadiness("cold");
    }
    return () => stopLocationTracking();
  }, [showMap]);

  const stopLocationTracking = () => {
    if (locationSubscription) {
      locationSubscription.remove();
      setLocationSubscription(null);
    }
  };

  const updateLocation = (
    loc: Location.LocationObject,
    flyTo: boolean,
    isFallback = false,
  ) => {
    const { latitude, longitude, accuracy } = loc.coords;
    const coords = {
      lat: latitude,
      lng: longitude,
      accuracy: accuracy || null,
      isFallback,
    };
    setUserCoordinates(coords);
    setCurrentLocation({ lat: latitude, lng: longitude });
    injectToWebView(
      `window.updateMap('addUserLocation', { lat: ${latitude}, lng: ${longitude} })`,
    );
    if (flyTo) {
      injectToWebView(
        `window.updateMap('flyTo', { lat: ${latitude}, lng: ${longitude}, zoom: 15 })`,
      );
    }
  };

  useEffect(() => {
    if (userLat && userLng) {
      setCurrentLocation({ lat: userLat, lng: userLng });
      setUserCoordinates({ lat: userLat, lng: userLng, accuracy: null });
    }
  }, [userLat, userLng]);

  useEffect(() => {
    if (showMap) {
      checkPolygons();
      updateDownloadedStats();
    }
  }, [showMap]);

  useEffect(() => {
    if (!isOnline && showMap) {
      setShowOfflineWarning(true);
      const timer = setTimeout(() => setShowOfflineWarning(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, showMap]);

  useEffect(() => {
    if (showDownloadOptions) {
      setAvailableBarangays(
        barangays.map((b) => ({ id: b.barangay_id, name: b.name })),
      );
      setSelectedBarangays([]);
    }
  }, [showDownloadOptions, barangays]);

  const updateDownloadedStats = async () => {
    try {
      const [classified, hazards] = await Promise.all([
        PolygonStorageService.loadClassifiedPolygons(),
        PolygonStorageService.loadHazardPolygons(),
      ]);
      const info = await PolygonStorageService.getStorageInfo();
      setDownloadedStats({
        classified: classified.length,
        hazards: hazards.length,
        size: PolygonStorageService.formatSize(info.totalSize || 0),
      });
    } catch (error) {
      console.error("Failed to update stats:", error);
    }
  };

  const loadDownloadedPolygons = async () => {
    setIsLoadingPolygons(true);
    setShouldShowAlertIndicator(true);
    try {
      const [classified, hazards] = await Promise.all([
        PolygonStorageService.loadClassifiedPolygons(),
        PolygonStorageService.loadHazardPolygons(),
      ]);

      if (classified.length > 0) {
        const classifiedPolygons = classified.map((p: any) => {
          let coords = p.coordinates;
          if (coords && typeof coords === "object" && !Array.isArray(coords)) {
            if (coords.coordinates) coords = coords.coordinates;
          }
          if (
            Array.isArray(coords) &&
            coords.length > 0 &&
            Array.isArray(coords[0]) &&
            Array.isArray(coords[0][0])
          ) {
            coords = coords[0];
          }
          const leafletCoords = coords.map((point: any) => {
            if (Array.isArray(point) && point.length === 2) {
              if (
                point[0] > 100 &&
                point[0] < 150 &&
                point[1] > 0 &&
                point[1] < 30
              ) {
                return [point[1], point[0]];
              }
              return point;
            }
            return point;
          });
          return {
            coordinates: leafletCoords,
            color: p.color || "#16a34a",
            name: p.name || "Classified Area",
            classification: p.classification || "Unknown",
          };
        });
        injectToWebView(
          `window.updateMap('drawClassifiedPolygons', ${JSON.stringify(classifiedPolygons)})`,
        );
      }

      if (hazards.length > 0) {
        const hazardPolygons = hazards.map((p: any) => {
          let coords = p.coordinates;
          if (coords && typeof coords === "object" && !Array.isArray(coords)) {
            if (coords.coordinates) coords = coords.coordinates;
          }
          if (
            Array.isArray(coords) &&
            coords.length > 0 &&
            Array.isArray(coords[0]) &&
            Array.isArray(coords[0][0])
          ) {
            coords = coords[0];
          }
          const leafletCoords = coords.map((point: any) => {
            if (Array.isArray(point) && point.length === 2) {
              if (
                point[0] > 100 &&
                point[0] < 150 &&
                point[1] > 0 &&
                point[1] < 30
              ) {
                return [point[1], point[0]];
              }
              return point;
            }
            return point;
          });
          return {
            coordinates: leafletCoords,
            color: p.color || "#ef4444",
            name: p.name || "Hazard Area",
            type: p.hazard_type || "Unknown",
          };
        });
        injectToWebView(
          `window.updateMap('drawHazardPolygons', ${JSON.stringify(hazardPolygons)})`,
        );
      }

      const totalClassified = classified?.length || 0;
      const totalHazards = hazards?.length || 0;
      const total = totalClassified + totalHazards;

      if (total === 0) {
        alert?.info(
          "No Polygons",
          "No downloaded polygons found. Please download some first.",
        );
      } else {
        alert?.success(
          "Polygons Loaded",
          `Loaded ${total} polygons (${totalClassified} classified, ${totalHazards} hazards)`,
        );
      }
    } catch (error) {
      console.error("Failed to load downloaded polygons:", error);
      alert?.error("Error", "Failed to load polygons from storage.");
    } finally {
      setIsLoadingPolygons(false);
    }
  };

  const checkPolygons = async () => {
    try {
      const has = await PolygonDownloadService.hasPolygons();
      setHasDownloadedPolygons(has);
      await refreshPolygonStatus();
      await updateDownloadedStats();
    } catch (error) {
      console.error("Failed to check polygons:", error);
      setHasDownloadedPolygons(false);
    }
  };

  useEffect(() => {
    if (
      showMap &&
      isLocationEnabled &&
      hasDownloadedPolygons &&
      !geofencingActive
    ) {
      startGeofencing();
    }
    return () => {};
  }, [
    showMap,
    isLocationEnabled,
    hasDownloadedPolygons,
    geofencingActive,
    startGeofencing,
  ]);

  useEffect(() => {
    if (showMap) fetchMapData();
  }, [showMap]);

  const fetchMapData = async () => {
    setLoading(true);
    try {
      const token = await SecureStore.getItemAsync("token");
      if (!token) throw new Error("No authentication token");
      const headers = { Authorization: `Bearer ${token}` };

      try {
        const barangaysRes = await fetch(`${API_BASE_URL}/get_barangay_list/`, {
          headers,
        });
        if (barangaysRes.ok) {
          const barangaysData = await barangaysRes.json();
          setBarangays(barangaysData.data || []);
        }
      } catch (e) {
        console.warn("Failed to fetch barangays:", e);
      }

      try {
        const areasRes = await fetch(
          `${API_BASE_URL}/get_assigned_reforestation_area/`,
          { headers },
        );
        if (areasRes.ok) {
          const areasData = await areasRes.json();
          const area = Array.isArray(areasData)
            ? areasData.find(
                (a: any) => Number(a.reforestation_area_id) === Number(areaId),
              )
            : null;
          if (Array.isArray(area?.bounds) && area.bounds.length === 2) {
            setAreaBounds(area.bounds as LatLngBounds);
          }
          if (area?.coordinate) {
            if (Array.isArray(area.coordinate) && area.coordinate.length >= 2) {
              setAreaCoords({
                lat: Number(area.coordinate[0]),
                lng: Number(area.coordinate[1]),
              });
            } else if (area.coordinate.latitude) {
              setAreaCoords({
                lat: Number(area.coordinate.latitude),
                lng: Number(area.coordinate.longitude),
              });
            }
          }
        }
      } catch (e) {
        console.warn("Failed to fetch areas:", e);
      }

      if (siteId) {
        try {
          const siteRes = await fetch(`${API_BASE_URL}/get_site/${siteId}/`, {
            headers,
          });
          if (siteRes.ok) {
            const siteData = await siteRes.json();

            // Keep offline copies of the boundary and potential sites up to date
            const boundary = parseSiteBoundary(siteData);
            setSiteBoundary(boundary);
            AsyncStorage.setItem(
              siteBoundaryKey(siteId),
              JSON.stringify(boundary),
            ).catch(() => {});
            if (Array.isArray(siteData?.potential_sites)) {
              AsyncStorage.setItem(
                potentialSitesKey(siteId),
                JSON.stringify({
                  savedAt: new Date().toISOString(),
                  data: siteData.potential_sites,
                }),
              ).catch(() => {});
            }

            // Backend sends the site pin as `marker_coordinate` ([lat, lng])
            const pin = siteData?.marker_coordinate || siteData?.center_coordinate;
            if (Array.isArray(pin) && pin.length === 2) {
              setSiteCoords({ lat: Number(pin[0]), lng: Number(pin[1]) });
            } else if (pin?.latitude != null) {
              setSiteCoords({
                lat: Number(pin.latitude),
                lng: Number(pin.longitude),
              });
            }
          }
        } catch (e) {
          console.warn("Failed to fetch site:", e);
        }
      }
    } catch (e) {
      console.error("Failed to fetch map data", e);
      alert?.error("Error", "Failed to load map data.");
    } finally {
      setLoading(false);
    }
  };

  const injectToWebView = (js: string) => {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(js + "; true;");
    }
  };

  const onWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "marker_click" && data.category === "barangay") {
        const barangay = barangays.find((b) => b.barangay_id === data.id);
        if (barangay) {
          setSelectedBarangay(barangay);
          setShowBarangaySheet(true);
        }
      } else if (data.type === "polygon_count") {
        if (data.count === 0 && hasDownloadedPolygons) {
          console.warn("⚠️ Polygons downloaded but not visible on map");
        }
      } else if (data.type === "tile_download_start") {
        setDownloadStatus("Downloading map background tiles...");
        setDownloadProgress(0);
        setShowDownloadModal(true);
        setIsDownloading(true);
      } else if (data.type === "tile_download_progress") {
        setDownloadProgress(data.progress);
      } else if (data.type === "tile_download_complete") {
        const total = Number(data.count) || 0;
        const failed = Number(data.failed) || 0;
        setIsDownloading(false);
        setDownloadProgress(100);

        if (total > 0 && failed >= total) {
          // Nothing was cached — don't mark the map as saved
          setShowDownloadModal(false);
          alert?.error(
            "Download Failed",
            "Couldn't download any map tiles. Check your connection and try again.",
          );
          return;
        }

        const info: MapBackgroundInfo = {
          savedAt: new Date().toISOString(),
          tiles: total - failed,
          failed,
          ...(pendingDownloadRef.current || {}),
        };
        pendingDownloadRef.current = null;
        AsyncStorage.setItem(mapBackgroundKey(areaId), JSON.stringify(info)).catch(
          (e) => console.warn("Failed to save map background status:", e),
        );
        setMapBackgroundInfo(info);
        setIsMapBackgroundDownloaded(true);
        setDownloadStatus("Map background saved successfully!");
        setTimeout(() => {
          setShowDownloadModal(false);
          alert?.success(
            "Map Saved",
            failed > 0
              ? `Map saved for offline use (${failed} of ${total} tiles failed — tap Update to retry).`
              : "Map background is now available offline!",
          );
        }, 1500);
      } else if (data.type === "tile_download_error") {
        setIsDownloading(false);
        setShowDownloadModal(false);
        alert?.error(
          "Download Failed",
          data.error || "Failed to save map background.",
        );
      }
    } catch (e) {
      console.error("Error parsing WebView message", e);
    }
  };

  /* ── Go to reforestation area ────────────────────────────────── */
  const hasAreaLocation = !!(areaBounds || areaCoords);

  /** Moves the map to the reforestation area. Returns false if its location is unknown. */
  const goToArea = (silent = false) => {
    // Fly to the reforestation area's marker ("A" pin)
    if (areaCoords) {
      injectToWebView(
        `window.updateMap('flyToArea', { lat: ${areaCoords.lat}, lng: ${areaCoords.lng}, zoom: 15 })`,
      );
      return true;
    }
    // No marker saved: use the middle of the area's sites instead
    if (areaBounds) {
      const lat = (areaBounds[0][0] + areaBounds[1][0]) / 2;
      const lng = (areaBounds[0][1] + areaBounds[1][1]) / 2;
      injectToWebView(
        `window.updateMap('flyTo', { lat: ${lat}, lng: ${lng}, zoom: 15 })`,
      );
      return true;
    }
    if (!silent) {
      alert?.warning(
        "Area Location Unavailable",
        "This area's location hasn't been loaded yet. Open the map once while online.",
      );
    }
    return false;
  };

  // Opening the map: start at the reforestation area (once the map page is ready)
  useEffect(() => {
    if (!showMap || !mapReady || loading || hasFitted.current) return;
    if (goToArea(true)) hasFitted.current = true;
  }, [showMap, mapReady, loading, areaBounds, areaCoords]);

  // Show / hide barangay markers (re-applied when the map page reloads)
  useEffect(() => {
    if (!showMap || !mapReady) return;
    injectToWebView(`window.updateMap('setBarangaysVisible', ${showBarangays})`);
  }, [showBarangays, showMap, mapReady]);

  // Closing the map destroys the WebView, so start fresh next time
  useEffect(() => {
    if (!showMap) {
      setMapReady(false);
      hasFitted.current = false;
    }
  }, [showMap]);

  // ✅ UPDATED: Separate injection for each point type
  useEffect(() => {
    if (!showMap) {
      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(
          `window.updateMap('clearAssessmentPoints'); window.updateMap('clearBoundaryPolygon'); true;`
        );
      }
      return;
    }
    if (!mapReady) return; // map page not loaded yet — commands would be lost

    // Draw boundary polygon if enabled and has 3+ vertices
    if (polygonVertices.length >= 3 && showBoundaryPolygon) {
      const polygonCoords = polygonVertices.map((p) => [p.latitude, p.longitude]);
      
      injectToWebView(
        `window.updateMap('drawBoundaryPolygon', ${JSON.stringify({
          coordinates: polygonCoords,
          color: "#7C3AED",
          fillColor: "rgba(124, 58, 237, 0.2)",
          name: "Boundary Polygon",
        })})`
      );
    } else {
      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(
          `window.updateMap('clearBoundaryPolygon'); true;`
        );
      }
    }

    // Prepare points to show based on visibility settings
    const pointsToShow: MapPoint[] = [];
    
    if (showAssessmentLocation) {
      pointsToShow.push(...assessmentLocationPoints);
    }
    
    if (showBoundaryMarkers) {
      pointsToShow.push(...boundaryMarkerPoints);
    }
    
    // Always show polygon vertices if polygon is shown
    if (showBoundaryPolygon && polygonVertices.length >= 3) {
      pointsToShow.push(...polygonVertices);
    }

    // Draw points if any
    if (pointsToShow.length > 0) {
      const pointsData = pointsToShow.map((point) => ({
        id: point.id,
        type: point.type,
        lat: point.latitude,
        lng: point.longitude,
        label: point.label,
        accuracy: point.accuracy,
        timestamp: point.timestamp,
        description: point.description,
      }));

      injectToWebView(
        `window.updateMap('addAssessmentPoints', ${JSON.stringify(pointsData)})`
      );
    } else {
      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(
          `window.updateMap('clearAssessmentPoints'); true;`
        );
      }
    }

    // Auto-fit to the points only when there's no area to start at
    const allPoints = validMapPoints.length > 0 ? validMapPoints : [];
    if (allPoints.length > 0 && !hasFitted.current && !loading && !hasAreaLocation) {
      const bounds: [number, number][] = allPoints.map((p) => [
        p.latitude,
        p.longitude,
      ]);
      if (currentLocation) {
        bounds.push([currentLocation.lat, currentLocation.lng]);
      }
      injectToWebView(
        `window.updateMap('fitBounds', ${JSON.stringify(bounds)})`
      );
      hasFitted.current = true;
    }
  }, [
    validMapPoints, 
    assessmentLocationPoints, 
    boundaryMarkerPoints, 
    polygonVertices, 
    showMap, 
    showAssessmentLocation, 
    showBoundaryMarkers, 
    showBoundaryPolygon,
    currentLocation,
    mapReady,
    loading,
    hasAreaLocation,
  ]);

  useEffect(() => {
    if (!showMap || loading || !mapReady) return;
    if (areaCoords) {
      injectToWebView(
        `window.updateMap('addArea', { id: ${areaId}, lat: ${areaCoords.lat}, lng: ${areaCoords.lng}, name: '${(areaName || "Area").replace(/'/g, "\\'")}' })`,
      );
    }
    if (siteCoords) {
      injectToWebView(
        `window.updateMap('addSite', { id: ${siteId}, lat: ${siteCoords.lat}, lng: ${siteCoords.lng}, name: '${(siteName || "Site").replace(/'/g, "\\'")}' })`,
      );
    }
    if (currentLocation) {
      injectToWebView(
        `window.updateMap('addUserLocation', { lat: ${currentLocation.lat}, lng: ${currentLocation.lng} })`,
      );
    }
    if (barangays.length > 0) {
      const data = barangays.map((b) => ({
        id: b.barangay_id,
        lat: b.coordinate[0],
        lng: b.coordinate[1],
        name: b.name,
      }));
      injectToWebView(
        `window.updateMap('addBarangays', ${JSON.stringify(data)})`,
      );
    }
    // Fallback start view when the area's location is unknown
    if (!hasFitted.current && !hasAreaLocation) {
      const points: [number, number][] = [];
      if (siteCoords) points.push([siteCoords.lat, siteCoords.lng]);
      if (currentLocation)
        points.push([currentLocation.lat, currentLocation.lng]);
      if (points.length > 1) {
        injectToWebView(
          `window.updateMap('fitBounds', ${JSON.stringify(points)})`,
        );
        hasFitted.current = true;
      } else if (points.length === 1) {
        const [lat, lng] = points[0];
        injectToWebView(
          `window.updateMap('flyTo', { lat: ${lat}, lng: ${lng} })`,
        );
        hasFitted.current = true;
      }
    }
  }, [areaCoords, siteCoords, currentLocation, barangays, loading, showMap, mapReady]);

  useEffect(() => {
    if (!showMap) return;
    injectToWebView(
      `window.updateHazardLayers({ flood: { enabled: ${showFlood}, url: '${MGB_FLOOD_TILE_URL}', type: 'xyz' }, landslide: { enabled: ${showLandslide}, url: '${MGB_LANDSLIDE_TILE_URL}', type: 'xyz' } })`,
    );
  }, [showFlood, showLandslide, showMap]);

  const viewClassifiedAreas = async () => {
    if (!selectedBarangay) return;
    setLoadingClassified(true);
    try {
      const token = await SecureStore.getItemAsync("token");
      const res = await fetch(
        `${API_BASE_URL}/barangay/${selectedBarangay.barangay_id}/classified-areas/`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok) throw new Error("Failed to fetch classified areas");
      const data = await res.json();
      if (data.success && data.data && data.data.length > 0) {
        const polygons = data.data.map((area: any) => {
          const cls = area.land_classification?.name?.toLowerCase() || "";
          let color = "#dc2626";
          if (cls.includes("forest")) color = "#16a34a";
          else if (cls.includes("agricultural")) color = "#eab308";
          else if (cls.includes("residential")) color = "#2563eb";
          return {
            coordinates: area.polygon.coordinates,
            color,
            name: area.name,
            classification: area.land_classification?.name,
          };
        });
        injectToWebView(
          `window.updateMap('drawClassifiedPolygons', ${JSON.stringify(polygons)})`,
        );
        alert?.success(
          "Layers Loaded",
          "Classified areas are now visible on the map.",
        );
        setShowBarangaySheet(false);
      } else {
        alert?.warning(
          "No Data",
          "No classified areas found for this barangay.",
        );
      }
    } catch (e) {
      console.error("Failed to load classified areas:", e);
      alert?.error("Error", "Failed to load classified areas.");
    } finally {
      setLoadingClassified(false);
    }
  };

  const viewHazardAreas = async () => {
    if (!selectedBarangay) return;
    setLoadingHazards(true);
    try {
      const token = await SecureStore.getItemAsync("token");
      const res = await fetch(`${API_BASE_URL}/get_hazard_areas/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch hazard areas");
      const data = await res.json();
      if (data.data) {
        const hazards = data.data.filter(
          (h: any) => h.barangay_id === selectedBarangay.barangay_id,
        );
        if (hazards.length > 0) {
          const polygons = hazards.map((h: any) => {
            let color = "#6b7280";
            const type = h.hazard_type?.toUpperCase();
            if (type === "FLOOD") color = "#3b82f6";
            else if (type === "LANDSLIDE") color = "#ef4444";
            else if (type === "EARTHQUAKE") color = "#8b5cf6";
            return {
              coordinates: h.polygon.coordinates,
              color,
              name: h.name,
              type: h.hazard_type,
            };
          });
          injectToWebView(
            `window.updateMap('drawHazardPolygons', ${JSON.stringify(polygons)})`,
          );
          alert?.success(
            "Layers Loaded",
            `Showing ${hazards.length} hazard area(s) on the map.`,
          );
          setShowBarangaySheet(false);
        } else {
          alert?.warning("No Data", "No hazard areas found for this barangay.");
        }
      }
    } catch (e) {
      console.error("Failed to load hazard areas:", e);
      alert?.error("Error", "Failed to load hazard areas.");
    } finally {
      setLoadingHazards(false);
    }
  };

  /* ── Potential sites ─────────────────────────────────────────── */
  const drawPotentialSites = (list: any[]) => {
    const payload = list
      .filter((p) => p?.polygon_coordinates)
      .map((p, i) => ({
        id: p.potential_sites_id,
        index: i + 1,
        geometry: p.polygon_coordinates, // GeoJSON geometry (lng, lat)
        area_hectares: p.area_hectares,
        avg_ndvi: p.avg_ndvi,
        suitability_score: p.suitability_score,
      }));
    injectToWebView(
      `window.updateMap('drawPotentialSites', ${JSON.stringify(payload)})`,
    );
  };

  const loadPotentialSites = async () => {
    if (!siteId) return;
    setLoadingPotentialSites(true);
    let list: any[] | null = null;
    let fromCache = false;

    // 1) Try the server (same endpoint the web map uses)
    if (isOnline) {
      try {
        const token = await SecureStore.getItemAsync("token");
        const res = await fetch(
          `${API_BASE_URL}/get_potential_sites/?site_id=${siteId}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (res.ok) {
          const data = await res.json();
          list = data.data || [];
          AsyncStorage.setItem(
            potentialSitesKey(siteId),
            JSON.stringify({ savedAt: new Date().toISOString(), data: list }),
          ).catch(() => {});
        }
      } catch (e) {
        console.warn("Failed to fetch potential sites:", e);
      }
    }

    // 2) Fall back to the copy saved last time we were online
    if (list === null) {
      try {
        const raw = await AsyncStorage.getItem(potentialSitesKey(siteId));
        if (raw) {
          list = JSON.parse(raw).data || [];
          fromCache = true;
        }
      } catch (e) {
        console.warn("Failed to read cached potential sites:", e);
      }
    }

    setLoadingPotentialSites(false);

    if (list === null) {
      alert?.error(
        "Not Available Offline",
        "Potential sites haven't been loaded for this site yet. Load them once while online.",
      );
      return;
    }
    if (list.length === 0) {
      setPotentialSites([]);
      alert?.info(
        "No Potential Sites",
        "No potential sites have been analyzed for this site yet.",
      );
      return;
    }

    setPotentialSites(list);
    setPotentialSitesFromCache(fromCache);
    setShowPotentialSites(true);
    drawPotentialSites(list);
    alert?.success(
      "Potential Sites Loaded",
      `Showing ${list.length} potential site(s)${fromCache ? " (saved copy)" : ""}.`,
    );
  };

  const togglePotentialSites = () => {
    if (showPotentialSites) {
      injectToWebView(`window.updateMap('clearPotentialSites')`);
      setShowPotentialSites(false);
      return;
    }
    loadPotentialSites();
  };

  /* ── Site boundary ───────────────────────────────────────────── */
  const drawSiteBoundary = (b: SiteBoundary) => {
    injectToWebView(
      `window.updateMap('drawSiteBoundary', ${JSON.stringify(b)})`,
    );
  };

  const loadSiteBoundary = async () => {
    if (!siteId) return;
    setLoadingSiteBoundary(true);
    let boundary: SiteBoundary | null = null;
    let fromCache = false;

    if (isOnline) {
      try {
        const token = await SecureStore.getItemAsync("token");
        const res = await fetch(`${API_BASE_URL}/get_site/${siteId}/`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          boundary = parseSiteBoundary(await res.json());
          AsyncStorage.setItem(
            siteBoundaryKey(siteId),
            JSON.stringify(boundary),
          ).catch(() => {});
        }
      } catch (e) {
        console.warn("Failed to fetch site boundary:", e);
      }
    }

    if (!boundary) {
      try {
        const raw = await AsyncStorage.getItem(siteBoundaryKey(siteId));
        if (raw) {
          boundary = JSON.parse(raw);
          fromCache = true;
        }
      } catch (e) {
        console.warn("Failed to read cached site boundary:", e);
      }
    }

    setLoadingSiteBoundary(false);

    if (!boundary) {
      alert?.error(
        "Not Available Offline",
        "The site boundary hasn't been loaded yet. Open the map once while online.",
      );
      return;
    }
    if (boundary.coordinates.length < 3 && !boundary.marker) {
      alert?.info(
        "No Boundary",
        "This site has no boundary polygon or pin coordinate yet.",
      );
      return;
    }

    setSiteBoundary(boundary);
    setSiteBoundaryFromCache(fromCache);
    setShowSiteBoundary(true);
    drawSiteBoundary(boundary);
    alert?.success(
      "Site Boundary Loaded",
      boundary.coordinates.length >= 3
        ? `${boundary.coordinates.length} boundary points${fromCache ? " (saved copy)" : ""}.`
        : `Only the site pin is available${fromCache ? " (saved copy)" : ""}.`,
    );
  };

  const toggleSiteBoundary = () => {
    if (showSiteBoundary) {
      injectToWebView(`window.updateMap('clearSiteBoundary')`);
      setShowSiteBoundary(false);
      return;
    }
    loadSiteBoundary();
  };

  const flyToSitePin = () => {
    const p = siteBoundary?.marker || siteBoundary?.coordinates[0];
    if (!p) return;
    setShowLayerPanel(false);
    injectToWebView(
      `window.updateMap('flyTo', { lat: ${p[0]}, lng: ${p[1]}, zoom: 17 })`,
    );
  };

  // The map view is recreated when the modal reopens, so reset the toggles
  useEffect(() => {
    if (!showMap) {
      setShowPotentialSites(false);
      setShowSiteBoundary(false);
    }
  }, [showMap]);

  const hidePolygons = () => {
    injectToWebView(`window.updateMap('clearPolygons')`);
    setShowBarangaySheet(false);
    alert?.info("Layers Hidden", "All polygon layers have been cleared.");
  };

  const checkGPSReadiness = async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== "granted") {
        setGpsReadiness("cold");
        setGpsReadinessAge(null);
        return;
      }
      const lastKnown = await Location.getLastKnownPositionAsync();
      if (!lastKnown) {
        setGpsReadiness("cold");
        setGpsReadinessAge(null);
        return;
      }
      const ageHours = (Date.now() - lastKnown.timestamp) / (1000 * 60 * 60);
      setGpsReadinessAge(ageHours);
      if (ageHours < GPS_READY_HOURS) setGpsReadiness("ready");
      else if (ageHours < GPS_AGING_HOURS) setGpsReadiness("aging");
      else setGpsReadiness("cold");
    } catch (err) {
      console.error("Error checking GPS readiness:", err);
      setGpsReadiness("cold");
      setGpsReadinessAge(null);
    }
  };

  const formatReadinessAge = () => {
    if (gpsReadinessAge === null) return "never";
    if (gpsReadinessAge < 1 / 60) return "just now";
    if (gpsReadinessAge < 1)
      return `${Math.round(gpsReadinessAge * 60)} min ago`;
    if (gpsReadinessAge < 24) return `${gpsReadinessAge.toFixed(1)}h ago`;
    return `${Math.round(gpsReadinessAge / 24)}d ago`;
  };

  const acquireLocationRobust = async () => {
    if (isLocationEnabled && userCoordinates && !isAcquiringLocation) {
      injectToWebView(
        `window.updateMap('flyTo', { lat: ${userCoordinates.lat}, lng: ${userCoordinates.lng}, zoom: 15 })`,
      );
      return;
    }
    if (isAcquiringLocation) return;
    setIsAcquiringLocation(true);
    setGpsCountdown(30);
    const interval = setInterval(() => {
      setGpsCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        clearInterval(interval);
        alert?.error(
          "Permission Denied",
          "Location permission is required to enable tracking.",
        );
        setIsAcquiringLocation(false);
        return;
      }
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        clearInterval(interval);
        alert?.error(
          "Location Disabled",
          "Please enable GPS/Location in your device settings.",
        );
        setIsAcquiringLocation(false);
        return;
      }
      let loc: Location.LocationObject;
      let usedFallback = false;
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error("GPS_TIMEOUT")),
            GPS_LIVE_TIMEOUT_MS,
          );
        });
        loc = await Promise.race([
          Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          }),
          timeoutPromise,
        ]);
      } catch (liveErr: any) {
        console.warn(
          "Live GPS failed/timed out, trying fallback:",
          liveErr.message,
        );
        const lastKnown = await Location.getLastKnownPositionAsync();
        if (!lastKnown) {
          clearInterval(interval);
          if (liveErr.message === "GPS_TIMEOUT") {
            alert?.error(
              "GPS Signal Not Found",
              `Could not lock onto GPS after ${GPS_LIVE_TIMEOUT_MS / 1000}s. This is common under tree canopy. Please step outside.`,
            );
          } else {
            alert?.error(
              "GPS Error",
              "Unable to retrieve location. Please check device settings.",
            );
          }
          setIsAcquiringLocation(false);
          return;
        }
        loc = lastKnown;
        usedFallback = true;
      }
      clearInterval(interval);
      updateLocation(loc, true, usedFallback);
      setIsLocationEnabled(true);
      if (usedFallback) {
        alert?.warning(
          "Using Cached Location",
          "Live GPS unavailable. Using last known coordinates.",
        );
      } else {
        alert?.success(
          "Location Enabled",
          "GPS coordinates updated successfully.",
        );
      }
      checkGPSReadiness();
    } catch (error) {
      clearInterval(interval);
      console.error("Location error:", error);
      alert?.error("Error", "Unexpected error getting location.");
    } finally {
      setIsAcquiringLocation(false);
    }
  };

  const handleLocationToggle = async () => {
    if (isLocationEnabled) {
      stopLocationTracking();
      setIsLocationEnabled(false);
      setUserCoordinates(null);
      setGpsReadiness("cold");
      setShouldShowAlertIndicator(false);
      alert?.info(
        "Location Disabled",
        "Location tracking has been turned off.",
      );
      return;
    }
    acquireLocationRobust();
  };

  const handleAlertPress = (alertItem: any) => {
    setSelectedAlert(alertItem);
    setShowAlertModal(true);
  };

  const toggleBarangay = (id: number) => {
    setSelectedBarangays((prev) =>
      prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id],
    );
  };

  /** Every piece of ground that can be saved, in order of preference. */
  const getExtentCandidates = async (): Promise<SaveTarget[]> => {
    const out: SaveTarget[] = [];
    if (siteId) {
      const pts: [number, number][] = [];
      if (siteBoundary) {
        pts.push(...siteBoundary.coordinates);
        if (siteBoundary.marker) pts.push(siteBoundary.marker);
      }
      // Include potential sites so the analyzed planting areas are covered too
      try {
        const raw = await AsyncStorage.getItem(potentialSitesKey(siteId));
        const list: any[] = raw ? JSON.parse(raw).data || [] : potentialSites;
        list.forEach((p) => {
          const parsed = parseSiteBoundary({ polygon_coordinates: p.polygon_coordinates });
          pts.push(...parsed.coordinates);
        });
      } catch {}
      if (siteCoords) pts.push([siteCoords.lat, siteCoords.lng]);
      const b = boundsFromPoints(pts);
      if (b) out.push({ key: "site", label: "This site", detail: siteName || "Site + potential sites", extent: b });
    }
    if (areaBounds) {
      out.push({ key: "area", label: "Whole area", detail: areaName || "All sites in the area", extent: areaBounds });
    } else if (areaCoords) {
      const c: [number, number] = [areaCoords.lat, areaCoords.lng];
      out.push({ key: "area", label: "Area pin", detail: `${areaName || "Area"} (no site outlines yet)`, extent: [c, c] });
    }
    if (currentLocation) {
      const c: [number, number] = [currentLocation.lat, currentLocation.lng];
      out.push({ key: "me", label: "Around me", detail: "Your current GPS position", extent: [c, c] });
    }
    return out;
  };

  // Remember the last-used save settings
  useEffect(() => {
    AsyncStorage.getItem(SAVE_OPTIONS_KEY)
      .then((raw) => {
        if (raw) setSaveOpts({ ...DEFAULT_SAVE_OPTIONS, ...JSON.parse(raw) });
      })
      .catch(() => {});
  }, []);

  const saveTarget =
    saveTargets.find((t) => t.key === saveTargetKey) || saveTargets[0] || null;
  const savePlan: DownloadPlan | null = useMemo(
    () => (saveTarget ? buildDownloadPlan(saveTarget.extent, saveOpts) : null),
    [saveTarget, saveOpts],
  );

  /** Opens the save settings sheet. */
  const downloadMapBackground = async () => {
    if (!isOnline) {
      alert?.error(
        "Offline",
        "You must be online to download the map background.",
      );
      return;
    }
    const candidates = await getExtentCandidates();
    if (!candidates.length) {
      alert?.error(
        "No Location",
        "No site, area or GPS location is available to size the map download.",
      );
      return;
    }
    setSaveTargets(candidates);
    setSaveTargetKey((prev) =>
      prev && candidates.some((c) => c.key === prev) ? prev : candidates[0].key,
    );
    setShowLayerPanel(false);
    setShowSaveSheet(true);
  };

  /* ── Reset offline data ──────────────────────────────────────── */
  const openResetSheet = () => {
    setShowLayerPanel(false);
    setShowResetSheet(true);
  };

  const runReset = async () => {
    setResetting(true);
    const done: string[] = [];
    try {
      if (resetSel.tiles) {
        // Tiles live in the map view's shared cache, so this clears every area
        webViewRef.current?.clearCache?.(true);
        const keys = await AsyncStorage.getAllKeys();
        await AsyncStorage.multiRemove(
          keys.filter((k) => k.startsWith("@plantscope_map_background_")),
        );
        setIsMapBackgroundDownloaded(false);
        setMapBackgroundInfo(null);
        done.push("saved map tiles");
      }

      if (resetSel.locations) {
        const keys = [areaViewKey(areaId)];
        if (siteId) keys.push(siteBoundaryKey(siteId), potentialSitesKey(siteId));
        await AsyncStorage.multiRemove(keys);
        injectToWebView(
          `window.updateMap('clearSiteBoundary'); window.updateMap('clearPotentialSites')`,
        );
        setShowSiteBoundary(false);
        setShowPotentialSites(false);
        setSiteBoundaryFromCache(false);
        setPotentialSitesFromCache(false);
        done.push(siteId ? "saved site & area locations" : "saved area location");
      }

      if (resetSel.polygons) {
        await PolygonDownloadService.deleteAllPolygons();
        setHasDownloadedPolygons(false);
        setShouldShowAlertIndicator(false);
        await refreshPolygonStatus();
        await updateDownloadedStats();
        if (geofencingActive) await stopGeofencing();
        injectToWebView(`window.updateMap('clearPolygons')`);
        done.push("hazard & classification polygons");
      }

      setShowResetSheet(false);
      alert?.success(
        "Offline Data Reset",
        `Deleted ${done.join(", ")}.` +
          (isOnline && resetSel.locations
            ? " Locations will be saved again next time you open the map online."
            : ""),
      );
    } catch (e) {
      console.error("Reset offline data failed:", e);
      alert?.error("Reset Failed", "Some offline data could not be deleted.");
    } finally {
      setResetting(false);
    }
  };

  const confirmReset = () => {
    if (!resetSel.tiles && !resetSel.locations && !resetSel.polygons) return;
    Alert.alert(
      "Delete offline data?",
      "The selected data will be removed from this phone." +
        (resetSel.tiles ? "\n\nSaved map tiles are removed for ALL areas." : "") +
        "\n\nYou'll need internet to download it again.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: runReset },
      ],
    );
  };

  const startMapDownload = () => {
    if (!savePlan || savePlan.blocked) return;
    pendingDownloadRef.current = {
      minZoom: savePlan.minZoom,
      maxZoom: savePlan.maxZoom,
      areaKm2: savePlan.detailKm2,
    };
    AsyncStorage.setItem(SAVE_OPTIONS_KEY, JSON.stringify(saveOpts)).catch(() => {});
    setShowSaveSheet(false);
    injectToWebView(
      `window.downloadMapBackground(${JSON.stringify(savePlan.levels)})`,
    );
  };

  const handleDownloadWithOptions = async () => {
    if (!isOnline) {
      alert?.error("Offline", "You need to be online to download polygons.");
      return;
    }
    setShowDownloadOptions(false);
    setShowDownloadModal(true);
    setDownloadProgress(0);
    setDownloadStatus("Starting polygon download...");
    setIsDownloading(true);
    try {
      let result;
      if (downloadOption === "barangay" && selectedBarangays.length > 0) {
        result = await PolygonDownloadService.downloadForBarangay(
          selectedBarangays,
          (progress) => {
            setDownloadProgress(progress.current);
            setDownloadStatus(progress.status);
          },
        );
      } else if (downloadOption === "high_priority") {
        result = await PolygonDownloadService.downloadHighPriority(
          selectedBarangays.length > 0 ? selectedBarangays : undefined,
          (progress) => {
            setDownloadProgress(progress.current);
            setDownloadStatus(progress.status);
          },
        );
      } else {
        result = await PolygonDownloadService.downloadPolygonsFiltered(
          { maxPolygons: 200, maxSizeMB: 5 },
          (progress) => {
            setDownloadProgress(progress.current);
            setDownloadStatus(progress.status);
          },
        );
      }
      await checkPolygons();
      await updateDownloadedStats();
      setHasDownloadedPolygons(true);
      if (showMap) setTimeout(() => loadDownloadedPolygons(), 1500);
      alert?.success(
        "Download Complete",
        `${result.classified} classified areas, ${result.hazard} hazard zones (${PolygonDownloadService.formatSize(result.totalSize)})`,
      );
      setTimeout(() => {
        setShowDownloadModal(false);
        setIsDownloading(false);
      }, 1500);
    } catch (error: any) {
      console.error("Download error:", error);
      alert?.error(
        "Download Failed",
        error.message || "Failed to download polygons.",
      );
      setShowDownloadModal(false);
      setIsDownloading(false);
    }
  };

  const handleSimpleDownload = async () => {
    await updateDownloadedStats();
    setShowDownloadOptions(true);
  };

  const handleDeletePolygons = async () => {
    Alert.alert(
      "Delete Downloaded Polygons",
      "This will remove all downloaded polygon data. Geofencing will stop working offline. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete All",
          style: "destructive",
          onPress: async () => {
            try {
              await PolygonDownloadService.deleteAllPolygons();
              setHasDownloadedPolygons(false);
              setShouldShowAlertIndicator(false);
              await refreshPolygonStatus();
              await updateDownloadedStats();
              if (geofencingActive) await stopGeofencing();
              injectToWebView(`window.updateMap('clearPolygons')`);
              alert?.success("Deleted", "All polygon data has been removed.");
            } catch (error) {
              console.error("Failed to delete polygons:", error);
              alert?.error("Error", "Failed to delete polygons.");
            }
          },
        },
      ],
    );
  };

  // ✅ UPDATED: Clear all assessment points handler
  const handleClearAllPoints = () => {
    injectToWebView(`window.updateMap('clearAssessmentPoints'); window.updateMap('clearBoundaryPolygon')`);
    alert?.info("Points Cleared", "All assessment points and boundary polygon have been removed from the map.");
  };

  const title = siteName
    ? `${siteName} (${areaName || "Area"})`
    : areaName || "Location Map";

  const getSignalLevel = (accuracy: number | null) => {
    if (accuracy == null) return 0;
    if (accuracy < 5) return 5;
    if (accuracy < 10) return 4;
    if (accuracy < 20) return 3;
    if (accuracy < 40) return 2;
    return 1;
  };

  return (
    <>
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowMap(true)}
        activeOpacity={0.85}
      >
        <Ionicons name="map" size={24} color="#FFFFFF" />
      </TouchableOpacity>

      <Modal
        visible={showMap}
        animationType="slide"
        onRequestClose={() => setShowMap(false)}
      >
        <View style={[styles.modalContainer, { paddingBottom: insets.bottom }]}>
          <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
            <TouchableOpacity onPress={() => setShowMap(false)}>
              <Ionicons name="close" size={28} color="#0F4A2F" />
            </TouchableOpacity>
            <View style={styles.headerTitleWrap}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {title}
              </Text>
            </View>
            <View style={styles.headerRight}>
              {hasDownloadedPolygons && geofencingActive && (
                <View style={styles.polygonStatusBadge}>
                  <Ionicons name="shield-checkmark" size={14} color="#16a34a" />
                  <Text style={styles.polygonStatusText}>Active</Text>
                </View>
              )}
              <TouchableOpacity
                onPress={() => setShowLayerPanel(!showLayerPanel)}
                style={styles.layerToggleBtn}
              >
                <Ionicons
                  name={showLayerPanel ? "close-circle" : "layers-outline"}
                  size={24}
                  color="#0F4A2F"
                />
              </TouchableOpacity>
            </View>
          </View>

          {!isOnline && showOfflineWarning && (
            <View style={styles.offlineWarningBanner}>
              <Ionicons
                name="cloud-offline-outline"
                size={16}
                color="#f59e0b"
              />
              <Text style={styles.offlineWarningText}>
                Offline Mode - Using cached map
              </Text>
              <TouchableOpacity onPress={() => setShowOfflineWarning(false)}>
                <Ionicons name="close" size={16} color="#f59e0b" />
              </TouchableOpacity>
            </View>
          )}

          {isLocationEnabled && gpsReadiness !== "cold" && (
            <GPSReadinessBanner
              readiness={gpsReadiness}
              ageText={formatReadinessAge()}
              onRefresh={checkGPSReadiness}
            />
          )}

          {showLayerPanel && (
            <View style={styles.layerPanel}>
              <Text style={styles.layerPanelTitle}>Hazard Layers (MGB)</Text>
              <TouchableOpacity
                style={[
                  styles.layerToggle,
                  showFlood && styles.layerToggleActiveFlood,
                ]}
                onPress={() => setShowFlood(!showFlood)}
              >
                <Ionicons
                  name="water-outline"
                  size={18}
                  color={showFlood ? "#fff" : "#1565C0"}
                />
                <Text
                  style={[
                    styles.layerToggleText,
                    showFlood && styles.layerToggleTextActive,
                  ]}
                >
                  Flood Zones
                </Text>
                {showFlood && (
                  <Ionicons name="checkmark" size={18} color="#fff" />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.layerToggle,
                  showLandslide && styles.layerToggleActiveLandslide,
                ]}
                onPress={() => setShowLandslide(!showLandslide)}
              >
                <Ionicons
                  name="trail-sign-outline"
                  size={18}
                  color={showLandslide ? "#fff" : "#6D4C41"}
                />
                <Text
                  style={[
                    styles.layerToggleText,
                    showLandslide && styles.layerToggleTextActive,
                  ]}
                >
                  Landslide Zones
                </Text>
                {showLandslide && (
                  <Ionicons name="checkmark" size={18} color="#fff" />
                )}
              </TouchableOpacity>

              <Text style={[styles.layerPanelTitle, { marginTop: 12 }]}>
                Map Markers
              </Text>
              <TouchableOpacity
                style={[
                  styles.layerToggle,
                  showBarangays && styles.layerToggleActiveBarangay,
                ]}
                onPress={() => setShowBarangays(!showBarangays)}
              >
                <Ionicons
                  name="business-outline"
                  size={18}
                  color={showBarangays ? "#fff" : "#A16207"}
                />
                <Text
                  style={[
                    styles.layerToggleText,
                    showBarangays && styles.layerToggleTextActive,
                  ]}
                >
                  Barangays ({barangays.length})
                </Text>
                {showBarangays && (
                  <Ionicons name="checkmark" size={18} color="#fff" />
                )}
              </TouchableOpacity>

              {/* Official site boundary polygon + pin (specific site only) */}
              {!!siteId && (
                <View style={styles.assessmentPointsSection}>
                  <Text style={styles.layerPanelTitle}>Site Boundary</Text>
                  <View style={styles.assessmentPointsRow}>
                    <View style={styles.assessmentPointsInfo}>
                      <MaterialCommunityIcons
                        name="shape-polygon-plus"
                        size={18}
                        color="#16a34a"
                      />
                      <View style={{ flexShrink: 1 }}>
                        <Text style={styles.assessmentPointsText}>
                          {showSiteBoundary && siteBoundary
                            ? siteBoundary.coordinates.length >= 3
                              ? `Polygon · ${siteBoundary.coordinates.length} points`
                              : "Pin only (no polygon)"
                            : "Official site polygon & pin"}
                        </Text>
                        {showSiteBoundary && siteBoundaryFromCache && (
                          <Text style={styles.offlineSubText}>
                            Saved copy (offline)
                          </Text>
                        )}
                      </View>
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.miniBtn,
                        showSiteBoundary
                          ? styles.miniBtnSecondary
                          : styles.miniBtnPrimary,
                      ]}
                      onPress={toggleSiteBoundary}
                      disabled={loadingSiteBoundary}
                    >
                      {loadingSiteBoundary ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Ionicons
                          name={showSiteBoundary ? "eye-off" : "eye"}
                          size={14}
                          color="#fff"
                        />
                      )}
                      <Text style={styles.miniBtnText}>
                        {showSiteBoundary ? "Hide" : "Load"}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {showSiteBoundary && siteBoundary && (
                    <View style={styles.coordCard}>
                      {siteBoundary.marker && (
                        <View style={styles.coordRow}>
                          <Text style={styles.coordLabel}>Pin</Text>
                          <Text style={styles.coordValue} selectable>
                            {siteBoundary.marker[0].toFixed(6)},{" "}
                            {siteBoundary.marker[1].toFixed(6)}
                          </Text>
                        </View>
                      )}
                      {siteBoundary.area_hectares != null && (
                        <View style={styles.coordRow}>
                          <Text style={styles.coordLabel}>Area</Text>
                          <Text style={styles.coordValue}>
                            {Number(siteBoundary.area_hectares).toFixed(2)} ha
                          </Text>
                        </View>
                      )}
                      {siteBoundary.coordinates.length >= 3 && (
                        <ScrollView
                          style={styles.coordList}
                          nestedScrollEnabled
                          showsVerticalScrollIndicator
                        >
                          {siteBoundary.coordinates.map((c, i) => (
                            <Text key={i} style={styles.coordListItem} selectable>
                              {i + 1}. {c[0].toFixed(6)}, {c[1].toFixed(6)}
                            </Text>
                          ))}
                        </ScrollView>
                      )}
                      <TouchableOpacity
                        style={styles.coordGoBtn}
                        onPress={flyToSitePin}
                      >
                        <Ionicons name="locate" size={14} color="#0F4A2F" />
                        <Text style={styles.coordGoText}>Go to site</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}

              {/* Potential sites from the web GIS analysis (specific site only) */}
              {!!siteId && (
                <View style={styles.assessmentPointsSection}>
                  <Text style={styles.layerPanelTitle}>Potential Sites</Text>
                  <View style={styles.assessmentPointsRow}>
                    <View style={styles.assessmentPointsInfo}>
                      <MaterialCommunityIcons
                        name="vector-polygon"
                        size={18}
                        color="#dc2626"
                      />
                      <View style={{ flexShrink: 1 }}>
                        <Text style={styles.assessmentPointsText}>
                          {showPotentialSites
                            ? `Showing ${potentialSites.length} potential site(s)`
                            : "Analyzed potential areas"}
                        </Text>
                        {showPotentialSites && potentialSitesFromCache && (
                          <Text style={styles.offlineSubText}>
                            Saved copy (offline)
                          </Text>
                        )}
                      </View>
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.miniBtn,
                        showPotentialSites
                          ? styles.miniBtnSecondary
                          : styles.miniBtnPrimary,
                      ]}
                      onPress={togglePotentialSites}
                      disabled={loadingPotentialSites}
                    >
                      {loadingPotentialSites ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Ionicons
                          name={showPotentialSites ? "eye-off" : "eye"}
                          size={14}
                          color="#fff"
                        />
                      )}
                      <Text style={styles.miniBtnText}>
                        {showPotentialSites ? "Hide" : "Load"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* ✅ UPDATED: Separate Assessment Points Section */}
              <View style={styles.assessmentPointsSection}>
                <Text style={styles.layerPanelTitle}>Assessment Points</Text>
                
                {/* Assessment Location */}
                <View style={styles.assessmentPointsRow}>
                  <View style={styles.assessmentPointsInfo}>
                    <Ionicons
                      name="location"
                      size={18}
                      color="#2563eb"
                    />
                    <Text style={styles.assessmentPointsText}>
                      Assessment Location ({assessmentLocationPoints.length})
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.miniBtn,
                      showAssessmentLocation ? styles.miniBtnSuccess : styles.miniBtnSecondary,
                    ]}
                    onPress={() => setShowAssessmentLocation(!showAssessmentLocation)}
                  >
                    <Ionicons 
                      name={showAssessmentLocation ? "eye" : "eye-off"} 
                      size={14} 
                      color="#fff" 
                    />
                    <Text style={styles.miniBtnText}>
                      {showAssessmentLocation ? "Hide" : "Show"}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Boundary Markers (Photos) */}
                <View style={styles.assessmentPointsRow}>
                  <View style={styles.assessmentPointsInfo}>
                    <Ionicons
                      name="camera"
                      size={18}
                      color="#f59e0b"
                    />
                    <Text style={styles.assessmentPointsText}>
                      Boundary Markers ({boundaryMarkerPoints.length})
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.miniBtn,
                      showBoundaryMarkers ? styles.miniBtnSuccess : styles.miniBtnSecondary,
                    ]}
                    onPress={() => setShowBoundaryMarkers(!showBoundaryMarkers)}
                  >
                    <Ionicons 
                      name={showBoundaryMarkers ? "eye" : "eye-off"} 
                      size={14} 
                      color="#fff" 
                    />
                    <Text style={styles.miniBtnText}>
                      {showBoundaryMarkers ? "Hide" : "Show"}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Boundary Polygon */}
                <View style={styles.assessmentPointsRow}>
                  <View style={styles.assessmentPointsInfo}>
                    <Ionicons
                      name="draw"
                      size={18}
                      color="#7c3aed"
                    />
                    <Text style={styles.assessmentPointsText}>
                      Boundary Polygon ({polygonVertices.length >= 3 ? 'Active' : polygonVertices.length})
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.miniBtn,
                      showBoundaryPolygon ? styles.miniBtnSuccess : styles.miniBtnSecondary,
                      polygonVertices.length < 3 && styles.miniBtnDisabled,
                    ]}
                    onPress={() => setShowBoundaryPolygon(!showBoundaryPolygon)}
                    disabled={polygonVertices.length < 3}
                  >
                    <Ionicons 
                      name={showBoundaryPolygon ? "eye" : "eye-off"} 
                      size={14} 
                      color="#fff" 
                    />
                    <Text style={styles.miniBtnText}>
                      {showBoundaryPolygon ? "Hide" : "Show"}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Clear All Button */}
                {validMapPoints.length > 0 && (
                  <View style={styles.assessmentPointsRow}>
                    <View style={styles.assessmentPointsInfo}>
                      <Ionicons name="trash-outline" size={18} color="#EF4444" />
                      <Text style={[styles.assessmentPointsText, { color: "#EF4444" }]}>
                        Clear all points
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.miniBtn, styles.miniBtnDanger]}
                      onPress={handleClearAllPoints}
                    >
                      <Text style={styles.miniBtnText}>Clear</Text>
                    </TouchableOpacity>
                  </View>
                )}
                
                <View style={styles.pointLegend}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: "#2563eb" }]} />
                    <Text style={styles.legendText}>Assessment</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: "#f59e0b" }]} />
                    <Text style={styles.legendText}>Photo</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: "#7c3aed" }]} />
                    <Text style={styles.legendText}>Boundary</Text>
                  </View>
                </View>
              </View>

              <View style={styles.offlineSection}>
                <View style={styles.offlineTitleRow}>
                  <Text style={styles.layerPanelTitle}>Offline Data</Text>
                  <TouchableOpacity
                    style={styles.guideLink}
                    onPress={() => setShowGuide(true)}
                    hitSlop={8}
                  >
                    <Ionicons name="help-circle-outline" size={15} color="#0F4A2F" />
                    <Text style={styles.guideLinkText}>Guide</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.offlineRow}>
                  <View style={styles.offlineInfo}>
                    <Ionicons
                      name={
                        isMapBackgroundDownloaded
                          ? "checkmark-circle"
                          : "map-outline"
                      }
                      size={18}
                      color={isMapBackgroundDownloaded ? "#16a34a" : "#6B7280"}
                    />
                    <View style={{ flexShrink: 1 }}>
                      <Text style={styles.offlineText}>
                        {isMapBackgroundDownloaded
                          ? "Map Saved Offline"
                          : "Map Not Saved"}
                      </Text>
                      {isMapBackgroundDownloaded && mapBackgroundInfo && (
                        <Text style={styles.offlineSubText}>
                          {new Date(mapBackgroundInfo.savedAt).toLocaleDateString(
                            "en-US",
                            { month: "short", day: "numeric", year: "numeric" },
                          )}{" "}
                          · {mapBackgroundInfo.tiles.toLocaleString()} tiles
                          {mapBackgroundInfo.minZoom != null &&
                            ` · zoom ${mapBackgroundInfo.minZoom}–${mapBackgroundInfo.maxZoom}`}
                        </Text>
                      )}
                    </View>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.miniBtn,
                      isMapBackgroundDownloaded
                        ? styles.miniBtnSuccess
                        : styles.miniBtnPrimary,
                    ]}
                    onPress={downloadMapBackground}
                    disabled={!isOnline}
                  >
                    <Ionicons name="save-outline" size={14} color="#fff" />
                    <Text style={styles.miniBtnText}>
                      {isMapBackgroundDownloaded ? "Update" : "Save"}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.offlineRow}>
                  <View style={styles.offlineInfo}>
                    <Ionicons
                      name={
                        hasDownloadedPolygons
                          ? "checkmark-circle"
                          : "cloud-download-outline"
                      }
                      size={18}
                      color={hasDownloadedPolygons ? "#16a34a" : "#6B7280"}
                    />
                    <Text style={styles.offlineText}>
                      {hasDownloadedPolygons
                        ? `${downloadedStats.classified + downloadedStats.hazards} Polygons`
                        : "No Polygons"}
                    </Text>
                  </View>
                  <View style={styles.offlineActions}>
                    {hasDownloadedPolygons ? (
                      <>
                        <TouchableOpacity
                          onPress={loadDownloadedPolygons}
                          style={styles.iconBtn}
                          disabled={isLoadingPolygons}
                        >
                          {isLoadingPolygons ? (
                            <ActivityIndicator size="small" color="#0F4A2F" />
                          ) : (
                            <Ionicons
                              name="folder-open-outline"
                              size={18}
                              color="#0F4A2F"
                            />
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={handleSimpleDownload}
                          style={styles.iconBtn}
                        >
                          <Ionicons
                            name="refresh-outline"
                            size={18}
                            color="#0F4A2F"
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={handleDeletePolygons}
                          style={styles.iconBtn}
                        >
                          <Ionicons
                            name="trash-outline"
                            size={18}
                            color="#ef4444"
                          />
                        </TouchableOpacity>
                      </>
                    ) : (
                      <TouchableOpacity
                        onPress={handleSimpleDownload}
                        style={[styles.miniBtn, styles.miniBtnPrimary]}
                      >
                        <Text style={styles.miniBtnText}>Download</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                <TouchableOpacity style={styles.resetLink} onPress={openResetSheet}>
                  <Ionicons name="trash-outline" size={15} color="#DC2626" />
                  <Text style={styles.resetLinkText}>Reset offline data…</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.infoBox}>
                <Ionicons name="information-circle" size={14} color="#6B7280" />
                <Text style={styles.infoText}>
                  Tap barangay markers to view classified areas and hazard zones
                </Text>
              </View>
            </View>
          )}

          <View style={styles.mapContainer}>
            {loading ? (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color="#0F4A2F" />
                <Text style={styles.loadingText}>Loading map data...</Text>
              </View>
            ) : (
              <>
                <WebView
                  ref={webViewRef}
                  source={{ html: mapHtml }}
                  style={styles.map}
                  javaScriptEnabled={true}
                  domStorageEnabled={true}
                  originWhitelist={["*"]}
                  startInLoadingState={true}
                  // Offline: use cached tiles even if they're "expired"
                  cacheEnabled={true}
                  cacheMode={isOnline ? "LOAD_DEFAULT" : "LOAD_CACHE_ELSE_NETWORK"}
                  onLoadEnd={() => setMapReady(true)}
                  onMessage={onWebViewMessage}
                  renderLoading={() => (
                    <View style={styles.loadingOverlay}>
                      <ActivityIndicator size="large" color="#0F4A2F" />
                    </View>
                  )}
                />

                <HazardVignette
                  visible={
                    shouldShowAlertIndicator &&
                    isLocationEnabled &&
                    alerts.length > 0
                  }
                />

                {shouldShowAlertIndicator && isLocationEnabled && (
                  <View style={styles.hazardIndicatorContainer}>
                    <HazardIndicator
                      alerts={alerts}
                      onPress={() => {
                        if (alerts.length > 0) handleAlertPress(alerts[0]);
                      }}
                    />
                  </View>
                )}
              </>
            )}
          </View>

          <View style={styles.infoBar}>
            <View style={styles.legendItem}>
              <View
                style={[styles.legendDot, { backgroundColor: "#3b82f6" }]}
              />
              <Text style={styles.legendText}>You</Text>
            </View>
            <View style={styles.legendItem}>
              <View
                style={[styles.legendDot, { backgroundColor: "#16a34a" }]}
              />
              <Text style={styles.legendText}>Site</Text>
            </View>
            <View style={styles.legendItem}>
              <View
                style={[styles.legendDot, { backgroundColor: "#eab308" }]}
              />
              <Text style={styles.legendText}>Area</Text>
            </View>
            <View style={styles.legendItem}>
              <View
                style={[styles.legendDot, { backgroundColor: "#f59e0b" }]}
              />
              <Text style={styles.legendText}>Barangay</Text>
            </View>

            {userCoordinates && (
              <View style={styles.coordDisplay}>
                <Ionicons name="location" size={12} color="#0F4A2F" />
                <Text style={styles.coordDisplayText} numberOfLines={1}>
                  {userCoordinates.lat.toFixed(5)},{" "}
                  {userCoordinates.lng.toFixed(5)}
                </Text>
                <View style={styles.signalBarsMini}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <View
                      key={n}
                      style={[
                        styles.signalBarMini,
                        {
                          height: 3 + n * 2,
                          opacity:
                            n <= getSignalLevel(userCoordinates.accuracy)
                              ? 1
                              : 0.2,
                        },
                      ]}
                    />
                  ))}
                </View>
                {userCoordinates.accuracy !== null && (
                  <View style={styles.accuracyBadge}>
                    <Text style={styles.accuracyText}>
                      ±{Math.round(userCoordinates.accuracy)}m
                    </Text>
                  </View>
                )}
                {userCoordinates.isFallback && (
                  <View style={styles.cachedBadge}>
                    <Text style={styles.cachedText}>Cached</Text>
                  </View>
                )}
              </View>
            )}

            <TouchableOpacity
              style={[styles.areaBtn, !hasAreaLocation && { opacity: 0.5 }]}
              onPress={() => goToArea()}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="pine-tree" size={16} color="#fff" />
              <Text style={styles.recenterText}>Go to Area</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.recenterBtn,
                { marginLeft: 6 },
                (isLocationEnabled || isAcquiringLocation) &&
                  styles.recenterBtnActive,
              ]}
              onPress={handleLocationToggle}
              disabled={isAcquiringLocation}
              activeOpacity={0.8}
            >
              {isAcquiringLocation ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons
                  name={isLocationEnabled ? "navigate" : "navigate-outline"}
                  size={18}
                  color="#fff"
                />
              )}
              <Text style={styles.recenterText}>
                {isAcquiringLocation
                  ? `Acquiring (${gpsCountdown}s)`
                  : isLocationEnabled
                    ? "Turn Off"
                    : "Enable Location"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        <ToastHost />
      </Modal>

      {/* ── Save Map Offline: settings + live estimate ── */}
      <Modal
        transparent
        visible={showSaveSheet}
        animationType="slide"
        onRequestClose={() => setShowSaveSheet(false)}
      >
        <View style={styles.sheetOverlay}>
          {/* Backdrop sits behind the sheet so it doesn't steal scroll gestures */}
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowSaveSheet(false)} />
          <View style={[styles.saveSheet, sheetSafeBottom]}>
            <View style={styles.dragHandle} />
            <View style={styles.saveHeader}>
              <Text style={styles.saveTitle}>Save Map Offline</Text>
              <TouchableOpacity
                style={styles.guideLink}
                onPress={() => setShowGuide(true)}
                hitSlop={8}
              >
                <Ionicons name="help-circle-outline" size={18} color="#0F4A2F" />
                <Text style={styles.guideLinkText}>Guide</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              style={{ flexShrink: 1 }}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
            >
              {/* Cover */}
              <Text style={styles.saveLabel}>Cover</Text>
              {saveTargets.map((t) => {
                const active = saveTarget?.key === t.key;
                const preview = buildDownloadPlan(t.extent, saveOpts);
                return (
                  <TouchableOpacity
                    key={t.key}
                    style={[styles.targetRow, active && styles.targetRowActive]}
                    onPress={() => setSaveTargetKey(t.key)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={active ? "radio-button-on" : "radio-button-off"}
                      size={18}
                      color={active ? "#0F4A2F" : "#9CA3AF"}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.targetLabel}>{t.label}</Text>
                      <Text style={styles.targetDetail} numberOfLines={1}>
                        {t.detail}
                      </Text>
                    </View>
                    <Text style={styles.targetSize}>{formatArea(preview.detailKm2)}</Text>
                  </TouchableOpacity>
                );
              })}

              {/* Closest zoom */}
              <Text style={styles.saveLabel}>Closest zoom</Text>
              <View style={styles.chipRow}>
                {(["auto", 15, 16, 17, 18] as const).map((z) => (
                  <TouchableOpacity
                    key={String(z)}
                    style={[styles.optChip, saveOpts.maxZoom === z && styles.optChipActive]}
                    onPress={() => setSaveOpts((o) => ({ ...o, maxZoom: z }))}
                  >
                    <Text
                      style={[styles.optChipText, saveOpts.maxZoom === z && styles.optChipTextActive]}
                    >
                      {z === "auto" ? "Auto" : z}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {savePlan && (
                <Text style={styles.saveHint}>
                  Zoom {savePlan.maxZoom}: one tile ≈ {tileWidthMeters(savePlan.maxZoom)} m wide
                  {savePlan.maxZoom >= 18
                    ? " — paths and tree clusters"
                    : savePlan.maxZoom >= 17
                      ? " — houses and trails"
                      : savePlan.maxZoom >= 16
                        ? " — fields and small roads"
                        : " — roads and land shapes"}
                  {saveOpts.maxZoom === "auto" ? " (picked automatically)" : ""}
                </Text>
              )}

              {/* Close-up margin */}
              <Text style={styles.saveLabel}>Close-up margin</Text>
              <View style={styles.chipRow}>
                {([
                  ["tight", "Tight ~110 m"],
                  ["normal", "Normal"],
                  ["wide", "Wide +1 km"],
                ] as const).map(([k, label]) => (
                  <TouchableOpacity
                    key={k}
                    style={[styles.optChip, saveOpts.detailMargin === k && styles.optChipActive]}
                    onPress={() => setSaveOpts((o) => ({ ...o, detailMargin: k }))}
                  >
                    <Text
                      style={[styles.optChipText, saveOpts.detailMargin === k && styles.optChipTextActive]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Surroundings */}
              <Text style={styles.saveLabel}>Surroundings (zoom 10–13)</Text>
              <View style={styles.chipRow}>
                {([0, 1, 3, 5] as const).map((km) => (
                  <TouchableOpacity
                    key={km}
                    style={[styles.optChip, saveOpts.contextKm === km && styles.optChipActive]}
                    onPress={() => setSaveOpts((o) => ({ ...o, contextKm: km }))}
                  >
                    <Text
                      style={[styles.optChipText, saveOpts.contextKm === km && styles.optChipTextActive]}
                    >
                      {km === 0 ? "None" : `${km} km`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Estimate */}
              {savePlan && (
                <View style={styles.estimateCard}>
                  <View style={styles.estimateRow}>
                    <View style={styles.estimateStat}>
                      <Text style={styles.estimateValue}>{savePlan.tiles.toLocaleString()}</Text>
                      <Text style={styles.estimateLabel}>tiles</Text>
                    </View>
                    <View style={styles.estimateStat}>
                      <Text style={styles.estimateValue}>{formatMB(savePlan.estimateMB)}</Text>
                      <Text style={styles.estimateLabel}>about</Text>
                    </View>
                    <View style={styles.estimateStat}>
                      <Text style={styles.estimateValue}>
                        {savePlan.minZoom}–{savePlan.maxZoom}
                      </Text>
                      <Text style={styles.estimateLabel}>zoom</Text>
                    </View>
                  </View>
                  <Text style={styles.estimateLine}>
                    Close-up area: {formatArea(savePlan.detailKm2)} · Total covered:{" "}
                    {formatArea(savePlan.contextKm2)}
                  </Text>
                  <View style={styles.zoomBreakdown}>
                    {savePlan.perZoom.map((l) => (
                      <View key={l.z} style={styles.zoomCell}>
                        <Text style={styles.zoomCellZ}>z{l.z}</Text>
                        <Text style={styles.zoomCellN}>{l.tiles.toLocaleString()}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {savePlan?.blocked ? (
                <Text style={[styles.saveWarn, styles.saveWarnError]}>
                  Too large ({HARD_MAX_TILES.toLocaleString()} tile limit). Lower the closest zoom or margin.
                </Text>
              ) : savePlan?.tooLarge ? (
                <Text style={styles.saveWarn}>Big download — use Wi-Fi if you can.</Text>
              ) : null}
              {savePlan?.reducedZoom && (
                <Text style={styles.saveWarn}>
                  Large area: Auto limited the closest zoom to {savePlan.maxZoom} to stay near{" "}
                  {MAX_TILES.toLocaleString()} tiles.
                </Text>
              )}
              <Text style={styles.saveHint}>Keep the map open and the screen on until it finishes.</Text>
            </ScrollView>

            <View style={styles.saveBtnRow}>
              <TouchableOpacity
                style={styles.saveCancelBtn}
                onPress={() => setShowSaveSheet(false)}
              >
                <Text style={styles.saveCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveGoBtn, (!savePlan || savePlan.blocked) && { opacity: 0.4 }]}
                onPress={startMapDownload}
                disabled={!savePlan || savePlan.blocked}
              >
                <Ionicons name="cloud-download-outline" size={16} color="#fff" />
                <Text style={styles.saveGoText}>Download</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Reset offline data ── */}
      <Modal
        transparent
        visible={showResetSheet}
        animationType="slide"
        onRequestClose={() => !resetting && setShowResetSheet(false)}
      >
        <View style={styles.sheetOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => !resetting && setShowResetSheet(false)}
          />
          <View style={[styles.saveSheet, sheetSafeBottom]}>
            <View style={styles.dragHandle} />
            <View style={styles.saveHeader}>
              <Text style={styles.saveTitle}>Reset Offline Data</Text>
              <TouchableOpacity
                onPress={() => setShowResetSheet(false)}
                hitSlop={8}
                disabled={resetting}
              >
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <Text style={styles.saveHint}>
              Choose what to delete from this phone. Use this to free storage or to start over
              if the offline map looks wrong.
            </Text>

            <ScrollView style={{ flexShrink: 1 }} showsVerticalScrollIndicator={false}>
              {([
                {
                  key: "tiles",
                  icon: "map-outline",
                  title: "Saved map tiles",
                  sub: mapBackgroundInfo
                    ? `${mapBackgroundInfo.tiles.toLocaleString()} tiles saved here · removed for ALL areas`
                    : "Map background images · removed for ALL areas",
                },
                {
                  key: "locations",
                  icon: "location-outline",
                  title: siteId ? "Saved site & area locations" : "Saved area location",
                  sub: siteId
                    ? "Area pin/outline, site boundary and potential sites (this area and site)"
                    : "Area pin and outline (this area)",
                },
                {
                  key: "polygons",
                  icon: "shield-outline",
                  title: "Hazard & classification polygons",
                  sub: hasDownloadedPolygons
                    ? `${(downloadedStats.classified + downloadedStats.hazards).toLocaleString()} polygons · ${downloadedStats.size} · hazard warnings stop offline`
                    : "None downloaded",
                },
              ] as const).map((item) => {
                const checked = resetSel[item.key];
                return (
                  <TouchableOpacity
                    key={item.key}
                    style={[styles.targetRow, checked && styles.resetRowActive]}
                    onPress={() =>
                      setResetSel((s) => ({ ...s, [item.key]: !s[item.key] }))
                    }
                    activeOpacity={0.7}
                    disabled={resetting}
                  >
                    <Ionicons
                      name={checked ? "checkbox" : "square-outline"}
                      size={20}
                      color={checked ? "#DC2626" : "#9CA3AF"}
                    />
                    <Ionicons name={item.icon} size={18} color="#374151" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.targetLabel}>{item.title}</Text>
                      <Text style={styles.targetDetail}>{item.sub}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}

              <Text style={styles.saveHint}>
                Assessments, drafts and areas/sites saved on the Assess tab are not affected.
              </Text>
              {!isOnline && (
                <Text style={[styles.saveWarn, styles.saveWarnError]}>
                  You're offline. Anything you delete can't be downloaded again until you're
                  back online.
                </Text>
              )}
            </ScrollView>

            <View style={styles.saveBtnRow}>
              <TouchableOpacity
                style={styles.saveCancelBtn}
                onPress={() => setShowResetSheet(false)}
                disabled={resetting}
              >
                <Text style={styles.saveCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.saveGoBtn,
                  { backgroundColor: "#DC2626" },
                  (resetting ||
                    (!resetSel.tiles && !resetSel.locations && !resetSel.polygons)) && {
                    opacity: 0.4,
                  },
                ]}
                onPress={confirmReset}
                disabled={
                  resetting || (!resetSel.tiles && !resetSel.locations && !resetSel.polygons)
                }
              >
                {resetting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="trash-outline" size={16} color="#fff" />
                )}
                <Text style={styles.saveGoText}>Delete selected</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Offline map user guide ── */}
      <Modal
        transparent
        visible={showGuide}
        animationType="slide"
        onRequestClose={() => setShowGuide(false)}
      >
        <View style={styles.sheetOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowGuide(false)} />
          <View style={[styles.saveSheet, sheetSafeBottom]}>
            <View style={styles.dragHandle} />
            <View style={styles.saveHeader}>
              <Text style={styles.saveTitle}>Save Map Offline: Guide</Text>
              <TouchableOpacity onPress={() => setShowGuide(false)} hitSlop={8}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <ScrollView
              showsVerticalScrollIndicator
              style={{ flexShrink: 1 }}
              nestedScrollEnabled
            >
              <SaveMapGuide
                plan={showSaveSheet ? savePlan : null}
                opts={saveOpts}
                isExample={!(showSaveSheet && savePlan)}
              />
              <View style={{ height: 12 }} />
            </ScrollView>
            <TouchableOpacity
              style={[styles.saveGoBtn, { flex: 0, marginTop: 10 }]}
              onPress={() => setShowGuide(false)}
            >
              <Text style={styles.saveGoText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        transparent
        visible={showBarangaySheet}
        animationType="slide"
        onRequestClose={() => setShowBarangaySheet(false)}
      >
        <Pressable
          style={styles.sheetOverlay}
          onPress={() => setShowBarangaySheet(false)}
        >
          <Pressable
            style={[styles.sheetContent, sheetSafeBottom]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.dragHandle} />
            <View style={styles.sheetHeader}>
              <Ionicons name="location" size={24} color="#eab308" />
              <Text style={styles.sheetTitle}>{selectedBarangay?.name}</Text>
            </View>
            <Text style={styles.sheetSubtitle}>Barangay Layers & Analysis</Text>

            <TouchableOpacity
              style={[
                styles.sheetActionBtn,
                loadingClassified && styles.sheetActionBtnDisabled,
              ]}
              onPress={viewClassifiedAreas}
              disabled={loadingClassified}
            >
              <View
                style={[styles.sheetIconWrap, { backgroundColor: "#dcfce7" }]}
              >
                {loadingClassified ? (
                  <ActivityIndicator size="small" color="#16a34a" />
                ) : (
                  <Ionicons name="layers" size={20} color="#16a34a" />
                )}
              </View>
              <View style={styles.sheetTextWrap}>
                <Text style={styles.sheetActionTitle}>
                  View Classified Areas
                </Text>
                <Text style={styles.sheetActionDesc}>
                  Show land use polygons
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.sheetActionBtn,
                loadingHazards && styles.sheetActionBtnDisabled,
              ]}
              onPress={viewHazardAreas}
              disabled={loadingHazards}
            >
              <View
                style={[styles.sheetIconWrap, { backgroundColor: "#fee2e2" }]}
              >
                {loadingHazards ? (
                  <ActivityIndicator size="small" color="#ef4444" />
                ) : (
                  <Ionicons name="warning" size={20} color="#ef4444" />
                )}
              </View>
              <View style={styles.sheetTextWrap}>
                <Text style={styles.sheetActionTitle}>View Hazard Areas</Text>
                <Text style={styles.sheetActionDesc}>
                  Show flood/landslide zones
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sheetActionBtn, { backgroundColor: "#f3f4f6" }]}
              onPress={hidePolygons}
            >
              <View
                style={[styles.sheetIconWrap, { backgroundColor: "#e5e7eb" }]}
              >
                <Ionicons name="eye-off" size={20} color="#6b7280" />
              </View>
              <Text style={[styles.sheetActionTitle, { color: "#6b7280" }]}>
                Hide All Layers
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
        <ToastHost />
      </Modal>

      <PolygonAlertModal
        visible={showAlertModal}
        alert={selectedAlert}
        onClose={() => {
          setShowAlertModal(false);
          setSelectedAlert(null);
        }}
      />

      <Modal
        visible={showDownloadOptions}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDownloadOptions(false)}
      >
        <Pressable
          style={styles.downloadOptionsOverlay}
          onPress={() => setShowDownloadOptions(false)}
        >
          <Pressable
            style={[styles.downloadOptionsContent, sheetSafeBottom]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.dragHandle} />
            <Text style={styles.downloadOptionsTitle}>
               Download Polygons
            </Text>
            <Text style={styles.downloadOptionsSubtitle}>
              Choose what polygons to download for offline detection
            </Text>

            {hasDownloadedPolygons && (
              <View style={styles.downloadedStats}>
                <Ionicons name="checkmark-circle" size={16} color="#16a34a" />
                <Text style={styles.downloadedStatsText}>
                  Already downloaded: {downloadedStats.classified} classified,{" "}
                  {downloadedStats.hazards} hazards ({downloadedStats.size})
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.downloadOption,
                downloadOption === "all" && styles.downloadOptionActive,
              ]}
              onPress={() => setDownloadOption("all")}
            >
              <View style={styles.downloadOptionLeft}>
                <Ionicons
                  name={
                    downloadOption === "all"
                      ? "radio-button-on"
                      : "radio-button-off"
                  }
                  size={20}
                  color={downloadOption === "all" ? "#0F4A2F" : "#9CA3AF"}
                />
                <View>
                  <Text style={styles.downloadOptionTitle}>All Polygons</Text>
                  <Text style={styles.downloadOptionDesc}>
                    Download all classified and hazard areas (up to 200
                    polygons)
                  </Text>
                </View>
              </View>
              <View style={styles.downloadOptionBadge}>
                <Text style={styles.downloadOptionBadgeText}>~5MB</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.downloadOption,
                downloadOption === "barangay" && styles.downloadOptionActive,
              ]}
              onPress={() => setDownloadOption("barangay")}
            >
              <View style={styles.downloadOptionLeft}>
                <Ionicons
                  name={
                    downloadOption === "barangay"
                      ? "radio-button-on"
                      : "radio-button-off"
                  }
                  size={20}
                  color={downloadOption === "barangay" ? "#0F4A2F" : "#9CA3AF"}
                />
                <View>
                  <Text style={styles.downloadOptionTitle}>By Barangay</Text>
                  <Text style={styles.downloadOptionDesc}>
                    Download polygons for selected barangays only
                  </Text>
                </View>
              </View>
              <View style={styles.downloadOptionBadge}>
                <Text style={styles.downloadOptionBadgeText}>~1-3MB</Text>
              </View>
            </TouchableOpacity>

            {downloadOption === "barangay" && (
              <View style={styles.barangaySelection}>
                <Text style={styles.barangaySelectionTitle}>
                  Select Barangays ({selectedBarangays.length})
                </Text>
                <ScrollView style={styles.barangayList} nestedScrollEnabled>
                  {availableBarangays.map((b) => (
                    <TouchableOpacity
                      key={b.id}
                      style={[
                        styles.barangayItem,
                        selectedBarangays.includes(b.id) &&
                          styles.barangayItemSelected,
                      ]}
                      onPress={() => toggleBarangay(b.id)}
                    >
                      <Text
                        style={[
                          styles.barangayItemText,
                          selectedBarangays.includes(b.id) &&
                            styles.barangayItemTextSelected,
                        ]}
                      >
                        {b.name}
                      </Text>
                      {selectedBarangays.includes(b.id) && (
                        <Ionicons
                          name="checkmark-circle"
                          size={18}
                          color="#0F4A2F"
                        />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <View style={styles.downloadActions}>
              <TouchableOpacity
                style={styles.downloadCancelBtn}
                onPress={() => setShowDownloadOptions(false)}
              >
                <Text style={styles.downloadCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.downloadConfirmBtn,
                  downloadOption === "barangay" &&
                    selectedBarangays.length === 0 &&
                    styles.downloadConfirmBtnDisabled,
                ]}
                onPress={handleDownloadWithOptions}
                disabled={
                  downloadOption === "barangay" &&
                  selectedBarangays.length === 0
                }
              >
                <Ionicons
                  name="cloud-download-outline"
                  size={18}
                  color="#fff"
                />
                <Text style={styles.downloadConfirmText}>Download</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
        <ToastHost />
      </Modal>

      <Modal
        transparent
        visible={showDownloadModal}
        animationType="fade"
        onRequestClose={() => {
          if (!isDownloading) setShowDownloadModal(false);
        }}
      >
        <View style={styles.downloadModalOverlay}>
          <View style={styles.downloadModalContent}>
            <Text style={styles.downloadModalTitle}>
              {isDownloading ? "Downloading..." : "Complete"}
            </Text>
            <View style={styles.downloadProgressBar}>
              <View
                style={[
                  styles.downloadProgressFill,
                  { width: `${downloadProgress}%` },
                ]}
              />
            </View>
            <Text style={styles.downloadProgressText}>{downloadProgress}%</Text>
            <Text style={styles.downloadStatusText}>{downloadStatus}</Text>
            {!isDownloading && downloadProgress === 100 && (
              <TouchableOpacity
                style={styles.downloadModalCloseBtn}
                onPress={() => setShowDownloadModal(false)}
              >
                <Text style={styles.downloadModalCloseText}>Close</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
        <ToastHost />
      </Modal>
    </>
  );
}

// 🌐 LEAFLET HTML WITH OFFLINE SUPPORT & BOUNDARY POLYGON
const mapHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    body { margin: 0; padding: 0; }
    #map { width: 100vw; height: 100vh; }
    .custom-div-icon { background: transparent; border: none; }
    .marker-pin { width: 30px; height: 30px; border-radius: 50% 50% 50% 0; background: #fff; position: absolute; transform: rotate(-45deg); left: 50%; top: 50%; margin: -15px 0 0 -15px; box-shadow: 0 2px 5px rgba(0,0,0,0.3); }
    .marker-pin::after { content: ''; width: 24px; height: 24px; margin: 3px 0 0 3px; background: #fff; position: absolute; border-radius: 50%; }
    .marker-pin.yellow { background: #eab308; } .marker-pin.yellow::after { background: #fde047; }
    .marker-pin.green { background: #16a34a; } .marker-pin.green::after { background: #bbf7d0; }
    .marker-pin.blue { background: #2563eb; } .marker-pin.blue::after { background: #bfdbfe; }
    .icon-label { position: absolute; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; transform: rotate(45deg); font-weight: bold; font-size: 12px; color: #000; }
    .pulse-ring { animation: pulse 1.5s ease-out infinite; }
    @keyframes pulse { 0% { opacity: 0.8; transform: scale(1); } 100% { opacity: 0; transform: scale(2.5); } }
    
    /* Assessment point popup styles */
    .point-popup { font-family: sans-serif; min-width: 180px; }
    .point-popup h4 { margin: 0 0 8px 0; font-size: 13px; font-weight: bold; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
    .point-popup .detail { margin-bottom: 6px; }
    .point-popup .detail-label { font-size: 10px; color: #6b7280; text-transform: uppercase; font-weight: bold; margin-bottom: 2px; }
    .point-popup .detail-value { font-size: 12px; font-weight: 600; color: #1f2937; font-family: monospace; }
    .point-popup .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; margin-top: 4px; }
    .badge-assessment { background: #dbeafe; color: #1e40af; }
    .badge-photo { background: #fef3c7; color: #92400e; }
    .badge-manual { background: #f3e8ff; color: #6b21a8; }
    .badge-vertex { background: #f3e8ff; color: #6b21a8; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { center: [11.02, 124.61], zoom: 13, zoomControl: true, fadeAnimation: true, zoomAnimation: true });
    // maxNativeZoom 18 = deepest saved level; zoom 19 just enlarges z18 tiles (works offline too)
    var baseTileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, maxNativeZoom: 18, attribution: '© OSM' }).addTo(map);
    var markers = { barangay: {}, area: null, site: null, user: null };
    var polygonLayers = { classified: null, hazards: null, boundary: null, potential: null, site: null };
    var barangaysVisible = true;
    var hazardTiles = { flood: null, landslide: null };
    var userPulse = null;
    var assessmentPointsLayer = null;

    function createIcon(colorClass, label) {
      return L.divIcon({ className: 'custom-div-icon', html: '<div class="marker-pin ' + colorClass + '"></div><div class="icon-label">' + label + '</div>', iconSize: [30, 30], iconAnchor: [15, 30] });
    }

    function createAssessmentPointIcon(type) {
      const icons = {
        assessment: { color: '#2563eb', emoji: '📍', size: 32 },
        photo: { color: '#f59e0b', emoji: '📷', size: 28 },
        manual: { color: '#7c3aed', emoji: '️', size: 28 },
        polygon_vertex: { color: '#7c3aed', emoji: '🔷', size: 28 }
      };
      const icon = icons[type] || icons.assessment;
      return L.divIcon({
        className: 'custom-assessment-icon',
        html: '<div style="background:' + icon.color + ';width:' + icon.size + 'px;height:' + icon.size + 'px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:14px;">' + icon.emoji + '</div>',
        iconSize: [icon.size, icon.size],
        iconAnchor: [icon.size / 2, icon.size]
      });
    }

    function createPointPopup(point) {
      const typeLabels = { 
        assessment: 'Assessment Location', 
        photo: 'Photo Location', 
        manual: 'Manual Input',
        polygon_vertex: 'Boundary Vertex'
      };
      const badgeClasses = { 
        assessment: 'badge-assessment', 
        photo: 'badge-photo', 
        manual: 'badge-manual',
        polygon_vertex: 'badge-vertex'
      };
      
      let html = '<div class="point-popup">';
      html += '<h4 style="color:' + (point.type === 'assessment' ? '#2563eb' : point.type === 'photo' ? '#f59e0b' : '#7c3aed') + '">' + point.label + '</h4>';
      html += '<span class="badge ' + badgeClasses[point.type] + '">' + typeLabels[point.type] + '</span>';
      html += '<div class="detail" style="margin-top:8px;">';
      html += '<div class="detail-label">Coordinates</div>';
      html += '<div class="detail-value">' + point.lat.toFixed(6) + '°, ' + point.lng.toFixed(6) + '°</div></div>';
      
      if (point.accuracy) {
        html += '<div class="detail"><div class="detail-label">Accuracy</div><div class="detail-value">±' + Math.round(point.accuracy) + 'm</div></div>';
      }
      if (point.timestamp) {
        html += '<div class="detail"><div class="detail-label">Timestamp</div><div class="detail-value">' + point.timestamp + '</div></div>';
      }
      if (point.description) {
        html += '<div class="detail"><div class="detail-label">Description</div><div style="font-size:11px;color:#4b5563;margin-top:2px;">' + point.description + '</div></div>';
      }
      
      html += '</div>';
      return html;
    }

    function sendClick(category, id) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'marker_click', category: category, id: id }));
    }

    window.updateMap = function(action, payload) {
      try {
        if (action === 'addBarangays') {
          payload.forEach(b => {
            if (markers.barangay[b.id]) map.removeLayer(markers.barangay[b.id]);
            var m = L.marker([b.lat, b.lng], { icon: createIcon('yellow', 'B') });
            if (barangaysVisible) m.addTo(map);
            m.on('click', () => sendClick('barangay', b.id));
            m.bindPopup('<b>Barangay:</b> ' + b.name);
            markers.barangay[b.id] = m;
          });
        }
        else if (action === 'addArea') {
          if (markers.area) map.removeLayer(markers.area);
          markers.area = L.marker([payload.lat, payload.lng], { icon: L.divIcon({ className: 'custom', html: '<div style="background:#eab308;width:32px;height:32px;border-radius:50%;border:4px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:bold;font-size:13px;">A</div>', iconSize: [32, 32], iconAnchor: [16, 16] }) }).addTo(map).bindPopup('<b>Area:</b> ' + payload.name);
        }
        else if (action === 'addSite') {
          if (markers.site) map.removeLayer(markers.site);
          markers.site = L.marker([payload.lat, payload.lng], { icon: L.divIcon({ className: 'custom', html: '<div style="background:#16a34a;width:36px;height:36px;border-radius:50%;border:4px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:bold;font-size:14px;">S</div>', iconSize: [36, 36], iconAnchor: [18, 18] }) }).addTo(map).bindPopup('<b>Site:</b> ' + payload.name);
        }
        else if (action === 'addUserLocation') {
          if (markers.user) map.removeLayer(markers.user);
          if (userPulse) map.removeLayer(userPulse);
          markers.user = L.circleMarker([payload.lat, payload.lng], { radius: 12, color: '#ffffff', fillColor: '#3b82f6', fillOpacity: 0.9, weight: 3 }).addTo(map).bindPopup('<b>You are here</b>');
          userPulse = L.circleMarker([payload.lat, payload.lng], { radius: 20, color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.15, weight: 2, className: 'pulse-ring' }).addTo(map);
          setTimeout(function() { if (userPulse) map.removeLayer(userPulse); userPulse = null; }, 1500);
        }
        else if (action === 'addAssessmentPoints') {
          if (!assessmentPointsLayer) {
            assessmentPointsLayer = L.layerGroup();
            assessmentPointsLayer.addTo(map);
          }
          
          payload.forEach(point => {
            try {
              const marker = L.marker([point.lat, point.lng], {
                icon: createAssessmentPointIcon(point.type)
              });
              const popupContent = createPointPopup(point);
              marker.bindPopup(popupContent);
              marker.addTo(assessmentPointsLayer);
            } catch (e) {
              console.warn('Error drawing assessment point:', e);
            }
          });
        }
        else if (action === 'clearAssessmentPoints') {
          if (assessmentPointsLayer) {
            map.removeLayer(assessmentPointsLayer);
            assessmentPointsLayer = null;
          }
        }
        else if (action === 'drawBoundaryPolygon') {
          // Remove existing boundary polygon
          if (polygonLayers.boundary) {
            map.removeLayer(polygonLayers.boundary);
            polygonLayers.boundary = null;
          }
          
          // Draw new filled polygon with auto-close
          if (payload.coordinates && payload.coordinates.length >= 3) {
            try {
              const polygon = L.polygon(payload.coordinates, {
                color: payload.color || '#7C3AED',
                fillColor: payload.fillColor || 'rgba(124, 58, 237, 0.2)',
                fillOpacity: 0.3,
                weight: 3,
                opacity: 0.8
              });
              polygon.bindPopup('<b>' + (payload.name || 'Boundary Polygon') + '</b><br>Vertices: ' + payload.coordinates.length);
              polygon.addTo(map);
              polygonLayers.boundary = polygon;
            } catch (e) {
              console.error('Error drawing boundary polygon:', e);
            }
          }
        }
        else if (action === 'clearBoundaryPolygon') {
          if (polygonLayers.boundary) {
            map.removeLayer(polygonLayers.boundary);
            polygonLayers.boundary = null;
          }
        }
        else if (action === 'flyTo') {
          var zoomLevel = map.getZoom();
          if (payload.zoom) zoomLevel = payload.zoom;
          map.flyTo([payload.lat, payload.lng], zoomLevel);
        }
        else if (action === 'fitBounds') {
          map.fitBounds(payload, { padding: [50, 50], maxZoom: 16 });
        }
        else if (action === 'drawClassifiedPolygons') {
          if (polygonLayers.classified) { map.removeLayer(polygonLayers.classified); polygonLayers.classified = null; }
          var group = L.layerGroup();
          payload.forEach(p => {
            try { L.polygon(p.coordinates, { color: p.color, fillColor: p.color, fillOpacity: 0.4, weight: 2 }).bindPopup('<b>' + p.name + '</b><br>Class: ' + p.classification).addTo(group); } 
            catch(e) { console.warn('Error drawing classified polygon:', e); }
          });
          group.addTo(map); polygonLayers.classified = group;
        }
        else if (action === 'drawHazardPolygons') {
          if (polygonLayers.hazards) { map.removeLayer(polygonLayers.hazards); polygonLayers.hazards = null; }
          var group = L.layerGroup();
          payload.forEach(p => {
            try { L.polygon(p.coordinates, { color: p.color, fillColor: p.color, fillOpacity: 0.4, weight: 2 }).bindPopup('<b>' + p.name + '</b><br>Type: ' + p.type).addTo(group); }
            catch(e) { console.warn('Error drawing hazard polygon:', e); }
          });
          group.addTo(map); polygonLayers.hazards = group;
        }
        else if (action === 'drawPotentialSites') {
          if (polygonLayers.potential) { map.removeLayer(polygonLayers.potential); polygonLayers.potential = null; }
          var group = L.featureGroup();
          payload.forEach(function(p) {
            try {
              var fmt = function(v, d) { return (v === null || v === undefined || isNaN(Number(v))) ? 'N/A' : Number(v).toFixed(d); };
              var popup = '<div style="min-width:180px;font-family:system-ui;">'
                + '<div style="font-weight:700;color:#dc2626;font-size:14px;border-bottom:1px solid #eee;padding-bottom:4px;margin-bottom:6px;">Potential Site ' + p.index + '</div>'
                + '<div style="font-size:12px;margin-bottom:3px;"><b>Area:</b> ' + fmt(p.area_hectares, 2) + ' ha</div>'
                + '<div style="font-size:12px;margin-bottom:3px;"><b>Avg NDVI:</b> ' + fmt(p.avg_ndvi, 3) + '</div>'
                + '<div style="font-size:12px;"><b>Suitability:</b> ' + fmt(p.suitability_score, 1) + '</div>'
                + '</div>';
              // Same style as the web map
              L.geoJSON(p.geometry, {
                style: { color: '#dc2626', weight: 2, fillColor: '#fecaca', fillOpacity: 0.5, dashArray: '4, 4' }
              }).bindPopup(popup).addTo(group);
            } catch (e) { console.warn('Error drawing potential site:', e); }
          });
          group.addTo(map);
          polygonLayers.potential = group;
          try {
            var b = group.getBounds();
            if (b.isValid()) map.fitBounds(b, { padding: [40, 40], maxZoom: 17 });
          } catch (e) {}
        }
        else if (action === 'flyToArea') {
          // Center on the area marker and show its name
          map.flyTo([payload.lat, payload.lng], payload.zoom || 15, { duration: 0.8 });
          if (markers.area) setTimeout(function() { markers.area.openPopup(); }, 850);
        }
        else if (action === 'setBarangaysVisible') {
          barangaysVisible = !!payload;
          Object.keys(markers.barangay).forEach(function(id) {
            var m = markers.barangay[id];
            if (barangaysVisible) { if (!map.hasLayer(m)) m.addTo(map); }
            else if (map.hasLayer(m)) map.removeLayer(m);
          });
        }
        else if (action === 'drawSiteBoundary') {
          if (polygonLayers.site) { map.removeLayer(polygonLayers.site); polygonLayers.site = null; }
          var siteGroup = L.featureGroup();
          var coords = payload.coordinates || [];
          var area = (payload.area_hectares === null || payload.area_hectares === undefined) ? 'N/A' : Number(payload.area_hectares).toFixed(2) + ' ha';
          if (coords.length >= 3) {
            var poly = L.polygon(coords, { color: '#16a34a', weight: 3, fillColor: '#22c55e', fillOpacity: 0.18 });
            poly.bindPopup('<div style="font-family:system-ui;min-width:170px;">'
              + '<div style="font-weight:700;color:#15803d;font-size:14px;margin-bottom:4px;">' + payload.name + '</div>'
              + '<div style="font-size:12px;"><b>Area:</b> ' + area + '</div>'
              + '<div style="font-size:12px;"><b>Status:</b> ' + (payload.status || 'N/A') + '</div>'
              + '<div style="font-size:12px;"><b>Boundary points:</b> ' + coords.length + '</div></div>');
            poly.addTo(siteGroup);
            // Small numbered vertices so the boundary can be walked in the field
            coords.forEach(function(c, i) {
              L.circleMarker(c, { radius: 4, color: '#ffffff', weight: 1.5, fillColor: '#15803d', fillOpacity: 1 })
                .bindPopup('<b>Point ' + (i + 1) + '</b><br>' + c[0].toFixed(6) + ', ' + c[1].toFixed(6))
                .addTo(siteGroup);
            });
          }
          if (payload.marker) {
            L.marker(payload.marker, { icon: L.divIcon({ className: 'custom', html: '<div style="background:#16a34a;width:36px;height:36px;border-radius:50%;border:4px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:bold;font-size:14px;">S</div>', iconSize: [36, 36], iconAnchor: [18, 18] }) })
              .bindPopup('<b>' + payload.name + '</b><br>' + payload.marker[0].toFixed(6) + ', ' + payload.marker[1].toFixed(6))
              .addTo(siteGroup);
          }
          siteGroup.addTo(map);
          polygonLayers.site = siteGroup;
          try {
            if (coords.length >= 3) {
              var sb = siteGroup.getBounds();
              if (sb.isValid()) map.fitBounds(sb, { padding: [40, 40], maxZoom: 18 });
            } else if (payload.marker) {
              map.flyTo(payload.marker, 17);
            }
          } catch (e) {}
        }
        else if (action === 'clearSiteBoundary') {
          if (polygonLayers.site) { map.removeLayer(polygonLayers.site); polygonLayers.site = null; }
        }
        else if (action === 'clearPotentialSites') {
          if (polygonLayers.potential) { map.removeLayer(polygonLayers.potential); polygonLayers.potential = null; }
        }
        else if (action === 'clearPolygons') {
          if (polygonLayers.classified) { map.removeLayer(polygonLayers.classified); polygonLayers.classified = null; }
          if (polygonLayers.hazards) { map.removeLayer(polygonLayers.hazards); polygonLayers.hazards = null; }
          if (polygonLayers.boundary) { map.removeLayer(polygonLayers.boundary); polygonLayers.boundary = null; }
        }
      } catch (e) { console.error('updateMap error:', e); }
    };

    var transparentPixel = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

    window.updateHazardLayers = function(config) {
      if (hazardTiles.flood) { map.removeLayer(hazardTiles.flood); hazardTiles.flood = null; }
      if (hazardTiles.landslide) { map.removeLayer(hazardTiles.landslide); hazardTiles.landslide = null; }
      if (config.flood && config.flood.enabled) {
        hazardTiles.flood = L.tileLayer(config.flood.url, { opacity: 0.7, maxZoom: 19, maxNativeZoom: 17, errorTileUrl: transparentPixel }).addTo(map);
      }
      if (config.landslide && config.landslide.enabled) {
        hazardTiles.landslide = L.tileLayer(config.landslide.url, { opacity: 0.7, maxZoom: 19, maxNativeZoom: 17, errorTileUrl: transparentPixel }).addTo(map);
      }
    };

    // levels: [{ z, bounds: [[minLat, minLng], [maxLat, maxLng]] }, ...]
    window.downloadMapBackground = function(levels) {
      var post = function(m) { window.ReactNativeWebView.postMessage(JSON.stringify(m)); };
      post({ type: 'tile_download_start' });

      function lngToX(lng, n) { return Math.floor((lng + 180) / 360 * n); }
      function latToY(lat, n) { var r = lat * Math.PI / 180; return Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n); }

      // Build the tile list
      var tiles = [];
      var seen = {};
      (levels || []).forEach(function(l) {
        var n = Math.pow(2, l.z);
        var xMin = lngToX(l.bounds[0][1], n), xMax = lngToX(l.bounds[1][1], n);
        var yMin = latToY(l.bounds[1][0], n), yMax = latToY(l.bounds[0][0], n);
        for (var x = xMin; x <= xMax; x++) {
          for (var y = yMin; y <= yMax; y++) {
            var key = l.z + '/' + x + '/' + y;
            if (!seen[key]) { seen[key] = true; tiles.push([l.z, x, y]); }
          }
        }
      });

      var total = tiles.length, done = 0, failed = 0, next = 0, lastPct = -1;
      if (total === 0) { post({ type: 'tile_download_complete', count: 0, failed: 0 }); return; }

      // Must build the exact URL the map uses (same {s} subdomain rule as Leaflet),
      // otherwise the cache treats it as a different file
      var subdomains = 'abc';
      function urlFor(t) {
        var s = subdomains[Math.abs(t[1] + t[2]) % subdomains.length];
        return 'https://' + s + '.tile.openstreetmap.org/' + t[0] + '/' + t[1] + '/' + t[2] + '.png';
      }

      function finishOne(ok) {
        if (!ok) failed++;
        done++;
        var pct = Math.round(done / total * 100);
        if (pct !== lastPct) { lastPct = pct; post({ type: 'tile_download_progress', progress: pct }); }
        if (done === total) post({ type: 'tile_download_complete', count: total, failed: failed });
        else startNext();
      }

      function startNext() {
        if (next >= total) return;
        var t = tiles[next++];
        var img = new Image(); // no crossOrigin: match how Leaflet requests tiles
        img.onload = function() { finishOne(true); };
        img.onerror = function() { finishOne(false); };
        img.src = urlFor(t);
      }

      // A few at a time — gentle on the tile server and the phone
      for (var i = 0; i < Math.min(6, total); i++) startNext();
    };
  </script>
</body>
</html>
`;

const styles = StyleSheet.create({
  // 🚨 HAZARD ALERT BANNER STYLES
  hazardBanner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
    paddingHorizontal: 12,
    paddingTop: 52,
    paddingBottom: 8,
  },
  hazardBannerInner: {
    backgroundColor: "#DC2626",
    borderRadius: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 12,
    overflow: "hidden",
  },
  hazardBannerTouchable: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  hazardBannerIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  hazardBannerTextWrap: {
    flex: 1,
  },
  hazardBannerTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.3,
  },
  hazardBannerSubtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.85)",
    marginTop: 2,
  },
  hazardBannerTap: {
    fontSize: 10,
    color: "rgba(255,255,255,0.6)",
    marginTop: 3,
    fontWeight: "600",
  },

  //  ENHANCED FLOATING HAZARD INDICATOR STYLES
  hazardIndicatorContainer: {
    position: "absolute",
    bottom: 10,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 1000,
    elevation: 10,
  },
  hazardIndicatorWrap: {
    alignItems: "center",
    justifyContent: "center",
    width: 120,
    height: 140,
  },
  hazardIndicatorBall: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 4,
    borderColor: "#fff",
    zIndex: 10,
  },
  hazardIndicatorLabelWrap: {
    marginTop: 8,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  hazardIndicatorLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  hazardCountBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#991B1B",
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  hazardCountText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
  },

  // 🚨 AMBIENT VIGNETTE OVERLAY
  vignetteOverlay: {
    backgroundColor: "rgba(220, 38, 38, 0.08)",
  },

  // Existing styles preserved
  downloadedStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#dcfce7",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  downloadedStatsText: {
    fontSize: 12,
    color: "#166534",
    fontWeight: "500",
    flex: 1,
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 120,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#0F4A2F",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    zIndex: 100,
  },
  modalContainer: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerTitleWrap: { flex: 1, alignItems: "center", marginHorizontal: 8 },
  headerTitle: { fontSize: 16, fontWeight: "700", color: "#0F4A2F" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  polygonStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#dcfce7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
  },
  polygonStatusText: { fontSize: 10, fontWeight: "600", color: "#16a34a" },
  layerToggleBtn: { padding: 4 },
  polygonStatusBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f8fafc",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    flexWrap: "wrap",
    minHeight: 40,
  },
  polygonStatusLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 1,
  },
  polygonStatusBarText: {
    fontSize: 12,
    color: "#475569",
    fontWeight: "500",
    flexShrink: 1,
  },

  gpsBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginHorizontal: 14,
    marginBottom: 12,
    borderWidth: 1,
  },
  gpsBannerTitle: { fontSize: 12, fontWeight: "700" },
  gpsBannerMessage: { fontSize: 11, marginTop: 1, opacity: 0.85 },
  gpsBannerRefresh: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(0,0,0,0.05)",
    justifyContent: "center",
    alignItems: "center",
  },

  offlineSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  offlineRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  offlineInfo: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  offlineText: { fontSize: 13, color: "#111", fontWeight: "500" },
  offlineSubText: { fontSize: 11, color: "#6B7280", marginTop: 1 },
  coordCard: {
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#DCFCE7",
    borderRadius: 10,
    padding: 10,
    marginTop: 6,
    gap: 4,
  },
  coordRow: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  coordLabel: { fontSize: 11.5, color: "#6B7280", fontWeight: "600" },
  coordValue: { fontSize: 11.5, color: "#111827", fontWeight: "700" },
  coordList: { maxHeight: 110, marginTop: 4 },
  coordListItem: {
    fontSize: 11,
    color: "#374151",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    paddingVertical: 1,
  },
  coordGoBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 6,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  coordGoText: { fontSize: 12, fontWeight: "700", color: "#0F4A2F" },
  offlineActions: { flexDirection: "row", gap: 8 },
  miniBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  miniBtnPrimary: { backgroundColor: "#0F4A2F" },
  miniBtnSuccess: { backgroundColor: "#16a34a" },
  miniBtnSecondary: { backgroundColor: "#6B7280" },
  miniBtnText: { fontSize: 10, fontWeight: "600", color: "#fff" },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },

  layerPanel: {
    backgroundColor: "#F9FAFB",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  layerPanelTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6B7280",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  layerToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 6,
  },
  layerToggleActiveFlood: {
    backgroundColor: "#1565C0",
    borderColor: "#1565C0",
  },
  layerToggleActiveLandslide: {
    backgroundColor: "#6D4C41",
    borderColor: "#6D4C41",
  },
  layerToggleActiveBarangay: {
    backgroundColor: "#CA8A04",
    borderColor: "#CA8A04",
  },
  layerToggleText: { flex: 1, fontSize: 13, color: "#111", fontWeight: "600" },
  layerToggleTextActive: { color: "#fff" },
  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F3F4F6",
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  infoText: { flex: 1, fontSize: 11, color: "#6B7280" },
  mapContainer: { flex: 1, position: "relative" },
  map: { flex: 1 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  loadingText: {
    fontSize: 13,
    color: "#0F4A2F",
    fontWeight: "600",
    marginTop: 10,
  },
  infoBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    gap: 8,
    paddingBottom: 28,
    flexWrap: "wrap",
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 10, color: "#4B5563", fontWeight: "600" },
  coordDisplay: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#f0fdf4",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    flexWrap: "wrap",
  },
  coordDisplayText: {
    fontSize: 10,
    color: "#0F4A2F",
    fontWeight: "600",
    maxWidth: 100,
  },
  accuracyBadge: {
    backgroundColor: "#dcfce7",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 8,
  },
  accuracyText: { fontSize: 8, color: "#16a34a", fontWeight: "700" },

  signalBarsMini: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
    height: 14,
  },
  signalBarMini: { width: 3, borderRadius: 1.5, backgroundColor: "#16a34a" },
  cachedBadge: {
    backgroundColor: "#fef3c7",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#fcd34d",
  },
  cachedText: { fontSize: 8, color: "#92400e", fontWeight: "700" },

  recenterBtn: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#6b7280",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  recenterBtnActive: { backgroundColor: "#2563eb" },
  resetLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FECACA",
    backgroundColor: "#FEF2F2",
  },
  resetLinkText: { fontSize: 12.5, fontWeight: "700", color: "#DC2626" },
  resetRowActive: { borderColor: "#FCA5A5", backgroundColor: "#FEF2F2" },
  // Save Map Offline sheet + guide
  offlineTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  guideLink: { flexDirection: "row", alignItems: "center", gap: 3 },
  guideLinkText: { fontSize: 12, fontWeight: "700", color: "#0F4A2F" },
  saveSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 28,
    maxHeight: "88%",
  },
  saveHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  saveTitle: { fontSize: 18, fontWeight: "800", color: "#111827" },
  saveLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
    letterSpacing: 0.3,
    marginTop: 14,
    marginBottom: 8,
  },
  targetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 8,
  },
  targetRowActive: { borderColor: "#0F4A2F", backgroundColor: "#F0FDF4" },
  targetLabel: { fontSize: 14, fontWeight: "700", color: "#111827" },
  targetDetail: { fontSize: 11.5, color: "#6B7280", marginTop: 1 },
  targetSize: { fontSize: 12, fontWeight: "700", color: "#0F4A2F" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  optChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#fff",
  },
  optChipActive: { backgroundColor: "#0F4A2F", borderColor: "#0F4A2F" },
  optChipText: { fontSize: 13, fontWeight: "600", color: "#374151" },
  optChipTextActive: { color: "#fff" },
  saveHint: { fontSize: 11.5, color: "#6B7280", marginTop: 6, lineHeight: 16 },
  estimateCard: {
    backgroundColor: "#0F4A2F",
    borderRadius: 16,
    padding: 14,
    marginTop: 18,
  },
  estimateRow: { flexDirection: "row" },
  estimateStat: { flex: 1 },
  estimateValue: { fontSize: 20, fontWeight: "800", color: "#fff" },
  estimateLabel: { fontSize: 11, color: "rgba(255,255,255,0.6)", fontWeight: "600" },
  estimateLine: { fontSize: 11.5, color: "rgba(255,255,255,0.8)", marginTop: 10 },
  zoomBreakdown: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  zoomCell: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: "center",
    minWidth: 46,
  },
  zoomCellZ: { fontSize: 10, color: "rgba(255,255,255,0.6)", fontWeight: "700" },
  zoomCellN: { fontSize: 12, color: "#fff", fontWeight: "700" },
  saveWarn: {
    fontSize: 12,
    color: "#92400E",
    backgroundColor: "#FFFBEB",
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  saveWarnError: { color: "#991B1B", backgroundColor: "#FEF2F2" },
  saveBtnRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  saveCancelBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: "#0F4A2F",
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
  },
  saveCancelText: { color: "#0F4A2F", fontWeight: "700", fontSize: 14 },
  saveGoBtn: {
    flex: 2,
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#0F4A2F",
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 0,
  },
  saveGoText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  guideSection: { fontSize: 14, fontWeight: "800", color: "#0F4A2F", marginBottom: 8 },
  // Guide visuals
  gIntro: { fontSize: 13, color: "#374151", lineHeight: 19, marginBottom: 6 },
  gBold: { fontWeight: "700", color: "#111827" },
  gTitle: { fontSize: 13, fontWeight: "800", color: "#111827", marginTop: 14, marginBottom: 8 },
  gHeadRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 20, marginBottom: 2 },
  gText: { fontSize: 13, color: "#374151", lineHeight: 20 },
  gNote: {
    fontSize: 12,
    color: "#1E3A8A",
    backgroundColor: "#EFF6FF",
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
    lineHeight: 17,
  },
  gCaption: { fontSize: 11.5, color: "#6B7280", lineHeight: 17, marginTop: 8 },
  gOuter: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#9CA3AF",
    backgroundColor: "#F3F4F6",
    borderRadius: 14,
    padding: 10,
  },
  gOuterLabel: { fontSize: 11, fontWeight: "700", color: "#6B7280", marginBottom: 8 },
  gMiddle: {
    borderWidth: 1.5,
    borderColor: "#4ADE80",
    backgroundColor: "#DCFCE7",
    borderRadius: 12,
    padding: 10,
  },
  gMiddleLabel: { fontSize: 11, fontWeight: "700", color: "#15803D", marginBottom: 8 },
  gInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#0F4A2F",
    borderRadius: 10,
    paddingVertical: 14,
  },
  gInnerText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  gZoomRow: { flexDirection: "row", justifyContent: "space-between", marginVertical: 12 },
  gZoomCol: { alignItems: "center", flex: 1 },
  gZoomFrame: { padding: 3, borderRadius: 8, borderWidth: 2, borderColor: "transparent" },
  gZoomFrameActive: { borderColor: "#0F4A2F" },
  gZoomZ: { fontSize: 12, fontWeight: "800", color: "#6B7280", marginTop: 4 },
  gZoomSub: { fontSize: 10.5, color: "#6B7280" },
  gMarginRow: { flexDirection: "row", justifyContent: "space-between", marginVertical: 10 },
  gMarginCol: { alignItems: "center", flex: 1 },
  gMarginBox: {
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
  },
  gMarginCore: { width: 26, height: 26, borderRadius: 4, backgroundColor: "#0F4A2F" },
  gLegend: { marginTop: 10 },
  gBars: { gap: 5 },
  gBarRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  gBarZ: { width: 28, fontSize: 11, fontWeight: "700", color: "#6B7280" },
  gBarTrack: {
    flex: 1,
    height: 12,
    backgroundColor: "#F3F4F6",
    borderRadius: 6,
    overflow: "hidden",
  },
  gBarFill: { height: "100%", borderRadius: 6 },
  gBarN: { width: 48, fontSize: 11, fontWeight: "700", color: "#111827", textAlign: "right" },
  gLimits: {
    backgroundColor: "#FFFBEB",
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
    gap: 4,
  },
  gLimitText: { fontSize: 12, color: "#92400E", lineHeight: 17 },
  guideStep: { flexDirection: "row", gap: 10, marginBottom: 8 },
  guideNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#E8F1EC",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  guideNumText: { fontSize: 11, fontWeight: "800", color: "#0F4A2F" },
  guideText: { flex: 1, fontSize: 13, color: "#374151", lineHeight: 19 },
  areaBtn: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#0F4A2F",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  recenterText: { color: "#fff", fontSize: 10, fontWeight: "700" },

  sheetOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheetContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
  },
  dragHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#E5E7EB",
    alignSelf: "center",
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  sheetTitle: { fontSize: 20, fontWeight: "800", color: "#111", flex: 1 },
  sheetSubtitle: { fontSize: 13, color: "#6b7280", marginBottom: 20 },
  sheetActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: 12,
  },
  sheetActionBtnDisabled: { opacity: 0.6 },
  sheetIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  sheetTextWrap: { flex: 1 },
  sheetActionTitle: { fontSize: 14, fontWeight: "700", color: "#111" },
  sheetActionDesc: { fontSize: 11, color: "#6b7280", marginTop: 2 },
  downloadOptionsOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  downloadOptionsContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
    maxHeight: "85%",
  },
  downloadOptionsTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111",
    textAlign: "center",
  },
  downloadOptionsSubtitle: {
    fontSize: 13,
    color: "#6b7280",
    textAlign: "center",
    marginTop: 4,
    marginBottom: 16,
  },
  downloadOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    marginBottom: 10,
    backgroundColor: "#f9fafb",
  },
  downloadOptionActive: { borderColor: "#0F4A2F", backgroundColor: "#f0fdf4" },
  downloadOptionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  downloadOptionTitle: { fontSize: 14, fontWeight: "700", color: "#111" },
  downloadOptionDesc: { fontSize: 11, color: "#6b7280", marginTop: 1 },
  downloadOptionBadge: {
    backgroundColor: "#e5e7eb",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  downloadOptionBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#6b7280",
  },
  barangaySelection: {
    marginTop: 8,
    marginBottom: 12,
    padding: 12,
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    maxHeight: 200,
  },
  barangaySelectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
    marginBottom: 8,
  },
  barangayList: { maxHeight: 150 },
  barangayItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "#fff",
    marginBottom: 4,
  },
  barangayItemSelected: { backgroundColor: "#dcfce7" },
  barangayItemText: { fontSize: 13, color: "#111" },
  barangayItemTextSelected: { color: "#0F4A2F", fontWeight: "600" },
  downloadActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  downloadCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#f3f4f6",
  },
  downloadCancelText: { fontSize: 14, fontWeight: "600", color: "#6b7280" },
  downloadConfirmBtn: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0F4A2F",
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  downloadConfirmBtnDisabled: { backgroundColor: "#d1d5db" },
  downloadConfirmText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  downloadModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  downloadModalContent: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 28,
    width: "100%",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  downloadModalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111",
    marginBottom: 16,
  },
  downloadProgressBar: {
    width: "100%",
    height: 8,
    backgroundColor: "#e5e7eb",
    borderRadius: 4,
    overflow: "hidden",
  },
  downloadProgressFill: {
    height: "100%",
    backgroundColor: "#0F4A2F",
    borderRadius: 4,
  },
  downloadProgressText: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0F4A2F",
    marginTop: 12,
  },
  downloadStatusText: {
    fontSize: 13,
    color: "#6b7280",
    marginTop: 4,
    textAlign: "center",
  },
  downloadModalCloseBtn: {
    marginTop: 16,
    backgroundColor: "#0F4A2F",
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
  },
  downloadModalCloseText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  offlineWarningBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fef3c7",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f59e0b",
    gap: 8,
  },
  offlineWarningText: {
    flex: 1,
    fontSize: 12,
    color: "#92400e",
    fontWeight: "600",
  },

  // ✅ UPDATED: Assessment Points Section Styles
  assessmentPointsSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  assessmentPointsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    gap: 8,
  },
  assessmentPointsInfo: { 
    flexDirection: "row", 
    alignItems: "center", 
    gap: 8, 
    flex: 1 
  },
  assessmentPointsText: { 
    fontSize: 11, 
    color: "#111", 
    fontWeight: "500" 
  },
  miniBtnDisabled: { 
    opacity: 0.4,
    backgroundColor: "#D1D5DB" 
  },
  miniBtnDanger: {
    backgroundColor: "#EF4444",
  },
  pointLegend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
});