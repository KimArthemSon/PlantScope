/**
 * Data Manager reports, split by purpose:
 *  - Operations Status: what is going on — totals and statuses of programs, official sites,
 *    seedling requests and monitoring visits, and how many came in each month.
 *  - Planting Progress: how far along the planting is — trees planted and alive, survival
 *    and planted area per month, per site and per species.
 */
import { useEffect, useState, type ReactElement } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarClock,
  ClipboardList,
  FileText,
  History,
  Leaf,
  MonitorDot,
  Package,
  Sprout,
  TreePine,
  TrendingUp,
} from "lucide-react";
import { api } from "@/constant/api.ts";
import SiteHistoryModal from "./SiteHistoryModal";
import {
  ProgressTrend,
  type ProgramRow,
  type ProgramsReport,
  type SiteRow,
  type SitesReport,
  type SpeciesReport,
  type SpeciesRow,
  type VisitRow,
  type VisitsReport,
} from "./reports";
import {
  AXIS_TICK,
  Badge,
  Card,
  DateRangeFilter,
  DonutLegend,
  EmptyState,
  ExportButtons,
  FilterBar,
  GreenTooltip,
  Kpi,
  LoadingBlock,
  PROGRAM_TONE,
  Pagination,
  RateBar,
  ReportBody,
  SITE_TONE,
  SearchFilter,
  SectionTitle,
  SelectFilter,
  Td,
  Th,
  VISIT_TONE,
  areaOptions,
  barangayOptions,
  landClassOptions,
  dateFilter,
  describeFilters,
  fmt,
  fmtDate,
  fmtHa,
  fmtPct,
  rateColor,
  runExport,
  usePaged,
  useReport,
  type FilterOptions,
} from "./reportUi";

// ─── Types ──────────────────────────────────────────────────────────────────

interface StatusSlice {
  key: string;
  name: string;
  value: number;
  fill: string;
  hectares?: number;
}

interface RequestRow {
  id: number;
  date: string;
  program: string | null;
  group_name: string | null;
  site_id: number | null;
  site_name: string | null;
  barangay: string | null;
  requested: number;
  released: number;
  status: string;
  status_label: string;
  inspector: string | null;
}

interface StatusReport {
  summary: {
    programs: number;
    programs_pending: number;
    programs_ongoing: number;
    sites: number;
    site_hectares: number;
    sites_under_monitoring: number;
    sites_available: number;
    requests: number;
    requests_pending: number;
    requests_awaiting_handover: number;
    seedlings_requested: number;
    seedlings_released: number;
    visits: number;
    visits_pending: number;
    visits_changes_requested: number;
  };
  program_status: StatusSlice[];
  site_status: StatusSlice[];
  request_status: StatusSlice[];
  visit_status: StatusSlice[];
  monthly: { month: string; programs: number; requests: number; visits: number }[];
  requests: RequestRow[];
}

type LocationFilters = { barangay: string; area: string; land_classification: string; date_from: string; date_to: string };

const REQUEST_TONE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  accepted: "bg-blue-50 text-blue-700 border-blue-200",
  confirmed: "bg-green-50 text-green-700 border-green-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
  cancelled: "bg-gray-100 text-gray-600 border-gray-200",
};

