import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import NetInfo from "@react-native-community/netinfo";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/constants/url_fixed";
import { HardHat, Scale, Sprout, Database } from "lucide-react-native";
import { useNetworkStatus } from "@/utils/networkStatus";
import { getOfflineDraftsForContext } from "@/hooks/useOfflineFieldAssessment";
import { useAlert } from "@/components/AlertContext";

const API = api + "/api";

export const LAYERS = [
  {
    id: "meta_data",
    label: "Meta Data",
    icon: Database,
    color: "#8B5CF6",
    bg: "#F5F3FF",
  },
  {
    id: "safety",
    label: "Safety",
    icon: HardHat,
    color: "#EF4444",
    bg: "#FEF2F2",
  },
  {
    id: "boundary_verification",
    label: "Boundary Verification",
    icon: Scale,
    color: "#3B82F6",
    bg: "#EFF6FF",
  },
  {
    id: "survivability",
    label: "Survivability",
    icon: Sprout,
    color: "#16A34A",
    bg: "#F0FDF4",
  },
];

type LayerStatus = "done" | "draft" | "pending";

export default function SiteFieldAssessment() {
  const { areaId, areaName, siteId, siteName } = useLocalSearchParams<{
    areaId: string;
    areaName: string;
    siteId?: string;
    siteName?: string;
  }>();

  const { success, error, warning, info, confirm } = useAlert();

  const [assessments, setAssessments] = useState<any[]>([]);
  const [offlineDrafts, setOfflineDrafts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isOnline = useNetworkStatus();

  const fetchAssessments = useCallback(
    async (showRefreshIndicator = false) => {
      if (showRefreshIndicator) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const networkState = await NetInfo.fetch();
        const actuallyOnline = networkState.isConnected === true;

        const drafts = await getOfflineDraftsForContext(
          parseInt(areaId),
          siteId ? parseInt(siteId) : null,
          "",
        );
        setOfflineDrafts(drafts);

        if (!actuallyOnline) {
          setIsOfflineMode(true);
          setAssessments([]);
        } else {
          const token = await SecureStore.getItemAsync("token");
          let url = `${API}/field_assessments/?reforestation_area_id=${areaId}`;

          if (siteId) {
            url += `&site_id=${siteId}`;
          }

          try {
            const res = await fetch(url, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
              setAssessments(await res.json());
              setIsOfflineMode(false);
            } else {
              setAssessments([]);
              setIsOfflineMode(true);
            }
          } catch (fetchError) {
            console.error("API fetch failed:", fetchError);
            setAssessments([]);
            setIsOfflineMode(true);
          }
        }
      } catch (err) {
        console.error("Error fetching assessments:", err);
        setAssessments([]);
        setIsOfflineMode(true);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [areaId, siteId],
  );

  useEffect(() => {
    fetchAssessments();
  }, [fetchAssessments]);

  useFocusEffect(
    useCallback(() => {
      fetchAssessments();
    }, [fetchAssessments]),
  );

  useEffect(() => {
    fetchAssessments();
  }, [isOnline]);

  const getStatus = (layerId: string): LayerStatus => {
    const onlineAssessments = assessments.filter((a) => {
      const layerData = a.field_assessment_data?.[layerId];
      return (
        layerData &&
        typeof layerData === "object" &&
        Object.keys(layerData).length > 0
      );
    });

    if (onlineAssessments.some((a) => a.is_submitted)) return "done";

    const offlineDraftsForLayer = offlineDrafts.filter(
      (d) => d.layer === layerId,
    );

    if (offlineDraftsForLayer.length > 0) return "draft";
    if (onlineAssessments.length > 0) return "draft";
    return "pending";
  };

  const getCount = (layerId: string, submitted: boolean) => {
    const onlineCount = assessments.filter((a) => {
      const layerData = a.field_assessment_data?.[layerId];
      const hasData =
        layerData &&
        typeof layerData === "object" &&
        Object.keys(layerData).length > 0;
      return hasData && a.is_submitted === submitted;
    }).length;

    if (!submitted) {
      const offlineCount = offlineDrafts.filter(
        (d) => d.layer === layerId,
      ).length;
      return onlineCount + offlineCount;
    }

    return onlineCount;
  };

  // ✅ NEW: Calculate summary statistics
  const submittedCount = LAYERS.filter((l) => getStatus(l.id) === "done").length;
  const draftCount = LAYERS.filter((l) => getStatus(l.id) === "draft").length;
  const pendingCount = LAYERS.filter((l) => getStatus(l.id) === "pending").length;

  const handleLayerPress = (layerId: string, layerName: string) => {
    router.push({
      pathname: "/feedbacks/layer_assessment_list",
      params: { areaId, areaName, siteId, siteName, layerId, layerName },
    });
  };

  const headerTitle = siteId ? siteName || "Site Assessment" : areaName;
  const headerSub = siteId
    ? "Specific Site Assessment"
    : "General Area Assessment";

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#0F4A2F" />
        <Text style={styles.loadingText}>Loading assessment layers…</Text>
      </View>
    );
  }

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
          <Text style={styles.headerSub}>{headerSub}</Text>
        </View>

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

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ✅ REPLACED: Summary Statistics Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Text style={styles.summaryTitle}>Assessment Summary</Text>
            <Text style={styles.summarySubtitle}>
              {isOfflineMode ? "Local data only" : "Live sync active"}
            </Text>
          </View>
          
          <View style={styles.statsGrid}>
            {/* Submitted */}
            <View style={styles.statBox}>
              <View style={[styles.statIconWrap, { backgroundColor: "rgba(95, 208, 138, 0.2)" }]}>
                <Ionicons name="checkmark-circle" size={20} color="#5FD08A" />
              </View>
              <View>
                <Text style={styles.statValue}>{submittedCount}</Text>
                <Text style={styles.statLabel}>Submitted</Text>
              </View>
            </View>

            {/* Saved Offline */}
            <View style={styles.statBox}>
              <View style={[styles.statIconWrap, { backgroundColor: "rgba(245, 158, 11, 0.2)" }]}>
                <Ionicons name="cloud-download" size={20} color="#F59E0B" />
              </View>
              <View>
                <Text style={styles.statValue}>{offlineDrafts.length}</Text>
                <Text style={styles.statLabel}>Saved Offline</Text>
              </View>
            </View>

            {/* In Progress */}
            <View style={styles.statBox}>
              <View style={[styles.statIconWrap, { backgroundColor: "rgba(59, 130, 246, 0.2)" }]}>
                <Ionicons name="create" size={20} color="#3B82F6" />
              </View>
              <View>
                <Text style={styles.statValue}>{draftCount}</Text>
                <Text style={styles.statLabel}>In Progress</Text>
              </View>
            </View>

            {/* Pending */}
            <View style={styles.statBox}>
              <View style={[styles.statIconWrap, { backgroundColor: "rgba(156, 163, 175, 0.2)" }]}>
                <Ionicons name="time" size={20} color="#9CA3AF" />
              </View>
              <View>
                <Text style={styles.statValue}>{pendingCount}</Text>
                <Text style={styles.statLabel}>Pending</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Assessment Layers</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{LAYERS.length} Layers</Text>
          </View>
        </View>

        <View style={styles.grid}>
          {LAYERS.map((layer) => {
            const status = getStatus(layer.id);
            const submittedCnt = getCount(layer.id, true);
            const draftCnt = getCount(layer.id, false);
            const Icon = layer.icon;

            return (
              <TouchableOpacity
                key={layer.id}
                style={[
                  styles.card,
                  status === "draft" && styles.cardDraft,
                  status === "done" && styles.cardDone,
                ]}
                onPress={() => handleLayerPress(layer.id, layer.label)}
                activeOpacity={0.75}
              >
                <View
                  style={[styles.cardAccent, { backgroundColor: layer.color }]}
                />
                <View style={styles.cardInner}>
                  <View
                    style={[styles.iconCircle, { backgroundColor: layer.bg }]}
                  >
                    <Icon size={22} color={layer.color} strokeWidth={2} />
                  </View>
                  <Text style={styles.cardLabel} numberOfLines={2}>
                    {layer.label}
                  </Text>
                  <View style={styles.cardFooter}>
                    {status === "done" && (
                      <View style={styles.badgeDone}>
                        <Ionicons
                          name="checkmark-circle"
                          size={11}
                          color="#15803D"
                        />
                        <Text style={styles.badgeDoneText}>
                          {submittedCnt} Submitted
                        </Text>
                      </View>
                    )}
                    {status === "draft" && (
                      <View style={styles.badgeDraft}>
                        <Ionicons
                          name="create-outline"
                          size={11}
                          color="#92400E"
                        />
                        <Text style={styles.badgeDraftText}>
                          {draftCnt} Draft{draftCnt > 1 ? "s" : ""}
                        </Text>
                      </View>
                    )}
                    {status === "pending" && (
                      <Text style={styles.pendingText}>Tap to start</Text>
                    )}
                    <Ionicons
                      name="chevron-forward"
                      size={13}
                      color="#9CA3AF"
                    />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.infoBanner}>
          <View style={styles.infoBannerIcon}>
            <MaterialCommunityIcons
              name="information-outline"
              size={18}
              color="#0F4A2F"
            />
          </View>
          <Text style={styles.infoText}>
            {isOfflineMode
              ? `You have ${offlineDrafts.length} offline draft(s). They will sync when back online.`
              : siteId
                ? "Complete all four layers for this specific site."
                : "Complete all four layers for this general area."}
          </Text>
        </View>
      </ScrollView>
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
  headerSub: { fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 1 },
  
  scroll: { flex: 1 },
  content: { padding: 16 },

  // ✅ NEW: Summary Card Styles
  summaryCard: {
    backgroundColor: "#0F4A2F",
    borderRadius: 18,
    padding: 18,
    marginBottom: 20,
  },
  summaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 14,
    color: "#FFFFFF",
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  summarySubtitle: {
    fontSize: 11,
    color: "rgba(255,255,255,0.5)",
    fontWeight: "500",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statBox: {
    flex: 1,
    minWidth: "47%",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: 12,
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FFFFFF",
    lineHeight: 24,
  },
  statLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.6)",
    fontWeight: "500",
  },

  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#0F2D1C" },
  countBadge: {
    backgroundColor: "#E6F4EC",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countText: { fontSize: 11, color: "#0F4A2F", fontWeight: "700" },
  
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 16 },
  card: {
    width: "47%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    overflow: "hidden",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  cardDraft: {
    borderColor: "#FCD34D",
    borderWidth: 1.5,
    backgroundColor: "#FFFBEB",
  },
  cardDone: {
    borderColor: "#86EFAC",
    borderWidth: 1.5,
    backgroundColor: "#F0FDF4",
  },
  cardAccent: { height: 4, width: "100%" },
  cardInner: { padding: 14 },
  iconCircle: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F2D1C",
    marginBottom: 8,
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  badgeDone: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeDoneText: { fontSize: 10, color: "#15803D", fontWeight: "700" },
  badgeDraft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeDraftText: { fontSize: 10, color: "#92400E", fontWeight: "700" },
  pendingText: { fontSize: 11, color: "#9CA3AF", fontStyle: "italic" },
  
  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#E6F4EC",
    borderRadius: 12,
    padding: 14,
  },
  infoBannerIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  infoText: { flex: 1, fontSize: 12, color: "#0F4A2F", lineHeight: 18 },
});