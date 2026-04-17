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
  Shield,
  AlertTriangle,
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
    agreement_image: string | null; // ← Still in type for other tabs, just not displayed in Tab 2
    total_seedling_provided: number;
    total_area_planted: number;
    total_seedling_survived: number;
    total_seedling_planted: number;
    updated_at: string;
    created_at: string;
    // Data Manager evaluation fields (from Reason table)
    dm_status?: string;
    dm_reason?: string;
    orientation_date?: string;
  };
  profile: any;
  assigned_site?: {
    name: string;
    reforestation_area: string;
    land_classification: string;
    barangay: string;
    polygon_coordinates?: any;
  };
}

// ─── Sub-components ─────────────────────────────────────────────────────────

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

function InfoRow({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-3 border-b border-gray-100 last:border-0">
      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</span>
      {children || <span className="text-sm text-gray-800 font-medium">{value || "—"}</span>}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function Evaluation_confirmation() {
  const { application_id } = useParams<{ application_id: string }>();
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const [detail, setDetail] = useState<ApplicationDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(true);

  const [tab, setTab] = useState(0);
  const [decisionForm, setDecisionForm] = useState({ reason: "" });
  const [submitting, setSubmitting] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"confirm" | "reject" | null>(null);

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
        if (!res.ok) throw new Error("Failed to fetch application");
        const data = await res.json();
        setDetail(data);

        // Redirect if not in 'for_head' status (already confirmed or still pending DM)
        const appStatus = data.application?.dm_status || data.application?.status;
        if (appStatus !== 'for_head') {
          setPSAlert({
            type: "error",
            title: "Not Available",
            message: appStatus === 'approved' 
              ? "This application has already been confirmed." 
              : "This application is not yet ready for head confirmation.",
          });
          setTimeout(() => navigate(-1), 2500);
        }
      } catch {
        setPSAlert({ type: "error", title: "Error", message: "Failed to load application details." });
      } finally {
        setLoadingDetail(false);
      }
    };
    fetchDetail();
  }, [application_id, navigate, token]);

  // ─── Submit confirmation decision ────────────────────────────────────────
  const handleSubmit = async (status: "approved" | "rejected") => {
    setSubmitting(true);
    try {
      const res = await fetch(
        `http://127.0.0.1:8000/api/confirmation_application/${application_id}/`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status,
            reason: decisionForm.reason,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setPSAlert({ type: "failed", title: "Failed", message: data.error ?? "Something went wrong." });
        return;
      }

      setPSAlert({
        type: "success",
        title: status === "approved" ? "Confirmed!" : "Rejected",
        message: data.message ?? (status === "approved"
          ? "Application approved and account activated."
          : "Application has been rejected."),
      });
      setTimeout(() => navigate(-1), 1800);
    } catch {
      setPSAlert({ type: "error", title: "Error", message: "Network error. Please try again." });
    } finally {
      setSubmitting(false);
      setConfirmAction(null);
    }
  };

  const TABS = [
    { label: "Account & Personal", icon: <User size={14} /> },
    { label: "Organization & Plan", icon: <Building2 size={14} /> },
    { label: "DM Evaluation", icon: <FileText size={14} /> },
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

  const { account, organization_information: org, application, profile, assigned_site } = detail;

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
            <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${
              confirmAction === "confirm" ? "bg-green-100" : "bg-red-100"
            }`}>
              {confirmAction === "confirm" ? (
                <CheckCircle2 size={28} className="text-green-600" />
              ) : (
                <XCircle size={28} className="text-red-500" />
              )}
            </div>
            <h3 className="text-lg font-bold text-center text-gray-800 mb-1">
              {confirmAction === "confirm" ? "Confirm Application?" : "Reject Application?"}
            </h3>
            <p className="text-sm text-center text-gray-500 mb-6">
              {confirmAction === "confirm"
                ? "This will finalize approval and activate the tree grower's account."
                : "This will reject the application. The applicant will be notified."}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmAction(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSubmit(confirmAction === "confirm" ? "approved" : "rejected")}
                disabled={submitting}
                className={`flex-1 py-2.5 rounded-xl text-white text-sm font-bold transition-all ${
                  confirmAction === "confirm"
                    ? "bg-[#0F4A2F] hover:bg-[#1a6b44]"
                    : "bg-red-500 hover:bg-red-600"
                } ${submitting ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {submitting ? "Processing…" : confirmAction === "confirm" ? "Yes, Confirm" : "Yes, Reject"}
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
              <h1 className="text-xl font-bold leading-tight">Head Confirmation</h1>
              <p className="text-xs text-green-200 mt-0.5">{application.title}</p>
            </div>
          </div>
          <div className="ml-auto hidden md:flex items-center gap-2">
            {TABS.map((t, i) => (
              <div key={i} className="flex items-center gap-2">
                <button
                  onClick={() => setTab(i)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    tab === i ? "bg-white text-[#0F4A2F]" : "bg-white/10 text-white/70 hover:bg-white/20"
                  }`}
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
            className={`flex-1 py-3 text-xs font-semibold flex flex-col items-center gap-1 transition-colors ${
              tab === i ? "text-[#0F4A2F] border-b-2 border-[#0F4A2F]" : "text-gray-400"
            }`}
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
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <SectionHeader icon={<Mail size={18} />} title="Account Information" subtitle="Login credentials registered" />
              <InfoRow label="Account ID" value={String(account.account_id)} />
              <InfoRow label="Email Address" value={account.email} />
              <InfoRow label="Application Submitted" value={new Date(application.created_at).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })} />
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <SectionHeader icon={<User size={18} />} title="Personal Information" subtitle="Profile details of the applicant" />
              {profile ? (
                <>
                  <div className="flex items-center gap-4 mb-4 pb-4 border-b border-gray-100">
                    {profile.profile_img ? (
                      <img src={`http://127.0.0.1:8000${profile.profile_img}`} alt="Profile" className="w-16 h-16 rounded-xl object-cover border-2 border-green-100" />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-green-50 flex items-center justify-center">
                        <User size={28} className="text-green-300" />
                      </div>
                    )}
                    <div>
                      <p className="font-bold text-gray-800">{profile.first_name} {profile.middle_name} {profile.last_name}</p>
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

            <div className="md:col-span-2 flex justify-end">
              <button onClick={() => setTab(1)} className="flex items-center gap-2 bg-[#0F4A2F] text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-[#1a6b44] transition-colors">
                Next: Organization & Plan <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ── TAB 1: Organization + Maintenance Plan ─────────────────────── */}
        {tab === 1 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <SectionHeader icon={<Building2 size={18} />} title="Organization Information" />
              <div className="flex items-center gap-4 mb-4 pb-4 border-b border-gray-100">
                {org.org_profile ? (
                  <img src={`http://127.0.0.1:8000${org.org_profile}`} alt="Org" className="w-16 h-16 rounded-xl object-cover border-2 border-green-100" />
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

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <SectionHeader icon={<Trees size={18} />} title="Project Application" />
              <InfoRow label="Title" value={application.title} />
              <InfoRow label="Description" value={application.description} />
              <InfoRow label="Seedlings Requested" value={String(application.total_request_seedling)} />

              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Maintenance Plan</p>
                {application.maintenance_plan ? (
                  <a href={`http://127.0.0.1:8000${application.maintenance_plan}`} target="_blank" rel="noopener noreferrer" download className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-green-300 bg-green-50 hover:bg-green-100 transition-colors group">
                    <div className="w-9 h-9 rounded-lg bg-[#0F4A2F] flex items-center justify-center flex-shrink-0">
                      <FileText size={16} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#0F4A2F] truncate">{application.maintenance_plan.split("/").pop()}</p>
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
            </div>

            <div className="md:col-span-2 flex justify-between">
              <button onClick={() => setTab(0)} className="flex items-center gap-2 border border-gray-200 text-gray-600 px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors">
                <ArrowLeft size={15} /> Back
              </button>
              <button onClick={() => setTab(2)} className="flex items-center gap-2 bg-[#0F4A2F] text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-[#1a6b44] transition-colors">
                Next: Review & Confirm <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ── TAB 2: DM Evaluation + Head Decision ───────────────────────── */}
        {tab === 2 && (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left — Data Manager's Evaluation (Read-Only) */}
              <div className="flex flex-col gap-5">
                {/* DM Decision Summary */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                  <SectionHeader icon={<Shield size={18} />} title="Data Manager's Evaluation" subtitle="Application approved and forwarded for your confirmation" />

                  <InfoRow
                    label="Current Status"
                    children={
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                        Pending Head Confirmation
                      </span>
                    }
                  />
                  <InfoRow label="Seedlings Approved by DM" value={String(application.total_seedling_provided || "—")} />
                  <InfoRow
                    label="Orientation Date"
                    value={application.orientation_date ? new Date(application.orientation_date).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }) : "—"}
                  />

                  {application.dm_reason && (
                    <div className="mt-4">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Remarks from Data Manager</p>
                      <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-sm text-gray-700 whitespace-pre-wrap">
                        {application.dm_reason}
                      </div>
                    </div>
                  )}
                </div>

                {/* Assigned Site (Read-Only) */}
                {assigned_site && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <SectionHeader icon={<MapPin size={18} />} title="Assigned Planting Site" subtitle="Selected by Data Manager" />
                    <InfoRow label="Site Name" value={assigned_site.name} />
                    <InfoRow label="Reforestation Area" value={assigned_site.reforestation_area} />
                    <InfoRow label="Barangay" value={assigned_site.barangay} />
                    <InfoRow label="Land Classification" value={assigned_site.land_classification} />
                  </div>
                )}
              </div>

              {/* Right — Head's Decision Form */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col">
                <SectionHeader icon={<FileText size={18} />} title="Your Decision" subtitle="Confirm or reject this application" />

                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Confirmation Notes <span className="text-gray-300">(optional)</span>
                </label>
                <textarea
                  rows={6}
                  value={decisionForm.reason}
                  onChange={(e) => setDecisionForm((p) => ({ ...p, reason: e.target.value }))}
                  placeholder="Add notes for your decision (e.g., 'Approved with conditions...', 'Rejected due to...')"
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm text-gray-700 resize-none focus:outline-none focus:border-[#0F4A2F] focus:ring-1 focus:ring-[#0F4A2F] transition-colors"
                />

                <div className="mt-4 flex items-start gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs">
                  <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                  <span><strong>Note:</strong> Confirming will activate the applicant's account and allow them to proceed with tree planting activities.</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-gray-500 text-sm">
                  <Shield size={14} />
                  <span>Head Confirmation • Application #{application.application_id}</span>
                </div>
                <div className="flex gap-3 w-full sm:w-auto">
                  <button onClick={() => setTab(1)} className="flex items-center gap-2 border border-gray-200 text-gray-600 px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors">
                    <ArrowLeft size={15} /> Back
                  </button>
                  <button onClick={() => setConfirmAction("reject")} disabled={submitting} className="flex items-center gap-2 border border-red-200 text-red-500 px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-red-50 transition-colors">
                    <XCircle size={16} /> Reject
                  </button>
                  <button onClick={() => setConfirmAction("confirm")} disabled={submitting} className="flex items-center gap-2 bg-[#0F4A2F] text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-[#1a6b44] transition-colors">
                    <CheckCircle2 size={16} /> Confirm Application
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