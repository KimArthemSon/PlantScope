import { useRouter, useLocalSearchParams } from "expo-router";
import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, ActivityIndicator, Switch, Image, FlatList,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import * as ImagePicker from "expo-image-picker";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/constants/url_fixed";

const API_BASE = api;

/* ---------- TYPES ---------- */

type PermitType      = "barangay_clearance" | "lgu_endorsement" | "denr_permit" | "landowner_consent" | "other";
type SecurityConcern = "none" | "npa_presence" | "land_dispute" | "theft_risk" | "other";
type Accessibility   = "vehicle_accessible" | "motorcycle_only" | "footpath_only" | "not_accessible";
type CommunitySupport = "strong_support" | "neutral" | "opposition" | "unknown";
type LandUseConflict = "none" | "agricultural_use" | "residential_encroachment" | "mining_claim" | "other";

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

/* ---------- HELPERS ---------- */

const fmt = (s: string) =>
  s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/* ---------- SCREEN ---------- */

export default function MetaDataForm() {
  const { id, areaId } = useLocalSearchParams<{ id?: string; areaId: string }>();
  const router    = useRouter();
  const insets    = useSafeAreaInsets();
  const isEditMode = !!id;

  const [loading,     setLoading]     = useState(isEditMode);
  const [saving,      setSaving]      = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  /* Form state */
  const [assessmentDate, setAssessmentDate] = useState(new Date().toISOString().split("T")[0]);
  const [location, setLocation] = useState<{ latitude: number; longitude: number; gps_accuracy_meters?: number } | null>(null);

  const [permitsAvailable, setPermitsAvailable] = useState<PermitType[]>([]);
  const [permitNumbers,    setPermitNumbers]    = useState<Record<string, string>>({});

  const [securityConcerns, setSecurityConcerns] = useState<SecurityConcern[]>(["none"]);
  const [securityNotes,    setSecurityNotes]    = useState("");

  const [generalSafetyAssessment, setGeneralSafetyAssessment] =
    useState<"safe" | "slightly_unsafe" | "moderate_risk" | "high_risk">("safe");
  const [accessibility, setAccessibility] = useState<Accessibility>("vehicle_accessible");

  const [communitySupport,  setCommunitySupport]  = useState<CommunitySupport>("strong_support");
  const [landUseConflicts,  setLandUseConflicts]  = useState<LandUseConflict[]>(["none"]);
  const [conflictNotes,     setConflictNotes]     = useState("");

  const [attachedDocuments, setAttachedDocuments] = useState<
    { document_type: string; file_url: string; uploaded_at: string }[]
  >([]);
  const [existingImages, setExistingImages] = useState<ExistingImage[]>([]);
  const [localImages,    setLocalImages]    = useState<{ uri: string; caption: string }[]>([]);

  const [preAssessmentRecommendation, setPreAssessmentRecommendation] =
    useState<"proceed_to_mcda" | "requires_clarification" | "reject">("proceed_to_mcda");
  const [additionalNotes, setAdditionalNotes] = useState("");

  /* ---------- Load ---------- */
  useEffect(() => { if (isEditMode) fetchDetail(); }, []);

  const fetchDetail = async () => {
    try {
      const token = await SecureStore.getItemAsync("token");
      const res = await fetch(`${API_BASE}/api/field_assessments/${id}/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load assessment.");
      const data = await res.json();

      setIsSubmitted(data.is_submitted);
      const d = data.field_assessment_data;
      if (d) {
        setAssessmentDate(d.assessment_date?.split("T")[0] || new Date().toISOString().split("T")[0]);
        setLocation(d.location || null);
        setPermitsAvailable(d.permits_available || []);
        setPermitNumbers(d.permit_numbers || {});
        setSecurityConcerns(d.security_concerns || ["none"]);
        setSecurityNotes(d.security_notes || "");
        setGeneralSafetyAssessment(d.general_safety_assessment || "safe");
        setAccessibility(d.accessibility || "vehicle_accessible");
        setCommunitySupport(d.community_support || "strong_support");
        setLandUseConflicts(d.land_use_conflicts || ["none"]);
        setConflictNotes(d.conflict_notes || "");
        setAttachedDocuments(d.attached_documents || []);
        setPreAssessmentRecommendation(d.pre_assessment_recommendation || "proceed_to_mcda");
        setAdditionalNotes(d.additional_notes || "");
      }
      if (Array.isArray(data.images)) setExistingImages(data.images);
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Failed to load assessment.");
      router.back();
    } finally {
      setLoading(false);
    }
  };

  /* ---------- Helpers ---------- */
  const toggleItem = <T,>(arr: T[], item: T, setter: (v: T[]) => void) => {
    if (item === ("none" as unknown as T) && arr.includes(item)) {
      setter([]);
    } else if (item === ("none" as unknown as T)) {
      setter([item]);
    } else {
      const filtered = arr.filter((i) => i !== ("none" as unknown as T));
      setter(filtered.includes(item) ? filtered.filter((i) => i !== item) : [...filtered, item]);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]) {
      setLocalImages([...localImages, { uri: result.assets[0].uri, caption: "" }]);
    }
  };

  const uploadLocalImages = async (faid: number, token: string) => {
    for (const img of localImages) {
      const fd = new FormData();
      fd.append("image", { uri: img.uri, type: "image/jpeg", name: `assessment_${faid}_${Date.now()}.jpg` } as any);
      fd.append("caption", img.caption || "");
      fd.append("layer", "meta_data");
      await fetch(`${API_BASE}/api/field_assessments/${faid}/images/upload/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
    }
  };

  const deleteExistingImage = (imageId: number) => {
    Alert.alert("Delete Photo", "Remove this photo from the assessment?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          try {
            const token = await SecureStore.getItemAsync("token");
            const res = await fetch(`${API_BASE}/api/field_assessments/images/${imageId}/delete/`, {
              method: "DELETE", headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
              setExistingImages(existingImages.filter((img) => img.image_id !== imageId));
            } else {
              const err = await res.json();
              Alert.alert("Error", err.error ?? "Failed to delete photo.");
            }
          } catch (e: any) {
            Alert.alert("Error", e.message ?? "Network error.");
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

  /* ---------- Save ---------- */
  const handleSaveDraft = async () => {
    if (!assessmentDate) { Alert.alert("Missing Info", "Assessment date is required."); return; }
    setSaving(true);
    try {
      const token = await SecureStore.getItemAsync("token");
      const payload = {
        reforestation_area_id: parseInt(areaId),
        layer: "meta_data",
        assessment_date: assessmentDate,
        location,
        field_assessment_data: {
          assessment_type: "meta_data", assessment_date: assessmentDate, location,
          permits_available: permitsAvailable, permit_numbers: permitNumbers,
          security_concerns: securityConcerns, security_notes: securityNotes,
          general_safety_assessment: generalSafetyAssessment, accessibility,
          community_support: communitySupport, land_use_conflicts: landUseConflicts,
          conflict_notes: conflictNotes, attached_documents: attachedDocuments,
          pre_assessment_recommendation: preAssessmentRecommendation,
          additional_notes: additionalNotes,
        },
      };

      const url    = isEditMode ? `${API_BASE}/api/field_assessments/${id}/update/` : `${API_BASE}/api/field_assessments/create/`;
      const method = isEditMode ? "PUT" : "POST";
      const res    = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Failed to save draft."); }
      const responseData = await res.json();

      const faid = isEditMode ? parseInt(id!) : responseData.field_assessment_id;
      if (faid && localImages.length > 0) {
        await uploadLocalImages(faid, token!);
        setExistingImages([...existingImages, ...localImages.map((img, idx) => ({
          image_id: Date.now() + idx, url: img.uri,
          caption: img.caption, layer: "meta_data", created_at: new Date().toISOString(),
        }))]);
        setLocalImages([]);
      }

      Alert.alert("Saved", isEditMode ? "Draft updated." : "Draft saved. You can submit when ready.");
      if (!isEditMode) {
        router.replace({ pathname: "/feedbacks/meta_data_assessment", params: { areaId, areaName: "" } });
      }
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setSaving(false);
    }
  };

  /* ---------- Submit ---------- */
  const handleSubmit = () => {
    Alert.alert("Finalize Meta Data", "Once submitted, this assessment cannot be edited. Proceed?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Yes, Submit",
        onPress: async () => {
          setSubmitting(true);
          try {
            const token = await SecureStore.getItemAsync("token");
            await handleSaveDraft();
            const res = await fetch(`${API_BASE}/api/field_assessments/${id}/submit/`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            });
            if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Failed to submit."); }
            Alert.alert("Submitted", "Meta Data submitted to GIS Specialist!", [
              { text: "OK", onPress: () => router.back() },
            ]);
          } catch (e: any) {
            Alert.alert("Error", e.message);
          } finally {
            setSubmitting(false);
          }
        },
      },
    ]);
  };

  /* ---------- Loading ---------- */
  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#0F4A2F" />
        <Text style={styles.loadingText}>Loading assessment…</Text>
      </View>
    );
  }

  const isReadOnly = isSubmitted;
  const allImages: DisplayImage[] = [
    ...existingImages.map((img) => ({
      image_id: img.image_id,
      displayUrl: img.url ? `${API_BASE}${img.url}` : null,
      caption: img.caption, isLocal: false, isFromServer: true,
    })),
    ...localImages.map((img, idx) => ({
      image_id: `local-${idx}`, displayUrl: img.uri,
      caption: img.caption, isLocal: true, isFromServer: false,
    })),
  ];

  /* ---------- UI ---------- */
  return (
    <View style={styles.root}>

      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{isEditMode ? "Edit Meta Data" : "New Meta Data"}</Text>
          <Text style={styles.headerSub}>
            {isReadOnly ? "View only — already submitted" : "Complete all sections below"}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Submitted banner */}
      {isReadOnly && (
        <View style={styles.submittedBanner}>
          <Ionicons name="checkmark-circle" size={18} color="#15803D" />
          <Text style={styles.submittedBannerText}>
            Submitted — awaiting GIS Specialist review. This record is locked.
          </Text>
        </View>
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── 1. Meta Data Details ── */}
        <SectionCard icon="calendar-outline" title="Meta Data Details" sub="Assessment date and GPS location">
          <FieldLabel label="Assessment Date" />
          <View style={[styles.inputRow, isReadOnly && styles.inputReadonly]}>
            <MaterialCommunityIcons name="calendar-outline" size={16} color="#0F4A2F" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={assessmentDate}
              onChangeText={setAssessmentDate}
              editable={!isReadOnly}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <FieldLabel label="GPS Location" hint="Leave blank — GIS Specialist can assign coordinates later." />
          <View style={[styles.inputRow, styles.inputReadonly]}>
            <Ionicons name="location-outline" size={16} color="#9CA3AF" style={styles.inputIcon} />
            <Text style={styles.readonlyText}>
              {location ? `${location.latitude}, ${location.longitude}` : "Not set"}
            </Text>
          </View>
        </SectionCard>

        {/* ── 2. Permits & Clearances ── */}
        <SectionCard icon="file-document-outline" title="Permits & Clearances" sub="Select all that are available">
          {(["barangay_clearance", "lgu_endorsement", "denr_permit", "landowner_consent", "other"] as PermitType[]).map((p) => (
            <ToggleRow
              key={p}
              label={fmt(p)}
              value={permitsAvailable.includes(p)}
              onToggle={() => !isReadOnly && toggleItem(permitsAvailable, p, setPermitsAvailable)}
              disabled={isReadOnly}
            />
          ))}

          {permitsAvailable.length > 0 && (
            <>
              <FieldLabel label="Permit Numbers" />
              {permitsAvailable.map((p) => (
                <View key={p} style={styles.inputRow}>
                  <MaterialCommunityIcons name="pound" size={16} color="#0F4A2F" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder={`${fmt(p)} number`}
                    placeholderTextColor="#9CA3AF"
                    value={permitNumbers[p] || ""}
                    onChangeText={(v) => setPermitNumbers({ ...permitNumbers, [p]: v })}
                    editable={!isReadOnly}
                  />
                </View>
              ))}
            </>
          )}
        </SectionCard>

        {/* ── 3. Security & Safety ── */}
        <SectionCard icon="shield-alert-outline" title="Security & Safety" sub="Security concerns and site access">
          <FieldLabel label="Security Concerns" />
          {(["none", "npa_presence", "land_dispute", "theft_risk", "other"] as SecurityConcern[]).map((s) => (
            <ToggleRow
              key={s}
              label={fmt(s)}
              value={securityConcerns.includes(s)}
              onToggle={() => !isReadOnly && toggleItem(securityConcerns, s, setSecurityConcerns)}
              disabled={isReadOnly}
            />
          ))}

          {!securityConcerns.includes("none") && (
            <>
              <FieldLabel label="Security Notes" />
              <TextInput
                style={[styles.textArea, isReadOnly && styles.inputReadonly]}
                placeholder="Describe security concerns…"
                placeholderTextColor="#9CA3AF"
                value={securityNotes}
                onChangeText={setSecurityNotes}
                multiline
                editable={!isReadOnly}
              />
            </>
          )}

          <FieldLabel label="General Safety Assessment" />
          <ChipGroup
            options={["safe", "slightly_unsafe", "moderate_risk", "high_risk"]}
            value={generalSafetyAssessment}
            onSelect={(v) => !isReadOnly && setGeneralSafetyAssessment(v as any)}
            chipColor={(v) =>
              v === "safe" ? "#16A34A"
                : v === "slightly_unsafe" ? "#F59E0B"
                  : v === "moderate_risk" ? "#EF4444"
                    : "#7F1D1D"
            }
          />

          <FieldLabel label="Accessibility" />
          <ChipGroup
            options={["vehicle_accessible", "motorcycle_only", "footpath_only", "not_accessible"]}
            value={accessibility}
            onSelect={(v) => !isReadOnly && setAccessibility(v as any)}
          />
        </SectionCard>

        {/* ── 4. Community & Land Use ── */}
        <SectionCard icon="account-group-outline" title="Community & Land Use" sub="Support level and land conflicts">
          <FieldLabel label="Community Support" />
          <ChipGroup
            options={["strong_support", "neutral", "opposition", "unknown"]}
            value={communitySupport}
            onSelect={(v) => !isReadOnly && setCommunitySupport(v as any)}
          />

          <FieldLabel label="Land Use Conflicts" />
          {(["none", "agricultural_use", "residential_encroachment", "mining_claim", "other"] as LandUseConflict[]).map((c) => (
            <ToggleRow
              key={c}
              label={fmt(c)}
              value={landUseConflicts.includes(c)}
              onToggle={() => !isReadOnly && toggleItem(landUseConflicts, c, setLandUseConflicts)}
              disabled={isReadOnly}
            />
          ))}

          {!landUseConflicts.includes("none") && (
            <>
              <FieldLabel label="Conflict Notes" />
              <TextInput
                style={[styles.textArea, isReadOnly && styles.inputReadonly]}
                placeholder="Describe land use conflicts…"
                placeholderTextColor="#9CA3AF"
                value={conflictNotes}
                onChangeText={setConflictNotes}
                multiline
                editable={!isReadOnly}
              />
            </>
          )}
        </SectionCard>

        {/* ── 5. Attachments & Photos ── */}
        <SectionCard icon="image-multiple-outline" title="Attachments & Photos" sub="Documents and field photos">
          {attachedDocuments.length > 0 && (
            <>
              <FieldLabel label="Referenced Documents" />
              {attachedDocuments.map((doc, idx) => (
                <View key={idx} style={styles.docItem}>
                  <View style={styles.docIconWrap}>
                    <MaterialCommunityIcons name="file-outline" size={16} color="#0F4A2F" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.docType}>{fmt(doc.document_type)}</Text>
                    <Text style={styles.docUrl} numberOfLines={1}>{doc.file_url}</Text>
                  </View>
                </View>
              ))}
            </>
          )}

          <FieldLabel label="Field Photos" />
          {allImages.length > 0 && (
            <FlatList
              horizontal
              data={allImages}
              keyExtractor={(item) => item.image_id.toString()}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 10, gap: 10 }}
              renderItem={({ item }: { item: DisplayImage }) => (
                <View style={styles.photoCard}>
                  <Image
                    source={{ uri: item.displayUrl || undefined }}
                    style={styles.photoThumb}
                  />
                  <Text style={styles.photoCaption} numberOfLines={1}>
                    {item.caption || "No caption"}
                  </Text>
                  {!isReadOnly && (
                    <TouchableOpacity
                      style={styles.photoDelete}
                      onPress={() =>
                        item.isLocal
                          ? removeLocalImage(localImages.findIndex((i) => i.uri === item.displayUrl))
                          : deleteExistingImage(item.image_id as number)
                      }
                    >
                      <Ionicons name="close" size={12} color="#FFFFFF" />
                    </TouchableOpacity>
                  )}
                </View>
              )}
            />
          )}

          {!isReadOnly && (
            <TouchableOpacity style={styles.addPhotoBtn} onPress={pickImage} activeOpacity={0.8}>
              <Ionicons name="camera-outline" size={18} color="#0F4A2F" />
              <Text style={styles.addPhotoBtnText}>Add Field Photo</Text>
            </TouchableOpacity>
          )}
        </SectionCard>

        {/* ── 6. Final Recommendation ── */}
        <SectionCard icon="check-decagram-outline" title="Final Recommendation" sub="Assessment outcome and additional notes">
          <ChipGroup
            options={["proceed_to_mcda", "requires_clarification", "reject"]}
            value={preAssessmentRecommendation}
            onSelect={(v) => !isReadOnly && setPreAssessmentRecommendation(v as any)}
            chipColor={(v) =>
              v === "proceed_to_mcda" ? "#16A34A"
                : v === "requires_clarification" ? "#F59E0B"
                  : "#EF4444"
            }
          />

          <FieldLabel label="Additional Notes for GIS Specialist" />
          <TextInput
            style={[styles.textArea, isReadOnly && styles.inputReadonly]}
            placeholder="Any additional context or notes…"
            placeholderTextColor="#9CA3AF"
            value={additionalNotes}
            onChangeText={setAdditionalNotes}
            multiline
            editable={!isReadOnly}
          />
        </SectionCard>

        {/* ── Action Buttons ── */}
        {!isReadOnly && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.draftBtn, saving && styles.btnDisabled]}
              onPress={handleSaveDraft}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving
                ? <ActivityIndicator size="small" color="#0F4A2F" />
                : <Ionicons name="save-outline" size={16} color="#0F4A2F" />
              }
              <Text style={styles.draftBtnText}>{saving ? "Saving…" : "Save Draft"}</Text>
            </TouchableOpacity>

            {isEditMode && (
              <TouchableOpacity
                style={[styles.submitBtn, submitting && styles.btnDisabled]}
                onPress={handleSubmit}
                disabled={submitting}
                activeOpacity={0.85}
              >
                {submitting
                  ? <ActivityIndicator size="small" color="#FFFFFF" />
                  : <Ionicons name="send-outline" size={16} color="#FFFFFF" />
                }
                <Text style={styles.submitBtnText}>
                  {submitting ? "Submitting…" : "Submit to GIS Specialist"}
                </Text>
              </TouchableOpacity>
            )}

            <View style={styles.warningBox}>
              <Ionicons name="warning-outline" size={14} color="#92400E" />
              <Text style={styles.warningText}>
                Submitting locks this record. Only the GIS Specialist can finalize the area status.
              </Text>
            </View>
          </View>
        )}

      </ScrollView>
    </View>
  );
}

