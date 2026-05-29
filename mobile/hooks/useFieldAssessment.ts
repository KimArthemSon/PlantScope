import { useState } from "react";
import * as SecureStore from "expo-secure-store";
import * as Location from "expo-location";
import { Alert } from "react-native";
import { api } from "@/constants/url_fixed";
import { getStrictLayerCode } from "@/utils/layerCodes";

const API_BASE = `${api}/api`;

export interface AssessmentImage {
  image_id: number;
  url: string;
  layer: string;
  latitude: number | null;
  longitude: number | null;
  description: string;
  created_at: string;
}

export interface AssessmentResponse {
  field_assessment_id: number;
  is_submitted: boolean;
  assessment_date: string;
  location: any;
  field_assessment_data: Record<string, any>;
  images: AssessmentImage[];
  created_at: string;
  updated_at: string;
}

export interface UseFieldAssessmentReturn {
  saving: boolean;
  uploading: boolean;
  handleSave: (data: any, submit?: boolean) => Promise<number | null>;
  uploadImage: (
    assessmentId: number,
    photoData: {
      uri: string;
      latitude: number;
      longitude: number;
      accuracy?: number;
    },
    options?: { subLayerCode?: string; description?: string },
  ) => Promise<boolean>;
  deleteImage: (imageId: number) => Promise<boolean>;
  fetchAssessmentData: () => Promise<AssessmentResponse | null>;
}

export const useFieldAssessment = (
  areaId: string,
  layerId: string,
  assessmentId?: string,
  onRefresh?: () => void,
): UseFieldAssessmentReturn => {
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleSave = async (
    data: any,
    submit: boolean = false,
  ): Promise<number | null> => {
    setSaving(true);
    try {
      const token = await SecureStore.getItemAsync("token");
      if (!token) throw new Error("Authentication token missing");

      // ✅ EXPECTS: data already has { [layerId]: { ... }, location?, assessment_date? }
      // Extract top-level fields
      const { location, assessment_date, ...layerData } = data;

      // ✅ Build payload with nested structure
      const payload = {
        reforestation_area_id: parseInt(areaId),
        assessment_date:
          assessment_date || new Date().toISOString().split("T")[0],
        location: location || null,
        field_assessment_data: {
          [layerId]: layerData, // ← Creates { boundary_verification: { overall_note: "..." } }
        },
      };

      const isEdit = !!assessmentId;
      const url = isEdit
        ? `${API_BASE}/field_assessments/${assessmentId}/update/`
        : `${API_BASE}/field_assessments/create/`;

      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();
      if (!res.ok)
        throw new Error(resData.error || "Failed to save assessment.");

      const savedId = resData.field_assessment_id || assessmentId;

      if (submit && savedId) {
        const subRes = await fetch(
          `${API_BASE}/field_assessments/${savedId}/submit/`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (subRes.ok) {
          Alert.alert("Success", "Assessment submitted!");
          onRefresh?.();
          return savedId;
        }
        const err = await subRes.json().catch(() => ({}));
        throw new Error(err.error || "Submission failed.");
      }

      Alert.alert("Saved", isEdit ? "Draft updated." : "Draft saved.");
      onRefresh?.();
      return savedId;
    } catch (error: any) {
      console.error("Save Error:", error);
      Alert.alert("Error", error.message || "Network error while saving.");
      return null;
    } finally {
      setSaving(false);
    }
  };

  // ✅ FIXED: Accept photoData instead of launching camera
  const uploadImage = async (
    assessmentId: number,
    photoData: {
      uri: string;
      latitude: number;
      longitude: number;
      accuracy?: number;
    },
    options?: { subLayerCode?: string; description?: string },
  ): Promise<boolean> => {
    setUploading(true);
    try {
      const token = await SecureStore.getItemAsync("token");
      console.log("🔐 [Upload] Token retrieved:", token ? "✓" : "✗");

      const formData = new FormData();

      const imageUri = photoData.uri;
      const fileName = `geocam_${Date.now()}.jpg`;

      // @ts-ignore - React Native FormData accepts this format
      formData.append("image", {
        uri: imageUri,
        name: fileName,
        type: "image/jpeg",
      });

      const layerCode = getStrictLayerCode(layerId, options?.subLayerCode);
      console.log("🏷️ [Upload] Layer code:", layerCode);
      formData.append("layer", layerCode);

      // ✅ Use the GPS coordinates from the captured photo
      formData.append("latitude", photoData.latitude.toString());
      formData.append("longitude", photoData.longitude.toString());
      
      if (photoData.accuracy != null) {
        formData.append("gps_accuracy", photoData.accuracy.toString());
      }

      const description =
        options?.description ||
        `Boundary marker at ${photoData.latitude.toFixed(6)}, ${photoData.longitude.toFixed(6)}`;
      formData.append("description", description);
      console.log("📝 [Upload] Description:", description);

      const uploadUrl = `${API_BASE}/field_assessments/${assessmentId}/images/upload/`;
      console.log("🌐 [Upload] POST to:", uploadUrl);

      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          // ✅ DO NOT set Content-Type for FormData - React Native sets it automatically
        },
        body: formData,
      });

      console.log(
        "📡 [Upload] Response status:",
        res.status,
        res.ok ? "(OK)" : "(ERROR)",
      );

      const responseText = await res.text();
      console.log("📄 [Upload] Response body:", responseText);

      if (res.ok) {
        const responseData = JSON.parse(responseText);
        console.log("✅ [Upload] Success:", responseData);
        Alert.alert("Success", "Geocam image uploaded.");
        onRefresh?.();
        return true;
      } else {
        try {
          const errData = JSON.parse(responseText);
          console.error("❌ [Upload] Backend error:", errData);
          Alert.alert(
            "Upload Failed",
            errData.error || `Server error: ${res.status}`,
          );
        } catch (parseErr) {
          console.error(
            "❌ [Upload] Failed to parse error response:",
            responseText,
          );
          Alert.alert(
            "Upload Failed",
            `Server returned ${res.status}: ${responseText.substring(0, 100)}`,
          );
        }
        return false;
      }
    } catch (error: any) {
      console.error("💥 [Upload] CRITICAL ERROR:", error);
      Alert.alert(
        "Upload Error",
        `Failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      return false;
    } finally {
      setUploading(false);
    }
  };

  const deleteImage = async (imageId: number): Promise<boolean> => {
    try {
      const token = await SecureStore.getItemAsync("token");
      const res = await fetch(
        `${API_BASE}/field_assessments/images/${imageId}/delete/`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (res.ok) {
        onRefresh?.();
        return true;
      }
      throw new Error("Delete failed.");
    } catch {
      Alert.alert("Error", "Network error deleting image.");
      return false;
    }
  };

  const fetchAssessmentData = async (): Promise<AssessmentResponse | null> => {
    if (!assessmentId) return null;
    try {
      const token = await SecureStore.getItemAsync("token");
      const res = await fetch(
        `${API_BASE}/field_assessments/${assessmentId}/`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (res.ok) return await res.json();
      throw new Error("Failed to fetch.");
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.message || "Network error loading assessment.",
      );
      return null;
    }
  };

  return {
    saving,
    uploading,
    handleSave,
    uploadImage,
    deleteImage,
    fetchAssessmentData,
  };
};