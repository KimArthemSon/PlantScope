import React, { useState, useEffect, useRef } from "react";
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
  Animated,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/constants/url_fixed";

const { width: SCREEN_W } = Dimensions.get("window");

/* ─── Design Tokens ────────────────────────────────────────────────────── */
const PRIMARY = "#0F4A2F";
const PRIMARY_50 = "#E8F5E9";
const PRIMARY_100 = "#C8E6C9";
const PRIMARY_200 = "#A5D6A7";
const PRIMARY_600 = "#2E7D32";
const INK = "#111827";
const INK_LIGHT = "#374151";
const MUTED = "#6B7280";
const FAINT = "#9CA3AF";
const WHITE = "#FFFFFF";
const BG = "#F0F4F1";
const CARD_BG = "#FFFFFF";
const BORDER = "#E8EDE9";
const ERROR = "#DC2626";
const ERROR_50 = "#FEF2F2";
const ORANGE = "#F59E0B";
const ORANGE_50 = "#FFFBEB";

/* ─── Types ────────────────────────────────────────────────────────────── */
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

/* ─── Component ─────────────────────────────────────────────────────────── */
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

  /* Animation refs */
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const listAnim = useRef(new Animated.Value(0)).current;

  /* ─── Fetch Initial Data ─────────────────────────────────────────────── */
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const token = await SecureStore.getItemAsync("token");
        if (!token) throw new Error("No authentication token found.");

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

        const speciesRes = await fetch(`${api}/api/get_tree_species_list/`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (speciesRes.ok) {
          const data = await speciesRes.json();
          let list: TreeSpeciesOption[] = [];
          if (Array.isArray(data)) {
            list = data;
          } else if (data.data && Array.isArray(data.data)) {
            list = data.data;
          } else if (data.species && Array.isArray(data.species)) {
            list = data.species;
          }
          setSpeciesList(list);
        }
      } catch (err: any) {
        Alert.alert("Error", err.message || "Failed to load data.");
        router.back();
      } finally {
        setLoading(false);
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ]).start();
      }
    };

    fetchInitialData();
  }, []);

  useEffect(() => {
    Animated.spring(listAnim, {
      toValue: 1,
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    }).start();
  }, [addedSpecies.length]);

  /* ─── Handlers ───────────────────────────────────────────────────────── */
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

  const adjustQty = (delta: number) => {
    const current = parseInt(quantity || "0", 10);
    const next = Math.max(1, current + delta);
    setQuantity(String(next));
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
        "Request Submitted",
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

  /* ─── Render ───────────────────────────────────────────────────────────── */
  if (loading) {
    return (
      <View style={styles.center}>
        <View style={styles.loaderRing}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
        <Text style={styles.loadingText}>Preparing your request…</Text>
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
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.replace("/tree_growers/seedlingRequests")}
          activeOpacity={0.7}
        >
          <View style={styles.backBtnCircle}>
            <Ionicons name="chevron-back" size={22} color={INK} />
          </View>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Request</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }}
        >
          {/* Application Context Card */}
          <View style={styles.contextCard}>
            <View style={styles.contextAccent} />
            <View style={styles.contextInner}>
              <View style={styles.contextIconWrap}>
                <Ionicons name="document-text" size={18} color={PRIMARY} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.contextLabel}>
                  Requesting for Application
                </Text>
                <Text style={styles.contextValue} numberOfLines={2}>
                  {appTitle}
                </Text>
              </View>
            </View>
          </View>

          {/* ─── Step 1: Select Species ─── */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>1</Text>
              </View>
              <Text style={styles.cardTitle}>Select Tree Species</Text>
            </View>

            <TouchableOpacity
              style={[
                styles.selectBox,
                selectedSpecies && styles.selectBoxActive,
              ]}
              onPress={() => setShowSpeciesModal(true)}
              activeOpacity={0.75}
            >
              {selectedSpecies ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <View style={styles.speciesIcon}>
                    <Ionicons name="leaf" size={20} color={PRIMARY} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.selectedText}>
                      {selectedSpecies.name}
                    </Text>
                    <Text style={styles.selectedSubtext}>
                      Tap to change selection
                    </Text>
                  </View>
                </View>
              ) : (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <View style={styles.speciesIconEmpty}>
                    <Ionicons name="add" size={20} color={FAINT} />
                  </View>
                  <Text style={styles.placeholderText}>
                    Choose a tree species…
                  </Text>
                </View>
              )}
              <Ionicons
                name="chevron-forward"
                size={18}
                color={selectedSpecies ? PRIMARY : FAINT}
              />
            </TouchableOpacity>

            {/* Quantity with Stepper */}
            <View style={styles.quantitySection}>
              <Text style={styles.inputLabel}>Quantity</Text>
              <View style={styles.quantityRow}>
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => adjustQty(-1)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="remove" size={18} color={MUTED} />
                </TouchableOpacity>

                <TextInput
                  style={styles.quantityInput}
                  placeholder="0"
                  keyboardType="numeric"
                  value={quantity}
                  onChangeText={(text) => {
                    const cleaned = text.replace(/[^0-9]/g, "");
                    setQuantity(cleaned);
                  }}
                  placeholderTextColor={FAINT}
                  textAlign="center"
                />

                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => adjustQty(1)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={18} color={MUTED} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.addBtn,
                    (!selectedSpecies ||
                      !quantity ||
                      parseInt(quantity) <= 0) &&
                      styles.addBtnDisabled,
                  ]}
                  onPress={handleAddSpecies}
                  disabled={
                    !selectedSpecies || !quantity || parseInt(quantity) <= 0
                  }
                  activeOpacity={0.8}
                >
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* ─── Step 2: Request Summary ─── */}
          {addedSpecies.length > 0 && (
            <Animated.View
              style={[styles.card, { transform: [{ scale: listAnim }] }]}
            >
              <View style={styles.cardHeader}>
                <View
                  style={[styles.stepBadge, { backgroundColor: PRIMARY_100 }]}
                >
                  <Text style={[styles.stepBadgeText, { color: PRIMARY }]}>
                    2
                  </Text>
                </View>
                <Text style={styles.cardTitle}>Request Summary</Text>
                <View style={styles.totalBadge}>
                  <Ionicons name="leaf" size={10} color="#fff" />
                  <Text style={styles.totalBadgeText}>
                    {totalSeedlings.toLocaleString()}
                  </Text>
                </View>
              </View>

              {addedSpecies.map((item, index) => (
                <View
                  key={item.species_id}
                  style={[
                    styles.listItem,
                    index === addedSpecies.length - 1 && {
                      borderBottomWidth: 0,
                    },
                  ]}
                >
                  <View style={styles.listItemLeft}>
                    <View style={styles.listItemNumber}>
                      <Text style={styles.listItemNumberText}>{index + 1}</Text>
                    </View>
                    <View>
                      <Text style={styles.listItemName}>
                        {item.species_name}
                      </Text>
                      <Text style={styles.listItemProvider}>
                        Provided by {item.provided_by}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.listItemRight}>
                    <View style={styles.qtyPill}>
                      <Text style={styles.qtyPillText}>
                        ×{item.quantity.toLocaleString()}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleRemoveSpecies(item.species_id)}
                      style={styles.removeBtn}
                      activeOpacity={0.6}
                    >
                      <View style={styles.removeBtnInner}>
                        <Ionicons
                          name="trash-outline"
                          size={14}
                          color={ERROR}
                        />
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </Animated.View>
          )}

          {/* ─── Step 3: Additional Notes ─── */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.stepBadge, { backgroundColor: ORANGE_50 }]}>
                <Text style={[styles.stepBadgeText, { color: ORANGE }]}>3</Text>
              </View>
              <Text style={styles.cardTitle}>Additional Notes</Text>
              <Text style={styles.optionalTag}>Optional</Text>
            </View>

            <View style={styles.textAreaWrap}>
              <TextInput
                style={styles.textArea}
                placeholder="Any specific requirements or reasons for this request…"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
                placeholderTextColor={FAINT}
                textAlignVertical="top"
              />
              <View style={styles.textAreaIcon}>
                <Ionicons name="create-outline" size={16} color={FAINT} />
              </View>
            </View>
          </View>

          {/* Empty state hint when no species added */}
          {addedSpecies.length === 0 && (
            <View style={styles.emptyHint}>
              <Ionicons
                name="information-circle-outline"
                size={16}
                color={FAINT}
              />
              <Text style={styles.emptyHintText}>
                Add at least one species to enable submission
              </Text>
            </View>
          )}

          {/* Submit Button */}
          <TouchableOpacity
            style={[
              styles.submitBtn,
              (submitting || addedSpecies.length === 0) &&
                styles.submitBtnDisabled,
            ]}
            onPress={handleSubmit}
            disabled={submitting || addedSpecies.length === 0}
            activeOpacity={0.85}
          >
            <View style={styles.submitBtnInner}>
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="paper-plane" size={18} color="#fff" />
                  <Text style={styles.submitBtnText}>Submit Request</Text>
                  <View style={styles.submitCountBadge}>
                    <Text style={styles.submitCountText}>
                      {addedSpecies.length} item
                      {addedSpecies.length !== 1 ? "s" : ""}
                    </Text>
                  </View>
                </>
              )}
            </View>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>

      {/* ─── Species Selection Modal ─── */}
      <Modal
        visible={showSpeciesModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSpeciesModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modalPanel, { paddingBottom: insets.bottom + 20 }]}
          >
            {/* Handle */}
            <View style={styles.modalHandle} />

            {/* Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Select Tree Species</Text>
                <Text style={styles.modalSubtitle}>
                  {speciesList.length} species available
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowSpeciesModal(false)}
                style={styles.modalCloseBtn}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={20} color={MUTED} />
              </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={styles.searchBox}>
              <Ionicons name="search" size={18} color={MUTED} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by species name…"
                value={speciesSearch}
                onChangeText={setSpeciesSearch}
                placeholderTextColor={FAINT}
                autoFocus
              />
              {speciesSearch.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSpeciesSearch("")}
                  style={styles.searchClear}
                >
                  <Ionicons name="close-circle" size={18} color={FAINT} />
                </TouchableOpacity>
              )}
            </View>

            {/* List */}
            <View style={styles.modalListArea}>
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 20 }}
              >
                {filteredSpecies.length > 0 ? (
                  filteredSpecies.map((sp, idx) => {
                    const isAdded = addedSpecies.some(
                      (s) => s.species_id === sp.tree_specie_id,
                    );
                    return (
                      <TouchableOpacity
                        key={sp.tree_specie_id}
                        style={[
                          styles.modalItem,
                          idx === 0 && { borderTopWidth: 0 },
                          isAdded && styles.modalItemDisabled,
                        ]}
                        onPress={() => !isAdded && handleSelectSpecies(sp)}
                        activeOpacity={isAdded ? 1 : 0.7}
                        disabled={isAdded}
                      >
                        <View style={styles.modalItemLeft}>
                          <View
                            style={[
                              styles.modalItemIcon,
                              isAdded && { backgroundColor: "#F3F4F6" },
                            ]}
                          >
                            <Ionicons
                              name={isAdded ? "checkmark" : "leaf-outline"}
                              size={18}
                              color={isAdded ? FAINT : PRIMARY}
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text
                              style={[
                                styles.modalItemName,
                                isAdded && { color: FAINT },
                              ]}
                            >
                              {sp.name}
                            </Text>
                            {sp.description && (
                              <Text
                                style={styles.modalItemDesc}
                                numberOfLines={2}
                              >
                                {sp.description}
                              </Text>
                            )}
                          </View>
                        </View>
                        {!isAdded && (
                          <Ionicons
                            name="add-circle-outline"
                            size={22}
                            color={PRIMARY_200}
                          />
                        )}
                        {isAdded && (
                          <View style={styles.addedTag}>
                            <Text style={styles.addedTagText}>Added</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })
                ) : (
                  <View style={styles.modalEmpty}>
                    <View style={styles.modalEmptyIcon}>
                      <Ionicons
                        name="leaf-outline"
                        size={32}
                        color={PRIMARY_200}
                      />
                    </View>
                    <Text style={styles.modalEmptyText}>
                      {speciesSearch
                        ? "No matching species found"
                        : "No species available"}
                    </Text>
                    <Text style={styles.modalEmptySubtext}>
                      {speciesSearch
                        ? "Try a different search term"
                        : "Check back later for updates"}
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

/* ─── Styles ─────────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: BG,
  },
  loaderRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: PRIMARY_50,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  loadingText: { color: MUTED, fontSize: 14, fontWeight: "500" },

  /* Header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: BG,
  },
  backBtn: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  backBtnCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: CARD_BG,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: INK,
    letterSpacing: -0.5,
  },

  /* Context Card */
  contextCard: {
    backgroundColor: PRIMARY_50,
    borderRadius: 20,
    marginHorizontal: 20,
    marginTop: 8,
    overflow: "hidden",
    flexDirection: "row",
    borderWidth: 1,
    borderColor: PRIMARY_100,
  },
  contextAccent: {
    width: 5,
    backgroundColor: PRIMARY,
  },
  contextInner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 14,
  },
  contextIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  contextLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: PRIMARY_600,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  contextValue: {
    fontSize: 15,
    fontWeight: "700",
    color: INK,
    lineHeight: 20,
  },

  /* Cards */
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 24,
    padding: 20,
    marginHorizontal: 20,
    marginTop: 16,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.02)",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: PRIMARY_50,
    justifyContent: "center",
    alignItems: "center",
  },
  stepBadgeText: {
    fontSize: 13,
    fontWeight: "800",
    color: PRIMARY,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: INK,
    flex: 1,
  },
  optionalTag: {
    fontSize: 11,
    fontWeight: "600",
    color: FAINT,
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },

  /* Select Box */
  selectBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FAFBFC",
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 16,
    padding: 14,
  },
  selectBoxActive: {
    borderColor: PRIMARY_200,
    backgroundColor: PRIMARY_50,
  },
  speciesIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  speciesIconEmpty: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  selectedText: { fontSize: 15, fontWeight: "700", color: INK },
  selectedSubtext: { fontSize: 12, color: MUTED, marginTop: 2 },
  placeholderText: { fontSize: 15, color: FAINT, fontWeight: "500" },

  /* Quantity */
  quantitySection: { marginTop: 20 },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: MUTED,
    marginBottom: 10,
  },
  quantityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  stepperBtn: {
    width: 44,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: BORDER,
  },
  quantityInput: {
    flex: 1,
    height: 48,
    backgroundColor: "#FAFBFC",
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 14,
    fontSize: 17,
    fontWeight: "700",
    color: INK,
  },
  addBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: PRIMARY,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  addBtnDisabled: {
    backgroundColor: "#D1D5DB",
    shadowOpacity: 0,
    elevation: 0,
  },

  /* List Items */
  totalBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: PRIMARY,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  totalBadgeText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  listItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  listItemNumber: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: PRIMARY_50,
    justifyContent: "center",
    alignItems: "center",
  },
  listItemNumberText: {
    fontSize: 12,
    fontWeight: "800",
    color: PRIMARY,
  },
  listItemName: { fontSize: 15, fontWeight: "700", color: INK },
  listItemProvider: { fontSize: 12, color: MUTED, marginTop: 2 },
  listItemRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  qtyPill: {
    backgroundColor: PRIMARY_50,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  qtyPillText: {
    fontSize: 13,
    fontWeight: "800",
    color: PRIMARY,
  },
  removeBtn: { padding: 4 },
  removeBtnInner: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: ERROR_50,
    justifyContent: "center",
    alignItems: "center",
  },

  /* Text Area */
  textAreaWrap: {
    position: "relative",
  },
  textArea: {
    backgroundColor: "#FAFBFC",
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingRight: 40,
    fontSize: 15,
    color: INK,
    lineHeight: 22,
    minHeight: 120,
  },
  textAreaIcon: {
    position: "absolute",
    top: 14,
    right: 14,
  },

  /* Empty Hint */
  emptyHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 20,
    marginHorizontal: 20,
  },
  emptyHintText: {
    fontSize: 13,
    color: FAINT,
    fontWeight: "500",
  },

  /* Submit Button */
  submitBtn: {
    backgroundColor: PRIMARY,
    marginHorizontal: 20,
    marginTop: 24,
    borderRadius: 18,
    shadowColor: PRIMARY,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
    overflow: "hidden",
  },
  submitBtnDisabled: {
    backgroundColor: "#D1D5DB",
    shadowOpacity: 0,
    elevation: 0,
  },
  submitBtnInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    gap: 10,
  },
  submitBtnText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 16,
  },
  submitCountBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  submitCountText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },

  /* Modal */
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalPanel: {
    backgroundColor: WHITE,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    height: "88%",
    maxHeight: "88%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 20,
  },
  modalHandle: {
    width: 36,
    height: 4,
    backgroundColor: "#D1D5DB",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  modalTitle: { fontSize: 20, fontWeight: "800", color: INK },
  modalSubtitle: { fontSize: 13, color: MUTED, marginTop: 2 },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },

  /* Search */
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F9FAFB",
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 15, color: INK, fontWeight: "500" },
  searchClear: { padding: 2 },

  /* Modal List */
  modalListArea: { flex: 1 },
  modalItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  modalItemDisabled: {
    opacity: 0.6,
  },
  modalItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  modalItemIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: PRIMARY_50,
    justifyContent: "center",
    alignItems: "center",
  },
  modalItemName: { fontSize: 15, fontWeight: "700", color: INK },
  modalItemDesc: { fontSize: 12, color: MUTED, marginTop: 3, lineHeight: 17 },
  addedTag: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  addedTagText: {
    fontSize: 11,
    fontWeight: "700",
    color: FAINT,
  },

  /* Modal Empty */
  modalEmpty: {
    paddingVertical: 60,
    alignItems: "center",
  },
  modalEmptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 24,
    backgroundColor: PRIMARY_50,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  modalEmptyText: { fontSize: 15, color: INK, fontWeight: "700" },
  modalEmptySubtext: {
    fontSize: 13,
    color: FAINT,
    marginTop: 6,
    textAlign: "center",
  },
});
