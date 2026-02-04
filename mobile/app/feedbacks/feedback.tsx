import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { useRouter } from "expo-router";

/* ---------- TYPES ---------- */

type FeedbackData = {
  site: string;
  seedlingsPlanted: number;
  seedsCollected: number;
  toolsUsed: string;
  observations: string;
};

/* ---------- SAMPLE DATA ---------- */

const SITES: string[] = [
  "Reforestation Site 01",
  "Reforestation Site 02",
  "Reforestation Site 03",
];

/* ---------- FEEDBACK COMPONENT ---------- */

const Feedback: React.FC = () => {
  const [site, setSite] = useState<string>(SITES[0]);
  const [seedlingsPlanted, setSeedlingsPlanted] = useState<string>("");
  const [seedsCollected, setSeedsCollected] = useState<string>("");
  const [toolsUsed, setToolsUsed] = useState<string>("");
  const [observations, setObservations] = useState<string>("");
  const router = useRouter();
  const submitFeedback = (): void => {
    if (
      seedlingsPlanted.trim() === "" &&
      seedsCollected.trim() === "" &&
      toolsUsed.trim() === "" &&
      observations.trim() === ""
    ) {
      Alert.alert("Incomplete Feedback", "Please fill at least one field.");
      router.push("/sites");
      return;
    }

    const feedback: FeedbackData = {
      site,
      seedlingsPlanted: Number(seedlingsPlanted) || 0,
      seedsCollected: Number(seedsCollected) || 0,
      toolsUsed: toolsUsed.trim(),
      observations: observations.trim(),
    };

    console.log("Feedback Submitted:", feedback);
    Alert.alert("Feedback Submitted", "Thank you for your input!");

    // Reset form
    setSeedlingsPlanted("");
    setSeedsCollected("");
    setToolsUsed("");
    setObservations("");
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      <Text style={styles.header}>PlantScope Onsite Feedback</Text>

      {/* Site Picker */}
      <Text style={styles.label}>Site:</Text>
      <View style={styles.pickerContainer}>
        <Picker
          selectedValue={site}
          onValueChange={(itemValue: string) => setSite(itemValue)}
          style={styles.picker}
        >
          {SITES.map((s: string, i: number) => (
            <Picker.Item key={i} label={s} value={s} />
          ))}
        </Picker>
      </View>

      {/* Seedlings Planted */}
      <Text style={styles.label}>Seedlings Planted:</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter number of seedlings planted"
        keyboardType="numeric"
        value={seedlingsPlanted}
        onChangeText={(text: string) => setSeedlingsPlanted(text)}
      />

      {/* Seeds Collected */}
      <Text style={styles.label}>Seeds Collected:</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter number of seeds collected"
        keyboardType="numeric"
        value={seedsCollected}
        onChangeText={(text: string) => setSeedsCollected(text)}
      />

      {/* Tools Used */}
      <Text style={styles.label}>Tools Used:</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g., shovel, rake, watering can"
        value={toolsUsed}
        onChangeText={(text: string) => setToolsUsed(text)}
      />

      {/* Observations */}
      <Text style={styles.label}>Observations / Notes:</Text>
      <TextInput
        style={[styles.input, { height: 100 }]}
        placeholder="Enter observations such as soil condition, erosion, or plant health"
        multiline
        value={observations}
        onChangeText={(text: string) => setObservations(text)}
      />

      {/* Submit Button */}
      <TouchableOpacity style={styles.submitBtn} onPress={submitFeedback}>
        <Text style={styles.submitText}>Submit Feedback</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

export default Feedback;

/* ---------- STYLES ---------- */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  header: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 24,
    color: "#0F4A2F",
    textAlign: "center",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 6,
    color: "#333",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
    backgroundColor: "#f9f9f9",
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    marginBottom: 16,
    overflow: "hidden",
  },
  picker: {
    height: 44,
    width: "100%",
  },
  submitBtn: {
    backgroundColor: "#0F4A2F",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 12,
  },
  submitText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
});
