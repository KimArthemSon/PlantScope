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
import FloatingMapButton, { MapPoint } from "@/components/FloatingMapButton";
import PlantedAreaCapture, { PlantedAreaPoint, PreviousArea, MIN_AREA_POINTS } from "@/components/forms/PlantedAreaCapture";
import ReportPolygonMapModal from "@/components/forms/ReportPolygonMapModal";
import { useNetworkStatus, checkNetworkStatus } from "@/utils/networkStatus";
import {
  getSavedSite,
  saveSiteOffline,
  removeSavedSite,
  updateSavedSiteDetail,
  cacheTreeSpecies,
  getCachedTreeSpecies,
  getQueuedReports,
  queueReport,
  removeQueuedReport,
  syncQueuedReports,
  buildReportFormData,
  QueuedReport,
} from "@/utils/offlineMonitoring";

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
  polygon_coordinates: [number, number][] | null;
  planted_area_hectares: number | null;
  review_stage: "data_manager" | "gis_specialist" | "done";
  dm_review: ReviewStep;
  gis_review: ReviewStep;
}

interface ReviewStep {
  status: "pending" | "approved" | "changes_requested" | "not_required";
  notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
}

interface SiteMonitoringDetail {
  site: {
    site_id: number;
    name: string;
    description: string | null;
    total_area_hectares: number;
    polygon_coordinates: [number, number][] | null;
    reforestation_area_id: number | null;
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
    planted_area_hectares: number | null;
    planted_area_percent: number | null;
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
  // Data Manager's completed/failed recommendation, waiting on the City ENRO Head
  closure_request?: {
    status: "pending" | "approved" | "returned";
    recommendation: "completed" | "failed";
    requested_at: string | null;
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

const REVIEW_LOOK: Record<ReviewStep["status"], { icon: keyof typeof Ionicons.glyphMap; color: string; label: string }> = {
  pending: { icon: "time-outline", color: WARNING, label: "Waiting" },
  approved: { icon: "checkmark-circle", color: SUCCESS, label: "Approved" },
  changes_requested: { icon: "close-circle", color: DANGER, label: "Changes requested" },
  not_required: { icon: "remove-circle-outline", color: FAINT, label: "Not required" },
};

const ReviewStepRow = ({ n, label, step, active }: { n: number; label: string; step?: ReviewStep; active?: boolean }) => {
  const look = REVIEW_LOOK[step?.status || "pending"];
  return (
    <View style={[styles.reviewRow, active && { borderColor: look.color }]}>
      <Text style={styles.reviewRowNum}>{n}</Text>
      <Text style={styles.reviewRowLabel}>{label}</Text>
      <Ionicons name={look.icon} size={15} color={look.color} />
      <Text style={[styles.reviewRowStatus, { color: look.color }]}>{active ? "In review" : look.label}</Text>
    </View>
  );
};

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
  const { success, error: showError, warning, confirm } = useAlert();

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
  const [areaPoints, setAreaPoints] = useState<PlantedAreaPoint[]>([]);
  const [mapReport, setMapReport] = useState<SiteProgressReport | null>(null);

  // Offline
  const isOnline = useNetworkStatus();
  const [offlineCopyAt, setOfflineCopyAt] = useState<string | null>(null); // set when showing the saved copy
  const [isSavedOffline, setIsSavedOffline] = useState(false);
  const [savingOffline, setSavingOffline] = useState(false);
  const [queuedReport, setQueuedReport] = useState<QueuedReport | null>(null);
  const [syncingQueue, setSyncingQueue] = useState(false);

  // species id → why that entry can't be submitted
  const [speciesErrors, setSpeciesErrors] = useState<Record<number, string>>({});
  const speciesWithWarnings = Object.keys(speciesErrors).map(Number);

  const hasActiveApplication = !!detail?.current_application;
  const hasPendingReport = detail?.progress_reports.some((r) => r.status === "pending") || false;
  // Recommended for completion/failure → no new reports until the Head decides
  const finalReviewPending = detail?.closure_request?.status === "pending";
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

  // Which counts this visit may record (must match the backend rules)
  const allowPlantedCount = visitType === "initial" && !hasExistingSiteInitialReport;
  const allowAddedCount = visitType === "ongoing" || (visitType === "initial" && hasExistingSiteInitialReport);

  // Trees of a species still alive at this site, from accepted reports
  const getSpeciesStanding = (speciesId: number) => {
    const stat = calculateLifetimeSpeciesBreakdown().find((s) => s.species_id === speciesId);
    return {
      everPlanted: stat ? stat.total_planted_sum : 0,
      dead: stat ? stat.total_dead : 0,
      alive: stat ? Math.max(0, stat.total_planted_sum - stat.total_dead) : 0,
    };
  };

  /**
   * Why a species entry can't go into the report, or null if it's fine.
   * Keeps lifetime totals sane: dead can never exceed the trees actually alive.
   */
  const validateSpeciesEntry = (speciesId: number, name: string, planted: number, added: number, dead: number): string | null => {
    if ([planted, added, dead].some((n) => !Number.isInteger(n))) return "Use whole numbers only.";
    if (planted < 0 || added < 0 || dead < 0) return "Counts can't be negative.";
    if (planted > 0 && !allowPlantedCount)
      return "Officially planted trees can only be recorded on the site's first initial visit. Use \"Added by Grower\" instead.";
    if (added > 0 && !allowAddedCount)
      return visitType === "inactive_check"
        ? "An inactive check can only record dead trees."
        : "Trees added by the grower can't be recorded on the first initial visit. Use \"Officially Planted\".";
    if (visitType === "inactive_check" && dead === 0) return "Enter the number of dead trees.";
    if (planted + added + dead === 0) return "Enter at least one count.";

    const { everPlanted, alive } = getSpeciesStanding(speciesId);
    const aliveNow = alive + planted + added;
    if (dead > aliveNow) {
      if (everPlanted === 0 && planted + added === 0)
        return `"${name}" has never been planted at this site, so none can be dead. Check the species.`;
      if (alive === 0 && planted + added === 0)
        return `All ${everPlanted} "${name}" recorded here are already dead (0 alive). No more can be reported dead.`;
      return `${dead} dead, but only ${aliveNow} "${name}" are alive (${alive} from past reports${planted + added > 0 ? ` + ${planted + added} in this entry` : ""}).`;
    }
    return null;
  };

  // Re-check the whole list whenever it, the visit type, or the site data changes
  // (covers reports loaded for resubmission and visit-type switches)
  useEffect(() => {
    const errors: Record<number, string> = {};
    reportSpeciesList.forEach((sp) => {
      const err = validateSpeciesEntry(sp.tree_species_id, sp.species_name, sp.no_planted, sp.no_added_by_grower, sp.no_dead);
      if (err) errors[sp.tree_species_id] = err;
    });
    setSpeciesErrors(errors);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportSpeciesList, detail, visitType, hasExistingSiteInitialReport]);

  const fetchDetail = async (isRefresh = false) => {
    if (!currentSiteId) {
      setLoading(false);
      return;
    }

    if (!isRefresh) setLoading(true);
    refreshOfflineState();
    try {
      let data: any;
      try {
        if (!(await checkNetworkStatus())) throw new Error("offline");
        const token = await SecureStore.getItemAsync("token");
        if (!token) throw new Error("No authentication token found.");

        const res = await fetch(`${api}/api/get_site_monitoring_details/${currentSiteId}/`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to load site details.");
        data = await res.json();
        setOfflineCopyAt(null);
        updateSavedSiteDetail(Number(currentSiteId), data); // keep the offline copy fresh
      } catch (loadErr) {
        // No signal or server unreachable: use the copy saved on the phone
        const saved = await getSavedSite(currentSiteId);
        if (!saved) throw loadErr instanceof Error && loadErr.message !== "offline" ? loadErr : new Error("You're offline and this site isn't saved on your phone.");
        data = saved.detail;
        setOfflineCopyAt(saved.saved_at);
      }
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
      if (!res.ok) throw new Error("Failed to load species");
      const list = await res.json();
      setAllTreeSpecies(list);
      cacheTreeSpecies(list);
    } catch {
      setAllTreeSpecies(await getCachedTreeSpecies());
    }
  };

  const refreshOfflineState = async () => {
    if (!currentSiteId) return;
    setIsSavedOffline(!!(await getSavedSite(currentSiteId)));
    const queue = await getQueuedReports();
    setQueuedReport(queue.find((q) => String(q.site_id) === String(currentSiteId)) ?? null);
  };

  const toggleSaveOffline = async () => {
    if (!detail) return;
    if (isSavedOffline) {
      await removeSavedSite(detail.site.site_id);
      setIsSavedOffline(false);
      success("Offline copy removed", "This site now needs internet to open.");
      return;
    }
    if (!isOnline) return warning("You're offline", "Connect to the internet to save this site.");
    setSavingOffline(true);
    try {
      await saveSiteOffline(detail.site.site_id);
      setIsSavedOffline(true);
      success("Saved for offline", "You can open this site and fill in a report without internet.");
    } catch (err: any) {
      showError("Couldn't save site", err.message || "Try again with a better connection.");
    } finally {
      setSavingOffline(false);
    }
  };

  const handleSyncQueued = async () => {
    setSyncingQueue(true);
    try {
      const { uploaded } = await syncQueuedReports();
      await refreshOfflineState();
      if (uploaded > 0) {
        success("Report uploaded", "It's now waiting for Data Manager review.");
        fetchDetail(true);
      } else {
        const q = (await getQueuedReports()).find((r) => String(r.site_id) === String(currentSiteId));
        if (q?.last_error) showError("Upload failed", q.last_error, 6000);
      }
    } finally {
      setSyncingQueue(false);
    }
  };

  const discardQueued = () => {
    if (!queuedReport) return;
    confirm(
      "Delete offline report?",
      "This report hasn't been uploaded. Deleting it can't be undone.",
      async () => {
        await removeQueuedReport(queuedReport.local_id);
        refreshOfflineState();
      },
      { type: "error", confirmText: "Delete", cancelText: "Cancel" }
    );
  };

  // Back online with a queued report for this site → upload it
  useEffect(() => {
    if (isOnline && queuedReport && !syncingQueue) handleSyncQueued();
  }, [isOnline]);

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

  // A report sent back for changes isn't thrown away: copy its species counts,
  // remarks and planted-area corners into the form so the inspector only fixes what was flagged.
  const loadReportForResubmit = (report: SiteProgressReport) => {
    const allowPlanted = visitType === "initial" && !hasExistingSiteInitialReport;
    const allowAdded = visitType === "ongoing" || (visitType === "initial" && hasExistingSiteInitialReport);
    let dropped = false;

    const species: ReportSpeciesItem[] = report.species.map((sp) => {
      const planted = allowPlanted ? sp.no_planted || 0 : 0;
      const added = allowAdded ? sp.no_added_by_grower || 0 : 0;
      if (planted !== (sp.no_planted || 0) || added !== (sp.no_added_by_grower || 0)) dropped = true;
      return { tree_species_id: sp.species_id, species_name: sp.species_name, no_planted: planted, no_added_by_grower: added, no_dead: sp.no_dead || 0 };
    });

    setReportSpeciesList(species);
    setDescription(report.description || "");
    setAreaPoints(
      (report.polygon_coordinates || []).map(([lat, lng], i) => ({ id: `prev-${report.report_id}-${i}`, latitude: Number(lat), longitude: Number(lng) }))
    );
    setSelectedSpeciesId("");
    setTempPlanted("");
    setTempAdded("");
    setTempDead("");
    setShowHistoryModal(false);

    if (dropped) {
      warning("Some counts not copied", "This visit type records different counts. Re-check the species entries.", 6000);
    } else {
      success("Previous report loaded", "Fix what was requested, then re-attach the photos and submit.", 5000);
    }
  };

  // ✅ FIX 3: STRICT Validation to prevent negative calculations
  const handleAddSpeciesToReport = () => {
    if (!selectedSpeciesId) return warning("Select a species", "Tap a tree species first.");

    const found = allTreeSpecies.find((s) => s.tree_specie_id === Number(selectedSpeciesId));
    if (!found) return;

    // Blank = 0; anything else must be a whole number (validated below)
    const toCount = (v: string) => (v.trim() === "" ? 0 : Number(v.trim()));
    const planted = allowPlantedCount ? toCount(tempPlanted) : 0;
    const added = allowAddedCount ? toCount(tempAdded) : 0;
    const dead = toCount(tempDead);

    const entryError = validateSpeciesEntry(found.tree_specie_id, found.name, planted, added, dead);
    if (entryError) return showError("Entry blocked", entryError, 6000);

    // Not blocking: planting more than ENRO provided may mean a typo (growers' own seedlings go under "Added")
    const provided = (detail?.seedling_requests_breakdown || []).find((b) => b.species_id === found.tree_specie_id)?.total_requested;
    if (planted > 0 && provided != null && planted > provided) {
      warning("Check the count", `${planted} "${found.name}" planted, but only ${provided} were provided. Make sure the number is right.`, 6000);
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

  // saveOffline = true keeps the report on the phone instead of uploading now
  const handleSubmitReport = async (saveOffline = false) => {
    if (!detail) return;
    if (finalReviewPending)
      return warning("Reporting paused", "This site is waiting for the City ENRO Head's final decision.");
    if (reportSpeciesList.length === 0) return warning("No species added", "Add at least one species to the report.");
    if (visitType === "initial" && !orientationConducted) return warning("Orientation not confirmed", "Tick the box confirming the orientation was conducted.");
    if (visitType === "initial" && !agreementImage) return warning("Agreement photo missing", "Attach a photo of the signed agreement.");
    if (!proofImage) return warning("Site photo missing", "Attach a proof photo of the site for this visit.");
    if (areaPoints.length < MIN_AREA_POINTS)
      return warning("Planted area missing", `Mark at least ${MIN_AREA_POINTS} corners of the planted area.`);

    if (speciesWithWarnings.length > 0) {
      return showError(
        "Can't submit yet",
        `${speciesWithWarnings.length} species ${speciesWithWarnings.length === 1 ? "has" : "have"} validation errors. Fix the highlighted entries first.`,
        5000
      );
    }

    const resetForm = () => {
      setAreaPoints([]);
      setReportSpeciesList([]);
      setDescription("");
      setProofImage(null);
      setAgreementImage(null);
      setOrientationConducted(false);
      setTempPlanted("");
      setTempAdded("");
      setTempDead("");
      setSelectedSpeciesId("");
      setSpeciesErrors({});
    };

    const report: Omit<QueuedReport, "local_id" | "created_at"> = {
      site_id: detail.site.site_id,
      site_name: detail.site.name,
      fields: {
        application_id: detail.current_application?.application_id ?? null,
        visit_type: visitType,
        orientation_conducted: orientationConducted,
        report_species: reportSpeciesList.map((sp) => ({
          tree_species_id: sp.tree_species_id,
          no_planted: sp.no_planted,
          no_added_by_grower: sp.no_added_by_grower,
          no_survived: 0,
          no_dead: sp.no_dead,
        })),
        description,
        polygon_coordinates: areaPoints.map((p) => [p.latitude, p.longitude]),
      },
      proof_image_uri: proofImage.uri,
      agreement_image_uri: visitType === "initial" && agreementImage ? agreementImage.uri : null,
    };

    const saveToQueue = async (reason: string) => {
      try {
        await queueReport(report);
      } catch (err: any) {
        showError("Couldn't save on your phone", err?.message || "Check your phone's free storage and try again.");
        return;
      }
      resetForm();
      await refreshOfflineState();
      success("Saved offline", `${reason}It will upload automatically when you're back online.`, 6000);
    };

    setSubmitting(true);
    try {
      if (saveOffline || !(await checkNetworkStatus())) {
        await saveToQueue(saveOffline ? "" : "You're offline. ");
        return;
      }

      const token = await SecureStore.getItemAsync("token");
      let res: Response;
      // Weak signal can make an upload hang forever; give up after 60s and keep the report
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 60000);
      try {
        res = await fetch(`${api}/api/create_progress_report/`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: buildReportFormData({ ...report, local_id: "", created_at: "" }),
          signal: controller.signal,
        });
      } catch {
        // No connection / signal dropped mid-upload: don't lose the inspector's work
        await saveToQueue("The connection is too weak to upload. ");
        return;
      } finally {
        clearTimeout(timer);
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submission failed.");

      success("Report submitted", "It will be reviewed by the Data Manager, then the GIS Specialist.");
      resetForm();
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
  const hasArea = areaPoints.length >= MIN_AREA_POINTS;
  // Areas the inspector can start from: the site's own boundary, then earlier reports' planted areas
  const sitePolygonPoints: [number, number][] = (() => {
    const raw = site.polygon_coordinates;
    if (!Array.isArray(raw) || raw.length < MIN_AREA_POINTS) return [];
    const pts = raw.map(([a, b]) => [Number(a), Number(b)] as [number, number]).filter(([a, b]) => !isNaN(a) && !isNaN(b));
    // Stored as [lat, lng]; swap if it looks like [lng, lat]
    const swapped = pts.length > 0 && Math.abs(pts[0][0]) > 90 ? pts.map(([a, b]) => [b, a] as [number, number]) : pts;
    // Drop a repeated closing point
    const last = swapped[swapped.length - 1];
    return swapped.length > MIN_AREA_POINTS && last[0] === swapped[0][0] && last[1] === swapped[0][1] ? swapped.slice(0, -1) : swapped;
  })();
  const previousAreas: PreviousArea[] = [
    ...(sitePolygonPoints.length >= MIN_AREA_POINTS
      ? [{
          id: site.site_id,
          source: "site" as const,
          siteName: site.name,
          date: null,
          status: "site",
          visitType: "",
          inspector: "",
          hectares: site.total_area_hectares || null,
          points: sitePolygonPoints,
        }]
      : []),
    ...progress_reports
      .filter((r) => (r.polygon_coordinates?.length ?? 0) >= MIN_AREA_POINTS)
      .map((r) => ({
        id: r.report_id,
        source: "report" as const,
        date: r.submitted_at || r.created_at,
        status: r.status,
        visitType: r.visit_type,
        inspector: r.inspector_name,
        hectares: r.planted_area_hectares,
        points: r.polygon_coordinates as [number, number][],
      })),
  ];
  const canSubmit = !submitting && reportSpeciesList.length > 0 && !!proofImage && hasArea && !hasBlockingErrors;

  // Most recent report sent back for changes, so the inspector can see why
  const latestReport = progress_reports[0];
  const changesRequested =
    latestReport && latestReport.status === "rejected"
      ? latestReport.gis_review?.status === "changes_requested"
        ? { by: "GIS Specialist", notes: latestReport.gis_review.notes }
        : { by: "Data Manager", notes: latestReport.dm_review?.notes }
      : null;

  const mapPoints: MapPoint[] = areaPoints.map((p, i) => ({
    id: `area-${p.id}`,
    type: "polygon_vertex",
    latitude: p.latitude,
    longitude: p.longitude,
    label: `Corner ${i + 1}`,
    accuracy: p.accuracy,
    description: "Planted area corner",
  }));

  const visitMeta = {
    initial: { label: "Initial Orientation", sub: "Baseline planting + signed agreement", icon: "calendar" as const, color: PRIMARY, bg: "#ECFDF5" },
    ongoing: { label: "Ongoing Monitoring", sub: "Record trees added and dead since last visit", icon: "leaf" as const, color: SUCCESS, bg: "#F0FDF4" },
    inactive_check: { label: "Independent Site Check", sub: "No active program — record dead trees only", icon: "pause-circle" as const, color: MUTED, bg: "#F3F4F6" },
  }[visitType];

  // Step numbers shift when the agreement step is shown
  const showAgreementStep = visitType === "initial" && hasActiveApplication;
  const stepSpecies = showAgreementStep ? 2 : 1;
  const stepArea = stepSpecies + 1;
  const stepRemarks = stepSpecies + 2;
  const stepPhoto = stepSpecies + 3;

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
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <TouchableOpacity style={[styles.heroSave, isSavedOffline && styles.heroSaveOn]} onPress={toggleSaveOffline} disabled={savingOffline} activeOpacity={0.8}>
                {savingOffline ? (
                  <ActivityIndicator size="small" color={WHITE} />
                ) : (
                  <Ionicons name={isSavedOffline ? "cloud-done" : "cloud-download-outline"} size={14} color={isSavedOffline ? PRIMARY : WHITE} />
                )}
                <Text style={[styles.heroSaveText, isSavedOffline && { color: PRIMARY }]}>{isSavedOffline ? "Saved" : "Save offline"}</Text>
              </TouchableOpacity>
              <StatusBadge status={programStatus} />
            </View>
          </View>

          {offlineCopyAt && (
            <View style={styles.offlineCopyBanner}>
              <Ionicons name="cloud-offline-outline" size={14} color={WHITE} />
              <Text style={styles.offlineCopyText}>
                Offline copy from {new Date(offlineCopyAt).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              </Text>
            </View>
          )}

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
            {metrics.planted_area_hectares != null && (
              <View style={styles.heroChip}>
                <MaterialCommunityIcons name="vector-polygon" size={13} color={WHITE} />
                <Text style={styles.heroChipText}>{metrics.planted_area_hectares.toFixed(2)} ha planted</Text>
              </View>
            )}
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
              <InfoTile
                icon="resize-outline"
                label="Total Area"
                value={`${site.total_area_hectares.toFixed(2)} ha`}
                sub={
                  metrics.planted_area_hectares != null
                    ? `${metrics.planted_area_hectares.toFixed(2)} ha planted${metrics.planted_area_percent != null ? ` (${metrics.planted_area_percent}%)` : ""}`
                    : "Planted area not yet confirmed"
                }
              />
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

            <View style={styles.areaMetric}>
              <View style={styles.areaMetricIcon}>
                <MaterialCommunityIcons name="vector-polygon" size={20} color="#0F766E" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.metricLabel}>Total Area Planted</Text>
                <Text style={styles.areaMetricValue}>
                  {metrics.planted_area_hectares != null ? `${metrics.planted_area_hectares.toFixed(2)} ha` : "—"}
                </Text>
                <Text style={styles.areaMetricSub}>
                  {metrics.planted_area_hectares != null
                    ? `${metrics.planted_area_percent != null ? `${metrics.planted_area_percent}% of ${site.total_area_hectares.toFixed(2)} ha site · ` : ""}from latest confirmed map`
                    : "No confirmed planted-area map yet"}
                </Text>
              </View>
            </View>
            {metrics.planted_area_percent != null && (
              <View style={[styles.progressTrack, { marginTop: 8 }]}>
                <View style={[styles.progressFill, { width: `${Math.min(100, metrics.planted_area_percent)}%`, backgroundColor: "#14B8A6" }]} />
              </View>
            )}

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
          <Text style={styles.blockTitle}>
            {finalReviewPending && !queuedReport ? "Reporting Paused" : queuedReport ? "Waiting to Upload" : hasPendingReport ? "Pending Report" : "Submit New Report"}
          </Text>

          {finalReviewPending && !queuedReport ? (
            <View style={styles.pausedBox}>
              <View style={[styles.pendingAlertIcon, { backgroundColor: "#E0E7FF" }]}>
                <Ionicons name="lock-closed" size={26} color="#4338CA" />
              </View>
              <Text style={[styles.pendingAlertTitle, { color: "#4338CA" }]}>Waiting for City ENRO Head</Text>
              <Text style={styles.pendingAlertText}>
                The Data Manager recommended marking this program as{" "}
                <Text style={{ fontWeight: "800" }}>{detail.closure_request?.recommendation === "failed" ? "failed" : "completed"}</Text>
                {detail.closure_request?.requested_at ? ` on ${formatDate(detail.closure_request.requested_at)}` : ""}.
              </Text>
              <Text style={styles.pendingAlertFooter}>
                New reports are paused until the Head decides. If the program is returned for more monitoring, you can report again.
              </Text>
            </View>
          ) : queuedReport ? (
            <View style={styles.queuedBox}>
              <View style={[styles.pendingAlertIcon, { backgroundColor: "#DBEAFE" }]}>
                <Ionicons name="cloud-upload-outline" size={28} color={INFO} />
              </View>
              <Text style={[styles.pendingAlertTitle, { color: INFO }]}>Saved on your phone</Text>
              <Text style={styles.pendingAlertText}>
                Report from {formatDate(queuedReport.created_at)} hasn't been uploaded yet.{" "}
                {isOnline ? "Tap Upload now to send it." : "It will upload when you're back online."}
              </Text>
              {queuedReport.last_error && (
                <Text style={styles.queuedError}>Last upload failed: {queuedReport.last_error}</Text>
              )}
              <View style={[styles.changesActions, { alignSelf: "stretch" }]}>
                <TouchableOpacity style={styles.changesBtn} onPress={discardQueued} activeOpacity={0.8}>
                  <Ionicons name="trash-outline" size={15} color={DANGER} />
                  <Text style={[styles.changesBtnText, { color: DANGER }]}>Delete</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.changesBtn, styles.changesBtnPrimary, (!isOnline || syncingQueue) && { opacity: 0.5 }]}
                  onPress={handleSyncQueued}
                  disabled={!isOnline || syncingQueue}
                  activeOpacity={0.8}
                >
                  {syncingQueue ? <ActivityIndicator size="small" color={WHITE} /> : <Ionicons name="cloud-upload" size={15} color={WHITE} />}
                  <Text style={[styles.changesBtnText, { color: WHITE }]}>{isOnline ? "Upload now" : "No signal"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : hasPendingReport && pendingReport ? (
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
              <View style={styles.reviewSteps}>
                <ReviewStepRow n={1} label="Data Manager" step={pendingReport.dm_review} active={pendingReport.review_stage === "data_manager"} />
                <ReviewStepRow n={2} label="GIS Specialist (map)" step={pendingReport.gis_review} active={pendingReport.review_stage === "gis_specialist"} />
              </View>
              <Text style={styles.pendingAlertFooter}>
                {pendingReport.review_stage === "gis_specialist"
                  ? "Approved by the Data Manager. Waiting for the GIS Specialist to confirm the planted area."
                  : "Please wait for the Data Manager to review it before submitting a new one."}
              </Text>
            </View>
          ) : (
            <>
              {changesRequested && (
                <View style={styles.changesBox}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <Ionicons name="return-down-back" size={18} color={DANGER} />
                    <Text style={styles.changesTitle}>Changes requested by {changesRequested.by}</Text>
                  </View>
                  <Text style={styles.changesNotes}>{changesRequested.notes || "No note was given."}</Text>
                  <View style={styles.changesActions}>
                    <TouchableOpacity style={[styles.changesBtn, styles.changesBtnPrimary]} onPress={() => loadReportForResubmit(latestReport)} activeOpacity={0.8}>
                      <Ionicons name="create-outline" size={15} color={WHITE} />
                      <Text style={[styles.changesBtnText, { color: WHITE }]}>Edit & Resubmit</Text>
                    </TouchableOpacity>
                    {(latestReport.polygon_coordinates?.length ?? 0) >= 3 && (
                      <TouchableOpacity style={styles.changesBtn} onPress={() => setMapReport(latestReport)} activeOpacity={0.8}>
                        <Ionicons name="map-outline" size={15} color={PRIMARY} />
                        <Text style={styles.changesBtnText}>View Map</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={styles.changesFooter}>Edit & Resubmit fills the form below with this report's data. Photos need to be attached again.</Text>
                </View>
              )}

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

                {/* How many of the selected species are still alive, so the inspector knows the limit */}
                {selectedSpeciesId !== "" && (() => {
                  const st = getSpeciesStanding(Number(selectedSpeciesId));
                  return (
                    <Text style={[styles.standingText, st.everPlanted > 0 && st.alive === 0 && { color: DANGER }]}>
                      {st.everPlanted === 0
                        ? "Not planted here yet — it can't have dead trees until it's planted."
                        : `Alive at this site: ${st.alive} of ${st.everPlanted} (${st.dead} already dead)${st.alive === 0 ? " — no more can be reported dead" : ""}`}
                    </Text>
                  );
                })()}

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
                            {hasWarning && <Text style={styles.warnText}>{speciesErrors[sp.tree_species_id]}</Text>}
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

              {/* Step: Planted area boundary */}
              <View style={styles.stepCard}>
                <StepTitle n={stepArea} title="Planted Area Boundary" done={hasArea} />
                <PlantedAreaCapture
                  points={areaPoints}
                  onChange={setAreaPoints}
                  siteAreaHectares={site.total_area_hectares || undefined}
                  previousAreas={previousAreas}
                />
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
                style={[styles.submitBtn, !isOnline && styles.submitBtnOffline, !canSubmit && { opacity: 0.55 }]}
                onPress={() => handleSubmitReport(!isOnline)}
                disabled={!canSubmit}
                activeOpacity={0.85}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={WHITE} />
                ) : (
                  <>
                    <Ionicons name={hasBlockingErrors ? "warning" : isOnline ? "paper-plane" : "save"} size={18} color={WHITE} />
                    <Text style={styles.submitBtnText}>
                      {hasBlockingErrors ? "Fix Errors Before Submitting" : isOnline ? "Submit Report" : "Save Offline"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {!isOnline && (
                <Text style={styles.submitHint}>
                  You're offline. The report and photos are kept on your phone and upload automatically when you're back online.
                </Text>
              )}

              {/* Weak signal in the field: let the inspector choose to keep it on the phone */}
              {isOnline && canSubmit && (
                <TouchableOpacity style={styles.saveOfflineLink} onPress={() => handleSubmitReport(true)} disabled={submitting} activeOpacity={0.7}>
                  <Ionicons name="save-outline" size={15} color={PRIMARY} />
                  <Text style={styles.saveOfflineLinkText}>Weak signal? Save offline and upload later</Text>
                </TouchableOpacity>
              )}

              {!canSubmit && !submitting && !hasBlockingErrors && (
                <Text style={styles.submitHint}>
                  {reportSpeciesList.length === 0
                    ? "Add at least one species"
                    : !hasArea
                      ? `Mark at least ${MIN_AREA_POINTS} corners of the planted area`
                      : "Attach a site photo"}{" "}
                  to {isOnline ? "submit" : "save"}.
                </Text>
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* SPECIES BREAKDOWN MODAL */}
      <Modal visible={showSpeciesModal} animationType="slide" transparent={true} onRequestClose={() => setShowSpeciesModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 32 }]}>
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
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 32 }]}>
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

                      {report.planted_area_hectares != null && (
                        <View style={styles.reportDescBox}>
                          <MaterialCommunityIcons name="vector-polygon" size={13} color={MUTED} />
                          <Text style={styles.reportDesc}>
                            Planted area: {report.planted_area_hectares.toFixed(4)} ha ({report.polygon_coordinates?.length || 0} points)
                          </Text>
                        </View>
                      )}

                      {report.description && (
                        <View style={styles.reportDescBox}>
                          <Ionicons name="chatbox-ellipses-outline" size={13} color={MUTED} />
                          <Text style={styles.reportDesc}>{report.description}</Text>
                        </View>
                      )}

                      {[
                        { by: "Data Manager", step: report.dm_review },
                        { by: "GIS Specialist", step: report.gis_review },
                      ]
                        .filter((r) => r.step?.status === "changes_requested")
                        .map((r) => (
                          <View key={r.by} style={styles.reportReviewNote}>
                            <Text style={styles.reportReviewNoteTitle}>Changes requested · {r.by}</Text>
                            <Text style={styles.reportReviewNoteText}>{r.step.notes || "No note given."}</Text>
                          </View>
                        ))}

                      {((report.polygon_coordinates?.length ?? 0) >= 3 || (report.status === "rejected" && report.report_id === latestReport?.report_id && !hasPendingReport && !finalReviewPending)) && (
                        <View style={styles.changesActions}>
                          {(report.polygon_coordinates?.length ?? 0) >= 3 && (
                            <TouchableOpacity style={styles.changesBtn} onPress={() => setMapReport(report)} activeOpacity={0.8}>
                              <Ionicons name="map-outline" size={15} color={PRIMARY} />
                              <Text style={styles.changesBtnText}>View on Map</Text>
                            </TouchableOpacity>
                          )}
                          {report.status === "rejected" && report.report_id === latestReport?.report_id && !hasPendingReport && !finalReviewPending && (
                            <TouchableOpacity style={[styles.changesBtn, styles.changesBtnPrimary]} onPress={() => loadReportForResubmit(report)} activeOpacity={0.8}>
                              <Ionicons name="create-outline" size={15} color={WHITE} />
                              <Text style={[styles.changesBtnText, { color: WHITE }]}>Edit & Resubmit</Text>
                            </TouchableOpacity>
                          )}
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

      {/* Map of one report's planted-area polygon (opened from history or the changes banner) */}
      <ReportPolygonMapModal
        visible={!!mapReport}
        onClose={() => setMapReport(null)}
        title={mapReport ? `${mapReport.visit_type === "initial" ? "Initial" : mapReport.visit_type === "inactive_check" ? "Inactive Check" : "Ongoing"} · ${formatDate(mapReport.submitted_at)}` : ""}
        subtitle={site.name}
        reportPolygon={mapReport?.polygon_coordinates}
        sitePolygon={site.polygon_coordinates}
        areaHectares={mapReport?.planted_area_hectares}
      />

      {/* Map preview of the planted-area corners (same viewer as Boundary Verification) */}
      {site.reforestation_area_id != null && !hasPendingReport && !finalReviewPending && (
        <FloatingMapButton
          areaId={site.reforestation_area_id}
          areaName={site.reforestation_area_name || undefined}
          siteId={site.site_id}
          siteName={site.name}
          mapPoints={mapPoints}
          initialOpen={false}
        />
      )}
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

  submitBtnOffline: { backgroundColor: "#1D4ED8", shadowColor: "#1D4ED8" },
  saveOfflineLink: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10 },
  saveOfflineLinkText: { fontSize: 13, fontWeight: "700", color: PRIMARY },
  heroSave: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.15)" },
  heroSaveOn: { backgroundColor: WHITE },
  heroSaveText: { fontSize: 11, fontWeight: "700", color: WHITE },
  offlineCopyBanner: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", backgroundColor: "rgba(0,0,0,0.25)", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 10 },
  offlineCopyText: { fontSize: 11.5, color: WHITE, fontWeight: "600" },
  pausedBox: { backgroundColor: "#EEF2FF", borderRadius: 20, padding: 20, borderWidth: 1, borderColor: "#C7D2FE", alignItems: "center" },
  queuedBox: { backgroundColor: "#EFF6FF", borderRadius: 20, padding: 20, borderWidth: 1, borderColor: "#BFDBFE", alignItems: "center" },
  queuedError: { fontSize: 12, color: DANGER, textAlign: "center", marginBottom: 4 },
  areaMetric: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 10, padding: 12, borderRadius: 14, backgroundColor: "#F0FDFA" },
  areaMetricIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#CCFBF1", justifyContent: "center", alignItems: "center" },
  areaMetricValue: { fontSize: 22, fontWeight: "800", color: "#0F766E", letterSpacing: -0.5, marginTop: 1 },
  areaMetricSub: { fontSize: 11, color: MUTED, marginTop: 1 },
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
  reviewSteps: { alignSelf: "stretch", gap: 6, marginBottom: 10 },
  reviewRow: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: WHITE, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: BORDER },
  reviewRowNum: { fontSize: 11, fontWeight: "800", color: MUTED, width: 14 },
  reviewRowLabel: { fontSize: 13, fontWeight: "700", color: INK, flex: 1 },
  reviewRowStatus: { fontSize: 11.5, fontWeight: "700" },
  changesBox: { backgroundColor: "#FEF2F2", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: "#FECACA" },
  changesTitle: { fontSize: 14, fontWeight: "800", color: DANGER, flex: 1 },
  changesNotes: { fontSize: 13.5, color: INK, lineHeight: 19 },
  changesFooter: { fontSize: 11.5, color: MUTED, marginTop: 8 },
  changesActions: { flexDirection: "row", gap: 8, marginTop: 12 },
  changesBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, borderColor: BORDER, backgroundColor: WHITE },
  changesBtnPrimary: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  changesBtnText: { fontSize: 13, fontWeight: "700", color: PRIMARY },
  reportReviewNote: { marginTop: 10, padding: 10, borderRadius: 10, backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA" },
  reportReviewNoteTitle: { fontSize: 11, fontWeight: "800", color: DANGER, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 3 },
  reportReviewNoteText: { fontSize: 12.5, color: INK, lineHeight: 17 },

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
  standingText: { fontSize: 11.5, color: MUTED, fontWeight: "600", marginTop: -4, marginBottom: 12 },
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
