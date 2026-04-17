import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Dimensions,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  RefreshControl,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import MapView, { Marker, Polygon } from "react-native-maps";
import { api } from "@/constants/url_fixed";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");
const API_BASE_URL = api + "/api";

// ─── Types ─────────────────────────────────────────────────────────────────

type ApplicationData = {
  application_id: number;
  title: string;
  description: string;
  total_request_seedling: number;
  maintenance_plan: string | null;
  agreement_image: string | null;
  total_seedling_provided: number;
  total_area_planted: string;
  total_seedling_survived: number;
  total_seedling_planted: number;
  updated_at: string;
  created_at: string;
  status: string;
  orientation_date: string | null;
};

type AssignedSite = {
  name: string;
  reforestation_area: string;
  land_classification: string;
  polygon_coordinates: [number, number][];
  barangay: string;
};

type MaintenanceReport = {
  maintenance_report_id: number;
  title: string;
  description: string;
  status: "for_evaluation" | "for_head" | "accepted" | "rejected";
  total_seedling_planted: number;
  total_seedling_survived: number;
  total_area_planted: string;
  total_owned_seedling_planted: number;
  total_member_present: number | null;
  created_at: string;
  submitted_at: string | null;
};

type NewReportForm = {
  title: string;
  description: string;
  total_member_present: string;
  total_seedling_planted: string;
  total_seedling_survived: string;
  total_area_planted: string;
  total_owned_seedling_planted: string;
  maintenance_report_file: { uri: string; name: string; type: string } | null;
  group_picture: { uri: string; name: string; type: string } | null;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const statusConfig = {
  for_evaluation: { label: "For Evaluation", bg: "#FFF8E1", text: "#F57F17", dot: "#F9A825" },
  for_head: { label: "For Head Review", bg: "#E3F2FD", text: "#1565C0", dot: "#1976D2" },
  accepted: { label: "Accepted", bg: "#E8F5E9", text: "#2E7D32", dot: "#388E3C" },
  rejected: { label: "Rejected", bg: "#FFEBEE", text: "#C62828", dot: "#D32F2F" },
  // Application statuses
  pending: { label: "Pending", bg: "#FFF8E1", text: "#F57F17", dot: "#F9A825" },
  for_endorsement: { label: "For Endorsement", bg: "#E3F2FD", text: "#1565C0", dot: "#1976D2" },
  active: { label: "Active", bg: "#E8F5E9", text: "#2E7D32", dot: "#388E3C" },
  accepted_app: { label: "Accepted", bg: "#E8F5E9", text: "#2E7D32", dot: "#388E3C" },
};

const getStatusConf = (status: string) =>
  (statusConfig as any)[status] ?? { label: status, bg: "#F5F5F5", text: "#555", dot: "#999" };

const formatDate = (iso: string) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

// ─── Sub-components ──────────────────────────────────────────────────────────

const StatusBadge = ({ status }: { status: string }) => {
  const conf = getStatusConf(status);
  return (
    <View style={[styles.badge, { backgroundColor: conf.bg }]}>
      <View style={[styles.badgeDot, { backgroundColor: conf.dot }]} />
      <Text style={[styles.badgeText, { color: conf.text }]}>{conf.label}</Text>
    </View>
  );
};

const MetricCard = ({
  label,
  value,
  unit,
  icon,
}: {
  label: string;
  value: string | number;
  unit?: string;
  icon: string;
}) => (
  <View style={styles.metricCard}>
    <Text style={styles.metricIcon}>{icon}</Text>
    <Text style={styles.metricValue}>
      {value}
      {unit && <Text style={styles.metricUnit}> {unit}</Text>}
    </Text>
    <Text style={styles.metricLabel}>{label}</Text>
  </View>
);

// ─── Main Component ──────────────────────────────────────────────────────────

const ApplicationPage: React.FC = () => {
  const [application, setApplication] = useState<ApplicationData | null>(null);
  const [site, setSite] = useState<AssignedSite | null>(null);
  const [reports, setReports] = useState<MaintenanceReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [activeTab, setActiveTab] = useState<"overview" | "reports">("overview");
  const [showMap, setShowMap] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedReport, setSelectedReport] = useState<MaintenanceReport | null>(null);

  // Form state
  const [form, setForm] = useState<NewReportForm>({
    title: "",
    description: "",
    total_member_present: "",
    total_seedling_planted: "",
    total_seedling_survived: "",
    total_area_planted: "",
    total_owned_seedling_planted: "",
   
    maintenance_report_file: null,
    group_picture: null,
  });

  const fetchData = async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      setError(null);
      const token = await SecureStore.getItemAsync("token");
      if (!token) throw new Error("No authentication token found.");

      // Fetch application
      const appRes = await fetch(`${API_BASE_URL}/get_tree_grower_application/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!appRes.ok) throw new Error(`Failed to load application (${appRes.status})`);
      const appData = await appRes.json();
      setApplication(appData.application);
      setSite(appData.assigned_site);

      // Fetch maintenance reports
      const repRes = await fetch(
        `${API_BASE_URL}/get_tree_grower_maintenance_reports/${appData.application.application_id}/`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (repRes.ok) {
        const repData = await repRes.json();
        setReports(Array.isArray(repData) ? repData : repData.reports ?? []);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData(true);
  };

  const handleFilePick = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "application/msword",
             "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setForm((p) => ({
        ...p,
        maintenance_report_file: {
          uri: asset.uri,
          name: asset.name,
          type: asset.mimeType ?? "application/octet-stream",
        },
      }));
    }
  };

  const handleImagePick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const name = asset.uri.split("/").pop() ?? "photo.jpg";
      setForm((p) => ({
        ...p,
        group_picture: { uri: asset.uri, name, type: asset.type ?? "image/jpeg" },
      }));
    }
  };

  const handleSubmitReport = async () => {
    if (!form.title.trim()) {
      Alert.alert("Missing Field", "Please enter a report title.");
      return;
    }
    if (!form.description.trim()) {
      Alert.alert("Missing Field", "Please enter a description.");
      return;
    }
    if (!application) return;

    setSubmitting(true);
    try {
      const token = await SecureStore.getItemAsync("token");
      const fd = new FormData();
      fd.append("application_id", String(application.application_id));
      fd.append("title", form.title);
      fd.append("description", form.description);
      fd.append("total_member_present", form.total_member_present || "0");
      fd.append("total_seedling_planted", form.total_seedling_planted || "0");
      fd.append("total_seedling_survived", form.total_seedling_survived || "0");
      fd.append("total_area_planted", form.total_area_planted || "0");
      fd.append("total_owned_seedling_planted", form.total_owned_seedling_planted || "0");
     
      if (form.maintenance_report_file) {
        fd.append("maintenance_report_file", form.maintenance_report_file as any);
      }
      if (form.group_picture) {
        fd.append("group_picture", form.group_picture as any);
      }
    
      const res = await fetch(`${API_BASE_URL}/create_maintenance_report/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });

      const data = await res.json();
       console.log("data")
      if (!res.ok) throw new Error(data.error ?? "Submission failed.");
        
      Alert.alert("Success! 🌱", "Maintenance report submitted successfully.");
      setCreateModalVisible(false);
      setForm({
        title: "", description: "", total_member_present: "", total_seedling_planted: "",
        total_seedling_survived: "", total_area_planted: "", total_owned_seedling_planted: "",
        maintenance_report_file: null, group_picture: null,
      });
      fetchData(true);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Map region from polygon ─────────────────────────────────────────────
  const getMapRegion = () => {
    if (!site?.polygon_coordinates?.length) {
      return { latitude: 11.036, longitude: 124.635, latitudeDelta: 0.02, longitudeDelta: 0.02 };
    }
    const lats = site.polygon_coordinates.map(([lat]) => lat);
    const lngs = site.polygon_coordinates.map(([, lng]) => lng);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: (maxLat - minLat) * 1.5 + 0.005,
      longitudeDelta: (maxLng - minLng) * 1.5 + 0.005,
    };
  };

  const polygonCoords = site?.polygon_coordinates?.map(([lat, lng]) => ({
    latitude: lat,
    longitude: lng,
  })) ?? [];

  const centroid = polygonCoords.length > 0
    ? {
        latitude: polygonCoords.reduce((s, c) => s + c.latitude, 0) / polygonCoords.length,
        longitude: polygonCoords.reduce((s, c) => s + c.longitude, 0) / polygonCoords.length,
      }
    : null;

  // ─── Loading / Error ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0F4A2F" />
        <Text style={styles.loadingText}>Loading your program…</Text>
      </View>
    );
  }

  if (error || !application) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorEmoji}>🌿</Text>
        <Text style={styles.errorTitle}>Couldn't Load</Text>
        <Text style={styles.errorMsg}>{error ?? "Application not found."}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => fetchData()}>
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerEmoji}>🌱</Text>
          <View>
            <Text style={styles.headerTitle} numberOfLines={1}>{application.title}</Text>
            <Text style={styles.headerSub}>Tree Planting Program</Text>
          </View>
        </View>
        <StatusBadge status={application.status} />
      </View>

      {/* ── Tabs ── */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "overview" && styles.tabActive]}
          onPress={() => setActiveTab("overview")}
        >
          <Text style={[styles.tabText, activeTab === "overview" && styles.tabTextActive]}>
            📋 Overview
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "reports" && styles.tabActive]}
          onPress={() => setActiveTab("reports")}
        >
          <Text style={[styles.tabText, activeTab === "reports" && styles.tabTextActive]}>
            📊 Reports {reports.length > 0 && `(${reports.length})`}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0F4A2F" />}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ─────────── OVERVIEW TAB ─────────── */}
        {activeTab === "overview" && (
          <>
            {/* Stats Grid */}
            <View style={styles.metricsGrid}>
              <MetricCard
                icon="🌳"
                label="Seedlings Requested"
                value={application.total_request_seedling}
              />
              <MetricCard
                icon="📦"
                label="Seedlings Provided"
                value={application.total_seedling_provided}
              />
              <MetricCard
                icon="🌱"
                label="Planted"
                value={application.total_seedling_planted}
              />
              <MetricCard
                icon="💚"
                label="Survived"
                value={application.total_seedling_survived}
              />
            </View>

            {/* Area Planted */}
            <View style={styles.bigMetric}>
              <Text style={styles.bigMetricLabel}>Total Area Planted</Text>
              <Text style={styles.bigMetricValue}>
                {parseFloat(application.total_area_planted).toFixed(2)}
                <Text style={styles.bigMetricUnit}> ha</Text>
              </Text>
            </View>

            {/* Description Card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>📝 About This Program</Text>
              <Text style={styles.cardBody}>{application.description}</Text>
            </View>

            {/* Dates */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>📅 Key Dates</Text>
              <View style={styles.dateRow}>
                <View style={styles.dateItem}>
                  <Text style={styles.dateLabel}>Submitted</Text>
                  <Text style={styles.dateValue}>{formatDate(application.created_at)}</Text>
                </View>
                <View style={styles.dateDivider} />
                <View style={styles.dateItem}>
                  <Text style={styles.dateLabel}>Orientation</Text>
                  <Text style={styles.dateValue}>
                    {application.orientation_date ? formatDate(application.orientation_date) : "Not set"}
                  </Text>
                </View>
              </View>
            </View>

            {/* Assigned Site Card */}
            {site && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>📍 Assigned Planting Site</Text>
                <View style={styles.siteInfoRow}>
                  <View style={styles.siteInfoItem}>
                    <Text style={styles.siteLabel}>Site Name</Text>
                    <Text style={styles.siteValue}>{site.name}</Text>
                  </View>
                  <View style={styles.siteInfoItem}>
                    <Text style={styles.siteLabel}>Barangay</Text>
                    <Text style={styles.siteValue}>{site.barangay}</Text>
                  </View>
                  <View style={styles.siteInfoItem}>
                    <Text style={styles.siteLabel}>Reforestation Area</Text>
                    <Text style={styles.siteValue}>{site.reforestation_area}</Text>
                  </View>
                  <View style={styles.siteInfoItem}>
                    <Text style={styles.siteLabel}>Land Classification</Text>
                    <Text style={styles.siteValue}>{site.land_classification}</Text>
                  </View>
                </View>

                {/* Map Preview */}
                <TouchableOpacity style={styles.mapPreviewContainer} onPress={() => setShowMap(true)}>
                  <MapView
                    style={styles.mapPreview}
                    initialRegion={getMapRegion()}
                    scrollEnabled={false}
                    zoomEnabled={false}
                    rotateEnabled={false}
                    pitchEnabled={false}
                    pointerEvents="none"
                  >
                    {polygonCoords.length > 0 && (
                      <Polygon
                        coordinates={polygonCoords}
                        strokeColor="#0F4A2F"
                        fillColor="rgba(15, 74, 47, 0.35)"
                        strokeWidth={2}
                      />
                    )}
                    {centroid && (
                      <Marker coordinate={centroid} title={site.name} />
                    )}
                  </MapView>
                  <View style={styles.mapOverlay}>
                    <Text style={styles.mapOverlayText}>🗺️ Tap to expand map</Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        {/* ─────────── REPORTS TAB ─────────── */}
        {activeTab === "reports" && (
          <>
            {/* Notification banner if any rejected reports */}
            {reports.some((r) => r.status === "rejected") && (
              <View style={styles.alertBanner}>
                <Text style={styles.alertBannerIcon}>⚠️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.alertBannerTitle}>Action Required</Text>
                  <Text style={styles.alertBannerMsg}>
                    You have rejected reports. Please submit a new updated maintenance report.
                  </Text>
                </View>
              </View>
            )}

            {reports.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>📋</Text>
                <Text style={styles.emptyTitle}>No Reports Yet</Text>
                <Text style={styles.emptyMsg}>
                  Start documenting your tree planting activities by submitting your first maintenance report.
                </Text>
              </View>
            ) : (
              reports.map((report) => (
                <TouchableOpacity
                  key={report.maintenance_report_id}
                  style={styles.reportCard}
                  onPress={() => setSelectedReport(report)}
                  activeOpacity={0.8}
                >
                  <View style={styles.reportCardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reportCardTitle} numberOfLines={1}>{report.title}</Text>
                      <Text style={styles.reportCardDate}>{formatDate(report.created_at)}</Text>
                    </View>
                    <StatusBadge status={report.status} />
                  </View>

                  <Text style={styles.reportCardDesc} numberOfLines={2}>{report.description}</Text>

                  <View style={styles.reportMini}>
                    <View style={styles.reportMiniItem}>
                      <Text style={styles.reportMiniVal}>{report.total_seedling_planted}</Text>
                      <Text style={styles.reportMiniLabel}>Planted</Text>
                    </View>
                    <View style={styles.reportMiniItem}>
                      <Text style={styles.reportMiniVal}>{report.total_seedling_survived}</Text>
                      <Text style={styles.reportMiniLabel}>Survived</Text>
                    </View>
                    <View style={styles.reportMiniItem}>
                      <Text style={styles.reportMiniVal}>{parseFloat(report.total_area_planted).toFixed(1)} ha</Text>
                      <Text style={styles.reportMiniLabel}>Area</Text>
                    </View>
                    <View style={styles.reportMiniItem}>
                    
                      <Text style={styles.reportMiniLabel}>Duration</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── FAB: Create Report ── */}
      {activeTab === "reports" && application.status === "accepted" && (
        <TouchableOpacity style={styles.fab} onPress={() => setCreateModalVisible(true)}>
          <Text style={styles.fabIcon}>+</Text>
          <Text style={styles.fabText}>New Report</Text>
        </TouchableOpacity>
      )}

      {/* ── FULL MAP MODAL ── */}
      <Modal visible={showMap} animationType="slide" onRequestClose={() => setShowMap(false)}>
        <View style={styles.fullMapContainer}>
          <MapView style={styles.fullMap} initialRegion={getMapRegion()}>
            {polygonCoords.length > 0 && (
              <Polygon
                coordinates={polygonCoords}
                strokeColor="#0F4A2F"
                fillColor="rgba(15, 74, 47, 0.3)"
                strokeWidth={3}
              />
            )}
            {centroid && <Marker coordinate={centroid} title={site?.name ?? "Site"} />}
          </MapView>
          <View style={styles.fullMapHeader}>
            <TouchableOpacity style={styles.fullMapClose} onPress={() => setShowMap(false)}>
              <Text style={styles.fullMapCloseText}>✕ Close</Text>
            </TouchableOpacity>
            <Text style={styles.fullMapTitle}>{site?.name}</Text>
          </View>
        </View>
      </Modal>

      {/* ── REPORT DETAIL MODAL ── */}
      <Modal
        visible={!!selectedReport}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedReport(null)}
      >
        <View style={styles.sheetOverlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            {selectedReport && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.sheetHeader}>
                  <Text style={styles.sheetTitle}>{selectedReport.title}</Text>
                  <StatusBadge status={selectedReport.status} />
                </View>
                <Text style={styles.sheetDate}>{formatDate(selectedReport.created_at)}</Text>
                <Text style={styles.sheetDesc}>{selectedReport.description}</Text>

                <View style={styles.sheetMetrics}>
                  {[
                    { label: "Members Present", value: selectedReport.total_member_present ?? "—" },
                    { label: "Seedlings Planted", value: selectedReport.total_seedling_planted },
                    { label: "Seedlings Survived", value: selectedReport.total_seedling_survived },
                    { label: "Area Planted", value: `${parseFloat(selectedReport.total_area_planted).toFixed(2)} ha` },
                    { label: "Owned Seedlings", value: selectedReport.total_owned_seedling_planted },
                   
                  ].map((m, i) => (
                    <View key={i} style={styles.sheetMetricRow}>
                      <Text style={styles.sheetMetricLabel}>{m.label}</Text>
                      <Text style={styles.sheetMetricVal}>{m.value}</Text>
                    </View>
                  ))}
                </View>

                {selectedReport.status === "rejected" && (
                  <View style={styles.rejectedNote}>
                    <Text style={styles.rejectedNoteTitle}>⚠️ Report Rejected</Text>
                    <Text style={styles.rejectedNoteMsg}>
                      This report was rejected. Please submit a new updated maintenance report addressing the feedback.
                    </Text>
                  </View>
                )}

                <TouchableOpacity style={styles.sheetClose} onPress={() => setSelectedReport(null)}>
                  <Text style={styles.sheetCloseText}>Close</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ── CREATE REPORT MODAL ── */}
      <Modal
        visible={createModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.sheetOverlay}
        >
          <View style={[styles.sheet, { maxHeight: screenHeight * 0.92 }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>🌿 New Maintenance Report</Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.formSection}>Basic Information</Text>

              <Text style={styles.formLabel}>Report Title *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Monthly Planting Activity – April 2026"
                value={form.title}
                onChangeText={(t) => setForm((p) => ({ ...p, title: t }))}
                placeholderTextColor="#aaa"
              />

              <Text style={styles.formLabel}>Description *</Text>
              <TextInput
                style={[styles.formInput, styles.formTextArea]}
                placeholder="Describe the maintenance activities conducted…"
                value={form.description}
                onChangeText={(t) => setForm((p) => ({ ...p, description: t }))}
                multiline
                numberOfLines={4}
                placeholderTextColor="#aaa"
                textAlignVertical="top"
              />

              <Text style={styles.formSection}>Metrics</Text>

              <View style={styles.formRow}>
                <View style={styles.formHalf}>
                  <Text style={styles.formLabel}>Members Present</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="0"
                    keyboardType="numeric"
                    value={form.total_member_present}
                    onChangeText={(t) => setForm((p) => ({ ...p, total_member_present: t }))}
                    placeholderTextColor="#aaa"
                  />
                </View>
                
              </View>

              <View style={styles.formRow}>
                <View style={styles.formHalf}>
                  <Text style={styles.formLabel}>Seedlings Planted</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="0"
                    keyboardType="numeric"
                    value={form.total_seedling_planted}
                    onChangeText={(t) => setForm((p) => ({ ...p, total_seedling_planted: t }))}
                    placeholderTextColor="#aaa"
                  />
                </View>
                <View style={styles.formHalf}>
                  <Text style={styles.formLabel}>Seedlings Survived</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="0"
                    keyboardType="numeric"
                    value={form.total_seedling_survived}
                    onChangeText={(t) => setForm((p) => ({ ...p, total_seedling_survived: t }))}
                    placeholderTextColor="#aaa"
                  />
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={styles.formHalf}>
                  <Text style={styles.formLabel}>Area Planted (ha)</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                    value={form.total_area_planted}
                    onChangeText={(t) => setForm((p) => ({ ...p, total_area_planted: t }))}
                    placeholderTextColor="#aaa"
                  />
                </View>
                <View style={styles.formHalf}>
                  <Text style={styles.formLabel}>Owned Seedlings</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="0"
                    keyboardType="numeric"
                    value={form.total_owned_seedling_planted}
                    onChangeText={(t) => setForm((p) => ({ ...p, total_owned_seedling_planted: t }))}
                    placeholderTextColor="#aaa"
                  />
                </View>
              </View>

              <Text style={styles.formSection}>Attachments</Text>

              <TouchableOpacity style={styles.uploadBtn} onPress={handleFilePick}>
                <Text style={styles.uploadIcon}>📎</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.uploadTitle}>Maintenance Report File</Text>
                  <Text style={styles.uploadSub} numberOfLines={1}>
                    {form.maintenance_report_file ? form.maintenance_report_file.name : "PDF or Word document"}
                  </Text>
                </View>
                <Text style={styles.uploadArrow}>{form.maintenance_report_file ? "✓" : "›"}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.uploadBtn} onPress={handleImagePick}>
                <Text style={styles.uploadIcon}>📷</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.uploadTitle}>Group Picture</Text>
                  <Text style={styles.uploadSub} numberOfLines={1}>
                    {form.group_picture ? form.group_picture.name : "Photo of participants"}
                  </Text>
                </View>
                <Text style={styles.uploadArrow}>{form.group_picture ? "✓" : "›"}</Text>
              </TouchableOpacity>

              {form.group_picture && (
                <Image
                  source={{ uri: form.group_picture.uri }}
                  style={styles.previewImage}
                  resizeMode="cover"
                />
              )}

              <View style={styles.formActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setCreateModalVisible(false)}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                  onPress={handleSubmitReport}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.submitText}>Submit Report</Text>
                  )}
                </TouchableOpacity>
              </View>

              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7FAF8" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, backgroundColor: "#F7FAF8" },
  loadingText: { marginTop: 12, color: "#666", fontSize: 14 },
  errorEmoji: { fontSize: 48, marginBottom: 12 },
  errorTitle: { fontSize: 20, fontWeight: "700", color: "#1a1a1a", marginBottom: 6 },
  errorMsg: { fontSize: 14, color: "#666", textAlign: "center", marginBottom: 20 },
  retryBtn: { backgroundColor: "#0F4A2F", paddingHorizontal: 28, paddingVertical: 12, borderRadius: 10 },
  retryText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  // Header
  header: {
    backgroundColor: "#0F4A2F",
    paddingTop: Platform.OS === "ios" ? 56 : 16,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  headerEmoji: { fontSize: 28 },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#fff", flex: 1 },
  headerSub: { fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 1 },

  // Badge
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 5,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },

  // Tabs
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E8F0EB",
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: { borderBottomColor: "#0F4A2F" },
  tabText: { fontSize: 13, fontWeight: "600", color: "#888" },
  tabTextActive: { color: "#0F4A2F" },

  scrollContent: { paddingHorizontal: 16, paddingTop: 16 },

  // Metrics
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 10,
  },
  metricCard: {
    flex: 1,
    minWidth: (screenWidth - 52) / 2,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    shadowColor: "#0F4A2F",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  metricIcon: { fontSize: 22, marginBottom: 6 },
  metricValue: { fontSize: 22, fontWeight: "800", color: "#0F4A2F" },
  metricUnit: { fontSize: 12, fontWeight: "500", color: "#666" },
  metricLabel: { fontSize: 11, color: "#888", marginTop: 2, textAlign: "center" },

  bigMetric: {
    backgroundColor: "#0F4A2F",
    borderRadius: 14,
    padding: 18,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bigMetricLabel: { fontSize: 14, color: "rgba(255,255,255,0.8)", fontWeight: "600" },
  bigMetricValue: { fontSize: 32, fontWeight: "900", color: "#fff" },
  bigMetricUnit: { fontSize: 16, fontWeight: "500", color: "rgba(255,255,255,0.8)" },

  // Card
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#0F4A2F",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  cardTitle: { fontSize: 14, fontWeight: "700", color: "#0F4A2F", marginBottom: 10 },
  cardBody: { fontSize: 14, color: "#444", lineHeight: 20 },

  // Date
  dateRow: { flexDirection: "row", alignItems: "center" },
  dateItem: { flex: 1, alignItems: "center" },
  dateLabel: { fontSize: 11, color: "#999", marginBottom: 4 },
  dateValue: { fontSize: 14, fontWeight: "700", color: "#1a1a1a" },
  dateDivider: { width: 1, height: 40, backgroundColor: "#eee" },

  // Site
  siteInfoRow: { gap: 8, marginBottom: 12 },
  siteInfoItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#F0F4F1" },
  siteLabel: { fontSize: 12, color: "#888" },
  siteValue: { fontSize: 13, fontWeight: "600", color: "#1a1a1a", flexShrink: 1, textAlign: "right", marginLeft: 12 },

  // Map Preview
  mapPreviewContainer: { borderRadius: 12, overflow: "hidden", height: 180 },
  mapPreview: { width: "100%", height: "100%" },
  mapOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(15,74,47,0.75)",
    paddingVertical: 8,
    alignItems: "center",
  },
  mapOverlayText: { color: "#fff", fontSize: 13, fontWeight: "600" },

  // Alert Banner
  alertBanner: {
    backgroundColor: "#FFF3CD",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    flexDirection: "row",
    gap: 10,
    borderLeftWidth: 4,
    borderLeftColor: "#F9A825",
  },
  alertBannerIcon: { fontSize: 20 },
  alertBannerTitle: { fontSize: 13, fontWeight: "700", color: "#7B4F00", marginBottom: 2 },
  alertBannerMsg: { fontSize: 12, color: "#7B4F00", lineHeight: 17 },

  // Reports
  reportCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#0F4A2F",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  reportCardHeader: { flexDirection: "row", alignItems: "flex-start", marginBottom: 8, gap: 8 },
  reportCardTitle: { fontSize: 15, fontWeight: "700", color: "#1a1a1a" },
  reportCardDate: { fontSize: 11, color: "#888", marginTop: 2 },
  reportCardDesc: { fontSize: 13, color: "#555", lineHeight: 18, marginBottom: 12 },
  reportMini: { flexDirection: "row", justifyContent: "space-between", backgroundColor: "#F7FAF8", borderRadius: 10, padding: 10 },
  reportMiniItem: { alignItems: "center" },
  reportMiniVal: { fontSize: 15, fontWeight: "800", color: "#0F4A2F" },
  reportMiniLabel: { fontSize: 10, color: "#888", marginTop: 2 },

  // Empty
  emptyState: { alignItems: "center", paddingVertical: 48 },
  emptyEmoji: { fontSize: 56, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#1a1a1a", marginBottom: 6 },
  emptyMsg: { fontSize: 13, color: "#888", textAlign: "center", maxWidth: 240, lineHeight: 19 },

  // FAB
  fab: {
    position: "absolute",
    bottom: 24,
    right: 20,
    backgroundColor: "#0F4A2F",
    borderRadius: 28,
    paddingVertical: 14,
    paddingHorizontal: 22,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    shadowColor: "#0F4A2F",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  fabIcon: { fontSize: 22, color: "#fff", lineHeight: 24 },
  fabText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  // Full Map
  fullMapContainer: { flex: 1 },
  fullMap: { flex: 1 },
  fullMapHeader: {
    position: "absolute",
    top: Platform.OS === "ios" ? 52 : 16,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  fullMapClose: {
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  fullMapCloseText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  fullMapTitle: {
    flex: 1,
    backgroundColor: "rgba(15,74,47,0.85)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },

  // Bottom Sheet
  sheetOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 32,
    maxHeight: screenHeight * 0.85,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: "#ddd",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 16,
  },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 },
  sheetTitle: { fontSize: 17, fontWeight: "800", color: "#1a1a1a", flex: 1, paddingRight: 8 },
  sheetDate: { fontSize: 12, color: "#888", marginBottom: 12 },
  sheetDesc: { fontSize: 14, color: "#444", lineHeight: 20, marginBottom: 16 },
  sheetMetrics: { backgroundColor: "#F7FAF8", borderRadius: 12, padding: 12, marginBottom: 16 },
  sheetMetricRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#EEF3EF" },
  sheetMetricLabel: { fontSize: 13, color: "#666" },
  sheetMetricVal: { fontSize: 13, fontWeight: "700", color: "#0F4A2F" },
  rejectedNote: { backgroundColor: "#FFEBEE", borderRadius: 12, padding: 14, marginBottom: 16, borderLeftWidth: 4, borderLeftColor: "#D32F2F" },
  rejectedNoteTitle: { fontSize: 13, fontWeight: "700", color: "#C62828", marginBottom: 4 },
  rejectedNoteMsg: { fontSize: 12, color: "#C62828", lineHeight: 17 },
  sheetClose: { backgroundColor: "#F7FAF8", borderRadius: 12, padding: 14, alignItems: "center" },
  sheetCloseText: { color: "#0F4A2F", fontWeight: "700", fontSize: 14 },

  // Form
  formSection: { fontSize: 12, fontWeight: "700", color: "#0F4A2F", textTransform: "uppercase", letterSpacing: 1, marginTop: 16, marginBottom: 8 },
  formLabel: { fontSize: 12, fontWeight: "600", color: "#555", marginBottom: 6 },
  formInput: {
    borderWidth: 1,
    borderColor: "#E2EBE6",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: "#1a1a1a",
    backgroundColor: "#FAFCFB",
    marginBottom: 12,
  },
  formTextArea: { height: 96, paddingTop: 11 },
  formRow: { flexDirection: "row", gap: 10 },
  formHalf: { flex: 1 },
  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F7FAF8",
    borderWidth: 1,
    borderColor: "#E2EBE6",
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  uploadIcon: { fontSize: 20 },
  uploadTitle: { fontSize: 13, fontWeight: "600", color: "#1a1a1a" },
  uploadSub: { fontSize: 11, color: "#888", marginTop: 2 },
  uploadArrow: { fontSize: 18, color: "#0F4A2F", fontWeight: "700" },
  previewImage: { width: "100%", height: 160, borderRadius: 10, marginBottom: 12 },
  formActions: { flexDirection: "row", gap: 12, marginTop: 8 },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E2EBE6",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  cancelText: { color: "#666", fontWeight: "600", fontSize: 14 },
  submitBtn: {
    flex: 2,
    backgroundColor: "#0F4A2F",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    shadowColor: "#0F4A2F",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { color: "#fff", fontWeight: "800", fontSize: 14 },
});

export default ApplicationPage;