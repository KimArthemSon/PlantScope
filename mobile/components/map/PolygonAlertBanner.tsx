// components/map/PolygonAlertBanner.tsx

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PolygonAlert } from '@/types/polygon.types';

const { width } = Dimensions.get('window');

interface PolygonAlertBannerProps {
  alerts: PolygonAlert[];
  onPress: (alert: PolygonAlert) => void;
  onDismiss?: () => void;
  visible: boolean;
}

export default function PolygonAlertBanner({
  alerts,
  onPress,
  onDismiss,
  visible,
}: PolygonAlertBannerProps) {
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible && alerts.length > 0) {
      // Slide in
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 100,
          friction: 10,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Slide out
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -100,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, alerts.length]);

  if (!visible || alerts.length === 0) return null;

  const primaryAlert = alerts[0];
  const isHazard = primaryAlert.type === 'HAZARD';
  const isHighSeverity = primaryAlert.severity === 'HIGH';

  const backgroundColor = isHazard
    ? (isHighSeverity ? '#dc2626' : '#f59e0b')
    : '#3b82f6';

  const getIcon = () => {
    if (isHazard) {
      if (primaryAlert.hazardType?.toUpperCase() === 'FLOOD') return 'water-outline';
      if (primaryAlert.hazardType?.toUpperCase() === 'LANDSLIDE') return 'trail-sign-outline';
      return 'warning-outline';
    }
    return 'layers-outline';
  };

  const getTitle = () => {
    if (isHazard) {
      if (isHighSeverity) return '⚠️ High Hazard Zone';
      return '⚠️ Hazard Zone';
    }
    return '📍 Classified Area';
  };

  const getShortMessage = (msg: string) => {
    const maxLength = 50;
    if (msg.length > maxLength) {
      return msg.substring(0, maxLength) + '...';
    }
    return msg;
  };

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor },
        {
          transform: [{ translateY: slideAnim }],
          opacity: fadeAnim,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.content}
        onPress={() => onPress(primaryAlert)}
        activeOpacity={0.9}
      >
        <View style={styles.leftSection}>
          <View style={styles.iconContainer}>
            <Ionicons name={getIcon()} size={20} color="#fff" />
          </View>
          <View style={styles.textSection}>
            <Text style={styles.title} numberOfLines={1}>
              {getTitle()}
            </Text>
            <Text style={styles.message} numberOfLines={1}>
              {getShortMessage(primaryAlert.message)}
            </Text>
          </View>
        </View>

        <View style={styles.rightSection}>
          {alerts.length > 1 && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>+{alerts.length - 1}</Text>
            </View>
          )}
          {onDismiss && (
            <TouchableOpacity
              onPress={onDismiss}
              style={styles.dismissButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={16} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    zIndex: 1000,
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textSection: {
    flex: 1,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  message: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 1,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  countBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  dismissButton: {
    padding: 2,
  },
});