import React, { useState, useEffect, useRef } from "react";
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
  FileText,
  ImagePlus,
  X,
  Save,
  Send,
  Check,
  Target,
  Ruler,
  ShieldCheck,
  Droplets,
  Mountain,
  Camera as CameraIcon,
  RotateCcw,
} from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import MapView, { Marker } from "react-native-maps";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImageManipulator from "expo-image-manipulator";
import * as SecureStore from "expo-secure-store";

import { useFieldAssessment } from "@/hooks/useFieldAssessment";
import { api } from "@/constants/url_fixed";

const API_BASE = `${api}/api`;

// ─────────────────────────────────────────────
// Constants & Options (Single-select for "Other")
// ─────────────────────────────────────────────
const MARKER_STATUS_OPTIONS = [
  "all_intact",
  "some_missing",
  "none_visible",
  "replaced_temporarily",
  "other",
];

const ENCROACHMENT_TYPES = [
  "residential_structure",
  "agricultural_clearing",
  "livestock_grazing",
  "illegal_logging",
  "none",
  "other",
];

// ─────────────────────────────────────────────
// GPS Camera Component (Inline - Same File)
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

function GPSStampCamera({
  onImageCaptured,
  onClose,
}: {
  onImageCaptured: (uri: string, location: LocationData) => void;
  onClose: () => void;
}) {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [locationPermission, requestLocationPermission] =
    Location.useForegroundPermissions();
  const [capturing, setCapturing] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(
    null
  );
  const [showMap, setShowMap] = useState(false);
  const [processing, setProcessing] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const getCurrentLocation = async () => {
    try {
      if (!locationPermission?.granted) {
        const status = await requestLocationPermission();
        if (!status?.granted) {
          Alert.alert("Permission Denied", "Location access is required");
          return null;
        }
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });

      const addresses = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      const address = addresses[0];

      const locData: LocationData = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        address: address?.street || "",
        city: address?.city || address?.region || "",
        barangay: address?.subregion || address?.district || "",
        timestamp: new Date().toLocaleString("en-PH", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
        accuracy: location.coords.accuracy,
      };

      setCurrentLocation(locData);
      return locData;
    } catch (error) {
      console.error("Location error:", error);
      Alert.alert("Error", "Could not get location");
      return null;
    }
  };

  useEffect(() => {
    getCurrentLocation();
  }, []);

  const stampCoordinatesOnImage = async (
    imageUri: string,
    location: LocationData
  ) => {
    try {
      const locationText = location.city || location.barangay || "Unknown";
      const coordsText = `Lat: ${location.latitude.toFixed(6)}° Long: ${location.longitude.toFixed(6)}°`;
      const timestampText = location.timestamp;
      const accuracyText = location.accuracy
        ? `±${Math.round(location.accuracy)}m`
        : "";

      const manipulatedImage = await ImageManipulator.manipulateAsync(
        imageUri,
        [],
        {
          compress: 0.9,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );

      return {
        uri: manipulatedImage.uri,
        locationText,
        coordsText,
        timestampText,
        accuracyText,
      };
    } catch (error) {
      console.error("Image manipulation error:", error);
      return {
        uri: imageUri,
        locationText: location.city || "Unknown",
        coordsText: `Lat: ${location.latitude.toFixed(6)}° Long: ${location.longitude.toFixed(6)}°`,
        timestampText: location.timestamp,
        accuracyText: "",
      };
    }
  };

  const takePicture = async () => {
    if (!cameraRef.current) return;

    setCapturing(true);
    try {
      let locData = currentLocation;
      if (!locData) {
        Alert.alert(
          "Getting Location",
          "Please wait while we get your GPS coordinates..."
        );
        locData = await getCurrentLocation();
      }

      if (!locData) {
        Alert.alert(
          "Location Required",
          "GPS coordinates are required to capture photos"
        );
        setCapturing(false);
        return;
      }

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        base64: false,
        exif: true,
      });

      if (!photo?.uri) {
        Alert.alert("Error", "Failed to capture photo");
        setCapturing(false);
        return;
      }

      setProcessing(true);
      const stampedImage = await stampCoordinatesOnImage(photo.uri, locData);

      Alert.alert(
        "Photo Captured",
        `${stampedImage.locationText}\n${stampedImage.coordsText}`,
        [
          {
            text: "Retake",
            style: "cancel",
            onPress: () => {},
          },
          {
            text: "Use Photo",
            onPress: () => {
              onImageCaptured(stampedImage.uri, locData);
            },
          },
        ]
      );
    } catch (error) {
      console.error("Capture error:", error);
      Alert.alert("Error", "Failed to capture photo");
    } finally {
      setCapturing(false);
      setProcessing(false);
    }
  };

  if (!cameraPermission || !locationPermission) {
    return (
      <View style={gpsStyles.centerContent}>
        <ActivityIndicator size="large" color="#0F4A2F" />
        <Text style={gpsStyles.permissionText}>Requesting permissions...</Text>
      </View>
    );
  }

  if (!cameraPermission.granted || !locationPermission.granted) {
    return (
      <View style={gpsStyles.centerContent}>
        <CameraIcon size={48} color="#64748b" />
        <Text style={gpsStyles.permissionText}>
          Camera and Location permissions required
        </Text>
        <TouchableOpacity
          style={gpsStyles.permissionBtn}
          onPress={() => {
            requestCameraPermission();
            requestLocationPermission();
          }}
        >
          <Text style={gpsStyles.permissionBtnText}>Grant Permissions</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={gpsStyles.closeBtnSimple}
          onPress={onClose}
        >
          <Text style={gpsStyles.closeBtnText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={gpsStyles.container}>
      <CameraView ref={cameraRef} style={gpsStyles.camera} facing="back">
        {/* Top Bar */}
        <View style={gpsStyles.topBar}>
          <TouchableOpacity
            style={gpsStyles.closeButton}
            onPress={onClose}
          >
            <X size={24} color="#fff" />
          </TouchableOpacity>

          {currentLocation && (
            <TouchableOpacity
              style={gpsStyles.locationBadge}
              onPress={() => setShowMap(true)}
              activeOpacity={0.7}
            >
              <MapPin size={14} color="#0F4A2F" />
              <Text style={gpsStyles.locationBadgeText} numberOfLines={1}>
                {currentLocation.city ||
                  currentLocation.barangay ||
                  "Getting location..."}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={gpsStyles.refreshLocationBtn}
            onPress={getCurrentLocation}
          >
            <RotateCcw size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* GPS Info Overlay */}
        {currentLocation && (
          <View style={gpsStyles.gpsOverlay}>
            <View style={gpsStyles.gpsHeader}>
              <MapPin size={16} color="#EF4444" />
              <Text style={gpsStyles.gpsLocationText} numberOfLines={1}>
                {currentLocation.barangay
                  ? `${currentLocation.barangay}, ${currentLocation.city}`
                  : currentLocation.city || "Unknown Location"}
              </Text>
            </View>
            <Text style={gpsStyles.gpsCoordsText}>
              {currentLocation.latitude.toFixed(6)}°,{" "}
              {currentLocation.longitude.toFixed(6)}°
            </Text>
            <Text style={gpsStyles.gpsTimeText}>{currentLocation.timestamp}</Text>
            {currentLocation.accuracy && (
              <Text style={gpsStyles.gpsAccuracyText}>
                Accuracy: ±{Math.round(currentLocation.accuracy)}m
              </Text>
            )}
          </View>
        )}

        {/* Capture Button */}
        <View style={gpsStyles.captureContainer}>
          <TouchableOpacity
            style={gpsStyles.captureButton}
            onPress={takePicture}
            disabled={capturing || processing}
            activeOpacity={0.8}
          >
            {capturing || processing ? (
              <ActivityIndicator color="#0F4A2F" size="large" />
            ) : (
              <View style={gpsStyles.captureButtonInner}>
                <CameraIcon size={32} color="#0F4A2F" />
              </View>
            )}
          </TouchableOpacity>
          <Text style={gpsStyles.captureHint}>
            {currentLocation ? "Tap to capture with GPS" : "Getting GPS..."}
          </Text>
        </View>
      </CameraView>

      {/* Map Modal */}
      <Modal
        visible={showMap}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowMap(false)}
      >
        <View style={gpsStyles.mapModalContainer}>
          <View style={gpsStyles.mapModalContent}>
            <View style={gpsStyles.mapHeader}>
              <Text style={gpsStyles.mapTitle}>Your Location</Text>
              <TouchableOpacity onPress={() => setShowMap(false)}>
                <X size={24} color="#0F4A2F" />
              </TouchableOpacity>
            </View>

            {currentLocation ? (
              <>
                <MapView
                  style={gpsStyles.map}
                  initialRegion={{
                    latitude: currentLocation.latitude,
                    longitude: currentLocation.longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                  }}
                  showsUserLocation={true}
                  showsMyLocationButton={true}
                >
                  <Marker
                    coordinate={{
                      latitude: currentLocation.latitude,
                      longitude: currentLocation.longitude,
                    }}
                    title={currentLocation.city || "Current Location"}
                    description={
                      currentLocation.barangay
                        ? `${currentLocation.barangay}, ${currentLocation.city}`
                        : currentLocation.address
                    }
                  />
                </MapView>

                <View style={gpsStyles.mapInfo}>
                  <View style={gpsStyles.mapInfoRow}>
                    <Text style={gpsStyles.mapInfoLabel}>📍 Coordinates:</Text>
                    <Text style={gpsStyles.mapInfoValue}>
                      {currentLocation.latitude.toFixed(6)}°,{" "}
                      {currentLocation.longitude.toFixed(6)}°
                    </Text>
                  </View>
                  <View style={gpsStyles.mapInfoRow}>
                    <Text style={gpsStyles.mapInfoLabel}>🏛️ Location:</Text>
                    <Text style={gpsStyles.mapInfoValue}>
                      {currentLocation.barangay &&
                        `${currentLocation.barangay}, `}
                      {currentLocation.city}
                    </Text>
                  </View>
                  <View style={gpsStyles.mapInfoRow}>
                    <Text style={gpsStyles.mapInfoLabel}>⏰ Time:</Text>
                    <Text style={gpsStyles.mapInfoValue}>
                      {currentLocation.timestamp}
                    </Text>
                  </View>
                  {currentLocation.accuracy && (
                    <View style={gpsStyles.mapInfoRow}>
                      <Text style={gpsStyles.mapInfoLabel}>📡 Accuracy:</Text>
                      <Text style={gpsStyles.mapInfoValue}>
                        ±{Math.round(currentLocation.accuracy)} meters
                      </Text>
                    </View>
                  )}
                </View>
              </>
            ) : (
              <View style={gpsStyles.centerContent}>
                <ActivityIndicator size="large" color="#0F4A2F" />
                <Text style={{ marginTop: 10, color: "#64748b" }}>
                  Loading map...
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Processing Indicator */}
      {processing && (
        <View style={gpsStyles.processingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={gpsStyles.processingText}>Adding GPS stamp...</Text>
        </View>
      )}
    </View>
  );
}

const gpsStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#F8FAFC",
  },
  permissionText: {
    fontSize: 16,
    textAlign: "center",
    marginTop: 16,
    marginBottom: 24,
    color: "#475569",
    lineHeight: 24,
  },
  permissionBtn: {
    backgroundColor: "#0F4A2F",
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    marginBottom: 12,
  },
  permissionBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
  closeBtnSimple: { paddingVertical: 10, paddingHorizontal: 24 },
  closeBtnText: { color: "#64748b", fontWeight: "600", fontSize: 14 },
  camera: { flex: 1 },
  topBar: {
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
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  locationBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    maxWidth: "60%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  locationBadgeText: {
    color: "#0F4A2F",
    fontWeight: "600",
    fontSize: 13,
    marginLeft: 6,
  },
  refreshLocationBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(15, 74, 47, 0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  gpsOverlay: {
    position: "absolute",
    bottom: 120,
    left: 16,
    right: 16,
    backgroundColor: "rgba(0,0,0,0.85)",
    borderRadius: 12,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  gpsHeader: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  gpsLocationText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    marginLeft: 6,
    flex: 1,
  },
  gpsCoordsText: {
    color: "#10b981",
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "monospace",
    marginBottom: 4,
  },
  gpsTimeText: { color: "#94a3b8", fontSize: 11, marginBottom: 2 },
  gpsAccuracyText: { color: "#64748b", fontSize: 10, fontStyle: "italic" },
  captureContainer: {
    position: "absolute",
    bottom: 30,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 5,
    borderColor: "rgba(255,255,255,0.3)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  captureHint: {
    color: "#fff",
    fontSize: 13,
    marginTop: 12,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  mapModalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "flex-end",
  },
  mapModalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
    paddingBottom: 20,
  },
  mapHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  mapTitle: { fontSize: 18, fontWeight: "700", color: "#0F4A2F" },
  map: { width: "100%", height: 300 },
  mapInfo: {
    padding: 16,
    backgroundColor: "#F8FAFC",
    margin: 16,
    borderRadius: 12,
  },
  mapInfoRow: { flexDirection: "row", marginBottom: 8, flexWrap: "wrap" },
  mapInfoLabel: {
    fontWeight: "600",
    color: "#475569",
    fontSize: 13,
    marginRight: 8,
    minWidth: 100,
  },
  mapInfoValue: { color: "#0F4A2F", fontSize: 13, flex: 1 },
  processingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
  },
  processingText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginTop: 12,
  },
});

