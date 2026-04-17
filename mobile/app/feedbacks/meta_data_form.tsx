import { useRouter, useLocalSearchParams } from "expo-router";
import React, { useState, useEffect } from "react";
import {
  View,
  Text, // ✅ Ensure Text is imported
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Switch,
  Modal,
  Pressable,
  Image,
  FlatList,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import * as ImagePicker from "expo-image-picker";
import { api } from "@/constants/url_fixed";

const API_BASE = api;

// Types
type PermitType =
  | "barangay_clearance"
  | "lgu_endorsement"
  | "denr_permit"
  | "landowner_consent"
  | "other";
type SecurityConcern =
  | "none"
  | "npa_presence"
  | "land_dispute"
  | "theft_risk"
  | "other";
type Accessibility =
  | "vehicle_accessible"
  | "motorcycle_only"
  | "footpath_only"
  | "not_accessible";
type CommunitySupport = "strong_support" | "neutral" | "opposition" | "unknown";
type LandUseConflict =
  | "none"
  | "agricultural_use"
  | "residential_encroachment"
  | "mining_claim"
  | "other";

interface ExistingImage {
  image_id: number;
  url: string | null;
  caption: string;
  layer: string;
  created_at: string;
}

type DisplayImage = {
  image_id: number | string;
  displayUrl: string | null;
  caption: string;
  isLocal: boolean;
  isFromServer: boolean;
};

export default function MetaDataForm() {
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
  const [assessmentDate, setAssessmentDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
    gps_accuracy_meters?: number;
  } | null>(null);

  // Permits
  const [permitsAvailable, setPermitsAvailable] = useState<PermitType[]>([]);
  const [permitNumbers, setPermitNumbers] = useState<Record<string, string>>({});

  // Security
  const [securityConcerns, setSecurityConcerns] = useState<SecurityConcern[]>(["none"]);
  const [securityNotes, setSecurityNotes] = useState("");

  // Safety & Access
  const [generalSafetyAssessment, setGeneralSafetyAssessment] = useState<
    "safe" | "slightly_unsafe" | "moderate_risk" | "high_risk"
  >("safe");
  const [accessibility, setAccessibility] = useState<Accessibility>("vehicle_accessible");

  // Community
  const [communitySupport, setCommunitySupport] = useState<CommunitySupport>("strong_support");

  // Land Use
  const [landUseConflicts, setLandUseConflicts] = useState<LandUseConflict[]>(["none"]);
  const [conflictNotes, setConflictNotes] = useState("");

  // Documents & Images
  const [attachedDocuments, setAttachedDocuments] = useState<
    { document_type: string; file_url: string; uploaded_at: string }[]
  >([]);

  const [existingImages, setExistingImages] = useState<ExistingImage[]>([]);
  const [localImages, setLocalImages] = useState<{ uri: string; caption: string }[]>([]);

  // Final
  const [preAssessmentRecommendation, setPreAssessmentRecommendation] =
    useState<"proceed_to_mcda" | "requires_clarification" | "reject">("proceed_to_mcda");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  useEffect(() => {
    if (isEditMode) fetchDetail();
  }, []);

  const fetchDetail = async () => {
    try {
      const token = await SecureStore.getItemAsync("token");
      const res = await fetch(`${API_BASE}/api/field_assessments/${id}/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();

      setIsSubmitted(data.is_submitted);
      const faData = data.field_assessment_data;

      if (faData) {
        setAssessmentDate(
          faData.assessment_date?.split("T")[0] || new Date().toISOString().split("T")[0],
        );
        setLocation(faData.location || null);
        setPermitsAvailable(faData.permits_available || []);
        setPermitNumbers(faData.permit_numbers || {});
        setSecurityConcerns(faData.security_concerns || ["none"]);
        setSecurityNotes(faData.security_notes || "");
        setGeneralSafetyAssessment(faData.general_safety_assessment || "safe");
        setAccessibility(faData.accessibility || "vehicle_accessible");
        setCommunitySupport(faData.community_support || "strong_support");
        setLandUseConflicts(faData.land_use_conflicts || ["none"]);
        setConflictNotes(faData.conflict_notes || "");
        setAttachedDocuments(faData.attached_documents || []);
        setPreAssessmentRecommendation(faData.pre_assessment_recommendation || "proceed_to_mcda");
        setAdditionalNotes(faData.additional_notes || "");
      }

      if (data.images && Array.isArray(data.images)) {
        setExistingImages(data.images);
      }
    } catch (e: any) {
      console.error("Fetch detail error:", e);
      Alert.alert("Error", "Failed to load assessment details");
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const toggleArrayItem = <T,>(arr: T[], item: T, setter: (val: T[]) => void) => {
    if (item === "none" && arr.includes("none")) {
      setter([]);
    } else if (item === "none" && !arr.includes("none")) {
      setter(["none"]);
    } else {
      const filtered = arr.filter((i) => i !== "none");
      setter(filtered.includes(item) ? filtered.filter((i) => i !== item) : [...filtered, item]);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]) {
      setLocalImages([...localImages, { uri: result.assets[0].uri, caption: "" }]);
    }
  };

  const uploadLocalImages = async (fieldAssessmentId: number, token: string) => {
    for (const img of localImages) {
      const formData = new FormData();
      formData.append("image", {
        uri: img.uri,
        type: "image/jpeg",
        name: `assessment_${fieldAssessmentId}_${Date.now()}.jpg`,
      } as any);
      formData.append("caption", img.caption || "");
      formData.append("layer", "meta_data");

      await fetch(`${API_BASE}/api/field_assessments/${fieldAssessmentId}/images/upload/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
    }
  };

  const deleteExistingImage = async (imageId: number) => {
    Alert.alert("Delete Photo", "Remove this photo from the assessment?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const token = await SecureStore.getItemAsync("token");
            const res = await fetch(
              `${API_BASE}/api/field_assessments/images/${imageId}/delete/`,
              { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
            );
            if (res.ok) {
              setExistingImages(existingImages.filter((img) => img.image_id !== imageId));
              Alert.alert("Success", "Photo deleted");
            } else {
              const err = await res.json();
              Alert.alert("Error", err.error || "Failed to delete");
            }
          } catch (e: any) {
            Alert.alert("Error", e.message || "Network error");
          }
        },
      },
    ]);
  };

  const removeLocalImage = (index: number) => {
    const updated = [...localImages];
    updated.splice(index, 1);
    setLocalImages(updated);
  };

  const handleSaveDraft = async () => {
    if (!assessmentDate) {
      Alert.alert("Missing Info", "Assessment date is required.");
      return;
    }
    setSaving(true);
    try {
      const token = await SecureStore.getItemAsync("token");
      const payload = {
        reforestation_area_id: parseInt(areaId),
        layer: "meta_data",
        assessment_date: assessmentDate,
        location,
        field_assessment_data: {
          assessment_type: "meta_data",
          assessment_date: assessmentDate,
          location,
          permits_available: permitsAvailable,
          permit_numbers: permitNumbers,
          security_concerns: securityConcerns,
          security_notes: securityNotes,
          general_safety_assessment: generalSafetyAssessment,
          accessibility,
          community_support: communitySupport,
          land_use_conflicts: landUseConflicts,
          conflict_notes: conflictNotes,
          attached_documents: attachedDocuments,
          pre_assessment_recommendation: preAssessmentRecommendation,
          additional_notes: additionalNotes,
        },
      };

      const url = isEditMode
        ? `${API_BASE}/api/field_assessments/${id}/update/`
        : `${API_BASE}/api/field_assessments/create/`;
      const method = isEditMode ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to save draft");
      }

      const responseData = await res.json();

      const fieldAssessmentId = isEditMode ? parseInt(id!) : responseData.field_assessment_id;
      if (fieldAssessmentId && localImages.length > 0) {
        await uploadLocalImages(fieldAssessmentId, token);
        const uploadedImages: ExistingImage[] = localImages.map((img, idx) => ({
          image_id: Date.now() + idx,
          url: img.uri,
          caption: img.caption,
          layer: "meta_data",
          created_at: new Date().toISOString(),
        }));
        setExistingImages([...existingImages, ...uploadedImages]);
        setLocalImages([]);
      }

      Alert.alert("Success", isEditMode ? "Draft updated." : "Draft saved. You can submit when ready.");
      if (!isEditMode) {
        router.replace({
          pathname: "/feedbacks/meta_data_assessment",
          params: { areaId, areaName: "" },
        });
      }
    } catch (e: any) {
      console.error("Save draft error:", e);
      Alert.alert("Error", e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitAssessment = async () => {
    Alert.alert(
      "Finalize Meta Data",
      "Once submitted, this assessment cannot be edited. Proceed?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, Submit",
          onPress: async () => {
            setSubmitting(true);
            try {
              const token = await SecureStore.getItemAsync("token");
              await handleSaveDraft();
              const res = await fetch(
                `${API_BASE}/api/field_assessments/${id}/submit/`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                },
              );
              if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to submit");
              }
              Alert.alert("Success", "Meta Data submitted to GIS Specialist!", [
                { text: "OK", onPress: () => router.back() },
              ]);
            } catch (e: any) {
              console.error("Submit error:", e);
              Alert.alert("Error", e.message);
            } finally {
              setSubmitting(false);
            }
          },
        },
      ],
    );
  };

  if (loading) return <ActivityIndicator size="large" style={{ marginTop: 50 }} />;
  const isReadOnly = isSubmitted;

  const allImages: DisplayImage[] = [
    ...existingImages.map((img) => ({
      image_id: img.image_id,
      displayUrl: img.url ? `${API_BASE}${img.url}` : null,
      caption: img.caption,
      isLocal: false,
      isFromServer: true,
    })),
    ...localImages.map((img, idx) => ({
      image_id: `local-${idx}`,
      displayUrl: img.uri,
      caption: img.caption,
      isLocal: true,
      isFromServer: false,
    })),
  ];

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.sectionTitle}>📅 Meta Data Details</Text>
      
      <Text style={styles.label}>Assessment Date</Text>
      <TextInput
        style={[styles.input, isReadOnly && styles.readOnly]}
        value={assessmentDate}
        onChangeText={setAssessmentDate}
        editable={!isReadOnly}
      />

      <Text style={styles.label}>GPS Location (Optional)</Text>
      <TextInput
        style={[styles.input, isReadOnly && styles.readOnly]}
        placeholder="Latitude, Longitude"
        value={location ? `${location.latitude}, ${location.longitude}` : ""}
        editable={false}
      />
      {/* ✅ Fixed: hint text properly wrapped */}
      <Text style={styles.hint}>
        Leave blank if collecting data during barangay meeting. GIS Specialist can assign coordinates later.
      </Text>

      <Text style={styles.sectionTitle}>📄 Permits & Clearances</Text>
      {(
        ["barangay_clearance", "lgu_endorsement", "denr_permit", "landowner_consent", "other"] as PermitType[]
      ).map((p) => (
        <View key={p} style={styles.row}>
          {/* ✅ Fixed: dynamic text wrapped in Text */}
          <Text>{p.replace("_", " ").toUpperCase()}</Text>
          <Switch
            value={permitsAvailable.includes(p)}
            onValueChange={isReadOnly ? undefined : () => toggleArrayItem(permitsAvailable, p, setPermitsAvailable)}
            disabled={isReadOnly}
          />
        </View>
      ))}
      {permitsAvailable.length > 0 && permitsAvailable[0] !== "none" && (
        <>
          <Text style={styles.label}>Permit Numbers</Text>
          {permitsAvailable.map((p) => (
            <TextInput
              key={p}
              style={[styles.input, isReadOnly && styles.readOnly]}
              placeholder={`${p.replace("_", " ")} Number`}
              value={permitNumbers[p] || ""}
              onChangeText={(val) => setPermitNumbers({ ...permitNumbers, [p]: val })}
              editable={!isReadOnly}
            />
          ))}
        </>
      )}

      <Text style={styles.sectionTitle}>🔒 Security & Safety</Text>
      {(
        ["none", "npa_presence", "land_dispute", "theft_risk", "other"] as SecurityConcern[]
      ).map((s) => (
        <View key={s} style={styles.row}>
          {/* ✅ Fixed: dynamic text wrapped in Text */}
          <Text>{s.replace("_", " ").toUpperCase()}</Text>
          <Switch
            value={securityConcerns.includes(s)}
            onValueChange={isReadOnly ? undefined : () => toggleArrayItem(securityConcerns, s, setSecurityConcerns)}
            disabled={isReadOnly}
          />
        </View>
      ))}
      {/* ✅ Fixed: conditional text area with proper Text wrapper for label */}
      {!securityConcerns.includes("none") && (
        <>
          <Text style={styles.label}>Security Notes</Text>
          <TextInput
            style={[styles.input, styles.textArea, isReadOnly && styles.readOnly]}
            placeholder="Security notes..."
            value={securityNotes}
            onChangeText={setSecurityNotes}
            multiline
            editable={!isReadOnly}
          />
        </>
      )}

      <Text style={styles.label}>General Safety Assessment</Text>
      <View style={styles.pickerRow}>
        {(["safe", "slightly_unsafe", "moderate_risk", "high_risk"] as const).map((opt) => (
          <TouchableOpacity
            key={opt}
            style={[styles.pickerChip, generalSafetyAssessment === opt && styles.pickerChipActive]}
            onPress={isReadOnly ? undefined : () => setGeneralSafetyAssessment(opt)}
          >
            {/* ✅ Fixed: dynamic text properly wrapped */}
            <Text style={[styles.pickerChipText, generalSafetyAssessment === opt && styles.pickerChipTextActive]}>
              {opt.replace("_", " ")}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Accessibility</Text>
      <View style={styles.pickerRow}>
        {(["vehicle_accessible", "motorcycle_only", "footpath_only", "not_accessible"] as const).map((opt) => (
          <TouchableOpacity
            key={opt}
            style={[styles.pickerChip, accessibility === opt && styles.pickerChipActive]}
            onPress={isReadOnly ? undefined : () => setAccessibility(opt)}
          >
            {/* ✅ Fixed: dynamic text properly wrapped */}
            <Text style={[styles.pickerChipText, accessibility === opt && styles.pickerChipTextActive]}>
              {opt.replace("_", " ")}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionTitle}>👥 Community & Land Use</Text>
      <Text style={styles.label}>Community Support</Text>
      <View style={styles.pickerRow}>
        {(["strong_support", "neutral", "opposition", "unknown"] as const).map((opt) => (
          <TouchableOpacity
            key={opt}
            style={[styles.pickerChip, communitySupport === opt && styles.pickerChipActive]}
            onPress={isReadOnly ? undefined : () => setCommunitySupport(opt)}
          >
            {/* ✅ Fixed: dynamic text properly wrapped */}
            <Text style={[styles.pickerChipText, communitySupport === opt && styles.pickerChipTextActive]}>
              {opt.replace("_", " ")}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {(
        ["none", "agricultural_use", "residential_encroachment", "mining_claim", "other"] as LandUseConflict[]
      ).map((c) => (
        <View key={c} style={styles.row}>
          {/* ✅ Fixed: dynamic text wrapped in Text */}
          <Text>{c.replace("_", " ").toUpperCase()}</Text>
          <Switch
            value={landUseConflicts.includes(c)}
            onValueChange={isReadOnly ? undefined : () => toggleArrayItem(landUseConflicts, c, setLandUseConflicts)}
            disabled={isReadOnly}
          />
        </View>
      ))}
      {/* ✅ Fixed: conditional text area with proper Text wrapper */}
      {!landUseConflicts.includes("none") && (
        <>
          <Text style={styles.label}>Conflict Notes</Text>
          <TextInput
            style={[styles.input, styles.textArea, isReadOnly && styles.readOnly]}
            placeholder="Conflict notes..."
            value={conflictNotes}
            onChangeText={setConflictNotes}
            multiline
            editable={!isReadOnly}
          />
        </>
      )}

      <Text style={styles.sectionTitle}>📎 Attachments</Text>
      {/* ✅ Fixed: hint text properly wrapped */}
      <Text style={styles.hint}>
        Attached documents from permits can be referenced here. Upload field photos below.
      </Text>
      {attachedDocuments.map((doc, idx) => (
        <View key={idx} style={styles.docItem}>
          <Text style={styles.docType}>{doc.document_type}</Text>
          <Text style={styles.docUrl} numberOfLines={1}>
            {doc.file_url}
          </Text>
        </View>
      ))}

      {/* Image Gallery */}
      <Text style={styles.label}>Field Photos</Text>
      {allImages.length > 0 && (
        <FlatList
          horizontal
          data={allImages}
          keyExtractor={(item) => item.image_id.toString()}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 10 }}
          renderItem={({ item }: { item: DisplayImage }) => (
            <View style={styles.imageCard}>
              <Image source={{ uri: item.displayUrl || undefined }} style={styles.imageThumb} />
              {/* ✅ Fixed: conditional caption rendering - both branches return Text */}
              {item.caption ? (
                <Text style={styles.imageCaption} numberOfLines={1}>{item.caption}</Text>
              ) : (
                <Text style={styles.imageCaptionEmpty}>Add caption...</Text>
              )}
              {!isReadOnly && (
                <TouchableOpacity
                  style={styles.deleteImageBtn}
                  onPress={() =>
                    item.isLocal
                      ? removeLocalImage(localImages.findIndex((i) => i.uri === item.displayUrl))
                      : deleteExistingImage(item.image_id as number)
                  }
                >
                  <Text style={styles.deleteImageText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        />
      )}

      <TouchableOpacity style={styles.uploadBtn} onPress={isReadOnly ? undefined : pickImage} disabled={isReadOnly}>
        <Text style={styles.uploadBtnText}>📷 Add Field Photo</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>✅ Final Recommendation</Text>
      <View style={styles.pickerRow}>
        {(["proceed_to_mcda", "requires_clarification", "reject"] as const).map((opt) => (
          <TouchableOpacity
            key={opt}
            style={[styles.pickerChip, preAssessmentRecommendation === opt && styles.pickerChipActive]}
            onPress={isReadOnly ? undefined : () => setPreAssessmentRecommendation(opt)}
          >
            {/* ✅ Fixed: dynamic text properly wrapped */}
            <Text style={[styles.pickerChipText, preAssessmentRecommendation === opt && styles.pickerChipTextActive]}>
              {opt.replace("_", " ")}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <TextInput
        style={[styles.input, styles.textArea, isReadOnly && styles.readOnly]}
        placeholder="Additional notes for GIS Specialist..."
        value={additionalNotes}
        onChangeText={setAdditionalNotes}
        multiline
        editable={!isReadOnly}
      />

      {/* ACTION BUTTONS */}
      <View style={styles.buttonContainer}>
        {isSubmitted ? (
          <View style={styles.submittedBadge}>
            <Text style={styles.submittedText}>✓ META DATA SUBMITTED</Text>
            <Text style={styles.submittedSubtext}>
              Awaiting GIS Specialist review. This record is locked.
            </Text>
          </View>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.btnDisabled]}
              onPress={handleSaveDraft}
              disabled={saving}
            >
              <Text style={styles.saveBtnText}>{saving ? "Saving..." : "Save Draft"}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitBtn, submitting && styles.btnDisabled]}
              onPress={handleSubmitAssessment}
              disabled={submitting}
            >
              <Text style={styles.submitBtnText}>
                {submitting ? "Submitting..." : "Submit to GIS Specialist"}
              </Text>
            </TouchableOpacity>
            {/* ✅ Fixed: warning text properly wrapped */}
            <Text style={styles.warningText}>
              ⚠️ Submitting locks this record. Only the GIS Specialist can finalize the area status.
            </Text>
          </>
        )}
      </View>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#fff" },
  sectionTitle: {
    fontWeight: "bold",
    fontSize: 16,
    color: "#5b21b6",
    marginTop: 20,
    marginBottom: 10,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecef",
  },
  label: { fontWeight: "600", marginBottom: 6, marginTop: 12, color: "#333" },
  hint: { fontSize: 12, color: "#666", fontStyle: "italic", marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#f9f9f9",
    fontSize: 15,
  },
  readOnly: { backgroundColor: "#e9ecef", color: "#6c757d", borderColor: "#dee2e6" },
  textArea: { height: 80, textAlignVertical: "top" },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  pickerRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pickerChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#e9ecef",
    borderWidth: 1,
    borderColor: "#ccc",
  },
  pickerChipActive: { backgroundColor: "#7c3aed", borderColor: "#7c3aed" },
  pickerChipText: { fontSize: 13, color: "#333" },
  pickerChipTextActive: { color: "#fff", fontWeight: "600" },
  docItem: {
    padding: 10,
    backgroundColor: "#f8f9fa",
    borderRadius: 6,
    marginBottom: 6,
    borderLeftWidth: 3,
    borderLeftColor: "#7c3aed",
  },
  docType: { fontWeight: "600", fontSize: 13 },
  docUrl: { fontSize: 11, color: "#666" },
  imageCard: { marginRight: 12, width: 120 },
  imageThumb: {
    width: 120,
    height: 90,
    borderRadius: 8,
    marginBottom: 4,
    backgroundColor: "#f0f0f0",
  },
  imageCaption: { fontSize: 11, color: "#333", textAlign: "center" },
  imageCaptionEmpty: { fontSize: 11, color: "#999", textAlign: "center", fontStyle: "italic" },
  deleteImageBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "rgba(255, 0, 0, 0.8)",
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteImageText: { color: "#fff", fontSize: 14, fontWeight: "bold", lineHeight: 18 },
  uploadBtn: {
    backgroundColor: "#e9ecef",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 10,
  },
  uploadBtnText: { color: "#7c3aed", fontWeight: "600" },
  buttonContainer: { marginTop: 24, gap: 12 },
  saveBtn: { backgroundColor: "#6c757d", padding: 15, borderRadius: 8, alignItems: "center" },
  saveBtnText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  submitBtn: {
    backgroundColor: "#7c3aed",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    shadowColor: "#7c3aed",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  submitBtnText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  btnDisabled: { opacity: 0.6 },
  warningText: { textAlign: "center", color: "#856404", fontSize: 12, marginTop: 5, fontStyle: "italic" },
  submittedBadge: {
    backgroundColor: "#f5f3ff",
    borderColor: "#c4b5fd",
    borderWidth: 1,
    borderRadius: 8,
    padding: 20,
    alignItems: "center",
  },
  submittedText: { color: "#5b21b6", fontWeight: "bold", fontSize: 18, marginBottom: 5 },
  submittedSubtext: { color: "#6d28d9", fontSize: 14, textAlign: "center" },
});