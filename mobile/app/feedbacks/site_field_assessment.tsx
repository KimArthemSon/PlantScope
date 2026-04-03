import { useRouter, useLocalSearchParams } from "expo-router";
import React, { useState, useEffect, useMemo } from "react";
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
  MapPin,
  PlusCircle,
  CheckCircle,
  Edit3,
  ArrowLeft,
  HardHat,
  Scale,
  Mountain,
  Sprout,
  Car,
  Droplet,
  PawPrint,
  TreeDeciduous,
} from "lucide-react-native";

const API = api + "/api";

export const LAYERS = [
  { id: "safety", label: "Safety", icon: HardHat, color: "#ef4444" },
  { id: "legality", label: "Legality", icon: Scale, color: "#3b82f6" },
  { id: "slope", label: "Slope", icon: Mountain, color: "#f59e0b" },
  { id: "soil_quality", label: "Soil Quality", icon: Sprout, color: "#84cc16" },
  { id: "accessibility", label: "Accessibility", icon: Car, color: "#06b6d4" },
  { id: "hydrology", label: "Hydrology", icon: Droplet, color: "#0ea5e9" },
  {
    id: "wildlife_status",
    label: "Wildlife",
    icon: PawPrint,
    color: "#d946ef",
  },
  {
    id: "tree_species_suitability",
    label: "Species",
    icon: TreeDeciduous,
    color: "#16a34a",
  },
];

