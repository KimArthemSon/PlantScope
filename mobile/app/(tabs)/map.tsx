import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  Modal,
  TextInput,
  ScrollView,
  Dimensions,
  Pressable,
  Image,
} from "react-native";
import { WebView } from "react-native-webview";
import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "@/constants/url_fixed";
import { useAlert } from "@/components/AlertContext";

const API_BASE_URL = api + "/api";
const { height: screenHeight, width: screenWidth } = Dimensions.get("window");

// 🌐 Official Hazard Tile URLs
const MGB_FLOOD_TILE_URL =
  "https://controlmap.mgb.gov.ph/arcgis/rest/services/GeospatialDataInventory/GDI_Detailed_Flood_Susceptibility/MapServer/tile/{z}/{y}/{x}";
const MGB_LANDSLIDE_TILE_URL =
  "https://controlmap.mgb.gov.ph/arcgis/rest/services/GeospatialDataInventory/GDI_Detailed_Rain_induced_Landslide_Susceptibility/MapServer/tile/{z}/{y}/{x}";
const PHIVOLCS_EIL_WMS_URL =
  "https://gisweb.phivolcs.dost.gov.ph/arcgis/services/PHIVOLCSPublic/EarthquakeInducedLandslide/MapServer/WMSServer";

// 📊 Interfaces
interface Barangay {
  barangay_id: number;
  name: string;
  coordinate: [number, number];
}
interface ReforestationArea {
  reforestation_area_id: number;
  name: string;
  description: string | null;
  coordinate: [number, number] | null;
}
interface Site {
  site_id: number;
  name: string;
  reforestation_area_id: number;
  center_coordinate: [number, number] | null;
  status: string;
  ndvi_value?: number;
  total_area_hectares?: number;
}
interface SiteApplication {
  application_id: number;
  title: string;
  status: string;
  organization_name: string;
  total_members: number | null;
  orientation_date: string | null;
}

