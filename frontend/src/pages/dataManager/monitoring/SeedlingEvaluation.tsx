import { useEffect, useMemo, useState } from "react";
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
  Loader2,
  Send,
  History,
  Lightbulb,
  ShieldCheck,
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
  description?: string | null;
  created_by_admin?: boolean;
  proof_of_delivery?: string | null;
  submitted_at?: string | null;
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

interface PreviousRequest {
  request_id: number;
  no_request_seedling: number;
  status: string;
  submitted_at: string | null;
}

interface AppDetailsForRequest {
  title: string;
  maintenance_plan: string | null;
  total_treegrowers_will_participate: number;
  group_name: string;
  group_contact: string;
  assigned_site: {
    site_id: number;
    reforestation_area_id: number;
    name: string;
    barangay: string | null;
  } | null;
  recommended_species: { species_id: number | null; species_name: string; rank: number }[];
  seedling_requests: PreviousRequest[];
}

interface EligibleGrower {
  user_id: number;
  email: string;
  group_name: string;
  application_id: number;
  application_title: string;
  application_status: string;
  site_name: string | null;
  barangay: string | null;
  pending_requests: number;
}

interface Inspector {
  id: number;
  name: string;
  email: string;
  ongoing_count?: number;
}

// Workload badge colors: free / light / busy
const workloadStyle = (count: number) =>
  count === 0
    ? "bg-green-50 text-green-700 border-green-200"
    : count <= 2
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : "bg-red-50 text-red-700 border-red-200";

interface TreeSpeciesOption {
  tree_specie_id: number;
  name: string;
}

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700 border-yellow-200",
  accepted: "bg-blue-100 text-blue-700 border-blue-200",
  confirmed: "bg-green-100 text-green-700 border-green-200",
  rejected: "bg-red-100 text-red-700 border-red-200",
  cancelled: "bg-gray-100 text-gray-600 border-gray-200",
};

// reason_accepted is stored as "<manager notes> | Inspector Notes: <notes>"
const splitNotes = (raw: string | null) => {
  if (!raw) return { manager: "", inspector: "" };
  const marker = "Inspector Notes:";
  const idx = raw.indexOf(marker);
  if (idx === -1) return { manager: raw.trim(), inspector: "" };
  return {
    manager: raw.slice(0, idx).replace(/\|\s*$/, "").trim(),
    inspector: raw.slice(idx + marker.length).trim(),
  };
};

const formatDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";

// ─── Main Component ─────────────────────────────────────────────────────────

