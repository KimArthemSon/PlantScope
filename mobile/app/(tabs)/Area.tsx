import { useRouter } from "expo-router";
import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, Dimensions, Pressable, TextInput, ActivityIndicator, Alert,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import MapView, { Marker, Polygon } from "react-native-maps";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { api } from "@/constants/url_fixed";

const screenHeight = Dimensions.get("window").height;
const API_BASE_URL = api + "/api";

type ReforestationArea = {
  reforestation_area_id: string;
  assigned_onsite_inspector_id: string;
  name: string;
  barangay: string | null;
  coordinate: [number, number] | null;
  pre_assessment_status: "pending" | "approved" | "rejected";
  assigned_at: string;
  latitude: number;
  longitude: number;
  coordDisplay: string;
};

const STATUS_CONFIG = {
  approved: { bg: "#DCFCE7", text: "#15803D", dot: "#22C55E", label: "Approved" },
  rejected: { bg: "#FEE2E2", text: "#DC2626", dot: "#EF4444", label: "Rejected" },
  pending:  { bg: "#FEF9C3", text: "#A16207", dot: "#F59E0B", label: "Pending"  },
};

const ReforestationAreas: React.FC = () => {
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedArea, setSelectedArea] = useState<ReforestationArea | null>(null);
  const [searchText, setSearchText] = useState("");
  const [areas, setAreas] = useState<ReforestationArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const fetchAssignedAreas = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await SecureStore.getItemAsync("token");
      if (!token) throw new Error("No authentication token found.");

      const response = await fetch(`${API_BASE_URL}/get_assigned_reforestation_area/`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) throw new Error("Session expired. Please log in again.");
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      const mappedAreas: ReforestationArea[] = data.map((item: any) => {
        let lat = 11.0, lng = 124.6, coordDisplay = "No Coordinates";
        if (Array.isArray(item.coordinate) && item.coordinate.length >= 2) {
          [lat, lng] = item.coordinate;
          coordDisplay = `${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E`;
        } else if (typeof item.coordinate === "string" && item.coordinate.includes(",")) {
          const parts = item.coordinate.split(",").map((p: string) => parseFloat(p.trim()));
          if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            [lat, lng] = parts;
            coordDisplay = `${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E`;
          }
        }
        return {
          reforestation_area_id: item.reforestation_area_id?.toString() || "",
          assigned_onsite_inspector_id: item.assigned_onsite_inspector_id?.toString() || "",
          name: item.name || "Unnamed Area",
          barangay: item.barangay?.name || item.barangay || "Unknown Barangay",
          coordinate: Array.isArray(item.coordinate) ? item.coordinate : null,
          pre_assessment_status: item.pre_assessment_status || "pending",
          assigned_at: item.assigned_at || "",
          latitude: lat, longitude: lng, coordDisplay,
        };
      });
      setAreas(mappedAreas);
    } catch (err: any) {
      console.error("Fetch error:", err);
      setError(err.message);
      if (err.message.includes("token")) {
        Alert.alert("Authentication Error", "Please log in again.", [
          { text: "OK", onPress: () => router.replace("/") },
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAssignedAreas(); }, []);

  const openModal = (area: ReforestationArea) => { setSelectedArea(area); setModalVisible(true); };
  const closeModal = () => { setSelectedArea(null); setModalVisible(false); };

  const handleActionPress = (area: ReforestationArea) => {
    router.push({
      pathname: "/feedbacks/site_field_assessment",
      params: { areaId: area.reforestation_area_id, areaName: area.name },
    });
  };

  const filteredAreas = areas.filter(
    (area) =>
      area.name.toLowerCase().includes(searchText.toLowerCase()) ||
      area.barangay?.toLowerCase().includes(searchText.toLowerCase()) ||
      area.pre_assessment_status.toLowerCase().includes(searchText.toLowerCase())
  );

  return (
    <View style={styles.container}>

      {/* Search Bar */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color="#9CA3AF" style={styles.searchIcon} />
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
      {loading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#0F4A2F" />
          <Text style={styles.loadingText}>Loading assigned areas…</Text>
        </View>
      ) : error ? (
        <View style={styles.centerContent}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchAssignedAreas}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>

          {/* Section Header */}
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Assigned Areas</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{filteredAreas.length}</Text>
            </View>
          </View>

          {filteredAreas.map((area) => {
            const s = STATUS_CONFIG[area.pre_assessment_status];
            return (
              <View key={area.reforestation_area_id} style={styles.card}>

                {/* Left accent */}
                <View style={[styles.cardAccent, { backgroundColor: s.dot }]} />

                <View style={styles.cardBody}>
                  {/* Top row: name + status badge */}
                  <View style={styles.cardTopRow}>
                    <Text style={styles.cardName} numberOfLines={1}>{area.name}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: s.bg }]}>
                      <View style={[styles.statusDot, { backgroundColor: s.dot }]} />
                      <Text style={[styles.statusText, { color: s.text }]}>{s.label}</Text>
                    </View>
                  </View>

                  {/* Meta row */}
                  <View style={styles.metaRow}>
                    <Ionicons name="location-outline" size={13} color="#9CA3AF" />
                    <Text style={styles.metaText}>{area.barangay}</Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Ionicons name="navigate-outline" size={13} color="#9CA3AF" />
                    <Text style={styles.metaText}>{area.coordDisplay}</Text>
                  </View>

                  {/* Actions */}
                  <View style={styles.cardActions}>
                    <TouchableOpacity style={styles.viewBtn} onPress={() => openModal(area)} activeOpacity={0.75}>
                      <Ionicons name="map-outline" size={14} color="#0F4A2F" />
                      <Text style={styles.viewBtnText}>View Map</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.assessBtn} onPress={() => handleActionPress(area)} activeOpacity={0.85}>
                      <Text style={styles.assessBtnText}>Start Assessment</Text>
                      <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })}

          {filteredAreas.length === 0 && (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="tree-outline" size={52} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>No Areas Found</Text>
              <Text style={styles.emptySubtitle}>No results for "{searchText}"</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Modal */}
      <Modal animationType="slide" transparent visible={modalVisible} onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {selectedArea && (() => {
              const s = STATUS_CONFIG[selectedArea.pre_assessment_status];
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
                      coordinate={{ latitude: selectedArea.latitude, longitude: selectedArea.longitude }}
                      title={selectedArea.name}
                      description={selectedArea.barangay ?? ""}
                    />
                    <Polygon
                      coordinates={[
                        { latitude: selectedArea.latitude + 0.002, longitude: selectedArea.longitude - 0.002 },
                        { latitude: selectedArea.latitude + 0.002, longitude: selectedArea.longitude + 0.002 },
                        { latitude: selectedArea.latitude - 0.002, longitude: selectedArea.longitude + 0.002 },
                        { latitude: selectedArea.latitude - 0.002, longitude: selectedArea.longitude - 0.002 },
                      ]}
                      strokeColor="#0F4A2F"
                      fillColor="rgba(15,74,47,0.18)"
                      strokeWidth={2}
                    />
                  </MapView>

                  {/* Info */}
                  <ScrollView style={styles.modalInfo} showsVerticalScrollIndicator={false}>
                    <View style={styles.modalTitleRow}>
                      <Text style={styles.modalTitle}>{selectedArea.name}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: s.bg }]}>
                        <View style={[styles.statusDot, { backgroundColor: s.dot }]} />
                        <Text style={[styles.statusText, { color: s.text }]}>{s.label}</Text>
                      </View>
                    </View>

                    <View style={styles.infoRow}>
                      <View style={styles.infoIconWrap}>
                        <Ionicons name="location" size={16} color="#0F4A2F" />
                      </View>
                      <View>
                        <Text style={styles.infoLabel}>Barangay</Text>
                        <Text style={styles.infoValue}>{selectedArea.barangay}</Text>
                      </View>
                    </View>

                    <View style={styles.infoRow}>
                      <View style={styles.infoIconWrap}>
                        <Ionicons name="navigate" size={16} color="#0F4A2F" />
                      </View>
                      <View>
                        <Text style={styles.infoLabel}>Coordinates</Text>
                        <Text style={styles.infoValue}>{selectedArea.coordDisplay}</Text>
                      </View>
                    </View>

                    <View style={styles.hintBox}>
                      <Ionicons name="information-circle-outline" size={16} color="#0F4A2F" />
                      <Text style={styles.hintText}>
                        Field Assessment includes Meta Data, Safety, Boundary Verification, and Survivability layers.
                      </Text>
                    </View>
                  </ScrollView>

                  {/* Buttons */}
                  <View style={styles.modalBtnRow}>
                    <Pressable style={styles.closeBtn} onPress={closeModal}>
                      <Text style={styles.closeBtnText}>Close</Text>
                    </Pressable>
                    <Pressable style={styles.startBtn} onPress={() => handleActionPress(selectedArea)}>
                      <Text style={styles.startBtnText}>Start Field Assessment</Text>
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

/* ---------- STYLES ---------- */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F7F5",
    paddingHorizontal: 16,
    paddingTop: 14,
  },

  /* Search */
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

  /* States */
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

  /* Section header */
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
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

  /* Card */
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

  /* Empty state */
  emptyState: {
    alignItems: "center",
    paddingTop: 60,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#9CA3AF",
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#9CA3AF",
  },

  /* Modal */
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

  /* Modal buttons */
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
});

export default ReforestationAreas;
