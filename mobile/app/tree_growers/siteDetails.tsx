import React, { useState, useEffect, useRef } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
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
} from "react-native";
import * as SecureStore from "expo-secure-store";
import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/constants/url_fixed";

const { width } = Dimensions.get("window");

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
      ? title.replace(/'/g, "\\'").replace(/"/g, '\\"')
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
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const fetchDetails = async () => {
    try {
      setLoading(true);
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
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [siteId]);

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

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ✅ FIXED: Back button now properly positioned below status bar */}
      <TouchableOpacity
        style={[
          styles.floatingBackBtn,
          { top: insets.top + 16 } // Critical: Position below status bar + 16px
        ]}
        onPress={() => router.replace("/tree_growers/sites")}
        activeOpacity={0.8}
      >
        <Ionicons name="chevron-back" size={22} color="#0F172A" />
      </TouchableOpacity>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* 🖼️ Image Carousel */}
        {details.general_images.length > 0 && (
          <View style={styles.carouselContainer}>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                const index = Math.round(e.nativeEvent.contentOffset.x / width);
                setCurrentImageIndex(index);
              }}
            >
              {details.general_images.map((img) => (
                <View key={img.image_id} style={styles.carouselImageWrapper}>
                  <Image
                    source={{
                      uri: img.url?.startsWith("http")
                        ? img.url
                        : `${api}${img.url}`,
                    }}
                    style={styles.carouselImage}
                    resizeMode="cover"
                  />
                </View>
              ))}
            </ScrollView>

            {details.general_images.length > 1 && (
              <View style={styles.pagination}>
                {details.general_images.map((_, index) => (
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
          </View>
        )}

        {/* 📝 Header Card */}
        <View style={styles.headerCard}>
          <View style={styles.headerTop}>
            <View style={styles.statusPill}>
              <Ionicons name="checkmark-circle" size={14} color="#10B981" />
              <Text style={styles.statusPillText}>Available</Text>
            </View>
            <Text style={styles.dateText}>Listed {details.created_at}</Text>
          </View>

          <Text style={styles.siteName}>{details.name}</Text>

          <View style={styles.locationChip}>
            <Ionicons name="location" size={14} color="#0F4A2F" />
            <Text style={styles.locationText}>
              {details.barangay}, {details.reforestation_area}
            </Text>
          </View>
        </View>

        {/* 📊 Metrics Grid */}
        <View style={styles.metricsGrid}>
          <View style={[styles.metricCard, { backgroundColor: "#ECFDF5" }]}>
            <View
              style={[styles.metricIconBox, { backgroundColor: "#D1FAE5" }]}
            >
              <Ionicons name="leaf" size={20} color="#059669" />
            </View>
            <Text style={[styles.metricValue, { color: "#065F46" }]}>
              {details.total_area_hectares.toFixed(2)}
            </Text>
            <Text style={[styles.metricLabel, { color: "#047857" }]}>
              Hectares
            </Text>
          </View>

          <View style={[styles.metricCard, { backgroundColor: "#EFF6FF" }]}>
            <View
              style={[styles.metricIconBox, { backgroundColor: "#DBEAFE" }]}
            >
              <Ionicons name="analytics" size={20} color="#2563EB" />
            </View>
            <Text style={[styles.metricValue, { color: "#1E40AF" }]}>
              {details.ndvi_value !== null
                ? details.ndvi_value.toFixed(2)
                : "N/A"}
            </Text>
            <Text style={[styles.metricLabel, { color: "#1D4ED8" }]}>
              NDVI Score
            </Text>
          </View>
        </View>

        {/* 📄 Description */}
        {details.description && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Ionicons name="information-circle" size={20} color="#0F4A2F" />
              <Text style={styles.sectionTitle}>Description</Text>
            </View>
            <Text style={styles.descriptionText}>{details.description}</Text>
          </View>
        )}

        {/* 🚗 Accessibility */}
        {details.accessibility && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Ionicons name="car-sport" size={20} color="#0F4A2F" />
              <Text style={styles.sectionTitle}>Accessibility</Text>
            </View>
            <View style={styles.accessibilityContent}>
              <View style={styles.accessibilityBadge}>
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

        {/* 🗺️ Land Classification */}
        {details.land_classification && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Ionicons name="layers" size={20} color="#0F4A2F" />
              <Text style={styles.sectionTitle}>Land Classification</Text>
            </View>
            <View style={styles.classificationPill}>
              <Ionicons name="earth" size={16} color="#4F46E5" />
              <Text style={styles.classificationText}>
                {details.land_classification.name}
              </Text>
            </View>
          </View>
        )}

        {/* 🌳 Recommended Species */}
        {details.recommended_species.length > 0 && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Ionicons name="leaf" size={20} color="#0F4A2F" />
              <Text style={styles.sectionTitle}>Recommended Species</Text>
            </View>
            {details.recommended_species.map((species, index) => (
              <View
                key={species.species_id}
                style={[
                  styles.speciesCard,
                  index === details.recommended_species.length - 1 && {
                    marginBottom: 0,
                  },
                ]}
              >
                <View style={styles.speciesHeader}>
                  <View style={styles.speciesRankBadge}>
                    <Text style={styles.rankText}>
                      #{species.priority_rank}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.speciesName}>{species.name}</Text>
                    {species.notes && (
                      <Text style={styles.speciesNotes}>{species.notes}</Text>
                    )}
                  </View>
                </View>
                {species.description && (
                  <Text style={styles.speciesDesc}>{species.description}</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* 🗺️ Map Section */}
        {details.center_coordinate && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Ionicons name="map" size={20} color="#0F4A2F" />
              <Text style={styles.sectionTitle}>Location Map</Text>
            </View>
            <OsmMapComponent
              centerCoordinate={details.center_coordinate}
              polygonCoordinates={details.polygon_coordinates}
              title={details.name}
              style={styles.mapWrapper}
            />
          </View>
        )}

        {/* ✅ Apply Button & Warning */}
        <View style={styles.footerContainer}>
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
      </ScrollView>
    </View>
  );
}

// ─── Modern Aesthetic Styles ───────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#F8FAFC" 
  },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 12, color: "#64748B", fontSize: 14 },
  errorText: { fontSize: 16, color: "#EF4444", marginBottom: 16 },
  textBackButton: { padding: 8 },
  backButtonText: { color: "#0F4A2F", fontWeight: "700", fontSize: 15 },
  scrollContent: { paddingBottom: 32 },

  // ✅ FIXED: Back button position now dynamically calculated
  floatingBackBtn: {
    position: "absolute",
    left: 16,
    zIndex: 100,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
    // Top is now set dynamically in JSX, not here
  },

  // Carousel
  carouselContainer: {
    backgroundColor: "#fff",
    marginBottom: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  carouselImageWrapper: { width: width, height: 280 },
  carouselImage: { width: "100%", height: "100%" },
  pagination: {
    position: "absolute",
    bottom: 16,
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
  activeDot: { width: 20, backgroundColor: "#fff" },

  // Cards
  sectionCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  headerCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  // Header
  headerTop: {
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
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  statusPillText: { fontSize: 12, fontWeight: "700", color: "#059669" },
  dateText: { fontSize: 12, color: "#94A3B8", fontWeight: "500" },
  siteName: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 12,
    lineHeight: 32,
  },
  locationChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
    alignSelf: "flex-start",
  },
  locationText: { fontSize: 13, color: "#475569", fontWeight: "500" },

  // Section Header
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // Metrics
  metricsGrid: {
    flexDirection: "row",
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    borderRadius: 20,
    padding: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.02,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  metricIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // Description
  descriptionText: { fontSize: 14, lineHeight: 22, color: "#475569" },

  // Accessibility
  accessibilityContent: { gap: 8 },
  accessibilityBadge: {
    backgroundColor: "#F0FDF4",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  accessibilityType: {
    fontSize: 14,
    fontWeight: "700",
    color: "#065F46",
  },
  accessibilityDesc: { fontSize: 13, color: "#64748B", lineHeight: 20 },

  // Land Classification
  classificationPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    gap: 8,
    alignSelf: "flex-start",
  },
  classificationText: { fontSize: 14, fontWeight: "700", color: "#4338CA" },

  // Species
  speciesCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#0F4A2F",
  },
  speciesHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  speciesRankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#0F4A2F",
    justifyContent: "center",
    alignItems: "center",
  },
  rankText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  speciesName: { fontSize: 15, fontWeight: "700", color: "#0F172A" },
  speciesDesc: {
    fontSize: 13,
    color: "#64748B",
    lineHeight: 20,
    marginTop: 4,
  },
  speciesNotes: {
    fontSize: 12,
    color: "#0F4A2F",
    fontWeight: "600",
    marginTop: 2,
  },

  // Map
  mapWrapper: {
    height: 250,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  mapContainer: { width: "100%", height: "100%" },
  webview: { flex: 1 },

  // Footer / Apply Button
  footerContainer: {
    marginTop: 8,
    marginHorizontal: 16,
    marginBottom: 32,
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
});