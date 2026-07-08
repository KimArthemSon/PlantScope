import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";

import { Alert } from "react-native";

const OFFLINE_DRAFTS_KEY = "@plantscope_offline_drafts";
const OFFLINE_IMAGES_DIR = FileSystem.documentDirectory + "offline_images/";

export interface OfflineImage {
  id: string;
  uri: string;
  layerCode: string;
  description: string;
  latitude?: number;
  longitude?: number;
}

export interface OfflineDraft {
  local_uuid: string;
  area_id: number;
  site_id: number | null;
  layer: string;
  payload: any;
  images: OfflineImage[];
  created_at: string;
  status: "pending" | "syncing" | "synced" | "failed";
  sync_error?: string;
}

// Ensure offline images directory exists
export const ensureOfflineImagesDir = async () => {
  try {
    const dirInfo = await FileSystem.getInfoAsync(OFFLINE_IMAGES_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(OFFLINE_IMAGES_DIR, {
        intermediates: true,
      });
    }
  } catch (error) {
    console.error("Error creating offline images directory:", error);
  }
};

// Save draft to AsyncStorage
export const saveOfflineDraft = async (draft: OfflineDraft): Promise<void> => {
  try {
    await ensureOfflineImagesDir();

    // Copy images to persistent storage
    const persistentImages: OfflineImage[] = [];
    for (const img of draft.images) {
      const fileName = `${draft.local_uuid}_${img.id}.jpg`;
      const destUri = OFFLINE_IMAGES_DIR + fileName;

      try {
        const srcInfo = await FileSystem.getInfoAsync(img.uri);
        if (srcInfo.exists) {
          await FileSystem.copyAsync({ from: img.uri, to: destUri });
          persistentImages.push({ ...img, uri: destUri });
        } else {
          persistentImages.push(img);
        }
      } catch (error) {
        console.error("Error copying image:", error);
        persistentImages.push(img);
      }
    }

    const draftToSave = { ...draft, images: persistentImages };

    // Get existing drafts
    const existing = await getOfflineDrafts();
    existing.push(draftToSave);

    // Save back
    await AsyncStorage.setItem(OFFLINE_DRAFTS_KEY, JSON.stringify(existing));
  } catch (error) {
    console.error("Error saving offline draft:", error);
    throw error;
  }
};

// Get all offline drafts
export const getOfflineDrafts = async (): Promise<OfflineDraft[]> => {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_DRAFTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.error("Error getting offline drafts:", error);
    return [];
  }
};

// Get drafts for specific area/site/layer
export const getOfflineDraftsForContext = async (
  areaId: number,
  siteId: number | null,
  layer: string,
): Promise<OfflineDraft[]> => {
  const allDrafts = await getOfflineDrafts();
  return allDrafts.filter(
    (d) =>
      d.area_id === areaId &&
      d.site_id === siteId &&
      d.layer === layer &&
      d.status !== "synced",
  );
};

// Delete offline draft
export const deleteOfflineDraft = async (local_uuid: string): Promise<void> => {
  try {
    const drafts = await getOfflineDrafts();
    const draftToDelete = drafts.find((d) => d.local_uuid === local_uuid);

    // Delete local image files
    if (draftToDelete) {
      for (const img of draftToDelete.images) {
        try {
          await FileSystem.deleteAsync(img.uri, { idempotent: true });
        } catch (e) {
          console.error("Error deleting local image:", e);
        }
      }
    }

    const remaining = drafts.filter((d) => d.local_uuid !== local_uuid);
    await AsyncStorage.setItem(OFFLINE_DRAFTS_KEY, JSON.stringify(remaining));
  } catch (error) {
    console.error("Error deleting offline draft:", error);
    throw error;
  }
};

// Update draft status
export const updateDraftStatus = async (
  local_uuid: string,
  status: OfflineDraft["status"],
  sync_error?: string,
): Promise<void> => {
  try {
    const drafts = await getOfflineDrafts();
    const updated = drafts.map((d) =>
      d.local_uuid === local_uuid
        ? { ...d, status, sync_error: sync_error || d.sync_error }
        : d,
    );
    await AsyncStorage.setItem(OFFLINE_DRAFTS_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error("Error updating draft status:", error);
    throw error;
  }
};

// Get count of pending drafts
export const getPendingDraftsCount = async (): Promise<number> => {
  const drafts = await getOfflineDrafts();
  return drafts.filter((d) => d.status === "pending").length;
};

// Generate unique local UUID
export const generateLocalUUID = (): string => {
  return `draft-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Update an existing draft (replaces it) - ✅ FIXED VERSION
export const updateOfflineDraft = async (
  localUuid: string,
  updatedData: Partial<OfflineDraft>,
): Promise<void> => {
  try {
    await ensureOfflineImagesDir();

    const drafts = await getOfflineDrafts();

    // ✅ If images are being updated, copy them to persistent storage
    let processedImages = updatedData.images;
    if (updatedData.images) {
      processedImages = [];
      for (const img of updatedData.images) {
        // Check if image is already in persistent storage
        if (img.uri.includes("offline_images/")) {
          // Already persistent, keep as is
          processedImages.push(img);
        } else {
          // New image, copy to persistent storage
          const fileName = `${localUuid}_${img.id}.jpg`;
          const destUri = OFFLINE_IMAGES_DIR + fileName;

          try {
            const srcInfo = await FileSystem.getInfoAsync(img.uri);
            if (srcInfo.exists) {
              await FileSystem.copyAsync({ from: img.uri, to: destUri });
              processedImages.push({ ...img, uri: destUri });
            } else {
              processedImages.push(img);
            }
          } catch (error) {
            console.error("Error copying image during update:", error);
            processedImages.push(img);
          }
        }
      }
    }

    const updated = drafts.map((d) => {
      if (d.local_uuid === localUuid) {
        return {
          ...d,
          ...updatedData,
          images: processedImages || d.images,
        };
      }
      return d;
    });

    await AsyncStorage.setItem(OFFLINE_DRAFTS_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error("Error updating offline draft:", error);
    throw error;
  }
};

export const getOfflineDraft = async (
  localUuid: string,
): Promise<OfflineDraft | null> => {
  try {
    const drafts = await getOfflineDrafts();
    return drafts.find((d) => d.local_uuid === localUuid) || null;
  } catch (error) {
    console.error("Error getting offline draft:", error);
    return null;
  }
};
