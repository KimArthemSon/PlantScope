import { useEffect, useMemo, useState, type ReactElement } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock,
  ExternalLink,
  FileText,
  History,
  Layers,
  Leaf,
  MapPin,
  MonitorDot,
  Package,
  RefreshCw,
  Sprout,
  TreePine,
  Trophy,
  Users,
  XCircle,
} from "lucide-react";
import { api } from "@/constant/api.ts";
import { exportCsv, exportPdf, type ExportSpec } from "./reportExport";
import SiteHistoryModal from "./SiteHistoryModal";
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
  PROGRAM_TONE,
  Pagination,
  RateBar,
  SITE_TONE,
  SURVIVAL_TARGET,
  SearchFilter,
  SectionTitle,
  SelectFilter,
  Td,
  Th,
  VISIT_TONE,
  fmt,
  fmtDate,
  fmtHa,
  fmtPct,
  rateColor,
  usePaged,
  useReport,
} from "./reportUi";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Option {
  id: number;
  name: string;
}

export interface FilterOptions {
  barangays: Option[];
  species: Option[];
  areas?: { id: number; name: string; barangay_id: number | null }[];
}

interface ProgramRow {
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

interface ProgramsReport {
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

interface SiteRow {
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

interface SitesReport {
  summary: {
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
  rows: SiteRow[];
}

interface VisitRow {
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
  added: number;
  dead: number;
  planted_hectares: number | null;
}

interface VisitsReport {
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

interface SpeciesRow {
  name: string;
  endorsed: number;
  planted: number;
  added_by_grower: number;
  survived: number;
  dead: number;
  survival_rate: number | null;
  sites: number;
}

interface SpeciesReport {
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

// ─── Shared helpers ─────────────────────────────────────────────────────────


function barangayOptions(options: FilterOptions | null) {
  return [
    { value: "all", label: "All barangays" },
    ...(options?.barangays ?? []).map((b) => ({ value: String(b.id), label: b.name })),
  ];
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

/** Builds the "Filters" line for exports, skipping filters left at "all". */
function describeFilters(entries: [string, string, { value: string; label: string }[] | null][]) {
  return entries
    .filter(([, value]) => value && value !== "all")
    .map(([label, value, options]) => [label, options ? optionLabel(options, value) : value] as [string, string]);
}

function runExport<T>(kind: "pdf" | "excel", spec: ExportSpec<T>) {
  if (kind === "pdf") exportPdf(spec);
  else exportCsv(spec);
}

function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card className="p-10 text-center">
      <p className="text-sm text-gray-500 mb-3">{message}</p>
      <button
        onClick={onRetry}
        className="px-4 py-2 rounded-lg bg-[#0F4A2F] text-white text-sm font-semibold hover:bg-[#1a6b44]"
      >
        Retry
      </button>
    </Card>
  );
}

function DonutLegend({
  data,
  extra,
}: {
  data: { name: string; value: number; fill: string }[];
  extra?: (d: any) => string;
}) {
  const visible = data.filter((d) => d.value > 0);
  if (visible.length === 0) return <EmptyState text="No data" />;
  return (
    <>
      <ResponsiveContainer width="100%" height={170}>
        <PieChart>
          <Pie data={visible} dataKey="value" nameKey="name" outerRadius={70} innerRadius={40} paddingAngle={2}>
            {visible.map((d, i) => (
              <Cell key={i} fill={d.fill} />
            ))}
          </Pie>
          <Tooltip content={<GreenTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-col gap-1.5 mt-2">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-2 text-[12px]">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.fill }} />
            <span className="text-gray-600">{d.name}</span>
            {extra && <span className="ml-auto text-gray-400 text-[11px]">{extra(d)}</span>}
            <span className={`${extra ? "" : "ml-auto"} w-8 text-right font-bold text-gray-800`}>{d.value}</span>
          </div>
        ))}
      </div>
    </>
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
  classification: "all",
  date_basis: "submitted",
  date_from: "",
  date_to: "",
};

export function ProgramsTab({
  options,
  onSiteHistory,
  refreshKey,
  programLinkBase = "/DataManager/maintenance_evaluation",
}: {
  options: FilterOptions | null;
  onSiteHistory: (id: number) => void;
  refreshKey: number;
  /** Route of the program detail page for this role, or null to hide the View button */
  programLinkBase?: string | null;
}) {
  const navigate = useNavigate();
  const [f, setF] = useState(PROGRAM_DEFAULTS);
  const { data, loading, error, reload } = useReport<ProgramsReport>("dm_report/programs/", f);
  useEffect(() => {
    if (refreshKey) reload();
  }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const paged = usePaged(data?.rows ?? []);
  const brgyOpts = barangayOptions(options);
  const isFiltered = JSON.stringify(f) !== JSON.stringify(PROGRAM_DEFAULTS);

  const handleExport = (kind: "pdf" | "excel") => {
    if (!data) return;
    const s = data.summary;
    const range = dateLabel(f.date_from, f.date_to);
    runExport<ProgramRow>(kind, {
      title: "Tree Planting Programs Report",
      filename: "programs_report",
      filters: [
        ...describeFilters([
          ["Status", f.status, PROGRAM_STATUS_OPTIONS],
          ["Barangay", f.barangay, brgyOpts],
          ["Group type", f.classification, CLASSIFICATION_OPTIONS],
          ["Search", f.search, null],
        ]),
        ...(range ? [[`${optionLabel(DATE_BASIS_OPTIONS, f.date_basis)}`, range] as [string, string]] : []),
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

  const s = data?.summary;

  return (
    <div className="space-y-5">
      <FilterBar onReset={() => setF(PROGRAM_DEFAULTS)} showReset={isFiltered}>
        <SearchFilter
          value={f.search}
          onChange={(v) => setF({ ...f, search: v })}
          placeholder="Program, group or site…"
        />
        <SelectFilter label="Status" value={f.status} onChange={(v) => setF({ ...f, status: v })} options={PROGRAM_STATUS_OPTIONS} />
        <SelectFilter label="Barangay" value={f.barangay} onChange={(v) => setF({ ...f, barangay: v })} options={brgyOpts} />
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

      {error && !data ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : !data || !s ? (
        <LoadingBlock text="Building programs report…" />
      ) : (
        <div className={`space-y-5 transition-opacity ${loading ? "opacity-60" : ""}`}>
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
              sub={`Target ${SURVIVAL_TARGET}%`}
              accent={s.survival_rate !== null && s.survival_rate >= SURVIVAL_TARGET ? "bg-green-500" : "bg-amber-500"}
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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ResponsiveContainer width="100%" height={Math.max(180, data.by_barangay.length * 34)}>
                  <BarChart data={data.by_barangay} layout="vertical" barSize={14}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <Tooltip content={<GreenTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="completed" name="Completed" stackId="a" fill="#10b981" />
                    <Bar dataKey="ongoing" name="Ongoing" stackId="a" fill="#818cf8" />
                    <Bar dataKey="failed" name="Failed" stackId="a" fill="#f87171" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="border-b border-gray-100">
                      <tr>
                        <Th>Barangay</Th>
                        <Th right>Programs</Th>
                        <Th right>Completed</Th>
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
                    <Th>Actions</Th>
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
                          <div className="flex items-center gap-1.5">
                            {programLinkBase && (
                              <button
                                onClick={() => navigate(`${programLinkBase}/${r.application_id}`)}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-[11px] font-medium hover:bg-gray-100"
                              >
                                <ExternalLink size={12} /> View
                              </button>
                            )}
                            {r.site_id && (
                              <button
                                onClick={() => onSiteHistory(r.site_id!)}
                                title="Site history"
                                className="p-1.5 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                              >
                                <History size={13} />
                              </button>
                            )}
                          </div>
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
        </div>
      )}
    </div>
  );
}

// ─── TAB: SITES ─────────────────────────────────────────────────────────────

const SITE_STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "available", label: "Available" },
  { value: "reserved", label: "Reserved" },
  { value: "under_monitoring", label: "Under Monitoring" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
  { value: "onhold", label: "On Hold" },
];
const ATTENTION_OPTIONS = [
  { value: "all", label: "All sites" },
  { value: "overdue", label: "Overdue visit (> 90 days)" },
  { value: "no_visit", label: "Monitored, no visit yet" },
  { value: "low_survival", label: `Survival below ${SURVIVAL_TARGET}%` },
];
const SITE_DEFAULTS = { search: "", monitoring_status: "all", barangay: "all", attention: "all" };

export function SitesTab({
  options,
  onSiteHistory,
  refreshKey,
}: {
  options: FilterOptions | null;
  onSiteHistory: (id: number) => void;
  refreshKey: number;
}) {
  const [f, setF] = useState(SITE_DEFAULTS);
  const { data, loading, error, reload } = useReport<SitesReport>("dm_report/sites/", f);
  useEffect(() => {
    if (refreshKey) reload();
  }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const paged = usePaged(data?.rows ?? []);
  const brgyOpts = barangayOptions(options);
  const isFiltered = JSON.stringify(f) !== JSON.stringify(SITE_DEFAULTS);

  const handleExport = (kind: "pdf" | "excel") => {
    if (!data) return;
    const s = data.summary;
    runExport<SiteRow>(kind, {
      title: "Official Sites Status Report",
      filename: "sites_report",
      filters: describeFilters([
        ["Monitoring status", f.monitoring_status, SITE_STATUS_OPTIONS],
        ["Barangay", f.barangay, brgyOpts],
        ["Needs attention", f.attention, ATTENTION_OPTIONS],
        ["Search", f.search, null],
      ]),
      summary: [
        ["Official sites", fmt(s.total_sites)],
        ["Total site area", fmtHa(s.total_hectares)],
        ["Planted area", fmtHa(s.planted_hectares)],
        ["Under monitoring", fmt(s.under_monitoring)],
        ["Available", fmt(s.available)],
        ["Completed", fmt(s.completed)],
        [`Overdue visit (> ${s.overdue_days} days)`, fmt(s.overdue)],
        ["Monitored, no visit yet", fmt(s.no_visit)],
        ["Plants planted", fmt(s.planted)],
        ["Survival rate", fmtPct(s.survival_rate)],
        ["Programs completed", fmt(s.programs_completed)],
      ],
      sections: [
        {
          title: "Sites by monitoring status",
          columns: ["Status", "Sites", "Area"],
          rows: data.status_breakdown.map((b) => [b.name, b.value, fmtHa(b.hectares)]),
        },
        {
          title: "Area by barangay",
          columns: ["Barangay", "Sites", "Site area", "Planted area"],
          rows: data.by_barangay.map((b) => [b.name, b.sites, fmtHa(b.hectares), fmtHa(b.planted_hectares)]),
        },
      ],
      recordsTitle: "Sites",
      columns: [
        { header: "Site", value: (r) => r.name },
        { header: "Reforestation area", value: (r) => r.reforestation_area },
        { header: "Barangay", value: (r) => r.barangay },
        { header: "Land class", value: (r) => r.land_classification },
        { header: "Status", value: (r) => r.monitoring_label },
        { header: "Site area", value: (r) => fmtHa(r.hectares) },
        { header: "Planted area", value: (r) => fmtHa(r.planted_hectares) },
        { header: "Current program", value: (r) => (r.current_program ? `${r.current_program} (${r.current_group})` : null) },
        { header: "Programs", value: (r) => r.programs_total },
        { header: "Completed", value: (r) => r.programs_completed },
        { header: "Failed", value: (r) => r.programs_failed },
        { header: "Planted", value: (r) => r.planted },
        { header: "Survival", value: (r) => fmtPct(r.survival_rate) },
        { header: "Last visit", value: (r) => fmtDate(r.last_visit) },
        { header: "Flag", value: (r) => (r.overdue ? "Overdue" : r.no_visit ? "No visit yet" : "") },
      ],
      rows: data.rows,
    });
  };

  const s = data?.summary;

  return (
    <div className="space-y-5">
      <FilterBar onReset={() => setF(SITE_DEFAULTS)} showReset={isFiltered}>
        <SearchFilter value={f.search} onChange={(v) => setF({ ...f, search: v })} placeholder="Site or reforestation area…" />
        <SelectFilter
          label="Monitoring status"
          value={f.monitoring_status}
          onChange={(v) => setF({ ...f, monitoring_status: v })}
          options={SITE_STATUS_OPTIONS}
        />
        <SelectFilter label="Barangay" value={f.barangay} onChange={(v) => setF({ ...f, barangay: v })} options={brgyOpts} />
        <SelectFilter label="Needs attention" value={f.attention} onChange={(v) => setF({ ...f, attention: v })} options={ATTENTION_OPTIONS} />
      </FilterBar>

      {error && !data ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : !data || !s ? (
        <LoadingBlock text="Building sites report…" />
      ) : (
        <div className={`space-y-5 transition-opacity ${loading ? "opacity-60" : ""}`}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Kpi icon={<TreePine size={16} />} label="Official Sites" value={fmt(s.total_sites)} sub={`${fmtHa(s.total_hectares)} total area`} />
            <Kpi
              icon={<MonitorDot size={16} />}
              label="Under Monitoring"
              value={fmt(s.under_monitoring)}
              sub={`${s.available} available · ${s.completed} completed`}
              accent="bg-indigo-500"
            />
            <Kpi
              icon={<Sprout size={16} />}
              label="Planted Area"
              value={fmtHa(s.planted_hectares)}
              sub={`${fmt(s.planted)} plants · survival ${fmtPct(s.survival_rate)}`}
              accent="bg-green-600"
            />
            <Kpi
              icon={<AlertTriangle size={16} />}
              label="Needs a Visit"
              value={fmt(s.overdue + s.no_visit)}
              valueColor={s.overdue + s.no_visit > 0 ? "#ef4444" : undefined}
              sub={`${s.overdue} overdue (> ${s.overdue_days} days) · ${s.no_visit} never visited`}
              accent="bg-red-500"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <Card className="p-5">
              <SectionTitle icon={<Layers size={16} />} title="Monitoring Status" sub="Sites and area per status" />
              <DonutLegend data={data.status_breakdown} extra={(d) => fmtHa(d.hectares)} />
            </Card>
            <Card className="p-5 lg:col-span-2">
              <SectionTitle icon={<MapPin size={16} />} title="Area by Barangay" sub="Official site area vs area actually planted" />
              {data.by_barangay.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={data.by_barangay} barGap={3}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" vertical={false} />
                    <XAxis dataKey="name" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                    <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} unit=" ha" />
                    <Tooltip content={<GreenTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="hectares" name="Site area (ha)" fill="#a7f3d0" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="planted_hectares" name="Planted (ha)" fill="#059669" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState text="No sites match the filters" />
              )}
            </Card>
          </div>

          {data.land_classification.length > 0 && (
            <Card className="p-5">
              <SectionTitle icon={<Leaf size={16} />} title="Land Classification" sub="Verified land classification of the listed sites" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {data.land_classification.map((l) => {
                  const pct = s.total_sites ? Math.round((l.value / s.total_sites) * 100) : 0;
                  return (
                    <div key={l.name} className="bg-gray-50 rounded-xl p-3">
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="font-semibold text-gray-700 truncate">{l.name}</span>
                        <span className="text-gray-500">{l.value} sites</span>
                      </div>
                      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden mt-2">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-[10.5px] text-gray-400 mt-1">{pct}% of sites</p>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          <Card>
            <div className="px-5 pt-5">
              <SectionTitle
                icon={<FileText size={16} />}
                title="Site Records"
                sub="Click History to see a site's full timeline of programs, closures and visits"
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
                    <Th>Status</Th>
                    <Th right>Site Area</Th>
                    <Th right>Planted</Th>
                    <Th>Current Program</Th>
                    <Th right>Programs</Th>
                    <Th>Survival</Th>
                    <Th>Last Visit</Th>
                    <Th>History</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paged.pageRows.length > 0 ? (
                    paged.pageRows.map((r) => (
                      <tr key={r.site_id} className="hover:bg-gray-50/70">
                        <Td>
                          <p className="font-semibold text-gray-800">{r.name}</p>
                          <p className="text-[11px] text-gray-400">
                            {r.barangay ?? "—"} · {r.reforestation_area ?? "—"}
                          </p>
                          {r.land_classification && <p className="text-[10.5px] text-gray-400">{r.land_classification}</p>}
                        </Td>
                        <Td>
                          <Badge label={r.monitoring_label} tone={SITE_TONE[r.monitoring_status] ?? SITE_TONE.onhold} />
                        </Td>
                        <Td right>{fmtHa(r.hectares)}</Td>
                        <Td right>
                          <p>{fmtHa(r.planted_hectares)}</p>
                          <p className="text-[10.5px] text-gray-400">{fmt(r.planted)} plants</p>
                        </Td>
                        <Td>
                          {r.current_program ? (
                            <>
                              <p className="text-gray-800 max-w-[180px] truncate">{r.current_program}</p>
                              <p className="text-[11px] text-gray-400">{r.current_group}</p>
                            </>
                          ) : (
                            <span className="text-[11.5px] text-gray-400">
                              {r.last_outcome ? `Last: ${r.last_outcome}` : "None"}
                            </span>
                          )}
                        </Td>
                        <Td right>
                          <p>{r.programs_total}</p>
                          <p className="text-[10.5px] text-gray-400">
                            {r.programs_completed}✓ {r.programs_failed}✗
                          </p>
                        </Td>
                        <Td>
                          <RateBar rate={r.survival_rate} />
                        </Td>
                        <Td>
                          <p className={`whitespace-nowrap ${r.overdue ? "text-red-500 font-semibold" : ""}`}>{fmtDate(r.last_visit)}</p>
                          {r.overdue && (
                            <p className="text-[10.5px] text-red-500 flex items-center gap-1">
                              <CalendarClock size={11} /> {r.days_since_visit} days ago
                            </p>
                          )}
                          {r.no_visit && <p className="text-[10.5px] text-amber-600">Never visited</p>}
                        </Td>
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
                      <td colSpan={9}>
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

// ─── TAB: MONITORING VISITS ─────────────────────────────────────────────────

const VISIT_TYPE_OPTIONS = [
  { value: "all", label: "All visit types" },
  { value: "initial", label: "Initial visit" },
  { value: "ongoing", label: "Ongoing monitoring" },
  { value: "inactive_check", label: "Inactive site check" },
];
const VISIT_STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "accepted", label: "Accepted" },
  { value: "pending", label: "Pending review" },
  { value: "rejected", label: "Changes requested" },
];
const VISIT_DEFAULTS = { search: "", visit_type: "all", status: "all", barangay: "all", date_from: "", date_to: "" };

export function VisitsTab({
  options,
  onSiteHistory,
  refreshKey,
}: {
  options: FilterOptions | null;
  onSiteHistory: (id: number) => void;
  refreshKey: number;
}) {
  const [f, setF] = useState(VISIT_DEFAULTS);
  const { data, loading, error, reload } = useReport<VisitsReport>("dm_report/visits/", f);
  useEffect(() => {
    if (refreshKey) reload();
  }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const paged = usePaged(data?.rows ?? []);
  const brgyOpts = barangayOptions(options);
  const isFiltered = JSON.stringify(f) !== JSON.stringify(VISIT_DEFAULTS);

  const handleExport = (kind: "pdf" | "excel") => {
    if (!data) return;
    const s = data.summary;
    const range = dateLabel(f.date_from, f.date_to);
    runExport<VisitRow>(kind, {
      title: "Monitoring Visits Report",
      filename: "monitoring_visits_report",
      filters: [
        ...describeFilters([
          ["Visit type", f.visit_type, VISIT_TYPE_OPTIONS],
          ["Status", f.status, VISIT_STATUS_OPTIONS],
          ["Barangay", f.barangay, brgyOpts],
          ["Search", f.search, null],
        ]),
        ...(range ? [["Date", range] as [string, string]] : []),
      ],
      summary: [
        ["Visits", fmt(s.total)],
        ["Accepted", fmt(s.accepted)],
        ["Pending review", fmt(s.pending)],
        ["Changes requested", fmt(s.rejected)],
        ["Initial visits", fmt(s.initial)],
        ["Ongoing visits", fmt(s.ongoing)],
        ["Inactive checks", fmt(s.inactive_check)],
        ["Sites visited", fmt(s.sites_visited)],
        ["Plants recorded (accepted)", fmt(s.planted_recorded)],
        ["Dead recorded (accepted)", fmt(s.dead_recorded)],
        ["Inspectors", fmt(s.inspectors)],
      ],
      sections: [
        {
          title: "Visits per inspector",
          columns: ["Inspector", "Visits", "Accepted"],
          rows: data.by_inspector.map((i) => [i.name, i.visits, i.accepted]),
        },
      ],
      recordsTitle: "Visits",
      columns: [
        { header: "Date", value: (r) => fmtDate(r.date) },
        { header: "Site", value: (r) => r.site_name },
        { header: "Barangay", value: (r) => r.barangay },
        { header: "Program", value: (r) => r.program },
        { header: "Group", value: (r) => r.group_name },
        { header: "Visit type", value: (r) => r.visit_label },
        { header: "Status", value: (r) => r.status },
        { header: "DM review", value: (r) => r.dm_review },
        { header: "GIS review", value: (r) => r.gis_review },
        { header: "Inspector", value: (r) => r.inspector },
        { header: "Planted", value: (r) => r.planted },
        { header: "Added", value: (r) => r.added },
        { header: "Dead", value: (r) => r.dead },
        { header: "Planted area", value: (r) => fmtHa(r.planted_hectares) },
      ],
      rows: data.rows,
    });
  };

  const s = data?.summary;

  return (
    <div className="space-y-5">
      <FilterBar onReset={() => setF(VISIT_DEFAULTS)} showReset={isFiltered}>
        <SearchFilter value={f.search} onChange={(v) => setF({ ...f, search: v })} placeholder="Site, program or group…" />
        <SelectFilter label="Visit type" value={f.visit_type} onChange={(v) => setF({ ...f, visit_type: v })} options={VISIT_TYPE_OPTIONS} />
        <SelectFilter label="Status" value={f.status} onChange={(v) => setF({ ...f, status: v })} options={VISIT_STATUS_OPTIONS} />
        <SelectFilter label="Barangay" value={f.barangay} onChange={(v) => setF({ ...f, barangay: v })} options={brgyOpts} />
        <DateRangeFilter from={f.date_from} to={f.date_to} onChange={(a, b) => setF({ ...f, date_from: a, date_to: b })} />
      </FilterBar>

      {error && !data ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : !data || !s ? (
        <LoadingBlock text="Building visits report…" />
      ) : (
        <div className={`space-y-5 transition-opacity ${loading ? "opacity-60" : ""}`}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Kpi icon={<ClipboardList size={16} />} label="Visits" value={fmt(s.total)} sub={`${s.sites_visited} sites · ${s.inspectors} inspectors`} />
            <Kpi
              icon={<CheckCircle2 size={16} />}
              label="Accepted"
              value={fmt(s.accepted)}
              sub={`${s.initial} initial · ${s.ongoing} ongoing · ${s.inactive_check} inactive checks`}
              accent="bg-green-600"
            />
            <Kpi
              icon={<Clock size={16} />}
              label="Pending / Changes Requested"
              value={`${s.pending} / ${s.rejected}`}
              sub="Waiting on review or resubmission"
              accent="bg-amber-500"
            />
            <Kpi
              icon={<Sprout size={16} />}
              label="Plants Recorded"
              value={fmt(s.planted_recorded)}
              sub={`${fmt(s.dead_recorded)} dead recorded (accepted visits)`}
              accent="bg-emerald-500"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <Card className="p-5 lg:col-span-2">
              <SectionTitle icon={<BarChart3 size={16} />} title="Visits per Month" sub="By review outcome" />
              {data.monthly.some((m) => m.accepted || m.pending || m.rejected) ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={data.monthly} barSize={20}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" vertical={false} />
                    <XAxis dataKey="month" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                    <Tooltip content={<GreenTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="accepted" name="Accepted" stackId="v" fill="#10b981" />
                    <Bar dataKey="pending" name="Pending" stackId="v" fill="#fbbf24" />
                    <Bar dataKey="rejected" name="Changes requested" stackId="v" fill="#f87171" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState text="No visits in this period" />
              )}
            </Card>
            <Card className="p-5">
              <SectionTitle icon={<Users size={16} />} title="Inspector Activity" sub="Visits submitted in this period" />
              {data.by_inspector.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {data.by_inspector.map((i) => {
                    const pct = i.visits ? Math.round((i.accepted / i.visits) * 100) : 0;
                    return (
                      <div key={i.name}>
                        <div className="flex items-center justify-between text-[12px] mb-1">
                          <span className="font-semibold text-gray-800 truncate">{i.name}</span>
                          <span className="text-gray-500">
                            {i.accepted}/{i.visits} accepted
                          </span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState text="No inspector activity" />
              )}
            </Card>
          </div>

          <Card>
            <div className="px-5 pt-5">
              <SectionTitle
                icon={<FileText size={16} />}
                title="Visit Log"
                sub="Every progress report submitted from the field"
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
                    <Th>Date</Th>
                    <Th>Site</Th>
                    <Th>Program</Th>
                    <Th>Type</Th>
                    <Th>Status</Th>
                    <Th>Reviews (DM / GIS)</Th>
                    <Th>Inspector</Th>
                    <Th right>Planted</Th>
                    <Th right>Added</Th>
                    <Th right>Dead</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paged.pageRows.length > 0 ? (
                    paged.pageRows.map((r) => (
                      <tr key={r.id} className="hover:bg-gray-50/70">
                        <Td className="whitespace-nowrap">{fmtDate(r.date)}</Td>
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
                          <p className="text-gray-800">{r.program ?? "—"}</p>
                          <p className="text-[11px] text-gray-400">{r.group_name ?? ""}</p>
                        </Td>
                        <Td className="whitespace-nowrap">{r.visit_label}</Td>
                        <Td>
                          <Badge
                            label={r.status === "rejected" ? "Changes requested" : r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                            tone={VISIT_TONE[r.status] ?? VISIT_TONE.pending}
                          />
                        </Td>
                        <Td className="text-[11.5px] whitespace-nowrap">
                          {r.dm_review} / {r.gis_review}
                        </Td>
                        <Td>{r.inspector}</Td>
                        <Td right>{fmt(r.planted)}</Td>
                        <Td right>{fmt(r.added)}</Td>
                        <Td right className="text-red-500">
                          {fmt(r.dead)}
                        </Td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={10}>
                        <EmptyState text="No visits match the filters" />
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

// ─── TAB: SPECIES ───────────────────────────────────────────────────────────

const SPECIES_DEFAULTS = { barangay: "all", date_from: "", date_to: "" };

export function SpeciesTab({ options, refreshKey }: { options: FilterOptions | null; refreshKey: number }) {
  const [f, setF] = useState(SPECIES_DEFAULTS);
  const { data, loading, error, reload } = useReport<SpeciesReport>("dm_report/species/", f);
  useEffect(() => {
    if (refreshKey) reload();
  }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const brgyOpts = barangayOptions(options);
  const isFiltered = JSON.stringify(f) !== JSON.stringify(SPECIES_DEFAULTS);
  const ranked = useMemo(
    () => (data?.rows ?? []).filter((r) => r.survival_rate !== null).sort((a, b) => (b.survival_rate ?? 0) - (a.survival_rate ?? 0)),
    [data],
  );

  const handleExport = (kind: "pdf" | "excel") => {
    if (!data) return;
    const s = data.summary;
    const range = dateLabel(f.date_from, f.date_to);
    runExport<SpeciesRow>(kind, {
      title: "Species Performance Report",
      filename: "species_report",
      filters: [
        ...describeFilters([["Barangay", f.barangay, brgyOpts]]),
        ...(range ? [["Date", range] as [string, string]] : []),
      ],
      summary: [
        ["Species", fmt(s.species_count)],
        ["Seedlings released", fmt(s.endorsed)],
        ["Plants planted", fmt(s.planted)],
        ["Plants alive", fmt(s.survived)],
        ["Dead", fmt(s.dead)],
        ["Survival rate", fmtPct(s.survival_rate)],
        ["Best survival", s.best_species ?? "—"],
        ["Lowest survival", s.worst_species ?? "—"],
      ],
      recordsTitle: "Species",
      columns: [
        { header: "Species", value: (r) => r.name },
        { header: "Released", value: (r) => r.endorsed },
        { header: "Planted (incl. added)", value: (r) => r.planted },
        { header: "Added by growers", value: (r) => r.added_by_grower },
        { header: "Alive", value: (r) => r.survived },
        { header: "Dead", value: (r) => r.dead },
        { header: "Survival", value: (r) => fmtPct(r.survival_rate) },
        { header: "Sites", value: (r) => r.sites },
      ],
      rows: data.rows,
    });
  };

  const s = data?.summary;

  return (
    <div className="space-y-5">
      <FilterBar onReset={() => setF(SPECIES_DEFAULTS)} showReset={isFiltered}>
        <SelectFilter label="Barangay" value={f.barangay} onChange={(v) => setF({ ...f, barangay: v })} options={brgyOpts} />
        <DateRangeFilter from={f.date_from} to={f.date_to} onChange={(a, b) => setF({ ...f, date_from: a, date_to: b })} />
      </FilterBar>

      {error && !data ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : !data || !s ? (
        <LoadingBlock text="Building species report…" />
      ) : (
        <div className={`space-y-5 transition-opacity ${loading ? "opacity-60" : ""}`}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Kpi icon={<Leaf size={16} />} label="Species Planted" value={fmt(s.species_count)} sub={`${fmt(s.endorsed)} seedlings released`} />
            <Kpi icon={<Sprout size={16} />} label="Plants Planted" value={fmt(s.planted)} sub={`${fmt(s.survived)} alive · ${fmt(s.dead)} dead`} accent="bg-emerald-500" />
            <Kpi
              icon={<Activity size={16} />}
              label="Survival Rate"
              value={fmtPct(s.survival_rate)}
              valueColor={rateColor(s.survival_rate)}
              sub={`Target ${SURVIVAL_TARGET}%`}
              accent="bg-green-500"
            />
            <Kpi
              icon={<Trophy size={16} />}
              label="Best Survival"
              value={<span className="text-[18px]">{s.best_species ?? "—"}</span>}
              sub={s.worst_species ? `Lowest: ${s.worst_species}` : "Needs at least 10 plants per species"}
              accent="bg-amber-500"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card className="p-5">
              <SectionTitle icon={<Package size={16} />} title="Released vs Planted" sub="Seedlings released compared with plants recorded in visits" />
              {data.rows.length > 0 ? (
                <ResponsiveContainer width="100%" height={Math.max(200, data.rows.length * 36)}>
                  <BarChart data={data.rows} layout="vertical" barGap={2} barSize={10}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" horizontal={false} />
                    <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <Tooltip content={<GreenTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="endorsed" name="Released" fill="#a5b4fc" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="planted" name="Planted" fill="#10b981" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState text="No species data" />
              )}
            </Card>
            <Card className="p-5">
              <SectionTitle icon={<Activity size={16} />} title="Survival by Species" sub="Use this to choose species for new programs" />
              {ranked.length > 0 ? (
                <ResponsiveContainer width="100%" height={Math.max(200, ranked.length * 36)}>
                  <BarChart data={ranked} layout="vertical" barSize={14}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} unit="%" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <Tooltip content={<GreenTooltip />} />
                    <ReferenceLine x={SURVIVAL_TARGET} stroke="#f59e0b" strokeDasharray="4 4" />
                    <Bar dataKey="survival_rate" name="Survival %" radius={[0, 4, 4, 0]}>
                      {ranked.map((r, i) => (
                        <Cell key={i} fill={rateColor(r.survival_rate)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState text="No survival data" />
              )}
            </Card>
          </div>

          <Card>
            <div className="px-5 pt-5">
              <SectionTitle
                icon={<FileText size={16} />}
                title="Species Records"
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
                    <Th>Species</Th>
                    <Th right>Released</Th>
                    <Th right>Planted</Th>
                    <Th right>Added by Growers</Th>
                    <Th right>Alive</Th>
                    <Th right>Dead</Th>
                    <Th>Survival</Th>
                    <Th right>Sites</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.rows.length > 0 ? (
                    data.rows.map((r) => (
                      <tr key={r.name} className="hover:bg-gray-50/70">
                        <Td className="font-semibold text-gray-800">{r.name}</Td>
                        <Td right>{fmt(r.endorsed)}</Td>
                        <Td right>{fmt(r.planted)}</Td>
                        <Td right>{fmt(r.added_by_grower)}</Td>
                        <Td right className="text-emerald-600 font-semibold">
                          {fmt(r.survived)}
                        </Td>
                        <Td right className="text-red-500">
                          {fmt(r.dead)}
                        </Td>
                        <Td>
                          <RateBar rate={r.survival_rate} />
                        </Td>
                        <Td right>{r.sites}</Td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8}>
                        <EmptyState text="No species data for these filters" />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// ─── Main page ──────────────────────────────────────────────────────────────

type TabKey = "programs" | "sites" | "visits" | "species";

const TABS: { key: TabKey; label: string; icon: ReactElement; sub: string }[] = [
  { key: "programs", label: "Programs", icon: <ClipboardList size={15} />, sub: "Program outcomes, completed and failed programs, survival and duration" },
  { key: "sites", label: "Sites", icon: <TreePine size={15} />, sub: "Official site statuses, area, current programs and site history" },
  { key: "visits", label: "Monitoring Visits", icon: <MonitorDot size={15} />, sub: "Field visit log, review outcomes and inspector activity" },
  { key: "species", label: "Species", icon: <Leaf size={15} />, sub: "Seedlings released vs planted and survival per species" },
];

export default function Reports() {
  const [tab, setTab] = useState<TabKey>(() => {
    try {
      return (localStorage.getItem("dm_reports_tab") as TabKey) || "programs";
    } catch {
      return "programs";
    }
  });
  const [options, setOptions] = useState<FilterOptions | null>(null);
  const [historySiteId, setHistorySiteId] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    try {
      localStorage.setItem("dm_reports_tab", tab);
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
        /* filters still work without barangay names */
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
              <BarChart3 size={24} /> Reports
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

        {tab === "programs" && <ProgramsTab options={options} onSiteHistory={setHistorySiteId} refreshKey={refreshKey} />}
        {tab === "sites" && <SitesTab options={options} onSiteHistory={setHistorySiteId} refreshKey={refreshKey} />}
        {tab === "visits" && <VisitsTab options={options} onSiteHistory={setHistorySiteId} refreshKey={refreshKey} />}
        {tab === "species" && <SpeciesTab options={options} refreshKey={refreshKey} />}
      </main>

      {historySiteId !== null && <SiteHistoryModal siteId={historySiteId} onClose={() => setHistorySiteId(null)} />}
    </div>
  );
}
