import React, { useState, useEffect } from "react";
import { useRouter } from "expo-router";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/constants/url_fixed";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const API_BASE_URL = api + "/api";

// ─── Types ─────────────────────────────────────────────────────────────────
type Application = {
  application_id: number;
  title: string;
  group_name: string;
  status: string;
  classification: "new" | "old";
  site_name: string | null;
  barangay: string | null;
  orientation_date: string | null;
  last_report_date: string | null;
  days_since_last_report: number | null;
  total_survived: number;
  total_dead: number;
  survival_rate: number;
  visit_type_hint?: string;
  created_at?: string;
};

type StatusFilter = "accepted" | "under_monitoring" | "all";

// ─── Status Config ─────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  accepted: {
    label: "Needs Orientation",
    color: "#3B82F6",
    bgColor: "#EFF6FF",
    borderColor: "#3B82F6",
    icon: "calendar-outline",
  },
  under_monitoring: {
    label: "Under Monitoring",
    color: "#10B981",
    bgColor: "#ECFDF5",
    borderColor: "#10B981",
    icon: "leaf-outline",
  },
};

// ─── Components ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const config =
    STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ||
    STATUS_CONFIG.accepted;
  return (
    <View
      style={[
        styles.statusBadge,
        { backgroundColor: config.bgColor, borderColor: config.borderColor },
      ]}
    >
      <Ionicons name={config.icon} size={12} color={config.color} />
      <Text style={[styles.statusText, { color: config.color }]}>
        {config.label}
      </Text>
    </View>
  );
}

