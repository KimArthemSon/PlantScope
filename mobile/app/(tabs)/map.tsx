import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  Pressable,
  Alert,
} from "react-native";
import MapView, { Marker, Polygon } from "react-native-maps";
import * as Location from "expo-location";

type SavedCoordinate = {
  id: string;
  latitude: number;
  longitude: number;
};

export default function MapScreen() {
  const [region, setRegion] = useState({
    latitude: 11.0243,
    longitude: 124.5956,
    latitudeDelta: 0.002,
    longitudeDelta: 0.002,
  });

  const [currentLocation, setCurrentLocation] = useState({
    latitude: 11.0243,
    longitude: 124.5956,
  });

  const [savedCoords, setSavedCoords] = useState<SavedCoordinate[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [tracking, setTracking] = useState(false);

  // Multiple restricted polygons
  const restrictedAreas = [
    [
      { latitude: 11.02431287461733, longitude: 124.59562078226513 },
      { latitude: 11.024201019275624, longitude: 124.5957702600251 },
      { latitude: 11.024408750590649, longitude: 124.59589901809558 },
      { latitude: 11.024490099876827, longitude: 124.5957155008457 },
      { latitude: 11.02431287461733, longitude: 124.59562078226513 },
    ],
    [
      { latitude: 11.0247, longitude: 124.596 },
      { latitude: 11.0246, longitude: 124.5962 },
      { latitude: 11.0248, longitude: 124.5963 },
      { latitude: 11.0249, longitude: 124.5961 },
      { latitude: 11.0247, longitude: 124.596 },
    ],
    [
      { latitude: 11.013412952788475, longitude: 124.60426274275979 },
      { latitude: 11.01255875200552, longitude: 124.60448917936651 },
      { latitude: 11.01278537694458, longitude: 124.60553256373072 },
      { latitude: 11.013622144439143, longitude: 124.60527060765631 },
      { latitude: 11.013412952788475, longitude: 124.60426274275979 },
    ],
  ];

  // Check if point is inside polygon
  const isPointInPolygon = (
    point: { latitude: number; longitude: number },
    polygon: { latitude: number; longitude: number }[],
  ) => {
    let x = point.latitude,
      y = point.longitude;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      let xi = polygon[i].latitude,
        yi = polygon[i].longitude;
      let xj = polygon[j].latitude,
        yj = polygon[j].longitude;

      let intersect =
        yi > y !== yj > y &&
        x < ((xj - xi) * (y - yi)) / (yj - yi + 0.00000001) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  };

  const isInsideRestricted = restrictedAreas.some((poly) =>
    isPointInPolygon(currentLocation, poly),
  );

  let locationSubscriber: Location.LocationSubscription | null = null;

  const startTrackingLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission denied", "Cannot access location");
      return;
    }

    setTracking(true);

    locationSubscriber = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 3000,
        distanceInterval: 1,
      },
      (location) => {
        setCurrentLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      },
    );
  };

  const saveCurrentLocation = () => {
    const newCoord: SavedCoordinate = {
      id: Date.now().toString(),
      latitude: currentLocation.latitude,
      longitude: currentLocation.longitude,
    };
    setSavedCoords((prev) => [...prev, newCoord]);
    Alert.alert(
      "Saved!",
      `Latitude: ${newCoord.latitude.toFixed(
        5,
      )}, Longitude: ${newCoord.longitude.toFixed(5)}`,
    );

    setRegion((prev) => ({
      ...prev,
      latitude: newCoord.latitude,
      longitude: newCoord.longitude,
    }));
  };

  const deleteCoordinate = (id: string) => {
    Alert.alert(
      "Delete coordinate",
      "Are you sure you want to delete this point?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            setSavedCoords((prev) => prev.filter((c) => c.id !== id));
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      {/* Current coordinates */}
      <View style={styles.currentCoords}>
        <Text style={styles.coordText}>
          Latitude: {currentLocation.latitude.toFixed(5)}
        </Text>
        <Text style={styles.coordText}>
          Longitude: {currentLocation.longitude.toFixed(5)}
        </Text>
      </View>

      <MapView
        style={styles.map}
        region={region}
        showsUserLocation={tracking}
        onRegionChangeComplete={(r) => setRegion(r)}
      >
        {/* Saved Markers */}
        {savedCoords.map((coord) => (
          <Marker
            key={coord.id}
            coordinate={{
              latitude: coord.latitude,
              longitude: coord.longitude,
            }}
            title="Saved Point"
            pinColor="green"
          />
        ))}

        {/* Draw all restricted polygons */}
        {restrictedAreas.map((poly, index) => (
          <Polygon
            key={index}
            coordinates={poly}
            strokeColor="red"
            fillColor="rgba(255,0,0,0.2)"
            strokeWidth={2}
          />
        ))}
      </MapView>

      {/* Interactive Status Circle */}
      <TouchableOpacity
        activeOpacity={0.8}
        style={[
          styles.statusCircle,
          { backgroundColor: isInsideRestricted ? "red" : "green" },
        ]}
        onPress={() => {
          if (isInsideRestricted) {
            Alert.alert(
              "Restricted Area!",
              "You are currently inside a restricted area. Please move out.",
            );
          } else {
            Alert.alert("Safe Area", "You are not inside any restricted area.");
          }
        }}
      />

      {/* Right Buttons */}
      <View style={styles.buttonContainer}>
        {!tracking && (
          <TouchableOpacity
            style={styles.sideBtn}
            onPress={startTrackingLocation}
          >
            <Text style={styles.btnText}>📍 Start Tracking</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.sideBtn} onPress={saveCurrentLocation}>
          <Text style={styles.btnText}>➕ Save</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.sideBtn}
          onPress={() => setModalVisible(true)}
        >
          <Text style={styles.btnText}>👁 View Saved</Text>
        </TouchableOpacity>
      </View>

      {/* Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Saved Coordinates</Text>

            {savedCoords.length === 0 ? (
              <Text style={{ textAlign: "center", marginTop: 20 }}>
                No saved points yet.
              </Text>
            ) : (
              <FlatList
                data={savedCoords}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <View style={styles.coordItem}>
                    <View>
                      <Text>Latitude: {item.latitude.toFixed(5)}</Text>
                      <Text>Longitude: {item.longitude.toFixed(5)}</Text>
                    </View>
                    <Pressable
                      style={styles.deleteBtn}
                      onPress={() => deleteCoordinate(item.id)}
                    >
                      <Text style={styles.deleteText}>Delete</Text>
                    </Pressable>
                  </View>
                )}
              />
            )}

            <Pressable
              style={styles.closeBtn}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ---------- STYLES ---------- */
const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  currentCoords: {
    position: "absolute",
    top: 40,
    left: 16,
    backgroundColor: "rgba(255,255,255,0.9)",
    padding: 10,
    borderRadius: 8,
    zIndex: 10,
  },
  coordText: { fontWeight: "600", color: "#0F4A2F" },
  buttonContainer: {
    position: "absolute",
    right: 16,
    bottom: 10,
    justifyContent: "space-between",
  },
  sideBtn: {
    backgroundColor: "#0F4A2F",
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  btnText: { color: "#fff", fontWeight: "600", textAlign: "center" },
  statusCircle: {
    position: "absolute",
    right: 16,
    top: 180,
    width: 40, // bigger circle
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    height: 400,
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
  },
  coordItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#EEE",
  },
  deleteBtn: {
    backgroundColor: "#FF4D4D",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  deleteText: { color: "#fff", fontWeight: "600" },
  closeBtn: {
    marginTop: 16,
    backgroundColor: "#0F4A2F",
    paddingVertical: 12,
    borderRadius: 8,
  },
  closeText: { color: "#fff", fontWeight: "600", textAlign: "center" },
});
