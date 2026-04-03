import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import MapView, { Marker, Polygon } from "react-native-maps";
import * as Location from "expo-location";

interface Props {
  existingData: any;
  onSave: (data: any, submit: boolean) => Promise<void>;
  onUploadImage: (id: string) => void;
  saving: boolean;
  assessmentId?: string;
}

export default function LegalityForm({
  existingData,
  onSave,
  onUploadImage,
  saving,
  assessmentId,
}: Props) {
  const [coords, setCoords] = useState<any[]>(
    existingData?.polygon_coordinates?.[0] || [],
  );
  const [marker, setMarker] = useState<any>(
    existingData?.marker_coordinate || null,
  );
  const [comment, setComment] = useState(existingData?.inspector_comment || "");
  const [currentLoc, setCurrentLoc] = useState({
    latitude: 11.0243,
    longitude: 124.5956,
  });

  const addPoint = () => setCoords([...coords, currentLoc]);
  const saveMarker = () => setMarker(currentLoc);

  const handleSubmit = async (submit: boolean) => {
    if (coords.length < 3)
      return Alert.alert(
        "Error",
        "Draw at least 3 points for a valid polygon.",
      );
    await onSave(
      {
        polygon_coordinates: [coords],
        marker_coordinate: marker,
        inspector_comment: comment,
      },
      submit,
    );
  };

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        let loc = await Location.getCurrentPositionAsync({});
        setCurrentLoc({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
      }
    })();
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <MapView
        style={{ flex: 1 }}
        region={{ ...currentLoc, latitudeDelta: 0.005, longitudeDelta: 0.005 }}
      >
        {coords.map((pt, i) => (
          <Marker key={`pt-${i}`} coordinate={pt} pinColor="blue" />
        ))}
        {coords.length > 0 && (
          <Polygon
            coordinates={coords}
            strokeColor="#0F4A2F"
            fillColor="rgba(15,74,47,0.3)"
          />
        )}
        {marker && (
          <Marker
            coordinate={marker}
            pinColor="green"
            title="Verified Marker"
          />
        )}
        <Marker coordinate={currentLoc} pinColor="red" title="You" />
      </MapView>

      <View style={styles.controls}>
        <TouchableOpacity style={styles.ctrlBtn} onPress={addPoint}>
          <Text style={styles.ctrlText}>➕ Add Point</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.ctrlBtn} onPress={saveMarker}>
          <Text style={styles.ctrlText}>📍 Save Marker</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.ctrlBtn}
          onPress={() => onUploadImage(assessmentId || "")}
        >
          <Text style={styles.ctrlText}>📷 Photo</Text>
        </TouchableOpacity>
      </View>

      <View style={{ padding: 16, backgroundColor: "#fff" }}>
        <TextInput
          style={styles.input}
          placeholder="Boundary Comments"
          multiline
          value={comment}
          onChangeText={setComment}
        />
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={() => handleSubmit(false)}
            disabled={saving}
          >
            <Text style={styles.whiteText}>Save Draft</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.submitBtn}
            onPress={() => handleSubmit(true)}
            disabled={saving}
          >
            <Text style={styles.whiteText}>Submit</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  controls: { position: "absolute", right: 10, top: 10, gap: 10, zIndex: 10 },
  ctrlBtn: { backgroundColor: "#0F4A2F", padding: 10, borderRadius: 8 },
  ctrlText: { color: "#fff", fontWeight: "bold" },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    minHeight: 60,
    marginBottom: 10,
  },
  actionRow: { flexDirection: "row", gap: 10 },
  saveBtn: {
    flex: 1,
    backgroundColor: "#6c757d",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
  },
  submitBtn: {
    flex: 1,
    backgroundColor: "#0F4A2F",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
  },
  whiteText: { color: "#fff", fontWeight: "bold" },
});
