import { useRouter, useLocalSearchParams } from "expo-router";
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Switch,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import { api } from "@/constants/url_fixed";

const API_BASE_URL = `${api}/api`;

export default function Pre_assessment_form() {
  const { id, areaId } = useLocalSearchParams<{
    id?: string;
    areaId: string;
  }>();

  const router = useRouter();
  const isEditMode = !!id;

  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [title, setTitle] = useState("Pre-Assessment Gate");
  const [description, setDescription] = useState("");
  const [isSafe, setIsSafe] = useState(true);
  const [isLegal, setIsLegal] = useState(true);
  const [safeReason, setSafeReason] = useState("");
  const [legalReason, setLegalReason] = useState("");
  const [statement, setStatement] = useState("");

  // Track if the record is already submitted
  const [isSent, setIsSent] = useState(false);

  useEffect(() => {
    if (isEditMode) {
      fetchDetail();
    }
  }, []);

  const fetchDetail = async () => {
    try {
      const token = await SecureStore.getItemAsync("token");
      // Ensure you have this endpoint implemented in views.py
      const res = await fetch(`${API_BASE_URL}/get_field_assessment/${id}/`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();

      setTitle(data.title);
      setDescription(data.description || "");
      setIsSent(data.is_sent); // Set the sent status

      const gate = data.data.pre_assessment_gate;
      setIsSafe(gate.general_safety_check.is_safe_to_enter);
      setIsLegal(gate.general_legality_check.is_accessible_legally);
      setSafeReason(gate.general_safety_check.blocker_reason || "");
      setLegalReason(gate.general_legality_check.blocker_reason || "");
      setStatement(gate.inspector_clearance_statement || "");
    } catch (e) {
      Alert.alert("Error", "Failed to load assessment details");
      router.back();
    } finally {
      setLoading(false);
    }
  };

  // 1. SAVE DRAFT (Create or Update data only)
  const handleSaveDraft = async () => {
    if (!statement.trim()) {
      Alert.alert("Missing Info", "Inspector clearance statement is required.");
      return;
    }

    setSaving(true);
    try {
      const token = await SecureStore.getItemAsync("token");

      const payload = {
        reforestation_area_id: parseInt(areaId),
        site_id: null,
        multicriteria_type: "pre_assessment",
        title,
        description,
        field_assessment_data: {
          assessment_date: new Date().toISOString(),
          pre_assessment_gate: {
            status: isSafe && isLegal ? "PASSED" : "FAILED",
            general_safety_check: {
              is_safe_to_enter: isSafe,
              blocker_reason: isSafe ? null : safeReason,
            },
            general_legality_check: {
              is_accessible_legally: isLegal,
              blocker_reason: isLegal ? null : legalReason,
            },
            inspector_clearance_statement: statement,
            clearance_timestamp: new Date().toISOString(),
          },
        },
      };

      const url = isEditMode
        ? `${API_BASE_URL}/update_field_assessment/${id}/`
        : `${API_BASE_URL}/create_field_assessment/`;

      const method = isEditMode ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to save draft");
      }

      const responseData = await res.json();

      // If creating new, we might get a new ID, update state if needed
      if (!isEditMode && responseData.field_assessment_id) {
        // Optionally redirect to the edit screen of the new ID or just stay
        Alert.alert("Success", "Draft saved. You can now submit when ready.");
      } else {
        Alert.alert("Success", "Draft updated successfully.");
      }
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setSaving(false);
    }
  };

  // 2. SUBMIT ASSESSMENT (Update is_sent to TRUE)
  const handleSubmitAssessment = async () => {
    // Final Validation before sending
    if (!isSafe || !isLegal) {
      Alert.alert(
        "Cannot Submit",
        "You cannot submit this assessment because Safety or Legality checks failed. Please resolve these issues or mark as Failed in the report.",
        [{ text: "OK" }],
      );
      return;
    }

    Alert.alert(
      "Finalize Assessment",
      "Once submitted, this assessment cannot be edited or deleted. Are you sure?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, Submit",
          style: "default",
          onPress: async () => {
            setSubmitting(true);
            try {
              const token = await SecureStore.getItemAsync("token");

              // Call the specific endpoint for updating is_sent
              const res = await fetch(
                `${API_BASE_URL}/update_field_assessment_is_sent/${id}/`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({ is_sent: true }),
                },
              );

              if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || "Failed to submit");
              }

              Alert.alert("Success", "Assessment finalized and submitted!", [
                { text: "OK", onPress: () => router.back() },
              ]);
            } catch (e: any) {
              Alert.alert("Error", e.message);
            } finally {
              setSubmitting(false);
            }
          },
        },
      ],
    );
  };

  if (loading)
    return <ActivityIndicator size="large" style={{ marginTop: 50 }} />;

  const isReadOnly = isSent;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.label}>Title</Text>
      <TextInput
        style={[styles.input, isReadOnly && styles.readOnly]}
        value={title}
        onChangeText={setTitle}
        editable={!isReadOnly}
      />

      <Text style={styles.label}>Description</Text>
      <TextInput
        style={[styles.input, styles.textArea, isReadOnly && styles.readOnly]}
        value={description}
        onChangeText={setDescription}
        multiline
        editable={!isReadOnly}
      />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>1. Safety Check</Text>
        <View style={styles.row}>
          <Text>Is site safe to enter?</Text>
          <Switch
            value={isSafe}
            onValueChange={isReadOnly ? null : setIsSafe}
            disabled={isReadOnly}
          />
        </View>
        {!isSafe && (
          <TextInput
            style={[
              styles.input,
              { borderColor: "red" },
              isReadOnly && styles.readOnly,
            ]}
            placeholder="Reason why it's unsafe..."
            value={safeReason}
            onChangeText={setSafeReason}
            editable={!isReadOnly}
          />
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>2. Legality Check</Text>
        <View style={styles.row}>
          <Text>Is site legally accessible?</Text>
          <Switch
            value={isLegal}
            onValueChange={isReadOnly ? null : setIsLegal}
            disabled={isReadOnly}
          />
        </View>
        {!isLegal && (
          <TextInput
            style={[
              styles.input,
              { borderColor: "red" },
              isReadOnly && styles.readOnly,
            ]}
            placeholder="Reason for legal block..."
            value={legalReason}
            onChangeText={setLegalReason}
            editable={!isReadOnly}
          />
        )}
      </View>

      <Text style={styles.label}>Inspector Clearance Statement</Text>
      <TextInput
        style={[styles.input, styles.textArea, isReadOnly && styles.readOnly]}
        value={statement}
        onChangeText={setStatement}
        multiline
        placeholder="I verify that I have coordinated with..."
        editable={!isReadOnly}
      />

      {/* ACTION BUTTONS */}
      <View style={styles.buttonContainer}>
        {isSent ? (
          // State: Already Submitted
          <View style={styles.submittedBadge}>
            <Text style={styles.submittedText}>✓ ASSESSMENT SUBMITTED</Text>
            <Text style={styles.submittedSubtext}>
              This record is locked and cannot be changed.
            </Text>
          </View>
        ) : (
          // State: Draft
          <>
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.btnDisabled]}
              onPress={handleSaveDraft}
              disabled={saving}
            >
              <Text style={styles.saveBtnText}>
                {saving ? "Saving..." : "Save Draft"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitBtn, submitting && styles.btnDisabled]}
              onPress={handleSubmitAssessment}
              disabled={submitting}
            >
              <Text style={styles.submitBtnText}>
                {submitting ? "Submitting..." : "Submit Assessment"}
              </Text>
            </TouchableOpacity>

            <Text style={styles.warningText}>
              ⚠️ Submitting will finalize this record. It cannot be edited or
              deleted afterwards.
            </Text>
          </>
        )}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#fff" },
  label: { fontWeight: "bold", marginBottom: 5, marginTop: 15, color: "#333" },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#f9f9f9",
    fontSize: 15,
  },
  readOnly: {
    backgroundColor: "#e9ecef",
    color: "#6c757d",
    borderColor: "#dee2e6",
  },
  textArea: { height: 80, textAlignVertical: "top" },
  section: {
    marginTop: 20,
    padding: 15,
    backgroundColor: "#f0f4f0",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#d4edda",
  },
  sectionTitle: {
    fontWeight: "bold",
    fontSize: 16,
    marginBottom: 10,
    color: "#0F4A2F",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  buttonContainer: {
    marginTop: 30,
    gap: 12,
  },
  saveBtn: {
    backgroundColor: "#6c757d", // Gray for draft
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
  },
  saveBtnText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  submitBtn: {
    backgroundColor: "#0F4A2F", // Green for final submit
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    shadowColor: "#0F4A2F",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  submitBtnText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  btnDisabled: {
    opacity: 0.6,
  },
  warningText: {
    textAlign: "center",
    color: "#856404",
    fontSize: 12,
    marginTop: 5,
    fontStyle: "italic",
  },
  submittedBadge: {
    backgroundColor: "#d4edda",
    borderColor: "#c3e6cb",
    borderWidth: 1,
    borderRadius: 8,
    padding: 20,
    alignItems: "center",
  },
  submittedText: {
    color: "#155724",
    fontWeight: "bold",
    fontSize: 18,
    marginBottom: 5,
  },
  submittedSubtext: {
    color: "#155724",
    fontSize: 14,
    textAlign: "center",
  },
});
