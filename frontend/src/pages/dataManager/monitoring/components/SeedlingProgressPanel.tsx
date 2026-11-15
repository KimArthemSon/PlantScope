import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Clock,
  Loader2,
  Plus,
  Sprout,
  TrendingUp,
} from "lucide-react";
import { api } from "@/constant/api.ts";

interface ReportSpecies {
  species_id: number;
  species_name: string;
  no_planted: number;
  no_survived: number;
  no_dead: number;
}

interface ProgressReport {
  report_id: number;
  application_id: number | null;
  status: string;
  species: ReportSpecies[];
  submitted_at: string | null;
}

interface ProvidedRequest {
  application_id: number;
  species: { species_id: number; species_name: string; quantity: number }[];
}

interface MonitoringDetails {
  site: { total_area_hectares: number | null };
  metrics: {
    planted_area_hectares: number | null;
    planted_area_percent: number | null;
  };
  seedlings_provided_list: ProvidedRequest[];
  progress_reports: ProgressReport[];
}

interface SpeciesProgress {
  species_id: number;
  species_name: string;
  provided: number;
  planted: number;
  dead: number;
}

interface SeedlingProgressPanelProps {
  siteId: number | null;
  applicationId: number | null;
  // Requests already approved but not yet delivered / still pending
  openRequests: { no_request_seedling: number; status: string }[];
  // Species already in the provision list on the right
  provisionSpeciesIds: number[];
  onAddSpecies: (speciesId: number, speciesName: string) => void;
}

const survivalTone = (rate: number | null) =>
  rate === null
    ? "text-gray-400"
    : rate >= 80
      ? "text-green-700"
      : rate >= 50
        ? "text-amber-600"
        : "text-red-600";

const survivalBar = (rate: number | null) =>
  rate === null
    ? "bg-gray-200"
    : rate >= 80
      ? "bg-green-500"
      : rate >= 50
        ? "bg-amber-500"
        : "bg-red-500";

const pct = (part: number, whole: number) =>
  whole > 0 ? Math.round((part / whole) * 1000) / 10 : null;

const formatDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";

