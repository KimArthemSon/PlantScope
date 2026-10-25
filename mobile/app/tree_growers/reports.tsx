import React, { useState, useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/constants/url_fixed";
import ReportPolygonMapModal from "@/components/forms/ReportPolygonMapModal";

const API_BASE = api + "/api";

// ─── Types ───────────────────────────────────────────────────────────────────

type ReportSpecies = {
  species_id: number;
  species_name: string;
  no_planted: number;
  no_added_by_grower: number;
  no_survived: number;
  no_dead: number;
  survival_rate: number;
};

type Report = {
  report_id: number;
  visit_type: "initial" | "ongoing" | "inactive_check" | string;
  orientation_conducted: boolean;
  total_survived: number;
  total_dead: number;
  total_added_by_grower: number;
  species: ReportSpecies[];
  description: string | null;
  status: "pending" | "accepted" | "rejected" | string;
  proof_image: string | null;
  submitted_at: string | null;
  created_at: string;
  polygon_coordinates?: [number, number][] | null;
  planted_area_hectares?: number | null;
  review_stage?: "data_manager" | "gis_specialist" | "done";
};

type ApplicationSummary = {
  application_id: number;
  title: string;
  status: string;
  classification: string;
  site_name: string | null;
  created_at: string;
  updated_at: string;
  orientation_date: string | null;
  confirmed_at: string | null;
  total_request_seedling: number;
  total_seedling_provided: number;
  total_seedling_planted: number;
  total_seedling_survived: number;
  planted_area_hectares: number | null;
  site_polygon_coordinates: [number, number][] | null;
  final_review_pending: boolean;
  reports: Report[];
};

type FilterKey =
  | "all"
  | "in_review"
  | "active"
  | "completed"
  | "closed";

// Application statuses grouped under each filter tab
const FILTER_STATUSES: Record<Exclude<FilterKey, "all">, string[]> = {
  in_review: ["for_evaluation", "for_head", "pending"],
  active: ["accepted", "under_monitoring"],
  completed: ["completed"],
  closed: ["rejected", "failed", "cancelled"],
};

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "in_review", label: "In Review" },
  { key: "active", label: "Active" },
  { key: "completed", label: "Completed" },
  { key: "closed", label: "Closed" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; dot: string }
> = {
  for_evaluation: { label: "For Evaluation", bg: "#FFF8E1", text: "#F57F17", dot: "#F9A825" },
  for_head: { label: "For Head Review", bg: "#E3F2FD", text: "#1565C0", dot: "#1976D2" },
  accepted: { label: "Accepted", bg: "#E8F5E9", text: "#2E7D32", dot: "#388E3C" },
  under_monitoring: { label: "Under Monitoring", bg: "#E8F5E9", text: "#2E7D32", dot: "#388E3C" },
  completed: { label: "Completed", bg: "#E0F2FE", text: "#0284C7", dot: "#0EA5E9" },
  pending: { label: "Pending", bg: "#FFF8E1", text: "#F57F17", dot: "#F9A825" },
  rejected: { label: "Rejected", bg: "#FFEBEE", text: "#C62828", dot: "#D32F2F" },
  failed: { label: "Failed", bg: "#FFEBEE", text: "#C62828", dot: "#D32F2F" },
  cancelled: { label: "Cancelled", bg: "#F5F5F5", text: "#555", dot: "#999" },
  // Report waiting for the GIS Specialist to check the planted-area map
  map_check: { label: "Map Check", bg: "#E0F2FE", text: "#0369A1", dot: "#0284C7" },
  // Program waiting for the City ENRO Head's completed/failed decision
  final_review: { label: "Final Review", bg: "#EEF2FF", text: "#4338CA", dot: "#6366F1" },
};

const reportStatusKey = (r: Report) =>
  r.status === "pending" && r.review_stage === "gis_specialist" ? "map_check" : r.status;

const getConf = (s: string | undefined) =>
  (s && STATUS_CONFIG[s]) || {
    label: (s || "Unknown").replace(/_/g, " ").toUpperCase(),
    bg: "#F5F5F5",
    text: "#555",
    dot: "#999",
  };

