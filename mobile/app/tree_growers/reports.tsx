import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/constants/url_fixed";

const API_BASE = api + "/api";

// ─── Types ───────────────────────────────────────────────────────────────────

type ApplicationSummary = {
  application_id: number;
  title: string;
  description: string;
  status: string;
  created_at: string;
  updated_at: string;
  orientation_date: string | null;
  total_request_seedling: number;
  total_seedling_provided: number;
  total_seedling_planted: number;
  total_seedling_survived: number;
  total_area_planted: string;
};

type Report = {
  maintenance_report_id: number;
  title: string;
  description: string;
  status: string;
  total_seedling_planted: number;
  total_seedling_survived: number;
  total_area_planted: string;
  total_owned_seedling_planted: number;
  total_member_present: number | null;
  created_at: string;
  submitted_at: string | null;
};

type FilterKey = "all" | "for_evaluation" | "accepted" | "rejected" | "for_head";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string; icon: string }> = {
  for_evaluation: { label: "For Evaluation", bg: "#FFF8E1", text: "#F57F17", dot: "#F9A825", icon: "time-outline" },
  for_head:       { label: "For Head Review", bg: "#E3F2FD", text: "#1565C0", dot: "#1976D2", icon: "person-outline" },
  accepted:       { label: "Accepted",        bg: "#E8F5E9", text: "#2E7D32", dot: "#388E3C", icon: "checkmark-circle-outline" },
  rejected:       { label: "Rejected",        bg: "#FFEBEE", text: "#C62828", dot: "#D32F2F", icon: "close-circle-outline" },
  pending:        { label: "Pending",         bg: "#FFF8E1", text: "#F57F17", dot: "#F9A825", icon: "time-outline" },
  for_endorsement:{ label: "For Endorsement", bg: "#E3F2FD", text: "#1565C0", dot: "#1976D2", icon: "send-outline" },
  active:         { label: "Active",          bg: "#E8F5E9", text: "#2E7D32", dot: "#388E3C", icon: "checkmark-circle-outline" },
};

const getConf = (s: string) =>
  STATUS_CONFIG[s] ?? { label: s, bg: "#F5F5F5", text: "#555", dot: "#999", icon: "ellipse-outline" };

const fmt = (iso: string) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
};

