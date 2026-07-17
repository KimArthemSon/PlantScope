import React, { useState, useEffect } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Loader2,
  Image as ImageIcon,
  CheckCircle,
  XCircle,
  Clock,
  MapPin,
  Calendar,
  FileText,
  Leaf,
  Users,
  Eye,
  EyeOff,
  TrendingUp,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Target,
} from "lucide-react";
import { api } from "@/constant/api";
import { useUserRole } from "@/hooks/authorization"; // ✅ Added import for role checking

interface SiteImage {
  site_image_id: number;
  layer_tag: "safety" | "survivability" | "general";
  img_url: string | null;
  caption: string | null;
  created_at: string | null;
}

interface SiteData {
  site_id: number;
  name: string;
  description: string | null;
  status: string;
  center_coordinate: [number, number] | null;
  polygon_coordinates: any;
  total_area_hectares: number;
  ndvi_value: number | null;
  created_at: string;
  site_images: SiteImage[];
}

interface SiteApplication {
  application_id: number;
  title: string;
  status: string;
  classification: string;
  organization_name: string;
  total_members: number | null;
  orientation_date: string | null;
  created_at: string;
}

interface SiteInfoPanelProps {
  siteId: number | null;
  token: string | null;
  isOpen: boolean;
  onClose: () => void;
  onViewDetails?: (siteId: number) => void;
  onShowSiteInMap?: (siteId: number, polygon: any) => void;
  onShowPotentialSites?: (siteId: number) => void;
  onHideAll?: () => void;
  isShowingSite?: boolean;
  isShowingPotentialSites?: boolean;
  onReanalyze?: (siteId: number) => void;
  onViewTrend?: (siteId: number, polygon: any) => void;
}

const STATUS_CONFIG: Record<
  string,
  { color: string; bg: string; icon: React.ReactNode; label: string }
> = {
  pending: { color: "text-amber-600", bg: "bg-amber-100", icon: <Clock size={12} />, label: "Pending" },
  under_review: { color: "text-purple-600", bg: "bg-purple-100", icon: <Clock size={12} />, label: "Under Review" },
  accepted: { color: "text-emerald-600", bg: "bg-emerald-100", icon: <CheckCircle size={12} />, label: "Accepted" },
  rejected: { color: "text-rose-600", bg: "bg-rose-100", icon: <XCircle size={12} />, label: "Rejected" },
  completed: { color: "text-blue-600", bg: "bg-blue-100", icon: <CheckCircle size={12} />, label: "Completed" },
  under_monitoring: { color: "text-teal-600", bg: "bg-teal-100", icon: <Clock size={12} />, label: "Monitoring" },
};

