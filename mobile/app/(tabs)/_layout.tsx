import React, { useState, useEffect } from "react";
import {
  TouchableOpacity,
  View,
  Text,
  Image,
  StyleSheet,
  ActivityIndicator,
  Platform,
  // ❌ REMOVED: Alert
} from "react-native";
import { Tabs, useRouter, usePathname } from "expo-router";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "@/constants/url_fixed";
import { useNetworkStatus } from "@/utils/networkStatus";

// ✅ ADDED: Import the useAlert hook
import { useAlert } from "@/components/AlertContext";

const API = api + "/api";
const USER_DATA_KEY = "@plantscope_user_data";

type UserData = {
  id: number;
  email: string;
  profile_img: string | null;
  full_name: string;
  user_role: string | null;
};

const TOKEN_KEY = "token";

const getToken = async () => {
  if (Platform.OS === "web") return localStorage.getItem(TOKEN_KEY);
  return await SecureStore.getItemAsync(TOKEN_KEY);
};

const CustomHeader: React.FC<{ isOnline: boolean }> = ({ isOnline }) => {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (isOnline) {
      fetchUserData();
      fetchUnreadCount();

      const interval = setInterval(fetchUnreadCount, 60000);
      return () => clearInterval(interval);
    } else {
      loadCachedUserData();
    }
  }, [isOnline]);

  const loadCachedUserData = async () => {
    try {
      const cached = await AsyncStorage.getItem(USER_DATA_KEY);
      if (cached) {
        setUserData(JSON.parse(cached));
      }
    } catch (error) {
      console.error("Error loading cached user data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserData = async () => {
    if (!isOnline) {
      setLoading(false);
      return;
    }

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
        await AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(data));
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    if (!isOnline) return;

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
  const displayEmail = userData?.email || "";
  const profileImage = userData?.profile_img;

  const badgeText = unreadCount > 99 ? "99+" : String(unreadCount);

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
      {/* Left Side: User Info (Not clickable when offline) */}
      <TouchableOpacity
        style={hdr.left}
        activeOpacity={0.7}
        onPress={() => {
          if (isOnline) {
            router.push("/(tabs)/profile");
          }
        }}
        disabled={!isOnline}
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

      <View style={hdr.rightContainer}>
        {/* Status Badge */}
        <View
          style={[
            hdr.statusBadge,
            {
              backgroundColor: isOnline
                ? "rgba(74, 222, 128, 0.15)"
                : "rgba(239, 68, 68, 0.15)",
            },
          ]}
        >
          <View
            style={[
              hdr.statusDot,
              { backgroundColor: isOnline ? "#4ADE80" : "#EF4444" },
            ]}
          />
          <Text
            style={[
              hdr.statusText,
              { color: isOnline ? "#4ADE80" : "#EF4444" },
            ]}
          >
            {isOnline ? "Online" : "Offline"}
          </Text>
        </View>

        {/* ✅ Notification Bell - Only show when online */}
        {isOnline && (
          <TouchableOpacity
            style={hdr.bellWrap}
            activeOpacity={0.7}
            onPress={() => router.push("/(tabs)/notifications")}
          >
            <Ionicons name="notifications-outline" size={23} color="#FFFFFF" />

            {unreadCount > 0 ? (
              <View style={hdr.badge}>
                <Text style={hdr.badgeText}>{badgeText}</Text>
              </View>
            ) : (
              <View style={hdr.dot} />
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const isOnline = useNetworkStatus();

  // ✅ ADDED: Initialize the warning method from useAlert
  const { warning } = useAlert();

  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasShownOfflineAlert, setHasShownOfflineAlert] = useState(false);

  useEffect(() => {
    const fetchUserRole = async () => {
      if (!isOnline) {
        setLoading(false);
        return;
      }

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
          setUserRole(data.user_role);
        }
      } catch (error) {
        console.error("Error fetching user role:", error);
      } finally {
        setLoading(false);
      }
    };

    if (isOnline) {
      fetchUserRole();
    } else {
      loadCachedUserRole();
    }
  }, [isOnline]);

  const loadCachedUserRole = async () => {
    try {
      const cached = await AsyncStorage.getItem(USER_DATA_KEY);
      if (cached) {
        const data = JSON.parse(cached);
        setUserRole(data.user_role);
      }
    } catch (error) {
      console.error("Error loading cached user role:", error);
    } finally {
      setLoading(false);
    }
  };

  const shouldHideAllTabs = !isOnline;

  useEffect(() => {
    if (shouldHideAllTabs && !loading) {
      if (!pathname.startsWith("/Area") && !pathname.startsWith("/feedbacks")) {
        router.replace("/Area");
      }

      // ✅ UPDATED: Replaced native Alert with custom warning() toast
      if (!hasShownOfflineAlert) {
        warning(
          "Offline Mode",
          "You are currently offline. Only Assessment is available.",
        );
        // Since toasts are non-blocking, we can immediately set this to true
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
    <Tabs
      key={shouldHideAllTabs ? "offline" : "online"}
      screenOptions={{
        header: () => <CustomHeader isOnline={isOnline} />,
        tabBarStyle: {
          display: shouldHideAllTabs ? "none" : "flex",
          height: shouldHideAllTabs ? 0 : 60 + insets.bottom,
          backgroundColor: "#FFFFFF",
          borderTopWidth: shouldHideAllTabs ? 0 : 1,
          borderTopColor: "#E5E7EB",
          paddingBottom: shouldHideAllTabs
            ? 0
            : insets.bottom > 0
              ? insets.bottom
              : 10,
          paddingTop: shouldHideAllTabs ? 0 : 8,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: shouldHideAllTabs ? 0 : 0.08,
          shadowRadius: shouldHideAllTabs ? 0 : 10,
          elevation: shouldHideAllTabs ? 0 : 12,
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
          tabBarButton: (props) => {
            if (shouldHideAllTabs) return null;
            return <TouchableOpacity {...props} />;
          },
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
          tabBarButton: (props) => {
            if (shouldHideAllTabs) return null;
            return <TouchableOpacity {...props} />;
          },
        }}
      />

      <Tabs.Screen
        name="map"
        options={{
          tabBarLabel: () => null,
          tabBarIcon: () => (
            <View style={styles.centerButton}>
              <MaterialCommunityIcons name="map" size={28} color="#FFFFFF" />
            </View>
          ),
          tabBarButton: (props) => {
            if (shouldHideAllTabs) return null;
            return (
              <TouchableOpacity
                onPress={props.onPress}
                accessibilityRole="button"
                accessibilityState={props.accessibilityState}
                style={[styles.centerTabButton, { bottom: insets.bottom }]}
              >
                {props.children}
              </TouchableOpacity>
            );
          },
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
          tabBarButton: (props) => {
            if (shouldHideAllTabs) return null;
            return <TouchableOpacity {...props} />;
          },
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
          tabBarButton: (props) => {
            if (shouldHideAllTabs) return null;
            return <TouchableOpacity {...props} />;
          },
        }}
      />

      <Tabs.Screen name="notifications" options={{ href: null }} />
    </Tabs>
  );
}

/* ---------- STYLES (Unchanged) ---------- */
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
  rightContainer: {
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
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "700",
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F4F7F5",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: "#6B7280",
  },
});
