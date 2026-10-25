import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "expo-router";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Dimensions,
  ActivityIndicator,
  Image,
  RefreshControl,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import { WebView } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/constants/url_fixed";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const PRIMARY = "#0F4A2F";
const INK = "#111827";
const MUTED = "#6B7280";
const FAINT = "#9CA3AF";
const WHITE = "#FFFFFF";
const BG = "#F4F7F5";
const BORDER = "#E5E7EB";

const DESCRIPTION_LINE_LIMIT = 4;

// ─── Helpers ───────────────────────────────────────────────────────────────
const formatDescription = (desc: string | null | undefined) => {
  if (!desc) return "";
  return desc
    .replace(/\\n/g, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "");
};

// ─── OSM Map Component ────────────────────────────────────────────────────
type LatLng = [number, number];

/**
 * Accepts the coordinate shapes we store ([lat, lng] pairs, {lat,lng} / {latitude,longitude}
 * objects, JSON strings, GeoJSON) and returns [lat, lng] pairs. Flips [lng, lat] lists.
 */
const toLatLngList = (coords: any): LatLng[] => {
  if (!coords) return [];
  let data = coords;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      return [];
    }
  }
  if (data?.type && data?.coordinates) data = data.type === "Polygon" ? data.coordinates[0].map(([lng, lat]: number[]) => [lat, lng]) : [];
  if (!Array.isArray(data)) return [];
  const pts = data
    .map((p: any) =>
      Array.isArray(p)
        ? [Number(p[0]), Number(p[1])]
        : [Number(p?.latitude ?? p?.lat), Number(p?.longitude ?? p?.lng ?? p?.lon)],
    )
    .filter((p: number[]) => Number.isFinite(p[0]) && Number.isFinite(p[1])) as LatLng[];
  return pts.length && Math.abs(pts[0][0]) > 90 ? pts.map(([a, b]) => [b, a] as LatLng) : pts;
};

const toLatLng = (coord: any): LatLng | null => toLatLngList(coord ? [coord] : [])[0] ?? null;

const OSMMap = ({
  sitePolygon,
  plantedPolygon,
  marker,
  style,
}: {
  sitePolygon: LatLng[];
  plantedPolygon?: LatLng[];
  marker: LatLng | null;
  style?: any;
}) => {
  // Rebuild the page only when the data changes, so the map doesn't reload on every render
  const html = useMemo(() => {
    const data = JSON.stringify({ site: sitePolygon, planted: plantedPolygon || [], marker });
    return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #e5e7eb; }
    .leaflet-control-attribution { font-size: 9px; background: rgba(255,255,255,0.7); }
    .pin { background: transparent; border: none; }
    .legend { background: rgba(255,255,255,0.95); padding: 6px 8px; border-radius: 8px; font: 600 11px sans-serif; color: #374151; line-height: 18px; box-shadow: 0 1px 4px rgba(0,0,0,.2); }
    .sw { display: inline-block; width: 11px; height: 11px; border-radius: 3px; margin-right: 6px; vertical-align: -1px; }
  </style>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
</head>
<body>
  <div id="map"></div>
  <script>
    (function () {
      var d = ${data};
      var map = L.map('map', { zoomControl: true, attributionControl: true });
      var street = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 19 });
      var sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: '© Esri', maxZoom: 19 });
      street.addTo(map);
      L.control.layers({ 'Street': street, 'Satellite': sat }, null, { position: 'topright' }).addTo(map);

      var layers = L.featureGroup().addTo(map);
      var legend = [];
      if (d.site.length >= 3) {
        L.polygon(d.site, { color: '#0F4A2F', fillColor: '#0F4A2F', fillOpacity: 0.15, weight: 2 }).addTo(layers);
        legend.push('<span class="sw" style="background:rgba(15,74,47,.25);border:2px solid #0F4A2F"></span>Site boundary');
      }
      if (d.planted.length >= 3) {
        L.polygon(d.planted, { color: '#22C55E', fillColor: '#22C55E', fillOpacity: 0.35, weight: 2, dashArray: '5 4' }).addTo(layers);
        legend.push('<span class="sw" style="background:rgba(34,197,94,.45);border:2px dashed #22C55E"></span>Area planted');
      }
      if (d.marker) {
        var icon = L.divIcon({ className: 'pin', iconSize: [26, 26], iconAnchor: [13, 26],
          html: '<svg width="26" height="26" viewBox="0 0 24 24"><path fill="#DC2626" stroke="#fff" stroke-width="1.5" d="M12 2C8 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3-7-7-7z"/><circle cx="12" cy="9" r="2.6" fill="#fff"/></svg>' });
        L.marker(d.marker, { icon: icon }).addTo(layers);
        legend.push('<span class="sw" style="background:#DC2626;border-radius:50%"></span>Site pin');
      }

      // Start on the site pin; without one, on the centre of the site boundary
      // (or the planted area). Zoom so the whole outline still fits around that point.
      var outline = d.site.length >= 3 ? d.site : d.planted.length >= 3 ? d.planted : null;
      var center = d.marker || (outline ? L.polygon(outline).getBounds().getCenter() : null);

      function placeView() {
        map.invalidateSize();
        var size = map.getSize();
        if (!center) return map.setView([11.036, 124.635], 13); // nothing saved: Ormoc City
        if (!outline) return map.setView(center, 16); // only a pin
        // The zoom that fits the outline needs the real map size; while a screen is
        // still opening the size is 0, which would zoom out to the whole world.
        var zoom = size.x > 0 && size.y > 0 ? map.getBoundsZoom(layers.getBounds().pad(0.15)) : 16;
        map.setView(center, Math.max(12, Math.min(zoom, 18)));
      }

      placeView();
      // Re-place once the WebView has its final size (e.g. after the full-screen map
      // slides in), but stop once the user has moved the map themselves.
      var userMoved = false;
      map.on('dragstart', function () { userMoved = true; });
      map.getContainer().addEventListener('touchstart', function (e) { if (e.touches.length > 1) userMoved = true; });
      window.addEventListener('resize', function () { if (!userMoved) placeView(); });
      [150, 400, 900].forEach(function (ms) { setTimeout(function () { if (!userMoved) placeView(); }, ms); });

      if (legend.length) {
        var box = L.control({ position: 'bottomleft' });
        box.onAdd = function () { var el = L.DomUtil.create('div', 'legend'); el.innerHTML = legend.join('<br/>'); return el; };
        box.addTo(map);
      }
    })();
  </script>
