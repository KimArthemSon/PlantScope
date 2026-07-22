import React, { useState, useEffect } from "react";
import { useRouter } from "expo-router";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/constants/url_fixed";

const PRIMARY = "#0F4A2F";
const INK = "#111827";
const MUTED = "#6B7280";
const WHITE = "#FFFFFF";
const BG = "#F5F6F8";

const cardShadow = {
  shadowColor: "#0F172A",
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.03,
  shadowRadius: 8,
  elevation: 1,
};

// ─── Types ──────────────────────────────────────────────────────────────────

interface SeedlingSpeciesItem {
  species_id: number;
  species_name: string;
  quantity: number;
  provided_by: string;
}

interface SeedlingRequest {
  request_id: number;
  application_id: number;
  application_title: string;
  status: "pending" | "accepted" | "rejected" | "confirmed" | "cancelled";
  fulfillment_type: "pickup" | "deliver" | null;
  no_request_seedling: number;
  submitted_at: string | null;
  species: SeedlingSpeciesItem[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const statusConfig = {
  pending: { label: "Pending Review", bg: "#FFF8E1", text: "#F59E0B", dot: "#F59E0B" },
  accepted: { label: "Approved", bg: "#F0FDF4", text: "#16A34A", dot: "#16A34A" },
  confirmed: { label: "Confirmed", bg: "#EFF6FF", text: "#2563EB", dot: "#2563EB" },
  rejected: { label: "Rejected", bg: "#FEF2F2", text: "#DC2626", dot: "#DC2626" },
  cancelled: { label: "Cancelled", bg: "#F3F4F6", text: "#4B5563", dot: "#9CA3AF" },
};

const formatDate = (iso: string) =>
  !iso
    ? "—"
    : new Date(iso).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });

const getTotalSeedlings = (species: SeedlingSpeciesItem[]) =>
  species.reduce((sum, item) => sum + (item.quantity || 0), 0);

// ─── Main Component ─────────────────────────────────────────────────────────

