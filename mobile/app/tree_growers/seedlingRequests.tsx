import React, { useState, useEffect } from "react";
import { useRouter } from "expo-router";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl, // Added RefreshControl
  Dimensions, // Added Dimensions
} from "react-native";
import * as SecureStore from "expo-secure-store";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/constants/url_fixed";

// Extract screenHeight
const { height: screenHeight } = Dimensions.get("window");

const PRIMARY = "#0F4A2F";
const INK = "#111827";
const MUTED = "#6B7280";
const WHITE = "#FFFFFF";
const BG = "#F4F7F5";

interface SeedlingSpeciesItem {
  species_id: number;
  species_name: string;
  quantity: number;
  provided_by: string;
}

interface SeedlingRequest {
  request_id: number;
  no_request_seedling: number;
  species: SeedlingSpeciesItem[];
  status: "pending" | "accepted" | "rejected";
  reason_accepted: string | null;
  submitted_at: string | null;
}

interface TreeSpeciesOption {
  tree_specie_id: number;
  name: string;
  description: string;
}

interface ApplicationData {
  application_id: number;
}

const statusConfig = {
  pending: { label: "Pending", bg: "#FFF8E1", text: "#F57F17", dot: "#F9A825" },
  accepted: {
    label: "Accepted",
    bg: "#E8F5E9",
    text: "#2E7D32",
    dot: "#388E3C",
  },
  rejected: {
    label: "Rejected",
    bg: "#FFEBEE",
    text: "#C62828",
    dot: "#D32F2F",
  },
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

export default function SeedlingRequestsPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [requests, setRequests] = useState<SeedlingRequest[]>([]);
  const [application, setApplication] = useState<ApplicationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [allTreeSpecies, setAllTreeSpecies] = useState<TreeSpeciesOption[]>([]);
  const [selectedSpeciesId, setSelectedSpeciesId] = useState<string>("");
  const [selectedQuantity, setSelectedQuantity] = useState<string>("");
  const [activeSeedlingList, setActiveSeedlingList] = useState<
    SeedlingSpeciesItem[]
  >([]);
  const [requestDescription, setRequestDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      const token = await SecureStore.getItemAsync("token");
      if (!token) return;

      const res = await fetch(`${api}/api/get_tree_grower_application/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setRequests(data.seedling_requests || []);
      setApplication(data.application);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchTreeSpecies = async () => {
    try {
      const token = await SecureStore.getItemAsync("token");
      const res = await fetch(`${api}/api/get_tree_species_list/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAllTreeSpecies(data);
      }
    } catch (err) {
      console.error("Failed to fetch species:", err);
    }
  };

  useEffect(() => {
    fetchData();
    fetchTreeSpecies();
  }, []);

  const handleAddSpecies = () => {
    if (!selectedSpeciesId || !selectedQuantity) {
      Alert.alert(
        "Missing Info",
        "Please select a species and enter a quantity.",
      );
      return;
    }
    const found = allTreeSpecies.find(
      (s) => s.tree_specie_id === Number(selectedSpeciesId),
    );
    if (!found) return;
    if (activeSeedlingList.find((s) => s.species_id === found.tree_specie_id)) {
      Alert.alert(
        "Already Added",
        "This species is already in your request list.",
      );
      return;
    }
    setActiveSeedlingList([
      ...activeSeedlingList,
      {
        species_id: found.tree_specie_id,
        species_name: found.name,
        quantity: parseInt(selectedQuantity),
        provided_by: "TBD",
      },
    ]);
    setSelectedSpeciesId("");
    setSelectedQuantity("");
  };

  const handleRemoveSpecies = (speciesId: number) => {
    setActiveSeedlingList(
      activeSeedlingList.filter((s) => s.species_id !== speciesId),
    );
  };

  const handleSubmit = async () => {
    if (!application) return;
    if (activeSeedlingList.length === 0) {
      Alert.alert("Missing Species", "Please add at least one tree species.");
      return;
    }
    setSubmitting(true);
    try {
      const token = await SecureStore.getItemAsync("token");
      const fd = new FormData();
      fd.append("application_id", String(application.application_id));
      fd.append(
        "seedling_species",
        JSON.stringify(
          activeSeedlingList.map((s) => ({
            tree_species_id: s.species_id,
            quantity: s.quantity,
            provided_by: s.provided_by,
          })),
        ),
      );
      fd.append("description", requestDescription);

      const res = await fetch(`${api}/api/create_seedling_request/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed.");

      Alert.alert(
        "✓ Request Submitted",
        "Your seedling request is pending review.",
      );
      setShowForm(false);
      resetForm();
      fetchData(true);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setActiveSeedlingList([]);
    setSelectedSpeciesId("");
    setSelectedQuantity("");
    setRequestDescription("");
  };

  const acceptedRequests = requests.filter((r) => r.status === "accepted");
  const pendingRequests = requests.filter((r) => r.status === "pending");
  const rejectedRequests = requests.filter((r) => r.status === "rejected");

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
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
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
          <View style={[styles.summaryCard, { backgroundColor: "#E8F5E9" }]}>
            <Text style={[styles.summaryValue, { color: "#2E7D32" }]}>
              {acceptedRequests
                .reduce((sum, r) => sum + getTotalSeedlings(r.species), 0)
                .toLocaleString()}
            </Text>
            <Text style={styles.summaryLabel}>Approved</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: "#FFF8E1" }]}>
            <Text style={[styles.summaryValue, { color: "#F57F17" }]}>
              {pendingRequests.length}
            </Text>
            <Text style={styles.summaryLabel}>Pending</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: "#FFEBEE" }]}>
            <Text style={[styles.summaryValue, { color: "#C62828" }]}>
              {rejectedRequests.length}
            </Text>
            <Text style={styles.summaryLabel}>Rejected</Text>
          </View>
        </View>

        {/* New Request Button */}
        <TouchableOpacity
          style={styles.newRequestBtn}
          onPress={() => setShowForm(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="add-circle" size={20} color="#fff" />
          <Text style={styles.newRequestText}>New Seedling Request</Text>
        </TouchableOpacity>

        {/* Accepted Requests */}
        {acceptedRequests.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Approved Requests</Text>
            {acceptedRequests.map((req) => (
              <View key={req.request_id} style={styles.requestCard}>
                <View style={styles.requestHeader}>
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: statusConfig.accepted.dot },
                    ]}
                  />
                  <Text
                    style={[
                      styles.statusText,
                      { color: statusConfig.accepted.text },
                    ]}
                  >
                    Accepted
                  </Text>
                  <Text style={styles.requestDate}>
                    {formatDate(req.submitted_at || "")}
                  </Text>
                </View>
                <Text style={styles.requestTotal}>
                  {getTotalSeedlings(req.species).toLocaleString()} seedlings
                </Text>
                {req.species.map((sp, i) => (
                  <View key={i} style={styles.speciesRow}>
                    <Ionicons name="leaf-outline" size={14} color={PRIMARY} />
                    <Text style={styles.speciesName}>{sp.species_name}</Text>
                    <Text style={styles.speciesQty}>
                      {sp.quantity.toLocaleString()}
                    </Text>
                  </View>
                ))}
                {req.reason_accepted && (
                  <View style={styles.reasonBox}>
                    <Ionicons
                      name="chatbubble-outline"
                      size={12}
                      color="#2E7D32"
                    />
                    <Text style={styles.reasonText}>{req.reason_accepted}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Pending Requests */}
        {pendingRequests.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pending Requests</Text>
            {pendingRequests.map((req) => (
              <View
                key={req.request_id}
                style={[
                  styles.requestCard,
                  { borderLeftColor: "#F9A825", borderLeftWidth: 3 },
                ]}
              >
                <View style={styles.requestHeader}>
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: statusConfig.pending.dot },
                    ]}
                  />
                  <Text
                    style={[
                      styles.statusText,
                      { color: statusConfig.pending.text },
                    ]}
                  >
                    Pending Review
                  </Text>
                  <Text style={styles.requestDate}>
                    {formatDate(req.submitted_at || "")}
                  </Text>
                </View>
                <Text style={styles.requestTotal}>
                  {getTotalSeedlings(req.species).toLocaleString()} seedlings
                </Text>
                {req.species.map((sp, i) => (
                  <View key={i} style={styles.speciesRow}>
                    <Ionicons name="leaf-outline" size={14} color={PRIMARY} />
                    <Text style={styles.speciesName}>{sp.species_name}</Text>
                    <Text style={styles.speciesQty}>
                      {sp.quantity.toLocaleString()}
                    </Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}

        {/* Rejected Requests */}
        {rejectedRequests.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Rejected Requests</Text>
            {rejectedRequests.map((req) => (
              <View
                key={req.request_id}
                style={[
                  styles.requestCard,
                  { borderLeftColor: "#D32F2F", borderLeftWidth: 3 },
                ]}
              >
                <View style={styles.requestHeader}>
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: statusConfig.rejected.dot },
                    ]}
                  />
                  <Text
                    style={[
                      styles.statusText,
                      { color: statusConfig.rejected.text },
                    ]}
                  >
                    Rejected
                  </Text>
                  <Text style={styles.requestDate}>
                    {formatDate(req.submitted_at || "")}
                  </Text>
                </View>
                <Text style={styles.requestTotal}>
                  {getTotalSeedlings(req.species).toLocaleString()} seedlings
                </Text>
              </View>
            ))}
          </View>
        )}

        {requests.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="leaf-outline" size={48} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>No Requests Yet</Text>
            <Text style={styles.emptyMsg}>
              Tap "New Seedling Request" to get started.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* New Request Form Modal */}
      {showForm && (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalPanel}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Seedling Request</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowForm(false);
                  resetForm();
                }}
              >
                <Ionicons name="close-circle" size={24} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Species Selector */}
              <Text style={styles.formLabel}>Select Species</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 12 }}
              >
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {allTreeSpecies.map((sp) => (
                    <TouchableOpacity
                      key={sp.tree_specie_id}
                      onPress={() =>
                        setSelectedSpeciesId(String(sp.tree_specie_id))
                      }
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        borderRadius: 20,
                        backgroundColor:
                          selectedSpeciesId === String(sp.tree_specie_id)
                            ? PRIMARY
                            : "#fff",
                        borderWidth: 1,
                        borderColor:
                          selectedSpeciesId === String(sp.tree_specie_id)
                            ? PRIMARY
                            : "#E5E7EB",
                      }}
                    >
                      <Text
                        style={{
                          color:
                            selectedSpeciesId === String(sp.tree_specie_id)
                              ? "#fff"
                              : INK,
                          fontWeight: "600",
                          fontSize: 13,
                        }}
                      >
                        {sp.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              {/* Quantity */}
              <Text style={styles.formLabel}>Quantity</Text>
              <View style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
                <TextInput
                  style={[styles.formInput, { flex: 1, marginBottom: 0 }]}
                  placeholder="e.g. 50"
                  keyboardType="numeric"
                  value={selectedQuantity}
                  onChangeText={setSelectedQuantity}
                  placeholderTextColor="#B0BAC4"
                />
                <TouchableOpacity
                  style={[
                    styles.addBtn,
                    {
                      opacity:
                        !selectedSpeciesId || !selectedQuantity ? 0.5 : 1,
                    },
                  ]}
                  onPress={handleAddSpecies}
                  disabled={!selectedSpeciesId || !selectedQuantity}
                >
                  <Ionicons name="add" size={18} color="#fff" />
                </TouchableOpacity>
              </View>

              {/* Active List */}
              {activeSeedlingList.length > 0 && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={styles.formLabel}>
                    Request List ({activeSeedlingList.length})
                  </Text>
                  {activeSeedlingList.map((item) => (
                    <View key={item.species_id} style={styles.listItem}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <View style={styles.listItemIcon}>
                          <Ionicons name="leaf" size={16} color="#2E7D32" />
                        </View>
                        <View>
                          <Text
                            style={{
                              fontSize: 14,
                              fontWeight: "700",
                              color: INK,
                            }}
                          >
                            {item.species_name}
                          </Text>
                          <Text
                            style={{
                              fontSize: 12,
                              color: PRIMARY,
                              fontWeight: "600",
                            }}
                          >
                            {item.quantity} seedlings
                          </Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleRemoveSpecies(item.species_id)}
                        style={{ padding: 4 }}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={18}
                          color="#EF4444"
                        />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {/* Description */}
              <Text style={styles.formLabel}>Description (Optional)</Text>
              <TextInput
                style={[
                  styles.formInput,
                  { height: 80, textAlignVertical: "top" },
                ]}
                placeholder="Reason for request…"
                value={requestDescription}
                onChangeText={setRequestDescription}
                multiline
                placeholderTextColor="#B0BAC4"
              />

              {/* Actions */}
              <View style={styles.formActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
                  onPress={handleSubmit}
                  disabled={submitting || activeSeedlingList.length === 0}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.submitBtnText}>Submit Request</Text>
                  )}
                </TouchableOpacity>
              </View>
              <View style={{ height: 30 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 12, color: MUTED, fontSize: 14 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: WHITE,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "800", color: INK },

  summaryRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    marginTop: 16,
  },
  summaryCard: { flex: 1, borderRadius: 16, padding: 14, alignItems: "center" },
  summaryValue: { fontSize: 20, fontWeight: "800", marginBottom: 2 },
  summaryLabel: { fontSize: 11, color: MUTED, fontWeight: "600" },

  newRequestBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PRIMARY,
    marginHorizontal: 16,
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    shadowColor: PRIMARY,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  newRequestText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  section: { marginTop: 24, paddingHorizontal: 16 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: INK,
    marginBottom: 12,
  },

  requestCard: {
    backgroundColor: WHITE,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  requestHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: "700", flex: 1 },
  requestDate: { fontSize: 11, color: MUTED },
  requestTotal: {
    fontSize: 18,
    fontWeight: "800",
    color: INK,
    marginBottom: 8,
  },
  speciesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  speciesName: { flex: 1, fontSize: 14, color: INK, fontWeight: "500" },
  speciesQty: { fontSize: 14, fontWeight: "700", color: PRIMARY },
  reasonBox: {
    flexDirection: "row",
    gap: 6,
    alignItems: "flex-start",
    backgroundColor: "#E8F5E9",
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  reasonText: {
    fontSize: 12,
    color: "#2E7D32",
    flex: 1,
    lineHeight: 16,
    fontStyle: "italic",
  },

  emptyState: { alignItems: "center", marginTop: 60, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: INK },
  emptyMsg: { fontSize: 13, color: MUTED, textAlign: "center" },

  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  modalPanel: {
    backgroundColor: WHITE,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingBottom: 32,
    maxHeight: screenHeight * 0.9,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#E5E7EB",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: "800", color: INK, flex: 1 },

  formLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  formInput: {
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: INK,
    backgroundColor: "#FAFAFA",
    marginBottom: 12,
  },
  addBtn: {
    backgroundColor: PRIMARY,
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  listItemIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#E8F5E9",
    justifyContent: "center",
    alignItems: "center",
  },

  formActions: { flexDirection: "row", gap: 12, marginTop: 10 },
  cancelBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  cancelBtnText: { color: MUTED, fontWeight: "600", fontSize: 14 },
  submitBtn: {
    flex: 2,
    backgroundColor: PRIMARY,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },
});