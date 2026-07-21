import React, { useState, useEffect } from "react";
import { useRouter } from "expo-router";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/constants/url_fixed";

const PRIMARY = "#0F4A2F";
const INK = "#111827";
const MUTED = "#6B7280";
const WHITE = "#FFFFFF";
const BG = "#F4F7F5";

interface ProgressReportSpeciesItem {
  species_id: number;
  species_name: string;
  no_survived: number;
  no_dead: number;
  total: number;
  survival_rate: number;
}

interface ProgressReport {
  report_id: number;
  total_survived: number;
  total_dead: number;
  species: ProgressReportSpeciesItem[];
  description: string | null;
  status: "pending" | "accepted" | "rejected";
  proof_image: string | null;
  submitted_at: string | null;
  created_at: string;
}

const statusConfig = {
  pending: { label: "Pending Review", bg: "#FFF8E1", text: "#F57F17", dot: "#F9A825" },
  accepted: { label: "Verified", bg: "#E8F5E9", text: "#2E7D32", dot: "#388E3C" },
  rejected: { label: "Rejected", bg: "#FFEBEE", text: "#C62828", dot: "#D32F2F" },
};

const formatDate = (iso: string) =>
  !iso ? "—" : new Date(iso).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });

export default function ProgressReportsPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [reports, setReports] = useState<ProgressReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ProgressReport | null>(null);

  const fetchData = async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      const token = await SecureStore.getItemAsync("token");
      if (!token) return;

      const res = await fetch(`${api}/api/get_tree_grower_application/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setReports(data.progress_reports || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const totalSurvived = reports.reduce((sum, r) => sum + r.total_survived, 0);
  const totalDead = reports.reduce((sum, r) => sum + r.total_dead, 0);
  const totalPlanted = totalSurvived + totalDead;
  const overallSurvivalRate = totalPlanted > 0 ? ((totalSurvived / totalPlanted) * 100).toFixed(1) : "0.0";

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={PRIMARY} />
        <Text style={styles.loadingText}>Loading reports…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={INK} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Progress Reports</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(true); }} tintColor={PRIMARY} />
        }
      >
        {/* Overall Stats */}
        {reports.length > 0 && (
          <View style={styles.statsBanner}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{totalSurvived.toLocaleString()}</Text>
              <Text style={styles.statLabel}>Survived</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: "#C62828" }]}>{totalDead.toLocaleString()}</Text>
              <Text style={styles.statLabel}>Dead</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: PRIMARY }]}>{overallSurvivalRate}%</Text>
              <Text style={styles.statLabel}>Survival Rate</Text>
            </View>
          </View>
        )}

        {/* Reports List */}
        {reports.length > 0 ? (
          <View style={styles.reportsList}>
            {reports.map((report, index) => {
              const conf = statusConfig[report.status] || statusConfig.pending;
              return (
                <TouchableOpacity
                  key={report.report_id}
                  style={styles.reportCard}
                  onPress={() => setSelectedReport(report)}
                  activeOpacity={0.8}
                >
                  {/* Card Header */}
                  <View style={styles.reportCardHeader}>
                    <View>
                      <Text style={styles.reportId}>Report #{report.report_id}</Text>
                      <Text style={styles.reportDate}>{formatDate(report.submitted_at || report.created_at)}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: conf.bg }]}>
                      <View style={[styles.statusDot, { backgroundColor: conf.dot }]} />
                      <Text style={[styles.statusText, { color: conf.text }]}>{conf.label}</Text>
                    </View>
                  </View>

                  {/* Mini Metrics */}
                  <View style={styles.miniMetrics}>
                    <View style={styles.miniMetric}>
                      <Ionicons name="heart" size={14} color="#2E7D32" />
                      <Text style={styles.miniMetricVal}>{report.total_survived.toLocaleString()}</Text>
                      <Text style={styles.miniMetricLabel}>Survived</Text>
                    </View>
                    <View style={styles.miniMetric}>
                      <Ionicons name="close-circle" size={14} color="#C62828" />
                      <Text style={[styles.miniMetricVal, { color: "#C62828" }]}>{report.total_dead.toLocaleString()}</Text>
                      <Text style={styles.miniMetricLabel}>Dead</Text>
                    </View>
                    <View style={styles.miniMetric}>
                      <Ionicons name="trending-up" size={14} color={PRIMARY} />
                      <Text style={[styles.miniMetricVal, { color: PRIMARY }]}>
                        {report.total_survived + report.total_dead > 0
                          ? ((report.total_survived / (report.total_survived + report.total_dead)) * 100).toFixed(1)
                          : "0.0"}%
                      </Text>
                      <Text style={styles.miniMetricLabel}>Rate</Text>
                    </View>
                  </View>

                  {/* Species Preview */}
                  {report.species && report.species.length > 0 && (
                    <View style={styles.speciesPreview}>
                      {report.species.slice(0, 3).map((sp) => (
                        <View key={sp.species_id} style={styles.speciesPill}>
                          <Ionicons name="leaf" size={10} color="#2E7D32" />
                          <Text style={styles.speciesPillText}>{sp.species_name}</Text>
                        </View>
                      ))}
                      {report.species.length > 3 && (
                        <Text style={styles.moreSpecies}>+{report.species.length - 3} more</Text>
                      )}
                    </View>
                  )}

                  {/* View Details CTA */}
                  <View style={styles.cardFooter}>
                    <Text style={styles.viewDetailsText}>View Details</Text>
                    <Ionicons name="chevron-forward" size={16} color={PRIMARY} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="clipboard-outline" size={48} color="#CBD5E1" />
            </View>
            <Text style={styles.emptyTitle}>No Reports Yet</Text>
            <Text style={styles.emptyMsg}>
              Progress reports will appear here once onsite inspectors submit them during monitoring visits.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Report Detail Modal */}
      <Modal visible={!!selectedReport} animationType="slide" transparent onRequestClose={() => setSelectedReport(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalPanel}>
            <View style={styles.modalHandle} />
            {selectedReport && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Report #{selectedReport.report_id}</Text>
                  <TouchableOpacity onPress={() => setSelectedReport(null)}>
                    <Ionicons name="close-circle" size={24} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.modalDate}>{formatDate(selectedReport.submitted_at || selectedReport.created_at)}</Text>

                {/* Status */}
                <View style={[styles.modalStatusBadge, { backgroundColor: (statusConfig[selectedReport.status] || statusConfig.pending).bg }]}>
                  <View style={[styles.statusDot, { backgroundColor: (statusConfig[selectedReport.status] || statusConfig.pending).dot }]} />
                  <Text style={[styles.statusText, { color: (statusConfig[selectedReport.status] || statusConfig.pending).text }]}>
                    {(statusConfig[selectedReport.status] || statusConfig.pending).label}
                  </Text>
                </View>

                {/* Metrics */}
                <View style={styles.metricsGrid}>
                  <View style={[styles.metricBox, { backgroundColor: "#E8F5E9" }]}>
                    <Ionicons name="heart" size={20} color="#2E7D32" />
                    <Text style={styles.metricBoxValue}>{selectedReport.total_survived.toLocaleString()}</Text>
                    <Text style={styles.metricBoxLabel}>Survived</Text>
                  </View>
                  <View style={[styles.metricBox, { backgroundColor: "#FFEBEE" }]}>
                    <Ionicons name="close-circle" size={20} color="#C62828" />
                    <Text style={[styles.metricBoxValue, { color: "#C62828" }]}>{selectedReport.total_dead.toLocaleString()}</Text>
                    <Text style={styles.metricBoxLabel}>Dead</Text>
                  </View>
                </View>

                {/* Per-Species Breakdown */}
                {selectedReport.species && selectedReport.species.length > 0 && (
                  <View style={{ marginTop: 20 }}>
                    <Text style={styles.sectionTitle}>Per-Species Breakdown</Text>
                    {selectedReport.species.map((sp, idx) => (
                      <View key={idx} style={styles.speciesDetailRow}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                          <View style={styles.speciesIconWrap}>
                            <Ionicons name="leaf-outline" size={16} color={PRIMARY} />
                          </View>
                          <View>
                            <Text style={styles.speciesDetailName}>{sp.species_name}</Text>
                            <Text style={styles.speciesDetailMeta}>
                              {sp.no_survived} survived / {sp.total} total
                            </Text>
                          </View>
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                          <Text style={styles.survivalRateText}>{sp.survival_rate}%</Text>
                          <Text style={styles.deadCountText}>{sp.no_dead} dead</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {/* Description */}
                {selectedReport.description && (
                  <View style={styles.descriptionBox}>
                    <Text style={styles.descriptionLabel}>Inspector Notes</Text>
                    <Text style={styles.descriptionText}>{selectedReport.description}</Text>
                  </View>
                )}

                {/* Proof Image */}
                {selectedReport.proof_image && (
                  <Image
                    source={{ uri: selectedReport.proof_image.startsWith("http") ? selectedReport.proof_image : `${api}${selectedReport.proof_image}` }}
                    style={styles.proofImage}
                    resizeMode="cover"
                  />
                )}

                <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedReport(null)}>
                  <Text style={styles.closeBtnText}>Close</Text>
                </TouchableOpacity>
                <View style={{ height: 20 }} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 12, color: MUTED, fontSize: 14 },

  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, backgroundColor: WHITE, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  backBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 18, fontWeight: "800", color: INK },

  statsBanner: { flexDirection: "row", backgroundColor: WHITE, marginHorizontal: 16, marginTop: 16, borderRadius: 16, paddingVertical: 18, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  statItem: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 22, fontWeight: "800", color: "#2E7D32", marginBottom: 2 },
  statLabel: { fontSize: 11, color: MUTED, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  statDivider: { width: 1, height: 36, backgroundColor: "#F1F5F9" },

  reportsList: { paddingHorizontal: 16, marginTop: 16, gap: 12 },
  reportCard: { backgroundColor: WHITE, borderRadius: 18, padding: 16, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  reportCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 },
  reportId: { fontSize: 16, fontWeight: "800", color: INK },
  reportDate: { fontSize: 12, color: MUTED, marginTop: 2 },
  statusBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, gap: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },

  miniMetrics: { flexDirection: "row", backgroundColor: "#F8FAFC", borderRadius: 14, paddingVertical: 14, marginBottom: 12 },
  miniMetric: { flex: 1, alignItems: "center" },
  miniMetricVal: { fontSize: 16, fontWeight: "800", color: "#2E7D32", marginTop: 4 },
  miniMetricLabel: { fontSize: 10, color: MUTED, marginTop: 2, fontWeight: "600" },

  speciesPreview: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  speciesPill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#E8F5E9", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  speciesPillText: { fontSize: 11, color: "#2E7D32", fontWeight: "600" },
  moreSpecies: { fontSize: 11, color: MUTED, fontWeight: "500", alignSelf: "center" },

  cardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 4, borderTopWidth: 1, borderTopColor: "#F1F5F9", paddingTop: 12 },
  viewDetailsText: { fontSize: 13, fontWeight: "700", color: PRIMARY },

  emptyState: { alignItems: "center", marginTop: 60, paddingHorizontal: 32 },
  emptyIconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: "#F1F5F9", justifyContent: "center", alignItems: "center", marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: INK, marginBottom: 6 },
  emptyMsg: { fontSize: 13, color: MUTED, textAlign: "center", lineHeight: 20 },

  // Modal
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
  modalPanel: { backgroundColor: WHITE, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingBottom: 32, maxHeight: "90%" },
  modalHandle: { width: 40, height: 4, backgroundColor: "#E5E7EB", borderRadius: 2, alignSelf: "center", marginTop: 12, marginBottom: 20 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  modalTitle: { fontSize: 18, fontWeight: "800", color: INK, flex: 1 },
  modalDate: { fontSize: 12, color: MUTED, marginBottom: 12 },
  modalStatusBadge: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, gap: 5, marginBottom: 16 },

  metricsGrid: { flexDirection: "row", gap: 12 },
  metricBox: { flex: 1, borderRadius: 16, padding: 16, alignItems: "center" },
  metricBoxValue: { fontSize: 24, fontWeight: "800", color: "#2E7D32", marginTop: 8 },
  metricBoxLabel: { fontSize: 11, color: MUTED, marginTop: 2, fontWeight: "600", textTransform: "uppercase" },

  sectionTitle: { fontSize: 14, fontWeight: "700", color: INK, marginBottom: 10 },
  speciesDetailRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  speciesIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#E8F5E9", justifyContent: "center", alignItems: "center" },
  speciesDetailName: { fontSize: 14, fontWeight: "700", color: INK },
  speciesDetailMeta: { fontSize: 12, color: MUTED, marginTop: 1 },
  survivalRateText: { fontSize: 15, fontWeight: "800", color: PRIMARY },
  deadCountText: { fontSize: 11, color: "#C62828", marginTop: 1 },

  descriptionBox: { backgroundColor: "#F8FAFC", borderRadius: 14, padding: 14, marginTop: 16 },
  descriptionLabel: { fontSize: 11, color: MUTED, fontWeight: "700", textTransform: "uppercase", marginBottom: 6, letterSpacing: 0.5 },
  descriptionText: { fontSize: 14, color: INK, lineHeight: 22 },

  proofImage: { width: "100%", height: 200, borderRadius: 16, marginTop: 16 },

  closeBtn: { backgroundColor: "#F4F7F5", borderRadius: 14, padding: 15, alignItems: "center", marginTop: 20 },
  closeBtnText: { color: PRIMARY, fontWeight: "700", fontSize: 14 },
});