import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "expo-router";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/constants/url_fixed";

// ─── Design Tokens (matches app-wide palette) ───────────────────────────────
const PRIMARY = "#0F4A2F";
const SUCCESS = "#16A34A";
const DANGER = "#DC2626";
const INK = "#111827";
const MUTED = "#6B7280";
const FAINT = "#9CA3AF";
const WHITE = "#FFFFFF";
const BG = "#F4F7F5";
const BORDER = "#E5E7EB";
const WARNING = "#D97706";

const cardShadow = {
  shadowColor: "#0F172A",
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.03,
  shadowRadius: 8,
  elevation: 1,
};

// ─── Types ───────────────────────────────────────────────────────────────────
type DeliveryStatus = "accepted" | "confirmed" | "cancelled" | "rejected" | "pending";
type FilterTab = "all" | "accepted" | "confirmed" | "cancelled";

interface SeedlingSpeciesItem {
  species_id: number;
  species_name: string;
  quantity: number;
}

interface DeliveryTask {
  request_id: number;
  application_title: string;
  group_name: string;
  group_contact: string;
  site_name: string;
  fulfillment_type: string;
  no_request_seedling: number;
  submitted_at: string | null;
  status: DeliveryStatus; // ✅ Backend now returns this field
  species: SeedlingSpeciesItem[];
}

// ─── Status Meta ─────────────────────────────────────────────────────────────
const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "Pending", color: WARNING, bg: "#FEF3C7" },
  accepted: { label: "Awaiting Delivery", color: WARNING, bg: "#FEF3C7" },
  confirmed: { label: "Completed", color: SUCCESS, bg: "#DCFCE7" },
  cancelled: { label: "Canceled", color: DANGER, bg: "#FEE2E2" },
  rejected: { label: "Rejected", color: DANGER, bg: "#FEE2E2" },
};

