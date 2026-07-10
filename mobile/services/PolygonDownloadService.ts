// services/PolygonDownloadService.ts

import * as SecureStore from 'expo-secure-store';
import { api } from '@/constants/url_fixed';
import PolygonStorageService from './PolygonStorageService';
import { DownloadProgress, PolygonDownloadOptions, ClassifiedPolygon, HazardPolygon } from '@/types/polygon.types';

const API_BASE_URL = api + '/api';

const DEFAULT_MAX_POLYGONS = 300;
const DEFAULT_MAX_SIZE_MB = 10;

class PolygonDownloadService {
  // ============================================================
  // Download with filtering and limits
  // ============================================================
  async downloadPolygonsFiltered(
    options: Partial<PolygonDownloadOptions>,
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<{ classified: number; hazard: number; totalSize: number }> {
    const token = await SecureStore.getItemAsync('token');
    if (!token) {
      throw new Error('No authentication token');
    }

    const headers = { Authorization: `Bearer ${token}` };
    
    const config: PolygonDownloadOptions = {
      maxPolygons: options.maxPolygons || DEFAULT_MAX_POLYGONS,
      maxSizeMB: options.maxSizeMB || DEFAULT_MAX_SIZE_MB,
      barangayIds: options.barangayIds || [],
      hazardTypes: options.hazardTypes || [],
      classifications: options.classifications || [],
      minSeverity: options.minSeverity || 'LOW',
    };

    onProgress?.({ current: 5, total: 100, status: 'Fetching polygons from server...', phase: 'fetching' });

    // STEP 1: Fetch all polygons
    const [classifiedRes, hazardRes] = await Promise.all([
      fetch(`${API_BASE_URL}/get_all_classified_polygons/`, { headers }),
      fetch(`${API_BASE_URL}/get_all_hazard_polygons/`, { headers }),
    ]);

    if (!classifiedRes.ok || !hazardRes.ok) {
      throw new Error('Failed to fetch polygon data');
    }

    const classifiedData = await classifiedRes.json();
    const hazardData = await hazardRes.json();

    onProgress?.({ current: 30, total: 100, status: 'Filtering polygons...', phase: 'filtering' });

    // STEP 2: Filter classified polygons
    let classified = classifiedData.data || [];
    if (config.barangayIds && config.barangayIds.length > 0) {
      classified = classified.filter((p: any) => 
        config.barangayIds!.includes(p.barangay_id)
      );
    }
    if (config.classifications && config.classifications.length > 0) {
      classified = classified.filter((p: any) =>
        config.classifications!.includes(p.classification)
      );
    }

    // STEP 3: Filter hazard polygons
    let hazards = hazardData.data || [];
    if (config.barangayIds && config.barangayIds.length > 0) {
      hazards = hazards.filter((p: any) =>
        config.barangayIds!.includes(p.barangay_id)
      );
    }
    if (config.hazardTypes && config.hazardTypes.length > 0) {
      hazards = hazards.filter((p: any) =>
        config.hazardTypes!.includes(p.hazard_type)
      );
    }
    if (config.minSeverity) {
      const severityRank = { LOW: 0, MEDIUM: 1, HIGH: 2 };
      const minRank = severityRank[config.minSeverity] || 0;
      hazards = hazards.filter((p: any) =>
        severityRank[p.severity] >= minRank
      );
    }

    // STEP 4: Apply polygon count limit
    const totalPolygons = classified.length + hazards.length;
    if (totalPolygons > config.maxPolygons) {
      const classifiedToKeep = Math.floor(config.maxPolygons * (classified.length / totalPolygons));
      const hazardToKeep = config.maxPolygons - classifiedToKeep;
      
      classified = classified.slice(0, classifiedToKeep);
      hazards = hazards.slice(0, hazardToKeep);
    }

    onProgress?.({ current: 60, total: 100, status: 'Calculating size...', phase: 'filtering' });

    // STEP 5: Check size limits
    const classifiedSize = new Blob([JSON.stringify(classified)]).size;
    const hazardSize = new Blob([JSON.stringify(hazards)]).size;
    const totalSize = classifiedSize + hazardSize;
    const maxSizeBytes = config.maxSizeMB * 1024 * 1024;

    if (totalSize > maxSizeBytes) {
      const reductionFactor = maxSizeBytes / totalSize;
      const targetTotal = Math.floor(totalPolygons * reductionFactor);
      
      if (targetTotal < 10) {
        throw new Error(`Cannot fit polygons within ${config.maxSizeMB}MB limit. Please reduce the area or increase limit.`);
      }

      const classifiedToKeep = Math.floor(targetTotal * (classified.length / totalPolygons));
      const hazardToKeep = targetTotal - classifiedToKeep;
      
      classified = classified.slice(0, classifiedToKeep);
      hazards = hazards.slice(0, hazardToKeep);
    }

    onProgress?.({ current: 80, total: 100, status: 'Saving to device...', phase: 'saving' });

    // STEP 6: Save to local storage
    await PolygonStorageService.saveClassifiedPolygons(classified);
    await PolygonStorageService.saveHazardPolygons(hazards);

    onProgress?.({ current: 100, total: 100, status: '✅ Download complete!', phase: 'complete' });

    return {
      classified: classified.length,
      hazard: hazards.length,
      totalSize: new Blob([JSON.stringify([...classified, ...hazards])]).size,
    };
  }

  // ============================================================
  // Download for specific barangay
  // ============================================================
  async downloadForBarangay(
    barangayIds: number[],
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<{ classified: number; hazard: number; totalSize: number }> {
    return this.downloadPolygonsFiltered(
      {
        barangayIds,
        maxPolygons: 100,
        maxSizeMB: 3,
      },
      onProgress
    );
  }

  // ============================================================
  // Download high priority hazards only
  // ============================================================
  async downloadHighPriority(
    barangayIds?: number[],
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<{ classified: number; hazard: number; totalSize: number }> {
    return this.downloadPolygonsFiltered(
      {
        barangayIds: barangayIds || [],
        maxPolygons: 50,
        maxSizeMB: 2,
        minSeverity: 'HIGH',
        hazardTypes: ['FLOOD', 'LANDSLIDE'],
      },
      onProgress
    );
  }

  // ============================================================
  // Simple download with defaults
  // ============================================================
  async downloadPolygons(
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<{ classified: number; hazard: number }> {
    const result = await this.downloadPolygonsFiltered(
      {
        maxPolygons: DEFAULT_MAX_POLYGONS,
        maxSizeMB: DEFAULT_MAX_SIZE_MB,
      },
      onProgress
    );
    return {
      classified: result.classified,
      hazard: result.hazard,
    };
  }

  async hasPolygons(): Promise<boolean> {
    return await PolygonStorageService.hasPolygons();
  }

  async getStorageInfo() {
    return await PolygonStorageService.getStorageInfo();
  }

  async deleteAllPolygons(): Promise<void> {
    await PolygonStorageService.deleteAllPolygons();
  }

  formatSize(bytes: number): string {
    return PolygonStorageService.formatSize(bytes);
  }
}

export default new PolygonDownloadService();