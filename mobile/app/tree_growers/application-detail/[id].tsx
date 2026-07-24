import React, { useState, useEffect } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
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

// ─── Types ─────────────────────────────────────────────────────────────────
interface ApplicationData {
  application_id: number;
  title: string;
  classification: "new" | "old";
  status: string;
  total_treegrowers_will_participate: number;
  orientation_date: string | null;
  proposed_orientation_date: string | null;
  confirmed_at: string | null;
  maintenance_plan: string | null;
  agreement_image: string | null;
  created_at: string;
  updated_at: string;
}

interface GroupData {
  group_name: string;
  group_type: string;
  group_contact: string;
  group_address: string;
  group_profile: string | null;
}

interface AssignedSite {
  site_id: number;
  name: string;
  description: string | null;
  total_area_hectares: number;
  polygon_coordinates: [number, number][] | string | null;
  reforestation_area_name: string | null;
  barangay_name: string | null;
  accessibility: any;
  land_classification_name: string | null;
  general_images: { image_url: string | null; caption: string | null }[];
  recommended_species: {
    species_id: number;
    species_name: string;
    rank: number;
  }[];
}

interface SeedlingRequest {
  request_id: number;
  no_request_seedling: number;
  species: { species_name: string; quantity: number; provided_by: string }[];
  status: "pending" | "accepted" | "rejected";
  reason_accepted: string | null;
  submitted_at: string | null;
}

interface ProgressReport {
  report_id: number;
  visit_type: "initial" | "ongoing";
  total_survived: number;
  total_dead: number;
  total_added_by_grower: number;
  species: {
    species_id: number;
    species_name: string;
    no_planted: number;
    no_added_by_grower: number;
    no_survived: number;
    no_dead: number;
    survival_rate: number;
  }[];
  description: string | null;
  status: "pending" | "accepted" | "rejected";
  proof_image: string | null;
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
const formatDescription = (desc: string | null | undefined) => {
  if (!desc) return "";
  return desc
    .replace(/\\n/g, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "");
};

const formatDate = (iso: string) =>
  !iso
    ? "—"
    : new Date(iso).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });

const parsePolygonCoordinates = (coords: any): [number, number][] => {
  if (!coords) return [];
  if (Array.isArray(coords) && coords.length > 0 && Array.isArray(coords[0]))
    return coords as [number, number][];
  if (typeof coords === "string") {
    try {
      const p = JSON.parse(coords);
      if (Array.isArray(p)) return p;
    } catch {}
  }
  return [];
};

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

