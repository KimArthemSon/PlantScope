import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import {
  MapPin,
  Trees,
  Ruler,
  Activity,
  ShieldCheck,
  CheckCircle,
  AlertCircle,
  Calendar,
  Loader2,
  RefreshCw,
  Map as MapIcon,
  Navigation,
} from "lucide-react";
// Leaflet imports
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polygon,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
// Fix for default Leaflet marker icons in bundlers
import L from "leaflet";
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";

// Fix marker icons (required for webpack/vite)
const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});
L.Marker.prototype.options.icon = DefaultIcon;

// --- TypeScript Interfaces ---
interface SiteData {
  site_data_id: number;
  safety: string;
  legality: boolean;
  slope: number;
  soil_quality: string;
  distance_to_water_source: number;
  accessibility: string;
  wildlife: string;
  created_at: string;
}

interface SiteDetails {
  soil_id: number | null;
  soil_name: string | null;
  tree_specie_id: number | null;
  tree_specie_name: string | null;
}

interface Multicriteria {
  safety_status: string;
  legality_status: string;
  soil_quality_status: string;
  distance_to_water_source_status: string;
  accessibility_status: string;
  wildlife_status: string;
  slope_status: string;
  survival_rate: number;
  total_score: number;
  remarks: string | null;
  updated_at: string;
}

interface SiteResponse {
  site_id: number;
  name: string;
  status: string;
  coordinates: [number, number];
  polygon_coordinates: [number, number][];
  total_area_planted: number;
  total_seedling_planted: number;
  created_at: string;
  site_data: SiteData;
  site_details: SiteDetails;
  multicriteria: Multicriteria;
}

interface ApiResponse {
  data: SiteResponse;
}

// --- Sub-Components ---

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const colors: Record<string, string> = {
    official: "bg-green-100 text-green-800 border-green-200",
    draft: "bg-gray-100 text-gray-800 border-gray-200",
    pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
    archived: "bg-red-100 text-red-800 border-red-200",
  };
  return (
    <span
      className={`px-3 py-1 rounded-full text-xs font-semibold border ${colors[status] || colors.draft} capitalize`}
    >
      {status}
    </span>
  );
};

interface InfoCardProps {
  title: string;
  value: string | number;
  icon?: React.ElementType;
  subtext?: string;
}

const InfoCard: React.FC<InfoCardProps> = ({
  title,
  value,
  icon: Icon,
  subtext,
}) => (
  <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
    <div className="flex items-center justify-between mb-2">
      <h3 className="text-gray-500 text-sm font-medium">{title}</h3>
      {Icon && <Icon className="w-4 h-4 text-gray-400" />}
    </div>
    <div className="text-xl font-bold text-gray-800">{value}</div>
    {subtext && <div className="text-xs text-gray-400 mt-1">{subtext}</div>}
  </div>
);

interface DataItemProps {
  label: string;
  value: string;
  status?: string;
}

const DataItem: React.FC<DataItemProps> = ({ label, value, status }) => {
  let statusColor = "text-gray-500";
  if (status === "completed") statusColor = "text-green-600";
  return (
    <div className="flex justify-between items-center py-3 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-600 font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`text-sm font-semibold ${statusColor}`}>{value}</span>
        {status === "completed" && (
          <CheckCircle className="w-4 h-4 text-green-500" />
        )}
      </div>
    </div>
  );
};

// --- GoToCenterButton Component (Matches your Classified_area_form) ---
interface GoToCenterButtonProps {
  center: [number, number];
  zoom?: number;
  label?: string;
}

