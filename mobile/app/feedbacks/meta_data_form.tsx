import { useRouter, useLocalSearchParams } from "expo-router";
import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, ActivityIndicator, Image, FlatList,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/constants/url_fixed";

const API_BASE = api;

/* ---------- STRICT LAYER CODES ---------- */
const DOC_LAYER_CODES = {
  land_title: "meta_land_title",
  tax_decl: "meta_tax_decl",
  other_doc: "meta_other_doc",
};

/* ---------- TYPES ---------- */
type SecurityConcern =
  | "Armed Threat / Violence"
  | "Hostile Person on Site"
  | "Illegal Activity Observed"
  | "Community Resistance"
  | "Land Conflict"
  | "Other";

type AccessibilityType = "Road" | "Trail" | "None" | "Other";
type LandClassType =
  | "Alienable and Disposable"
  | "Forestland"
  | "Timberland"
  | "Protected Area"
  | "Unclassified / Unknown";

interface LocalDocImage {
  id: string;
  type: keyof typeof DOC_LAYER_CODES;
  uri: string;
  note: string;
}

/* ---------- SCREEN ---------- */
export default function MetaDataForm() {
  const { id, areaId } = useLocalSearchParams<{ id?: string; areaId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isEditMode = !!id;

  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  /* Form State */
  const [assessmentDate, setAssessmentDate] = useState(new Date().toISOString().split("T")[0]);
  const [location, setLocation] = useState<any>(null);

  // Legal Documents
  const [landTitleNote, setLandTitleNote] = useState("");
  const [landTitlePhoto, setLandTitlePhoto] = useState<string | null>(null);
  const [taxDeclNote, setTaxDeclNote] = useState("");
  const [taxDeclPhoto, setTaxDeclPhoto] = useState<string | null>(null);
  const [landClassType, setLandClassType] = useState<LandClassType>("Unclassified / Unknown");
  const [landClassNote, setLandClassNote] = useState("");
  const [otherDocs, setOtherDocs] = useState<{ photo_url: string | null; note: string }[]>([]);

  // Security Concerns
  const [securitySelected, setSecuritySelected] = useState<SecurityConcern[]>([]);
  const [securityNote, setSecurityNote] = useState("");

  // Accessibility
  const [vehicleAccess, setVehicleAccess] = useState<AccessibilityType>("Road");
  const [accessNotes, setAccessNotes] = useState("");

  // Image tracking for upload
  const [localImages, setLocalImages] = useState<LocalDocImage[]>([]);
  const [existingImages, setExistingImages] = useState<any[]>([]);

  /* ---------- Load ---------- */
  useEffect(() => {
    if (isEditMode) fetchDetail();
  }, []);

  const fetchDetail = async () => {
    try {
      const token = await SecureStore.getItemAsync("token");
      const res = await fetch(`${API_BASE}/api/field_assessments/${id}/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load assessment.");
      const data = await res.json();

      setIsSubmitted(data.is_submitted);
      const meta = data.field_assessment_data?.meta_data || {};

      setAssessmentDate(data.assessment_date?.split("T")[0] || new Date().toISOString().split("T")[0]);
      setLocation(data.location || null);

      // Legal Docs
      setLandTitleNote(meta.legal_documents?.land_title?.note || "");
      setLandTitlePhoto(meta.legal_documents?.land_title?.photo_url || null);
      setTaxDeclNote(meta.legal_documents?.tax_declaration?.note || "");
      setTaxDeclPhoto(meta.legal_documents?.tax_declaration?.photo_url || null);
      setLandClassType(meta.legal_documents?.land_classification?.type || "Unclassified / Unknown");
      setLandClassNote(meta.legal_documents?.land_classification?.inspector_notes || "");
      setOtherDocs(meta.legal_documents?.other_documents || []);

      // Security
      setSecuritySelected(meta.security_concerns?.selected || []);
      setSecurityNote(meta.security_concerns?.note || "");

      // Accessibility
      setVehicleAccess(meta.accessibility?.vehicle_access || "Road");
      setAccessNotes(meta.accessibility?.notes || "");

      if (Array.isArray(data.images)) setExistingImages(data.images);
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Failed to load assessment.");
      router.back();
    } finally {
      setLoading(false);
    }
  };

  /* ---------- Image Helpers ---------- */
  const pickDocumentImage = async (docType: keyof typeof DOC_LAYER_CODES, existingNote?: string) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]) {
      setLocalImages([
        ...localImages,
        { id: `local-${Date.now()}`, type: docType, uri: result.assets[0].uri, note: existingNote || "" },
      ]);
    }
  };

  const uploadPendingImages = async (faid: number, token: string) => {
    if (localImages.length === 0) return;
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    
    for (const img of localImages) {
      const fd = new FormData();
      fd.append("image", { uri: img.uri, type: "image/jpeg", name: `meta_${Date.now()}.jpg` } as any);
      fd.append("layer", DOC_LAYER_CODES[img.type]);
      fd.append("latitude", loc.coords.latitude.toString());
      fd.append("longitude", loc.coords.longitude.toString());
      fd.append("description", img.note || `${img.type.replace("_", " ")} photo`);

      await fetch(`${API_BASE}/api/field_assessments/${faid}/images/upload/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
    }
  };

  const deleteExistingImage = (imageId: number) => {
    Alert.alert("Delete Photo", "Remove this photo?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          try {
            const token = await SecureStore.getItemAsync("token");
            const res = await fetch(`${API_BASE}/api/field_assessments/images/${imageId}/delete/`, {
              method: "DELETE", headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) setExistingImages(existingImages.filter((i) => i.image_id !== imageId));
            else Alert.alert("Error", "Failed to delete.");
          } catch { Alert.alert("Error", "Network error."); }
        },
      },
    ]);
  };

  const removeLocalImage = (id: string) => {
    setLocalImages(localImages.filter((i) => i.id !== id));
  };

  /* ---------- Security Toggle ---------- */
  const toggleSecurity = (item: SecurityConcern) => {
    if (item === "Other" && securitySelected.includes("Other")) {
      setSecuritySelected(securitySelected.filter((s) => s !== "Other"));
    } else if (item === "Other") {
      setSecuritySelected([...securitySelected, "Other"]);
    } else {
      setSecuritySelected(
        securitySelected.includes(item)
          ? securitySelected.filter((s) => s !== item)
          : [...securitySelected, item]
      );
    }
  };

  /* ---------- Save ---------- */
  const handleSaveDraft = async (): Promise<number | null> => {
    if (!assessmentDate) { Alert.alert("Missing Info", "Assessment date is required."); return null; }
    setSaving(true);
    try {
      const token = await SecureStore.getItemAsync("token");
      
      // ✅ EXACT JSON STRUCTURE MATCH - NO 'layer' FIELD
      const payload = {
        reforestation_area_id: parseInt(areaId),
        assessment_date: assessmentDate,
        location,
        field_assessment_data: {
          meta_data: {
            legal_documents: {
              land_title: { photo_url: landTitlePhoto, note: landTitleNote },
              tax_declaration: { photo_url: taxDeclPhoto, note: taxDeclNote },
              land_classification: { type: landClassType, inspector_notes: landClassNote },
              other_documents: otherDocs,
            },
            security_concerns: { selected: securitySelected, note: securityNote },
            accessibility: { vehicle_access: vehicleAccess, notes: accessNotes },
          },
        },
      };

      const url = isEditMode ? `${API_BASE}/api/field_assessments/${id}/update/` : `${API_BASE}/api/field_assessments/create/`;
      const res = await fetch(url, {
        method: isEditMode ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Failed to save."); }
      const responseData = await res.json();
      const faid = isEditMode ? parseInt(id!) : responseData.field_assessment_id;

      // Upload images in background
      if (faid && localImages.length > 0) {
        await uploadPendingImages(faid, token!);
        setLocalImages([]);
      }

      Alert.alert("Saved", isEditMode ? "Draft updated." : "Draft saved.");
      return faid;
    } catch (e: any) {
      Alert.alert("Error", e.message);
      return null;
    } finally {
      setSaving(false);
    }
  };

  /* ---------- Submit ---------- */
  const handleSubmit = async () => {
    const savedId = await handleSaveDraft();
    if (!savedId) return;

    Alert.alert("Finalize Meta Data", "Once submitted, this cannot be edited. Proceed?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Yes, Submit",
        onPress: async () => {
          setSubmitting(true);
          try {
            const token = await SecureStore.getItemAsync("token");
            const res = await fetch(`${API_BASE}/api/field_assessments/${savedId}/submit/`, {
              method: "POST", headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Failed to submit."); }
            Alert.alert("Submitted", "Meta Data submitted to GIS Specialist!", [{ text: "OK", onPress: () => router.back() }]);
          } catch (e: any) { Alert.alert("Error", e.message); }
          finally { setSubmitting(false); }
        },
      },
    ]);
  };

  if (loading) {
    return <View style={styles.loadingScreen}><ActivityIndicator size="large" color="#0F4A2F" /><Text style={styles.loadingText}>Loading…</Text></View>;
  }

  const isReadOnly = isSubmitted;
  const allImages = [
    ...existingImages.map((img) => ({ id: img.image_id, url: img.url, caption: img.description || img.caption, isLocal: false })),
    ...localImages.map((img) => ({ id: img.id, url: img.uri, caption: img.note || "Untitled", isLocal: true })),
  ];

  /* ---------- UI ---------- */
  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Ionicons name="chevron-back" size={22} color="#FFFFFF" /></TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{isEditMode ? "Edit Meta Data" : "New Meta Data"}</Text>
          <Text style={styles.headerSub}>{isReadOnly ? "View only" : "Complete all sections"}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {isReadOnly && (
        <View style={styles.submittedBanner}>
          <Ionicons name="checkmark-circle" size={18} color="#15803D" />
          <Text style={styles.submittedBannerText}>Submitted — awaiting review. Record locked.</Text>
        </View>
      )}

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]} keyboardShouldPersistTaps="handled">
        
        {/* 1. Legal Documents */}
        <SectionCard icon="file-document-outline" title="Legal Documents" sub="Upload photos & add notes">
          <DocRow label="Land Title" note={landTitleNote} setNote={setLandTitleNote} photo={landTitlePhoto} 
            onPick={() => pickDocumentImage("land_title")} isReadOnly={isReadOnly} />
          
          <DocRow label="Tax Declaration" note={taxDeclNote} setNote={setTaxDeclNote} photo={taxDeclPhoto} 
            onPick={() => pickDocumentImage("tax_decl")} isReadOnly={isReadOnly} />

          <FieldLabel label="Land Classification" hint="Official designation per DENR/CENRO records" />
          <ChipGroup 
            options={["Alienable and Disposable", "Forestland", "Timberland", "Protected Area", "Unclassified / Unknown"]}
            value={landClassType} onSelect={(v) => !isReadOnly && setLandClassType(v as any)} isReadOnly={isReadOnly}
          />
          {!isReadOnly && (
            <TextInput style={styles.textArea} placeholder="Inspector Notes" placeholderTextColor="#9CA3AF"
              value={landClassNote} onChangeText={setLandClassNote} multiline />
          )}
          {isReadOnly && landClassNote ? <Text style={styles.readonlyNote}>{landClassNote}</Text> : null}

          <FieldLabel label="Other Documents" />
          {otherDocs.map((doc, idx) => (
            <View key={idx} style={styles.otherDocRow}>
              <View style={{ flex: 1 }}>
                <TextInput style={styles.miniInput} placeholder="Document Name / Type" placeholderTextColor="#9CA3AF"
                  value={doc.note} onChangeText={(val) => {
                    const updated = [...otherDocs]; updated[idx].note = val; setOtherDocs(updated);
                  }} editable={!isReadOnly} />
              </View>
              {!isReadOnly && (
                <TouchableOpacity style={styles.miniPickBtn} onPress={() => pickDocumentImage("other_doc", doc.note)}>
                  <Ionicons name="camera-outline" size={16} color="#0F4A2F" />
                </TouchableOpacity>
              )}
            </View>
          ))}
          {!isReadOnly && (
            <TouchableOpacity style={styles.addBtn} onPress={() => setOtherDocs([...otherDocs, { photo_url: null, note: "" }])}>
              <Ionicons name="add" size={16} color="#0F4A2F" />
              <Text style={styles.addBtnText}>Add Other Document</Text>
            </TouchableOpacity>
          )}
        </SectionCard>

        {/* 2. Security Concerns */}
        <SectionCard icon="shield-alert-outline" title="Security Concerns" sub="Tap all that apply">
          {(["Armed Threat / Violence", "Hostile Person on Site", "Illegal Activity Observed", "Community Resistance", "Land Conflict", "Other"] as SecurityConcern[]).map((s) => (
            <SecurityChip key={s} label={s} active={securitySelected.includes(s)} onToggle={() => !isReadOnly && toggleSecurity(s)} isReadOnly={isReadOnly} />
          ))}
          {securitySelected.length > 0 && !isReadOnly && (
            <TextInput style={styles.textArea} placeholder="Add security notes (optional)" placeholderTextColor="#9CA3AF"
              value={securityNote} onChangeText={setSecurityNote} multiline />
          )}
          {isReadOnly && securityNote ? <Text style={styles.readonlyNote}>{securityNote}</Text> : null}
        </SectionCard>

        {/* 3. Accessibility */}
        <SectionCard icon="car-outline" title="Accessibility" sub="How to reach the site">
          <ChipGroup 
            options={["Road", "Trail", "None", "Other"]}
            value={vehicleAccess} onSelect={(v) => !isReadOnly && setVehicleAccess(v as any)} isReadOnly={isReadOnly}
          />
          {/* ✅ Conditional note: show when "Other" OR "None" is selected */}
          {(vehicleAccess === "Other" || vehicleAccess === "None") && !isReadOnly && (
            <TextInput style={styles.textArea} placeholder="Describe how to get there / explain road conditions" placeholderTextColor="#9CA3AF"
              value={accessNotes} onChangeText={setAccessNotes} multiline />
          )}
          {isReadOnly && accessNotes ? <Text style={styles.readonlyNote}>{accessNotes}</Text> : null}
        </SectionCard>

        {/* 4. Photos & Attachments */}
        <SectionCard icon="image-multiple-outline" title="Field Photos" sub="All uploaded evidence">
          <FlatList horizontal data={allImages} keyExtractor={(i) => i.id.toString()} showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 10, gap: 10 }}
            renderItem={({ item }) => (
              <View style={styles.photoCard}>
                <Image source={{ uri: item.url || undefined }} style={styles.photoThumb} />
                <Text style={styles.photoCaption} numberOfLines={1}>{item.caption}</Text>
                {!isReadOnly && (
                  <TouchableOpacity style={styles.photoDelete} onPress={() => item.isLocal ? removeLocalImage(item.id as string) : deleteExistingImage(item.id as number)}>
                    <Ionicons name="close" size={12} color="#FFFFFF" />
                  </TouchableOpacity>
                )}
              </View>
            )} />
          {!isReadOnly && (
            <TouchableOpacity style={styles.addPhotoBtn} onPress={() => pickDocumentImage("other_doc")}>
              <Ionicons name="camera-outline" size={18} color="#0F4A2F" />
              <Text style={styles.addPhotoBtnText}>Add General Photo</Text>
            </TouchableOpacity>
          )}
        </SectionCard>

        {/* Actions */}
        {!isReadOnly && (
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.draftBtn, saving && styles.btnDisabled]} onPress={handleSaveDraft} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color="#0F4A2F" /> : <Ionicons name="save-outline" size={16} color="#0F4A2F" />}
              <Text style={styles.draftBtnText}>{saving ? "Saving…" : "Save Draft"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.submitBtn, submitting && styles.btnDisabled]} onPress={handleSubmit} disabled={submitting}>
              {submitting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="send-outline" size={16} color="#FFFFFF" />}
              <Text style={styles.submitBtnText}>{submitting ? "Submitting…" : "Submit to GIS"}</Text>
            </TouchableOpacity>
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
      <View style={styles.cardIconWrap}><MaterialCommunityIcons name={icon as any} size={17} color="#0F4A2F" /></View>
      <View><Text style={styles.cardTitle}>{title}</Text><Text style={styles.cardSub}>{sub}</Text></View>
    </View>
    <View style={styles.cardBody}>{children}</View>
  </View>
);

