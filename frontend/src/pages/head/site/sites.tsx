import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import {
  Trash2,
  Edit,
  Plus,
  ChevronRight,
  ChevronLeft,
  CloudLightningIcon,
  Map,
  Leaf,
  Eye,
} from "lucide-react";
import PlantScopeAlert from "@/components/alert/PlantScopeAlert";
import Delete_modal from "@/components/layout/delete_modal";
import LoaderPending from "@/components/layout/loaderSmall";

interface SiteProgress {
  completed: number;
  rejected: number;
  total: number;
}

interface Site {
  site_id: number;
  name: string;
  status: string;
  created_at: string;
  progress: SiteProgress;
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
  const handleCreateSite = async () => {
    if (!newSiteName || !id) return;

    try {
      const response = await fetch(`http://127.0.0.1:8000/api/create_site/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: newSiteName, reforestation_area_id: id }),
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
      <header className="bg-gradient-to-r from-[#0F4A2F] to-[#1a6b44] text-white py-3 px-6 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-center">
          <div className="flex items-center gap-3 mb-2">
            <Leaf size={32} className="text-green-300" />
            <h1 className="text-3xl md:text-4xl font-bold">Sites</h1>
          </div>
          <div className="flex items-center mt-5 mb-5 ml-auto">
            <button
              onClick={() =>
                navigate(`/reforestation_analysis/site_analysis/${id}`)
              }
               className="flex items-center justify-center gap-2 bg-white hover:bg-[#0f4a2f] hover:text-white text-black h-10 px-3 py-2 ml-auto rounded-lg text-[.8rem] cursor-pointer"
            >
              <Plus size={20} /> Add new site
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1 p-8 max-w-10xl">
        {/* HEADER */}

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
                      className={`${index % 2 ? "bg-[#0F4A2F0D]" : ""}`}
                    >
                      <td className="py-3 px-5">
                        {index + 1 + (filter.page - 1) * filter.entries}
                      </td>
                      <td className="py-3 px-5">{site.name}</td>
                      <td className="py-3 px-5 capitalize">{site.status}</td>

                      <td className="py-3 px-5 w-56">
                        <div className="flex flex-col gap-2 w-56">
                          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                            <div
                              className={`h-3 rounded-full transition-all duration-500 ${site.progress.rejected > 0 ? "bg-red-500" : "bg-green-600"}`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium text-gray-700">
                              {site.progress.completed}/{site.progress.total}{" "}
                              Completed
                            </span>
                            <span className="text-gray-500">
                              {Math.round(percent)}%
                            </span>
                          </div>
                          {site.progress.rejected > 0 && (
                            <div className="text-[11px] text-red-600 font-medium">
                              {site.progress.rejected} layer rejected
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-5 text-sm text-gray-600">
                        {site.created_at}
                      </td>

                      <td className="py-3 px-5 flex gap-2">
                        <button
                          className="text-green-900 cursor-pointer border border-green-900 rounded-full p-1"
                          onClick={() => {
                            setUpdateSiteId(site.site_id);
                            setUpdateSiteName(site.name);
                            setIsUpdateModalOpen(true);
                          }}
                        >
                          <Eye size={18} />
                        </button>
                        <button className="text-green-900 cursor-pointer border border-green-900 rounded-full p-1">
                          <Map size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="text-center py-5 text-gray-500 italic"
                  >
                    No sites found
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
            className="px-2 py-1 border rounded-md ml-auto"
          >
            <ChevronLeft size={19} />
          </button>
          {Array.from({ length: filter.total_page }, (_, i) => i + 1).map(
            (p) => (
              <button
                key={p}
                onClick={() => setFilter((prev) => ({ ...prev, page: p }))}
                className={`px-2 py-1 border rounded-md text-[.8rem] ${p === filter.page ? "bg-green-600 text-white" : ""}`}
              >
                {p}
              </button>
            ),
          )}
          <button
            disabled={filter.page >= filter.total_page}
            onClick={() =>
              setFilter((prev) => ({ ...prev, page: prev.page + 1 }))
            }
            className="px-2 py-1 border rounded-md"
          >
            <ChevronRight size={19} />
          </button>
        </div>
      </main>
    </div>
  );
}
