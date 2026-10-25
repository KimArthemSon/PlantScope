import React, { useState, useEffect, useCallback } from "react";
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  RefreshControl,
  StatusBar,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/constants/url_fixed";
import { useNetworkStatus } from "@/utils/networkStatus";
import { getToken, clearAuthData, isAuthFailure } from "@/utils/auth";

const screenWidth = Dimensions.get("window").width;
const API = api + "/api";

const BG = "#F3F6F4";
const PRIMARY = "#0F4A2F";
const ACCENT = "#5FD08A";
const INK = "#111827";
const MUTED = "#6B7280";
const FAINT = "#9CA3AF";

/** How many to-do items to show before "Show all". */
const TASK_PREVIEW = 3;

/* ──────────────────────────────────────────────────────────────────
   TYPES
   ──────────────────────────────────────────────────────────────── */
interface HomeSummary {
  inspector: { first_name: string; full_name: string; email: string; profile_img: string | null };
  areas: { id: number }[];
  returned_reports: { id: number; site_id: number; site_name: string; notes: string | null; returned_by: string }[];
  handovers: { id: number; group_name: string; site_name: string | null; quantity: number }[];
  orientations: { application_id: number; group_name: string; site_id: number | null; site_name: string | null; days_until: number }[];
  sites_due: {
    site_id: number;
    site_name: string;
    group_name: string;
    urgency: "high" | "medium" | "ok";
    reason: string;
    report_returned: boolean;
  }[];
  drafts: number;
  this_month: { visits_submitted: number; visits_accepted: number; plants_recorded: number };
  recent_assessments: {
    field_assessment_id: number;
    area_id: number | null;
    area_name: string;
    site_id: number | null;
    site_name: string;
    status: "submitted" | "draft";
    date: string | null;
  }[];
}

interface Task {
  key: string;
  icon: string;
  tone: { fg: string; bg: string };
  title: string;
  subtitle: string;
  tag: string;
  onPress: () => void;
}

const TONE = {
  red: { fg: "#DC2626", bg: "#FEE2E2" },
  amber: { fg: "#D97706", bg: "#FEF3C7" },
  blue: { fg: "#2563EB", bg: "#DBEAFE" },
  green: { fg: "#059669", bg: "#D1FAE5" },
};

const fmt = (n: number | null | undefined) => (n ?? 0).toLocaleString();
const shortDate = (iso: string | null) =>
  iso ? new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

/* ──────────────────────────────────────────────────────────────────
   HEADER
   ──────────────────────────────────────────────────────────────── */
