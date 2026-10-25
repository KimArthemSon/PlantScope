import { useEffect, useState, type ReactElement } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  BarChart3,
  Camera,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileSearch,
  FileText,
  History,
  Layers,
  MapPin,
  MapPinned,
  RefreshCw,
  ShieldAlert,
  TreePine,
  Users,
} from "lucide-react";
import { api } from "@/constant/api";
import { exportCsv, exportPdf, type ExportSpec } from "../dataManager/reports/reportExport";
import SiteHistoryModal from "../dataManager/reports/SiteHistoryModal";
import { ProgramsTab, type FilterOptions } from "../dataManager/reports/reports";
import {
  AXIS_TICK,
  Badge,
  Card,
  DATE_PRESETS,
  DateRangeFilter,
  EmptyState,
  ExportButtons,
  FilterBar,
  GreenTooltip,
  Kpi,
  LoadingBlock,
  Pagination,
  SearchFilter,
  SectionTitle,
  SelectFilter,
  Td,
  Th,
  fmt,
  fmtDate,
  fmtHa,
  usePaged,
  useReport,
} from "../dataManager/reports/reportUi";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Breakdown {
  key: string;
  name: string;
  value: number;
  fill: string;
}

interface SiteRow {
  site_id: number;
  name: string;
  reforestation_area: string | null;
  barangay: string | null;
  status: string;
  status_label: string;
  verification: string;
  verification_label: string;
  verified_by: string | null;
  verified_at: string | null;
  official: boolean;
  monitoring_status: string | null;
  monitoring_label: string | null;
  land_classification: string | null;
  site_hectares: number;
  planted_hectares: number | null;
  planted_pct: number | null;
  assessments: number;
  last_assessment: string | null;
  programs: number;
  current_program: string | null;
  current_group: string | null;
  created_at: string;
  updated_at: string;
  issues: string[];
}

interface SitesReport {
  summary: {
    total: number;
    hectares: number;
    official: number;
    official_hectares: number;
    planted_hectares: number;
    pending: number;
    verification_pending: number;
    not_verified: number;
    with_issues: number;
    assessments: number;
    areas: number;
  };
  status_breakdown: Breakdown[];
  verification_breakdown: Breakdown[];
  by_barangay: { name: string; sites: number; official: number; hectares: number; planted_hectares: number }[];
  monthly: { month: string; created: number; verified: number }[];
  rows: SiteRow[];
}

interface ReviewRow {
  id: number;
  submitted: string;
  site_id: number | null;
  site_name: string | null;
  barangay: string | null;
  program: string | null;
  group_name: string | null;
  visit_type: string;
  inspector: string | null;
  report_status: string;
  dm_review: string;
  dm_reviewer: string | null;
  dm_reviewed_at: string | null;
  stage: string;
  stage_label: string;
  gis_reviewer: string | null;
  gis_reviewed_at: string | null;
  gis_notes: string | null;
  planted_hectares: number | null;
  site_hectares: number;
  planted_pct: number | null;
  oversized: boolean;
  turnaround_days: number | null;
  waiting_days: number | null;
}

interface ReviewsReport {
  summary: {
    total: number;
    awaiting_dm: number;
    dm_returned: number;
    pending: number;
    approved: number;
    changes_requested: number;
    oversized: number;
    avg_turnaround_days: number | null;
    oldest_waiting_days: number | null;
    confirmed_hectares: number;
    sites: number;
  };
  stage_breakdown: Breakdown[];
  monthly: { month: string; submitted: number; approved: number; changes_requested: number }[];
  by_reviewer: { name: string; reviews: number; approved: number }[];
  rows: ReviewRow[];
}

interface AssessmentRow {
  id: number;
  title: string;
  type: "General" | "Specific";
  inspector: string | null;
  reforestation_area: string | null;
  barangay: string | null;
  site_id: number | null;
  site_name: string | null;
  site_status: string | null;
  land_classification: string | null;
  layers: string[];
  photos: number;
  has_location: boolean;
  security_concerns: string[];
  high_risk: boolean;
  assessment_date: string | null;
  submitted: string;
}

interface AssessmentsReport {
  summary: {
    total: number;
    general: number;
    specific: number;
    photos: number;
    with_concerns: number;
    high_risk: number;
    without_location: number;
    sites: number;
    inspectors: number;
  };
  layers: { name: string; value: number }[];
  photos_by_layer: { name: string; group: string; value: number }[];
  monthly: { month: string; general: number; specific: number }[];
  by_inspector: { name: string; assessments: number; photos: number }[];
  inspector_tracking: InspectorTracking;
  rows: AssessmentRow[];
}

interface InspectorRow {
  id: number;
  name: string;
  email: string;
  is_active: boolean;
  areas: string[];
  barangays: string[];
  assigned_since: string | null;
  assessments: number;
  general: number;
  specific: number;
  photos: number;
  avg_photos: number | null;
  avg_layers: number | null;
  without_gps: number;
  concerns_reported: number;
  visits: number;
  visits_accepted: number;
  visits_pending: number;
  visits_rejected: number;
  visits_with_polygon: number;
  acceptance_rate: number | null;
  handovers_waiting: number;
  handovers_confirmed: number;
  sites_covered: number;
  last_assessment: string | null;
  last_visit: string | null;
  last_active: string | null;
  days_idle: number | null;
  activity: "active" | "idle" | "inactive";
}

interface InspectorTracking {
  summary: {
    total: number;
    active: number;
    idle: number;
    inactive: number;
    unassigned: number;
    visits: number;
    visits_rejected: number;
    handovers_waiting: number;
    active_days: number;
    inactive_days: number;
  };
  rows: InspectorRow[];
}

// ─── Shared helpers ─────────────────────────────────────────────────────────

const SITE_TONE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  under_review: "bg-blue-50 text-blue-700 border-blue-200",
  accepted: "bg-green-50 text-green-700 border-green-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  failed: "bg-red-50 text-red-700 border-red-200",
};
const VERIFICATION_TONE: Record<string, string> = {
  none: "bg-gray-50 text-gray-500 border-gray-200",
  draft: "bg-gray-100 text-gray-600 border-gray-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  verified: "bg-green-50 text-green-700 border-green-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
};
const STAGE_TONE: Record<string, string> = {
  awaiting_dm: "bg-gray-100 text-gray-600 border-gray-200",
  dm_returned: "bg-orange-50 text-orange-700 border-orange-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  approved: "bg-green-50 text-green-700 border-green-200",
  changes_requested: "bg-red-50 text-red-700 border-red-200",
  not_required: "bg-gray-50 text-gray-500 border-gray-200",
};
const LAYER_TONE: Record<string, string> = {
  "Meta Data": "bg-purple-50 text-purple-700",
  Safety: "bg-orange-50 text-orange-700",
  Survivability: "bg-green-50 text-green-700",
  Boundary: "bg-blue-50 text-blue-700",
};
const LAYER_COLOR: Record<string, string> = {
  "Meta Data": "#9333ea",
  Safety: "#f97316",
  Survivability: "#16a34a",
  Boundary: "#3b82f6",
};

function barangayOptions(options: FilterOptions | null) {
  return [
    { value: "all", label: "All barangays" },
    ...(options?.barangays ?? []).map((b) => ({ value: String(b.id), label: b.name })),
  ];
}

