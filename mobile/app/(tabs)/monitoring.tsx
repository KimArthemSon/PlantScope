import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Modal,
  TextInput, ActivityIndicator, Alert, Pressable, ScrollView, Image,
  RefreshControl, KeyboardAvoidingView, Platform,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import * as ImagePicker from "expo-image-picker";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { api } from "@/constants/url_fixed";

const API_BASE_URL = api + "/api";

// ─── Types ─────────────────────────────────────────────────────────────────

type Application = {
  application_id: number;
  title: string;
  group_name: string; // Updated from organization_name
  status: string; 
  site_name: string | null;
  barangay: string | null;
  orientation_date: string | null;
  created_at: string;
};

type ProgressReportSpecies = {
  species_id: number;
  species_name: string;
  no_survived: number;
  no_dead: number;
  total: number;
  survival_rate: number;
};

type ProgressReport = {
  report_id: number;
  total_survived: number; // Updated from no_survived_plants
  total_dead: number;     // Updated from no_dead_plants
  species: ProgressReportSpecies[]; // NEW: Per-species breakdown
  description: string | null;
  status: "pending" | "accepted" | "rejected";
  proof_image: string | null;
  submitted_at: string | null;
};

type ApplicationDetail = {
  application: Application;
  progress_reports: ProgressReport[];
  assigned_site: { name: string; barangay: string | null } | null;
};

type TreeSpeciesOption = {
  tree_specie_id: number;
  name: string;
  description: string;
};

type ReportSpeciesItem = {
  tree_species_id: number;
  species_name: string;
  no_survived: number;
  no_dead: number;
};

// ─── Status Config ─────────────────────────────────────────────────────────

const APP_STATUS_CONFIG = {
  accepted: { label: "Active", bg: "#E6F4EC", text: "#0F4A2F", dot: "#0F4A2F" },
  under_monitoring: { label: "Monitoring", bg: "#E6F4EC", text: "#0F4A2F", dot: "#0F4A2F" },
};

const REPORT_STATUS_CONFIG = {
  pending: { label: "Pending", bg: "#FEF9C3", text: "#A16207", dot: "#F59E0B" },
  accepted: { label: "Verified", bg: "#DCFCE7", text: "#15803D", dot: "#22C55E" },
  rejected: { label: "Rejected", bg: "#FEE2E2", text: "#DC2626", dot: "#EF4444" },
};

// ─── Main Component ────────────────────────────────────────────────────────

