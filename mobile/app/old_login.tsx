import { useRouter } from "expo-router";
import { useState } from "react";
import { api } from "@/constants/url_fixed";
import * as SecureStore from "expo-secure-store"; // ✅ Direct import
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
} from "react-native";

export default function Index() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  
  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter email and password");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${api}/api/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        Alert.alert("Error", errorData.message || "Invalid credentials");
        return;
      }

      const data = await res.json();

      if (data.user_role !== "OnsiteInspector") {
        Alert.alert("Error", "Access denied: Insufficient permissions");
        return;
      }

      // 💾 Store token — ONE LINE, DONE ✅
      await SecureStore.setItemAsync("token", data.token);

      Alert.alert("Success", `Welcome, ${data.email}!`);
      router.replace("/home");
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
    <View style={styles.container}>
      <Text style={styles.title}>Log In</Text>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="rgba(255,255,255,0.7)"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
          editable={!loading}
        />
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="rgba(255,255,255,0.7)"
          secureTextEntry={!showPassword}
          value={password}
          onChangeText={setPassword}
          editable={!loading}
          onSubmitEditing={handleLogin}
        />
        <TouchableOpacity
          style={styles.showPasswordBtn}
          onPress={() => setShowPassword(!showPassword)}
          disabled={loading}
        >
          <Text style={styles.showPasswordText}>
            {showPassword ? "Hide" : "Show"}
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleLogin}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? "Logging in..." : "Log In"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity disabled={loading}>
        <Text style={styles.forgotText}>Forgot Password?</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F4A2F",
    justifyContent: "center",
    paddingHorizontal: 30,
  },
  title: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
    marginBottom: 40,
  },
  inputContainer: {
    position: "relative",
    marginBottom: 20,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
  input: {
    color: "white",
    fontSize: 16,
    padding: 20,
  },
  showPasswordBtn: {
    position: "absolute",
    right: 15,
    top: 12,
  },
  showPasswordText: {
    color: "#fff",
    fontWeight: "600",
  },
  button: {
    backgroundColor: "#1ABC9C",
    paddingVertical: 16,
    borderRadius: 25,
    marginTop: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 7,
    elevation: 5,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
  },
  forgotText: {
    color: "#A9F5D0",
    textAlign: "center",
    marginTop: 15,
    fontWeight: "500",
  },
});