function areaOptions(options: FilterOptions | null, barangay: string) {
  const areas = (options?.areas ?? []).filter((a) => barangay === "all" || String(a.barangay_id) === barangay);
  return [{ value: "all", label: "All areas" }, ...areas.map((a) => ({ value: String(a.id), label: a.name }))];
}

function optionLabel(options: { value: string; label: string }[], value: string) {
  return options.find((o) => o.value === value)?.label ?? value;
}

function dateLabel(from: string, to: string) {
  const preset = DATE_PRESETS.find((p) => {
    const [f, t] = p.range();
    return f === from && t === to;
  });
  if (preset && preset.key !== "all") return `${preset.label} (${fmtDate(from)} – ${fmtDate(to)})`;
  if (!from && !to) return "";
  return `${from ? fmtDate(from) : "Start"} – ${to ? fmtDate(to) : "Present"}`;
}

function describeFilters(entries: [string, string, { value: string; label: string }[] | null][]) {
  return entries
    .filter(([, v]) => v && v !== "all")
    .map(([label, v, opts]) => [label, opts ? optionLabel(opts, v) : v] as [string, string]);
}

function runExport<T>(kind: "pdf" | "excel", spec: ExportSpec<T>) {
  if (kind === "pdf") exportPdf(spec);
  else exportCsv(spec);
}

function useRefresh(refreshKey: number, reload: () => void) {
  useEffect(() => {
    if (refreshKey) reload();
  }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps
}

function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card className="p-10 text-center">
      <p className="text-sm text-gray-500 mb-3">{message}</p>
      <button onClick={onRetry} className="px-4 py-2 rounded-lg bg-[#0F4A2F] text-white text-sm font-semibold hover:bg-[#1a6b44]">
        Retry
      </button>
    </Card>
  );
}

function Donut({ data }: { data: Breakdown[] }) {
  const visible = data.filter((d) => d.value > 0);
  if (visible.length === 0) return <EmptyState text="No data" />;
  return (
    <>
      <ResponsiveContainer width="100%" height={160}>
        <PieChart>
          <Pie data={visible} dataKey="value" nameKey="name" outerRadius={66} innerRadius={38} paddingAngle={2}>
            {visible.map((d, i) => (
              <Cell key={i} fill={d.fill} />
            ))}
          </Pie>
          <Tooltip content={<GreenTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-col gap-1.5 mt-2">
        {data.map((d) => (
          <div key={d.key} className="flex items-center gap-2 text-[12px]">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.fill }} />
            <span className="text-gray-600">{d.name}</span>
            <span className="ml-auto font-bold text-gray-800">{d.value}</span>
          </div>
        ))}
      </div>
    </>
  );
}

