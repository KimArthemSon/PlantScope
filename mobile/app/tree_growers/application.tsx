import React, { useState, useEffect } from "react";
import { useRouter } from "expo-router";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Dimensions,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  RefreshControl,
  FlatList,
} from "react-native";
import * as SecureStore from "expo-secure-store";

import { WebView } from "react-native-webview";

import { Ionicons } from "@expo/vector-icons";

import { api, MAPBOX_TOKEN } from "@/constants/url_fixed";

// ─── FIXED OSM / Leaflet Map Component ─────────────────────────────────────
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
  // ✅ Safe fallbacks to prevent Leaflet crashes from undefined coordinates
  const safeLat = region?.latitude || 11.036;
  const safeLng = region?.longitude || 124.635;

  // ✅ Robust polygon parsing (handles both arrays and objects)
  const safePolygon =
    polygon && polygon.length > 0
      ? JSON.stringify(
          polygon.map((p) => (Array.isArray(p) ? p : [p.latitude, p.longitude]))
        )
      : "[]";

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <style>
        /* ✅ CRITICAL: Explicit heights prevent WebView collapsing to 0px */
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
          var map = L.map('map', {
            center: [${safeLat}, ${safeLng}],
            zoom: 15,
            zoomControl: true
          });
          
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap',
            maxZoom: 19,
            crossOrigin: true
          }).addTo(map);
          
          var polygonCoords = ${safePolygon};
          if (polygonCoords.length > 0) {
            var poly = L.polygon(polygonCoords, {
              color: '#0F4A2F',
              fillColor: '#0F4A2F',
              fillOpacity: 0.3,
              weight: 2
            }).addTo(map);
            map.fitBounds(poly.getBounds(), { padding: [20, 20] });
          }
          
          ${
            marker
              ? `
          var customIcon = L.divIcon({
            className: 'custom-marker-wrapper',
            html: '<div style="width: 20px; height: 20px; background-color: #0F4A2F; border: 3px solid #fff; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          });
          L.marker([${marker?.latitude || safeLat}, ${marker?.longitude || safeLng}], {icon: customIcon}).addTo(map)
            .bindPopup('${marker?.title || "Site"}');
          `
              : ""
          }
          
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({type: 'info', message: 'Map loaded successfully'}));
          }
        } catch(e) {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({type: 'error', message: e.message}));
          }
        }
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
      
      // ✅ CRITICAL PROPS FOR ANDROID / EXPO GO
      mixedContentMode="always" 
      originWhitelist={["*"]}
      androidHardwareAccelerationDisabled={true} // ✅ Fixes blank/gray map tiles on Android
      setSupportMultipleWindows={false} // ✅ Prevents WebView crashes/blank screens
      nestedScrollEnabled={true} // ✅ Allows parent ScrollView to scroll when touching map
      
      onMessage={(event) => {
        try {
          const data = JSON.parse(event.nativeEvent.data);
          if (data.type === "error") {
            console.error("🗺️ Map JS Error:", data.message);
          } else {
            console.log("🗺️ Map Info:", data.message);
          }
        } catch (e) {}
      }}
      onError={(syntheticEvent) => {
        console.error("🗺️ WebView Native Error: ", syntheticEvent.nativeEvent);
      }}
    />
  );
};

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

// ─── Types ───────────────────────────────────────────────────────────────
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

interface ProfileData {
  first_name: string;
  last_name: string;
  contact: string;
  gender: string;
  profile_img: string;
}

interface GeneralImage {
  image_url: string | null;
  caption: string | null;
}

interface RecommendedSpecies {
  species_id: number;
  species_name: string;
  rank: number;
}

interface AssignedSite {
  site_id: number;
  name: string;
  total_area_hectares: number;
  ndvi_value: number | null;
  polygon_coordinates: [number, number][] | string | null;
  reforestation_area_name: string | null;
  barangay_name: string | null;
  accessibility: any;
  land_classification_name: string | null;
  general_images: GeneralImage[];
  recommended_species: RecommendedSpecies[];
}

interface SeedlingSpeciesItem {
  species_id: number;
  species_name: string;
  quantity: number;
  provided_by: string;
}

interface SeedlingRequest {
  request_id: number;
  no_request_seedling: number;
  species: SeedlingSpeciesItem[];
  status: "pending" | "accepted" | "rejected";
  reason_accepted: string | null;
  submitted_at: string | null;
}

interface ProgressReportSpeciesItem {
  species_id: number;
  species_name: string;
  no_survived: number;
  no_dead: number;
  total: number;
  survival_rate: number;
}

interface ProgressReport {
  report_id: number;
  total_survived: number;
  total_dead: number;
  species: ProgressReportSpeciesItem[];
  description: string | null;
  status: "pending" | "accepted" | "rejected";
  proof_image: string | null;
  submitted_at: string | null;
}

interface ApplicationDetail {
  application: ApplicationData | null;
  group: GroupData | null;
  profile: ProfileData | null;
  assigned_site: AssignedSite | null;
  proposed_site: any | null;
  seedling_requests: SeedlingRequest[];
  progress_reports: ProgressReport[];
  latest_reason: { reason: string; status: string; created: string } | null;
}

interface TreeSpeciesOption {
  tree_specie_id: number;
  name: string;
  description: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────
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
    label: "Accepted",
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

const formatDate = (iso: string) =>
  !iso
    ? "—"
    : new Date(iso).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });

const getTotalSeedlings = (species: SeedlingSpeciesItem[]) =>
  species.reduce((sum, item) => sum + (item.quantity || 0), 0);

