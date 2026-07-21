import React, { useState, useRef, useEffect } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated,
  SafeAreaView,
  Image,
  FlatList,
  Dimensions,
  ActivityIndicator,
  Platform,
  ImageSourcePropType,
} from "react-native";
import { MaterialCommunityIcons as Icon, Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import { api } from "@/constants/url_fixed";

const { width: screenWidth } = Dimensions.get("window");

const C = {
  bg: "#F5F7FB",
  primary: "#0f4a2f",
  primaryLight: "#134f38",
  primaryMid: "#4ba74e",
  purple: "#1e5c46",
  navy: "#1E5c46",
  gray: "#64748B",
  grayLight: "#94A3B8",
  border: "#E2E8F0",
  white: "#FFFFFF",
  green: "#22C55E",
  greenLight: "#DCFCE7",
  yellow: "#F59E0B",
  red: "#EF4444",
  card: "#dbdbdb",
};

// ─── AUTH TOKEN HELPER (moved here now that the header lives on Home) ──────
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

// ─── MOCK DATA FOR TREE GROWER CONTEXT ───────────────────────────────────────

const availableSites = [
  {
    id: 0,
    name: "Punta Reforestation Area",
    barangay: "Brgy. Punta",
    area: "2.5 ha",
    status: "Available",
  },
  {
    id: 1,
    name: "Uwak Community Site",
    barangay: "Brgy. Uwak",
    area: "1.8 ha",
    status: "Available",
  },
];

// The site this tree grower has actually been assigned to / taken on,
// as opposed to the general list of open sites below.
const mySite = {
  id: 0,
  name: "Punta Reforestation Area",
  barangay: "Brgy. Punta",
  area: "2.5 ha",
  status: "Under Monitoring",
  progress: 85,
  label: "85% Survival Rate",
};

// Type for carousel image source (can be local require or remote URI)
type CarouselImageSource = ImageSourcePropType | { uri: string };

// Type for carousel items
type CarouselItem = {
  id: number;
  key: string;
  title: string;
  description: string;
  cta: string;
  image: CarouselImageSource;
  route: string;
};

// ─────────────────────────────────────────────
// NOTE ON IMAGES:
// The `image` values below use a placeholder image
// service (picsum.photos, fixed seeds) to SIMULATE
// what real photography would look like in each
// carousel card, per the reference design. Swap the
// `uri` for real, licensed photography before shipping.
// ─────────────────────────────────────────────
const carouselItems: CarouselItem[] = [
  {
    id: 0,
    key: "apply",
    title: "Apply",
    description:
      "Apply to become a tree grower and get assigned to a reforestation site in Ormoc City.",
    cta: "Apply Now",
    image: require("@/assets/carusel_home/applys.png"),
    route: "/tree_growers/application",
  },
  {
    id: 1,
    key: "how-to-plant",
    title: "How to Plant",
    description:
      "Learn the proper way to plant, space, and care for your seedlings for the best survival rate.",
    cta: "View Guide",
    image: require("@/assets/carusel_home/howtoplant.png"),
    route: "/tree_growers/how-to-plant",
  },
  {
    id: 2,
    key: "about-us",
    title: "About Us",
    description:
      "Learn more about PlantScope and our GIS-based reforestation monitoring mission.",
    cta: "Learn More",
    image: require("@/assets/carusel_home/aboutus.png"),
    route: "/tree_growers/about",
  },
];

// ─── STYLES ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  // In-page header (replaces the old dark green navigation header).
  // Same background as the page, so it blends into the dashboard.
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 6,
    paddingBottom: 4,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.border,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.greenLight,
    justifyContent: "center",
    alignItems: "center",
  },
  welcomeText: { fontSize: 12, color: C.grayLight, fontWeight: "500" },
  nameText: { fontSize: 16, fontWeight: "800", color: C.primary },
  bellWrap: {
    position: "relative",
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: C.white,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 3,
    borderRadius: 9,
    backgroundColor: C.red,
    borderWidth: 1.5,
    borderColor: C.bg,
    justifyContent: "center",
    alignItems: "center",
  },
  badgeText: {
    color: C.white,
    fontSize: 9,
    fontWeight: "800",
    textAlign: "center",
  },

  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: C.white,
    borderRadius: 16,
    marginTop: 16,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  searchPlaceholder: { flex: 1, fontSize: 14, color: C.grayLight },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: "bold" },
  viewAllButton: { flexDirection: "row", alignItems: "center", gap: 2 },
  viewAllText: { fontSize: 14, fontWeight: "600" },
  courseCard: {
    flexDirection: "row",
    gap: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: C.white,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  courseThumbnail: {
    width: 80,
    height: 64,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  courseContent: { flex: 1 },
  courseTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: C.navy,
    marginBottom: 4,
  },
  courseLevel: { fontSize: 12, color: C.grayLight, marginBottom: 6 },
  studentInfo: { flexDirection: "row", alignItems: "center", gap: 8 },
  studentText: { fontSize: 12, color: C.gray },
  avatarItem: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: C.white,
    justifyContent: "center",
    alignItems: "center",
  },
  completedText: { fontSize: 12, fontWeight: "600", color: C.green },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: C.border,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 3 },
  progressText: { fontSize: 12, fontWeight: "600", color: C.gray },
  myCourseThumb: {
    width: 64,
    height: 56,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },

  // "My Site" — the single site this grower has taken
  mySiteCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.greenLight,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  mySiteThumb: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: C.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  mySiteStatusRow: { flexDirection: "row", marginTop: 4, marginBottom: 6 },
  mySiteStatusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: C.greenLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  mySiteStatusText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: C.primary,
  },
  mySiteLabel: {
    fontSize: 11,
    color: C.grayLight,
    marginTop: 4,
    fontWeight: "500",
  },

  // Two-line section header (e.g. "Top Recommended" / "in your nearest location")
  sectionHeaderStacked: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitleMain: { fontSize: 16, fontWeight: "bold" },
  sectionTitleSub: {
    fontSize: 12,
    color: C.grayLight,
    fontWeight: "500",
    marginTop: 1,
  },
  carouselCard: {
    height: 230,
    borderRadius: 24,
    overflow: "hidden",
    marginBottom: 20,
  },
  carouselImage: { width: "100%", height: "100%" },
  carouselOverlay: {
    position: "absolute",
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  carouselContent: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    justifyContent: "flex-end",
  },
  carouselTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: C.white,
    marginBottom: 6,
  },
  carouselDescription: {
    fontSize: 12,
    color: "rgba(255,255,255,0.9)",
    lineHeight: 18,
    marginBottom: 12,
  },
  carouselButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: C.white,
    alignSelf: "flex-start",
  },
  carouselButtonText: { fontSize: 12, fontWeight: "600", color: C.primary },
  carouselIndicatorContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginBottom: 20,
  },
  carouselIndicator: { width: 8, height: 8, borderRadius: 4 },
});

