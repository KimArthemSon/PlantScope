import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useFocusEffect } from "expo-router";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Image,
  FlatList,
  RefreshControl,
  ScrollView,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/constants/url_fixed";
import { useAlert } from "@/components/AlertContext";

const BG = "#F4F7F5";
const PRIMARY = "#0F4A2F";
const INK = "#111827";
const MUTED = "#6B7280";
const FAINT = "#9CA3AF";
const YELLOW = "#F59E0B";
const WHITE = "#FFFFFF";
const BORDER = "#E5E7EB";

const cardShadow = {
  shadowColor: "#0F172A",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 10,
  elevation: 2,
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
  monitoring_status: "available" | "reserved";
  main_image_url: string | null;
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

const formatListed = (raw: string) => {
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
};

const resolveUrl = (url: string) => (url.startsWith("http") ? url : `${api}${url}`);

/* ──────────────────────────────────────────────────────────────────
   HEADER
   ──────────────────────────────────────────────────────────────── */
const SitesHeader: React.FC<{
  search: string;
  setSearch: (v: string) => void;
  onSearch: (value?: string) => void;
  unreadCount: number;
  total: number;
  loading: boolean;
}> = ({ search, setSearch, onSearch, unreadCount, total, loading }) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const badgeText = unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <View style={[hdr.wrap, { paddingTop: insets.top + 12 }]}>
      <View style={hdr.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={hdr.eyebrow}>Reforestation</Text>
          <Text style={hdr.title}>Explore Sites</Text>
          <Text style={hdr.subtitle}>
            {loading ? "Finding sites near you…" : `${total} ${total === 1 ? "site" : "sites"} open for tree growers`}
          </Text>
        </View>
        <TouchableOpacity
          style={hdr.iconBtn}
          activeOpacity={0.7}
          onPress={() => router.push("/tree_growers/notifications" as any)}
        >
          <Ionicons name="notifications-outline" size={20} color={WHITE} />
          {unreadCount > 0 && (
            <View style={hdr.badge}>
              <Text style={hdr.badgeText}>{badgeText}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <View style={hdr.searchPill}>
        <Ionicons name="search" size={18} color={MUTED} />
        <TextInput
          style={hdr.searchInput}
          placeholder="Search by site or area name…"
          value={search}
          onChangeText={setSearch}
          placeholderTextColor={FAINT}
          onSubmitEditing={() => onSearch()}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity
            onPress={() => {
              setSearch("");
              onSearch("");
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={18} color={FAINT} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

/* ──────────────────────────────────────────────────────────────────
   QUICK APPLY / ONGOING APPLICATION
   ──────────────────────────────────────────────────────────────── */
const QuickApplyCard: React.FC<{ onPress: () => void; hasOngoingApplication: boolean }> = ({
  onPress,
  hasOngoingApplication,
}) => {
  if (hasOngoingApplication) {
    return (
      <View style={qa.lockedCard}>
        <View style={qa.lockedIcon}>
          <Ionicons name="hourglass-outline" size={20} color={YELLOW} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={qa.lockedTitle}>Application in progress</Text>
          <Text style={qa.lockedText}>
            You can browse sites, but new applications are locked until your current one is processed.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <TouchableOpacity style={qa.card} onPress={onPress} activeOpacity={0.88}>
      <View style={qa.iconWrap}>
        <Ionicons name="sparkles" size={20} color={WHITE} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={qa.title}>Not sure which site?</Text>
        <Text style={qa.text}>Apply without choosing — ENRO will assign the best available site.</Text>
      </View>
      <View style={qa.cta}>
        <Text style={qa.ctaText}>Quick Apply</Text>
        <Ionicons name="arrow-forward" size={14} color={PRIMARY} />
      </View>
    </TouchableOpacity>
  );
};

/* ──────────────────────────────────────────────────────────────────
   BARANGAY CHIPS
   ──────────────────────────────────────────────────────────────── */
const BarangayChips: React.FC<{
  barangays: Barangay[];
  selected: string;
  onSelect: (name: string) => void;
}> = ({ barangays, selected, onSelect }) => (
  <View style={chips.wrap}>
    <View style={chips.labelRow}>
      <Ionicons name="location-outline" size={14} color={MUTED} />
      <Text style={chips.label}>Filter by barangay</Text>
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={chips.row}>
      {[{ barangay_id: 0, name: "" } as Barangay, ...barangays].map((b) => {
        const active = selected === b.name;
        return (
          <TouchableOpacity
            key={b.barangay_id}
            style={[chips.chip, active && chips.chipActive]}
            onPress={() => onSelect(b.name)}
            activeOpacity={0.75}
          >
            {active && b.name !== "" && <Ionicons name="checkmark" size={13} color={WHITE} />}
            <Text style={[chips.chipText, active && chips.chipTextActive]}>{b.name || "All"}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  </View>
);

/* ──────────────────────────────────────────────────────────────────
   SITE CARD
   ──────────────────────────────────────────────────────────────── */
const SiteCard = ({ item, onViewDetails }: { item: Site; onViewDetails: (site: Site) => void }) => {
  const imageUrl = item.main_image_url
    ? resolveUrl(item.main_image_url)
    : item.images && item.images.length > 0
      ? resolveUrl(item.images[0].url)
      : null;

  const available = item.monitoring_status === "available";
  const photoCount = item.images?.length || 0;

  return (
    <TouchableOpacity style={card.wrap} activeOpacity={0.92} onPress={() => onViewDetails(item)}>
      <View style={card.imageBox}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={card.image} resizeMode="cover" />
        ) : (
          <View style={[card.image, card.placeholder]}>
            <Ionicons name="image-outline" size={34} color="#CBD5E1" />
            <Text style={card.placeholderText}>No photo yet</Text>
          </View>
        )}

        <View style={[card.status, { backgroundColor: available ? "#ECFDF5" : "#FFFBEB" }]}>
          <View style={[card.statusDot, { backgroundColor: available ? "#10B981" : YELLOW }]} />
          <Text style={[card.statusText, { color: available ? "#047857" : "#B45309" }]}>
            {available ? "Available" : "Reserved · Queue open"}
          </Text>
        </View>

        {item.is_pinned && (
          <View style={card.pinned}>
            <Ionicons name="star" size={11} color="#FDE68A" />
            <Text style={card.pinnedText}>Featured</Text>
          </View>
        )}

        {photoCount > 1 && (
          <View style={card.photoCount}>
            <Ionicons name="images-outline" size={11} color={WHITE} />
            <Text style={card.photoCountText}>{photoCount}</Text>
          </View>
        )}
      </View>

      <View style={card.body}>
        <Text style={card.name} numberOfLines={1}>{item.name}</Text>
        <View style={card.locationRow}>
          <Ionicons name="location" size={13} color={PRIMARY} />
          <Text style={card.location} numberOfLines={1}>
            Brgy. {item.barangay} · {item.reforestation_area}
          </Text>
        </View>

        <View style={card.footer}>
          <View style={card.metaRow}>
            <View style={card.meta}>
              <Ionicons name="resize-outline" size={13} color={MUTED} />
              <Text style={card.metaText}>{item.total_area_hectares.toFixed(2)} ha</Text>
            </View>
            <View style={card.meta}>
              <Ionicons name="calendar-outline" size={13} color={MUTED} />
              <Text style={card.metaText}>{formatListed(item.created_at)}</Text>
            </View>
          </View>
          <View style={card.viewBtn}>
            <Text style={card.viewBtnText}>View</Text>
            <Ionicons name="arrow-forward" size={14} color={WHITE} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

/* ──────────────────────────────────────────────────────────────────
   BACK TO TOP
   ──────────────────────────────────────────────────────────────── */
const BackToTopButton: React.FC<{ scrollY: Animated.Value; onScrollToTop: () => void }> = ({
  scrollY,
  onScrollToTop,
}) => {
  const opacity = scrollY.interpolate({ inputRange: [300, 400], outputRange: [0, 1], extrapolate: "clamp" });
  const scale = scrollY.interpolate({ inputRange: [300, 400], outputRange: [0.8, 1], extrapolate: "clamp" });
  return (
    <Animated.View style={[styles.backToTopContainer, { opacity, transform: [{ scale }] }]}>
      <TouchableOpacity style={styles.backToTopButton} onPress={onScrollToTop} activeOpacity={0.8}>
        <Ionicons name="chevron-up" size={22} color={WHITE} />
      </TouchableOpacity>
    </Animated.View>
  );
};

/* ──────────────────────────────────────────────────────────────────
   MAIN SITES SCREEN
   ──────────────────────────────────────────────────────────────── */
export default function Sites() {
  const router = useRouter();
  const { error: showError } = useAlert();
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
      } catch (e) {}
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
    } catch (err) {}
  };

  const fetchSites = async (
    pageNum: number = 1,
    isRefresh = false,
    isLoadMore = false,
    currentSearch = search,
    currentBarangay = selectedBarangay,
    silent = false,
  ) => {
    try {
      if (silent) {
        // background reload: keep the current list on screen
      } else if (isRefresh) setRefreshing(true);
      else if (isLoadMore) setLoadingMore(true);
      else setLoading(true);

      const token = await SecureStore.getItemAsync("token");
      if (!token) throw new Error("No authentication token found.");

      const params = new URLSearchParams({ page: pageNum.toString(), entries: "10" });
      if (currentSearch.trim()) params.append("search", currentSearch.trim());
      if (currentBarangay) params.append("barangay", currentBarangay);

      const res = await fetch(`${api}/api/get_available_sites_for_tree_grower/?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch sites");

      if (isLoadMore) setSites((prev) => [...prev, ...(data.data || [])]);
      else setSites(data.data || []);

      setHasMore(data.has_next || false);
      setTotal(data.total || 0);
      setHasOngoingApplication(data.has_ongoing_application === true);
      setPage(pageNum);
    } catch (err: any) {
      if (!silent) showError("Couldn't load sites", err.message);
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

  // Tabs keep this screen mounted. Reload quietly whenever it regains focus
  // so sites that were re-opened (made available again) show up right away.
  const filtersRef = useRef({ search, selectedBarangay });
  filtersRef.current = { search, selectedBarangay };
  const hasFocusedOnce = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!hasFocusedOnce.current) {
        hasFocusedOnce.current = true; // initial load handled above
        return;
      }
      const { search: q, selectedBarangay: b } = filtersRef.current;
      fetchSites(1, false, false, q, b, true);
    }, []),
  );

  const handleSearch = (value: string = search) => {
    setPage(1);
    setSites([]);
    fetchSites(1, false, false, value, selectedBarangay);
  };
  const handleBarangayFilter = (barangay: string) => {
    if (barangay === selectedBarangay) return;
    setSelectedBarangay(barangay);
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
    if (!loadingMore && !loading && hasMore) fetchSites(page + 1, false, true, search, selectedBarangay);
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

  const handleScrollToTop = () => flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  const handleScroll = Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
    useNativeDriver: false,
  });

  const hasFilters = !!search.trim() || !!selectedBarangay;

  const renderFooter = () => {
    if (loadingMore) {
      return (
        <View style={styles.footer}>
          <ActivityIndicator size="small" color={PRIMARY} />
        </View>
      );
    }
    if (!loading && sites.length > 0 && !hasMore) {
      return <Text style={styles.endText}>You've seen all {total} sites</Text>;
    }
    return null;
  };

  const renderEmpty = () => {
    if (loading) {
      return (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={styles.loadingText}>Loading sites…</Text>
        </View>
      );
    }
    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIcon}>
          <Ionicons name={hasFilters ? "search-outline" : "map-outline"} size={30} color={PRIMARY} />
        </View>
        <Text style={styles.emptyTitle}>{hasFilters ? "No matching sites" : "No sites available yet"}</Text>
        <Text style={styles.emptySubtitle}>
          {hasFilters
            ? "Try another barangay or search term."
            : "New reforestation sites are added regularly — check back soon."}
        </Text>
        {hasFilters && (
          <TouchableOpacity style={styles.clearFiltersButton} onPress={clearFilters}>
            <Ionicons name="refresh" size={14} color={WHITE} />
            <Text style={styles.clearFiltersText}>Clear filters</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={sites}
        renderItem={({ item }) => <SiteCard item={item} onViewDetails={handleViewDetails} />}
        keyExtractor={(item) => item.site_id.toString()}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={PRIMARY} />}
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
              unreadCount={unreadCount}
              total={total}
              loading={loading}
            />
            <View style={styles.headerBody}>
              <QuickApplyCard
                hasOngoingApplication={hasOngoingApplication}
                onPress={() => router.push("/tree_growers/Reapply")}
              />
              <BarangayChips
                barangays={availableBarangays}
                selected={selectedBarangay}
                onSelect={handleBarangayFilter}
              />
              {!loading && sites.length > 0 && (
                <View style={styles.resultsRow}>
                  <Text style={styles.resultsText}>
                    {hasFilters ? "Results" : "All sites"}
                    <Text style={styles.resultsCount}>  {total}</Text>
                  </Text>
                  {hasFilters && (
                    <TouchableOpacity onPress={clearFilters} hitSlop={8}>
                      <Text style={styles.resultsClear}>Clear</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          </>
        }
        onScroll={handleScroll}
        scrollEventThrottle={16}
      />
      <BackToTopButton scrollY={scrollY} onScrollToTop={handleScrollToTop} />
    </View>
  );
}

/* ──────────────────────────────────────────────────────────────────
   STYLES
   ──────────────────────────────────────────────────────────────── */
const hdr = StyleSheet.create({
  wrap: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 20,
    paddingBottom: 46,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    marginHorizontal: -16,
  },
  topRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 18 },
  eyebrow: { fontSize: 11, fontWeight: "700", color: "rgba(255,255,255,0.65)", textTransform: "uppercase", letterSpacing: 1 },
  title: { fontSize: 28, fontWeight: "800", color: WHITE, letterSpacing: -0.5, marginTop: 2 },
  subtitle: { fontSize: 13, color: "rgba(255,255,255,0.8)", marginTop: 3 },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  badge: {
    position: "absolute",
    top: 2,
    right: 2,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: "#EF4444",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: PRIMARY,
  },
  badgeText: { color: WHITE, fontSize: 9, fontWeight: "800" },
  searchPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: WHITE,
    paddingHorizontal: 14,
    height: 48,
    borderRadius: 14,
    gap: 10,
  },
  searchInput: { flex: 1, fontSize: 14.5, color: INK, paddingVertical: 0 },
});

const qa = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: WHITE,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#D1FAE5",
    ...cardShadow,
  },
  iconWrap: { width: 42, height: 42, borderRadius: 13, backgroundColor: PRIMARY, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 14.5, fontWeight: "800", color: INK },
  text: { fontSize: 12, color: MUTED, marginTop: 2, lineHeight: 16 },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
  },
  ctaText: { fontSize: 12, fontWeight: "800", color: PRIMARY },

  lockedCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFBEB",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  lockedIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: "#FEF3C7", justifyContent: "center", alignItems: "center" },
  lockedTitle: { fontSize: 14.5, fontWeight: "800", color: "#92400E" },
  lockedText: { fontSize: 12, color: "#A16207", marginTop: 2, lineHeight: 16 },
});

const chips = StyleSheet.create({
  wrap: { marginTop: 18 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 8 },
  label: { fontSize: 12, fontWeight: "700", color: MUTED, textTransform: "uppercase", letterSpacing: 0.5 },
  row: { gap: 8, paddingRight: 16 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: BORDER,
  },
  chipActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  chipText: { fontSize: 13, fontWeight: "600", color: INK },
  chipTextActive: { color: WHITE },
});

const card = StyleSheet.create({
  wrap: { marginBottom: 16, borderRadius: 20, backgroundColor: WHITE, overflow: "hidden", ...cardShadow },
  imageBox: { height: 170, position: "relative" },
  image: { width: "100%", height: "100%" },
  placeholder: { backgroundColor: "#F1F5F9", justifyContent: "center", alignItems: "center", gap: 4 },
  placeholderText: { fontSize: 12, color: FAINT, fontWeight: "600" },
  status: {
    position: "absolute",
    top: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 11, fontWeight: "800" },
  pinned: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: "rgba(15,74,47,0.88)",
  },
  pinnedText: { fontSize: 11, fontWeight: "800", color: WHITE },
  photoCount: {
    position: "absolute",
    bottom: 10,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  photoCountText: { fontSize: 11, fontWeight: "700", color: WHITE },
  body: { padding: 14 },
  name: { fontSize: 17, fontWeight: "800", color: INK, letterSpacing: -0.2 },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  location: { fontSize: 13, color: MUTED, flex: 1 },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 14, flex: 1 },
  meta: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 12, fontWeight: "600", color: "#374151" },
  viewBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: PRIMARY,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  viewBtnText: { fontSize: 13, fontWeight: "800", color: WHITE },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  listContent: { paddingHorizontal: 16, paddingBottom: 110 },
  headerBody: { marginTop: -28 },
  resultsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 20,
    marginBottom: 12,
  },
  resultsText: { fontSize: 16, fontWeight: "800", color: INK },
  resultsCount: { fontSize: 14, fontWeight: "700", color: FAINT },
  resultsClear: { fontSize: 13, fontWeight: "700", color: PRIMARY },
  footer: { paddingVertical: 16, alignItems: "center" },
  endText: { textAlign: "center", fontSize: 12, color: FAINT, paddingVertical: 12 },
  loadingBox: { alignItems: "center", marginTop: 60, gap: 10 },
  loadingText: { fontSize: 13, color: MUTED },

  emptyState: { alignItems: "center", marginTop: 50, paddingHorizontal: 24 },
  emptyIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#ECFDF5",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  emptyTitle: { fontSize: 17, fontWeight: "800", color: INK },
  emptySubtitle: { fontSize: 13, color: MUTED, textAlign: "center", marginTop: 4, lineHeight: 18 },
  clearFiltersButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: PRIMARY,
    borderRadius: 12,
  },
  clearFiltersText: { color: WHITE, fontSize: 13, fontWeight: "700" },

  backToTopContainer: { position: "absolute", bottom: 100, right: 20, zIndex: 10 },
  backToTopButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
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
