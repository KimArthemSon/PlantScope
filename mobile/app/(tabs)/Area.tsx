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
  // ❌ REMOVED: Alert
  RefreshControl,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { WebView } from "react-native-webview";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { api } from "@/constants/url_fixed";
import { useNetworkStatus } from "@/utils/networkStatus";

// ✅ ADDED: Import the useAlert hook
import { useAlert } from "@/components/AlertContext";

const screenHeight = Dimensions.get("window").height;
const API_BASE_URL = api + "/api";
const OFFLINE_AREAS_KEY = "@plantscope_offline_areas";

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
  // ✅ ADDED: Initialize useAlert. We alias 'error' to 'showError' to avoid conflicting with your 'error' state variable.
  const { success, error: showError, warning, info, confirm } = useAlert();

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
  const [savingOffline, setSavingOffline] = useState<string | null>(null);

  const router = useRouter();
  const isOnline = useNetworkStatus();

  // ✅ Load saved offline area IDs on mount
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
      }
    } catch (error) {
      console.error("Error loading offline areas:", error);
    }
  };

  const saveAreaForOffline = async (area: ReforestationArea) => {
    setSavingOffline(area.reforestation_area_id);
    try {
      // Get existing saved areas
      const saved = await AsyncStorage.getItem(OFFLINE_AREAS_KEY);
      const savedAreas: ReforestationArea[] = saved ? JSON.parse(saved) : [];

      // Check if already saved
      const alreadySaved = savedAreas.some(
        (a) => a.reforestation_area_id === area.reforestation_area_id,
      );
      if (alreadySaved) {
        // ✅ UPDATED
        info("Info", `${area.name} is already saved for offline use.`);
        return;
      }

      // Add new area
      const updatedAreas = [...savedAreas, area];
      await AsyncStorage.setItem(
        OFFLINE_AREAS_KEY,
        JSON.stringify(updatedAreas),
      );

      // Update state
      const newSet = new Set(offlineAreaIds);
      newSet.add(area.reforestation_area_id);
      setOfflineAreaIds(newSet);

      // ✅ UPDATED
      success("Success", `${area.name} saved for offline use.`);
    } catch (error) {
      // ✅ UPDATED
      showError("Error", "Failed to save area for offline use.");
    } finally {
      setSavingOffline(null);
    }
  };

  // ✅ UPDATED: Converted to use confirm() dialog.
  const removeAreaFromOffline = (area: ReforestationArea) => {
    confirm(
      "Remove from Offline",
      `Remove "${area.name}" from offline storage?`,
      async () => {
        setSavingOffline(area.reforestation_area_id);
        try {
          // Get existing saved areas
          const saved = await AsyncStorage.getItem(OFFLINE_AREAS_KEY);
          const savedAreas: ReforestationArea[] = saved
            ? JSON.parse(saved)
            : [];

          // Remove the area
          const updatedAreas = savedAreas.filter(
            (a) => a.reforestation_area_id !== area.reforestation_area_id,
          );
          await AsyncStorage.setItem(
            OFFLINE_AREAS_KEY,
            JSON.stringify(updatedAreas),
          );

          // Update state
          const newSet = new Set(offlineAreaIds);
          newSet.delete(area.reforestation_area_id);
          setOfflineAreaIds(newSet);

          // ✅ UPDATED
          success("Removed", `${area.name} removed from offline storage.`);
        } catch (error) {
          // ✅ UPDATED
          showError("Error", "Failed to remove area from offline storage.");
        } finally {
          setSavingOffline(null);
        }
      },
      {
        type: "error",
        confirmText: "Remove",
        cancelText: "Cancel",
      },
    );
  };

  const fetchAssignedAreas = useCallback(
    async (showRefreshIndicator = false) => {
      if (showRefreshIndicator) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        // ✅ Always load offline saved areas first
        await loadOfflineAreaIds();

        if (!isOnline) {
          // Load from offline storage only
          await loadOfflineAreas();
          return;
        }

        // ✅ ONLINE: Fetch from API
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
          // ✅ UPDATED: Replaced with confirm(). cancelText: "" hides the cancel button to act like a standard blocking alert.
          confirm(
            "Authentication Error",
            "Please log in again.",
            () => router.replace("/"),
            {
              type: "error",
              confirmText: "OK",
              cancelText: "",
            },
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
        // Filter out invalid areas
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
      // ✅ UPDATED
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

  return (
    <View style={styles.container}>
      {/* Offline Mode Banner */}
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline-outline" size={16} color="#FFFFFF" />
          <Text style={styles.offlineBannerText}>
            Offline Mode - Saved Areas Only
          </Text>
        </View>
      )}

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Assigned Areas</Text>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={onRefresh}
          disabled={refreshing || !isOnline}
        >
          <Ionicons
            name={refreshing ? "refresh-outline" : "refresh"}
            size={20}
            color={refreshing || !isOnline ? "#9CA3AF" : "#0F4A2F"}
          />
        </TouchableOpacity>
      </View>

      {lastRefreshed && !refreshing && isOnline && (
        <Text style={styles.lastRefreshed}>
          Updated:{" "}
          {lastRefreshed.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      )}

      <View style={styles.searchWrap}>
        <Ionicons
          name="search-outline"
          size={18}
          color="#9CA3AF"
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name…"
          placeholderTextColor="#9CA3AF"
          value={searchText}
          onChangeText={setSearchText}
        />
        {searchText.length > 0 && (
          <TouchableOpacity onPress={() => setSearchText("")}>
            <Ionicons name="close-circle" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>

      {loading && !refreshing ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#0F4A2F" />
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
          {isOnline && (
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => fetchAssignedAreas()}
            >
              <Text style={styles.retryText}>Try Again</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#0F4A2F"]}
              tintColor="#0F4A2F"
              enabled={isOnline}
            />
          }
        >
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>
              {isOnline
                ? `Areas (${filteredAreas.length})`
                : `Saved Areas (${filteredAreas.length})`}
            </Text>
            {refreshing && <ActivityIndicator size="small" color="#0F4A2F" />}
          </View>

          {filteredAreas.map((area) => {
            const isSaved = offlineAreaIds.has(area.reforestation_area_id);
            const isSaving = savingOffline === area.reforestation_area_id;

            return (
              <View key={area.reforestation_area_id} style={styles.card}>
                <View
                  style={[styles.cardAccent, { backgroundColor: "#22C55E" }]}
                />
                <View style={styles.cardBody}>
                  <View style={styles.cardTopRow}>
                    <Text style={styles.cardName} numberOfLines={1}>
                      {area.name}
                    </Text>
                    {isSaved && (
                      <View style={styles.savedBadge}>
                        <Ionicons name="download" size={10} color="#0F4A2F" />
                        <Text style={styles.savedBadgeText}>Saved</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.metaRow}>
                    <Ionicons
                      name="navigate-outline"
                      size={13}
                      color="#9CA3AF"
                    />
                    <Text style={styles.metaText}>{area.coord_display}</Text>
                  </View>

                  <View style={styles.cardActions}>
                    {isOnline && (
                      <TouchableOpacity
                        style={styles.viewBtn}
                        onPress={() => openModal(area)}
                        activeOpacity={0.75}
                      >
                        <Ionicons
                          name="map-outline"
                          size={14}
                          color="#0F4A2F"
                        />
                        <Text style={styles.viewBtnText}>View Map</Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      style={styles.assessBtn}
                      onPress={() => openActionSheet(area)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.assessBtnText}>Start Assessment</Text>
                      <Ionicons
                        name="arrow-forward"
                        size={14}
                        color="#FFFFFF"
                      />
                    </TouchableOpacity>
                  </View>

                  {/* ✅ UPDATED: Show Remove button when offline AND saved, OR when online */}
                  {(!isOnline && isSaved) || isOnline ? (
                    <TouchableOpacity
                      style={[
                        styles.offlineBtn,
                        isSaved
                          ? styles.removeOfflineBtn
                          : styles.saveOfflineBtn,
                        isSaving && { opacity: 0.6 },
                      ]}
                      onPress={() =>
                        isSaved
                          ? removeAreaFromOffline(area)
                          : saveAreaForOffline(area)
                      }
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <ActivityIndicator
                          size="small"
                          color={isSaved ? "#EF4444" : "#0F4A2F"}
                        />
                      ) : (
                        <>
                          <Ionicons
                            name={
                              isSaved ? "trash-outline" : "download-outline"
                            }
                            size={14}
                            color={isSaved ? "#EF4444" : "#0F4A2F"}
                          />
                          <Text
                            style={[
                              styles.offlineBtnText,
                              { color: isSaved ? "#EF4444" : "#0F4A2F" },
                            ]}
                          >
                            {isSaved
                              ? "Remove from Offline"
                              : "Save for Offline"}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            );
          })}

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
        </ScrollView>
      )}

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
                      if (data.type === "error") {
                        console.error("Map JS Error:", data.message);
                        // ✅ UPDATED
                        showError("Map Error", data.message);
                      }
                    } catch (e) {}
                  }}
                  onError={(syntheticEvent) => {
                    const { nativeEvent } = syntheticEvent;
                    console.error("WebView Native Error: ", nativeEvent);
                    // ✅ UPDATED
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
                      <Ionicons name="navigate" size={16} color="#0F4A2F" />
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
            >
              <View style={styles.actionIconWrap}>
                <Ionicons name="globe-outline" size={24} color="#0F4A2F" />
              </View>
              <View style={styles.actionTextWrap}>
                <Text style={styles.actionTitle}>General Assessment</Text>
                <Text style={styles.actionDesc}>
                  For the whole reforestation area (along the way observations).
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionOption}
              onPress={handleSpecificAssessment}
            >
              <View style={styles.actionIconWrap}>
                <Ionicons name="location-outline" size={24} color="#0F4A2F" />
              </View>
              <View style={styles.actionTextWrap}>
                <Text style={styles.actionTitle}>Specific Site Assessment</Text>
                <Text style={styles.actionDesc}>
                  For a specific marked site (requires site selection).
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
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

  // Generate Map HTML (only used when online)
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
          .custom-marker {
            background-color: #0F4A2F;
            border: 3px solid #fff;
            border-radius: 50%;
            width: 20px;
            height: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          }
          .leaflet-div-icon {
            background: transparent;
            border: none;
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          try {
            var map = L.map('map', {
              zoomControl: true,
              attributionControl: true
            }).setView([${safeLat}, ${safeLng}], 15);
            
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
              attribution: '© OpenStreetMap contributors',
              maxZoom: 19,
              crossOrigin: true,
              errorTileUrl: ''
            }).addTo(map);
            
            var customIcon = L.divIcon({
              className: 'custom-marker-wrapper',
              html: '<div class="custom-marker"></div>',
              iconSize: [20, 20],
              iconAnchor: [10, 10]
            });
            
            L.marker([${safeLat}, ${safeLng}], {icon: customIcon})
              .addTo(map)
              .bindPopup('${safeTitle}')
              .openPopup();
              
            window.ReactNativeWebView.postMessage(JSON.stringify({type: 'info', message: 'Map loaded successfully'}));
          } catch(e) {
            window.ReactNativeWebView.postMessage(JSON.stringify({type: 'error', message: e.message}));
          }
        </script>
      </body>
      </html>
    `;
  }
};

/* ---------- STYLES ---------- */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F7F5",
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  offlineBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0F4A2F",
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 8,
    borderRadius: 8,
  },
  offlineBannerText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#0F2D1C" },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  lastRefreshed: {
    fontSize: 11,
    color: "#9CA3AF",
    marginBottom: 8,
    paddingHorizontal: 4,
    fontStyle: "italic",
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: "#0F2D1C" },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: { color: "#6B7280", fontSize: 14, marginTop: 4 },
  errorText: { color: "#EF4444", textAlign: "center", fontSize: 14 },
  retryBtn: {
    backgroundColor: "#0F4A2F",
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryText: { color: "#FFF", fontWeight: "700" },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
    paddingHorizontal: 4,
  },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#0F2D1C" },
  card: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    marginBottom: 12,
    overflow: "hidden",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  cardAccent: { width: 4 },
  cardBody: { flex: 1, padding: 14 },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  cardName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F2D1C",
    flex: 1,
    marginRight: 8,
  },
  savedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  savedBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#0F4A2F",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 3,
  },
  metaText: { fontSize: 12, color: "#6B7280" },
  cardActions: { flexDirection: "row", gap: 8, marginTop: 12 },
  viewBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1.5,
    borderColor: "#0F4A2F",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  viewBtnText: { color: "#0F4A2F", fontSize: 12, fontWeight: "600" },
  assessBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#0F4A2F",
    borderRadius: 8,
    paddingVertical: 8,
  },
  assessBtnText: { color: "#FFF", fontSize: 12, fontWeight: "700" },
  offlineBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  saveOfflineBtn: {
    borderColor: "#0F4A2F",
    backgroundColor: "#F0FDF4",
  },
  removeOfflineBtn: {
    borderColor: "#EF4444",
    backgroundColor: "#FEF2F2",
  },
  offlineBtnText: {
    fontSize: 12,
    fontWeight: "600",
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 60,
    gap: 8,
    paddingHorizontal: 20,
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#9CA3AF" },
  emptySubtitle: { fontSize: 13, color: "#9CA3AF", textAlign: "center" },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
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
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F2D1C",
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 14,
  },
  infoIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#E6F4EC",
    justifyContent: "center",
    alignItems: "center",
  },
  infoLabel: {
    fontSize: 11,
    color: "#9CA3AF",
    fontWeight: "500",
    marginBottom: 2,
  },
  infoValue: { fontSize: 14, color: "#0F2D1C", fontWeight: "600" },
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
    borderColor: "#0F4A2F",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  closeBtnText: { color: "#0F4A2F", fontWeight: "700", fontSize: 14 },
  startBtn: {
    flex: 2,
    backgroundColor: "#0F4A2F",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    shadowColor: "#0F4A2F",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  startBtnText: { color: "#FFF", fontWeight: "700", fontSize: 14 },
  scrollView: { flex: 1 },
  actionSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
    gap: 16,
  },
  actionSheetTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F2D1C",
    textAlign: "center",
  },
  actionSheetSubtitle: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 8,
  },
  actionOption: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    padding: 16,
    borderRadius: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  actionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E6F4EC",
    justifyContent: "center",
    alignItems: "center",
  },
  actionTextWrap: { flex: 1 },
  actionTitle: { fontSize: 14, fontWeight: "700", color: "#0F2D1C" },
  actionDesc: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  cancelBtn: { marginTop: 8, paddingVertical: 12, alignItems: "center" },
  cancelBtnText: { color: "#EF4444", fontWeight: "600", fontSize: 14 },
});

export default ReforestationAreas;
