import React, { useState, useEffect } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Linking,
  Dimensions,
  RefreshControl,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/constants/url_fixed";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ─── Design Tokens ────────────────────────────────────────────────────────
const PRIMARY = "#0F4A2F";
const SUCCESS = "#16A34A";
const DANGER = "#DC2626";
const WARNING = "#D97706";
const INK = "#111827";
const MUTED = "#6B7280";
const FAINT = "#9CA3AF";
const WHITE = "#FFFFFF";
const BG = "#F4F7F5";
const BORDER = "#E5E7EB";

// ─── Types ─────────────────────────────────────────────────────────────────
interface SeedlingSpeciesItem {
  species_id: number;
  species_name: string;
  quantity: number;
  provided_by: string;
}

interface ProgressReportSpeciesItem {
  species_id: number;
  species_name: string;
  no_planted: number;
  no_added_by_grower: number;
  no_survived: number;
  no_dead: number;
  survival_rate: number;
}

interface ProgressReport {
  report_id: number;
  visit_type: "initial" | "ongoing";
  orientation_conducted: boolean;
  agreement_image: string | null;
  total_survived: number;
  total_dead: number;
  total_added_by_grower: number;
  species: ProgressReportSpeciesItem[];
  description: string | null;
  status: "pending" | "accepted" | "rejected";
  proof_image: string | null;
  submitted_at: string | null;
}

interface ApplicationDetail {
  application: {
    application_id: number;
    title: string;
    classification: "new" | "old";
    status: string;
    total_treegrowers_will_participate: number;
    orientation_date: string | null;
    created_at: string;
  };
  group: {
    group_name: string;
    group_type: string;
    group_contact: string;
    group_address: string;
    group_profile: string | null;
  };
  profile: {
    first_name: string;
    last_name: string;
    contact: string;
    gender: string;
    profile_img: string | null;
  } | null;
  assigned_site: {
    name: string;
    total_area_hectares: number;
    ndvi_value: number | null;
    reforestation_area_name: string | null;
    barangay_name: string | null;
    accessibility: any;
    land_classification_name: string | null;
  } | null;
  seedling_requests: Array<{
    request_id: number;
    no_request_seedling: number;
    species: SeedlingSpeciesItem[];
    status: "pending" | "accepted" | "rejected";
    reason_accepted: string | null;
    submitted_at: string | null;
  }>;
  progress_reports: ProgressReport[];
}

type TreeSpeciesOption = {
  tree_specie_id: number;
  name: string;
  description: string;
};
type ReportSpeciesItem = {
  tree_species_id: number;
  species_name: string;
  no_planted: number;
  no_added_by_grower: number;
  no_survived: number;
  no_dead: number;
};

const formatDate = (iso: string | null) =>
  !iso
    ? "—"
    : new Date(iso).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

// ─── Components ───────────────────────────────────────────────────────────
const StatusBadge = ({ status }: { status: string }) => {
  const config: Record<
    string,
    { label: string; bg: string; text: string; dot: string }
  > = {
    accepted: {
      label: "Needs Orientation",
      bg: "#DBEAFE",
      text: "#1E40AF",
      dot: "#3B82F6",
    },
    under_monitoring: {
      label: "Under Monitoring",
      bg: "#DCFCE7",
      text: "#166534",
      dot: "#22C55E",
    },
    completed: {
      label: "Completed",
      bg: "#F0FDF4",
      text: "#15803D",
      dot: "#16A34A",
    },
    failed: { label: "Failed", bg: "#FEE2E2", text: "#991B1B", dot: "#EF4444" },
  };
  const conf = config[status] || {
    label: status,
    bg: "#F3F4F6",
    text: "#374151",
    dot: "#9CA3AF",
  };
  return (
    <View style={[badgeStyles.wrap, { backgroundColor: conf.bg }]}>
      <View style={[badgeStyles.dot, { backgroundColor: conf.dot }]} />
      <Text style={[badgeStyles.text, { color: conf.text }]}>{conf.label}</Text>
    </View>
  );
};

const SectionHeader = ({ title, icon }: { title: string; icon?: string }) => (
  <View style={styles.sectionHeaderRow}>
    {icon && (
      <Ionicons
        name={icon as any}
        size={16}
        color={MUTED}
        style={{ marginRight: 8 }}
      />
    )}
    <Text style={styles.sectionTitle}>{title}</Text>
  </View>
);

