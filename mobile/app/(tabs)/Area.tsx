import { useRouter } from "expo-router";
import React, { useState, useEffect } from "react";
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
} from "react-native";
import * as SecureStore from "expo-secure-store";
import MapView, { Marker, Polygon } from "react-native-maps";
import { api } from "@/constants/url_fixed";

const screenHeight = Dimensions.get("window").height;
const API_BASE_URL = api + "/api";

type ReforestationArea = {
  id: string;
  name: string;
  coordinates: string;
  location: string;
  legality: string;
  latitude: number;
  longitude: number;
  safety_status: string;
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

  const router = useRouter();

  const fetchAssignedAreas = async () => {
    try {
      setLoading(true);
      setError(null);
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
        },
      );

      if (!response.ok) {
        if (response.status === 401)
          throw new Error("Session expired. Please log in again.");
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const mappedAreas: ReforestationArea[] = data.map((item: any) => ({
        id: item.id.toString(),
        name: item.name,
        location: item.barangay || "Unknown Barangay",
        legality: item.legality || "pending",
        safety_status: item.safety_status || "Unknown",
        coordinates: item.coordinate
          ? `${item.coordinate[0].toFixed(4)}° N, ${item.coordinate[1].toFixed(4)}° E`
          : "No Coordinates",
        latitude: item.coordinate ? item.coordinate[0] : 11.0,
        longitude: item.coordinate ? item.coordinate[1] : 124.6,
      }));
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

  useEffect(() => {
    fetchAssignedAreas();
  }, []);

  const openModal = (area: ReforestationArea) => {
    setSelectedArea(area);
    setModalVisible(true);
  };

  const closeModal = () => {
    setSelectedArea(null);
    setModalVisible(false);
  };

  const handleActionPress = (area: ReforestationArea) => {
    if (area.legality === "pending") {
      router.push({
        pathname: "/feedbacks/pre_assessment",
        params: { areaId: area.id, areaName: area.name },
      });
    } else if (area.legality === "legal") {
      // ✅ Removed redundant `legality` param - it's derivable on next screen if needed
      router.push({
        pathname: "/feedbacks/site_field_assessment",
        params: { areaId: area.id, areaName: area.name },
      });
    } else {
      Alert.alert(
        "Restricted",
        "This area is marked as Illegal. No assessment allowed.",
      );
    }
  };

  const filteredAreas = areas.filter(
    (area) =>
      area.name.toLowerCase().includes(searchText.toLowerCase()) ||
      area.location.toLowerCase().includes(searchText.toLowerCase()) ||
      area.legality.toLowerCase().includes(searchText.toLowerCase()),
  );

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.searchInput}
        placeholder="Search by name, barangay, or status..."
        value={searchText}
        onChangeText={setSearchText}
      />

      {loading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#0F4A2F" />
          <Text style={styles.loadingText}>Loading assigned areas...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={fetchAssignedAreas}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={styles.header}>
            Assigned Areas ({filteredAreas.length})
          </Text>

          {filteredAreas.map((area) => (
            <View key={area.id} style={styles.card}>
              <View style={styles.cardInfo}>
                <Text style={styles.cardName}>{area.name}</Text>
                <Text style={styles.cardCoord}>{area.coordinates}</Text>
                <Text style={styles.cardLocation}>{area.location}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        area.legality === "legal"
                          ? "#d4edda"
                          : area.legality === "illegal"
                            ? "#f8d7da"
                            : "#fff3cd",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      {
                        color:
                          area.legality === "legal"
                            ? "#155724"
                            : area.legality === "illegal"
                              ? "#721c24"
                              : "#856404",
                      },
                    ]}
                  >
                    {area.legality.toUpperCase()}
                  </Text>
                </View>
              </View>

              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={styles.viewBtn}
                  onPress={() => openModal(area)}
                >
                  <Text style={styles.viewText}>View</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    {
                      backgroundColor:
                        area.legality === "legal"
                          ? "#0F4A2F"
                          : area.legality === "pending"
                            ? "#DAA520"
                            : "#ccc",
                      marginTop: 8,
                    },
                  ]}
                  onPress={() => handleActionPress(area)}
                  disabled={area.legality === "illegal"}
                >
                  <Text style={styles.actionBtnText}>
                    {area.legality === "pending"
                      ? "Start Pre-Assessment"
                      : area.legality === "legal"
                        ? "Assess Site"
                        : "Restricted"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {filteredAreas.length === 0 && !loading && (
            <Text style={styles.noResults}>
              No areas found matching "{searchText}".
            </Text>
          )}
        </ScrollView>
      )}

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedArea && (
              <>
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
                    description={selectedArea.location}
                  />
                  <Polygon
                    coordinates={[
                      {
                        latitude: selectedArea.latitude + 0.002,
                        longitude: selectedArea.longitude - 0.002,
                      },
                      {
                        latitude: selectedArea.latitude + 0.002,
                        longitude: selectedArea.longitude + 0.002,
                      },
                      {
                        latitude: selectedArea.latitude - 0.002,
                        longitude: selectedArea.longitude + 0.002,
                      },
                      {
                        latitude: selectedArea.latitude - 0.002,
                        longitude: selectedArea.longitude - 0.002,
                      },
                    ]}
                    strokeColor="#0F4A2F"
                    fillColor="rgba(15, 74, 47, 0.3)"
                    strokeWidth={2}
                  />
                </MapView>

                <View style={styles.infoContainer}>
                  <Text style={styles.infoTitle}>{selectedArea.name}</Text>
                  <Text style={styles.infoText}>
                    <Text style={styles.label}>Barangay:</Text>{" "}
                    {selectedArea.location}
                  </Text>
                  <Text style={styles.infoText}>
                    <Text style={styles.label}>Coordinates:</Text>{" "}
                    {selectedArea.coordinates}
                  </Text>
                  <Text style={styles.infoText}>
                    <Text style={styles.label}>Legality:</Text>{" "}
                    <Text
                      style={{
                        fontWeight: "bold",
                        color:
                          selectedArea.legality === "legal" ? "green" : "red",
                      }}
                    >
                      {selectedArea.legality.toUpperCase()}
                    </Text>
                  </Text>
                  <Text style={styles.infoText}>
                    <Text style={styles.label}>Safety:</Text>{" "}
                    {selectedArea.safety_status}
                  </Text>
                </View>

                <View style={styles.buttonRow}>
                  <Pressable style={styles.closeBtn} onPress={closeModal}>
                    <Text style={styles.closeText}>Close</Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.feedbackBtn,
                      {
                        opacity: selectedArea.legality === "illegal" ? 0.5 : 1,
                      },
                    ]}
                    onPress={() => handleActionPress(selectedArea)}
                    disabled={selectedArea.legality === "illegal"}
                  >
                    <Text style={styles.feedbackText}>
                      {selectedArea.legality === "pending"
                        ? "Start Pre-Assessment"
                        : selectedArea.legality === "legal"
                          ? "Assess Site"
                          : "Restricted"}
                    </Text>
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

