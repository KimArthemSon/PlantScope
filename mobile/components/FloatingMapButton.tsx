import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Dimensions,
  Pressable,
} from "react-native";
import { WebView } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import { api } from "@/constants/url_fixed";
import { useNetworkStatus } from "@/utils/networkStatus";
import { useAlert } from "@/components/AlertContext";

const { height: screenHeight } = Dimensions.get("window");
const API_BASE_URL = api + "/api";

// 🌐 Official Hazard Tile URLs
const MGB_FLOOD_TILE_URL =
  "https://controlmap.mgb.gov.ph/arcgis/rest/services/GeospatialDataInventory/GDI_Detailed_Flood_Susceptibility/MapServer/tile/{z}/{y}/{x}";
const MGB_LANDSLIDE_TILE_URL =
  "https://controlmap.mgb.gov.ph/arcgis/rest/services/GeospatialDataInventory/GDI_Detailed_Rain_induced_Landslide_Susceptibility/MapServer/tile/{z}/{y}/{x}";

interface Barangay {
  barangay_id: number;
  name: string;
  coordinate: [number, number];
}

interface FloatingMapButtonProps {
  areaId: number;
  areaName?: string;
  siteId?: number;
  siteName?: string;
  userLat?: number;
  userLng?: number;
}

export default function FloatingMapButton({
  areaId,
  areaName,
  siteId,
  siteName,
  userLat,
  userLng,
}: FloatingMapButtonProps) {
  const [showMap, setShowMap] = useState(false);
  const [loading, setLoading] = useState(false);
  const [barangays, setBarangays] = useState<Barangay[]>([]);
  const [areaCoords, setAreaCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [siteCoords, setSiteCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(userLat && userLng ? { lat: userLat, lng: userLng } : null);

  // ✅ Barangay sheet state
  const [selectedBarangay, setSelectedBarangay] = useState<Barangay | null>(
    null,
  );
  const [showBarangaySheet, setShowBarangaySheet] = useState(false);
  const [loadingClassified, setLoadingClassified] = useState(false);
  const [loadingHazards, setLoadingHazards] = useState(false);

  // Layer toggles (only MGB tiles remain as global toggles)
  const [showFlood, setShowFlood] = useState(false);
  const [showLandslide, setShowLandslide] = useState(false);
  const [showLayerPanel, setShowLayerPanel] = useState(false);

  const webViewRef = useRef<any>(null);
  const isOnline = useNetworkStatus();
  const alertContext = useAlert();
  const alert = alertContext;

  // Update current location when userLat/userLng changes
  useEffect(() => {
    if (userLat && userLng) {
      setCurrentLocation({ lat: userLat, lng: userLng });
    }
  }, [userLat, userLng]);

  // Fetch basic map data when modal opens
  useEffect(() => {
    if (showMap) {
      fetchMapData();
    }
  }, [showMap]);

  // ✅ FIXED: Only fetch barangays, areas, and site (NOT classified/hazard)
  const fetchMapData = async () => {
    setLoading(true);
    try {
      const token = await SecureStore.getItemAsync("token");
      if (!token) {
        throw new Error("No authentication token");
      }
      const headers = { Authorization: `Bearer ${token}` };

      // ✅ Fetch barangays
      try {
        const barangaysRes = await fetch(`${API_BASE_URL}/get_barangay_list/`, {
          headers,
        });
        if (barangaysRes.ok) {
          const barangaysData = await barangaysRes.json();
          setBarangays(barangaysData.data || []);
        }
      } catch (e) {
        console.warn("Failed to fetch barangays:", e);
      }

      // ✅ Fetch assigned areas
      try {
        const areasRes = await fetch(
          `${API_BASE_URL}/get_assigned_reforestation_area/`,
          { headers },
        );
        if (areasRes.ok) {
          const areasData = await areasRes.json();
          const area = Array.isArray(areasData)
            ? areasData.find((a: any) => a.reforestation_area_id === areaId)
            : null;

          if (area?.coordinate) {
            if (Array.isArray(area.coordinate) && area.coordinate.length >= 2) {
              setAreaCoords({
                lat: Number(area.coordinate[0]),
                lng: Number(area.coordinate[1]),
              });
            } else if (area.coordinate.latitude) {
              setAreaCoords({
                lat: Number(area.coordinate.latitude),
                lng: Number(area.coordinate.longitude),
              });
            }
          }
        }
      } catch (e) {
        console.warn("Failed to fetch areas:", e);
      }

      // ✅ Fetch site coordinates
      if (siteId) {
        try {
          const siteRes = await fetch(`${API_BASE_URL}/get_site/${siteId}/`, {
            headers,
          });
          if (siteRes.ok) {
            const siteData = await siteRes.json();
            if (
              siteData?.center_coordinate &&
              siteData.center_coordinate.length === 2
            ) {
              setSiteCoords({
                lat: Number(siteData.center_coordinate[0]),
                lng: Number(siteData.center_coordinate[1]),
              });
            }
          }
        } catch (e) {
          console.warn("Failed to fetch site:", e);
        }
      }
    } catch (e) {
      console.error("Failed to fetch map data", e);
      alert?.error("Error", "Failed to load map data.");
    } finally {
      setLoading(false);
    }
  };

  const injectToWebView = (js: string) => {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(js + "; true;");
    }
  };

  // ✅ Handle messages from WebView (marker clicks)
  const onWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "marker_click" && data.category === "barangay") {
        const barangay = barangays.find((b) => b.barangay_id === data.id);
        if (barangay) {
          setSelectedBarangay(barangay);
          setShowBarangaySheet(true);
        }
      }
    } catch (e) {
      console.error("Error parsing WebView message", e);
    }
  };

  // Update map when data loads
  useEffect(() => {
    if (!showMap || loading) return;

    // Add area marker
    if (areaCoords) {
      injectToWebView(
        `window.updateMap('addArea', { id: ${areaId}, lat: ${areaCoords.lat}, lng: ${areaCoords.lng}, name: '${(areaName || "Area").replace(/'/g, "\\'")}' })`,
      );
    }

    // Add site marker
    if (siteCoords) {
      injectToWebView(
        `window.updateMap('addSite', { id: ${siteId}, lat: ${siteCoords.lat}, lng: ${siteCoords.lng}, name: '${(siteName || "Site").replace(/'/g, "\\'")}' })`,
      );
    }

    // Add user location
    if (currentLocation) {
      injectToWebView(
        `window.updateMap('addUserLocation', { lat: ${currentLocation.lat}, lng: ${currentLocation.lng} })`,
      );
    }

    // Add barangays
    if (barangays.length > 0) {
      const data = barangays.map((b) => ({
        id: b.barangay_id,
        lat: b.coordinate[0],
        lng: b.coordinate[1],
        name: b.name,
      }));
      injectToWebView(
        `window.updateMap('addBarangays', ${JSON.stringify(data)})`,
      );
    }

    // Fit bounds
    const points: string[] = [];
    if (areaCoords) points.push(`[${areaCoords.lat}, ${areaCoords.lng}]`);
    if (siteCoords) points.push(`[${siteCoords.lat}, ${siteCoords.lng}]`);
    if (currentLocation)
      points.push(`[${currentLocation.lat}, ${currentLocation.lng}]`);

    if (points.length > 1) {
      injectToWebView(`window.updateMap('fitBounds', [${points.join(",")}])`);
    } else if (points.length === 1) {
      const [lat, lng] = points[0].replace("[", "").replace("]", "").split(",");
      injectToWebView(
        `window.updateMap('flyTo', { lat: ${lat}, lng: ${lng}, zoom: 16 })`,
      );
    }
  }, [areaCoords, siteCoords, currentLocation, barangays, loading, showMap]);

  // Update hazard tile layers
  useEffect(() => {
    if (!showMap) return;
    injectToWebView(
      `window.updateHazardLayers({
        flood: { enabled: ${showFlood}, url: '${MGB_FLOOD_TILE_URL}', type: 'xyz' },
        landslide: { enabled: ${showLandslide}, url: '${MGB_LANDSLIDE_TILE_URL}', type: 'xyz' }
      })`,
    );
  }, [showFlood, showLandslide, showMap]);

  // ✅ Load classified areas for selected barangay
  const viewClassifiedAreas = async () => {
    if (!selectedBarangay) return;
    setLoadingClassified(true);

    try {
      const token = await SecureStore.getItemAsync("token");
      const res = await fetch(
        `${API_BASE_URL}/barangay/${selectedBarangay.barangay_id}/classified-areas/`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!res.ok) {
        throw new Error("Failed to fetch classified areas");
      }

      const data = await res.json();

      if (data.success && data.data && data.data.length > 0) {
        const polygons = data.data.map((area: any) => {
          const cls = area.land_classification?.name?.toLowerCase() || "";
          let color = "#dc2626";
          if (cls.includes("forest")) color = "#16a34a";
          else if (cls.includes("agricultural")) color = "#eab308";
          else if (cls.includes("residential")) color = "#2563eb";

          return {
            coordinates: area.polygon.coordinates,
            color,
            name: area.name,
            classification: area.land_classification?.name,
          };
        });

        injectToWebView(
          `window.updateMap('drawClassifiedPolygons', ${JSON.stringify(polygons)})`,
        );
        alert?.success(
          "Layers Loaded",
          "Classified areas are now visible on the map.",
        );
        setShowBarangaySheet(false);
      } else {
        alert?.warning(
          "No Data",
          "No classified areas found for this barangay.",
        );
      }
    } catch (e) {
      console.error("Failed to load classified areas:", e);
      alert?.error("Error", "Failed to load classified areas.");
    } finally {
      setLoadingClassified(false);
    }
  };

  // ✅ Load hazard areas for selected barangay
  const viewHazardAreas = async () => {
    if (!selectedBarangay) return;
    setLoadingHazards(true);

    try {
      const token = await SecureStore.getItemAsync("token");
      const res = await fetch(`${API_BASE_URL}/get_hazard_areas/`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error("Failed to fetch hazard areas");
      }

      const data = await res.json();

      if (data.data) {
        const hazards = data.data.filter(
          (h: any) => h.barangay_id === selectedBarangay.barangay_id,
        );

        if (hazards.length > 0) {
          const polygons = hazards.map((h: any) => {
            let color = "#6b7280";
            const type = h.hazard_type?.toUpperCase();
            if (type === "FLOOD") color = "#3b82f6";
            else if (type === "LANDSLIDE") color = "#ef4444";
            else if (type === "EARTHQUAKE") color = "#8b5cf6";

            return {
              coordinates: h.polygon.coordinates,
              color,
              name: h.name,
              type: h.hazard_type,
            };
          });

          injectToWebView(
            `window.updateMap('drawHazardPolygons', ${JSON.stringify(polygons)})`,
          );
          alert?.success(
            "Layers Loaded",
            `Showing ${hazards.length} hazard area(s) on the map.`,
          );
          setShowBarangaySheet(false);
        } else {
          alert?.warning("No Data", "No hazard areas found for this barangay.");
        }
      }
    } catch (e) {
      console.error("Failed to load hazard areas:", e);
      alert?.error("Error", "Failed to load hazard areas.");
    } finally {
      setLoadingHazards(false);
    }
  };

  // ✅ Clear all polygons
  const hidePolygons = () => {
    injectToWebView(`window.updateMap('clearPolygons')`);
    setShowBarangaySheet(false);
    alert?.info("Layers Hidden", "All polygon layers have been cleared.");
  };

  const recenterToUser = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        alert?.error("Permission Denied", "Location permission is required.");
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
      setCurrentLocation(coords);
      injectToWebView(
        `window.updateMap('flyTo', { lat: ${coords.lat}, lng: ${coords.lng}, zoom: 17 })`,
      );
    } catch (e) {
      console.error("Failed to get location", e);
      alert?.error("Error", "Failed to get your location.");
    }
  };

  // ✅ DON'T RENDER IF OFFLINE
  if (!isOnline) {
    return null;
  }

  const title = siteName
    ? `${siteName} (${areaName || "Area"})`
    : areaName || "Location Map";

  return (
    <>
      {/* 🎯 FLOATING ACTION BUTTON */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowMap(true)}
        activeOpacity={0.85}
      >
        <Ionicons name="map" size={24} color="#FFFFFF" />
      </TouchableOpacity>

      {/* 🗺️ FULL SCREEN MAP MODAL */}
      <Modal
        visible={showMap}
        animationType="slide"
        onRequestClose={() => setShowMap(false)}
      >
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setShowMap(false)}>
              <Ionicons name="close" size={28} color="#0F4A2F" />
            </TouchableOpacity>
            <View style={styles.headerTitleWrap}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {title}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowLayerPanel(!showLayerPanel)}
            >
              <Ionicons
                name={showLayerPanel ? "close-circle" : "layers-outline"}
                size={24}
                color="#0F4A2F"
              />
            </TouchableOpacity>
          </View>

          {/* Layer Panel (Only MGB tiles) */}
          {showLayerPanel && (
            <View style={styles.layerPanel}>
              <Text style={styles.layerPanelTitle}>Hazard Layers (MGB)</Text>

              <TouchableOpacity
                style={[
                  styles.layerToggle,
                  showFlood && styles.layerToggleActiveFlood,
                ]}
                onPress={() => setShowFlood(!showFlood)}
              >
                <Ionicons
                  name="water-outline"
                  size={18}
                  color={showFlood ? "#fff" : "#1565C0"}
                />
                <Text
                  style={[
                    styles.layerToggleText,
                    showFlood && styles.layerToggleTextActive,
                  ]}
                >
                  Flood Zones
                </Text>
                {showFlood && (
                  <Ionicons name="checkmark" size={18} color="#fff" />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.layerToggle,
                  showLandslide && styles.layerToggleActiveLandslide,
                ]}
                onPress={() => setShowLandslide(!showLandslide)}
              >
                <Ionicons
                  name="trail-sign-outline"
                  size={18}
                  color={showLandslide ? "#fff" : "#6D4C41"}
                />
                <Text
                  style={[
                    styles.layerToggleText,
                    showLandslide && styles.layerToggleTextActive,
                  ]}
                >
                  Landslide Zones
                </Text>
                {showLandslide && (
                  <Ionicons name="checkmark" size={18} color="#fff" />
                )}
              </TouchableOpacity>

              <View style={styles.infoBox}>
                <Ionicons name="information-circle" size={14} color="#6B7280" />
                <Text style={styles.infoText}>
                  Tap barangay markers to view classified areas and hazard zones
                </Text>
              </View>
            </View>
          )}

          {/* Map WebView */}
          <View style={styles.mapContainer}>
            {loading ? (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color="#0F4A2F" />
                <Text style={styles.loadingText}>Loading map data...</Text>
              </View>
            ) : (
              <WebView
                ref={webViewRef}
                source={{ html: mapHtml }}
                style={styles.map}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                originWhitelist={["*"]}
                startInLoadingState={true}
                onMessage={onWebViewMessage}
                renderLoading={() => (
                  <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color="#0F4A2F" />
                  </View>
                )}
              />
            )}
          </View>

          {/* Bottom Info Bar */}
          <View style={styles.infoBar}>
            <View style={styles.legendItem}>
              <View
                style={[styles.legendDot, { backgroundColor: "#3b82f6" }]}
              />
              <Text style={styles.legendText}>You</Text>
            </View>
            <View style={styles.legendItem}>
              <View
                style={[styles.legendDot, { backgroundColor: "#16a34a" }]}
              />
              <Text style={styles.legendText}>Site</Text>
            </View>
            <View style={styles.legendItem}>
              <View
                style={[styles.legendDot, { backgroundColor: "#eab308" }]}
              />
              <Text style={styles.legendText}>Area</Text>
            </View>
            <View style={styles.legendItem}>
              <View
                style={[styles.legendDot, { backgroundColor: "#f59e0b" }]}
              />
              <Text style={styles.legendText}>Barangay</Text>
            </View>
            <TouchableOpacity
              style={styles.recenterBtn}
              onPress={recenterToUser}
            >
              <Ionicons name="navigate" size={18} color="#fff" />
              <Text style={styles.recenterText}>My Location</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 🟡 BARANGAY ACTION SHEET */}
      <Modal
        transparent
        visible={showBarangaySheet}
        animationType="slide"
        onRequestClose={() => setShowBarangaySheet(false)}
      >
        <Pressable
          style={styles.sheetOverlay}
          onPress={() => setShowBarangaySheet(false)}
        >
          <Pressable
            style={styles.sheetContent}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.dragHandle} />
            <View style={styles.sheetHeader}>
              <Ionicons name="location" size={24} color="#eab308" />
              <Text style={styles.sheetTitle}>{selectedBarangay?.name}</Text>
            </View>
            <Text style={styles.sheetSubtitle}>Barangay Layers & Analysis</Text>

            <TouchableOpacity
              style={[
                styles.sheetActionBtn,
                loadingClassified && styles.sheetActionBtnDisabled,
              ]}
              onPress={viewClassifiedAreas}
              disabled={loadingClassified}
            >
              <View
                style={[styles.sheetIconWrap, { backgroundColor: "#dcfce7" }]}
              >
                {loadingClassified ? (
                  <ActivityIndicator size="small" color="#16a34a" />
                ) : (
                  <Ionicons name="layers" size={20} color="#16a34a" />
                )}
              </View>
              <View style={styles.sheetTextWrap}>
                <Text style={styles.sheetActionTitle}>
                  View Classified Areas
                </Text>
                <Text style={styles.sheetActionDesc}>
                  Show land use polygons
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.sheetActionBtn,
                loadingHazards && styles.sheetActionBtnDisabled,
              ]}
              onPress={viewHazardAreas}
              disabled={loadingHazards}
            >
              <View
                style={[styles.sheetIconWrap, { backgroundColor: "#fee2e2" }]}
              >
                {loadingHazards ? (
                  <ActivityIndicator size="small" color="#ef4444" />
                ) : (
                  <Ionicons name="warning" size={20} color="#ef4444" />
                )}
              </View>
              <View style={styles.sheetTextWrap}>
                <Text style={styles.sheetActionTitle}>View Hazard Areas</Text>
                <Text style={styles.sheetActionDesc}>
                  Show flood/landslide zones
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sheetActionBtn, { backgroundColor: "#f3f4f6" }]}
              onPress={hidePolygons}
            >
              <View
                style={[styles.sheetIconWrap, { backgroundColor: "#e5e7eb" }]}
              >
                <Ionicons name="eye-off" size={20} color="#6b7280" />
              </View>
              <Text style={[styles.sheetActionTitle, { color: "#6b7280" }]}>
                Hide All Layers
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

