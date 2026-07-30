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
type UrgencyFilter = "all" | "30_plus" | "60_plus" | "90_plus";

// ─── Status Config ─────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  accepted: {
    label: "Orientation",
    color: "#3B82F6",
    bgColor: "#EFF6FF",
    borderColor: "#BFDBFE",
    icon: "calendar-outline",
  },
  under_monitoring: {
    label: "Ongoing",
    color: "#10B981",
    bgColor: "#ECFDF5",
    borderColor: "#A7F3D0",
    icon: "leaf-outline",
  },
};

// ─── Helpers ───────────────────────────────────────────────────────────────
function formatStat(value: number | null, fallback = "—") {
  if (value === null || value === undefined) return fallback;
  return value.toString();
}

function formatRate(value: number | null) {
  if (value === null || value === undefined) return "—";
  return `${value}%`;
}

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
      <Ionicons name={config.icon} size={11} color={config.color} />
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
  let textColor = "#6B7280";
  let label = days !== null ? `${days}d` : "—";
  let iconName: any = "time-outline";

  if (status === "accepted") {
    if (days === null || days === 0) {
      label = "Awaiting Initial";
      iconName = "time-outline";
    } else {
      label = `${days}d`;
    }
  } else if (days === null) {
    bgColor = "#FEE2E2";
    textColor = "#DC2626";
    label = "Overdue";
    iconName = "alert-circle";
  } else if (days >= 90) {
    bgColor = "#FEE2E2";
    textColor = "#DC2626";
    label = `${days}d`;
    iconName = "alert-circle";
  } else if (days >= 60) {
    bgColor = "#FED7AA";
    textColor = "#C2410C";
    label = `${days}d`;
    iconName = "warning";
  } else if (days >= 30) {
    bgColor = "#FEF3C7";
    textColor = "#B45309";
    label = `${days}d`;
    iconName = "time-outline";
  }

  return (
    <View style={[styles.urgencyChip, { backgroundColor: bgColor }]}>
      <Ionicons name={iconName} size={11} color={textColor} />
      <Text style={[styles.urgencyText, { color: textColor }]}>{label}</Text>
    </View>
  );
}

