import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Modal,
  Alert,
  FlatList,
} from "react-native";
import {
  X,
  Trash2,
  PlusCircle,
  CheckCircle,
  Circle,
} from "lucide-react-native";
import * as SecureStore from "expo-secure-store";
import { api } from "@/constants/url_fixed";

const API = api + "/api";

// ✅ Shared Interfaces
export interface ImageItem {
  image_id: number;
  url: string;
  caption: string;
  created_at: string;
}

// ✅ SIMPLIFIED: No scientific_name field
export interface TreeSpeciesItem {
  tree_specie_id: number;
  name: string;
  description: string;
}

interface Props {
  existingData: any;
  images?: ImageItem[];
  onSave: (any: any, submit: boolean) => Promise<void>;
  onUploadImage: (id: string) => Promise<boolean>;
  onDeleteImage?: (id: number) => Promise<boolean>;
  saving: boolean;
  assessmentId?: string;
  isViewMode?: boolean;
  onRefresh?: () => void;
}

export default function TreeSpeciesForm({
  existingData,
  images: propImages = [],
  onSave,
  onUploadImage,
  onDeleteImage,
  saving,
  assessmentId,
  isViewMode = false,
  onRefresh,
}: Props) {
  // ✅ Form State
  const [confidence, setConfidence] = useState(
    existingData?.confidence_level || "High",
  );
  const [inspectorNotes, setInspectorNotes] = useState(
    existingData?.inspector_notes || "",
  );

  // ✅ Species to Avoid (Array of Strings)
  const [speciesToAvoid, setSpeciesToAvoid] = useState<string[]>(
    existingData?.species_to_avoid || [],
  );
  const [newAvoidSpecies, setNewAvoidSpecies] = useState("");

  // ✅ MULTI-SELECT STATE: Recommended Species (Array of Objects)
  const [selectedSpecies, setSelectedSpecies] = useState<TreeSpeciesItem[]>([]);
  const [speciesList, setSpeciesList] = useState<TreeSpeciesItem[]>([]);
  const [loadingSpecies, setLoadingSpecies] = useState(false);
  const [showSpeciesPicker, setShowSpeciesPicker] = useState(false);

  // ✅ Image Gallery State
  const [images, setImages] = useState<ImageItem[]>(propImages);
  const [selectedImage, setSelectedImage] = useState<ImageItem | null>(null);
  const [deletingImageId, setDeletingImageId] = useState<number | null>(null);

  // ✅ Load existing data (Drafts)
  useEffect(() => {
    if (existingData) {
      setConfidence(existingData.confidence_level || "High");
      setInspectorNotes(existingData.inspector_notes || "");
      setSpeciesToAvoid(existingData.species_to_avoid || []);

      // ✅ Load previously selected species
      if (Array.isArray(existingData.recommended_species)) {
        const formattedSpecies = existingData.recommended_species.map(
          (s: any) => ({
            tree_specie_id: typeof s === "object" ? s.tree_specie_id : s,
            name: typeof s === "object" ? s.name : `Species #${s}`,
            description: typeof s === "object" ? s.description || "" : "",
          }),
        );
        setSelectedSpecies(formattedSpecies);
      }
    }
  }, [existingData]);

  // ✅ Sync images
  useEffect(() => {
    setImages(propImages);
  }, [propImages]);

  // ✅ Fetch species list for the picker
  useEffect(() => {
    fetchSpeciesList();
  }, []);

  const fetchSpeciesList = async () => {
    setLoadingSpecies(true);
    try {
      const token = await SecureStore.getItemAsync("token");
      const res = await fetch(`${API}/get_tree_species_list/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSpeciesList(data);
      }
    } catch (err) {
      console.error("Error fetching species:", err);
    } finally {
      setLoadingSpecies(false);
    }
  };

  // ✅ Multi-select toggle logic
  const handleToggleSpecies = useCallback((species: TreeSpeciesItem) => {
    setSelectedSpecies((prev) => {
      const speciesId = species.tree_specie_id;
      const exists = prev.some((s) => s.tree_specie_id === speciesId);

      if (exists) {
        return prev.filter((s) => s.tree_specie_id !== speciesId);
      } else {
        return [...prev, species];
      }
    });
  }, []);

  // ✅ Helper: Add species to avoid list
  const addAvoidSpecies = () => {
    const trimmed = newAvoidSpecies.trim();
    if (trimmed && !speciesToAvoid.includes(trimmed)) {
      setSpeciesToAvoid([...speciesToAvoid, trimmed]);
      setNewAvoidSpecies("");
    } else if (speciesToAvoid.includes(trimmed)) {
      Alert.alert("Duplicate", "This species is already in the avoid list");
    }
  };

  // ✅ Helper: Remove species from avoid list
  const removeAvoidSpecies = (species: string) => {
    setSpeciesToAvoid(speciesToAvoid.filter((s) => s !== species));
  };

  // ✅ Submit Payload - Simplified (no scientific_name)
  const handleSubmit = async (submit: boolean) => {
    const data = {
      confidence_level: confidence,
      inspector_notes: inspectorNotes,
      species_to_avoid: speciesToAvoid,
      // ✅ Send the array of selected species (simplified)
      recommended_species: selectedSpecies.map((s) => ({
        tree_specie_id: s.tree_specie_id,
        name: s.name,
      })),
    };
    await onSave(data, submit);
  };

  // ✅ Delete Image Handler
  const handleDeleteImage = async (imageId: number) => {
    Alert.alert("Delete Photo", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setDeletingImageId(imageId);
          try {
            if (onDeleteImage) {
              await onDeleteImage(imageId);
            } else {
              const token = await SecureStore.getItemAsync("token");
              await fetch(`${API}/delete_field_assessment_image/${imageId}/`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
              });
            }
            setImages((prev) => prev.filter((img) => img.image_id !== imageId));
            if (onRefresh) onRefresh();
          } catch (e) {
            Alert.alert("Error", "Network error");
          } finally {
            setDeletingImageId(null);
          }
        },
      },
    ]);
  };

  // ✅ Render Species Picker Modal
  const renderSpeciesPickerModal = () => (
    <Modal
      visible={showSpeciesPicker}
      transparent
      animationType="slide"
      onRequestClose={() => setShowSpeciesPicker(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.pickerModalContent}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Select Recommended Species</Text>
            <Text style={styles.pickerSubtitle}>
              Tap to select multiple species ({selectedSpecies.length} selected)
            </Text>
            <TouchableOpacity onPress={() => setShowSpeciesPicker(false)}>
              <X size={24} color="#64748b" />
            </TouchableOpacity>
          </View>

          {loadingSpecies ? (
            <View style={styles.loadingSpecies}>
              <ActivityIndicator size="large" color="#0F4A2F" />
              <Text style={styles.loadingText}>Loading species...</Text>
            </View>
          ) : speciesList.length === 0 ? (
            <View style={styles.emptySpeciesContainer}>
              <Text style={styles.emptySpeciesText}>
                No tree species found in database
              </Text>
            </View>
          ) : (
            <FlatList
              data={speciesList}
              keyExtractor={(item) => item.tree_specie_id.toString()}
              renderItem={({ item }) => {
                const isSelected = selectedSpecies.some(
                  (s) => s.tree_specie_id === item.tree_specie_id,
                );

                return (
                  <TouchableOpacity
                    style={[
                      styles.speciesOption,
                      isSelected && styles.speciesOptionSelected,
                    ]}
                    onPress={() => handleToggleSpecies(item)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.speciesOptionContent}>
                      <Text style={styles.speciesOptionName}>{item.name}</Text>
                      {item.description && (
                        <Text
                          style={styles.speciesOptionDesc}
                          numberOfLines={2}
                        >
                          {item.description}
                        </Text>
                      )}
                    </View>
                    {isSelected ? (
                      <CheckCircle size={20} color="#0F4A2F" />
                    ) : (
                      <Circle size={20} color="#cbd5e1" />
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          )}

          <View style={styles.pickerFooter}>
            {selectedSpecies.length > 0 && (
              <TouchableOpacity
                style={styles.clearAllBtn}
                onPress={() => setSelectedSpecies([])}
              >
                <Text style={styles.clearAllText}>Clear All</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.pickerCloseBtn}
              onPress={() => setShowSpeciesPicker(false)}
            >
              <Text style={styles.pickerCloseText}>
                Done ({selectedSpecies.length} selected)
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  // ✅ Render Image Gallery Section
  const renderImageGallery = () => {
    if (!assessmentId) return null;

    return (
      <View style={styles.imageSection}>
        <View style={styles.imageHeader}>
          <Text style={styles.imageTitle}>
            📷 Field Photos ({images.length})
          </Text>
          {!isViewMode && (
            <TouchableOpacity
              style={styles.uploadSmallBtn}
              onPress={() => onUploadImage(assessmentId)}
              disabled={saving}
            >
              <PlusCircle size={16} color="#0F4A2F" />
              <Text style={styles.uploadSmallText}>Add</Text>
            </TouchableOpacity>
          )}
        </View>

        {images.length === 0 ? (
          <View style={styles.noImages}>
            <Text style={styles.noImagesText}>No photos yet</Text>
            {!isViewMode && (
              <TouchableOpacity
                style={styles.addPhotoBtn}
                onPress={() => onUploadImage(assessmentId)}
                disabled={saving}
              >
                <Text style={styles.addPhotoText}>+ Add First Photo</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.imageScrollContent}
          >
            {images.map((img) => (
              <View key={img.image_id} style={styles.imageCard}>
                <TouchableOpacity
                  style={styles.imageThumb}
                  onPress={() => setSelectedImage(img)}
                >
                  <Image
                    source={{ uri: api + img.url }}
                    style={styles.imageThumbImg}
                    resizeMode="cover"
                  />
                  {img.caption && (
                    <View style={styles.imageCaptionBadge}>
                      <Text style={styles.imageCaptionText} numberOfLines={1}>
                        {img.caption}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
                {!isViewMode && (
                  <TouchableOpacity
                    style={styles.deleteImageBtn}
                    onPress={() => handleDeleteImage(img.image_id)}
                    disabled={deletingImageId === img.image_id || saving}
                  >
                    {deletingImageId === img.image_id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Trash2 size={14} color="#fff" />
                    )}
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    );
  };

  // ✅ Render Image Preview Modal
  const renderImageModal = () => (
    <Modal
      visible={!!selectedImage}
      transparent
      animationType="fade"
      onRequestClose={() => setSelectedImage(null)}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={styles.modalClose}
          onPress={() => setSelectedImage(null)}
        >
          <X size={24} color="#fff" />
        </TouchableOpacity>
        {selectedImage?.url && (
          <Image
            source={{ uri: api + selectedImage.url }}
            style={styles.modalImage}
            resizeMode="contain"
          />
        )}
        {selectedImage?.caption && (
          <View style={styles.modalCaption}>
            <Text style={styles.modalCaptionText}>{selectedImage.caption}</Text>
            <Text style={styles.modalCaptionDate}>
              {new Date(selectedImage.created_at).toLocaleString()}
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );

  // ✅ VIEW MODE: Read-Only Display
  if (isViewMode) {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            🌳 Tree Species Assessment (View Only)
          </Text>

          {/* Recommended Species List */}
          <Text style={styles.label}>Recommended Species</Text>
          <View style={styles.speciesContainer}>
            {selectedSpecies.length > 0 ? (
              selectedSpecies.map((species) => (
                <View key={species.tree_specie_id} style={styles.speciesTag}>
                  <Text style={styles.speciesTagName}>{species.name}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.readonlyText}>None selected</Text>
            )}
          </View>

          {/* Species to Avoid */}
          {speciesToAvoid.length > 0 && (
            <>
              <Text style={styles.label}>Species to Avoid</Text>
              <View style={styles.avoidContainer}>
                {speciesToAvoid.map((species, index) => (
                  <View key={index} style={styles.avoidTag}>
                    <Text style={styles.avoidTagText}>{species}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Confidence Level */}
          <Text style={styles.label}>Confidence Level</Text>
          <View style={styles.readonlyBadge}>
            <Text style={styles.readonlyText}>{confidence}</Text>
          </View>

          {/* Inspector Notes */}
          {inspectorNotes ? (
            <>
              <Text style={styles.label}>Inspector Notes</Text>
              <Text style={styles.readonlyTextBlock}>{inspectorNotes}</Text>
            </>
          ) : null}
        </View>
        {renderImageGallery()}
      </ScrollView>
    );
  }

  // ✅ EDIT MODE: Full Interactive Form
  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🌳 Tree Species Assessment</Text>

        {/* ✅ MULTI-SELECT BUTTON for Recommended Species */}
        <Text style={styles.label}>
          Recommended Species (Tap to select suitable species)
        </Text>
        <TouchableOpacity
          style={styles.speciesSelector}
          onPress={() => setShowSpeciesPicker(true)}
          disabled={saving}
        >
          <View style={styles.selectedSpeciesContent}>
            {selectedSpecies.length === 0 ? (
              <Text style={styles.placeholderText}>
                Tap to select tree species...
              </Text>
            ) : (
              <View style={styles.selectedSpeciesList}>
                {selectedSpecies.map((s) => (
                  <View
                    key={s.tree_specie_id}
                    style={styles.selectedSpeciesChip}
                  >
                    <Text style={styles.selectedSpeciesChipText}>{s.name}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
          {selectedSpecies.length > 0 && (
            <View style={styles.selectionBadge}>
              <Text style={styles.selectionBadgeText}>
                {selectedSpecies.length}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Species to Avoid Input */}
        <Text style={styles.label}>Species to Avoid (Optional)</Text>
        <View style={styles.chipInputContainer}>
          <View style={styles.chipContainer}>
            {speciesToAvoid.map((species, index) => (
              <View key={index} style={styles.chip}>
                <Text style={styles.chipText}>{species}</Text>
                <TouchableOpacity
                  onPress={() => removeAvoidSpecies(species)}
                  style={styles.chipRemove}
                  disabled={saving}
                >
                  <X size={12} color="#666" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.smallInput}
              placeholder="Add species to avoid (e.g., Narra)"
              value={newAvoidSpecies}
              onChangeText={setNewAvoidSpecies}
              onSubmitEditing={addAvoidSpecies}
              editable={!saving}
              returnKeyType="done"
            />
            <TouchableOpacity
              style={styles.addBtn}
              onPress={addAvoidSpecies}
              disabled={saving || !newAvoidSpecies.trim()}
            >
              <Text style={styles.addBtnText}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Confidence Level */}
        <Text style={styles.label}>Confidence Level *</Text>
        <View style={styles.row}>
          {["Low", "Moderate", "High"].map((lvl) => (
            <TouchableOpacity
              key={lvl}
              style={[styles.btn, confidence === lvl && styles.btnActive]}
              onPress={() => setConfidence(lvl)}
              disabled={saving}
            >
              <Text
                style={[
                  styles.btnText,
                  confidence === lvl && styles.btnTextActive,
                ]}
              >
                {lvl}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Inspector Notes */}
        <Text style={styles.label}>Inspector Notes</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., Mahogany ideal for this soil type..."
          multiline
          value={inspectorNotes}
          onChangeText={setInspectorNotes}
          editable={!saving}
        />
      </View>

      {renderImageGallery()}

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.btnDisabled]}
          onPress={() => handleSubmit(false)}
          disabled={saving}
        >
          <Text style={styles.whiteText}>
            {saving ? "Saving..." : "Save Draft"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.submitBtn, saving && styles.btnDisabled]}
          onPress={() => handleSubmit(true)}
          disabled={saving}
        >
          <Text style={styles.whiteText}>
            {saving ? "Submitting..." : "Submit"}
          </Text>
        </TouchableOpacity>
      </View>

      {renderSpeciesPickerModal()}
      {renderImageModal()}
    </ScrollView>
  );
}

// ✅ Complete StyleSheet - Simplified (no scientific name styles)
const styles = StyleSheet.create({
  // === Base Container ===
  container: { padding: 16, backgroundColor: "#fff" },
  section: {
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 12,
  },
  label: {
    fontWeight: "600",
    color: "#334155",
    marginTop: 8,
    marginBottom: 6,
    fontSize: 13,
  },

  // === Multi-Select Species Styles ===
  speciesSelector: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    backgroundColor: "#f8fafc",
    minHeight: 50,
    marginBottom: 12,
  },
  selectedSpeciesContent: { flex: 1, paddingRight: 8 },
  selectedSpeciesList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  selectedSpeciesChip: {
    backgroundColor: "#0F4A2F",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  selectedSpeciesChipText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  selectionBadge: {
    backgroundColor: "#0F4A2F",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: "center",
  },
  selectionBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  placeholderText: {
    color: "#94a3b8",
    fontSize: 14,
    fontStyle: "italic",
  },
  speciesTag: {
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#86efac",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  speciesTagName: { color: "#166534", fontWeight: "600", fontSize: 12 },
  speciesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 12,
  },

  // === Avoid Species Chip Input ===
  chipInputContainer: { marginBottom: 8 },
  chipContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef2f2",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  chipText: { fontSize: 12, color: "#991b1b", fontWeight: "500" },
  chipRemove: { padding: 2 },
  inputRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  smallInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    padding: 8,
    fontSize: 13,
    minHeight: 36,
  },
  addBtn: {
    backgroundColor: "#0F4A2F",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addBtnText: { color: "#fff", fontWeight: "600", fontSize: 12 },
  avoidContainer: { flexDirection: "row", flexWrap: "wrap", marginBottom: 12 },
  avoidTag: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  avoidTagText: { color: "#991b1b", fontWeight: "600", fontSize: 12 },

  // === Standard Form Styles ===
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    padding: 12,
    minHeight: 80,
    fontSize: 14,
    color: "#334155",
    backgroundColor: "#f8fafc",
    marginBottom: 12,
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  btn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 2,
    borderColor: "#0F4A2F",
    borderRadius: 8,
    alignItems: "center",
  },
  btnActive: { backgroundColor: "#0F4A2F", borderWidth: 2 },
  btnText: { fontWeight: "600", fontSize: 12, color: "#0F4A2F" },
  btnTextActive: { color: "#fff" },

  // === Read-only View Styles ===
  readonlyBadge: {
    backgroundColor: "#f8fafc",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 12,
  },
  readonlyText: { fontSize: 14, color: "#475569", fontWeight: "500" },
  readonlyTextBlock: {
    fontSize: 14,
    color: "#475569",
    lineHeight: 20,
    backgroundColor: "#f8fafc",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 12,
  },

  // === Image Gallery Section ===
  imageSection: {
    marginVertical: 16,
    padding: 12,
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  imageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  imageTitle: { fontSize: 14, fontWeight: "700", color: "#0f172a" },
  uploadSmallBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#dcfce7",
    borderRadius: 6,
  },
  uploadSmallText: { fontSize: 12, fontWeight: "600", color: "#0F4A2F" },
  noImages: {
    padding: 20,
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 8,
    borderStyle: "dashed",
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  noImagesText: { color: "#64748b", fontSize: 13, marginBottom: 10 },
  addPhotoBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#0F4A2F",
    borderRadius: 6,
  },
  addPhotoText: { color: "#fff", fontWeight: "600", fontSize: 12 },
  imageScrollContent: { paddingHorizontal: 4 },
  imageCard: { position: "relative", marginRight: 10 },
  imageThumb: {
    width: 100,
    height: 100,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#e2e8f0",
  },
  imageThumbImg: { width: "100%", height: "100%" },
  imageCaptionBadge: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.7)",
    padding: 4,
  },
  imageCaptionText: { color: "#fff", fontSize: 10, fontWeight: "500" },
  deleteImageBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "#ef4444",
    borderRadius: 12,
    padding: 4,
    zIndex: 10,
  },

  // === Action Buttons ===
  actionRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
    marginBottom: 30,
  },
  saveBtn: {
    flex: 1,
    backgroundColor: "#64748b",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  submitBtn: {
    flex: 1,
    backgroundColor: "#0F4A2F",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  btnDisabled: { opacity: 0.7 },
  whiteText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  // === Species Picker Modal ===
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  pickerModalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "80%",
    paddingBottom: 30,
  },
  pickerHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
  pickerSubtitle: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 4,
  },
  loadingSpecies: {
    padding: 40,
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    color: "#64748b",
  },
  emptySpeciesContainer: {
    padding: 40,
    alignItems: "center",
  },
  emptySpeciesText: {
    textAlign: "center",
    color: "#94a3b8",
    fontSize: 14,
  },
  speciesOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#fff",
  },
  speciesOptionSelected: {
    borderColor: "#0F4A2F",
    backgroundColor: "#f0fdf4",
    borderWidth: 2,
  },
  speciesOptionContent: { flex: 1, paddingRight: 12 },
  speciesOptionName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0f172a",
  },
  speciesOptionDesc: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  pickerFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  clearAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  clearAllText: {
    color: "#ef4444",
    fontWeight: "600",
    fontSize: 13,
  },
  pickerCloseBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#0F4A2F",
    borderRadius: 8,
  },
  pickerCloseText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },

  // === Image Modal ===
  modalClose: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 20,
    padding: 8,
  },
  modalImage: {
    width: "100%",
    height: "70%",
    borderRadius: 12,
  },
  modalCaption: {
    position: "absolute",
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: "rgba(0,0,0,0.8)",
    padding: 16,
    borderRadius: 8,
  },
  modalCaptionText: {
    color: "#fff",
    fontSize: 14,
    textAlign: "center",
    fontWeight: "600",
    marginBottom: 4,
  },
  modalCaptionDate: {
    color: "#cbd5e1",
    fontSize: 12,
    textAlign: "center",
  },
});
