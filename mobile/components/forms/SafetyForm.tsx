import React, { useState, useEffect, useRef } from "react";
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
  Dimensions,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as SecureStore from "expo-secure-store";

import { useFieldAssessment, LocalImage } from "@/hooks/useFieldAssessment";
import { api } from "@/constants/url_fixed";

const API_BASE = `${api}/api`;
const { width: SW, height: SH } = Dimensions.get("window");

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

interface LocationData {
  latitude: number;
  longitude: number;
  address?: string;
  city?: string;
  barangay?: string;
  timestamp: string;
  accuracy?: number;
}

interface SafetyImage {
  image_id: number;
  url: string;
  layer: string;
  latitude: number | null;
  longitude: number | null;
  description: string;
  created_at: string;
}

// ─────────────────────────────────────────────
// GPS CAMERA COMPONENT (SimpleGeocam)
// ─────────────────────────────────────────────

function SimpleGeocam({
  onCapture,
  onClose,
}: {
  onCapture: (uri: string, location: LocationData) => void;
  onClose: () => void;
}) {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [locationPermission, requestLocationPermission] =
    Location.useForegroundPermissions();
  const [capturing, setCapturing] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(
    null,
  );
  const cameraRef = useRef<CameraView>(null);

  const getCurrentLocation = async (): Promise<LocationData | null> => {
    try {
      if (!locationPermission?.granted) {
        const s = await requestLocationPermission();
        if (!s?.granted) {
          Alert.alert("Permission Denied", "Location access is required.");
          return null;
        }
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });
      const [addr] = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      const data: LocationData = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        address: addr?.street || "",
        city: addr?.city || addr?.region || "",
        barangay: addr?.subregion || addr?.district || "",
        timestamp: new Date().toLocaleString("en-PH", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
        accuracy: loc.coords.accuracy ?? undefined,
      };
      setCurrentLocation(data);
      return data;
    } catch (error) {
      Alert.alert("Error", "Could not get GPS location.");
      return null;
    }
  };

  useEffect(() => {
    getCurrentLocation();
  }, []);

  const takePicture = async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const locData = currentLocation ?? (await getCurrentLocation());
      if (!locData) {
        Alert.alert(
          "Location Required",
          "GPS coordinates are needed to capture a photo.",
        );
        return;
      }
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        base64: false,
      });
      if (!photo?.uri) {
        Alert.alert("Error", "Failed to capture photo.");
        return;
      }
      onCapture(photo.uri, locData);
    } catch (error) {
      Alert.alert(
        "Error",
        `Failed to capture photo: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setCapturing(false);
    }
  };

  if (!cameraPermission || !locationPermission) {
    return (
      <View style={cam.centerFill}>
        <ActivityIndicator size="large" color="#0F4A2F" />
        <Text style={cam.permText}>Requesting permissions…</Text>
      </View>
    );
  }
  if (!cameraPermission.granted || !locationPermission.granted) {
    return (
      <View style={cam.centerFill}>
        <View style={cam.permIconWrap}>
          <Ionicons name="camera-outline" size={36} color="#0F4A2F" />
        </View>
        <Text style={cam.permTitle}>Permissions Required</Text>
        <Text style={cam.permText}>
          Camera and location access are needed to capture GPS photos.
        </Text>
        <TouchableOpacity
          style={cam.permBtn}
          onPress={() => {
            requestCameraPermission();
            requestLocationPermission();
          }}
        >
          <Text style={cam.permBtnText}>Grant Permissions</Text>
        </TouchableOpacity>
        <TouchableOpacity style={cam.permCancelBtn} onPress={onClose}>
          <Text style={cam.permCancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const hasGPS = !!currentLocation;
  const accuracy = currentLocation?.accuracy;
  const signalLevel =
    accuracy == null
      ? 0
      : accuracy < 5
        ? 5
        : accuracy < 10
          ? 4
          : accuracy < 20
            ? 3
            : accuracy < 40
              ? 2
              : 1;

  return (
    <View style={cam.root}>
      <CameraView ref={cameraRef} style={cam.camera} facing="back" />

      {/* Top Bar */}
      <View style={cam.topBar}>
        <TouchableOpacity
          style={cam.iconBtn}
          onPress={onClose}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={22} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[cam.locationPill, !hasGPS && cam.locationPillDim]}
          activeOpacity={0.8}
        >
          <View
            style={[
              cam.gpsDot,
              { backgroundColor: hasGPS ? "#4ADE80" : "#F59E0B" },
            ]}
          />
          <Text style={cam.locationPillText} numberOfLines={1}>
            {hasGPS
              ? currentLocation!.city || currentLocation!.barangay || "Located"
              : "Getting GPS…"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={cam.iconBtnGreen}
          onPress={getCurrentLocation}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh" size={16} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Reticle */}
      <View style={cam.reticle} pointerEvents="none">
        <View style={[cam.bracket, cam.bTL]} />
        <View style={[cam.bracket, cam.bTR]} />
        <View style={[cam.bracket, cam.bBL]} />
        <View style={[cam.bracket, cam.bBR]} />
        <View style={cam.reticleDot} />
      </View>

      {/* GPS Card */}
      <View style={cam.gpsCard}>
        <View style={cam.gpsCardHeader}>
          <View style={cam.gpsCardLeft}>
            <View
              style={[
                cam.gpsStatusDot,
                { backgroundColor: hasGPS ? "#4ADE80" : "#F59E0B" },
              ]}
            />
            <Text style={cam.gpsCardLabel}>
              {hasGPS ? "GPS Active" : "Acquiring GPS…"}
            </Text>
          </View>
          <View style={cam.signalBars}>
            {[1, 2, 3, 4, 5].map((n) => (
              <View
                key={n}
                style={[
                  cam.signalBar,
                  { height: 4 + n * 3, opacity: n <= signalLevel ? 1 : 0.2 },
                ]}
              />
            ))}
          </View>
        </View>
        {hasGPS ? (
          <>
            <Text style={cam.gpsLocation} numberOfLines={1}>
              {currentLocation!.barangay
                ? `${currentLocation!.barangay}, ${currentLocation!.city}`
                : currentLocation!.city || "Unknown"}
            </Text>
            <Text style={cam.gpsCoords}>
              {currentLocation!.latitude.toFixed(6)}°{" "}
              {currentLocation!.longitude.toFixed(6)}°
            </Text>
            <View style={cam.gpsFooter}>
              <Text style={cam.gpsTimestamp}>{currentLocation!.timestamp}</Text>
              {accuracy != null && (
                <View style={cam.gpsPill}>
                  <Text style={cam.gpsPillText}>±{Math.round(accuracy)}m</Text>
                </View>
              )}
            </View>
          </>
        ) : (
          <Text style={cam.gpsWaiting}>Searching for satellites…</Text>
        )}
      </View>

      {/* Capture Area */}
      <View style={cam.captureArea}>
        <TouchableOpacity
          style={[cam.captureRing, !hasGPS && { opacity: 0.4 }]}
          onPress={takePicture}
          disabled={capturing || !hasGPS}
          activeOpacity={0.8}
        >
          {capturing ? (
            <ActivityIndicator color="#0F4A2F" size="large" />
          ) : (
            <View style={cam.captureCore} />
          )}
        </TouchableOpacity>
        <Text style={cam.captureHint}>
          {hasGPS ? "Tap to capture" : "Waiting for GPS…"}
        </Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────
// CAMERA STYLES
// ─────────────────────────────────────────────

const cam = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  camera: { flex: 1 },
  centerFill: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F4F7F5",
    padding: 24,
  },
  permIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: "#E6F4EC",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  permTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F2D1C",
    marginBottom: 8,
  },
  permText: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  permBtn: {
    backgroundColor: "#0F4A2F",
    paddingVertical: 13,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginBottom: 10,
  },
  permBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  permCancelBtn: { paddingVertical: 10 },
  permCancelText: { color: "#9CA3AF", fontWeight: "600", fontSize: 14 },
  topBar: {
    position: "absolute",
    top: 52,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    zIndex: 10,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
  },
  iconBtnGreen: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(15,74,47,0.85)",
    justifyContent: "center",
    alignItems: "center",
  },
  locationPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    maxWidth: "58%",
    gap: 6,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  locationPillDim: { opacity: 0.85 },
  gpsDot: { width: 8, height: 8, borderRadius: 4 },
  locationPillText: {
    flex: 1,
    color: "#0F2D1C",
    fontWeight: "700",
    fontSize: 13,
  },
  reticle: {
    position: "absolute",
    top: "35%",
    left: "50%",
    width: 160,
    height: 160,
    marginLeft: -80,
    marginTop: -80,
    justifyContent: "center",
    alignItems: "center",
    pointerEvents: "none",
  },
  bracket: {
    position: "absolute",
    width: 28,
    height: 28,
    borderColor: "rgba(255,255,255,0.85)",
  },
  bTL: { top: 0, left: 0, borderTopWidth: 2.5, borderLeftWidth: 2.5 },
  bTR: { top: 0, right: 0, borderTopWidth: 2.5, borderRightWidth: 2.5 },
  bBL: { bottom: 0, left: 0, borderBottomWidth: 2.5, borderLeftWidth: 2.5 },
  bBR: { bottom: 0, right: 0, borderBottomWidth: 2.5, borderRightWidth: 2.5 },
  reticleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.7)",
  },
  gpsCard: {
    position: "absolute",
    bottom: 120,
    left: 12,
    right: 12,
    backgroundColor: "rgba(0,0,0,0.78)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    padding: 14,
    zIndex: 10,
  },
  gpsCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  gpsCardLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  gpsStatusDot: { width: 8, height: 8, borderRadius: 4 },
  gpsCardLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255,255,255,0.7)",
    letterSpacing: 0.5,
  },
  signalBars: { flexDirection: "row", alignItems: "flex-end", gap: 3 },
  signalBar: { width: 4, borderRadius: 2, backgroundColor: "#4ADE80" },
  gpsLocation: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  gpsCoords: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4ADE80",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    marginBottom: 6,
  },
  gpsFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  gpsTimestamp: { fontSize: 11, color: "rgba(255,255,255,0.5)" },
  gpsPill: {
    backgroundColor: "rgba(74,222,128,0.2)",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "rgba(74,222,128,0.4)",
  },
  gpsPillText: { fontSize: 10, color: "#4ADE80", fontWeight: "700" },
  gpsWaiting: {
    fontSize: 13,
    color: "rgba(255,255,255,0.45)",
    fontStyle: "italic",
    marginTop: 2,
  },
  captureArea: {
    position: "absolute",
    bottom: 28,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 10,
  },
  captureRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.6)",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  captureCore: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#FFFFFF",
  },
  captureHint: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    marginTop: 10,
    fontWeight: "600",
  },
});

// ─────────────────────────────────────────────
// FORM SUB-COMPONENTS
// ─────────────────────────────────────────────

type SectionCardProps = {
  title: string;
  subtitle?: string;
  iconName: string;
  iconLib?: "ion" | "mci";
  accentColor: string;
  step: number;
  children: React.ReactNode;
};

const SectionCard = ({
  title,
  subtitle,
  iconName,
  iconLib = "ion",
  accentColor,
  step,
  children,
}: SectionCardProps) => (
  <View style={styles.card}>
    <View style={[styles.cardAccent, { backgroundColor: accentColor }]} />
    <View style={styles.cardInner}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconBadge, { backgroundColor: accentColor }]}>
          {iconLib === "mci" ? (
            <MaterialCommunityIcons
              name={iconName as any}
              size={18}
              color="#fff"
            />
          ) : (
            <Ionicons name={iconName as any} size={18} color="#fff" />
          )}
        </View>
        <View style={styles.cardTitleGroup}>
          <Text style={styles.cardTitle}>{title}</Text>
          {subtitle ? (
            <Text style={styles.cardSubtitle}>{subtitle}</Text>
          ) : null}
        </View>
        <View style={[styles.stepBadge, { borderColor: accentColor }]}>
          <Text style={[styles.stepText, { color: accentColor }]}>{step}</Text>
        </View>
      </View>
      <View style={styles.cardBody}>{children}</View>
    </View>
  </View>
);

const FieldLabel = ({
  label,
  optional,
}: {
  label: string;
  optional?: boolean;
}) => (
  <View style={styles.fieldLabelRow}>
    <Text style={styles.fieldLabel}>{label}</Text>
    {optional && <Text style={styles.optionalTag}>optional</Text>}
  </View>
);

// ─────────────────────────────────────────────
// MAIN FORM COMPONENT
// ─────────────────────────────────────────────

export default function SafetyForm() {
  const params = useLocalSearchParams();
  const areaId = params.areaId as string;
  const assessmentId = params.assessmentId as string | undefined;
  const layerId = "safety";
  const siteId = params.siteId as string | undefined;
  const { saving, handleSave, uploadImage, deleteImage, fetchAssessmentData } =
    useFieldAssessment(areaId, layerId, assessmentId);

  // Category overall notes
  const [floodNote, setFloodNote] = useState("");
  const [landslideNote, setLandslideNote] = useState("");
  const [erosionNote, setErosionNote] = useState("");
  const [otherNote, setOtherNote] = useState("");
  const [overallSafetyNote, setOverallSafetyNote] = useState("");

  // Assessment location
  const [locationLat, setLocationLat] = useState("");
  const [locationLng, setLocationLng] = useState("");
  const [locationAccuracy, setLocationAccuracy] = useState("");
  const [gettingLocation, setGettingLocation] = useState(false);

  // Images per category (from server)
  const [floodImages, setFloodImages] = useState<SafetyImage[]>([]);
  const [landslideImages, setLandslideImages] = useState<SafetyImage[]>([]);
  const [erosionImages, setErosionImages] = useState<SafetyImage[]>([]);
  const [otherImages, setOtherImages] = useState<SafetyImage[]>([]);

  // ✅ NEW: Local images (captured before save)
  const [localImages, setLocalImages] = useState<LocalImage[]>([]);

  // View mode & loading
  const [isViewMode, setIsViewMode] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!assessmentId);

  // Geocam & note modal state
  const [showGPSCamera, setShowGPSCamera] = useState(false);
  const [activeCategory, setActiveCategory] = useState<
    "flood" | "landslide" | "erosion" | "other" | null
  >(null);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState<{
    uri: string;
    location: LocationData;
  } | null>(null);
  const [pendingNote, setPendingNote] = useState("");
  const [uploading, setUploading] = useState(false);

  // Load existing data
  useEffect(() => {
    if (assessmentId) {
      (async () => {
        const data = await fetchAssessmentData();
        if (data) {
          populateForm(data.field_assessment_data || {});
          if (data.location) {
            setLocationLat(data.location.latitude?.toString() || "");
            setLocationLng(data.location.longitude?.toString() || "");
            setLocationAccuracy(
              data.location.gps_accuracy_meters?.toString() || "",
            );
          }

          // Filter images by layer
          const allImages = data.images || [];
          setFloodImages(
            allImages.filter(
              (img: SafetyImage) => img.layer === "safety_flood",
            ),
          );
          setLandslideImages(
            allImages.filter(
              (img: SafetyImage) => img.layer === "safety_landslide",
            ),
          );
          setErosionImages(
            allImages.filter(
              (img: SafetyImage) => img.layer === "safety_erosion",
            ),
          );
          setOtherImages(
            allImages.filter(
              (img: SafetyImage) => img.layer === "safety_other",
            ),
          );

          setIsViewMode(!!data.is_submitted);
        }
        setLoading(false);
      })();
    } else {
      setLoading(false);
    }
  }, [assessmentId]);

  const populateForm = (data: any) => {
    const safety = data?.safety?.safety || data?.safety || data || {};
    setFloodNote(safety.flood?.overall_note || "");
    setLandslideNote(safety.landslide?.overall_note || "");
    setErosionNote(safety.erosion?.overall_note || "");
    setOtherNote(safety.other?.overall_note || "");
    setOverallSafetyNote(safety.overall_notes || "");
  };

  const handleGetCurrentLocation = async () => {
    setGettingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Please enable location access.");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLocationLat(loc.coords.latitude.toFixed(6));
      setLocationLng(loc.coords.longitude.toFixed(6));
      setLocationAccuracy(loc.coords.accuracy?.toFixed(1) || "");
      Alert.alert("Location Captured", "GPS coordinates updated.");
    } catch (error) {
      Alert.alert("Error", "Could not get current location.");
    } finally {
      setGettingLocation(false);
    }
  };

  // ✅ UPDATED: Handle photo capture - NO LONGER requires assessmentId
  const handleGPSPhotoCaptured = async (
    uri: string,
    location: LocationData,
  ) => {
    setShowGPSCamera(false);
    setPendingPhoto({ uri, location });
    setPendingNote("");
    setShowNoteModal(true);
  };

  // ✅ UPDATED: Handle note submission - stores locally OR uploads immediately
  const handleNoteSubmit = async (note: string) => {
    if (!pendingPhoto || !activeCategory) {
      return;
    }

    const numericAssessmentId = assessmentId ? parseInt(assessmentId) : null;

    // If we have an assessmentId, upload immediately
    if (numericAssessmentId && !isNaN(numericAssessmentId)) {
      setUploading(true);
      try {
        const ok = await uploadImage(
          numericAssessmentId,
          {
            uri: pendingPhoto.uri,
            latitude: pendingPhoto.location.latitude,
            longitude: pendingPhoto.location.longitude,
            accuracy: pendingPhoto.location.accuracy,
          },
          {
            subLayerCode: activeCategory,
            description:
              note ||
              `Safety ${activeCategory} at ${pendingPhoto.location.latitude.toFixed(6)}, ${pendingPhoto.location.longitude.toFixed(6)}`,
          },
        );

        if (ok) {
          const data = await fetchAssessmentData();
          if (data) {
            const allImages = data.images || [];
            if (activeCategory === "flood")
              setFloodImages(allImages.filter((img: SafetyImage) => img.layer === "safety_flood"));
            else if (activeCategory === "landslide")
              setLandslideImages(allImages.filter((img: SafetyImage) => img.layer === "safety_landslide"));
            else if (activeCategory === "erosion")
              setErosionImages(allImages.filter((img: SafetyImage) => img.layer === "safety_erosion"));
            else if (activeCategory === "other")
              setOtherImages(allImages.filter((img: SafetyImage) => img.layer === "safety_other"));
          }
          Alert.alert("Success", "Photo uploaded with GPS data!");
        } else {
          Alert.alert("Upload Failed", "Could not upload photo. Please try again.");
        }
      } catch (error) {
        Alert.alert(
          "Upload Error",
          `Failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      } finally {
        setUploading(false);
      }
    } else {
      // ✅ NEW: Store locally if no assessmentId
      const localImg: LocalImage = {
        id: `local-${Date.now()}`,
        uri: pendingPhoto.uri,
        latitude: pendingPhoto.location.latitude,
        longitude: pendingPhoto.location.longitude,
        accuracy: pendingPhoto.location.accuracy,
        subLayerCode: activeCategory,
        description: note || `Safety ${activeCategory} photo`,
      };
      setLocalImages([...localImages, localImg]);
      Alert.alert("Photo Captured", "Photo will be uploaded when you save the draft.");
    }

    setShowNoteModal(false);
    setPendingPhoto(null);
    setPendingNote("");
    setActiveCategory(null);
  };

  // ✅ NEW: Remove local image
  const removeLocalImage = (id: string) => {
    setLocalImages(localImages.filter((img) => img.id !== id));
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

    const layerData = {
      flood: { overall_note: floodNote || null },
      landslide: { overall_note: landslideNote || null },
      erosion: { overall_note: erosionNote || null },
      other: { overall_note: otherNote || null },
      overall_notes: overallSafetyNote || null,
    };

    return {
      reforestation_area_id: areaId ? parseInt(areaId) : null,
      site_id: siteId ? parseInt(siteId) : null,
      assessment_date: new Date().toISOString().split("T")[0],
      location,
      field_assessment_data: {
        [layerId]: layerData,
      },
    };
  };

  // ✅ UPDATED: handleDraft now passes localImages
  const handleDraft = async () => {
    const payload = buildPayload();
    const savedId = await handleSave(payload, false, localImages);
    
    if (savedId) {
      setLocalImages([]);
      const data = await fetchAssessmentData();
      if (data) {
        populateForm(data.field_assessment_data || {});
        const allImages = data.images || [];
        setFloodImages(allImages.filter((img: SafetyImage) => img.layer === "safety_flood"));
        setLandslideImages(allImages.filter((img: SafetyImage) => img.layer === "safety_landslide"));
        setErosionImages(allImages.filter((img: SafetyImage) => img.layer === "safety_erosion"));
        setOtherImages(allImages.filter((img: SafetyImage) => img.layer === "safety_other"));
      }
      Alert.alert("Saved", "Draft saved successfully.");
    }
  };

  // ✅ UPDATED: handleSubmit also passes localImages
  const handleSubmit = async () => {
    Alert.alert(
      "Submit Assessment",
      "Are you sure? You cannot edit after submission.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Submit",
          onPress: async () => {
            const savedId = await handleSave(buildPayload(), true, localImages);
            if (savedId) {
              setLocalImages([]);
              setIsViewMode(true);
             
            }
          },
        },
      ],
    );
  };

  const handleDeleteImage = async (
    img: SafetyImage,
    category: "flood" | "landslide" | "erosion" | "other",
  ) => {
    Alert.alert("Delete Photo", "Remove this photo?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteImage(img.image_id);
          const d = await fetchAssessmentData();
          if (d) {
            const allImages = d.images || [];
            if (category === "flood")
              setFloodImages(allImages.filter((i: SafetyImage) => i.layer === "safety_flood"));
            else if (category === "landslide")
              setLandslideImages(allImages.filter((i: SafetyImage) => i.layer === "safety_landslide"));
            else if (category === "erosion")
              setErosionImages(allImages.filter((i: SafetyImage) => i.layer === "safety_erosion"));
            else if (category === "other")
              setOtherImages(allImages.filter((i: SafetyImage) => i.layer === "safety_other"));
          }
        },
      },
    ]);
  };

  const getImageUrl = (imgUrl: string) => {
    if (!imgUrl) return "";
    if (imgUrl.startsWith("http://") || imgUrl.startsWith("https://")) {
      return imgUrl;
    }
    return `${api}${imgUrl}`;
  };

  const openGeocamForCategory = (
    category: "flood" | "landslide" | "erosion" | "other",
  ) => {
    setActiveCategory(category);
    setShowGPSCamera(true);
  };

  // ✅ NEW: Render local images for a category
  const renderLocalImages = (category: "flood" | "landslide" | "erosion" | "other") => {
    const categoryLocalImages = localImages.filter((img) => img.subLayerCode === category);
    if (categoryLocalImages.length === 0) return null;

    return (
      <View style={styles.localImagesSection}>
        <Text style={styles.localImagesLabel}>Pending Upload ({categoryLocalImages.length})</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {categoryLocalImages.map((img) => (
            <View key={img.id} style={styles.thumbWrapper}>
              <TouchableOpacity
                onPress={() => setPreviewImage(img.uri)}
                activeOpacity={0.85}
              >
                <Image source={{ uri: img.uri }} style={styles.thumb} resizeMode="cover" />
                <View style={[styles.thumbOverlay, { backgroundColor: "rgba(245,158,11,0.6)" }]}>
                  <Ionicons name="cloud-upload-outline" size={14} color="#fff" />
                </View>
                <View style={styles.thumbCoords}>
                  <Text style={styles.thumbCoordsText}>
                    {img.latitude.toFixed(4)},{img.longitude.toFixed(4)}
                  </Text>
                </View>
              </TouchableOpacity>
              {img.description ? (
                <Text style={styles.thumbNote} numberOfLines={1}>
                  {img.description}
                </Text>
              ) : (
                <Text style={[styles.thumbNote, { color: "#F59E0B", fontStyle: "italic" }]}>
                  Pending
                </Text>
              )}
              {!isViewMode && (
                <TouchableOpacity
                  style={styles.deletePhotoBtn}
                  onPress={() => removeLocalImage(img.id)}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Ionicons name="close" size={11} color="#fff" />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </ScrollView>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContent}>
        <View style={styles.loadingCard}>
          <ActivityIndicator size="large" color="#0F4A2F" />
          <Text style={styles.loadingText}>Loading Safety Assessment…</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {isViewMode && (
          <View style={styles.viewModeBanner}>
            <Ionicons name="eye-outline" size={16} color="#fff" />
            <Text style={styles.viewModeBannerText}>Submitted — Read Only</Text>
          </View>
        )}

        {/* SECTION 1: Flood */}
        <SectionCard
          title="Flood Evidence"
          subtitle={`${floodImages.length + localImages.filter(i => i.subLayerCode === "flood").length} GPS photo${(floodImages.length + localImages.filter(i => i.subLayerCode === "flood").length) !== 1 ? "s" : ""}`}
          iconName="water-outline"
          iconLib="ion"
          accentColor="#1D4ED8"
          step={1}
        >
          <FieldLabel label="Overall Note" />
          <TextInput
            style={[styles.textArea, isViewMode && styles.disabledInput]}
            multiline
            value={floodNote}
            onChangeText={setFloodNote}
            placeholder="e.g., Water line visible at 80cm, debris caught on trees..."
            placeholderTextColor="#94A3B8"
            editable={!isViewMode}
            textAlignVertical="top"
          />

          <View style={styles.galleryContent}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {floodImages.map((img) => (
                <View key={img.image_id} style={styles.thumbWrapper}>
                  <TouchableOpacity
                    onPress={() => setPreviewImage(getImageUrl(img.url))}
                    activeOpacity={0.85}
                  >
                    <Image
                      source={{ uri: getImageUrl(img.url) }}
                      style={styles.thumb}
                      resizeMode="cover"
                    />
                    <View style={styles.thumbOverlay}>
                      <Ionicons name="eye-outline" size={14} color="#fff" />
                    </View>
                    {img.latitude != null && img.longitude != null && (
                      <View style={styles.thumbCoords}>
                        <Text style={styles.thumbCoordsText}>
                          {typeof img.latitude === "number"
                            ? img.latitude.toFixed(4)
                            : img.latitude}
                          ,
                          {typeof img.longitude === "number"
                            ? img.longitude.toFixed(4)
                            : img.longitude}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  {img.description ? (
                    <Text style={styles.thumbNote} numberOfLines={1}>
                      {img.description}
                    </Text>
                  ) : (
                    <Text
                      style={[
                        styles.thumbNote,
                        { color: "#94A3B8", fontStyle: "italic" },
                      ]}
                    >
                      No note
                    </Text>
                  )}
                  {!isViewMode && (
                    <TouchableOpacity
                      style={styles.deletePhotoBtn}
                      onPress={() => handleDeleteImage(img, "flood")}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Ionicons name="close" size={11} color="#fff" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}

              {!isViewMode && (
                <TouchableOpacity
                  style={[styles.addPhotoBtn, styles.addPhotoBtnGPS]}
                  onPress={() => openGeocamForCategory("flood")}
                  activeOpacity={0.75}
                >
                  <Ionicons name="camera-outline" size={26} color="#1D4ED8" />
                  <Text style={[styles.addPhotoBtnText, { color: "#1D4ED8" }]}>
                    Add Photo
                  </Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>

          {/* ✅ NEW: Render local images */}
          {renderLocalImages("flood")}
        </SectionCard>

        {/* SECTION 2: Landslide */}
        <SectionCard
          title="Landslide Indicators"
          subtitle={`${landslideImages.length + localImages.filter(i => i.subLayerCode === "landslide").length} GPS photo${(landslideImages.length + localImages.filter(i => i.subLayerCode === "landslide").length) !== 1 ? "s" : ""}`}
          iconName="mountain"
          iconLib="mci"
          accentColor="#854D0E"
          step={2}
        >
          <FieldLabel label="Overall Note" />
          <TextInput
            style={[styles.textArea, isViewMode && styles.disabledInput]}
            multiline
            value={landslideNote}
            onChangeText={setLandslideNote}
            placeholder="e.g., Tension cracks observed, bent trees on slope..."
            placeholderTextColor="#94A3B8"
            editable={!isViewMode}
            textAlignVertical="top"
          />

          <View style={styles.galleryContent}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {landslideImages.map((img) => (
                <View key={img.image_id} style={styles.thumbWrapper}>
                  <TouchableOpacity
                    onPress={() => setPreviewImage(getImageUrl(img.url))}
                    activeOpacity={0.85}
                  >
                    <Image
                      source={{ uri: getImageUrl(img.url) }}
                      style={styles.thumb}
                      resizeMode="cover"
                    />
                    <View style={styles.thumbOverlay}>
                      <Ionicons name="eye-outline" size={14} color="#fff" />
                    </View>
                    {img.latitude != null && img.longitude != null && (
                      <View style={styles.thumbCoords}>
                        <Text style={styles.thumbCoordsText}>
                          {typeof img.latitude === "number"
                            ? img.latitude.toFixed(4)
                            : img.latitude}
                          ,
                          {typeof img.longitude === "number"
                            ? img.longitude.toFixed(4)
                            : img.longitude}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  {img.description ? (
                    <Text style={styles.thumbNote} numberOfLines={1}>
                      {img.description}
                    </Text>
                  ) : (
                    <Text
                      style={[
                        styles.thumbNote,
                        { color: "#94A3B8", fontStyle: "italic" },
                      ]}
                    >
                      No note
                    </Text>
                  )}
                  {!isViewMode && (
                    <TouchableOpacity
                      style={styles.deletePhotoBtn}
                      onPress={() => handleDeleteImage(img, "landslide")}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Ionicons name="close" size={11} color="#fff" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}

              {!isViewMode && (
                <TouchableOpacity
                  style={[styles.addPhotoBtn, styles.addPhotoBtnGPS]}
                  onPress={() => openGeocamForCategory("landslide")}
                  activeOpacity={0.75}
                >
                  <Ionicons name="camera-outline" size={26} color="#854D0E" />
                  <Text style={[styles.addPhotoBtnText, { color: "#854D0E" }]}>
                    Add Photo
                  </Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>

          {renderLocalImages("landslide")}
        </SectionCard>

        {/* SECTION 3: Soil Erosion */}
        <SectionCard
          title="Soil Erosion"
          subtitle={`${erosionImages.length + localImages.filter(i => i.subLayerCode === "erosion").length} GPS photo${(erosionImages.length + localImages.filter(i => i.subLayerCode === "erosion").length) !== 1 ? "s" : ""}`}
          iconName="alert-circle-outline"
          iconLib="ion"
          accentColor="#B91C1C"
          step={3}
        >
          <FieldLabel label="Overall Note" />
          <TextInput
            style={[styles.textArea, isViewMode && styles.disabledInput]}
            multiline
            value={erosionNote}
            onChangeText={setErosionNote}
            placeholder="e.g., Sheet erosion visible, rills 2-5cm deep..."
            placeholderTextColor="#94A3B8"
            editable={!isViewMode}
            textAlignVertical="top"
          />

          <View style={styles.galleryContent}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {erosionImages.map((img) => (
                <View key={img.image_id} style={styles.thumbWrapper}>
                  <TouchableOpacity
                    onPress={() => setPreviewImage(getImageUrl(img.url))}
                    activeOpacity={0.85}
                  >
                    <Image
                      source={{ uri: getImageUrl(img.url) }}
                      style={styles.thumb}
                      resizeMode="cover"
                    />
                    <View style={styles.thumbOverlay}>
                      <Ionicons name="eye-outline" size={14} color="#fff" />
                    </View>
                    {img.latitude != null && img.longitude != null && (
                      <View style={styles.thumbCoords}>
                        <Text style={styles.thumbCoordsText}>
                          {typeof img.latitude === "number"
                            ? img.latitude.toFixed(4)
                            : img.latitude}
                          ,
                          {typeof img.longitude === "number"
                            ? img.longitude.toFixed(4)
                            : img.longitude}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  {img.description ? (
                    <Text style={styles.thumbNote} numberOfLines={1}>
                      {img.description}
                    </Text>
                  ) : (
                    <Text
                      style={[
                        styles.thumbNote,
                        { color: "#94A3B8", fontStyle: "italic" },
                      ]}
                    >
                      No note
                    </Text>
                  )}
                  {!isViewMode && (
                    <TouchableOpacity
                      style={styles.deletePhotoBtn}
                      onPress={() => handleDeleteImage(img, "erosion")}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Ionicons name="close" size={11} color="#fff" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}

              {!isViewMode && (
                <TouchableOpacity
                  style={[styles.addPhotoBtn, styles.addPhotoBtnGPS]}
                  onPress={() => openGeocamForCategory("erosion")}
                  activeOpacity={0.75}
                >
                  <Ionicons name="camera-outline" size={26} color="#B91C1C" />
                  <Text style={[styles.addPhotoBtnText, { color: "#B91C1C" }]}>
                    Add Photo
                  </Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>

          {renderLocalImages("erosion")}
        </SectionCard>

        {/* SECTION 4: Other Observation */}
        <SectionCard
          title="Other Observation"
          subtitle={`${otherImages.length + localImages.filter(i => i.subLayerCode === "other").length} GPS photo${(otherImages.length + localImages.filter(i => i.subLayerCode === "other").length) !== 1 ? "s" : ""}`}
          iconName="information-circle-outline"
          iconLib="ion"
          accentColor="#6D28D9"
          step={4}
        >
          <FieldLabel label="Overall Note" />
          <TextInput
            style={[styles.textArea, isViewMode && styles.disabledInput]}
            multiline
            value={otherNote}
            onChangeText={setOtherNote}
            placeholder="e.g., Other safety hazards observed..."
            placeholderTextColor="#94A3B8"
            editable={!isViewMode}
            textAlignVertical="top"
          />

          <View style={styles.galleryContent}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {otherImages.map((img) => (
                <View key={img.image_id} style={styles.thumbWrapper}>
                  <TouchableOpacity
                    onPress={() => setPreviewImage(getImageUrl(img.url))}
                    activeOpacity={0.85}
                  >
                    <Image
                      source={{ uri: getImageUrl(img.url) }}
                      style={styles.thumb}
                      resizeMode="cover"
                    />
                    <View style={styles.thumbOverlay}>
                      <Ionicons name="eye-outline" size={14} color="#fff" />
                    </View>
                    {img.latitude != null && img.longitude != null && (
                      <View style={styles.thumbCoords}>
                        <Text style={styles.thumbCoordsText}>
                          {typeof img.latitude === "number"
                            ? img.latitude.toFixed(4)
                            : img.latitude}
                          ,
                          {typeof img.longitude === "number"
                            ? img.longitude.toFixed(4)
                            : img.longitude}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  {img.description ? (
                    <Text style={styles.thumbNote} numberOfLines={1}>
                      {img.description}
                    </Text>
                  ) : (
                    <Text
                      style={[
                        styles.thumbNote,
                        { color: "#94A3B8", fontStyle: "italic" },
                      ]}
                    >
                      No note
                    </Text>
                  )}
                  {!isViewMode && (
                    <TouchableOpacity
                      style={styles.deletePhotoBtn}
                      onPress={() => handleDeleteImage(img, "other")}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Ionicons name="close" size={11} color="#fff" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}

              {!isViewMode && (
                <TouchableOpacity
                  style={[styles.addPhotoBtn, styles.addPhotoBtnGPS]}
                  onPress={() => openGeocamForCategory("other")}
                  activeOpacity={0.75}
                >
                  <Ionicons name="camera-outline" size={26} color="#6D28D9" />
                  <Text style={[styles.addPhotoBtnText, { color: "#6D28D9" }]}>
                    Add Photo
                  </Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>

          {renderLocalImages("other")}
        </SectionCard>

        {/* SECTION 5: Assessment Location */}
        <SectionCard
          title="Assessment Location"
          subtitle="GPS position during assessment"
          iconName="locate-outline"
          iconLib="ion"
          accentColor="#0F4A2F"
          step={5}
        >
          <View style={styles.coordRow}>
            <View style={styles.coordHalf}>
              <FieldLabel label="Latitude" optional />
              <View
                style={[styles.inputRow, isViewMode && styles.disabledInput]}
              >
                <Ionicons name="navigate-outline" size={13} color="#94A3B8" />
                <TextInput
                  style={styles.inputField}
                  keyboardType="decimal-pad"
                  value={locationLat}
                  onChangeText={setLocationLat}
                  placeholder="e.g., 11.0"
                  placeholderTextColor="#94A3B8"
                  editable={!isViewMode}
                />
              </View>
            </View>
            <View style={styles.coordHalf}>
              <FieldLabel label="Longitude" optional />
              <View
                style={[styles.inputRow, isViewMode && styles.disabledInput]}
              >
                <Ionicons name="navigate-outline" size={13} color="#94A3B8" />
                <TextInput
                  style={styles.inputField}
                  keyboardType="decimal-pad"
                  value={locationLng}
                  onChangeText={setLocationLng}
                  placeholder="e.g., 124.6"
                  placeholderTextColor="#94A3B8"
                  editable={!isViewMode}
                />
              </View>
            </View>
          </View>
          <FieldLabel label="GPS Accuracy (meters)" optional />
          <View style={[styles.inputRow, isViewMode && styles.disabledInput]}>
            <MaterialCommunityIcons
              name="signal-distance-variant"
              size={15}
              color="#94A3B8"
            />
            <TextInput
              style={styles.inputField}
              keyboardType="numeric"
              value={locationAccuracy}
              onChangeText={setLocationAccuracy}
              placeholder="e.g., 3.5"
              placeholderTextColor="#94A3B8"
              editable={!isViewMode}
            />
          </View>
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
                  <Text style={styles.gpsBtnText}>Acquiring GPS…</Text>
                </>
              ) : (
                <>
                  <MaterialCommunityIcons
                    name="crosshairs-gps"
                    size={16}
                    color="#fff"
                  />
                  <Text style={styles.gpsBtnText}>Use Current Location</Text>
                </>
              )}
            </TouchableOpacity>
          )}
          {locationLat !== "" && locationLng !== "" && (
            <View style={styles.coordPreview}>
              <Ionicons name="location" size={13} color="#0F4A2F" />
              <Text style={styles.coordPreviewText}>
                {locationLat}, {locationLng}
                {locationAccuracy ? `  ±${locationAccuracy}m` : ""}
              </Text>
            </View>
          )}
        </SectionCard>

        {/* SECTION 6: Overall Safety Notes */}
        <SectionCard
          title="Overall Safety Assessment"
          subtitle="General summary and remarks"
          iconName="document-text-outline"
          iconLib="ion"
          accentColor="#0F766E"
          step={6}
        >
          <FieldLabel label="Overall Notes" />
          <TextInput
            style={[styles.textArea, isViewMode && styles.disabledInput]}
            multiline
            value={overallSafetyNote}
            onChangeText={setOverallSafetyNote}
            placeholder="General observations on site safety, hazards, and recommendations..."
            placeholderTextColor="#94A3B8"
            editable={!isViewMode}
            textAlignVertical="top"
          />
        </SectionCard>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Fixed Footer */}
      {!isViewMode && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.footerBtn, styles.footerBtnDraft]}
            onPress={handleDraft}
            disabled={saving || uploading}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name="content-save-outline"
              size={16}
              color="#0F4A2F"
            />
            <Text style={styles.footerBtnDraftText}>Save Draft</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.footerBtn,
              styles.footerBtnSubmit,
              (saving || uploading) && styles.footerBtnDisabled,
            ]}
            onPress={handleSubmit}
            disabled={saving || uploading}
            activeOpacity={0.8}
          >
            {saving || uploading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="send-outline" size={16} color="#fff" />
                <Text style={styles.footerBtnSubmitText}>Submit</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Full Screen Image Preview */}
      <Modal visible={!!previewImage} transparent animationType="fade">
        <View style={styles.previewModal}>
          <TouchableOpacity
            style={styles.previewClose}
            onPress={() => setPreviewImage(null)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <View style={styles.previewCloseBg}>
              <Ionicons name="close" size={20} color="#fff" />
            </View>
          </TouchableOpacity>
          <Image
            source={{ uri: previewImage ?? undefined }}
            style={styles.previewImage}
            resizeMode="contain"
          />
        </View>
      </Modal>

      {/* GPS Camera Modal */}
      <Modal
        visible={showGPSCamera}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowGPSCamera(false)}
      >
        <SimpleGeocam
          onCapture={handleGPSPhotoCaptured}
          onClose={() => {
            setShowGPSCamera(false);
            setActiveCategory(null);
          }}
        />
      </Modal>

      {/* Custom Note Modal */}
      <Modal
        visible={showNoteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNoteModal(false)}
      >
        <View style={modalStyles.overlay}>
          <View style={modalStyles.modal}>
            <Text style={modalStyles.title}>Add Note for This Photo</Text>
            <Text style={modalStyles.subtitle}>
              Describe this observation (optional)
            </Text>

            <TextInput
              style={modalStyles.input}
              placeholder="e.g., Water line at 80cm on tree trunk"
              placeholderTextColor="#9CA3AF"
              value={pendingNote}
              onChangeText={setPendingNote}
              autoFocus
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <View style={modalStyles.buttons}>
              <TouchableOpacity
                style={modalStyles.cancelBtn}
                onPress={() => {
                  setShowNoteModal(false);
                  setPendingPhoto(null);
                  setPendingNote("");
                  setActiveCategory(null);
                }}
              >
                <Text style={modalStyles.cancelBtnText}>Skip</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={modalStyles.saveBtn}
                onPress={() => handleNoteSubmit(pendingNote)}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={modalStyles.saveBtnText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─────────────────────────────────────────────
// CUSTOM MODAL STYLES
// ─────────────────────────────────────────────

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modal: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    width: "100%",
    maxWidth: 400,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F2D1C",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 16,
  },
  input: {
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
    fontSize: 14,
    color: "#1E293B",
    minHeight: 80,
    marginBottom: 20,
  },
  buttons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  cancelBtnText: {
    color: "#6B7280",
    fontWeight: "600",
    fontSize: 14,
  },
  saveBtn: {
    backgroundColor: "#0F4A2F",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  saveBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
});

// ─────────────────────────────────────────────
// FORM STYLES
// ─────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F1F5F9" },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
  },
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
  cardAccent: { width: 4, borderTopLeftRadius: 14, borderBottomLeftRadius: 14 },
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
  cardSubtitle: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 1,
    fontWeight: "500",
  },
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
  fieldLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  fieldLabel: { fontSize: 12, fontWeight: "600", color: "#64748B" },
  optionalTag: {
    fontSize: 10,
    color: "#94A3B8",
    fontWeight: "500",
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inputField: { flex: 1, fontSize: 14, color: "#1E293B", padding: 0 },
  textArea: {
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
    fontSize: 14,
    color: "#1E293B",
    minHeight: 90,
  },
  disabledInput: {
    backgroundColor: "#F1F5F9",
    borderColor: "#E2E8F0",
    opacity: 0.7,
  },
  coordRow: { flexDirection: "row", gap: 10 },
  coordHalf: { flex: 1 },
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
  coordPreviewText: {
    fontSize: 12,
    color: "#166534",
    fontWeight: "600",
    flex: 1,
  },
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
  gpsBtnLoading: { opacity: 0.8 },
  gpsBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  galleryContent: { paddingVertical: 4 },
  thumbWrapper: { position: "relative", width: 90, marginRight: 10 },
  thumb: {
    width: 90,
    height: 90,
    borderRadius: 10,
    backgroundColor: "#E2E8F0",
  },
  thumbOverlay: {
    position: "absolute",
    bottom: 28,
    left: 0,
    right: 0,
    height: 28,
    backgroundColor: "rgba(0,0,0,0.35)",
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  thumbCoords: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
  },
  thumbCoordsText: {
    fontSize: 9,
    color: "#4ADE80",
    fontWeight: "600",
    textAlign: "center",
  },
  thumbNote: {
    fontSize: 9,
    color: "#64748B",
    textAlign: "center",
    marginTop: 4,
    paddingHorizontal: 2,
  },
  deletePhotoBtn: {
    position: "absolute",
    top: -5,
    right: -5,
    backgroundColor: "#EF4444",
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#fff",
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
    gap: 4,
    backgroundColor: "#F0F9FF",
  },
  addPhotoBtnGPS: { borderColor: "#BBF7D0", backgroundColor: "#F0FDF4" },
  addPhotoBtnText: { fontSize: 10, color: "#0369A1", fontWeight: "600" },
  // ✅ NEW: Local images section styles
  localImagesSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F59E0B",
    borderStyle: "dashed",
  },
  localImagesLabel: {
    fontSize: 11,
    color: "#F59E0B",
    fontWeight: "700",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
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
    borderTopColor: "#E2E8F0",
    flexDirection: "row",
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
  },
  footerBtn: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  footerBtnDraft: {
    borderWidth: 1.5,
    borderColor: "#0F4A2F",
    backgroundColor: "#fff",
  },
  footerBtnDraftText: { color: "#0F4A2F", fontWeight: "700", fontSize: 14 },
  footerBtnSubmit: { backgroundColor: "#0F4A2F" },
  footerBtnSubmitText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  footerBtnDisabled: { opacity: 0.65 },
  previewModal: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    justifyContent: "center",
    alignItems: "center",
  },
  previewClose: { position: "absolute", top: 48, right: 20, zIndex: 10 },
  previewCloseBg: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 20,
    padding: 10,
  },
  previewImage: { width: "100%", height: "80%" },
});