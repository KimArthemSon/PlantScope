import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  TextInput,
  ActivityIndicator,
  Dimensions,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import MapView, {
  Marker,
  Polygon,
  Circle,
  MapPressEvent,
} from "react-native-maps";
import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import { api } from "@/constants/url_fixed";
import {
  Target,
  Plus,
  MapPin,
  Camera,
  X,
  Trash2,
  Save,
  Send,
  Navigation,
  CircleDot,
  Edit3,
  Check,
  AlertCircle,
} from "lucide-react-native";

const API = api + "/api";
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const MAP_HEIGHT = SCREEN_HEIGHT * 0.45;

// ✅ Coordinate Helpers
const toMapCoordinate = (coord: [number, number] | null | undefined) => {
  if (!coord || !Array.isArray(coord) || coord.length < 2) return null;
  const [lat, lng] = coord;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { latitude: lat, longitude: lng };
};

const toMapPolygon = (coords: [number, number][] | null | undefined) => {
  if (!coords || !Array.isArray(coords)) return [];
  return coords
    .map((c) => toMapCoordinate(c))
    .filter((c): c is { latitude: number; longitude: number } => c !== null);
};

const isPointInPolygon = (
  point: { latitude: number; longitude: number },
  polygon: { latitude: number; longitude: number }[],
) => {
  if (polygon.length < 3) return false;
  let inside = false;
  const x = point.longitude;
  const y = point.latitude;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].longitude,
      yi = polygon[i].latitude;
    const xj = polygon[j].longitude,
      yj = polygon[j].latitude;
    const slope = yj === yi ? 0 : (xj - xi) / (yj - yi);
    const intersect = yi > y !== yj > y && x < slope * (y - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
};

// ✅ Interfaces
interface GISData {
  barangays: any[];
  classifiedAreas: any[];
  reforestationArea: any | null;
  potentialSites: any[];
}

interface CoordinatePoint {
  id: string;
  latitude: string;
  longitude: string;
}

interface Props {
  existingData: any;
  onSave: (any, submit: boolean) => Promise<void>;
  onUploadImage: (id: string) => Promise<boolean>;
  saving: boolean;
  isViewMode?: boolean;
  areaId: string;
  assessmentId?: string;
}

