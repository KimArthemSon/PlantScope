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
  Dimensions,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import MapView, { Marker } from "react-native-maps";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as SecureStore from "expo-secure-store";
import ImageMarker from "react-native-image-marker";

import { useFieldAssessment } from "@/hooks/useFieldAssessment";
import { api } from "@/constants/url_fixed";

const API_BASE = `${api}/api`;
const { width: SW, height: SH } = Dimensions.get("window");

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

interface LocationData {
  latitude: number;
  longitude: number;
  address?: string;
  city?: string;
  barangay?: string;
  timestamp: string;
  accuracy?: number;
}

function GPSStampOverlay({ location }: { location: LocationData }) {
  const place = location.barangay
    ? `${location.barangay}, ${location.city || ""}`
    : location.city || "Unknown Location";
  return (
    <View style={cam.stampWrapper} pointerEvents="none">
      <View style={cam.stampCard}>
        <View style={cam.stampBrand}>
          <Ionicons name="leaf" size={10} color="#4ADE80" />
          <Text style={cam.stampBrandText}> PlantScope · Field Assessment</Text>
        </View>
        <View style={cam.stampDivider} />
        <View style={cam.stampRow}>
          <Ionicons name="location" size={11} color="#F87171" />
          <Text style={cam.stampPlace} numberOfLines={1}>
            {" "}
            {place}
          </Text>
        </View>
        <Text style={cam.stampCoords}>
          {location.latitude.toFixed(6)}° {location.longitude.toFixed(6)}°
        </Text>
        <View style={cam.stampFooterRow}>
          <Text style={cam.stampTime}>{location.timestamp}</Text>
          {location.accuracy != null && (
            <View style={cam.accuracyPill}>
              <Text style={cam.accuracyPillText}>
                ±{Math.round(location.accuracy)}m
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
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
  const [stamping, setStamping] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(
    null,
  );
  const [photoPreview, setPhotoPreview] = useState<{
    uri: string;
    location: LocationData;
  } | null>(null);
  const [showMap, setShowMap] = useState(false);
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
      console.error("📍 Location error:", error);
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
        exif: true,
      });
      if (!photo?.uri) {
        Alert.alert("Error", "Failed to capture photo.");
        return;
      }
      setPhotoPreview({ uri: photo.uri, location: locData });
      console.log("📸 Photo taken:", photo.uri);
    } catch (error) {
      console.error("📸 Take picture error:", error);
      Alert.alert(
        "Error",
        `Failed to capture photo: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setCapturing(false);
    }
  };

  const handleUsePhoto = async () => {
    if (!photoPreview) {
      Alert.alert("Error", "No photo to process.");
      return;
    }
    setStamping(true);
    try {
      const { location } = photoPreview;
      const place = location.barangay
        ? `${location.barangay}, ${location.city || ""}`
        : location.city || "Unknown Location";
      const stampText = `PlantScope • Field Assessment\n📍 ${place}\n📍 ${location.latitude.toFixed(6)}°, ${location.longitude.toFixed(6)}°\n🕐 ${location.timestamp}\n📏 ±${Math.round(location.accuracy || 0)}m`;
      console.log("🎨 Stamping image with GPS data...");
      const markedImagePath = await ImageMarker.markImage({
        src:
          Platform.OS === "ios"
            ? photoPreview.uri.replace("file://", "")
            : photoPreview.uri,
        marker: {
          text: stampText,
          X: 20,
          Y: SH - 180,
          fontName: Platform.OS === "ios" ? "Menlo" : "monospace",
          fontSize: 11,
          fontColor: "#FFFFFF",
          overlayColor: "rgba(0,0,0,0.75)",
          padding: 12,
          borderRadius: 10,
          borderColor: "rgba(74,222,128,0.4)",
          borderWidth: 1,
          lineHeight: 16,
        },
        quality: 90,
      });
      if (!markedImagePath) throw new Error("ImageMarker returned null");
      console.log("✅ Photo stamped successfully:", markedImagePath);
      const finalUri =
        Platform.OS === "android" && !markedImagePath.startsWith("file://")
          ? `file://${markedImagePath}`
          : markedImagePath;
      onImageCaptured(finalUri, location);
      setPhotoPreview(null);
    } catch (error) {
      console.error("❌ ImageMarker error:", error);
      Alert.alert(
        "Stamp Failed",
        "Could not add GPS stamp. Use original photo instead?",
        [
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => setStamping(false),
          },
          {
            text: "Use Original",
            onPress: () => {
              onImageCaptured(photoPreview.uri, photoPreview.location);
              setPhotoPreview(null);
            },
          },
        ],
      );
    } finally {
      setStamping(false);
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
          Camera and location access are needed to capture GPS-stamped photos.
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

  if (photoPreview) {
    return (
      <View style={cam.previewContainer}>
        <View style={{ width: SW, height: SH - 100, backgroundColor: "#000" }}>
          <Image
            source={{ uri: photoPreview.uri }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
          <View style={cam.stampWrapper} pointerEvents="none">
            <View style={cam.stampCard}>
              <View style={cam.stampBrand}>
                <Ionicons name="leaf" size={10} color="#4ADE80" />
                <Text style={cam.stampBrandText}>
                  {" "}
                  PlantScope · Field Assessment
                </Text>
              </View>
              <View style={cam.stampDivider} />
              <View style={cam.stampRow}>
                <Ionicons name="location" size={11} color="#F87171" />
                <Text style={cam.stampPlace} numberOfLines={1}>
                  {" "}
                  {photoPreview.location.barangay
                    ? `${photoPreview.location.barangay}, ${photoPreview.location.city || ""}`
                    : photoPreview.location.city || "Unknown Location"}
                </Text>
              </View>
              <Text style={cam.stampCoords}>
                {photoPreview.location.latitude.toFixed(6)}°{" "}
                {photoPreview.location.longitude.toFixed(6)}°
              </Text>
              <View style={cam.stampFooterRow}>
                <Text style={cam.stampTime}>
                  {photoPreview.location.timestamp}
                </Text>
                {photoPreview.location.accuracy != null && (
                  <View style={cam.accuracyPill}>
                    <Text style={cam.accuracyPillText}>
                      ±{Math.round(photoPreview.location.accuracy)}m
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </View>
        <View style={cam.previewActions}>
          <TouchableOpacity
            style={cam.retakeBtn}
            onPress={() => setPhotoPreview(null)}
            activeOpacity={0.8}
          >
            <Ionicons name="camera-outline" size={18} color="#0F4A2F" />
            <Text style={cam.retakeBtnText}>Retake</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={cam.usePhotoBtn}
            onPress={handleUsePhoto}
            disabled={stamping}
            activeOpacity={0.8}
          >
            {stamping ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={18}
                  color="#fff"
                />
                <Text style={cam.usePhotoBtnText}>Use Photo</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
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
      <CameraView ref={cameraRef} style={cam.camera} facing="back">
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
            onPress={() => hasGPS && setShowMap(true)}
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
                ? currentLocation!.city ||
                  currentLocation!.barangay ||
                  "Located"
                : "Getting GPS…"}
            </Text>
            {hasGPS && (
              <Ionicons
                name="chevron-forward"
                size={12}
                color="rgba(0,0,0,0.4)"
              />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={cam.iconBtnGreen}
            onPress={getCurrentLocation}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
        <View style={cam.reticle} pointerEvents="none">
          <View style={[cam.bracket, cam.bTL]} />
          <View style={[cam.bracket, cam.bTR]} />
          <View style={[cam.bracket, cam.bBL]} />
          <View style={[cam.bracket, cam.bBR]} />
          <View style={cam.reticleDot} />
        </View>
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
                <Text style={cam.gpsTimestamp}>
                  {currentLocation!.timestamp}
                </Text>
                {accuracy != null && (
                  <View style={cam.gpsPill}>
                    <Text style={cam.gpsPillText}>
                      ±{Math.round(accuracy)}m
                    </Text>
                  </View>
                )}
              </View>
            </>
          ) : (
            <Text style={cam.gpsWaiting}>Searching for satellites…</Text>
          )}
        </View>
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
      </CameraView>
      <Modal
        visible={showMap}
        animationType="slide"
        transparent
        onRequestClose={() => setShowMap(false)}
      >
        <View style={cam.mapModalBg}>
          <View style={cam.mapModalSheet}>
            <View style={cam.mapHandle} />
            <View style={cam.mapModalHeader}>
              <Text style={cam.mapModalTitle}>Your Location</Text>
              <TouchableOpacity onPress={() => setShowMap(false)}>
                <Ionicons name="close" size={22} color="#0F4A2F" />
              </TouchableOpacity>
            </View>
            {currentLocation ? (
              <>
                <MapView
                  style={cam.map}
                  initialRegion={{
                    latitude: currentLocation.latitude,
                    longitude: currentLocation.longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                  }}
                  showsUserLocation
                  showsMyLocationButton
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
                <View style={cam.mapInfoBox}>
                  {[
                    {
                      icon: "location",
                      label: "Coordinates",
                      value: `${currentLocation.latitude.toFixed(6)}°, ${currentLocation.longitude.toFixed(6)}°`,
                    },
                    {
                      icon: "business",
                      label: "Location",
                      value: [currentLocation.barangay, currentLocation.city]
                        .filter(Boolean)
                        .join(", "),
                    },
                    {
                      icon: "time-outline",
                      label: "Time",
                      value: currentLocation.timestamp,
                    },
                    ...(currentLocation.accuracy != null
                      ? [
                          {
                            icon: "radio-outline",
                            label: "Accuracy",
                            value: `±${Math.round(currentLocation.accuracy)} meters`,
                          },
                        ]
                      : []),
                  ].map((row) => (
                    <View key={row.label} style={cam.mapInfoRow}>
                      <Ionicons
                        name={row.icon as any}
                        size={14}
                        color="#0F4A2F"
                        style={{ marginRight: 6 }}
                      />
                      <Text style={cam.mapInfoLabel}>{row.label}:</Text>
                      <Text style={cam.mapInfoValue}>{row.value}</Text>
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <View style={cam.centerFill}>
                <ActivityIndicator size="large" color="#0F4A2F" />
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Camera Styles (unchanged) ────────────────
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
  stampWrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 14,
  },
  stampCard: {
    backgroundColor: "rgba(0,0,0,0.80)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    padding: 12,
  },
  stampBrand: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  stampBrandText: {
    fontSize: 10,
    color: "rgba(255,255,255,0.55)",
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  stampDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
    marginBottom: 8,
  },
  stampRow: { flexDirection: "row", alignItems: "center", marginBottom: 3 },
  stampPlace: { fontSize: 14, fontWeight: "800", color: "#FFFFFF", flex: 1 },
  stampCoords: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4ADE80",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    marginBottom: 6,
  },
  stampFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stampTime: { fontSize: 11, color: "rgba(255,255,255,0.5)" },
  accuracyPill: {
    backgroundColor: "rgba(74,222,128,0.2)",
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "rgba(74,222,128,0.35)",
  },
  accuracyPillText: { fontSize: 10, color: "#4ADE80", fontWeight: "700" },
  previewContainer: { flex: 1, backgroundColor: "#000" },
  previewActions: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#111",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  retakeBtn: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: "#0F4A2F",
    borderRadius: 12,
    paddingVertical: 13,
    backgroundColor: "#fff",
  },
  retakeBtnText: { color: "#0F4A2F", fontWeight: "700", fontSize: 14 },
  usePhotoBtn: {
    flex: 1.5,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#0F4A2F",
    borderRadius: 12,
    paddingVertical: 13,
  },
  usePhotoBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  mapModalBg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  mapModalSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "82%",
    paddingBottom: 24,
  },
  mapHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E5E7EB",
    alignSelf: "center",
    marginVertical: 10,
  },
  mapModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  mapModalTitle: { fontSize: 17, fontWeight: "800", color: "#0F4A2F" },
  map: { width: "100%", height: 280 },
  mapInfoBox: {
    margin: 14,
    backgroundColor: "#F4F7F5",
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  mapInfoRow: { flexDirection: "row", alignItems: "flex-start" },
  mapInfoLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
    minWidth: 80,
  },
  mapInfoValue: { flex: 1, fontSize: 12, color: "#0F4A2F", fontWeight: "600" },
});

// ─── Form Sub-Components ──────────────────────

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
            <MaterialCommunityIcons name={iconName as any} size={18} color="#fff" />
          ) : (
            <Ionicons name={iconName as any} size={18} color="#fff" />
          )}
        </View>
        <View style={styles.cardTitleGroup}>
          <Text style={styles.cardTitle}>{title}</Text>
          {subtitle ? <Text style={styles.cardSubtitle}>{subtitle}</Text> : null}
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
    <Text style={styles.fieldLabel}>{label}</Text>
    {optional && <Text style={styles.optionalTag}>optional</Text>}
  </View>
);

const ToggleRow = ({
  label,
  sublabel,
  value,
  onChange,
  disabled,
  activeColor = "#0F4A2F",
}: {
  label: string;
  sublabel?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  activeColor?: string;
}) => (
  <View style={[styles.toggleRow, value && { borderLeftColor: activeColor, borderLeftWidth: 3 }]}>
    <View style={styles.toggleLabelGroup}>
      <Text style={styles.toggleLabel}>{label}</Text>
      {sublabel && <Text style={styles.toggleSublabel}>{sublabel}</Text>}
    </View>
    <Switch
      value={value}
      onValueChange={disabled ? () => {} : onChange}
      disabled={disabled}
      trackColor={{ false: "#E5E7EB", true: activeColor }}
      thumbColor="#FFFFFF"
    />
  </View>
);

const ChipGroup = ({
  options,
  selected,
  onSelect,
  disabled,
  activeColor = "#0F4A2F",
}: {
  options: string[];
  selected: string;
  onSelect: (v: string) => void;
  disabled?: boolean;
  activeColor?: string;
}) => (
  <View style={styles.chipContainer}>
    {options.map((opt) => {
      const active = selected === opt;
      return (
        <TouchableOpacity
          key={opt}
          style={[
            styles.chip,
            active && { backgroundColor: activeColor, borderColor: activeColor },
          ]}
          onPress={() => !disabled && onSelect(opt)}
          disabled={disabled}
          activeOpacity={0.75}
        >
          {active && (
            <Ionicons name="checkmark" size={12} color="#fff" style={{ marginRight: 4 }} />
          )}
          <Text style={[styles.chipText, active && styles.chipTextActive]}>
            {opt.replace(/_/g, " ")}
          </Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

// ─── Main Form ────────────────────────────────

export default function BoundaryVerificationForm() {
  const params = useLocalSearchParams();
  const areaId = params.areaId as string;
  const assessmentId = params.assessmentId as string | undefined;
  const layerId = "boundary_verification";
  const { saving, handleSave, uploadImage, deleteImage, fetchAssessmentData } =
    useFieldAssessment(areaId, layerId, assessmentId);

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
  const [images, setImages] = useState<any[]>([]);
  const [isViewMode, setIsViewMode] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!assessmentId);
  const [showGPSCamera, setShowGPSCamera] = useState(false);

  useEffect(() => {
    if (assessmentId) {
      (async () => {
        const data = await fetchAssessmentData();
        if (data) {
          populateForm(data.field_assessment_data || {});
          setImages(data.images || []);
          setIsViewMode(!!data.is_submitted);
        }
        setLoading(false);
      })();
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
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLocationLat(loc.coords.latitude.toFixed(6));
      setLocationLng(loc.coords.longitude.toFixed(6));
      setLocationAccuracy(loc.coords.accuracy?.toFixed(1) || "");
      Alert.alert("Location Captured", "GPS coordinates updated.");
    } catch (error) {
      console.error("📍 Get location error:", error);
      Alert.alert("Error", "Could not get current location.");
    } finally {
      setGettingLocation(false);
    }
  };

  const handleGPSPhotoCaptured = async (uri: string, location: LocationData) => {
    setShowGPSCamera(false);
    if (!assessmentId) {
      Alert.alert("Action Required", "Please save the draft first to get an ID for image uploads.");
      return;
    }
    try {
      const formData = new FormData();
      let fileUri = uri;
      if (Platform.OS === "ios") {
        fileUri = uri.replace("file://", "");
      } else if (Platform.OS === "android") {
        if (!uri.startsWith("file://") && !uri.startsWith("content://")) {
          fileUri = `file://${uri}`;
        }
      }
      const imageFile: any = {
        uri: fileUri,
        type: "image/jpeg",
        name: `gps_photo_${Date.now()}.jpg`,
        fileName: `gps_photo_${Date.now()}.jpg`,
      };
      formData.append("image", imageFile);
      formData.append("assessment_id", assessmentId);
      formData.append("layer", layerId);
      formData.append("gps_data", JSON.stringify(location));
      const token = await SecureStore.getItemAsync("token");
      console.log("📤 Uploading to:", `${API_BASE}/upload_assessment_image/`);
      const resp = await fetch(`${API_BASE}/upload_assessment_image/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const result = await resp.json();
      if (resp.ok) {
        console.log("✅ Upload successful:", result);
        const data = await fetchAssessmentData();
        if (data) setImages(data.images || []);
        Alert.alert("Success", "GPS-stamped photo uploaded!");
      } else {
        console.error("❌ Upload failed:", result);
        Alert.alert("Upload Failed", result.error || result.message || "Please try again.");
      }
    } catch (error) {
      console.error("❌ Upload error:", error);
      Alert.alert("Upload Error", `Failed to upload photo: ${error instanceof Error ? error.message : "Unknown error"}`);
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
      boundary_deviation_meters: deviationMeters ? parseFloat(deviationMeters) : null,
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
    const ok = await handleSave(buildPayload(), false);
    if (ok) {
      if (assessmentId) {
        const data = await fetchAssessmentData();
        if (data) {
          populateForm(data.field_assessment_data || {});
          setImages(data.images || []);
        }
      }
      Alert.alert("Saved", "Draft saved successfully.");
    }
  };

  const handleSubmit = async () => {
    Alert.alert(
      "Submit Assessment",
      "Are you sure? You cannot edit after submission.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Submit",
          onPress: async () => {
            const ok = await handleSave(buildPayload(), true);
            if (ok) {
              setIsViewMode(true);
              Alert.alert("Success", "Submitted to GIS Specialist!");
            }
          },
        },
      ],
    );
  };

  const handlePickImage = async () => {
    if (!assessmentId) {
      Alert.alert("Action Required", "Save the draft first before uploading images.");
      return;
    }
    const ok = await uploadImage(assessmentId);
    if (ok) {
      const d = await fetchAssessmentData();
      if (d) setImages(d.images || []);
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
          const d = await fetchAssessmentData();
          if (d) setImages(d.images || []);
        },
      },
    ]);
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
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* View Mode Banner */}
        {isViewMode && (
          <View style={styles.viewModeBanner}>
            <Ionicons name="eye-outline" size={16} color="#fff" />
            <Text style={styles.viewModeBannerText}>Submitted — Read Only</Text>
          </View>
        )}

        {/* SECTION 1: Boundary Markers */}
        <SectionCard
          title="Boundary Markers"
          subtitle="Physical marker condition and deviation"
          iconName="location-outline"
          accentColor="#B45309"
          step={1}
        >
          <FieldLabel label="Marker Status" />
          <ChipGroup
            options={MARKER_STATUS_OPTIONS}
            selected={markersStatus}
            onSelect={setMarkersStatus}
            disabled={isViewMode}
            activeColor="#B45309"
          />
          {markersStatus === "other" && (
            <>
              <FieldLabel label="Describe Marker Condition" />
              <TextInput
                style={[styles.textArea, isViewMode && styles.disabledInput]}
                multiline
                value={boundaryNotes}
                onChangeText={setBoundaryNotes}
                placeholder="Describe marker condition…"
                placeholderTextColor="#94A3B8"
                editable={!isViewMode}
                textAlignVertical="top"
              />
            </>
          )}

          <FieldLabel label="Deviation from Planned Polygon (meters)" optional />
          <View style={[styles.inputRow, isViewMode && styles.disabledInput]}>
            <MaterialCommunityIcons name="ruler" size={15} color="#94A3B8" />
            <TextInput
              style={styles.inputField}
              keyboardType="numeric"
              value={deviationMeters}
              onChangeText={setDeviationMeters}
              placeholder="e.g. 2.5"
              placeholderTextColor="#94A3B8"
              editable={!isViewMode}
            />
          </View>
        </SectionCard>

        {/* SECTION 2: Spatial Compliance */}
        <SectionCard
          title="Spatial Compliance"
          subtitle="Buffer zones, encroachment & slope"
          iconName="shield-checkmark-outline"
          accentColor="#1D4ED8"
          step={2}
        >
          <ToggleRow
            label="Within 20m Riparian Buffer?"
            sublabel="Proximity to water bodies"
            value={withinRiparian}
            onChange={setWithinRiparian}
            disabled={isViewMode}
            activeColor="#3B82F6"
          />
          <ToggleRow
            label="Encroachment Detected?"
            sublabel="Land use violation within boundary"
            value={encroachmentDetected}
            onChange={setEncroachmentDetected}
            disabled={isViewMode}
            activeColor="#EF4444"
          />
          {encroachmentDetected && (
            <>
              <FieldLabel label="Encroachment Type" />
              <ChipGroup
                options={ENCROACHMENT_TYPES}
                selected={encroachmentType}
                onSelect={setEncroachmentType}
                disabled={isViewMode}
                activeColor="#EF4444"
              />
              {encroachmentType === "other" && (
                <>
                  <FieldLabel label="Describe Encroachment" />
                  <TextInput
                    style={[styles.textArea, isViewMode && styles.disabledInput]}
                    multiline
                    value={boundaryNotes}
                    onChangeText={setBoundaryNotes}
                    placeholder="Describe encroachment type…"
                    placeholderTextColor="#94A3B8"
                    editable={!isViewMode}
                    textAlignVertical="top"
                  />
                </>
              )}
            </>
          )}
          <ToggleRow
            label="Boundary crosses >30° slope?"
            sublabel="Steep terrain flag"
            value={slopeBoundaryCheck}
            onChange={setSlopeBoundaryCheck}
            disabled={isViewMode}
            activeColor="#F59E0B"
          />
        </SectionCard>

        {/* SECTION 3: Boundary Coordinate Feedback */}
        <SectionCard
          title="Boundary Coordinate Feedback"
          subtitle="One key boundary point for GIS verification"
          iconName="document-text-outline"
          accentColor="#0F766E"
          step={3}
        >
          <View style={styles.coordRow}>
            <View style={styles.coordHalf}>
              <FieldLabel label="Latitude" optional />
              <View style={[styles.inputRow, isViewMode && styles.disabledInput]}>
                <Ionicons name="navigate-outline" size={13} color="#94A3B8" />
                <TextInput
                  style={styles.inputField}
                  keyboardType="decimal-pad"
                  value={boundaryLat}
                  onChangeText={setBoundaryLat}
                  placeholder="e.g. 11.0"
                  placeholderTextColor="#94A3B8"
                  editable={!isViewMode}
                />
              </View>
            </View>
            <View style={styles.coordHalf}>
              <FieldLabel label="Longitude" optional />
              <View style={[styles.inputRow, isViewMode && styles.disabledInput]}>
                <Ionicons name="navigate-outline" size={13} color="#94A3B8" />
                <TextInput
                  style={styles.inputField}
                  keyboardType="decimal-pad"
                  value={boundaryLng}
                  onChangeText={setBoundaryLng}
                  placeholder="e.g. 124.6"
                  placeholderTextColor="#94A3B8"
                  editable={!isViewMode}
                />
              </View>
            </View>
          </View>

          <FieldLabel label="Marker Name" optional />
          <View style={[styles.inputRow, isViewMode && styles.disabledInput]}>
            <Ionicons name="flag-outline" size={15} color="#94A3B8" />
            <TextInput
              style={styles.inputField}
              value={markerName}
              onChangeText={setMarkerName}
              placeholder="e.g. BM-01_Northwest"
              placeholderTextColor="#94A3B8"
              editable={!isViewMode}
            />
          </View>

          {boundaryLat !== "" && boundaryLng !== "" && (
            <View style={styles.coordPreview}>
              <Ionicons name="location" size={13} color="#0F766E" />
              <Text style={[styles.coordPreviewText, { color: "#0F766E" }]}>
                {boundaryLat}, {boundaryLng}
                {markerName ? `  ·  ${markerName}` : ""}
              </Text>
            </View>
          )}

          <View style={styles.hintBox}>
            <Ionicons name="information-circle-outline" size={14} color="#0F766E" />
            <Text style={[styles.hintText, { color: "#0F766E" }]}>
              This single point helps the GIS Specialist verify boundary alignment.
            </Text>
          </View>
        </SectionCard>

        {/* SECTION 4: Assessment Location */}
        <SectionCard
          title="Assessment Location"
          subtitle="Your GPS position during this assessment"
          iconName="locate-outline"
          accentColor="#0F4A2F"
          step={4}
        >
          <View style={styles.coordRow}>
            <View style={styles.coordHalf}>
              <FieldLabel label="Latitude" optional />
              <View style={[styles.inputRow, isViewMode && styles.disabledInput]}>
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
              <View style={[styles.inputRow, isViewMode && styles.disabledInput]}>
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
            <MaterialCommunityIcons name="signal-distance-variant" size={15} color="#94A3B8" />
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
                  <MaterialCommunityIcons name="crosshairs-gps" size={16} color="#fff" />
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
            <Ionicons name="information-circle-outline" size={14} color="#0F4A2F" />
            <Text style={styles.hintText}>
              Optional — leave blank if the assessment was done remotely.
            </Text>
          </View>
        </SectionCard>

        {/* SECTION 5: Area Context Map */}
        <SectionCard
          title="Area Context Map"
          subtitle="Approximate reference — not editable"
          iconName="map-outline"
          accentColor="#475569"
          step={5}
        >
          <View style={styles.mapContainer}>
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
            {/* Legend overlay */}
            <View style={styles.mapLegend}>
              <View style={styles.mapLegendRow}>
                <View style={[styles.mapLegendDot, { backgroundColor: "#EF4444" }]} />
                <Text style={styles.mapLegendText}>Your location</Text>
              </View>
              <View style={styles.mapLegendRow}>
                <View style={[styles.mapLegendDot, { backgroundColor: "#0F4A2F" }]} />
                <Text style={styles.mapLegendText}>Boundary point</Text>
              </View>
            </View>
          </View>
          <View style={styles.hintBox}>
            <Ionicons name="information-circle-outline" size={14} color="#0F4A2F" />
            <Text style={styles.hintText}>
              Final boundary will be drawn by the GIS Specialist using drone imagery.
            </Text>
          </View>
        </SectionCard>

        {/* SECTION 6: Boundary Notes */}
        <SectionCard
          title="Boundary Notes"
          subtitle="Additional field observations"
          iconName="create-outline"
          accentColor="#6D28D9"
          step={6}
        >
          <TextInput
            style={[styles.textArea, isViewMode && styles.disabledInput]}
            multiline
            value={boundaryNotes}
            onChangeText={setBoundaryNotes}
            placeholder="e.g. BM-02 wooden stake tilted ~15°. No encroachment along perimeter."
            placeholderTextColor="#94A3B8"
            editable={!isViewMode}
            textAlignVertical="top"
          />
        </SectionCard>

        {/* SECTION 7: Photos */}
        <SectionCard
          title="Photo Evidence"
          subtitle={`${images.length} photo${images.length !== 1 ? "s" : ""} · Gallery or GPS-stamped`}
          iconName="images-outline"
          accentColor="#0369A1"
          step={7}
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
                    <Ionicons name="eye-outline" size={14} color="#fff" />
                  </View>
                </TouchableOpacity>
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
              <>
                <TouchableOpacity
                  style={styles.addPhotoBtn}
                  onPress={handlePickImage}
                  activeOpacity={0.75}
                >
                  <MaterialCommunityIcons name="image-plus" size={26} color="#0369A1" />
                  <Text style={styles.addPhotoBtnText}>Gallery</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.addPhotoBtn, styles.addPhotoBtnGPS]}
                  onPress={() => setShowGPSCamera(true)}
                  activeOpacity={0.75}
                >
                  <Ionicons name="camera-outline" size={26} color="#0F4A2F" />
                  <Text style={[styles.addPhotoBtnText, { color: "#0F4A2F" }]}>GPS Cam</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>

          {images.length === 0 && isViewMode && (
            <Text style={styles.emptyGallery}>No photos attached to this assessment.</Text>
          )}

          {!isViewMode && (
            <View style={styles.hintBox}>
              <Ionicons name="information-circle-outline" size={14} color="#0369A1" />
              <Text style={[styles.hintText, { color: "#0369A1" }]}>
                "Gallery" picks existing photos · "GPS Cam" captures with coordinates burned in
              </Text>
            </View>
          )}
        </SectionCard>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Fixed Footer */}
      {!isViewMode && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.footerBtn, styles.footerBtnDraft]}
            onPress={handleDraft}
            disabled={saving}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="content-save-outline" size={16} color="#0F4A2F" />
            <Text style={styles.footerBtnDraftText}>Save Draft</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.footerBtn, styles.footerBtnSubmit, saving && styles.footerBtnDisabled]}
            onPress={handleSubmit}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? (
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
        <GPSStampCamera
          onImageCaptured={handleGPSPhotoCaptured}
          onClose={() => setShowGPSCamera(false)}
        />
      </Modal>
    </View>
  );
}

// ─── Form Styles ──────────────────────────────
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

  // Inputs
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

  // Coordinate layout
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
  coordPreviewText: { fontSize: 12, color: "#166534", fontWeight: "600", flex: 1 },

  // Toggle row
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderLeftWidth: 1,
    borderLeftColor: "#E2E8F0",
  },
  toggleLabelGroup: { flex: 1, marginRight: 8 },
  toggleLabel: { fontSize: 13, fontWeight: "600", color: "#334155" },
  toggleSublabel: { fontSize: 11, color: "#94A3B8", marginTop: 1 },

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
  chipText: { fontSize: 12, color: "#475569", fontWeight: "600" },
  chipTextActive: { color: "#fff", fontWeight: "700" },

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
  gpsBtnLoading: { opacity: 0.8 },
  gpsBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },

  // Hint box
  hintBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    backgroundColor: "#F0FDF4",
    borderRadius: 8,
    padding: 10,
  },
  hintText: { flex: 1, fontSize: 11, color: "#0F4A2F", lineHeight: 16 },

  // Map
  mapContainer: { borderRadius: 10, overflow: "hidden", position: "relative" },
  mapPreview: { width: "100%", height: 190, backgroundColor: "#E2E8F0" },
  mapLegend: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 8,
    padding: 8,
    gap: 4,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  mapLegendRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  mapLegendDot: { width: 8, height: 8, borderRadius: 4 },
  mapLegendText: { fontSize: 10, color: "#334155", fontWeight: "600" },

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
  addPhotoBtnGPS: {
    borderColor: "#BBF7D0",
    backgroundColor: "#F0FDF4",
  },
  addPhotoBtnText: { fontSize: 10, color: "#0369A1", fontWeight: "600" },
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

  // Modal
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
