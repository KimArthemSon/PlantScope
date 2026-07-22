import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

// Same background used by the Home dashboard, so the status bar
// area blends seamlessly instead of showing a separate colored bar.
const DASHBOARD_BG = "#F5F7FB";

/* ---------- LAYOUT ---------- */
export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <>
      {/*
        Status bar now always blends into the page background and
        uses dark icons/text (dark-content), since screens no longer
        have a dark green header bar behind it.
      */}
      <StatusBar style="dark" backgroundColor={DASHBOARD_BG} />

      <Tabs
        screenOptions={{
          // Header removed globally. The Home screen renders its own
          // in-page header (avatar, welcome text, notification bell)
          // that scrolls with the dashboard content instead of a fixed
          // navigation header.
          headerShown: false,
          tabBarStyle: {
            backgroundColor: "#FFFFFF",
            borderTopWidth: 1,
            borderTopColor: "#E5E7EB",
            height: 60 + insets.bottom,
            paddingBottom: insets.bottom > 0 ? insets.bottom : 10,
            paddingTop: 8,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -3 },
            shadowOpacity: 0.08,
            shadowRadius: 10,
            elevation: 12,
          },
          tabBarActiveTintColor: "#0F4A2F",
          tabBarInactiveTintColor: "#9CA3AF",
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: "600",
            marginTop: 2,
          },
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            title: "Home",
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
          name="sites"
          options={{
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "map" : "map-outline"}
                size={24}
                color={color}
              />
            ),
            tabBarLabel: "Sites",
          }}
        />

        <Tabs.Screen
          name="application"
          options={{
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "document-text" : "document-text-outline"}
                size={24}
                color={color}
              />
            ),
            tabBarLabel: "My Site",
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

        <Tabs.Screen name="Reapply" options={{ href: null }} />
        <Tabs.Screen name="index" options={{ href: null }} />
        <Tabs.Screen name="notifications" options={{ href: null }} />
        <Tabs.Screen name="siteDetails" options={{ href: null }} />
        <Tabs.Screen name="reports" options={{ href: null }} />
        <Tabs.Screen name="progressReports" options={{ href: null }} />
        <Tabs.Screen name="seedlingRequests" options={{ href: null }} />
        <Tabs.Screen name="CreateSeedlingRequest" options={{ href: null }} />
        <Tabs.Screen name="SeedlingRequestDetail" options={{ href: null }} />
      </Tabs>
    </>
  );
}
