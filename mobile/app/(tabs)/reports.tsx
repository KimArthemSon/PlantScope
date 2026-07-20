import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  StatusBar,
  Platform,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LineChart, PieChart } from "react-native-chart-kit";

const screenWidth = Dimensions.get("window").width;

// ─── Static Mock Data ──────────────────────────────────────────────────────

const MOCK_REPORTS = [
  {
    id: "RPT-2024-089",
    projectName: "Mount Makiling Reforestation",
    siteName: "Sector 4 • Brgy. Mayondon",
    date: "Jul 15, 2024",
    status: "verified",
    survived: 450,
    dead: 12,
    survivalRate: 97,
  },
  {
    id: "RPT-2024-088",
    projectName: "Sierra Madre Green Belt",
    siteName: "Zone B • Brgy. Diteki",
    date: "Jul 10, 2024",
    status: "pending",
    survived: 210,
    dead: 45,
    survivalRate: 82,
  },
  {
    id: "RPT-2024-087",
    projectName: "Cabungtan Community Forest",
    siteName: "Plot 12 • Brgy. Cabungtan",
    date: "Jul 05, 2024",
    status: "verified",
    survived: 180,
    dead: 5,
    survivalRate: 97,
  },
  {
    id: "RPT-2024-086",
    projectName: "Coastal Mangrove Project",
    siteName: "Site A • Brgy. San Jose",
    date: "Jun 28, 2024",
    status: "rejected",
    survived: 90,
    dead: 60,
    survivalRate: 60,
  },
  {
    id: "RPT-2024-085",
    projectName: "Upland Agroforestry Init.",
    siteName: "Block 3 • Brgy. Santa Cruz",
    date: "Jun 20, 2024",
    status: "verified",
    survived: 320,
    dead: 18,
    survivalRate: 94,
  },
];

const STATUS_CONFIG = {
  verified: {
    label: "Verified",
    bg: "#DCFCE7",
    text: "#15803D",
    dot: "#22C55E",
  },
  pending: { label: "Pending", bg: "#FEF9C3", text: "#A16207", dot: "#F59E0B" },
  rejected: {
    label: "Rejected",
    bg: "#FEE2E2",
    text: "#DC2626",
    dot: "#EF4444",
  },
};

const MOCK_PIE_DATA = [
  {
    name: "Verified",
    population: 128,
    color: "#10B981",
    legendFontColor: "#374151",
    legendFontSize: 10,
  },
  {
    name: "Pending",
    population: 8,
    color: "#F59E0B",
    legendFontColor: "#374151",
    legendFontSize: 10,
  },
  {
    name: "Rejected",
    population: 6,
    color: "#EF4444",
    legendFontColor: "#374151",
    legendFontSize: 10,
  },
];

const MOCK_LINE_DATA = {
  labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
  datasets: [{ data: [82, 84, 83, 86, 85, 87] }],
};

// ── Main Component ────────────────────────────────────────────────────────

const ReportsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState("All");
  const tabs = ["All", "Verified", "Pending", "Rejected"];

  const filteredReports =
    activeTab === "All"
      ? MOCK_REPORTS
      : MOCK_REPORTS.filter((r) => r.status === activeTab.toLowerCase());

  // Calculate status percentages for the visual bar
  const totalReports = 142;
  const verifiedPct = (128 / totalReports) * 100;
  const pendingPct = (8 / totalReports) * 100;
  const rejectedPct = (6 / totalReports) * 100;

  const renderReportCard = ({ item }: { item: (typeof MOCK_REPORTS)[0] }) => {
    const config = STATUS_CONFIG[item.status as keyof typeof STATUS_CONFIG];
    return (
      <TouchableOpacity style={styles.reportCard} activeOpacity={0.8}>
        <View
          style={[styles.statusIndicator, { backgroundColor: config.dot }]}
        />
        <View style={styles.cardContent}>
          <View style={styles.cardTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.projectName} numberOfLines={1}>
                {item.projectName}
              </Text>
              <Text style={styles.siteName} numberOfLines={1}>
                {item.siteName}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
              <Text style={[styles.statusText, { color: config.text }]}>
                {config.label}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.metricsRow}>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Survived</Text>
              <Text style={[styles.metricValue, { color: "#16A34A" }]}>
                {item.survived}
              </Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Dead</Text>
              <Text style={[styles.metricValue, { color: "#DC2626" }]}>
                {item.dead}
              </Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Rate</Text>
              <Text style={[styles.metricValue, { color: "#0F4A2F" }]}>
                {item.survivalRate}%
              </Text>
            </View>
          </View>

          <View style={styles.cardBottom}>
            <View style={styles.metaInfo}>
              <Ionicons name="calendar-outline" size={12} color="#9CA3AF" />
              <Text style={styles.dateText}>{item.date}</Text>
              <Text style={styles.dotSeparator}>•</Text>
              <Text style={styles.reportId}>{item.id}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const chartConfig = {
    backgroundColor: "#FFFFFF",
    backgroundGradientFrom: "#FFFFFF",
    backgroundGradientTo: "#FFFFFF",
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(15, 74, 47, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
    style: { borderRadius: 16 },
    propsForBackgroundLines: { stroke: "#F3F4F6", strokeDasharray: "0" },
  };

  return (
    <View
      style={[
        styles.container,
        { paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0 },
      ]}
    >
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#F5F6F8"
        translucent={false}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ─── HEADER ─── */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
          <Text style={styles.headerEyebrow}>History & Archive</Text>
          <Text style={styles.headerTitle}>Assessment Reports</Text>

          <View style={styles.searchContainer}>
            <Ionicons name="search" size={18} color="#9CA3AF" />
            <Text style={styles.searchPlaceholder}>
              Search reports, projects...
            </Text>
            <TouchableOpacity style={styles.filterBtn}>
              <Ionicons name="options" size={18} color="#0F4A2F" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ─── TAB FILTERS ─── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabContainer}
          contentContainerStyle={styles.tabContent}
        >
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab && styles.tabTextActive,
                ]}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ─── STORY 1: Overall Health (Visual Status Bar) ─── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Report Status Overview</Text>
          <View style={styles.statusCard}>
            <View style={styles.statusBar}>
              <View
                style={[
                  styles.statusSegment,
                  { width: `${verifiedPct}%`, backgroundColor: "#10B981" },
                ]}
              />
              <View
                style={[
                  styles.statusSegment,
                  { width: `${pendingPct}%`, backgroundColor: "#F59E0B" },
                ]}
              />
              <View
                style={[
                  styles.statusSegment,
                  { width: `${rejectedPct}%`, backgroundColor: "#EF4444" },
                ]}
              />
            </View>
            <View style={styles.statusLegend}>
              <View style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: "#10B981" }]}
                />
                <Text style={styles.legendText}>Verified (90%)</Text>
              </View>
              <View style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: "#F59E0B" }]}
                />
                <Text style={styles.legendText}>Pending (6%)</Text>
              </View>
              <View style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: "#EF4444" }]}
                />
                <Text style={styles.legendText}>Rejected (4%)</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ─── STORY 2: Trend (Hero Chart) ─── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Survival Rate Trend</Text>
              <Text style={styles.sectionSubtitle}>
                Are we improving over time?
              </Text>
            </View>
            <TouchableOpacity style={styles.exportBtn}>
              <Ionicons name="download-outline" size={14} color="#0F4A2F" />
              <Text style={styles.exportText}>Export</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.heroChartCard}>
            <LineChart
              data={MOCK_LINE_DATA}
              width={screenWidth - 40}
              height={200}
              chartConfig={{
                ...chartConfig,
                propsForDots: {
                  r: "5",
                  strokeWidth: "2",
                  stroke: "#0F4A2F",
                  fill: "#FFFFFF",
                },
              }}
              bezier
              style={styles.chart}
              withInnerLines={true}
              withOuterLines={false}
              withVerticalLines={false}
              fromZero={false}
              yAxisLabel=""
              yAxisSuffix="%"
            />
          </View>
        </View>

        {/* ─── STORY 3: Key Insights (Side-by-Side) ─── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Key Insights</Text>
          <View style={styles.insightsRow}>
            <View style={styles.insightCard}>
              <View
                style={[styles.insightIcon, { backgroundColor: "#DCFCE7" }]}
              >
                <Ionicons name="trending-up" size={20} color="#16A34A" />
              </View>
              <Text style={styles.insightValue}>+5%</Text>
              <Text style={styles.insightLabel}>Improvement</Text>
              <Text style={styles.insightDetail}>vs last quarter</Text>
            </View>
            <View style={styles.insightCard}>
              <View
                style={[styles.insightIcon, { backgroundColor: "#FEF3C7" }]}
              >
                <Ionicons name="alert-circle" size={20} color="#D97706" />
              </View>
              <Text style={styles.insightValue}>8</Text>
              <Text style={styles.insightLabel}>Pending Review</Text>
              <Text style={styles.insightDetail}>Needs attention</Text>
            </View>
          </View>
        </View>

        {/* ─── STORY 4: Distribution (Compact Pie) ─── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Status Distribution</Text>
          <View style={styles.pieCard}>
            <PieChart
              data={MOCK_PIE_DATA}
              width={screenWidth - 40}
              height={160}
              chartConfig={chartConfig}
              accessor="population"
              backgroundColor="transparent"
              paddingLeft="0"
              center={[10, 10]}
              absolute
              hasLegend={true}
            />
          </View>
        </View>

        {/* ─── STORY 5: Detailed Records ─── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Detailed Records</Text>
            <Text style={styles.recordCount}>
              {filteredReports.length} records
            </Text>
          </View>

          <FlatList
            data={filteredReports}
            renderItem={renderReportCard}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="document-outline" size={48} color="#D1D5DB" />
                <Text style={styles.emptyText}>
                  No reports found for this filter.
                </Text>
              </View>
            }
          />
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6F8" },
  scrollContent: { paddingBottom: 24 },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: "#F5F6F8",
  },
  headerEyebrow: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "600",
    marginBottom: 4,
    letterSpacing: 0.2,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: "#111827",
    letterSpacing: -0.5,
    marginBottom: 16,
  },

  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
    gap: 8,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  searchPlaceholder: {
    flex: 1,
    fontSize: 14,
    color: "#9CA3AF",
    fontWeight: "500",
  },
  filterBtn: { padding: 4 },

  // Tab Filters
  tabContainer: { marginBottom: 24 },
  tabContent: { paddingHorizontal: 20, gap: 10 },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  tabActive: {
    backgroundColor: "#0F4A2F",
    borderColor: "#0F4A2F",
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
  },
  tabTextActive: {
    color: "#FFFFFF",
  },

  // Sections
  section: { paddingHorizontal: 20, marginBottom: 28 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
    letterSpacing: -0.2,
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: "#9CA3AF",
    fontWeight: "500",
    marginTop: 2,
  },
  recordCount: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "600",
    marginTop: 4,
  },
  exportBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F0FDF4",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  exportText: { fontSize: 12, fontWeight: "600", color: "#0F4A2F" },

  // Status Overview
  statusCard: {
    backgroundColor: "#FFFFFF",
    padding: 20,
    borderRadius: 20,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  statusBar: {
    flexDirection: "row",
    height: 12,
    borderRadius: 6,
    overflow: "hidden",
    marginBottom: 16,
  },
  statusSegment: { height: "100%" },
  statusLegend: { flexDirection: "row", justifyContent: "space-between" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: "#6B7280", fontWeight: "600" },

  // Hero Chart
  heroChartCard: {
    backgroundColor: "#FFFFFF",
    padding: 20,
    borderRadius: 20,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
    alignItems: "center",
  },
  chart: { borderRadius: 12, marginLeft: -10 },

  // Insights
  insightsRow: { flexDirection: "row", gap: 12 },
  insightCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 16,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  insightIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  insightValue: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 4,
  },
  insightLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 2,
  },
  insightDetail: { fontSize: 11, color: "#9CA3AF" },

  // Pie Chart
  pieCard: {
    backgroundColor: "#FFFFFF",
    padding: 20,
    borderRadius: 20,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
    alignItems: "center",
  },

  // List
  listContent: { gap: 12 },
  reportCard: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  statusIndicator: { width: 5 },
  cardContent: { flex: 1, padding: 16 },

  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  projectName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
    flex: 1,
    marginRight: 8,
  },
  siteName: { fontSize: 12.5, color: "#6B7280" },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 11, fontWeight: "700" },

  divider: { height: 1, backgroundColor: "#F3F4F6", marginBottom: 12 },

  metricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  metric: { flex: 1, alignItems: "center" },
  metricDivider: { width: 1, height: 24, backgroundColor: "#E5E7EB" },
  metricLabel: {
    fontSize: 10,
    color: "#9CA3AF",
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  metricValue: { fontSize: 16, fontWeight: "800" },

  cardBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  metaInfo: { flexDirection: "row", alignItems: "center", gap: 6 },
  dateText: { fontSize: 12, color: "#6B7280", fontWeight: "500" },
  dotSeparator: { fontSize: 12, color: "#D1D5DB" },
  reportId: { fontSize: 11, color: "#9CA3AF", fontWeight: "600" },

  emptyState: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 14, color: "#9CA3AF", fontWeight: "500" },
});

export default ReportsScreen;