</body>
</html>`;
  }, [JSON.stringify(sitePolygon), JSON.stringify(plantedPolygon), JSON.stringify(marker)]);

  return (
    <WebView
      source={{ html, baseUrl: "https://plantscope.local/" }}
      style={style || { flex: 1, width: "100%", height: "100%" }}
      scrollEnabled={false}
      javaScriptEnabled={true}
      domStorageEnabled={true}
      mixedContentMode="always"
      originWhitelist={["*"]}
      androidHardwareAccelerationDisabled={true}
      setSupportMultipleWindows={false}
      nestedScrollEnabled={true}
    />
  );
};

// ─── Types ─────────────────────────────────────────────────────────────────
interface ApplicationData {
  application_id: number;
  title: string;
  status: string;
  total_treegrowers_will_participate: number;
  orientation_date: string | null;
  proposed_orientation_date: string | null;
  created_at: string;
  maintenance_plan: string | null;
  // True while the City ENRO Head decides if the program is completed or failed
  final_review_pending?: boolean;
}

interface GroupData {
  group_name: string;
}

interface AssignedSite {
  site_id: number;
  name: string;
  description: string | null;
  total_area_hectares: number;
  ndvi_value: number | null;
  polygon_coordinates: [number, number][] | string | null;
  marker_coordinate?: any;
  planted_area_polygon?: [number, number][] | null;
  reforestation_area_name: string | null;
  barangay_name: string | null;
  accessibility: any;
  land_classification_name: string | null;
  main_image_url: string | null;
  general_images: { image_url: string | null; caption: string | null }[];
  recommended_species: {
    species_id: number;
    species_name: string;
    rank: number;
  }[];
}

interface SeedlingRequest {
  request_id: number;
  status: "pending" | "accepted" | "rejected";
  species: { species_name: string; quantity: number }[];
}

interface ProgressReport {
  report_id: number;
  status: string;
  total_survived: number;
  total_dead: number;
  submitted_at: string | null;
}

interface ApplicationDetail {
  application: ApplicationData | null;
  group: GroupData | null;
  assigned_site: AssignedSite | null;
  seedling_requests: SeedlingRequest[];
  progress_reports: ProgressReport[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────
const statusConfig: Record<
  string,
  { label: string; bg: string; text: string; dot: string }
> = {
  for_evaluation: {
    label: "For Evaluation",
    bg: "#FFF8E1",
    text: "#F57F17",
    dot: "#F9A825",
  },
  for_head: {
    label: "For Head Review",
    bg: "#E3F2FD",
    text: "#1565C0",
    dot: "#1976D2",
  },
  accepted: {
    label: "Needs Orientation",
    bg: "#E8F5E9",
    text: "#2E7D32",
    dot: "#388E3C",
  },
  under_monitoring: {
    label: "Under Monitoring",
    bg: "#E8F5E9",
    text: "#2E7D32",
    dot: "#388E3C",
  },
  final_review: {
    label: "Final Review",
    bg: "#EEF2FF",
    text: "#4338CA",
    dot: "#6366F1",
  },
  completed: {
    label: "Completed",
    bg: "#E0F2FE",
    text: "#0284C7",
    dot: "#0EA5E9",
  },
  failed: {
    label: "Not Completed",
    bg: "#FFEBEE",
    text: "#C62828",
    dot: "#D32F2F",
  },
  rejected: {
    label: "Rejected",
    bg: "#FFEBEE",
    text: "#C62828",
    dot: "#D32F2F",
  },
  cancelled: {
    label: "Cancelled",
    bg: "#FFEBEE",
    text: "#C62828",
    dot: "#D32F2F",
  },
};

const getStatusConf = (status: string) =>
  statusConfig[status] ?? {
    label: status,
    bg: "#F5F5F5",
    text: "#555",
    dot: "#999",
  };

const formatDate = (iso: string) =>
  !iso
    ? "—"
    : new Date(iso).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });

const getAccessibilityText = (accessibility: any) => {
  if (!accessibility) return "Not specified";
  if (typeof accessibility === "string") return accessibility;
  if (typeof accessibility === "object") {
    if (accessibility.type)
      return accessibility.type
        .replace(/_/g, " ")
        .replace(/\b\w/g, (l: string) => l.toUpperCase());
    if (accessibility.description) return accessibility.description;
  }
  return "Specified";
};

const getTotalSeedlings = (species: { quantity: number }[]) =>
  species.reduce((sum, item) => sum + (item.quantity || 0), 0);

// ─── Status Badge ──────────────────────────────────────────────────────────
const StatusBadge = ({ status }: { status: string }) => {
  const conf = getStatusConf(status);
  return (
    <View style={[badgeStyles.wrap, { backgroundColor: conf.bg }]}>
      <View style={[badgeStyles.dot, { backgroundColor: conf.dot }]} />
      <Text style={[badgeStyles.text, { color: conf.text }]}>{conf.label}</Text>
    </View>
  );
};

// ─── Floating Progress Timeline (FIXED: Aligned with Backend STATUS_CHOICES) ─
const FloatingProgressTimeline = ({ status }: { status: string }) => {
  // Exactly matches Django Application.STATUS_CHOICES active flow
  const steps = [
    { key: "for_evaluation", label: "Evaluation", icon: "search" },
    { key: "for_head", label: "Head Review", icon: "people" },
    { key: "accepted", label: "Approved", icon: "checkmark-circle" },
    { key: "under_monitoring", label: "Active", icon: "leaf" },
    { key: "final_review", label: "Final Review", icon: "ribbon" },
    { key: "completed", label: "Completed", icon: "trophy" },
  ];

  const statusOrder = [
    "for_evaluation",
    "for_head",
    "accepted",
    "under_monitoring",
    "final_review",
    "completed",
  ];

  // Fallback to 0 if status is somehow not in the order (e.g., rejected, though terminal state catches this)
  const currentIndex = Math.max(0, statusOrder.indexOf(status));

  return (
    <View style={floatTimelineStyles.container}>
      <View style={floatTimelineStyles.card}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={floatTimelineStyles.scroll}
        >
          {steps.map((step, index) => {
            const isActive = index <= currentIndex;
            const isCurrent = index === currentIndex;
            return (
              <View key={step.key} style={floatTimelineStyles.stepContainer}>
                <View
                  style={[
                    floatTimelineStyles.iconCircle,
                    isActive && floatTimelineStyles.iconCircleActive,
                    isCurrent && floatTimelineStyles.iconCircleCurrent,
                  ]}
                >
                  <Ionicons
                    name={step.icon as any}
                    size={isCurrent ? 16 : 13}
                    color={isActive ? WHITE : "#D1D5DB"}
                  />
                </View>
                <Text
                  style={[
                    floatTimelineStyles.stepLabel,
                    isActive && floatTimelineStyles.stepLabelActive,
                    isCurrent && floatTimelineStyles.stepLabelCurrent,
                  ]}
                  numberOfLines={1}
                >
                  {step.label}
                </Text>
                {index < steps.length - 1 && (
                  <View
                    style={[
                      floatTimelineStyles.connector,
                      index < currentIndex &&
                        floatTimelineStyles.connectorActive,
                    ]}
                  />
                )}
              </View>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
};

// ─── Floating Action Button for Quick Links (FIXED: Seedling restriction) ──
const FloatingQuickLinks = ({
  applicationStatus,
  totalApprovedSeedlings,
  ongoingRequestCount,
  reportCount,
  onSeedlingPress,
  onReportPress,
}: {
  applicationStatus: string;
  totalApprovedSeedlings: number;
  ongoingRequestCount: number;
  reportCount: number;
  onSeedlingPress: () => void;
  onReportPress: () => void;
}) => {
  const [expanded, setExpanded] = useState(false);
  const canRequestSeedlings = applicationStatus === "under_monitoring";
  // ✅ During orientation (accepted) growers can't create requests, but can
  // still view ongoing ones (e.g. seedlings ENRO already assigned to them)
  const canViewSeedlings = canRequestSeedlings || ongoingRequestCount > 0;

  return (
    <View style={fabStyles.container}>
      {expanded && (
        <>
          <TouchableOpacity
            style={[
              fabStyles.fabItem,
              { marginBottom: 10 },
              !canViewSeedlings && { opacity: 0.6 },
            ]}
            onPress={() => {
              if (canViewSeedlings) {
                onSeedlingPress();
                setExpanded(false);
              }
            }}
            activeOpacity={0.8}
            disabled={!canViewSeedlings}
          >
            <View style={fabStyles.fabItemIcon}>
              <Ionicons
                name={
                  canViewSeedlings ? "leaf-outline" : "lock-closed-outline"
                }
                size={20}
                color={canViewSeedlings ? PRIMARY : MUTED}
              />
            </View>
            <View style={fabStyles.fabItemLabel}>
              <Text style={fabStyles.fabItemTitle}>Seedling Requests</Text>
              <Text style={fabStyles.fabItemSub}>
                {canRequestSeedlings
                  ? totalApprovedSeedlings > 0
                    ? `${totalApprovedSeedlings} approved`
                    : "Request seedlings"
                  : canViewSeedlings
                    ? `${ongoingRequestCount} ongoing · view only`
                    : "Available during monitoring"}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[fabStyles.fabItem, { marginBottom: 14 }]}
            onPress={() => {
              onReportPress();
              setExpanded(false);
            }}
            activeOpacity={0.8}
          >
            <View
              style={[fabStyles.fabItemIcon, { backgroundColor: "#EFF6FF" }]}
            >
              <Ionicons name="bar-chart-outline" size={20} color="#2563EB" />
            </View>
            <View style={fabStyles.fabItemLabel}>
              <Text style={fabStyles.fabItemTitle}>Progress Reports</Text>
              <Text style={fabStyles.fabItemSub}>
                {reportCount > 0
                  ? `${reportCount} reports submitted`
                  : "Submit progress"}
              </Text>
            </View>
          </TouchableOpacity>
        </>
      )}
      <TouchableOpacity
        style={fabStyles.mainFab}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.8}
      >
        <Ionicons
          name={expanded ? "close" : "apps-outline"}
          size={24}
          color="#fff"
        />
      </TouchableOpacity>
    </View>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────
export default function ApplicationPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [detail, setDetail] = useState<ApplicationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"about" | "gallery">("about");
  const [showMap, setShowMap] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [showGallery, setShowGallery] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [descExpanded, setDescExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);

  const fetchData = async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      setError(null);
      const token = await SecureStore.getItemAsync("token");
      if (!token) throw new Error("No authentication token found.");

      const res = await fetch(`${api}/api/get_tree_grower_application/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok)
        throw new Error(`Failed to load application (${res.status})`);
      const data: ApplicationDetail = await res.json();
      setDetail(data);
    } catch (err: any) {
      console.error("Fetch error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const token = await SecureStore.getItemAsync("token");
      if (!token) return;
      const res = await fetch(`${api}/api/notifications/unread-count/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.unread_count || 0);
      }
    } catch (error) {
      console.error("Error fetching unread count:", error);
    }
  };

  useEffect(() => {
    fetchData();
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 60000);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    setDescExpanded(false);
    setIsTruncated(false);
    fetchData(true);
  };

  // Map layers: site boundary, latest confirmed planted area, and the site pin.
  // The map opens on the pin; without a saved pin it opens on the boundary's centre.
  const sitePolygon = toLatLngList(detail?.assigned_site?.polygon_coordinates);
  const plantedPolygon = toLatLngList(detail?.assigned_site?.planted_area_polygon);
  const siteMarker: LatLng | null = toLatLng(detail?.assigned_site?.marker_coordinate);
  const hasMapData = sitePolygon.length >= 3 || plantedPolygon.length >= 3 || !!siteMarker;

  const acceptedSeedlings =
    detail?.seedling_requests?.filter((r) => r.status === "accepted") || [];
  const totalApprovedSeedlings = acceptedSeedlings.reduce(
    (sum, req) => sum + getTotalSeedlings(req.species),
    0,
  );
  const ongoingRequestCount =
    detail?.seedling_requests?.filter(
      (r) => r.status === "pending" || r.status === "accepted",
    ).length || 0;
  const reportCount = detail?.progress_reports?.length || 0;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={PRIMARY} />
        <Text style={styles.loadingText}>Loading your program...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={48} color={MUTED} />
        <Text style={styles.errorTitle}>Couldn't Load</Text>
        <Text style={styles.errorMsg}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => fetchData()}>
          <Ionicons name="refresh" size={16} color="#fff" />
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isTerminalState =
    !detail?.application ||
    ["completed", "rejected", "cancelled", "failed"].includes(
      detail.application.status,
    );

  if (isTerminalState) {
    return (
      <View style={styles.container}>
        <View style={[styles.terminalBanner, { paddingTop: insets.top + 20 }]}>
          <Text style={styles.terminalTitle}>Tree Planting Program</Text>
          <Text style={styles.terminalSub}>Ready for a new project?</Text>
        </View>
        <View style={styles.terminalBody}>
          <Ionicons name="sparkles-outline" size={48} color={PRIMARY} />
          <Text style={styles.terminalH1}>
            {!detail?.application
              ? "No Active Application"
              : detail.application.status === "completed"
                ? "Program Completed!"
                : detail.application.status === "failed"
                  ? "Program Not Completed"
                  : "Application Closed"}
          </Text>
          <Text style={styles.terminalDesc}>
            {!detail?.application
              ? "You haven't applied for a tree planting program yet. Start your journey today!"
              : detail.application.status === "completed"
                ? "The City ENRO Head confirmed your program as completed. Thank you for your contribution! You can now start a new tree planting project."
                : detail.application.status === "failed"
                  ? "After final review, the City ENRO Head marked your program as not completed. Please coordinate with the ENRO office about next steps. You can apply for a new program."
                  : "Your last application was closed. You can apply for a new tree planting program."}
          </Text>
          <TouchableOpacity
            style={styles.terminalBtn}
            onPress={() => router.push("/tree_growers/sites")}
            activeOpacity={0.8}
          >
            <Ionicons name="add-circle-outline" size={20} color="#fff" />
            <Text style={styles.terminalBtnText}>Apply for New Program</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const application = detail!.application;
  // While the Head reviews the results, show "Final Review" instead of "Active"
  const finalReviewPending = !!application?.final_review_pending;
  const displayStatus = finalReviewPending ? "final_review" : application?.status;
  const group = detail!.group;
  const assigned_site = detail!.assigned_site;
  const heroImage = assigned_site?.main_image_url
    ? { image_url: assigned_site.main_image_url, caption: null }
    : assigned_site?.general_images?.[0];

  const galleryImages = assigned_site?.general_images || [];

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          style={styles.notifBtn}
          onPress={() => router.push("/tree_growers/notifications")}
          activeOpacity={0.7}
        >
          <Ionicons name="notifications-outline" size={22} color={INK} />
          {unreadCount > 0 && (
            <View style={styles.notifDot}>
              <Text style={styles.notifDotText}>
                {unreadCount > 99 ? "99+" : unreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={PRIMARY}
          />
        }
      >
        <View style={styles.heroContainer}>
          <Image
            source={{
              uri: heroImage?.image_url?.startsWith("http")
                ? heroImage.image_url
                : `${api}${heroImage?.image_url}`,
            }}
            style={styles.heroImage}
            resizeMode="cover"
          />
        </View>

        <View style={styles.floatingTimelinePosition}>
          <FloatingProgressTimeline status={displayStatus || ""} />
        </View>

        <View style={styles.contentSheet}>
          <View style={{ height: 28 }} />

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {assigned_site?.total_area_hectares?.toFixed(2) || "—"}
              </Text>
              <Text style={styles.statLabel}>Hectares</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {application.total_treegrowers_will_participate}
              </Text>
              <Text style={styles.statLabel}>Growers</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {totalApprovedSeedlings.toLocaleString()}
              </Text>
              <Text style={styles.statLabel}>Seedlings</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{reportCount}</Text>
              <Text style={styles.statLabel}>Reports</Text>
            </View>
          </View>

          {finalReviewPending && (
            <View style={styles.finalReviewBanner}>
              <View style={styles.finalReviewIcon}>
                <Ionicons name="ribbon" size={18} color="#4338CA" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.finalReviewTitle}>Final review by the City ENRO Head</Text>
                <Text style={styles.finalReviewText}>
                  ENRO has recommended closing your program. The City ENRO Head is reviewing your results (trees planted, survival and area planted) to decide if it is completed. You'll get a notification once a decision is made.
                </Text>
              </View>
            </View>
          )}

          {/* ✅ FIX 2: Orientation Date strictly shown ONLY when status is 'accepted' */}
          {application?.status === "accepted" &&
            application?.orientation_date && (
              <View style={styles.orientationBanner}>
                <Ionicons name="calendar" size={16} color={PRIMARY} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.orientationLabel}>Orientation Date</Text>
                  <Text style={styles.orientationValue}>
                    {formatDate(application.orientation_date)}
                  </Text>
                </View>
                <Ionicons name="time-outline" size={18} color={PRIMARY} />
              </View>
            )}

          <View style={styles.siteHeader}>
            <Text style={styles.siteName}>
              {assigned_site?.name || application.title}
            </Text>
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={14} color={MUTED} />
              <Text style={styles.locationText}>
                {assigned_site?.barangay_name}
                {assigned_site?.reforestation_area_name
                  ? `, ${assigned_site.reforestation_area_name}`
                  : ""}
              </Text>
            </View>
            <Text style={styles.groupText}>
              {group?.group_name || "Tree Planting Program"}
            </Text>
          </View>

          <View style={styles.projectApplicationCard}>
            <View style={styles.projectHeader}>
              <View style={styles.projectIconWrap}>
                <Ionicons name="people-outline" size={20} color={PRIMARY} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.projectTitle}>Project Application</Text>
                <Text style={styles.projectSubtitle}>
                  Details of the proposed reforestation project
                </Text>
              </View>
            </View>

            <View style={styles.projectGrid}>
              <View style={styles.projectField}>
                <Text style={styles.projectLabel}>PROJECT TITLE</Text>
                <Text style={styles.projectValue}>{application.title}</Text>
              </View>
              <View style={styles.projectField}>
                <Text style={styles.projectLabel}>TOTAL TREE GROWERS</Text>
                <Text style={styles.projectValue}>
                  {application.total_treegrowers_will_participate}
                </Text>
              </View>
            </View>

            {application?.proposed_orientation_date && (
              <View style={styles.projectField}>
                <Text style={styles.projectLabel}>
                  PROPOSED ORIENTATION DATE
                </Text>
                <Text style={styles.projectValue}>
                  {formatDate(application.proposed_orientation_date)}
                </Text>
              </View>
            )}
          </View>

          {assigned_site?.description && (
            <View style={styles.descriptionSection}>
              <Text style={styles.sectionTitle}>About this Site</Text>
              <Text
                style={styles.descriptionText}
                ellipsizeMode="tail"
                numberOfLines={
                  descExpanded
                    ? undefined
                    : isTruncated
                      ? DESCRIPTION_LINE_LIMIT
                      : undefined
                }
                onTextLayout={(e) => {
                  if (!descExpanded && !isTruncated) {
                    const lineCount = e.nativeEvent.lines?.length || 0;
                    if (lineCount > DESCRIPTION_LINE_LIMIT)
                      setIsTruncated(true);
                  }
                }}
              >
                {formatDescription(assigned_site.description)}
              </Text>
              {isTruncated && (
                <TouchableOpacity
                  onPress={() => setDescExpanded(!descExpanded)}
                  style={styles.seeMoreBtn}
                  activeOpacity={0.7}
                >
                  <Text style={styles.seeMoreText}>
                    {descExpanded ? "See less" : "See more"}
                  </Text>
                  <Ionicons
                    name={descExpanded ? "chevron-up" : "chevron-down"}
                    size={14}
                    color={PRIMARY}
                  />
                </TouchableOpacity>
              )}
            </View>
          )}

          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tab, activeTab === "about" && styles.tabActive]}
              onPress={() => setActiveTab("about")}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === "about" && styles.tabTextActive,
                ]}
              >
                About
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === "gallery" && styles.tabActive]}
              onPress={() => setActiveTab("gallery")}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === "gallery" && styles.tabTextActive,
                ]}
              >
                Gallery
              </Text>
              {galleryImages.length > 0 && (
                <Text style={styles.tabCount}> ({galleryImages.length})</Text>
              )}
            </TouchableOpacity>
          </View>

          {activeTab === "about" && (
            <>
              <View style={styles.detailSection}>
                <Text style={styles.sectionTitle}>Site Details</Text>
                <View style={styles.detailRow}>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Accessibility</Text>
                    <Text style={styles.detailValue}>
                      {getAccessibilityText(assigned_site?.accessibility)}
                    </Text>
                  </View>
                </View>
                {assigned_site?.land_classification_name && (
                  <View style={styles.detailRow}>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>
                        Land Classification
                      </Text>
                      <Text style={styles.detailValue}>
                        {assigned_site.land_classification_name}
                      </Text>
                    </View>
                  </View>
                )}
              </View>

              {assigned_site && (
                <View style={styles.mapSection}>
                  <View style={styles.mapHeader}>
                    <Text style={styles.sectionTitle}>Site Location</Text>
                    <TouchableOpacity onPress={() => setShowMap(true)}>
                      <Text style={styles.mapExpandText}>Expand</Text>
                    </TouchableOpacity>
                  </View>
                  {/* Plain View: the mini map can be dragged/zoomed without opening full screen */}
                  <View style={styles.mapPreview}>
                    {hasMapData ? (
                      <OSMMap
                        sitePolygon={sitePolygon}
                        plantedPolygon={plantedPolygon}
                        marker={siteMarker}
                        style={{ width: "100%", height: "100%" }}
                      />
                    ) : (
                      <View style={styles.mapEmpty}>
                        <Ionicons name="map-outline" size={28} color={MUTED} />
                        <Text style={styles.mapEmptyText}>No map location saved for this site yet.</Text>
                      </View>
                    )}
                    {hasMapData && (
                      <TouchableOpacity style={styles.mapExpandBtn} onPress={() => setShowMap(true)} activeOpacity={0.8} hitSlop={6}>
                        <Ionicons name="expand" size={16} color="#fff" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}

              {assigned_site?.recommended_species &&
                assigned_site.recommended_species.length > 0 && (
                  <View style={styles.speciesSection}>
                    <Text style={styles.sectionTitle}>Recommended Species</Text>
                    <View style={styles.speciesWrap}>
                      {assigned_site.recommended_species.map((sp) => (
                        <View key={sp.species_id} style={styles.speciesChip}>
                          <Text style={styles.speciesChipText}>
                            {sp.species_name}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

              <View style={styles.guidanceCard}>
                <Ionicons
                  name="information-circle-outline"
                  size={18}
                  color={MUTED}
                />
                <Text style={styles.guidanceText}>
                  {application?.status === "for_evaluation" &&
                    "Your application is being evaluated by the Data Manager. You'll be notified once a decision is made."}
                  {application?.status === "for_head" &&
                    "Your application is pending final approval from the City ENRO Head."}
                  {application?.status === "accepted" &&
                    "Application approved! Please prepare for the orientation scheduled above."}
                  {application?.status === "under_monitoring" && !finalReviewPending &&
                    "Program is active. Onsite inspectors will monitor progress and submit reports."}
                  {finalReviewPending &&
                    "Monitoring is paused while the City ENRO Head makes the final decision on your program."}
                </Text>
              </View>
            </>
          )}

          {activeTab === "gallery" && (
            <View style={styles.galleryGrid}>
              {galleryImages.length > 0 ? (
                galleryImages.map((img, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.galleryThumb}
                    onPress={() => {
                      setGalleryIndex(index);
                      setShowGallery(true);
                    }}
                    activeOpacity={0.8}
                  >
                    <Image
                      source={{
                        uri: img.image_url?.startsWith("http")
                          ? img.image_url
                          : `${api}${img.image_url}`,
                      }}
                      style={styles.galleryThumbImage}
                      resizeMode="cover"
                    />
                    {img.caption && (
                      <View style={styles.galleryThumbCaption}>
                        <Text
                          style={styles.galleryThumbCaptionText}
                          numberOfLines={1}
                        >
                          {img.caption}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.galleryEmpty}>
                  <Ionicons name="image-outline" size={40} color="#CBD5E1" />
                  <Text style={styles.galleryEmptyText}>
                    No site images available
                  </Text>
                </View>
              )}
            </View>
          )}

          <View style={{ height: 100 }} />
        </View>
      </ScrollView>

      {/* ✅ FIX 1 & 3: Pass applicationStatus to enforce seedling restrictions */}
      <FloatingQuickLinks
        applicationStatus={application?.status || ""}
        totalApprovedSeedlings={totalApprovedSeedlings}
        ongoingRequestCount={ongoingRequestCount}
        reportCount={reportCount}
        onSeedlingPress={() => router.push("/tree_growers/seedlingRequests")}
        onReportPress={() => router.push("/tree_growers/progressReports")}
      />

      <Modal
        visible={showMap}
        animationType="slide"
        onRequestClose={() => setShowMap(false)}
      >
        <View style={{ flex: 1 }}>
          <OSMMap
            sitePolygon={sitePolygon}
            plantedPolygon={plantedPolygon}
            marker={siteMarker}
            style={{ flex: 1 }}
          />
          <View style={[styles.mapModalBar, { top: insets.top + 16 }]}>
            <TouchableOpacity
              style={styles.mapCloseBtn}
              onPress={() => setShowMap(false)}
            >
              <Ionicons name="close" size={18} color="#fff" />
              <Text style={styles.mapCloseTxt}>Close</Text>
            </TouchableOpacity>
            {assigned_site && (
              <View style={styles.mapTitlePill}>
                <Ionicons name="location" size={13} color="#fff" />
                <Text style={styles.mapTitleTxt} numberOfLines={1}>
                  {assigned_site.name}
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={showGallery}
        animationType="fade"
        transparent
        onRequestClose={() => setShowGallery(false)}
      >
        <View style={styles.galleryModalOverlay}>
          <TouchableOpacity
            style={[styles.galleryModalCloseBtn, { top: insets.top + 16 }]}
            onPress={() => setShowGallery(false)}
          >
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={[styles.galleryCounter, { top: insets.top + 20 }]}>
            <Text style={styles.galleryCounterText}>
              {galleryIndex + 1} / {galleryImages.length}
            </Text>
          </View>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: galleryIndex * SCREEN_WIDTH, y: 0 }}
            onMomentumScrollEnd={(e) =>
              setGalleryIndex(
                Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH),
              )
            }
          >
            {galleryImages.map((img, i) => (
              <View key={i} style={styles.galleryFullWrapper}>
                <Image
                  source={{
                    uri: img.image_url?.startsWith("http")
                      ? img.image_url
                      : `${api}${img.image_url}`,
                  }}
                  style={styles.galleryFullImage}
                  resizeMode="contain"
                />
                {img.caption && (
                  <View style={styles.galleryFullCaption}>
                    <Text style={styles.galleryFullCaptionText}>
                      {img.caption}
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  loadingText: { marginTop: 14, color: MUTED, fontSize: 14 },
  errorTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: INK,
    marginTop: 16,
    marginBottom: 6,
  },
  errorMsg: {
    fontSize: 14,
    color: MUTED,
    textAlign: "center",
    marginBottom: 24,
  },
  retryBtn: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    backgroundColor: PRIMARY,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  terminalBanner: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  terminalTitle: { fontSize: 22, fontWeight: "800", color: "#fff" },
  terminalSub: { fontSize: 13, color: "rgba(255,255,255,0.7)", marginTop: 4 },
  terminalBody: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  terminalH1: {
    fontSize: 24,
    fontWeight: "800",
    color: INK,
    textAlign: "center",
    marginTop: 20,
    marginBottom: 12,
  },
  terminalDesc: {
    fontSize: 15,
    color: MUTED,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
    maxWidth: 300,
  },
  terminalBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PRIMARY,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    gap: 10,
    width: "100%",
    maxWidth: 320,
  },
  terminalBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  topBar: {
    position: "absolute",
    top: 0,
    right: 0,
    zIndex: 100,
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  notifBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.9)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  notifDot: {
    position: "absolute",
    top: 10,
    right: 10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#EF4444",
    borderWidth: 1.5,
    borderColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 3,
  },
  notifDotText: { color: "#fff", fontSize: 9, fontWeight: "800" },
  heroContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.42,
    position: "relative",
    zIndex: 1,
  },
  heroImage: { width: "100%", height: "100%" },
  floatingTimelinePosition: {
    position: "relative",
    zIndex: 10,
    marginTop: -26,
    marginBottom: -26,
    paddingHorizontal: 16,
  },
  contentSheet: {
    backgroundColor: WHITE,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    marginTop: -20,
    minHeight: SCREEN_HEIGHT - SCREEN_HEIGHT * 0.42 + 20,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -10 },
    elevation: 10,
    zIndex: 5,
  },
  finalReviewBanner: {
    flexDirection: "row",
    gap: 12,
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "#EEF2FF",
    borderWidth: 1,
    borderColor: "#C7D2FE",
  },
  finalReviewIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#E0E7FF",
    justifyContent: "center",
    alignItems: "center",
  },
  finalReviewTitle: { fontSize: 14, fontWeight: "800", color: "#3730A3" },
  finalReviewText: { fontSize: 12, color: "#4338CA", marginTop: 3, lineHeight: 17 },
  orientationBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0FDF4",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 0,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#DCFCE7",
  },
  orientationLabel: {
    fontSize: 11,
    color: MUTED,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  orientationValue: {
    fontSize: 15,
    fontWeight: "700",
    color: PRIMARY,
    marginTop: 2,
  },
  siteHeader: { marginBottom: 16 },
  siteName: {
    fontSize: 24,
    fontWeight: "800",
    color: INK,
    marginTop: 10,
    lineHeight: 30,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  locationText: { fontSize: 14, color: MUTED, fontWeight: "500" },
  groupText: { fontSize: 13, color: FAINT, marginTop: 4, fontWeight: "500" },
  projectApplicationCard: {
    backgroundColor: WHITE,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: BORDER,
  },
  projectHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  projectIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#ECFDF5",
    justifyContent: "center",
    alignItems: "center",
  },
  projectTitle: { fontSize: 16, fontWeight: "700", color: INK },
  projectSubtitle: { fontSize: 12, color: MUTED, marginTop: 2 },
  projectGrid: { flexDirection: "row", gap: 16, marginBottom: 16 },
  projectField: { flex: 1 },
  projectLabel: {
    fontSize: 11,
    color: MUTED,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  projectValue: { fontSize: 15, fontWeight: "700", color: INK },
  descriptionSection: { marginBottom: 20 },
  descriptionText: { fontSize: 15, lineHeight: 24, color: MUTED },
  seeMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
    alignSelf: "flex-start",
  },
  seeMoreText: { fontSize: 14, fontWeight: "700", color: PRIMARY },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: WHITE,
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: BORDER,
    marginTop: 12,
  },
  statItem: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 15, fontWeight: "700", color: INK },
  statLabel: {
    fontSize: 10,
    color: MUTED,
    marginTop: 3,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statDivider: { width: 1, height: 28, backgroundColor: BORDER },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    position: "relative",
    flexDirection: "row",
    justifyContent: "center",
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: PRIMARY,
    marginBottom: -1,
  },
  tabText: { fontSize: 14, fontWeight: "600", color: MUTED },
  tabTextActive: { color: PRIMARY, fontWeight: "700" },
  tabCount: { fontSize: 14, color: MUTED, fontWeight: "500" },
  detailSection: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: INK,
    marginBottom: 12,
  },
  detailRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  detailItem: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER,
  },
  detailLabel: {
    fontSize: 11,
    color: MUTED,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  detailValue: { fontSize: 15, fontWeight: "700", color: INK },
  mapSection: { marginBottom: 20 },
  mapHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  mapExpandText: { fontSize: 13, fontWeight: "600", color: PRIMARY },
  mapExpandBtn: {
    position: "absolute",
    bottom: 10,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(15,74,47,0.9)",
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  mapEmpty: { flex: 1, justifyContent: "center", alignItems: "center", gap: 6, backgroundColor: "#F3F4F6" },
  mapEmptyText: { fontSize: 12, color: MUTED, fontWeight: "600" },
  mapPreview: {
    height: 220,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: BORDER,
  },
  speciesSection: { marginBottom: 20 },
  speciesWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  speciesChip: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
  },
  speciesChipText: { fontSize: 13, fontWeight: "600", color: INK },
  galleryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 20,
  },
  galleryThumb: {
    width: (SCREEN_WIDTH - 56) / 2,
    height: (SCREEN_WIDTH - 56) / 2,
    borderRadius: 14,
    overflow: "hidden",
    position: "relative",
  },
  galleryThumbImage: { width: "100%", height: "100%" },
  galleryThumbCaption: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 6,
  },
  galleryThumbCaptionText: { color: "#fff", fontSize: 11, fontWeight: "500" },
  galleryEmpty: {
    width: "100%",
    height: 200,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  galleryEmptyText: { fontSize: 13, color: MUTED, marginTop: 8 },
  guidanceCard: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  guidanceText: {
    fontSize: 13,
    color: MUTED,
    flex: 1,
    lineHeight: 20,
    fontWeight: "500",
  },
  mapModalBar: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  mapCloseBtn: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  mapCloseTxt: { color: "#fff", fontWeight: "700", fontSize: 13 },
  mapTitlePill: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    backgroundColor: "rgba(15,74,47,0.85)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  mapTitleTxt: { color: "#fff", fontWeight: "700", fontSize: 13, flex: 1 },
  galleryModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
  },
  galleryModalCloseBtn: {
    position: "absolute",
    right: 20,
    zIndex: 100,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  galleryCounter: { position: "absolute", left: 20, zIndex: 100 },
  galleryCounterText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  galleryFullWrapper: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
  },
  galleryFullImage: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.7 },
  galleryFullCaption: {
    position: "absolute",
    bottom: 80,
    left: 20,
    right: 20,
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 12,
    borderRadius: 12,
  },
  galleryFullCaptionText: { color: "#fff", fontSize: 14, textAlign: "center" },
});

const badgeStyles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 5,
    alignSelf: "flex-start",
    marginLeft: 4,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});

const floatTimelineStyles = StyleSheet.create({
  container: { alignItems: "center" },
  card: {
    backgroundColor: WHITE,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  scroll: { paddingRight: 4 },
  stepContainer: {
    flexDirection: "column",
    alignItems: "center",
    marginRight: 2,
    width: 64,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  iconCircleActive: { backgroundColor: PRIMARY },
  iconCircleCurrent: {
    backgroundColor: PRIMARY,
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: "#BBF7D0",
  },
  stepLabel: {
    fontSize: 9,
    color: "#D1D5DB",
    fontWeight: "600",
    textAlign: "center",
    width: 64,
    lineHeight: 12,
  },
  stepLabelActive: { color: INK, fontWeight: "700" },
  stepLabelCurrent: { color: PRIMARY, fontWeight: "800" },
  connector: {
    position: "absolute",
    top: 16,
    left: 50,
    width: 24,
    height: 2,
    backgroundColor: "#E5E7EB",
  },
  connectorActive: { backgroundColor: PRIMARY },
});

const fabStyles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 24,
    right: 20,
    alignItems: "flex-end",
    zIndex: 200,
  },
  mainFab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: PRIMARY,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: PRIMARY,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: WHITE,
    borderRadius: 16,
    padding: 12,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
    minWidth: 220,
  },
  fabItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#ECFDF5",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  fabItemLabel: { flex: 1 },
  fabItemTitle: { fontSize: 14, fontWeight: "700", color: INK },
  fabItemSub: { fontSize: 12, color: MUTED, marginTop: 2 },
});
