import React, { useState, useEffect } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
  Alert,
  Dimensions,
  Linking,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/constants/url_fixed";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const PRIMARY = "#0F4A2F";
const INK = "#111827";
const MUTED = "#6B7280";
const FAINT = "#9CA3AF";
const WHITE = "#FFFFFF";
const BG = "#F4F7F5";
const BORDER = "#E5E7EB";

// ─── Types ──────────────────────────────────────────────────────────────────

interface SeedlingSpeciesItem {
  species_id: number;
  species_name: string;
  quantity: number;
  provided_by: string;
}

interface RequestDetail {
  request_id: number;
  application_title: string;
  status: "pending" | "accepted" | "rejected" | "confirmed" | "cancelled";
  fulfillment_type: "pickup" | "deliver" | null;
  no_request_seedling: number;
  description: string | null;
  reason: string | null;
  reason_accepted: string | null;
  proof_of_delivery: string | null;
  submitted_at: string | null;
  assigned_inspector: {
    inspector_id: number;
    name: string;
    contact: string;
    email: string;
  } | null;
  species: SeedlingSpeciesItem[];
  grower_info: {
    group_name: string;
    group_contact: string;
    representative_name: string;
    representative_contact: string;
  };
  site_info: {
    site_name: string;
    barangay: string;
  };
}

// ─── Helpers & Components ───────────────────────────────────────────────────

const statusConfig: Record<
  string,
  { label: string; bg: string; text: string; dot: string }
> = {
  pending: {
    label: "Pending Review",
    bg: "#FFF8E1",
    text: "#F59E0B",
    dot: "#F59E0B",
  },
  accepted: {
    label: "Approved",
    bg: "#F0FDF4",
    text: "#16A34A",
    dot: "#16A34A",
  },
  confirmed: {
    label: "Confirmed",
    bg: "#EFF6FF",
    text: "#2563EB",
    dot: "#2563EB",
  },
  rejected: {
    label: "Rejected",
    bg: "#FEF2F2",
    text: "#DC2626",
    dot: "#DC2626",
  },
  cancelled: {
    label: "Cancelled",
    bg: "#F3F4F6",
    text: "#4B5563",
    dot: "#9CA3AF",
  },
};

const getStatusConf = (status: string) =>
  statusConfig[status] ?? {
    label: status,
    bg: "#F5F5F5",
    text: "#555",
    dot: "#999",
  };

const formatDate = (iso: string) =>
  !iso
    ? "—"
    : new Date(iso).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

const getTotalSeedlings = (species: SeedlingSpeciesItem[]) =>
  species.reduce((sum, item) => sum + (item.quantity || 0), 0);

const StatusBadge = ({ status }: { status: string }) => {
  const conf = getStatusConf(status);
  return (
    <View style={[badgeStyles.wrap, { backgroundColor: conf.bg }]}>
      <View style={[badgeStyles.dot, { backgroundColor: conf.dot }]} />
      <Text style={[badgeStyles.text, { color: conf.text }]}>{conf.label}</Text>
    </View>
  );
};