// 🌐 LEAFLET HTML
const mapHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    body { margin: 0; padding: 0; }
    #map { width: 100vw; height: 100vh; }
    .custom-div-icon { background: transparent; border: none; }
    .marker-pin {
      width: 30px; height: 30px; border-radius: 50% 50% 50% 0;
      background: #fff; position: absolute; transform: rotate(-45deg);
      left: 50%; top: 50%; margin: -15px 0 0 -15px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.3);
    }
    .marker-pin::after {
      content: ''; width: 24px; height: 24px; margin: 3px 0 0 3px;
      background: #fff; position: absolute; border-radius: 50%;
    }
    .marker-pin.yellow { background: #eab308; }
    .marker-pin.yellow::after { background: #fde047; }
    .marker-pin.green { background: #16a34a; }
    .marker-pin.green::after { background: #bbf7d0; }
    .marker-pin.blue { background: #2563eb; }
    .marker-pin.blue::after { background: #bfdbfe; }
    
    .icon-label {
      position: absolute; width: 30px; height: 30px;
      display: flex; align-items: center; justify-content: center;
      transform: rotate(45deg); font-weight: bold; font-size: 12px; color: #000;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map').setView([11.02, 124.61], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '© OSM'
    }).addTo(map);

    var markers = { barangay: {}, area: null, site: null, user: null };
    var polygonLayers = { classified: null, hazards: null };
    var hazardTiles = { flood: null, landslide: null };

    function createIcon(colorClass, label) {
      return L.divIcon({
        className: 'custom-div-icon',
        html: '<div class="marker-pin ' + colorClass + '"></div><div class="icon-label">' + label + '</div>',
        iconSize: [30, 30],
        iconAnchor: [15, 30]
      });
    }

    function sendClick(category, id) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'marker_click', category: category, id: id
      }));
    }

    window.updateMap = function(action, payload) {
      try {
        if (action === 'addBarangays') {
          payload.forEach(b => {
            if (markers.barangay[b.id]) map.removeLayer(markers.barangay[b.id]);
            var m = L.marker([b.lat, b.lng], { icon: createIcon('yellow', 'B') }).addTo(map);
            m.on('click', () => sendClick('barangay', b.id));
            m.bindPopup('<b>Barangay:</b> ' + b.name);
            markers.barangay[b.id] = m;
          });
        }
        else if (action === 'addArea') {
          if (markers.area) map.removeLayer(markers.area);
          markers.area = L.marker([payload.lat, payload.lng], {
            icon: L.divIcon({
              className: 'custom',
              html: '<div style="background:#eab308;width:32px;height:32px;border-radius:50%;border:4px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:bold;font-size:13px;">A</div>',
              iconSize: [32, 32], iconAnchor: [16, 16]
            })
          }).addTo(map).bindPopup('<b>Area:</b> ' + payload.name);
        }
        else if (action === 'addSite') {
          if (markers.site) map.removeLayer(markers.site);
          markers.site = L.marker([payload.lat, payload.lng], {
            icon: L.divIcon({
              className: 'custom',
              html: '<div style="background:#16a34a;width:36px;height:36px;border-radius:50%;border:4px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:bold;font-size:14px;">S</div>',
              iconSize: [36, 36], iconAnchor: [18, 18]
            })
          }).addTo(map).bindPopup('<b>Site:</b> ' + payload.name);
        }
        else if (action === 'addUserLocation') {
          if (markers.user) map.removeLayer(markers.user);
          markers.user = L.circleMarker([payload.lat, payload.lng], {
            radius: 10, color: '#ffffff', fillColor: '#3b82f6',
            fillOpacity: 1, weight: 3
          }).addTo(map).bindPopup('<b>You are here</b>');
        }
        else if (action === 'flyTo') {
          map.flyTo([payload.lat, payload.lng], payload.zoom || 16);
        }
        else if (action === 'fitBounds') {
          map.fitBounds(payload, { padding: [50, 50], maxZoom: 17 });
        }
        else if (action === 'drawClassifiedPolygons') {
          if (polygonLayers.classified) map.removeLayer(polygonLayers.classified);
          var group = L.layerGroup();
          payload.forEach(p => {
            L.polygon(p.coordinates, {
              color: p.color, fillColor: p.color, fillOpacity: 0.35, weight: 2
            }).bindPopup('<b>' + p.name + '</b><br>Class: ' + p.classification).addTo(group);
          });
          group.addTo(map);
          polygonLayers.classified = group;
        }
        else if (action === 'drawHazardPolygons') {
          if (polygonLayers.hazards) map.removeLayer(polygonLayers.hazards);
          var group = L.layerGroup();
          payload.forEach(p => {
            L.polygon(p.coordinates, {
              color: p.color, fillColor: p.color, fillOpacity: 0.35, weight: 2
            }).bindPopup('<b>' + p.name + '</b><br>Type: ' + p.type).addTo(group);
          });
          group.addTo(map);
          polygonLayers.hazards = group;
        }
        else if (action === 'clearPolygons') {
          if (polygonLayers.classified) { map.removeLayer(polygonLayers.classified); polygonLayers.classified = null; }
          if (polygonLayers.hazards) { map.removeLayer(polygonLayers.hazards); polygonLayers.hazards = null; }
        }
      } catch (e) {
        console.error('updateMap error:', e);
      }
    };

    var transparentPixel = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

    window.updateHazardLayers = function(config) {
      if (hazardTiles.flood) { map.removeLayer(hazardTiles.flood); hazardTiles.flood = null; }
      if (hazardTiles.landslide) { map.removeLayer(hazardTiles.landslide); hazardTiles.landslide = null; }
      
      if (config.flood && config.flood.enabled) {
        hazardTiles.flood = L.tileLayer(config.flood.url, {
          opacity: 0.7, maxZoom: 19, maxNativeZoom: 17, errorTileUrl: transparentPixel
        }).addTo(map);
      }
      if (config.landslide && config.landslide.enabled) {
        hazardTiles.landslide = L.tileLayer(config.landslide.url, {
          opacity: 0.7, maxZoom: 19, maxNativeZoom: 17, errorTileUrl: transparentPixel
        }).addTo(map);
      }
    };
  </script>
</body>
</html>
`;

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: 20,
    bottom: 100,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#0F4A2F",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    zIndex: 100,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: "center",
    marginHorizontal: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F4A2F",
  },
  layerPanel: {
    backgroundColor: "#F9FAFB",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  layerPanelTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6B7280",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  layerToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 6,
  },
  layerToggleActiveFlood: {
    backgroundColor: "#1565C0",
    borderColor: "#1565C0",
  },
  layerToggleActiveLandslide: {
    backgroundColor: "#6D4C41",
    borderColor: "#6D4C41",
  },
  layerToggleText: {
    flex: 1,
    fontSize: 13,
    color: "#111",
    fontWeight: "600",
  },
  layerToggleTextActive: { color: "#fff" },
  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F3F4F6",
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 11,
    color: "#6B7280",
  },
  mapContainer: {
    flex: 1,
    position: "relative",
  },
  map: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  loadingText: {
    fontSize: 13,
    color: "#0F4A2F",
    fontWeight: "600",
    marginTop: 10,
  },
  infoBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    gap: 12,
    paddingBottom: 32,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 11,
    color: "#4B5563",
    fontWeight: "600",
  },
  recenterBtn: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#0F4A2F",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  recenterText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  // Sheet styles
  sheetOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheetContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
  },
  dragHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#E5E7EB",
    alignSelf: "center",
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111",
    flex: 1,
  },
  sheetSubtitle: {
    fontSize: 13,
    color: "#6b7280",
    marginBottom: 20,
  },
  sheetActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: 12,
  },
  sheetActionBtnDisabled: {
    opacity: 0.6,
  },
  sheetIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  sheetTextWrap: {
    flex: 1,
  },
  sheetActionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111",
  },
  sheetActionDesc: {
    fontSize: 11,
    color: "#6b7280",
    marginTop: 2,
  },
});
