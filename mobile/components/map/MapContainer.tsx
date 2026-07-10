// components/map/MapContainer.tsx

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Text,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNetworkStatus } from '@/utils/networkStatus';
import { usePolygonAlerts } from '@/hooks/usePolygonAlerts';
import FloatingMapButton from '@/components/FloatingMapButton';
import PolygonAlertBanner from './PolygonAlertBanner';

interface MapContainerProps {
  visible: boolean;
  onClose: () => void;
  areaId: number;
  areaName?: string;
  siteId?: number;
  siteName?: string;
  userLat?: number;
  userLng?: number;
  children?: React.ReactNode;
}

export default function MapContainer({
  visible,
  onClose,
  areaId,
  areaName,
  siteId,
  siteName,
  userLat,
  userLng,
  children,
}: MapContainerProps) {
  const isOnline = useNetworkStatus();
  const [showAlertDetails, setShowAlertDetails] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<any>(null);
  
  const {
    isRunning: geofencingActive,
    alerts,
    alertHistory,
    hasActiveAlerts,
    start: startGeofencing,
    stop: stopGeofencing,
  } = usePolygonAlerts();

  // Auto-start geofencing when map opens
  useEffect(() => {
    if (visible && !geofencingActive) {
      startGeofencing();
    }
    return () => {
      if (geofencingActive) {
        stopGeofencing();
      }
    };
  }, [visible]);

  const handleAlertPress = (alert: any) => {
    setSelectedAlert(alert);
    setShowAlertDetails(true);
  };

  const handleDismiss = () => {
    // Don't dismiss if there are active alerts
    if (alerts.length === 0) {
      // Dismiss banner
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color="#0F4A2F" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {siteName || areaName || 'Location Map'}
          </Text>
          <View style={styles.headerRight}>
            {geofencingActive && (
              <View style={styles.statusBadge}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>Tracking</Text>
              </View>
            )}
          </View>
        </View>

        {/* Map Content */}
        <View style={styles.mapContainer}>
          {children || (
            <View style={styles.mapPlaceholder}>
              <ActivityIndicator size="large" color="#0F4A2F" />
              <Text style={styles.mapPlaceholderText}>Loading map...</Text>
            </View>
          )}
        </View>

        {/* Alert Banner */}
        {hasActiveAlerts && (
          <PolygonAlertBanner
            alerts={alerts}
            onPress={handleAlertPress}
            onDismiss={handleDismiss}
            visible={true}
          />
        )}

        {/* Offline Indicator */}
        {!isOnline && (
          <View style={styles.offlineIndicator}>
            <Ionicons name="cloud-offline" size={16} color="#fff" />
            <Text style={styles.offlineText}>Offline Mode</Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F4A2F',
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 60,
    alignItems: 'flex-end',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16a34a',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#16a34a',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  mapPlaceholderText: {
    marginTop: 12,
    color: '#6b7280',
    fontSize: 14,
  },
  offlineIndicator: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  offlineText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});