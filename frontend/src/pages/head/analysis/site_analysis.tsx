import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Trash2,
  Edit,
  Plus,
  ChevronRight,
  ChevronLeft,
  Map,
  Leaf,
  Eye,
  Droplets,
  Target,
  Pin,
  PinOff,
} from "lucide-react";
import PlantScopeAlert from "@/components/alert/PlantScopeAlert";
import Delete_modal from "@/components/layout/delete_modal";
import LoaderPending from "@/components/layout/loaderSmall";
import { useUserRole } from "@/hooks/authorization";

// =========================
// INTERFACES (Assessment Phase Only)
// =========================
interface ValidationProgress {
  validated_layers: number;
  total_layers: number; // Always 8 per MCDA v2.0
  rejected_layers: number;
  is_complete: boolean;
}

interface SiteMetrics {
  ndvi: number | null; // Only NDVI shown - calculated from satellite, not manual
  // area_hectares & seedlings removed: monitoring-phase metrics
}

interface Site {
  site_id: number;
  name: string;
  status: string;
  is_pinned: boolean;
  created_at: string;
  validation_progress: ValidationProgress;
  metrics: SiteMetrics;
}

interface Filter {
  search: string;
  entries: number;
  page: number;
  total_page: number;
  status: string;
  pinned_only: boolean;
}

