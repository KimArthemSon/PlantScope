import React, { useState, useEffect } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  AlertCircle,
  Loader2,
  Image as ImageIcon,
  CheckCircle,
  XCircle,
  Clock,
  MapPin,
  Calendar,
  FileText,
  Leaf,   // ✅ NEW
  Users,  // ✅ NEW
} from "lucide-react";

const API = "http://127.0.0.1:8000/api/";
const API_IMAGE = "http://127.0.0.1:8000";

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

// ✅ NEW: Interface for Tree Planting Applications
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
}

const STATUS_CONFIG: Record<
  string,
  {
    color: string;
    bg: string;
    border: string;
    icon: React.ReactNode;
    label: string;
  }
> = {
  pending: {
    color: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
    icon: <Clock size={14} />,
    label: "Pending",
  },
  under_review: {
    color: "text-purple-700",
    bg: "bg-purple-50",
    border: "border-purple-200",
    icon: <Clock size={14} />,
    label: "Under Review",
  },
  accepted: {
    color: "text-green-700",
    bg: "bg-green-50",
    border: "border-green-200",
    icon: <CheckCircle size={14} />,
    label: "Accepted",
  },
  rejected: {
    color: "text-red-700",
    bg: "bg-red-50",
    border: "border-red-200",
    icon: <XCircle size={14} />,
    label: "Rejected",
  },
  completed: {
    color: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-200",
    icon: <CheckCircle size={14} />,
    label: "Completed",
  },
  under_monitoring: {
    color: "text-teal-700",
    bg: "bg-teal-50",
    border: "border-teal-200",
    icon: <Clock size={14} />,
    label: "Under Monitoring",
  },
};

