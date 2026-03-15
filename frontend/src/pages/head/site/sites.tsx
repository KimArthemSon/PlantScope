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
  BarChart3,
  Droplets,
} from "lucide-react";
import PlantScopeAlert from "@/components/alert/PlantScopeAlert";
import Delete_modal from "@/components/layout/delete_modal";
import LoaderPending from "@/components/layout/loaderSmall";
import { useUserRole } from "@/hooks/authorization";

interface SiteProgress {
  completed: number;
  rejected: number;
  total: number;
}

interface SiteMetrics {
  survival_rate: number;
  total_score: number;
}

interface Site {
  site_id: number;
  name: string;
  status: string;
  created_at: string;
  progress: SiteProgress;
  metrics: SiteMetrics;
}

interface Filter {
  search: string;
  entries: number;
  page: number;
  total_page: number;
  status: string;
}

export default function SitesForArea() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const [sites, setSites] = useState<Site[]>([]);
  const [filter, setFilter] = useState<Filter>({
    search: "",
    entries: 10,
    page: 1,
    total_page: 1,
    status: "All",
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

  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [updateSiteName, setUpdateSiteName] = useState("");
  const [updateSiteId, setUpdateSiteId] = useState<number | null>(null);

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
  }, [id, filter.page, filter.entries, filter.status]);

  // =========================
  // CREATE SITE
  // =========================

  const { userRole, isLoading } = useUserRole();
  const [useruserRole, setUseruserRole] = useState("");

  useEffect(() => {
    if (userRole === "treeGrowers" || userRole === "CityENROHead") {
      setUseruserRole("");
      return;
    }

    if (userRole === "GISSpecialist") {
      setUseruserRole("GISS");
      return;
    }

    if (userRole === "DataManager") {
      setUseruserRole("DataManager");
      return;
    }
  }, [userRole]);

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
          coordinates: {},
          polygon_coordinates: {},
          total_area_planted: 0,
          total_seedling_planted: 0,
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

  // Helper: Get color for score/rate
  const getMetricColor = (
    value: number,
    max: number,
    type: "score" | "rate",
  ) => {
    const percent = (value / max) * 100;
    if (percent >= 80) return "text-green-600";
    if (percent >= 50) return "text-yellow-600";
    return "text-red-600";
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
          <div className="flex items-center mt-5 mb-5 ml-auto">
            {userRole != "DataManager" && (
              <button
                onClick={() =>
                  navigate(
                    `/${useruserRole}/reforestation_analysis/site_analysis/${id}`,
                  )
                }
                className="flex items-center justify-center gap-2 bg-white hover:bg-[#0f4a2f] hover:text-white text-black h-10 px-3 py-2 ml-auto rounded-lg text-[.8rem] cursor-pointer"
              >
                <Plus size={20} /> Add new site
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 p-8 max-w-10xl">
        {/* CREATE SITE MODAL */}
        {isCreateModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg w-96">
              <h2 className="font-bold text-lg mb-4">Create Site</h2>
              <input
                type="text"
                placeholder="Site name"
                value={newSiteName}
                onChange={(e) => setNewSiteName(e.target.value)}
                className="w-full border p-2 rounded mb-4"
              />
              <div className="flex justify-end gap-2">
                <button
                  className="px-4 py-2 border rounded"
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 bg-green-600 text-white rounded"
                  onClick={handleCreateSite}
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
                  className="px-4 py-2 border rounded"
                  onClick={() => setIsUpdateModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 bg-green-600 text-white rounded"
                  onClick={handleUpdateSite}
                >
                  Update
                </button>
              </div>
            </div>
          </div>
        )}

        {/* FILTERS */}
        <div className="flex items-center mb-7 gap-4">
          <label>Show entries:</label>
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
                {e}
              </option>
            ))}
          </select>

          <label>Status:</label>
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
            {[
              "All",
              "pending",
              "official",
              "rejected",
              "completed",
              "re-analysis",
            ].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

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
        <div className="overflow-x-auto shadow-lg border border-gray-200">
          {loading && <LoaderPending />}
          <table className="min-w-full bg-white">
            <thead className="bg-[#0f4a2fe0] text-white">
              <tr>
                <th className="py-3 px-5 text-left">No</th>
                <th className="py-3 px-5 text-left">Name</th>
                <th className="py-3 px-5 text-left">Status</th>
                <th className="py-3 px-5 text-left">Progress</th>
                <th className="py-3 px-5 text-left">
                  <div className="flex items-center gap-1">
                    <Droplets size={14} />
                    Survival Rate
                  </div>
                </th>
                <th className="py-3 px-5 text-left">
                  <div className="flex items-center gap-1">
                    <BarChart3 size={14} />
                    Total Score
                  </div>
                </th>
                <th className="py-3 px-5 text-left">Created</th>
                <th className="py-3 px-5 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sites.length > 0 ? (
                sites.map((site, index) => {
                  const percent =
                    site.progress.total > 0
                      ? (site.progress.completed / site.progress.total) * 100
                      : 0;

                  return (
                    <tr
                      key={site.site_id}
                      className={`${index % 2 ? "bg-[#0F4A2F0D]" : ""} hover:bg-gray-50 transition-colors`}
                    >
                      <td className="py-3 px-5">
                        {index + 1 + (filter.page - 1) * filter.entries}
                      </td>
                      <td className="py-3 px-5 font-medium">{site.name}</td>
                      <td className="py-3 px-5 capitalize">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            site.status === "completed"
                              ? "bg-green-100 text-green-800"
                              : site.status === "rejected"
                                ? "bg-red-100 text-red-800"
                                : site.status === "official"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {site.status}
                        </span>
                      </td>

                      <td className="py-3 px-5 w-48">
                        <div className="flex flex-col gap-1">
                          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-2 rounded-full transition-all duration-500 ${
                                site.progress.rejected > 0
                                  ? "bg-red-500"
                                  : "bg-green-600"
                              }`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-medium text-gray-700">
                              {site.progress.completed}/{site.progress.total}
                            </span>
                            <span className="text-gray-500">
                              {Math.round(percent)}%
                            </span>
                          </div>
                          {site.progress.rejected > 0 && (
                            <div className="text-[10px] text-red-600 font-medium">
                              ⚠ {site.progress.rejected} rejected
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Survival Rate */}
                      <td className="py-3 px-5">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                site.metrics.survival_rate >= 80
                                  ? "bg-green-500"
                                  : site.metrics.survival_rate >= 50
                                    ? "bg-yellow-500"
                                    : "bg-red-500"
                              }`}
                              style={{
                                width: `${site.metrics.survival_rate}%`,
                              }}
                            />
                          </div>
                          <span
                            className={`text-sm font-medium ${getMetricColor(site.metrics.survival_rate, 100, "rate")}`}
                          >
                            {site.metrics.survival_rate.toFixed(1)}%
                          </span>
                        </div>
                      </td>

                      {/* Total Score */}
                      <td className="py-3 px-5">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                site.metrics.total_score >= 80
                                  ? "bg-green-500"
                                  : site.metrics.total_score >= 50
                                    ? "bg-yellow-500"
                                    : "bg-red-500"
                              }`}
                              style={{ width: `${site.metrics.total_score}%` }}
                            />
                          </div>
                          <span
                            className={`text-sm font-medium ${getMetricColor(site.metrics.total_score, 100, "score")}`}
                          >
                            {site.metrics.total_score.toFixed(1)}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-5 text-sm text-gray-600">
                        {new Date(site.created_at).toLocaleDateString()}
                      </td>

                      <td className="py-3 px-5 flex gap-2">
                        <button
                          className="text-green-900 cursor-pointer border border-green-900 rounded-full p-1 hover:bg-green-50 transition-colors"
                          onClick={() => {
                            setUpdateSiteId(site.site_id);
                            setUpdateSiteName(site.name);
                            setIsUpdateModalOpen(true);
                          }}
                          title="View Details"
                        >
                          <Eye size={16} />
                        </button>
                        {userRole != "DataManager" && (
                          <button
                            className="text-green-900 cursor-pointer border border-green-900 rounded-full p-1 hover:bg-green-50 transition-colors"
                            onClick={() =>
                              navigate(
                                `/${useruserRole}/analysis/multicriteria-analysis/${site.site_id}/geo-spatial/`,
                              )
                            }
                            title="Analyze Site"
                          >
                            <Map size={16} />
                          </button>
                        )}

                        {userRole != "DataManager" && (
                          <button
                            className="text-red-600 cursor-pointer border border-red-600 rounded-full p-1 hover:bg-red-50 transition-colors"
                            onClick={() => setDelete(site.site_id)}
                            title="Delete Site"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={8}
                    className="text-center py-10 text-gray-500 italic"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Leaf size={40} className="text-gray-300" />
                      <p>No sites found</p>
                      <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="text-green-600 hover:underline text-sm"
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
            className="px-2 py-1 border rounded-md ml-auto disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            <ChevronLeft size={19} />
          </button>
          {Array.from({ length: Math.min(filter.total_page, 5) }, (_, i) => {
            // Show first 5 pages or centered around current page
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
            className="px-2 py-1 border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            <ChevronRight size={19} />
          </button>
        </div>
      </main>
    </div>
  );
}
