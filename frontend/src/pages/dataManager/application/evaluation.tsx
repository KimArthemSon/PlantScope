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
  Phone,
  Calendar,
  Trees,
  Search,
  CheckSquare,
  AlertTriangle,
  Shield,
  Layers,
} from "lucide-react";
import PlantScopeAlert from "../../../components/alert/PlantScopeAlert";

// ─── Types ──────────────────────────────────────────────────────────────────

interface ApplicationDetail {
  account: { account_id: number; email: string };
  organization_information: {
    organization_id: number;
    organization_name: string;
    org_email: string;
    org_address: string;
    org_contact: string;
    org_profile: string;
    created_at: string;
  };
  application: {
    application_id: number;
    title: string;
    description: string;
    total_request_seedling: number;
    maintenance_plan: string;
    agreement_image: string | null;
    total_seedling_provided: number;
    total_area_planted: number;
    total_seedling_survived: number;
    total_seedling_planted: number;
    updated_at: string;
    created_at: string;
  };
  profile: any;
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

// ─── Sub-components (defined outside to avoid remount) ──────────────────────

function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="w-10 h-10 rounded-xl bg-[#0F4A2F] flex items-center justify-center text-green-300 flex-shrink-0">
        {icon}
      </div>
      <div>
        <h2 className="text-lg font-bold text-[#0F4A2F] leading-tight">{title}</h2>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 py-3 border-b border-gray-100 last:border-0">
      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-sm text-gray-800 font-medium">{value || "—"}</span>
    </div>
  );
}