// ─── COMPONENTS ──────────────────────────────────────────────────────────────

function SiteCard({ item }: { item: (typeof availableSites)[0] }) {
  return (
    <View style={styles.courseCard}>
      <View style={[styles.courseThumbnail, { backgroundColor: C.primary }]}>
        <Icon name="map-marker-radius" size={32} color="white" />
      </View>
      <View style={styles.courseContent}>
        <Text style={styles.courseTitle}>{item.name}</Text>
        <Text style={styles.courseLevel}>
          {item.barangay} • {item.area}
        </Text>
        <View style={styles.studentInfo}>
          <View style={[styles.avatarItem, { backgroundColor: C.green }]}>
            <Icon name="check" size={10} color="white" />
          </View>
          <Text style={styles.studentText}>{item.status}</Text>
        </View>
      </View>
    </View>
  );
}

function MySiteCard({
  item,
  progressAnim,
  onPress,
}: {
  item: typeof mySite;
  progressAnim: Animated.Value;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.mySiteCard}
      activeOpacity={0.85}
      onPress={onPress}
    >
      <View style={styles.mySiteThumb}>
        <Icon name="sprout" size={26} color="white" />
      </View>
      <View style={styles.courseContent}>
        <Text style={styles.courseTitle}>{item.name}</Text>
        <Text style={styles.courseLevel}>
          {item.barangay} • {item.area}
        </Text>
        <View style={styles.mySiteStatusRow}>
          <View style={styles.mySiteStatusPill}>
            <Icon name="map-marker-check" size={12} color={C.primary} />
            <Text style={styles.mySiteStatusText}>{item.status}</Text>
          </View>
        </View>
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  backgroundColor: C.primary,
                  width: progressAnim.interpolate({
                    inputRange: [0, 100],
                    outputRange: ["0%", "100%"],
                  }),
                },
              ]}
            />
          </View>
          <Text style={styles.progressText}>{item.progress}%</Text>
        </View>
        <Text style={styles.mySiteLabel}>{item.label}</Text>
      </View>
      <Icon name="chevron-right" size={20} color={C.grayLight} />
    </TouchableOpacity>
  );
}

