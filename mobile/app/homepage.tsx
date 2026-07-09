import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ImageBackground,
  Image,
  Animated,
  Easing,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import LoginModal from "@/components/LoginModal";
import * as SecureStore from "expo-secure-store";
import { api } from "@/constants/url_fixed";

// ✅ Cross-platform Storage Keys
const TOKEN_KEY = "token";
const USER_ROLE_KEY = "user_role";

const getToken = async () => {
  if (Platform.OS === "web") return localStorage.getItem(TOKEN_KEY);
  return await SecureStore.getItemAsync(TOKEN_KEY);
};

const getUserRole = async () => {
  if (Platform.OS === "web") return localStorage.getItem(USER_ROLE_KEY);
  return await SecureStore.getItemAsync(USER_ROLE_KEY);
};

const clearAuthData = async () => {
  if (Platform.OS === "web") {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_ROLE_KEY);
  } else {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_ROLE_KEY);
  }
};

export default function HomePage() {
  const router = useRouter();
  const [loginVisible, setLoginVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideUpAnim = useRef(new Animated.Value(50)).current;
  const buttonScale = useRef(new Animated.Value(0.8)).current;
  const logoScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    checkIfStillLoggedIn();
    startAnimations();
  }, []);

  // ✅ Check if user is already logged in (works offline!)
  const checkIfStillLoggedIn = async () => {
    try {
      const token = await getToken();

      if (!token) {
        setIsLoading(false);
        return;
      }

      // Try to validate token online
      const response = await fetch(`${api}/api/get_me/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (response.ok && data.user_role) {
        // ✅ Online: Token valid, route based on role
        if (data.user_role === "OnsiteInspector") {
          router.replace("/home");
        } else if (data.user_role === "treeGrowers") {
          router.replace("/tree_growers/application");
        } else {
          // Invalid role, clear storage
          await clearAuthData();
          setIsLoading(false);
        }
      } else {
        // Token invalid, clear storage
        await clearAuthData();
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Auth check error (offline):", error);

      // ✅ OFFLINE MODE: Check token exists AND get user_role from storage
      await handleOfflineAuth();
    }
  };

  // ✅ Handle offline authentication with cached data
  const handleOfflineAuth = async () => {
    try {
      const token = await getToken();
      const cachedRole = await getUserRole();

      // ✅ Must have BOTH token AND user_role to proceed offline
      if (token && cachedRole) {
        console.log("Offline mode: Using cached role:", cachedRole);

        if (cachedRole === "OnsiteInspector") {
          router.replace("/home");
          return;
        } else if (cachedRole === "treeGrowers") {
          router.replace("/tree_growers/application");
          return;
        }
      }

      // No valid cached data, show home page
      setIsLoading(false);
    } catch (error) {
      console.error("Offline auth error:", error);
      setIsLoading(false);
    }
  };

  // ✅ Start entrance animations
  const startAnimations = () => {
    Animated.spring(logoScale, {
      toValue: 1,
      useNativeDriver: true,
      tension: 50,
      friction: 7,
    }).start();

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
      delay: 200,
    }).start();

    Animated.timing(slideUpAnim, {
      toValue: 0,
      duration: 800,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
      delay: 400,
    }).start();

    Animated.spring(buttonScale, {
      toValue: 1,
      useNativeDriver: true,
      tension: 40,
      friction: 5,
      delay: 600,
    }).start();
  };

  // ✅ Show loading screen while checking auth
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4ADE80" />
        <Text style={styles.loadingText}>PlantScope</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ImageBackground
        source={{
          uri: "https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?w=800&h=1200&fit=crop",
        }}
        style={styles.background}
        resizeMode="cover"
      >
        <View style={styles.overlay} />

        <View style={styles.content}>
          {/* Logo */}
          <Animated.View
            style={[
              styles.logoContainer,
              { transform: [{ scale: logoScale }] },
            ]}
          >
            <View style={styles.logoCircle}>
              <Image
                source={require("../assets/images/logo.jpg")}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
          </Animated.View>

          {/* Title */}
          <Animated.View
            style={[
              styles.textContainer,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideUpAnim }],
              },
            ]}
          >
            <Text style={styles.title}>PlantScope</Text>
            <Text style={styles.description}>
              Join us in making Ormoc City greener through data-driven
              reforestation
            </Text>
          </Animated.View>

          {/* Buttons */}
          <Animated.View
            style={[
              styles.buttonContainer,
              {
                opacity: fadeAnim,
                transform: [{ scale: buttonScale }],
              },
            ]}
          >
            <TouchableOpacity
              style={styles.applyButton}
              onPress={() => router.push("/signup")}
              activeOpacity={0.9}
            >
              <Text style={styles.applyButtonText}>Apply Now</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.loginButton}
              onPress={() => setLoginVisible(true)}
              activeOpacity={0.9}
            >
              <Text style={styles.loginButtonText}>Login</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Privacy Policy & Terms Links */}
          <Animated.View
            style={[styles.legalLinksContainer, { opacity: fadeAnim }]}
          >
            <TouchableOpacity
              onPress={() => router.push("/privacy_policy")}
              style={styles.legalLink}
            >
              <Text style={styles.legalLinkText}>Privacy Policy</Text>
            </TouchableOpacity>

            <Text style={styles.legalSeparator}>•</Text>

            <TouchableOpacity
              onPress={() => router.push("/terms_and_conditions")}
              style={styles.legalLink}
            >
              <Text style={styles.legalLinkText}>Terms & Conditions</Text>
            </TouchableOpacity>
          </Animated.View>

          <Animated.View style={[styles.infoContainer, { opacity: fadeAnim }]}>
            <Text style={styles.infoText}>
              Tree growers & onsite inspectors welcome
            </Text>
          </Animated.View>
        </View>
      </ImageBackground>

      {/* Login Modal */}
      <LoginModal
        visible={loginVisible}
        onClose={() => setLoginVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f4a2f",
  },
  background: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 74, 47, 0.75)",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    paddingTop: 80,
  },
  logoContainer: {
    marginBottom: 40,
  },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  logo: {
    width: 80,
    height: 80,
  },
  textContainer: {
    alignItems: "center",
    marginBottom: 60,
  },
  title: {
    fontSize: 42,
    fontWeight: "800",
    color: "#ffffff",
    marginBottom: 12,
    letterSpacing: 1,
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  description: {
    fontSize: 15,
    color: "rgba(255, 255, 255, 0.75)",
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  buttonContainer: {
    width: "100%",
    maxWidth: 320,
    gap: 16,
  },
  applyButton: {
    backgroundColor: "#7cd56a",
    paddingVertical: 18,
    borderRadius: 16,
    shadowColor: "#7cd56a",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
    alignItems: "center",
  },
  applyButtonText: {
    color: "#0f4a2f",
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  loginButton: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    paddingVertical: 18,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.3)",
    alignItems: "center",
  },
  loginButtonText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  infoContainer: {
    marginTop: 40,
    alignItems: "center",
  },
  infoText: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 13,
    fontWeight: "500",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#0B1F12",
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  loadingText: {
    color: "#4ADE80",
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: 1,
  },
  legalLinksContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 30,
    marginBottom: 20,
    gap: 12,
  },
  legalLink: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  legalLinkText: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 12,
    fontWeight: "500",
    textDecorationLine: "underline",
  },
  legalSeparator: {
    color: "rgba(255, 255, 255, 0.4)",
    fontSize: 12,
  },
});
