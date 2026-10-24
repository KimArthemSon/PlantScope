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
} from "react-native";
import { useRouter } from "expo-router";
import { ArrowRight } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context"; // 👈 Add this
import LoginModal from "@/components/LoginModal";
import { checkSession, clearAuthData } from "@/utils/auth";

// Max time to wait for the auth check before asking the user to retry
const AUTH_TIMEOUT_MS = 3 * 60 * 1000;

const routeForRole = (role: string | null) => {
  if (role === "OnsiteInspector") return "/home";
  if (role === "treeGrowers") return "/tree_growers/home";
  return null;
};

export default function HomePage() {
  const router = useRouter();
  const insets = useSafeAreaInsets(); // 👈 Get safe area insets
  const [loginVisible, setLoginVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [timedOut, setTimedOut] = useState(false);
  const attemptRef = useRef(0);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideUpAnim = useRef(new Animated.Value(60)).current;
  const cardSlideAnim = useRef(new Animated.Value(200)).current;
  const brandFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    checkIfStillLoggedIn();
    startAnimations();
    return () => {
      attemptRef.current++; // ignore results after unmount
    };
  }, []);

  const checkIfStillLoggedIn = async () => {
    const attempt = ++attemptRef.current;
    setTimedOut(false);
    setIsLoading(true);

    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
      if (attempt === attemptRef.current) {
        setTimedOut(true);
        setIsLoading(false);
      }
    }, AUTH_TIMEOUT_MS);

    try {
      const result = await checkSession(controller.signal);
      if (attempt !== attemptRef.current) return; // stale or cancelled

      if (result.status === "valid" || result.status === "unreachable") {
        // "unreachable" = offline / server error: fall back to the cached role
        const route = routeForRole(result.role);
        if (route) {
          router.replace(route);
          return;
        }
        if (result.status === "valid") await clearAuthData(); // unknown role
      } else if (result.status === "invalid") {
        await clearAuthData();
      }
      setIsLoading(false);
    } catch (error) {
      // AbortError from the timeout — the timer already showed the retry UI
      console.error("Auth check error:", error);
    } finally {
      clearTimeout(timer);
    }
  };

  const loginAgain = async () => {
    attemptRef.current++; // cancel any pending check
    await clearAuthData();
    setTimedOut(false);
    setIsLoading(false);
    setLoginVisible(true);
  };

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

  if (timedOut) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>PlantScope</Text>
        <Text style={styles.timeoutText}>
          This is taking longer than expected. Check your connection and try
          again, or log in again.
        </Text>
        <TouchableOpacity
          style={[styles.signInButton, styles.timeoutButton]}
          onPress={checkIfStillLoggedIn}
          activeOpacity={0.85}
        >
          <Text style={styles.signInButtonText}>Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={loginAgain} activeOpacity={0.7}>
          <Text style={styles.timeoutLink}>Log in again</Text>
        </TouchableOpacity>
      </View>
    );
  }

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
              paddingBottom: 28 + insets.bottom, // 👈 Push content above nav bar
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
            style={styles.createAccountButton}
            onPress={() => router.push("/signup")}
            activeOpacity={0.7}
          >
            <Text style={styles.createAccountText}>Create Account</Text>
            <ArrowRight size={18} color="#15803D" strokeWidth={2.5} />
          </TouchableOpacity>
        </Animated.View>
      </ImageBackground>

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
    // paddingBottom removed from here — handled inline
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
    marginBottom: 12,
  },
  signInButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  // Secondary action: same size as Sign in, outlined so Sign in stays primary
  createAccountButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingVertical: 15,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#22C55E",
    backgroundColor: "#FFFFFF",
  },
  createAccountText: {
    color: "#15803D",
    fontSize: 16,
    fontWeight: "600",
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
  timeoutText: {
    color: "rgba(255, 255, 255, 0.75)",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    paddingHorizontal: 36,
  },
  timeoutButton: {
    alignSelf: "stretch",
    marginHorizontal: 36,
    marginTop: 8,
    marginBottom: 0,
  },
  timeoutLink: {
    color: "#4ADE80",
    fontSize: 15,
    fontWeight: "600",
    paddingVertical: 8,
  },
});
