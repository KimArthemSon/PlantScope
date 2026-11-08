import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  FileText,
  History,
  Layers,
  MapPin,
  MonitorDot,
  Package,
  Sprout,
  TreePine,
  TrendingUp,
  XCircle,
} from "lucide-react";
import {
  areaOptions,
  AXIS_TICK,
  Badge,
  barangayOptions,
  Card,
  dateFilter,
  DateRangeFilter,
  describeFilters,
  DonutLegend,
  EmptyState,
  ExportButtons,
  FilterBar,
  type FilterOptions,
  fmt,
  fmtDate,
  fmtHa,
  fmtPct,
  GreenTooltip,
  Kpi,
  landClassOptions,
  optionLabel,
  Pagination,
  PROGRAM_TONE,
  RateBar,
  rateColor,
  ReportBody,
  runExport,
  SearchFilter,
  SectionTitle,
  SelectFilter,
  Td,
  Th,
  usePaged,
  useRefresh,
  useReport,
} from "./reportUi";

// ─── Types ──────────────────────────────────────────────────────────────────

export type { FilterOptions } from "./reportUi";

export interface ProgramRow {
  application_id: number;
  ref: string;
  title: string;
  group_name: string;
  classification: string;
  site_id: number | null;
  site_name: string | null;
  barangay: string | null;
  status: string;
  status_label: string;
  participants: number;
  submitted: string;
  orientation_date: string | null;
  closed_date: string | null;
  duration_days: number | null;
  seedlings_endorsed: number;
  planted: number;
  survived: number;
  dead: number;
  survival_rate: number | null;
  visits: number;
  last_visit: string | null;
  planted_hectares: number | null;
  closure_note: string | null;
}

export interface ProgramsReport {
  summary: {
    total: number;
    completed: number;
    failed: number;
    ongoing: number;
    pending: number;
    rejected: number;
    cancelled: number;
    success_rate: number | null;
    seedlings_endorsed: number;
    planted: number;
    survived: number;
    dead: number;
    survival_rate: number | null;
    planted_hectares: number;
    avg_completed_duration_days: number | null;
    groups: number;
  };
  status_breakdown: { name: string; value: number; fill: string }[];
  monthly: { month: string; submitted: number; completed: number; failed: number }[];
  progress_trend: TrendPoint[];
  by_barangay: {
    name: string;
    programs: number;
    completed: number;
    failed: number;
    ongoing: number;
    planted: number;
    survival_rate: number | null;
  }[];
  rows: ProgramRow[];
  truncated: boolean;
}

export interface TrendPoint {
  month: string;
  new_planted: number;
  new_dead: number;
  visits: number;
  total_planted: number;
  alive: number;
  survival_rate: number | null;
  planted_hectares: number;
}

export interface SiteRow {
  site_id: number;
  name: string;
  reforestation_area: string | null;
  barangay: string | null;
  approval_status: string;
  monitoring_status: string;
  monitoring_label: string;
  hectares: number;
  land_classification: string | null;
  verified_at: string | null;
  programs_total: number;
  programs_completed: number;
  programs_failed: number;
  current_program: string | null;
  current_group: string | null;
  last_outcome: string | null;
  planted: number;
  survived: number;
  dead: number;
  survival_rate: number | null;
  planted_hectares: number | null;
  visits: number;
  last_visit: string | null;
  days_since_visit: number | null;
  overdue: boolean;
  no_visit: boolean;
}

export interface SitesReport {
  summary: {
    survived: number;
    dead: number;
    total_sites: number;
    total_hectares: number;
    planted_hectares: number;
    under_monitoring: number;
    available: number;
    completed: number;
    overdue: number;
    no_visit: number;
    planted: number;
    survival_rate: number | null;
    programs_completed: number;
    overdue_days: number;
  };
  status_breakdown: { key: string; name: string; value: number; hectares: number; fill: string }[];
  by_barangay: { name: string; sites: number; hectares: number; planted_hectares: number }[];
  land_classification: { name: string; value: number }[];
  progress_trend: TrendPoint[];
  rows: SiteRow[];
}

export interface VisitRow {
  id: number;
  date: string;
  site_id: number | null;
  site_name: string | null;
  barangay: string | null;
  program: string | null;
  group_name: string | null;
  visit_type: string;
  visit_label: string;
  status: string;
  dm_review: string;
  gis_review: string;
  inspector: string;
  planted: number;
  dead: number;
  planted_hectares: number | null;
}

