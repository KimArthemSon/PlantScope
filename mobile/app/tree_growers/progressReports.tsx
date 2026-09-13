import React, { useState, useEffect, useMemo } from "react";
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
const INK = "#111827";
const MUTED = "#6B7280";
const WHITE = "#FFFFFF";
const BG = "#F4F7F5";
const CARD_BG = "#FFFFFF";
const BORDER = "#E8EDE9";

// ── Interfaces ──────────────────────────────────────────────────────────────
interface ProgressReportSpeciesItem {
  species_id: number;
  species_name: string;
  no_planted: number;
  no_added_by_grower: number;
  no_survived: number;
  no_dead: number;
  total: number;
  survival_rate: number;
}

interface ProgressReport {
  report_id: number;
  visit_type: "initial" | "ongoing" | "inactive_check";
  total_added_by_grower: number;
  total_survived: number;
  total_dead: number;
  species: ProgressReportSpeciesItem[];
  description: string | null;
  status: "pending" | "accepted" | "rejected";
  proof_image: string | null;
  submitted_at: string | null;
  created_at: string;
  application?: {
    application_id: number;
    group_name: string;
  } | null;
}

interface ProgressReportsData {
  my_reports: ProgressReport[];
  site_history: ProgressReport[];
}

interface SpeciesBreakdownItem {
  species_id: number;
  species_name: string;
  officially_planted: number;
  total_added: number;
  total_dead: number;
  calculated_survived: number;
  survival_rate: number;
}

const statusConfig = {
  pending: { label: "Pending Review", bg: "#FFF8E1", text: "#F57F17", dot: "#F9A825", accent: "#F9A825", border: "#FFECB3" },
  accepted: { label: "Verified", bg: "#E8F5E9", text: "#2E7D32", dot: "#388E3C", accent: "#2E7D32", border: "#C8E6C9" },
  rejected: { label: "Rejected", bg: "#FFEBEE", text: "#C62828", dot: "#D32F2F", accent: "#C62828", border: "#FFCDD2" },
};

const formatDate = (iso: string) =>
  !iso ? "—" : new Date(iso).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });

// ── Helper Components ───────────────────────────────────────────────────────
function CircularProgress({ percentage, size = 44, strokeWidth = 4, color = PRIMARY, bgColor = "#E8EDE9" }: { percentage: number; size?: number; strokeWidth?: number; color?: string; bgColor?: string }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <View style={{ width: size, height: size, justifyContent: "center", alignItems: "center" }}>
      <View style={{ position: "absolute", width: size, height: size, borderRadius: size / 2, borderWidth: strokeWidth, borderColor: bgColor }} />
      <View style={{ position: "absolute", width: size, height: size, borderRadius: size / 2, borderWidth: strokeWidth, borderColor: color, borderLeftColor: "transparent", borderBottomColor: "transparent", transform: [{ rotate: `${-90 + (percentage / 100) * 360}deg` }] }} />
      <Text style={{ fontSize: 11, fontWeight: "800", color: "#FFFFFF" }}>{percentage.toFixed(0)}%</Text>
    </View>
  );
}

