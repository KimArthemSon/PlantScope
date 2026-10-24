import { useRouter, useLocalSearchParams } from "expo-router";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  Image,
  RefreshControl,
  StatusBar,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/constants/url_fixed";
import { useNetworkStatus } from "@/utils/networkStatus";
import { useAlert, ToastHost } from "@/components/AlertContext";
import { getToken, clearAuthData, isAuthFailure } from "@/utils/auth";

const API_BASE = api;
const OFFLINE_SITES_KEY = "@plantscope_offline_sites";

/* ──────────────────────────────────────────────────────────────────
   DESIGN TOKENS (shared look with Assigned Areas)
   ─────────────────────────────────────────────────────────────── */
const BG = "#F5F6F8";
const PRIMARY = "#0F4A2F";
const PRIMARY_SOFT = "#E8F1EC";
const INK = "#111827";
const MUTED = "#6B7280";
const FAINT = "#9CA3AF";
const LINE = "#EEF0F3";
const RED = "#EF4444";

const cardShadow = {
  shadowColor: "#0F172A",
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.04,
  shadowRadius: 8,
  elevation: 1,
};

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  accepted: { label: "Accepted", color: "#15803D", bg: "#DCFCE7" },
  pending: { label: "Pending", color: "#B45309", bg: "#FEF3C7" },
  under_review: { label: "Under Review", color: "#1D4ED8", bg: "#DBEAFE" },
  rejected: { label: "Rejected", color: "#B91C1C", bg: "#FEE2E2" },
};

const MONITORING_LABEL: Record<string, string> = {
  available: "Available",
  reserved: "Reserved",
  under_monitoring: "Under monitoring",
  completed: "Completed",
  failed: "Failed",
  onhold: "On hold",
};

type FilterKey = "all" | "accepted" | "pending" | "rejected" | "unassessed";

/* ──────────────────────────────────────────────────────────────────
   HELPERS
   ─────────────────────────────────────────────────────────────── */
const getSiteId = (site: any) =>
  site?.site_id != null ? String(site.site_id) : "";

const statusStyle = (status?: string) =>
  STATUS_STYLE[status || ""] || {
    label: status ? status.replace(/_/g, " ") : "Unknown",
    color: MUTED,
    bg: "#F3F4F6",
  };

const formatHa = (ha: any) => {
  const n = Number(ha);
  return isFinite(n) && n > 0 ? `${n.toFixed(2)} ha` : "— ha";
};

const timeAgo = (iso?: string | null) => {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  if (isNaN(diff)) return null;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return mins < 1 ? "just now" : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatDate = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso.replace(" ", "T"));
  return isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
};

/* ──────────────────────────────────────────────────────────────────
   SCREEN
   ─────────────────────────────────────────────────────────────── */