const safeFloat = (v: string | number) => {
  const n = parseFloat(String(v));
  return isNaN(n) ? "0.00" : n.toFixed(2);
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const StatusBadge = ({ status, small }: { status: string; small?: boolean }) => {
  const c = getConf(status);
  return (
    <View style={[badge.wrap, { backgroundColor: c.bg }, small && badge.small]}>
      <View style={[badge.dot, { backgroundColor: c.dot }]} />
      <Text style={[badge.text, { color: c.text }, small && badge.smallText]}>{c.label}</Text>
    </View>
  );
};

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ReportsScreen() {
  const [application, setApplication] = useState<ApplicationSummary | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [selected, setSelected] = useState<Report | null>(null);

  const fetchAll = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      setError(null);
      const token = await SecureStore.getItemAsync("token");
      if (!token) throw new Error("Not authenticated.");

      const appRes = await fetch(`${API_BASE}/get_tree_grower_application/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!appRes.ok) throw new Error(`Failed to load application (${appRes.status})`);
      const appData = await appRes.json();
      const app: ApplicationSummary = appData.application;
      setApplication(app);

      const repRes = await fetch(
        `${API_BASE}/get_tree_grower_maintenance_reports/${app.application_id}/`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (repRes.ok) {
        const repData = await repRes.json();
        setReports(Array.isArray(repData) ? repData : repData.reports ?? []);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, []);

  const onRefresh = () => { setRefreshing(true); fetchAll(true); };

  const FILTERS: { key: FilterKey; label: string }[] = [
    { key: "all",            label: "All" },
    { key: "for_evaluation", label: "Pending" },
    { key: "for_head",       label: "Review" },
    { key: "accepted",       label: "Accepted" },
    { key: "rejected",       label: "Rejected" },
  ];

  const filtered = filter === "all"
    ? reports
    : reports.filter((r) =>
        filter === "for_evaluation"
          ? r.status === "for_evaluation" || r.status === "pending"
          : r.status === filter
      );

  const counts = {
    accepted: reports.filter((r) => r.status === "accepted").length,
    rejected: reports.filter((r) => r.status === "rejected").length,
    pending: reports.filter((r) => r.status === "for_evaluation" || r.status === "pending").length,
  };

  // ── Loading ──
  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#0F4A2F" />
        <Text style={s.loadingTxt}>Loading history…</Text>
      </View>
    );
  }

  // ── Error ──
  if (error || !application) {
    return (
      <View style={s.center}>
        <View style={s.errIconWrap}>
          <Ionicons name="document-text-outline" size={36} color="#0F4A2F" />
        </View>
        <Text style={s.errTitle}>Couldn't Load</Text>
        <Text style={s.errMsg}>{error ?? "No application found."}</Text>
        <TouchableOpacity style={s.retryBtn} onPress={() => fetchAll()}>
          <Ionicons name="refresh" size={16} color="#fff" />
          <Text style={s.retryTxt}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0F4A2F" />
        }
        contentContainerStyle={s.scroll}
      >
        {/* ── Application Card ── */}
        <View style={s.appCard}>
          <View style={s.appCardTop}>
            <View style={s.appIconWrap}>
              <Ionicons name="leaf" size={22} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.appCardTitle} numberOfLines={2}>{application.title}</Text>
              <Text style={s.appCardSub}>Tree Planting Program</Text>
            </View>
            <StatusBadge status={application.status} />
          </View>

          {/* Progress bar: survived / planted */}
          {application.total_seedling_planted > 0 && (
            <View style={s.progressSection}>
              <View style={s.progressRow}>
                <Text style={s.progressLabel}>Survival Rate</Text>
                <Text style={s.progressPct}>
                  {Math.round((application.total_seedling_survived / application.total_seedling_planted) * 100)}%
                </Text>
              </View>
              <View style={s.progressTrack}>
                <View
                  style={[
                    s.progressFill,
                    {
                      width: `${Math.min(
                        100,
                        Math.round((application.total_seedling_survived / application.total_seedling_planted) * 100)
                      )}%`,
                    },
                  ]}
                />
              </View>
            </View>
          )}

          {/* Stats row */}
          <View style={s.statsRow}>
            {[
              { label: "Requested", value: application.total_request_seedling, icon: "leaf-outline" },
              { label: "Planted",   value: application.total_seedling_planted,  icon: "earth-outline" },
              { label: "Survived",  value: application.total_seedling_survived, icon: "heart-outline" },
            ].map((m, i) => (
              <React.Fragment key={i}>
                {i > 0 && <View style={s.statsDivider} />}
                <View style={s.statItem}>
                  <Text style={s.statVal}>{m.value.toLocaleString()}</Text>
                  <Text style={s.statLbl}>{m.label}</Text>
                </View>
              </React.Fragment>
            ))}
          </View>

          {/* Key dates */}
          <View style={s.datesWrap}>
            <View style={s.dateChip}>
              <Ionicons name="calendar-outline" size={12} color="#5FD08A" />
              <Text style={s.dateChipTxt}>Submitted {fmt(application.created_at)}</Text>
            </View>
            {application.orientation_date && (
              <View style={s.dateChip}>
                <Ionicons name="people-outline" size={12} color="#5FD08A" />
                <Text style={s.dateChipTxt}>Orientation {fmt(application.orientation_date)}</Text>
              </View>
            )}
            <View style={s.dateChip}>
              <Ionicons name="map-outline" size={12} color="#5FD08A" />
              <Text style={s.dateChipTxt}>{safeFloat(application.total_area_planted)} ha planted</Text>
            </View>
          </View>
        </View>

        {/* ── Summary Chips ── */}
        <View style={s.chipsRow}>
          <View style={[s.chip, { backgroundColor: "#E8F5E9" }]}>
            <Ionicons name="checkmark-circle-outline" size={16} color="#2E7D32" />
            <Text style={[s.chipTxt, { color: "#2E7D32" }]}>{counts.accepted} Accepted</Text>
          </View>
          <View style={[s.chip, { backgroundColor: "#FFF8E1" }]}>
            <Ionicons name="time-outline" size={16} color="#F57F17" />
            <Text style={[s.chipTxt, { color: "#F57F17" }]}>{counts.pending} Pending</Text>
          </View>
          <View style={[s.chip, { backgroundColor: "#FFEBEE" }]}>
            <Ionicons name="close-circle-outline" size={16} color="#C62828" />
            <Text style={[s.chipTxt, { color: "#C62828" }]}>{counts.rejected} Rejected</Text>
          </View>
        </View>

        {/* ── Filter Tabs ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.filterScroll}
        >
          {FILTERS.map((f) => {
            const active = filter === f.key;
            const count = f.key === "all" ? reports.length
              : f.key === "for_evaluation" ? counts.pending
              : reports.filter((r) => r.status === f.key).length;
            return (
              <TouchableOpacity
                key={f.key}
                style={[s.filterTab, active && s.filterTabActive]}
                onPress={() => setFilter(f.key)}
              >
                <Text style={[s.filterTabTxt, active && s.filterTabTxtActive]}>{f.label}</Text>
                {count > 0 && (
                  <View style={[s.filterBadge, active && s.filterBadgeActive]}>
                    <Text style={[s.filterBadgeTxt, active && s.filterBadgeTxtActive]}>{count}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Section heading ── */}
        <View style={s.historyHeader}>
          <Text style={s.historyTitle}>Maintenance Reports</Text>
          <Text style={s.historyCount}>{filtered.length} record{filtered.length !== 1 ? "s" : ""}</Text>
        </View>

        {/* ── Timeline ── */}
        {filtered.length === 0 ? (
          <View style={s.empty}>
            <View style={s.emptyIcon}>
              <Ionicons name="document-outline" size={36} color="#0F4A2F" />
            </View>
            <Text style={s.emptyTitle}>No Reports Found</Text>
            <Text style={s.emptyMsg}>
              {filter === "all"
                ? "You haven't submitted any maintenance reports yet."
                : `No reports with "${FILTERS.find((f) => f.key === filter)?.label}" status.`}
            </Text>
          </View>
        ) : (
          <View style={s.timeline}>
            {filtered.map((report, idx) => {
              const conf = getConf(report.status);
              const isLast = idx === filtered.length - 1;
              return (
                <TouchableOpacity
                  key={report.maintenance_report_id}
                  onPress={() => setSelected(report)}
                  activeOpacity={0.75}
                  style={s.timelineItem}
                >
                  {/* Vertical line */}
                  <View style={s.timelineLeft}>
                    <View style={[s.timelineDot, { backgroundColor: conf.dot }]}>
                      <Ionicons name={conf.icon as any} size={12} color="#fff" />
                    </View>
                    {!isLast && <View style={s.timelineLine} />}
                  </View>

                  {/* Card */}
                  <View style={[s.reportCard, isLast && { marginBottom: 0 }]}>
                    <View style={s.reportCardTop}>
                      <Text style={s.reportCardTitle} numberOfLines={1}>{report.title}</Text>
                      <StatusBadge status={report.status} small />
                    </View>

                    <Text style={s.reportCardDesc} numberOfLines={2}>{report.description}</Text>

                    {/* Mini stats */}
                    <View style={s.miniStats}>
                      {[
                        { icon: "leaf-outline",    label: "Planted",  val: report.total_seedling_planted },
                        { icon: "heart-outline",   label: "Survived", val: report.total_seedling_survived },
                        { icon: "map-outline",     label: "Area",     val: `${safeFloat(report.total_area_planted)} ha` },
                        { icon: "people-outline",  label: "Members",  val: report.total_member_present ?? "—" },
                      ].map((m, i) => (
                        <View key={i} style={s.miniStatItem}>
                          <Ionicons name={m.icon as any} size={13} color="#0F4A2F" />
                          <Text style={s.miniStatVal}>{m.val}</Text>
                          <Text style={s.miniStatLbl}>{m.label}</Text>
                        </View>
                      ))}
                    </View>

                    <View style={s.reportCardFoot}>
                      <View style={s.reportDateRow}>
                        <Ionicons name="calendar-outline" size={12} color="#9CA3AF" />
                        <Text style={s.reportDateTxt}>{fmt(report.created_at)}</Text>
                      </View>
                      <View style={s.reportCta}>
                        <Text style={s.reportCtaTxt}>View Details</Text>
                        <Ionicons name="chevron-forward" size={13} color="#0F4A2F" />
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* ── Detail Modal ── */}
      <Modal
        visible={!!selected}
        animationType="slide"
        transparent
        onRequestClose={() => setSelected(null)}
      >
        <View style={m.overlay}>
          <View style={m.panel}>
            <View style={m.handle} />
            {selected && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={m.headerRow}>
                  <Text style={m.title}>{selected.title}</Text>
                  <StatusBadge status={selected.status} />
                </View>
                <Text style={m.date}>Submitted on {fmt(selected.created_at)}</Text>
                {selected.submitted_at && (
                  <Text style={m.date}>Reviewed on {fmt(selected.submitted_at)}</Text>
                )}

                <Text style={m.desc}>{selected.description}</Text>

                <Text style={m.sectionLabel}>Metrics</Text>
                <View style={m.metricsBox}>
                  {[
                    { label: "Members Present",    value: selected.total_member_present ?? "—" },
                    { label: "Seedlings Planted",  value: selected.total_seedling_planted },
                    { label: "Seedlings Survived", value: selected.total_seedling_survived },
                    { label: "Owned Seedlings",    value: selected.total_owned_seedling_planted },
                    { label: "Area Planted",       value: `${safeFloat(selected.total_area_planted)} ha` },
                  ].map((row, i) => (
                    <View key={i} style={m.metricRow}>
                      <Text style={m.metricLabel}>{row.label}</Text>
                      <Text style={m.metricVal}>{row.value}</Text>
                    </View>
                  ))}
                </View>

                {selected.status === "rejected" && (
                  <View style={m.rejectedBox}>
                    <Ionicons name="close-circle-outline" size={18} color="#C62828" />
                    <View style={{ flex: 1 }}>
                      <Text style={m.rejectedTitle}>Report Rejected</Text>
                      <Text style={m.rejectedMsg}>
                        Please go to Application tab and submit an updated maintenance report.
                      </Text>
                    </View>
                  </View>
                )}

                <TouchableOpacity style={m.closeBtn} onPress={() => setSelected(null)}>
                  <Text style={m.closeTxt}>Close</Text>
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

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F7F5" },
  scroll: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16 },

  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
  loadingTxt: { marginTop: 14, color: "#6B7280", fontSize: 14 },

  errIconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: "#E8F5E9", justifyContent: "center", alignItems: "center", marginBottom: 16,
  },
  errTitle: { fontSize: 20, fontWeight: "700", color: "#111827", marginBottom: 6 },
  errMsg: { fontSize: 14, color: "#6B7280", textAlign: "center", marginBottom: 24, lineHeight: 20 },
  retryBtn: {
    flexDirection: "row", gap: 6, alignItems: "center",
    backgroundColor: "#0F4A2F", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12,
  },
  retryTxt: { color: "#fff", fontWeight: "700", fontSize: 14 },

  // Application card
  appCard: {
    backgroundColor: "#0F4A2F",
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    shadowColor: "#0F4A2F",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  appCardTop: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 14 },
  appIconWrap: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center", alignItems: "center",
  },
  appCardTitle: { fontSize: 16, fontWeight: "800", color: "#fff", lineHeight: 22, flex: 1 },
  appCardSub: { fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 2 },

  progressSection: { marginBottom: 14 },
  progressRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  progressLabel: { fontSize: 11, color: "rgba(255,255,255,0.65)", fontWeight: "600" },
  progressPct: { fontSize: 11, color: "#5FD08A", fontWeight: "700" },
  progressTrack: {
    height: 6, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 3, overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: "#5FD08A", borderRadius: 3 },

  statsRow: {
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  statsDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.12)" },
  statItem: { flex: 1, alignItems: "center" },
  statVal: { fontSize: 18, fontWeight: "800", color: "#fff" },
  statLbl: { fontSize: 10, color: "rgba(255,255,255,0.6)", marginTop: 2 },

  datesWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  dateChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  dateChipTxt: { fontSize: 11, color: "rgba(255,255,255,0.8)", fontWeight: "500" },

  // Summary chips
  chipsRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  chip: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 5, paddingVertical: 10, borderRadius: 12,
  },
  chipTxt: { fontSize: 12, fontWeight: "700" },

  // Filter tabs
  filterScroll: { paddingRight: 16, marginBottom: 0 },
  filterTab: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, backgroundColor: "#fff",
    marginRight: 8,
    borderWidth: 1.5, borderColor: "#E5E7EB",
  },
  filterTabActive: { backgroundColor: "#0F4A2F", borderColor: "#0F4A2F" },
  filterTabTxt: { fontSize: 13, fontWeight: "600", color: "#6B7280" },
  filterTabTxtActive: { color: "#fff" },
  filterBadge: {
    minWidth: 20, height: 20, borderRadius: 10,
    backgroundColor: "#E5E7EB", alignItems: "center", justifyContent: "center",
    paddingHorizontal: 5,
  },
  filterBadgeActive: { backgroundColor: "rgba(255,255,255,0.2)" },
  filterBadgeTxt: { fontSize: 10, fontWeight: "700", color: "#6B7280" },
  filterBadgeTxtActive: { color: "#fff" },

  // History header
  historyHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginTop: 16, marginBottom: 12,
  },
  historyTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },
  historyCount: { fontSize: 12, color: "#9CA3AF", fontWeight: "500" },

  // Timeline
  timeline: { paddingLeft: 4 },
  timelineItem: { flexDirection: "row", gap: 12, marginBottom: 12 },
  timelineLeft: { alignItems: "center", width: 28, paddingTop: 2 },
  timelineDot: {
    width: 28, height: 28, borderRadius: 14,
    justifyContent: "center", alignItems: "center",
    zIndex: 1,
  },
  timelineLine: {
    flex: 1, width: 2, backgroundColor: "#E5E7EB",
    marginTop: 4, marginBottom: -12,
  },

  // Report card
  reportCard: {
    flex: 1, backgroundColor: "#fff", borderRadius: 16, padding: 14,
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  reportCardTop: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "flex-start", gap: 8, marginBottom: 6,
  },
  reportCardTitle: { fontSize: 14, fontWeight: "700", color: "#111827", flex: 1 },
  reportCardDesc: { fontSize: 12, color: "#6B7280", lineHeight: 17, marginBottom: 10 },

  miniStats: {
    flexDirection: "row", backgroundColor: "#F4F7F5",
    borderRadius: 10, paddingVertical: 8, paddingHorizontal: 4,
    marginBottom: 10,
  },
  miniStatItem: { flex: 1, alignItems: "center", gap: 2 },
  miniStatVal: { fontSize: 13, fontWeight: "800", color: "#0F4A2F" },
  miniStatLbl: { fontSize: 9, color: "#9CA3AF" },

  reportCardFoot: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    borderTopWidth: 1, borderTopColor: "#F3F4F6", paddingTop: 8,
  },
  reportDateRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  reportDateTxt: { fontSize: 11, color: "#9CA3AF" },
  reportCta: { flexDirection: "row", alignItems: "center", gap: 3 },
  reportCtaTxt: { fontSize: 12, fontWeight: "700", color: "#0F4A2F" },

  // Empty
  empty: { alignItems: "center", paddingVertical: 56 },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: "#E8F5E9", justifyContent: "center", alignItems: "center", marginBottom: 16,
  },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#111827", marginBottom: 6 },
  emptyMsg: { fontSize: 13, color: "#6B7280", textAlign: "center", maxWidth: 260, lineHeight: 20 },
});

const badge = StyleSheet.create({
  wrap: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 20, gap: 5,
  },
  small: { paddingHorizontal: 6, paddingVertical: 3 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  smallText: { fontSize: 9 },
});

const m = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
  panel: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingBottom: 32,
    maxHeight: "88%",
  },
  handle: {
    width: 40, height: 4, backgroundColor: "#E5E7EB",
    borderRadius: 2, alignSelf: "center", marginTop: 12, marginBottom: 20,
  },
  headerRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "flex-start", marginBottom: 6, gap: 8,
  },
  title: { fontSize: 18, fontWeight: "800", color: "#111827", flex: 1 },
  date: { fontSize: 12, color: "#9CA3AF", marginBottom: 4 },
  desc: { fontSize: 14, color: "#4B5563", lineHeight: 21, marginTop: 10, marginBottom: 16 },
  sectionLabel: {
    fontSize: 11, fontWeight: "700", color: "#6B7280",
    textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10,
  },
  metricsBox: { backgroundColor: "#F4F7F5", borderRadius: 14, padding: 12, marginBottom: 16 },
  metricRow: {
    flexDirection: "row", justifyContent: "space-between",
    paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: "#E9F0EC",
  },
  metricLabel: { fontSize: 13, color: "#6B7280" },
  metricVal: { fontSize: 13, fontWeight: "700", color: "#0F4A2F" },
  rejectedBox: {
    backgroundColor: "#FFEBEE", borderRadius: 12, padding: 14,
    marginBottom: 16, flexDirection: "row", gap: 10, alignItems: "flex-start",
    borderLeftWidth: 4, borderLeftColor: "#D32F2F",
  },
  rejectedTitle: { fontSize: 13, fontWeight: "700", color: "#C62828", marginBottom: 3 },
  rejectedMsg: { fontSize: 12, color: "#C62828", lineHeight: 17 },
  closeBtn: {
    backgroundColor: "#F4F7F5", borderRadius: 14, padding: 15, alignItems: "center", marginTop: 4,
  },
  closeTxt: { color: "#0F4A2F", fontWeight: "700", fontSize: 14 },
});
