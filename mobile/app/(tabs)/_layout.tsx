import React, { useState, useEffect } from "react";
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Platform,
  StatusBar,
} from "react-native";
import { Tabs, useRouter, usePathname } from "expo-router";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "@/constants/url_fixed";
import { useNetworkStatus } from "@/utils/networkStatus";
import { useAlert } from "@/components/AlertContext";
import { getToken, clearAuthData, isAuthFailure } from "@/utils/auth";

const API = api + "/api";
const USER_DATA_KEY = "@plantscope_user_data";

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const isOnline = useNetworkStatus();
  const { warning } = useAlert();

  const [loading, setLoading] = useState(true);
  const [hasShownOfflineAlert, setHasShownOfflineAlert] = useState(false);

  useEffect(() => {
    const goToLogin = async () => {
      await clearAuthData();
      router.replace("/homepage");
    };

    const fetchUserRole = async () => {
      try {
        const token = await getToken();
        if (!token) {
          // No session (online or offline) → log in again
          await goToLogin();
          return;
        }
        if (!isOnline) {
          const cached = await AsyncStorage.getItem(USER_DATA_KEY);
          if (cached) JSON.parse(cached);
          return;
        }
        const res = await fetch(`${API}/get_me/`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });
        if (isAuthFailure(res.status)) {
          // Token expired or invalid
          await goToLogin();
          return;
        }
        if (res.ok) await res.json();
      } catch (error) {
        console.error("Error fetching user role:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserRole();
  }, [isOnline]);

  const shouldHideAllTabs = !isOnline;

  useEffect(() => {
    if (shouldHideAllTabs && !loading) {
      if (!pathname.startsWith("/Area") && !pathname.startsWith("/feedbacks")) {
        router.replace("/Area");
      }
      if (!hasShownOfflineAlert) {
        warning(
          "Offline Mode",
          "You are currently offline. Only Assessment is available.",
        );
        setHasShownOfflineAlert(true);
      }
    } else if (isOnline) {
      setHasShownOfflineAlert(false);
    }
  }, [
    shouldHideAllTabs,
    loading,
    pathname,
    hasShownOfflineAlert,
    isOnline,
    warning,
  ]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0F4A2F" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <>
      {/* ✅ STATUS BAR CONFIGURATION */}
      <StatusBar
        barStyle="dark-content"
        backgroundColor="rgba(0,0,0,0.05)"
        translucent={false}
      />

      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            display: shouldHideAllTabs ? "none" : "flex",
            // ✅ PROPER HEIGHT CALCULATION WITH SAFE AREA
            height: 60 + (insets.bottom > 0 ? insets.bottom : 0),
            backgroundColor: "#FFFFFF",
            borderTopWidth: 1,
            borderTopColor: "#F3F4F6",
            paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
            paddingTop: 8,
            // ✅ SUBTLE SHADOW FOR SEPARATION
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.1,
            shadowRadius: 12,
            elevation: 12,
            // ✅ ADD EXTRA PADDING AT TOP FOR STATUS BAR CLEARANCE
            marginTop: 0,
          },
          tabBarActiveTintColor: "#0F4A2F",
          tabBarInactiveTintColor: "#9CA3AF",
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: "600",
            marginTop: 4,
          },
          // ✅ ADD SPACING ABOVE TAB BAR CONTENT
          tabBarContentContainerStyle: {
            paddingTop: 4,
          },
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "home" : "home-outline"}
                size={24}
                color={color}
              />
            ),
            tabBarLabel: "Home",
          }}
        />
        <Tabs.Screen
          name="Area"
          options={{
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "layers" : "layers-outline"}
                size={24}
                color={color}
              />
            ),
            tabBarLabel: "Assess",
          }}
        />

        <Tabs.Screen
          name="delivery"
          options={{
            tabBarIcon: ({ color, focused }) => (
              <MaterialCommunityIcons
                name={focused ? "truck-delivery" : "truck-delivery-outline"}
                size={24}
                color={color}
              />
            ),
            tabBarLabel: "Deliveries",
          }}
        />

        <Tabs.Screen
          name="monitoring"
          options={{
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "clipboard" : "clipboard-outline"}
                size={24}
                color={color}
              />
            ),
            tabBarLabel: "Reports",
          }}
        />

        <Tabs.Screen
          name="profile"
          options={{
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "person" : "person-outline"}
                size={24}
                color={color}
              />
            ),
            tabBarLabel: "Profile",
          }}
        />

        {/* ─── HIDDEN ROUTES (Detail screens that should not appear in tab bar) ─── */}
        <Tabs.Screen name="notifications" options={{ href: null }} />
        <Tabs.Screen name="map" options={{ href: null }} />
        <Tabs.Screen name="reports" options={{ href: null }} />
        <Tabs.Screen name="deliverydetail" options={{ href: null }} />

        {/* ✅ NEW: Hide the Monitoring Detail Screen from the tab bar */}
        <Tabs.Screen name="monitoring/[id]" options={{ href: null }} />
        <Tabs.Screen name="monitoringdetail" options={{ href: null }} />
      </Tabs>
    </>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
  },
});
