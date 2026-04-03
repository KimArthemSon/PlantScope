import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";

interface Props {
  existingData: any;
  onSave: (data: any, submit: boolean) => Promise<void>;
  onUploadImage: (id: string) => void;
  saving: boolean;
  assessmentId?: string;
}

export default function SoilForm({
  existingData,
  onSave,
  onUploadImage,
  saving,
  assessmentId,
}: Props) {
  const [moisture, setMoisture] = useState(
    existingData?.moisture_level || "Moderate",
  );
  const [rockiness, setRockiness] = useState(existingData?.rockiness || "Low");
  const [comment, setComment] = useState(existingData?.inspector_comment || "");

  const handleSubmit = async (submit: boolean) => {
    const data = {
      moisture_level: moisture,
      rockiness: rockiness,
      inspector_comment: comment,
    };
    await onSave(data, submit);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Moisture Level</Text>
      <View style={styles.row}>
        {["Low", "Moderate", "High"].map((lvl) => (
          <TouchableOpacity
            key={lvl}
            style={[styles.btn, moisture === lvl && styles.btnActive]}
            onPress={() => setMoisture(lvl)}
          >
            <Text
              style={[styles.btnText, moisture === lvl && styles.btnTextActive]}
            >
              {lvl}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Rockiness / Texture</Text>
      <View style={styles.row}>
        {["Low", "Moderate", "High"].map((lvl) => (
          <TouchableOpacity
            key={lvl}
            style={[styles.btn, rockiness === lvl && styles.btnActive]}
            onPress={() => setRockiness(lvl)}
          >
            <Text
              style={[
                styles.btnText,
                rockiness === lvl && styles.btnTextActive,
              ]}
            >
              {lvl}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Soil Description & Comments</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g., Dark loam, ideal for planting..."
        multiline
        value={comment}
        onChangeText={setComment}
      />

      <TouchableOpacity
        style={styles.uploadBtn}
        onPress={() => onUploadImage(assessmentId || "")}
      >
        <Text>📷 Add Soil Photo</Text>
      </TouchableOpacity>

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
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  label: { fontWeight: "bold", marginTop: 10, marginBottom: 5 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 15 },
  btn: {
    flex: 1,
    padding: 10,
    borderWidth: 1,
    borderColor: "#0F4A2F",
    borderRadius: 6,
    alignItems: "center",
  },
  btnActive: { backgroundColor: "#0F4A2F" },
  btnText: { color: "#0F4A2F", fontWeight: "bold" },
  btnTextActive: { color: "#fff" },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    minHeight: 80,
    marginBottom: 15,
    backgroundColor: "#f9f9f9",
  },
  uploadBtn: {
    padding: 15,
    backgroundColor: "#e9ecef",
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 20,
    borderStyle: "dashed",
    borderWidth: 1,
    borderColor: "#ccc",
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
