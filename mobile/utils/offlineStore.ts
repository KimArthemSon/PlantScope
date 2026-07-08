import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

const DRAFTS_KEY = '@plantscope_offline_drafts';
const IMAGES_DIR = FileSystem.documentDirectory + 'offline_assessment_images/';

export interface OfflineImage {
  local_id: string;
  local_uri: string;
  layer_code: string;
  lat: number;
  lng: number;
  description: string;
}

export interface OfflineDraft {
  local_uuid: string;
  area_id: number;
  area_name: string;
  site_id: number | null;
  site_name: string | null;
  layer: string;
  payload: any;
  images: OfflineImage[];
  created_at: string;
}

export const ensureOfflineDir = async () => {
  const dirInfo = await FileSystem.getInfoAsync(IMAGES_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(IMAGES_DIR, { intermediates: true });
  }
};

export const saveOfflineDraft = async (draft: OfflineDraft) => {
  await ensureOfflineDir();
  
  const persistentImages: OfflineImage[] = [];
  for (const img of draft.images) {
    const fileName = `${draft.local_uuid}_${img.local_id}.jpg`;
    const destUri = IMAGES_DIR + fileName;
    
    try {
      const srcInfo = await FileSystem.getInfoAsync(img.local_uri);
      if (srcInfo.exists) {
        await FileSystem.copyAsync({ from: img.local_uri, to: destUri });
        persistentImages.push({ ...img, local_uri: destUri });
      } else {
        persistentImages.push(img);
      }
    } catch (error) {
      console.error('Error copying image for offline storage:', error);
      persistentImages.push(img);
    }
  }

  const draftToSave = { ...draft, images: persistentImages };
  const existingDrafts = await getOfflineDrafts();
  existingDrafts.push(draftToSave);
  
  await AsyncStorage.setItem(DRAFTS_KEY, JSON.stringify(existingDrafts));
};

export const getOfflineDrafts = async (): Promise<OfflineDraft[]> => {
  const raw = await AsyncStorage.getItem(DRAFTS_KEY);
  return raw ? JSON.parse(raw) : [];
};

export const deleteOfflineDraft = async (local_uuid: string) => {
  const drafts = await getOfflineDrafts();
  const draftToDelete = drafts.find(d => d.local_uuid === local_uuid);

  if (draftToDelete) {
    for (const img of draftToDelete.images) {
      try {
        await FileSystem.deleteAsync(img.local_uri, { idempotent: true });
      } catch (e) {
        console.error('Error deleting local image:', e);
      }
    }
  }

  const remainingDrafts = drafts.filter(d => d.local_uuid !== local_uuid);
  await AsyncStorage.setItem(DRAFTS_KEY, JSON.stringify(remainingDrafts));
};

export const getOfflineDraftCount = async (): Promise<number> => {
  const drafts = await getOfflineDrafts();
  return drafts.length;
};