function UrgencyChip({
  days,
  status,
}: {
  days: number | null;
  status: string;
}) {
  let bgColor = "#F3F4F6";
  let textColor = "#4B5563";
  let label = `${days}d`;
  let iconName = "checkmark-circle";

  if (status === "accepted" && (days === null || days === 0)) {
    bgColor = "#F3F4F6";
    textColor = "#4B5563";
    label = "Awaiting Initial";
    iconName = "time-outline";
  } else if (days === null) {
    bgColor = "#FEE2E2";
    textColor = "#DC2626";
    label = "Overdue";
    iconName = "alert-circle";
  } else if (days >= 90) {
    bgColor = "#FEE2E2";
    textColor = "#DC2626";
    label = `${days}d Critical`;
    iconName = "alert-circle";
  } else if (days >= 60) {
    bgColor = "#FED7AA";
    textColor = "#EA580C";
    label = `${days}d Warning`;
    iconName = "warning";
  } else if (days >= 30) {
    bgColor = "#FEF3C7";
    textColor = "#D97706";
    label = `${days}d`;
    iconName = "time-outline";
  }

  return (
    <View style={[styles.urgencyChip, { backgroundColor: bgColor }]}>
      <Ionicons name={iconName} size={13} color={textColor} />
      <Text style={[styles.urgencyText, { color: textColor }]}>{label}</Text>
    </View>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────
const OnsiteInspectorMonitoring: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("accepted");
  const [classificationFilter, setClassificationFilter] = useState<
    "all" | "new" | "old"
  >("all");
  const [sortBy, setSortBy] = useState<"newest" | "urgent">("urgent");
  const [showFilters, setShowFilters] = useState(false);
  const [filteredApps, setFilteredApps] = useState<Application[]>([]);

  const fetchApplications = async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      else setRefreshing(true);

      const token = await SecureStore.getItemAsync("token");
      if (!token) throw new Error("No token found.");

      const params = new URLSearchParams();
      params.append("sort", sortBy);
      if (classificationFilter !== "all")
        params.append("classification", classificationFilter);

      const res = await fetch(
        `${API_BASE_URL}/get_ongoing_applications/?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!res.ok) throw new Error("Failed to load applications.");
      const data = await res.json();
      setApplications(data);
    } catch (err: any) {
      console.error("Error fetching applications:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, [sortBy, classificationFilter]);

  useEffect(() => {
    let filtered = [...applications];

    if (statusFilter !== "all") {
      filtered = filtered.filter((app) => app.status === statusFilter);
    }

    if (searchText.trim()) {
      const lowerText = searchText.toLowerCase();
      filtered = filtered.filter(
        (app) =>
          app.barangay?.toLowerCase().includes(lowerText) ||
          app.title.toLowerCase().includes(lowerText) ||
          app.group_name.toLowerCase().includes(lowerText) ||
          app.site_name?.toLowerCase().includes(lowerText),
      );
    }

    if (sortBy === "urgent") {
      filtered.sort((a, b) => {
        const aDays = a.days_since_last_report ?? 999;
        const bDays = b.days_since_last_report ?? 999;
        return bDays - aDays;
      });
    } else {
      filtered.sort(
        (a, b) =>
          new Date(b.created_at || 0).getTime() -
          new Date(a.created_at || 0).getTime(),
      );
    }

    setFilteredApps(filtered);
  }, [searchText, statusFilter, applications, sortBy]);

  const needsOrientationCount = applications.filter(
    (a) => a.status === "accepted",
  ).length;
  const underMonitoringCount = applications.filter(
    (a) => a.status === "under_monitoring",
  ).length;

  const renderAppItem = ({ item }: { item: Application }) => {
    const statusConfig =
      STATUS_CONFIG[item.status as keyof typeof STATUS_CONFIG] ||
      STATUS_CONFIG.accepted;

    return (
      <TouchableOpacity
        style={[styles.card, { borderLeftColor: statusConfig.color }]}
        activeOpacity={0.7}
        onPress={() => router.push(`/monitoring/${item.application_id}`)}
      >
        <View style={styles.cardContent}>
          {/* Header — single status badge + urgency chip only */}
          <View style={styles.cardHeader}>
            <StatusBadge status={item.status} />
            <UrgencyChip
              days={item.days_since_last_report}
              status={item.status}
            />
          </View>

          {/* Title & Group — classification folded in as plain text */}
          <Text style={styles.cardTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={styles.groupName}>
            {item.group_name}
            <Text style={styles.classificationInline}>
              {"  ·  "}
              {item.classification === "new" ? "First-Time" : "Returning"}
            </Text>
          </Text>

          {/* Location */}
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={15} color="#9CA3AF" />
            <Text style={styles.locationText} numberOfLines={1}>
              {item.barangay || "No Barangay"} • {item.site_name || "No Site"}
            </Text>
          </View>

          {/* Stats — flattened, no nested card background */}
          <View style={styles.statsRow}>
            <View style={styles.statBlock}>
              <Text style={styles.survivalNumbers}>
                <Text style={styles.survivedText}>{item.total_survived}</Text>
                <Text style={styles.slashText}> / </Text>
                <Text style={styles.deadText}>{item.total_dead}</Text>
              </Text>
              <Text style={styles.statLabel}>Survived / Dead</Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statBlock}>
              <Text style={styles.rateValue}>{item.survival_rate}%</Text>
              <Text style={styles.statLabel}>Survival Rate</Text>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.cardFooter}>
            <Text style={styles.actionText}>View Details & Submit Report</Text>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerEyebrow}>Monitoring</Text>
        <Text style={styles.headerTitle}>Tree Planting Programs</Text>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons
            name="search"
            size={20}
            color="#9CA3AF"
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search programs, groups, sites..."
            value={searchText}
            onChangeText={setSearchText}
            placeholderTextColor="#9CA3AF"
          />
          <TouchableOpacity
            onPress={() => setShowFilters(!showFilters)}
            style={styles.filterButton}
          >
            <Ionicons
              name={showFilters ? "close" : "options"}
              size={20}
              color={showFilters ? "#3B82F6" : "#6B7280"}
            />
          </TouchableOpacity>
        </View>

        {/* Status Filter Tabs — single source of truth for counts */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[
              styles.tab,
              {
                backgroundColor:
                  statusFilter === "accepted" ? "#EFF6FF" : "#FFFFFF",
                borderColor:
                  statusFilter === "accepted" ? "#3B82F6" : "#E5E7EB",
              },
            ]}
            onPress={() => setStatusFilter("accepted")}
          >
            <Ionicons
              name="calendar"
              size={16}
              color={statusFilter === "accepted" ? "#3B82F6" : "#6B7280"}
            />
            <Text
              style={[
                styles.tabText,
                statusFilter === "accepted" && styles.activeTabText,
              ]}
            >
              Needs Orientation
            </Text>
            <View
              style={[
                styles.tabBadge,
                {
                  backgroundColor:
                    statusFilter === "accepted" ? "#3B82F6" : "#E5E7EB",
                },
              ]}
            >
              <Text
                style={[
                  styles.tabBadgeText,
                  {
                    color: statusFilter === "accepted" ? "#FFFFFF" : "#6B7280",
                  },
                ]}
              >
                {needsOrientationCount}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tab,
              {
                backgroundColor:
                  statusFilter === "under_monitoring" ? "#ECFDF5" : "#FFFFFF",
                borderColor:
                  statusFilter === "under_monitoring" ? "#10B981" : "#E5E7EB",
              },
            ]}
            onPress={() => setStatusFilter("under_monitoring")}
          >
            <Ionicons
              name="leaf"
              size={16}
              color={
                statusFilter === "under_monitoring" ? "#10B981" : "#6B7280"
              }
            />
            <Text
              style={[
                styles.tabText,
                statusFilter === "under_monitoring" && styles.activeTabText,
              ]}
            >
              Under Monitoring
            </Text>
            <View
              style={[
                styles.tabBadge,
                {
                  backgroundColor:
                    statusFilter === "under_monitoring" ? "#10B981" : "#E5E7EB",
                },
              ]}
            >
              <Text
                style={[
                  styles.tabBadgeText,
                  {
                    color:
                      statusFilter === "under_monitoring"
                        ? "#FFFFFF"
                        : "#6B7280",
                  },
                ]}
              >
                {underMonitoringCount}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tab,
              {
                backgroundColor: statusFilter === "all" ? "#F3F4F6" : "#FFFFFF",
                borderColor: statusFilter === "all" ? "#9CA3AF" : "#E5E7EB",
              },
            ]}
            onPress={() => setStatusFilter("all")}
          >
            <Ionicons name="grid" size={16} color="#6B7280" />
            <Text
              style={[
                styles.tabText,
                statusFilter === "all" && styles.activeTabText,
              ]}
            >
              All
            </Text>
          </TouchableOpacity>
        </View>

        {/* Expanded Filters */}
        {showFilters && (
          <View style={styles.filterPanel}>
            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>Sort By:</Text>
              <View style={styles.filterChips}>
                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    sortBy === "urgent" && styles.filterChipActive,
                  ]}
                  onPress={() => setSortBy("urgent")}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      sortBy === "urgent" && styles.filterChipTextActive,
                    ]}
                  >
                    Most Urgent
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    sortBy === "newest" && styles.filterChipActive,
                  ]}
                  onPress={() => setSortBy("newest")}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      sortBy === "newest" && styles.filterChipTextActive,
                    ]}
                  >
                    Newest
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>Classification:</Text>
              <View style={styles.filterChips}>
                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    classificationFilter === "all" && styles.filterChipActive,
                  ]}
                  onPress={() => setClassificationFilter("all")}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      classificationFilter === "all" &&
                        styles.filterChipTextActive,
                    ]}
                  >
                    All
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    classificationFilter === "new" && styles.filterChipActive,
                  ]}
                  onPress={() => setClassificationFilter("new")}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      classificationFilter === "new" &&
                        styles.filterChipTextActive,
                    ]}
                  >
                    First-Time
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    classificationFilter === "old" && styles.filterChipActive,
                  ]}
                  onPress={() => setClassificationFilter("old")}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      classificationFilter === "old" &&
                        styles.filterChipTextActive,
                    ]}
                  >
                    Returning
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Loading programs...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredApps}
          renderItem={renderAppItem}
          keyExtractor={(item) => item.application_id.toString()}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons
                  name="folder-open-outline"
                  size={48}
                  color="#D1D5DB"
                />
              </View>
              <Text style={styles.emptyTitle}>No Programs Found</Text>
              <Text style={styles.emptySubtitle}>
                {searchText
                  ? `No results for "${searchText}"`
                  : statusFilter === "accepted"
                    ? "No programs need orientation"
                    : statusFilter === "under_monitoring"
                      ? "No programs under monitoring"
                      : "No active applications found."}
              </Text>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchApplications(true)}
              tintColor="#3B82F6"
            />
          }
        />
      )}
    </View>
  );
};

// ─── Styles ────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: "#F9FAFB",
  },
  headerEyebrow: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "600",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#111827",
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 50,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#111827",
    fontWeight: "500",
  },
  filterButton: {
    padding: 4,
  },
  tabContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    flex: 0, // Change from flex: 1 to flex: 0
    minWidth: 100, // Add minimum width
  },
  tabText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  activeTabText: {
    fontWeight: "700",
    color: "#111827",
  },
  tabBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 2,
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  filterPanel: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 16,
  },
  filterRow: {
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  filterChips: {
    flexDirection: "row",
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  filterChipActive: {
    backgroundColor: "#3B82F6",
    borderColor: "#3B82F6",
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
  },
  filterChipTextActive: {
    color: "#FFFFFF",
  },
  listContent: {
    padding: 20,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    marginBottom: 14,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    overflow: "hidden",
  },
  cardContent: {
    padding: 18,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
  },
  urgencyChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  urgencyText: {
    fontSize: 11,
    fontWeight: "700",
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
    lineHeight: 22,
  },
  groupName: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 10,
  },
  classificationInline: {
    fontSize: 13,
    color: "#9CA3AF",
    fontWeight: "500",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 14,
  },
  locationText: {
    fontSize: 13,
    color: "#6B7280",
    flex: 1,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  statBlock: {
    flex: 1,
  },
  survivalNumbers: {
    fontSize: 16,
    fontWeight: "700",
  },
  survivedText: {
    color: "#111827",
    fontWeight: "800",
  },
  slashText: {
    color: "#D1D5DB",
    fontWeight: "500",
  },
  deadText: {
    color: "#DC2626",
    fontWeight: "700",
  },
  statLabel: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 3,
  },
  rateValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: "#F3F4F6",
    marginHorizontal: 16,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
  },
  actionText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#059669",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    color: "#6B7280",
    fontSize: 15,
    fontWeight: "500",
  },
  emptyState: {
    alignItems: "center",
    marginTop: 80,
    gap: 16,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#374151",
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
  },
});

export default OnsiteInspectorMonitoring;
