import { useRouter } from "expo-router";
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Dimensions,
  Pressable,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Platform,
  StatusBar,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { WebView } from "react-native-webview";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { api } from "@/constants/url_fixed";
import { useNetworkStatus } from "@/utils/networkStatus";
import { useAlert } from "@/components/AlertContext";

const screenHeight = Dimensions.get("window").height;
const API_BASE_URL = api + "/api";
const OFFLINE_AREAS_KEY = "@plantscope_offline_areas";

/* ──────────────────────────────────────────────────────────────────
   DESIGN TOKENS
   ─────────────────────────────────────────────────────────────── */
const BG = "#F5F6F8";
const PRIMARY = "#0F4A2F";
const INK = "#111827";
const MUTED = "#6B7280";
const FAINT = "#9CA3AF";

const cardShadow = {
  shadowColor: "#0F172A",
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.03,
  shadowRadius: 8,
  elevation: 1,
};

type ReforestationArea = {
  reforestation_area_id: string;
  assigned_onsite_inspector_id: string;
  name: string;
  description: string | null;
  coordinate: [number, number] | { latitude: number; longitude: number } | null;
  latitude: number;
  longitude: number;
  coord_display: string;
  assigned_at: string;
};

const ReforestationAreas: React.FC = () => {
  const insets = useSafeAreaInsets();
  const {
    success,
    error: showError,
    warning,
    info: showInfo,
    confirm,
  } = useAlert();

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedArea, setSelectedArea] = useState<ReforestationArea | null>(
    null,
  );
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [actionSheetArea, setActionSheetArea] =
    useState<ReforestationArea | null>(null);
  const [searchText, setSearchText] = useState("");
  const [areas, setAreas] = useState<ReforestationArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const [offlineAreaIds, setOfflineAreaIds] = useState<Set<string>>(new Set());
  const [offlineCount, setOfflineCount] = useState(0);
  const [savingOffline, setSavingOffline] = useState<string | null>(null);

  const router = useRouter();
  const isOnline = useNetworkStatus();

  useEffect(() => {
    loadOfflineAreaIds();
  }, []);

  const loadOfflineAreaIds = async () => {
    try {
      const saved = await AsyncStorage.getItem(OFFLINE_AREAS_KEY);
      if (saved) {
        const savedAreas: ReforestationArea[] = JSON.parse(saved);
        const ids = new Set(savedAreas.map((a) => a.reforestation_area_id));
        setOfflineAreaIds(ids);
        setOfflineCount(savedAreas.length);
      } else {
        setOfflineCount(0);
      }
    } catch (error) {
      console.error("Error loading offline areas:", error);
    }
  };

  const saveAreaForOffline = async (area: ReforestationArea) => {
    setSavingOffline(area.reforestation_area_id);
    try {
      const saved = await AsyncStorage.getItem(OFFLINE_AREAS_KEY);
      const savedAreas: ReforestationArea[] = saved ? JSON.parse(saved) : [];

      const alreadySaved = savedAreas.some(
        (a) => a.reforestation_area_id === area.reforestation_area_id,
      );
      if (alreadySaved) {
        showInfo("Info", `${area.name} is already saved for offline use.`);
        return;
      }

      const updatedAreas = [...savedAreas, area];
      await AsyncStorage.setItem(
        OFFLINE_AREAS_KEY,
        JSON.stringify(updatedAreas),
      );

      setOfflineAreaIds(
        new Set(updatedAreas.map((a) => a.reforestation_area_id)),
      );
      setOfflineCount(updatedAreas.length);

      success("Success", `${area.name} saved for offline use.`);
    } catch (error) {
      showError("Error", "Failed to save area for offline use.");
    } finally {
      setSavingOffline(null);
    }
  };

  const removeAreaFromOffline = (area: ReforestationArea) => {
    confirm(
      "Remove from Offline",
      `Remove "${area.name}" from offline storage?`,
      async () => {
        setSavingOffline(area.reforestation_area_id);
        try {
          const saved = await AsyncStorage.getItem(OFFLINE_AREAS_KEY);
          const savedAreas: ReforestationArea[] = saved
            ? JSON.parse(saved)
            : [];

          const updatedAreas = savedAreas.filter(
            (a) => a.reforestation_area_id !== area.reforestation_area_id,
          );
          await AsyncStorage.setItem(
            OFFLINE_AREAS_KEY,
            JSON.stringify(updatedAreas),
          );

          setOfflineAreaIds(
            new Set(updatedAreas.map((a) => a.reforestation_area_id)),
          );
          setOfflineCount(updatedAreas.length);

          success("Removed", `${area.name} removed from offline storage.`);
        } catch (error) {
          showError("Error", "Failed to remove area from offline storage.");
        } finally {
          setSavingOffline(null);
        }
      },
      { type: "error", confirmText: "Remove", cancelText: "Cancel" },
    );
  };

  const fetchAssignedAreas = useCallback(
    async (showRefreshIndicator = false) => {
      if (showRefreshIndicator) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        await loadOfflineAreaIds();

        if (!isOnline) {
          await loadOfflineAreas();
          return;
        }

        const token = await SecureStore.getItemAsync("token");
        if (!token) throw new Error("No authentication token found.");

        const response = await fetch(
          `${API_BASE_URL}/get_assigned_reforestation_area/`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            cache: "no-store",
          },
        );

        if (!response.ok)
          throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();

        const mappedAreas: ReforestationArea[] = data.map((item: any) => {
          const { lat, lng, coordDisplay } = parseCoordinate(item.coordinate);
          return {
            reforestation_area_id: item.reforestation_area_id?.toString() || "",
            assigned_onsite_inspector_id:
              item.assigned_onsite_inspector_id?.toString() || "",
            name: item.name || "Unnamed Area",
            description: item.description || null,
            coordinate: item.coordinate || null,
            latitude: lat,
            longitude: lng,
            coord_display: coordDisplay,
            assigned_at: item.assigned_at || "",
          };
        });

        setAreas(mappedAreas);
        setLastRefreshed(new Date());
      } catch (err: any) {
        setError(err.message);
        if (err.message.includes("token")) {
          confirm(
            "Authentication Error",
            "Please log in again.",
            () => router.replace("/"),
            { type: "error", confirmText: "OK", cancelText: "" },
          );
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [isOnline, router],
  );

  const loadOfflineAreas = async () => {
    setLoading(true);
    try {
      const saved = await AsyncStorage.getItem(OFFLINE_AREAS_KEY);
      if (saved) {
        const savedAreas: ReforestationArea[] = JSON.parse(saved);
        const validAreas = savedAreas.filter(
          (area) => area && area.reforestation_area_id && area.name,
        );
        setAreas(validAreas);
        setError(null);
      } else {
        setAreas([]);
        setError(
          "No areas saved for offline use. Please connect to internet and save areas.",
        );
      }
    } catch (err: any) {
      console.error("Error loading offline areas:", err);
      setError("Failed to load offline areas.");
      setAreas([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(
    () => fetchAssignedAreas(true),
    [fetchAssignedAreas],
  );

  const parseCoordinate = (coordinate: any) => {
    const defaultLat = 11.0,
      defaultLng = 124.6;
    let lat = defaultLat,
      lng = defaultLng;
    let coordDisplay = "No Coordinates";

    try {
      if (Array.isArray(coordinate) && coordinate.length >= 2) {
        [lat, lng] = coordinate;
        coordDisplay = `${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E`;
      } else if (coordinate && typeof coordinate === "object") {
        lat = coordinate.latitude || defaultLat;
        lng = coordinate.longitude || defaultLng;
        coordDisplay = `${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E`;
      }
    } catch (e) {
      console.error("Error parsing coordinate:", e);
    }
    return { lat, lng, coordDisplay };
  };

  useEffect(() => {
    fetchAssignedAreas();
  }, [fetchAssignedAreas]);

  const openModal = (area: ReforestationArea) => {
    if (!isOnline) {
      warning("Offline Mode", "Map is not available offline.");
      return;
    }
    setSelectedArea(area);
    setModalVisible(true);
  };

  const closeModal = () => {
    setSelectedArea(null);
    setModalVisible(false);
  };

  const openActionSheet = (area: ReforestationArea) => {
    closeModal();
    setActionSheetArea(area);
    setActionSheetVisible(true);
  };

  const handleGeneralAssessment = () => {
    if (actionSheetArea) {
      router.push({
        pathname: "/feedbacks/site_field_assessment",
        params: {
          areaId: actionSheetArea.reforestation_area_id,
          areaName: actionSheetArea.name,
          assessmentType: "general",
        },
      });
    }
    setActionSheetVisible(false);
  };

  const handleSpecificAssessment = () => {
    if (actionSheetArea) {
      router.push({
        pathname: "/feedbacks/select_site",
        params: {
          areaId: actionSheetArea.reforestation_area_id,
          areaName: actionSheetArea.name,
          assessmentType: "specific",
        },
      });
    }
    setActionSheetVisible(false);
  };

  const filteredAreas = areas.filter((area) => {
    const areaName = area.name || "";
    return areaName.toLowerCase().includes(searchText.toLowerCase());
  });

  const percentage =
    areas.length > 0 ? Math.round((offlineCount / areas.length) * 100) : 0;

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={BG}
        translucent={false}
      />

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[PRIMARY]}
            tintColor={PRIMARY}
            enabled={isOnline}
          />
        }
      >
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
          <View style={styles.topRow}>
            <View>
              <Text style={styles.eyebrow}>Field Inspections</Text>
              <Text style={styles.title}>Assigned Areas</Text>
            </View>
          </View>

          {!isOnline && (
            <View style={styles.offlineBanner}>
              <Ionicons
                name="cloud-offline-outline"
                size={14}
                color="#FFFFFF"
              />
              <Text style={styles.offlineBannerText}>
                Offline Mode — Saved Areas Only
              </Text>
            </View>
          )}

          {lastRefreshed && !refreshing && isOnline && (
            <Text style={styles.lastRefreshed}>
              Updated{" "}
              {lastRefreshed.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          )}

          <View style={styles.searchContainer}>
            <View style={styles.searchBar}>
              <Ionicons name="search-outline" size={18} color={FAINT} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name…"
                placeholderTextColor={FAINT}
                value={searchText}
                onChangeText={setSearchText}
              />
              {searchText.length > 0 && (
                <TouchableOpacity onPress={() => setSearchText("")}>
                  <Ionicons name="close-circle" size={18} color={FAINT} />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              style={styles.mapButton}
              onPress={() => router.push("/(tabs)/map")}
              activeOpacity={0.8}
            >
              <Ionicons name="map" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ✅ REPLACED: Semi-circle with linear progress bar */}
        {areas.length > 0 && (
          <View style={styles.progressCard}>
            <View style={styles.progressRow}>
              <View>
                <Text style={styles.progressLabel}>OFFLINE READINESS</Text>
                <Text style={styles.progressSub}>
                  {offlineCount} of {areas.length} areas saved
                </Text>
              </View>
              <Text style={styles.progressPct}>{percentage}%</Text>
            </View>
            <View style={styles.progressBg}>
              <View
                style={[styles.progressFill, { width: `${percentage}%` }]}
              />
            </View>
            <View style={styles.progressStatusRow}>
              <View style={styles.statusItem}>
                <View style={[styles.statusDot, { backgroundColor: "#5FD08A" }]} />
                <Text style={styles.statusText}>
                  {offlineCount} Saved
                </Text>
              </View>
              <View style={styles.statusItem}>
                <View style={[styles.statusDot, { backgroundColor: "#E5E7EB" }]} />
                <Text style={styles.statusText}>
                  {areas.length - offlineCount} Pending
                </Text>
              </View>
            </View>
          </View>
        )}

        {loading && !refreshing ? (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color={PRIMARY} />
            <Text style={styles.loadingText}>Loading…</Text>
          </View>
        ) : error && areas.length === 0 ? (
          <View style={styles.centerContent}>
            <MaterialCommunityIcons
              name={isOnline ? "alert-circle-outline" : "cloud-offline"}
              size={48}
              color={isOnline ? "#EF4444" : "#F59E0B"}
            />
            <Text style={styles.errorText}>{error}</Text>
            <Text style={styles.refreshHint}>Pull down to refresh</Text>
          </View>
        ) : (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                Areas ({filteredAreas.length})
              </Text>
            </View>

            <View style={styles.list}>
              {filteredAreas.map((area) => {
                const isSaved = offlineAreaIds.has(area.reforestation_area_id);
                const isSaving = savingOffline === area.reforestation_area_id;

                return (
                  <View key={area.reforestation_area_id} style={styles.card}>
                    <View style={styles.cardContent}>
                      <View style={styles.cardInfo}>
                        <Text style={styles.cardName} numberOfLines={1}>
                          {area.name}
                        </Text>
                        <View style={styles.metaRow}>
                          <Ionicons
                            name="navigate-outline"
                            size={13}
                            color={FAINT}
                          />
                          <Text style={styles.metaText}>
                            {area.coord_display}
                          </Text>
                        </View>
                        {isSaved && (
                          <View style={styles.savedBadge}>
                            <Ionicons
                              name="checkmark-circle"
                              size={12}
                              color={PRIMARY}
                            />
                            <Text style={styles.savedBadgeText}>
                              Saved Offline
                            </Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.cardActions}>
                        <TouchableOpacity
                          style={styles.actionIcon}
                          onPress={() => openModal(area)}
                          activeOpacity={0.7}
                          disabled={!isOnline}
                        >
                          <Ionicons
                            name="map-outline"
                            size={18}
                            color={!isOnline ? FAINT : PRIMARY}
                          />
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.actionIcon,
                            isSaved && styles.actionIconDanger,
                          ]}
                          onPress={() =>
                            isSaved
                              ? removeAreaFromOffline(area)
                              : saveAreaForOffline(area)
                          }
                          disabled={isSaving}
                          activeOpacity={0.7}
                        >
                          {isSaving ? (
                            <ActivityIndicator size="small" color={PRIMARY} />
                          ) : (
                            <Ionicons
                              name={
                                isSaved
                                  ? "trash-outline"
                                  : "cloud-download-outline"
                              }
                              size={18}
                              color={isSaved ? "#EF4444" : PRIMARY}
                            />
                          )}
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.actionIconPrimary}
                          onPress={() => openActionSheet(area)}
                          activeOpacity={0.8}
                        >
                          <Ionicons
                            name="clipboard-outline"
                            size={18}
                            color="#FFFFFF"
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>

            {filteredAreas.length === 0 && (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons
                  name={isOnline ? "tree-outline" : "cloud-offline"}
                  size={52}
                  color="#D1D5DB"
                />
                <Text style={styles.emptyTitle}>
                  {isOnline ? "No Areas Found" : "No Saved Areas"}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {isOnline
                    ? searchText
                      ? `No results for "${searchText}"`
                      : "No assigned areas yet"
                    : "Go online and save areas for offline use"}
                </Text>
              </View>
            )}
          </>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Map Modal */}
      <Modal
        animationType="slide"
        transparent
        visible={modalVisible}
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {selectedArea && (
              <>
                <View style={styles.dragHandle} />
                <WebView
                  source={{
                    html: generateMapHtml(
                      selectedArea.latitude,
                      selectedArea.longitude,
                      selectedArea.name,
                    ),
                  }}
                  style={styles.map}
                  javaScriptEnabled={true}
                  domStorageEnabled={true}
                  mixedContentMode="always"
                  startInLoadingState={true}
                  originWhitelist={["*"]}
                  onMessage={(event) => {
                    try {
                      const data = JSON.parse(event.nativeEvent.data);
                      if (data.type === "error")
                        showError("Map Error", data.message);
                    } catch (e) {}
                  }}
                  onError={(syntheticEvent) => {
                    const { nativeEvent } = syntheticEvent;
                    showError(
                      "WebView Error",
                      nativeEvent.description || "Failed to load map",
                    );
                  }}
                />
                <ScrollView
                  style={styles.modalInfo}
                  showsVerticalScrollIndicator={false}
                >
                  <Text style={styles.modalTitle}>{selectedArea.name}</Text>
                  <View style={styles.infoRow}>
                    <View style={styles.infoIconWrap}>
                      <Ionicons name="navigate" size={16} color={PRIMARY} />
                    </View>
                    <View>
                      <Text style={styles.infoLabel}>Coordinates</Text>
                      <Text style={styles.infoValue}>
                        {selectedArea.coord_display}
                      </Text>
                    </View>
                  </View>
                </ScrollView>
                <View style={styles.modalBtnRow}>
                  <Pressable style={styles.closeBtn} onPress={closeModal}>
                    <Text style={styles.closeBtnText}>Close</Text>
                  </Pressable>
                  <Pressable
                    style={styles.startBtn}
                    onPress={() => openActionSheet(selectedArea)}
                  >
                    <Text style={styles.startBtnText}>Start Assessment</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Assessment Type Action Sheet */}
      <Modal
        animationType="slide"
        transparent
        visible={actionSheetVisible}
        onRequestClose={() => setActionSheetVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setActionSheetVisible(false)}
        >
          <Pressable
            style={styles.actionSheet}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.dragHandle} />
            <Text style={styles.actionSheetTitle}>Choose Assessment Type</Text>
            <Text style={styles.actionSheetSubtitle}>
              Are you assessing the entire area or a specific site?
            </Text>

            <TouchableOpacity
              style={styles.actionOption}
              onPress={handleGeneralAssessment}
              activeOpacity={0.7}
            >
              <View style={styles.actionIconWrap}>
                <Ionicons name="globe-outline" size={22} color={PRIMARY} />
              </View>
              <View style={styles.actionTextWrap}>
                <Text style={styles.actionTitle}>General Assessment</Text>
                <Text style={styles.actionDesc}>
                  For the whole reforestation area (along the way observations).
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={FAINT} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionOption}
              onPress={handleSpecificAssessment}
              activeOpacity={0.7}
            >
              <View style={styles.actionIconWrap}>
                <Ionicons name="location-outline" size={22} color={PRIMARY} />
              </View>
              <View style={styles.actionTextWrap}>
                <Text style={styles.actionTitle}>Specific Site Assessment</Text>
                <Text style={styles.actionDesc}>
                  For a specific marked site (requires site selection).
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={FAINT} />
            </TouchableOpacity>

            <Pressable
              style={styles.cancelBtn}
              onPress={() => setActionSheetVisible(false)}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );

  function generateMapHtml(lat: number, lng: number, title: string) {
    const safeLat = lat || 11.0;
    const safeLng = lng || 124.6;
    const safeTitle = title
      ? title.replace(/'/g, "\\'").replace(/"/g, '\\"')
      : "Area";

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }
          #map { width: 100%; height: 100vh; }
          .custom-marker { background-color: #0F4A2F; border: 3px solid #fff; border-radius: 50%; width: 20px; height: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.3); }
          .leaflet-div-icon { background: transparent; border: none; }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          try {
            var map = L.map('map', { zoomControl: true, attributionControl: true }).setView([${safeLat}, ${safeLng}], 15);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors', maxZoom: 19, crossOrigin: true, errorTileUrl: '' }).addTo(map);
            var customIcon = L.divIcon({ className: 'custom-marker-wrapper', html: '<div class="custom-marker"></div>', iconSize: [20, 20], iconAnchor: [10, 10] });
            L.marker([${safeLat}, ${safeLng}], {icon: customIcon}).addTo(map).bindPopup('${safeTitle}').openPopup();
            window.ReactNativeWebView.postMessage(JSON.stringify({type: 'info', message: 'Map loaded successfully'}));
          } catch(e) { window.ReactNativeWebView.postMessage(JSON.stringify({type: 'error', message: e.message})); }
        </script>
      </body>
      </html>
    `;
  }
};

/* ──────────────────────────────────────────────────────────────────
   STYLES
   ─────────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
  },
  scrollView: { flex: 1 },
  content: { paddingBottom: 24 },
  header: { paddingHorizontal: 20 },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  eyebrow: {
    fontSize: 12,
    color: MUTED,
    fontWeight: "600",
    marginBottom: 3,
    letterSpacing: 0.2,
  },
  title: { fontSize: 32, fontWeight: "800", color: INK, letterSpacing: -0.5 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    ...cardShadow,
  },
  offlineBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PRIMARY,
    paddingVertical: 9,
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 12,
    borderRadius: 12,
  },
  offlineBannerText: { color: "#FFFFFF", fontSize: 12, fontWeight: "600" },
  lastRefreshed: {
    fontSize: 11.5,
    color: FAINT,
    marginBottom: 10,
    fontWeight: "500",
  },
  searchContainer: { flexDirection: "row", gap: 10, alignItems: "center" },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
    ...cardShadow,
  },
  searchInput: { flex: 1, fontSize: 14, color: INK, fontWeight: "500" },
  mapButton: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
    ...cardShadow,
  },
  progressCard: {
    backgroundColor: PRIMARY,
    marginHorizontal: 20,
    marginTop: 24,
    padding: 20,
    borderRadius: 18,
    ...cardShadow,
  },
  progressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  progressLabel: {
    fontSize: 13,
    color: "#B7D3C6",
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  progressSub: {
    fontSize: 11,
    color: "rgba(255,255,255,0.45)",
    marginTop: 2,
  },
  progressPct: {
    fontSize: 26,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  progressBg: {
    height: 6,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 14,
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#5FD08A",
    borderRadius: 3,
  },
  progressStatusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statusItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
    color: "rgba(255,255,255,0.6)",
    fontWeight: "500",
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    paddingTop: 80,
  },
  loadingText: { color: MUTED, fontSize: 14, marginTop: 4 },
  errorText: {
    color: "#EF4444",
    textAlign: "center",
    fontSize: 14,
    paddingHorizontal: 20,
  },
  refreshHint: { color: FAINT, fontSize: 12, marginTop: 4 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginTop: 32,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: INK,
    letterSpacing: -0.2,
  },
  list: { paddingHorizontal: 20, gap: 12 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    ...cardShadow,
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardInfo: { flex: 1, marginRight: 12 },
  cardName: { fontSize: 15, fontWeight: "700", color: INK, marginBottom: 6 },
  savedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: "flex-start",
    marginTop: 6,
  },
  savedBadgeText: { fontSize: 10, fontWeight: "600", color: PRIMARY },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
  },
  metaText: { fontSize: 12, color: MUTED },
  cardActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  actionIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#F0FDF4",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#DCFCE7",
  },
  actionIconDanger: { backgroundColor: "#FEF2F2", borderColor: "#FECACA" },
  actionIconPrimary: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 60,
    gap: 8,
    paddingHorizontal: 20,
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: FAINT },
  emptySubtitle: { fontSize: 13, color: FAINT, textAlign: "center" },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15,23,42,0.45)",
  },
  modalSheet: {
    height: screenHeight * 0.6,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E5E7EB",
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 8,
  },
  map: {
    width: "100%",
    height: screenHeight * 0.35,
    backgroundColor: "#E5E7EB",
  },
  modalInfo: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  modalTitle: { fontSize: 18, fontWeight: "700", color: INK, marginBottom: 16 },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 14,
  },
  infoIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: PRIMARY + "12",
    justifyContent: "center",
    alignItems: "center",
  },
  infoLabel: { fontSize: 11, color: FAINT, fontWeight: "500", marginBottom: 2 },
  infoValue: { fontSize: 14, color: INK, fontWeight: "600" },
  modalBtnRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  closeBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: PRIMARY,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  closeBtnText: { color: PRIMARY, fontWeight: "700", fontSize: 14 },
  startBtn: {
    flex: 2,
    backgroundColor: PRIMARY,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  startBtnText: { color: "#FFF", fontWeight: "700", fontSize: 14 },
  actionSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
    gap: 14,
  },
  actionSheetTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: INK,
    textAlign: "center",
  },
  actionSheetSubtitle: {
    fontSize: 13,
    color: MUTED,
    textAlign: "center",
    marginBottom: 4,
  },
  actionOption: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    padding: 16,
    borderRadius: 16,
    gap: 12,
  },
  actionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: PRIMARY + "12",
    justifyContent: "center",
    alignItems: "center",
  },
  actionTextWrap: { flex: 1 },
  actionTitle: { fontSize: 14, fontWeight: "700", color: INK },
  actionDesc: { fontSize: 12, color: MUTED, marginTop: 2 },
  cancelBtn: { marginTop: 4, paddingVertical: 12, alignItems: "center" },
  cancelBtnText: { color: "#EF4444", fontWeight: "600", fontSize: 14 },
});

export default ReforestationAreas;