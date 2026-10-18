import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  RefreshControl,
  Modal,
  Linking,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as SecureStore from "expo-secure-store";
import * as ImagePicker from "expo-image-picker";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/constants/url_fixed";
import { useAlert } from "@/components/AlertContext";

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

const formatShortDate = (iso: string | null) =>
  !iso
    ? "—"
    : new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric" });

const ACCESS_LABELS: Record<string, string> = {
  vehicle_accessible: "Vehicle Accessible",
  motorcycle_only: "Motorcycle Only",
  footpath_only: "Footpath Only",
  not_accessible: "Not Accessible",
  other: "Other",
};

// Accessibility is stored as a list of { type, description } entries
const getAccessibilityText = (accessibility: any): string => {
  if (!accessibility) return "Not specified";
  if (typeof accessibility === "string") return accessibility;
  const entries = Array.isArray(accessibility) ? accessibility : [accessibility];
  const parts = entries
    .filter(Boolean)
    .map((a: any) => {
      if (typeof a === "string") return a;
      const label = a.type
        ? ACCESS_LABELS[a.type] || String(a.type).replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase())
        : "";
      return [label, a.description].filter(Boolean).join(" · ");
    })
    .filter(Boolean);
  return parts.length ? parts.join("\n") : "Not specified";
};

// ── Components ─────────────────────────────────────────────────────────
const StatusBadge = ({ status }: { status: string }) => {
  const config: Record<string, { label: string; bg: string; text: string }> = {
    accepted: { label: "Active Program", bg: "#DCFCE7", text: "#166534" },
    under_monitoring: { label: "Under Monitoring", bg: "#DBEAFE", text: "#1E40AF" },
    inactive: { label: "No Active Program", bg: "#F3F4F6", text: "#374151" },
  };
  const conf = config[status] || config.inactive;
  return (
    <View style={[badgeStyles.wrap, { backgroundColor: conf.bg }]}>
      <View style={[badgeStyles.dot, { backgroundColor: conf.text }]} />
      <Text style={[badgeStyles.text, { color: conf.text }]}>{conf.label}</Text>
    </View>
  );
};

const CardTitle = ({ icon, title, right }: { icon: keyof typeof Ionicons.glyphMap; title: string; right?: string }) => (
  <View style={styles.cardTitleRow}>
    <View style={styles.cardTitleIcon}>
      <Ionicons name={icon} size={15} color={PRIMARY} />
    </View>
    <Text style={styles.cardTitle}>{title}</Text>
    {right ? <Text style={styles.cardTitleRight}>{right}</Text> : null}
  </View>
);

const InfoTile = ({ icon, label, value, sub }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; sub?: string }) => (
  <View style={styles.infoTile}>
    <Ionicons name={icon} size={18} color={PRIMARY} />
    <Text style={styles.infoTileLabel}>{label}</Text>
    <Text style={styles.infoTileValue}>{value}</Text>
    {sub ? <Text style={styles.infoTileSub}>{sub}</Text> : null}
  </View>
);

const MetricTile = ({
  icon,
  label,
  value,
  color,
  bg,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  value: number;
  color: string;
  bg: string;
}) => (
  <View style={[styles.metricTile, { backgroundColor: bg }]}>
    <View style={styles.metricTop}>
      <MaterialCommunityIcons name={icon} size={20} color={color} />
    </View>
    <Text style={[styles.metricValue, { color }]}>{value.toLocaleString()}</Text>
    <Text style={styles.metricLabel}>{label}</Text>
  </View>
);

const MiniStat = ({ value, label, color = INK }: { value: number; label: string; color?: string }) => (
  <View style={styles.miniStat}>
    <Text style={[styles.miniStatValue, { color }]}>{value}</Text>
    <Text style={styles.miniStatLabel}>{label}</Text>
  </View>
);

const StepTitle = ({ n, title, done, optional }: { n: number; title: string; done?: boolean; optional?: boolean }) => (
  <View style={styles.stepTitleRow}>
    <View style={[styles.stepNum, done && styles.stepNumDone]}>
      {done ? <Ionicons name="checkmark" size={14} color={WHITE} /> : <Text style={styles.stepNumText}>{n}</Text>}
    </View>
    <Text style={styles.stepTitle}>{title}</Text>
    {optional ? <Text style={styles.stepOptional}>Optional</Text> : null}
  </View>
);

const CountInput = ({ label, value, onChange, danger }: { label: string; value: string; onChange: (v: string) => void; danger?: boolean }) => (
  <View style={{ flex: 1 }}>
    <Text style={[styles.inputLabel, danger && { color: DANGER }]}>{label}</Text>
    <TextInput
      style={styles.input}
      placeholder="0"
      placeholderTextColor={FAINT}
      keyboardType="numeric"
      value={value}
      onChangeText={onChange}
    />
  </View>
);

