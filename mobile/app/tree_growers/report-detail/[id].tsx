/**
 * Tree grower: everything about one application in one place —
 * status and progress, the site, seedling requests, monitoring reports and decision history.
 */
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Image,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { api } from "@/constants/url_fixed";
import ReportPolygonMapModal from "@/components/forms/ReportPolygonMapModal";
import { SortMenu, byDateAsc, byDateDesc, type SortOption } from "@/components/SortMenu";

const PRIMARY = "#0F4A2F";
const INK = "#111827";
const MUTED = "#6B7280";
const FAINT = "#9CA3AF";
const BORDER = "#E5E7EB";
const BG = "#F4F7F5";

// ─── Types ──────────────────────────────────────────────────────────────────

type Person = { name: string; role: string } | null;

type Species = {
  species_id: number;
  species_name: string;
  no_planted: number;
  no_survived: number;
  no_dead: number;
  survival_rate: number;
};

type Review = { status: string; label: string; notes: string | null; by: Person; at: string | null };

type Report = {
  report_id: number;
  visit_type: string;
  orientation_conducted: boolean;
  total_survived: number;
  total_dead: number;
  species: Species[];
  description: string | null;
  status: string;
  proof_image: string | null;
  agreement_image: string | null;
  submitted_at: string | null;
  created_at: string | null;
  submitted_by: Person;
  planted_area_hectares: number | null;
  polygon_coordinates: any;
  dm_review?: Review;
  gis_review?: Review;
};

type SeedlingRequest = {
  request_id: number;
  no_request_seedling: number;
  species: { species_name: string; quantity: number; provided_by: string }[];
  status: string;
  fulfillment_type: string | null;
  reason: string | null;
  reason_accepted: string | null;
  proof_of_delivery: string | null;
  assigned_inspector: { name: string; contact: string } | null;
  submitted_at: string | null;
  created_at?: string | null;
};

type Detail = {
  application: {
    application_id: number;
    title: string;
    classification: string;
    status: string;
    total_treegrowers_will_participate: number;
    orientation_date: string | null;
    proposed_orientation_date: string | null;
    confirmed_at: string | null;
    maintenance_plan: string | null;
    agreement_image: string | null;
    created_at: string;
    updated_at: string;
  };
  group: { group_name: string; group_type: string; group_contact: string; group_address: string } | null;
  assigned_site: {
    site_id: number;
    name: string;
    description: string | null;
    total_area_hectares: number;
    polygon_coordinates: any;
    reforestation_area_name: string | null;
    barangay_name: string | null;
    accessibility: any;
    land_classification_name: string | null;
    general_images: { image_url: string | null; caption: string | null }[];
    recommended_species: { species_id: number; species_name: string; rank: number }[];
  } | null;
  proposed_site: { site_id: number; name: string; barangay: string | null } | null;
  seedling_requests: SeedlingRequest[];
  progress_reports: Report[];
  status_history?: { status: string; label: string; layer: string; reason: string; by: Person; created: string }[];
  closure_requests?: {
    recommendation: string;
    reason: string;
    status: string;
    status_label: string;
    final_outcome: string | null;
    head_notes: string | null;
    requested_at: string | null;
    decided_at: string | null;
  }[];
};

type Tab = "overview" | "site" | "seedlings" | "reports" | "history";
type ReportSort = "newest" | "oldest";