/* ---------- SUB-COMPONENTS ---------- */

const SectionCard: React.FC<{ icon: string; title: string; sub: string; children: React.ReactNode }> = ({ icon, title, sub, children }) => (
  <View style={styles.card}>
    <View style={styles.cardHeader}>
      <View style={styles.cardIconWrap}>
        <MaterialCommunityIcons name={icon as any} size={17} color="#0F4A2F" />
      </View>
      <View>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardSub}>{sub}</Text>
      </View>
    </View>
    <View style={styles.cardBody}>{children}</View>
  </View>
);

const FieldLabel: React.FC<{ label: string; hint?: string }> = ({ label, hint }) => (
  <View style={{ marginTop: 12, marginBottom: 6 }}>
    <Text style={styles.fieldLabel}>{label}</Text>
    {hint && <Text style={styles.fieldHint}>{hint}</Text>}
  </View>
);

const ToggleRow: React.FC<{ label: string; value: boolean; onToggle: () => void; disabled?: boolean }> = ({
  label, value, onToggle, disabled,
}) => (
  <View style={styles.toggleRow}>
    <View style={[styles.toggleDot, { backgroundColor: value ? "#0F4A2F" : "#E5E7EB" }]} />
    <Text style={[styles.toggleLabel, value && styles.toggleLabelActive]}>{label}</Text>
    <Switch
      value={value}
      onValueChange={disabled ? () => {} : onToggle}
      disabled={disabled}
      trackColor={{ false: "#E5E7EB", true: "#BBF7D0" }}
      thumbColor={value ? "#0F4A2F" : "#9CA3AF"}
      ios_backgroundColor="#E5E7EB"
    />
  </View>
);

