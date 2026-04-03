import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
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

export default function TreeSpeciesForm({
  existingData,
  onSave,
  onUploadImage,
  saving,
  assessmentId,
}: Props) {
  const [recommended, setRecommended] = useState(
    existingData?.recommended_species || [],
  );
  const [avoid, setAvoid] = useState(existingData?.species_to_avoid || []);
  const [newName, setNewName] = useState("");
  const [newReason, setNewReason] = useState("");

  const addRecommended = () => {
    if (!newName) return Alert.alert("Error", "Enter a species name");
    setRecommended([
      ...recommended,
      { name: newName, reason: newReason, confidence_score: 85 },
    ]);
    setNewName("");
    setNewReason("");
  };

  const handleSubmit = async (submit: boolean) => {
    await onSave(
      { recommended_species: recommended, species_to_avoid: avoid },
      submit,
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Recommended Species</Text>
      <FlatList
        data={recommended}
        keyExtractor={(item, i) => i.toString()}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Text style={styles.bold}>{item.name}</Text>
            <Text>{item.reason}</Text>
          </View>
        )}
      />

      <TextInput
        style={styles.input}
        placeholder="Species Name"
        value={newName}
        onChangeText={setNewName}
      />
      <TextInput
        style={styles.input}
        placeholder="Reason"
        value={newReason}
        onChangeText={setNewReason}
      />
      <TouchableOpacity style={styles.addBtn} onPress={addRecommended}>
        <Text style={styles.whiteText}>Add Species</Text>
      </TouchableOpacity>

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
  header: { fontSize: 16, fontWeight: "bold", marginBottom: 10 },
  item: {
    padding: 10,
    borderBottomWidth: 1,
    borderColor: "#eee",
    marginBottom: 5,
  },
  bold: { fontWeight: "bold" },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    marginBottom: 5,
  },
  addBtn: {
    backgroundColor: "#0F4A2F",
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 20,
  },
  uploadBtn: {
    padding: 15,
    backgroundColor: "#e9ecef",
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 20,
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
