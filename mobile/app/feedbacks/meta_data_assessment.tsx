import { useRouter, useLocalSearchParams } from "expo-router";
import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/constants/url_fixed";

const API_BASE_URL = api + "/api";

/* ---------- TYPES ---------- */

type Assessment = {
  field_assessment_id: number;
  reforestation_area_id: number;
  layer: string;
  layer_display: string;
  assessment_date: string | null;
  is_submitted: boolean;
  image_count: number;
  created_at: string;
  updated_at: string;
};

/* ---------- SCREEN ---------- */

export default function MetaDataAssessment() {
  const { areaId, areaName } = useLocalSearchParams<{ areaId: string; areaName: string }>();
  const router    = useRouter();
  const insets    = useSafeAreaInsets();

  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);

  const fetchAssessments = async () => {
    try {
      const token = await SecureStore.getItemAsync("token");
      const res = await fetch(
        `${API_BASE_URL}/field_assessments/?reforestation_area_id=${areaId}&layer=meta_data`,
        { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } },
      );
      if (!res.ok) throw new Error("Failed to fetch assessments.");
      setAssessments(await res.json());
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Could not load assessments.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchAssessments(); }, [areaId]);

  const handleDelete = (id: number) => {
    Alert.alert("Delete Entry", "This cannot be undone. Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          try {
            const token = await SecureStore.getItemAsync("token");
            await fetch(`${API_BASE_URL}/field_assessments/${id}/delete/`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` },
            });
            fetchAssessments();
          } catch {
            Alert.alert("Error", "Failed to delete entry.");
          }
        },
      },
    ]);
  };

  const drafts    = assessments.filter((i) => !i.is_submitted);
  const submitted = assessments.filter((i) => i.is_submitted);

  /* ---- Card ---- */
  const renderItem = ({ item, index }: { item: Assessment; index: number }) => {
    const isFirstSubmitted = !item.is_submitted
      ? false
      : index === drafts.length;           // first submitted item in merged list

    const dateStr = item.assessment_date
      ? new Date(item.assessment_date).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" })
      : "No date set";

    const createdStr = new Date(item.created_at).toLocaleDateString("en-PH", {
      month: "short", day: "numeric", year: "numeric",
    });

    return (
      <>
        {/* Section label injected before first submitted card */}
        {isFirstSubmitted && (
          <View style={styles.sectionRow}>
            <Text style={styles.sectionLabel}>Submitted History</Text>
            <View style={[styles.sectionBadge, { backgroundColor: "#DCFCE7" }]}>
              <Text style={[styles.sectionBadgeText, { color: "#15803D" }]}>{submitted.length}</Text>
            </View>
          </View>
        )}

        <View style={[styles.card, item.is_submitted && styles.cardSubmitted]}>
          {/* Left accent */}
          <View style={[styles.cardAccent, { backgroundColor: item.is_submitted ? "#22C55E" : "#F59E0B" }]} />

          <View style={styles.cardBody}>
            {/* Top row */}
            <View style={styles.cardTopRow}>
              <Text style={styles.cardTitle} numberOfLines={2}>{item.layer_display}</Text>
              <View style={[
                styles.statusBadge,
                { backgroundColor: item.is_submitted ? "#DCFCE7" : "#FEF3C7" },
              ]}>
                <View style={[
                  styles.statusDot,
                  { backgroundColor: item.is_submitted ? "#22C55E" : "#F59E0B" },
                ]} />
                <Text style={[
                  styles.statusText,
                  { color: item.is_submitted ? "#15803D" : "#92400E" },
                ]}>
                  {item.is_submitted ? "Submitted" : "Draft"}
                </Text>
              </View>
            </View>

            {/* Meta rows */}
            <View style={styles.metaRow}>
              <Ionicons name="calendar-outline" size={13} color="#9CA3AF" />
              <Text style={styles.metaText}>{dateStr}</Text>
            </View>
            <View style={styles.metaRow}>
              <Ionicons name="image-outline" size={13} color="#9CA3AF" />
              <Text style={styles.metaText}>
                {item.image_count} image{item.image_count !== 1 ? "s" : ""} attached
              </Text>
              <Text style={styles.metaDot}>·</Text>
              <Ionicons name="time-outline" size={13} color="#9CA3AF" />
              <Text style={styles.metaText}>Created {createdStr}</Text>
            </View>

            {/* Actions */}
            <View style={styles.cardActions}>
              <TouchableOpacity
                style={styles.editBtn}
                activeOpacity={0.75}
                onPress={() =>
                  router.push(
                    `/feedbacks/meta_data_form?id=${item.field_assessment_id}&areaId=${areaId}`,
                  )
                }
              >
                <Ionicons
                  name={item.is_submitted ? "eye-outline" : "create-outline"}
                  size={14}
                  color="#0F4A2F"
                />
                <Text style={styles.editBtnText}>
                  {item.is_submitted ? "View" : "Edit"}
                </Text>
              </TouchableOpacity>

              {!item.is_submitted && (
                <TouchableOpacity
                  style={styles.deleteBtn}
                  activeOpacity={0.75}
                  onPress={() => handleDelete(item.field_assessment_id)}
                >
                  <Ionicons name="trash-outline" size={14} color="#EF4444" />
                  <Text style={styles.deleteBtnText}>Delete</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </>
    );
  };

  /* ---- Loading ---- */
  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#0F4A2F" />
        <Text style={styles.loadingText}>Loading assessments…</Text>
      </View>
    );
  }

  const mergedList = [...drafts, ...submitted];

  return (
    <View style={styles.root}>

      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{areaName}</Text>
          <Text style={styles.headerSub}>Meta Data Assessment</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={mergedList}
        keyExtractor={(item) => item.field_assessment_id.toString()}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 32 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchAssessments(); }}
            colors={["#0F4A2F"]}
            tintColor="#0F4A2F"
          />
        }
        ListHeaderComponent={
          <View style={styles.listHeader}>
            {/* Stats row */}
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <MaterialCommunityIcons name="file-edit-outline" size={20} color="#F59E0B" />
                <Text style={styles.statValue}>{drafts.length}</Text>
                <Text style={styles.statLabel}>Drafts</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statCard}>
                <MaterialCommunityIcons name="check-circle-outline" size={20} color="#22C55E" />
                <Text style={styles.statValue}>{submitted.length}</Text>
                <Text style={styles.statLabel}>Submitted</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statCard}>
                <MaterialCommunityIcons name="layers-outline" size={20} color="#8B5CF6" />
                <Text style={styles.statValue}>{mergedList.length}</Text>
                <Text style={styles.statLabel}>Total</Text>
              </View>
            </View>

            {/* New entry button */}
            <TouchableOpacity
              style={styles.newEntryBtn}
              activeOpacity={0.85}
              onPress={() => router.push(`/feedbacks/meta_data_form?areaId=${areaId}`)}
            >
              <View style={styles.newEntryIcon}>
                <Ionicons name="add" size={20} color="#FFFFFF" />
              </View>
              <View>
                <Text style={styles.newEntryTitle}>New Meta Data Entry</Text>
                <Text style={styles.newEntrySub}>Start a new assessment record</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.6)" style={{ marginLeft: "auto" }} />
            </TouchableOpacity>

            {/* Drafts section label */}
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
            <MaterialCommunityIcons name="database-outline" size={52} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>No Entries Yet</Text>
            <Text style={styles.emptySub}>Tap "New Meta Data Entry" above to start.</Text>
          </View>
        }
      />
    </View>
  );
}

/* ---------- STYLES ---------- */

const styles = StyleSheet.create({
  root:          { flex: 1, backgroundColor: "#F4F7F5" },
  loadingScreen: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loadingText:   { color: "#6B7280", fontSize: 14 },

  /* Header */
  header: {
    backgroundColor: "#0F4A2F",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingBottom: 14,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.12)",
    justifyContent: "center", alignItems: "center",
  },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle:  { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },
  headerSub:    { fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 1 },

  /* List */
  listContent: { paddingHorizontal: 16 },

  /* List header */
  listHeader: { paddingTop: 16, marginBottom: 4 },

  /* Stats row */
  statsRow: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  statCard:    { flex: 1, alignItems: "center", gap: 4 },
  statDivider: { width: 1, height: 36, backgroundColor: "#F3F4F6" },
  statValue:   { fontSize: 18, fontWeight: "800", color: "#0F2D1C" },
  statLabel:   { fontSize: 10, color: "#9CA3AF", fontWeight: "600" },

  /* New entry button */
  newEntryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#0F4A2F",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    elevation: 3,
    shadowColor: "#0F4A2F", shadowOpacity: 0.3, shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  newEntryIcon: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.18)",
    justifyContent: "center", alignItems: "center",
  },
  newEntryTitle: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },
  newEntrySub:   { fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 1 },

  /* Section row */
  sectionRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginBottom: 10, marginTop: 4,
  },
  sectionLabel:     { fontSize: 13, fontWeight: "700", color: "#0F2D1C" },
  sectionBadge:     { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  sectionBadgeText: { fontSize: 11, fontWeight: "700" },

  /* Card */
  card: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    marginBottom: 12,
    overflow: "hidden",
    elevation: 2,
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  cardSubmitted: { opacity: 0.9 },
  cardAccent:    { width: 4 },
  cardBody:      { flex: 1, padding: 14 },

  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 14, fontWeight: "700", color: "#0F2D1C",
    flex: 1, marginRight: 8,
  },
  statusBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
  },
  statusDot:  { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: "700" },

  metaRow: {
    flexDirection: "row", alignItems: "center",
    gap: 4, marginBottom: 3,
  },
  metaText: { fontSize: 11, color: "#6B7280" },
  metaDot:  { fontSize: 11, color: "#D1D5DB", marginHorizontal: 2 },

  cardActions: {
    flexDirection: "row", gap: 8, marginTop: 12,
    justifyContent: "flex-end",
  },
  editBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    borderWidth: 1.5, borderColor: "#0F4A2F",
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7,
  },
  editBtnText:   { color: "#0F4A2F", fontSize: 12, fontWeight: "600" },
  deleteBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "#FEF2F2",
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7,
  },
  deleteBtnText: { color: "#EF4444", fontSize: 12, fontWeight: "600" },

  /* Empty */
  emptyState: {
    alignItems: "center", paddingTop: 48, gap: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#9CA3AF" },
  emptySub:   { fontSize: 13, color: "#9CA3AF", textAlign: "center" },
});
