import React, { useState, useEffect, useRef } from "react";
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
  ScrollView,
  Dimensions,
  Platform,
  Animated,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/constants/url_fixed";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_PADDING = 16;
const IMAGE_WIDTH = SCREEN_WIDTH - CARD_PADDING * 2;

const BG = "#F5F6F8";
const PRIMARY = "#0F4A2F";
const INK = "#111827";
const MUTED = "#6B7280";
const FAINT = "#9CA3AF";
const YELLOW = "#F59E0B";
const WHITE = "#FFFFFF";

const cardShadow = {
  shadowColor: "#0F172A",
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.03,
  shadowRadius: 8,
  elevation: 1,
};

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

/* ──────────────────────────────────────────────────────────────────
   ANIMATED APPLICATION BADGE + MODAL
   ──────────────────────────────────────────────────────────────── */
const ApplicationBadge: React.FC = () => {
  const [expanded, setExpanded] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const animWidth = useRef(new Animated.Value(40)).current;
  const autoShrinkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePress = () => {
    if (!expanded) {
      if (autoShrinkTimer.current) clearTimeout(autoShrinkTimer.current);

      Animated.spring(animWidth, {
        toValue: 195,
        useNativeDriver: false,
        friction: 7,
        tension: 40,
      }).start();
      setExpanded(true);

      autoShrinkTimer.current = setTimeout(() => {
        Animated.spring(animWidth, {
          toValue: 40,
          useNativeDriver: false,
          friction: 8,
          tension: 50,
        }).start();
        setExpanded(false);
      }, 2500);
    } else {
      if (autoShrinkTimer.current) clearTimeout(autoShrinkTimer.current);

      setShowModal(true);

      Animated.spring(animWidth, {
        toValue: 40,
        useNativeDriver: false,
        friction: 8,
        tension: 50,
      }).start();
      setExpanded(false);
    }
  };

  return (
    <>
      <Animated.View style={[appBadge.container, { width: animWidth }]}>
        <TouchableOpacity
          onPress={handlePress}
          style={appBadge.touchable}
          activeOpacity={0.7}
        >
          <Ionicons name="time-outline" size={18} color={YELLOW} />
          {expanded && (
            <Animated.Text
              style={[
                appBadge.text,
                {
                  opacity: animWidth.interpolate({
                    inputRange: [40, 120],
                    outputRange: [0, 1],
                  }),
                },
              ]}
              numberOfLines={1}
            >
              Application in progress
            </Animated.Text>
          )}
        </TouchableOpacity>
      </Animated.View>

      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowModal(false)}
      >
        <TouchableOpacity
          style={modalStyles.overlay}
          activeOpacity={1}
          onPress={() => setShowModal(false)}
        >
          <View style={modalStyles.modalContainer}>
            <View style={modalStyles.iconContainer}>
              <Ionicons name="information-circle" size={32} color={YELLOW} />
            </View>
            <Text style={modalStyles.title}>Application in Progress</Text>
            <Text style={modalStyles.message}>
              You cannot apply for a new site because you have an ongoing
              application. Please wait for your current application to be
              processed.
            </Text>
            <TouchableOpacity
              style={modalStyles.closeButton}
              onPress={() => setShowModal(false)}
              activeOpacity={0.8}
            >
              <Text style={modalStyles.closeButtonText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

/* ─────────────────────────────────────────────────────────────────
   SITES HEADER - Spacious layout (not fixed position)
   ────────────────────────────────────────────────────────────── */
const SitesHeader: React.FC<{
  search: string;
  setSearch: (val: string) => void;
  onSearch: () => void;
  showBarangayDropdown: boolean;
  setShowBarangayDropdown: (val: boolean) => void;
  selectedBarangay: string;
  unreadCount: number;
  hasOngoingApplication: boolean;
}> = ({
  search,
  setSearch,
  onSearch,
  showBarangayDropdown,
  setShowBarangayDropdown,
  selectedBarangay,
  unreadCount,
  hasOngoingApplication,
}) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const badgeText = unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <View style={[sitesHdr.wrap, { paddingTop: insets.top + 20 }]}>
      {/* Top Row: Title + Badges */}
      <View style={sitesHdr.topRow}>
        <Text style={sitesHdr.title}>Explore Sites</Text>

        <View style={sitesHdr.rightActions}>
          {hasOngoingApplication && <ApplicationBadge />}

          <TouchableOpacity
            style={sitesHdr.iconBtn}
            activeOpacity={0.6}
            onPress={() => router.push("/(tabs)/notifications")}
          >
            <Ionicons name="notifications-outline" size={20} color={MUTED} />
            {unreadCount > 0 && (
              <View style={sitesHdr.badge}>
                <Text style={sitesHdr.badgeText}>{badgeText}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Bottom Row: Search + Filter */}
      <View style={sitesHdr.searchRow}>
        <View style={sitesHdr.searchPill}>
          <Ionicons name="search" size={18} color={MUTED} />
          <TextInput
            style={sitesHdr.searchInput}
            placeholder="Search sites..."
            value={search}
            onChangeText={setSearch}
            placeholderTextColor={FAINT}
            onSubmitEditing={onSearch}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setSearch("");
                onSearch();
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={18} color={FAINT} />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[
            sitesHdr.filterBtn,
            selectedBarangay && sitesHdr.filterBtnActive,
          ]}
          onPress={() => setShowBarangayDropdown(!showBarangayDropdown)}
          activeOpacity={0.8}
        >
          <Ionicons
            name="options-outline"
            size={20}
            color={selectedBarangay ? "#fff" : PRIMARY}
          />
          {!!selectedBarangay && <View style={sitesHdr.filterBadge} />}
        </TouchableOpacity>
      </View>
    </View>
  );
};

