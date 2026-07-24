import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
  classification: string;
  created_at: string;
  updated_at: string;
  orientation_date: string | null;
  confirmed_at: string | null;
  total_request_seedling: number;
  total_seedling_provided: number;
  total_seedling_planted: number;
  total_seedling_survived: number;
  total_area_planted: string;
  reports: Report[];
};

type Report = {
  report_id: number;
  visit_type: string;
  orientation_conducted: boolean;
  total_survived: number;
  total_dead: number;
  total_added_by_grower: number;
  species: {
    species_id: number;
    species_name: string;
    no_planted: number;
    no_added_by_grower: number;
    no_survived: number;
    no_dead: number;
    survival_rate: number;
  }[];
  description: string | null;
  status: string;
  proof_image: string | null;
  submitted_at: string | null;
  created_at: string;
};

type FilterKey =
  | "all"
  | "for_evaluation"
  | "accepted"
  | "rejected"
  | "for_head";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; dot: string; icon: string }
> = {
  for_evaluation: {
    label: "For Evaluation",
    bg: "#FFF8E1",
    text: "#F57F17",
    dot: "#F9A825",
    icon: "time-outline",
  },
  for_head: {
    label: "For Head Review",
    bg: "#E3F2FD",
    text: "#1565C0",
    dot: "#1976D2",
    icon: "person-outline",
  },
  accepted: {
    label: "Accepted",
    bg: "#E8F5E9",
    text: "#2E7D32",
    dot: "#388E3C",
    icon: "checkmark-circle-outline",
  },
  rejected: {
    label: "Rejected",
    bg: "#FFEBEE",
    text: "#C62828",
    dot: "#D32F2F",
    icon: "close-circle-outline",
  },
  completed: {
    label: "Completed",
    bg: "#E0F2FE",
    text: "#0284C7",
    dot: "#0EA5E9",
    icon: "checkmark-done-outline",
  },
  pending: {
    label: "Pending",
    bg: "#FFF8E1",
    text: "#F57F17",
    dot: "#F9A825",
    icon: "time-outline",
  },
  under_monitoring: {
    label: "Under Monitoring",
    bg: "#E8F5E9",
    text: "#2E7D32",
    dot: "#388E3C",
    icon: "leaf-outline",
  },
};

const getConf = (s: string | undefined) => {
  const config = s ? STATUS_CONFIG[s] : undefined;
  return (
    config ?? {
      label: (s || "Unknown").toUpperCase(),
      bg: "#F5F5F5",
      text: "#555",
      dot: "#999",
      icon: "ellipse-outline",
    }
  );
};