function CarouselCard({
  item,
  onPress,
}: {
  item: CarouselItem;
  onPress: (route: string) => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      style={[styles.carouselCard, { width: screenWidth - 32 }]}
      onPress={() => onPress(item.route)}
    >
      <Image
        source={item.image}
        style={styles.carouselImage}
        resizeMode="cover"
      />
      <View style={styles.carouselOverlay} />
      <View style={styles.carouselContent}>
        <Text style={styles.carouselTitle}>{item.title}</Text>
        <Text style={styles.carouselDescription}>{item.description}</Text>
        <View style={styles.carouselButton}>
          <Text style={styles.carouselButtonText}>{item.cta}</Text>
          <Icon name="arrow-right" size={14} color={C.primary} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── MAIN DASHBOARD ─────────────────────────────────────────────────────────

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [carouselIndex, setCarouselIndex] = useState(0);
  const mySiteProgressAnim = useRef(new Animated.Value(0)).current;
  const carouselRef = useRef<FlatList>(null);
  const crossfadeAnim = useRef(new Animated.Value(0)).current;

  // ─── Header state (moved from the old CustomHeader) ───
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchUserData();
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchUserData = async () => {
    try {
      const token = await getToken();
      if (!token) {
        setLoadingUser(false);
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
      setLoadingUser(false);
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

  const displayName = userData?.full_name || "Tree Grower";
  const profileImage = userData?.profile_img;
  const badgeText = unreadCount > 99 ? "99+" : String(unreadCount);

  useEffect(() => {
    Animated.timing(mySiteProgressAnim, {
      toValue: mySite.progress,
      duration: 800,
      delay: 500,
      useNativeDriver: false,
    }).start();
  }, [mySiteProgressAnim]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCarouselIndex((prevIndex) => {
        const nextIndex = (prevIndex + 1) % carouselItems.length;
        Animated.sequence([
          Animated.timing(crossfadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(crossfadeAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start();

        setTimeout(() => {
          carouselRef.current?.scrollToOffset({
            offset: nextIndex * (screenWidth - 32),
            animated: true,
          });
        }, 100);

        return nextIndex;
      });
    }, 4000);
    return () => clearInterval(interval);
  }, [crossfadeAnim]);

  const goTo = (route: string) => router.push(route as any);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={{ paddingHorizontal: 16 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* In-page header — blends with the dashboard background */}
        <View style={[styles.headerRow, { paddingTop: insets.top + 14 }]}>
          <TouchableOpacity
            style={styles.headerLeft}
            activeOpacity={0.7}
            onPress={() => router.push("/profile" as any)}
          >
            {loadingUser ? (
              <View style={styles.avatarPlaceholder}>
                <ActivityIndicator size="small" color={C.primary} />
              </View>
            ) : profileImage ? (
              <Image
                source={{ uri: profileImage }}
                style={styles.avatar}
                defaultSource={require("../../assets/images/logo.jpg")}
              />
            ) : (
              <Image
                source={require("../../assets/images/logo.jpg")}
                style={styles.avatar}
              />
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.welcomeText}>Welcome Back!</Text>
              <Text style={styles.nameText} numberOfLines={1}>
                {displayName}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.bellWrap}
            activeOpacity={0.7}
            onPress={() => router.push("/tree_growers/notifications" as any)}
          >
            <Ionicons
              name="notifications-outline"
              size={20}
              color={C.primary}
            />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{badgeText}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Icon name="magnify" size={18} color={C.grayLight} />
          <Text style={styles.searchPlaceholder}>
            Search sites, applications...
          </Text>
          <Icon name="tune" size={16} color={C.gray} />
        </View>

        {/* Featured Carousel: Apply / How to Plant / About Us */}
        <View style={{ marginHorizontal: -16, paddingHorizontal: 16 }}>
          <View style={{ height: 240 }}>
            <FlatList
              ref={carouselRef}
              data={carouselItems}
              renderItem={({ item }) => (
                <CarouselCard item={item} onPress={goTo} />
              )}
              keyExtractor={(item) => item.id.toString()}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              scrollEventThrottle={16}
              snapToAlignment="center"
              decelerationRate="fast"
              onMomentumScrollEnd={(e) => {
                const currentIndex = Math.round(
                  e.nativeEvent.contentOffset.x / (screenWidth - 32),
                );
                setCarouselIndex(currentIndex);
              }}
            />
          </View>
        </View>

        {/* Carousel Indicators */}
        <Animated.View
          style={[
            styles.carouselIndicatorContainer,
            {
              opacity: crossfadeAnim.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [1, 0.5, 1],
              }),
            },
          ]}
        >
          {carouselItems.map((_, index) => (
            <Animated.View
              key={index}
              style={[
                styles.carouselIndicator,
                {
                  backgroundColor:
                    index === carouselIndex ? C.primary : C.border,
                  opacity: index === carouselIndex ? 1 : 0.5,
                  width: index === carouselIndex ? 20 : 8,
                },
              ]}
            />
          ))}
        </Animated.View>

        {/* My Site — the site this grower has actually taken */}
        <View style={{ marginBottom: 20 }}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: C.navy }]}>
              My Site
            </Text>
            <TouchableOpacity
              style={styles.viewAllButton}
              onPress={() => router.push("/tree_growers/siteDetails" as any)}
            >
              <Text style={[styles.viewAllText, { color: C.primary }]}>
                View All
              </Text>
              <Icon name="chevron-right" size={14} color={C.primary} />
            </TouchableOpacity>
          </View>
          <MySiteCard
            item={mySite}
            progressAnim={mySiteProgressAnim}
            onPress={() => router.push("/tree_growers/siteDetails" as any)}
          />
        </View>

        {/* Available Sites, renamed to match the "recommended near you" framing */}
        <View style={{ marginBottom: 20 }}>
          <View style={styles.sectionHeaderStacked}>
            <View>
              <Text style={[styles.sectionTitleMain, { color: C.primary }]}>
                Top Recommended
              </Text>
              <Text style={styles.sectionTitleSub}>
                in your nearest location
              </Text>
            </View>
            <TouchableOpacity
              style={styles.viewAllButton}
              onPress={() => router.push("/tree_growers/sites" as any)}
            >
              <Text style={[styles.viewAllText, { color: C.primary }]}>
                View All
              </Text>
              <Icon name="chevron-right" size={14} color={C.primary} />
            </TouchableOpacity>
          </View>
          {availableSites.map((site) => (
            <SiteCard key={site.id} item={site} />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
