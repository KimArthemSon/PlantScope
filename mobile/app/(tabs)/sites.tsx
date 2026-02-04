import { useRouter } from "expo-router";
import React, { useState } from "react";
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
} from "react-native";
import MapView, { Marker, Polygon } from "react-native-maps";

const screenHeight = Dimensions.get("window").height;

/* ---------- TYPES ---------- */

type Site = {
  id: string;
  name: string;
  coordinates: string;
  location: string;
  status: string;
  description: string;
  latitude: number;
  longitude: number;
};

/* ---------- SAMPLE DATA ---------- */

const SITES: Site[] = [
  {
    id: "1",
    name: "Reforestation Site 01",
    coordinates: "11.0064° N, 124.6075° E",
    location: "Brgy. Alta Vista, Ormoc City",
    status: "Ongoing",
    description: "Planting native trees. Area is on a slope.",
    latitude: 11.0064,
    longitude: 124.6075,
  },
  {
    id: "2",
    name: "Reforestation Site 02",
    coordinates: "11.0192° N, 124.5901° E",
    location: "Brgy. Naungan, Ormoc City",
    status: "Completed",
    description: "Successfully planted 1500 seedlings.",
    latitude: 11.0192,
    longitude: 124.5901,
  },
  {
    id: "3",
    name: "Reforestation Site 03",
    coordinates: "11.0310° N, 124.6123° E",
    location: "Brgy. San Jose, Ormoc City",
    status: "Ongoing",
    description: "Some seedlings need replanting due to soil erosion.",
    latitude: 11.031,
    longitude: 124.6123,
  },
];

/* ---------- SCREEN ---------- */

const Sites: React.FC = () => {
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [searchText, setSearchText] = useState("");
  const router = useRouter();
  const openModal = (site: Site) => {
    setSelectedSite(site);
    setModalVisible(true);
  };

  const closeModal = () => {
    setSelectedSite(null);
    setModalVisible(false);
  };

  // Filter sites based on search text
  const filteredSites = SITES.filter(
    (site) =>
      site.name.toLowerCase().includes(searchText.toLowerCase()) ||
      site.location.toLowerCase().includes(searchText.toLowerCase()) ||
      site.status.toLowerCase().includes(searchText.toLowerCase()),
  );

  return (
    <View style={styles.container}>
      {/* ---------- SEARCH BAR ---------- */}
      <TextInput
        style={styles.searchInput}
        placeholder="Search by name, location, or status..."
        value={searchText}
        onChangeText={setSearchText}
      />

      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.header}>Assigned Reforestation Area</Text>

        {filteredSites.map((site) => (
          <View key={site.id} style={styles.siteCard}>
            <View style={styles.siteInfo}>
              <Text style={styles.siteName}>{site.name}</Text>
              <Text style={styles.siteCoord}>{site.coordinates}</Text>
              <Text style={styles.siteLocation}>{site.location}</Text>
            </View>
            <TouchableOpacity
              style={styles.viewBtn}
              onPress={() => openModal(site)}
            >
              <Text style={styles.viewText}>View More</Text>
            </TouchableOpacity>
          </View>
        ))}

        {filteredSites.length === 0 && (
          <Text style={styles.noResults}>No sites found.</Text>
        )}
      </ScrollView>

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
                  />
                  <Polygon
                    coordinates={[
                      {
                        latitude: selectedSite.latitude + 0.001,
                        longitude: selectedSite.longitude - 0.001,
                      },
                      {
                        latitude: selectedSite.latitude + 0.001,
                        longitude: selectedSite.longitude + 0.001,
                      },
                      {
                        latitude: selectedSite.latitude - 0.001,
                        longitude: selectedSite.longitude + 0.001,
                      },
                      {
                        latitude: selectedSite.latitude - 0.001,
                        longitude: selectedSite.longitude - 0.001,
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
                    <Text style={styles.label}>Coordinates:</Text>{" "}
                    {selectedSite.coordinates}
                  </Text>
                  <Text style={styles.infoText}>
                    <Text style={styles.label}>Location:</Text>{" "}
                    {selectedSite.location}
                  </Text>
                  <Text style={styles.infoText}>
                    <Text style={styles.label}>Status:</Text>{" "}
                    {selectedSite.status}
                  </Text>
                  <Text style={styles.infoText}>
                    <Text style={styles.label}>Description:</Text>{" "}
                    {selectedSite.description}
                  </Text>
                </View>

                <View style={styles.buttonRow}>
                  <Pressable style={styles.closeBtn} onPress={closeModal}>
                    <Text style={styles.closeText}>Close</Text>
                  </Pressable>
                  <Pressable
                    style={styles.feedbackBtn}
                    onPress={() => router.push("/feedbacks/feedback")}
                  >
                    <Text style={styles.feedbackText}>Feedback</Text>
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

  header: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#000",
    marginBottom: 16,
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
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },

  siteInfo: {
    flex: 3,
  },

  siteName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#000",
  },

  siteCoord: {
    fontSize: 13,
    color: "#555",
    marginTop: 2,
  },

  siteLocation: {
    fontSize: 13,
    color: "#555",
    marginTop: 2,
  },

  viewBtn: {
    flex: 1,
    backgroundColor: "#0F4A2F",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },

  viewText: {
    color: "#fff",
    fontWeight: "600",
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
    height: screenHeight * 0.8,
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
  },

  map: {
    width: "100%",
    height: 280,
    borderRadius: 12,
    marginBottom: 16,
  },

  infoContainer: {
    flex: 1,
  },

  infoTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#000",
  },

  infoText: {
    fontSize: 14,
    marginBottom: 6,
    color: "#333",
  },

  label: {
    fontWeight: "600",
    color: "#000",
  },

  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
  },

  closeBtn: {
    flex: 1,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#0F4A2F",
    borderRadius: 8,
    paddingVertical: 12,
    marginRight: 8,
  },

  closeText: {
    color: "#0F4A2F",
    textAlign: "center",
    fontWeight: "600",
  },

  feedbackBtn: {
    flex: 1,
    backgroundColor: "#0F4A2F",
    borderRadius: 8,
    paddingVertical: 12,
    marginLeft: 8,
  },

  feedbackText: {
    color: "#FFF",
    textAlign: "center",
    fontWeight: "600",
  },
});
