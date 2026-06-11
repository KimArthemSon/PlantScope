import { useState } from "react";
import {
  MapPin,
  Trash2,
  CheckCircle,
  XCircle,
  Pin,
  AlertTriangle,
  Layers,
  Ruler,
  FileText,
  Eye,
  Target,
} from "lucide-react";
import type { Site } from "../types/siteTypes";

interface SiteListProps {
  sites: Site[];
  loading: boolean;
  onSelectSite: (site: Site) => void;
  onValidateSite: (site: Site) => void;
  onDeleteSite: (siteId: number, name: string) => void;
  onTogglePin: (siteId: number) => void;
  areaId: string | null;
  selectedSiteId?: string | null; // ✅ NEW
  onSiteSelectForFilter?: (site: Site | null) => void; // ✅ NEW
}

const STATUS_CONFIG: Record<
  string,
  { icon: any; color: string; label: string }
> = {
  pending: { icon: AlertTriangle, color: "text-amber-600", label: "Pending" },
  under_review: { icon: Layers, color: "text-blue-600", label: "Under Review" },
  accepted: { icon: CheckCircle, color: "text-green-600", label: "Accepted" },
  rejected: { icon: XCircle, color: "text-red-600", label: "Rejected" },
  completed: {
    icon: CheckCircle,
    color: "text-emerald-600",
    label: "Completed",
  },
};

const getValidationBadge = (validation: any) => {
  if (validation.final_decision === "ACCEPT") {
    return {
      icon: CheckCircle,
      color: "bg-green-100 text-green-700",
      label: "Accepted",
    };
  }
  if (validation.final_decision === "REJECT") {
    return {
      icon: XCircle,
      color: "bg-red-100 text-red-700",
      label: "Rejected",
    };
  }
  if (validation.is_ready_to_finalize) {
    return {
      icon: FileText,
      color: "bg-blue-100 text-blue-700",
      label: "Ready to Finalize",
    };
  }
  if (validation.has_safety_note && validation.has_survivability_note) {
    return {
      icon: FileText,
      color: "bg-purple-100 text-purple-700",
      label: "Notes Added",
    };
  }
  if (validation.has_safety_note || validation.has_survivability_note) {
    return {
      icon: AlertTriangle,
      color: "bg-yellow-100 text-yellow-700",
      label: "In Progress",
    };
  }
  return {
    icon: AlertTriangle,
    color: "bg-gray-100 text-gray-700",
    label: "Not Started",
  };
};

export default function SiteList({
  sites,
  loading,
  onSelectSite,
  onValidateSite,
  onDeleteSite,
  onTogglePin,
  areaId,
  selectedSiteId,
  onSiteSelectForFilter,
}: SiteListProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredSites = sites.filter((site) =>
    site.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  if (!areaId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 p-4">
        <MapPin size={32} className="mb-2 opacity-30" />
        <p className="text-sm font-medium">No area selected</p>
        <p className="text-xs mt-1">
          Select a reforestation area to view sites
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-gray-400">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-2"></div>
          <p className="text-xs">Loading sites...</p>
        </div>
      </div>
    );
  }

  if (filteredSites.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 p-4">
        <Layers size={32} className="mb-2 opacity-30" />
        <p className="text-sm font-medium">No sites yet</p>
        <p className="text-xs mt-1 text-center">
          Draw a polygon and click "Save Site" to create your first site
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-2 border-b border-gray-100">
        <input
          type="text"
          placeholder="Search sites..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      {/* Site List */}
      <div className="flex-1 overflow-y-auto">
        {filteredSites.map((site) => {
          const StatusIcon = STATUS_CONFIG[site.status]?.icon || AlertTriangle;
          const statusColor =
            STATUS_CONFIG[site.status]?.color || "text-gray-600";
          const validationBadge = getValidationBadge(site.validation);
          const ValidationIcon = validationBadge.icon;
          const isSelected = selectedSiteId === String(site.site_id);

          return (
            <div
              key={site.site_id}
              className={`border-b border-gray-100 p-3 hover:bg-gray-50 transition ${
                site.is_pinned ? "bg-yellow-50/50" : ""
              } ${isSelected ? "bg-green-50 border-l-4 border-l-green-500" : ""}`}
            >
              {/* Header */}
              <div className="flex items-start gap-2 mb-2">
                {site.is_pinned && (
                  <Pin
                    size={12}
                    className="text-yellow-600 mt-0.5 flex-shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-gray-800 truncate">
                    {site.name}
                  </h4>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className={`flex items-center gap-1 text-[10px] font-medium ${statusColor}`}
                    >
                      <StatusIcon size={10} />
                      {STATUS_CONFIG[site.status]?.label || site.status}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {new Date(site.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Metrics */}
              <div className="flex items-center gap-3 mb-2 text-[10px] text-gray-600">
                <span className="flex items-center gap-1">
                  <Ruler size={10} />
                  {site.metrics.area_hectares.toFixed(2)} ha
                </span>
                {site.metrics.ndvi !== null && (
                  <span className="flex items-center gap-1">
                    <span>NDVI: {site.metrics.ndvi.toFixed(2)}</span>
                  </span>
                )}
              </div>

              {/* Validation Status */}
              <div className="mb-2">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium ${validationBadge.color}`}
                >
                  <ValidationIcon size={10} />
                  {validationBadge.label}
                </span>

                <div className="flex gap-1 mt-1">
                  {site.validation.has_safety_note && (
                    <span
                      className="text-[9px] text-blue-600"
                      title="Safety note added"
                    >
                      Safety ✓
                    </span>
                  )}
                  {site.validation.has_survivability_note && (
                    <span
                      className="text-[9px] text-purple-600"
                      title="Survivability note added"
                    >
                      Survivability ✓
                    </span>
                  )}
                </div>
              </div>

              {/* ✅ UPDATED: Actions with Filter button */}
             
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onSelectSite(site)}
                  className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-medium px-2 py-1 rounded transition flex items-center justify-center gap-1"
                >
                  <Eye size={10} />
                  View
                </button>
                <button
                  onClick={() => onValidateSite(site)}
                  disabled={
                    !site.validation.has_safety_note &&
                    !site.validation.has_survivability_note &&
                    site.status !== "pending"
                  }
                  className="flex-1 bg-green-50 hover:bg-green-100 text-green-700 text-[10px] font-medium px-2 py-1 rounded transition flex items-center justify-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <CheckCircle size={10} />
                  Validate
                </button>
                <button
                  onClick={() => onSiteSelectForFilter?.(site)}
                  className={`flex-1 text-[10px] font-medium px-2 py-1 rounded transition flex items-center justify-center gap-1 ${
                    isSelected
                      ? "bg-emerald-600 text-white hover:bg-emerald-700"
                      : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700"
                  }`}
                  title="Filter assessments for this site"
                >
                  <Target size={10} />
                  {isSelected ? "Selected" : "Filter"}
                </button>
                <button
                  onClick={() => onTogglePin(site.site_id)}
                  className={`p-1 rounded transition ${site.is_pinned ? "text-yellow-600 bg-yellow-100" : "text-gray-400 hover:bg-gray-100"}`}
                  title={site.is_pinned ? "Unpin" : "Pin"}
                >
                  <Pin size={12} />
                </button>
                <button
                  onClick={() => onDeleteSite(site.site_id, site.name)}
                  className="p-1 text-red-500 hover:bg-red-50 rounded transition"
                  title="Delete"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
