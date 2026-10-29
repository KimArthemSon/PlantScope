import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Modal, ScrollView } from "react-native";
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

/** A planted area from an earlier report that can be copied into this one. */
export interface PreviousArea {
  id: number;
  date: string | null;
  status: string;
  visitType: string;
  inspector: string;
  hectares: number | null;
  points: [number, number][];
}

/**
 * Geodesic area on a sphere (R = 6,378,137 m), same method as Google Earth.
 * Must match the backend (sites.models.calculate_polygon_area_hectares).
 */
export function polygonAreaHectares(points: { latitude: number; longitude: number }[]): number {
  if (points.length < MIN_AREA_POINTS) return 0;
  const R = 6378137;
  const rad = (d: number) => (d * Math.PI) / 180;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += rad(b.longitude - a.longitude) * (2 + Math.sin(rad(a.latitude)) + Math.sin(rad(b.latitude)));
  }
  return Math.abs((sum * R * R) / 2) / 10000;
}

const VISIT_LABEL: Record<string, string> = { initial: "Initial", ongoing: "Ongoing", inactive_check: "Inactive check" };
const STATUS_COLOR: Record<string, { fg: string; bg: string; label: string }> = {
  accepted: { fg: "#059669", bg: "#D1FAE5", label: "Accepted" },
  pending: { fg: "#D97706", bg: "#FEF3C7", label: "In review" },
  rejected: { fg: "#DC2626", bg: "#FEE2E2", label: "Returned" },
};
const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "No date";

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
  previousAreas = [],
}: {
  points: PlantedAreaPoint[];
  onChange: (points: PlantedAreaPoint[]) => void;
  siteAreaHectares?: number;
  previousAreas?: PreviousArea[];
}) {
  const { success, warning, error: showError, confirm } = useAlert();
  const [capturing, setCapturing] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [showReuse, setShowReuse] = useState(false);
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

  // Copy a previous report's corners into this report; they can still be edited after
  const applyPrevious = (prev: PreviousArea) => {
    const load = () => {
      onChange(prev.points.map(([lat, lng], i) => ({ id: `reuse-${prev.id}-${i}-${Date.now()}`, latitude: Number(lat), longitude: Number(lng) })));
      setShowReuse(false);
      success("Area loaded", `${prev.points.length} corners copied from report #${prev.id}. Add or remove corners if the area changed.`);
    };
    if (points.length > 0) {
      setShowReuse(false);
      confirm("Replace current corners?", `This replaces the ${points.length} corner(s) you already marked.`, load, {
        type: "warning",
        confirmText: "Replace",
        cancelText: "Cancel",
      });
    } else {
      load();
    }
  };

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

      {previousAreas.length > 0 && (
        <TouchableOpacity style={[s.btn, s.reuseBtn]} onPress={() => setShowReuse(true)} activeOpacity={0.8}>
          <MaterialCommunityIcons name="history" size={16} color={PRIMARY} />
          <Text style={s.btnText}>Reuse Previous Area ({previousAreas.length})</Text>
        </TouchableOpacity>
      )}

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

      <Modal visible={showReuse} transparent animationType="fade" onRequestClose={() => setShowReuse(false)}>
        <View style={s.overlay}>
          <View style={[s.modal, { maxHeight: "80%" }]}>
            <Text style={s.modalTitle}>Reuse a Previous Area</Text>
            <Text style={[s.hint, { marginBottom: 8 }]}>
              Pick a report to copy its planted-area corners. You can still add or remove corners afterwards.
            </Text>
            <ScrollView style={{ flexGrow: 0 }}>
              {previousAreas.map((prev) => {
                const st = STATUS_COLOR[prev.status] ?? { fg: MUTED, bg: "#F3F4F6", label: prev.status };
                const ha = prev.hectares ?? polygonAreaHectares(prev.points.map(([latitude, longitude]) => ({ latitude, longitude })));
                return (
                  <TouchableOpacity key={prev.id} style={s.reuseRow} onPress={() => applyPrevious(prev)} activeOpacity={0.75}>
                    <MaterialCommunityIcons name="vector-polygon" size={20} color={PRIMARY} />
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={s.reuseTitle}>Report #{prev.id}</Text>
                        <View style={[s.badge, { backgroundColor: st.bg }]}>
                          <Text style={[s.badgeText, { color: st.fg }]}>{st.label}</Text>
                        </View>
                      </View>
                      <Text style={s.reuseSub}>
                        {fmtDate(prev.date)} · {VISIT_LABEL[prev.visitType] ?? prev.visitType} · {prev.inspector}
                      </Text>
                      <Text style={s.reuseArea}>
                        {ha.toFixed(4)} ha · {prev.points.length} corners
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={FAINT} />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity style={[s.btn, { marginTop: 12, flex: 0 }]} onPress={() => setShowReuse(false)}>
              <Text style={s.btnText}>Cancel</Text>
            </TouchableOpacity>
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
  reuseBtn: { flex: 0, marginTop: 10, borderStyle: "dashed", borderColor: "#A7F3D0", backgroundColor: "#F0FDF4" },
  reuseRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  reuseTitle: { fontSize: 14, fontWeight: "800", color: INK },
  reuseSub: { fontSize: 11.5, color: MUTED, marginTop: 2 },
  reuseArea: { fontSize: 12, fontWeight: "700", color: PRIMARY, marginTop: 2 },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 },
  badgeText: { fontSize: 10, fontWeight: "800" },
  overlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.5)", justifyContent: "center", padding: 24 },
  modal: { backgroundColor: WHITE, borderRadius: 20, padding: 20 },
  modalTitle: { fontSize: 17, fontWeight: "800", color: INK, marginBottom: 12 },
  inputLabel: { fontSize: 11.5, color: MUTED, marginBottom: 5, marginTop: 8, fontWeight: "600" },
  input: { backgroundColor: "#F9FAFB", borderWidth: 1.5, borderColor: BORDER, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: INK },
});