/* ──────────────────────────────────────────────────────────────────
   SITE CARD COMPONENT - Single image (no carousel)
   ──────────────────────────────────────────────────────────────── */
const SiteCard = ({
  item,
  onViewDetails,
}: {
  item: Site;
  onViewDetails: (site: Site) => void;
}) => {
  const firstImage =
    item.images && item.images.length > 0 ? item.images[0] : null;

  return (
    <View style={styles.card}>
      <View style={styles.imageContainer}>
        {firstImage ? (
          <Image
            source={{
              uri: firstImage.url.startsWith("http")
                ? firstImage.url
                : `${firstImage.url}`,
            }}
            style={styles.cardImage}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.cardImage, styles.placeholderImage]}>
            <Ionicons name="images-outline" size={32} color="#CBD5E1" />
          </View>
        )}

        <View style={styles.statusBadge}>
          <Ionicons name="checkmark-circle" size={12} color="#10B981" />
          <Text style={styles.statusText}>Available</Text>
        </View>

        {item.is_pinned && (
          <View style={styles.pinnedBadge}>
            <Ionicons name="star" size={12} color="#fff" />
          </View>
        )}

        <View style={styles.imageInfoOverlay}>
          <Text style={styles.overlaySiteName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.overlayLocationText} numberOfLines={1}>
            {item.barangay}, {item.reforestation_area}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.viewButton}
          onPress={() => onViewDetails(item)}
          activeOpacity={0.85}
        >
          <Text style={styles.viewButtonText}>View Details</Text>
          <Ionicons name="arrow-forward" size={16} color={PRIMARY} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

/* ─────────────────────────────────────────────────────────────────
   FLOATING BACK TO TOP BUTTON
   ──────────────────────────────────────────────────────────────── */
const BackToTopButton: React.FC<{
  scrollY: Animated.Value;
  onScrollToTop: () => void;
}> = ({ scrollY, onScrollToTop }) => {
  const opacity = scrollY.interpolate({
    inputRange: [200, 300],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const scale = scrollY.interpolate({
    inputRange: [200, 300],
    outputRange: [0.8, 1],
    extrapolate: "clamp",
  });

  return (
    <Animated.View
      style={[
        styles.backToTopContainer,
        {
          opacity,
          transform: [{ scale }],
        },
      ]}
    >
      <TouchableOpacity
        style={styles.backToTopButton}
        onPress={onScrollToTop}
        activeOpacity={0.8}
      >
        <Ionicons name="chevron-up" size={24} color={WHITE} />
      </TouchableOpacity>
    </Animated.View>
  );
};

/* ──────────────────────────────────────────────────────────────────
   MAIN SITES SCREEN
   ──────────────────────────────────────────────────────────────── */
export default function Sites() {
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);
  const scrollY = useRef(new Animated.Value(0)).current;

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
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const token = await SecureStore.getItemAsync("token");
        if (!token) return;
        const res = await fetch(`${api}/api/notifications/unread-count/`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setUnreadCount(data.unread_count || 0);
        }
      } catch (e) {
        console.error("Failed to fetch unread count:", e);
      }
    };

    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 60000);
    return () => clearInterval(interval);
  }, []);

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
    isRefresh = false,
    isLoadMore = false,
    currentSearch = search,
    currentBarangay = selectedBarangay,
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

  const handleScrollToTop = () => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: false },
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color={PRIMARY} />
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
    <View style={[styles.container]}>
      <FlatList
        ref={flatListRef}
        data={sites}
        renderItem={({ item }) => (
          <SiteCard item={item} onViewDetails={handleViewDetails} />
        )}
        keyExtractor={(item) => item.site_id.toString()}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={PRIMARY}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        ListHeaderComponent={
          <>
            <SitesHeader
              search={search}
              setSearch={setSearch}
              onSearch={handleSearch}
              showBarangayDropdown={showBarangayDropdown}
              setShowBarangayDropdown={setShowBarangayDropdown}
              selectedBarangay={selectedBarangay}
              unreadCount={unreadCount}
              hasOngoingApplication={hasOngoingApplication}
            />

            {selectedBarangay ? (
              <View style={styles.activeFilterRow}>
                <View style={styles.activeFilterChip}>
                  <Ionicons name="location" size={12} color={PRIMARY} />
                  <Text style={styles.activeFilterChipText}>
                    {selectedBarangay}
                  </Text>
                  <TouchableOpacity
                    onPress={() => handleBarangayFilter("")}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close" size={14} color={PRIMARY} />
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

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

            {!loading && sites.length > 0 && (
              <Text style={styles.resultsText}>
                Showing {sites.length} of {total} sites
              </Text>
            )}
          </>
        }
        onScroll={handleScroll}
        scrollEventThrottle={16}
      />

      {/* Floating Back to Top Button */}
      <BackToTopButton scrollY={scrollY} onScrollToTop={handleScrollToTop} />
    </View>
  );
}

