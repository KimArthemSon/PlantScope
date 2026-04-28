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
  ImagePlus,
  MapPin,
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

const SOIL_TEXTURES = ["clay_loam", "sandy_loam", "loam", "clay", "sandy", "other"];
const MOISTURE_LEVELS = ["dry", "slightly_moist", "moist_not_saturated", "waterlogged", "other"];
const DRAINAGE_TYPES = ["well_drained", "moderately_drained", "poorly_drained", "other"];
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

  // Soil & Water Fields
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

  // Competition & Invasives
  const [invasiveSpecies, setInvasiveSpecies] = useState("");
  const [invasiveSpeciesOther, setInvasiveSpeciesOther] = useState("");
  const [invasivePct, setInvasivePct] = useState("");
  const [seedlingsCount, setSeedlingsCount] = useState("");
  const [vegNotes, setVegNotes] = useState("");
  const [microclimateNotes, setMicroclimateNotes] = useState("");

  // Location
  const [locationLat, setLocationLat] = useState("");
  const [locationLng, setLocationLng] = useState("");
  const [locationAccuracy, setLocationAccuracy] = useState("");
  const [gettingLocation, setGettingLocation] = useState(false);

  // UI
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

    if (INVASIVE_SPECIES.slice(0, -1).includes(data.invasive_species_present)) {
      setInvasiveSpecies(data.invasive_species_present);
      setInvasiveSpeciesOther("");
    } else {
      setInvasiveSpecies("other");
      setInvasiveSpeciesOther(data.invasive_species_present || "");
    }

    setInvasivePct(data.invasive_cover_estimate_pct?.toString() || "");
    setSeedlingsCount(data.natural_regeneration_seedlings_count?.toString() || "");
    setVegNotes(data.vegetation_notes || "");
    setMicroclimateNotes(data.microclimate_notes || "");

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

  const buildPayload = () => {
    const location =
      locationLat && locationLng
        ? {
            latitude: parseFloat(locationLat),
            longitude: parseFloat(locationLng),
            gps_accuracy_meters: locationAccuracy ? parseFloat(locationAccuracy) : undefined,
          }
        : null;

    const getValue = (selected: string, otherText: string, options: string[]) => {
      if (selected === "other") return otherText || null;
      return options.slice(0, -1).includes(selected) ? selected : null;
    };

    return {
      layer: "survivability",
      soil_texture: getValue(soilTexture, soilTextureOther, SOIL_TEXTURES),
      soil_moisture_feel: getValue(soilMoisture, soilMoistureOther, MOISTURE_LEVELS),
      soil_depth_cm: soilDepth ? parseFloat(soilDepth) : null,
      soil_drainage_observed: getValue(soilDrainage, soilDrainageOther, DRAINAGE_TYPES),
      soil_notes: soilNotes || null,
      water_stress_symptoms: getValue(waterStress, waterStressOther, STRESS_SYMPTOMS),
      days_since_last_rainfall: daysSinceRain ? parseFloat(daysSinceRain) : null,
      micro_topography: getValue(topography, topographyOther, TOPOGRAPHY),
      water_availability_notes: waterNotes || null,
      invasive_species_present: getValue(invasiveSpecies, invasiveSpeciesOther, INVASIVE_SPECIES),
      invasive_cover_estimate_pct: invasivePct ? parseFloat(invasivePct) : null,
      natural_regeneration_seedlings_count: seedlingsCount ? parseInt(seedlingsCount, 10) : null,
      vegetation_notes: vegNotes || null,
      microclimate_notes: microclimateNotes || null,
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
      ],
    );
  };

  const handlePickImage = async () => {
    if (!assessmentId) {
      Alert.alert("Action Required", "Please save the draft first to get an ID for image uploads.");
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
          <Text style={styles.loadingText}>Loading Survivability Assessment...</Text>
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

        {/* SECTION 1: Soil Assessment */}
        <SectionCard
          title="Soil Assessment"
          subtitle="Texture, moisture & drainage"
          icon={<Thermometer size={18} color="#fff" />}
          accentColor="#92400E"
          step={1}
        >
          <FieldLabel label="Soil Texture" />
          <ChipGroup
            options={SOIL_TEXTURES}
            selected={soilTexture}
            onSelect={(v) => !isViewMode && setSoilTexture(v)}
            disabled={isViewMode}
          />
          {soilTexture === "other" && (
            <>
              <FieldLabel label="Describe Soil Texture" />
              <TextInput
                style={[styles.textArea, isViewMode && styles.disabledInput]}
                multiline
                value={soilTextureOther}
                onChangeText={setSoilTextureOther}
                placeholder="Describe soil texture observed..."
                editable={!isViewMode}
                placeholderTextColor="#94A3B8"
              />
            </>
          )}

          <FieldLabel label="Moisture Feel" />
          <ChipGroup
            options={MOISTURE_LEVELS}
            selected={soilMoisture}
            onSelect={(v) => !isViewMode && setSoilMoisture(v)}
            disabled={isViewMode}
          />
          {soilMoisture === "other" && (
            <>
              <FieldLabel label="Describe Moisture Condition" />
              <TextInput
                style={[styles.textArea, isViewMode && styles.disabledInput]}
                multiline
                value={soilMoistureOther}
                onChangeText={setSoilMoistureOther}
                placeholder="Describe moisture condition..."
                editable={!isViewMode}
                placeholderTextColor="#94A3B8"
              />
            </>
          )}

          <FieldLabel label="Soil Depth (cm)" optional />
          <TextInput
            style={[styles.input, isViewMode && styles.disabledInput]}
            keyboardType="numeric"
            value={soilDepth}
            onChangeText={setSoilDepth}
            placeholder="e.g., 75"
            editable={!isViewMode}
            placeholderTextColor="#94A3B8"
          />

          <FieldLabel label="Drainage Observation" />
          <ChipGroup
            options={DRAINAGE_TYPES}
            selected={soilDrainage}
            onSelect={(v) => !isViewMode && setSoilDrainage(v)}
            disabled={isViewMode}
          />
          {soilDrainage === "other" && (
            <>
              <FieldLabel label="Describe Drainage Condition" />
              <TextInput
                style={[styles.textArea, isViewMode && styles.disabledInput]}
                multiline
                value={soilDrainageOther}
                onChangeText={setSoilDrainageOther}
                placeholder="Describe drainage condition..."
                editable={!isViewMode}
                placeholderTextColor="#94A3B8"
              />
            </>
          )}

          <FieldLabel label="Soil Notes" optional />
          <TextInput
            style={[styles.textArea, isViewMode && styles.disabledInput]}
            multiline
            value={soilNotes}
            onChangeText={setSoilNotes}
            placeholder="Color, organic matter, rock content, pH estimate..."
            editable={!isViewMode}
            placeholderTextColor="#94A3B8"
          />
        </SectionCard>

        {/* SECTION 2: Water & Micro-topography */}
        <SectionCard
          title="Water & Micro-topography"
          subtitle="Stress symptoms & landscape position"
          icon={<Droplets size={18} color="#fff" />}
          accentColor="#1D4ED8"
          step={2}
        >
          <FieldLabel label="Water Stress Symptoms" />
          <ChipGroup
            options={STRESS_SYMPTOMS}
            selected={waterStress}
            onSelect={(v) => !isViewMode && setWaterStress(v)}
            disabled={isViewMode}
          />
          {waterStress === "other" && (
            <>
              <FieldLabel label="Describe Stress Symptoms" />
              <TextInput
                style={[styles.textArea, isViewMode && styles.disabledInput]}
                multiline
                value={waterStressOther}
                onChangeText={setWaterStressOther}
                placeholder="Describe water stress symptoms..."
                editable={!isViewMode}
                placeholderTextColor="#94A3B8"
              />
            </>
          )}

          <FieldLabel label="Days Since Last Rainfall" optional />
          <TextInput
            style={[styles.input, isViewMode && styles.disabledInput]}
            keyboardType="numeric"
            value={daysSinceRain}
            onChangeText={setDaysSinceRain}
            placeholder="e.g., 3"
            editable={!isViewMode}
            placeholderTextColor="#94A3B8"
          />

          <FieldLabel label="Micro-topography" />
          <ChipGroup
            options={TOPOGRAPHY}
            selected={topography}
            onSelect={(v) => !isViewMode && setTopography(v)}
            disabled={isViewMode}
          />
          {topography === "other" && (
            <>
              <FieldLabel label="Describe Micro-topography" />
              <TextInput
                style={[styles.textArea, isViewMode && styles.disabledInput]}
                multiline
                value={topographyOther}
                onChangeText={setTopographyOther}
                placeholder="Describe micro-topography..."
                editable={!isViewMode}
                placeholderTextColor="#94A3B8"
              />
            </>
          )}

          <FieldLabel label="Water Availability Notes" optional />
          <TextInput
            style={[styles.textArea, isViewMode && styles.disabledInput]}
            multiline
            value={waterNotes}
            onChangeText={setWaterNotes}
            placeholder="Proximity to water, irrigation potential, seasonal patterns..."
            editable={!isViewMode}
            placeholderTextColor="#94A3B8"
          />
        </SectionCard>

        {/* SECTION 3: Competition & Invasives */}
        <SectionCard
          title="Competition & Invasives"
          subtitle="Species present & seedling regeneration"
          icon={<Sprout size={18} color="#fff" />}
          accentColor="#15803D"
          step={3}
        >
          <FieldLabel label="Invasive Species Present" />
          <ChipGroup
            options={INVASIVE_SPECIES}
            selected={invasiveSpecies}
            onSelect={(v) => !isViewMode && setInvasiveSpecies(v)}
            disabled={isViewMode}
          />
          {invasiveSpecies === "other" && (
            <>
              <FieldLabel label="Describe Invasive Species" />
              <TextInput
                style={[styles.textArea, isViewMode && styles.disabledInput]}
                multiline
                value={invasiveSpeciesOther}
                onChangeText={setInvasiveSpeciesOther}
                placeholder="Describe invasive species observed..."
                editable={!isViewMode}
                placeholderTextColor="#94A3B8"
              />
            </>
          )}

          <View style={styles.twoColRow}>
            <View style={styles.twoColField}>
              <FieldLabel label="Invasive Cover (%)" optional />
              <TextInput
                style={[styles.input, isViewMode && styles.disabledInput]}
                keyboardType="numeric"
                value={invasivePct}
                onChangeText={setInvasivePct}
                placeholder="0 – 100"
                editable={!isViewMode}
                placeholderTextColor="#94A3B8"
              />
            </View>
            <View style={styles.twoColDivider} />
            <View style={styles.twoColField}>
              <FieldLabel label="Native Seedlings" optional />
              <TextInput
                style={[styles.input, isViewMode && styles.disabledInput]}
                keyboardType="numeric"
                value={seedlingsCount}
                onChangeText={setSeedlingsCount}
                placeholder="per 100 m²"
                editable={!isViewMode}
                placeholderTextColor="#94A3B8"
              />
            </View>
          </View>

          <FieldLabel label="Vegetation Notes" optional />
          <TextInput
            style={[styles.textArea, isViewMode && styles.disabledInput]}
            multiline
            value={vegNotes}
            onChangeText={setVegNotes}
            placeholder="Native species, grass height, clearing requirements..."
            editable={!isViewMode}
            placeholderTextColor="#94A3B8"
          />

          <FieldLabel label="Microclimate Notes" optional />
          <TextInput
            style={[styles.textArea, isViewMode && styles.disabledInput]}
            multiline
            value={microclimateNotes}
            onChangeText={setMicroclimateNotes}
            placeholder="Shade, wind exposure, temperature..."
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
          <View style={styles.twoColRow}>
            <View style={styles.twoColField}>
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
            <View style={styles.twoColDivider} />
            <View style={styles.twoColField}>
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

        {/* SECTION 5: Photo Gallery */}
        <SectionCard
          title="Photo Evidence"
          subtitle={`${images.length} photo${images.length !== 1 ? "s" : ""} attached`}
          icon={<ImagePlus size={18} color="#fff" />}
          accentColor="#0369A1"
          step={5}
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

      {/* Fixed Footer */}
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

const ChipGroup = ({
  options,
  selected,
  onSelect,
  disabled,
}: {
  options: string[];
  selected: string;
  onSelect: (v: string) => void;
  disabled: boolean;
}) => (
  <View style={styles.chipContainer}>
    {options.map((opt) => {
      const active = selected === opt;
      return (
        <TouchableOpacity
          key={opt}
          style={[styles.chip, active && styles.chipActive]}
          onPress={() => onSelect(opt)}
          disabled={disabled}
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

  // Two-column layout
  twoColRow: { flexDirection: "row" },
  twoColField: { flex: 1 },
  twoColDivider: { width: 10 },

  // Coordinate preview
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

  hint: { fontSize: 11, color: "#94A3B8", fontStyle: "italic", lineHeight: 16 },

  // Gallery
  galleryContent: { paddingVertical: 4, gap: 10 },
  thumbWrapper: { position: "relative" },
  thumb: { width: 90, height: 90, borderRadius: 10, backgroundColor: "#E2E8F0" },
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
