import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, MapPin, Gavel, CheckCircle2, XCircle, Package, Trees, TrendingUp, Ruler, ExternalLink, Users, FileText, Undo2 } from "lucide-react";
import PlantScopeAlert from "@/components/alert/PlantScopeAlert";
import ReportAreaMap from "@/components/map/ReportAreaMap";
import ClosureDecisionPanel, { formatClosureDate } from "@/components/monitoring/ClosureDecisionPanel";
import type { ClosureRequest } from "@/components/monitoring/ClosureDecisionPanel";
import { api } from "@/constant/api";

// City ENRO Head: final completed / failed decision on programs the Data Manager recommends closing.

interface SiteDetail {
  site: { site_id: number; name: string; total_area_hectares: number; polygon_coordinates: [number, number][] | null };
  metrics: {
    total_planted: number;
    total_added: number;
    total_dead: number;
    total_survived: number;
    survival_rate: number;
    planted_area_hectares: number | null;
    planted_area_percent: number | null;
    planted_area_as_of: string | null;
  };
  total_seedlings_provided: number;
  progress_reports: Array<{
    report_id: number;
    status: string;
    visit_type: string;
    submitted_at: string | null;
    polygon_coordinates: [number, number][] | null;
    planted_area_hectares: number | null;
  }>;
}