// ─── Original Floating Progress Timeline (with card, shadow, scroll) ────────
const FloatingProgressTimeline = ({ status }: { status: string }) => {
  const isRejected = status === "rejected" || status === "cancelled";

  const steps = isRejected
    ? [
        { key: "submitted", label: "Submitted", icon: "document-text" },
        { key: "pending", label: "Pending", icon: "time" },
        {
          key: "rejected",
          label: status === "rejected" ? "Rejected" : "Cancelled",
          icon: "close-circle",
        },
      ]
    : [
        { key: "submitted", label: "Submitted", icon: "document-text" },
        { key: "pending", label: "Pending", icon: "time" },
        { key: "accepted", label: "Approved", icon: "checkmark-circle" },
        { key: "confirmed", label: "Confirmed", icon: "checkmark-done-circle" },
      ];

  const statusOrder = isRejected
    ? ["submitted", "pending", "rejected"]
    : ["submitted", "pending", "accepted", "confirmed"];

  const lookupStatus = status === "cancelled" ? "rejected" : status;
  const currentIndex = statusOrder.indexOf(lookupStatus);

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
                    isRejected && isActive && { backgroundColor: "#DC2626" },
                    isRejected &&
                      isCurrent && {
                        backgroundColor: "#DC2626",
                        borderColor: "#FECACA",
                      },
                  ]}
                >
                  <Ionicons
                    name={step.icon as any}
                    size={isCurrent ? 16 : 13}
                    color={isActive ? "#fff" : "#D1D5DB"}
                  />
                </View>
                <Text
                  style={[
                    floatTimelineStyles.stepLabel,
                    isActive && floatTimelineStyles.stepLabelActive,
                    isCurrent && floatTimelineStyles.stepLabelCurrent,
                    isRejected && isActive && { color: "#DC2626" },
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
                      isRejected &&
                        index < currentIndex && { backgroundColor: "#DC2626" },
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

// ─── Section Components ───────────────────────────────────────────────────

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

// ─── Main Component ─────────────────────────────────────────────────────────

export default function SeedlingRequestDetail() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const params = useLocalSearchParams();
  const requestId = params.id as string;

  const [request, setRequest] = useState<RequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      const token = await SecureStore.getItemAsync("token");
      if (!token) return;

      const res = await fetch(`${api}/api/requests/${requestId}/detail/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load request details");
      const data = await res.json();
      setRequest(data);
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Could not load request details.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (requestId) fetchData();
  }, [requestId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={PRIMARY} />
        <Text style={styles.loadingText}>Loading request details…</Text>
      </View>
    );
  }

  if (!request) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={48} color={MUTED} />
        <Text style={styles.errorTitle}>Request Not Found</Text>
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={() => router.replace("/tree_growers/seedlingRequests")}
        >
          <Text style={styles.retryText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isApprovedOrConfirmed =
    request.status === "accepted" || request.status === "confirmed";

  const isRejectedOrCancelled =
    request.status === "rejected" || request.status === "cancelled";

  return (
    <View style={styles.container}>
      {/* Compact Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.replace("/tree_growers/seedlingRequests")}
        >
          <Ionicons name="chevron-back" size={22} color={INK} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Request Details</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchData(true);
            }}
            tintColor={PRIMARY}
          />
        }
      >
        {/* Floating Progress Timeline (original card design) */}
        <View style={styles.timelineWrapper}>
          <FloatingProgressTimeline status={request.status} />
        </View>

        {/* Content Area (flat, no radius, flush) */}
        <View style={styles.contentArea}>
          {/* ── Application Info ── */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <SectionHeader title="APPLICATION" icon="document-text-outline" />
              <StatusBadge status={request.status} />
            </View>
            <Text style={styles.appTitle}>{request.application_title}</Text>
            <InfoRow
              icon="business-outline"
              label="Group"
              value={request.grower_info.group_name}
            />
            <InfoRow
              icon="location-outline"
              label="Site"
              value={`${request.site_info.site_name}, ${request.site_info.barangay}`}
            />
            <InfoRow
              icon="calendar-outline"
              label="Submitted"
              value={formatDate(request.submitted_at || "")}
            />
          </View>

          <SectionDivider />

          {/* ── Inspector Contact (if Approved/Confirmed) ── */}
          {isApprovedOrConfirmed && request.assigned_inspector && (
            <>
              <View style={styles.section}>
                <SectionHeader
                  title="ASSIGNED INSPECTOR"
                  icon="shield-checkmark-outline"
                />

                <View style={styles.inspectorRow}>
                  <View style={styles.inspectorAvatar}>
                    <Ionicons name="person" size={22} color={PRIMARY} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inspectorName}>
                      {request.assigned_inspector.name}
                    </Text>
                    <Text style={styles.inspectorEmail} numberOfLines={1}>
                      {request.assigned_inspector.email}
                    </Text>
                  </View>
                </View>

                {request.assigned_inspector.contact ? (
                  <View style={styles.actionButtonsRow}>
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() =>
                        Linking.openURL(
                          `tel:${request.assigned_inspector.contact}`,
                        )
                      }
                    >
                      <Ionicons name="call-outline" size={18} color={PRIMARY} />
                      <Text style={styles.actionBtnText}>Call</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() =>
                        Linking.openURL(
                          `sms:${request.assigned_inspector.contact}`,
                        )
                      }
                    >
                      <Ionicons
                        name="chatbubble-outline"
                        size={18}
                        color={PRIMARY}
                      />
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
            </>
          )}

          {/* ── Fulfillment Method (if Approved/Confirmed) ── */}
          {isApprovedOrConfirmed && request.fulfillment_type && (
            <>
              <View style={styles.section}>
                <SectionHeader
                  title="FULFILLMENT"
                  icon={
                    request.fulfillment_type === "deliver"
                      ? "car-outline"
                      : "home-outline"
                  }
                />
                <View style={styles.fulfillmentRow}>
                  <View
                    style={[
                      styles.fulfillmentIconWrap,
                      request.fulfillment_type === "deliver"
                        ? { backgroundColor: "#F0FDF4" }
                        : { backgroundColor: "#F5F3FF" },
                    ]}
                  >
                    <Ionicons
                      name={
                        request.fulfillment_type === "deliver"
                          ? "car-outline"
                          : "home-outline"
                      }
                      size={22}
                      color={PRIMARY}
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <Text style={styles.fulfillmentTitle}>
                      {request.fulfillment_type === "deliver"
                        ? "Delivered to Site"
                        : "Grower Pickup"}
                    </Text>
                    <Text style={styles.fulfillmentSub}>
                      {request.fulfillment_type === "deliver"
                        ? "Seedlings will be brought directly to your assigned site."
                        : "Please coordinate with the inspector to pick up seedlings from the nursery."}
                    </Text>
                  </View>
                </View>
              </View>
              <SectionDivider />
            </>
          )}

          {/* ── Seedling Breakdown ── */}
          <View style={styles.section}>
            <SectionHeader title="SEEDLING BREAKDOWN" icon="leaf-outline" />
            {request.species.length > 0 ? (
              request.species.map((sp, i) => (
                <View
                  key={i}
                  style={[
                    styles.speciesRow,
                    i === request.species.length - 1 && {
                      borderBottomWidth: 0,
                    },
                  ]}
                >
                  <View style={styles.speciesIconWrap}>
                    <Ionicons name="leaf" size={16} color={PRIMARY} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.speciesName}>{sp.species_name}</Text>
                    <Text style={styles.speciesProvider}>
                      Provided by {sp.provided_by}
                    </Text>
                  </View>
                  <Text style={styles.speciesQty}>
                    x{sp.quantity.toLocaleString()}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>
                No species details available.
              </Text>
            )}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Seedlings</Text>
              <Text style={styles.totalValue}>
                {getTotalSeedlings(request.species).toLocaleString()}
              </Text>
            </View>
          </View>

          <SectionDivider />

          {/* ── Proof of Delivery (if Confirmed) ── */}
          {request.status === "confirmed" && request.proof_of_delivery && (
            <>
              <View style={styles.section}>
                <SectionHeader
                  title="PROOF OF DELIVERY"
                  icon="checkmark-done-outline"
                />
                <Image
                  source={{ uri: request.proof_of_delivery }}
                  style={styles.proofImage}
                  resizeMode="cover"
                />
                <Text style={styles.proofCaption}>
                  Verified by Onsite Inspector
                </Text>
              </View>
              <SectionDivider />
            </>
          )}

          {/* ── Reason / Notes ── */}
          {(request.reason || request.reason_accepted) && (
            <>
              <View
                style={[
                  styles.section,
                  isRejectedOrCancelled && styles.rejectSection,
                  !isRejectedOrCancelled && styles.noteSection,
                ]}
              >
                <View style={styles.sectionHeaderRow}>
                  <Ionicons
                    name="information-circle"
                    size={18}
                    color={isRejectedOrCancelled ? "#DC2626" : PRIMARY}
                  />
                  <Text
                    style={[
                      styles.sectionTitle,
                      {
                        marginLeft: 8,
                        color: isRejectedOrCancelled ? "#DC2626" : INK,
                      },
                    ]}
                  >
                    {isRejectedOrCancelled ? "REASON" : "DATA MANAGER NOTES"}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.reasonText,
                    {
                      color: isRejectedOrCancelled ? "#991B1B" : INK,
                    },
                  ]}
                >
                  {request.reason || request.reason_accepted}
                </Text>
              </View>
              <SectionDivider />
            </>
          )}

          {/* ── Description ── */}
          {request.description ? (
            <>
              <View style={styles.section}>
                <SectionHeader
                  title="REQUEST DESCRIPTION"
                  icon="document-text-outline"
                />
                <Text style={styles.descText}>{request.description}</Text>
              </View>
              <SectionDivider />
            </>
          ) : null}

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    backgroundColor: BG,
  },
  loadingText: { marginTop: 12, color: MUTED, fontSize: 14 },
  errorTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: INK,
    marginTop: 16,
    marginBottom: 24,
  },
  retryBtn: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  // ── Compact Header ──
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
  },

  // ── Timeline Wrapper ──
  timelineWrapper: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: BG,
  },

  // ── Content Area (flat, no radius, flush) ──
  contentArea: {
    backgroundColor: WHITE,
    paddingHorizontal: 20,
    paddingTop: 8,
    minHeight: SCREEN_WIDTH,
  },

  // Section
  section: {
    paddingVertical: 20,
  },

  // Section with accent background
  rejectSection: {
    backgroundColor: "#FEF2F2",
    marginHorizontal: -20,
    paddingHorizontal: 20,
    borderLeftWidth: 4,
    borderLeftColor: "#DC2626",
  },
  noteSection: {
    backgroundColor: "#F0FDF4",
    marginHorizontal: -20,
    paddingHorizontal: 20,
    borderLeftWidth: 4,
    borderLeftColor: PRIMARY,
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: BORDER,
    marginHorizontal: -20,
  },

  // Section Header
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

  // Application Title
  appTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: INK,
    marginBottom: 16,
    lineHeight: 28,
  },

  // Info Row
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
  infoValue: {
    fontSize: 15,
    color: INK,
    fontWeight: "600",
    lineHeight: 20,
  },

  // Inspector
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

  // Action Buttons
  actionButtonsRow: {
    flexDirection: "row",
    gap: 12,
  },
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

  // Fulfillment
  fulfillmentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  fulfillmentIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  fulfillmentTitle: { fontSize: 16, fontWeight: "700", color: INK },
  fulfillmentSub: {
    fontSize: 13,
    color: MUTED,
    marginTop: 4,
    lineHeight: 20,
  },

  // Species
  speciesRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  speciesIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F0FDF4",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  speciesName: { fontSize: 15, fontWeight: "600", color: INK },
  speciesProvider: { fontSize: 12, color: MUTED, marginTop: 2 },
  speciesQty: { fontSize: 16, fontWeight: "800", color: PRIMARY },

  // Total
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  totalLabel: { fontSize: 14, fontWeight: "600", color: MUTED },
  totalValue: { fontSize: 20, fontWeight: "800", color: PRIMARY },

  // Proof
  proofImage: {
    width: "100%",
    height: 220,
    borderRadius: 16,
    marginBottom: 8,
  },
  proofCaption: {
    fontSize: 12,
    color: MUTED,
    textAlign: "center",
    fontStyle: "italic",
  },

  // Reason / Notes
  reasonText: { fontSize: 15, lineHeight: 24, fontWeight: "500" },

  // Description
  descText: { fontSize: 15, color: INK, lineHeight: 24 },

  // Empty
  emptyText: { fontSize: 14, color: MUTED, fontStyle: "italic" },
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

// ─── Original Floating Timeline Styles (card, shadow, scroll) ───────────────
const floatTimelineStyles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
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
  scroll: { paddingRight: 4 },
  stepContainer: {
    flexDirection: "column",
    alignItems: "center",
    marginRight: 2,
    width: 64,
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
    width: 64,
    lineHeight: 12,
  },
  stepLabelActive: { color: INK, fontWeight: "700" },
  stepLabelCurrent: { color: PRIMARY, fontWeight: "800" },
  connector: {
    position: "absolute",
    top: 16,
    left: 50,
    width: 24,
    height: 2,
    backgroundColor: "#E5E7EB",
  },
  connectorActive: { backgroundColor: PRIMARY },
});
