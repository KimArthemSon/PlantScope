import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import * as SecureStore from "expo-secure-store";
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

  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [offlineDrafts, setOfflineDrafts] = useState<OfflineDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  // ✅ CORE FIX: Use useCallback so it can be reused
  const fetchAssessments = useCallback(
    async (showRefreshIndicator = false) => {
      if (showRefreshIndicator) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        // ✅ Always check network directly - never rely on stale state
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

          if (siteId) {
            url += `&site_id=${siteId}`;
          }

          try {
            const res = await fetch(url, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
              const data = await res.json();
              setAssessments(Array.isArray(data) ? data : []);
            } else {
              setAssessments([]);
            }
          } catch (fetchError) {
            console.error("API fetch failed:", fetchError);
            setAssessments([]);
            setIsOfflineMode(true);
          }

          // ✅ Always load offline drafts too
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

  // ✅ FIX 1: Initial load
  React.useEffect(() => {
    fetchAssessments();
  }, [fetchAssessments]);

  // ✅ FIX 2: Auto-refresh when screen gains focus (user navigates back)
  useFocusEffect(
    useCallback(() => {
      fetchAssessments();
    }, [fetchAssessments]),
  );

  // ✅ FIX 3: Refresh when network status changes
  React.useEffect(() => {
    fetchAssessments();
  }, [isOnline]);

  const handleDeleteOffline = (localUuid: string) => {
    Alert.alert(
      "Delete Offline Draft",
      "This cannot be undone. Are you sure?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteOfflineDraft(localUuid);
              Alert.alert("Deleted", "Offline draft deleted.");
              fetchAssessments();
            } catch (e: any) {
              Alert.alert("Error", "Failed to delete offline draft.");
            }
          },
        },
      ],
    );
  };

  const handleDeleteOnline = (id: number) => {
    if (isOfflineMode) {
      Alert.alert("Offline Mode", "Cannot delete assessments while offline.");
      return;
    }

    Alert.alert("Delete Draft", "This cannot be undone. Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const token = await SecureStore.getItemAsync("token");
            const res = await fetch(
              `${API_BASE}/api/field_assessments/${id}/delete/`,
              {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
              },
            );
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            fetchAssessments();
          } catch (e: any) {
            Alert.alert("Error", e.message ?? "Failed to delete.");
          }
        },
      },
    ]);
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

    offlineDrafts.forEach((draft) => {
      items.push({ type: "offline", data: draft });
    });

    assessments.forEach((a) => {
      items.push({ type: "online", data: a });
    });

    return items;
  };

  const displayList = buildDisplayList();
  const drafts = assessments.filter((a) => !a.is_submitted);
  const submitted = assessments.filter((a) => a.is_submitted);

  const renderItem = ({ item }: { item: DisplayItem }) => {
    if (item.type === "offline") {
      const draft = item.data;
      const hasLoc =
        draft.payload?.location?.latitude && draft.payload?.location?.longitude;

      return (
        <View style={[styles.card, styles.offlineCard]}>
          <View style={[styles.cardAccent, { backgroundColor: "#F59E0B" }]} />
          <View style={styles.cardBody}>
            <View style={styles.cardTopRow}>
              <View
                style={[styles.statusBadge, { backgroundColor: "#FEF3C7" }]}
              >
                <Ionicons name="cloud-outline" size={12} color="#92400E" />
                <Text style={[styles.statusText, { color: "#92400E" }]}>
                  Pending Sync
                </Text>
              </View>
              <Text style={styles.dateText}>
                {draft.created_at ? fmtDate(draft.created_at) : "Date not set"}
              </Text>
            </View>

            <View style={styles.metaRow}>
              <Ionicons
                name={hasLoc ? "location" : "location-outline"}
                size={13}
                color={hasLoc ? "#0F4A2F" : "#9CA3AF"}
              />
              {hasLoc ? (
                <Text style={[styles.metaText, { color: "#0F4A2F" }]}>
                  {draft.payload.location.latitude.toFixed(4)},{" "}
                  {draft.payload.location.longitude.toFixed(4)}
                </Text>
              ) : (
                <Text style={[styles.metaText, { fontStyle: "italic" }]}>
                  No GPS recorded
                </Text>
              )}
            </View>

            <View style={styles.metaRow}>
              {draft.images.length > 0 && (
                <>
                  <Ionicons name="image-outline" size={13} color="#9CA3AF" />
                  <Text style={styles.metaText}>
                    {draft.images.length} photo
                    {draft.images.length > 1 ? "s" : ""}
                  </Text>
                  <Text style={styles.metaDot}>·</Text>
                </>
              )}
              <Ionicons name="time-outline" size={13} color="#9CA3AF" />
              <Text style={styles.metaText}>
                Created {fmtDate(draft.created_at)}
              </Text>
            </View>

            <View style={styles.cardActions}>
              <TouchableOpacity
                style={styles.editBtn}
                onPress={() => {
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
                }}
                activeOpacity={0.75}
              >
                <Ionicons name="create-outline" size={14} color="#0F4A2F" />
                <Text style={styles.editBtnText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => handleDeleteOffline(draft.local_uuid)}
                activeOpacity={0.75}
              >
                <Ionicons name="trash-outline" size={14} color="#EF4444" />
                <Text style={styles.deleteBtnText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    }

    const a = item.data;
    const hasLoc = a.location?.latitude && a.location?.longitude;

    return (
      <View style={[styles.card, a.is_submitted && styles.cardSubmitted]}>
        <View
          style={[
            styles.cardAccent,
            { backgroundColor: a.is_submitted ? "#22C55E" : "#F59E0B" },
          ]}
        />
        <View style={styles.cardBody}>
          <View style={styles.cardTopRow}>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: a.is_submitted ? "#DCFCE7" : "#FEF3C7",
                },
              ]}
            >
              <Ionicons
                name={a.is_submitted ? "checkmark-circle" : "create-outline"}
                size={12}
                color={a.is_submitted ? "#15803D" : "#92400E"}
              />
              <Text
                style={[
                  styles.statusText,
                  { color: a.is_submitted ? "#15803D" : "#92400E" },
                ]}
              >
                {a.is_submitted ? "Submitted" : "Draft"}
              </Text>
            </View>
            <Text style={styles.dateText}>
              {a.assessment_date ? fmtDate(a.assessment_date) : "Date not set"}
            </Text>
          </View>

          <View style={styles.metaRow}>
            <Ionicons
              name={hasLoc ? "location" : "location-outline"}
              size={13}
              color={hasLoc ? "#0F4A2F" : "#9CA3AF"}
            />
            {hasLoc ? (
              <Text style={[styles.metaText, { color: "#0F4A2F" }]}>
                {a.location.latitude.toFixed(4)},{" "}
                {a.location.longitude.toFixed(4)}
              </Text>
            ) : (
              <Text style={[styles.metaText, { fontStyle: "italic" }]}>
                No GPS recorded
              </Text>
            )}
          </View>

          <View style={styles.metaRow}>
            {a.image_count > 0 && (
              <>
                <Ionicons name="image-outline" size={13} color="#9CA3AF" />
                <Text style={styles.metaText}>
                  {a.image_count} photo{a.image_count > 1 ? "s" : ""}
                </Text>
                <Text style={styles.metaDot}>·</Text>
              </>
            )}
            <Ionicons name="time-outline" size={13} color="#9CA3AF" />
            <Text style={styles.metaText}>Created {fmtDate(a.created_at)}</Text>
          </View>

          <View style={styles.cardActions}>
            {a.is_submitted ? (
              <TouchableOpacity
                style={styles.viewBtn}
                onPress={() => handleViewOnline(a)}
                activeOpacity={0.75}
              >
                <Ionicons name="eye-outline" size={14} color="#0F4A2F" />
                <Text style={styles.viewBtnText}>View</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() => handleEditOnline(a)}
                  activeOpacity={0.75}
                >
                  <Ionicons name="create-outline" size={14} color="#0F4A2F" />
                  <Text style={styles.editBtnText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.deleteBtn, isOfflineMode && { opacity: 0.5 }]}
                  onPress={() => handleDeleteOnline(a.field_assessment_id)}
                  activeOpacity={0.75}
                  disabled={isOfflineMode}
                >
                  <Ionicons name="trash-outline" size={14} color="#EF4444" />
                  <Text style={styles.deleteBtnText}>Delete</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#0F4A2F" />
        <Text style={styles.loadingText}>Loading {layerName} assessments…</Text>
      </View>
    );
  }

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
        {/* ✅ FIX 4: Manual Refresh Button */}
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

      <FlatList
        data={displayList}
        keyExtractor={(item, index) => {
          if (item.type === "offline") {
            return `offline-${item.data.local_uuid}`;
          }
          return `online-${item.data.field_assessment_id}`;
        }}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
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

            {(drafts.length > 0 || offlineDrafts.length > 0) && (
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
            <View style={[styles.emptyIcon, { backgroundColor: layer.bg }]}>
              <MaterialCommunityIcons
                name={layer.icon as any}
                size={36}
                color={layer.color}
              />
            </View>
            <Text style={styles.emptyTitle}>
              {isOfflineMode
                ? "No Offline Drafts"
                : `No ${layerName} Assessments`}
            </Text>
            <Text style={styles.emptySub}>
              {isOfflineMode
                ? "Tap 'New Entry' to create an assessment offline."
                : `Tap "New ${layerName} Entry" above to start your first assessment.`}
            </Text>
          </View>
        }
        ListFooterComponent={<View style={{ height: 8 }} />}
      />
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
  // ✅ NEW: Refresh button style
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
  listContent: { paddingHorizontal: 16 },
  listHeader: { paddingTop: 16, marginBottom: 4 },
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
    overflow: "hidden",
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
  cardAccent: { width: 4 },
  cardBody: { flex: 1, padding: 14 },
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
