// services/GeofencingService.ts

import * as Location from "expo-location";
import PolygonStorageService from "./PolygonStorageService";
import {
  PolygonAlert,
  ClassifiedPolygon,
  HazardPolygon,
} from "@/types/polygon.types";

type AlertCallback = (alerts: PolygonAlert[]) => void;

class GeofencingService {
  private subscription: Location.LocationSubscription | null = null;
  private isRunning = false;
  private callback: AlertCallback | null = null;
  private lastLocation: { lat: number; lng: number } | null = null;
  private activeAlertIds: Set<string> = new Set();

  // ============ POINT-IN-POLYGON (Ray Casting Algorithm) ============
  pointInPolygon(lat: number, lng: number, polygon: number[][]): boolean {
    if (!polygon || polygon.length < 3) {
      console.warn("Invalid polygon data: less than 3 points");
      return false;
    }

    let inside = false;
    const n = polygon.length;

    // Ray casting algorithm
    // polygon[i][0] = latitude (Y)
    // polygon[i][1] = longitude (X)
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const yi = polygon[i][0]; // latitude
      const xi = polygon[i][1]; // longitude
      const yj = polygon[j][0]; // latitude
      const xj = polygon[j][1]; // longitude

      const intersect =
        yi > lat !== yj > lat &&
        lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;

      if (intersect) inside = !inside;
    }

