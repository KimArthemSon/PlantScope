import React, { useState, useRef, useEffect } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated,
  Image,
  FlatList,
  Dimensions,
  ActivityIndicator,
  Platform,
  ImageSourcePropType,
  Modal,
} from "react-native";
import { MaterialCommunityIcons as Icon, Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import { api } from "@/constants/url_fixed";
import { clearAuthData, isAuthFailure } from "@/utils/auth";
import HowToPlantGuide from "@/components/guides/how_to_plant";
import HowToApplyGuide from "@/components/guides/how_to_apply";
import GettingStartedGuide from "@/components/guides/getting_started";
import AboutPlantScope from "@/components/guides/about_plantscope";

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
  full_name: string; // Will hold group_name for tree growers
  user_role: string | null;
};

// Built from /api/get_tree_grower_application/ (same data as the My Site tab)
type MySiteData = {
  status: string; // raw application status, e.g. "for_evaluation"
  title: string; // application project title
  siteName: string | null; // null until ENRO assigns a site
  barangay: string | null;
  areaName: string | null;
  hectares: number | null;
  imageUrl: string | null;
  growers: number;
  appliedAt: string;
  orientationDate: string | null;
  seedlingsApproved: number;
  reportCount: number;
} | null;

const APP_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  for_evaluation: { label: "For Evaluation", color: "#B45309", bg: "#FFFBEB" },
  for_head: { label: "For Head Review", color: "#1D4ED8", bg: "#EFF6FF" },
  accepted: { label: "Needs Orientation", color: "#047857", bg: "#ECFDF5" },
  under_monitoring: { label: "Under Monitoring", color: "#047857", bg: "#ECFDF5" },
  final_review: { label: "Final Review", color: "#4338CA", bg: "#EEF2FF" },
  completed: { label: "Completed", color: "#0284C7", bg: "#E0F2FE" },
  rejected: { label: "Rejected", color: "#B91C1C", bg: "#FEF2F2" },
  cancelled: { label: "Cancelled", color: "#B91C1C", bg: "#FEF2F2" },
  failed: { label: "Not Completed", color: "#B91C1C", bg: "#FEF2F2" },
};

const CLOSED_STATUSES = ["rejected", "cancelled", "failed"];

// Same steps as the progress timeline on the My Site tab (application.tsx)
const TRACK_STEPS = [
  { key: "for_evaluation", label: "Evaluation", icon: "search" },
  { key: "for_head", label: "Head Review", icon: "people" },
  { key: "accepted", label: "Approved", icon: "checkmark-circle" },
  { key: "under_monitoring", label: "Active", icon: "leaf" },
  { key: "final_review", label: "Final Review", icon: "ribbon" },
  { key: "completed", label: "Completed", icon: "trophy" },
] as const;

const formatDate = (raw: string | null) => {
  if (!raw) return "";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
};

const resolveUrl = (url: string) => (url.startsWith("http") ? url : `${api}${url}`);