const PhotoPickerField = ({
  title,
  hint,
  image,
  onCamera,
  onLibrary,
  onRemove,
}: {
  title: string;
  hint: string;
  image: ImagePicker.ImagePickerAsset | null;
  onCamera: () => void;
  onLibrary: () => void;
  onRemove: () => void;
}) => (
  <View>
    <View style={styles.photoHead}>
      <Text style={styles.photoTitle}>{title}</Text>
      <View style={[styles.photoPill, image && { backgroundColor: "#F0FDF4" }]}>
        <Ionicons name={image ? "checkmark-circle" : "alert-circle-outline"} size={11} color={image ? SUCCESS : WARNING} />
        <Text style={[styles.photoPillText, image && { color: SUCCESS }]}>{image ? "Attached" : "Required"}</Text>
      </View>
    </View>
    {image ? (
      <View style={styles.previewCard}>
        <View>
          <Image source={{ uri: image.uri }} style={styles.uploadPreview} />
          <TouchableOpacity style={styles.previewRemove} onPress={onRemove} hitSlop={8}>
            <Ionicons name="close" size={16} color={WHITE} />
          </TouchableOpacity>
        </View>
        <View style={styles.previewActions}>
          <TouchableOpacity style={styles.previewActionBtn} onPress={onCamera}>
            <Ionicons name="camera-outline" size={15} color={PRIMARY} />
            <Text style={styles.previewActionText}>Retake</Text>
          </TouchableOpacity>
          <View style={styles.previewActionDivider} />
          <TouchableOpacity style={styles.previewActionBtn} onPress={onLibrary}>
            <Ionicons name="images-outline" size={15} color={PRIMARY} />
            <Text style={styles.previewActionText}>Choose Another</Text>
          </TouchableOpacity>
        </View>
      </View>
    ) : (
      <>
        <Text style={styles.photoHint}>{hint}</Text>
        <View style={styles.sourceRow}>
          <TouchableOpacity style={[styles.sourceBtn, styles.sourceBtnPrimary]} onPress={onCamera} activeOpacity={0.8}>
            <View style={[styles.sourceIcon, { backgroundColor: "rgba(255,255,255,0.15)" }]}>
              <Ionicons name="camera" size={20} color={WHITE} />
            </View>
            <Text style={[styles.sourceText, { color: WHITE }]}>Take Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sourceBtn} onPress={onLibrary} activeOpacity={0.8}>
            <View style={styles.sourceIcon}>
              <Ionicons name="images" size={20} color={PRIMARY} />
            </View>
            <Text style={styles.sourceText}>Choose from Library</Text>
          </TouchableOpacity>
        </View>
      </>
    )}
  </View>
);

