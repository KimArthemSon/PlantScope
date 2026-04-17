import React from "react";
import { TouchableOpacity, StatusBar } from "react-native"; // 👈 Add StatusBar
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
// Remove unused imports: Stack, MaterialCommunityIcons, ListCheck (unless needed elsewhere)

export default function TabLayout() {
  return (
    <>
      {/* 🌲 Set status bar style to match your app */}
      <StatusBar 
        backgroundColor="#0F4A2F" 
        barStyle="light-content" 
        translucent={false}
         
      />
      
      <Tabs
        screenOptions={{
          headerShown: true,
          tabBarStyle: {
            backgroundColor: "#0F4A2F",
            borderTopWidth: 0,
            elevation: 0,
          },
          headerStyle: {
              height: 0,
          },
          tabBarActiveTintColor: "#FFFFFF",
          tabBarInactiveTintColor: "#B7D3C6",
        }}
      >
       
        <Tabs.Screen
          name="application"
          options={{
            title: "Application",
            tabBarIcon: ({ color }) => (
              <Ionicons name="folder" size={26} color={color} />
            ),
          }}
        />
         {/* Home Tab */}
        <Tabs.Screen
          name="reports"
          options={{
            title: "Reports",
            tabBarIcon: ({ color }) => (
              <Ionicons name="analytics" size={26} color={color} />
            ),
          }}
        />
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
    </>
  );
}