// ─── MOCK DATA FOR CAROUSEL ───────────────────────────────────────────────
const carouselItems = [
  {
    id: 3,
    key: "getting-started",
    title: "Getting Started",
    description:
      "New to PlantScope? Learn how the app works and what to expect as a tree grower.",
    cta: "How to apply",
    image: require("@/assets/images/treegrower.png"),
    route: "/tree_growers/getting-started",
  },
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
  emailText: { fontSize: 11, color: C.gray, marginTop: 1 },
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
  courseContent: { flex: 1 },
  courseTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: C.navy,
    marginBottom: 4,
  },
  courseLevel: { fontSize: 12, color: C.grayLight, marginBottom: 6 },
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
  mySiteStatusText: { fontSize: 10.5, fontWeight: "700", color: C.primary },
  mySiteLabel: {
    fontSize: 11,
    color: C.grayLight,
    marginTop: 4,
    fontWeight: "500",
  },
  mySiteEmpty: { borderColor: C.border, borderStyle: "dashed" },

  // My Site card (styled like the cards on the Sites screen)
  siteCardShadow: {
    borderRadius: 18,
    backgroundColor: C.white,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  siteCard: { borderRadius: 18 },
  // Gray background so the photo area isn't a white gap while the image loads.
  // Rounded top corners are set here instead of clipping the whole card.
  siteImageBox: {
    height: 130,
    position: "relative",
    backgroundColor: "#E2E8F0",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    overflow: "hidden",
  },
  siteImage: { width: "100%", height: "100%" },
  siteImagePlaceholder: {
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
  },
  siteImagePlaceholderText: { fontSize: 11, color: C.grayLight, fontWeight: "600" },
  siteStatus: {
    position: "absolute",
    top: 10,
    left: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
  },
  siteStatusDot: { width: 7, height: 7, borderRadius: 4 },
  siteStatusText: { fontSize: 11, fontWeight: "700" },
  siteBody: { padding: 14 },
  siteName: { fontSize: 15, fontWeight: "800", color: C.navy },
  siteLocationRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  siteLocation: { flex: 1, fontSize: 12, color: C.gray },
  siteMetaRow: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 8 },
  siteMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  siteMetaText: { fontSize: 11.5, color: C.gray, fontWeight: "500" },
  trackRow: {
    flexDirection: "row",
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  // Timeline styles copied from floatTimelineStyles in application.tsx
  // Each step takes an equal share of the row so all 6 fit without scrolling
  trackStep: {
    flex: 1,
    alignItems: "center",
  },
  // Same height for every circle slot so the connector lines stay centered
  trackCircleSlot: {
    height: 36,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  trackCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  trackCircleActive: { backgroundColor: C.primary },
  trackCircleCurrent: {
    backgroundColor: C.primary,
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: "#BBF7D0",
  },
  trackLabel: {
    fontSize: 9,
    color: "#D1D5DB",
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 12,
    paddingHorizontal: 1,
  },
  trackLabelActive: { color: "#111827", fontWeight: "700" },
  trackLabelCurrent: { color: C.primary, fontWeight: "800" },
  // Runs from this step's center to the next step's center
  trackConnector: {
    position: "absolute",
    top: 17,
    left: "50%",
    right: "-50%",
    height: 2,
    backgroundColor: "#E5E7EB",
  },
  trackConnectorActive: { backgroundColor: C.primary },
  siteFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    padding: 10,
    borderRadius: 12,
    backgroundColor: C.bg,
  },
  siteFooterText: { flex: 1, fontSize: 12, color: C.navy, fontWeight: "600" },

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

  // Notification Sheet Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  sheet: {
    backgroundColor: C.white,
    borderRadius: 24,
    width: "100%",
    maxWidth: 420,
    overflow: "hidden",
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  sheetBell: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: C.greenLight,
    justifyContent: "center",
    alignItems: "center",
  },
  sheetBellBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: C.red,
    borderWidth: 2,
    borderColor: C.white,
    justifyContent: "center",
    alignItems: "center",
  },
  sheetTitle: { fontSize: 17, fontWeight: "800", color: C.primary },
  sheetSubtitle: { fontSize: 12, color: C.gray, marginTop: 1 },
  sheetClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.bg,
    justifyContent: "center",
    alignItems: "center",
  },
  notifItem: {
    flexDirection: "row",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
    backgroundColor: C.white,
  },
  notifIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  notifTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  notifTitle: { flex: 1, fontSize: 14, fontWeight: "700", color: C.navy },
  notifTime: { fontSize: 11, color: C.grayLight, fontWeight: "500" },
  notifDesc: { fontSize: 12.5, color: C.gray, lineHeight: 18, marginTop: 3 },
  notifLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginTop: 6,
  },
  notifLinkText: { fontSize: 12, fontWeight: "700", color: C.primary },
  sheetFooter: {
    flexDirection: "row",
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  sheetBtnSecondary: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: C.bg,
    alignItems: "center",
  },
  sheetBtnSecondaryText: { color: C.primary, fontSize: 14, fontWeight: "700" },
  sheetBtnPrimary: {
    flex: 1.4,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: C.primary,
  },
  sheetBtnPrimaryText: { color: C.white, fontSize: 14, fontWeight: "700" },
});

// ─── COMPONENTS ──────────────────────────────────────────────────────────────

