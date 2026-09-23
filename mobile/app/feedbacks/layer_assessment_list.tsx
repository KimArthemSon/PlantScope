import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/constants/url_fixed";
import { useNetworkStatus } from "@/utils/networkStatus";
import {
  getOfflineDraftsForContext,
  deleteOfflineDraft,
  OfflineDraft,
} from "@/hooks/useOfflineFieldAssessment";
import { useAlert } from "@/components/AlertContext";

const API_BASE = api;

const LAYER_CONFIG: Record<
  string,
  { color: string; bg: string; icon: string }
> = {
  meta_data: { color: "#8B5CF6", bg: "#F5F3FF", icon: "database-outline" },
  safety: { color: "#EF4444", bg: "#FEF2F2", icon: "shield-alert-outline" },
  boundary_verification: {
    color: "#3B82F6",
    bg: "#EFF6FF",
    icon: "map-search-outline",
  },
  survivability: { color: "#16A34A", bg: "#F0FDF4", icon: "sprout" },
};

const getLayer = (id: string) =>
  LAYER_CONFIG[id] ?? {
    color: "#0F4A2F",
    bg: "#E6F4EC",
    icon: "layers-outline",
  };

type Assessment = {
  field_assessment_id: number;
  title?: string | null;
  reforestation_area_id: number;
  assessment_date: string | null;
  location: any;
  is_submitted: boolean;
  image_count: number;
  created_at: string;
  updated_at: string;
  field_assessment_data?: Record<string, any>;
};

type DisplayItem =
  | { type: "online"; data: Assessment }
  | { type: "offline"; data: OfflineDraft };

const getFormPath = (layerId: string) =>
  layerId === "meta_data"
    ? "/feedbacks/meta_data_form"
    : "/feedbacks/multicriteria_layer_form";
    
const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

// ✅ Type-safe ID generator
const getItemId = (item: DisplayItem): string => {
  if (item.type === "offline") {
    return `offline-${(item.data as OfflineDraft).local_uuid}`;
  }
  return `online-${(item.data as Assessment).field_assessment_id}`;
};

