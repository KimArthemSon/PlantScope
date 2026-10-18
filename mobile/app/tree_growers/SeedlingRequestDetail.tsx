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
  Linking,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/constants/url_fixed";
import { useAlert } from "@/components/AlertContext";

const PRIMARY = "#0F4A2F";
const INK = "#111827";
const MUTED = "#6B7280";
const FAINT = "#9CA3AF";
const WHITE = "#FFFFFF";
const BG = "#F4F7F5";
const BORDER = "#E5E7EB";
const DANGER = "#DC2626";
const WARNING = "#D97706";

const cardShadow = {
  shadowColor: "#0F172A",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.05,
  shadowRadius: 10,
  elevation: 2,
};

// ─── Types ──────────────────────────────────────────────────────────────────

interface SeedlingSpeciesItem {
  species_id: number;
  species_name: string;
  quantity: number;
  provided_by: string;
}

type RequestStatus = "pending" | "accepted" | "rejected" | "confirmed" | "cancelled";

interface RequestDetail {
  request_id: number;
  application_title: string;
  status: RequestStatus;
  fulfillment_type: "pickup" | "deliver" | null;
  no_request_seedling: number;
  description: string | null;
  reason: string | null;
  reason_accepted: string | null;
  proof_of_delivery: string | null;
  submitted_at: string | null;
  created_by_admin?: boolean;
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

// ─── Helpers ────────────────────────────────────────────────────────────────

const STATUS_META: Record<RequestStatus, { label: string; bg: string; text: string }> = {
  pending: { label: "Pending Review", bg: "#FEF3C7", text: "#92400E" },
  accepted: { label: "Approved", bg: "#DCFCE7", text: "#166534" },
  confirmed: { label: "Received", bg: "#DBEAFE", text: "#1E40AF" },
  rejected: { label: "Rejected", bg: "#FEE2E2", text: "#991B1B" },
  cancelled: { label: "Cancelled", bg: "#F3F4F6", text: "#374151" },
};

const formatDate = (iso: string | null) =>
  !iso
    ? "—"
    : new Date(iso).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });

// reason_accepted is stored as "<manager notes> | Inspector Notes: <notes>"
const splitNotes = (raw: string | null) => {
  if (!raw) return { manager: "", inspector: "" };
  const marker = "Inspector Notes:";
  const idx = raw.indexOf(marker);
  if (idx === -1) return { manager: raw.trim(), inspector: "" };
  return {
    manager: raw.slice(0, idx).replace(/\|\s*$/, "").trim(),
    inspector: raw.slice(idx + marker.length).trim(),
  };
};

// What the grower should know / do next, per status
const nextStep = (r: RequestDetail): { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string; title: string; text: string } => {
  switch (r.status) {
    case "pending":
      return { icon: "hourglass-outline", color: WARNING, bg: "#FFFBEB", title: "Waiting for review", text: "The Data Manager is reviewing your request. You'll get a notification once it's decided." };
    case "accepted":
      return r.fulfillment_type === "deliver"
        ? { icon: "car-outline", color: "#2563EB", bg: "#EFF6FF", title: "Seedlings are on the way", text: "ENRO will deliver to your site. Be there to receive them — the inspector will confirm the handover." }
        : { icon: "home-outline", color: "#7C3AED", bg: "#F5F3FF", title: "Ready for pickup", text: "Coordinate with the assigned inspector to pick up your seedlings at the ENRO Nursery." };
    case "confirmed":
      return { icon: "checkmark-done-circle-outline", color: "#16A34A", bg: "#F0FDF4", title: "Seedlings received", text: "The handover was confirmed by the onsite inspector. Happy planting!" };
    case "rejected":
      return { icon: "close-circle-outline", color: DANGER, bg: "#FEF2F2", title: "Request rejected", text: "See the reason below. You can submit a new request if needed." };
    default:
      return { icon: "remove-circle-outline", color: MUTED, bg: "#F3F4F6", title: "Request cancelled", text: "This request is no longer active." };
  }
};

