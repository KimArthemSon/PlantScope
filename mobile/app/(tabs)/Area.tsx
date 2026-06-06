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
  Alert,
  RefreshControl,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import MapView, { Marker, Polygon } from "react-native-maps";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { api } from "@/constants/url_fixed";

const screenHeight = Dimensions.get("window").height;
const API_BASE_URL = api + "/api";

// ✅ UPDATED: Match new API response structure
type BarangayInfo = {
  id: string | null;
  name: string | null;
};

type LandClassificationInfo = {
  id: string | null;
  name: string | null;
};

type ReforestationArea = {
  reforestation_area_id: string;
  assigned_onsite_inspector_id: string;
  name: string;
  description: string | null;
  barangay: BarangayInfo | null;
  land_classification: LandClassificationInfo | null;
  coordinate: [number, number] | { latitude: number; longitude: number } | null;
  polygon_coordinate: any | null;
  latitude: number;
  longitude: number;
  coord_display: string;
  area_img: string | null;
  verification_status: "pending" | "draft" | "verified" | "rejected";
  verified_at: string | null;
  assigned_at: string;
};

// ✅ UPDATED: Status config uses verification_status
const STATUS_CONFIG = {
  verified: {
    bg: "#DCFCE7",
    text: "#15803D",
    dot: "#22C55E",
    label: "Verified",
  },
  rejected: {
    bg: "#FEE2E2",
    text: "#DC2626",
    dot: "#EF4444",
    label: "Rejected",
  },
  pending: { bg: "#FEF9C3", text: "#A16207", dot: "#F59E0B", label: "Pending" },
  draft: { bg: "#E0E7FF", text: "#4338CA", dot: "#6366F1", label: "Draft" },
};

