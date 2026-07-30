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
  Modal,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/constants/url_fixed";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const PRIMARY = "#0F4A2F";
const SUCCESS = "#16A34A";
const DANGER = "#DC2626";
const WARNING = "#D97706";
const INFO = "#2563EB";
const INK = "#111827";
const MUTED = "#6B7280";
const FAINT = "#9CA3AF";
const WHITE = "#FFFFFF";
const BG = "#F4F7F5";
const BORDER = "#E5E7EB";

// ─── Types ─────────────────────────────────────────────────────────────────
interface ProgressReportSpeciesItem {
  species_id: number;
  species_name: string;
  no_planted: number;
  no_added_by_grower: number;
  no_survived: number;
  no_dead: number;
}

interface ProgressReport {
  report_id: number;
  visit_type: "initial" | "ongoing";
  orientation_conducted: boolean;
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
    species: { species_id: number; species_name: string; quantity: number }[];
    status: "pending" | "accepted" | "rejected";
    reason_accepted: string | null;
    submitted_at: string | null;
  }>;
  progress_reports: ProgressReport[];
}

type TreeSpeciesOption = {
  tree_specie_id: number;
  name: string;
};

type ReportSpeciesItem = {
  tree_species_id: number;
  species_name: string;
  no_planted: number;
  no_added_by_grower: number;
  no_dead: number;
};

type SpeciesBreakdown = {
  tree_species_id: number;
  species_name: string;
  officially_planted: number;
  total_added: number;
  total_dead: number;
  calculated_survived: number;
  survival_rate: number;
};

const formatDate = (iso: string | null) =>
  !iso
    ? "—"
    : new Date(iso).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

