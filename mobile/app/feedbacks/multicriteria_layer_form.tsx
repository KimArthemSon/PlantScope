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
import SafetyForm from "@/components/forms/SafetyForm";
import BoundaryVerificationForm from "@/components/forms/BoundaryVerificationForm";
import SurvivabilityForm from "@/components/forms/SurvivabilityForm";
import { useFieldAssessment } from "@/hooks/useFieldAssessment";

const API = api;

type LayerId = "safety" | "boundary_verification" | "survivability";

interface LayerFormProps {
  existingData: any;
  images: Array<{
    image_id: number;
    url: string;
    layer: string;
    latitude: number | null;
    longitude: number | null;
    description: string;
    created_at: string;
  }>;
  onSave: (data: any, submit: boolean) => Promise<number | null>;
  onUploadImage: (
    assessmentId: number,
    options?: { subLayerCode?: string; description?: string },
  ) => Promise<boolean>;
  onDeleteImage: (imageId: number) => Promise<boolean>;
  saving: boolean;
  uploading: boolean;
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
  const [fetchError, setFetchError] = useState<string | null>(null);

  const {
    saving,
    uploading,
    handleSave,
    uploadImage,
    deleteImage,
    fetchAssessmentData,
  } = useFieldAssessment(areaId!, layerId, assessmentId, () => {
    fetchAssessmentData().then((data) => {
      if (data) {
        // ✅ Extract layer-specific data from nested JSON structure
        setFormData(data.field_assessment_data?.[layerId] || {});
        setImages(data.images || []);
        setIsViewMode(data.is_submitted);
      }
    });
  });

  const loadAssessment = useCallback(async () => {
    if (!assessmentId) {
      setLoading(false);
      return;
    }
    try {
      const token = await SecureStore.getItemAsync("token");
      const res = await fetch(`${API}/api/field_assessments/${assessmentId}/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load assessment.");
      const data = await res.json();
      // ✅ Extract layer-specific data from nested JSON
      setFormData(data.field_assessment_data?.[layerId] || {});
      setImages(data.images || []);
      setIsViewMode(data.is_submitted);
    } catch (error: any) {
      setFetchError(error.message || "Failed to load assessment");
      Alert.alert("Error", error.message || "Could not load assessment");
    } finally {
      setLoading(false);
    }
  }, [assessmentId, layerId]);

  useEffect(() => {
    loadAssessment();
  }, [loadAssessment]);

  const handleFormSave = async (data: any, submit: boolean = false) => {
    // ✅ CORRECT: Wrap ONLY layer-specific data under [layerId]
    // data = flat layer fields: { overall_note: "...", location_context: "..." }
    const payload = {
      reforestation_area_id: parseInt(areaId),
      assessment_date: formData.assessment_date || new Date().toISOString().split("T")[0],
      location: formData.location || null,
      field_assessment_data: {
        [layerId]: data, // ← Creates { boundary_verification: { overall_note: "..." } }
      },
    };
    
    const savedId = await handleSave(payload, submit);
    if (savedId && !assessmentId) {
      // Redirect to edit mode if newly created
      router.replace({
        pathname: "/feedbacks/multicriteria_layer_form",
        params: {
          areaId,
          layerId,
          layerName,
          assessmentId: savedId.toString(),
          isEdit: "true",
        },
      });
    }
    return !!savedId;
  };

  const renderLayerForm = () => {
    const props: LayerFormProps = {
      existingData: formData,
      images,
      onSave: handleFormSave,
      onUploadImage: (id, opts) => uploadImage(id, opts),
      onDeleteImage: deleteImage,
      saving,
      uploading,
      assessmentId,
      isViewMode,
      areaId: areaId!,
      layerId,
      onRefresh: loadAssessment,
    };
    switch (layerId) {
      case "safety":
        return <SafetyForm {...props} />;
      case "boundary_verification":
        return <BoundaryVerificationForm {...props} />;
      case "survivability":
        return <SurvivabilityForm {...props} />;
      default:
        return (
          <View style={styles.errorContainer}>
            <Text>Form not available</Text>
          </View>
        );
    }
  };

  if (loading)
    return (
      <View style={styles.centerContent}>
        <ActivityIndicator size="large" color="#0F4A2F" />
      </View>
    );
  if (fetchError && assessmentId)
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{fetchError}</Text>
      </View>
    );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtnSmall}
          onPress={() => router.back()}
        >
          <ArrowLeft size={20} color="#0F4A2F" />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.areaName}>{layerName} Assessment</Text>
        </View>
        {isViewMode && (
          <View style={styles.submittedBadge}>
            <Text style={styles.submittedText}>SUBMITTED</Text>
          </View>
        )}
      </View>
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
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
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: { color: "#ef4444", textAlign: "center", marginBottom: 16 },
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
  backBtnSmall: { padding: 8, borderRadius: 8, backgroundColor: "#f1f5f9" },
  headerText: { flex: 1 },
  areaName: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  submittedBadge: {
    backgroundColor: "#dcfce7",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  submittedText: { fontSize: 11, fontWeight: "700", color: "#155724" },
  content: { flex: 1 },
  contentContainer: { paddingHorizontal: 16, paddingBottom: 20 },
});