import React, { useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing, Platform } from "react-native";
import { CheckCircle, XCircle, AlertTriangle, Info, X } from "lucide-react-native";
import * as Haptics from "expo-haptics";

type ToastType = "success" | "error" | "warning" | "info";

type ToastProps = {
  toast: {
    id: string;
    type: ToastType;
    title: string;
    message?: string;
    duration?: number;
  };
  index: number;
  onClose: () => void;
};

const typeConfig = {
  success: {
    icon: CheckCircle,
    color: "#10b981",
    bgColor: "rgba(16, 185, 129, 0.15)",
    borderColor: "rgba(16, 185, 129, 0.4)",
    progressColor: "#10b981",
  },
  error: {
    icon: XCircle,
    color: "#ef4444",
    bgColor: "rgba(239, 68, 68, 0.15)",
    borderColor: "rgba(239, 68, 68, 0.4)",
    progressColor: "#ef4444",
  },
  warning: {
    icon: AlertTriangle,
    color: "#f59e0b",
    bgColor: "rgba(245, 158, 11, 0.15)",
    borderColor: "rgba(245, 158, 11, 0.4)",
    progressColor: "#f59e0b",
  },
  info: {
    icon: Info,
    color: "#3b82f6",
    bgColor: "rgba(59, 130, 246, 0.15)",
    borderColor: "rgba(59, 130, 246, 0.4)",
    progressColor: "#3b82f6",
  },
};

export default function CustomToast({ toast, index, onClose }: ToastProps) {
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(1)).current;
  const iconScale = useRef(new Animated.Value(0)).current;

  const config = typeConfig[toast.type];
  const Icon = config.icon;
  const duration = toast.duration || 3000;

  useEffect(() => {
    // Haptic feedback
    try {
      if (toast.type === "error") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } else if (toast.type === "success") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (toast.type === "warning") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (e) {
      // Haptics not available on web
    }

    // Slide in animation
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 400,
        easing: Easing.out(Easing.back(1.5)),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(iconScale, {
        toValue: 1,
        tension: 80,
        friction: 6,
        useNativeDriver: true,
      }),
    ]).start();

    // Progress bar countdown
    Animated.timing(progress, {
      toValue: 0,
      duration: duration,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
  }, []);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -100,
        duration: 250,
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

  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY }],
          opacity,
          marginTop: index * 12,
        },
      ]}
    >
      <View style={[styles.toast, { borderColor: config.borderColor }]}>
        {/* Background tint */}
        <View style={[styles.backgroundTint, { backgroundColor: config.bgColor }]} />

        {/* Progress bar */}
        <View style={styles.progressContainer}>
          <Animated.View
            style={[
              styles.progressBar,
              {
                width: progressWidth,
                backgroundColor: config.progressColor,
              },
            ]}
          />
        </View>

        {/* Content */}
        <View style={styles.content}>
          <Animated.View style={[styles.iconContainer, { transform: [{ scale: iconScale }] }]}>
            <Icon size={22} color={config.color} strokeWidth={2.5} />
          </Animated.View>

          <View style={styles.textContainer}>
            <Text style={styles.title}>{toast.title}</Text>
            {toast.message && <Text style={styles.message}>{toast.message}</Text>}
          </View>

          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={16} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  toast: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: "rgba(11, 31, 18, 0.95)",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  backgroundTint: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.3,
  },
  progressContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  progressBar: {
    height: "100%",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    paddingTop: 18,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.2,
    marginBottom: 2,
  },
  message: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    lineHeight: 18,
  },
  closeButton: {
    padding: 4,
  },
});