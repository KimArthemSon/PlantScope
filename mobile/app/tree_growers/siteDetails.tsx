import React, { useState, useEffect, useRef, useCallback } from "react";
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

const PRIMARY = "#0F4A2F";
const PRIMARY_SOFT = "#ECFDF5";
const INK = "#0F172A";
const MUTED = "#64748B";
const FAINT = "#94A3B8";
const BORDER = "#E2E8F0";
const SURFACE = "#F8FAFC";

const HERO_HEIGHT = 320;
const FOOTER_HEIGHT = 84;
const DESCRIPTION_LINE_LIMIT = 4;

// ─── Types ───────────────────────────────────────────────────────────────────

interface SiteHistorySummary {
  total_applications: number;
  past_program_count: number;
  completed_application_count: number;
  failed_application_count: number;
  total_monitoring_visits: number;
  initial_visit_count: number;
  ongoing_visit_count: number;
  latest_monitoring_date: string | null;
  average_survival_rate: number;
  total_trees_planted: number;
  total_trees_survived: number;
  total_seedling_requests: number;
  total_seedlings_requested: number;
  total_seedlings_confirmed: number;
}

interface PastProgram {
  status: "completed" | "failed" | string;
  started_at: string | null;
  ended_at: string | null;
  trees_planted: number;
  trees_survived: number;
  survival_rate: number;
}

interface MonitoringVisit {
  progress_report_id: number;
  visit_type: string;
  visit_type_label: string;
  status: string;
  status_label: string;
  orientation_conducted: boolean;
  submitted_at: string | null;
  total_planted: number;
  total_added: number;
  total_survived: number;
  total_dead: number;
  total_plants: number;
  survival_rate: number;
}

interface SiteHistory {
  has_history: boolean;
  past_program_count: number;
  summary: SiteHistorySummary;
  past_programs?: PastProgram[];
  recent_monitoring_visits: MonitoringVisit[];
  seedling_summary?: {
    requested_species?: { species_id: number; name: string; total_quantity: number }[];
  };
}

