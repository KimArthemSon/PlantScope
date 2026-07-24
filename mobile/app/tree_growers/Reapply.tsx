import React, { useState } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
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
  Modal,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import * as DocumentPicker from "expo-document-picker";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context"; // ✅ Added
import { api } from "@/constants/url_fixed";

export default function Reapply() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets(); // ✅ Added
  const siteId = params.site_id as string | undefined;
  const siteName = params.site_name as string | undefined;

  const [loading, setLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    total_treegrowers_will_participate: "",
    maintenance_plan: null as {
      uri: string;
      name: string;
      type: string;
    } | null,
    proposed_orientation_date: "",
  });

  // ✅ Custom Date Picker State
  const [tempDate, setTempDate] = useState(new Date());

  const update = (key: string, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "image/*",
      ],
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      update("maintenance_plan", {
        uri: asset.uri,
        name: asset.name,
        type: asset.mimeType ?? "application/octet-stream",
      });
    }
  };

  // ✅ Custom Date Picker Functions
  const openDatePicker = () => {
    if (formData.proposed_orientation_date) {
      setTempDate(new Date(formData.proposed_orientation_date));
    } else {
      setTempDate(new Date());
    }
    setShowDatePicker(true);
  };

  const confirmDate = () => {
    const formattedDate = tempDate.toISOString().split("T")[0];
    update("proposed_orientation_date", formattedDate);
    setShowDatePicker(false);
  };

  const clearDate = () => {
    update("proposed_orientation_date", "");
  };

  const adjustMonth = (amount: number) => {
    const newDate = new Date(tempDate);
    newDate.setMonth(newDate.getMonth() + amount);
    setTempDate(newDate);
  };

  const adjustYear = (amount: number) => {
    const newDate = new Date(tempDate);
    newDate.setFullYear(newDate.getFullYear() + amount);
    setTempDate(newDate);
  };

  const selectDay = (day: number) => {
    const newDate = new Date(tempDate);
    newDate.setDate(day);
    setTempDate(newDate);
  };

  const formatDateDisplay = (dateString: string) => {
    if (!dateString) return "Select date";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const validate = (): string | null => {
    if (!formData.title.trim()) return "Project title is required.";
    if (
      !formData.total_treegrowers_will_participate.trim() ||
      isNaN(Number(formData.total_treegrowers_will_participate)) ||
      Number(formData.total_treegrowers_will_participate) < 2
    ) {
      return "Minimum of 2 tree growers required.";
    }
    if (!formData.maintenance_plan)
      return "Maintenance plan document is required.";

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
      fd.append(
        "total_treegrowers_will_participate",
        formData.total_treegrowers_will_participate.trim(),
      );

      if (formData.maintenance_plan) {
        fd.append("maintenance_plan", formData.maintenance_plan as any);
      }

      if (siteId) {
        fd.append("proposed_site_id", siteId);
      }

      if (formData.proposed_orientation_date.trim()) {
        fd.append(
          "proposed_orientation_date",
          formData.proposed_orientation_date.trim(),
        );
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
        throw new Error(
          responseData.error ?? "Failed to submit re-application.",
        );
      }

      Alert.alert(
        "Success 🌱",
        "Your new tree planting application has been submitted and is now under evaluation!",
        [
          {
            text: "View Application",
            onPress: () => router.replace("/tree_growers/application"),
          },
        ],
      );
    } catch (err: any) {
      console.error("Reapply error:", err);
      Alert.alert(
        "Submission Failed",
        err.message || "Network error. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  // ✅ Generate Calendar Days
  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(tempDate);
    const firstDay = getFirstDayOfMonth(tempDate);
    const days = [];

    // Empty slots for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(<View key={`empty-${i}`} style={calendarStyles.dayEmpty} />);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const isSelected = tempDate.getDate() === day;
      const isToday =
        new Date().toDateString() ===
        new Date(
          tempDate.getFullYear(),
          tempDate.getMonth(),
          day,
        ).toDateString();

      days.push(
        <TouchableOpacity
          key={day}
          style={[
            calendarStyles.day,
            isSelected && calendarStyles.daySelected,
            isToday && !isSelected && calendarStyles.dayToday,
          ]}
          onPress={() => selectDay(day)}
        >
          <Text
            style={[
              calendarStyles.dayText,
              isSelected && calendarStyles.dayTextSelected,
            ]}
          >
            {day}
          </Text>
        </TouchableOpacity>,
      );
    }

    return days;
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* ✅ Header with Safe Area Insets */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color="#0F4A2F" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Application</Text>
        <View style={{ width: 38 }} />
      </View>

      {/* ✅ Custom Date Picker Modal */}
      <Modal
        visible={showDatePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <View style={modalStyles.overlay}>
          <View style={modalStyles.container}>
            <View style={modalStyles.header}>
              <Text style={modalStyles.title}>Select Date</Text>
              <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Month/Year Navigation */}
            <View style={modalStyles.navigation}>
              <TouchableOpacity
                onPress={() => adjustYear(-1)}
                style={modalStyles.navButton}
              >
                <Ionicons name="play-skip-back" size={16} color="#0F4A2F" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => adjustMonth(-1)}
                style={modalStyles.navButton}
              >
                <Ionicons name="chevron-back" size={20} color="#0F4A2F" />
              </TouchableOpacity>

              <Text style={modalStyles.monthYear}>
                {tempDate.toLocaleDateString("en-PH", {
                  month: "long",
                  year: "numeric",
                })}
              </Text>

              <TouchableOpacity
                onPress={() => adjustMonth(1)}
                style={modalStyles.navButton}
              >
                <Ionicons name="chevron-forward" size={20} color="#0F4A2F" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => adjustYear(1)}
                style={modalStyles.navButton}
              >
                <Ionicons name="play-skip-forward" size={16} color="#0F4A2F" />
              </TouchableOpacity>
            </View>

            {/* Day Labels */}
            <View style={modalStyles.dayLabels}>
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <Text key={day} style={modalStyles.dayLabel}>
                  {day}
                </Text>
              ))}
            </View>

            {/* Calendar Grid */}
            <View style={modalStyles.calendarGrid}>{renderCalendar()}</View>

            {/* Action Buttons */}
            <View style={modalStyles.actions}>
              <TouchableOpacity
                style={modalStyles.cancelButton}
                onPress={() => setShowDatePicker(false)}
              >
                <Text style={modalStyles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={modalStyles.confirmButton}
                onPress={confirmDate}
              >
                <Text style={modalStyles.confirmText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ✅ Selected Site Info Box */}
        {siteName && (
          <View style={styles.siteInfoBox}>
            <Ionicons name="location" size={20} color="#0F4A2F" />
            <View style={{ flex: 1 }}>
              <Text style={styles.siteInfoLabel}>Applying for Site</Text>
              <Text style={styles.siteInfoName}>{siteName}</Text>
            </View>
          </View>
        )}

        <View style={styles.infoBox}>
          <Ionicons
            name="information-circle-outline"
            size={20}
            color="#0F4A2F"
          />
          <Text style={styles.infoText}>
            Your existing account and group details will be reused. Please
            provide the details for your{" "}
            <Text style={styles.infoBold}>new</Text> tree planting project.
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

        <View style={styles.formGroup}>
          <Text style={styles.label}>Total Tree Growers *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., 25 (Minimum 2)"
            keyboardType="numeric"
            value={formData.total_treegrowers_will_participate}
            onChangeText={(v) =>
              update("total_treegrowers_will_participate", v)
            }
            placeholderTextColor="#9CA3AF"
          />
        </View>

        {/* ✅ Custom Date Picker Field */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Proposed Orientation Date (Optional)</Text>
          <TouchableOpacity
            style={styles.datePickerBtn}
            onPress={openDatePicker}
            activeOpacity={0.7}
          >
            <View
              style={[styles.uploadIconWrap, { backgroundColor: "#E0E7FF" }]}
            >
              <Ionicons name="calendar-outline" size={22} color="#3730A3" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.datePickerTitle}>
                {formData.proposed_orientation_date
                  ? formatDateDisplay(formData.proposed_orientation_date)
                  : "Select a date"}
              </Text>
              <Text style={styles.datePickerSub}>
                {formData.proposed_orientation_date
                  ? "Tap to change date"
                  : "Tap to select"}
              </Text>
            </View>
            {formData.proposed_orientation_date && (
              <TouchableOpacity onPress={clearDate} style={styles.clearDateBtn}>
                <Ionicons name="close-circle" size={22} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </TouchableOpacity>
          <Text style={styles.hintText}>
            Leave blank if you have no specific date in mind.
          </Text>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Maintenance Plan Document *</Text>
          <TouchableOpacity
            style={styles.uploadBtn}
            onPress={pickDocument}
            activeOpacity={0.7}
          >
            <View
              style={[styles.uploadIconWrap, { backgroundColor: "#E8F5E9" }]}
            >
              <Ionicons
                name="document-text-outline"
                size={22}
                color="#0F4A2F"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.uploadTitle}>
                {formData.maintenance_plan
                  ? formData.maintenance_plan.name
                  : "Tap to upload Maintenance Plan"}
              </Text>
              <Text style={styles.uploadSub}>PDF, Word, or Image</Text>
            </View>
            {formData.maintenance_plan && (
              <Ionicons name="checkmark-circle" size={22} color="#0F4A2F" />
            )}
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
    paddingBottom: 16, // ✅ Padding bottom remains, top is handled dynamically
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backBtn: { padding: 8, borderRadius: 20 },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#111827" },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },

  siteInfoBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#E0E7FF",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#3730A3",
  },
  siteInfoLabel: {
    fontSize: 11,
    color: "#4338CA",
    fontWeight: "600",
    textTransform: "uppercase",
  },
  siteInfoName: { fontSize: 15, color: "#1E1B4B", fontWeight: "800" },

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
  label: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6 },
  hintText: { fontSize: 11, color: "#9CA3AF", marginTop: 4 },
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

  datePickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 14,
  },
  uploadIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
  },
  datePickerTitle: { fontSize: 14, fontWeight: "600", color: "#111827" },
  datePickerSub: { fontSize: 11, color: "#9CA3AF", marginTop: 2 },
  clearDateBtn: { padding: 4 },

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

// ✅ Calendar Styles
const calendarStyles = StyleSheet.create({
  day: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 20,
    margin: 2,
  },
  dayEmpty: {
    width: 40,
    height: 40,
    margin: 2,
  },
  daySelected: {
    backgroundColor: "#0F4A2F",
  },
  dayToday: {
    borderWidth: 1,
    borderColor: "#0F4A2F",
  },
  dayText: {
    fontSize: 14,
    color: "#111827",
  },
  dayTextSelected: {
    color: "#fff",
    fontWeight: "700",
  },
});

// ✅ Modal Styles
const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: "80%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
  },
  navigation: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  navButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
  },
  monthYear: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F4A2F",
  },
  dayLabels: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 10,
  },
  dayLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
    width: 40,
    textAlign: "center",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    marginBottom: 20,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    alignItems: "center",
  },
  cancelText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#6B7280",
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#0F4A2F",
    alignItems: "center",
  },
  confirmText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
});
