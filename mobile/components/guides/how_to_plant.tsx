import React, { useState } from "react";
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
  yellow: "#F59E0B",
  yellowLight: "#FFFBEB",
};

type IconName = React.ComponentProps<typeof Icon>["name"];

// ─── CONTENT ────────────────────────────────────────────────────────────────

const WHAT_TO_WEAR: { icon: IconName; title: string; desc: string }[] = [
  { icon: "hat-fedora", title: "Wide-brim hat", desc: "Protects you from the sun and heat." },
  { icon: "tshirt-crew", title: "Long-sleeved shirt", desc: "Guards against thorns, insects, and sunburn." },
  { icon: "human-male", title: "Long pants", desc: "Protects legs from grass cuts, leeches, and snakes." },
  { icon: "shoe-formal", title: "Rubber boots", desc: "Grip on muddy or sloped ground and protects feet." },
  { icon: "hand-back-left", title: "Work gloves", desc: "Prevents blisters and cuts when digging." },
  { icon: "bottle-tonic-plus", title: "Water, sunscreen & repellent", desc: "Stay hydrated and avoid insect bites." },
];

const TOOLS: { icon: IconName; label: string }[] = [
  { icon: "shovel", label: "Shovel / spade" },
  { icon: "axe", label: "Bolo / machete" },
  { icon: "pickaxe", label: "Digging bar" },
  { icon: "sprout", label: "Seedlings" },
  { icon: "leaf", label: "Compost / mulch" },
  { icon: "medical-bag", label: "First-aid kit" },
];

const GENERAL_STEPS: { title: string; desc: string }[] = [
  {
    title: "Clear the planting spot",
    desc: "Remove grass and weeds in a 1-meter circle around where the tree will go (ring weeding).",
  },
  {
    title: "Mark the spacing",
    desc: "Space seedlings about 2–3 meters apart so each tree gets enough light and room to grow.",
  },
  {
    title: "Dig the hole",
    desc: "Dig about 30 cm wide × 30 cm deep. Put the dark topsoil on one side and the subsoil on the other.",
  },
  {
    title: "Remove the seedling bag",
    desc: "Cut or slide off the plastic bag carefully. Keep the soil around the roots intact.",
  },
  {
    title: "Set the seedling",
    desc: "Place it upright in the center. The root collar should be level with the ground, not buried deeper.",
  },
  {
    title: "Backfill and firm",
    desc: "Fill with topsoil first, then subsoil. Press gently with your hands or foot to remove air pockets.",
  },
  {
    title: "Water and mulch",
    desc: "Water right after planting. Cover the base with dry grass or leaves to keep moisture in.",
  },
  {
    title: "Stake and tag",
    desc: "Tie the seedling loosely to a stake for support and mark it so it is easy to find during monitoring.",
  },
];

type SoilKey = "loam" | "clay" | "sandy" | "rocky";

const SOIL_GUIDES: Record<
  SoilKey,
  {
    label: string;
    icon: IconName;
    color: string;
    howToTell: string;
    steps: string[];
    tip: string;
  }