const GoToCenterButton: React.FC<GoToCenterButtonProps> = ({
  center,
  zoom = 16,
  label = "Fly to Site",
}) => {
  const map = useMap();

  const handleClick = () => {
    map.flyTo(center, zoom, {
      animate: true,
      duration: 1.5,
    });
  };

  return (
    <button
      onClick={handleClick}
      className="absolute bottom-4 right-4 z-[400] bg-[#0F4A2F] text-white px-4 py-2 rounded-lg shadow-lg 
                 hover:bg-[#0a3522] transition-colors flex items-center gap-2 text-sm font-medium"
    >
      <Navigation size={16} />
      {label}
    </button>
  );
};

// --- Map Component (Leaflet Implementation) ---
interface SiteMapProps {
  coordinates: [number, number];
  polygon?: [number, number][];
  siteName?: string;
}

const SiteMap: React.FC<SiteMapProps> = ({
  coordinates,
  polygon,
  siteName,
}) => {
  const mapRef = useRef<L.Map | null>(null);

  return (
    <div className="relative w-full h-64 md:h-96 rounded-xl overflow-hidden border border-gray-200 shadow-sm">
      <MapContainer
        center={coordinates}
        zoom={16}
        scrollWheelZoom={true}
        style={{ width: "100%", height: "100%" }}
        ref={mapRef}
        className="z-0"
      >
        {/* Google Satellite Tiles - Same as your Classified_area_form */}
        <TileLayer
          url="http://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
          attribution='&copy; <a href="https://www.google.com/intl/en/help/terms_maps.html">Google Maps</a>'
        />

        {/* Center Marker */}
        <Marker position={coordinates}>
          <Popup>
            <strong>{siteName || "Site Location"}</strong>
            <br />
            Lat: {coordinates[0].toFixed(6)}
            <br />
            Lng: {coordinates[1].toFixed(6)}
          </Popup>
        </Marker>

        {/* Polygon Boundary (if available) */}
        {polygon && polygon.length >= 3 && (
          <Polygon
            positions={polygon}
            pathOptions={{
              color: "#0F4A2F",
              fillColor: "#0F4A2F",
              fillOpacity: 0.2,
              weight: 2,
            }}
          >
            <Popup>
              <strong>Site Boundary</strong>
              <br />
              {polygon.length} coordinate points
            </Popup>
          </Polygon>
        )}

        {/* Fly to Site Button */}
        <GoToCenterButton center={coordinates} />
      </MapContainer>

      {/* Coordinate Badge Overlay */}
      <div
        className="absolute top-3 left-3 z-[400] bg-white/95 backdrop-blur px-3 py-2 rounded-lg 
                      shadow-sm text-xs font-mono text-gray-700 border border-gray-200"
      >
        <div className="flex items-center gap-1.5">
          <MapIcon className="w-3.5 h-3.5 text-[#0F4A2F]" />
          <span>
            {coordinates[0].toFixed(5)}, {coordinates[1].toFixed(5)}
          </span>
        </div>
      </div>
    </div>
  );
};

// --- Loading Skeleton ---
const SiteSkeleton: React.FC = () => (
  <div className="min-h-screen bg-gray-50 p-6 md:p-8 animate-pulse">
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="h-8 w-64 bg-gray-200 rounded"></div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="h-64 md:h-96 bg-gray-200 rounded-xl"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
        </div>
        <div className="space-y-6">
          <div className="h-96 bg-gray-200 rounded-xl"></div>
          <div className="h-48 bg-gray-200 rounded-xl"></div>
        </div>
      </div>
    </div>
  </div>
);

// --- Main Component ---
export default function SiteInformation(): JSX.Element {
  const { id, site_id } = useParams<{ id: string; site_id: string }>();

  const [siteData, setSiteData] = useState<SiteResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const API_URL = `http://127.0.0.1:8000/api/get_site/${site_id || id || 13}/`;

  const fetchSiteData = async () => {
    setLoading(true);
    setError(null);
    const token = localStorage.getItem("token");

    try {
      const response = await fetch(API_URL, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        if (response.status === 401)
          throw new Error("Authentication required. Please log in.");
        if (response.status === 403)
          throw new Error("Access denied. Insufficient permissions.");
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: ApiResponse = await response.json();
      setSiteData(result.data);
      setLastFetched(new Date());
    } catch (err) {
      console.error("Failed to fetch site data:", err);
      setError(err instanceof Error ? err.message : "Failed to load site data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSiteData();
  }, [site_id, id]);

  if (loading && !siteData) return <SiteSkeleton />;

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-xl shadow-sm border border-red-200 p-8 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            Failed to Load Site
          </h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={fetchSiteData}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!siteData) return null;

  const details = siteData.site_data;
  const criteria = siteData.multicriteria;

  const formatRating = (value: string | boolean | number): string => {
    if (typeof value === "boolean") return value ? "Yes" : "No";
    return String(value).replace("_", " ").toUpperCase();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans text-gray-800">
      {/* Header Section */}
      <div className="max-w-7xl mx-auto mb-6 md:mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">
                {siteData.name}
              </h1>
              <StatusBadge status={siteData.status} />
            </div>
            <p className="text-gray-500 text-sm flex flex-wrap items-center gap-2">
              <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">
                Site ID: #{siteData.site_id}
              </span>
              <span className="w-1 h-1 bg-gray-300 rounded-full hidden md:inline"></span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {new Date(siteData.created_at).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </span>
              {lastFetched && (
                <>
                  <span className="w-1 h-1 bg-gray-300 rounded-full hidden md:inline"></span>
                  <span className="text-xs text-gray-400">
                    Updated: {lastFetched.toLocaleTimeString()}
                  </span>
                </>
              )}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={fetchSiteData}
              disabled={loading}
              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium 
                         hover:bg-gray-50 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Refresh
            </button>
            <button
              className="px-4 py-2 bg-[#0F4A2F] text-white rounded-lg text-sm font-medium 
                               hover:bg-[#0a3522] shadow-sm transition-colors"
            >
              Download Report
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN (Map & Key Stats) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Map Section */}
          <div className="bg-white p-1 rounded-xl shadow-sm border border-gray-200">
            <SiteMap
              coordinates={siteData.coordinates}
              polygon={siteData.polygon_coordinates}
              siteName={siteData.name}
            />
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <InfoCard
              title="Area Planted"
              value={`${siteData.total_area_planted.toFixed(2)} ha`}
              icon={Ruler}
            />
            <InfoCard
              title="Seedlings"
              value={siteData.total_seedling_planted.toLocaleString()}
              icon={Trees}
            />
            <InfoCard
              title="Survival Rate"
              value={`${criteria.survival_rate.toFixed(1)}%`}
              icon={Activity}
            />
            <InfoCard
              title="Total Score"
              value={criteria.total_score.toFixed(1)}
              icon={ShieldCheck}
            />
          </div>

          {/* Site Details */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <h2 className="text-lg font-semibold text-gray-800">
                Ecological Details
              </h2>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">
                  Soil Type
                </label>
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${siteData.site_details.soil_name ? "bg-emerald-500" : "bg-gray-300"}`}
                  ></div>
                  <span className="text-gray-700 font-medium">
                    {siteData.site_details.soil_name || "Not yet specified"}
                  </span>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">
                  Tree Species
                </label>
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${siteData.site_details.tree_specie_name ? "bg-emerald-500" : "bg-gray-300"}`}
                  ></div>
                  <span className="text-gray-700 font-medium">
                    {siteData.site_details.tree_specie_name ||
                      "Not yet specified"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (Site Data & Analysis) */}
        <div className="space-y-6">
          {/* Site Suitability Data */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-800">
                Site Suitability
              </h2>
              <span className="text-xs text-[#0F4A2F] font-medium cursor-pointer hover:underline">
                View Analysis
              </span>
            </div>
            <div className="px-6 py-2">
              <DataItem
                label="Safety"
                value={formatRating(details.safety)}
                status={criteria.safety_status}
              />
              <DataItem
                label="Legality"
                value={formatRating(details.legality)}
                status={criteria.legality_status}
              />
              <DataItem
                label="Slope"
                value={`${details.slope}°`}
                status={criteria.slope_status}
              />
              <DataItem
                label="Soil Quality"
                value={formatRating(details.soil_quality)}
                status={criteria.soil_quality_status}
              />
              <DataItem
                label="Water Distance"
                value={`${details.distance_to_water_source} km`}
                status={criteria.distance_to_water_source_status}
              />
              <DataItem
                label="Accessibility"
                value={formatRating(details.accessibility)}
                status={criteria.accessibility_status}
              />
              <DataItem
                label="Wildlife"
                value={formatRating(details.wildlife)}
                status={criteria.wildlife_status}
              />
            </div>
          </div>

          {/* Multicriteria Summary */}
          <div className="bg-gradient-to-br from-[#0F4A2F] to-[#1a6b44] rounded-xl shadow-lg text-white p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-emerald-100 text-sm font-medium">
                  Assessment Status
                </h3>
                <div className="text-2xl font-bold mt-1">All Criteria Met</div>
              </div>
              <div className="p-2 bg-white/20 rounded-lg">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between text-sm text-emerald-100">
                <span>Completed Checks</span>
                <span className="font-semibold text-white">7/7</span>
              </div>
              <div className="w-full bg-emerald-900/40 rounded-full h-2">
                <div className="bg-white h-2 rounded-full w-full shadow-sm"></div>
              </div>
              <p className="text-xs text-emerald-200 mt-4 pt-4 border-t border-emerald-500/30">
                Last assessment:{" "}
                {new Date(criteria.updated_at).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">
              Quick Actions
            </h3>
            <div className="space-y-3">
              <button className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:border-[#0F4A2F] hover:bg-[#0F4A2F]/5 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#0F4A2F]/10 rounded-lg group-hover:bg-[#0F4A2F]/20 transition-colors">
                    <Trees className="w-4 h-4 text-[#0F4A2F]" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-800">
                      Add Seedlings
                    </div>
                    <div className="text-xs text-gray-500">
                      Record new planting data
                    </div>
                  </div>
                </div>
              </button>
              <button className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:border-[#0F4A2F] hover:bg-[#0F4A2F]/5 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#0F4A2F]/10 rounded-lg group-hover:bg-[#0F4A2F]/20 transition-colors">
                    <Activity className="w-4 h-4 text-[#0F4A2F]" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-800">
                      Update Survival Rate
                    </div>
                    <div className="text-xs text-gray-500">
                      Log monitoring results
                    </div>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
