import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Dimensions,
  Alert,
  Animated,
  Modal,
  RefreshControl,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";

import { api } from "@/constants/url_fixed";

const { width, height: screenHeight } = Dimensions.get("window");

// Bottom tab bar height (standard for most React Navigation tab bars)
const TAB_BAR_HEIGHT = 80;

// Number of lines to show before truncating the description
const DESCRIPTION_LINE_LIMIT = 4;

// --- OSM / Leaflet Map Component ---
interface OsmMapProps {
  centerCoordinate: [number, number];
  polygonCoordinates: [number, number][] | null;
  title: string;
  style?: any;
}

const OsmMapComponent = ({
  centerCoordinate,
  polygonCoordinates,
  title,
  style,
}: OsmMapProps) => {
  const webViewRef = useRef<WebView>(null);

  const generateMapHtml = () => {
    const [lat, lng] = centerCoordinate || [11.0, 124.6];
    const safeLat = lat || 11.0;
    const safeLng = lng || 124.6;
    const safeTitle = title
      ? title.replace(/'/g, "\'").replace(/"/g, '\"')
      : "Site Location";

    let polygonScript = "";
    if (polygonCoordinates && polygonCoordinates.length >= 3) {
      const points = JSON.stringify(polygonCoordinates);
      polygonScript = `
        var polygon = L.polygon(${points}, {
          color: '#0F4A2F', fillColor: '#0F4A2F', fillOpacity: 0.2, weight: 2
        }).addTo(map);
        map.fitBounds(polygon.getBounds(), { padding: [50, 50] });
      `;
    }

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }
          #map { width: 100%; height: 100vh; }
          .leaflet-control-attribution { font-size: 9px; background: rgba(255,255,255,0.7); }
          .custom-div-icon { background: transparent; border: none; }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          try {
            var map = L.map('map', { zoomControl: true, attributionControl: true }).setView([${safeLat}, ${safeLng}], 15);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
              attribution: '&copy; OSM', maxZoom: 19, crossOrigin: true
            }).addTo(map);

            var greenIcon = L.divIcon({
              className: 'custom-div-icon',
              html: "<div style='background-color:#0F4A2F; width:16px; height:16px; border-radius:50%; border:3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);'></div>",
              iconSize: [16, 16], iconAnchor: [8, 8]
            });

            var marker = L.marker([${safeLat}, ${safeLng}], {icon: greenIcon}).addTo(map);
            marker.bindPopup("<b>${safeTitle}</b>").openPopup();
            ${polygonScript}
            map.scrollWheelZoom.disable();
          } catch(e) { console.error(e); }
        </script>
      </body>
      </html>
    `;
  };

  return (
    <View style={[styles.mapContainer, style]}>
      <WebView
        ref={webViewRef}
        source={{ html: generateMapHtml() }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        mixedContentMode="always"
        scrollEnabled={false}
        nestedScrollEnabled={true}
        originWhitelist={["*"]}
      />
    </View>
  );
};

// --- Main Screen Component ---
interface SiteDetails {
  site_id: number;
  name: string;
  description: string;
  reforestation_area: string;
  barangay: string;
  total_area_hectares: number;
  ndvi_value: number | null;
  center_coordinate: [number, number] | null;
  polygon_coordinates: [number, number][] | null;
  general_images: Array<{
    image_id: number;
    url: string | null;
    caption: string | null;
  }>;
  recommended_species: Array<{
    species_id: number;
    name: string;
    description: string;
    priority_rank: number;
    notes: string | null;
  }>;
  accessibility: { type: string; description: string } | null;
  land_classification: { id: number; name: string } | null;
  created_at: string;
}

export default function SiteDetails() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const siteId = params.site_id as string;
  const hasOngoing = params.has_ongoing === "true";
  const insets = useSafeAreaInsets();

  const [details, setDetails] = useState<SiteDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mapModalVisible, setMapModalVisible] = useState(false);
  const [galleryModalVisible, setGalleryModalVisible] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  // ✅ FIXED: Description "see more" state
  const [descExpanded, setDescExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);

  // Animated values for parallax
  const scrollY = useRef(new Animated.Value(0)).current;
  const HEADER_HEIGHT = 340;

  const fetchDetails = async (isRefresh: boolean = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const token = await SecureStore.getItemAsync("token");
      if (!token) throw new Error("No authentication token found.");

      const res = await fetch(
        `${api}/api/get_site_details_for_tree_grower/${siteId}/`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || "Failed to fetch site details");
      setDetails(data);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [siteId]);

  const onRefresh = () => {
    // ✅ Reset description states on refresh
    setDescExpanded(false);
    setIsTruncated(false);
    fetchDetails(true);
  };

  // Parallax: image scales and fades as you scroll
  const imageScale = scrollY.interpolate({
    inputRange: [-HEADER_HEIGHT, 0, HEADER_HEIGHT],
    outputRange: [1.3, 1, 1.1],
    extrapolate: "clamp",
  });

  const imageOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_HEIGHT * 0.8],
    outputRange: [1, 0.3],
    extrapolate: "clamp",
  });

  // Header opacity for title fade-in
  const headerOpacity = scrollY.interpolate({
    inputRange: [HEADER_HEIGHT - 120, HEADER_HEIGHT - 40],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const handleApply = () => {
    if (hasOngoing) {
      Alert.alert("Cannot Apply", "You already have an ongoing application.", [
        { text: "OK" },
      ]);
      return;
    }
    if (!details) return;
    router.push({
      pathname: "/tree_growers/Reapply",
      params: { site_id: details.site_id.toString(), site_name: details.name },
    });
  };

  const openGallery = (index: number) => {
    setSelectedImageIndex(index);
    setGalleryModalVisible(true);
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "Recently listed";
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return "Recently listed";
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0F4A2F" />
          <Text style={styles.loadingText}>Loading site details...</Text>
        </View>
      </View>
    );
  }

  if (!details) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.center}>
          <Text style={styles.errorText}>Failed to load site details</Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.textBackButton}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const heroImage = details.general_images[0];
  const galleryImages = details.general_images;
  const hasMultipleImages = galleryImages.length > 1;

  return (
    <View style={styles.container}>
      {/* 🖼️ Hero Image - Fixed at top, no translateY (no gap) */}
      <Animated.View
        style={[
          styles.heroImageContainer,
          {
            height: HEADER_HEIGHT,
            opacity: imageOpacity,
            transform: [{ scale: imageScale }],
          },
        ]}
      >
        {heroImage ? (
          <Image
            source={{
              uri: heroImage.url?.startsWith("http")
                ? heroImage.url
                : `${api}${heroImage.url}`,
            }}
            style={styles.heroImage}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.heroImage, { backgroundColor: "#E2E8F0" }]}>
            <Ionicons name="image" size={48} color="#94A3B8" />
          </View>
        )}
        {/* Bottom gradient fade into content */}
        <View style={styles.heroGradient} />
      </Animated.View>

      {/* 📌 Sticky Header (fades in on scroll) */}
      <Animated.View
        style={[
          styles.stickyHeader,
          {
            paddingTop: insets.top + 8,
            opacity: headerOpacity,
          },
        ]}
      >
        <Text style={styles.stickyHeaderTitle} numberOfLines={1}>
          {details.name}
        </Text>
      </Animated.View>

      {/* 🔙 Floating Back Button */}
      <TouchableOpacity
        style={[styles.floatingBackBtn, { top: insets.top + 12 }]}
        onPress={() => router.replace("/tree_growers/sites")}
        activeOpacity={0.8}
      >
        <Ionicons name="chevron-back" size={22} color="#0F172A" />
      </TouchableOpacity>

      {/* ❤️ Floating Heart Button */}
      <TouchableOpacity
        style={[styles.floatingHeartBtn, { top: insets.top + 12 }]}
        activeOpacity={0.8}
      >
        <Ionicons name="heart-outline" size={20} color="#0F172A" />
      </TouchableOpacity>

      {/* 📜 Scrollable Content */}
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#0F4A2F"
            colors={["#0F4A2F"]}
            progressBackgroundColor="#FFFFFF"
          />
        }
      >
        {/* Spacer pushes content to start below hero */}
        <View style={{ height: HEADER_HEIGHT - 30 }} />

        {/* 📝 Content Sheet */}
        <View style={styles.contentSheet}>
          {/* Header Info */}
          <View style={styles.headerSection}>
            <View style={styles.headerTopRow}>
              <View style={styles.statusPill}>
                <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                <Text style={styles.statusPillText}>Available</Text>
              </View>
              <View style={styles.ratingBadge}>
                <Ionicons name="star" size={12} color="#F59E0B" />
                <Text style={styles.ratingText}>5.0</Text>
              </View>
            </View>

            <Text style={styles.siteName}>{details.name}</Text>

            <View style={styles.locationRow}>
              <Ionicons name="location" size={14} color="#0F4A2F" />
              <Text style={styles.locationText}>
                {details.barangay}, {details.reforestation_area}
              </Text>
            </View>

            <Text style={styles.dateText}>
              Listed {formatDate(details.created_at)}
            </Text>
          </View>

          {/* ✅ FIXED: Description Section with See More / See Less */}
          {details.description && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About this Site</Text>
              <Text
                style={styles.descriptionText}
                // Only apply numberOfLines if it's truncated AND collapsed
                numberOfLines={
                  descExpanded
                    ? undefined
                    : isTruncated
                      ? DESCRIPTION_LINE_LIMIT
                      : undefined
                }
                onTextLayout={(e) => {
                  // Only measure when collapsed and not yet determined to be truncated
                  if (!descExpanded && !isTruncated) {
                    if (e.nativeEvent.lines.length > DESCRIPTION_LINE_LIMIT) {
                      setIsTruncated(true);
                    }
                  }
                }}
              >
                {details.description}
              </Text>

              {/* Show button only if text actually exceeded the line limit */}
              {isTruncated && (
                <TouchableOpacity
                  onPress={() => setDescExpanded(!descExpanded)}
                  style={styles.seeMoreBtn}
                  activeOpacity={0.7}
                >
                  <Text style={styles.seeMoreText}>
                    {descExpanded ? "See less" : "See more"}
                  </Text>
                  <Ionicons
                    name={descExpanded ? "chevron-up" : "chevron-down"}
                    size={14}
                    color="#0F4A2F"
                  />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* 📊 Key Details Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Key Details</Text>
            <View style={styles.metricsRow}>
              <View style={styles.metricItem}>
                <View
                  style={[
                    styles.metricIconCircle,
                    { backgroundColor: "#ECFDF5" },
                  ]}
                >
                  <Ionicons name="leaf" size={20} color="#059669" />
                </View>
                <Text style={styles.metricValue}>
                  {details.total_area_hectares.toFixed(2)}
                </Text>
                <Text style={styles.metricLabel}>Hectares</Text>
              </View>

              <View style={styles.metricDivider} />

              <View style={styles.metricItem}>
                <View
                  style={[
                    styles.metricIconCircle,
                    { backgroundColor: "#EFF6FF" },
                  ]}
                >
                  <Ionicons name="analytics" size={20} color="#2563EB" />
                </View>
                <Text style={styles.metricValue}>
                  {details.ndvi_value !== null
                    ? details.ndvi_value.toFixed(2)
                    : "N/A"}
                </Text>
                <Text style={styles.metricLabel}>NDVI Score</Text>
              </View>

              <View style={styles.metricDivider} />

              <View style={styles.metricItem}>
                <View
                  style={[
                    styles.metricIconCircle,
                    { backgroundColor: "#FFFBEB" },
                  ]}
                >
                  <Ionicons name="chatbubble" size={20} color="#D97706" />
                </View>
                <Text style={styles.metricValue}>213</Text>
                <Text style={styles.metricLabel}>Reviews</Text>
              </View>
            </View>
          </View>

          {/* ️ Land Classification Section */}
          {details.land_classification && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Land Classification</Text>
              <View style={styles.classificationCard}>
                <Ionicons name="earth" size={20} color="#4F46E5" />
                <Text style={styles.classificationText}>
                  {details.land_classification.name}
                </Text>
              </View>
            </View>
          )}

          {/* 🚗 Accessibility Section */}
          {details.accessibility && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Accessibility</Text>
              <View style={styles.accessibilityCard}>
                <View style={styles.accessibilityHeader}>
                  <Ionicons name="car-sport" size={20} color="#0F4A2F" />
                  <Text style={styles.accessibilityType}>
                    {details.accessibility.type}
                  </Text>
                </View>
                {details.accessibility.description ? (
                  <Text style={styles.accessibilityDesc}>
                    {details.accessibility.description}
                  </Text>
                ) : null}
              </View>
            </View>
          )}

          {/* ️ View Map Button */}
          {details.center_coordinate && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Location</Text>
              <TouchableOpacity
                style={styles.mapButton}
                onPress={() => setMapModalVisible(true)}
                activeOpacity={0.8}
              >
                <View style={styles.mapButtonIconBox}>
                  <Ionicons name="map" size={24} color="#0F4A2F" />
                </View>
                <View style={styles.mapButtonTextBox}>
                  <Text style={styles.mapButtonTitle}>View on Map</Text>
                  <Text style={styles.mapButtonSubtitle}>
                    {details.barangay}, {details.reforestation_area}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>
          )}

          {/* 🖼️ Gallery Section */}
          {hasMultipleImages && (
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Gallery</Text>
                <Text style={styles.galleryCountText}>
                  {galleryImages.length} photos
                </Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.galleryScrollContent}
              >
                {galleryImages.map((img, index) => (
                  <TouchableOpacity
                    key={img.image_id}
                    style={styles.galleryThumbnail}
                    onPress={() => openGallery(index)}
                    activeOpacity={0.8}
                  >
                    <Image
                      source={{
                        uri: img.url?.startsWith("http")
                          ? img.url
                          : `${api}${img.url}`,
                      }}
                      style={styles.galleryImage}
                      resizeMode="cover"
                    />
                    {index === 0 && (
                      <View style={styles.galleryHeroBadge}>
                        <Text style={styles.galleryHeroBadgeText}>Cover</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* 🌳 Recommended Species Section */}
          {details.recommended_species.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Recommended Species</Text>
                <TouchableOpacity>
                  <Text style={styles.seeAllText}>See all</Text>
                </TouchableOpacity>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.speciesScrollContent}
              >
                {details.recommended_species.map((species) => (
                  <View key={species.species_id} style={styles.speciesCard}>
                    <View style={styles.speciesImagePlaceholder}>
                      <Ionicons name="leaf" size={28} color="#0F4A2F" />
                    </View>
                    <View style={styles.speciesInfo}>
                      <View style={styles.speciesRankBadge}>
                        <Text style={styles.rankText}>
                          #{species.priority_rank}
                        </Text>
                      </View>
                      <Text style={styles.speciesName} numberOfLines={1}>
                        {species.name}
                      </Text>
                      {species.notes && (
                        <Text style={styles.speciesNotes} numberOfLines={1}>
                          {species.notes}
                        </Text>
                      )}
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* ✅ Apply Button */}
          <View style={styles.footerSection}>
            <TouchableOpacity
              style={[
                styles.applyButton,
                hasOngoing && styles.applyButtonDisabled,
              ]}
              activeOpacity={hasOngoing ? 1 : 0.8}
              onPress={handleApply}
              disabled={hasOngoing}
            >
              {hasOngoing ? (
                <>
                  <Ionicons name="lock-closed" size={20} color="#94A3B8" />
                  <Text style={styles.applyButtonTextDisabled}>
                    Cannot Apply - Ongoing Application
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.applyButtonText}>Apply to This Site</Text>
                  <View style={styles.applyButtonIconBox}>
                    <Ionicons name="arrow-forward" size={18} color="#0F4A2F" />
                  </View>
                </>
              )}
            </TouchableOpacity>

            {hasOngoing && (
              <View style={styles.warningBanner}>
                <Ionicons name="information-circle" size={16} color="#D97706" />
                <Text style={styles.warningBannerText}>
                  You have an ongoing application. Please wait for it to be
                  processed.
                </Text>
              </View>
            )}
          </View>

          {/* Bottom spacer accounts for tab bar */}
          <View style={{ height: TAB_BAR_HEIGHT + insets.bottom + 20 }} />
        </View>
      </Animated.ScrollView>

      {/* ️ Map Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={mapModalVisible}
        onRequestClose={() => setMapModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.mapModalContent}>
            {/* Modal Header */}
            <View
              style={[styles.mapModalHeader, { paddingTop: insets.top + 12 }]}
            >
              <TouchableOpacity
                onPress={() => setMapModalVisible(false)}
                style={styles.mapModalCloseBtn}
              >
                <Ionicons name="close" size={22} color="#0F172A" />
              </TouchableOpacity>
              <Text style={styles.mapModalTitle} numberOfLines={1}>
                {details.name}
              </Text>
              <View style={{ width: 40 }} />
            </View>

            {/* Full Screen Map */}
            <View style={styles.mapModalMapContainer}>
              <OsmMapComponent
                centerCoordinate={details.center_coordinate!}
                polygonCoordinates={details.polygon_coordinates}
                title={details.name}
                style={{ flex: 1 }}
              />
            </View>

            {/* Modal Footer Info */}
            <View style={styles.mapModalFooter}>
              <View style={styles.mapModalFooterInfo}>
                <Ionicons name="location" size={16} color="#0F4A2F" />
                <Text style={styles.mapModalFooterText}>
                  {details.barangay}, {details.reforestation_area}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.mapModalDoneBtn}
                onPress={() => setMapModalVisible(false)}
              >
                <Text style={styles.mapModalDoneBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 🖼️ Gallery Full Screen Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={galleryModalVisible}
        onRequestClose={() => setGalleryModalVisible(false)}
      >
        <View style={styles.galleryModalOverlay}>
          {/* Close button */}
          <TouchableOpacity
            style={[styles.galleryModalCloseBtn, { top: insets.top + 16 }]}
            onPress={() => setGalleryModalVisible(false)}
          >
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>

          {/* Image counter */}
          <View style={[styles.galleryCounter, { top: insets.top + 20 }]}>
            <Text style={styles.galleryCounterText}>
              {selectedImageIndex + 1} / {galleryImages.length}
            </Text>
          </View>

          {/* Horizontal image scroll */}
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: selectedImageIndex * width, y: 0 }}
            onMomentumScrollEnd={(e) => {
              const index = Math.round(e.nativeEvent.contentOffset.x / width);
              setSelectedImageIndex(index);
            }}
          >
            {galleryImages.map((img) => (
              <View key={img.image_id} style={styles.galleryFullImageWrapper}>
                <Image
                  source={{
                    uri: img.url?.startsWith("http")
                      ? img.url
                      : `${api}${img.url}`,
                  }}
                  style={styles.galleryFullImage}
                  resizeMode="contain"
                />
                {img.caption && (
                  <View style={styles.galleryCaptionBox}>
                    <Text style={styles.galleryCaptionText}>{img.caption}</Text>
                  </View>
                )}
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 12, color: "#64748B", fontSize: 14 },
  errorText: { fontSize: 16, color: "#EF4444", marginBottom: 16 },
  textBackButton: { padding: 8 },
  backButtonText: { color: "#0F4A2F", fontWeight: "700", fontSize: 15 },

  // Hero Image - Fixed at top, no translateY (no gap)
  heroImageContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    overflow: "hidden",
  },
  heroImage: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  heroGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
    backgroundColor: "rgba(248,250,252,0)",
  },

  // Sticky Header
  stickyHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 90,
    backgroundColor: "rgba(255,255,255,0.95)",
    justifyContent: "flex-end",
    paddingBottom: 12,
    paddingHorizontal: 56,
    zIndex: 50,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  stickyHeaderTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    textAlign: "center",
  },

  // Floating Buttons
  floatingBackBtn: {
    position: "absolute",
    left: 16,
    zIndex: 100,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.9)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  floatingHeartBtn: {
    position: "absolute",
    right: 16,
    zIndex: 100,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.9)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },

  // Scroll Content
  scrollContent: {
    flexGrow: 1,
  },

  // Content Sheet
  contentSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 24,
    paddingHorizontal: 20,
    minHeight: screenHeight,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -10 },
    elevation: 10,
  },

  // Header Section
  headerSection: {
    marginBottom: 24,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 4,
  },
  statusPillText: { fontSize: 12, fontWeight: "700", color: "#059669" },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ratingText: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  siteName: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 10,
    lineHeight: 36,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  locationText: { fontSize: 14, color: "#475569", fontWeight: "500" },
  dateText: { fontSize: 12, color: "#94A3B8", fontWeight: "400" },

  // Sections
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 14,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0F4A2F",
  },

  // Metrics
  metricsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  metricItem: {
    alignItems: "center",
    flex: 1,
  },
  metricIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 2,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  metricDivider: {
    width: 1,
    height: 40,
    backgroundColor: "#E2E8F0",
  },

  // Map Button
  mapButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  mapButtonIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#ECFDF5",
    justifyContent: "center",
    alignItems: "center",
  },
  mapButtonTextBox: {
    flex: 1,
  },
  mapButtonTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 2,
  },
  mapButtonSubtitle: {
    fontSize: 13,
    color: "#64748B",
  },

  // Description
  descriptionText: {
    fontSize: 15,
    lineHeight: 24,
    color: "#475569",
  },
  seeMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
    alignSelf: "flex-start",
  },
  seeMoreText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F4A2F",
  },

  // Accessibility
  accessibilityCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 16,
  },
  accessibilityHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  accessibilityType: {
    fontSize: 15,
    fontWeight: "700",
    color: "#065F46",
  },
  accessibilityDesc: {
    fontSize: 14,
    color: "#64748B",
    lineHeight: 22,
    paddingLeft: 30,
  },

  // Land Classification
  classificationCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    gap: 10,
    alignSelf: "flex-start",
  },
  classificationText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#4338CA",
  },

  // Gallery
  galleryScrollContent: {
    gap: 10,
    paddingRight: 20,
  },
  galleryThumbnail: {
    width: 120,
    height: 120,
    borderRadius: 16,
    overflow: "hidden",
    position: "relative",
  },
  galleryImage: {
    width: "100%",
    height: "100%",
  },
  galleryHeroBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(15,74,47,0.85)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  galleryHeroBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  galleryCountText: {
    fontSize: 13,
    color: "#94A3B8",
    fontWeight: "500",
  },

  // Species (Horizontal Scroll)
  speciesScrollContent: {
    gap: 12,
    paddingRight: 20,
  },
  speciesCard: {
    width: 160,
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  speciesImagePlaceholder: {
    width: "100%",
    height: 100,
    backgroundColor: "#ECFDF5",
    justifyContent: "center",
    alignItems: "center",
  },
  speciesInfo: {
    padding: 12,
  },
  speciesRankBadge: {
    position: "absolute",
    top: -14,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#0F4A2F",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  rankText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  speciesName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 2,
  },
  speciesNotes: {
    fontSize: 12,
    color: "#64748B",
  },

  // Footer / Apply Button
  footerSection: {
    marginTop: 8,
    marginBottom: 16,
  },
  applyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0F4A2F",
    paddingVertical: 18,
    borderRadius: 16,
    gap: 10,
    shadowColor: "#0F4A2F",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  applyButtonText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  applyButtonIconBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },

  applyButtonDisabled: {
    backgroundColor: "#E2E8F0",
    shadowOpacity: 0,
    elevation: 0,
  },
  applyButtonTextDisabled: {
    color: "#94A3B8",
    fontSize: 15,
    fontWeight: "700",
  },

  warningBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFBEB",
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  warningBannerText: {
    flex: 1,
    fontSize: 12,
    color: "#92400E",
    fontWeight: "600",
    lineHeight: 18,
  },

  // Map Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  mapModalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
    height: screenHeight * 0.85,
  },
  mapModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  mapModalCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  mapModalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    flex: 1,
    textAlign: "center",
    marginHorizontal: 12,
  },
  mapModalMapContainer: {
    flex: 1,
  },
  mapModalFooter: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  mapModalFooterInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  mapModalFooterText: {
    fontSize: 14,
    color: "#475569",
    fontWeight: "500",
  },
  mapModalDoneBtn: {
    backgroundColor: "#0F4A2F",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  mapModalDoneBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },

  // Gallery Modal
  galleryModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
  },
  galleryModalCloseBtn: {
    position: "absolute",
    right: 20,
    zIndex: 100,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  galleryCounter: {
    position: "absolute",
    left: 20,
    zIndex: 100,
  },
  galleryCounterText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  galleryFullImageWrapper: {
    width: width,
    height: screenHeight,
    justifyContent: "center",
    alignItems: "center",
  },
  galleryFullImage: {
    width: width,
    height: screenHeight * 0.7,
  },
  galleryCaptionBox: {
    position: "absolute",
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 12,
    borderRadius: 12,
  },
  galleryCaptionText: {
    color: "#fff",
    fontSize: 14,
    textAlign: "center",
  },

  // Map Component (reused)
  mapContainer: { width: "100%", height: "100%" },
  webview: { flex: 1 },
});
