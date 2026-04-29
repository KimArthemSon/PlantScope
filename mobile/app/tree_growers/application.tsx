import React, { useState, useEffect } from "react";
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
import { Ionicons } from "@expo/vector-icons";
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

const statusConfig: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  for_evaluation: { label: "For Evaluation", bg: "#FFF8E1", text: "#F57F17", dot: "#F9A825" },
  for_head:       { label: "For Head Review", bg: "#E3F2FD", text: "#1565C0", dot: "#1976D2" },
  accepted:       { label: "Accepted",        bg: "#E8F5E9", text: "#2E7D32", dot: "#388E3C" },
  rejected:       { label: "Rejected",        bg: "#FFEBEE", text: "#C62828", dot: "#D32F2F" },
  pending:        { label: "Pending",         bg: "#FFF8E1", text: "#F57F17", dot: "#F9A825" },
  for_endorsement:{ label: "For Endorsement", bg: "#E3F2FD", text: "#1565C0", dot: "#1976D2" },
  active:         { label: "Active",          bg: "#E8F5E9", text: "#2E7D32", dot: "#388E3C" },
};

const getStatusConf = (status: string) =>
  statusConfig[status] ?? { label: status, bg: "#F5F5F5", text: "#555", dot: "#999" };

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
    <View style={[badge.wrap, { backgroundColor: conf.bg }]}>
      <View style={[badge.dot, { backgroundColor: conf.dot }]} />
      <Text style={[badge.text, { color: conf.text }]}>{conf.label}</Text>
    </View>
  );
};