export default function SeedlingRequestsPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [requests, setRequests] = useState<SeedlingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      const token = await SecureStore.getItemAsync("token");
      if (!token) return;

      const res = await fetch(`${api}/api/requests/my-requests/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load requests");
      const data = await res.json();
      setRequests(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const acceptedRequests = requests.filter((r) => r.status === "accepted" || r.status === "confirmed");
  const pendingRequests = requests.filter((r) => r.status === "pending");
  const rejectedRequests = requests.filter((r) => r.status === "rejected" || r.status === "cancelled");

  const totalApprovedSeedlings = acceptedRequests.reduce(
    (sum, r) => sum + getTotalSeedlings(r.species),
    0
  );

  // ✅ Object-based routing pattern matching Sites.tsx
  const handleViewDetails = (requestId: number) => {
    router.push({
      pathname: "/tree_growers/SeedlingRequestDetail",
      params: {
        id: requestId.toString(),
      },
    });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={PRIMARY} />
        <Text style={styles.loadingText}>Loading requests…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.replace("/tree_growers/application")}>
          <Ionicons name="chevron-back" size={24} color={INK} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Seedling Requests</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchData(true);
            }}
            tintColor={PRIMARY}
          />
        }
      >
        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: "#F0FDF4" }]}>
            <Text style={[styles.summaryValue, { color: "#16A34A" }]}>
              {totalApprovedSeedlings.toLocaleString()}
            </Text>
            <Text style={styles.summaryLabel}>Approved</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: "#FFF8E1" }]}>
            <Text style={[styles.summaryValue, { color: "#F59E0B" }]}>
              {pendingRequests.length}
            </Text>
            <Text style={styles.summaryLabel}>Pending</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: "#FEF2F2" }]}>
            <Text style={[styles.summaryValue, { color: "#DC2626" }]}>
              {rejectedRequests.length}
            </Text>
            <Text style={styles.summaryLabel}>Rejected</Text>
          </View>
        </View>

        {/* New Request Button */}
        <TouchableOpacity
          style={styles.newRequestBtn}
          onPress={() => router.push("/tree_growers/CreateSeedlingRequest")}
          activeOpacity={0.8}
        >
          <Ionicons name="add-circle" size={20} color="#fff" />
          <Text style={styles.newRequestText}>New Seedling Request</Text>
        </TouchableOpacity>

        {/* Requests List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Requests</Text>
          
          {requests.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="leaf-outline" size={48} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>No Requests Yet</Text>
              <Text style={styles.emptySubtitle}>
                Tap "New Seedling Request" to get started.
              </Text>
            </View>
          ) : (
            requests.map((req) => {
              const conf = statusConfig[req.status] || statusConfig.pending;
              return (
                <View key={req.request_id} style={styles.card}>
                  {/* Card Header: Status & Date */}
                  <View style={styles.cardHeader}>
                    <View style={[styles.statusBadge, { backgroundColor: conf.bg }]}>
                      <View style={[styles.statusDot, { backgroundColor: conf.dot }]} />
                      <Text style={[styles.statusText, { color: conf.text }]}>
                        {conf.label}
                      </Text>
                    </View>
                    <Text style={styles.requestDate}>{formatDate(req.submitted_at || "")}</Text>
                  </View>
                  
                  {/* Application Title */}
                  <Text style={styles.appTitle} numberOfLines={1}>
                    {req.application_title}
                  </Text>
                  
                  {/* Seedling Summary */}
                  <View style={styles.speciesSummary}>
                    <Ionicons name="leaf-outline" size={16} color={PRIMARY} />
                    <Text style={styles.speciesSummaryText}>
                      {getTotalSeedlings(req.species).toLocaleString()} seedlings requested
                    </Text>
                  </View>

                  {/* Sneak peek of fulfillment method if approved */}
                  {req.status === "accepted" && req.fulfillment_type && (
                    <View style={styles.fulfillmentBadge}>
                      <Ionicons 
                        name={req.fulfillment_type === "deliver" ? "car-outline" : "home-outline"} 
                        size={14} 
                        color={PRIMARY} 
                      />
                      <Text style={styles.fulfillmentText}>
                        {req.fulfillment_type === "deliver" ? "Deliver to Site" : "Grower Pickup"}
                      </Text>
                    </View>
                  )}

                  {/* ✅ Dedicated View Details Button (Matching Sites.tsx pattern) */}
                  <TouchableOpacity
                    style={styles.viewButton}
                    onPress={() => handleViewDetails(req.request_id)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.viewButtonText}>View Details</Text>
                    <Ionicons name="arrow-forward" size={16} color={PRIMARY} />
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 12, color: MUTED, fontSize: 14 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: BG,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { fontSize: 24, fontWeight: "800", color: INK, letterSpacing: -0.5 },

  summaryRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    marginTop: 8,
  },
  summaryCard: { flex: 1, borderRadius: 16, padding: 14, alignItems: "center", borderWidth: 1, borderColor: "rgba(0,0,0,0.03)" },
  summaryValue: { fontSize: 20, fontWeight: "800", marginBottom: 2 },
  summaryLabel: { fontSize: 11, color: MUTED, fontWeight: "600" },

  newRequestBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PRIMARY,
    marginHorizontal: 20,
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    shadowColor: PRIMARY,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  newRequestText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  section: { marginTop: 24, paddingHorizontal: 20 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: INK,
    marginBottom: 12,
  },

  card: {
    backgroundColor: WHITE,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    ...cardShadow,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.03)",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 5,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  requestDate: { fontSize: 12, color: MUTED, fontWeight: "500" },
  
  appTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: INK,
    marginBottom: 8,
  },
  
  speciesSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  speciesSummaryText: {
    fontSize: 13,
    color: MUTED,
    fontWeight: "500",
  },

  fulfillmentBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F0FDF4",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: "flex-start",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  fulfillmentText: {
    fontSize: 12,
    fontWeight: "600",
    color: PRIMARY,
  },

  // ✅ Matching Sites.tsx View Button Style
  viewButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginTop: 4,
  },
  viewButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: PRIMARY,
  },

  emptyState: { alignItems: "center", marginTop: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: "#374151" },
  emptySubtitle: { fontSize: 13, color: MUTED, textAlign: "center", paddingHorizontal: 32 },
});