    return inside;
  }

  // ============ EXTRACT 2D COORDINATES FROM 3D GEOJSON ============
  extractCoordinates(coords: any): number[][] {
    console.log(
      "🔍 Extracting coordinates from:",
      typeof coords,
      Array.isArray(coords),
    );

    if (!coords) {
      console.warn("❌ Coordinates is null/undefined");
      return [];
    }

    // If coords is a GeoJSON object (has type and coordinates properties)
    if (typeof coords === "object" && !Array.isArray(coords)) {
      console.log("✅ GeoJSON object detected, extracting .coordinates");
      if (coords.coordinates) {
        return this.extractCoordinates(coords.coordinates);
      }
      return [];
    }

    // If it's already 2D (flat array of points)
    if (
      Array.isArray(coords) &&
      coords.length > 0 &&
      Array.isArray(coords[0]) &&
      typeof coords[0][0] === "number"
    ) {
      console.log("✅ Already 2D array");
      return coords as number[][];
    }

    // If it's 3D (GeoJSON format), extract the first ring
    if (
      Array.isArray(coords) &&
      coords.length > 0 &&
      Array.isArray(coords[0]) &&
      Array.isArray(coords[0][0])
    ) {
      console.log("✅ 3D array, extracting first ring");
      return coords[0];
    }

    console.warn("❌ Unable to extract coordinates");
    return [];
  }

  // ============ CHECK LOCATION AGAINST POLYGONS ============
  async checkLocation(lat: number, lng: number): Promise<PolygonAlert[]> {
    const alerts: PolygonAlert[] = [];

    try {
      const [classified, hazards] = await Promise.all([
        PolygonStorageService.loadClassifiedPolygons(),
        PolygonStorageService.loadHazardPolygons(),
      ]);

      console.log(`🔍 CHECKING LOCATION: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
      console.log(
        `📊 Loaded ${classified.length} classified, ${hazards.length} hazards`,
      );

      // Check classified polygons
      for (const poly of classified) {
        try {
          // Extract 2D coordinates from 3D GeoJSON
          const coords2D = this.extractCoordinates(poly.coordinates);

          console.log(`\n📍 Checking classified: ${poly.name}`);
          console.log(
            `   Original coords (3D): ${JSON.stringify(poly.coordinates?.[0]?.slice(0, 2))}`,
          );
          console.log(
            `   Extracted coords (2D): ${JSON.stringify(coords2D?.slice(0, 2))}`,
          );

          if (coords2D.length === 0) {
            console.warn(`   ⚠️ No valid coordinates found for ${poly.name}`);
            continue;
          }

          const isInside = this.pointInPolygon(lat, lng, coords2D);
          console.log(`   Inside? ${isInside}`);

          if (isInside) {
            console.log(`   ✅ INSIDE! Creating alert...`);
            alerts.push({
              type: "CLASSIFIED",
              id: poly.id,
              name: poly.name,
              classification: poly.classification,
              severity: "INFO",
              message: `📍 Classified Area: ${poly.name} (${poly.classification})`,
              timestamp: new Date().toISOString(),
              isActive: true,
              coordinates: poly.coordinates, // Store original 3D coordinates
            });
          }
        } catch (e) {
          console.warn(`Error checking classified polygon ${poly.id}:`, e);
        }
      }

      // Check hazard polygons
      for (const poly of hazards) {
        try {
          // Extract 2D coordinates from 3D GeoJSON
          const coords2D = this.extractCoordinates(poly.coordinates);

          console.log(`\n⚠️ Checking hazard: ${poly.name}`);
          console.log(
            `   Original coords (3D): ${JSON.stringify(poly.coordinates?.[0]?.slice(0, 2))}`,
          );
          console.log(
            `   Extracted coords (2D): ${JSON.stringify(coords2D?.slice(0, 2))}`,
          );

          if (coords2D.length === 0) {
            console.warn(`   ⚠️ No valid coordinates found for ${poly.name}`);
            continue;
          }

          const isInside = this.pointInPolygon(lat, lng, coords2D);
          console.log(`   Inside? ${isInside}`);

          if (isInside) {
            console.log(`   ✅ INSIDE! Creating alert...`);
            const severityEmoji =
              poly.severity === "HIGH"
                ? "🔴"
                : poly.severity === "MEDIUM"
                  ? "🟡"
                  : "🟢";
            alerts.push({
              type: "HAZARD",
              id: poly.id,
              name: poly.name,
              hazardType: poly.hazard_type,
              severity: poly.severity,
              message: `${severityEmoji} ⚠️ ${poly.severity} ${poly.hazard_type} Zone: ${poly.name}`,
              timestamp: new Date().toISOString(),
              isActive: true,
              coordinates: poly.coordinates, // Store original 3D coordinates
            });
          }
        } catch (e) {
          console.warn(`Error checking hazard polygon ${poly.id}:`, e);
        }
      }

      console.log(`\n🔔 Total alerts: ${alerts.length}`);

      // Save active alerts to history
      if (alerts.length > 0) {
        for (const alert of alerts) {
          const alertId = `${alert.type}_${alert.id}`;
          if (!this.activeAlertIds.has(alertId)) {
            this.activeAlertIds.add(alertId);
            await PolygonStorageService.addAlertToHistory(alert);
          }
        }
      }

      // Check for cleared alerts
      const currentAlertIds = new Set(alerts.map((a) => `${a.type}_${a.id}`));
      for (const activeId of this.activeAlertIds) {
        if (!currentAlertIds.has(activeId)) {
          this.activeAlertIds.delete(activeId);
        }
      }
    } catch (error) {
      console.error("Failed to check polygons:", error);
    }

    return alerts;
  }

  // ============ START GEOFENCING ============
  async startGeofencing(onAlert: AlertCallback): Promise<void> {
    if (this.isRunning) {
      console.warn("Geofencing already running");
      return;
    }

    // Check if polygons exist
    const hasPolygons = await PolygonStorageService.hasPolygons();
    if (!hasPolygons) {
      console.warn("No polygons downloaded. Please download polygons first.");
      return;
    }

    this.callback = onAlert;
    this.isRunning = true;
    this.activeAlertIds = new Set();

    console.log("🚀 Starting geofencing service...");

    // Get initial location and check
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const { latitude, longitude } = loc.coords;
      this.lastLocation = { lat: latitude, lng: longitude };

      console.log(
        `📍 Initial location: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
      );
      const alerts = await this.checkLocation(latitude, longitude);
      console.log(`🔔 Initial alerts: ${alerts.length}`);

      if (alerts.length > 0 && this.callback) {
        this.callback(alerts);
      }
    } catch (error) {
      console.error("Failed to get initial location:", error);
    }

    // Start watching position
    this.subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 5000,
        distanceInterval: 10,
      },
      async (location) => {
        const { latitude, longitude } = location.coords;
        this.lastLocation = { lat: latitude, lng: longitude };

        const alerts = await this.checkLocation(latitude, longitude);
        if (this.callback) {
          this.callback(alerts);
        }
      },
    );

    console.log("✅ Geofencing service started successfully");
  }

  // ============ STOP GEOFENCING ============
  async stopGeofencing(): Promise<void> {
    if (this.subscription) {
      await this.subscription.remove();
      this.subscription = null;
    }
    this.isRunning = false;
    this.callback = null;
    this.activeAlertIds = new Set();
    console.log("⏹️ Geofencing service stopped");
  }

  // ============ CHECK IF RUNNING ============
  isGeofencingRunning(): boolean {
    return this.isRunning;
  }

  // ============ GET LAST LOCATION ============
  getLastLocation(): { lat: number; lng: number } | null {
    return this.lastLocation;
  }
}

export default new GeofencingService();
