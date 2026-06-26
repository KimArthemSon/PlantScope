import React, { useState, useEffect } from "react";
import { 
  MapPin, 
  Calendar, 
  Ruler, 
  Layers, 
  ChevronLeft, 
  ChevronRight,
  ExternalLink,
  AlertCircle,
  Loader2,
  Image as ImageIcon,
  CheckCircle,
  XCircle,
  Clock
} from "lucide-react";

const API = "http://127.0.0.1:8000/api/";

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

interface SiteMarkerPopupProps {
  siteId: number;
  token: string | null;
  onViewDetails?: (siteId: number) => void;
}

const STATUS_CONFIG: Record<string, { 
  color: string; 
  bg: string; 
  icon: React.ReactNode;
  label: string;
}> = {
  pending: {
    color: "text-amber-700",
    bg: "bg-amber-50",
    icon: <Clock size={12} />,
    label: "Pending",
  },
  under_review: {
    color: "text-purple-700",
    bg: "bg-purple-50",
    icon: <Clock size={12} />,
    label: "Under Review",
  },
  accepted: {
    color: "text-green-700",
    bg: "bg-green-50",
    icon: <CheckCircle size={12} />,
    label: "Accepted",
  },
  rejected: {
    color: "text-red-700",
    bg: "bg-red-50",
    icon: <XCircle size={12} />,
    label: "Rejected",
  },
  completed: {
    color: "text-blue-700",
    bg: "bg-blue-50",
    icon: <CheckCircle size={12} />,
    label: "Completed",
  },
  under_monitoring: {
    color: "text-teal-700",
    bg: "bg-teal-50",
    icon: <Clock size={12} />,
    label: "Under Monitoring",
  },
};

export default function SiteMarkerPopup({ 
  siteId, 
  token,
  onViewDetails 
}: SiteMarkerPopupProps) {
  const [siteData, setSiteData] = useState<SiteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    fetchSiteData();
  }, [siteId]);

  const fetchSiteData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API}get_site/${siteId}/`, {
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      setSiteData(data);
      
      // Filter only "general" images for carousel
      const generalImages = data.site_images?.filter(
        (img: SiteImage) => img.layer_tag === "general"
      ) || [];
      
      // Reset image index when data loads
      if (generalImages.length > 0) {
        setCurrentImageIndex(0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load site data");
    } finally {
      setLoading(false);
    }
  };

  const generalImages = siteData?.site_images?.filter(
    (img) => img.layer_tag === "general"
  ) || [];

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

  const handleViewDetails = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onViewDetails) {
      onViewDetails(siteId);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6 min-w-[280px]">
        <Loader2 className="w-6 h-6 animate-spin text-[#0F4A2F]" />
        <span className="ml-2 text-sm text-gray-600">Loading...</span>
      </div>
    );
  }

  if (error || !siteData) {
    return (
      <div className="p-4 min-w-[280px]">
        <div className="flex items-start gap-3 text-red-600">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm">Failed to Load</p>
            <p className="text-xs mt-1">{error || "Site not found"}</p>
          </div>
        </div>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[siteData.status.toLowerCase()] || STATUS_CONFIG.pending;

  return (
    <div className="min-w-[320px] max-w-[400px] font-sans">
      {/* Header with Name and Status */}
      <div className="border-b border-gray-200 pb-3 mb-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="text-lg font-bold text-gray-900 flex-1 leading-tight">
            {siteData.name}
          </h3>
          <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${statusConfig.bg} ${statusConfig.color}`}>
            {statusConfig.icon}
            {statusConfig.label}
          </div>
        </div>
        
        {/* Description */}
        {siteData.description && (
          <p className="text-sm text-gray-600 line-clamp-2">
            {siteData.description}
          </p>
        )}
      </div>

      {/* Image Carousel */}
      {generalImages.length > 0 && (
        <div className="relative mb-3 group">
          <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden">
            <img
              src={`${generalImages[currentImageIndex].img_url}`}
              alt={generalImages[currentImageIndex].caption || "Site image"}
              className="w-full h-full object-cover"
            />
            
            {/* Image Counter */}
            <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
              {currentImageIndex + 1} / {generalImages.length}
            </div>

            {/* Caption */}
            {generalImages[currentImageIndex].caption && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                <p className="text-white text-xs line-clamp-2">
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
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-700 p-1.5 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={nextImage}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-700 p-1.5 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ChevronRight size={16} />
              </button>
            </>
          )}

          {/* Dots Indicator */}
          {generalImages.length > 1 && (
            <div className="flex justify-center gap-1.5 mt-2">
              {generalImages.map((_, idx) => (
                <button
                  key={idx}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentImageIndex(idx);
                  }}
                  className={`w-2 h-2 rounded-full transition-all ${
                    idx === currentImageIndex 
                      ? "bg-[#0F4A2F] w-4" 
                      : "bg-gray-300 hover:bg-gray-400"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* No Images Placeholder */}
      {generalImages.length === 0 && (
        <div className="mb-3 p-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-center">
          <ImageIcon className="w-8 h-8 text-gray-300 mb-2" />
          <p className="text-xs text-gray-500">No images available</p>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-gray-50 rounded-lg p-2.5 border border-gray-100">
          <div className="flex items-center gap-1.5 text-gray-500 mb-1">
            <Ruler size={14} />
            <span className="text-xs font-medium">Area</span>
          </div>
          <p className="text-sm font-bold text-gray-900">
            {siteData.total_area_hectares?.toFixed(2) || "0.00"} ha
          </p>
        </div>

        <div className="bg-gray-50 rounded-lg p-2.5 border border-gray-100">
          <div className="flex items-center gap-1.5 text-gray-500 mb-1">
            <Layers size={14} />
            <span className="text-xs font-medium">NDVI</span>
          </div>
          <p className="text-sm font-bold text-gray-900">
            {siteData.ndvi_value?.toFixed(3) || "N/A"}
          </p>
        </div>

        <div className="bg-gray-50 rounded-lg p-2.5 border border-gray-100 col-span-2">
          <div className="flex items-center gap-1.5 text-gray-500 mb-1">
            <Calendar size={14} />
            <span className="text-xs font-medium">Created</span>
          </div>
          <p className="text-sm font-semibold text-gray-900">
            {new Date(siteData.created_at).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 pt-2 border-t border-gray-200">
        <button
          onClick={handleViewDetails}
          className="flex-1 flex items-center justify-center gap-2 bg-[#0F4A2F] hover:bg-[#0a3522] text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          <ExternalLink size={14} />
          View Full Details
        </button>
      </div>
    </div>
  );
}