const OnsiteInspectorMonitoring: React.FC = () => {
  // List View State
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [filteredApps, setFilteredApps] = useState<Application[]>([]);

  // Detail View State
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedAppDetail, setSelectedAppDetail] = useState<ApplicationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Tree Species State (for building the report)
  const [allTreeSpecies, setAllTreeSpecies] = useState<TreeSpeciesOption[]>([]);
  
  // Submit Report State
  const [submitting, setSubmitting] = useState(false);
  const [reportSpeciesList, setReportSpeciesList] = useState<ReportSpeciesItem[]>([]);
  const [selectedSpeciesId, setSelectedSpeciesId] = useState<string>("");
  const [tempSurvived, setTempSurvived] = useState("");
  const [tempDead, setTempDead] = useState("");
  
  const [description, setDescription] = useState("");
  const [proofImage, setProofImage] = useState<string | null>(null);
  const [proofImageName, setProofImageName] = useState("Upload Group Photo");

  // ─── Fetch Application List ──────────────────────────────────────────────

  const fetchApplications = async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      else setRefreshing(true);

      const token = await SecureStore.getItemAsync("token");
      if (!token) throw new Error("No token found.");

      const url = `${API_BASE_URL}/get_ongoing_applications/?barangay=${encodeURIComponent(searchText)}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed to load applications.");
      
      const data = await res.json();
      setApplications(data);
      setFilteredApps(data);
    } catch (err: any) {
      console.error(err);
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // ─── Fetch Tree Species List ─────────────────────────────────────────────

  const fetchTreeSpecies = async () => {
    try {
      const token = await SecureStore.getItemAsync("token");
      const res = await fetch(`${API_BASE_URL}/get_tree_species_list/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAllTreeSpecies(data);
      }
    } catch (err) {
      console.error("Failed to fetch tree species", err);
    }
  };

  useEffect(() => { 
    fetchApplications(); 
    fetchTreeSpecies();
  }, []);

  useEffect(() => {
    const lowerText = searchText.toLowerCase();
    const filtered = applications.filter(
      (app) => 
        app.barangay?.toLowerCase().includes(lowerText) ||
        app.title.toLowerCase().includes(lowerText) ||
        app.group_name.toLowerCase().includes(lowerText)
    );
    setFilteredApps(filtered);
  }, [searchText, applications]);

  const handleRefresh = () => fetchApplications(true);

  // ─── Fetch Application Detail ────────────────────────────────────────────

  const fetchApplicationDetail = async (appId: number) => {
    try {
      setDetailLoading(true);
      const token = await SecureStore.getItemAsync("token");
      if (!token) throw new Error("No token found.");

      const res = await fetch(`${API_BASE_URL}/get_application/${appId}/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load application details.");
      
      const data: ApplicationDetail = await res.json();
      setSelectedAppDetail(data);
    } catch (err: any) {
      console.error(err);
      Alert.alert("Error", err.message);
    } finally {
      setDetailLoading(false);
    }
  };

  const openDetail = async (app: Application) => {
    setSelectedAppDetail(null);
    setDetailModalVisible(true);
    await fetchApplicationDetail(app.application_id);
  };

  const closeDetail = () => {
    setDetailModalVisible(false);
    setSelectedAppDetail(null);
    resetForm();
  };

  const resetForm = () => {
    setReportSpeciesList([]);
    setSelectedSpeciesId("");
    setTempSurvived("");
    setTempDead("");
    setDescription("");
    setProofImage(null);
    setProofImageName("Upload Group Photo");
  };

  // ─── Species Builder Handlers ────────────────────────────────────────────

  const handleAddSpeciesToReport = () => {
    if (!selectedSpeciesId) {
      Alert.alert("Missing Species", "Please select a tree species.");
      return;
    }

    const found = allTreeSpecies.find(s => s.tree_specie_id === Number(selectedSpeciesId));
    if (!found) return;

    if (reportSpeciesList.some(s => s.tree_species_id === found.tree_specie_id)) {
      Alert.alert("Duplicate", "This species is already in the report. Please update the existing entry.");
      return;
    }

    setReportSpeciesList([
      ...reportSpeciesList,
      {
        tree_species_id: found.tree_specie_id,
        species_name: found.name,
        no_survived: parseInt(tempSurvived) || 0,
        no_dead: parseInt(tempDead) || 0,
      }
    ]);
    
    // Reset temp inputs for next species
    setSelectedSpeciesId("");
    setTempSurvived("");
    setTempDead("");
  };

  const handleRemoveSpeciesFromReport = (index: number) => {
    setReportSpeciesList(reportSpeciesList.filter((_, i) => i !== index));
  };

  // ─── Image Picker ────────────────────────────────────────────────────────

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert("Permission Required", "Camera roll permission is needed.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      setProofImage(result.assets[0].uri);
      setProofImageName(result.assets[0].fileName || "Selected Image");
    }
  };

  // ─── Submit Progress Report ──────────────────────────────────────────────

  const handleSubmitReport = async () => {
    if (!selectedAppDetail) return;
    if (reportSpeciesList.length === 0) {
      Alert.alert("Missing Data", "Please add at least one tree species with survival data.");
      return;
    }

    setSubmitting(true);
    try {
      const token = await SecureStore.getItemAsync("token");
      const formData = new FormData();

      formData.append("application_id", String(selectedAppDetail.application.application_id));
      
      // ✅ NEW: Append the normalized species array as JSON string
      formData.append("report_species", JSON.stringify(reportSpeciesList.map(s => ({
        tree_species_id: s.tree_species_id,
        no_survived: s.no_survived,
        no_dead: s.no_dead
      }))));
      
      formData.append("description", description);

      if (proofImage) {
        const filename = proofImage.split("/").pop();
        const match = /\.(\w+)$/.exec(filename || "");
        const type = match ? `image/${match[1]}` : "image/jpeg";
        
        formData.append("proof_image", {
          uri: proofImage,
          name: filename || "proof.jpg",
          type: type,
        } as any);
      }

      const res = await fetch(`${API_BASE_URL}/create_progress_report/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submission failed.");

      Alert.alert("✓ Success", "Progress report submitted!");
      resetForm();
      await fetchApplicationDetail(selectedAppDetail.application.application_id);

    } catch (err: any) {
      console.error(err);
      Alert.alert("Error", err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Render List Item ────────────────────────────────────────────────────

  const renderAppItem = ({ item }: { item: Application }) => {
    const statusConf = APP_STATUS_CONFIG[item.status as keyof typeof APP_STATUS_CONFIG] || APP_STATUS_CONFIG.accepted;
    
    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.8} onPress={() => openDetail(item)}>
        <View style={[styles.cardAccent, { backgroundColor: statusConf.dot }]} />
        <View style={styles.cardBody}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusConf.bg }]}>
              <View style={[styles.statusDot, { backgroundColor: statusConf.dot }]} />
              <Text style={[styles.statusText, { color: statusConf.text }]}>{statusConf.label}</Text>
            </View>
          </View>
          <Text style={styles.orgName}>{item.group_name}</Text>
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={14} color="#6B7280" />
            <Text style={styles.metaText}>{item.barangay || "No Barangay"} • {item.site_name || "No Site"}</Text>
          </View>
          <View style={styles.actionFooter}>
            <Text style={styles.actionText}>View Reports & Submit</Text>
            <Ionicons name="chevron-forward" size={18} color="#0F4A2F" />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ─── Render Progress Report Item (Updated for Species Breakdown) ─────────

  const renderReportItem = ({ item }: { item: ProgressReport }) => {
    const statusConf = REPORT_STATUS_CONFIG[item.status];
    const dateStr = item.submitted_at 
      ? new Date(item.submitted_at).toLocaleDateString("en-PH", { month: "short", day: "numeric" })
      : "No date";

    return (
      <View style={styles.reportCard}>
        <View style={styles.reportHeader}>
          <Text style={styles.reportDate}>{dateStr}</Text>
          <View style={[styles.reportBadge, { backgroundColor: statusConf.bg }]}>
            <View style={[styles.reportDot, { backgroundColor: statusConf.dot }]} />
            <Text style={[styles.reportBadgeText, { color: statusConf.text }]}>{statusConf.label}</Text>
          </View>
        </View>
        
        {/* Total Stats */}
        <View style={styles.reportStats}>
          <View style={styles.reportStat}>
            <Text style={styles.reportStatValue}>{item.total_survived}</Text>
            <Text style={styles.reportStatLabel}>Total Survived</Text>
          </View>
          <View style={styles.reportDivider} />
          <View style={styles.reportStat}>
            <Text style={[styles.reportStatValue, { color: "#DC2626" }]}>{item.total_dead}</Text>
            <Text style={styles.reportStatLabel}>Total Dead</Text>
          </View>
        </View>

        {/* ✅ NEW: Species Breakdown */}
        {item.species && item.species.length > 0 && (
          <View style={styles.speciesBreakdown}>
            <Text style={styles.breakdownTitle}>Species Breakdown</Text>
            {item.species.map((sp, idx) => (
              <View key={idx} style={styles.breakdownRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 }}>
                  <Ionicons name="leaf-outline" size={12} color="#0F4A2F" />
                  <Text style={styles.breakdownSpecies}>{sp.species_name}</Text>
                </View>
                <Text style={styles.breakdownCounts}>
                  <Text style={{ color: '#15803D', fontWeight: '600' }}>{sp.no_survived}</Text>
                  <Text style={{ color: '#9CA3AF' }}> / </Text>
                  <Text style={{ color: '#DC2626', fontWeight: '600' }}>{sp.no_dead}</Text>
                </Text>
              </View>
            ))}
          </View>
        )}
        
        {item.description ? (
          <Text style={styles.reportDesc} numberOfLines={2}>
            <Ionicons name="document-text-outline" size={12} color="#6B7280" /> {item.description}
          </Text>
        ) : (
          <Text style={styles.reportNoDesc}>No remarks</Text>
        )}
        
        {item.proof_image && (
          <View style={styles.reportImageTag}>
            <Ionicons name="image" size={12} color="#0F4A2F" />
            <Text style={styles.reportImageText}>Photo attached</Text>
          </View>
        )}
      </View>
    );
  };

  // ─── Main Render ─────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Active Projects</Text>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#6B7280" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Filter by barangay..."
            value={searchText}
            onChangeText={setSearchText}
          />
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#0F4A2F" /><Text style={styles.loadingText}>Loading projects...</Text></View>
      ) : (
        <FlatList
          data={filteredApps}
          renderItem={renderAppItem}
          keyExtractor={(item) => item.application_id.toString()}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="clipboard-list-outline" size={64} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>No Active Projects</Text>
              <Text style={styles.emptySubtitle}>{searchText ? `No results for "${searchText}"` : "No accepted applications found."}</Text>
            </View>
          }
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#0F4A2F" />}
        />
      )}

      {/* ─── Detail Modal ─── */}
      <Modal visible={detailModalVisible} animationType="slide" transparent={true} onRequestClose={closeDetail}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle} numberOfLines={1}>{selectedAppDetail?.application.title || "Loading..."}</Text>
                <Text style={styles.modalSubtitle}>{selectedAppDetail?.application.group_name}</Text>
              </View>
              <Pressable onPress={closeDetail}><Ionicons name="close" size={24} color="#6B7280" /></Pressable>
            </View>

            {detailLoading ? (
              <View style={styles.center}><ActivityIndicator size="large" color="#0F4A2F" /></View>
            ) : selectedAppDetail ? (
              <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
                
                <View style={styles.appInfoBox}>
                  <Text style={styles.appInfoLabel}>Site Details</Text>
                  <Text style={styles.appInfoValue}>{selectedAppDetail.application.site_name || "No site assigned"}</Text>
                  <Text style={styles.appInfoValue}>{selectedAppDetail.application.barangay || "No barangay"}</Text>
                  {selectedAppDetail.application.orientation_date && (
                    <Text style={styles.appInfoValue}>
                      Orientation: {new Date(selectedAppDetail.application.orientation_date).toLocaleDateString("en-PH")}
                    </Text>
                  )}
                </View>

                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Progress Reports</Text>
                  <Text style={styles.sectionCount}>{selectedAppDetail.progress_reports.length} submitted</Text>
                </View>

                {selectedAppDetail.progress_reports.length === 0 ? (
                  <View style={styles.noReports}>
                    <Ionicons name="clipboard-outline" size={32} color="#9CA3AF" />
                    <Text style={styles.noReportsText}>No reports submitted yet</Text>
                  </View>
                ) : (
                  <FlatList
                    data={selectedAppDetail.progress_reports}
                    renderItem={renderReportItem}
                    keyExtractor={(item) => item.report_id.toString()}
                    scrollEnabled={false}
                    style={{ marginBottom: 16 }}
                  />
                )}

                {/* ─── Submit New Report Form ─── */}
                <View style={styles.formSection}>
                  <Text style={styles.formTitle}>Submit New Report</Text>
                  
                  {/* ✅ NEW: Species Builder UI */}
                  <Text style={styles.label}>Report by Species</Text>
                  <View style={styles.speciesBuilderBox}>
                    <Text style={{ fontSize: 11, color: '#6B7280', marginBottom: 6, fontWeight: '600' }}>Select Tree Species</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        {allTreeSpecies.map(sp => (
                          <TouchableOpacity
                            key={sp.tree_specie_id}
                            onPress={() => setSelectedSpeciesId(String(sp.tree_specie_id))}
                            style={{
                              paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
                              backgroundColor: selectedSpeciesId === String(sp.tree_specie_id) ? '#0F4A2F' : '#FFF',
                              borderWidth: 1, borderColor: selectedSpeciesId === String(sp.tree_specie_id) ? '#0F4A2F' : '#E5E7EB'
                            }}
                          >
                            <Text style={{ color: selectedSpeciesId === String(sp.tree_specie_id) ? '#FFF' : '#374151', fontSize: 12, fontWeight: '600' }}>
                              {sp.name}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>

                    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Survived</Text>
                        <TextInput 
                          style={styles.input} 
                          placeholder="0" 
                          keyboardType="numeric" 
                          value={tempSurvived} 
                          onChangeText={setTempSurvived} 
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Dead</Text>
                        <TextInput 
                          style={styles.input} 
                          placeholder="0" 
                          keyboardType="numeric" 
                          value={tempDead} 
                          onChangeText={setTempDead} 
                        />
                      </View>
                    </View>

                    <TouchableOpacity 
                      style={[styles.addSpeciesBtn, { opacity: selectedSpeciesId ? 1 : 0.5 }]}
                      onPress={handleAddSpeciesToReport}
                      disabled={!selectedSpeciesId}
                    >
                      <Ionicons name="add-circle" size={16} color="#FFF" />
                      <Text style={styles.addSpeciesBtnText}>Add to Report</Text>
                    </TouchableOpacity>
                  </View>

                  {/* List of added species */}
                  {reportSpeciesList.length > 0 && (
                    <View style={{ marginBottom: 12 }}>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 6 }}>
                        Included Species ({reportSpeciesList.length})
                      </Text>
                      {reportSpeciesList.map((sp, idx) => (
                        <View key={idx} style={styles.addedSpeciesItem}>
                          <View>
                            <Text style={styles.addedSpeciesName}>{sp.species_name}</Text>
                            <Text style={styles.addedSpeciesCounts}>
                              <Text style={{ color: '#15803D' }}>{sp.no_survived} survived</Text>
                              <Text style={{ color: '#9CA3AF' }}> / </Text>
                              <Text style={{ color: '#DC2626' }}>{sp.no_dead} dead</Text>
                            </Text>
                          </View>
                          <TouchableOpacity onPress={() => handleRemoveSpeciesFromReport(idx)}>
                            <Ionicons name="close-circle" size={22} color="#DC2626" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}

                  <Text style={styles.label}>Remarks</Text>
                  <TextInput 
                    style={[styles.input, styles.textArea]} 
                    placeholder="Notes about plant condition..." 
                    multiline 
                    numberOfLines={3} 
                    value={description} 
                    onChangeText={setDescription} 
                  />

                  <Text style={styles.label}>Proof Image</Text>
                  <TouchableOpacity style={styles.imageUploadBtn} onPress={pickImage}>
                    <Ionicons name="image-outline" size={24} color="#0F4A2F" />
                    <Text style={styles.imageBtnText}>{proofImage ? proofImageName : "Tap to upload group photo"}</Text>
                  </TouchableOpacity>
                  {proofImage && <Image source={{ uri: proofImage }} style={styles.imagePreview} />}

                  <TouchableOpacity 
                    style={[styles.submitBtn, { opacity: (submitting || reportSpeciesList.length === 0) ? 0.6 : 1 }]} 
                    onPress={handleSubmitReport} 
                    disabled={submitting || reportSpeciesList.length === 0}
                  >
                    {submitting ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.submitBtnText}>Submit Report</Text>}
                  </TouchableOpacity>
                </View>

                <View style={{ height: 20 }} />
              </ScrollView>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F7F5" },
  header: { padding: 16, backgroundColor: "#FFF", paddingBottom: 12 },
  headerTitle: { fontSize: 24, fontWeight: "800", color: "#0F2D1C", marginBottom: 16 },
  searchContainer: { flexDirection: "row", alignItems: "center", backgroundColor: "#F3F4F6", borderRadius: 12, paddingHorizontal: 12 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, height: 44, fontSize: 16 },

  listContent: { padding: 16, paddingBottom: 32 },
  card: { flexDirection: "row", backgroundColor: "#FFF", borderRadius: 16, marginBottom: 12, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  cardAccent: { width: 6 },
  cardBody: { flex: 1, padding: 16 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#111827", flex: 1, marginRight: 8 },
  statusBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, gap: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
  orgName: { fontSize: 14, color: "#6B7280", marginBottom: 8 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 },
  metaText: { fontSize: 13, color: "#4B5563" },
  actionFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#F3F4F6" },
  actionText: { fontSize: 13, fontWeight: "600", color: "#0F4A2F" },

  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 10, color: "#6B7280" },
  emptyState: { alignItems: "center", marginTop: 60, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#374151" },
  emptySubtitle: { fontSize: 14, color: "#6B7280", textAlign: "center", maxWidth: 250 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: "#FFF", borderTopLeftRadius: 24, borderTopRightRadius: 24, height: "90%", padding: 20 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16, paddingRight: 8 },
  modalTitle: { fontSize: 18, fontWeight: "800", color: "#111827" },
  modalSubtitle: { fontSize: 13, color: "#6B7280" },
  modalScroll: { flex: 1 },

  appInfoBox: { backgroundColor: "#F0FDF4", padding: 12, borderRadius: 12, marginBottom: 16 },
  appInfoLabel: { fontSize: 12, fontWeight: "600", color: "#15803D", marginBottom: 4 },
  appInfoValue: { fontSize: 13, color: "#166534" },

  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },
  sectionCount: { fontSize: 12, color: "#6B7280" },

  noReports: { alignItems: "center", padding: 24, backgroundColor: "#F9FAFB", borderRadius: 12, marginBottom: 16 },
  noReportsText: { marginTop: 8, color: "#6B7280", fontSize: 13 },

  reportCard: { backgroundColor: "#F9FAFB", borderRadius: 12, padding: 12, marginBottom: 10 },
  reportHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  reportDate: { fontSize: 12, color: "#6B7280" },
  reportBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, gap: 4 },
  reportDot: { width: 5, height: 5, borderRadius: 3 },
  reportBadgeText: { fontSize: 9, fontWeight: "700", textTransform: "uppercase" },
  reportStats: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  reportStat: { flex: 1, alignItems: "center" },
  reportStatValue: { fontSize: 16, fontWeight: "800", color: "#0F4A2F" },
  reportStatLabel: { fontSize: 10, color: "#6B7280", marginTop: 2 },
  reportDivider: { width: 1, height: 28, backgroundColor: "#E5E7EB" },
  
  // ✅ NEW: Species Breakdown Styles
  speciesBreakdown: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E5E7EB', marginBottom: 8 },
  breakdownTitle: { fontSize: 11, fontWeight: '600', color: '#6B7280', marginBottom: 4 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  breakdownSpecies: { fontSize: 12, color: '#374151', fontWeight: '500' },
  breakdownCounts: { fontSize: 12, color: '#374151' },

  reportDesc: { fontSize: 12, color: "#4B5563", lineHeight: 16 },
  reportNoDesc: { fontSize: 12, color: "#9CA3AF", fontStyle: "italic" },
  reportImageTag: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6, alignSelf: "flex-start", backgroundColor: "#E6F4EC", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  reportImageText: { fontSize: 10, fontWeight: "600", color: "#0F4A2F" },

  formSection: { marginTop: 8, paddingTop: 16, borderTopWidth: 1, borderTopColor: "#E5E7EB" },
  formTitle: { fontSize: 16, fontWeight: "700", color: "#111827", marginBottom: 12 },
  label: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: "#F9FAFB", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: "#111827" },
  textArea: { height: 80, textAlignVertical: "top" },
  
  // ✅ NEW: Species Builder Styles
  speciesBuilderBox: { backgroundColor: '#F9FAFB', padding: 12, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  addSpeciesBtn: { flexDirection: 'row', backgroundColor: '#0F4A2F', padding: 10, borderRadius: 10, alignItems: 'center', justifyContent: 'center', gap: 6 },
  addSpeciesBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  
  addedSpeciesItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F0FDF4', padding: 10, borderRadius: 10, marginBottom: 6, borderWidth: 1, borderColor: '#DCFCE7' },
  addedSpeciesName: { fontSize: 13, fontWeight: '600', color: '#111827' },
  addedSpeciesCounts: { fontSize: 11, color: '#6B7280' },

  imageUploadBtn: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#F9FAFB", borderWidth: 2, borderColor: "#D1D5DB", borderStyle: "dashed", borderRadius: 12, padding: 16, justifyContent: "center" },
  imageBtnText: { fontSize: 13, color: "#4B5563", fontWeight: "500" },
  imagePreview: { width: "100%", height: 140, borderRadius: 12, marginTop: 10 },
  submitBtn: { backgroundColor: "#0F4A2F", borderRadius: 14, padding: 14, alignItems: "center", marginTop: 16, shadowColor: "#0F4A2F", shadowOpacity: 0.3, shadowRadius: 6, elevation: 4 },
  submitBtnText: { color: "#FFF", fontSize: 15, fontWeight: "700" },
});

export default OnsiteInspectorMonitoring;