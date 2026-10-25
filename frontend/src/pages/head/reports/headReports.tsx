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
  BarChart3,
  CheckCircle2,
  ClipboardList,
  FileText,
  Gavel,
  History,
  Leaf,
  ListChecks,
  Loader2,
  MapPin,
  MonitorDot,
  RefreshCw,
  Sparkles,
  Sprout,
  TreePine,
  Users,
} from "lucide-react";
import NotFoundPage from "../../../components/layout/NotFoundPage";
import { api } from "@/constant/api.ts";
import { exportCsv, exportPdf, type ExportSpec } from "../../dataManager/reports/reportExport";
import SiteHistoryModal from "../../dataManager/reports/SiteHistoryModal";
import {
  ProgramsTab,
  SitesTab,
  SpeciesTab,
  VisitsTab,
  type FilterOptions,
} from "../../dataManager/reports/reports";
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
  RateBar,
  SearchFilter,
  SectionTitle,
  SelectFilter,
  Td,
  Th,
  fmt,
  fmtDate,
  fmtHa,
  fmtPct,
  usePaged,
  useReport,
} from "../../dataManager/reports/reportUi";

// ─── Types ──────────────────────────────────────────────────────────────────

interface SummaryReport {
  summary: {
    applications_submitted: number;
    applications_approved: number;
    rejected_cancelled: number;
    programs_completed: number;
    programs_failed: number;
    success_rate: number | null;
    avg_completion_days: number | null;
    active_programs_now: number;
    seedlings_released: number;
    plants_planted: number;
    plants_added_by_growers: number;
    plants_dead: number;
    sites_planted: number;
    visits: number;
    planted_hectares_end: number;
    planted_hectares_added: number;
    survival_rate_end: number | null;
    plants_alive_end: number;
    plants_total_end: number;
    new_sites: number;
    sites_verified: number;
    official_sites_now: number;
    new_groups: number;
    field_assessments: number;
  };
  highlights: string[];
  monthly: { month: string; submitted: number; approved: number; completed: number; failed: number; planted: number; dead: number; visits: number }[];
  by_barangay: { name: string; approved: number; completed: number; failed: number; active_now: number; planted: number; dead: number; visits: number; survival_rate: number | null }[];
  species: { name: string; planted: number; alive: number; dead: number; survival_rate: number | null }[];
  completed_programs: {
    ref: string;
    title: string;
    group_name: string;
    site_name: string | null;
    barangay: string | null;
    status: string;
    status_label: string;
    closed: string | null;
    duration_days: number | null;
    planted: number;
    survival_rate: number | null;
  }[];
}

interface GrowerRow {
  group_id: number;
  group_name: string;
  group_type: string;
  contact: string;
  address: string;
  email: string | null;
  joined: string | null;
  programs: number;
  active: number;
  completed: number;
  failed: number;
  rejected: number;
  current_site: string | null;
  current_site_id: number | null;
  barangays: string[];
  seedlings_released: number;
  planted: number;
  alive: number;
  dead: number;
  survival_rate: number | null;
  visits: number;
  last_visit: string | null;
  days_since_visit: number | null;
  compliance: string;
  standing: string;
}

interface GrowersReport {
  summary: {
    total: number;
    active: number;
    excellent: number;
    good: number;
    needs_attention: number;
    new: number;
    compliant: number;
    warning: number;
    non_compliant: number;
    programs: number;
    completed: number;
    failed: number;
    seedlings_released: number;
    planted: number;
    alive: number;
    survival_rate: number | null;
  };
  standing_breakdown: { name: string; value: number; fill: string }[];
  rows: GrowerRow[];
}

interface DecisionRow {
  kind: "application" | "closure";
  kind_label: string;
  date: string | null;
  ref: string;
  title: string;
  group_name: string;
  site_id: number | null;
  site_name: string | null;
  barangay: string | null;
  decision: string;
  outcome_key: string;
  recommendation?: string;
  agreed_with_recommendation?: boolean;
  notes: string | null;
  decided_by: string;
  requested_by?: string;
  turnaround_days: number | null;
  current_status: string;
}

