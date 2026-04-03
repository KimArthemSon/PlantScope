import React, { useState, useEffect } from "react";
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
} from "react-native";
import { X, Trash2, PlusCircle } from "lucide-react-native";
import * as SecureStore from "expo-secure-store";
import { api } from "@/constants/url_fixed";

const API = api + "/api";

// ✅ Shared interfaces (copy to top of file or import from shared types)
export interface ImageItem {
  image_id: number;
  url: string;
  caption: string;
  created_at: string;
}
export interface AssessmentDetail {
  detail_id: number;
  tree_specie: { id: number; name: string; scientific_name: string } | null;
  soil: { id: number; name: string; type: string } | null;
  created_at: string;
}

interface Props {
  existingData: any;
  details?: AssessmentDetail[];
  images?: ImageItem[];
  onSave: (data: any, submit: boolean) => Promise<void>;
  onUploadImage: (id: string) => Promise<boolean>;
  onDeleteImage?: (id: number) => Promise<boolean>;
  saving: boolean;
  assessmentId?: string;
  isViewMode?: boolean;
  onRefresh?: () => void;
}

export default function AccessibilityForm({
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
  // ✅ Form State
  const [roadCondition, setRoadCondition] = useState(existingData?.road_condition || "Unpaved / Muddy");
  const [distance, setDistance] = useState(existingData?.distance_to_road_meters?.toString() || "0");
  const [vehicleAccess, setVehicleAccess] = useState(existingData?.vehicle_access || "4WD Only");
  const [walkTime, setWalkTime] = useState(existingData?.walking_time_minutes?.toString() || "0");
  const [comment, setComment] = useState(existingData?.inspector_comment || "");

  // ✅ Image Gallery State
  const [images, setImages] = useState<ImageItem[]>(propImages);
  const [selectedImage, setSelectedImage] = useState<ImageItem | null>(null);
  const [deletingImageId, setDeletingImageId] = useState<number | null>(null);

  // ✅ Re-initialize form state when existingData changes
  useEffect(() => {
    if (existingData) {
      setRoadCondition(existingData.road_condition || "Unpaved / Muddy");
      setDistance(existingData.distance_to_road_meters?.toString() || "0");
      setVehicleAccess(existingData.vehicle_access || "4WD Only");
      setWalkTime(existingData.walking_time_minutes?.toString() || "0");
      setComment(existingData.inspector_comment || "");
    }
  }, [existingData]);

  // ✅ Sync images from props
  useEffect(() => {
    setImages(propImages);
  }, [propImages]);

  const handleSubmit = async (submit: boolean) => {
    const data = {
      road_condition: roadCondition,
      distance_to_road_meters: parseInt(distance) || 0,
      vehicle_access: vehicleAccess,
      walking_time_minutes: parseInt(walkTime) || 0,
      inspector_comment: comment,
    };
    await onSave(data, submit);
  };

  // ✅ Delete image handler
  const handleDeleteImage = async (imageId: number) => {
    Alert.alert("Delete Photo", "Are you sure? This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setDeletingImageId(imageId);
          try {
            if (onDeleteImage) {
              const success = await onDeleteImage(imageId);
              if (success) {
                setImages((prev) => prev.filter((img) => img.image_id !== imageId));
                if (onRefresh) onRefresh();
              }
            } else {
              // Fallback direct API call
              const token = await SecureStore.getItemAsync("token");
              const res = await fetch(`${API}/delete_field_assessment_image/${imageId}/`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
              });
              if (res.ok) {
                Alert.alert("Success", "Photo deleted");
                setImages((prev) => prev.filter((img) => img.image_id !== imageId));
                if (onRefresh) onRefresh();
              } else {
                const err = await res.json();
                Alert.alert("Error", err.error || "Failed to delete");
              }
            }
          } catch (e) {
            Alert.alert("Error", "Network error");
          } finally {
            setDeletingImageId(null);
          }
        },
      },
    ]);
  };

  // ✅ Render Image Modal
  const renderImageModal = () => (
    <Modal visible={!!selectedImage} transparent animationType="fade" onRequestClose={() => setSelectedImage(null)}>
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={styles.modalClose} onPress={() => setSelectedImage(null)}>
          <X size={24} color="#fff" />
        </TouchableOpacity>
        {selectedImage?.url && (
          <Image source={{ uri: api + selectedImage.url }} style={styles.modalImage} resizeMode="contain" />
        )}
        {selectedImage?.caption && (
          <View style={styles.modalCaption}>
            <Text style={styles.modalCaptionText}>{selectedImage.caption}</Text>
            <Text style={styles.modalCaptionDate}>{new Date(selectedImage.created_at).toLocaleString()}</Text>
          </View>
        )}
      </View>
    </Modal>
  );

  // ✅ Render Image Gallery
  const renderImageGallery = () => {
    if (!assessmentId) return null;
    return (
      <View style={styles.imageSection}>
        <View style={styles.imageHeader}>
          <Text style={styles.imageTitle}>📷 Field Photos ({images.length})</Text>
          {!isViewMode && (
            <TouchableOpacity style={styles.uploadSmallBtn} onPress={() => onUploadImage(assessmentId)} disabled={saving}>
              <PlusCircle size={16} color="#0F4A2F" />
              <Text style={styles.uploadSmallText}>Add</Text>
            </TouchableOpacity>
          )}
        </View>
        {images.length === 0 ? (
          <View style={styles.noImages}>
            <Text style={styles.noImagesText}>No photos yet</Text>
            {!isViewMode && (
              <TouchableOpacity style={styles.addPhotoBtn} onPress={() => onUploadImage(assessmentId)} disabled={saving}>
                <Text style={styles.addPhotoText}>+ Add First Photo</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.imageScrollContent}>
            {images.map((img) => (
              <View key={img.image_id} style={styles.imageCard}>
                <TouchableOpacity style={styles.imageThumb} onPress={() => setSelectedImage(img)}>
                  <Image source={{ uri: api + img.url }} style={styles.imageThumbImg} resizeMode="cover" />
                  {img.caption && (
                    <View style={styles.imageCaptionBadge}>
                      <Text style={styles.imageCaptionText} numberOfLines={1}>{img.caption}</Text>
                    </View>
                  )}
                </TouchableOpacity>
                {!isViewMode && (
                  <TouchableOpacity
                    style={styles.deleteImageBtn}
                    onPress={() => handleDeleteImage(img.image_id)}
                    disabled={deletingImageId === img.image_id || saving}
                  >
                    {deletingImageId === img.image_id ? <ActivityIndicator size="small" color="#fff" /> : <Trash2 size={14} color="#fff" />}
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    );
  };

  // ✅ View Mode: Read-only
  if (isViewMode) {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🚙 Accessibility Assessment</Text>
          <Text style={styles.label}>Road Condition</Text>
          <View style={styles.readonlyBadge}><Text style={styles.readonlyText}>{roadCondition}</Text></View>
          <Text style={styles.label}>Distance to Main Road (Meters)</Text>
          <View style={styles.readonlyBadge}><Text style={styles.readonlyText}>{distance} m</Text></View>
          <Text style={styles.label}>Vehicle Access Required</Text>
          <View style={styles.readonlyBadge}><Text style={styles.readonlyText}>{vehicleAccess}</Text></View>
          <Text style={styles.label}>Walking Time (Minutes)</Text>
          <View style={styles.readonlyBadge}><Text style={styles.readonlyText}>{walkTime} min</Text></View>
          {comment ? (
            <>
              <Text style={styles.label}>Logistics Comments</Text>
              <Text style={styles.readonlyTextBlock}>{comment}</Text>
            </>
          ) : null}
        </View>
        {renderImageGallery()}
      </ScrollView>
    );
  }

  // ✅ Edit Mode
  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🚙 Accessibility Assessment</Text>
        <Text style={styles.label}>Road Condition</Text>
        <TextInput style={styles.input} value={roadCondition} onChangeText={setRoadCondition} placeholder="e.g., Unpaved, Muddy, Paved" editable={!saving} />
        <Text style={styles.label}>Distance to Main Road (Meters)</Text>
        <TextInput style={styles.input} keyboardType="numeric" value={distance} onChangeText={setDistance} editable={!saving} />
        <Text style={styles.label}>Vehicle Access Required</Text>
        <View style={styles.row}>
          {["2WD", "4WD Only", "Walking Only"].map((type) => (
            <TouchableOpacity key={type} style={[styles.btn, vehicleAccess === type && styles.btnActive]} onPress={() => setVehicleAccess(type)} disabled={saving}>
              <Text style={[styles.btnText, vehicleAccess === type && styles.btnTextActive]}>{type}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.label}>Walking Time (Minutes)</Text>
        <TextInput style={styles.input} keyboardType="numeric" value={walkTime} onChangeText={setWalkTime} editable={!saving} />
        <Text style={styles.label}>Logistics Comments</Text>
        <TextInput style={styles.input} multiline value={comment} onChangeText={setComment} placeholder="e.g., Path clears after bridge..." editable={!saving} />
      </View>
      {renderImageGallery()}
      <View style={styles.actionRow}>
        <TouchableOpacity style={[styles.saveBtn, saving && styles.btnDisabled]} onPress={() => handleSubmit(false)} disabled={saving}>
          <Text style={styles.whiteText}>{saving ? "Saving..." : "Save Draft"}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.submitBtn, saving && styles.btnDisabled]} onPress={() => handleSubmit(true)} disabled={saving}>
          <Text style={styles.whiteText}>{saving ? "Submitting..." : "Submit"}</Text>
        </TouchableOpacity>
      </View>
      {renderImageModal()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#fff" },
  section: { marginBottom: 24, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#0f172a", marginBottom: 12 },
  label: { fontWeight: "600", color: "#334155", marginTop: 8, marginBottom: 6, fontSize: 13 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: 4 },
  btn: { flex: 1, minWidth: 70, paddingVertical: 10, paddingHorizontal: 8, borderWidth: 2, borderColor: "#0F4A2F", borderRadius: 8, alignItems: "center" },
  btnActive: { backgroundColor: "#0F4A2F", borderWidth: 2 },
  btnText: { fontWeight: "600", fontSize: 12, color: "#0F4A2F" },
  btnTextActive: { color: "#fff" },
  input: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, padding: 12, minHeight: 50, fontSize: 14, color: "#334155", marginBottom: 12 },
  readonlyBadge: { backgroundColor: "#f8fafc", padding: 12, borderRadius: 8, borderWidth: 1, borderColor: "#e2e8f0", marginBottom: 12 },
  readonlyText: { fontSize: 14, color: "#475569", fontWeight: "500" },
  readonlyTextBlock: { fontSize: 14, color: "#475569", lineHeight: 20, backgroundColor: "#f8fafc", padding: 12, borderRadius: 8, borderWidth: 1, borderColor: "#e2e8f0", marginBottom: 12 },
  imageSection: { marginVertical: 16, padding: 12, backgroundColor: "#f8fafc", borderRadius: 12, borderWidth: 1, borderColor: "#e2e8f0" },
  imageHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  imageTitle: { fontSize: 14, fontWeight: "700", color: "#0f172a" },
  uploadSmallBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "#dcfce7", borderRadius: 6 },
  uploadSmallText: { fontSize: 12, fontWeight: "600", color: "#0F4A2F" },
  noImages: { padding: 20, alignItems: "center", backgroundColor: "#fff", borderRadius: 8, borderStyle: "dashed", borderWidth: 1, borderColor: "#cbd5e1" },
  noImagesText: { color: "#64748b", fontSize: 13, marginBottom: 10 },
  addPhotoBtn: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: "#0F4A2F", borderRadius: 6 },
  addPhotoText: { color: "#fff", fontWeight: "600", fontSize: 12 },
  imageScrollContent: { paddingHorizontal: 4 },
  imageCard: { position: "relative", marginRight: 10 },
  imageThumb: { width: 100, height: 100, borderRadius: 10, overflow: "hidden", backgroundColor: "#e2e8f0" },
  imageThumbImg: { width: "100%", height: "100%" },
  imageCaptionBadge: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.7)", padding: 4 },
  imageCaptionText: { color: "#fff", fontSize: 10, fontWeight: "500" },
  deleteImageBtn: { position: "absolute", top: 4, right: 4, backgroundColor: "#ef4444", borderRadius: 12, padding: 4, zIndex: 10 },
  actionRow: { flexDirection: "row", gap: 12, marginTop: 16, marginBottom: 30 },
  saveBtn: { flex: 1, backgroundColor: "#64748b", padding: 14, borderRadius: 10, alignItems: "center" },
  submitBtn: { flex: 1, backgroundColor: "#0F4A2F", padding: 14, borderRadius: 10, alignItems: "center" },
  btnDisabled: { opacity: 0.7 },
  whiteText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.95)", justifyContent: "center", alignItems: "center", padding: 20 },
  modalClose: { position: "absolute", top: 50, right: 20, zIndex: 20, backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 20, padding: 8 },
  modalImage: { width: "100%", height: "70%", borderRadius: 12 },
  modalCaption: { position: "absolute", bottom: 30, left: 20, right: 20, backgroundColor: "rgba(0,0,0,0.8)", padding: 16, borderRadius: 8 },
  modalCaptionText: { color: "#fff", fontSize: 14, textAlign: "center", fontWeight: "600", marginBottom: 4 },
  modalCaptionDate: { color: "#cbd5e1", fontSize: 12, textAlign: "center" },
});