function FilterChip({
  label,
  active,
  onPress,
  activeColor = "#3B82F6",
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  activeColor?: string;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.filterChip,
        active && {
          backgroundColor: `${activeColor}15`,
          borderColor: activeColor,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text
        style={[
          styles.filterChipText,
          active && { color: activeColor, fontWeight: "700" },
        ]}
      >
        {label}
      </Text>
      <Ionicons
        name="chevron-down"
        size={12}
        color={active ? activeColor : "#9CA3AF"}
        style={{ marginLeft: 2 }}
      />
    </TouchableOpacity>
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
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyFilter>("all");
  const [classificationFilter, setClassificationFilter] = useState<
    "all" | "new" | "old"
  >("all");
  const [sortBy, setSortBy] = useState<"newest" | "urgent">("urgent");

  // Dropdown states
  const [openDropdown, setOpenDropdown] = useState<
    null | "sort" | "classification" | "urgency"
  >(null);

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

  // Reset urgency when switching to Orientation
  useEffect(() => {
    if (statusFilter === "accepted") {
      setUrgencyFilter("all");
    }
  }, [statusFilter]);

  const filteredApps = React.useMemo(() => {
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

    if (statusFilter !== "accepted" && urgencyFilter !== "all") {
      if (urgencyFilter === "30_plus") {
        filtered = filtered.filter((app) => {
          const days = app.days_since_last_report ?? 999;
          return days >= 30 && days < 60;
        });
      } else if (urgencyFilter === "60_plus") {
        filtered = filtered.filter((app) => {
          const days = app.days_since_last_report ?? 999;
          return days >= 60 && days < 90;
        });
      } else if (urgencyFilter === "90_plus") {
        filtered = filtered.filter((app) => {
          const days = app.days_since_last_report ?? 999;
          return days >= 90;
        });
      }
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

    return filtered;
  }, [searchText, statusFilter, urgencyFilter, applications, sortBy]);

  const orientationCount = applications.filter(
    (a) => a.status === "accepted",
  ).length;
  const ongoingCount = applications.filter(
    (a) => a.status === "under_monitoring",
  ).length;

  const renderAppItem = ({ item }: { item: Application }) => {
    const statusConfig =
      STATUS_CONFIG[item.status as keyof typeof STATUS_CONFIG] ||
      STATUS_CONFIG.accepted;

    const hasNoData =
      item.total_survived === 0 &&
      item.total_dead === 0 &&
      item.survival_rate === 0;

    return (
      <TouchableOpacity
        style={[styles.card, { borderLeftColor: statusConfig.color }]}
        activeOpacity={0.7}
        onPress={() => router.push(`./monitoring/${item.application_id}`)}
      >
        <View style={styles.cardContent}>
          {/* Header */}
          <View style={styles.cardHeader}>
            <StatusBadge status={item.status} />
            <UrgencyChip
              days={item.days_since_last_report}
              status={item.status}
            />
          </View>

          {/* Title & Group */}
          <Text style={styles.cardTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={styles.groupName}>
            {item.group_name}
            <Text style={styles.metaDot}> · </Text>
            <Text style={styles.classificationInline}>
              {item.classification === "new" ? "First-Time" : "Returning"}
            </Text>
          </Text>

          {/* Location */}
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={13} color="#9CA3AF" />
            <Text style={styles.locationText} numberOfLines={1}>
              {item.barangay || "No Barangay"} · {item.site_name || "No Site"}
            </Text>
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statBlock}>
              <Text style={styles.survivalNumbers}>
                <Text style={styles.survivedText}>
                  {formatStat(item.total_survived)}
                </Text>
                <Text style={styles.slashText}> / </Text>
                <Text style={styles.deadText}>
                  {formatStat(item.total_dead)}
                </Text>
              </Text>
              <Text style={styles.statLabel}>Survived / Dead</Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statBlock}>
              <Text
                style={[styles.rateValue, hasNoData && { color: "#9CA3AF" }]}
              >
                {formatRate(item.survival_rate)}
              </Text>
              <Text style={styles.statLabel}>Survival Rate</Text>
            </View>
          </View>
        </View>

        {/* Footer — minimal */}
        <View style={styles.cardFooter}>
          <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
        </View>
      </TouchableOpacity>
    );
  };

  const renderDropdown = () => {
    if (!openDropdown) return null;

    const items: { label: string; onPress: () => void }[] = [];
    let title = "";

    if (openDropdown === "sort") {
      title = "Sort By";
      items.push(
        {
          label: "Most Urgent",
          onPress: () => {
            setSortBy("urgent");
            setOpenDropdown(null);
          },
        },
        {
          label: "Newest First",
          onPress: () => {
            setSortBy("newest");
            setOpenDropdown(null);
          },
        },
      );
    } else if (openDropdown === "classification") {
      title = "Classification";
      items.push(
        {
          label: "All",
          onPress: () => {
            setClassificationFilter("all");
            setOpenDropdown(null);
          },
        },
        {
          label: "First-Time",
          onPress: () => {
            setClassificationFilter("new");
            setOpenDropdown(null);
          },
        },
        {
          label: "Returning",
          onPress: () => {
            setClassificationFilter("old");
            setOpenDropdown(null);
          },
        },
      );
    } else if (openDropdown === "urgency") {
      title = "Urgency";
      items.push(
        {
          label: "All",
          onPress: () => {
            setUrgencyFilter("all");
            setOpenDropdown(null);
          },
        },
        {
          label: "30+ Days",
          onPress: () => {
            setUrgencyFilter("30_plus");
            setOpenDropdown(null);
          },
        },
        {
          label: "60+ Days",
          onPress: () => {
            setUrgencyFilter("60_plus");
            setOpenDropdown(null);
          },
        },
        {
          label: "90+ Days",
          onPress: () => {
            setUrgencyFilter("90_plus");
            setOpenDropdown(null);
          },
        },
      );
    }

    return (
      <TouchableOpacity
        style={styles.dropdownOverlay}
        activeOpacity={1}
        onPress={() => setOpenDropdown(null)}
      >
        <View style={styles.dropdown}>
          <Text style={styles.dropdownTitle}>{title}</Text>
          {items.map((item, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.dropdownItem}
              onPress={item.onPress}
            >
              <Text style={styles.dropdownItemText}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Fixed Header */}
      <View style={styles.header}>
        <Text style={styles.headerEyebrow}>Monitoring</Text>
        <Text style={styles.headerTitle}>Tree Planting Programs</Text>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Ionicons
            name="search"
            size={18}
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
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText("")}>
              <Ionicons name="close-circle" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>

        {/* Status Tabs */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[
              styles.tab,
              statusFilter === "accepted" && styles.tabActive,
              {
                borderColor:
                  statusFilter === "accepted" ? "#3B82F6" : "#E5E7EB",
              },
            ]}
            onPress={() => setStatusFilter("accepted")}
          >
            <Ionicons
              name="calendar"
              size={14}
              color={statusFilter === "accepted" ? "#3B82F6" : "#9CA3AF"}
            />
            <Text
              style={[
                styles.tabText,
                statusFilter === "accepted" && styles.tabTextActive,
              ]}
            >
              Orientation
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
                {orientationCount}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tab,
              statusFilter === "under_monitoring" && styles.tabActive,
              {
                borderColor:
                  statusFilter === "under_monitoring" ? "#10B981" : "#E5E7EB",
              },
            ]}
            onPress={() => setStatusFilter("under_monitoring")}
          >
            <Ionicons
              name="leaf"
              size={14}
              color={
                statusFilter === "under_monitoring" ? "#10B981" : "#9CA3AF"
              }
            />
            <Text
              style={[
                styles.tabText,
                statusFilter === "under_monitoring" && styles.tabTextActive,
              ]}
            >
              Ongoing
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
                {ongoingCount}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tab,
              statusFilter === "all" && styles.tabActiveAll,
              { borderColor: statusFilter === "all" ? "#6B7280" : "#E5E7EB" },
            ]}
            onPress={() => setStatusFilter("all")}
          >
            <Ionicons
              name="grid"
              size={14}
              color={statusFilter === "all" ? "#374151" : "#9CA3AF"}
            />
            <Text
              style={[
                styles.tabText,
                statusFilter === "all" && styles.tabTextActive,
              ]}
            >
              All
            </Text>
          </TouchableOpacity>
        </View>

        {/* Compact Filter Bar */}
        <View style={styles.filterBar}>
          {(statusFilter === "under_monitoring" || statusFilter === "all") && (
            <FilterChip
              label={
                urgencyFilter === "all"
                  ? "Urgency: All"
                  : urgencyFilter === "30_plus"
                    ? "Urgency: 30+"
                    : urgencyFilter === "60_plus"
                      ? "Urgency: 60+"
                      : "Urgency: 90+"
              }
              active={openDropdown === "urgency"}
              activeColor="#DC2626"
              onPress={() =>
                setOpenDropdown(openDropdown === "urgency" ? null : "urgency")
              }
            />
          )}
        </View>
      </View>

      {/* Dropdown Overlay */}
      {renderDropdown()}

      {/* Content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="small" color="#3B82F6" />
          <Text style={styles.loadingText}>Loading programs...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredApps}
          renderItem={renderAppItem}
          keyExtractor={(item) => item.application_id.toString()}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons
                  name="folder-open-outline"
                  size={40}
                  color="#D1D5DB"
                />
              </View>
              <Text style={styles.emptyTitle}>No Programs Found</Text>
              <Text style={styles.emptySubtitle}>
                {searchText
                  ? `No results for "${searchText}"`
                  : statusFilter === "accepted"
                    ? "No programs in orientation"
                    : statusFilter === "under_monitoring"
                      ? "No ongoing programs match this filter"
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
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "#F9FAFB",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  headerEyebrow: {
    fontSize: 11,
    color: "#9CA3AF",
    fontWeight: "600",
    marginTop: 8,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
    letterSpacing: -0.3,
    marginBottom: 12,
    marginTop: 2,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 42,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#111827",
    fontWeight: "500",
  },
  tabRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: "#FFFFFF",
  },
  tabActive: {
    backgroundColor: "#EFF6FF",
  },
  tabActiveAll: {
    backgroundColor: "#F3F4F6",
  },
  tabText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  tabTextActive: {
    color: "#111827",
    fontWeight: "700",
  },
  tabBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    marginLeft: 2,
    minWidth: 18,
    alignItems: "center",
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  filterBar: {
    flexDirection: "row",
    gap: 8,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#4B5563",
  },
  dropdownOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
    backgroundColor: "rgba(0,0,0,0.04)",
  },
  dropdown: {
    position: "absolute",
    top: 190,
    left: 16,
    right: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  dropdownTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  dropdownItemText: {
    fontSize: 14,
    color: "#374151",
    fontWeight: "500",
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    marginBottom: 10,
    borderLeftWidth: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    overflow: "hidden",
  },
  cardContent: {
    padding: 14,
    paddingBottom: 10,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "700",
  },
  urgencyChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  urgencyText: {
    fontSize: 10,
    fontWeight: "700",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 3,
    lineHeight: 20,
  },
  groupName: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 8,
  },
  metaDot: {
    color: "#D1D5DB",
  },
  classificationInline: {
    fontSize: 12,
    color: "#9CA3AF",
    fontWeight: "500",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 10,
  },
  locationText: {
    fontSize: 12,
    color: "#9CA3AF",
    flex: 1,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  statBlock: {
    flex: 1,
  },
  survivalNumbers: {
    fontSize: 15,
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
    color: "#EF4444",
    fontWeight: "700",
  },
  statLabel: {
    fontSize: 10,
    color: "#9CA3AF",
    marginTop: 2,
  },
  rateValue: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: "#F3F4F6",
    marginHorizontal: 14,
  },
  cardFooter: {
    alignItems: "flex-end",
    paddingHorizontal: 14,
    paddingBottom: 10,
    marginTop: -4,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    color: "#9CA3AF",
    fontSize: 14,
    fontWeight: "500",
  },
  emptyState: {
    alignItems: "center",
    marginTop: 80,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 18,
  },
});

export default OnsiteInspectorMonitoring;
