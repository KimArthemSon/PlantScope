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
  Layers,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
} from "lucide-react";
import PlantScopeAlert from "../../../components/alert/PlantScopeAlert";
import { api } from "@/constant/api";

// ─── Types ──────────────────────────────────────────────────────────────────

interface ApplicationDetail {
  application: {
    application_id: number;
    title: string;
    classification: "new" | "old";
    status: string;
    total_treegrowers_will_participate: number;
    orientation_date: string | null;
    proposed_orientation_date: string | null;
    confirmed_at: string | null;
    maintenance_plan: string | null;
    created_at: string;
    updated_at: string;
  };
  group: {
    group_name: string;
    group_type: string;
    group_contact: string;
    group_address: string;
    group_profile: string | null;
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
  proposed_site: {
    site_id: number;
    name: string;
    barangay: string | null;
  } | null;
  latest_reason: { reason: string; status: string; created: string } | null;
}

interface ReforestationArea {
  reforestation_area_id: number;
  name: string;
  legality: string;
  barangay: { barangay_id: number; name: string } | null;
  land_classification: { land_classification_id: number; name: string } | null;
}

interface Site {
  site_id: number;
  name: string;
  status: string;
  area_hectares: number;
  ndvi: number | null;
  verification_status: "pending" | "draft" | "verified" | "rejected";
  validation_progress: {
    completed: number;
    total: number;
    layer_status: Record<string, string>;
  };
  created_at: string;
}

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

function VerificationBadge({ status }: { status: string }) {
  const config: Record<string, { icon: any; color: string; label: string }> = {
    verified: { icon: ShieldCheck, color: "bg-green-100 text-green-700 border-green-200", label: "Verified" },
    pending: { icon: ShieldAlert, color: "bg-yellow-100 text-yellow-700 border-yellow-200", label: "Pending" },
    draft: { icon: ShieldAlert, color: "bg-blue-100 text-blue-700 border-blue-200", label: "Draft" },
    rejected: { icon: XCircle, color: "bg-red-100 text-red-700 border-red-200", label: "Rejected" },
  };
  
  const { icon: Icon, color, label } = config[status] || config.pending;
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${color}`}>
      <Icon size={10} />
      {label}
    </span>
  );
}

// ─── Site Selection Component (Shared) ──────────────────────────────────────

function SiteSelectionPanel({
  areas,
  areaSearch,
  setAreaSearch,
  filteredAreas,
  selectedArea,
  setSelectedArea,
  sites,
  siteSearch,
  setSiteSearch,
  filteredSites,
  loadingSites,
  selectedSite,
  setSelectedSite,
}: any) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col">
      <SectionHeader
        icon={<MapPin size={18} />}
        title="Assign Planting Site"
        subtitle="Select reforestation area then pick a verified site"
      />
      {selectedSite && (
        <div className="mb-4 flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
          <CheckCircle2 size={16} className="text-green-600 flex-shrink-0" />
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
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
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
                No reforestation areas found
              </div>
            ) : (
              filteredAreas.map((area: ReforestationArea) => (
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
                    {area.land_classification && (
                      <span className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Layers size={10} /> {area.land_classification.name}
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
              onClick={() => setSelectedArea(null)}
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
            Pick a Verified Site
          </p>
          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
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
                  <ShieldAlert size={24} className="mx-auto mb-2 opacity-50" />
                  <p>No verified sites available</p>
                  <p className="text-xs mt-1 text-gray-400">
                    Sites must be accepted and have verified metadata
                  </p>
                </div>
              ) : (
                filteredSites.map((site: Site) => (
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
                      <VerificationBadge status={site.verification_status} />
                    </div>
                    <div className="flex gap-3 mt-1.5 text-xs text-gray-400">
                      {site.area_hectares && (
                        <span>{site.area_hectares.toFixed(2)} ha</span>
                      )}
                      {site.ndvi !== null && (
                        <span>NDVI: {site.ndvi.toFixed(2)}</span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── First-Time Evaluator Component ─────────────────────────────────────────

function FirstTimeEvaluator({
  detail,
  decisionForm,
  setDecisionForm,
  latestReason,
  areas,
  areaSearch,
  setAreaSearch,
  filteredAreas,
  selectedArea,
  setSelectedArea,
  sites,
  siteSearch,
  setSiteSearch,
  filteredSites,
  loadingSites,
  selectedSite,
  setSelectedSite,
}: any) {
  // ✅ Pre-fill orientation date if proposed by the grower
  useEffect(() => {
    if (detail.application.proposed_orientation_date && !decisionForm.orientation_date) {
      setDecisionForm((p: any) => ({
        ...p,
        orientation_date: detail.application.proposed_orientation_date,
      }));
    }
  }, [detail.application.proposed_orientation_date]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left — Form fields */}
      <div className="flex flex-col gap-5">
        {/* ✅ Show proposed date banner if it exists */}
        {detail.application.proposed_orientation_date && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar size={16} className="text-blue-600" />
              <p className="text-xs font-semibold text-blue-700 uppercase">Grower's Proposed Date</p>
            </div>
            <p className="text-sm font-bold text-blue-900">
              {new Date(detail.application.proposed_orientation_date).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })}
            </p>
            <p className="text-xs text-blue-600 mt-1">
              The tree grower has proposed this date. It has been pre-filled below, but you may change it if needed.
            </p>
          </div>
        )}

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
              setDecisionForm((p: any) => ({ ...p, reason: e.target.value }))
            }
            placeholder="Enter your evaluation remarks…"
            className="w-full border border-gray-200 rounded-xl p-3 text-sm text-gray-700 resize-none focus:outline-none focus:border-[#0F4A2F] focus:ring-1 focus:ring-[#0F4A2F] transition-colors"
          />
          {latestReason && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs font-semibold text-amber-700">
                Previous Note:
              </p>
              <p className="text-sm text-amber-800 mt-1">
                {latestReason.reason}
              </p>
            </div>
          )}
        </div>

        {/* Orientation Date */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <SectionHeader
            icon={<Calendar size={18} />}
            title="Schedule Orientation"
            subtitle="Set the date for the tree grower orientation"
          />
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
                setDecisionForm((p: any) => ({
                  ...p,
                  orientation_date: e.target.value,
                }))
              }
              className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#0F4A2F] focus:ring-1 focus:ring-[#0F4A2F] transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Right — Site selection */}
      <SiteSelectionPanel
        areas={areas}
        areaSearch={areaSearch}
        setAreaSearch={setAreaSearch}
        filteredAreas={filteredAreas}
        selectedArea={selectedArea}
        setSelectedArea={setSelectedArea}
        sites={sites}
        siteSearch={siteSearch}
        setSiteSearch={setSiteSearch}
        filteredSites={filteredSites}
        loadingSites={loadingSites}
        selectedSite={selectedSite}
        setSelectedSite={setSelectedSite}
      />
    </div>
  );
}

// ─── Returning Evaluator Component ──────────────────────────────────────────

function ReturningEvaluator({
  detail,
  decisionForm,
  setDecisionForm,
  latestReason,
  areas,
  areaSearch,
  setAreaSearch,
  filteredAreas,
  selectedArea,
  setSelectedArea,
  sites,
  siteSearch,
  setSiteSearch,
  filteredSites,
  loadingSites,
  selectedSite,
  setSelectedSite,
}: any) {
  const [acceptProposed, setAcceptProposed] = useState(true);

  // ✅ Auto-select proposed site and pre-fill date when accepting
  useEffect(() => {
    if (acceptProposed) {
      if (detail.proposed_site) {
        setSelectedSite({
          site_id: detail.proposed_site.site_id,
          name: detail.proposed_site.name,
          status: "active",
          area_hectares: 0,
          ndvi: null,
          verification_status: "verified",
          validation_progress: { completed: 0, total: 0, layer_status: {} },
          created_at: "",
        });
      }
      if (detail.application.proposed_orientation_date) {
        setDecisionForm((p: any) => ({
          ...p,
          orientation_date: detail.application.proposed_orientation_date,
        }));
      }
    }
  }, [acceptProposed, detail.proposed_site, detail.application.proposed_orientation_date]);

  // ✅ Only show site selection if overriding OR if no site was proposed
  const showSiteSelectionPanel = !acceptProposed || !detail.proposed_site;

  return (
    <div className="flex flex-col gap-6">
      {/* ✅ Proposed Site & Date Card (Shows if either exists) */}
      {(detail.proposed_site || detail.application.proposed_orientation_date) && (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-2xl p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-purple-600 flex items-center justify-center text-white flex-shrink-0">
                <RefreshCw size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-purple-900">
                  Returning Tree Grower Proposal
                </h3>
                <p className="text-xs text-purple-600 mt-0.5">
                  This grower has previously completed a program and is proposing details
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {detail.proposed_site && (
              <div className="bg-white rounded-xl p-4 border border-purple-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Proposed Site
                </p>
                <p className="text-sm font-bold text-gray-800">
                  {detail.proposed_site.name}
                </p>
                {detail.proposed_site.barangay && (
                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                    <MapPin size={10} /> {detail.proposed_site.barangay}
                  </p>
                )}
              </div>
            )}
            {detail.application.proposed_orientation_date && (
              <div className="bg-white rounded-xl p-4 border border-purple-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Proposed Orientation Date
                </p>
                <p className="text-sm font-bold text-gray-800">
                  {new Date(detail.application.proposed_orientation_date).toLocaleDateString("en-PH", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setAcceptProposed(true)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                acceptProposed
                  ? "bg-purple-600 text-white shadow-md"
                  : "bg-white text-purple-600 border border-purple-200 hover:bg-purple-50"
              }`}
              type="button"
            >
              ✓ Accept Proposed
            </button>
            <button
              onClick={() => setAcceptProposed(false)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                !acceptProposed
                  ? "bg-purple-600 text-white shadow-md"
                  : "bg-white text-purple-600 border border-purple-200 hover:bg-purple-50"
              }`}
              type="button"
            >
              ✎ Override / Select Site
            </button>
          </div>
        </div>
      )}

      {/* ✅ Always show Reason and Orientation Date, conditionally show Site Selection */}
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
                setDecisionForm((p: any) => ({ ...p, reason: e.target.value }))
              }
              placeholder="Enter your evaluation remarks…"
              className="w-full border border-gray-200 rounded-xl p-3 text-sm text-gray-700 resize-none focus:outline-none focus:border-[#0F4A2F] focus:ring-1 focus:ring-[#0F4A2F] transition-colors"
            />
            {latestReason && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs font-semibold text-amber-700">
                  Previous Note:
                </p>
                <p className="text-sm text-amber-800 mt-1">
                  {latestReason.reason}
                </p>
              </div>
            )}
          </div>

          {/* Orientation Date */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <SectionHeader
              icon={<Calendar size={18} />}
              title="Schedule Orientation"
              subtitle="Set the date for the tree grower orientation"
            />
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
                  setDecisionForm((p: any) => ({
                    ...p,
                    orientation_date: e.target.value,
                  }))
                }
                className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#0F4A2F] focus:ring-1 focus:ring-[#0F4A2F] transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Right — Site selection (only if needed) */}
        {showSiteSelectionPanel && (
          <SiteSelectionPanel
            areas={areas}
            areaSearch={areaSearch}
            setAreaSearch={setAreaSearch}
            filteredAreas={filteredAreas}
            selectedArea={selectedArea}
            setSelectedArea={setSelectedArea}
            sites={sites}
            siteSearch={siteSearch}
            setSiteSearch={setSiteSearch}
            filteredSites={filteredSites}
            loadingSites={loadingSites}
            selectedSite={selectedSite}
            setSelectedSite={setSelectedSite}
          />
        )}
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
  const [selectedArea, setSelectedArea] = useState<ReforestationArea | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [siteSearch, setSiteSearch] = useState("");
  const [loadingSites, setLoadingSites] = useState(false);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);

  // Decision form
  const [decisionForm, setDecisionForm] = useState({
    reason: "",
    orientation_date: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"forward" | "reject" | null>(null);
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
          `${api}api/get_application/${application_id}/`,
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
            verification_status: "verified",
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

  // ─── Fetch reforestation areas ───────────────────────────────────────────
  useEffect(() => {
    if (tab !== 2) return;
    const fetchAreas = async () => {
      try {
        const params = new URLSearchParams({ entries: "100", page: "1" });
        const res = await fetch(
          `${api}api/get_all_reforestation_areas/?${params}`,
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
          `${api}api/list_sites/${selectedArea.reforestation_area_id}/?status=accepted&verification_status=verified`,
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
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("status", status);
      fd.append("reason", decisionForm.reason);
      fd.append("orientation_date", decisionForm.orientation_date);
      fd.append("site_id", String(selectedSite?.site_id ?? ""));

      const res = await fetch(
        `${api}api/evaluate_application/${application_id}/`,
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

  const filteredAreas = areas.filter((a) =>
    a.name.toLowerCase().includes(areaSearch.toLowerCase()),
  );
  const filteredSites = sites.filter((s) =>
    s.name.toLowerCase().includes(siteSearch.toLowerCase()),
  );

  const TABS = [
    { label: "Account & Personal", icon: <User size={14} /> },
    { label: "Group & Project", icon: <Building2 size={14} /> },
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
    group,
    profile,
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
                    ? "First-Time Applicant"
                    : "Returning Applicant"
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
                        src={`${api}${profile.profile_img}`}
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
                Next: Group & Project <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* TAB 1: Group + Project */}
        {tab === 1 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <SectionHeader
                icon={<Building2 size={18} />}
                title="Group Information"
              />
              <div className="flex items-center gap-4 mb-4 pb-4 border-b border-gray-100">
                {group.group_profile ? (
                  <img
                    src={`${api}${group.group_profile}`}
                    alt="Group"
                    className="w-16 h-16 rounded-xl object-cover border-2 border-green-100"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-green-50 flex items-center justify-center">
                    <Building2 size={28} className="text-green-300" />
                  </div>
                )}
                <div>
                  <p className="font-bold text-gray-800">
                    {group.group_name}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {group.group_type}
                  </p>
                </div>
              </div>
              <InfoRow label="Address" value={group.group_address} />
              <InfoRow label="Contact" value={group.group_contact} />
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <SectionHeader
                icon={<Trees size={18} />}
                title="Project Application"
              />
              <InfoRow label="Title" value={application.title} />
              <InfoRow label="Tree Growers" value={application.total_treegrowers_will_participate} />
              
              {/* ✅ NEW: Show proposed details if they exist */}
              {application.proposed_orientation_date && (
                <InfoRow 
                  label="Proposed Orientation Date" 
                  value={new Date(application.proposed_orientation_date).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })} 
                />
              )}
              {detail.proposed_site && (
                <InfoRow 
                  label="Proposed Site" 
                  value={`${detail.proposed_site.name} ${detail.proposed_site.barangay ? `(${detail.proposed_site.barangay})` : ''}`} 
                />
              )}

              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  Maintenance Plan
                </p>
                {application.maintenance_plan ? (
                  <a
                    href={`${api}${application.maintenance_plan}`}
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
            {application.classification === "new" ? (
              <FirstTimeEvaluator
                detail={detail}
                decisionForm={decisionForm}
                setDecisionForm={setDecisionForm}
                latestReason={latest_reason}
                areas={areas}
                areaSearch={areaSearch}
                setAreaSearch={setAreaSearch}
                filteredAreas={filteredAreas}
                selectedArea={selectedArea}
                setSelectedArea={setSelectedArea}
                sites={sites}
                siteSearch={siteSearch}
                setSiteSearch={setSiteSearch}
                filteredSites={filteredSites}
                loadingSites={loadingSites}
                selectedSite={selectedSite}
                setSelectedSite={setSelectedSite}
              />
            ) : (
              <ReturningEvaluator
                detail={detail}
                decisionForm={decisionForm}
                setDecisionForm={setDecisionForm}
                latestReason={latest_reason}
                areas={areas}
                areaSearch={areaSearch}
                setAreaSearch={setAreaSearch}
                filteredAreas={filteredAreas}
                selectedArea={selectedArea}
                setSelectedArea={setSelectedArea}
                sites={sites}
                siteSearch={siteSearch}
                setSiteSearch={setSiteSearch}
                filteredSites={filteredSites}
                loadingSites={loadingSites}
                selectedSite={selectedSite}
                setSelectedSite={setSelectedSite}
              />
            )}

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