import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from "react-native";

interface Props {
  existingData: any;
  onSave: (data: any, submit: boolean) => Promise<void>;
  onUploadImage: (id: string) => void;
  saving: boolean;
  assessmentId?: string;
}

export default function SlopeForm({
  existingData,
  onSave,
  onUploadImage,
  saving,
  assessmentId,
}: Props) {
  const [degrees, setDegrees] = useState(
    existingData?.visual_estimate_degrees?.toString() || "0",
  );
  const [erosion, setErosion] = useState(existingData?.erosion_signs || "");
  const [comment, setComment] = useState(existingData?.inspector_comment || "");

  const handleSubmit = async (submit: boolean) => {
    await onSave(
      {
        visual_estimate_degrees: parseInt(degrees),
        erosion_signs: erosion,
        inspector_comment: comment,
      },
      submit,
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Slope Degrees (Visual Estimate)</Text>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        value={degrees}
        onChangeText={setDegrees}
      />
      <Text style={styles.label}>Erosion Signs</Text>
      <TextInput
        style={styles.input}
        multiline
        value={erosion}
        onChangeText={setErosion}
      />
      <Text style={styles.label}>Comments</Text>
      <TextInput
        style={styles.input}
        multiline
        value={comment}
        onChangeText={setComment}
      />

      <TouchableOpacity
        style={styles.uploadBtn}
        onPress={() => onUploadImage(assessmentId || "")}
      >
        <Text>📷 Add Photo</Text>
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
  label: { fontWeight: "bold", marginTop: 10 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    minHeight: 60,
    marginBottom: 10,
  },
  uploadBtn: {
    padding: 15,
    backgroundColor: "#e9ecef",
    borderRadius: 8,
    alignItems: "center",
    marginVertical: 10,
  },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 20 },
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