const InfoRow = ({
  icon,
  label,
  value,
}: {
  icon: string;
  label?: string;
  value: string;
}) => (
  <View style={styles.infoRow}>
    <Ionicons name={icon as any} size={18} color={MUTED} />
    <View style={{ marginLeft: 12, flex: 1 }}>
      {label && <Text style={styles.infoLabel}>{label}</Text>}
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  </View>
);

const SectionDivider = () => <View style={styles.divider} />;

// ── Floating Progress Timeline ────────────────────────────────────────────
const FloatingProgressTimeline = ({ status }: { status: string }) => {
  const steps = [
    { key: "approved", label: "Approved", icon: "checkmark-circle" },
    { key: "orientation", label: "Orientation", icon: "people" },
    { key: "monitoring", label: "Monitoring", icon: "leaf" },
  ];

  let currentIndex = 0;
  if (status === "accepted") currentIndex = 0;
  else if (status === "under_monitoring" || status === "completed")
    currentIndex = 2;
  else currentIndex = 1;

  return (
    <View style={floatTimelineStyles.container}>
      <View style={floatTimelineStyles.card}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={floatTimelineStyles.scroll}
        >
          {steps.map((step, index) => {
            const isActive = index <= currentIndex;
            const isCurrent = index === currentIndex;
            return (
              <View key={step.key} style={floatTimelineStyles.stepContainer}>
                <View
                  style={[
                    floatTimelineStyles.iconCircle,
                    isActive && floatTimelineStyles.iconCircleActive,
                    isCurrent && floatTimelineStyles.iconCircleCurrent,
                  ]}
                >
                  <Ionicons
                    name={step.icon as any}
                    size={isCurrent ? 16 : 14}
                    color={isActive ? "#fff" : "#D1D5DB"}
                  />
                </View>
                <Text
                  style={[
                    floatTimelineStyles.stepLabel,
                    isActive && floatTimelineStyles.stepLabelActive,
                    isCurrent && floatTimelineStyles.stepLabelCurrent,
                  ]}
                >
                  {step.label}
                </Text>
                {index < steps.length - 1 && (
                  <View
                    style={[
                      floatTimelineStyles.connector,
                      index < currentIndex &&
                        floatTimelineStyles.connectorActive,
                    ]}
                  />
                )}
              </View>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────
export default function MonitoringDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [detail, setDetail] = useState<ApplicationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Form State
  const [allTreeSpecies, setAllTreeSpecies] = useState<TreeSpeciesOption[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [orientationConducted, setOrientationConducted] = useState(false);
  const [agreementImage, setAgreementImage] =
    useState<ImagePicker.ImagePickerAsset | null>(null);

  const [reportSpeciesList, setReportSpeciesList] = useState<
    ReportSpeciesItem[]
  >([]);
  const [selectedSpeciesId, setSelectedSpeciesId] = useState<string>("");
  const [tempPlanted, setTempPlanted] = useState("");
  const [tempAdded, setTempAdded] = useState("");
  const [tempSurvived, setTempSurvived] = useState("");
  const [tempDead, setTempDead] = useState("");

  const [description, setDescription] = useState("");
  const [proofImage, setProofImage] =
    useState<ImagePicker.ImagePickerAsset | null>(null);

  const isInitialVisit = detail?.application.status === "accepted";

  // ─── Fetch Data ──────────────────────────────────────────────────────────
  const fetchDetail = async (isRefresh = false) => {
    if (!id) return;
    if (!isRefresh) setLoading(true);
    try {
      const token = await SecureStore.getItemAsync("token");
      if (!token) throw new Error("No authentication token found.");

      const res = await fetch(`${api}/api/get_application/${id}/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load application details.");

      const data = await res.json();
      setDetail(data);

      // Auto-set orientation conducted if it's an ongoing visit
      if (data.application.status === "under_monitoring") {
        setOrientationConducted(true);
      }
    } catch (err: any) {
      Alert.alert("Error", err.message, [
        { text: "OK", onPress: () => router.replace("/(tabs)/monitoring") },
      ]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchTreeSpecies = async () => {
    try {
      const token = await SecureStore.getItemAsync("token");
      const res = await fetch(`${api}/api/get_tree_species_list/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setAllTreeSpecies(await res.json());
    } catch (err) {
      console.error("Failed to fetch tree species", err);
    }
  };

  useEffect(() => {
    fetchDetail();
    fetchTreeSpecies();
  }, [id]);

  // ─── Metrics Calculation ─────────────────────────────────────────────────
  const acceptedSeedlingRequests =
    detail?.seedling_requests.filter((r) => r.status === "accepted") || [];
  const allProgressReports = detail?.progress_reports || [];

  const totalSeedlingsProvided = acceptedSeedlingRequests.reduce((sum, req) => {
    return (
      sum + (req.species?.reduce((sSum, sp) => sSum + sp.quantity, 0) || 0)
    );
  }, 0);

  const totalSurvived = allProgressReports.reduce(
    (sum, rep) => sum + (rep.total_survived || 0),
    0,
  );
  const totalDead = allProgressReports.reduce(
    (sum, rep) => sum + (rep.total_dead || 0),
    0,
  );

  // ✅ Calculate Total Ever Planted (Initial planted + all additions)
  const initialReport = allProgressReports.find(
    (r) => r.visit_type === "initial",
  );
  const initialPlanted =
    initialReport?.species.reduce((sum, sp) => sum + (sp.no_planted || 0), 0) ||
    0;
  const totalAddedByGrower = allProgressReports.reduce(
    (sum, rep) => sum + (rep.total_added_by_grower || 0),
    0,
  );
  const totalEverPlanted = initialPlanted + totalAddedByGrower;

  const survivalRate =
    totalEverPlanted > 0
      ? ((totalSurvived / totalEverPlanted) * 100).toFixed(1)
      : "0.0";
  const survivalRateNum = parseFloat(survivalRate);

  const getSurvivalColor = () => {
    if (survivalRateNum >= 80)
      return { text: SUCCESS, bg: "#DCFCE7", border: "#86EFAC" };
    if (survivalRateNum >= 50)
      return { text: WARNING, bg: "#FEF3C7", border: "#FCD34D" };
    return { text: DANGER, bg: "#FEE2E2", border: "#FCA5A5" };
  };
  const survivalColor = getSurvivalColor();

  // ─── Image Pickers ───────────────────────────────────────────────────────
  const pickImage = async (type: "proof" | "agreement") => {
    Alert.alert("Select Photo", "Choose a photo source", [
      { text: "Take Photo", onPress: () => launchPicker(type, "camera") },
      {
        text: "Choose from Library",
        onPress: () => launchPicker(type, "library"),
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const launchPicker = async (
    type: "proof" | "agreement",
    source: "camera" | "library",
  ) => {
    try {
      if (source === "camera") {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted)
          return Alert.alert("Permission Needed", "Camera access is required.");
        const result = await ImagePicker.launchCameraAsync({
          quality: 0.7,
          allowsEditing: true,
        });
        if (!result.canceled && result.assets?.[0]) {
          type === "proof"
            ? setProofImage(result.assets[0])
            : setAgreementImage(result.assets[0]);
        }
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted)
          return Alert.alert(
            "Permission Needed",
            "Photo library access is required.",
          );
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.7,
          allowsEditing: true,
        });
        if (!result.canceled && result.assets?.[0]) {
          type === "proof"
            ? setProofImage(result.assets[0])
            : setAgreementImage(result.assets[0]);
        }
      }
    } catch (err) {
      Alert.alert("Error", "Something went wrong selecting the image.");
    }
  };

  // ─── Form Handlers ───────────────────────────────────────────────────────
  const handleAddSpeciesToReport = () => {
    if (!selectedSpeciesId)
      return Alert.alert("Missing Species", "Please select a tree species.");
    const found = allTreeSpecies.find(
      (s) => s.tree_specie_id === Number(selectedSpeciesId),
    );
    if (!found) return;
    if (
      reportSpeciesList.some((s) => s.tree_species_id === found.tree_specie_id)
    ) {
      return Alert.alert("Duplicate", "Species already added to this report.");
    }

    setReportSpeciesList([
      ...reportSpeciesList,
      {
        tree_species_id: found.tree_specie_id,
        species_name: found.name,
        no_planted: isInitialVisit ? parseInt(tempPlanted) || 0 : 0,
        no_added_by_grower: parseInt(tempAdded) || 0,
        no_survived: parseInt(tempSurvived) || 0,
        no_dead: parseInt(tempDead) || 0,
      },
    ]);
    setSelectedSpeciesId("");
    setTempPlanted("");
    setTempAdded("");
    setTempSurvived("");
    setTempDead("");
  };

  const handleSubmitReport = async () => {
    if (!detail || reportSpeciesList.length === 0) {
      return Alert.alert(
        "Missing Data",
        "Please add at least one species to the report.",
      );
    }
    if (isInitialVisit && !orientationConducted) {
      return Alert.alert(
        "Missing Requirement",
        "You must confirm that the orientation was conducted.",
      );
    }
    if (isInitialVisit && !agreementImage) {
      return Alert.alert(
        "Missing Requirement",
        "Please upload the signed agreement image.",
      );
    }

    // ✅ ENFORCE PROOF IMAGE FOR ALL VISITS (Initial & Ongoing)
    if (!proofImage) {
      return Alert.alert(
        "Missing Requirement",
        "Please upload a proof image of the site/group for this visit.",
      );
    }

    setSubmitting(true);
    try {
      const token = await SecureStore.getItemAsync("token");
      const formData = new FormData();
      formData.append(
        "application_id",
        String(detail.application.application_id),
      );
      formData.append("visit_type", isInitialVisit ? "initial" : "ongoing");
      formData.append("orientation_conducted", String(orientationConducted));
      formData.append("report_species", JSON.stringify(reportSpeciesList));
      formData.append("description", description);

      if (isInitialVisit && agreementImage) {
        const filename = agreementImage.uri.split("/").pop();
        formData.append("agreement_image", {
          uri: agreementImage.uri,
          name: filename || "agreement.jpg",
          type: "image/jpeg",
        } as any);
      }

      // ✅ Proof image is now guaranteed to exist and appended
      const proofFilename = proofImage.uri.split("/").pop();
      formData.append("proof_image", {
        uri: proofImage.uri,
        name: proofFilename || "proof.jpg",
        type: "image/jpeg",
      } as any);

      const res = await fetch(`${api}/api/create_progress_report/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submission failed.");

      Alert.alert("Success", "Progress report submitted successfully!", [
        { text: "OK", onPress: () => router.replace("/(tabs)/monitoring") },
      ]);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to submit report.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────
  if (loading || !detail) {
    return (
      <View
        style={[
          styles.container,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <ActivityIndicator size="large" color={PRIMARY} />
        <Text style={{ marginTop: 12, color: MUTED }}>Loading details…</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      {/* Compact Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.replace("/(tabs)/monitoring")}
        >
          <Ionicons name="chevron-back" size={22} color={INK} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {detail.application.title}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchDetail(true);
            }}
            tintColor={PRIMARY}
          />
        }
      >
        {/* Floating Progress Timeline */}
        <View style={styles.timelineWrapper}>
          <FloatingProgressTimeline status={detail.application.status} />
        </View>

        {/* Content Area */}
        <View style={styles.contentArea}>
          {/* ✅ Program Progress Summary Metrics */}
          <View style={styles.metricsSection}>
            <Text style={styles.metricsTitle}>Program Progress Summary</Text>
            <View style={styles.metricsGrid}>
              <View
                style={[
                  styles.metricCard,
                  { backgroundColor: "#EFF6FF", borderColor: "#DBEAFE" },
                ]}
              >
                <Ionicons name="cube-outline" size={24} color="#2563EB" />
                <Text style={[styles.metricValue, { color: "#1E40AF" }]}>
                  {totalSeedlingsProvided.toLocaleString()}
                </Text>
                <Text style={styles.metricLabel}>Seedlings Provided</Text>
              </View>
              <View
                style={[
                  styles.metricCard,
                  { backgroundColor: "#ECFDF5", borderColor: "#A7F3D0" },
                ]}
              >
                <Ionicons name="leaf-outline" size={24} color={SUCCESS} />
                <Text style={[styles.metricValue, { color: "#047857" }]}>
                  {totalEverPlanted.toLocaleString()}
                </Text>
                <Text style={styles.metricLabel}>Total Ever Planted</Text>
              </View>
              <View
                style={[
                  styles.metricCard,
                  { backgroundColor: "#F0FDF4", borderColor: "#86EFAC" },
                ]}
              >
                <Ionicons
                  name="checkmark-circle-outline"
                  size={24}
                  color={SUCCESS}
                />
                <Text style={[styles.metricValue, { color: "#047857" }]}>
                  {totalSurvived.toLocaleString()}
                </Text>
                <Text style={styles.metricLabel}>Total Survived</Text>
              </View>
              <View
                style={[
                  styles.metricCard,
                  {
                    backgroundColor: survivalColor.bg,
                    borderColor: survivalColor.border,
                  },
                ]}
              >
                <Ionicons
                  name="trending-up-outline"
                  size={24}
                  color={survivalColor.text}
                />
                <Text
                  style={[styles.metricValue, { color: survivalColor.text }]}
                >
                  {survivalRate}%
                </Text>
                <Text
                  style={[styles.metricLabel, { color: survivalColor.text }]}
                >
                  Survival Rate
                </Text>
              </View>
            </View>
          </View>

          {/* ── Application Info ── */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <SectionHeader title="APPLICATION" icon="document-text-outline" />
              <StatusBadge status={detail.application.status} />
            </View>
            <InfoRow
              icon="business-outline"
              label="Group"
              value={detail.group.group_name}
            />
            {detail.assigned_site && (
              <InfoRow
                icon="location-outline"
                label="Site"
                value={`${detail.assigned_site.name}, ${detail.assigned_site.barangay_name || "N/A"}`}
              />
            )}
            {detail.application.orientation_date && (
              <InfoRow
                icon="calendar-outline"
                label="Scheduled Orientation"
                value={formatDate(detail.application.orientation_date)}
              />
            )}
          </View>

          <SectionDivider />

          {/* ─ Grower Contact ── */}
          <View style={styles.section}>
            <SectionHeader title="GROWER CONTACT" icon="person-outline" />
            <View style={styles.inspectorRow}>
              <View style={styles.inspectorAvatar}>
                <Ionicons name="person" size={22} color={PRIMARY} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inspectorName}>
                  {detail.profile
                    ? `${detail.profile.first_name} ${detail.profile.last_name}`
                    : "Representative"}
                </Text>
                <Text style={styles.inspectorEmail} numberOfLines={1}>
                  {detail.group.group_type}
                </Text>
              </View>
            </View>

            {detail.profile?.contact || detail.group.group_contact ? (
              <View style={styles.actionButtonsRow}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() =>
                    Linking.openURL(
                      `tel:${detail.profile?.contact || detail.group.group_contact}`,
                    )
                  }
                >
                  <Ionicons name="call" size={18} color={PRIMARY} />
                  <Text style={styles.actionBtnText}>Call</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() =>
                    Linking.openURL(
                      `sms:${detail.profile?.contact || detail.group.group_contact}`,
                    )
                  }
                >
                  <Ionicons name="chatbubble" size={18} color={PRIMARY} />
                  <Text style={styles.actionBtnText}>Message</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.noContactText}>
                No contact number provided.
              </Text>
            )}
          </View>

          <SectionDivider />

          {/* ── Previous Reports History ── */}
          <View style={styles.section}>
            <SectionHeader title="REPORT HISTORY" icon="time-outline" />
            {detail.progress_reports.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="clipboard-outline" size={32} color={FAINT} />
                <Text style={styles.emptyText}>No reports submitted yet</Text>
              </View>
            ) : (
              detail.progress_reports.map((report) => (
                <View key={report.report_id} style={styles.reportCard}>
                  <View style={styles.reportHeader}>
                    <Text style={styles.reportDate}>
                      {formatDate(report.submitted_at)}
                    </Text>
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: "700",
                        color:
                          report.visit_type === "initial" ? PRIMARY : MUTED,
                        textTransform: "uppercase",
                      }}
                    >
                      {report.visit_type === "initial"
                        ? "Initial Visit"
                        : "Ongoing"}
                    </Text>
                  </View>
                  <View style={styles.reportStats}>
                    <View style={styles.reportStat}>
                      <Text style={styles.reportStatValue}>
                        {report.total_survived}
                      </Text>
                      <Text style={styles.reportStatLabel}>Survived</Text>
                    </View>
                    <View style={styles.reportDivider} />
                    <View style={styles.reportStat}>
                      <Text style={[styles.reportStatValue, { color: DANGER }]}>
                        {report.total_dead}
                      </Text>
                      <Text style={styles.reportStatLabel}>Dead</Text>
                    </View>
                  </View>
                  {report.description && (
                    <Text style={styles.reportDesc} numberOfLines={2}>
                      <Ionicons
                        name="document-text-outline"
                        size={12}
                        color={MUTED}
                      />{" "}
                      {report.description}
                    </Text>
                  )}
                </View>
              ))
            )}
          </View>

          <SectionDivider />

          {/* ── Submit New Report Form ── */}
          <View style={styles.section}>
            <SectionHeader
              title={
                isInitialVisit
                  ? "SUBMIT INITIAL REPORT"
                  : "SUBMIT ONGOING REPORT"
              }
              icon="create-outline"
            />

            {/* Initial Visit Specifics */}
            {isInitialVisit && (
              <>
                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => setOrientationConducted(!orientationConducted)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={orientationConducted ? "checkbox" : "square-outline"}
                    size={24}
                    color={PRIMARY}
                  />
                  <Text style={styles.checkboxLabel}>
                    I confirm that the orientation was conducted with the tree
                    growers.
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.uploadBox}
                  activeOpacity={0.7}
                  onPress={() => pickImage("agreement")}
                >
                  {agreementImage ? (
                    <Image
                      source={{ uri: agreementImage.uri }}
                      style={styles.uploadPreview}
                    />
                  ) : (
                    <>
                      <Ionicons
                        name="document-text-outline"
                        size={28}
                        color={FAINT}
                      />
                      <Text style={styles.uploadText}>
                        Upload Signed Agreement
                      </Text>
                      <Text style={styles.uploadSubtext}>
                        Tap to take or choose a photo
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}

            {/* Species Builder */}
            <Text style={styles.label}>Report by Species</Text>
            <View style={styles.speciesBuilderBox}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 12 }}
              >
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {allTreeSpecies.map((sp) => (
                    <TouchableOpacity
                      key={sp.tree_specie_id}
                      onPress={() =>
                        setSelectedSpeciesId(String(sp.tree_specie_id))
                      }
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 16,
                        backgroundColor:
                          selectedSpeciesId === String(sp.tree_specie_id)
                            ? PRIMARY
                            : WHITE,
                        borderWidth: 1,
                        borderColor:
                          selectedSpeciesId === String(sp.tree_specie_id)
                            ? PRIMARY
                            : BORDER,
                      }}
                    >
                      <Text
                        style={{
                          color:
                            selectedSpeciesId === String(sp.tree_specie_id)
                              ? WHITE
                              : INK,
                          fontSize: 12,
                          fontWeight: "600",
                        }}
                      >
                        {sp.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
                {isInitialVisit && (
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{ fontSize: 11, color: MUTED, marginBottom: 4 }}
                    >
                      Planted
                    </Text>
                    <TextInput
                      style={styles.input}
                      placeholder="0"
                      keyboardType="numeric"
                      value={tempPlanted}
                      onChangeText={setTempPlanted}
                    />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, color: MUTED, marginBottom: 4 }}>
                    Added
                  </Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0"
                    keyboardType="numeric"
                    value={tempAdded}
                    onChangeText={setTempAdded}
                  />
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, color: MUTED, marginBottom: 4 }}>
                    Survived
                  </Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0"
                    keyboardType="numeric"
                    value={tempSurvived}
                    onChangeText={setTempSurvived}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, color: MUTED, marginBottom: 4 }}>
                    Dead
                  </Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0"
                    keyboardType="numeric"
                    value={tempDead}
                    onChangeText={setTempDead}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.addSpeciesBtn,
                  { opacity: selectedSpeciesId ? 1 : 0.5 },
                ]}
                onPress={handleAddSpeciesToReport}
                disabled={!selectedSpeciesId}
              >
                <Ionicons name="add-circle" size={16} color={WHITE} />
                <Text style={styles.addSpeciesBtnText}>Add to Report</Text>
              </TouchableOpacity>
            </View>

            {reportSpeciesList.length > 0 && (
              <View style={{ marginBottom: 16 }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: INK,
                    marginBottom: 8,
                  }}
                >
                  Included Species ({reportSpeciesList.length})
                </Text>
                {reportSpeciesList.map((sp, idx) => (
                  <View key={idx} style={styles.addedSpeciesItem}>
                    <View>
                      <Text style={styles.addedSpeciesName}>
                        {sp.species_name}
                      </Text>
                      <Text style={styles.addedSpeciesCounts}>
                        {isInitialVisit && (
                          <Text style={{ color: PRIMARY }}>
                            Planted: {sp.no_planted} •{" "}
                          </Text>
                        )}
                        <Text style={{ color: SUCCESS }}>
                          Added: {sp.no_added_by_grower} •{" "}
                        </Text>
                        <Text style={{ color: SUCCESS }}>
                          Survived: {sp.no_survived} •{" "}
                        </Text>
                        <Text style={{ color: DANGER }}>
                          Dead: {sp.no_dead}
                        </Text>
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() =>
                        setReportSpeciesList(
                          reportSpeciesList.filter((_, i) => i !== idx),
                        )
                      }
                    >
                      <Ionicons name="close-circle" size={22} color={DANGER} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <Text style={styles.label}>Remarks / Notes</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Notes about plant condition, weather, etc..."
              multiline
              numberOfLines={3}
              value={description}
              onChangeText={setDescription}
            />

            {/* ✅ UPDATED: Added red asterisk to indicate it is required */}
            <Text style={styles.label}>
              Proof Image (Site Photo) <Text style={{ color: DANGER }}>*</Text>
            </Text>
            <TouchableOpacity
              style={styles.uploadBox}
              activeOpacity={0.7}
              onPress={() => pickImage("proof")}
            >
              {proofImage ? (
                <Image
                  source={{ uri: proofImage.uri }}
                  style={styles.uploadPreview}
                />
              ) : (
                <>
                  <Ionicons name="camera-outline" size={28} color={FAINT} />
                  <Text style={styles.uploadText}>Upload Group/Site Photo</Text>
                  <Text style={styles.uploadSubtext}>
                    Tap to take or choose a photo
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.submitBtn,
                {
                  opacity:
                    submitting || reportSpeciesList.length === 0 || !proofImage
                      ? 0.6
                      : 1,
                },
              ]}
              onPress={handleSubmitReport}
              disabled={
                submitting || reportSpeciesList.length === 0 || !proofImage
              }
              activeOpacity={0.8}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={WHITE} />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color={WHITE} />
                  <Text style={styles.submitBtnText}>Submit Report</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: BG,
  },
  backBtn: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: INK,
    letterSpacing: -0.3,
    flex: 1,
    textAlign: "center",
  },

  timelineWrapper: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: BG,
  },
  contentArea: {
    backgroundColor: WHITE,
    paddingHorizontal: 20,
    paddingTop: 8,
    minHeight: SCREEN_WIDTH,
  },

  // ✅ Metrics Section
  metricsSection: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: WHITE,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  metricsTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: PRIMARY,
    marginBottom: 12,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metricCard: {
    width: "48%", // was: flex: 1, minWidth: "45%"
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  metricValue: {
    fontSize: 22,
    fontWeight: "800",
    marginTop: 4,
  },
  metricLabel: {
    fontSize: 10,
    color: MUTED,
    fontWeight: "600",
    marginTop: 2,
    textAlign: "center",
  },

  section: { paddingVertical: 20 },
  divider: { height: 1, backgroundColor: BORDER, marginHorizontal: -20 },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 10,
  },
  infoLabel: {
    fontSize: 11,
    color: MUTED,
    fontWeight: "600",
    marginBottom: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  infoValue: { fontSize: 15, color: INK, fontWeight: "600", lineHeight: 20 },

  inspectorRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  inspectorAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F0FDF4",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  inspectorName: { fontSize: 16, fontWeight: "700", color: INK },
  inspectorEmail: { fontSize: 13, color: MUTED, marginTop: 2 },

  actionButtonsRow: { flexDirection: "row", gap: 12 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#F0FDF4",
    gap: 8,
    borderWidth: 1,
    borderColor: "#DCFCE7",
  },
  actionBtnText: { fontSize: 14, fontWeight: "700", color: PRIMARY },
  noContactText: { fontSize: 13, color: MUTED, fontStyle: "italic" },

  emptyBox: {
    alignItems: "center",
    padding: 24,
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    marginBottom: 16,
  },
  emptyText: { marginTop: 8, color: MUTED, fontSize: 13 },

  reportCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  reportHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  reportDate: { fontSize: 12, color: MUTED },
  reportStats: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  reportStat: { flex: 1, alignItems: "center" },
  reportStatValue: { fontSize: 16, fontWeight: "800", color: PRIMARY },
  reportStatLabel: { fontSize: 10, color: MUTED, marginTop: 2 },
  reportDivider: { width: 1, height: 28, backgroundColor: BORDER },
  reportDesc: { fontSize: 12, color: MUTED, lineHeight: 16, marginTop: 6 },

  checkboxRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 16,
    padding: 12,
    backgroundColor: "#F0FDF4",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DCFCE7",
  },
  checkboxLabel: {
    fontSize: 14,
    color: INK,
    fontWeight: "500",
    flex: 1,
    lineHeight: 20,
  },

  label: {
    fontSize: 13,
    fontWeight: "600",
    color: INK,
    marginBottom: 6,
    marginTop: 16,
  },
  input: {
    backgroundColor: WHITE,
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: INK,
  },
  textArea: { height: 90, textAlignVertical: "top" },

  speciesBuilderBox: {
    backgroundColor: "#F9FAFB",
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  addSpeciesBtn: {
    flexDirection: "row",
    backgroundColor: PRIMARY,
    padding: 10,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  addSpeciesBtnText: { color: WHITE, fontWeight: "700", fontSize: 13 },

  addedSpeciesItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    backgroundColor: "#F0FDF4",
    padding: 10,
    borderRadius: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "#DCFCE7",
  },
  addedSpeciesName: {
    fontSize: 13,
    fontWeight: "600",
    color: INK,
    marginBottom: 4,
  },
  addedSpeciesCounts: { fontSize: 11, color: MUTED, lineHeight: 16 },

  uploadBox: {
    borderWidth: 1.5,
    borderColor: BORDER,
    borderStyle: "dashed",
    borderRadius: 14,
    minHeight: 120,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: WHITE,
    overflow: "hidden",
    marginTop: 8,
  },
  uploadPreview: { width: "100%", height: 160, borderRadius: 12 },
  uploadText: { fontSize: 14, fontWeight: "700", color: MUTED, marginTop: 8 },
  uploadSubtext: { fontSize: 12, color: FAINT, marginTop: 2 },

  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PRIMARY,
    borderRadius: 14,
    paddingVertical: 16,
    gap: 8,
    marginTop: 24,
    shadowColor: PRIMARY,
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  submitBtnText: { color: WHITE, fontWeight: "800", fontSize: 16 },
});

const badgeStyles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 5,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});

const floatTimelineStyles = StyleSheet.create({
  container: { alignItems: "center" },
  card: {
    backgroundColor: WHITE,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  scroll: {
    flexGrow: 1,
    justifyContent: "center", // or "space-between" for edge-to-edge spread
    alignItems: "center",
    paddingRight: 4,
  },
  stepContainer: {
    flexDirection: "column",
    alignItems: "center",
    marginRight: 2,
    width: 80,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  iconCircleActive: { backgroundColor: PRIMARY },
  iconCircleCurrent: {
    backgroundColor: PRIMARY,
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: "#BBF7D0",
  },
  stepLabel: {
    fontSize: 9,
    color: "#D1D5DB",
    fontWeight: "600",
    textAlign: "center",
    width: 80,
    lineHeight: 12,
  },
  stepLabelActive: { color: INK, fontWeight: "700" },
  stepLabelCurrent: { color: PRIMARY, fontWeight: "800" },
  connector: {
    position: "absolute",
    top: 16,
    left: 58,
    width: 44,
    height: 2,
    backgroundColor: "#E5E7EB",
  },
  connectorActive: { backgroundColor: PRIMARY },
});