// ── Components ───────────────────────────────────────────────────────────
const StatusBadge = ({ status }: { status: string }) => {
  const config: Record<string, { label: string; bg: string; text: string }> = {
    accepted: { label: "Needs Orientation", bg: "#DBEAFE", text: "#1E40AF" },
    under_monitoring: {
      label: "Under Monitoring",
      bg: "#DCFCE7",
      text: "#166534",
    },
    completed: { label: "Completed", bg: "#F0FDF4", text: "#15803D" },
  };
  const conf = config[status] || {
    label: status,
    bg: "#F3F4F6",
    text: "#374151",
  };
  return (
    <View style={[badgeStyles.wrap, { backgroundColor: conf.bg }]}>
      <View style={[badgeStyles.dot, { backgroundColor: conf.text }]} />
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

// ── Main Component ───────────────────────────────────────────────────────
export default function MonitoringDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [detail, setDetail] = useState<ApplicationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal States
  const [showSpeciesModal, setShowSpeciesModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

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
  const [tempDead, setTempDead] = useState("");

  const [description, setDescription] = useState("");
  const [proofImage, setProofImage] =
    useState<ImagePicker.ImagePickerAsset | null>(null);

  const isInitialVisit = detail?.application.status === "accepted";

  const hasPendingReport =
    detail?.progress_reports.some((r) => r.status === "pending") || false;
  const pendingReport = detail?.progress_reports.find(
    (r) => r.status === "pending",
  );

  // ── Fetch Data ──────────────────────────────────────────────────────────
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

  // ── ✅ FIXED PER-SPECIES BREAKDOWN CALCULATION ─────────────────────
  const calculateSpeciesBreakdown = (): SpeciesBreakdown[] => {
    const acceptedReports =
      detail?.progress_reports.filter((r) => r.status === "accepted") || [];

    const sortedReports = [...acceptedReports].sort(
      (a, b) =>
        new Date(b.submitted_at || 0).getTime() -
        new Date(a.submitted_at || 0).getTime(),
    );

    const initialReport = sortedReports.find((r) => r.visit_type === "initial");
    const ongoingReports = sortedReports.filter(
      (r) => r.visit_type === "ongoing",
    );

    const allSpeciesIds = new Set<number>();
    const speciesNameMap = new Map<number, string>();

    sortedReports.forEach((report) => {
      report.species.forEach((sp) => {
        allSpeciesIds.add(sp.species_id);
        speciesNameMap.set(sp.species_id, sp.species_name);
      });
    });

    const breakdown: SpeciesBreakdown[] = [];

    allSpeciesIds.forEach((speciesId) => {
      const speciesName = speciesNameMap.get(speciesId) || "Unknown";

      const initialSpecies = initialReport?.species.find(
        (sp) => sp.species_id === speciesId,
      );
      const officially_planted = initialSpecies?.no_planted || 0;

      let total_added = 0;
      sortedReports.forEach((report) => {
        const speciesInReport = report.species.find(
          (sp) => sp.species_id === speciesId,
        );
        total_added += speciesInReport?.no_added_by_grower || 0;
      });

      let total_dead = 0;
      for (let i = 0; i < ongoingReports.length; i++) {
        const speciesInReport = ongoingReports[i].species.find(
          (sp) => sp.species_id === speciesId,
        );
        if (speciesInReport) {
          total_dead = speciesInReport.no_dead;
          break;
        }
      }
      if (total_dead === 0 && initialSpecies) {
        total_dead = initialSpecies.no_dead || 0;
      }

      const total_accounted = officially_planted + total_added;
      const calculated_survived = Math.max(0, total_accounted - total_dead);

      const survival_rate =
        total_accounted > 0 ? (calculated_survived / total_accounted) * 100 : 0;

      breakdown.push({
        tree_species_id: speciesId,
        species_name: speciesName,
        officially_planted,
        total_added,
        total_dead,
        calculated_survived,
        survival_rate,
      });
    });

    return breakdown;
  };

  const speciesBreakdown = calculateSpeciesBreakdown();

  // ── ✅ FIXED OVERALL METRICS ───────────────────────────────────────────
  const acceptedSeedlingRequests =
    detail?.seedling_requests.filter((r) => r.status === "accepted") || [];
  const allProgressReports =
    detail?.progress_reports.filter((r) => r.status === "accepted") || [];

  const sortedAcceptedReports = [...allProgressReports].sort(
    (a, b) =>
      new Date(b.submitted_at || 0).getTime() -
      new Date(a.submitted_at || 0).getTime(),
  );

  const initialReport = sortedAcceptedReports.find(
    (r) => r.visit_type === "initial",
  );
  const latestReport =
    sortedAcceptedReports.length > 0 ? sortedAcceptedReports[0] : null;

  const totalProvided = acceptedSeedlingRequests.reduce((sum, req) => {
    return (
      sum + (req.species?.reduce((sSum, sp) => sSum + sp.quantity, 0) || 0)
    );
  }, 0);

  const totalOfficiallyPlanted =
    initialReport?.species.reduce((sum, sp) => sum + sp.no_planted, 0) || 0;

  const totalAdded = speciesBreakdown.reduce(
    (sum, sp) => sum + sp.total_added,
    0,
  );

  // ✅ NEW: Total Planted Calculation
  const totalPlanted = totalOfficiallyPlanted + totalAdded;

  const totalDead =
    latestReport?.species.reduce((sum, sp) => sum + sp.no_dead, 0) || 0;

  const totalAccounted = totalPlanted; // Same as totalPlanted
  const totalSurvived = Math.max(0, totalAccounted - totalDead);
  const overallSurvivalRate =
    totalAccounted > 0 ? (totalSurvived / totalAccounted) * 100 : 0;
  const remainingToPlant = Math.max(0, totalProvided - totalOfficiallyPlanted);

  // ─── ✅ NEW: HISTORICAL CONTEXT HELPER ───────────────────────────────────
  const historicalPlantedMap = new Map<number, number>();
  if (initialReport) {
    initialReport.species.forEach((sp) => {
      historicalPlantedMap.set(sp.species_id, sp.no_planted);
    });
  }

  const getHistoricallyPlanted = (speciesId: number): number => {
    return historicalPlantedMap.get(speciesId) || 0;
  };

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
      const options: any = { quality: 0.7, allowsEditing: true };
      let result;
      if (source === "camera") {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted)
          return Alert.alert("Permission Needed", "Camera access is required.");
        result = await ImagePicker.launchCameraAsync(options);
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted)
          return Alert.alert(
            "Permission Needed",
            "Photo library access is required.",
          );
        result = await ImagePicker.launchImageLibraryAsync({
          ...options,
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
        });
      }
      if (!result.canceled && result.assets?.[0]) {
        type === "proof"
          ? setProofImage(result.assets[0])
          : setAgreementImage(result.assets[0]);
      }
    } catch (err) {
      Alert.alert("Error", "Something went wrong selecting the image.");
    }
  };

  // ─── ✅ FIXED Form Handlers ──────────────────────────────────────────────
  const handleAddSpeciesToReport = () => {
    if (!selectedSpeciesId)
      return Alert.alert("Missing Species", "Please select a tree species.");

    const found = allTreeSpecies.find(
      (s) => s.tree_specie_id === Number(selectedSpeciesId),
    );
    if (!found) return;

    const historicalPlanted = getHistoricallyPlanted(found.tree_specie_id);

    const added = isInitialVisit ? 0 : parseInt(tempAdded) || 0;
    const dead = parseInt(tempDead) || 0;

    const totalAccounted = isInitialVisit
      ? parseInt(tempPlanted) || 0
      : historicalPlanted + added;

    if (dead > totalAccounted) {
      return Alert.alert(
        "Invalid Count",
        `Dead count (${dead}) cannot exceed total trees (${totalAccounted}). Please check your numbers.`,
      );
    }

    const survived = totalAccounted - dead;

    const existingIndex = reportSpeciesList.findIndex(
      (s) => s.tree_species_id === found.tree_specie_id,
    );

    const storedPlanted = isInitialVisit ? parseInt(tempPlanted) || 0 : 0;
    const storedAdded = isInitialVisit ? 0 : added;

    if (existingIndex >= 0) {
      const updatedList = [...reportSpeciesList];
      updatedList[existingIndex] = {
        ...updatedList[existingIndex],
        no_planted: storedPlanted,
        no_added_by_grower: storedAdded,
        no_dead: dead,
      };
      setReportSpeciesList(updatedList);
    } else {
      setReportSpeciesList([
        ...reportSpeciesList,
        {
          tree_species_id: found.tree_specie_id,
          species_name: found.name,
          no_planted: storedPlanted,
          no_added_by_grower: storedAdded,
          no_dead: dead,
        },
      ]);
    }

    setSelectedSpeciesId("");
    setTempPlanted("");
    setTempAdded("");
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

      const formattedSpecies = reportSpeciesList.map((sp) => {
        const historicalPlanted = getHistoricallyPlanted(sp.tree_species_id);
        const totalAccounted = isInitialVisit
          ? sp.no_planted
          : historicalPlanted + sp.no_added_by_grower;

        const survived = Math.max(0, totalAccounted - sp.no_dead);

        return {
          tree_species_id: sp.tree_species_id,
          no_planted: sp.no_planted,
          no_added_by_grower: sp.no_added_by_grower,
          no_survived: survived,
          no_dead: sp.no_dead,
        };
      });

      formData.append("report_species", JSON.stringify(formattedSpecies));
      formData.append("description", description);

      if (isInitialVisit && agreementImage) {
        const filename = agreementImage.uri.split("/").pop();
        formData.append("agreement_image", {
          uri: agreementImage.uri,
          name: filename || "agreement.jpg",
          type: "image/jpeg",
        } as any);
      }

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
        {
          text: "OK",
          onPress: () => {
            setReportSpeciesList([]);
            setDescription("");
            setProofImage(null);
            setAgreementImage(null);
            setOrientationConducted(false);
            setTempPlanted("");
            setTempAdded("");
            setTempDead("");
            setSelectedSpeciesId("");
            fetchDetail(true);
          },
        },
      ]);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to submit report.");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedHistoricalPlanted = getHistoricallyPlanted(
    Number(selectedSpeciesId),
  );
  const currentAdded = isInitialVisit ? 0 : parseInt(tempAdded) || 0;
  const currentDead = parseInt(tempDead) || 0;

  const currentTotalAccounted = isInitialVisit
    ? parseInt(tempPlanted) || 0
    : selectedHistoricalPlanted + currentAdded;

  const currentSurvived = Math.max(0, currentTotalAccounted - currentDead);
  const hasValidationError =
    currentDead > currentTotalAccounted && currentTotalAccounted > 0;

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
        <View style={styles.timelineWrapper}>
          <FloatingProgressTimeline status={detail.application.status} />
        </View>

        <View style={styles.contentArea}>
          {/* Overall Summary */}
          <View style={styles.metricsSection}>
            <Text style={styles.metricsTitle}>Overall Program Summary</Text>
            <View style={styles.metricsGrid}>
              <View
                style={[
                  styles.metricCard,
                  { backgroundColor: "#EFF6FF", borderColor: "#DBEAFE" },
                ]}
              >
                <Ionicons name="cube-outline" size={24} color={INFO} />
                <Text style={[styles.metricValue, { color: "#1E40AF" }]}>
                  {totalProvided.toLocaleString()}
                </Text>
                <Text style={styles.metricLabel}>Total Provided</Text>
              </View>
              <View
                style={[
                  styles.metricCard,
                  { backgroundColor: "#F0FDF4", borderColor: "#86EFAC" },
                ]}
              >
                <Ionicons name="leaf-outline" size={24} color={SUCCESS} />
                <Text style={[styles.metricValue, { color: "#047857" }]}>
                  {totalOfficiallyPlanted.toLocaleString()}
                </Text>
                <Text style={styles.metricLabel}>Officially Planted</Text>
              </View>

              {/* ✅ NEW: Total Planted Card */}
              <View
                style={[
                  styles.metricCard,
                  { backgroundColor: "#F5F3FF", borderColor: "#DDD6FE" },
                ]}
              >
                <Ionicons name="tree" size={24} color="#7C3AED" />
                <Text style={[styles.metricValue, { color: "#6D28D9" }]}>
                  {totalPlanted.toLocaleString()}
                </Text>
                <Text style={styles.metricLabel}>Total Planted</Text>
              </View>

              <View
                style={[
                  styles.metricCard,
                  { backgroundColor: "#ECFDF5", borderColor: "#A7F3D0" },
                ]}
              >
                <Ionicons name="add-circle-outline" size={24} color={SUCCESS} />
                <Text style={[styles.metricValue, { color: "#047857" }]}>
                  {totalAdded.toLocaleString()}
                </Text>
                <Text style={styles.metricLabel}>Added by Grower</Text>
              </View>

              {remainingToPlant > 0 && (
                <View
                  style={[
                    styles.metricCard,
                    { backgroundColor: "#FEF3C7", borderColor: "#FCD34D" },
                  ]}
                >
                  <Ionicons
                    name="alert-circle-outline"
                    size={24}
                    color={WARNING}
                  />
                  <Text style={[styles.metricValue, { color: "#B45309" }]}>
                    {remainingToPlant.toLocaleString()}
                  </Text>
                  <Text style={styles.metricLabel}>Remaining</Text>
                </View>
              )}
            </View>

            <View style={styles.subMetricsRow}>
              <Text style={styles.subMetricText}>
                <Ionicons name="checkmark-circle" size={12} color={SUCCESS} />{" "}
                Survived:{" "}
                <Text style={{ fontWeight: "700" }}>{totalSurvived}</Text>
              </Text>
              <Text style={styles.subMetricText}>
                <Ionicons name="close-circle" size={12} color={DANGER} /> Dead:{" "}
                <Text style={{ fontWeight: "700" }}>{totalDead}</Text>
              </Text>
              <Text
                style={[
                  styles.subMetricText,
                  {
                    color:
                      overallSurvivalRate >= 80
                        ? SUCCESS
                        : overallSurvivalRate >= 50
                          ? WARNING
                          : DANGER,
                  },
                ]}
              >
                <Ionicons name="trending-up" size={12} /> Rate:{" "}
                <Text style={{ fontWeight: "800" }}>
                  {overallSurvivalRate.toFixed(1)}%
                </Text>
              </Text>
            </View>
          </View>

          {/* Quick Action Cards */}
          <View style={styles.quickActionsContainer}>
            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => setShowSpeciesModal(true)}
              activeOpacity={0.7}
            >
              <View style={styles.quickActionIcon}>
                <Ionicons name="analytics" size={24} color={PRIMARY} />
              </View>
              <View style={styles.quickActionText}>
                <Text style={styles.quickActionTitle}>Species Breakdown</Text>
                <Text style={styles.quickActionSubtitle}>
                  {speciesBreakdown.length} species tracked
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={MUTED} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => setShowHistoryModal(true)}
              activeOpacity={0.7}
            >
              <View style={styles.quickActionIcon}>
                <Ionicons name="time" size={24} color={PRIMARY} />
              </View>
              <View style={styles.quickActionText}>
                <Text style={styles.quickActionTitle}>Report History</Text>
                <Text style={styles.quickActionSubtitle}>
                  {detail.progress_reports.length} reports submitted
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={MUTED} />
            </TouchableOpacity>
          </View>

          <SectionDivider />

          {/* Application Info */}
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

          {/* CONDITIONAL: Submit Form OR Pending Alert */}
          <View style={styles.section}>
            <SectionHeader
              title={
                isInitialVisit
                  ? "SUBMIT INITIAL REPORT"
                  : "SUBMIT ONGOING REPORT"
              }
              icon="create-outline"
            />

            {hasPendingReport ? (
              <View style={styles.pendingAlertBox}>
                <View style={styles.pendingAlertIcon}>
                  <Ionicons name="time-outline" size={32} color={WARNING} />
                </View>
                <Text style={styles.pendingAlertTitle}>
                  Report Pending Review
                </Text>
                <Text style={styles.pendingAlertText}>
                  You have already submitted a{" "}
                  <Text style={{ fontWeight: "700" }}>
                    {pendingReport?.visit_type === "initial"
                      ? "Initial Orientation"
                      : "Ongoing Monitoring"}
                  </Text>{" "}
                  report on{" "}
                  <Text style={{ fontWeight: "600" }}>
                    {formatDate(pendingReport?.submitted_at)}
                  </Text>
                  .
                </Text>

                {pendingReport && (
                  <View style={styles.pendingDetailsBox}>
                    <Text style={styles.pendingDetailsTitle}>
                      Pending Report Details:
                    </Text>
                    <View style={styles.pendingDetailRow}>
                      <Text style={styles.pendingDetailLabel}>Visit Type:</Text>
                      <Text style={styles.pendingDetailValue}>
                        {pendingReport.visit_type === "initial"
                          ? "Initial Orientation"
                          : "Ongoing Monitoring"}
                      </Text>
                    </View>
                    <View style={styles.pendingDetailRow}>
                      <Text style={styles.pendingDetailLabel}>Species:</Text>
                      <Text style={styles.pendingDetailValue}>
                        {pendingReport.species.length} species
                      </Text>
                    </View>
                    <View style={styles.pendingDetailRow}>
                      <Text style={styles.pendingDetailLabel}>
                        Total Survived:
                      </Text>
                      <Text style={styles.pendingDetailValue}>
                        {pendingReport.total_survived}
                      </Text>
                    </View>
                    <View style={styles.pendingDetailRow}>
                      <Text style={styles.pendingDetailLabel}>Total Dead:</Text>
                      <Text
                        style={[styles.pendingDetailValue, { color: DANGER }]}
                      >
                        {pendingReport.total_dead}
                      </Text>
                    </View>
                  </View>
                )}

                <Text style={styles.pendingAlertFooter}>
                  Please wait for the Data Manager to review and approve your
                  report before submitting a new one.
                </Text>
              </View>
            ) : (
              <>
                {isInitialVisit && (
                  <>
                    <TouchableOpacity
                      style={styles.checkboxRow}
                      onPress={() =>
                        setOrientationConducted(!orientationConducted)
                      }
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={
                          orientationConducted ? "checkbox" : "square-outline"
                        }
                        size={24}
                        color={PRIMARY}
                      />
                      <Text style={styles.checkboxLabel}>
                        I confirm that the orientation was conducted with the
                        tree growers.
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

                <Text style={styles.label}>Report by Species</Text>
                <View style={styles.speciesBuilderBox}>
                  <Text style={styles.subLabel}>1. Select Species</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ marginBottom: 12 }}
                  >
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      {allTreeSpecies.map((sp) => (
                        <TouchableOpacity
                          key={sp.tree_specie_id}
                          onPress={() => {
                            setSelectedSpeciesId(String(sp.tree_specie_id));
                            const existing = reportSpeciesList.find(
                              (s) => s.tree_species_id === sp.tree_specie_id,
                            );
                            if (existing) {
                              setTempPlanted(String(existing.no_planted));
                              setTempAdded(String(existing.no_added_by_grower));
                              setTempDead(String(existing.no_dead));
                            } else {
                              setTempPlanted("");
                              setTempAdded("");
                              setTempDead("");
                            }
                          }}
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

                  <Text style={styles.subLabel}>2. Enter Counts</Text>

                  {!isInitialVisit && selectedSpeciesId && (
                    <View style={styles.historicalContextBox}>
                      <Ionicons
                        name="information-circle-outline"
                        size={14}
                        color={INFO}
                      />
                      <Text style={styles.historicalContextText}>
                        Previously Planted:{" "}
                        <Text style={{ fontWeight: "700", color: INK }}>
                          {selectedHistoricalPlanted}
                        </Text>
                      </Text>
                    </View>
                  )}

                  <View
                    style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}
                  >
                    {isInitialVisit ? (
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontSize: 11,
                            color: MUTED,
                            marginBottom: 4,
                          }}
                        >
                          Officially Planted *
                        </Text>
                        <TextInput
                          style={styles.input}
                          placeholder="0"
                          keyboardType="numeric"
                          value={tempPlanted}
                          onChangeText={setTempPlanted}
                        />
                      </View>
                    ) : (
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontSize: 11,
                            color: MUTED,
                            marginBottom: 4,
                          }}
                        >
                          Added by Grower
                        </Text>
                        <TextInput
                          style={styles.input}
                          placeholder="0"
                          keyboardType="numeric"
                          value={tempAdded}
                          onChangeText={setTempAdded}
                        />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{ fontSize: 11, color: MUTED, marginBottom: 4 }}
                      >
                        Dead *
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

                  <View
                    style={[
                      styles.calculationPreview,
                      hasValidationError && styles.calculationPreviewError,
                    ]}
                  >
                    <Text style={styles.calculationLabel}>
                      Calculated Survived:
                    </Text>
                    <Text
                      style={[
                        styles.calculationValue,
                        hasValidationError && styles.calculationValueError,
                      ]}
                    >
                      {currentSurvived}
                    </Text>
                    {hasValidationError && (
                      <Text style={styles.validationError}>
                        ⚠️ Dead count exceeds total trees!
                      </Text>
                    )}
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.addSpeciesBtn,
                      {
                        opacity:
                          selectedSpeciesId && !hasValidationError ? 1 : 0.5,
                      },
                    ]}
                    onPress={handleAddSpeciesToReport}
                    disabled={!selectedSpeciesId || hasValidationError}
                  >
                    <Ionicons
                      name={
                        reportSpeciesList.some(
                          (s) =>
                            s.tree_species_id === Number(selectedSpeciesId),
                        )
                          ? "refresh"
                          : "add-circle"
                      }
                      size={16}
                      color={WHITE}
                    />
                    <Text style={styles.addSpeciesBtnText}>
                      {reportSpeciesList.some(
                        (s) => s.tree_species_id === Number(selectedSpeciesId),
                      )
                        ? "Update Species"
                        : "Add to Report"}
                    </Text>
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
                      Reported Species ({reportSpeciesList.length})
                    </Text>
                    {reportSpeciesList.map((sp, idx) => {
                      const hist = getHistoricallyPlanted(sp.tree_species_id);
                      const total = isInitialVisit
                        ? sp.no_planted
                        : hist + sp.no_added_by_grower;
                      const survived = Math.max(0, total - sp.no_dead);

                      return (
                        <View key={idx} style={styles.addedSpeciesItem}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.addedSpeciesName}>
                              {sp.species_name}
                            </Text>
                            <View
                              style={{
                                flexDirection: "row",
                                flexWrap: "wrap",
                                gap: 8,
                              }}
                            >
                              {isInitialVisit && sp.no_planted > 0 && (
                                <Text style={styles.countBadgePrimary}>
                                  Planted: {sp.no_planted}
                                </Text>
                              )}
                              {!isInitialVisit && hist > 0 && (
                                <Text style={styles.countBadge}>
                                  Prev: {hist}
                                </Text>
                              )}
                              {sp.no_added_by_grower > 0 && (
                                <Text style={styles.countBadge}>
                                  Added: {sp.no_added_by_grower}
                                </Text>
                              )}
                              <Text style={styles.countBadgeSuccess}>
                                Survived: {survived}
                              </Text>
                              <Text style={styles.countBadgeDanger}>
                                Dead: {sp.no_dead}
                              </Text>
                            </View>
                          </View>
                          <TouchableOpacity
                            onPress={() =>
                              setReportSpeciesList(
                                reportSpeciesList.filter((_, i) => i !== idx),
                              )
                            }
                          >
                            <Ionicons
                              name="trash-outline"
                              size={20}
                              color={DANGER}
                            />
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                )}

                <Text style={styles.label}>Remarks / Notes</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Notes about plant condition, weather, missing seedlings, etc..."
                  multiline
                  numberOfLines={3}
                  value={description}
                  onChangeText={setDescription}
                />

                <Text style={styles.label}>
                  Proof Image (Site Photo){" "}
                  <Text style={{ color: DANGER }}>*</Text>
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
                      <Text style={styles.uploadText}>
                        Upload Group/Site Photo
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.submitBtn,
                    {
                      opacity:
                        submitting ||
                        reportSpeciesList.length === 0 ||
                        !proofImage
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
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color={WHITE}
                      />
                      <Text style={styles.submitBtnText}>Submit Report</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>

      {/* ✅ SPECIES BREAKDOWN MODAL */}
      <Modal
        visible={showSpeciesModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSpeciesModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Species Breakdown</Text>
              <TouchableOpacity onPress={() => setShowSpeciesModal(false)}>
                <Ionicons name="close" size={24} color={INK} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScrollView}>
              {speciesBreakdown.length === 0 ? (
                <View style={styles.emptySpeciesBox}>
                  <Ionicons name="leaf-outline" size={32} color={FAINT} />
                  <Text style={styles.emptyText}>
                    No species data available yet
                  </Text>
                </View>
              ) : (
                speciesBreakdown.map((sp) => (
                  <View
                    key={sp.tree_species_id}
                    style={styles.modalSpeciesCard}
                  >
                    <View style={styles.speciesHeader}>
                      <Text style={styles.speciesName}>{sp.species_name}</Text>
                      <View
                        style={[
                          styles.survivalBadge,
                          {
                            backgroundColor:
                              sp.survival_rate >= 80
                                ? "#DCFCE7"
                                : sp.survival_rate >= 50
                                  ? "#FEF3C7"
                                  : "#FEE2E2",
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.survivalRate,
                            {
                              color:
                                sp.survival_rate >= 80
                                  ? SUCCESS
                                  : sp.survival_rate >= 50
                                    ? WARNING
                                    : DANGER,
                            },
                          ]}
                        >
                          {sp.survival_rate.toFixed(1)}%
                        </Text>
                      </View>
                    </View>
                    <View style={styles.speciesStats}>
                      <View style={styles.statRow}>
                        <Text style={styles.statLabel}>
                          Officially Planted:
                        </Text>
                        <Text style={styles.statValue}>
                          {sp.officially_planted}
                        </Text>
                      </View>
                      <View style={styles.statRow}>
                        <Text style={styles.statLabel}>Added by Grower:</Text>
                        <Text style={styles.statValue}>{sp.total_added}</Text>
                      </View>
                      <View style={styles.statRow}>
                        <Text style={styles.statLabel}>Total Dead:</Text>
                        <Text style={[styles.statValue, { color: DANGER }]}>
                          {sp.total_dead}
                        </Text>
                      </View>
                      <View style={[styles.statRow, styles.survivedRow]}>
                        <Text style={[styles.statLabel, { fontWeight: "700" }]}>
                          Calculated Survived:
                        </Text>
                        <Text
                          style={[
                            styles.statValue,
                            { fontWeight: "800", color: SUCCESS },
                          ]}
                        >
                          {sp.calculated_survived}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ✅ REPORT HISTORY MODAL */}
      <Modal
        visible={showHistoryModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowHistoryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Report History</Text>
              <TouchableOpacity onPress={() => setShowHistoryModal(false)}>
                <Ionicons name="close" size={24} color={INK} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScrollView}>
              {detail.progress_reports.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Ionicons name="clipboard-outline" size={32} color={FAINT} />
                  <Text style={styles.emptyText}>No reports submitted yet</Text>
                </View>
              ) : (
                detail.progress_reports.map((report) => (
                  <View key={report.report_id} style={styles.modalReportCard}>
                    <View style={styles.reportHeader}>
                      <Text style={styles.reportDate}>
                        {formatDate(report.submitted_at)}
                      </Text>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <Text
                          style={[
                            styles.reportType,
                            {
                              color:
                                report.visit_type === "initial"
                                  ? PRIMARY
                                  : MUTED,
                            },
                          ]}
                        >
                          {report.visit_type === "initial"
                            ? "Initial"
                            : "Ongoing"}
                        </Text>
                        {report.status === "pending" && (
                          <View style={styles.pendingBadge}>
                            <Text style={styles.pendingBadgeText}>Pending</Text>
                          </View>
                        )}
                      </View>
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
                        <Text
                          style={[styles.reportStatValue, { color: DANGER }]}
                        >
                          {report.total_dead}
                        </Text>
                        <Text style={styles.reportStatLabel}>Dead</Text>
                      </View>
                    </View>

                    {report.species && report.species.length > 0 && (
                      <View style={styles.speciesBreakdown}>
                        {report.species.map((sp, idx) => (
                          <View key={idx} style={styles.speciesBreakdownRow}>
                            <Text style={styles.speciesBreakdownName}>
                              {sp.species_name}
                            </Text>
                            <View style={styles.speciesBreakdownStats}>
                              {sp.no_planted > 0 && (
                                <Text style={styles.statBadgePlanted}>
                                  P: {sp.no_planted}
                                </Text>
                              )}
                              {sp.no_added_by_grower > 0 && (
                                <Text style={styles.statBadgeAdded}>
                                  A: {sp.no_added_by_grower}
                                </Text>
                              )}
                              <Text style={styles.statBadgeSurvived}>
                                S: {sp.no_survived}
                              </Text>
                              <Text style={styles.statBadgeDead}>
                                D: {sp.no_dead}
                              </Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    )}

                    {report.description && (
                      <Text style={styles.reportDesc}>
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
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  contentArea: { backgroundColor: WHITE, paddingHorizontal: 20, paddingTop: 8 },

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
  metricsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metricCard: {
    width: "48%",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  metricValue: { fontSize: 22, fontWeight: "800", marginTop: 4 },
  metricLabel: {
    fontSize: 10,
    color: MUTED,
    fontWeight: "600",
    marginTop: 2,
    textAlign: "center",
  },
  subMetricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  subMetricText: { fontSize: 11, color: MUTED, fontWeight: "500" },

  quickActionsContainer: {
    gap: 12,
    marginBottom: 20,
  },
  quickActionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: WHITE,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F0FDF4",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  quickActionText: { flex: 1 },
  quickActionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: INK,
    marginBottom: 2,
  },
  quickActionSubtitle: {
    fontSize: 12,
    color: MUTED,
    fontWeight: "500",
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

  pendingAlertBox: {
    backgroundColor: "#FFFBEB",
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: "#FCD34D",
    alignItems: "center",
  },
  pendingAlertIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FEF3C7",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  pendingAlertTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: WARNING,
    marginBottom: 8,
  },
  pendingAlertText: {
    fontSize: 14,
    color: INK,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 16,
  },
  pendingDetailsBox: {
    backgroundColor: WHITE,
    borderRadius: 8,
    padding: 12,
    width: "100%",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  pendingDetailsTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: INK,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  pendingDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  pendingDetailLabel: {
    fontSize: 13,
    color: MUTED,
    fontWeight: "500",
  },
  pendingDetailValue: {
    fontSize: 13,
    color: INK,
    fontWeight: "600",
  },
  pendingAlertFooter: {
    fontSize: 12,
    color: MUTED,
    textAlign: "center",
    fontStyle: "italic",
  },

  label: {
    fontSize: 13,
    fontWeight: "600",
    color: INK,
    marginBottom: 6,
    marginTop: 16,
  },
  subLabel: { fontSize: 12, fontWeight: "600", color: MUTED, marginBottom: 6 },
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

  historicalContextBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#EFF6FF",
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#DBEAFE",
  },
  historicalContextText: {
    fontSize: 12,
    color: INFO,
    fontWeight: "600",
  },

  addSpeciesBtn: {
    flexDirection: "row",
    backgroundColor: PRIMARY,
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  addSpeciesBtnText: { color: WHITE, fontWeight: "700", fontSize: 13 },

  addedSpeciesItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F0FDF4",
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#DCFCE7",
  },
  addedSpeciesName: {
    fontSize: 14,
    fontWeight: "700",
    color: INK,
    marginBottom: 6,
  },
  countBadge: {
    fontSize: 11,
    color: MUTED,
    backgroundColor: WHITE,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: BORDER,
  },
  countBadgePrimary: {
    fontSize: 11,
    color: PRIMARY,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  countBadgeSuccess: {
    fontSize: 11,
    color: SUCCESS,
    backgroundColor: "#F0FDF4",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  countBadgeDanger: {
    fontSize: 11,
    color: DANGER,
    backgroundColor: "#FEF2F2",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#FECACA",
  },

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

  calculationPreview: {
    backgroundColor: "#F0FDF4",
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  calculationPreviewError: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FCA5A5",
  },
  calculationLabel: { fontSize: 12, color: MUTED, fontWeight: "600" },
  calculationValue: { fontSize: 16, fontWeight: "800", color: SUCCESS },
  calculationValueError: { color: DANGER },
  validationError: { fontSize: 10, color: DANGER, marginTop: 2 },

  emptyBox: {
    alignItems: "center",
    padding: 24,
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    marginBottom: 16,
  },
  emptySpeciesBox: {
    alignItems: "center",
    padding: 32,
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
  },
  emptyText: { marginTop: 8, color: MUTED, fontSize: 13 },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: WHITE,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "85%",
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: INK,
  },
  modalScrollView: {
    padding: 20,
  },
  modalSpeciesCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  modalReportCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  reportHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  reportDate: { fontSize: 12, color: MUTED, fontWeight: "600" },
  reportType: { fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  pendingBadge: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pendingBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: WARNING,
    textTransform: "uppercase",
  },
  reportStats: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  reportStat: { flex: 1, alignItems: "center" },
  reportStatValue: { fontSize: 18, fontWeight: "800", color: PRIMARY },
  reportStatLabel: {
    fontSize: 10,
    color: MUTED,
    marginTop: 2,
    fontWeight: "600",
  },
  reportDivider: { width: 1, height: 32, backgroundColor: BORDER },
  reportDesc: { fontSize: 12, color: MUTED, lineHeight: 16, marginTop: 8 },

  speciesBreakdown: {
    backgroundColor: WHITE,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  speciesBreakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  speciesBreakdownName: {
    fontSize: 13,
    fontWeight: "600",
    color: INK,
    flex: 1,
  },
  speciesBreakdownStats: { flexDirection: "row", gap: 6 },
  statBadgePlanted: {
    fontSize: 10,
    fontWeight: "700",
    color: PRIMARY,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statBadgeAdded: {
    fontSize: 10,
    fontWeight: "700",
    color: MUTED,
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statBadgeSurvived: {
    fontSize: 10,
    fontWeight: "700",
    color: SUCCESS,
    backgroundColor: "#F0FDF4",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statBadgeDead: {
    fontSize: 10,
    fontWeight: "700",
    color: DANGER,
    backgroundColor: "#FEF2F2",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },

  speciesHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  speciesName: { fontSize: 16, fontWeight: "700", color: INK },
  survivalBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  survivalRate: { fontSize: 13, fontWeight: "800" },
  speciesStats: { gap: 8 },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  survivedRow: { paddingTop: 8, borderTopWidth: 1, borderTopColor: BORDER },
  statLabel: { fontSize: 13, color: MUTED, fontWeight: "500" },
  statValue: { fontSize: 14, fontWeight: "700", color: INK },
});

const badgeStyles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 5,
    marginLeft: "auto",
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
    justifyContent: "center",
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
