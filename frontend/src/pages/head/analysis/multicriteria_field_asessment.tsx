// src/pages/analysis/field_assessment/index.tsx
import { ChevronLeft, Filter, Search, Star } from "lucide-react";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";

// ============ CONFIG ============
const API_BASE_URL = "http://127.0.0.1:8000";

// ============ TYPES ============
interface FieldAssessment {
  id: number;
  layer: string;
  inspector: {
    name: string;
    email: string;
    avatar: string;
    role: string;
  };
  feedback: string;
  description?: string;
  rating?: number;
  photos?: string[];
  visited_at: string;
  verified?: boolean;
}

// ✅ Backend response interfaces (matching your Django views)
interface BackendPhoto {
  photo_id: number;
  url: string;
  type: string;
  uploaded_at?: string;
}

interface BackendUser {
  user_id: number;
  full_name: string;
  email: string;
  profile_img: string | null;
}

interface BackendAssessmentItem {
  field_assessment_id: number;
  created_at: string;
  safety_value?: string;
  safety_label?: string;
  soil_quality_value?: string;
  soil_quality_label?: string;
  legality_value?: string;
  legality_label?: string;
  accessibility_value?: string;
  accessibility_label?: string;
  wildlife_value?: string;
  wildlife_label?: string;
  slope_value?: number;
  slope_label?: string;
  distance_value?: string;
  distance_label?: string;
  multicriteria_status: string;
  discussion: string | null;
  photos: BackendPhoto[];
  photos_count: number;
  user: BackendUser;
  site_details?: {
    site_id: number;
    site_name: string | null;
    location: string | null;
    area_hectares: number | null;
  };
  soils_count?: number;
}

interface BackendAssessmentResponse {
  reforestation_area_id: number;
  site_id: number | null;
  criteria: string;
  count: number;
  results: BackendAssessmentItem[];
}

// ============ LAYER CONFIG with backend endpoint mapping ============
const layerConfig: Record<
  string,
  { label: string; icon: string; color: string; backendKey: string }
> = {
  safety: {
    label: "Safety",
    icon: "🛡️",
    color: "bg-blue-500",
    backendKey: "safety",
  },
  legality: {
    label: "Legality",
    icon: "⚖️",
    color: "bg-purple-500",
    backendKey: "legality",
  },
  soil_quality: {
    label: "Soil Quality",
    icon: "🌱",
    color: "bg-emerald-500",
    backendKey: "soil_quality",
  },
  slope: {
    label: "Slope Analysis",
    icon: "📐",
    color: "bg-amber-500",
    backendKey: "slope",
  },
  distance_to_water_source: {
    label: "Water Access",
    icon: "💧",
    color: "bg-cyan-500",
    backendKey: "water_accessibility",
  },
  accessibility: {
    label: "Accessibility",
    icon: "🚶",
    color: "bg-indigo-500",
    backendKey: "accessibility",
  },
  wildlife: {
    label: "Wildlife Impact",
    icon: "🦌",
    color: "bg-pink-500",
    backendKey: "wildlife",
  },
};