// Left side of the "Seedling Provision" section: how the seedlings already
// given to this program (or the whole site) are doing, per species.
export default function SeedlingProgressPanel({
  siteId,
  applicationId,
  openRequests,
  provisionSpeciesIds,
  onAddSpecies,
}: SeedlingProgressPanelProps) {
  const [data, setData] = useState<MonitoringDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState<"program" | "site">("program");

  useEffect(() => {
    if (!siteId) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`${api}api/get_site_monitoring_details/${siteId}/`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Could not load site progress.");
        return res.json();
      })
      .then((json) => !cancelled && setData(json))
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [siteId]);

  const { rows, reportsAccepted, lastReportAt } = useMemo(() => {
    const map = new Map<number, SpeciesProgress>();
    const get = (id: number, name: string) => {
      if (!map.has(id))
        map.set(id, { species_id: id, species_name: name, provided: 0, planted: 0, dead: 0 });
      return map.get(id)!;
    };
    const inScope = (appId: number | null) =>
      scope === "site" || (applicationId !== null && appId === applicationId);

    data?.seedlings_provided_list
      .filter((r) => inScope(r.application_id))
      .forEach((r) =>
        r.species.forEach((s) => (get(s.species_id, s.species_name).provided += s.quantity || 0)),
      );

    const accepted = (data?.progress_reports ?? []).filter(
      (r) => r.status === "accepted" && inScope(r.application_id),
    );
    accepted.forEach((r) =>
      r.species.forEach((s) => {
        const row = get(s.species_id, s.species_name);
        row.planted += s.no_planted || 0;
        row.dead += s.no_dead || 0;
      }),
    );

    const last = accepted
      .map((r) => r.submitted_at)
      .filter(Boolean)
      .sort()
      .pop() as string | undefined;

    return {
      rows: [...map.values()].sort((a, b) => b.provided - a.provided || b.planted - a.planted),
      reportsAccepted: accepted.length,
      lastReportAt: last ?? null,
    };
  }, [data, scope, applicationId]);

  const totals = rows.reduce(
    (t, r) => ({
      provided: t.provided + r.provided,
      planted: t.planted + r.planted,
      dead: t.dead + r.dead,
    }),
    { provided: 0, planted: 0, dead: 0 },
  );
  const survived = Math.max(0, totals.planted - totals.dead);
  const survivalRate = pct(survived, totals.planted);
  const awaiting = openRequests
    .filter((r) => r.status === "pending" || r.status === "accepted")
    .reduce((sum, r) => sum + (r.no_request_seedling || 0), 0);

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4 gap-2">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
          <Activity size={13} /> Seedling Progress
        </h3>
        <div className="flex rounded-lg border border-gray-200 p-0.5 text-[11px] font-semibold">
          {(["program", "site"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScope(s)}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                scope === s ? "bg-[#0F4A2F] text-white" : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              {s === "program" ? "This program" : "Whole site"}
            </button>
          ))}
        </div>
      </div>

      {!siteId ? (
        <p className="text-sm text-gray-400 text-center py-8">
          No site assigned, so there is no progress to show.
        </p>
      ) : loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500">
          <Loader2 size={16} className="animate-spin" /> Loading progress…
        </div>
      ) : error ? (
        <p className="text-sm text-red-600 text-center py-8">{error}</p>
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            <Stat icon={<Sprout size={13} />} label="Provided" value={totals.provided.toLocaleString()} />
            <Stat icon={<TrendingUp size={13} />} label="Planted" value={totals.planted.toLocaleString()} />
            <Stat
              icon={<CheckCircle2 size={13} />}
              label="Survival"
              value={survivalRate === null ? "—" : `${survivalRate}%`}
              valueClass={survivalTone(survivalRate)}
            />
            <Stat
              icon={<ClipboardList size={13} />}
              label="Reports"
              value={reportsAccepted.toString()}
            />
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500 mb-4">
            <span className="flex items-center gap-1">
              <Clock size={11} /> Last accepted report: {formatDate(lastReportAt)}
            </span>
            {data?.metrics.planted_area_percent != null && (
              <span>
                Planted area: {data.metrics.planted_area_hectares} ha (
                {data.metrics.planted_area_percent}% of site)
              </span>
            )}
          </div>

          {awaiting > 0 && scope === "program" && (
            <div className="mb-4 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-800 flex items-start gap-1.5">
              <AlertTriangle size={13} className="shrink-0 mt-px" />
              {awaiting.toLocaleString()} seedlings from other requests are still
              pending or awaiting delivery for this program.
            </div>
          )}

          {/* Per species */}
          {rows.length === 0 ? (
            <p className="text-sm text-gray-400 italic text-center py-6">
              No seedlings provided or planted yet
              {scope === "program" ? " for this program" : " on this site"}.
            </p>
          ) : (
            <div className="space-y-2 overflow-y-auto pr-1 max-h-[420px]">
              {rows.map((r) => {
                const alive = Math.max(0, r.planted - r.dead);
                const rate = pct(alive, r.planted);
                const unplanted = Math.max(0, r.provided - r.planted);
                const inList = provisionSpeciesIds.includes(r.species_id);
                return (
                  <div
                    key={r.species_id}
                    className="p-3 rounded-lg border border-gray-200 bg-gray-50"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="flex items-center gap-2 text-sm font-semibold text-gray-800 min-w-0">
                        <Sprout size={14} className="text-[#0F4A2F] shrink-0" />
                        <span className="truncate">{r.species_name}</span>
                      </span>
                      {inList ? (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 shrink-0">
                          In provision list
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onAddSpecies(r.species_id, r.species_name)}
                          className="flex items-center gap-1 text-[11px] font-semibold text-[#0F4A2F] hover:underline shrink-0"
                        >
                          <Plus size={12} /> Provide more
                        </button>
                      )}
                    </div>

                    <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden mb-2">
                      <div
                        className={`h-full ${survivalBar(rate)}`}
                        style={{ width: `${rate ?? 0}%` }}
                      />
                    </div>

                    <div className="grid grid-cols-5 gap-1 text-center">
                      <Cell label="Provided" value={r.provided} />
                      <Cell label="Planted" value={r.planted} />
                      <Cell label="Alive" value={alive} className="text-green-700" />
                      <Cell label="Dead" value={r.dead} className={r.dead ? "text-red-600" : undefined} />
                      <div>
                        <p className={`text-sm font-bold ${survivalTone(rate)}`}>
                          {rate === null ? "—" : `${rate}%`}
                        </p>
                        <p className="text-[9px] uppercase text-gray-400">Survival</p>
                      </div>
                    </div>

                    {unplanted > 0 && (
                      <p className="mt-2 text-[10px] text-gray-500">
                        {unplanted.toLocaleString()} provided but not yet reported
                        as planted.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <p className="mt-auto pt-3 text-[10px] text-gray-400">
            Planted and dead counts come from accepted progress reports.
          </p>
        </>
      )}
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  valueClass = "text-[#0F4A2F]",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-100">
      <p className="text-[10px] font-semibold uppercase text-gray-500 flex items-center gap-1">
        {icon} {label}
      </p>
      <p className={`text-lg font-bold ${valueClass}`}>{value}</p>
    </div>
  );
}

function Cell({
  label,
  value,
  className = "text-gray-800",
}: {
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <div>
      <p className={`text-sm font-bold ${className}`}>{value.toLocaleString()}</p>
      <p className="text-[9px] uppercase text-gray-400">{label}</p>
    </div>
  );
}
