import React from "react";
import { TouchableOpacity, View, Text, Image, StyleSheet } from "react-native";
import { Tabs } from "expo-router";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/* ---------- CUSTOM HEADER ---------- */

const CustomHeader: React.FC = () => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[hdr.wrap, { paddingTop: insets.top + 10 }]}>
      {/* Left: avatar + name + email */}
      <View style={hdr.left}>
        <Image
          source={require("../../assets/images/logo.jpg")}
          style={hdr.avatar}
        />
        <View>
          <Text style={hdr.name}>Juan dela Cruz</Text>
          <Text style={hdr.email}>inspector@plantscopev2.ph</Text>
        </View>
      </View>

      {/* Right: notification bell */}
      <TouchableOpacity style={hdr.bellWrap} activeOpacity={0.7}>
        <Ionicons name="notifications-outline" size={23} color="#FFFFFF" />
        <View style={hdr.dot} />
      </TouchableOpacity>
    </View>
  );
};

/* ---------- LAYOUT ---------- */

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        header: () => <CustomHeader />,
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

      {/* Grow — floating center */}
      <Tabs.Screen
        name="Area"
        options={{
          tabBarLabel: () => null,
          tabBarIcon: () => (
            <View style={styles.centerButton}>
              <MaterialCommunityIcons name="sprout" size={28} color="#FFFFFF" />
            </View>
          ),
          tabBarButton: (props) => (
            <TouchableOpacity
              onPress={props.onPress}
              accessibilityRole="button"
              accessibilityState={props.accessibilityState}
              style={[styles.centerTabButton, { bottom: insets.bottom }]}
            >
              {props.children}
            </TouchableOpacity>
          ),
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
    </Tabs>
  );
}

/* ---------- STYLES ---------- */

const hdr = StyleSheet.create({
  wrap: {
    backgroundColor: "#0F4A2F",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.35)",
  },
  name: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
    lineHeight: 19,
  },
  email: {
    fontSize: 11,
    color: "rgba(255,255,255,0.65)",
    lineHeight: 15,
  },
  bellWrap: {
    position: "relative",
    padding: 4,
  },
  dot: {
    position: "absolute",
    top: 3,
    right: 3,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#5FD08A",
    borderWidth: 1.5,
    borderColor: "#0F4A2F",
  },
});

const styles = StyleSheet.create({
  centerButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#0F4A2F",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#0F4A2F",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 10,
  },
  centerTabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    top: -18,
  },
});
