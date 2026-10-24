import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Modal } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useAlert } from "@/components/AlertContext";

// Walk the edge of the planted area and drop a point at each corner.
// The server recomputes the area from these points; the number shown here is a preview.

export interface PlantedAreaPoint {
  id: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export const MIN_AREA_POINTS = 3;
const MAX_AREA_POINTS = 200;
const GPS_TIMEOUT_MS = 30000;

const PRIMARY = "#0F4A2F";
const INK = "#111827";
const MUTED = "#6B7280";
const FAINT = "#9CA3AF";
const BORDER = "#E5E7EB";
const DANGER = "#DC2626";
const WARNING = "#D97706";
const WHITE = "#FFFFFF";

/** Same formula as the backend (sites.models.calculate_polygon_area_hectares). */
export function polygonAreaHectares(points: { latitude: number; longitude: number }[]): number {
  if (points.length < MIN_AREA_POINTS) return 0;
  const latRad = ((points.reduce((s, p) => s + p.latitude, 0) / points.length) * Math.PI) / 180;
  const mLat = 111132.92 - 559.82 * Math.cos(2 * latRad) + 1.175 * Math.cos(4 * latRad);
  const mLng = 111412.84 * Math.cos(latRad) - 93.5 * Math.cos(3 * latRad);
  const o = points[0];
  const xy = points.map((p) => [(p.longitude - o.longitude) * mLng, (p.latitude - o.latitude) * mLat]);
  let sum = 0;
  for (let i = 0; i < xy.length; i++) {
    const j = (i + 1) % xy.length;
    sum += xy[i][0] * xy[j][1] - xy[j][0] * xy[i][1];
  }
  return Math.abs(sum) / 2 / 10000;
}

const distanceMeters = (a: PlantedAreaPoint, b: PlantedAreaPoint) => {
  const R = 6371e3;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.latitude * Math.PI) / 180) * Math.cos((b.latitude * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

export default function PlantedAreaCapture({
  points,
  onChange,
  siteAreaHectares,
}: {
  points: PlantedAreaPoint[];
  onChange: (points: PlantedAreaPoint[]) => void;
  siteAreaHectares?: number;
}) {
  const { success, warning, error: showError, confirm } = useAlert();
  const [capturing, setCapturing] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualLat, setManualLat] = useState("");
  const [manualLng, setManualLng] = useState("");

  const area = polygonAreaHectares(points);
  const percentOfSite = siteAreaHectares ? (area / siteAreaHectares) * 100 : null;

  const addPoint = (p: Omit<PlantedAreaPoint, "id">) => {
    if (points.length >= MAX_AREA_POINTS) {
      warning("Too many points", `You can add up to ${MAX_AREA_POINTS} points.`);
      return;
    }
    const last = points[points.length - 1];
    const next = { ...p, id: `pt-${Date.now()}` };
    if (last && distanceMeters(last, next) < 2) {
      warning("Point too close", "This is within 2 m of the last point. Walk to the next corner first.");
      return;
    }
    onChange([...points, next]);
  };

  const captureGps = async () => {
    setCapturing(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        warning("Location needed", "Allow location access to mark the corners of the planted area.");
        return;
      }
      let loc: Location.LocationObject | null = null;
      let cached = false;
      try {
        loc = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), GPS_TIMEOUT_MS)),
        ]);
      } catch {
        loc = await Location.getLastKnownPositionAsync();
        cached = !!loc;
      }
      if (!loc) {
        showError("No GPS signal", "Move to an open spot or enter the coordinates by hand.");
        return;
      }
      addPoint({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        accuracy: loc.coords.accuracy ?? undefined,
      });
      if (cached) warning("Using last known location", "Live GPS was unavailable, so the last known position was used.");
      else success("Point added", `Corner ${points.length + 1} saved (±${Math.round(loc.coords.accuracy ?? 0)} m).`);
    } catch {
      showError("GPS error", "Couldn't get your location.");
    } finally {
      setCapturing(false);
    }
  };

  const saveManual = () => {
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      warning("Invalid coordinates", "Enter a latitude (-90 to 90) and longitude (-180 to 180).");
      return;
    }
    addPoint({ latitude: lat, longitude: lng });
    setManualLat("");
    setManualLng("");
    setShowManual(false);
  };

  const removePoint = (id: string) => onChange(points.filter((p) => p.id !== id));

  const clearAll = () =>
    confirm("Clear all points?", "This removes every corner you marked.", () => onChange([]), {
      type: "error",
      confirmText: "Clear",
      cancelText: "Cancel",
    });

  return (
    <View>
      <Text style={s.hint}>
        Walk along the edge of the area planted so far and tap “Mark Corner” at each corner. Points are joined in order and
        the last point connects back to the first.
      </Text>

      <View style={s.areaBox}>
        <MaterialCommunityIcons name="vector-polygon" size={22} color={PRIMARY} />
        <View style={{ flex: 1 }}>
          <Text style={s.areaLabel}>Planted area (estimate)</Text>
          <Text style={s.areaValue}>
            {points.length >= MIN_AREA_POINTS ? `${area.toFixed(4)} ha` : "—"}
            {percentOfSite != null && points.length >= MIN_AREA_POINTS ? (
              <Text style={s.areaSub}>{`  ·  ${percentOfSite.toFixed(1)}% of site`}</Text>
            ) : null}
          </Text>
        </View>
        <Text style={s.pointCount}>{points.length} pts</Text>
      </View>

      {points.length > 0 && points.length < MIN_AREA_POINTS && (
        <Text style={s.warn}>Add {MIN_AREA_POINTS - points.length} more point(s) to form an area.</Text>
      )}
      {percentOfSite != null && percentOfSite > 110 && (
        <Text style={s.warn}>This is larger than the site boundary. Check that the points are correct.</Text>
      )}

      <View style={s.btnRow}>
        <TouchableOpacity style={[s.btn, s.btnPrimary]} onPress={captureGps} disabled={capturing} activeOpacity={0.8}>
          {capturing ? <ActivityIndicator size="small" color={WHITE} /> : <MaterialCommunityIcons name="crosshairs-gps" size={16} color={WHITE} />}
          <Text style={[s.btnText, { color: WHITE }]}>{capturing ? "Getting GPS…" : "Mark Corner"}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.btn} onPress={() => setShowManual(true)} activeOpacity={0.8}>
          <Ionicons name="create-outline" size={16} color={PRIMARY} />
          <Text style={s.btnText}>Enter Manually</Text>
        </TouchableOpacity>
      </View>

      {points.length > 0 && (
        <View style={{ marginTop: 12 }}>
          <View style={s.listHead}>
            <Text style={s.listTitle}>Corners</Text>
            <TouchableOpacity onPress={clearAll} hitSlop={8}>
              <Text style={s.clear}>Clear all</Text>
            </TouchableOpacity>
          </View>
          {points.map((p, i) => (
            <View key={p.id} style={s.pointRow}>
              <View style={s.pointNum}>
                <Text style={s.pointNumText}>{i + 1}</Text>
              </View>
              <Text style={s.pointCoords}>
                {p.latitude.toFixed(6)}, {p.longitude.toFixed(6)}
                {p.accuracy != null ? <Text style={{ color: FAINT }}>{`  ±${Math.round(p.accuracy)}m`}</Text> : null}
              </Text>
              <TouchableOpacity onPress={() => removePoint(p.id)} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={DANGER} />
              </TouchableOpacity>
            </View>
          ))}
          <Text style={s.mapHint}>Tap the map button to check the shape on the map.</Text>
        </View>
      )}

      <Modal visible={showManual} transparent animationType="fade" onRequestClose={() => setShowManual(false)}>
        <View style={s.overlay}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>Add Corner</Text>
            <Text style={s.inputLabel}>Latitude</Text>
            <TextInput style={s.input} keyboardType="decimal-pad" value={manualLat} onChangeText={setManualLat} placeholder="e.g. 11.0064" placeholderTextColor={FAINT} />
            <Text style={s.inputLabel}>Longitude</Text>
            <TextInput style={s.input} keyboardType="decimal-pad" value={manualLng} onChangeText={setManualLng} placeholder="e.g. 124.6075" placeholderTextColor={FAINT} />
            <View style={[s.btnRow, { marginTop: 16 }]}>
              <TouchableOpacity style={s.btn} onPress={() => setShowManual(false)}>
                <Text style={s.btnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, s.btnPrimary]} onPress={saveManual}>
                <Text style={[s.btnText, { color: WHITE }]}>Add Point</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  hint: { fontSize: 12, color: MUTED, lineHeight: 17, marginBottom: 12 },
  areaBox: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 14, backgroundColor: "#ECFDF5", borderWidth: 1, borderColor: "#A7F3D0" },
  areaLabel: { fontSize: 10.5, fontWeight: "700", color: MUTED, textTransform: "uppercase", letterSpacing: 0.4 },
  areaValue: { fontSize: 18, fontWeight: "800", color: PRIMARY, marginTop: 2 },
  areaSub: { fontSize: 12, fontWeight: "600", color: MUTED },
  pointCount: { fontSize: 12, fontWeight: "700", color: MUTED },
  warn: { fontSize: 11.5, color: WARNING, fontWeight: "600", marginTop: 8 },
  btnRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  btn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: BORDER, backgroundColor: WHITE },
  btnPrimary: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  btnText: { fontSize: 13, fontWeight: "700", color: PRIMARY },
  listHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  listTitle: { fontSize: 11.5, fontWeight: "700", color: MUTED, textTransform: "uppercase", letterSpacing: 0.4 },
  clear: { fontSize: 12, fontWeight: "700", color: DANGER },
  pointRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  pointNum: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#EDE9FE", justifyContent: "center", alignItems: "center" },
  pointNumText: { fontSize: 11, fontWeight: "800", color: "#7C3AED" },
  pointCoords: { flex: 1, fontSize: 12.5, color: INK, fontVariant: ["tabular-nums"] },
  mapHint: { fontSize: 11, color: FAINT, marginTop: 8 },
  overlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.5)", justifyContent: "center", padding: 24 },
  modal: { backgroundColor: WHITE, borderRadius: 20, padding: 20 },
  modalTitle: { fontSize: 17, fontWeight: "800", color: INK, marginBottom: 12 },
  inputLabel: { fontSize: 11.5, color: MUTED, marginBottom: 5, marginTop: 8, fontWeight: "600" },
  input: { backgroundColor: "#F9FAFB", borderWidth: 1.5, borderColor: BORDER, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: INK },
});
