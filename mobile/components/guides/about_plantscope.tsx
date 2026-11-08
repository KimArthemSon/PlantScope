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
  Image,
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
  border: "#E2E8F0",
  white: "#FFFFFF",
  greenLight: "#DCFCE7",
};

type IconName = React.ComponentProps<typeof Icon>["name"];

// ─── CONTENT ────────────────────────────────────────────────────────────────

const FULL_TITLE =
  "A GIS-Enabled Site Identification and Prioritization System for Data-Driven Reforestation in Ormoc City, Leyte";

const GOALS: { icon: IconName; title: string; desc: string }[] = [
  {
    icon: "map-search-outline",
    title: "Find the right sites",
    desc: "Identify degraded and suitable land for reforestation using maps and satellite data.",
  },
  {
    icon: "sort-variant",
    title: "Prioritize with data",
    desc: "Rank sites using environmental criteria like slope, soil, vegetation, and hazards.",
  },
  {
    icon: "account-group-outline",
    title: "Involve the community",
    desc: "Let tree grower groups apply for sites and take part in planting.",
  },
  {
    icon: "chart-line",
    title: "Monitor tree growth",
    desc: "Track planting progress and tree survival until each program is complete.",
  },
];

const HOW_IT_WORKS: { icon: IconName; title: string; desc: string }[] = [
  {
    icon: "satellite-variant",
    title: "Satellite analysis",
    desc: "Satellite imagery (such as vegetation index and fire hotspot data) highlights areas that need reforestation.",
  },
  {
    icon: "clipboard-search-outline",
    title: "Field verification",
    desc: "Onsite Inspectors visit the area and record soil, slope, safety, and boundary data.",
  },
  {
    icon: "layers-outline",
    title: "GIS assessment",
    desc: "The GIS Specialist combines satellite and field data to assess site suitability.",
  },
  {
    icon: "check-decagram-outline",
    title: "Approval",
    desc: "The City ENRO Head reviews the results and confirms official planting sites.",
  },
  {
    icon: "sprout-outline",
    title: "Planting & monitoring",
    desc: "Tree growers plant on approved sites and submit progress reports through this app.",
  },
];

const USERS: { icon: IconName; role: string }[] = [
  { icon: "account-tie", role: "City ENRO Head" },
  { icon: "database-cog-outline", role: "Data Manager" },
  { icon: "map-outline", role: "GIS Specialist" },
  { icon: "clipboard-account-outline", role: "Onsite Inspector" },
  { icon: "tree-outline", role: "Tree Growers" },
];

const PARTNERS: { title: string; desc: string }[] = [
  {
    title: "City Environment and Natural Resources Office (City ENRO)",
    desc: "Ormoc City LGU",
  },
  {
    title: "City Planning and Development Office (CPDO)",
    desc: "Ormoc City LGU",
  },
  {
    title: "College of ICT and Engineering",
    desc: "Western Leyte College of Ormoc City (developers)",
  },
];

// ─── COMPONENT ──────────────────────────────────────────────────────────────

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function AboutPlantScope({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={s.overlay}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>

        <View style={[s.sheet, { paddingBottom: insets.bottom }]}>
          <View style={s.handle} />

          {/* Header */}
          <View style={s.header}>
            <View style={s.headerIcon}>
              <Icon name="information-outline" size={22} color={C.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>About PlantScope</Text>
              <Text style={s.subtitle}>Who we are and what we do</Text>
            </View>
            <TouchableOpacity style={s.close} onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={18} color={C.gray} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Hero */}
            <View style={s.hero}>
              <Image
                source={require("@/assets/images/new_icon.png")}
                style={s.logo}
                resizeMode="cover"
              />
              <Text style={s.heroName}>PlantScope</Text>
              <Text style={s.heroTitle}>{FULL_TITLE}</Text>
            </View>

            <Text style={s.body}>
              PlantScope is a GIS-based reforestation monitoring and site
              suitability assessment platform. It helps Ormoc City decide where
              to plant trees, connects tree grower groups with approved sites,
              and tracks each planting program from application to completion.
            </Text>

            {/* Goals */}
            <Text style={s.sectionTitle}>Our Mission</Text>
            {GOALS.map((g) => (
              <View key={g.title} style={s.row}>
                <View style={s.rowIcon}>
                  <Icon name={g.icon} size={20} color={C.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.itemTitle}>{g.title}</Text>
                  <Text style={s.itemDesc}>{g.desc}</Text>
                </View>
              </View>
            ))}

            {/* How it works */}
            <Text style={s.sectionTitle}>How It Works</Text>
            {HOW_IT_WORKS.map((step, i) => (
              <View key={step.title} style={s.stepRow}>
                <View style={s.stepNumCol}>
                  <View style={s.stepNum}>
                    <Icon name={step.icon} size={14} color={C.white} />
                  </View>
                  {i < HOW_IT_WORKS.length - 1 && <View style={s.stepLine} />}
                </View>
                <View style={{ flex: 1, paddingBottom: 14 }}>
                  <Text style={s.itemTitle}>{step.title}</Text>
                  <Text style={s.itemDesc}>{step.desc}</Text>
                </View>
              </View>
            ))}

            {/* Users */}
            <Text style={s.sectionTitle}>Who Uses PlantScope</Text>
            <View style={s.chipWrap}>
              {USERS.map((u) => (
                <View key={u.role} style={s.chip}>
                  <Icon name={u.icon} size={15} color={C.primary} />
                  <Text style={s.chipText}>{u.role}</Text>
                </View>
              ))}
            </View>

            {/* Partners */}
            <Text style={s.sectionTitle}>In Partnership With</Text>
            <View style={s.partnerCard}>
              {PARTNERS.map((p, i) => (
                <View
                  key={p.title}
                  style={[s.partnerRow, i < PARTNERS.length - 1 && s.divider]}
                >
                  <Icon name="domain" size={18} color={C.primaryMid} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.itemTitle}>{p.title}</Text>
                    <Text style={s.itemDesc}>{p.desc}</Text>
                  </View>
                </View>
              ))}
            </View>

            <Text style={s.version}>PlantScope v2.0 · Tree Grower Module</Text>
          </ScrollView>

          <View style={s.footer}>
            <TouchableOpacity style={s.footerBtn} onPress={onClose}>
              <Text style={s.footerBtnText}>Close</Text>
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
  hero: {
    alignItems: "center",
    padding: 18,
    borderRadius: 18,
    backgroundColor: C.primary,
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: C.white,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.6)",
    marginBottom: 8,
  },
  heroName: { fontSize: 20, fontWeight: "900", color: C.white },
  heroTitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.9)",
    textAlign: "center",
    lineHeight: 17,
    marginTop: 4,
  },
  body: { fontSize: 13, color: C.gray, lineHeight: 20, marginTop: 14 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: C.navy,
    marginTop: 20,
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
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
  stepLine: {
    flex: 1,
    width: 2,
    backgroundColor: C.greenLight,
    marginVertical: 2,
  },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
  },
  chipText: { fontSize: 12, fontWeight: "600", color: C.navy },
  partnerCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 12,
  },
  partnerRow: { flexDirection: "row", gap: 10, paddingVertical: 12 },
  divider: { borderBottomWidth: 1, borderBottomColor: C.border },
  version: {
    textAlign: "center",
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 20,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  footerBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: C.primary,
    alignItems: "center",
  },
  footerBtnText: { color: C.white, fontSize: 14, fontWeight: "700" },
});