// ─── OSM Map Component ────────────────────────────────────────────────────
const OSMMap = ({
  region,
  polygon,
  marker,
  style,
}: {
  region: any;
  polygon: any[];
  marker: any | null;
  style?: any;
}) => {
  const safeLat = region?.latitude || 11.036;
  const safeLng = region?.longitude || 124.635;
  const safePolygon =
    polygon && polygon.length > 0
      ? JSON.stringify(
          polygon.map((p) =>
            Array.isArray(p) ? p : [p.latitude, p.longitude],
          ),
        )
      : "[]";

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <style>
        html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }
        #map { width: 100%; height: 100vh; }
        .leaflet-control-attribution { font-size: 9px; background: rgba(255,255,255,0.7); }
        .custom-marker-wrapper { background: transparent; border: none; }
      </style>
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    </head>
    <body>
      <div id="map"></div>
      <script>
        try {
          var map = L.map('map', { center: [${safeLat}, ${safeLng}], zoom: 15, zoomControl: true });
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap', maxZoom: 19, crossOrigin: true
          }).addTo(map);
          var polygonCoords = ${safePolygon};
          if (polygonCoords.length > 0) {
            var poly = L.polygon(polygonCoords, { color: '#0F4A2F', fillColor: '#0F4A2F', fillOpacity: 0.3, weight: 2 }).addTo(map);
            map.fitBounds(poly.getBounds(), { padding: [20, 20] });
          }
          ${marker ? `var customIcon = L.divIcon({ className: 'custom-marker-wrapper', html: '<div style="width: 20px; height: 20px; background-color: #0F4A2F; border: 3px solid #fff; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>', iconSize: [20, 20], iconAnchor: [10, 10] }); L.marker([${marker?.latitude || safeLat}, ${marker?.longitude || safeLng}], {icon: customIcon}).addTo(map);` : ""}
        } catch(e) {}
      </script>
    </body>
    </html>
  `;

  return (
    <WebView
      source={{ html }}
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

// ─── Status Badge ─────────────────────────────────────────────────────────
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
  completed: {
    label: "Completed",
    bg: "#E0F2FE",
    text: "#0284C7",
    dot: "#0EA5E9",
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

const StatusBadge = ({ status }: { status: string }) => {
  const conf = getStatusConf(status);
  return (
    <View style={[badgeStyles.wrap, { backgroundColor: conf.bg }]}>
      <View style={[badgeStyles.dot, { backgroundColor: conf.dot }]} />
      <Text style={[badgeStyles.text, { color: conf.text }]}>{conf.label}</Text>
    </View>
  );
};

// ─── Floating Progress Timeline ────────────────────────────────────────────
const FloatingProgressTimeline = ({ status }: { status: string }) => {
  const steps = [
    { key: "submitted", label: "Submitted", icon: "document-text" },
    { key: "for_evaluation", label: "Evaluating", icon: "search" },
    { key: "for_head", label: "Review", icon: "people" },
    { key: "accepted", label: "Approved", icon: "checkmark-circle" },
    { key: "under_monitoring", label: "Active", icon: "leaf" },
    { key: "completed", label: "Done", icon: "trophy" },
  ];

  const statusOrder = [
    "submitted",
    "for_evaluation",
    "for_head",
    "accepted",
    "under_monitoring",
    "completed",
  ];
  const currentIndex = statusOrder.indexOf(status);

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

// ─── Floating Action Button ────────────────────────────────────────────────
const FloatingQuickLinks = ({
  totalApprovedSeedlings,
  reportCount,
  onSeedlingPress,
  onReportPress,
}: {
  totalApprovedSeedlings: number;
  reportCount: number;
  onSeedlingPress: () => void;
  onReportPress: () => void;
}) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={fabStyles.container}>
      {expanded && (
        <>
          <TouchableOpacity
            style={[fabStyles.fabItem, { marginBottom: 10 }]}
            onPress={() => {
              onSeedlingPress();
              setExpanded(false);
            }}
            activeOpacity={0.8}
          >
            <View style={fabStyles.fabItemIcon}>
              <Ionicons name="leaf-outline" size={20} color={PRIMARY} />
            </View>
            <View style={fabStyles.fabItemLabel}>
              <Text style={fabStyles.fabItemTitle}>Seedling Requests</Text>
              <Text style={fabStyles.fabItemSub}>
                {totalApprovedSeedlings > 0
                  ? `${totalApprovedSeedlings} approved`
                  : "Request seedlings"}
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
export default function ApplicationDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [detail, setDetail] = useState<ApplicationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"about" | "gallery">("about");
  const [showMap, setShowMap] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [showGallery, setShowGallery] = useState(false);

  const [descExpanded, setDescExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);

  // Inline history expansion states
  const [showSeedlingHistory, setShowSeedlingHistory] = useState(false);
  const [showReportHistory, setShowReportHistory] = useState(false);

  const fetchData = async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      setError(null);
      const token = await SecureStore.getItemAsync("token");
      if (!token) throw new Error("No authentication token found.");

      const res = await fetch(
        `${api}/api/get_tree_grower_application_detail/${id}/`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
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

  useEffect(() => {
    if (id) fetchData();
  }, [id]);

  const onRefresh = () => {
    setRefreshing(true);
    setDescExpanded(false);
    setIsTruncated(false);
    fetchData(true);
  };

  const getMapRegion = () => {
    const site = detail?.assigned_site;
    const coords = parsePolygonCoordinates(site?.polygon_coordinates);
    if (coords.length === 0)
      return {
        latitude: 11.036,
        longitude: 124.635,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      };

    const lats = coords.map(([lat]) => lat);
    const lngs = coords.map(([, lng]) => lng);
    const minLat = Math.min(...lats),
      maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs),
      maxLng = Math.max(...lngs);

    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: (maxLat - minLat) * 1.5 + 0.005,
      longitudeDelta: (maxLng - minLng) * 1.5 + 0.005,
    };
  };

  const polygonCoords = detail?.assigned_site
    ? parsePolygonCoordinates(detail.assigned_site.polygon_coordinates).map(
        ([lat, lng]) => ({ latitude: lat, longitude: lng }),
      )
    : [];
  const centroid =
    polygonCoords.length > 0
      ? {
          latitude:
            polygonCoords.reduce((s, c) => s + c.latitude, 0) /
            polygonCoords.length,
          longitude:
            polygonCoords.reduce((s, c) => s + c.longitude, 0) /
            polygonCoords.length,
        }
      : null;

  const acceptedSeedlings =
    detail?.seedling_requests?.filter((r) => r.status === "accepted") || [];
  const totalApprovedSeedlings = acceptedSeedlings.reduce(
    (sum, req) => sum + getTotalSeedlings(req.species),
    0,
  );
  const reportCount = detail?.progress_reports?.length || 0;

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top + 40 }]}>
        <ActivityIndicator size="large" color={PRIMARY} />
        <Text style={styles.loadingText}>Loading application details...</Text>
      </View>
    );
  }

  if (error || !detail || !detail.application) {
    return (
      <View style={[styles.center, { paddingTop: insets.top + 40 }]}>
        <Ionicons name="alert-circle-outline" size={48} color={MUTED} />
        <Text style={styles.errorTitle}>Couldn't Load</Text>
        <Text style={styles.errorMsg}>{error || "Application not found"}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => fetchData()}>
          <Ionicons name="refresh" size={16} color="#fff" />
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const application = detail.application;
  const group = detail.group;
  const assigned_site = detail.assigned_site;
  const heroImage = assigned_site?.general_images?.[0];
  const galleryImages = assigned_site?.general_images || [];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── Floating Back Button ─── */}
      <TouchableOpacity
        style={[styles.floatingBackBtn, { top: insets.top + 16 }]}
        onPress={() => router.replace("/tree_growers/reports")}
        activeOpacity={0.8}
      >
        <Ionicons name="chevron-back" size={24} color={INK} />
      </TouchableOpacity>

      {/* ─── Scrollable Content ─── */}
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
        {/* ─── Site Image ── */}
        <View style={styles.heroContainer}>
          {heroImage?.image_url ? (
            <Image
              source={{
                uri: heroImage.image_url.startsWith("http")
                  ? heroImage.image_url
                  : `${api}${heroImage.image_url}`,
              }}
              style={styles.heroImage}
              resizeMode="cover"
            />
          ) : (
            <View
              style={[
                styles.heroImage,
                {
                  backgroundColor: "#E5E7EB",
                  justifyContent: "center",
                  alignItems: "center",
                },
              ]}
            >
              <Ionicons name="image-outline" size={48} color={MUTED} />
            </View>
          )}
        </View>

        {/* ─── Floating Progress Timeline ─── */}
        <View style={styles.floatingTimelinePosition}>
          <FloatingProgressTimeline status={application.status} />
        </View>

        {/* ─── Content Sheet ─── */}
        <View style={styles.contentSheet}>
          <View style={{ height: 28 }} />

          {/* ─── Compact Stats Row ── */}
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

          {/* ─── Orientation Date ── */}
          {application.status === "accepted" &&
            application.orientation_date && (
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

          {/* ─── Site Header ─── */}
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

          {/* ─── Project Application Details Card ─── */}
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
            {application.proposed_orientation_date && (
              <View style={styles.projectField}>
                <Text style={styles.projectLabel}>
                  PROPOSED ORIENTATION DATE
                </Text>
                <Text style={styles.projectValue}>
                  {formatDate(application.proposed_orientation_date)}
                </Text>
              </View>
            )}
            {application.maintenance_plan && (
              <View style={styles.maintenancePlanSection}>
                <Text style={styles.projectLabel}>MAINTENANCE PLAN</Text>
                <TouchableOpacity
                  style={styles.maintenancePlanLink}
                  onPress={() => {
                    /* Handle download/view logic here */
                  }}
                >
                  <View style={styles.maintenancePlanIcon}>
                    <Ionicons name="document-text" size={20} color={WHITE} />
                  </View>
                  <View style={styles.maintenancePlanInfo}>
                    <Text style={styles.maintenancePlanFilename}>
                      {application.maintenance_plan.split("/").pop() ||
                        "Maintenance Plan"}
                    </Text>
                    <Text style={styles.maintenancePlanHint}>
                      Tap to view/download
                    </Text>
                  </View>
                  <Ionicons name="download-outline" size={18} color={PRIMARY} />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* ─── Inline Seedling History ─── */}
          {detail.seedling_requests.length > 0 && (
            <View style={styles.inlineHistoryCard}>
              <TouchableOpacity
                style={styles.inlineHistoryHeader}
                onPress={() => setShowSeedlingHistory(!showSeedlingHistory)}
              >
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                >
                  <Ionicons name="leaf-outline" size={18} color={PRIMARY} />
                  <Text style={styles.inlineHistoryTitle}>
                    Seedling Requests ({detail.seedling_requests.length})
                  </Text>
                </View>
                <Ionicons
                  name={showSeedlingHistory ? "chevron-up" : "chevron-down"}
                  size={20}
                  color={MUTED}
                />
              </TouchableOpacity>

              {showSeedlingHistory && (
                <View style={styles.inlineHistoryContent}>
                  {detail.seedling_requests.map((req) => (
                    <View key={req.request_id} style={styles.historyItem}>
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          marginBottom: 6,
                        }}
                      >
                        <Text style={styles.historyItemDate}>
                          {formatDate(req.submitted_at)}
                        </Text>
                        <StatusBadge status={req.status} />
                      </View>
                      <Text style={styles.historyItemValue}>
                        Total Requested:{" "}
                        <Text style={{ fontWeight: "700" }}>
                          {req.no_request_seedling.toLocaleString()}
                        </Text>
                      </Text>
                      {req.reason_accepted && (
                        <Text style={styles.historyItemNote}>
                          Note: {req.reason_accepted}
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* ─── Inline Progress Report History ─── */}
          {detail.progress_reports.length > 0 && (
            <View style={styles.inlineHistoryCard}>
              <TouchableOpacity
                style={styles.inlineHistoryHeader}
                onPress={() => setShowReportHistory(!showReportHistory)}
              >
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                >
                  <Ionicons
                    name="clipboard-outline"
                    size={18}
                    color={PRIMARY}
                  />
                  <Text style={styles.inlineHistoryTitle}>
                    Progress Reports ({detail.progress_reports.length})
                  </Text>
                </View>
                <Ionicons
                  name={showReportHistory ? "chevron-up" : "chevron-down"}
                  size={20}
                  color={MUTED}
                />
              </TouchableOpacity>

              {showReportHistory && (
                <View style={styles.inlineHistoryContent}>
                  {detail.progress_reports.map((report) => (
                    <View key={report.report_id} style={styles.historyItem}>
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          marginBottom: 6,
                        }}
                      >
                        <Text style={styles.historyItemDate}>
                          {formatDate(report.submitted_at)} •{" "}
                          {report.visit_type === "initial"
                            ? "Initial"
                            : "Ongoing"}
                        </Text>
                        <StatusBadge status={report.status} />
                      </View>
                      <View style={{ flexDirection: "row", gap: 16 }}>
                        <Text style={styles.historyItemValue}>
                          Survived:{" "}
                          <Text style={{ fontWeight: "700", color: PRIMARY }}>
                            {report.total_survived}
                          </Text>
                        </Text>
                        <Text style={styles.historyItemValue}>
                          Dead:{" "}
                          <Text style={{ fontWeight: "700", color: "#DC2626" }}>
                            {report.total_dead}
                          </Text>
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* ─── About this Site (Description) ─── */}
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

          {/* ─── Tabs: About | Gallery ─── */}
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

          {/* ── About Tab Content ─── */}
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
                  {assigned_site?.land_classification_name && (
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>
                        Land Classification
                      </Text>
                      <Text style={styles.detailValue}>
                        {assigned_site.land_classification_name}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {assigned_site && (
                <View style={styles.mapSection}>
                  <View style={styles.mapHeader}>
                    <Text style={styles.sectionTitle}>Site Location</Text>
                    <TouchableOpacity onPress={() => setShowMap(true)}>
                      <Text style={styles.mapExpandText}>Expand</Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    style={styles.mapPreview}
                    onPress={() => setShowMap(true)}
                    activeOpacity={0.9}
                  >
                    <OSMMap
                      region={getMapRegion()}
                      polygon={polygonCoords}
                      marker={centroid}
                      style={{ width: "100%", height: "100%" }}
                    />
                  </TouchableOpacity>
                </View>
              )}

              {assigned_site?.recommended_species &&
                assigned_site.recommended_species.length > 0 && (
                  <View style={styles.speciesSection}>
                    <Text style={styles.sectionTitle}>Recommended Species</Text>
                    <View style={styles.speciesWrap}>
                      {assigned_site.recommended_species.map((sp) => (
                        <View key={sp.species_id} style={styles.speciesChip}>
                          <Ionicons name="leaf" size={12} color={PRIMARY} />
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
                  {application.status === "for_evaluation" &&
                    "Your application is being evaluated by the Data Manager. You'll be notified once a decision is made."}
                  {application.status === "for_head" &&
                    "Your application is pending final approval from the City ENRO Head."}
                  {application.status === "accepted" &&
                    "Application approved! Please prepare for the orientation scheduled above."}
                  {application.status === "under_monitoring" &&
                    "Program is active. Onsite inspectors will monitor progress and submit reports."}
                  {application.status === "completed" &&
                    "Congratulations! This program has been successfully completed."}
                  {(application.status === "rejected" ||
                    application.status === "cancelled") &&
                    "This application was not approved. Please contact the ENRO office for more details."}
                </Text>
              </View>
            </>
          )}

          {/* ─── Gallery Tab Content ─── */}
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

      {/* ── Floating Quick Links ─── */}
      <FloatingQuickLinks
        totalApprovedSeedlings={totalApprovedSeedlings}
        reportCount={reportCount}
        onSeedlingPress={() => router.push("/tree_growers/seedlingRequests")}
        onReportPress={() => router.push("/tree_growers/progressReports")}
      />

      {/* ── Map Modal ─── */}
      <Modal
        visible={showMap}
        animationType="slide"
        onRequestClose={() => setShowMap(false)}
      >
        <View style={{ flex: 1 }}>
          <OSMMap
            region={getMapRegion()}
            polygon={polygonCoords}
            marker={centroid}
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

      {/* ─── Gallery Full Screen Modal ─── */}
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

  floatingBackBtn: {
    position: "absolute",
    left: 16,
    zIndex: 100,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.95)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },

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
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -10 },
    elevation: 10,
    zIndex: 5,
  },

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
  maintenancePlanSection: { marginTop: 8 },
  maintenancePlanLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#ECFDF5",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#DCFCE7",
    borderStyle: "dashed",
  },
  maintenancePlanIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: PRIMARY,
    justifyContent: "center",
    alignItems: "center",
  },
  maintenancePlanInfo: { flex: 1 },
  maintenancePlanFilename: { fontSize: 13, fontWeight: "600", color: PRIMARY },
  maintenancePlanHint: { fontSize: 11, color: "#059669", marginTop: 2 },

  // Inline History Styles
  inlineHistoryCard: {
    backgroundColor: WHITE,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: BORDER,
  },
  inlineHistoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  inlineHistoryTitle: { fontSize: 15, fontWeight: "700", color: INK },
  inlineHistoryContent: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  historyItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  historyItemDate: { fontSize: 12, color: MUTED, fontWeight: "500" },
  historyItemValue: { fontSize: 13, color: INK, marginTop: 4 },
  historyItemNote: {
    fontSize: 12,
    color: MUTED,
    marginTop: 4,
    fontStyle: "italic",
  },

  descriptionSection: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: INK,
    marginBottom: 12,
  },
  descriptionText: { fontSize: 15, lineHeight: 24, color: MUTED },
  seeMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
    alignSelf: "flex-start",
  },
  seeMoreText: { fontSize: 14, fontWeight: "700", color: PRIMARY },

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
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
  },
  speciesChipText: { fontSize: 13, fontWeight: "600", color: INK },

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
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 5,
    alignSelf: "flex-start",
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: {
    fontSize: 10,
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
