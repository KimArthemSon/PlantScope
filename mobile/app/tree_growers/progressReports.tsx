import React, { useState, useEffect } from "react";
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
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/constants/url_fixed";

const { width: SCREEN_W } = Dimensions.get("window");

const PRIMARY = "#0F4A2F";
const PRIMARY_LIGHT = "#1A6B47";
const INK = "#111827";
const MUTED = "#6B7280";
const WHITE = "#FFFFFF";
const BG = "#F4F7F5";
const CARD_BG = "#FFFFFF";
const BORDER = "#E8EDE9";

// ─── Updated Interfaces ────────────────────────────────────────────────────
interface ProgressReportSpeciesItem {
  species_id: number;
  species_name: string;
  no_planted: number; // Added for initial planted calculation
  no_added_by_grower: number;
  no_survived: number;
  no_dead: number;
  total: number;
  survival_rate: number;
}

interface ProgressReport {
  report_id: number;
  visit_type: "initial" | "ongoing"; // Added
  total_added_by_grower: number; // Added
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
  pending: {
    label: "Pending Review",
    bg: "#FFF8E1",
    text: "#F57F17",
    dot: "#F9A825",
    accent: "#F9A825",
    border: "#FFECB3",
  },
  accepted: {
    label: "Verified",
    bg: "#E8F5E9",
    text: "#2E7D32",
    dot: "#388E3C",
    accent: "#2E7D32",
    border: "#C8E6C9",
  },
  rejected: {
    label: "Rejected",
    bg: "#FFEBEE",
    text: "#C62828",
    dot: "#D32F2F",
    accent: "#C62828",
    border: "#FFCDD2",
  },
};

const formatDate = (iso: string) =>
  !iso
    ? "—"
    : new Date(iso).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });

/* ─── Mini Circular Progress ── */
function CircularProgress({
  percentage,
  size = 44,
  strokeWidth = 4,
  color = PRIMARY,
  bgColor = "#E8EDE9",
}: {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  bgColor?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <View
      style={{
        width: size,
        height: size,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <View
        style={{
          position: "absolute",
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: bgColor,
        }}
      />
      <View
        style={{
          position: "absolute",
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: color,
          borderLeftColor: "transparent",
          borderBottomColor: "transparent",
          transform: [{ rotate: `${-90 + (percentage / 100) * 360}deg` }],
        }}
      />
      <Text style={{ fontSize: 11, fontWeight: "800", color: "#FFFFFF" }}>
        {percentage.toFixed(0)}%
      </Text>
    </View>
  );
}

/* ─── Linear Progress Bar ─── */
function ProgressBar({
  value,
  max,
  color = PRIMARY,
  height = 6,
}: {
  value: number;
  max: number;
  color?: string;
  height?: number;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <View
      style={{
        width: "100%",
        height,
        backgroundColor: "#E8EDE9",
        borderRadius: height / 2,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          width: `${pct}%`,
          height,
          backgroundColor: color,
          borderRadius: height / 2,
        }}
      />
    </View>
  );
}

export default function ProgressReportsPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [reports, setReports] = useState<ProgressReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ProgressReport | null>(
    null,
  );

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

  // ─── ✅ UPDATED: Metrics Calculation ─────────────────────────────────────
  // Filter to only accepted reports for accurate metrics
  const acceptedReports = reports.filter((r) => r.status === "accepted");

  // Find the latest accepted report for cumulative totals
  const sortedAcceptedReports = [...acceptedReports].sort(
    (a, b) =>
      new Date(b.submitted_at || b.created_at || 0).getTime() -
      new Date(a.submitted_at || a.created_at || 0).getTime(),
  );
  const latestReport = sortedAcceptedReports[0] || null;

  const totalSurvived = latestReport?.total_survived || 0;
  const totalDead = latestReport?.total_dead || 0;

  // Calculate Total Ever Planted (Initial planted + all additions)
  const initialReport = acceptedReports.find((r) => r.visit_type === "initial");
  const initialPlanted =
    initialReport?.species.reduce((sum, sp) => sum + (sp.no_planted || 0), 0) ||
    0;

  const totalAddedByGrower = acceptedReports.reduce(
    (sum, rep) => sum + (rep.total_added_by_grower || 0),
    0,
  );

  const totalEverPlanted = initialPlanted + totalAddedByGrower;

  const overallSurvivalRate =
    totalEverPlanted > 0 ? (totalSurvived / totalEverPlanted) * 100 : 0;

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
        <TouchableOpacity style={styles.backBtn} onPress={() => router.replace("/tree_growers/application")}>
          <Ionicons name="chevron-back" size={24} color={INK} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Progress Reports</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchData(true);
            }}
            tintColor={PRIMARY}
          />
        }
      >
        {/* Overall Stats — Premium Banner */}
        {reports.length > 0 && (
          <View style={styles.statsBanner}>
            <View style={styles.statsBannerInner}>
              <View style={styles.statsBannerTop}>
                <View style={styles.statsBannerTitleWrap}>
                  <Ionicons
                    name="stats-chart"
                    size={18}
                    color="rgba(255,255,255,0.9)"
                  />
                  <Text style={styles.statsBannerTitle}>
                    Overall Performance
                  </Text>
                </View>
                <View style={styles.survivalRateWrap}>
                  <CircularProgress
                    percentage={overallSurvivalRate}
                    size={52}
                    strokeWidth={5}
                    color="#4ADE80"
                    bgColor="rgba(255,255,255,0.15)"
                  />
                </View>
              </View>

              <View style={styles.statsDivider} />

              <View style={styles.statsRowBanner}>
                <View style={styles.statBox}>
                  <View
                    style={[
                      styles.statIconWrap,
                      { backgroundColor: "rgba(74,222,128,0.15)" },
                    ]}
                  >
                    <Ionicons name="heart" size={16} color="#4ADE80" />
                  </View>
                  <View>
                    <Text style={styles.statBoxValue}>
                      {totalSurvived.toLocaleString()}
                    </Text>
                    <Text style={styles.statBoxLabel}>Survived</Text>
                  </View>
                </View>

                <View style={styles.statBoxDivider} />

                <View style={styles.statBox}>
                  <View
                    style={[
                      styles.statIconWrap,
                      { backgroundColor: "rgba(248,113,113,0.15)" },
                    ]}
                  >
                    <Ionicons name="close-circle" size={16} color="#F87171" />
                  </View>
                  <View>
                    <Text style={[styles.statBoxValue, { color: "#F87171" }]}>
                      {totalDead.toLocaleString()}
                    </Text>
                    <Text style={styles.statBoxLabel}>Dead</Text>
                  </View>
                </View>

                <View style={styles.statBoxDivider} />

                <View style={styles.statBox}>
                  <View
                    style={[
                      styles.statIconWrap,
                      { backgroundColor: "rgba(255,255,255,0.12)" },
                    ]}
                  >
                    <Ionicons
                      name="layers"
                      size={16}
                      color="rgba(255,255,255,0.9)"
                    />
                  </View>
                  <View>
                    <Text style={styles.statBoxValue}>
                      {totalEverPlanted.toLocaleString()}
                    </Text>
                    <Text style={styles.statBoxLabel}>Total</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Section Label */}
        {reports.length > 0 && (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderTitle}>Recent Reports</Text>
            <Text style={styles.sectionHeaderCount}>
              {reports.length} total
            </Text>
          </View>
        )}

        {/* Reports List */}
        {reports.length > 0 ? (
          <View style={styles.reportsList}>
            {reports.map((report) => {
              const conf = statusConfig[report.status] || statusConfig.pending;
              const reportRate =
                report.total_survived + report.total_dead > 0
                  ? (report.total_survived /
                      (report.total_survived + report.total_dead)) *
                    100
                  : 0;

              return (
                <TouchableOpacity
                  key={report.report_id}
                  style={[styles.reportCard, { borderLeftColor: conf.accent }]}
                  onPress={() => setSelectedReport(report)}
                  activeOpacity={0.85}
                >
                  {/* Card Header */}
                  <View style={styles.reportCardHeader}>
                    <View style={styles.reportCardHeaderLeft}>
                      <View
                        style={[
                          styles.reportIconWrap,
                          { backgroundColor: conf.bg },
                        ]}
                      >
                        <Ionicons
                          name="document-text"
                          size={18}
                          color={conf.text}
                        />
                      </View>
                      <View>
                        <Text style={styles.reportId}>
                          Report #{report.report_id}
                        </Text>
                        <Text style={styles.reportDate}>
                          {formatDate(report.submitted_at || report.created_at)}
                        </Text>
                      </View>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: conf.bg, borderColor: conf.border },
                      ]}
                    >
                      <View
                        style={[
                          styles.statusDot,
                          { backgroundColor: conf.dot },
                        ]}
                      />
                      <Text style={[styles.statusText, { color: conf.text }]}>
                        {conf.label}
                      </Text>
                    </View>
                  </View>

                  {/* Progress Bar */}
                  <View style={styles.progressBarWrap}>
                    <View style={styles.progressBarLabelRow}>
                      <Text style={styles.progressBarLabel}>
                        Survival Progress
                      </Text>
                      <Text
                        style={[
                          styles.progressBarValue,
                          { color: conf.accent },
                        ]}
                      >
                        {reportRate.toFixed(1)}%
                      </Text>
                    </View>
                    <ProgressBar
                      value={report.total_survived}
                      max={report.total_survived + report.total_dead}
                      color={conf.accent}
                      height={6}
                    />
                  </View>

                  {/* Mini Metrics */}
                  <View style={styles.miniMetrics}>
                    <View style={styles.miniMetric}>
                      <View
                        style={[
                          styles.miniMetricIconWrap,
                          { backgroundColor: "#E8F5E9" },
                        ]}
                      >
                        <Ionicons name="heart" size={14} color="#2E7D32" />
                      </View>
                      <Text style={styles.miniMetricVal}>
                        {report.total_survived.toLocaleString()}
                      </Text>
                      <Text style={styles.miniMetricLabel}>Survived</Text>
                    </View>
                    <View style={styles.miniMetricDivider} />
                    <View style={styles.miniMetric}>
                      <View
                        style={[
                          styles.miniMetricIconWrap,
                          { backgroundColor: "#FFEBEE" },
                        ]}
                      >
                        <Ionicons
                          name="close-circle"
                          size={14}
                          color="#C62828"
                        />
                      </View>
                      <Text
                        style={[styles.miniMetricVal, { color: "#C62828" }]}
                      >
                        {report.total_dead.toLocaleString()}
                      </Text>
                      <Text style={styles.miniMetricLabel}>Dead</Text>
                    </View>
                    <View style={styles.miniMetricDivider} />
                    <View style={styles.miniMetric}>
                      <View
                        style={[
                          styles.miniMetricIconWrap,
                          { backgroundColor: "#E3F2FD" },
                        ]}
                      >
                        <Ionicons
                          name="trending-up"
                          size={14}
                          color={PRIMARY}
                        />
                      </View>
                      <Text style={[styles.miniMetricVal, { color: PRIMARY }]}>
                        {report.total_survived + report.total_dead > 0
                          ? (
                              (report.total_survived /
                                (report.total_survived + report.total_dead)) *
                              100
                            ).toFixed(1)
                          : "0.0"}
                        %
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
                          <Text style={styles.speciesPillText}>
                            {sp.species_name}
                          </Text>
                        </View>
                      ))}
                      {report.species.length > 3 && (
                        <View style={styles.moreSpeciesPill}>
                          <Text style={styles.moreSpecies}>
                            +{report.species.length - 3}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* View Details CTA */}
                  <View style={styles.cardFooter}>
                    <Text style={styles.viewDetailsText}>View Details</Text>
                    <View style={styles.viewDetailsArrow}>
                      <Ionicons
                        name="chevron-forward"
                        size={14}
                        color={WHITE}
                      />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="clipboard-outline" size={40} color="#CBD5E1" />
            </View>
            <Text style={styles.emptyTitle}>No Reports Yet</Text>
            <Text style={styles.emptyMsg}>
              Progress reports will appear here once onsite inspectors submit
              them during monitoring visits.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* ─── Report Detail Modal ─── */}
      <Modal
        visible={!!selectedReport}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedReport(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalPanel}>
            <View style={styles.modalHandle} />
            {selectedReport && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Modal Header */}
                <View style={styles.modalHeader}>
                  <View style={styles.modalHeaderLeft}>
                    <View
                      style={[
                        styles.modalHeaderIcon,
                        {
                          backgroundColor: (
                            statusConfig[selectedReport.status] ||
                            statusConfig.pending
                          ).bg,
                        },
                      ]}
                    >
                      <Ionicons
                        name="document-text"
                        size={20}
                        color={
                          (
                            statusConfig[selectedReport.status] ||
                            statusConfig.pending
                          ).text
                        }
                      />
                    </View>
                    <View>
                      <Text style={styles.modalTitle}>
                        Report #{selectedReport.report_id}
                      </Text>
                      <Text style={styles.modalDate}>
                        {formatDate(
                          selectedReport.submitted_at ||
                            selectedReport.created_at,
                        )}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => setSelectedReport(null)}
                    style={styles.modalCloseBtn}
                  >
                    <Ionicons name="close" size={22} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>

                {/* Status */}
                <View
                  style={[
                    styles.modalStatusBadge,
                    {
                      backgroundColor: (
                        statusConfig[selectedReport.status] ||
                        statusConfig.pending
                      ).bg,
                      borderColor: (
                        statusConfig[selectedReport.status] ||
                        statusConfig.pending
                      ).border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.statusDot,
                      {
                        backgroundColor: (
                          statusConfig[selectedReport.status] ||
                          statusConfig.pending
                        ).dot,
                      },
                    ]}
                  />
                  <Text
                    style={[
                      styles.statusText,
                      {
                        color: (
                          statusConfig[selectedReport.status] ||
                          statusConfig.pending
                        ).text,
                      },
                    ]}
                  >
                    {
                      (
                        statusConfig[selectedReport.status] ||
                        statusConfig.pending
                      ).label
                    }
                  </Text>
                </View>

                {/* Metrics */}
                <View style={styles.metricsGrid}>
                  <View
                    style={[styles.metricBox, { backgroundColor: "#E8F5E9" }]}
                  >
                    <View
                      style={[
                        styles.metricBoxIconWrap,
                        { backgroundColor: "rgba(46,125,50,0.1)" },
                      ]}
                    >
                      <Ionicons name="heart" size={20} color="#2E7D32" />
                    </View>
                    <Text style={styles.metricBoxValue}>
                      {selectedReport.total_survived.toLocaleString()}
                    </Text>
                    <Text style={styles.metricBoxLabel}>Survived</Text>
                  </View>
                  <View
                    style={[styles.metricBox, { backgroundColor: "#FFEBEE" }]}
                  >
                    <View
                      style={[
                        styles.metricBoxIconWrap,
                        { backgroundColor: "rgba(198,40,40,0.1)" },
                      ]}
                    >
                      <Ionicons name="close-circle" size={20} color="#C62828" />
                    </View>
                    <Text style={[styles.metricBoxValue, { color: "#C62828" }]}>
                      {selectedReport.total_dead.toLocaleString()}
                    </Text>
                    <Text style={styles.metricBoxLabel}>Dead</Text>
                  </View>
                </View>

                {/* Overall Rate */}
                <View style={styles.overallRateBox}>
                  <View style={styles.overallRateHeader}>
                    <Text style={styles.overallRateLabel}>
                      Overall Survival Rate
                    </Text>
                    <Text style={styles.overallRateValue}>
                      {selectedReport.total_survived +
                        selectedReport.total_dead >
                      0
                        ? (
                            (selectedReport.total_survived /
                              (selectedReport.total_survived +
                                selectedReport.total_dead)) *
                            100
                          ).toFixed(1)
                        : "0.0"}
                      %
                    </Text>
                  </View>
                  <ProgressBar
                    value={selectedReport.total_survived}
                    max={
                      selectedReport.total_survived + selectedReport.total_dead
                    }
                    color={PRIMARY}
                    height={8}
                  />
                </View>

                {/* Per-Species Breakdown */}
                {selectedReport.species &&
                  selectedReport.species.length > 0 && (
                    <View style={{ marginTop: 24 }}>
                      <Text style={styles.sectionTitle}>
                        Per-Species Breakdown
                      </Text>
                      {selectedReport.species.map((sp, idx) => (
                        <View key={idx} style={styles.speciesDetailRow}>
                          <View style={{ flex: 1 }}>
                            <View style={styles.speciesDetailTop}>
                              <View style={styles.speciesIconWrap}>
                                <Ionicons
                                  name="leaf-outline"
                                  size={16}
                                  color={PRIMARY}
                                />
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.speciesDetailName}>
                                  {sp.species_name}
                                </Text>
                                <View style={styles.speciesDetailMetaRow}>
                                  <Text style={styles.speciesDetailMeta}>
                                    {sp.no_survived} survived
                                  </Text>
                                  <Text style={styles.speciesDetailMetaDivider}>
                                    ·
                                  </Text>
                                  <Text style={styles.speciesDetailMeta}>
                                    {sp.total} total
                                  </Text>
                                </View>
                              </View>
                              <View style={{ alignItems: "flex-end" }}>
                                <Text style={styles.survivalRateText}>
                                  {sp.survival_rate}%
                                </Text>
                                <Text style={styles.deadCountText}>
                                  {sp.no_dead} dead
                                </Text>
                              </View>
                            </View>
                            <View style={{ marginTop: 8 }}>
                              <ProgressBar
                                value={sp.no_survived}
                                max={sp.total}
                                color={
                                  sp.survival_rate >= 80
                                    ? "#2E7D32"
                                    : sp.survival_rate >= 50
                                      ? "#F57F17"
                                      : "#C62828"
                                }
                                height={5}
                              />
                            </View>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}

                {/* Description */}
                {selectedReport.description && (
                  <View style={styles.descriptionBox}>
                    <View style={styles.descriptionHeader}>
                      <Ionicons
                        name="chatbubble-ellipses-outline"
                        size={14}
                        color={MUTED}
                      />
                      <Text style={styles.descriptionLabel}>
                        Inspector Notes
                      </Text>
                    </View>
                    <Text style={styles.descriptionText}>
                      {selectedReport.description}
                    </Text>
                  </View>
                )}

                {/* Proof Image */}
                {selectedReport.proof_image && (
                  <View style={styles.proofImageWrap}>
                    <Text style={styles.proofImageLabel}>Proof Photo</Text>
                    <Image
                      source={{
                        uri: selectedReport.proof_image.startsWith("http")
                          ? selectedReport.proof_image
                          : `${api}${selectedReport.proof_image}`,
                      }}
                      style={styles.proofImage}
                      resizeMode="cover"
                    />
                  </View>
                )}

                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={() => setSelectedReport(null)}
                >
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

  /* Header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: WHITE,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: INK,
    letterSpacing: -0.3,
  },

  /* Stats Banner — Premium gradient card */
  statsBanner: {
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: PRIMARY,
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  statsBannerInner: {
    backgroundColor: PRIMARY,
    padding: 20,
    borderRadius: 20,
  },
  statsBannerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  statsBannerTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statsBannerTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "rgba(255,255,255,0.85)",
    letterSpacing: 0.3,
  },
  survivalRateWrap: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 30,
    padding: 4,
  },
  statsDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
    marginBottom: 16,
  },
  statsRowBanner: {
    flexDirection: "row",
    alignItems: "center",
  },
  statBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    justifyContent: "center",
  },
  statBoxDivider: {
    width: 1,
    height: 32,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  statIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  statBoxValue: {
    fontSize: 17,
    fontWeight: "800",
    color: WHITE,
  },
  statBoxLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.6)",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 1,
  },

  /* Section Header */
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginTop: 24,
    marginBottom: 10,
  },
  sectionHeaderTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: INK,
    letterSpacing: -0.3,
  },
  sectionHeaderCount: {
    fontSize: 12,
    fontWeight: "600",
    color: MUTED,
    backgroundColor: "#E8EDE9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },

  /* Reports List */
  reportsList: { paddingHorizontal: 20, gap: 14 },

  reportCard: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    padding: 18,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },

  /* Card Header */
  reportCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  reportCardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  reportIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  reportId: {
    fontSize: 16,
    fontWeight: "800",
    color: INK,
    letterSpacing: -0.2,
  },
  reportDate: { fontSize: 12, color: MUTED, marginTop: 2 },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 5,
    borderWidth: 1,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  /* Progress Bar */
  progressBarWrap: { marginBottom: 14 },
  progressBarLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  progressBarLabel: { fontSize: 11, fontWeight: "600", color: MUTED },
  progressBarValue: { fontSize: 13, fontWeight: "800" },

  /* Mini Metrics */
  miniMetrics: {
    flexDirection: "row",
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    paddingVertical: 14,
    marginBottom: 12,
  },
  miniMetric: { flex: 1, alignItems: "center" },
  miniMetricDivider: {
    width: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 4,
  },
  miniMetricIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  miniMetricVal: { fontSize: 15, fontWeight: "800", color: "#2E7D32" },
  miniMetricLabel: {
    fontSize: 10,
    color: MUTED,
    marginTop: 2,
    fontWeight: "600",
  },

  /* Species Preview */
  speciesPreview: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 14,
  },
  speciesPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  speciesPillText: { fontSize: 11, color: "#2E7D32", fontWeight: "600" },
  moreSpeciesPill: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  moreSpecies: { fontSize: 11, color: MUTED, fontWeight: "600" },

  /* Card Footer */
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 12,
  },
  viewDetailsText: { fontSize: 13, fontWeight: "700", color: PRIMARY },
  viewDetailsArrow: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: PRIMARY,
    justifyContent: "center",
    alignItems: "center",
  },

  /* Empty State */
  emptyState: { alignItems: "center", marginTop: 80, paddingHorizontal: 32 },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: INK, marginBottom: 6 },
  emptyMsg: { fontSize: 13, color: MUTED, textAlign: "center", lineHeight: 20 },

  /* ─── Modal ─── */
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalPanel: {
    backgroundColor: WHITE,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingBottom: 32,
    maxHeight: "92%",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
    elevation: 10,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#E5E7EB",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 20,
  },

  /* Modal Header */
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  modalHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  modalHeaderIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: INK,
    letterSpacing: -0.2,
  },
  modalDate: { fontSize: 12, color: MUTED, marginTop: 2 },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },

  modalStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    marginTop: 12,
    marginBottom: 18,
  },

  /* Metrics Grid */
  metricsGrid: { flexDirection: "row", gap: 12 },
  metricBox: {
    flex: 1,
    borderRadius: 18,
    padding: 16,
    alignItems: "center",
  },
  metricBoxIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  metricBoxValue: {
    fontSize: 24,
    fontWeight: "800",
    color: "#2E7D32",
    marginTop: 2,
  },
  metricBoxLabel: {
    fontSize: 11,
    color: MUTED,
    marginTop: 4,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  /* Overall Rate Box */
  overallRateBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
  },
  overallRateHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  overallRateLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  overallRateValue: { fontSize: 18, fontWeight: "800", color: PRIMARY },

  /* Section Title */
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: INK,
    marginBottom: 12,
    letterSpacing: -0.2,
  },

  /* Species Detail Row */
  speciesDetailRow: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  speciesDetailTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  speciesIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#E8F5E9",
    justifyContent: "center",
    alignItems: "center",
  },
  speciesDetailName: { fontSize: 14, fontWeight: "700", color: INK },
  speciesDetailMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  speciesDetailMeta: { fontSize: 12, color: MUTED },
  speciesDetailMetaDivider: { fontSize: 12, color: "#D1D5DB" },
  survivalRateText: { fontSize: 15, fontWeight: "800", color: PRIMARY },
  deadCountText: { fontSize: 11, color: "#C62828", marginTop: 1 },

  /* Description */
  descriptionBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 16,
    marginTop: 20,
  },
  descriptionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  descriptionLabel: {
    fontSize: 11,
    color: MUTED,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  descriptionText: { fontSize: 14, color: INK, lineHeight: 22 },

  /* Proof Image */
  proofImageWrap: { marginTop: 20 },
  proofImageLabel: {
    fontSize: 11,
    color: MUTED,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  proofImage: { width: "100%", height: 220, borderRadius: 16 },

  /* Close Button */
  closeBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    marginTop: 24,
    shadowColor: PRIMARY,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  closeBtnText: {
    color: WHITE,
    fontWeight: "700",
    fontSize: 14,
    letterSpacing: 0.3,
  },
});