export default function SiteInfoPanel({
  siteId,
  token,
  isOpen,
  onClose,
  onViewDetails,
}: SiteInfoPanelProps) {
  const [siteData, setSiteData] = useState<SiteData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  // ✅ NEW: State for applications
  const [applications, setApplications] = useState<SiteApplication[]>([]);

  useEffect(() => {
    if (siteId && isOpen) {
      fetchSiteData(siteId);
      fetchSiteApplications(siteId); // ✅ Fetch applications alongside site data
    }
  }, [siteId, isOpen]);

  const fetchSiteData = async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API}get_site/${id}/`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setSiteData(data);
      setCurrentImageIndex(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load site data");
    } finally {
      setLoading(false);
    }
  };

  // ✅ NEW: Fetch applications for this site
  const fetchSiteApplications = async (id: number) => {
    try {
      const response = await fetch(`${API}get_site_applications/${id}/`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setApplications(data.applications || []);
      }
    } catch (err) {
      console.error("Failed to fetch site applications", err);
    }
  };

  const generalImages =
    siteData?.site_images?.filter((img) => img.layer_tag === "general") || [];

  const nextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (generalImages.length > 0) {
      setCurrentImageIndex((prev) => (prev + 1) % generalImages.length);
    }
  };

  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (generalImages.length > 0) {
      setCurrentImageIndex(
        (prev) => (prev - 1 + generalImages.length) % generalImages.length,
      );
    }
  };

  const handleViewFullDetails = () => {
    if (siteData && onViewDetails) {
      onViewDetails(siteData.site_id);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 z-[1000] transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Side Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-full md:w-[450px] lg:w-[500px] bg-white shadow-2xl z-[1001] transform transition-transform duration-300 ease-in-out overflow-y-auto ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="sticky top-0 bg-[#047152] border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-color cursor-pointer"
          >
            <X size={20} className="text-white hover:text-black" />
          </button>
          <h2 className="text-lg font-bold text-white ">Site Information</h2>
          <div className="w-10" /> {/* Spacer for centering */}
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[#0F4A2F] mb-3" />
              <p className="text-sm text-gray-600">Loading site details...</p>
            </div>
          ) : error || !siteData ? (
            <div className="flex items-start gap-3 p-4 bg-red-50 rounded-lg border border-red-200">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm text-red-800">
                  Failed to Load
                </p>
                <p className="text-xs text-red-600 mt-1">
                  {error || "Site not found"}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Title and Status */}
              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h1 className="text-2xl font-bold text-gray-900 flex-1">
                    {siteData.name}
                  </h1>
                  {(() => {
                    const config =
                      STATUS_CONFIG[siteData.status.toLowerCase()] ||
                      STATUS_CONFIG.pending;
                    return (
                      <div
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${config.bg} ${config.color} ${config.border}`}
                      >
                        {config.icon}
                        {config.label}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Image Carousel */}
              {generalImages.length > 0 ? (
                <div className="relative group">
                  <div className="relative aspect-video bg-gray-100 rounded-xl overflow-hidden shadow-lg">
                    <img
                      src={`${API_IMAGE}${generalImages[currentImageIndex].img_url}`}
                      alt={
                        generalImages[currentImageIndex].caption || "Site image"
                      }
                      className="w-full h-full object-cover"
                    />

                    {/* Image Counter */}
                    <div className="absolute top-3 right-3 bg-black/70 text-white text-xs px-3 py-1 rounded-full font-medium">
                      {currentImageIndex + 1} / {generalImages.length}
                    </div>

                    {/* Caption */}
                    {generalImages[currentImageIndex].caption && (
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent p-4">
                        <p className="text-white text-sm font-medium">
                          {generalImages[currentImageIndex].caption}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Navigation Arrows */}
                  {generalImages.length > 1 && (
                    <>
                      <button
                        onClick={prevImage}
                        className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/95 hover:bg-white text-gray-800 p-2 rounded-full shadow-lg transition-all opacity-0 group-hover:opacity-100"
                      >
                        <ChevronLeft size={20} />
                      </button>
                      <button
                        onClick={nextImage}
                        className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/95 hover:bg-white text-gray-800 p-2 rounded-full shadow-lg transition-all opacity-0 group-hover:opacity-100"
                      >
                        <ChevronRight size={20} />
                      </button>
                    </>
                  )}

                  {/* Dots Indicator */}
                  {generalImages.length > 1 && (
                    <div className="flex justify-center gap-2 mt-3">
                      {generalImages.map((_, idx) => (
                        <button
                          key={idx}
                          onClick={(e) => {
                            e.stopPropagation();
                            setCurrentImageIndex(idx);
                          }}
                          className={`h-2 rounded-full transition-all ${
                            idx === currentImageIndex
                              ? "bg-[#0F4A2F] w-6"
                              : "bg-gray-300 hover:bg-gray-400 w-2"
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="aspect-video bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-center p-8">
                  <ImageIcon className="w-12 h-12 text-gray-300 mb-3" />
                  <p className="text-sm text-gray-500 font-medium">
                    No images available
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Images will be uploaded by field teams
                  </p>
                </div>
              )}

              {/* Description - Now under images with label */}
              {siteData.description && (
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <div className="flex items-center gap-2 text-gray-700 mb-2">
                    <FileText size={16} />
                    <span className="text-xs font-semibold uppercase tracking-wider">
                      Description
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {siteData.description}
                  </p>
                </div>
              )}

              {/* Created Date - Single card */}
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200">
                <div className="flex items-center gap-2 text-purple-700 mb-2">
                  <Calendar size={16} />
                  <span className="text-xs font-semibold">Created Date</span>
                </div>
                <p className="text-lg font-semibold text-purple-900">
                  {siteData.created_at
                    ? new Date(siteData.created_at).toLocaleDateString(
                        "en-US",
                        {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        },
                      )
                    : "N/A"}
                </p>
              </div>

              {/* Coordinates */}
              {siteData.center_coordinate && (
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <div className="flex items-center gap-2 text-gray-700 mb-2">
                    <MapPin size={16} />
                    <span className="text-xs font-semibold">
                      Center Coordinates
                    </span>
                  </div>
                  <p className="text-sm font-mono text-gray-900">
                    {siteData.center_coordinate[0].toFixed(6)},{" "}
                    {siteData.center_coordinate[1].toFixed(6)}
                  </p>
                </div>
              )}

              {/* ✅ NEW: Tree Planting Programs Section */}
              <div>
                <div className="flex items-center gap-2 text-gray-700 mb-3">
                  <Leaf size={16} className="text-green-600" />
                  <span className="text-xs font-semibold uppercase tracking-wider">
                    Tree Planting Programs
                  </span>
                  <span className="ml-auto text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">
                    {applications.length}
                  </span>
                </div>

                {applications.length === 0 ? (
                  <div className="bg-gray-50 rounded-xl p-4 border border-dashed border-gray-200 text-center">
                    <p className="text-sm text-gray-500 font-medium">No programs assigned yet</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Tree grower applications will appear here once assigned to this site.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {applications.map((app) => {
                      // Map status to colors
                      const statusColors: Record<string, { bg: string; text: string; border: string }> = {
                        for_evaluation: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
                        for_head: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
                        accepted: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
                        rejected: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
                        completed: { bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-200" },
                        cancelled: { bg: "bg-gray-50", text: "text-gray-700", border: "border-gray-200" },
                      };
                      const colors = statusColors[app.status] || statusColors.for_evaluation;

                      return (
                        <div 
                          key={app.application_id} 
                          className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
                        >
                          {/* Header: Title & Status */}
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <h4 className="text-sm font-bold text-gray-800 flex-1 leading-tight">
                              {app.title}
                            </h4>
                            <span className={`text-[10px] font-bold px-2 py-1 rounded-full border capitalize whitespace-nowrap ${colors.bg} ${colors.text} ${colors.border}`}>
                              {app.status.replace('_', ' ')}
                            </span>
                          </div>
                          
                          {/* Body: Organization & Details */}
                          <div className="space-y-2 text-xs">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                                <Users size={12} className="text-gray-500" />
                              </div>
                              <div>
                                <p className="text-gray-400 text-[10px] uppercase font-semibold">Tree Grower</p>
                                <p className="text-gray-800 font-semibold">{app.organization_name}</p>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100">
                              <div>
                                <p className="text-gray-400 text-[10px] uppercase font-semibold">Type</p>
                                <p className="text-gray-700 font-medium capitalize">{app.classification}</p>
                              </div>
                              {app.total_members && (
                                <div>
                                  <p className="text-gray-400 text-[10px] uppercase font-semibold">Members</p>
                                  <p className="text-gray-700 font-medium">{app.total_members}</p>
                                </div>
                              )}
                            </div>

                            {app.orientation_date && (
                              <div className="flex items-center gap-1.5 pt-2 border-t border-gray-100 text-gray-600">
                                <Calendar size={12} className="text-gray-400" />
                                <span className="font-medium">
                                  Orientation: {new Date(app.orientation_date).toLocaleDateString("en-US", { month: 'short', day: 'numeric', year: 'numeric' })}
                                </span>
                              </div>
                            )}
                            
                            <div className="flex items-center gap-1.5 text-gray-400 pt-1">
                              <Clock size={10} />
                              <span className="text-[10px]">Applied on {app.created_at}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Action Button */}
              <button
                onClick={handleViewFullDetails}
                className="w-full flex items-center justify-center gap-2 bg-[#0F4A2F] hover:bg-[#0a3522] text-white px-6 py-3.5 rounded-xl text-sm font-semibold transition-all shadow-lg hover:shadow-xl"
              >
                <ExternalLink size={16} />
                View Full Site Details
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}