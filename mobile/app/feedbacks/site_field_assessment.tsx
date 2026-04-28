import { useRouter, useLocalSearchParams } from "expo-router";
import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, ActivityIndicator,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/constants/url_fixed";
import {
  HardHat, Scale, Sprout, Database,
} from "lucide-react-native";

const API = api + "/api";

/* ---------- LAYERS ---------- */

export const LAYERS = [
  { id: "meta_data",            label: "Meta Data",             icon: Database, color: "#8B5CF6", bg: "#F5F3FF" },
  { id: "safety",               label: "Safety",                icon: HardHat,  color: "#EF4444", bg: "#FEF2F2" },
  { id: "boundary_verification",label: "Boundary Verification", icon: Scale,    color: "#3B82F6", bg: "#EFF6FF" },
  { id: "survivability",        label: "Survivability",         icon: Sprout,   color: "#16A34A", bg: "#F0FDF4" },
];

type LayerStatus = "done" | "draft" | "pending";

/* ---------- SCREEN ---------- */

export default function SiteFieldAssessment() {
  const { areaId, areaName } = useLocalSearchParams<{ areaId: string; areaName: string }>();
  const [assessments, setAssessments] = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const router   = useRouter();
  const insets   = useSafeAreaInsets();

  useEffect(() => { fetchAssessments(); }, []);

  const fetchAssessments = async () => {
    try {
      const token = await SecureStore.getItemAsync("token");
      const res = await fetch(
        `${API}/field_assessments/?reforestation_area_id=${areaId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.ok) setAssessments(await res.json());
    } catch {
      Alert.alert("Error", "Failed to load assessments.");
    } finally {
      setLoading(false);
    }
  };

  const getStatus = (layerId: string): LayerStatus => {
    const list = assessments.filter((a) => a.layer === layerId);
    if (list.some((a) => a.is_submitted))  return "done";
    if (list.some((a) => !a.is_submitted)) return "draft";
    return "pending";
  };

  const getCount = (layerId: string, submitted: boolean) =>
    assessments.filter((a) => a.layer === layerId && a.is_submitted === submitted).length;

  const completedCount = LAYERS.filter((l) => getStatus(l.id) === "done").length;
  const progressPct    = (completedCount / LAYERS.length) * 100;

  const handleLayerPress = (layerId: string, layerName: string) => {
    router.push({
      pathname: "/feedbacks/layer_assessment_list",
      params: { areaId, areaName, layerId, layerName },
    });
  };

  /* ---- Loading ---- */
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

      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{areaName}</Text>
          <Text style={styles.headerSub}>Field Assessment</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Progress Card ── */}
        <View style={styles.progressCard}>
          <View style={styles.progressRow}>
            <View>
              <Text style={styles.progressLabel}>Overall Progress</Text>
              <Text style={styles.progressSub}>
                {completedCount} of {LAYERS.length} layers submitted
              </Text>
            </View>
            <Text style={styles.progressPct}>{Math.round(progressPct)}%</Text>
          </View>

          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${progressPct}%` as any }]} />
          </View>

          {/* Layer dots */}
          <View style={styles.dotRow}>
            {LAYERS.map((l) => {
              const s = getStatus(l.id);
              return (
                <View key={l.id} style={styles.dotItem}>
                  <View style={[
                    styles.dot,
                    s === "done"  && { backgroundColor: "#5FD08A" },
                    s === "draft" && { backgroundColor: "#F59E0B" },
                    s === "pending" && { backgroundColor: "rgba(255,255,255,0.25)" },
                  ]} />
                  <Text style={styles.dotLabel}>{l.label.split(" ")[0]}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* ── Layer Grid ── */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Assessment Layers</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{LAYERS.length} Layers</Text>
          </View>
        </View>

        <View style={styles.grid}>
          {LAYERS.map((layer) => {
            const status        = getStatus(layer.id);
            const submittedCnt  = getCount(layer.id, true);
            const draftCnt      = getCount(layer.id, false);
            const Icon          = layer.icon;

            return (
              <TouchableOpacity
                key={layer.id}
                style={[
                  styles.card,
                  status === "draft" && styles.cardDraft,
                  status === "done"  && styles.cardDone,
                ]}
                onPress={() => handleLayerPress(layer.id, layer.label)}
                activeOpacity={0.75}
              >
                {/* Colored top accent */}
                <View style={[styles.cardAccent, { backgroundColor: layer.color }]} />

                <View style={styles.cardInner}>
                  {/* Icon */}
                  <View style={[styles.iconCircle, { backgroundColor: layer.bg }]}>
                    <Icon size={22} color={layer.color} strokeWidth={2} />
                  </View>

                  {/* Label */}
                  <Text style={styles.cardLabel} numberOfLines={2}>{layer.label}</Text>

                  {/* Status badge */}
                  <View style={styles.cardFooter}>
                    {status === "done" && (
                      <View style={styles.badgeDone}>
                        <Ionicons name="checkmark-circle" size={11} color="#15803D" />
                        <Text style={styles.badgeDoneText}>{submittedCnt} Submitted</Text>
                      </View>
                    )}
                    {status === "draft" && (
                      <View style={styles.badgeDraft}>
                        <Ionicons name="create-outline" size={11} color="#92400E" />
                        <Text style={styles.badgeDraftText}>{draftCnt} Draft</Text>
                      </View>
                    )}
                    {status === "pending" && (
                      <Text style={styles.pendingText}>Tap to start</Text>
                    )}
                    <Ionicons name="chevron-forward" size={13} color="#9CA3AF" />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Info Banner ── */}
        <View style={styles.infoBanner}>
          <View style={styles.infoBannerIcon}>
            <MaterialCommunityIcons name="information-outline" size={18} color="#0F4A2F" />
          </View>
          <Text style={styles.infoText}>
            Complete all four layers before submitting to the GIS Specialist.
            Meta Data combines permits, security, and site context.
          </Text>
        </View>

      </ScrollView>
    </View>
  );
}

/* ---------- STYLES ---------- */

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F4F7F5" },

  /* Loading */
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

  /* Scroll */
  scroll:   { flex: 1 },
  content:  { padding: 16 },

  /* Progress card */
  progressCard: {
    backgroundColor: "#0F4A2F",
    borderRadius: 18,
    padding: 18,
    marginBottom: 20,
  },
  progressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  progressLabel: { fontSize: 13, color: "#B7D3C6", fontWeight: "600" },
  progressSub:   { fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 2 },
  progressPct:   { fontSize: 26, fontWeight: "800", color: "#FFFFFF" },
  progressBg: {
    height: 6, backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 3, overflow: "hidden", marginBottom: 14,
  },
  progressFill: { height: "100%", backgroundColor: "#5FD08A", borderRadius: 3 },
  dotRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  dotItem:  { alignItems: "center", gap: 4 },
  dot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  dotLabel: { fontSize: 9, color: "rgba(255,255,255,0.5)", fontWeight: "600" },

  /* Section row */
  sectionRow: {
    flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12,
  },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#0F2D1C" },
  countBadge: {
    backgroundColor: "#E6F4EC",
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10,
  },
  countText: { fontSize: 11, color: "#0F4A2F", fontWeight: "700" },

  /* Layer card grid */
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 16,
  },
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
  cardInner:  { padding: 14 },
  iconCircle: {
    width: 46, height: 46, borderRadius: 14,
    justifyContent: "center", alignItems: "center",
    marginBottom: 10,
  },
  cardLabel: {
    fontSize: 13, fontWeight: "700", color: "#0F2D1C",
    marginBottom: 8, lineHeight: 18,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  badgeDone: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10,
  },
  badgeDoneText: { fontSize: 10, color: "#15803D", fontWeight: "700" },
  badgeDraft: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10,
  },
  badgeDraftText: { fontSize: 10, color: "#92400E", fontWeight: "700" },
  pendingText:    { fontSize: 11, color: "#9CA3AF", fontStyle: "italic" },

  /* Info banner */
  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#E6F4EC",
    borderRadius: 12,
    padding: 14,
  },
  infoBannerIcon: {
    width: 30, height: 30, borderRadius: 10,
    backgroundColor: "#FFFFFF",
    justifyContent: "center", alignItems: "center",
    flexShrink: 0,
  },
  infoText: {
    flex: 1, fontSize: 12, color: "#0F4A2F", lineHeight: 18,
  },
});
