import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Tabs, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { api } from "@/constants/url_fixed";

// ✅ Cross-platform token storage (same as LoginModal)
const TOKEN_KEY = "token";

const getToken = async () => {
  if (Platform.OS === "web") return localStorage.getItem(TOKEN_KEY);
  return await SecureStore.getItemAsync(TOKEN_KEY);
};

/* ---------- USER DATA TYPE ---------- */
type UserData = {
  id: number;
  email: string;
  profile_img: string | null;
  full_name: string;
  user_role: string | null;
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

    // ✅ Poll unread count every 60 seconds (NO document.hidden - React Native doesn't have it!)
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

      const res = await fetch(`${api}/api/get_me/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (res.ok) {
        const data = await res.json();
        setUserData(data);
      } else {
        console.warn("Failed to fetch user data:", res.status);
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

      const res = await fetch(`${api}/api/notifications/unread-count/`, {
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

  // ✅ Fallback name if data is still loading
  const displayName = userData?.full_name || "Tree Grower";
  const displayEmail = userData?.email || "Loading...";
  const profileImage = userData?.profile_img;

  // ✅ Format badge count
  const badgeText = unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <View style={[hdr.wrap, { paddingTop: insets.top + 10 }]}>
      {/* Left: avatar + name + role */}
      <TouchableOpacity
        style={hdr.left}
        activeOpacity={0.7}
        onPress={() => router.push("/profile")}
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
          <Image
            source={require("../../assets/images/logo.jpg")}
            style={hdr.avatar}
          />
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
        onPress={() => router.push("/tree_growers/notifications")}
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
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "home" : "home-outline"}
              size={24}
              color={color}
            />
          ),
          tabBarLabel: "Dashboard",
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
          tabBarLabel: "Application",
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
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="siteDetails" options={{ href: null }} />
      <Tabs.Screen name="reports" options={{ href: null }} />
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
