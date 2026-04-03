import { useState } from "react";
import * as SecureStore from "expo-secure-store";
import { api } from "@/constants/url_fixed";
import * as ImagePicker from "expo-image-picker";
import { Alert } from "react-native";

const API = api + "/api";

export interface AssessmentDetails {
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

export interface AssessmentImage {
  image_id: number;
  url: string;
  caption: string;
  created_at: string;
}

export interface AssessmentResponse {
  field_assessment_id: number;
  site_id: number | null;
  site_name: string;
  reforestation_area_id: number;
  type: string;
  title: string;
  description: string;
  data: any; // The field_assessment_data JSON
  is_sent: boolean;
  created_at: string;
  updated_at: string;
  details: AssessmentDetails[];
  images: AssessmentImage[];
  image_count: number;
}

export const useFieldAssessment = (
  areaId: string,
  layerId: string,
  assessmentId?: string,
  siteId?: number | null,
  onRefresh?: () => void,
) => {
  const [saving, setSaving] = useState(false);

  // 1. Save Draft or Submit
  const handleSave = async (data: any, submit: boolean = false) => {
    setSaving(true);
    try {
      const token = await SecureStore.getItemAsync("token");
      const payload = {
        reforestation_area_id: parseInt(areaId),
        site_id: siteId || null,
        multicriteria_type: layerId,
        title: `${layerId} Assessment`,
        description: "Mobile entry",
        field_assessment_data: data,
      };

      const isEdit = !!assessmentId;
      const url = isEdit
        ? `${API}/update_field_assessment/${assessmentId}/`
        : `${API}/create_field_assessment/`;

      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();

      if (res.ok) {
        const newId = resData.field_assessment_id || assessmentId;

        if (submit) {
          const subRes = await fetch(
            `${API}/update_field_assessment_is_sent/${newId}/`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ is_sent: true }),
            },
          );
          if (subRes.ok) {
            Alert.alert("Success", "Assessment Submitted!");
            if (onRefresh) onRefresh();
            return true;
          } else {
            const err = await subRes.json();
            Alert.alert("Error", err.error || "Failed to submit status");
          }
        } else {
          Alert.alert("Saved", "Draft saved successfully.");
          return true;
        }
      } else {
        Alert.alert("Error", resData.error || "Save failed");
      }
    } catch (err) {
      Alert.alert("Error", "Network error while saving");
    } finally {
      setSaving(false);
    }
    return false;
  };

  // 2. Upload Image
  const uploadImage = async (currentAssessmentId: string) => {
    if (!currentAssessmentId) {
      Alert.alert("Error", "Please save the draft first to get an ID.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const token = await SecureStore.getItemAsync("token");
      const formDataImg = new FormData();
      // @ts-ignore - FormData accepts this format in React Native
      formDataImg.append("image", {
        uri: result.assets[0].uri,
        name: `photo_${Date.now()}.jpg`,
        type: "image/jpeg",
      });
      formDataImg.append("caption", "Field photo");

      try {
        const res = await fetch(
          `${API}/upload_field_assessment_image/${currentAssessmentId}/`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: formDataImg,
          },
        );
        if (res.ok) {
          Alert.alert("Success", "Image uploaded!");
          if (onRefresh) onRefresh(); // Refresh parent list
          return true;
        } else {
          const err = await res.json();
          Alert.alert("Error", err.error || "Upload failed");
        }
      } catch (e) {
        Alert.alert("Error", "Network error during upload");
      }
    }
    return false;
  };

  // 3. Fetch Full Assessment Data (including details & images)
  const fetchAssessmentData = async (): Promise<AssessmentResponse | null> => {
    if (!assessmentId) return null;

    try {
      const token = await SecureStore.getItemAsync("token");
      const res = await fetch(`${API}/get_field_assessment/${assessmentId}/`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        return await res.json();
      } else {
        const err = await res.json();
        Alert.alert("Error", err.error || "Failed to fetch assessment");
        return null;
      }
    } catch (e) {
      Alert.alert("Error", "Network error while loading assessment");
      return null;
    }
  };

  // 4. Delete Image
  const deleteImage = async (imageId: number): Promise<boolean> => {
    try {
      const token = await SecureStore.getItemAsync("token");
      const res = await fetch(
        `${API}/delete_field_assessment_image/${imageId}/`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (res.ok) {
        Alert.alert("Success", "Image deleted");
        if (onRefresh) onRefresh();
        return true;
      } else {
        const err = await res.json();
        Alert.alert("Error", err.error || "Failed to delete image");
        return false;
      }
    } catch (e) {
      Alert.alert("Error", "Network error while deleting image");
      return false;
    }
  };

  return {
    saving,
    handleSave,
    uploadImage,
    fetchAssessmentData,
    deleteImage,
  };
};