// ─────────────────────────────────────────────
// Main Form Component
// ─────────────────────────────────────────────
export default function BoundaryVerificationForm() {
  const params = useLocalSearchParams();
  const areaId = params.areaId as string;
  const assessmentId = params.assessmentId as string | undefined;
  const layerId = "boundary_verification";
  const router = useRouter();

  const { saving, handleSave, uploadImage, deleteImage, fetchAssessmentData } =
    useFieldAssessment(areaId, layerId, assessmentId);

  // ─────────────────────────────────────────────
  // State: Form Fields
  // ─────────────────────────────────────────────
  const [markersStatus, setMarkersStatus] = useState("");
  const [deviationMeters, setDeviationMeters] = useState("");
  const [withinRiparian, setWithinRiparian] = useState(false);
  const [encroachmentDetected, setEncroachmentDetected] = useState(false);
  const [encroachmentType, setEncroachmentType] = useState("none");
  const [slopeBoundaryCheck, setSlopeBoundaryCheck] = useState(false);

  const [boundaryLat, setBoundaryLat] = useState("");
  const [boundaryLng, setBoundaryLng] = useState("");
  const [markerName, setMarkerName] = useState("");
  const [boundaryNotes, setBoundaryNotes] = useState("");

  const [locationLat, setLocationLat] = useState("");
  const [locationLng, setLocationLng] = useState("");
  const [locationAccuracy, setLocationAccuracy] = useState("");
  const [gettingLocation, setGettingLocation] = useState(false);

  // State: UI
  const [images, setImages] = useState<any[]>([]);
  const [isViewMode, setIsViewMode] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!assessmentId);

  // ✅ NEW: GPS Camera State
  const [showGPSCamera, setShowGPSCamera] = useState(false);

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
    setMarkersStatus(data.boundary_markers_status || "");
    setDeviationMeters(data.boundary_deviation_meters?.toString() || "");
    setWithinRiparian(data.within_riparian_buffer_20m || false);
    setEncroachmentDetected(data.encroachment_detected || false);
    setEncroachmentType(data.encroachment_type || "none");
    setSlopeBoundaryCheck(data.slope_boundary_check || false);
    setBoundaryNotes(data.boundary_notes || "");

    if (
      Array.isArray(data.boundary_coordinates_feedback) &&
      data.boundary_coordinates_feedback.length > 0
    ) {
      const first = data.boundary_coordinates_feedback[0];
      setBoundaryLat(first.latitude?.toString() || "");
      setBoundaryLng(first.longitude?.toString() || "");
      setMarkerName(first.marker_name || "");
    }

    if (data.location) {
      setLocationLat(data.location.latitude?.toString() || "");
      setLocationLng(data.location.longitude?.toString() || "");
      setLocationAccuracy(
        data.location.gps_accuracy_meters?.toString() || ""
      );
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

  // ✅ NEW: Handle GPS Photo Capture
  const handleGPSPhotoCaptured = async (uri: string, location: LocationData) => {
    setShowGPSCamera(false);

    if (!assessmentId) {
      Alert.alert(
        "Action Required",
        "Please save the draft first to get an ID for image uploads."
      );
      return;
    }

    try {
      // Create FormData for upload
      const formData = new FormData();
      formData.append("image", {
        uri: Platform.OS === "ios" ? uri.replace("file://", "") : uri,
        name: `gps_photo_${Date.now()}.jpg`,
        type: "image/jpeg",
      } as any);
      formData.append("assessment_id", assessmentId);
      formData.append("layer", layerId);
      formData.append("gps_data", JSON.stringify(location));

      // Upload using existing hook
      const token = await SecureStore.getItemAsync("token");
      const response = await fetch(`${API_BASE}/upload_assessment_image/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        // Re-fetch to update gallery
        const data = await fetchAssessmentData();
        if (data) setImages(data.images || []);
        Alert.alert("Success", "GPS-stamped photo uploaded!");
      } else {
        Alert.alert("Upload Failed", result.error || "Please try again");
      }
    } catch (error) {
      console.error("Upload error:", error);
      Alert.alert("Error", "Failed to upload photo");
    }
  };

  // ─────────────────────────────────────────────
  // Handlers: Form Logic
  // ─────────────────────────────────────────────
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

    const boundaryCoordinatesFeedback =
      boundaryLat && boundaryLng
        ? [
            {
              latitude: parseFloat(boundaryLat),
              longitude: parseFloat(boundaryLng),
              marker_name: markerName || null,
              confidence: "high",
              notes: boundaryNotes || null,
            },
          ]
        : null;

    return {
      layer: "boundary_verification",
      boundary_markers_status: markersStatus || null,
      boundary_deviation_meters: deviationMeters
        ? parseFloat(deviationMeters)
        : null,
      within_riparian_buffer_20m: withinRiparian,
      encroachment_detected: encroachmentDetected,
      encroachment_type: encroachmentType || null,
      slope_boundary_check: slopeBoundaryCheck,
      boundary_coordinates_feedback: boundaryCoordinatesFeedback,
      boundary_notes: boundaryNotes || null,
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

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.centerContent}>
        <ActivityIndicator size="large" color="#0F4A2F" />
        <Text style={{ marginTop: 10 }}>Loading Boundary Verification...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* SECTION 1: Boundary Markers */}
        <SectionCard
          title="Boundary Markers"
          icon={<MapPin size={20} color="#0F4A2F" />}
        >
          <Text style={styles.label}>Marker Status</Text>
          <View style={styles.chipContainer}>
            {MARKER_STATUS_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[
                  styles.chip,
                  markersStatus === opt && styles.chipActive,
                ]}
                onPress={() => !isViewMode && setMarkersStatus(opt)}
                disabled={isViewMode}
              >
                {markersStatus === opt && (
                  <Check size={14} color="#fff" style={{ marginRight: 4 }} />
                )}
                <Text
                  style={[
                    styles.chipText,
                    markersStatus === opt && styles.chipTextActive,
                  ]}
                >
                  {opt.replace(/_/g, " ")}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {markersStatus === "other" && (
            <TextInput
              style={styles.textArea}
              multiline
              value={boundaryNotes}
              onChangeText={setBoundaryNotes}
              placeholder="Describe marker condition observed..."
              editable={!isViewMode}
            />
          )}
          <Text style={styles.label}>
            Deviation from Planned Polygon (meters)
          </Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={deviationMeters}
            onChangeText={setDeviationMeters}
            placeholder="e.g., 2.5"
            editable={!isViewMode}
          />
        </SectionCard>

        {/* SECTION 2: Spatial Compliance */}
        <SectionCard
          title="Spatial Compliance"
          icon={<ShieldCheck size={20} color="#0F4A2F" />}
        >
          <View style={styles.rowBetween}>
            <Text style={styles.label}>Within 20m Riparian Buffer?</Text>
            <Switch
              value={withinRiparian}
              onValueChange={(val) => !isViewMode && setWithinRiparian(val)}
              disabled={isViewMode}
              trackColor={{ false: "#cbd5e1", true: "#0F4A2F" }}
            />
          </View>
          <View style={styles.rowBetween}>
            <Text style={styles.label}>Encroachment Detected?</Text>
            <Switch
              value={encroachmentDetected}
              onValueChange={(val: any) =>
                !isViewMode && setEncroachmentDetected(val)
              }
              disabled={isViewMode}
              trackColor={{ false: "#cbd5e1", true: "#0F4A2F" }}
            />
          </View>

          {encroachmentDetected && (
            <>
              <Text style={styles.label}>Encroachment Type</Text>
              <View style={styles.chipContainer}>
                {ENCROACHMENT_TYPES.map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[
                      styles.chip,
                      encroachmentType === opt && styles.chipActive,
                    ]}
                    onPress={() => !isViewMode && setEncroachmentType(opt)}
                    disabled={isViewMode}
                  >
                    {encroachmentType === opt && (
                      <Check size={14} color="#fff" style={{ marginRight: 4 }} />
                    )}
                    <Text
                      style={[
                        styles.chipText,
                        encroachmentType === opt && styles.chipTextActive,
                      ]}
                    >
                      {opt.replace(/_/g, " ")}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {encroachmentType === "other" && (
                <TextInput
                  style={styles.textArea}
                  multiline
                  value={boundaryNotes}
                  onChangeText={setBoundaryNotes}
                  placeholder="Describe encroachment type observed..."
                  editable={!isViewMode}
                />
              )}
            </>
          )}
          <View style={styles.rowBetween}>
            <Text style={styles.label}>Boundary crosses &gt;30° slope?</Text>
            <Switch
              value={slopeBoundaryCheck}
              onValueChange={(val) => !isViewMode && setSlopeBoundaryCheck(val)}
              disabled={isViewMode}
              trackColor={{ false: "#cbd5e1", true: "#0F4A2F" }}
            />
          </View>
        </SectionCard>

        {/* SECTION 3: Boundary Coordinates Feedback */}
        <SectionCard
          title="Boundary Coordinate Feedback"
          icon={<FileText size={20} color="#0F4A2F" />}
        >
          <Text style={styles.label}>
            Enter ONE key boundary coordinate (lat/lng) + marker name:
          </Text>
          <View style={styles.rowHalf}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.label}>Latitude</Text>
              <TextInput
                style={styles.input}
                keyboardType="decimal-pad"
                value={boundaryLat}
                onChangeText={setBoundaryLat}
                placeholder="e.g., 11.0"
                editable={!isViewMode}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Longitude</Text>
              <TextInput
                style={styles.input}
                keyboardType="decimal-pad"
                value={boundaryLng}
                onChangeText={setBoundaryLng}
                placeholder="e.g., 124.6"
                editable={!isViewMode}
              />
            </View>
          </View>
          <Text style={styles.label}>Marker Name (Optional)</Text>
          <TextInput
            style={styles.input}
            value={markerName}
            onChangeText={setMarkerName}
            placeholder="e.g., BM-01_Northwest"
            editable={!isViewMode}
          />
          <Text style={styles.hint}>
            This single point helps GIS Specialist verify boundary alignment.
            Add more points in notes if needed.
          </Text>
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

        {/* SECTION 5: Map Preview (Context Only) */}
        <SectionCard
          title="Area Context Map"
          icon={<Mountain size={20} color="#0F4A2F" />}
        >
          <Text style={styles.label}>
            Approximate location for reference (not editable):
          </Text>
          <MapView
            style={styles.mapPreview}
            scrollEnabled={false}
            zoomEnabled={false}
            pitchEnabled={false}
            rotateEnabled={false}
            initialRegion={{
              latitude: locationLat ? parseFloat(locationLat) : 11.0,
              longitude: locationLng ? parseFloat(locationLng) : 124.6,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
          >
            {locationLat && locationLng && (
              <Marker
                coordinate={{
                  latitude: parseFloat(locationLat),
                  longitude: parseFloat(locationLng),
                }}
                title="Assessment Location"
              />
            )}
            {boundaryLat && boundaryLng && (
              <Marker
                coordinate={{
                  latitude: parseFloat(boundaryLat),
                  longitude: parseFloat(boundaryLng),
                }}
                title={markerName || "Boundary Point"}
                pinColor="#0F4A2F"
              />
            )}
          </MapView>
          <Text style={styles.hint}>
            Map shows approximate context. Final boundary will be drawn by GIS
            Specialist using drone imagery.
          </Text>
        </SectionCard>

        {/* SECTION 6: Boundary Notes */}
        <SectionCard
          title="Boundary Notes"
          icon={<FileText size={20} color="#0F4A2F" />}
        >
          <Text style={styles.label}>Additional Observations</Text>
          <TextInput
            style={styles.textArea}
            multiline
            value={boundaryNotes}
            onChangeText={setBoundaryNotes}
            placeholder="e.g., BM-02 wooden stake tilted ~15°. No encroachment observed along perimeter."
            editable={!isViewMode}
          />
        </SectionCard>

        {/* SECTION 7: Photo Gallery */}
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
              <>
                {/* ✅ EXISTING: Pick from Gallery */}
                <TouchableOpacity
                  style={styles.addPhotoBtn}
                  onPress={handlePickImage}
                >
                  <ImagePlus size={24} color="#64748b" />
                  <Text style={{ color: "#64748b", fontSize: 10 }}>
                    Add Photo
                  </Text>
                </TouchableOpacity>

                {/* ✅ NEW: GPS Camera Button */}
                <TouchableOpacity
                  style={[styles.addPhotoBtn, { borderColor: "#0F4A2F" }]}
                  onPress={() => setShowGPSCamera(true)}
                >
                  <CameraIcon size={24} color="#0F4A2F" />
                  <Text style={{ color: "#0F4A2F", fontSize: 10 }}>
                    GPS Photo
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
          {!isViewMode && (
            <Text style={[styles.hint, { marginTop: 8 }]}>
              • "Add Photo" = Pick from gallery{"\n"}• "GPS Photo" = Capture with
              coordinates stamped
            </Text>
          )}
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

      {/* ✅ NEW: GPS Camera Modal */}
      <Modal
        visible={showGPSCamera}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowGPSCamera(false)}
      >
        <GPSStampCamera
          onImageCaptured={handleGPSPhotoCaptured}
          onClose={() => setShowGPSCamera(false)}
        />
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

  // Map Preview
  mapPreview: {
    width: "100%",
    height: 150,
    borderRadius: 8,
    backgroundColor: "#E2E8F0",
    marginBottom: 8,
  },

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