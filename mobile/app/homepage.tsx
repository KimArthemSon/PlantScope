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
} from "react-native";
import { useRouter } from "expo-router";
import LoginModal from "@/components/LoginModal"; // Adjust path as needed

export default function HomePage() {
  const router = useRouter();
  const [loginVisible, setLoginVisible] = useState(false);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideUpAnim = useRef(new Animated.Value(50)).current;
  const buttonScale = useRef(new Animated.Value(0.8)).current;
  const logoScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
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
  }, []);

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
            {/* <Text style={styles.subtitle}>
              GIS-Based Reforestation &{"\n"}Monitoring System
            </Text> */}
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
  subtitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.9)",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 24,
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
});