// ─ Main Component ───────────────────────────────────────────────────────
export default function SiteMonitoringDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id, site_id } = useLocalSearchParams<{ id?: string; site_id?: string }>();
  const currentSiteId = id || site_id;
  const { success, error: showError, warning } = useAlert();

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
      showError("Couldn't load site", err.message || "Failed to load site details.");
      router.replace("/(tabs)/monitoring");
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

  const launchPicker = async (type: "proof" | "agreement", source: "camera" | "library") => {
    try {
      const options: any = { quality: 0.7, allowsEditing: true };
      let result;
      if (source === "camera") {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) return warning("Camera permission needed", "Allow camera access to take a photo.");
        result = await ImagePicker.launchCameraAsync(options);
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) return warning("Photo access needed", "Allow photo library access to choose a photo.");
        result = await ImagePicker.launchImageLibraryAsync({ ...options, mediaTypes: ImagePicker.MediaTypeOptions.Images });
      }
      if (!result.canceled && result.assets?.[0]) {
        type === "proof" ? setProofImage(result.assets[0]) : setAgreementImage(result.assets[0]);
      }
    } catch (err) {
      showError("Photo error", "Something went wrong selecting the image.");
    }
  };

  // ✅ FIX 3: STRICT Validation to prevent negative calculations
  const handleAddSpeciesToReport = () => {
    if (!selectedSpeciesId) return warning("Select a species", "Tap a tree species first.");

    const found = allTreeSpecies.find((s) => s.tree_specie_id === Number(selectedSpeciesId));
    if (!found) return;

    const planted = visitType === "initial" && !hasExistingSiteInitialReport ? parseInt(tempPlanted) || 0 : 0;
    const added = (visitType === "ongoing" || (visitType === "initial" && hasExistingSiteInitialReport)) ? parseInt(tempAdded) || 0 : 0;
    const dead = parseInt(tempDead) || 0;

    if (visitType === "inactive_check" && dead === 0) {
      return warning("Dead count required", "Enter the number of dead trees for this species.");
    }

    const totalAccounted = planted + added;
    const hasHistory = checkSpeciesHasPlantingHistory(found.tree_specie_id);

    // BLOCK 1: If dead trees exceed the trees accounted for in THIS entry AND there is no history
    if (dead > totalAccounted && !hasHistory) {
      return showError(
        "Entry blocked",
        `${dead} dead "${found.name}" but only ${totalAccounted} accounted for, and this species has no planting history here. Dead trees can't exceed planted — please verify the counts.`,
        6000
      );
    }

    // BLOCK 2: Block dead-only entries without actual planting history
    if (dead > 0 && totalAccounted === 0 && !hasHistory) {
      return showError(
        "Entry blocked",
        `"${found.name}" has never been planted at this site, so it can't have dead trees. Verify the species or add the planting count first.`,
        6000
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
    if (reportSpeciesList.length === 0) return warning("No species added", "Add at least one species to the report.");
    if (visitType === "initial" && !orientationConducted) return warning("Orientation not confirmed", "Tick the box confirming the orientation was conducted.");
    if (visitType === "initial" && !agreementImage) return warning("Agreement photo missing", "Attach a photo of the signed agreement.");
    if (!proofImage) return warning("Site photo missing", "Attach a proof photo of the site for this visit.");
    
    if (speciesWithWarnings.length > 0) {
      return showError(
        "Can't submit yet",
        `${speciesWithWarnings.length} species ${speciesWithWarnings.length === 1 ? "has" : "have"} validation errors. Fix the highlighted entries first.`,
        5000
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

      success("Report submitted", "It's now pending Data Manager review.");
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
    } catch (err: any) {
      showError("Submission failed", err.message || "Failed to submit report.");
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
  const totalPlanted = metrics.total_planted + metrics.total_added;
  const survival = Math.max(0, Math.min(100, metrics.survival_rate || 0));
  const survivalColor = survival >= 80 ? SUCCESS : survival >= 50 ? WARNING : DANGER;
  const breakdownMax = Math.max(1, ...(seedling_requests_breakdown || []).map((b) => b.total_requested));
  const lastReport = progress_reports.find((r) => r.status === "accepted");
  const canSubmit = !submitting && reportSpeciesList.length > 0 && !!proofImage && !hasBlockingErrors;

  const visitMeta = {
    initial: { label: "Initial Orientation", sub: "Baseline planting + signed agreement", icon: "calendar" as const, color: PRIMARY, bg: "#ECFDF5" },
    ongoing: { label: "Ongoing Monitoring", sub: "Record trees added and dead since last visit", icon: "leaf" as const, color: SUCCESS, bg: "#F0FDF4" },
    inactive_check: { label: "Independent Site Check", sub: "No active program — record dead trees only", icon: "pause-circle" as const, color: MUTED, bg: "#F3F4F6" },
  }[visitType];

  // Step numbers shift when the agreement step is shown
  const showAgreementStep = visitType === "initial" && hasActiveApplication;
  const stepSpecies = showAgreementStep ? 2 : 1;
  const stepRemarks = stepSpecies + 1;
  const stepPhoto = stepSpecies + 2;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchDetail(true); }} tintColor={PRIMARY} />}
      >
        {/* ── Hero ─────────────────────────────────────────────── */}
        <View style={[styles.hero, { paddingTop: insets.top + 8 }]}>
          <View style={styles.heroTopRow}>
            <TouchableOpacity style={styles.heroBack} onPress={() => router.replace("/(tabs)/monitoring")}>
              <Ionicons name="chevron-back" size={20} color={WHITE} />
            </TouchableOpacity>
            <StatusBadge status={programStatus} />
          </View>

          <Text style={styles.heroEyebrow}>Site Monitoring</Text>
          <Text style={styles.heroTitle} numberOfLines={2}>{site.name}</Text>
          <View style={styles.heroLocation}>
            <Ionicons name="location" size={14} color="rgba(255,255,255,0.8)" />
            <Text style={styles.heroLocationText} numberOfLines={1}>
              {site.reforestation_area_name || "Unknown area"}
              {site.barangay_name ? ` · Brgy. ${site.barangay_name}` : ""}
            </Text>
          </View>

          <View style={styles.heroChips}>
            <View style={styles.heroChip}>
              <Ionicons name="resize-outline" size={13} color={WHITE} />
              <Text style={styles.heroChipText}>{site.total_area_hectares.toFixed(2)} ha</Text>
            </View>
            <View style={styles.heroChip}>
              <Ionicons name="document-text-outline" size={13} color={WHITE} />
              <Text style={styles.heroChipText}>{progress_reports.length} reports</Text>
            </View>
            {lastReport && (
              <View style={styles.heroChip}>
                <Ionicons name="time-outline" size={13} color={WHITE} />
                <Text style={styles.heroChipText}>Last {formatShortDate(lastReport.submitted_at)}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.body}>
          {/* ── Site details ─────────────────────────────────── */}
          <View style={styles.card}>
            <CardTitle icon="information-circle-outline" title="Site Details" />
            <View style={styles.tileGrid}>
              <InfoTile icon="business-outline" label="Area" value={site.reforestation_area_name || "Unknown"} sub={site.barangay_name ? `Brgy. ${site.barangay_name}` : undefined} />
              <InfoTile icon="resize-outline" label="Total Area" value={`${site.total_area_hectares.toFixed(2)} ha`} />
              <InfoTile icon="layers-outline" label="Land Class" value={site.land_classification_name || "Not classified"} />
              <InfoTile icon="car-outline" label="Accessibility" value={getAccessibilityText(site.accessibility)} />
            </View>
          </View>

          {/* ── Tree grower ──────────────────────────────────── */}
          {current_application ? (
            <View style={styles.growerCard}>
              <View style={styles.growerAvatar}>
                <Ionicons name="people" size={20} color={PRIMARY} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.growerEyebrow}>Current Tree Grower</Text>
                <Text style={styles.growerName} numberOfLines={1}>{current_application.group_name}</Text>
                <Text style={styles.growerContact}>{current_application.group_contact || "No contact on file"}</Text>
              </View>
              {!!current_application.group_contact && (
                <TouchableOpacity
                  style={styles.callBtn}
                  onPress={() => Linking.openURL(`tel:${current_application.group_contact}`)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="call" size={16} color={WHITE} />
                  <Text style={styles.callBtnText}>Call</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={[styles.growerCard, { backgroundColor: "#F9FAFB" }]}>
              <View style={[styles.growerAvatar, { backgroundColor: "#F3F4F6" }]}>
                <Ionicons name="person-remove-outline" size={20} color={MUTED} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.growerEyebrow}>Tree Grower</Text>
                <Text style={[styles.growerName, { color: MUTED }]}>No active program</Text>
              </View>
            </View>
          )}

          {/* ── Lifetime metrics ─────────────────────────────── */}
          <View style={styles.card}>
            <CardTitle icon="stats-chart-outline" title="Lifetime Site Metrics" />
            <View style={styles.tileGrid}>
              <MetricTile icon="sprout" label="Seedlings Provided" value={total_seedlings_provided || 0} color="#047857" bg="#ECFDF5" />
              <MetricTile icon="tree" label="Total Planted" value={totalPlanted} color="#6D28D9" bg="#F5F3FF" />
              <MetricTile icon="close-circle-outline" label="Dead" value={metrics.total_dead} color="#B91C1C" bg="#FEF2F2" />
              <MetricTile icon="check-circle-outline" label="Survived" value={metrics.total_survived} color={SUCCESS} bg="#F0FDF4" />
            </View>

            <View style={styles.survivalWrap}>
              <View style={styles.survivalHead}>
                <Text style={styles.survivalLabel}>Overall Survival Rate</Text>
                <Text style={[styles.survivalValue, { color: survivalColor }]}>{survival.toFixed(1)}%</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${survival}%`, backgroundColor: survivalColor }]} />
              </View>
              <Text style={styles.survivalHint}>
                {totalPlanted === 0
                  ? "No accepted planting data yet."
                  : survival >= 80
                    ? "Healthy — keep up the maintenance."
                    : survival >= 50
                      ? "Moderate — check for causes of losses."
                      : "Low — site needs attention."}
              </Text>
            </View>
          </View>

          {/* ── Seedlings provided ───────────────────────────── */}
          {seedling_requests_breakdown && seedling_requests_breakdown.length > 0 && (
            <View style={styles.card}>
              <CardTitle icon="leaf-outline" title="Seedlings Provided" right={`${seedling_requests_breakdown.length} species`} />
              {seedling_requests_breakdown.map((item, idx) => (
                <View key={idx} style={styles.breakdownRow}>
                  <View style={styles.breakdownHead}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                      <MaterialCommunityIcons name="sprout" size={16} color={SUCCESS} />
                      <Text style={styles.breakdownName} numberOfLines={1}>{item.species_name}</Text>
                    </View>
                    <Text style={styles.breakdownCount}>{item.total_requested.toLocaleString()}</Text>
                  </View>
                  <View style={styles.breakdownTrack}>
                    <View style={[styles.breakdownFill, { width: `${(item.total_requested / breakdownMax) * 100}%` }]} />
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* ── Quick actions ────────────────────────────────── */}
          <View style={styles.quickRow}>
            <TouchableOpacity style={styles.quickTile} onPress={() => setShowSpeciesModal(true)} activeOpacity={0.8}>
              <View style={[styles.quickIcon, { backgroundColor: "#ECFDF5" }]}>
                <Ionicons name="analytics" size={20} color={PRIMARY} />
              </View>
              <Text style={styles.quickTitle}>Species Breakdown</Text>
              <Text style={styles.quickSub}>{lifetimeSpeciesStats.length} species tracked</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickTile} onPress={() => setShowHistoryModal(true)} activeOpacity={0.8}>
              <View style={[styles.quickIcon, { backgroundColor: "#EFF6FF" }]}>
                <Ionicons name="time" size={20} color={INFO} />
              </View>
              <Text style={styles.quickTitle}>Report History</Text>
              <Text style={styles.quickSub}>{progress_reports.length} submitted</Text>
            </TouchableOpacity>
          </View>

          {/* ── Report section ───────────────────────────────── */}
          <Text style={styles.blockTitle}>{hasPendingReport ? "Pending Report" : "Submit New Report"}</Text>

          {hasPendingReport && pendingReport ? (
            <View style={styles.pendingAlertBox}>
              <View style={styles.pendingAlertIcon}>
                <Ionicons name="hourglass-outline" size={28} color={WARNING} />
              </View>
              <Text style={styles.pendingAlertTitle}>Report Pending Review</Text>
              <Text style={styles.pendingAlertText}>
                You submitted a{" "}
                <Text style={{ fontWeight: "700" }}>
                  {pendingReport.visit_type === "initial" ? "Initial" : pendingReport.visit_type === "inactive_check" ? "Inactive Check" : "Ongoing"}
                </Text>{" "}
                report on {formatDate(pendingReport.submitted_at)}.
              </Text>
              <Text style={styles.pendingAlertFooter}>
                Please wait for the Data Manager to review it before submitting a new one.
              </Text>
            </View>
          ) : (
            <>
              {/* Visit type */}
              <View style={[styles.visitBanner, { backgroundColor: visitMeta.bg, borderColor: `${visitMeta.color}33` }]}>
                <View style={[styles.visitIcon, { backgroundColor: visitMeta.color }]}>
                  <Ionicons name={visitMeta.icon} size={18} color={WHITE} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.visitLabel, { color: visitMeta.color }]}>{visitMeta.label}</Text>
                  <Text style={styles.visitSub}>{visitMeta.sub}</Text>
                </View>
              </View>

              {!hasActiveApplication && (
                <View style={styles.infoBox}>
                  <Ionicons name="information-circle" size={18} color={INFO} />
                  <Text style={styles.infoBoxText}>
                    This site has no active tree planting program. This report will be logged as an{" "}
                    <Text style={{ fontWeight: "700" }}>Independent Site Check</Text>.
                  </Text>
                </View>
              )}

              {visitType === "initial" && hasExistingSiteInitialReport && (
                <View style={styles.infoBox}>
                  <Ionicons name="information-circle" size={18} color={INFO} />
                  <Text style={styles.infoBoxText}>
                    This site already has a baseline. Record only <Text style={{ fontWeight: "700" }}>new trees added</Text> by the group.
                  </Text>
                </View>
              )}

              {/* Step: Orientation & agreement */}
              {showAgreementStep && (
                <View style={styles.stepCard}>
                  <StepTitle n={1} title="Orientation & Agreement" done={orientationConducted && !!agreementImage} />
                  <TouchableOpacity style={[styles.checkboxRow, orientationConducted && styles.checkboxRowOn]} onPress={() => setOrientationConducted(!orientationConducted)} activeOpacity={0.7}>
                    <Ionicons name={orientationConducted ? "checkbox" : "square-outline"} size={22} color={PRIMARY} />
                    <Text style={styles.checkboxLabel}>I confirm that the orientation was conducted with the tree growers.</Text>
                  </TouchableOpacity>
                  <PhotoPickerField
                    title="Signed Agreement"
                    hint="Photo of the signed agreement form"
                    image={agreementImage}
                    onCamera={() => launchPicker("agreement", "camera")}
                    onLibrary={() => launchPicker("agreement", "library")}
                    onRemove={() => setAgreementImage(null)}
                  />
                </View>
              )}

              {/* Step: Species */}
              <View style={styles.stepCard}>
                <StepTitle n={stepSpecies} title="Report by Species" done={reportSpeciesList.length > 0 && !hasBlockingErrors} />

                <Text style={styles.subLabel}>Select species</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {allTreeSpecies.map((sp) => {
                      const selected = selectedSpeciesId === String(sp.tree_specie_id);
                      const added = reportSpeciesList.some((s) => s.tree_species_id === sp.tree_specie_id);
                      return (
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
                          style={[styles.speciesChip, selected && styles.speciesChipOn, !selected && added && styles.speciesChipAdded]}
                        >
                          {added && !selected && <Ionicons name="checkmark" size={12} color={SUCCESS} />}
                          <Text style={[styles.speciesChipText, selected && { color: WHITE }]}>{sp.name}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>

                <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
                  {visitType === "initial" && !hasExistingSiteInitialReport ? (
                    <CountInput label="Officially Planted *" value={tempPlanted} onChange={setTempPlanted} />
                  ) : (visitType === "ongoing" || (visitType === "initial" && hasExistingSiteInitialReport)) ? (
                    <CountInput label="Added by Grower" value={tempAdded} onChange={setTempAdded} />
                  ) : null}
                  <CountInput label={visitType === "inactive_check" ? "Dead Trees *" : "Dead Count *"} value={tempDead} onChange={setTempDead} danger />
                </View>

                <TouchableOpacity style={[styles.addSpeciesBtn, { opacity: selectedSpeciesId ? 1 : 0.5 }]} onPress={handleAddSpeciesToReport} disabled={!selectedSpeciesId}>
                  <Ionicons name={reportSpeciesList.some((s) => s.tree_species_id === Number(selectedSpeciesId)) ? "refresh" : "add-circle"} size={16} color={WHITE} />
                  <Text style={styles.addSpeciesBtnText}>
                    {reportSpeciesList.some((s) => s.tree_species_id === Number(selectedSpeciesId)) ? "Update Species" : "Add to Report"}
                  </Text>
                </TouchableOpacity>

                {reportSpeciesList.length > 0 && (
                  <View style={{ marginTop: 14 }}>
                    <Text style={styles.subLabel}>In this report ({reportSpeciesList.length})</Text>
                    {reportSpeciesList.map((sp, idx) => {
                      const hasWarning = speciesWithWarnings.includes(sp.tree_species_id);
                      return (
                        <View key={idx} style={[styles.addedSpeciesItem, hasWarning && styles.addedSpeciesWarn]}>
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                              <Text style={styles.addedSpeciesName}>{sp.species_name}</Text>
                              {hasWarning && <Ionicons name="warning" size={15} color={DANGER} />}
                            </View>
                            {hasWarning && <Text style={styles.warnText}>No planting history — verify species</Text>}
                            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                              {sp.no_planted > 0 && <Text style={styles.countBadgePrimary}>Planted {sp.no_planted}</Text>}
                              {sp.no_added_by_grower > 0 && <Text style={styles.countBadge}>Added {sp.no_added_by_grower}</Text>}
                              <Text style={styles.countBadgeDanger}>Dead {sp.no_dead}</Text>
                            </View>
                          </View>
                          <TouchableOpacity style={styles.removeBtn} onPress={() => setReportSpeciesList(reportSpeciesList.filter((_, i) => i !== idx))}>
                            <Ionicons name="trash-outline" size={18} color={DANGER} />
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>

              {/* Step: Remarks */}
              <View style={styles.stepCard}>
                <StepTitle n={stepRemarks} title="Remarks" optional done={description.trim().length > 0} />
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Plant condition, weather, missing seedlings, etc."
                  placeholderTextColor={FAINT}
                  multiline
                  numberOfLines={3}
                  value={description}
                  onChangeText={setDescription}
                />
              </View>

              {/* Step: Proof photo */}
              <View style={styles.stepCard}>
                <StepTitle n={stepPhoto} title="Site Photo" done={!!proofImage} />
                <PhotoPickerField
                  title="Proof Image"
                  hint="Group or site photo for this visit"
                  image={proofImage}
                  onCamera={() => launchPicker("proof", "camera")}
                  onLibrary={() => launchPicker("proof", "library")}
                  onRemove={() => setProofImage(null)}
                />
              </View>

              <TouchableOpacity
                style={[styles.submitBtn, !canSubmit && { opacity: 0.55 }]}
                onPress={handleSubmitReport}
                disabled={!canSubmit}
                activeOpacity={0.85}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={WHITE} />
                ) : (
                  <>
                    <Ionicons name={hasBlockingErrors ? "warning" : "paper-plane"} size={18} color={WHITE} />
                    <Text style={styles.submitBtnText}>{hasBlockingErrors ? "Fix Errors Before Submitting" : "Submit Report"}</Text>
                  </>
                )}
              </TouchableOpacity>
              {!canSubmit && !submitting && !hasBlockingErrors && (
                <Text style={styles.submitHint}>
                  {reportSpeciesList.length === 0 ? "Add at least one species" : "Attach a site photo"} to submit.
                </Text>
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* SPECIES BREAKDOWN MODAL */}
      <Modal visible={showSpeciesModal} animationType="slide" transparent={true} onRequestClose={() => setShowSpeciesModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Lifetime Species Breakdown</Text>
              <TouchableOpacity style={styles.modalClose} onPress={() => setShowSpeciesModal(false)}>
                <Ionicons name="close" size={20} color={INK} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScrollView}>
              {lifetimeSpeciesStats.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Ionicons name="leaf-outline" size={32} color={FAINT} />
                  <Text style={styles.emptyText}>No accepted reports with species data yet.</Text>
                </View>
              ) : (
                lifetimeSpeciesStats.map((stat, idx) => {
                  const c = stat.survival_rate >= 80 ? SUCCESS : stat.survival_rate >= 50 ? WARNING : DANGER;
                  return (
                    <View key={idx} style={styles.lifetimeSpeciesCard}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <Text style={styles.lifetimeSpeciesName}>{stat.species_name}</Text>
                        <Text style={[styles.survivalBadgeText, { color: c }]}>{stat.survival_rate.toFixed(1)}%</Text>
                      </View>
                      <View style={[styles.progressTrack, { marginBottom: 12 }]}>
                        <View style={[styles.progressFill, { width: `${Math.min(100, stat.survival_rate)}%`, backgroundColor: c }]} />
                      </View>
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <MiniStat value={stat.total_planted} label="Planted" />
                        <MiniStat value={stat.total_added} label="Added" />
                        <MiniStat value={stat.total_planted_sum} label="Total" color={PRIMARY} />
                        <MiniStat value={stat.total_dead} label="Dead" color={DANGER} />
                        <MiniStat value={stat.total_survived} label="Survived" color={SUCCESS} />
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* REPORT HISTORY MODAL */}
      <Modal visible={showHistoryModal} animationType="slide" transparent={true} onRequestClose={() => setShowHistoryModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Report History</Text>
              <TouchableOpacity style={styles.modalClose} onPress={() => setShowHistoryModal(false)}>
                <Ionicons name="close" size={20} color={INK} />
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
                  const typeColor = isInitial ? PRIMARY : report.visit_type === "inactive_check" ? MUTED : INFO;

                  return (
                    <View key={report.report_id} style={[styles.modalReportCard, { borderLeftColor: typeColor }]}>
                      <View style={styles.reportHeader}>
                        <Text style={[styles.reportType, { color: typeColor }]}>
                          {isInitial ? (isBaseline ? "Initial · Baseline" : "Initial") : report.visit_type === "inactive_check" ? "Inactive Check" : "Ongoing"}
                        </Text>
                        <View style={[styles.statusBadge, { backgroundColor: currentStatus.bg }]}>
                          <Text style={[styles.statusBadgeText, { color: currentStatus.text }]}>{currentStatus.label}</Text>
                        </View>
                      </View>
                      <Text style={styles.reportDate}>{formatDate(report.submitted_at)} · {report.inspector_name}</Text>
                      {report.application_title && <Text style={styles.applicationLink}>Linked to {report.application_title}</Text>}

                      <View style={styles.reportStats}>
                        <View style={styles.reportStat}>
                          <Text style={styles.reportStatValue}>
                            {isBaseline ? report.species.reduce((sum, sp) => sum + sp.no_planted, 0) : report.total_added_by_grower}
                          </Text>
                          <Text style={styles.reportStatLabel}>{isBaseline ? "Officially Planted" : "Added"}</Text>
                        </View>
                        <View style={styles.reportDivider} />
                        <View style={styles.reportStat}>
                          <Text style={[styles.reportStatValue, { color: DANGER }]}>{report.total_dead}</Text>
                          <Text style={styles.reportStatLabel}>Dead</Text>
                        </View>
                      </View>

                      {report.species && report.species.length > 0 && (
                        <View style={styles.reportSpeciesList}>
                          {report.species.map((sp, idx) => (
                            <View key={idx} style={styles.reportSpeciesItem}>
                              <Text style={styles.reportSpeciesName}>{sp.species_name}</Text>
                              <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                                {isBaseline && sp.no_planted > 0 && <Text style={styles.miniCountBadge}>Planted {sp.no_planted}</Text>}
                                {!isBaseline && sp.no_added_by_grower > 0 && <Text style={styles.miniCountBadge}>Added {sp.no_added_by_grower}</Text>}
                                <Text style={[styles.miniCountBadge, { backgroundColor: "#FEE2E2", color: DANGER, borderColor: "#FECACA" }]}>Dead {sp.no_dead}</Text>
                              </View>
                            </View>
                          ))}
                        </View>
                      )}

                      {report.description && (
                        <View style={styles.reportDescBox}>
                          <Ionicons name="chatbox-ellipses-outline" size={13} color={MUTED} />
                          <Text style={styles.reportDesc}>{report.description}</Text>
                        </View>
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
const cardShadow = {
  shadowColor: "#0F172A",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.05,
  shadowRadius: 8,
  elevation: 2,
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  // Hero
  hero: { backgroundColor: PRIMARY, paddingHorizontal: 20, paddingBottom: 48, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  heroTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  heroBack: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.15)", justifyContent: "center", alignItems: "center" },
  heroEyebrow: { fontSize: 11, fontWeight: "700", color: "rgba(255,255,255,0.65)", textTransform: "uppercase", letterSpacing: 1 },
  heroTitle: { fontSize: 26, fontWeight: "800", color: WHITE, letterSpacing: -0.5, marginTop: 4 },
  heroLocation: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 },
  heroLocationText: { fontSize: 13, color: "rgba(255,255,255,0.85)", fontWeight: "500", flex: 1 },
  heroChips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 },
  heroChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.14)" },
  heroChipText: { fontSize: 12, fontWeight: "600", color: WHITE },

  body: { paddingHorizontal: 16, marginTop: -30, gap: 14 },

  // Cards
  card: { backgroundColor: WHITE, borderRadius: 20, padding: 16, ...cardShadow },
  cardTitleRow: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  cardTitleIcon: { width: 28, height: 28, borderRadius: 9, backgroundColor: "#ECFDF5", justifyContent: "center", alignItems: "center", marginRight: 10 },
  cardTitle: { fontSize: 15, fontWeight: "800", color: INK, flex: 1 },
  cardTitleRight: { fontSize: 12, color: FAINT, fontWeight: "600" },

  // No column gap: two 48% tiles + space-between always fit on one row
  tileGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 10 },
  infoTile: { width: "48%", backgroundColor: "#F9FAFB", borderRadius: 14, padding: 12, borderWidth: 1, borderColor: "#F1F5F9" },
  infoTileLabel: { fontSize: 10.5, fontWeight: "700", color: FAINT, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 8 },
  infoTileValue: { fontSize: 14, fontWeight: "700", color: INK, marginTop: 2 },
  infoTileSub: { fontSize: 11.5, color: MUTED, marginTop: 1 },

  metricTile: { width: "48%", borderRadius: 14, padding: 12 },
  metricTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  metricValue: { fontSize: 24, fontWeight: "800", marginTop: 6, letterSpacing: -0.5 },
  metricLabel: { fontSize: 11, color: MUTED, fontWeight: "600", marginTop: 1 },

  survivalWrap: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: "#F1F5F9" },
  survivalHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 },
  survivalLabel: { fontSize: 13, fontWeight: "700", color: INK },
  survivalValue: { fontSize: 20, fontWeight: "800" },
  survivalHint: { fontSize: 11.5, color: MUTED, marginTop: 8 },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: "#F1F5F9", overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 4 },

  // Grower
  growerCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: WHITE, borderRadius: 20, padding: 14, ...cardShadow },
  growerAvatar: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#ECFDF5", justifyContent: "center", alignItems: "center" },
  growerEyebrow: { fontSize: 10.5, fontWeight: "700", color: FAINT, textTransform: "uppercase", letterSpacing: 0.5 },
  growerName: { fontSize: 15, fontWeight: "800", color: INK, marginTop: 1 },
  growerContact: { fontSize: 12, color: MUTED, marginTop: 1 },
  callBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: PRIMARY, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12 },
  callBtnText: { color: WHITE, fontSize: 13, fontWeight: "700" },

  // Breakdown
  breakdownRow: { marginBottom: 12 },
  breakdownHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  breakdownName: { fontSize: 13.5, fontWeight: "600", color: INK, flex: 1 },
  breakdownCount: { fontSize: 14, fontWeight: "800", color: "#047857" },
  breakdownTrack: { height: 6, borderRadius: 3, backgroundColor: "#F1F5F9", overflow: "hidden" },
  breakdownFill: { height: "100%", borderRadius: 3, backgroundColor: "#34D399" },

  // Quick actions
  quickRow: { flexDirection: "row", gap: 12 },
  quickTile: { flex: 1, backgroundColor: WHITE, borderRadius: 18, padding: 14, ...cardShadow },
  quickIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center", marginBottom: 10 },
  quickTitle: { fontSize: 14, fontWeight: "800", color: INK },
  quickSub: { fontSize: 11.5, color: MUTED, marginTop: 2 },

  // Report section
  blockTitle: { fontSize: 18, fontWeight: "800", color: INK, marginTop: 8, letterSpacing: -0.3 },
  visitBanner: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 16, borderWidth: 1 },
  visitIcon: { width: 36, height: 36, borderRadius: 11, justifyContent: "center", alignItems: "center" },
  visitLabel: { fontSize: 14.5, fontWeight: "800" },
  visitSub: { fontSize: 12, color: MUTED, marginTop: 1 },

  infoBox: { flexDirection: "row", gap: 10, padding: 12, backgroundColor: "#EFF6FF", borderRadius: 14, borderWidth: 1, borderColor: "#DBEAFE" },
  infoBoxText: { fontSize: 12.5, color: "#1E40AF", fontWeight: "500", flex: 1, lineHeight: 18 },

  stepCard: { backgroundColor: WHITE, borderRadius: 20, padding: 16, ...cardShadow },
  stepTitleRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  stepNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: "#F1F5F9", justifyContent: "center", alignItems: "center" },
  stepNumDone: { backgroundColor: SUCCESS },
  stepNumText: { fontSize: 12, fontWeight: "800", color: MUTED },
  stepTitle: { fontSize: 15, fontWeight: "800", color: INK, flex: 1 },
  stepOptional: { fontSize: 11, color: FAINT, fontWeight: "600" },

  checkboxRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 14, padding: 12, backgroundColor: "#F9FAFB", borderRadius: 14, borderWidth: 1, borderColor: BORDER },
  checkboxRowOn: { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" },
  checkboxLabel: { fontSize: 13.5, color: INK, fontWeight: "500", flex: 1, lineHeight: 19 },

  pendingAlertBox: { backgroundColor: "#FFFBEB", borderRadius: 20, padding: 20, borderWidth: 1, borderColor: "#FDE68A", alignItems: "center" },
  pendingAlertIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#FEF3C7", justifyContent: "center", alignItems: "center", marginBottom: 12 },
  pendingAlertTitle: { fontSize: 17, fontWeight: "800", color: WARNING, marginBottom: 6 },
  pendingAlertText: { fontSize: 14, color: INK, textAlign: "center", lineHeight: 20, marginBottom: 10 },
  pendingAlertFooter: { fontSize: 12, color: MUTED, textAlign: "center" },

  subLabel: { fontSize: 11.5, fontWeight: "700", color: MUTED, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.4 },
  inputLabel: { fontSize: 11.5, color: MUTED, marginBottom: 5, fontWeight: "600" },
  input: { backgroundColor: "#F9FAFB", borderWidth: 1.5, borderColor: BORDER, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: INK },
  textArea: { height: 96, textAlignVertical: "top", fontSize: 14 },

  speciesChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18, backgroundColor: WHITE, borderWidth: 1, borderColor: BORDER },
  speciesChipOn: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  speciesChipAdded: { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" },
  speciesChipText: { color: INK, fontSize: 12.5, fontWeight: "600" },

  addSpeciesBtn: { flexDirection: "row", backgroundColor: PRIMARY, paddingVertical: 12, borderRadius: 12, alignItems: "center", justifyContent: "center", gap: 6 },
  addSpeciesBtnText: { color: WHITE, fontWeight: "700", fontSize: 13.5 },

  addedSpeciesItem: { flexDirection: "row", alignItems: "center", backgroundColor: "#F9FAFB", padding: 12, borderRadius: 14, marginBottom: 8, borderWidth: 1, borderColor: BORDER },
  addedSpeciesWarn: { borderColor: "#FCA5A5", backgroundColor: "#FEF2F2" },
  addedSpeciesName: { fontSize: 14, fontWeight: "700", color: INK },
  warnText: { fontSize: 11, color: DANGER, marginTop: 3, fontWeight: "600" },
  removeBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: "#FEF2F2", justifyContent: "center", alignItems: "center", marginLeft: 8 },
  countBadge: { fontSize: 11, fontWeight: "600", color: MUTED, backgroundColor: WHITE, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: BORDER, overflow: "hidden" },
  countBadgePrimary: { fontSize: 11, fontWeight: "600", color: PRIMARY, backgroundColor: "#ECFDF5", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: "#A7F3D0", overflow: "hidden" },
  countBadgeDanger: { fontSize: 11, fontWeight: "600", color: DANGER, backgroundColor: "#FEF2F2", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: "#FECACA", overflow: "hidden" },

  // Photo picker
  photoHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  photoTitle: { fontSize: 13, fontWeight: "700", color: INK },
  photoHint: { fontSize: 11.5, color: MUTED, marginBottom: 10 },
  photoPill: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, backgroundColor: "#FFFBEB" },
  photoPillText: { fontSize: 10.5, fontWeight: "700", color: WARNING },
  sourceRow: { flexDirection: "row", gap: 10 },
  sourceBtn: { flex: 1, alignItems: "center", paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderColor: BORDER, backgroundColor: WHITE },
  sourceBtnPrimary: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  sourceIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#ECFDF5", justifyContent: "center", alignItems: "center", marginBottom: 6 },
  sourceText: { fontSize: 12.5, fontWeight: "700", color: INK },
  previewCard: { borderRadius: 14, borderWidth: 1.5, borderColor: "#BBF7D0", overflow: "hidden" },
  uploadPreview: { width: "100%", height: 180 },
  previewRemove: { position: "absolute", top: 8, right: 8, width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", alignItems: "center" },
  previewActions: { flexDirection: "row", borderTopWidth: 1, borderTopColor: BORDER, backgroundColor: WHITE },
  previewActionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 11 },
  previewActionDivider: { width: 1, backgroundColor: BORDER },
  previewActionText: { fontSize: 12.5, fontWeight: "700", color: PRIMARY },

  submitBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: PRIMARY, borderRadius: 16, paddingVertical: 16, gap: 8, marginTop: 4, shadowColor: PRIMARY, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  submitBtnText: { color: WHITE, fontWeight: "800", fontSize: 16 },
  submitHint: { fontSize: 12, color: MUTED, textAlign: "center", marginTop: -4 },

  emptyBox: { alignItems: "center", padding: 32, backgroundColor: "#F9FAFB", borderRadius: 14 },
  emptyText: { marginTop: 8, color: MUTED, fontSize: 13, textAlign: "center" },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.5)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: WHITE, borderTopLeftRadius: 26, borderTopRightRadius: 26, maxHeight: "85%", paddingBottom: 32 },
  modalHandle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: BORDER, marginTop: 10 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  modalTitle: { fontSize: 17, fontWeight: "800", color: INK },
  modalClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#F3F4F6", justifyContent: "center", alignItems: "center" },
  modalScrollView: { padding: 16 },

  modalReportCard: { backgroundColor: "#F9FAFB", borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: "#F1F5F9", borderLeftWidth: 4 },
  reportHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  reportDate: { fontSize: 12, color: MUTED, fontWeight: "600" },
  reportType: { fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.4 },
  applicationLink: { fontSize: 11.5, color: INFO, fontWeight: "500", marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusBadgeText: { fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
  reportStats: { flexDirection: "row", alignItems: "center", marginTop: 12, marginBottom: 4, backgroundColor: WHITE, borderRadius: 12, paddingVertical: 10 },
  reportStat: { flex: 1, alignItems: "center" },
  reportStatValue: { fontSize: 18, fontWeight: "800", color: PRIMARY },
  reportStatLabel: { fontSize: 10.5, color: MUTED, marginTop: 2, fontWeight: "600" },
  reportDivider: { width: 1, height: 30, backgroundColor: BORDER },
  reportDescBox: { flexDirection: "row", gap: 6, marginTop: 10 },
  reportDesc: { fontSize: 12, color: MUTED, lineHeight: 17, flex: 1 },

  lifetimeSpeciesCard: { backgroundColor: "#F9FAFB", borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#F1F5F9" },
  lifetimeSpeciesName: { fontSize: 15, fontWeight: "800", color: INK },
  survivalBadgeText: { fontSize: 14, fontWeight: "800" },
  miniStat: { alignItems: "center", minWidth: 52 },
  miniStatValue: { fontSize: 16, fontWeight: "800", color: INK },
  miniStatLabel: { fontSize: 10, color: MUTED, marginTop: 2 },

  reportSpeciesList: { marginTop: 10 },
  reportSpeciesItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 5 },
  reportSpeciesName: { fontSize: 13, fontWeight: "600", color: INK, flex: 1 },
  miniCountBadge: { fontSize: 10.5, fontWeight: "600", color: MUTED, backgroundColor: WHITE, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: BORDER, overflow: "hidden" },
});

const badgeStyles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontSize: 10.5, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
});
