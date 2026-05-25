import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  User,
  Building2,
  FileText,
  Download,
  CheckCircle2,
  XCircle,
  ChevronRight,
  MapPin,
  Leaf,
  Mail,
  Calendar,
  Trees,
  Search,
  CheckSquare,
  AlertTriangle,
  Shield,
  Layers,
  Sprout,
  Plus,
  Trash2,
  Package,
} from "lucide-react";
import PlantScopeAlert from "../../../components/alert/PlantScopeAlert";

// ─── Types ──────────────────────────────────────────────────────────────────

interface ApplicationDetail {
  application: {
    application_id: number;
    title: string;
    description: string;
    classification: "new" | "old";
    status: string;
    total_members: number;
    project_duration: number | null;
    orientation_date: string | null;
    confirmed_at: string | null;
    maintenance_plan: string | null;
    agreement_image: string | null;
    created_at: string;
    updated_at: string;
  };
  organization: {
    organization_name: string;
    org_email: string;
    org_contact: string;
    org_address: string;
    org_profile: string | null;
  };
  profile: {
    first_name: string;
    last_name: string;
    contact: string;
    gender: string;
    profile_img: string;
  } | null;
  assigned_site: {
    site_id: number;
    name: string;
    barangay: string | null;
    polygon_coordinates: string | null;
  } | null;
  seedling_requests: Array<{
    request_id: number;
    no_request_seedling: number;
    seedling_type: Record<
      string,
      number | { quantity: number; provided_by: string }
    >;
    status: "pending" | "accepted" | "rejected";
    reason_accepted: string | null;
    submitted_at: string | null;
  }>;
  progress_reports: Array<{
    report_id: number;
    no_survived_plants: number;
    no_dead_plants: number;
    description: string | null;
    status: "pending" | "accepted" | "rejected";
    proof_image: string | null;
    submitted_at: string | null;
  }>;
  latest_reason: { reason: string; status: string; created: string } | null;
}

interface ReforestationArea {
  reforestation_area_id: number;
  name: string;
  legality: string;
  pre_assessment_status: string;
  safety: string;
  barangay: { barangay_id: number; name: string } | null;
  land_classification: { land_classification_id: number; name: string } | null;
}

interface Site {
  site_id: number;
  name: string;
  status: string;
  area_hectares: number;
  ndvi: number | null;
  validation_progress: {
    completed: number;
    total: number;
    layer_status: Record<string, string>;
  };
  created_at: string;
}

// NEW: Provision entry with per-species provider
interface ProvisionEntry {
  species: string;
  quantity: number;
  provided_by: string;
}

// Provider options (reusable)
const PROVIDER_OPTIONS = [
  "ENRO Nursery",
  "Partner NGO",
  "LGU Supply",
  "Private Donor",
  "Community Nursery",
];

// ─── Sub-components ─────────────────────────────────────────────────────────

function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="w-10 h-10 rounded-xl bg-[#0F4A2F] flex items-center justify-center text-green-300 flex-shrink-0">
        {icon}
      </div>
      <div>
        <h2 className="text-lg font-bold text-[#0F4A2F] leading-tight">
          {title}
        </h2>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string | number | null;
}) {
  return (
    <div className="flex flex-col gap-0.5 py-3 border-b border-gray-100 last:border-0">
      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
        {label}
      </span>
      <span className="text-sm text-gray-800 font-medium">{value ?? "—"}</span>
    </div>
  );
}

function SeedlingBadge({
  species,
  count,
  provider,
}: {
  species: string;
  count: number;
  provider?: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-50 text-green-700 text-xs font-medium border border-green-200">
      <Sprout size={12} />
      <span className="font-semibold">{species}:</span> {count}
      {provider && <span className="text-green-500">• {provider}</span>}
    </span>
  );
}

