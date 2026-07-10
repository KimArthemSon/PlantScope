// components/map/MapAlertManager.tsx

import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { usePolygonAlerts } from '@/hooks/usePolygonAlerts';
import PolygonAlertBanner from './PolygonAlertBanner';
import PolygonAlertModal from './PolygonAlertModal';
import { PolygonAlert } from '@/types/polygon.types';

interface MapAlertManagerProps {
  visible: boolean;
  children: React.ReactNode;
}

export default function MapAlertManager({ visible, children }: MapAlertManagerProps) {
  const [selectedAlert, setSelectedAlert] = useState<PolygonAlert | null>(null);
  const [showModal, setShowModal] = useState(false);

  const {
    isRunning,
    alerts,
    hasActiveAlerts,
    start,
    stop,
  } = usePolygonAlerts();

  // Auto-start geofencing when map is visible
  useEffect(() => {
    if (visible && !isRunning) {
      start();
    }
    return () => {
      if (isRunning) {
        stop();
      }
    };
  }, [visible]);

  const handleAlertPress = (alert: PolygonAlert) => {
    setSelectedAlert(alert);
    setShowModal(true);
  };

  const handleDismiss = () => {
    // Just close the banner
  };

  return (
    <View style={styles.container}>
      {children}

      {/* Alert Banner */}
      <PolygonAlertBanner
        alerts={alerts}
        visible={hasActiveAlerts}
        onPress={handleAlertPress}
        onDismiss={handleDismiss}
      />

      {/* Alert Detail Modal */}
      <PolygonAlertModal
        visible={showModal}
        alert={selectedAlert}
        onClose={() => {
          setShowModal(false);
          setSelectedAlert(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
});