import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Image,
  ActivityIndicator,
  Modal,
  Dimensions,
} from "react-native";
import { X, Trash2, PlusCircle } from "lucide-react-native";
import * as SecureStore from "expo-secure-store";
import { api } from "@/constants/url_fixed";

const API = api + "/api";
const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ✅ TypeScript Interfaces
export interface ImageItem {
  image_id: number;
  url: string;
  caption: string;
  created_at: string;
}

export interface AssessmentDetail {
  detail_id: number;
  tree_specie: {
    id: number;
    name: string;
    scientific_name: string;
  } | null;
  soil: {
    id: number;
    name: string;
    type: string;
  } | null;
  created_at: string;
}

interface Props {
  existingData: any; // The field_assessment_data JSON
  details?: AssessmentDetail[]; // Tree/Soil relational links (optional)
  images?: ImageItem[]; // Pre-loaded images (optional)
  onSave: (any: any, submit: boolean) => Promise<void>;
  onUploadImage: (id: string) => Promise<boolean>;
  onDeleteImage?: (id: number) => Promise<boolean>;
  saving: boolean;
  assessmentId?: string;
  isViewMode?: boolean;
  onRefresh?: () => void;
}

export default function SafetyForm({
  existingData,
  details = [],
  images: propImages = [],
  onSave,
  onUploadImage,
  onDeleteImage,
  saving,
  assessmentId,
  isViewMode = false,
  onRefresh,
}: Props) {
  // ✅ Geophysical Assessment State
  const [riskLevel, setRiskLevel] = useState<
    "Low" | "Medium" | "High" | "Critical"
  >(existingData?.geophysical_assessment?.risk_level || "Low");
  const [hazardComment, setHazardComment] = useState(
    existingData?.geophysical_assessment?.inspector_comment_hazard || "",
  );
  const [observedHazards, setObservedHazards] = useState<string[]>(
    existingData?.geophysical_assessment?.observed_hazards || [],
  );
  const [newHazard, setNewHazard] = useState("");

  // ✅ Human Security Assessment State
  const [securityLevel, setSecurityLevel] = useState<
    "Low" | "Medium" | "High" | "Critical"
  >(existingData?.human_security_assessment?.security_threat_level || "Low");
  const [securityComment, setSecurityComment] = useState(
    existingData?.human_security_assessment?.inspector_comment_security || "",
  );
  const [specificThreats, setSpecificThreats] = useState<string[]>(
    existingData?.human_security_assessment?.specific_threats || [],
  );
  const [newThreat, setNewThreat] = useState("");

  // ✅ Image Gallery State
  const [images, setImages] = useState<ImageItem[]>(propImages);
  const [loadingImages, setLoadingImages] = useState(false);
  const [selectedImage, setSelectedImage] = useState<ImageItem | null>(null);
  const [deletingImageId, setDeletingImageId] = useState<number | null>(null);

  // ✅ Re-initialize state when existingData changes (edit mode)
  useEffect(() => {
    if (existingData) {
      setRiskLevel(existingData.geophysical_assessment?.risk_level || "Low");
      setHazardComment(
        existingData.geophysical_assessment?.inspector_comment_hazard || "",
      );
      setObservedHazards(
        existingData.geophysical_assessment?.observed_hazards || [],
      );
      setSecurityLevel(
        existingData.human_security_assessment?.security_threat_level || "Low",
      );
      setSecurityComment(
        existingData.human_security_assessment?.inspector_comment_security ||
          "",
      );
      setSpecificThreats(
        existingData.human_security_assessment?.specific_threats || [],
      );
    }
  }, [existingData]);

  // ✅ Update images if propImages changes
  useEffect(() => {
    if (propImages.length > 0) {
      setImages(propImages);
    }
  }, [propImages]);

  // ✅ Fetch images from API if not provided via props
  useEffect(() => {
    if (assessmentId && propImages.length === 0) {
      fetchImages();
    }
  }, [assessmentId, propImages.length]);

  const fetchImages = async () => {
    if (!assessmentId) return;
    setLoadingImages(true);
    try {
      const token = await SecureStore.getItemAsync("token");
      const res = await fetch(
        `${API}/get_field_assessment_images/${assessmentId}/`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (res.ok) {
        const data = await res.json();
        setImages(data);
      }
    } catch (err) {
      console.error("Failed to fetch images:", err);
    } finally {
      setLoadingImages(false);
    }
  };

  // ✅ Delete image with confirmation
  const handleDeleteImage = async (imageId: number) => {
    Alert.alert(
      "Delete Photo",
      "Are you sure you want to delete this photo? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeletingImageId(imageId);
            try {
              // Use hook's deleteImage if provided, otherwise call API directly
              if (onDeleteImage) {
                const success = await onDeleteImage(imageId);
                if (success) {
                  setImages((prev) =>
                    prev.filter((img) => img.image_id !== imageId),
                  );
                  if (onRefresh) onRefresh();
                }
              } else {
                // Fallback direct API call
                const token = await SecureStore.getItemAsync("token");
                const res = await fetch(
                  `${API}/delete_field_assessment_image/${imageId}/`,
                  {
                    method: "DELETE",
                    headers: { Authorization: `Bearer ${token}` },
                  },
                );
                if (res.ok) {
                  Alert.alert("Success", "Photo deleted");
                  setImages((prev) =>
                    prev.filter((img) => img.image_id !== imageId),
                  );
                  if (onRefresh) onRefresh();
                } else {
                  const err = await res.json();
                  Alert.alert("Error", err.error || "Failed to delete");
                }
              }
            } catch (e) {
              Alert.alert("Error", "Network error while deleting image");
            } finally {
              setDeletingImageId(null);
            }
          },
        },
      ],
    );
  };

  // ✅ Helper: Add item to array (hazards or threats)
  const addToArray = (
    value: string,
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    clearInput: () => void,
  ) => {
    const trimmed = value.trim();
    if (trimmed) {
      const currentArray =
        setter === setObservedHazards ? observedHazards : specificThreats;
      if (!currentArray.includes(trimmed)) {
        setter((prev) => [...prev, trimmed]);
        clearInput();
      } else {
        Alert.alert("Duplicate", "This item already exists");
      }
    }
  };

  // ✅ Helper: Remove item from array
  const removeFromArray = (
    item: string,
    setter: React.Dispatch<React.SetStateAction<string[]>>,
  ) => {
    setter((prev) => prev.filter((i) => i !== item));
  };

  const handleSubmit = async (submit: boolean) => {
    // Basic validation
    if (!riskLevel || !securityLevel) {
      Alert.alert(
        "Validation",
        "Please select both Risk Level and Security Threat Level",
      );
      return;
    }

    const data = {
      geophysical_assessment: {
        risk_level: riskLevel,
        observed_hazards: observedHazards,
        inspector_comment_hazard: hazardComment,
      },
      human_security_assessment: {
        security_threat_level: securityLevel,
        specific_threats: specificThreats,
        inspector_comment_security: securityComment,
      },
    };
    await onSave(data, submit);
  };

  // ✅ Color coding for risk/security levels (matches MCDA scoring)
  const getLevelColor = (level: string, isActive: boolean) => {
    const colors: Record<string, { bg: string; text: string; border: string }> =
      {
        Low: {
          bg: isActive ? "#dcfce7" : "#fff",
          text: isActive ? "#155724" : "#166534",
          border: "#22c55e",
        },
        Medium: {
          bg: isActive ? "#fef3c7" : "#fff",
          text: isActive ? "#856404" : "#92400e",
          border: "#f59e0b",
        },
        High: {
          bg: isActive ? "#fee2e2" : "#fff",
          text: isActive ? "#b91c1c" : "#991b1b",
          border: "#ef4444",
        },
        Critical: {
          bg: isActive ? "#fecaca" : "#fff",
          text: isActive ? "#991b1b" : "#7f1d1d",
          border: "#dc2626",
        },
      };
    return colors[level] || colors.Low;
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
        {selectedImage?.caption ? (
          <View style={styles.modalCaption}>
            <Text style={styles.modalCaptionText}>{selectedImage.caption}</Text>
            <Text style={styles.modalCaptionDate}>
              {new Date(selectedImage.created_at).toLocaleString()}
            </Text>
          </View>
        ) : null}
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

        {loadingImages ? (
          <View style={styles.loadingImages}>
            <ActivityIndicator size="small" color="#0F4A2F" />
          </View>
        ) : images.length === 0 ? (
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

                {/* Delete button - only show in edit mode */}
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

  // ✅ View Mode: Read-only display
  if (isViewMode) {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⛑️ Geophysical Assessment</Text>

          <Text style={styles.label}>Risk Level</Text>
          <View
            style={[
              styles.levelBadge,
              {
                backgroundColor: getLevelColor(riskLevel, true).bg,
                borderColor: getLevelColor(riskLevel, true).border,
              },
            ]}
          >
            <Text
              style={[
                styles.levelText,
                { color: getLevelColor(riskLevel, true).text },
              ]}
            >
              {riskLevel}
            </Text>
          </View>

          {observedHazards.length > 0 && (
            <>
              <Text style={styles.label}>Observed Hazards</Text>
              <View style={styles.chipContainer}>
                {observedHazards.map((h, i) => (
                  <View key={i} style={styles.chip}>
                    <Text style={styles.chipText}>{h}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {hazardComment ? (
            <>
              <Text style={styles.label}>Inspector Notes</Text>
              <Text style={styles.readonlyText}>{hazardComment}</Text>
            </>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔐 Human Security Assessment</Text>

          <Text style={styles.label}>Security Threat Level</Text>
          <View
            style={[
              styles.levelBadge,
              {
                backgroundColor: getLevelColor(securityLevel, true).bg,
                borderColor: getLevelColor(securityLevel, true).border,
              },
            ]}
          >
            <Text
              style={[
                styles.levelText,
                { color: getLevelColor(securityLevel, true).text },
              ]}
            >
              {securityLevel}
            </Text>
          </View>

          {specificThreats.length > 0 && (
            <>
              <Text style={styles.label}>Specific Threats</Text>
              <View style={styles.chipContainer}>
                {specificThreats.map((t, i) => (
                  <View key={i} style={styles.chip}>
                    <Text style={styles.chipText}>{t}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {securityComment ? (
            <>
              <Text style={styles.label}>Inspector Notes</Text>
              <Text style={styles.readonlyText}>{securityComment}</Text>
            </>
          ) : null}
        </View>

        {/* Image Gallery in View Mode */}
        {renderImageGallery()}
      </ScrollView>
    );
  }

  // ✅ Edit Mode: Full interactive form
  return (
    <ScrollView style={styles.container}>
      {/* Geophysical Assessment Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⛑️ Geophysical Assessment</Text>

        <Text style={styles.label}>Risk Level *</Text>
        <View style={styles.row}>
          {(["Low", "Medium", "High", "Critical"] as const).map((lvl) => {
            const colors = getLevelColor(lvl, riskLevel === lvl);
            return (
              <TouchableOpacity
                key={lvl}
                style={[
                  styles.btn,
                  { backgroundColor: colors.bg, borderColor: colors.border },
                  riskLevel === lvl && styles.btnActive,
                ]}
                onPress={() => setRiskLevel(lvl)}
                disabled={saving}
              >
                <Text style={[styles.btnText, { color: colors.text }]}>
                  {lvl}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Dynamic Hazard Tags Input */}
        <Text style={styles.label}>Observed Hazards (Optional)</Text>
        <View style={styles.chipInputContainer}>
          <View style={styles.chipContainer}>
            {observedHazards.map((hazard, index) => (
              <View key={index} style={styles.chip}>
                <Text style={styles.chipText}>{hazard}</Text>
                <TouchableOpacity
                  onPress={() => removeFromArray(hazard, setObservedHazards)}
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
              placeholder="Add hazard (e.g., Landslide)"
              value={newHazard}
              onChangeText={setNewHazard}
              onSubmitEditing={() => {
                addToArray(newHazard, setObservedHazards, () =>
                  setNewHazard(""),
                );
              }}
              editable={!saving}
              returnKeyType="done"
            />
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() =>
                addToArray(newHazard, setObservedHazards, () =>
                  setNewHazard(""),
                )
              }
              disabled={saving || !newHazard.trim()}
            >
              <Text style={styles.addBtnText}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.label}>Inspector Notes</Text>
        <TextInput
          style={styles.input}
          placeholder="Describe hazards or mitigation ideas..."
          multiline
          value={hazardComment}
          onChangeText={setHazardComment}
          editable={!saving}
        />
      </View>

      {/* Human Security Assessment Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔐 Human Security Assessment</Text>

        <Text style={styles.label}>Security Threat Level *</Text>
        <View style={styles.row}>
          {(["Low", "Medium", "High", "Critical"] as const).map((lvl) => {
            const colors = getLevelColor(lvl, securityLevel === lvl);
            return (
              <TouchableOpacity
                key={lvl}
                style={[
                  styles.btn,
                  { backgroundColor: colors.bg, borderColor: colors.border },
                  securityLevel === lvl && styles.btnActive,
                ]}
                onPress={() => setSecurityLevel(lvl)}
                disabled={saving}
              >
                <Text style={[styles.btnText, { color: colors.text }]}>
                  {lvl}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Dynamic Threat Tags Input */}
        <Text style={styles.label}>Specific Threats (Optional)</Text>
        <View style={styles.chipInputContainer}>
          <View style={styles.chipContainer}>
            {specificThreats.map((threat, index) => (
              <View key={index} style={styles.chip}>
                <Text style={styles.chipText}>{threat}</Text>
                <TouchableOpacity
                  onPress={() => removeFromArray(threat, setSpecificThreats)}
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
              placeholder="Add threat (e.g., NPA activity)"
              value={newThreat}
              onChangeText={setNewThreat}
              onSubmitEditing={() => {
                addToArray(newThreat, setSpecificThreats, () =>
                  setNewThreat(""),
                );
              }}
              editable={!saving}
              returnKeyType="done"
            />
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() =>
                addToArray(newThreat, setSpecificThreats, () =>
                  setNewThreat(""),
                )
              }
              disabled={saving || !newThreat.trim()}
            >
              <Text style={styles.addBtnText}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.label}>Inspector Notes</Text>
        <TextInput
          style={styles.input}
          placeholder="Describe security situation..."
          multiline
          value={securityComment}
          onChangeText={setSecurityComment}
          editable={!saving}
        />
      </View>

      {/* Image Gallery Section */}
      {renderImageGallery()}

      {/* Action Buttons */}
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

      {/* Image Preview Modal */}
      {renderImageModal()}
    </ScrollView>
  );
}

// ✅ Complete StyleSheet
const styles = StyleSheet.create({
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
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginVertical: 4,
  },
  btn: {
    flex: 1,
    minWidth: 70,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 2,
    borderRadius: 8,
    alignItems: "center",
  },
  btnActive: {
    borderWidth: 2,
  },
  btnText: {
    fontWeight: "600",
    fontSize: 12,
  },
  levelBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 8,
  },
  levelText: {
    fontWeight: "700",
    fontSize: 13,
  },
  chipInputContainer: {
    marginBottom: 8,
  },
  chipContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  chipText: {
    fontSize: 12,
    color: "#334155",
    fontWeight: "500",
  },
  chipRemove: {
    padding: 2,
  },
  inputRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
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
  addBtnText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    padding: 12,
    minHeight: 80,
    textAlignVertical: "top",
    fontSize: 14,
    color: "#334155",
  },
  readonlyText: {
    fontSize: 14,
    color: "#475569",
    lineHeight: 20,
    backgroundColor: "#f8fafc",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
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
  imageTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  uploadSmallBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#dcfce7",
    borderRadius: 6,
  },
  uploadSmallText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0F4A2F",
  },
  loadingImages: {
    padding: 20,
    alignItems: "center",
  },
  noImages: {
    padding: 20,
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 8,
    borderStyle: "dashed",
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  noImagesText: {
    color: "#64748b",
    fontSize: 13,
    marginBottom: 10,
  },
  addPhotoBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#0F4A2F",
    borderRadius: 6,
  },
  addPhotoText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 12,
  },
  imageScrollContent: {
    paddingHorizontal: 4,
  },
  imageCard: {
    position: "relative",
    marginRight: 10,
  },
  imageThumb: {
    width: 100,
    height: 100,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#e2e8f0",
  },
  imageThumbImg: {
    width: "100%",
    height: "100%",
  },
  imageCaptionBadge: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.7)",
    padding: 4,
  },
  imageCaptionText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "500",
  },
  deleteImageBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "#ef4444",
    borderRadius: 12,
    padding: 4,
    zIndex: 10,
  },
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
  btnDisabled: {
    opacity: 0.7,
  },
  whiteText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
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
