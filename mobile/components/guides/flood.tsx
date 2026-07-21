// /components/guides/flood.tsx
import React from "react";
import {
  Modal,
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
// Add Platform import at the top
import { Platform } from "react-native";
const { width } = Dimensions.get("window");

interface FloodGuideProps {
  visible: boolean;
  onClose: () => void;
}

interface GuideSection {
  title: string;
  icon: string;
  description: string;
  indicators: string[];
  imageUrl?: string;
  imageCaption?: string;
}

const guideSections: GuideSection[] = [
  {
    title: "High Water Marks",
    icon: "water-outline",
    description:
      "High-water marks are physical evidence left on buildings, trees, or infrastructure after a flood. These visual indicators help assess the flood's severity and maximum water level reached. [[5]]",
    indicators: [
      "Discoloration or staining on walls and structures",
      "Mud lines or sediment deposits on vertical surfaces",
      "Water stains on doors, windows, and foundations",
      "Debris caught at specific heights on trees or poles",
      "Paint peeling or blistering at water line level",
    ],
    imageUrl:
      "https://www.usgs.gov/media/images/high-water-mark-example-building",
    imageCaption: "Water line marks on building walls showing flood height",
  },
  {
    title: "Debris Accumulation",
    icon: "trash-outline",
    description:
      "Floodwaters carry and deposit debris as they recede. The type, amount, and location of debris provide crucial information about flood velocity, direction, and impact. [[29]]",
    indicators: [
      "Branches, logs, and vegetation caught on structures",
      "Trash and household items scattered in patterns",
      "Debris caught against upstream sides of obstacles",
      "Sediment and mud deposits around foundations",
      "Damage to structures from floating debris impact",
    ],
    imageUrl:
      "https://images.unsplash.com/photo-1596484552834-37220008d8d1?w=800",
    imageCaption: "Debris accumulation after flood waters recede",
  },
  {
    title: "Sediment & Soil Evidence",
    icon: "layers-outline",
    description:
      "Flood deposits leave distinct sediment layers and soil patterns. These deposits can indicate flood depth, duration, and the type of flooding event. [[33]]",
    indicators: [
      "Thin layers of silt or mud on surfaces",
      "Sand or gravel deposits in unusual locations",
      "Soil erosion patterns around structures",
      "Sediment buildup in low-lying areas",
      "Mud cracking patterns after drying",
    ],
    imageUrl:
      "https://images.unsplash.com/photo-1569396189389-8192d03f1d1b?w=800",
    imageCaption: "Sediment deposits and soil erosion from flooding",
  },
  {
    title: "Structural Damage",
    icon: "warning-outline",
    description:
      "Flood damage to buildings and infrastructure reveals the force and extent of flooding. Visual inspection of structural elements is critical for safety assessment. [[14]]",
    indicators: [
      "Foundation cracks or shifting",
      "Warped or buckled floors and walls",
      "Moisture damage in ceilings and walls",
      "Compromised structural supports",
      "Damage to electrical and plumbing systems",
    ],
    imageUrl:
      "https://images.unsplash.com/photo-1605337709650-5066156f8c5d?w=800",
    imageCaption: "Structural damage from flood water exposure",
  },
  {
    title: "Vegetation & Landscape",
    icon: "leaf-outline",
    description:
      "Changes to vegetation and landscape provide long-term evidence of flooding. Plants and trees show stress patterns and physical damage from flood events.",
    indicators: [
      "Trees bent or leaning in water flow direction",
      "Vegetation stripped from lower branches",
      "Discolored or dying plants from water saturation",
      "Soil erosion exposing tree roots",
      "New sediment layers covering ground vegetation",
    ],
    imageUrl:
      "https://images.unsplash.com/photo-1621451585704-28c687918f34?w=800",
    imageCaption: "Vegetation damage and landscape changes from flooding",
  },
  {
    title: "Safety Concerns",
    icon: "shield-checkmark-outline",
    description:
      "Flood events create multiple safety hazards that must be identified during assessment. These concerns affect both immediate safety and long-term habitability.",
    indicators: [
      "Contaminated water and sediment (sewage, chemicals)",
      "Electrical hazards from water exposure",
      "Unstable structures and foundations",
      "Mold growth potential in damp areas",
      "Hidden damage behind walls and under floors",
      "Slip and fall hazards from wet surfaces",
    ],
    imageUrl:
      "https://images.unsplash.com/photo-1542314831-02903a7f279e?w=800",
    imageCaption: "Safety hazards require careful inspection",
  },
];

export default function FloodGuide({ visible, onClose }: FloodGuideProps) {
  const [activeSection, setActiveSection] = React.useState<number>(0);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onClose}>
            <Ionicons name="arrow-back" size={24} color="#1D4ED8" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <View style={styles.headerIcon}>
              <Ionicons name="water" size={28} color="#1D4ED8" />
            </View>
            <View>
              <Text style={styles.headerTitle}>Flood Evidence Guide</Text>
              <Text style={styles.headerSubtitle}>
                Field Inspection Reference
              </Text>
            </View>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* Quick Tips Banner */}
        <View style={styles.tipsBanner}>
          <Ionicons name="information-circle" size={20} color="#1D4ED8" />
          <Text style={styles.tipsText}>
            Look for physical evidence left behind after flood waters recede
          </Text>
        </View>

        {/* Section Navigation */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.navScroll}
          contentContainerStyle={styles.navContent}
        >
          {guideSections.map((section, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.navItem,
                activeSection === index && styles.navItemActive,
              ]}
              onPress={() => setActiveSection(index)}
            >
              <Ionicons
                name={section.icon as any}
                size={18}
                color={activeSection === index ? "#fff" : "#1D4ED8"}
              />
              <Text
                style={[
                  styles.navText,
                  activeSection === index && styles.navTextActive,
                ]}
                numberOfLines={1}
              >
                {section.title}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Content */}
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {guideSections.map((section, index) => (
            <View
              key={index}
              style={[
                styles.section,
                activeSection === index && styles.sectionActive,
              ]}
            >
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIconBadge}>
                  <Ionicons
                    name={section.icon as any}
                    size={24}
                    color="#1D4ED8"
                  />
                </View>
                <Text style={styles.sectionTitle}>{section.title}</Text>
              </View>

              <Text style={styles.sectionDescription}>{section.description}</Text>

              {section.imageUrl && (
                <View style={styles.imageContainer}>
                  <Image
                    source={{ uri: section.imageUrl }}
                    style={styles.referenceImage}
                    resizeMode="cover"
                  />
                  {section.imageCaption && (
                    <Text style={styles.imageCaption}>{section.imageCaption}</Text>
                  )}
                </View>
              )}

              <View style={styles.indicatorsContainer}>
                <Text style={styles.indicatorsTitle}>Key Indicators to Look For:</Text>
                {section.indicators.map((indicator, idx) => (
                  <View key={idx} style={styles.indicatorItem}>
                    <View style={styles.checkmark}>
                      <Ionicons name="checkmark" size={12} color="#fff" />
                    </View>
                    <Text style={styles.indicatorText}>{indicator}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}

          {/* Additional Resources */}
          <View style={styles.resourcesSection}>
            <Text style={styles.resourcesTitle}>Additional Resources</Text>
            <View style={styles.resourceItem}>
              <Ionicons name="document-text-outline" size={18} color="#64748B" />
              <Text style={styles.resourceText}>
                USGS High-Water Mark Identification Guide
              </Text>
            </View>
            <View style={styles.resourceItem}>
              <Ionicons name="document-text-outline" size={18} color="#64748B" />
              <Text style={styles.resourceText}>
                FEMA Flood Damage Assessment Guidelines
              </Text>
            </View>
            <View style={styles.resourceItem}>
              <Ionicons name="document-text-outline" size={18} color="#64748B" />
              <Text style={styles.resourceText}>
                Field Safety Protocol for Flood Assessment
              </Text>
            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Close Guide</Text>
            <Ionicons name="close-circle-outline" size={20} color="#1D4ED8" />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    paddingTop: Platform.OS === "ios" ? 60 : 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
  },
  headerContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginLeft: 12,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 1,
  },
  tipsBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#EFF6FF",
    margin: 16,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  tipsText: {
    flex: 1,
    fontSize: 13,
    color: "#1E40AF",
    fontWeight: "500",
  },
  navScroll: {
    maxHeight: 50,
    backgroundColor: "#fff",
  },
  navContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  navItemActive: {
    backgroundColor: "#1D4ED8",
    borderColor: "#1D4ED8",
  },
  navText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1D4ED8",
    maxWidth: 100,
  },
  navTextActive: {
    color: "#fff",
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 14,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    opacity: 0.4,
  },
  sectionActive: {
    opacity: 1,
    borderWidth: 2,
    borderColor: "#1D4ED8",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  sectionIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
  },
  sectionDescription: {
    fontSize: 13,
    color: "#475569",
    lineHeight: 20,
    marginBottom: 14,
  },
  imageContainer: {
    marginBottom: 14,
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  referenceImage: {
    width: "100%",
    height: 180,
    backgroundColor: "#F1F5F9",
  },
  imageCaption: {
    fontSize: 11,
    color: "#64748B",
    padding: 8,
    backgroundColor: "#F8FAFC",
    textAlign: "center",
    fontStyle: "italic",
  },
  indicatorsContainer: {
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  indicatorsTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  indicatorItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 8,
  },
  checkmark: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#10B981",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 1,
    flexShrink: 0,
  },
  indicatorText: {
    flex: 1,
    fontSize: 13,
    color: "#334155",
    lineHeight: 18,
  },
  resourcesSection: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    borderRadius: 14,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  resourcesTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 12,
  },
  resourceItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  resourceText: {
    flex: 1,
    fontSize: 13,
    color: "#475569",
  },
  footer: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === "ios" ? 28 : 12,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  closeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#EFF6FF",
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1D4ED8",
  },
});