const ReforestationAreas: React.FC = () => {
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedArea, setSelectedArea] = useState<ReforestationArea | null>(
    null,
  );
  const [searchText, setSearchText] = useState("");
  const [areas, setAreas] = useState<ReforestationArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // ✅ NEW: Refresh state
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  
  const router = useRouter();

  const fetchAssignedAreas = useCallback(async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    
    try {
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
          // ✅ Add cache-busting to ensure fresh data
          cache: "no-store",
        },
      );

      if (!response.ok) {
        if (response.status === 401)
          throw new Error("Session expired. Please log in again.");
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      const mappedAreas: ReforestationArea[] = data.map((item: any) => {
        const { lat, lng, coordDisplay } = parseCoordinate(item.coordinate);

        return {
          reforestation_area_id: item.reforestation_area_id?.toString() || "",
          assigned_onsite_inspector_id:
            item.assigned_onsite_inspector_id?.toString() || "",
          name: item.name || "Unnamed Area",
          description: item.description || null,
          barangay: item.barangay
            ? {
                id: item.barangay.id?.toString() || null,
                name: item.barangay.name || "Unknown",
              }
            : null,
          land_classification: item.land_classification
            ? {
                id: item.land_classification.id?.toString() || null,
                name: item.land_classification.name || "Unknown",
              }
            : null,
          coordinate: item.coordinate || null,
          polygon_coordinate: item.polygon_coordinate || null,
          latitude: lat,
          longitude: lng,
          coord_display: coordDisplay,
          area_img: item.area_img || null,
          verification_status: item.verification_status || "pending",
          verified_at: item.verified_at || null,
          assigned_at: item.assigned_at || "",
        };
      });
      setAreas(mappedAreas);
      setLastRefreshed(new Date()); // ✅ Track last refresh time
      
      // ✅ Show success feedback on manual refresh
      if (showRefreshIndicator) {
        // setTimeout(() => {
        //   Alert.alert("✓ Refreshed", "Area list updated successfully", [
        //     { text: "OK", style: "cancel" },
        //   ]);
        // }, 300);
      }
    } catch (err: any) {
      console.error("Fetch error:", err);
      setError(err.message);
      if (err.message.includes("token")) {
        Alert.alert("Authentication Error", "Please log in again.", [
          { text: "OK", onPress: () => router.replace("/") },
        ]);
      } else if (showRefreshIndicator) {
        Alert.alert("Refresh Failed", err.message || "Could not refresh data", [
          { text: "OK", style: "cancel" },
        ]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false); // ✅ Always stop refreshing
    }
  }, [router]);

  // ✅ NEW: Pull-to-refresh handler
  const onRefresh = useCallback(() => {
    fetchAssignedAreas(true);
  }, [fetchAssignedAreas]);

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
      } else if (typeof coordinate === "string" && coordinate.includes(",")) {
        const parts = coordinate
          .split(",")
          .map((p: string) => parseFloat(p.trim()));
        if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          [lat, lng] = parts;
          coordDisplay = `${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E`;
        }
      }
    } catch (e) {
      // Fallback to defaults
    }

    return { lat, lng, coordDisplay };
  };

  // ✅ Initial load
  useEffect(() => {
    fetchAssignedAreas();
  }, [fetchAssignedAreas]);

  const openModal = (area: ReforestationArea) => {
    setSelectedArea(area);
    setModalVisible(true);
  };
  const closeModal = () => {
    setSelectedArea(null);
    setModalVisible(false);
  };

  const handleActionPress = (area: ReforestationArea) => {
    router.push({
      pathname: "/feedbacks/site_field_assessment",
      params: { areaId: area.reforestation_area_id, areaName: area.name },
    });
  };

  const filteredAreas = areas.filter(
    (area) =>
      area.name.toLowerCase().includes(searchText.toLowerCase()) ||
      area.barangay?.name?.toLowerCase().includes(searchText.toLowerCase()) ||
      area.verification_status.toLowerCase().includes(searchText.toLowerCase()),
  );

  const canStartAssessment = (status: ReforestationArea["verification_status"]) => {
    return status !== "rejected";
  };

  return (
    <View style={styles.container}>
      {/* ✅ Header with Refresh Button */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Assigned Areas</Text>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={onRefresh}
          disabled={refreshing}
          activeOpacity={0.7}
        >
          <Ionicons
            name={refreshing ? "refresh-outline" : "refresh"}
            size={20}
            color={refreshing ? "#9CA3AF" : "#0F4A2F"}
            style={refreshing ? styles.refreshSpin : undefined}
          />
        </TouchableOpacity>
      </View>

      {/* ✅ Last refreshed timestamp */}
      {lastRefreshed && !refreshing && (
        <Text style={styles.lastRefreshed}>
          Updated: {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      )}

      {/* Search Bar */}
      <View style={styles.searchWrap}>
        <Ionicons
          name="search-outline"
          size={18}
          color="#9CA3AF"
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, barangay, or status…"
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

      {/* Body */}
      {loading && !refreshing ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#0F4A2F" />
          <Text style={styles.loadingText}>Loading assigned areas…</Text>
        </View>
      ) : error && areas.length === 0 ? (
        <View style={styles.centerContent}>
          <MaterialCommunityIcons
            name="alert-circle-outline"
            size={48}
            color="#EF4444"
          />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => fetchAssignedAreas()}
          >
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        // ✅ ScrollView with RefreshControl for pull-to-refresh
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#0F4A2F"]} // Android
              tintColor="#0F4A2F" // iOS
              title={refreshing ? "Refreshing…" : ""}
              titleColor="#6B7280"
            />
          }
        >
          {/* Section Header */}
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Areas ({filteredAreas.length})</Text>
            {refreshing && (
              <ActivityIndicator size="small" color="#0F4A2F" />
            )}
          </View>

          {filteredAreas.map((area) => {
            const s = STATUS_CONFIG[area.verification_status];
            const isAssessmentEnabled = canStartAssessment(area.verification_status);

            return (
              <View key={area.reforestation_area_id} style={styles.card}>
                {/* Left accent */}
                <View style={[styles.cardAccent, { backgroundColor: s.dot }]} />

                <View style={styles.cardBody}>
                  {/* Top row: name + status badge */}
                  <View style={styles.cardTopRow}>
                    <Text style={styles.cardName} numberOfLines={1}>
                      {area.name}
                    </Text>
                    <View
                      style={[styles.statusBadge, { backgroundColor: s.bg }]}
                    >
                      <View
                        style={[styles.statusDot, { backgroundColor: s.dot }]}
                      />
                      <Text style={[styles.statusText, { color: s.text }]}>
                        {s.label}
                      </Text>
                    </View>
                  </View>

                  {/* Meta rows */}
                  <View style={styles.metaRow}>
                    <Ionicons
                      name="location-outline"
                      size={13}
                      color="#9CA3AF"
                    />
                    <Text style={styles.metaText}>
                      {area.barangay?.name || "Unknown Barangay"}
                    </Text>
                  </View>
                  {area.land_classification?.name && (
                    <View style={styles.metaRow}>
                      <Ionicons
                        name="layers-outline"
                        size={13}
                        color="#9CA3AF"
                      />
                      <Text style={styles.metaText}>
                        {area.land_classification.name}
                      </Text>
                    </View>
                  )}
                  <View style={styles.metaRow}>
                    <Ionicons
                      name="navigate-outline"
                      size={13}
                      color="#9CA3AF"
                    />
                    <Text style={styles.metaText}>{area.coord_display}</Text>
                  </View>
                  {area.verified_at && (
                    <View style={styles.metaRow}>
                      <Ionicons
                        name="checkmark-circle-outline"
                        size={13}
                        color="#9CA3AF"
                      />
                      <Text style={styles.metaText}>
                        Verified:{" "}
                        {new Date(area.verified_at).toLocaleDateString()}
                      </Text>
                    </View>
                  )}

                  {/* Actions */}
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      style={styles.viewBtn}
                      onPress={() => openModal(area)}
                      activeOpacity={0.75}
                    >
                      <Ionicons name="map-outline" size={14} color="#0F4A2F" />
                      <Text style={styles.viewBtnText}>View Map</Text>
                    </TouchableOpacity>
                    
                    {/* ✅ UPDATED: Enable for all except rejected */}
                    <TouchableOpacity
                      style={[
                        styles.assessBtn,
                        !isAssessmentEnabled && { opacity: 0.6 },
                      ]}
                      onPress={() =>
                        isAssessmentEnabled && handleActionPress(area)
                      }
                      activeOpacity={0.85}
                      disabled={!isAssessmentEnabled}
                    >
                      <Text style={styles.assessBtnText}>
                        Start Field Assessment
                      </Text>
                      {isAssessmentEnabled && (
                        <Ionicons
                          name="arrow-forward"
                          size={14}
                          color="#FFFFFF"
                        />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })}

          {filteredAreas.length === 0 && (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons
                name="tree-outline"
                size={52}
                color="#D1D5DB"
              />
              <Text style={styles.emptyTitle}>No Areas Found</Text>
              <Text style={styles.emptySubtitle}>
                {searchText ? `No results for "${searchText}"` : "No assigned areas yet"}
              </Text>
              {!searchText && (
                <TouchableOpacity 
                  style={styles.refreshEmptyBtn}
                  onPress={onRefresh}
                  disabled={refreshing}
                >
                  <Ionicons 
                    name={refreshing ? "refresh" : "refresh-outline"} 
                    size={16} 
                    color="#0F4A2F" 
                    style={refreshing ? styles.refreshSpin : undefined}
                  />
                  <Text style={styles.refreshEmptyText}>
                    {refreshing ? "Refreshing…" : "Pull down to refresh"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </ScrollView>
      )}

      {/* Modal */}
      <Modal
        animationType="slide"
        transparent
        visible={modalVisible}
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {selectedArea &&
              (() => {
                const s = STATUS_CONFIG[selectedArea.verification_status];
                const polygonCoords = parsePolygonCoordinates(
                  selectedArea.polygon_coordinate,
                );
                const isAssessmentEnabled = canStartAssessment(selectedArea.verification_status);

                return (
                  <>
                    {/* Drag handle */}
                    <View style={styles.dragHandle} />

                    {/* Map */}
                    <MapView
                      style={styles.map}
                      initialRegion={{
                        latitude: selectedArea.latitude,
                        longitude: selectedArea.longitude,
                        latitudeDelta: 0.01,
                        longitudeDelta: 0.01,
                      }}
                    >
                      <Marker
                        coordinate={{
                          latitude: selectedArea.latitude,
                          longitude: selectedArea.longitude,
                        }}
                        title={selectedArea.name}
                        description={selectedArea.barangay?.name ?? ""}
                      />
                      {/* {polygonCoords.length > 0 && (
                        <Polygon
                          coordinates={polygonCoords}
                          strokeColor="#0F4A2F"
                          fillColor="rgba(15,74,47,0.18)"
                          strokeWidth={2}
                        />
                      )} */}
                    </MapView>

                    {/* Info */}
                    <ScrollView
                      style={styles.modalInfo}
                      showsVerticalScrollIndicator={false}
                    >
                      <View style={styles.modalTitleRow}>
                        <Text style={styles.modalTitle}>
                          {selectedArea.name}
                        </Text>
                        <View
                          style={[
                            styles.statusBadge,
                            { backgroundColor: s.bg },
                          ]}
                        >
                          <View
                            style={[
                              styles.statusDot,
                              { backgroundColor: s.dot },
                            ]}
                          />
                          <Text style={[styles.statusText, { color: s.text }]}>
                            {s.label}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.infoRow}>
                        <View style={styles.infoIconWrap}>
                          <Ionicons name="location" size={16} color="#0F4A2F" />
                        </View>
                        <View>
                          <Text style={styles.infoLabel}>Barangay</Text>
                          <Text style={styles.infoValue}>
                            {selectedArea.barangay?.name || "Unknown"}
                          </Text>
                        </View>
                      </View>

                      {selectedArea.land_classification?.name && (
                        <View style={styles.infoRow}>
                          <View style={styles.infoIconWrap}>
                            <Ionicons name="layers" size={16} color="#0F4A2F" />
                          </View>
                          <View>
                            <Text style={styles.infoLabel}>
                              Land Classification
                            </Text>
                            <Text style={styles.infoValue}>
                              {selectedArea.land_classification.name}
                            </Text>
                          </View>
                        </View>
                      )}

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

                      {selectedArea.verified_at && (
                        <View style={styles.infoRow}>
                          <View style={styles.infoIconWrap}>
                            <Ionicons
                              name="checkmark-circle"
                              size={16}
                              color="#22C55E"
                            />
                          </View>
                          <View>
                            <Text style={styles.infoLabel}>Verified At</Text>
                            <Text style={styles.infoValue}>
                              {new Date(
                                selectedArea.verified_at,
                              ).toLocaleString()}
                            </Text>
                          </View>
                        </View>
                      )}

                      <View style={styles.hintBox}>
                        <Ionicons
                          name="information-circle-outline"
                          size={16}
                          color="#0F4A2F"
                        />
                        <Text style={styles.hintText}>
                          Field Assessment includes Meta Data, Safety, Boundary
                          Verification, and Survivability layers.
                        </Text>
                      </View>
                    </ScrollView>

                    {/* Buttons */}
                    <View style={styles.modalBtnRow}>
                      <Pressable style={styles.closeBtn} onPress={closeModal}>
                        <Text style={styles.closeBtnText}>Close</Text>
                      </Pressable>
                      
                      {/* ✅ UPDATED: Enable for all except rejected */}
                      <Pressable
                        style={[
                          styles.startBtn,
                          !isAssessmentEnabled && { opacity: 0.6 },
                        ]}
                        onPress={() =>
                          isAssessmentEnabled && handleActionPress(selectedArea)
                        }
                        disabled={!isAssessmentEnabled}
                      >
                        <Text style={styles.startBtnText}>
                          Start Field Assessment
                        </Text>
                      </Pressable>
                    </View>
                  </>
                );
              })()}
          </View>
        </View>
      </Modal>
    </View>
  );
};

// ✅ Helper: Parse polygon coordinates for react-native-maps
const parsePolygonCoordinates = (polygon: any) => {
  if (!polygon) return [];

  try {
    if (polygon.coordinates && Array.isArray(polygon.coordinates[0])) {
      return polygon.coordinates[0].map((point: any) => {
        const [lng, lat] = point;
        return { latitude: lat, longitude: lng };
      });
    }

    if (Array.isArray(polygon) && polygon.length > 0) {
      return polygon
        .map((point: any) => {
          if (Array.isArray(point) && point.length >= 2) {
            const [lat, lng] = point;
            return { latitude: lat, longitude: lng };
          }
          return null;
        })
        .filter(Boolean);
    }
  } catch (e) {
    console.warn("Failed to parse polygon:", e);
  }

  return [];
};

/* ---------- STYLES ---------- */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F7F5",
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  
  // ✅ NEW: Header with refresh button
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F2D1C",
  },
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
  refreshSpin: {
    // Simple rotation animation via transform would need Animated API
    // For now, just visual feedback via color change
  },
  
  // ✅ NEW: Last refreshed timestamp
  lastRefreshed: {
    fontSize: 11,
    color: "#9CA3AF",
    marginBottom: 8,
    paddingHorizontal: 4,
    fontStyle: "italic",
  },

  // Search
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
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#0F2D1C",
  },

  // States
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

  // Section header
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F2D1C",
  },
  countBadge: {
    backgroundColor: "#0F4A2F",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countText: { color: "#FFF", fontSize: 12, fontWeight: "700" },

  // Card
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
  cardAccent: {
    width: 4,
  },
  cardBody: {
    flex: 1,
    padding: 14,
  },
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
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 3,
  },
  metaText: {
    fontSize: 12,
    color: "#6B7280",
  },
  cardActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
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
  viewBtnText: {
    color: "#0F4A2F",
    fontSize: 12,
    fontWeight: "600",
  },
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
  assessBtnText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "700",
  },

  // Empty state
  emptyState: {
    alignItems: "center",
    paddingTop: 60,
    gap: 8,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#9CA3AF",
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#9CA3AF",
    textAlign: "center",
  },
  refreshEmptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#F0FDF4",
    borderRadius: 20,
  },
  refreshEmptyText: {
    fontSize: 12,
    color: "#15803D",
    fontWeight: "500",
  },

  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  modalSheet: {
    height: screenHeight * 0.88,
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
    height: 230,
    backgroundColor: "#E5E7EB",
  },
  modalInfo: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  modalTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F2D1C",
    flex: 1,
    marginRight: 8,
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
  infoValue: {
    fontSize: 14,
    color: "#0F2D1C",
    fontWeight: "600",
  },
  hintBox: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#F0FDF4",
    borderRadius: 10,
    padding: 12,
    marginTop: 4,
    marginBottom: 12,
  },
  hintText: {
    flex: 1,
    fontSize: 12,
    color: "#15803D",
    lineHeight: 17,
  },

  // Modal buttons
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
  closeBtnText: {
    color: "#0F4A2F",
    fontWeight: "700",
    fontSize: 14,
  },
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
  startBtnText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 14,
  },
  
  // ✅ NEW: ScrollView wrapper for RefreshControl
  scrollView: {
    flex: 1,
  },
});

export default ReforestationAreas;