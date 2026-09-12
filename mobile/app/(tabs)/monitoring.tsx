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
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/constants/url_fixed";

const API_BASE_URL = api + "/api";

// ─── Types ─────────────────────────────────────────────────────────────────
type MonitoringSite = {
  site_id: number;
  site_name: string;
  reforestation_area_name: string | null;
  barangay_name: string | null;
  latest_report_date: string | null;
  days_since_last_report: number | null;
  total_reports: number;
  needs_initial: boolean;
  active_application_status: "accepted" | "under_monitoring" | "inactive";
};

// ─── Helpers ───────────────────────────────────────────────────────────────
function formatDate(iso: string | null) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ─── Components ────────────────────────────────────────────────────────────

function StatusBadge({
  status,
}: {
  status: "accepted" | "under_monitoring" | "inactive";
}) {
  const isActive = status === "accepted" || status === "under_monitoring";
  const config = isActive
    ? {
        label: "Active Program",
        color: "#10B981",
        bgColor: "#ECFDF5",
        borderColor: "#A7F3D0",
        icon: "leaf-outline" as const,
      }
    : {
        label: "Inactive / On Hold",
        color: "#6B7280",
        bgColor: "#F3F4F6",
        borderColor: "#E5E7EB",
        icon: "pause-circle-outline" as const,
      };

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
  needsInitial,
}: {
  days: number | null;
  needsInitial: boolean;
}) {
  if (needsInitial) {
    return (
      <View style={[styles.urgencyChip, { backgroundColor: "#DBEAFE" }]}>
        <Ionicons name="calendar-outline" size={11} color="#2563EB" />
        <Text style={[styles.urgencyText, { color: "#2563EB" }]}>
          Needs Initial
        </Text>
      </View>
    );
  }

  if (days === null) {
    return (
      <View style={[styles.urgencyChip, { backgroundColor: "#F3F4F6" }]}>
        <Ionicons name="time-outline" size={11} color="#6B7280" />
        <Text style={[styles.urgencyText, { color: "#6B7280" }]}>
          No Report
        </Text>
      </View>
    );
  }

  let bgColor = "#F3F4F6";
  let textColor = "#6B7280";
  let iconName: any = "time-outline";
  let label = `${days}d`;

  if (days >= 90) {
    bgColor = "#FEE2E2";
    textColor = "#DC2626";
    iconName = "alert-circle";
  } else if (days >= 60) {
    bgColor = "#FED7AA";
    textColor = "#C2410C";
    iconName = "warning";
  } else if (days >= 30) {
    bgColor = "#FEF3C7";
    textColor = "#B45309";
    iconName = "time-outline";
  } else {
    bgColor = "#DCFCE7";
    textColor = "#15803D";
    iconName = "checkmark-circle";
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
    </TouchableOpacity>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────
const OnsiteInspectorMonitoring: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [sites, setSites] = useState<MonitoringSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [searchText, setSearchText] = useState("");
  const [programStatusFilter, setProgramStatusFilter] = useState<
    "all" | "active" | "inactive"
  >("all");
  const [urgencyFilter, setUrgencyFilter] = useState<
    "all" | "30_plus" | "60_plus" | "90_plus"
  >("all");
  const [needsInitial, setNeedsInitial] = useState(false);

  const fetchSites = async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      else setRefreshing(true);

      const token = await SecureStore.getItemAsync("token");
      if (!token) throw new Error("No token found.");

      const params = new URLSearchParams();
      params.append("page", "1");
      params.append("entries", "50");
      params.append("program_status", programStatusFilter);
      params.append("days_since", urgencyFilter);
      params.append("needs_initial", needsInitial ? "true" : "false");
      if (searchText.trim()) params.append("search", searchText.trim());

      const res = await fetch(
        `${API_BASE_URL}/get_monitoring_sites/?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!res.ok) throw new Error("Failed to load sites.");
      const data = await res.json();
      setSites(data.data || []);
    } catch (err: any) {
      console.error("Error fetching sites:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Debounced fetch on filter changes
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSites();
    }, 500);
    return () => clearTimeout(timer);
  }, [programStatusFilter, urgencyFilter, needsInitial, searchText]);

  const renderSiteItem = ({ item }: { item: MonitoringSite }) => {
    const isActive =
      item.active_application_status === "accepted" ||
      item.active_application_status === "under_monitoring";
    const borderLeftColor = isActive ? "#10B981" : "#9CA3AF";

    return (
      <TouchableOpacity
        style={[styles.card, { borderLeftColor }]}
        activeOpacity={0.7}
        onPress={() => router.push(`./monitoring/${item.site_id}` as any)}
      >
        <View style={styles.cardContent}>
          {/* Header */}
          <View style={styles.cardHeader}>
            <StatusBadge status={item.active_application_status} />
            <UrgencyChip
              days={item.days_since_last_report}
              needsInitial={item.needs_initial}
            />
          </View>

          {/* Title & Location */}
          <Text style={styles.cardTitle} numberOfLines={2}>
            {item.site_name}
          </Text>
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={13} color="#9CA3AF" />
            <Text style={styles.locationText} numberOfLines={1}>
              {item.reforestation_area_name || "Unknown Area"}
              {item.barangay_name ? ` · ${item.barangay_name}` : ""}
            </Text>
          </View>

          {/* Stats / Info */}
          <View style={styles.statsRow}>
            <View style={styles.statBlock}>
              <Text style={styles.statValue}>
                {formatDate(item.latest_report_date)}
              </Text>
              <Text style={styles.statLabel}>Last Report</Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statBlock}>
              <Text style={styles.statValue}>{item.total_reports}</Text>
              <Text style={styles.statLabel}>Total Reports</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.cardFooter}>
          <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Fixed Header */}
      <View style={styles.header}>
        <Text style={styles.headerEyebrow}>Monitoring</Text>
        <Text style={styles.headerTitle}>Site Progress</Text>

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
            placeholder="Search sites, areas, barangays..."
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

        {/* Program Status Filters */}
        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>Program Status</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipScroll}
          >
            <FilterChip
              label="All Sites"
              active={programStatusFilter === "all"}
              onPress={() => setProgramStatusFilter("all")}
              activeColor="#3B82F6"
            />
            <FilterChip
              label="Active Programs"
              active={programStatusFilter === "active"}
              onPress={() => setProgramStatusFilter("active")}
              activeColor="#10B981"
            />
            <FilterChip
              label="Inactive / No Program"
              active={programStatusFilter === "inactive"}
              onPress={() => setProgramStatusFilter("inactive")}
              activeColor="#6B7280"
            />
          </ScrollView>
        </View>

        {/* Urgency Filters */}
        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>Urgency & Initial</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipScroll}
          >
            <FilterChip
              label="Needs Initial"
              active={needsInitial}
              onPress={() => setNeedsInitial(!needsInitial)}
              activeColor="#2563EB"
            />
            <FilterChip
              label="All"
              active={urgencyFilter === "all" && !needsInitial}
              onPress={() => {
                setUrgencyFilter("all");
                setNeedsInitial(false);
              }}
              activeColor="#3B82F6"
            />
            <FilterChip
              label="30+ Days"
              active={urgencyFilter === "30_plus"}
              onPress={() => {
                setUrgencyFilter("30_plus");
                setNeedsInitial(false);
              }}
              activeColor="#F59E0B"
            />
            <FilterChip
              label="60+ Days"
              active={urgencyFilter === "60_plus"}
              onPress={() => {
                setUrgencyFilter("60_plus");
                setNeedsInitial(false);
              }}
              activeColor="#F97316"
            />
            <FilterChip
              label="90+ Days"
              active={urgencyFilter === "90_plus"}
              onPress={() => {
                setUrgencyFilter("90_plus");
                setNeedsInitial(false);
              }}
              activeColor="#EF4444"
            />
          </ScrollView>
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="small" color="#3B82F6" />
          <Text style={styles.loadingText}>Loading sites...</Text>
        </View>
      ) : (
        <FlatList
          data={sites}
          renderItem={renderSiteItem}
          keyExtractor={(item) => item.site_id.toString()}
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
              <Text style={styles.emptyTitle}>No Sites Found</Text>
              <Text style={styles.emptySubtitle}>
                {searchText
                  ? `No results for "${searchText}"`
                  : "No sites match the current filters."}
              </Text>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchSites(true)}
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
  filterSection: {
    marginBottom: 10,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  chipScroll: {
    flexGrow: 0,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginRight: 8,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#4B5563",
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
    marginBottom: 4,
    lineHeight: 20,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 12,
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
  statValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#374151",
  },
  statLabel: {
    fontSize: 10,
    color: "#9CA3AF",
    marginTop: 2,
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
