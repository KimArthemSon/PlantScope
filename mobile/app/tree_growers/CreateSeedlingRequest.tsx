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
  Modal,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/constants/url_fixed";

const PRIMARY = "#0F4A2F";
const INK = "#111827";
const MUTED = "#6B7280";
const FAINT = "#9CA3AF";
const WHITE = "#FFFFFF";
const BG = "#F5F6F8";
const BORDER = "#E5E7EB";
const ERROR = "#DC2626";

const cardShadow = {
  shadowColor: "#0F172A",
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.03,
  shadowRadius: 8,
  elevation: 1,
};

interface TreeSpeciesOption {
  tree_specie_id: number;
  name: string;
  description: string | null;
}

interface AddedSpecies {
  species_id: number;
  species_name: string;
  quantity: number;
  provided_by: string;
}

export default function CreateSeedlingRequest() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [applicationId, setApplicationId] = useState<number | null>(null);
  const [appTitle, setAppTitle] = useState<string>("");
  const [speciesList, setSpeciesList] = useState<TreeSpeciesOption[]>([]);

  const [showSpeciesModal, setShowSpeciesModal] = useState(false);
  const [speciesSearch, setSpeciesSearch] = useState("");
  const [selectedSpecies, setSelectedSpecies] =
    useState<TreeSpeciesOption | null>(null);

  const [quantity, setQuantity] = useState("");
  const [addedSpecies, setAddedSpecies] = useState<AddedSpecies[]>([]);
  const [description, setDescription] = useState("");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // ─── Fetch Initial Data ───────────────────────────────────────────────────
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const token = await SecureStore.getItemAsync("token");
        if (!token) throw new Error("No authentication token found.");

        // 1. Get active application to link the request
        const appRes = await fetch(`${api}/api/get_tree_grower_application/`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!appRes.ok) throw new Error("Failed to load application data.");
        const appData = await appRes.json();

        if (!appData.application) {
          Alert.alert(
            "No Active Application",
            "You must have an accepted application to request seedlings.",
            [{ text: "OK", onPress: () => router.back() }],
          );
          return;
        }
        setApplicationId(appData.application.application_id);
        setAppTitle(appData.application.title);

        // 2. Get tree species list
        const speciesRes = await fetch(`${api}/api/get_tree_species_list/`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (speciesRes.ok) {
          const data = await speciesRes.json();
          console.log("🌳 Raw API Response for Tree Species:", data);

          // ✅ Safely handle different response formats
          let list: TreeSpeciesOption[] = [];
          if (Array.isArray(data)) {
            list = data;
          } else if (data.data && Array.isArray(data.data)) {
            list = data.data;
          } else if (data.species && Array.isArray(data.species)) {
            list = data.species;
          }

          console.log("✅ Parsed species list count:", list.length);
          setSpeciesList(list);
        } else {
          console.error("❌ Failed to fetch tree species:", speciesRes.status);
        }
      } catch (err: any) {
        console.error("❌ Fetch Initial Data Error:", err);
        Alert.alert("Error", err.message || "Failed to load data.");
        router.back();
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, []);

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const filteredSpecies = Array.isArray(speciesList)
    ? speciesList.filter((s) =>
        s.name.toLowerCase().includes(speciesSearch.toLowerCase()),
      )
    : [];

  const handleSelectSpecies = (species: TreeSpeciesOption) => {
    if (addedSpecies.some((s) => s.species_id === species.tree_specie_id)) {
      Alert.alert(
        "Already Added",
        "This species is already in your request list.",
      );
      return;
    }
    setSelectedSpecies(species);
    setShowSpeciesModal(false);
    setSpeciesSearch("");
  };

  const handleAddSpecies = () => {
    if (!selectedSpecies || !quantity) {
      Alert.alert(
        "Missing Info",
        "Please select a species and enter a quantity.",
      );
      return;
    }
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert(
        "Invalid Quantity",
        "Please enter a valid number greater than 0.",
      );
      return;
    }

    setAddedSpecies([
      ...addedSpecies,
      {
        species_id: selectedSpecies.tree_specie_id,
        species_name: selectedSpecies.name,
        quantity: qty,
        provided_by: "ENRO Nursery",
      },
    ]);

    setSelectedSpecies(null);
    setQuantity("");
  };

  const handleRemoveSpecies = (speciesId: number) => {
    setAddedSpecies(addedSpecies.filter((s) => s.species_id !== speciesId));
  };

  const handleSubmit = async () => {
    if (addedSpecies.length === 0) {
      Alert.alert(
        "Missing Species",
        "Please add at least one tree species to your request.",
      );
      return;
    }
    if (!applicationId) return;

    setSubmitting(true);
    try {
      const token = await SecureStore.getItemAsync("token");
      const fd = new FormData();
      fd.append("application_id", String(applicationId));
      fd.append(
        "seedling_species",
        JSON.stringify(
          addedSpecies.map((s) => ({
            tree_species_id: s.species_id,
            quantity: s.quantity,
            provided_by: s.provided_by,
          })),
        ),
      );
      if (description.trim()) {
        fd.append("description", description.trim());
      }

      const res = await fetch(`${api}/api/create_seedling_request/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed.");

      Alert.alert(
        "✓ Request Submitted",
        "Your seedling request is now pending review by the Data Manager.",
        [
          {
            text: "OK",
            onPress: () => router.replace("/tree_growers/seedlingRequests"),
          },
        ],
      );
    } catch (err: any) {
      Alert.alert("Error", err.message || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={PRIMARY} />
        <Text style={styles.loadingText}>Loading form…</Text>
      </View>
    );
  }

  const totalSeedlings = addedSpecies.reduce(
    (sum, item) => sum + item.quantity,
    0,
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.replace("/tree_growers/seedlingRequests")}
        >
          <Ionicons name="chevron-back" size={24} color={INK} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Request</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Application Context Card */}
        <View style={[styles.card, styles.contextCard]}>
          <View style={styles.contextHeader}>
            <Ionicons name="document-text-outline" size={20} color={PRIMARY} />
            <Text style={styles.contextLabel}>Requesting for Application</Text>
          </View>
          <Text style={styles.contextValue} numberOfLines={2}>
            {appTitle}
          </Text>
        </View>

        {/* Species Selection Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>1. Select Tree Species</Text>

          <TouchableOpacity
            style={styles.selectBox}
            onPress={() => setShowSpeciesModal(true)}
            activeOpacity={0.7}
          >
            {selectedSpecies ? (
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
              >
                <View style={styles.selectedIcon}>
                  <Ionicons name="leaf" size={18} color={PRIMARY} />
                </View>
                <View>
                  <Text style={styles.selectedText}>
                    {selectedSpecies.name}
                  </Text>
                  <Text style={styles.selectedSubtext}>Tap to change</Text>
                </View>
              </View>
            ) : (
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
              >
                <Ionicons name="add-circle-outline" size={20} color={FAINT} />
                <Text style={styles.placeholderText}>
                  Tap to choose a species...
                </Text>
              </View>
            )}
            <Ionicons name="chevron-down" size={20} color={MUTED} />
          </TouchableOpacity>

          {/* Quantity Input */}
          <View style={styles.quantityRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>Quantity</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 50"
                keyboardType="numeric"
                value={quantity}
                onChangeText={setQuantity}
                placeholderTextColor={FAINT}
              />
            </View>
            <TouchableOpacity
              style={[
                styles.addBtn,
                { opacity: selectedSpecies && quantity ? 1 : 0.5 },
              ]}
              onPress={handleAddSpecies}
              disabled={!selectedSpecies || !quantity}
            >
              <Ionicons name="add" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Added Species List */}
        {addedSpecies.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>2. Request Summary</Text>
              <View style={styles.totalBadge}>
                <Text style={styles.totalBadgeText}>
                  {totalSeedlings} Total
                </Text>
              </View>
            </View>

            {addedSpecies.map((item, index) => (
              <View key={index} style={styles.listItem}>
                <View style={styles.listItemIcon}>
                  <Ionicons name="leaf" size={18} color={PRIMARY} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.listItemName}>{item.species_name}</Text>
                  <Text style={styles.listItemProvider}>
                    Provided by: {item.provided_by}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <Text style={styles.listItemQty}>
                    x{item.quantity.toLocaleString()}
                  </Text>
                  <TouchableOpacity
                    onPress={() => handleRemoveSpecies(item.species_id)}
                    style={styles.removeBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="trash-outline" size={16} color={ERROR} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Description Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>3. Additional Notes (Optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Any specific requirements or reasons for this request..."
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            placeholderTextColor={FAINT}
            textAlignVertical="top"
          />
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
          onPress={handleSubmit}
          disabled={submitting || addedSpecies.length === 0}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="paper-plane-outline" size={20} color="#fff" />
              <Text style={styles.submitBtnText}>Submit Request</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Species Selection Modal - FIXED HEIGHT so it always fills 90% of screen */}
      <Modal
        visible={showSpeciesModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSpeciesModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalPanel}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Tree Species</Text>
              <TouchableOpacity onPress={() => setShowSpeciesModal(false)}>
                <Ionicons name="close-circle" size={28} color={MUTED} />
              </TouchableOpacity>
            </View>

            <View style={styles.searchBox}>
              <Ionicons name="search" size={18} color={MUTED} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search species..."
                value={speciesSearch}
                onChangeText={setSpeciesSearch}
                placeholderTextColor={FAINT}
                autoFocus
              />
              {speciesSearch.length > 0 && (
                <TouchableOpacity onPress={() => setSpeciesSearch("")}>
                  <Ionicons name="close-circle" size={18} color={FAINT} />
                </TouchableOpacity>
              )}
            </View>

            {/* List area now genuinely fills the remaining space of the fixed-height panel */}
            <View style={styles.modalListArea}>
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 20 }}
              >
                {filteredSpecies.length > 0 ? (
                  filteredSpecies.map((sp) => (
                    <TouchableOpacity
                      key={sp.tree_specie_id}
                      style={styles.modalItem}
                      onPress={() => handleSelectSpecies(sp)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.modalItemIcon}>
                        <Ionicons
                          name="leaf-outline"
                          size={18}
                          color={PRIMARY}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.modalItemName}>{sp.name}</Text>
                        {sp.description && (
                          <Text style={styles.modalItemDesc} numberOfLines={2}>
                            {sp.description}
                          </Text>
                        )}
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={18}
                        color={FAINT}
                      />
                    </TouchableOpacity>
                  ))
                ) : (
                  <View style={styles.modalEmpty}>
                    <Ionicons name="leaf-outline" size={40} color="#D1D5DB" />
                    <Text style={styles.modalEmptyText}>
                      {speciesSearch
                        ? "No species found matching your search"
                        : "No species available"}
                    </Text>
                    <Text style={styles.modalEmptySubtext}>
                      {speciesSearch
                        ? "Try a different search term"
                        : `(Total loaded from API: ${speciesList.length})`}
                    </Text>
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
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
  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: INK,
    letterSpacing: -0.5,
  },

  card: {
    backgroundColor: WHITE,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginTop: 16,
    ...cardShadow,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.03)",
  },
  contextCard: { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" },
  contextHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  contextLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: PRIMARY,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  contextValue: { fontSize: 16, fontWeight: "700", color: INK },

  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  totalBadge: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  totalBadgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },

  selectBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F9FAFB",
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  selectedIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#ECFDF5",
    justifyContent: "center",
    alignItems: "center",
  },
  selectedText: { fontSize: 15, fontWeight: "600", color: INK },
  selectedSubtext: { fontSize: 12, color: MUTED },
  placeholderText: { fontSize: 15, color: FAINT },

  quantityRow: { flexDirection: "row", gap: 12, alignItems: "flex-end" },
  inputLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: MUTED,
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: INK,
  },
  textArea: { height: 100 },
  addBtn: {
    backgroundColor: PRIMARY,
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 0,
  },

  listItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  listItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#ECFDF5",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  listItemName: { fontSize: 15, fontWeight: "600", color: INK },
  listItemProvider: { fontSize: 12, color: MUTED, marginTop: 2 },
  listItemQty: { fontSize: 16, fontWeight: "800", color: PRIMARY },
  removeBtn: { padding: 4 },

  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PRIMARY,
    marginHorizontal: 20,
    marginTop: 24,
    paddingVertical: 16,
    borderRadius: 14,
    gap: 10,
    shadowColor: PRIMARY,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  submitBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },

  // Modal Styles - FIXED: panel now has a real `height`, not just `maxHeight`,
  // so it always occupies 90% of the screen regardless of list content length.
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalPanel: {
    backgroundColor: WHITE,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 32,
    height: "90%",
    maxHeight: "90%",
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
  modalTitle: { fontSize: 18, fontWeight: "800", color: INK },

  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F9FAFB",
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  searchInput: { flex: 1, fontSize: 15, color: INK },

  // FIXED: replaces the old `{ flex: 1, minHeight: 200, paddingBottom: 40 }` inline style.
  // Now that modalPanel has a real height, flex: 1 here correctly expands to fill
  // all remaining vertical space in the sheet.
  modalListArea: {
    flex: 1,
  },

  modalItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  modalItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F0FDF4",
    justifyContent: "center",
    alignItems: "center",
  },
  modalItemName: { fontSize: 15, fontWeight: "600", color: INK },
  modalItemDesc: { fontSize: 12, color: MUTED, marginTop: 2, lineHeight: 16 },

  modalEmpty: { paddingVertical: 40, alignItems: "center" },
  modalEmptyText: { fontSize: 14, color: MUTED, fontWeight: "600" },
  modalEmptySubtext: {
    fontSize: 12,
    color: FAINT,
    marginTop: 8,
    textAlign: "center",
    paddingHorizontal: 20,
  },
});