export default function RequestEval() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // ✅ Dynamic mode: /DataManager/request-eval/new → create, /:id → evaluate
  const isCreate = id === "new";

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

  // Create mode
  const [growers, setGrowers] = useState<EligibleGrower[]>([]);
  const [growerSearch, setGrowerSearch] = useState("");
  const [selectedGrower, setSelectedGrower] = useState<EligibleGrower | null>(
    null,
  );
  const [growerLoading, setGrowerLoading] = useState(false);

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
  const fetchAppDetails = async (applicationId: number) => {
    const appRes = await fetch(
      `${API_BASE}api/get_application/${applicationId}/`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (!appRes.ok) throw new Error("Failed to load application details.");
    const appData = await appRes.json();
    const site = appData.assigned_site;
    setAppDetails({
      title: appData.application.title,
      maintenance_plan: appData.application.maintenance_plan,
      total_treegrowers_will_participate:
        appData.application.total_treegrowers_will_participate,
      group_name: appData.group?.group_name || "N/A",
      group_contact: appData.group?.group_contact || "",
      assigned_site: site
        ? {
            site_id: site.site_id,
            reforestation_area_id: site.reforestation_area_id || 0,
            name: site.name,
            barangay: site.barangay_name,
          }
        : null,
      recommended_species: site?.recommended_species || [],
      seedling_requests: appData.seedling_requests || [],
    });
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      setLoading(true);
      try {
        if (isCreate) {
          // Create mode: eligible tree growers + inspectors + species master list
          const [gRes, iRes, sRes] = await Promise.all([
            fetch(`${API_BASE}api/requests/eligible-growers/`, {
              headers: { Authorization: `Bearer ${token}` },
            }),
            fetch(`${API_BASE}api/requests/inspectors/`, {
              headers: { Authorization: `Bearer ${token}` },
            }),
            fetch(`${API_BASE}api/get_tree_species_list/`, {
              headers: { Authorization: `Bearer ${token}` },
            }),
          ]);
          if (!gRes.ok) throw new Error("Failed to load tree growers.");
          setGrowers(await gRes.json());
          if (iRes.ok) {
            const inspData = await iRes.json();
            setInspectors(inspData);
            setFilteredInspectors(inspData);
          }
          if (sRes.ok) setTreeSpeciesList(await sRes.json());
          return;
        }

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
          try {
            await fetchAppDetails(reqData.application_id);
          } catch {
            /* non-blocking */
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

  const filteredGrowers = useMemo(() => {
    const q = growerSearch.trim().toLowerCase();
    if (!q) return growers;
    return growers.filter(
      (g) =>
        g.group_name.toLowerCase().includes(q) ||
        g.email.toLowerCase().includes(q) ||
        g.application_title.toLowerCase().includes(q) ||
        (g.site_name || "").toLowerCase().includes(q) ||
        (g.barangay || "").toLowerCase().includes(q),
    );
  }, [growers, growerSearch]);

  // ─── Create Mode Handlers ─────────────────────────────────────────────────
  const handleSelectGrower = async (grower: EligibleGrower) => {
    if (selectedGrower?.application_id === grower.application_id) return;
    setSelectedGrower(grower);
    setAppDetails(null);
    setGrowerLoading(true);
    try {
      await fetchAppDetails(grower.application_id);
    } catch (err: any) {
      setPSAlert({ type: "error", title: "Error", message: err.message });
    } finally {
      setGrowerLoading(false);
    }
  };

  const handleAddRecommended = () => {
    if (!appDetails) return;
    const toAdd = appDetails.recommended_species
      .filter(
        (r) =>
          r.species_id &&
          !adjustedProvision.some((p) => p.species_id === r.species_id),
      )
      .map((r) => ({
        species_id: r.species_id as number,
        species_name: r.species_name,
        quantity: 0,
        provided_by: "ENRO Nursery",
      }));
    if (toAdd.length === 0) {
      setPSAlert({
        type: "failed",
        title: "Already Added",
        message: "All recommended species are already in the list.",
      });
      return;
    }
    setAdjustedProvision([...adjustedProvision, ...toAdd]);
  };

  const handleCreate = async () => {
    if (!selectedGrower) {
      setPSAlert({
        type: "failed",
        title: "Missing Info",
        message: "Please select a tree grower.",
      });
      return;
    }
    if (!selectedInspectorId) {
      setPSAlert({
        type: "failed",
        title: "Missing Info",
        message: "Please select an inspector.",
      });
      return;
    }
    const rows = adjustedProvision.filter((p) => p.quantity > 0);
    if (rows.length === 0) {
      setPSAlert({
        type: "failed",
        title: "Invalid Quantity",
        message: "At least one species must have a quantity greater than 0.",
      });
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}api/requests/admin-create/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          application_id: selectedGrower.application_id,
          inspector_id: selectedInspectorId,
          fulfillment_type: fulfillmentType,
          description: notes,
          species: rows.map((p) => ({
            tree_species_id: p.species_id,
            quantity: p.quantity,
            provided_by: p.provided_by,
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to create request.");

      setPSAlert({
        type: "success",
        title: "Request Created",
        message: `Seedlings assigned to ${selectedGrower.group_name}. The grower and inspector have been notified.`,
      });
      setTimeout(() => navigate("/DataManager/request"), 1500);
    } catch (err: any) {
      setPSAlert({ type: "error", title: "Failed", message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

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

  const [downloadingPlan, setDownloadingPlan] = useState(false);

  const handleDownloadMaintenancePlan = async () => {
    if (downloadingPlan) return; // ignore extra clicks while a download runs
    const applicationId = isCreate
      ? selectedGrower?.application_id
      : request?.application_id;
    if (!appDetails?.maintenance_plan || !applicationId) {
      setPSAlert({
        type: "failed",
        title: "Error",
        message: "No maintenance plan available",
      });
      return;
    }
    setDownloadingPlan(true);
    try {
      const response = await fetch(
        `${API_BASE}api/application/${applicationId}/download-maintenance-plan/`,
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
      // Plans can be PDF or Word; name the file after the type the server sent
      const ext = blob.type.includes("wordprocessingml") ? "docx" : blob.type === "application/msword" ? "doc" : "pdf";
      link.download = `maintenance_plan_${applicationId}.${ext}`;
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
    } finally {
      setDownloadingPlan(false);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────
  if (loading)
    return (
      <div className="flex justify-center items-center h-screen">
        <LoaderPending />
      </div>
    );
  if (!isCreate && !request)
    return (
      <div className="flex justify-center items-center h-screen text-gray-500">
        Request not found.
      </div>
    );

  const totalProvision = adjustedProvision.reduce(
    (sum, item) => sum + (item.quantity || 0),
    0,
  );

  // Unified context for the left column (works for both modes)
  const ctx = isCreate
    ? appDetails && selectedGrower
      ? {
          groupName: appDetails.group_name,
          groupContact: appDetails.group_contact,
          representativeName: selectedGrower.email,
          representativeContact: "",
          siteName: appDetails.assigned_site?.name || "No site assigned",
          barangay: appDetails.assigned_site?.barangay || "N/A",
        }
      : null
    : {
        groupName: request!.grower_info.group_name,
        groupContact: request!.grower_info.group_contact,
        representativeName: request!.grower_info.representative_name,
        representativeContact: request!.grower_info.representative_contact,
        siteName: request!.site_info.site_name,
        barangay: request!.site_info.barangay,
      };

  // ─── Shared Cards ────────────────────────────────────────────────────────
  const fulfillmentCard = (step: number) => (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
        {step}. Fulfillment Method
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
          <p className="text-sm font-semibold text-gray-900">Deliver to Site</p>
          <p className="text-xs text-gray-500 mt-1">ENRO delivers directly.</p>
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
          <p className="text-sm font-semibold text-gray-900">Grower Pickup</p>
          <p className="text-xs text-gray-500 mt-1">
            Grower picks up at nursery.
          </p>
        </button>
      </div>
    </div>
  );

  const inspectorCard = (step: number) => (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
          {step}. Assign Onsite Inspector
        </h3>
        <span className="text-[10px] text-gray-400">
          Sorted by fewest ongoing tasks
        </span>
      </div>
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-3 text-gray-400" />
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
                  <p className="text-xs text-gray-500">{insp.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap ${workloadStyle(insp.ongoing_count ?? 0)}`}
                  title="Seedling requests assigned and awaiting confirmation"
                >
                  {(insp.ongoing_count ?? 0) === 0
                    ? "No ongoing"
                    : `${insp.ongoing_count} ongoing`}
                </span>
                {selectedInspectorId === insp.id && (
                  <CheckCircle2 size={20} className="text-[#0F4A2F]" />
                )}
              </div>
            </button>
          ))
        ) : (
          <p className="text-sm text-gray-400 text-center py-4">
            No inspectors found.
          </p>
        )}
      </div>
    </div>
  );

  const provisionCard = (step: number) => (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
          {step}. Seedlings to Provide
        </h3>
        {isCreate && appDetails && appDetails.recommended_species.length > 0 && (
          <button
            onClick={handleAddRecommended}
            className="flex items-center gap-1 text-xs font-medium text-[#0F4A2F] hover:underline"
          >
            <Lightbulb size={12} /> Add site-recommended species
          </button>
        )}
      </div>

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
              <option key={s.tree_specie_id} value={s.tree_specie_id}>
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

      <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
        {adjustedProvision.length > 0 ? (
          adjustedProvision.map((sp, i) => (
            <div
              key={sp.species_id}
              className="flex flex-wrap items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200"
            >
              <div className="flex items-center gap-2 flex-1 min-w-30">
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

              <div className="flex-1 min-w-30">
                <label className="block text-[10px] text-gray-500 mb-0.5">
                  Provided By
                </label>
                <input
                  type="text"
                  value={sp.provided_by}
                  onChange={(e) =>
                    updateProvisionItem(i, "provided_by", e.target.value)
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
  );

  const notesCard = (step: number, title: string, placeholder: string) => (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
        {step}. {title}
      </h3>
      <textarea
        rows={3}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4A2F] focus:border-transparent resize-none"
      />
    </div>
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
              {isCreate ? "Create Seedling Request" : "Seedling Request Evaluation"}
            </h1>
            <p className="text-sm text-gray-500">
              {isCreate
                ? selectedGrower
                  ? `${selectedGrower.group_name} · ${selectedGrower.application_title}`
                  : "Select a tree grower and the seedlings ENRO will provide."
                : request!.application_title}
            </p>
          </div>
        </div>
        {isCreate ? (
          <span className="px-3 py-1 rounded-full text-xs font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200">
            NEW REQUEST
          </span>
        ) : (
          <div className="flex items-center gap-2">
            {request!.created_by_admin && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200">
                <ShieldCheck size={12} /> Created by ENRO
              </span>
            )}
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                STATUS_BADGE[request!.status] || STATUS_BADGE.rejected
              }`}
            >
              {request!.status.toUpperCase()}
            </span>
          </div>
        )}
      </div>

      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* ─── Left Column: Context ────────────────────────────────────── */}
          <div className="space-y-6">
            {/* Create mode: Tree Grower picker */}
            {isCreate && (
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
                  Select Tree Grower
                </h3>
                <div className="relative mb-4">
                  <Search
                    size={16}
                    className="absolute left-3 top-3 text-gray-400"
                  />
                  <input
                    type="text"
                    placeholder="Search group, application, site, or barangay..."
                    value={growerSearch}
                    onChange={(e) => setGrowerSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4A2F] focus:border-transparent"
                  />
                </div>
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {growers.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-6">
                      No tree growers with an active (accepted / under
                      monitoring) application.
                    </p>
                  ) : filteredGrowers.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">
                      No match for "{growerSearch}".
                    </p>
                  ) : (
                    filteredGrowers.map((g) => {
                      const selected =
                        selectedGrower?.application_id === g.application_id;
                      return (
                        <button
                          key={g.application_id}
                          onClick={() => handleSelectGrower(g)}
                          className={`w-full flex items-start justify-between gap-3 p-3 rounded-lg border text-left transition-all ${
                            selected
                              ? "border-[#0F4A2F] bg-green-50"
                              : "border-gray-200 hover:bg-gray-50"
                          }`}
                        >
                          <div className="flex items-start gap-3 min-w-0">
                            <div
                              className={`p-2 rounded-full shrink-0 ${selected ? "bg-[#0F4A2F] text-white" : "bg-gray-100 text-gray-500"}`}
                            >
                              <Users size={16} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-900 truncate">
                                {g.group_name}
                              </p>
                              <p className="text-xs text-gray-500 truncate">
                                {g.application_title} · {g.application_status}
                              </p>
                              <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                                <MapPin size={11} />
                                {g.site_name
                                  ? `${g.site_name}${g.barangay ? ` • Brgy. ${g.barangay}` : ""}`
                                  : "No site assigned"}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            {selected && (
                              <CheckCircle2
                                size={20}
                                className="text-[#0F4A2F]"
                              />
                            )}
                            {g.pending_requests > 0 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 font-semibold whitespace-nowrap">
                                {g.pending_requests} pending
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {isCreate && growerLoading && (
              <div className="flex items-center justify-center py-10 text-sm text-gray-500 gap-2">
                <Loader2 size={16} className="animate-spin" /> Loading grower
                details…
              </div>
            )}

            {/* Maintenance Plan Section */}
            {appDetails?.maintenance_plan && (
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
                  Maintenance Plan
                </h3>
                <button
                  onClick={handleDownloadMaintenancePlan}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-dashed border-green-300 bg-green-50 hover:bg-green-100 transition-colors group cursor-pointer disabled:cursor-wait disabled:opacity-80"
                  type="button"
                  disabled={downloadingPlan}
                >
                  <div className="w-9 h-9 rounded-lg bg-[#0F4A2F] flex items-center justify-center shrink-0">
                    <FileText size={16} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-semibold text-[#0F4A2F] truncate">
                      {appDetails.maintenance_plan.split("/").pop() ||
                        "Maintenance Plan"}
                    </p>
                    <p className="text-xs text-green-600">
                      {downloadingPlan ? "Downloading..." : "Click to download"}
                    </p>
                  </div>
                  {downloadingPlan ? (
                    <Loader2 size={16} className="text-[#0F4A2F] animate-spin" />
                  ) : (
                    <Download
                      size={16}
                      className="text-green-500 group-hover:text-[#0F4A2F] transition-colors"
                    />
                  )}
                </button>
              </div>
            )}

            {/* Application Stats */}
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
                        {isCreate ? "Previous Requests" : "Seedlings Requested"}
                      </p>
                    </div>
                    <p className="text-2xl font-bold text-blue-700">
                      {isCreate
                        ? appDetails.seedling_requests.length
                        : request!.no_request_seedling}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Grower Info */}
            {ctx && (
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
                  Grower Information
                </h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-gray-500">Group Name</p>
                    <p className="font-semibold text-gray-900">
                      {ctx.groupName}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">
                      {isCreate ? "Account Email" : "Representative"}
                    </p>
                    <p className="text-sm text-gray-800">
                      {ctx.representativeName}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500">Group Contact</p>
                      <p className="text-sm text-gray-800">
                        {ctx.groupContact || "N/A"}
                      </p>
                    </div>
                    {!isCreate && (
                      <div>
                        <p className="text-xs text-gray-500">Rep. Contact</p>
                        <p className="text-sm text-gray-800">
                          {ctx.representativeContact || "N/A"}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Site Info with View Details Button */}
            {ctx && (
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Assigned Site
                  </h3>
                  {appDetails?.assigned_site && (
                    <button
                      onClick={() =>
                        navigate(
                          `/DataManager/reforestation/site/${appDetails.assigned_site!.reforestation_area_id}/information/${appDetails.assigned_site!.site_id}`,
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
                    <p className="font-semibold text-gray-900">{ctx.siteName}</p>
                    <p className="text-sm text-gray-500">{ctx.barangay}</p>
                  </div>
                </div>
                {isCreate &&
                  appDetails &&
                  appDetails.recommended_species.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <p className="text-xs text-gray-500 mb-2">
                        Recommended species for this site
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {appDetails.recommended_species.map((r) => (
                          <span
                            key={`${r.species_id}-${r.rank}`}
                            className="px-2 py-0.5 rounded-full text-xs bg-green-50 text-[#0F4A2F] border border-green-200"
                          >
                            {r.species_name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            )}

            {/* Create mode: Previous requests for this application */}
            {isCreate && appDetails && (
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <History size={13} /> Previous Seedling Requests
                </h3>
                {appDetails.seedling_requests.length > 0 ? (
                  <div className="space-y-2">
                    {appDetails.seedling_requests.map((sr) => (
                      <div
                        key={sr.request_id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100"
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-800">
                            {sr.no_request_seedling.toLocaleString()} seedlings
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatDate(sr.submitted_at)}
                          </p>
                        </div>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${STATUS_BADGE[sr.status] || STATUS_BADGE.cancelled}`}
                        >
                          {sr.status.charAt(0).toUpperCase() + sr.status.slice(1)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-3">
                    No previous requests for this application.
                  </p>
                )}
              </div>
            )}

            {/* Eval mode: Original Requested Seedlings */}
            {!isCreate && request && (
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
                {request.description && (
                  <p className="mt-3 text-xs text-gray-500 italic">
                    “{request.description}”
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ─── Right Column: Action Form ────────────────────────────────── */}
          <div className="space-y-6">
            {isCreate ? (
              selectedGrower ? (
                <>
                  {fulfillmentCard(1)}
                  {inspectorCard(2)}
                  {provisionCard(3)}
                  {notesCard(
                    4,
                    "Notes for the Tree Grower (Optional)",
                    "e.g., Seedlings are ready for pickup at the ENRO Nursery.",
                  )}

                  <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 text-xs text-blue-800">
                    Since ENRO is providing these seedlings, the request is
                    created as <b>Accepted</b> right away — no separate
                    approval. The tree grower and the assigned inspector will
                    both be notified, and the inspector confirms on handover.
                  </div>

                  <div className="flex gap-4 pt-2 pb-10">
                    <button
                      onClick={() => navigate("/DataManager/request")}
                      disabled={submitting}
                      className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-600 font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreate}
                      disabled={
                        submitting ||
                        totalProvision <= 0 ||
                        !selectedInspectorId
                      }
                      className="flex-2 py-3 rounded-xl bg-[#0F4A2F] text-white font-semibold hover:bg-[#1a6b44] transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {submitting ? (
                        "Creating..."
                      ) : (
                        <>
                          <Send size={18} /> Create & Assign
                        </>
                      )}
                    </button>
                  </div>
                </>
              ) : (
                <div className="bg-white p-10 rounded-xl border border-dashed border-gray-300 flex flex-col items-center justify-center text-center gap-2 text-gray-400">
                  <Users size={32} />
                  <p className="text-sm font-medium text-gray-500">
                    Select a tree grower to continue
                  </p>
                  <p className="text-xs">
                    Their application, site, and previous requests will appear
                    here, then you can choose the seedlings to provide.
                  </p>
                </div>
              )
            ) : request!.status === "pending" ? (
              <>
                {fulfillmentCard(1)}
                {inspectorCard(2)}

                {/* Step 3: Build Provision List */}
                {provisionCard(3)}

                {/* Step 4: Notes */}
                {notesCard(
                  4,
                  "Notes (Optional)",
                  "e.g., Approved, but Mahogany quantity reduced due to low nursery stock.",
                )}

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
                    className="flex-2 py-3 rounded-xl bg-[#0F4A2F] text-white font-semibold hover:bg-[#1a6b44] transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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

                {request!.fulfillment_type && (
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1">
                      Fulfillment Method
                    </p>
                    <p className="text-sm font-medium text-gray-900 capitalize flex items-center gap-2">
                      {request!.fulfillment_type === "deliver" ? (
                        <Truck size={16} />
                      ) : (
                        <Home size={16} />
                      )}
                      {request!.fulfillment_type === "deliver"
                        ? "Deliver to Site"
                        : "Grower Pickup"}
                    </p>
                  </div>
                )}

                {request!.assigned_inspector && (
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1">
                      Assigned Inspector
                    </p>
                    <p className="text-sm font-medium text-gray-900 flex items-center gap-2">
                      <User size={16} /> {request!.assigned_inspector.name}
                    </p>
                    <p className="text-xs text-gray-500 mt-1 ml-6">
                      {request!.assigned_inspector.contact}
                    </p>
                  </div>
                )}

                {/* Seedlings provided / requested */}
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase">
                      {request!.status === "confirmed"
                        ? "Seedlings Delivered"
                        : request!.status === "accepted"
                          ? "Seedlings to Provide"
                          : "Seedlings Requested"}
                    </p>
                    <span className="text-[11px] text-gray-400">
                      {request!.species.length} species
                    </span>
                  </div>
                  {request!.species.length > 0 ? (
                    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-400">
                          <tr>
                            <th className="text-left font-semibold px-3 py-2">Species</th>
                            <th className="text-left font-semibold px-3 py-2">Provided By</th>
                            <th className="text-right font-semibold px-3 py-2">Qty</th>
                          </tr>
                        </thead>
                        <tbody>
                          {request!.species.map((sp) => (
                            <tr key={sp.species_id} className="border-t border-gray-100">
                              <td className="px-3 py-2">
                                <span className="flex items-center gap-2 font-medium text-gray-800">
                                  <Sprout size={14} className="text-[#0F4A2F] shrink-0" />
                                  {sp.species_name}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-gray-500">
                                {sp.provided_by || "—"}
                              </td>
                              <td className="px-3 py-2 text-right font-bold text-[#0F4A2F]">
                                {sp.quantity.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-gray-200 bg-green-50/60">
                            <td colSpan={2} className="px-3 py-2 text-xs font-semibold text-gray-600">
                              Total
                            </td>
                            <td className="px-3 py-2 text-right text-base font-bold text-[#0F4A2F]">
                              {request!.no_request_seedling.toLocaleString()}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 italic">No species recorded.</p>
                  )}
                </div>

                {/* Notes — Data Manager vs Inspector */}
                {(() => {
                  const { manager, inspector } = splitNotes(request!.reason_accepted);
                  const isNegative =
                    request!.status === "rejected" || request!.status === "cancelled";
                  return (
                    <>
                      {isNegative && request!.reason && (
                        <div className="p-4 bg-red-50 rounded-xl border border-red-200">
                          <p className="text-xs font-semibold text-red-700 uppercase mb-1">
                            {request!.status === "rejected" ? "Rejection Reason" : "Cancellation Reason"}
                          </p>
                          <p className="text-sm text-red-900">{request!.reason}</p>
                        </div>
                      )}
                      {manager && (
                        <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                          <p className="text-xs font-semibold text-blue-700 uppercase mb-1">
                            Data Manager Notes
                          </p>
                          <p className="text-sm text-blue-900">{manager}</p>
                        </div>
                      )}
                      {inspector && (
                        <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                          <p className="text-xs font-semibold text-amber-700 uppercase mb-1">
                            Inspector Notes
                          </p>
                          <p className="text-sm text-amber-900">{inspector}</p>
                        </div>
                      )}
                    </>
                  );
                })()}

                {/* Proof of delivery */}
                {request!.proof_of_delivery && (
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold text-gray-500 uppercase">
                        Proof of Delivery
                      </p>
                      <a
                        href={request!.proof_of_delivery}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-xs text-[#0F4A2F] hover:underline font-medium"
                      >
                        Open full size <ExternalLink size={12} />
                      </a>
                    </div>
                    <a href={request!.proof_of_delivery} target="_blank" rel="noreferrer">
                      <img
                        src={request!.proof_of_delivery}
                        alt="Proof of delivery"
                        className="w-full max-h-80 object-cover rounded-lg border border-gray-200 hover:opacity-90 transition-opacity"
                      />
                    </a>
                  </div>
                )}

                {request!.status === "confirmed" && (
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