const parsePolygonCoordinates = (
  coords: [number, number][] | string | null | undefined,
): [number, number][] => {
  if (!coords) return [];
  if (Array.isArray(coords) && coords.length > 0 && Array.isArray(coords[0]))
    return coords as [number, number][];
  if (typeof coords === "string") {
    try {
      const parsed = JSON.parse(coords);
      if (Array.isArray(parsed)) return parsed;
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
        .replace(/\b\w/g, (l) => l.toUpperCase());
    if (accessibility.description) return accessibility.description;
  }
  return "Specified";
};

// ─── Sub-components ───────────────────────────────────────────────────────
const StatusBadge = ({ status }: { status: string }) => {
  const conf = getStatusConf(status);
  return (
    <View style={[badge.wrap, { backgroundColor: conf.bg }]}>
      <View style={[badge.dot, { backgroundColor: conf.dot }]} />
      <Text style={[badge.text, { color: conf.text }]}>{conf.label}</Text>
    </View>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────
const ApplicationPage: React.FC = () => {
  const router = useRouter();
  const [detail, setDetail] = useState<ApplicationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "overview" | "seedlings" | "reports"
  >("overview");

  const [showMap, setShowMap] = useState(false);
  const [requestSeedlingModal, setRequestSeedlingModal] = useState(false);
  const [reportDetailModal, setReportDetailModal] =
    useState<ProgressReport | null>(null);

  // Seedling Request Builder State
  const [allTreeSpecies, setAllTreeSpecies] = useState<TreeSpeciesOption[]>([]);
  const [selectedSpeciesId, setSelectedSpeciesId] = useState<string>("");
  const [selectedQuantity, setSelectedQuantity] = useState<string>("");
  const [activeSeedlingList, setActiveSeedlingList] = useState<
    SeedlingSpeciesItem[]
  >([]);
  const [requestDescription, setRequestDescription] = useState("");

  const [submitting, setSubmitting] = useState(false);

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

  useEffect(() => {
    fetchData();
  }, []);
  const onRefresh = () => {
    setRefreshing(true);
    fetchData(true);
  };

  const fetchTreeSpecies = async () => {
    try {
      const token = await SecureStore.getItemAsync("token");
      const res = await fetch(`${api}/api/get_tree_species_list/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAllTreeSpecies(data);
      }
    } catch (err) {
      console.error("Failed to fetch species:", err);
    }
  };

  const handleAddSpeciesToList = () => {
    if (!selectedSpeciesId || !selectedQuantity) {
      Alert.alert(
        "Missing Info",
        "Please select a species and enter a quantity.",
      );
      return;
    }
    const found = allTreeSpecies.find(
      (s) => s.tree_specie_id === Number(selectedSpeciesId),
    );
    if (!found) return;

    if (activeSeedlingList.find((s) => s.species_id === found.tree_specie_id)) {
      Alert.alert(
        "Already Added",
        "This species is already in your request list.",
      );
      return;
    }

    const newItem: SeedlingSpeciesItem = {
      species_id: found.tree_specie_id,
      species_name: found.name,
      quantity: parseInt(selectedQuantity),
      provided_by: "TBD",
    };
    setActiveSeedlingList([...activeSeedlingList, newItem]);
    setSelectedSpeciesId("");
    setSelectedQuantity("");
  };

  const handleRemoveSpeciesFromList = (speciesId: number) => {
    setActiveSeedlingList(
      activeSeedlingList.filter((s) => s.species_id !== speciesId),
    );
  };

  const handleRequestSeedling = async () => {
    if (!detail?.application) return;
    if (activeSeedlingList.length === 0) {
      Alert.alert(
        "Missing Species",
        "Please add at least one tree species to your request.",
      );
      return;
    }

    setSubmitting(true);
    try {
      const token = await SecureStore.getItemAsync("token");
      const fd = new FormData();
      fd.append("application_id", String(detail.application.application_id));
      fd.append(
        "seedling_species",
        JSON.stringify(
          activeSeedlingList.map((s) => ({
            tree_species_id: s.species_id,
            quantity: s.quantity,
            provided_by: s.provided_by,
          })),
        ),
      );
      fd.append("description", requestDescription);

      const res = await fetch(`${api}/api/create_seedling_request/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const responseData = await res.json();
      if (!res.ok) throw new Error(responseData.error ?? "Request failed.");

      Alert.alert(
        "✓ Request Submitted",
        "Your seedling request is pending review by the Data Manager.",
      );
      setRequestSeedlingModal(false);
      resetSeedlingForm();
      fetchData(true);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const resetSeedlingForm = () => {
    setActiveSeedlingList([]);
    setSelectedSpeciesId("");
    setSelectedQuantity("");
    setRequestDescription("");
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

  const acceptedSeedlingRequests =
    detail?.seedling_requests?.filter((r) => r.status === "accepted") || [];
  const pendingSeedlingRequests =
    detail?.seedling_requests?.filter((r) => r.status === "pending") || [];
  const allProgressReports = detail?.progress_reports || [];

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0F4A2F" />
        <Text style={styles.loadingText}>Loading your program…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <View style={styles.errorIconWrap}>
          <Ionicons name="leaf-outline" size={40} color="#0F4A2F" />
        </View>
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
    ["completed", "rejected", "cancelled"].includes(detail.application.status);

  if (isTerminalState) {
    return (
      <View style={styles.container}>
        <View style={styles.banner}>
          <View style={styles.bannerInner}>
            <View style={styles.bannerLeft}>
              <View style={styles.bannerIconWrap}>
                <Ionicons name="leaf" size={20} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.bannerTitle}>Tree Planting Program</Text>
                <Text style={styles.bannerSub}>Ready for a new project?</Text>
              </View>
            </View>
          </View>
        </View>
        <View style={styles.reapplyContainer}>
          <View style={styles.reapplyIconWrap}>
            <Ionicons name="sparkles-outline" size={48} color="#0F4A2F" />
          </View>
          <Text style={styles.reapplyTitle}>
            {detail?.application
              ? "Program Completed!"
              : "No Active Application"}
          </Text>
          <Text style={styles.reapplyMessage}>
            {detail?.application
              ? "Thank you for your previous contribution! You are now eligible to start a new tree planting project."
              : "It looks like you haven't applied for a tree planting program yet. Start your journey today!"}
          </Text>
          <TouchableOpacity
            style={styles.reapplyButton}
            onPress={() => router.push("/tree_growers/Reapply")}
            activeOpacity={0.8}
          >
            <Ionicons name="add-circle-outline" size={20} color="#fff" />
            <Text style={styles.reapplyButtonText}>Apply for New Program</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const { application, group, profile, assigned_site } =
    detail as ApplicationDetail & { application: ApplicationData };
  const appStatusConf = getStatusConf(application.status);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.banner}>
        <View style={styles.bannerInner}>
          <View style={styles.bannerLeft}>
            <View style={styles.bannerIconWrap}>
              <Ionicons name="leaf" size={20} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerTitle} numberOfLines={2}>
                {application.title}
              </Text>
              <Text style={styles.bannerSub}>
                {group?.group_name || "Tree Planting Program"}
              </Text>
            </View>
          </View>
          <StatusBadge status={application.status} />
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.segmentWrap}>
        <View style={styles.segment}>
          {[
            { key: "overview", label: "Overview", icon: "clipboard-outline" },
            { key: "seedlings", label: "Seedlings", icon: "leaf-outline" },
            { key: "reports", label: "Reports", icon: "bar-chart-outline" },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.segTab,
                activeTab === tab.key && styles.segTabActive,
              ]}
              onPress={() => setActiveTab(tab.key as any)}
            >
              <Ionicons
                name={tab.icon as any}
                size={14}
                color={activeTab === tab.key ? "#fff" : "#6B7280"}
              />
              <Text
                style={[
                  styles.segLabel,
                  activeTab === tab.key && styles.segLabelActive,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#0F4A2F"
          />
        }
        contentContainerStyle={styles.scrollContent}
      >
        {/* Overview Tab */}
        {activeTab === "overview" && (
          <>
            <View style={styles.areaBanner}>
              <View>
                <Text style={styles.areaLabel}>Approved Seedlings</Text>
                <Text style={styles.areaValue}>
                  {acceptedSeedlingRequests.length > 0
                    ? acceptedSeedlingRequests
                        .reduce(
                          (sum, req) => sum + getTotalSeedlings(req.species),
                          0,
                        )
                        .toLocaleString()
                    : "0"}
                  <Text style={styles.areaUnit}> seedlings</Text>
                </Text>
              </View>
              <View style={styles.areaIconCircle}>
                <Ionicons name="leaf-outline" size={24} color="#fff" />
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="calendar-outline" size={16} color="#0F4A2F" />
                <Text style={styles.cardTitle}>Key Dates & Details</Text>
              </View>
              <View style={styles.datesRow}>
                <View style={styles.dateItem}>
                  <Text style={styles.dateLabel}>Submitted</Text>
                  <Text style={styles.dateValue}>
                    {formatDate(application.created_at)}
                  </Text>
                </View>
                <View style={styles.dateDivider} />
                <View style={styles.dateItem}>
                  <Text style={styles.dateLabel}>Orientation</Text>
                  <Text style={styles.dateValue}>
                    {application.orientation_date
                      ? formatDate(application.orientation_date)
                      : "Not set"}
                  </Text>
                </View>
                <View style={styles.dateDivider} />
                <View style={styles.dateItem}>
                  <Text style={styles.dateLabel}>Growers</Text>
                  <Text style={[styles.dateValue, { color: "#0F4A2F" }]}>
                    {application.total_treegrowers_will_participate}
                  </Text>
                </View>
              </View>
            </View>

            {assigned_site && (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Ionicons name="location-outline" size={16} color="#0F4A2F" />
                  <Text style={styles.cardTitle}>Assigned Planting Site</Text>
                </View>

                {/* Location Context */}
                <View
                  style={{
                    backgroundColor: "#F9FAFB",
                    padding: 12,
                    borderRadius: 12,
                    marginBottom: 12,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "800",
                      color: "#111827",
                      marginBottom: 4,
                    }}
                  >
                    {assigned_site.name}
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    {assigned_site.reforestation_area_name && (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Ionicons
                          name="trail-sign-outline"
                          size={12}
                          color="#0F4A2F"
                        />
                        <Text
                          style={{
                            fontSize: 12,
                            color: "#0F4A2F",
                            fontWeight: "600",
                          }}
                        >
                          {assigned_site.reforestation_area_name}
                        </Text>
                      </View>
                    )}
                    {assigned_site.barangay_name && (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Ionicons
                          name="map-outline"
                          size={12}
                          color="#6B7280"
                        />
                        <Text style={{ fontSize: 12, color: "#6B7280" }}>
                          {assigned_site.barangay_name}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Site Stats */}
                <View
                  style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}
                >
                  <View
                    style={{
                      flex: 1,
                      backgroundColor: "#E8F5E9",
                      padding: 10,
                      borderRadius: 10,
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        color: "#2E7D32",
                        fontWeight: "700",
                        textTransform: "uppercase",
                      }}
                    >
                      Area
                    </Text>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "800",
                        color: "#111827",
                      }}
                    >
                      {assigned_site.total_area_hectares.toFixed(2)} ha
                    </Text>
                  </View>
                  <View
                    style={{
                      flex: 1,
                      backgroundColor: "#E3F2FD",
                      padding: 10,
                      borderRadius: 10,
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        color: "#1565C0",
                        fontWeight: "700",
                        textTransform: "uppercase",
                      }}
                    >
                      NDVI Score
                    </Text>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "800",
                        color: "#111827",
                      }}
                    >
                      {assigned_site.ndvi_value !== null
                        ? assigned_site.ndvi_value.toFixed(2)
                        : "N/A"}
                    </Text>
                  </View>
                </View>

                {/* General Images Carousel */}
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: "#6B7280",
                    textTransform: "uppercase",
                    marginBottom: 8,
                  }}
                >
                  Site Images
                </Text>
                <ScrollView
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  style={{
                    height: 160,
                    borderRadius: 12,
                    overflow: "hidden",
                    marginBottom: 12,
                  }}
                >
                  {assigned_site.general_images &&
                  assigned_site.general_images.length > 0 ? (
                    assigned_site.general_images.map((img, index) => (
                      <View
                        key={index}
                        style={{
                          width: screenWidth - 64,
                          height: 160,
                          marginRight:
                            index === assigned_site.general_images.length - 1
                              ? 0
                              : 12,
                        }}
                      >
                        <Image
                          source={{
                            uri: img.image_url?.startsWith("http")
                              ? img.image_url
                              : `${api}${img.image_url}`, // ✅ FIXED: Prepend API URL if relative
                          }}
                          style={{
                            width: "100%",
                            height: "100%",
                            borderRadius: 12,
                          }}
                          resizeMode="cover"
                        />
                        {img.caption && (
                          <View
                            style={{
                              position: "absolute",
                              bottom: 0,
                              left: 0,
                              right: 0,
                              backgroundColor: "rgba(0,0,0,0.6)",
                              padding: 8,
                              borderBottomLeftRadius: 12,
                              borderBottomRightRadius: 12,
                            }}
                          >
                            <Text
                              style={{
                                color: "#fff",
                                fontSize: 12,
                                fontWeight: "600",
                              }}
                              numberOfLines={1}
                            >
                              {img.caption}
                            </Text>
                          </View>
                        )}
                      </View>
                    ))
                  ) : (
                    <View
                      style={{
                        width: "100%",
                        height: "100%",
                        backgroundColor: "#E8F5E9",
                        justifyContent: "center",
                        alignItems: "center",
                        borderRadius: 12,
                      }}
                    >
                      <Ionicons
                        name="image-outline"
                        size={32}
                        color="#2E7D32"
                      />
                      <Text
                        style={{ color: "#2E7D32", fontSize: 12, marginTop: 4 }}
                      >
                        No site images available
                      </Text>
                    </View>
                  )}
                </ScrollView>

                {/* Metadata Grid */}
                <View
                  style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}
                >
                  <View
                    style={{
                      flex: 1,
                      backgroundColor: "#F3F4F6",
                      padding: 12,
                      borderRadius: 12,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        marginBottom: 4,
                      }}
                    >
                      <Ionicons name="car-sport" size={14} color="#0F4A2F" />
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: "700",
                          color: "#6B7280",
                          textTransform: "uppercase",
                        }}
                      >
                        Accessibility
                      </Text>
                    </View>
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "600",
                        color: "#111827",
                      }}
                      numberOfLines={2}
                    >
                      {getAccessibilityText(assigned_site.accessibility)}
                    </Text>
                  </View>
                  <View
                    style={{
                      flex: 1,
                      backgroundColor: "#F3F4F6",
                      padding: 12,
                      borderRadius: 12,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        marginBottom: 4,
                      }}
                    >
                      <Ionicons name="layers" size={14} color="#0F4A2F" />
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: "700",
                          color: "#6B7280",
                          textTransform: "uppercase",
                        }}
                      >
                        Land Class
                      </Text>
                    </View>
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "600",
                        color: "#111827",
                      }}
                      numberOfLines={2}
                    >
                      {assigned_site.land_classification_name ||
                        "Not classified"}
                    </Text>
                  </View>
                </View>

                {/* Recommended Species */}
                {assigned_site.recommended_species &&
                  assigned_site.recommended_species.length > 0 && (
                    <View style={{ marginBottom: 12 }}>
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "700",
                          color: "#6B7280",
                          textTransform: "uppercase",
                          marginBottom: 8,
                        }}
                      >
                        Recommended Species
                      </Text>
                      <View
                        style={{
                          flexDirection: "row",
                          flexWrap: "wrap",
                          gap: 8,
                        }}
                      >
                        {assigned_site.recommended_species.map((sp) => (
                          <View
                            key={sp.species_id}
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              backgroundColor: "#E8F5E9",
                              paddingHorizontal: 10,
                              paddingVertical: 6,
                              borderRadius: 20,
                              gap: 4,
                            }}
                          >
                            <Ionicons name="leaf" size={12} color="#2E7D32" />
                            <Text
                              style={{
                                fontSize: 12,
                                fontWeight: "600",
                                color: "#2E7D32",
                              }}
                            >
                              {sp.species_name}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                {/* Map Preview */}
                <TouchableOpacity
                  style={styles.mapPreviewWrap}
                  onPress={() => setShowMap(true)}
                >
                  <OSMMap
                    region={getMapRegion()}
                    polygon={polygonCoords}
                    marker={centroid}
                    style={{ width: "100%", height: "100%" }}
                  />

                  <View style={styles.mapTapOverlay}>
                    <Ionicons name="expand-outline" size={16} color="#fff" />
                    <Text style={styles.mapTapText}>Tap to expand map</Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}

            {["accepted", "under_monitoring", "completed"].includes(
              application.status,
            ) && (
              <View style={styles.actionsGrid}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => {
                    fetchTreeSpecies();
                    setRequestSeedlingModal(true);
                  }}
                >
                  <View
                    style={[styles.actionIcon, { backgroundColor: "#E3F2FD" }]}
                  >
                    <Ionicons name="leaf-outline" size={24} color="#1565C0" />
                  </View>
                  <Text style={styles.actionLabel}>Request Seedlings</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.guidanceCard}>
              <Ionicons
                name="information-circle-outline"
                size={18}
                color="#0F4A2F"
              />
              <Text style={styles.guidanceText}>
                {application.status === "for_evaluation" &&
                  "Your application is being evaluated by the Data Manager."}
                {application.status === "for_head" &&
                  "Your application is pending final approval from the City ENRO Head."}
                {application.status === "accepted" &&
                  "✓ Application approved! You may now request seedlings for your assigned site."}
                {application.status === "under_monitoring" &&
                  "✓ Program active. Onsite inspectors will monitor progress."}
                {application.status === "completed" &&
                  "✓ Program completed. Thank you for your contribution!"}
                {application.status === "rejected" &&
                  "✗ Application rejected. Please contact the Data Manager for feedback."}
              </Text>
            </View>
          </>
        )}

        {/* Seedlings Tab */}
        {activeTab === "seedlings" && (
          <>
            {acceptedSeedlingRequests.map((req) => (
              <View key={req.request_id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={16}
                    color="#2E7D32"
                  />
                  <Text style={styles.cardTitle}>Approved Seedlings</Text>
                  <StatusBadge status="accepted" />
                </View>
                <Text style={styles.cardSub}>
                  Total: {getTotalSeedlings(req.species).toLocaleString()}{" "}
                  seedlings • {formatDate(req.submitted_at || "")}
                </Text>
                <View style={styles.seedlingList}>
                  {req.species.map((item, i) => (
                    <View key={i} style={seedlingItem.wrap}>
                      <View style={seedlingItem.left}>
                        <Ionicons
                          name="leaf-outline"
                          size={16}
                          color="#0F4A2F"
                        />
                        <Text style={seedlingItem.species}>
                          {item.species_name}
                        </Text>
                      </View>
                      <View style={seedlingItem.right}>
                        <Text style={seedlingItem.quantity}>
                          {item.quantity.toLocaleString()}
                        </Text>
                        <Text style={seedlingItem.provider} numberOfLines={1}>
                          {item.provided_by}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
                {req.reason_accepted && (
                  <View style={styles.reasonBox}>
                    <Ionicons
                      name="chatbubble-outline"
                      size={12}
                      color="#2E7D32"
                    />
                    <Text style={styles.reasonText}>{req.reason_accepted}</Text>
                  </View>
                )}
              </View>
            ))}

            {pendingSeedlingRequests.length > 0 && (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Ionicons name="time-outline" size={16} color="#F57F17" />
                  <Text style={styles.cardTitle}>Your Pending Requests</Text>
                </View>
                {pendingSeedlingRequests.map((req) => (
                  <View key={req.request_id} style={styles.pendingItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pendingSpecies}>
                        {req.species.map((s) => s.species_name).join(", ")}
                      </Text>
                      <Text style={styles.pendingMeta}>
                        {getTotalSeedlings(req.species)} seedlings •{" "}
                        {formatDate(req.submitted_at || "")}
                      </Text>
                    </View>
                    <StatusBadge status={req.status} />
                  </View>
                ))}
              </View>
            )}

            {acceptedSeedlingRequests.length === 0 &&
              pendingSeedlingRequests.length === 0 && (
                <View style={styles.emptyState}>
                  <View style={styles.emptyIconWrap}>
                    <Ionicons name="leaf-outline" size={36} color="#0F4A2F" />
                  </View>
                  <Text style={styles.emptyTitle}>No Seedlings Yet</Text>
                  <Text style={styles.emptyMsg}>
                    {["accepted", "under_monitoring", "completed"].includes(
                      application.status,
                    )
                      ? "Request seedlings to get started with your tree planting program."
                      : "Seedling provisions will appear here once your application is approved."}
                  </Text>
                </View>
              )}

            {["accepted", "under_monitoring", "completed"].includes(
              application.status,
            ) && (
              <TouchableOpacity
                style={styles.fab}
                onPress={() => {
                  fetchTreeSpecies();
                  setRequestSeedlingModal(true);
                }}
              >
                <Ionicons name="add" size={22} color="#fff" />
                <Text style={styles.fabText}>Request Seedlings</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {/* Reports Tab */}
        {activeTab === "reports" && (
          <>
            {allProgressReports.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconWrap}>
                  <Ionicons
                    name="clipboard-outline"
                    size={36}
                    color="#0F4A2F"
                  />
                </View>
                <Text style={styles.emptyTitle}>No Reports Yet</Text>
                <Text style={styles.emptyMsg}>
                  Progress reports are submitted by onsite inspectors during
                  monitoring.
                </Text>
              </View>
            ) : (
              allProgressReports.map((item) => (
                <TouchableOpacity
                  key={item.report_id}
                  style={styles.reportCard}
                  onPress={() => setReportDetailModal(item)}
                  activeOpacity={0.75}
                >
                  <View style={styles.reportCardTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reportCardTitle} numberOfLines={1}>
                        Report #{item.report_id}
                      </Text>
                      <Text style={styles.reportCardDate}>
                        {formatDate(item.submitted_at || item.created_at)}
                      </Text>
                    </View>
                    <StatusBadge status={item.status} />
                  </View>
                  <View style={styles.reportMini}>
                    <View style={styles.reportMiniItem}>
                      <Text
                        style={[styles.reportMiniVal, { color: "#2E7D32" }]}
                      >
                        {item.total_survived.toLocaleString()}
                      </Text>
                      <Text style={styles.reportMiniLabel}>Survived</Text>
                    </View>
                    <View style={styles.reportMiniItem}>
                      <Text
                        style={[styles.reportMiniVal, { color: "#C62828" }]}
                      >
                        {item.total_dead.toLocaleString()}
                      </Text>
                      <Text style={styles.reportMiniLabel}>Dead</Text>
                    </View>
                  </View>
                  <View style={styles.reportCardFooter}>
                    <Text style={styles.reportCardCta}>View Details</Text>
                    <Ionicons
                      name="chevron-forward"
                      size={14}
                      color="#0F4A2F"
                    />
                  </View>
                </TouchableOpacity>
              ))
            )}
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Map Modal */}
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

          <View style={styles.mapModalBar}>
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

      {/* Report Detail Modal */}
      <Modal
        visible={!!reportDetailModal}
        animationType="slide"
        transparent
        onRequestClose={() => setReportDetailModal(null)}
      >
        <View style={sheet.overlay}>
          <View style={sheet.panel}>
            <View style={sheet.handle} />
            {reportDetailModal && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={sheet.headerRow}>
                  <Text style={sheet.title}>
                    Report #{reportDetailModal.report_id}
                  </Text>
                  <StatusBadge status={reportDetailModal.status} />
                </View>
                <Text style={sheet.date}>
                  {formatDate(
                    reportDetailModal.submitted_at ||
                      reportDetailModal.created_at,
                  )}
                </Text>

                <View style={sheet.metricsBox}>
                  <View style={sheet.metricRow}>
                    <Text style={sheet.metricLabel}>Total Survived</Text>
                    <Text style={[sheet.metricVal, { color: "#2E7D32" }]}>
                      {reportDetailModal.total_survived.toLocaleString()}
                    </Text>
                  </View>
                  <View style={sheet.metricRow}>
                    <Text style={sheet.metricLabel}>Total Dead</Text>
                    <Text style={[sheet.metricVal, { color: "#C62828" }]}>
                      {reportDetailModal.total_dead.toLocaleString()}
                    </Text>
                  </View>
                </View>

                {reportDetailModal.species &&
                  reportDetailModal.species.length > 0 && (
                    <View style={{ marginTop: 16 }}>
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "700",
                          color: "#6B7280",
                          textTransform: "uppercase",
                          marginBottom: 8,
                        }}
                      >
                        Per-Species Breakdown
                      </Text>
                      {reportDetailModal.species.map((sp, idx) => (
                        <View
                          key={idx}
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            alignItems: "center",
                            paddingVertical: 8,
                            borderBottomWidth: 1,
                            borderBottomColor: "#F3F4F6",
                          }}
                        >
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 8,
                            }}
                          >
                            <Ionicons
                              name="leaf-outline"
                              size={16}
                              color="#0F4A2F"
                            />
                            <Text
                              style={{
                                fontSize: 14,
                                fontWeight: "600",
                                color: "#111827",
                              }}
                            >
                              {sp.species_name}
                            </Text>
                          </View>
                          <View style={{ alignItems: "flex-end" }}>
                            <Text
                              style={{
                                fontSize: 13,
                                fontWeight: "700",
                                color: "#0F4A2F",
                              }}
                            >
                              {sp.no_survived}{" "}
                              <Text
                                style={{
                                  fontSize: 11,
                                  color: "#6B7280",
                                  fontWeight: "400",
                                }}
                              >
                                / {sp.total} ({sp.survival_rate}%)
                              </Text>
                            </Text>
                            <Text style={{ fontSize: 11, color: "#C62828" }}>
                              {sp.no_dead} dead
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}

                {reportDetailModal.proof_image && (
                  <Image
                    source={{
                      uri: reportDetailModal.proof_image.startsWith("http")
                        ? reportDetailModal.proof_image
                        : `${api}${reportDetailModal.proof_image}`, // ✅ FIXED: Prepend API URL if relative
                    }}
                    style={sheet.proofImage}
                    resizeMode="cover"
                  />
                )}
                <TouchableOpacity
                  style={sheet.closeBtn}
                  onPress={() => setReportDetailModal(null)}
                >
                  <Text style={sheet.closeTxt}>Close</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Seedling Request Modal (Dynamic Builder) */}
      <Modal
        visible={requestSeedlingModal}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setRequestSeedlingModal(false);
          resetSeedlingForm();
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={sheet.overlay}
        >
          <View style={[sheet.panel, { maxHeight: screenHeight * 0.9 }]}>
            <View style={sheet.handle} />
            <View style={sheet.headerRow}>
              <Text style={sheet.title}>Request Seedlings</Text>
              <TouchableOpacity
                onPress={() => {
                  setRequestSeedlingModal(false);
                  resetSeedlingForm();
                }}
              >
                <Ionicons name="close-circle" size={24} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            {assigned_site && (
              <View
                style={{
                  backgroundColor: "#E8F5E9",
                  padding: 10,
                  borderRadius: 10,
                  marginBottom: 16,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Ionicons name="location" size={14} color="#2E7D32" />
                <Text
                  style={{ fontSize: 12, color: "#2E7D32", fontWeight: "600" }}
                >
                  For: {assigned_site.name}
                </Text>
              </View>
            )}

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Add Species Section */}
              <View
                style={{
                  backgroundColor: "#F9FAFB",
                  padding: 12,
                  borderRadius: 12,
                  marginBottom: 16,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: "#6B7280",
                    textTransform: "uppercase",
                    marginBottom: 8,
                  }}
                >
                  Add Tree Species
                </Text>

                <Text style={form_.label}>Select Species</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ marginBottom: 12 }}
                >
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {allTreeSpecies.map((sp) => (
                      <TouchableOpacity
                        key={sp.tree_specie_id}
                        onPress={() =>
                          setSelectedSpeciesId(String(sp.tree_specie_id))
                        }
                        style={{
                          paddingHorizontal: 14,
                          paddingVertical: 8,
                          borderRadius: 20,
                          backgroundColor:
                            selectedSpeciesId === String(sp.tree_specie_id)
                              ? "#0F4A2F"
                              : "#fff",
                          borderWidth: 1,
                          borderColor:
                            selectedSpeciesId === String(sp.tree_specie_id)
                              ? "#0F4A2F"
                              : "#E5E7EB",
                        }}
                      >
                        <Text
                          style={{
                            color:
                              selectedSpeciesId === String(sp.tree_specie_id)
                                ? "#fff"
                                : "#374151",
                            fontWeight: "600",
                            fontSize: 13,
                          }}
                        >
                          {sp.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>

                <Text style={form_.label}>Quantity</Text>
                <View
                  style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}
                >
                  <TextInput
                    style={[form_.input, { flex: 1, marginBottom: 0 }]}
                    placeholder="e.g. 50"
                    keyboardType="numeric"
                    value={selectedQuantity}
                    onChangeText={setSelectedQuantity}
                    placeholderTextColor="#B0BAC4"
                  />
                  <TouchableOpacity
                    style={[
                      form_.submitBtn,
                      {
                        flex: 0,
                        paddingHorizontal: 20,
                        marginBottom: 0,
                        opacity:
                          !selectedSpeciesId || !selectedQuantity ? 0.5 : 1,
                      },
                    ]}
                    onPress={handleAddSpeciesToList}
                    disabled={!selectedSpeciesId || !selectedQuantity}
                  >
                    <Ionicons name="add" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Active List */}
              {activeSeedlingList.length > 0 && (
                <View style={{ marginBottom: 16 }}>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "700",
                      color: "#6B7280",
                      textTransform: "uppercase",
                      marginBottom: 8,
                    }}
                  >
                    Request List ({activeSeedlingList.length})
                  </Text>
                  {activeSeedlingList.map((item) => (
                    <View
                      key={item.species_id}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        backgroundColor: "#fff",
                        padding: 12,
                        borderRadius: 12,
                        marginBottom: 8,
                        borderWidth: 1,
                        borderColor: "#E5E7EB",
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <View
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 16,
                            backgroundColor: "#E8F5E9",
                            justifyContent: "center",
                            alignItems: "center",
                          }}
                        >
                          <Ionicons name="leaf" size={16} color="#2E7D32" />
                        </View>
                        <View>
                          <Text
                            style={{
                              fontSize: 14,
                              fontWeight: "700",
                              color: "#111827",
                            }}
                          >
                            {item.species_name}
                          </Text>
                          <Text
                            style={{
                              fontSize: 12,
                              color: "#0F4A2F",
                              fontWeight: "600",
                            }}
                          >
                            {item.quantity} seedlings
                          </Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        onPress={() =>
                          handleRemoveSpeciesFromList(item.species_id)
                        }
                        style={{ padding: 4 }}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={18}
                          color="#EF4444"
                        />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              <Text style={form_.label}>Description (Optional)</Text>
              <TextInput
                style={[form_.input, form_.textarea]}
                placeholder="Reason for request…"
                value={requestDescription}
                onChangeText={setRequestDescription}
                multiline
                numberOfLines={3}
                placeholderTextColor="#B0BAC4"
                textAlignVertical="top"
              />

              <View style={form_.actions}>
                <TouchableOpacity
                  style={form_.cancelBtn}
                  onPress={() => {
                    setRequestSeedlingModal(false);
                    resetSeedlingForm();
                  }}
                >
                  <Text style={form_.cancelTxt}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[form_.submitBtn, submitting && form_.submitDisabled]}
                  onPress={handleRequestSeedling}
                  disabled={submitting || activeSeedlingList.length === 0}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={form_.submitTxt}>Submit Request</Text>
                  )}
                </TouchableOpacity>
              </View>
              <View style={{ height: 30 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F7F5" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  loadingText: { marginTop: 14, color: "#6B7280", fontSize: 14 },
  errorIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#E8F5E9",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 6,
  },
  errorMsg: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 24,
  },
  retryBtn: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    backgroundColor: "#0F4A2F",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  banner: {
    backgroundColor: "#0F4A2F",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
  },
  bannerInner: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  bannerLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  bannerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#fff",
    lineHeight: 22,
  },
  bannerSub: { fontSize: 11, color: "rgba(255,255,255,0.65)", marginTop: 2 },
  segmentWrap: {
    backgroundColor: "#0F4A2F",
    paddingHorizontal: 16,
    paddingBottom: 14,
    paddingTop: 10,
  },
  segment: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 12,
    padding: 3,
  },
  segTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
  },
  segTabActive: { backgroundColor: "#fff" },
  segLabel: { fontSize: 13, fontWeight: "600", color: "rgba(255,255,255,0.7)" },
  segLabelActive: { color: "#0F4A2F" },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 14, fontWeight: "700", color: "#111827" },
  cardSub: { fontSize: 12, color: "#6B7280", marginBottom: 12 },
  areaBanner: {
    backgroundColor: "#0F4A2F",
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  areaLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    fontWeight: "600",
    marginBottom: 4,
  },
  areaValue: { fontSize: 30, fontWeight: "900", color: "#fff" },
  areaUnit: { fontSize: 14, fontWeight: "500", color: "rgba(255,255,255,0.7)" },
  areaIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  datesRow: { flexDirection: "row", alignItems: "center" },
  dateItem: { flex: 1, alignItems: "center", paddingVertical: 4 },
  dateLabel: { fontSize: 11, color: "#9CA3AF", marginBottom: 4 },
  dateValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
  },
  dateDivider: { width: 1, height: 40, backgroundColor: "#F3F4F6" },
  mapPreviewWrap: {
    height: 160,
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 12,
    position: "relative",
  },
  mapTapOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(15,74,47,0.8)",
    paddingVertical: 8,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  mapTapText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  actionsGrid: { flexDirection: "row", gap: 12, marginBottom: 12 },
  actionBtn: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#111827",
    textAlign: "center",
  },
  guidanceCard: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#E8F5E9",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#388E3C",
  },
  guidanceText: { fontSize: 13, color: "#2E7D32", flex: 1, lineHeight: 19 },
  seedlingList: { gap: 8 },
  pendingItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  pendingSpecies: { fontSize: 14, fontWeight: "600", color: "#111827" },
  pendingMeta: { fontSize: 11, color: "#9CA3AF", marginTop: 2 },
  emptyState: { alignItems: "center", paddingVertical: 56 },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#E8F5E9",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 6,
  },
  emptyMsg: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    maxWidth: 240,
    lineHeight: 20,
  },
  reportCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  reportCardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
    gap: 8,
  },
  reportCardTitle: { fontSize: 15, fontWeight: "700", color: "#111827" },
  reportCardDate: { fontSize: 11, color: "#9CA3AF", marginTop: 2 },
  reportMini: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "#F4F7F5",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginBottom: 10,
  },
  reportMiniItem: { alignItems: "center" },
  reportMiniVal: { fontSize: 16, fontWeight: "800" },
  reportMiniLabel: { fontSize: 10, color: "#9CA3AF", marginTop: 2 },
  reportCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    paddingTop: 10,
  },
  reportCardCta: { fontSize: 12, fontWeight: "700", color: "#0F4A2F" },
  fab: {
    position: "absolute",
    bottom: 28,
    right: 20,
    backgroundColor: "#0F4A2F",
    borderRadius: 28,
    paddingVertical: 14,
    paddingHorizontal: 22,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    shadowColor: "#0F4A2F",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  fabText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  mapModalBar: {
    position: "absolute",
    top: Platform.OS === "ios" ? 52 : 16,
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
  reapplyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    backgroundColor: "#F4F7F5",
  },
  reapplyIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#E8F5E9",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
    shadowColor: "#0F4A2F",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  reapplyTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
    marginBottom: 12,
  },
  reapplyMessage: {
    fontSize: 15,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
    maxWidth: 300,
  },
  reapplyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0F4A2F",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    gap: 10,
    shadowColor: "#0F4A2F",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    width: "100%",
    maxWidth: 320,
  },
  reapplyButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  reasonBox: {
    flexDirection: "row",
    gap: 6,
    alignItems: "flex-start",
    backgroundColor: "#E8F5E9",
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  reasonText: {
    fontSize: 11,
    color: "#2E7D32",
    flex: 1,
    lineHeight: 16,
    fontStyle: "italic",
  },
  markerContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  markerDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#0F4A2F",
    borderWidth: 3,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
});

