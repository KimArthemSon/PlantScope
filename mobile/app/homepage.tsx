import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ImageBackground,
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
  const slideUpAnim = useRef(new Animated.Value(60)).current;
  const cardSlideAnim = useRef(new Animated.Value(200)).current;
  const brandFade = useRef(new Animated.Value(0)).current;

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
          router.replace("/tree_growers/home");
        } else {
          await clearAuthData();
          setIsLoading(false);
        }
      } else {
        await clearAuthData();
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Auth check error (offline):", error);
      await handleOfflineAuth();
    }
  };

  // ✅ Handle offline authentication with cached data
  const handleOfflineAuth = async () => {
    try {
      const token = await getToken();
      const cachedRole = await getUserRole();

      if (token && cachedRole) {
        console.log("Offline mode: Using cached role:", cachedRole);

        if (cachedRole === "OnsiteInspector") {
          router.replace("/home");
          return;
        } else if (cachedRole === "treeGrowers") {
          router.replace("/tree_growers/home");
          return;
        }
      }

      setIsLoading(false);
    } catch (error) {
      console.error("Offline auth error:", error);
      setIsLoading(false);
    }
  };

  // ✅ Start entrance animations
  const startAnimations = () => {
    Animated.timing(brandFade, {
      toValue: 1,
      duration: 600,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
      delay: 100,
    }).start();

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 900,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
      delay: 300,
    }).start();

    Animated.timing(slideUpAnim, {
      toValue: 0,
      duration: 800,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
      delay: 400,
    }).start();

    Animated.spring(cardSlideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 45,
      friction: 8,
      delay: 500,
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

        {/* Top Brand */}
        <Animated.View style={[styles.brandContainer, { opacity: brandFade }]}>
          <Text style={styles.brandText}>PlantScope</Text>
        </Animated.View>

        {/* Center Headline */}
        <Animated.View
          style={[
            styles.headlineContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideUpAnim }],
            },
          ]}
        >
          <Text style={styles.headline}>
            Start a new{"\n"}social adventure.
          </Text>
        </Animated.View>

        {/* Page Dots */}
        <Animated.View style={[styles.dotsContainer, { opacity: fadeAnim }]}>
          <View style={[styles.dot, styles.dotActive]} />
          <View style={styles.dot} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </Animated.View>

        {/* Bottom Card */}
        <Animated.View
          style={[
            styles.card,
            {
              transform: [{ translateY: cardSlideAnim }],
            },
          ]}
        >
          <Text style={styles.cardDescription}>
            Join us in making Ormoc City greener through data-driven
            reforestation.
          </Text>

          <TouchableOpacity
            style={styles.signInButton}
            onPress={() => setLoginVisible(true)}
            activeOpacity={0.85}
          >
            <Text style={styles.signInButtonText}>Sign in</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.createAccountContainer}
            onPress={() => router.push("/signup")}
            activeOpacity={0.7}
          >
            <Text style={styles.createAccountText}>Or Create Account</Text>
           
          </TouchableOpacity>
        </Animated.View>
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
    backgroundColor: "#0B0F0D",
  },
  background: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(11, 15, 13, 0.72)",
  },
  brandContainer: {
    position: "absolute",
    top: 52,
    left: 28,
    zIndex: 10,
  },
  brandText: {
    color: "rgba(255, 255, 255, 0.55)",
    fontSize: 15,
    fontWeight: "500",
    letterSpacing: 0.3,
  },
  headlineContainer: {
    position: "absolute",
    top: "40%",
    left: 28,
    right: 28,
    zIndex: 10,
  },
  headline: {
    fontSize: 34,
    fontWeight: "700",
    color: "#ffffff",
    lineHeight: 42,
    letterSpacing: -0.3,
  },
  dotsContainer: {
    position: "absolute",
    bottom: 340,
    left: 28,
    zIndex: 10,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.35)",
  },
  dotActive: {
    backgroundColor: "rgba(255, 255, 255, 0.9)",
  },
  card: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#E8E4DF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 42,
    zIndex: 20,
  },
  cardDescription: {
    color: "#2A2A2A",
    fontSize: 15,
    fontWeight: "500",
    lineHeight: 22,
    marginBottom: 24,
  },
  signInButton: {
    backgroundColor: "#22C55E",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 18,
  },
  signInButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  createAccountContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  createAccountText: {
    color: "#1C1C1E",
    fontSize: 14,
    fontWeight: "600",
  },
  arrow: {
    color: "#1C1C1E",
    fontSize: 16,
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
});