export default ReforestationAreas;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loadingText: { marginTop: 10, color: "#666" },
  errorText: { color: "red", textAlign: "center", marginBottom: 15 },
  retryBtn: {
    backgroundColor: "#0F4A2F",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: { color: "#fff", fontWeight: "bold" },
  header: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#000",
    marginBottom: 16,
    marginTop: 10,
  },
  searchInput: {
    height: 44,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
    backgroundColor: "#f9f9f9",
  },
  card: {
    flexDirection: "row",
    backgroundColor: "#fff",
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: "#eee",
  },
  cardInfo: { flex: 3, paddingRight: 10 },
  cardName: { fontSize: 16, fontWeight: "bold", color: "#000" },
  cardCoord: { fontSize: 12, color: "#666", marginTop: 2 },
  cardLocation: { fontSize: 13, color: "#555", marginTop: 2 },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 8,
  },
  statusText: { fontSize: 11, fontWeight: "bold", textTransform: "uppercase" },
  cardActions: {
    flex: 1.5,
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
  },
  viewBtn: {
    width: "100%",
    backgroundColor: "#e9ecef",
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 8,
  },
  viewText: { color: "#0F4A2F", fontWeight: "600", fontSize: 12 },
  actionBtn: {
    width: "100%",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 12,
    textAlign: "center",
  },
  noResults: {
    textAlign: "center",
    marginTop: 20,
    color: "#888",
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    height: screenHeight * 0.85,
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    paddingBottom: 30,
  },
  map: {
    width: "100%",
    height: 250,
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: "#eee",
  },
  infoContainer: { flex: 1, marginBottom: 10 },
  infoTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#000",
  },
  infoText: { fontSize: 14, marginBottom: 8, color: "#333", lineHeight: 20 },
  label: { fontWeight: "700", color: "#0F4A2F" },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  closeBtn: {
    flex: 1,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#0F4A2F",
    borderRadius: 8,
    paddingVertical: 14,
    marginRight: 8,
    alignItems: "center",
  },
  closeText: { color: "#0F4A2F", textAlign: "center", fontWeight: "600" },
  feedbackBtn: {
    flex: 1.5,
    backgroundColor: "#0F4A2F",
    borderRadius: 8,
    paddingVertical: 14,
    marginLeft: 8,
    alignItems: "center",
    shadowColor: "#0F4A2F",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  feedbackText: {
    color: "#FFF",
    textAlign: "center",
    fontWeight: "700",
    fontSize: 16,
  },
});
