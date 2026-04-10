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
  Trash2,
  X,
  Save,
  Send,
  Check,
  Target,
} from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";

import { useFieldAssessment } from "@/hooks/useFieldAssessment";
import { api } from "@/constants/url_fixed";

const API_BASE = `${api}/api`;

// ─────────────────────────────────────────────
// Constants & Options (Single-select for "Other")
// ─────────────────────────────────────────────
const LANDSLIDE_OPTIONS = [
  "tension_cracks",
  "bent_trees",
  "soil_slump",
  "exposed_bedrock",
  "other", // ✅ Single-select "other" option
];

const EROSION_TYPES = ["sheet", "rill", "gully", "bank_collapse", "other"]; // ✅ Single-select

export default function SafetyForm() {
  const params = useLocalSearchParams();
  const areaId = params.areaId as string;
  const assessmentId = params.assessmentId as string | undefined;
  const layerId = "safety";
  const router = useRouter();

  const { saving, handleSave, uploadImage, deleteImage, fetchAssessmentData } =
    useFieldAssessment(areaId, layerId, assessmentId);

  // ─────────────────────────────────────────────
  // State: Form Fields
  // ─────────────────────────────────────────────
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

  // ✅ NEW: Location State
  const [locationLat, setLocationLat] = useState("");
  const [locationLng, setLocationLng] = useState("");
  const [locationAccuracy, setLocationAccuracy] = useState("");
  const [gettingLocation, setGettingLocation] = useState(false);

  // State: UI
  const [images, setImages] = useState<any[]>([]);
  const [isViewMode, setIsViewMode] = useState(false); // ✅ Only true after SUBMIT, not after save draft
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!assessmentId);

  // ─────────────────────────────────────────────
  // Effect: Load Data if Editing
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (assessmentId) {
      const load = async () => {
        const data = await fetchAssessmentData();
        if (data) {
          populateForm(data.field_assessment_data || {});
          setImages(data.images || []);
          // ✅ Only lock if truly submitted (not just saved as draft)
          setIsViewMode(!!data.is_submitted);
        }
        setLoading(false);
      };
      load();
    } else {
      setLoading(false);
    }
  }, [assessmentId]);

  // Helper: Populate State from JSON
  const populateForm = (data: any) => {
    // ✅ Handle array field correctly
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

    // ✅ Load location if present
    if (data.location) {
      setLocationLat(data.location.latitude?.toString() || "");
      setLocationLng(data.location.longitude?.toString() || "");
      setLocationAccuracy(data.location.gps_accuracy_meters?.toString() || "");
    }
  };

  // ─────────────────────────────────────────────
  // Handlers: Location
  // ─────────────────────────────────────────────
  const handleGetCurrentLocation = async () => {
    setGettingLocation(true);
    try {
      // Request permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Please enable location access.");
        return;
      }

      // Get current position
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

  // ─────────────────────────────────────────────
  // Handlers: Form Logic
  // ─────────────────────────────────────────────
  const toggleIndicator = (item: string) => {
    // ✅ Single-select logic: if "other" is selected, clear others; if specific is selected, clear "other"
    if (item === "other") {
      setIndicators(["other"]);
    } else {
      // Remove "other" if selecting a specific option
      const filtered = indicators.filter((i) => i !== "other");
      if (filtered.includes(item)) {
        setIndicators(filtered.filter((i) => i !== item));
      } else {
        setIndicators([...filtered, item]);
      }
    }
  };

  const buildPayload = () => {
    // Build location object only if lat/lng are provided
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
      erosion_area_estimate_pct: erosionAreaPct
        ? parseFloat(erosionAreaPct)
        : null,
      erosion_signs: erosionSigns || null,
      inspector_comment: inspectorComment || null,
      hazard_proximity_notes: hazardNotes || null,
      location, // ✅ Include location in payload
    };
  };

  const handleDraft = async () => {
    const payload = buildPayload();
    const success = await handleSave(payload, false);
    if (success) {
      // ✅ Re-fetch to get updated data (including new assessmentId if just created)
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
              // ✅ Lock form after successful submit
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
      // ✅ Re-fetch to update gallery
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
          // ✅ Re-fetch to update gallery
          const data = await fetchAssessmentData();
          if (data) setImages(data.images || []);
        },
      },
    ]);
  };

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.centerContent}>
        <ActivityIndicator size="large" color="#0F4A2F" />
        <Text style={{ marginTop: 10 }}>Loading Safety Assessment...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* SECTION 1: Landslide Indicators */}
        <SectionCard
          title="Landslide Indicators"
          icon={<Mountain size={20} color="#0F4A2F" />}
        >
          <Text style={styles.label}>Select observed indicators:</Text>
          <View style={styles.chipContainer}>
            {LANDSLIDE_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[
                  styles.chip,
                  indicators.includes(opt) && styles.chipActive,
                ]}
                onPress={() => !isViewMode && toggleIndicator(opt)}
                disabled={isViewMode}
              >
                {indicators.includes(opt) && (
                  <Check size={14} color="#fff" style={{ marginRight: 4 }} />
                )}
                <Text
                  style={[
                    styles.chipText,
                    indicators.includes(opt) && styles.chipTextActive,
                  ]}
                >
                  {opt.replace(/_/g, " ")}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {indicators.includes("other") && (
            <TextInput
              style={styles.textArea}
              multiline
              value={landslideNotes}
              onChangeText={setLandslideNotes}
              placeholder="Describe other indicator observed..."
              editable={!isViewMode}
            />
          )}
          {!indicators.includes("other") && (
            <TextInput
              style={styles.textArea}
              multiline
              value={landslideNotes}
              onChangeText={setLandslideNotes}
              placeholder="Additional notes on landslide indicators..."
              editable={!isViewMode}
            />
          )}
        </SectionCard>

        {/* SECTION 2: Flood Evidence */}
        <SectionCard
          title="Flood Evidence"
          icon={<Droplets size={20} color="#0F4A2F" />}
        >
          <Text style={styles.label}>Water line height (cm above ground)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={floodHeight}
            onChangeText={setFloodHeight}
            placeholder="e.g., 80"
            editable={!isViewMode}
          />

          <View style={styles.rowBetween}>
            <Text style={styles.label}>Debris line visible in trees?</Text>
            <Switch
              value={floodDebris}
              onValueChange={(val) => !isViewMode && setFloodDebris(val)}
              disabled={isViewMode}
              trackColor={{ false: "#cbd5e1", true: "#0F4A2F" }}
            />
          </View>

          <Text style={styles.label}>Flood Notes (Optional)</Text>
          <TextInput
            style={styles.textArea}
            multiline
            value={floodNotes}
            onChangeText={setFloodNotes}
            placeholder="e.g., Debris caught 1m up on bamboo..."
            editable={!isViewMode}
          />
        </SectionCard>

        {/* SECTION 3: Erosion Assessment */}
        <SectionCard
          title="Erosion Assessment"
          icon={<AlertTriangle size={20} color="#0F4A2F" />}
        >
          <Text style={styles.label}>Erosion Type</Text>
          <View style={styles.chipContainer}>
            {EROSION_TYPES.map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.chip, erosionType === type && styles.chipActive]}
                onPress={() => !isViewMode && setErosionType(type)}
                disabled={isViewMode}
              >
                <Text
                  style={[
                    styles.chipText,
                    erosionType === type && styles.chipTextActive,
                  ]}
                >
                  {type.replace(/_/g, " ")}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {erosionType === "other" && (
            <TextInput
              style={styles.textArea}
              multiline
              value={erosionSeverity}
              onChangeText={setErosionSeverity}
              placeholder="Describe erosion type observed..."
              editable={!isViewMode}
            />
          )}

          <View style={styles.rowHalf}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.label}>Area Affected (%)</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={erosionAreaPct}
                onChangeText={setErosionAreaPct}
                placeholder="0-100"
                editable={!isViewMode}
              />
            </View>
          </View>

          <Text style={styles.label}>Severity / Signs (Optional)</Text>
          <TextInput
            style={styles.textArea}
            multiline
            value={erosionSigns}
            onChangeText={setErosionSigns}
            placeholder="e.g., Shallow rills, 2-5cm deep..."
            editable={!isViewMode}
          />
        </SectionCard>

        {/* SECTION 4: Location Capture */}
        <SectionCard
          title="Assessment Location"
          icon={<MapPin size={20} color="#0F4A2F" />}
        >
          <Text style={styles.label}>
            Enter coordinates manually OR use GPS:
          </Text>
          <View style={styles.rowHalf}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.label}>Latitude</Text>
              <TextInput
                style={styles.input}
                keyboardType="decimal-pad"
                value={locationLat}
                onChangeText={setLocationLat}
                placeholder="e.g., 11.0"
                editable={!isViewMode}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Longitude</Text>
              <TextInput
                style={styles.input}
                keyboardType="decimal-pad"
                value={locationLng}
                onChangeText={setLocationLng}
                placeholder="e.g., 124.6"
                editable={!isViewMode}
              />
            </View>
          </View>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={locationAccuracy}
            onChangeText={setLocationAccuracy}
            placeholder="GPS accuracy in meters (optional)"
            editable={!isViewMode}
          />
          {!isViewMode && (
            <TouchableOpacity
              style={styles.gpsBtn}
              onPress={handleGetCurrentLocation}
              disabled={gettingLocation}
            >
              {gettingLocation ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Target size={16} color="#fff" />
                  <Text style={styles.gpsBtnText}>Get Current Location</Text>
                </>
              )}
            </TouchableOpacity>
          )}
          <Text style={styles.hint}>
            Optional: Leave blank if assessment was done during a meeting. GIS
            Specialist can assign coordinates later.
          </Text>
        </SectionCard>

        {/* SECTION 5: General Notes & Hazards */}
        <SectionCard
          title="General Notes & Hazards"
          icon={<FileText size={20} color="#0F4A2F" />}
        >
          <Text style={styles.label}>Inspector Comment</Text>
          <TextInput
            style={styles.textArea}
            multiline
            value={inspectorComment}
            onChangeText={setInspectorComment}
            placeholder="General observations on stability..."
            editable={!isViewMode}
          />
          <Text style={styles.label}>Proximity to Known Hazards</Text>
          <TextInput
            style={styles.textArea}
            multiline
            value={hazardNotes}
            onChangeText={setHazardNotes}
            placeholder="e.g., Active fault 850m NE..."
            editable={!isViewMode}
          />
        </SectionCard>

        {/* SECTION 6: Photo Gallery */}
        <SectionCard
          title={`Photos (${images.length})`}
          icon={<ImagePlus size={20} color="#0F4A2F" />}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.galleryScroll}
          >
            {images.map((img) => (
              <View key={img.image_id} style={styles.thumbWrapper}>
                <TouchableOpacity
                  onPress={() => setPreviewImage(api + img.url)}
                >
                  <Image
                    source={{ uri: api + img.url }}
                    style={styles.thumb}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
                {!isViewMode && (
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDeleteImage(img)}
                  >
                    <X size={14} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>
            ))}
            {!isViewMode && (
              <TouchableOpacity
                style={styles.addPhotoBtn}
                onPress={handlePickImage}
              >
                <ImagePlus size={24} color="#64748b" />
                <Text style={{ color: "#64748b", fontSize: 10 }}>
                  Add Photo
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </SectionCard>

        {/* Footer Spacer */}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Footer Actions (Fixed) */}
      {!isViewMode && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.btn, styles.btnDraft]}
            onPress={handleDraft}
            disabled={saving}
          >
            <Save size={16} color="#fff" />
            <Text style={styles.btnText}>Save Draft</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.btnSubmit]}
            onPress={handleSubmit}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Send size={16} color="#fff" />
                <Text style={styles.btnText}>Submit</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Full Screen Image Preview Modal */}
      <Modal visible={!!previewImage} transparent animationType="fade">
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.closeModal}
            onPress={() => setPreviewImage(null)}
          >
            <X size={32} color="#fff" />
          </TouchableOpacity>
          <Image
            source={{ uri: previewImage }}
            style={styles.fullImage}
            resizeMode="contain"
          />
        </View>
      </Modal>
    </View>
  );
}

