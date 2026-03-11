import { useEffect, useState } from "react";
import {
  Trash2,
  Edit,
  Plus,
  ChevronRight,
  ChevronLeft,
  CloudLightningIcon,
  Map,
} from "lucide-react";
import PlantScopeAlert from "@/components/alert/PlantScopeAlert";
import Delete_modal from "@/components/layout/delete_modal";
import LoaderPending from "@/components/layout/loaderSmall";
import { useNavigate } from "react-router-dom";

interface Site {
  site_id: number;
  name: string;
  status: string;
  coordinates: any;
  polygon_coordinates: any;
  total_area_planted: number;
  total_seedling_planted: number;
  created_at: string;
}

interface Filter {
  search: string;
  entries: number;
  page: number;
  total_page: number;
  status: string;
}

export default function SitesComponent() {
  const [sites, setSites] = useState<Site[]>([]);
  const [filter, setFilter] = useState<Filter>({
    search: "",
    entries: 10,
    page: 1,
    total_page: 1,
    status: "All",
  });

  const [loading, setLoading] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [PSalert, setPSAlert] = useState<{
    type: "success" | "failed" | "error";
    title: string;
    message: string;
  } | null>(null);

  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  // =========================
  // FETCH SITES
  // =========================
  const fetchSites = async () => {
    setLoading(true);

    try {
      const params = new URLSearchParams({
        search: filter.search,
        page: filter.page.toString(),
        entries: filter.entries.toString(),
        status: filter.status,
      });

      const response = await fetch(
        `http://127.0.0.1:8000/api/get_sites/?${params}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) throw new Error("Failed to fetch sites");

      const data = await response.json();

      setSites(data.data);

      setFilter((prev) => ({
        ...prev,
        total_page: data.total_page || 1,
      }));
    } catch {
      setPSAlert({
        type: "error",
        title: "Error",
        message: "Failed to load sites.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSites();
  }, [filter.page, filter.entries, filter.status]);

  // =========================
  // DELETE SITE
  // =========================
  const setDelete = (id: number) => {
    setDeleteId(id);
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
        }
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
        message: "Something went wrong.",
      });
    }

    setIsDeleteModalOpen(false);
  };

  return (
    <div className="flex min-h-dvh bg-gray-50 justify-center">
      {PSalert && (
        <PlantScopeAlert
          type={PSalert.type}
          title={PSalert.title}
          message={PSalert.message}
          onClose={() => setPSAlert(null)}
        />
      )}

      <Delete_modal
        setIsDeleteModalOpen={setIsDeleteModalOpen}
        isDeleteModalOpen={isDeleteModalOpen}
        onDelete={handleDelete}
      />

      <main className="flex-1 p-8 max-w-7xl">
        {/* HEADER */}
        <div className="flex items-center mt-5 mb-10">
          <h1 className="text-3xl font-bold text-green-700">Sites</h1>

          <button
            onClick={() => navigate("/sites/create")}
            className="flex items-center gap-2 bg-[#0f4a2fe0] hover:bg-[#0f4a2f] text-white h-10 px-3 py-2 ml-auto rounded-lg text-[.8rem]"
          >
            <Plus size={20} /> Add new site
          </button>
        </div>

        {/* FILTER */}
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
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
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
            <option value="All">All</option>
            <option value="active">Active</option>
            <option value="planned">Planned</option>
            <option value="monitoring">Monitoring</option>
            <option value="maintenance">Maintenance</option>
          </select>

          <input
            type="text"
            placeholder="Search sites..."
            value={filter.search}
            onChange={(e) =>
              setFilter((prev) => ({ ...prev, search: e.target.value, page: 1 }))
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") fetchSites();
            }}
            className="border border-gray-300 rounded-md p-2 w-80 text-[.8rem] ml-auto"
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
                <th className="py-3 px-5 text-left">Total Area</th>
                <th className="py-3 px-5 text-left">Seedlings</th>
                <th className="py-3 px-5 text-left">Created</th>
                <th className="py-3 px-5 text-left">Actions</th>
              </tr>
            </thead>

            <tbody>
              {sites.length > 0 ? (
                sites.map((site, index) => (
                  <tr
                    key={site.site_id}
                    className={`${index % 2 ? "bg-[#0F4A2F0D]" : ""}`}
                  >
                    <td className="py-3 px-5">
                      {index + 1 + (filter.page - 1) * filter.entries}
                    </td>
                    <td className="py-3 px-5">{site.name}</td>
                    <td className="py-3 px-5">{site.status}</td>
                    <td className="py-3 px-5">{site.total_area_planted}</td>
                    <td className="py-3 px-5">{site.total_seedling_planted}</td>
                    <td className="py-3 px-5">{site.created_at}</td>
                    <td className="py-3 px-5 flex gap-2">
                        <button
                         
                          className="text-yellow-900 cursor-pointer border border-amber-500 rounded-full p-1"
                        >
                          <CloudLightningIcon size={18} />
                        </button>
                         <button
                         
                          className="text-green-900 cursor-pointer border border-green-900 rounded-full p-1"
                        >
                          <Map size={18} />
                        </button>

                      <button
                        onClick={() =>
                          navigate(`/sites/form/${site.site_id}`)
                        }
                        className="cursor-pointer"
                      >
                        <Edit size={18} />
                      </button>

                      <button
                        onClick={() => setDelete(site.site_id)}
                        className="text-red-500 cursor-pointer"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={7}
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
                className={`px-2 py-1 border rounded-md text-[.8rem] ${
                  p === filter.page ? "bg-green-600 text-white" : ""
                }`}
              >
                {p}
              </button>
            )
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