const badge = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 5,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});

const seedlingItem = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  left: { flexDirection: "row", alignItems: "center", gap: 8 },
  species: { fontSize: 14, fontWeight: "600", color: "#111827" },
  right: { alignItems: "flex-end" },
  quantity: { fontSize: 14, fontWeight: "700", color: "#0F4A2F" },
  provider: { fontSize: 11, color: "#6B7280", maxWidth: 120 },
});

const sheet = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  panel: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingBottom: 32,
    maxHeight: screenHeight * 0.86,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: "#E5E7EB",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
    gap: 8,
  },
  title: { fontSize: 18, fontWeight: "800", color: "#111827", flex: 1 },
  date: { fontSize: 12, color: "#9CA3AF", marginBottom: 14 },
  metricsBox: {
    backgroundColor: "#F4F7F5",
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  metricRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: "#E9F0EC",
  },
  metricLabel: { fontSize: 13, color: "#6B7280" },
  metricVal: { fontSize: 13, fontWeight: "700", color: "#0F4A2F" },
  proofImage: {
    width: "100%",
    height: 160,
    borderRadius: 14,
    marginBottom: 16,
  },
  closeBtn: {
    backgroundColor: "#F4F7F5",
    borderRadius: 14,
    padding: 15,
    alignItems: "center",
  },
  closeTxt: { color: "#0F4A2F", fontWeight: "700", fontSize: 14 },
});

const form_ = StyleSheet.create({
  label: { fontSize: 12, fontWeight: "600", color: "#374151", marginBottom: 6 },
  input: {
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#111827",
    backgroundColor: "#FAFAFA",
    marginBottom: 12,
  },
  textarea: { height: 96, paddingTop: 12 },
  actions: { flexDirection: "row", gap: 12, marginTop: 10 },
  cancelBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  cancelTxt: { color: "#6B7280", fontWeight: "600", fontSize: 14 },
  submitBtn: {
    flex: 2,
    backgroundColor: "#0F4A2F",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    shadowColor: "#0F4A2F",
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  submitDisabled: { opacity: 0.6 },
  submitTxt: { color: "#fff", fontWeight: "800", fontSize: 14 },
});
export default ApplicationPage;