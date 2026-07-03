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
} from "react-native";
import { MaterialCommunityIcons as Icon } from "@expo/vector-icons";
import { useRouter } from "expo-router";

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
  card: "#dbdbdb",
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

const ongoingActivities = [
  {
    id: 0,
    title: "Tree Planting Program 2024",
    status: "Under Monitoring",
    progress: 85,
    label: "85% Survival Rate",
  },
  {
    id: 1,
    title: "Seedling Request #102",
    status: "Accepted",
    progress: 100,
    label: "Seedlings Provided",
  },
];

const carouselItems = [
  {
    id: 0,
    title: "Request Seedlings",
    description:
      "Your application is accepted! You can now request seedlings for your assigned site.",
    image: require("../../assets/images/logo.jpg"),
  },
  {
    id: 1,
    title: "Orientation Schedule",
    description:
      "Don't forget to attend the tree planting orientation scheduled for next week.",
    image: require("../../assets/images/logo.jpg"),
  },
  {
    id: 2,
    title: "Submit Progress Report",
    description:
      "It's time to submit your monthly progress report with photos of your planted trees.",
    image: require("../../assets/images/logo.jpg"),
  },
];

// ─── STYLES ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
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

function ActivityCard({
  item,
  progressAnim,
}: {
  item: (typeof ongoingActivities)[0];
  progressAnim: Animated.Value;
}) {
  return (
    <View style={styles.courseCard}>
      <View style={[styles.myCourseThumb, { backgroundColor: C.primary }]}>
        <Icon name="sprout" size={24} color="white" />
      </View>
      <View style={styles.courseContent}>
        <Text style={styles.courseTitle}>{item.title}</Text>
        <Text
          style={[
            styles.completedText,
            {
              color: item.progress === 100 ? C.green : C.primary,
              marginTop: 4,
            },
          ]}
        >
          {item.label}
        </Text>
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  backgroundColor: item.progress === 100 ? C.green : C.primary,
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
      </View>
    </View>
  );
}

function CarouselCard({ item }: { item: (typeof carouselItems)[0] }) {
  return (
    <View style={[styles.carouselCard, { width: screenWidth - 32 }]}>
      <Image source={item.image} style={styles.carouselImage} />
      <View style={styles.carouselOverlay} />
      <View style={styles.carouselContent}>
        <Text style={styles.carouselTitle}>{item.title}</Text>
        <Text style={styles.carouselDescription}>{item.description}</Text>
        <TouchableOpacity style={styles.carouselButton}>
          <Text style={styles.carouselButtonText}>Take Action</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── MAIN DASHBOARD ──────────────────────────────────────────────────────────

export default function Dashboard() {
  const router = useRouter();
  const [carouselIndex, setCarouselIndex] = useState(0);
  const floatingAnim = useRef(new Animated.Value(0)).current;
  const progressAnims = useRef(
    ongoingActivities.map(() => new Animated.Value(0)),
  ).current;
  const carouselRef = useRef<FlatList>(null);
  const crossfadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatingAnim, {
          toValue: -4,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(floatingAnim, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [floatingAnim]);

  useEffect(() => {
    progressAnims.forEach((anim, i) => {
      Animated.timing(anim, {
        toValue: ongoingActivities[i].progress,
        duration: 800,
        delay: 500 + i * 100,
        useNativeDriver: false,
      }).start();
    });
  }, [progressAnims]);

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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={{ paddingHorizontal: 16 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Icon name="magnify" size={18} color={C.grayLight} />
          <Text style={styles.searchPlaceholder}>
            Search sites, applications...
          </Text>
          <Icon name="tune" size={16} color={C.gray} />
        </View>

        {/* Featured Carousel */}
        <View style={{ marginHorizontal: -16, paddingHorizontal: 16 }}>
          <View style={{ height: 240 }}>
            <FlatList
              ref={carouselRef}
              data={carouselItems}
              renderItem={({ item }) => <CarouselCard item={item} />}
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

        {/* Available Sites */}
        <View style={{ marginBottom: 20 }}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: C.primary }]}>
              Available Sites
            </Text>
            <TouchableOpacity
              style={styles.viewAllButton}
              onPress={() => router.push("/tree_growers/sites")}
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

        {/* Ongoing Activities */}
        <View style={{ marginBottom: 20 }}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: C.navy }]}>
              Ongoing Activities
            </Text>
            <TouchableOpacity
              style={styles.viewAllButton}
              onPress={() => router.push("/tree_growers/application")}
            >
              <Text style={[styles.viewAllText, { color: C.primary }]}>
                View All
              </Text>
              <Icon name="chevron-right" size={14} color={C.primary} />
            </TouchableOpacity>
          </View>
          {ongoingActivities.map((activity, i) => (
            <ActivityCard
              key={activity.id}
              item={activity}
              progressAnim={progressAnims[i]}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
