import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { api } from "@/constants/url_fixed";
import { getToken, isAuthFailure, clearAuthData } from "@/utils/auth";
import { useNetworkStatus } from "@/utils/networkStatus";

const API = api + "/api";

const BG = "#F3F6F4";
const PRIMARY = "#0F4A2F";
const INK = "#111827";
const MUTED = "#6B7280";
const FAINT = "#9CA3AF";

type Kind = "visits" | "assessments";
type Period = "month" | "quarter" | "all";

interface VisitRow {
  id: number;
  date: string;
  site_id: number | null;
  site_name: string;
  barangay: string | null;
  program: string | null;
  group_name: string | null;
  visit_type: string;
  status: "accepted" | "pending" | "returned";
  stage: string;
  notes: string | null;
  planted: number;
  dead: number;
  species: string[];
  planted_hectares: number | null;
}

interface AssessmentRow {
  id: number;
  title: string;
  date: string;
  area_id: number | null;
  area_name: string;
  barangay: string | null;
  site_id: number | null;
  site_name: string | null;
  status: "submitted" | "draft";
  layers: string[];
  photos: number;
}

interface ReportData {
  type: Kind;
  summary: any;
  counts: Record<string, number>;
  monthly: any[];
  rows: (VisitRow | AssessmentRow)[];
}

const STATUS = {
  accepted: { label: "Accepted", fg: "#059669", bg: "#D1FAE5", icon: "check-circle-outline" },
  pending: { label: "In review", fg: "#D97706", bg: "#FEF3C7", icon: "clock-outline" },
  returned: { label: "Returned", fg: "#DC2626", bg: "#FEE2E2", icon: "file-undo-outline" },
  submitted: { label: "Submitted", fg: "#059669", bg: "#D1FAE5", icon: "check-circle-outline" },
  draft: { label: "Draft", fg: "#D97706", bg: "#FEF3C7", icon: "pencil-outline" },
} as const;

const LAYER_LABEL: Record<string, string> = {
  meta_data: "Meta",
  safety: "Safety",
  survivability: "Survivability",
  boundary_verification: "Boundary",
};

const PERIODS: { key: Period; label: string }[] = [
  { key: "month", label: "This month" },
  { key: "quarter", label: "3 months" },
  { key: "all", label: "All time" },
];

const fmt = (n: number | null | undefined) => (n ?? 0).toLocaleString();
const shortDate = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/* ──────────────────────────────────────────────────────────────────
   SMALL COMPONENTS
   ──────────────────────────────────────────────────────────────── */
const Chip: React.FC<{ label: string; active: boolean; onPress: () => void; count?: number }> = ({ label, active, onPress, count }) => (
  <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress} activeOpacity={0.75}>
    <Text style={[styles.chipText, active && styles.chipTextActive]}>
      {label}
      {count !== undefined ? ` · ${count}` : ""}
    </Text>
  </TouchableOpacity>
);