export default function MapScreen() {
  const router = useRouter();
  const webViewRef = useRef<any>(null);

  // ✅ Safely get alert context
  const alertContext = useAlert();
  const alert = alertContext;

  // 🗺️ Map Data State
  const [barangays, setBarangays] = useState<Barangay[]>([]);
  const [areas, setAreas] = useState<ReforestationArea[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSites, setLoadingSites] = useState(false);

  // 🔍 Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showBarangayDropdown, setShowBarangayDropdown] = useState(false);

  // 📱 Bottom Sheet State
  const [activeSheet, setActiveSheet] = useState<
    "none" | "barangay" | "area" | "site" | "assessment"
  >("none");
  const [selectedBarangay, setSelectedBarangay] = useState<Barangay | null>(
    null,
  );
  const [selectedArea, setSelectedArea] = useState<ReforestationArea | null>(
    null,
  );
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);

  // 📋 Site Details State
  const [siteDetails, setSiteDetails] = useState<any>(null);
  const [siteApplications, setSiteApplications] = useState<SiteApplication[]>(
    [],
  );
  const [loadingSiteDetails, setLoadingSiteDetails] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // 🌊 Hazard Layers State
  const [showFlood, setShowFlood] = useState(false);
  const [showLandslide, setShowLandslide] = useState(false);
  const [showEarthquakeLandslide, setShowEarthquakeLandslide] = useState(false);

  // 📍 User Location State
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [isLocationEnabled, setIsLocationEnabled] = useState(false);

  // ==========================================
  // 🔄 DATA FETCHING & INITIALIZATION
  // ==========================================

  useEffect(() => {
    // Only fetch map data on load. Location is now handled manually via button.
    fetchInitialMapData();
  }, []);

  const fetchInitialMapData = async () => {
    setLoading(true);
    try {
      const token = await SecureStore.getItemAsync("token");
      const headers = { Authorization: `Bearer ${token}` };

      const [bRes, assignedAreasRes] = await Promise.all([
        fetch(`${API_BASE_URL}/get_barangay_list/`, { headers }),
        fetch(`${API_BASE_URL}/get_assigned_reforestation_area/`, { headers }),
      ]);

      const bData = await bRes.json();
      const assignedAreasData = await assignedAreasRes.json();

      setBarangays(bData.data || []);

      const rawAreas = Array.isArray(assignedAreasData)
        ? assignedAreasData
        : [];
      const mappedAreas: ReforestationArea[] = rawAreas.map((item: any) => {
        let coord: [number, number] | null = null;
        if (Array.isArray(item.coordinate) && item.coordinate.length >= 2) {
          coord = [Number(item.coordinate[0]), Number(item.coordinate[1])];
        } else if (item.coordinate && typeof item.coordinate === "object") {
          coord = [
            Number(item.coordinate.latitude || 0),
            Number(item.coordinate.longitude || 0),
          ];
        }
        return {
          reforestation_area_id: Number(item.reforestation_area_id),
          name: item.name || "Unnamed Area",
          description: item.description || null,
          coordinate: coord,
        };
      });
      setAreas(mappedAreas);
      setSites([]);
    } catch (e) {
      console.error("Failed to fetch map data", e);
      alert?.error(
        "Error",
        "Failed to load map data. Please check your connection.",
      );
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // 📡 WEBVIEW COMMUNICATION
  // ==========================================

  const injectToWebView = (js: string) => {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(js + "; true;");
    }
  };

  useEffect(() => {
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
  }, [barangays]);

  useEffect(() => {
    if (areas.length > 0) {
      const data = areas
        .filter((a) => a.coordinate)
        .map((a) => ({
          id: a.reforestation_area_id,
          lat: a.coordinate![0],
          lng: a.coordinate![1],
          name: a.name,
        }));
      injectToWebView(`window.updateMap('addAreas', ${JSON.stringify(data)})`);
    }
  }, [areas]);

  useEffect(() => {
    injectToWebView(`window.updateHazardLayers({
      flood: { enabled: ${showFlood}, url: '${MGB_FLOOD_TILE_URL}', type: 'xyz' },
      landslide: { enabled: ${showLandslide}, url: '${MGB_LANDSLIDE_TILE_URL}', type: 'xyz' },
      earthquakeLandslide: { enabled: ${showEarthquakeLandslide}, url: '${PHIVOLCS_EIL_WMS_URL}', type: 'wms' }
    })`);
  }, [showFlood, showLandslide, showEarthquakeLandslide]);

  const onWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "marker_click") {
        handleMarkerClick(data.category, data.id);
      }
    } catch (e) {
      console.error("Error parsing WebView message", e);
    }
  };

  const handleMarkerClick = (category: string, id: number) => {
    if (category === "barangay") {
      const b = barangays.find((x) => x.barangay_id === id);
      if (b) {
        setSelectedBarangay(b);
        setActiveSheet("barangay");
      }
    } else if (category === "area") {
      const a = areas.find((x) => x.reforestation_area_id === id);
      if (a) {
        setSelectedArea(a);
        setActiveSheet("area");
      }
    } else if (category === "site") {
      const s = sites.find((x) => x.site_id === id);
      if (s) {
        setSelectedSite(s);
        setActiveSheet("site");
        fetchSiteDetails(id);
      }
    }
  };

  // ==========================================
  // 🛠️ ACTION HANDLERS
  // ==========================================

  const toggleUserLocation = async () => {
    if (isLocationEnabled) {
      // Turn OFF location
      setIsLocationEnabled(false);
      setUserLocation(null);
      injectToWebView(`window.updateMap('clearUserLocation')`);
    } else {
      // Turn ON location
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          const coords = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          };
          setUserLocation(coords);
          setIsLocationEnabled(true);
          
          // Add marker to map and fly to it
          injectToWebView(
            `window.updateMap('addUserLocation', { lat: ${coords.latitude}, lng: ${coords.longitude} })`
          );
          injectToWebView(
            `window.updateMap('flyTo', { lat: ${coords.latitude}, lng: ${coords.longitude}, zoom: 16 })`
          );
        } else {
          alert?.error(
            "Permission Denied",
            "Location permission is required to show your position."
          );
        }
      } catch (error) {
        console.error("Error getting location", error);
        alert?.error("Error", "Failed to get your location.");
      }
    }
  };

  const loadSitesForArea = async (areaId: number) => {
    setLoadingSites(true);
    try {
      const token = await SecureStore.getItemAsync("token");
      const res = await fetch(`${API_BASE_URL}/get_all_sites/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const allSites = data.data || [];
      const filteredSites = allSites.filter(
        (s: any) => Number(s.reforestation_area_id) === areaId,
      );

      setSites(filteredSites);
      injectToWebView(`window.updateMap('clearSites')`);

      if (filteredSites.length > 0) {
        const siteData = filteredSites
          .filter(
            (s: any) => s.center_coordinate && s.center_coordinate.length === 2,
          )
          .map((s: any) => ({
            id: s.site_id,
            lat: Number(s.center_coordinate[0]),
            lng: Number(s.center_coordinate[1]),
            name: s.name,
            areaId: s.reforestation_area_id,
            status: s.status,
          }));
        injectToWebView(
          `window.updateMap('addSites', ${JSON.stringify(siteData)})`,
        );
        alert?.success(
          "Sites Loaded",
          `Found ${filteredSites.length} site(s) in this area.`,
        );
      } else {
        alert?.warning(
          "No Sites",
          "No sites found in this reforestation area.",
        );
      }
    } catch (e) {
      console.error("Failed to load sites", e);
      alert?.error("Error", "Failed to load sites for this area.");
    } finally {
      setLoadingSites(false);
    }
  };

  const loadAllSites = async () => {
    setLoadingSites(true);
    try {
      const token = await SecureStore.getItemAsync("token");
      const res = await fetch(`${API_BASE_URL}/get_all_sites/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const allSites = data.data || [];

      const assignedAreaIds = new Set(
        areas.map((a) => a.reforestation_area_id),
      );
      const filteredSites = allSites.filter((s: any) =>
        assignedAreaIds.has(Number(s.reforestation_area_id)),
      );

      setSites(filteredSites);
      injectToWebView(`window.updateMap('clearSites')`);

      if (filteredSites.length > 0) {
        const siteData = filteredSites
          .filter(
            (s: any) => s.center_coordinate && s.center_coordinate.length === 2,
          )
          .map((s: any) => ({
            id: s.site_id,
            lat: Number(s.center_coordinate[0]),
            lng: Number(s.center_coordinate[1]),
            name: s.name,
            areaId: s.reforestation_area_id,
            status: s.status,
          }));
        injectToWebView(
          `window.updateMap('addSites', ${JSON.stringify(siteData)})`,
        );
        alert?.success(
          "Sites Loaded",
          `Showing all ${filteredSites.length} site(s) from your assigned areas.`,
        );
      } else {
        alert?.warning("No Sites", "No sites found in your assigned areas.");
      }
    } catch (e) {
      console.error("Failed to load sites", e);
      alert?.error("Error", "Failed to load sites.");
    } finally {
      setLoadingSites(false);
    }
  };

  const fetchSiteDetails = async (siteId: number) => {
    setLoadingSiteDetails(true);
    try {
      const token = await SecureStore.getItemAsync("token");
      const headers = { Authorization: `Bearer ${token}` };

      const [detailsRes, appsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/get_site/${siteId}/`, { headers }),
        fetch(`${API_BASE_URL}/get_site_applications/${siteId}/`, { headers }),
      ]);

      setSiteDetails(await detailsRes.json());
      const appsData = await appsRes.json();
      setSiteApplications(appsData.applications || []);
      setCurrentImageIndex(0);
    } catch (e) {
      console.error("Failed to fetch site details", e);
      alert?.error("Error", "Failed to fetch site details.");
    } finally {
      setLoadingSiteDetails(false);
    }
  };

  const viewClassifiedAreas = async () => {
    if (!selectedBarangay) return;
    try {
      const token = await SecureStore.getItemAsync("token");
      const res = await fetch(
        `${API_BASE_URL}/barangay/${selectedBarangay.barangay_id}/classified-areas/`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await res.json();
      if (data.success && data.data) {
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
      } else {
        alert?.warning(
          "No Data",
          "No classified areas found for this barangay.",
        );
      }
    } catch (e) {
      console.error(e);
      alert?.error("Error", "Failed to load classified areas.");
    }
  };

  const viewHazardAreas = async () => {
    if (!selectedBarangay) return;
    try {
      const token = await SecureStore.getItemAsync("token");
      const res = await fetch(`${API_BASE_URL}/get_hazard_areas/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
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
        } else {
          alert?.warning("No Data", "No hazard areas found for this barangay.");
        }
      }
    } catch (e) {
      console.error(e);
      alert?.error("Error", "Failed to load hazard areas.");
    }
  };

  const hidePolygons = () => {
    injectToWebView(`window.updateMap('clearPolygons')`);
    setActiveSheet("none");
    alert?.info(
      "Layers Hidden",
      "All polygon layers have been cleared from the map.",
    );
  };

  const viewSitesForArea = () => {
    if (!selectedArea) return;
    if (selectedArea.coordinate) {
      injectToWebView(
        `window.updateMap('flyTo', { lat: ${selectedArea.coordinate[0]}, lng: ${selectedArea.coordinate[1]}, zoom: 16 })`,
      );
    }
    setActiveSheet("none");
    loadSitesForArea(selectedArea.reforestation_area_id);
  };

  const showAllSites = () => {
    setActiveSheet("none");
    loadAllSites();
  };

  const handleGeneralAssessment = () => {
    if (selectedArea) {
      router.push({
        pathname: "/feedbacks/site_field_assessment",
        params: {
          areaId: selectedArea.reforestation_area_id,
          areaName: selectedArea.name,
          assessmentType: "general",
        },
      });
    }
    setActiveSheet("none");
  };

  const handleSpecificAssessment = () => {
    if (selectedArea) {
      router.push({
        pathname: "/feedbacks/select_site",
        params: {
          areaId: selectedArea.reforestation_area_id,
          areaName: selectedArea.name,
          assessmentType: "specific",
        },
      });
    }
    setActiveSheet("none");
  };

  // ==========================================
  // 🎨 RENDER UI
  // ==========================================

  const filteredAreas = areas.filter((a) =>
    a.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );
  const generalImages =
    siteDetails?.site_images?.filter(
      (img: any) => img.layer_tag === "general",
    ) || [];

  return (
    <View style={styles.container}>
      {/* 🗺️ WEBVIEW MAP */}
      <WebView
        ref={webViewRef}
        source={{ html: mapHtml }}
        style={styles.map}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        mixedContentMode="always"
        originWhitelist={["*"]}
        startInLoadingState={true}
        onMessage={onWebViewMessage}
        incognito={true}
      />

      {/* 🎛️ FILTER BUTTON (Top Right) */}
      <TouchableOpacity
        style={styles.filterBtn}
        onPress={() => setShowFilterPanel(!showFilterPanel)}
        activeOpacity={0.8}
      >
        <Ionicons
          name={showFilterPanel ? "close" : "funnel"}
          size={20}
          color="#fff"
        />
      </TouchableOpacity>

      {/* 🎛️ FILTER PANEL (Collapsible) */}
      {showFilterPanel && (
        <View style={styles.filterPanel}>
          <View style={styles.filterPanelHeader}>
            <Text style={styles.filterPanelTitle}>Filters & Navigation</Text>
            <TouchableOpacity onPress={() => setShowFilterPanel(false)}>
              <Ionicons name="close-circle" size={22} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          {/* 🔍 Search Area */}
          <Text style={styles.filterSectionTitle}>Search My Areas</Text>
          <View style={styles.searchInputWrap}>
            <Ionicons
              name="search"
              size={16}
              color="#6B7280"
              style={{ marginRight: 8 }}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Type area name..."
              placeholderTextColor="#9ca3af"
              value={searchQuery}
              onChangeText={(text) => {
                setSearchQuery(text);
                setShowSearchResults(text.length > 0);
              }}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery("");
                  setShowSearchResults(false);
                }}
              >
                <Ionicons name="close-circle" size={16} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
          {showSearchResults && (
            <View style={styles.searchDropdown}>
              <ScrollView
                style={{ maxHeight: 120 }}
                showsVerticalScrollIndicator={false}
              >
                {filteredAreas.slice(0, 4).map((area) => (
                  <TouchableOpacity
                    key={area.reforestation_area_id}
                    style={styles.searchResultItem}
                    onPress={() => {
                      if (area.coordinate) {
                        injectToWebView(
                          `window.updateMap('flyTo', { lat: ${area.coordinate[0]}, lng: ${area.coordinate[1]}, zoom: 16 })`,
                        );
                        setSelectedArea(area);
                        setActiveSheet("area");
                      }
                      setShowSearchResults(false);
                      setSearchQuery("");
                      setShowFilterPanel(false);
                    }}
                  >
                    <Ionicons name="location" size={14} color="#16a34a" />
                    <Text style={styles.searchResultText} numberOfLines={1}>
                      {area.name}
                    </Text>
                  </TouchableOpacity>
                ))}
                {filteredAreas.length === 0 && (
                  <Text style={styles.noResults}>No areas found</Text>
                )}
              </ScrollView>
            </View>
          )}

          {/* 🏘️ Barangay Dropdown */}
          <Text style={styles.filterSectionTitle}>Fly to Barangay</Text>
          <TouchableOpacity
            style={styles.dropdownBtn}
            onPress={() => setShowBarangayDropdown(!showBarangayDropdown)}
          >
            <Ionicons name="storefront-outline" size={16} color="#eab308" />
            <Text style={styles.dropdownBtnText} numberOfLines={1}>
              Select Barangay...
            </Text>
            <Ionicons
              name={showBarangayDropdown ? "chevron-up" : "chevron-down"}
              size={16}
              color="#6b7280"
            />
          </TouchableOpacity>
          {showBarangayDropdown && (
            <View style={styles.dropdownList}>
              <ScrollView
                style={{ maxHeight: 150 }}
                showsVerticalScrollIndicator={false}
              >
                {barangays.map((b) => (
                  <TouchableOpacity
                    key={b.barangay_id}
                    style={styles.dropdownItem}
                    onPress={() => {
                      if (b.coordinate) {
                        injectToWebView(
                          `window.updateMap('flyTo', { lat: ${b.coordinate[0]}, lng: ${b.coordinate[1]}, zoom: 15 })`,
                        );
                        setSelectedBarangay(b);
                        setActiveSheet("barangay");
                      }
                      setShowBarangayDropdown(false);
                      setShowFilterPanel(false);
                    }}
                  >
                    <Text style={styles.dropdownItemText}>{b.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* 🌊 Hazard Layers */}
          <Text style={styles.filterSectionTitle}>Hazard Layers</Text>
          <View style={styles.layerBtnRow}>
            <TouchableOpacity
              style={[
                styles.layerBtnSmall,
                showFlood && styles.layerBtnActiveFlood,
              ]}
              onPress={() => setShowFlood(!showFlood)}
            >
              <Ionicons
                name="water-outline"
                size={14}
                color={showFlood ? "#fff" : "#1565C0"}
              />
              <Text
                style={[
                  styles.layerBtnTextSmall,
                  showFlood && styles.layerBtnTextActive,
                ]}
              >
                Flood
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.layerBtnSmall,
                showLandslide && styles.layerBtnActiveLandslide,
              ]}
              onPress={() => setShowLandslide(!showLandslide)}
            >
              <Ionicons
                name="trail-sign-outline"
                size={14}
                color={showLandslide ? "#fff" : "#6D4C41"}
              />
              <Text
                style={[
                  styles.layerBtnTextSmall,
                  showLandslide && styles.layerBtnTextActive,
                ]}
              >
                Landslide
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.layerBtnSmall,
                showEarthquakeLandslide && styles.layerBtnActiveEQ,
              ]}
              onPress={() =>
                setShowEarthquakeLandslide(!showEarthquakeLandslide)
              }
            >
              <Ionicons
                name="flash-outline"
                size={14}
                color={showEarthquakeLandslide ? "#fff" : "#C62828"}
              />
              <Text
                style={[
                  styles.layerBtnTextSmall,
                  showEarthquakeLandslide && styles.layerBtnTextActive,
                ]}
              >
                EQ
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 📍 TOGGLE LOCATION BUTTON */}
      <TouchableOpacity
        style={[
          styles.recenterBtn,
          isLocationEnabled && { backgroundColor: "#2563eb" },
        ]}
        onPress={toggleUserLocation}
      >
        <Ionicons
          name={isLocationEnabled ? "navigate" : "navigate-outline"}
          size={20}
          color="#fff"
        />
      </TouchableOpacity>

      {/* ⏳ LOADING OVERLAY */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#0F4A2F" />
          <Text style={styles.loadingText}>Loading Map Data...</Text>
        </View>
      )}

      {/* ✅ Loading Sites Indicator */}
      {loadingSites && (
        <View style={styles.loadingSitesOverlay}>
          <ActivityIndicator size="small" color="#fff" />
          <Text style={styles.loadingSitesText}>Loading sites...</Text>
        </View>
      )}

      {/* ========================================== */}
      {/* 📱 BOTTOM SHEETS                           */}
      {/* ========================================== */}

      {/* 🟡 BARANGAY SHEET */}
      <Modal
        transparent
        visible={activeSheet === "barangay"}
        animationType="slide"
        onRequestClose={() => setActiveSheet("none")}
      >
        <Pressable
          style={styles.sheetOverlay}
          onPress={() => setActiveSheet("none")}
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
              style={styles.sheetActionBtn}
              onPress={viewClassifiedAreas}
            >
              <View
                style={[styles.sheetIconWrap, { backgroundColor: "#dcfce7" }]}
              >
                <Ionicons name="layers" size={20} color="#16a34a" />
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
              style={styles.sheetActionBtn}
              onPress={viewHazardAreas}
            >
              <View
                style={[styles.sheetIconWrap, { backgroundColor: "#fee2e2" }]}
              >
                <Ionicons name="warning" size={20} color="#ef4444" />
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

      {/* 🟢 AREA SHEET */}
      <Modal
        transparent
        visible={activeSheet === "area"}
        animationType="slide"
        onRequestClose={() => setActiveSheet("none")}
      >
        <Pressable
          style={styles.sheetOverlay}
          onPress={() => setActiveSheet("none")}
        >
          <Pressable
            style={styles.sheetContent}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.dragHandle} />
            <View style={styles.sheetHeader}>
              <Ionicons name="leaf" size={24} color="#16a34a" />
              <Text style={styles.sheetTitle}>{selectedArea?.name}</Text>
            </View>
            {selectedArea?.description && (
              <Text style={styles.sheetDesc}>{selectedArea.description}</Text>
            )}

            <View style={styles.areaBtnRow}>
              <TouchableOpacity
                style={[
                  styles.areaBtnOutline,
                  loadingSites && styles.areaBtnDisabled,
                ]}
                onPress={viewSitesForArea}
                disabled={loadingSites}
              >
                {loadingSites ? (
                  <ActivityIndicator size="small" color="#0F4A2F" />
                ) : (
                  <>
                    <Ionicons name="eye" size={18} color="#0F4A2F" />
                    <Text style={styles.areaBtnOutlineText}>View Sites</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.areaBtnOutline,
                  loadingSites && styles.areaBtnDisabled,
                ]}
                onPress={showAllSites}
                disabled={loadingSites}
              >
                <Ionicons name="globe" size={18} color="#0F4A2F" />
                <Text style={styles.areaBtnOutlineText}>Show All</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.startAssessmentBtn}
              onPress={() => setActiveSheet("assessment")}
            >
              <Ionicons name="clipboard" size={20} color="#fff" />
              <Text style={styles.startAssessmentText}>
                Start Field Assessment
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 🔵 SITE SHEET */}
      <Modal
        transparent
        visible={activeSheet === "site"}
        animationType="slide"
        onRequestClose={() => setActiveSheet("none")}
      >
        <Pressable
          style={styles.sheetOverlay}
          onPress={() => setActiveSheet("none")}
        >
          <Pressable
            style={[styles.sheetContent, { maxHeight: screenHeight * 0.85 }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.dragHandle} />
            {loadingSiteDetails ? (
              <View style={{ padding: 40, alignItems: "center" }}>
                <ActivityIndicator size="large" color="#0F4A2F" />
              </View>
            ) : siteDetails ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.sheetHeader}>
                  <Ionicons name="map-pin" size={24} color="#2563eb" />
                  <Text
                    style={[styles.sheetTitle, { flex: 1 }]}
                    numberOfLines={1}
                  >
                    {siteDetails.name}
                  </Text>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: getStatusColor(siteDetails.status) },
                    ]}
                  >
                    <Text style={styles.statusBadgeText}>
                      {siteDetails.status.replace("_", " ")}
                    </Text>
                  </View>
                </View>

                {generalImages.length > 0 ? (
                  <View style={styles.carouselContainer}>
                    <Image
                      source={{ uri: generalImages[currentImageIndex].img_url }}
                      style={styles.carouselImage}
                    />
                    {generalImages.length > 1 && (
                      <>
                        <TouchableOpacity
                          style={[styles.carouselBtn, { left: 10 }]}
                          onPress={() =>
                            setCurrentImageIndex(
                              (prev) =>
                                (prev - 1 + generalImages.length) %
                                generalImages.length,
                            )
                          }
                        >
                          <Ionicons
                            name="chevron-back"
                            size={20}
                            color="#fff"
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.carouselBtn, { right: 10 }]}
                          onPress={() =>
                            setCurrentImageIndex(
                              (prev) => (prev + 1) % generalImages.length,
                            )
                          }
                        >
                          <Ionicons
                            name="chevron-forward"
                            size={20}
                            color="#fff"
                          />
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                ) : (
                  <View style={styles.noImageBox}>
                    <Ionicons name="image-outline" size={40} color="#d1d5db" />
                    <Text style={{ color: "#9ca3af", marginTop: 8 }}>
                      No Images
                    </Text>
                  </View>
                )}

                <View style={styles.statsRow}>
                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>NDVI</Text>
                    <Text style={styles.statValue}>
                      {siteDetails.ndvi_value?.toFixed(3) || "N/A"}
                    </Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>Area (ha)</Text>
                    <Text style={styles.statValue}>
                      {siteDetails.total_area_hectares?.toFixed(2) || "N/A"}
                    </Text>
                  </View>
                </View>

                <Text style={styles.sectionTitle}>
                  Tree Planting Programs ({siteApplications.length})
                </Text>
                {siteApplications.length === 0 ? (
                  <Text style={styles.emptyText}>
                    No programs assigned to this site yet.
                  </Text>
                ) : (
                  siteApplications.map((app) => (
                    <View key={app.application_id} style={styles.appCard}>
                      <Text style={styles.appTitle}>{app.title}</Text>
                      <View style={styles.appRow}>
                        <Ionicons name="people" size={14} color="#6b7280" />
                        <Text style={styles.appText}>
                          {app.organization_name}
                        </Text>
                      </View>
                      <View style={styles.appRow}>
                        <Ionicons name="ribbon" size={14} color="#6b7280" />
                        <Text style={styles.appText}>
                          {app.status.replace("_", " ")}
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </ScrollView>
            ) : (
              <Text style={styles.emptyText}>Failed to load site details.</Text>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* 📋 ASSESSMENT ACTION SHEET */}
      <Modal
        transparent
        visible={activeSheet === "assessment"}
        animationType="slide"
        onRequestClose={() => setActiveSheet("none")}
      >
        <Pressable
          style={styles.sheetOverlay}
          onPress={() => setActiveSheet("none")}
        >
          <Pressable
            style={styles.sheetContent}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.dragHandle} />
            <Text style={styles.sheetTitleCenter}>Choose Assessment Type</Text>
            <Text style={styles.sheetSubtitleCenter}>
              Are you assessing the entire area or a specific site?
            </Text>

            <TouchableOpacity
              style={styles.assessmentOption}
              onPress={handleGeneralAssessment}
            >
              <View style={styles.assessmentIconWrap}>
                <Ionicons name="globe-outline" size={24} color="#0F4A2F" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.assessmentTitle}>General Assessment</Text>
                <Text style={styles.assessmentDesc}>
                  For the whole reforestation area.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.assessmentOption}
              onPress={handleSpecificAssessment}
            >
              <View style={styles.assessmentIconWrap}>
                <Ionicons name="location-outline" size={24} color="#0F4A2F" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.assessmentTitle}>
                  Specific Site Assessment
                </Text>
                <Text style={styles.assessmentDesc}>
                  For a specific marked site.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>

            <Pressable
              style={styles.cancelBtn}
              onPress={() => setActiveSheet("none")}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ==========================================
