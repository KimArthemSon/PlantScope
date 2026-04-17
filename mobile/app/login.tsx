import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Mail, Lock, Eye, EyeOff, ChevronLeft } from "lucide-react-native";
import * as SecureStore from "expo-secure-store";
import { api } from "@/constants/url_fixed";
export default function Login() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<"email" | "password" | null>(
    null,
  );
  const inputStyleOverride = {
    outlineStyle: "none",
    outlineWidth: 0,
    outlineColor: "transparent",
  } as any;
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);

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

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        Alert.alert("Error", errorData.error || "Invalid credentials");
        return;
      }

      const data = await res.json();

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

      // 💾 Store token — ONE LINE, DONE ✅
    } catch (error) {
      console.error("Login error:", error);
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
      <TouchableOpacity
        style={styles.topButton}
        onPress={() => router.push("/")}
      >
        <ChevronLeft size={20} color="#ffffff" />
        <Text style={styles.topButtonText}>Back</Text>
      </TouchableOpacity>
      <View style={styles.container}>
        <View style={styles.authContainer}>
          <View style={styles.logoContainer}>
            <View style={styles.logoCircle}>
              <Image
                source={require("../assets/images/logo.jpg")}
                style={styles.logo}
              />
            </View>
            <Text style={styles.brandTitle}>PlantScope</Text>
            <Text style={styles.brandSubtitle}>
              Nature's Digital System for TreeGrowers
            </Text>
          </View>

          <View style={styles.authCard}>
            <Text style={styles.signInTitle}>Sign In</Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Email Address</Text>
              <View
                style={[
                  styles.inputContainer,
                  focusedField === "email" && styles.inputContainerFocused,
                ]}
              >
                <Mail size={20} color="#a8c5b3" style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, inputStyleOverride]}
                  placeholder="Enter your email"
                  placeholderTextColor="#a8c5b3"
                  value={formData.email}
                  onChangeText={(text) =>
                    setFormData({ ...formData, email: text })
                  }
                  keyboardType="email-address"
                  onFocus={() => setFocusedField("email")}
                  onBlur={() => setFocusedField(null)}
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Password</Text>
              <View
                style={[
                  styles.inputContainer,
                  focusedField === "password" && styles.inputContainerFocused,
                ]}
              >
                <Lock size={20} color="#a8c5b3" style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, inputStyleOverride]}
                  placeholder="Enter your password"
                  placeholderTextColor="#a8c5b3"
                  value={formData.password}
                  onChangeText={(text) =>
                    setFormData({ ...formData, password: text })
                  }
                  secureTextEntry={!showPassword}
                  onFocus={() => setFocusedField("password")}
                  onBlur={() => setFocusedField(null)}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                >
                  {showPassword ? (
                    <EyeOff size={20} color="#a8c5b3" />
                  ) : (
                    <Eye size={20} color="#a8c5b3" />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity style={styles.forgotContainer}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.submitButton} onPress={handleLogin}>
              <Text style={styles.submitButtonText}>Sign In</Text>
            </TouchableOpacity>

            <View style={styles.registerContainer}>
              <Text style={styles.registerText}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => router.push("/signup")}>
                <Text style={styles.registerLink}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.footer}>Protected by nature's encryption</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: "100%",
    height: "100%",
    backgroundColor: "#0d2a17",
  },
  container: {
    flex: 1,
    width: "100%",
    paddingHorizontal: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  authContainer: {
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 32,
  },
  logoCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  brandTitle: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#ffffff",
    letterSpacing: 1,
  },
  brandSubtitle: {
    fontSize: 14,
    color: "#a8c5b3",
    marginTop: 4,
  },
  authCard: {
    backgroundColor: "#183d23",
    borderRadius: 16,
    padding: 32,
    width: "100%",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 8,
  },
  signInTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 24,
    textAlign: "center",
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    color: "#a8c5b3",
    fontSize: 14,
    marginBottom: 8,
    fontWeight: "600",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0b2211",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 50,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    color: "#ffffff",
    fontSize: 18,
    backgroundColor: "transparent",
    borderWidth: 0,
  },
  inputContainerFocused: {
    borderColor: "#ffffff",
    backgroundColor: "#163a24",
  },
  eyeButton: {
    padding: 8,
  },
  forgotContainer: {
    alignItems: "flex-end",
    marginBottom: 16,
  },
  forgotText: {
    color: "#a8c5b3",
    fontSize: 14,
  },
  submitButton: {
    backgroundColor: "#2d5f3c",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 4,
  },
  submitButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  registerContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 24,
  },
  registerText: {
    color: "#a8c5b3",
    fontSize: 14,
  },
  registerLink: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  topButton: {
    position: "absolute",
    top: 16,
    left: 16,
    zIndex: 20,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    borderRadius: 999,
  },
  topButtonText: {
    color: "#ffffff",
    fontSize: 14,
    marginLeft: 8,
  },
  footer: {
    textAlign: "center",
    color: "#a8c5b3",
    fontSize: 12,
    marginTop: 24,
  },
});
