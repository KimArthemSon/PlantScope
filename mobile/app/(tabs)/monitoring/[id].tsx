import React, { useState, useEffect } from "react";
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
  Dimensions,
  RefreshControl,
  Modal,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
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

interface SiteProgressReport {
  report_id: number;
  visit_type: "initial" | "ongoing" | "inactive_check";
  orientation_conducted: boolean;
  application_id: number | null;
  application_title: string | null;
  inspector_name: string;
  total_survived: number;
  total_dead: number;
  total_added_by_grower: number;
  species: ProgressReportSpeciesItem[];
  description: string | null;
  status: "pending" | "accepted" | "rejected";
  proof_image: string | null;
  submitted_at: string | null;
  created_at: string;
}

interface SiteMonitoringDetail {
  site: {
    site_id: number;
    name: string;
    description: string | null;
    total_area_hectares: number;
    reforestation_area_name: string | null;
    barangay_name: string | null;
    accessibility: any;
    land_classification_name: string | null;
    recommended_species: {
      species_id: number;
      species_name: string;
      rank: number;
    }[];
  };
  metrics: {
    total_planted: number;
    total_added: number;
    total_dead: number;
    total_survived: number;
    survival_rate: number;
  };
  total_seedlings_provided: number;
  seedling_requests_breakdown: Array<{
    species_id: number;
    species_name: string;
    total_requested: number;
  }>;
  progress_reports: SiteProgressReport[];
  current_application?: {
    application_id: number;
    group_name: string;
    group_contact: string;
    status: string;
  } | null;
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

type LifetimeSpeciesStat = {
  species_id: number;
  species_name: string;
  total_planted: number;
  total_added: number;
  total_planted_sum: number;
  total_dead: number;
  total_survived: number;
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

const getAccessibilityText = (accessibility: any) => {
  if (!accessibility) return "Not specified";
  if (typeof accessibility === "string") return accessibility;
  if (typeof accessibility === "object") {
    if (accessibility.type)
      return accessibility.type
        .replace(/_/g, " ")
        .replace(/\b\w/g, (l: string) => l.toUpperCase());
    if (accessibility.description) return accessibility.description;
  }
  return "Specified";
};

// ── Components ─────────────────────────────────────────────────────────
const StatusBadge = ({ status }: { status: string }) => {
  const config: Record<string, { label: string; bg: string; text: string }> = {
    accepted: { label: "Active Program", bg: "#DCFCE7", text: "#166534" },
    under_monitoring: { label: "Under Monitoring", bg: "#DCFCE7", text: "#166534" },
    inactive: { label: "Independent Monitoring", bg: "#F3F4F6", text: "#374151" },
  };
  const conf = config[status] || config.inactive;
  return (
    <View style={[badgeStyles.wrap, { backgroundColor: conf.bg }]}>
      <View style={[badgeStyles.dot, { backgroundColor: conf.text }]} />
      <Text style={[badgeStyles.text, { color: conf.text }]}>{conf.label}</Text>
    </View>
  );
};

const SectionHeader = ({ title, icon }: { title: string; icon?: string }) => (
  <View style={styles.sectionHeaderRow}>
    {icon && <Ionicons name={icon as any} size={16} color={MUTED} style={{ marginRight: 8 }} />}
    <Text style={styles.sectionTitle}>{title}</Text>
  </View>
);

const InfoRow = ({ icon, label, value }: { icon: string; label?: string; value: string }) => (
  <View style={styles.infoRow}>
    <Ionicons name={icon as any} size={18} color={MUTED} />
    <View style={{ marginLeft: 12, flex: 1 }}>
      {label && <Text style={styles.infoLabel}>{label}</Text>}
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  </View>
);

const SectionDivider = () => <View style={styles.divider} />;

// ─ Main Component ───────────────────────────────────────────────────────
export default function SiteMonitoringDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id, site_id } = useLocalSearchParams<{ id?: string; site_id?: string }>();
  const currentSiteId = id || site_id;