export default function Sites_analysis() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const [sites, setSites] = useState<Site[]>([]);
  const [filter, setFilter] = useState<Filter>({
    search: "",
    entries: 10,
    page: 1,
    total_page: 1,
    status: "all",
    pinned_only: false,
  });
  const [loading, setLoading] = useState(false);
  const [PSalert, setPSAlert] = useState<{
    type: "success" | "failed" | "error";
    title: string;
    message: string;
  } | null>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newSiteName, setNewSiteName] = useState("");
  // ✅ REMOVED: Manual inputs for NDVI/area/seedlings - calculated in other modules

  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [updateSiteName, setUpdateSiteName] = useState("");
  const [updateSiteId, setUpdateSiteId] = useState<number | null>(null);

  const { userRole } = useUserRole();
  const [userPath, setUserPath] = useState("");

  useEffect(() => {
    if (userRole === "treeGrowers" || userRole === "CityENROHead") {
      setUserPath("");
    } else if (userRole === "GISSpecialist") {
      setUserPath("/GISS");
    } else if (userRole === "DataManager") {
      setUserPath("/DataManager");
    }
  }, [userRole]);

  // =========================
  // FETCH SITES
  // =========================
  const fetchSites = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search: filter.search,
        page: filter.page.toString(),
        entries: filter.entries.toString(),
        status: filter.status,
        pinned_only: filter.pinned_only ? "true" : "false",
      });
      const response = await fetch(
        `http://127.0.0.1:8000/api/get_sites/${id}/?${params}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (!response.ok) throw new Error("Failed to fetch sites");

      const data = await response.json();
      setSites(data.data);
      setFilter((prev) => ({ ...prev, total_page: data.total_page }));
    } catch {
      setPSAlert({
        type: "error",
        title: "Error",
        message: "Failed to load sites",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSites();
  }, [id, filter.page, filter.entries, filter.status, filter.pinned_only]);

  // =========================
  // TOGGLE PIN
  // =========================
  const handleTogglePin = async (siteId: number, currentPin: boolean) => {
    try {
      const response = await fetch(
        `http://127.0.0.1:8000/api/toggle_pin/${siteId}/`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );
      if (response.ok) {
        setSites((prev) =>
          prev.map((s) =>
            s.site_id === siteId ? { ...s, is_pinned: !currentPin } : s,
          ),
        );
      }
    } catch {
      // Silent fail - refreshes on next fetch
    }
  };

  // =========================
  // CREATE SITE (Assessment Phase - Minimal Inputs)
  // =========================
  const handleCreateSite = async () => {
    if (!newSiteName || !id) return;

    try {
      const response = await fetch(`http://127.0.0.1:8000/api/create_site/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newSiteName,
          reforestation_area_id: parseInt(id),
          is_pinned: false,
          // ✅ DEFAULTS: Metrics calculated in other modules (GIS/monitoring)
          ndvi_value: null,
          total_area_hectares: 0,
          total_seedlings_planted: 0,
          center_coordinate: [0.0, 0.0],
          polygon_coordinates: [],
          marker_coordinate: null,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setPSAlert({
          type: "success",
          title: "Created",
          message: data.message,
        });
        fetchSites();
        setNewSiteName("");
        setIsCreateModalOpen(false);
      } else {
        setPSAlert({
          type: "failed",
          title: "Failed",
          message: data.error || "Create failed",
        });
      }
    } catch {
      setPSAlert({
        type: "error",
        title: "Error",
        message: "Something went wrong",
      });
    }
  };

  // =========================
  // UPDATE SITE NAME
  // =========================
  const handleUpdateSite = async () => {
    if (!updateSiteId || !updateSiteName) return;
    try {
      const response = await fetch(
        `http://127.0.0.1:8000/api/update_site/${updateSiteId}/`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name: updateSiteName }),
        },
      );
      const data = await response.json();

      if (response.ok) {
        setPSAlert({
          type: "success",
          title: "Updated",
          message: data.message,
        });
        fetchSites();
        setIsUpdateModalOpen(false);
        setUpdateSiteId(null);
        setUpdateSiteName("");
      } else {
        setPSAlert({
          type: "failed",
          title: "Failed",
          message: data.error || "Update failed",
        });
      }
    } catch {
      setPSAlert({
        type: "error",
        title: "Error",
        message: "Something went wrong",
      });
    }
  };

  // =========================
  // DELETE SITE
  // =========================
  const setDelete = (siteId: number) => {
    setDeleteId(siteId);
    setIsDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const response = await fetch(
        `http://127.0.0.1:8000/api/delete_site/${deleteId}/`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await response.json();

      if (response.ok) {
        setPSAlert({
          type: "success",
          title: "Deleted",
          message: data.message,
        });
        fetchSites();
      } else {
        setPSAlert({
          type: "failed",
          title: "Failed",
          message: data.message || "Delete failed",
        });
      }
    } catch {
      setPSAlert({
        type: "error",
        title: "Error",
        message: "Something went wrong",
      });
    }
    setIsDeleteModalOpen(false);
  };

  // =========================
  // HELPERS
  // =========================
  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "accepted":
        return "bg-blue-100 text-blue-800";
      case "rejected":
        return "bg-red-100 text-red-800";
      case "under_review":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-yellow-100 text-yellow-800";
    }
  };

  const getNDVIColor = (ndvi: number | null) => {
    if (ndvi === null) return "text-gray-500";
    if (ndvi >= 0.2 && ndvi <= 0.4) return "text-green-600 font-medium";
    if (ndvi < 0.2) return "text-red-600";
    return "text-yellow-600";
  };

  const getNDVITooltip = (ndvi: number | null) => {
    if (ndvi === null) return "NDVI pending satellite processing";
    if (ndvi >= 0.2 && ndvi <= 0.4)
      return "✅ Ideal for reforestation (degraded land/grassland)";
    if (ndvi < 0.2) return "⚠️ Likely non-plantable (concrete/water/rock)";
    return "⚠️ Dense vegetation (may not need reforestation)";
  };

  return (
    <div className="flex min-h-dvh bg-gray-50 justify-center flex-col">
      {/* ALERT */}
      {PSalert && (
        <PlantScopeAlert
          type={PSalert.type}
          title={PSalert.title}
          message={PSalert.message}
          onClose={() => setPSAlert(null)}
        />
      )}

      {/* DELETE MODAL */}
      <Delete_modal
        setIsDeleteModalOpen={setIsDeleteModalOpen}
        isDeleteModalOpen={isDeleteModalOpen}
        onDelete={handleDelete}
      />

      {/* HEADER */}
      <header className="bg-gradient-to-r from-[#0F4A2F] to-[#1a6b44] text-white py-3 px-6 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-center">
          <div className="flex items-center gap-3 mb-2">
            <Leaf size={32} className="text-green-300" />
            <h1 className="text-3xl md:text-4xl font-bold">Sites</h1>
          </div>
          <div className="flex items-center mt-5 mb-10 ml-auto gap-5">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center justify-center gap-2 bg-white hover:bg-[#0f4a2f] hover:text-white text-black h-10 px-3 py-2 ml-auto rounded-lg text-[.8rem] cursor-pointer"
            >
              <Plus size={20} /> Add new site
            </button>
            <button
              onClick={() => navigate(-1)}
              className="flex items-center justify-center gap-2 bg-white hover:bg-[#0f4a2f] hover:text-white text-black h-10 px-3 py-2 ml-auto rounded-lg text-[.8rem] cursor-pointer"
            >
              <ChevronLeft size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 p-8 max-w-10xl">
        {/* CREATE SITE MODAL (Assessment Phase - Name Only) */}
        {isCreateModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg w-96">
              <h2 className="font-bold text-lg mb-4">Create Site</h2>
              {/* <p className="text-sm text-gray-600 mb-4">
                NDVI, area, and seedlings will be calculated automatically after
                site creation via GIS processing.
              </p> */}
              <input
                type="text"
                placeholder="Site name *"
                value={newSiteName}
                onChange={(e) => setNewSiteName(e.target.value)}
                className="w-full border p-2 rounded mb-4"
                required
              />
              <div className="flex justify-end gap-2">
                <button
                  className="px-4 py-2 border rounded hover:bg-gray-50"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setNewSiteName("");
                  }}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  onClick={handleCreateSite}
                  disabled={!newSiteName.trim()}
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}

        {/* UPDATE SITE MODAL */}
        {isUpdateModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg w-96">
              <h2 className="font-bold text-lg mb-4">Update Site Name</h2>
              <input
                type="text"
                placeholder="Site name"
                value={updateSiteName}
                onChange={(e) => setUpdateSiteName(e.target.value)}
                className="w-full border p-2 rounded mb-4"
              />
              <div className="flex justify-end gap-2">
                <button
                  className="px-4 py-2 border rounded hover:bg-gray-50"
                  onClick={() => setIsUpdateModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  onClick={handleUpdateSite}
                >
                  Update
                </button>
              </div>
            </div>
          </div>
        )}

        {/* FILTERS */}
        <div className="flex items-center mb-7 gap-4 flex-wrap">
          <label className="text-sm">Show:</label>
          <select
            value={filter.entries}
            onChange={(e) =>
              setFilter((prev) => ({
                ...prev,
                entries: Number(e.target.value),
                page: 1,
              }))
            }
            className="border border-black p-2 rounded-md text-[.8rem]"
          >
            {[10, 25, 50, 100].map((e) => (
              <option key={e} value={e}>
                {e} entries
              </option>
            ))}
          </select>

          <select
            value={filter.status}
            onChange={(e) =>
              setFilter((prev) => ({
                ...prev,
                status: e.target.value,
                page: 1,
              }))
            }
            className="border border-black p-2 rounded-md text-[.8rem]"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="under_review">Under Review</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
            <option value="completed">Completed</option>
          </select>

          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filter.pinned_only}
              onChange={(e) =>
                setFilter((prev) => ({
                  ...prev,
                  pinned_only: e.target.checked,
                  page: 1,
                }))
              }
              className="rounded border-gray-300"
            />
            <Pin
              size={14}
              className={
                filter.pinned_only ? "text-green-600" : "text-gray-400"
              }
            />
            Pinned only
          </label>

          <input
            type="text"
            placeholder="Search sites..."
            value={filter.search}
            onChange={(e) =>
              setFilter((prev) => ({
                ...prev,
                search: e.target.value,
                page: 1,
              }))
            }
            onKeyDown={(e) => e.key === "Enter" && fetchSites()}
            className="border border-black rounded-md p-2 w-80 text-[.8rem] ml-auto"
          />
        </div>

        {/* TABLE */}
        <div className="overflow-x-auto shadow-lg border border-gray-200 rounded-lg">
          {loading && <LoaderPending />}
          <table className="min-w-full bg-white">
            <thead className="bg-[#0f4a2fe0] text-white">
              <tr>
                <th className="py-3 px-4 text-left text-sm font-semibold">
                  No
                </th>
                <th className="py-3 px-4 text-left text-sm font-semibold">
                  <Pin size={14} className="inline mr-1 -mt-0.5" />
                  Name
                </th>
                <th className="py-3 px-4 text-left text-sm font-semibold">
                  Status
                </th>
                <th className="py-3 px-4 text-left text-sm font-semibold">
                  <Target size={14} className="inline mr-1 -mt-0.5" />
                  Validation
                </th>
                <th className="py-3 px-4 text-left text-sm font-semibold">
                  <Droplets size={14} className="inline mr-1 -mt-0.5" />
                  NDVI
                </th>
                <th className="py-3 px-4 text-left text-sm font-semibold">
                  Created
                </th>
                <th className="py-3 px-4 text-left text-sm font-semibold">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {sites.length > 0 ? (
                sites.map((site, index) => {
                  const percent =
                    site.validation_progress.total_layers > 0
                      ? (site.validation_progress.validated_layers /
                          site.validation_progress.total_layers) *
                        100
                      : 0;

                  return (
                    <tr
                      key={site.site_id}
                      className={`${
                        index % 2 ? "bg-[#0F4A2F0D]" : ""
                      } hover:bg-gray-50 transition-colors ${
                        site.is_pinned
                          ? "border-l-4 border-green-600 bg-green-50/30"
                          : ""
                      }`}
                    >
                      <td className="py-3 px-4 text-sm">
                        {index + 1 + (filter.page - 1) * filter.entries}
                      </td>
                      <td className="py-3 px-4 font-medium text-sm">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              handleTogglePin(site.site_id, site.is_pinned)
                            }
                            className={`p-1 rounded hover:bg-gray-100 transition ${
                              site.is_pinned
                                ? "text-green-600"
                                : "text-gray-400 hover:text-gray-600"
                            }`}
                            title={site.is_pinned ? "Unpin site" : "Pin to top"}
                          >
                            {site.is_pinned ? (
                              <Pin size={16} className="fill-current" />
                            ) : (
                              <PinOff size={16} />
                            )}
                          </button>
                          {site.name}
                        </div>
                      </td>
                      <td className="py-3 px-4 capitalize">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                            site.status,
                          )}`}
                        >
                          {site.status.replace("_", " ")}
                        </span>
                      </td>

                      {/* Validation Progress (8-Layer MCDA) */}
                      <td className="py-3 px-4 w-44">
                        <div className="flex flex-col gap-1">
                          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-2 rounded-full transition-all duration-500 ${
                                site.validation_progress.rejected_layers > 0
                                  ? "bg-red-500"
                                  : site.validation_progress.is_complete
                                    ? "bg-green-600"
                                    : "bg-blue-500"
                              }`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-medium text-gray-700">
                              {site.validation_progress.validated_layers}/
                              {site.validation_progress.total_layers} layers
                            </span>
                            <span className="text-gray-500">
                              {Math.round(percent)}%
                            </span>
                          </div>
                          {site.validation_progress.rejected_layers > 0 && (
                            <div className="text-[10px] text-red-600 font-medium">
                              ⚠ {site.validation_progress.rejected_layers}{" "}
                              rejected
                            </div>
                          )}
                          {site.validation_progress.is_complete && (
                            <div className="text-[10px] text-green-600 font-medium">
                              ✓ Ready to finalize
                            </div>
                          )}
                        </div>
                      </td>

                      {/* NDVI Value (Scientific Threshold: 0.2–0.4) - READ ONLY */}
                      <td className="py-3 px-4">
                        <span
                          className={`text-sm font-medium ${getNDVIColor(
                            site.metrics.ndvi,
                          )}`}
                          title={getNDVITooltip(site.metrics.ndvi)}
                        >
                          {site.metrics.ndvi !== null
                            ? site.metrics.ndvi.toFixed(2)
                            : "—"}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-sm text-gray-600">
                        {new Date(site.created_at).toLocaleDateString()}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 flex gap-2">
                        <button
                          className="text-amber-700 cursor-pointer border border-amber-500 rounded-full p-1 hover:bg-amber-50 transition-colors"
                          onClick={() =>
                            navigate(
                              `${userPath}/analysis/multicriteria-analysis/${site.site_id}`,
                            )
                          }
                          title="Run 8-Layer MCDA Validation"
                        >
                          <Target size={16} />
                        </button>
                        <button
                          className="text-green-900 cursor-pointer border border-green-900 rounded-full p-1 hover:bg-green-50 transition-colors"
                          onClick={() =>
                            navigate(
                              `${userPath}/reforestation_analysis/site_analysis/${id}/${site.site_id}`,
                            )
                          }
                          title="View Site Details"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() =>
                            navigate(
                              `${userPath}/analysis/multicriteria-analysis/${site.site_id}/geo-spatial/`,
                            )
                          }
                          className="text-green-900 cursor-pointer border border-green-900 rounded-full p-1 hover:bg-green-50 transition-colors"
                          title="View on Map"
                        >
                          <Map size={16} />
                        </button>
                        <button
                          className="text-gray-700 cursor-pointer border border-gray-400 rounded-full p-1 hover:bg-gray-50 transition-colors"
                          onClick={() => {
                            setUpdateSiteId(site.site_id);
                            setUpdateSiteName(site.name);
                            setIsUpdateModalOpen(true);
                          }}
                          title="Edit Name"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => setDelete(site.site_id)}
                          className="text-red-500 cursor-pointer border border-red-500 rounded-full p-1 hover:bg-red-50 transition-colors"
                          title="Delete Site"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={7}
                    className="text-center py-10 text-gray-500 italic"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Leaf size={40} className="text-gray-300" />
                      <p>No sites found</p>
                      <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="text-green-600 hover:underline text-sm font-medium"
                      >
                        Create your first site
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        <div className="flex items-center gap-1 mt-5">
          <button
            disabled={filter.page <= 1}
            onClick={() =>
              setFilter((prev) => ({ ...prev, page: prev.page - 1 }))
            }
            className="px-2 py-1 border rounded-md ml-auto disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition"
          >
            <ChevronLeft size={19} />
          </button>
          {Array.from({ length: Math.min(filter.total_page, 5) }, (_, i) => {
            let pageNum = i + 1;
            if (filter.total_page > 5 && filter.page > 3) {
              pageNum = Math.min(filter.page - 2 + i, filter.total_page);
            }
            return (
              <button
                key={pageNum}
                onClick={() =>
                  setFilter((prev) => ({ ...prev, page: pageNum }))
                }
                className={`px-3 py-1 border rounded-md text-[.8rem] transition-colors ${
                  pageNum === filter.page
                    ? "bg-green-600 text-white border-green-600"
                    : "hover:bg-gray-50"
                }`}
              >
                {pageNum}
              </button>
            );
          })}
          {filter.total_page > 5 && filter.page < filter.total_page - 2 && (
            <>
              <span className="px-2 text-gray-400">...</span>
              <button
                onClick={() =>
                  setFilter((prev) => ({ ...prev, page: filter.total_page }))
                }
                className={`px-3 py-1 border rounded-md text-[.8rem] ${
                  filter.total_page === filter.page
                    ? "bg-green-600 text-white border-green-600"
                    : "hover:bg-gray-50"
                }`}
              >
                {filter.total_page}
              </button>
            </>
          )}
          <button
            disabled={filter.page >= filter.total_page}
            onClick={() =>
              setFilter((prev) => ({ ...prev, page: prev.page + 1 }))
            }
            className="px-2 py-1 border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition"
          >
            <ChevronRight size={19} />
          </button>
        </div>
      </main>
    </div>
  );
}