> = {
  loam: {
    label: "Loam",
    icon: "flower",
    color: "#4ba74e",
    howToTell: "Dark, crumbly, and soft. Holds shape when squeezed but breaks apart easily.",
    steps: [
      "Dig a standard 30 × 30 × 30 cm hole.",
      "Mix a handful of compost into the topsoil before backfilling.",
      "Plant at the same depth as in the nursery bag.",
      "Water once after planting; loam keeps moisture well.",
    ],
    tip: "Best soil for planting. Most native species grow well here.",
  },
  clay: {
    label: "Clay",
    icon: "water",
    color: "#B45309",
    howToTell: "Sticky and heavy when wet, hard and cracked when dry. Forms a ribbon when rolled.",
    steps: [
      "Dig a wider hole (about 45 cm wide, 30 cm deep) so roots can spread.",
      "Rough up the sides of the hole with your shovel so they are not smooth and hard.",
      "Mix compost, rice hull, or sand into the backfill to improve drainage.",
      "Plant slightly higher (2–3 cm above ground) so water does not pool at the stem.",
      "Water lightly; clay drains slowly and roots can rot if flooded.",
    ],
    tip: "Avoid planting right after heavy rain when clay is waterlogged.",
  },
  sandy: {
    label: "Sandy",
    icon: "grain",
    color: "#D97706",
    howToTell: "Gritty and loose. Falls apart when squeezed and dries out quickly.",
    steps: [
      "Dig a deeper hole (about 40 cm deep) to reach moister soil below.",
      "Mix plenty of compost or organic matter into the backfill to hold water.",
      "Make a small basin (ring of soil) around the seedling to catch water.",
      "Water more often during the first weeks.",
      "Apply a thick layer of mulch to slow drying.",
    ],
    tip: "Plant at the start of the rainy season so roots establish before dry months.",
  },
  rocky: {
    label: "Rocky / Sloped",
    icon: "terrain",
    color: "#64748B",
    howToTell: "Shallow soil with stones, or land on a hillside where water runs off fast.",
    steps: [
      "Use a digging bar to loosen and remove stones from the hole.",
      "On slopes, plant along the contour (across the slope, not up and down).",
      "Build a small half-moon terrace on the downhill side of each seedling to catch water and soil.",
      "Fill the hole with good topsoil or compost brought from elsewhere if native soil is too thin.",
      "Firm the soil well so the seedling is not washed out by rain.",
    ],
    tip: "Avoid steep, unstable areas. Report landslide or erosion signs to your coordinator.",
  },
};

const SOIL_ORDER: SoilKey[] = ["loam", "clay", "sandy", "rocky"];

const AFTER_CARE = [
  "Water every 2–3 days during dry weeks for the first month.",
  "Ring-weed around each seedling every 2–3 months.",
  "Replace dead seedlings during the next planting window.",
  "Report your progress through the app during monitoring.",
];

