import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Image,
  ActivityIndicator,
  Modal,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Sprout,
  Droplets,
  Thermometer,
  FileText,
  ImagePlus,
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
const SOIL_TEXTURES = [
  "clay_loam",
  "sandy_loam",
  "loam",
  "clay",
  "sandy",
  "other",
];
const MOISTURE_LEVELS = [
  "dry",
  "slightly_moist",
  "moist_not_saturated",
  "waterlogged",
  "other",
];
const DRAINAGE_TYPES = [
  "well_drained",
  "moderately_drained",
  "poorly_drained",
  "other",
];
const STRESS_SYMPTOMS = ["none", "slight_leaf_curling", "wilting", "other"];
const TOPOGRAPHY = ["gentle_concave", "flat", "convex", "other"];
const INVASIVE_SPECIES = ["cogon", "hagonoy", "kakawate", "none", "other"];

export default function SurvivabilityForm() {
  const params = useLocalSearchParams();
  const areaId = params.areaId as string;
  const assessmentId = params.assessmentId as string | undefined;
  const layerId = "survivability";
  const router = useRouter();
 
  const { saving, handleSave, uploadImage, deleteImage, fetchAssessmentData } =
    useFieldAssessment(areaId, layerId, assessmentId);

  // ─────────────────────────────────────────────
  // State: Soil & Water Fields
  // ─────────────────────────────────────────────
  const [soilTexture, setSoilTexture] = useState("");
  const [soilTextureOther, setSoilTextureOther] = useState("");
  const [soilMoisture, setSoilMoisture] = useState("");
  const [soilMoistureOther, setSoilMoistureOther] = useState("");
  const [soilDepth, setSoilDepth] = useState("");
  const [soilDrainage, setSoilDrainage] = useState("");
  const [soilDrainageOther, setSoilDrainageOther] = useState("");
  const [soilNotes, setSoilNotes] = useState("");

  const [waterStress, setWaterStress] = useState("none");
  const [waterStressOther, setWaterStressOther] = useState("");
  const [daysSinceRain, setDaysSinceRain] = useState("");
  const [topography, setTopography] = useState("");
  const [topographyOther, setTopographyOther] = useState("");
  const [waterNotes, setWaterNotes] = useState("");

  // ─────────────────────────────────────────────
  // State: Competition & Invasives
  // ─────────────────────────────────────────────
  const [invasiveSpecies, setInvasiveSpecies] = useState("");
  const [invasiveSpeciesOther, setInvasiveSpeciesOther] = useState("");
  const [invasivePct, setInvasivePct] = useState("");
  const [seedlingsCount, setSeedlingsCount] = useState("");
  const [vegNotes, setVegNotes] = useState("");
  const [microclimateNotes, setMicroclimateNotes] = useState("");

  // ─────────────────────────────────────────────
  // State: Location Capture
  // ─────────────────────────────────────────────
  const [locationLat, setLocationLat] = useState("");
  const [locationLng, setLocationLng] = useState("");
  const [locationAccuracy, setLocationAccuracy] = useState("");
  const [gettingLocation, setGettingLocation] = useState(false);

  // ─────────────────────────────────────────────
  // State: UI
  // ─────────────────────────────────────────────
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
    // ✅ Soil fields - handle "other" logic: if value not in predefined list, it's custom
    if (SOIL_TEXTURES.slice(0, -1).includes(data.soil_texture)) {
      setSoilTexture(data.soil_texture);
      setSoilTextureOther("");
    } else {
      setSoilTexture("other");
      setSoilTextureOther(data.soil_texture || "");
    }

    if (MOISTURE_LEVELS.slice(0, -1).includes(data.soil_moisture_feel)) {
      setSoilMoisture(data.soil_moisture_feel);
      setSoilMoistureOther("");
    } else {
      setSoilMoisture("other");
      setSoilMoistureOther(data.soil_moisture_feel || "");
    }

    setSoilDepth(data.soil_depth_cm?.toString() || "");

    if (DRAINAGE_TYPES.slice(0, -1).includes(data.soil_drainage_observed)) {
      setSoilDrainage(data.soil_drainage_observed);
      setSoilDrainageOther("");
    } else {
      setSoilDrainage("other");
      setSoilDrainageOther(data.soil_drainage_observed || "");
    }

    setSoilNotes(data.soil_notes || "");

    // ✅ Water fields
    if (STRESS_SYMPTOMS.slice(0, -1).includes(data.water_stress_symptoms)) {
      setWaterStress(data.water_stress_symptoms);
      setWaterStressOther("");
    } else {
      setWaterStress("other");
      setWaterStressOther(data.water_stress_symptoms || "");
    }

    setDaysSinceRain(data.days_since_last_rainfall?.toString() || "");

    if (TOPOGRAPHY.slice(0, -1).includes(data.micro_topography)) {
      setTopography(data.micro_topography);
      setTopographyOther("");
    } else {
      setTopography("other");
      setTopographyOther(data.micro_topography || "");
    }

    setWaterNotes(data.water_availability_notes || "");

    // ✅ Invasives - backend stores as STRING, not array (per PLANTSCOPE v5.0 doc)
    if (INVASIVE_SPECIES.slice(0, -1).includes(data.invasive_species_present)) {
      setInvasiveSpecies(data.invasive_species_present);
      setInvasiveSpeciesOther("");
    } else {
      setInvasiveSpecies("other");
      setInvasiveSpeciesOther(data.invasive_species_present || "");
    }

    setInvasivePct(data.invasive_cover_estimate_pct?.toString() || "");
    setSeedlingsCount(
      data.natural_regeneration_seedlings_count?.toString() || "",
    );
    setVegNotes(data.vegetation_notes || "");
    setMicroclimateNotes(data.microclimate_notes || "");

    // ✅ Location
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

  // ─────────────────────────────────────────────
  // Handlers: Form Logic
  // ─────────────────────────────────────────────
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

    // ✅ Helper: Return "other" text if selected, otherwise predefined option
    const getValue = (
      selected: string,
      otherText: string,
      options: string[],
    ) => {
      if (selected === "other") return otherText || null;
      return options.slice(0, -1).includes(selected) ? selected : null;
    };

    return {
      layer: "survivability",
      // Soil fields
      soil_texture: getValue(soilTexture, soilTextureOther, SOIL_TEXTURES),
      soil_moisture_feel: getValue(
        soilMoisture,
        soilMoistureOther,
        MOISTURE_LEVELS,
      ),
      soil_depth_cm: soilDepth ? parseFloat(soilDepth) : null,
      soil_drainage_observed: getValue(
        soilDrainage,
        soilDrainageOther,
        DRAINAGE_TYPES,
      ),
      soil_notes: soilNotes || null,

      // Water fields
      water_stress_symptoms: getValue(
        waterStress,
        waterStressOther,
        STRESS_SYMPTOMS,
      ),
      days_since_last_rainfall: daysSinceRain
        ? parseFloat(daysSinceRain)
        : null,
      micro_topography: getValue(topography, topographyOther, TOPOGRAPHY),
      water_availability_notes: waterNotes || null,

      // Invasives & competition - ✅ Backend expects STRING, not array
      invasive_species_present: getValue(
        invasiveSpecies,
        invasiveSpeciesOther,
        INVASIVE_SPECIES,
      ),
      invasive_cover_estimate_pct: invasivePct ? parseFloat(invasivePct) : null,
      natural_regeneration_seedlings_count: seedlingsCount
        ? parseInt(seedlingsCount, 10)
        : null,
      vegetation_notes: vegNotes || null,
      microclimate_notes: microclimateNotes || null,

      location,
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
      Alert.alert(
        "Saved",
        "Draft saved successfully. You can continue editing.",
      );
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
      ],
    );
  };

  const handlePickImage = async () => {
    if (!assessmentId) {
      Alert.alert(
        "Action Required",
        "Please save the draft first to get an ID for image uploads.",
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
        <Text style={{ marginTop: 10 }}>
          Loading Survivability Assessment...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* SECTION 1: Soil Assessment */}
        <SectionCard
          title="Soil Assessment"
          icon={<Thermometer size={20} color="#0F4A2F" />}
        >
          <Text style={styles.label}>Soil Texture</Text>
          <View style={styles.chipContainer}>
            {SOIL_TEXTURES.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[styles.chip, soilTexture === opt && styles.chipActive]}
                onPress={() => !isViewMode && setSoilTexture(opt)}
                disabled={isViewMode}
              >
                {soilTexture === opt && (
                  <Check size={14} color="#fff" style={{ marginRight: 4 }} />
                )}
                <Text
                  style={[
                    styles.chipText,
                    soilTexture === opt && styles.chipTextActive,
                  ]}
                >
                  {opt.replace(/_/g, " ")}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {soilTexture === "other" && (
            <TextInput
              style={styles.textArea}
              multiline
              value={soilTextureOther}
              onChangeText={setSoilTextureOther}
              placeholder="Describe soil texture observed..."
              editable={!isViewMode}
            />
          )}

          <Text style={styles.label}>Moisture Feel</Text>
          <View style={styles.chipContainer}>
            {MOISTURE_LEVELS.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[styles.chip, soilMoisture === opt && styles.chipActive]}
                onPress={() => !isViewMode && setSoilMoisture(opt)}
                disabled={isViewMode}
              >
                {soilMoisture === opt && (
                  <Check size={14} color="#fff" style={{ marginRight: 4 }} />
                )}
                <Text
                  style={[
                    styles.chipText,
                    soilMoisture === opt && styles.chipTextActive,
                  ]}
                >
                  {opt.replace(/_/g, " ")}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {soilMoisture === "other" && (
            <TextInput
              style={styles.textArea}
              multiline
              value={soilMoistureOther}
              onChangeText={setSoilMoistureOther}
              placeholder="Describe moisture condition..."
              editable={!isViewMode}
            />
          )}

          <View style={styles.rowHalf}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.label}>Depth (cm)</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={soilDepth}
                onChangeText={setSoilDepth}
                placeholder="e.g., 75"
                editable={!isViewMode}
              />
            </View>
          </View>

          <Text style={styles.label}>Drainage Observation</Text>
          <View style={styles.chipContainer}>
            {DRAINAGE_TYPES.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[styles.chip, soilDrainage === opt && styles.chipActive]}
                onPress={() => !isViewMode && setSoilDrainage(opt)}
                disabled={isViewMode}
              >
                {soilDrainage === opt && (
                  <Check size={14} color="#fff" style={{ marginRight: 4 }} />
                )}
                <Text
                  style={[
                    styles.chipText,
                    soilDrainage === opt && styles.chipTextActive,
                  ]}
                >
                  {opt.replace(/_/g, " ")}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {soilDrainage === "other" && (
            <TextInput
              style={styles.textArea}
              multiline
              value={soilDrainageOther}
              onChangeText={setSoilDrainageOther}
              placeholder="Describe drainage condition..."
              editable={!isViewMode}
            />
          )}

          <Text style={styles.label}>Soil Notes</Text>
          <TextInput
            style={styles.textArea}
            multiline
            value={soilNotes}
            onChangeText={setSoilNotes}
            placeholder="Color, organic matter, rock content, pH estimate..."
            editable={!isViewMode}
          />
        </SectionCard>

        {/* SECTION 2: Water & Micro-topography */}
        <SectionCard
          title="Water & Micro-topography"
          icon={<Droplets size={20} color="#0F4A2F" />}
        >
          <Text style={styles.label}>Water Stress Symptoms</Text>
          <View style={styles.chipContainer}>
            {STRESS_SYMPTOMS.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[styles.chip, waterStress === opt && styles.chipActive]}
                onPress={() => !isViewMode && setWaterStress(opt)}
                disabled={isViewMode}
              >
                {waterStress === opt && (
                  <Check size={14} color="#fff" style={{ marginRight: 4 }} />
                )}
                <Text
                  style={[
                    styles.chipText,
                    waterStress === opt && styles.chipTextActive,
                  ]}
                >
                  {opt.replace(/_/g, " ")}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {waterStress === "other" && (
            <TextInput
              style={styles.textArea}
              multiline
              value={waterStressOther}
              onChangeText={setWaterStressOther}
              placeholder="Describe water stress symptoms..."
              editable={!isViewMode}
            />
          )}

          <Text style={styles.label}>Days Since Last Rainfall</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={daysSinceRain}
            onChangeText={setDaysSinceRain}
            placeholder="e.g., 3"
            editable={!isViewMode}
          />

          <Text style={styles.label}>Micro-topography</Text>
          <View style={styles.chipContainer}>
            {TOPOGRAPHY.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[styles.chip, topography === opt && styles.chipActive]}
                onPress={() => !isViewMode && setTopography(opt)}
                disabled={isViewMode}
              >
                {topography === opt && (
                  <Check size={14} color="#fff" style={{ marginRight: 4 }} />
                )}
                <Text
                  style={[
                    styles.chipText,
                    topography === opt && styles.chipTextActive,
                  ]}
                >
                  {opt.replace(/_/g, " ")}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {topography === "other" && (
            <TextInput
              style={styles.textArea}
              multiline
              value={topographyOther}
              onChangeText={setTopographyOther}
              placeholder="Describe micro-topography..."
              editable={!isViewMode}
            />
          )}

          <Text style={styles.label}>Water Availability Notes</Text>
          <TextInput
            style={styles.textArea}
            multiline
            value={waterNotes}
            onChangeText={setWaterNotes}
            placeholder="Proximity to water, irrigation potential, seasonal patterns..."
            editable={!isViewMode}
          />
        </SectionCard>

        {/* SECTION 3: Competition & Invasives */}
        <SectionCard
          title="Competition & Invasives"
          icon={<Sprout size={20} color="#0F4A2F" />}
        >
          <Text style={styles.label}>Invasive Species Present</Text>
          <View style={styles.chipContainer}>
            {INVASIVE_SPECIES.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[
                  styles.chip,
                  invasiveSpecies === opt && styles.chipActive,
                ]}
                onPress={() => !isViewMode && setInvasiveSpecies(opt)}
                disabled={isViewMode}
              >
                {invasiveSpecies === opt && (
                  <Check size={14} color="#fff" style={{ marginRight: 4 }} />
                )}
                <Text
                  style={[
                    styles.chipText,
                    invasiveSpecies === opt && styles.chipTextActive,
                  ]}
                >
                  {opt.replace(/_/g, " ")}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {invasiveSpecies === "other" && (
            <TextInput
              style={styles.textArea}
              multiline
              value={invasiveSpeciesOther}
              onChangeText={setInvasiveSpeciesOther}
              placeholder="Describe invasive species observed..."
              editable={!isViewMode}
            />
          )}

          <View style={styles.rowHalf}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.label}>Invasive Cover (%)</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={invasivePct}
                onChangeText={setInvasivePct}
                placeholder="0-100"
                editable={!isViewMode}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Native Seedlings Count</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={seedlingsCount}
                onChangeText={setSeedlingsCount}
                placeholder="per 100m²"
                editable={!isViewMode}
              />
            </View>
          </View>

          <Text style={styles.label}>Vegetation Notes</Text>
          <TextInput
            style={styles.textArea}
            multiline
            value={vegNotes}
            onChangeText={setVegNotes}
            placeholder="Native species, grass height, clearing requirements..."
            editable={!isViewMode}
          />

          <Text style={styles.label}>Microclimate Notes</Text>
          <TextInput
            style={styles.textArea}
            multiline
            value={microclimateNotes}
            onChangeText={setMicroclimateNotes}
            placeholder="Shade, wind exposure, temperature..."
            editable={!isViewMode}
          />
        </SectionCard>

        {/* SECTION 4: Assessment Location (Optional) */}
        <SectionCard
          title="Assessment Location"
          icon={<Target size={20} color="#0F4A2F" />}
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

        {/* SECTION 5: Photo Gallery */}
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