const Stat: React.FC<{ value: string; label: string; color?: string }> = ({ value, label, color = INK }) => (
  <View style={styles.stat}>
    <Text style={[styles.statValue, { color }]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

/** Simple 6-month bars: accepted (green) stacked under returned (red), or submitted assessments. */
const MiniBars: React.FC<{ data: any[]; kind: Kind }> = ({ data, kind }) => {
  const totals = data.map((m) => (kind === "visits" ? m.accepted + m.returned : m.submitted));
  const max = Math.max(1, ...totals);
  return (
    <View style={styles.bars}>
      {data.map((m, i) => {
        const a = kind === "visits" ? m.accepted : m.submitted;
        const r = kind === "visits" ? m.returned : 0;
        return (
          <View key={i} style={styles.barCol}>
            <View style={styles.barTrack}>
              {r > 0 && <View style={[styles.barSeg, { height: `${(r / max) * 100}%`, backgroundColor: "#FCA5A5" }]} />}
              {a > 0 && <View style={[styles.barSeg, { height: `${(a / max) * 100}%`, backgroundColor: "#34D399" }]} />}
            </View>
            <Text style={styles.barLabel}>{m.month}</Text>
          </View>
        );
      })}
    </View>
  );
};

/* ──────────────────────────────────────────────────────────────────
   SCREEN
   ──────────────────────────────────────────────────────────────── */
export default function ReportsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isOnline = useNetworkStatus();

  const [kind, setKind] = useState<Kind>("visits");
  const [period, setPeriod] = useState<Period>("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Wait until the inspector stops typing before searching
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => setQuery(search.trim()), 400);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [search]);

  const load = useCallback(async () => {
    if (!isOnline) {
      setError("You're offline. Reports need an internet connection.");
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      setError(null);
      const token = await getToken();
      if (!token) {
        await clearAuthData();
        router.replace("/homepage");
        return;
      }
      const params = new URLSearchParams({ type: kind, period, status });
      if (query) params.append("search", query);
      const res = await fetch(`${API}/inspector/my-reports/?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (isAuthFailure(res.status)) {
        await clearAuthData();
        router.replace("/homepage");
        return;
      }
      const body = await res.json();
      if (!res.ok || !body.success) throw new Error(body.error || "Failed to load reports");
      setData(body.data);
    } catch (e: any) {
      setError(e.message || "Failed to load reports");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isOnline, kind, period, status, query, router]);

  useEffect(() => {
    load();
  }, [load]);

  const switchKind = (k: Kind) => {
    if (k === kind) return;
    setKind(k);
    setStatus("all");
    setLoading(true);
  };

  const s = data?.summary;
  const rows = data?.type === kind ? data.rows : [];
  const statusChips =
    kind === "visits"
      ? [
          { key: "all", label: "All" },
          { key: "returned", label: "Returned" },
          { key: "pending", label: "In review" },
          { key: "accepted", label: "Accepted" },
        ]
      : [
          { key: "all", label: "All" },
          { key: "draft", label: "Drafts" },
          { key: "submitted", label: "Submitted" },
        ];

  const openVisit = (r: VisitRow) => r.site_id && router.push(`/(tabs)/monitoring/${r.site_id}` as any);
  const openAssessment = (a: AssessmentRow) =>
    a.area_id &&
    router.push({
      pathname: "/feedbacks/site_field_assessment",
      params: {
        areaId: String(a.area_id),
        areaName: a.area_name,
        ...(a.site_id ? { siteId: String(a.site_id), siteName: a.site_name ?? "" } : {}),
        assessmentType: a.site_id ? "specific" : "general",
      },
    } as any);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} translucent={false} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/profile" as any))}>
          <Ionicons name="chevron-back" size={22} color={INK} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>My Reports</Text>
          <Text style={styles.subtitle}>Your monitoring visits and field assessments</Text>
        </View>
      </View>

      {/* Visits / Assessments */}
      <View style={styles.segment}>
        {(["visits", "assessments"] as Kind[]).map((k) => (
          <TouchableOpacity key={k} style={[styles.segBtn, kind === k && styles.segBtnActive]} onPress={() => switchKind(k)} activeOpacity={0.8}>
            <MaterialCommunityIcons
              name={k === "visits" ? "map-marker-check-outline" : "clipboard-text-outline"}
              size={16}
              color={kind === k ? "#fff" : MUTED}
            />
            <Text style={[styles.segText, kind === k && styles.segTextActive]}>{k === "visits" ? "Visit reports" : "Assessments"}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={PRIMARY}
            colors={[PRIMARY]}
          />
        }
      >
        {/* Period */}
        <View style={styles.chipRow}>
          {PERIODS.map((p) => (
            <Chip key={p.key} label={p.label} active={period === p.key} onPress={() => setPeriod(p.key)} />
          ))}
        </View>

        {loading && !data ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={PRIMARY} />
          </View>
        ) : error && !data ? (
          <View style={styles.center}>
            <Ionicons name="cloud-offline-outline" size={46} color={FAINT} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.btn} onPress={load}>
              <Text style={styles.btnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : s && data?.type === kind ? (
          <>
            {/* Summary */}
            <View style={styles.card}>
              {kind === "visits" ? (
                <>
                  <View style={styles.statRow}>
                    <Stat value={fmt(s.total)} label="Submitted" />
                    <Stat value={fmt(s.accepted)} label="Accepted" color="#059669" />
                    <Stat value={fmt(s.returned)} label="Returned" color={s.returned > 0 ? "#DC2626" : INK} />
                  </View>
                  <Text style={styles.footnote}>
                    {fmt(s.plants_recorded)} plants and {fmt(s.deaths_recorded)} deaths recorded in accepted reports · {s.sites} site
                    {s.sites !== 1 ? "s" : ""}
                  </Text>
                </>
              ) : (
                <View style={styles.statRow}>
                  <Stat value={fmt(s.submitted)} label="Submitted" color="#059669" />
                  <Stat value={fmt(s.draft)} label="Drafts" color={s.draft > 0 ? "#D97706" : INK} />
                  <Stat value={fmt(s.photos)} label="Photos" />
                </View>
              )}
            </View>

            {/* Last 6 months */}
            <View style={[styles.card, { marginTop: 12 }]}>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle}>Last 6 months</Text>
                {kind === "visits" && (
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <Legend color="#34D399" label="Accepted" />
                    <Legend color="#FCA5A5" label="Returned" />
                  </View>
                )}
              </View>
              <MiniBars data={data.monthly} kind={kind} />
            </View>

            {/* Search + status */}
            <View style={styles.search}>
              <Ionicons name="search" size={17} color={FAINT} />
              <TextInput
                style={styles.searchInput}
                placeholder={kind === "visits" ? "Search site, program or group" : "Search title, site or area"}
                placeholderTextColor={FAINT}
                value={search}
                onChangeText={setSearch}
                returnKeyType="search"
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch("")} hitSlop={8}>
                  <Ionicons name="close-circle" size={17} color={FAINT} />
                </TouchableOpacity>
              )}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {statusChips.map((c) => (
                <Chip
                  key={c.key}
                  label={c.label}
                  active={status === c.key}
                  onPress={() => setStatus(c.key)}
                  count={c.key === "all" ? s.total : data.counts[c.key] ?? 0}
                />
              ))}
            </ScrollView>

            {/* List */}
            {rows.length === 0 ? (
              <View style={[styles.card, styles.empty]}>
                <MaterialCommunityIcons name="file-search-outline" size={38} color="#D1D5DB" />
                <Text style={styles.emptyText}>No reports match these filters</Text>
              </View>
            ) : kind === "visits" ? (
              (rows as VisitRow[]).map((r) => {
                const st = STATUS[r.status];
                return (
                  <TouchableOpacity key={r.id} style={styles.item} activeOpacity={0.75} onPress={() => openVisit(r)}>
                    <View style={[styles.itemIcon, { backgroundColor: st.bg }]}>
                      <MaterialCommunityIcons name={st.icon as any} size={20} color={st.fg} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.rowBetween}>
                        <Text style={styles.itemTitle} numberOfLines={1}>
                          {r.site_name}
                        </Text>
                        <View style={[styles.tag, { backgroundColor: st.bg }]}>
                          <Text style={[styles.tagText, { color: st.fg }]}>{st.label}</Text>
                        </View>
                      </View>
                      <Text style={styles.itemSub} numberOfLines={1}>
                        {r.visit_type} · {shortDate(r.date)}
                      </Text>
                      {r.group_name && (
                        <Text style={styles.itemMeta} numberOfLines={1}>
                          {r.program} · {r.group_name}
                        </Text>
                      )}
                      {r.status === "returned" ? (
                        <View style={styles.note}>
                          <Text style={styles.noteText} numberOfLines={2}>
                            {r.notes ? `“${r.notes}”` : r.stage}
                          </Text>
                          <Text style={styles.noteAction}>Tap to fix and resubmit</Text>
                        </View>
                      ) : (
                        <Text style={styles.itemMeta}>
                          {r.status === "pending" ? r.stage : `${fmt(r.planted)} planted · ${fmt(r.dead)} dead`}
                          {r.planted_hectares ? ` · ${r.planted_hectares} ha` : ""}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })
            ) : (
              (rows as AssessmentRow[]).map((a) => {
                const st = STATUS[a.status];
                return (
                  <TouchableOpacity key={a.id} style={styles.item} activeOpacity={0.75} onPress={() => openAssessment(a)}>
                    <View style={[styles.itemIcon, { backgroundColor: st.bg }]}>
                      <MaterialCommunityIcons name={st.icon as any} size={20} color={st.fg} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.rowBetween}>
                        <Text style={styles.itemTitle} numberOfLines={1}>
                          {a.title}
                        </Text>
                        <View style={[styles.tag, { backgroundColor: st.bg }]}>
                          <Text style={[styles.tagText, { color: st.fg }]}>{st.label}</Text>
                        </View>
                      </View>
                      <Text style={styles.itemSub} numberOfLines={1}>
                        {a.site_name ?? "General"} · {a.area_name} · {shortDate(a.date)}
                      </Text>
                      <Text style={styles.itemMeta} numberOfLines={1}>
                        {a.layers.length > 0 ? a.layers.map((l) => LAYER_LABEL[l]).join(", ") : "No layers yet"} · {a.photos} photo
                        {a.photos !== 1 ? "s" : ""}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </>
        ) : (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={PRIMARY} />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const Legend: React.FC<{ color: string; label: string }> = ({ color, label }) => (
  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
    <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: color }} />
    <Text style={{ fontSize: 10.5, color: MUTED }}>{label}</Text>
  </View>
);

/* ──────────────────────────────────────────────────────────────────
   STYLES
   ──────────────────────────────────────────────────────────────── */
const shadow = {
  shadowColor: "#0F172A",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.05,
  shadowRadius: 10,
  elevation: 2,
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingBottom: 12, gap: 6 },
  backBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "#fff", ...shadow },
  title: { fontSize: 24, fontWeight: "800", color: INK, letterSpacing: -0.3, marginLeft: 6 },
  subtitle: { fontSize: 12, color: MUTED, marginLeft: 6, marginTop: 1 },

  segment: { flexDirection: "row", marginHorizontal: 20, backgroundColor: "#E6EBE8", borderRadius: 14, padding: 4, gap: 4 },
  segBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 11 },
  segBtnActive: { backgroundColor: PRIMARY },
  segText: { fontSize: 13, fontWeight: "700", color: MUTED },
  segTextActive: { color: "#fff" },

  chipRow: { flexDirection: "row", gap: 8, paddingHorizontal: 20, marginTop: 14, marginBottom: 2 },
  chip: { paddingHorizontal: 13, paddingVertical: 7, borderRadius: 20, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5E7EB" },
  chipActive: { backgroundColor: "#E7F3EC", borderColor: PRIMARY },
  chipText: { fontSize: 12, fontWeight: "600", color: MUTED },
  chipTextActive: { color: PRIMARY },

  center: { alignItems: "center", justifyContent: "center", paddingVertical: 60, paddingHorizontal: 30 },
  errorText: { fontSize: 13.5, color: MUTED, textAlign: "center", marginTop: 10, marginBottom: 16 },
  btn: { backgroundColor: PRIMARY, paddingHorizontal: 26, paddingVertical: 11, borderRadius: 12 },
  btnText: { color: "#fff", fontWeight: "700" },

  card: { backgroundColor: "#fff", marginHorizontal: 20, marginTop: 14, borderRadius: 20, padding: 16, ...shadow },
  cardTitle: { fontSize: 14, fontWeight: "800", color: INK },
  statRow: { flexDirection: "row" },
  stat: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 24, fontWeight: "800" },
  statLabel: { fontSize: 12, color: MUTED, marginTop: 2, fontWeight: "500" },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  footnote: { fontSize: 11.5, color: FAINT, marginTop: 12, textAlign: "center" },

  bars: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", height: 96, marginTop: 14 },
  barCol: { flex: 1, alignItems: "center" },
  barTrack: { width: 18, height: 74, justifyContent: "flex-end", borderRadius: 6, backgroundColor: "#F3F4F6", overflow: "hidden" },
  barSeg: { width: "100%" },
  barLabel: { fontSize: 10.5, color: MUTED, marginTop: 6, fontWeight: "600" },

  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 20,
    marginTop: 22,
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 46,
    ...shadow,
  },
  searchInput: { flex: 1, fontSize: 14, color: INK, paddingVertical: 0 },

  item: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#fff",
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 18,
    padding: 14,
    ...shadow,
  },
  itemIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  itemTitle: { flex: 1, fontSize: 14, fontWeight: "700", color: INK },
  itemSub: { fontSize: 12, color: MUTED, marginTop: 2 },
  itemMeta: { fontSize: 11.5, color: FAINT, marginTop: 3 },
  tag: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  tagText: { fontSize: 10.5, fontWeight: "800" },
  note: { marginTop: 8, backgroundColor: "#FEF2F2", borderRadius: 10, padding: 9 },
  noteText: { fontSize: 12, color: "#991B1B" },
  noteAction: { fontSize: 11, color: "#DC2626", fontWeight: "700", marginTop: 4 },

  empty: { alignItems: "center", paddingVertical: 30 },
  emptyText: { fontSize: 13, color: MUTED, marginTop: 8 },
});
