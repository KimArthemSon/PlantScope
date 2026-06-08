import React, { useState } from "react";
import { useRouter } from "expo-router";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import * as DocumentPicker from "expo-document-picker";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/constants/url_fixed";

export default function Reapply() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    total_members: "",
    description: "",
    project_duration: "",
    maintenance_plan: null as { uri: string; name: string; type: string } | null,
    no_request_seedling: "",
    seedling_description: "",
    seedling_request_file: null as { uri: string; name: string; type: string } | null,
  });

  const update = (key: string, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const pickDocument = async (field: "maintenance_plan" | "seedling_request_file") => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "image/*"],
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      update(field, { 
        uri: asset.uri, 
        name: asset.name, 
        type: asset.mimeType ?? "application/octet-stream" 
      });
    }
  };

  const validate = (): string | null => {
    if (!formData.title.trim()) return "Project title is required.";
    if (!formData.total_members.trim() || isNaN(Number(formData.total_members)) || Number(formData.total_members) < 1) {
      return "Valid total members count is required.";
    }
    if (!formData.description.trim()) return "Project description is required.";
    if (!formData.project_duration.trim() || isNaN(Number(formData.project_duration)) || Number(formData.project_duration) < 1) {
      return "Valid project duration (in months) is required.";
    }
    if (!formData.maintenance_plan) return "Maintenance plan document is required.";
    if (!formData.no_request_seedling.trim() || isNaN(Number(formData.no_request_seedling)) || Number(formData.no_request_seedling) < 1) {
      return "Valid number of seedlings requested is required.";
    }
    
    return null;
  };

  const handleSubmit = async () => {
    const error = validate();
    if (error) {
      Alert.alert("Missing or Invalid Info", error);
      return;
    }

    setLoading(true);
    try {
      const token = await SecureStore.getItemAsync("token");
      if (!token) throw new Error("No authentication token found.");

      const fd = new FormData();
      fd.append("title", formData.title.trim());
      fd.append("total_members", formData.total_members.trim());
      fd.append("description", formData.description.trim());
      fd.append("project_duration", formData.project_duration.trim());
      
      if (formData.maintenance_plan) {
        fd.append("maintenance_plan", formData.maintenance_plan as any);
      }
      
      fd.append("no_request_seedling", formData.no_request_seedling.trim());
      
      // Send empty seedling_type - backend will handle it
      fd.append("seedling_type", JSON.stringify({}));
      
      if (formData.seedling_description.trim()) {
        fd.append("seedling_description", formData.seedling_description.trim());
      }
      
      if (formData.seedling_request_file) {
        fd.append("seedling_request_file", formData.seedling_request_file as any);
      }

      const res = await fetch(`${api}/api/create_reapplication/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: fd,
      });

      const responseData = await res.json();

      if (!res.ok) {
        throw new Error(responseData.error ?? "Failed to submit re-application.");
      }

      Alert.alert(
        "Success 🌱",
        "Your new tree planting application has been submitted and is now under evaluation!",
        [
          {
            text: "View Application",
            onPress: () => router.replace("/tree_growers/application"),
          },
        ]
      );
    } catch (err: any) {
      console.error("Reapply error:", err);
      Alert.alert("Submission Failed", err.message || "Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.root} 
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color="#0F4A2F" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Application</Text>
        <View style={{ width: 38 }} /> {/* Spacer for centering */}
      </View>

      <ScrollView 
        style={styles.scroll} 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={20} color="#0F4A2F" />
          <Text style={styles.infoText}>
            Your existing account and organization details will be reused. Please provide the details for your <Text style={styles.infoBold}>new</Text> tree planting project.
          </Text>
        </View>

        {/* ─── Project Details Section ─── */}
        <Text style={styles.sectionTitle}>Project Details</Text>
        
        <View style={styles.formGroup}>
          <Text style={styles.label}>Project Title *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Barangay San Isidro Reforestation 2024"
            value={formData.title}
            onChangeText={(v) => update("title", v)}
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
            <Text style={styles.label}>Total Members *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 25"
              keyboardType="numeric"
              value={formData.total_members}
              onChangeText={(v) => update("total_members", v)}
              placeholderTextColor="#9CA3AF"
            />
          </View>
          <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
            <Text style={styles.label}>Duration (Months) *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 12"
              keyboardType="numeric"
              value={formData.project_duration}
              onChangeText={(v) => update("project_duration", v)}
              placeholderTextColor="#9CA3AF"
            />
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Project Description *</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder="Describe the goals and scope of this new project..."
            value={formData.description}
            onChangeText={(v) => update("description", v)}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Maintenance Plan Document *</Text>
          <TouchableOpacity 
            style={styles.uploadBtn} 
            onPress={() => pickDocument("maintenance_plan")}
            activeOpacity={0.7}
          >
            <View style={[styles.uploadIconWrap, { backgroundColor: "#E8F5E9" }]}>
              <Ionicons name="document-text-outline" size={22} color="#0F4A2F" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.uploadTitle}>
                {formData.maintenance_plan ? formData.maintenance_plan.name : "Tap to upload Maintenance Plan"}
              </Text>
              <Text style={styles.uploadSub}>PDF, Word, or Image</Text>
            </View>
            {formData.maintenance_plan && <Ionicons name="checkmark-circle" size={22} color="#0F4A2F" />}
          </TouchableOpacity>
        </View>

        {/* ─── Seedling Request Section ─── */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Seedling Request</Text>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Number of Seedlings Requested *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., 500"
            keyboardType="numeric"
            value={formData.no_request_seedling}
            onChangeText={(v) => update("no_request_seedling", v)}
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Seedling Request Description (Optional)</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder="Any specific requirements or notes for the seedlings..."
            value={formData.seedling_description}
            onChangeText={(v) => update("seedling_description", v)}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Supporting Document (Optional)</Text>
          <TouchableOpacity 
            style={styles.uploadBtn} 
            onPress={() => pickDocument("seedling_request_file")}
            activeOpacity={0.7}
          >
            <View style={[styles.uploadIconWrap, { backgroundColor: "#E3F2FD" }]}>
              <Ionicons name="attach-outline" size={22} color="#1565C0" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.uploadTitle}>
                {formData.seedling_request_file ? formData.seedling_request_file.name : "Tap to upload supporting file"}
              </Text>
              <Text style={styles.uploadSub}>PDF, Word, or Image</Text>
            </View>
            {formData.seedling_request_file && <Ionicons name="checkmark-circle" size={22} color="#1565C0" />}
          </TouchableOpacity>
        </View>

        {/* Submit Button */}
        <TouchableOpacity 
          style={[styles.submitBtn, loading && styles.submitDisabled]} 
          onPress={handleSubmit} 
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="leaf-outline" size={20} color="#fff" />
              <Text style={styles.submitText}>Submit New Application</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F4F7F5" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backBtn: { padding: 8, borderRadius: 20 },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#111827" },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
  
  infoBox: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#E8F5E9",
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: "#388E3C",
  },
  infoText: { fontSize: 13, color: "#2E7D32", flex: 1, lineHeight: 19 },
  infoBold: { fontWeight: "700" },

  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F4A2F",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  formGroup: { marginBottom: 16 },
  row: { flexDirection: "row" },
  label: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6 },
  input: {
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#111827",
    backgroundColor: "#fff",
  },
  textarea: { height: 90, paddingTop: 12 },

  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderStyle: "dashed",
    borderRadius: 12,
    padding: 14,
  },
  uploadIconWrap: { width: 42, height: 42, borderRadius: 21, justifyContent: "center", alignItems: "center" },
  uploadTitle: { fontSize: 13, fontWeight: "600", color: "#111827" },
  uploadSub: { fontSize: 11, color: "#9CA3AF", marginTop: 2 },

  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0F4A2F",
    borderRadius: 14,
    paddingVertical: 16,
    gap: 10,
    marginTop: 24,
    shadowColor: "#0F4A2F",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});