// 🎨 STYLES
// ==========================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  map: { flex: 1, width: "100%", height: "100%" },

  // Filter Button & Panel
  filterBtn: {
    position: "absolute",
    top: 50,
    right: 16,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#0F4A2F",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
    zIndex: 1000,
  },
  filterPanel: {
    position: "absolute",
    top: 106,
    right: 16,
    width: screenWidth * 0.85,
    maxWidth: 340,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 999,
    maxHeight: screenHeight * 0.75,
  },
  filterPanelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  filterPanelTitle: { fontSize: 16, fontWeight: "800", color: "#111" },
  filterSectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6b7280",
    textTransform: "uppercase",
    marginBottom: 8,
    marginTop: 12,
  },

  // Search inside Filter
  searchInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: { flex: 1, fontSize: 13, color: "#111" },
  searchDropdown: {
    backgroundColor: "#fff",
    marginTop: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    overflow: "hidden",
  },
  searchResultItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    gap: 8,
  },
  searchResultText: { fontSize: 13, color: "#111", flex: 1 },
  noResults: {
    padding: 10,
    textAlign: "center",
    color: "#9ca3af",
    fontSize: 12,
  },

  // Barangay Dropdown
  dropdownBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fefce8",
    borderWidth: 1,
    borderColor: "#fde047",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  dropdownBtnText: {
    flex: 1,
    fontSize: 13,
    color: "#854d0e",
    fontWeight: "600",
  },
  dropdownList: {
    backgroundColor: "#fff",
    marginTop: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    overflow: "hidden",
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  dropdownItemText: { fontSize: 13, color: "#111" },

  // Hazard Layers inside Filter
  layerBtnRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  layerBtnSmall: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#F0F9FF",
    borderWidth: 1,
    borderColor: "#BAE6FD",
  },
  layerBtnActiveFlood: { backgroundColor: "#1565C0", borderColor: "#1565C0" },
  layerBtnActiveLandslide: {
    backgroundColor: "#6D4C41",
    borderColor: "#6D4C41",
  },
  layerBtnActiveEQ: { backgroundColor: "#C62828", borderColor: "#C62828" },
  layerBtnTextSmall: { fontSize: 10, fontWeight: "700", color: "#374151" },
  layerBtnTextActive: { color: "#fff" },

  // Recenter / Toggle Location
  recenterBtn: {
    position: "absolute",
    bottom: 30,
    right: 20,
    backgroundColor: "#0F4A2F",
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },

  // Loading
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.8)",
  },
  loadingText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0F4A2F",
    marginTop: 10,
  },

  // Loading Sites Indicator
  loadingSitesOverlay: {
    position: "absolute",
    bottom: 100,
    left: "25%",
    right: "25%",
    backgroundColor: "rgba(15, 74, 47, 0.9)",
    borderRadius: 25,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 8,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  loadingSitesText: { color: "#fff", fontSize: 13, fontWeight: "600" },

  // Bottom Sheets Base
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
    maxHeight: screenHeight * 0.6,
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
  sheetTitle: { fontSize: 20, fontWeight: "800", color: "#111", flex: 1 },
  sheetTitleCenter: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111",
    textAlign: "center",
    marginBottom: 4,
  },
  sheetSubtitle: { fontSize: 13, color: "#6b7280", marginBottom: 20 },
  sheetSubtitleCenter: {
    fontSize: 13,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 20,
  },
  sheetDesc: {
    fontSize: 13,
    color: "#4b5563",
    marginBottom: 16,
    lineHeight: 18,
  },

  // Sheet Actions
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
  sheetIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  sheetTextWrap: { flex: 1 },
  sheetActionTitle: { fontSize: 14, fontWeight: "700", color: "#111" },
  sheetActionDesc: { fontSize: 11, color: "#6b7280", marginTop: 2 },

  // Area Sheet
  areaBtnRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  areaBtnOutline: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1.5,
    borderColor: "#0F4A2F",
    borderRadius: 10,
    paddingVertical: 10,
  },
  areaBtnOutlineText: { color: "#0F4A2F", fontWeight: "700", fontSize: 13 },
  areaBtnDisabled: { opacity: 0.5 },
  startAssessmentBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#0F4A2F",
    borderRadius: 12,
    paddingVertical: 14,
  },
  startAssessmentText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  // Site Sheet
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  carouselContainer: {
    width: "100%",
    height: 200,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 16,
    backgroundColor: "#f3f4f6",
  },
  carouselImage: { width: "100%", height: "100%" },
  carouselBtn: {
    position: "absolute",
    top: "50%",
    marginTop: -15,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  noImageBox: {
    width: "100%",
    height: 150,
    borderRadius: 16,
    backgroundColor: "#f9fafb",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderStyle: "dashed",
  },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
  statBox: {
    flex: 1,
    backgroundColor: "#f0fdf4",
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  statLabel: {
    fontSize: 11,
    color: "#16a34a",
    fontWeight: "700",
    textTransform: "uppercase",
  },
  statValue: {
    fontSize: 18,
    color: "#14532d",
    fontWeight: "800",
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#111",
    marginBottom: 10,
    textTransform: "uppercase",
  },
  emptyText: {
    fontSize: 13,
    color: "#9ca3af",
    textAlign: "center",
    marginVertical: 20,
  },
  appCard: {
    backgroundColor: "#f9fafb",
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  appTitle: { fontSize: 14, fontWeight: "700", color: "#111", marginBottom: 6 },
  appRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  appText: { fontSize: 12, color: "#4b5563" },

  // Assessment Sheet
  assessmentOption: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: 12,
  },
  assessmentIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#E6F4EC",
    justifyContent: "center",
    alignItems: "center",
  },
  assessmentTitle: { fontSize: 15, fontWeight: "700", color: "#111" },
  assessmentDesc: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  cancelBtn: { marginTop: 10, paddingVertical: 12, alignItems: "center" },
  cancelBtnText: { color: "#ef4444", fontWeight: "700", fontSize: 15 },
});

