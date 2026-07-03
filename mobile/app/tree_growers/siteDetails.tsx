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
  SafeAreaView,
  Platform,
  Alert,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";

import { api } from "@/constants/url_fixed";

const { width } = Dimensions.get("window");

// --- OSM / Leaflet Map Component ---

interface OsmMapProps {
  centerCoordinate: [number, number]; // [lat, lng]
  polygonCoordinates: [number, number][] | null; // [[lat, lng], ...]
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

  // Generate the HTML content for Leaflet
  const generateMapHtml = () => {
    const [lat, lng] = centerCoordinate || [11.0, 124.6];
    const safeLat = lat || 11.0;
    const safeLng = lng || 124.6;
    
    // ✅ FIX: Escape quotes for safe JS string injection
    const safeTitle = title ? title.replace(/'/g, "\\'").replace(/"/g, '\\"') : "Site Location";
    
    // Prepare Polygon Data for JS injection
    let polygonScript = "";
    if (polygonCoordinates && polygonCoordinates.length >= 3) {
      const points = JSON.stringify(polygonCoordinates);
      
      polygonScript = `
        // Draw Polygon
        var polygon = L.polygon(${points}, {
          color: '#0F4A2F',
          fillColor: '#0F4A2F',
          fillOpacity: 0.3,
          weight: 2
        }).addTo(map);
        
        // Fit bounds to show polygon nicely if it exists, otherwise keep center
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
          /* ✅ FIX: Explicitly set html/body height to prevent 100vh from collapsing */
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
            // Initialize map centered on the site
            var map = L.map('map', { zoomControl: true, attributionControl: true }).setView([${safeLat}, ${safeLng}], 15);

            // Add OpenStreetMap tiles
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
              attribution: '&copy; OpenStreetMap contributors',
              maxZoom: 19,
              crossOrigin: true,
              errorTileUrl: ''
            }).addTo(map);

            // Custom Marker Style
            var greenIcon = L.divIcon({
              className: 'custom-div-icon',
              html: "<div style='background-color:#0F4A2F; width:16px; height:16px; border-radius:50%; border:2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);'></div>",
              iconSize: [16, 16],
              iconAnchor: [8, 8]
            });

            // Add Marker for Center
            var marker = L.marker([${safeLat}, ${safeLng}], {icon: greenIcon}).addTo(map);
            marker.bindPopup("<b>${safeTitle}</b><br>Site Location").openPopup();

            ${polygonScript}

            // Disable scroll zoom to prevent conflict with parent ScrollView
            map.scrollWheelZoom.disable();
            
            // Send success message to React Native
            window.ReactNativeWebView.postMessage(JSON.stringify({type: 'info', message: 'Map loaded successfully'}));
          } catch(e) {
            // Send error message to React Native if Leaflet fails to initialize
            window.ReactNativeWebView.postMessage(JSON.stringify({type: 'error', message: e.message}));
          }
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
        mixedContentMode="always" // ✅ Crucial for Android to load external tiles/scripts
        scrollEnabled={false} // Important for nested scrolling
        nestedScrollEnabled={true} // ✅ Allows Android to scroll the parent ScrollView when touching the map
        originWhitelist={['*']}
        onMessage={(event: any) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'error') {
              console.error('Map JS Error:', data.message);
              Alert.alert('Map Error', data.message);
            }
          } catch (e) {}
        }}
        onError={(syntheticEvent: any) => {
          const { nativeEvent } = syntheticEvent;
          console.error('WebView Native Error: ', nativeEvent);
        }}
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
  accessibility: {
    type: string;
    description: string;
  } | null;
  land_classification: {
    id: number;
    name: string;
  } | null;
  created_at: string;
}

export default function SiteDetails() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const siteId = params.site_id as string;
  const hasOngoing = params.has_ongoing === "true";

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
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch site details");
      setDetails(data);
    } catch (err: any) {
      console.error("Fetch details error:", err);
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
      Alert.alert(
        "Cannot Apply",
        "You already have an ongoing application. Please wait for it to be completed or rejected before applying to a new site.",
        [{ text: "OK" }]
      );
      return;
    }

    if (!details) return;
    router.push({
      pathname: "/tree_growers/Reapply",
      params: {
        site_id: details.site_id.toString(),
        site_name: details.name,
      },
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0F4A2F" />
          <Text style={styles.loadingText}>Loading site details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!details) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.errorText}>Failed to load site details</Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Image Carousel */}
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
                      // ✅ FIXED: Prepend API URL if the backend returns a relative path
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

        {/* Site Name & Info */}
        <View style={styles.contentSection}>
          <Text style={styles.siteName}>{details.name}</Text>
          <View style={styles.ratingRow}>
            <View style={styles.ratingBadge}>
              <Ionicons name="checkmark-circle" size={14} color="#10B981" />
              <Text style={styles.ratingText}>Verified & Available</Text>
            </View>
            <Text style={styles.dateText}>Listed {details.created_at}</Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={18} color="#0F4A2F" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Location</Text>
              <Text style={styles.infoValue}>
                {details.barangay}, {details.reforestation_area}
              </Text>
            </View>
          </View>

          <View style={styles.metricsGrid}>
            <View style={styles.metricCard}>
              <Ionicons name="expand" size={24} color="#0F4A2F" />
              <Text style={styles.metricValue}>
                {details.total_area_hectares.toFixed(2)}
              </Text>
              <Text style={styles.metricLabel}>Hectares</Text>
            </View>
            <View style={styles.metricCard}>
              <Ionicons name="leaf" size={24} color="#0F4A2F" />
              <Text style={styles.metricValue}>
                {details.ndvi_value !== null
                  ? details.ndvi_value.toFixed(2)
                  : "N/A"}
              </Text>
              <Text style={styles.metricLabel}>NDVI Score</Text>
            </View>
          </View>
        </View>

        {/* Description */}
        {details.description && (
          <View style={styles.contentSection}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.descriptionText}>{details.description}</Text>
          </View>
        )}

        {/* Accessibility */}
        {details.accessibility && (
          <View style={styles.contentSection}>
            <Text style={styles.sectionTitle}>Accessibility</Text>
            <View style={styles.accessibilityCard}>
              <Ionicons name="car-sport" size={24} color="#0F4A2F" />
              <View style={styles.accessibilityContent}>
                <Text style={styles.accessibilityType}>
                  {details.accessibility.type}
                </Text>
                {details.accessibility.description ? (
                  <Text style={styles.accessibilityDesc}>
                    {details.accessibility.description}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>
        )}

        {/* Land Classification */}
        {details.land_classification && (
          <View style={styles.contentSection}>
            <Text style={styles.sectionTitle}>Land Classification</Text>
            <View style={styles.classificationBadge}>
              <Ionicons name="layers" size={18} color="#0F4A2F" />
              <Text style={styles.classificationText}>
                {details.land_classification.name}
              </Text>
            </View>
          </View>
        )}

        {/* Recommended Species */}
        {details.recommended_species.length > 0 && (
          <View style={styles.contentSection}>
            <Text style={styles.sectionTitle}>Recommended Tree Species</Text>
            {details.recommended_species.map((species) => (
              <View key={species.species_id} style={styles.speciesCard}>
                <View style={styles.speciesHeader}>
                  <View style={styles.speciesRank}>
                    <Text style={styles.rankText}>#{species.priority_rank}</Text>
                  </View>
                  <Text style={styles.speciesName}>{species.name}</Text>
                </View>
                {species.description && (
                  <Text style={styles.speciesDesc}>{species.description}</Text>
                )}
                {species.notes && (
                  <Text style={styles.speciesNotes}>Note: {species.notes}</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* ✅ OPENSTREETMAP IMPLEMENTATION */}
        {details.center_coordinate && (
          <View style={styles.contentSection}>
            <Text style={styles.sectionTitle}>Location Map</Text>
            <OsmMapComponent
              centerCoordinate={details.center_coordinate}
              polygonCoordinates={details.polygon_coordinates}
              title={details.name}
              style={styles.mapWrapper}
            />
          </View>
        )}

        {/* ✅ Apply Button with Disabled State */}
        <TouchableOpacity
          style={[styles.applyButton, hasOngoing && styles.applyButtonDisabled]}
          activeOpacity={hasOngoing ? 1 : 0.7}
          onPress={handleApply}
          disabled={hasOngoing}
        >
          {hasOngoing ? (
            <>
              <Ionicons name="lock-closed" size={20} color="#9CA3AF" />
              <Text style={styles.applyButtonTextDisabled}>
                Cannot Apply - Ongoing Application
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.applyButtonText}>Apply to This Site</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </>
          )}
        </TouchableOpacity>

        {/* ✅ Show warning banner if has ongoing application */}
        {hasOngoing && (
          <View style={styles.warningBanner}>
            <Ionicons name="information-circle" size={18} color="#F59E0B" />
            <Text style={styles.warningBannerText}>
              You have an ongoing application. Complete or wait for it to be
              processed before applying to a new site.
            </Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F7F5" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 12, color: "#6B7280", fontSize: 14 },
  errorText: { fontSize: 16, color: "#EF4444", marginBottom: 16 },
  backButton: { padding: 8 },
  backButtonText: { color: "#0F4A2F", fontWeight: "700", fontSize: 15 },
  scrollContent: { paddingBottom: 32 },

  // Carousel
  carouselContainer: { backgroundColor: "#fff", marginBottom: 16 },
  carouselImageWrapper: { width: width, height: 280 },
  carouselImage: { width: "100%", height: "100%" },
  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 12,
    gap: 6,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#D1D5DB" },
  activeDot: { width: 24, borderRadius: 4, backgroundColor: "#0F4A2F" },

  // Content Sections
  contentSection: {
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginBottom: 16,
  },
  siteName: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 8,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 4,
  },
  ratingText: { fontSize: 12, fontWeight: "700", color: "#10B981" },
  dateText: { fontSize: 12, color: "#9CA3AF" },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F4A2F",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // Info Rows
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 12, color: "#6B7280", marginBottom: 2 },
  infoValue: { fontSize: 14, fontWeight: "600", color: "#111827" },

  // Metrics Grid
  metricsGrid: { flexDirection: "row", gap: 12 },
  metricCard: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  metricValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F4A2F",
    marginTop: 8,
  },
  metricLabel: { fontSize: 11, color: "#6B7280", marginTop: 4 },

  // Description
  descriptionText: { fontSize: 14, lineHeight: 22, color: "#4B5563" },

  // Accessibility
  accessibilityCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#F0FDF4",
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  accessibilityContent: { flex: 1 },
  accessibilityType: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  accessibilityDesc: { fontSize: 13, color: "#6B7280", lineHeight: 20 },

  // Land Classification
  classificationBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E0E7FF",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 10,
  },
  classificationText: { fontSize: 14, fontWeight: "700", color: "#3730A3" },

  // Species
  speciesCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#0F4A2F",
  },
  speciesHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  speciesRank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#0F4A2F",
    justifyContent: "center",
    alignItems: "center",
  },
  rankText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  speciesName: { fontSize: 15, fontWeight: "700", color: "#111827" },
  speciesDesc: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 20,
    marginBottom: 6,
  },
  speciesNotes: { fontSize: 12, color: "#0F4A2F", fontStyle: "italic" },

  // ✅ Map Styles for WebView
  mapWrapper: {
    height: 250,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  mapContainer: {
    width: "100%",
    height: "100%",
  },
  webview: {
    flex: 1,
  },

  // Apply Button
  applyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0F4A2F",
    marginHorizontal: 20,
    marginTop: 8,
    paddingVertical: 18,
    borderRadius: 16,
    gap: 10,
    shadowColor: "#0F4A2F",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  applyButtonText: { color: "#fff", fontSize: 17, fontWeight: "800" },

  // ✅ Disabled Apply Button Styles
  applyButtonDisabled: {
    backgroundColor: "#E5E7EB",
    shadowOpacity: 0,
    elevation: 0,
  },
  applyButtonTextDisabled: {
    color: "#9CA3AF",
    fontSize: 15,
    fontWeight: "700",
  },

  // ✅ Warning Banner
  warningBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF3C7",
    marginHorizontal: 20,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#F59E0B",
  },
  warningBannerText: {
    flex: 1,
    fontSize: 12,
    color: "#92400E",
    fontWeight: "600",
  },
});