const ChipGroup: React.FC<{
  options: string[];
  value: string;
  onSelect: (v: string) => void;
  chipColor?: (v: string) => string;
}> = ({ options, value, onSelect, chipColor }) => (
  <View style={styles.chipGrid}>
    {options.map((opt) => {
      const active  = value === opt;
      const color   = chipColor ? chipColor(opt) : "#0F4A2F";
      return (
        <TouchableOpacity
          key={opt}
          style={[styles.chip, active && { backgroundColor: color, borderColor: color }]}
          onPress={() => onSelect(opt)}
          activeOpacity={0.75}
        >
          {active && <Ionicons name="checkmark" size={11} color="#FFFFFF" />}
          <Text style={[styles.chipText, active && styles.chipTextActive]}>{fmt(opt)}</Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

/* ---------- STYLES ---------- */

const styles = StyleSheet.create({
  root:          { flex: 1, backgroundColor: "#F4F7F5" },
  loadingScreen: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loadingText:   { color: "#6B7280", fontSize: 14 },

  /* Header */
  header: {
    backgroundColor: "#0F4A2F",
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12, paddingBottom: 14,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.12)",
    justifyContent: "center", alignItems: "center",
  },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle:  { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },
  headerSub:    { fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 1 },

  /* Submitted banner */
  submittedBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: "#BBF7D0",
  },
  submittedBannerText: { flex: 1, fontSize: 12, color: "#15803D", fontWeight: "600" },

  /* Scroll */
  scroll:   { flex: 1 },
  content:  { padding: 16, gap: 0 },

  /* Section card */
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18, marginBottom: 14,
    elevation: 2,
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: "#F3F4F6",
  },
  cardIconWrap: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: "#E6F4EC",
    justifyContent: "center", alignItems: "center",
  },
  cardTitle: { fontSize: 14, fontWeight: "700", color: "#0F2D1C" },
  cardSub:   { fontSize: 11, color: "#9CA3AF", marginTop: 1 },
  cardBody:  { padding: 14 },

  /* Field label */
  fieldLabel: { fontSize: 11, fontWeight: "700", color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.5 },
  fieldHint:  { fontSize: 11, color: "#9CA3AF", marginTop: 2, fontStyle: "italic" },

  /* Input */
  inputRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderWidth: 1, borderColor: "#E5E7EB",
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
  },
  inputIcon:     { marginRight: 8 },
  input:         { flex: 1, fontSize: 13, color: "#0F2D1C" },
  inputReadonly: { backgroundColor: "#F3F4F6" },
  readonlyText:  { flex: 1, fontSize: 13, color: "#9CA3AF" },

  textArea: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1, borderColor: "#E5E7EB",
    borderRadius: 10, padding: 12,
    fontSize: 13, color: "#0F2D1C",
    height: 80, textAlignVertical: "top",
  },

  /* Toggle row */
  toggleRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: "#F9FAFB",
  },
  toggleDot:         { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  toggleLabel:       { flex: 1, fontSize: 13, color: "#6B7280" },
  toggleLabelActive: { color: "#0F2D1C", fontWeight: "600" },

  /* Chips */
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1.5,
    backgroundColor: "#F9FAFB", borderColor: "#E5E7EB",
  },
  chipText:       { fontSize: 12, color: "#6B7280" },
  chipTextActive: { color: "#FFFFFF", fontWeight: "700" },

  /* Documents */
  docItem: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    backgroundColor: "#F0FDF4",
    borderRadius: 10, padding: 10, marginBottom: 8,
  },
  docIconWrap: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: "#E6F4EC",
    justifyContent: "center", alignItems: "center",
  },
  docType: { fontSize: 12, fontWeight: "700", color: "#0F2D1C" },
  docUrl:  { fontSize: 10, color: "#9CA3AF" },

  /* Photos */
  photoCard: { width: 110, position: "relative" },
  photoThumb: {
    width: 110, height: 82, borderRadius: 10,
    backgroundColor: "#E5E7EB", marginBottom: 4,
  },
  photoCaption: { fontSize: 10, color: "#6B7280", textAlign: "center" },
  photoDelete: {
    position: "absolute", top: 4, right: 4,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: "rgba(239,68,68,0.85)",
    justifyContent: "center", alignItems: "center",
  },
  addPhotoBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    borderWidth: 1.5, borderColor: "#0F4A2F", borderStyle: "dashed",
    borderRadius: 10, paddingVertical: 12, marginTop: 8,
  },
  addPhotoBtnText: { fontSize: 13, fontWeight: "600", color: "#0F4A2F" },

  /* Actions */
  actions: { gap: 10, marginTop: 4 },
  draftBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    borderWidth: 1.5, borderColor: "#0F4A2F",
    borderRadius: 14, paddingVertical: 14,
    backgroundColor: "#FFFFFF",
  },
  draftBtnText: { fontSize: 14, fontWeight: "700", color: "#0F4A2F" },
  submitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#0F4A2F",
    borderRadius: 14, paddingVertical: 14,
    elevation: 3,
    shadowColor: "#0F4A2F", shadowOpacity: 0.3, shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  submitBtnText: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },
  btnDisabled:   { opacity: 0.55 },

  warningBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 6,
    backgroundColor: "#FEF9C3",
    borderRadius: 10, padding: 10,
  },
  warningText: { flex: 1, fontSize: 11, color: "#92400E", lineHeight: 16 },
});