const fmt = (iso: string | null | undefined) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const StatusBadge = ({
  status,
  small,
}: {
  status: string | undefined;
  small?: boolean;
}) => {
  const c = getConf(status);
  return (
    <View style={[badge.wrap, { backgroundColor: c.bg }, small && badge.small]}>
      <View style={[badge.dot, { backgroundColor: c.dot }]} />
      <Text style={[badge.text, { color: c.text }, small && badge.smallText]}>
        {c.label}
      </Text>
    </View>
  );
};

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ReportsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [applications, setApplications] = useState<ApplicationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [expandedApp, setExpandedApp] = useState<number | null>(null);

  const fetchAll = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      setError(null);
      const token = await SecureStore.getItemAsync("token");
      if (!token) throw new Error("Not authenticated.");

      const res = await fetch(
        `${API_BASE}/get_tree_grower_application_history/`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!res.ok) throw new Error(`Failed to load history (${res.status})`);

      const data = await res.json();
      setApplications(data.applications || []);

      if (data.applications && data.applications.length > 0) {
        setExpandedApp(data.applications[0].application_id);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAll(true);
  };

  const FILTERS: { key: FilterKey; label: string }[] = [
    { key: "all", label: "All" },
    { key: "for_evaluation", label: "Pending" },
    { key: "for_head", label: "Review" },
    { key: "accepted", label: "Accepted" },
    { key: "rejected", label: "Rejected" },
  ];

  const getAllReports = () => applications.flatMap((app) => app.reports);

  const getApplicationMetrics = (app: ApplicationSummary) => {
    const acceptedReports = app.reports.filter((r) => r.status === "accepted");

    const sortedAcceptedReports = [...acceptedReports].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    const latestReport = sortedAcceptedReports[0] || null;

    const initialReport = acceptedReports.find(
      (r) => r.visit_type === "initial",
    );
    const initialPlanted =
      initialReport?.species.reduce((sum, sp) => sum + sp.no_planted, 0) || 0;

    const totalAddedByGrower = acceptedReports.reduce(
      (sum, rep) => sum + (rep.total_added_by_grower || 0),
      0,
    );

    const totalPlanted = initialPlanted + totalAddedByGrower;
    const totalSurvived = latestReport?.total_survived || 0;
    const survivalRate =
      totalPlanted > 0 ? (totalSurvived / totalPlanted) * 100 : 0;

    return {
      totalPlanted,
      totalSurvived,
      survivalRate,
    };
  };

  const counts = {
    accepted: getAllReports().filter(
      (r) =>
        r.status === "accepted" ||
        r.status === "completed" ||
        r.status === "under_monitoring",
    ).length,
    rejected: getAllReports().filter((r) => r.status === "rejected").length,
    pending: getAllReports().filter(
      (r) => r.status === "for_evaluation" || r.status === "pending",
    ).length,
  };

  const toggleExpand = (appId: number) => {
    setExpandedApp(expandedApp === appId ? null : appId);
  };

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#0F4A2F" />
        <Text style={s.loadingTxt}>Loading history…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={s.center}>
        <View style={s.errIconWrap}>
          <Ionicons name="document-text-outline" size={36} color="#0F4A2F" />
        </View>
        <Text style={s.errTitle}>Couldn't Load</Text>
        <Text style={s.errMsg}>{error}</Text>
        <TouchableOpacity style={s.retryBtn} onPress={() => fetchAll()}>
          <Ionicons name="refresh" size={16} color="#fff" />
          <Text style={s.retryTxt}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (applications.length === 0) {
    return (
      <View style={s.center}>
        <View style={s.errIconWrap}>
          <Ionicons name="leaf-outline" size={36} color="#0F4A2F" />
        </View>
        <Text style={s.errTitle}>No Applications Yet</Text>
        <Text style={s.errMsg}>
          You haven't submitted any tree planting applications yet.
        </Text>
      </View>
    );
  }

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#0F4A2F"
          />
        }
        contentContainerStyle={s.scroll}
      >
        {/* ── Summary Chips ── */}
        <View style={s.chipsRow}>
          <View style={[s.chip, { backgroundColor: "#E8F5E9" }]}>
            <Ionicons
              name="checkmark-circle-outline"
              size={16}
              color="#2E7D32"
            />
            <Text style={[s.chipTxt, { color: "#2E7D32" }]}>
              {counts.accepted} Accepted
            </Text>
          </View>
          <View style={[s.chip, { backgroundColor: "#FFF8E1" }]}>
            <Ionicons name="time-outline" size={16} color="#F57F17" />
            <Text style={[s.chipTxt, { color: "#F57F17" }]}>
              {counts.pending} Pending
            </Text>
          </View>
          <View style={[s.chip, { backgroundColor: "#FFEBEE" }]}>
            <Ionicons name="close-circle-outline" size={16} color="#C62828" />
            <Text style={[s.chipTxt, { color: "#C62828" }]}>
              {counts.rejected} Rejected
            </Text>
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
            const count =
              f.key === "all"
                ? applications.length
                : f.key === "for_evaluation"
                  ? counts.pending
                  : applications.filter((app) => app.status === f.key).length;

            return (
              <TouchableOpacity
                key={f.key}
                style={[s.filterTab, active && s.filterTabActive]}
                onPress={() => setFilter(f.key)}
              >
                <Text style={[s.filterTabTxt, active && s.filterTabTxtActive]}>
                  {f.label}
                </Text>
                {count > 0 && (
                  <View style={[s.filterBadge, active && s.filterBadgeActive]}>
                    <Text
                      style={[
                        s.filterBadgeTxt,
                        active && s.filterBadgeTxtActive,
                      ]}
                    >
                      {String(count)}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Section heading ── */}
        <View style={s.historyHeader}>
          <Text style={s.historyTitle}>Application History</Text>
          <Text style={s.historyCount}>
            {applications.length} application
            {applications.length !== 1 ? "s" : ""}
          </Text>
        </View>

        {/* ── Applications List ── */}
        {applications.map((app) => {
          const isExpanded = expandedApp === app.application_id;
          const metrics = getApplicationMetrics(app);

          return (
            <View key={app.application_id} style={s.appSection}>
              <TouchableOpacity
                style={s.appCard}
                onPress={() => toggleExpand(app.application_id)}
                activeOpacity={0.8}
              >
                <View style={s.appCardTop}>
                  <View style={s.appIconWrap}>
                    <Ionicons name="leaf" size={22} color="#fff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.appCardTitle} numberOfLines={2}>
                      {app.title}
                    </Text>
                    <Text style={s.appCardSub}>
                      {app.classification === "new"
                        ? "New Application"
                        : "Re-application"}{" "}
                      • {fmt(app.created_at)}
                    </Text>
                  </View>
                  <View style={s.appCardRight}>
                    <StatusBadge status={app.status} small />
                    <Ionicons
                      name={isExpanded ? "chevron-up" : "chevron-down"}
                      size={20}
                      color="rgba(255,255,255,0.7)"
                      style={{ marginTop: 6 }}
                    />
                  </View>
                </View>

                <View style={s.quickStats}>
                  <View style={s.quickStatItem}>
                    <Text style={s.quickStatVal}>{metrics.totalPlanted}</Text>
                    <Text style={s.quickStatLbl}>Planted</Text>
                  </View>
                  <View style={s.quickStatDivider} />
                  <View style={s.quickStatItem}>
                    <Text style={s.quickStatVal}>{metrics.totalSurvived}</Text>
                    <Text style={s.quickStatLbl}>Survived</Text>
                  </View>
                  <View style={s.quickStatDivider} />
                  <View style={s.quickStatItem}>
                    <Text style={s.quickStatVal}>
                      {Math.round(metrics.survivalRate)}%
                    </Text>
                    <Text style={s.quickStatLbl}>Rate</Text>
                  </View>
                </View>
              </TouchableOpacity>

              {isExpanded && (
                <View style={s.reportsSection}>
                  <TouchableOpacity
                    style={s.viewDetailsBtn}
                    onPress={() =>
                      router.push(
                        `/tree_growers/application-detail/${app.application_id}` as any,
                      )
                    }
                  >
                    <Ionicons
                      name="information-circle-outline"
                      size={18}
                      color="#0F4A2F"
                    />
                    <Text style={s.viewDetailsBtnText}>
                      View Full Application Details
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color="#0F4A2F"
                    />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F7F5" },
  scroll: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16 },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  loadingTxt: { marginTop: 14, color: "#6B7280", fontSize: 14 },
  errIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#E8F5E9",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  errTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 6,
  },
  errMsg: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  retryBtn: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    backgroundColor: "#0F4A2F",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryTxt: { color: "#fff", fontWeight: "700", fontSize: 14 },
  chipsRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  chip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 10,
    borderRadius: 12,
  },
  chipTxt: { fontSize: 12, fontWeight: "700" },
  filterScroll: { paddingRight: 16, marginBottom: 0 },
  filterTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#fff",
    marginRight: 8,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
  },
  filterTabActive: { backgroundColor: "#0F4A2F", borderColor: "#0F4A2F" },
  filterTabTxt: { fontSize: 13, fontWeight: "600", color: "#6B7280" },
  filterTabTxtActive: { color: "#fff" },
  filterBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  filterBadgeActive: { backgroundColor: "rgba(255,255,255,0.2)" },
  filterBadgeTxt: { fontSize: 10, fontWeight: "700", color: "#6B7280" },
  filterBadgeTxtActive: { color: "#fff" },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    marginBottom: 12,
  },
  historyTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },
  historyCount: { fontSize: 12, color: "#9CA3AF", fontWeight: "500" },
  appSection: { marginBottom: 16 },
  appCard: {
    backgroundColor: "#0F4A2F",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#0F4A2F",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  appCardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
  },
  appIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  appCardTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#fff",
    lineHeight: 20,
    flex: 1,
  },
  appCardSub: { fontSize: 10, color: "rgba(255,255,255,0.6)", marginTop: 2 },
  appCardRight: { alignItems: "flex-end" },
  quickStats: {
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: 12,
    paddingVertical: 10,
  },
  quickStatDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.12)" },
  quickStatItem: { flex: 1, alignItems: "center" },
  quickStatVal: { fontSize: 16, fontWeight: "800", color: "#fff" },
  quickStatLbl: { fontSize: 9, color: "rgba(255,255,255,0.6)", marginTop: 2 },
  reportsSection: { marginTop: 8, paddingLeft: 8 },
  viewDetailsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#E8F5E9",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#C8E6C9",
  },
  viewDetailsBtnText: { fontSize: 14, fontWeight: "700", color: "#0F4A2F" },
});

const badge = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 5,
  },
  small: { paddingHorizontal: 6, paddingVertical: 3 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: {
    fontSize: 10,
    fontWeight: "700",
    // ✅ REMOVED: textTransform is not supported in React Native and causes parser glitches
    letterSpacing: 0.5,
  },
  smallText: { fontSize: 9 },
});
