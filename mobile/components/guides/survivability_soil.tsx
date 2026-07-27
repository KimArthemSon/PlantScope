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
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

// ────────────────────────────────────────────
// IMAGE IMPORTS
// Ensure your images are placed in: assets/survivability/soils/
// Supported formats: .jpg, .png, .jpeg (adjust extension if needed)
// ─────────────────────────────────────────────
const goodSoil1 = require("@/assets/survivability/soils/good_soil_1.jpg");
const goodSoil2 = require("@/assets/survivability/soils/good_soil_2.jpg");
const goodSoil3 = require("@/assets/survivability/soils/good_soil_3.jpg");
const goodSoil4 = require("@/assets/survivability/soils/good_soil_4.jpg");

const badSoil1 = require("@/assets/survivability/soils/bad_soil_1.jpg");
const badSoil2 = require("@/assets/survivability/soils/bad_soil_2.jpg");
const badSoil3 = require("@/assets/survivability/soils/bad_soil_3.jpg");
const badSoil4 = require("@/assets/survivability/soils/bad_soil_4.jpg");

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface SoilGuideProps {
  visible: boolean;
  onClose: () => void;
}

export default function SoilGuide({ visible, onClose }: SoilGuideProps) {
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
              <Ionicons name="leaf" size={20} color="#fff" />
            </View>
            <View style={styles.headerTextGroup}>
              <Text style={styles.headerTitle}>Soil Assessment Guide</Text>
              <Text style={styles.headerSubtitle}>
                Is this type of soil good for roots?
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
            {/* Intro */}
            <View style={styles.introBox}>
              <Ionicons name="checkmark-circle" size={18} color="#0F4A2F" />
              <Text style={styles.introText}>
                Check 4 signs →{" "}
                <Text style={styles.introBold}>Plant with confidence.</Text>
              </Text>
            </View>

            {/* GOOD Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderGood}>
                <Ionicons name="checkmark-circle" size={20} color="#16A34A" />
                <Text style={styles.sectionTitleGood}>GOOD</Text>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.imageCarousel}
              >
                <Image source={goodSoil1} style={styles.carouselImage} />
                <Image source={goodSoil2} style={styles.carouselImage} />
                <Image source={goodSoil3} style={styles.carouselImage} />
                <Image source={goodSoil4} style={styles.carouselImage} />
              </ScrollView>

              <View style={styles.criteriaList}>
                <View style={styles.criteriaItem}>
                  <Text style={styles.criteriaLabel}>Texture:</Text>
                  <Text style={styles.criteriaValue}>
                    Crumbly and soft (loam).
                  </Text>
                </View>
                <View style={styles.criteriaItem}>
                  <Text style={styles.criteriaLabel}>Colour:</Text>
                  <Text style={styles.criteriaValue}>Dark brown/black.</Text>
                </View>
                <View style={styles.criteriaItem}>
                  <Text style={styles.criteriaLabel}>Structure:</Text>
                  <Text style={styles.criteriaValue}>
                    Small clumps that crumble easily.
                  </Text>
                </View>
                <View style={styles.criteriaItem}>
                  <Text style={styles.criteriaLabel}>Drainage:</Text>
                  <Text style={styles.criteriaValue}>
                    Soaks in fast, no pools.
                  </Text>
                </View>
              </View>
            </View>

            {/* BAD Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderBad}>
                <Ionicons name="close-circle" size={20} color="#DC2626" />
                <Text style={styles.sectionTitleBad}>BAD</Text>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.imageCarousel}
              >
                <Image source={badSoil1} style={styles.carouselImage} />
                <Image source={badSoil2} style={styles.carouselImage} />
                <Image source={badSoil3} style={styles.carouselImage} />
                <Image source={badSoil4} style={styles.carouselImage} />
              </ScrollView>

              <View style={styles.criteriaList}>
                <View style={styles.criteriaItem}>
                  <Text style={styles.criteriaLabel}>Texture:</Text>
                  <Text style={styles.criteriaValue}>
                    Too sticky (clay) or too loose (sand).
                  </Text>
                </View>
                <View style={styles.criteriaItem}>
                  <Text style={styles.criteriaLabel}>Colour:</Text>
                  <Text style={styles.criteriaValue}>
                    Pale, grey, or yellow.
                  </Text>
                </View>
                <View style={styles.criteriaItem}>
                  <Text style={styles.criteriaLabel}>Structure:</Text>
                  <Text style={styles.criteriaValue}>
                    Hard like rock, or powdery dust.
                  </Text>
                </View>
                <View style={styles.criteriaItem}>
                  <Text style={styles.criteriaLabel}>Drainage:</Text>
                  <Text style={styles.criteriaValue}>
                    Water pools on top, or dries instantly.
                  </Text>
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
                  color="#0F4A2F"
                />
                <Text style={styles.commentText}>
                  <Text style={styles.commentLabel}>Good: </Text>
                  "The soil is dark and soft. Sayon ra gyud tamnan."
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
                  "The soil is hard and dry. Lisod tamnan."
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
    maxHeight: SCREEN_WIDTH > 500 ? "85%" : "92%", // Taller on tablets
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
    backgroundColor: "#92400E",
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
  introBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0FDF4",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#BBF7D0",
    marginBottom: 20,
    gap: 8,
  },
  introText: {
    fontSize: 13,
    color: "#166534",
    fontWeight: "600",
    flex: 1,
  },
  introBold: {
    fontWeight: "800",
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
  sectionHeaderGood: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  sectionTitleGood: {
    fontSize: 16,
    fontWeight: "800",
    color: "#16A34A",
    letterSpacing: 0.5,
  },
  sectionHeaderBad: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  sectionTitleBad: {
    fontSize: 16,
    fontWeight: "800",
    color: "#DC2626",
    letterSpacing: 0.5,
  },
  imageCarousel: {
    marginBottom: 16,
  },
  carouselImage: {
    width: 120,
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
    flexWrap: "wrap",
  },
  criteriaLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
    marginRight: 4,
  },
  criteriaValue: {
    fontSize: 13,
    color: "#475569",
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
    backgroundColor: "#0F4A2F",
    margin: 20,
    marginTop: 10,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#0F4A2F",
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