const FieldLabel: React.FC<{ label: string; hint?: string }> = ({ label, hint }) => (
  <View style={{ marginTop: 14, marginBottom: 6 }}>
    <Text style={styles.fieldLabel}>{label}</Text>
    {hint && <Text style={styles.fieldHint}>{hint}</Text>}
  </View>
);

const DocRow: React.FC<{ label: string; note: string; setNote: (v: string) => void; photo: string | null; onPick: () => void; isReadOnly: boolean }> = 
  ({ label, note, setNote, photo, onPick, isReadOnly }) => (
    <View style={styles.docRow}>
      <View style={styles.docHeader}>
        <MaterialCommunityIcons name="file-document" size={16} color="#0F4A2F" />
        <Text style={styles.docLabel}>{label}</Text>
      </View>
      <View style={styles.docActions}>
        {!isReadOnly && (
          <TouchableOpacity style={styles.pickBtn} onPress={onPick}>
            <Ionicons name="camera-outline" size={16} color="#0F4A2F" />
            <Text style={styles.pickText}>Take Photo</Text>
          </TouchableOpacity>
        )}
        {photo && <Image source={{ uri: photo }} style={styles.docThumb} />}
      </View>
      {!isReadOnly && (
        <TextInput style={styles.textArea} placeholder="Comment / Note" placeholderTextColor="#9CA3AF"
          value={note} onChangeText={setNote} multiline />
      )}
      {isReadOnly && note ? <Text style={styles.readonlyNote}>{note}</Text> : null}
    </View>
  );

