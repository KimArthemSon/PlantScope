import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Dimensions,
  Pressable,
  ScrollView,
  Alert,
  Platform,
  Animated,
  Easing,
} from "react-native";
import { WebView } from "react-native-webview";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import { api } from "@/constants/url_fixed";
import { useNetworkStatus } from "@/utils/networkStatus";
import { useAlert } from "@/components/AlertContext";
import { usePolygonAlerts } from "@/hooks/usePolygonAlerts";
import PolygonAlertModal from "@/components/map/PolygonAlertModal";
import PolygonDownloadService from "@/services/PolygonDownloadService";
import PolygonStorageService from "@/services/PolygonStorageService";

const { height: screenHeight } = Dimensions.get("window");
const API_BASE_URL = api + "/api";

// ─────────────────────────────────────────────
// ✅ GPS-REFACTOR: Constants
// ─────────────────────────────────────────────
const GPS_READY_HOURS = 2;
const GPS_AGING_HOURS = 6;
const GPS_LIVE_TIMEOUT_MS = 30000; // 30 seconds

// 🌐 Official Hazard Tile URLs
const MGB_FLOOD_TILE_URL =
  "https://controlmap.mgb.gov.ph/arcgis/rest/services/GeospatialDataInventory/GDI_Detailed_Flood_Susceptibility/MapServer/tile/{z}/{y}/{x}";
const MGB_LANDSLIDE_TILE_URL =
  "https://controlmap.mgb.gov.ph/arcgis/rest/services/GeospatialDataInventory/GDI_Detailed_Rain_induced_Landslide_Susceptibility/MapServer/tile/{z}/{y}/{x}";

interface Barangay {
  barangay_id: number;
  name: string;
  coordinate: [number, number];
}

interface FloatingMapButtonProps {
  areaId: number;
  areaName?: string;
  siteId?: number;
  siteName?: string;
  userLat?: number;
  userLng?: number;
}

type GPSReadiness = "ready" | "aging" | "cold" | "checking";

// ─────────────────────────────────────────────
// GPS READINESS BANNER COMPONENT
// ─────────────────────────────────────────────
const GPSReadinessBanner: React.FC<{
  readiness: GPSReadiness;
  ageText: string;
  onRefresh: () => void;
}> = ({ readiness, ageText, onRefresh }) => {
  const config = {
    ready: {
      bg: "#DCFCE7",
      border: "#86EFAC",
      icon: "checkmark-circle" as const,
      iconColor: "#15803D",
      title: "GPS Ready",
      titleColor: "#15803D",
      message: `Last fix: ${ageText}. Safe to go offline.`,
    },
    aging: {
      bg: "#FEF3C7",
      border: "#FCD34D",
      icon: "time-outline" as const,
      iconColor: "#92400E",
      title: "GPS Cache Aging",
      titleColor: "#92400E",
      message: `Last fix: ${ageText}. Consider brief internet to warm up.`,
    },
    cold: {
      bg: "#FEE2E2",
      border: "#FCA5A5",
      icon: "snow-outline" as const,
      iconColor: "#991B1B",
      title: "GPS Cold",
      titleColor: "#991B1B",
      message: "No recent fix. Connect to internet briefly before field work.",
    },
  };
  const c = config[readiness];

  return (
    <View
      style={[
        styles.gpsBanner,
        { backgroundColor: c.bg, borderColor: c.border },
      ]}
    >
      <Ionicons name={c.icon} size={18} color={c.iconColor} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.gpsBannerTitle, { color: c.titleColor }]}>
          {c.title}
        </Text>
        <Text style={[styles.gpsBannerMessage, { color: c.titleColor }]}>
          {c.message}
        </Text>
      </View>
      <TouchableOpacity onPress={onRefresh} style={styles.gpsBannerRefresh}>
        <Ionicons name="refresh-outline" size={18} color={c.iconColor} />
      </TouchableOpacity>
    </View>
  );
};

// ─────────────────────────────────────────────
// 🚨 HAZARD ALERT BANNER COMPONENT
// ─────────────────────────────────────────────
const HazardAlertBanner: React.FC<{
  alerts: any[];
  visible: boolean;
  onPress: () => void;
}> = ({ alerts, visible, onPress }) => {
  const slideAnim = useRef(new Animated.Value(-140)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        friction: 8,
        tension: 40,
      }).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.03,
            duration: 600,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease),
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease),
          }),
        ]),
      ).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: -140,
        duration: 300,
        useNativeDriver: true,
        easing: Easing.inOut(Easing.ease),
      }).start();
      pulseAnim.setValue(1);
    }
  }, [visible]);

  if (!visible) return null;

  const hazardNames = alerts
    .map((a) => a.name || a.type || "Unknown Hazard")
    .join(", ");
  const isMultiple = alerts.length > 1;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.hazardBanner, { transform: [{ translateY: slideAnim }] }]}
    >
      <Animated.View
        style={[
          styles.hazardBannerInner,
          { transform: [{ scale: pulseAnim }] },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={onPress}
          style={styles.hazardBannerTouchable}
        >
          <View style={styles.hazardBannerIconWrap}>
            <Ionicons name="warning" size={28} color="#fff" />
          </View>
          <View style={styles.hazardBannerTextWrap}>
            <Text style={styles.hazardBannerTitle}>
              {isMultiple
                ? `${alerts.length} HAZARD ZONES DETECTED`
                : "HAZARD ZONE DETECTED"}
            </Text>
            <Text style={styles.hazardBannerSubtitle} numberOfLines={1}>
              {hazardNames}
            </Text>
            <Text style={styles.hazardBannerTap}>Tap for details</Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={20}
            color="rgba(255,255,255,0.7)"
          />
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
};

// ─────────────────────────────────────────────
// 🚨 ENHANCED FLOATING HAZARD INDICATOR
// ─────────────────────────────────────────────
const HazardIndicator: React.FC<{
  alerts: any[];
  onPress: () => void;
}> = ({ alerts, onPress }) => {
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  const isHazard = alerts.length > 0;

  useEffect(() => {
    if (isHazard) {
      const createPulse = (anim: Animated.Value, delay: number) =>
        Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(anim, {
              toValue: 1,
              duration: 1500,
              useNativeDriver: true,
              easing: Easing.out(Easing.ease),
            }),
            Animated.timing(anim, {
              toValue: 0,
              duration: 0,
              useNativeDriver: true,
            }),
          ]),
        );

      createPulse(ring1, 0).start();
      createPulse(ring2, 500).start();
      createPulse(ring3, 1000).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(shake, {
            toValue: 1,
            duration: 80,
            useNativeDriver: true,
          }),
          Animated.timing(shake, {
            toValue: -1,
            duration: 80,
            useNativeDriver: true,
          }),
          Animated.timing(shake, {
            toValue: 1,
            duration: 80,
            useNativeDriver: true,
          }),
          Animated.timing(shake, {
            toValue: 0,
            duration: 80,
            useNativeDriver: true,
          }),
          Animated.delay(2200),
        ]),
      ).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 1.12,
            duration: 700,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease),
          }),
          Animated.timing(scale, {
            toValue: 1,
            duration: 700,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease),
          }),
        ]),
      ).start();
    } else {
      ring1.setValue(0);
      ring2.setValue(0);
      ring3.setValue(0);
      shake.setValue(0);
      scale.setValue(1);
    }
  }, [isHazard]);

  const shakeInterpolation = shake.interpolate({
    inputRange: [-1, 1],
    outputRange: [-5, 5],
  });

  const ringStyle = (anim: Animated.Value) => ({
    position: "absolute" as const,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#ef4444",
    opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
    transform: [
      {
        scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.8] }),
      },
    ],
  });

  return (
    <View style={styles.hazardIndicatorWrap}>
      {isHazard && (
        <>
          <Animated.View style={ringStyle(ring1)} />
          <Animated.View style={ringStyle(ring2)} />
          <Animated.View style={ringStyle(ring3)} />
        </>
      )}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPress}
        disabled={!isHazard}
      >
        <Animated.View
          style={[
            styles.hazardIndicatorBall,
            {
              backgroundColor: isHazard ? "#ef4444" : "#10b981",
              transform: [
                { translateX: isHazard ? shakeInterpolation : 0 },
                { scale: isHazard ? scale : 1 },
              ],
            },
          ]}
        >
          <Ionicons
            name={isHazard ? "warning" : "shield-checkmark"}
            size={28}
            color="#fff"
          />
          {isHazard && alerts.length > 1 && (
            <View style={styles.hazardCountBadge}>
              <Text style={styles.hazardCountText}>{alerts.length}</Text>
            </View>
          )}
        </Animated.View>
      </TouchableOpacity>
      <View style={styles.hazardIndicatorLabelWrap}>
        <Text
          style={[
            styles.hazardIndicatorLabel,
            { color: isHazard ? "#ef4444" : "#10b981" },
          ]}
        >
          {isHazard
            ? alerts.length === 1
              ? "INSIDE HAZARD ZONE"
              : `${alerts.length} HAZARD ZONES`
            : "SAFE"}
        </Text>
      </View>
    </View>
  );
};