export default function SelectSite() {
  const { areaId, areaName } = useLocalSearchParams<{
    areaId: string;
    areaName: string;
  }>();

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isOnline = useNetworkStatus();
  const { success, error: showError, warning, confirm } = useAlert();

  const [sites, setSites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showingSaved, setShowingSaved] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");

  // All saved sites (every area), keyed by site id
  const [offlineSites, setOfflineSites] = useState<Map<string, any>>(new Map());
  const [savingOffline, setSavingOffline] = useState<string | null>(null);

  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [selectedSiteInfo, setSelectedSiteInfo] = useState<any>(null);
  const [loadingInfo, setLoadingInfo] = useState(false);

  /* ── Offline storage ─────────────────────────────────────────── */
  const readSaved = async (): Promise<Map<string, any>> => {
    const map = new Map<string, any>();
    try {
      const saved = await AsyncStorage.getItem(OFFLINE_SITES_KEY);
      if (saved) {
        (JSON.parse(saved) as any[]).forEach((site) => {
          const id = getSiteId(site);
          if (id) map.set(id, site);
        });
      }
    } catch (e) {
      console.error("Error loading offline sites:", e);
    }
    return map;
  };

  const writeSaved = async (map: Map<string, any>) => {
    setOfflineSites(new Map(map));
    await AsyncStorage.setItem(
      OFFLINE_SITES_KEY,
      JSON.stringify(Array.from(map.values())),
    );
  };

  // Saved sites that belong to this area. Older saves have no area tag,
  // so they're still shown to avoid hiding anything the user saved.
  const savedForThisArea = (map: Map<string, any>) =>
    Array.from(map.values()).filter(
      (s) =>
        s.reforestation_area_id == null ||
        String(s.reforestation_area_id) === String(areaId),
    );

  const saveSiteForOffline = async (site: any) => {
    const siteId = getSiteId(site);
    if (!siteId) return;
    setSavingOffline(siteId);
    try {
      const map = await readSaved();
      map.set(siteId, {
        ...site,
        reforestation_area_id: areaId,
        reforestation_area_name: areaName,
      });
      await writeSaved(map);
      success("Saved", `${site.name} is now available offline.`);
    } catch (e) {
      showError("Error", "Failed to save site for offline use.");
    } finally {
      setSavingOffline(null);
    }
  };

  const removeSiteFromOffline = (site: any) => {
    const siteId = getSiteId(site);
    if (!siteId) return;
    confirm(
      "Remove from Offline",
      `Remove "${site.name}" from offline storage?`,
      async () => {
        setSavingOffline(siteId);
        try {
          const map = await readSaved();
          map.delete(siteId);
          await writeSaved(map);
          success("Removed", `${site.name} removed from offline storage.`);
        } catch (e) {
          showError("Error", "Failed to remove site.");
        } finally {
          setSavingOffline(null);
        }
      },
      { type: "error", confirmText: "Remove", cancelText: "Cancel" },
    );
  };

  /* ── Data loading ────────────────────────────────────────────── */
  const goToLogin = async () => {
    await clearAuthData();
    router.replace("/homepage");
  };

  const showSavedSites = (map: Map<string, any>, message: string | null) => {
    const list = savedForThisArea(map);
    setSites(list);
    setShowingSaved(true);
    setError(list.length ? message : "No sites from this area are saved for offline use. Go online and save sites first.");
  };

  const fetchSites = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const saved = await readSaved();
      setOfflineSites(saved);

      try {
        const net = await NetInfo.fetch();
        if (!net.isConnected) {
          showSavedSites(saved, null);
          return;
        }

        const token = await getToken();
        if (!token) {
          await goToLogin();
          return;
        }

        const res = await fetch(`${API_BASE}/api/list_sites/${areaId}/`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (isAuthFailure(res.status)) {
          await goToLogin();
          return;
        }
        if (!res.ok) throw new Error(`Couldn't load sites (error ${res.status}).`);

        const data = await res.json();
        const list: any[] = data.data || [];
        setSites(list);
        setShowingSaved(false);

        // Refresh saved copies of this area's sites with the latest data
        let changed = false;
        list.forEach((site) => {
          const id = getSiteId(site);
          if (id && saved.has(id)) {
            saved.set(id, {
              ...site,
              reforestation_area_id: areaId,
              reforestation_area_name: areaName,
            });
            changed = true;
          }
        });
        if (changed) await writeSaved(saved);
      } catch (e: any) {
        console.error("Error fetching sites:", e);
        showSavedSites(saved, "Couldn't reach the server. Showing saved sites.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [areaId, areaName],
  );

  useEffect(() => {
    fetchSites();
  }, [fetchSites, isOnline]);

  /* ── Actions ─────────────────────────────────────────────────── */
  const handleSelectSite = (site: any) => {
    const siteId = getSiteId(site);
    if (!siteId) return;
    setInfoModalVisible(false);
    router.push({
      pathname: "/feedbacks/site_field_assessment",
      params: { areaId, areaName, siteId, siteName: site.name },
    });
  };

  const handleViewInfo = async (site: any) => {
    const net = await NetInfo.fetch();
    if (!net.isConnected) {
      warning("Offline Mode", "Site details are not available offline.");
      return;
    }

    setSelectedSiteInfo({ ...site, _partial: true });
    setLoadingInfo(true);
    setInfoModalVisible(true);

    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/api/get_site/${getSiteId(site)}/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedSiteInfo({ ...site, ...data });
      } else {
        showError("Error", "Failed to load site information.");
        setInfoModalVisible(false);
      }
    } catch (e) {
      showError("Error", "Network error.");
      setInfoModalVisible(false);
    } finally {
      setLoadingInfo(false);
    }
  };

  /* ── Derived data ────────────────────────────────────────────── */
  const summary = useMemo(() => {
    const totalHa = sites.reduce((sum, s) => sum + (Number(s.area_hectares) || 0), 0);
    const assessed = sites.filter((s) => (s.assessment_count || 0) > 0).length;
    const saved = sites.filter((s) => offlineSites.has(getSiteId(s))).length;
    return { totalHa, assessed, saved };
  }, [sites, offlineSites]);

  const counts: Record<FilterKey, number> = {
    all: sites.length,
    accepted: sites.filter((s) => s.status === "accepted").length,
    pending: sites.filter((s) => s.status === "pending" || s.status === "under_review").length,
    rejected: sites.filter((s) => s.status === "rejected").length,
    unassessed: sites.filter((s) => !s.assessment_count).length,
  };

  const FILTERS: { key: FilterKey; label: string }[] = [
    { key: "all", label: "All" },
    { key: "accepted", label: "Accepted" },
    { key: "pending", label: "Pending" },
    { key: "rejected", label: "Rejected" },
    { key: "unassessed", label: "Not assessed" },
  ];

  const visibleSites = sites.filter((s) => {
    if (search.trim() && !(s.name || "").toLowerCase().includes(search.trim().toLowerCase()))
      return false;
    switch (filter) {
      case "accepted":
        return s.status === "accepted";
      case "pending":
        return s.status === "pending" || s.status === "under_review";
      case "rejected":
        return s.status === "rejected";
      case "unassessed":
        return !s.assessment_count;
      default:
        return true;
    }
  });

  /* ── Render pieces ───────────────────────────────────────────── */
  const renderSite = ({ item }: { item: any }) => {
    const siteId = getSiteId(item);
    const isSaved = offlineSites.has(siteId);
    const isSaving = savingOffline === siteId;
    const st = statusStyle(item.status);
    const assessed = item.assessment_count || 0;
    const last = timeAgo(item.last_assessed_at);
    const monitoring = MONITORING_LABEL[item.monitoring_status];

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => handleSelectSite(item)}
        activeOpacity={0.75}
      >
        <View style={styles.cardTop}>
          <View style={styles.siteIcon}>
            <MaterialCommunityIcons name="map-marker-radius" size={20} color={PRIMARY} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.nameRow}>
              <Text style={styles.siteName} numberOfLines={1}>
                {item.name}
              </Text>
              {item.is_pinned && (
                <Ionicons name="star" size={13} color="#F59E0B" />
              )}
            </View>
            <View style={styles.badgeRow}>
              <View style={[styles.badge, { backgroundColor: st.bg }]}>
                <Text style={[styles.badgeText, { color: st.color }]}>{st.label}</Text>
              </View>
              {isSaved && (
                <View style={[styles.badge, { backgroundColor: PRIMARY_SOFT }]}>
                  <Ionicons name="cloud-done" size={11} color={PRIMARY} />
                  <Text style={[styles.badgeText, { color: PRIMARY }]}>Offline</Text>
                </View>
              )}
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={FAINT} />
        </View>

        <View style={styles.factRow}>
          <View style={styles.fact}>
            <MaterialCommunityIcons name="texture-box" size={14} color={MUTED} />
            <Text style={styles.factText}>{formatHa(item.area_hectares)}</Text>
          </View>
          {!!monitoring && (
            <View style={styles.fact}>
              <MaterialCommunityIcons name="eye-outline" size={14} color={MUTED} />
              <Text style={styles.factText}>{monitoring}</Text>
            </View>
          )}
          <View style={styles.fact}>
            <MaterialCommunityIcons name="clipboard-text-outline" size={14} color={MUTED} />
            <Text style={styles.factText}>
              {assessed} assessment{assessed === 1 ? "" : "s"}
            </Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.footerText} numberOfLines={1}>
            {last ? `Last assessed ${last}` : "Not assessed yet"}
          </Text>
          <View style={styles.footerActions}>
            <TouchableOpacity
              style={[styles.smallBtn, !isOnline && styles.smallBtnDisabled]}
              onPress={() => handleViewInfo(item)}
              disabled={!isOnline || !siteId}
              hitSlop={6}
            >
              <Ionicons
                name="information-circle-outline"
                size={18}
                color={isOnline ? PRIMARY : FAINT}
              />
            </TouchableOpacity>
            {isOnline && !!siteId && (
              <TouchableOpacity
                style={[styles.smallBtn, isSaved && styles.smallBtnDanger]}
                onPress={() =>
                  isSaved ? removeSiteFromOffline(item) : saveSiteForOffline(item)
                }
                disabled={isSaving}
                hitSlop={6}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color={isSaved ? RED : PRIMARY} />
                ) : (
                  <Ionicons
                    name={isSaved ? "trash-outline" : "cloud-download-outline"}
                    size={17}
                    color={isSaved ? RED : PRIMARY}
                  />
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const ListHeader = (
    <>
      {/* Summary */}
      {sites.length > 0 && (
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryValue}>{sites.length}</Text>
              <Text style={styles.summaryLabel}>Sites</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryStat}>
              <Text style={styles.summaryValue}>{summary.totalHa.toFixed(1)}</Text>
              <Text style={styles.summaryLabel}>Hectares</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryStat}>
              <Text style={styles.summaryValue}>
                {summary.assessed}/{sites.length}
              </Text>
              <Text style={styles.summaryLabel}>Assessed</Text>
            </View>
          </View>
          <View style={styles.summaryFoot}>
            <Ionicons name="cloud-done-outline" size={13} color="#B7D3C6" />
            <Text style={styles.summaryFootText}>
              {summary.saved} of {sites.length} saved for offline
            </Text>
          </View>
        </View>
      )}

      {/* Inline notice (e.g. showing saved sites after a network error) */}
      {!!error && sites.length > 0 && (
        <View style={styles.notice}>
          <Ionicons name="information-circle-outline" size={16} color="#92400E" />
          <Text style={styles.noticeText}>{error}</Text>
        </View>
      )}

      {/* Search */}
      {sites.length > 0 && (
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={FAINT} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search sites…"
            placeholderTextColor={FAINT}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={18} color={FAINT} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Filters */}
      {sites.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
          style={{ marginHorizontal: -16 }}
        >
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setFilter(f.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterText, active && styles.filterTextActive]}>
                  {f.label}
                </Text>
                <View style={[styles.filterCount, active && styles.filterCountActive]}>
                  <Text style={[styles.filterCountText, active && { color: "#FFF" }]}>
                    {counts[f.key]}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </>
  );

  const EmptyState =
    error && sites.length === 0 ? (
      <View style={styles.stateWrap}>
        <View style={[styles.stateIcon, { backgroundColor: isOnline ? "#FEF2F2" : "#FFFBEB" }]}>
          <MaterialCommunityIcons
            name={isOnline ? "alert-circle-outline" : "cloud-off-outline"}
            size={30}
            color={isOnline ? RED : "#F59E0B"}
          />
        </View>
        <Text style={styles.stateTitle}>
          {showingSaved ? "Nothing saved offline" : "Couldn't load sites"}
        </Text>
        <Text style={styles.stateText}>{error}</Text>
        {isOnline && (
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchSites()}>
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        )}
      </View>
    ) : (
      <View style={styles.stateWrap}>
        <View style={[styles.stateIcon, { backgroundColor: "#F3F4F6" }]}>
          <MaterialCommunityIcons name="map-marker-off-outline" size={30} color={FAINT} />
        </View>
        <Text style={styles.stateTitle}>
          {sites.length ? "No matching sites" : "No sites yet"}
        </Text>
        <Text style={styles.stateText}>
          {sites.length
            ? "Try a different search or filter."
            : "No sites have been created for this area yet. You can still do a General Assessment for the whole area."}
        </Text>
      </View>
    );

  /* ── Info modal content ──────────────────────────────────────── */
  const info = selectedSiteInfo;
  const infoStatus = statusStyle(info?.status);
  const potential = info?.potential_sites?.[0];
  const infoRows = info
    ? [
        { icon: "layers", label: "Reforestation area", value: info.reforestation_area_name || areaName || "—" },
        { icon: "resize", label: "Size", value: formatHa(info.area_hectares) },
        { icon: "eye", label: "Monitoring", value: MONITORING_LABEL[info.monitoring_status] || "—" },
        {
          icon: "shield-checkmark",
          label: "Meta verification",
          value: info.meta_verification?.status
            ? String(info.meta_verification.status).replace(/_/g, " ")
            : info.verification_status || "pending",
        },
        {
          icon: "map",
          label: "Land classification",
          value: info.meta_verification?.verified_land_classification_name || "—",
        },
        {
          icon: "leaf",
          label: "NDVI / Suitability",
          value: potential
            ? `${potential.avg_ndvi != null ? Number(potential.avg_ndvi).toFixed(2) : "—"} / ${
                potential.suitability_score != null ? Number(potential.suitability_score).toFixed(1) : "—"
              }`
            : "—",
        },
        {
          icon: "clipboard",
          label: "Assessments",
          value: `${info.assessment_count || 0} total · ${info.submitted_count || 0} submitted`,
        },
        { icon: "calendar", label: "Created", value: formatDate(info.created_at) },
      ]
    : [];

  /* ── Main render ─────────────────────────────────────────────── */
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={INK} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>Specific Site Assessment</Text>
          <Text style={styles.title} numberOfLines={1}>
            {areaName || "Select Site"}
          </Text>
        </View>
      </View>

      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline-outline" size={16} color="#92400E" />
          <View style={{ flex: 1 }}>
            <Text style={styles.offlineTitle}>You're offline</Text>
            <Text style={styles.offlineText}>
              Showing sites you saved from this area. Details are from your last sync.
            </Text>
          </View>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={styles.loadingText}>Loading sites…</Text>
        </View>
      ) : (
        <FlatList
          data={visibleSites}
          keyExtractor={(item, i) => getSiteId(item) || `site-${i}`}
          renderItem={renderSite}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={EmptyState}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchSites(true)}
              colors={[PRIMARY]}
              tintColor={PRIMARY}
              enabled={isOnline}
            />
          }
        />
      )}

      {/* Site info sheet */}
      <Modal
        visible={infoModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setInfoModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.dragHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeading}>Site details</Text>
              <TouchableOpacity onPress={() => setInfoModalVisible(false)} hitSlop={8}>
                <Ionicons name="close" size={24} color={MUTED} />
              </TouchableOpacity>
            </View>

            {info && (
              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                {info.main_image_url ? (
                  <Image source={{ uri: info.main_image_url }} style={styles.heroImage} />
                ) : null}

                <Text style={styles.modalTitle}>{info.name}</Text>
                <View style={[styles.badgeRow, { marginBottom: 10 }]}>
                  <View style={[styles.badge, { backgroundColor: infoStatus.bg }]}>
                    <Text style={[styles.badgeText, { color: infoStatus.color }]}>
                      {infoStatus.label}
                    </Text>
                  </View>
                  {offlineSites.has(getSiteId(info)) && (
                    <View style={[styles.badge, { backgroundColor: PRIMARY_SOFT }]}>
                      <Ionicons name="cloud-done" size={11} color={PRIMARY} />
                      <Text style={[styles.badgeText, { color: PRIMARY }]}>Saved offline</Text>
                    </View>
                  )}
                </View>

                {!!info.description && <Text style={styles.modalDesc}>{info.description}</Text>}

                {loadingInfo ? (
                  <View style={styles.modalLoading}>
                    <ActivityIndicator color={PRIMARY} />
                    <Text style={styles.loadingText}>Loading details…</Text>
                  </View>
                ) : (
                  <>
                    <View style={styles.infoCard}>
                      {infoRows.map((row, i) => (
                        <View
                          key={row.label}
                          style={[styles.infoRow, i === infoRows.length - 1 && { borderBottomWidth: 0 }]}
                        >
                          <View style={styles.infoIcon}>
                            <Ionicons name={row.icon as any} size={14} color={PRIMARY} />
                          </View>
                          <Text style={styles.infoLabel}>{row.label}</Text>
                          <Text style={styles.infoValue} numberOfLines={2}>
                            {row.value}
                          </Text>
                        </View>
                      ))}
                    </View>

                    {info.species_recommendations?.length > 0 && (
                      <>
                        <Text style={styles.modalSection}>Recommended species</Text>
                        <View style={styles.chipWrap}>
                          {info.species_recommendations.map((sp: any) => (
                            <View key={sp.id} style={styles.speciesChip}>
                              <Text style={styles.speciesRank}>#{sp.rank}</Text>
                              <Text style={styles.speciesName}>{sp.name}</Text>
                            </View>
                          ))}
                        </View>
                      </>
                    )}

                    {info.permits?.length > 0 && (
                      <>
                        <Text style={styles.modalSection}>Permits & documents</Text>
                        {info.permits.map((p: any) => (
                          <View key={p.permit_id} style={styles.permitRow}>
                            <Ionicons name="document-text-outline" size={16} color={MUTED} />
                            <Text style={styles.permitText} numberOfLines={1}>
                              {p.document_type || "Document"}
                            </Text>
                            <Text style={styles.permitDate}>{formatDate(p.uploaded_at)}</Text>
                          </View>
                        ))}
                      </>
                    )}
                  </>
                )}
                <View style={{ height: 12 }} />
              </ScrollView>
            )}

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setInfoModalVisible(false)}
              >
                <Text style={styles.closeBtnText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.startBtn}
                onPress={() => info && handleSelectSite(info)}
              >
                <Ionicons name="clipboard-outline" size={16} color="#FFF" />
                <Text style={styles.startBtnText}>Assess this site</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        <ToastHost />
      </Modal>
    </View>
  );
}

