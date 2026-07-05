import React, { useState, useEffect } from "react";
import {
  TouchableOpacity,
  View,
  Text,
  Image,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Tabs, useRouter } from "expo-router";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import { api } from "@/constants/url_fixed";

const API = api + "/api";

/* ---------- TYPES ---------- */
type UserData = {
  id: number;
  email: string;
  profile_img: string | null;
  full_name: string;
  user_role: string | null;
};

/* ---------- TOKEN STORAGE ---------- */
const TOKEN_KEY = "token";

const getToken = async () => {
  if (Platform.OS === "web") return localStorage.getItem(TOKEN_KEY);
  return await SecureStore.getItemAsync(TOKEN_KEY);
};

/* ---------- CUSTOM HEADER ---------- */
const CustomHeader: React.FC = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchUserData();
    fetchUnreadCount();

    // ✅ Poll unread count every 60 seconds
    const interval = setInterval(fetchUnreadCount, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchUserData = async () => {
    try {
      const token = await getToken();
      if (!token) {
        setLoading(false);
        return;
      }

      const res = await fetch(`${API}/get_me/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (res.ok) {
        const data = await res.json();
        setUserData(data);
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const token = await getToken();
      if (!token) return;

      const res = await fetch(`${API}/notifications/unread-count/`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.unread_count || 0);
      }
    } catch (error) {
      console.error("Error fetching unread count:", error);
    }
  };

  const displayName = userData?.full_name || "Inspector";
  const displayEmail = userData?.email || "Loading...";
  const profileImage = userData?.profile_img;

  // ✅ Format badge count
  const badgeText = unreadCount > 99 ? "99+" : String(unreadCount);

  // Get initials for fallback
  const getInitials = (name: string) => {
    return (
      name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2) || "I"
    );
  };

  return (
    <View style={[hdr.wrap, { paddingTop: insets.top + 10 }]}>
      {/* Left: avatar + name + email */}
      <TouchableOpacity
        style={hdr.left}
        activeOpacity={0.7}
        onPress={() => router.push("/(tabs)/profile")}
      >
        {loading ? (
          <View style={hdr.avatarPlaceholder}>
            <ActivityIndicator size="small" color="#FFFFFF" />
          </View>
        ) : profileImage ? (
          <Image
            source={{ uri: profileImage }}
            style={hdr.avatar}
            defaultSource={require("../../assets/images/logo.jpg")}
          />
        ) : (
          <View style={hdr.avatarFallback}>
            <Text style={hdr.avatarInitials}>{getInitials(displayName)}</Text>
          </View>
        )}
        <View style={hdr.textContainer}>
          <Text style={hdr.name} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={hdr.email} numberOfLines={1}>
            {displayEmail}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Right: notification bell with count badge */}
      <TouchableOpacity
        style={hdr.bellWrap}
        activeOpacity={0.7}
        onPress={() => router.push("/(tabs)/notifications")}
      >
        <Ionicons name="notifications-outline" size={23} color="#FFFFFF" />

        {/* ✅ Dynamic badge: shows count if > 0, otherwise small green dot */}
        {unreadCount > 0 ? (
          <View style={hdr.badge}>
            <Text style={hdr.badgeText}>{badgeText}</Text>
          </View>
        ) : (
          <View style={hdr.dot} />
        )}
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
          tabBarLabel: "Assessment",
        }}
      />

      {/* Map — floating center */}
      <Tabs.Screen
        name="map"
        options={{
          tabBarLabel: () => null,
          tabBarIcon: () => (
            <View style={styles.centerButton}>
              <MaterialCommunityIcons name="map" size={28} color="#FFFFFF" />
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
        name="monitoring"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "clipboard" : "clipboard-outline"}
              size={24}
              color={color}
            />
          ),
          tabBarLabel: "Monitoring",
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

      {/* Hidden routes */}
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="editProfile" options={{ href: null }} />
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
    flex: 1,
    marginRight: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.35)",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.35)",
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.35)",
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitials: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  textContainer: {
    flex: 1,
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
    padding: 6,
    minWidth: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#5FD08A",
    borderWidth: 1.5,
    borderColor: "#0F4A2F",
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: "#EF4444",
    borderWidth: 1.5,
    borderColor: "#0F4A2F",
    justifyContent: "center",
    alignItems: "center",
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
    textAlign: "center",
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
