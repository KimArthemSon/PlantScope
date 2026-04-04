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

export interface SoilItem {
  soil_id: number;
  name: string;
  description: string;
}

interface Props {
  existingData: any;
  images?: ImageItem[];
  onSave: (data: any, submit: boolean) => Promise<void>;
  onUploadImage: (id: string) => Promise<boolean>;
  onDeleteImage?: (id: number) => Promise<boolean>;
  saving: boolean;
  assessmentId?: string;
  isViewMode?: boolean;
  onRefresh?: () => void;
}

export default function SoilForm({
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
  const [moisture, setMoisture] = useState(
    existingData?.moisture_level || "Moderate",
  );
  const [rockiness, setRockiness] = useState(existingData?.rockiness || "Low");
  const [comment, setComment] = useState(existingData?.inspector_comment || "");

  // ✅ MULTI-SELECT STATE: Array of soils
  const [selectedSoils, setSelectedSoils] = useState<SoilItem[]>([]);
  const [soilsList, setSoilsList] = useState<SoilItem[]>([]);
  const [loadingSoils, setLoadingSoils] = useState(false);
  const [showSoilPicker, setShowSoilPicker] = useState(false);

  // ✅ Image Gallery State
  const [images, setImages] = useState<ImageItem[]>(propImages);
  const [selectedImage, setSelectedImage] = useState<ImageItem | null>(null);
  const [deletingImageId, setDeletingImageId] = useState<number | null>(null);

  // ✅ Load existing data (Drafts) - Handle multiple formats
  useEffect(() => {
    if (existingData) {
      setMoisture(existingData.moisture_level || "Moderate");
      setRockiness(existingData.rockiness || "Low");
      setComment(existingData.inspector_comment || "");

      // ✅ Handle soils in multiple formats:
      if (Array.isArray(existingData.soils)) {
        const formattedSoils = existingData.soils.map((s: any) => ({
          soil_id: typeof s === "object" ? s.soil_id : s,
          name: typeof s === "object" ? s.name : `Soil #${s}`,
          description: typeof s === "object" ? s.description || "" : "",
        }));
        setSelectedSoils(formattedSoils);
        console.log("🌱 Loaded existing soils:", formattedSoils);
      }
    }
  }, [existingData]);

  // ✅ Sync images
  useEffect(() => {
    setImages(propImages);
  }, [propImages]);

  // ✅ Fetch soils for the picker
  useEffect(() => {
    fetchSoilsList();
  }, []);

  const fetchSoilsList = async () => {
    setLoadingSoils(true);
    try {
      const token = await SecureStore.getItemAsync("token");
      const res = await fetch(`${API}/get_soils_list/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSoilsList(data);
        console.log("🌱 Loaded soils list:", data.length, "items");
      }
    } catch (err) {
      console.error("Error fetching soils:", err);
    } finally {
      setLoadingSoils(false);
    }
  };

  // ✅ FIXED: Multi-select toggle with useCallback for stability
  const handleToggleSoil = useCallback((soil: SoilItem) => {
    setSelectedSoils((prev) => {
      const soilId = soil.soil_id;
      const exists = prev.some((s) => s.soil_id === soilId);

      let newSelection;
      if (exists) {
        // Remove if already selected
        newSelection = prev.filter((s) => s.soil_id !== soilId);
        console.log("🌱 Deselected soil:", soil.name);
      } else {
        // Add if not selected
        newSelection = [...prev, soil];
        console.log("🌱 Selected soil:", soil.name);
      }

      console.log(
        "🌱 Current selection:",
        newSelection.map((s) => s.name),
      );
      return newSelection;
    });
  }, []);

  // ✅ Submit Payload - Sends array of observed soils for Leader review
  const handleSubmit = async (submit: boolean) => {
    console.log(
      "📤 Submitting soils:",
      selectedSoils.map((s) => s.name),
    );

    const data = {
      moisture_level: moisture,
      rockiness: rockiness,
      inspector_comment: comment,
      // ✅ Send the array of observed soils (evidence for Leader)
      soils: selectedSoils.map((s) => ({
        soil_id: s.soil_id,
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

  // ✅ Render Multi-Select Modal with DEBUG visual feedback
  const renderSoilPickerModal = () => (
    <Modal
      visible={showSoilPicker}
      transparent
      animationType="slide"
      onRequestClose={() => setShowSoilPicker(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.pickerModalContent}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Select Observed Soils</Text>
            <Text style={styles.pickerSubtitle}>
              Tap to select multiple soil types found in this area (
              {selectedSoils.length} selected)
            </Text>
            <TouchableOpacity onPress={() => setShowSoilPicker(false)}>
              <X size={24} color="#64748b" />
            </TouchableOpacity>
          </View>

          {loadingSoils ? (
            <View style={styles.loadingSoils}>
              <ActivityIndicator size="large" color="#0F4A2F" />
              <Text style={styles.loadingText}>Loading soils...</Text>
            </View>
          ) : soilsList.length === 0 ? (
            <View style={styles.emptySoilsContainer}>
              <Text style={styles.emptySoilsText}>
                No soils found in database
              </Text>
            </View>
          ) : (
            <FlatList
              data={soilsList}
              keyExtractor={(item) => item.soil_id.toString()}
              renderItem={({ item }) => {
                // ✅ CRITICAL: Check selection using soil_id
                const isSelected = selectedSoils.some(
                  (s) => s.soil_id === item.soil_id,
                );

                return (
                  <TouchableOpacity
                    style={[
                      styles.soilOption,
                      isSelected && styles.soilOptionSelected,
                    ]}
                    onPress={() => handleToggleSoil(item)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.soilOptionContent}>
                      <Text style={styles.soilOptionName}>{item.name}</Text>
                      {item.description && (
                        <Text style={styles.soilOptionDesc} numberOfLines={2}>
                          {item.description}
                        </Text>
                      )}
                    </View>
                    {/* ✅ Visual indicator: Checkmark for selected, empty circle for unselected */}
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
            {selectedSoils.length > 0 && (
              <TouchableOpacity
                style={styles.clearAllBtn}
                onPress={() => setSelectedSoils([])}
              >
                <Text style={styles.clearAllText}>Clear All</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.pickerCloseBtn}
              onPress={() => setShowSoilPicker(false)}
            >
              <Text style={styles.pickerCloseText}>
                Done ({selectedSoils.length} selected)
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  // ✅ Render COMPLETE Image Gallery Section
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
            🌱 Soil Assessment (View Only)
          </Text>

          {/* Observed Soils List */}
          <Text style={styles.label}>Observed Soils</Text>
          <View style={styles.soilsContainer}>
            {selectedSoils.length > 0 ? (
              selectedSoils.map((soil) => (
                <View key={soil.soil_id} style={styles.soilTag}>
                  <Text style={styles.soilTagText}>{soil.name}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.readonlyText}>None recorded</Text>
            )}
          </View>

          {/* Other fields */}
          <Text style={styles.label}>Moisture Level</Text>
          <View style={styles.readonlyBadge}>
            <Text style={styles.readonlyText}>{moisture}</Text>
          </View>

          <Text style={styles.label}>Rockiness</Text>
          <View style={styles.readonlyBadge}>
            <Text style={styles.readonlyText}>{rockiness}</Text>
          </View>

          {comment ? (
            <>
              <Text style={styles.label}>Inspector Notes</Text>
              <Text style={styles.readonlyTextBlock}>{comment}</Text>
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
        <Text style={styles.sectionTitle}>🌱 Soil Assessment</Text>

        {/* ✅ MULTI-SELECT BUTTON with count badge */}
        <Text style={styles.label}>
          Observed Soils (Tap to select all types found)
        </Text>
        <TouchableOpacity
          style={styles.soilSelector}
          onPress={() => setShowSoilPicker(true)}
          disabled={saving}
        >
          <View style={styles.selectedSoilContent}>
            {selectedSoils.length === 0 ? (
              <Text style={styles.placeholderText}>
                Tap to select soil types...
              </Text>
            ) : (
              <View style={styles.selectedSoilsList}>
                {selectedSoils.map((s) => (
                  <View key={s.soil_id} style={styles.selectedSoilChip}>
                    <Text style={styles.selectedSoilChipText}>{s.name}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
          {selectedSoils.length > 0 && (
            <View style={styles.selectionBadge}>
              <Text style={styles.selectionBadgeText}>
                {selectedSoils.length}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Moisture & Rockiness */}
        <Text style={styles.label}>Moisture Level</Text>
        <View style={styles.row}>
          {["Low", "Moderate", "High"].map((lvl) => (
            <TouchableOpacity
              key={lvl}
              style={[styles.btn, moisture === lvl && styles.btnActive]}
              onPress={() => setMoisture(lvl)}
              disabled={saving}
            >
              <Text
                style={[
                  styles.btnText,
                  moisture === lvl && styles.btnTextActive,
                ]}
              >
                {lvl}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Rockiness</Text>
        <View style={styles.row}>
          {["Low", "Moderate", "High"].map((lvl) => (
            <TouchableOpacity
              key={lvl}
              style={[styles.btn, rockiness === lvl && styles.btnActive]}
              onPress={() => setRockiness(lvl)}
              disabled={saving}
            >
              <Text
                style={[
                  styles.btnText,
                  rockiness === lvl && styles.btnTextActive,
                ]}
              >
                {lvl}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Inspector Notes</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., Mixed soil types observed: clay near ridge, sandy near stream..."
          multiline
          value={comment}
          onChangeText={setComment}
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

      {renderSoilPickerModal()}
      {renderImageModal()}
    </ScrollView>
  );
}

// ✅ Complete StyleSheet with all missing styles
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

  // === Multi-Select Soil Styles ===
  soilSelector: {
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
  selectedSoilContent: { flex: 1, paddingRight: 8 },
  selectedSoilsList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  selectedSoilChip: {
    backgroundColor: "#0F4A2F",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  selectedSoilChipText: {
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
  soilTag: {
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#86efac",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  soilTagText: { color: "#166534", fontWeight: "600", fontSize: 12 },
  soilsContainer: { flexDirection: "row", flexWrap: "wrap", marginBottom: 12 },

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

  // === Soil Picker Modal ===
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
  loadingSoils: {
    padding: 40,
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    color: "#64748b",
  },
  emptySoilsContainer: {
    padding: 40,
    alignItems: "center",
  },
  emptySoilsText: {
    textAlign: "center",
    color: "#94a3b8",
    fontSize: 14,
  },
  soilOption: {
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
  soilOptionSelected: {
    borderColor: "#0F4A2F",
    backgroundColor: "#f0fdf4",
    borderWidth: 2,
  },
  soilOptionContent: { flex: 1, paddingRight: 12 },
  soilOptionName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0f172a",
  },
  soilOptionDesc: {
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