export default function LayerAssessmentList() {
  const { areaId, siteId, areaName, siteName, layerId, layerName } =
    useLocalSearchParams<{
      areaId: string;
      siteId?: string;
      areaName: string;
      siteName?: string;
      layerId:
        | "safety"
        | "boundary_verification"
        | "survivability"
        | "meta_data";
      layerName: string;
    }>();

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const layer = getLayer(layerId);
  const isOnline = useNetworkStatus();
  const { success, error: showError, warning, confirm } = useAlert();

  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [offlineDrafts, setOfflineDrafts] = useState<OfflineDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<
    "all" | "today" | "last_7_days" | "last_30_days"
  >("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "status">(
    "newest",
  );
  const [showFilterModal, setShowFilterModal] = useState(false);

  // ✅ Favourite State
  const [favourites, setFavourites] = useState<Set<string>>(new Set());
  // ✅ NEW: Favourites Filter State
  const [showOnlyFavourites, setShowOnlyFavourites] = useState(false);

  // ✅ Load favourites scoped to this specific area/site/layer
  useEffect(() => {
    const loadFavs = async () => {
      try {
        const key = `favs_${areaId}_${siteId || "nosite"}_${layerId}`;
        const stored = await AsyncStorage.getItem(key);
        if (stored) setFavourites(new Set(JSON.parse(stored)));
      } catch (e) {
        console.error("Failed to load favourites", e);
      }
    };
    loadFavs();
  }, [areaId, siteId, layerId]);

  // ✅ Toggle Favourite
  const toggleFavourite = async (id: string) => {
    const newFavs = new Set(favourites);
    if (newFavs.has(id)) newFavs.delete(id);
    else newFavs.add(id);
    setFavourites(newFavs);
    try {
      const key = `favs_${areaId}_${siteId || "nosite"}_${layerId}`;
      await AsyncStorage.setItem(key, JSON.stringify(Array.from(newFavs)));
    } catch (e) {
      console.error("Failed to save favourite", e);
    }
  };

  const fetchAssessments = useCallback(
    async (showRefreshIndicator = false) => {
      if (showRefreshIndicator) setRefreshing(true);
      else setLoading(true);
      try {
        const networkState = await NetInfo.fetch();
        const actuallyOnline = networkState.isConnected === true;

        if (!actuallyOnline) {
          setIsOfflineMode(true);
          const drafts = await getOfflineDraftsForContext(
            parseInt(areaId),
            siteId ? parseInt(siteId) : null,
            layerId,
          );
          setOfflineDrafts(drafts);
          setAssessments([]);
        } else {
          setIsOfflineMode(false);
          const token = await SecureStore.getItemAsync("token");
          let url = `${API_BASE}/api/field_assessments/?reforestation_area_id=${areaId}&layer=${layerId}`;
          if (siteId) url += `&site_id=${siteId}`;
          try {
            const res = await fetch(url, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
              const data = await res.json();
              setAssessments(Array.isArray(data) ? data : []);
            } else setAssessments([]);
          } catch (fetchError) {
            console.error("API fetch failed:", fetchError);
            setAssessments([]);
            setIsOfflineMode(true);
          }
          const drafts = await getOfflineDraftsForContext(
            parseInt(areaId),
            siteId ? parseInt(siteId) : null,
            layerId,
          );
          setOfflineDrafts(drafts);
        }
      } catch (e: any) {
        console.error("Error in fetchAssessments:", e);
        setAssessments([]);
        setIsOfflineMode(true);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [areaId, siteId, layerId],
  );

  React.useEffect(() => {
    fetchAssessments();
  }, [fetchAssessments]);
  
  useFocusEffect(
    useCallback(() => {
      fetchAssessments();
    }, [fetchAssessments]),
  );
  
  React.useEffect(() => {
    fetchAssessments();
  }, [isOnline]);

  const handleDeleteOffline = (localUuid: string) => {
    confirm(
      "Delete Offline Draft",
      "This cannot be undone. Are you sure?",
      async () => {
        try {
          await deleteOfflineDraft(localUuid);
          success("Deleted", "Offline draft deleted.");
          fetchAssessments();
        } catch (e: any) {
          showError("Error", "Failed to delete offline draft.");
        }
      },
      { type: "error", confirmText: "Delete", cancelText: "Cancel" },
    );
  };

  const handleDeleteOnline = (id: number) => {
    if (isOfflineMode) {
      warning("Offline Mode", "Cannot delete assessments while offline.");
      return;
    }
    confirm(
      "Delete Draft",
      "This cannot be undone. Are you sure?",
      async () => {
        try {
          const token = await SecureStore.getItemAsync("token");
          const res = await fetch(
            `${API_BASE}/api/field_assessments/${id}/delete/`,
            { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
          );
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          success("Deleted", "Assessment deleted successfully.");
          fetchAssessments();
        } catch (e: any) {
          showError("Error", e.message ?? "Failed to delete.");
        }
      },
      { type: "error", confirmText: "Delete", cancelText: "Cancel" },
    );
  };

  const handleCreateNew = () => {
    const path = getFormPath(layerId);
    const params: any = { areaId, siteId, isEdit: "false" };
    if (layerId !== "meta_data") {
      params.layerId = layerId;
      params.layerName = layerName;
    }
    router.push({ pathname: path, params });
  };

  const handleEditOnline = (a: Assessment) => {
    const path = getFormPath(layerId);
    const params: any = {
      areaId,
      siteId,
      id: a.field_assessment_id.toString(),
      isEdit: "true",
    };
    if (layerId !== "meta_data") {
      params.layerId = layerId;
      params.layerName = layerName;
      params.assessmentId = a.field_assessment_id.toString();
    }
    router.push({ pathname: path, params });
  };

  const handleViewOnline = (a: Assessment) => {
    const path = getFormPath(layerId);
    const params: any = {
      areaId,
      siteId,
      id: a.field_assessment_id.toString(),
      isEdit: "false",
    };
    if (layerId !== "meta_data") {
      params.layerId = layerId;
      params.layerName = layerName;
      params.assessmentId = a.field_assessment_id.toString();
    }
    router.push({ pathname: path, params });
  };

  const buildDisplayList = (): DisplayItem[] => {
    const items: DisplayItem[] = [];
    offlineDrafts.forEach((draft) =>
      items.push({ type: "offline", data: draft }),
    );
    assessments.forEach((a) => items.push({ type: "online", data: a }));
    return items;
  };

  const displayList = buildDisplayList();
  const drafts = assessments.filter((a) => !a.is_submitted);
  const submitted = assessments.filter((a) => a.is_submitted);

  const filteredAndSortedList = useMemo(() => {
    let result = [...displayList];
    
    // ✅ NEW: Filter by Favourites
    if (showOnlyFavourites) {
      result = result.filter((item) => favourites.has(getItemId(item)));
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((item) => {
        if (item.type === "online")
          return (
            (item.data as Assessment).title ||
            `Assessment #${(item.data as Assessment).field_assessment_id}`
          )
            .toLowerCase()
            .includes(query);
        return ((item.data as OfflineDraft).payload?.title || `Offline Draft`)
          .toLowerCase()
          .includes(query);
      });
    }
    if (dateFilter !== "all") {
      const now = new Date();
      const isToday = (d: Date) =>
        d.getDate() === now.getDate() &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear();
      result = result.filter((item) => {
        const dateStr =
          item.type === "online"
            ? (item.data as Assessment).assessment_date ||
              (item.data as Assessment).created_at
            : (item.data as OfflineDraft).created_at;
        if (!dateStr) return false;
        const itemDate = new Date(dateStr);
        if (dateFilter === "today") return isToday(itemDate);
        const diffDays = Math.ceil(
          Math.abs(now.getTime() - itemDate.getTime()) / (1000 * 60 * 60 * 24),
        );
        if (dateFilter === "last_7_days") return diffDays <= 7;
        if (dateFilter === "last_30_days") return diffDays <= 30;
        return true;
      });
    }
    result.sort((a, b) => {
      const getDate = (item: DisplayItem) =>
        item.type === "online"
          ? new Date(
              (item.data as Assessment).assessment_date ||
                (item.data as Assessment).created_at,
            ).getTime()
          : new Date((item.data as OfflineDraft).created_at).getTime();
      const dateA = getDate(a),
        dateB = getDate(b);
      if (sortBy === "newest") return dateB - dateA;
      if (sortBy === "oldest") return dateA - dateB;
      if (sortBy === "status") {
        const isSubA =
          a.type === "online" ? (a.data as Assessment).is_submitted : false;
        const isSubB =
          b.type === "online" ? (b.data as Assessment).is_submitted : false;
        if (isSubA === isSubB) return dateB - dateA;
        return isSubA ? 1 : -1;
      }
      return 0;
    });
    // ✅ Added favourites and showOnlyFavourites to dependencies
    return result;
  }, [displayList, searchQuery, dateFilter, sortBy, showOnlyFavourites, favourites]);

  const renderItem = ({ item }: { item: DisplayItem }) => {
    const id = getItemId(item);
    const isFav = favourites.has(id);

    const isOffline = item.type === "offline";
    const draft = isOffline ? (item.data as OfflineDraft) : null;
    const assessment = !isOffline ? (item.data as Assessment) : null;

    const hasLoc = isOffline
      ? draft?.payload?.location?.latitude &&
        draft?.payload?.location?.longitude
      : assessment?.location?.latitude && assessment?.location?.longitude;

    const loc = isOffline ? draft?.payload?.location : assessment?.location;

    const title = isOffline
      ? draft?.payload?.title || "Offline Draft"
      : assessment?.title || `Assessment #${assessment?.field_assessment_id}`;

    const isSubmitted = isOffline ? false : assessment?.is_submitted;

    const dateStr = isOffline
      ? draft?.created_at
      : assessment?.assessment_date || assessment?.created_at;

    const cardStyle = [
      styles.card,
      isOffline && styles.offlineCard,
      isSubmitted && !isOffline && styles.cardSubmitted,
    ];

    return (
      <TouchableOpacity
        style={cardStyle}
        activeOpacity={0.9}
        onPress={() => {
          if (isOffline && draft) {
            const path = getFormPath(layerId);
            const params: any = {
              areaId,
              siteId,
              isEdit: "false",
              offlineDraftId: draft.local_uuid,
            };
            if (layerId !== "meta_data") {
              params.layerId = layerId;
              params.layerName = layerName;
            }
            router.push({ pathname: path, params });
          } else if (assessment) {
            isSubmitted
              ? handleViewOnline(assessment)
              : handleEditOnline(assessment);
          }
        }}
      >
        <View
          style={[
            styles.cardAccent,
            {
              backgroundColor: isSubmitted ? "#22C55E" : "#F59E0B",
            },
          ]}
        />
        <View style={styles.cardBody}>
          <View style={styles.cardHeaderRow}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                flex: 1,
              }}
            >
              <Text style={styles.cardTitleText} numberOfLines={1}>
                {title}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => toggleFavourite(id)}
              activeOpacity={0.7}
              style={{ padding: 4 }}
            >
              <Ionicons
                name={isFav ? "heart" : "heart-outline"}
                size={20}
                color={isFav ? "#EF4444" : "#9CA3AF"}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.cardTopRow}>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: isSubmitted ? "#DCFCE7" : "#FEF3C7" },
              ]}
            >
              <Ionicons
                name={
                  isSubmitted
                    ? "checkmark-circle"
                    : isOffline
                      ? "cloud-outline"
                      : "create-outline"
                }
                size={12}
                color={isSubmitted ? "#15803D" : "#92400E"}
              />
              <Text
                style={[
                  styles.statusText,
                  { color: isSubmitted ? "#15803D" : "#92400E" },
                ]}
              >
                {isSubmitted
                  ? "Submitted"
                  : isOffline
                    ? "Pending Sync"
                    : "Draft"}
              </Text>
            </View>
            <Text style={styles.dateText}>
              {dateStr ? fmtDate(dateStr) : "Date not set"}
            </Text>
          </View>

          <View style={styles.metaRow}>
            <Ionicons
              name={hasLoc ? "location" : "location-outline"}
              size={13}
              color={hasLoc ? "#0F4A2F" : "#9CA3AF"}
            />
            {hasLoc && loc ? (
              <Text style={[styles.metaText, { color: "#0F4A2F" }]}>
                {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
              </Text>
            ) : (
              <Text style={[styles.metaText, { fontStyle: "italic" }]}>
                No GPS recorded
              </Text>
            )}
          </View>

          <View style={styles.metaRow}>
            {(isOffline
              ? draft?.images?.length || 0
              : assessment?.image_count || 0) > 0 && (
              <>
                <Ionicons name="image-outline" size={13} color="#9CA3AF" />
                <Text style={styles.metaText}>
                  {isOffline ? draft?.images?.length : assessment?.image_count}{" "}
                  photo
                  {((isOffline
                    ? draft?.images?.length
                    : assessment?.image_count) || 0) > 1
                    ? "s"
                    : ""}
                </Text>
                <Text style={styles.metaDot}>·</Text>
              </>
            )}
            <Ionicons name="time-outline" size={13} color="#9CA3AF" />
            <Text style={styles.metaText}>
              Created{" "}
              {fmtDate(draft?.created_at || assessment?.created_at || "")}
            </Text>
          </View>

          <View style={styles.cardActions}>
            {isSubmitted ? (
              <TouchableOpacity
                style={styles.viewBtn}
                onPress={() => assessment && handleViewOnline(assessment)}
                activeOpacity={0.75}
              >
                <Ionicons name="eye-outline" size={14} color="#0F4A2F" />
                <Text style={styles.viewBtnText}>View</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() =>
                    !isOffline && assessment && handleEditOnline(assessment)
                  }
                  activeOpacity={0.75}
                >
                  <Ionicons name="create-outline" size={14} color="#0F4A2F" />
                  <Text style={styles.editBtnText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.deleteBtn,
                    isOfflineMode && !isOffline && { opacity: 0.5 },
                  ]}
                  onPress={() =>
                    isOffline && draft
                      ? handleDeleteOffline(draft.local_uuid)
                      : assessment &&
                        handleDeleteOnline(assessment.field_assessment_id)
                  }
                  activeOpacity={0.75}
                  disabled={isOfflineMode && !isOffline}
                >
                  <Ionicons name="trash-outline" size={14} color="#EF4444" />
                  <Text style={styles.deleteBtnText}>Delete</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading)
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#0F4A2F" />
        <Text style={styles.loadingText}>Loading {layerName} assessments…</Text>
      </View>
    );

  const headerTitle = siteId ? siteName || "Site" : areaName;
  const headerSubText = siteId
    ? `${layerName} Layer (Site)`
    : `${layerName} Layer (Area)`;

  return (
    <View style={styles.root}>
      {isOfflineMode && (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline-outline" size={16} color="#FFFFFF" />
          <Text style={styles.offlineBannerText}>
            Offline Mode - Showing saved drafts
          </Text>
        </View>
      )}

      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {headerTitle}
          </Text>
          <View style={styles.headerSubRow}>
            <View style={[styles.layerDot, { backgroundColor: layer.color }]} />
            <Text style={styles.headerSub}>{headerSubText}</Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity
            onPress={() => fetchAssessments(true)}
            style={styles.refreshBtn}
            activeOpacity={0.7}
            disabled={refreshing}
          >
            <Ionicons
              name={refreshing ? "refresh-outline" : "refresh"}
              size={22}
              color="#FFFFFF"
            />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.controlsContainer}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color="#6B7280" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by title..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#9CA3AF"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>

        {/* ✅ NEW: Favourites Filter Toggle */}
        <TouchableOpacity
          style={[styles.favFilterBtn, showOnlyFavourites && styles.favFilterBtnActive]}
          onPress={() => setShowOnlyFavourites(!showOnlyFavourites)}
          activeOpacity={0.8}
        >
          <Ionicons
            name={showOnlyFavourites ? "heart" : "heart-outline"}
            size={16}
            color={showOnlyFavourites ? "#FFFFFF" : "#EF4444"}
          />
          <Text style={[styles.favFilterText, showOnlyFavourites && styles.favFilterTextActive]}>
            {showOnlyFavourites ? "Showing Favourites Only" : "Show Favourites Only"}
          </Text>
        </TouchableOpacity>

        <View style={styles.filterBar}>
          <TouchableOpacity
            style={styles.filterBtn}
            onPress={() => setShowFilterModal(true)}
          >
            <Ionicons name="calendar-outline" size={16} color="#0F4A2F" />
            <Text style={styles.filterBtnText}>
              {dateFilter === "all"
                ? "All Time"
                : dateFilter === "today"
                  ? "Today"
                  : dateFilter === "last_7_days"
                    ? "Last 7 Days"
                    : "Last 30 Days"}
            </Text>
            <Ionicons name="chevron-down" size={16} color="#0F4A2F" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.filterBtn}
            onPress={() => setShowFilterModal(true)}
          >
            <Ionicons name="swap-vertical" size={16} color="#0F4A2F" />
            <Text style={styles.filterBtnText}>
              {sortBy === "newest"
                ? "Newest First"
                : sortBy === "oldest"
                  ? "Oldest First"
                  : "By Status"}
            </Text>
            <Ionicons name="chevron-down" size={16} color="#0F4A2F" />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={filteredAndSortedList}
        keyExtractor={(item) => getItemId(item)}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={false}
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 32 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchAssessments(true)}
            colors={["#0F4A2F"]}
            tintColor="#0F4A2F"
          />
        }
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <View style={[styles.statIcon, { backgroundColor: "#FEF3C7" }]}>
                  <Ionicons name="create-outline" size={16} color="#F59E0B" />
                </View>
                <Text style={styles.statValue}>
                  {drafts.length + offlineDrafts.length}
                </Text>
                <Text style={styles.statLabel}>Drafts</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <View style={[styles.statIcon, { backgroundColor: "#DCFCE7" }]}>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={16}
                    color="#22C55E"
                  />
                </View>
                <Text style={styles.statValue}>{submitted.length}</Text>
                <Text style={styles.statLabel}>Submitted</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <View style={[styles.statIcon, { backgroundColor: layer.bg }]}>
                  <MaterialCommunityIcons
                    name={layer.icon as any}
                    size={16}
                    color={layer.color}
                  />
                </View>
                <Text style={styles.statValue}>{displayList.length}</Text>
                <Text style={styles.statLabel}>Total</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.newBtn, { shadowColor: layer.color }]}
              onPress={handleCreateNew}
              activeOpacity={0.85}
            >
              <View
                style={[
                  styles.newBtnIcon,
                  { backgroundColor: "rgba(255,255,255,0.18)" },
                ]}
              >
                <Ionicons name="add" size={20} color="#FFFFFF" />
              </View>
              <View style={styles.newBtnText}>
                <Text style={styles.newBtnTitle}>New {layerName} Entry</Text>
                <Text style={styles.newBtnSub}>
                  {isOfflineMode
                    ? "Save offline - will sync later"
                    : "Start a new assessment record"}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color="rgba(255,255,255,0.5)"
              />
            </TouchableOpacity>
            {(drafts.length > 0 || offlineDrafts.length > 0) && !showOnlyFavourites && (
              <View style={styles.sectionRow}>
                <Text style={styles.sectionLabel}>Drafts</Text>
                <View
                  style={[styles.sectionBadge, { backgroundColor: "#FEF3C7" }]}
                >
                  <Text style={[styles.sectionBadgeText, { color: "#92400E" }]}>
                    {drafts.length + offlineDrafts.length}
                  </Text>
                </View>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: showOnlyFavourites ? "#FEF2F2" : layer.bg }]}>
              <Ionicons 
                name={showOnlyFavourites ? "heart-dislike-circle" : layer.icon as any} 
                size={36} 
                color={showOnlyFavourites ? "#EF4444" : layer.color} 
              />
            </View>
            <Text style={styles.emptyTitle}>
              {showOnlyFavourites
                ? "No Favourites Found"
                : searchQuery || dateFilter !== "all"
                  ? "No Matching Results"
                  : isOfflineMode
                    ? "No Offline Drafts"
                    : `No ${layerName} Assessments`}
            </Text>
            <Text style={styles.emptySub}>
              {showOnlyFavourites
                ? "You haven't added any favourites yet, or none match your current filters."
                : searchQuery || dateFilter !== "all"
                  ? "Try adjusting your search or filter criteria."
                  : isOfflineMode
                    ? "Tap 'New Entry' to create an assessment offline."
                    : `Tap "New ${layerName} Entry" above to start your first assessment.`}
            </Text>
          </View>
        }
        ListFooterComponent={<View style={{ height: 8 }} />}
      />

      <Modal visible={showFilterModal} transparent animationType="slide">
        <View style={modalStyles.overlay}>
          <View style={modalStyles.modal}>
            <View style={modalStyles.modalHeader}>
              <Text style={modalStyles.modalTitle}>Filter & Sort</Text>
              <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                <Ionicons name="close" size={24} color="#0F2D1C" />
              </TouchableOpacity>
            </View>
            <Text style={modalStyles.sectionTitle}>Date Filter</Text>
            <View style={modalStyles.optionsRow}>
              {(["all", "today", "last_7_days", "last_30_days"] as const).map(
                (opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[
                      modalStyles.optionChip,
                      dateFilter === opt && modalStyles.optionChipActive,
                    ]}
                    onPress={() => setDateFilter(opt)}
                  >
                    <Text
                      style={[
                        modalStyles.optionText,
                        dateFilter === opt && modalStyles.optionTextActive,
                      ]}
                    >
                      {opt === "all"
                        ? "All Time"
                        : opt === "today"
                          ? "Today"
                          : opt === "last_7_days"
                            ? "Last 7 Days"
                            : "Last 30 Days"}
                    </Text>
                  </TouchableOpacity>
                ),
              )}
            </View>
            <Text style={modalStyles.sectionTitle}>Sort By</Text>
            <View style={modalStyles.optionsRow}>
              {(["newest", "oldest", "status"] as const).map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[
                    modalStyles.optionChip,
                    sortBy === opt && modalStyles.optionChipActive,
                  ]}
                  onPress={() => setSortBy(opt)}
                >
                  <Text
                    style={[
                      modalStyles.optionText,
                      sortBy === opt && modalStyles.optionTextActive,
                    ]}
                  >
                    {opt === "newest"
                      ? "Newest First"
                      : opt === "oldest"
                        ? "Oldest First"
                        : "By Status"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={modalStyles.applyBtn}
              onPress={() => setShowFilterModal(false)}
            >
              <Text style={modalStyles.applyBtnText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ---------- STYLES ---------- */
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F4F7F5" },
  loadingScreen: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: { color: "#6B7280", fontSize: 14 },
  offlineBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F59E0B",
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 8,
  },
  offlineBannerText: { color: "#FFFFFF", fontSize: 12, fontWeight: "600" },
  header: {
    backgroundColor: "#0F4A2F",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingBottom: 14,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },
  headerSubRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 2,
  },
  layerDot: { width: 7, height: 7, borderRadius: 4 },
  headerSub: { fontSize: 11, color: "rgba(255,255,255,0.6)" },
  controlsContainer: {
    backgroundColor: "#F4F7F5",
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#0F2D1C",
    marginLeft: 8,
    marginRight: 8,
  },
  // ✅ NEW: Favourites Filter Styles
  favFilterBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 10,
    paddingVertical: 10,
    marginBottom: 12,
  },
  favFilterBtnActive: {
    backgroundColor: "#EF4444",
    borderColor: "#EF4444",
  },
  favFilterText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#EF4444",
  },
  favFilterTextActive: {
    color: "#FFFFFF",
  },
  filterBar: { flexDirection: "row", gap: 10, marginBottom: 16 },
  filterBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingVertical: 10,
  },
  filterBtnText: { fontSize: 13, fontWeight: "600", color: "#0F4A2F" },
  listContent: { paddingHorizontal: 16 },
  listHeader: { paddingTop: 4, marginBottom: 4 },
  statsRow: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  statItem: { flex: 1, alignItems: "center", gap: 5 },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  statDivider: { width: 1, height: 40, backgroundColor: "#F3F4F6" },
  statValue: { fontSize: 18, fontWeight: "800", color: "#0F2D1C" },
  statLabel: { fontSize: 10, color: "#9CA3AF", fontWeight: "600" },
  newBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#0F4A2F",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    elevation: 3,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  newBtnIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  newBtnText: { flex: 1 },
  newBtnTitle: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },
  newBtnSub: { fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 1 },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
    marginTop: 2,
  },
  sectionLabel: { fontSize: 13, fontWeight: "700", color: "#0F2D1C" },
  sectionBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  sectionBadgeText: { fontSize: 11, fontWeight: "700" },
  
  card: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  offlineCard: {
    borderColor: "#F59E0B",
    borderWidth: 1.5,
    backgroundColor: "#FFFBEB",
  },
  cardSubmitted: { opacity: 0.92 },
  cardAccent: { 
    width: 4,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  cardBody: { 
    flex: 1, 
    padding: 14,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  cardTitleText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F2D1C",
    lineHeight: 20,
    flex: 1,
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  statusText: { fontSize: 10, fontWeight: "700" },
  dateText: { fontSize: 11, color: "#6B7280" },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 3,
    flexWrap: "wrap",
  },
  metaText: { fontSize: 11, color: "#6B7280" },
  metaDot: { fontSize: 11, color: "#D1D5DB", marginHorizontal: 2 },
  cardActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    justifyContent: "flex-end",
  },
  viewBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1.5,
    borderColor: "#0F4A2F",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  viewBtnText: { color: "#0F4A2F", fontSize: 12, fontWeight: "600" },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1.5,
    borderColor: "#0F4A2F",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  editBtnText: { color: "#0F4A2F", fontSize: 12, fontWeight: "600" },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#FEF2F2",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  deleteBtnText: { color: "#EF4444", fontSize: 12, fontWeight: "600" },
  emptyState: { alignItems: "center", paddingTop: 48, gap: 10 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#6B7280" },
  emptySub: {
    fontSize: 13,
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 20,
  },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modal: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#0F2D1C" },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
    marginTop: 16,
  },
  optionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  optionChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
  },
  optionChipActive: { backgroundColor: "#0F4A2F", borderColor: "#0F4A2F" },
  optionText: { fontSize: 13, color: "#4B5563", fontWeight: "600" },
  optionTextActive: { color: "#FFFFFF" },
  applyBtn: {
    backgroundColor: "#0F4A2F",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 24,
  },
  applyBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
});