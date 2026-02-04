import { useRouter } from "expo-router";
import { useState } from "react";
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
  const router = useRouter();

  const handleLoginAsync = async () => {
    router.push("/home");
    // if (!email || !password) {
    //   Alert.alert("Error", "Please enter email and password");
    //   return;
    // }

    // try {
    //   const res = await fetch("http://127.0.0.1:8000/api/login/", {
    //     method: "POST",
    //     headers: { "Content-Type": "application/json" },
    //     body: JSON.stringify({ email, password }),
    //   });

    //   if (!res.ok) {
    //     Alert.alert("Error", "Wrong Credentials, Please try again!");
    //     return;
    //   }
    //   const data = await res.json();
    //   if (data.user_role !== "OnsiteInspector") {
    //     Alert.alert("Error", "Wrong Credentials, Please try again!");
    //     return;
    //   }

    //   Alert.alert("Success", `Logged in as ${email}`);
    //   setTimeout(() => {
    //     router.push("/home");
    //   }, 500);
    // } catch (error) {
    //   Alert.alert("Error", "Network error. Please try again later.");
    // }
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
        />
        <TouchableOpacity
          style={styles.showPasswordBtn}
          onPress={() => setShowPassword(!showPassword)}
        >
          <Text style={styles.showPasswordText}>
            {showPassword ? "Hide" : "Show"}
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.button} onPress={handleLoginAsync}>
        <Text style={styles.buttonText}>Log In</Text>
      </TouchableOpacity>

      <TouchableOpacity>
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
    elevation: 5, // Android shadow
  },
  input: {
    color: "white",
    fontSize: 16,

    // paddingVertical: 12,
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
