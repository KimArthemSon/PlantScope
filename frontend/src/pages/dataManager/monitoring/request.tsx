import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronRight,
  ChevronLeft,
  Package,
  Sprout,
  MapPin,
  User,
  Truck,
  Home,
  Eye,
  CheckCircle2,
  Search,
} from "lucide-react";
import PlantScopeAlert from "../../../components/alert/PlantScopeAlert";
import LoaderPending from "../../../components/layout/loaderSmall";
import { api } from "@/constant/api.ts";

// ─── Types ──────────────────────────────────────────────────────────────────

interface SeedlingSpeciesItem {
  species_id: number;
  species_name: string;
  quantity: number;
  provided_by: string;
}

interface SeedlingRequest {
  request_id: number;
  application_id: number;
  application_title: string;
  group_name: string;
  group_contact: string;
  site_name: string | null;
  no_request_seedling: number;
  species: SeedlingSpeciesItem[];
  status: "pending" | "accepted" | "rejected" | "confirmed" | "cancelled";
  fulfillment_type: "pickup" | "deliver" | null;
  inspector_name: string;
  submitted_at: string | null;
}

interface Filter {
  search: string;
  entries: number;
  page: number;
  status: "all" | "pending" | "accepted" | "rejected" | "confirmed" | "cancelled";
}

interface RequestStats {
  total: number;
  pending: number;
  accepted: number;
  rejected: number;
  confirmed: number;
  cancelled: number;
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function SeedlingRequestsPage() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<SeedlingRequest[]>([]);
  const [stats, setStats] = useState<RequestStats>({
    total: 0,
    pending: 0,
    accepted: 0,
    rejected: 0,
    confirmed: 0,
    cancelled: 0,
  });
  
  const [filter, setFilter] = useState<Filter>({
    search: "",
    entries: 10,
    page: 1,
    status: "all",
  });
  
  const [loading, setLoading] = useState(false);
  const [PSalert, setPSAlert] = useState<{
    type: "success" | "failed" | "error";
    title: string;
    message: string;
  } | null>(null);

  const token = localStorage.getItem("token");
  const API_BASE = api;

