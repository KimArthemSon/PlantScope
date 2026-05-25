import { useEffect, useState } from "react";
import {
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  XCircle,
  Eye,
  Package,
  Sprout,
  FileText,
  Plus,
  Trash2,
} from "lucide-react";
import PlantScopeAlert from "../../../components/alert/PlantScopeAlert";
import { useNavigate } from "react-router-dom";
import LoaderPending from "../../../components/layout/loaderSmall";

// ─── Types ──────────────────────────────────────────────────────────────────

interface SeedlingRequest {
  request_id: number;
  application_id: number;
  application_title: string;
  organization_name: string;
  org_email: string;
  no_request_seedling: number;
  seedling_type: Record<string, { quantity: number; provided_by: string }>;
  status: "pending" | "accepted" | "rejected";
  reason_accepted: string | null;
  description: string;
  submitted_at: string | null;
}

interface Filter {
  search: string;
  entries: number;
  page: number;
  total_page: number;
  status: string;
}

// Helper to parse nested seedling_type into array for editing
const parseProvisionToArray = (
  seedlingType: Record<string, { quantity: number; provided_by: string }>
) => {
  return Object.entries(seedlingType).map(([species, data]) => ({
    species,
    quantity: data.quantity,
    provided_by: data.provided_by,
  }));
};

// Helper to convert array back to nested object for API
const formatProvisionToObject = (
  arr: { species: string; quantity: number; provided_by: string }[]
) => {
  const obj: Record<string, { quantity: number; provided_by: string }> = {};
  arr.forEach((item) => {
    if (item.species.trim() && item.quantity > 0) {
      obj[item.species.trim()] = {
        quantity: item.quantity,
        provided_by: item.provided_by || "Unknown",
      };
    }
  });
  return obj;
};

// ─── Sub-component: Display Only Breakdown ──────────────────────────────────