const REPORT_SORTS: SortOption<ReportSort>[] = [
  { key: "newest", label: "Newest first", icon: "time-outline" },
  { key: "oldest", label: "Oldest first", icon: "hourglass-outline" },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

const STATUS: Record<string, { label: string; bg: string; text: string }> = {
  for_evaluation: { label: "For Evaluation", bg: "#FFF8E1", text: "#B45309" },
  for_head: { label: "For Head Review", bg: "#E3F2FD", text: "#1565C0" },
  accepted: { label: "Accepted", bg: "#E8F5E9", text: "#2E7D32" },
  under_monitoring: { label: "Under Monitoring", bg: "#E8F5E9", text: "#2E7D32" },
  completed: { label: "Completed", bg: "#E0F2FE", text: "#0369A1" },
  pending: { label: "Pending", bg: "#FFF8E1", text: "#B45309" },
  confirmed: { label: "Received", bg: "#E8F5E9", text: "#2E7D32" },
  rejected: { label: "Rejected", bg: "#FFEBEE", text: "#C62828" },
  failed: { label: "Failed", bg: "#FFEBEE", text: "#C62828" },
  cancelled: { label: "Cancelled", bg: "#F3F4F6", text: "#4B5563" },
  approved: { label: "Approved", bg: "#E8F5E9", text: "#2E7D32" },
  changes_requested: { label: "Changes Requested", bg: "#FFEBEE", text: "#C62828" },
  not_required: { label: "Not Required", bg: "#F3F4F6", text: "#6B7280" },
};
const SEEDLING_STATUS: Record<string, string> = {
  pending: "Waiting for approval",
  accepted: "Approved — awaiting handover",
  confirmed: "Received",
  rejected: "Rejected",
  cancelled: "Cancelled",
};
const VISIT_LABEL: Record<string, string> = {
  initial: "Initial Orientation Visit",
  ongoing: "Ongoing Monitoring Visit",
  inactive_check: "Inactive Site Check",
};

const fmtDate = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
};
const num = (n?: number | null) => (n ?? 0).toLocaleString();
const planted = (r: Report) => r.species.reduce((s, sp) => s + (sp.no_planted || 0), 0);
const reportDate = (r: Report) => r.submitted_at || r.created_at;

function Badge({ status, label }: { status: string; label?: string }) {
  const c = STATUS[status] ?? { label: status.replace(/_/g, " "), bg: "#F3F4F6", text: "#4B5563" };
  return (
    <View style={[st.badge, { backgroundColor: c.bg }]}>
      <Text style={[st.badgeTxt, { color: c.text }]}>{label ?? c.label}</Text>
    </View>
  );
}

function Card({ title, icon, right, children }: { title?: string; icon?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <View style={st.card}>
      {title && (
        <View style={st.cardHead}>
          {icon && <MaterialCommunityIcons name={icon as any} size={17} color={PRIMARY} />}
          <Text style={st.cardTitle}>{title}</Text>
          <View style={{ flex: 1 }} />
          {right}
        </View>
      )}
      {children}
    </View>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <View style={st.row}>
      <Text style={st.rowLabel}>{label}</Text>
      <Text style={st.rowValue}>{value}</Text>
    </View>
  );
}

// ─── Screen ─────────────────────────────────────────────────────────────────

