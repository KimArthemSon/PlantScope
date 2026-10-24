import React, { useMemo } from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Read-only map of one progress report's planted-area polygon, drawn over the site boundary.

type LatLng = [number, number];

const normalize = (coords: any): LatLng[] => {
  if (!Array.isArray(coords)) return [];
  const pts = coords
    .map((c: any) => (Array.isArray(c) ? [Number(c[0]), Number(c[1])] : [Number(c?.latitude), Number(c?.longitude)]))
    .filter((c: number[]) => Number.isFinite(c[0]) && Number.isFinite(c[1])) as LatLng[];
  // Stored as [lat, lng]; flip if a polygon was saved as [lng, lat]
  return pts.length && Math.abs(pts[0][0]) > 90 ? pts.map(([a, b]) => [b, a] as LatLng) : pts;
};

function buildHtml(report: LatLng[], site: LatLng[]) {
  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html,body,#map{margin:0;height:100%;width:100%;background:#e5e7eb}
  .num{background:#7c3aed;color:#fff;border:2px solid #fff;border-radius:50%;width:22px;height:22px;
       display:flex;align-items:center;justify-content:center;font:700 11px sans-serif;box-shadow:0 1px 4px rgba(0,0,0,.4)}
</style></head><body><div id="map"></div><script>
  var report = ${JSON.stringify(report)};
  var site = ${JSON.stringify(site)};
  var map = L.map('map', { zoomControl: true, attributionControl: false });
  var sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 });
  var osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 });
  sat.addTo(map);
  L.control.layers({ 'Satellite': sat, 'Street': osm }, null, { position: 'topright' }).addTo(map);
  var group = L.featureGroup().addTo(map);
  if (site.length >= 3) L.polygon(site, { color: '#f8fafc', weight: 2, dashArray: '6 6', fillOpacity: 0.05 }).bindTooltip('Site boundary').addTo(group);
  if (report.length >= 3) L.polygon(report, { color: '#22c55e', weight: 3, fillColor: '#22c55e', fillOpacity: 0.3 }).addTo(group);
  report.forEach(function (p, i) {
    L.marker(p, { icon: L.divIcon({ className: '', html: '<div class="num">' + (i + 1) + '</div>', iconSize: [22, 22], iconAnchor: [11, 11] }) })
      .bindPopup('Corner ' + (i + 1) + '<br/>' + p[0].toFixed(6) + ', ' + p[1].toFixed(6)).addTo(group);
  });
  if (group.getLayers().length) map.fitBounds(group.getBounds(), { padding: [30, 30], maxZoom: 18 });
  else map.setView([11.0064, 124.6075], 12);
</script></body></html>`;
}

export default function ReportPolygonMapModal({
  visible,
  onClose,
  title,
  subtitle,
  reportPolygon,
  sitePolygon,
  areaHectares,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  reportPolygon: any;
  sitePolygon?: any;
  areaHectares?: number | null;
}) {
  const insets = useSafeAreaInsets();
  const report = useMemo(() => normalize(reportPolygon), [reportPolygon]);
  const site = useMemo(() => normalize(sitePolygon), [sitePolygon]);
  const html = useMemo(() => buildHtml(report, site), [report, site]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <View style={{ flex: 1 }}>
          <Text style={s.title} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={s.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
        <TouchableOpacity style={s.close} onPress={onClose} hitSlop={8}>
          <Ionicons name="close" size={20} color="#111827" />
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1 }}>
        {visible && <WebView originWhitelist={["*"]} source={{ html }} style={{ flex: 1 }} javaScriptEnabled domStorageEnabled />}

        <View style={[s.card, { bottom: insets.bottom + 16 }]}>
          <View style={{ flex: 1 }}>
            <Text style={s.cardLabel}>Planted area</Text>
            <Text style={s.cardValue}>{areaHectares != null ? `${areaHectares.toFixed(4)} ha` : "—"}</Text>
          </View>
          <View style={s.legend}>
            <View style={s.legendRow}>
              <View style={[s.swatch, { backgroundColor: "rgba(34,197,94,0.5)", borderColor: "#22c55e" }]} />
              <Text style={s.legendText}>Planted ({report.length} pts)</Text>
            </View>
            {site.length >= 3 && (
              <View style={s.legendRow}>
                <View style={[s.swatch, { borderStyle: "dashed", borderColor: "#6B7280" }]} />
                <Text style={s.legendText}>Site boundary</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  title: { fontSize: 16, fontWeight: "800", color: "#111827" },
  subtitle: { fontSize: 12, color: "#6B7280", marginTop: 1 },
  close: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#F3F4F6", justifyContent: "center", alignItems: "center" },
  card: { position: "absolute", left: 16, right: 16, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#FFFFFF", borderRadius: 16, padding: 14, elevation: 6, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 8 },
  cardLabel: { fontSize: 10.5, fontWeight: "700", color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.4 },
  cardValue: { fontSize: 20, fontWeight: "800", color: "#0F4A2F", marginTop: 2 },
  legend: { gap: 4 },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  swatch: { width: 14, height: 14, borderRadius: 3, borderWidth: 2 },
  legendText: { fontSize: 11.5, color: "#374151", fontWeight: "600" },
});