const SeedlingBreakdown = ({
  seedlingType,
}: {
  seedlingType: Record<string, { quantity: number; provided_by: string }>;
}) => {
  const items = parseProvisionToArray(seedlingType);
  if (items.length === 0)
    return <p className="text-sm text-gray-400">No seedlings specified</p>;

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div
          key={i}
          className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg border border-gray-100"
        >
          <div className="flex items-center gap-2">
            <Sprout size={14} className="text-[#0F4A2F]" />
            <span className="font-medium text-gray-800">{item.species}</span>
          </div>
          <div className="flex items-center gap-3 text-right">
            <span className="text-sm font-semibold text-[#0F4A2F]">
              {item.quantity.toLocaleString()}
            </span>
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <Package size={12} /> {item.provided_by}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── Main Component ─────────────────────────────────────────────────────────

export default function Request() {
  const [requests, setRequests] = useState<SeedlingRequest[]>([]);
  const [filter, setFilter] = useState<Filter>({
    search: "",
    entries: 10,
    page: 1,
    total_page: 1,
    status: "pending",
  });
  const [loading, setLoading] = useState(false);
  const [PSalert, setPSAlert] = useState<{
    type: "success" | "failed" | "error";
    title: string;
    message: string;
  } | null>(null);

  // Modal states
  const [detailModal, setDetailModal] = useState<{
    visible: boolean;
    request: SeedlingRequest | null;
  }>({ visible: false, request: null });

  // Action Modal State includes editable provision list
  const [actionModal, setActionModal] = useState<{
    visible: boolean;
    type: "accept" | "reject" | null;
    request: SeedlingRequest | null;
    reason: string;
    provision: { species: string; quantity: number; provided_by: string }[];
  }>({ visible: false, type: null, request: null, reason: "", provision: [] });

  const [submitting, setSubmitting] = useState(false);

  // Tree species list (for autocomplete in species input)
  const [treeSpeciesList, setTreeSpeciesList] = useState<string[]>([]);
  const [loadingSpecies, setLoadingSpecies] = useState(false);
  const [newSpecies, setNewSpecies] = useState("");

  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const API_BASE = "http://127.0.0.1:8000";

  // ─── Fetch Requests ───────────────────────────────────────────────────────

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search: filter.search,
        page: filter.page.toString(),
        entries: filter.entries.toString(),
        status: filter.status,
      });

      const response = await fetch(
        `${API_BASE}/api/get_seedling_requests/?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!response.ok) throw new Error("Failed to fetch seedling requests.");

      const data = await response.json();
      setRequests(data);
      setFilter((prev) => ({
        ...prev,
        total_page: Math.ceil(data.length / prev.entries),
      }));
    } catch (err: any) {
      setPSAlert({
        type: "error",
        title: "Failed",
        message: err.message || "Failed to load requests.",
      });
    } finally {
      setLoading(false);
    }
  };

  // ─── Fetch Tree Species List (for autocomplete) ───────────────────────────
  useEffect(() => {
    const fetchSpecies = async () => {
      setLoadingSpecies(true);
      try {
        const res = await fetch(`${API_BASE}/api/get_tree_species_list/`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          // Handle both array of objects or plain array
          const names = Array.isArray(data)
            ? data.map((s: any) => s.name || s).filter(Boolean)
            : data.species || [];
          setTreeSpeciesList(names);
        }
      } catch (err) {
        console.error("Failed to fetch species:", err);
        // Fallback list
        setTreeSpeciesList([
          "Narra",
          "Mahogany",
          "Ipil-Ipil",
          "Yakal",
          "Molave",
          "Acacia",
          "Gmelina",
          "Bamboo",
          "Falcata",
          "Banaba",
        ]);
      } finally {
        setLoadingSpecies(false);
      }
    };
    fetchSpecies();
  }, [token]);

  useEffect(() => {
    fetchRequests();
  }, [filter.page, filter.entries, filter.status]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleView = async (request: SeedlingRequest) => {
    try {
      const res = await fetch(
        `${API_BASE}/api/get_application/${request.application_id}/`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (res.ok) {
        const appData = await res.json();
        const fullRequest = appData.seedling_requests?.find(
          (r: any) => r.request_id === request.request_id
        );
        if (fullRequest) {
          setDetailModal({
            visible: true,
            request: { ...request, request_file: fullRequest.request_file },
          });
          return;
        }
      }
    } catch (err) {
      console.warn("Could not fetch full request details:", err);
    }
    setDetailModal({ visible: true, request });
  };

  const openActionModal = (type: "accept" | "reject", request: SeedlingRequest) => {
    let provision: any[] = [];
    if (type === "accept") {
      // Parse current seedling type into editable array
      provision = parseProvisionToArray(request.seedling_type);
    }
    setActionModal({
      visible: true,
      type,
      request,
      reason: "",
      provision,
    });
    setNewSpecies("");
  };

  // Helpers for editing provision list
  const addSpecies = () => {
    if (newSpecies && !actionModal.provision.some((p) => p.species === newSpecies)) {
      setActionModal((prev) => ({
        ...prev,
        provision: [
          ...prev.provision,
          { species: newSpecies, quantity: 1, provided_by: "" },
        ],
      }));
      setNewSpecies("");
    }
  };

  const removeSpecies = (index: number) => {
    setActionModal((prev) => ({
      ...prev,
      provision: prev.provision.filter((_, i) => i !== index),
    }));
  };

  const updateProvisionItem = (
    index: number,
    field: "species" | "quantity" | "provided_by",
    value: string | number
  ) => {
    setActionModal((prev) => {
      const newProvision = [...prev.provision];
      newProvision[index] = { ...newProvision[index], [field]: value };
      return { ...prev, provision: newProvision };
    });
  };

  const handleActionSubmit = async () => {
    if (!actionModal.request || !actionModal.type) return;
    if (!actionModal.reason.trim()) {
      setPSAlert({
        type: "failed",
        title: "Missing",
        message: `Please provide a reason for ${actionModal.type}.`,
      });
      return;
    }

    // Validation for Accept: Ensure at least one valid species
    if (actionModal.type === "accept") {
      const hasValid = actionModal.provision.some(
        (p) => p.species.trim() && p.quantity > 0
      );
      if (!hasValid) {
        setPSAlert({
          type: "failed",
          title: "Invalid Data",
          message: "Please provide at least one valid species with quantity > 0.",
        });
        return;
      }
    }

    setSubmitting(true);
    try {
      const body: any = {
        status: actionModal.type === "accept" ? "accepted" : "rejected",
        reason: actionModal.reason.trim(),
      };

      // If accepting, include the edited provision
      if (actionModal.type === "accept") {
        body.seedling_provision = formatProvisionToObject(actionModal.provision);
      }

      const response = await fetch(
        `${API_BASE}/api/update_seedling_request/${actionModal.request.request_id}/`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Action failed.");

      setPSAlert({
        type: "success",
        title: actionModal.type === "accept" ? "Accepted" : "Rejected",
        message: data.message || `Request ${actionModal.type}d successfully.`,
      });

      setActionModal({ visible: false, type: null, request: null, reason: "", provision: [] });
      setDetailModal({ visible: false, request: null });
      fetchRequests();
    } catch (err: any) {
      setPSAlert({
        type: "failed",
        title: "Failed",
        message: err.message || "Something went wrong.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Filter available species for autocomplete
  const availableSpecies = treeSpeciesList.filter(
    (s) => !actionModal.provision.some((p) => p.species === s)
  );

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

      {/* Detail Modal */}
      {detailModal.visible && detailModal.request && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[#0F4A2F]">Request Details</h3>
              <button
                onClick={() => setDetailModal({ visible: false, request: null })}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle size={20} />
              </button>
            </div>

            <div className="p-4 bg-gray-50 rounded-xl mb-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Application</p>
              <p className="font-bold text-gray-800">{detailModal.request.application_title}</p>
              <p className="text-sm text-gray-600">{detailModal.request.organization_name}</p>
              <p className="text-xs text-gray-400">{detailModal.request.org_email}</p>
            </div>

            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Seedlings Requested</p>
              <SeedlingBreakdown seedlingType={detailModal.request.seedling_type} />
              <p className="mt-3 text-sm font-bold text-[#0F4A2F]">
                Total: {detailModal.request.no_request_seedling.toLocaleString()} seedlings
              </p>
            </div>

            {detailModal.request.description && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Description</p>
                <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">{detailModal.request.description}</p>
              </div>
            )}

            {(detailModal.request as any).request_file && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Attachment</p>
                <a
                  href={`${API_BASE}${(detailModal.request as any).request_file}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-[#0F4A2F] hover:underline text-sm"
                >
                  <FileText size={14} /> Download supporting document
                </a>
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                detailModal.request.status === "pending" ? "bg-yellow-100 text-yellow-700" :
                detailModal.request.status === "accepted" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
              }`}>
                {detailModal.request.status.toUpperCase()}
              </span>
              <span className="text-xs text-gray-400">
                Submitted: {detailModal.request.submitted_at ? new Date(detailModal.request.submitted_at).toLocaleDateString("en-PH") : "N/A"}
              </span>
            </div>

            {detailModal.request.status === "pending" && (
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => openActionModal("reject", detailModal.request)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-red-200 text-red-500 text-sm font-bold hover:bg-red-50 transition-colors"
                >
                  <XCircle size={16} /> Reject
                </button>
                <button
                  onClick={() => openActionModal("accept", detailModal.request)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#0F4A2F] text-white text-sm font-bold hover:bg-[#1a6b44] transition-colors"
                >
                  <CheckCircle2 size={16} /> Accept & Edit
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action Modal (Accept/Reject with Editing) */}
      {actionModal.visible && actionModal.request && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[#0F4A2F]">
                {actionModal.type === "accept" ? "Review & Provide Seedlings" : "Reject Request"}
              </h3>
              <button
                onClick={() => setActionModal({ visible: false, type: null, request: null, reason: "", provision: [] })}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle size={20} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left: Current Request Info */}
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Applying For</p>
                  <p className="font-bold text-gray-800">{actionModal.request.application_title}</p>
                  <p className="text-sm text-gray-600">{actionModal.request.organization_name}</p>
                </div>
                
                {actionModal.type === "accept" && (
                   <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                     <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">Instructions</p>
                     <p className="text-sm text-blue-800">
                       Review the requested seedlings below. You can edit species, quantities, or providers to match available stock.
                     </p>
                   </div>
                )}
              </div>

              {/* Right: Form */}
              <div className="space-y-4">
                {/* Seedling Editor (Only for Accept) */}
                {actionModal.type === "accept" && (
                  <div className="border border-gray-200 rounded-xl p-4 bg-white">
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-semibold text-gray-700">Seedling Provision</label>
                      <div className="flex gap-2">
                        <select
                          value={newSpecies}
                          onChange={(e) => setNewSpecies(e.target.value)}
                          className="px-2 py-1.5 text-sm border border-gray-300 rounded focus:border-[#0F4A2F] focus:outline-none bg-white"
                          disabled={loadingSpecies}
                        >
                          <option value="">
                            {loadingSpecies ? "Loading…" : "+ Add species"}
                          </option>
                          {availableSpecies.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                        <button
                          onClick={addSpecies}
                          disabled={!newSpecies || loadingSpecies}
                          className="px-3 py-1.5 rounded bg-[#0F4A2F] text-white text-sm font-semibold hover:bg-[#1a6b44] transition-colors disabled:opacity-50"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                    
                    <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                      {actionModal.provision.map((item, idx) => (
                        <div key={idx} className="flex flex-wrap gap-2 items-end p-2 bg-gray-50 rounded-lg border border-gray-100">
                          <div className="flex-1 min-w-[100px]">
                            <label className="block text-[10px] text-gray-500 mb-1">Species</label>
                            <input
                              type="text"
                              value={item.species}
                              onChange={(e) => updateProvisionItem(idx, "species", e.target.value)}
                              placeholder="e.g. Narra"
                              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:border-[#0F4A2F] focus:outline-none"
                              list={`species-list-${idx}`}
                            />
                            {/* Datalist for autocomplete */}
                            <datalist id={`species-list-${idx}`}>
                              {treeSpeciesList.map((s) => (
                                <option key={s} value={s} />
                              ))}
                            </datalist>
                          </div>
                          <div className="w-20">
                            <label className="block text-[10px] text-gray-500 mb-1">Qty</label>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => updateProvisionItem(idx, "quantity", parseInt(e.target.value) || 0)}
                              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:border-[#0F4A2F] focus:outline-none"
                            />
                          </div>
                          <div className="flex-1 min-w-[100px]">
                            <label className="block text-[10px] text-gray-500 mb-1">Provided By</label>
                            <input
                              type="text"
                              value={item.provided_by}
                              onChange={(e) => updateProvisionItem(idx, "provided_by", e.target.value)}
                              placeholder="e.g. ENRO Nursery"
                              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:border-[#0F4A2F] focus:outline-none"
                            />
                          </div>
                          <button
                            onClick={() => removeSpecies(idx)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded mb-0.5"
                            title="Remove"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                      {actionModal.provision.length === 0 && (
                        <p className="text-sm text-gray-400 italic text-center py-2">No species added.</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Reason Input */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Reason <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={actionModal.reason}
                    onChange={(e) => setActionModal((p) => ({ ...p, reason: e.target.value }))}
                    placeholder={actionModal.type === "accept" ? "e.g. Approved - adjusted for stock availability" : "e.g. Rejected - insufficient stock"}
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm text-gray-700 resize-none focus:outline-none focus:border-[#0F4A2F] focus:ring-1 focus:ring-[#0F4A2F] transition-colors"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
              <button
                onClick={() => setActionModal({ visible: false, type: null, request: null, reason: "", provision: [] })}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleActionSubmit}
                disabled={submitting || !actionModal.reason.trim()}
                className={`flex-1 py-2.5 rounded-xl text-white text-sm font-bold transition-all ${
                  actionModal.type === "accept" ? "bg-[#0F4A2F] hover:bg-[#1a6b44]" : "bg-red-500 hover:bg-red-600"
                } ${(submitting || !actionModal.reason.trim()) ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {submitting ? "Processing…" : actionModal.type === "accept" ? "Confirm & Accept" : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 p-8 max-w-6xl">
        <div className="mb-7">
          <h1 className="text-2xl font-bold text-[#0F4A2F]">Seedling Requests</h1>
          <p className="text-sm text-gray-500">Review and manage TreeGrower seedling assistance requests</p>
        </div>

        <div className="flex items-center mb-7 gap-4 flex-wrap">
          <label className="text-sm font-medium text-gray-600">Show entries:</label>
          <select
            value={filter.entries}
            onChange={(e) => setFilter((prev) => ({ ...prev, entries: Number(e.target.value), page: 1 }))}
            className="border border-gray-300 p-2 rounded-md text-sm"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>

          <label className="text-sm font-medium text-gray-600">Status:</label>
          <select
            value={filter.status}
            onChange={(e) => setFilter((prev) => ({ ...prev, status: e.target.value, page: 1 }))}
            className="border border-gray-300 p-2 rounded-md text-sm"
          >
            <option value="pending">Pending</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
            <option value="All">All</option>
          </select>

          <input
            type="text"
            placeholder="Search by application or organization..."
            value={filter.search}
            onChange={(e) => setFilter((prev) => ({ ...prev, search: e.target.value, page: 1 }))}
            onKeyDown={(e) => { if (e.key === "Enter") fetchRequests(); }}
            className="border border-gray-300 rounded-md p-2 w-80 text-sm ml-auto"
          />
        </div>

        <div className="overflow-x-auto shadow-lg rounded-sm border border-gray-200">
          {loading && <LoaderPending />}
          <table className="min-w-full bg-white rounded-sm">
            <thead className="bg-[#0f4a2fe0] text-white">
              <tr>
                <th className="py-3 px-5 text-left text-[.9rem]">No</th>
                <th className="py-3 px-5 text-left text-[.9rem]">Application</th>
                <th className="py-3 px-5 text-left text-[.9rem]">Seedlings</th>
                <th className="py-3 px-5 text-left text-[.9rem]">Status</th>
                <th className="py-3 px-5 text-left text-[.9rem]">Submitted</th>
                <th className="py-3 px-5 text-left text-[.9rem]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.length > 0 ? (
                requests.slice((filter.page - 1) * filter.entries, filter.page * filter.entries).map((req, index) => (
                  <tr key={req.request_id} className={`${index % 2 === 0 ? "" : "bg-[#0F4A2F0D]"} transition`}>
                    <td className="py-3 px-5 text-[.9rem]">{index + 1 + (filter.page - 1) * filter.entries}</td>
                    <td className="py-3 px-5">
                      <div>
                        <h4 className="font-bold text-[.8rem]">{req.application_title}</h4>
                        <span className="text-[#00000091] text-[.7rem]">{req.organization_name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-5 text-[.9rem]">
                      <span className="font-semibold text-[#0F4A2F]">{req.no_request_seedling.toLocaleString()}</span>
                    </td>
                    <td className="py-3 px-5">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        req.status === "pending" ? "bg-yellow-100 text-yellow-700" :
                        req.status === "accepted" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                      }`}>
                        {req.status}
                      </span>
                    </td>
                    <td className="py-3 px-5 text-[.9rem]">
                      {req.submitted_at ? new Date(req.submitted_at).toLocaleDateString("en-PH") : "N/A"}
                    </td>
                    <td className="py-3 px-5">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleView(req)}
                          className="text-[#0F4A2F] px-3 py-1 rounded-md flex items-center gap-1 hover:bg-[#0F4A2F0D] transition-colors"
                          title="View details"
                        >
                          <Eye size={16} />
                        </button>
                        {req.status === "pending" && (
                          <>
                            <button
                              onClick={() => openActionModal("accept", req)}
                              className="text-green-600 px-3 py-1 rounded-md flex items-center gap-1 hover:bg-green-50 transition-colors"
                              title="Accept & Edit"
                            >
                              <CheckCircle2 size={16} />
                            </button>
                            <button
                              onClick={() => openActionModal("reject", req)}
                              className="text-red-500 px-3 py-1 rounded-md flex items-center gap-1 hover:bg-red-50 transition-colors"
                              title="Reject request"
                            >
                              <XCircle size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-500 italic">
                    {filter.search ? `No results for "${filter.search}"` : "No seedling requests found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {filter.total_page > 1 && (
          <div className="flex items-center gap-1 mt-5 w-full">
            <button
              disabled={filter.page <= 1}
              onClick={() => setFilter((prev) => ({ ...prev, page: prev.page - 1 }))}
              className="px-2 py-1 border rounded-md text-gray-700 hover:bg-gray-100 ml-auto cursor-pointer disabled:opacity-50"
            >
              <ChevronLeft size={19} />
            </button>
            {Array.from({ length: Math.min(5, filter.total_page) }, (_, i) => {
              let pageNum;
              if (filter.total_page <= 5) pageNum = i + 1;
              else if (filter.page <= 3) pageNum = i + 1;
              else if (filter.page >= filter.total_page - 2) pageNum = filter.total_page - 4 + i;
              else pageNum = filter.page - 2 + i;
              return (
                <button
                  key={pageNum}
                  onClick={() => setFilter((prev) => ({ ...prev, page: pageNum }))}
                  className={`px-3 py-1 border rounded-md cursor-pointer text-[.8rem] ${
                    pageNum === filter.page ? "bg-[#0F4A2F] text-white" : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              disabled={filter.page >= filter.total_page}
              onClick={() => setFilter((prev) => ({ ...prev, page: prev.page + 1 }))}
              className="px-2 py-1 border rounded-md text-gray-700 hover:bg-gray-100 cursor-pointer disabled:opacity-50"
            >
              <ChevronRight size={19} />
            </button>
          </div>
        )}
      </main>
    </div>
  );
}