interface SiteDetails {
  site_id: number;
  name: string;
  description: string | null;
  reforestation_area: string;
  barangay: string;
  total_area_hectares: number;
  monitoring_status?: string;
  marker_coordinate: [number, number] | null;
  polygon_coordinates: [number, number][] | null;
  main_image_url?: string | null;
  general_images: { image_id: number; url: string | null; caption: string | null }[];
  recommended_species: {
    species_id: number;
    name: string;
    description: string;
    priority_rank: number;
    notes: string | null;
  }[];
  accessibility: any;
  land_classification: { id: number; name: string } | null;
  created_at: string | null;
  site_history: SiteHistory | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const titleCase = (s: string) =>
  s.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

const parseAccessibility = (acc: any): string[] => {
  if (!acc) return [];
  if (Array.isArray(acc)) {
    return acc
      .map((item) => {
        const t = typeof item === "object" ? item?.type : item;
        if (!t || String(t).toLowerCase() === "unknown") return null;
        return titleCase(String(t));
      })
      .filter(Boolean) as string[];
  }
  if (typeof acc === "object") return parseAccessibility([acc]);
  if (typeof acc === "string") {
    try {
      return parseAccessibility(JSON.parse(acc));
    } catch {
      try {
        const fixed = acc
          .replace(/'/g, '"')
          .replace(/True/g, "true")
          .replace(/False/g, "false")
          .replace(/None/g, "null");
        return parseAccessibility(JSON.parse(fixed.startsWith("[") ? fixed : `[${fixed}]`));
      } catch {
        return acc.toLowerCase() === "unknown" ? [] : [acc];
      }
    }
  }
  return [];
};

const getAccessibilityIcon = (type: string): keyof typeof Ionicons.glyphMap => {
  const t = type.toLowerCase();
  if (t.includes("motor") || t.includes("bike")) return "bicycle";
  if (t.includes("walk") || t.includes("foot") || t.includes("pedestrian")) return "walk";
  if (t.includes("boat") || t.includes("water")) return "boat";
  if (t.includes("vehicle") || t.includes("car") || t.includes("road")) return "car";
  return "navigate";
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value; // already a display string
  return d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
};

const formatMonthYear = (value: string | null | undefined) => {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-PH", { year: "numeric", month: "short" });
};

const imageUrl = (url: string | null | undefined) =>
  !url ? null : url.startsWith("http") ? url : `${api}${url}`;

const rateColor = (rate: number) =>
  rate >= 80 ? "#059669" : rate >= 50 ? "#D97706" : "#DC2626";

const STATUS_PILL: Record<string, { label: string; bg: string; fg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  available: { label: "Open for Applications", bg: "#ECFDF5", fg: "#047857", icon: "checkmark-circle" },
  reserved: { label: "Reserved", bg: "#FFFBEB", fg: "#B45309", icon: "time" },
};

// ─── Map ─────────────────────────────────────────────────────────────────────

const getCenter = (site: SiteDetails): [number, number] | null => {
  if (site.marker_coordinate?.length === 2) return site.marker_coordinate;
  const poly = site.polygon_coordinates;
  if (poly && poly.length > 0) {
    const lat = poly.reduce((s, p) => s + p[0], 0) / poly.length;
    const lng = poly.reduce((s, p) => s + p[1], 0) / poly.length;
    return [lat, lng];
  }
  return null;
};

const OsmMap = ({
  center,
  polygon,
  interactive,
}: {
  center: [number, number];
  polygon: [number, number][] | null;
  interactive: boolean;
}) => {
  const html = `<!DOCTYPE html><html><head>
    <meta name="viewport" content="initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <style>html,body,#map{margin:0;padding:0;width:100%;height:100%;}
    .leaflet-control-attribution{font-size:9px}.pin{background:transparent;border:none}</style>
    </head><body><div id="map"></div><script>
    try {
      var map = L.map('map', { zoomControl: ${interactive}, dragging: ${interactive},
        touchZoom: ${interactive}, doubleClickZoom: ${interactive}, scrollWheelZoom: false,
        attributionControl: true }).setView([${center[0]}, ${center[1]}], 15);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OSM', maxZoom: 19 }).addTo(map);
      L.marker([${center[0]}, ${center[1]}], { icon: L.divIcon({ className: 'pin', iconSize: [18, 18], iconAnchor: [9, 9],
        html: "<div style='width:18px;height:18px;border-radius:50%;background:${PRIMARY};border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)'></div>" }) }).addTo(map);
      var pts = ${polygon && polygon.length >= 3 ? JSON.stringify(polygon) : "null"};
      if (pts) { var poly = L.polygon(pts, { color: '${PRIMARY}', fillColor: '${PRIMARY}', fillOpacity: 0.2, weight: 2 }).addTo(map);
        map.fitBounds(poly.getBounds(), { padding: [24, 24] }); }
    } catch (e) {}
    </script></body></html>`;

  return (
    <WebView
      source={{ html }}
      style={{ flex: 1 }}
      javaScriptEnabled
      domStorageEnabled
      originWhitelist={["*"]}
      scrollEnabled={false}
      nestedScrollEnabled
      pointerEvents={interactive ? "auto" : "none"}
    />
  );
};

// ─── Small building blocks ───────────────────────────────────────────────────

const Section = ({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <View style={styles.section}>
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {right}
    </View>
    {children}
  </View>
);

const Fact = ({
  icon,
  value,
  label,
  tint,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
  tint: string;
}) => (
  <View style={styles.fact}>
    <View style={[styles.factIcon, { backgroundColor: tint + "1A" }]}>
      <Ionicons name={icon} size={18} color={tint} />
    </View>
    <Text style={styles.factValue} numberOfLines={1}>
      {value}
    </Text>
    <Text style={styles.factLabel} numberOfLines={1}>
      {label}
    </Text>
  </View>
);

const RateBar = ({ rate }: { rate: number }) => (
  <View style={styles.rateTrack}>
    <View
      style={[
        styles.rateFill,
        { width: `${Math.min(100, Math.max(0, rate))}%`, backgroundColor: rateColor(rate) },
      ]}
    />
  </View>
);

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function SiteDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const siteId = params.site_id as string;
  const hasOngoing = params.has_ongoing === "true";

  const [details, setDetails] = useState<SiteDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [mapVisible, setMapVisible] = useState(false);
  const [galleryVisible, setGalleryVisible] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [descExpanded, setDescExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  const [showAllVisits, setShowAllVisits] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(new Animated.Value(0)).current;

  const fetchDetails = useCallback(
    async (isRefresh = false) => {
      if (!siteId) return;
      try {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        setErrorMessage(null);

        const token = await SecureStore.getItemAsync("token");
        if (!token) throw new Error("You are not logged in.");

        const res = await fetch(`${api}/api/get_site_details_for_tree_grower/${siteId}/`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `Failed to load site (${res.status})`);
        setDetails(data);
      } catch (err: any) {
        setErrorMessage(err?.message || "Something went wrong.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [siteId],
  );

  // This screen stays mounted inside Tabs: reset everything when a new site is opened
  useEffect(() => {
    setDetails(null);
    setDescExpanded(false);
    setIsTruncated(false);
    setShowAllVisits(false);
    setGalleryIndex(0);
    scrollRef.current?.scrollTo?.({ y: 0, animated: false });
    fetchDetails();
  }, [siteId, fetchDetails]);

  const goBack = () => router.replace("/tree_growers/sites");

  const handleApply = () => {
    if (!details) return;
    if (hasOngoing) {
      Alert.alert("Cannot Apply", "You already have an ongoing application.");
      return;
    }
    router.push({
      pathname: "/tree_growers/Reapply",
      params: { site_id: details.site_id.toString(), site_name: details.name },
    });
  };

  // ── Loading / error states ──
  if (loading && !details) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={PRIMARY} />
        <Text style={styles.loadingText}>Loading site details…</Text>
      </View>
    );
  }

  if (!details) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top, padding: 32 }]}>
        <View style={styles.errorIcon}>
          <Ionicons name="alert-circle-outline" size={34} color={PRIMARY} />
        </View>
        <Text style={styles.errorTitle}>Couldn't load this site</Text>
        <Text style={styles.errorText}>{errorMessage || "Please try again."}</Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <TouchableOpacity style={styles.secondaryBtn} onPress={goBack}>
            <Text style={styles.secondaryBtnText}>Back to Sites</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => fetchDetails()}>
            <Ionicons name="refresh" size={16} color="#fff" />
            <Text style={styles.primaryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Derived data ──
  const heroUrl = imageUrl(details.main_image_url) || imageUrl(details.general_images[0]?.url);
  const gallery = details.general_images.filter((g) => g.url);
  const accessibility = parseAccessibility(details.accessibility);
  const center = getCenter(details);
  const history = details.site_history;
  const summary = history?.summary;
  const pastPrograms = history?.past_programs || [];
  const visits = history?.recent_monitoring_visits || [];
  const shownVisits = showAllVisits ? visits : visits.slice(0, 2);
  const requestedSpecies = history?.seedling_summary?.requested_species || [];
  const pill = STATUS_PILL[details.monitoring_status || "available"] || STATUS_PILL.available;

  const heroScale = scrollY.interpolate({
    inputRange: [-HERO_HEIGHT, 0],
    outputRange: [1.6, 1],
    extrapolateRight: "clamp",
  });
  const headerOpacity = scrollY.interpolate({
    inputRange: [HERO_HEIGHT - 140, HERO_HEIGHT - 60],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  return (
    <View style={styles.container}>
      {/* Hero */}
      <Animated.View style={[styles.hero, { transform: [{ scale: heroScale }] }]}>
        {heroUrl ? (
          <Image source={{ uri: heroUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.heroPlaceholder]}>
            <Ionicons name="leaf" size={56} color="#A7F3D0" />
          </View>
        )}
        <View style={styles.heroShade} />
      </Animated.View>

      {/* Sticky title bar (fades in on scroll) */}
      <Animated.View
        pointerEvents="none"
        style={[styles.stickyHeader, { paddingTop: insets.top, height: insets.top + 56, opacity: headerOpacity }]}
      >
        <Text style={styles.stickyTitle} numberOfLines={1}>
          {details.name}
        </Text>
      </Animated.View>

      {/* Floating buttons */}
      <TouchableOpacity
        style={[styles.roundBtn, { top: insets.top + 8, left: 16 }]}
        onPress={goBack}
        activeOpacity={0.8}
      >
        <Ionicons name="chevron-back" size={22} color={INK} />
      </TouchableOpacity>
      {gallery.length > 0 && (
        <TouchableOpacity
          style={[styles.photoChip, { top: insets.top + 14 }]}
          onPress={() => {
            setGalleryIndex(0);
            setGalleryVisible(true);
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="images" size={14} color="#fff" />
          <Text style={styles.photoChipText}>{gallery.length}</Text>
        </TouchableOpacity>
      )}

      <Animated.ScrollView
        ref={scrollRef as any}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: true,
        })}
        contentContainerStyle={{ paddingBottom: FOOTER_HEIGHT + 24 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchDetails(true)}
            tintColor="#fff"
            colors={[PRIMARY]}
            progressViewOffset={insets.top + 40}
          />
        }
      >
        <View style={{ height: HERO_HEIGHT - 28 }} />

        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />

          {/* Title block */}
          <View style={[styles.statusPill, { backgroundColor: pill.bg }]}>
            <Ionicons name={pill.icon} size={13} color={pill.fg} />
            <Text style={[styles.statusPillText, { color: pill.fg }]}>{pill.label}</Text>
          </View>
          <Text style={styles.siteName}>{details.name}</Text>
          <View style={styles.locationRow}>
            <Ionicons name="location" size={15} color={PRIMARY} />
            <Text style={styles.locationText}>
              Brgy. {details.barangay} · {details.reforestation_area}
            </Text>
          </View>

          {/* Quick facts */}
          <View style={styles.factsRow}>
            <Fact
              icon="resize"
              value={`${Number(details.total_area_hectares || 0).toFixed(2)}`}
              label="Hectares"
              tint="#059669"
            />
            <View style={styles.factDivider} />
            <Fact
              icon="layers"
              value={details.land_classification?.name || "—"}
              label="Land Class"
              tint="#2563EB"
            />
            <View style={styles.factDivider} />
            <Fact
              icon="time"
              value={String(summary?.past_program_count || 0)}
              label="Past Programs"
              tint="#7C3AED"
            />
          </View>

          {/* About */}
          {!!details.description && (
            <Section title="About this Site">
              <Text
                style={styles.bodyText}
                numberOfLines={descExpanded ? undefined : isTruncated ? DESCRIPTION_LINE_LIMIT : undefined}
                onTextLayout={(e) => {
                  if (!descExpanded && !isTruncated && e.nativeEvent.lines.length > DESCRIPTION_LINE_LIMIT) {
                    setIsTruncated(true);
                  }
                }}
              >
                {details.description}
              </Text>
              {isTruncated && (
                <TouchableOpacity onPress={() => setDescExpanded((v) => !v)} style={styles.linkBtn}>
                  <Text style={styles.linkText}>{descExpanded ? "Show less" : "Read more"}</Text>
                  <Ionicons name={descExpanded ? "chevron-up" : "chevron-down"} size={14} color={PRIMARY} />
                </TouchableOpacity>
              )}
            </Section>
          )}

          {/* Location */}
          {center && (
            <Section
              title="Location"
              right={
                <TouchableOpacity onPress={() => setMapVisible(true)} style={styles.linkBtn}>
                  <Text style={styles.linkText}>Full map</Text>
                  <Ionicons name="expand" size={14} color={PRIMARY} />
                </TouchableOpacity>
              }
            >
              <TouchableOpacity
                style={styles.mapPreview}
                activeOpacity={0.9}
                onPress={() => setMapVisible(true)}
              >
                <OsmMap center={center} polygon={details.polygon_coordinates} interactive={false} />
                <View style={styles.mapTapHint}>
                  <Ionicons name="hand-left-outline" size={12} color={INK} />
                  <Text style={styles.mapTapHintText}>Tap to explore</Text>
                </View>
              </TouchableOpacity>
            </Section>
          )}

          {/* Accessibility */}
          {accessibility.length > 0 && (
            <Section title="How to Get There">
              <View style={styles.chipWrap}>
                {accessibility.map((type, i) => (
                  <View key={`${type}-${i}`} style={styles.accessChip}>
                    <Ionicons name={getAccessibilityIcon(type)} size={16} color={PRIMARY} />
                    <Text style={styles.accessChipText}>{type}</Text>
                  </View>
                ))}
              </View>
            </Section>
          )}

          {/* History */}
          <Section title="Site History">
            {history?.has_history && summary ? (
              <>
                {summary.past_program_count > 0 && (
                  <View style={styles.reopenBanner}>
                    <Ionicons name="refresh-circle" size={22} color="#047857" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reopenTitle}>Available again</Text>
                      <Text style={styles.reopenText}>
                        This site hosted {summary.past_program_count} past program
                        {summary.past_program_count > 1 ? "s" : ""} and is open for a new one.
                      </Text>
                    </View>
                  </View>
                )}

                <View style={styles.statGrid}>
                  <View style={styles.statCard}>
                    <Text style={styles.statValue}>{summary.total_trees_planted.toLocaleString()}</Text>
                    <Text style={styles.statLabel}>Trees Planted</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={[styles.statValue, { color: rateColor(summary.average_survival_rate) }]}>
                      {summary.total_trees_planted > 0 ? `${summary.average_survival_rate}%` : "—"}
                    </Text>
                    <Text style={styles.statLabel}>Avg. Survival</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statValue}>{summary.total_monitoring_visits}</Text>
                    <Text style={styles.statLabel}>Monitoring Visits</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statValue}>
                      {summary.total_seedlings_confirmed.toLocaleString()}
                    </Text>
                    <Text style={styles.statLabel}>Seedlings Delivered</Text>
                  </View>
                </View>

                {/* Past programs */}
                {pastPrograms.length > 0 && (
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Past Programs</Text>
                    {pastPrograms.map((p, i) => {
                      const ok = p.status === "completed";
                      return (
                        <View
                          key={i}
                          style={[styles.programRow, i === pastPrograms.length - 1 && { borderBottomWidth: 0 }]}
                        >
                          <View style={[styles.programDot, { backgroundColor: ok ? "#10B981" : "#EF4444" }]}>
                            <Ionicons name={ok ? "trophy" : "close"} size={12} color="#fff" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <View style={styles.rowBetween}>
                              <Text style={styles.programTitle}>
                                {ok ? "Completed" : "Did not finish"}
                              </Text>
                              <Text style={styles.programDate}>
                                {formatMonthYear(p.started_at)} – {formatMonthYear(p.ended_at)}
                              </Text>
                            </View>
                            <Text style={styles.programMeta}>
                              {p.trees_planted.toLocaleString()} planted · {p.trees_survived.toLocaleString()} survived
                            </Text>
                            {p.trees_planted > 0 && (
                              <View style={styles.rateRow}>
                                <RateBar rate={p.survival_rate} />
                                <Text style={[styles.rateText, { color: rateColor(p.survival_rate) }]}>
                                  {p.survival_rate}%
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* Monitoring visits */}
                {visits.length > 0 && (
                  <View style={styles.card}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.cardTitle}>Monitoring Visits</Text>
                      {summary.latest_monitoring_date && (
                        <Text style={styles.cardHint}>Last: {formatDate(summary.latest_monitoring_date)}</Text>
                      )}
                    </View>
                    {shownVisits.map((v, i) => (
                      <View
                        key={v.progress_report_id}
                        style={[styles.visitRow, i === shownVisits.length - 1 && { borderBottomWidth: 0 }]}
                      >
                        <View style={styles.visitIcon}>
                          <Ionicons
                            name={v.visit_type === "initial" ? "flag" : "clipboard"}
                            size={14}
                            color={PRIMARY}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={styles.rowBetween}>
                            <Text style={styles.visitTitle}>
                              {v.visit_type === "initial"
                                ? "Initial Orientation"
                                : v.visit_type === "inactive_check"
                                  ? "Inactive Site Check"
                                  : "Ongoing Monitoring"}
                            </Text>
                            <Text style={styles.programDate}>{formatDate(v.submitted_at)}</Text>
                          </View>
                          <Text style={styles.programMeta}>
                            {v.total_survived.toLocaleString()} alive · {v.total_dead.toLocaleString()} dead
                            {v.status !== "accepted" ? ` · ${v.status_label}` : ""}
                          </Text>
                          {v.total_plants > 0 && (
                            <View style={styles.rateRow}>
                              <RateBar rate={v.survival_rate} />
                              <Text style={[styles.rateText, { color: rateColor(v.survival_rate) }]}>
                                {v.survival_rate}%
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    ))}
                    {visits.length > 2 && (
                      <TouchableOpacity
                        onPress={() => setShowAllVisits((v) => !v)}
                        style={[styles.linkBtn, { alignSelf: "center", marginTop: 6 }]}
                      >
                        <Text style={styles.linkText}>
                          {showAllVisits ? "Show less" : `Show all ${visits.length} visits`}
                        </Text>
                        <Ionicons name={showAllVisits ? "chevron-up" : "chevron-down"} size={14} color={PRIMARY} />
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {/* Species planted here before */}
                {requestedSpecies.length > 0 && (
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Species Planted Here Before</Text>
                    <View style={styles.chipWrap}>
                      {requestedSpecies.map((sp) => (
                        <View key={sp.species_id} style={styles.speciesChip}>
                          <Ionicons name="leaf" size={12} color={PRIMARY} />
                          <Text style={styles.speciesChipText}>{sp.name}</Text>
                          <Text style={styles.speciesChipCount}>{sp.total_quantity}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </>
            ) : (
              <View style={styles.emptyHistory}>
                <View style={styles.emptyHistoryIcon}>
                  <Ionicons name="sparkles" size={20} color={PRIMARY} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reopenTitle}>Fresh site</Text>
                  <Text style={styles.emptyHistoryText}>
                    No tree planting program has been run here yet. Be the first!
                  </Text>
                </View>
              </View>
            )}
          </Section>

          {/* Gallery */}
          {gallery.length > 0 && (
            <Section title="Photos" right={<Text style={styles.cardHint}>{gallery.length} photos</Text>}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                {gallery.map((img, index) => (
                  <TouchableOpacity
                    key={img.image_id}
                    onPress={() => {
                      setGalleryIndex(index);
                      setGalleryVisible(true);
                    }}
                    activeOpacity={0.85}
                  >
                    <Image source={{ uri: imageUrl(img.url)! }} style={styles.thumb} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </Section>
          )}

          {/* Recommended species */}
          {details.recommended_species.length > 0 && (
            <Section title="Recommended Species">
              {details.recommended_species.map((sp) => (
                <View key={sp.species_id} style={styles.recRow}>
                  <View style={styles.recRank}>
                    <Text style={styles.recRankText}>{sp.priority_rank}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recName}>{sp.name}</Text>
                    {!!(sp.notes || sp.description) && (
                      <Text style={styles.recNote} numberOfLines={2}>
                        {sp.notes || sp.description}
                      </Text>
                    )}
                  </View>
                  <Ionicons name="leaf-outline" size={18} color="#A7B4C2" />
                </View>
              ))}
            </Section>
          )}

          {!!details.created_at && (
            <Text style={styles.listedText}>Listed {formatDate(details.created_at)}</Text>
          )}
        </View>
      </Animated.ScrollView>

      {/* Sticky apply footer */}
      <View style={[styles.footer, { paddingBottom: 12 }]}>
        {hasOngoing ? (
          <View style={styles.footerLocked}>
            <Ionicons name="lock-closed" size={18} color="#B45309" />
            <Text style={styles.footerLockedText}>
              You already have an ongoing application. Wait for it to finish before applying again.
            </Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.applyBtn} onPress={handleApply} activeOpacity={0.85}>
            <Text style={styles.applyText}>Apply to This Site</Text>
            <View style={styles.applyIcon}>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* Map modal */}
      <Modal visible={mapVisible} animationType="slide" onRequestClose={() => setMapVisible(false)}>
        <View style={{ flex: 1, backgroundColor: "#fff" }}>
          {center && <OsmMap center={center} polygon={details.polygon_coordinates} interactive />}
          <View style={[styles.mapModalBar, { top: insets.top + 12 }]}>
            <TouchableOpacity style={styles.roundBtnStatic} onPress={() => setMapVisible(false)}>
              <Ionicons name="close" size={20} color={INK} />
            </TouchableOpacity>
            <View style={styles.mapModalTitle}>
              <Ionicons name="location" size={14} color="#fff" />
              <Text style={styles.mapModalTitleText} numberOfLines={1}>
                {details.name}
              </Text>
            </View>
          </View>
        </View>
      </Modal>

      {/* Gallery modal */}
      <Modal
        visible={galleryVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setGalleryVisible(false)}
      >
        <View style={styles.galleryOverlay}>
          <View style={[styles.galleryTopBar, { top: insets.top + 12 }]}>
            <Text style={styles.galleryCounter}>
              {galleryIndex + 1} / {gallery.length}
            </Text>
            <TouchableOpacity style={styles.galleryClose} onPress={() => setGalleryVisible(false)}>
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: galleryIndex * width, y: 0 }}
            onMomentumScrollEnd={(e) => setGalleryIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          >
            {gallery.map((img) => (
              <View key={img.image_id} style={styles.galleryPage}>
                <Image source={{ uri: imageUrl(img.url)! }} style={styles.galleryImage} resizeMode="contain" />
                {!!img.caption && (
                  <View style={styles.galleryCaption}>
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

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  center: { justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 12, color: MUTED, fontSize: 14 },

  errorIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: PRIMARY_SOFT,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  errorTitle: { fontSize: 18, fontWeight: "800", color: INK, marginBottom: 6 },
  errorText: { fontSize: 14, color: MUTED, textAlign: "center", marginBottom: 20, lineHeight: 20 },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: PRIMARY,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  primaryBtnText: { color: "#fff", fontWeight: "700" },
  secondaryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  secondaryBtnText: { color: INK, fontWeight: "700" },

  // Hero
  hero: { position: "absolute", top: 0, left: 0, right: 0, height: HERO_HEIGHT, overflow: "hidden" },
  heroPlaceholder: { backgroundColor: PRIMARY, justifyContent: "center", alignItems: "center" },
  heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.12)" },

  stickyHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 40,
    backgroundColor: "rgba(255,255,255,0.97)",
    justifyContent: "center",
    paddingHorizontal: 64,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  stickyTitle: { fontSize: 16, fontWeight: "700", color: INK, textAlign: "center" },

  roundBtn: {
    position: "absolute",
    zIndex: 50,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.95)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  roundBtnStatic: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  photoChip: {
    position: "absolute",
    right: 16,
    zIndex: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(15,23,42,0.6)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  photoChipText: { color: "#fff", fontSize: 12, fontWeight: "700" },

  // Sheet
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 10,
    minHeight: screenHeight - HERO_HEIGHT + 28,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: BORDER,
    marginBottom: 16,
  },
  statusPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 10,
  },
  statusPillText: { fontSize: 12, fontWeight: "700" },
  siteName: { fontSize: 26, fontWeight: "800", color: INK, lineHeight: 32, marginBottom: 6 },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  locationText: { fontSize: 14, color: "#475569", fontWeight: "500", flex: 1 },

  factsRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: SURFACE,
    borderRadius: 18,
    paddingVertical: 14,
    marginTop: 18,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  fact: { flex: 1, alignItems: "center", paddingHorizontal: 6 },
  factIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  factValue: { fontSize: 15, fontWeight: "800", color: INK },
  factLabel: { fontSize: 10, fontWeight: "600", color: MUTED, marginTop: 2, letterSpacing: 0.3 },
  factDivider: { width: 1, height: 44, backgroundColor: BORDER },

  section: { marginTop: 24 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: INK },
  bodyText: { fontSize: 15, lineHeight: 23, color: "#475569" },
  linkBtn: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  linkText: { fontSize: 13, fontWeight: "700", color: PRIMARY },

  mapPreview: {
    height: 190,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: BORDER,
  },
  mapTapHint: {
    position: "absolute",
    bottom: 10,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  mapTapHintText: { fontSize: 11, fontWeight: "700", color: INK },

  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  accessChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: PRIMARY_SOFT,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
  },
  accessChipText: { fontSize: 14, fontWeight: "600", color: "#065F46" },

  // History
  reopenBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  reopenTitle: { fontSize: 14, fontWeight: "800", color: "#065F46" },
  reopenText: { fontSize: 13, color: "#047857", marginTop: 2, lineHeight: 18 },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 },
  statCard: {
    width: (width - 40 - 10) / 2,
    backgroundColor: SURFACE,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  statValue: { fontSize: 20, fontWeight: "800", color: INK },
  statLabel: { fontSize: 11, fontWeight: "600", color: MUTED, marginTop: 2 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 14, fontWeight: "800", color: INK, marginBottom: 8 },
  cardHint: { fontSize: 12, color: FAINT, fontWeight: "500" },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  programRow: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  programDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  programTitle: { fontSize: 14, fontWeight: "700", color: INK },
  programDate: { fontSize: 11, color: FAINT, fontWeight: "500" },
  programMeta: { fontSize: 12, color: MUTED, marginTop: 3 },
  rateRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  rateTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: "#F1F5F9", overflow: "hidden" },
  rateFill: { height: "100%", borderRadius: 3 },
  rateText: { fontSize: 12, fontWeight: "800", minWidth: 42, textAlign: "right" },
  visitRow: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  visitIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: PRIMARY_SOFT,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  visitTitle: { fontSize: 13, fontWeight: "700", color: INK, flexShrink: 1 },
  speciesChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  speciesChipText: { fontSize: 12, fontWeight: "600", color: INK },
  speciesChipCount: { fontSize: 11, fontWeight: "700", color: MUTED },
  emptyHistory: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: SURFACE,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  emptyHistoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: PRIMARY_SOFT,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyHistoryText: { fontSize: 13, color: MUTED, marginTop: 2, lineHeight: 18 },

  thumb: { width: 132, height: 100, borderRadius: 14, backgroundColor: SURFACE },

  recRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  recRank: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: PRIMARY,
    justifyContent: "center",
    alignItems: "center",
  },
  recRankText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  recName: { fontSize: 15, fontWeight: "700", color: INK },
  recNote: { fontSize: 12, color: MUTED, marginTop: 2, lineHeight: 17 },

  listedText: { fontSize: 12, color: FAINT, textAlign: "center", marginTop: 24 },

  // Footer
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
  applyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: PRIMARY,
    paddingVertical: 16,
    borderRadius: 16,
  },
  applyText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  applyIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  footerLocked: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 14,
    padding: 14,
  },
  footerLockedText: { flex: 1, fontSize: 13, color: "#92400E", fontWeight: "600", lineHeight: 18 },

  // Map modal
  mapModalBar: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  mapModalTitle: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(15,74,47,0.9)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
  },
  mapModalTitleText: { color: "#fff", fontWeight: "700", fontSize: 13, flex: 1 },

  // Gallery modal
  galleryOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.96)", justifyContent: "center" },
  galleryTopBar: {
    position: "absolute",
    left: 20,
    right: 20,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  galleryCounter: { color: "#fff", fontSize: 14, fontWeight: "600" },
  galleryClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.18)",
    justifyContent: "center",
    alignItems: "center",
  },
  galleryPage: { width, height: screenHeight, justifyContent: "center", alignItems: "center" },
  galleryImage: { width, height: screenHeight * 0.7 },
  galleryCaption: {
    position: "absolute",
    bottom: 90,
    left: 20,
    right: 20,
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 12,
    borderRadius: 12,
  },
  galleryCaptionText: { color: "#fff", fontSize: 14, textAlign: "center" },
});
