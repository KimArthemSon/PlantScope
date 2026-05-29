import { useEffect, useState } from "react";
import {
  ChevronRight,
  ChevronLeft,
  Download,
  FileText,
  Search,
  Filter,
  Leaf,
  Trees,
  Users,
  Calendar,
  CheckCircle2,
} from "lucide-react";
import PlantScopeAlert from "../../../components/alert/PlantScopeAlert";
import LoaderPending from "../../../components/layout/loaderSmall";
import { useNavigate } from "react-router-dom";

// ─── Types ──────────────────────────────────────────────────────────────────

interface CompletedApplication {
  application_id: number;
  organization_name: string;
  org_email: string;
  org_profile: string;
  title: string;
  total_members: number;
  total_request_seedling: number;
  classification: "new" | "old";
  status: string;
  created_at: string;
  completed_at?: string; // Will be added via backend or calculated
}

interface Filter {
  search: string;
  entries: number;
  page: number;
  total_page: number;
  classification: string;
  date_from: string;
  date_to: string;
}

// ─── Summary Stats Type ─────────────────────────────────────────────────────

interface ReportStats {
  total_completed: number;
  total_seedlings: number;
  total_area: number;
  avg_members: number;
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function Reports() {
  const [applications, setApplications] = useState<CompletedApplication[]>([]);
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [filter, setFilter] = useState<Filter>({
    search: "",
    entries: 10,
    page: 1,
    total_page: 1,
    classification: "All",
    date_from: "",
    date_to: "",
  });

  const [loading, setLoading] = useState(false);
  const [PSalert, setPSAlert] = useState<{
    type: "success" | "failed" | "error";
    title: string;
    message: string;
  } | null>(null);

  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const API_BASE = "http://127.0.0.1:8000";

  // ─── Fetch Completed Applications ─────────────────────────────────────────

  const fetchCompletedApplications = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search: filter.search,
        page: filter.page.toString(),
        entries: filter.entries.toString(),
        classification: filter.classification,
        status: "completed", // Only completed applications
      });

      // Add date filters if provided
      if (filter.date_from) params.append("date_from", filter.date_from);
      if (filter.date_to) params.append("date_to", filter.date_to);

      const response = await fetch(
        `${API_BASE}/api/get_applications/?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!response.ok)
        throw new Error("Failed to fetch completed applications.");

      const data = await response.json();
      setApplications(data.data);
      setFilter((prev) => ({ ...prev, total_page: data.total_page }));

      // Calculate summary stats (client-side for now; backend could return these)
      const totalSeedlings = data.data.reduce(
        (sum: number, app: CompletedApplication) =>
          sum + (app.total_request_seedling || 0),
        0,
      );
      const totalMembers = data.data.reduce(
        (sum: number, app: CompletedApplication) =>
          sum + (app.total_members || 0),
        0,
      );
      setStats({
        total_completed: data.total,
        total_seedlings: totalSeedlings,
        total_area: 0, // Would need backend field
        avg_members: data.data.length > 0 ? totalMembers / data.data.length : 0,
      });
    } catch (err: any) {
      setPSAlert({
        type: "error",
        title: "Failed",
        message: err.message || "Failed to load completed applications.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompletedApplications();
  }, [filter.page, filter.entries, filter.classification, filter.search]);

  // ─── Export to CSV ────────────────────────────────────────────────────────

  const handleExportCSV = () => {
    if (applications.length === 0) {
      setPSAlert({
        type: "failed",
        title: "No Data",
        message: "No applications to export.",
      });
      return;
    }

    const headers = [
      "Application ID",
      "Organization",
      "Email",
      "Title",
      "Classification",
      "Members",
      "Seedlings Requested",
      "Created Date",
      "Status",
    ];

    const rows = applications.map((app) => [
      app.application_id,
      app.organization_name,
      app.org_email,
      app.title,
      app.classification,
      app.total_members,
      app.total_request_seedling,
      app.created_at,
      app.status,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row
          .map((cell) => {
            const str = String(cell).replace(/"/g, '""');
            return `"${str}"`;
          })
          .join(","),
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `completed_applications_${new Date().toISOString().split("T")[0]}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setPSAlert({
      type: "success",
      title: "Exported!",
      message: "Report downloaded as CSV.",
    });
  };

  // ─── Format Date ──────────────────────────────────────────────────────────

  const formatDate = (iso: string) =>
    iso
      ? new Date(iso).toLocaleDateString("en-PH", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : "—";

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen bg-gray-50"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      {PSalert && (
        <PlantScopeAlert
          type={PSalert.type}
          title={PSalert.title}
          message={PSalert.message}
          onClose={() => setPSAlert(null)}
        />
      )}


    

      <main className="max-w-7xl mx-auto p-6">
        {/* ── Summary Stats Cards ── */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
                  <CheckCircle2 size={20} className="text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">
                    Total Completed
                  </p>
                  <p className="text-2xl font-bold text-gray-800">
                    {stats.total_completed.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                  <Trees size={20} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">
                    Seedlings Planted
                  </p>
                  <p className="text-2xl font-bold text-gray-800">
                    {stats.total_seedlings.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                  <Users size={20} className="text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">
                    Avg. Members
                  </p>
                  <p className="text-2xl font-bold text-gray-800">
                    {Math.round(stats.avg_members).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
                  Export Report
                </p>
                <p className="text-sm text-gray-600">Download as CSV</p>
              </div>
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0F4A2F] text-white text-sm font-semibold hover:bg-[#1a6b44] transition-colors"
              >
                <Download size={16} /> Export
              </button>
            </div>
          </div>
        )}

        {/* ── Filters ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-gray-400" />
              <span className="text-sm font-medium text-gray-600">
                Filters:
              </span>
            </div>

            {/* <select
              value={filter.classification}
              onChange={(e) =>
                setFilter((prev) => ({
                  ...prev,
                  classification: e.target.value,
                  page: 1,
                }))
              }
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-[#0F4A2F] focus:outline-none"
            >
              <option value="All">All Classifications</option>
              <option value="new">New</option>
              <option value="old">Old</option>
            </select> */}

            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-gray-400" />
              <input
                type="date"
                value={filter.date_from}
                onChange={(e) =>
                  setFilter((prev) => ({
                    ...prev,
                    date_from: e.target.value,
                    page: 1,
                  }))
                }
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-[#0F4A2F] focus:outline-none"
              />
              <span className="text-gray-400">to</span>
              <input
                type="date"
                value={filter.date_to}
                onChange={(e) =>
                  setFilter((prev) => ({
                    ...prev,
                    date_to: e.target.value,
                    page: 1,
                  }))
                }
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-[#0F4A2F] focus:outline-none"
              />
            </div>

            <div className="relative ml-auto">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                placeholder="Search applications..."
                value={filter.search}
                onChange={(e) =>
                  setFilter((prev) => ({
                    ...prev,
                    search: e.target.value,
                    page: 1,
                  }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") fetchCompletedApplications();
                }}
                className="border border-gray-300 rounded-lg pl-8 pr-3 py-2 w-64 text-sm focus:border-[#0F4A2F] focus:outline-none"
              />
            </div>

            <button
              onClick={fetchCompletedApplications}
              className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition-colors"
            >
              Apply Filters
            </button>
          </div>
        </div>

        {/* ── Table ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {loading && <LoaderPending />}

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-[#0f4a2fe0] text-white">
                <tr>
                  <th className="py-4 px-5 text-left text-sm font-semibold">
                    No
                  </th>
                  <th className="py-4 px-5 text-left text-sm font-semibold">
                    Organization
                  </th>
                  <th className="py-4 px-5 text-left text-sm font-semibold">
                    Program Title
                  </th>
                  <th className="py-4 px-5 text-left text-sm font-semibold">
                    Classification
                  </th>
                  <th className="py-4 px-5 text-left text-sm font-semibold">
                    Members
                  </th>
                  <th className="py-4 px-5 text-left text-sm font-semibold">
                    Seedlings
                  </th>
                  <th className="py-4 px-5 text-left text-sm font-semibold">
                    Completed
                  </th>
                  <th className="py-4 px-5 text-left text-sm font-semibold">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {applications.length > 0 ? (
                  applications.map((app, index) => (
                    <tr
                      key={app.application_id}
                      className={`${
                        index % 2 === 0 ? "" : "bg-[#0F4A2F0D]"
                      } transition hover:bg-[#0F4A2F05]`}
                    >
                      <td className="py-4 px-5 text-sm">
                        {index + 1 + (filter.page - 1) * filter.entries}
                      </td>
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          {app.org_profile ? (
                            <img
                              src={`${API_BASE}/${app.org_profile}`}
                              className="w-10 h-10 rounded-full object-cover border border-gray-200"
                              alt="Organization"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src =
                                  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 24 24' fill='none' stroke='%230F4A2F' stroke-width='1'/%3E%3Crect x='3' y='3' width='18' height='18' rx='2'/%3E%3Cpath d='M7 7h10M7 11h10M7 15h6'/%3E%3C/svg%3E";
                              }}
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center border border-gray-200">
                              <Leaf size={18} className="text-green-300" />
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-sm text-gray-800">
                              {app.organization_name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {app.org_email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td
                        className="py-4 px-5 text-sm text-gray-700 max-w-xs truncate"
                        title={app.title}
                      >
                        {app.title}
                      </td>
                      <td className="py-4 px-5">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${
                            app.classification === "new"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {app.classification}
                        </span>
                      </td>
                      <td className="py-4 px-5 text-sm font-medium text-gray-800">
                        {app.total_members.toLocaleString()}
                      </td>
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-1.5 text-sm">
                          <Trees size={14} className="text-green-500" />
                        
                        </div>
                      </td>
                      <td className="py-4 px-5 text-sm text-gray-500">
                        {formatDate(app.created_at)}
                      </td>
                      <td className="py-4 px-5">
                        <button
                          onClick={() =>
                            navigate(
                              `/DataManager/maintenance_evaluation/${app.application_id}`,
                            )
                          }
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-50 transition-colors"
                          title="View details"
                        >
                          <FileText size={14} /> View
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-gray-500">
                      {filter.search || filter.classification !== "All"
                        ? "No completed applications match your filters."
                        : "No completed applications found."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Pagination ── */}
        {filter.total_page > 1 && (
          <div className="flex items-center justify-between mt-6">
            <p className="text-sm text-gray-500">
              Showing {(filter.page - 1) * filter.entries + 1} to{" "}
              {Math.min(filter.page * filter.entries, applications.length)} of{" "}
              {stats?.total_completed.toLocaleString()} results
            </p>

            <div className="flex items-center gap-1">
              <button
                disabled={filter.page <= 1}
                onClick={() =>
                  setFilter((prev) => ({ ...prev, page: prev.page - 1 }))
                }
                className="px-3 py-1.5 border rounded-lg text-gray-700 hover:bg-gray-100 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                <ChevronLeft size={16} /> Prev
              </button>

              {Array.from(
                { length: Math.min(5, filter.total_page) },
                (_, i) => {
                  let pageNum;
                  if (filter.total_page <= 5) {
                    pageNum = i + 1;
                  } else if (filter.page <= 3) {
                    pageNum = i + 1;
                  } else if (filter.page >= filter.total_page - 2) {
                    pageNum = filter.total_page - 4 + i;
                  } else {
                    pageNum = filter.page - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() =>
                        setFilter((prev) => ({ ...prev, page: pageNum }))
                      }
                      className={`px-3 py-1.5 border rounded-lg cursor-pointer text-sm ${
                        pageNum === filter.page
                          ? "bg-[#0F4A2F] text-white"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                },
              )}

              <button
                disabled={filter.page >= filter.total_page}
                onClick={() =>
                  setFilter((prev) => ({ ...prev, page: prev.page + 1 }))
                }
                className="px-3 py-1.5 border rounded-lg text-gray-700 hover:bg-gray-100 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                Next <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
