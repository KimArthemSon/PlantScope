// types/polygon.types.ts

export interface ClassifiedPolygon {
  id: number;
  name: string;
  classification: string;
  barangay_id: number;
  coordinates: number[][][];
  color: string;
  description?: string;
  downloadedAt?: string;
}

export interface HazardPolygon {
  id: number;
  name: string;
  hazard_type: 'FLOOD' | 'LANDSLIDE' | 'EARTHQUAKE';
  barangay_id: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  coordinates: number[][][];
  color: string;
  downloadedAt?: string;
}

export interface PolygonAlert {
  type: 'CLASSIFIED' | 'HAZARD';
  id: number;
  name: string;
  classification?: string;
  hazardType?: string;
  severity?: string;
  message: string;
  timestamp: string;
  isActive: boolean;
  coordinates?: number[][][]; // ✅ ADD THIS - Store original coordinates
}

export interface PolygonStorageInfo {
  classifiedCount: number;
  hazardCount: number;
  lastUpdated: string | null;
  totalSize: number;
  maxSize: number;
}

export interface DownloadProgress {
  current: number;
  total: number;
  status: string;
  phase: 'fetching' | 'filtering' | 'saving' | 'complete';
}

export interface PolygonDownloadOptions {
  maxPolygons: number;
  maxSizeMB: number;
  barangayIds?: number[];
  hazardTypes?: string[];
  classifications?: string[];
  minSeverity?: 'LOW' | 'MEDIUM' | 'HIGH';
}