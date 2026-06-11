import { useRouter, useLocalSearchParams } from "expo-router";
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Modal,
  ScrollView,
  Alert,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/constants/url_fixed";

const API_BASE = api;

export default function SelectSite() {
  const { areaId, areaName } = useLocalSearchParams<{
    areaId: string;
    areaName: string;
  }>();

  const router = useRouter();
  const [sites, setSites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // ✅ NEW: State for Site Information Modal
  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [selectedSiteInfo, setSelectedSiteInfo] = useState<any>(null);
  const [loadingInfo, setLoadingInfo] = useState(false);

  useEffect(() => {
    const fetchSites = async () => {
      try {
        const token = await SecureStore.getItemAsync("token");
        const res = await fetch(`${API_BASE}/api/list_sites/${areaId}/`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setSites(data.data || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchSites();
  }, [areaId]);

  // Navigates to the Layer Selection screen
  const handleSelectSite = (site: any) => {
    router.push({
      pathname: "/feedbacks/site_field_assessment",
      params: {
        areaId,
        areaName,
        siteId: site.site_id.toString(),
        siteName: site.name,
      },
    });
  };

  // ✅ NEW: Fetch and show detailed site information
  const handleViewInfo = async (siteId: number) => {
    setLoadingInfo(true);
    setInfoModalVisible(true);

    try {
      const token = await SecureStore.getItemAsync("token");
      // Uses your existing get_site endpoint
      const res = await fetch(`${API_BASE}/api/get_site/${siteId}/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedSiteInfo(data);
      } else {
        Alert.alert("Error", "Failed to load site information.");
        setInfoModalVisible(false);
      }
    } catch (e) {
      Alert.alert("Error", "Network error.");
      setInfoModalVisible(false);
    } finally {
      setLoadingInfo(false);
    }
  };

  // Helper to color-code the status badge
  const getStatusStyle = (status: string) => {
    if (status === "accepted") return { bg: "#DCFCE7", text: "#15803D" };
    if (status === "rejected") return { bg: "#FEE2E2", text: "#991B1B" };
    return { bg: "#FEF3C7", text: "#92400E" }; // pending, under_review, etc.
  };

  if (loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0F4A2F" />
      </View>
    );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          Select Site in {areaId}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={sites}
        keyExtractor={(item) => item.site_id.toString()}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            {/* Main Card Content (Navigates to Assessment) */}
            <TouchableOpacity
              style={styles.cardContent}
              onPress={() => handleSelectSite(item)}
              activeOpacity={0.7}
            >
              <View style={styles.iconWrap}>
                <Ionicons name="location" size={20} color="#0F4A2F" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.siteName}>{item.name}</Text>
                <Text style={styles.siteMeta}>
                  {item.area_hectares?.toFixed(2)} ha • Status: {item.status}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>

            {/* ✅ NEW: Info Button (Opens Modal) */}
            <TouchableOpacity
              style={styles.infoBtn}
              onPress={() => handleViewInfo(item.site_id)}
            >
              <Ionicons
                name="information-circle-outline"
                size={24}
                color="#0F4A2F"
              />
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="alert-circle-outline" size={40} color="#9CA3AF" />
            <Text style={styles.empty}>
              No sites created for this area yet.
            </Text>
          </View>
        }
      />

      {/* ✅ NEW: Site Information Modal */}
      <Modal
        visible={infoModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setInfoModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Site Information</Text>
              <TouchableOpacity onPress={() => setInfoModalVisible(false)}>
                <Ionicons name="close-circle" size={28} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {loadingInfo ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="large" color="#0F4A2F" />
                <Text style={styles.loadingText}>Loading details...</Text>
              </View>
            ) : selectedSiteInfo ? (
              <ScrollView
                style={styles.modalScroll}
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.siteDetailName}>
                  {selectedSiteInfo.name}
                </Text>

                {/* Status Badge */}
                {(() => {
                  const sStyle = getStatusStyle(selectedSiteInfo.status);
                  return (
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: sStyle.bg },
                      ]}
                    >
                      <Text
                        style={[styles.statusBadgeText, { color: sStyle.text }]}
                      >
                        {selectedSiteInfo.status.toUpperCase()}
                      </Text>
                    </View>
                  );
                })()}

                {/* Metrics Section */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Metrics</Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Area:</Text>
                    <Text style={styles.detailValue}>
                      {selectedSiteInfo.area_hectares?.toFixed(2) || "0.00"} ha
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>NDVI Value:</Text>
                    <Text style={styles.detailValue}>
                      {selectedSiteInfo.ndvi_value?.toFixed(3) || "N/A"}
                    </Text>
                  </View>
                </View>

                {/* Location Section */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Location</Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Center Coordinate:</Text>
                    <Text style={styles.detailValue}>
                      {selectedSiteInfo.center_coordinate
                        ? `${selectedSiteInfo.center_coordinate[0]?.toFixed(5)}, ${selectedSiteInfo.center_coordinate[1]?.toFixed(5)}`
                        : "Not set"}
                    </Text>
                  </View>
                </View>

                {/* Verification & Assets Section */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>
                    Verification & Assets
                  </Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Verification Status:</Text>
                    <Text style={styles.detailValue}>
                      {selectedSiteInfo.meta_verification?.status || "Pending"}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Potential Sites:</Text>
                    <Text style={styles.detailValue}>
                      {selectedSiteInfo.potential_sites?.length || 0}{" "}
                      consolidated
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Permits:</Text>
                    <Text style={styles.detailValue}>
                      {selectedSiteInfo.permits?.length || 0} documents
                    </Text>
                  </View>
                </View>
              </ScrollView>
            ) : null}

            <TouchableOpacity
              style={styles.modalActionBtn}
              onPress={() => setInfoModalVisible(false)}
            >
              <Text style={styles.modalActionBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F7F5" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0F4A2F",
    paddingHorizontal: 12,
    paddingTop: 50,
    paddingBottom: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    flex: 1,
    textAlign: "center",
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
  },

  // Card Styles
  card: {
    flexDirection: "row",
    backgroundColor: "#FFF",
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    overflow: "hidden",
  },
  cardContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  infoBtn: {
    width: 56,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F0FDF4",
    borderLeftWidth: 1,
    borderLeftColor: "#E5E7EB",
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E6F4EC",
    justifyContent: "center",
    alignItems: "center",
  },
  siteName: { fontSize: 15, fontWeight: "700", color: "#0F2D1C" },
  siteMeta: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  emptyContainer: { alignItems: "center", marginTop: 60, gap: 10 },
  empty: { textAlign: "center", color: "#6B7280", fontSize: 14 },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "85%",
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F2D1C",
  },
  modalLoading: {
    padding: 40,
    alignItems: "center",
    gap: 10,
  },
  loadingText: { color: "#6B7280", fontSize: 14 },
  modalScroll: {
    padding: 20,
  },
  siteDetailName: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F2D1C",
    marginBottom: 8,
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 20,
  },
  statusBadgeText: { fontSize: 11, fontWeight: "700" },
  detailSection: {
    marginBottom: 20,
  },
  detailSectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6B7280",
    textTransform: "uppercase",
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F9FAFB",
  },
  detailLabel: {
    fontSize: 14,
    color: "#4B5563",
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F2D1C",
    textAlign: "right",
    flex: 1,
    marginLeft: 10,
  },
  modalActionBtn: {
    marginHorizontal: 20,
    marginTop: 10,
    backgroundColor: "#0F4A2F",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  modalActionBtnText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 15,
  },
});
