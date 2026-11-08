import React from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  TouchableWithoutFeedback,
} from "react-native";
import { MaterialCommunityIcons as Icon, Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const C = {
  bg: "#F5F7FB",
  primary: "#0f4a2f",
  primaryMid: "#4ba74e",
  navy: "#1E5c46",
  gray: "#64748B",
  grayLight: "#94A3B8",
  border: "#E2E8F0",
  white: "#FFFFFF",
  greenLight: "#DCFCE7",
};

type IconName = React.ComponentProps<typeof Icon>["name"];

// ─── CONTENT ────────────────────────────────────────────────────────────────

const TABS: { icon: IconName; name: string; desc: string }[] = [
  {
    icon: "home-outline",
    name: "Home",
    desc: "Your dashboard: your site status, recommended sites, guides, and new updates.",
  },
  {
    icon: "map-outline",
    name: "Sites",
    desc: "Browse reforestation sites in Ormoc City and apply to one.",
  },
  {
    icon: "file-document-outline",
    name: "My Site",
    desc: "Track your application, see your assigned site, request seedlings, and submit progress reports.",
  },
  {
    icon: "account-outline",
    name: "Profile",
    desc: "View and update your group information and account settings.",
  },
];

const JOURNEY: { icon: IconName; title: string; desc: string }[] = [
  {
    icon: "map-search",
    title: "Choose a site",
    desc: "Find an available site, ideally in your own barangay.",
  },
  {
    icon: "clipboard-text-outline",
    title: "Apply",
    desc: "Submit your project details and Maintenance Plan.",
  },
  {
    icon: "account-check-outline",
    title: "Get approved",
    desc: "City ENRO evaluates and approves your application.",
  },
  {
    icon: "school-outline",
    title: "Attend orientation",
    desc: "Learn the rules and planting standards before you start.",
  },
  {
    icon: "sprout-outline",
    title: "Request seedlings & plant",
    desc: "Request seedlings in My Site, then plant them at your site.",
  },
  {
    icon: "camera-outline",
    title: "Report progress",
    desc: "Submit progress reports with photos during monitoring.",
  },
  {
    icon: "trophy-outline",
    title: "Complete the program",
    desc: "ENRO reviews tree survival and closes your program.",
  },
];

const TIPS = [
  "Check the bell icon on Home for updates on your application.",
  "Pull down on a screen to refresh it.",
  "Read the safety guides (erosion, flood, landslide) before going to your site.",
];

// ─── COMPONENT ──────────────────────────────────────────────────────────────

type Props = {
  visible: boolean;
  onClose: () => void;
  onOpenApplyGuide: () => void;
  onOpenPlantGuide: () => void;
};

export default function GettingStartedGuide({
  visible,
  onClose,
  onOpenApplyGuide,
  onOpenPlantGuide,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>

        <View style={[s.sheet, { paddingBottom: insets.bottom }]}>
          <View style={s.handle} />

          {/* Header */}
          <View style={s.header}>
            <View style={s.headerIcon}>
              <Icon name="compass-outline" size={22} color={C.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>Getting Started</Text>
              <Text style={s.subtitle}>Your guide to using PlantScope</Text>
            </View>
            <TouchableOpacity style={s.close} onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={18} color={C.gray} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Welcome */}
            <View style={s.welcome}>
              <Text style={s.welcomeTitle}>Welcome, Tree Grower! 🌱</Text>
              <Text style={s.welcomeText}>
                PlantScope helps your group plant and care for trees in Ormoc
                City's reforestation sites. City ENRO uses it to assign sites,
                track planting, and monitor tree growth.
              </Text>
            </View>

            {/* Tabs */}
            <Text style={s.sectionTitle}>1. Getting Around the App</Text>
            {TABS.map((t) => (
              <View key={t.name} style={s.row}>
                <View style={s.rowIcon}>
                  <Icon name={t.icon} size={20} color={C.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.itemTitle}>{t.name}</Text>
                  <Text style={s.itemDesc}>{t.desc}</Text>
                </View>
              </View>
            ))}

            {/* Journey */}
            <Text style={s.sectionTitle}>2. Your Tree Grower Journey</Text>
            {JOURNEY.map((step, i) => (
              <View key={step.title} style={s.stepRow}>
                <View style={s.stepNumCol}>
                  <View style={s.stepNum}>
                    <Icon name={step.icon} size={14} color={C.white} />
                  </View>
                  {i < JOURNEY.length - 1 && <View style={s.stepLine} />}
                </View>
                <View style={{ flex: 1, paddingBottom: 14 }}>
                  <Text style={s.itemTitle}>
                    {i + 1}. {step.title}
                  </Text>
                  <Text style={s.itemDesc}>{step.desc}</Text>
                </View>
              </View>
            ))}

            {/* Other guides */}
            <Text style={s.sectionTitle}>3. More Guides</Text>
            <TouchableOpacity style={s.linkCard} onPress={onOpenApplyGuide} activeOpacity={0.8}>
              <View style={s.rowIcon}>
                <Icon name="clipboard-text-outline" size={20} color={C.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.itemTitle}>How to Apply</Text>
                <Text style={s.itemDesc}>Requirements and steps to apply for a site.</Text>
              </View>
              <Icon name="chevron-right" size={20} color={C.grayLight} />
            </TouchableOpacity>
            <TouchableOpacity style={s.linkCard} onPress={onOpenPlantGuide} activeOpacity={0.8}>
              <View style={s.rowIcon}>
                <Icon name="sprout" size={20} color={C.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.itemTitle}>How to Plant</Text>
                <Text style={s.itemDesc}>What to wear and how to plant for your soil type.</Text>
              </View>
              <Icon name="chevron-right" size={20} color={C.grayLight} />
            </TouchableOpacity>

            {/* Tips */}
            <Text style={s.sectionTitle}>4. Quick Tips</Text>
            {TIPS.map((t) => (
              <View key={t} style={s.bulletRow}>
                <Icon name="check-circle" size={16} color={C.primaryMid} />
                <Text style={[s.itemDesc, { flex: 1, marginTop: 0 }]}>{t}</Text>
              </View>
            ))}
          </ScrollView>

          <View style={s.footer}>
            <TouchableOpacity style={s.footerBtn} onPress={onClose}>
              <Icon name="check" size={16} color={C.white} />
              <Text style={s.footerBtnText}>Let's get started</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── STYLES ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: C.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.88,
    overflow: "hidden",
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.border,
    marginTop: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: C.greenLight,
    justifyContent: "center",
    alignItems: "center",
  },
  title: { fontSize: 17, fontWeight: "800", color: C.primary },
  subtitle: { fontSize: 12, color: C.gray, marginTop: 1 },
  close: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.bg,
    justifyContent: "center",
    alignItems: "center",
  },
  welcome: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: C.primary,
  },
  welcomeTitle: { fontSize: 15, fontWeight: "800", color: C.white, marginBottom: 4 },
  welcomeText: { fontSize: 12.5, color: "rgba(255,255,255,0.9)", lineHeight: 18 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: C.navy,
    marginTop: 20,
    marginBottom: 10,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: C.greenLight,
    justifyContent: "center",
    alignItems: "center",
  },
  itemTitle: { fontSize: 14, fontWeight: "700", color: C.navy },
  itemDesc: { fontSize: 12.5, color: C.gray, lineHeight: 18, marginTop: 2 },
  stepRow: { flexDirection: "row", gap: 12 },
  stepNumCol: { alignItems: "center", width: 26 },
  stepNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: C.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  stepLine: { flex: 1, width: 2, backgroundColor: C.greenLight, marginVertical: 2 },
  linkCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 10,
  },
  bulletRow: { flexDirection: "row", gap: 8, marginTop: 6 },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  footerBtn: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: C.primary,
  },
  footerBtnText: { color: C.white, fontSize: 14, fontWeight: "700" },
});
