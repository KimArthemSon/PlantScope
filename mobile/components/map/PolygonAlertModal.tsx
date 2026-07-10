// components/map/PolygonAlertModal.tsx

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PolygonAlert } from '@/types/polygon.types';

interface PolygonAlertModalProps {
  visible: boolean;
  alert: PolygonAlert | null;
  onClose: () => void;
}

export default function PolygonAlertModal({
  visible,
  alert,
  onClose,
}: PolygonAlertModalProps) {
  if (!alert) return null;

  const isHazard = alert.type === 'HAZARD';
  const severityColor = alert.severity === 'HIGH' ? '#dc2626' :
    alert.severity === 'MEDIUM' ? '#f59e0b' : '#22c55e';

  const getIcon = () => {
    if (isHazard) {
      if (alert.hazardType?.toUpperCase() === 'FLOOD') return 'water';
      if (alert.hazardType?.toUpperCase() === 'LANDSLIDE') return 'trail-sign';
      return 'warning';
    }
    return 'layers';
  };

  const getSeverityText = () => {
    if (isHazard) {
      return `${alert.hazardType} • ${alert.severity} Severity`;
    }
    return `Classification: ${alert.classification}`;
  };

  const getActionText = () => {
    if (isHazard) {
      if (alert.severity === 'HIGH') {
        return '🚨 Evacuate immediately if instructed by local authorities.';
      }
      if (alert.severity === 'MEDIUM') {
        return '⚠️ Exercise caution. Monitor local news and weather updates.';
      }
      return 'ℹ️ Stay alert. Be aware of your surroundings.';
    }
    return '📍 This area has a specific land classification. Follow local regulations.';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-PH', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.content}>
          {/* Header */}
          <View style={[styles.header, { backgroundColor: isHazard ? '#fef2f2' : '#eff6ff' }]}>
            <View style={[styles.iconContainer, { backgroundColor: isHazard ? '#fee2e2' : '#dbeafe' }]}>
              <Ionicons
                name={getIcon()}
                size={28}
                color={isHazard ? '#dc2626' : '#2563eb'}
              />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.title}>
                {isHazard ? '⚠️ Hazard Zone Alert' : '📍 Classified Area'}
              </Text>
              <Text style={styles.subtitle}>{alert.name}</Text>
            </View>
          </View>

          {/* Body */}
          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Type</Text>
              <Text style={styles.detailValue}>
                {isHazard ? 'Hazard Zone' : 'Classified Area'}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Severity</Text>
              <View style={[styles.severityBadge, { backgroundColor: severityColor + '20' }]}>
                <View style={[styles.severityDot, { backgroundColor: severityColor }]} />
                <Text style={[styles.severityText, { color: severityColor }]}>
                  {getSeverityText()}
                </Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Details</Text>
              <Text style={styles.detailValue}>{alert.message}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Detected</Text>
              <Text style={styles.detailValue}>{formatDate(alert.timestamp)}</Text>
            </View>

            {/* Action / Recommendation */}
            <View style={[styles.actionBox, {
              backgroundColor: isHazard ? '#fef3c7' : '#dcfce7',
              borderColor: isHazard ? '#f59e0b' : '#16a34a',
            }]}>
              <Ionicons
                name={isHazard ? 'information-circle' : 'checkmark-circle'}
                size={20}
                color={isHazard ? '#f59e0b' : '#16a34a'}
              />
              <Text style={[styles.actionText, {
                color: isHazard ? '#92400e' : '#166534',
              }]}>
                {getActionText()}
              </Text>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '100%',
    maxHeight: '80%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    gap: 14,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111',
  },
  subtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  body: {
    paddingHorizontal: 18,
    paddingBottom: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  detailValue: {
    fontSize: 13,
    color: '#111',
    flex: 1,
    textAlign: 'right',
    marginLeft: 12,
  },
  severityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  severityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  severityText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 10,
    marginTop: 12,
    marginBottom: 8,
    borderWidth: 1,
    gap: 10,
  },
  actionText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  closeButton: {
    backgroundColor: '#0F4A2F',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});