import { useRouter, useLocalSearchParams } from "expo-router";
import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator, RefreshControl,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/constants/url_fixed";

const API_BASE = api;

const LAYER_CONFIG: Record<string, { color: string; bg: string; icon: string }> = {
  meta_data: { color: "#8B5CF6", bg: "#F5F3FF", icon: "database-outline" },
  safety: { color: "#EF4444", bg: "#FEF2F2", icon: "shield-alert-outline" },
  boundary_verification: { color: "#3B82F6", bg: "#EFF6FF", icon: "map-search-outline" },
  survivability: { color: "#16A34A", bg: "#F0FDF4", icon: "sprout" },
};

const getLayer = (id: string) => LAYER_CONFIG[id] ?? { color: "#0F4A2F", bg: "#E6F4EC", icon: "layers-outline" };

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

const getFormPath = (layerId: string) =>
  layerId === "meta_data" ? "/feedbacks/meta_data_form" : "/feedbacks/multicriteria_layer_form";

const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });

export default function LayerAssessmentList() {
  // ✅ Extract siteId and siteName
  const { areaId, siteId, areaName, siteName, layerId, layerName } = useLocalSearchParams<{
    areaId: string;
    siteId?: string;
    areaName: string;
    siteName?: string;
    layerId: "safety" | "boundary_verification" | "survivability" | "meta_data";
    layerName: string;
  }>();

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const layer = getLayer(layerId);

  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAssessments = async () => {
    try {
      const token = await SecureStore.getItemAsync("token");
      let url = `${API_BASE}/api/field_assessments/?reforestation_area_id=${areaId}&layer=${layerId}`;
      
      // ✅ CORRECT: ONLY pass site_id if it's a specific site.
      if (siteId) {
        url += `&site_id=${siteId}`;
      }

      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAssessments(Array.isArray(data) ? data : []);
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Could not load assessments.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchAssessments(); }, [areaId, siteId, layerId]);

  const handleDelete = (id: number) => {
    Alert.alert("Delete Draft", "This cannot be undone. Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          try {
            const token = await SecureStore.getItemAsync("token");
            const res = await fetch(`${API_BASE}/api/field_assessments/${id}/delete/`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            fetchAssessments();
          } catch (e: any) { Alert.alert("Error", e.message ?? "Failed to delete."); }
        },
      },
    ]);
  };

  // ✅ UPDATED: Pass siteId to all navigation handlers
  const handleCreateNew = () => {
    console.log(areaId)
    const path = getFormPath(layerId);
    const params: any = { areaId, siteId, isEdit: "false" };
    if (layerId !== "meta_data") { params.layerId = layerId; params.layerName = layerName; }
    router.push({ pathname: path, params });
  };

  const handleEdit = (a: Assessment) => {
     console.log(areaId)
    const path = getFormPath(layerId);
    const params: any = { areaId, siteId, id: a.field_assessment_id.toString(), isEdit: "true" };
    if (layerId !== "meta_data") { params.layerId = layerId; params.layerName = layerName; params.assessmentId = a.field_assessment_id.toString(); }
    router.push({ pathname: path, params });
  };

  const handleView = (a: Assessment) => {
     console.log(areaId)
    const path = getFormPath(layerId);
    const params: any = { areaId, siteId, id: a.field_assessment_id.toString(), isEdit: "false" };
    if (layerId !== "meta_data") { params.layerId = layerId; params.layerName = layerName; params.assessmentId = a.field_assessment_id.toString(); }
    router.push({ pathname: path, params });
  };

  const getLayerStatus = (assessment: Assessment): "done" | "draft" | "pending" => {
    if (assessment.is_submitted) return "done";
    const data = assessment.field_assessment_data || {};
    const layerData = data[layerId];
    if (layerData && Object.keys(layerData).length > 0) return "draft";
    return "pending";
  };

  const drafts = assessments.filter((a) => !a.is_submitted);
  const submitted = assessments.filter((a) => a.is_submitted);
  const merged = [...drafts, ...submitted];

  const renderItem = ({ item, index }: { item: Assessment; index: number }) => {
    const isFirstSubmitted = item.is_submitted && index === drafts.length;
    const hasLoc = item.location?.latitude && item.location?.longitude;

    return (
      <>
        {isFirstSubmitted && (
          <View style={styles.sectionRow}>
            <Text style={styles.sectionLabel}>Submitted History</Text>
            <View style={[styles.sectionBadge, { backgroundColor: "#DCFCE7" }]}>
              <Text style={[styles.sectionBadgeText, { color: "#15803D" }]}>{submitted.length}</Text>
            </View>
          </View>
        )}

        <View style={[styles.card, item.is_submitted && styles.cardSubmitted]}>
          <View style={[styles.cardAccent, { backgroundColor: item.is_submitted ? "#22C55E" : "#F59E0B" }]} />
          <View style={styles.cardBody}>
            <View style={styles.cardTopRow}>
              <View style={[styles.statusBadge, { backgroundColor: item.is_submitted ? "#DCFCE7" : "#FEF3C7" }]}>
                <Ionicons name={item.is_submitted ? "checkmark-circle" : "create-outline"} size={12} color={item.is_submitted ? "#15803D" : "#92400E"} />
                <Text style={[styles.statusText, { color: item.is_submitted ? "#15803D" : "#92400E" }]}>{item.is_submitted ? "Submitted" : "Draft"}</Text>
              </View>
              <Text style={styles.dateText}>{item.assessment_date ? fmtDate(item.assessment_date) : "Date not set"}</Text>
            </View>

            <View style={styles.metaRow}>
              <Ionicons name={hasLoc ? "location" : "location-outline"} size={13} color={hasLoc ? "#0F4A2F" : "#9CA3AF"} />
              {hasLoc ? (
                <Text style={[styles.metaText, { color: "#0F4A2F" }]}>
                  {item.location.latitude.toFixed(4)}, {item.location.longitude.toFixed(4)}
                </Text>
              ) : (
                <Text style={[styles.metaText, { fontStyle: "italic" }]}>No GPS recorded</Text>
              )}
            </View>

            <View style={styles.metaRow}>
              {item.image_count > 0 && (
                <>
                  <Ionicons name="image-outline" size={13} color="#9CA3AF" />
                  <Text style={styles.metaText}>{item.image_count} photo{item.image_count > 1 ? "s" : ""}</Text>
                  <Text style={styles.metaDot}>·</Text>
                </>
              )}
              <Ionicons name="time-outline" size={13} color="#9CA3AF" />
              <Text style={styles.metaText}>Created {fmtDate(item.created_at)}</Text>
            </View>

            <View style={styles.cardActions}>
              {item.is_submitted ? (
                <TouchableOpacity style={styles.viewBtn} onPress={() => handleView(item)} activeOpacity={0.75}>
                  <Ionicons name="eye-outline" size={14} color="#0F4A2F" />
                  <Text style={styles.viewBtnText}>View</Text>
                </TouchableOpacity>
              ) : (
                <>
                  <TouchableOpacity style={styles.editBtn} onPress={() => handleEdit(item)} activeOpacity={0.75}>
                    <Ionicons name="create-outline" size={14} color="#0F4A2F" />
                    <Text style={styles.editBtnText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item.field_assessment_id)} activeOpacity={0.75}>
                    <Ionicons name="trash-outline" size={14} color="#EF4444" />
                    <Text style={styles.deleteBtnText}>Delete</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </View>
      </>
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

  // ✅ DYNAMIC HEADER
  const headerTitle = siteId ? (siteName || "Site") : areaName;
  const headerSubText = siteId ? `${layerName} Layer (Site)` : `${layerName} Layer (Area)`;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{headerTitle}</Text>
          <View style={styles.headerSubRow}>
            <View style={[styles.layerDot, { backgroundColor: layer.color }]} />
            <Text style={styles.headerSub}>{headerSubText}</Text>
          </View>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={merged}
        keyExtractor={(item) => item.field_assessment_id.toString()}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 32 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAssessments(); }} colors={["#0F4A2F"]} tintColor="#0F4A2F" />}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <View style={[styles.statIcon, { backgroundColor: "#FEF3C7" }]}><Ionicons name="create-outline" size={16} color="#F59E0B" /></View>
                <Text style={styles.statValue}>{drafts.length}</Text>
                <Text style={styles.statLabel}>Drafts</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <View style={[styles.statIcon, { backgroundColor: "#DCFCE7" }]}><Ionicons name="checkmark-circle-outline" size={16} color="#22C55E" /></View>
                <Text style={styles.statValue}>{submitted.length}</Text>
                <Text style={styles.statLabel}>Submitted</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <View style={[styles.statIcon, { backgroundColor: layer.bg }]}><MaterialCommunityIcons name={layer.icon as any} size={16} color={layer.color} /></View>
                <Text style={styles.statValue}>{merged.length}</Text>
                <Text style={styles.statLabel}>Total</Text>
              </View>
            </View>

            <TouchableOpacity style={[styles.newBtn, { shadowColor: layer.color }]} onPress={handleCreateNew} activeOpacity={0.85}>
              <View style={[styles.newBtnIcon, { backgroundColor: "rgba(255,255,255,0.18)" }]}><Ionicons name="add" size={20} color="#FFFFFF" /></View>
              <View style={styles.newBtnText}>
                <Text style={styles.newBtnTitle}>New {layerName} Entry</Text>
                <Text style={styles.newBtnSub}>Start a new assessment record</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>

            {drafts.length > 0 && (
              <View style={styles.sectionRow}>
                <Text style={styles.sectionLabel}>Drafts</Text>
                <View style={[styles.sectionBadge, { backgroundColor: "#FEF3C7" }]}>
                  <Text style={[styles.sectionBadgeText, { color: "#92400E" }]}>{drafts.length}</Text>
                </View>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: layer.bg }]}>
              <MaterialCommunityIcons name={layer.icon as any} size={36} color={layer.color} />
            </View>
            <Text style={styles.emptyTitle}>No {layerName} Assessments</Text>
            <Text style={styles.emptySub}>Tap "New {layerName} Entry" above to start your first assessment.</Text>
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
  loadingScreen: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loadingText: { color: "#6B7280", fontSize: 14 },
  header: { backgroundColor: "#0F4A2F", flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingBottom: 14 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.12)", justifyContent: "center", alignItems: "center" },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },
  headerSubRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  layerDot: { width: 7, height: 7, borderRadius: 4 },
  headerSub: { fontSize: 11, color: "rgba(255,255,255,0.6)" },
  listContent: { paddingHorizontal: 16 },
  listHeader: { paddingTop: 16, marginBottom: 4 },
  statsRow: { flexDirection: "row", backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, marginBottom: 14, alignItems: "center", elevation: 2, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  statItem: { flex: 1, alignItems: "center", gap: 5 },
  statIcon: { width: 32, height: 32, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  statDivider: { width: 1, height: 40, backgroundColor: "#F3F4F6" },
  statValue: { fontSize: 18, fontWeight: "800", color: "#0F2D1C" },
  statLabel: { fontSize: 10, color: "#9CA3AF", fontWeight: "600" },
  newBtn: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: "#0F4A2F", borderRadius: 16, padding: 16, marginBottom: 20, elevation: 3, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  newBtnIcon: { width: 38, height: 38, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  newBtnText: { flex: 1 },
  newBtnTitle: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },
  newBtnSub: { fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 1 },
  sectionRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10, marginTop: 2 },
  sectionLabel: { fontSize: 13, fontWeight: "700", color: "#0F2D1C" },
  sectionBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  sectionBadgeText: { fontSize: 11, fontWeight: "700" },
  card: { flexDirection: "row", backgroundColor: "#FFFFFF", borderRadius: 16, marginBottom: 12, overflow: "hidden", elevation: 2, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  cardSubmitted: { opacity: 0.92 },
  cardAccent: { width: 4 },
  cardBody: { flex: 1, padding: 14 },
  cardTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusText: { fontSize: 10, fontWeight: "700" },
  dateText: { fontSize: 11, color: "#6B7280" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 3, flexWrap: "wrap" },
  metaText: { fontSize: 11, color: "#6B7280" },
  metaDot: { fontSize: 11, color: "#D1D5DB", marginHorizontal: 2 },
  cardActions: { flexDirection: "row", gap: 8, marginTop: 12, justifyContent: "flex-end" },
  viewBtn: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1.5, borderColor: "#0F4A2F", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  viewBtnText: { color: "#0F4A2F", fontSize: 12, fontWeight: "600" },
  editBtn: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1.5, borderColor: "#0F4A2F", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  editBtnText: { color: "#0F4A2F", fontSize: 12, fontWeight: "600" },
  deleteBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#FEF2F2", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  deleteBtnText: { color: "#EF4444", fontSize: 12, fontWeight: "600" },
  emptyState: { alignItems: "center", paddingTop: 48, gap: 10 },
  emptyIcon: { width: 72, height: 72, borderRadius: 20, justifyContent: "center", alignItems: "center", marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#6B7280" },
  emptySub: { fontSize: 13, color: "#9CA3AF", textAlign: "center", lineHeight: 18, paddingHorizontal: 20 },
});