export default function SiteInfoPanel({
  siteId,
  token,
  isOpen,
  onClose,
  onViewDetails,
  onShowSiteInMap,
  onShowPotentialSites,
  onHideAll,
  isShowingSite = false,
  isShowingPotentialSites = false,
  onReanalyze,
  onViewTrend,
}: SiteInfoPanelProps) {
  const { userRole } = useUserRole(); // ✅ Get user role

  const [siteData, setSiteData] = useState<SiteData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [applications, setApplications] = useState<SiteApplication[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);

  const [expandedSections, setExpandedSections] = useState({
    photos: true,
    info: true,
    location: true,
    programs: false,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  useEffect(() => {
    if (isOpen) {
      setIsAnimating(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (siteId && isOpen) {
      fetchSiteData(siteId);
      fetchSiteApplications(siteId);
    }
  }, [siteId, isOpen]);

  const handleClose = () => {
    setIsAnimating(true);
    setTimeout(() => {
      onClose();
      setIsAnimating(false);
    }, 300);
  };

  const fetchSiteData = async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${api}api/get_site/${id}/`, {
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setSiteData(data);
      setCurrentImageIndex(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load site data");
    } finally {
      setLoading(false);
    }
  };

  const fetchSiteApplications = async (id: number) => {
    try {
      const response = await fetch(`${api}api/get_site_applications/${id}/`, {
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setApplications(data.applications || []);
      }
    } catch (err) {
      console.error("Failed to fetch site applications", err);
    }
  };

  const generalImages = siteData?.site_images?.filter((img) => img.layer_tag === "general") || [];

  const nextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (generalImages.length > 0) {
      setCurrentImageIndex((prev) => (prev + 1) % generalImages.length);
    }
  };

  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (generalImages.length > 0) {
      setCurrentImageIndex((prev) => (prev - 1 + generalImages.length) % generalImages.length);
    }
  };

  if (!isOpen && !isAnimating) return null;

  return (
    <div 
      className={`fixed top-4 right-4 bottom-4 w-[380px] z-[1001] transition-all duration-300 ease-in-out ${
        isOpen && !isAnimating ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
      }`}
    >
      <button
        onClick={handleClose}
        className="absolute -left-12 top-0 bg-white rounded-full p-2 shadow-lg hover:shadow-xl transition-shadow border border-gray-200 z-[1002]"
      >
        <ChevronRight size={20} className="text-gray-600" />
      </button>

      <div 
        className="h-full overflow-y-auto space-y-3 pr-2"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <style>{`div::-webkit-scrollbar { display: none; }`}</style>
        {loading ? (
          <div className="bg-white rounded-xl shadow-lg p-20 flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          </div>
        ) : error || !siteData ? (
          <div className="bg-white rounded-xl shadow-lg p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              <p className="text-sm font-medium text-gray-900">{error || "Site not found"}</p>
            </div>
          </div>
        ) : (
          <>
            {/* ✅ UPDATED: Conditional rendering based on userRole */}
            <div className="bg-white rounded-xl shadow-lg p-3">
              <div className={`grid gap-2 ${userRole === "GISSpecialist" ? "grid-cols-4" : "grid-cols-1"}`}>
                
                {/* Button 1: Show/Hide Site Polygon (Always visible) */}
                <button
                  onClick={() => {
                    if (isShowingSite) {
                      onHideAll?.();
                    } else {
                      onShowSiteInMap?.(siteData.site_id, siteData.polygon_coordinates);
                    }
                  }}
                  disabled={!siteData.polygon_coordinates && !isShowingSite}
                  className="flex flex-col items-center gap-1.5 p-2 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                  title="Show Site Boundary"
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isShowingSite ? 'bg-emerald-100' : 'bg-blue-100'}`}>
                    {isShowingSite ? (
                      <EyeOff size={14} className="text-emerald-600" />
                    ) : (
                      <Eye size={14} className="text-blue-600" />
                    )}
                  </div>
                  <span className="text-[10px] font-medium text-gray-700 text-center leading-tight">
                    {isShowingSite ? "Hide Site" : "Show Site"}
                  </span>
                </button>

                {/* ✅ Buttons 2, 3, 4: Only shown if user is GISSpecialist */}
                {userRole === "GISSpecialist" && (
                  <>
                    {/* Button 2: Show/Hide Potential Sites */}
                    <button
                      onClick={() => {
                        if (isShowingPotentialSites) {
                          onHideAll?.();
                        } else {
                          onShowPotentialSites?.(siteData.site_id);
                        }
                      }}
                      className="flex flex-col items-center gap-1.5 p-2 rounded-lg hover:bg-gray-50 transition-colors"
                      title="Show Potential Sites"
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isShowingPotentialSites ? 'bg-emerald-100' : 'bg-purple-100'}`}>
                        {isShowingPotentialSites ? (
                          <EyeOff size={14} className="text-emerald-600" />
                        ) : (
                          <Target size={14} className="text-purple-600" />
                        )}
                      </div>
                      <span className="text-[10px] font-medium text-gray-700 text-center leading-tight">
                        {isShowingPotentialSites ? "Hide Pot." : "Potential"}
                      </span>
                    </button>

                    {/* Button 3: Trend */}
                    <button
                      onClick={() => onViewTrend?.(siteData.site_id, siteData.polygon_coordinates)}
                      className="flex flex-col items-center gap-1.5 p-2 rounded-lg hover:bg-gray-50 transition-colors"
                      title="View NDVI Trend"
                    >
                      <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                        <TrendingUp size={14} className="text-emerald-600" />
                      </div>
                      <span className="text-[10px] font-medium text-gray-700 text-center leading-tight">Trend</span>
                    </button>

                    {/* Button 4: Re-analyze */}
                    <button
                      onClick={() => onReanalyze?.(siteData.site_id)}
                      className="flex flex-col items-center gap-1.5 p-2 rounded-lg hover:bg-gray-50 transition-colors"
                      title="Re-analyze Area"
                    >
                      <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                        <RefreshCw size={14} className="text-purple-600" />
                      </div>
                      <span className="text-[10px] font-medium text-gray-700 text-center leading-tight">Analyze</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* ... Rest of the component (Site Info, Photos, Location, Programs) remains exactly the same ... */}
            <div className="bg-white rounded-xl shadow-lg p-4">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-base font-bold text-gray-900 leading-tight">{siteData.name}</h2>
                {(() => {
                  const config = STATUS_CONFIG[siteData.status.toLowerCase()] || STATUS_CONFIG.pending;
                  return (
                    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold ${config.bg} ${config.color}`}>
                      {config.icon}
                      {config.label}
                    </div>
                  );
                })()}
              </div>
              {siteData.description && (
                <p className="text-xs text-gray-600 mt-2 leading-relaxed">{siteData.description}</p>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <button onClick={() => toggleSection("photos")} className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-2">
                  <ImageIcon size={14} className="text-gray-500" />
                  <span className="text-xs font-semibold text-gray-800">Photos</span>
                  {generalImages.length > 0 && <span className="text-[10px] text-gray-500">({generalImages.length})</span>}
                </div>
                {expandedSections.photos ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
              </button>
              {expandedSections.photos && generalImages.length > 0 && (
                <div className="p-3">
                  <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden">
                    <img src={generalImages[currentImageIndex].img_url || ""} alt={generalImages[currentImageIndex].caption || "Site image"} className="w-full h-full object-cover" />
                    {generalImages.length > 1 && (
                      <>
                        <div className="absolute top-2 right-2 bg-black/70 text-white text-[10px] px-2 py-0.5 rounded-full">{currentImageIndex + 1}/{generalImages.length}</div>
                        <button onClick={prevImage} className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 p-1 rounded-full hover:bg-white transition-colors"><ChevronLeft size={14} /></button>
                        <button onClick={nextImage} className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 p-1 rounded-full hover:bg-white transition-colors"><ChevronRight size={14} /></button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <button onClick={() => toggleSection("info")} className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-2">
                  <FileText size={14} className="text-gray-500" />
                  <span className="text-xs font-semibold text-gray-800">Information</span>
                </div>
                {expandedSections.info ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
              </button>
              {expandedSections.info && (
                <div className="p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-blue-50 rounded-lg p-2">
                      <div className="flex items-center gap-1 mb-1"><Leaf size={12} className="text-blue-600" /><span className="text-[10px] font-medium text-blue-700">Area</span></div>
                      <p className="text-xs font-bold text-blue-900">{siteData.total_area_hectares?.toFixed(2) ?? "N/A"} <span className="text-[10px] font-normal">ha</span></p>
                    </div>
                    <div className="bg-emerald-50 rounded-lg p-2">
                      <div className="flex items-center gap-1 mb-1"><TrendingUp size={12} className="text-emerald-600" /><span className="text-[10px] font-medium text-emerald-700">NDVI</span></div>
                      <p className="text-xs font-bold text-emerald-900">{siteData.ndvi_value?.toFixed(2) ?? "N/A"}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <button onClick={() => toggleSection("location")} className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-2">
                  <MapPin size={14} className="text-gray-500" />
                  <span className="text-xs font-semibold text-gray-800">Location</span>
                </div>
                {expandedSections.location ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
              </button>
              {expandedSections.location && (
                <div className="p-3 space-y-2">
                  {siteData.center_coordinate && (
                    <div className="bg-gray-50 rounded-lg p-2">
                      <p className="text-[10px] text-gray-500 mb-1">Coordinates</p>
                      <p className="text-xs font-mono text-gray-900">{siteData.center_coordinate[0]?.toFixed(4)}, {siteData.center_coordinate[1]?.toFixed(4)}</p>
                    </div>
                  )}
                  <div className="bg-purple-50 rounded-lg p-2">
                    <p className="text-[10px] text-purple-600 mb-1">Created</p>
                    <p className="text-xs font-medium text-purple-900">{siteData.created_at ? new Date(siteData.created_at).toLocaleDateString() : "N/A"}</p>
                  </div>
                </div>
              )}
            </div>

            {applications.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                <button onClick={() => toggleSection("programs")} className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-2">
                    <Leaf size={14} className="text-emerald-600" />
                    <span className="text-xs font-semibold text-gray-800">Programs</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">{applications.length}</span>
                  </div>
                  {expandedSections.programs ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                </button>
                {expandedSections.programs && (
                  <div className="p-3 space-y-2">
                    {applications.slice(0, 3).map((app) => (
                      <div key={app.application_id} className="bg-gray-50 rounded-lg p-2">
                        <p className="text-xs font-semibold text-gray-800 truncate">{app.title}</p>
                        <p className="text-[10px] text-gray-500">{app.organization_name}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}