// NEW: Species row with quantity + provider dropdown
function SpeciesQuantityRow({
  entry,
  onQuantityChange,
  onProviderChange,
  onRemove,
}: {
  entry: ProvisionEntry;
  onQuantityChange: (species: string, qty: number) => void;
  onProviderChange: (species: string, provider: string) => void;
  onRemove: (species: string) => void;
}) {
  return (
    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
      {/* Header: Species name + remove */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sprout size={16} className="text-[#0F4A2F]" />
          <span className="font-semibold text-gray-800">{entry.species}</span>
        </div>
        <button
          onClick={() => onRemove(entry.species)}
          className="w-7 h-7 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center transition-colors"
          title="Remove species"
          type="button"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Quantity + Provider inputs */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Quantity
          </label>
          <div className="relative">
            <input
              type="number"
              min={1}
              value={entry.quantity}
              onChange={(e) =>
                onQuantityChange(
                  entry.species,
                  Math.max(1, parseInt(e.target.value) || 1),
                )
              }
              className="w-full pl-3 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#0F4A2F] focus:ring-1 focus:ring-[#0F4A2F]"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Provided By
          </label>
          <div className="relative">
            <Package
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <select
              value={entry.provided_by}
              onChange={(e) => onProviderChange(entry.species, e.target.value)}
              className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-[#0F4A2F] focus:ring-1 focus:ring-[#0F4A2F]"
            >
              {PROVIDER_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function Evaluation_application() {
  const { application_id } = useParams<{ application_id: string }>();
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const [detail, setDetail] = useState<ApplicationDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [tab, setTab] = useState(0);

  // Site selection state
  const [areas, setAreas] = useState<ReforestationArea[]>([]);
  const [areaSearch, setAreaSearch] = useState("");
  const [selectedArea, setSelectedArea] = useState<ReforestationArea | null>(
    null,
  );
  const [sites, setSites] = useState<Site[]>([]);
  const [siteSearch, setSiteSearch] = useState("");
  const [loadingSites, setLoadingSites] = useState(false);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);

  // Decision form
  const [decisionForm, setDecisionForm] = useState({
    reason: "",
    orientation_date: "",
    agreement_image: null as File | null,
  });

  // Seedling provisioning state (per-species)
  const [treeSpeciesList, setTreeSpeciesList] = useState<string[]>([]);
  const [loadingSpecies, setLoadingSpecies] = useState(false);
  const [newSpecies, setNewSpecies] = useState("");
  const [provisionEntries, setProvisionEntries] = useState<ProvisionEntry[]>(
    [],
  );

  const [submitting, setSubmitting] = useState(false);
  const [confirmAction, setConfirmAction] = useState<
    "forward" | "reject" | null
  >(null);
  const [PSalert, setPSAlert] = useState<{
    type: "success" | "failed" | "error";
    title: string;
    message: string;
  } | null>(null);

  // ─── Fetch application detail ────────────────────────────────────────────
  useEffect(() => {
    const fetchDetail = async () => {
      setLoadingDetail(true);
      try {
        const res = await fetch(
          `http://127.0.0.1:8000/api/get_application/${application_id}/`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (!res.ok) throw new Error("Failed to fetch application");
        const data = await res.json();
        setDetail(data);

        if (data.assigned_site) {
          setSelectedSite({
            site_id: data.assigned_site.site_id,
            name: data.assigned_site.name,
            status: "active",
            area_hectares: 0,
            ndvi: null,
            validation_progress: { completed: 0, total: 0, layer_status: {} },
            created_at: "",
          });
        }
      } catch (err) {
        console.error(err);
        setPSAlert({
          type: "error",
          title: "Error",
          message: "Failed to load application details.",
        });
      } finally {
        setLoadingDetail(false);
      }
    };
    if (application_id) fetchDetail();
  }, [application_id, token]);

  // ─── Fetch tree species list ─────────────────────────────────────────────
  useEffect(() => {
    if (tab !== 2) return;
    const fetchSpecies = async () => {
      setLoadingSpecies(true);
      try {
        const res = await fetch(
          "http://127.0.0.1:8000/api/get_tree_species_list/",
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (res.ok) {
          const data = await res.json();
          const names = Array.isArray(data)
            ? data.map((s: any) => s.name || s).filter(Boolean)
            : data.species || [];
          setTreeSpeciesList(names);
        }
      } catch (err) {
        console.error("Failed to fetch species:", err);
        setTreeSpeciesList([
          "Narra",
          "Mahogany",
          "Ipil-Ipil",
          "Yakal",
          "Molave",
          "Acacia",
          "Gmelina",
          "Bamboo",
        ]);
      } finally {
        setLoadingSpecies(false);
      }
    };
    fetchSpecies();
  }, [tab, token]);

  // ─── Fetch reforestation areas ───────────────────────────────────────────
  useEffect(() => {
    if (tab !== 2) return;
    const fetchAreas = async () => {
      try {
        const params = new URLSearchParams({ entries: "100", page: "1" });
        const res = await fetch(
          `http://127.0.0.1:8000/api/get_all_reforestation_areas/?${params}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (!res.ok) throw new Error();
        const data = await res.json();
        setAreas(data.data ?? []);
      } catch {
        setPSAlert({
          type: "error",
          title: "Error",
          message: "Failed to load reforestation areas.",
        });
      }
    };
    fetchAreas();
  }, [tab, token]);

  // ─── Fetch sites when area selected ─────────────────────────────────────
  useEffect(() => {
    if (!selectedArea) return;
    const fetchSites = async () => {
      setLoadingSites(true);
      setSites([]);
      setSelectedSite(null);
      try {
        const res = await fetch(
          `http://127.0.0.1:8000/api/list_sites/${selectedArea.reforestation_area_id}/?status=accepted`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (!res.ok) throw new Error();
        const data = await res.json();
        setSites(data.data ?? []);
      } catch {
        setPSAlert({
          type: "error",
          title: "Error",
          message: "Failed to load sites.",
        });
      } finally {
        setLoadingSites(false);
      }
    };
    fetchSites();
  }, [selectedArea, token]);

  // ─── Seedling provisioning helpers ───────────────────────────────────────
  const handleAddSpecies = () => {
    if (newSpecies && !provisionEntries.some((e) => e.species === newSpecies)) {
      setProvisionEntries([
        ...provisionEntries,
        { species: newSpecies, quantity: 1, provided_by: PROVIDER_OPTIONS[0] },
      ]);
      setNewSpecies("");
    }
  };

  const handleRemoveSpecies = (species: string) => {
    setProvisionEntries(provisionEntries.filter((e) => e.species !== species));
  };

  const handleQuantityChange = (species: string, newQty: number) => {
    setProvisionEntries(
      provisionEntries.map((e) =>
        e.species === species ? { ...e, quantity: Math.max(1, newQty) } : e,
      ),
    );
  };

  const handleProviderChange = (species: string, newProvider: string) => {
    setProvisionEntries(
      provisionEntries.map((e) =>
        e.species === species ? { ...e, provided_by: newProvider } : e,
      ),
    );
  };

  // NEW: Output nested JSON structure for backend
  const getSeedlingProvisionJSON = (): string => {
    const obj: Record<string, { quantity: number; provided_by: string }> = {};
    provisionEntries.forEach((entry) => {
      obj[entry.species] = {
        quantity: entry.quantity,
        provided_by: entry.provided_by,
      };
    });
    return JSON.stringify(obj);
  };

  const getTotalProvisioned = (): number => {
    return provisionEntries.reduce((sum, e) => sum + e.quantity, 0);
  };

  // Group entries by provider for summary display
  const getEntriesByProvider = () => {
    const grouped: Record<string, { species: string; quantity: number }[]> = {};
    provisionEntries.forEach((e) => {
      if (!grouped[e.provided_by]) grouped[e.provided_by] = [];
      grouped[e.provided_by].push({ species: e.species, quantity: e.quantity });
    });
    return grouped;
  };

  // ─── Submit evaluation ───────────────────────────────────────────────────
  const handleSubmit = async (status: "for_head" | "rejected") => {
    if (status === "for_head") {
      if (!selectedSite) {
        setPSAlert({
          type: "failed",
          title: "Missing",
          message: "Please select a planting site.",
        });
        return;
      }
      if (!decisionForm.orientation_date) {
        setPSAlert({
          type: "failed",
          title: "Missing",
          message: "Orientation date is required.",
        });
        return;
      }
      if (provisionEntries.length === 0) {
        setPSAlert({
          type: "failed",
          title: "Missing",
          message: "Please add at least one tree species.",
        });
        return;
      }
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("status", status);
      fd.append("reason", decisionForm.reason);
      fd.append("orientation_date", decisionForm.orientation_date);
      fd.append("site_id", String(selectedSite?.site_id ?? ""));

      // NEW: Send nested JSON with per-species providers
      fd.append("seedling_provision", getSeedlingProvisionJSON());

      if (decisionForm.agreement_image) {
        fd.append("agreement_image", decisionForm.agreement_image);
      }

      const res = await fetch(
        `http://127.0.0.1:8000/api/evaluate_application/${application_id}/`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        },
      );
      const data = await res.json();

      if (!res.ok) {
        setPSAlert({
          type: "failed",
          title: "Failed",
          message: data.error ?? "Something went wrong.",
        });
        return;
      }

      setPSAlert({
        type: "success",
        title: status === "for_head" ? "Forwarded!" : "Rejected",
        message:
          data.message ??
          (status === "for_head"
            ? "Application forwarded to Head for confirmation."
            : "Application has been rejected."),
      });
      setTimeout(() => navigate(-1), 1800);
    } catch (err) {
      console.error(err);
      setPSAlert({
        type: "error",
        title: "Error",
        message: "Network error. Please try again.",
      });
    } finally {
      setSubmitting(false);
      setConfirmAction(null);
    }
  };

  // ─── Filtered lists ─────────────────────────────────────────────────────
  const filteredAreas = areas.filter(
    (a) =>
      a.pre_assessment_status === "approved" &&
      a.legality === "legal" &&
      a.name.toLowerCase().includes(areaSearch.toLowerCase()),
  );
  const filteredSites = sites.filter((s) =>
    s.name.toLowerCase().includes(siteSearch.toLowerCase()),
  );
  const availableSpecies = treeSpeciesList.filter(
    (s) => !provisionEntries.some((e) => e.species === s),
  );

  // Parse initial seedling request (handle both old flat and new nested formats)
  const initialSeedlingRequest = detail?.seedling_requests?.find(
    (r) => r.status === "pending",
  );
  const seedlingTypeEntries = initialSeedlingRequest
    ? Object.entries(initialSeedlingRequest.seedling_type).map(
        ([species, val]) => {
          if (typeof val === "number")
            return { species, count: val, provider: undefined };
          if (typeof val === "object" && val !== null && "quantity" in val) {
            return {
              species,
              count: (val as any).quantity,
              provider: (val as any).provided_by,
            };
          }
          return { species, count: 0, provider: undefined };
        },
      )
    : [];

  const TABS = [
    { label: "Account & Personal", icon: <User size={14} /> },
    { label: "Organization & Plan", icon: <Building2 size={14} /> },
    { label: "Decision", icon: <CheckSquare size={14} /> },
  ];

  if (loadingDetail) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#0F4A2F] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-500">Loading application…</span>
        </div>
      </div>
    );
  }

  if (!detail) return null;
  const {
    application,
    organization: org,
    profile,
    assigned_site,
    latest_reason,
  } = detail;

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

      {/* Confirm Modal */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div
              className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${confirmAction === "forward" ? "bg-green-100" : "bg-red-100"}`}
            >
              {confirmAction === "forward" ? (
                <CheckCircle2 size={28} className="text-green-600" />
              ) : (
                <XCircle size={28} className="text-red-500" />
              )}
            </div>
            <h3 className="text-lg font-bold text-center text-gray-800 mb-1">
              {confirmAction === "forward"
                ? "Forward to Head?"
                : "Reject Application?"}
            </h3>
            <p className="text-sm text-center text-gray-500 mb-6">
              {confirmAction === "forward"
                ? "This will activate the tree grower account and forward the application to the Head for final approval."
                : "This will reject the application. Please make sure you've provided a reason."}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmAction(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  handleSubmit(
                    confirmAction === "forward" ? "for_head" : "rejected",
                  )
                }
                disabled={submitting}
                className={`flex-1 py-2.5 rounded-xl text-white text-sm font-bold transition-all ${confirmAction === "forward" ? "bg-[#0F4A2F] hover:bg-[#1a6b44]" : "bg-red-500 hover:bg-red-600"} ${submitting ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {submitting
                  ? "Processing…"
                  : confirmAction === "forward"
                    ? "Yes, Forward"
                    : "Yes, Reject"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-gradient-to-r from-[#0F4A2F] to-[#1a6b44] text-white px-6 py-5 shadow-lg">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2.5">
            <Leaf size={22} className="text-green-300" />
            <div>
              <h1 className="text-xl font-bold leading-tight">
                Application Evaluation
              </h1>
              <p className="text-xs text-green-200 mt-0.5">
                {application.title}
              </p>
            </div>
          </div>
          <div className="ml-auto hidden md:flex items-center gap-2">
            {TABS.map((t, i) => (
              <div key={i} className="flex items-center gap-2">
                <button
                  onClick={() => setTab(i)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${tab === i ? "bg-white text-[#0F4A2F]" : "bg-white/10 text-white/70 hover:bg-white/20"}`}
                >
                  {t.icon}
                  {t.label}
                </button>
                {i < TABS.length - 1 && (
                  <ChevronRight size={14} className="text-white/40" />
                )}
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* Mobile tab bar */}
      <div className="md:hidden flex border-b border-gray-200 bg-white sticky top-0 z-10">
        {TABS.map((t, i) => (
          <button
            key={i}
            onClick={() => setTab(i)}
            className={`flex-1 py-3 text-xs font-semibold flex flex-col items-center gap-1 transition-colors ${tab === i ? "text-[#0F4A2F] border-b-2 border-[#0F4A2F]" : "text-gray-400"}`}
          >
            {t.icon}
            {t.label.split(" ")[0]}
          </button>
        ))}
      </div>

      <main className="max-w-6xl mx-auto p-4 md:p-8">
        {/* TAB 0: Account + Personal */}
        {tab === 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <SectionHeader
                icon={<Mail size={18} />}
                title="Account Information"
                subtitle="Login credentials registered"
              />
              <InfoRow
                label="Application ID"
                value={application.application_id}
              />
              <InfoRow
                label="Submitted"
                value={new Date(application.created_at).toLocaleDateString(
                  "en-PH",
                  { year: "numeric", month: "long", day: "numeric" },
                )}
              />
              <InfoRow
                label="Classification"
                value={
                  application.classification === "new"
                    ? "New Application"
                    : "Existing"
                }
              />
              <InfoRow
                label="Status"
                value={application.status.replace("_", " ").toUpperCase()}
              />
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <SectionHeader
                icon={<User size={18} />}
                title="Personal Information"
                subtitle="Profile details of the applicant"
              />
              {profile ? (
                <>
                  <div className="flex items-center gap-4 mb-4 pb-4 border-b border-gray-100">
                    {profile.profile_img ? (
                      <img
                        src={`http://127.0.0.1:8000${profile.profile_img}`}
                        alt="Profile"
                        className="w-16 h-16 rounded-xl object-cover border-2 border-green-100"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-green-50 flex items-center justify-center">
                        <User size={28} className="text-green-300" />
                      </div>
                    )}
                    <div>
                      <p className="font-bold text-gray-800">
                        {profile.first_name} {profile.last_name}
                      </p>
                      <p className="text-xs text-gray-400 capitalize">
                        {profile.gender}
                      </p>
                    </div>
                  </div>
                  <InfoRow label="Contact" value={profile.contact} />
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-gray-300">
                  <User size={36} />
                  <p className="text-sm mt-2">No profile data available</p>
                </div>
              )}
            </div>
            <div className="md:col-span-2 flex justify-end">
              <button
                onClick={() => setTab(1)}
                className="flex items-center gap-2 bg-[#0F4A2F] text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-[#1a6b44] transition-colors"
              >
                Next: Organization & Plan <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* TAB 1: Organization + Plan */}
        {tab === 1 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <SectionHeader
                icon={<Building2 size={18} />}
                title="Organization Information"
              />
              <div className="flex items-center gap-4 mb-4 pb-4 border-b border-gray-100">
                {org.org_profile ? (
                  <img
                    src={`http://127.0.0.1:8000${org.org_profile}`}
                    alt="Org"
                    className="w-16 h-16 rounded-xl object-cover border-2 border-green-100"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-green-50 flex items-center justify-center">
                    <Building2 size={28} className="text-green-300" />
                  </div>
                )}
                <div>
                  <p className="font-bold text-gray-800">
                    {org.organization_name}
                  </p>
                </div>
              </div>
              <InfoRow label="Email" value={org.org_email} />
              <InfoRow label="Address" value={org.org_address} />
              <InfoRow label="Contact" value={org.org_contact} />
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <SectionHeader
                icon={<Trees size={18} />}
                title="Project Application"
              />
              <InfoRow label="Title" value={application.title} />
              <InfoRow label="Description" value={application.description} />
              <InfoRow
                label="Duration"
                value={
                  application.project_duration
                    ? `${application.project_duration} days`
                    : "—"
                }
              />
              <InfoRow label="Members" value={application.total_members} />
              {initialSeedlingRequest && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                    Initial Seedling Request
                  </p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {seedlingTypeEntries.map(({ species, count, provider }) => (
                      <SeedlingBadge
                        key={species}
                        species={species}
                        count={count}
                        provider={provider}
                      />
                    ))}
                  </div>
                  <p className="text-sm font-bold text-[#0F4A2F]">
                    Total: {initialSeedlingRequest.no_request_seedling}{" "}
                    seedlings
                  </p>
                </div>
              )}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  Maintenance Plan
                </p>
                {application.maintenance_plan ? (
                  <a
                    href={`http://127.0.0.1:8000${application.maintenance_plan}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-green-300 bg-green-50 hover:bg-green-100 transition-colors group"
                  >
                    <div className="w-9 h-9 rounded-lg bg-[#0F4A2F] flex items-center justify-center flex-shrink-0">
                      <FileText size={16} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#0F4A2F] truncate">
                        {application.maintenance_plan.split("/").pop()}
                      </p>
                      <p className="text-xs text-green-600">
                        Click to download
                      </p>
                    </div>
                    <Download
                      size={16}
                      className="text-green-500 group-hover:text-[#0F4A2F] transition-colors"
                    />
                  </a>
                ) : (
                  <div className="flex items-center gap-2 text-gray-300 text-sm py-3">
                    <FileText size={18} />
                    <span>No maintenance plan uploaded</span>
                  </div>
                )}
              </div>
            </div>
            <div className="md:col-span-2 flex justify-between">
              <button
                onClick={() => setTab(0)}
                className="flex items-center gap-2 border border-gray-200 text-gray-600 px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors"
              >
                <ArrowLeft size={15} /> Back
              </button>
              <button
                onClick={() => setTab(2)}
                className="flex items-center gap-2 bg-[#0F4A2F] text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-[#1a6b44] transition-colors"
              >
                Next: Decision <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: Decision */}
        {tab === 2 && (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left — Form fields */}
              <div className="flex flex-col gap-5">
                {/* Reason */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                  <SectionHeader
                    icon={<FileText size={18} />}
                    title="Evaluation Notes"
                    subtitle="Provide reason or remarks for this decision"
                  />
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Reason / Remarks
                  </label>
                  <textarea
                    rows={4}
                    value={decisionForm.reason}
                    onChange={(e) =>
                      setDecisionForm((p) => ({ ...p, reason: e.target.value }))
                    }
                    placeholder="Enter your evaluation remarks…"
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm text-gray-700 resize-none focus:outline-none focus:border-[#0F4A2F] focus:ring-1 focus:ring-[#0F4A2F] transition-colors"
                  />
                  {latest_reason && (
                    <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-xs font-semibold text-amber-700">
                        Previous Note:
                      </p>
                      <p className="text-sm text-amber-800 mt-1">
                        {latest_reason.reason}
                      </p>
                    </div>
                  )}
                </div>

                {/* Provision Details - PER-SPECIES PROVIDER */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                  <SectionHeader
                    icon={<Trees size={18} />}
                    title="Seedling Provision Details"
                    subtitle="Specify species, quantities, and provider for each"
                  />

                  {/* Add Species Section */}
                  <div className="mb-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      Add Tree Species
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={newSpecies}
                        onChange={(e) => setNewSpecies(e.target.value)}
                        className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#0F4A2F] focus:ring-1 focus:ring-[#0F4A2F] transition-colors bg-white"
                        disabled={loadingSpecies}
                      >
                        <option value="">
                          {loadingSpecies ? "Loading…" : "— Select species —"}
                        </option>
                        {availableSpecies.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={handleAddSpecies}
                        disabled={!newSpecies || loadingSpecies}
                        className="px-4 py-2.5 rounded-xl bg-[#0F4A2F] text-white text-sm font-semibold hover:bg-[#1a6b44] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                        type="button"
                      >
                        <Plus size={16} /> Add
                      </button>
                    </div>
                  </div>

                  {/* Species List with Per-Species Provider */}
                  {provisionEntries.length > 0 ? (
                    <div className="space-y-3 max-h-64 overflow-y-auto pr-1 mb-4">
                      {provisionEntries.map((entry) => (
                        <SpeciesQuantityRow
                          key={entry.species}
                          entry={entry}
                          onQuantityChange={handleQuantityChange}
                          onProviderChange={handleProviderChange}
                          onRemove={handleRemoveSpecies}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-xl">
                      <Trees size={28} className="mx-auto mb-2 opacity-50" />
                      <p>No species added yet</p>
                      <p className="text-xs mt-1">
                        Select a species above to start provisioning
                      </p>
                    </div>
                  )}

                  {/* Summary by Provider */}
                  {provisionEntries.length > 0 && (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-xl mb-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-semibold text-green-800">
                          Provision Summary
                        </span>
                        <span className="text-lg font-bold text-[#0F4A2F]">
                          {getTotalProvisioned()} total seedlings
                        </span>
                      </div>
                      <div className="space-y-2">
                        {Object.entries(getEntriesByProvider()).map(
                          ([provider, items]) => (
                            <div
                              key={provider}
                              className="flex items-center justify-between text-sm"
                            >
                              <span className="text-green-700 flex items-center gap-1.5">
                                <Package size={14} /> {provider}:
                              </span>
                              <span className="font-medium text-gray-800">
                                {items
                                  .map((i) => `${i.species}(${i.quantity})`)
                                  .join(", ")}
                              </span>
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  )}

                  {/* Orientation Date */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      Orientation Date <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <Calendar
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                      />
                      <input
                        type="date"
                        value={decisionForm.orientation_date}
                        onChange={(e) =>
                          setDecisionForm((p) => ({
                            ...p,
                            orientation_date: e.target.value,
                          }))
                        }
                        className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#0F4A2F] focus:ring-1 focus:ring-[#0F4A2F] transition-colors"
                      />
                    </div>
                  </div>

                  {/* Agreement Image */}
                  <div className="mt-4">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      Agreement Image{" "}
                      <span className="text-gray-300">(optional)</span>
                    </label>
                    <label className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
                        <FileText size={14} className="text-gray-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-500 truncate">
                          {decisionForm.agreement_image
                            ? decisionForm.agreement_image.name
                            : "Upload agreement image…"}
                        </p>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0] ?? null;
                          setDecisionForm((p) => ({
                            ...p,
                            agreement_image: file,
                          }));
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Right — Site selection */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col">
                <SectionHeader
                  icon={<MapPin size={18} />}
                  title="Assign Planting Site"
                  subtitle="Select reforestation area then pick a site"
                />
                {selectedSite && (
                  <div className="mb-4 flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
                    <CheckCircle2
                      size={16}
                      className="text-green-600 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-green-800 truncate">
                        {selectedSite.name}
                      </p>
                      <p className="text-xs text-green-600">
                        {selectedArea?.name}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedSite(null);
                        setSelectedArea(null);
                        setSites([]);
                      }}
                      className="text-green-400 hover:text-red-400 text-xs transition-colors"
                      type="button"
                    >
                      ✕
                    </button>
                  </div>
                )}
                {!selectedArea && (
                  <>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-[#0F4A2F] text-white flex items-center justify-center text-[10px]">
                        1
                      </span>{" "}
                      Pick a Reforestation Area
                    </p>
                    <div className="relative mb-3">
                      <Search
                        size={14}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                      />
                      <input
                        type="text"
                        placeholder="Search areas…"
                        value={areaSearch}
                        onChange={(e) => setAreaSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#0F4A2F] transition-colors"
                      />
                    </div>
                    <div className="flex-1 overflow-y-auto max-h-72 flex flex-col gap-2">
                      {filteredAreas.length === 0 ? (
                        <div className="text-center py-8 text-gray-300 text-sm">
                          No approved legal areas found
                        </div>
                      ) : (
                        filteredAreas.map((area) => (
                          <button
                            key={area.reforestation_area_id}
                            onClick={() => setSelectedArea(area)}
                            className="w-full text-left px-4 py-3 rounded-xl border border-gray-100 hover:border-green-300 hover:bg-green-50 transition-all group"
                            type="button"
                          >
                            <p className="font-semibold text-sm text-gray-800 group-hover:text-[#0F4A2F]">
                              {area.name}
                            </p>
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {area.barangay && (
                                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <MapPin size={10} /> {area.barangay.name}
                                </span>
                              )}
                              {area.safety && (
                                <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <Shield size={10} /> {area.safety}
                                </span>
                              )}
                              {area.land_classification && (
                                <span className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <Layers size={10} />{" "}
                                  {area.land_classification.name}
                                </span>
                              )}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </>
                )}
                {selectedArea && !selectedSite && (
                  <>
                    <div className="flex items-center gap-2 mb-3">
                      <button
                        onClick={() => {
                          setSelectedArea(null);
                          setSites([]);
                        }}
                        className="text-xs text-gray-400 hover:text-[#0F4A2F] flex items-center gap-1 transition-colors"
                        type="button"
                      >
                        <ArrowLeft size={12} /> Back to areas
                      </button>
                      <span className="text-xs text-gray-300">|</span>
                      <span className="text-xs font-semibold text-[#0F4A2F] truncate">
                        {selectedArea.name}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-[#0F4A2F] text-white flex items-center justify-center text-[10px]">
                        2
                      </span>{" "}
                      Pick a Site
                    </p>
                    <div className="relative mb-3">
                      <Search
                        size={14}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                      />
                      <input
                        type="text"
                        placeholder="Search sites…"
                        value={siteSearch}
                        onChange={(e) => setSiteSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#0F4A2F] transition-colors"
                      />
                    </div>
                    {loadingSites ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="w-6 h-6 border-2 border-[#0F4A2F] border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : (
                      <div className="flex-1 overflow-y-auto max-h-64 flex flex-col gap-2">
                        {filteredSites.length === 0 ? (
                          <div className="text-center py-8 text-gray-300 text-sm">
                            No sites found
                          </div>
                        ) : (
                          filteredSites.map((site) => (
                            <button
                              key={site.site_id}
                              onClick={() => setSelectedSite(site)}
                              className="w-full text-left px-4 py-3 rounded-xl border border-gray-100 hover:border-green-300 hover:bg-green-50 transition-all group"
                              type="button"
                            >
                              <div className="flex items-center justify-between">
                                <p className="font-semibold text-sm text-gray-800 group-hover:text-[#0F4A2F]">
                                  {site.name}
                                </p>
                                <span
                                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${site.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                                >
                                  {site.status}
                                </span>
                              </div>
                              <div className="flex gap-3 mt-1.5 text-xs text-gray-400">
                                {site.area_hectares && (
                                  <span>{site.area_hectares} ha</span>
                                )}
                                <span>
                                  {site.validation_progress.completed}/
                                  {site.validation_progress.total} layers
                                  validated
                                </span>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-amber-600 bg-amber-50 rounded-xl px-4 py-2.5 text-sm">
                  <AlertTriangle size={16} className="flex-shrink-0" />
                  <span>
                    Forwarding will activate the tree grower's account and move
                    to Head confirmation.
                  </span>
                </div>
                <div className="flex gap-3 w-full sm:w-auto">
                  <button
                    onClick={() => setTab(1)}
                    className="flex items-center gap-2 border border-gray-200 text-gray-600 px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors"
                    type="button"
                  >
                    <ArrowLeft size={15} /> Back
                  </button>
                  <button
                    onClick={() => setConfirmAction("reject")}
                    disabled={submitting}
                    className="flex items-center gap-2 border border-red-200 text-red-500 px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-red-50 transition-colors"
                    type="button"
                  >
                    <XCircle size={16} /> Reject
                  </button>
                  <button
                    onClick={() => setConfirmAction("forward")}
                    disabled={submitting}
                    className="flex items-center gap-2 bg-[#0F4A2F] text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-[#1a6b44] transition-colors"
                    type="button"
                  >
                    <CheckCircle2 size={16} /> Forward to Head
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
