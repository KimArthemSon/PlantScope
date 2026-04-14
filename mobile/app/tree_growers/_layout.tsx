import React from "react";
import { TouchableOpacity } from "react-native";
import { Stack, Tabs } from "expo-router";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        //   // 🌲 Header styling
          headerShown: true,
        //   headerStyle: {
        //     backgroundColor: "#0F4A2F", // Header background color
        //   },
        //   headerTintColor: "#FFFFFF", // Header text color
        //   headerTitleStyle: {
        //     fontWeight: "bold",
        //   },

        //   // 🔔 Bell icon on the right
        //   headerRight: () => (
        //     <TouchableOpacity style={{ marginRight: 15 }}>
        //       <Ionicons name="notifications-outline" size={24} color="#FFFFFF" />
        //     </TouchableOpacity>
        //   ),

        //   // 🌲 Bottom navigation styling
        tabBarStyle: {
          backgroundColor: "#0F4A2F",
          borderTopWidth: 0,
          elevation: 0, // Android shadow
          marginTop: 5,
        },

        //   // 🎨 Icon & label colors
        tabBarActiveTintColor: "#FFFFFF",
        tabBarInactiveTintColor: "#B7D3C6",
      }}
    >
      <Stack screenOptions={{ headerShown: false }} />
      {/* Home Tab */}
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color }) => (
            <Ionicons name="home" size={26} color={color} />
          ),
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="request"
        options={{
          title: "Request",
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="leaf" size={26} color={color} />
          ),
        }}
      />
      {/* Sites Tab */}

      {/* Profile Tab */}
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => (
            <Ionicons name="person" size={26} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
