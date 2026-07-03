import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
  Animated,
  Easing,
} from "react-native";
import { useRouter } from "expo-router";
import { Mail, Lock, Eye, EyeOff, X } from "lucide-react-native";
import * as SecureStore from "expo-secure-store";
import { api } from "@/constants/url_fixed";
import { useAlert } from "@/components/AlertContext";

// ✅ Cross-platform Storage
const TOKEN_KEY = "token";

const getToken = async () => {
  if (Platform.OS === "web") return localStorage.getItem(TOKEN_KEY);
  return await SecureStore.getItemAsync(TOKEN_KEY);
};

const setToken = async (value: string) => {
  if (Platform.OS === "web") localStorage.setItem(TOKEN_KEY, value);
  else await SecureStore.setItemAsync(TOKEN_KEY, value);
};

const deleteToken = async () => {
  if (Platform.OS === "web") localStorage.removeItem(TOKEN_KEY);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
};

type LoginModalProps = {
  visible: boolean;
  onClose: () => void;
};

export default function LoginModal({ visible, onClose }: LoginModalProps) {
  const router = useRouter();
  const alert = useAlert(); // 🎯 Custom alert hook

  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<"email" | "password" | null>(null);
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);

  // Slide-up animation
  const slideAnim = useState(new Animated.Value(400))[0];
  const fadeAnim = useState(new Animated.Value(0))[0];

  // 🎯 BOUNCE ANIMATION for logo
  const logoScale = useState(new Animated.Value(0))[0];
  const logoRotate = useState(new Animated.Value(0))[0];

  useEffect(() => {
    if (visible) {
      // Modal slide up
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // 🎯 Logo bounce-in sequence
      Animated.sequence([
        Animated.spring(logoScale, {
          toValue: 1.2,
          tension: 60,
          friction: 4,
          useNativeDriver: true,
        }),
        Animated.spring(logoScale, {
          toValue: 0.9,
          tension: 80,
          friction: 5,
          useNativeDriver: true,
        }),
        Animated.spring(logoScale, {
          toValue: 1,
          tension: 100,
          friction: 6,
          useNativeDriver: true,
        }),
      ]).start();

      // Subtle rotation wiggle
      Animated.sequence([
        Animated.timing(logoRotate, {
          toValue: 1,
          duration: 200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(logoRotate, {
          toValue: -1,
          duration: 200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(logoRotate, {
          toValue: 0,
          duration: 200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      slideAnim.setValue(400);
      fadeAnim.setValue(0);
      logoScale.setValue(0);
      logoRotate.setValue(0);
      // Reset form when closing
      setFormData({ email: "", password: "" });
      setShowPassword(false);
      setAttemptsLeft(null);
    }
  }, [visible]);

  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const timer = setTimeout(() => {
      setLockoutSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearTimeout(timer);
  }, [lockoutSeconds]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 400,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => onClose());
  };

  const handleLogin = async () => {
    if (!formData.email || !formData.password) {
      // 🎨 Custom Error Alert
      alert.error(
        "Missing Fields",
        "Please enter your email and password to continue."
      );
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${api}/api/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 403) {
        const secs = data.remaining_seconds ?? 120;
        setAttemptsLeft(0);
        setLockoutSeconds(secs);
        // 🎨 Custom Warning Alert with longer duration
        alert.warning(
          "Account Temporarily Locked",
          `Too many failed attempts. Please try again in ${secs} seconds.`,
          5000
        );
        return;
      }

      if (!res.ok) {
        setAttemptsLeft(data.attempts_left ?? null);
        // 🎨 Custom Error Alert
        alert.error(
          "Login Failed",
          data.error || "Invalid email or password. Please try again."
        );
        return;
      }

      setAttemptsLeft(null);

      if (data.user_role === "OnsiteInspector") {
        await setToken(data.token);
        // 🎨 Custom Success Alert
        alert.success(
          "Welcome Back!",
          `Signed in as ${data.email}`,
          2500
        );
        handleClose();
        router.replace("/home");
      } else if (data.user_role === "treeGrowers") {
        await setToken(data.token);
        // 🎨 Custom Success Alert
        alert.success(
          "Welcome Back!",
          `Signed in as ${data.email}`,
          2500
        );
        handleClose();
        router.replace("/tree_growers/application");
      } else {
        // 🎨 Custom Error Alert
        alert.error(
          "Access Denied",
          "You don't have permission to access this application."
        );
      }
    } catch (error) {
      // 🎨 Custom Error Alert with longer duration
      alert.error(
        "Connection Error",
        "Cannot reach the server. Please check your internet connection and try again.",
        5000
      );
    } finally {
      setLoading(false);
    }
  };

  // Interpolate rotation from -10deg to 10deg
  const rotateInterpolation = logoRotate.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ["-10deg", "0deg", "10deg"],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.modalContainer}
      >
        {/* Backdrop */}
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={handleClose}
          />
        </Animated.View>

        {/* Modal Content */}
        <Animated.View
          style={[
            styles.modalContent,
            {
              transform: [{ translateY: slideAnim }],
              opacity: fadeAnim,
            },
          ]}
        >
          {/* Header with close button */}
          <View style={styles.modalHeader}>
            <View style={styles.headerTextContainer}>
              <Text style={styles.modalTitle}>Welcome Back</Text>
              <Text style={styles.modalSubtitle}>Sign in to continue</Text>
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleClose}
              activeOpacity={0.7}
            >
              <X size={22} color="#A3C4B0" />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* 🎯 Animated Bouncing Logo */}
            <View style={styles.logoSection}>
              <Animated.View
                style={[
                  styles.logoCircle,
                  {
                    transform: [
                      { scale: logoScale },
                      { rotate: rotateInterpolation },
                    ],
                  },
                ]}
              >
                <Image
                  source={require("../assets/images/logo.jpg")}
                  style={styles.logo}
                />
              </Animated.View>
            </View>

            {/* Email Field */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Email Address</Text>
              <View
                style={[
                  styles.inputContainer,
                  focusedField === "email" && styles.inputContainerFocused,
                ]}
              >
                <Mail size={20} color="#6B8F7B" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your email"
                  placeholderTextColor="#5A7D68"
                  value={formData.email}
                  onChangeText={(text) =>
                    setFormData({ ...formData, email: text })
                  }
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  onFocus={() => setFocusedField("email")}
                  onBlur={() => setFocusedField(null)}
                />
              </View>
            </View>

            {/* Password Field */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Password</Text>
              <View
                style={[
                  styles.inputContainer,
                  focusedField === "password" && styles.inputContainerFocused,
                ]}
              >
                <Lock size={20} color="#6B8F7B" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your password"
                  placeholderTextColor="#5A7D68"
                  value={formData.password}
                  onChangeText={(text) =>
                    setFormData({ ...formData, password: text })
                  }
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete="password"
                  onFocus={() => setFocusedField("password")}
                  onBlur={() => setFocusedField(null)}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  {showPassword ? (
                    <EyeOff size={20} color="#6B8F7B" />
                  ) : (
                    <Eye size={20} color="#6B8F7B" />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Lockout / Attempts Banner */}
            {lockoutSeconds > 0 ? (
              <View style={styles.lockoutBanner}>
                <Text style={styles.bannerIcon}>🔒</Text>
                <Text style={styles.lockoutText}>
                  Account locked — try again in{" "}
                  <Text style={styles.lockoutCountdown}>{lockoutSeconds}s</Text>
                </Text>
              </View>
            ) : attemptsLeft !== null && attemptsLeft > 0 ? (
              <View style={styles.attemptsBanner}>
                <Text style={styles.bannerIcon}>⚠️</Text>
                <Text style={styles.attemptsText}>
                  <Text style={styles.attemptsBold}>{attemptsLeft}</Text>{" "}
                  {attemptsLeft === 1 ? "attempt" : "attempts"} remaining
                </Text>
              </View>
            ) : null}

            {/* Submit Button */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                (loading || lockoutSeconds > 0) && styles.submitButtonDisabled,
              ]}
              onPress={handleLogin}
              disabled={loading || lockoutSeconds > 0}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.submitButtonText}>Sign In</Text>
              )}
            </TouchableOpacity>

            {/* Sign Up Link */}
            <View style={styles.registerContainer}>
              <Text style={styles.registerText}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => router.push("/signup")}>
                <Text style={styles.registerLink}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  modalContent: {
    backgroundColor: "#0B1F12",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "92%",
    borderWidth: 1,
    borderColor: "rgba(74, 222, 128, 0.15)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 15,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  headerTextContainer: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  modalSubtitle: {
    fontSize: 13,
    color: "#6B8F7B",
    marginTop: 2,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  logoSection: {
    alignItems: "center",
    paddingVertical: 20,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(74, 222, 128, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(74, 222, 128, 0.2)",
  },
  logo: { width: 52, height: 52, borderRadius: 26 },
  scrollContent: {
    paddingHorizontal: 28,
    paddingBottom: 32,
  },
  formGroup: { marginBottom: 18 },
  label: {
    color: "#A3C4B0",
    fontSize: 13,
    marginBottom: 8,
    fontWeight: "500",
    letterSpacing: 0.3,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 16,
    height: 54,
  },
  inputContainerFocused: {
    borderColor: "#4ADE80",
    backgroundColor: "rgba(74, 222, 128, 0.08)",
  },
  inputIcon: { marginRight: 12 },
  input: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 15,
    paddingVertical: 16,
    paddingHorizontal: 0,
    backgroundColor: "transparent",
    borderWidth: 0,
  },
  eyeButton: { padding: 6, marginLeft: 4 },
  submitButton: {
    backgroundColor: "#22C55E",
    borderRadius: 14,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    shadowColor: "#22C55E",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  submitButtonDisabled: { opacity: 0.5, shadowOpacity: 0, elevation: 0 },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  registerContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 24,
  },
  registerText: { color: "#6B8F7B", fontSize: 14 },
  registerLink: { color: "#4ADE80", fontSize: 14, fontWeight: "600" },
  lockoutBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.25)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
    gap: 10,
  },
  lockoutText: { color: "#FCA5A5", fontSize: 13, fontWeight: "500", flex: 1 },
  lockoutCountdown: { fontWeight: "700", color: "#F87171" },
  attemptsBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.25)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
    gap: 10,
  },
  attemptsText: { color: "#FCD34D", fontSize: 13, fontWeight: "500", flex: 1 },
  attemptsBold: { fontWeight: "700", color: "#FBBF24" },
  bannerIcon: { fontSize: 16 },
});