// ─── Progress ───────────────────────────────────────────────────────────────

const Progress = ({ status, byEnro }: { status: RequestStatus; byEnro: boolean }) => {
  const failed = status === "rejected" || status === "cancelled";
  const steps = byEnro
    ? [
        { key: "accepted", label: "Prepared", icon: "gift-outline" },
        { key: "confirmed", label: "Received", icon: "checkmark-done" },
      ]
    : [
        { key: "pending", label: "Submitted", icon: "paper-plane-outline" },
        { key: "accepted", label: failed ? (status === "rejected" ? "Rejected" : "Cancelled") : "Approved", icon: failed ? "close" : "checkmark" },
        { key: "confirmed", label: "Received", icon: "checkmark-done" },
      ];
  const order = steps.map((s) => s.key);
  const current = failed ? 1 : Math.max(0, order.indexOf(status));

  return (
    <View style={prog.card}>
      {steps.map((step, i) => {
        const done = i <= current;
        const isCurrent = i === current;
        const color = failed && i === current ? DANGER : PRIMARY;
        return (
          <React.Fragment key={step.key}>
            <View style={prog.step}>
              <View
                style={[
                  prog.dot,
                  done && { backgroundColor: color },
                  isCurrent && { borderWidth: 3, borderColor: failed ? "#FECACA" : "#BBF7D0" },
                ]}
              >
                <Ionicons name={step.icon as any} size={14} color={done ? WHITE : FAINT} />
              </View>
              <Text style={[prog.label, done && { color: INK }, isCurrent && { color, fontWeight: "800" }]}>
                {step.label}
              </Text>
            </View>
            {i < steps.length - 1 && (
              <View style={[prog.line, i < current && { backgroundColor: PRIMARY }]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
};

const CardTitle = ({ icon, title, right }: { icon: keyof typeof Ionicons.glyphMap; title: string; right?: string }) => (
  <View style={styles.cardTitleRow}>
    <View style={styles.cardTitleIcon}>
      <Ionicons name={icon} size={15} color={PRIMARY} />
    </View>
    <Text style={styles.cardTitle}>{title}</Text>
    {!!right && <Text style={styles.cardTitleRight}>{right}</Text>}
  </View>
);

// ─── Main Component ─────────────────────────────────────────────────────────

export default function SeedlingRequestDetail() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { success, error: showError } = useAlert();

  const params = useLocalSearchParams();
  const requestId = params.id as string;

  const [request, setRequest] = useState<RequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const goBack = () => router.replace("/tree_growers/seedlingRequests");

  const fetchData = async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      const token = await SecureStore.getItemAsync("token");
      if (!token) return;

      const res = await fetch(`${api}/api/requests/${requestId}/detail/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load request details");
      setRequest(await res.json());
    } catch (err) {
      console.error(err);
      showError("Couldn't load request", "Pull down to try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (requestId) {
      setShowCancel(false);
      setCancelReason("");
      fetchData();
    }
  }, [requestId]);

  const handleCancel = async () => {
    if (!request || cancelReason.trim().length < 5) return;
    setCancelling(true);
    try {
      const token = await SecureStore.getItemAsync("token");
      const res = await fetch(`${api}/api/requests/${request.request_id}/cancel/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to cancel request.");
      success("Request cancelled", "Your seedling request was withdrawn.");
      setShowCancel(false);
      setCancelReason("");
      fetchData(true);
    } catch (err: any) {
      showError("Couldn't cancel", err.message || "Failed to cancel request.");
    } finally {
      setCancelling(false);
    }
  };

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
        <View style={styles.emptyIcon}>
          <Ionicons name="alert-circle-outline" size={30} color={MUTED} />
        </View>
        <Text style={styles.errorTitle}>Request not found</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={goBack}>
          <Text style={styles.retryText}>Back to requests</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const meta = STATUS_META[request.status] || STATUS_META.pending;
  const step = nextStep(request);
  const byEnro = !!request.created_by_admin;
  const isActive = request.status === "accepted" || request.status === "confirmed";
  const total = request.species.reduce((sum, s) => sum + (s.quantity || 0), 0);
  const { manager, inspector } = splitNotes(request.reason_accepted);
  const inspectorContact = request.assigned_inspector?.contact;
  const canCancel = request.status === "pending" && !byEnro;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
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
        {/* ── Hero ── */}
        <View style={[styles.hero, { paddingTop: insets.top + 8 }]}>
          <View style={styles.heroTopRow}>
            <TouchableOpacity style={styles.heroBack} onPress={goBack}>
              <Ionicons name="chevron-back" size={20} color={WHITE} />
            </TouchableOpacity>
            <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
              <View style={[styles.statusDot, { backgroundColor: meta.text }]} />
              <Text style={[styles.statusText, { color: meta.text }]}>{meta.label}</Text>
            </View>
          </View>

          <Text style={styles.heroEyebrow}>Seedling Request #{request.request_id}</Text>
          <Text style={styles.heroTitle} numberOfLines={2}>{request.application_title}</Text>
          {byEnro && (
            <View style={styles.enroChip}>
              <Ionicons name="gift" size={12} color="#FDE68A" />
              <Text style={styles.enroChipText}>Prepared for you by ENRO</Text>
            </View>
          )}

          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{total.toLocaleString()}</Text>
              <Text style={styles.heroStatLabel}>Seedlings</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{request.species.length}</Text>
              <Text style={styles.heroStatLabel}>Species</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValueSm}>
                {request.submitted_at
                  ? new Date(request.submitted_at).toLocaleDateString("en-PH", { month: "short", day: "numeric" })
                  : "—"}
              </Text>
              <Text style={styles.heroStatLabel}>{byEnro ? "Prepared" : "Submitted"}</Text>
            </View>
          </View>
        </View>

        <View style={styles.body}>
          <Progress status={request.status} byEnro={byEnro} />

          {/* ── What's next ── */}
          <View style={[styles.nextCard, { backgroundColor: step.bg, borderColor: `${step.color}33` }]}>
            <View style={[styles.nextIcon, { backgroundColor: step.color }]}>
              <Ionicons name={step.icon} size={18} color={WHITE} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.nextTitle, { color: step.color }]}>{step.title}</Text>
              <Text style={styles.nextText}>{step.text}</Text>
            </View>
          </View>

          {/* ── Rejection / cancellation reason ── */}
          {(request.status === "rejected" || request.status === "cancelled") && !!request.reason && (
            <View style={[styles.card, styles.reasonCard]}>
              <CardTitle icon="information-circle-outline" title={request.status === "rejected" ? "Reason for rejection" : "Reason for cancellation"} />
              <Text style={[styles.bodyText, { color: "#991B1B" }]}>{request.reason}</Text>
            </View>
          )}

          {/* ── Fulfillment + inspector ── */}
          {isActive && (request.fulfillment_type || request.assigned_inspector) && (
            <View style={styles.card}>
              <CardTitle icon="navigate-outline" title="Handover" />
              {request.fulfillment_type && (
                <View style={styles.infoRow}>
                  <View style={[styles.infoIcon, { backgroundColor: request.fulfillment_type === "deliver" ? "#EFF6FF" : "#F5F3FF" }]}>
                    <Ionicons
                      name={request.fulfillment_type === "deliver" ? "car" : "home"}
                      size={18}
                      color={request.fulfillment_type === "deliver" ? "#2563EB" : "#7C3AED"}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.infoLabel}>Method</Text>
                    <Text style={styles.infoValue}>
                      {request.fulfillment_type === "deliver" ? "Delivered to your site" : "Pickup at ENRO Nursery"}
                    </Text>
                  </View>
                </View>
              )}
              <View style={styles.infoRow}>
                <View style={[styles.infoIcon, { backgroundColor: "#ECFDF5" }]}>
                  <Ionicons name="location" size={18} color={PRIMARY} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoLabel}>Site</Text>
                  <Text style={styles.infoValue}>
                    {request.site_info.site_name}
                    {request.site_info.barangay && request.site_info.barangay !== "N/A" ? ` · Brgy. ${request.site_info.barangay}` : ""}
                  </Text>
                </View>
              </View>

              {request.assigned_inspector && (
                <View style={styles.inspectorBox}>
                  <View style={styles.inspectorAvatar}>
                    <Ionicons name="shield-checkmark" size={18} color={PRIMARY} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.infoLabel}>Onsite Inspector</Text>
                    <Text style={styles.infoValue} numberOfLines={1}>{request.assigned_inspector.name}</Text>
                    <Text style={styles.inspectorSub} numberOfLines={1}>{inspectorContact || request.assigned_inspector.email}</Text>
                  </View>
                  {!!inspectorContact && (
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <TouchableOpacity style={styles.roundBtn} onPress={() => Linking.openURL(`sms:${inspectorContact}`)}>
                        <Ionicons name="chatbubble-outline" size={16} color={PRIMARY} />
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.roundBtn, styles.roundBtnPrimary]} onPress={() => Linking.openURL(`tel:${inspectorContact}`)}>
                        <Ionicons name="call" size={16} color={WHITE} />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
            </View>
          )}

          {/* ── Seedlings ── */}
          <View style={styles.card}>
            <CardTitle icon="leaf-outline" title={request.status === "confirmed" ? "Seedlings received" : "Seedlings"} right={`${request.species.length} species`} />
            {request.species.length > 0 ? (
              request.species.map((sp, i) => (
                <View key={i} style={[styles.speciesRow, i === request.species.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={styles.speciesIcon}>
                    <Ionicons name="leaf" size={15} color={PRIMARY} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.speciesName}>{sp.species_name}</Text>
                    <Text style={styles.speciesProvider}>From {sp.provided_by}</Text>
                  </View>
                  <View style={styles.qtyPill}>
                    <Text style={styles.qtyText}>×{sp.quantity.toLocaleString()}</Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>No species details available.</Text>
            )}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total seedlings</Text>
              <Text style={styles.totalValue}>{total.toLocaleString()}</Text>
            </View>
          </View>

          {/* ── Proof of delivery ── */}
          {request.status === "confirmed" && !!request.proof_of_delivery && (
            <View style={styles.card}>
              <CardTitle icon="camera-outline" title="Proof of delivery" />
              <Image source={{ uri: request.proof_of_delivery }} style={styles.proofImage} resizeMode="cover" />
              <View style={styles.verifiedRow}>
                <Ionicons name="shield-checkmark" size={13} color="#16A34A" />
                <Text style={styles.verifiedText}>Verified by the onsite inspector</Text>
              </View>
            </View>
          )}

          {/* ── Notes ── */}
          {!!manager && request.status !== "rejected" && request.status !== "cancelled" && (
            <View style={[styles.card, styles.managerNote]}>
              <CardTitle icon="chatbox-ellipses-outline" title="From the Data Manager" />
              <Text style={styles.bodyText}>{manager}</Text>
            </View>
          )}
          {!!inspector && (
            <View style={[styles.card, styles.inspectorNote]}>
              <CardTitle icon="clipboard-outline" title="From the inspector" />
              <Text style={styles.bodyText}>{inspector}</Text>
            </View>
          )}
          {!!request.description && (
            <View style={styles.card}>
              <CardTitle icon="create-outline" title="Your note" />
              <Text style={styles.bodyText}>{request.description}</Text>
            </View>
          )}

          {/* ── Cancel (pending, grower-submitted only) ── */}
          {canCancel &&
            (!showCancel ? (
              <TouchableOpacity style={styles.cancelToggle} onPress={() => setShowCancel(true)} activeOpacity={0.75}>
                <Ionicons name="close-circle-outline" size={18} color={DANGER} />
                <Text style={styles.cancelToggleText}>Cancel this request</Text>
              </TouchableOpacity>
            ) : (
              <View style={[styles.card, { borderWidth: 1, borderColor: "#FECACA" }]}>
                <CardTitle icon="close-circle-outline" title="Cancel request" />
                <Text style={styles.cancelHint}>Tell the Data Manager why you're withdrawing this request.</Text>
                <TextInput
                  style={styles.textArea}
                  placeholder="e.g. We received seedlings from another source…"
                  placeholderTextColor={FAINT}
                  value={cancelReason}
                  onChangeText={setCancelReason}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
                <Text style={styles.charHint}>
                  {cancelReason.trim().length < 5 ? `At least 5 characters (${cancelReason.trim().length}/5)` : "Ready to submit"}
                </Text>
                <View style={styles.cancelBtnRow}>
                  <TouchableOpacity
                    style={styles.keepBtn}
                    onPress={() => {
                      setShowCancel(false);
                      setCancelReason("");
                    }}
                  >
                    <Text style={styles.keepBtnText}>Keep request</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.cancelBtn, (cancelReason.trim().length < 5 || cancelling) && { opacity: 0.5 }]}
                    onPress={handleCancel}
                    disabled={cancelReason.trim().length < 5 || cancelling}
                  >
                    {cancelling ? <ActivityIndicator size="small" color={WHITE} /> : <Text style={styles.cancelBtnText}>Cancel request</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            ))}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32, backgroundColor: BG },
  loadingText: { marginTop: 12, color: MUTED, fontSize: 14 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#F3F4F6", justifyContent: "center", alignItems: "center" },
  errorTitle: { fontSize: 17, fontWeight: "800", color: INK, marginTop: 14, marginBottom: 20 },
  retryBtn: { backgroundColor: PRIMARY, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  retryText: { color: WHITE, fontWeight: "700", fontSize: 14 },

  // Hero
  hero: { backgroundColor: PRIMARY, paddingHorizontal: 20, paddingBottom: 44, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  heroTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  heroBack: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.15)", justifyContent: "center", alignItems: "center" },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10.5, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  heroEyebrow: { fontSize: 11, fontWeight: "700", color: "rgba(255,255,255,0.65)", textTransform: "uppercase", letterSpacing: 1 },
  heroTitle: { fontSize: 24, fontWeight: "800", color: WHITE, letterSpacing: -0.4, marginTop: 4 },
  enroChip: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", marginTop: 10, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: "rgba(253,230,138,0.15)" },
  enroChipText: { fontSize: 12, fontWeight: "700", color: "#FDE68A" },
  heroStats: { flexDirection: "row", alignItems: "center", marginTop: 18, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 16, paddingVertical: 12 },
  heroStat: { flex: 1, alignItems: "center" },
  heroStatValue: { fontSize: 20, fontWeight: "800", color: WHITE },
  heroStatValueSm: { fontSize: 15, fontWeight: "800", color: WHITE, paddingVertical: 3 },
  heroStatLabel: { fontSize: 11, color: "rgba(255,255,255,0.75)", fontWeight: "600", marginTop: 2 },
  heroStatDivider: { width: 1, height: 30, backgroundColor: "rgba(255,255,255,0.18)" },

  body: { paddingHorizontal: 16, marginTop: -28, gap: 14 },

  // Next step
  nextCard: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 14, borderRadius: 18, borderWidth: 1 },
  nextIcon: { width: 36, height: 36, borderRadius: 11, justifyContent: "center", alignItems: "center" },
  nextTitle: { fontSize: 14.5, fontWeight: "800" },
  nextText: { fontSize: 12.5, color: "#374151", marginTop: 2, lineHeight: 18 },

  // Cards
  card: { backgroundColor: WHITE, borderRadius: 20, padding: 16, ...cardShadow },
  cardTitleRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  cardTitleIcon: { width: 28, height: 28, borderRadius: 9, backgroundColor: "#ECFDF5", justifyContent: "center", alignItems: "center", marginRight: 10 },
  cardTitle: { fontSize: 15, fontWeight: "800", color: INK, flex: 1 },
  cardTitleRight: { fontSize: 12, color: FAINT, fontWeight: "600" },
  reasonCard: { backgroundColor: "#FEF2F2", borderLeftWidth: 4, borderLeftColor: DANGER },
  managerNote: { backgroundColor: "#F0FDF4", borderLeftWidth: 4, borderLeftColor: PRIMARY },
  inspectorNote: { backgroundColor: "#FFFBEB", borderLeftWidth: 4, borderLeftColor: WARNING },
  bodyText: { fontSize: 14.5, color: INK, lineHeight: 22 },

  // Info rows
  infoRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  infoIcon: { width: 38, height: 38, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  infoLabel: { fontSize: 10.5, fontWeight: "700", color: FAINT, textTransform: "uppercase", letterSpacing: 0.5 },
  infoValue: { fontSize: 14.5, fontWeight: "700", color: INK, marginTop: 1 },
  inspectorBox: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8, padding: 12, borderRadius: 14, backgroundColor: "#F9FAFB", borderWidth: 1, borderColor: "#F1F5F9" },
  inspectorAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#ECFDF5", justifyContent: "center", alignItems: "center" },
  inspectorSub: { fontSize: 12, color: MUTED, marginTop: 1 },
  roundBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#ECFDF5", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#D1FAE5" },
  roundBtnPrimary: { backgroundColor: PRIMARY, borderColor: PRIMARY },

  // Species
  speciesRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  speciesIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#ECFDF5", justifyContent: "center", alignItems: "center" },
  speciesName: { fontSize: 14.5, fontWeight: "700", color: INK },
  speciesProvider: { fontSize: 12, color: MUTED, marginTop: 1 },
  qtyPill: { backgroundColor: "#ECFDF5", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: "#A7F3D0" },
  qtyText: { fontSize: 14, fontWeight: "800", color: PRIMARY },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10, paddingTop: 12, borderTopWidth: 1, borderTopColor: BORDER },
  totalLabel: { fontSize: 13, fontWeight: "700", color: MUTED },
  totalValue: { fontSize: 20, fontWeight: "800", color: PRIMARY },
  emptyText: { fontSize: 14, color: MUTED, fontStyle: "italic" },

  // Proof
  proofImage: { width: "100%", height: 210, borderRadius: 14 },
  verifiedRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, marginTop: 10 },
  verifiedText: { fontSize: 12, color: "#15803D", fontWeight: "600" },

  // Cancel
  cancelToggle: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 14, borderRadius: 16, borderWidth: 1.5, borderColor: "#FECACA", backgroundColor: WHITE },
  cancelToggleText: { fontSize: 14, fontWeight: "700", color: DANGER },
  cancelHint: { fontSize: 12.5, color: MUTED, marginBottom: 10 },
  textArea: { backgroundColor: "#F9FAFB", borderWidth: 1.5, borderColor: BORDER, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14.5, color: INK, minHeight: 90 },
  charHint: { fontSize: 11.5, color: FAINT, marginTop: 6 },
  cancelBtnRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  keepBtn: { flex: 1, alignItems: "center", paddingVertical: 13, borderRadius: 14, backgroundColor: "#F3F4F6" },
  keepBtnText: { fontSize: 14, fontWeight: "700", color: INK },
  cancelBtn: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 13, borderRadius: 14, backgroundColor: DANGER },
  cancelBtnText: { fontSize: 14, fontWeight: "800", color: WHITE },
});

const prog = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "flex-start", backgroundColor: WHITE, borderRadius: 20, paddingVertical: 14, paddingHorizontal: 18, ...cardShadow },
  step: { alignItems: "center", width: 64 },
  dot: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#F3F4F6", justifyContent: "center", alignItems: "center", marginBottom: 6 },
  label: { fontSize: 11, color: FAINT, fontWeight: "600", textAlign: "center" },
  line: { flex: 1, height: 3, borderRadius: 2, backgroundColor: "#E5E7EB", marginTop: 15 },
});
