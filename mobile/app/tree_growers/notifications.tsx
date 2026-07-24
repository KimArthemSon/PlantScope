import { useState, useEffect } from "react";
import { useRouter } from "expo-router";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import { api } from "@/constants/url_fixed";
import { useAlert } from "@/components/AlertContext";
import { useSafeAreaInsets } from "react-native-safe-area-context"; // ✅ Added for status bar spacing

const API = api + "/api";

/* ---------- TYPES ---------- */
type Notification = {
  notification_id: number;
  type: "alert" | "success" | "warning" | "info";
  title: string;
  description: string;
  link: string | null;
  is_read: boolean;
  is_general: boolean;
  created_at: string;
};

/* ---------- NOTIFICATION CONFIG ---------- */
const NOTIF_CONFIG = {
  alert: {
    icon: "alert-circle" as const,
    color: "#EF4444",
    bg: "#FEF2F2",
    border: "#FECACA",
  },
  success: {
    icon: "check-circle" as const,
    color: "#10B981",
    bg: "#ECFDF5",
    border: "#A7F3D0",
  },
  warning: {
    icon: "alert" as const,
    color: "#F59E0B",
    bg: "#FFFBEB",
    border: "#FDE68A",
  },
  info: {
    icon: "information" as const,
    color: "#3B82F6",
    bg: "#EFF6FF",
    border: "#BFDBFE",
  },
};

/* ---------- TIME AGO HELPER ---------- */
const timeAgo = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
  });
};

/* ---------- SCREEN ---------- */
export default function NotificationsPage() {
  const router = useRouter();
  const alert = useAlert();
  const insets = useSafeAreaInsets(); // ✅ Get safe area insets

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all");

  useEffect(() => {
    fetchNotifications();
  }, [filter]);

  const fetchNotifications = async () => {
    try {
      const token = await SecureStore.getItemAsync("token");
      if (!token) {
        router.replace("/homepage");
        return;
      }

      const params = new URLSearchParams({
        entries: "50",
        ...(filter === "unread" && { unread_only: "true" }),
        ...(filter === "read" && { read_only: "true" }),
      });

      const res = await fetch(`${API}/notifications/?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setNotifications(data.data || []);
        setUnreadCount(data.unread_count || 0);
      } else {
        alert.error("Error", "Failed to load notifications.");
      }
    } catch (e: any) {
      alert.error(
        "Network Error",
        e.message ?? "Unable to fetch notifications.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const handleMarkAsRead = async (id: number) => {
    try {
      const token = await SecureStore.getItemAsync("token");
      if (!token) return;

      const res = await fetch(`${API}/notifications/${id}/read/`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) =>
            n.notification_id === id ? { ...n, is_read: true } : n,
          ),
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (e) {
      console.error("Failed to mark as read:", e);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const token = await SecureStore.getItemAsync("token");
      if (!token) return;

      const res = await fetch(`${API}/notifications/mark-all-read/`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
        setUnreadCount(0);
        alert.success("Success", "All notifications marked as read.");
      }
    } catch (e) {
      console.error("Failed to mark all as read:", e);
    }
  };

  const handleNavigate = (link: string | null) => {
    if (link) {
      router.push(link as any);
    }
  };

  const renderNotification = (notif: Notification, index: number) => {
    const config = NOTIF_CONFIG[notif.type];
    const isLast = index === notifications.length - 1;

    return (
      <TouchableOpacity
        key={notif.notification_id}
        style={[
          styles.notifCard,
          !notif.is_read && styles.notifCardUnread,
          !isLast && styles.notifCardBorder,
        ]}
        onPress={() => {
          if (!notif.is_read) handleMarkAsRead(notif.notification_id);
          handleNavigate(notif.link);
        }}
        activeOpacity={0.7}
      >
        {/* Unread indicator */}
        {!notif.is_read && <View style={styles.unreadDot} />}

        {/* Icon */}
        <View style={[styles.iconContainer, { backgroundColor: config.bg }]}>
          <MaterialCommunityIcons
            name={config.icon}
            size={20}
            color={config.color}
          />
        </View>

        {/* Content */}
        <View style={styles.notifContent}>
          <View style={styles.notifHeader}>
            <Text
              style={[
                styles.notifTitle,
                !notif.is_read && styles.notifTitleUnread,
              ]}
            >
              {notif.title}
            </Text>
            <Text style={styles.notifTime}>{timeAgo(notif.created_at)}</Text>
          </View>

          {notif.description ? (
            <Text style={styles.notifDesc}>{notif.description}</Text>
          ) : null}

          {notif.link && (
            <View style={styles.linkContainer}>
              <Text style={styles.linkText}>View details →</Text>
            </View>
          )}
        </View>

        {/* Chevron */}
        <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0F4A2F" />
        <Text style={styles.loadingText}>Loading notifications…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      {/* ✅ Added dynamic paddingTop to clear the status bar */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={20} color="#0F4A2F" />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Text style={styles.headerText}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>
                {unreadCount > 99 ? "99+" : unreadCount}
              </Text>
            </View>
          )}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity
            style={styles.markAllButton}
            onPress={handleMarkAllAsRead}
          >
            <Text style={styles.markAllText}>Mark all</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {(["all", "unread", "read"] as const).map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterTab, filter === f && styles.filterTabActive]}
              onPress={() => setFilter(f)}
            >
              <Text
                style={[
                  styles.filterText,
                  filter === f && styles.filterTextActive,
                ]}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Notifications List */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#0F4A2F"
          />
        }
      >
        {notifications.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <MaterialCommunityIcons
                name="bell-off"
                size={40}
                color="#9CA3AF"
              />
            </View>
            <Text style={styles.emptyTitle}>No notifications</Text>
            <Text style={styles.emptyDesc}>
              {filter === "unread"
                ? "You've read all your notifications!"
                : "You're all caught up. Check back later for updates."}
            </Text>
          </View>
        ) : (
          notifications.map((notif, index) => renderNotification(notif, index))
        )}
      </ScrollView>
    </View>
  );
}

/* ---------- STYLES ---------- */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F7F5",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F4F7F5",
    gap: 12,
  },
  loadingText: {
    color: "#6B7280",
    fontSize: 14,
  },

  /* Header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 16, // ✅ Top padding is now handled dynamically inline
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#E6F4EC",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F2D1C",
  },
  headerBadge: {
    backgroundColor: "#EF4444",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  markAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  markAllText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#10B981",
  },

  /* Filter */
  filterContainer: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  filterTabActive: {
    borderBottomColor: "#0F4A2F",
  },
  filterText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
  },
  filterTextActive: {
    color: "#0F4A2F",
  },

  /* List */
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },

  /* Notification Card */
  notifCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    gap: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  notifCardUnread: {
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#86EFAC",
  },
  notifCardBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  unreadDot: {
    position: "absolute",
    top: 14,
    left: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10B981",
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  notifContent: {
    flex: 1,
    gap: 4,
  },
  notifHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  notifTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#0F2D1C",
  },
  notifTitleUnread: {
    fontWeight: "700",
  },
  notifTime: {
    fontSize: 11,
    color: "#9CA3AF",
    fontWeight: "500",
  },
  notifDesc: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 18,
  },
  linkContainer: {
    marginTop: 4,
  },
  linkText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#10B981",
  },

  /* Empty State */
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 12,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F2D1C",
  },
  emptyDesc: {
    fontSize: 13,
    color: "#9CA3AF",
    textAlign: "center",
    paddingHorizontal: 40,
  },
});
