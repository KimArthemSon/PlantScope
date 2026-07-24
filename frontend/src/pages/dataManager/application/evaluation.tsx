import { useEffect, useState, useRef } from "react";
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
  ShieldX,
  RefreshCw,
  Filter,
  X,
  Eye,
  Pin,
  PinOff,
  Globe,
} from "lucide-react";
import PlantScopeAlert from "../../../components/alert/PlantScopeAlert";
import { api } from "@/constant/api";
import { useUserRole } from "@/hooks/authorization";

// ─── Types ──────────────────────────────────────────────────────────────────

interface ApplicationDetail {
  application: {
    application_id: number;
    email: string;
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
  profile: any | null;
  assigned_site: {
    site_id: number;
    name: string;
    barangay: string | null;
    polygon_coordinates: string | null;
    total_area_hectares: number;
    land_classification_name: string | null;
    accessibility: string | null;
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
  barangay: { barangay_id: number; name: string } | null;
}

interface LandClassificationOption {
  land_classification_id: number;
  name: string;
}

interface Site {
  site_id: number;
  reforestation_area_id: number;
  name: string;
  status: string;
  is_pinned: boolean;
  created_at: string;
  validation: {
    has_safety_note: boolean;
    has_survivability_note: boolean;
    final_decision: "ACCEPT" | "REJECT" | null;
    is_ready_to_finalize: boolean;
  };
  verification: {
    status: "pending" | "draft" | "verified" | "rejected";
    land_classification: { id: number; name: string } | null;
    security_concerns_count: number;
    has_accessibility: boolean;
    accessibility_type: string | null;
    verified_animals_count: number;
  };
  permit_count: number;
  metrics: {
    ndvi: number | null;
    area_hectares: number;
    seedlings: number;
  };
}

interface SiteFilter {
  search: string;
  entries: number;
  page: number;
  total_page: number;
  status: string;
  pinned_only: boolean;
  verification_status: string;
  land_classification_id: string;
}

const DEFAULT_SITE_FILTER: Omit<SiteFilter, "total_page"> = {
  search: "",
  entries: 50,
  page: 1,
  status: "accepted",
  pinned_only: false,
  verification_status: "verified",
  land_classification_id: "",
};

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
    <div className="flex items-center gap-3 mb-4">
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

// ─── Site Selection Component ───────────────────────────────────────────────

function SiteSelectionPanel({
  areaSearch,
  setAreaSearch,
  filteredAreas,
  selectedArea,
  isAllAreas,
  handleSelectArea,
  handleSelectAllAreas,
  siteSearch,
  setSiteSearch,
  filteredSites,
  loadingSites,
  selectedSite,
  setSelectedSite,
  siteFilter,
  setSiteFilter,
  landClassifications,
  userPath,
}: any) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        filterRef.current &&
        !filterRef.current.contains(event.target as Node)
      )
        setIsFilterOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const hasActiveFilters =
    siteFilter.land_classification_id !== "" || siteFilter.pinned_only;

  const clearSiteFilters = () => {
    setSiteFilter((prev: any) => ({
      ...DEFAULT_SITE_FILTER,
      total_page: prev.total_page,
    }));
  };

