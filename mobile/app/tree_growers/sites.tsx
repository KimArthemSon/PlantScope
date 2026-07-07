import React, { useState, useEffect } from "react";
import { useRouter } from "expo-router";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
  FlatList,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  Dimensions,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/constants/url_fixed";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_PADDING = 16;
const IMAGE_WIDTH = SCREEN_WIDTH - CARD_PADDING * 2;

interface SiteImage {
  image_id: number;
  url: string;
  caption: string | null;
}

interface Site {
  site_id: number;
  name: string;
  reforestation_area: string;
  barangay: string;
  total_area_hectares: number;
  ndvi_value: number | null;
  images: SiteImage[];
  is_pinned: boolean;
  created_at: string;
}

interface Barangay {
  barangay_id: number;
  name: string;
  description: string | null;
  coordinate: any;
}

// ✅ Compact & Modern SiteCard Component
const SiteCard = ({
  item,
  hasOngoingApplication,
  onViewDetails,
  onApply,
}: {
  item: Site;
  hasOngoingApplication: boolean;
  onViewDetails: (site: Site) => void;
  onApply: (site: Site) => void;
}) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  return (
    <View style={styles.card}>
      {/* Compact Image */}
      <View style={styles.imageContainer}>
        {item.images && item.images.length > 0 ? (
          <>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                const index = Math.round(
                  e.nativeEvent.contentOffset.x / IMAGE_WIDTH,
                );
                setCurrentImageIndex(index);
              }}
            >
              {item.images.map((img) => (
                <View key={img.image_id} style={styles.carouselImageWrapper}>
                  <Image
                    source={{
                      uri: img.url.startsWith("http") ? img.url : `${img.url}`,
                    }}
                    style={styles.cardImage}
                    resizeMode="cover"
                  />
                </View>
              ))}
            </ScrollView>

            {item.images.length > 1 && (
              <View style={styles.pagination}>
                {item.images.map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.dot,
                      index === currentImageIndex && styles.activeDot,
                    ]}
                  />
                ))}
              </View>
            )}
          </>
        ) : (
          <View style={[styles.cardImage, styles.placeholderImage]}>
            <Ionicons name="images-outline" size={32} color="#CBD5E1" />
          </View>
        )}

        {/* Status Badge */}
        <View style={styles.statusBadge}>
          <Ionicons name="checkmark-circle" size={12} color="#10B981" />
          <Text style={styles.statusText}>Available</Text>
        </View>
      </View>

      {/* Content */}
      <View style={styles.cardContent}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={styles.siteName} numberOfLines={1}>
              {item.name}
            </Text>
            {item.is_pinned && (
              <Ionicons name="star" size={14} color="#F59E0B" />
            )}
          </View>
          <View style={styles.locationRow}>
            <Ionicons name="location" size={12} color="#6B7280" />
            <Text style={styles.locationText} numberOfLines={1}>
              {item.barangay}, {item.reforestation_area}
            </Text>
          </View>
        </View>

        {/* Compact Metrics */}
        <View style={styles.metricsRow}>
          <View style={styles.metricItem}>
            <Ionicons name="leaf-outline" size={14} color="#059669" />
            <Text style={styles.metricValue}>
              {item.total_area_hectares.toFixed(2)}
            </Text>
            <Text style={styles.metricLabel}>hectares</Text>
          </View>

          <View style={styles.metricDivider} />

          <View style={styles.metricItem}>
            <Ionicons name="analytics-outline" size={14} color="#2563EB" />
            <Text style={styles.metricValue}>
              {item.ndvi_value !== null ? item.ndvi_value.toFixed(2) : "N/A"}
            </Text>
            <Text style={styles.metricLabel}>NDVI</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.btnDetails}
            activeOpacity={0.7}
            onPress={() => onViewDetails(item)}
          >
            <Ionicons name="eye-outline" size={16} color="#0F4A2F" />
            <Text style={styles.btnDetailsText}>Details</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.btnApply,
              hasOngoingApplication && styles.btnApplyDisabled,
            ]}
            activeOpacity={hasOngoingApplication ? 1 : 0.7}
            onPress={() => onApply(item)}
            disabled={hasOngoingApplication}
          >
            {hasOngoingApplication ? (
              <Ionicons name="lock-closed" size={16} color="#9CA3AF" />
            ) : (
              <>
                <Text style={styles.btnApplyText}>Apply</Text>
                <Ionicons name="arrow-forward" size={16} color="#fff" />
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default function Sites() {
  const router = useRouter();

  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedBarangay, setSelectedBarangay] = useState("");
  const [availableBarangays, setAvailableBarangays] = useState<Barangay[]>([]);
  const [showBarangayDropdown, setShowBarangayDropdown] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasOngoingApplication, setHasOngoingApplication] = useState(false);

  const fetchBarangays = async () => {
    try {
      const token = await SecureStore.getItemAsync("token");
      if (!token) return;

      const res = await fetch(`${api}/api/get_barangay_list/`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setAvailableBarangays(data.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch barangays:", err);
    }
  };

  const fetchSites = async (
    pageNum: number = 1,
    isRefresh: boolean = false,
    isLoadMore: boolean = false,
    currentSearch: string = search,
    currentBarangay: string = selectedBarangay,
  ) => {
    try {
      if (isRefresh) setRefreshing(true);
      else if (isLoadMore) setLoadingMore(true);
      else setLoading(true);

      const token = await SecureStore.getItemAsync("token");
      if (!token) throw new Error("No authentication token found.");

      const params = new URLSearchParams({
        page: pageNum.toString(),
        entries: "10",
      });

      if (currentSearch.trim()) params.append("search", currentSearch.trim());
      if (currentBarangay) params.append("barangay", currentBarangay);

      const res = await fetch(
        `${api}/api/get_available_sites_for_tree_grower/?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch sites");

      if (isLoadMore) {
        setSites((prev) => [...prev, ...(data.data || [])]);
      } else {
        setSites(data.data || []);
      }

      setHasMore(data.has_next || false);
      setTotal(data.total || 0);
      setHasOngoingApplication(data.has_ongoing_application === true);
      setPage(pageNum);
    } catch (err: any) {
      console.error("Fetch sites error:", err);
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchBarangays();
    fetchSites(1, false, false, "", "");
  }, []);

  const handleSearch = () => {
    setPage(1);
    setSites([]);
    fetchSites(1, false, false, search, selectedBarangay);
  };

  const handleBarangayFilter = (barangay: string) => {
    setSelectedBarangay(barangay);
    setShowBarangayDropdown(false);
    setPage(1);
    setSites([]);
    fetchSites(1, false, false, search, barangay);
  };

  const clearFilters = () => {
    setSearch("");
    setSelectedBarangay("");
    setPage(1);
    setSites([]);
    fetchSites(1, false, false, "", "");
  };

  const handleRefresh = () => {
    setPage(1);
    fetchSites(1, true, false, search, selectedBarangay);
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      fetchSites(page + 1, false, true, search, selectedBarangay);
    }
  };

  const handleViewDetails = (site: Site) => {
    router.push({
      pathname: "/tree_growers/siteDetails",
      params: {
        site_id: site.site_id.toString(),
        has_ongoing: hasOngoingApplication ? "true" : "false",
      },
    });
  };

  const handleApply = (site: Site) => {
    if (hasOngoingApplication) {
      Alert.alert("Cannot Apply", "You already have an ongoing application.", [
        { text: "OK" },
      ]);
      return;
    }

    router.push({
      pathname: "/tree_growers/Reapply",
      params: {
        site_id: site.site_id.toString(),
        site_name: site.name,
      },
    });
  };

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color="#0F4A2F" />
      </View>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyState}>
        <Ionicons name="map-outline" size={48} color="#D1D5DB" />
        <Text style={styles.emptyTitle}>
          {search || selectedBarangay ? "No sites found" : "No available sites"}
        </Text>
        <Text style={styles.emptySubtitle}>
          {search || selectedBarangay
            ? "Try adjusting your filters"
            : "Check back later for new sites"}
        </Text>
        {(search || selectedBarangay) && (
          <TouchableOpacity
            style={styles.clearFiltersButton}
            onPress={clearFilters}
          >
            <Text style={styles.clearFiltersText}>Clear Filters</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {hasOngoingApplication && (
        <View style={styles.banner}>
          <Ionicons name="information-circle" size={16} color="#F59E0B" />
          <Text style={styles.bannerText}>You have an ongoing application</Text>
        </View>
      )}

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color="#9CA3AF" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search sites..."
          value={search}
          onChangeText={setSearch}
          placeholderTextColor="#9CA3AF"
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity
            onPress={() => {
              setSearch("");
              handleSearch();
            }}
          >
            <Ionicons name="close-circle" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowBarangayDropdown(!showBarangayDropdown)}
        >
          <Ionicons name="funnel-outline" size={16} color="#0F4A2F" />
          <Text style={styles.filterText}>
            {selectedBarangay || "All Barangays"}
          </Text>
          <Ionicons
            name={showBarangayDropdown ? "chevron-up" : "chevron-down"}
            size={16}
            color="#6B7280"
          />
        </TouchableOpacity>

        {selectedBarangay && (
          <TouchableOpacity onPress={() => handleBarangayFilter("")}>
            <Ionicons name="close-circle" size={18} color="#EF4444" />
          </TouchableOpacity>
        )}
      </View>

      {/* Dropdown */}
      {showBarangayDropdown && (
        <View style={styles.dropdownContainer}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <TouchableOpacity
              style={styles.dropdownItem}
              onPress={() => handleBarangayFilter("")}
            >
              <Text style={styles.dropdownItemText}>All Barangays</Text>
            </TouchableOpacity>
            {availableBarangays.map((barangay) => (
              <TouchableOpacity
                key={barangay.barangay_id}
                style={[
                  styles.dropdownItem,
                  selectedBarangay === barangay.name &&
                    styles.dropdownItemActive,
                ]}
                onPress={() => handleBarangayFilter(barangay.name)}
              >
                <Text
                  style={[
                    styles.dropdownItemText,
                    selectedBarangay === barangay.name &&
                      styles.dropdownItemTextActive,
                  ]}
                >
                  {barangay.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Results Count */}
      {!loading && sites.length > 0 && (
        <Text style={styles.resultsText}>
          Showing {sites.length} of {total} sites
        </Text>
      )}

      {/* List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0F4A2F" />
        </View>
      ) : (
        <FlatList
          data={sites}
          renderItem={({ item }) => (
            <SiteCard
              item={item}
              hasOngoingApplication={hasOngoingApplication}
              onViewDetails={handleViewDetails}
              onApply={handleApply}
            />
          )}
          keyExtractor={(item) => item.site_id.toString()}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#0F4A2F"
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmpty}
        />
      )}
    </SafeAreaView>
  );
}

// ✅ COMPACT & MODERN STYLES
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F5F5" },

  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFBEB",
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  bannerText: {
    fontSize: 12,
    color: "#92400E",
    fontWeight: "500",
  },

  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 5,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: "#111" },

  filterContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 8,
    gap: 8,
  },
  filterButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 8,
  },
  filterText: {
    flex: 1,
    fontSize: 13,
    color: "#111",
  },

  dropdownContainer: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    maxHeight: 180,
  },
  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dropdownItemActive: {
    backgroundColor: "#F0FDF4",
  },
  dropdownItemText: {
    fontSize: 13,
    color: "#111",
  },
  dropdownItemTextActive: {
    color: "#0F4A2F",
    fontWeight: "600",
  },

  resultsText: {
    marginHorizontal: 16,
    marginBottom: 8,
    fontSize: 12,
    color: "#6B7280",
  },

  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  footer: {
    paddingVertical: 16,
    alignItems: "center",
  },

  // CARD - COMPACT DESIGN
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    marginBottom: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },

  imageContainer: {
    position: "relative",
    height: 140, // Reduced from 200
  },
  carouselImageWrapper: {
    width: IMAGE_WIDTH,
    height: 140,
  },
  cardImage: {
    width: "100%",
    height: "100%",
  },
  pagination: {
    position: "absolute",
    bottom: 8,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 4,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.6)",
  },
  activeDot: {
    width: 14,
    backgroundColor: "#fff",
  },

  placeholderImage: {
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },

  statusBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#10B981",
  },

  cardContent: { padding: 12 }, // Reduced padding

  header: { marginBottom: 10 },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  siteName: {
    fontSize: 15, // Reduced from 17
    fontWeight: "700",
    color: "#111",
    flex: 1,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  locationText: {
    fontSize: 11, // Reduced from 13
    color: "#6B7280",
    flex: 1,
  },

  metricsRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  metricItem: {
    flex: 1,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 4,
  },
  metricValue: {
    fontSize: 13, // Reduced from 16
    fontWeight: "700",
    color: "#0F4A2F",
  },
  metricLabel: {
    fontSize: 10, // Reduced from 11
    color: "#6B7280",
    textTransform: "lowercase",
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: "#E5E7EB",
  },

  buttonRow: {
    flexDirection: "row",
    gap: 8,
  },
  btnDetails: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
    paddingVertical: 10, // Reduced from 14
    borderRadius: 10,
    gap: 6,
  },
  btnDetailsText: {
    color: "#0F4A2F",
    fontSize: 13, // Reduced from 14
    fontWeight: "600",
  },
  btnApply: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0F4A2F",
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  btnApplyDisabled: {
    backgroundColor: "#E5E7EB",
  },
  btnApplyText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },

  emptyState: { alignItems: "center", marginTop: 80, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: "#374151" },
  emptySubtitle: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    paddingHorizontal: 32,
  },
  clearFiltersButton: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#0F4A2F",
    borderRadius: 8,
  },
  clearFiltersText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
});
