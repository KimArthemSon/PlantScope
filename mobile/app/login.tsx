import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useRouter, useRootNavigationState } from "expo-router";
import { Mail, Lock, Eye, EyeOff, ChevronLeft } from "lucide-react-native";
import * as SecureStore from "expo-secure-store";
import { api } from "@/constants/url_fixed";

export default function Login() {
  const router = useRouter();
  const rootNavState = useRootNavigationState();
  const [checking, setChecking] = useState(true);
  const [redirectTo, setRedirectTo] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<"email" | "password" | null>(
    null,
  );
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (!rootNavState?.key || !redirectTo) return;
    router.replace(redirectTo as any);
  }, [rootNavState?.key, redirectTo]);

  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const timer = setTimeout(() => {
      setLockoutSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearTimeout(timer);
  }, [lockoutSeconds]);

  const checkAuth = async () => {
    try {
      const token = await SecureStore.getItemAsync("token");
      if (!token) {
        setChecking(false);
        return;
      }

      const res = await fetch(`${api}/api/get_me/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.token) await SecureStore.setItemAsync("token", data.token);

        if (data.user_role === "OnsiteInspector") {
          setRedirectTo("/home");
        } else if (data.user_role === "treeGrowers") {
          setRedirectTo("/tree_growers/application");
        } else {
          await SecureStore.deleteItemAsync("token");
          setChecking(false);
        }
      } else {
        await SecureStore.deleteItemAsync("token");
        setChecking(false);
      }
    } catch {
      setChecking(false);
    }
  };

  if (checking || redirectTo) {
    return (
      <View style={styles.splashRoot}>
        <ActivityIndicator color="#4ADE80" size="large" />
      </View>
    );
  }

  const handleLogin = async () => {
    if (!formData.email || !formData.password) {
      Alert.alert("Error", "Please enter email and password");
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
        Alert.alert(
          "Account Locked",
          `Too many failed attempts. Try again in ${secs} seconds.`,
        );
        return;
      }

      if (!res.ok) {
        setAttemptsLeft(data.attempts_left ?? null);
        Alert.alert("Login Failed", data.error || "Invalid credentials");
        return;
      }

      setAttemptsLeft(null);

      if (data.user_role === "OnsiteInspector") {
        await SecureStore.setItemAsync("token", data.token);
        Alert.alert("Success", `Welcome, ${data.email}!`);
        router.replace("/home");
      } else if (data.user_role === "treeGrowers") {
        await SecureStore.setItemAsync("token", data.token);
        Alert.alert("Success", `Welcome, ${data.email}!`);
        router.replace("/tree_growers/application");
      } else {
        Alert.alert("Error", "Access denied: Insufficient permissions");
        return;
      }
    } catch (error) {
    
      Alert.alert(
        "Connection Error",
        "Cannot reach server. Check your network & API URL.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      {/* ── Back Button ── */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => router.push("/")}
      >
        <ChevronLeft size={22} color="#ffffff" />
      </TouchableOpacity>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Header / Logo ── */}
          <View style={styles.headerSection}>
            <View style={styles.logoCircle}>
              <Image
                source={require("../assets/images/logo.jpg")}
                style={styles.logo}
              />
            </View>
            <Text style={styles.welcomeTitle}>Welcome Back</Text>
            <Text style={styles.welcomeSubtitle}>Sign in to your account</Text>
          </View>

          {/* ─ Form Section ── */}
          <View style={styles.formSection}>
            {/* Email */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Email Address</Text>
              <View
                style={[
                  styles.inputContainer,
                  focusedField === "email" && styles.inputContainerFocused,
                ]}
                pointerEvents="box-none"
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

            {/* Password */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Password</Text>
              <View
                style={[
                  styles.inputContainer,
                  focusedField === "password" && styles.inputContainerFocused,
                ]}
                pointerEvents="box-none"
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

            {/* Forgot Password */}
            {/* <TouchableOpacity
              style={styles.forgotContainer}
              onPress={() => router.push("/forgot_password")}
            >
            
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity> */}

            {/* ── Lockout / Attempts Banners ─ */}
            {lockoutSeconds > 0 ? (
              <View style={styles.lockoutBanner}>
                <Text style={styles.bannerIcon}>🔒</Text>
                <Text style={styles.lockoutText}>
                  Account locked — try again in{" "}
                  <Text style={styles.lockoutCountdown}>
                    {lockoutSeconds}s
                  </Text>
                </Text>
              </View>
            ) : attemptsLeft !== null && attemptsLeft > 0 ? (
              <View style={styles.attemptsBanner}>
                <Text style={styles.bannerIcon}>⚠️</Text>
                <Text style={styles.attemptsText}>
                  <Text style={styles.attemptsBold}>{attemptsLeft}</Text>{" "}
                  {attemptsLeft === 1 ? "attempt" : "attempts"} remaining before
                  lockout
                </Text>
              </View>
            ) : null}

            {/* ── Submit Button ── */}
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

            {/* ── Register Link ── */}
            <View style={styles.registerContainer}>
              <Text style={styles.registerText}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => router.push("/signup")}>
                <Text style={styles.registerLink}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ─ Footer ── */}
          <View style={styles.footerSection}>
            <Text style={styles.footer}>Protected by nature's encryption</Text>
            <View style={styles.legalFooter}>
              <TouchableOpacity
                onPress={() => router.push("/privacy_policy")}
              >
                <Text style={styles.legalLink}>Privacy Notice</Text>
              </TouchableOpacity>
              <Text style={styles.legalSeparator}>·</Text>
              <TouchableOpacity
                onPress={() => router.push("/terms_and_conditions")}
              >
                <Text style={styles.legalLink}>Terms & Conditions</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/* ═══════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════ */
const styles = StyleSheet.create({
  splashRoot: {
    flex: 1,
    backgroundColor: "#0B1F12",
    alignItems: "center",
    justifyContent: "center",
  },

  root: {
    flex: 1,
    backgroundColor: "#0B1F12",
  },

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingBottom: 40,
  },

  backButton: {
    position: "absolute",
    top: 56,
    left: 20,
    zIndex: 30,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },

  headerSection: {
    alignItems: "center",
    marginTop: 100,
    marginBottom: 48,
  },

  logoCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "rgba(74, 222, 128, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 28,
    borderWidth: 2,
    borderColor: "rgba(74, 222, 128, 0.2)",
  },

  logo: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },

  welcomeTitle: {
    fontSize: 30,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.3,
    marginBottom: 8,
  },

  welcomeSubtitle: {
    fontSize: 15,
    color: "#6B8F7B",
    fontWeight: "400",
    letterSpacing: 0.2,
  },

  formSection: {
    width: "100%",
  },

  formGroup: {
    marginBottom: 20,
  },

  label: {
    color: "#A3C4B0",
    fontSize: 13,
    marginBottom: 10,
    fontWeight: "500",
    letterSpacing: 0.3,
  },

  /* ✅ FIX 1: Removed shadow/elevation from focused state */
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

  inputIcon: {
    marginRight: 12,
  },

  /* ✅ FIX 2: Removed height: "100%", paddingVertical: 0, and web-only overrides */
  input: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 15,
    paddingVertical: 16,
    paddingHorizontal: 0,
    backgroundColor: "transparent",
    borderWidth: 0,
  },

  eyeButton: {
    padding: 6,
    marginLeft: 4,
  },

  forgotContainer: {
    alignItems: "flex-end",
    marginBottom: 28,
    marginTop: -4,
  },

  forgotText: {
    color: "#4ADE80",
    fontSize: 13,
    fontWeight: "500",
  },

  submitButton: {
    backgroundColor: "#22C55E",
    borderRadius: 14,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#22C55E",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },

  submitButtonDisabled: {
    opacity: 0.5,
    shadowOpacity: 0,
    elevation: 0,
  },

  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },

  registerContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 28,
  },

  registerText: {
    color: "#6B8F7B",
    fontSize: 14,
  },

  registerLink: {
    color: "#4ADE80",
    fontSize: 14,
    fontWeight: "600",
  },

  footerSection: {
    marginTop: "auto",
    paddingTop: 32,
    alignItems: "center",
  },

  footer: {
    textAlign: "center",
    color: "#3D6B4E",
    fontSize: 12,
    marginBottom: 10,
  },

  legalFooter: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },

  legalLink: {
    color: "#4ADE80",
    fontSize: 12,
    fontWeight: "500",
  },

  legalSeparator: {
    color: "#3D6B4E",
    fontSize: 12,
  },

  lockoutBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.25)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 20,
    gap: 10,
  },

  lockoutText: {
    color: "#FCA5A5",
    fontSize: 13,
    fontWeight: "500",
    flex: 1,
  },

  lockoutCountdown: {
    fontWeight: "700",
    color: "#F87171",
  },

  attemptsBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.25)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 20,
    gap: 10,
  },

  attemptsText: {
    color: "#FCD34D",
    fontSize: 13,
    fontWeight: "500",
    flex: 1,
  },

  attemptsBold: {
    fontWeight: "700",
    color: "#FBBF24",
  },

  bannerIcon: {
    fontSize: 16,
  },
});