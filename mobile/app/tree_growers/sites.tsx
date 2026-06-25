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
const IMAGE_WIDTH = SCREEN_WIDTH - (CARD_PADDING * 2);

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

// ✅ SiteCard component
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
      <View style={styles.imageContainer}>
        {item.images && item.images.length > 0 ? (
          <>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                const index = Math.round(
                  e.nativeEvent.contentOffset.x / IMAGE_WIDTH
                );
                setCurrentImageIndex(index);
              }}
            >
              {item.images.map((img) => (
                <View key={img.image_id} style={styles.carouselImageWrapper}>
                  <Image
                    source={{
                      uri: img.url.startsWith("http")
                        ? img.url
                        : `${api}${img.url}`,
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
            <Ionicons name="images-outline" size={48} color="#9CA3AF" />
            <Text style={styles.placeholderText}>No images available</Text>
          </View>
        )}

        {item.is_pinned && (
          <View style={styles.pinnedBadge}>
            <Ionicons name="star" size={12} color="#F59E0B" />
            <Text style={styles.pinnedText}>Pinned</Text>
          </View>
        )}

        <View style={styles.verifiedBadge}>
          <Ionicons name="checkmark-circle" size={14} color="#10B981" />
          <Text style={styles.verifiedText}>Available</Text>
        </View>
      </View>

      <View style={styles.cardContent}>
        <Text style={styles.siteName} numberOfLines={2}>
          {item.name}
        </Text>

        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={14} color="#6B7280" />
          <Text style={styles.locationText} numberOfLines={1}>
            {item.barangay}, {item.reforestation_area}
          </Text>
        </View>

        <View style={styles.metricsRow}>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>
              {item.total_area_hectares.toFixed(2)}
            </Text>
            <Text style={styles.metricLabel}>Hectares</Text>
          </View>

          <View style={styles.metricDivider} />

          <View style={styles.metric}>
            <Text style={styles.metricValue}>
              {item.ndvi_value !== null ? item.ndvi_value.toFixed(2) : "N/A"}
            </Text>
            <Text style={styles.metricLabel}>NDVI Score</Text>
          </View>
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.viewDetailsButton}
            activeOpacity={0.7}
            onPress={() => onViewDetails(item)}
          >
            <Ionicons name="eye-outline" size={16} color="#0F4A2F" />
            <Text style={styles.viewDetailsText}>View Details</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.applyButton,
              hasOngoingApplication && styles.applyButtonDisabled,
            ]}
            activeOpacity={hasOngoingApplication ? 1 : 0.7}
            onPress={() => onApply(item)}
            disabled={hasOngoingApplication}
          >
            {hasOngoingApplication ? (
              <>
                <Ionicons name="lock-closed" size={14} color="#9CA3AF" />
                <Text style={styles.applyButtonTextDisabled}>Locked</Text>
              </>
            ) : (
              <>
                <Text style={styles.applyButtonText}>Apply</Text>
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
  
  // ✅ Data states
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  
  // ✅ Filter states
  const [search, setSearch] = useState("");
  const [selectedBarangay, setSelectedBarangay] = useState("");
  const [availableBarangays, setAvailableBarangays] = useState<Barangay[]>([]);
  const [showBarangayDropdown, setShowBarangayDropdown] = useState(false);
  
  // ✅ Pagination states
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  
  // ✅ Ongoing application state
  const [hasOngoingApplication, setHasOngoingApplication] = useState(false);

  // ✅ Fetch barangays from dedicated endpoint
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

  // ✅ FIXED: Accept filter values as parameters to avoid stale state
  const fetchSites = async (
    pageNum: number = 1, 
    isRefresh: boolean = false, 
    isLoadMore: boolean = false,
    currentSearch: string = search, 
    currentBarangay: string = selectedBarangay
  ) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else if (isLoadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      const token = await SecureStore.getItemAsync("token");
      if (!token) throw new Error("No authentication token found.");

      const params = new URLSearchParams({
        page: pageNum.toString(),
        entries: "10",
      });

      // ✅ Use the passed parameters instead of state variables
      if (currentSearch.trim()) {
        params.append("search", currentSearch.trim());
      }

      if (currentBarangay) {
        params.append("barangay", currentBarangay);
      }

      const res = await fetch(
        `${api}/api/get_available_sites_for_tree_grower/?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch sites");
      }

      // ✅ Update data
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

  // ✅ Initial load - fetch both barangays and sites
  useEffect(() => {
    fetchBarangays();
    fetchSites(1, false, false, "", "");
  }, []);

  // ✅ FIXED: Pass current values explicitly
  const handleSearch = () => {
    setPage(1);
    setSites([]);
    fetchSites(1, false, false, search, selectedBarangay);
  };

  // ✅ FIXED: Pass the NEW barangay value directly to fetchSites
  const handleBarangayFilter = (barangay: string) => {
    setSelectedBarangay(barangay);
    setShowBarangayDropdown(false);
    setPage(1);
    setSites([]);
    // Pass 'barangay' (the new value) instead of 'selectedBarangay' (the old state)
    fetchSites(1, false, false, search, barangay); 
  };

  // ✅ FIXED: Pass empty strings to clear filters
  const clearFilters = () => {
    setSearch("");
    setSelectedBarangay("");
    setPage(1);
    setSites([]);
    fetchSites(1, false, false, "", "");
  };

  // ✅ FIXED: Pass current values
  const handleRefresh = () => {
    setPage(1);
    fetchSites(1, true, false, search, selectedBarangay);
  };

  // ✅ FIXED: Pass current values
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
      Alert.alert(
        "Cannot Apply",
        "You already have an ongoing application. Please wait for it to be completed or rejected before applying to a new site.",
        [{ text: "OK" }],
      );
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

  // ✅ Render footer for loading more
  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color="#0F4A2F" />
        <Text style={styles.footerText}>Loading more sites...</Text>
      </View>
    );
  };

  // ✅ Render empty state
  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyState}>
        <Ionicons name="map-outline" size={64} color="#D1D5DB" />
        <Text style={styles.emptyTitle}>
          {search || selectedBarangay ? "No sites found" : "No available sites"}
        </Text>
        <Text style={styles.emptySubtitle}>
          {search || selectedBarangay
            ? "Try adjusting your filters"
            : "Check back later for new planting sites in your area."}
        </Text>
        {(search || selectedBarangay) && (
          <TouchableOpacity style={styles.clearFiltersButton} onPress={clearFilters}>
            <Text style={styles.clearFiltersText}>Clear Filters</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {hasOngoingApplication && (
        <View style={styles.ongoingBanner}>
          <Ionicons name="information-circle" size={18} color="#F59E0B" />
          <Text style={styles.ongoingBannerText}>
            You have an ongoing application. You can browse sites but cannot apply.
          </Text>
        </View>
      )}

      {/* ✅ Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
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
          <TouchableOpacity onPress={() => { setSearch(""); handleSearch(); }}>
            <Ionicons name="close-circle" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>

      {/* ✅ Barangay Filter */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={styles.barangayFilterButton}
          onPress={() => setShowBarangayDropdown(!showBarangayDropdown)}
        >
          <Ionicons name="location-outline" size={16} color="#0F4A2F" />
          <Text style={styles.barangayFilterText}>
            {selectedBarangay || "Filter by Barangay"}
          </Text>
          <Ionicons 
            name={showBarangayDropdown ? "chevron-up" : "chevron-down"} 
            size={16} 
            color="#6B7280" 
          />
        </TouchableOpacity>

        {selectedBarangay && (
          <TouchableOpacity style={styles.clearFilterButton} onPress={() => handleBarangayFilter("")}>
            <Ionicons name="close-circle" size={18} color="#EF4444" />
          </TouchableOpacity>
        )}
      </View>

      {/* ✅ Barangay Dropdown */}
      {showBarangayDropdown && (
        <View style={styles.dropdownContainer}>
          <ScrollView style={styles.dropdownScroll} showsVerticalScrollIndicator={false}>
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
                  selectedBarangay === barangay.name && styles.dropdownItemActive,
                ]}
                onPress={() => handleBarangayFilter(barangay.name)}
              >
                <Text style={[
                  styles.dropdownItemText,
                  selectedBarangay === barangay.name && styles.dropdownItemTextActive,
                ]}>
                  {barangay.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ✅ Results Count */}
      {!loading && sites.length > 0 && (
        <View style={styles.resultsCount}>
          <Text style={styles.resultsCountText}>
            Showing {sites.length} of {total} sites
          </Text>
        </View>
      )}

      {/* ✅ Sites List with Infinite Scroll */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0F4A2F" />
          <Text style={styles.loadingText}>Loading available sites...</Text>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F7F5" },

  ongoingBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF3C7",
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#F59E0B",
  },
  ongoingBannerText: {
    flex: 1,
    fontSize: 12,
    color: "#92400E",
    fontWeight: "600",
  },

  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, color: "#111827" },

  filterContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 8,
    gap: 8,
  },
  barangayFilterButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 8,
  },
  barangayFilterText: {
    flex: 1,
    fontSize: 14,
    color: "#111827",
  },
  clearFilterButton: {
    padding: 8,
  },

  dropdownContainer: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    maxHeight: 200,
    overflow: "hidden",
  },
  dropdownScroll: {
    paddingVertical: 4,
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dropdownItemActive: {
    backgroundColor: "#F0FDF4",
  },
  dropdownItemText: {
    fontSize: 14,
    color: "#111827",
  },
  dropdownItemTextActive: {
    color: "#0F4A2F",
    fontWeight: "600",
  },

  resultsCount: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  resultsCountText: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
  },

  listContent: { paddingHorizontal: 16, paddingBottom: 32 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 12, color: "#6B7280", fontSize: 14 },

  footer: {
    paddingVertical: 20,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  footerText: {
    fontSize: 14,
    color: "#6B7280",
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    marginBottom: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  
  imageContainer: { 
    position: "relative", 
    height: 220 
  },
  carouselImageWrapper: {
    width: IMAGE_WIDTH,
    height: 220,
  },
  cardImage: { 
    width: "100%", 
    height: "100%" 
  },
  pagination: {
    position: "absolute",
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  activeDot: {
    width: 18,
    borderRadius: 3,
    backgroundColor: "#fff",
  },
  
  placeholderImage: {
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: {
    color: "#9CA3AF",
    fontSize: 12,
    marginTop: 8,
  },
  
  pinnedBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  pinnedText: { fontSize: 11, fontWeight: "700", color: "#F59E0B" },
  verifiedBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  verifiedText: { fontSize: 11, fontWeight: "700", color: "#10B981" },
  cardContent: { padding: 16 },
  siteName: {
    fontSize: 17,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 6,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 14,
  },
  locationText: { fontSize: 13, color: "#6B7280", flex: 1 },
  metricsRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  metric: { flex: 1, alignItems: "center" },
  metricValue: { fontSize: 16, fontWeight: "800", color: "#0F4A2F" },
  metricLabel: { fontSize: 11, color: "#6B7280", marginTop: 2 },
  metricDivider: { width: 1, height: 32, backgroundColor: "#E5E7EB" },

  buttonRow: { flexDirection: "row", gap: 8 },
  viewDetailsButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#0F4A2F",
    gap: 6,
  },
  viewDetailsText: { color: "#0F4A2F", fontSize: 14, fontWeight: "700" },
  applyButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0F4A2F",
    paddingVertical: 14,
    borderRadius: 12,
    gap: 6,
  },
  applyButtonDisabled: {
    backgroundColor: "#E5E7EB",
  },
  applyButtonText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  applyButtonTextDisabled: {
    color: "#9CA3AF",
    fontSize: 14,
    fontWeight: "700",
  },

  emptyState: { alignItems: "center", marginTop: 80, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#374151" },
  emptySubtitle: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    maxWidth: 250,
  },
  clearFiltersButton: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#0F4A2F",
    borderRadius: 10,
  },
  clearFiltersText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});