export interface VisitsReport {
  summary: {
    total: number;
    accepted: number;
    pending: number;
    rejected: number;
    initial: number;
    ongoing: number;
    inactive_check: number;
    sites_visited: number;
    planted_recorded: number;
    dead_recorded: number;
    inspectors: number;
  };
  monthly: { month: string; accepted: number; pending: number; rejected: number }[];
  by_inspector: { name: string; visits: number; accepted: number }[];
  rows: VisitRow[];
}

export interface SpeciesRow {
  name: string;
  endorsed: number;
  planted: number;
  survived: number;
  dead: number;
  survival_rate: number | null;
  sites: number;
}

export interface SpeciesReport {
  summary: {
    species_count: number;
    endorsed: number;
    planted: number;
    survived: number;
    dead: number;
    survival_rate: number | null;
    best_species: string | null;
    worst_species: string | null;
  };
  rows: SpeciesRow[];
}

// ─── Shared helpers ────────────────────────────────────────────────────────


// ─── PROGRESS TREND (inside Programs) ───────────────────────────────────────

function Change({ value, unit = "", digits = 0 }: { value: number | null; unit?: string; digits?: number }) {
  if (value === null) return <span className="text-gray-400">—</span>;
  const rounded = Number(value.toFixed(digits));
  const tone = rounded > 0 ? "text-emerald-600" : rounded < 0 ? "text-red-500" : "text-gray-500";
  return (
    <span className={`font-semibold ${tone}`}>
      {rounded > 0 ? "+" : ""}
      {rounded.toLocaleString(undefined, { maximumFractionDigits: digits })}
      {unit}
    </span>
  );
}

