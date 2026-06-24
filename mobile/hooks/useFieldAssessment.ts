import { useState } from "react";
import * as SecureStore from "expo-secure-store";
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
  land_classification?: { id: number; name: string } | null;
  animals_present?: { animal_id: number; name: string; scientific_name: string }[];
}

export interface LocalImage {
  id: string;
  uri: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  subLayerCode?: string;
  description?: string;
}

export interface UseFieldAssessmentReturn {
  saving: boolean;
  uploading: boolean;
  handleSave: (data: any, submit?: boolean, localImages?: LocalImage[]) => Promise<number | null>;
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
  siteId?: string,
  onRefresh?: () => void,
): UseFieldAssessmentReturn => {
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleSave = async (
    payload: any,
    submit: boolean = false,
    localImages: LocalImage[] = [],
  ): Promise<number | null> => {
    setSaving(true);
    try {
      const token = await SecureStore.getItemAsync("token");
      if (!token) throw new Error("Authentication token missing");

      const isEdit = !!assessmentId;
      const url = isEdit
        ? `${API_BASE}/field_assessments/${assessmentId}/update/`
        : `${API_BASE}/field_assessments/create/`;

      let res;
      let savedId: number | string | null = null;

      // If we have local images, use multipart upload
      if (localImages.length > 0) {
        const formData = new FormData();

        // Append all payload fields
        if (payload.reforestation_area_id != null) {
          formData.append("reforestation_area_id", payload.reforestation_area_id.toString());
        }
        if (payload.site_id != null) {
          formData.append("site_id", payload.site_id.toString());
        }
        if (payload.assessment_date) {
          formData.append("assessment_date", payload.assessment_date);
        }
        if (payload.location) {
          formData.append("location", JSON.stringify(payload.location));
        }
        if (payload.land_classification_id != null) {
          formData.append("land_classification_id", payload.land_classification_id.toString());
        }
        if (payload.animal_ids && Array.isArray(payload.animal_ids)) {
          formData.append("animal_ids", JSON.stringify(payload.animal_ids));
        }
        if (payload.field_assessment_data) {
          formData.append("field_assessment_data", JSON.stringify(payload.field_assessment_data));
        }

        // Append images
        localImages.forEach((img, index) => {
          const fileName = `geocam_${Date.now()}_${index}.jpg`;
          // @ts-ignore - React Native FormData accepts this format
          formData.append("images", {
            uri: img.uri,
            name: fileName,
            type: "image/jpeg",
          });
        });

        // Append image metadata as JSON array
        const imageMetadata = localImages.map((img) => ({
          layer: getStrictLayerCode(layerId, img.subLayerCode),
          description: img.description || `Photo at ${img.latitude.toFixed(6)}, ${img.longitude.toFixed(6)}`,
          latitude: img.latitude,
          longitude: img.longitude,
        }));
        formData.append("image_metadata", JSON.stringify(imageMetadata));

        res = await fetch(url, {
          method: isEdit ? "PUT" : "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            // Don't set Content-Type - React Native sets it automatically for FormData
          },
          body: formData,
        });
      } else {
        // JSON-only upload (no images)
        res = await fetch(url, {
          method: isEdit ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
      }

      const resData = await res.json();
      if (!res.ok) {
        console.error("❌ [Hook] Backend Error:", resData);
        throw new Error(resData.error || "Failed to save assessment.");
      }

      savedId = resData.field_assessment_id || assessmentId;

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
          return savedId as number;
        }
        const err = await subRes.json().catch(() => ({}));
        throw new Error(err.error || "Submission failed.");
      }

      Alert.alert("Saved", isEdit ? "Draft updated." : "Draft saved.");
      onRefresh?.();
      return savedId as number;
    } catch (error: any) {
      console.error("Save Error:", error);
      Alert.alert("Error", error.message || "Network error while saving.");
      return null;
    } finally {
      setSaving(false);
    }
  };

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
      formData.append("layer", layerCode);
      formData.append("latitude", photoData.latitude.toString());
      formData.append("longitude", photoData.longitude.toString());

      if (photoData.accuracy != null) {
        formData.append("gps_accuracy", photoData.accuracy.toString());
      }

      const description =
        options?.description ||
        `Photo at ${photoData.latitude.toFixed(6)}, ${photoData.longitude.toFixed(6)}`;
      formData.append("description", description);

      const uploadUrl = `${API_BASE}/field_assessments/${assessmentId}/images/upload/`;

      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          // Don't set Content-Type - React Native sets it automatically for FormData
        },
        body: formData,
      });

      const responseText = await res.text();

      if (res.ok) {
        const responseData = JSON.parse(responseText);
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