// ─────────────────────────────────────────────
// Sub-Components & Styles
// ─────────────────────────────────────────────
const SectionCard = ({ title, icon, children }: any) => (
  <View style={styles.card}>
    <View style={styles.cardHeader}>
      <Text style={styles.cardTitle}>{title}</Text>
      {icon}
    </View>
    <View style={styles.cardBody}>{children}</View>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  centerContent: { flex: 1, justifyContent: "center", alignItems: "center" },
  scrollContent: { padding: 16 },

  // Cards
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#0F4A2F" },
  cardBody: { gap: 12 },

  // Inputs
  label: { fontSize: 13, fontWeight: "600", color: "#475569", marginBottom: 4 },
  input: {
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: "#334155",
    marginBottom: 8,
  },
  textArea: {
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: "#334155",
    minHeight: 80,
    textAlignVertical: "top",
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 4,
  },
  rowHalf: { flexDirection: "row", marginBottom: 8 },
  hint: { fontSize: 12, color: "#64748b", fontStyle: "italic", marginTop: 4 },

  // Chips
  chipContainer: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#fff",
  },
  chipActive: { backgroundColor: "#0F4A2F", borderColor: "#0F4A2F" },
  chipText: { fontSize: 12, color: "#475569", fontWeight: "500" },
  chipTextActive: { color: "#fff" },

  // GPS Button
  gpsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0F4A2F",
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
    gap: 6,
  },
  gpsBtnText: { color: "#fff", fontWeight: "600", fontSize: 13 },

  // Gallery
  galleryScroll: { paddingVertical: 4 },
  thumbWrapper: { position: "relative", marginRight: 12 },
  thumb: { width: 80, height: 80, borderRadius: 8, backgroundColor: "#E2E8F0" },
  deleteBtn: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: "#EF4444",
    borderRadius: 12,
    padding: 2,
  },
  addPhotoBtn: {
    width: 80,
    height: 80,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
  },

  // Footer
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    padding: 16,
    borderTopWidth: 1,
    borderColor: "#E2E8F0",
    flexDirection: "row",
    gap: 12,
  },
  btn: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    padding: 14,
    borderRadius: 8,
    gap: 8,
  },
  btnDraft: { backgroundColor: "#64748B" },
  btnSubmit: { backgroundColor: "#0F4A2F" },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  closeModal: { position: "absolute", top: 40, right: 20, zIndex: 10 },
  fullImage: { width: "100%", height: "80%" },
});