const SecurityChip: React.FC<{ label: string; active: boolean; onToggle: () => void; isReadOnly: boolean }> = 
  ({ label, active, onToggle, isReadOnly }) => (
    <TouchableOpacity style={[styles.secChip, active && styles.secChipActive]} onPress={isReadOnly ? undefined : onToggle} disabled={isReadOnly}>
      <View style={[styles.secDot, { backgroundColor: active ? "#EF4444" : "#9CA3AF" }]} />
      <Text style={[styles.secText, active && styles.secTextActive]}>{label}</Text>
    </TouchableOpacity>
  );

const ChipGroup: React.FC<{ options: string[]; value: string; onSelect: (v: string) => void; isReadOnly: boolean }> = 
  ({ options, value, onSelect, isReadOnly }) => (
    <View style={styles.chipGrid}>
      {options.map((opt) => (
        <TouchableOpacity key={opt} style={[styles.chip, value === opt && { backgroundColor: "#0F4A2F", borderColor: "#0F4A2F" }]} 
          onPress={isReadOnly ? undefined : () => onSelect(opt)} disabled={isReadOnly}>
          <Text style={[styles.chipText, value === opt && styles.chipTextActive]}>{opt}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

/* ---------- STYLES ---------- */
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F4F7F5" },
  loadingScreen: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loadingText: { color: "#6B7280", fontSize: 14 },
  header: { backgroundColor: "#0F4A2F", flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingBottom: 14 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.12)", justifyContent: "center", alignItems: "center" },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },
  headerSub: { fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 1 },
  submittedBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#DCFCE7", paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#BBF7D0" },
  submittedBannerText: { flex: 1, fontSize: 12, color: "#15803D", fontWeight: "600" },
  scroll: { flex: 1 }, content: { padding: 16, gap: 0 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 18, marginBottom: 14, elevation: 2, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, overflow: "hidden" },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  cardIconWrap: { width: 34, height: 34, borderRadius: 10, backgroundColor: "#E6F4EC", justifyContent: "center", alignItems: "center" },
  cardTitle: { fontSize: 14, fontWeight: "700", color: "#0F2D1C" },
  cardSub: { fontSize: 11, color: "#9CA3AF", marginTop: 1 },
  cardBody: { padding: 14 },
  fieldLabel: { fontSize: 11, fontWeight: "700", color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.5 },
  fieldHint: { fontSize: 11, color: "#9CA3AF", marginTop: 2, fontStyle: "italic" },
  textArea: { backgroundColor: "#F9FAFB", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 10, padding: 12, fontSize: 13, color: "#0F2D1C", height: 70, textAlignVertical: "top", marginTop: 6 },
  readonlyNote: { fontSize: 13, color: "#4B5563", marginTop: 6, backgroundColor: "#F3F4F6", padding: 10, borderRadius: 8 },
  docRow: { marginBottom: 16, borderBottomWidth: 1, borderBottomColor: "#F3F4F6", paddingBottom: 12 },
  docHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  docLabel: { fontSize: 13, fontWeight: "700", color: "#0F2D1C" },
  docActions: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  pickBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: "#E6F4EC" },
  pickText: { fontSize: 12, fontWeight: "600", color: "#0F4A2F" },
  docThumb: { width: 50, height: 50, borderRadius: 8, backgroundColor: "#E5E7EB" },
  otherDocRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  miniInput: { flex: 1, backgroundColor: "#F9FAFB", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 12 },
  miniPickBtn: { padding: 8, backgroundColor: "#E6F4EC", borderRadius: 8 },
  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, marginTop: 4, borderWidth: 1, borderColor: "#0F4A2F", borderStyle: "dashed", borderRadius: 8 },
  addBtnText: { fontSize: 12, fontWeight: "600", color: "#0F4A2F" },
  secChip: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#F9FAFB" },
  secChipActive: { backgroundColor: "#FEF2F2" },
  secDot: { width: 10, height: 10, borderRadius: 5 },
  secText: { flex: 1, fontSize: 13, color: "#6B7280" },
  secTextActive: { color: "#0F2D1C", fontWeight: "600" },
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, backgroundColor: "#F9FAFB", borderColor: "#E5E7EB" },
  chipText: { fontSize: 12, color: "#6B7280" },
  chipTextActive: { color: "#FFFFFF", fontWeight: "700" },
  photoCard: { width: 100, position: "relative" },
  photoThumb: { width: 100, height: 75, borderRadius: 10, backgroundColor: "#E5E7EB", marginBottom: 4 },
  photoCaption: { fontSize: 10, color: "#6B7280", textAlign: "center" },
  photoDelete: { position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: "rgba(239,68,68,0.85)", justifyContent: "center", alignItems: "center" },
  addPhotoBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1.5, borderColor: "#0F4A2F", borderStyle: "dashed", borderRadius: 10, paddingVertical: 12, marginTop: 8 },
  addPhotoBtnText: { fontSize: 13, fontWeight: "600", color: "#0F4A2F" },
  actions: { gap: 10, marginTop: 4 },
  draftBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1.5, borderColor: "#0F4A2F", borderRadius: 14, paddingVertical: 14, backgroundColor: "#FFFFFF" },
  draftBtnText: { fontSize: 14, fontWeight: "700", color: "#0F4A2F" },
  submitBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#0F4A2F", borderRadius: 14, paddingVertical: 14, elevation: 3, shadowColor: "#0F4A2F", shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
  submitBtnText: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },
  btnDisabled: { opacity: 0.55 },
});