export default function ProgramClosures() {
  const token = localStorage.getItem("token");
  const navigate = useNavigate();
  const [scope, setScope] = useState<"pending" | "decided">("pending");
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<ClosureRequest[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<SiteDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [alert, setAlert] = useState<{ type: "success" | "failed" | "error"; title: string; message: string } | null>(null);

  const fetchList = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ scope });
      if (search.trim()) params.append("search", search.trim());
      const res = await fetch(`${api}api/get_program_closure_requests/?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      setItems(data.data);
      setPendingCount(data.pending_count);
      setSelectedId((prev) => (data.data.some((c: ClosureRequest) => c.closure_request_id === prev) ? prev : data.data[0]?.closure_request_id ?? null));
    } catch (err: any) {
      setAlert({ type: "error", title: "Error", message: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(fetchList, 300);
    return () => clearTimeout(t);
  }, [scope, search]);

  const selected = items.find((c) => c.closure_request_id === selectedId) ?? null;

  // Site results for the selected program, so the Head can judge the recommendation
  useEffect(() => {
    if (!selected?.site) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    fetch(`${api}api/get_site_monitoring_details/${selected.site.site_id}/`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false));
  }, [selected?.closure_request_id]);

  const latestMap = detail?.progress_reports.find((r) => r.status === "accepted" && (r.polygon_coordinates?.length ?? 0) >= 3);
  const acceptedReports = detail?.progress_reports.filter((r) => r.status === "accepted").length ?? 0;
  const survival = detail?.metrics.survival_rate ?? 0;

  return (
    <div className="p-6 max-w-7xl mx-auto" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {alert && <PlantScopeAlert type={alert.type} title={alert.title} message={alert.message} onClose={() => setAlert(null)} />}

      <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
        <div>
          <h2 className="text-xl font-bold text-[#0F4A2F] flex items-center gap-2"><Gavel size={20} /> Program Closures</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            The Data Manager recommends ending a program as completed or failed. You make the final decision.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-white border border-gray-200 rounded-xl p-1">
            {(["pending", "decided"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setScope(s)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${scope === s ? "bg-[#0F4A2F] text-white" : "text-gray-600 hover:bg-gray-50"}`}
              >
                {s === "pending" ? `Needs decision (${pendingCount})` : "Decided"}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search site, area or program"
              className="pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#0F4A2F] w-60"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-5">
        {/* List */}
        <div className="w-full lg:w-80 shrink-0 space-y-2">
          {loading ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-sm text-gray-400">Loading…</div>
          ) : items.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
              <Gavel size={30} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm font-semibold text-gray-700">{scope === "pending" ? "No decisions waiting" : "No decisions yet"}</p>
              {scope === "pending" && <p className="text-xs text-gray-400 mt-1">Recommendations from the Data Manager appear here.</p>}
            </div>
          ) : (
            items.map((c) => {
              const active = c.closure_request_id === selectedId;
              const outcome = c.status === "approved" ? c.final_outcome : c.recommendation;
              return (
                <button
                  key={c.closure_request_id}
                  onClick={() => setSelectedId(c.closure_request_id)}
                  className={`w-full text-left bg-white rounded-xl border p-3.5 transition-all ${active ? "border-[#0F4A2F] ring-2 ring-[#0F4A2F]/15" : "border-gray-100 hover:border-gray-300"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-bold text-gray-800 leading-tight">{c.site?.name ?? c.application.title}</p>
                    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${outcome === "completed" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {c.status === "returned" ? "Returned" : outcome}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{c.application.group_name}</p>
                  <p className="text-[11px] text-gray-400 mt-1.5 flex items-center gap-1">
                    <MapPin size={11} /> {c.site?.reforestation_area_name ?? "—"} · {formatClosureDate(scope === "pending" ? c.requested_at : c.decided_at)}
                  </p>
                </button>
              );
            })
          )}
        </div>

        {/* Detail */}
        <div className="flex-1 min-w-0">
          {selected ? (
            <div className="flex flex-col xl:flex-row gap-5">
              <div className="flex-1 min-w-0 bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{selected.application.title}</h3>
                    <p className="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5">
                      <Users size={12} /> {selected.application.group_name} · {selected.site?.name}
                      {selected.site?.barangay_name ? ` · Brgy. ${selected.site.barangay_name}` : ""}
                    </p>
                  </div>
                  {selected.site && (
                    <button
                      onClick={() => navigate(`/site_monitoring/${selected.site!.site_id}`)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      <ExternalLink size={13} /> Full site history
                    </button>
                  )}
                </div>

                {detailLoading ? (
                  <div className="py-12 text-center text-sm text-gray-400">Loading site results…</div>
                ) : detail ? (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <Stat icon={<Package size={15} />} label="Seedlings provided" value={detail.total_seedlings_provided.toLocaleString()} />
                      <Stat icon={<Ruler size={15} />} label="Area planted" value={detail.metrics.planted_area_hectares != null ? `${detail.metrics.planted_area_hectares.toFixed(2)} ha` : "—"} sub={detail.metrics.planted_area_percent != null ? `${detail.metrics.planted_area_percent}% of site` : undefined} />
                      <Stat icon={<Trees size={15} />} label="Trees planted" value={(detail.metrics.total_planted + detail.metrics.total_added).toLocaleString()} sub={`${detail.metrics.total_dead.toLocaleString()} dead`} />
                      <Stat
                        icon={<TrendingUp size={15} />}
                        label="Survival rate"
                        value={`${survival.toFixed(1)}%`}
                        tone={survival >= 80 ? "green" : survival >= 50 ? "amber" : "red"}
                      />
                    </div>

                    {latestMap ? (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 mb-2">
                          Latest confirmed planted area · {formatClosureDate(latestMap.submitted_at)}
                        </p>
                        <ReportAreaMap
                          reportPolygon={latestMap.polygon_coordinates}
                          sitePolygon={detail.site.polygon_coordinates}
                          areaHectares={latestMap.planted_area_hectares}
                          height={340}
                        />
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 p-4 bg-gray-50 rounded-xl text-center">No confirmed planted-area map for this site yet.</p>
                    )}

                    <p className="text-xs text-gray-500 flex items-center gap-1.5">
                      <FileText size={13} /> {acceptedReports} accepted monitoring report{acceptedReports === 1 ? "" : "s"} · program started {formatClosureDate(selected.application.created_at)}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-gray-400">Couldn't load the site results.</p>
                )}
              </div>

              {/* Decision column */}
              <div className="w-full xl:w-80 shrink-0 space-y-3">
                {selected.status === "pending" ? (
                  <ClosureDecisionPanel
                    closure={selected}
                    onDone={(message) => { setAlert({ type: "success", title: "Decision Saved", message }); fetchList(); }}
                    onError={(message) => setAlert({ type: "failed", title: "Failed", message })}
                  />
                ) : (
                  <div className={`p-4 rounded-xl border ${selected.status === "returned" ? "bg-amber-50 border-amber-200" : selected.final_outcome === "completed" ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                    <p className="text-sm font-bold flex items-center gap-1.5">
                      {selected.status === "returned" ? (
                        <><Undo2 size={15} className="text-amber-600" /> Returned to Data Manager</>
                      ) : selected.final_outcome === "completed" ? (
                        <><CheckCircle2 size={15} className="text-green-600" /> Marked Completed</>
                      ) : (
                        <><XCircle size={15} className="text-red-600" /> Marked Failed</>
                      )}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">By {selected.decided_by ?? "—"} · {formatClosureDate(selected.decided_at)}</p>
                    {selected.head_notes && <p className="text-xs text-gray-700 bg-white rounded-lg border p-2.5 mt-2">“{selected.head_notes}”</p>}
                    <div className="mt-3 pt-3 border-t border-black/5 text-xs text-gray-600">
                      Recommended <strong className="uppercase">{selected.recommendation}</strong> by {selected.requested_by ?? "Data Manager"}:
                      <span className="block mt-1 text-gray-700">“{selected.recommendation_reason}”</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            !loading && <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-sm text-gray-400">Select a program to review.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, sub, tone }: { icon: React.ReactNode; label: string; value: string; sub?: string; tone?: "green" | "amber" | "red" }) {
  const cls =
    tone === "green" ? "bg-green-50 border-green-100 text-green-800"
    : tone === "amber" ? "bg-amber-50 border-amber-100 text-amber-800"
    : tone === "red" ? "bg-red-50 border-red-100 text-red-700"
    : "bg-gray-50 border-gray-100 text-gray-800";
  return (
    <div className={`p-3 rounded-xl border ${cls}`}>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide opacity-70">{icon} {label}</div>
      <p className="text-lg font-bold mt-1">{value}</p>
      {sub && <p className="text-[11px] opacity-70">{sub}</p>}
    </div>
  );
}