function SegmentedToggle<K extends string>({
  value,
  onChange,
  items,
}: {
  value: K;
  onChange: (key: K) => void;
  items: [K, string][];
}) {
  return (
    <div className="inline-flex p-1 rounded-xl bg-gray-100 flex-wrap">
      {items.map(([key, label]) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            value === key ? "bg-white text-[#0F4A2F] shadow-sm" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ═══ OPERATIONS STATUS ══════════════════════════════════════════════════════

const STATUS_DEFAULTS: LocationFilters = { barangay: "all", area: "all", land_classification: "all", date_from: "", date_to: "" };
type RecordView = "programs" | "sites" | "requests" | "visits";

export function StatusTab({
  options,
  onSiteHistory,
}: {
  options: FilterOptions | null;
  onSiteHistory: (id: number) => void;
}) {
  const [f, setF] = useState(STATUS_DEFAULTS);
  const [view, setView] = useState<RecordView>("programs");
  const { data, loading, error, reload } = useReport<StatusReport>("dm_report/status/", f);
  const brgyOpts = barangayOptions(options);
  const areaOpts = areaOptions(options, f.barangay);
  const classOpts = landClassOptions(options);
  const isFiltered = JSON.stringify(f) !== JSON.stringify(STATUS_DEFAULTS);
  const filterLines = [
    ...describeFilters([
      ["Barangay", f.barangay, brgyOpts],
      ["Reforestation area", f.area, areaOpts],
      ["Land classification", f.land_classification, classOpts],
    ]),
    ...dateFilter("Created", f.date_from, f.date_to),
  ];

  return (
    <div className="space-y-5">
      <FilterBar onReset={() => setF(STATUS_DEFAULTS)} showReset={isFiltered}>
        <SelectFilter label="Barangay" value={f.barangay} onChange={(v) => setF({ ...f, barangay: v, area: "all" })} options={brgyOpts} />
        <SelectFilter label="Reforestation area" value={f.area} onChange={(v) => setF({ ...f, area: v })} options={areaOpts} />
        <SelectFilter label="Land classification" value={f.land_classification} onChange={(v) => setF({ ...f, land_classification: v })} options={classOpts} />
        <DateRangeFilter label="Created" from={f.date_from} to={f.date_to} onChange={(a, b) => setF({ ...f, date_from: a, date_to: b })} />
      </FilterBar>

      <ReportBody data={data} error={error} loading={loading} loadingText="Building operations status…" onRetry={reload}>
        {(data) => {
          const s = data.summary;
          return (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Kpi
                  icon={<ClipboardList size={16} />}
                  label="Programs"
                  value={fmt(s.programs)}
                  sub={`${s.programs_pending} to review · ${s.programs_ongoing} ongoing`}
                />
                <Kpi
                  icon={<TreePine size={16} />}
                  label="Official Sites"
                  value={fmt(s.sites)}
                  sub={`${s.sites_under_monitoring} under monitoring · ${s.sites_available} available · ${fmtHa(s.site_hectares)}`}
                  accent="bg-green-600"
                />
                <Kpi
                  icon={<Package size={16} />}
                  label="Seedling Requests"
                  value={fmt(s.requests)}
                  valueColor={s.requests_pending > 0 ? "#d97706" : undefined}
                  sub={`${s.requests_pending} to review · ${s.requests_awaiting_handover} awaiting handover · ${fmt(s.seedlings_released)} of ${fmt(s.seedlings_requested)} seedlings released`}
                  accent="bg-teal-500"
                />
                <Kpi
                  icon={<MonitorDot size={16} />}
                  label="Monitoring Visits"
                  value={fmt(s.visits)}
                  valueColor={s.visits_pending > 0 ? "#d97706" : undefined}
                  sub={`${s.visits_pending} to review · ${s.visits_changes_requested} sent back for changes`}
                  accent="bg-indigo-500"
                />
              </div>

              <Card className="p-5">
                <SectionTitle
                  icon={<BarChart3 size={16} />}
                  title="Activity per Month"
                  sub="New programs, seedling requests and monitoring visits submitted each month"
                />
                {data.monthly.some((m) => m.programs || m.requests || m.visits) ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={data.monthly} barGap={2}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" vertical={false} />
                      <XAxis dataKey="month" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                      <Tooltip content={<GreenTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="programs" name="Programs" fill="#6366f1" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="requests" name="Seedling requests" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="visits" name="Monitoring visits" fill="#a7f3d0" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState text="No activity in this period" />
                )}
              </Card>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
                {[
                  { title: "Programs", sub: `${s.programs} programs`, data: data.program_status },
                  { title: "Official Sites", sub: "Monitoring status", data: data.site_status, ha: true },
                  { title: "Seedling Requests", sub: `${s.requests} requests`, data: data.request_status },
                  { title: "Monitoring Visits", sub: "Review status", data: data.visit_status },
                ].map((c) => (
                  <Card key={c.title} className="p-5">
                    <SectionTitle title={c.title} sub={c.sub} />
                    <DonutLegend data={c.data} extra={c.ha ? (d) => fmtHa(d.hectares) : undefined} />
                  </Card>
                ))}
              </div>

              <Card>
                <div className="px-5 pt-5">
                  <SectionTitle
                    icon={<FileText size={16} />}
                    title="Records"
                    sub="Status of each program, site, seedling request and visit"
                  />
                  <div className="mb-4">
                    <SegmentedToggle
                      value={view}
                      onChange={setView}
                      items={[
                        ["programs", `Programs (${s.programs})`],
                        ["sites", `Sites (${s.sites})`],
                        ["requests", `Seedling Requests (${s.requests})`],
                        ["visits", `Visits (${s.visits})`],
                      ]}
                    />
                  </div>
                </div>
                {view === "programs" && <ProgramRecords filters={f} filterLines={filterLines} onSiteHistory={onSiteHistory} />}
                {view === "sites" && <SiteStatusRecords filters={f} filterLines={filterLines} onSiteHistory={onSiteHistory} />}
                {view === "requests" && <RequestRecords rows={data.requests} filterLines={filterLines} onSiteHistory={onSiteHistory} />}
                {view === "visits" && <VisitRecords filters={f} filterLines={filterLines} onSiteHistory={onSiteHistory} />}
              </Card>
            </>
          );
        }}
      </ReportBody>
    </div>
  );
}

type RecordProps = {
  filters: LocationFilters;
  filterLines: [string, string][];
  onSiteHistory: (id: number) => void;
};

function RecordsHeader({ count, onExport }: { count: number; onExport: (kind: "pdf" | "excel") => void }) {
  return (
    <div className="px-5 pb-3 flex justify-end">
      <ExportButtons onPdf={() => onExport("pdf")} onExcel={() => onExport("excel")} disabled={count === 0} count={count} />
    </div>
  );
}

function HistoryButton({ siteId, onSiteHistory }: { siteId: number | null; onSiteHistory: (id: number) => void }) {
  if (!siteId) return null;
  return (
    <button
      onClick={() => onSiteHistory(siteId)}
      title="Site history"
      className="p-1.5 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
    >
      <History size={13} />
    </button>
  );
}

function ProgramRecords({ filters, filterLines, onSiteHistory }: RecordProps) {
  const { data, error } = useReport<ProgramsReport>("dm_report/programs/", filters);
  const paged = usePaged(data?.rows ?? []);
  if (!data) return error ? <EmptyState text={error} /> : <LoadingBlock text="Loading programs…" />;

  const handleExport = (kind: "pdf" | "excel") =>
    runExport<ProgramRow>(kind, {
      title: "Programs — Status",
      filename: "dm_programs_status",
      filters: filterLines,
      summary: data.status_breakdown.map((b) => [b.name, fmt(b.value)] as [string, string]),
      recordsTitle: "Programs",
      columns: [
        { header: "Ref", value: (r) => r.ref },
        { header: "Program", value: (r) => r.title },
        { header: "Group", value: (r) => r.group_name },
        { header: "Site", value: (r) => r.site_name },
        { header: "Barangay", value: (r) => r.barangay },
        { header: "Status", value: (r) => r.status_label },
        { header: "Submitted", value: (r) => fmtDate(r.submitted) },
        { header: "Closed", value: (r) => fmtDate(r.closed_date) },
      ],
      rows: data.rows,
    });

  return (
    <>
      <RecordsHeader count={data.rows.length} onExport={handleExport} />
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <Th>Program</Th>
              <Th>Site</Th>
              <Th>Status</Th>
              <Th>Submitted</Th>
              <Th>Closed</Th>
              <Th>History</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paged.pageRows.length > 0 ? (
              paged.pageRows.map((r) => (
                <tr key={r.application_id} className="hover:bg-gray-50/70">
                  <Td>
                    <p className="text-[11px] text-gray-400 font-semibold">{r.ref}</p>
                    <p className="font-semibold text-gray-800 max-w-[240px] truncate" title={r.title}>
                      {r.title}
                    </p>
                    <p className="text-[11px] text-gray-500">{r.group_name}</p>
                  </Td>
                  <Td>
                    <p className="text-gray-800">{r.site_name ?? "—"}</p>
                    <p className="text-[11px] text-gray-400">{r.barangay ?? ""}</p>
                  </Td>
                  <Td>
                    <Badge label={r.status_label} tone={PROGRAM_TONE[r.status] ?? PROGRAM_TONE.cancelled} />
                  </Td>
                  <Td className="whitespace-nowrap">{fmtDate(r.submitted)}</Td>
                  <Td className="whitespace-nowrap">{fmtDate(r.closed_date)}</Td>
                  <Td>
                    <HistoryButton siteId={r.site_id} onSiteHistory={onSiteHistory} />
                  </Td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6}>
                  <EmptyState text="No programs match the filters" />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination {...paged} />
    </>
  );
}

function SiteStatusRecords({ filters, filterLines, onSiteHistory }: RecordProps) {
  const { data, error } = useReport<SitesReport>("dm_report/sites/", {
    barangay: filters.barangay,
    area: filters.area,
    land_classification: filters.land_classification,
  });
  const paged = usePaged(data?.rows ?? []);
  if (!data) return error ? <EmptyState text={error} /> : <LoadingBlock text="Loading sites…" />;

  const handleExport = (kind: "pdf" | "excel") =>
    runExport<SiteRow>(kind, {
      title: "Official Sites — Status",
      filename: "dm_sites_status",
      // Sites are a current snapshot: the date filter does not apply
      filters: filterLines.filter(([label]) => label !== "Created"),
      summary: data.status_breakdown.map((b) => [b.name, `${fmt(b.value)} · ${fmtHa(b.hectares)}`] as [string, string]),
      recordsTitle: "Sites",
      columns: [
        { header: "Site", value: (r) => r.name },
        { header: "Reforestation area", value: (r) => r.reforestation_area },
        { header: "Barangay", value: (r) => r.barangay },
        { header: "Status", value: (r) => r.monitoring_label },
        { header: "Site area", value: (r) => fmtHa(r.hectares) },
        { header: "Current program", value: (r) => (r.current_program ? `${r.current_program} (${r.current_group})` : null) },
        { header: "Programs (done / failed)", value: (r) => `${r.programs_total} (${r.programs_completed} / ${r.programs_failed})` },
        { header: "Last visit", value: (r) => fmtDate(r.last_visit) },
      ],
      rows: data.rows,
    });

  return (
    <>
      <RecordsHeader count={data.rows.length} onExport={handleExport} />
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <Th>Site</Th>
              <Th>Status</Th>
              <Th right>Site Area</Th>
              <Th>Current Program</Th>
              <Th right>Programs</Th>
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
                  </Td>
                  <Td>
                    <Badge label={r.monitoring_label} tone={SITE_TONE[r.monitoring_status] ?? SITE_TONE.onhold} />
                  </Td>
                  <Td right>{fmtHa(r.hectares)}</Td>
                  <Td>
                    {r.current_program ? (
                      <>
                        <p className="text-gray-800 max-w-[200px] truncate">{r.current_program}</p>
                        <p className="text-[11px] text-gray-400">{r.current_group}</p>
                      </>
                    ) : (
                      <span className="text-[11.5px] text-gray-400">{r.last_outcome ? `Last: ${r.last_outcome}` : "None"}</span>
                    )}
                  </Td>
                  <Td right>
                    <p>{r.programs_total}</p>
                    <p className="text-[10.5px] text-gray-400">
                      {r.programs_completed} done · {r.programs_failed} failed
                    </p>
                  </Td>
                  <Td className="whitespace-nowrap">{fmtDate(r.last_visit)}</Td>
                  <Td>
                    <HistoryButton siteId={r.site_id} onSiteHistory={onSiteHistory} />
                  </Td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7}>
                  <EmptyState text="No official sites match the filters" />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination {...paged} />
    </>
  );
}

function RequestRecords({
  rows,
  filterLines,
  onSiteHistory,
}: {
  rows: RequestRow[];
  filterLines: [string, string][];
  onSiteHistory: (id: number) => void;
}) {
  const paged = usePaged(rows);
  const handleExport = (kind: "pdf" | "excel") =>
    runExport<RequestRow>(kind, {
      title: "Seedling Requests — Status",
      filename: "dm_seedling_requests",
      filters: filterLines,
      summary: [
        ["Requests", fmt(rows.length)],
        ["Seedlings requested", fmt(rows.reduce((n, r) => n + r.requested, 0))],
        ["Seedlings released", fmt(rows.reduce((n, r) => n + r.released, 0))],
      ],
      recordsTitle: "Seedling requests",
      columns: [
        { header: "Date", value: (r) => fmtDate(r.date) },
        { header: "Program", value: (r) => r.program },
        { header: "Group", value: (r) => r.group_name },
        { header: "Site", value: (r) => r.site_name },
        { header: "Barangay", value: (r) => r.barangay },
        { header: "Requested", value: (r) => r.requested },
        { header: "Released", value: (r) => r.released },
        { header: "Status", value: (r) => r.status_label },
        { header: "Handover inspector", value: (r) => r.inspector },
      ],
      rows,
    });

  return (
    <>
      <RecordsHeader count={rows.length} onExport={handleExport} />
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <Th>Date</Th>
              <Th>Program</Th>
              <Th>Site</Th>
              <Th right>Requested</Th>
              <Th right>Released</Th>
              <Th>Status</Th>
              <Th>Handover Inspector</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paged.pageRows.length > 0 ? (
              paged.pageRows.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50/70">
                  <Td className="whitespace-nowrap">{fmtDate(r.date)}</Td>
                  <Td>
                    <p className="text-gray-800">{r.program ?? "—"}</p>
                    <p className="text-[11px] text-gray-400">{r.group_name ?? ""}</p>
                  </Td>
                  <Td>
                    {r.site_id ? (
                      <button onClick={() => onSiteHistory(r.site_id!)} className="text-left hover:underline">
                        <p className="text-gray-800">{r.site_name}</p>
                        <p className="text-[11px] text-gray-400">{r.barangay ?? ""}</p>
                      </button>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td right>{fmt(r.requested)}</Td>
                  <Td right>{r.released ? fmt(r.released) : "—"}</Td>
                  <Td>
                    <Badge label={r.status_label} tone={REQUEST_TONE[r.status] ?? REQUEST_TONE.cancelled} />
                  </Td>
                  <Td>{r.inspector ?? <span className="text-gray-400">—</span>}</Td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7}>
                  <EmptyState text="No seedling requests match the filters" />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination {...paged} />
    </>
  );
}

function VisitRecords({ filters, filterLines, onSiteHistory }: RecordProps) {
  const { data, error } = useReport<VisitsReport>("dm_report/visits/", filters);
  const paged = usePaged(data?.rows ?? []);
  if (!data) return error ? <EmptyState text={error} /> : <LoadingBlock text="Loading visits…" />;

  const handleExport = (kind: "pdf" | "excel") =>
    runExport<VisitRow>(kind, {
      title: "Monitoring Visits — Status",
      filename: "dm_visits_status",
      filters: filterLines,
      summary: [
        ["Visits", fmt(data.summary.total)],
        ["Accepted", fmt(data.summary.accepted)],
        ["Pending review", fmt(data.summary.pending)],
        ["Changes requested", fmt(data.summary.rejected)],
      ],
      recordsTitle: "Visits",
      columns: [
        { header: "Date", value: (r) => fmtDate(r.date) },
        { header: "Site", value: (r) => r.site_name },
        { header: "Program", value: (r) => r.program },
        { header: "Visit type", value: (r) => r.visit_label },
        { header: "Status", value: (r) => r.status },
        { header: "DM review", value: (r) => r.dm_review },
        { header: "GIS review", value: (r) => r.gis_review },
        { header: "Inspector", value: (r) => r.inspector },
      ],
      rows: data.rows,
    });

  return (
    <>
      <RecordsHeader count={data.rows.length} onExport={handleExport} />
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
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7}>
                  <EmptyState text="No visits match the filters" />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination {...paged} />
    </>
  );
}

// ═══ PLANTING PROGRESS ══════════════════════════════════════════════════════

const MONITORING_OPTIONS = [
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
  { value: "low_survival", label: "Low survival" },
];
const PROGRESS_DEFAULTS = {
  search: "",
  barangay: "all",
  area: "all",
  land_classification: "all",
  monitoring_status: "all",
  attention: "all",
  date_from: "",
  date_to: "",
};

export function ProgressTab({
  options,
  onSiteHistory,
}: {
  options: FilterOptions | null;
  onSiteHistory: (id: number) => void;
}) {
  const [f, setF] = useState(PROGRESS_DEFAULTS);
  const [view, setView] = useState<"sites" | "species">("sites");
  const sites = useReport<SitesReport>("dm_report/sites/", f);
  const species = useReport<SpeciesReport>("dm_report/species/", {
    barangay: f.barangay,
    area: f.area,
    land_classification: f.land_classification,
    date_from: f.date_from,
    date_to: f.date_to,
  });
  const paged = usePaged(sites.data?.rows ?? []);
  const brgyOpts = barangayOptions(options);
  const areaOpts = areaOptions(options, f.barangay);
  const classOpts = landClassOptions(options);
  const isFiltered = JSON.stringify(f) !== JSON.stringify(PROGRESS_DEFAULTS);

  const exportSites = (kind: "pdf" | "excel") => {
    const data = sites.data;
    if (!data) return;
    const s = data.summary;
    runExport<SiteRow>(kind, {
      title: "Planting Progress — Sites",
      filename: "dm_planting_progress",
      filters: [
        ...describeFilters([
          ["Barangay", f.barangay, brgyOpts],
          ["Reforestation area", f.area, areaOpts],
          ["Land classification", f.land_classification, classOpts],
          ["Monitoring status", f.monitoring_status, MONITORING_OPTIONS],
          ["Needs attention", f.attention, ATTENTION_OPTIONS],
          ["Search", f.search, null],
        ]),
        ...dateFilter("Trend months", f.date_from, f.date_to),
      ],
      summary: [
        ["Trees planted", fmt(s.planted)],
        ["Alive", fmt(s.survived)],
        ["Dead", fmt(s.dead)],
        ["Survival rate", fmtPct(s.survival_rate)],
        ["Planted area", fmtHa(s.planted_hectares)],
        ["Official site area", fmtHa(s.total_hectares)],
        [`Overdue visit (> ${s.overdue_days} days)`, fmt(s.overdue)],
        ["Monitored, no visit yet", fmt(s.no_visit)],
      ],
      sections: [
        {
          title: "Monthly progress",
          columns: ["Month", "Planted that month", "Dead that month", "Total planted", "Alive", "Survival rate", "Planted area"],
          rows: data.progress_trend.map((t) => [
            t.month, fmt(t.new_planted), fmt(t.new_dead), fmt(t.total_planted), fmt(t.alive), fmtPct(t.survival_rate), fmtHa(t.planted_hectares),
          ]),
        },
      ],
      recordsTitle: "Progress per site",
      columns: [
        { header: "Site", value: (r) => r.name },
        { header: "Barangay", value: (r) => r.barangay },
        { header: "Status", value: (r) => r.monitoring_label },
        { header: "Site area", value: (r) => fmtHa(r.hectares) },
        { header: "Planted area", value: (r) => fmtHa(r.planted_hectares) },
        { header: "Planted", value: (r) => r.planted },
        { header: "Alive", value: (r) => r.survived },
        { header: "Dead", value: (r) => r.dead },
        { header: "Survival", value: (r) => fmtPct(r.survival_rate) },
        { header: "Visits", value: (r) => r.visits },
        { header: "Last visit", value: (r) => fmtDate(r.last_visit) },
      ],
      rows: data.rows,
    });
  };

  const exportSpecies = (kind: "pdf" | "excel") => {
    const data = species.data;
    if (!data) return;
    runExport<SpeciesRow>(kind, {
      title: "Planting Progress — Species",
      filename: "dm_species_progress",
      filters: [
        ...describeFilters([
          ["Barangay", f.barangay, brgyOpts],
          ["Reforestation area", f.area, areaOpts],
          ["Land classification", f.land_classification, classOpts],
        ]),
        ...dateFilter("Date", f.date_from, f.date_to),
      ],
      summary: [
        ["Species", fmt(data.summary.species_count)],
        ["Seedlings released", fmt(data.summary.endorsed)],
        ["Trees planted", fmt(data.summary.planted)],
        ["Survival rate", fmtPct(data.summary.survival_rate)],
        ["Best survival", data.summary.best_species ?? "—"],
        ["Lowest survival", data.summary.worst_species ?? "—"],
      ],
      recordsTitle: "Species",
      columns: [
        { header: "Species", value: (r) => r.name },
        { header: "Released", value: (r) => r.endorsed },
        { header: "Planted", value: (r) => r.planted },
        { header: "Alive", value: (r) => r.survived },
        { header: "Dead", value: (r) => r.dead },
        { header: "Survival", value: (r) => fmtPct(r.survival_rate) },
        { header: "Sites", value: (r) => r.sites },
      ],
      rows: data.rows,
    });
  };

  return (
    <div className="space-y-5">
      <FilterBar onReset={() => setF(PROGRESS_DEFAULTS)} showReset={isFiltered}>
        <SearchFilter value={f.search} onChange={(v) => setF({ ...f, search: v })} placeholder="Site or reforestation area…" />
        <SelectFilter label="Barangay" value={f.barangay} onChange={(v) => setF({ ...f, barangay: v, area: "all" })} options={brgyOpts} />
        <SelectFilter label="Reforestation area" value={f.area} onChange={(v) => setF({ ...f, area: v })} options={areaOpts} />
        <SelectFilter label="Land classification" value={f.land_classification} onChange={(v) => setF({ ...f, land_classification: v })} options={classOpts} />
        <SelectFilter label="Monitoring status" value={f.monitoring_status} onChange={(v) => setF({ ...f, monitoring_status: v })} options={MONITORING_OPTIONS} />
        <SelectFilter label="Needs attention" value={f.attention} onChange={(v) => setF({ ...f, attention: v })} options={ATTENTION_OPTIONS} />
        <DateRangeFilter label="Trend months" from={f.date_from} to={f.date_to} onChange={(a, b) => setF({ ...f, date_from: a, date_to: b })} />
      </FilterBar>

      <ReportBody data={sites.data} error={sites.error} loading={sites.loading} loadingText="Building planting progress…" onRetry={sites.reload}>
        {(data) => {
          const s = data.summary;
          const coverage = s.total_hectares > 0 ? Math.round((s.planted_hectares / s.total_hectares) * 100) : null;
          return (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Kpi
                  icon={<Sprout size={16} />}
                  label="Trees Planted"
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
                <Kpi
                  icon={<TreePine size={16} />}
                  label="Planted Area"
                  value={fmtHa(s.planted_hectares)}
                  sub={`of ${fmtHa(s.total_hectares)} official site area${coverage !== null ? ` · ${coverage}%` : ""}`}
                  accent="bg-teal-600"
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

              <ProgressTrend trend={data.progress_trend} />

              <Card>
                <div className="px-5 pt-5">
                  <SectionTitle
                    icon={view === "sites" ? <TrendingUp size={16} /> : <Leaf size={16} />}
                    title={view === "sites" ? "Progress per Site" : "Progress per Species"}
                    sub={
                      view === "sites"
                        ? "Trees planted, alive and planted area on each official site"
                        : "Seedlings released vs planted, and survival per species — useful when choosing species for new programs"
                    }
                    right={
                      view === "sites" ? (
                        <ExportButtons onPdf={() => exportSites("pdf")} onExcel={() => exportSites("excel")} disabled={data.rows.length === 0} count={data.rows.length} />
                      ) : (
                        <ExportButtons
                          onPdf={() => exportSpecies("pdf")}
                          onExcel={() => exportSpecies("excel")}
                          disabled={!species.data || species.data.rows.length === 0}
                          count={species.data?.rows.length ?? 0}
                        />
                      )
                    }
                  />
                  <div className="mb-4">
                    <SegmentedToggle
                      value={view}
                      onChange={setView}
                      items={[
                        ["sites", `Sites (${data.rows.length})`],
                        ["species", `Species (${species.data?.rows.length ?? "…"})`],
                      ]}
                    />
                  </div>
                </div>

                {view === "sites" ? (
                  <>
                    <div className="overflow-x-auto">
                      <table className="min-w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <Th>Site</Th>
                            <Th right>Planted Area</Th>
                            <Th right>Planted</Th>
                            <Th right>Alive</Th>
                            <Th right>Dead</Th>
                            <Th>Survival</Th>
                            <Th>Last Visit</Th>
                            <Th>History</Th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {paged.pageRows.length > 0 ? (
                            paged.pageRows.map((r) => {
                              const pct = r.hectares > 0 && r.planted_hectares ? Math.round((r.planted_hectares / r.hectares) * 100) : null;
                              return (
                                <tr key={r.site_id} className="hover:bg-gray-50/70">
                                  <Td>
                                    <p className="font-semibold text-gray-800">{r.name}</p>
                                    <p className="text-[11px] text-gray-400">
                                      {r.barangay ?? "—"} · {r.monitoring_label}
                                    </p>
                                  </Td>
                                  <Td right>
                                    <p>{fmtHa(r.planted_hectares)}</p>
                                    <p className="text-[10.5px] text-gray-400">
                                      of {fmtHa(r.hectares)}
                                      {pct !== null ? ` · ${pct}%` : ""}
                                    </p>
                                  </Td>
                                  <Td right>{fmt(r.planted)}</Td>
                                  <Td right className="text-emerald-600 font-semibold">
                                    {fmt(r.survived)}
                                  </Td>
                                  <Td right className="text-red-500">
                                    {fmt(r.dead)}
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
                                    <p className="text-[10.5px] text-gray-400">{r.visits} visit(s)</p>
                                  </Td>
                                  <Td>
                                    <HistoryButton siteId={r.site_id} onSiteHistory={onSiteHistory} />
                                  </Td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan={8}>
                                <EmptyState text="No sites match the filters" />
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    <Pagination {...paged} />
                  </>
                ) : !species.data ? (
                  species.error ? <EmptyState text={species.error} /> : <LoadingBlock text="Loading species…" />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <Th>Species</Th>
                          <Th right>Released</Th>
                          <Th right>Planted</Th>
                          <Th right>Alive</Th>
                          <Th right>Dead</Th>
                          <Th>Survival</Th>
                          <Th right>Sites</Th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {species.data.rows.length > 0 ? (
                          species.data.rows.map((r) => (
                            <tr key={r.name} className="hover:bg-gray-50/70">
                              <Td className="font-semibold text-gray-800">{r.name}</Td>
                              <Td right>{fmt(r.endorsed)}</Td>
                              <Td right>{fmt(r.planted)}</Td>
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
                            <td colSpan={7}>
                              <EmptyState text="No species data for these filters" />
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </>
          );
        }}
      </ReportBody>
    </div>
  );
}

// ═══ PAGE ═══════════════════════════════════════════════════════════════════

type TabKey = "status" | "progress";

const TABS: { key: TabKey; label: string; icon: ReactElement; sub: string }[] = [
  {
    key: "status",
    label: "Operations Status",
    icon: <ClipboardList size={15} />,
    sub: "What is going on — programs, official sites, seedling requests and monitoring visits by status, and how many came in each month",
  },
  {
    key: "progress",
    label: "Planting Progress",
    icon: <Sprout size={15} />,
    sub: "How far along the planting is — trees planted and alive, survival and planted area per month, per site and per species",
  },
];

export default function DataManagerReports() {
  const [tab, setTab] = useState<TabKey>(() => {
    try {
      const saved = localStorage.getItem("dm_reports_tab") as TabKey;
      return TABS.some((t) => t.key === saved) ? saved : "status";
    } catch {
      return "status";
    }
  });
  const [options, setOptions] = useState<FilterOptions | null>(null);
  const [historySiteId, setHistorySiteId] = useState<number | null>(null);

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
        /* filters still work without names */
      }
    })();
  }, []);

  const active = TABS.find((t) => t.key === tab) ?? TABS[0];

  return (
    <div className="min-h-screen bg-[#f5faf6]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <main className="max-w-[1400px] mx-auto p-6 space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-[#0F4A2F] flex items-center gap-2">
            <BarChart3 size={24} /> Reports
          </h1>
          <p className="text-sm text-gray-500 mt-1">{active.sub}</p>
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

        {tab === "status" && <StatusTab options={options} onSiteHistory={setHistorySiteId} />}
        {tab === "progress" && <ProgressTab options={options} onSiteHistory={setHistorySiteId} />}
      </main>

      {historySiteId !== null && <SiteHistoryModal siteId={historySiteId} onClose={() => setHistorySiteId(null)} />}
    </div>
  );
}
