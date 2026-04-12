// src/pages/GISS/multicriteria_analysis/components/SiteList.tsx
import { useState } from "react";
import { 
  MapPin, Trash2, CheckCircle, XCircle, Pin, 
  AlertTriangle, Layers, Ruler, TrendingUp 
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
}

const LAYER_COLORS: Record<string, string> = {
  ACCEPT: "bg-green-100 text-green-700 border-green-300",
  REJECT: "bg-red-100 text-red-700 border-red-300",
  ACCEPT_WITH_MITIGATION: "bg-yellow-100 text-yellow-700 border-yellow-300",
  ACCEPT_WITH_ADJUSTMENT: "bg-blue-100 text-blue-700 border-blue-300",
  ACCEPT_WITH_CONDITIONS: "bg-purple-100 text-purple-700 border-purple-300",
  PENDING: "bg-gray-100 text-gray-600 border-gray-300",
};

const STATUS_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  pending: { icon: AlertTriangle, color: "text-amber-600", label: "Pending" },
  under_review: { icon: Layers, color: "text-blue-600", label: "Under Review" },
  accepted: { icon: CheckCircle, color: "text-green-600", label: "Accepted" },
  rejected: { icon: XCircle, color: "text-red-600", label: "Rejected" },
  completed: { icon: CheckCircle, color: "text-emerald-600", label: "Completed" },
};

export default function SiteList({
  sites,
  loading,
  onSelectSite,
  onValidateSite,
  onDeleteSite,
  onTogglePin,
  areaId,
}: SiteListProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredSites = sites.filter(site =>
    site.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!areaId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 p-4">
        <MapPin size={32} className="mb-2 opacity-30" />
        <p className="text-sm font-medium">No area selected</p>
        <p className="text-xs mt-1">Select a reforestation area to view sites</p>
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
          const statusColor = STATUS_CONFIG[site.status]?.color || "text-gray-600";
          const progress = site.validation_progress;
          
          return (
            <div
              key={site.site_id}
              className={`border-b border-gray-100 p-3 hover:bg-gray-50 transition ${site.is_pinned ? "bg-yellow-50/50" : ""}`}
            >
              {/* Header */}
              <div className="flex items-start gap-2 mb-2">
                {site.is_pinned && (
                  <Pin size={12} className="text-yellow-600 mt-0.5 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-gray-800 truncate">
                    {site.name}
                  </h4>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`flex items-center gap-1 text-[10px] font-medium ${statusColor}`}>
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
                  {site.area_hectares.toFixed(2)} ha
                </span>
                {site.ndvi !== null && (
                  <span className="flex items-center gap-1">
                    <TrendingUp size={10} />
                    NDVI: {site.ndvi.toFixed(2)}
                  </span>
                )}
              </div>

              {/* Validation Progress */}
              <div className="mb-2">
                <div className="flex items-center justify-between text-[10px] mb-1">
                  <span className="text-gray-500">Validation</span>
                  <span className="font-medium text-gray-700">
                    {progress.completed}/{progress.total} layers
                  </span>
                </div>
                <div className="flex gap-1">
                  {(["safety", "boundary_verification", "survivability"] as const).map((layer) => {
                    const status = progress.layer_status[layer] || "PENDING";
                    const colorClass = LAYER_COLORS[status] || LAYER_COLORS.PENDING;
                    const label = layer === "safety" ? "S" : layer === "boundary_verification" ? "B" : "V";
                    
                    return (
                      <span
                        key={layer}
                        className={`flex-1 text-center text-[9px] font-medium px-1 py-0.5 rounded border ${colorClass}`}
                        title={`${layer}: ${status}`}
                      >
                        {label}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onSelectSite(site)}
                  className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-medium px-2 py-1 rounded transition"
                >
                  View
                </button>
                <button
                  onClick={() => onValidateSite(site)}
                  disabled={progress.completed === 0 && site.status !== "pending"}
                  className="flex-1 bg-green-50 hover:bg-green-100 text-green-700 text-[10px] font-medium px-2 py-1 rounded transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Validate
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