const VISIT_LABEL: Record<string, string> = {
  initial: "Initial Orientation",
  ongoing: "Ongoing Monitoring",
  inactive_check: "Inactive Check",
};

const fmt = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const reportTime = (r: Report) =>
  new Date(r.submitted_at || r.created_at || 0).getTime();

// Planted = initial baseline + all additions by grower (accepted reports only).
// Survived = (planted) - dead from the latest accepted report.
const getApplicationMetrics = (app: ApplicationSummary) => {
  const accepted = app.reports.filter((r) => r.status === "accepted");
  const initial = [...accepted]
    .filter((r) => r.visit_type === "initial")
    .sort((a, b) => reportTime(a) - reportTime(b))[0];
  const latest = [...accepted].sort((a, b) => reportTime(b) - reportTime(a))[0];

  const initialPlanted =
    initial?.species.reduce((sum, sp) => sum + (sp.no_planted || 0), 0) || 0;
  const totalAdded = accepted.reduce(
    (sum, r) => sum + (r.total_added_by_grower || 0),
    0,
  );
  const totalPlanted = initialPlanted + totalAdded;
  const latestDead = latest?.total_dead || 0;
  const totalSurvived = latest ? Math.max(0, totalPlanted - latestDead) : 0;
  const survivalRate = totalPlanted > 0 ? (totalSurvived / totalPlanted) * 100 : 0;

  return { totalPlanted, totalSurvived, survivalRate };
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const StatusBadge = ({ status, small }: { status: string | undefined; small?: boolean }) => {
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

const ReportRow = ({ report, onViewMap }: { report: Report; onViewMap: (r: Report) => void }) => (
  <View style={s.reportRow}>
    <View style={s.reportRowTop}>
      <View style={{ flex: 1 }}>
        <Text style={s.reportType}>
          {VISIT_LABEL[report.visit_type] || "Monitoring Visit"}
        </Text>
        <Text style={s.reportDate}>{fmt(report.submitted_at || report.created_at)}</Text>
      </View>
      <StatusBadge status={reportStatusKey(report)} small />
    </View>
    <View style={s.reportStats}>
      {report.visit_type === "initial" ? (
        <Text style={s.reportStat}>
          Planted{" "}
          <Text style={[s.reportStatVal, { color: "#1D4ED8" }]}>
            {report.species.reduce((sum, sp) => sum + (sp.no_planted || 0), 0)}
          </Text>
        </Text>
      ) : (
        <Text style={s.reportStat}>
          Added{" "}
          <Text style={[s.reportStatVal, { color: "#047857" }]}>
            {report.total_added_by_grower}
          </Text>
        </Text>
      )}
      <Text style={s.reportStat}>
        Dead{" "}
        <Text style={[s.reportStatVal, { color: "#DC2626" }]}>{report.total_dead}</Text>
      </Text>
      <Text style={s.reportStat}>
        Species <Text style={s.reportStatVal}>{report.species.length}</Text>
      </Text>
    </View>
    {report.planted_area_hectares != null && (
      <View style={s.reportAreaRow}>
        <Ionicons name="map-outline" size={13} color="#0F4A2F" />
        <Text style={s.reportAreaTxt}>Planted area {report.planted_area_hectares.toFixed(2)} ha</Text>
        {(report.polygon_coordinates?.length ?? 0) >= 3 && (
          <TouchableOpacity style={s.mapLink} onPress={() => onViewMap(report)} hitSlop={8}>
            <Text style={s.mapLinkTxt}>View on map</Text>
            <Ionicons name="chevron-forward" size={13} color="#0F4A2F" />
          </TouchableOpacity>
        )}
      </View>
    )}
  </View>
);

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
  const [mapView, setMapView] = useState<{ report: Report; app: ApplicationSummary } | null>(null);
  const hasLoaded = useRef(false);

  const fetchAll = useCallback(async (mode: "initial" | "refresh" | "silent") => {
    try {
      if (mode === "initial") setLoading(true);
      setError(null);
      const token = await SecureStore.getItemAsync("token");
      if (!token) throw new Error("You are not logged in.");

      const res = await fetch(`${API_BASE}/get_tree_grower_application_history/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Failed to load history (${res.status})`);

      const data = await res.json();
      const apps: ApplicationSummary[] = (data.applications || []).map(
        (a: ApplicationSummary) => ({ ...a, reports: a.reports || [] }),
      );
      setApplications(apps);

      // Auto-expand the most recent application on first load only
      if (!hasLoaded.current && apps.length > 0) {
        setExpandedApp(apps[0].application_id);
      }
      hasLoaded.current = true;
    } catch (e: any) {
      // Keep showing existing data on a background refresh failure
      if (mode !== "silent" || !hasLoaded.current) {
        setError(e?.message || "Something went wrong.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Tabs keep this screen mounted, so refetch every time it comes into focus.
  // Full-screen spinner only on the very first load.
  useFocusEffect(
    useCallback(() => {
      fetchAll(hasLoaded.current ? "silent" : "initial");
    }, [fetchAll]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchAll("refresh");
  };

  const allReports = useMemo(
    () => applications.flatMap((app) => app.reports),
    [applications],
  );

  const reportCounts = useMemo(
    () => ({
      accepted: allReports.filter((r) => r.status === "accepted").length,
      pending: allReports.filter((r) => r.status === "pending").length,
      rejected: allReports.filter((r) => r.status === "rejected").length,
    }),
    [allReports],
  );

  const filterCount = (key: FilterKey) =>
    key === "all"
      ? applications.length
      : applications.filter((a) => FILTER_STATUSES[key].includes(a.status)).length;

  const visibleApps = useMemo(
    () =>
      filter === "all"
        ? applications
        : applications.filter((a) => FILTER_STATUSES[filter].includes(a.status)),
    [applications, filter],
  );

  const goBack = () => router.replace("/tree_growers/profile");

  const Header = (
    <View style={[s.header, { paddingTop: insets.top + 8 }]}>
      <TouchableOpacity style={s.backBtn} onPress={goBack} activeOpacity={0.7}>
        <Ionicons name="chevron-back" size={22} color="#111827" />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={s.headerTitle}>My Reports</Text>
        <Text style={s.headerSub}>Applications & monitoring history</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={s.container}>
        {Header}
        <View style={s.center}>
          <ActivityIndicator size="large" color="#0F4A2F" />
          <Text style={s.loadingTxt}>Loading history…</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={s.container}>
        {Header}
        <View style={s.center}>
          <View style={s.errIconWrap}>
            <Ionicons name="cloud-offline-outline" size={36} color="#0F4A2F" />
          </View>
          <Text style={s.errTitle}>Couldn't Load</Text>
          <Text style={s.errMsg}>{error}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => fetchAll("initial")}>
            <Ionicons name="refresh" size={16} color="#fff" />
            <Text style={s.retryTxt}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={s.container}>
      {Header}
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#0F4A2F"
            colors={["#0F4A2F"]}
          />
        }
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 32 }]}
      >
        {applications.length === 0 ? (
          <View style={[s.center, { paddingTop: 80 }]}>
            <View style={s.errIconWrap}>
              <Ionicons name="leaf-outline" size={36} color="#0F4A2F" />
            </View>
            <Text style={s.errTitle}>No Applications Yet</Text>
            <Text style={s.errMsg}>
              You haven't submitted any tree planting applications yet.
            </Text>
          </View>
        ) : (
          <>
            {/* ── Report summary chips ── */}
            <Text style={s.sectionLabel}>Progress Reports</Text>
            <View style={s.chipsRow}>
              <View style={[s.chip, { backgroundColor: "#E8F5E9" }]}>
                <Ionicons name="checkmark-circle-outline" size={16} color="#2E7D32" />
                <Text style={[s.chipTxt, { color: "#2E7D32" }]}>
                  {reportCounts.accepted} Accepted
                </Text>
              </View>
              <View style={[s.chip, { backgroundColor: "#FFF8E1" }]}>
                <Ionicons name="time-outline" size={16} color="#F57F17" />
                <Text style={[s.chipTxt, { color: "#F57F17" }]}>
                  {reportCounts.pending} Pending
                </Text>
              </View>
              <View style={[s.chip, { backgroundColor: "#FFEBEE" }]}>
                <Ionicons name="close-circle-outline" size={16} color="#C62828" />
                <Text style={[s.chipTxt, { color: "#C62828" }]}>
                  {reportCounts.rejected} Rejected
                </Text>
              </View>
            </View>

            {/* ── Filter tabs (by application status) ── */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.filterScroll}
            >
              {FILTERS.map((f) => {
                const active = filter === f.key;
                const count = filterCount(f.key);
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
                        <Text style={[s.filterBadgeTxt, active && s.filterBadgeTxtActive]}>
                          {String(count)}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={s.historyHeader}>
              <Text style={s.historyTitle}>Application History</Text>
              <Text style={s.historyCount}>
                {visibleApps.length} application{visibleApps.length !== 1 ? "s" : ""}
              </Text>
            </View>

            {visibleApps.length === 0 && (
              <View style={s.emptyFilter}>
                <Ionicons name="funnel-outline" size={22} color="#9CA3AF" />
                <Text style={s.emptyFilterTxt}>No applications in this category.</Text>
              </View>
            )}

            {/* ── Applications list ── */}
            {visibleApps.map((app) => {
              const isExpanded = expandedApp === app.application_id;
              const metrics = getApplicationMetrics(app);
              const sortedReports = [...app.reports].sort(
                (a, b) => reportTime(b) - reportTime(a),
              );

              return (
                <View key={app.application_id} style={s.appSection}>
                  <TouchableOpacity
                    style={s.appCard}
                    onPress={() =>
                      setExpandedApp(isExpanded ? null : app.application_id)
                    }
                    activeOpacity={0.85}
                  >
                    <View style={s.appCardTop}>
                      <View style={s.appIconWrap}>
                        <Ionicons name="leaf" size={20} color="#fff" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.appCardTitle} numberOfLines={2}>
                          {app.title}
                        </Text>
                        <Text style={s.appCardSub} numberOfLines={1}>
                          {app.classification === "new" ? "New Application" : "Re-application"}
                          {" • "}
                          {fmt(app.created_at)}
                          {app.site_name ? ` • ${app.site_name}` : ""}
                        </Text>
                      </View>
                      <View style={s.appCardRight}>
                        <StatusBadge status={app.final_review_pending ? "final_review" : app.status} small />
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
                        <Text style={s.quickStatVal}>
                          {metrics.totalPlanted.toLocaleString()}
                        </Text>
                        <Text style={s.quickStatLbl}>Planted</Text>
                      </View>
                      <View style={s.quickStatDivider} />
                      <View style={s.quickStatItem}>
                        <Text style={s.quickStatVal}>
                          {metrics.totalSurvived.toLocaleString()}
                        </Text>
                        <Text style={s.quickStatLbl}>Survived</Text>
                      </View>
                      <View style={s.quickStatDivider} />
                      <View style={s.quickStatItem}>
                        <Text style={s.quickStatVal}>
                          {Math.round(metrics.survivalRate)}%
                        </Text>
                        <Text style={s.quickStatLbl}>Rate</Text>
                      </View>
                      <View style={s.quickStatDivider} />
                      <View style={s.quickStatItem}>
                        <Text style={s.quickStatVal}>{app.reports.length}</Text>
                        <Text style={s.quickStatLbl}>Reports</Text>
                      </View>
                    </View>

                    <View style={s.appAreaRow}>
                      <Ionicons name="map" size={14} color="#A7F3D0" />
                      <Text style={s.appAreaTxt}>
                        Area planted:{" "}
                        <Text style={{ color: "#fff", fontWeight: "800" }}>
                          {app.planted_area_hectares != null ? `${app.planted_area_hectares.toFixed(2)} ha` : "not measured yet"}
                        </Text>
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={s.reportsSection}>
                      {app.final_review_pending && (
                        <View style={s.finalReviewBox}>
                          <Ionicons name="ribbon-outline" size={18} color="#4338CA" />
                          <Text style={s.finalReviewTxt}>
                            The City ENRO Head is reviewing this program's results to decide if it is completed. You will be notified of the decision.
                          </Text>
                        </View>
                      )}
                      {sortedReports.length === 0 ? (
                        <Text style={s.noReports}>
                          No monitoring reports yet for this application.
                        </Text>
                      ) : (
                        sortedReports.map((r) => (
                          <ReportRow key={r.report_id} report={r} onViewMap={(rep) => setMapView({ report: rep, app })} />
                        ))
                      )}

                      <TouchableOpacity
                        style={s.viewDetailsBtn}
                        onPress={() =>
                          router.push(
                            `/tree_growers/application-detail/${app.application_id}` as any,
                          )
                        }
                      >
                        <Ionicons name="information-circle-outline" size={18} color="#0F4A2F" />
                        <Text style={s.viewDetailsBtnText}>View Full Application Details</Text>
                        <Ionicons name="chevron-forward" size={18} color="#0F4A2F" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
          </>
        )}
      </ScrollView>

      <ReportPolygonMapModal
        visible={!!mapView}
        onClose={() => setMapView(null)}
        title={mapView ? `${VISIT_LABEL[mapView.report.visit_type] || "Monitoring Visit"} · ${fmt(mapView.report.submitted_at || mapView.report.created_at)}` : ""}
        subtitle={mapView?.app.site_name || mapView?.app.title}
        reportPolygon={mapView?.report.polygon_coordinates}
        sitePolygon={mapView?.app.site_polygon_coordinates}
        areaHectares={mapView?.report.planted_area_hectares}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F7F5" },
  reportAreaRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 8 },
  reportAreaTxt: { flex: 1, fontSize: 12, color: "#0F4A2F", fontWeight: "600" },
  mapLink: { flexDirection: "row", alignItems: "center", gap: 2 },
  mapLinkTxt: { fontSize: 12, color: "#0F4A2F", fontWeight: "800" },
  appAreaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 },
  appAreaTxt: { fontSize: 12, color: "rgba(255,255,255,0.8)" },
  finalReviewBox: { flexDirection: "row", gap: 10, padding: 12, borderRadius: 12, backgroundColor: "#EEF2FF", borderWidth: 1, borderColor: "#C7D2FE", marginBottom: 10 },
  finalReviewTxt: { flex: 1, fontSize: 12, color: "#3730A3", lineHeight: 17 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "#F4F7F5",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  headerTitle: { fontSize: 20, fontWeight: "800", color: "#111827" },
  headerSub: { fontSize: 12, color: "#6B7280", marginTop: 1 },
  scroll: { paddingHorizontal: 16, paddingTop: 4 },
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
  errTitle: { fontSize: 20, fontWeight: "700", color: "#111827", marginBottom: 6 },
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
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9CA3AF",
    letterSpacing: 0.6,
    marginBottom: 8,
  },
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
  filterScroll: { paddingRight: 16 },
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
  emptyFilter: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 32,
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  emptyFilterTxt: { fontSize: 13, color: "#6B7280" },
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
  appCardTitle: { fontSize: 15, fontWeight: "800", color: "#fff", lineHeight: 20 },
  appCardSub: { fontSize: 11, color: "rgba(255,255,255,0.65)", marginTop: 3 },
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
  quickStatLbl: { fontSize: 10, color: "rgba(255,255,255,0.6)", marginTop: 2 },
  reportsSection: {
    marginTop: -8,
    paddingTop: 16,
    paddingHorizontal: 12,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: "#E5E7EB",
  },
  noReports: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    paddingVertical: 12,
  },
  reportRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  reportRowTop: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  reportType: { fontSize: 13, fontWeight: "700", color: "#111827" },
  reportDate: { fontSize: 11, color: "#9CA3AF", marginTop: 2 },
  reportStats: { flexDirection: "row", gap: 16, marginTop: 8 },
  reportStat: { fontSize: 12, color: "#6B7280" },
  reportStatVal: { fontWeight: "700", color: "#111827" },
  viewDetailsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#E8F5E9",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 12,
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
  text: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  smallText: { fontSize: 9 },
});
