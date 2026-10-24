import { useRouter } from "expo-router";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Dimensions,
  Pressable,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Platform,
  StatusBar,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { WebView } from "react-native-webview";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { api } from "@/constants/url_fixed";
import { useNetworkStatus } from "@/utils/networkStatus";
import { useAlert, ToastHost } from "@/components/AlertContext";
import { getToken, clearAuthData, isAuthFailure } from "@/utils/auth";

const screenHeight = Dimensions.get("window").height;
const API_BASE_URL = api + "/api";
const OFFLINE_AREAS_KEY = "@plantscope_offline_areas";

/* ──────────────────────────────────────────────────────────────────
   DESIGN TOKENS
   ─────────────────────────────────────────────────────────────── */
const BG = "#F5F6F8";
const PRIMARY = "#0F4A2F";
const PRIMARY_SOFT = "#E8F1EC";
const INK = "#111827";
const MUTED = "#6B7280";
const FAINT = "#9CA3AF";
const LINE = "#EEF0F3";
const GREEN = "#22C55E";
const AMBER = "#F59E0B";
const RED = "#EF4444";
const BLUE = "#3B82F6";

const cardShadow = {
  shadowColor: "#0F172A",
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.04,
  shadowRadius: 8,
  elevation: 1,
};

type SiteStats = {
  total: number;
  total_hectares: number;
  accepted: number;
  pending: number;
  rejected: number;
  under_monitoring: number;
};

type AssessmentStats = {
  total: number;
  submitted: number;
  drafts: number;
  last_assessment_at: string | null;
};

type ReforestationArea = {
  reforestation_area_id: string;
  assigned_onsite_inspector_id: string;
  name: string;
  description: string | null;
  coordinate: [number, number] | { latitude: number; longitude: number } | null;
  latitude: number;
  longitude: number;
  coord_display: string;
  assigned_at: string;
  barangay_name?: string | null;
  site_stats?: SiteStats;
  assessment_stats?: AssessmentStats;
};

type FilterKey = "all" | "saved" | "unassessed" | "drafts";

const EMPTY_SITES: SiteStats = {
  total: 0,
  total_hectares: 0,
  accepted: 0,
  pending: 0,
  rejected: 0,
  under_monitoring: 0,
};
const EMPTY_ASSESSMENTS: AssessmentStats = {
  total: 0,
  submitted: 0,
  drafts: 0,
  last_assessment_at: null,
};

/* ──────────────────────────────────────────────────────────────────
   HELPERS
   ─────────────────────────────────────────────────────────────── */
const formatHectares = (ha: number) =>
  ha >= 100 ? Math.round(ha).toLocaleString() : ha.toFixed(ha >= 10 ? 1 : 2);

const timeAgo = (iso: string | null | undefined) => {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  if (isNaN(diff)) return null;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatDate = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const parseCoordinate = (coordinate: any) => {
  const defaultLat = 11.0,
    defaultLng = 124.6;
  let lat = defaultLat,
    lng = defaultLng;
  let coordDisplay = "No Coordinates";

  try {
    if (Array.isArray(coordinate) && coordinate.length >= 2) {
      [lat, lng] = coordinate;
      coordDisplay = `${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E`;
    } else if (coordinate && typeof coordinate === "object") {
      lat = coordinate.latitude || defaultLat;
      lng = coordinate.longitude || defaultLng;
      coordDisplay = `${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E`;
    }
  } catch (e) {
    console.error("Error parsing coordinate:", e);
  }
  return { lat, lng, coordDisplay };
};

/* ──────────────────────────────────────────────────────────────────
   SMALL COMPONENTS
   ─────────────────────────────────────────────────────────────── */
const SummaryStat: React.FC<{ value: string; label: string }> = ({
  value,
  label,
}) => (
  <View style={styles.summaryStat}>
    <Text style={styles.summaryValue}>{value}</Text>
    <Text style={styles.summaryLabel}>{label}</Text>
  </View>
);

const MiniStat: React.FC<{
  icon: string;
  value: string;
  label: string;
}> = ({ icon, value, label }) => (
  <View style={styles.miniStat}>
    <MaterialCommunityIcons name={icon as any} size={15} color={PRIMARY} />
    <View style={{ flexShrink: 1 }}>
      <Text style={styles.miniValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.miniLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  </View>
);

/** Stacked bar showing accepted / pending / rejected sites. */
const SiteStatusBar: React.FC<{ stats: SiteStats }> = ({ stats }) => {
  const other = Math.max(
    stats.total - stats.accepted - stats.pending - stats.rejected,
    0,
  );
  const segments = [
    { key: "accepted", n: stats.accepted, color: GREEN, label: "Accepted" },
    { key: "pending", n: stats.pending, color: AMBER, label: "Pending" },
    { key: "rejected", n: stats.rejected, color: RED, label: "Rejected" },
    { key: "other", n: other, color: "#D1D5DB", label: "Other" },
  ].filter((s) => s.n > 0);

  return (
    <View style={{ marginTop: 14 }}>
      <View style={styles.stackBar}>
        {segments.map((s) => (
          <View
            key={s.key}
            style={{ flex: s.n, backgroundColor: s.color, height: "100%" }}
          />
        ))}
      </View>
      <View style={styles.legendRow}>
        {segments.map((s) => (
          <View key={s.key} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: s.color }]} />
            <Text style={styles.legendText}>
              {s.n} {s.label}
            </Text>
          </View>
        ))}
        {stats.under_monitoring > 0 && (
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: BLUE }]} />
            <Text style={styles.legendText}>
              {stats.under_monitoring} Monitoring
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

