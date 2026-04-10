import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState, useEffect, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import { api } from "@/constants/url_fixed";
import { ArrowLeft } from "lucide-react-native";

// ✅ Import layer-specific form components
import SafetyForm from "@/components/forms/SafetyForm";
import BoundaryVerificationForm from "@/components/forms/BoundaryVerificationForm";
import SurvivabilityForm from "@/components/forms/SurvivabilityForm";

const API = api; // Base URL - endpoints add /api/

// ✅ Type-safe layer IDs matching backend ALLOWED_LAYERS
type LayerId = "safety" | "boundary_verification" | "survivability";

// ✅ Unified form props interface
interface LayerFormProps {
  existingData: any;
  images: Array<{
    image_id: number;
    url: string;
    caption: string;
    created_at: string;
  }>;
  onSave: (data: any, submit: boolean) => Promise<boolean>;
  onUploadImage: (fieldAssessmentId: string) => Promise<boolean>;
  onDeleteImage: (imageId: number) => Promise<boolean>;
  saving: boolean;
  assessmentId?: string;
  isViewMode: boolean;
  areaId: string;
  layerId: LayerId;
  onRefresh: () => void;
}

export default function MulticriteriaLayerForm() {
  const { areaId, layerId, layerName, assessmentId, isEdit } =
    useLocalSearchParams<{
      areaId: string;
      layerId: LayerId;
      layerName?: string;
      assessmentId?: string;
      isEdit?: string;
    }>();

  const router = useRouter();
  const [loading, setLoading] = useState(!!assessmentId);
  const [formData, setFormData] = useState<any>({});
  const [images, setImages] = useState<any[]>([]);
  const [isViewMode, setIsViewMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // ✅ Validate layerId early
  const isValidLayer = ["safety", "boundary_verification", "survivability"].includes(
    layerId as string,
  );

  // Fetch assessment data if editing/viewing existing record
  const fetchAssessmentData = useCallback(async () => {
    if (!assessmentId) {
      setLoading(false);
      return;
    }
    try {
      setFetchError(null);
      const token = await SecureStore.getItemAsync("token");
      // ✅ Endpoint: /api/field_assessments/{id}/
      const res = await fetch(`${API}/api/field_assessments/${assessmentId}/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const assessment = await res.json();

      // ✅ Load field_assessment_data (not 'data')
      setFormData(
        assessment.field_assessment_data &&
          typeof assessment.field_assessment_data === "object"
          ? assessment.field_assessment_data
          : {},
      );
      // ✅ Load images array
      setImages(Array.isArray(assessment.images) ? assessment.images : []);
      // ✅ Check is_submitted (not is_sent)
      setIsViewMode(!!assessment.is_submitted);
    } catch (error: any) {
      console.error("Fetch assessment error:", error);
      setFetchError(error.message || "Failed to load assessment");
      Alert.alert("Error", error.message || "Could not load assessment");
    } finally {
      setLoading(false);
    }
  }, [assessmentId]);

  useEffect(() => {
    if (assessmentId) {
      fetchAssessmentData();
    } else {
      setLoading(false);
    }
  }, [fetchAssessmentData]);

  // ✅ Save handler: POST/PUT to backend
  const handleSave = async (data: any, submit: boolean = false): Promise<boolean> => {
    if (!areaId || !layerId) {
      Alert.alert("Error", "Missing area or layer information");
      return false;
    }

    setSaving(true);
    try {
      const token = await SecureStore.getItemAsync("token");

      // ✅ Build payload matching backend expectations
      const payload = {
        reforestation_area_id: parseInt(areaId),
        layer: layerId, // ✅ "safety" | "boundary_verification" | "survivability"
        assessment_date: formData.assessment_date || new Date().toISOString().split("T")[0],
        location: formData.location || null,
        field_assessment_data: data, // Layer-specific JSON from form
      };

      const isEditMode = !!assessmentId;
      const url = isEditMode
        ? `${API}/api/field_assessments/${assessmentId}/update/`
        : `${API}/api/field_assessments/create/`;
      const method = isEditMode ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();

      if (res.ok) {
        const newAssessmentId = resData.field_assessment_id || assessmentId;

        // If submitting, call submit endpoint
        if (submit && newAssessmentId) {
          const subRes = await fetch(
            `${API}/api/field_assessments/${newAssessmentId}/submit/`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
            },
          );
          if (subRes.ok) {
            Alert.alert("Success", "Assessment submitted to GIS Specialist!");
            setIsViewMode(true); // Lock UI after submit
            return true;
          } else {
            const err = await subRes.json().catch(() => ({}));
            Alert.alert("Error", err.error || "Failed to submit");
            return false;
          }
        } else {
          Alert.alert("Saved", isEditMode ? "Draft updated." : "Draft saved.");
          // If new record, update assessmentId for image uploads
          if (!isEditMode && newAssessmentId) {
            // Could update route params here if needed
          }
          return true;
        }
      } else {
        Alert.alert("Error", resData.error || "Save failed");
        return false;
      }
    } catch (err: any) {
      console.error("Save error:", err);
      Alert.alert("Error", err.message || "Network error while saving");
      return false;
    } finally {
      setSaving(false);
    }
  };

  // ✅ Upload image handler
  const handleUploadImage = async (currentAssessmentId: string): Promise<boolean> => {
    if (!currentAssessmentId) {
      Alert.alert("Error", "Please save the draft first to get an ID.");
      return false;
    }

    // Launch image picker (you may want to add camera option)
    const ImagePicker = await import("expo-image-picker");
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]) {
      return false;
    }

    try {
      const token = await SecureStore.getItemAsync("token");
      const formDataImg = new FormData();
      // @ts-ignore - React Native FormData accepts this format
      formDataImg.append("image", {
        uri: result.assets[0].uri,
        name: `field_photo_${Date.now()}.jpg`,
        type: "image/jpeg",
      });
      formDataImg.append("caption", "Field assessment photo");
      formDataImg.append("layer", layerId);

      // ✅ Endpoint: /api/field_assessments/{id}/images/upload/
      const res = await fetch(
        `${API}/api/field_assessments/${currentAssessmentId}/images/upload/`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formDataImg,
        },
      );

      if (res.ok) {
        Alert.alert("Success", "Photo uploaded!");
        // Refresh to show new image
        if (assessmentId) {
          fetchAssessmentData();
        }
        return true;
      } else {
        const err = await res.json().catch(() => ({}));
        Alert.alert("Error", err.error || "Upload failed");
        return false;
      }
    } catch (e: any) {
      console.error("Upload error:", e);
      Alert.alert("Error", "Network error during upload");
      return false;
    }
  };

  // ✅ Delete image handler
  const handleDeleteImage = async (imageId: number): Promise<boolean> => {
    try {
      const token = await SecureStore.getItemAsync("token");
      // ✅ Endpoint: /api/field_assessments/images/{id}/delete/
      const res = await fetch(
        `${API}/api/field_assessments/images/${imageId}/delete/`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (res.ok) {
        Alert.alert("Success", "Photo deleted");
        // Refresh to remove from UI
        if (assessmentId) {
          fetchAssessmentData();
        }
        return true;
      } else {
        const err = await res.json().catch(() => ({}));
        Alert.alert("Error", err.error || "Failed to delete");
        return false;
      }
    } catch (e: any) {
      console.error("Delete error:", e);
      Alert.alert("Error", "Network error while deleting");
      return false;
    }
  };

  // ✅ Render appropriate form based on layerId
  const renderLayerForm = () => {
    if (!isValidLayer) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Unknown layer: {layerId}</Text>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
          >
            <ArrowLeft size={16} color="#fff" />
            <Text style={styles.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      );
    }

    const formProps: LayerFormProps = {
      existingData: formData,
      images,
      onSave: handleSave,
      onUploadImage: handleUploadImage,
      onDeleteImage: handleDeleteImage,
      saving,
      assessmentId,
      isViewMode,
      areaId,
      layerId,
      onRefresh: fetchAssessmentData,
    };

    switch (layerId) {
      case "safety":
        return <SafetyForm {...formProps} />;
      case "boundary_verification":
        return <BoundaryVerificationForm {...formProps} />;
      case "survivability":
        return <SurvivabilityForm {...formProps} />;
      default:
        return (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Form not available for this layer</Text>
          </View>
        );
    }
  };

  // Loading state
  if (loading) {
    return (
      <View style={styles.centerContent}>
        <ActivityIndicator size="large" color="#0F4A2F" />
        <Text style={styles.loadingText}>Loading {layerName} form...</Text>
      </View>
    );
  }

  // Error state
  if (fetchError && assessmentId) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{fetchError}</Text>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
        >
          <ArrowLeft size={16} color="#fff" />
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtnSmall}
          onPress={() => router.back()}
          disabled={saving}
        >
          <ArrowLeft size={20} color="#0F4A2F" />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.areaName} numberOfLines={1}>
            {layerName} Assessment
          </Text>
          <Text style={styles.layerBadge}>[{layerId}]</Text>
        </View>
        {isViewMode && (
          <View style={styles.submittedBadge}>
            <Text style={styles.submittedText}>SUBMITTED</Text>
          </View>
        )}
      </View>

      {/* Form Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {renderLayerForm()}
        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  centerContent: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 10, color: "#64748b" },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    color: "#ef4444",
    textAlign: "center",
    marginBottom: 16,
    fontSize: 14,
  },
  header: {
    backgroundColor: "#fff",
    padding: 12,
    paddingTop: 50,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    gap: 12,
  },
  backBtnSmall: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
  },
  headerText: { flex: 1 },
  areaName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  layerBadge: {
    fontSize: 11,
    color: "#64748b",
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: "flex-start",
    marginTop: 2,
  },
  submittedBadge: {
    backgroundColor: "#dcfce7",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  submittedText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#155724",
  },
  content: { flex: 1 },
  contentContainer: { paddingHorizontal: 16, paddingBottom: 20 },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0F4A2F",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
    marginTop: 20,
  },
  backBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
});