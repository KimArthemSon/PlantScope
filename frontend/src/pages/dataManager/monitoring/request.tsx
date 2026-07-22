import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Package,
  Sprout,
  MapPin,
  User,
  Truck,
  Home,
  Eye,
  CheckCircle2,
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
  status: "all" | "pending" | "accepted" | "rejected" | "confirmed" | "cancelled";
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function SeedlingRequestsPage() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<SeedlingRequest[]>([]);
  const [filter, setFilter] = useState<Filter>({
    search: "",
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
      const params = new URLSearchParams({
        search: filter.search,
        status: filter.status,
      });

      const response = await fetch(`${API_BASE}api/requests/manager-list/?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to fetch seedling requests.");

      const data = await response.json();
      setRequests(data);
    } catch (err: any) {
      setPSAlert({ type: "error", title: "Failed", message: err.message || "Failed to load requests." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [filter.status, filter.search]);

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const statusCounts = {
    all: requests.length,
    pending: requests.filter((r) => r.status === "pending").length,
    accepted: requests.filter((r) => r.status === "accepted").length,
    rejected: requests.filter((r) => r.status === "rejected").length,
    confirmed: requests.filter((r) => r.status === "confirmed").length,
    cancelled: requests.filter((r) => r.status === "cancelled").length,
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-700 border-yellow-200",
      accepted: "bg-blue-100 text-blue-700 border-blue-200",
      confirmed: "bg-green-100 text-green-700 border-green-200",
      rejected: "bg-red-100 text-red-700 border-red-200",
      cancelled: "bg-gray-100 text-gray-600 border-gray-200",
    };
    return `px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styles[status] || styles.pending}`;
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-dvh bg-gray-50 flex-col">
      {PSalert && <PlantScopeAlert type={PSalert.type} title={PSalert.title} message={PSalert.message} onClose={() => setPSAlert(null)} />}

      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#0F4A2F]">Seedling Requests</h1>
          <p className="text-sm text-gray-500">Review, assign, and manage Tree Grower seedling assistance requests.</p>
        </div>

        {/* Modern Pill Filters & Search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex flex-wrap gap-2">
            {(["all", "pending", "accepted", "confirmed", "rejected", "cancelled"] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilter((prev) => ({ ...prev, status }))}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-all border ${
                  filter.status === status
                    ? "bg-[#0F4A2F] text-white border-[#0F4A2F] shadow-sm"
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}{" "}
                <span className={`ml-1 text-xs ${filter.status === status ? "text-green-100" : "text-gray-400"}`}>
                  ({statusCounts[status]})
                </span>
              </button>
            ))}
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="Search group or application..."
              value={filter.search}
              onChange={(e) => setFilter((prev) => ({ ...prev, search: e.target.value }))}
              className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm w-full md:w-72 focus:outline-none focus:ring-2 focus:ring-[#0F4A2F] focus:border-transparent"
            />
            <svg className="w-4 h-4 text-gray-400 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Enhanced Data Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading && <LoaderPending />}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Application / Group</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Site</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Seedlings</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Fulfillment</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Inspector</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {requests.length > 0 ? (
                  requests.map((req) => (
                    <tr key={req.request_id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="text-sm font-semibold text-gray-900">{req.application_title}</div>
                        <div className="text-xs text-gray-500">{req.group_name}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-700 flex items-center gap-1.5">
                          <MapPin size={14} className="text-gray-400" />
                          {req.site_name || <span className="text-gray-400 italic">Not assigned</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-bold text-[#0F4A2F]">{req.no_request_seedling.toLocaleString()}</div>
                        <div className="text-xs text-gray-500 truncate max-w-[150px]" title={req.species.map(s => `${s.species_name} (${s.quantity})`).join(", ")}>
                          {req.species.map(s => s.species_name).join(", ")}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {req.fulfillment_type ? (
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${
                            req.fulfillment_type === "deliver" ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700"
                          }`}>
                            {req.fulfillment_type === "deliver" ? <Truck size={12} /> : <Home size={12} />}
                            {req.fulfillment_type === "deliver" ? "Deliver to Site" : "Grower Pickup"}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-700 flex items-center gap-1.5">
                          <User size={14} className="text-gray-400" />
                          {req.inspector_name !== "Unassigned" ? req.inspector_name : <span className="text-gray-400 italic">Unassigned</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={getStatusBadge(req.status)}>
                          {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => navigate(`/DataManager/request-eval/${req.request_id}`)}
                          className={`p-2 rounded-lg transition-colors ${
                            req.status === "pending" 
                              ? "text-[#0F4A2F] hover:bg-green-50" 
                              : "text-gray-500 hover:bg-gray-100"
                          }`}
                          title={req.status === "pending" ? "Evaluate & Assign" : "View Details"}
                        >
                          {req.status === "pending" ? <CheckCircle2 size={18} /> : <Eye size={18} />}
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      <Package size={48} className="mx-auto mb-3 text-gray-300" />
                      <p className="text-sm font-medium">No seedling requests found.</p>
                      <p className="text-xs text-gray-400 mt-1">Try adjusting your search or filter criteria.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}