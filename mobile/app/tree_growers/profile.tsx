import { useRouter } from "expo-router";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  Alert,
} from "react-native";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";

/* ---------- DATA ---------- */

const STATS = [
  { icon: "sprout",           value: "1,240", label: "Trees Planted" },
  { icon: "folder-outline",   value: "3",     label: "Applications"  },
  { icon: "clipboard-check",  value: "12",    label: "Reports"       },
];

const MENU: {
  section: string;
  items: { icon: string; label: string; path: string; danger?: boolean }[];
}[] = [
  {
    section: "Account",
    items: [
      { icon: "account-edit-outline", label: "Edit Profile",  path: "/editProfile" },
      { icon: "bell-outline",         label: "Notifications", path: "/"            },
    ],
  },
  {
    section: "Support",
    items: [
      { icon: "help-circle-outline", label: "Help & Support", path: "/" },
      { icon: "information-outline", label: "About",          path: "/" },
    ],
  },
];

/* ---------- SCREEN ---------- */

export default function ProfilePage() {
  const router = useRouter();

  const handleLogout = () => {
    Alert.alert(
      "Log Out",
      "Are you sure you want to log out?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Log Out", style: "destructive", onPress: () => router.replace("/login") },
      ]
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero Card */}
      <View style={styles.heroCard}>
        <View style={styles.avatarRing}>
          <Image
            source={require("../../assets/images/logo.jpg")}
            style={styles.avatar}
          />
        </View>

        <Text style={styles.heroName}>Juan dela Cruz</Text>
        <Text style={styles.heroEmail}>grower@plantscopev2.ph</Text>

        <View style={styles.roleBadge}>
          <Ionicons name="leaf" size={13} color="#0F4A2F" />
          <Text style={styles.roleText}>Tree Grower</Text>
        </View>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        {STATS.map((s) => (
          <View key={s.label} style={styles.statCard}>
            <MaterialCommunityIcons name={s.icon as any} size={22} color="#0F4A2F" />
            <Text style={styles.statValue}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Menu Sections */}
      {MENU.map((group) => (
        <View key={group.section} style={styles.menuGroup}>
          <Text style={styles.menuSection}>{group.section}</Text>
          <View style={styles.menuCard}>
            {group.items.map((item, idx) => (
              <TouchableOpacity
                key={item.label}
                style={[
                  styles.menuItem,
                  idx < group.items.length - 1 && styles.menuItemBorder,
                ]}
                onPress={() => router.push({ pathname: item.path as any })}
                activeOpacity={0.7}
              >
                <View style={styles.menuIconWrap}>
                  <MaterialCommunityIcons name={item.icon as any} size={18} color="#0F4A2F" />
                </View>
                <Text style={styles.menuLabel}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}

      {/* Logout */}
      <TouchableOpacity
        style={styles.logoutBtn}
        onPress={handleLogout}
        activeOpacity={0.85}
      >
        <MaterialCommunityIcons name="logout" size={18} color="#EF4444" />
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>

      <Text style={styles.version}>PlantScope v2.0  ·  Tree Grower Module</Text>
    </ScrollView>
  );
}

/* ---------- STYLES ---------- */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F7F5",
  },
  content: {
    paddingBottom: 36,
  },

  /* Hero */
  heroCard: {
    backgroundColor: "#0F4A2F",
    alignItems: "center",
    paddingTop: 32,
    paddingBottom: 28,
    paddingHorizontal: 20,
    marginBottom: 20,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  avatarRing: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.4)",
    marginBottom: 14,
    overflow: "hidden",
  },
  avatar: {
    width: "100%",
    height: "100%",
  },
  heroName: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  heroEmail: {
    fontSize: 13,
    color: "rgba(255,255,255,0.65)",
    marginBottom: 12,
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 5,
  },
  roleText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0F4A2F",
  },

  /* Stats */
  statsRow: {
    flexDirection: "row",
    marginHorizontal: 16,
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    gap: 4,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  statValue: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0F2D1C",
  },
  statLabel: {
    fontSize: 10,
    color: "#9CA3AF",
    fontWeight: "500",
    textAlign: "center",
  },

  /* Menu */
  menuGroup: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  menuSection: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  menuCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    overflow: "hidden",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  menuIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#E6F4EC",
    justifyContent: "center",
    alignItems: "center",
  },
  menuLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#0F2D1C",
  },

  /* Logout */
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 20,
    backgroundColor: "#FEF2F2",
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  logoutText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#EF4444",
  },

  /* Version */
  version: {
    textAlign: "center",
    fontSize: 11,
    color: "#9CA3AF",
  },
});
