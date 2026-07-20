import React, { useState, useEffect, useCallback } from "react";
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Platform,
  ScrollView,
  Dimensions,
  RefreshControl,
  StatusBar,
} from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import { api } from "@/constants/url_fixed";
import { useNetworkStatus } from "@/utils/networkStatus";
import { BarChart } from "react-native-chart-kit";

const screenWidth = Dimensions.get("window").width;
const API = api + "/api";
const TOKEN_KEY = "token";

const BG = "#F5F6F8";
const PRIMARY = "#0F4A2F";
const INK = "#111827";
const MUTED = "#6B7280";
const FAINT = "#9CA3AF";

const getToken = async () => {
  if (Platform.OS === "web") return localStorage.getItem(TOKEN_KEY);
  return await SecureStore.getItemAsync(TOKEN_KEY);
};

/* ──────────────────────────────────────────────────────────────────
   HEADER
   ──────────────────────────────────────────────────────────────── */
const DashboardHeader: React.FC<{ isRefreshing: boolean }> = ({
  isRefreshing,
}) => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isOnline = useNetworkStatus();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (isOnline) {
      fetchUnreadCount();
      const interval = setInterval(fetchUnreadCount, 60000);
      return () => clearInterval(interval);
    }
  }, [isOnline]);

  const fetchUnreadCount = async () => {
    if (!isOnline) return;
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`${API}/notifications/unread-count/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.unread_count || 0);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const badgeText = unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <View style={[hdr.wrap, { paddingTop: insets.top + 16 }]}>
      <View style={hdr.topRow}>
        <View>
          <Text style={hdr.eyebrow}>Field Inspections</Text>
          <Text style={hdr.title}>Dashboard</Text>
        </View>

        <View style={hdr.rightContainer}>
          {isRefreshing && (
            <ActivityIndicator
              size="small"
              color={PRIMARY}
              style={{ marginRight: 8 }}
            />
          )}
          {isOnline && (
            <TouchableOpacity
              style={hdr.iconBtn}
              activeOpacity={0.6}
              onPress={() => router.push("/(tabs)/notifications")}
            >
              <Ionicons name="notifications-outline" size={20} color={MUTED} />
              {unreadCount > 0 && (
                <View style={hdr.badge}>
                  <Text style={hdr.badgeText}>{badgeText}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

/* ──────────────────────────────────────────────────────────────────
   REUSABLE COMPONENTS
   ──────────────────────────────────────────────────────────────── */
const StatCard: React.FC<{
  icon: string;
  title: string;
  value: string;
  color: string;
}> = ({ icon, title, value, color }) => (
  <View style={styles.statCard}>
    <View style={[styles.statIconBox, { backgroundColor: color + "12" }]}>
      <MaterialCommunityIcons name={icon as any} size={18} color={color} />
    </View>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statTitle}>{title}</Text>
  </View>
);

const AssessmentRow: React.FC<{ item: any; onPress: () => void }> = ({
  item,
  onPress,
}) => {
  const config =
    item.status === "submitted"
      ? {
          icon: "check-circle",
          color: "#10B981",
          bg: "#D1FAE5",
          text: "Submitted",
        }
      : item.status === "draft"
        ? {
            icon: "clock-outline",
            color: "#F59E0B",
            bg: "#FEF3C7",
            text: "Draft",
          }
        : {
            icon: "alert-circle",
            color: "#EF4444",
            bg: "#FEE2E2",
            text: "Returned",
          };

  const date = new Date(item.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <TouchableOpacity
      style={styles.rowItem}
      onPress={onPress}
      activeOpacity={0.6}
    >
      <View style={styles.rowLeft}>
        <View style={[styles.rowIcon, { backgroundColor: config.bg }]}>
          <MaterialCommunityIcons
            name={config.icon}
            size={18}
            color={config.color}
          />
        </View>
        <View style={styles.rowContent}>
          <Text style={styles.rowTitle}>{item.site_name}</Text>
          <Text style={styles.rowSubtitle}>{item.area_name}</Text>
          <View style={styles.rowMeta}>
            <Text style={styles.rowDate}>{date}</Text>
            <Text style={styles.rowDivider}>•</Text>
            <Text style={styles.rowDate}>
              <Ionicons name="images" size={11} color={FAINT} />{" "}
              {item.image_count}
            </Text>
          </View>
        </View>
      </View>
      <View style={[styles.rowBadge, { backgroundColor: config.bg }]}>
        <Text style={[styles.rowBadgeText, { color: config.color }]}>
          {config.text}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

/* ──────────────────────────────────────────────────────────────────
   PERIOD FILTER
   ──────────────────────────────────────────────────────────────── */
const PeriodFilter: React.FC<{
  value: "Today" | "Weekly" | "Monthly";
  onChange: (v: "Today" | "Weekly" | "Monthly") => void;
}> = ({ value, onChange }) => {
  const options: Array<"Today" | "Weekly" | "Monthly"> = [
    "Today",
    "Weekly",
    "Monthly",
  ];
  return (
    <View style={styles.filterPillWrap}>
      {options.map((opt) => {
        const active = opt === value;
        return (
          <TouchableOpacity
            key={opt}
            style={[styles.filterPill, active && styles.filterPillActive]}
            activeOpacity={0.7}
            onPress={() => onChange(opt)}
          >
            <Text
              style={[
                styles.filterPillText,
                active && styles.filterPillTextActive,
              ]}
            >
              {opt}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

/* ──────────────────────────────────────────────────────────────────
   MAIN SCREEN
   ──────────────────────────────────────────────────────────────── */
const Home: React.FC = () => {
  const router = useRouter();
  const isOnline = useNetworkStatus();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<"Today" | "Weekly" | "Monthly">(
    "Weekly",
  );

  const fetchData = useCallback(async () => {
    if (!isOnline) {
      setError("No internet connection.");
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const token = await getToken();
      if (!token) {
        setError("Authentication required");
        return;
      }
      const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };

      const apiPeriod =
        period === "Today"
          ? "daily"
          : period === "Weekly"
            ? "weekly"
            : "monthly";

      const [statsRes, recentRes, chartRes] = await Promise.all([
        fetch(`${API}/inspector/dashboard-stats/`, { headers }),
        fetch(`${API}/inspector/recent-assessments/?limit=5`, { headers }),
        fetch(`${API}/inspector/assessments-over-time/?period=${apiPeriod}`, {
          headers,
        }),
      ]);

      if (!statsRes.ok || !recentRes.ok) {
        throw new Error("Failed to fetch data");
      }

      setData({
        stats: (await statsRes.json()).data,
        recentAssessments: (await recentRes.json()).data,
        chartData: chartRes.ok ? (await chartRes.json()).data : null,
      });
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isOnline, period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={PRIMARY} />
        <Text style={styles.centerText}>Loading...</Text>
      </View>
    );
  }

  if (error && !data) {
    return (
      <View style={styles.center}>
        <Ionicons name="cloud-offline-outline" size={52} color={FAINT} />
        <Text style={styles.errorTitle}>Connection Error</Text>
        <Text style={styles.errorMsg}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={fetchData}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const stats = data?.stats;
  const chartData = data?.chartData;
  const recent = data?.recentAssessments || [];

  return (
    <View style={styles.root}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={BG}
        translucent={false}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={PRIMARY}
            colors={[PRIMARY]}
          />
        }
      >
        <DashboardHeader isRefreshing={refreshing} />

        {/* Progress Card - Dark Green style from ReforestationAreas */}
        <View style={styles.progressCard}>
          <View style={styles.progressRow}>
            <View>
              <Text style={styles.progressLabel}>OVERALL PROGRESS</Text>
              <Text style={styles.progressSub}>
                {stats?.overall_progress.assessed_sites || 0} of{" "}
                {stats?.overall_progress.total_sites || 0} sites assessed
              </Text>
            </View>
            <Text style={styles.progressPct}>
              {stats?.overall_progress.percentage || 0}%
            </Text>
          </View>
          <View style={styles.progressBg}>
            <View
              style={[
                styles.progressFill,
                { width: `${stats?.overall_progress.percentage || 0}%` },
              ]}
            />
          </View>
          <View style={styles.progressStatusRow}>
            <View style={styles.statusItem}>
              <View style={[styles.statusDot, { backgroundColor: "#5FD08A" }]} />
              <Text style={styles.statusText}>
                {stats?.overall_progress.assessed_sites || 0} Assessed
              </Text>
            </View>
            <View style={styles.statusItem}>
              <View style={[styles.statusDot, { backgroundColor: "rgba(255,255,255,0.3)" }]} />
              <Text style={styles.statusText}>
                {stats?.overall_progress.total_sites - stats?.overall_progress.assessed_sites || 0} Pending
              </Text>
            </View>
          </View>
        </View>

        {/* 2. STATS GRID */}
        <View style={styles.grid}>
          <StatCard
            icon="map"
            title="Assigned Areas"
            value={stats?.stats.total_areas.toString() || "0"}
            color={PRIMARY}
          />
          <StatCard
            icon="file-document"
            title="Total Assessments"
            value={stats?.stats.total_assessments.toString() || "0"}
            color="#059669"
          />
          <StatCard
            icon="check-circle"
            title="Submitted"
            value={stats?.stats.submitted_count.toString() || "0"}
            color="#10B981"
          />
          <StatCard
            icon="clock-outline"
            title="Pending Drafts"
            value={stats?.stats.draft_count.toString() || "0"}
            color="#F59E0B"
          />
        </View>

        {/* 3. CHART — Overview bar chart with dynamic period filter */}
        {chartData && chartData.labels && chartData.labels.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Overview</Text>
              <PeriodFilter value={period} onChange={setPeriod} />
            </View>

            <View style={[styles.card, styles.cardTight]}>
              <View style={styles.chartWrap}>
                <BarChart
                  data={{
                    labels: chartData.labels,
                    datasets: (chartData.datasets || []).map((ds: any) => ({
                      data: ds.data || [],
                      color: (opacity = 1) => {
                        if (ds.label === "Submitted")
                          return `rgba(34, 197, 94, ${opacity})`;
                        if (ds.label === "Draft")
                          return `rgba(245, 158, 11, ${opacity})`;
                        return `rgba(15, 74, 47, ${opacity})`;
                      },
                    })),
                  }}
                  width={screenWidth - 72}
                  height={220}
                  yAxisLabel=""
                  yAxisSuffix=""
                  chartConfig={{
                    backgroundGradientFrom: "#FFFFFF",
                    backgroundGradientTo: "#FFFFFF",
                    decimalPlaces: 0,
                    color: (opacity = 1) => `rgba(15, 74, 47, ${opacity})`,
                    labelColor: () => MUTED,
                    barPercentage: 0.6,
                    fillShadowGradient: PRIMARY,
                    fillShadowGradientOpacity: 1,
                    propsForBackgroundLines: {
                      stroke: "#F1F3F5",
                      strokeWidth: 1,
                      strokeDasharray: "0",
                    },
                    propsForLabels: {
                      fontSize: 11,
                    },
                  }}
                  style={styles.chart}
                  withInnerLines={true}
                  withHorizontalLabels={true}
                  showBarTops={false}
                  fromZero
                />
              </View>
            </View>
          </>
        )}

        {/* 4. RECENT ASSESSMENTS */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Assessments</Text>
          <TouchableOpacity onPress={() => router.push("/monitoring")}>
            <Text style={styles.linkText}>View All</Text>
          </TouchableOpacity>
        </View>

        {recent.length === 0 ? (
          <View style={[styles.card, styles.cardTight, styles.empty]}>
            <MaterialCommunityIcons
              name="file-document-outline"
              size={44}
              color="#D1D5DB"
            />
            <Text style={styles.emptyTitle}>No assessments yet</Text>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => router.push("/Area")}
              activeOpacity={0.85}
            >
              <Text style={styles.actionBtnText}>Start Assessment</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.list}>
            {recent.map((item: any) => (
              <AssessmentRow
                key={item.field_assessment_id}
                item={item}
                onPress={() =>
                  router.push(`/assessment/${item.field_assessment_id}`)
                }
              />
            ))}
          </View>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
};

/* ──────────────────────────────────────────────────────────────────
   STYLES
   ──────────────────────────────────────────────────────────────── */
const hdr = StyleSheet.create({
  wrap: {
    backgroundColor: BG,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  eyebrow: {
    fontSize: 12,
    color: MUTED,
    fontWeight: "600",
    marginBottom: 3,
    letterSpacing: 0.2,
  },
  title: { fontSize: 32, fontWeight: "800", color: INK, letterSpacing: -0.5 },
  rightContainer: { flexDirection: "row", alignItems: "center" },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  badge: {
    position: "absolute",
    top: 4,
    right: 4,
    minWidth: 15,
    height: 15,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: "#EF4444",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  badgeText: { color: "#FFFFFF", fontSize: 8.5, fontWeight: "700" },
});

const cardShadow = {
  shadowColor: "#0F172A",
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.03,
  shadowRadius: 8,
  elevation: 1,
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  container: { flex: 1, backgroundColor: BG },
  content: { paddingBottom: 24 },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: BG,
    paddingHorizontal: 40,
  },
  centerText: { marginTop: 12, fontSize: 14, color: MUTED, fontWeight: "500" },
  errorTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: INK,
    marginTop: 16,
    marginBottom: 8,
    textAlign: "center",
  },
  errorMsg: {
    fontSize: 14,
    color: MUTED,
    textAlign: "center",
    marginBottom: 24,
  },
  retryBtn: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryText: { color: "#FFFFFF", fontWeight: "600", fontSize: 14 },

  // Dark Green Progress Card
  progressCard: {
    backgroundColor: PRIMARY,
    marginHorizontal: 20,
    marginTop: 0,
    padding: 20,
    borderRadius: 18,
    ...cardShadow,
  },
  progressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  progressLabel: {
    fontSize: 13,
    color: "#B7D3C6",
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  progressSub: {
    fontSize: 11,
    color: "rgba(255,255,255,0.45)",
    marginTop: 2,
  },
  progressPct: {
    fontSize: 26,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  progressBg: {
    height: 6,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 14,
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#5FD08A",
    borderRadius: 3,
  },
  progressStatusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statusItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
    color: "rgba(255,255,255,0.6)",
    fontWeight: "500",
  },

  // Grid
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 10,
  },
  statCard: {
    width: "47.5%",
    backgroundColor: "#FFFFFF",
    marginBottom: 0,
    padding: 16,
    borderRadius: 18,
    ...cardShadow,
  },
  statIconBox: {
    width: 34,
    height: 34,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  statValue: { fontSize: 20, fontWeight: "700", marginBottom: 2, color: INK },
  statTitle: { fontSize: 11.5, color: MUTED, fontWeight: "500" },

  // Cards
  card: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 20,
    marginTop: 28,
    padding: 20,
    borderRadius: 20,
    ...cardShadow,
  },
  cardTight: { marginTop: 0 },
  cardFirst: { marginTop: 15 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginTop: 28,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: INK,
    letterSpacing: -0.2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  cardTitle: { fontSize: 15, fontWeight: "700", color: INK },
  linkText: { fontSize: 12.5, color: PRIMARY, fontWeight: "600" },

  // Period filter
  filterPillWrap: {
    flexDirection: "row",
    backgroundColor: "#EDEFF2",
    borderRadius: 10,
    padding: 3,
    gap: 2,
  },
  filterPill: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 8,
  },
  filterPillActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  filterPillText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: MUTED,
  },
  filterPillTextActive: {
    color: PRIMARY,
  },

  // Chart
  chartWrap: { alignItems: "center", marginTop: 8 },
  chart: { borderRadius: 12, marginLeft: -10 },

  // List
  list: { paddingHorizontal: 20, gap: 10, marginTop: 0 },
  rowItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    ...cardShadow,
  },
  rowLeft: { flexDirection: "row", flex: 1, alignItems: "flex-start" },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  rowContent: { flex: 1 },
  rowTitle: { fontSize: 13.5, fontWeight: "600", color: INK, marginBottom: 3 },
  rowSubtitle: { fontSize: 11.5, color: MUTED, marginBottom: 5 },
  rowMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowDate: { fontSize: 10.5, color: FAINT, fontWeight: "500" },
  rowDivider: { fontSize: 10.5, color: "#D1D5DB" },
  rowBadge: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8 },
  rowBadgeText: { fontSize: 10.5, fontWeight: "700" },

  // Empty
  empty: { alignItems: "center", paddingVertical: 36 },
  emptyTitle: {
    fontSize: 14.5,
    fontWeight: "600",
    color: INK,
    marginTop: 14,
    marginBottom: 22,
  },
  actionBtn: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: 12,
  },
  actionBtnText: { color: "#FFFFFF", fontWeight: "600", fontSize: 14 },
});

export default Home;