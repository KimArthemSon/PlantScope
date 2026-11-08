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
  border: "#E2E8F0",
  white: "#FFFFFF",
  greenLight: "#DCFCE7",
  blueLight: "#EFF6FF",
  blue: "#1D4ED8",
};

type IconName = React.ComponentProps<typeof Icon>["name"];

// ─── CONTENT ────────────────────────────────────────────────────────────────

const REQUIREMENTS: { icon: IconName; title: string; desc: string }[] = [
  {
    icon: "account-group",
    title: "At least 2 tree growers",
    desc: "Your group must have a minimum of 2 members who will join the planting.",
  },
  {
    icon: "file-document-outline",
    title: "Maintenance Plan document",
    desc: "A plan for how your group will care for the trees. PDF, Word, or a clear photo is accepted.",
  },
  {
    icon: "format-title",
    title: "Project title",
    desc: "A short name for your program, e.g. \"Brgy. San Isidro Reforestation 2026\".",
  },
  {
    icon: "calendar-month",
    title: "Orientation date (optional)",
    desc: "You can suggest a date for your orientation with City ENRO.",
  },
];

const APPLY_STEPS: { icon: IconName; title: string; desc: string }[] = [
  {
    icon: "map-search",
    title: "Find a site",
    desc: "Tap \"Find a Site\" below or open the Sites tab. Sites in your barangay are shown first under Top Recommended.",
  },
  {
    icon: "information-outline",
    title: "Check the site details",
    desc: "Open a site to see its area, location map, recommended species, and planting history.",
  },
  {
    icon: "hand-pointing-up",
    title: "Tap \"Apply to This Site\"",
    desc: "The button is at the bottom of the site details page.",
  },
  {
    icon: "form-textbox",
    title: "Fill out the form",
    desc: "Enter your project title, number of tree growers, and optional orientation date and notes.",
  },
  {
    icon: "upload",
    title: "Upload your Maintenance Plan",
    desc: "Tap the upload box and choose your file.",
  },
  {
    icon: "send",
    title: "Submit",
    desc: "Review your details and tap Submit. You can track your application from the My Site card.",
  },
];

const STAGES: { icon: IconName; label: string; desc: string }[] = [
  { icon: "magnify", label: "For Evaluation", desc: "City ENRO staff review your application." },
  { icon: "account-tie", label: "For Head Review", desc: "The City ENRO Head gives final approval." },
  { icon: "school", label: "Needs Orientation", desc: "Attend your orientation before planting starts." },
  { icon: "sprout", label: "Under Monitoring", desc: "Request seedlings, plant, and submit progress reports." },
  { icon: "clipboard-check", label: "Final Review", desc: "ENRO checks the survival of your planted trees." },
  { icon: "trophy", label: "Completed", desc: "Your program is finished. You can apply again." },
];

const TIPS = [
  "You can only have one ongoing application at a time.",
  "Turn on notifications so you know right away when your status changes.",
  "If your application is rejected, read the reason in Notifications, fix it, and apply again.",
];

// ─── COMPONENT ──────────────────────────────────────────────────────────────

type Props = {
  visible: boolean;
  onClose: () => void;
  onFindSite: () => void;
};

export default function HowToApplyGuide({ visible, onClose, onFindSite }: Props) {
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
              <Icon name="clipboard-text-outline" size={22} color={C.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>How to Apply</Text>
              <Text style={s.subtitle}>Become a tree grower in a few simple steps</Text>
            </View>
            <TouchableOpacity style={s.close} onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={18} color={C.gray} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Requirements */}
            <Text style={[s.sectionTitle, { marginTop: 4 }]}>1. What You Need</Text>
            {REQUIREMENTS.map((r) => (
              <View key={r.title} style={s.row}>
                <View style={s.rowIcon}>
                  <Icon name={r.icon} size={20} color={C.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.itemTitle}>{r.title}</Text>
                  <Text style={s.itemDesc}>{r.desc}</Text>
                </View>
              </View>
            ))}

            {/* Steps */}
            <Text style={s.sectionTitle}>2. Step-by-Step</Text>
            {APPLY_STEPS.map((step, i) => (
              <View key={step.title} style={s.stepRow}>
                <View style={s.stepNumCol}>
                  <View style={s.stepNum}>
                    <Text style={s.stepNumText}>{i + 1}</Text>
                  </View>
                  {i < APPLY_STEPS.length - 1 && <View style={s.stepLine} />}
                </View>
                <View style={{ flex: 1, paddingBottom: 14 }}>
                  <View style={s.stepTitleRow}>
                    <Icon name={step.icon} size={15} color={C.primaryMid} />
                    <Text style={s.itemTitle}>{step.title}</Text>
                  </View>
                  <Text style={s.itemDesc}>{step.desc}</Text>
                </View>
              </View>
            ))}

            {/* Stages */}
            <Text style={s.sectionTitle}>3. After You Submit</Text>
            <Text style={[s.itemDesc, { marginBottom: 10, marginTop: 0 }]}>
              Your application moves through these stages:
            </Text>
            <View style={s.stageCard}>
              {STAGES.map((st, i) => (
                <View
                  key={st.label}
                  style={[s.stageRow, i < STAGES.length - 1 && s.stageDivider]}
                >
                  <View style={s.stageIcon}>
                    <Icon name={st.icon} size={16} color={C.blue} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.stageLabel}>{st.label}</Text>
                    <Text style={s.itemDesc}>{st.desc}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Tips */}
            <Text style={s.sectionTitle}>4. Good to Know</Text>
            {TIPS.map((t) => (
              <View key={t} style={s.bulletRow}>
                <Icon name="check-circle" size={16} color={C.primaryMid} />
                <Text style={[s.itemDesc, { flex: 1, marginTop: 0 }]}>{t}</Text>
              </View>
            ))}
          </ScrollView>

          <View style={s.footer}>
            <TouchableOpacity style={s.btnSecondary} onPress={onClose}>
              <Text style={s.btnSecondaryText}>Close</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.btnPrimary} onPress={onFindSite}>
              <Icon name="map-search" size={16} color={C.white} />
              <Text style={s.btnPrimaryText}>Find a Site</Text>
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
  stepNumText: { color: C.white, fontSize: 12, fontWeight: "800" },
  stepLine: { flex: 1, width: 2, backgroundColor: C.greenLight, marginVertical: 2 },
  stepTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  stageCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    backgroundColor: C.white,
    paddingHorizontal: 12,
  },
  stageRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  stageDivider: { borderBottomWidth: 1, borderBottomColor: C.border },
  stageIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: C.blueLight,
    justifyContent: "center",
    alignItems: "center",
  },
  stageLabel: { fontSize: 13.5, fontWeight: "700", color: C.blue },
  bulletRow: { flexDirection: "row", gap: 8, marginTop: 6 },
  footer: {
    flexDirection: "row",
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  btnSecondary: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: C.bg,
    alignItems: "center",
  },
  btnSecondaryText: { color: C.primary, fontSize: 14, fontWeight: "700" },
  btnPrimary: {
    flex: 1.4,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: C.primary,
  },
  btnPrimaryText: { color: C.white, fontSize: 14, fontWeight: "700" },
});
