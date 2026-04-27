import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Trash2,
  Edit,
  Plus,
  ChevronRight,
  ChevronLeft,
  Leaf,
  Eye,
  Droplets,
  Ruler,
  Target,
  Pin,
  PinOff,
} from "lucide-react";
import PlantScopeAlert from "@/components/alert/PlantScopeAlert";
import Delete_modal from "@/components/layout/delete_modal";
import LoaderPending from "@/components/layout/loaderSmall";
import { useUserRole } from "@/hooks/authorization";

// =========================
// INTERFACES (Aligned with Backend v2.0)
// =========================
interface ValidationProgress {
  validated_layers: number;
  total_layers: number; // Always 8
  rejected_layers: number;
  is_complete: boolean;
}

interface SiteMetrics {
  ndvi: number | null;
  area_hectares: number;
  seedlings: number;
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
    status: "accepted",
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

      <main className="flex-1 p-8 max-w-10xl">
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
          {userRole !== "DataManager" && (
            <button
              onClick={() =>
                navigate(
                  `${userPath}/analysis/multicriteria-analysis/new?areaId=${id}`,
                )
              }
              className="flex items-center justify-center gap-2 bg-[#0f4a2f] hover:bg-[#0a3321] hover:text-white text-white h-10 px-3 py-2 rounded-lg text-[.8rem] cursor-pointer"
            >
              <Plus size={20} /> Add new site
            </button>
          )}
        </div>

        {/* TABLE */}
        <div className="overflow-x-auto shadow-lg border border-gray-200 rounded-lg">
          {loading && <LoaderPending />}
          <table className="min-w-full bg-white">
            <thead className="bg-[#0f4a2fe0] text-white">
              <tr>
                <th className="py-3 px-5 text-left text-sm font-semibold">
                  No
                </th>
                <th className="py-3 px-5 text-left text-sm font-semibold">
                  <Pin size={14} className="inline mr-1 -mt-0.5" />
                  Name
                </th>
                <th className="py-3 px-5 text-left text-sm font-semibold">
                  Status
                </th>
                <th className="py-3 px-5 text-left text-sm font-semibold">
                  <Target size={14} className="inline mr-1 -mt-0.5" />
                  Validation
                </th>

                <th className="py-3 px-5 text-left text-sm font-semibold">
                  <Ruler size={14} className="inline mr-1 -mt-0.5" />
                  Area (ha)
                </th>
                <th className="py-3 px-5 text-left text-sm font-semibold">
                  Created
                </th>
                <th className="py-3 px-5 text-left text-sm font-semibold">
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
                      <td className="py-3 px-5 text-sm">
                        {index + 1 + (filter.page - 1) * filter.entries}
                      </td>
                      <td className="py-3 px-5 font-medium text-sm">
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
                      <td className="py-3 px-5 capitalize">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                            site.status,
                          )}`}
                        >
                          {site.status.replace("_", " ")}
                        </span>
                      </td>

                      {/* Validation Progress */}
                      <td className="py-3 px-5 w-48">
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

                      {/* Area */}
                      <td className="py-3 px-5">
                        <span className="text-sm font-medium text-gray-700">
                          {site.metrics.area_hectares.toFixed(2)} ha
                        </span>
                      </td>

                      <td className="py-3 px-5 text-sm text-gray-600">
                        {new Date(site.created_at).toLocaleDateString()}
                      </td>

                      <td className="py-3 px-5 flex gap-2">
                        <button
                          className="text-green-900 cursor-pointer border border-green-900 rounded-full p-1 hover:bg-green-50 transition-colors"
                          onClick={() =>
                            navigate(
                              `${userPath}/official-reforestation/site/${id}/information/${site.site_id}`,
                            )
                          }
                          title="View Details"
                        >
                          <Eye size={16} />
                        </button>
                        {userRole !== "DataManager" && (
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