// ─── TAB: SITE REGISTRY ─────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "under_review", label: "Under Review" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
];
const VERIFICATION_OPTIONS = [
  { value: "all", label: "All" },
  { value: "none", label: "Not started" },
  { value: "draft", label: "Draft" },
  { value: "pending", label: "Pending review" },
  { value: "verified", label: "Verified" },
  { value: "rejected", label: "Rejected" },
];
const MONITORING_OPTIONS = [
  { value: "all", label: "All" },
  { value: "available", label: "Available" },
  { value: "reserved", label: "Reserved" },
  { value: "under_monitoring", label: "Under Monitoring" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
  { value: "onhold", label: "On Hold" },
];
const ISSUE_OPTIONS = [
  { value: "all", label: "All sites" },
  { value: "any", label: "Any map data issue" },
  { value: "boundary", label: "Missing boundary / 0 ha" },
  { value: "oversized", label: "Planted polygon > site" },
  { value: "no_class", label: "No land classification" },
];
const SITE_DEFAULTS = {
  search: "",
  status: "all",
  verification: "all",
  monitoring_status: "all",
  barangay: "all",
  area: "all",
  issue: "all",
  date_from: "",
  date_to: "",
};

function SitesTab({
  options,
  onSiteHistory,
  refreshKey,
}: {
  options: FilterOptions | null;
  onSiteHistory: (id: number) => void;
  refreshKey: number;
}) {
  const [f, setF] = useState(SITE_DEFAULTS);
  const { data, loading, error, reload } = useReport<SitesReport>("gis_report/sites/", f);
  useRefresh(refreshKey, reload);
  const paged = usePaged(data?.rows ?? []);
  const brgyOpts = barangayOptions(options);
  const areaOpts = areaOptions(options, f.barangay);
  const isFiltered = JSON.stringify(f) !== JSON.stringify(SITE_DEFAULTS);

  const handleExport = (kind: "pdf" | "excel") => {
    if (!data) return;
    const s = data.summary;
    const range = dateLabel(f.date_from, f.date_to);
    runExport<SiteRow>(kind, {
      title: "Site Registry Report",
      filename: "gis_site_registry",
      filters: [
        ...describeFilters([
          ["Approval status", f.status, STATUS_OPTIONS],
          ["Verification", f.verification, VERIFICATION_OPTIONS],
          ["Monitoring", f.monitoring_status, MONITORING_OPTIONS],
          ["Barangay", f.barangay, brgyOpts],
          ["Reforestation area", f.area, areaOpts],
          ["Map data", f.issue, ISSUE_OPTIONS],
          ["Search", f.search, null],
        ]),
        ...(range ? [["Date created", range] as [string, string]] : []),
      ],
      summary: [
        ["Sites", fmt(s.total)],
        ["Mapped area", fmtHa(s.hectares)],
        ["Official sites", fmt(s.official)],
        ["Official area", fmtHa(s.official_hectares)],
        ["Planted area (latest polygons)", fmtHa(s.planted_hectares)],
        ["Pending approval", fmt(s.pending)],
        ["Verification pending", fmt(s.verification_pending)],
        ["Not yet verified", fmt(s.not_verified)],
        ["Sites with map data issues", fmt(s.with_issues)],
        ["Reforestation areas", fmt(s.areas)],
      ],
      sections: [
        {
          title: "Sites by barangay",
          columns: ["Barangay", "Sites", "Official", "Mapped area", "Planted area"],
          rows: data.by_barangay.map((b) => [b.name, b.sites, b.official, fmtHa(b.hectares), fmtHa(b.planted_hectares)]),
        },
      ],
      recordsTitle: "Sites",
      columns: [
        { header: "Site", value: (r) => r.name },
        { header: "Reforestation area", value: (r) => r.reforestation_area },
        { header: "Barangay", value: (r) => r.barangay },
        { header: "Approval", value: (r) => r.status_label },
        { header: "Verification", value: (r) => r.verification_label },
        { header: "Verified by", value: (r) => (r.verified_by ? `${r.verified_by} (${fmtDate(r.verified_at)})` : null) },
        { header: "Monitoring", value: (r) => r.monitoring_label },
        { header: "Land class", value: (r) => r.land_classification },
        { header: "Site area", value: (r) => fmtHa(r.site_hectares) },
        { header: "Planted area", value: (r) => (r.planted_hectares ? fmtHa(r.planted_hectares) : null) },
        { header: "Assessments", value: (r) => r.assessments },
        { header: "Programs", value: (r) => r.programs },
        { header: "Created", value: (r) => fmtDate(r.created_at) },
        { header: "Issues", value: (r) => r.issues.join("; ") },
      ],
      rows: data.rows,
    });
  };

  const s = data?.summary;

  return (
    <div className="space-y-5">
      <FilterBar onReset={() => setF(SITE_DEFAULTS)} showReset={isFiltered}>
        <SearchFilter value={f.search} onChange={(v) => setF({ ...f, search: v })} placeholder="Site or reforestation area…" />
        <SelectFilter label="Approval" value={f.status} onChange={(v) => setF({ ...f, status: v })} options={STATUS_OPTIONS} />
        <SelectFilter label="Verification" value={f.verification} onChange={(v) => setF({ ...f, verification: v })} options={VERIFICATION_OPTIONS} />
        <SelectFilter label="Monitoring" value={f.monitoring_status} onChange={(v) => setF({ ...f, monitoring_status: v })} options={MONITORING_OPTIONS} />
        <SelectFilter label="Barangay" value={f.barangay} onChange={(v) => setF({ ...f, barangay: v, area: "all" })} options={brgyOpts} />
        <SelectFilter label="Reforestation area" value={f.area} onChange={(v) => setF({ ...f, area: v })} options={areaOpts} />
        <SelectFilter label="Map data" value={f.issue} onChange={(v) => setF({ ...f, issue: v })} options={ISSUE_OPTIONS} />
        <DateRangeFilter label="Date created" from={f.date_from} to={f.date_to} onChange={(a, b) => setF({ ...f, date_from: a, date_to: b })} />
      </FilterBar>

      {error && !data ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : !data || !s ? (
        <LoadingBlock text="Building site registry…" />
      ) : (
        <div className={`space-y-5 transition-opacity ${loading ? "opacity-60" : ""}`}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Kpi icon={<MapPin size={16} />} label="Sites" value={fmt(s.total)} sub={`${fmtHa(s.hectares)} mapped · ${s.areas} areas`} />
            <Kpi icon={<TreePine size={16} />} label="Official Sites" value={fmt(s.official)} sub={`${fmtHa(s.official_hectares)} verified`} accent="bg-green-600" />
            <Kpi
              icon={<FileSearch size={16} />}
              label="Awaiting Approval / Verification"
              value={`${s.pending} / ${s.verification_pending}`}
              sub={`${s.not_verified} not yet verified`}
              accent="bg-amber-500"
            />
            <Kpi
              icon={<ShieldAlert size={16} />}
              label="Map Data Issues"
              value={fmt(s.with_issues)}
              valueColor={s.with_issues > 0 ? "#ef4444" : undefined}
              sub={`Planted area ${fmtHa(s.planted_hectares)}`}
              accent={s.with_issues > 0 ? "bg-red-500" : "bg-green-500"}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <Card className="p-5 lg:col-span-2">
              <SectionTitle icon={<BarChart3 size={16} />} title="Sites Created vs Verified" sub="Per month for the filtered sites" />
              {data.monthly.some((m) => m.created || m.verified) ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={data.monthly} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" vertical={false} />
                    <XAxis dataKey="month" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                    <Tooltip content={<GreenTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="created" name="Created" fill="#a7f3d0" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="verified" name="Verified" fill="#059669" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState text="No sites created or verified in this period" />
              )}
            </Card>
            <Card className="p-5">
              <SectionTitle icon={<Layers size={16} />} title="Approval Status" sub={`${s.total} sites`} />
              <Donut data={data.status_breakdown} />
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <Card className="p-5 lg:col-span-2">
              <SectionTitle icon={<MapPin size={16} />} title="Area by Barangay" sub="Mapped site area vs planted area" />
              {data.by_barangay.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <ComposedChart data={data.by_barangay}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" vertical={false} />
                    <XAxis dataKey="name" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="ha" tick={AXIS_TICK} axisLine={false} tickLine={false} unit=" ha" />
                    <YAxis yAxisId="n" orientation="right" allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                    <Tooltip content={<GreenTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar yAxisId="ha" dataKey="hectares" name="Mapped (ha)" fill="#a7f3d0" radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="ha" dataKey="planted_hectares" name="Planted (ha)" fill="#059669" radius={[4, 4, 0, 0]} />
                    <Line yAxisId="n" dataKey="sites" name="Sites" stroke="#6366f1" strokeWidth={2.5} />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState text="No sites match the filters" />
              )}
            </Card>
            <Card className="p-5">
              <SectionTitle icon={<FileSearch size={16} />} title="Site Data Verification" sub="Review status of site data" />
              <Donut data={data.verification_breakdown} />
            </Card>
          </div>

          <Card>
            <div className="px-5 pt-5">
              <SectionTitle
                icon={<FileText size={16} />}
                title="Site Records"
                sub="Every active site — open History for its full timeline of verification, assessments, programs and reviews"
                right={
                  <ExportButtons
                    onPdf={() => handleExport("pdf")}
                    onExcel={() => handleExport("excel")}
                    disabled={data.rows.length === 0}
                    count={data.rows.length}
                  />
                }
              />
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <Th>Site</Th>
                    <Th>Approval</Th>
                    <Th>Verification</Th>
                    <Th>Monitoring</Th>
                    <Th right>Site Area</Th>
                    <Th right>Planted</Th>
                    <Th right>Assessments</Th>
                    <Th>Current Program</Th>
                    <Th>Created</Th>
                    <Th>History</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paged.pageRows.length > 0 ? (
                    paged.pageRows.map((r) => (
                      <tr key={r.site_id} className="hover:bg-gray-50/70 align-top">
                        <Td>
                          <p className="font-semibold text-gray-800">{r.name}</p>
                          <p className="text-[11px] text-gray-400">
                            {r.barangay ?? "—"} · {r.reforestation_area ?? "—"}
                          </p>
                          {r.land_classification && <p className="text-[10.5px] text-purple-600">{r.land_classification}</p>}
                          {r.issues.map((i) => (
                            <p key={i} className="text-[10.5px] text-red-500 flex items-center gap-1 mt-0.5">
                              <AlertTriangle size={10} /> {i}
                            </p>
                          ))}
                        </Td>
                        <Td>
                          <Badge label={r.status_label} tone={SITE_TONE[r.status] ?? SITE_TONE.pending} />
                        </Td>
                        <Td>
                          <Badge label={r.verification_label} tone={VERIFICATION_TONE[r.verification] ?? VERIFICATION_TONE.none} />
                          {r.verified_by && (
                            <p className="text-[10.5px] text-gray-400 mt-1">
                              {r.verified_by} · {fmtDate(r.verified_at)}
                            </p>
                          )}
                        </Td>
                        <Td>{r.monitoring_label ?? <span className="text-[11px] text-gray-400">Not official</span>}</Td>
                        <Td right>{fmtHa(r.site_hectares)}</Td>
                        <Td right>
                          {r.planted_hectares ? (
                            <>
                              <p>{fmtHa(r.planted_hectares)}</p>
                              {r.planted_pct !== null && (
                                <p className={`text-[10.5px] ${r.planted_pct > 100 ? "text-red-500 font-semibold" : "text-gray-400"}`}>
                                  {r.planted_pct}% of site
                                </p>
                              )}
                            </>
                          ) : (
                            "—"
                          )}
                        </Td>
                        <Td right>
                          <p>{r.assessments}</p>
                          {r.last_assessment && <p className="text-[10.5px] text-gray-400">{fmtDate(r.last_assessment)}</p>}
                        </Td>
                        <Td>
                          {r.current_program ? (
                            <>
                              <p className="max-w-[170px] truncate">{r.current_program}</p>
                              <p className="text-[11px] text-gray-400">{r.current_group}</p>
                            </>
                          ) : (
                            <span className="text-[11px] text-gray-400">{r.programs > 0 ? `${r.programs} past` : "None"}</span>
                          )}
                        </Td>
                        <Td className="whitespace-nowrap">{fmtDate(r.created_at)}</Td>
                        <Td>
                          <button
                            onClick={() => onSiteHistory(r.site_id)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-emerald-200 text-emerald-700 text-[11px] font-semibold hover:bg-emerald-50"
                          >
                            <History size={12} /> History
                          </button>
                        </Td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={10}>
                        <EmptyState text="No sites match the filters" />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination {...paged} />
          </Card>
        </div>
      )}
    </div>
  );
}

// ─── TAB: PLANTED AREA REVIEWS ──────────────────────────────────────────────

const STAGE_OPTIONS = [
  { value: "all", label: "All stages" },
  { value: "awaiting_dm", label: "With Data Manager" },
  { value: "dm_returned", label: "Returned by Data Manager" },
  { value: "pending", label: "Waiting for GIS" },
  { value: "approved", label: "Confirmed" },
  { value: "changes_requested", label: "Changes requested" },
];
const OVERSIZED_OPTIONS = [
  { value: "all", label: "All polygons" },
  { value: "1", label: "Larger than site only" },
];
const REVIEW_DEFAULTS = { search: "", stage: "all", barangay: "all", oversized: "all", date_from: "", date_to: "" };

function ReviewsTab({
  options,
  onSiteHistory,
  refreshKey,
}: {
  options: FilterOptions | null;
  onSiteHistory: (id: number) => void;
  refreshKey: number;
}) {
  const [f, setF] = useState(REVIEW_DEFAULTS);
  const { data, loading, error, reload } = useReport<ReviewsReport>("gis_report/planted_reviews/", f);
  useRefresh(refreshKey, reload);
  const paged = usePaged(data?.rows ?? []);
  const brgyOpts = barangayOptions(options);
  const isFiltered = JSON.stringify(f) !== JSON.stringify(REVIEW_DEFAULTS);

  const handleExport = (kind: "pdf" | "excel") => {
    if (!data) return;
    const s = data.summary;
    const range = dateLabel(f.date_from, f.date_to);
    runExport<ReviewRow>(kind, {
      title: "Planted Area Review History",
      filename: "gis_planted_area_reviews",
      filters: [
        ...describeFilters([
          ["Stage", f.stage, STAGE_OPTIONS],
          ["Barangay", f.barangay, brgyOpts],
          ["Polygons", f.oversized, OVERSIZED_OPTIONS],
          ["Search", f.search, null],
        ]),
        ...(range ? [["Submitted", range] as [string, string]] : []),
      ],
      summary: [
        ["Planted-area reports", fmt(s.total)],
        ["Waiting for GIS", fmt(s.pending)],
        ["Confirmed", fmt(s.approved)],
        ["Changes requested", fmt(s.changes_requested)],
        ["With / returned by Data Manager", `${s.awaiting_dm} / ${s.dm_returned}`],
        ["Polygons larger than site", fmt(s.oversized)],
        ["Avg. GIS turnaround", s.avg_turnaround_days !== null ? `${s.avg_turnaround_days} days` : "—"],
        ["Confirmed planted area", fmtHa(s.confirmed_hectares)],
        ["Sites", fmt(s.sites)],
      ],
      sections: [
        {
          title: "Reviews per GIS Specialist",
          columns: ["Reviewer", "Reviews", "Confirmed"],
          rows: data.by_reviewer.map((r) => [r.name, r.reviews, r.approved]),
        },
      ],
      recordsTitle: "Planted-area reports",
      columns: [
        { header: "Submitted", value: (r) => fmtDate(r.submitted) },
        { header: "Site", value: (r) => r.site_name },
        { header: "Barangay", value: (r) => r.barangay },
        { header: "Program", value: (r) => (r.program ? `${r.program} (${r.group_name ?? "—"})` : null) },
        { header: "Visit", value: (r) => r.visit_type },
        { header: "Inspector", value: (r) => r.inspector },
        { header: "Planted area", value: (r) => fmtHa(r.planted_hectares) },
        { header: "Site area", value: (r) => fmtHa(r.site_hectares) },
        { header: "% of site", value: (r) => (r.planted_pct !== null ? `${r.planted_pct}%` : null) },
        { header: "DM review", value: (r) => `${r.dm_review}${r.dm_reviewer ? ` · ${r.dm_reviewer}` : ""}` },
        { header: "GIS stage", value: (r) => r.stage_label },
        { header: "GIS reviewer", value: (r) => (r.gis_reviewer ? `${r.gis_reviewer} (${fmtDate(r.gis_reviewed_at)})` : null) },
        { header: "Turnaround (days)", value: (r) => r.turnaround_days },
        { header: "GIS notes", value: (r) => r.gis_notes },
      ],
      rows: data.rows,
    });
  };

  const s = data?.summary;

  return (
    <div className="space-y-5">
      <FilterBar onReset={() => setF(REVIEW_DEFAULTS)} showReset={isFiltered}>
        <SearchFilter value={f.search} onChange={(v) => setF({ ...f, search: v })} placeholder="Site, area or group…" />
        <SelectFilter label="Stage" value={f.stage} onChange={(v) => setF({ ...f, stage: v })} options={STAGE_OPTIONS} />
        <SelectFilter label="Barangay" value={f.barangay} onChange={(v) => setF({ ...f, barangay: v })} options={brgyOpts} />
        <SelectFilter label="Polygons" value={f.oversized} onChange={(v) => setF({ ...f, oversized: v })} options={OVERSIZED_OPTIONS} />
        <DateRangeFilter label="Submitted" from={f.date_from} to={f.date_to} onChange={(a, b) => setF({ ...f, date_from: a, date_to: b })} />
      </FilterBar>

      {error && !data ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : !data || !s ? (
        <LoadingBlock text="Building review history…" />
      ) : (
        <div className={`space-y-5 transition-opacity ${loading ? "opacity-60" : ""}`}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Kpi
              icon={<Clock size={16} />}
              label="Waiting for GIS"
              value={fmt(s.pending)}
              valueColor={s.pending > 0 ? "#d97706" : undefined}
              sub={s.oldest_waiting_days !== null ? `Oldest waiting ${s.oldest_waiting_days} days` : `${s.awaiting_dm} still with Data Manager`}
              accent="bg-amber-500"
            />
            <Kpi
              icon={<CheckCircle2 size={16} />}
              label="Confirmed"
              value={fmt(s.approved)}
              sub={`${fmtHa(s.confirmed_hectares)} confirmed planted area`}
              accent="bg-green-600"
            />
            <Kpi
              icon={<AlertTriangle size={16} />}
              label="Changes Requested"
              value={fmt(s.changes_requested)}
              sub={`${s.oversized} polygon(s) larger than their site`}
              accent="bg-red-500"
            />
            <Kpi
              icon={<MapPinned size={16} />}
              label="Avg. GIS Turnaround"
              value={s.avg_turnaround_days !== null ? `${s.avg_turnaround_days}d` : "—"}
              sub={`From Data Manager approval to GIS decision · ${s.total} reports`}
              accent="bg-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <Card className="p-5 lg:col-span-2">
              <SectionTitle icon={<BarChart3 size={16} />} title="Reports and GIS Decisions per Month" />
              {data.monthly.some((m) => m.submitted || m.approved || m.changes_requested) ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={data.monthly} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" vertical={false} />
                    <XAxis dataKey="month" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                    <Tooltip content={<GreenTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="submitted" name="Submitted" fill="#c7d2fe" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="approved" name="Confirmed" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="changes_requested" name="Changes requested" fill="#f87171" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState text="No planted-area reports in this period" />
              )}
            </Card>
            <Card className="p-5">
              <SectionTitle icon={<Layers size={16} />} title="Review Stage" sub={`${s.total} reports`} />
              <Donut data={data.stage_breakdown} />
            </Card>
          </div>

          <Card>
            <div className="px-5 pt-5">
              <SectionTitle
                icon={<FileText size={16} />}
                title="Review History"
                sub="Every planted-area polygon submitted from the field and who reviewed it"
                right={
                  <ExportButtons
                    onPdf={() => handleExport("pdf")}
                    onExcel={() => handleExport("excel")}
                    disabled={data.rows.length === 0}
                    count={data.rows.length}
                  />
                }
              />
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <Th>Submitted</Th>
                    <Th>Site</Th>
                    <Th>Program / Visit</Th>
                    <Th right>Planted</Th>
                    <Th>Data Manager</Th>
                    <Th>GIS Review</Th>
                    <Th right>Turnaround</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paged.pageRows.length > 0 ? (
                    paged.pageRows.map((r) => (
                      <tr key={r.id} className="hover:bg-gray-50/70 align-top">
                        <Td className="whitespace-nowrap">
                          <p>{fmtDate(r.submitted)}</p>
                          <p className="text-[10.5px] text-gray-400">{r.inspector ?? "—"}</p>
                        </Td>
                        <Td>
                          {r.site_id ? (
                            <button onClick={() => onSiteHistory(r.site_id!)} className="text-left hover:underline">
                              <p className="font-semibold text-gray-800">{r.site_name}</p>
                              <p className="text-[11px] text-gray-400">{r.barangay ?? "—"}</p>
                            </button>
                          ) : (
                            "—"
                          )}
                        </Td>
                        <Td>
                          <p>{r.program ?? "—"}</p>
                          <p className="text-[11px] text-gray-400">{r.visit_type}</p>
                        </Td>
                        <Td right>
                          <p className={r.oversized ? "text-red-500 font-semibold" : ""}>{fmtHa(r.planted_hectares)}</p>
                          <p className="text-[10.5px] text-gray-400">
                            of {fmtHa(r.site_hectares)}
                            {r.planted_pct !== null ? ` · ${r.planted_pct}%` : ""}
                          </p>
                        </Td>
                        <Td>
                          <p className="text-[12px]">{r.dm_review}</p>
                          {r.dm_reviewer && (
                            <p className="text-[10.5px] text-gray-400">
                              {r.dm_reviewer} · {fmtDate(r.dm_reviewed_at)}
                            </p>
                          )}
                        </Td>
                        <Td>
                          <Badge label={r.stage_label} tone={STAGE_TONE[r.stage] ?? STAGE_TONE.pending} />
                          {r.gis_reviewer && (
                            <p className="text-[10.5px] text-gray-400 mt-1">
                              {r.gis_reviewer} · {fmtDate(r.gis_reviewed_at)}
                            </p>
                          )}
                          {r.gis_notes && <p className="text-[11px] text-gray-500 mt-0.5 max-w-[220px]">“{r.gis_notes}”</p>}
                          {r.waiting_days !== null && (
                            <p className="text-[10.5px] text-amber-600 mt-0.5">Waiting {r.waiting_days} days</p>
                          )}
                        </Td>
                        <Td right>{r.turnaround_days !== null ? `${r.turnaround_days}d` : "—"}</Td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7}>
                        <EmptyState text="No planted-area reports match the filters" />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination {...paged} />
          </Card>
        </div>
      )}
    </div>
  );
}

// ─── ONSITE INSPECTOR TRACKING (inside Field Assessments) ───────────────────

const ACTIVITY_STYLE: Record<InspectorRow["activity"], { label: string; tone: string }> = {
  active: { label: "Active", tone: "bg-green-50 text-green-700 border-green-200" },
  idle: { label: "Idle", tone: "bg-amber-50 text-amber-700 border-amber-200" },
  inactive: { label: "Inactive", tone: "bg-gray-100 text-gray-600 border-gray-200" },
};
const ACTIVITY_OPTIONS = [
  { value: "all", label: "All inspectors" },
  { value: "active", label: "Active" },
  { value: "idle", label: "Idle" },
  { value: "inactive", label: "Inactive" },
  { value: "unassigned", label: "No assigned area" },
];

function inspectorFlags(r: InspectorRow) {
  const flags: string[] = [];
  if (!r.is_active) flags.push("Account disabled");
  if (r.areas.length === 0) flags.push("No assigned area");
  if (r.handovers_waiting > 0) flags.push(`${r.handovers_waiting} seedling handover(s) to confirm`);
  if (r.visits_rejected > 0 && r.acceptance_rate !== null && r.acceptance_rate < 50)
    flags.push("Most visits sent back for changes");
  if (r.without_gps > 0) flags.push(`${r.without_gps} assessment(s) without GPS`);
  return flags;
}

function InspectorTrackingSection({
  tracking,
  filtersLabel,
}: {
  tracking: InspectorTracking;
  filtersLabel: [string, string][];
}) {
  const [activity, setActivity] = useState("all");
  const t = tracking.summary;
  const rows = tracking.rows.filter((r) =>
    activity === "all" ? true : activity === "unassigned" ? r.areas.length === 0 : r.activity === activity,
  );
  const chartData = tracking.rows
    .filter((r) => r.assessments + r.visits > 0)
    .map((r) => ({
      name: r.name.split(" ")[0],
      General: r.general,
      "Site-specific": r.specific,
      "Visits accepted": r.visits_accepted,
      "Visits returned": r.visits_rejected,
    }));

  const handleExport = (kind: "pdf" | "excel") => {
    runExport<InspectorRow>(kind, {
      title: "Onsite Inspector Activity Report",
      filename: "gis_onsite_inspectors",
      filters: [
        ...filtersLabel,
        ...(activity !== "all" ? [["Inspector status", optionLabel(ACTIVITY_OPTIONS, activity)] as [string, string]] : []),
      ],
      summary: [
        ["Onsite inspectors", fmt(t.total)],
        [`Active (≤ ${t.active_days} days)`, fmt(t.active)],
        ["Idle", fmt(t.idle)],
        [`Inactive (> ${t.inactive_days} days)`, fmt(t.inactive)],
        ["No assigned area", fmt(t.unassigned)],
        ["Monitoring visits", fmt(t.visits)],
        ["Visits sent back", fmt(t.visits_rejected)],
        ["Seedling handovers to confirm", fmt(t.handovers_waiting)],
      ],
      recordsTitle: "Inspectors",
      columns: [
        { header: "Inspector", value: (r) => r.name },
        { header: "Email", value: (r) => r.email },
        { header: "Status", value: (r) => `${ACTIVITY_STYLE[r.activity].label}${r.is_active ? "" : " (disabled)"}` },
        { header: "Assigned areas", value: (r) => r.areas.join(", ") },
        { header: "Assessments (gen/site)", value: (r) => `${r.assessments} (${r.general}/${r.specific})` },
        { header: "Photos", value: (r) => r.photos },
        { header: "Visits (acc/pend/ret)", value: (r) => `${r.visits} (${r.visits_accepted}/${r.visits_pending}/${r.visits_rejected})` },
        { header: "Acceptance", value: (r) => (r.acceptance_rate !== null ? `${r.acceptance_rate}%` : null) },
        { header: "Handovers (wait/done)", value: (r) => `${r.handovers_waiting}/${r.handovers_confirmed}` },
        { header: "Sites covered", value: (r) => r.sites_covered },
        { header: "Last active", value: (r) => fmtDate(r.last_active) },
        { header: "Flags", value: (r) => inspectorFlags(r).join("; ") },
      ],
      rows,
    });
  };

  return (
    <Card>
      <div className="px-5 pt-5">
        <SectionTitle
          icon={<Users size={16} />}
          title="Onsite Inspector Tracking"
          sub={`Assigned areas, field assessments, monitoring visits and seedling handovers per inspector · active = field work in the last ${t.active_days} days`}
          right={
            <ExportButtons
              onPdf={() => handleExport("pdf")}
              onExcel={() => handleExport("excel")}
              disabled={rows.length === 0}
              count={rows.length}
            />
          }
        />
      </div>

      <div className="px-5 grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: "Inspectors", value: t.total, sub: `${t.unassigned} without an area`, tone: "text-gray-800" },
          { label: "Active", value: t.active, sub: `Last ${t.active_days} days`, tone: "text-emerald-600" },
          { label: "Idle / Inactive", value: `${t.idle} / ${t.inactive}`, sub: `No field work > ${t.active_days} days`, tone: t.inactive > 0 ? "text-amber-600" : "text-gray-800" },
          { label: "Visits sent back", value: t.visits_rejected, sub: `of ${t.visits} visits submitted`, tone: t.visits_rejected > 0 ? "text-red-500" : "text-gray-800" },
          { label: "Handovers to confirm", value: t.handovers_waiting, sub: "Seedlings waiting for inspector", tone: t.handovers_waiting > 0 ? "text-amber-600" : "text-gray-800" },
        ].map((k) => (
          <div key={k.label} className="bg-gray-50 rounded-xl p-3">
            <p className="text-[10.5px] text-gray-400 font-semibold uppercase tracking-wider">{k.label}</p>
            <p className={`text-[22px] font-bold leading-tight ${k.tone}`}>{k.value}</p>
            <p className="text-[10.5px] text-gray-400">{k.sub}</p>
          </div>
        ))}
      </div>

      {chartData.length > 0 && (
        <div className="px-5 pt-5">
          <p className="text-[12px] font-semibold text-gray-700 mb-2">Workload per inspector</p>
          <ResponsiveContainer width="100%" height={Math.max(160, chartData.length * 46)}>
            <BarChart data={chartData} layout="vertical" barSize={12} barGap={3}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <Tooltip content={<GreenTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="General" stackId="fa" fill="#93c5fd" />
              <Bar dataKey="Site-specific" stackId="fa" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              <Bar dataKey="Visits accepted" stackId="v" fill="#10b981" />
              <Bar dataKey="Visits returned" stackId="v" fill="#f87171" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="px-5 pt-4 pb-2 flex items-center justify-between gap-3">
        <p className="text-[12px] font-semibold text-gray-700">Inspector details</p>
        <select
          value={activity}
          onChange={(e) => setActivity(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs bg-white focus:border-[#0F4A2F] focus:outline-none"
        >
          {ACTIVITY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <Th>Inspector</Th>
              <Th>Assigned Areas</Th>
              <Th>Status</Th>
              <Th right>Assessments</Th>
              <Th>Monitoring Visits</Th>
              <Th right>Handovers</Th>
              <Th right>Sites</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length > 0 ? (
              rows.map((r) => {
                const flags = inspectorFlags(r);
                const act = ACTIVITY_STYLE[r.activity];
                return (
                  <tr key={r.id} className="hover:bg-gray-50/70 align-top">
                    <Td>
                      <div className="flex items-start gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-[#0F4A2F] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                          {r.name
                            .split(" ")
                            .map((w) => w[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-800">{r.name}</p>
                          <p className="text-[11px] text-gray-400 truncate max-w-[180px]">{r.email}</p>
                          {flags.map((f) => (
                            <p key={f} className="text-[10.5px] text-amber-700 flex items-center gap-1 mt-0.5">
                              <AlertTriangle size={10} /> {f}
                            </p>
                          ))}
                        </div>
                      </div>
                    </Td>
                    <Td>
                      {r.areas.length > 0 ? (
                        <>
                          <div className="flex flex-wrap gap-1 max-w-[220px]">
                            {r.areas.map((a) => (
                              <span key={a} className="text-[10.5px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
                                {a}
                              </span>
                            ))}
                          </div>
                          {r.assigned_since && <p className="text-[10.5px] text-gray-400 mt-1">Since {fmtDate(r.assigned_since)}</p>}
                        </>
                      ) : (
                        <span className="text-[11px] text-gray-400">None</span>
                      )}
                    </Td>
                    <Td>
                      <Badge label={act.label} tone={act.tone} />
                      <p className="text-[10.5px] text-gray-400 mt-1 whitespace-nowrap">
                        {r.last_active ? `Last active ${fmtDate(r.last_active)}` : "No field work yet"}
                      </p>
                    </Td>
                    <Td right>
                      <p className="font-semibold">{r.assessments}</p>
                      <p className="text-[10.5px] text-gray-400 whitespace-nowrap">
                        {r.general} gen · {r.specific} site
                      </p>
                      {r.assessments > 0 && (
                        <p className="text-[10.5px] text-gray-400 whitespace-nowrap">
                          {r.photos} photos · {r.avg_layers} layers avg
                        </p>
                      )}
                    </Td>
                    <Td>
                      {r.visits > 0 ? (
                        <>
                          <div className="flex h-1.5 w-28 rounded-full overflow-hidden bg-gray-100">
                            <div className="bg-emerald-500" style={{ width: `${(r.visits_accepted / r.visits) * 100}%` }} />
                            <div className="bg-amber-400" style={{ width: `${(r.visits_pending / r.visits) * 100}%` }} />
                            <div className="bg-red-400" style={{ width: `${(r.visits_rejected / r.visits) * 100}%` }} />
                          </div>
                          <p className="text-[10.5px] text-gray-500 mt-1 whitespace-nowrap">
                            {r.visits_accepted} accepted · {r.visits_pending} pending · {r.visits_rejected} returned
                          </p>
                          {r.acceptance_rate !== null && (
                            <p className="text-[10.5px] text-gray-400">{r.acceptance_rate}% accepted</p>
                          )}
                        </>
                      ) : (
                        <span className="text-[11px] text-gray-400">No visits</span>
                      )}
                    </Td>
                    <Td right>
                      <p className={r.handovers_waiting > 0 ? "text-amber-600 font-semibold" : ""}>{r.handovers_waiting} waiting</p>
                      <p className="text-[10.5px] text-gray-400">{r.handovers_confirmed} confirmed</p>
                    </Td>
                    <Td right>{r.sites_covered}</Td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={7}>
                  <EmptyState text="No inspectors match this status" />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="px-5 py-3 text-[10.5px] text-gray-400 border-t border-gray-100">
        Assessment and visit counts follow the filters above. Status and last active are all-time. Handovers are seedling
        requests assigned to the inspector.
      </p>
    </Card>
  );
}

// ─── TAB: FIELD ASSESSMENTS ─────────────────────────────────────────────────

const TYPE_OPTIONS = [
  { value: "all", label: "All types" },
  { value: "general", label: "General (area)" },
  { value: "specific", label: "Specific (site)" },
];
const LAYER_OPTIONS = [
  { value: "all", label: "All layers" },
  { value: "meta", label: "Meta data" },
  { value: "safety", label: "Safety" },
  { value: "survivability", label: "Survivability" },
  { value: "boundary", label: "Boundary" },
];
const RISK_OPTIONS = [
  { value: "all", label: "All" },
  { value: "any", label: "Any security concern" },
  { value: "high", label: "High risk only" },
];
const ASSESSMENT_DEFAULTS = {
  search: "",
  type: "all",
  layer: "all",
  risk: "all",
  barangay: "all",
  area: "all",
  date_from: "",
  date_to: "",
};

function AssessmentsTab({
  options,
  onSiteHistory,
  refreshKey,
}: {
  options: FilterOptions | null;
  onSiteHistory: (id: number) => void;
  refreshKey: number;
}) {
  const [f, setF] = useState(ASSESSMENT_DEFAULTS);
  const { data, loading, error, reload } = useReport<AssessmentsReport>("gis_report/assessments/", f);
  useRefresh(refreshKey, reload);
  const paged = usePaged(data?.rows ?? []);
  const brgyOpts = barangayOptions(options);
  const areaOpts = areaOptions(options, f.barangay);
  const isFiltered = JSON.stringify(f) !== JSON.stringify(ASSESSMENT_DEFAULTS);

  const handleExport = (kind: "pdf" | "excel") => {
    if (!data) return;
    const s = data.summary;
    const range = dateLabel(f.date_from, f.date_to);
    runExport<AssessmentRow>(kind, {
      title: "Field Assessments Report",
      filename: "gis_field_assessments",
      filters: [
        ...describeFilters([
          ["Type", f.type, TYPE_OPTIONS],
          ["Layer", f.layer, LAYER_OPTIONS],
          ["Security", f.risk, RISK_OPTIONS],
          ["Barangay", f.barangay, brgyOpts],
          ["Reforestation area", f.area, areaOpts],
          ["Search", f.search, null],
        ]),
        ...(range ? [["Submitted", range] as [string, string]] : []),
      ],
      summary: [
        ["Assessments", fmt(s.total)],
        ["General / specific", `${s.general} / ${s.specific}`],
        ["Evidence photos", fmt(s.photos)],
        ["Sites assessed", fmt(s.sites)],
        ["With security concerns", fmt(s.with_concerns)],
        ["High risk", fmt(s.high_risk)],
        ["Without GPS location", fmt(s.without_location)],
        ["Inspectors", fmt(s.inspectors)],
      ],
      sections: [
        { title: "Assessments by layer", columns: ["Layer", "Assessments"], rows: data.layers.map((l) => [l.name, l.value]) },
        { title: "Evidence photos by type", columns: ["Type", "Photos"], rows: data.photos_by_layer.map((p) => [p.name, p.value]) },
        {
          title: "Assessments per inspector",
          columns: ["Inspector", "Assessments", "Photos"],
          rows: data.by_inspector.map((i) => [i.name, i.assessments, i.photos]),
        },
      ],
      recordsTitle: "Assessments",
      columns: [
        { header: "Submitted", value: (r) => fmtDate(r.submitted) },
        { header: "Assessment", value: (r) => r.title },
        { header: "Type", value: (r) => r.type },
        { header: "Inspector", value: (r) => r.inspector },
        { header: "Reforestation area", value: (r) => r.reforestation_area },
        { header: "Barangay", value: (r) => r.barangay },
        { header: "Site", value: (r) => r.site_name },
        { header: "Layers", value: (r) => r.layers.join(", ") },
        { header: "Photos", value: (r) => r.photos },
        { header: "Land class", value: (r) => r.land_classification },
        { header: "Security concerns", value: (r) => r.security_concerns.join(", ") },
        { header: "GPS", value: (r) => (r.has_location ? "Yes" : "No") },
      ],
      rows: data.rows,
    });
  };

  const s = data?.summary;

  return (
    <div className="space-y-5">
      <FilterBar onReset={() => setF(ASSESSMENT_DEFAULTS)} showReset={isFiltered}>
        <SearchFilter value={f.search} onChange={(v) => setF({ ...f, search: v })} placeholder="Title, site, area or inspector…" />
        <SelectFilter label="Type" value={f.type} onChange={(v) => setF({ ...f, type: v })} options={TYPE_OPTIONS} />
        <SelectFilter label="Layer" value={f.layer} onChange={(v) => setF({ ...f, layer: v })} options={LAYER_OPTIONS} />
        <SelectFilter label="Security" value={f.risk} onChange={(v) => setF({ ...f, risk: v })} options={RISK_OPTIONS} />
        <SelectFilter label="Barangay" value={f.barangay} onChange={(v) => setF({ ...f, barangay: v, area: "all" })} options={brgyOpts} />
        <SelectFilter label="Reforestation area" value={f.area} onChange={(v) => setF({ ...f, area: v })} options={areaOpts} />
        <DateRangeFilter label="Submitted" from={f.date_from} to={f.date_to} onChange={(a, b) => setF({ ...f, date_from: a, date_to: b })} />
      </FilterBar>

      {error && !data ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : !data || !s ? (
        <LoadingBlock text="Building assessments report…" />
      ) : (
        <div className={`space-y-5 transition-opacity ${loading ? "opacity-60" : ""}`}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Kpi icon={<ClipboardList size={16} />} label="Assessments" value={fmt(s.total)} sub={`${s.general} general · ${s.specific} site-specific`} />
            <Kpi icon={<Camera size={16} />} label="Evidence Photos" value={fmt(s.photos)} sub={`${s.sites} sites assessed`} accent="bg-teal-500" />
            <Kpi
              icon={<ShieldAlert size={16} />}
              label="Security Concerns"
              value={fmt(s.with_concerns)}
              valueColor={s.high_risk > 0 ? "#ef4444" : undefined}
              sub={`${s.high_risk} high risk`}
              accent="bg-red-500"
            />
            <Kpi
              icon={<Users size={16} />}
              label="Inspectors"
              value={fmt(s.inspectors)}
              sub={s.without_location > 0 ? `${s.without_location} assessment(s) without GPS` : "All assessments have GPS"}
              accent="bg-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <Card className="p-5 lg:col-span-2">
              <SectionTitle icon={<BarChart3 size={16} />} title="Assessments per Month" sub="General (area) vs site-specific" />
              {data.monthly.some((m) => m.general || m.specific) ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={data.monthly} barSize={20}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" vertical={false} />
                    <XAxis dataKey="month" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                    <Tooltip content={<GreenTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="general" name="General" stackId="a" fill="#93c5fd" />
                    <Bar dataKey="specific" name="Site-specific" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState text="No assessments in this period" />
              )}
            </Card>
            <Card className="p-5">
              <SectionTitle icon={<Layers size={16} />} title="Layers Covered" sub="Assessments that include each layer" />
              <ResponsiveContainer width="100%" height={170}>
                <BarChart data={data.layers} layout="vertical" barSize={16}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={95} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<GreenTooltip />} />
                  <Bar dataKey="value" name="Assessments" radius={[0, 4, 4, 0]}>
                    {data.layers.map((l, i) => (
                      <Cell key={i} fill={LAYER_COLOR[l.name] ?? "#10b981"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              {data.photos_by_layer.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-[10.5px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Evidence photos</p>
                  <div className="flex flex-wrap gap-1.5">
                    {data.photos_by_layer.map((p) => (
                      <span key={p.name} className="text-[11px] px-2 py-0.5 rounded-md bg-gray-50 border border-gray-100 text-gray-600">
                        {p.name} <b className="text-gray-800">{p.value}</b>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </div>

          {data.inspector_tracking && (
            <InspectorTrackingSection
              tracking={data.inspector_tracking}
              filtersLabel={[
                ...describeFilters([
                  ["Barangay", f.barangay, brgyOpts],
                  ["Reforestation area", f.area, areaOpts],
                  ["Type", f.type, TYPE_OPTIONS],
                  ["Layer", f.layer, LAYER_OPTIONS],
                ]),
                ...(dateLabel(f.date_from, f.date_to) ? [["Date", dateLabel(f.date_from, f.date_to)] as [string, string]] : []),
              ]}
            />
          )}

          <Card>
            <div className="px-5 pt-5">
              <SectionTitle
                icon={<FileText size={16} />}
                title="Assessment Records"
                right={
                  <ExportButtons
                    onPdf={() => handleExport("pdf")}
                    onExcel={() => handleExport("excel")}
                    disabled={data.rows.length === 0}
                    count={data.rows.length}
                  />
                }
              />
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <Th>Submitted</Th>
                    <Th>Assessment</Th>
                    <Th>Area / Site</Th>
                    <Th>Layers</Th>
                    <Th right>Photos</Th>
                    <Th>Security</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paged.pageRows.length > 0 ? (
                    paged.pageRows.map((r) => (
                      <tr key={r.id} className="hover:bg-gray-50/70 align-top">
                        <Td className="whitespace-nowrap">
                          <p>{fmtDate(r.submitted)}</p>
                          {r.assessment_date && r.assessment_date !== r.submitted && (
                            <p className="text-[10.5px] text-gray-400">Assessed {fmtDate(r.assessment_date)}</p>
                          )}
                        </Td>
                        <Td>
                          <p className="font-semibold text-gray-800">{r.title}</p>
                          <p className="text-[11px] text-gray-400">
                            {r.type} · {r.inspector ?? "—"}
                            {!r.has_location && <span className="text-amber-600"> · no GPS</span>}
                          </p>
                        </Td>
                        <Td>
                          <p>{r.reforestation_area ?? "—"}</p>
                          {r.site_id ? (
                            <button onClick={() => onSiteHistory(r.site_id!)} className="text-[11px] text-emerald-700 hover:underline">
                              {r.site_name}
                            </button>
                          ) : (
                            <p className="text-[11px] text-gray-400">{r.barangay ?? "General area"}</p>
                          )}
                          {r.land_classification && <p className="text-[10.5px] text-purple-600">{r.land_classification}</p>}
                        </Td>
                        <Td>
                          <div className="flex flex-wrap gap-1">
                            {r.layers.length > 0 ? (
                              r.layers.map((l) => (
                                <span key={l} className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-md ${LAYER_TONE[l] ?? "bg-gray-50 text-gray-600"}`}>
                                  {l}
                                </span>
                              ))
                            ) : (
                              <span className="text-[11px] text-gray-400">—</span>
                            )}
                          </div>
                        </Td>
                        <Td right>{r.photos}</Td>
                        <Td>
                          {r.security_concerns.length > 0 ? (
                            <div className="flex flex-col gap-0.5">
                              {r.security_concerns.map((c) => (
                                <span key={c} className={`text-[11px] ${r.high_risk ? "text-red-600 font-semibold" : "text-amber-700"}`}>
                                  {c}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[11px] text-gray-400">None</span>
                          )}
                        </Td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6}>
                        <EmptyState text="No assessments match the filters" />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination {...paged} />
          </Card>
        </div>
      )}
    </div>
  );
}

// ─── Main page ──────────────────────────────────────────────────────────────

type TabKey = "sites" | "reviews" | "assessments" | "programs";

const TABS: { key: TabKey; label: string; icon: ReactElement; sub: string }[] = [
  { key: "sites", label: "Site Registry", icon: <MapPin size={15} />, sub: "Every site with its approval, verification, boundary and planted area — open History for a site's full timeline" },
  { key: "reviews", label: "Planted Area Reviews", icon: <MapPinned size={15} />, sub: "Planted-area polygons from the field and the Data Manager → GIS review history" },
  { key: "assessments", label: "Field Assessments", icon: <ClipboardList size={15} />, sub: "Submitted field assessments, layers covered, evidence photos and security concerns" },
  { key: "programs", label: "Site Programs", icon: <TreePine size={15} />, sub: "Tree planting programs run on each site — outcomes, planting and survival" },
];

export default function GISReports() {
  const [tab, setTab] = useState<TabKey>(() => {
    try {
      return (localStorage.getItem("gis_reports_tab") as TabKey) || "sites";
    } catch {
      return "sites";
    }
  });
  const [options, setOptions] = useState<FilterOptions | null>(null);
  const [historySiteId, setHistorySiteId] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    try {
      localStorage.setItem("gis_reports_tab", tab);
    } catch {
      /* ignore */
    }
  }, [tab]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${api}api/dm_report/filter_options/`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        if (res.ok) setOptions(await res.json());
      } catch {
        /* filters still work without names */
      }
    })();
  }, []);

  const active = TABS.find((t) => t.key === tab) ?? TABS[0];

  return (
    <div className="min-h-screen bg-[#f5faf6]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <main className="max-w-[1400px] mx-auto p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#0F4A2F] flex items-center gap-2">
              <BarChart3 size={24} /> GIS Reports
            </h1>
            <p className="text-sm text-gray-500 mt-1">{active.sub}</p>
          </div>
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-colors"
          >
            <RefreshCw size={15} /> Refresh
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-1.5 flex flex-wrap gap-1.5 w-fit">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                tab === t.key ? "bg-[#0F4A2F] text-white shadow-sm" : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {tab === "sites" && <SitesTab options={options} onSiteHistory={setHistorySiteId} refreshKey={refreshKey} />}
        {tab === "reviews" && <ReviewsTab options={options} onSiteHistory={setHistorySiteId} refreshKey={refreshKey} />}
        {tab === "assessments" && <AssessmentsTab options={options} onSiteHistory={setHistorySiteId} refreshKey={refreshKey} />}
        {tab === "programs" && (
          <ProgramsTab options={options} onSiteHistory={setHistorySiteId} refreshKey={refreshKey} programLinkBase={null} />
        )}
      </main>

      {historySiteId !== null && <SiteHistoryModal siteId={historySiteId} onClose={() => setHistorySiteId(null)} />}
    </div>
  );
}
