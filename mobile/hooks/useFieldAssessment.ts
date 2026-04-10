import { useState } from "react";
import * as SecureStore from "expo-secure-store";
import * as ImagePicker from "expo-image-picker";
import { Alert } from "react-native";
import { api } from "@/constants/url_fixed";

// ✅ Base URL: The 'api' constant usually includes the port
const API_BASE = `${api}/api`;

// ─────────────────────────────────────────────
// TypeScript Interfaces
// ─────────────────────────────────────────────

export interface AssessmentData {
  layer: string;
  assessment_date: string;
  location: {
    latitude: number;
    longitude: number;
    gps_accuracy_meters?: number;
  } | null;
  // Layer-specific fields (Safety, Boundary, Survivability, etc.)
  [key: string]: any;
}

export interface AssessmentImage {
  image_id: number;
  url: string;
  caption: string;
  layer: string;
  created_at: string;
}

export interface AssessmentResponse {
  field_assessment_id: number;
  layer: string;
  is_submitted: boolean;
  assessment_date: string;
  location: any;
  field_assessment_data: AssessmentData;
  images: AssessmentImage[];
  created_at: string;
  updated_at: string;
}

export interface SoilItem {
  soil_id: number;
  name: string;
  description: string;
}

// ✅ Hook Return Type Interface
export interface UseFieldAssessmentReturn {
  saving: boolean;
  uploading: boolean;
  handleSave: (data: any, submit?: boolean) => Promise<boolean>;
  uploadImage: (currentAssessmentId: string | number) => Promise<boolean>;
  deleteImage: (imageId: number) => Promise<boolean>;
  fetchAssessmentData: () => Promise<AssessmentResponse | null>;
  fetchSoils: () => Promise<SoilItem[]>;
}

// ─────────────────────────────────────────────
// Main Hook
// ─────────────────────────────────────────────

export const useFieldAssessment = (
  areaId: string,
  layerId: string,
  assessmentId?: string,
  onRefresh?: () => void,
): UseFieldAssessmentReturn => {
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  /**
   * 1. SAVE DRAFT OR SUBMIT
   */
  const handleSave = async (
    data: any,
    submit: boolean = false,
  ): Promise<boolean> => {
    setSaving(true);
    try {
      const token = await SecureStore.getItemAsync("token");
      if (!token) throw new Error("Authentication token missing");

      const payload = {
        reforestation_area_id: parseInt(areaId),
        layer: layerId,
        assessment_date:
          data.assessment_date || new Date().toISOString().split("T")[0],
        location: data.location || null,
        field_assessment_data: data, // ✅ FIXED: Added colon ':'
      };

      const isEdit = !!assessmentId;
      const url = isEdit
        ? `${API_BASE}/field_assessments/${assessmentId}/update/`
        : `${API_BASE}/field_assessments/create/`;

      const method = isEdit ? "PUT" : "POST";

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
        const savedId = resData.field_assessment_id || assessmentId;

        if (submit && savedId) {
          return await handleSubmit(savedId, token);
        } else {
          Alert.alert("Success", isEdit ? "Draft updated." : "Draft saved.");
          if (onRefresh) onRefresh();
          return true;
        }
      } else {
        Alert.alert("Error", resData.error || "Failed to save assessment.");
        return false;
      }
    } catch (error: any) {
      console.error("Save Error:", error);
      Alert.alert("Network Error", "Could not connect to server.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  /**
   * Helper: Submits (locks) the assessment
   */
  const handleSubmit = async (id: number, token: string): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE}/field_assessments/${id}/submit/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        Alert.alert("Success", "Assessment submitted to GIS Specialist!");
        if (onRefresh) onRefresh();
        return true;
      } else {
        const errData = await res.json().catch(() => ({}));
        Alert.alert("Submit Failed", errData.error || "Could not submit.");
        return false;
      }
    } catch (err) {
      Alert.alert("Error", "Network error during submission.");
      return false;
    }
  };

  /**
   * 2. UPLOAD IMAGE
   */
  const uploadImage = async (
    currentAssessmentId: string | number,
  ): Promise<boolean> => {
    if (!currentAssessmentId) {
      Alert.alert(
        "Action Required",
        "Please save the draft first to enable image uploads.",
      );
      return false;
    }

    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.status !== "granted") {
      Alert.alert("Permission Denied", "Please allow access to photos.");
      return false;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]) return false;

    setUploading(true);
    try {
      const token = await SecureStore.getItemAsync("token");
      const formData = new FormData();

      // @ts-ignore - React Native FormData type definition issue
      formData.append("image", {
        uri: result.assets[0].uri,
        name: `field_photo_${Date.now()}.jpg`,
        type: "image/jpeg",
      });

      formData.append("caption", "Field assessment photo");
      formData.append("layer", layerId);

      const res = await fetch(
        `${API_BASE}/field_assessments/${currentAssessmentId}/images/upload/`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        },
      );

      if (res.ok) {
        Alert.alert("Success", "Photo uploaded.");
        if (onRefresh) onRefresh();
        return true;
      } else {
        const err = await res.json().catch(() => ({}));
        Alert.alert("Upload Failed", err.error || "Server error.");
        return false;
      }
    } catch (error) {
      Alert.alert("Error", "Failed to upload image.");
      return false;
    } finally {
      setUploading(false);
    }
  };

  /**
   * 3. DELETE IMAGE
   */
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
        if (onRefresh) onRefresh();
        return true;
      } else {
        Alert.alert("Error", "Failed to delete image.");
        return false;
      }
    } catch (error) {
      Alert.alert("Error", "Network error deleting image.");
      return false;
    }
  };

  /**
   * 4. FETCH ASSESSMENT DATA
   */
  const fetchAssessmentData = async (): Promise<AssessmentResponse | null> => {
    if (!assessmentId) return null;

    try {
      const token = await SecureStore.getItemAsync("token");
      if (!token) throw new Error("Authentication token missing");

      const res = await fetch(
        `${API_BASE}/field_assessments/${assessmentId}/`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (res.ok) {
        return await res.json();
      } else {
        const err = await res.json().catch(() => ({}));
        Alert.alert("Error", err.error || "Failed to fetch assessment");
        return null;
      }
    } catch (error: any) {
      console.error("Fetch assessment error:", error);
      Alert.alert("Error", "Network error while loading assessment");
      return null;
    }
  };

  /**
   * 5. FETCH SOILS (For Survivability Form)
   */
  const fetchSoils = async (): Promise<SoilItem[]> => {
    try {
      const token = await SecureStore.getItemAsync("token");
      const res = await fetch(`${API_BASE}/soils/list/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) return await res.json();
      return [];
    } catch (e) {
      return [];
    }
  };

  // ✅ Return ALL functions
  return {
    saving,
    uploading,
    handleSave,
    uploadImage,
    deleteImage,
    fetchAssessmentData,
    fetchSoils,
  };
};
