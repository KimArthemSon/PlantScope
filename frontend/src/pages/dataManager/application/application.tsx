import { useEffect, useState } from "react";
import { ChevronRight, ChevronLeft, VerifiedIcon } from "lucide-react";
import PlantScopeAlert from "../../../components/alert/PlantScopeAlert";
import { useNavigate } from "react-router-dom";
import LoaderPending from "../../../components/layout/loaderSmall";
import { api } from "@/constant/api";

// ✅ Updated Interface to match new backend response
interface Application {
  application_id: number;
  group_name: string;
  group_type: string;
  group_profile: string | null;
  title: string;
  total_treegrowers_will_participate: number;
  classification: string; // 'new' (First-Time) or 'old' (Returning)
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

export default function Application() {
  const [application, setApplication] = useState<Application[]>([]);
  const [filter, setFilter] = useState<Filter>({
    search: "",
    entries: 10,
    page: 1,
    total_page: 1,
    status: "for_evaluation",
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

  // Fetch Application from backend
  const fetchApplication = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search: filter.search,
        page: filter.page.toString(),
        entries: filter.entries.toString(),
        classification: filter.classification.toString(),
        status: filter.status.toString(),
      });

      const response = await fetch(
        `${api}api/get_applications/?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!response.ok) throw new Error("Failed to fetch Application.");

      const data = await response.json();
      setApplication(data.data);
      setFilter((prev) => ({ ...prev, total_page: data.total_page }));
    } catch (err) {
      setPSAlert({
        type: "error",
        title: "Failed",
        message: "Failed to load Application.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplication();
  }, [filter.page, filter.entries, filter.classification, filter.status]);

  // ✅ Helper to format status text (e.g., "for_evaluation" -> "For Evaluation")
  const formatStatus = (status: string) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // ✅ Helper to get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'for_evaluation': return 'bg-yellow-100 text-yellow-800';
      case 'for_head': return 'bg-blue-100 text-blue-800';
      case 'accepted': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'under_monitoring': return 'bg-purple-100 text-purple-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // ✅ Helper to show First-Time vs Returning badge
  const getClassificationBadge = (classification: string) => {
    if (classification === 'new') {
      return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">First-Time</span>;
    }
    return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">Returning</span>;
  };

  return (
    <div className="flex min-h-dvh bg-gray-50 justify-center items-center flex-col">
      {PSalert && (
        <PlantScopeAlert
          type={PSalert.type}
          title={PSalert.title}
          message={PSalert.message}
          onClose={() => setPSAlert(null)}
        />
      )}

      <main className="flex-1 p-8 w-full max-w-6xl mx-auto">
        {/* Filters */}
        <div className="flex items-center mb-7 gap-4 flex-wrap">
          <label className="text-sm font-medium text-gray-700">Show entries: </label>
          <select
            value={filter.entries}
            onChange={(e) =>
              setFilter((prev) => ({
                ...prev,
                entries: Number(e.target.value),
                page: 1,
              }))
            }
            className="border border-gray-300 p-2 rounded-md text-[.8rem] focus:ring-2 focus:ring-green-500 outline-none"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>

          <label className="text-sm font-medium text-gray-700">Classification:</label>
          <select
            value={filter.classification}
            onChange={(e) =>
              setFilter((prev) => ({
                ...prev,
                classification: e.target.value,
                page: 1,
              }))
            }
            className="border border-gray-300 p-2 rounded-md text-[.8rem] focus:ring-2 focus:ring-green-500 outline-none"
          >
            <option value="All">All</option>
            <option value="new">First-Time (New)</option>
            <option value="old">Returning (Old)</option>
          </select>

          <label className="text-sm font-medium text-gray-700">Status:</label>
          <select
            value={filter.status}
            onChange={(e) =>
              setFilter((prev) => ({
                ...prev,
                status: e.target.value,
                page: 1,
              }))
            }
            className="border border-gray-300 p-2 rounded-md text-[.8rem] focus:ring-2 focus:ring-green-500 outline-none"
          >
            <option value="for_evaluation">For Evaluation</option>
            <option value="for_head">For Head Confirmation</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
            <option value="under_monitoring">Under Monitoring</option>
            <option value="completed">Completed</option>
            <option value="All">All Statuses</option>
          </select>

          <input
            type="text"
            placeholder="Search Group Name..."
            value={filter.search}
            onChange={(e) =>
              setFilter((prev) => ({
                ...prev,
                search: e.target.value,
                page: 1,
              }))
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                fetchApplication();
              }
            }}
            className="border border-gray-300 rounded-md p-2 w-64 text-[.8rem] ml-auto focus:ring-2 focus:ring-green-500 outline-none"
          />
        </div>

        {/* Table */}
        <div className="overflow-x-auto shadow-lg rounded-sm border border-gray-200 bg-white">
          {loading && <LoaderPending />}
          <table className="relative min-w-full">
            <thead className="bg-[#0f4a2fe0] text-white">
              <tr>
                <th className="py-3 px-5 text-left text-[.9rem]">No</th>
                <th className="py-3 px-5 text-left text-[.9rem]">Group</th>
                <th className="py-3 px-5 text-left text-[.9rem]">Title</th>
                <th className="py-3 px-5 text-left text-[.9rem]">Status</th>
                <th className="py-3 px-5 text-left text-[.9rem]">Classification</th>
                <th className="py-3 px-5 text-left text-[.9rem]">Tree Growers</th>
                <th className="py-3 px-5 text-left text-[.9rem]">Created At</th>
                <th className="py-3 px-5 text-left text-[.9rem]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {application.length > 0 ? (
                application.map((app, index) => (
                  <tr
                    key={app.application_id}
                    className={`${index % 2 === 0 ? "" : "bg-[#0F4A2F0D]"} transition hover:bg-gray-50`}
                  >
                    <td className="py-3 px-5 text-[.9rem] text-gray-700">
                      {index + 1 + (filter.page - 1) * filter.entries}
                    </td>
                    <td className="py-3 px-5">
                      <div className="flex gap-3 items-center">
                        <img
                          src={app.group_profile ? (app.group_profile.startsWith('http') ? app.group_profile : app.group_profile) : 'https://via.placeholder.com/60'}
                          className="rounded-full h-12 w-12 object-cover border border-gray-200"
                          alt="group profile"
                        />
                        <div>
                          <h4 className="font-bold text-[.8rem] text-gray-800">
                            {app.group_name}
                          </h4>
                          <span className="text-gray-500 text-[.7rem]">
                            {app.group_type}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-5 text-[.9rem] break-words max-w-[150px] text-gray-700">
                      {app.title}
                    </td>
                    <td className="py-3 px-5 text-[.9rem]">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(app.status)}`}>
                        {formatStatus(app.status)}
                      </span>
                    </td>
                    {/* ✅ Shows First-Time or Returning */}
                    <td className="py-3 px-5 text-[.9rem]">
                      {getClassificationBadge(app.classification)}
                    </td>
                    <td className="py-3 px-5 text-[.9rem] font-medium text-gray-700">
                      {app.total_treegrowers_will_participate}
                    </td>
                    <td className="py-3 px-5 text-[.9rem] text-gray-600">{app.created_at}</td>
                    <td className="py-3 px-5">
                      <div className="flex gap-2">
                        {app.status === "for_evaluation" && (
                          <button
                            onClick={() => {
                              navigate(`/DataManager/evaluation/${app.application_id}`);
                            }}
                            className="text-white bg-[#0f4a2f] hover:bg-[#0a3622] px-3 py-1.5 rounded-md flex items-center gap-1 cursor-pointer text-xs font-medium transition"
                          >
                            <VerifiedIcon size={16} />
                            Evaluate
                          </button>
                        )}
                        {app.status === "for_head" && (
                          <span className="text-blue-600 text-xs font-medium italic px-2 py-1">
                            Pending Head Approval
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={8}
                    className="text-center py-5 text-gray-500 italic"
                  >
                    No applications found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center gap-1 mt-5 w-full">
          <button
            disabled={filter.page <= 1}
            onClick={() =>
              setFilter((prev) => ({ ...prev, page: prev.page - 1 }))
            }
            className="px-2 py-1 border rounded-md text-gray-700 hover:bg-gray-100 ml-auto cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={19} />
          </button>

          {Array.from({ length: filter.total_page }, (_, i) => i + 1).map(
            (p) => (
              <button
                key={p}
                onClick={() => setFilter((prev) => ({ ...prev, page: p }))}
                className={`px-2 py-1 border rounded-md cursor-pointer text-[.8rem] ${
                  p === filter.page
                    ? "bg-green-600 text-white"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                {p}
              </button>
            )
          )}

          <button
            disabled={filter.page >= filter.total_page}
            onClick={() =>
              setFilter((prev) => ({ ...prev, page: prev.page + 1 }))
            }
            className="px-2 py-1 border rounded-md text-gray-700 hover:bg-gray-100 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight size={19} />
          </button>
        </div>
      </main>
    </div>
  );
}