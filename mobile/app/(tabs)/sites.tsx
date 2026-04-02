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
// For Android Emulator: http://10.0.2.2:8000/api
// For iOS Simulator: http://localhost:8000/api
// For Physical Device: http://YOUR_IP_ADDRESS:8000/api
const API_BASE_URL = api + "/api";

/* ---------- TYPES ---------- */

type Site = {
  id: string;
  name: string;
  coordinates: string;
  location: string;
  legality: string; // 'legal', 'pending', 'illegal'
  latitude: number;
  longitude: number;
  safety_status: string;
};

/* ---------- SCREEN ---------- */

const Sites: React.FC = () => {
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [searchText, setSearchText] = useState("");
  const [areas, setAreas] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();

  // Fetch Data from Django API
  const fetchAssignedAreas = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = await SecureStore.getItemAsync("token");
      if (!token) {
        throw new Error("No authentication token found.");
      }

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

      const mappedSites: Site[] = data.map((item: any) => ({
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

      setAreas(mappedSites);
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

  const openModal = (site: Site) => {
    setSelectedSite(site);
    setModalVisible(true);
  };

  const closeModal = () => {
    setSelectedSite(null);
    setModalVisible(false);
  };

  const handleActionPress = (site: Site) => {
    if (site.legality === "pending") {
      router.push({
        pathname: "/feedbacks/pre_assessment",
        params: { areaId: site.id, areaName: site.name },
      });
    } else if (site.legality === "legal") {
      router.push({
        pathname: "/feedbacks/select_layer",
        params: { areaId: site.id, areaName: site.name },
      });
    } else {
      Alert.alert(
        "Restricted",
        "This area is marked as Illegal. No assessment allowed.",
      );
    }
  };

  // Filter sites based on search text
  const filteredSites = areas.filter(
    (site) =>
      site.name.toLowerCase().includes(searchText.toLowerCase()) ||
      site.location.toLowerCase().includes(searchText.toLowerCase()) ||
      site.legality.toLowerCase().includes(searchText.toLowerCase()),
  );

  return (
    <View style={styles.container}>
      {/* ---------- SEARCH BAR ---------- */}
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
            Assigned Areas ({filteredSites.length})
          </Text>

          {filteredSites.map((site) => (
            <View key={site.id} style={styles.siteCard}>
              <View style={styles.siteInfo}>
                <Text style={styles.siteName}>{site.name}</Text>
                <Text style={styles.siteCoord}>{site.coordinates}</Text>
                <Text style={styles.siteLocation}>{site.location}</Text>

                {/* Status Badge */}
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        site.legality === "legal"
                          ? "#d4edda"
                          : site.legality === "illegal"
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
                          site.legality === "legal"
                            ? "#155724"
                            : site.legality === "illegal"
                              ? "#721c24"
                              : "#856404",
                      },
                    ]}
                  >
                    {site.legality.toUpperCase()}
                  </Text>
                </View>
              </View>

              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={styles.viewBtn}
                  onPress={() => openModal(site)}
                >
                  <Text style={styles.viewText}>View</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    {
                      backgroundColor:
                        site.legality === "legal"
                          ? "#0F4A2F"
                          : site.legality === "pending"
                            ? "#DAA520"
                            : "#ccc",
                      marginTop: 8,
                    },
                  ]}
                  onPress={() => handleActionPress(site)}
                  disabled={site.legality === "illegal"}
                >
                  <Text style={styles.actionBtnText}>
                    {site.legality === "pending"
                      ? "Start Pre-Assessment"
                      : site.legality === "legal"
                        ? "Select Layer"
                        : "Restricted"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {filteredSites.length === 0 && !loading && (
            <Text style={styles.noResults}>
              No areas found matching "{searchText}".
            </Text>
          )}
        </ScrollView>
      )}

      {/* ---------- MODAL ---------- */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedSite && (
              <>
                <MapView
                  style={styles.map}
                  initialRegion={{
                    latitude: selectedSite.latitude,
                    longitude: selectedSite.longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                  }}
                >
                  <Marker
                    coordinate={{
                      latitude: selectedSite.latitude,
                      longitude: selectedSite.longitude,
                    }}
                    title={selectedSite.name}
                    description={selectedSite.location}
                  />
                  {/* Visual Placeholder Polygon */}
                  <Polygon
                    coordinates={[
                      {
                        latitude: selectedSite.latitude + 0.002,
                        longitude: selectedSite.longitude - 0.002,
                      },
                      {
                        latitude: selectedSite.latitude + 0.002,
                        longitude: selectedSite.longitude + 0.002,
                      },
                      {
                        latitude: selectedSite.latitude - 0.002,
                        longitude: selectedSite.longitude + 0.002,
                      },
                      {
                        latitude: selectedSite.latitude - 0.002,
                        longitude: selectedSite.longitude - 0.002,
                      },
                    ]}
                    strokeColor="#0F4A2F"
                    fillColor="rgba(15, 74, 47, 0.3)"
                    strokeWidth={2}
                  />
                </MapView>

                <View style={styles.infoContainer}>
                  <Text style={styles.infoTitle}>{selectedSite.name}</Text>
                  <Text style={styles.infoText}>
                    <Text style={styles.label}>Barangay:</Text>{" "}
                    {selectedSite.location}
                  </Text>
                  <Text style={styles.infoText}>
                    <Text style={styles.label}>Coordinates:</Text>{" "}
                    {selectedSite.coordinates}
                  </Text>
                  <Text style={styles.infoText}>
                    <Text style={styles.label}>Legality Status:</Text>{" "}
                    <Text
                      style={{
                        fontWeight: "bold",
                        color:
                          selectedSite.legality === "legal" ? "green" : "red",
                      }}
                    >
                      {selectedSite.legality.toUpperCase()}
                    </Text>
                  </Text>
                  <Text style={styles.infoText}>
                    <Text style={styles.label}>Safety:</Text>{" "}
                    {selectedSite.safety_status}
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
                        opacity: selectedSite.legality === "illegal" ? 0.5 : 1,
                      },
                    ]}
                    onPress={() => handleActionPress(selectedSite)}
                    disabled={selectedSite.legality === "illegal"}
                  >
                    <Text style={styles.feedbackText}>
                      {selectedSite.legality === "pending"
                        ? "Start Pre-Assessment"
                        : selectedSite.legality === "legal"
                          ? "Select Layer"
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

export default Sites;

/* ---------- STYLES ---------- */

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
  loadingText: {
    marginTop: 10,
    color: "#666",
  },
  errorText: {
    color: "red",
    textAlign: "center",
    marginBottom: 15,
  },
  retryBtn: {
    backgroundColor: "#0F4A2F",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: "#fff",
    fontWeight: "bold",
  },
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
  siteCard: {
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
  siteInfo: {
    flex: 3,
    paddingRight: 10,
  },
  siteName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#000",
  },
  siteCoord: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  siteLocation: {
    fontSize: 13,
    color: "#555",
    marginTop: 2,
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
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
  viewText: {
    color: "#0F4A2F",
    fontWeight: "600",
    fontSize: 12,
  },
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
  infoContainer: {
    flex: 1,
    marginBottom: 10,
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#000",
  },
  infoText: {
    fontSize: 14,
    marginBottom: 8,
    color: "#333",
    lineHeight: 20,
  },
  label: {
    fontWeight: "700",
    color: "#0F4A2F",
  },
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
  closeText: {
    color: "#0F4A2F",
    textAlign: "center",
    fontWeight: "600",
  },
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