// ─── COMPONENT ──────────────────────────────────────────────────────────────

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function HowToPlantGuide({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [soil, setSoil] = useState<SoilKey>("loam");
  const soilGuide = SOIL_GUIDES[soil];

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
              <Icon name="sprout" size={22} color={C.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>How to Plant a Tree</Text>
              <Text style={s.subtitle}>
                What to wear, what to bring, and step-by-step planting
              </Text>
            </View>
            <TouchableOpacity style={s.close} onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={18} color={C.gray} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Best time */}
            <View style={s.tipBox}>
              <Icon name="weather-partly-rainy" size={20} color={C.yellow} />
              <Text style={s.tipText}>
                Best time to plant: start of the rainy season (June–November),
                early morning or late afternoon when it is cooler.
              </Text>
            </View>

            {/* What to wear */}
            <Text style={s.sectionTitle}>1. What to Wear</Text>
            {WHAT_TO_WEAR.map((w) => (
              <View key={w.title} style={s.wearRow}>
                <View style={s.wearIcon}>
                  <Icon name={w.icon} size={20} color={C.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.itemTitle}>{w.title}</Text>
                  <Text style={s.itemDesc}>{w.desc}</Text>
                </View>
              </View>
            ))}

            {/* Tools */}
            <Text style={s.sectionTitle}>2. What to Bring</Text>
            <View style={s.toolGrid}>
              {TOOLS.map((t) => (
                <View key={t.label} style={s.toolChip}>
                  <Icon name={t.icon} size={16} color={C.primary} />
                  <Text style={s.toolText}>{t.label}</Text>
                </View>
              ))}
            </View>

            {/* General steps */}
            <Text style={s.sectionTitle}>3. Step-by-Step Planting</Text>
            {GENERAL_STEPS.map((step, i) => (
              <View key={step.title} style={s.stepRow}>
                <View style={s.stepNumCol}>
                  <View style={s.stepNum}>
                    <Text style={s.stepNumText}>{i + 1}</Text>
                  </View>
                  {i < GENERAL_STEPS.length - 1 && <View style={s.stepLine} />}
                </View>
                <View style={{ flex: 1, paddingBottom: 14 }}>
                  <Text style={s.itemTitle}>{step.title}</Text>
                  <Text style={s.itemDesc}>{step.desc}</Text>
                </View>
              </View>
            ))}

            {/* Soil-based steps */}
            <Text style={s.sectionTitle}>4. Adjust for Your Soil</Text>
            <Text style={[s.itemDesc, { marginBottom: 10 }]}>
              Check the soil in your site, then pick the type that matches.
            </Text>
            <View style={s.soilTabs}>
              {SOIL_ORDER.map((key) => {
                const active = key === soil;
                const g = SOIL_GUIDES[key];
                return (
                  <TouchableOpacity
                    key={key}
                    style={[
                      s.soilTab,
                      active && { backgroundColor: g.color, borderColor: g.color },
                    ]}
                    onPress={() => setSoil(key)}
                    activeOpacity={0.8}
                  >
                    <Icon name={g.icon} size={14} color={active ? C.white : g.color} />
                    <Text style={[s.soilTabText, active && { color: C.white }]}>
                      {g.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={[s.soilCard, { borderColor: soilGuide.color }]}>
              <Text style={[s.soilLabel, { color: soilGuide.color }]}>
                How to tell
              </Text>
              <Text style={s.itemDesc}>{soilGuide.howToTell}</Text>

              <Text style={[s.soilLabel, { color: soilGuide.color, marginTop: 12 }]}>
                Planting steps
              </Text>
              {soilGuide.steps.map((step, i) => (
                <View key={i} style={s.bulletRow}>
                  <Text style={[s.bulletNum, { color: soilGuide.color }]}>
                    {i + 1}.
                  </Text>
                  <Text style={[s.itemDesc, { flex: 1, marginTop: 0 }]}>{step}</Text>
                </View>
              ))}

              <View style={s.soilTip}>
                <Icon name="lightbulb-on-outline" size={16} color={C.primary} />
                <Text style={s.soilTipText}>{soilGuide.tip}</Text>
              </View>
            </View>

            {/* After care */}
            <Text style={s.sectionTitle}>5. After Planting</Text>
            {AFTER_CARE.map((a) => (
              <View key={a} style={s.bulletRow}>
                <Icon name="check-circle" size={16} color={C.primaryMid} />
                <Text style={[s.itemDesc, { flex: 1, marginTop: 0 }]}>{a}</Text>
              </View>
            ))}
          </ScrollView>

          <View style={s.footer}>
            <TouchableOpacity style={s.footerBtn} onPress={onClose}>
              <Icon name="check" size={16} color={C.white} />
              <Text style={s.footerBtnText}>Got it</Text>
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
  tipBox: {
    flexDirection: "row",
    gap: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: C.yellowLight,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  tipText: { flex: 1, fontSize: 12.5, color: "#92400E", lineHeight: 18 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: C.navy,
    marginTop: 20,
    marginBottom: 10,
  },
  wearRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  wearIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: C.greenLight,
    justifyContent: "center",
    alignItems: "center",
  },
  itemTitle: { fontSize: 14, fontWeight: "700", color: C.navy },
  itemDesc: { fontSize: 12.5, color: C.gray, lineHeight: 18, marginTop: 2 },
  toolGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  toolChip: {
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
  toolText: { fontSize: 12, fontWeight: "600", color: C.navy },
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
  stepNumText: { color: C.white, fontSize: 12, fontWeight: "800" },
  stepLine: { flex: 1, width: 2, backgroundColor: C.greenLight, marginVertical: 2 },
  soilTabs: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  soilTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.white,
  },
  soilTabText: { fontSize: 12, fontWeight: "700", color: C.navy },
  soilCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    backgroundColor: C.white,
  },
  soilLabel: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  bulletRow: { flexDirection: "row", gap: 8, marginTop: 6 },
  bulletNum: { fontSize: 12.5, fontWeight: "800", width: 16 },
  soilTip: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    padding: 10,
    borderRadius: 12,
    backgroundColor: C.greenLight,
  },
  soilTipText: { flex: 1, fontSize: 12, color: C.primary, lineHeight: 17 },
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