// ─────────────────────────────────────────────
// 🚨 AMBIENT VIGNETTE OVERLAY
// ─────────────────────────────────────────────
const HazardVignette: React.FC<{ visible: boolean }> = ({ visible }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: visible ? 1 : 0,
      duration: 600,
      useNativeDriver: true,
      easing: Easing.inOut(Easing.ease),
    }).start();
  }, [visible]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFillObject,
        styles.vignetteOverlay,
        { opacity: fadeAnim },
      ]}
    />
  );
};

export default function FloatingMapButton({
  areaId,
  areaName,
  siteId,
  siteName,
  userLat,
  userLng,
}: FloatingMapButtonProps) {
  const [showMap, setShowMap] = useState(false);
  const [loading, setLoading] = useState(false);
  const [barangays, setBarangays] = useState<Barangay[]>([]);
  const [areaCoords, setAreaCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [siteCoords, setSiteCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(userLat && userLng ? { lat: userLat, lng: userLng } : null);

  const [userCoordinates, setUserCoordinates] = useState<{
    lat: number;
    lng: number;
    accuracy: number | null;
    isFallback?: boolean;
  } | null>(null);

  const [locationSubscription, setLocationSubscription] = useState<any>(null);
  const [isLocationEnabled, setIsLocationEnabled] = useState(false);
  const [isAcquiringLocation, setIsAcquiringLocation] = useState(false);

  const [gpsReadiness, setGpsReadiness] = useState<GPSReadiness>("cold");
  const [gpsReadinessAge, setGpsReadinessAge] = useState<number | null>(null);
  const [gpsCountdown, setGpsCountdown] = useState(30);

  const [selectedBarangay, setSelectedBarangay] = useState<Barangay | null>(
    null,
  );
  const [showBarangaySheet, setShowBarangaySheet] = useState(false);
  const [loadingClassified, setLoadingClassified] = useState(false);
  const [loadingHazards, setLoadingHazards] = useState(false);

  const [showFlood, setShowFlood] = useState(false);
  const [showLandslide, setShowLandslide] = useState(false);
  const [showLayerPanel, setShowLayerPanel] = useState(false);

  const [selectedAlert, setSelectedAlert] = useState<any>(null);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [hasDownloadedPolygons, setHasDownloadedPolygons] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadStatus, setDownloadStatus] = useState("");
  const [showDownloadModal, setShowDownloadModal] = useState(false);

  const [showDownloadOptions, setShowDownloadOptions] = useState(false);
  const [selectedBarangays, setSelectedBarangays] = useState<number[]>([]);
  const [downloadOption, setDownloadOption] = useState<
    "all" | "barangay" | "high_priority"
  >("all");
  const [availableBarangays, setAvailableBarangays] = useState<any[]>([]);

  const [showOfflineWarning, setShowOfflineWarning] = useState(false);

  const [downloadedStats, setDownloadedStats] = useState({
    classified: 0,
    hazards: 0,
    size: "0 KB",
  });

  const [isMapBackgroundDownloaded, setIsMapBackgroundDownloaded] =
    useState(false);
  const [isLoadingPolygons, setIsLoadingPolygons] = useState(false);
  const [shouldShowAlertIndicator, setShouldShowAlertIndicator] =
    useState(false);
  const hasFitted = useRef(false);

  const webViewRef = useRef<any>(null);
  const isOnline = useNetworkStatus();
  const alertContext = useAlert();
  const alert = alertContext;

  const {
    isRunning: geofencingActive,
    alerts,
    hasActiveAlerts,
    start: startGeofencing,
    stop: stopGeofencing,
    refreshPolygonStatus,
  } = usePolygonAlerts();

  useEffect(() => {
    if (!showMap) {
      stopLocationTracking();
      setIsLocationEnabled(false);
      setIsAcquiringLocation(false);
      setShouldShowAlertIndicator(false);
      setGpsReadiness("cold");
    }
    return () => stopLocationTracking();
  }, [showMap]);

  const stopLocationTracking = () => {
    if (locationSubscription) {
      locationSubscription.remove();
      setLocationSubscription(null);
    }
  };

  const updateLocation = (
    loc: Location.LocationObject,
    flyTo: boolean,
    isFallback = false,
  ) => {
    const { latitude, longitude, accuracy } = loc.coords;
    const coords = {
      lat: latitude,
      lng: longitude,
      accuracy: accuracy || null,
      isFallback,
    };
    setUserCoordinates(coords);
    setCurrentLocation({ lat: latitude, lng: longitude });
    injectToWebView(
      `window.updateMap('addUserLocation', { lat: ${latitude}, lng: ${longitude} })`,
    );
    if (flyTo) {
      injectToWebView(
        `window.updateMap('flyTo', { lat: ${latitude}, lng: ${longitude}, zoom: 15 })`,
      );
    }
  };

  useEffect(() => {
    if (userLat && userLng) {
      setCurrentLocation({ lat: userLat, lng: userLng });
      setUserCoordinates({ lat: userLat, lng: userLng, accuracy: null });
    }
  }, [userLat, userLng]);

  useEffect(() => {
    if (showMap) {
      checkPolygons();
      updateDownloadedStats();
    }
  }, [showMap]);

  useEffect(() => {
    if (!isOnline && showMap) {
      setShowOfflineWarning(true);
      const timer = setTimeout(() => setShowOfflineWarning(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, showMap]);

  useEffect(() => {
    if (showDownloadOptions) {
      setAvailableBarangays(
        barangays.map((b) => ({ id: b.barangay_id, name: b.name })),
      );
      setSelectedBarangays([]);
    }
  }, [showDownloadOptions, barangays]);

  const updateDownloadedStats = async () => {
    try {
      const [classified, hazards] = await Promise.all([
        PolygonStorageService.loadClassifiedPolygons(),
        PolygonStorageService.loadHazardPolygons(),
      ]);
      const info = await PolygonStorageService.getStorageInfo();
      setDownloadedStats({
        classified: classified.length,
        hazards: hazards.length,
        size: PolygonStorageService.formatSize(info.totalSize || 0),
      });
    } catch (error) {
      console.error("Failed to update stats:", error);
    }
  };

  const loadDownloadedPolygons = async () => {
    setIsLoadingPolygons(true);
    setShouldShowAlertIndicator(true);
    try {
      const [classified, hazards] = await Promise.all([
        PolygonStorageService.loadClassifiedPolygons(),
        PolygonStorageService.loadHazardPolygons(),
      ]);

      if (classified.length > 0) {
        const classifiedPolygons = classified.map((p: any) => {
          let coords = p.coordinates;
          if (coords && typeof coords === "object" && !Array.isArray(coords)) {
            if (coords.coordinates) coords = coords.coordinates;
          }
          if (
            Array.isArray(coords) &&
            coords.length > 0 &&
            Array.isArray(coords[0]) &&
            Array.isArray(coords[0][0])
          ) {
            coords = coords[0];
          }
          const leafletCoords = coords.map((point: any) => {
            if (Array.isArray(point) && point.length === 2) {
              if (
                point[0] > 100 &&
                point[0] < 150 &&
                point[1] > 0 &&
                point[1] < 30
              ) {
                return [point[1], point[0]];
              }
              return point;
            }
            return point;
          });
          return {
            coordinates: leafletCoords,
            color: p.color || "#16a34a",
            name: p.name || "Classified Area",
            classification: p.classification || "Unknown",
          };
        });
        injectToWebView(
          `window.updateMap('drawClassifiedPolygons', ${JSON.stringify(classifiedPolygons)})`,
        );
      }

      if (hazards.length > 0) {
        const hazardPolygons = hazards.map((p: any) => {
          let coords = p.coordinates;
          if (coords && typeof coords === "object" && !Array.isArray(coords)) {
            if (coords.coordinates) coords = coords.coordinates;
          }
          if (
            Array.isArray(coords) &&
            coords.length > 0 &&
            Array.isArray(coords[0]) &&
            Array.isArray(coords[0][0])
          ) {
            coords = coords[0];
          }
          const leafletCoords = coords.map((point: any) => {
            if (Array.isArray(point) && point.length === 2) {
              if (
                point[0] > 100 &&
                point[0] < 150 &&
                point[1] > 0 &&
                point[1] < 30
              ) {
                return [point[1], point[0]];
              }
              return point;
            }
            return point;
          });
          return {
            coordinates: leafletCoords,
            color: p.color || "#ef4444",
            name: p.name || "Hazard Area",
            type: p.hazard_type || "Unknown",
          };
        });
        injectToWebView(
          `window.updateMap('drawHazardPolygons', ${JSON.stringify(hazardPolygons)})`,
        );
      }

      const totalClassified = classified?.length || 0;
      const totalHazards = hazards?.length || 0;
      const total = totalClassified + totalHazards;

      if (total === 0) {
        alert?.info(
          "No Polygons",
          "No downloaded polygons found. Please download some first.",
        );
      } else {
        alert?.success(
          "Polygons Loaded",
          `Loaded ${total} polygons (${totalClassified} classified, ${totalHazards} hazards)`,
        );
      }
    } catch (error) {
      console.error("Failed to load downloaded polygons:", error);
      alert?.error("Error", "Failed to load polygons from storage.");
    } finally {
      setIsLoadingPolygons(false);
    }
  };

  const checkPolygons = async () => {
    try {
      const has = await PolygonDownloadService.hasPolygons();
      setHasDownloadedPolygons(has);
      await refreshPolygonStatus();
      await updateDownloadedStats();
    } catch (error) {
      console.error("Failed to check polygons:", error);
      setHasDownloadedPolygons(false);
    }
  };

  useEffect(() => {
    if (
      showMap &&
      isLocationEnabled &&
      hasDownloadedPolygons &&
      !geofencingActive
    ) {
      startGeofencing();
    }
    return () => {};
  }, [
    showMap,
    isLocationEnabled,
    hasDownloadedPolygons,
    geofencingActive,
    startGeofencing,
  ]);

  useEffect(() => {
    if (showMap) fetchMapData();
  }, [showMap]);

  const fetchMapData = async () => {
    setLoading(true);
    try {
      const token = await SecureStore.getItemAsync("token");
      if (!token) throw new Error("No authentication token");
      const headers = { Authorization: `Bearer ${token}` };

      try {
        const barangaysRes = await fetch(`${API_BASE_URL}/get_barangay_list/`, {
          headers,
        });
        if (barangaysRes.ok) {
          const barangaysData = await barangaysRes.json();
          setBarangays(barangaysData.data || []);
        }
      } catch (e) {
        console.warn("Failed to fetch barangays:", e);
      }

      try {
        const areasRes = await fetch(
          `${API_BASE_URL}/get_assigned_reforestation_area/`,
          { headers },
        );
        if (areasRes.ok) {
          const areasData = await areasRes.json();
          const area = Array.isArray(areasData)
            ? areasData.find((a: any) => a.reforestation_area_id === areaId)
            : null;
          if (area?.coordinate) {
            if (Array.isArray(area.coordinate) && area.coordinate.length >= 2) {
              setAreaCoords({
                lat: Number(area.coordinate[0]),
                lng: Number(area.coordinate[1]),
              });
            } else if (area.coordinate.latitude) {
              setAreaCoords({
                lat: Number(area.coordinate.latitude),
                lng: Number(area.coordinate.longitude),
              });
            }
          }
        }
      } catch (e) {
        console.warn("Failed to fetch areas:", e);
      }

      if (siteId) {
        try {
          const siteRes = await fetch(`${API_BASE_URL}/get_site/${siteId}/`, {
            headers,
          });
          if (siteRes.ok) {
            const siteData = await siteRes.json();
            if (
              siteData?.center_coordinate &&
              siteData.center_coordinate.length === 2
            ) {
              setSiteCoords({
                lat: Number(siteData.center_coordinate[0]),
                lng: Number(siteData.center_coordinate[1]),
              });
            }
          }
        } catch (e) {
          console.warn("Failed to fetch site:", e);
        }
      }
    } catch (e) {
      console.error("Failed to fetch map data", e);
      alert?.error("Error", "Failed to load map data.");
    } finally {
      setLoading(false);
    }
  };

  const injectToWebView = (js: string) => {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(js + "; true;");
    }
  };

  const onWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "marker_click" && data.category === "barangay") {
        const barangay = barangays.find((b) => b.barangay_id === data.id);
        if (barangay) {
          setSelectedBarangay(barangay);
          setShowBarangaySheet(true);
        }
      } else if (data.type === "polygon_count") {
        if (data.count === 0 && hasDownloadedPolygons) {
          console.warn("⚠️ Polygons downloaded but not visible on map");
        }
      } else if (data.type === "tile_download_start") {
        setDownloadStatus("Downloading map background tiles...");
        setDownloadProgress(0);
        setShowDownloadModal(true);
        setIsDownloading(true);
      } else if (data.type === "tile_download_progress") {
        setDownloadProgress(data.progress);
      } else if (data.type === "tile_download_complete") {
        setIsDownloading(false);
        setDownloadProgress(100);
        setDownloadStatus("Map background saved successfully!");
        setIsMapBackgroundDownloaded(true);
        setTimeout(() => {
          setShowDownloadModal(false);
          alert?.success(
            "Map Saved",
            "Map background is now available offline!",
          );
        }, 1500);
      } else if (data.type === "tile_download_error") {
        setIsDownloading(false);
        setShowDownloadModal(false);
        alert?.error(
          "Download Failed",
          data.error || "Failed to save map background.",
        );
      }
    } catch (e) {
      console.error("Error parsing WebView message", e);
    }
  };

  useEffect(() => {
    if (!showMap || loading) return;
    if (areaCoords) {
      injectToWebView(
        `window.updateMap('addArea', { id: ${areaId}, lat: ${areaCoords.lat}, lng: ${areaCoords.lng}, name: '${(areaName || "Area").replace(/'/g, "\\'")}' })`,
      );
    }
    if (siteCoords) {
      injectToWebView(
        `window.updateMap('addSite', { id: ${siteId}, lat: ${siteCoords.lat}, lng: ${siteCoords.lng}, name: '${(siteName || "Site").replace(/'/g, "\\'")}' })`,
      );
    }
    if (currentLocation) {
      injectToWebView(
        `window.updateMap('addUserLocation', { lat: ${currentLocation.lat}, lng: ${currentLocation.lng} })`,
      );
    }
    if (barangays.length > 0) {
      const data = barangays.map((b) => ({
        id: b.barangay_id,
        lat: b.coordinate[0],
        lng: b.coordinate[1],
        name: b.name,
      }));
      injectToWebView(
        `window.updateMap('addBarangays', ${JSON.stringify(data)})`,
      );
    }
    if (!hasFitted.current) {
      const points: [number, number][] = [];
      if (areaCoords) points.push([areaCoords.lat, areaCoords.lng]);
      if (siteCoords) points.push([siteCoords.lat, siteCoords.lng]);
      if (currentLocation)
        points.push([currentLocation.lat, currentLocation.lng]);
      if (points.length > 1) {
        injectToWebView(
          `window.updateMap('fitBounds', ${JSON.stringify(points)})`,
        );
        hasFitted.current = true;
      } else if (points.length === 1) {
        const [lat, lng] = points[0];
        injectToWebView(
          `window.updateMap('flyTo', { lat: ${lat}, lng: ${lng} })`,
        );
        hasFitted.current = true;
      }
    }
  }, [areaCoords, siteCoords, currentLocation, barangays, loading, showMap]);

  useEffect(() => {
    if (!showMap) return;
    injectToWebView(
      `window.updateHazardLayers({ flood: { enabled: ${showFlood}, url: '${MGB_FLOOD_TILE_URL}', type: 'xyz' }, landslide: { enabled: ${showLandslide}, url: '${MGB_LANDSLIDE_TILE_URL}', type: 'xyz' } })`,
    );
  }, [showFlood, showLandslide, showMap]);

  const viewClassifiedAreas = async () => {
    if (!selectedBarangay) return;
    setLoadingClassified(true);
    try {
      const token = await SecureStore.getItemAsync("token");
      const res = await fetch(
        `${API_BASE_URL}/barangay/${selectedBarangay.barangay_id}/classified-areas/`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok) throw new Error("Failed to fetch classified areas");
      const data = await res.json();
      if (data.success && data.data && data.data.length > 0) {
        const polygons = data.data.map((area: any) => {
          const cls = area.land_classification?.name?.toLowerCase() || "";
          let color = "#dc2626";
          if (cls.includes("forest")) color = "#16a34a";
          else if (cls.includes("agricultural")) color = "#eab308";
          else if (cls.includes("residential")) color = "#2563eb";
          return {
            coordinates: area.polygon.coordinates,
            color,
            name: area.name,
            classification: area.land_classification?.name,
          };
        });
        injectToWebView(
          `window.updateMap('drawClassifiedPolygons', ${JSON.stringify(polygons)})`,
        );
        alert?.success(
          "Layers Loaded",
          "Classified areas are now visible on the map.",
        );
        setShowBarangaySheet(false);
      } else {
        alert?.warning(
          "No Data",
          "No classified areas found for this barangay.",
        );
      }
    } catch (e) {
      console.error("Failed to load classified areas:", e);
      alert?.error("Error", "Failed to load classified areas.");
    } finally {
      setLoadingClassified(false);
    }
  };

  const viewHazardAreas = async () => {
    if (!selectedBarangay) return;
    setLoadingHazards(true);
    try {
      const token = await SecureStore.getItemAsync("token");
      const res = await fetch(`${API_BASE_URL}/get_hazard_areas/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch hazard areas");
      const data = await res.json();
      if (data.data) {
        const hazards = data.data.filter(
          (h: any) => h.barangay_id === selectedBarangay.barangay_id,
        );
        if (hazards.length > 0) {
          const polygons = hazards.map((h: any) => {
            let color = "#6b7280";
            const type = h.hazard_type?.toUpperCase();
            if (type === "FLOOD") color = "#3b82f6";
            else if (type === "LANDSLIDE") color = "#ef4444";
            else if (type === "EARTHQUAKE") color = "#8b5cf6";
            return {
              coordinates: h.polygon.coordinates,
              color,
              name: h.name,
              type: h.hazard_type,
            };
          });
          injectToWebView(
            `window.updateMap('drawHazardPolygons', ${JSON.stringify(polygons)})`,
          );
          alert?.success(
            "Layers Loaded",
            `Showing ${hazards.length} hazard area(s) on the map.`,
          );
          setShowBarangaySheet(false);
        } else {
          alert?.warning("No Data", "No hazard areas found for this barangay.");
        }
      }
    } catch (e) {
      console.error("Failed to load hazard areas:", e);
      alert?.error("Error", "Failed to load hazard areas.");
    } finally {
      setLoadingHazards(false);
    }
  };

  const hidePolygons = () => {
    injectToWebView(`window.updateMap('clearPolygons')`);
    setShowBarangaySheet(false);
    alert?.info("Layers Hidden", "All polygon layers have been cleared.");
  };

  const checkGPSReadiness = async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== "granted") {
        setGpsReadiness("cold");
        setGpsReadinessAge(null);
        return;
      }
      const lastKnown = await Location.getLastKnownPositionAsync();
      if (!lastKnown) {
        setGpsReadiness("cold");
        setGpsReadinessAge(null);
        return;
      }
      const ageHours = (Date.now() - lastKnown.timestamp) / (1000 * 60 * 60);
      setGpsReadinessAge(ageHours);
      if (ageHours < GPS_READY_HOURS) setGpsReadiness("ready");
      else if (ageHours < GPS_AGING_HOURS) setGpsReadiness("aging");
      else setGpsReadiness("cold");
    } catch (err) {
      console.error("Error checking GPS readiness:", err);
      setGpsReadiness("cold");
      setGpsReadinessAge(null);
    }
  };

  const formatReadinessAge = () => {
    if (gpsReadinessAge === null) return "never";
    if (gpsReadinessAge < 1 / 60) return "just now";
    if (gpsReadinessAge < 1)
      return `${Math.round(gpsReadinessAge * 60)} min ago`;
    if (gpsReadinessAge < 24) return `${gpsReadinessAge.toFixed(1)}h ago`;
    return `${Math.round(gpsReadinessAge / 24)}d ago`;
  };

  const acquireLocationRobust = async () => {
    if (isLocationEnabled && userCoordinates && !isAcquiringLocation) {
      injectToWebView(
        `window.updateMap('flyTo', { lat: ${userCoordinates.lat}, lng: ${userCoordinates.lng}, zoom: 15 })`,
      );
      return;
    }
    if (isAcquiringLocation) return;
    setIsAcquiringLocation(true);
    setGpsCountdown(30);
    const interval = setInterval(() => {
      setGpsCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        clearInterval(interval);
        alert?.error(
          "Permission Denied",
          "Location permission is required to enable tracking.",
        );
        setIsAcquiringLocation(false);
        return;
      }
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        clearInterval(interval);
        alert?.error(
          "Location Disabled",
          "Please enable GPS/Location in your device settings.",
        );
        setIsAcquiringLocation(false);
        return;
      }
      let loc: Location.LocationObject;
      let usedFallback = false;
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error("GPS_TIMEOUT")),
            GPS_LIVE_TIMEOUT_MS,
          );
        });
        loc = await Promise.race([
          Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          }),
          timeoutPromise,
        ]);
      } catch (liveErr: any) {
        console.warn(
          "Live GPS failed/timed out, trying fallback:",
          liveErr.message,
        );
        const lastKnown = await Location.getLastKnownPositionAsync();
        if (!lastKnown) {
          clearInterval(interval);
          if (liveErr.message === "GPS_TIMEOUT") {
            alert?.error(
              "GPS Signal Not Found",
              `Could not lock onto GPS after ${GPS_LIVE_TIMEOUT_MS / 1000}s. This is common under tree canopy. Please step outside.`,
            );
          } else {
            alert?.error(
              "GPS Error",
              "Unable to retrieve location. Please check device settings.",
            );
          }
          setIsAcquiringLocation(false);
          return;
        }
        loc = lastKnown;
        usedFallback = true;
      }
      clearInterval(interval);
      updateLocation(loc, true, usedFallback);
      setIsLocationEnabled(true);
      if (usedFallback) {
        alert?.warning(
          "Using Cached Location",
          "Live GPS unavailable. Using last known coordinates.",
        );
      } else {
        alert?.success(
          "Location Enabled",
          "GPS coordinates updated successfully.",
        );
      }
      checkGPSReadiness();
    } catch (error) {
      clearInterval(interval);
      console.error("Location error:", error);
      alert?.error("Error", "Unexpected error getting location.");
    } finally {
      setIsAcquiringLocation(false);
    }
  };

  const handleLocationToggle = async () => {
    if (isLocationEnabled) {
      stopLocationTracking();
      setIsLocationEnabled(false);
      setUserCoordinates(null);
      setGpsReadiness("cold");
      setShouldShowAlertIndicator(false);
      alert?.info(
        "Location Disabled",
        "Location tracking has been turned off.",
      );
      return;
    }
    acquireLocationRobust();
  };

  const handleAlertPress = (alertItem: any) => {
    setSelectedAlert(alertItem);
    setShowAlertModal(true);
  };

  const toggleBarangay = (id: number) => {
    setSelectedBarangays((prev) =>
      prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id],
    );
  };

  const downloadMapBackground = () => {
    if (!isOnline) {
      alert?.error(
        "Offline",
        "You must be online to download the map background.",
      );
      return;
    }
    alert?.info(
      "Downloading Map",
      "Saving map background for offline use. Keep the app open.",
    );
    let bounds = [
      [11.0, 124.5],
      [11.1, 124.7],
    ];
    const offset = 0.05;
    if (areaCoords) {
      bounds = [
        [areaCoords.lat - offset, areaCoords.lng - offset],
        [areaCoords.lat + offset, areaCoords.lng + offset],
      ];
    } else if (currentLocation) {
      bounds = [
        [currentLocation.lat - offset, currentLocation.lng - offset],
        [currentLocation.lat + offset, currentLocation.lng + offset],
      ];
    }
    const minZoom = 10;
    const maxZoom = 15;
    injectToWebView(
      `window.downloadMapBackground(${JSON.stringify(bounds)}, ${minZoom}, ${maxZoom})`,
    );
  };

  const handleDownloadWithOptions = async () => {
    if (!isOnline) {
      alert?.error("Offline", "You need to be online to download polygons.");
      return;
    }
    setShowDownloadOptions(false);
    setShowDownloadModal(true);
    setDownloadProgress(0);
    setDownloadStatus("Starting polygon download...");
    setIsDownloading(true);
    try {
      let result;
      if (downloadOption === "barangay" && selectedBarangays.length > 0) {
        result = await PolygonDownloadService.downloadForBarangay(
          selectedBarangays,
          (progress) => {
            setDownloadProgress(progress.current);
            setDownloadStatus(progress.status);
          },
        );
      } else if (downloadOption === "high_priority") {
        result = await PolygonDownloadService.downloadHighPriority(
          selectedBarangays.length > 0 ? selectedBarangays : undefined,
          (progress) => {
            setDownloadProgress(progress.current);
            setDownloadStatus(progress.status);
          },
        );
      } else {
        result = await PolygonDownloadService.downloadPolygonsFiltered(
          { maxPolygons: 200, maxSizeMB: 5 },
          (progress) => {
            setDownloadProgress(progress.current);
            setDownloadStatus(progress.status);
          },
        );
      }
      await checkPolygons();
      await updateDownloadedStats();
      setHasDownloadedPolygons(true);
      if (showMap) setTimeout(() => loadDownloadedPolygons(), 1500);
      alert?.success(
        "Download Complete",
        `${result.classified} classified areas, ${result.hazard} hazard zones (${PolygonDownloadService.formatSize(result.totalSize)})`,
      );
      setTimeout(() => {
        setShowDownloadModal(false);
        setIsDownloading(false);
      }, 1500);
    } catch (error: any) {
      console.error("Download error:", error);
      alert?.error(
        "Download Failed",
        error.message || "Failed to download polygons.",
      );
      setShowDownloadModal(false);
      setIsDownloading(false);
    }
  };

  const handleSimpleDownload = async () => {
    await updateDownloadedStats();
    setShowDownloadOptions(true);
  };

  const handleDeletePolygons = async () => {
    Alert.alert(
      "Delete Downloaded Polygons",
      "This will remove all downloaded polygon data. Geofencing will stop working offline. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete All",
          style: "destructive",
          onPress: async () => {
            try {
              await PolygonDownloadService.deleteAllPolygons();
              setHasDownloadedPolygons(false);
              setShouldShowAlertIndicator(false);
              await refreshPolygonStatus();
              await updateDownloadedStats();
              if (geofencingActive) await stopGeofencing();
              injectToWebView(`window.updateMap('clearPolygons')`);
              alert?.success("Deleted", "All polygon data has been removed.");
            } catch (error) {
              console.error("Failed to delete polygons:", error);
              alert?.error("Error", "Failed to delete polygons.");
            }
          },
        },
      ],
    );
  };

  const title = siteName
    ? `${siteName} (${areaName || "Area"})`
    : areaName || "Location Map";

  const getSignalLevel = (accuracy: number | null) => {
    if (accuracy == null) return 0;
    if (accuracy < 5) return 5;
    if (accuracy < 10) return 4;
    if (accuracy < 20) return 3;
    if (accuracy < 40) return 2;
    return 1;
  };

  return (
    <>
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowMap(true)}
        activeOpacity={0.85}
      >
        <Ionicons name="map" size={24} color="#FFFFFF" />
      </TouchableOpacity>

      <Modal
        visible={showMap}
        animationType="slide"
        onRequestClose={() => setShowMap(false)}
      >
        <View style={styles.modalContainer}>
          {/* 🚨 HAZARD ALERT BANNER — slides in from top */}
          {/* <HazardAlertBanner
            alerts={alerts}
            visible={
              shouldShowAlertIndicator && isLocationEnabled && alerts.length > 0
            }
            onPress={() => {
              if (alerts.length > 0) handleAlertPress(alerts[0]);
            }}
          /> */}

          <View style={styles.header}>
            <TouchableOpacity onPress={() => setShowMap(false)}>
              <Ionicons name="close" size={28} color="#0F4A2F" />
            </TouchableOpacity>
            <View style={styles.headerTitleWrap}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {title}
              </Text>
            </View>
            <View style={styles.headerRight}>
              {hasDownloadedPolygons && geofencingActive && (
                <View style={styles.polygonStatusBadge}>
                  <Ionicons name="shield-checkmark" size={14} color="#16a34a" />
                  <Text style={styles.polygonStatusText}>Active</Text>
                </View>
              )}
              <TouchableOpacity
                onPress={() => setShowLayerPanel(!showLayerPanel)}
                style={styles.layerToggleBtn}
              >
                <Ionicons
                  name={showLayerPanel ? "close-circle" : "layers-outline"}
                  size={24}
                  color="#0F4A2F"
                />
              </TouchableOpacity>
            </View>
          </View>

          {!isOnline && showOfflineWarning && (
            <View style={styles.offlineWarningBanner}>
              <Ionicons
                name="cloud-offline-outline"
                size={16}
                color="#f59e0b"
              />
              <Text style={styles.offlineWarningText}>
                Offline Mode - Using cached map
              </Text>
              <TouchableOpacity onPress={() => setShowOfflineWarning(false)}>
                <Ionicons name="close" size={16} color="#f59e0b" />
              </TouchableOpacity>
            </View>
          )}

          {isLocationEnabled && gpsReadiness !== "cold" && (
            <GPSReadinessBanner
              readiness={gpsReadiness}
              ageText={formatReadinessAge()}
              onRefresh={checkGPSReadiness}
            />
          )}

          <View style={styles.polygonStatusBar}>
            <View style={styles.polygonStatusLeft}>
              <Ionicons
                name={
                  hasDownloadedPolygons
                    ? "checkmark-circle"
                    : "download-outline"
                }
                size={14}
                color={hasDownloadedPolygons ? "#16a34a" : "#f59e0b"}
              />
              <Text style={styles.polygonStatusBarText}>
                {hasDownloadedPolygons
                  ? `${downloadedStats.classified + downloadedStats.hazards} polygons ready`
                  : "No polygons downloaded"}
              </Text>
            </View>
          </View>

          {showLayerPanel && (
            <View style={styles.layerPanel}>
              <Text style={styles.layerPanelTitle}>Hazard Layers (MGB)</Text>
              <TouchableOpacity
                style={[
                  styles.layerToggle,
                  showFlood && styles.layerToggleActiveFlood,
                ]}
                onPress={() => setShowFlood(!showFlood)}
              >
                <Ionicons
                  name="water-outline"
                  size={18}
                  color={showFlood ? "#fff" : "#1565C0"}
                />
                <Text
                  style={[
                    styles.layerToggleText,
                    showFlood && styles.layerToggleTextActive,
                  ]}
                >
                  Flood Zones
                </Text>
                {showFlood && (
                  <Ionicons name="checkmark" size={18} color="#fff" />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.layerToggle,
                  showLandslide && styles.layerToggleActiveLandslide,
                ]}
                onPress={() => setShowLandslide(!showLandslide)}
              >
                <Ionicons
                  name="trail-sign-outline"
                  size={18}
                  color={showLandslide ? "#fff" : "#6D4C41"}
                />
                <Text
                  style={[
                    styles.layerToggleText,
                    showLandslide && styles.layerToggleTextActive,
                  ]}
                >
                  Landslide Zones
                </Text>
                {showLandslide && (
                  <Ionicons name="checkmark" size={18} color="#fff" />
                )}
              </TouchableOpacity>

              <View style={styles.offlineSection}>
                <Text style={styles.layerPanelTitle}>Offline Data</Text>
                <View style={styles.offlineRow}>
                  <View style={styles.offlineInfo}>
                    <Ionicons
                      name={
                        isMapBackgroundDownloaded
                          ? "checkmark-circle"
                          : "map-outline"
                      }
                      size={18}
                      color={isMapBackgroundDownloaded ? "#16a34a" : "#6B7280"}
                    />
                    <Text style={styles.offlineText}>
                      {isMapBackgroundDownloaded
                        ? "Map Saved Offline"
                        : "Map Not Saved"}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.miniBtn,
                      isMapBackgroundDownloaded
                        ? styles.miniBtnSuccess
                        : styles.miniBtnPrimary,
                    ]}
                    onPress={downloadMapBackground}
                    disabled={!isOnline}
                  >
                    <Ionicons name="save-outline" size={14} color="#fff" />
                    <Text style={styles.miniBtnText}>
                      {isMapBackgroundDownloaded ? "Update" : "Save"}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.offlineRow}>
                  <View style={styles.offlineInfo}>
                    <Ionicons
                      name={
                        hasDownloadedPolygons
                          ? "checkmark-circle"
                          : "cloud-download-outline"
                      }
                      size={18}
                      color={hasDownloadedPolygons ? "#16a34a" : "#6B7280"}
                    />
                    <Text style={styles.offlineText}>
                      {hasDownloadedPolygons
                        ? `${downloadedStats.classified + downloadedStats.hazards} Polygons`
                        : "No Polygons"}
                    </Text>
                  </View>
                  <View style={styles.offlineActions}>
                    {hasDownloadedPolygons ? (
                      <>
                        <TouchableOpacity
                          onPress={loadDownloadedPolygons}
                          style={styles.iconBtn}
                          disabled={isLoadingPolygons}
                        >
                          {isLoadingPolygons ? (
                            <ActivityIndicator size="small" color="#0F4A2F" />
                          ) : (
                            <Ionicons
                              name="folder-open-outline"
                              size={18}
                              color="#0F4A2F"
                            />
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={handleSimpleDownload}
                          style={styles.iconBtn}
                        >
                          <Ionicons
                            name="refresh-outline"
                            size={18}
                            color="#0F4A2F"
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={handleDeletePolygons}
                          style={styles.iconBtn}
                        >
                          <Ionicons
                            name="trash-outline"
                            size={18}
                            color="#ef4444"
                          />
                        </TouchableOpacity>
                      </>
                    ) : (
                      <TouchableOpacity
                        onPress={handleSimpleDownload}
                        style={[styles.miniBtn, styles.miniBtnPrimary]}
                      >
                        <Text style={styles.miniBtnText}>Download</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>

              <View style={styles.infoBox}>
                <Ionicons name="information-circle" size={14} color="#6B7280" />
                <Text style={styles.infoText}>
                  Tap barangay markers to view classified areas and hazard zones
                </Text>
              </View>
            </View>
          )}

          <View style={styles.mapContainer}>
            {loading ? (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color="#0F4A2F" />
                <Text style={styles.loadingText}>Loading map data...</Text>
              </View>
            ) : (
              <>
                <WebView
                  ref={webViewRef}
                  source={{ html: mapHtml }}
                  style={styles.map}
                  javaScriptEnabled={true}
                  domStorageEnabled={true}
                  originWhitelist={["*"]}
                  startInLoadingState={true}
                  onMessage={onWebViewMessage}
                  renderLoading={() => (
                    <View style={styles.loadingOverlay}>
                      <ActivityIndicator size="large" color="#0F4A2F" />
                    </View>
                  )}
                />

                {/* 🚨 Ambient vignette overlay when inside hazard */}
                <HazardVignette
                  visible={
                    shouldShowAlertIndicator &&
                    isLocationEnabled &&
                    alerts.length > 0
                  }
                />

                {/* 🚨 Enhanced floating hazard indicator — bottom center */}
                {shouldShowAlertIndicator && isLocationEnabled && (
                  <View style={styles.hazardIndicatorContainer}>
                    <HazardIndicator
                      alerts={alerts}
                      onPress={() => {
                        if (alerts.length > 0) handleAlertPress(alerts[0]);
                      }}
                    />
                  </View>
                )}
              </>
            )}
          </View>

          <View style={styles.infoBar}>
            <View style={styles.legendItem}>
              <View
                style={[styles.legendDot, { backgroundColor: "#3b82f6" }]}
              />
              <Text style={styles.legendText}>You</Text>
            </View>
            <View style={styles.legendItem}>
              <View
                style={[styles.legendDot, { backgroundColor: "#16a34a" }]}
              />
              <Text style={styles.legendText}>Site</Text>
            </View>
            <View style={styles.legendItem}>
              <View
                style={[styles.legendDot, { backgroundColor: "#eab308" }]}
              />
              <Text style={styles.legendText}>Area</Text>
            </View>
            <View style={styles.legendItem}>
              <View
                style={[styles.legendDot, { backgroundColor: "#f59e0b" }]}
              />
              <Text style={styles.legendText}>Barangay</Text>
            </View>

            {userCoordinates && (
              <View style={styles.coordDisplay}>
                <Ionicons name="location" size={12} color="#0F4A2F" />
                <Text style={styles.coordDisplayText} numberOfLines={1}>
                  {userCoordinates.lat.toFixed(5)},{" "}
                  {userCoordinates.lng.toFixed(5)}
                </Text>
                <View style={styles.signalBarsMini}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <View
                      key={n}
                      style={[
                        styles.signalBarMini,
                        {
                          height: 3 + n * 2,
                          opacity:
                            n <= getSignalLevel(userCoordinates.accuracy)
                              ? 1
                              : 0.2,
                        },
                      ]}
                    />
                  ))}
                </View>
                {userCoordinates.accuracy !== null && (
                  <View style={styles.accuracyBadge}>
                    <Text style={styles.accuracyText}>
                      ±{Math.round(userCoordinates.accuracy)}m
                    </Text>
                  </View>
                )}
                {userCoordinates.isFallback && (
                  <View style={styles.cachedBadge}>
                    <Text style={styles.cachedText}>Cached</Text>
                  </View>
                )}
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.recenterBtn,
                (isLocationEnabled || isAcquiringLocation) &&
                  styles.recenterBtnActive,
              ]}
              onPress={handleLocationToggle}
              disabled={isAcquiringLocation}
              activeOpacity={0.8}
            >
              {isAcquiringLocation ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons
                  name={isLocationEnabled ? "navigate" : "navigate-outline"}
                  size={18}
                  color="#fff"
                />
              )}
              <Text style={styles.recenterText}>
                {isAcquiringLocation
                  ? `Acquiring (${gpsCountdown}s)`
                  : isLocationEnabled
                    ? "Turn Off"
                    : "Enable Location"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        transparent
        visible={showBarangaySheet}
        animationType="slide"
        onRequestClose={() => setShowBarangaySheet(false)}
      >
        <Pressable
          style={styles.sheetOverlay}
          onPress={() => setShowBarangaySheet(false)}
        >
          <Pressable
            style={styles.sheetContent}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.dragHandle} />
            <View style={styles.sheetHeader}>
              <Ionicons name="location" size={24} color="#eab308" />
              <Text style={styles.sheetTitle}>{selectedBarangay?.name}</Text>
            </View>
            <Text style={styles.sheetSubtitle}>Barangay Layers & Analysis</Text>

            <TouchableOpacity
              style={[
                styles.sheetActionBtn,
                loadingClassified && styles.sheetActionBtnDisabled,
              ]}
              onPress={viewClassifiedAreas}
              disabled={loadingClassified}
            >
              <View
                style={[styles.sheetIconWrap, { backgroundColor: "#dcfce7" }]}
              >
                {loadingClassified ? (
                  <ActivityIndicator size="small" color="#16a34a" />
                ) : (
                  <Ionicons name="layers" size={20} color="#16a34a" />
                )}
              </View>
              <View style={styles.sheetTextWrap}>
                <Text style={styles.sheetActionTitle}>
                  View Classified Areas
                </Text>
                <Text style={styles.sheetActionDesc}>
                  Show land use polygons
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.sheetActionBtn,
                loadingHazards && styles.sheetActionBtnDisabled,
              ]}
              onPress={viewHazardAreas}
              disabled={loadingHazards}
            >
              <View
                style={[styles.sheetIconWrap, { backgroundColor: "#fee2e2" }]}
              >
                {loadingHazards ? (
                  <ActivityIndicator size="small" color="#ef4444" />
                ) : (
                  <Ionicons name="warning" size={20} color="#ef4444" />
                )}
              </View>
              <View style={styles.sheetTextWrap}>
                <Text style={styles.sheetActionTitle}>View Hazard Areas</Text>
                <Text style={styles.sheetActionDesc}>
                  Show flood/landslide zones
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sheetActionBtn, { backgroundColor: "#f3f4f6" }]}
              onPress={hidePolygons}
            >
              <View
                style={[styles.sheetIconWrap, { backgroundColor: "#e5e7eb" }]}
              >
                <Ionicons name="eye-off" size={20} color="#6b7280" />
              </View>
              <Text style={[styles.sheetActionTitle, { color: "#6b7280" }]}>
                Hide All Layers
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <PolygonAlertModal
        visible={showAlertModal}
        alert={selectedAlert}
        onClose={() => {
          setShowAlertModal(false);
          setSelectedAlert(null);
        }}
      />

      <Modal
        visible={showDownloadOptions}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDownloadOptions(false)}
      >
        <Pressable
          style={styles.downloadOptionsOverlay}
          onPress={() => setShowDownloadOptions(false)}
        >
          <Pressable
            style={styles.downloadOptionsContent}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.dragHandle} />
            <Text style={styles.downloadOptionsTitle}>
              📥 Download Polygons
            </Text>
            <Text style={styles.downloadOptionsSubtitle}>
              Choose what polygons to download for offline detection
            </Text>

            {hasDownloadedPolygons && (
              <View style={styles.downloadedStats}>
                <Ionicons name="checkmark-circle" size={16} color="#16a34a" />
                <Text style={styles.downloadedStatsText}>
                  Already downloaded: {downloadedStats.classified} classified,{" "}
                  {downloadedStats.hazards} hazards ({downloadedStats.size})
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.downloadOption,
                downloadOption === "all" && styles.downloadOptionActive,
              ]}
              onPress={() => setDownloadOption("all")}
            >
              <View style={styles.downloadOptionLeft}>
                <Ionicons
                  name={
                    downloadOption === "all"
                      ? "radio-button-on"
                      : "radio-button-off"
                  }
                  size={20}
                  color={downloadOption === "all" ? "#0F4A2F" : "#9CA3AF"}
                />
                <View>
                  <Text style={styles.downloadOptionTitle}>All Polygons</Text>
                  <Text style={styles.downloadOptionDesc}>
                    Download all classified and hazard areas (up to 200
                    polygons)
                  </Text>
                </View>
              </View>
              <View style={styles.downloadOptionBadge}>
                <Text style={styles.downloadOptionBadgeText}>~5MB</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.downloadOption,
                downloadOption === "barangay" && styles.downloadOptionActive,
              ]}
              onPress={() => setDownloadOption("barangay")}
            >
              <View style={styles.downloadOptionLeft}>
                <Ionicons
                  name={
                    downloadOption === "barangay"
                      ? "radio-button-on"
                      : "radio-button-off"
                  }
                  size={20}
                  color={downloadOption === "barangay" ? "#0F4A2F" : "#9CA3AF"}
                />
                <View>
                  <Text style={styles.downloadOptionTitle}>By Barangay</Text>
                  <Text style={styles.downloadOptionDesc}>
                    Download polygons for selected barangays only
                  </Text>
                </View>
              </View>
              <View style={styles.downloadOptionBadge}>
                <Text style={styles.downloadOptionBadgeText}>~1-3MB</Text>
              </View>
            </TouchableOpacity>

            {downloadOption === "barangay" && (
              <View style={styles.barangaySelection}>
                <Text style={styles.barangaySelectionTitle}>
                  Select Barangays ({selectedBarangays.length})
                </Text>
                <ScrollView style={styles.barangayList} nestedScrollEnabled>
                  {availableBarangays.map((b) => (
                    <TouchableOpacity
                      key={b.id}
                      style={[
                        styles.barangayItem,
                        selectedBarangays.includes(b.id) &&
                          styles.barangayItemSelected,
                      ]}
                      onPress={() => toggleBarangay(b.id)}
                    >
                      <Text
                        style={[
                          styles.barangayItemText,
                          selectedBarangays.includes(b.id) &&
                            styles.barangayItemTextSelected,
                        ]}
                      >
                        {b.name}
                      </Text>
                      {selectedBarangays.includes(b.id) && (
                        <Ionicons
                          name="checkmark-circle"
                          size={18}
                          color="#0F4A2F"
                        />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <View style={styles.downloadActions}>
              <TouchableOpacity
                style={styles.downloadCancelBtn}
                onPress={() => setShowDownloadOptions(false)}
              >
                <Text style={styles.downloadCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.downloadConfirmBtn,
                  downloadOption === "barangay" &&
                    selectedBarangays.length === 0 &&
                    styles.downloadConfirmBtnDisabled,
                ]}
                onPress={handleDownloadWithOptions}
                disabled={
                  downloadOption === "barangay" &&
                  selectedBarangays.length === 0
                }
              >
                <Ionicons
                  name="cloud-download-outline"
                  size={18}
                  color="#fff"
                />
                <Text style={styles.downloadConfirmText}>Download</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        transparent
        visible={showDownloadModal}
        animationType="fade"
        onRequestClose={() => {
          if (!isDownloading) setShowDownloadModal(false);
        }}
      >
        <View style={styles.downloadModalOverlay}>
          <View style={styles.downloadModalContent}>
            <Text style={styles.downloadModalTitle}>
              {isDownloading ? "Downloading..." : "Complete"}
            </Text>
            <View style={styles.downloadProgressBar}>
              <View
                style={[
                  styles.downloadProgressFill,
                  { width: `${downloadProgress}%` },
                ]}
              />
            </View>
            <Text style={styles.downloadProgressText}>{downloadProgress}%</Text>
            <Text style={styles.downloadStatusText}>{downloadStatus}</Text>
            {!isDownloading && downloadProgress === 100 && (
              <TouchableOpacity
                style={styles.downloadModalCloseBtn}
                onPress={() => setShowDownloadModal(false)}
              >
                <Text style={styles.downloadModalCloseText}>Close</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

// 🌐 LEAFLET HTML WITH OFFLINE SUPPORT (FIXED)
const mapHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    body { margin: 0; padding: 0; }
    #map { width: 100vw; height: 100vh; }
    .custom-div-icon { background: transparent; border: none; }
    .marker-pin { width: 30px; height: 30px; border-radius: 50% 50% 50% 0; background: #fff; position: absolute; transform: rotate(-45deg); left: 50%; top: 50%; margin: -15px 0 0 -15px; box-shadow: 0 2px 5px rgba(0,0,0,0.3); }
    .marker-pin::after { content: ''; width: 24px; height: 24px; margin: 3px 0 0 3px; background: #fff; position: absolute; border-radius: 50%; }
    .marker-pin.yellow { background: #eab308; } .marker-pin.yellow::after { background: #fde047; }
    .marker-pin.green { background: #16a34a; } .marker-pin.green::after { background: #bbf7d0; }
    .marker-pin.blue { background: #2563eb; } .marker-pin.blue::after { background: #bfdbfe; }
    .icon-label { position: absolute; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; transform: rotate(45deg); font-weight: bold; font-size: 12px; color: #000; }
    .pulse-ring { animation: pulse 1.5s ease-out infinite; }
    @keyframes pulse { 0% { opacity: 0.8; transform: scale(1); } 100% { opacity: 0; transform: scale(2.5); } }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { center: [11.02, 124.61], zoom: 13, zoomControl: true, fadeAnimation: true, zoomAnimation: true });
    var baseTileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OSM' }).addTo(map);
    var markers = { barangay: {}, area: null, site: null, user: null };
    var polygonLayers = { classified: null, hazards: null };
    var hazardTiles = { flood: null, landslide: null };
    var userPulse = null;

    function createIcon(colorClass, label) {
      return L.divIcon({ className: 'custom-div-icon', html: '<div class="marker-pin ' + colorClass + '"></div><div class="icon-label">' + label + '</div>', iconSize: [30, 30], iconAnchor: [15, 30] });
    }

    function sendClick(category, id) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'marker_click', category: category, id: id }));
    }

    window.updateMap = function(action, payload) {
      try {
        if (action === 'addBarangays') {
          payload.forEach(b => {
            if (markers.barangay[b.id]) map.removeLayer(markers.barangay[b.id]);
            var m = L.marker([b.lat, b.lng], { icon: createIcon('yellow', 'B') }).addTo(map);
            m.on('click', () => sendClick('barangay', b.id));
            m.bindPopup('<b>Barangay:</b> ' + b.name);
            markers.barangay[b.id] = m;
          });
        }
        else if (action === 'addArea') {
          if (markers.area) map.removeLayer(markers.area);
          markers.area = L.marker([payload.lat, payload.lng], { icon: L.divIcon({ className: 'custom', html: '<div style="background:#eab308;width:32px;height:32px;border-radius:50%;border:4px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:bold;font-size:13px;">A</div>', iconSize: [32, 32], iconAnchor: [16, 16] }) }).addTo(map).bindPopup('<b>Area:</b> ' + payload.name);
        }
        else if (action === 'addSite') {
          if (markers.site) map.removeLayer(markers.site);
          markers.site = L.marker([payload.lat, payload.lng], { icon: L.divIcon({ className: 'custom', html: '<div style="background:#16a34a;width:36px;height:36px;border-radius:50%;border:4px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:bold;font-size:14px;">S</div>', iconSize: [36, 36], iconAnchor: [18, 18] }) }).addTo(map).bindPopup('<b>Site:</b> ' + payload.name);
        }
        else if (action === 'addUserLocation') {
          if (markers.user) map.removeLayer(markers.user);
          if (userPulse) map.removeLayer(userPulse);
          markers.user = L.circleMarker([payload.lat, payload.lng], { radius: 12, color: '#ffffff', fillColor: '#3b82f6', fillOpacity: 0.9, weight: 3 }).addTo(map).bindPopup('<b>You are here</b>');
          userPulse = L.circleMarker([payload.lat, payload.lng], { radius: 20, color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.15, weight: 2, className: 'pulse-ring' }).addTo(map);
          setTimeout(function() { if (userPulse) map.removeLayer(userPulse); userPulse = null; }, 1500);
        }
        else if (action === 'flyTo') {
          var zoomLevel = map.getZoom();
          if (payload.zoom) zoomLevel = payload.zoom;
          map.flyTo([payload.lat, payload.lng], zoomLevel);
        }
        else if (action === 'fitBounds') {
          map.fitBounds(payload, { padding: [50, 50] });
        }
        else if (action === 'drawClassifiedPolygons') {
          if (polygonLayers.classified) { map.removeLayer(polygonLayers.classified); polygonLayers.classified = null; }
          var group = L.layerGroup();
          payload.forEach(p => {
            try { L.polygon(p.coordinates, { color: p.color, fillColor: p.color, fillOpacity: 0.4, weight: 2 }).bindPopup('<b>' + p.name + '</b><br>Class: ' + p.classification).addTo(group); } 
            catch(e) { console.warn('Error drawing classified polygon:', e); }
          });
          group.addTo(map); polygonLayers.classified = group;
        }
        else if (action === 'drawHazardPolygons') {
          if (polygonLayers.hazards) { map.removeLayer(polygonLayers.hazards); polygonLayers.hazards = null; }
          var group = L.layerGroup();
          payload.forEach(p => {
            try { L.polygon(p.coordinates, { color: p.color, fillColor: p.color, fillOpacity: 0.4, weight: 2 }).bindPopup('<b>' + p.name + '</b><br>Type: ' + p.type).addTo(group); }
            catch(e) { console.warn('Error drawing hazard polygon:', e); }
          });
          group.addTo(map); polygonLayers.hazards = group;
        }
        else if (action === 'clearPolygons') {
          if (polygonLayers.classified) { map.removeLayer(polygonLayers.classified); polygonLayers.classified = null; }
          if (polygonLayers.hazards) { map.removeLayer(polygonLayers.hazards); polygonLayers.hazards = null; }
        }
      } catch (e) { console.error('updateMap error:', e); }
    };

    var transparentPixel = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

    window.updateHazardLayers = function(config) {
      if (hazardTiles.flood) { map.removeLayer(hazardTiles.flood); hazardTiles.flood = null; }
      if (hazardTiles.landslide) { map.removeLayer(hazardTiles.landslide); hazardTiles.landslide = null; }
      if (config.flood && config.flood.enabled) {
        hazardTiles.flood = L.tileLayer(config.flood.url, { opacity: 0.7, maxZoom: 19, maxNativeZoom: 17, errorTileUrl: transparentPixel }).addTo(map);
      }
      if (config.landslide && config.landslide.enabled) {
        hazardTiles.landslide = L.tileLayer(config.landslide.url, { opacity: 0.7, maxZoom: 19, maxNativeZoom: 17, errorTileUrl: transparentPixel }).addTo(map);
      }
    };

    window.downloadMapBackground = function(bounds, minZoom, maxZoom) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'tile_download_start' }));
      var latMin = bounds[0][0]; var lngMin = bounds[0][1]; var latMax = bounds[1][0]; var lngMax = bounds[1][1];
      var totalTiles = 0; var downloadedTiles = 0;
      for (var z = minZoom; z <= maxZoom; z++) {
        var n = Math.pow(2, z);
        var xMin = Math.floor((lngMin + 180) / 360 * n);
        var xMax = Math.floor((lngMax + 180) / 360 * n);
        var yMin = Math.floor((1 - Math.log(Math.tan(latMax * Math.PI / 180) + 1 / Math.cos(latMax * Math.PI / 180)) / Math.PI) / 2 * n);
        var yMax = Math.floor((1 - Math.log(Math.tan(latMin * Math.PI / 180) + 1 / Math.cos(latMin * Math.PI / 180)) / Math.PI) / 2 * n);
        for (var x = xMin; x <= xMax; x++) {
          for (var y = yMin; y <= yMax; y++) {
            totalTiles++;
            var tileUrl = 'https://tile.openstreetmap.org/' + z + '/' + x + '/' + y + '.png';
            var img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = function() {
              downloadedTiles++;
              var progress = Math.round((downloadedTiles / totalTiles) * 100);
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'tile_download_progress', progress: progress }));
              if (downloadedTiles === totalTiles) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'tile_download_complete', count: totalTiles }));
              }
            };
            img.onerror = function() {
              downloadedTiles++;
              var progress = Math.round((downloadedTiles / totalTiles) * 100);
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'tile_download_progress', progress: progress }));
            };
            img.src = tileUrl;
          }
        }
      }
    };
  </script>
</body>
</html>
`;

const styles = StyleSheet.create({
  // 🚨 HAZARD ALERT BANNER STYLES
  hazardBanner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
    paddingHorizontal: 12,
    paddingTop: 52,
    paddingBottom: 8,
  },
  hazardBannerInner: {
    backgroundColor: "#DC2626",
    borderRadius: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 12,
    overflow: "hidden",
  },
  hazardBannerTouchable: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  hazardBannerIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  hazardBannerTextWrap: {
    flex: 1,
  },
  hazardBannerTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.3,
  },
  hazardBannerSubtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.85)",
    marginTop: 2,
  },
  hazardBannerTap: {
    fontSize: 10,
    color: "rgba(255,255,255,0.6)",
    marginTop: 3,
    fontWeight: "600",
  },

  // 🚨 ENHANCED FLOATING HAZARD INDICATOR STYLES
  hazardIndicatorContainer: {
    position: "absolute",
    bottom: 10,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 1000,
    elevation: 10,
  },
  hazardIndicatorWrap: {
    alignItems: "center",
    justifyContent: "center",
    width: 120,
    height: 140,
  },
  hazardIndicatorBall: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 4,
    borderColor: "#fff",
    zIndex: 10,
  },
  hazardIndicatorLabelWrap: {
    marginTop: 8,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  hazardIndicatorLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  hazardCountBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#991B1B",
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  hazardCountText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
  },

  // 🚨 AMBIENT VIGNETTE OVERLAY
  vignetteOverlay: {
    backgroundColor: "rgba(220, 38, 38, 0.08)",
  },

  // Existing styles preserved
  downloadedStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#dcfce7",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  downloadedStatsText: {
    fontSize: 12,
    color: "#166534",
    fontWeight: "500",
    flex: 1,
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 120,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#0F4A2F",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    zIndex: 100,
  },
  modalContainer: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerTitleWrap: { flex: 1, alignItems: "center", marginHorizontal: 8 },
  headerTitle: { fontSize: 16, fontWeight: "700", color: "#0F4A2F" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  polygonStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#dcfce7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
  },
  polygonStatusText: { fontSize: 10, fontWeight: "600", color: "#16a34a" },
  layerToggleBtn: { padding: 4 },
  polygonStatusBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f8fafc",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    flexWrap: "wrap",
    minHeight: 40,
  },
  polygonStatusLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 1,
  },
  polygonStatusBarText: {
    fontSize: 12,
    color: "#475569",
    fontWeight: "500",
    flexShrink: 1,
  },

  gpsBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginHorizontal: 14,
    marginBottom: 12,
    borderWidth: 1,
  },
  gpsBannerTitle: { fontSize: 12, fontWeight: "700" },
  gpsBannerMessage: { fontSize: 11, marginTop: 1, opacity: 0.85 },
  gpsBannerRefresh: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(0,0,0,0.05)",
    justifyContent: "center",
    alignItems: "center",
  },

  offlineSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  offlineRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  offlineInfo: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  offlineText: { fontSize: 13, color: "#111", fontWeight: "500" },
  offlineActions: { flexDirection: "row", gap: 8 },
  miniBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  miniBtnPrimary: { backgroundColor: "#0F4A2F" },
  miniBtnSuccess: { backgroundColor: "#16a34a" },
  miniBtnText: { fontSize: 11, fontWeight: "600", color: "#fff" },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },

  layerPanel: {
    backgroundColor: "#F9FAFB",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  layerPanelTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6B7280",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  layerToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 6,
  },
  layerToggleActiveFlood: {
    backgroundColor: "#1565C0",
    borderColor: "#1565C0",
  },
  layerToggleActiveLandslide: {
    backgroundColor: "#6D4C41",
    borderColor: "#6D4C41",
  },
  layerToggleText: { flex: 1, fontSize: 13, color: "#111", fontWeight: "600" },
  layerToggleTextActive: { color: "#fff" },
  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F3F4F6",
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  infoText: { flex: 1, fontSize: 11, color: "#6B7280" },
  mapContainer: { flex: 1, position: "relative" },
  map: { flex: 1 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  loadingText: {
    fontSize: 13,
    color: "#0F4A2F",
    fontWeight: "600",
    marginTop: 10,
  },
  infoBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    gap: 8,
    paddingBottom: 28,
    flexWrap: "wrap",
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 10, color: "#4B5563", fontWeight: "600" },
  coordDisplay: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#f0fdf4",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    flexWrap: "wrap",
  },
  coordDisplayText: {
    fontSize: 10,
    color: "#0F4A2F",
    fontWeight: "600",
    maxWidth: 100,
  },
  accuracyBadge: {
    backgroundColor: "#dcfce7",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 8,
  },
  accuracyText: { fontSize: 8, color: "#16a34a", fontWeight: "700" },

  signalBarsMini: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
    height: 14,
  },
  signalBarMini: { width: 3, borderRadius: 1.5, backgroundColor: "#16a34a" },
  cachedBadge: {
    backgroundColor: "#fef3c7",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#fcd34d",
  },
  cachedText: { fontSize: 8, color: "#92400e", fontWeight: "700" },

  recenterBtn: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#6b7280",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  recenterBtnActive: { backgroundColor: "#2563eb" },
  recenterText: { color: "#fff", fontSize: 10, fontWeight: "700" },

  sheetOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheetContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
  },
  dragHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#E5E7EB",
    alignSelf: "center",
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  sheetTitle: { fontSize: 20, fontWeight: "800", color: "#111", flex: 1 },
  sheetSubtitle: { fontSize: 13, color: "#6b7280", marginBottom: 20 },
  sheetActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: 12,
  },
  sheetActionBtnDisabled: { opacity: 0.6 },
  sheetIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  sheetTextWrap: { flex: 1 },
  sheetActionTitle: { fontSize: 14, fontWeight: "700", color: "#111" },
  sheetActionDesc: { fontSize: 11, color: "#6b7280", marginTop: 2 },
  downloadOptionsOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  downloadOptionsContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
    maxHeight: "85%",
  },
  downloadOptionsTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111",
    textAlign: "center",
  },
  downloadOptionsSubtitle: {
    fontSize: 13,
    color: "#6b7280",
    textAlign: "center",
    marginTop: 4,
    marginBottom: 16,
  },
  downloadOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    marginBottom: 10,
    backgroundColor: "#f9fafb",
  },
  downloadOptionActive: { borderColor: "#0F4A2F", backgroundColor: "#f0fdf4" },
  downloadOptionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  downloadOptionTitle: { fontSize: 14, fontWeight: "700", color: "#111" },
  downloadOptionDesc: { fontSize: 11, color: "#6b7280", marginTop: 1 },
  downloadOptionBadge: {
    backgroundColor: "#e5e7eb",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  downloadOptionBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#6b7280",
  },
  barangaySelection: {
    marginTop: 8,
    marginBottom: 12,
    padding: 12,
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    maxHeight: 200,
  },
  barangaySelectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
    marginBottom: 8,
  },
  barangayList: { maxHeight: 150 },
  barangayItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "#fff",
    marginBottom: 4,
  },
  barangayItemSelected: { backgroundColor: "#dcfce7" },
  barangayItemText: { fontSize: 13, color: "#111" },
  barangayItemTextSelected: { color: "#0F4A2F", fontWeight: "600" },
  downloadActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  downloadCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#f3f4f6",
  },
  downloadCancelText: { fontSize: 14, fontWeight: "600", color: "#6b7280" },
  downloadConfirmBtn: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0F4A2F",
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  downloadConfirmBtnDisabled: { backgroundColor: "#d1d5db" },
  downloadConfirmText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  downloadModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  downloadModalContent: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 28,
    width: "100%",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  downloadModalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111",
    marginBottom: 16,
  },
  downloadProgressBar: {
    width: "100%",
    height: 8,
    backgroundColor: "#e5e7eb",
    borderRadius: 4,
    overflow: "hidden",
  },
  downloadProgressFill: {
    height: "100%",
    backgroundColor: "#0F4A2F",
    borderRadius: 4,
  },
  downloadProgressText: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0F4A2F",
    marginTop: 12,
  },
  downloadStatusText: {
    fontSize: 13,
    color: "#6b7280",
    marginTop: 4,
    textAlign: "center",
  },
  downloadModalCloseBtn: {
    marginTop: 16,
    backgroundColor: "#0F4A2F",
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
  },
  downloadModalCloseText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  offlineWarningBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fef3c7",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f59e0b",
    gap: 8,
  },
  offlineWarningText: {
    flex: 1,
    fontSize: 12,
    color: "#92400e",
    fontWeight: "600",
  },
});
