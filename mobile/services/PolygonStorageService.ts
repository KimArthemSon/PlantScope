// services/PolygonStorageService.ts

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from "expo-file-system/legacy";
import { ClassifiedPolygon, HazardPolygon, PolygonStorageInfo } from '@/types/polygon.types';

const STORAGE_KEYS = {
  CLASSIFIED_META: 'polygons_classified_meta',
  HAZARD_META: 'polygons_hazard_meta',
  ALERT_HISTORY: 'polygons_alert_history',
};

const POLYGON_DIR = `${FileSystem.documentDirectory}polygons/`;

// ✅ Default max size (10MB)
const DEFAULT_MAX_SIZE = 10 * 1024 * 1024;

class PolygonStorageService {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const dir = await FileSystem.getInfoAsync(POLYGON_DIR);
      if (!dir.exists) {
        await FileSystem.makeDirectoryAsync(POLYGON_DIR, { intermediates: true });
      }
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize polygon storage:', error);
      throw error;
    }
  }

  // ============ CLASSIFIED POLYGONS ============
  async saveClassifiedPolygons(polygons: ClassifiedPolygon[]): Promise<void> {
    await this.initialize();

    const data = JSON.stringify(polygons);
    const path = `${POLYGON_DIR}classified_polygons.json`;
    await FileSystem.writeAsStringAsync(path, data);

    await AsyncStorage.setItem(STORAGE_KEYS.CLASSIFIED_META, JSON.stringify({
      count: polygons.length,
      lastUpdated: new Date().toISOString(),
      size: data.length,
    }));
  }

  async loadClassifiedPolygons(): Promise<ClassifiedPolygon[]> {
    await this.initialize();

    try {
      const path = `${POLYGON_DIR}classified_polygons.json`;
      const exists = await FileSystem.getInfoAsync(path);
      if (!exists.exists) return [];

      const data = await FileSystem.readAsStringAsync(path);
      const parsed = JSON.parse(data);
      
      if (!Array.isArray(parsed)) {
        console.warn('Classified polygons data is not an array');
        return [];
      }
      
      return parsed;
    } catch (error) {
      console.error('Failed to load classified polygons:', error);
      return [];
    }
  }

  async getClassifiedCount(): Promise<number> {
    const meta = await AsyncStorage.getItem(STORAGE_KEYS.CLASSIFIED_META);
    if (!meta) return 0;
    return JSON.parse(meta).count || 0;
  }

  // ============ HAZARD POLYGONS ============
  async saveHazardPolygons(polygons: HazardPolygon[]): Promise<void> {
    await this.initialize();

    const data = JSON.stringify(polygons);
    const path = `${POLYGON_DIR}hazard_polygons.json`;
    await FileSystem.writeAsStringAsync(path, data);

    await AsyncStorage.setItem(STORAGE_KEYS.HAZARD_META, JSON.stringify({
      count: polygons.length,
      lastUpdated: new Date().toISOString(),
      size: data.length,
    }));
  }

  async loadHazardPolygons(): Promise<HazardPolygon[]> {
    await this.initialize();

    try {
      const path = `${POLYGON_DIR}hazard_polygons.json`;
      const exists = await FileSystem.getInfoAsync(path);
      if (!exists.exists) return [];

      const data = await FileSystem.readAsStringAsync(path);
      const parsed = JSON.parse(data);
      
      if (!Array.isArray(parsed)) {
        console.warn('Hazard polygons data is not an array');
        return [];
      }
      
      return parsed;
    } catch (error) {
      console.error('Failed to load hazard polygons:', error);
      return [];
    }
  }

  async getHazardCount(): Promise<number> {
    const meta = await AsyncStorage.getItem(STORAGE_KEYS.HAZARD_META);
    if (!meta) return 0;
    return JSON.parse(meta).count || 0;
  }

  // ============ STORAGE INFO ============
  async getStorageInfo(): Promise<PolygonStorageInfo> {
    await this.initialize();

    let classifiedCount = 0;
    let hazardCount = 0;
    let lastUpdated: string | null = null;
    let totalSize = 0;

    const classifiedMeta = await AsyncStorage.getItem(STORAGE_KEYS.CLASSIFIED_META);
    if (classifiedMeta) {
      const meta = JSON.parse(classifiedMeta);
      classifiedCount = meta.count || 0;
      lastUpdated = meta.lastUpdated || null;
      totalSize += meta.size || 0;
    }

    const hazardMeta = await AsyncStorage.getItem(STORAGE_KEYS.HAZARD_META);
    if (hazardMeta) {
      const meta = JSON.parse(hazardMeta);
      hazardCount = meta.count || 0;
      if (!lastUpdated) lastUpdated = meta.lastUpdated || null;
      totalSize += meta.size || 0;
    }

    // ✅ Also check actual file sizes
    try {
      const classifiedPath = `${POLYGON_DIR}classified_polygons.json`;
      const classifiedInfo = await FileSystem.getInfoAsync(classifiedPath);
      if (classifiedInfo.exists && classifiedInfo.size) {
        totalSize = Math.max(totalSize, classifiedInfo.size);
      }
      
      const hazardPath = `${POLYGON_DIR}hazard_polygons.json`;
      const hazardInfo = await FileSystem.getInfoAsync(hazardPath);
      if (hazardInfo.exists && hazardInfo.size) {
        totalSize = Math.max(totalSize, hazardInfo.size);
      }
    } catch (error) {
      console.warn('Failed to get file sizes:', error);
    }

    return {
      classifiedCount,
      hazardCount,
      lastUpdated,
      totalSize,
      maxSize: DEFAULT_MAX_SIZE, // ✅ Added: return max size
    };
  }

  // ============ DELETE ============
  async deleteAllPolygons(): Promise<void> {
    await this.initialize();

    await AsyncStorage.removeItem(STORAGE_KEYS.CLASSIFIED_META);
    await AsyncStorage.removeItem(STORAGE_KEYS.HAZARD_META);

    const classifiedPath = `${POLYGON_DIR}classified_polygons.json`;
    const hazardPath = `${POLYGON_DIR}hazard_polygons.json`;

    const c = await FileSystem.getInfoAsync(classifiedPath);
    if (c.exists) await FileSystem.deleteAsync(classifiedPath);

    const h = await FileSystem.getInfoAsync(hazardPath);
    if (h.exists) await FileSystem.deleteAsync(hazardPath);
  }

  // ============ ALERT HISTORY ============
  async saveAlertHistory(alerts: any[]): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.ALERT_HISTORY, JSON.stringify(alerts));
  }

  async loadAlertHistory(): Promise<any[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.ALERT_HISTORY);
      if (!data) return [];
      return JSON.parse(data);
    } catch (error) {
      console.error('Failed to load alert history:', error);
      return [];
    }
  }

  async addAlertToHistory(alert: any): Promise<void> {
    const history = await this.loadAlertHistory();
    const exists = history.some(
      (a) => a.type === alert.type && a.id === alert.id && a.timestamp === alert.timestamp
    );
    if (!exists) {
      history.push({ ...alert, savedAt: new Date().toISOString() });
      await this.saveAlertHistory(history);
    }
  }

  async clearAlertHistory(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEYS.ALERT_HISTORY);
  }

  async hasPolygons(): Promise<boolean> {
    const info = await this.getStorageInfo();
    return info.classifiedCount > 0 || info.hazardCount > 0;
  }

  // ============ FORMAT SIZE ============
  formatSize(bytes: number): string {
    if (bytes === 0) return '0 KB';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  }
}

export default new PolygonStorageService();