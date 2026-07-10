// hooks/usePolygonAlerts.ts

import { useState, useEffect, useCallback, useRef } from 'react';
import { PolygonAlert } from '@/types/polygon.types';
import GeofencingService from '@/services/GeofencingService';
import PolygonStorageService from '@/services/PolygonStorageService';
import { Vibration, Platform } from 'react-native';

export const usePolygonAlerts = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [alerts, setAlerts] = useState<PolygonAlert[]>([]);
  const [alertHistory, setAlertHistory] = useState<PolygonAlert[]>([]);
  const [lastAlertTime, setLastAlertTime] = useState<Date | null>(null);
  const [hasPolygons, setHasPolygons] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const subscriptionRef = useRef<any>(null);

  // Load history on mount
  useEffect(() => {
    const loadData = async () => {
      const has = await PolygonStorageService.hasPolygons();
      setHasPolygons(has);
      const history = await PolygonStorageService.loadAlertHistory();
      setAlertHistory(history);
    };
    loadData();
  }, []);

  // Handle new alerts
  const handleAlerts = useCallback(async (newAlerts: PolygonAlert[]) => {
    // Update active alerts
    setAlerts(newAlerts);

    // Check if there are new alerts (not previously active)
    if (newAlerts.length > 0) {
      // Vibrate for new alerts
      if (Platform.OS === 'ios') {
        // iOS vibration
        Vibration.vibrate(500);
      } else {
        // Android vibration pattern
        Vibration.vibrate([500, 200, 500]);
      }
      setLastAlertTime(new Date());

      // Save to history (handled by GeofencingService already)
      // But we reload history to keep it fresh
      const history = await PolygonStorageService.loadAlertHistory();
      setAlertHistory(history);
    }
  }, []);

  // Start geofencing
  const start = useCallback(async () => {
    if (isRunning) return;

    setIsLoading(true);
    try {
      const has = await PolygonStorageService.hasPolygons();
      if (!has) {
        console.warn('No polygons downloaded. Please download polygons first.');
        setIsLoading(false);
        return;
      }

      setHasPolygons(true);
      await GeofencingService.startGeofencing(handleAlerts);
      setIsRunning(true);
    } catch (error) {
      console.error('Failed to start geofencing:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [isRunning, handleAlerts]);

  // Stop geofencing
  const stop = useCallback(async () => {
    setIsLoading(true);
    try {
      await GeofencingService.stopGeofencing();
      setIsRunning(false);
      setAlerts([]);
      // Clear active alerts from history? No, keep them for history
    } catch (error) {
      console.error('Failed to stop geofencing:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Clear history
  const clearHistory = useCallback(async () => {
    await PolygonStorageService.clearAlertHistory();
    setAlertHistory([]);
  }, []);

  // Refresh history
  const refreshHistory = useCallback(async () => {
    const history = await PolygonStorageService.loadAlertHistory();
    setAlertHistory(history);
  }, []);

  // Refresh polygon status
  const refreshPolygonStatus = useCallback(async () => {
    const has = await PolygonStorageService.hasPolygons();
    setHasPolygons(has);
  }, []);

  return {
    isRunning,
    isLoading,
    alerts,
    alertHistory,
    lastAlertTime,
    hasPolygons,
    hasActiveAlerts: alerts.length > 0,
    start,
    stop,
    clearHistory,
    refreshHistory,
    refreshPolygonStatus,
  };
};