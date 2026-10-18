import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Animated,
} from "react-native";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/constants/url_fixed";
import { useAlert } from "@/components/AlertContext";

/* ─── Design Tokens ────────────────────────────────────────────────────── */
const PRIMARY = "#0F4A2F";
const PRIMARY_50 = "#ECFDF5";
const PRIMARY_100 = "#D1FAE5";
const INK = "#111827";
const MUTED = "#6B7280";
const FAINT = "#9CA3AF";
const WHITE = "#FFFFFF";
const BG = "#F4F7F5";
const BORDER = "#E5E7EB";
const ERROR = "#DC2626";

const QTY_PRESETS = [10, 25, 50, 100];

const cardShadow = {
  shadowColor: "#0F172A",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.05,
  shadowRadius: 10,
  elevation: 2,
};

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
  const { success, error: showError, warning } = useAlert();

  const [applicationId, setApplicationId] = useState<number | null>(null);
  const [appTitle, setAppTitle] = useState<string>("");
  const [siteName, setSiteName] = useState<string>("");
  const [speciesList, setSpeciesList] = useState<TreeSpeciesOption[]>([]);

  const [showSpeciesModal, setShowSpeciesModal] = useState(false);
  const [speciesSearch, setSpeciesSearch] = useState("");
  const [selectedSpecies, setSelectedSpecies] = useState<TreeSpeciesOption | null>(null);

  const [quantity, setQuantity] = useState("");
  const [addedSpecies, setAddedSpecies] = useState<AddedSpecies[]>([]);
  const [description, setDescription] = useState("");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const goBack = () => router.replace("/tree_growers/seedlingRequests");

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
          warning("No active application", "You need an active program to request seedlings.");
          goBack();
          return;
        }
        // Same rule as the requests list: new requests only during monitoring
        if (appData.application.status !== "under_monitoring") {
          warning("Not available yet", "You can request seedlings once your site is under monitoring.");
          goBack();
          return;
        }
        setApplicationId(appData.application.application_id);
        setAppTitle(appData.application.title);
        setSiteName(appData.assigned_site?.name || "");

        const speciesRes = await fetch(`${api}/api/get_tree_species_list/`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (speciesRes.ok) {
          const data = await speciesRes.json();
          const list: TreeSpeciesOption[] = Array.isArray(data)
            ? data
            : Array.isArray(data?.data)
              ? data.data
              : Array.isArray(data?.species)
                ? data.species
                : [];
          setSpeciesList(list);
        }
      } catch (err: any) {
        showError("Couldn't load form", err.message || "Failed to load data.");
        goBack();
      } finally {
        setLoading(false);
        Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
      }
    };

    fetchInitialData();
  }, []);

  /* ─── Handlers ───────────────────────────────────────────────────────── */
  const filteredSpecies = speciesList.filter((s) =>
    s.name.toLowerCase().includes(speciesSearch.toLowerCase()),
  );

  const handleSelectSpecies = (species: TreeSpeciesOption) => {
    setSelectedSpecies(species);
    setShowSpeciesModal(false);
    setSpeciesSearch("");
    if (!quantity) setQuantity("10");
  };

  const parsedQty = parseInt(quantity || "0", 10);
  const canAdd = !!selectedSpecies && parsedQty > 0;

  const handleAddSpecies = () => {
    if (!selectedSpecies) return warning("Pick a species", "Choose a tree species first.");
    if (!(parsedQty > 0)) return warning("Invalid quantity", "Enter a number greater than 0.");

    setAddedSpecies([
      ...addedSpecies,
      {
        species_id: selectedSpecies.tree_specie_id,
        species_name: selectedSpecies.name,
        quantity: parsedQty,
        provided_by: "ENRO Nursery",
      },
    ]);
    setSelectedSpecies(null);
    setQuantity("");
  };

  const adjustQty = (delta: number) => {
    setQuantity(String(Math.max(1, (parseInt(quantity || "0", 10) || 0) + delta)));
  };

  const adjustItemQty = (speciesId: number, delta: number) => {
    setAddedSpecies((list) =>
      list.map((s) => (s.species_id === speciesId ? { ...s, quantity: Math.max(1, s.quantity + delta) } : s)),
    );
  };

  const handleRemoveSpecies = (speciesId: number) =>
    setAddedSpecies(addedSpecies.filter((s) => s.species_id !== speciesId));

  const handleSubmit = async () => {
    if (addedSpecies.length === 0) return warning("No species added", "Add at least one tree species.");
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
      if (description.trim()) fd.append("description", description.trim());

      const res = await fetch(`${api}/api/create_seedling_request/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed.");

      success("Request submitted", "It's now pending review by the Data Manager.");
      goBack();
    } catch (err: any) {
      showError("Submission failed", err.message || "Something went wrong.");
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

  const totalSeedlings = addedSpecies.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Hero ── */}
        <View style={[styles.hero, { paddingTop: insets.top + 8 }]}>
          <View style={styles.heroTopRow}>
            <TouchableOpacity style={styles.heroBack} onPress={goBack} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={20} color={WHITE} />
            </TouchableOpacity>
          </View>
          <Text style={styles.heroEyebrow}>New Seedling Request</Text>
          <Text style={styles.heroTitle}>What do you need?</Text>
          <View style={styles.heroChips}>
            <View style={styles.heroChip}>
              <Ionicons name="document-text-outline" size={13} color={WHITE} />
              <Text style={styles.heroChipText} numberOfLines={1}>{appTitle}</Text>
            </View>
            {!!siteName && (
              <View style={styles.heroChip}>
                <Ionicons name="location-outline" size={13} color={WHITE} />
                <Text style={styles.heroChipText} numberOfLines={1}>{siteName}</Text>
              </View>
            )}
          </View>
        </View>

        <Animated.View style={[styles.body, { opacity: fadeAnim }]}>
          {/* ── Step 1: Add species ── */}
          <View style={styles.card}>
            <StepHeader n={1} title="Add tree species" done={addedSpecies.length > 0} />

            <TouchableOpacity
              style={[styles.selectBox, selectedSpecies && styles.selectBoxActive]}
              onPress={() => setShowSpeciesModal(true)}
              activeOpacity={0.75}
            >
              <View style={[styles.selectIcon, selectedSpecies && { backgroundColor: WHITE }]}>
                <Ionicons name={selectedSpecies ? "leaf" : "add"} size={20} color={selectedSpecies ? PRIMARY : FAINT} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={selectedSpecies ? styles.selectedText : styles.placeholderText}>
                  {selectedSpecies ? selectedSpecies.name : "Choose a tree species"}
                </Text>
                <Text style={styles.selectedSubtext}>
                  {selectedSpecies ? "Tap to change" : `${speciesList.length} species available`}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={selectedSpecies ? PRIMARY : FAINT} />
            </TouchableOpacity>

            <Text style={styles.inputLabel}>How many seedlings?</Text>
            <View style={styles.quantityRow}>
              <TouchableOpacity style={styles.stepperBtn} onPress={() => adjustQty(-1)} activeOpacity={0.7}>
                <Ionicons name="remove" size={20} color={INK} />
              </TouchableOpacity>
              <TextInput
                style={styles.quantityInput}
                placeholder="0"
                keyboardType="numeric"
                value={quantity}
                onChangeText={(text) => setQuantity(text.replace(/[^0-9]/g, ""))}
                placeholderTextColor={FAINT}
                textAlign="center"
              />
              <TouchableOpacity style={styles.stepperBtn} onPress={() => adjustQty(1)} activeOpacity={0.7}>
                <Ionicons name="add" size={20} color={INK} />
              </TouchableOpacity>
            </View>
            <View style={styles.presetRow}>
              {QTY_PRESETS.map((n) => {
                const active = parsedQty === n;
                return (
                  <TouchableOpacity
                    key={n}
                    style={[styles.preset, active && styles.presetActive]}
                    onPress={() => setQuantity(String(n))}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.presetText, active && styles.presetTextActive]}>{n}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[styles.addBtn, !canAdd && styles.addBtnDisabled]}
              onPress={handleAddSpecies}
              disabled={!canAdd}
              activeOpacity={0.85}
            >
              <Ionicons name="add-circle" size={18} color={WHITE} />
              <Text style={styles.addBtnText}>
                {canAdd ? `Add ${parsedQty.toLocaleString()} ${selectedSpecies!.name}` : "Add to request"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── Step 2: Summary ── */}
          <View style={styles.card}>
            <StepHeader
              n={2}
              title="Your request"
              done={addedSpecies.length > 0}
              right={addedSpecies.length > 0 ? `${addedSpecies.length} species` : undefined}
            />
            {addedSpecies.length === 0 ? (
              <View style={styles.emptyList}>
                <View style={styles.emptyListIcon}>
                  <Ionicons name="leaf-outline" size={22} color={PRIMARY} />
                </View>
                <Text style={styles.emptyListText}>No species yet — add one above.</Text>
              </View>
            ) : (
              <>
                {addedSpecies.map((item) => (
                  <View key={item.species_id} style={styles.listItem}>
                    <View style={styles.listIcon}>
                      <Ionicons name="leaf" size={16} color={PRIMARY} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.listName} numberOfLines={1}>{item.species_name}</Text>
                      <Text style={styles.listProvider}>From {item.provided_by}</Text>
                    </View>
                    <View style={styles.miniStepper}>
                      <TouchableOpacity onPress={() => adjustItemQty(item.species_id, -1)} hitSlop={6}>
                        <Ionicons name="remove" size={16} color={PRIMARY} />
                      </TouchableOpacity>
                      <Text style={styles.miniQty}>{item.quantity.toLocaleString()}</Text>
                      <TouchableOpacity onPress={() => adjustItemQty(item.species_id, 1)} hitSlop={6}>
                        <Ionicons name="add" size={16} color={PRIMARY} />
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleRemoveSpecies(item.species_id)}
                      style={styles.removeBtn}
                      activeOpacity={0.6}
                    >
                      <Ionicons name="trash-outline" size={15} color={ERROR} />
                    </TouchableOpacity>
                  </View>
                ))}
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Total seedlings</Text>
                  <Text style={styles.totalValue}>{totalSeedlings.toLocaleString()}</Text>
                </View>
              </>
            )}
          </View>

          {/* ── Step 3: Notes ── */}
          <View style={styles.card}>
            <StepHeader n={3} title="Notes" optional done={description.trim().length > 0} />
            <TextInput
              style={styles.textArea}
              placeholder="Why do you need these seedlings? Any timing or delivery details…"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              placeholderTextColor={FAINT}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.infoNote}>
            <Ionicons name="information-circle-outline" size={16} color={MUTED} />
            <Text style={styles.infoNoteText}>
              The Data Manager may adjust quantities based on nursery stock. You'll be notified once it's reviewed.
            </Text>
          </View>
        </Animated.View>
      </ScrollView>

      {/* ── Sticky submit bar ── */}
      <View style={[styles.submitBar, { paddingBottom: insets.bottom + 12 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.submitBarLabel}>Total</Text>
          <Text style={styles.submitBarValue}>
            {totalSeedlings.toLocaleString()} <Text style={styles.submitBarUnit}>seedlings</Text>
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.submitBtn, (submitting || addedSpecies.length === 0) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting || addedSpecies.length === 0}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={WHITE} />
          ) : (
            <>
              <Ionicons name="paper-plane" size={16} color={WHITE} />
              <Text style={styles.submitBtnText}>Submit Request</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* ─── Species Selection Modal ─── */}
      <Modal visible={showSpeciesModal} animationType="slide" transparent onRequestClose={() => setShowSpeciesModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalPanel, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Select Tree Species</Text>
                <Text style={styles.modalSubtitle}>{speciesList.length} species available</Text>
              </View>
              <TouchableOpacity onPress={() => setShowSpeciesModal(false)} style={styles.modalCloseBtn} activeOpacity={0.7}>
                <Ionicons name="close" size={20} color={MUTED} />
              </TouchableOpacity>
            </View>

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
                <TouchableOpacity onPress={() => setSpeciesSearch("")}>
                  <Ionicons name="close-circle" size={18} color={FAINT} />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 20 }}>
              {filteredSpecies.length > 0 ? (
                filteredSpecies.map((sp) => {
                  const isAdded = addedSpecies.some((s) => s.species_id === sp.tree_specie_id);
                  const isSelected = selectedSpecies?.tree_specie_id === sp.tree_specie_id;
                  return (
                    <TouchableOpacity
                      key={sp.tree_specie_id}
                      style={[styles.modalItem, isSelected && styles.modalItemSelected, isAdded && { opacity: 0.55 }]}
                      onPress={() => !isAdded && handleSelectSpecies(sp)}
                      activeOpacity={isAdded ? 1 : 0.7}
                      disabled={isAdded}
                    >
                      <View style={[styles.modalItemIcon, isAdded && { backgroundColor: "#F3F4F6" }]}>
                        <Ionicons name={isAdded ? "checkmark" : "leaf-outline"} size={18} color={isAdded ? FAINT : PRIMARY} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.modalItemName, isAdded && { color: FAINT }]}>{sp.name}</Text>
                        {!!sp.description && (
                          <Text style={styles.modalItemDesc} numberOfLines={2}>{sp.description}</Text>
                        )}
                      </View>
                      {isAdded ? (
                        <View style={styles.addedTag}>
                          <Text style={styles.addedTagText}>Added</Text>
                        </View>
                      ) : (
                        <Ionicons name={isSelected ? "checkmark-circle" : "chevron-forward"} size={20} color={isSelected ? PRIMARY : FAINT} />
                      )}
                    </TouchableOpacity>
                  );
                })
              ) : (
                <View style={styles.modalEmpty}>
                  <View style={styles.emptyListIcon}>
                    <Ionicons name="search-outline" size={24} color={PRIMARY} />
                  </View>
                  <Text style={styles.modalEmptyText}>{speciesSearch ? "No matching species" : "No species available"}</Text>
                  <Text style={styles.modalEmptySubtext}>{speciesSearch ? "Try a different search term" : "Check back later"}</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const StepHeader = ({
  n,
  title,
  done,
  optional,
  right,
}: {
  n: number;
  title: string;
  done?: boolean;
  optional?: boolean;
  right?: string;
}) => (
  <View style={styles.stepHeader}>
    <View style={[styles.stepNum, done && styles.stepNumDone]}>
      {done ? <Ionicons name="checkmark" size={14} color={WHITE} /> : <Text style={styles.stepNumText}>{n}</Text>}
    </View>
    <Text style={styles.stepTitle}>{title}</Text>
    {optional && <Text style={styles.optionalTag}>Optional</Text>}
    {!!right && <Text style={styles.stepRight}>{right}</Text>}
  </View>
);

/* ─── Styles ─────────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: BG },
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

  /* Hero */
  hero: { backgroundColor: PRIMARY, paddingHorizontal: 20, paddingBottom: 44, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  heroTopRow: { flexDirection: "row", marginBottom: 14 },
  heroBack: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.15)", justifyContent: "center", alignItems: "center" },
  heroEyebrow: { fontSize: 11, fontWeight: "700", color: "rgba(255,255,255,0.65)", textTransform: "uppercase", letterSpacing: 1 },
  heroTitle: { fontSize: 26, fontWeight: "800", color: WHITE, letterSpacing: -0.5, marginTop: 4 },
  heroChips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  heroChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.14)", maxWidth: "100%" },
  heroChipText: { fontSize: 12, fontWeight: "600", color: WHITE, flexShrink: 1 },

  body: { paddingHorizontal: 16, marginTop: -28, gap: 14 },

  /* Cards */
  card: { backgroundColor: WHITE, borderRadius: 20, padding: 16, ...cardShadow },
  stepHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  stepNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: "#F1F5F9", justifyContent: "center", alignItems: "center" },
  stepNumDone: { backgroundColor: "#16A34A" },
  stepNumText: { fontSize: 12, fontWeight: "800", color: MUTED },
  stepTitle: { fontSize: 15.5, fontWeight: "800", color: INK, flex: 1 },
  stepRight: { fontSize: 12, fontWeight: "600", color: FAINT },
  optionalTag: { fontSize: 11, fontWeight: "600", color: FAINT, backgroundColor: "#F3F4F6", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, overflow: "hidden" },

  /* Select Box */
  selectBox: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#F9FAFB", borderWidth: 1.5, borderColor: BORDER, borderRadius: 16, padding: 12 },
  selectBoxActive: { borderColor: "#A7F3D0", backgroundColor: PRIMARY_50 },
  selectIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: "#F3F4F6", justifyContent: "center", alignItems: "center" },
  selectedText: { fontSize: 15, fontWeight: "800", color: INK },
  placeholderText: { fontSize: 15, color: MUTED, fontWeight: "600" },
  selectedSubtext: { fontSize: 12, color: FAINT, marginTop: 1 },

  /* Quantity */
  inputLabel: { fontSize: 12, fontWeight: "700", color: MUTED, marginTop: 16, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.4 },
  quantityRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  stepperBtn: { width: 48, height: 50, borderRadius: 14, backgroundColor: "#F3F4F6", justifyContent: "center", alignItems: "center" },
  quantityInput: { flex: 1, height: 50, backgroundColor: "#F9FAFB", borderWidth: 1.5, borderColor: BORDER, borderRadius: 14, fontSize: 20, fontWeight: "800", color: INK },
  presetRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  preset: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: BORDER, backgroundColor: WHITE },
  presetActive: { backgroundColor: PRIMARY_50, borderColor: "#6EE7B7" },
  presetText: { fontSize: 13, fontWeight: "700", color: MUTED },
  presetTextActive: { color: PRIMARY },
  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 14, paddingVertical: 13, borderRadius: 14, backgroundColor: PRIMARY },
  addBtnDisabled: { backgroundColor: "#D1D5DB" },
  addBtnText: { color: WHITE, fontSize: 14, fontWeight: "800" },

  /* Summary list */
  emptyList: { alignItems: "center", paddingVertical: 16, gap: 8 },
  emptyListIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: PRIMARY_50, justifyContent: "center", alignItems: "center" },
  emptyListText: { fontSize: 13, color: MUTED },
  listItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  listIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: PRIMARY_50, justifyContent: "center", alignItems: "center" },
  listName: { fontSize: 14.5, fontWeight: "700", color: INK },
  listProvider: { fontSize: 11.5, color: MUTED, marginTop: 1 },
  miniStepper: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: PRIMARY_50, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 6, borderWidth: 1, borderColor: PRIMARY_100 },
  miniQty: { fontSize: 13.5, fontWeight: "800", color: PRIMARY, minWidth: 28, textAlign: "center" },
  removeBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: "#FEF2F2", justifyContent: "center", alignItems: "center" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12 },
  totalLabel: { fontSize: 13, fontWeight: "700", color: MUTED },
  totalValue: { fontSize: 20, fontWeight: "800", color: PRIMARY },

  /* Notes */
  textArea: { backgroundColor: "#F9FAFB", borderWidth: 1.5, borderColor: BORDER, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14.5, color: INK, lineHeight: 21, minHeight: 110 },
  infoNote: { flexDirection: "row", gap: 8, paddingHorizontal: 4 },
  infoNoteText: { flex: 1, fontSize: 12, color: MUTED, lineHeight: 17 },

  /* Sticky submit bar */
  submitBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: WHITE,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 12,
  },
  submitBarLabel: { fontSize: 11, fontWeight: "700", color: FAINT, textTransform: "uppercase", letterSpacing: 0.5 },
  submitBarValue: { fontSize: 20, fontWeight: "800", color: INK },
  submitBarUnit: { fontSize: 13, fontWeight: "600", color: MUTED },
  submitBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: PRIMARY, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 14 },
  submitBtnDisabled: { backgroundColor: "#D1D5DB" },
  submitBtnText: { color: WHITE, fontWeight: "800", fontSize: 15 },

  /* Modal */
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(15,23,42,0.45)" },
  modalPanel: { backgroundColor: WHITE, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 20, paddingTop: 10, height: "85%" },
  modalHandle: { width: 40, height: 4, backgroundColor: BORDER, borderRadius: 2, alignSelf: "center", marginBottom: 14 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 },
  modalTitle: { fontSize: 19, fontWeight: "800", color: INK },
  modalSubtitle: { fontSize: 13, color: MUTED, marginTop: 2 },
  modalCloseBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#F3F4F6", justifyContent: "center", alignItems: "center" },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#F9FAFB", borderWidth: 1.5, borderColor: BORDER, borderRadius: 14, paddingHorizontal: 14, height: 48, marginBottom: 10 },
  searchInput: { flex: 1, fontSize: 15, color: INK },
  modalItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 8, borderRadius: 14 },
  modalItemSelected: { backgroundColor: PRIMARY_50 },
  modalItemIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: PRIMARY_50, justifyContent: "center", alignItems: "center" },
  modalItemName: { fontSize: 15, fontWeight: "700", color: INK },
  modalItemDesc: { fontSize: 12, color: MUTED, marginTop: 2, lineHeight: 17 },
  addedTag: { backgroundColor: "#F3F4F6", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  addedTagText: { fontSize: 11, fontWeight: "700", color: FAINT },
  modalEmpty: { paddingVertical: 50, alignItems: "center", gap: 6 },
  modalEmptyText: { fontSize: 15, color: INK, fontWeight: "700", marginTop: 6 },
  modalEmptySubtext: { fontSize: 13, color: FAINT },
});