function ProgressBar({ value, max, color = PRIMARY, height = 6 }: { value: number; max: number; color?: string; height?: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <View style={{ width: "100%", height, backgroundColor: "#E8EDE9", borderRadius: height / 2, overflow: "hidden" }}>
      <View style={{ width: `${pct}%`, height, backgroundColor: color, borderRadius: height / 2 }} />
    </View>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function ProgressReportsPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [reportsData, setReportsData] = useState<ProgressReportsData>({ my_reports: [], site_history: [] });
  const [activeTab, setActiveTab] = useState<'overall' | 'my_reports' | 'site_history'>('overall');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ProgressReport | null>(null);
  const [showSpeciesModal, setShowSpeciesModal] = useState(false);

  const fetchData = async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      const token = await SecureStore.getItemAsync("token");
      if (!token) return;
      const res = await fetch(`${api}/api/get_tree_grower_application/`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setReportsData(data.progress_reports || { my_reports: [], site_history: [] });
    } catch (err) { console.error(err); } 
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const allReports = useMemo(() => 
    [...reportsData.my_reports, ...reportsData.site_history].sort((a, b) => new Date(b.submitted_at || b.created_at || 0).getTime() - new Date(a.submitted_at || a.created_at || 0).getTime()),
    [reportsData]
  );
  
  const myReportIds = useMemo(() => new Set(reportsData.my_reports.map(r => r.report_id)), [reportsData]);
  
  const displayedReports = useMemo(() => 
    activeTab === 'overall' ? allReports : activeTab === 'my_reports' ? reportsData.my_reports : reportsData.site_history,
    [activeTab, allReports, reportsData]
  );

  // ✅ NEW: Find the true baseline report ID (oldest accepted initial report)
  const baselineReportId = useMemo(() => {
    const initialReports = allReports
      .filter((r) => r.visit_type === "initial" && r.status === "accepted")
      .sort((a, b) => new Date(a.submitted_at || a.created_at || 0).getTime() - new Date(b.submitted_at || b.created_at || 0).getTime());
    return initialReports.length > 0 ? initialReports[0].report_id : null;
  }, [allReports]);

  // ✅ FIXED: Calculate species breakdown using useMemo
  const speciesBreakdown = useMemo(() => {
    const acceptedReports = displayedReports.filter(r => r.status === "accepted");
    const initialReports = acceptedReports.filter(r => r.visit_type === "initial");
    const oldestInitialReport = initialReports.length > 0 
      ? initialReports.sort((a, b) => new Date(a.submitted_at || a.created_at || 0).getTime() - new Date(b.submitted_at || b.created_at || 0).getTime())[0] 
      : null;
    const ongoingReports = acceptedReports.filter(r => r.visit_type !== "initial");

    const allSpeciesIds = new Set<number>();
    const speciesNameMap = new Map<number, string>();
    acceptedReports.forEach(report => {
      report.species.forEach(sp => {
        allSpeciesIds.add(sp.species_id);
        speciesNameMap.set(sp.species_id, sp.species_name);
      });
    });

    const breakdown: SpeciesBreakdownItem[] = [];
    for (const speciesId of allSpeciesIds) {
      const speciesName = speciesNameMap.get(speciesId) || "Unknown";
      const initialSpecies = oldestInitialReport?.species.find(sp => sp.species_id === speciesId);
      const officially_planted = initialSpecies?.no_planted || 0;

      let total_added = 0;
      acceptedReports.forEach(report => {
        const sp = report.species.find(s => s.species_id === speciesId);
        total_added += sp?.no_added_by_grower || 0;
      });

      const sortedOngoing = [...ongoingReports].sort((a, b) => new Date(b.submitted_at || b.created_at || 0).getTime() - new Date(a.submitted_at || a.created_at || 0).getTime());
      let total_dead = 0;
      for (let i = 0; i < sortedOngoing.length; i++) {
        const sp = sortedOngoing[i].species.find(s => s.species_id === speciesId);
        if (sp) { total_dead = sp.no_dead; break; }
      }
      if (total_dead === 0 && initialSpecies) total_dead = initialSpecies.no_dead || 0;

      const total_accounted = officially_planted + total_added;
      const calculated_survived = Math.max(0, total_accounted - total_dead);
      const survival_rate = total_accounted > 0 ? (calculated_survived / total_accounted) * 100 : 0;

      breakdown.push({ species_id: speciesId, species_name: speciesName, officially_planted, total_added, total_dead, calculated_survived, survival_rate });
    }
    return breakdown;
  }, [displayedReports]);

  // ── Lifetime Metrics Calculation ─
  const acceptedReports = displayedReports.filter((r) => r.status === "accepted");
  let totalPlanted = 0, totalAdded = 0, totalDead = 0;
  acceptedReports.forEach(report => {
    report.species.forEach(sp => {
      totalPlanted += sp.no_planted || 0;
      totalAdded += sp.no_added_by_grower || 0;
      totalDead += sp.no_dead || 0;
    });
  });
  const totalAccounted = totalPlanted + totalAdded;
  const totalSurvived = Math.max(0, totalAccounted - totalDead);
  const overallSurvivalRate = totalAccounted > 0 ? (totalSurvived / totalAccounted) * 100 : 0;

  // ─ ✅ UPDATED Helper: Calculate per-report metrics ──
  const getReportMetrics = (report: ProgressReport) => {
    let rPlanted = 0, rAdded = 0, rDead = 0, rSurvived = 0;
    report.species.forEach(sp => {
      rPlanted += sp.no_planted || 0;
      rAdded += sp.no_added_by_grower || 0;
      rDead += sp.no_dead || 0;
      rSurvived += sp.no_survived || 0;
    });
    
    // Strictly check if this is the true baseline report
    const isBaseline = report.report_id === baselineReportId;
    const primaryCount = isBaseline ? rPlanted : rAdded;
    const primaryLabel = isBaseline ? "Officially Planted" : "Added";
    const rTotal = rPlanted + rAdded;
    
    return { primaryCount, primaryLabel, rSurvived, rDead, isBaseline, rTotal };
  };

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

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(true); }} tintColor={PRIMARY} />}>
        
        {/* Tabs */}
        {(reportsData.my_reports.length > 0 || reportsData.site_history.length > 0) && (
          <View style={styles.tabContainer}>
            <TouchableOpacity style={[styles.tab, activeTab === 'overall' && styles.activeTab]} onPress={() => setActiveTab('overall')}>
              <Text style={[styles.tabText, activeTab === 'overall' && styles.activeTabText]}>Overall ({allReports.length})</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tab, activeTab === 'my_reports' && styles.activeTab]} onPress={() => setActiveTab('my_reports')}>
              <Text style={[styles.tabText, activeTab === 'my_reports' && styles.activeTabText]}>My Reports ({reportsData.my_reports.length})</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tab, activeTab === 'site_history' && styles.activeTab]} onPress={() => setActiveTab('site_history')}>
              <Text style={[styles.tabText, activeTab === 'site_history' && styles.activeTabText]}>Site History ({reportsData.site_history.length})</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Lifetime Banner */}
        {displayedReports.length > 0 && (
          <View style={styles.statsBanner}>
            <View style={styles.statsBannerInner}>
              <View style={styles.statsBannerTop}>
                <View style={styles.statsBannerTitleWrap}>
                  <Ionicons name="stats-chart" size={18} color="rgba(255,255,255,0.9)" />
                  <Text style={styles.statsBannerTitle}>{activeTab === 'overall' ? 'Lifetime Site Metrics' : activeTab === 'my_reports' ? 'My Performance' : 'Site Performance'}</Text>
                </View>
                <View style={styles.survivalRateWrap}>
                  <CircularProgress percentage={overallSurvivalRate} size={52} strokeWidth={5} color="#4ADE80" bgColor="rgba(255,255,255,0.15)" />
                </View>
              </View>
              <View style={styles.statsDivider} />
              <View style={styles.statsRowBanner}>
                <View style={styles.statBox}>
                  <View style={[styles.statIconWrap, { backgroundColor: "rgba(74,222,128,0.15)" }]}><Ionicons name="heart" size={16} color="#4ADE80" /></View>
                  <View><Text style={styles.statBoxValue}>{totalSurvived.toLocaleString()}</Text><Text style={styles.statBoxLabel}>Survived</Text></View>
                </View>
                <View style={styles.statBoxDivider} />
                <View style={styles.statBox}>
                  <View style={[styles.statIconWrap, { backgroundColor: "rgba(248,113,113,0.15)" }]}><Ionicons name="close-circle" size={16} color="#F87171" /></View>
                  <View><Text style={[styles.statBoxValue, { color: "#F87171" }]}>{totalDead.toLocaleString()}</Text><Text style={styles.statBoxLabel}>Dead</Text></View>
                </View>
                <View style={styles.statBoxDivider} />
                <View style={styles.statBox}>
                  <View style={[styles.statIconWrap, { backgroundColor: "rgba(255,255,255,0.12)" }]}><Ionicons name="layers" size={16} color="rgba(255,255,255,0.9)" /></View>
                  <View><Text style={styles.statBoxValue}>{totalAccounted.toLocaleString()}</Text><Text style={styles.statBoxLabel}>Total Planted</Text></View>
                </View>
              </View>
              
              <TouchableOpacity style={styles.speciesBreakdownBtn} onPress={() => setShowSpeciesModal(true)}>
                <Ionicons name="leaf" size={18} color={WHITE} />
                <Text style={styles.speciesBreakdownBtnText}>View Species Breakdown</Text>
                <Ionicons name="chevron-forward" size={18} color={WHITE} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Section Label */}
        {displayedReports.length > 0 && (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderTitle}>{activeTab === 'overall' ? 'All Reports (Chronological)' : activeTab === 'my_reports' ? 'My Recent Reports' : 'Other Site Reports'}</Text>
            <Text style={styles.sectionHeaderCount}>{displayedReports.length} total</Text>
          </View>
        )}

        {/* Reports List */}
        {displayedReports.length > 0 ? (
          <View style={styles.reportsList}>
            {displayedReports.map((report) => {
              const conf = statusConfig[report.status] || statusConfig.pending;
              const isMyReport = myReportIds.has(report.report_id);
              const metrics = getReportMetrics(report);

              return (
                <TouchableOpacity key={report.report_id} style={[styles.reportCard, { borderLeftColor: conf.accent }, activeTab === 'overall' && isMyReport && styles.myReportHighlight]} onPress={() => setSelectedReport(report)} activeOpacity={0.85}>
                  <View style={styles.reportCardHeader}>
                    <View style={styles.reportCardHeaderLeft}>
                      <View style={[styles.reportIconWrap, { backgroundColor: conf.bg }]}><Ionicons name="document-text" size={18} color={conf.text} /></View>
                      <View>
                        <View style={styles.reportIdRow}>
                          <Text style={styles.reportId}>Report #{report.report_id}</Text>
                          {activeTab === 'overall' && isMyReport && <View style={styles.youBadge}><Text style={styles.youBadgeText}>You</Text></View>}
                        </View>
                        <Text style={styles.reportDate}>{formatDate(report.submitted_at || report.created_at)}</Text>
                        {(activeTab === 'site_history' || activeTab === 'overall') && report.application && <Text style={styles.reportGroup} numberOfLines={1}>By: {report.application.group_name}</Text>}
                      </View>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: conf.bg, borderColor: conf.border }]}>
                      <View style={[styles.statusDot, { backgroundColor: conf.dot }]} />
                      <Text style={[styles.statusText, { color: conf.text }]}>{conf.label}</Text>
                    </View>
                  </View>

                  <View style={styles.progressBarWrap}>
                    <View style={styles.progressBarLabelRow}>
                      <Text style={styles.progressBarLabel}>Survival Progress</Text>
                    </View>
                    <ProgressBar value={metrics.rSurvived} max={metrics.rTotal} color={conf.accent} height={6} />
                  </View>

                  {/* ✅ UPDATED: 2-Column Grid (Primary, Dead) - Removed Rate */}
                  <View style={styles.miniMetrics}>
                    <View style={styles.miniMetric}>
                      <View style={[styles.miniMetricIconWrap, { backgroundColor: metrics.isBaseline ? "#EEF2FF" : "#ECFDF5" }]}>
                        <Ionicons name={metrics.isBaseline ? "layers" : "trending-up"} size={14} color={metrics.isBaseline ? "#4F46E5" : "#10B981"} />
                      </View>
                      <Text style={[styles.miniMetricVal, { color: metrics.isBaseline ? "#4F46E5" : "#10B981" }]}>{metrics.primaryCount.toLocaleString()}</Text>
                      <Text style={styles.miniMetricLabel}>{metrics.primaryLabel}</Text>
                    </View>
                    <View style={styles.miniMetricDivider} />
                    <View style={styles.miniMetric}>
                      <View style={[styles.miniMetricIconWrap, { backgroundColor: "#FFEBEE" }]}><Ionicons name="close-circle" size={14} color="#C62828" /></View>
                      <Text style={[styles.miniMetricVal, { color: "#C62828" }]}>{metrics.rDead.toLocaleString()}</Text>
                      <Text style={styles.miniMetricLabel}>Dead</Text>
                    </View>
                  </View>

                  {report.species && report.species.length > 0 && (
                    <View style={styles.speciesPreview}>
                      {report.species.slice(0, 3).map((sp) => (
                        <View key={sp.species_id} style={styles.speciesPill}>
                          <Ionicons name="leaf" size={10} color="#2E7D32" />
                          <Text style={styles.speciesPillText}>{sp.species_name}</Text>
                        </View>
                      ))}
                      {report.species.length > 3 && <View style={styles.moreSpeciesPill}><Text style={styles.moreSpecies}>+{report.species.length - 3}</Text></View>}
                    </View>
                  )}

                  <View style={styles.cardFooter}>
                    <Text style={styles.viewDetailsText}>View Details</Text>
                    <View style={styles.viewDetailsArrow}><Ionicons name="chevron-forward" size={14} color={WHITE} /></View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}><Ionicons name="clipboard-outline" size={40} color="#CBD5E1" /></View>
            <Text style={styles.emptyTitle}>No Reports Yet</Text>
            <Text style={styles.emptyMsg}>{activeTab === 'my_reports' ? "Progress reports will appear here once onsite inspectors submit them for your application." : activeTab === 'site_history' ? "No other reports have been submitted for this site yet." : "No reports have been submitted for this site yet."}</Text>
          </View>
        )}
      </ScrollView>

      {/* ── Species Breakdown Modal ── */}
      <Modal visible={showSpeciesModal} animationType="slide" transparent onRequestClose={() => setShowSpeciesModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.speciesModalPanel}>
            <View style={styles.modalHandle} />
            <View style={styles.speciesModalHeader}>
              <View style={styles.speciesModalTitleWrap}>
                <Ionicons name="leaf" size={20} color={PRIMARY} />
                <Text style={styles.speciesModalTitle}>Species Progress Breakdown</Text>
              </View>
              <TouchableOpacity onPress={() => setShowSpeciesModal(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
            <Text style={styles.speciesModalSubtitle}>Survived is auto-calculated: (Planted + Added) - Dead</Text>
            
            <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 16 }}>
              {speciesBreakdown.length > 0 ? (
                speciesBreakdown.map((sp, idx) => (
                  <View key={idx} style={styles.speciesCard}>
                    <View style={styles.speciesCardHeader}>
                      <View style={styles.speciesNameWrap}>
                        <Ionicons name="leaf-outline" size={16} color={PRIMARY} />
                        <Text style={styles.speciesName}>{sp.species_name}</Text>
                      </View>
                      <View style={[styles.survivalBadge, sp.survival_rate >= 80 ? styles.survivalBadgeGood : sp.survival_rate >= 50 ? styles.survivalBadgeWarn : styles.survivalBadgeBad]}>
                        <Text style={[styles.survivalBadgeText, sp.survival_rate >= 80 ? styles.survivalBadgeTextGood : sp.survival_rate >= 50 ? styles.survivalBadgeTextWarn : styles.survivalBadgeTextBad]}>
                          {sp.survival_rate.toFixed(1)}% Survival
                        </Text>
                      </View>
                    </View>
                    
                    <View style={styles.speciesMetricsGrid}>
                      <View style={styles.speciesMetricItem}>
                        <Text style={styles.speciesMetricLabel}>Officially Planted</Text>
                        <Text style={[styles.speciesMetricValue, { color: "#4F46E5" }]}>{sp.officially_planted}</Text>
                      </View>
                      <View style={styles.speciesMetricItem}>
                        <Text style={styles.speciesMetricLabel}>Added by Grower</Text>
                        <Text style={[styles.speciesMetricValue, { color: "#10B981" }]}>{sp.total_added}</Text>
                      </View>
                      <View style={styles.speciesMetricItem}>
                        <Text style={styles.speciesMetricLabel}>Total Planted</Text>
                        <Text style={[styles.speciesMetricValue, { color: "#6366F1" }]}>{sp.officially_planted + sp.total_added}</Text>
                      </View>
                      <View style={styles.speciesMetricItem}>
                        <Text style={styles.speciesMetricLabel}>Total Dead</Text>
                        <Text style={[styles.speciesMetricValue, { color: "#EF4444" }]}>{sp.total_dead}</Text>
                      </View>
                      <View style={styles.speciesMetricItem}>
                        <Text style={styles.speciesMetricLabel}>Calculated Survived</Text>
                        <Text style={[styles.speciesMetricValue, { color: "#22C55E" }]}>{sp.calculated_survived}</Text>
                      </View>
                    </View>
                    
                    <View style={styles.speciesProgressBarWrap}>
                      <ProgressBar value={sp.calculated_survived} max={sp.officially_planted + sp.total_added} color={sp.survival_rate >= 80 ? "#22C55E" : sp.survival_rate >= 50 ? "#F59E0B" : "#EF4444"} height={6} />
                    </View>
                  </View>
                ))
              ) : (
                <View style={styles.emptySpeciesState}>
                  <Ionicons name="leaf-outline" size={48} color="#CBD5E1" />
                  <Text style={styles.emptySpeciesTitle}>No Species Data</Text>
                  <Text style={styles.emptySpeciesMsg}>Species breakdown will appear here once reports with species data are accepted.</Text>
                </View>
              )}
            </ScrollView>
            
            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowSpeciesModal(false)}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Report Detail Modal ─ */}
      <Modal visible={!!selectedReport} animationType="slide" transparent onRequestClose={() => setSelectedReport(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalPanel}>
            <View style={styles.modalHandle} />
            {selectedReport && (() => {
              const m = getReportMetrics(selectedReport);
              return (
                <ScrollView showsVerticalScrollIndicator={false}>
                  <View style={styles.modalHeader}>
                    <View style={styles.modalHeaderLeft}>
                      <View style={[styles.modalHeaderIcon, { backgroundColor: (statusConfig[selectedReport.status] || statusConfig.pending).bg }]}>
                        <Ionicons name="document-text" size={20} color={(statusConfig[selectedReport.status] || statusConfig.pending).text} />
                      </View>
                      <View>
                        <Text style={styles.modalTitle}>Report #{selectedReport.report_id}</Text>
                        <Text style={styles.modalDate}>{formatDate(selectedReport.submitted_at || selectedReport.created_at)}</Text>
                        {selectedReport.application && <Text style={styles.modalGroup}>By: {selectedReport.application.group_name}</Text>}
                      </View>
                    </View>
                    <TouchableOpacity onPress={() => setSelectedReport(null)} style={styles.modalCloseBtn}><Ionicons name="close" size={22} color="#9CA3AF" /></TouchableOpacity>
                  </View>

                  <View style={[styles.modalStatusBadge, { backgroundColor: (statusConfig[selectedReport.status] || statusConfig.pending).bg, borderColor: (statusConfig[selectedReport.status] || statusConfig.pending).border }]}>
                    <View style={[styles.statusDot, { backgroundColor: (statusConfig[selectedReport.status] || statusConfig.pending).dot }]} />
                    <Text style={[styles.statusText, { color: (statusConfig[selectedReport.status] || statusConfig.pending).text }]}>{(statusConfig[selectedReport.status] || statusConfig.pending).label}</Text>
                  </View>

                  {/* ✅ UPDATED: 2-Column Grid (Primary, Dead) - Removed Rate */}
                  <View style={styles.metricsGridModal}>
                    <View style={[styles.metricBoxModal, { backgroundColor: m.isBaseline ? "#EEF2FF" : "#ECFDF5" }]}>
                      <View style={[styles.metricBoxIconWrap, { backgroundColor: m.isBaseline ? "rgba(79,70,229,0.1)" : "rgba(16,185,129,0.1)" }]}>
                        <Ionicons name={m.isBaseline ? "layers" : "trending-up"} size={20} color={m.isBaseline ? "#4F46E5" : "#10B981"} />
                      </View>
                      <Text style={[styles.metricBoxValue, { color: m.isBaseline ? "#4F46E5" : "#10B981" }]}>{m.primaryCount.toLocaleString()}</Text>
                      <Text style={styles.metricBoxLabel}>{m.primaryLabel}</Text>
                    </View>
                    <View style={[styles.metricBoxModal, { backgroundColor: "#FFEBEE" }]}>
                      <View style={[styles.metricBoxIconWrap, { backgroundColor: "rgba(198,40,40,0.1)" }]}><Ionicons name="close-circle" size={20} color="#C62828" /></View>
                      <Text style={[styles.metricBoxValue, { color: "#C62828" }]}>{m.rDead.toLocaleString()}</Text>
                      <Text style={styles.metricBoxLabel}>Dead</Text>
                    </View>
                  </View>

                  <View style={styles.overallRateBox}>
                    <View style={styles.overallRateHeader}>
                      <Text style={styles.overallRateLabel}>Report Survival Progress</Text>
                    </View>
                    <ProgressBar value={m.rSurvived} max={m.rTotal} color={PRIMARY} height={8} />
                  </View>

                  {/* ✅ UPDATED: Per-Species Breakdown (No Survived text, conditional Planted/Added) */}
                  {selectedReport.species && selectedReport.species.length > 0 && (
                    <View style={{ marginTop: 24 }}>
                      <Text style={styles.sectionTitle}>Per-Species Breakdown</Text>
                      {selectedReport.species.map((sp, idx) => (
                        <View key={idx} style={styles.speciesDetailRow}>
                          <View style={{ flex: 1 }}>
                            <View style={styles.speciesDetailTop}>
                              <View style={styles.speciesIconWrap}><Ionicons name="leaf-outline" size={16} color={PRIMARY} /></View>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.speciesDetailName}>{sp.species_name}</Text>
                                <View style={styles.speciesDetailMetaRow}>
                                  {m.isBaseline && sp.no_planted > 0 && (
                                    <>
                                      <Text style={styles.speciesDetailMeta}>Planted: {sp.no_planted}</Text>
                                      <Text style={styles.speciesDetailMetaDivider}>·</Text>
                                    </>
                                  )}
                                  {!m.isBaseline && sp.no_added_by_grower > 0 && (
                                    <>
                                      <Text style={styles.speciesDetailMeta}>Added: {sp.no_added_by_grower}</Text>
                                      <Text style={styles.speciesDetailMetaDivider}>·</Text>
                                    </>
                                  )}
                                  <Text style={styles.speciesDetailMeta}>Dead: {sp.no_dead}</Text>
                                </View>
                              </View>
                            </View>
                            <View style={{ marginTop: 8 }}>
                              <ProgressBar value={sp.no_survived} max={sp.total} color={sp.survival_rate >= 80 ? "#2E7D32" : sp.survival_rate >= 50 ? "#F59F17" : "#C62828"} height={5} />
                            </View>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}

                  {selectedReport.description && (
                    <View style={styles.descriptionBox}>
                      <View style={styles.descriptionHeader}><Ionicons name="chatbubble-ellipses-outline" size={14} color={MUTED} /><Text style={styles.descriptionLabel}>Inspector Notes</Text></View>
                      <Text style={styles.descriptionText}>{selectedReport.description}</Text>
                    </View>
                  )}

                  {selectedReport.proof_image && (
                    <View style={styles.proofImageWrap}>
                      <Text style={styles.proofImageLabel}>Proof Photo</Text>
                      <Image source={{ uri: selectedReport.proof_image.startsWith("http") ? selectedReport.proof_image : `${api}${selectedReport.proof_image}` }} style={styles.proofImage} resizeMode="cover" />
                    </View>
                  )}

                  <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedReport(null)}><Text style={styles.closeBtnText}>Close</Text></TouchableOpacity>
                  <View style={{ height: 20 }} />
                </ScrollView>
              );
            })()}
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
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 14, backgroundColor: WHITE, borderBottomWidth: 1, borderBottomColor: BORDER },
  backBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 19, fontWeight: "800", color: INK, letterSpacing: -0.3 },
  tabContainer: { flexDirection: "row", marginHorizontal: 20, marginTop: 20, backgroundColor: "#E8EDE9", borderRadius: 12, padding: 4 },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 10 },
  activeTab: { backgroundColor: WHITE, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  tabText: { fontSize: 11, fontWeight: "600", color: MUTED },
  activeTabText: { color: PRIMARY, fontWeight: "800" },
  statsBanner: { marginHorizontal: 20, marginTop: 20, borderRadius: 20, overflow: "hidden", shadowColor: PRIMARY, shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  statsBannerInner: { backgroundColor: PRIMARY, padding: 20, borderRadius: 20 },
  statsBannerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  statsBannerTitleWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  statsBannerTitle: { fontSize: 14, fontWeight: "700", color: "rgba(255,255,255,0.85)", letterSpacing: 0.3 },
  survivalRateWrap: { backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 30, padding: 4 },
  statsDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.12)", marginBottom: 16 },
  statsRowBanner: { flexDirection: "row", alignItems: "center" },
  statBox: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, justifyContent: "center" },
  statBoxDivider: { width: 1, height: 32, backgroundColor: "rgba(255,255,255,0.12)" },
  statIconWrap: { width: 32, height: 32, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  statBoxValue: { fontSize: 17, fontWeight: "800", color: WHITE },
  statBoxLabel: { fontSize: 10, color: "rgba(255,255,255,0.6)", fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 1 },
  speciesBreakdownBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "rgba(255,255,255,0.15)", paddingVertical: 12, borderRadius: 12, marginTop: 16 },
  speciesBreakdownBtnText: { color: WHITE, fontSize: 14, fontWeight: "700" },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, marginTop: 24, marginBottom: 10 },
  sectionHeaderTitle: { fontSize: 16, fontWeight: "800", color: INK, letterSpacing: -0.3 },
  sectionHeaderCount: { fontSize: 12, fontWeight: "600", color: MUTED, backgroundColor: "#E8EDE9", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  reportsList: { paddingHorizontal: 20, gap: 14 },
  reportCard: { backgroundColor: CARD_BG, borderRadius: 20, padding: 18, borderLeftWidth: 4, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 12, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  myReportHighlight: { backgroundColor: "#FAFFFE", borderWidth: 1, borderColor: "#D1FAE5" },
  reportCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 },
  reportCardHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  reportIconWrap: { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  reportIdRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  reportId: { fontSize: 16, fontWeight: "800", color: INK, letterSpacing: -0.2 },
  reportDate: { fontSize: 12, color: MUTED, marginTop: 2 },
  reportGroup: { fontSize: 11, color: PRIMARY, fontWeight: "600", marginTop: 2 },
  youBadge: { backgroundColor: PRIMARY, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  youBadgeText: { fontSize: 9, fontWeight: "700", color: WHITE, textTransform: "uppercase" },
  statusBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, gap: 5, borderWidth: 1 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  progressBarWrap: { marginBottom: 14 },
  progressBarLabelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  progressBarLabel: { fontSize: 11, fontWeight: "600", color: MUTED },
  miniMetrics: { flexDirection: "row", backgroundColor: "#F8FAFC", borderRadius: 16, paddingVertical: 12, paddingHorizontal: 8, marginBottom: 12 },
  miniMetric: { flex: 1, alignItems: "center" },
  miniMetricDivider: { width: 1, backgroundColor: "#E2E8F0", marginVertical: 4 },
  miniMetricIconWrap: { width: 28, height: 28, borderRadius: 8, justifyContent: "center", alignItems: "center", marginBottom: 4 },
  miniMetricVal: { fontSize: 13, fontWeight: "800", color: "#2E7D32" },
  miniMetricLabel: { fontSize: 9, color: MUTED, marginTop: 1, fontWeight: "600", textAlign: "center" },
  speciesPreview: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 14 },
  speciesPill: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#E8F5E9", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  speciesPillText: { fontSize: 11, color: "#2E7D32", fontWeight: "600" },
  moreSpeciesPill: { backgroundColor: "#F1F5F9", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  moreSpecies: { fontSize: 11, color: MUTED, fontWeight: "600" },
  cardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 6, borderTopWidth: 1, borderTopColor: "#F1F5F9", paddingTop: 12 },
  viewDetailsText: { fontSize: 13, fontWeight: "700", color: PRIMARY },
  viewDetailsArrow: { width: 22, height: 22, borderRadius: 11, backgroundColor: PRIMARY, justifyContent: "center", alignItems: "center" },
  emptyState: { alignItems: "center", marginTop: 80, paddingHorizontal: 32 },
  emptyIconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: "#F1F5F9", justifyContent: "center", alignItems: "center", marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: INK, marginBottom: 6 },
  emptyMsg: { fontSize: 13, color: MUTED, textAlign: "center", lineHeight: 20 },
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  modalPanel: { backgroundColor: WHITE, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingBottom: 32, maxHeight: "92%", shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 20, shadowOffset: { width: 0, height: -4 }, elevation: 10 },
  speciesModalPanel: { backgroundColor: WHITE, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingBottom: 32, maxHeight: "90%", shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 20, shadowOffset: { width: 0, height: -4 }, elevation: 10 },
  modalHandle: { width: 40, height: 4, backgroundColor: "#E5E7EB", borderRadius: 2, alignSelf: "center", marginTop: 12, marginBottom: 20 },
  speciesModalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  speciesModalTitleWrap: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  speciesModalTitle: { fontSize: 18, fontWeight: "800", color: INK, letterSpacing: -0.2 },
  speciesModalSubtitle: { fontSize: 12, color: MUTED, marginTop: 4 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  modalHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  modalHeaderIcon: { width: 44, height: 44, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  modalTitle: { fontSize: 18, fontWeight: "800", color: INK, letterSpacing: -0.2 },
  modalDate: { fontSize: 12, color: MUTED, marginTop: 2 },
  modalGroup: { fontSize: 11, color: PRIMARY, fontWeight: "600", marginTop: 2 },
  modalCloseBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F3F4F6", justifyContent: "center", alignItems: "center" },
  modalStatusBadge: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 6, borderWidth: 1, marginTop: 12, marginBottom: 18 },
  metricsGridModal: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metricBoxModal: { width: "48%", borderRadius: 18, padding: 14, alignItems: "center" },
  metricBoxIconWrap: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center", marginBottom: 6 },
  metricBoxValue: { fontSize: 16, fontWeight: "800", color: "#2E7D32", marginTop: 2 },
  metricBoxLabel: { fontSize: 9, color: MUTED, marginTop: 2, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, textAlign: "center" },
  overallRateBox: { backgroundColor: "#F8FAFC", borderRadius: 16, padding: 16, marginTop: 16 },
  overallRateHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  overallRateLabel: { fontSize: 12, fontWeight: "700", color: MUTED, textTransform: "uppercase", letterSpacing: 0.5 },
  sectionTitle: { fontSize: 14, fontWeight: "800", color: INK, marginBottom: 12, letterSpacing: -0.2 },
  speciesDetailRow: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  speciesDetailTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  speciesIconWrap: { width: 38, height: 38, borderRadius: 12, backgroundColor: "#E8F5E9", justifyContent: "center", alignItems: "center" },
  speciesDetailName: { fontSize: 14, fontWeight: "700", color: INK },
  speciesDetailMetaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  speciesDetailMeta: { fontSize: 12, color: MUTED, fontWeight: "600" },
  speciesDetailMetaDivider: { fontSize: 12, color: "#D1D5DB" },
  descriptionBox: { backgroundColor: "#F8FAFC", borderRadius: 16, padding: 16, marginTop: 20 },
  descriptionHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  descriptionLabel: { fontSize: 11, color: MUTED, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  descriptionText: { fontSize: 14, color: INK, lineHeight: 22 },
  proofImageWrap: { marginTop: 20 },
  proofImageLabel: { fontSize: 11, color: MUTED, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  proofImage: { width: "100%", height: 220, borderRadius: 16 },
  closeBtn: { backgroundColor: PRIMARY, borderRadius: 16, padding: 16, alignItems: "center", marginTop: 24, shadowColor: PRIMARY, shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  closeBtnText: { color: WHITE, fontWeight: "700", fontSize: 14, letterSpacing: 0.3 },
  speciesCard: { backgroundColor: "#F9FAFB", borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: BORDER },
  speciesCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  speciesNameWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  speciesName: { fontSize: 15, fontWeight: "700", color: INK },
  survivalBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  survivalBadgeGood: { backgroundColor: "#DCFCE7", borderWidth: 1, borderColor: "#86EFAC" },
  survivalBadgeWarn: { backgroundColor: "#FEF3C7", borderWidth: 1, borderColor: "#FCD34D" },
  survivalBadgeBad: { backgroundColor: "#FEE2E2", borderWidth: 1, borderColor: "#FECACA" },
  survivalBadgeText: { fontSize: 11, fontWeight: "700" },
  survivalBadgeTextGood: { color: "#166534" },
  survivalBadgeTextWarn: { color: "#B45309" },
  survivalBadgeTextBad: { color: "#991B1B" },
  speciesMetricsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  speciesMetricItem: { width: "48%", backgroundColor: WHITE, borderRadius: 10, padding: 10, alignItems: "center" },
  speciesMetricLabel: { fontSize: 10, color: MUTED, fontWeight: "600", textAlign: "center", marginBottom: 4 },
  speciesMetricValue: { fontSize: 16, fontWeight: "800" },
  speciesProgressBarWrap: { marginTop: 12 },
  emptySpeciesState: { alignItems: "center", paddingVertical: 40 },
  emptySpeciesTitle: { fontSize: 16, fontWeight: "700", color: INK, marginTop: 12, marginBottom: 6 },
  emptySpeciesMsg: { fontSize: 13, color: MUTED, textAlign: "center", lineHeight: 18, paddingHorizontal: 20 },
});