/** Month-by-month totals: trees planted, alive, survival rate and planted area. */
export function ProgressTrend({ trend }: { trend: TrendPoint[] }) {
  const hasData = trend.some((t) => t.total_planted > 0 || t.planted_hectares > 0);
  const first = trend[0];
  const last = trend[trend.length - 1];
  const prev = trend.length > 1 ? trend[trend.length - 2] : null;
  const periodPlanted = trend.reduce((sum, t) => sum + t.new_planted, 0);

  return (
    <Card className="p-5">
      <SectionTitle
        icon={<TrendingUp size={16} />}
        title="Progress Trend"
        sub="Running totals per month from accepted monitoring visits — compare planted trees, survival and planted area over time"
      />
      {!hasData ? (
        <EmptyState text="No accepted monitoring visits for these programs yet" />
      ) : (
        <>
          {/* Totals are in the cards above — here only how they changed over the period */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mb-4 px-3 py-2 rounded-xl bg-gray-50 text-[12px] text-gray-500">
            <span className="font-semibold text-gray-700">Since {first.month}:</span>
            <span>
              <Change value={periodPlanted} /> trees planted
            </span>
            <span>
              <Change value={prev ? last.alive - prev.alive : null} /> alive vs last month
            </span>
            <span>
              survival{" "}
              <Change
                value={first.survival_rate !== null && last.survival_rate !== null ? last.survival_rate - first.survival_rate : null}
                unit=" pts"
                digits={1}
              />
            </span>
            <span>
              <Change value={last.planted_hectares - first.planted_hectares} unit=" ha" digits={2} /> planted area
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2">
              <p className="text-[12px] font-semibold text-gray-700 mb-2">Trees planted, alive and survival rate</p>
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" vertical={false} />
                  <XAxis dataKey="month" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="trees" allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="pct" orientation="right" domain={[0, 100]} unit="%" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <Tooltip content={<GreenTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar yAxisId="trees" dataKey="new_planted" name="Planted that month" fill="#bbf7d0" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="trees" type="monotone" dataKey="total_planted" name="Total planted" stroke="#059669" strokeWidth={2.5} dot={{ r: 3 }} />
                  <Line yAxisId="trees" type="monotone" dataKey="alive" name="Alive" stroke="#0ea5e9" strokeWidth={2.5} dot={{ r: 3 }} />
                  <Line
                    yAxisId="pct"
                    type="monotone"
                    dataKey="survival_rate"
                    name="Survival rate (%)"
                    stroke="#f97316"
                    strokeWidth={2}
                    strokeDasharray="5 3"
                    dot={{ r: 3 }}
                    connectNulls
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div>
              <p className="text-[12px] font-semibold text-gray-700 mb-2">Planted area (ha)</p>
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" vertical={false} />
                  <XAxis dataKey="month" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} unit=" ha" width={60} />
                  <Tooltip content={<GreenTooltip />} />
                  <Bar dataKey="planted_hectares" name="Planted area (ha)" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                </ComposedChart>
              </ResponsiveContainer>
              <p className="text-[10.5px] text-gray-400 mt-1">Latest planted polygon of each program, as of each month</p>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}

// ─── TAB: PROGRAMS ──────────────────────────────────────────────────────────

const PROGRAM_STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "completed", label: "Completed" },
  { value: "ongoing", label: "Ongoing (accepted / monitoring)" },
  { value: "pending", label: "Pending review" },
  { value: "failed", label: "Failed" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
];
const CLASSIFICATION_OPTIONS = [
  { value: "all", label: "All groups" },
  { value: "new", label: "New (first-time)" },
  { value: "old", label: "Returning" },
];
const DATE_BASIS_OPTIONS = [
  { value: "submitted", label: "Date submitted" },
  { value: "closed", label: "Date completed / closed" },
];
const PROGRAM_DEFAULTS = {
  search: "",
  status: "all",
  barangay: "all",
  area: "all",
  land_classification: "all",
  classification: "all",
  date_basis: "submitted",
  date_from: "",
  date_to: "",
};

export function ProgramsTab({
  options,
  onSiteHistory,
  refreshKey,
}: {
  options: FilterOptions | null;
  onSiteHistory: (id: number) => void;
  /** Bumped by the page's Refresh button; omit when the page has none */
  refreshKey?: number;
}) {
  const [f, setF] = useState(PROGRAM_DEFAULTS);
  const { data, loading, error, reload } = useReport<ProgramsReport>("dm_report/programs/", f);
  useRefresh(refreshKey, reload);
  const paged = usePaged(data?.rows ?? []);
  const brgyOpts = barangayOptions(options);
  const areaOpts = areaOptions(options, f.barangay);
  const classOpts = landClassOptions(options);
  const isFiltered = JSON.stringify(f) !== JSON.stringify(PROGRAM_DEFAULTS);

  const handleExport = (kind: "pdf" | "excel") => {
    if (!data) return;
    const s = data.summary;
    runExport<ProgramRow>(kind, {
      title: "Tree Planting Programs Report",
      filename: "programs_report",
      filters: [
        ...describeFilters([
          ["Status", f.status, PROGRAM_STATUS_OPTIONS],
          ["Barangay", f.barangay, brgyOpts],
          ["Reforestation area", f.area, areaOpts],
          ["Land classification", f.land_classification, classOpts],
          ["Group type", f.classification, CLASSIFICATION_OPTIONS],
          ["Search", f.search, null],
        ]),
        ...dateFilter(optionLabel(DATE_BASIS_OPTIONS, f.date_basis), f.date_from, f.date_to),
      ],
      summary: [
        ["Programs", fmt(s.total)],
        ["Completed", fmt(s.completed)],
        ["Ongoing", fmt(s.ongoing)],
        ["Pending review", fmt(s.pending)],
        ["Failed", fmt(s.failed)],
        ["Rejected / cancelled", fmt(s.rejected + s.cancelled)],
        ["Success rate (completed vs failed)", fmtPct(s.success_rate)],
        ["Tree grower groups", fmt(s.groups)],
        ["Seedlings released", fmt(s.seedlings_endorsed)],
        ["Plants planted", fmt(s.planted)],
        ["Plants alive", fmt(s.survived)],
        ["Survival rate", fmtPct(s.survival_rate)],
        ["Planted area", fmtHa(s.planted_hectares)],
        ["Avg. completed duration", s.avg_completed_duration_days !== null ? `${s.avg_completed_duration_days} days` : "—"],
      ],
      sections: [
        {
          title: "Monthly progress",
          columns: ["Month", "Planted that month", "Dead that month", "Total planted", "Alive", "Survival rate", "Planted area"],
          rows: data.progress_trend.map((t) => [
            t.month, fmt(t.new_planted), fmt(t.new_dead), fmt(t.total_planted), fmt(t.alive), fmtPct(t.survival_rate), fmtHa(t.planted_hectares),
          ]),
        },
        {
          title: "Programs by barangay",
          columns: ["Barangay", "Programs", "Completed", "Ongoing", "Failed", "Planted", "Survival"],
          rows: data.by_barangay.map((b) => [
            b.name, b.programs, b.completed, b.ongoing, b.failed, fmt(b.planted), fmtPct(b.survival_rate),
          ]),
        },
      ],
      recordsTitle: "Programs",
      columns: [
        { header: "Ref", value: (r) => r.ref },
        { header: "Program", value: (r) => r.title },
        { header: "Group", value: (r) => r.group_name },
        { header: "Type", value: (r) => r.classification },
        { header: "Site", value: (r) => r.site_name },
        { header: "Barangay", value: (r) => r.barangay },
        { header: "Status", value: (r) => r.status_label },
        { header: "Submitted", value: (r) => fmtDate(r.submitted) },
        { header: "Orientation", value: (r) => fmtDate(r.orientation_date) },
        { header: "Closed", value: (r) => fmtDate(r.closed_date) },
        { header: "Duration (days)", value: (r) => r.duration_days },
        { header: "Released", value: (r) => r.seedlings_endorsed },
        { header: "Planted", value: (r) => r.planted },
        { header: "Alive", value: (r) => r.survived },
        { header: "Survival", value: (r) => fmtPct(r.survival_rate) },
        { header: "Visits", value: (r) => r.visits },
        { header: "Planted area", value: (r) => fmtHa(r.planted_hectares) },
        { header: "Closure note", value: (r) => r.closure_note },
      ],
      rows: data.rows,
    });
  };


  return (
    <div className="space-y-5">
      <FilterBar onReset={() => setF(PROGRAM_DEFAULTS)} showReset={isFiltered}>
        <SearchFilter
          value={f.search}
          onChange={(v) => setF({ ...f, search: v })}
          placeholder="Program, group or site…"
        />
        <SelectFilter label="Status" value={f.status} onChange={(v) => setF({ ...f, status: v })} options={PROGRAM_STATUS_OPTIONS} />
        <SelectFilter label="Barangay" value={f.barangay} onChange={(v) => setF({ ...f, barangay: v, area: "all" })} options={brgyOpts} />
        <SelectFilter label="Reforestation area" value={f.area} onChange={(v) => setF({ ...f, area: v })} options={areaOpts} />
        <SelectFilter
          label="Land classification"
          value={f.land_classification}
          onChange={(v) => setF({ ...f, land_classification: v })}
          options={classOpts}
        />
        <SelectFilter
          label="Group type"
          value={f.classification}
          onChange={(v) => setF({ ...f, classification: v })}
          options={CLASSIFICATION_OPTIONS}
        />
        <SelectFilter
          label="Filter dates by"
          value={f.date_basis}
          onChange={(v) => setF({ ...f, date_basis: v })}
          options={DATE_BASIS_OPTIONS}
        />
        <DateRangeFilter from={f.date_from} to={f.date_to} onChange={(a, b) => setF({ ...f, date_from: a, date_to: b })} />
      </FilterBar>

      <ReportBody data={data} error={error} loading={loading} loadingText="Building programs report…" onRetry={reload}>
        {(data) => {
          const s = data.summary;
          return (
            <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Kpi icon={<ClipboardList size={16} />} label="Programs" value={fmt(s.total)} sub={`${s.groups} tree grower groups`} />
            <Kpi
              icon={<CheckCircle2 size={16} />}
              label="Completed"
              value={fmt(s.completed)}
              sub={`Success rate ${fmtPct(s.success_rate)} (vs failed)`}
              accent="bg-green-600"
            />
            <Kpi
              icon={<MonitorDot size={16} />}
              label="Ongoing"
              value={fmt(s.ongoing)}
              sub={`${s.pending} pending review`}
              accent="bg-indigo-500"
            />
            <Kpi
              icon={<XCircle size={16} />}
              label="Failed / Rejected / Cancelled"
              value={fmt(s.failed + s.rejected + s.cancelled)}
              sub={`${s.failed} failed · ${s.rejected} rejected · ${s.cancelled} cancelled`}
              accent="bg-red-500"
            />
            <Kpi
              icon={<Sprout size={16} />}
              label="Plants Planted"
              value={fmt(s.planted)}
              sub={`${fmt(s.survived)} alive · ${fmt(s.dead)} dead`}
              accent="bg-emerald-500"
            />
            <Kpi
              icon={<Activity size={16} />}
              label="Survival Rate"
              value={fmtPct(s.survival_rate)}
              valueColor={rateColor(s.survival_rate)}
              sub="Alive out of all planted trees"
              accent="bg-green-500"
            />
            <Kpi icon={<Package size={16} />} label="Seedlings Released" value={fmt(s.seedlings_endorsed)} sub="Accepted + confirmed requests" accent="bg-teal-500" />
            <Kpi
              icon={<TreePine size={16} />}
              label="Planted Area"
              value={fmtHa(s.planted_hectares)}
              sub={
                s.avg_completed_duration_days !== null
                  ? `Avg. ${s.avg_completed_duration_days} days to complete`
                  : "From latest planted polygons"
              }
              accent="bg-teal-600"
            />
          </div>

          <ProgressTrend trend={data.progress_trend} />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <Card className="p-5 lg:col-span-2">
              <SectionTitle
                icon={<BarChart3 size={16} />}
                title="Programs Over Time"
                sub="Submitted (by submission date) vs completed and failed (by closing date)"
              />
              {data.monthly.some((m) => m.submitted || m.completed || m.failed) ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={data.monthly} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" vertical={false} />
                    <XAxis dataKey="month" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                    <Tooltip content={<GreenTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="submitted" name="Submitted" fill="#c7d2fe" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="completed" name="Completed" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="failed" name="Failed" fill="#f87171" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState text="No program activity in this period" />
              )}
            </Card>
            <Card className="p-5">
              <SectionTitle icon={<Layers size={16} />} title="Status Breakdown" sub={`${s.total} programs`} />
              <DonutLegend data={data.status_breakdown} />
            </Card>
          </div>

          <Card className="p-5">
            <SectionTitle icon={<MapPin size={16} />} title="Programs by Barangay" sub="Outcome and survival per barangay" />
            {data.by_barangay.length > 0 ? (
              <div>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="border-b border-gray-100">
                      <tr>
                        <Th>Barangay</Th>
                        <Th right>Programs</Th>
                        <Th right>Completed</Th>
                        <Th right>Ongoing</Th>
                        <Th right>Failed</Th>
                        <Th right>Planted</Th>
                        <Th>Survival</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {data.by_barangay.map((b) => (
                        <tr key={b.name}>
                          <Td className="font-semibold text-gray-800">{b.name}</Td>
                          <Td right>{b.programs}</Td>
                          <Td right>{b.completed}</Td>
                          <Td right>{b.ongoing}</Td>
                          <Td right className={b.failed > 0 ? "text-red-500" : ""}>{b.failed}</Td>
                          <Td right>{fmt(b.planted)}</Td>
                          <Td>
                            <RateBar rate={b.survival_rate} />
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <EmptyState text="No programs match the filters" />
            )}
          </Card>

          <Card>
            <div className="px-5 pt-5">
              <SectionTitle
                icon={<FileText size={16} />}
                title="Program Records"
                sub="Every program matching the filters — exports include all rows, not just this page"
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
                    <Th>Program</Th>
                    <Th>Site</Th>
                    <Th>Status</Th>
                    <Th>Submitted</Th>
                    <Th>Closed</Th>
                    <Th right>Duration</Th>
                    <Th right>Released</Th>
                    <Th right>Planted</Th>
                    <Th>Survival</Th>
                    <Th right>Visits</Th>
                    <Th>History</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paged.pageRows.length > 0 ? (
                    paged.pageRows.map((r) => (
                      <tr key={r.application_id} className="hover:bg-gray-50/70">
                        <Td>
                          <p className="text-[11px] text-gray-400 font-semibold">{r.ref}</p>
                          <p className="font-semibold text-gray-800 max-w-[220px] truncate" title={r.title}>
                            {r.title}
                          </p>
                          <p className="text-[11px] text-gray-500">
                            {r.group_name} · {r.classification}
                          </p>
                        </Td>
                        <Td>
                          {r.site_name ? (
                            <>
                              <p className="font-medium text-gray-800">{r.site_name}</p>
                              <p className="text-[11px] text-gray-400">{r.barangay ?? "—"}</p>
                            </>
                          ) : (
                            <span className="text-gray-400 italic text-[12px]">No site</span>
                          )}
                        </Td>
                        <Td>
                          <Badge label={r.status_label} tone={PROGRAM_TONE[r.status] ?? PROGRAM_TONE.cancelled} />
                        </Td>
                        <Td className="whitespace-nowrap">{fmtDate(r.submitted)}</Td>
                        <Td className="whitespace-nowrap">{fmtDate(r.closed_date)}</Td>
                        <Td right>{r.duration_days !== null ? `${r.duration_days}d` : "—"}</Td>
                        <Td right>{fmt(r.seedlings_endorsed)}</Td>
                        <Td right>{fmt(r.planted)}</Td>
                        <Td>
                          <RateBar rate={r.survival_rate} />
                        </Td>
                        <Td right>{r.visits}</Td>
                        <Td>
                          {r.site_id && (
                            <button
                              onClick={() => onSiteHistory(r.site_id!)}
                              title="Site history"
                              className="p-1.5 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                            >
                              <History size={13} />
                            </button>
                          )}
                        </Td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={11}>
                        <EmptyState text="No programs match the filters" />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination {...paged} />
          </Card>
            </>
          );
        }}
      </ReportBody>
    </div>
  );
}
