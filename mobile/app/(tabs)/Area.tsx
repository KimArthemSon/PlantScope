import { useRouter } from "expo-router";
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Dimensions,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import MapView, { Marker } from "react-native-maps";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { api } from "@/constants/url_fixed";

const screenHeight = Dimensions.get("window").height;
const API_BASE_URL = api + "/api";

// ✅ UPDATED: Match new minimal API response structure (No barangay, no polygon)
type ReforestationArea = {
  reforestation_area_id: string;
  assigned_onsite_inspector_id: string;
  name: string;
  description: string | null;
  coordinate: [number, number] | { latitude: number; longitude: number } | null;
  latitude: number;
  longitude: number;
  coord_display: string;
  assigned_at: string;
};

const ReforestationAreas: React.FC = () => {
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedArea, setSelectedArea] = useState<ReforestationArea | null>(null);
  
  // ✅ NEW: State for the Assessment Type Action Sheet
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [actionSheetArea, setActionSheetArea] = useState<ReforestationArea | null>(null);

  const [searchText, setSearchText] = useState("");
  const [areas, setAreas] = useState<ReforestationArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  
  const router = useRouter();

  const fetchAssignedAreas = useCallback(async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) setRefreshing(true);
    else setLoading(true);
    setError(null);
    
    try {
      const token = await SecureStore.getItemAsync("token");
      if (!token) throw new Error("No authentication token found.");

      const response = await fetch(`${API_BASE_URL}/get_assigned_reforestation_area/`, {
        method: "GET",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();

      // ✅ UPDATED: Simplified mapping
      const mappedAreas: ReforestationArea[] = data.map((item: any) => {
        const { lat, lng, coordDisplay } = parseCoordinate(item.coordinate);
        return {
          reforestation_area_id: item.reforestation_area_id?.toString() || "",
          assigned_onsite_inspector_id: item.assigned_onsite_inspector_id?.toString() || "",
          name: item.name || "Unnamed Area",
          description: item.description || null,
          coordinate: item.coordinate || null,
          latitude: lat,
          longitude: lng,
          coord_display: coordDisplay,
          assigned_at: item.assigned_at || "",
        };
      });
      
      setAreas(mappedAreas);
      setLastRefreshed(new Date());
    } catch (err: any) {
      setError(err.message);
      if (err.message.includes("token")) {
        Alert.alert("Authentication Error", "Please log in again.", [{ text: "OK", onPress: () => router.replace("/") }]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  const onRefresh = useCallback(() => fetchAssignedAreas(true), [fetchAssignedAreas]);

  const parseCoordinate = (coordinate: any) => {
    const defaultLat = 11.0, defaultLng = 124.6;
    let lat = defaultLat, lng = defaultLng;
    let coordDisplay = "No Coordinates";

    try {
      if (Array.isArray(coordinate) && coordinate.length >= 2) {
        [lat, lng] = coordinate;
        coordDisplay = `${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E`;
      } else if (coordinate && typeof coordinate === "object") {
        lat = coordinate.latitude || defaultLat;
        lng = coordinate.longitude || defaultLng;
        coordDisplay = `${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E`;
      }
    } catch (e) {}
    return { lat, lng, coordDisplay };
  };

  useEffect(() => { fetchAssignedAreas(); }, [fetchAssignedAreas]);

  const openModal = (area: ReforestationArea) => { setSelectedArea(area); setModalVisible(true); };
  const closeModal = () => { setSelectedArea(null); setModalVisible(false); };

  // ✅ NEW: Action Sheet Handlers
  const openActionSheet = (area: ReforestationArea) => {
    closeModal(); // Close map modal if open
    setActionSheetArea(area);
    setActionSheetVisible(true);
  };

  const handleGeneralAssessment = () => {
    if (actionSheetArea) {
      router.push({
        pathname: "/feedbacks/site_field_assessment", // Your form screen
        params: { 
          areaId: actionSheetArea.reforestation_area_id, 
          areaName: actionSheetArea.name,
          assessmentType: 'general' // Tells next screen to send site_id = null
        },
      });
    }
    setActionSheetVisible(false);
  };

  const handleSpecificAssessment = () => {
    if (actionSheetArea) {
      router.push({
        pathname: "/feedbacks/select_site", // You need a screen to list sites for this area
        params: { 
          areaId: actionSheetArea.reforestation_area_id, 
          areaName: actionSheetArea.name,
          assessmentType: 'specific' // Tells next screen to require site_id
        },
      });
    }
    setActionSheetVisible(false);
  };

  const filteredAreas = areas.filter((area) => area.name.toLowerCase().includes(searchText.toLowerCase()));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Assigned Areas</Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh} disabled={refreshing}>
          <Ionicons name={refreshing ? "refresh-outline" : "refresh"} size={20} color={refreshing ? "#9CA3AF" : "#0F4A2F"} />
        </TouchableOpacity>
      </View>

      {lastRefreshed && !refreshing && (
        <Text style={styles.lastRefreshed}>Updated: {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
      )}

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color="#9CA3AF" style={styles.searchIcon} />
        <TextInput style={styles.searchInput} placeholder="Search by name…" placeholderTextColor="#9CA3AF" value={searchText} onChangeText={setSearchText} />
        {searchText.length > 0 && (
          <TouchableOpacity onPress={() => setSearchText("")}><Ionicons name="close-circle" size={18} color="#9CA3AF" /></TouchableOpacity>
        )}
      </View>

      {loading && !refreshing ? (
        <View style={styles.centerContent}><ActivityIndicator size="large" color="#0F4A2F" /><Text style={styles.loadingText}>Loading…</Text></View>
      ) : error && areas.length === 0 ? (
        <View style={styles.centerContent}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchAssignedAreas()}><Text style={styles.retryText}>Try Again</Text></TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#0F4A2F"]} tintColor="#0F4A2F" />}>
          
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Areas ({filteredAreas.length})</Text>
            {refreshing && <ActivityIndicator size="small" color="#0F4A2F" />}
          </View>

          {filteredAreas.map((area) => (
            <View key={area.reforestation_area_id} style={styles.card}>
              <View style={[styles.cardAccent, { backgroundColor: "#22C55E" }]} />
              <View style={styles.cardBody}>
                <View style={styles.cardTopRow}>
                  <Text style={styles.cardName} numberOfLines={1}>{area.name}</Text>
                </View>

                {/* ✅ REMOVED: Barangay meta row */}
                <View style={styles.metaRow}>
                  <Ionicons name="navigate-outline" size={13} color="#9CA3AF" />
                  <Text style={styles.metaText}>{area.coord_display}</Text>
                </View>

                <View style={styles.cardActions}>
                  <TouchableOpacity style={styles.viewBtn} onPress={() => openModal(area)} activeOpacity={0.75}>
                    <Ionicons name="map-outline" size={14} color="#0F4A2F" />
                    <Text style={styles.viewBtnText}>View Map</Text>
                  </TouchableOpacity>
                  
                  {/* ✅ UPDATED: Opens Action Sheet instead of navigating directly */}
                  <TouchableOpacity style={styles.assessBtn} onPress={() => openActionSheet(area)} activeOpacity={0.85}>
                    <Text style={styles.assessBtnText}>Start Assessment</Text>
                    <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}

          {filteredAreas.length === 0 && (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="tree-outline" size={52} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>No Areas Found</Text>
              <Text style={styles.emptySubtitle}>{searchText ? `No results for "${searchText}"` : "No assigned areas yet"}</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Map Modal */}
      <Modal animationType="slide" transparent visible={modalVisible} onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {selectedArea && (
              <>
                <View style={styles.dragHandle} />
                <MapView style={styles.map} initialRegion={{ latitude: selectedArea.latitude, longitude: selectedArea.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 }}>
                  <Marker coordinate={{ latitude: selectedArea.latitude, longitude: selectedArea.longitude }} title={selectedArea.name} />
                </MapView>

                <ScrollView style={styles.modalInfo} showsVerticalScrollIndicator={false}>
                  <Text style={styles.modalTitle}>{selectedArea.name}</Text>
                  <View style={styles.infoRow}>
                    <View style={styles.infoIconWrap}><Ionicons name="navigate" size={16} color="#0F4A2F" /></View>
                    <View><Text style={styles.infoLabel}>Coordinates</Text><Text style={styles.infoValue}>{selectedArea.coord_display}</Text></View>
                  </View>
                </ScrollView>

                <View style={styles.modalBtnRow}>
                  <Pressable style={styles.closeBtn} onPress={closeModal}><Text style={styles.closeBtnText}>Close</Text></Pressable>
                  <Pressable style={styles.startBtn} onPress={() => openActionSheet(selectedArea)}><Text style={styles.startBtnText}>Start Assessment</Text></Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ✅ NEW: Assessment Type Action Sheet */}
      <Modal animationType="slide" transparent visible={actionSheetVisible} onRequestClose={() => setActionSheetVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setActionSheetVisible(false)}>
          <Pressable style={styles.actionSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.dragHandle} />
            <Text style={styles.actionSheetTitle}>Choose Assessment Type</Text>
            <Text style={styles.actionSheetSubtitle}>Are you assessing the entire area or a specific site?</Text>
            
            <TouchableOpacity style={styles.actionOption} onPress={handleGeneralAssessment}>
              <View style={styles.actionIconWrap}><Ionicons name="globe-outline" size={24} color="#0F4A2F" /></View>
              <View style={styles.actionTextWrap}>
                <Text style={styles.actionTitle}>General Assessment</Text>
                <Text style={styles.actionDesc}>For the whole reforestation area (along the way observations).</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionOption} onPress={handleSpecificAssessment}>
              <View style={styles.actionIconWrap}><Ionicons name="location-outline" size={24} color="#0F4A2F" /></View>
              <View style={styles.actionTextWrap}>
                <Text style={styles.actionTitle}>Specific Site Assessment</Text>
                <Text style={styles.actionDesc}>For a specific marked site (requires site selection).</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>

            <Pressable style={styles.cancelBtn} onPress={() => setActionSheetVisible(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

/* ---------- STYLES ---------- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F7F5", paddingHorizontal: 16, paddingTop: 14 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4, paddingHorizontal: 4 },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#0F2D1C" },
  refreshBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#FFFFFF", justifyContent: "center", alignItems: "center", shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  lastRefreshed: { fontSize: 11, color: "#9CA3AF", marginBottom: 8, paddingHorizontal: 4, fontStyle: "italic" },
  searchWrap: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 16, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: "#0F2D1C" },
  centerContent: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loadingText: { color: "#6B7280", fontSize: 14, marginTop: 4 },
  errorText: { color: "#EF4444", textAlign: "center", fontSize: 14 },
  retryBtn: { backgroundColor: "#0F4A2F", paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  retryText: { color: "#FFF", fontWeight: "700" },
  sectionRow: { flexDirection: "row", alignItems: "center", marginBottom: 12, gap: 8, paddingHorizontal: 4 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#0F2D1C" },
  card: { flexDirection: "row", backgroundColor: "#FFFFFF", borderRadius: 16, marginBottom: 12, overflow: "hidden", elevation: 2, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  cardAccent: { width: 4 },
  cardBody: { flex: 1, padding: 14 },
  cardTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 },
  cardName: { fontSize: 15, fontWeight: "700", color: "#0F2D1C", flex: 1, marginRight: 8 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 3 },
  metaText: { fontSize: 12, color: "#6B7280" },
  cardActions: { flexDirection: "row", gap: 8, marginTop: 12 },
  viewBtn: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1.5, borderColor: "#0F4A2F", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  viewBtnText: { color: "#0F4A2F", fontSize: 12, fontWeight: "600" },
  assessBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#0F4A2F", borderRadius: 8, paddingVertical: 8 },
  assessBtnText: { color: "#FFF", fontSize: 12, fontWeight: "700" },
  emptyState: { alignItems: "center", paddingTop: 60, gap: 8, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#9CA3AF" },
  emptySubtitle: { fontSize: 13, color: "#9CA3AF", textAlign: "center" },
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
  modalSheet: { height: screenHeight * 0.6, backgroundColor: "#FFFFFF", borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: "hidden" },
  dragHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#E5E7EB", alignSelf: "center", marginTop: 10, marginBottom: 8 },
  map: { width: "100%", height: 230, backgroundColor: "#E5E7EB" },
  modalInfo: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#0F2D1C", marginBottom: 16 },
  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 14 },
  infoIconWrap: { width: 32, height: 32, borderRadius: 10, backgroundColor: "#E6F4EC", justifyContent: "center", alignItems: "center" },
  infoLabel: { fontSize: 11, color: "#9CA3AF", fontWeight: "500", marginBottom: 2 },
  infoValue: { fontSize: 14, color: "#0F2D1C", fontWeight: "600" },
  modalBtnRow: { flexDirection: "row", paddingHorizontal: 20, paddingVertical: 16, gap: 10, borderTopWidth: 1, borderTopColor: "#F3F4F6" },
  closeBtn: { flex: 1, borderWidth: 1.5, borderColor: "#0F4A2F", borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  closeBtnText: { color: "#0F4A2F", fontWeight: "700", fontSize: 14 },
  startBtn: { flex: 2, backgroundColor: "#0F4A2F", borderRadius: 12, paddingVertical: 14, alignItems: "center", shadowColor: "#0F4A2F", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4 },
  startBtnText: { color: "#FFF", fontWeight: "700", fontSize: 14 },
  scrollView: { flex: 1 },

  // ✅ NEW: Action Sheet Styles
  actionSheet: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40, gap: 16 },
  actionSheetTitle: { fontSize: 18, fontWeight: "700", color: "#0F2D1C", textAlign: "center" },
  actionSheetSubtitle: { fontSize: 13, color: "#6B7280", textAlign: "center", marginBottom: 8 },
  actionOption: { flexDirection: "row", alignItems: "center", backgroundColor: "#F9FAFB", padding: 16, borderRadius: 12, gap: 12, borderWidth: 1, borderColor: "#E5E7EB" },
  actionIconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#E6F4EC", justifyContent: "center", alignItems: "center" },
  actionTextWrap: { flex: 1 },
  actionTitle: { fontSize: 14, fontWeight: "700", color: "#0F2D1C" },
  actionDesc: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  cancelBtn: { marginTop: 8, paddingVertical: 12, alignItems: "center" },
  cancelBtnText: { color: "#EF4444", fontWeight: "600", fontSize: 14 },
});

export default ReforestationAreas;