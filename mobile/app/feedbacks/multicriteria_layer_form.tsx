import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState, useEffect, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  View,
  TouchableOpacity,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import { api } from "@/constants/url_fixed";
import {
  useFieldAssessment,
  AssessmentResponse,
} from "@/hooks/useFieldAssessment";

// Import Forms
import SafetyForm from "@/components/forms/SafetyForm";
import LegalityForm from "@/components/forms/LegalityForm";
import SlopeForm from "@/components/forms/SlopeForm";
import SoilForm from "@/components/forms/SoilForm";
import AccessibilityForm from "@/components/forms/AccessibilityForm";
import HydrologyForm from "@/components/forms/HydrologyForm";
import WildlifeForm from "@/components/forms/WildlifeForm";
import TreeSpeciesForm from "@/components/forms/TreeSpeciesForm";

const API = api + "/api";

export default function Multicriteria_layer_form() {
  const { areaId, layerId, assessmentId, siteId, isEdit } =
    useLocalSearchParams<{
      areaId: string;
      layerId: string;
      assessmentId?: string;
      siteId?: string;
      isEdit?: string;
    }>();

  const router = useRouter();

  // ✅ Show loading ONLY if we have an ID to fetch
  const [loading, setLoading] = useState(!!assessmentId);
  const [formData, setFormData] = useState<any>({});
  const [details, setDetails] = useState<any[]>([]);
  const [images, setImages] = useState<any[]>([]);
  const [isViewMode, setIsViewMode] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const isEditing = isEdit === "true";
  const currentSiteId = siteId ? parseInt(siteId) : null;

  const { saving, handleSave, uploadImage, deleteImage, fetchSoilsList } =
    useFieldAssessment(
      areaId || "",
      layerId || "",
      assessmentId,
      currentSiteId,
      () => {
        /* Optional refresh callback */
      },
    );

  // ✅ FIXED: Stabilize fetch function with useCallback + CORRECT ENDPOINT
  const fetchAssessmentData = useCallback(async () => {
    if (!assessmentId) {
      setLoading(false);
      return;
    }

    try {
      setFetchError(null);
      const token = await SecureStore.getItemAsync("token");

      // ✅ CORRECT ENDPOINT: get_field_assessment_detail_view
      const response = await fetch(
        `${API}/get_field_assessment/${assessmentId}/`, // ✅ Fixed endpoint
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(
          err.error || `HTTP ${response.status}: Failed to fetch assessment`,
        );
      }

      const assessment: AssessmentResponse = await response.json();

      // ✅ Debug log to verify structure
      console.log("📦 Assessment loaded:", {
        id: assessment.field_assessment_id,
        hasData: !!assessment.data,
        dataKeys: assessment.data ? Object.keys(assessment.data) : [],
        is_sent: assessment.is_sent,
        imageCount: assessment.images?.length || 0,
        detailsCount: assessment.details?.length || 0,
      });

      // ✅ Set form data from the nested 'data' field (field_assessment_data JSON)
      if (assessment.data && typeof assessment.data === "object") {
        setFormData(assessment.data);
      } else {
        console.warn(
          "⚠️ assessment.data is missing or not an object:",
          assessment.data,
        );
        setFormData({});
      }

      // ✅ Set related details (tree/soil links)
      if (Array.isArray(assessment.details)) {
        setDetails(assessment.details);
      }

      // ✅ Set images for gallery
      if (Array.isArray(assessment.images)) {
        setImages(assessment.images);
      }

      // ✅ Enable view mode if assessment was submitted
      setIsViewMode(!!assessment.is_sent);
    } catch (error: any) {
      console.error("❌ Error loading assessment:", error);
      setFetchError(error.message || "Failed to load assessment");
      Alert.alert("Error", error.message || "Could not load assessment data");
    } finally {
      setLoading(false);
    }
  }, [assessmentId]); // ✅ Only depend on assessmentId

  // ✅ Fetch data whenever assessmentId exists (Edit OR View mode)
  useEffect(() => {
    fetchAssessmentData();
  }, [fetchAssessmentData]);

  // ✅ Loading state
  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#fff",
        }}
      >
        <ActivityIndicator size="large" color="#0F4A2F" />
        <Text style={{ marginTop: 12, color: "#64748b" }}>
          Loading assessment...
        </Text>
      </View>
    );
  }

  // ✅ Error state (only show if we tried to fetch)
  if (fetchError && assessmentId) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          padding: 20,
        }}
      >
        <Text
          style={{ color: "#ef4444", textAlign: "center", marginBottom: 16 }}
        >
          {fetchError}
        </Text>
        <TouchableOpacity
          style={{ backgroundColor: "#0F4A2F", padding: 12, borderRadius: 8 }}
          onPress={() => router.back()}
        >
          <Text style={{ color: "#fff", fontWeight: "600" }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ✅ Props passed to all form components
  const formProps = {
    existingData: formData, // ✅ The field_assessment_data JSON
    details, // ✅ Tree/Soil relational links
    images, // ✅ Image gallery data
    onSave: handleSave,
    onUploadImage: uploadImage,
    onDeleteImage: deleteImage,
    saving,
    assessmentId,
    isViewMode, // ✅ Enables read-only UI
    areaId,
    onRefresh: () => {
      // Refresh by re-fetching current assessment
      fetchAssessmentData();
    },
  };

  const renderForm = () => {
    switch (layerId) {
      case "pre_assessment":
        return (
          <Text style={{ padding: 16, color: "#666" }}>
            Pre-assessment uses a dedicated form.
          </Text>
        );
      case "safety":
        return <SafetyForm {...formProps} />;
      case "legality":
        return <LegalityForm {...formProps} />;
      case "slope":
        return <SlopeForm {...formProps} />;
      case "soil_quality":
        return <SoilForm {...formProps} />;
      case "accessibility":
        return <AccessibilityForm {...formProps} />;
      case "hydrology":
        return <HydrologyForm {...formProps} />;
      case "wildlife_status":
        return <WildlifeForm {...formProps} />;
      case "tree_species_suitability":
        return <TreeSpeciesForm {...formProps} />;
      default:
        return (
          <View style={{ padding: 20, alignItems: "center" }}>
            <Text style={{ color: "#666", textAlign: "center" }}>
              Form configuration missing for: {layerId}
            </Text>
            <TouchableOpacity
              style={{
                marginTop: 16,
                padding: 12,
                backgroundColor: "#0F4A2F",
                borderRadius: 8,
              }}
              onPress={() => router.back()}
            >
              <Text style={{ color: "#fff", fontWeight: "600" }}>Go Back</Text>
            </TouchableOpacity>
          </View>
        );
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#fff" }}>
      {/* Header with layer title and view/edit badge */}
      {/* <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          padding: 16,
          backgroundColor: "#f8fafc",
          borderBottomWidth: 1,
          borderBottomColor: "#e2e8f0",
        }}
      >
       
        {isViewMode && (
          <View
            style={{
              backgroundColor: "#dcfce7",
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 12,
            }}
          >
            <Text style={{ color: "#155724", fontSize: 12, fontWeight: "700" }}>
              VIEW MODE
            </Text>
          </View>
        )}
      </View> */}

      {renderForm()}
      <View style={{ height: 50 }} />
    </ScrollView>
  );
}