const Header: React.FC<{ inspector: HomeSummary["inspector"]; taskCount: number; isRefreshing: boolean }> = ({
  inspector,
  taskCount,
  isRefreshing,
}) => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isOnline = useNetworkStatus();
  const [unread, setUnread] = useState(0);

  const fetchUnread = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`${API}/notifications/unread-count/`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setUnread((await res.json()).unread_count || 0);
    } catch {
      /* badge is optional */
    }
  }, []);

  useEffect(() => {
    if (!isOnline) return;
    fetchUnread();
    const t = setInterval(fetchUnread, 60000);
    return () => clearInterval(t);
  }, [isOnline, fetchUnread]);

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const [imgFailed, setImgFailed] = useState(false);
  const initials = inspector.full_name
    .split(/[\s@]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  return (
    <View style={[hdr.wrap, { paddingTop: insets.top + 14 }]}>
      <View style={[hdr.circle, { width: 200, height: 200, top: -80, right: -60 }]} />
      <View style={hdr.row}>
        <TouchableOpacity style={hdr.profile} activeOpacity={0.8} onPress={() => router.push("/(tabs)/profile" as any)}>
          {inspector.profile_img && !imgFailed ? (
            <Image source={{ uri: inspector.profile_img }} style={hdr.avatar} onError={() => setImgFailed(true)} />
          ) : (
            <View style={[hdr.avatar, hdr.avatarFallback]}>
              <Text style={hdr.avatarText}>{initials || "?"}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={hdr.name} numberOfLines={1}>
              {inspector.full_name}
            </Text>
            <Text style={hdr.email} numberOfLines={1}>
              {inspector.email}
            </Text>
          </View>
        </TouchableOpacity>
        {isRefreshing && <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />}
        {isOnline && (
          <TouchableOpacity style={hdr.bell} activeOpacity={0.7} onPress={() => router.push("/(tabs)/notifications")}>
            <Ionicons name="notifications-outline" size={20} color="#fff" />
            {unread > 0 && (
              <View style={hdr.badge}>
                <Text style={hdr.badgeText}>{unread > 99 ? "99+" : unread}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      </View>

      <Text style={hdr.date}>{today}</Text>
      <Text style={hdr.greeting} numberOfLines={1}>
        {greeting()}, {inspector.first_name}
      </Text>

      <View style={hdr.status}>
        <MaterialCommunityIcons
          name={taskCount > 0 ? "clipboard-alert-outline" : "check-decagram-outline"}
          size={20}
          color={taskCount > 0 ? "#FBBF24" : ACCENT}
        />
        <Text style={hdr.statusText}>
          {taskCount > 0 ? `${taskCount} task${taskCount > 1 ? "s" : ""} need${taskCount > 1 ? "" : "s"} your attention` : "You're all caught up"}
        </Text>
      </View>
    </View>
  );
};

/* ──────────────────────────────────────────────────────────────────
   SMALL COMPONENTS
   ──────────────────────────────────────────────────────────────── */
const QuickAction: React.FC<{ icon: string; label: string; color: string; badge?: number; onPress: () => void }> = ({
  icon,
  label,
  color,
  badge,
  onPress,
}) => (
  <TouchableOpacity style={styles.quick} activeOpacity={0.75} onPress={onPress}>
    {/* Opaque white tile carries the shadow; the tint sits inside it so Android
        doesn't draw its shadow through a see-through background. */}
    <View style={styles.quickIcon}>
      <View style={[styles.quickInner, { backgroundColor: color + "1A" }]}>
        <MaterialCommunityIcons name={icon as any} size={24} color={color} />
      </View>
      {!!badge && badge > 0 && (
        <View style={styles.quickBadge}>
          <Text style={styles.quickBadgeText}>{badge > 9 ? "9+" : badge}</Text>
        </View>
      )}
    </View>
    <Text style={styles.quickLabel}>{label}</Text>
  </TouchableOpacity>
);

const TaskRow: React.FC<{ task: Task; last: boolean }> = ({ task, last }) => (
  <TouchableOpacity style={[styles.row, last && { borderBottomWidth: 0 }]} activeOpacity={0.7} onPress={task.onPress}>
    <View style={[styles.rowIcon, { backgroundColor: task.tone.bg }]}>
      <MaterialCommunityIcons name={task.icon as any} size={20} color={task.tone.fg} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={styles.rowTitle} numberOfLines={1}>
        {task.title}
      </Text>
      <Text style={styles.rowSub} numberOfLines={1}>
        {task.subtitle}
      </Text>
    </View>
    <View style={[styles.tag, { backgroundColor: task.tone.bg }]}>
      <Text style={[styles.tagText, { color: task.tone.fg }]}>{task.tag}</Text>
    </View>
  </TouchableOpacity>
);

/* ──────────────────────────────────────────────────────────────────
   MAIN SCREEN
   ──────────────────────────────────────────────────────────────── */
const Home: React.FC = () => {
  const router = useRouter();
  const isOnline = useNetworkStatus();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<HomeSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAllTasks, setShowAllTasks] = useState(false);

  const goToLogin = useCallback(async () => {
    await clearAuthData();
    router.replace("/homepage");
  }, [router]);

  const fetchData = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      await goToLogin();
      return;
    }
    if (!isOnline) {
      // Logged in but offline → inspector offline mode (saved areas)
      router.replace("/Area");
      return;
    }
    try {
      setError(null);
      const res = await fetch(`${API}/inspector/home-summary/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (isAuthFailure(res.status)) {
        await goToLogin();
        return;
      }
      if (!res.ok) throw new Error("Failed to load your dashboard");
      setData((await res.json()).data);
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isOnline, router, goToLogin]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={PRIMARY} />
        <Text style={styles.centerText}>Loading…</Text>
      </View>
    );
  }

  if (error && !data) {
    return (
      <View style={styles.center}>
        <Ionicons name="cloud-offline-outline" size={52} color={FAINT} />
        <Text style={styles.errorTitle}>Connection Error</Text>
        <Text style={styles.errorMsg}>{error}</Text>
        <TouchableOpacity style={styles.btn} onPress={fetchData}>
          <Text style={styles.btnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const d = data!;
  const openSite = (id: number) => router.push(`/(tabs)/monitoring/${id}` as any);

  // One simple to-do list, most urgent first
  const tasks: Task[] = [
    ...d.returned_reports.map((r) => ({
      key: `ret-${r.id}`,
      icon: "file-undo-outline",
      tone: TONE.red,
      title: `Fix report · ${r.site_name}`,
      subtitle: r.notes ? `“${r.notes}”` : `Sent back by ${r.returned_by}`,
      tag: "Fix",
      onPress: () => openSite(r.site_id),
    })),
    ...d.sites_due
      .filter((s) => s.urgency === "high" && !s.report_returned)
      .map((s) => ({
        key: `due-${s.site_id}`,
        icon: "map-marker-alert-outline",
        tone: TONE.red,
        title: `Visit ${s.site_name}`,
        subtitle: s.reason,
        tag: "Overdue",
        onPress: () => openSite(s.site_id),
      })),
    ...d.handovers.map((h) => ({
      key: `ho-${h.id}`,
      icon: "package-variant-closed",
      tone: TONE.amber,
      title: `Deliver ${fmt(h.quantity)} seedlings`,
      subtitle: `${h.group_name}${h.site_name ? ` · ${h.site_name}` : ""}`,
      tag: "Deliver",
      onPress: () => router.push("/delivery" as any),
    })),
    ...d.orientations
      .filter((o) => o.days_until >= 0 && o.days_until <= 7)
      .map((o) => ({
        key: `or-${o.application_id}`,
        icon: "account-group-outline",
        tone: TONE.blue,
        title: `Orientation · ${o.group_name}`,
        subtitle: o.site_name ?? "Site",
        tag: o.days_until === 0 ? "Today" : o.days_until === 1 ? "Tomorrow" : `In ${o.days_until}d`,
        onPress: () => (o.site_id ? openSite(o.site_id) : router.push("/monitoring")),
      })),
    ...d.sites_due
      .filter((s) => s.urgency === "medium" && !s.report_returned)
      .map((s) => ({
        key: `due-${s.site_id}`,
        icon: "map-marker-radius-outline",
        tone: TONE.amber,
        title: `Visit ${s.site_name}`,
        subtitle: s.reason,
        tag: "Due",
        onPress: () => openSite(s.site_id),
      })),
  ];
  const visibleTasks = showAllTasks ? tasks : tasks.slice(0, TASK_PREVIEW);
  const dueCount = d.sites_due.filter((s) => s.urgency !== "ok").length;
  const m = d.this_month;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY} translucent={false} />
      <ScrollView
        style={styles.root}
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PRIMARY} colors={[PRIMARY]} />}
      >
        <Header inspector={d.inspector} taskCount={tasks.length} isRefreshing={refreshing} />

        {/* Quick actions */}
        <View style={styles.quickRow}>
          <QuickAction icon="clipboard-plus-outline" label="Assess" color={PRIMARY} badge={d.drafts} onPress={() => router.push("/Area")} />
          <QuickAction icon="sprout-outline" label="Monitor" color="#059669" badge={dueCount} onPress={() => router.push("/monitoring")} />
          <QuickAction icon="truck-delivery-outline" label="Deliver" color="#D97706" badge={d.handovers.length} onPress={() => router.push("/delivery" as any)} />
          <QuickAction icon="map-search-outline" label="Map" color="#2563EB" onPress={() => router.push("/(tabs)/map")} />
        </View>

        {/* To do */}
        <Text style={styles.section}>To do</Text>
        <View style={styles.card}>
          {tasks.length === 0 ? (
            <View style={styles.empty}>
              <MaterialCommunityIcons name="check-decagram" size={34} color={ACCENT} />
              <Text style={styles.emptyTitle}>Nothing to do right now</Text>
              <Text style={styles.emptySub}>Pull down to refresh.</Text>
            </View>
          ) : (
            <>
              {visibleTasks.map((t, i) => (
                <TaskRow key={t.key} task={t} last={i === visibleTasks.length - 1 && tasks.length <= TASK_PREVIEW} />
              ))}
              {tasks.length > TASK_PREVIEW && (
                <TouchableOpacity style={styles.more} onPress={() => setShowAllTasks((v) => !v)} activeOpacity={0.7}>
                  <Text style={styles.moreText}>{showAllTasks ? "Show less" : `Show all ${tasks.length}`}</Text>
                  <Ionicons name={showAllTasks ? "chevron-up" : "chevron-down"} size={14} color={PRIMARY} />
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        {/* This month */}
        <Text style={styles.section}>This month</Text>
        <View style={[styles.card, styles.monthRow]}>
          <View style={styles.monthItem}>
            <Text style={styles.monthValue}>{fmt(m.visits_submitted)}</Text>
            <Text style={styles.monthLabel}>Visits</Text>
          </View>
          <View style={styles.monthDivider} />
          <View style={styles.monthItem}>
            <Text style={styles.monthValue}>{fmt(m.visits_accepted)}</Text>
            <Text style={styles.monthLabel}>Accepted</Text>
          </View>
          <View style={styles.monthDivider} />
          <View style={styles.monthItem}>
            <Text style={styles.monthValue}>{fmt(m.plants_recorded)}</Text>
            <Text style={styles.monthLabel}>Plants</Text>
          </View>
        </View>

        {/* Recent assessments */}
        {d.recent_assessments.length > 0 && (
          <>
            <Text style={styles.section}>Recent assessments</Text>
            <View style={styles.card}>
              {d.recent_assessments.slice(0, 3).map((a, i, arr) => {
                const done = a.status === "submitted";
                const tone = done ? TONE.green : TONE.amber;
                return (
                  <TouchableOpacity
                    key={a.field_assessment_id}
                    style={[styles.row, i === arr.length - 1 && { borderBottomWidth: 0 }]}
                    activeOpacity={0.7}
                    onPress={() =>
                      a.area_id &&
                      router.push({
                        pathname: "/feedbacks/site_field_assessment",
                        params: {
                          areaId: String(a.area_id),
                          areaName: a.area_name,
                          ...(a.site_id ? { siteId: String(a.site_id), siteName: a.site_name } : {}),
                          assessmentType: a.site_id ? "specific" : "general",
                        },
                      } as any)
                    }
                  >
                    <View style={[styles.rowIcon, { backgroundColor: tone.bg }]}>
                      <MaterialCommunityIcons name={done ? "check-circle-outline" : "pencil-outline"} size={20} color={tone.fg} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {a.site_name}
                      </Text>
                      <Text style={styles.rowSub} numberOfLines={1}>
                        {a.area_name}
                        {a.date ? ` · ${shortDate(a.date)}` : ""}
                      </Text>
                    </View>
                    <View style={[styles.tag, { backgroundColor: tone.bg }]}>
                      <Text style={[styles.tagText, { color: tone.fg }]}>{done ? "Submitted" : "Draft"}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
};

/* ──────────────────────────────────────────────────────────────────
   STYLES
   ──────────────────────────────────────────────────────────────── */
const shadow = {
  shadowColor: "#0F172A",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.05,
  shadowRadius: 10,
  elevation: 2,
};

const hdr = StyleSheet.create({
  wrap: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: "hidden",
  },
  circle: { position: "absolute", borderRadius: 999, backgroundColor: "#FFFFFF", opacity: 0.07 },
  row: { flexDirection: "row", alignItems: "center", marginBottom: 18 },
  profile: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, marginRight: 10 },
  avatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: "rgba(255,255,255,0.35)" },
  avatarFallback: { backgroundColor: ACCENT, alignItems: "center", justifyContent: "center" },
  avatarText: { color: PRIMARY, fontSize: 17, fontWeight: "800" },
  name: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  email: { color: "rgba(255,255,255,0.6)", fontSize: 12, marginTop: 1 },
  date: { color: "rgba(255,255,255,0.6)", fontSize: 12.5, fontWeight: "600" },
  greeting: { color: "#FFFFFF", fontSize: 23, fontWeight: "800", marginTop: 2, letterSpacing: -0.3 },
  bell: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: 5,
    right: 5,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: "#EF4444",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: PRIMARY,
  },
  badgeText: { color: "#FFFFFF", fontSize: 8.5, fontWeight: "800" },
  status: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 16,
    backgroundColor: "rgba(0,0,0,0.18)",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  statusText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700", flex: 1 },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: BG, paddingHorizontal: 40 },
  centerText: { marginTop: 12, fontSize: 14, color: MUTED },
  errorTitle: { fontSize: 17, fontWeight: "700", color: INK, marginTop: 16, marginBottom: 8 },
  errorMsg: { fontSize: 14, color: MUTED, textAlign: "center", marginBottom: 24 },
  btn: { backgroundColor: PRIMARY, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 12 },
  btnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },

  quickRow: { flexDirection: "row", justifyContent: "space-between", marginHorizontal: 20, marginTop: 20 },
  quick: { alignItems: "center", width: (screenWidth - 40) / 4 },
  quickIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    ...shadow,
  },
  quickInner: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  quickBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: BG,
  },
  quickBadgeText: { color: "#fff", fontSize: 9, fontWeight: "800" },
  quickLabel: { fontSize: 12, color: INK, fontWeight: "600", marginTop: 8 },

  section: { fontSize: 16, fontWeight: "800", color: INK, marginHorizontal: 20, marginTop: 26, marginBottom: 10 },
  card: { backgroundColor: "#FFFFFF", marginHorizontal: 20, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 4, ...shadow },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#EEF0F2",
  },
  rowIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  rowTitle: { fontSize: 14, fontWeight: "700", color: INK },
  rowSub: { fontSize: 12, color: MUTED, marginTop: 2 },
  tag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 9 },
  tagText: { fontSize: 11, fontWeight: "800" },

  more: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 12 },
  moreText: { fontSize: 12.5, color: PRIMARY, fontWeight: "700" },

  empty: { alignItems: "center", paddingVertical: 24 },
  emptyTitle: { fontSize: 14.5, fontWeight: "700", color: INK, marginTop: 8 },
  emptySub: { fontSize: 12, color: MUTED, marginTop: 2 },

  monthRow: { flexDirection: "row", alignItems: "center", paddingVertical: 16 },
  monthItem: { flex: 1, alignItems: "center" },
  monthValue: { fontSize: 22, fontWeight: "800", color: INK },
  monthLabel: { fontSize: 12, color: MUTED, marginTop: 2, fontWeight: "500" },
  monthDivider: { width: 1, height: 30, backgroundColor: "#EEF0F2" },
});

export default Home;
