// screens/MapScreen.tsx
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  Alert,
  TouchableOpacity,
  Text,
  ActivityIndicator,
} from "react-native";
import { WebView as OriginalWebView } from "react-native-webview";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";

const WebView = OriginalWebView as any;

const MGB_FLOOD_TILE_URL =
  "https://controlmap.mgb.gov.ph/arcgis/rest/services/GeospatialDataInventory/GDI_Detailed_Flood_Susceptibility/MapServer/tile/{z}/{y}/{x}";
const MGB_LANDSLIDE_TILE_URL =
  "https://controlmap.mgb.gov.ph/arcgis/rest/services/GeospatialDataInventory/GDI_Detailed_Rain_induced_Landslide_Susceptibility/MapServer/tile/{z}/{y}/{x}";
const PHIVOLCS_EIL_WMS_URL =
  "https://gisweb.phivolcs.dost.gov.ph/arcgis/services/PHIVOLCSPublic/EarthquakeInducedLandslide/MapServer/WMSServer";

interface UserLocationType {
  latitude: number;
  longitude: number;
}

export default function MapScreen(): React.ReactElement {
  const webViewRef = useRef<any>(null);
  const [userLocation, setUserLocation] = useState<UserLocationType | null>(
    null,
  );
  const [loading, setLoading] = useState<boolean>(true);

  const [showFlood, setShowFlood] = useState<boolean>(false);
  const [showLandslide, setShowLandslide] = useState<boolean>(false);
  const [showEarthquakeLandslide, setShowEarthquakeLandslide] =
    useState<boolean>(false);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Location permission is needed.", [
          { text: "OK" },
        ]);
        setLoading(false);
        return;
      }
      try {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        setUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      } catch (error) {
        console.log("Error getting location:", error);
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (webViewRef.current) {
      webViewRef.current.postMessage(
        JSON.stringify({
          action: "updateLayers",
          layers: {
            flood: { enabled: showFlood, url: MGB_FLOOD_TILE_URL, type: "xyz" },
            landslide: {
              enabled: showLandslide,
              url: MGB_LANDSLIDE_TILE_URL,
              type: "xyz",
            },
            earthquakeLandslide: {
              enabled: showEarthquakeLandslide,
              url: PHIVOLCS_EIL_WMS_URL,
              type: "wms",
            },
          },
        }),
      );
    }
  }, [showFlood, showLandslide, showEarthquakeLandslide]);

  const defaultCenter: UserLocationType = {
    latitude: 11.0064,
    longitude: 124.6075,
  };
  const center: UserLocationType = userLocation || defaultCenter;

  const recenterMap = (): void => {
    if (userLocation && webViewRef.current) {
      webViewRef.current.postMessage(
        JSON.stringify({
          action: "recenter",
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          zoom: 15,
        }),
      );
    }
  };

  const mapHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        body { margin: 0; padding: 0; }
        #map { width: 100%; height: 100vh; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var map = L.map('map', { zoomControl: false }).setView([${center.latitude}, ${center.longitude}], 13);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { 
          maxZoom: 19,
          attribution: '© OpenStreetMap contributors'
        }).addTo(map);
        
        L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
          opacity: 0.4, maxZoom: 17
        }).addTo(map);

        var activeLayers = {};
        var transparentPixel = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
        
        ${
          userLocation
            ? `
        var userIcon = L.divIcon({
          className: 'user-location-icon',
          html: '<div style="width: 20px; height: 20px; background-color: #0F4A2F; border: 3px solid #fff; border-radius: 50%;"></div>',
          iconSize: [20, 20], iconAnchor: [10, 10]
        });
        L.marker([${userLocation.latitude}, ${userLocation.longitude}], {icon: userIcon}).addTo(map);
        `
            : ''
        }

        async function getWmsLayerName(wmsUrl) {
            try {
                const capUrl = wmsUrl + '?request=GetCapabilities&service=WMS';
                const response = await fetch(capUrl);
                const text = await response.text();
                const match = text.match(new RegExp('<Name>([^<]+)</Name>'));
                if (match && match[1]) {
                    return match[1];
                }
            } catch (e) {
                console.warn('GetCapabilities failed:', e.message);
            }
            return '0';
        }

        async function updateLayers(layerConfig) {
          for (const key of Object.keys(layerConfig)) {
            const config = layerConfig[key];
            
            if (activeLayers[key]) {
              map.removeLayer(activeLayers[key]);
              delete activeLayers[key];
            }
            
            if (config.enabled) {
              if (config.type === 'xyz') {
                activeLayers[key] = L.tileLayer(config.url, {
                  opacity: 0.75, 
                  maxZoom: 19, 
                  maxNativeZoom: 17, 
                  errorTileUrl: transparentPixel
                }).addTo(map);
              } 
              else if (config.type === 'wms') {
                const layerName = await getWmsLayerName(config.url);
                
                activeLayers[key] = L.tileLayer.wms(config.url, {
                  layers: layerName,
                  format: 'image/png', 
                  transparent: true, 
                  opacity: 0.75,
                  version: '1.3.0', 
                  crs: L.CRS.EPSG4326, 
                  maxZoom: 19, 
                  maxNativeZoom: 17
                }).addTo(map);
              }
            }
          }
        }
        
        function handleRNMessage(event) {
          try {
            var data = JSON.parse(event.data);
            if (data.action === 'recenter') {
              map.setView([data.latitude, data.longitude], data.zoom);
            } else if (data.action === 'updateLayers') {
              updateLayers(data.layers);
            }
          } catch (e) { 
            console.error('Error parsing message:', e.message); 
          }
        }
        
        // 🔥 CRITICAL: Listen on BOTH window and document to catch messages from React Native
        window.addEventListener('message', handleRNMessage);
        document.addEventListener('message', handleRNMessage);
      </script>
    </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ html: mapHtml }}
        style={styles.map}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        allowFileAccess={true}
        allowUniversalAccessFromFileURLs={true}
        mixedContentMode="always"
        originWhitelist={["*"]}
        startInLoadingState={true}
        incognito={true}
        userAgent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
      />

      <View style={styles.layerPanel}>
        <Text style={styles.layerPanelTitle}>Hazard Layers</Text>

        <TouchableOpacity
          style={[styles.layerBtn, showFlood && styles.layerBtnActive]}
          onPress={() => setShowFlood(!showFlood)}
          activeOpacity={0.7}
        >
          <Ionicons
            name="water-outline"
            size={16}
            color={showFlood ? "#fff" : "#1565C0"}
          />
          <Text
            style={[
              styles.layerBtnText,
              showFlood && styles.layerBtnTextActive,
            ]}
          >
            Flood
          </Text>
          {showFlood && <Ionicons name="checkmark" size={14} color="#fff" />}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.layerBtn,
            styles.layerBtnLandslide,
            showLandslide && styles.layerBtnLandslideActive,
          ]}
          onPress={() => setShowLandslide(!showLandslide)}
          activeOpacity={0.7}
        >
          <Ionicons
            name="trail-sign-outline"
            size={16}
            color={showLandslide ? "#fff" : "#6D4C41"}
          />
          <Text
            style={[
              styles.layerBtnText,
              showLandslide && styles.layerBtnTextActive,
            ]}
          >
            Landslide
          </Text>
          {showLandslide && (
            <Ionicons name="checkmark" size={14} color="#fff" />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.layerBtn,
            styles.layerBtnEarthquake,
            showEarthquakeLandslide && styles.layerBtnEarthquakeActive,
          ]}
          onPress={() => setShowEarthquakeLandslide(!showEarthquakeLandslide)}
          activeOpacity={0.7}
        >
          <Ionicons
            name="flash-outline"
            size={16}
            color={showEarthquakeLandslide ? "#fff" : "#C62828"}
          />
          <Text
            style={[
              styles.layerBtnText,
              showEarthquakeLandslide && styles.layerBtnTextActive,
            ]}
          >
            EQ Landslide
          </Text>
          {showEarthquakeLandslide && (
            <Ionicons name="checkmark" size={14} color="#fff" />
          )}
        </TouchableOpacity>
      </View>

      {userLocation && (
        <TouchableOpacity style={styles.recenterBtn} onPress={recenterMap}>
          <Text style={styles.recenterText}>📍 My Location</Text>
        </TouchableOpacity>
      )}

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#0F4A2F" />
          <Text style={styles.loadingText}>Loading map...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  map: { flex: 1, width: "100%", height: "100%" },
  layerPanel: {
    position: "absolute",
    top: 50,
    left: 12,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 12,
    padding: 10,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
    minWidth: 140,
  },
  layerPanelTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#0F4A2F",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  layerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 4,
    backgroundColor: "#F0F9FF",
    borderWidth: 1,
    borderColor: "#BAE6FD",
  },
  layerBtnActive: { backgroundColor: "#1565C0", borderColor: "#1565C0" },
  layerBtnLandslide: { backgroundColor: "#EFEBE9", borderColor: "#BCAAA4" },
  layerBtnLandslideActive: {
    backgroundColor: "#6D4C41",
    borderColor: "#6D4C41",
  },
  layerBtnEarthquake: { backgroundColor: "#FFEBEE", borderColor: "#EF9A9A" },
  layerBtnEarthquakeActive: {
    backgroundColor: "#C62828",
    borderColor: "#C62828",
  },
  layerBtnText: { fontSize: 12, fontWeight: "700", color: "#374151", flex: 1 },
  layerBtnTextActive: { color: "#fff" },
  recenterBtn: {
    position: "absolute",
    bottom: 30,
    right: 20,
    backgroundColor: "#0F4A2F",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 25,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  recenterText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.8)",
  },
  loadingText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0F4A2F",
    marginTop: 10,
  },
});