export default function LegalityForm({
  existingData,
  onSave,
  onUploadImage,
  saving,
  isViewMode = false,
  areaId,
  assessmentId,
}: Props) {
  // ==================== STATE ====================
  const [region, setRegion] = useState({
    latitude: 11.0243,
    longitude: 124.5956,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });
  const [currentLocation, setCurrentLocation] = useState({
    latitude: 11.0243,
    longitude: 124.5956,
  });
  const [tracking, setTracking] = useState(false);
  const locationSubscription = useRef<Location.LocationSubscription | null>(
    null,
  );
  const [loadingGIS, setLoadingGIS] = useState(true);

  const [gisData, setGisData] = useState<GISData>({
    barangays: [],
    classifiedAreas: [],
    reforestationArea: null,
    potentialSites: [],
  });

  const [markerMode, setMarkerMode] = useState(false);
  const [polygonMode, setPolygonMode] = useState(false);
  const [savedMarker, setSavedMarker] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [drawingPolygon, setDrawingPolygon] = useState<
    { latitude: number; longitude: number }[]
  >([]);
  const [savedPolygons, setSavedPolygons] = useState<
    { latitude: number; longitude: number }[][]
  >([]);

  const [showFormModal, setShowFormModal] = useState(false);
  const [inspectorComment, setInspectorComment] = useState(
    existingData?.inspector_comment || "",
  );

  const [showCoordinateEditor, setShowCoordinateEditor] = useState(false);
  const [coordinatePoints, setCoordinatePoints] = useState<CoordinatePoint[]>(
    [],
  );
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  // ==================== EFFECTS ====================
  useEffect(() => {
    fetchGISData();
    loadExistingData();
    return () => {
      locationSubscription.current?.remove();
    };
  }, [areaId]);

  // ==================== DATA LOADING ====================
  const fetchGISData = async () => {
    setLoadingGIS(true);
    try {
      const token = await SecureStore.getItemAsync("token");
      const headers = { Authorization: `Bearer ${token}` };
      const [bRes, cRes, aRes, pRes] = await Promise.all([
        fetch(`${API}/get_barangay_list/`, { headers }),
        fetch(`${API}/get_classified_areas_by_reforestation_area/${areaId}/`, {
          headers,
        }),
        fetch(`${API}/get_reforestation_area/${areaId}/`, { headers }),
        fetch(`${API}/get_potential_sites/`, { headers }),
      ]);
      const barangays = bRes.ok ? (await bRes.json()).data || [] : [];
      const classifiedAreas = cRes.ok ? (await cRes.json()).data || [] : [];
      const areaData = aRes.ok ? (await aRes.json()).data : null;
      const potentialSites = pRes.ok
        ? (await pRes.json()).data?.filter(
            (s: any) => s.reforestation_area_id?.toString() === areaId,
          ) || []
        : [];
      setGisData({
        barangays,
        classifiedAreas,
        reforestationArea: areaData,
        potentialSites,
      });
      if (areaData?.coordinate) {
        const coord = toMapCoordinate(areaData.coordinate);
        if (coord)
          setRegion({
            latitude: coord.latitude,
            longitude: coord.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          });
      }
    } catch (err) {
      console.error("GIS error:", err);
      loadMockData();
    } finally {
      setLoadingGIS(false);
    }
  };

  const loadMockData = () => {
    setGisData({
      barangays: [
        { barangay_id: 1, name: "San Isidro", coordinate: [11.0243, 124.5956] },
      ],
      classifiedAreas: [
        {
          classified_area_id: 1,
          name: "Protected Zone",
          polygon: [
            [11.024, 124.595],
            [11.024, 124.597],
            [11.026, 124.597],
            [11.026, 124.595],
          ],
        },
      ],
      reforestationArea: {
        reforestation_area_id: parseInt(areaId) || 1,
        name: "Test Area",
        polygon_coordinate: [
          [11.022, 124.593],
          [11.022, 124.598],
          [11.027, 124.598],
          [11.027, 124.593],
        ],
        coordinate: [11.0243, 124.5956],
      },
      potentialSites: [
        {
          potential_sites_id: 1,
          site_id: "SITE-001",
          polygon_coordinates: [
            [11.023, 124.594],
            [11.023, 124.596],
            [11.025, 124.596],
            [11.025, 124.594],
          ],
        },
      ],
    });
  };

  const loadExistingData = () => {
    if (!existingData) return;
    if (existingData.marker_coordinate?.[0] != null) {
      const coord = toMapCoordinate(existingData.marker_coordinate);
      if (coord)
        setSavedMarker({
          latitude: coord.latitude,
          longitude: coord.longitude,
        });
    }
    if (Array.isArray(existingData.polygon_coordinates)) {
      const coords = toMapPolygon(existingData.polygon_coordinates);
      if (coords.length >= 3) setSavedPolygons([coords]);
    }
    setInspectorComment(existingData.inspector_comment || "");
  };

  // ==================== LOCATION ====================
  const startTracking = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted")
      return Alert.alert("Permission Denied", "Location access required");
    setTracking(true);
    try {
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 5,
          timeInterval: 2000,
        },
        (loc) =>
          setCurrentLocation({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          }),
      );
      showToast("Location tracking started", "success");
    } catch (err) {
      setTracking(false);
      showToast("Could not start tracking", "error");
    }
  };

  const stopTracking = () => {
    locationSubscription.current?.remove();
    locationSubscription.current = null;
    setTracking(false);
    showToast("Location tracking stopped", "info");
  };

  // ==================== MAP INTERACTIONS ====================
  const getIndicatorColor = () => {
    const inPotential = gisData.potentialSites.some((s) =>
      isPointInPolygon(currentLocation, toMapPolygon(s.polygon_coordinates)),
    );
    const inClassified = gisData.classifiedAreas.some((a) =>
      isPointInPolygon(currentLocation, toMapPolygon(a.polygon.coordinates)),
    );
    if (inPotential) return "#16a34a";
    if (inClassified) return "#ef4444";
    return "#94a3b8";
  };

  const handleMapPress = (e: MapPressEvent) => {
    if (isViewMode) return;
    const { latitude, longitude } = e.nativeEvent.coordinate;

    if (markerMode) {
      setSavedMarker({ latitude, longitude });
      setMarkerMode(false);
      showToast("Marker placed", "success");
    } else if (polygonMode) {
      setDrawingPolygon((prev) => {
        const newLength = prev.length + 1;
        showToast(`Point ${newLength} added`, "success");
        return [...prev, { latitude, longitude }];
      });
    }
  };

  // ==================== ACTIONS ====================
  const addCurrentLocation = () => {
    if (markerMode) {
      setSavedMarker({
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
      });
      setMarkerMode(false);
      showToast("Marker placed at current location", "success");
    } else if (polygonMode) {
      setDrawingPolygon((prev) => [
        ...prev,
        {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
        },
      ]);
      showToast(
        `Current location added (${currentLocation.latitude.toFixed(4)}, ${currentLocation.longitude.toFixed(4)})`,
        "success",
      );
    } else {
      showToast("Enable Marker or Polygon mode first", "info");
    }
  };

  const clearMarker = () => {
    setSavedMarker(null);
    showToast("Marker cleared", "info");
  };

  const openCoordinateEditor = () => {
    const points: CoordinatePoint[] = drawingPolygon.map((coord, index) => ({
      id: `coord-${index}-${Date.now()}`,
      latitude: coord.latitude.toFixed(6),
      longitude: coord.longitude.toFixed(6),
    }));
    setCoordinatePoints(points);
    setShowCoordinateEditor(true);
  };

  const addCoordinatePoint = () => {
    setCoordinatePoints((prev) => [
      ...prev,
      { id: `coord-${Date.now()}`, latitude: "", longitude: "" },
    ]);
  };

  const updateCoordinatePoint = (
    id: string,
    field: "latitude" | "longitude",
    value: string,
  ) => {
    setCoordinatePoints((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)),
    );
  };

  const deleteCoordinatePoint = (id: string) => {
    setCoordinatePoints((prev) => prev.filter((p) => p.id !== id));
  };

  const saveCoordinateEditor = () => {
    try {
      const validPoints = coordinatePoints.filter(
        (p) => p.latitude.trim() && p.longitude.trim(),
      );
      if (validPoints.length < 3)
        return Alert.alert("Invalid", "Need at least 3 coordinates");

      const polygon = validPoints.map((p) => {
        const lat = parseFloat(p.latitude);
        const lng = parseFloat(p.longitude);
        if (isNaN(lat) || isNaN(lng)) throw new Error("Invalid format");
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180)
          throw new Error("Out of range");
        return { latitude: lat, longitude: lng };
      });

      setDrawingPolygon(polygon);
      setShowCoordinateEditor(false);
      showToast(`Polygon updated with ${polygon.length} points`, "success");
    } catch (err: any) {
      Alert.alert(
        "Invalid Coordinates",
        err.message || "Please check your input",
      );
    }
  };

  const savePolygon = () => {
    if (drawingPolygon.length < 3)
      return Alert.alert(
        "Incomplete",
        `Need ${3 - drawingPolygon.length} more points`,
      );
    setSavedPolygons((prev) => [...prev, drawingPolygon]);
    setDrawingPolygon([]);
    setPolygonMode(false);
    showToast("Polygon saved", "success");
  };

  const deletePolygon = (index: number) => {
    setSavedPolygons((prev) => prev.filter((_, i) => i !== index));
    showToast("Polygon deleted", "info");
  };

  // ✅ Close polygon mode and clear drawing
  const closePolygonMode = () => {
    setPolygonMode(false);
    setDrawingPolygon([]);
    showToast("Polygon mode closed", "info");
  };

  // ==================== FORM ====================
  const handleSubmit = async (submit: boolean) => {
    const markerCoordinate = savedMarker
      ? [savedMarker.latitude, savedMarker.longitude]
      : null;
    const polygonCoordinates =
      savedPolygons.length > 0
        ? savedPolygons[0].map((c) => [c.latitude, c.longitude])
        : null;
    await onSave(
      {
        marker_coordinate: markerCoordinate,
        polygon_coordinates: polygonCoordinates,
        inspector_comment: inspectorComment,
      },
      submit,
    );
  };

  // ==================== TOAST ====================
  const showToast = (
    message: string,
    type: "success" | "error" | "info" = "success",
  ) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  };

  // ==================== RENDER MAP ====================
  const renderMapLayers = () => (
    <>
      {gisData.barangays.map((b) => {
        const c = toMapCoordinate(b.coordinate);
        return c ? (
          <Marker
            key={b.barangay_id}
            coordinate={c}
            title={b.name}
            pinColor="#3b82f6"
          />
        ) : null;
      })}
      {gisData.classifiedAreas.map((a) => {
        const p = toMapPolygon(a.polygon.coordinates);
        return p.length >= 3 ? (
          <Polygon
            key={a.classified_area_id}
            coordinates={p}
            strokeColor="#ef4444"
            fillColor="rgba(239,68,68,0.2)"
            strokeWidth={2}
            title={a.name}
          />
        ) : null;
      })}
      {gisData.reforestationArea?.polygon_coordinate && (
        <Polygon
          coordinates={toMapPolygon(
            gisData.reforestationArea.polygon_coordinate,
          )}
          strokeColor="#0F4A2F"
          fillColor="rgba(15,74,47,0.08)"
          strokeWidth={2}
          title={gisData.reforestationArea.name}
        />
      )}
      {gisData.reforestationArea?.coordinate && (
        <Marker
          coordinate={toMapCoordinate(gisData.reforestationArea.coordinate)!}
          title={gisData.reforestationArea.name}
          pinColor="#0F4A2F"
        />
      )}
      {gisData.potentialSites.map(
        (s) =>
          s.polygon_coordinates && (
            <Polygon
              key={s.potential_sites_id}
              coordinates={toMapPolygon(s.polygon_coordinates)}
              strokeColor="#8b5cf6"
              fillColor="rgba(139,92,246,0.15)"
              strokeWidth={1}
              title={s.site_id}
            />
          ),
      )}

      {savedMarker && (
        <Marker coordinate={savedMarker} title="Marker" pinColor="#16a34a" />
      )}
      {savedPolygons.map((polygon, idx) => (
        <Polygon
          key={`saved-${idx}`}
          coordinates={polygon}
          strokeColor="#16a34a"
          fillColor="rgba(22,163,74,0.15)"
          strokeWidth={2}
        />
      ))}
      {drawingPolygon.length > 0 && (
        <Polygon
          coordinates={drawingPolygon}
          strokeColor="#f59e0b"
          fillColor="rgba(245,158,11,0.1)"
          strokeWidth={2}
        />
      )}
      {drawingPolygon.map((coord, idx) => (
        <Marker
          key={`vertex-${idx}`}
          coordinate={coord}
          title={`Point ${idx + 1}`}
          pinColor="#f59e0b"
        />
      ))}
      {tracking && (
        <Circle
          center={currentLocation}
          radius={15}
          fillColor="rgba(59,130,246,0.2)"
          strokeColor="#3b82f6"
          strokeWidth={2}
        />
      )}
    </>
  );

  return (
    <View style={styles.container}>
      {/* ==================== MAP VIEW ==================== */}
      <View style={styles.mapContainer}>
        <View style={styles.mapHeader}>
          <Text style={styles.mapHeaderText}>🗺️ Map View</Text>
          <View
            style={[
              styles.indicatorBall,
              { backgroundColor: getIndicatorColor() },
            ]}
          />
        </View>

        <View style={styles.mapWrapper}>
          <MapView
            style={styles.map}
            region={region}
            showsUserLocation={false}
            showsMyLocationButton={true}
            onRegionChangeComplete={setRegion}
            onPress={handleMapPress}
            scrollEnabled={true}
            zoomEnabled={true}
            toolbarEnabled={false}
          >
            {renderMapLayers()}
          </MapView>

          {loadingGIS && (
            <View style={styles.mapLoading}>
              <ActivityIndicator color="#0F4A2F" size="large" />
              <Text style={styles.mapLoadingText}>Loading map data...</Text>
            </View>
          )}

          {/* Mode Indicator Overlay */}
          {(markerMode || polygonMode) && (
            <View style={styles.modeOverlay}>
              <Navigation size={16} color="#fff" />
              <Text style={styles.modeOverlayText}>
                {markerMode
                  ? "Tap map to place marker"
                  : `Drawing: ${drawingPolygon.length} points • Drag to pan`}
              </Text>
            </View>
          )}
        </View>

        {/* User Coordinates */}
        <View style={styles.userCoords}>
          <Text style={styles.coordLabel}>📍 Your Location</Text>
          <Text style={styles.coordText}>
            {currentLocation.latitude.toFixed(5)},{" "}
            {currentLocation.longitude.toFixed(5)}
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionBtn, markerMode && styles.actionBtnActive]}
            onPress={() => {
              setMarkerMode(!markerMode);
              setPolygonMode(false);
            }}
            disabled={isViewMode}
          >
            <Target size={18} color="#fff" />
            <Text style={styles.actionBtnText}>Marker</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, polygonMode && styles.actionBtnActive]}
            onPress={() => {
              setPolygonMode(!polygonMode);
              setMarkerMode(false);
            }}
            disabled={isViewMode}
          >
            <Plus size={18} color="#fff" />
            <Text style={styles.actionBtnText}>Polygon</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnLocation]}
            onPress={addCurrentLocation}
            disabled={isViewMode}
          >
            <MapPin size={18} color="#fff" />
            <Text style={styles.actionBtnText}>GPS Point</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, tracking && styles.actionBtnDanger]}
            onPress={tracking ? stopTracking : startTracking}
          >
            <CircleDot size={18} color="#fff" />
            <Text style={styles.actionBtnText}>
              {tracking ? "Stop" : "Track"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Open Form Button */}
        <TouchableOpacity
          style={styles.openFormBtn}
          onPress={() => setShowFormModal(true)}
        >
          <Edit3 size={18} color="#fff" />
          <Text style={styles.openFormBtnText}>Open Form</Text>
        </TouchableOpacity>
      </View>

      {/* ==================== FORM MODAL ==================== */}
      <Modal visible={showFormModal} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.formModal}>
            <View style={styles.formHeader}>
              <Text style={styles.formHeaderText}>Assessment Form</Text>
              <TouchableOpacity
                onPress={() => setShowFormModal(false)}
                style={styles.closeBtn}
              >
                <X size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.formContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.formSection}>
                <Text style={styles.sectionTitle}>Marker Coordinates</Text>
                {savedMarker ? (
                  <View style={styles.coordCard}>
                    <Text style={styles.coordCardText}>
                      Lat: {savedMarker.latitude.toFixed(6)}
                    </Text>
                    <Text style={styles.coordCardText}>
                      Lng: {savedMarker.longitude.toFixed(6)}
                    </Text>
                    {!isViewMode && (
                      <TouchableOpacity
                        style={styles.clearIcon}
                        onPress={clearMarker}
                      >
                        <Trash2 size={16} color="#ef4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                ) : (
                  <Text style={styles.emptyText}>No marker set</Text>
                )}
              </View>

              <View style={styles.formSection}>
                <Text style={styles.sectionTitle}>Polygon Coordinates</Text>
                {savedPolygons.length > 0 || drawingPolygon.length > 0 ? (
                  <>
                    {savedPolygons.map((polygon, idx) => (
                      <View key={`saved-${idx}`} style={styles.polygonCard}>
                        <View>
                          <Text style={styles.polygonTitle}>
                            Polygon #{idx + 1}
                          </Text>
                          <Text style={styles.polygonSubtext}>
                            {polygon.length} vertices
                          </Text>
                        </View>
                        {!isViewMode && (
                          <TouchableOpacity onPress={() => deletePolygon(idx)}>
                            <Trash2 size={16} color="#ef4444" />
                          </TouchableOpacity>
                        )}
                      </View>
                    ))}
                    {drawingPolygon.length > 0 && (
                      <View style={[styles.polygonCard, styles.drawingCard]}>
                        <View>
                          <Text style={styles.polygonTitle}>
                            Drawing in progress
                          </Text>
                          <Text style={styles.polygonSubtext}>
                            {drawingPolygon.length} vertices
                          </Text>
                        </View>
                      </View>
                    )}
                  </>
                ) : (
                  <Text style={styles.emptyText}>No polygon drawn</Text>
                )}
              </View>

              <View style={styles.formSection}>
                <Text style={styles.sectionTitle}>Inspector Comment</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter notes about boundary verification..."
                  value={inspectorComment}
                  onChangeText={setInspectorComment}
                  multiline
                  textAlignVertical="top"
                  editable={!isViewMode}
                />
              </View>

              {!isViewMode && assessmentId && (
                <TouchableOpacity
                  style={styles.photoBtn}
                  onPress={async () => {
                    const ok = await onUploadImage(assessmentId);
                    if (ok) showToast("Photo uploaded successfully", "success");
                  }}
                >
                  <Camera size={18} color="#0F4A2F" />
                  <Text style={styles.photoBtnText}>Add Photo</Text>
                </TouchableOpacity>
              )}
            </ScrollView>

            {!isViewMode && (
              <View style={styles.formActions}>
                <TouchableOpacity
                  style={styles.btnDraft}
                  onPress={() => {
                    setShowFormModal(false);
                    handleSubmit(false);
                  }}
                  disabled={saving}
                >
                  <Save size={16} color="#fff" />
                  <Text style={styles.btnText}>
                    {saving ? "Saving..." : "Save Draft"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.btnSubmit}
                  onPress={() => {
                    if (!savedMarker && savedPolygons.length === 0)
                      return Alert.alert(
                        "Incomplete",
                        "Add marker or polygon first",
                      );
                    setShowFormModal(false);
                    handleSubmit(true);
                  }}
                  disabled={saving}
                >
                  <Send size={16} color="#fff" />
                  <Text style={styles.btnText}>
                    {saving ? "Submitting..." : "Submit"}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ==================== COORDINATE EDITOR MODAL ==================== */}
      <Modal visible={showCoordinateEditor} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.coordEditorModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Polygon Coordinates</Text>
              <TouchableOpacity
                onPress={() => setShowCoordinateEditor(false)}
                style={styles.closeBtn}
              >
                <X size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.coordList}
              showsVerticalScrollIndicator={false}
            >
              {coordinatePoints.map((point, index) => (
                <View key={point.id} style={styles.coordRow}>
                  <Text style={styles.coordNumber}>No: {index + 1}</Text>
                  <View style={styles.coordInputs}>
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Coordinate X:</Text>
                      <TextInput
                        style={styles.coordInput}
                        placeholder="11.0243"
                        value={point.latitude}
                        onChangeText={(val) =>
                          updateCoordinatePoint(point.id, "latitude", val)
                        }
                        keyboardType="decimal-pad"
                        placeholderTextColor="#94a3b8"
                      />
                    </View>
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Coordinate Y:</Text>
                      <TextInput
                        style={styles.coordInput}
                        placeholder="124.5956"
                        value={point.longitude}
                        onChangeText={(val) =>
                          updateCoordinatePoint(point.id, "longitude", val)
                        }
                        keyboardType="decimal-pad"
                        placeholderTextColor="#94a3b8"
                      />
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.deleteCoordBtn}
                    onPress={() => deleteCoordinatePoint(point.id)}
                  >
                    <Trash2 size={18} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.addBtn}
                onPress={addCoordinatePoint}
              >
                <Plus size={16} color="#fff" />
                <Text style={styles.addBtnText}>Add Coordinate</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowCoordinateEditor(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.submitBtn}
                onPress={saveCoordinateEditor}
              >
                <Check size={16} color="#fff" />
                <Text style={styles.submitBtnText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ==================== POLYGON CONTROLS ==================== */}
      {polygonMode && !isViewMode && (
        <View style={styles.polygonControls}>
          {/* Close Button Header */}
          <View style={styles.controlsHeader}>
            <Text style={styles.controlsTitle}>
              Drawing Polygon ({drawingPolygon.length} points)
            </Text>
            <TouchableOpacity
              style={styles.closeControlsBtn}
              onPress={closePolygonMode}
            >
              <X size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.editCoordsBtn}
            onPress={openCoordinateEditor}
          >
            <Edit3 size={16} color="#1e40af" />
            <Text style={styles.editCoordsBtnText}>
              Edit Coordinates ({drawingPolygon.length})
            </Text>
          </TouchableOpacity>

          <View style={styles.polygonActions}>
            {drawingPolygon.length > 0 && (
              <TouchableOpacity
                style={styles.undoBtn}
                onPress={() => setDrawingPolygon((p) => p.slice(0, -1))}
              >
                <Text style={styles.undoBtnText}>↩ Undo</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[
                styles.saveBtn,
                drawingPolygon.length < 3 && styles.btnDisabled,
              ]}
              onPress={savePolygon}
              disabled={drawingPolygon.length < 3}
            >
              <Text style={styles.saveBtnText}>
                {drawingPolygon.length < 3
                  ? `Need ${3 - drawingPolygon.length}`
                  : "✅ Save Polygon"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ==================== TOAST ==================== */}
      {toast && (
        <View
          style={[
            styles.toast,
            {
              backgroundColor:
                toast.type === "success"
                  ? "#16a34a"
                  : toast.type === "error"
                    ? "#ef4444"
                    : "#3b82f6",
            },
          ]}
        >
          <AlertCircle size={16} color="#fff" />
          <Text style={styles.toastText}>{toast.message}</Text>
        </View>
      )}
    </View>
  );
}

// ==================== STYLES ====================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },

  // Map
  mapContainer: { height: 900 },
  mapHeader: {
    backgroundColor: "#0F4A2F",
    padding: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  mapHeaderText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  mapWrapper: { height: MAP_HEIGHT, position: "relative" },
  map: { flex: 1 },
  mapLoading: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.95)",
  },
  mapLoadingText: { marginTop: 10, color: "#64748b", fontSize: 14 },
  indicatorBall: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#fff",
  },
  modeOverlay: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: "rgba(15,74,47,0.9)",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  modeOverlayText: { color: "#fff", fontSize: 12, fontWeight: "600" },

  // User Coords
  userCoords: {
    backgroundColor: "#fff",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  coordLabel: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  coordText: {
    fontSize: 14,
    color: "#0f172a",
    fontWeight: "700",
    marginTop: 2,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },

  // Actions
  actionButtons: {
    flexDirection: "row",
    padding: 10,
    gap: 8,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  actionBtn: {
    flex: 1,
    backgroundColor: "#0F4A2F",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    gap: 4,
  },
  actionBtnActive: {
    backgroundColor: "#16a34a",
    borderWidth: 2,
    borderColor: "#fff",
  },
  actionBtnLocation: { backgroundColor: "#2563eb" },
  actionBtnDanger: { backgroundColor: "#ef4444" },
  actionBtnText: { color: "#fff", fontSize: 11, fontWeight: "600" },

  // Open Form
  openFormBtn: {
    backgroundColor: "#0F4A2F",
    margin: 12,
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  openFormBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  // Modals
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  formModal: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "85%",
  },
  formHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  formHeaderText: { fontSize: 18, fontWeight: "700", color: "#0f172a" },
  closeBtn: { padding: 4 },
  formContent: { padding: 20 },
  formSection: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  coordCard: {
    backgroundColor: "#f8fafc",
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  coordCardText: {
    fontSize: 13,
    color: "#475569",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  clearIcon: { padding: 4 },
  polygonCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  drawingCard: { borderColor: "#f59e0b", backgroundColor: "#fffbeb" },
  polygonTitle: { fontSize: 13, fontWeight: "600", color: "#0f172a" },
  polygonSubtext: { fontSize: 11, color: "#64748b", marginTop: 2 },
  emptyText: {
    fontSize: 13,
    color: "#94a3b8",
    fontStyle: "italic",
    padding: 12,
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    minHeight: 90,
    textAlignVertical: "top",
    backgroundColor: "#f8fafc",
  },
  photoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#dcfce7",
    padding: 12,
    borderRadius: 10,
    justifyContent: "center",
    marginTop: 4,
  },
  photoBtnText: { color: "#0F4A2F", fontWeight: "600", fontSize: 14 },
  formActions: {
    flexDirection: "row",
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  btnDraft: {
    flex: 1,
    backgroundColor: "#64748b",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 14,
    borderRadius: 12,
  },
  btnSubmit: {
    flex: 1,
    backgroundColor: "#0F4A2F",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 14,
    borderRadius: 12,
  },
  btnText: { color: "#fff", fontWeight: "600", fontSize: 14 },

  // Coordinate Editor
  coordEditorModal: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: "75%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#0f172a" },
  coordList: { maxHeight: 350, marginBottom: 16 },
  coordRow: {
    backgroundColor: "#f8fafc",
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  coordNumber: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 10,
  },
  coordInputs: { flexDirection: "row", gap: 12, marginBottom: 8 },
  inputGroup: { flex: 1 },
  inputLabel: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "600",
    marginBottom: 6,
  },
  coordInput: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
  },
  deleteCoordBtn: { alignSelf: "flex-end", padding: 4, marginTop: 4 },
  modalActions: { flexDirection: "row", gap: 10 },
  addBtn: {
    flex: 1,
    backgroundColor: "#16a34a",
    padding: 14,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  addBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  cancelBtn: {
    flex: 1,
    backgroundColor: "#f1f5f9",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  cancelBtnText: { color: "#64748b", fontWeight: "600", fontSize: 14 },
  submitBtn: {
    flex: 1.5,
    backgroundColor: "#0F4A2F",
    padding: 14,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  submitBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },

  // Polygon Controls - IMPROVED
  polygonControls: {
    position: "absolute",
    bottom: -100,
    left: 16,
    right: 16,
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    elevation: 5,
  },
  controlsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  controlsTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  closeControlsBtn: {
    padding: 4,
    backgroundColor: "#f1f5f9",
    borderRadius: 6,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  editCoordsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#dbeafe",
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
    justifyContent: "center",
  },
  editCoordsBtnText: { color: "#1e40af", fontWeight: "600", fontSize: 13 },
  polygonActions: { flexDirection: "row", gap: 10 },
  undoBtn: {
    flex: 1,
    backgroundColor: "#fbbf24",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  saveBtn: {
    flex: 1,
    backgroundColor: "#0F4A2F",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  undoBtnText: { color: "#856404", fontWeight: "600", fontSize: 13 },
  saveBtnText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  btnDisabled: { opacity: 0.5 },

  // Toast
  toast: {
    position: "absolute",
    top: 60,
    left: 20,
    right: 20,
    backgroundColor: "#16a34a",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    zIndex: 100,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    elevation: 3,
  },
  toastText: { color: "#fff", fontWeight: "600", fontSize: 13, flex: 1 },
});