const MetricCard = ({
  label,
  value,
  unit,
  iconName,
  accent,
}: {
  label: string;
  value: string | number;
  unit?: string;
  iconName: string;
  accent: string;
}) => (
  <View style={[metric.card, { borderTopColor: accent }]}>
    <View style={[metric.iconWrap, { backgroundColor: accent + "18" }]}>
      <Ionicons name={iconName as any} size={18} color={accent} />
    </View>
    <Text style={[metric.value, { color: accent }]}>
      {value}
      {unit ? <Text style={metric.unit}> {unit}</Text> : null}
    </Text>
    <Text style={metric.label}>{label}</Text>
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

  const [activeTab, setActiveTab] = useState<"overview" | "reports">("overview");
  const [showMap, setShowMap] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedReport, setSelectedReport] = useState<MaintenanceReport | null>(null);

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

      const appRes = await fetch(`${API_BASE_URL}/get_tree_grower_application/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!appRes.ok) throw new Error(`Failed to load application (${appRes.status})`);
      const appData = await appRes.json();
      setApplication(appData.application);
      setSite(appData.assigned_site);

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

  useEffect(() => { fetchData(); }, []);

  const onRefresh = () => { setRefreshing(true); fetchData(true); };

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
        maintenance_report_file: { uri: asset.uri, name: asset.name, type: asset.mimeType ?? "application/octet-stream" },
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
      setForm((p) => ({ ...p, group_picture: { uri: asset.uri, name, type: asset.type ?? "image/jpeg" } }));
    }
  };

  const handleSubmitReport = async () => {
    if (!form.title.trim()) { Alert.alert("Missing Field", "Please enter a report title."); return; }
    if (!form.description.trim()) { Alert.alert("Missing Field", "Please enter a description."); return; }
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
      if (form.maintenance_report_file) fd.append("maintenance_report_file", form.maintenance_report_file as any);
      if (form.group_picture) fd.append("group_picture", form.group_picture as any);
      console.log(API_BASE_URL);
      const res = await fetch(`${API_BASE_URL}/create_maintenance_report/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json();
      console.log("hello")
      if (!res.ok) throw new Error(data.error ?? "Submission failed.");

      Alert.alert("Success", "Maintenance report submitted successfully.");
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
    latitude: lat, longitude: lng,
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
        <View style={styles.errorIconWrap}>
          <Ionicons name="leaf-outline" size={40} color="#0F4A2F" />
        </View>
        <Text style={styles.errorTitle}>Couldn't Load</Text>
        <Text style={styles.errorMsg}>{error ?? "Application not found."}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => fetchData()}>
          <Ionicons name="refresh" size={16} color="#fff" />
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const hasRejected = reports.some((r) => r.status === "rejected");

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>

      {/* ── Program Banner ── */}
      <View style={styles.banner}>
        <View style={styles.bannerInner}>
          <View style={styles.bannerLeft}>
            <View style={styles.bannerIconWrap}>
              <Ionicons name="leaf" size={20} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerTitle} numberOfLines={2}>{application.title}</Text>
              <Text style={styles.bannerSub}>Tree Planting Program</Text>
            </View>
          </View>
          <StatusBadge status={application.status} />
        </View>

        </View>

      {/* ── Segmented Tabs ── */}
      <View style={styles.segmentWrap}>
        <View style={styles.segment}>
          <TouchableOpacity
            style={[styles.segTab, activeTab === "overview" && styles.segTabActive]}
            onPress={() => setActiveTab("overview")}
          >
            <Ionicons
              name="clipboard-outline"
              size={14}
              color={activeTab === "overview" ? "#fff" : "#6B7280"}
            />
            <Text style={[styles.segLabel, activeTab === "overview" && styles.segLabelActive]}>
              Overview
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segTab, activeTab === "reports" && styles.segTabActive]}
            onPress={() => setActiveTab("reports")}
          >
            <Ionicons
              name="bar-chart-outline"
              size={14}
              color={activeTab === "reports" ? "#fff" : "#6B7280"}
            />
            <Text style={[styles.segLabel, activeTab === "reports" && styles.segLabelActive]}>
              Reports{reports.length > 0 ? ` (${reports.length})` : ""}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0F4A2F" />}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ─────────── OVERVIEW TAB ─────────── */}
        {activeTab === "overview" && (
          <>
           

            {/* Area Banner */}
            <View style={styles.areaBanner}>
              <View>
                <Text style={styles.areaLabel}>Total Area Planted</Text>
                <Text style={styles.areaValue}>
                  {parseFloat(application.total_area_planted).toFixed(2)}
                  <Text style={styles.areaUnit}> hectares</Text>
                </Text>
              </View>
              <View style={styles.areaIconCircle}>
                <Ionicons name="map-outline" size={24} color="#fff" />
              </View>
            </View>

            {/* Description */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="document-text-outline" size={16} color="#0F4A2F" />
                <Text style={styles.cardTitle}>About This Program</Text>
              </View>
              <Text style={styles.cardBody}>{application.description}</Text>
            </View>

            {/* Dates */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="calendar-outline" size={16} color="#0F4A2F" />
                <Text style={styles.cardTitle}>Key Dates</Text>
              </View>
              <View style={styles.datesRow}>
                <View style={styles.dateItem}>
                  <Text style={styles.dateLabel}>Submitted</Text>
                  <Text style={styles.dateValue}>{formatDate(application.created_at)}</Text>
                </View>
                <View style={styles.dateDivider} />
                <View style={styles.dateItem}>
                  <Text style={styles.dateLabel}>Last Updated</Text>
                  <Text style={styles.dateValue}>{formatDate(application.updated_at)}</Text>
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

            {/* Assigned Site */}
            {site && (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Ionicons name="location-outline" size={16} color="#0F4A2F" />
                  <Text style={styles.cardTitle}>Assigned Planting Site</Text>
                </View>

                {[
                  { label: "Site Name", value: site.name },
                  { label: "Barangay", value: site.barangay },
                  { label: "Reforestation Area", value: site.reforestation_area },
                  { label: "Land Classification", value: site.land_classification },
                ].map((row, i) => (
                  <View key={i} style={styles.siteRow}>
                    <Text style={styles.siteLabel}>{row.label}</Text>
                    <Text style={styles.siteValue}>{row.value}</Text>
                  </View>
                ))}

                <TouchableOpacity style={styles.mapPreviewWrap} onPress={() => setShowMap(true)}>
                  <MapView
                    style={StyleSheet.absoluteFill}
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
                        fillColor="rgba(15,74,47,0.3)"
                        strokeWidth={2}
                      />
                    )}
                    {centroid && <Marker coordinate={centroid} title={site.name} />}
                  </MapView>
                  <View style={styles.mapTapOverlay}>
                    <Ionicons name="expand-outline" size={16} color="#fff" />
                    <Text style={styles.mapTapText}>Tap to expand</Text>
                  </View>
                </TouchableOpacity>
                
              </View>
              
            )}
             {/* Metrics Grid */}
            <Text style={styles.sectionHeading}>Seedling Progress</Text>
            <View style={styles.metricsGrid}>
              <MetricCard iconName="leaf-outline"      accent="#0F4A2F" label="Requested" value={application.total_request_seedling} />
              <MetricCard iconName="cube-outline"      accent="#1565C0" label="Provided"  value={application.total_seedling_provided} />
              <MetricCard iconName="earth-outline"     accent="#2E7D32" label="Planted"   value={application.total_seedling_planted} />
              <MetricCard iconName="heart-outline"     accent="#388E3C" label="Survived"  value={application.total_seedling_survived} />
            </View>
          </>
        )}

        {/* ─────────── REPORTS TAB ─────────── */}
        {activeTab === "reports" && (
          <>
            {hasRejected && (
              <View style={styles.alertBanner}>
                <View style={styles.alertIconWrap}>
                  <Ionicons name="warning-outline" size={20} color="#F57F17" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.alertTitle}>Action Required</Text>
                  <Text style={styles.alertMsg}>
                    You have rejected reports. Please submit an updated maintenance report.
                  </Text>
                </View>
              </View>
            )}

            {reports.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconWrap}>
                  <Ionicons name="clipboard-outline" size={36} color="#0F4A2F" />
                </View>
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
                  activeOpacity={0.75}
                >
                  <View style={styles.reportCardTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reportCardTitle} numberOfLines={1}>{report.title}</Text>
                      <Text style={styles.reportCardDate}>{formatDate(report.created_at)}</Text>
                    </View>
                    <StatusBadge status={report.status} />
                  </View>

                  <Text style={styles.reportCardDesc} numberOfLines={2}>{report.description}</Text>

                  <View style={styles.reportMini}>
                    {[
                      { label: "Planted",  value: String(report.total_seedling_planted) },
                      { label: "Survived", value: String(report.total_seedling_survived) },
                      { label: "Area",     value: `${parseFloat(report.total_area_planted).toFixed(1)} ha` },
                      { label: "Members",  value: String(report.total_member_present ?? "—") },
                    ].map((m, i) => (
                      <View key={i} style={styles.reportMiniItem}>
                        <Text style={styles.reportMiniVal}>{m.value}</Text>
                        <Text style={styles.reportMiniLabel}>{m.label}</Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.reportCardFooter}>
                    <Text style={styles.reportCardCta}>View Details</Text>
                    <Ionicons name="chevron-forward" size={14} color="#0F4A2F" />
                  </View>
                </TouchableOpacity>
              ))
            )}
          </>
        )}

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* ── FAB ── */}
      {activeTab === "reports" && application.status === "accepted" && (
        <TouchableOpacity style={styles.fab} onPress={() => setCreateModalVisible(true)}>
          <Ionicons name="add" size={22} color="#fff" />
          <Text style={styles.fabText}>New Report</Text>
        </TouchableOpacity>
      )}

      {/* ── FULL MAP MODAL ── */}
      <Modal visible={showMap} animationType="slide" onRequestClose={() => setShowMap(false)}>
        <View style={{ flex: 1 }}>
          <MapView style={StyleSheet.absoluteFill} initialRegion={getMapRegion()}>
            {polygonCoords.length > 0 && (
              <Polygon
                coordinates={polygonCoords}
                strokeColor="#0F4A2F"
                fillColor="rgba(15,74,47,0.3)"
                strokeWidth={3}
              />
            )}
            {centroid && <Marker coordinate={centroid} title={site?.name ?? "Site"} />}
          </MapView>
          <View style={styles.mapModalBar}>
            <TouchableOpacity style={styles.mapCloseBtn} onPress={() => setShowMap(false)}>
              <Ionicons name="close" size={18} color="#fff" />
              <Text style={styles.mapCloseTxt}>Close</Text>
            </TouchableOpacity>
            {site && (
              <View style={styles.mapTitlePill}>
                <Ionicons name="location" size={13} color="#fff" />
                <Text style={styles.mapTitleTxt} numberOfLines={1}>{site.name}</Text>
              </View>
            )}
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
        <View style={sheet.overlay}>
          <View style={sheet.panel}>
            <View style={sheet.handle} />
            {selectedReport && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={sheet.headerRow}>
                  <Text style={sheet.title}>{selectedReport.title}</Text>
                  <StatusBadge status={selectedReport.status} />
                </View>
                <Text style={sheet.date}>{formatDate(selectedReport.created_at)}</Text>
                <Text style={sheet.desc}>{selectedReport.description}</Text>

                <View style={sheet.metricsBox}>
                  {[
                    { label: "Members Present",    value: selectedReport.total_member_present ?? "—" },
                    { label: "Seedlings Planted",  value: selectedReport.total_seedling_planted },
                    { label: "Seedlings Survived", value: selectedReport.total_seedling_survived },
                    { label: "Area Planted",       value: `${parseFloat(selectedReport.total_area_planted).toFixed(2)} ha` },
                    { label: "Owned Seedlings",    value: selectedReport.total_owned_seedling_planted },
                  ].map((m, i) => (
                    <View key={i} style={sheet.metricRow}>
                      <Text style={sheet.metricLabel}>{m.label}</Text>
                      <Text style={sheet.metricVal}>{m.value}</Text>
                    </View>
                  ))}
                </View>

                {selectedReport.status === "rejected" && (
                  <View style={sheet.rejectedBox}>
                    <Ionicons name="close-circle-outline" size={18} color="#C62828" />
                    <View style={{ flex: 1 }}>
                      <Text style={sheet.rejectedTitle}>Report Rejected</Text>
                      <Text style={sheet.rejectedMsg}>
                        Please submit an updated maintenance report addressing the feedback.
                      </Text>
                    </View>
                  </View>
                )}

                <TouchableOpacity style={sheet.closeBtn} onPress={() => setSelectedReport(null)}>
                  <Text style={sheet.closeTxt}>Close</Text>
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
          style={sheet.overlay}
        >
          <View style={[sheet.panel, { maxHeight: screenHeight * 0.93 }]}>
            <View style={sheet.handle} />
            <View style={sheet.headerRow}>
              <Text style={sheet.title}>New Maintenance Report</Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              <Text style={form_.section}>Basic Information</Text>

              <Text style={form_.label}>Report Title *</Text>
              <TextInput
                style={form_.input}
                placeholder="e.g. Monthly Planting Activity – April 2026"
                value={form.title}
                onChangeText={(t) => setForm((p) => ({ ...p, title: t }))}
                placeholderTextColor="#B0BAC4"
              />

              <Text style={form_.label}>Description *</Text>
              <TextInput
                style={[form_.input, form_.textarea]}
                placeholder="Describe the maintenance activities conducted…"
                value={form.description}
                onChangeText={(t) => setForm((p) => ({ ...p, description: t }))}
                multiline
                numberOfLines={4}
                placeholderTextColor="#B0BAC4"
                textAlignVertical="top"
              />

              <Text style={form_.section}>Metrics</Text>

              <View style={form_.row}>
                <View style={form_.half}>
                  <Text style={form_.label}>Members Present</Text>
                  <TextInput style={form_.input} placeholder="0" keyboardType="numeric"
                    value={form.total_member_present} placeholderTextColor="#B0BAC4"
                    onChangeText={(t) => setForm((p) => ({ ...p, total_member_present: t }))} />
                </View>
                <View style={form_.half}>
                  <Text style={form_.label}>Seedlings Planted</Text>
                  <TextInput style={form_.input} placeholder="0" keyboardType="numeric"
                    value={form.total_seedling_planted} placeholderTextColor="#B0BAC4"
                    onChangeText={(t) => setForm((p) => ({ ...p, total_seedling_planted: t }))} />
                </View>
              </View>

              <View style={form_.row}>
                <View style={form_.half}>
                  <Text style={form_.label}>Seedlings Survived</Text>
                  <TextInput style={form_.input} placeholder="0" keyboardType="numeric"
                    value={form.total_seedling_survived} placeholderTextColor="#B0BAC4"
                    onChangeText={(t) => setForm((p) => ({ ...p, total_seedling_survived: t }))} />
                </View>
                <View style={form_.half}>
                  <Text style={form_.label}>Area Planted (ha)</Text>
                  <TextInput style={form_.input} placeholder="0.00" keyboardType="decimal-pad"
                    value={form.total_area_planted} placeholderTextColor="#B0BAC4"
                    onChangeText={(t) => setForm((p) => ({ ...p, total_area_planted: t }))} />
                </View>
              </View>

              <View style={form_.half}>
                <Text style={form_.label}>Owned Seedlings</Text>
                <TextInput style={form_.input} placeholder="0" keyboardType="numeric"
                  value={form.total_owned_seedling_planted} placeholderTextColor="#B0BAC4"
                  onChangeText={(t) => setForm((p) => ({ ...p, total_owned_seedling_planted: t }))} />
              </View>

              <Text style={form_.section}>Attachments</Text>

              <TouchableOpacity style={form_.uploadBtn} onPress={handleFilePick}>
                <View style={[form_.uploadIconWrap, { backgroundColor: "#E3F2FD" }]}>
                  <Ionicons name="document-attach-outline" size={20} color="#1565C0" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={form_.uploadTitle}>Report File</Text>
                  <Text style={form_.uploadSub} numberOfLines={1}>
                    {form.maintenance_report_file ? form.maintenance_report_file.name : "PDF or Word document"}
                  </Text>
                </View>
                <Ionicons
                  name={form.maintenance_report_file ? "checkmark-circle" : "chevron-forward"}
                  size={20}
                  color={form.maintenance_report_file ? "#2E7D32" : "#9CA3AF"}
                />
              </TouchableOpacity>

              <TouchableOpacity style={form_.uploadBtn} onPress={handleImagePick}>
                <View style={[form_.uploadIconWrap, { backgroundColor: "#E8F5E9" }]}>
                  <Ionicons name="camera-outline" size={20} color="#2E7D32" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={form_.uploadTitle}>Group Picture</Text>
                  <Text style={form_.uploadSub} numberOfLines={1}>
                    {form.group_picture ? form.group_picture.name : "Photo of participants"}
                  </Text>
                </View>
                <Ionicons
                  name={form.group_picture ? "checkmark-circle" : "chevron-forward"}
                  size={20}
                  color={form.group_picture ? "#2E7D32" : "#9CA3AF"}
                />
              </TouchableOpacity>

              {form.group_picture && (
                <Image source={{ uri: form.group_picture.uri }} style={form_.preview} resizeMode="cover" />
              )}

              <View style={form_.actions}>
                <TouchableOpacity style={form_.cancelBtn} onPress={() => setCreateModalVisible(false)}>
                  <Text style={form_.cancelTxt}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[form_.submitBtn, submitting && form_.submitDisabled]}
                  onPress={handleSubmitReport}
                  disabled={submitting}
                >
                  {submitting
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={form_.submitTxt}>Submit Report</Text>
                  }
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
  container: { flex: 1, backgroundColor: "#F4F7F5" },

  // Loading / Error
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32, backgroundColor: "#F4F7F5" },
  loadingText: { marginTop: 14, color: "#6B7280", fontSize: 14 },
  errorIconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: "#E8F5E9", justifyContent: "center", alignItems: "center", marginBottom: 16,
  },
  errorTitle: { fontSize: 20, fontWeight: "700", color: "#111827", marginBottom: 6 },
  errorMsg: { fontSize: 14, color: "#6B7280", textAlign: "center", marginBottom: 24, lineHeight: 20 },
  retryBtn: {
    flexDirection: "row", gap: 6, alignItems: "center",
    backgroundColor: "#0F4A2F", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12,
  },
  retryText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  // Banner
  banner: {
    backgroundColor: "#0F4A2F",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 0,
  },
  bannerInner: {
    flexDirection: "row", alignItems: "flex-start",
    justifyContent: "space-between", marginBottom: 14,
  },
  bannerLeft: { flexDirection: "row", alignItems: "flex-start", gap: 10, flex: 1, marginRight: 8 },
  bannerIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.15)", justifyContent: "center", alignItems: "center",
  },
  bannerTitle: { fontSize: 16, fontWeight: "800", color: "#fff", lineHeight: 22 },
  bannerSub: { fontSize: 11, color: "rgba(255,255,255,0.65)", marginTop: 2 },
  bannerStats: {
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.18)",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  bannerStat: { flex: 1, alignItems: "center" },
  bannerStatVal: { fontSize: 16, fontWeight: "800", color: "#fff" },
  bannerStatUnit: { fontSize: 11, fontWeight: "500", color: "rgba(255,255,255,0.7)" },
  bannerStatLabel: { fontSize: 10, color: "rgba(255,255,255,0.6)", marginTop: 2 },
  bannerStatDiv: { width: 1, backgroundColor: "rgba(255,255,255,0.15)", marginVertical: 2 },

  // Segmented tabs
  segmentWrap: {
    backgroundColor: "#0F4A2F",
    paddingHorizontal: 16,
    paddingBottom: 14,
    paddingTop: 10,
  },
  segment: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 12,
    padding: 3,
  },
  segTab: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 8, borderRadius: 10,
  },
  segTabActive: { backgroundColor: "#fff" },
  segLabel: { fontSize: 13, fontWeight: "600", color: "rgba(255,255,255,0.7)" },
  segLabelActive: { color: "#0F4A2F" },

  scrollContent: { paddingHorizontal: 16, paddingTop: 16 },

  sectionHeading: {
    fontSize: 12, fontWeight: "700", color: "#6B7280",
    textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10,
  },

  // Metrics
  metricsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 },

  // Area banner
  areaBanner: {
    backgroundColor: "#0F4A2F",
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  areaLabel: { fontSize: 12, color: "rgba(255,255,255,0.7)", fontWeight: "600", marginBottom: 4 },
  areaValue: { fontSize: 30, fontWeight: "900", color: "#fff" },
  areaUnit: { fontSize: 14, fontWeight: "500", color: "rgba(255,255,255,0.7)" },
  areaIconCircle: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.15)", justifyContent: "center", alignItems: "center",
  },

  // Card
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  cardTitle: { fontSize: 14, fontWeight: "700", color: "#111827" },
  cardBody: { fontSize: 14, color: "#4B5563", lineHeight: 21 },

  // Dates
  datesRow: { flexDirection: "row", alignItems: "center" },
  dateItem: { flex: 1, alignItems: "center", paddingVertical: 4 },
  dateLabel: { fontSize: 11, color: "#9CA3AF", marginBottom: 4 },
  dateValue: { fontSize: 13, fontWeight: "700", color: "#111827", textAlign: "center" },
  dateDivider: { width: 1, height: 40, backgroundColor: "#F3F4F6" },

  // Site
  siteRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: "#F3F4F6",
  },
  siteLabel: { fontSize: 12, color: "#9CA3AF" },
  siteValue: { fontSize: 13, fontWeight: "600", color: "#111827", flexShrink: 1, textAlign: "right", marginLeft: 12 },

  // Map preview
  mapPreviewWrap: { height: 190, borderRadius: 12, overflow: "hidden", marginTop: 14, position: "relative" },
  mapTapOverlay: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "rgba(15,74,47,0.8)", paddingVertical: 8,
    flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6,
  },
  mapTapText: { color: "#fff", fontSize: 13, fontWeight: "600" },

  // Alert banner
  alertBanner: {
    backgroundColor: "#FFF8E1",
    borderRadius: 14, padding: 14, marginBottom: 12,
    flexDirection: "row", gap: 12, alignItems: "flex-start",
    borderLeftWidth: 4, borderLeftColor: "#F9A825",
  },
  alertIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#FFF3CD", justifyContent: "center", alignItems: "center",
  },
  alertTitle: { fontSize: 13, fontWeight: "700", color: "#7B4F00", marginBottom: 2 },
  alertMsg: { fontSize: 12, color: "#7B4F00", lineHeight: 17 },

  // Empty state
  emptyState: { alignItems: "center", paddingVertical: 56 },
  emptyIconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: "#E8F5E9", justifyContent: "center", alignItems: "center", marginBottom: 16,
  },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#111827", marginBottom: 6 },
  emptyMsg: { fontSize: 13, color: "#6B7280", textAlign: "center", maxWidth: 240, lineHeight: 20 },

  // Report card
  reportCard: {
    backgroundColor: "#fff",
    borderRadius: 16, padding: 16, marginBottom: 12,
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  reportCardTop: { flexDirection: "row", alignItems: "flex-start", marginBottom: 8, gap: 8 },
  reportCardTitle: { fontSize: 15, fontWeight: "700", color: "#111827" },
  reportCardDate: { fontSize: 11, color: "#9CA3AF", marginTop: 2 },
  reportCardDesc: { fontSize: 13, color: "#6B7280", lineHeight: 18, marginBottom: 12 },
  reportMini: {
    flexDirection: "row", justifyContent: "space-between",
    backgroundColor: "#F4F7F5", borderRadius: 12, paddingVertical: 10, paddingHorizontal: 8,
    marginBottom: 10,
  },
  reportMiniItem: { alignItems: "center", flex: 1 },
  reportMiniVal: { fontSize: 14, fontWeight: "800", color: "#0F4A2F" },
  reportMiniLabel: { fontSize: 10, color: "#9CA3AF", marginTop: 2 },
  reportCardFooter: {
    flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 4,
    borderTopWidth: 1, borderTopColor: "#F3F4F6", paddingTop: 10,
  },
  reportCardCta: { fontSize: 12, fontWeight: "700", color: "#0F4A2F" },

  // FAB
  fab: {
    position: "absolute", bottom: 28, right: 20,
    backgroundColor: "#0F4A2F", borderRadius: 28,
    paddingVertical: 14, paddingHorizontal: 22,
    flexDirection: "row", alignItems: "center", gap: 8,
    shadowColor: "#0F4A2F", shadowOpacity: 0.4,
    shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },
  fabText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  // Full map modal bar
  mapModalBar: {
    position: "absolute",
    top: Platform.OS === "ios" ? 52 : 16,
    left: 16, right: 16,
    flexDirection: "row", gap: 10, alignItems: "center",
  },
  mapCloseBtn: {
    flexDirection: "row", gap: 6, alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
  },
  mapCloseTxt: { color: "#fff", fontWeight: "700", fontSize: 13 },
  mapTitlePill: {
    flex: 1, flexDirection: "row", gap: 6, alignItems: "center",
    backgroundColor: "rgba(15,74,47,0.85)", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
  },
  mapTitleTxt: { color: "#fff", fontWeight: "700", fontSize: 13, flex: 1 },
});

