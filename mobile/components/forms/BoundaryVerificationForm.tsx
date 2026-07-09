import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  // ❌ REMOVED: Alert
  StyleSheet,
  Image,
  ActivityIndicator,
  Modal,
  Platform,
  Dimensions,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useFieldAssessment, LocalImage } from "@/hooks/useFieldAssessment";
import {
  saveOfflineDraft,
  updateOfflineDraft,
  getOfflineDraft,
  generateLocalUUID,
  OfflineImage,
} from "@/hooks/useOfflineFieldAssessment";
import { api } from "@/constants/url_fixed";
import { useNetworkStatus } from "@/utils/networkStatus";
import FloatingMapButton from "@/components/FloatingMapButton";

// ✅ ADDED: Import the useAlert hook
import { useAlert } from "@/components/AlertContext";

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

interface BoundaryImage {
  image_id: number;
  url: string;
  layer: string;
  latitude: number | null;
  longitude: number | null;
  description: string;
  created_at: string;
}

// ─────────────────────────────────────────────
// GPS CAMERA COMPONENT (SimpleGeocam) - Two Button Version
// ─────────────────────────────────────────────

function SimpleGeocam({
  onCapture,
  onClose,
}: {
  onCapture: (
    uri: string,
    location: LocationData | null,
    withGPS: boolean,
  ) => void;
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

  // ✅ ADDED: Initialize useAlert for this sub-component
  const { warning, error: showError } = useAlert();

  const getCurrentLocation = async (): Promise<LocationData | null> => {
    try {
      if (!locationPermission?.granted) {
        const s = await requestLocationPermission();
        if (!s?.granted) {
          return null;
        }
      }

      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        return null;
      }

      let loc;
      try {
        loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
      } catch (highAccError) {
        try {
          loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
        } catch (balancedAccError) {
          loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Lowest,
          });
        }
      }

      if (!loc || !loc.coords) {
        return null;
      }

      let addr: Location.LocationGeocodedAddress | undefined;
      try {
        [addr] = await Location.reverseGeocodeAsync({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
      } catch (geoError) {
        // Silent fail
      }

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
      console.error("GPS Error:", error);
      return null;
    }
  };

  useEffect(() => {
    getCurrentLocation();
  }, []);

  const takePictureWithGPS = async () => {
    if (!cameraRef.current || capturing) return;

    const locData = currentLocation ?? (await getCurrentLocation());

    if (!locData) {
      // ✅ UPDATED
      warning(
        "GPS Required",
        "GPS coordinates are not available. Please use 'Photo Only' button or move to an area with better GPS signal.",
      );
      return;
    }

    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        base64: false,
      });
      if (!photo?.uri) {
        // ✅ UPDATED
        showError("Error", "Failed to capture photo.");
        return;
      }
      onCapture(photo.uri, locData, true);
    } catch (error) {
      // ✅ UPDATED
      showError(
        "Error",
        `Failed to capture photo: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setCapturing(false);
    }
  };

  const takePictureOnly = async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        base64: false,
      });
      if (!photo?.uri) {
        // ✅ UPDATED
        showError("Error", "Failed to capture photo.");
        return;
      }
      onCapture(photo.uri, null, false);
    } catch (error) {
      // ✅ UPDATED
      showError(
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
              : "No GPS"}
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
              {hasGPS ? "GPS Active" : "No GPS Signal"}
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
          <Text style={cam.gpsWaiting}>
            GPS unavailable - use "Photo Only" button below
          </Text>
        )}
      </View>

      {/* Two Capture Buttons */}
      <View style={cam.captureArea}>
        <View style={cam.captureButtonsRow}>
          {/* GPS Photo Button */}
          <View style={cam.captureButtonColumn}>
            <TouchableOpacity
              style={[cam.gpsCaptureRing, !hasGPS && cam.captureRingDisabled]}
              onPress={takePictureWithGPS}
              disabled={capturing || !hasGPS}
              activeOpacity={0.8}
            >
              {capturing ? (
                <ActivityIndicator color="#0F4A2F" size="large" />
              ) : (
                <View style={cam.gpsCaptureCore}>
                  <Ionicons name="location" size={20} color="#0F4A2F" />
                </View>
              )}
            </TouchableOpacity>
            <Text style={cam.captureHint}>
              {hasGPS ? "GPS Photo" : "GPS Unavailable"}
            </Text>
          </View>

          {/* Photo Only Button */}
          <View style={cam.captureButtonColumn}>
            <TouchableOpacity
              style={cam.photoOnlyRing}
              onPress={takePictureOnly}
              disabled={capturing}
              activeOpacity={0.8}
            >
              {capturing ? (
                <ActivityIndicator color="#FFFFFF" size="large" />
              ) : (
                <View style={cam.photoOnlyCore}>
                  <Ionicons name="camera" size={20} color="#FFFFFF" />
                </View>
              )}
            </TouchableOpacity>
            <Text style={cam.captureHint}>Photo Only</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────
// CAMERA STYLES (Unchanged)
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
    bottom: 160,
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
  captureButtonsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 32,
  },
  captureButtonColumn: {
    alignItems: "center",
    gap: 8,
  },
  // GPS Capture Ring
  gpsCaptureRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: "#4ADE80",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(74,222,128,0.15)",
    shadowColor: "#4ADE80",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  gpsCaptureCore: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },
  // Photo Only Ring
  photoOnlyRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.6)",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  photoOnlyCore: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#0F4A2F",
    justifyContent: "center",
    alignItems: "center",
  },
  // Disabled state
  captureRingDisabled: {
    opacity: 0.4,
    borderColor: "rgba(255,255,255,0.3)",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  captureHint: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 11,
    fontWeight: "600",
  },
});

// ─────────────────────────────────────────────
// FORM SUB-COMPONENTS (Unchanged)
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

export default function BoundaryVerificationForm() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const areaId = params.areaId as string;
  const assessmentId = params.assessmentId as string | undefined;
  const offlineDraftId = params.offlineDraftId as string | undefined;
  const layerId = "boundary_verification";
  const siteId = params.siteId as string | undefined;
  const isEditingOfflineDraft = !!offlineDraftId;

  // ✅ ADDED: Initialize useAlert
  const { success, error: showError, warning, confirm } = useAlert();

  const { saving, handleSave, uploadImage, deleteImage, fetchAssessmentData } =
    useFieldAssessment(areaId, layerId, assessmentId);

  const isOnline = useNetworkStatus();
  const isOfflineMode = !isOnline;

  const [overallNote, setOverallNote] = useState("");
  const [locationContext, setLocationContext] = useState("");

  const [locationLat, setLocationLat] = useState("");
  const [locationLng, setLocationLng] = useState("");
  const [locationAccuracy, setLocationAccuracy] = useState("");
  const [gettingLocation, setGettingLocation] = useState(false);

  const [images, setImages] = useState<BoundaryImage[]>([]);
  const [localImages, setLocalImages] = useState<LocalImage[]>([]);
  const [isViewMode, setIsViewMode] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(
    !!assessmentId || isEditingOfflineDraft,
  );
  const [savingOffline, setSavingOffline] = useState(false);
  const [showGPSCamera, setShowGPSCamera] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState<{
    uri: string;
    location: LocationData | null;
    withGPS: boolean;
  } | null>(null);
  const [pendingNote, setPendingNote] = useState("");
  const [uploading, setUploading] = useState(false);

  // Load existing data
  useEffect(() => {
    if (isEditingOfflineDraft) {
      loadOfflineDraftData();
    } else if (assessmentId) {
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
          setImages(data.images || []);
          setIsViewMode(!!data.is_submitted);
        }
        setLoading(false);
      })();
    } else {
      setLoading(false);
    }
  }, [assessmentId, offlineDraftId]);

  const loadOfflineDraftData = async () => {
    if (!offlineDraftId) return;

    try {
      const draft = await getOfflineDraft(offlineDraftId);
      if (!draft) {
        // ✅ UPDATED
        showError("Error", "Draft not found.");
        return;
      }

      const payload = draft.payload;

      populateForm(payload.field_assessment_data || {});

      if (payload.location) {
        setLocationLat(payload.location.latitude?.toString() || "");
        setLocationLng(payload.location.longitude?.toString() || "");
        setLocationAccuracy(
          payload.location.gps_accuracy_meters?.toString() || "",
        );
      }

      if (Array.isArray(draft.images)) {
        const loadedImages: LocalImage[] = draft.images.map((img) => ({
          id: img.id,
          uri: img.uri,
          latitude: img.latitude || 0,
          longitude: img.longitude || 0,
          accuracy: undefined,
          subLayerCode: "verification",
          description: img.description || "",
        }));
        setLocalImages(loadedImages);
      }
    } catch (e: any) {
      console.error("Error loading offline draft:", e);
      // ✅ UPDATED
      showError("Error", "Failed to load draft.");
    } finally {
      setLoading(false);
    }
  };

  const populateForm = (data: any) => {
    const bv = data?.boundary_verification || data || {};
    setOverallNote(bv?.overall_note || "");
    setLocationContext(bv?.location_context || "");
    const loc = bv?.location || data?.location || null;
    if (loc?.latitude != null && loc?.longitude != null) {
      setLocationLat(loc.latitude.toString());
      setLocationLng(loc.longitude.toString());
      setLocationAccuracy(loc.gps_accuracy_meters?.toString() || "");
    }
  };

  const handleGetCurrentLocation = async () => {
    setGettingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        // ✅ UPDATED
        warning(
          "Permission Denied",
          "Please enable location access in your device settings.",
        );
        setGettingLocation(false);
        return;
      }

      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        // ✅ UPDATED
        warning(
          "Location Services Disabled",
          "Please enable GPS/Location in your device settings.",
        );
        setGettingLocation(false);
        return;
      }

      let loc;
      try {
        loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
      } catch (highAccError) {
        console.log("High accuracy failed, trying balanced...");
        try {
          loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
        } catch (balancedAccError) {
          console.log("Balanced failed, trying lowest...");
          loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Lowest,
          });
        }
      }

      if (!loc || !loc.coords) {
        // ✅ UPDATED
        showError("Error", "Could not retrieve location data.");
        setGettingLocation(false);
        return;
      }

      setLocationLat(loc.coords.latitude.toFixed(6));
      setLocationLng(loc.coords.longitude.toFixed(6));
      setLocationAccuracy(loc.coords.accuracy?.toFixed(1) || "");

      // ✅ UPDATED
      success("Location Captured", "GPS coordinates updated.");
    } catch (error) {
      console.error("Location error:", error);
      // ✅ UPDATED
      showError(
        "GPS Error",
        "Could not get current location. Make sure GPS is enabled and you're outdoors or near a window.",
      );
    } finally {
      setGettingLocation(false);
    }
  };

  const handleGPSPhotoCaptured = async (
    uri: string,
    location: LocationData | null,
    withGPS: boolean,
  ) => {
    setShowGPSCamera(false);
    setPendingPhoto({ uri, location, withGPS });
    setPendingNote("");
    setShowNoteModal(true);
  };

  const handleNoteSubmit = async (note: string) => {
    if (!pendingPhoto) return;

    const numericAssessmentId = assessmentId ? parseInt(assessmentId) : null;
    const photoLocation = pendingPhoto.location || {
      latitude: 0,
      longitude: 0,
      timestamp: new Date().toISOString(),
    };

    if (numericAssessmentId && !isNaN(numericAssessmentId) && isOnline) {
      setUploading(true);
      try {
        const ok = await uploadImage(
          numericAssessmentId,
          {
            uri: pendingPhoto.uri,
            latitude: photoLocation.latitude,
            longitude: photoLocation.longitude,
            accuracy: photoLocation.accuracy,
          },
          {
            subLayerCode: "verification",
            description:
              note ||
              (pendingPhoto.withGPS
                ? `Boundary marker at ${photoLocation.latitude.toFixed(6)}, ${photoLocation.longitude.toFixed(6)}`
                : `Boundary marker photo (no GPS)`),
          },
        );

        if (ok) {
          const data = await fetchAssessmentData();
          if (data) {
            setImages(data.images || []);
          }
          // ✅ FIX: Removed redundant success alert. The hook already shows "Geocam image uploaded."
        }
        // ✅ FIX: Removed redundant error alerts. The hook already handles upload failures.
      } catch (error) {
        // ✅ FIX: Removed redundant error alert. The hook already handles it.
      } finally {
        setUploading(false);
      }
    } else {
      const localImg: LocalImage = {
        id: `local-${Date.now()}`,
        uri: pendingPhoto.uri,
        latitude: photoLocation.latitude,
        longitude: photoLocation.longitude,
        accuracy: photoLocation.accuracy,
        subLayerCode: "verification",
        description:
          note ||
          (pendingPhoto.withGPS
            ? `Boundary marker photo`
            : `Boundary marker photo (no GPS)`),
      };
      setLocalImages([...localImages, localImg]);

      // ✅ UPDATED
      success(
        "Photo Captured",
        pendingPhoto.withGPS
          ? "Photo will be uploaded when you save the draft."
          : "Photo saved without GPS. Will upload when you save.",
      );
    }

    setShowNoteModal(false);
    setPendingPhoto(null);
    setPendingNote("");
  };

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
      overall_note: overallNote || null,
      location_context: locationContext || null,
    };

    return {
      reforestation_area_id: areaId ? parseInt(areaId) : null,
      site_id: siteId ? parseInt(siteId) : null,
      assessment_date: new Date().toISOString().split("T")[0],
      location,
      field_assessment_data: {
        boundary_verification: layerData,
      },
    };
  };

  const handleSaveOffline = async (): Promise<string | null> => {
    setSavingOffline(true);
    try {
      const payload = buildPayload();

      const offlineImages: OfflineImage[] = localImages.map((img) => ({
        id: img.id,
        uri: img.uri,
        layerCode: "bound_verification",
        description: img.description || `Boundary marker photo`,
        latitude: img.latitude,
        longitude: img.longitude,
      }));

      if (isEditingOfflineDraft && offlineDraftId) {
        await updateOfflineDraft(offlineDraftId, {
          payload,
          images: offlineImages,
          status: "pending",
        });

        // ✅ UPDATED: Non-blocking toast + navigate back
        success(
          "Updated Offline",
          "Draft updated locally. Will sync when online.",
        );
        router.back();
        return offlineDraftId;
      }

      const localUuid = generateLocalUUID();
      const draft = {
        local_uuid: localUuid,
        area_id: parseInt(areaId),
        site_id: siteId ? parseInt(siteId) : null,
        layer: layerId,
        payload,
        images: offlineImages,
        created_at: new Date().toISOString(),
        status: "pending" as const,
      };

      await saveOfflineDraft(draft);
      setLocalImages([]);

      // ✅ UPDATED: Non-blocking toast + navigate back
      success(
        "Saved Offline",
        "Assessment saved locally. Will sync when online.",
      );
      router.back();

      return localUuid;
    } catch (e: any) {
      console.error("Error saving offline:", e);
      // ✅ UPDATED
      showError("Error", "Failed to save offline. Please try again.");
      return null;
    } finally {
      setSavingOffline(false);
    }
  };

  const handleDraft = async () => {
    const payload = buildPayload();
    const savedId = await handleSave(payload, false, localImages);

    if (savedId) {
      setLocalImages([]);
      const data = await fetchAssessmentData();
      if (data) {
        populateForm(data.field_assessment_data || {});
        setImages(data.images || []);
      }
      // ✅ FIX: Removed redundant success alert. The hook already shows "Saved".
    }
  };

  // ✅ UPDATED: Converted to use confirm() dialog
  const handleSubmit = async () => {
    confirm(
      "Submit Assessment",
      "Are you sure? You cannot edit after submission.",
      async () => {
        const savedId = await handleSave(buildPayload(), true, localImages);
        if (savedId) {
          setLocalImages([]);
          setIsViewMode(true);
        }
      },
      {
        type: "warning",
        confirmText: "Submit",
        cancelText: "Cancel",
      },
    );
  };

  // ✅ UPDATED: Converted to use confirm() dialog
  const handleDeleteImage = async (img: BoundaryImage) => {
    confirm(
      "Delete Photo",
      "Remove this photo?",
      async () => {
        await deleteImage(img.image_id);
        const d = await fetchAssessmentData();
        if (d) setImages(d.images || []);
      },
      {
        type: "error",
        confirmText: "Delete",
        cancelText: "Cancel",
      },
    );
  };

  const getImageUrl = (imgUrl: string) => {
    if (!imgUrl) return "";
    if (imgUrl.startsWith("http://") || imgUrl.startsWith("https://")) {
      return imgUrl;
    }
    return `${api}${imgUrl}`;
  };

  const renderLocalImages = () => {
    if (localImages.length === 0) return null;

    return (
      <View style={styles.localImagesSection}>
        <Text style={styles.localImagesLabel}>
          Pending Upload ({localImages.length})
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {localImages.map((img) => (
            <View key={img.id} style={styles.thumbWrapper}>
              <TouchableOpacity
                onPress={() => setPreviewImage(img.uri)}
                activeOpacity={0.85}
              >
                <Image
                  source={{ uri: img.uri }}
                  style={styles.thumb}
                  resizeMode="cover"
                />
                <View
                  style={[
                    styles.thumbOverlay,
                    { backgroundColor: "rgba(245,158,11,0.6)" },
                  ]}
                >
                  <Ionicons
                    name="cloud-upload-outline"
                    size={14}
                    color="#fff"
                  />
                </View>
                {img.latitude !== 0 && img.longitude !== 0 && (
                  <View style={styles.thumbCoords}>
                    <Text style={styles.thumbCoordsText}>
                      {img.latitude.toFixed(4)},{img.longitude.toFixed(4)}
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
                    { color: "#F59E0B", fontStyle: "italic" },
                  ]}
                >
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
          <Text style={styles.loadingText}>Loading Boundary Verification…</Text>
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
        {isOfflineMode && !isViewMode && (
          <View style={styles.offlineBanner}>
            <Ionicons name="cloud-offline-outline" size={16} color="#fff" />
            <Text style={styles.offlineBannerText}>
              Offline Mode - Save Offline to sync later
            </Text>
          </View>
        )}

        {isViewMode && (
          <View style={styles.viewModeBanner}>
            <Ionicons name="eye-outline" size={16} color="#fff" />
            <Text style={styles.viewModeBannerText}>Submitted — Read Only</Text>
          </View>
        )}

        <SectionCard
          title="Overall Assessment"
          subtitle="Summary notes for GIS Specialist"
          iconName="document-text-outline"
          iconLib="ion"
          accentColor="#0F766E"
          step={1}
        >
          <FieldLabel label="Overall Note" />
          <TextInput
            style={[styles.textArea, isViewMode && styles.disabledInput]}
            multiline
            value={overallNote}
            onChangeText={setOverallNote}
            placeholder="e.g. All boundary markers intact, minor deviation at northwest corner."
            placeholderTextColor="#94A3B8"
            editable={!isViewMode}
            textAlignVertical="top"
          />
          <FieldLabel label="Location Context" />
          <TextInput
            style={[styles.textArea, isViewMode && styles.disabledInput]}
            multiline
            value={locationContext}
            onChangeText={setLocationContext}
            placeholder="e.g. Mid-slope, 50m from creek, accessible via trail."
            placeholderTextColor="#94A3B8"
            editable={!isViewMode}
            textAlignVertical="top"
          />
        </SectionCard>

        <SectionCard
          title="Assessment Location"
          subtitle="Your GPS position during this assessment"
          iconName="locate-outline"
          iconLib="ion"
          accentColor="#0F4A2F"
          step={2}
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
                  placeholder="e.g. 11.0"
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
                  placeholder="e.g. 124.6"
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
              placeholder="e.g. 3.5"
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
          <View style={styles.hintBox}>
            <Ionicons
              name="information-circle-outline"
              size={14}
              color="#0F4A2F"
            />
            <Text style={styles.hintText}>
              Optional — leave blank if the assessment was done remotely.
            </Text>
          </View>
        </SectionCard>

        <SectionCard
          title="Boundary Markers"
          subtitle={`${images.length + localImages.length} photo${images.length + localImages.length !== 1 ? "s" : ""} · Tap to add`}
          iconName="map-marker"
          iconLib="mci"
          accentColor="#0369A1"
          step={3}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.galleryContent}
          >
            {images.map((img) => (
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

                  {img.latitude != null &&
                    img.longitude != null &&
                    img.latitude !== 0 && (
                      <View style={styles.thumbCoords}>
                        <Text style={styles.thumbCoordsText}>
                          {typeof img.latitude === "number"
                            ? img.latitude.toFixed(4)
                            : img.latitude}
                          ,{" "}
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
                    onPress={() => handleDeleteImage(img)}
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
                onPress={() => setShowGPSCamera(true)}
                activeOpacity={0.75}
              >
                <Ionicons name="camera-outline" size={26} color="#0F4A2F" />
                <Text style={[styles.addPhotoBtnText, { color: "#0F4A2F" }]}>
                  Add Photo
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>

          {renderLocalImages()}

          {images.length === 0 && localImages.length === 0 && isViewMode && (
            <Text style={styles.emptyGallery}>
              No boundary marker photos attached.
            </Text>
          )}

          {!isViewMode && (
            <View style={styles.hintBox}>
              <Ionicons
                name="information-circle-outline"
                size={14}
                color="#0369A1"
              />
              <Text style={[styles.hintText, { color: "#0369A1" }]}>
                Choose "GPS Photo" for location-tagged photos or "Photo Only"
                for photos without GPS.
              </Text>
            </View>
          )}
        </SectionCard>

        <View style={{ height: 100 }} />
      </ScrollView>

      {!isViewMode && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.footerBtn,
              styles.footerBtnOffline,
              (savingOffline || saving || uploading) &&
                styles.footerBtnDisabled,
            ]}
            onPress={handleSaveOffline}
            disabled={savingOffline || saving || uploading}
            activeOpacity={0.8}
          >
            {savingOffline ? (
              <ActivityIndicator color="#F59E0B" size="small" />
            ) : (
              <>
                <Ionicons
                  name="cloud-download-outline"
                  size={16}
                  color="#F59E0B"
                />
                <Text style={styles.footerBtnOfflineText}>
                  {isEditingOfflineDraft ? "Update Offline" : "Save Offline"}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {isOnline && (
            <TouchableOpacity
              style={[
                styles.footerBtn,
                styles.footerBtnDraft,
                (saving || uploading) && styles.footerBtnDisabled,
              ]}
              onPress={handleDraft}
              disabled={saving || uploading || savingOffline}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator color="#0F4A2F" size="small" />
              ) : (
                <>
                  <MaterialCommunityIcons
                    name="content-save-outline"
                    size={16}
                    color="#0F4A2F"
                  />
                  <Text style={styles.footerBtnDraftText}>Save Draft</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {isOnline && (
            <TouchableOpacity
              style={[
                styles.footerBtn,
                styles.footerBtnSubmit,
                (saving || uploading) && styles.footerBtnDisabled,
              ]}
              onPress={handleSubmit}
              disabled={saving || uploading || savingOffline}
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
          )}

          {isOfflineMode && (
            <View style={styles.offlineNotice}>
              <Ionicons name="information-circle" size={14} color="#F59E0B" />
              <Text style={styles.offlineNoticeText}>
                You're offline. Save offline to sync later.
              </Text>
            </View>
          )}
        </View>
      )}

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

      <Modal
        visible={showGPSCamera}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowGPSCamera(false)}
      >
        <SimpleGeocam
          onCapture={handleGPSPhotoCaptured}
          onClose={() => setShowGPSCamera(false)}
        />
      </Modal>

      <Modal
        visible={showNoteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNoteModal(false)}
      >
        <View style={modalStyles.overlay}>
          <View style={modalStyles.modal}>
            <Text style={modalStyles.title}>
              {pendingPhoto?.withGPS
                ? "Add Note for GPS Photo"
                : "Add Note for Photo"}
            </Text>
            <Text style={modalStyles.subtitle}>
              Describe this boundary marker (optional)
            </Text>

            <TextInput
              style={modalStyles.input}
              placeholder="e.g., BM-01 concrete post, intact"
              placeholderTextColor="#9CA3AF"
              value={pendingNote}
              onChangeText={setPendingNote}
              autoFocus
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            {!pendingPhoto?.withGPS && (
              <View style={styles.noGpsWarning}>
                <Ionicons name="information-circle" size={14} color="#F59E0B" />
                <Text style={styles.noGpsWarningText}>
                  This photo has no GPS coordinates
                </Text>
              </View>
            )}

            <View style={modalStyles.buttons}>
              <TouchableOpacity
                style={modalStyles.cancelBtn}
                onPress={() => {
                  setShowNoteModal(false);
                  setPendingPhoto(null);
                  setPendingNote("");
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

      <FloatingMapButton
        areaId={parseInt(areaId)}
        areaName={params.areaName as string}
        siteId={siteId ? parseInt(siteId) : undefined}
        siteName={params.siteName as string}
        userLat={locationLat ? parseFloat(locationLat) : undefined}
        userLng={locationLng ? parseFloat(locationLng) : undefined}
      />
    </View>
  );
}

// ─────────────────────────────────────────────
// STYLES (Unchanged)
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

  offlineBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F59E0B",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  offlineBannerText: { color: "#fff", fontWeight: "600", fontSize: 13 },

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
  hintBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    backgroundColor: "#F0FDF4",
    borderRadius: 8,
    padding: 10,
  },
  hintText: { flex: 1, fontSize: 11, color: "#0F4A2F", lineHeight: 16 },
  galleryContent: { paddingVertical: 4, gap: 10 },
  thumbWrapper: { position: "relative", width: 90 },
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
  emptyGallery: {
    fontSize: 13,
    color: "#94A3B8",
    textAlign: "center",
    paddingVertical: 12,
  },
  noGpsWarning: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEF3C7",
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
  },
  noGpsWarningText: {
    flex: 1,
    fontSize: 11,
    color: "#92400E",
    fontWeight: "500",
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
    gap: 8,
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
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  footerBtnOffline: {
    borderWidth: 1.5,
    borderColor: "#F59E0B",
    backgroundColor: "#FFFBEB",
  },
  footerBtnOfflineText: { color: "#F59E0B", fontWeight: "700", fontSize: 12 },
  footerBtnDraft: {
    borderWidth: 1.5,
    borderColor: "#0F4A2F",
    backgroundColor: "#fff",
  },
  footerBtnDraftText: { color: "#0F4A2F", fontWeight: "700", fontSize: 12 },
  footerBtnSubmit: { backgroundColor: "#0F4A2F" },
  footerBtnSubmitText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  footerBtnDisabled: { opacity: 0.65 },
  offlineNotice: {
    position: "absolute",
    bottom: 70,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEF3C7",
    padding: 10,
    borderRadius: 8,
  },
  offlineNoticeText: {
    flex: 1,
    fontSize: 11,
    color: "#92400E",
    fontWeight: "600",
  },
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
