import { useEffect, useState } from "react";
import {
  ChevronRight,
  ChevronLeft,
  Leaf,
  VerifiedIcon,
  Search,
} from "lucide-react";
import PlantScopeAlert from "../../../components/alert/PlantScopeAlert";
import { useNavigate } from "react-router-dom";
import LoaderPending from "../../../components/layout/loaderSmall";
import { useUserRole } from "@/hooks/authorization";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Application {
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
}

interface Filter {
  search: string;
  entries: number;
  page: number;
  total_page: number;
  status: string;
  classification: string;
}
import { api } from "@/constant/api.ts";

// ─── Status Config ──────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string }
> = {
  accepted: { label: "Active", bg: "bg-green-100", text: "text-green-700" },
  under_monitoring: {
    label: "Monitoring",
    bg: "bg-blue-100",
    text: "text-blue-700",
  },
  completed: { label: "Completed", bg: "bg-gray-100", text: "text-gray-700" },
  rejected: { label: "Rejected", bg: "bg-red-100", text: "text-red-700" },
};

// ─── Main Component ─────────────────────────────────────────────────────────

export default function Monitoring() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [filter, setFilter] = useState<Filter>({
    search: "",
    entries: 10,
    page: 1,
    total_page: 1,
    status: "All", // Show both accepted and under_monitoring by default
    classification: "All",
  });

  const [loading, setLoading] = useState(false);
  const [PSalert, setPSAlert] = useState<{
    type: "success" | "failed" | "error";
    title: string;
    message: string;
  } | null>(null);

  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const API_BASE = api;

  // ─── Fetch Applications ───────────────────────────────────────────────────

  const fetchApplications = async () => {
    setLoading(true);
    try {
      // Build params - status filter handles both accepted and under_monitoring
      const params = new URLSearchParams({
        search: filter.search,
        page: filter.page.toString(),
        entries: filter.entries.toString(),
        classification: filter.classification,
      });

      // Only add status filter if not "All"
      if (filter.status !== "All") {
        params.append("status", filter.status);
      }

      const response = await fetch(
        `${API_BASE}api/get_applications/?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!response.ok) throw new Error("Failed to fetch applications.");

      const data = await response.json();

      // Client-side filter for monitoring statuses if "All" is selected
      let apps = data.data;
      if (filter.status === "All") {
        apps = apps.filter(
          (app: Application) =>
            app.status === "accepted" || app.status === "under_monitoring",
        );
      }

      setApplications(apps);
      setFilter((prev) => ({ ...prev, total_page: data.total_page }));
    } catch (err: any) {
      setPSAlert({
        type: "error",
        title: "Failed",
        message: err.message || "Failed to load applications.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, [filter.page, filter.entries, filter.classification, filter.status]);

  const { userRole } = useUserRole();
  const [useruserRole, setUseruserRole] = useState("");

  useEffect(() => {
    if (userRole === "treeGrowers" || userRole === "CityENROHead") {
      setUseruserRole("");
      return;
    }
    if (userRole === "GISSpecialist") {
      setUseruserRole("/GISS");
      return;
    }
    if (userRole === "DataManager") {
      setUseruserRole("/DataManager");
      return;
    }
  }, [userRole]);

  // ─── Navigate to Maintenance Report ───────────────────────────────────────

  const handleViewReport = (applicationId: number) => {
    // Navigate with application_id as route param
    navigate(`${useruserRole}/maintenance_evaluation/${applicationId}`);
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-dvh bg-gray-50 justify-center flex-col">
      {PSalert && (
        <PlantScopeAlert
          type={PSalert.type}
          title={PSalert.title}
          message={PSalert.message}
          onClose={() => setPSAlert(null)}
        />
      )}

      <main className="flex-1 p-8">
        {/* Header */}
        <div className="mb-7">
          <h1 className="text-2xl font-bold text-[#0F4A2F]">Active Programs</h1>
          <p className="text-sm text-gray-500">
            Monitor and evaluate ongoing tree planting applications
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center mb-7 gap-4 flex-wrap">
          <label className="text-sm font-medium text-gray-600">
            Show entries:
          </label>
          <select
            value={filter.entries}
            onChange={(e) =>
              setFilter((prev) => ({
                ...prev,
                entries: Number(e.target.value),
                page: 1,
              }))
            }
            className="border border-gray-300 p-2 rounded-md text-sm focus:border-[#0F4A2F] focus:outline-none"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>

          <label className="text-sm font-medium text-gray-600">
            Classification:
          </label>
          <select
            value={filter.classification}
            onChange={(e) =>
              setFilter((prev) => ({
                ...prev,
                classification: e.target.value,
                page: 1,
              }))
            }
            className="border border-gray-300 p-2 rounded-md text-sm focus:border-[#0F4A2F] focus:outline-none"
          >
            <option value="All">All</option>
            <option value="new">New</option>
            <option value="old">Old</option>
          </select>

          <label className="text-sm font-medium text-gray-600">Status:</label>
          <select
            value={filter.status}
            onChange={(e) =>
              setFilter((prev) => ({
                ...prev,
                status: e.target.value,
                page: 1,
              }))
            }
            className="border border-gray-300 p-2 rounded-md text-sm focus:border-[#0F4A2F] focus:outline-none"
          >
            <option value="All">All Active</option>
            <option value="accepted">Active</option>
            <option value="under_monitoring">Monitoring</option>
            <option value="completed">Completed</option>
            <option value="rejected">Rejected</option>
          </select>

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
                if (e.key === "Enter") fetchApplications();
              }}
              className="border border-gray-300 rounded-md pl-8 pr-3 py-2 w-72 text-sm focus:border-[#0F4A2F] focus:outline-none"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto shadow-lg rounded-sm border border-gray-200">
          {loading && <LoaderPending />}
          <table className="min-w-full bg-white rounded-sm">
            <thead className="bg-[#0f4a2fe0] text-white">
              <tr>
                <th className="py-3 px-5 text-left text-[.9rem]">No</th>
                <th className="py-3 px-5 text-left text-[.9rem]">
                  Organization
                </th>
                <th className="py-3 px-5 text-left text-[.9rem]">Title</th>
                <th className="py-3 px-5 text-left text-[.9rem]">Status</th>
                <th className="py-3 px-5 text-left text-[.9rem]">
                  Classification
                </th>
                <th className="py-3 px-5 text-left text-[.9rem]">Members</th>
                <th className="py-3 px-5 text-left text-[.9rem]">Created</th>
                <th className="py-3 px-5 text-left text-[.9rem]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {applications.length > 0 ? (
                applications.map((app, index) => {
                  const statusConf =
                    STATUS_CONFIG[app.status] || STATUS_CONFIG.accepted;
                  return (
                    <tr
                      key={app.application_id}
                      className={`${index % 2 === 0 ? "" : "bg-[#0F4A2F0D]"} transition hover:bg-[#0F4A2F05]`}
                    >
                      <td className="py-3 px-5 text-[.9rem]">
                        {index + 1 + (filter.page - 1) * filter.entries}
                      </td>
                      <td className="py-3 px-5">
                        <div className="flex items-center gap-3">
                          {app.org_profile ? (
                            <img
                              src={`${API_BASE}/${app.org_profile}`}
                              className="rounded-full h-12 w-12 object-cover border border-gray-200"
                              alt="Organization"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src =
                                  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 24 24' fill='none' stroke='%230F4A2F' stroke-width='1'/%3E%3Crect x='3' y='3' width='18' height='18' rx='2'/%3E%3Cpath d='M7 7h10M7 11h10M7 15h6'/%3E%3C/svg%3E";
                              }}
                            />
                          ) : (
                            <div className="h-12 w-12 rounded-full bg-green-50 flex items-center justify-center border border-gray-200">
                              <Leaf size={20} className="text-green-300" />
                            </div>
                          )}
                          <div>
                            <h4 className="font-bold text-[.85rem] text-gray-800">
                              {app.organization_name}
                            </h4>
                            <span className="text-[.7rem] text-gray-500">
                              {app.org_email}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td
                        className="py-3 px-5 text-[.9rem] max-w-xs truncate"
                        title={app.title}
                      >
                        {app.title}
                      </td>
                      <td className="py-3 px-5">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${statusConf.bg} ${statusConf.text}`}
                        >
                          {statusConf.label}
                        </span>
                      </td>
                      <td className="py-3 px-5 text-[.9rem] capitalize">
                        {app.classification}
                      </td>
                      <td className="py-3 px-5 text-[.9rem]">
                        {app.total_members}
                      </td>
                      <td className="py-3 px-5 text-[.9rem] text-gray-500">
                        {app.created_at}
                      </td>
                      <td className="py-3 px-5">
                        <button
                          onClick={() => handleViewReport(app.application_id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0F4A2F] text-white text-xs font-semibold hover:bg-[#1a6b44] transition-colors"
                          title="View maintenance reports"
                        >
                          <VerifiedIcon size={14} />
                          View Reports
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-gray-500">
                    {filter.search
                      ? `No results for "${filter.search}"`
                      : "No applications found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filter.total_page > 1 && (
          <div className="flex items-center gap-1 mt-5 w-full">
            <button
              disabled={filter.page <= 1}
              onClick={() =>
                setFilter((prev) => ({ ...prev, page: prev.page - 1 }))
              }
              className="px-3 py-1.5 border rounded-lg text-gray-700 hover:bg-gray-100 ml-auto cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <ChevronLeft size={16} /> Prev
            </button>

            {Array.from({ length: Math.min(5, filter.total_page) }, (_, i) => {
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
            })}

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
        )}
      </main>
    </div>
  );
}