export default function SiteFieldAssessment() {
  const { areaId, areaName } = useLocalSearchParams<{
    areaId: string;
    areaName: string;
  }>();
  const [assessments, setAssessments] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // ✅ NEW: Inline target selection state
  const [showTargetSelector, setShowTargetSelector] = useState(true);
  const [selectedTarget, setSelectedTarget] = useState<{
    id: string | null;
    name: string;
    type: "new" | "existing";
  } | null>(null);

  const router = useRouter();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = await SecureStore.getItemAsync("token");
      const resAssess = await fetch(
        `${API}/get_field_assessments/?reforestation_area_id=${areaId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (resAssess.ok) setAssessments(await resAssess.json());

      const resSites = await fetch(`${API}/get_sites_by_area/${areaId}/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resSites.ok) setSites((await resSites.json()).sites || []);
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  // ✅ Handle target selection (inline, no modal)
  const handleTargetSelect = (
    type: "new" | "existing",
    siteId?: string,
    siteName?: string,
  ) => {
    setSelectedTarget({
      id: type === "new" ? null : siteId,
      name: type === "new" ? "New General Assessment" : siteName || "",
      type,
    });
    setShowTargetSelector(false); // Hide selector, show layers
  };

  // ✅ Navigate to layer list
  const handleLayerPress = (layerId: string, layerName: string) => {
    router.push({
      pathname: "/feedbacks/layer_assessment_list",
      params: {
        areaId,
        areaName,
        layerId,
        layerName,
      },
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

  // ✅ FIXED: Calculate status per layer for the selected target
  // This checks if ANY assessment of this layer type exists for the target,
  // but does NOT mark as "done" unless ALL possible assessments are submitted
  // (which is rare). Instead, we show "draft" if any draft exists, else "pending".
  const getLayerStatus = (layerId: string) => {
    if (!selectedTarget) return "none";

    const targetSiteId =
      selectedTarget.type === "new" ? null : selectedTarget.id;

    // Filter assessments for this layer + target
    const layerAssessments = assessments.filter(
      (a) => a.type === layerId && a.site_id === targetSiteId,
    );

    const hasSubmitted = layerAssessments.some((a) => a.is_sent);
    const hasDraft = layerAssessments.some((a) => !a.is_sent);

    // ✅ Logic:
    // - If there's a submitted assessment → show "done" badge (but still allow creating new ones)
    // - If there's only drafts → show "draft" badge
    // - If no assessments yet → show "pending"
    if (hasSubmitted) return "done"; // At least one is submitted
    if (hasDraft) return "draft"; // Only drafts exist
    return "pending"; // No assessments yet
  };

  // ✅ NEW: Check if user can create a NEW assessment for this layer
  // (They can always create new ones, even if one is already submitted)
  const canCreateNew = (layerId: string) => {
    // Always allow creating new assessments for flexibility
    // (e.g., re-assessment after changes, or assessment for a different time period)
    return true;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.areaName}>{areaName}</Text>
          {selectedTarget && !showTargetSelector && (
            <Text style={styles.areaSubtitle}>Field Assessment</Text>
          )}
        </View>

        {/* ✅ Show "Change Target" button only when target is selected AND selector is hidden */}
        {selectedTarget && !showTargetSelector && (
          <TouchableOpacity
            style={styles.changeTargetBtn}
            onPress={() => setShowTargetSelector(true)}
          >
            <ArrowLeft size={16} color="#fff" />
            <Text style={styles.changeTargetText}>Change</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        {/* ✅ INLINE TARGET SELECTION (replaces modal) */}
        {showTargetSelector && (
          <View style={styles.selectorSection}>
            <Text style={styles.selectorTitle}>Select Assessment Target</Text>
            <Text style={styles.selectorSubtitle}>
              Choose an existing site or create a new proposal
            </Text>

            {/* New General Assessment Option */}
            <TouchableOpacity
              style={[
                styles.selectorOption,
                selectedTarget?.type === "new" && styles.selectorOptionSelected,
              ]}
              onPress={() => handleTargetSelect("new")}
            >
              <View style={[styles.optionIcon, { backgroundColor: "#e0f2fe" }]}>
                <PlusCircle size={24} color="#0284c7" />
              </View>
              <View style={styles.optionTextContainer}>
                <Text
                  style={[
                    styles.optionTitle,
                    selectedTarget?.type === "new" &&
                      styles.optionTitleSelected,
                  ]}
                >
                  New General Assessment
                </Text>
                <Text style={styles.optionDesc}>
                  For new site proposals. No existing Site ID required.
                </Text>
              </View>
              {selectedTarget?.type === "new" && (
                <CheckCircle size={20} color="#0F4A2F" />
              )}
            </TouchableOpacity>

            <Text style={styles.sectionDivider}>
              Existing Sites in this Area
            </Text>

            {/* Existing Sites List */}
            {sites.length === 0 ? (
              <View style={styles.noSitesCard}>
                <MapPin size={32} color="#94a3b8" />
                <Text style={styles.noSitesText}>
                  No existing sites found in this area.
                </Text>
                <Text style={styles.noSitesSubtext}>
                  Select "New General Assessment" to start a proposal.
                </Text>
              </View>
            ) : (
              <View style={styles.sitesGrid}>
                {sites.map((site) => (
                  <TouchableOpacity
                    key={site.site_id}
                    style={[
                      styles.siteCard,
                      selectedTarget?.id === site.site_id.toString() &&
                        styles.siteCardSelected,
                    ]}
                    onPress={() =>
                      handleTargetSelect(
                        "existing",
                        site.site_id.toString(),
                        site.name,
                      )
                    }
                  >
                    <View style={styles.siteCardHeader}>
                      <View
                        style={[
                          styles.siteIcon,
                          { backgroundColor: "#dcfce7" },
                        ]}
                      >
                        <MapPin size={18} color="#16a34a" />
                      </View>
                      <Text style={styles.siteName}>{site.name}</Text>
                    </View>
                    <View style={styles.siteCardFooter}>
                      <Text style={styles.siteId}>ID: {site.site_id}</Text>
                      <View
                        style={[
                          styles.statusBadge,
                          {
                            backgroundColor:
                              site.status === "completed"
                                ? "#dcfce7"
                                : site.status === "official"
                                  ? "#dbeafe"
                                  : site.status === "pending"
                                    ? "#fef3c7"
                                    : "#fee2e2",
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusText,
                            {
                              color:
                                site.status === "completed"
                                  ? "#155724"
                                  : site.status === "official"
                                    ? "#1e40af"
                                    : site.status === "pending"
                                      ? "#856404"
                                      : "#721c24",
                            },
                          ]}
                        >
                          {site.status}
                        </Text>
                      </View>
                    </View>
                    {selectedTarget?.id === site.site_id.toString() && (
                      <View style={styles.selectedOverlay}>
                        <CheckCircle size={16} color="#0F4A2F" />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {/* ✅ TARGET BANNER + ASSESSMENT LAYERS (only shown when target selected & selector hidden) */}
        {selectedTarget && !showTargetSelector && (
          <>
            {/* Target Banner - Always visible when target is selected */}
            <View style={styles.targetBanner}>
              <View style={styles.targetIconBox}>
                {selectedTarget.type === "new" ? (
                  <PlusCircle size={20} color="#0F4A2F" />
                ) : (
                  <MapPin size={20} color="#0F4A2F" />
                )}
              </View>
              <View style={styles.targetInfo}>
                <Text style={styles.targetLabel}>Assessing:</Text>
                <Text style={styles.targetName}>{selectedTarget.name}</Text>
              </View>
            </View>

            {/* Assessment Layers Grid */}
            <Text style={styles.sectionTitle}>Assessment Layers</Text>
            <View style={styles.grid}>
              {LAYERS.map((layer) => {
                const status = getLayerStatus(layer.id);

                // ✅ FIXED: Don't disable the card just because one assessment is submitted
                // Users can always create new assessments or view existing ones
                const isDisabled = false; // Never fully disable; let LayerAssessmentList handle logic

                return (
                  <TouchableOpacity
                    key={layer.id}
                    style={[
                      styles.layerCard,
                      status === "draft" && styles.layerCardDraft,
                      status === "done" && styles.layerCardDone,
                      // Remove disabled styling since we always allow navigation
                    ]}
                    onPress={() => handleLayerPress(layer.id, layer.label)}
                    // ✅ Always allow tap; LayerAssessmentList will show drafts/submitted list
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.iconBox,
                        { backgroundColor: `${layer.color}15` },
                      ]}
                    >
                      {/* ✅ Correct: Render Lucide component */}
                      <layer.icon
                        size={24}
                        color={layer.color}
                        strokeWidth={2}
                      />
                    </View>
                    <Text style={styles.layerLabel}>{layer.label}</Text>
                    <View style={styles.statusRow}>
                      {status === "done" && (
                        <View style={styles.badgeDone}>
                          <CheckCircle size={12} color="#155724" />
                          <Text style={styles.badgeTextDone}>
                            {
                              assessments.filter(
                                (a) =>
                                  a.type === layer.id &&
                                  a.site_id ===
                                    (selectedTarget?.type === "new"
                                      ? null
                                      : selectedTarget?.id) &&
                                  a.is_sent,
                              ).length
                            }{" "}
                            Submitted
                          </Text>
                        </View>
                      )}
                      {status === "draft" && (
                        <View style={styles.badgeDraft}>
                          <Edit3 size={12} color="#856404" />
                          <Text style={styles.badgeTextDraft}>
                            {
                              assessments.filter(
                                (a) =>
                                  a.type === layer.id &&
                                  a.site_id ===
                                    (selectedTarget?.type === "new"
                                      ? null
                                      : selectedTarget?.id) &&
                                  !a.is_sent,
                              ).length
                            }{" "}
                            Draft
                          </Text>
                        </View>
                      )}
                      {status === "pending" && (
                        <Text style={styles.statusText}>Tap to start</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {/* Empty state when no target selected and selector hidden (edge case) */}
        {!selectedTarget && !showTargetSelector && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No target selected</Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => setShowTargetSelector(true)}
            >
              <Text style={styles.emptyBtnText}>Select Target</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  centerContent: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 10, color: "#64748b" },

  // Header
  header: {
    backgroundColor: "#fff",
    padding: 16,
    paddingTop: 50,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  headerLeft: {
    flex: 1,
  },
  areaName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#0f172a",
  },
  areaSubtitle: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 2,
  },
  changeTargetBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0F4A2F",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  changeTargetText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 13,
  },

  // Content
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },

  // ✅ Inline Target Selector Section
  selectorSection: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  selectorTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#0f172a",
    marginBottom: 4,
  },
  selectorSubtitle: {
    fontSize: 13,
    color: "#64748b",
    marginBottom: 20,
  },
  selectorOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#fff",
    marginBottom: 12,
  },
  selectorOptionSelected: {
    borderColor: "#0F4A2F",
    backgroundColor: "#f0fdf4",
    borderWidth: 2,
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  optionTextContainer: { flex: 1 },
  optionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0f172a",
  },
  optionTitleSelected: { color: "#0F4A2F" },
  optionDesc: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  sectionDivider: {
    fontSize: 12,
    fontWeight: "600",
    color: "#94a3b8",
    textTransform: "uppercase",
    marginVertical: 16,
    paddingHorizontal: 4,
  },

  // No Sites Card
  noSitesCard: {
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#e2e8f0",
    borderStyle: "dashed",
  },
  noSitesText: {
    color: "#64748b",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 12,
    textAlign: "center",
  },
  noSitesSubtext: {
    color: "#94a3b8",
    fontSize: 12,
    marginTop: 4,
    textAlign: "center",
  },

  // Sites Grid
  sitesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -4,
  },
  siteCard: {
    width: "50%",
    padding: 12,
  },
  siteCardSelected: {
    // Visual feedback for selected site
  },
  siteCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 8,
  },
  siteIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  siteName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
    flex: 1,
  },
  siteCardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  siteId: {
    fontSize: 11,
    color: "#94a3b8",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  selectedOverlay: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 2,
  },

  // Target Banner (your existing styles)
  targetBanner: {
    marginVertical: 16,
    padding: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  targetIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#dcfce7",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  targetInfo: { flex: 1 },
  targetLabel: {
    fontSize: 11,
    color: "#64748b",
    textTransform: "uppercase",
    fontWeight: "600",
  },
  targetName: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#0f172a",
    marginTop: 2,
  },

  // Assessment Layers
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#334155",
    marginTop: 8,
    marginBottom: 16,
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
    opacity: 0.9,
  },
  // ✅ Removed layerCardDisabled since we never fully disable cards
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  iconEmoji: { fontSize: 24 },
  layerLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1e293b",
    textAlign: "center",
    marginBottom: 8,
    lineHeight: 18,
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
  statusText: { fontSize: 11, color: "#94a3b8", fontStyle: "italic" },

  // Empty State
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 60,
    padding: 20,
  },
  emptyText: {
    color: "#94a3b8",
    fontSize: 16,
    textAlign: "center",
    marginTop: 16,
    marginBottom: 24,
  },
  emptyBtn: {
    backgroundColor: "#0F4A2F",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyBtnText: { color: "#fff", fontWeight: "600" },
});