// Badge styles
const badge = StyleSheet.create({
  wrap: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 20, gap: 5,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
});

// Metric card styles
const metric = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: (screenWidth - 52) / 2,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    borderTopWidth: 3,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  iconWrap: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: "center", alignItems: "center", marginBottom: 8,
  },
  value: { fontSize: 22, fontWeight: "800" },
  unit: { fontSize: 12, fontWeight: "500", color: "#6B7280" },
  label: { fontSize: 11, color: "#9CA3AF", marginTop: 3, textAlign: "center" },
});

// Bottom sheet styles
const sheet = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
  panel: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingBottom: 32,
    maxHeight: screenHeight * 0.86,
  },
  handle: {
    width: 40, height: 4, backgroundColor: "#E5E7EB",
    borderRadius: 2, alignSelf: "center", marginTop: 12, marginBottom: 20,
  },
  headerRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "flex-start", marginBottom: 6, gap: 8,
  },
  title: { fontSize: 18, fontWeight: "800", color: "#111827", flex: 1 },
  date: { fontSize: 12, color: "#9CA3AF", marginBottom: 14 },
  desc: { fontSize: 14, color: "#4B5563", lineHeight: 21, marginBottom: 16 },
  metricsBox: {
    backgroundColor: "#F4F7F5", borderRadius: 14, padding: 12, marginBottom: 16,
  },
  metricRow: {
    flexDirection: "row", justifyContent: "space-between",
    paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: "#E9F0EC",
  },
  metricLabel: { fontSize: 13, color: "#6B7280" },
  metricVal: { fontSize: 13, fontWeight: "700", color: "#0F4A2F" },
  rejectedBox: {
    backgroundColor: "#FFEBEE", borderRadius: 12, padding: 14,
    marginBottom: 16, flexDirection: "row", gap: 10, alignItems: "flex-start",
    borderLeftWidth: 4, borderLeftColor: "#D32F2F",
  },
  rejectedTitle: { fontSize: 13, fontWeight: "700", color: "#C62828", marginBottom: 3 },
  rejectedMsg: { fontSize: 12, color: "#C62828", lineHeight: 17 },
  closeBtn: {
    backgroundColor: "#F4F7F5", borderRadius: 14, padding: 15, alignItems: "center",
  },
  closeTxt: { color: "#0F4A2F", fontWeight: "700", fontSize: 14 },
});

