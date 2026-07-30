import React from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image,
  StyleSheet,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

// ────────────────────────────────────────────
// IMAGE IMPORTS
// Ensure your images are placed in: assets/safety/erosion/
// Supported formats: .jpg, .png, .jpeg (adjust extension if needed)
// ────────────────────────────────────────────
const safeErosion1 = require("@/assets/safety/erosion/safe_erosion_1.png");
const safeErosion2 = require("@/assets/safety/erosion/safe_erosion_2.png");
const safeErosion3 = require("@/assets/safety/erosion/safe_erosion_3.png");

const dangerErosion1 = require("@/assets/safety/erosion/danger_erosion_1.png");
const dangerErosion2 = require("@/assets/safety/erosion/danger_erosion_2.png");
const dangerErosion3 = require("@/assets/safety/erosion/danger_erosion_3.png");

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface ErosionGuideProps {
  visible: boolean;
  onClose: () => void;
}

export default function ErosionGuide({ visible, onClose }: ErosionGuideProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerIconWrap}>
              <Ionicons name="alert-circle" size={20} color="#fff" />
            </View>
            <View style={styles.headerTextGroup}>
              <Text style={styles.headerTitle}>Soil Erosion Guide</Text>
              <Text style={styles.headerSubtitle}>
                Is the topsoil disappearing?
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={24} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* SAFE Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderSafe}>
                <Ionicons name="checkmark-circle" size={20} color="#16A34A" />
                <Text style={styles.sectionTitleSafe}>SAFE</Text>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.imageCarousel}
              >
                <Image source={safeErosion1} style={styles.carouselImage} />
                <Image source={safeErosion2} style={styles.carouselImage} />
                <Image source={safeErosion3} style={styles.carouselImage} />
              </ScrollView>

              <View style={styles.criteriaList}>
                <View style={styles.criteriaItem}>
                  <Ionicons name="leaf-outline" size={14} color="#16A34A" />
                  <Text style={styles.criteriaValue}>
                    Ground covered by leaves.
                  </Text>
                </View>
                <View style={styles.criteriaItem}>
                  <Ionicons name="grass-outline" size={14} color="#16A34A" />
                  <Text style={styles.criteriaValue}>
                    Thick grass or plants.
                  </Text>
                </View>
                <View style={styles.criteriaItem}>
                  <Ionicons
                    name="color-palette-outline"
                    size={14}
                    color="#16A34A"
                  />
                  <Text style={styles.criteriaValue}>Dark soil visible.</Text>
                </View>
                <View style={styles.criteriaItem}>
                  <Ionicons name="remove-outline" size={14} color="#16A34A" />
                  <Text style={styles.criteriaValue}>No exposed roots.</Text>
                </View>
                <View style={styles.criteriaItem}>
                  <Ionicons name="water-outline" size={14} color="#16A34A" />
                  <Text style={styles.criteriaValue}>No erosion channel.</Text>
                </View>
              </View>
            </View>

            {/* DANGER Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderDanger}>
                <Ionicons name="close-circle" size={20} color="#DC2626" />
                <Text style={styles.sectionTitleDanger}>DANGER</Text>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.imageCarousel}
              >
                <Image source={dangerErosion1} style={styles.carouselImage} />
                <Image source={dangerErosion2} style={styles.carouselImage} />
                <Image source={dangerErosion3} style={styles.carouselImage} />
              </ScrollView>

              <View style={styles.criteriaList}>
                <View style={styles.criteriaItem}>
                  <Ionicons
                    name="trending-down-outline"
                    size={14}
                    color="#DC2626"
                  />
                  <Text style={styles.criteriaValue}>
                    Deep erosion channels.
                  </Text>
                </View>
                <View style={styles.criteriaItem}>
                  <Ionicons
                    name="git-branch-outline"
                    size={14}
                    color="#DC2626"
                  />
                  <Text style={styles.criteriaValue}>Exposed tree roots.</Text>
                </View>
                <View style={styles.criteriaItem}>
                  <Ionicons name="layers-outline" size={14} color="#DC2626" />
                  <Text style={styles.criteriaValue}>Bare soil.</Text>
                </View>
                <View style={styles.criteriaItem}>
                  <Ionicons name="water-outline" size={14} color="#DC2626" />
                  <Text style={styles.criteriaValue}>
                    Muddy runoff or creek.
                  </Text>
                </View>
                <View style={styles.criteriaItem}>
                  <Ionicons name="cloud-outline" size={14} color="#DC2626" />
                  <Text style={styles.criteriaValue}>Soil washed away.</Text>
                </View>
              </View>
            </View>

            {/* Comment Examples */}
            <View style={styles.commentSection}>
              <Text style={styles.commentTitle}>YOUR COMMENT EXAMPLES</Text>
              <View style={styles.commentBox}>
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={16}
                  color="#16A34A"
                />
                <Text style={styles.commentText}>
                  <Text style={styles.commentLabel}>Good: </Text>
                  "The soil is protected by leaves and grass. Walay erosion."
                </Text>
              </View>
              <View style={styles.commentBox}>
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={16}
                  color="#DC2626"
                />
                <Text style={styles.commentText}>
                  <Text style={styles.commentLabel}>Problem: </Text>
                  "High risk of soil erosion. Nakalantad ang gamot ug lawom ang
                  kanal."
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* Footer Close Button */}
          <TouchableOpacity
            style={styles.footerButton}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Text style={styles.footerButtonText}>Close Guide</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "#F8FAFC",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_WIDTH > 500 ? "85%" : "92%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    paddingBottom: 16,
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  headerIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#B91C1C",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  headerTextGroup: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F2D1C",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  closeButton: {
    padding: 4,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 10,
  },
  section: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  // SAFE Section
  sectionHeaderSafe: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  sectionTitleSafe: {
    fontSize: 16,
    fontWeight: "800",
    color: "#16A34A",
    letterSpacing: 0.5,
  },
  // DANGER Section
  sectionHeaderDanger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  sectionTitleDanger: {
    fontSize: 16,
    fontWeight: "800",
    color: "#DC2626",
    letterSpacing: 0.5,
  },
  imageCarousel: {
    marginBottom: 16,
  },
  carouselImage: {
    width: 140,
    height: 120,
    borderRadius: 12,
    marginRight: 12,
    backgroundColor: "#E2E8F0",
  },
  criteriaList: {
    gap: 8,
  },
  criteriaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  criteriaValue: {
    fontSize: 13,
    color: "#334155",
    fontWeight: "500",
    flex: 1,
  },
  commentSection: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  commentTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#94A3B8",
    letterSpacing: 1,
    marginBottom: 12,
  },
  commentBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#F8FAFC",
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  commentText: {
    fontSize: 13,
    color: "#334155",
    flex: 1,
    fontStyle: "italic",
  },
  commentLabel: {
    fontStyle: "normal",
    fontWeight: "700",
  },
  footerButton: {
    backgroundColor: "#B91C1C",
    margin: 20,
    marginTop: 10,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#B91C1C",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  footerButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
});