/* ──────────────────────────────────────────────────────────────────
   STYLES
   ─────────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: BG,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    ...cardShadow,
  },
  eyebrow: { fontSize: 12, color: MUTED, fontWeight: "600", letterSpacing: 0.2 },
  title: { fontSize: 22, fontWeight: "800", color: INK, letterSpacing: -0.3 },

  offlineBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    padding: 12,
    borderRadius: 14,
    marginHorizontal: 16,
    marginBottom: 4,
  },
  offlineTitle: { fontSize: 13, fontWeight: "700", color: "#92400E" },
  offlineText: { fontSize: 12, color: "#A16207", marginTop: 2, lineHeight: 17 },

  listContent: { paddingHorizontal: 16, paddingTop: 8, flexGrow: 1 },

  // Summary
  summaryCard: {
    backgroundColor: PRIMARY,
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    ...cardShadow,
  },
  summaryRow: { flexDirection: "row", alignItems: "center" },
  summaryStat: { flex: 1 },
  summaryValue: { fontSize: 24, fontWeight: "800", color: "#FFF", letterSpacing: -0.4 },
  summaryLabel: { fontSize: 11.5, color: "rgba(255,255,255,0.55)", fontWeight: "600", marginTop: 2 },
  summaryDivider: {
    width: 1,
    height: 30,
    backgroundColor: "rgba(255,255,255,0.14)",
    marginHorizontal: 12,
  },
  summaryFoot: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  summaryFootText: { fontSize: 12, color: "rgba(255,255,255,0.75)", fontWeight: "600" },

  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFBEB",
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  noticeText: { flex: 1, fontSize: 12, color: "#92400E" },

  // Search + filters
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 46,
    ...cardShadow,
  },
  searchInput: { flex: 1, fontSize: 14, color: INK, fontWeight: "500" },
  filterRow: { paddingHorizontal: 16, gap: 8, paddingTop: 12, paddingBottom: 14 },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: LINE,
  },
  filterChipActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  filterText: { fontSize: 12.5, fontWeight: "600", color: MUTED },
  filterTextActive: { color: "#FFFFFF" },
  filterCount: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  filterCountActive: { backgroundColor: "rgba(255,255,255,0.18)" },
  filterCountText: { fontSize: 11, fontWeight: "700", color: MUTED },

  // Site card
  card: { backgroundColor: "#FFFFFF", borderRadius: 18, padding: 14, ...cardShadow },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  siteIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: PRIMARY_SOFT,
    alignItems: "center",
    justifyContent: "center",
  },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  siteName: { fontSize: 15, fontWeight: "700", color: INK, flexShrink: 1 },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 5 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeText: { fontSize: 10.5, fontWeight: "700", textTransform: "capitalize" },
  factRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 12,
  },
  fact: { flexDirection: "row", alignItems: "center", gap: 5 },
  factText: { fontSize: 12, color: INK, fontWeight: "600" },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
  },
  footerText: { flex: 1, fontSize: 11.5, color: MUTED, fontWeight: "500" },
  footerActions: { flexDirection: "row", gap: 8 },
  smallBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
  },
  smallBtnDisabled: { backgroundColor: "#F9FAFB", borderColor: LINE },
  smallBtnDanger: { backgroundColor: "#FEF2F2", borderColor: "#FECACA" },

  // States
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  loadingText: { color: MUTED, fontSize: 13 },
  stateWrap: { alignItems: "center", paddingTop: 60, paddingHorizontal: 24, gap: 8 },
  stateIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  stateTitle: { fontSize: 16, fontWeight: "700", color: INK },
  stateText: { fontSize: 13, color: MUTED, textAlign: "center", lineHeight: 19 },
  retryBtn: {
    marginTop: 12,
    backgroundColor: PRIMARY,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryText: { color: "#FFF", fontWeight: "600", fontSize: 14 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "88%",
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E5E7EB",
    alignSelf: "center",
    marginTop: 10,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  modalHeading: { fontSize: 13, fontWeight: "700", color: MUTED, letterSpacing: 0.3 },
  modalScroll: { paddingHorizontal: 20 },
  heroImage: {
    width: "100%",
    height: 160,
    borderRadius: 16,
    backgroundColor: "#E5E7EB",
    marginBottom: 14,
  },
  modalTitle: { fontSize: 20, fontWeight: "800", color: INK },
  modalDesc: { fontSize: 13, color: MUTED, lineHeight: 19, marginBottom: 12 },
  modalLoading: { alignItems: "center", paddingVertical: 30, gap: 8 },
  infoCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 14,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
  },
  infoIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: PRIMARY + "12",
    alignItems: "center",
    justifyContent: "center",
  },
  infoLabel: { fontSize: 12.5, color: MUTED, fontWeight: "500", flex: 1 },
  infoValue: {
    fontSize: 13,
    color: INK,
    fontWeight: "700",
    maxWidth: "52%",
    textAlign: "right",
    textTransform: "capitalize",
  },
  modalSection: {
    fontSize: 14,
    fontWeight: "700",
    color: INK,
    marginTop: 18,
    marginBottom: 10,
  },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  speciesChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: PRIMARY_SOFT,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  speciesRank: { fontSize: 11, fontWeight: "800", color: PRIMARY },
  speciesName: { fontSize: 12, fontWeight: "600", color: INK },
  permitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
  },
  permitText: { flex: 1, fontSize: 13, color: INK, fontWeight: "500", textTransform: "capitalize" },
  permitDate: { fontSize: 11.5, color: FAINT },
  modalBtnRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  closeBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: PRIMARY,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  closeBtnText: { color: PRIMARY, fontWeight: "700", fontSize: 14 },
  startBtn: {
    flex: 2,
    flexDirection: "row",
    gap: 8,
    backgroundColor: PRIMARY,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  startBtnText: { color: "#FFF", fontWeight: "700", fontSize: 14 },
});
