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
const INK = "#111827";
const MUTED = "#6B7280";
const FAINT = "#9CA3AF";
const WHITE = "#FFFFFF";
const BG = "#F4F7F5";
const BORDER = "#E5E7EB";
const WARNING = "#D97706";

// ─── Types ───────────────────────────────────────────────────────────────────
type DeliveryStatus =
  | "accepted"
  | "confirmed"
  | "cancelled"
  | "rejected"
  | "pending";

interface SeedlingSpeciesItem {
  species_id: number;
  species_name: string;
  quantity: number;
  provided_by?: string;
}

interface DeliveryDetail {
  request_id: number;
  application_id: number;
  application_title: string;
  status: DeliveryStatus;
  fulfillment_type: string;
  no_request_seedling: number;
  description: string | null;
  reason: string | null;
  reason_accepted: string | null;
  proof_of_delivery: string | null;
  submitted_at: string | null;
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

// ─── Status Config (matches SeedlingRequestDetail style) ──────────────────
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
    label: "Awaiting Delivery",
    bg: "#F0FDF4",
    text: "#16A34A",
    dot: "#16A34A",
  },
  confirmed: {
    label: "Completed",
    bg: "#EFF6FF",
    text: "#2563EB",
    dot: "#2563EB",
  },
  cancelled: {
    label: "Canceled",
    bg: "#FEF2F2",
    text: "#DC2626",
    dot: "#DC2626",
  },
  rejected: {
    label: "Rejected",
    bg: "#FEF2F2",
    text: "#DC2626",
    dot: "#DC2626",
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

// ─── Components ───────────────────────────────────────────────────────────

const StatusBadge = ({ status }: { status: string }) => {
  const conf = getStatusConf(status);
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

// ─── Floating Progress Timeline ────────────────────────────────────────────
const FloatingProgressTimeline = ({ status }: { status: string }) => {
  const isRejected = status === "rejected" || status === "cancelled";

  const steps = isRejected
    ? [
        { key: "pending", label: "Pending", icon: "time" },
        { key: "accepted", label: "Accepted", icon: "checkmark-circle" },
        {
          key: "rejected",
          label: status === "rejected" ? "Rejected" : "Canceled",
          icon: "close-circle",
        },
      ]
    : [
        { key: "pending", label: "Pending", icon: "time" },
        { key: "accepted", label: "Accepted", icon: "checkmark-circle" },
        { key: "confirmed", label: "Completed", icon: "checkmark-done-circle" },
      ];

  const statusOrder = isRejected
    ? ["pending", "accepted", "rejected"]
    : ["pending", "accepted", "confirmed"];

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
                    isRejected && isActive && { backgroundColor: DANGER },
                    isRejected &&
                      isCurrent && {
                        backgroundColor: DANGER,
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
                    isRejected && isActive && { color: DANGER },
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
                        index < currentIndex && { backgroundColor: DANGER },
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

export default function DeliveryDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [detail, setDetail] = useState<DeliveryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [proofImage, setProofImage] =
    useState<ImagePicker.ImagePickerAsset | null>(null);
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [confirming, setConfirming] = useState(false);

  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  // ─── Fetch Detail ──────────────────────────────────────────────────────
  const fetchDetail = async (isRefresh = false) => {
    if (!id) return;
    if (!isRefresh) setLoading(true);
    try {
      const token = await SecureStore.getItemAsync("token");
      if (!token) throw new Error("No authentication token found.");

      const res = await fetch(`${api}/api/requests/${id}/detail/`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        let detailMsg = `HTTP ${res.status}`;
        try {
          const errBody = await res.json();
          if (errBody?.error) detailMsg = errBody.error;
        } catch {}
        console.error(`❌ requests/${id}/detail failed: ${detailMsg}`);
        throw new Error(`Failed to load delivery details (${detailMsg}).`);
      }

      const data = await res.json();
      setDetail(data);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to load delivery details.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [id]);

  // ─── Image Picker ────────────────────────────────────────────────────────
  const handlePickImage = () => {
    Alert.alert("Proof of Delivery", "Choose a photo source", [
      { text: "Take Photo", onPress: () => launchPicker("camera") },
      { text: "Choose from Library", onPress: () => launchPicker("library") },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const launchPicker = async (source: "camera" | "library") => {
    try {
      if (source === "camera") {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert(
            "Permission Needed",
            "Camera access is required to take a photo.",
          );
          return;
        }
        const result = await ImagePicker.launchCameraAsync({
          quality: 0.7,
          allowsEditing: true,
        });
        if (!result.canceled && result.assets?.[0])
          setProofImage(result.assets[0]);
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert("Permission Needed", "Photo library access is required.");
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.7,
          allowsEditing: true,
        });
        if (!result.canceled && result.assets?.[0])
          setProofImage(result.assets[0]);
      }
    } catch (err) {
      console.error("❌ Image picker error:", err);
      Alert.alert("Error", "Something went wrong selecting the image.");
    }
  };

  // ─── Confirm Delivery ──────────────────────────────────────────────────
  const handleConfirmDelivery = async () => {
    if (!detail || !proofImage) return;

    setConfirming(true);
    try {
      const token = await SecureStore.getItemAsync("token");
      const fd = new FormData();
      if (deliveryNotes.trim()) fd.append("notes", deliveryNotes.trim());
      fd.append("proof_of_delivery", {
        uri: proofImage.uri,
        name: proofImage.fileName || `proof_${Date.now()}.jpg`,
        type: proofImage.mimeType || "image/jpeg",
      } as any);

      const res = await fetch(
        `${api}/api/requests/${detail.request_id}/confirm/`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to confirm delivery.");

      Alert.alert(
        "✓ Delivery Confirmed",
        "The delivery has been marked as completed.",
        [{ text: "OK", onPress: () => router.back() }],
      );
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to confirm delivery.");
    } finally {
      setConfirming(false);
    }
  };

  // ─── Cancel Delivery ───────────────────────────────────────────────────
  const handleSubmitCancellation = async () => {
    if (!detail || cancelReason.trim().length <= 5) return;

    setCancelling(true);
    try {
      const token = await SecureStore.getItemAsync("token");

      const res = await fetch(
        `${api}/api/requests/${detail.request_id}/inspector-cancel/`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reason: cancelReason.trim() }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to cancel delivery.");

      Alert.alert(
        "Delivery Canceled",
        "This delivery has been marked as canceled.",
        [{ text: "OK", onPress: () => router.back() }],
      );
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to cancel delivery.");
    } finally {
      setCancelling(false);
    }
  };

  const handleContactGrower = (contact: string | undefined) => {
    if (!contact) {
      Alert.alert(
        "No Contact",
        "No contact number is available for this grower.",
      );
      return;
    }
    Alert.alert("Contact Grower", contact, [
      { text: "Call", onPress: () => Linking.openURL(`tel:${contact}`) },
      { text: "Message", onPress: () => Linking.openURL(`sms:${contact}`) },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      {/* Compact Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.replace("/(tabs)/delivery")}
        >
          <Ionicons name="chevron-back" size={22} color={INK} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Delivery Details</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading || !detail ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={styles.loadingText}>Loading details…</Text>
        </View>
      ) : (
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
            <FloatingProgressTimeline status={detail.status} />
          </View>

          {/* Content Area (flat, no radius, flush) */}
          <View style={styles.contentArea}>
            {/* ── Application Info ── */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <SectionHeader
                  title="APPLICATION"
                  icon="document-text-outline"
                />
                <StatusBadge status={detail.status} />
              </View>
              <Text style={styles.appTitle} numberOfLines={2}>
                {detail.application_title}
              </Text>
              <InfoRow
                icon="business-outline"
                label="Group"
                value={detail.grower_info.group_name}
              />
              <InfoRow
                icon="location-outline"
                label="Site"
                value={`${detail.site_info.site_name}, ${detail.site_info.barangay}`}
              />
              {detail.submitted_at && (
                <InfoRow
                  icon="calendar-outline"
                  label="Submitted"
                  value={formatDate(detail.submitted_at)}
                />
              )}
            </View>

            <SectionDivider />

            {/* ── Grower Contact ── */}
            <View style={styles.section}>
              <SectionHeader title="GROWER CONTACT" icon="person-outline" />

              <View style={styles.inspectorRow}>
                <View style={styles.inspectorAvatar}>
                  <Ionicons name="person" size={22} color={PRIMARY} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inspectorName}>
                    {detail.grower_info.representative_name}
                  </Text>
                  <Text style={styles.inspectorEmail} numberOfLines={1}>
                    {detail.grower_info.group_name}
                  </Text>
                </View>
              </View>

              {detail.grower_info.representative_contact ||
              detail.grower_info.group_contact ? (
                <View style={styles.actionButtonsRow}>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() =>
                      Linking.openURL(
                        `tel:${detail.grower_info.representative_contact || detail.grower_info.group_contact}`,
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
                        `sms:${detail.grower_info.representative_contact || detail.grower_info.group_contact}`,
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

            {/* ── Seedling Breakdown ── */}
            <View style={styles.section}>
              <SectionHeader title="SEEDLING BREAKDOWN" icon="leaf-outline" />
              {detail.species.length > 0 ? (
                detail.species.map((sp, i) => (
                  <View
                    key={i}
                    style={[
                      styles.speciesRow,
                      i === detail.species.length - 1 && {
                        borderBottomWidth: 0,
                      },
                    ]}
                  >
                    <View style={styles.speciesIconWrap}>
                      <Ionicons name="leaf" size={16} color={PRIMARY} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.speciesName}>{sp.species_name}</Text>
                      {sp.provided_by && (
                        <Text style={styles.speciesProvider}>
                          Provided by {sp.provided_by}
                        </Text>
                      )}
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
                  {detail.no_request_seedling.toLocaleString()}
                </Text>
              </View>
              {detail.description ? (
                <Text style={styles.descText}>{detail.description}</Text>
              ) : null}
            </View>

            {/* ── Action Section — only for deliveries awaiting action ── */}
            {detail.status === "accepted" && (
              <>
                <SectionDivider />
                <View style={styles.section}>
                  <SectionHeader
                    title="CONFIRM DELIVERY"
                    icon="checkmark-circle-outline"
                  />

                  <TouchableOpacity
                    style={styles.uploadBox}
                    activeOpacity={0.7}
                    onPress={handlePickImage}
                  >
                    {proofImage ? (
                      <Image
                        source={{ uri: proofImage.uri }}
                        style={styles.uploadPreview}
                      />
                    ) : (
                      <>
                        <Ionicons
                          name="camera-outline"
                          size={28}
                          color={FAINT}
                        />
                        <Text style={styles.uploadText}>
                          Upload Proof of Delivery
                        </Text>
                        <Text style={styles.uploadSubtext}>
                          Tap to take or choose a photo
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                  {proofImage && (
                    <TouchableOpacity
                      style={styles.changePhotoBtn}
                      onPress={handlePickImage}
                    >
                      <Text style={styles.changePhotoText}>Change Photo</Text>
                    </TouchableOpacity>
                  )}

                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Delivery notes (optional)..."
                    value={deliveryNotes}
                    onChangeText={setDeliveryNotes}
                    multiline
                    numberOfLines={3}
                    placeholderTextColor={FAINT}
                    textAlignVertical="top"
                  />

                  <TouchableOpacity
                    style={[
                      styles.confirmBtn,
                      (!proofImage || confirming) && { opacity: 0.5 },
                    ]}
                    onPress={handleConfirmDelivery}
                    disabled={!proofImage || confirming}
                    activeOpacity={0.8}
                  >
                    {confirming ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons
                          name="checkmark-circle-outline"
                          size={20}
                          color="#fff"
                        />
                        <Text style={styles.confirmBtnText}>
                          Confirm Delivery
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>

                  {/* Cancel Delivery */}
                  {!showCancelForm ? (
                    <TouchableOpacity
                      style={styles.cancelToggleBtn}
                      onPress={() => setShowCancelForm(true)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name="close-circle-outline"
                        size={18}
                        color={DANGER}
                      />
                      <Text style={styles.cancelToggleText}>
                        Cancel Delivery
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.cancelForm}>
                      <Text style={styles.cancelFormLabel}>
                        Cancellation Reason
                      </Text>
                      <TextInput
                        style={[styles.input, styles.textArea]}
                        placeholder="Explain why this delivery is being canceled..."
                        value={cancelReason}
                        onChangeText={setCancelReason}
                        multiline
                        numberOfLines={3}
                        placeholderTextColor={FAINT}
                        textAlignVertical="top"
                      />
                      <View style={styles.cancelFormBtnRow}>
                        <TouchableOpacity
                          style={styles.cancelFormDismissBtn}
                          onPress={() => {
                            setShowCancelForm(false);
                            setCancelReason("");
                          }}
                        >
                          <Text style={styles.cancelFormDismissText}>Back</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.cancelSubmitBtn,
                            (cancelReason.trim().length <= 5 || cancelling) && {
                              opacity: 0.5,
                            },
                          ]}
                          onPress={handleSubmitCancellation}
                          disabled={
                            cancelReason.trim().length <= 5 || cancelling
                          }
                        >
                          {cancelling ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Text style={styles.cancelSubmitText}>
                              Submit Cancellation
                            </Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              </>
            )}

            {/* ── Proof of Delivery (if Confirmed) ── */}
            {detail.status === "confirmed" && detail.proof_of_delivery && (
              <>
                <SectionDivider />
                <View style={styles.section}>
                  <SectionHeader
                    title="PROOF OF DELIVERY"
                    icon="checkmark-done-outline"
                  />
                  <Image
                    source={{ uri: detail.proof_of_delivery }}
                    style={styles.proofImage}
                    resizeMode="cover"
                  />
                  <Text style={styles.proofCaption}>
                    Verified by Onsite Inspector
                  </Text>
                </View>
              </>
            )}

            {/* ── Reason / Notes ── */}
            {(detail.status === "cancelled" || detail.status === "rejected") &&
              detail.reason && (
                <>
                  <SectionDivider />
                  <View style={[styles.section, styles.rejectSection]}>
                    <View style={styles.sectionHeaderRow}>
                      <Ionicons
                        name="information-circle"
                        size={18}
                        color={DANGER}
                      />
                      <Text
                        style={[
                          styles.sectionTitle,
                          { marginLeft: 8, color: DANGER },
                        ]}
                      >
                        REASON
                      </Text>
                    </View>
                    <Text style={[styles.reasonText, { color: "#991B1B" }]}>
                      {detail.reason}
                    </Text>
                  </View>
                </>
              )}

            {/* ── Data Manager Notes ── */}
            {detail.reason_accepted &&
              detail.status !== "cancelled" &&
              detail.status !== "rejected" && (
                <>
                  <SectionDivider />
                  <View style={[styles.section, styles.noteSection]}>
                    <View style={styles.sectionHeaderRow}>
                      <Ionicons
                        name="information-circle"
                        size={18}
                        color={PRIMARY}
                      />
                      <Text
                        style={[
                          styles.sectionTitle,
                          { marginLeft: 8, color: INK },
                        ]}
                      >
                        DATA MANAGER NOTES
                      </Text>
                    </View>
                    <Text style={styles.reasonText}>
                      {detail.reason_accepted}
                    </Text>
                  </View>
                </>
              )}

            <View style={{ height: 40 }} />
          </View>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
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
    borderLeftColor: DANGER,
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

  // Grower Contact (avatar + name)
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

  // Description
  descText: { fontSize: 15, color: INK, lineHeight: 24, marginTop: 10 },

  // Empty
  emptyText: { fontSize: 14, color: MUTED, fontStyle: "italic" },

  // Upload
  uploadBox: {
    borderWidth: 1.5,
    borderColor: BORDER,
    borderStyle: "dashed",
    borderRadius: 14,
    minHeight: 140,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: WHITE,
    overflow: "hidden",
  },
  uploadPreview: { width: "100%", height: 180, borderRadius: 12 },
  uploadText: { fontSize: 14, fontWeight: "700", color: MUTED, marginTop: 8 },
  uploadSubtext: { fontSize: 12, color: FAINT, marginTop: 2 },
  changePhotoBtn: { alignSelf: "center", marginTop: 8 },
  changePhotoText: { fontSize: 13, fontWeight: "700", color: PRIMARY },

  // Input
  input: {
    backgroundColor: WHITE,
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: INK,
    marginTop: 14,
  },
  textArea: { height: 90 },

  // Confirm Button
  confirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PRIMARY,
    borderRadius: 14,
    paddingVertical: 14,
    gap: 8,
    marginTop: 16,
  },
  confirmBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },

  // Cancel Toggle
  cancelToggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: DANGER,
    borderRadius: 14,
    paddingVertical: 12,
    marginTop: 10,
  },
  cancelToggleText: { color: DANGER, fontWeight: "700", fontSize: 14 },

  // Cancel Form
  cancelForm: {
    marginTop: 10,
    padding: 14,
    backgroundColor: "#FEF2F2",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  cancelFormLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: DANGER,
    textTransform: "uppercase",
  },
  cancelFormBtnRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  cancelFormDismissBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: BORDER,
  },
  cancelFormDismissText: { fontSize: 14, fontWeight: "700", color: MUTED },
  cancelSubmitBtn: {
    flex: 1.5,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: DANGER,
  },
  cancelSubmitText: { fontSize: 14, fontWeight: "800", color: "#fff" },

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

  // Reason
  reasonText: { fontSize: 15, lineHeight: 24, fontWeight: "500" },
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

// ─── Floating Timeline Styles ─────────────────────────────────────────────
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