export default function ReportDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [reportSort, setReportSort] = useState<ReportSort>("newest");
  const [mapView, setMapView] = useState<{ title: string; polygon: any; area: number | null } | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);

  const load = useCallback(
    async (mode: "initial" | "refresh") => {
      if (!id) return;
      try {
        if (mode === "initial") setLoading(true);
        setError(null);
        const token = await SecureStore.getItemAsync("token");
        const res = await fetch(`${api}/api/get_tree_grower_application_detail/${id}/`, {
          headers: { Authorization: `Bearer ${token ?? ""}` },
        });
        if (!res.ok) throw new Error(`Couldn't load this application (${res.status}).`);
        setData(await res.json());
      } catch (e: any) {
        setError(e?.message || "Something went wrong.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id],
  );

  // Reload whenever the screen is opened (tabs keep it mounted between visits)
  useFocusEffect(
    useCallback(() => {
      setTab("overview");
      load("initial");
    }, [load]),
  );

  const reports = useMemo(() => {
    const list = [...(data?.progress_reports ?? [])];
    return list.sort((a, b) =>
      reportSort === "oldest" ? byDateAsc(reportDate(a), reportDate(b)) : byDateDesc(reportDate(a), reportDate(b)),
    );
  }, [data, reportSort]);

  const metrics = useMemo(() => {
    const accepted = (data?.progress_reports ?? []).filter((r) => r.status === "accepted");
    const p = accepted.reduce((s, r) => s + planted(r), 0);
    const alive = accepted.reduce((s, r) => s + r.species.reduce((x, sp) => x + (sp.no_survived || 0), 0), 0);
    const dead = accepted.reduce((s, r) => s + (r.total_dead || 0), 0);
    const area = [...accepted]
      .sort((a, b) => byDateDesc(reportDate(a), reportDate(b)))
      .find((r) => r.planted_area_hectares != null)?.planted_area_hectares ?? null;
    const requested = (data?.seedling_requests ?? []).reduce((s, r) => s + (r.no_request_seedling || 0), 0);
    const received = (data?.seedling_requests ?? [])
      .filter((r) => r.status === "accepted" || r.status === "confirmed")
      .reduce((s, r) => s + r.species.reduce((x, sp) => x + (sp.quantity || 0), 0), 0);
    return { planted: p, alive, dead, rate: p > 0 ? Math.round((alive / p) * 1000) / 10 : null, area, requested, received };
  }, [data]);

  // This screen lives in the tab navigator, where "back" returns to the previous tab
  // (often Home). Always return to My Reports instead.
  // Same pattern as the other tree grower detail screens (e.g. SeedlingRequestDetail)
  const goBack = useCallback(() => {
    router.replace("/tree_growers/reports");
  }, [router]);

  // Android hardware back button does the same
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        goBack();
        return true;
      });
      return () => sub.remove();
    }, [goBack]),
  );

  const Header = (
    <View style={[st.header, { paddingTop: insets.top + 8 }]}>
      <TouchableOpacity style={st.backBtn} onPress={goBack} activeOpacity={0.7}>
        <Ionicons name="chevron-back" size={22} color={INK} />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={st.headerTitle}>Program Details</Text>
        <Text style={st.headerSub}>APP-{String(id).padStart(4, "0")}</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={st.container}>
        {Header}
        <View style={st.center}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={st.muted}>Loading details…</Text>
        </View>
      </View>
    );
  }
  if (error || !data) {
    return (
      <View style={st.container}>
        {Header}
        <View style={st.center}>
          <Ionicons name="cloud-offline-outline" size={36} color={PRIMARY} />
          <Text style={st.errTitle}>Couldn't Load</Text>
          <Text style={st.muted}>{error}</Text>
          <TouchableOpacity style={st.primaryBtn} onPress={() => load("initial")}>
            <Text style={st.primaryBtnTxt}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const app = data.application;
  const site = data.assigned_site;
  const history = data.status_history ?? [];
  const closures = data.closure_requests ?? [];
  const pendingClosure = closures.find((c) => c.status === "pending");
  const lastNote = [...history].reverse().find((h) => h.reason && ["rejected", "cancelled", "failed"].includes(h.status));

  // Where the program is in its journey
  const steps = [
    { label: "Submitted", done: true, date: app.created_at },
    { label: "Approved", done: !!app.confirmed_at || ["accepted", "under_monitoring", "completed", "failed"].includes(app.status), date: app.confirmed_at },
    { label: "Orientation", done: !!app.orientation_date && new Date(app.orientation_date) <= new Date(), date: app.orientation_date },
    { label: "Seedlings", done: data.seedling_requests.some((r) => r.status === "confirmed"), date: data.seedling_requests.find((r) => r.status === "confirmed")?.submitted_at ?? null },
    { label: "Monitoring", done: data.progress_reports.some((r) => r.status === "accepted"), date: null },
    { label: app.status === "failed" ? "Failed" : "Completed", done: ["completed", "failed"].includes(app.status), date: null },
  ];
  const closedEarly = ["rejected", "cancelled"].includes(app.status);

  const TABS: [Tab, string][] = [
    ["overview", "Overview"],
    ["site", "Site"],
    ["seedlings", `Seedlings (${data.seedling_requests.length})`],
    ["reports", `Reports (${data.progress_reports.length})`],
    ["history", "History"],
  ];

  return (
    <View style={st.container}>
      {Header}
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load("refresh");
            }}
            tintColor={PRIMARY}
            colors={[PRIMARY]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ── */}
        <View style={st.hero}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={st.heroTitle}>{app.title}</Text>
              <Text style={st.heroSub}>
                {app.classification === "new" ? "New application" : "Re-application"} · Submitted {fmtDate(app.created_at)}
              </Text>
              {site && (
                <Text style={st.heroSub}>
                  <Ionicons name="location-outline" size={12} color="#A7F3D0" /> {site.name}
                  {site.barangay_name ? ` · ${site.barangay_name}` : ""}
                </Text>
              )}
            </View>
            <Badge status={app.status} />
          </View>
          <View style={st.metrics}>
            {[
              [num(metrics.planted), "Planted"],
              [num(metrics.alive), "Alive"],
              [metrics.rate != null ? `${metrics.rate}%` : "—", "Survival"],
              [metrics.area != null ? `${metrics.area.toFixed(2)} ha` : "—", "Area"],
            ].map(([v, l]) => (
              <View key={l} style={st.metric}>
                <Text style={st.metricVal}>{v}</Text>
                <Text style={st.metricLbl}>{l}</Text>
              </View>
            ))}
          </View>
        </View>

        {pendingClosure && (
          <View style={[st.notice, { backgroundColor: "#EEF2FF", borderColor: "#C7D2FE" }]}>
            <Ionicons name="ribbon-outline" size={18} color="#4338CA" />
            <Text style={[st.noticeTxt, { color: "#3730A3" }]}>
              The City ENRO Head is reviewing this program's results to decide if it is completed. You will be notified of the decision.
            </Text>
          </View>
        )}
        {lastNote && (
          <View style={[st.notice, { backgroundColor: "#FEF2F2", borderColor: "#FECACA" }]}>
            <Ionicons name="alert-circle-outline" size={18} color="#B91C1C" />
            <Text style={[st.noticeTxt, { color: "#991B1B" }]}>
              <Text style={{ fontWeight: "800" }}>{lastNote.label}: </Text>
              {lastNote.reason}
            </Text>
          </View>
        )}

        {/* ── Tabs ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.tabs}>
          {TABS.map(([key, label]) => (
            <TouchableOpacity key={key} onPress={() => setTab(key)} style={[st.tab, tab === key && st.tabActive]} activeOpacity={0.7}>
              <Text style={[st.tabTxt, tab === key && st.tabTxtActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── Overview ── */}
        {tab === "overview" && (
          <>
            <Card title="Progress" icon="progress-check">
              {closedEarly ? (
                <Text style={st.muted}>This application was {app.status}. See History for details.</Text>
              ) : (
                steps.map((s, i) => (
                  <View key={s.label} style={st.step}>
                    <View style={st.stepRail}>
                      <View style={[st.stepDot, s.done && st.stepDotDone]}>
                        {s.done && <Ionicons name="checkmark" size={12} color="#FFF" />}
                      </View>
                      {i < steps.length - 1 && <View style={[st.stepLine, s.done && st.stepLineDone]} />}
                    </View>
                    <View style={{ flex: 1, paddingBottom: 12 }}>
                      <Text style={[st.stepLabel, !s.done && { color: FAINT }]}>{s.label}</Text>
                      {s.date && <Text style={st.small}>{fmtDate(s.date)}</Text>}
                    </View>
                  </View>
                ))
              )}
            </Card>

            <Card title="Application" icon="file-document-outline">
              <Row label="Status" value={STATUS[app.status]?.label ?? app.status} />
              <Row label="Participants" value={`${app.total_treegrowers_will_participate} tree growers`} />
              <Row label="Submitted" value={fmtDate(app.created_at)} />
              <Row label="Approved" value={fmtDate(app.confirmed_at)} />
              <Row label="Orientation date" value={fmtDate(app.orientation_date)} />
              {app.proposed_orientation_date && app.proposed_orientation_date !== app.orientation_date && (
                <Row label="Proposed orientation" value={fmtDate(app.proposed_orientation_date)} />
              )}
              <Row label="Last updated" value={fmtDate(app.updated_at)} />
              {data.proposed_site && <Row label="Proposed site" value={data.proposed_site.name} />}
              <View style={st.linksRow}>
                {app.maintenance_plan && (
                  <TouchableOpacity style={st.linkBtn} onPress={() => Linking.openURL(app.maintenance_plan!)}>
                    <Ionicons name="document-text-outline" size={15} color={PRIMARY} />
                    <Text style={st.linkTxt}>Maintenance plan</Text>
                  </TouchableOpacity>
                )}
                {app.agreement_image && (
                  <TouchableOpacity style={st.linkBtn} onPress={() => setPhoto(app.agreement_image)}>
                    <Ionicons name="image-outline" size={15} color={PRIMARY} />
                    <Text style={st.linkTxt}>Agreement</Text>
                  </TouchableOpacity>
                )}
              </View>
            </Card>

            <Card title="Seedlings & Planting" icon="sprout-outline">
              <Row label="Seedlings requested" value={num(metrics.requested)} />
              <Row label="Seedlings released" value={num(metrics.received)} />
              <Row label="Trees planted" value={num(metrics.planted)} />
              <Row label="Alive / dead" value={`${num(metrics.alive)} / ${num(metrics.dead)}`} />
              <Row label="Accepted reports" value={`${data.progress_reports.filter((r) => r.status === "accepted").length} of ${data.progress_reports.length}`} />
            </Card>

            {data.group && (
              <Card title="Group" icon="account-group-outline">
                <Row label="Name" value={data.group.group_name} />
                <Row label="Type" value={data.group.group_type} />
                <Row label="Contact" value={data.group.group_contact} />
                <Row label="Address" value={data.group.group_address} />
              </Card>
            )}
          </>
        )}

        {/* ── Site ── */}
        {tab === "site" &&
          (site ? (
            <>
              <Card
                title={site.name}
                icon="map-marker-radius-outline"
                right={
                  site.polygon_coordinates ? (
                    <TouchableOpacity
                      onPress={() => setMapView({ title: site.name, polygon: null, area: site.total_area_hectares })}
                      style={st.mapBtn}
                    >
                      <Ionicons name="map-outline" size={14} color={PRIMARY} />
                      <Text style={st.linkTxt}>Map</Text>
                    </TouchableOpacity>
                  ) : null
                }
              >
                <Row label="Barangay" value={site.barangay_name ?? "—"} />
                <Row label="Reforestation area" value={site.reforestation_area_name ?? "—"} />
                <Row label="Site area" value={`${(site.total_area_hectares ?? 0).toFixed(2)} ha`} />
                <Row label="Land classification" value={site.land_classification_name ?? "—"} />
                {site.accessibility && (
                  <Row
                    label="Accessibility"
                    value={
                      typeof site.accessibility === "string"
                        ? site.accessibility
                        : Array.isArray(site.accessibility)
                          ? site.accessibility.join(", ")
                          : Object.entries(site.accessibility)
                              .filter(([, v]) => v !== null && v !== "" && v !== false)
                              .map(([k, v]) => `${k.replace(/_/g, " ")}: ${Array.isArray(v) ? v.join(", ") : v === true ? "yes" : v}`)
                              .join("\n") || "—"
                    }
                  />
                )}
                {!!site.description && <Text style={[st.body, { marginTop: 8 }]}>{site.description.replace(/<[^>]+>/g, "")}</Text>}
              </Card>
              {site.recommended_species.length > 0 && (
                <Card title="Recommended Species" icon="tree-outline">
                  <View style={st.chips}>
                    {site.recommended_species.map((sp) => (
                      <View key={`${sp.species_id}-${sp.rank}`} style={st.chip}>
                        <Text style={st.chipTxt}>
                          #{sp.rank} {sp.species_name}
                        </Text>
                      </View>
                    ))}
                  </View>
                </Card>
              )}
              {site.general_images.filter((g) => g.image_url).length > 0 && (
                <Card title="Site Photos" icon="image-multiple-outline">
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {site.general_images
                      .filter((g) => g.image_url)
                      .map((g, i) => (
                        <TouchableOpacity key={i} onPress={() => setPhoto(g.image_url)} style={{ marginRight: 10 }}>
                          <Image source={{ uri: g.image_url! }} style={st.thumb} />
                          {!!g.caption && (
                            <Text style={[st.small, { width: 120 }]} numberOfLines={1}>
                              {g.caption}
                            </Text>
                          )}
                        </TouchableOpacity>
                      ))}
                  </ScrollView>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <Text style={st.muted}>
                No site assigned yet{data.proposed_site ? ` — proposed: ${data.proposed_site.name}` : ""}.
              </Text>
            </Card>
          ))}

        {/* ── Seedlings ── */}
        {tab === "seedlings" &&
          (data.seedling_requests.length === 0 ? (
            <Card>
              <Text style={st.muted}>No seedling requests yet.</Text>
            </Card>
          ) : (
            [...data.seedling_requests]
              .sort((a, b) => byDateDesc(a.submitted_at ?? a.created_at, b.submitted_at ?? b.created_at))
              .map((r) => (
                <Card
                  key={r.request_id}
                  title={`Request · ${fmtDate(r.submitted_at ?? r.created_at)}`}
                  icon="package-variant-closed"
                  right={<Badge status={r.status} label={SEEDLING_STATUS[r.status]} />}
                >
                  <Row label="Requested" value={`${num(r.no_request_seedling)} seedlings`} />
                  {r.species.map((sp, i) => (
                    <Row key={i} label={sp.species_name} value={`× ${num(sp.quantity)}${sp.provided_by ? ` · ${sp.provided_by}` : ""}`} />
                  ))}
                  {r.fulfillment_type && <Row label="Handover" value={r.fulfillment_type === "deliver" ? "Delivered to site" : "Pick-up"} />}
                  {r.assigned_inspector && (
                    <Row label="Inspector" value={`${r.assigned_inspector.name}${r.assigned_inspector.contact ? ` · ${r.assigned_inspector.contact}` : ""}`} />
                  )}
                  {!!(r.reason_accepted || r.reason) && <Text style={[st.note]}>“{r.reason_accepted || r.reason}”</Text>}
                  {r.proof_of_delivery && (
                    <TouchableOpacity style={[st.linkBtn, { marginTop: 8 }]} onPress={() => setPhoto(r.proof_of_delivery)}>
                      <Ionicons name="image-outline" size={15} color={PRIMARY} />
                      <Text style={st.linkTxt}>Proof of delivery</Text>
                    </TouchableOpacity>
                  )}
                </Card>
              ))
          ))}

        {/* ── Reports ── */}
        {tab === "reports" && (
          <>
            {reports.length > 0 && (
              <View style={st.sortRow}>
                <Text style={st.small}>
                  {reports.length} report{reports.length === 1 ? "" : "s"}
                </Text>
                <SortMenu value={reportSort} options={REPORT_SORTS} onChange={setReportSort} title="Sort reports" />
              </View>
            )}
            {reports.length === 0 ? (
              <Card>
                <Text style={st.muted}>No monitoring reports yet. Reports appear here after the onsite inspector visits your site.</Text>
              </Card>
            ) : (
              reports.map((r) => (
                <Card
                  key={r.report_id}
                  title={VISIT_LABEL[r.visit_type] ?? "Monitoring Visit"}
                  icon="clipboard-text-outline"
                  right={
                    <Badge
                      status={r.status === "pending" && r.dm_review?.status === "approved" ? "for_head" : r.status}
                      label={r.status === "pending" && r.dm_review?.status === "approved" ? "Map Check" : undefined}
                    />
                  }
                >
                  <Text style={st.small}>
                    {fmtDate(reportDate(r))}
                    {r.submitted_by ? ` · by ${r.submitted_by.name}` : ""}
                    {r.orientation_conducted ? " · orientation conducted" : ""}
                  </Text>

                  <View style={st.speciesHead}>
                    <Text style={[st.speciesCell, { flex: 2 }]}>Species</Text>
                    <Text style={st.speciesCell}>Planted</Text>
                    <Text style={st.speciesCell}>Alive</Text>
                    <Text style={st.speciesCell}>Dead</Text>
                  </View>
                  {r.species.map((sp) => (
                    <View key={sp.species_id} style={st.speciesRow}>
                      <Text style={[st.speciesVal, { flex: 2, textAlign: "left" }]} numberOfLines={1}>
                        {sp.species_name}
                      </Text>
                      <Text style={st.speciesVal}>{num(sp.no_planted)}</Text>
                      <Text style={[st.speciesVal, { color: "#15803D" }]}>{num(sp.no_survived)}</Text>
                      <Text style={[st.speciesVal, { color: "#DC2626" }]}>{num(sp.no_dead)}</Text>
                    </View>
                  ))}

                  {r.planted_area_hectares != null && (
                    <View style={st.areaRow}>
                      <Ionicons name="map-outline" size={14} color={PRIMARY} />
                      <Text style={st.body}>Planted area {r.planted_area_hectares.toFixed(2)} ha</Text>
                      {r.polygon_coordinates && (
                        <TouchableOpacity
                          onPress={() =>
                            setMapView({
                              title: `${VISIT_LABEL[r.visit_type] ?? "Visit"} · ${fmtDate(reportDate(r))}`,
                              polygon: r.polygon_coordinates,
                              area: r.planted_area_hectares,
                            })
                          }
                          style={{ marginLeft: "auto" }}
                        >
                          <Text style={st.linkTxt}>View on map ›</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}

                  {!!r.description && <Text style={st.note}>“{r.description}”</Text>}

                  {/* Review steps */}
                  {(r.dm_review || r.gis_review) && (
                    <View style={st.reviews}>
                      {[
                        ["Data Manager", r.dm_review],
                        ["GIS Specialist", r.gis_review],
                      ].map(([who, rv]: any) =>
                        rv && rv.status !== "not_required" ? (
                          <View key={who} style={st.review}>
                            <Text style={st.reviewWho}>{who}</Text>
                            <Badge status={rv.status} label={rv.label} />
                            {rv.at && <Text style={st.small}>{fmtDate(rv.at)}</Text>}
                            {!!rv.notes && <Text style={st.note}>“{rv.notes}”</Text>}
                          </View>
                        ) : null,
                      )}
                    </View>
                  )}

                  {(r.proof_image || r.agreement_image) && (
                    <View style={st.linksRow}>
                      {r.proof_image && (
                        <TouchableOpacity style={st.linkBtn} onPress={() => setPhoto(r.proof_image)}>
                          <Ionicons name="camera-outline" size={15} color={PRIMARY} />
                          <Text style={st.linkTxt}>Visit photo</Text>
                        </TouchableOpacity>
                      )}
                      {r.agreement_image && (
                        <TouchableOpacity style={st.linkBtn} onPress={() => setPhoto(r.agreement_image)}>
                          <Ionicons name="document-outline" size={15} color={PRIMARY} />
                          <Text style={st.linkTxt}>Agreement</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </Card>
              ))
            )}
          </>
        )}

        {/* ── History ── */}
        {tab === "history" && (
          <Card title="Decisions & Status Changes" icon="history">
            {history.length === 0 && closures.length === 0 ? (
              <Text style={st.muted}>No decisions recorded yet.</Text>
            ) : (
              [
                ...history.map((h) => ({
                  date: h.created,
                  title: h.label,
                  status: h.status,
                  detail: h.reason,
                  by: h.by ? `${h.by.name} · ${h.by.role}` : null,
                })),
                ...closures.flatMap((c) => [
                  {
                    date: c.requested_at,
                    title: `Closure recommended: ${c.recommendation}`,
                    status: "pending",
                    detail: c.reason,
                    by: "Data Manager",
                  },
                  ...(c.decided_at
                    ? [
                        {
                          date: c.decided_at,
                          title: `Closure ${c.status_label.toLowerCase()}${c.final_outcome ? ` (${c.final_outcome})` : ""}`,
                          status: c.final_outcome ?? c.status,
                          detail: c.head_notes,
                          by: "City ENRO Head",
                        },
                      ]
                    : []),
                ]),
              ]
                .sort((a, b) => byDateDesc(a.date, b.date))
                .map((e, i, arr) => (
                  <View key={i} style={st.step}>
                    <View style={st.stepRail}>
                      <View style={[st.stepDot, st.stepDotDone, { backgroundColor: STATUS[e.status]?.text ?? PRIMARY }]} />
                      {i < arr.length - 1 && <View style={[st.stepLine, { backgroundColor: BORDER }]} />}
                    </View>
                    <View style={{ flex: 1, paddingBottom: 14 }}>
                      <Text style={st.stepLabel}>{e.title}</Text>
                      <Text style={st.small}>
                        {fmtDate(e.date)}
                        {e.by ? ` · ${e.by}` : ""}
                      </Text>
                      {!!e.detail && <Text style={st.note}>“{e.detail}”</Text>}
                    </View>
                  </View>
                ))
            )}
          </Card>
        )}
      </ScrollView>

      <ReportPolygonMapModal
        visible={!!mapView}
        onClose={() => setMapView(null)}
        title={mapView?.title ?? ""}
        subtitle={site?.name}
        reportPolygon={mapView?.polygon}
        sitePolygon={site?.polygon_coordinates}
        areaHectares={mapView?.area}
      />

      <Modal visible={!!photo} transparent animationType="fade" onRequestClose={() => setPhoto(null)}>
        <Pressable style={st.photoBackdrop} onPress={() => setPhoto(null)}>
          {photo && <Image source={{ uri: photo }} style={st.photo} resizeMode="contain" />}
          <Text style={st.photoHint}>Tap anywhere to close</Text>
        </Pressable>
      </Modal>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, padding: 24 },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingBottom: 10, backgroundColor: BG },
  backBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: "#FFF", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: BORDER },
  headerTitle: { fontSize: 18, fontWeight: "800", color: INK },
  headerSub: { fontSize: 12, color: MUTED },
  muted: { fontSize: 13, color: MUTED, textAlign: "left" },
  errTitle: { fontSize: 16, fontWeight: "800", color: INK },
  primaryBtn: { backgroundColor: PRIMARY, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, marginTop: 6 },
  primaryBtnTxt: { color: "#FFF", fontWeight: "700" },

  hero: { backgroundColor: PRIMARY, borderRadius: 18, padding: 16, marginBottom: 12 },
  heroTitle: { fontSize: 18, fontWeight: "800", color: "#FFF" },
  heroSub: { fontSize: 12, color: "#A7F3D0", marginTop: 3 },
  metrics: { flexDirection: "row", marginTop: 14, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 12, paddingVertical: 10 },
  metric: { flex: 1, alignItems: "center" },
  metricVal: { fontSize: 15, fontWeight: "800", color: "#FFF" },
  metricLbl: { fontSize: 10.5, color: "#A7F3D0", marginTop: 2 },

  notice: { flexDirection: "row", gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  noticeTxt: { flex: 1, fontSize: 12.5, lineHeight: 18 },

  tabs: { gap: 8, paddingBottom: 12 },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: "#FFF", borderWidth: 1, borderColor: BORDER },
  tabActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  tabTxt: { fontSize: 13, fontWeight: "700", color: MUTED },
  tabTxtActive: { color: "#FFF" },

  card: { backgroundColor: "#FFF", borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: "rgba(0,0,0,0.04)" },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  cardTitle: { fontSize: 14.5, fontWeight: "800", color: INK, flexShrink: 1 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  rowLabel: { fontSize: 13, color: MUTED, flexShrink: 0, maxWidth: "45%" },
  rowValue: { fontSize: 13, color: INK, fontWeight: "600", flex: 1, textAlign: "right" },
  body: { fontSize: 13, color: "#374151", lineHeight: 19 },
  small: { fontSize: 11.5, color: MUTED },
  note: { fontSize: 12.5, color: "#4B5563", fontStyle: "italic", marginTop: 6, lineHeight: 18 },

  badge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  badgeTxt: { fontSize: 11, fontWeight: "800" },

  step: { flexDirection: "row", gap: 10 },
  stepRail: { alignItems: "center", width: 20 },
  stepDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#E5E7EB", alignItems: "center", justifyContent: "center" },
  stepDotDone: { backgroundColor: "#16A34A" },
  stepLine: { width: 2, flex: 1, backgroundColor: "#E5E7EB", marginVertical: 2 },
  stepLineDone: { backgroundColor: "#86EFAC" },
  stepLabel: { fontSize: 13.5, fontWeight: "700", color: INK },

  linksRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  linkBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: "#ECFDF5" },
  linkTxt: { fontSize: 12.5, fontWeight: "700", color: PRIMARY },
  mapBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: "#ECFDF5" },

  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: "#F0FDF4", borderWidth: 1, borderColor: "#BBF7D0" },
  chipTxt: { fontSize: 12, color: "#166534", fontWeight: "600" },
  thumb: { width: 120, height: 90, borderRadius: 10, backgroundColor: "#E5E7EB" },

  sortRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  speciesHead: { flexDirection: "row", marginTop: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: BORDER },
  speciesCell: { flex: 1, fontSize: 10.5, fontWeight: "800", color: FAINT, textAlign: "right", textTransform: "uppercase" },
  speciesRow: { flexDirection: "row", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#F9FAFB" },
  speciesVal: { flex: 1, fontSize: 13, color: INK, textAlign: "right" },
  areaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },
  reviews: { marginTop: 10, gap: 8 },
  review: { backgroundColor: "#F9FAFB", borderRadius: 10, padding: 10, gap: 4, alignItems: "flex-start" },
  reviewWho: { fontSize: 11, fontWeight: "800", color: MUTED, textTransform: "uppercase", letterSpacing: 0.5 },

  photoBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", alignItems: "center", justifyContent: "center" },
  photo: { width: "92%", height: "75%" },
  photoHint: { color: "rgba(255,255,255,0.6)", marginTop: 12, fontSize: 12 },
});
