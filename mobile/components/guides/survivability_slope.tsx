import React, { useState } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image,
  StyleSheet,
  Dimensions,
  TouchableWithoutFeedback,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ────────────────────────────────────────────
// IMAGE IMPORTS
// Ensure your images are placed in: assets/survivability/slope/
// Supported formats: .jpg, .png, .jpeg (adjust extension if needed)
// ─────────────────────────────────────────────
const goodSlope1 = require("@/assets/survivability/slope/good_slope_1.png");
const goodSlope2 = require("@/assets/survivability/slope/good_slope_2.png");

const rollingSlope1 = require("@/assets/survivability/slope/rolling_slope_1.png");
const rollingSlope2 = require("@/assets/survivability/slope/rolling_slope_2.png");

const badSlope1 = require("@/assets/survivability/slope/bad_slope_1.png");
const badSlope2 = require("@/assets/survivability/slope/bad_slope_2.png");

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface SlopeGuideProps {
  visible: boolean;
  onClose: () => void;
}

// Image data structure
interface GuideImage {
  id: string;
  source: any;
  category: "good" | "caution" | "bad";
  label: string;
}

const allImages: GuideImage[] = [
  { id: "good1", source: goodSlope1, category: "good", label: "Flat / Gentle" },
  { id: "good2", source: goodSlope2, category: "good", label: "Flat / Gentle" },
  { id: "rolling1", source: rollingSlope1, category: "caution", label: "Rolling / Hilly" },
  { id: "rolling2", source: rollingSlope2, category: "caution", label: "Rolling / Hilly" },
  { id: "bad1", source: badSlope1, category: "bad", label: "Very Steep" },
  { id: "bad2", source: badSlope2, category: "bad", label: "Very Steep" },
];