function StepBadge({ step, active, done }: { step: number; label: string; active: boolean; done: boolean }) {
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all
      ${done ? "bg-[#0F4A2F] border-[#0F4A2F] text-white" : active ? "border-[#0F4A2F] text-[#0F4A2F] bg-white" : "border-gray-200 text-gray-300 bg-white"}`}>
      {done ? <CheckCircle2 size={16} /> : step}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function Evaluation_application() {
  const { application_id } = useParams<{ application_id: string }>();
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const [detail, setDetail] = useState<ApplicationDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(true);

  // Panel tab: 0=Account+Personal, 1=Org+Maintenance, 2=Decision
  const [tab, setTab] = useState(0);

  // Reforestation areas
  const [areas, setAreas] = useState<ReforestationArea[]>([]);
  const [areaSearch, setAreaSearch] = useState("");
  const [selectedArea, setSelectedArea] = useState<ReforestationArea | null>(null);

  // Sites
  const [sites, setSites] = useState<Site[]>([]);
  const [siteSearch, setSiteSearch] = useState("");
  const [loadingSites, setLoadingSites] = useState(false);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);

  // Decision form
  const [decisionForm, setDecisionForm] = useState({
    reason: "",
    total_seedling_provided: "",
    orientation_date: "",
    agreement_image: null as File | null,
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
        const res = await fetch(`http://127.0.0.1:8000/api/get_application/${application_id}/`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        setDetail(data);
      } catch {
        setPSAlert({ type: "error", title: "Error", message: "Failed to load application details." });
      } finally {
        setLoadingDetail(false);
      }
    };
    fetchDetail();
  }, [application_id]);

  // ─── Fetch reforestation areas ───────────────────────────────────────────
  useEffect(() => {
    if (tab !== 2) return;
    const fetchAreas = async () => {
      try {
        const params = new URLSearchParams({ entries: "100", page: "1" });
        const res = await fetch(`http://127.0.0.1:8000/api/get_all_reforestation_areas/?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        setAreas(data.data ?? []);
      } catch {
        setPSAlert({ type: "error", title: "Error", message: "Failed to load reforestation areas." });
      }
    };
    fetchAreas();
  }, [tab]);

  // ─── Fetch sites when area selected ─────────────────────────────────────
  useEffect(() => {
    if (!selectedArea) return;
    const fetchSites = async () => {
      setLoadingSites(true);
      setSites([]);
      setSelectedSite(null);
      try {
        const res = await fetch(
          `http://127.0.0.1:8000/api/list_sites/${selectedArea.reforestation_area_id}/`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) throw new Error();
        const data = await res.json();
        setSites(data.data ?? []);
      } catch {
        setPSAlert({ type: "error", title: "Error", message: "Failed to load sites." });
      } finally {
        setLoadingSites(false);
      }
    };
    fetchSites();
  }, [selectedArea]);

  // ─── Submit evaluation ───────────────────────────────────────────────────
  const handleSubmit = async (status: "for_head" | "rejected") => {
    if (status === "for_head") {
      if (!decisionForm.total_seedling_provided) {
        setPSAlert({ type: "failed", title: "Missing", message: "Total seedling provided is required." });
        return;
      }
      if (!selectedSite) {
        setPSAlert({ type: "failed", title: "Missing", message: "Please select a site." });
        return;
      }
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("status", status);
      console.log(status)
      fd.append("reason", decisionForm.reason);
      fd.append("total_seedling_provided", decisionForm.total_seedling_provided);
      fd.append("orientation_date", decisionForm.orientation_date);
      fd.append("site_id", selectedSite ? String(selectedSite.site_id) : "0");
      if (decisionForm.agreement_image) {
        fd.append("agreement_image", decisionForm.agreement_image);
      }

      const res = await fetch(
        `http://127.0.0.1:8000/api/evaluate_application/${application_id}/`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd }
      );
      const data = await res.json();

      if (!res.ok) {
        setPSAlert({ type: "failed", title: "Failed", message: data.error ?? "Something went wrong." });
        return;
      }

      // Navigate back after brief delay so the alert shows
      setPSAlert({
        type: "success",
        title: status === "for_head" ? "Forwarded!" : "Rejected",
        message: data.message ?? (status === "for_head" ? "Application forwarded to Head." : "Application has been rejected."),
      });
      setTimeout(() => navigate(-1), 1800);
    } catch {
      setPSAlert({ type: "error", title: "Error", message: "Network error. Please try again." });
    } finally {
      setSubmitting(false);
      setConfirmAction(null);
    }
  };

  // ─── Filtered areas ───────────────────────────────────────────────────────
  const filteredAreas = areas.filter(
    (a) =>
      a.pre_assessment_status === "approved" &&
      a.legality === "legal" &&
      a.name.toLowerCase().includes(areaSearch.toLowerCase())
  );

  const filteredSites = sites.filter((s) =>
    s.name.toLowerCase().includes(siteSearch.toLowerCase())
  );

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

  const { account, organization_information: org, application, profile } = detail;

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'DM Sans', sans-serif" }}>
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
            <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4
              ${confirmAction === "forward" ? "bg-green-100" : "bg-red-100"}`}>
              {confirmAction === "forward"
                ? <CheckCircle2 size={28} className="text-green-600" />
                : <XCircle size={28} className="text-red-500" />}
            </div>
            <h3 className="text-lg font-bold text-center text-gray-800 mb-1">
              {confirmAction === "forward" ? "Forward to Head?" : "Reject Application?"}
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
                onClick={() => handleSubmit(confirmAction === "forward" ? "for_head" : "rejected")}
                disabled={submitting}
                className={`flex-1 py-2.5 rounded-xl text-white text-sm font-bold transition-all
                  ${confirmAction === "forward" ? "bg-[#0F4A2F] hover:bg-[#1a6b44]" : "bg-red-500 hover:bg-red-600"}
                  ${submitting ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {submitting ? "Processing…" : confirmAction === "forward" ? "Yes, Forward" : "Yes, Reject"}
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
              <h1 className="text-xl font-bold leading-tight">Application Evaluation</h1>
              <p className="text-xs text-green-200 mt-0.5">{application.title}</p>
            </div>
          </div>
          {/* Step breadcrumb */}
          <div className="ml-auto hidden md:flex items-center gap-2">
            {TABS.map((t, i) => (
              <div key={i} className="flex items-center gap-2">
                <button
                  onClick={() => setTab(i)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                    ${tab === i ? "bg-white text-[#0F4A2F]" : "bg-white/10 text-white/70 hover:bg-white/20"}`}
                >
                  {t.icon}
                  {t.label}
                </button>
                {i < TABS.length - 1 && <ChevronRight size={14} className="text-white/40" />}
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
            className={`flex-1 py-3 text-xs font-semibold flex flex-col items-center gap-1 transition-colors
              ${tab === i ? "text-[#0F4A2F] border-b-2 border-[#0F4A2F]" : "text-gray-400"}`}
          >
            {t.icon}
            {t.label.split(" ")[0]}
          </button>
        ))}
      </div>

      <main className="max-w-6xl mx-auto p-4 md:p-8">

        {/* ── TAB 0: Account + Personal ──────────────────────────────────── */}
        {tab === 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Account Card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <SectionHeader icon={<Mail size={18} />} title="Account Information" subtitle="Login credentials registered" />
              <InfoRow label="Account ID" value={String(account.account_id)} />
              <InfoRow label="Email Address" value={account.email} />
              <InfoRow label="Application Submitted" value={new Date(application.created_at).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })} />
            </div>

            {/* Personal Card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <SectionHeader icon={<User size={18} />} title="Personal Information" subtitle="Profile details of the applicant" />
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
                        {profile.first_name} {profile.middle_name} {profile.last_name}
                      </p>
                      <p className="text-xs text-gray-400 capitalize">{profile.gender}</p>
                    </div>
                  </div>
                  <InfoRow label="Birthday" value={profile.birthday} />
                  <InfoRow label="Contact" value={profile.contact} />
                  <InfoRow label="Address" value={profile.address} />
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-gray-300">
                  <User size={36} />
                  <p className="text-sm mt-2">No profile data available</p>
                </div>
              )}
            </div>

            {/* Continue button */}
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

        {/* ── TAB 1: Organization + Maintenance Plan ─────────────────────── */}
        {tab === 1 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Org Card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <SectionHeader icon={<Building2 size={18} />} title="Organization Information" />
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
                  <p className="font-bold text-gray-800">{org.organization_name}</p>
                  <p className="text-xs text-gray-400">Organization #{org.organization_id}</p>
                </div>
              </div>
              <InfoRow label="Email" value={org.org_email} />
              <InfoRow label="Address" value={org.org_address} />
              <InfoRow label="Contact" value={org.org_contact} />
              <InfoRow label="Registered" value={new Date(org.created_at).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })} />
            </div>

            {/* Application + Maintenance Card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <SectionHeader icon={<Trees size={18} />} title="Project Application" />
              <InfoRow label="Title" value={application.title} />
              <InfoRow label="Description" value={application.description} />
              <InfoRow label="Seedlings Requested" value={String(application.total_request_seedling)} />

              {/* Maintenance Plan download */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Maintenance Plan</p>
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
                      <p className="text-xs text-green-600">Click to download</p>
                    </div>
                    <Download size={16} className="text-green-500 group-hover:text-[#0F4A2F] transition-colors" />
                  </a>
                ) : (
                  <div className="flex items-center gap-2 text-gray-300 text-sm py-3">
                    <FileText size={18} />
                    <span>No maintenance plan uploaded</span>
                  </div>
                )}
              </div>

              {/* Agreement image if exists */}
              {application.agreement_image && (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Agreement Image</p>
                  <img
                    src={`http://127.0.0.1:8000${application.agreement_image}`}
                    alt="Agreement"
                    className="w-full rounded-xl border border-gray-200 object-cover max-h-48"
                  />
                </div>
              )}
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

        {/* ── TAB 2: Decision ────────────────────────────────────────────── */}
        {tab === 2 && (
          <div className="flex flex-col gap-6">

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Left — Form fields */}
              <div className="flex flex-col gap-5">

                {/* Reason */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                  <SectionHeader icon={<FileText size={18} />} title="Evaluation Notes" subtitle="Provide reason or remarks for this decision" />
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Reason / Remarks</label>
                  <textarea
                    rows={4}
                    value={decisionForm.reason}
                    onChange={(e) => setDecisionForm((p) => ({ ...p, reason: e.target.value }))}
                    placeholder="Enter your evaluation remarks…"
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm text-gray-700 resize-none focus:outline-none focus:border-[#0F4A2F] focus:ring-1 focus:ring-[#0F4A2F] transition-colors"
                  />
                </div>

                {/* Seedling + Orientation */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                  <SectionHeader icon={<Trees size={18} />} title="Provision Details" subtitle="Required when forwarding to Head" />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                        Seedlings to Provide <span className="text-red-400">*</span>
                      </label>
                      <div className="relative">
                        <Trees size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="number"
                          min={0}
                          value={decisionForm.total_seedling_provided}
                          onChange={(e) => setDecisionForm((p) => ({ ...p, total_seedling_provided: e.target.value }))}
                          placeholder={`Requested: ${application.total_request_seedling}`}
                          className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#0F4A2F] focus:ring-1 focus:ring-[#0F4A2F] transition-colors"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                        Orientation Date
                      </label>
                      <div className="relative">
                        <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="date"
                          value={decisionForm.orientation_date}
                          onChange={(e) => setDecisionForm((p) => ({ ...p, orientation_date: e.target.value }))}
                          className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#0F4A2F] focus:ring-1 focus:ring-[#0F4A2F] transition-colors"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Agreement image upload (optional) */}
                  {/* <div className="mt-4">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      Agreement Image <span className="text-gray-300">(optional)</span>
                    </label>
                    <label className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
                        <FileText size={14} className="text-gray-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-500 truncate">
                          {decisionForm.agreement_image ? decisionForm.agreement_image.name : "Upload agreement image…"}
                        </p>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0] ?? null;
                          setDecisionForm((p) => ({ ...p, agreement_image: file }));
                        }}
                      />
                    </label>
                  </div> */}
                </div>
              </div>

              {/* Right — Site selection */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col">
                <SectionHeader icon={<MapPin size={18} />} title="Assign Planting Site" subtitle="Select reforestation area then pick a site" />

                {/* Selected site pill */}
                {selectedSite && (
                  <div className="mb-4 flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
                    <CheckCircle2 size={16} className="text-green-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-green-800 truncate">{selectedSite.name}</p>
                      <p className="text-xs text-green-600">{selectedArea?.name}</p>
                    </div>
                    <button
                      onClick={() => { setSelectedSite(null); setSelectedArea(null); setSites([]); }}
                      className="text-green-400 hover:text-red-400 text-xs transition-colors"
                    >✕</button>
                  </div>
                )}

                {/* Step 1: Pick area */}
                {!selectedArea && (
                  <>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-[#0F4A2F] text-white flex items-center justify-center text-[10px]">1</span>
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
                        <div className="text-center py-8 text-gray-300 text-sm">No approved legal areas found</div>
                      ) : (
                        filteredAreas.map((area) => (
                          <button
                            key={area.reforestation_area_id}
                            onClick={() => setSelectedArea(area)}
                            className="w-full text-left px-4 py-3 rounded-xl border border-gray-100 hover:border-green-300 hover:bg-green-50 transition-all group"
                          >
                            <p className="font-semibold text-sm text-gray-800 group-hover:text-[#0F4A2F]">{area.name}</p>
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

                {/* Step 2: Pick site */}
                {selectedArea && !selectedSite && (
                  <>
                    <div className="flex items-center gap-2 mb-3">
                      <button
                        onClick={() => { setSelectedArea(null); setSites([]); }}
                        className="text-xs text-gray-400 hover:text-[#0F4A2F] flex items-center gap-1 transition-colors"
                      >
                        <ArrowLeft size={12} /> Back to areas
                      </button>
                      <span className="text-xs text-gray-300">|</span>
                      <span className="text-xs font-semibold text-[#0F4A2F] truncate">{selectedArea.name}</span>
                    </div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-[#0F4A2F] text-white flex items-center justify-center text-[10px]">2</span>
                      Pick a Site
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
                          <div className="text-center py-8 text-gray-300 text-sm">No sites found</div>
                        ) : (
                          filteredSites.map((site) => (
                            <button
                              key={site.site_id}
                              onClick={() => setSelectedSite(site)}
                              className="w-full text-left px-4 py-3 rounded-xl border border-gray-100 hover:border-green-300 hover:bg-green-50 transition-all group"
                            >
                              <div className="flex items-center justify-between">
                                <p className="font-semibold text-sm text-gray-800 group-hover:text-[#0F4A2F]">{site.name}</p>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                                  ${site.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                                  {site.status}
                                </span>
                              </div>
                              <div className="flex gap-3 mt-1.5 text-xs text-gray-400">
                                {site.area_hectares && <span>{site.area_hectares} ha</span>}
                                <span>
                                  {site.validation_progress.completed}/{site.validation_progress.total} layers validated
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
                  <span>Forwarding will activate the tree grower's account.</span>
                </div>
                <div className="flex gap-3 w-full sm:w-auto">
                  <button
                    onClick={() => setTab(1)}
                    className="flex items-center gap-2 border border-gray-200 text-gray-600 px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors"
                  >
                    <ArrowLeft size={15} /> Back
                  </button>
                  <button
                    onClick={() => setConfirmAction("reject")}
                    disabled={submitting}
                    className="flex items-center gap-2 border border-red-200 text-red-500 px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-red-50 transition-colors"
                  >
                    <XCircle size={16} /> Reject
                  </button>
                  <button
                    onClick={() => setConfirmAction("forward")}
                    disabled={submitting}
                    className="flex items-center gap-2 bg-[#0F4A2F] text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-[#1a6b44] transition-colors"
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