  const getVerificationBadge = (status: string) => {
    switch (status) {
      case "verified":
        return {
          icon: ShieldCheck,
          color: "bg-emerald-100 text-emerald-700 border border-emerald-300",
          label: "Verified",
        };
      case "rejected":
        return {
          icon: ShieldX,
          color: "bg-red-100 text-red-700 border border-red-300",
          label: "Rejected",
        };
      case "draft":
        return {
          icon: FileText,
          color: "bg-blue-100 text-blue-700 border border-blue-300",
          label: "Draft",
        };
      default:
        return {
          icon: ShieldAlert,
          color: "bg-slate-100 text-slate-700 border border-slate-300",
          label: "Pending",
        };
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col h-full">
      <SectionHeader
        icon={<MapPin size={18} />}
        title="Assign Planting Site"
        subtitle="Select reforestation area then pick a site"
      />

      {selectedSite && (
        <div className="mb-4 flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
          <CheckCircle2 size={16} className="text-green-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-green-800 truncate">
              {selectedSite.name}
            </p>
            <p className="text-xs text-green-600">
              {isAllAreas ? "All Areas" : selectedArea?.name}
            </p>
          </div>
          <button
            onClick={() => setSelectedSite(null)}
            className="text-green-400 hover:text-red-400 text-xs transition-colors"
            type="button"
          >
            ✕
          </button>
        </div>
      )}

      {!selectedArea && !isAllAreas && (
        <>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-full bg-[#0F4A2F] text-white flex items-center justify-center text-[10px]">
              1
            </span>
            Pick a Reforestation Area
          </p>
          <button
            onClick={handleSelectAllAreas}
            className="w-full text-left px-4 py-3 rounded-xl border border-[#0F4A2F] bg-[#0F4A2F]/5 hover:bg-[#0F4A2F]/10 transition-all group mb-3 flex items-center gap-3"
            type="button"
          >
            <div className="w-8 h-8 rounded-lg bg-[#0F4A2F] text-white flex items-center justify-center flex-shrink-0">
              <Globe size={16} />
            </div>
            <div>
              <p className="font-bold text-sm text-[#0F4A2F]">
                All Reforestation Areas
              </p>
              <p className="text-xs text-[#0F4A2F]/70">
                View sites across all areas
              </p>
            </div>
          </button>
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
                No reforestation areas found
              </div>
            ) : (
              filteredAreas.map((area: ReforestationArea) => (
                <button
                  key={area.reforestation_area_id}
                  onClick={() => handleSelectArea(area)}
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
                  </div>
                </button>
              ))
            )}
          </div>
        </>
      )}

      {(selectedArea || isAllAreas) && !selectedSite && (
        <>
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => handleSelectArea(null)}
              className="text-xs text-gray-400 hover:text-[#0F4A2F] flex items-center gap-1 transition-colors"
              type="button"
            >
              <ArrowLeft size={12} /> Back to areas
            </button>
            <span className="text-xs text-gray-300">|</span>
            <span className="text-xs font-semibold text-[#0F4A2F] truncate">
              {isAllAreas ? "All Reforestation Areas" : selectedArea.name}
            </span>
          </div>

          <div className="flex items-center gap-2 mb-3">
            <div className="relative flex-1">
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
            <div className="relative" ref={filterRef}>
              <button
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-all ${isFilterOpen ? "bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm" : hasActiveFilters ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"}`}
              >
                <Filter size={14} /> Filters{" "}
                {hasActiveFilters && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                )}
              </button>
              {isFilterOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-200 p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-800">
                        Filters
                      </h3>
                      <button
                        onClick={() => setIsFilterOpen(false)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-700 mb-1.5 block">
                        Land Classification
                      </label>
                      <select
                        value={siteFilter.land_classification_id}
                        onChange={(e) =>
                          setSiteFilter((prev: any) => ({
                            ...prev,
                            land_classification_id: e.target.value,
                            page: 1,
                          }))
                        }
                        className="w-full border border-purple-200 bg-purple-50 rounded-lg px-2.5 py-2 text-sm text-purple-800 outline-none focus:ring-2 focus:ring-purple-400"
                      >
                        <option value="">All Classifications</option>
                        {landClassifications.map(
                          (lc: LandClassificationOption) => (
                            <option
                              key={lc.land_classification_id}
                              value={lc.land_classification_id}
                            >
                              {lc.name}
                            </option>
                          ),
                        )}
                      </select>
                    </div>
                    <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                      <input
                        type="checkbox"
                        id="pinned-only"
                        checked={siteFilter.pinned_only}
                        onChange={(e) =>
                          setSiteFilter((prev: any) => ({
                            ...prev,
                            pinned_only: e.target.checked,
                            page: 1,
                          }))
                        }
                        className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-400"
                      />
                      <label
                        htmlFor="pinned-only"
                        className="text-sm text-gray-700 cursor-pointer select-none flex items-center gap-1.5"
                      >
                        <Pin
                          size={14}
                          className={
                            siteFilter.pinned_only
                              ? "text-emerald-600"
                              : "text-gray-400"
                          }
                        />{" "}
                        Pinned only
                      </label>
                    </div>
                    <div className="flex gap-2 pt-3">
                      <button
                        onClick={clearSiteFilters}
                        className="flex-1 px-3 py-2 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        Clear
                      </button>
                      <button
                        onClick={() => setIsFilterOpen(false)}
                        className="flex-1 px-3 py-2 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {loadingSites ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-[#0F4A2F] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto max-h-80 flex flex-col gap-2">
              {filteredSites.length === 0 ? (
                <div className="text-center py-8 text-gray-300 text-sm">
                  <ShieldAlert size={24} className="mx-auto mb-2 opacity-50" />
                  <p>No available sites found</p>
                  <p className="text-xs mt-1">Try adjusting your filters</p>
                </div>
              ) : (
                filteredSites.map((site: Site) => {
                  const verificationBadge = getVerificationBadge(
                    site.verification.status,
                  );
                  const VerificationIcon = verificationBadge.icon;
                  const isSelected = selectedSite?.site_id === site.site_id;
                  return (
                    <div
                      key={site.site_id}
                      className={`w-full text-left px-4 py-3 rounded-xl border transition-all group ${isSelected ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500" : "border-gray-100 hover:border-emerald-300 hover:bg-emerald-50/50"}`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span
                            className={`p-0.5 rounded ${site.is_pinned ? "text-emerald-600" : "text-gray-400"}`}
                          >
                            {site.is_pinned ? (
                              <Pin size={12} className="fill-current" />
                            ) : (
                              <PinOff size={12} />
                            )}
                          </span>
                          <p
                            className={`font-semibold text-sm truncate ${isSelected ? "text-emerald-800" : "text-gray-800 group-hover:text-[#0F4A2F]"}`}
                          >
                            {site.name}
                          </p>
                        </div>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border flex-shrink-0 ${verificationBadge.color}`}
                        >
                          <VerificationIcon size={10} />{" "}
                          {verificationBadge.label}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                          {site.metrics.area_hectares > 0 && (
                            <span>
                              {site.metrics.area_hectares.toFixed(2)} ha
                            </span>
                          )}
                          {site.metrics.ndvi !== null && (
                            <span>NDVI: {site.metrics.ndvi.toFixed(2)}</span>
                          )}
                          {site.verification.land_classification && (
                            <span className="flex items-center gap-1 text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">
                              <Layers size={10} />{" "}
                              {site.verification.land_classification.name}
                            </span>
                          )}
                        </div>
                        <div className="flex gap-1.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(
                                `${userPath}/reforestation/site/${site.reforestation_area_id}/information/${site.site_id}`,
                                "_blank",
                              );
                            }}
                            className="p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 rounded-full transition-colors"
                            title="View Site Details"
                          >
                            <Eye size={18} />
                          </button>
                          <button
                            onClick={() => setSelectedSite(site)}
                            className={`p-2 rounded-full transition-colors border ${isSelected ? "bg-emerald-600 text-white border-emerald-600" : "text-emerald-600 hover:bg-emerald-100 border-emerald-200 hover:border-emerald-300"}`}
                            title={isSelected ? "Selected" : "Select Site"}
                          >
                            <CheckCircle2
                              size={18}
                              className={isSelected ? "fill-white" : ""}
                            />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── First-Time Evaluator Component ────────────────────────────────────────

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
  isAllAreas,
  handleSelectArea,
  handleSelectAllAreas,
  siteSearch,
  setSiteSearch,
  filteredSites,
  loadingSites,
  selectedSite,
  setSelectedSite,
  navigate,
  applicationId,
  applicationTitle,
  siteFilter,
  setSiteFilter,
  landClassifications,
  userPath,
}: any) {
  useEffect(() => {
    if (!decisionForm.orientation_date) {
      const dateToUse =
        detail.application.orientation_date ||
        detail.application.proposed_orientation_date;
      if (dateToUse)
        setDecisionForm((p: any) => ({ ...p, orientation_date: dateToUse }));
    }
  }, [
    detail.application.orientation_date,
    detail.application.proposed_orientation_date,
  ]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="flex flex-col gap-5">
        {detail.application.proposed_orientation_date && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar size={16} className="text-blue-600" />
              <p className="text-xs font-semibold text-blue-700 uppercase">
                Grower's Proposed Date
              </p>
            </div>
            <p className="text-sm font-bold text-blue-900">
              {new Date(
                detail.application.proposed_orientation_date,
              ).toLocaleDateString("en-PH", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
            <p className="text-xs text-blue-600 mt-1">
              The tree grower has proposed this date. It has been pre-filled
              below, but you may change it if needed.
            </p>
          </div>
        )}
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
          <button
            type="button"
            onClick={() =>
              navigate(
                `/DataManager/calendar?from=evaluation&appId=${applicationId}&appTitle=${encodeURIComponent(applicationTitle)}`,
              )
            }
            className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-[#0F4A2F] text-[#0F4A2F] text-sm font-semibold hover:bg-green-50 transition-colors"
          >
            <Calendar size={16} /> Open Calendar to Select Date
          </button>
        </div>
      </div>
      <SiteSelectionPanel
        areaSearch={areaSearch}
        setAreaSearch={setAreaSearch}
        filteredAreas={filteredAreas}
        selectedArea={selectedArea}
        isAllAreas={isAllAreas}
        handleSelectArea={handleSelectArea}
        handleSelectAllAreas={handleSelectAllAreas}
        siteSearch={siteSearch}
        setSiteSearch={setSiteSearch}
        filteredSites={filteredSites}
        loadingSites={loadingSites}
        selectedSite={selectedSite}
        setSelectedSite={setSelectedSite}
        siteFilter={siteFilter}
        setSiteFilter={setSiteFilter}
        landClassifications={landClassifications}
        userPath={userPath}
      />
    </div>
  );
}

// ─── Returning Evaluator Component ─────────────────────────────────────────

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
  isAllAreas,
  handleSelectArea,
  handleSelectAllAreas,
  siteSearch,
  setSiteSearch,
  filteredSites,
  loadingSites,
  selectedSite,
  setSelectedSite,
  navigate,
  applicationId,
  applicationTitle,
  siteFilter,
  setSiteFilter,
  landClassifications,
  userPath,
}: any) {
  const [acceptProposed, setAcceptProposed] = useState(true);

  useEffect(() => {
    if (acceptProposed) {
      if (detail.proposed_site) {
        setSelectedSite({
          site_id: detail.proposed_site.site_id,
          reforestation_area_id: 0,
          name: detail.proposed_site.name,
          status: "accepted",
          is_pinned: false,
          created_at: "",
          validation: {
            has_safety_note: false,
            has_survivability_note: false,
            final_decision: null,
            is_ready_to_finalize: false,
          },
          verification: {
            status: "verified",
            land_classification: null,
            security_concerns_count: 0,
            has_accessibility: false,
            accessibility_type: null,
            verified_animals_count: 0,
          },
          permit_count: 0,
          metrics: { ndvi: null, area_hectares: 0, seedlings: 0 },
        });
      }
      const dateToUse =
        detail.application.orientation_date ||
        detail.application.proposed_orientation_date;
      if (dateToUse)
        setDecisionForm((p: any) => ({ ...p, orientation_date: dateToUse }));
    }
  }, [
    acceptProposed,
    detail.proposed_site,
    detail.application.orientation_date,
    detail.application.proposed_orientation_date,
  ]);

  const showSiteSelectionPanel = !acceptProposed || !detail.proposed_site;

  return (
    <div className="flex flex-col gap-6">
      {(detail.proposed_site ||
        detail.application.proposed_orientation_date) && (
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
                  This grower has previously completed a program and is
                  proposing details
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
                  {new Date(
                    detail.application.proposed_orientation_date,
                  ).toLocaleDateString("en-PH", {
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
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${acceptProposed ? "bg-purple-600 text-white shadow-md" : "bg-white text-purple-600 border border-purple-200 hover:bg-purple-50"}`}
              type="button"
            >
              ✓ Accept Proposed
            </button>
            <button
              onClick={() => setAcceptProposed(false)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${!acceptProposed ? "bg-purple-600 text-white shadow-md" : "bg-white text-purple-600 border border-purple-200 hover:bg-purple-50"}`}
              type="button"
            >
              {" "}
              Override / Select Site
            </button>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="flex flex-col gap-5">
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
            <button
              type="button"
              onClick={() =>
                navigate(
                  `/DataManager/calendar?from=evaluation&appId=${applicationId}&appTitle=${encodeURIComponent(applicationTitle)}`,
                )
              }
              className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-[#0F4A2F] text-[#0F4A2F] text-sm font-semibold hover:bg-green-50 transition-colors"
            >
              <Calendar size={16} /> Open Calendar to Select Date
            </button>
          </div>
        </div>
        {showSiteSelectionPanel && (
          <SiteSelectionPanel
            areaSearch={areaSearch}
            setAreaSearch={setAreaSearch}
            filteredAreas={filteredAreas}
            selectedArea={selectedArea}
            isAllAreas={isAllAreas}
            handleSelectArea={handleSelectArea}
            handleSelectAllAreas={handleSelectAllAreas}
            siteSearch={siteSearch}
            setSiteSearch={setSiteSearch}
            filteredSites={filteredSites}
            loadingSites={loadingSites}
            selectedSite={selectedSite}
            setSelectedSite={setSelectedSite}
            siteFilter={siteFilter}
            setSiteFilter={setSiteFilter}
            landClassifications={landClassifications}
            userPath={userPath}
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
  const { userRole } = useUserRole();

  const [detail, setDetail] = useState<ApplicationDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [tab, setTab] = useState(0);
  const [userPath, setUserPath] = useState("");

  const [areas, setAreas] = useState<ReforestationArea[]>([]);
  const [areaSearch, setAreaSearch] = useState("");
  const [selectedArea, setSelectedArea] = useState<ReforestationArea | null>(
    null,
  );
  const [isAllAreas, setIsAllAreas] = useState(false);

  const [sites, setSites] = useState<Site[]>([]);
  const [siteSearch, setSiteSearch] = useState("");
  const [loadingSites, setLoadingSites] = useState(false);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);

  const [landClassifications, setLandClassifications] = useState<
    LandClassificationOption[]
  >([]);
  const [siteFilter, setSiteFilter] = useState<SiteFilter>({
    ...DEFAULT_SITE_FILTER,
    total_page: 1,
  });

  const [decisionForm, setDecisionForm] = useState({
    reason: "",
    orientation_date: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [confirmAction, setConfirmAction] = useState<
    "forward" | "reject" | null
  >(null);
  const [PSalert, setPSAlert] = useState<{
    type: "success" | "failed" | "error";
    title: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (userRole === "treeGrowers" || userRole === "CityENROHead")
      setUserPath("");
    else if (userRole === "GISSpecialist") setUserPath("/GISS");
    else if (userRole === "DataManager") setUserPath("/DataManager");
  }, [userRole]);

  useEffect(() => {
    const fetchLandClassifications = async () => {
      try {
        const res = await fetch(`${api}api/get_land_classifications_list/`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setLandClassifications(data.data || []);
        }
      } catch (err) {
        console.error("Failed to fetch land classifications:", err);
      }
    };
    fetchLandClassifications();
  }, [token]);

  useEffect(() => {
    const fetchDetail = async () => {
      setLoadingDetail(true);
      try {
        const res = await fetch(
          `${api}api/get_application/${application_id}/`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok) throw new Error("Failed to fetch application");
        const data = await res.json();
        setDetail(data);
        if (data.assigned_site) {
          setSelectedSite({
            site_id: data.assigned_site.site_id,
            reforestation_area_id: 0,
            name: data.assigned_site.name,
            status: "accepted",
            is_pinned: false,
            created_at: "",
            validation: {
              has_safety_note: false,
              has_survivability_note: false,
              final_decision: null,
              is_ready_to_finalize: false,
            },
            verification: {
              status: "verified",
              land_classification: data.assigned_site.land_classification_name
                ? { id: 0, name: data.assigned_site.land_classification_name }
                : null,
              security_concerns_count: 0,
              has_accessibility: !!data.assigned_site.accessibility,
              accessibility_type: data.assigned_site.accessibility || null,
              verified_animals_count: 0,
            },
            permit_count: 0,
            metrics: {
              ndvi: null,
              area_hectares: data.assigned_site.total_area_hectares || 0,
              seedlings: 0,
            },
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

  useEffect(() => {
    if (tab !== 1) return;
    const fetchAreas = async () => {
      try {
        const params = new URLSearchParams({ entries: "100", page: "1" });
        const res = await fetch(
          `${api}api/get_all_reforestation_areas/?${params}`,
          { headers: { Authorization: `Bearer ${token}` } },
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

  // ✅ UPDATED: Fetches from the NEW get_available_sites endpoint
  useEffect(() => {
    if (!selectedArea && !isAllAreas) return;
    const fetchSites = async () => {
      setLoadingSites(true);
      try {
        const params = new URLSearchParams({
          search: siteFilter.search,
          page: siteFilter.page.toString(),
          entries: siteFilter.entries.toString(),
          status: siteFilter.status,
          pinned_only: siteFilter.pinned_only ? "true" : "false",
          verification_status: siteFilter.verification_status,
          all: isAllAreas ? "true" : "false",
        });
        if (siteFilter.land_classification_id)
          params.append(
            "land_classification_id",
            siteFilter.land_classification_id,
          );

        const areaId = isAllAreas ? 0 : selectedArea?.reforestation_area_id;

        // ✅ CHANGED: Points to the new dedicated endpoint
        const res = await fetch(
          `${api}api/get_available_sites/${areaId}/?${params}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (!res.ok) throw new Error();
        const data = await res.json();
        setSites(data.data ?? []);
        setSiteFilter((prev) => ({ ...prev, total_page: data.total_page }));
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
  }, [
    selectedArea,
    isAllAreas,
    siteFilter.page,
    siteFilter.entries,
    siteFilter.status,
    siteFilter.pinned_only,
    siteFilter.verification_status,
    siteFilter.land_classification_id,
    token,
  ]);

  const handleSelectArea = (area: ReforestationArea | null) => {
    setSelectedArea(area);
    setIsAllAreas(false);
    setSiteFilter({ ...DEFAULT_SITE_FILTER, total_page: 1 });
    setSelectedSite(null);
  };
  const handleSelectAllAreas = () => {
    setIsAllAreas(true);
    setSelectedArea(null);
    setSiteFilter({ ...DEFAULT_SITE_FILTER, total_page: 1 });
    setSelectedSite(null);
  };

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

  const handleDownloadMaintenancePlan = async () => {
    if (!detail?.application?.maintenance_plan) {
      setPSAlert({
        type: "failed",
        title: "Error",
        message: "No maintenance plan available",
      });
      return;
    }
    try {
      const response = await fetch(
        `${api}api/application/${detail.application.application_id}/download-maintenance-plan/`,
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
      link.download = `maintenance_plan_${detail.application.application_id}.pdf`;
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

  const filteredAreas = areas.filter((a) =>
    a.name.toLowerCase().includes(areaSearch.toLowerCase()),
  );
  const filteredSites = sites.filter((s) =>
    s.name.toLowerCase().includes(siteSearch.toLowerCase()),
  );

  const TABS = [
    { label: "Application Details", icon: <FileText size={14} /> },
    { label: "Decision", icon: <CheckSquare size={14} /> },
  ];

  if (loadingDetail)
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#0F4A2F] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-500">Loading application…</span>
        </div>
      </div>
    );
  if (!detail) return null;
  const { application, group, latest_reason } = detail;

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
        {tab === 0 && (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <SectionHeader
                  icon={<Mail size={18} />}
                  title="Account Information"
                  subtitle="Login credentials and application status"
                />
                <InfoRow label="Email" value={application.email || "—"} />
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
                  icon={<Building2 size={18} />}
                  title="Group Information"
                  subtitle="Details of the tree grower group"
                />
                <div className="flex items-center gap-4 mb-4 pb-4 border-b border-gray-100">
                  {group.group_profile ? (
                    <img
                      src={group.group_profile}
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
                    <p className="text-xs text-gray-500 mt-0.5 capitalize">
                      {group.group_type.replace("_", " ")}
                    </p>
                  </div>
                </div>
                <InfoRow label="Address" value={group.group_address} />
                <InfoRow label="Contact" value={group.group_contact} />
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <SectionHeader
                icon={<Trees size={18} />}
                title="Project Application"
                subtitle="Details of the proposed reforestation project"
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                <InfoRow label="Project Title" value={application.title} />
                <InfoRow
                  label="Total Tree Growers"
                  value={application.total_treegrowers_will_participate}
                />
                {application.proposed_orientation_date && (
                  <InfoRow
                    label="Proposed Orientation Date"
                    value={new Date(
                      application.proposed_orientation_date,
                    ).toLocaleDateString("en-PH", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  />
                )}
                {detail.proposed_site && (
                  <InfoRow
                    label="Proposed Site"
                    value={`${detail.proposed_site.name} ${detail.proposed_site.barangay ? `(${detail.proposed_site.barangay})` : ""}`}
                  />
                )}
              </div>
              <div className="mt-6 pt-6 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  Maintenance Plan
                </p>
                {application.maintenance_plan ? (
                  <button
                    onClick={handleDownloadMaintenancePlan}
                    className="w-full md:w-auto flex items-center gap-3 p-3 rounded-xl border border-dashed border-green-300 bg-green-50 hover:bg-green-100 transition-colors group cursor-pointer"
                    type="button"
                  >
                    <div className="w-9 h-9 rounded-lg bg-[#0F4A2F] flex items-center justify-center flex-shrink-0">
                      <FileText size={16} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-semibold text-[#0F4A2F] truncate">
                        {application.maintenance_plan.split("/").pop() ||
                          "Maintenance Plan"}
                      </p>
                      <p className="text-xs text-green-600">
                        Click to download
                      </p>
                    </div>
                    <Download
                      size={16}
                      className="text-green-500 group-hover:text-[#0F4A2F] transition-colors"
                    />
                  </button>
                ) : (
                  <div className="flex items-center gap-2 text-gray-300 text-sm py-3">
                    <FileText size={18} />
                    <span>No maintenance plan uploaded</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setTab(1)}
                className="flex items-center gap-2 bg-[#0F4A2F] text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-[#1a6b44] transition-colors"
              >
                Proceed to Decision <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
        {tab === 1 && (
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
                isAllAreas={isAllAreas}
                handleSelectArea={handleSelectArea}
                handleSelectAllAreas={handleSelectAllAreas}
                sites={sites}
                siteSearch={siteSearch}
                setSiteSearch={setSiteSearch}
                filteredSites={filteredSites}
                loadingSites={loadingSites}
                selectedSite={selectedSite}
                setSelectedSite={setSelectedSite}
                navigate={navigate}
                applicationId={application_id}
                applicationTitle={application.title}
                siteFilter={siteFilter}
                setSiteFilter={setSiteFilter}
                landClassifications={landClassifications}
                userPath={userPath}
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
                isAllAreas={isAllAreas}
                handleSelectArea={handleSelectArea}
                handleSelectAllAreas={handleSelectAllAreas}
                sites={sites}
                siteSearch={siteSearch}
                setSiteSearch={setSiteSearch}
                filteredSites={filteredSites}
                loadingSites={loadingSites}
                selectedSite={selectedSite}
                setSelectedSite={setSelectedSite}
                navigate={navigate}
                applicationId={application_id}
                applicationTitle={application.title}
                siteFilter={siteFilter}
                setSiteFilter={setSiteFilter}
                landClassifications={landClassifications}
                userPath={userPath}
              />
            )}
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
                    onClick={() => setTab(0)}
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