// Copy of the progress timeline on the My Site tab, so both look the same
function StatusTracker({ status }: { status: string }) {
  const currentIndex = Math.max(
    0,
    TRACK_STEPS.findIndex((s) => s.key === status),
  );
  return (
    // Fixed row (no horizontal ScrollView): a scroll view nested inside this
    // tappable card made the whole card render blank on Android.
    <View style={styles.trackRow}>
      {TRACK_STEPS.map((step, index) => {
        const isActive = index <= currentIndex;
        const isCurrent = index === currentIndex;
        return (
          <View key={step.key} style={styles.trackStep}>
            {/* Line to the next step, drawn behind the circles */}
            {index < TRACK_STEPS.length - 1 && (
              <View
                style={[
                  styles.trackConnector,
                  index < currentIndex && styles.trackConnectorActive,
                ]}
              />
            )}
            <View style={styles.trackCircleSlot}>
              <View
                style={[
                  styles.trackCircle,
                  isActive && styles.trackCircleActive,
                  isCurrent && styles.trackCircleCurrent,
                ]}
              >
                <Ionicons
                  name={step.icon}
                  size={isCurrent ? 16 : 13}
                  color={isActive ? C.white : "#D1D5DB"}
                />
              </View>
            </View>
            <Text
              style={[
                styles.trackLabel,
                isActive && styles.trackLabelActive,
                isCurrent && styles.trackLabelCurrent,
              ]}
              numberOfLines={2}
            >
              {step.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// One short line telling the grower what happens next
const nextStepText = (item: NonNullable<MySiteData>) => {
  switch (item.status) {
    case "for_evaluation":
      return "City ENRO staff are reviewing your application.";
    case "for_head":
      return "Waiting for the City ENRO Head's approval.";
    case "accepted":
      return item.orientationDate
        ? `Orientation on ${formatDate(item.orientationDate)}`
        : "Approved! Wait for your orientation schedule.";
    case "under_monitoring":
      return `${item.seedlingsApproved} seedlings approved · ${item.reportCount} reports submitted`;
    case "final_review":
      return "ENRO is reviewing your tree survival results.";
    case "completed":
      return "Program completed. Great work!";
    default:
      return "Open My Site to see the details.";
  }
};

function MySiteCard({
  item,
  onPress,
  onFindSite,
}: {
  item: MySiteData;
  onPress: () => void;
  onFindSite: () => void;
}) {
  // Falls back to the placeholder if the site photo can't load
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [item?.imageUrl]);

  // No application, or the last one was closed
  if (!item || CLOSED_STATUSES.includes(item.status)) {
    const closed = !!item;
    return (
      <TouchableOpacity
        style={[styles.mySiteCard, styles.mySiteEmpty]}
        activeOpacity={0.85}
        onPress={closed ? onPress : onFindSite}
      >
        <View style={[styles.mySiteThumb, { backgroundColor: closed ? C.red : C.grayLight }]}>
          <Icon name={closed ? "close-circle-outline" : "map-search-outline"} size={26} color="white" />
        </View>
        <View style={styles.courseContent}>
          <Text style={styles.courseTitle}>
            {closed ? `Application ${APP_STATUS[item!.status].label}` : "No Active Application"}
          </Text>
          <Text style={styles.courseLevel}>
            {closed
              ? "Tap to see the details. You can apply for a new program."
              : "Find a reforestation site and apply to start planting."}
          </Text>
        </View>
        <Icon name="chevron-right" size={20} color={C.grayLight} />
      </TouchableOpacity>
    );
  }

  const conf = APP_STATUS[item.status] ?? { label: item.status, color: C.gray, bg: C.bg };
  const location = [item.barangay && `Brgy. ${item.barangay}`, item.areaName]
    .filter(Boolean)
    .join(" · ");

  // Shadow lives on the outer View and the tap effect on the inner one.
  // Putting shadow + clipping + tap fade on the same view breaks drawing on Android.
  return (
    <View style={styles.siteCardShadow}>
    <TouchableOpacity style={styles.siteCard} activeOpacity={0.9} onPress={onPress}>
      {/* Photo + status badge */}
      <View style={styles.siteImageBox}>
        {item.imageUrl && !imageFailed ? (
          <Image
            source={{ uri: item.imageUrl }}
            style={styles.siteImage}
            resizeMode="cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <View style={[styles.siteImage, styles.siteImagePlaceholder]}>
            <Icon name={item.siteName ? "image-outline" : "map-marker-question-outline"} size={30} color="#CBD5E1" />
            <Text style={styles.siteImagePlaceholderText}>
              {item.siteName ? "No photo yet" : "Site to be assigned"}
            </Text>
          </View>
        )}
        <View style={[styles.siteStatus, { backgroundColor: conf.bg }]}>
          <View style={[styles.siteStatusDot, { backgroundColor: conf.color }]} />
          <Text style={[styles.siteStatusText, { color: conf.color }]}>{conf.label}</Text>
        </View>
      </View>

      <View style={styles.siteBody}>
        <Text style={styles.siteName} numberOfLines={1}>
          {item.siteName || item.title}
        </Text>
        <View style={styles.siteLocationRow}>
          <Icon name="map-marker" size={13} color={C.primary} />
          <Text style={styles.siteLocation} numberOfLines={1}>
            {location || "ENRO will assign the best available site"}
          </Text>
        </View>

        <View style={styles.siteMetaRow}>
          {item.hectares != null && (
            <View style={styles.siteMeta}>
              <Icon name="arrow-expand-all" size={13} color={C.gray} />
              <Text style={styles.siteMetaText}>{item.hectares.toFixed(2)} ha</Text>
            </View>
          )}
          <View style={styles.siteMeta}>
            <Icon name="account-group-outline" size={13} color={C.gray} />
            <Text style={styles.siteMetaText}>{item.growers} growers</Text>
          </View>
          <View style={styles.siteMeta}>
            <Icon name="calendar-outline" size={13} color={C.gray} />
            <Text style={styles.siteMetaText}>Applied {formatDate(item.appliedAt)}</Text>
          </View>
        </View>

        <StatusTracker status={item.status} />

        <View style={styles.siteFooter}>
          <Icon name="information-outline" size={14} color={C.primary} />
          <Text style={styles.siteFooterText} numberOfLines={2}>
            {nextStepText(item)}
          </Text>
          <Icon name="chevron-right" size={18} color={C.grayLight} />
        </View>
      </View>
    </TouchableOpacity>
    </View>
  );
}

function CarouselCard({
  item,
  onPress,
}: {
  item: (typeof carouselItems)[0];
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

type HomeNotification = {
  notification_id: number;
  type: "alert" | "success" | "warning" | "info";
  title: string;
  description: string;
  link: string | null;
  created_at: string;
};

const NOTIF_STYLE = {
  alert: { icon: "alert-circle" as const, color: "#EF4444", bg: "#FEF2F2", border: "#FECACA" },
  success: { icon: "check-circle" as const, color: "#10B981", bg: "#ECFDF5", border: "#A7F3D0" },
  warning: { icon: "alert" as const, color: "#F59E0B", bg: "#FFFBEB", border: "#FDE68A" },
  info: { icon: "information" as const, color: "#3B82F6", bg: "#EFF6FF", border: "#BFDBFE" },
};

const timeAgo = (iso: string): string => {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (isNaN(diff)) return "";
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
};

function NotificationModal({
  visible,
  notifications,
  onClose,
  onMarkAllRead,
  onOpen,
  onViewAll,
}: {
  visible: boolean;
  notifications: HomeNotification[];
  onClose: () => void;
  onMarkAllRead: () => void;
  onOpen: (notif: HomeNotification) => void;
  onViewAll: () => void;
}) {
  if (!visible || notifications.length === 0) return null;
  const count = notifications.length;
  const { height: screenHeight } = Dimensions.get("window");

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={styles.sheetBell}>
              <Icon name="bell-ring" size={22} color={C.primary} />
              <View style={styles.sheetBellBadge}>
                <Text style={styles.badgeText}>{count > 99 ? "99+" : count}</Text>
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetTitle}>
                {count === 1 ? "New Update" : `${count} New Updates`}
              </Text>
              <Text style={styles.sheetSubtitle}>
                {count > 1
                  ? "Scroll to see everything you missed"
                  : "Here is what's new for your group"}
              </Text>
            </View>
            <TouchableOpacity style={styles.sheetClose} onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={18} color={C.gray} />
            </TouchableOpacity>
          </View>

          {/* Scrollable list */}
          <ScrollView
            style={{ maxHeight: screenHeight * 0.5 }}
            contentContainerStyle={{ padding: 16, paddingBottom: 6 }}
            showsVerticalScrollIndicator={count > 2}
          >
            {notifications.map((n) => {
              const conf = NOTIF_STYLE[n.type] || NOTIF_STYLE.info;
              return (
                <TouchableOpacity
                  key={n.notification_id}
                  style={[styles.notifItem, { borderColor: conf.border }]}
                  activeOpacity={0.8}
                  onPress={() => onOpen(n)}
                >
                  <View style={[styles.notifIconWrap, { backgroundColor: conf.bg }]}>
                    <Icon name={conf.icon} size={20} color={conf.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.notifTitleRow}>
                      <Text style={styles.notifTitle} numberOfLines={2}>
                        {n.title || "Update"}
                      </Text>
                      <Text style={styles.notifTime}>{timeAgo(n.created_at)}</Text>
                    </View>
                    {!!n.description && (
                      <Text style={styles.notifDesc} numberOfLines={3}>
                        {n.description}
                      </Text>
                    )}
                    {n.link && (
                      <View style={styles.notifLink}>
                        <Text style={styles.notifLinkText}>View details</Text>
                        <Icon name="chevron-right" size={14} color={C.primary} />
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Footer */}
          <View style={styles.sheetFooter}>
            <TouchableOpacity style={styles.sheetBtnSecondary} onPress={onViewAll}>
              <Text style={styles.sheetBtnSecondaryText}>View All</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sheetBtnPrimary} onPress={onMarkAllRead}>
              <Icon name="check-all" size={16} color={C.white} />
              <Text style={styles.sheetBtnPrimaryText}>
                {count === 1 ? "Got it" : "Mark all as read"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── MAIN DASHBOARD ─────────────────────────────────────────────────────────

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [carouselIndex, setCarouselIndex] = useState(0);
  const carouselRef = useRef<FlatList>(null);
  const crossfadeAnim = useRef(new Animated.Value(0)).current;

  const [userData, setUserData] = useState<UserData | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const [mySite, setMySite] = useState<MySiteData>(null);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [showPlantGuide, setShowPlantGuide] = useState(false);
  const [showApplyGuide, setShowApplyGuide] = useState(false);
  const [showStartGuide, setShowStartGuide] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [unreadNotifs, setUnreadNotifs] = useState<HomeNotification[]>([]);


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
        await clearAuthData();
        router.replace("/homepage");
        return;
      }

      const res = await fetch(`${api}/api/get_me/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (isAuthFailure(res.status)) {
        // Token expired or invalid → log in again
        await clearAuthData();
        router.replace("/homepage");
        return;
      }

      if (res.ok) {
        const data = await res.json();
        setUserData(data);

        // ✅ Fetch Tree Grower specific data if applicable
        if (data.user_role === "treeGrowers") {
          fetchTreeGrowerSite(token);
          fetchLatestNotification(token);
        }
      } else {
        console.warn("Failed to fetch user data:", res.status);
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
    } finally {
      setLoadingUser(false);
    }
  };

  const fetchTreeGrowerSite = async (token: string) => {
    try {
      const res = await fetch(`${api}/api/get_tree_grower_application/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const app = data.application;
        if (!app) {
          setMySite(null); // No application yet
          return;
        }
        const site = data.assigned_site;
        const image = site?.main_image_url || site?.general_images?.[0]?.image_url;
        const seedlingsApproved = (data.seedling_requests || [])
          .filter((r: any) => r.status === "accepted")
          .reduce(
            (sum: number, r: any) =>
              sum + (r.species || []).reduce((s: number, sp: any) => s + (sp.quantity || 0), 0),
            0,
          );

        setMySite({
          // While the Head decides the final result, show "Final Review"
          status: app.final_review_pending ? "final_review" : app.status,
          title: app.title,
          siteName: site?.name ?? null,
          barangay: site?.barangay_name ?? null,
          areaName: site?.reforestation_area_name ?? null,
          hectares: site?.total_area_hectares != null ? Number(site.total_area_hectares) : null,
          imageUrl: image ? resolveUrl(image) : null,
          growers: app.total_treegrowers_will_participate,
          appliedAt: app.created_at,
          orientationDate: app.orientation_date,
          seedlingsApproved,
          // Backend sends { my_reports, site_history }; count only this application's reports
          reportCount: data.progress_reports?.my_reports?.length ?? 0,
        });
      }
    } catch (error) {
      console.error("Error fetching tree grower application:", error);
    }
  };

  // ✅ Load ALL unread notifications so the pop-up can show them as a list
  const fetchLatestNotification = async (token: string) => {
    try {
      const res = await fetch(
        `${api}/api/notifications/?unread_only=true&page=1&entries=50`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (res.ok) {
        const response = await res.json();
        if (response.data && response.data.length > 0) {
          setUnreadNotifs(response.data);
          setShowNotifModal(true);
        }
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    }
  };

  const markOneRead = async (id: number) => {
    try {
      const token = await getToken();
      const res = await fetch(`${api}/api/notifications/${id}/read/`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (res.ok) setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  // Tap a notification: mark it read, drop it from the list, follow its link
  const handleOpenNotification = (notif: HomeNotification) => {
    markOneRead(notif.notification_id);
    const remaining = unreadNotifs.filter(
      (n) => n.notification_id !== notif.notification_id,
    );
    setUnreadNotifs(remaining);
    if (notif.link) {
      setShowNotifModal(false);
      router.push(notif.link as any);
    } else if (remaining.length === 0) {
      setShowNotifModal(false);
    }
  };

  const handleMarkAllRead = async () => {
    setShowNotifModal(false);
    try {
      const token = await getToken();
      const res = await fetch(`${api}/api/notifications/mark-all-read/`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (res.ok) {
        setUnreadNotifs([]);
        setUnreadCount(0);
      }
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
    }
  };

  const handleViewAllNotifications = () => {
    setShowNotifModal(false);
    router.push("/tree_growers/notifications" as any);
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

  const goTo = (route: string) => {
    if (route === "/tree_growers/getting-started") {
      setShowStartGuide(true);
      return;
    }
    if (route === "/tree_growers/how-to-plant") {
      setShowPlantGuide(true);
      return;
    }
    if (route === "/tree_growers/application") {
      setShowApplyGuide(true);
      return;
    }
    if (route === "/tree_growers/about") {
      setShowAbout(true);
      return;
    }
    router.push(route as any);
  };
  const displayName = userData?.full_name || "Tree Grower";
  const profileImage = userData?.profile_img;
  const badgeText = unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <View style={styles.container}>
      <ScrollView
        style={{ paddingHorizontal: 16 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* In-page header */}
        <View style={[styles.headerRow, { paddingTop: insets.top + 14 }]}>
          <TouchableOpacity
            style={styles.headerLeft}
            activeOpacity={0.7}
            onPress={() => router.push("/tree_growers/profile" as any)}
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
              {userData?.email && (
                <Text style={styles.emailText} numberOfLines={1}>
                  {userData.email}
                </Text>
              )}
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
        <TouchableOpacity 
          style={styles.searchBar}
          activeOpacity={0.7}
          onPress={() => router.push("/tree_growers/sites" as any)}
        >
          <Icon name="magnify" size={18} color={C.grayLight} />
          <Text style={styles.searchPlaceholder}>
            Search sites, applications...
          </Text>
          <Icon name="tune" size={16} color={C.gray} />
        </TouchableOpacity>

        {/* Featured Carousel */}
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

        {/* My Site — Dynamically loaded */}
        <View style={{ marginBottom: 20 }}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: C.navy }]}>
              My Site
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
          <MySiteCard
            item={mySite}
            onPress={() => router.push("/tree_growers/application" as any)}
            onFindSite={() => router.push("/tree_growers/sites" as any)}
          />
        </View>

      </ScrollView>

      {/* ✅ Notification Modal */}
      <NotificationModal
        visible={showNotifModal}
        notifications={unreadNotifs}
        onClose={() => setShowNotifModal(false)}
        onMarkAllRead={handleMarkAllRead}
        onOpen={handleOpenNotification}
        onViewAll={handleViewAllNotifications}
      />

      {/* How to Plant guide (opened from the carousel "View Guide" button) */}
      <HowToPlantGuide
        visible={showPlantGuide}
        onClose={() => setShowPlantGuide(false)}
      />

      {/* Getting Started guide (first carousel card). Closes first, then opens
          the other guide, so two modals are never stacked. */}
      <GettingStartedGuide
        visible={showStartGuide}
        onClose={() => setShowStartGuide(false)}
        onOpenApplyGuide={() => {
          setShowStartGuide(false);
          setTimeout(() => setShowApplyGuide(true), 350);
        }}
        onOpenPlantGuide={() => {
          setShowStartGuide(false);
          setTimeout(() => setShowPlantGuide(true), 350);
        }}
      />

      {/* About PlantScope (opened from the carousel "About Us" card) */}
      <AboutPlantScope visible={showAbout} onClose={() => setShowAbout(false)} />

      {/* How to Apply guide (opened from the carousel "Apply Now" button) */}
      <HowToApplyGuide
        visible={showApplyGuide}
        onClose={() => setShowApplyGuide(false)}
        onFindSite={() => {
          setShowApplyGuide(false);
          router.push("/tree_growers/sites" as any);
        }}
      />
    </View>
  );
}