interface DecisionsReport {
  summary: {
    total: number;
    approved: number;
    rejected: number;
    returned: number;
    closures: number;
    closures_completed: number;
    closures_failed: number;
    agreed_with_dm: number;
    avg_turnaround_days: number | null;
  };
  monthly: { month: string; approved: number; rejected: number; returned: number; closures: number }[];
  rows: DecisionRow[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function barangayOptions(options: FilterOptions | null) {
  return [{ value: "all", label: "All barangays" }, ...(options?.barangays ?? []).map((b) => ({ value: String(b.id), label: b.name }))];
}

function optionLabel(opts: { value: string; label: string }[], v: string) {
  return opts.find((o) => o.value === v)?.label ?? v;
}

function dateLabel(from: string, to: string) {
  const preset = DATE_PRESETS.find((p) => {
    const [f, t] = p.range();
    return f === from && t === to;
  });
  if (preset && preset.key !== "all") return `${preset.label} (${fmtDate(from)} – ${fmtDate(to)})`;
  if (!from && !to) return "All time";
  return `${from ? fmtDate(from) : "Start"} – ${to ? fmtDate(to) : "Present"}`;
}

function describeFilters(entries: [string, string, { value: string; label: string }[] | null][]) {
  return entries.filter(([, v]) => v && v !== "all").map(([l, v, o]) => [l, o ? optionLabel(o, v) : v] as [string, string]);
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

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="py-2">
      <p className="text-[11px] text-gray-400">{label}</p>
      <p className="text-[18px] font-bold text-gray-800 leading-tight">{value}</p>
      {sub && <p className="text-[10.5px] text-gray-400">{sub}</p>}
    </div>
  );
}

// ─── TAB: ACCOMPLISHMENT SUMMARY ────────────────────────────────────────────

const thisYear = DATE_PRESETS.find((p) => p.key === "year")!.range();
const SUMMARY_DEFAULTS = { barangay: "all", date_from: thisYear[0], date_to: thisYear[1] };

function SummaryTab({ options, refreshKey }: { options: FilterOptions | null; refreshKey: number }) {
  const [f, setF] = useState(SUMMARY_DEFAULTS);
  const { data, loading, error, reload } = useReport<SummaryReport>("head_report/summary/", f);
  useRefresh(refreshKey, reload);
  const brgyOpts = barangayOptions(options);
  const isFiltered = JSON.stringify(f) !== JSON.stringify(SUMMARY_DEFAULTS);
  const period = dateLabel(f.date_from, f.date_to);

  const handleExport = (kind: "pdf" | "excel") => {
    if (!data) return;
    const s = data.summary;
    runExport(kind, {
      title: "Reforestation Accomplishment Report",
      filename: "accomplishment_report",
      filters: [["Period", period], ...describeFilters([["Barangay", f.barangay, brgyOpts]])],
      summary: [
        ["Applications submitted", fmt(s.applications_submitted)],
        ["Applications approved", fmt(s.applications_approved)],
        ["Rejected / cancelled", fmt(s.rejected_cancelled)],
        ["Programs completed", fmt(s.programs_completed)],
        ["Programs failed", fmt(s.programs_failed)],
        ["Program success rate", fmtPct(s.success_rate)],
        ["Active programs (now)", fmt(s.active_programs_now)],
        ["Seedlings released", fmt(s.seedlings_released)],
        ["Plants planted (period)", fmt(s.plants_planted)],
        ["Deaths recorded (period)", fmt(s.plants_dead)],
        ["Planted area added", fmtHa(s.planted_hectares_added)],
        ["Total planted area (end)", fmtHa(s.planted_hectares_end)],
        ["Survival rate (end)", fmtPct(s.survival_rate_end)],
        ["Plants alive (end)", `${fmt(s.plants_alive_end)} of ${fmt(s.plants_total_end)}`],
        ["Monitoring visits", fmt(s.visits)],
        ["New sites / verified", `${s.new_sites} / ${s.sites_verified}`],
        ["New tree grower groups", fmt(s.new_groups)],
        ["Field assessments", fmt(s.field_assessments)],
      ],
      sections: [
        { title: "Highlights", columns: ["Highlight"], rows: data.highlights.map((h) => [h]) },
        {
          title: "Monthly breakdown",
          columns: ["Month", "Submitted", "Approved", "Completed", "Failed", "Plants planted", "Deaths", "Visits"],
          rows: data.monthly.map((m) => [m.month, m.submitted, m.approved, m.completed, m.failed, fmt(m.planted), fmt(m.dead), m.visits]),
        },
        {
          title: "By barangay",
          columns: ["Barangay", "Approved", "Completed", "Failed", "Active now", "Plants planted", "Deaths", "Survival"],
          rows: data.by_barangay.map((b) => [b.name, b.approved, b.completed, b.failed, b.active_now, fmt(b.planted), fmt(b.dead), fmtPct(b.survival_rate)]),
        },
        {
          title: "Species planted",
          columns: ["Species", "Planted", "Alive", "Dead", "Survival"],
          rows: data.species.map((sp) => [sp.name, fmt(sp.planted), fmt(sp.alive), fmt(sp.dead), fmtPct(sp.survival_rate)]),
        },
      ],
      recordsTitle: "Programs closed in this period",
      columns: [
        { header: "Ref", value: (r) => r.ref },
        { header: "Program", value: (r) => r.title },
        { header: "Group", value: (r) => r.group_name },
        { header: "Site", value: (r) => r.site_name },
        { header: "Barangay", value: (r) => r.barangay },
        { header: "Outcome", value: (r) => r.status_label },
        { header: "Closed", value: (r) => fmtDate(r.closed) },
        { header: "Duration (days)", value: (r) => r.duration_days },
        { header: "Planted", value: (r) => r.planted },
        { header: "Survival", value: (r) => fmtPct(r.survival_rate) },
      ],
      rows: data.completed_programs,
    });
  };

  const s = data?.summary;

  return (
    <div className="space-y-5">
      <FilterBar onReset={() => setF(SUMMARY_DEFAULTS)} showReset={isFiltered}>
        <DateRangeFilter label="Report period" from={f.date_from} to={f.date_to} onChange={(a, b) => setF({ ...f, date_from: a, date_to: b })} />
        <SelectFilter label="Barangay" value={f.barangay} onChange={(v) => setF({ ...f, barangay: v })} options={brgyOpts} />
      </FilterBar>

      {error && !data ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : !data || !s ? (
        <LoadingBlock text="Building accomplishment report…" />
      ) : (
        <div className={`space-y-5 transition-opacity ${loading ? "opacity-60" : ""}`}>
          <Card className="p-5">
            <SectionTitle
              icon={<Sparkles size={16} />}
              title={`Accomplishments — ${period}`}
              sub="What the office achieved in this period"
              right={<ExportButtons onPdf={() => handleExport("pdf")} onExcel={() => handleExport("excel")} disabled={false} count={data.completed_programs.length} />}
            />
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
              {data.highlights.map((h, i) => (
                <li key={i} className="flex items-start gap-2 text-[13px] text-gray-700">
                  <CheckCircle2 size={14} className="text-emerald-600 mt-0.5 shrink-0" /> {h}
                </li>
              ))}
            </ul>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <Card className="p-5">
              <p className="text-[13px] font-bold text-gray-800 flex items-center gap-2 mb-1">
                <ClipboardList size={15} className="text-[#0F4A2F]" /> Programs
              </p>
              <div className="grid grid-cols-2 gap-x-4 divide-y divide-gray-50">
                <Stat label="Applications submitted" value={fmt(s.applications_submitted)} />
                <Stat label="Approved by Head" value={fmt(s.applications_approved)} />
                <Stat label="Completed" value={fmt(s.programs_completed)} />
                <Stat label="Failed" value={fmt(s.programs_failed)} />
                <Stat label="Success rate" value={fmtPct(s.success_rate)} sub="Completed vs failed" />
                <Stat label="Active now" value={fmt(s.active_programs_now)} sub={`${s.rejected_cancelled} rejected/cancelled`} />
              </div>
            </Card>
            <Card className="p-5">
              <p className="text-[13px] font-bold text-gray-800 flex items-center gap-2 mb-1">
                <Sprout size={15} className="text-[#0F4A2F]" /> Planting & Survival
              </p>
              <div className="grid grid-cols-2 gap-x-4 divide-y divide-gray-50">
                <Stat label="Plants planted" value={fmt(s.plants_planted)} sub={`${fmt(s.plants_added_by_growers)} added by growers`} />
                <Stat label="Deaths recorded" value={fmt(s.plants_dead)} />
                <Stat label="Planted area added" value={fmtHa(s.planted_hectares_added)} sub={`Total ${fmtHa(s.planted_hectares_end)}`} />
                <Stat label="Survival at period end" value={fmtPct(s.survival_rate_end)} sub={`${fmt(s.plants_alive_end)} of ${fmt(s.plants_total_end)} alive`} />
                <Stat label="Sites planted" value={fmt(s.sites_planted)} />
                <Stat label="Seedlings released" value={fmt(s.seedlings_released)} />
              </div>
            </Card>
            <Card className="p-5">
              <p className="text-[13px] font-bold text-gray-800 flex items-center gap-2 mb-1">
                <TreePine size={15} className="text-[#0F4A2F]" /> Sites & Field Work
              </p>
              <div className="grid grid-cols-2 gap-x-4 divide-y divide-gray-50">
                <Stat label="New sites mapped" value={fmt(s.new_sites)} />
                <Stat label="Sites verified" value={fmt(s.sites_verified)} sub={`${s.official_sites_now} official now`} />
                <Stat label="Monitoring visits" value={fmt(s.visits)} sub="Accepted" />
                <Stat label="Field assessments" value={fmt(s.field_assessments)} />
                <Stat label="New tree grower groups" value={fmt(s.new_groups)} />
                <Stat label="Avg. days to complete" value={s.avg_completion_days !== null ? s.avg_completion_days : "—"} />
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card className="p-5">
              <SectionTitle icon={<BarChart3 size={16} />} title="Programs per Month" />
              {data.monthly.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={data.monthly} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" vertical={false} />
                    <XAxis dataKey="month" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                    <Tooltip content={<GreenTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="submitted" name="Submitted" fill="#c7d2fe" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="approved" name="Approved" fill="#38bdf8" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="completed" name="Completed" fill="#10b981" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="failed" name="Failed" fill="#f87171" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState text="No activity in this period" />
              )}
            </Card>
            <Card className="p-5">
              <SectionTitle icon={<Sprout size={16} />} title="Planting per Month" sub="Plants recorded and deaths, with accepted visits" />
              {data.monthly.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <ComposedChart data={data.monthly}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" vertical={false} />
                    <XAxis dataKey="month" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="n" allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="v" orientation="right" allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                    <Tooltip content={<GreenTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar yAxisId="n" dataKey="planted" name="Plants planted" fill="#34d399" radius={[3, 3, 0, 0]} />
                    <Bar yAxisId="n" dataKey="dead" name="Deaths" fill="#fca5a5" radius={[3, 3, 0, 0]} />
                    <Line yAxisId="v" type="monotone" dataKey="visits" name="Visits" stroke="#0F4A2F" strokeWidth={2} dot={{ r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState text="No planting in this period" />
              )}
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card>
              <div className="px-5 pt-5">
                <SectionTitle icon={<MapPin size={16} />} title="By Barangay" />
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <Th>Barangay</Th>
                      <Th right>Approved</Th>
                      <Th right>Done / Failed</Th>
                      <Th right>Planted</Th>
                      <Th>Survival</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.by_barangay.length > 0 ? (
                      data.by_barangay.map((b) => (
                        <tr key={b.name}>
                          <Td className="font-semibold text-gray-800">{b.name}</Td>
                          <Td right>{b.approved}</Td>
                          <Td right>
                            {b.completed} / {b.failed}
                          </Td>
                          <Td right>{fmt(b.planted)}</Td>
                          <Td>
                            <RateBar rate={b.survival_rate} />
                          </Td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5}>
                          <EmptyState text="No activity in this period" className="py-8" />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
            <Card>
              <div className="px-5 pt-5">
                <SectionTitle icon={<Leaf size={16} />} title="Species Planted" />
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <Th>Species</Th>
                      <Th right>Planted</Th>
                      <Th right>Dead</Th>
                      <Th>Survival</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.species.length > 0 ? (
                      data.species.map((sp) => (
                        <tr key={sp.name}>
                          <Td className="font-semibold text-gray-800">{sp.name}</Td>
                          <Td right>{fmt(sp.planted)}</Td>
                          <Td right className="text-red-500">
                            {fmt(sp.dead)}
                          </Td>
                          <Td>
                            <RateBar rate={sp.survival_rate} />
                          </Td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4}>
                          <EmptyState text="No planting in this period" className="py-8" />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          <Card>
            <div className="px-5 pt-5">
              <SectionTitle icon={<FileText size={16} />} title="Programs Closed in This Period" />
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <Th>Program</Th>
                    <Th>Site</Th>
                    <Th>Outcome</Th>
                    <Th>Closed</Th>
                    <Th right>Planted</Th>
                    <Th>Survival</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.completed_programs.length > 0 ? (
                    data.completed_programs.map((p) => (
                      <tr key={p.ref}>
                        <Td>
                          <p className="text-[11px] text-gray-400 font-semibold">{p.ref}</p>
                          <p className="font-semibold text-gray-800">{p.title}</p>
                          <p className="text-[11px] text-gray-500">{p.group_name}</p>
                        </Td>
                        <Td>
                          <p>{p.site_name ?? "—"}</p>
                          <p className="text-[11px] text-gray-400">{p.barangay ?? "—"}</p>
                        </Td>
                        <Td>
                          <Badge
                            label={p.status_label}
                            tone={p.status === "completed" ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"}
                          />
                        </Td>
                        <Td className="whitespace-nowrap">{fmtDate(p.closed)}</Td>
                        <Td right>{fmt(p.planted)}</Td>
                        <Td>
                          <RateBar rate={p.survival_rate} />
                        </Td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6}>
                        <EmptyState text="No programs closed in this period" className="py-8" />
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

// ─── TAB: TREE GROWERS ──────────────────────────────────────────────────────

const STANDING_OPTIONS = [
  { value: "all", label: "All" },
  { value: "Excellent", label: "Excellent" },
  { value: "Good", label: "Good" },
  { value: "Needs attention", label: "Needs attention" },
  { value: "New", label: "New (no programs)" },
];
const COMPLIANCE_OPTIONS = [
  { value: "all", label: "All" },
  { value: "Compliant", label: "Compliant" },
  { value: "Warning", label: "Warning" },
  { value: "Non-Compliant", label: "Non-compliant" },
  { value: "No active program", label: "No active program" },
];
const GROUP_TYPE_OPTIONS = [
  { value: "all", label: "All types" },
  { value: "formal_org", label: "Formal organization" },
  { value: "community_group", label: "Community group" },
  { value: "informal_group", label: "Informal group" },
];
const STANDING_TONE: Record<string, string> = {
  Excellent: "bg-green-50 text-green-700 border-green-200",
  Good: "bg-sky-50 text-sky-700 border-sky-200",
  "Needs attention": "bg-red-50 text-red-700 border-red-200",
  New: "bg-gray-50 text-gray-600 border-gray-200",
};
const COMPLIANCE_TONE: Record<string, string> = {
  Compliant: "text-emerald-600",
  Warning: "text-amber-600",
  "Non-Compliant": "text-red-600",
  "No active program": "text-gray-400",
};
const GROWER_DEFAULTS = { search: "", standing: "all", compliance: "all", barangay: "all", group_type: "all", date_from: "", date_to: "" };

function GrowersTab({
  options,
  onSiteHistory,
  refreshKey,
}: {
  options: FilterOptions | null;
  onSiteHistory: (id: number) => void;
  refreshKey: number;
}) {
  const [f, setF] = useState(GROWER_DEFAULTS);
  const { data, loading, error, reload } = useReport<GrowersReport>("head_report/growers/", f);
  useRefresh(refreshKey, reload);
  const paged = usePaged(data?.rows ?? []);
  const brgyOpts = barangayOptions(options);
  const isFiltered = JSON.stringify(f) !== JSON.stringify(GROWER_DEFAULTS);

  const handleExport = (kind: "pdf" | "excel") => {
    if (!data) return;
    const s = data.summary;
    const range = f.date_from || f.date_to ? dateLabel(f.date_from, f.date_to) : "";
    runExport<GrowerRow>(kind, {
      title: "Tree Grower Groups Report",
      filename: "tree_grower_groups",
      filters: [
        ...describeFilters([
          ["Standing", f.standing, STANDING_OPTIONS],
          ["Compliance", f.compliance, COMPLIANCE_OPTIONS],
          ["Barangay", f.barangay, brgyOpts],
          ["Group type", f.group_type, GROUP_TYPE_OPTIONS],
          ["Search", f.search, null],
        ]),
        ...(range ? [["Joined", range] as [string, string]] : []),
      ],
      summary: [
        ["Groups", fmt(s.total)],
        ["With an active program", fmt(s.active)],
        ["Excellent / Good", `${s.excellent} / ${s.good}`],
        ["Needs attention", fmt(s.needs_attention)],
        ["Compliant / Warning / Non-compliant", `${s.compliant} / ${s.warning} / ${s.non_compliant}`],
        ["Programs (completed / failed)", `${s.programs} (${s.completed} / ${s.failed})`],
        ["Seedlings released", fmt(s.seedlings_released)],
        ["Plants planted / alive", `${fmt(s.planted)} / ${fmt(s.alive)}`],
        ["Survival (program visits)", fmtPct(s.survival_rate)],
      ],
      recordsTitle: "Groups",
      columns: [
        { header: "Group", value: (r) => r.group_name },
        { header: "Type", value: (r) => r.group_type },
        { header: "Contact", value: (r) => r.contact },
        { header: "Joined", value: (r) => fmtDate(r.joined) },
        { header: "Barangays", value: (r) => r.barangays.join(", ") },
        { header: "Programs", value: (r) => r.programs },
        { header: "Active", value: (r) => r.active },
        { header: "Completed", value: (r) => r.completed },
        { header: "Failed", value: (r) => r.failed },
        { header: "Current site", value: (r) => r.current_site },
        { header: "Released", value: (r) => r.seedlings_released },
        { header: "Planted", value: (r) => r.planted },
        { header: "Survival", value: (r) => fmtPct(r.survival_rate) },
        { header: "Last visit", value: (r) => fmtDate(r.last_visit) },
        { header: "Compliance", value: (r) => r.compliance },
        { header: "Standing", value: (r) => r.standing },
      ],
      rows: data.rows,
    });
  };

  const s = data?.summary;

  return (
    <div className="space-y-5">
      <FilterBar onReset={() => setF(GROWER_DEFAULTS)} showReset={isFiltered}>
        <SearchFilter value={f.search} onChange={(v) => setF({ ...f, search: v })} placeholder="Group or current site…" />
        <SelectFilter label="Standing" value={f.standing} onChange={(v) => setF({ ...f, standing: v })} options={STANDING_OPTIONS} />
        <SelectFilter label="Compliance" value={f.compliance} onChange={(v) => setF({ ...f, compliance: v })} options={COMPLIANCE_OPTIONS} />
        <SelectFilter label="Barangay" value={f.barangay} onChange={(v) => setF({ ...f, barangay: v })} options={brgyOpts} />
        <SelectFilter label="Group type" value={f.group_type} onChange={(v) => setF({ ...f, group_type: v })} options={GROUP_TYPE_OPTIONS} />
        <DateRangeFilter label="Joined" from={f.date_from} to={f.date_to} onChange={(a, b) => setF({ ...f, date_from: a, date_to: b })} />
      </FilterBar>

      {error && !data ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : !data || !s ? (
        <LoadingBlock text="Building tree grower report…" />
      ) : (
        <div className={`space-y-5 transition-opacity ${loading ? "opacity-60" : ""}`}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Kpi icon={<Users size={16} />} label="Groups" value={fmt(s.total)} sub={`${s.active} with an active program`} />
            <Kpi icon={<CheckCircle2 size={16} />} label="Excellent / Good" value={`${s.excellent} / ${s.good}`} sub={`${s.new} new (no programs yet)`} accent="bg-green-600" />
            <Kpi
              icon={<ListChecks size={16} />}
              label="Needs Attention"
              value={fmt(s.needs_attention)}
              valueColor={s.needs_attention > 0 ? "#ef4444" : undefined}
              sub={`${s.non_compliant} non-compliant · ${s.warning} warning`}
              accent="bg-red-500"
            />
            <Kpi icon={<Sprout size={16} />} label="Plants Planted" value={fmt(s.planted)} sub={`${fmt(s.alive)} alive · ${fmtPct(s.survival_rate)} survival`} accent="bg-emerald-500" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <Card className="p-5">
              <SectionTitle icon={<Users size={16} />} title="Group Standing" />
              {data.standing_breakdown.some((b) => b.value > 0) ? (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={data.standing_breakdown.filter((b) => b.value > 0)} dataKey="value" nameKey="name" outerRadius={66} innerRadius={38} paddingAngle={2}>
                        {data.standing_breakdown
                          .filter((b) => b.value > 0)
                          .map((b, i) => (
                            <Cell key={i} fill={b.fill} />
                          ))}
                      </Pie>
                      <Tooltip content={<GreenTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-col gap-1.5 mt-2">
                    {data.standing_breakdown.map((b) => (
                      <div key={b.name} className="flex items-center gap-2 text-[12px]">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: b.fill }} />
                        <span className="text-gray-600">{b.name}</span>
                        <span className="ml-auto font-bold text-gray-800">{b.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <EmptyState text="No groups" />
              )}
              <p className="text-[10.5px] text-gray-400 mt-3">
                Excellent: ≥ 80% survival, no failed programs. Needs attention: below 50% survival, more failed than completed programs, or
                no visit in 90+ days while active.
              </p>
            </Card>
            <Card className="p-5 lg:col-span-2">
              <SectionTitle icon={<BarChart3 size={16} />} title="Programs per Group" sub="Active, completed and failed programs" />
              {data.rows.some((r) => r.programs > 0) ? (
                <ResponsiveContainer width="100%" height={Math.max(180, data.rows.filter((r) => r.programs > 0).length * 34)}>
                  <BarChart data={data.rows.filter((r) => r.programs > 0)} layout="vertical" barSize={14}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="group_name" width={120} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <Tooltip content={<GreenTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="active" name="Active" stackId="p" fill="#818cf8" />
                    <Bar dataKey="completed" name="Completed" stackId="p" fill="#10b981" />
                    <Bar dataKey="failed" name="Failed" stackId="p" fill="#f87171" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState text="No programs yet" />
              )}
            </Card>
          </div>

          <Card>
            <div className="px-5 pt-5">
              <SectionTitle
                icon={<FileText size={16} />}
                title="Group Records"
                sub="Survival here counts only visits linked to each group's programs"
                right={<ExportButtons onPdf={() => handleExport("pdf")} onExcel={() => handleExport("excel")} disabled={data.rows.length === 0} count={data.rows.length} />}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <Th>Group</Th>
                    <Th>Programs</Th>
                    <Th>Current Site</Th>
                    <Th right>Released</Th>
                    <Th right>Planted</Th>
                    <Th>Survival</Th>
                    <Th>Compliance</Th>
                    <Th>Standing</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paged.pageRows.length > 0 ? (
                    paged.pageRows.map((r) => (
                      <tr key={r.group_id} className="hover:bg-gray-50/70 align-top">
                        <Td>
                          <p className="font-semibold text-gray-800">{r.group_name}</p>
                          <p className="text-[11px] text-gray-400">
                            {r.group_type} · joined {fmtDate(r.joined)}
                          </p>
                          <p className="text-[11px] text-gray-400">{r.contact}</p>
                        </Td>
                        <Td>
                          <p className="font-semibold">{r.programs}</p>
                          <p className="text-[11px] text-gray-400 whitespace-nowrap">
                            {r.active} active · {r.completed} done · {r.failed} failed
                          </p>
                        </Td>
                        <Td>
                          {r.current_site_id ? (
                            <button onClick={() => onSiteHistory(r.current_site_id!)} className="text-left text-emerald-700 hover:underline flex items-center gap-1">
                              <History size={11} /> {r.current_site}
                            </button>
                          ) : (
                            <span className="text-[11px] text-gray-400">{r.barangays.join(", ") || "—"}</span>
                          )}
                        </Td>
                        <Td right>{fmt(r.seedlings_released)}</Td>
                        <Td right>
                          <p>{fmt(r.planted)}</p>
                          <p className="text-[11px] text-gray-400">{fmt(r.alive)} alive</p>
                        </Td>
                        <Td>
                          <RateBar rate={r.survival_rate} />
                        </Td>
                        <Td>
                          <p className={`font-semibold text-[12px] ${COMPLIANCE_TONE[r.compliance] ?? "text-gray-600"}`}>{r.compliance}</p>
                          <p className="text-[11px] text-gray-400">{r.days_since_visit !== null ? `Last visit ${r.days_since_visit}d ago` : "No visits"}</p>
                        </Td>
                        <Td>
                          <Badge label={r.standing} tone={STANDING_TONE[r.standing] ?? STANDING_TONE.New} />
                        </Td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8}>
                        <EmptyState text="No groups match the filters" />
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

// ─── TAB: MY DECISIONS ──────────────────────────────────────────────────────

const KIND_OPTIONS = [
  { value: "all", label: "All decisions" },
  { value: "application", label: "Applications" },
  { value: "closure", label: "Program closures" },
];
const OUTCOME_OPTIONS = [
  { value: "all", label: "All outcomes" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected / cancelled" },
  { value: "returned", label: "Returned to Data Manager" },
  { value: "closure_completed", label: "Closed as completed" },
  { value: "closure_failed", label: "Closed as failed" },
];
const OUTCOME_TONE: Record<string, string> = {
  approved: "bg-green-50 text-green-700 border-green-200",
  closure_completed: "bg-green-50 text-green-700 border-green-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
  closure_failed: "bg-red-50 text-red-700 border-red-200",
  returned: "bg-amber-50 text-amber-700 border-amber-200",
  other: "bg-gray-50 text-gray-600 border-gray-200",
};
const DECISION_DEFAULTS = { search: "", kind: "all", outcome: "all", date_from: "", date_to: "" };

function DecisionsTab({ onSiteHistory, refreshKey }: { onSiteHistory: (id: number) => void; refreshKey: number }) {
  const [f, setF] = useState(DECISION_DEFAULTS);
  const { data, loading, error, reload } = useReport<DecisionsReport>("head_report/decisions/", f);
  useRefresh(refreshKey, reload);
  const paged = usePaged(data?.rows ?? []);
  const isFiltered = JSON.stringify(f) !== JSON.stringify(DECISION_DEFAULTS);

  const handleExport = (kind: "pdf" | "excel") => {
    if (!data) return;
    const s = data.summary;
    const range = f.date_from || f.date_to ? dateLabel(f.date_from, f.date_to) : "";
    runExport<DecisionRow>(kind, {
      title: "City ENRO Head Decisions",
      filename: "head_decisions",
      filters: [
        ...describeFilters([
          ["Type", f.kind, KIND_OPTIONS],
          ["Outcome", f.outcome, OUTCOME_OPTIONS],
          ["Search", f.search, null],
        ]),
        ...(range ? [["Date", range] as [string, string]] : []),
      ],
      summary: [
        ["Decisions", fmt(s.total)],
        ["Applications approved", fmt(s.approved)],
        ["Rejected / cancelled", fmt(s.rejected)],
        ["Returned to Data Manager", fmt(s.returned)],
        ["Closures decided", fmt(s.closures)],
        ["Closed completed / failed", `${s.closures_completed} / ${s.closures_failed}`],
        ["Agreed with DM recommendation", fmt(s.agreed_with_dm)],
        ["Avg. turnaround", s.avg_turnaround_days !== null ? `${s.avg_turnaround_days} days` : "—"],
      ],
      recordsTitle: "Decisions",
      columns: [
        { header: "Date", value: (r) => fmtDate(r.date) },
        { header: "Type", value: (r) => r.kind_label },
        { header: "Ref", value: (r) => r.ref },
        { header: "Program", value: (r) => r.title },
        { header: "Group", value: (r) => r.group_name },
        { header: "Site", value: (r) => r.site_name },
        { header: "Decision", value: (r) => r.decision },
        { header: "DM recommendation", value: (r) => r.recommendation },
        { header: "Notes", value: (r) => r.notes },
        { header: "Turnaround (days)", value: (r) => r.turnaround_days },
        { header: "Current status", value: (r) => r.current_status },
        { header: "Decided by", value: (r) => r.decided_by },
      ],
      rows: data.rows,
    });
  };

  const s = data?.summary;

  return (
    <div className="space-y-5">
      <FilterBar onReset={() => setF(DECISION_DEFAULTS)} showReset={isFiltered}>
        <SearchFilter value={f.search} onChange={(v) => setF({ ...f, search: v })} placeholder="Ref, program, group or site…" />
        <SelectFilter label="Type" value={f.kind} onChange={(v) => setF({ ...f, kind: v })} options={KIND_OPTIONS} />
        <SelectFilter label="Outcome" value={f.outcome} onChange={(v) => setF({ ...f, outcome: v })} options={OUTCOME_OPTIONS} />
        <DateRangeFilter label="Decision date" from={f.date_from} to={f.date_to} onChange={(a, b) => setF({ ...f, date_from: a, date_to: b })} />
      </FilterBar>

      {error && !data ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : !data || !s ? (
        <LoadingBlock text="Loading decisions…" />
      ) : (
        <div className={`space-y-5 transition-opacity ${loading ? "opacity-60" : ""}`}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Kpi icon={<Gavel size={16} />} label="Decisions" value={fmt(s.total)} sub={s.avg_turnaround_days !== null ? `Avg. ${s.avg_turnaround_days} days to decide` : undefined} />
            <Kpi icon={<CheckCircle2 size={16} />} label="Applications Approved" value={fmt(s.approved)} sub={`${s.rejected} rejected/cancelled`} accent="bg-green-600" />
            <Kpi icon={<RefreshCw size={16} />} label="Returned to Data Manager" value={fmt(s.returned)} sub="Sent back for changes" accent="bg-amber-500" />
            <Kpi
              icon={<ClipboardList size={16} />}
              label="Program Closures"
              value={fmt(s.closures)}
              sub={`${s.closures_completed} completed · ${s.closures_failed} failed · ${s.agreed_with_dm} agreed with DM`}
              accent="bg-indigo-500"
            />
          </div>

          {data.monthly.length > 0 && (
            <Card className="p-5">
              <SectionTitle icon={<BarChart3 size={16} />} title="Decisions per Month" />
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.monthly} barSize={22}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" vertical={false} />
                  <XAxis dataKey="month" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <Tooltip content={<GreenTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="approved" name="Approved" stackId="d" fill="#10b981" />
                  <Bar dataKey="rejected" name="Rejected" stackId="d" fill="#f87171" />
                  <Bar dataKey="returned" name="Returned" stackId="d" fill="#fbbf24" />
                  <Bar dataKey="closures" name="Closures" stackId="d" fill="#818cf8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          <Card>
            <div className="px-5 pt-5">
              <SectionTitle
                icon={<FileText size={16} />}
                title="Decision Log"
                sub="Every application and closure decision made by a City ENRO Head account"
                right={<ExportButtons onPdf={() => handleExport("pdf")} onExcel={() => handleExport("excel")} disabled={data.rows.length === 0} count={data.rows.length} />}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <Th>Date</Th>
                    <Th>Program</Th>
                    <Th>Site</Th>
                    <Th>Decision</Th>
                    <Th>Notes</Th>
                    <Th right>Turnaround</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paged.pageRows.length > 0 ? (
                    paged.pageRows.map((r, i) => (
                      <tr key={`${r.ref}-${r.kind}-${i}`} className="hover:bg-gray-50/70 align-top">
                        <Td className="whitespace-nowrap">
                          <p>{fmtDate(r.date)}</p>
                          <p className="text-[10.5px] text-gray-400">{r.kind_label}</p>
                        </Td>
                        <Td>
                          <p className="text-[11px] text-gray-400 font-semibold">{r.ref}</p>
                          <p className="font-semibold text-gray-800">{r.title}</p>
                          <p className="text-[11px] text-gray-500">{r.group_name}</p>
                        </Td>
                        <Td>
                          {r.site_id ? (
                            <button onClick={() => onSiteHistory(r.site_id!)} className="text-left hover:underline">
                              <p className="text-emerald-700 font-medium">{r.site_name}</p>
                              <p className="text-[11px] text-gray-400">{r.barangay ?? "—"}</p>
                            </button>
                          ) : (
                            "—"
                          )}
                        </Td>
                        <Td>
                          <Badge label={r.decision} tone={OUTCOME_TONE[r.outcome_key] ?? OUTCOME_TONE.other} />
                          {r.recommendation && (
                            <p className="text-[10.5px] text-gray-400 mt-1">
                              DM recommended {r.recommendation}
                              {r.requested_by ? ` (${r.requested_by})` : ""}
                            </p>
                          )}
                          <p className="text-[10.5px] text-gray-400">Now: {r.current_status}</p>
                        </Td>
                        <Td>
                          <p className="text-[12px] text-gray-600 max-w-[260px]">{r.notes || "—"}</p>
                        </Td>
                        <Td right>{r.turnaround_days !== null ? `${r.turnaround_days}d` : "—"}</Td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6}>
                        <EmptyState text="No decisions match the filters" />
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

type TabKey = "summary" | "programs" | "sites" | "growers" | "visits" | "species" | "decisions";

const TABS: { key: TabKey; label: string; icon: ReactElement; sub: string }[] = [
  { key: "summary", label: "Accomplishments", icon: <Sparkles size={15} />, sub: "What the office achieved in a period — ready to export for meetings and reporting" },
  { key: "programs", label: "Programs", icon: <ClipboardList size={15} />, sub: "Every tree planting program with outcomes, planting and survival" },
  { key: "sites", label: "Sites", icon: <TreePine size={15} />, sub: "Official site statuses, area, current programs and site history" },
  { key: "growers", label: "Tree Growers", icon: <Users size={15} />, sub: "Tree grower group performance, compliance and standing" },
  { key: "visits", label: "Monitoring Visits", icon: <MonitorDot size={15} />, sub: "Field visit log, review outcomes and inspector activity" },
  { key: "species", label: "Species", icon: <Leaf size={15} />, sub: "Seedlings released vs planted and survival per species" },
  { key: "decisions", label: "My Decisions", icon: <Gavel size={15} />, sub: "Your application approvals and program closure decisions" },
];

export default function HeadReports() {
  const [isAuthorize, setIsAuthorize] = useState<boolean | null>(null);
  const [tab, setTab] = useState<TabKey>(() => {
    try {
      return (localStorage.getItem("head_reports_tab") as TabKey) || "summary";
    } catch {
      return "summary";
    }
  });
  const [options, setOptions] = useState<FilterOptions | null>(null);
  const [historySiteId, setHistorySiteId] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    (async () => {
      const token = localStorage.getItem("token");
      if (!token) return setIsAuthorize(false);
      try {
        const res = await fetch(api + "api/get_me/", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
        const body = await res.json();
        setIsAuthorize(res.ok && body.user_role === "CityENROHead");
      } catch {
        setIsAuthorize(false);
      }
    })();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("head_reports_tab", tab);
    } catch {
      /* ignore */
    }
  }, [tab]);

  useEffect(() => {
    if (!isAuthorize) return;
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
  }, [isAuthorize]);

  if (isAuthorize === null) {
    return (
      <div className="min-h-screen bg-[#f5faf6] flex items-center justify-center">
        <Loader2 size={40} className="animate-spin text-[#0F4A2F]" />
      </div>
    );
  }
  if (!isAuthorize) return <NotFoundPage />;

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
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-700 text-sm font-semibold hover:bg-gray-50"
          >
            <RefreshCw size={15} /> Refresh
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-1.5 flex flex-wrap gap-1.5 w-fit max-w-full">
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

        {tab === "summary" && <SummaryTab options={options} refreshKey={refreshKey} />}
        {tab === "programs" && (
          <ProgramsTab options={options} onSiteHistory={setHistorySiteId} refreshKey={refreshKey} programLinkBase="/maintenance_evaluation" />
        )}
        {tab === "sites" && <SitesTab options={options} onSiteHistory={setHistorySiteId} refreshKey={refreshKey} />}
        {tab === "growers" && <GrowersTab options={options} onSiteHistory={setHistorySiteId} refreshKey={refreshKey} />}
        {tab === "visits" && <VisitsTab options={options} onSiteHistory={setHistorySiteId} refreshKey={refreshKey} />}
        {tab === "species" && <SpeciesTab options={options} refreshKey={refreshKey} />}
        {tab === "decisions" && <DecisionsTab onSiteHistory={setHistorySiteId} refreshKey={refreshKey} />}
      </main>

      {historySiteId !== null && <SiteHistoryModal siteId={historySiteId} onClose={() => setHistorySiteId(null)} />}
    </div>
  );
}
