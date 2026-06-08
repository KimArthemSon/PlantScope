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
import * as DocumentPicker from "expo-document-picker";
import MapView, { Marker, Polygon } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/constants/url_fixed";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

// ─── Types ───────────────────────────────────────────────────────────────
interface SeedlingProvision {
  quantity: number;
  provided_by: string;
}
interface ApplicationData {
  application_id: number;
  title: string;
  description: string;
  classification: "new" | "old";
  status: string;
  total_members: number;
  project_duration: number | null;
  orientation_date: string | null;
  confirmed_at: string | null;
  maintenance_plan: string | null;
  agreement_image: string | null;
  created_at: string;
  updated_at: string;
}
interface OrganizationData {
  organization_name: string;
  org_email: string;
  org_contact: string;
  org_address: string;
  org_profile: string | null;
}
interface ProfileData {
  first_name: string;
  last_name: string;
  contact: string;
  gender: string;
  profile_img: string;
}
interface AssignedSite {
  site_id: number;
  name: string;
  barangay: string | null;
  polygon_coordinates: [number, number][] | string | null;
}
interface SeedlingRequest {
  request_id: number;
  no_request_seedling: number;
  seedling_type: Record<string, number | SeedlingProvision>;
  status: "pending" | "accepted" | "rejected";
  reason_accepted: string | null;
  submitted_at: string | null;
}
interface ProgressReport {
  report_id: number;
  no_survived_plants: number;
  no_dead_plants: number;
  description: string | null;
  status: "pending" | "accepted" | "rejected";
  proof_image: string | null;
  submitted_at: string | null;
}
interface ApplicationDetail {
  application: ApplicationData | null;
  organization: OrganizationData | null;
  profile: ProfileData | null;
  assigned_site: AssignedSite | null;
  seedling_requests: SeedlingRequest[];
  progress_reports: ProgressReport[];
  latest_reason: { reason: string; status: string; created: string } | null;
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
  pending: {
    label: "Pending Review",
    bg: "#FFF8E1",
    text: "#F57F17",
    dot: "#F9A825",
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

const parseSeedlingType = (
  seedlingType: Record<string, number | SeedlingProvision>,
) => {
  return Object.entries(seedlingType).map(([species, data]) => {
    if (typeof data === "object" && data !== null && "quantity" in data) {
      return {
        species,
        quantity: (data as SeedlingProvision).quantity,
        provided_by: (data as SeedlingProvision).provided_by,
      };
    }
    return { species, quantity: data as number, provided_by: "Unknown" };
  });
};

const getTotalSeedlings = (
  seedlingType: Record<string, number | SeedlingProvision>,
) => {
  return Object.values(seedlingType).reduce((sum, val) => {
    const qty =
      typeof val === "object" && val !== null && "quantity" in val
        ? (val as SeedlingProvision).quantity
        : (val as number);
    return sum + (typeof qty === "number" ? qty : 0);
  }, 0);
};

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

const MetricCard = ({
  label,
  value,
  unit,
  iconName,
  accent,
}: {
  label: string;
  value: string | number;
  unit?: string;
  iconName: string;
  accent: string;
}) => (
  <View style={[metric.card, { borderTopColor: accent }]}>
    <View style={[metric.iconWrap, { backgroundColor: accent + "18" }]}>
      <Ionicons name={iconName as any} size={18} color={accent} />
    </View>
    <Text style={[metric.value, { color: accent }]}>
      {typeof value === "number" ? value.toLocaleString() : value}
      {unit ? <Text style={metric.unit}> {unit}</Text> : null}
    </Text>
    <Text style={metric.label}>{label}</Text>
  </View>
);

const SeedlingItem = ({
  species,
  quantity,
  provider,
}: {
  species: string;
  quantity: number;
  provider: string;
}) => (
  <View style={seedlingItem.wrap}>
    <View style={seedlingItem.left}>
      <Ionicons name="leaf-outline" size={16} color="#0F4A2F" />
      <Text style={seedlingItem.species}>{species}</Text>
    </View>
    <View style={seedlingItem.right}>
      <Text style={seedlingItem.quantity}>{quantity.toLocaleString()}</Text>
      <Text style={seedlingItem.provider} numberOfLines={1}>
        {provider}
      </Text>
    </View>
  </View>
);

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

  const [seedlingForm, setSeedlingForm] = useState<{
    quantity: string;
    description: string;
    request_file: { uri: string; name: string; type: string } | null;
  }>({
    quantity: "",
    description: "",
    request_file: null,
  });
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

  const handleRequestSeedling = async () => {
    if (!detail?.application) return;
    if (!seedlingForm.quantity.trim()) {
      Alert.alert(
        "Missing Field",
        "Please enter the number of seedlings requested.",
      );
      return;
    }

    setSubmitting(true);
    try {
      const token = await SecureStore.getItemAsync("token");
      const fd = new FormData();

      fd.append("application_id", String(detail.application.application_id));
      fd.append("no_request_seedling", seedlingForm.quantity);

      const seedlingType = {
        TBD: {
          quantity: parseInt(seedlingForm.quantity),
          provided_by: "TBD",
        },
      };
      fd.append("seedling_type", JSON.stringify(seedlingType));
      fd.append("description", seedlingForm.description.trim());

      if (seedlingForm.request_file) {
        fd.append("request_file", seedlingForm.request_file as any);
      }

      const res = await fetch(`${api}/api/create_seedling_request/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const responseData = await res.json();

      if (!res.ok) throw new Error(responseData.error ?? "Request failed.");

      Alert.alert(
        "✓ Request Submitted",
        "Your seedling request is pending review. The Data Manager will assign species and provider during evaluation.",
      );
      setRequestSeedlingModal(false);
      setSeedlingForm({ quantity: "", description: "", request_file: null });
      fetchData(true);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const pickSeedlingFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ],
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setSeedlingForm((p) => ({
        ...p,
        request_file: {
          uri: asset.uri,
          name: asset.name,
          type: asset.mimeType ?? "application/octet-stream",
        },
      }));
    }
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

  // ✅ FIXED: Changed from .find() to .filter() to get ALL accepted requests
  const acceptedSeedlingRequests = detail?.seedling_requests?.filter(
    (r) => r.status === "accepted",
  ) || [];
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

  // ✅ NEW: Check if user needs to re-apply (No application OR terminal state)
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

          {detail?.application && (
            <TouchableOpacity
              style={styles.viewPastButton}
              onPress={() =>
                Alert.alert(
                  "History",
                  "Past application details would go here.",
                )
              }
            >
              <Text style={styles.viewPastText}>
                View Past Application History
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  // ✅ EXISTING: Render Normal Dashboard (If application is active)
  const { application, organization, profile, assigned_site } =
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
              <Text style={styles.bannerSub}>Tree Planting Program</Text>
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
                  {/* ✅ FIXED: Sum all accepted requests */}
                  {acceptedSeedlingRequests.length > 0
                    ? acceptedSeedlingRequests
                        .reduce((sum, req) => sum + getTotalSeedlings(req.seedling_type), 0)
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
                <Ionicons
                  name="document-text-outline"
                  size={16}
                  color="#0F4A2F"
                />
                <Text style={styles.cardTitle}>About This Program</Text>
              </View>
              <Text style={styles.cardBody}>
                {application.description || "No description provided."}
              </Text>
            </View>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="calendar-outline" size={16} color="#0F4A2F" />
                <Text style={styles.cardTitle}>Key Dates</Text>
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
                  <Text style={styles.dateLabel}>Status</Text>
                  <Text
                    style={[styles.dateValue, { color: appStatusConf.text }]}
                  >
                    {appStatusConf.label}
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
                {[
                  { label: "Site Name", value: assigned_site.name },
                  { label: "Barangay", value: assigned_site.barangay ?? "—" },
                ].map((row, i) => (
                  <View key={i} style={styles.siteRow}>
                    <Text style={styles.siteLabel}>{row.label}</Text>
                    <Text style={styles.siteValue}>{row.value}</Text>
                  </View>
                ))}
                <TouchableOpacity
                  style={styles.mapPreviewWrap}
                  onPress={() => setShowMap(true)}
                >
                  <MapView
                    style={StyleSheet.absoluteFill}
                    initialRegion={getMapRegion()}
                    scrollEnabled={false}
                    zoomEnabled={false}
                    pointerEvents="none"
                  >
                    {polygonCoords.length > 0 && (
                      <Polygon
                        coordinates={polygonCoords}
                        strokeColor="#0F4A2F"
                        fillColor="rgba(15,74,47,0.3)"
                        strokeWidth={2}
                      />
                    )}
                    {centroid && (
                      <Marker
                        coordinate={centroid}
                        title={assigned_site.name}
                      />
                    )}
                  </MapView>
                  <View style={styles.mapTapOverlay}>
                    <Ionicons name="expand-outline" size={16} color="#fff" />
                    <Text style={styles.mapTapText}>Tap to expand</Text>
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
                  onPress={() => setRequestSeedlingModal(true)}
                >
                  <View
                    style={[styles.actionIcon, { backgroundColor: "#E3F2FD" }]}
                  >
                    <Ionicons name="leaf-outline" size={24} color="#1565C0" />
                  </View>
                  <Text style={styles.actionLabel}>
                    Request Additional Seedlings
                  </Text>
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
                  "✓ Application approved! You may now request additional seedlings if needed."}
                {application.status === "under_monitoring" &&
                  "✓ Program active. Onsite inspectors will monitor progress. You can request more seedlings."}
                {application.status === "completed" &&
                  "✓ Program completed. You can still request seedlings for maintenance."}
                {application.status === "rejected" &&
                  "✗ Application rejected. Please contact the Data Manager for feedback."}
              </Text>
            </View>
          </>
        )}

        {/* Seedlings Tab */}
        {activeTab === "seedlings" && (
          <>
            {/* ✅ FIXED: Map over ALL accepted requests */}
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
                  Total:{" "}
                  {getTotalSeedlings(req.seedling_type).toLocaleString()}{" "}
                  seedlings • {formatDate(req.submitted_at || "")}
                </Text>
                <View style={styles.seedlingList}>
                  {parseSeedlingType(req.seedling_type).map(
                    (item, i) => (
                      <SeedlingItem
                        key={i}
                        species={item.species}
                        quantity={item.quantity}
                        provider={item.provided_by}
                      />
                    ),
                  )}
                </View>
                {req.reason_accepted && (
                  <View style={styles.reasonBox}>
                    <Ionicons name="chatbubble-outline" size={12} color="#2E7D32" />
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
                {pendingSeedlingRequests.map((req) => {
                  const parsed = parseSeedlingType(req.seedling_type);
                  return (
                    <View key={req.request_id} style={styles.pendingItem}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.pendingSpecies}>
                          {parsed.map((p) => p.species).join(", ")}
                        </Text>
                        <Text style={styles.pendingMeta}>
                          {getTotalSeedlings(req.seedling_type)} seedlings •{" "}
                          {formatDate(req.submitted_at || "")}
                        </Text>
                        {req.description ? (
                          <Text style={styles.pendingDesc} numberOfLines={1}>
                            {req.description}
                          </Text>
                        ) : null}
                      </View>
                      <StatusBadge status={req.status} />
                    </View>
                  );
                })}
              </View>
            )}
            {/* ✅ FIXED: Check array length instead of single object */}
            {acceptedSeedlingRequests.length === 0 &&
              pendingSeedlingRequests.length === 0 && (
                <View style={styles.emptyState}>
                  <View style={styles.emptyIconWrap}>
                    <Ionicons name="leaf-outline" size={36} color="#0F4A2F" />
                  </View>
                  <Text style={styles.emptyTitle}>No Seedlings Yet</Text>
                  <Text style={styles.emptyMsg}>
                    {application.status === "accepted" ||
                    application.status === "under_monitoring" ||
                    application.status === "completed"
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
                onPress={() => setRequestSeedlingModal(true)}
              >
                <Ionicons name="add" size={22} color="#fff" />
                <Text style={styles.fabText}>Request Seedlings</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {/* Reports Tab (View Only) */}
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
                  monitoring. They will appear here once available.
                </Text>
              </View>
            ) : (
              <FlatList
                data={allProgressReports}
                keyExtractor={(item) => item.report_id.toString()}
                renderItem={({ item }) => (
                  <TouchableOpacity
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
                    {item.description && (
                      <Text style={styles.reportCardDesc} numberOfLines={2}>
                        {item.description}
                      </Text>
                    )}
                    <View style={styles.reportMini}>
                      {[
                        {
                          label: "Survived",
                          value: item.no_survived_plants,
                          color: "#2E7D32",
                        },
                        {
                          label: "Dead",
                          value: item.no_dead_plants,
                          color: "#C62828",
                        },
                      ].map((m, i) => (
                        <View key={i} style={styles.reportMiniItem}>
                          <Text
                            style={[styles.reportMiniVal, { color: m.color }]}
                          >
                            {m.value.toLocaleString()}
                          </Text>
                          <Text style={styles.reportMiniLabel}>{m.label}</Text>
                        </View>
                      ))}
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
                )}
              />
            )}
            <View style={styles.reportsNote}>
              <Ionicons
                name="information-circle-outline"
                size={14}
                color="#6B7280"
              />
              <Text style={styles.reportsNoteText}>
                Progress reports are submitted by onsite inspectors. You can
                view them here but cannot create or edit reports.
              </Text>
            </View>
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
          <MapView
            style={StyleSheet.absoluteFill}
            initialRegion={getMapRegion()}
          >
            {polygonCoords.length > 0 && (
              <Polygon
                coordinates={polygonCoords}
                strokeColor="#0F4A2F"
                fillColor="rgba(15,74,47,0.3)"
                strokeWidth={3}
              />
            )}
            {centroid && (
              <Marker
                coordinate={centroid}
                title={assigned_site?.name ?? "Site"}
              />
            )}
          </MapView>
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
                {reportDetailModal.description && (
                  <Text style={sheet.desc}>
                    {reportDetailModal.description}
                  </Text>
                )}
                <View style={sheet.metricsBox}>
                  {[
                    {
                      label: "Survived Plants",
                      value:
                        reportDetailModal.no_survived_plants.toLocaleString(),
                    },
                    {
                      label: "Dead Plants",
                      value: reportDetailModal.no_dead_plants.toLocaleString(),
                    },
                  ].map((m, i) => (
                    <View key={i} style={sheet.metricRow}>
                      <Text style={sheet.metricLabel}>{m.label}</Text>
                      <Text style={sheet.metricVal}>{m.value}</Text>
                    </View>
                  ))}
                </View>
                {reportDetailModal.proof_image && (
                  <Image
                    source={{ uri: `${api}${reportDetailModal.proof_image}` }}
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

      {/* Seedling Request Modal */}
      <Modal
        visible={requestSeedlingModal}
        animationType="slide"
        transparent
        onRequestClose={() => setRequestSeedlingModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={sheet.overlay}
        >
          <View style={[sheet.panel, { maxHeight: screenHeight * 0.85 }]}>
            <View style={sheet.handle} />
            <View style={sheet.headerRow}>
              <Text style={sheet.title}>Request Additional Seedlings</Text>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={form_.label}>Number of Seedlings *</Text>
              <TextInput
                style={form_.input}
                placeholder="e.g. 50"
                keyboardType="numeric"
                value={seedlingForm.quantity}
                onChangeText={(t) =>
                  setSeedlingForm((p) => ({ ...p, quantity: t }))
                }
                placeholderTextColor="#B0BAC4"
              />

              <Text style={form_.label}>Description</Text>
              <TextInput
                style={[form_.input, form_.textarea]}
                placeholder="Reason for request (optional)…"
                value={seedlingForm.description}
                onChangeText={(t) =>
                  setSeedlingForm((p) => ({ ...p, description: t }))
                }
                multiline
                numberOfLines={3}
                placeholderTextColor="#B0BAC4"
                textAlignVertical="top"
              />

              <TouchableOpacity
                style={form_.uploadBtn}
                onPress={pickSeedlingFile}
              >
                <View
                  style={[form_.uploadIconWrap, { backgroundColor: "#E3F2FD" }]}
                >
                  <Ionicons
                    name="document-attach-outline"
                    size={20}
                    color="#1565C0"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={form_.uploadTitle}>Supporting Document</Text>
                  <Text style={form_.uploadSub} numberOfLines={1}>
                    {seedlingForm.request_file
                      ? seedlingForm.request_file.name
                      : "Optional: PDF or Word"}
                  </Text>
                </View>
                <Ionicons
                  name={
                    seedlingForm.request_file
                      ? "checkmark-circle"
                      : "chevron-forward"
                  }
                  size={20}
                  color={seedlingForm.request_file ? "#2E7D32" : "#9CA3AF"}
                />
              </TouchableOpacity>

              <View style={form_.infoBox}>
                <Ionicons
                  name="information-circle-outline"
                  size={14}
                  color="#0F4A2F"
                />
                <Text style={form_.infoText}>
                  The Data Manager will assign the tree species and provider
                  during evaluation. You only need to specify the quantity
                  needed.
                </Text>
              </View>

              <View style={form_.actions}>
                <TouchableOpacity
                  style={form_.cancelBtn}
                  onPress={() => setRequestSeedlingModal(false)}
                >
                  <Text style={form_.cancelTxt}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[form_.submitBtn, submitting && form_.submitDisabled]}
                  onPress={handleRequestSeedling}
                  disabled={submitting}
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
  cardBody: { fontSize: 14, color: "#4B5563", lineHeight: 21 },
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
  siteRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  siteLabel: { fontSize: 12, color: "#9CA3AF" },
  siteValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111827",
    flexShrink: 1,
    textAlign: "right",
    marginLeft: 12,
  },
  mapPreviewWrap: {
    height: 190,
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 14,
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
  pendingDesc: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 4,
    fontStyle: "italic",
  },
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
  reportCardDesc: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 18,
    marginBottom: 12,
  },
  reportMini: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#F4F7F5",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginBottom: 10,
  },
  reportMiniItem: { alignItems: "center", flex: 1 },
  reportMiniVal: { fontSize: 14, fontWeight: "800" },
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
  reportsNote: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  reportsNoteText: { fontSize: 12, color: "#6B7280", flex: 1, lineHeight: 17 },
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

  // ✅ RE-APPLY STYLES
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
  reapplyButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  viewPastButton: {
    marginTop: 20,
    paddingVertical: 10,
  },
  viewPastText: {
    color: "#0F4A2F",
    fontSize: 14,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  // ✅ NEW: Reason box styles
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
const metric = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: (screenWidth - 52) / 2,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    borderTopWidth: 3,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  value: { fontSize: 22, fontWeight: "800" },
  unit: { fontSize: 12, fontWeight: "500", color: "#6B7280" },
  label: { fontSize: 11, color: "#9CA3AF", marginTop: 3, textAlign: "center" },
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
  desc: { fontSize: 14, color: "#4B5563", lineHeight: 21, marginBottom: 16 },
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
  infoBox: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#E8F5E9",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#388E3C",
  },
  infoText: { fontSize: 12, color: "#2E7D32", flex: 1, lineHeight: 17 },
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
  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FAFAFA",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  uploadIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  uploadTitle: { fontSize: 13, fontWeight: "600", color: "#111827" },
  uploadSub: { fontSize: 11, color: "#9CA3AF", marginTop: 2 },
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