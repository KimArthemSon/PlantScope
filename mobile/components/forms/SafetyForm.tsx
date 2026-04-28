import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Switch,
  Alert,
  StyleSheet,
  Image,
  ActivityIndicator,
  Modal,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  MapPin,
  AlertTriangle,
  Droplets,
  Mountain,
  FileText,
  ImagePlus,
  X,
  Save,
  Send,
  Check,
  Target,
  Eye,
} from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";

import { useFieldAssessment } from "@/hooks/useFieldAssessment";
import { api } from "@/constants/url_fixed";

const API_BASE = `${api}/api`;

const LANDSLIDE_OPTIONS = [
  "tension_cracks",
  "bent_trees",
  "soil_slump",
  "exposed_bedrock",
  "other",
];

const EROSION_TYPES = ["sheet", "rill", "gully", "bank_collapse", "other"];

export default function SafetyForm() {
  const params = useLocalSearchParams();
  const areaId = params.areaId as string;
  const assessmentId = params.assessmentId as string | undefined;
  const layerId = "safety";
  const router = useRouter();

  const { saving, handleSave, uploadImage, deleteImage, fetchAssessmentData } =
    useFieldAssessment(areaId, layerId, assessmentId);

  const [indicators, setIndicators] = useState<string[]>([]);
  const [landslideNotes, setLandslideNotes] = useState("");
  const [floodHeight, setFloodHeight] = useState("");
  const [floodDebris, setFloodDebris] = useState(false);
  const [floodNotes, setFloodNotes] = useState("");
  const [erosionType, setErosionType] = useState("none");
  const [erosionSeverity, setErosionSeverity] = useState("");
  const [erosionAreaPct, setErosionAreaPct] = useState("");
  const [erosionSigns, setErosionSigns] = useState("");
  const [inspectorComment, setInspectorComment] = useState("");
  const [hazardNotes, setHazardNotes] = useState("");

  const [locationLat, setLocationLat] = useState("");
  const [locationLng, setLocationLng] = useState("");
  const [locationAccuracy, setLocationAccuracy] = useState("");
  const [gettingLocation, setGettingLocation] = useState(false);

  const [images, setImages] = useState<any[]>([]);
  const [isViewMode, setIsViewMode] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!assessmentId);

  useEffect(() => {
    if (assessmentId) {
      const load = async () => {
        const data = await fetchAssessmentData();
        if (data) {
          populateForm(data.field_assessment_data || {});
          setImages(data.images || []);
          setIsViewMode(!!data.is_submitted);
        }
        setLoading(false);
      };
      load();
    } else {
      setLoading(false);
    }
  }, [assessmentId]);

  const populateForm = (data: any) => {
    setIndicators(Array.isArray(data.landslide_indicators_observed) ? data.landslide_indicators_observed : []);
    setLandslideNotes(data.landslide_notes || "");
    setFloodHeight(data.flood_water_line_cm?.toString() || "");
    setFloodDebris(data.flood_debris_line_visible || false);
    setFloodNotes(data.flood_notes || "");
    setErosionType(data.erosion_type || "none");
    setErosionSeverity(data.erosion_severity_description || "");
    setErosionAreaPct(data.erosion_area_estimate_pct?.toString() || "");
    setErosionSigns(data.erosion_signs || "");
    setInspectorComment(data.inspector_comment || "");
    setHazardNotes(data.hazard_proximity_notes || "");
    if (data.location) {
      setLocationLat(data.location.latitude?.toString() || "");
      setLocationLng(data.location.longitude?.toString() || "");
      setLocationAccuracy(data.location.gps_accuracy_meters?.toString() || "");
    }
  };

  const handleGetCurrentLocation = async () => {
    setGettingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Please enable location access.");
        return;
      }
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLocationLat(location.coords.latitude.toFixed(6));
      setLocationLng(location.coords.longitude.toFixed(6));
      setLocationAccuracy(location.coords.accuracy?.toFixed(1) || "");
      Alert.alert("Location Captured", "GPS coordinates updated.");
    } catch (error) {
      Alert.alert("Error", "Could not get current location.");
    } finally {
      setGettingLocation(false);
    }
  };

  const toggleIndicator = (item: string) => {
    if (item === "other") {
      setIndicators(["other"]);
    } else {
      const filtered = indicators.filter((i) => i !== "other");
      if (filtered.includes(item)) {
        setIndicators(filtered.filter((i) => i !== item));
      } else {
        setIndicators([...filtered, item]);
      }
    }
  };

  const buildPayload = () => {
    const location =
      locationLat && locationLng
        ? {
            latitude: parseFloat(locationLat),
            longitude: parseFloat(locationLng),
            gps_accuracy_meters: locationAccuracy
              ? parseFloat(locationAccuracy)
              : undefined,
          }
        : null;

    return {
      layer: "safety",
      landslide_indicators_observed: indicators,
      landslide_notes: landslideNotes || null,
      flood_water_line_cm: floodHeight ? parseFloat(floodHeight) : null,
      flood_debris_line_visible: floodDebris,
      flood_notes: floodNotes || null,
      erosion_type: erosionType,
      erosion_severity_description: erosionSeverity || null,
      erosion_area_estimate_pct: erosionAreaPct ? parseFloat(erosionAreaPct) : null,
      erosion_signs: erosionSigns || null,
      inspector_comment: inspectorComment || null,
      hazard_proximity_notes: hazardNotes || null,
      location,
    };
  };

  const handleDraft = async () => {
    const payload = buildPayload();
    const success = await handleSave(payload, false);
    if (success) {
      if (assessmentId) {
        const data = await fetchAssessmentData();
        if (data) {
          populateForm(data.field_assessment_data || {});
          setImages(data.images || []);
        }
      }
      Alert.alert("Saved", "Draft saved successfully. You can continue editing.");
    }
  };

  const handleSubmit = async () => {
    Alert.alert(
      "Submit Assessment",
      "Are you sure? You cannot edit this after submission.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Submit",
          onPress: async () => {
            const payload = buildPayload();
            const success = await handleSave(payload, true);
            if (success) {
              setIsViewMode(true);
              Alert.alert("Success", "Assessment submitted to GIS Specialist!");
            }
          },
        },
      ]
    );
  };

  const handlePickImage = async () => {
    if (!assessmentId) {
      Alert.alert(
        "Action Required",
        "Please save the draft first to get an ID for image uploads."
      );
      return;
    }
    const success = await uploadImage(assessmentId);
    if (success) {
      const data = await fetchAssessmentData();
      if (data) setImages(data.images || []);
    }
  };

  const handleDeleteImage = async (img: any) => {
    Alert.alert("Delete Photo", "Remove this photo?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteImage(img.image_id);
          const data = await fetchAssessmentData();
          if (data) setImages(data.images || []);
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centerContent}>
        <View style={styles.loadingCard}>
          <ActivityIndicator size="large" color="#0F4A2F" />
          <Text style={styles.loadingText}>Loading Safety Assessment...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* View Mode Banner */}
        {isViewMode && (
          <View style={styles.viewModeBanner}>
            <Eye size={16} color="#fff" />
            <Text style={styles.viewModeBannerText}>Submitted — Read Only</Text>
          </View>
        )}

        {/* SECTION 1: Landslide Indicators */}
        <SectionCard
          title="Landslide Indicators"
          subtitle="Select all observed signs"
          icon={<Mountain size={18} color="#fff" />}
          accentColor="#854D0E"
          step={1}
        >
          <View style={styles.chipContainer}>
            {LANDSLIDE_OPTIONS.map((opt) => {
              const active = indicators.includes(opt);
              return (
                <TouchableOpacity
                  key={opt}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => !isViewMode && toggleIndicator(opt)}
                  disabled={isViewMode}
                  activeOpacity={0.7}
                >
                  {active && <Check size={12} color="#fff" style={{ marginRight: 4 }} />}
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {opt.replace(/_/g, " ")}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <FieldLabel label={indicators.includes("other") ? "Describe other indicator" : "Additional Notes"} optional />
          <TextInput
            style={[styles.textArea, isViewMode && styles.disabledInput]}
            multiline
            value={landslideNotes}
            onChangeText={setLandslideNotes}
            placeholder={indicators.includes("other") ? "Describe other indicator observed..." : "Additional notes on landslide indicators..."}
            editable={!isViewMode}
            placeholderTextColor="#94A3B8"
          />
        </SectionCard>

        {/* SECTION 2: Flood Evidence */}
        <SectionCard
          title="Flood Evidence"
          subtitle="Record flood signs & debris"
          icon={<Droplets size={18} color="#fff" />}
          accentColor="#1D4ED8"
          step={2}
        >
          <FieldLabel label="Water Line Height (cm above ground)" optional />
          <TextInput
            style={[styles.input, isViewMode && styles.disabledInput]}
            keyboardType="numeric"
            value={floodHeight}
            onChangeText={setFloodHeight}
            placeholder="e.g., 80"
            editable={!isViewMode}
            placeholderTextColor="#94A3B8"
          />

          <View style={styles.switchRow}>
            <View style={styles.switchLabelGroup}>
              <Text style={styles.switchLabel}>Debris Line Visible in Trees?</Text>
              <Text style={styles.switchSub}>High-water mark on vegetation</Text>
            </View>
            <Switch
              value={floodDebris}
              onValueChange={(val) => !isViewMode && setFloodDebris(val)}
              disabled={isViewMode}
              trackColor={{ false: "#E2E8F0", true: "#0F4A2F" }}
              thumbColor={floodDebris ? "#fff" : "#94A3B8"}
            />
          </View>

          <FieldLabel label="Flood Notes" optional />
          <TextInput
            style={[styles.textArea, isViewMode && styles.disabledInput]}
            multiline
            value={floodNotes}
            onChangeText={setFloodNotes}
            placeholder="e.g., Debris caught 1m up on bamboo..."
            editable={!isViewMode}
            placeholderTextColor="#94A3B8"
          />
        </SectionCard>

        {/* SECTION 3: Erosion Assessment */}
        <SectionCard
          title="Erosion Assessment"
          subtitle="Classify erosion type & severity"
          icon={<AlertTriangle size={18} color="#fff" />}
          accentColor="#B91C1C"
          step={3}
        >
          <FieldLabel label="Erosion Type" />
          <View style={styles.chipContainer}>
            {EROSION_TYPES.map((type) => {
              const active = erosionType === type;
              return (
                <TouchableOpacity
                  key={type}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => !isViewMode && setErosionType(type)}
                  disabled={isViewMode}
                  activeOpacity={0.7}
                >
                  {active && <Check size={12} color="#fff" style={{ marginRight: 4 }} />}
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {type.replace(/_/g, " ")}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {erosionType === "other" && (
            <>
              <FieldLabel label="Describe Erosion Type" />
              <TextInput
                style={[styles.textArea, isViewMode && styles.disabledInput]}
                multiline
                value={erosionSeverity}
                onChangeText={setErosionSeverity}
                placeholder="Describe erosion type observed..."
                editable={!isViewMode}
                placeholderTextColor="#94A3B8"
              />
            </>
          )}

          <FieldLabel label="Area Affected (%)" optional />
          <TextInput
            style={[styles.input, isViewMode && styles.disabledInput]}
            keyboardType="numeric"
            value={erosionAreaPct}
            onChangeText={setErosionAreaPct}
            placeholder="0 – 100"
            editable={!isViewMode}
            placeholderTextColor="#94A3B8"
          />

          <FieldLabel label="Severity / Signs" optional />
          <TextInput
            style={[styles.textArea, isViewMode && styles.disabledInput]}
            multiline
            value={erosionSigns}
            onChangeText={setErosionSigns}
            placeholder="e.g., Shallow rills, 2–5 cm deep..."
            editable={!isViewMode}
            placeholderTextColor="#94A3B8"
          />
        </SectionCard>

        {/* SECTION 4: Assessment Location */}
        <SectionCard
          title="Assessment Location"
          subtitle="GPS or manual coordinates"
          icon={<MapPin size={18} color="#fff" />}
          accentColor="#0F4A2F"
          step={4}
        >
          <View style={styles.coordRow}>
            <View style={styles.coordField}>
              <FieldLabel label="Latitude" optional />
              <TextInput
                style={[styles.input, isViewMode && styles.disabledInput]}
                keyboardType="decimal-pad"
                value={locationLat}
                onChangeText={setLocationLat}
                placeholder="e.g., 11.0"
                editable={!isViewMode}
                placeholderTextColor="#94A3B8"
              />
            </View>
            <View style={styles.coordDivider} />
            <View style={styles.coordField}>
              <FieldLabel label="Longitude" optional />
              <TextInput
                style={[styles.input, isViewMode && styles.disabledInput]}
                keyboardType="decimal-pad"
                value={locationLng}
                onChangeText={setLocationLng}
                placeholder="e.g., 124.6"
                editable={!isViewMode}
                placeholderTextColor="#94A3B8"
              />
            </View>
          </View>

          <FieldLabel label="GPS Accuracy (meters)" optional />
          <TextInput
            style={[styles.input, isViewMode && styles.disabledInput]}
            keyboardType="numeric"
            value={locationAccuracy}
            onChangeText={setLocationAccuracy}
            placeholder="Optional"
            editable={!isViewMode}
            placeholderTextColor="#94A3B8"
          />

          {!isViewMode && (
            <TouchableOpacity
              style={[styles.gpsBtn, gettingLocation && styles.gpsBtnLoading]}
              onPress={handleGetCurrentLocation}
              disabled={gettingLocation}
              activeOpacity={0.8}
            >
              {gettingLocation ? (
                <>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.gpsBtnText}>Acquiring GPS...</Text>
                </>
              ) : (
                <>
                  <Target size={16} color="#fff" />
                  <Text style={styles.gpsBtnText}>Use Current Location</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {locationLat !== "" && locationLng !== "" && (
            <View style={styles.coordPreview}>
              <MapPin size={13} color="#0F4A2F" />
              <Text style={styles.coordPreviewText}>
                {locationLat}, {locationLng}
                {locationAccuracy ? `  ±${locationAccuracy}m` : ""}
              </Text>
            </View>
          )}

          <Text style={styles.hint}>
            Leave blank if assessed remotely — a GIS Specialist can assign coordinates later.
          </Text>
        </SectionCard>

        {/* SECTION 5: General Notes & Hazards */}
        <SectionCard
          title="Notes & Hazard Proximity"
          subtitle="Inspector remarks and nearby risks"
          icon={<FileText size={18} color="#fff" />}
          accentColor="#6D28D9"
          step={5}
        >
          <FieldLabel label="Inspector Comment" optional />
          <TextInput
            style={[styles.textArea, isViewMode && styles.disabledInput]}
            multiline
            value={inspectorComment}
            onChangeText={setInspectorComment}
            placeholder="General observations on stability..."
            editable={!isViewMode}
            placeholderTextColor="#94A3B8"
          />

          <FieldLabel label="Proximity to Known Hazards" optional />
          <TextInput
            style={[styles.textArea, isViewMode && styles.disabledInput]}
            multiline
            value={hazardNotes}
            onChangeText={setHazardNotes}
            placeholder="e.g., Active fault 850m NE..."
            editable={!isViewMode}
            placeholderTextColor="#94A3B8"
          />
        </SectionCard>

        {/* SECTION 6: Photo Gallery */}
        <SectionCard
          title={`Photo Evidence`}
          subtitle={`${images.length} photo${images.length !== 1 ? "s" : ""} attached`}
          icon={<ImagePlus size={18} color="#fff" />}
          accentColor="#0369A1"
          step={6}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.galleryContent}
          >
            {images.map((img) => (
              <View key={img.image_id} style={styles.thumbWrapper}>
                <TouchableOpacity
                  onPress={() => setPreviewImage(api + img.url)}
                  activeOpacity={0.85}
                >
                  <Image
                    source={{ uri: api + img.url }}
                    style={styles.thumb}
                    resizeMode="cover"
                  />
                  <View style={styles.thumbOverlay}>
                    <Eye size={14} color="#fff" />
                  </View>
                </TouchableOpacity>
                {!isViewMode && (
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDeleteImage(img)}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <X size={11} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>
            ))}

            {!isViewMode && (
              <TouchableOpacity
                style={styles.addPhotoBtn}
                onPress={handlePickImage}
                activeOpacity={0.7}
              >
                <ImagePlus size={26} color="#0369A1" />
                <Text style={styles.addPhotoText}>Add Photo</Text>
              </TouchableOpacity>
            )}
          </ScrollView>

          {images.length === 0 && isViewMode && (
            <Text style={styles.emptyGallery}>No photos attached to this assessment.</Text>
          )}
        </SectionCard>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Fixed Footer Actions */}
      {!isViewMode && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.btn, styles.btnDraft]}
            onPress={handleDraft}
            disabled={saving}
            activeOpacity={0.85}
          >
            <Save size={16} color="#fff" />
            <Text style={styles.btnText}>Save Draft</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.btnSubmit, saving && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Send size={16} color="#fff" />
                <Text style={styles.btnText}>Submit</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Full Screen Image Preview */}
      <Modal visible={!!previewImage} transparent animationType="fade">
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.closeModal}
            onPress={() => setPreviewImage(null)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <View style={styles.closeModalInner}>
              <X size={20} color="#fff" />
            </View>
          </TouchableOpacity>
          <Image
            source={{ uri: previewImage ?? undefined }}
            style={styles.fullImage}
            resizeMode="contain"
          />
        </View>
      </Modal>
    </View>
  );
}

// ─────────────────────────────────────────────
// Sub-Components
// ─────────────────────────────────────────────

const SectionCard = ({
  title,
  subtitle,
  icon,
  accentColor,
  step,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  accentColor: string;
  step: number;
  children: React.ReactNode;
}) => (
  <View style={styles.card}>
    <View style={[styles.cardAccent, { backgroundColor: accentColor }]} />
    <View style={styles.cardInner}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconBadge, { backgroundColor: accentColor }]}>
          {icon}
        </View>
        <View style={styles.cardTitleGroup}>
          <Text style={styles.cardTitle}>{title}</Text>
          {subtitle && <Text style={styles.cardSubtitle}>{subtitle}</Text>}
        </View>
        <View style={[styles.stepBadge, { borderColor: accentColor }]}>
          <Text style={[styles.stepText, { color: accentColor }]}>{step}</Text>
        </View>
      </View>
      <View style={styles.cardBody}>{children}</View>
    </View>
  </View>
);

const FieldLabel = ({ label, optional }: { label: string; optional?: boolean }) => (
  <View style={styles.fieldLabelRow}>
    <Text style={styles.label}>{label}</Text>
    {optional && <Text style={styles.optionalTag}>optional</Text>}
  </View>
);

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F1F5F9" },
  centerContent: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F1F5F9" },
  scrollContent: { padding: 16, paddingTop: 12 },

  loadingCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  loadingText: { fontSize: 14, color: "#475569", fontWeight: "500" },

  // View Mode Banner
  viewModeBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#1E40AF",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  viewModeBannerText: { color: "#fff", fontWeight: "600", fontSize: 13 },

  // Card
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    marginBottom: 16,
    flexDirection: "row",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    overflow: "hidden",
  },
  cardAccent: {
    width: 4,
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
  },
  cardInner: { flex: 1, padding: 16 },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  cardTitleGroup: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#1E293B" },
  cardSubtitle: { fontSize: 11, color: "#94A3B8", marginTop: 1, fontWeight: "500" },
  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
  },
  stepText: { fontSize: 11, fontWeight: "700" },
  cardBody: { gap: 10 },

  // Field label
  fieldLabelRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
  label: { fontSize: 12, fontWeight: "600", color: "#64748B" },
  optionalTag: {
    fontSize: 10,
    color: "#94A3B8",
    fontWeight: "500",
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },

  // Inputs
  input: {
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#1E293B",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  textArea: {
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#1E293B",
    minHeight: 88,
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  disabledInput: {
    backgroundColor: "#F1F5F9",
    color: "#64748B",
    borderColor: "#E2E8F0",
  },

  // Switch row
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  switchLabelGroup: { flex: 1, marginRight: 12 },
  switchLabel: { fontSize: 13, fontWeight: "600", color: "#334155" },
  switchSub: { fontSize: 11, color: "#94A3B8", marginTop: 2 },

  // Chips
  chipContainer: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    backgroundColor: "#fff",
  },
  chipActive: { backgroundColor: "#0F4A2F", borderColor: "#0F4A2F" },
  chipText: { fontSize: 12, color: "#475569", fontWeight: "600" },
  chipTextActive: { color: "#fff" },

  // Coordinate layout
  coordRow: { flexDirection: "row", gap: 0 },
  coordField: { flex: 1 },
  coordDivider: { width: 10 },
  coordPreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F0FDF4",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  coordPreviewText: { fontSize: 12, color: "#166534", fontWeight: "600" },

  // GPS Button
  gpsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0F4A2F",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 8,
    marginTop: 4,
  },
  gpsBtnLoading: { backgroundColor: "#166534", opacity: 0.8 },
  gpsBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },

  hint: {
    fontSize: 11,
    color: "#94A3B8",
    fontStyle: "italic",
    lineHeight: 16,
  },

  // Gallery
  galleryContent: { paddingVertical: 4, gap: 10 },
  thumbWrapper: { position: "relative" },
  thumb: {
    width: 90,
    height: 90,
    borderRadius: 10,
    backgroundColor: "#E2E8F0",
  },
  thumbOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 28,
    backgroundColor: "rgba(0,0,0,0.35)",
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  deleteBtn: {
    position: "absolute",
    top: -5,
    right: -5,
    backgroundColor: "#EF4444",
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  addPhotoBtn: {
    width: 90,
    height: 90,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#BAE6FD",
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F0F9FF",
    gap: 4,
  },
  addPhotoText: { color: "#0369A1", fontSize: 10, fontWeight: "600" },
  emptyGallery: { fontSize: 13, color: "#94A3B8", textAlign: "center", paddingVertical: 12 },

  // Footer
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === "ios" ? 28 : 12,
    borderTopWidth: 1,
    borderColor: "#E2E8F0",
    flexDirection: "row",
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
  },
  btn: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  btnDraft: { backgroundColor: "#475569" },
  btnSubmit: { backgroundColor: "#0F4A2F" },
  btnDisabled: { opacity: 0.65 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    justifyContent: "center",
    alignItems: "center",
  },
  closeModal: { position: "absolute", top: 48, right: 20, zIndex: 10 },
  closeModalInner: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 20,
    padding: 10,
  },
  fullImage: { width: "100%", height: "80%" },
});
