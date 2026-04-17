import { useRouter, useLocalSearchParams } from "expo-router";
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import { api } from "@/constants/url_fixed";
import {
  PlusCircle,
  CheckCircle,
  Edit3,
  HardHat,
  Scale,
  Sprout,
  Database, // ✅ New icon for Meta Data
} from "lucide-react-native";

const API = api + "/api";

// ✅ Updated to 4 layers: Safety, Boundary Verification, Meta Data, Survivability
export const LAYERS = [
   { 
    id: "meta_data",  // ✅ NEW: Combined pre-assessment fields
    label: "Meta Data", 
    icon: Database, 
    color: "#8b5cf6"  // Purple to distinguish
  },
  { id: "safety", label: "Safety", icon: HardHat, color: "#ef4444" },
  { 
    id: "boundary_verification",
    label: "Boundary Verification", 
    icon: Scale, 
    color: "#3b82f6" 
  },
 
  { id: "survivability", label: "Survivability", icon: Sprout, color: "#16a34a" },
];

export default function SiteFieldAssessment() {
  const { areaId, areaName } = useLocalSearchParams<{
    areaId: string;
    areaName: string;
  }>();

  const [assessments, setAssessments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchAssessments();
  }, []);

  const fetchAssessments = async () => {
    try {
      const token = await SecureStore.getItemAsync("token");
      const res = await fetch(
        `${API}/field_assessments/?reforestation_area_id=${areaId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.ok) setAssessments(await res.json());
    } catch (err) {
      Alert.alert("Error", "Failed to load assessments");
    } finally {
      setLoading(false);
    }
  };

  const getLayerStatus = (layerId: string) => {
    const layerAssessments = assessments.filter((a) => a.layer === layerId);
    if (layerAssessments.some((a) => a.is_submitted)) return "done";
    if (layerAssessments.some((a) => !a.is_submitted)) return "draft";
    return "pending";
  };

  const handleLayerPress = (layerId: string, layerName: string) => {
    router.push({
      pathname: "/feedbacks/layer_assessment_list",
      params: { areaId, areaName, layerId, layerName },
    });
  };

  if (loading) {
    return (
      <View style={styles.centerContent}>
        <ActivityIndicator size="large" color="#0F4A2F" />
        <Text style={styles.loadingText}>Loading assessment layers...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.areaName}>{areaName}</Text>
        <Text style={styles.areaSubtitle}>Field Assessment</Text>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Info Banner - ✅ Updated for 4 layers */}
        <View style={styles.infoBanner}>
          <Text style={styles.infoBannerTitle}>4-Layer MCDA Assessment</Text>
          <Text style={styles.infoBannerText}>
            Complete all four layers — Safety, Boundary Verification, Meta Data, and Survivability —
            before submitting to the GIS Specialist. Meta Data combines permits, security, and site context.
          </Text>
        </View>

        {/* Layer Cards - ✅ Now renders 4 cards automatically */}
        <Text style={styles.sectionTitle}>Assessment Layers</Text>
        <View style={styles.grid}>
          {LAYERS.map((layer) => {
            const status = getLayerStatus(layer.id);
            const submittedCount = assessments.filter(
              (a) => a.layer === layer.id && a.is_submitted,
            ).length;
            const draftCount = assessments.filter(
              (a) => a.layer === layer.id && !a.is_submitted,
            ).length;

            return (
              <TouchableOpacity
                key={layer.id}
                style={[
                  styles.layerCard,
                  status === "draft" && styles.layerCardDraft,
                  status === "done" && styles.layerCardDone,
                ]}
                onPress={() => handleLayerPress(layer.id, layer.label)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.iconBox,
                    { backgroundColor: `${layer.color}15` },
                  ]}
                >
                  <layer.icon size={24} color={layer.color} strokeWidth={2} />
                </View>
                <Text style={styles.layerLabel}>{layer.label}</Text>
                <View style={styles.statusRow}>
                  {status === "done" && (
                    <View style={styles.badgeDone}>
                      <CheckCircle size={12} color="#155724" />
                      <Text style={styles.badgeTextDone}>
                        {submittedCount} Submitted
                      </Text>
                    </View>
                  )}
                  {status === "draft" && (
                    <View style={styles.badgeDraft}>
                      <Edit3 size={12} color="#856404" />
                      <Text style={styles.badgeTextDraft}>
                        {draftCount} Draft
                      </Text>
                    </View>
                  )}
                  {status === "pending" && (
                    <Text style={styles.pendingText}>Tap to start</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  centerContent: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 10, color: "#64748b" },
  header: {
    backgroundColor: "#fff",
    padding: 16,
    paddingTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  areaName: { fontSize: 18, fontWeight: "bold", color: "#0f172a" },
  areaSubtitle: { fontSize: 13, color: "#64748b", marginTop: 2 },
  content: { flex: 1 },
  contentContainer: { paddingHorizontal: 16, paddingBottom: 40 },
  infoBanner: {
    backgroundColor: "#f5f3ff", // ✅ Purple tint for Meta Data theme
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#c4b5fd",
  },
  infoBannerTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#5b21b6", // ✅ Darker purple
    marginBottom: 4,
  },
  infoBannerText: { fontSize: 13, color: "#6d28d9", lineHeight: 18 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#334155",
    marginTop: 20,
    marginBottom: 12,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  layerCard: {
    width: "48%",
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  layerCardDraft: {
    borderColor: "#fbbf24",
    borderWidth: 2,
    backgroundColor: "#fffbeb",
  },
  layerCardDone: {
    borderColor: "#86efac",
    borderWidth: 1,
    backgroundColor: "#f0fdf4",
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  layerLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1e293b",
    textAlign: "center",
    marginBottom: 8,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  badgeDone: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#dcfce7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  badgeTextDone: { fontSize: 10, color: "#155724", fontWeight: "700" },
  badgeDraft: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef3c7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  badgeTextDraft: { fontSize: 10, color: "#856404", fontWeight: "700" },
  pendingText: { fontSize: 11, color: "#94a3b8", fontStyle: "italic" },
});