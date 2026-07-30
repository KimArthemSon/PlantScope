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
// Ensure your images are placed in: assets/safety/landslide/
// Supported formats: .jpg, .png, .jpeg (adjust extension if needed)
// ────────────────────────────────────────────
const safeLandslide1 = require("@/assets/safety/landslide/safe_landslide_1.png");
const safeLandslide2 = require("@/assets/safety/landslide/safe_landslide_2.png");
const safeLandslide3 = require("@/assets/safety/landslide/safe_landslide_3.png");

const dangerLandslide1 = require("@/assets/safety/landslide/danger_landslide_1.png");
const dangerLandslide2 = require("@/assets/safety/landslide/danger_landslide_2.png");
const dangerLandslide3 = require("@/assets/safety/landslide/danger_landslide_3.png");

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface LandslideGuideProps {
  visible: boolean;
  onClose: () => void;
}

export default function LandslideGuide({
  visible,
  onClose,
}: LandslideGuideProps) {
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
              <Ionicons name="mountain" size={20} color="#fff" />
            </View>
            <View style={styles.headerTextGroup}>
              <Text style={styles.headerTitle}>Landslide Assessment Guide</Text>
              <Text style={styles.headerSubtitle}>
                Is the slope safe from any landslide?
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
                <Image source={safeLandslide1} style={styles.carouselImage} />
                <Image source={safeLandslide2} style={styles.carouselImage} />
                <Image source={safeLandslide3} style={styles.carouselImage} />
              </ScrollView>

              <View style={styles.criteriaList}>
                <View style={styles.criteriaItem}>
                  <Ionicons
                    name="trending-up-outline"
                    size={14}
                    color="#16A34A"
                  />
                  <Text style={styles.criteriaValue}>
                    Flat or gentle slope.
                  </Text>
                </View>
                <View style={styles.criteriaItem}>
                  <Ionicons name="leaf-outline" size={14} color="#16A34A" />
                  <Text style={styles.criteriaValue}>
                    Trees stand straight.
                  </Text>
                </View>
                <View style={styles.criteriaItem}>
                  <Ionicons name="grass-outline" size={14} color="#16A34A" />
                  <Text style={styles.criteriaValue}>
                    Thick grass covers ground.
                  </Text>
                </View>
                <View style={styles.criteriaItem}>
                  <Ionicons name="remove-outline" size={14} color="#16A34A" />
                  <Text style={styles.criteriaValue}>No ground cracks.</Text>
                </View>
                <View style={styles.criteriaItem}>
                  <Ionicons
                    name="hand-left-outline"
                    size={14}
                    color="#16A34A"
                  />
                  <Text style={styles.criteriaValue}>Soil feels firm.</Text>
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
                <Image source={dangerLandslide1} style={styles.carouselImage} />
                <Image source={dangerLandslide2} style={styles.carouselImage} />
                <Image source={dangerLandslide3} style={styles.carouselImage} />
              </ScrollView>

              <View style={styles.criteriaList}>
                <View style={styles.criteriaItem}>
                  <Ionicons
                    name="git-branch-outline"
                    size={14}
                    color="#DC2626"
                  />
                  <Text style={styles.criteriaValue}>Ground cracks.</Text>
                </View>
                <View style={styles.criteriaItem}>
                  <Ionicons
                    name="trending-down-outline"
                    size={14}
                    color="#DC2626"
                  />
                  <Text style={styles.criteriaValue}>Leaning trees.</Text>
                </View>
                <View style={styles.criteriaItem}>
                  <Ionicons name="layers-outline" size={14} color="#DC2626" />
                  <Text style={styles.criteriaValue}>Bare soil grooves.</Text>
                </View>
                <View style={styles.criteriaItem}>
                  <Ionicons name="rock-outline" size={14} color="#DC2626" />
                  <Text style={styles.criteriaValue}>Loose rocks.</Text>
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
                  "The ground is stable. Walay bitak ug tarong ang mga kahoy."
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
                  "High risk of landslide. May bitak sa yuta ug nagbaluktot nga
                  kahoy."
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
    backgroundColor: "#854D0E",
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
    backgroundColor: "#854D0E",
    margin: 20,
    marginTop: 10,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#854D0E",
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