// ==========================================
// 🌐 LEAFLET HTML (Injected into WebView)
// ==========================================
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
    var map = L.map('map', { zoomControl: false }).setView([11.02, 124.61], 12);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { 
      maxZoom: 19, attribution: '© OSM' 
    }).addTo(map);

    var markers = { barangay: {}, area: {}, site: {} };
    var polygonLayers = { classified: null, hazard: null };
    var userLocationMarker = null;

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
        else if (action === 'addAreas') {
          payload.forEach(a => {
            if (markers.area[a.id]) map.removeLayer(markers.area[a.id]);
            var m = L.marker([a.lat, a.lng], { icon: createIcon('green', 'A') }).addTo(map);
            m.on('click', () => sendClick('area', a.id));
            m.bindPopup('<b>Area:</b> ' + a.name);
            markers.area[a.id] = m;
          });
        } 
        else if (action === 'addSites') {
          payload.forEach(s => {
            if (markers.site[s.id]) map.removeLayer(markers.site[s.id].marker);
            var m = L.marker([s.lat, s.lng], { icon: createIcon('blue', 'S') }).addTo(map);
            m.on('click', () => sendClick('site', s.id));
            m.bindPopup('<b>Site:</b> ' + s.name + '<br><i>Status: ' + s.status + '</i>');
            markers.site[s.id] = { marker: m, areaId: s.areaId };
          });
        } 
        else if (action === 'clearSites') {
          Object.keys(markers.site).forEach(id => {
            map.removeLayer(markers.site[id].marker);
            delete markers.site[id];
          });
        }
        else if (action === 'addUserLocation') {
          if (userLocationMarker) map.removeLayer(userLocationMarker);
          userLocationMarker = L.circleMarker([payload.lat, payload.lng], {
            radius: 8,
            color: '#ffffff',
            fillColor: '#3b82f6',
            fillOpacity: 1,
            weight: 3
          }).addTo(map);
          userLocationMarker.bindPopup('<b>You are here</b>');
        }
        else if (action === 'clearUserLocation') {
          if (userLocationMarker) {
            map.removeLayer(userLocationMarker);
            userLocationMarker = null;
          }
        }
        else if (action === 'drawClassifiedPolygons') {
          if (polygonLayers.classified) map.removeLayer(polygonLayers.classified);
          var group = L.layerGroup();
          payload.forEach(p => {
            L.polygon(p.coordinates, { color: p.color, fillColor: p.color, fillOpacity: 0.4, weight: 2 })
              .bindPopup('<b>' + p.name + '</b><br>Class: ' + p.classification)
              .addTo(group);
          });
          group.addTo(map);
          polygonLayers.classified = group;
          map.fitBounds(group.getBounds());
        } 
        else if (action === 'drawHazardPolygons') {
          if (polygonLayers.hazard) map.removeLayer(polygonLayers.hazard);
          var group = L.layerGroup();
          payload.forEach(p => {
            L.polygon(p.coordinates, { color: p.color, fillColor: p.color, fillOpacity: 0.4, weight: 2 })
              .bindPopup('<b>' + p.name + '</b><br>Type: ' + p.type)
              .addTo(group);
          });
          group.addTo(map);
          polygonLayers.hazard = group;
          map.fitBounds(group.getBounds());
        } 
        else if (action === 'clearPolygons') {
          if (polygonLayers.classified) { map.removeLayer(polygonLayers.classified); polygonLayers.classified = null; }
          if (polygonLayers.hazard) { map.removeLayer(polygonLayers.hazard); polygonLayers.hazard = null; }
        } 
        else if (action === 'flyTo') {
          map.flyTo([payload.lat, payload.lng], payload.zoom || 16);
        }
      } catch (e) {
        console.error('updateMap error:', e);
      }
    };

    var activeHazardLayers = {};
    var transparentPixel = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

    window.updateHazardLayers = function(layerConfig) {
      for (const key of Object.keys(layerConfig)) {
        const config = layerConfig[key];
        if (activeHazardLayers[key]) {
          map.removeLayer(activeHazardLayers[key]);
          delete activeHazardLayers[key];
        }
        if (config.enabled) {
          if (config.type === 'xyz') {
            activeHazardLayers[key] = L.tileLayer(config.url, {
              opacity: 0.75, maxZoom: 19, maxNativeZoom: 17, errorTileUrl: transparentPixel
            }).addTo(map);
          } else if (config.type === 'wms') {
             activeHazardLayers[key] = L.tileLayer.wms(config.url, {
               layers: '0', format: 'image/png', transparent: true, opacity: 0.75,
               version: '1.3.0', crs: L.CRS.EPSG4326, maxZoom: 19, maxNativeZoom: 17
             }).addTo(map);
          }
        }
      }
    };
  </script>
</body>
</html>
`;

// Helper for Status Colors
const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case "accepted":
      return "#16a34a";
    case "rejected":
      return "#dc2626";
    case "pending":
      return "#eab308";
    case "under_monitoring":
      return "#14b8a6";
    case "under_review":
      return "#8b5cf6";
    default:
      return "#6b7280";
  }
};