function formatDate(iso: string | null) {
  if (!iso) return "No date set";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function OnsiteInspectorDelivery() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [deliveries, setDeliveries] = useState<DeliveryTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("all");

  // ─── Fetch List ────────────────────────────────────────────────────────────
  const fetchDeliveries = useCallback(
    async (isRefresh = false) => {
      try {
        if (!isRefresh) setLoading(true);
        const token = await SecureStore.getItemAsync("token");
        if (!token) throw new Error("No authentication token found.");

        // ✅ Pass the activeTab to the backend as a status filter
        const params = new URLSearchParams();
        if (activeTab !== "all") {
          params.append("status", activeTab);
        }

        const queryString = params.toString();
        const url = `${api}/api/requests/inspector-tasks/${queryString ? `?${queryString}` : ""}`;

        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          let detail = `HTTP ${res.status}`;
          try {
            const errBody = await res.json();
            if (errBody?.error) detail = errBody.error;
          } catch {
            // response wasn't JSON
          }
          console.error(`❌ inspector-tasks failed: ${detail}`);
          throw new Error(
            res.status === 403
              ? "You're not authorized to view deliveries. Make sure you're logged in as an inspector."
              : `Failed to load deliveries (${detail}).`
          );
        }

        const data = await res.json();
        setDeliveries(Array.isArray(data) ? data : []);
      } catch (err: any) {
        console.error("❌ Fetch deliveries error:", err);
        Alert.alert("Error", err.message || "Failed to load deliveries.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeTab] // ✅ Re-fetch when tab changes
  );

  useEffect(() => {
    fetchDeliveries();
  }, [fetchDeliveries]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDeliveries(true);
  };

  // ─── Filtering (Client-side search only, backend handles tab filtering) ───
  const filteredDeliveries = deliveries.filter((item) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      item.group_name?.toLowerCase().includes(q) ||
      item.application_title?.toLowerCase().includes(q);
    return matchesSearch;
  });

  // ─── Navigation to Detail Screen ────────────────────────────────────────────
  const openDetail = (requestId: number) => {
    router.push({
      pathname: "/(tabs)/deliverydetail",
      params: { id: String(requestId) },
    });
  };

  // ─── Render: List Item ───────────────────────────────────────────────────
  const renderItem = ({ item }: { item: DeliveryTask }) => {
    const meta = STATUS_META[item.status] || STATUS_META.accepted;
    const speciesSummary =
      item.species && item.species.length > 0
        ? item.species.map((s) => `${s.species_name} (x${s.quantity})`).join(", ")
        : "No species listed";

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => openDetail(item.request_id)}
      >
        <View style={styles.cardTopRow}>
          <View style={styles.cardIcon}>
            <MaterialCommunityIcons name="truck-delivery-outline" size={20} color={PRIMARY} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardGrower} numberOfLines={1}>
              {item.group_name}
            </Text>
            <Text style={styles.cardSubtitle} numberOfLines={1}>
              {item.application_title}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
            <Text style={[styles.statusBadgeText, { color: meta.color }]}>
              {meta.label}
            </Text>
          </View>
        </View>

        <View style={styles.cardDivider} />

        <View style={styles.cardDetailRow}>
          <Ionicons name="leaf-outline" size={16} color={MUTED} />
          <Text style={styles.cardDetailText} numberOfLines={1}>
            {speciesSummary}
          </Text>
        </View>
        <View style={styles.cardDetailRow}>
          <Ionicons name="calendar-outline" size={16} color={MUTED} />
          <Text style={styles.cardDetailText}>{formatDate(item.submitted_at)}</Text>
        </View>
        <View style={styles.cardDetailRow}>
          <Ionicons name="location-outline" size={16} color={MUTED} />
          <Text style={styles.cardDetailText} numberOfLines={1}>
            {item.site_name}
          </Text>
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.cardFooterText}>View Details & Confirm</Text>
          <Ionicons name="chevron-forward" size={18} color={PRIMARY} />
        </View>
      </TouchableOpacity>
    );
  };

  // ─── Render: Loading ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={PRIMARY} />
        <Text style={styles.loadingText}>Loading deliveries…</Text>
      </View>
    );
  }

  const tabs: { key: FilterTab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "accepted", label: "Pending" },
    { key: "confirmed", label: "Completed" },
    { key: "cancelled", label: "Canceled" },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.headerTitle}>My Deliveries</Text>
      </View>

      {/* Search */}
      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={MUTED} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search grower or organization..."
          value={search}
          onChangeText={setSearch}
          placeholderTextColor={FAINT}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Ionicons name="close-circle" size={18} color={FAINT} />
          </TouchableOpacity>
        )}
      </View>

      {/* Status Tabs */}
      <View style={styles.tabsRow}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tabBtn, activeTab === tab.key && styles.tabBtnActive]}
            onPress={() => setActiveTab(tab.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabBtnText, activeTab === tab.key && styles.tabBtnTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      <FlatList
        data={filteredDeliveries}
        keyExtractor={(item) => String(item.request_id)}
        renderItem={renderItem}
        contentContainerStyle={{
          padding: 20,
          paddingBottom: insets.bottom + 40,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PRIMARY} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="cube-outline" size={48} color="#D1D5DB" />
            <Text style={styles.emptyStateText}>No deliveries found</Text>
            <Text style={styles.emptyStateSubtext}>
              {search ? "Try a different search term" : "You have no assigned deliveries yet"}
            </Text>
          </View>
        }
      />
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 12, color: MUTED, fontSize: 14 },

  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: BG,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: INK,
    letterSpacing: -0.5,
  },

  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: WHITE,
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 15, color: INK },

  tabsRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: BORDER,
  },
  tabBtnActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  tabBtnText: { fontSize: 12, fontWeight: "700", color: MUTED },
  tabBtnTextActive: { color: "#fff" },

  card: {
    backgroundColor: WHITE,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    ...cardShadow,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.03)",
  },
  cardTopRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ECFDF5",
    justifyContent: "center",
    alignItems: "center",
  },
  cardGrower: { fontSize: 15, fontWeight: "700", color: INK },
  cardSubtitle: { fontSize: 12, color: MUTED, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusBadgeText: { fontSize: 11, fontWeight: "700" },
  cardDivider: { height: 1, backgroundColor: "#F3F4F6", marginVertical: 12 },
  cardDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  cardDetailText: { fontSize: 13, color: MUTED, flex: 1 },

  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  cardFooterText: { fontSize: 13, fontWeight: "700", color: PRIMARY },

  emptyState: { alignItems: "center", paddingVertical: 60 },
  emptyStateText: {
    fontSize: 15,
    fontWeight: "700",
    color: MUTED,
    marginTop: 12,
  },
  emptyStateSubtext: { fontSize: 13, color: FAINT, marginTop: 4 },
});