import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Sprout,
  MapPin,
  User,
  Truck,
  Home,
  Search,
  Plus,
  Trash2,
  ExternalLink,
  FileText,
  Download,
  Users,
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

interface RequestDetail {
  request_id: number;
  application_id: number;
  application_title: string;
  status: string;
  fulfillment_type: string | null;
  no_request_seedling: number;
  species: SeedlingSpeciesItem[];
  assigned_inspector: { name: string; contact: string } | null;
  reason_accepted: string | null;
  reason: string | null;
  grower_info: {
    group_name: string;
    group_contact: string;
    representative_name: string;
    representative_contact: string;
  };
  site_info: {
    site_id: number;
    site_name: string;
    barangay: string;
  };
}

interface AppDetailsForRequest {
  maintenance_plan: string | null;
  total_treegrowers_will_participate: number; // ✅ Added
  assigned_site: {
    site_id: number;
    reforestation_area_id: number;
    name: string;
  } | null;
}

interface Inspector {
  id: number;
  name: string;
  email: string;
}

interface TreeSpeciesOption {
  tree_specie_id: number;
  name: string;
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function RequestEval() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [request, setRequest] = useState<RequestDetail | null>(null);
  const [appDetails, setAppDetails] = useState<AppDetailsForRequest | null>(
    null,
  );
  const [inspectors, setInspectors] = useState<Inspector[]>([]);
  const [filteredInspectors, setFilteredInspectors] = useState<Inspector[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const [treeSpeciesList, setTreeSpeciesList] = useState<TreeSpeciesOption[]>(
    [],
  );
  const [selectedSpeciesToAdd, setSelectedSpeciesToAdd] = useState<string>("");

  const [selectedInspectorId, setSelectedInspectorId] = useState<number | null>(
    null,
  );
  const [fulfillmentType, setFulfillmentType] = useState<"pickup" | "deliver">(
    "deliver",
  );
  const [adjustedProvision, setAdjustedProvision] = useState<
    SeedlingSpeciesItem[]
  >([]);
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [PSalert, setPSAlert] = useState<{
    type: "success" | "failed" | "error";
    title: string;
    message: string;
  } | null>(null);

  const token = localStorage.getItem("token");
  const API_BASE = api;

  // ─── Fetch Data ───────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      setLoading(true);
      try {
        // 1. Fetch Request Detail
        const reqRes = await fetch(`${API_BASE}api/requests/${id}/detail/`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!reqRes.ok) throw new Error("Failed to fetch request details.");
        const reqData = await reqRes.json();
        setRequest(reqData);
        setAdjustedProvision(
          reqData.species.map((s: SeedlingSpeciesItem) => ({ ...s })),
        );

        // 2. Fetch Application Details
        if (reqData.application_id) {
          const appRes = await fetch(
            `${API_BASE}api/get_application/${reqData.application_id}/`,
            {
              headers: { Authorization: `Bearer ${token}` },
            },
          );
          if (appRes.ok) {
            const appData = await appRes.json();
            setAppDetails({
              maintenance_plan: appData.application.maintenance_plan,
              total_treegrowers_will_participate:
                appData.application.total_treegrowers_will_participate, // ✅ Captured
              assigned_site: appData.assigned_site
                ? {
                    site_id: appData.assigned_site.site_id,
                    reforestation_area_id:
                      appData.assigned_site.reforestation_area_id || 0,
                    name: appData.assigned_site.name,
                  }
                : null,
            });
          }
        }

        // 3. Fetch Inspectors
        const inspRes = await fetch(`${API_BASE}api/requests/inspectors/`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (inspRes.ok) {
          const inspData = await inspRes.json();
          setInspectors(inspData);
          setFilteredInspectors(inspData);
        }

        // 4. Fetch Master Tree Species List
        const speciesRes = await fetch(
          `${API_BASE}api/get_tree_species_list/`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (speciesRes.ok) {
          setTreeSpeciesList(await speciesRes.json());
        }
      } catch (err: any) {
        setPSAlert({ type: "error", title: "Error", message: err.message });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  // Handle Inspector Search
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredInspectors(inspectors);
    } else {
      const lowerQuery = searchQuery.toLowerCase();
      setFilteredInspectors(
        inspectors.filter(
          (insp) =>
            insp.name.toLowerCase().includes(lowerQuery) ||
            insp.email.toLowerCase().includes(lowerQuery),
        ),
      );
    }
  }, [searchQuery, inspectors]);

  // ─── Provision Handlers ───────────────────────────────────────────────────
  const handleAddSpecies = () => {
    if (!selectedSpeciesToAdd) return;
    const speciesId = Number(selectedSpeciesToAdd);
    const species = treeSpeciesList.find((s) => s.tree_specie_id === speciesId);
    if (!species) return;

    if (adjustedProvision.some((p) => p.species_id === speciesId)) {
      setPSAlert({
        type: "failed",
        title: "Duplicate",
        message: "This species is already in the provision list.",
      });
      return;
    }

    setAdjustedProvision([
      ...adjustedProvision,
      {
        species_id: speciesId,
        species_name: species.name,
        quantity: 0,
        provided_by: "ENRO Nursery",
      },
    ]);
    setSelectedSpeciesToAdd("");
  };

  const handleRemoveSpecies = (speciesId: number) => {
    setAdjustedProvision(
      adjustedProvision.filter((p) => p.species_id !== speciesId),
    );
  };

  const updateProvisionItem = (
    index: number,
    field: "quantity" | "provided_by",
    value: string | number,
  ) => {
    const newProvision = [...adjustedProvision];
    newProvision[index] = { ...newProvision[index], [field]: value };
    setAdjustedProvision(newProvision);
  };

  // ─── Action Handlers ──────────────────────────────────────────────────────
  const handleApprove = async () => {
    if (!selectedInspectorId) {
      setPSAlert({
        type: "failed",
        title: "Missing Info",
        message: "Please select an inspector.",
      });
      return;
    }
    if (adjustedProvision.length === 0) {
      setPSAlert({
        type: "failed",
        title: "Empty Provision",
        message: "Please add at least one species to the provision list.",
      });
      return;
    }
    const hasValidQty = adjustedProvision.some((p) => p.quantity > 0);
    if (!hasValidQty) {
      setPSAlert({
        type: "failed",
        title: "Invalid Quantity",
        message: "At least one species must have a quantity greater than 0.",
      });
      return;
    }

    setSubmitting(true);
    try {
      const body = {
        inspector_id: selectedInspectorId,
        fulfillment_type: fulfillmentType,
        notes: notes,
        seedling_provision: adjustedProvision.map((p) => ({
          tree_species_id: p.species_id,
          quantity: p.quantity,
          provided_by: p.provided_by,
        })),
      };

      const response = await fetch(`${API_BASE}api/requests/${id}/approve/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Approval failed.");

      setPSAlert({ type: "success", title: "Approved", message: data.message });
      setTimeout(() => navigate("/DataManager/request"), 1500);
    } catch (err: any) {
      setPSAlert({ type: "error", title: "Failed", message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!notes.trim()) {
      setPSAlert({
        type: "failed",
        title: "Missing Info",
        message: "Please provide a reason for rejection.",
      });
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}api/requests/${id}/reject/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason: notes.trim() }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Rejection failed.");

      setPSAlert({ type: "success", title: "Rejected", message: data.message });
      setTimeout(() => navigate("/DataManager/request"), 1500);
    } catch (err: any) {
      setPSAlert({ type: "error", title: "Failed", message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadMaintenancePlan = async () => {
    if (!appDetails?.maintenance_plan || !request?.application_id) {
      setPSAlert({
        type: "failed",
        title: "Error",
        message: "No maintenance plan available",
      });
      return;
    }
    try {
      const response = await fetch(
        `${API_BASE}api/application/${request.application_id}/download-maintenance-plan/`,
        { method: "GET", headers: { Authorization: `Bearer ${token}` } },
      );
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Download failed");
      }
      const blob = await response.blob();
      if (blob.size === 0) throw new Error("Downloaded file is empty");

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `maintenance_plan_${request.application_id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setPSAlert({
        type: "success",
        title: "Download Successful",
        message: "Your file has been downloaded.",
      });
    } catch (error: any) {
      setPSAlert({
        type: "error",
        title: "Download Failed",
        message: error.message,
      });
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────
  if (loading)
    return (
      <div className="flex justify-center items-center h-screen">
        <LoaderPending />
      </div>
    );
  if (!request)
    return (
      <div className="flex justify-center items-center h-screen text-gray-500">
        Request not found.
      </div>
    );

  const totalProvision = adjustedProvision.reduce(
    (sum, item) => sum + (item.quantity || 0),
    0,
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {PSalert && (
        <PlantScopeAlert
          type={PSalert.type}
          title={PSalert.title}
          message={PSalert.message}
          onClose={() => setPSAlert(null)}
        />
      )}

      {/* Top Navigation Bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-[#0F4A2F]">
              Seedling Request Evaluation
            </h1>
            <p className="text-sm text-gray-500">{request.application_title}</p>
          </div>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-xs font-semibold border ${
            request.status === "pending"
              ? "bg-yellow-100 text-yellow-700 border-yellow-200"
              : request.status === "accepted"
                ? "bg-blue-100 text-blue-700 border-blue-200"
                : request.status === "confirmed"
                  ? "bg-green-100 text-green-700 border-green-200"
                  : "bg-red-100 text-red-700 border-red-200"
          }`}
        >
          {request.status.toUpperCase()}
        </span>
      </div>

      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* ─── Left Column: Context (Read-Only) ────────────────────────── */}
          <div className="space-y-6">
            {/* Maintenance Plan Section */}
            {appDetails?.maintenance_plan && (
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
                  Maintenance Plan
                </h3>
                <button
                  onClick={handleDownloadMaintenancePlan}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-dashed border-green-300 bg-green-50 hover:bg-green-100 transition-colors group cursor-pointer"
                  type="button"
                >
                  <div className="w-9 h-9 rounded-lg bg-[#0F4A2F] flex items-center justify-center flex-shrink-0">
                    <FileText size={16} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-semibold text-[#0F4A2F] truncate">
                      {appDetails.maintenance_plan.split("/").pop() ||
                        "Maintenance Plan"}
                    </p>
                    <p className="text-xs text-green-600">Click to download</p>
                  </div>
                  <Download
                    size={16}
                    className="text-green-500 group-hover:text-[#0F4A2F] transition-colors"
                  />
                </button>
              </div>
            )}

            {/* ✅ NEW: Application Stats - Total Tree Growers */}
            {appDetails && (
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
                  Application Details
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                    <div className="flex items-center gap-2 mb-1">
                      <Users size={14} className="text-[#0F4A2F]" />
                      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                        Total Tree Growers
                      </p>
                    </div>
                    <p className="text-2xl font-bold text-[#0F4A2F]">
                      {appDetails.total_treegrowers_will_participate}
                    </p>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <div className="flex items-center gap-2 mb-1">
                      <Sprout size={14} className="text-blue-600" />
                      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                        Seedlings Requested
                      </p>
                    </div>
                    <p className="text-2xl font-bold text-blue-700">
                      {request.no_request_seedling}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Grower Info */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
                Grower Information
              </h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500">Group Name</p>
                  <p className="font-semibold text-gray-900">
                    {request.grower_info.group_name}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Representative</p>
                  <p className="text-sm text-gray-800">
                    {request.grower_info.representative_name}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Group Contact</p>
                    <p className="text-sm text-gray-800">
                      {request.grower_info.group_contact || "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Rep. Contact</p>
                    <p className="text-sm text-gray-800">
                      {request.grower_info.representative_contact || "N/A"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Site Info with View Details Button */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Assigned Site
                </h3>
                {appDetails?.assigned_site && (
                  <button
                    onClick={() =>
                      navigate(
                        `/DataManager/reforestation/site/${appDetails.assigned_site.reforestation_area_id}/information/${appDetails.assigned_site.site_id}`,
                      )
                    }
                    className="flex items-center gap-1 text-xs text-[#0F4A2F] hover:underline font-medium"
                  >
                    View Details <ExternalLink size={12} />
                  </button>
                )}
              </div>
              <div className="flex items-start gap-3">
                <div className="p-2 bg-green-50 rounded-lg">
                  <MapPin size={20} className="text-[#0F4A2F]" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">
                    {request.site_info.site_name}
                  </p>
                  <p className="text-sm text-gray-500">
                    {request.site_info.barangay}
                  </p>
                </div>
              </div>
            </div>

            {/* Original Requested Seedlings */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
                Originally Requested
              </h3>
              <div className="space-y-2">
                {request.species.map((sp, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100"
                  >
                    <div className="flex items-center gap-2">
                      <Sprout size={16} className="text-[#0F4A2F]" />
                      <span className="text-sm font-medium text-gray-800">
                        {sp.species_name}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-[#0F4A2F]">
                      {sp.quantity.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center">
                <span className="text-sm font-semibold text-gray-600">
                  Total Requested
                </span>
                <span className="text-lg font-bold text-[#0F4A2F]">
                  {request.no_request_seedling.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* ─── Right Column: Action Form ────────────────────────────────── */}
          <div className="space-y-6">
            {request.status === "pending" ? (
              <>
                {/* Step 1: Fulfillment */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
                    1. Fulfillment Method
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => setFulfillmentType("deliver")}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        fulfillmentType === "deliver"
                          ? "border-[#0F4A2F] bg-green-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <Truck
                        size={20}
                        className={`mb-2 ${fulfillmentType === "deliver" ? "text-[#0F4A2F]" : "text-gray-400"}`}
                      />
                      <p className="text-sm font-semibold text-gray-900">
                        Deliver to Site
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        ENRO delivers directly.
                      </p>
                    </button>
                    <button
                      onClick={() => setFulfillmentType("pickup")}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        fulfillmentType === "pickup"
                          ? "border-[#0F4A2F] bg-green-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <Home
                        size={20}
                        className={`mb-2 ${fulfillmentType === "pickup" ? "text-[#0F4A2F]" : "text-gray-400"}`}
                      />
                      <p className="text-sm font-semibold text-gray-900">
                        Grower Pickup
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Grower picks up at nursery.
                      </p>
                    </button>
                  </div>
                </div>

                {/* Step 2: Searchable Inspector List */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
                    2. Assign Onsite Inspector
                  </h3>
                  <div className="relative mb-4">
                    <Search
                      size={16}
                      className="absolute left-3 top-3 text-gray-400"
                    />
                    <input
                      type="text"
                      placeholder="Search inspector by name or email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4A2F] focus:border-transparent"
                    />
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {filteredInspectors.length > 0 ? (
                      filteredInspectors.map((insp) => (
                        <button
                          key={insp.id}
                          onClick={() => setSelectedInspectorId(insp.id)}
                          className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
                            selectedInspectorId === insp.id
                              ? "border-[#0F4A2F] bg-green-50"
                              : "border-gray-200 hover:bg-gray-50"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`p-2 rounded-full ${selectedInspectorId === insp.id ? "bg-[#0F4A2F] text-white" : "bg-gray-100 text-gray-500"}`}
                            >
                              <User size={16} />
                            </div>
                            <div className="text-left">
                              <p className="text-sm font-semibold text-gray-900">
                                {insp.name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {insp.email}
                              </p>
                            </div>
                          </div>
                          {selectedInspectorId === insp.id && (
                            <CheckCircle2
                              size={20}
                              className="text-[#0F4A2F]"
                            />
                          )}
                        </button>
                      ))
                    ) : (
                      <p className="text-sm text-gray-400 text-center py-4">
                        No inspectors found.
                      </p>
                    )}
                  </div>
                </div>

                {/* Step 3: Build Provision List */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
                    3. Seedlings to Provide
                  </h3>

                  <div className="flex gap-2 mb-4">
                    <select
                      value={selectedSpeciesToAdd}
                      onChange={(e) => setSelectedSpeciesToAdd(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4A2F] bg-white"
                    >
                      <option value="">+ Select a species to add...</option>
                      {treeSpeciesList
                        .filter(
                          (s) =>
                            !adjustedProvision.some(
                              (p) => p.species_id === s.tree_specie_id,
                            ),
                        )
                        .map((s) => (
                          <option
                            key={s.tree_specie_id}
                            value={s.tree_specie_id}
                          >
                            {s.name}
                          </option>
                        ))}
                    </select>
                    <button
                      onClick={handleAddSpecies}
                      disabled={!selectedSpeciesToAdd}
                      className="px-4 py-2 bg-[#0F4A2F] text-white rounded-lg hover:bg-[#1a6b44] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Plus size={18} />
                    </button>
                  </div>

                  <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                    {adjustedProvision.length > 0 ? (
                      adjustedProvision.map((sp, i) => (
                        <div
                          key={sp.species_id}
                          className="flex flex-wrap items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200"
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-[120px]">
                            <Sprout size={16} className="text-[#0F4A2F]" />
                            <span className="text-sm font-medium text-gray-800 truncate">
                              {sp.species_name}
                            </span>
                          </div>

                          <div className="w-24">
                            <label className="block text-[10px] text-gray-500 mb-0.5">
                              Qty
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={sp.quantity}
                              onChange={(e) =>
                                updateProvisionItem(
                                  i,
                                  "quantity",
                                  parseInt(e.target.value) || 0,
                                )
                              }
                              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md text-right focus:outline-none focus:border-[#0F4A2F]"
                            />
                          </div>

                          <div className="flex-1 min-w-[120px]">
                            <label className="block text-[10px] text-gray-500 mb-0.5">
                              Provided By
                            </label>
                            <input
                              type="text"
                              value={sp.provided_by}
                              onChange={(e) =>
                                updateProvisionItem(
                                  i,
                                  "provided_by",
                                  e.target.value,
                                )
                              }
                              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:border-[#0F4A2F]"
                            />
                          </div>

                          <button
                            onClick={() => handleRemoveSpecies(sp.species_id)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-md transition-colors mt-4"
                            title="Remove species"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-400 italic text-center py-4">
                        No species added to provision list.
                      </p>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center">
                    <span className="text-sm font-semibold text-gray-600">
                      Total to Provide
                    </span>
                    <span className="text-lg font-bold text-[#0F4A2F]">
                      {totalProvision.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Step 4: Notes */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
                    4. Notes (Optional)
                  </h3>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g., Approved, but Mahogany quantity reduced due to low nursery stock."
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4A2F] focus:border-transparent resize-none"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4 pt-2 pb-10">
                  <button
                    onClick={handleReject}
                    disabled={submitting}
                    className="flex-1 py-3 rounded-xl bg-red-50 text-red-600 font-semibold hover:bg-red-100 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <XCircle size={18} /> Reject Request
                  </button>
                  <button
                    onClick={handleApprove}
                    disabled={
                      submitting ||
                      !selectedInspectorId ||
                      adjustedProvision.length === 0
                    }
                    className="flex-[2] py-3 rounded-xl bg-[#0F4A2F] text-white font-semibold hover:bg-[#1a6b44] transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? (
                      "Processing..."
                    ) : (
                      <>
                        <CheckCircle2 size={18} /> Approve & Assign
                      </>
                    )}
                  </button>
                </div>
              </>
            ) : (
              // Read-only view for non-pending requests
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-4">
                <h3 className="text-lg font-bold text-[#0F4A2F] mb-4">
                  Request Status Details
                </h3>

                {request.fulfillment_type && (
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1">
                      Fulfillment Method
                    </p>
                    <p className="text-sm font-medium text-gray-900 capitalize flex items-center gap-2">
                      {request.fulfillment_type === "deliver" ? (
                        <Truck size={16} />
                      ) : (
                        <Home size={16} />
                      )}
                      {request.fulfillment_type === "deliver"
                        ? "Deliver to Site"
                        : "Grower Pickup"}
                    </p>
                  </div>
                )}

                {request.assigned_inspector && (
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1">
                      Assigned Inspector
                    </p>
                    <p className="text-sm font-medium text-gray-900 flex items-center gap-2">
                      <User size={16} /> {request.assigned_inspector.name}
                    </p>
                    <p className="text-xs text-gray-500 mt-1 ml-6">
                      {request.assigned_inspector.contact}
                    </p>
                  </div>
                )}

                {(request.reason_accepted || request.reason) && (
                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                    <p className="text-xs font-semibold text-blue-700 uppercase mb-1">
                      Notes / Reason
                    </p>
                    <p className="text-sm text-blue-900">
                      {request.reason_accepted || request.reason}
                    </p>
                  </div>
                )}

                {request.status === "confirmed" && (
                  <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                    <p className="text-xs font-semibold text-green-700 uppercase mb-1">
                      Status
                    </p>
                    <p className="text-sm text-green-900 flex items-center gap-2">
                      <CheckCircle2 size={16} /> Seedlings successfully
                      delivered and confirmed.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