  const [detail, setDetail] = useState<SiteMonitoringDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [showSpeciesModal, setShowSpeciesModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const [allTreeSpecies, setAllTreeSpecies] = useState<TreeSpeciesOption[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [hasExistingSiteInitialReport, setHasExistingSiteInitialReport] = useState(false);
  const [hasCurrentAppInitialReport, setHasCurrentAppInitialReport] = useState(false);

  const [visitType, setVisitType] = useState<"initial" | "ongoing" | "inactive_check">("ongoing");
  const [orientationConducted, setOrientationConducted] = useState(false);
  const [agreementImage, setAgreementImage] = useState<ImagePicker.ImagePickerAsset | null>(null);

  const [reportSpeciesList, setReportSpeciesList] = useState<ReportSpeciesItem[]>([]);
  const [selectedSpeciesId, setSelectedSpeciesId] = useState<string>("");

  const [tempPlanted, setTempPlanted] = useState("");
  const [tempAdded, setTempAdded] = useState("");
  const [tempDead, setTempDead] = useState("");

  const [description, setDescription] = useState("");
  const [proofImage, setProofImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  
  const [speciesWithWarnings, setSpeciesWithWarnings] = useState<number[]>([]);

  const hasActiveApplication = !!detail?.current_application;
  const hasPendingReport = detail?.progress_reports.some((r) => r.status === "pending") || false;
  const pendingReport = detail?.progress_reports.find((r) => r.status === "pending");

  // ✅ FIX 1: Find the oldest initial report (baseline) - considers ALL statuses
  const getBaselineReportId = (): number | null => {
    if (!detail) return null;
    const initialReports = detail.progress_reports
      .filter((r) => r.visit_type === "initial") 
      .sort((a, b) => new Date(a.submitted_at || a.created_at).getTime() - new Date(b.submitted_at || b.created_at).getTime());
    return initialReports.length > 0 ? initialReports[0].report_id : null;
  };

  const baselineReportId = getBaselineReportId();

  // ✅ UPDATED: Check ONLY accepted reports for actual planting data (Removed recommended_species check)
  const checkSpeciesHasPlantingHistory = (speciesId: number): boolean => {
    if (!detail) return false;
    return detail.progress_reports
      .filter(r => r.status === "accepted")
      .some(report =>
        report.species.some(sp =>
          (sp.species_id === speciesId || (sp as any).tree_species_id === speciesId) &&
          ((sp as any).no_planted > 0 || (sp as any).no_added_by_grower > 0)
        )
      );
  };

  // ✅ FIX 2: Add Total Planted column
  const calculateLifetimeSpeciesBreakdown = (): LifetimeSpeciesStat[] => {
    if (!detail) return [];
    const acceptedReports = detail.progress_reports.filter((r) => r.status === "accepted");
    const speciesMap = new Map<number, { name: string; planted: number; added: number; dead: number }>();

    acceptedReports.forEach((report) => {
      report.species.forEach((sp) => {
        const existing = speciesMap.get(sp.species_id) || { name: sp.species_name, planted: 0, added: 0, dead: 0 };
        speciesMap.set(sp.species_id, {
          name: sp.species_name,
          planted: existing.planted + (sp.no_planted || 0),
          added: existing.added + (sp.no_added_by_grower || 0),
          dead: existing.dead + (sp.no_dead || 0),
        });
      });
    });

    return Array.from(speciesMap.entries())
      .map(([id, data]) => {
        const totalAccounted = data.planted + data.added;
        const survived = Math.max(0, totalAccounted - data.dead);
        const rate = totalAccounted > 0 ? (survived / totalAccounted) * 100 : 0;
        return {
          species_id: id,
          species_name: data.name,
          total_planted: data.planted,
          total_added: data.added,
          total_planted_sum: totalAccounted, 
          total_dead: data.dead,
          total_survived: survived,
          survival_rate: rate,
        };
      })
      .sort((a, b) => b.total_planted_sum - a.total_planted_sum);
  };

  useEffect(() => {
    const warnings: number[] = [];
    reportSpeciesList.forEach((sp) => {
      if (sp.no_dead > 0 && sp.no_planted === 0 && sp.no_added_by_grower === 0) {
        const hasHistory = checkSpeciesHasPlantingHistory(sp.tree_species_id);
        if (!hasHistory) {
          warnings.push(sp.tree_species_id);
        }
      }
    });
    setSpeciesWithWarnings(warnings);
  }, [reportSpeciesList, detail]);

  const fetchDetail = async (isRefresh = false) => {
    if (!currentSiteId) {
      setLoading(false);
      return;
    }

    if (!isRefresh) setLoading(true);
    try {
      const token = await SecureStore.getItemAsync("token");
      if (!token) throw new Error("No authentication token found.");

      const res = await fetch(`${api}/api/get_site_monitoring_details/${currentSiteId}/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load site details.");

      const data = await res.json();
      setDetail(data);

      const siteHasInitial = data.progress_reports.some(
        (r: any) => r.visit_type === "initial" && r.status === "accepted"
      );
      setHasExistingSiteInitialReport(siteHasInitial);

      const appHasInitial = data.current_application
        ? data.progress_reports.some(
            (r: any) =>
              r.application_id === data.current_application?.application_id &&
              r.visit_type === "initial" &&
              r.status === "accepted"
          )
        : false;
      setHasCurrentAppInitialReport(appHasInitial);

      if (!data.current_application) {
        setVisitType("inactive_check");
      } else if (data.current_application.status === "accepted") {
        setVisitType("initial");
      } else if (data.current_application.status === "under_monitoring") {
        setVisitType(appHasInitial ? "ongoing" : "initial");
      }
    } catch (err: any) {
      Alert.alert("Error", err.message, [{ text: "OK", onPress: () => router.replace("/(tabs)/monitoring") }]);
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
  }, [currentSiteId]);

  const pickImage = async (type: "proof" | "agreement") => {
    Alert.alert("Select Photo", "Choose a photo source", [
      { text: "Take Photo", onPress: () => launchPicker(type, "camera") },
      { text: "Choose from Library", onPress: () => launchPicker(type, "library") },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const launchPicker = async (type: "proof" | "agreement", source: "camera" | "library") => {
    try {
      const options: any = { quality: 0.7, allowsEditing: true };
      let result;
      if (source === "camera") {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) return Alert.alert("Permission Needed", "Camera access is required.");
        result = await ImagePicker.launchCameraAsync(options);
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) return Alert.alert("Permission Needed", "Photo library access is required.");
        result = await ImagePicker.launchImageLibraryAsync({ ...options, mediaTypes: ImagePicker.MediaTypeOptions.Images });
      }
      if (!result.canceled && result.assets?.[0]) {
        type === "proof" ? setProofImage(result.assets[0]) : setAgreementImage(result.assets[0]);
      }
    } catch (err) {
      Alert.alert("Error", "Something went wrong selecting the image.");
    }
  };

  // ✅ FIX 3: STRICT Validation to prevent negative calculations
  const handleAddSpeciesToReport = () => {
    if (!selectedSpeciesId) return Alert.alert("Missing Species", "Please select a tree species.");

    const found = allTreeSpecies.find((s) => s.tree_specie_id === Number(selectedSpeciesId));
    if (!found) return;

    const planted = visitType === "initial" && !hasExistingSiteInitialReport ? parseInt(tempPlanted) || 0 : 0;
    const added = (visitType === "ongoing" || (visitType === "initial" && hasExistingSiteInitialReport)) ? parseInt(tempAdded) || 0 : 0;
    const dead = parseInt(tempDead) || 0;

    if (visitType === "inactive_check" && dead === 0) {
      return Alert.alert("Invalid Count", "Please enter the number of dead trees.");
    }

    const totalAccounted = planted + added;
    const hasHistory = checkSpeciesHasPlantingHistory(found.tree_specie_id);

    // BLOCK 1: If dead trees exceed the trees accounted for in THIS entry AND there is no history
    if (dead > totalAccounted && !hasHistory) {
      return Alert.alert(
        "Invalid Entry Blocked",
        `Cannot record ${dead} dead trees for "${found.name}" because only ${totalAccounted} trees were accounted for in this entry, and this species has no previous planting history at this site.\n\nYou cannot have more dead trees than were planted. Please verify the counts.`,
        [{ text: "OK" }]
      );
    }

    // BLOCK 2: Block dead-only entries without actual planting history
    if (dead > 0 && totalAccounted === 0 && !hasHistory) {
      return Alert.alert(
        "Invalid Entry Blocked",
        `Cannot record ${dead} dead trees for "${found.name}" because this species has never been planted at this site.\n\nDead trees must come from previously planted stock. Please verify the species name or add the planting count first.`,
        [{ text: "OK" }]
      );
    }

    const existingIndex = reportSpeciesList.findIndex((s) => s.tree_species_id === found.tree_specie_id);
    if (existingIndex >= 0) {
      const updatedList = [...reportSpeciesList];
      updatedList[existingIndex] = { ...updatedList[existingIndex], no_planted: planted, no_added_by_grower: added, no_dead: dead };
      setReportSpeciesList(updatedList);
    } else {
      setReportSpeciesList([
        ...reportSpeciesList,
        { tree_species_id: found.tree_specie_id, species_name: found.name, no_planted: planted, no_added_by_grower: added, no_dead: dead },
      ]);
    }

    setSelectedSpeciesId("");
    setTempPlanted("");
    setTempAdded("");
    setTempDead("");
  };

  const handleSubmitReport = async () => {
    if (!detail) return;
    if (reportSpeciesList.length === 0) return Alert.alert("Missing Data", "Please add at least one species to the report.");
    if (visitType === "initial" && !orientationConducted) return Alert.alert("Missing Requirement", "You must confirm that the orientation was conducted.");
    if (visitType === "initial" && !agreementImage) return Alert.alert("Missing Requirement", "Please upload the signed agreement image.");
    if (!proofImage) return Alert.alert("Missing Requirement", "Please upload a proof image of the site for this visit.");
    
    if (speciesWithWarnings.length > 0) {
      return Alert.alert(
        "Cannot Submit",
        `${speciesWithWarnings.length} species have validation errors. Please fix dead-only entries without planting history before submitting.`,
        [{ text: "OK" }]
      );
    }

    setSubmitting(true);
    try {
      const token = await SecureStore.getItemAsync("token");
      const formData = new FormData();

      formData.append("site_id", String(detail.site.site_id));
      if (detail.current_application) formData.append("application_id", String(detail.current_application.application_id));
      formData.append("visit_type", visitType);
      formData.append("orientation_conducted", String(orientationConducted));

      const formattedSpecies = reportSpeciesList.map((sp) => ({
        tree_species_id: sp.tree_species_id,
        no_planted: sp.no_planted,
        no_added_by_grower: sp.no_added_by_grower,
        no_survived: 0,
        no_dead: sp.no_dead,
      }));

      formData.append("report_species", JSON.stringify(formattedSpecies));
      formData.append("description", description);

      if (visitType === "initial" && agreementImage) {
        const filename = agreementImage.uri.split("/").pop();
        formData.append("agreement_image", { uri: agreementImage.uri, name: filename || "agreement.jpg", type: "image/jpeg" } as any);
      }

      const proofFilename = proofImage.uri.split("/").pop();
      formData.append("proof_image", { uri: proofImage.uri, name: proofFilename || "proof.jpg", type: "image/jpeg" } as any);

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
            setSpeciesWithWarnings([]);
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

  if (loading || !detail) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={PRIMARY} />
        <Text style={{ marginTop: 12, color: MUTED }}>Loading site details…</Text>
      </View>
    );
  }

  const { site, metrics, progress_reports, current_application, total_seedlings_provided, seedling_requests_breakdown } = detail;
  const programStatus = current_application ? current_application.status : "inactive";
  const lifetimeSpeciesStats = calculateLifetimeSpeciesBreakdown();
  
  const hasBlockingErrors = speciesWithWarnings.length > 0;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.replace("/(tabs)/monitoring")}>
          <Ionicons name="chevron-back" size={22} color={INK} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{site.name}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchDetail(true); }} tintColor={PRIMARY} />}
      >
        <View style={styles.contentArea}>
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <SectionHeader title="SITE INFORMATION" icon="location-outline" />
              <StatusBadge status={programStatus} />
            </View>

            <InfoRow icon="business-outline" label="Area" value={`${site.reforestation_area_name || "Unknown"}, ${site.barangay_name || "N/A"}`} />
            <InfoRow icon="resize-outline" label="Total Area" value={`${site.total_area_hectares.toFixed(2)} hectares`} />
            <InfoRow icon="layers-outline" label="Land Classification" value={site.land_classification_name || "Not classified"} />
            <InfoRow icon="walk-outline" label="Accessibility" value={getAccessibilityText(site.accessibility)} />

            {current_application && (
              <>
                <SectionDivider />
                <InfoRow icon="people-outline" label="Current Tree Grower" value={current_application.group_name} />
                <InfoRow icon="call-outline" label="Contact" value={current_application.group_contact || "N/A"} />
              </>
            )}
          </View>

          <SectionDivider />

          <View style={styles.metricsSection}>
            <Text style={styles.metricsTitle}>Lifetime Site Metrics</Text>
            <View style={styles.metricsGrid}>
              <View style={[styles.metricCard, { backgroundColor: "#F0FDF4", borderColor: "#86EFAC" }]}>
                <Ionicons name="leaf-outline" size={24} color={SUCCESS} />
                <Text style={[styles.metricValue, { color: "#047857" }]}>{(total_seedlings_provided || 0).toLocaleString()}</Text>
                <Text style={styles.metricLabel}>Total Seedlings Provided</Text>
              </View>
              <View style={[styles.metricCard, { backgroundColor: "#F5F3FF", borderColor: "#DDD6FE" }]}>
                <Ionicons name="tree" size={24} color="#7C3AED" />
                <Text style={[styles.metricValue, { color: "#6D28D9" }]}>{(metrics.total_planted + metrics.total_added).toLocaleString()}</Text>
                <Text style={styles.metricLabel}>Total Planted</Text>
              </View>
              <View style={[styles.metricCard, { backgroundColor: "#FEF2F2", borderColor: "#FECACA" }]}>
                <Ionicons name="close-circle-outline" size={24} color={DANGER} />
                <Text style={[styles.metricValue, { color: "#B91C1C" }]}>{metrics.total_dead.toLocaleString()}</Text>
                <Text style={styles.metricLabel}>Total Dead</Text>
              </View>
              <View style={[styles.metricCard, { backgroundColor: "#ECFDF5", borderColor: "#A7F3D0" }]}>
                <Ionicons name="checkmark-circle-outline" size={24} color={SUCCESS} />
                <Text style={[styles.metricValue, { color: "#047857" }]}>{metrics.total_survived.toLocaleString()}</Text>
                <Text style={styles.metricLabel}>Total Survived</Text>
              </View>
            </View>
            <View style={[styles.survivalRateBox, { borderColor: metrics.survival_rate >= 80 ? "#A7F3D0" : metrics.survival_rate >= 50 ? "#FCD34D" : "#FECACA" }]}>
              <Text style={[styles.survivalRateText, { color: metrics.survival_rate >= 80 ? SUCCESS : metrics.survival_rate >= 50 ? WARNING : DANGER }]}>
                {metrics.survival_rate.toFixed(1)}% Overall Survival Rate
              </Text>
            </View>
          </View>

          {seedling_requests_breakdown && seedling_requests_breakdown.length > 0 && (
            <View style={styles.section}>
              <SectionHeader title="Seedling Request Breakdown" icon="leaf-outline" />
              <View style={styles.breakdownContainer}>
                {seedling_requests_breakdown.map((item, idx) => (
                  <View key={idx} style={styles.breakdownItem}>
                    <View style={styles.breakdownInfo}>
                      <Ionicons name="leaf" size={16} color={SUCCESS} />
                      <Text style={styles.breakdownName}>{item.species_name}</Text>
                    </View>
                    <View style={styles.breakdownBadge}>
                      <Text style={styles.breakdownCount}>{item.total_requested.toLocaleString()}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          <View style={styles.quickActionsContainer}>
            <TouchableOpacity style={styles.quickActionCard} onPress={() => setShowSpeciesModal(true)} activeOpacity={0.7}>
              <View style={styles.quickActionIcon}>
                <Ionicons name="analytics" size={24} color={PRIMARY} />
              </View>
              <View style={styles.quickActionText}>
                <Text style={styles.quickActionTitle}>Species Breakdown</Text>
                <Text style={styles.quickActionSubtitle}>View per-species lifetime stats</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={MUTED} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickActionCard} onPress={() => setShowHistoryModal(true)} activeOpacity={0.7}>
              <View style={styles.quickActionIcon}>
                <Ionicons name="time" size={24} color={PRIMARY} />
              </View>
              <View style={styles.quickActionText}>
                <Text style={styles.quickActionTitle}>Report History</Text>
                <Text style={styles.quickActionSubtitle}>{progress_reports.length} reports submitted</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={MUTED} />
            </TouchableOpacity>
          </View>

          <SectionDivider />

          <View style={styles.section}>
            <SectionHeader title={hasPendingReport ? "PENDING REPORT" : "SUBMIT NEW REPORT"} icon="create-outline" />

            {hasPendingReport && pendingReport ? (
              <View style={styles.pendingAlertBox}>
                <View style={styles.pendingAlertIcon}>
                  <Ionicons name="time-outline" size={32} color={WARNING} />
                </View>
                <Text style={styles.pendingAlertTitle}>Report Pending Review</Text>
                <Text style={styles.pendingAlertText}>
                  You submitted a <Text style={{ fontWeight: "700" }}>{pendingReport.visit_type === "initial" ? "Initial" : pendingReport.visit_type === "inactive_check" ? "Inactive Check" : "Ongoing"}</Text> report on {formatDate(pendingReport.submitted_at)}.
                </Text>
                <Text style={styles.pendingAlertFooter}>Please wait for the Data Manager to review and approve before submitting a new one.</Text>
              </View>
            ) : (
              <>
                {!hasActiveApplication && (
                  <View style={styles.independentCheckBox}>
                    <Ionicons name="information-circle" size={18} color={INFO} />
                    <Text style={styles.independentCheckText}>
                      This site has no active tree planting program. This report will be logged as an <Text style={{ fontWeight: "700" }}>Independent Site Check</Text>.
                    </Text>
                  </View>
                )}

                <View style={styles.visitTypeBadgeContainer}>
                  <Ionicons name={visitType === "initial" ? "calendar" : visitType === "ongoing" ? "leaf" : "pause-circle"} size={16} color={visitType === "initial" ? PRIMARY : visitType === "ongoing" ? SUCCESS : MUTED} />
                  <Text style={[styles.visitTypeBadgeText, { color: visitType === "initial" ? PRIMARY : visitType === "ongoing" ? SUCCESS : MUTED }]}>
                    {visitType === "initial" ? "Initial Orientation Required" : visitType === "ongoing" ? "Ongoing Monitoring" : "Independent Site Check"}
                  </Text>
                </View>

                {visitType === "initial" && hasExistingSiteInitialReport && (
                  <View style={styles.infoBox}>
                    <Ionicons name="information-circle" size={18} color={INFO} />
                    <Text style={styles.infoBoxText}>
                      This site already has a baseline. Please record only <Text style={{ fontWeight: "700" }}>new trees added</Text> by your group.
                    </Text>
                  </View>
                )}

                {visitType === "initial" && hasActiveApplication && (
                  <>
                    <TouchableOpacity style={styles.checkboxRow} onPress={() => setOrientationConducted(!orientationConducted)} activeOpacity={0.7}>
                      <Ionicons name={orientationConducted ? "checkbox" : "square-outline"} size={24} color={PRIMARY} />
                      <Text style={styles.checkboxLabel}>I confirm that the orientation was conducted with the tree growers.</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.uploadBox} activeOpacity={0.7} onPress={() => pickImage("agreement")}>
                      {agreementImage ? <Image source={{ uri: agreementImage.uri }} style={styles.uploadPreview} /> : (
                        <>
                          <Ionicons name="document-text-outline" size={28} color={FAINT} />
                          <Text style={styles.uploadText}>Upload Signed Agreement</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </>
                )}

                <Text style={styles.label}>Report by Species</Text>
                <View style={styles.speciesBuilderBox}>
                  <Text style={styles.subLabel}>1. Select Species</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      {allTreeSpecies.map((sp) => (
                        <TouchableOpacity
                          key={sp.tree_specie_id}
                          onPress={() => {
                            setSelectedSpeciesId(String(sp.tree_specie_id));
                            const existing = reportSpeciesList.find((s) => s.tree_species_id === sp.tree_specie_id);
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
                            backgroundColor: selectedSpeciesId === String(sp.tree_specie_id) ? PRIMARY : WHITE,
                            borderWidth: 1,
                            borderColor: selectedSpeciesId === String(sp.tree_specie_id) ? PRIMARY : BORDER,
                          }}
                        >
                          <Text style={{ color: selectedSpeciesId === String(sp.tree_specie_id) ? WHITE : INK, fontSize: 12, fontWeight: "600" }}>{sp.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>

                  <Text style={styles.subLabel}>2. Enter Counts</Text>
                  <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
                    {visitType === "initial" && !hasExistingSiteInitialReport ? (
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 11, color: MUTED, marginBottom: 4 }}>Officially Planted *</Text>
                        <TextInput style={styles.input} placeholder="0" keyboardType="numeric" value={tempPlanted} onChangeText={setTempPlanted} />
                      </View>
                    ) : (visitType === "ongoing" || (visitType === "initial" && hasExistingSiteInitialReport)) ? (
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 11, color: MUTED, marginBottom: 4 }}>Added by Grower</Text>
                        <TextInput style={styles.input} placeholder="0" keyboardType="numeric" value={tempAdded} onChangeText={setTempAdded} />
                      </View>
                    ) : null}
                    
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, color: MUTED, marginBottom: 4 }}>
                        {visitType === "inactive_check" ? "Dead Trees *" : "Dead Count *"}
                      </Text>
                      <TextInput style={styles.input} placeholder="0" keyboardType="numeric" value={tempDead} onChangeText={setTempDead} />
                    </View>
                  </View>

                  <TouchableOpacity style={[styles.addSpeciesBtn, { opacity: selectedSpeciesId ? 1 : 0.5 }]} onPress={handleAddSpeciesToReport} disabled={!selectedSpeciesId}>
                    <Ionicons name={reportSpeciesList.some((s) => s.tree_species_id === Number(selectedSpeciesId)) ? "refresh" : "add-circle"} size={16} color={WHITE} />
                    <Text style={styles.addSpeciesBtnText}>{reportSpeciesList.some((s) => s.tree_species_id === Number(selectedSpeciesId)) ? "Update Species" : "Add to Report"}</Text>
                  </TouchableOpacity>
                </View>

                {reportSpeciesList.length > 0 && (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: INK, marginBottom: 8 }}>Reported Species ({reportSpeciesList.length})</Text>
                    {reportSpeciesList.map((sp, idx) => {
                      const hasWarning = speciesWithWarnings.includes(sp.tree_species_id);
                      return (
                        <View key={idx} style={[
                          styles.addedSpeciesItem, 
                          hasWarning && { borderColor: DANGER, borderWidth: 2, backgroundColor: "#FEF2F2" }
                        ]}>
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                              <Text style={styles.addedSpeciesName}>{sp.species_name}</Text>
                              {hasWarning && <Ionicons name="warning" size={16} color={DANGER} />}
                            </View>
                            {hasWarning && (
                              <Text style={{ fontSize: 10, color: DANGER, marginTop: 4 }}>
                                ️ No planting history - verify species
                              </Text>
                            )}
                            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
                              {sp.no_planted > 0 && <Text style={styles.countBadgePrimary}>Planted: {sp.no_planted}</Text>}
                              {sp.no_added_by_grower > 0 && <Text style={styles.countBadge}>Added: {sp.no_added_by_grower}</Text>}
                              <Text style={styles.countBadgeDanger}>Dead: {sp.no_dead}</Text>
                            </View>
                          </View>
                          <TouchableOpacity onPress={() => setReportSpeciesList(reportSpeciesList.filter((_, i) => i !== idx))}>
                            <Ionicons name="trash-outline" size={20} color={DANGER} />
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                )}

                <Text style={styles.label}>Remarks / Notes</Text>
                <TextInput style={[styles.input, styles.textArea]} placeholder="Notes about plant condition, weather, missing seedlings, etc..." multiline numberOfLines={3} value={description} onChangeText={setDescription} />

                <Text style={styles.label}>Proof Image (Site Photo) <Text style={{ color: DANGER }}>*</Text></Text>
                <TouchableOpacity style={styles.uploadBox} activeOpacity={0.7} onPress={() => pickImage("proof")}>
                  {proofImage ? <Image source={{ uri: proofImage.uri }} style={styles.uploadPreview} /> : (
                    <>
                      <Ionicons name="camera-outline" size={28} color={FAINT} />
                      <Text style={styles.uploadText}>Upload Group/Site Photo</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[
                    styles.submitBtn, 
                    { opacity: submitting || reportSpeciesList.length === 0 || !proofImage || hasBlockingErrors ? 0.6 : 1 }
                  ]} 
                  onPress={handleSubmitReport} 
                  disabled={submitting || reportSpeciesList.length === 0 || !proofImage || hasBlockingErrors}
                  activeOpacity={0.8}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color={WHITE} />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={20} color={WHITE} />
                      <Text style={styles.submitBtnText}>
                        {hasBlockingErrors ? "Fix Errors Before Submit" : "Submit Report"}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
          <View style={{ height: 40 }} />
        </View>
      </ScrollView>

      {/* SPECIES BREAKDOWN MODAL */}
      <Modal visible={showSpeciesModal} animationType="slide" transparent={true} onRequestClose={() => setShowSpeciesModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Lifetime Species Breakdown</Text>
              <TouchableOpacity onPress={() => setShowSpeciesModal(false)}>
                <Ionicons name="close" size={24} color={INK} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScrollView}>
              {lifetimeSpeciesStats.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Ionicons name="leaf-outline" size={32} color={FAINT} />
                  <Text style={styles.emptyText}>No accepted reports with species data yet.</Text>
                </View>
              ) : (
                lifetimeSpeciesStats.map((stat, idx) => (
                  <View key={idx} style={styles.lifetimeSpeciesCard}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <Text style={styles.lifetimeSpeciesName}>{stat.species_name}</Text>
                      <View style={[styles.survivalBadge, { backgroundColor: stat.survival_rate >= 80 ? "#DCFCE7" : stat.survival_rate >= 50 ? "#FEF3C7" : "#FEE2E2" }]}>
                        <Text style={[styles.survivalBadgeText, { color: stat.survival_rate >= 80 ? SUCCESS : stat.survival_rate >= 50 ? WARNING : DANGER }]}>
                          {stat.survival_rate.toFixed(1)}%
                        </Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                      <View style={styles.miniStat}>
                        <Text style={styles.miniStatValue}>{stat.total_planted}</Text>
                        <Text style={styles.miniStatLabel}>Planted</Text>
                      </View>
                      <View style={styles.miniStat}>
                        <Text style={styles.miniStatValue}>{stat.total_added}</Text>
                        <Text style={styles.miniStatLabel}>Added</Text>
                      </View>
                      <View style={styles.miniStat}>
                        <Text style={[styles.miniStatValue, { color: PRIMARY }]}>{stat.total_planted_sum}</Text>
                        <Text style={styles.miniStatLabel}>Total Planted</Text>
                      </View>
                      <View style={styles.miniStat}>
                        <Text style={[styles.miniStatValue, { color: DANGER }]}>{stat.total_dead}</Text>
                        <Text style={styles.miniStatLabel}>Dead</Text>
                      </View>
                      <View style={styles.miniStat}>
                        <Text style={[styles.miniStatValue, { color: SUCCESS }]}>{stat.total_survived}</Text>
                        <Text style={styles.miniStatLabel}>Survived</Text>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* REPORT HISTORY MODAL */}
      <Modal visible={showHistoryModal} animationType="slide" transparent={true} onRequestClose={() => setShowHistoryModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Report History</Text>
              <TouchableOpacity onPress={() => setShowHistoryModal(false)}>
                <Ionicons name="close" size={24} color={INK} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScrollView}>
              {progress_reports.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Ionicons name="clipboard-outline" size={32} color={FAINT} />
                  <Text style={styles.emptyText}>No reports submitted yet</Text>
                </View>
              ) : (
                progress_reports.map((report) => {
                  const isInitial = report.visit_type === "initial";
                  const isBaseline = isInitial && report.report_id === baselineReportId;
                  
                  const statusConfig = {
                    accepted: { label: "Accepted", bg: "#DCFCE7", text: "#166534" },
                    rejected: { label: "Rejected", bg: "#FEE2E2", text: "#991B1B" },
                    pending: { label: "Pending", bg: "#FEF3C7", text: "#92400E" },
                  };
                  const currentStatus = statusConfig[report.status] || statusConfig.pending;

                  return (
                    <View key={report.report_id} style={styles.modalReportCard}>
                      <View style={styles.reportHeader}>
                        <Text style={styles.reportDate}>{formatDate(report.submitted_at)}</Text>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <Text style={[styles.reportType, { color: isInitial ? PRIMARY : report.visit_type === "inactive_check" ? MUTED : INFO }]}>
                            {isInitial ? "INITIAL" : report.visit_type === "inactive_check" ? "Inactive Check" : "Ongoing"}
                          </Text>
                          <View style={[styles.statusBadge, { backgroundColor: currentStatus.bg }]}>
                            <Text style={[styles.statusBadgeText, { color: currentStatus.text }]}>
                              {currentStatus.label}
                            </Text>
                          </View>
                        </View>
                      </View>

                      <Text style={styles.inspectorName}>By: {report.inspector_name}</Text>
                      {report.application_title && <Text style={styles.applicationLink}>Linked to: {report.application_title}</Text>}

                      <View style={styles.reportStats}>
                        {isBaseline ? (
                          <>
                            <View style={styles.reportStat}>
                              <Text style={styles.reportStatValue}>{report.species.reduce((sum, sp) => sum + sp.no_planted, 0)}</Text>
                              <Text style={styles.reportStatLabel}>Officially Planted</Text>
                            </View>
                            <View style={styles.reportDivider} />
                            <View style={styles.reportStat}>
                              <Text style={[styles.reportStatValue, { color: DANGER }]}>{report.total_dead}</Text>
                              <Text style={styles.reportStatLabel}>Dead</Text>
                            </View>
                          </>
                        ) : (
                          <>
                            <View style={styles.reportStat}>
                              <Text style={styles.reportStatValue}>{report.total_added_by_grower}</Text>
                              <Text style={styles.reportStatLabel}>Added</Text>
                            </View>
                            <View style={styles.reportDivider} />
                            <View style={styles.reportStat}>
                              <Text style={[styles.reportStatValue, { color: DANGER }]}>{report.total_dead}</Text>
                              <Text style={styles.reportStatLabel}>Dead</Text>
                            </View>
                          </>
                        )}
                      </View>

                      {report.species && report.species.length > 0 && (
                        <View style={styles.reportSpeciesList}>
                          <Text style={styles.reportSpeciesTitle}>Species Details:</Text>
                          {report.species.map((sp, idx) => (
                            <View key={idx} style={styles.reportSpeciesItem}>
                              <Text style={styles.reportSpeciesName}>{sp.species_name}</Text>
                              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                                {isBaseline && sp.no_planted > 0 && <Text style={styles.miniCountBadge}>Planted: {sp.no_planted}</Text>}
                                {!isBaseline && sp.no_added_by_grower > 0 && <Text style={styles.miniCountBadge}>Added: {sp.no_added_by_grower}</Text>}
                                <Text style={[styles.miniCountBadge, { backgroundColor: "#FEE2E2", color: DANGER, borderColor: "#FECACA" }]}>Dead: {sp.no_dead}</Text>
                              </View>
                            </View>
                          ))}
                        </View>
                      )}

                      {report.description && (
                        <Text style={styles.reportDesc}>
                          <Ionicons name="document-text-outline" size={12} color={MUTED} /> {report.description}
                        </Text>
                      )}
                    </View>
                  );
                })
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
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 10, backgroundColor: BG },
  backBtn: { width: 36, height: 36, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: INK, letterSpacing: -0.3, flex: 1, textAlign: "center" },
  contentArea: { backgroundColor: WHITE, paddingHorizontal: 20, paddingTop: 8 },
  section: { paddingVertical: 20 },
  divider: { height: 1, backgroundColor: BORDER, marginHorizontal: -20 },
  sectionHeaderRow: { flexDirection: "row", alignItems: "center", marginBottom: 16, justifyContent: "space-between" },
  sectionTitle: { fontSize: 12, fontWeight: "700", color: MUTED, textTransform: "uppercase", letterSpacing: 1 },
  infoRow: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 10 },
  infoLabel: { fontSize: 11, color: MUTED, fontWeight: "600", marginBottom: 2, textTransform: "uppercase", letterSpacing: 0.5 },
  infoValue: { fontSize: 15, color: INK, fontWeight: "600", lineHeight: 20 },

  metricsSection: { marginBottom: 20, padding: 16, backgroundColor: WHITE, borderRadius: 16, borderWidth: 1, borderColor: BORDER },
  metricsTitle: { fontSize: 14, fontWeight: "700", color: PRIMARY, marginBottom: 12 },
  metricsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metricCard: { width: "48%", padding: 12, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  metricValue: { fontSize: 22, fontWeight: "800", marginTop: 4 },
  metricLabel: { fontSize: 10, color: MUTED, fontWeight: "600", marginTop: 2, textAlign: "center" },
  survivalRateBox: { marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: BORDER, alignItems: "center" },
  survivalRateText: { fontSize: 16, fontWeight: "800" },

  breakdownContainer: { backgroundColor: "#F9FAFB", borderRadius: 12, borderWidth: 1, borderColor: BORDER, overflow: "hidden" },
  breakdownItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14, borderBottomWidth: 1, borderBottomColor: BORDER },
  breakdownInfo: { flexDirection: "row", alignItems: "center", gap: 10 },
  breakdownName: { fontSize: 14, fontWeight: "600", color: INK },
  breakdownBadge: { backgroundColor: "#ECFDF5", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: "#A7F3D0" },
  breakdownCount: { fontSize: 14, fontWeight: "700", color: "#047857" },

  quickActionsContainer: { gap: 12, marginBottom: 20 },
  quickActionCard: { flexDirection: "row", alignItems: "center", backgroundColor: WHITE, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: BORDER },
  quickActionIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#F0FDF4", justifyContent: "center", alignItems: "center", marginRight: 12 },
  quickActionText: { flex: 1 },
  quickActionTitle: { fontSize: 15, fontWeight: "700", color: INK, marginBottom: 2 },
  quickActionSubtitle: { fontSize: 12, color: MUTED, fontWeight: "500" },

  independentCheckBox: { flexDirection: "row", gap: 12, marginBottom: 16, padding: 12, backgroundColor: "#EFF6FF", borderRadius: 12, borderWidth: 1, borderColor: "#DBEAFE" },
  independentCheckText: { fontSize: 13, color: INFO, fontWeight: "500", flex: 1, lineHeight: 18 },

  visitTypeBadgeContainer: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, backgroundColor: "#F9FAFB", borderRadius: 8, borderWidth: 1, borderColor: BORDER, marginBottom: 16 },
  visitTypeBadgeText: { fontSize: 14, fontWeight: "600" },

  infoBox: { flexDirection: "row", gap: 12, marginBottom: 16, padding: 12, backgroundColor: "#EFF6FF", borderRadius: 12, borderWidth: 1, borderColor: "#DBEAFE" },
  infoBoxText: { fontSize: 13, color: INFO, fontWeight: "500", flex: 1, lineHeight: 18 },

  checkboxRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 16, padding: 12, backgroundColor: "#F0FDF4", borderRadius: 12, borderWidth: 1, borderColor: "#DCFCE7" },
  checkboxLabel: { fontSize: 14, color: INK, fontWeight: "500", flex: 1, lineHeight: 20 },

  pendingAlertBox: { backgroundColor: "#FFFBEB", borderRadius: 12, padding: 20, borderWidth: 1, borderColor: "#FCD34D", alignItems: "center" },
  pendingAlertIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#FEF3C7", justifyContent: "center", alignItems: "center", marginBottom: 12 },
  pendingAlertTitle: { fontSize: 18, fontWeight: "700", color: WARNING, marginBottom: 8 },
  pendingAlertText: { fontSize: 14, color: INK, textAlign: "center", lineHeight: 20, marginBottom: 16 },
  pendingAlertFooter: { fontSize: 12, color: MUTED, textAlign: "center", fontStyle: "italic" },

  label: { fontSize: 13, fontWeight: "600", color: INK, marginBottom: 6, marginTop: 16 },
  subLabel: { fontSize: 12, fontWeight: "600", color: MUTED, marginBottom: 6 },
  input: { backgroundColor: WHITE, borderWidth: 1.5, borderColor: BORDER, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: INK },
  textArea: { height: 90, textAlignVertical: "top" },

  speciesBuilderBox: { backgroundColor: "#F9FAFB", padding: 12, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: BORDER },
  addSpeciesBtn: { flexDirection: "row", backgroundColor: PRIMARY, padding: 12, borderRadius: 10, alignItems: "center", justifyContent: "center", gap: 6 },
  addSpeciesBtnText: { color: WHITE, fontWeight: "700", fontSize: 13 },

  addedSpeciesItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#F0FDF4", padding: 12, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: "#DCFCE7" },
  addedSpeciesName: { fontSize: 14, fontWeight: "700", color: INK, marginBottom: 6 },
  countBadge: { fontSize: 11, color: MUTED, backgroundColor: WHITE, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: BORDER },
  countBadgePrimary: { fontSize: 11, color: PRIMARY, backgroundColor: "#ECFDF5", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: "#A7F3D0" },
  countBadgeDanger: { fontSize: 11, color: DANGER, backgroundColor: "#FEF2F2", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: "#FECACA" },

  uploadBox: { borderWidth: 1.5, borderColor: BORDER, borderStyle: "dashed", borderRadius: 14, minHeight: 120, justifyContent: "center", alignItems: "center", backgroundColor: WHITE, overflow: "hidden", marginTop: 8 },
  uploadPreview: { width: "100%", height: 160, borderRadius: 12 },
  uploadText: { fontSize: 14, fontWeight: "700", color: MUTED, marginTop: 8 },

  submitBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 16, gap: 8, marginTop: 24, shadowColor: PRIMARY, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4 },
  submitBtnText: { color: WHITE, fontWeight: "800", fontSize: 16 },

  emptyBox: { alignItems: "center", padding: 32, backgroundColor: "#F9FAFB", borderRadius: 12 },
  emptyText: { marginTop: 8, color: MUTED, fontSize: 13, textAlign: "center" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: WHITE, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "85%", paddingBottom: 40 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: BORDER },
  modalTitle: { fontSize: 18, fontWeight: "700", color: INK },
  modalScrollView: { padding: 20 },

  modalReportCard: { backgroundColor: "#F9FAFB", borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: BORDER },
  reportHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  reportDate: { fontSize: 12, color: MUTED, fontWeight: "600" },
  reportType: { fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  inspectorName: { fontSize: 13, color: INK, fontWeight: "600", marginBottom: 4 },
  applicationLink: { fontSize: 11, color: INFO, fontWeight: "500", marginBottom: 12, fontStyle: "italic" },
  
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusBadgeText: { fontSize: 9, fontWeight: "700", textTransform: "uppercase" },
  
  reportStats: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  reportStat: { flex: 1, alignItems: "center" },
  reportStatValue: { fontSize: 18, fontWeight: "800", color: PRIMARY },
  reportStatLabel: { fontSize: 10, color: MUTED, marginTop: 2, fontWeight: "600" },
  reportDivider: { width: 1, height: 32, backgroundColor: BORDER },
  reportDesc: { fontSize: 12, color: MUTED, lineHeight: 16, marginTop: 8 },

  lifetimeSpeciesCard: { backgroundColor: "#F9FAFB", borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: BORDER },
  lifetimeSpeciesName: { fontSize: 15, fontWeight: "700", color: INK },
  survivalBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  survivalBadgeText: { fontSize: 11, fontWeight: "700" },
  miniStat: { alignItems: "center", minWidth: 60 },
  miniStatValue: { fontSize: 16, fontWeight: "800", color: INK },
  miniStatLabel: { fontSize: 10, color: MUTED, marginTop: 2 },

  reportSpeciesList: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: BORDER },
  reportSpeciesTitle: { fontSize: 11, fontWeight: "700", color: MUTED, marginBottom: 8, textTransform: "uppercase" },
  reportSpeciesItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  reportSpeciesName: { fontSize: 13, fontWeight: "600", color: INK, flex: 1 },
  miniCountBadge: { fontSize: 10, fontWeight: "600", color: MUTED, backgroundColor: WHITE, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: BORDER },
});

const badgeStyles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
});