/* ──────────────────────────────────────────────────────────────────
   SCREEN
   ─────────────────────────────────────────────────────────────── */
const ReforestationAreas: React.FC = () => {
  const insets = useSafeAreaInsets();
  const {
    success,
    error: showError,
    warning,
    info: showInfo,
    confirm,
  } = useAlert();

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedArea, setSelectedArea] = useState<ReforestationArea | null>(
    null,
  );
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [actionSheetArea, setActionSheetArea] =
    useState<ReforestationArea | null>(null);
  const [searchText, setSearchText] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [areas, setAreas] = useState<ReforestationArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const [offlineAreaIds, setOfflineAreaIds] = useState<Set<string>>(new Set());
  const [savingOffline, setSavingOffline] = useState<string | null>(null);

  const router = useRouter();
  const isOnline = useNetworkStatus();

  /* ── Offline storage ─────────────────────────────────────────── */
  const readSavedAreas = async (): Promise<ReforestationArea[]> => {
    const saved = await AsyncStorage.getItem(OFFLINE_AREAS_KEY);
    return saved ? JSON.parse(saved) : [];
  };

  const writeSavedAreas = async (list: ReforestationArea[]) => {
    await AsyncStorage.setItem(OFFLINE_AREAS_KEY, JSON.stringify(list));
    setOfflineAreaIds(new Set(list.map((a) => a.reforestation_area_id)));
  };

  const loadOfflineAreaIds = async () => {
    try {
      const savedAreas = await readSavedAreas();
      setOfflineAreaIds(
        new Set(savedAreas.map((a) => a.reforestation_area_id)),
      );
      return savedAreas;
    } catch (error) {
      console.error("Error loading offline areas:", error);
      return [];
    }
  };

  const saveAreaForOffline = async (area: ReforestationArea) => {
    setSavingOffline(area.reforestation_area_id);
    try {
      const savedAreas = await readSavedAreas();
      if (
        savedAreas.some(
          (a) => a.reforestation_area_id === area.reforestation_area_id,
        )
      ) {
        showInfo("Info", `${area.name} is already saved for offline use.`);
        return;
      }
      await writeSavedAreas([...savedAreas, area]);
      success("Saved", `${area.name} is now available offline.`);
    } catch (error) {
      showError("Error", "Failed to save area for offline use.");
    } finally {
      setSavingOffline(null);
    }
  };

  const removeAreaFromOffline = (area: ReforestationArea) => {
    confirm(
      "Remove from Offline",
      `Remove "${area.name}" from offline storage?`,
      async () => {
        setSavingOffline(area.reforestation_area_id);
        try {
          const savedAreas = await readSavedAreas();
          await writeSavedAreas(
            savedAreas.filter(
              (a) => a.reforestation_area_id !== area.reforestation_area_id,
            ),
          );
          success("Removed", `${area.name} removed from offline storage.`);
        } catch (error) {
          showError("Error", "Failed to remove area from offline storage.");
        } finally {
          setSavingOffline(null);
        }
      },
      { type: "error", confirmText: "Remove", cancelText: "Cancel" },
    );
  };

  /* ── Data loading ────────────────────────────────────────────── */
  const loadOfflineAreas = async () => {
    try {
      const savedAreas = (await readSavedAreas()).filter(
        (area) => area && area.reforestation_area_id && area.name,
      );
      setAreas(savedAreas);
      setError(
        savedAreas.length
          ? null
          : "No areas saved for offline use. Connect to the internet and save areas first.",
      );
    } catch (err: any) {
      console.error("Error loading offline areas:", err);
      setError("Failed to load offline areas.");
      setAreas([]);
    }
  };

  const fetchAssignedAreas = useCallback(
    async (showRefreshIndicator = false) => {
      if (showRefreshIndicator) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const savedAreas = await loadOfflineAreaIds();

        if (!isOnline) {
          await loadOfflineAreas();
          return;
        }

        const token = await getToken();
        if (!token) {
          await clearAuthData();
          router.replace("/homepage");
          return;
        }

        const response = await fetch(
          `${API_BASE_URL}/get_assigned_reforestation_area/`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            cache: "no-store",
          },
        );

        if (isAuthFailure(response.status)) {
          await clearAuthData();
          router.replace("/homepage");
          return;
        }
        if (!response.ok)
          throw new Error(`Couldn't load areas (error ${response.status}).`);
        const data = await response.json();

        const mappedAreas: ReforestationArea[] = data.map((item: any) => {
          const { lat, lng, coordDisplay } = parseCoordinate(item.coordinate);
          return {
            reforestation_area_id: item.reforestation_area_id?.toString() || "",
            assigned_onsite_inspector_id:
              item.assigned_onsite_inspector_id?.toString() || "",
            name: item.name || "Unnamed Area",
            description: item.description || null,
            coordinate: item.coordinate || null,
            latitude: lat,
            longitude: lng,
            coord_display: coordDisplay,
            assigned_at: item.assigned_at || "",
            barangay_name: item.barangay_name ?? null,
            site_stats: { ...EMPTY_SITES, ...(item.site_stats || {}) },
            assessment_stats: {
              ...EMPTY_ASSESSMENTS,
              ...(item.assessment_stats || {}),
            },
          };
        });

        setAreas(mappedAreas);
        setLastRefreshed(new Date());

        // Keep offline copies up to date with the latest stats
        if (savedAreas.length) {
          const fresh = new Map(
            mappedAreas.map((a) => [a.reforestation_area_id, a]),
          );
          const updated = savedAreas.map(
            (a) => fresh.get(a.reforestation_area_id) || a,
          );
          await writeSavedAreas(updated);
        }
      } catch (err: any) {
        setError(err.message || "Something went wrong.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [isOnline, router],
  );

  useEffect(() => {
    fetchAssignedAreas();
  }, [fetchAssignedAreas]);

  const onRefresh = useCallback(
    () => fetchAssignedAreas(true),
    [fetchAssignedAreas],
  );

  /* ── Modals / navigation ─────────────────────────────────────── */
  const openModal = (area: ReforestationArea) => {
    if (!isOnline) {
      warning("Offline Mode", "Map is not available offline.");
      return;
    }
    setSelectedArea(area);
    setModalVisible(true);
  };

  const closeModal = () => {
    setSelectedArea(null);
    setModalVisible(false);
  };

  const openActionSheet = (area: ReforestationArea) => {
    closeModal();
    setActionSheetArea(area);
    setActionSheetVisible(true);
  };

  const handleGeneralAssessment = () => {
    if (actionSheetArea) {
      router.push({
        pathname: "/feedbacks/site_field_assessment",
        params: {
          areaId: actionSheetArea.reforestation_area_id,
          areaName: actionSheetArea.name,
          assessmentType: "general",
        },
      });
    }
    setActionSheetVisible(false);
  };

  const handleSpecificAssessment = () => {
    if (actionSheetArea) {
      router.push({
        pathname: "/feedbacks/select_site",
        params: {
          areaId: actionSheetArea.reforestation_area_id,
          areaName: actionSheetArea.name,
          assessmentType: "specific",
        },
      });
    }
    setActionSheetVisible(false);
  };

  /* ── Derived data ────────────────────────────────────────────── */
  const totals = useMemo(() => {
    return areas.reduce(
      (acc, a) => {
        const s = a.site_stats || EMPTY_SITES;
        const f = a.assessment_stats || EMPTY_ASSESSMENTS;
        acc.sites += s.total;
        acc.hectares += s.total_hectares;
        acc.submitted += f.submitted;
        acc.drafts += f.drafts;
        if (f.total > 0) acc.assessedAreas += 1;
        return acc;
      },
      { sites: 0, hectares: 0, submitted: 0, drafts: 0, assessedAreas: 0 },
    );
  }, [areas]);

  const savedCount = areas.filter((a) =>
    offlineAreaIds.has(a.reforestation_area_id),
  ).length;
  const offlinePct =
    areas.length > 0 ? Math.round((savedCount / areas.length) * 100) : 0;

  const filterCounts: Record<FilterKey, number> = {
    all: areas.length,
    saved: savedCount,
    unassessed: areas.filter((a) => !a.assessment_stats?.total).length,
    drafts: areas.filter((a) => (a.assessment_stats?.drafts || 0) > 0).length,
  };

  const filteredAreas = areas.filter((area) => {
    const q = searchText.trim().toLowerCase();
    const matchesSearch =
      !q ||
      (area.name || "").toLowerCase().includes(q) ||
      (area.barangay_name || "").toLowerCase().includes(q);
    if (!matchesSearch) return false;
    switch (filter) {
      case "saved":
        return offlineAreaIds.has(area.reforestation_area_id);
      case "unassessed":
        return !area.assessment_stats?.total;
      case "drafts":
        return (area.assessment_stats?.drafts || 0) > 0;
      default:
        return true;
    }
  });

  const FILTERS: { key: FilterKey; label: string }[] = [
    { key: "all", label: "All" },
    { key: "saved", label: "Saved offline" },
    { key: "unassessed", label: "Not assessed" },
    { key: "drafts", label: "Has drafts" },
  ];

  /* ── Render ──────────────────────────────────────────────────── */
  const renderAreaCard = (area: ReforestationArea) => {
    const isSaved = offlineAreaIds.has(area.reforestation_area_id);
    const isSaving = savingOffline === area.reforestation_area_id;
    const s = area.site_stats || EMPTY_SITES;
    const f = area.assessment_stats || EMPTY_ASSESSMENTS;
    const lastAssessed = timeAgo(f.last_assessment_at);

    return (
      <View key={area.reforestation_area_id} style={styles.card}>
        {/* Title row */}
        <View style={styles.cardTop}>
          <View style={styles.cardIcon}>
            <MaterialCommunityIcons name="pine-tree" size={20} color={PRIMARY} />
          </View>
          <View style={styles.cardTitleWrap}>
            <Text style={styles.cardName} numberOfLines={1}>
              {area.name}
            </Text>
            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={12} color={FAINT} />
              <Text style={styles.metaText} numberOfLines={1}>
                {area.barangay_name
                  ? `Brgy. ${area.barangay_name}`
                  : area.coord_display}
              </Text>
            </View>
          </View>
          {isSaved && (
            <View style={styles.savedBadge}>
              <Ionicons name="cloud-done" size={12} color={PRIMARY} />
              <Text style={styles.savedBadgeText}>Offline</Text>
            </View>
          )}
        </View>

        {!!area.description && (
          <Text style={styles.cardDesc} numberOfLines={2}>
            {area.description}
          </Text>
        )}

        {/* Key numbers */}
        <View style={styles.miniRow}>
          <MiniStat
            icon="map-marker-multiple-outline"
            value={String(s.total)}
            label={s.total === 1 ? "Site" : "Sites"}
          />
          <View style={styles.miniDivider} />
          <MiniStat
            icon="texture-box"
            value={`${formatHectares(s.total_hectares)} ha`}
            label="Total area"
          />
          <View style={styles.miniDivider} />
          <MiniStat
            icon="clipboard-check-outline"
            value={`${f.submitted}/${f.total}`}
            label="Submitted"
          />
        </View>

        {s.total > 0 && <SiteStatusBar stats={s} />}

        {/* Activity */}
        <View style={styles.activityRow}>
          <View style={styles.activityItem}>
            <Ionicons name="time-outline" size={13} color={FAINT} />
            <Text style={styles.activityText}>
              {lastAssessed ? `Last assessed ${lastAssessed}` : "Not assessed yet"}
            </Text>
          </View>
          {f.drafts > 0 && (
            <View style={styles.draftPill}>
              <Text style={styles.draftPillText}>
                {f.drafts} draft{f.drafts > 1 ? "s" : ""}
              </Text>
            </View>
          )}
        </View>

        {/* Actions */}
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.iconAction, !isOnline && styles.iconActionDisabled]}
            onPress={() => openModal(area)}
            activeOpacity={0.7}
            disabled={!isOnline}
          >
            <Ionicons
              name="map-outline"
              size={18}
              color={!isOnline ? FAINT : PRIMARY}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.iconAction, isSaved && styles.iconActionDanger]}
            onPress={() =>
              isSaved ? removeAreaFromOffline(area) : saveAreaForOffline(area)
            }
            disabled={isSaving}
            activeOpacity={0.7}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={PRIMARY} />
            ) : (
              <Ionicons
                name={isSaved ? "trash-outline" : "cloud-download-outline"}
                size={18}
                color={isSaved ? RED : PRIMARY}
              />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.primaryAction}
            onPress={() => openActionSheet(area)}
            activeOpacity={0.85}
          >
            <Ionicons name="clipboard-outline" size={16} color="#FFFFFF" />
            <Text style={styles.primaryActionText}>Start Assessment</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={BG}
        translucent={false}
      />

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[PRIMARY]}
            tintColor={PRIMARY}
            enabled={isOnline}
          />
        }
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
          <View style={styles.topRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>Field Inspections</Text>
              <Text style={styles.title}>Assigned Areas</Text>
            </View>
            {lastRefreshed && isOnline && (
              <View style={styles.updatedPill}>
                <View style={styles.liveDot} />
                <Text style={styles.updatedText}>
                  {lastRefreshed.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </View>
            )}
          </View>

          {!isOnline && (
            <View style={styles.offlineBanner}>
              <Ionicons name="cloud-offline-outline" size={16} color="#92400E" />
              <View style={{ flex: 1 }}>
                <Text style={styles.offlineTitle}>You're offline</Text>
                <Text style={styles.offlineText}>
                  Showing saved areas only. Numbers are from when you last
                  synced.
                </Text>
              </View>
            </View>
          )}

          <View style={styles.searchContainer}>
            <View style={styles.searchBar}>
              <Ionicons name="search-outline" size={18} color={FAINT} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search area or barangay…"
                placeholderTextColor={FAINT}
                value={searchText}
                onChangeText={setSearchText}
              />
              {searchText.length > 0 && (
                <TouchableOpacity onPress={() => setSearchText("")}>
                  <Ionicons name="close-circle" size={18} color={FAINT} />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              style={[styles.mapButton, !isOnline && { opacity: 0.4 }]}
              onPress={() => router.push("/(tabs)/map")}
              activeOpacity={0.8}
              disabled={!isOnline}
            >
              <Ionicons name="map" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Summary */}
        {areas.length > 0 && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryEyebrow}>YOUR COVERAGE</Text>
            <View style={styles.summaryRow}>
              <SummaryStat value={String(areas.length)} label="Areas" />
              <View style={styles.summaryDivider} />
              <SummaryStat value={String(totals.sites)} label="Sites" />
              <View style={styles.summaryDivider} />
              <SummaryStat
                value={formatHectares(totals.hectares)}
                label="Hectares"
              />
            </View>

            <View style={styles.summaryChips}>
              <View style={styles.summaryChip}>
                <Ionicons name="checkmark-circle" size={13} color="#5FD08A" />
                <Text style={styles.summaryChipText}>
                  {totals.submitted} submitted
                </Text>
              </View>
              <View style={styles.summaryChip}>
                <Ionicons name="create-outline" size={13} color="#FCD34D" />
                <Text style={styles.summaryChipText}>
                  {totals.drafts} drafts
                </Text>
              </View>
              <View style={styles.summaryChip}>
                <Ionicons name="layers-outline" size={13} color="#B7D3C6" />
                <Text style={styles.summaryChipText}>
                  {totals.assessedAreas}/{areas.length} areas assessed
                </Text>
              </View>
            </View>

            <View style={styles.offlineReady}>
              <View style={styles.offlineReadyRow}>
                <Text style={styles.offlineReadyLabel}>Offline readiness</Text>
                <Text style={styles.offlineReadyValue}>
                  {savedCount}/{areas.length} saved · {offlinePct}%
                </Text>
              </View>
              <View style={styles.progressBg}>
                <View
                  style={[styles.progressFill, { width: `${offlinePct}%` }]}
                />
              </View>
            </View>
          </View>
        )}

        {/* Content */}
        {loading && !refreshing ? (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color={PRIMARY} />
            <Text style={styles.loadingText}>Loading areas…</Text>
          </View>
        ) : error && areas.length === 0 ? (
          <View style={styles.centerContent}>
            <View
              style={[
                styles.stateIcon,
                { backgroundColor: isOnline ? "#FEF2F2" : "#FFFBEB" },
              ]}
            >
              <MaterialCommunityIcons
                name={isOnline ? "alert-circle-outline" : "cloud-off-outline"}
                size={30}
                color={isOnline ? RED : AMBER}
              />
            </View>
            <Text style={styles.stateTitle}>
              {isOnline ? "Couldn't load areas" : "Nothing saved offline"}
            </Text>
            <Text style={styles.stateText}>{error}</Text>
            {isOnline && (
              <TouchableOpacity
                style={styles.retryBtn}
                onPress={() => fetchAssignedAreas()}
              >
                <Text style={styles.retryText}>Try again</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
            >
              {FILTERS.map((f) => {
                const active = filter === f.key;
                return (
                  <TouchableOpacity
                    key={f.key}
                    style={[styles.filterChip, active && styles.filterChipActive]}
                    onPress={() => setFilter(f.key)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        active && styles.filterChipTextActive,
                      ]}
                    >
                      {f.label}
                    </Text>
                    <View
                      style={[
                        styles.filterCount,
                        active && styles.filterCountActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.filterCountText,
                          active && styles.filterCountTextActive,
                        ]}
                      >
                        {filterCounts[f.key]}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.list}>{filteredAreas.map(renderAreaCard)}</View>

            {filteredAreas.length === 0 && (
              <View style={styles.emptyState}>
                <View style={[styles.stateIcon, { backgroundColor: "#F3F4F6" }]}>
                  <MaterialCommunityIcons
                    name="pine-tree"
                    size={30}
                    color={FAINT}
                  />
                </View>
                <Text style={styles.stateTitle}>No areas found</Text>
                <Text style={styles.stateText}>
                  {searchText
                    ? `No results for "${searchText}".`
                    : filter !== "all"
                      ? "No areas match this filter."
                      : "You have no assigned areas yet."}
                </Text>
              </View>
            )}
          </>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Map Modal */}
      <Modal
        animationType="slide"
        transparent
        visible={modalVisible}
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom }]}>
            {selectedArea && (
              <>
                <View style={styles.dragHandle} />
                <WebView
                  source={{
                    html: generateMapHtml(
                      selectedArea.latitude,
                      selectedArea.longitude,
                      selectedArea.name,
                    ),
                  }}
                  style={styles.map}
                  javaScriptEnabled={true}
                  domStorageEnabled={true}
                  mixedContentMode="always"
                  startInLoadingState={true}
                  originWhitelist={["*"]}
                  onMessage={(event) => {
                    try {
                      const data = JSON.parse(event.nativeEvent.data);
                      if (data.type === "error")
                        showError("Map Error", data.message);
                    } catch (e) {}
                  }}
                  onError={(syntheticEvent) => {
                    const { nativeEvent } = syntheticEvent;
                    showError(
                      "WebView Error",
                      nativeEvent.description || "Failed to load map",
                    );
                  }}
                />
                <ScrollView
                  style={styles.modalInfo}
                  showsVerticalScrollIndicator={false}
                >
                  <Text style={styles.modalTitle}>{selectedArea.name}</Text>
                  {!!selectedArea.description && (
                    <Text style={styles.modalDesc}>
                      {selectedArea.description}
                    </Text>
                  )}
                  <View style={styles.infoGrid}>
                    {[
                      {
                        icon: "location",
                        label: "Barangay",
                        value: selectedArea.barangay_name || "—",
                      },
                      {
                        icon: "navigate",
                        label: "Coordinates",
                        value: selectedArea.coord_display,
                      },
                      {
                        icon: "pin",
                        label: "Sites",
                        value: `${selectedArea.site_stats?.total ?? 0} (${formatHectares(selectedArea.site_stats?.total_hectares ?? 0)} ha)`,
                      },
                      {
                        icon: "clipboard",
                        label: "Assessments",
                        value: `${selectedArea.assessment_stats?.submitted ?? 0} submitted · ${selectedArea.assessment_stats?.drafts ?? 0} drafts`,
                      },
                      {
                        icon: "calendar",
                        label: "Assigned",
                        value: formatDate(selectedArea.assigned_at),
                      },
                      {
                        icon: "time",
                        label: "Last assessed",
                        value: formatDate(
                          selectedArea.assessment_stats?.last_assessment_at,
                        ),
                      },
                    ].map((row) => (
                      <View key={row.label} style={styles.infoRow}>
                        <View style={styles.infoIconWrap}>
                          <Ionicons
                            name={row.icon as any}
                            size={15}
                            color={PRIMARY}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.infoLabel}>{row.label}</Text>
                          <Text style={styles.infoValue}>{row.value}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </ScrollView>
                <View
                  style={[
                    styles.modalBtnRow,
                    { paddingBottom: Math.max(insets.bottom, 16) },
                  ]}
                >
                  <Pressable style={styles.closeBtn} onPress={closeModal}>
                    <Text style={styles.closeBtnText}>Close</Text>
                  </Pressable>
                  <Pressable
                    style={styles.startBtn}
                    onPress={() => openActionSheet(selectedArea)}
                  >
                    <Text style={styles.startBtnText}>Start Assessment</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
        <ToastHost />
      </Modal>

      {/* Assessment Type Action Sheet */}
      <Modal
        animationType="slide"
        transparent
        visible={actionSheetVisible}
        onRequestClose={() => setActionSheetVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setActionSheetVisible(false)}
        >
          <Pressable
            style={[
              styles.actionSheet,
              { paddingBottom: Math.max(insets.bottom, 16) + 24 },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.dragHandle} />
            <Text style={styles.actionSheetTitle}>Choose Assessment Type</Text>
            <Text style={styles.actionSheetSubtitle}>
              {actionSheetArea?.name
                ? `${actionSheetArea.name} · ${actionSheetArea.site_stats?.total ?? 0} sites`
                : "Are you assessing the entire area or a specific site?"}
            </Text>

            <TouchableOpacity
              style={styles.actionOption}
              onPress={handleGeneralAssessment}
              activeOpacity={0.7}
            >
              <View style={styles.actionIconWrap}>
                <Ionicons name="globe-outline" size={22} color={PRIMARY} />
              </View>
              <View style={styles.actionTextWrap}>
                <Text style={styles.actionTitle}>General Assessment</Text>
                <Text style={styles.actionDesc}>
                  For the whole reforestation area (along the way observations).
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={FAINT} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionOption}
              onPress={handleSpecificAssessment}
              activeOpacity={0.7}
            >
              <View style={styles.actionIconWrap}>
                <Ionicons name="location-outline" size={22} color={PRIMARY} />
              </View>
              <View style={styles.actionTextWrap}>
                <Text style={styles.actionTitle}>Specific Site Assessment</Text>
                <Text style={styles.actionDesc}>
                  For a specific marked site (requires site selection).
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={FAINT} />
            </TouchableOpacity>

            <Pressable
              style={styles.cancelBtn}
              onPress={() => setActionSheetVisible(false)}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
        <ToastHost />
      </Modal>
    </View>
  );

  function generateMapHtml(lat: number, lng: number, title: string) {
    const safeLat = lat || 11.0;
    const safeLng = lng || 124.6;
    const safeTitle = title
      ? title.replace(/'/g, "\\'").replace(/"/g, '\\"')
      : "Area";

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }
          #map { width: 100%; height: 100vh; }
          .custom-marker { background-color: #0F4A2F; border: 3px solid #fff; border-radius: 50%; width: 20px; height: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.3); }
          .leaflet-div-icon { background: transparent; border: none; }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          try {
            var map = L.map('map', { zoomControl: true, attributionControl: true }).setView([${safeLat}, ${safeLng}], 15);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors', maxZoom: 19, crossOrigin: true, errorTileUrl: '' }).addTo(map);
            var customIcon = L.divIcon({ className: 'custom-marker-wrapper', html: '<div class="custom-marker"></div>', iconSize: [20, 20], iconAnchor: [10, 10] });
            L.marker([${safeLat}, ${safeLng}], {icon: customIcon}).addTo(map).bindPopup('${safeTitle}').openPopup();
            window.ReactNativeWebView.postMessage(JSON.stringify({type: 'info', message: 'Map loaded successfully'}));
          } catch(e) { window.ReactNativeWebView.postMessage(JSON.stringify({type: 'error', message: e.message})); }
        </script>
      </body>
      </html>
    `;
  }
};

/* ──────────────────────────────────────────────────────────────────
   STYLES
   ─────────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
  },
  scrollView: { flex: 1 },
  content: { paddingBottom: 24 },

  // Header
  header: { paddingHorizontal: 20 },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  eyebrow: {
    fontSize: 12,
    color: MUTED,
    fontWeight: "600",
    marginBottom: 3,
    letterSpacing: 0.2,
  },
  title: { fontSize: 32, fontWeight: "800", color: INK, letterSpacing: -0.5 },
  updatedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 4,
    ...cardShadow,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: GREEN },
  updatedText: { fontSize: 11, color: MUTED, fontWeight: "600" },
  offlineBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    padding: 12,
    borderRadius: 14,
    marginBottom: 12,
  },
  offlineTitle: { fontSize: 13, fontWeight: "700", color: "#92400E" },
  offlineText: { fontSize: 12, color: "#A16207", marginTop: 2, lineHeight: 17 },
  searchContainer: { flexDirection: "row", gap: 10, alignItems: "center" },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 46,
    ...cardShadow,
  },
  searchInput: { flex: 1, fontSize: 14, color: INK, fontWeight: "500" },
  mapButton: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
    ...cardShadow,
  },

  // Summary card
  summaryCard: {
    backgroundColor: PRIMARY,
    marginHorizontal: 20,
    marginTop: 20,
    padding: 20,
    borderRadius: 20,
    ...cardShadow,
  },
  summaryEyebrow: {
    fontSize: 12,
    color: "#B7D3C6",
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 14,
  },
  summaryRow: { flexDirection: "row", alignItems: "center" },
  summaryStat: { flex: 1, alignItems: "flex-start" },
  summaryValue: {
    fontSize: 26,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  summaryLabel: {
    fontSize: 11.5,
    color: "rgba(255,255,255,0.55)",
    fontWeight: "600",
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    height: 32,
    backgroundColor: "rgba(255,255,255,0.14)",
    marginHorizontal: 14,
  },
  summaryChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 16,
  },
  summaryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  summaryChipText: {
    fontSize: 11.5,
    color: "rgba(255,255,255,0.85)",
    fontWeight: "600",
  },
  offlineReady: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  offlineReadyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  offlineReadyLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    fontWeight: "600",
  },
  offlineReadyValue: { fontSize: 12, color: "#FFFFFF", fontWeight: "700" },
  progressBg: {
    height: 6,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: "#5FD08A", borderRadius: 3 },

  // Filters
  filterRow: {
    paddingHorizontal: 20,
    gap: 8,
    marginTop: 24,
    marginBottom: 14,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: LINE,
  },
  filterChipActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  filterChipText: { fontSize: 12.5, fontWeight: "600", color: MUTED },
  filterChipTextActive: { color: "#FFFFFF" },
  filterCount: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  filterCountActive: { backgroundColor: "rgba(255,255,255,0.18)" },
  filterCountText: { fontSize: 11, fontWeight: "700", color: MUTED },
  filterCountTextActive: { color: "#FFFFFF" },

  // States
  centerContent: {
    alignItems: "center",
    gap: 8,
    paddingTop: 72,
    paddingHorizontal: 32,
  },
  loadingText: { color: MUTED, fontSize: 14, marginTop: 6 },
  stateIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  stateTitle: { fontSize: 16, fontWeight: "700", color: INK },
  stateText: {
    fontSize: 13,
    color: MUTED,
    textAlign: "center",
    lineHeight: 19,
  },
  retryBtn: {
    marginTop: 12,
    backgroundColor: PRIMARY,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryText: { color: "#FFFFFF", fontWeight: "600", fontSize: 14 },
  emptyState: {
    alignItems: "center",
    paddingTop: 40,
    gap: 8,
    paddingHorizontal: 32,
  },

  // Area card
  list: { paddingHorizontal: 20, gap: 12 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    ...cardShadow,
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  cardIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: PRIMARY_SOFT,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitleWrap: { flex: 1 },
  cardName: { fontSize: 15.5, fontWeight: "700", color: INK, marginBottom: 3 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 12, color: MUTED, flexShrink: 1 },
  savedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  savedBadgeText: { fontSize: 10.5, fontWeight: "700", color: PRIMARY },
  cardDesc: { fontSize: 12.5, color: MUTED, lineHeight: 18, marginTop: 10 },
  miniRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginTop: 14,
  },
  miniStat: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  miniValue: { fontSize: 14, fontWeight: "800", color: INK },
  miniLabel: { fontSize: 10.5, color: FAINT, fontWeight: "600" },
  miniDivider: {
    width: 1,
    height: 26,
    backgroundColor: LINE,
    marginHorizontal: 8,
  },
  stackBar: {
    flexDirection: "row",
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
    backgroundColor: "#F3F4F6",
    gap: 2,
  },
  legendRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 8,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendText: { fontSize: 11, color: MUTED, fontWeight: "500" },
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: LINE,
  },
  activityItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  activityText: { fontSize: 11.5, color: MUTED, fontWeight: "500" },
  draftPill: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  draftPillText: { fontSize: 10.5, fontWeight: "700", color: "#B45309" },
  cardActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },
  iconAction: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#F0FDF4",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#DCFCE7",
  },
  iconActionDisabled: { backgroundColor: "#F9FAFB", borderColor: LINE },
  iconActionDanger: { backgroundColor: "#FEF2F2", borderColor: "#FECACA" },
  primaryAction: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: PRIMARY,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryActionText: { color: "#FFFFFF", fontSize: 13.5, fontWeight: "700" },

  // Map modal
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15,23,42,0.45)",
  },
  modalSheet: {
    height: screenHeight * 0.75,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E5E7EB",
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 8,
  },
  map: {
    width: "100%",
    height: screenHeight * 0.3,
    backgroundColor: "#E5E7EB",
  },
  modalInfo: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  modalTitle: { fontSize: 19, fontWeight: "800", color: INK, marginBottom: 4 },
  modalDesc: { fontSize: 13, color: MUTED, lineHeight: 19, marginBottom: 4 },
  infoGrid: { marginTop: 12, paddingBottom: 12 },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  infoIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: PRIMARY + "12",
    justifyContent: "center",
    alignItems: "center",
  },
  infoLabel: { fontSize: 11, color: FAINT, fontWeight: "500", marginBottom: 2 },
  infoValue: { fontSize: 14, color: INK, fontWeight: "600" },
  modalBtnRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  closeBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: PRIMARY,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  closeBtnText: { color: PRIMARY, fontWeight: "700", fontSize: 14 },
  startBtn: {
    flex: 2,
    backgroundColor: PRIMARY,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  startBtnText: { color: "#FFF", fontWeight: "700", fontSize: 14 },

  // Action sheet
  actionSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 14,
  },
  actionSheetTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: INK,
    textAlign: "center",
  },
  actionSheetSubtitle: {
    fontSize: 13,
    color: MUTED,
    textAlign: "center",
    marginBottom: 4,
  },
  actionOption: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    padding: 16,
    borderRadius: 16,
    gap: 12,
  },
  actionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: PRIMARY + "12",
    justifyContent: "center",
    alignItems: "center",
  },
  actionTextWrap: { flex: 1 },
  actionTitle: { fontSize: 14, fontWeight: "700", color: INK },
  actionDesc: { fontSize: 12, color: MUTED, marginTop: 2 },
  cancelBtn: { marginTop: 4, paddingVertical: 12, alignItems: "center" },
  cancelBtnText: { color: RED, fontWeight: "600", fontSize: 14 },
});

export default ReforestationAreas;