export default function FieldAssessmentPage() {
  const { siteId, layerKey } = useParams<{
    siteId: string;
    layerKey: string;
  }>();
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const [assessments, setAssessments] = useState<FieldAssessment[]>([]);
  const [filteredAssessments, setFilteredAssessments] = useState<
    FieldAssessment[]
  >([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [ratingFilter, setRatingFilter] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "rating">(
    "newest",
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Layer info
  const layer = layerConfig[layerKey || ""] || {
    label: "Assessments",
    icon: "📋",
    color: "bg-gray-500",
    backendKey: "safety",
  };

  // ✅ Helper: Convert relative media URLs to absolute
  const getAbsoluteUrl = useCallback(
    (relativeUrl: string | null | undefined): string => {
      if (!relativeUrl) return "";
      if (relativeUrl.startsWith("http")) return relativeUrl;
      if (relativeUrl.startsWith("/media"))
        return `${API_BASE_URL}${relativeUrl}`;
      return relativeUrl;
    },
    [],
  );

  // ✅ Transform backend assessment to frontend FieldAssessment
  const transformBackendAssessment = useCallback(
    (item: BackendAssessmentItem, layerKeyParam: string): FieldAssessment => {
      // Map status to rating (for display)
      const statusToRating: Record<string, number> = {
        legal: 5,
        safe: 5,
        very_good: 5,
        good: 4,
        moderate: 3,
        poor: 2,
        very_poor: 1,
        danger: 1,
        illegal: 1,
        slightly: 2,
      };

      // Transform photos with absolute URLs
      const photos = item.photos.map((photo) => getAbsoluteUrl(photo.url));

      return {
        id: item.field_assessment_id,
        layer: layerKeyParam,
        inspector: {
          name: item.user.full_name,
          email: item.user.email,
          avatar:
            getAbsoluteUrl(item.user.profile_img) ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(
              item.user.full_name,
            )}&background=047857&color=fff`,
          role: "Field Inspector",
        },
        feedback: item.discussion || "",
        description: item.discussion || undefined,
        rating: statusToRating[item.multicriteria_status] || 3,
        photos: photos.length > 0 ? photos : undefined,
        visited_at: item.created_at,
        verified: item.multicriteria_status !== "pending",
      };
    },
    [getAbsoluteUrl],
  );

  // 🌐 Fetch field assessments from backend (updated to use site_id in URL path)
  const fetchFieldAssessments = useCallback(async () => {
    if (!siteId || !token || !layerKey) return;

    setLoading(true);
    setError(null);

    try {
      const backendCriteria = layer.backendKey;

      // ✅ Updated endpoint: site_id is now in the URL path, not query param
      const endpoint = `${API_BASE_URL}/api/get_field_assessments_${backendCriteria}/${siteId}/`;

      const res = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        if (res.status === 404) {
          setAssessments([]);
          setFilteredAssessments([]);
          return;
        }
        throw new Error(`Failed to fetch: ${res.status}`);
      }

      const data: BackendAssessmentResponse = await res.json();
       console.log(data)
      // Transform all results to frontend format
      const transformed: FieldAssessment[] = data.results.map((item) =>
        transformBackendAssessment(item, layerKey),
      );

      // Sort by created_at descending (newest first)
      transformed.sort(
        (a, b) =>
          new Date(b.visited_at).getTime() - new Date(a.visited_at).getTime(),
      );

      setAssessments(transformed);
      setFilteredAssessments(transformed);
    } catch (err: any) {
      console.error("Assessment fetch error:", err);
      setError(err.message || "Failed to load assessments");
      setAssessments([]);
      setFilteredAssessments([]);
    } finally {
      setLoading(false);
    }
  }, [siteId, token, layerKey, layer.backendKey, transformBackendAssessment]);

  // 🔄 Fetch assessments on mount/layer/site change
  useEffect(() => {
    if (siteId && token && layerKey) {
       
      fetchFieldAssessments();
    }
  }, [siteId, token, layerKey, fetchFieldAssessments]);

  // Apply filters & search (client-side)
  useEffect(() => {
    let result = [...assessments];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (a) =>
          a.feedback.toLowerCase().includes(term) ||
          a.inspector.name.toLowerCase().includes(term) ||
          a.description?.toLowerCase().includes(term),
      );
    }

    // Rating filter
    if (ratingFilter !== null) {
      result = result.filter((a) => (a.rating || 0) >= ratingFilter);
    }

    // Sorting
    if (sortBy === "newest") {
      result.sort(
        (a, b) =>
          new Date(b.visited_at).getTime() - new Date(a.visited_at).getTime(),
      );
    } else if (sortBy === "oldest") {
      result.sort(
        (a, b) =>
          new Date(a.visited_at).getTime() - new Date(b.visited_at).getTime(),
      );
    } else if (sortBy === "rating") {
      result.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }

    setFilteredAssessments(result);
  }, [assessments, searchTerm, ratingFilter, sortBy]);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading assessments...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50">
        <div className="text-center bg-white rounded-xl shadow-sm border border-red-100 p-8 max-w-md">
          <div className="text-4xl mb-4">⚠️</div>
          <h3 className="text-lg font-semibold text-red-700 mb-2">
            Error Loading Assessments
          </h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => fetchFieldAssessments()}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50 to-teal-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-[#0F4A2F] to-[#1a6b44] text-white py-4 px-6 shadow-lg sticky top-0 z-40">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <span className="text-2xl">{layer.icon}</span>
                {layer.label} Assessments
              </h1>
              <p className="text-sm text-emerald-100">
                Site ID: <span className="font-mono">{siteId}</span> •{" "}
                {filteredAssessments.length} assessment
                {filteredAssessments.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                placeholder="Search feedback, inspector..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
              />
            </div>

            

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="rating">Highest Rated</option>
            </select>
          </div>
        </div>

        {/* Assessments List */}
        <div className="space-y-4">
          {filteredAssessments.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
              <div className="text-5xl mb-4">🔍</div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                No Assessments Found
              </h3>
              <p className="text-gray-500 mb-4">
                {searchTerm || ratingFilter
                  ? "Try adjusting your filters to see more results."
                  : "No field assessments have been submitted for this layer yet."}
              </p>
              {(searchTerm || ratingFilter) && (
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setRatingFilter(null);
                  }}
                  className="text-emerald-600 hover:text-emerald-700 font-medium"
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            filteredAssessments.map((assessment) => (
              <FieldAssessmentCard
                key={assessment.id}
                assessment={assessment}
              />
            ))
          )}
        </div>

        {/* Stats Footer */}
        <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-4">
              <span>
                <strong className="text-gray-800">
                  {filteredAssessments.length}
                </strong>{" "}
                showing
              </span>
              
              
            </div>
            <button
              onClick={() => navigate(-1)}
              className="text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1"
            >
              <ChevronLeft size={16} /> Back to Analysis
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

// ============ FIELD ASSESSMENT CARD COMPONENT ============
function FieldAssessmentCard({ assessment }: { assessment: FieldAssessment }) {
  const [expanded, setExpanded] = useState(false);

  const StarRating = ({ rating }: { rating?: number }) => {
    if (!rating) return null;
    return (
      <div className="flex">
        {[1, 2, 3, 4, 5].map((star) => (
          <span
            key={star}
            className={`text-[0rem]${
              star <= rating ? "text-amber-400" : "text-gray-300"
            }`}
          >
            
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md hover:border-emerald-200 transition-all duration-200">
      {/* Header */}
      <div className="flex items-start gap-4 mb-4">
        <img
          src={assessment.inspector.avatar}
          alt={assessment.inspector.name}
          className="w-12 h-12 rounded-full border-2 border-white shadow-sm flex-shrink-0"
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              `https://ui-avatars.com/api/?name=${encodeURIComponent(
                assessment.inspector.name,
              )}&background=047857&color=fff&size=128`;
          }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h4 className="font-semibold text-gray-800">
                {assessment.inspector.name}
              </h4>
              <p className="text-sm text-gray-500">
                {assessment.inspector.role}
              </p>
            </div>
            {assessment.verified && (
              <span className="text-xs text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 flex items-center gap-1">
                ✓ Verified
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {assessment.inspector.email}
          </p>
        </div>
      </div>

      {/* Feedback */}
      <div className="mb-4">
        <p className="text-gray-700 leading-relaxed">{assessment.feedback}</p>
        {assessment.description &&
          assessment.description !== assessment.feedback && (
            <>
              <p
                className={`text-sm text-gray-500 mt-3 leading-relaxed ${
                  !expanded ? "line-clamp-3" : ""
                }`}
              >
                {assessment.description}
              </p>
              {assessment.description.length > 150 && (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="text-xs text-emerald-600 hover:text-emerald-700 font-medium mt-2 flex items-center gap-1"
                >
                  {expanded ? "▲ Show less" : "▼ Read more"}
                </button>
              )}
            </>
          )}
      </div>

      {/* Photos */}
      {assessment.photos && assessment.photos.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
            📷 Evidence Photos
          </p>
          <div className="flex gap-2 flex-wrap">
            {assessment.photos.slice(0, 4).map((photo, idx) => (
              <img
                key={idx}
                src={photo}
                alt={`Evidence ${idx + 1}`}
                className="w-20 h-16 object-cover rounded-lg border border-gray-200 hover:scale-105 transition-transform cursor-pointer"
                onClick={() => window.open(photo, "_blank")}
              />
            ))}
            {assessment.photos.length > 4 && (
              <div className="w-20 h-16 bg-gray-100 rounded-lg flex items-center justify-center text-xs text-gray-500 border border-gray-200">
                +{assessment.photos.length - 4}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        <div className="flex items-center gap-4">
          <StarRating rating={assessment.rating} />
          <span className="text-xs text-gray-400">
            📅{" "}
            {new Date(assessment.visited_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        </div>
        <button className="text-xs text-gray-500 hover:text-emerald-600 font-medium transition-colors">
          View Details →
        </button>
      </div>
    </div>
  );
}