// Form styles
const form_ = StyleSheet.create({
  section: {
    fontSize: 11, fontWeight: "700", color: "#6B7280",
    textTransform: "uppercase", letterSpacing: 1,
    marginTop: 18, marginBottom: 10,
  },
  label: { fontSize: 12, fontWeight: "600", color: "#374151", marginBottom: 6 },
  input: {
    borderWidth: 1.5, borderColor: "#E5E7EB",
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: "#111827", backgroundColor: "#FAFAFA", marginBottom: 12,
  },
  textarea: { height: 96, paddingTop: 12 },
  row: { flexDirection: "row", gap: 10 },
  half: { flex: 1 },
  uploadBtn: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#FAFAFA", borderWidth: 1.5, borderColor: "#E5E7EB",
    borderRadius: 14, padding: 14, marginBottom: 10,
  },
  uploadIconWrap: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  uploadTitle: { fontSize: 13, fontWeight: "600", color: "#111827" },
  uploadSub: { fontSize: 11, color: "#9CA3AF", marginTop: 2 },
  preview: { width: "100%", height: 160, borderRadius: 14, marginBottom: 14 },
  actions: { flexDirection: "row", gap: 12, marginTop: 10 },
  cancelBtn: {
    flex: 1, borderWidth: 1.5, borderColor: "#E5E7EB",
    borderRadius: 14, paddingVertical: 14, alignItems: "center",
  },
  cancelTxt: { color: "#6B7280", fontWeight: "600", fontSize: 14 },
  submitBtn: {
    flex: 2, backgroundColor: "#0F4A2F", borderRadius: 14,
    paddingVertical: 14, alignItems: "center",
    shadowColor: "#0F4A2F", shadowOpacity: 0.35, shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 }, elevation: 5,
  },
  submitDisabled: { opacity: 0.6 },
  submitTxt: { color: "#fff", fontWeight: "800", fontSize: 14 },
});

export default ApplicationPage;