export default function SlopeGuide({ visible, onClose }: SlopeGuideProps) {
  const insets = useSafeAreaInsets();
  const [fullScreenImage, setFullScreenImage] = useState<GuideImage | null>(null);
  const [imageIndex, setImageIndex] = useState(0);

  const openFullScreen = (image: GuideImage, index: number) => {
    setFullScreenImage(image);
    setImageIndex(index);
  };

  const closeFullScreen = () => {
    setFullScreenImage(null);
  };

  const navigateImage = (direction: "prev" | "next") => {
    const currentIndex = allImages.findIndex(img => img.id === fullScreenImage?.id);
    let newIndex = direction === "next" ? currentIndex + 1 : currentIndex - 1;
    
    if (newIndex < 0) newIndex = allImages.length - 1;
    if (newIndex >= allImages.length) newIndex = 0;
    
    setImageIndex(newIndex);
    setFullScreenImage(allImages[newIndex]);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modalContainer, { paddingBottom: insets.bottom }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerIconWrap}>
              <Ionicons name="trending-up" size={20} color="#fff" />
            </View>
            <View style={styles.headerTextGroup}>
              <Text style={styles.headerTitle}>Slope Assessment Guide</Text>
              <Text style={styles.headerSubtitle}>
                Is the ground stable to plant on?
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
            {/* FLAT / GENTLE Section (BEST) */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderGood}>
                <Ionicons name="checkmark-circle" size={20} color="#16A34A" />
                <Text style={styles.sectionTitleGood}>FLAT / GENTLE</Text>
                <View style={styles.badgeGood}>
                  <Text style={styles.badgeGoodText}>BEST</Text>
                </View>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.imageCarousel}
              >
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => openFullScreen(allImages[0], 0)}
                >
                  <Image source={goodSlope1} style={styles.carouselImage} />
                  <View style={styles.imageHint}>
                    <Ionicons name="expand-outline" size={12} color="#16A34A" />
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => openFullScreen(allImages[1], 1)}
                >
                  <Image source={goodSlope2} style={styles.carouselImage} />
                  <View style={styles.imageHint}>
                    <Ionicons name="expand-outline" size={12} color="#16A34A" />
                  </View>
                </TouchableOpacity>
              </ScrollView>

              <View style={styles.criteriaList}>
                <View style={styles.criteriaItem}>
                  <Ionicons name="walk-outline" size={14} color="#16A34A" />
                  <Text style={styles.criteriaValue}>Easy to walk.</Text>
                </View>
                <View style={styles.criteriaItem}>
                  <Ionicons name="leaf-outline" size={14} color="#16A34A" />
                  <Text style={styles.criteriaValue}>Best for planting.</Text>
                </View>
                <View style={styles.criteriaItem}>
                  <Ionicons name="water-outline" size={14} color="#16A34A" />
                  <Text style={styles.criteriaValue}>
                    Water soaks into soil.
                  </Text>
                </View>
              </View>
            </View>

            {/* ROLLING / HILLY Section (CAUTION) */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderCaution}>
                <Ionicons name="alert-circle" size={20} color="#D97706" />
                <Text style={styles.sectionTitleCaution}>ROLLING / HILLY</Text>
                <View style={styles.badgeCaution}>
                  <Text style={styles.badgeCautionText}>CAUTION</Text>
                </View>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.imageCarousel}
              >
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => openFullScreen(allImages[2], 2)}
                >
                  <Image source={rollingSlope1} style={styles.carouselImage} />
                  <View style={styles.imageHint}>
                    <Ionicons name="expand-outline" size={12} color="#D97706" />
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => openFullScreen(allImages[3], 3)}
                >
                  <Image source={rollingSlope2} style={styles.carouselImage} />
                  <View style={styles.imageHint}>
                    <Ionicons name="expand-outline" size={12} color="#D97706" />
                  </View>
                </TouchableOpacity>
              </ScrollView>

              <View style={styles.criteriaList}>
                <View style={styles.criteriaItem}>
                  <Ionicons name="resize-outline" size={14} color="#D97706" />
                  <Text style={styles.criteriaValue}>Small hills.</Text>
                </View>
                <View style={styles.criteriaItem}>
                  <Ionicons name="warning-outline" size={14} color="#D97706" />
                  <Text style={styles.criteriaValue}>Plant with care.</Text>
                </View>
                <View style={styles.criteriaItem}>
                  <Ionicons name="water-outline" size={14} color="#D97706" />
                  <Text style={styles.criteriaValue}>
                    Water flows downhill.
                  </Text>
                </View>
              </View>
            </View>

            {/* VERY STEEP Section (AVOID) */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderBad}>
                <Ionicons name="close-circle" size={20} color="#DC2626" />
                <Text style={styles.sectionTitleBad}>VERY STEEP</Text>
                <View style={styles.badgeBad}>
                  <Text style={styles.badgeBadText}>AVOID</Text>
                </View>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.imageCarousel}
              >
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => openFullScreen(allImages[4], 4)}
                >
                  <Image source={badSlope1} style={styles.carouselImage} />
                  <View style={styles.imageHint}>
                    <Ionicons name="expand-outline" size={12} color="#DC2626" />
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => openFullScreen(allImages[5], 5)}
                >
                  <Image source={badSlope2} style={styles.carouselImage} />
                  <View style={styles.imageHint}>
                    <Ionicons name="expand-outline" size={12} color="#DC2626" />
                  </View>
                </TouchableOpacity>
              </ScrollView>

              <View style={styles.criteriaList}>
                <View style={styles.criteriaItem}>
                  <Ionicons name="walk-outline" size={14} color="#DC2626" />
                  <Text style={styles.criteriaValue}>Hard to walk.</Text>
                </View>
                <View style={styles.criteriaItem}>
                  <Ionicons
                    name="trending-down-outline"
                    size={14}
                    color="#DC2626"
                  />
                  <Text style={styles.criteriaValue}>High erosion risk.</Text>
                </View>
                <View style={styles.criteriaItem}>
                  <Ionicons name="ban-outline" size={14} color="#DC2626" />
                  <Text style={styles.criteriaValue}>
                    Avoid planting if possible.
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
                  color="#16A34A"
                />
                <Text style={styles.commentText}>
                  <Text style={styles.commentLabel}>Good: </Text>
                  "The slope is gentle. Dali ra tamnan."
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
                  "The slope is too steep. Bakilid kaayo, dili maayo tamnan."
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* Footer Close Button */}
          <View style={[styles.footerContainer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
            <TouchableOpacity
              style={styles.footerButton}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text style={styles.footerButtonText}>Close Guide</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Full Screen Image Viewer Modal */}
        <Modal
          visible={!!fullScreenImage}
          animationType="fade"
          transparent={true}
          onRequestClose={closeFullScreen}
        >
          <View style={fullScreenStyles.container}>
            <TouchableWithoutFeedback onPress={closeFullScreen}>
              <View style={fullScreenStyles.background} />
            </TouchableWithoutFeedback>
            
            <View style={fullScreenStyles.imageContainer}>
              {/* Header */}
              <View style={fullScreenStyles.header}>
                <TouchableOpacity
                  style={fullScreenStyles.navButton}
                  onPress={() => navigateImage("prev")}
                >
                  <Ionicons name="chevron-back" size={24} color="#fff" />
                </TouchableOpacity>
                
                <View style={fullScreenStyles.headerInfo}>
                  <Text style={fullScreenStyles.categoryLabel}>
                    {fullScreenImage?.label}
                  </Text>
                  <Text style={fullScreenStyles.imageCounter}>
                    {imageIndex + 1} / {allImages.length}
                  </Text>
                </View>

                <TouchableOpacity
                  style={fullScreenStyles.navButton}
                  onPress={() => navigateImage("next")}
                >
                  <Ionicons name="chevron-forward" size={24} color="#fff" />
                </TouchableOpacity>
              </View>

              {/* Zoomable Image */}
              <ScrollView
                style={fullScreenStyles.scrollContainer}
                maximumZoomScale={3}
                minimumZoomScale={1}
                showsVerticalScrollIndicator={false}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={fullScreenStyles.scrollContent}
              >
                <Image
                  source={fullScreenImage?.source}
                  style={fullScreenStyles.fullImage}
                  resizeMode="contain"
                />
              </ScrollView>

              {/* Close Button */}
              <TouchableOpacity
                style={fullScreenStyles.closeButton}
                onPress={closeFullScreen}
              >
                <View style={fullScreenStyles.closeButtonBg}>
                  <Ionicons name="close" size={24} color="#fff" />
                </View>
              </TouchableOpacity>

              {/* Instructions */}
              <View style={fullScreenStyles.instructions}>
                <Text style={fullScreenStyles.instructionsText}>
                  Pinch to zoom • Swipe to navigate
                </Text>
              </View>
            </View>
          </View>
        </Modal>
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
  badgeGood: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: "auto",
  },
  badgeGoodText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#16A34A",
    letterSpacing: 0.5,
  },
  sectionHeaderCaution: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  sectionTitleCaution: {
    fontSize: 16,
    fontWeight: "800",
    color: "#D97706",
    letterSpacing: 0.5,
  },
  badgeCaution: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: "auto",
  },
  badgeCautionText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#D97706",
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
  badgeBad: {
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: "auto",
  },
  badgeBadText: {
    fontSize: 10,
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
  imageHint: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(255,255,255,0.9)",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
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
  footerContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    backgroundColor: "#F8FAFC",
  },
  footerButton: {
    backgroundColor: "#B91C1C",
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

// Full screen image viewer styles
const fullScreenStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
  },
  background: {
    ...StyleSheet.absoluteFillObject,
  },
  imageContainer: {
    flex: 1,
    position: "relative",
  },
  header: {
    position: "absolute",
    top: 50,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    zIndex: 10,
  },
  navButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    backdropFilter: "blur(10px)",
  },
  headerInfo: {
    alignItems: "center",
  },
  categoryLabel: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  imageCounter: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    minHeight: "100%",
  },
  fullImage: {
    width: "100%",
    height: "100%",
    minHeight: 400,
  },
  closeButton: {
    position: "absolute",
    bottom: 80,
    right: 20,
    zIndex: 10,
  },
  closeButtonBg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#B91C1C",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  instructions: {
    position: "absolute",
    bottom: 30,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  instructionsText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    fontWeight: "600",
  },
});