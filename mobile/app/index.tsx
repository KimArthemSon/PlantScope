import { useRouter } from "expo-router";
import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  useColorScheme,
} from "react-native";

export default function Index() {
  const colorScheme = useColorScheme(); // dark/light mode
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  const handleLoginAsync = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter email and password");
      return;
    }

    try {
      const res = await fetch("http://127.0.0.1:8000/api/login/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        Alert.alert("Error", "Wrong Credentials, Please try again!");
        return;
      }
      const data = await res.json();
      console.log(data.data);
      if (data.user_role !== "OnsiteInspector") {
        Alert.alert("Error", "Wrong Credentials, Please try again!");
        return;
      }

      Alert.alert("Success", `Logged in as ${email}`);
      setTimeout(() => {
        router.push("/home"); // navigate to home screen
      }, 500);
    } catch (error) {
      Alert.alert("Error", "Network error. Please try again later.");
    }
  };

  const isDark = colorScheme === "dark";

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isDark ? "#121212" : "#fff" },
      ]}
    >
      <Text style={[styles.title, { color: isDark ? "#fff" : "#000" }]}>
        Log In
      </Text>

      {/* Email Input */}
      <TextInput
        style={[
          styles.input,
          {
            borderColor: isDark ? "#555" : "#ccc",
            color: isDark ? "#fff" : "#000",
          },
        ]}
        placeholder="Email"
        placeholderTextColor={
          isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)"
        }
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />

      {/* Password Input */}
      <TextInput
        style={[
          styles.input,
          {
            borderColor: isDark ? "#555" : "#ccc",
            color: isDark ? "#fff" : "#000",
          },
        ]}
        placeholder="Password"
        placeholderTextColor={
          isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)"
        }
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {/* Login Button */}
      <TouchableOpacity
        style={[styles.button, { backgroundColor: "#007AFF" }]}
        onPress={handleLoginAsync}
      >
        <Text style={styles.buttonText}>Log In</Text>
      </TouchableOpacity>

      {/* Forgot Password */}
      <TouchableOpacity>
        <Text
          style={{ color: isDark ? "#1E90FF" : "#007AFF", textAlign: "center" }}
        >
          Forgot Password?
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 25,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 30,
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
    marginBottom: 15,
    fontSize: 16,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 15,
    marginBottom: 15,
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
  },
});