  // ─── Fetch Data ───────────────────────────────────────────────────────────
  const fetchRequests = async () => {
    setLoading(true);
    try {
      // Fetch ALL requests (no status filter in URL) so we can calculate stats correctly
      const params = new URLSearchParams({
        search: filter.search,
      });

      const response = await fetch(`${API_BASE}api/requests/manager-list/?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!response.ok) throw new Error("Failed to fetch seedling requests.");

      const data = await response.json();
      
      // Backend returns a simple array
      const requestList = Array.isArray(data) ? data : [];
      setRequests(requestList);

      // Calculate stats locally from the full list
      setStats({
        total: requestList.length,
        pending: requestList.filter((r) => r.status === "pending").length,
        accepted: requestList.filter((r) => r.status === "accepted").length,
        rejected: requestList.filter((r) => r.status === "rejected").length,
        confirmed: requestList.filter((r) => r.status === "confirmed").length,
        cancelled: requestList.filter((r) => r.status === "cancelled").length,
      });
      
      // Reset to page 1 when data loads
      setFilter(prev => ({ ...prev, page: 1 }));
    } catch (err: any) {
      setPSAlert({ type: "error", title: "Failed", message: err.message || "Failed to load requests." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [filter.search]); // Only refetch when search changes

  // ─── Client-Side Filtering & Pagination ───────────────────────────────────
  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      const matchesStatus = filter.status === "all" || req.status === filter.status;
      const matchesSearch = 
        req.application_title.toLowerCase().includes(filter.search.toLowerCase()) ||
        req.group_name.toLowerCase().includes(filter.search.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [requests, filter.status, filter.search]);

  const totalPages = Math.ceil(filteredRequests.length / filter.entries);
  const paginatedRequests = filteredRequests.slice(
    (filter.page - 1) * filter.entries,
    filter.page * filter.entries
  );

  // Reset page if it exceeds total pages
  useEffect(() => {
    if (filter.page > totalPages && totalPages > 0) {
      setFilter(prev => ({ ...prev, page: totalPages }));
    }
  }, [totalPages, filter.page]);

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-700 border-yellow-200",
      accepted: "bg-blue-100 text-blue-700 border-blue-200",
      confirmed: "bg-green-100 text-green-700 border-green-200",
      rejected: "bg-red-100 text-red-700 border-red-200",
      cancelled: "bg-gray-100 text-gray-600 border-gray-200",
    };
    return `px-2.5 py-1 rounded-full text-[.7rem] font-semibold border ${styles[status] || styles.pending}`;
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: "Pending",
      accepted: "Accepted",
      confirmed: "Confirmed",
      rejected: "Rejected",
      cancelled: "Cancelled",
    };
    return labels[status] || status;
  };

  const handleStatusChange = (newStatus: Filter["status"]) => {
    setFilter({ ...filter, status: newStatus, page: 1 });
  };

  return (
    <div className="flex min-h-dvh bg-gray-50 justify-center flex-col">
      {PSalert && <PlantScopeAlert type={PSalert.type} title={PSalert.title} message={PSalert.message} onClose={() => setPSAlert(null)} />}

      <main className="flex-1 p-8 max-w-7xl mx-auto w-full">
        {/* Header */}
        <div className="mb-7">
          <h1 className="text-2xl font-bold text-[#0F4A2F]">Seedling Requests</h1>
          <p className="text-sm text-gray-500">Review, assign, and manage Tree Grower seedling assistance requests.</p>
        </div>

        {/* Tab Filters */}
        <div className="flex gap-2 mb-6 border-b border-gray-200 pb-1">
          {(["all", "pending", "accepted", "confirmed", "rejected", "cancelled"] as const).map((status) => (
            <button
              key={status}
              onClick={() => handleStatusChange(status)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${
                filter.status === status
                  ? "border-[#0F4A2F] text-[#0F4A2F]"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
              <span
                className={`px-2 py-0.5 rounded-full text-xs ${
                  filter.status === status
                    ? "bg-[#0F4A2F] text-white"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {stats[status]}
              </span>
            </button>
          ))}
        </div>

        {/* Filters Row */}
        <div className="flex items-center mb-7 gap-4 flex-wrap">
          <label className="text-sm font-medium text-gray-600">Show:</label>
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

          <div className="relative ml-auto">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="Search group or application..."
              value={filter.search}
              onChange={(e) =>
                setFilter((prev) => ({
                  ...prev,
                  search: e.target.value,
                  page: 1,
                }))
              }
              className="border border-gray-300 rounded-md pl-8 pr-3 py-2 w-72 text-sm focus:border-[#0F4A2F] focus:outline-none"
            />
          </div>
        </div>

        {/* Enhanced Data Table */}
        <div className="overflow-x-auto shadow-lg rounded-sm border border-gray-200 bg-white">
          {loading && <LoaderPending />}
          {!loading && (
            <table className="min-w-full">
              <thead className="bg-[#0f4a2fe0] text-white">
                <tr>
                  <th className="py-3 px-5 text-left text-[.85rem] font-semibold">No</th>
                  <th className="py-3 px-5 text-left text-[.85rem] font-semibold">Application / Group</th>
                  <th className="py-3 px-5 text-left text-[.85rem] font-semibold">Site</th>
                  <th className="py-3 px-5 text-left text-[.85rem] font-semibold">Seedlings</th>
                  <th className="py-3 px-5 text-left text-[.85rem] font-semibold">Fulfillment</th>
                  <th className="py-3 px-5 text-left text-[.85rem] font-semibold">Inspector</th>
                  <th className="py-3 px-5 text-left text-[.85rem] font-semibold">Status</th>
                  <th className="py-3 px-5 text-right text-[.85rem] font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRequests.length > 0 ? (
                  paginatedRequests.map((req, index) => (
                    <tr
                      key={req.request_id}
                      className={`${
                        index % 2 === 0 ? "bg-white" : "bg-gray-50"
                      } transition hover:bg-green-50/30`}
                    >
                      <td className="py-3 px-5 text-[.85rem] text-gray-600">
                        {index + 1 + (filter.page - 1) * filter.entries}
                      </td>
                      <td className="py-3 px-5">
                        <div>
                          <h4 className="font-bold text-[.85rem] text-gray-800">
                            {req.application_title}
                          </h4>
                          <span className="text-[.7rem] text-gray-500">
                            {req.group_name}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-5 text-[.85rem]">
                        <div className="text-sm text-gray-700 flex items-center gap-1.5">
                          <MapPin size={14} className="text-gray-400" />
                          {req.site_name || (
                            <span className="text-gray-400 italic">Not assigned</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-5">
                        <div className="text-sm font-bold text-[#0F4A2F]">
                          {req.no_request_seedling.toLocaleString()}
                        </div>
                        <div
                          className="text-xs text-gray-500 truncate max-w-[150px]"
                          title={req.species
                            .map((s) => `${s.species_name} (${s.quantity})`)
                            .join(", ")}
                        >
                          {req.species.map((s) => s.species_name).join(", ")}
                        </div>
                      </td>
                      <td className="py-3 px-5 text-[.85rem]">
                        {req.fulfillment_type ? (
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${
                              req.fulfillment_type === "deliver"
                                ? "bg-blue-50 text-blue-700"
                                : "bg-purple-50 text-purple-700"
                            }`}
                          >
                            {req.fulfillment_type === "deliver" ? (
                              <Truck size={12} />
                            ) : (
                              <Home size={12} />
                            )}
                            {req.fulfillment_type === "deliver"
                              ? "Deliver to Site"
                              : "Grower Pickup"}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-5 text-[.85rem] text-gray-700">
                        <div className="flex items-center gap-1.5">
                          <User size={14} className="text-gray-400" />
                          {req.inspector_name !== "Unassigned" ? (
                            req.inspector_name
                          ) : (
                            <span className="text-gray-400 italic">Unassigned</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-5">
                        <span className={getStatusBadge(req.status)}>
                          {getStatusLabel(req.status)}
                        </span>
                      </td>
                      <td className="py-3 px-5 text-right">
                        <button
                          onClick={() =>
                            navigate(`/DataManager/request-eval/${req.request_id}`)
                          }
                          className={`p-2 rounded-lg transition-colors ${
                            req.status === "pending"
                              ? "text-[#0F4A2F] hover:bg-green-50"
                              : "text-gray-500 hover:bg-gray-100"
                          }`}
                          title={
                            req.status === "pending" ? "Evaluate & Assign" : "View Details"
                          }
                        >
                          {req.status === "pending" ? (
                            <CheckCircle2 size={18} />
                          ) : (
                            <Eye size={18} />
                          )}
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-gray-500 italic bg-gray-50">
                      {filter.search
                        ? `No results for "${filter.search}"`
                        : "No seedling requests found."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center gap-1 mt-5 w-full justify-end">
            <button
              disabled={filter.page <= 1}
              onClick={() =>
                setFilter((prev) => ({ ...prev, page: prev.page - 1 }))
              }
              className="px-3 py-1.5 border rounded-lg text-gray-700 hover:bg-gray-100 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <ChevronLeft size={16} /> Prev
            </button>

            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (filter.page <= 3) {
                pageNum = i + 1;
              } else if (filter.page >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
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
                      ? "bg-[#0F4A2F] text-white border-[#0F4A2F]"
                      : "text-gray-700 hover:bg-gray-100 border-gray-300"
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              disabled={filter.page >= totalPages}
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