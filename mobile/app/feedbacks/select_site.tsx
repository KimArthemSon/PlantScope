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
  // ❌ REMOVED: Alert
} from "react-native";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/constants/url_fixed";
import { useNetworkStatus } from "@/utils/networkStatus";

// ✅ ADDED: Import the useAlert hook
import { useAlert } from "@/components/AlertContext";

const API_BASE = api;
const OFFLINE_SITES_KEY = "@plantscope_offline_sites";

// ✅ Helper to safely get site ID as string
const getSiteId = (site: any) =>
  site?.site_id != null ? String(site.site_id) : "";

export default function SelectSite() {
  const { areaId, areaName } = useLocalSearchParams<{
    areaId: string;
    areaName: string;
  }>();

  const router = useRouter();
  const isOnline = useNetworkStatus();

  // ✅ ADDED: Initialize useAlert. We alias 'error' to 'showError' to avoid conflicting with your 'error' state variable.
  const { success, error: showError, warning, info, confirm } = useAlert();

  const [sites, setSites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Store full site objects
  const [offlineSites, setOfflineSites] = useState<Map<string, any>>(new Map());
  const [savingOffline, setSavingOffline] = useState<string | null>(null);

  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [selectedSiteInfo, setSelectedSiteInfo] = useState<any>(null);
  const [loadingInfo, setLoadingInfo] = useState(false);

  // Load saved offline sites on mount
  useEffect(() => {
    loadOfflineSites();
  }, []);

  // Fetch sites when online status changes or area changes
  useEffect(() => {
    fetchSites();
  }, [areaId, isOnline]);

  const loadOfflineSites = async () => {
    try {
      const saved = await AsyncStorage.getItem(OFFLINE_SITES_KEY);
      if (saved) {
        const sitesArray: any[] = JSON.parse(saved);
        const sitesMap = new Map<string, any>();
        sitesArray.forEach((site) => {
          const id = getSiteId(site);
          if (id) {
            sitesMap.set(id, site);
          }
        });
        setOfflineSites(sitesMap);
      }
    } catch (error) {
      console.error("Error loading offline sites:", error);
    }
  };

  const saveSiteForOffline = async (site: any) => {
    const siteId = getSiteId(site);
    if (!siteId) return;

    setSavingOffline(siteId);
    try {
      const newMap = new Map(offlineSites);
      newMap.set(siteId, site);
      setOfflineSites(newMap);

      const sitesArray = Array.from(newMap.values());
      await AsyncStorage.setItem(OFFLINE_SITES_KEY, JSON.stringify(sitesArray));

      // ✅ UPDATED
      success("Success", `${site.name} saved for offline use.`);
    } catch (error) {
      // ✅ UPDATED
      showError("Error", "Failed to save site for offline use.");
    } finally {
      setSavingOffline(null);
    }
  };

  // ✅ UPDATED: Converted to use confirm() dialog.
  const removeSiteFromOffline = (site: any) => {
    const siteId = getSiteId(site);
    if (!siteId) return;

    confirm(
      "Remove from Offline",
      `Remove "${site.name}" from offline storage?`,
      async () => {
        setSavingOffline(siteId);
        try {
          const newMap = new Map(offlineSites);
          newMap.delete(siteId);
          setOfflineSites(newMap);

          const sitesArray = Array.from(newMap.values());
          await AsyncStorage.setItem(
            OFFLINE_SITES_KEY,
            JSON.stringify(sitesArray),
          );

          // ✅ UPDATED
          success("Removed", `${site.name} removed from offline storage.`);
        } catch (error) {
          // ✅ UPDATED
          showError("Error", "Failed to remove site.");
        } finally {
          setSavingOffline(null);
        }
      },
      {
        type: "error",
        confirmText: "Remove",
        cancelText: "Cancel",
      },
    );
  };

  // ✅ FIXED: Check network status directly instead of relying on state
  const fetchSites = async () => {
    setLoading(true);
    setError(null);

    try {
      // ✅ Get current network status directly
      const networkState = await NetInfo.fetch();
      const actuallyOnline = networkState.isConnected === true;

      if (actuallyOnline) {
        // ✅ ONLINE: Fetch from API
        const token = await SecureStore.getItemAsync("token");
        if (!token) throw new Error("No authentication token found.");

        const res = await fetch(`${API_BASE}/api/list_sites/${areaId}/`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        const sitesList = data.data || [];
        setSites(sitesList);
      } else {
        // ✅ OFFLINE: Directly read from AsyncStorage
        const saved = await AsyncStorage.getItem(OFFLINE_SITES_KEY);

        if (saved) {
          const savedSites: any[] = JSON.parse(saved);
          setSites(savedSites);
        } else {
          setSites([]);
          setError(
            "No sites saved for offline use. Please go online and save sites first.",
          );
        }
      }
    } catch (e: any) {
      console.error("Error fetching sites:", e);

      // If online and failed, try offline fallback
      const networkState = await NetInfo.fetch();
      if (networkState.isConnected) {
        const saved = await AsyncStorage.getItem(OFFLINE_SITES_KEY);
        if (saved) {
          const savedSites: any[] = JSON.parse(saved);
          setSites(savedSites);
          setError("Network error. Showing saved sites.");
        } else {
          setError(e.message || "Failed to load sites.");
          setSites([]);
        }
      } else {
        setError(e.message || "Failed to load sites.");
        setSites([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSite = (site: any) => {
    const siteId = getSiteId(site);
    if (!siteId) return;

    router.push({
      pathname: "/feedbacks/site_field_assessment",
      params: {
        areaId,
        areaName,
        siteId: siteId,
        siteName: site.name,
      },
    });
  };

  const handleViewInfo = async (siteId: number) => {
    // ✅ Check network status directly
    const networkState = await NetInfo.fetch();
    if (!networkState.isConnected) {
      // ✅ UPDATED
      warning("Offline Mode", "Site details are not available offline.");
      return;
    }

    setLoadingInfo(true);
    setInfoModalVisible(true);

    try {
      const token = await SecureStore.getItemAsync("token");
      const res = await fetch(`${API_BASE}/api/get_site/${siteId}/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedSiteInfo(data);
      } else {
        // ✅ UPDATED
        showError("Error", "Failed to load site information.");
        setInfoModalVisible(false);
      }
    } catch (e) {
      // ✅ UPDATED
      showError("Error", "Network error.");
      setInfoModalVisible(false);
    } finally {
      setLoadingInfo(false);
    }
  };

  if (loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0F4A2F" />
      </View>
    );

  return (
    <View style={styles.container}>
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline-outline" size={16} color="#FFFFFF" />
          <Text style={styles.offlineBannerText}>
            Offline Mode - Saved Sites Only
          </Text>
        </View>
      )}

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          Select Site in {areaName}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {error && sites.length === 0 && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
          {isOnline && (
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => fetchSites()}
            >
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <FlatList
        data={sites}
        keyExtractor={(item) => getSiteId(item) || Math.random().toString()}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => {
          const siteId = getSiteId(item);
          const isSaved = siteId ? offlineSites.has(siteId) : false;
          const isSaving = savingOffline === siteId;

          return (
            <View style={styles.card}>
              <TouchableOpacity
                style={styles.cardContent}
                onPress={() => handleSelectSite(item)}
                activeOpacity={0.7}
              >
                <View style={styles.iconWrap}>
                  <Ionicons name="location" size={20} color="#0F4A2F" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.siteHeaderRow}>
                    <Text style={styles.siteName}>{item.name}</Text>
                    {isSaved && (
                      <View style={styles.savedBadge}>
                        <Ionicons name="download" size={10} color="#0F4A2F" />
                        <Text style={styles.savedBadgeText}>Saved</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.siteMeta}>
                    {item.area_hectares?.toFixed(2)} ha • Status: {item.status}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </TouchableOpacity>

              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={[styles.infoBtn, !isOnline && styles.infoBtnDisabled]}
                  onPress={() => handleViewInfo(parseInt(siteId))}
                  disabled={!isOnline || !siteId}
                >
                  <Ionicons
                    name="information-circle-outline"
                    size={20}
                    color={!isOnline ? "#9CA3AF" : "#0F4A2F"}
                  />
                </TouchableOpacity>

                {isOnline && siteId && (
                  <TouchableOpacity
                    style={[
                      styles.offlineBtn,
                      isSaved ? styles.removeOfflineBtn : styles.saveOfflineBtn,
                      isSaving && { opacity: 0.6 },
                    ]}
                    onPress={() =>
                      isSaved
                        ? removeSiteFromOffline(item)
                        : saveSiteForOffline(item)
                    }
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <ActivityIndicator
                        size="small"
                        color={isSaved ? "#EF4444" : "#0F4A2F"}
                      />
                    ) : (
                      <Ionicons
                        name={isSaved ? "trash-outline" : "download-outline"}
                        size={16}
                        color={isSaved ? "#EF4444" : "#0F4A2F"}
                      />
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          !error && (
            <View style={styles.emptyContainer}>
              <Ionicons name="alert-circle-outline" size={40} color="#9CA3AF" />
              <Text style={styles.empty}>
                {isOnline
                  ? "No sites created for this area yet."
                  : "No sites saved for offline use."}
              </Text>
            </View>
          )
        }
      />

      {/* Modal */}
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
              </View>
            ) : selectedSiteInfo ? (
              <ScrollView style={styles.modalScroll}>
                <Text style={styles.siteDetailName}>
                  {selectedSiteInfo.name}
                </Text>
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
  offlineBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F59E0B",
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 8,
  },
  offlineBannerText: { color: "#FFFFFF", fontSize: 12, fontWeight: "600" },
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
  errorContainer: { alignItems: "center", padding: 40, gap: 12 },
  errorText: { color: "#EF4444", textAlign: "center", fontSize: 14 },
  retryBtn: {
    backgroundColor: "#0F4A2F",
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryText: { color: "#FFF", fontWeight: "700" },
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
  siteHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  savedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  savedBadgeText: { fontSize: 9, fontWeight: "700", color: "#0F4A2F" },
  cardActions: {
    flexDirection: "column",
    borderLeftWidth: 1,
    borderLeftColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
  },
  infoBtn: {
    width: 50,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  infoBtnDisabled: { backgroundColor: "#F3F4F6" },
  offlineBtn: {
    width: 50,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
  },
  saveOfflineBtn: { backgroundColor: "#F0FDF4" },
  removeOfflineBtn: { backgroundColor: "#FEF2F2" },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E6F4EC",
    justifyContent: "center",
    alignItems: "center",
  },
  siteName: { fontSize: 15, fontWeight: "700", color: "#0F2D1C", flex: 1 },
  siteMeta: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  emptyContainer: { alignItems: "center", marginTop: 60, gap: 10 },
  empty: { textAlign: "center", color: "#6B7280", fontSize: 14 },
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
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#0F2D1C" },
  modalLoading: { padding: 40, alignItems: "center" },
  modalScroll: { padding: 20 },
  siteDetailName: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F2D1C",
    marginBottom: 8,
  },
  modalActionBtn: {
    marginHorizontal: 20,
    marginTop: 10,
    backgroundColor: "#0F4A2F",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  modalActionBtnText: { color: "#FFF", fontWeight: "700", fontSize: 15 },
});
