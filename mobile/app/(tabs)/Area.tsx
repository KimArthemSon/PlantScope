import { useRouter } from "expo-router";
import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, Dimensions, Pressable, TextInput, ActivityIndicator, Alert,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import MapView, { Marker, Polygon } from "react-native-maps";
import { api } from "@/constants/url_fixed";

const screenHeight = Dimensions.get("window").height;
const API_BASE_URL = api + "/api";

// ✅ Updated type to match Django Reforestation_areas model
type ReforestationArea = {
  reforestation_area_id: string;
  assigned_onsite_inspector_id: string;
  name: string;
  barangay: string | null;
  coordinate: [number, number] | null;
  pre_assessment_status: "pending" | "approved" | "rejected";
  assigned_at: string;
  // Derived for UI
  latitude: number;
  longitude: number;
  coordDisplay: string;
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
    // ✅ Navigation based on pre_assessment_status (Phase 1 gate)
    if (area.pre_assessment_status === "pending") {
      router.push({
        pathname: "/feedbacks/pre_assessment",
        params: { areaId: area.reforestation_area_id, areaName: area.name },
      });
    } else if (area.pre_assessment_status === "approved") {
      // Later: Navigate to MCDA/Site assessment
       router.push({
        pathname: "/feedbacks/site_field_assessment",
        params: { areaId: area.reforestation_area_id, areaName: area.name },
      });
      
    } else {
      Alert.alert("Area Excluded", "This area was rejected during pre-assessment. No further action allowed.");
    }
  };

  const filteredAreas = areas.filter(
    (area) =>
      area.name.toLowerCase().includes(searchText.toLowerCase()) ||
      area.barangay?.toLowerCase().includes(searchText.toLowerCase()) ||
      area.pre_assessment_status.toLowerCase().includes(searchText.toLowerCase())
  );

  return (
    <View style={styles.container}>
      <TextInput style={styles.searchInput} placeholder="Search by name, barangay, or status..." value={searchText} onChangeText={setSearchText} />
      {loading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#0F4A2F" />
          <Text style={styles.loadingText}>Loading assigned areas...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchAssignedAreas}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={styles.header}>Assigned Areas ({filteredAreas.length})</Text>
          {filteredAreas.map((area) => (
            <View key={area.reforestation_area_id} style={styles.card}>
              <View style={styles.cardInfo}>
                <Text style={styles.cardName}>{area.name}</Text>
                <Text style={styles.cardCoord}>{area.coordDisplay}</Text>
                <Text style={styles.cardLocation}>{area.barangay}</Text>
                <View style={[styles.statusBadge, {
                  backgroundColor: area.pre_assessment_status === "approved" ? "#d4edda" : area.pre_assessment_status === "rejected" ? "#f8d7da" : "#fff3cd",
                }]}>
                  <Text style={[styles.statusText, {
                    color: area.pre_assessment_status === "approved" ? "#155724" : area.pre_assessment_status === "rejected" ? "#721c24" : "#856404",
                  }]}>{area.pre_assessment_status.toUpperCase()}</Text>
                </View>
              </View>
              <View style={styles.cardActions}>
                <TouchableOpacity style={styles.viewBtn} onPress={() => openModal(area)}>
                  <Text style={styles.viewText}>View</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, {
                  backgroundColor: area.pre_assessment_status === "approved" ? "#0F4A2F" : area.pre_assessment_status === "pending" ? "#DAA520" : "#ccc",
                  marginTop: 8,
                }]} onPress={() => handleActionPress(area)} disabled={area.pre_assessment_status === "rejected"}>
                  <Text style={styles.actionBtnText}>
                    {area.pre_assessment_status === "pending" ? "Start Pre-Assessment" : area.pre_assessment_status === "approved" ? "View Approved" : "Excluded"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
          {filteredAreas.length === 0 && !loading && <Text style={styles.noResults}>No areas found matching "{searchText}".</Text>}
        </ScrollView>
      )}
      {/* Modal unchanged - uses selectedArea fields */}
      <Modal animationType="slide" transparent={true} visible={modalVisible} onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedArea && (
              <>
                <MapView style={styles.map} initialRegion={{
                  latitude: selectedArea.latitude, longitude: selectedArea.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01,
                }}>
                  <Marker coordinate={{ latitude: selectedArea.latitude, longitude: selectedArea.longitude }} title={selectedArea.name} description={selectedArea.barangay ?? ''} />
                  <Polygon coordinates={[
                    { latitude: selectedArea.latitude + 0.002, longitude: selectedArea.longitude - 0.002 },
                    { latitude: selectedArea.latitude + 0.002, longitude: selectedArea.longitude + 0.002 },
                    { latitude: selectedArea.latitude - 0.002, longitude: selectedArea.longitude + 0.002 },
                    { latitude: selectedArea.latitude - 0.002, longitude: selectedArea.longitude - 0.002 },
                  ]} strokeColor="#0F4A2F" fillColor="rgba(15, 74, 47, 0.3)" strokeWidth={2} />
                </MapView>
                <View style={styles.infoContainer}>
                  <Text style={styles.infoTitle}>{selectedArea.name}</Text>
                  <Text style={styles.infoText}><Text style={styles.label}>Barangay:</Text> {selectedArea.barangay}</Text>
                  <Text style={styles.infoText}><Text style={styles.label}>Coordinates:</Text> {selectedArea.coordDisplay}</Text>
                  <Text style={styles.infoText}><Text style={styles.label}>Status:</Text> <Text style={{ fontWeight: "bold", color: selectedArea.pre_assessment_status === "approved" ? "green" : selectedArea.pre_assessment_status === "rejected" ? "red" : "#856404" }}>{selectedArea.pre_assessment_status.toUpperCase()}</Text></Text>
                </View>
                <View style={styles.buttonRow}>
                  <Pressable style={styles.closeBtn} onPress={closeModal}><Text style={styles.closeText}>Close</Text></Pressable>
                  <Pressable style={[styles.feedbackBtn, { opacity: selectedArea.pre_assessment_status === "rejected" ? 0.5 : 1 }]} onPress={() => handleActionPress(selectedArea)} disabled={selectedArea.pre_assessment_status === "rejected"}>
                    <Text style={styles.feedbackText}>{selectedArea.pre_assessment_status === "pending" ? "Start Pre-Assessment" : selectedArea.pre_assessment_status === "approved" ? "View Approved" : "Excluded"}</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  // ... (keep your existing styles, they work fine)
  container: { flex: 1, backgroundColor: "#FFFFFF", paddingHorizontal: 16, paddingTop: 10 },
  centerContent: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  loadingText: { marginTop: 10, color: "#666" },
  errorText: { color: "red", textAlign: "center", marginBottom: 15 },
  retryBtn: { backgroundColor: "#0F4A2F", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  retryText: { color: "#fff", fontWeight: "bold" },
  header: { fontSize: 22, fontWeight: "bold", color: "#000", marginBottom: 16, marginTop: 10 },
  searchInput: { height: 44, borderWidth: 1, borderColor: "#ccc", borderRadius: 8, paddingHorizontal: 12, marginBottom: 12, backgroundColor: "#f9f9f9" },
  card: { flexDirection: "row", backgroundColor: "#fff", padding: 16, marginBottom: 12, borderRadius: 12, elevation: 3, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, borderWidth: 1, borderColor: "#eee" },
  cardInfo: { flex: 3, paddingRight: 10 },
  cardName: { fontSize: 16, fontWeight: "bold", color: "#000" },
  cardCoord: { fontSize: 12, color: "#666", marginTop: 2 },
  cardLocation: { fontSize: 13, color: "#555", marginTop: 2 },
  statusBadge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, marginTop: 8 },
  statusText: { fontSize: 11, fontWeight: "bold", textTransform: "uppercase" },
  cardActions: { flex: 1.5, flexDirection: "column", justifyContent: "center", alignItems: "center" },
  viewBtn: { width: "100%", backgroundColor: "#e9ecef", paddingVertical: 8, borderRadius: 8, alignItems: "center", marginBottom: 8 },
  viewText: { color: "#0F4A2F", fontWeight: "600", fontSize: 12 },
  actionBtn: { width: "100%", paddingVertical: 10, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  actionBtnText: { color: "#fff", fontWeight: "bold", fontSize: 12, textAlign: "center" },
  noResults: { textAlign: "center", marginTop: 20, color: "#888", fontSize: 16 },
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  modalContent: { height: screenHeight * 0.85, backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, paddingBottom: 30 },
  map: { width: "100%", height: 250, borderRadius: 12, marginBottom: 16, backgroundColor: "#eee" },
  infoContainer: { flex: 1, marginBottom: 10 },
  infoTitle: { fontSize: 20, fontWeight: "bold", marginBottom: 10, color: "#000" },
  infoText: { fontSize: 14, marginBottom: 8, color: "#333", lineHeight: 20 },
  label: { fontWeight: "700", color: "#0F4A2F" },
  buttonRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  closeBtn: { flex: 1, backgroundColor: "#FFF", borderWidth: 1, borderColor: "#0F4A2F", borderRadius: 8, paddingVertical: 14, marginRight: 8, alignItems: "center" },
  closeText: { color: "#0F4A2F", textAlign: "center", fontWeight: "600" },
  feedbackBtn: { flex: 1.5, backgroundColor: "#0F4A2F", borderRadius: 8, paddingVertical: 14, marginLeft: 8, alignItems: "center", shadowColor: "#0F4A2F", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 },
  feedbackText: { color: "#FFF", textAlign: "center", fontWeight: "700", fontSize: 16 },
});

export default ReforestationAreas;