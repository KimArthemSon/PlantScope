import React from "react";
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

// ─────────────────────────────────────────────
// NOTE:
// Image URLs below use a placeholder image service
// (picsum.photos with fixed seeds) purely to SIMULATE
// what real reference photography would look like in
// this guide. Swap `uri` values for your own vetted /
// licensed field photos before shipping to production.
// ─────────────────────────────────────────────

interface FloodSign {
  id: string;
  title: string;
  caption: string;
  imageUri: string;
}

const FLOOD_SIGNS: FloodSign[] = [
  {
    id: "high-water-marks",
    title: "High-Water Marks",
    caption:
      "Discoloration, dirt lines, or stains on tree trunks, walls, posts, or foundations mark how high floodwater previously reached. These are one of the most reliable signs a site has flooded before.",
    imageUri: "https://picsum.photos/seed/flood-watermark/400/300",
  },
  {
    id: "debris-lines",
    title: "Debris & Drift Lines",
    caption:
      "Leaves, twigs, grass, or trash caught in fences, low branches, or snagged against tree bases in a horizontal line show the path and extent that receding water carried debris.",
    imageUri: "https://picsum.photos/seed/flood-debris/400/300",
  },
  {
    id: "sediment-silt",
    title: "Sediment & Silt Deposits",
    caption:
      "A thin layer of mud, silt, or fine sand coating the ground, rocks, or low vegetation after water recedes indicates the area was recently submerged or saturated.",
    imageUri: "https://picsum.photos/seed/flood-silt/400/300",
  },
  {
    id: "stressed-vegetation",
    title: "Matted or Stressed Vegetation",
    caption:
      "Grass and low plants bent or flattened in one direction, or patches of dying/discolored vegetation, can point to standing water or fast flow that recently passed through.",
    imageUri: "https://picsum.photos/seed/flood-vegetation/400/300",
  },
  {
    id: "low-topography",
    title: "Low-Lying / Basin Terrain",
    caption:
      "Areas noticeably lower than the surrounding land, or sitting at the base of a slope, naturally collect runoff. Pooled or standing water here after rain is a strong warning sign.",
    imageUri: "https://picsum.photos/seed/flood-terrain/400/300",
  },
  {
    id: "drainage-blockage",
    title: "Blocked or Undersized Drainage",
    caption:
      "Clogged culverts, silted-up channels, or drainage paths choked with debris reduce an area's ability to move water away, increasing the chance of localized flooding.",
    imageUri: "https://picsum.photos/seed/flood-drainage/400/300",
  },
];

const CARD_WIDTH = Math.min(240, Dimensions.get("window").width * 0.62);

interface FloodGuideProps {
  visible: boolean;
  onClose: () => void;
}

export default function FloodGuide({ visible, onClose }: FloodGuideProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headerIconWrap}>
              <Ionicons name="water" size={20} color="#1D4ED8" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Flood Hazard Field Guide</Text>
              <Text style={styles.headerSubtitle}>
                What to look for on site
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.closeBtn}
            >
              <Ionicons name="close" size={20} color="#475569" />
            </TouchableOpacity>
          </View>

          <Text style={styles.intro}>
            Flooding leaves physical traces behind even after the water is
            gone. Use these visual cues to identify flood-prone or
            recently-flooded ground during inspection, and photograph any
            evidence you find using the GPS camera.
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={CARD_WIDTH + 12}
            decelerationRate="fast"
            contentContainerStyle={styles.carouselContent}
          >
            {FLOOD_SIGNS.map((sign) => (
              <View key={sign.id} style={[styles.card, { width: CARD_WIDTH }]}>
                <Image
                  source={{ uri: sign.imageUri }}
                  style={styles.cardImage}
                  resizeMode="cover"
                />
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>{sign.title}</Text>
                  <Text style={styles.cardCaption}>{sign.caption}</Text>
                </View>
              </View>
            ))}
          </ScrollView>

          <View style={styles.footerNote}>
            <Ionicons name="information-circle-outline" size={14} color="#64748B" />
            <Text style={styles.footerNoteText}>
              Reference images are illustrative examples, not photos of this
              specific site.
            </Text>
          </View>

          <TouchableOpacity style={styles.doneBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.doneBtnText}>Got it</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 18,
    paddingBottom: 24,
    paddingHorizontal: 16,
    maxHeight: "85%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  headerIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#DBEAFE",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { fontSize: 16, fontWeight: "800", color: "#0F2D1C" },
  headerSubtitle: { fontSize: 12, color: "#94A3B8", marginTop: 1 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  intro: {
    fontSize: 13,
    lineHeight: 19,
    color: "#475569",
    marginBottom: 16,
  },
  carouselContent: { gap: 12, paddingBottom: 4, paddingRight: 4 },
  card: {
    borderRadius: 14,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    overflow: "hidden",
  },
  cardImage: { width: "100%", height: 130, backgroundColor: "#E2E8F0" },
  cardBody: { padding: 12, gap: 4 },
  cardTitle: { fontSize: 13, fontWeight: "700", color: "#1E293B" },
  cardCaption: { fontSize: 11.5, lineHeight: 16, color: "#64748B" },
  footerNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 14,
    marginBottom: 12,
  },
  footerNoteText: { fontSize: 10.5, color: "#94A3B8", flex: 1 },
  doneBtn: {
    backgroundColor: "#0F4A2F",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  doneBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});