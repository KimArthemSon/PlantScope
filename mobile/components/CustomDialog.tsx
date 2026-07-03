import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
  Easing,
  ActivityIndicator,
} from "react-native";
import { CheckCircle, XCircle, AlertTriangle, Info, AlertCircle } from "lucide-react-native";
import * as Haptics from "expo-haptics";

type AlertType = "success" | "error" | "warning" | "info";

type DialogProps = {
  dialog: {
    id: string;
    type: AlertType;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void | Promise<void>;
    onCancel?: () => void;
  };
  onClose: () => void;
};

const typeConfig = {
  success: {
    icon: CheckCircle,
    color: "#10b981",
    bgColor: "rgba(16, 185, 129, 0.15)",
    confirmColor: "#10b981",
  },
  error: {
    icon: XCircle,
    color: "#ef4444",
    bgColor: "rgba(239, 68, 68, 0.15)",
    confirmColor: "#ef4444",
  },
  warning: {
    icon: AlertTriangle,
    color: "#f59e0b",
    bgColor: "rgba(245, 158, 11, 0.15)",
    confirmColor: "#f59e0b",
  },
  info: {
    icon: Info,
    color: "#3b82f6",
    bgColor: "rgba(59, 130, 246, 0.15)",
    confirmColor: "#3b82f6",
  },
};

export default function CustomDialog({ dialog, onClose }: DialogProps) {
  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(0)).current;
  const [loading, setLoading] = React.useState(false);

  const config = typeConfig[dialog.type];
  const Icon = config.icon;

  useEffect(() => {
    // Haptic feedback
    try {
      if (dialog.type === "error") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } else if (dialog.type === "warning") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch (e) {}

    // Backdrop fade in
    Animated.timing(backdropOpacity, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();

    // Dialog scale up
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        tension: 60,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Icon bounce
    Animated.sequence([
      Animated.spring(iconScale, {
        toValue: 1.2,
        tension: 80,
        friction: 4,
        useNativeDriver: true,
      }),
      Animated.spring(iconScale, {
        toValue: 1,
        tension: 100,
        friction: 6,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleClose = async (action: "confirm" | "cancel") => {
    if (action === "confirm" && dialog.onConfirm) {
      setLoading(true);
      try {
        await dialog.onConfirm();
      } catch (e) {
        // Error will be handled by the caller
      } finally {
        setLoading(false);
      }
    } else if (action === "cancel" && dialog.onCancel) {
      dialog.onCancel();
    }

    // Animate out
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 0.85,
        duration: 200,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => onClose());
  };

  return (
    <Modal transparent visible animationType="none" onRequestClose={() => handleClose("cancel")}>
      <View style={styles.container}>
        {/* Backdrop */}
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => handleClose("cancel")}
          />
        </Animated.View>

        {/* Dialog */}
        <Animated.View
          style={[
            styles.dialog,
            {
              transform: [{ scale }],
              opacity,
            },
          ]}
        >
          {/* Icon with pulse background */}
          <View style={styles.iconWrapper}>
            <Animated.View
              style={[
                styles.iconCircle,
                {
                  backgroundColor: config.bgColor,
                  transform: [{ scale: iconScale }],
                },
              ]}
            >
              <Icon size={36} color={config.color} strokeWidth={2.5} />
            </Animated.View>

            {/* Pulse ring */}
            <View style={[styles.pulseRing, { borderColor: config.color }]} />
          </View>

          {/* Title */}
          <Text style={styles.title}>{dialog.title}</Text>

          {/* Message */}
          <Text style={styles.message}>{dialog.message}</Text>

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            {dialog.cancelText && (
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => handleClose("cancel")}
                disabled={loading}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelButtonText}>{dialog.cancelText}</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.confirmButton, { backgroundColor: config.confirmColor }]}
              onPress={() => handleClose("confirm")}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.confirmButtonText}>{dialog.confirmText}</Text>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
  },
  dialog: {
    backgroundColor: "#0B1F12",
    borderRadius: 24,
    padding: 28,
    maxWidth: 380,
    width: "100%",
    borderWidth: 1,
    borderColor: "rgba(74, 222, 128, 0.2)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.4,
    shadowRadius: 30,
    elevation: 20,
  },
  iconWrapper: {
    alignItems: "center",
    justifyContent: "center",
    height: 80,
    marginBottom: 20,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
  },
  pulseRing: {
    position: "absolute",
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    opacity: 0.3,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#ffffff",
    textAlign: "center",
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  message: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 28,
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButtonText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 15,
    fontWeight: "600",
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});