/* ──────────────────────────────────────────────────────────────────
   STYLES
   ──────────────────────────────────────────────────────────── */
const sitesHdr = StyleSheet.create({
  wrap: {
    backgroundColor: BG,
    paddingHorizontal: 0,
    paddingBottom: 20,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: INK,
    letterSpacing: -0.5,
  },
  rightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    ...cardShadow,
  },
  badge: {
    position: "absolute",
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: "#EF4444",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "700",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    gap: 8,
    ...cardShadow,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: INK,
    paddingVertical: 0,
  },
  filterBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  filterBtnActive: {
    backgroundColor: PRIMARY,
  },
  filterBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: YELLOW,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
});

const appBadge = StyleSheet.create({
  container: {
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 2.5,
    borderColor: YELLOW,
    overflow: "hidden",
    shadowColor: YELLOW,
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  touchable: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    gap: 8,
  },
  text: {
    fontSize: 12,
    fontWeight: "800",
    color: YELLOW,
  },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  modalContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 320,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FEF3C7",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: INK,
    marginBottom: 12,
    textAlign: "center",
  },
  message: {
    fontSize: 14,
    color: MUTED,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  closeButton: {
    backgroundColor: YELLOW,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
    width: "100%",
  },
  closeButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  activeFilterRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 8,
  },
  activeFilterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  activeFilterChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: PRIMARY,
  },
  dropdownContainer: {
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 16,
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    maxHeight: 220,
    ...cardShadow,
  },
  dropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dropdownItemActive: {
    backgroundColor: "#F0FDF4",
  },
  dropdownItemText: {
    fontSize: 13,
    color: INK,
  },
  dropdownItemTextActive: {
    color: PRIMARY,
    fontWeight: "600",
  },
  resultsText: {
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 16,
    fontSize: 12,
    color: MUTED,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 100,
  },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  footer: {
    paddingVertical: 16,
    alignItems: "center",
  },
  card: {
    marginBottom: 24,
    borderRadius: 16,
    ...cardShadow,
    overflow: "hidden",
  },
  imageContainer: {
    position: "relative",
    height: 240,
    borderRadius: 16,
    overflow: "hidden",
  },
  cardImage: {
    width: "100%",
    height: "100%",
  },
  placeholderImage: {
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  statusBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 3,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  statusText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#10B981",
  },
  imageInfoOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 70,
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 12,
  },
  overlaySiteName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 4,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  overlayLocationText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.95)",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  pinnedBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(15, 74, 47, 0.85)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  viewButton: {
    position: "absolute",
    bottom: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: WHITE,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  viewButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: PRIMARY,
  },
  emptyState: { alignItems: "center", marginTop: 80, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: "#374151" },
  emptySubtitle: {
    fontSize: 13,
    color: MUTED,
    textAlign: "center",
    paddingHorizontal: 32,
  },
  clearFiltersButton: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: PRIMARY,
    borderRadius: 8,
  },
  clearFiltersText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  // Back to Top Button Styles
  backToTopContainer: {
    position: "absolute",
    bottom: 24,
    right: 20,
    zIndex: 10,
  },
  backToTopButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: PRIMARY,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: PRIMARY,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
