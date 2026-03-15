import { useEffect, useState } from "react";
import {
  Trash2,
  Edit,
  Plus,
  ChevronRight,
  ChevronLeft,
  User,
  CheckCheckIcon,
  VerifiedIcon,
  Eye,
  Leaf,
} from "lucide-react";
import PlantScopeAlert from "@/components/alert/PlantScopeAlert";
import Delete_modal from "@/components/layout/delete_modal";
import LoaderPending from "@/components/layout/loaderSmall";
import { useNavigate } from "react-router-dom";
import { useUserRole } from "@/hooks/authorization";

interface ReforestationArea {
  reforestation_area_id: number;
  name: string;
  legality: string;
  safety: string;
  polygon_coordinate: any;
  coordinate: any;
  location: string;
  description: string;
  area_img: string | null;
  created_at: string;
}

interface Filter {
  search: string;
  entries: number;
  page: number;
  total_page: number;
  legality: string;
  safety: string;
}

export default function Reforestation_area_analysis() {
  const [areas, setAreas] = useState<ReforestationArea[]>([]);
  const [filter, setFilter] = useState<Filter>({
    search: "",
    entries: 10,
    page: 1,
    total_page: 1,
    legality: "legal",
    safety: "All",
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
  // FETCH AREAS
  // =========================
  const fetchAreas = async () => {
    setLoading(true);

    try {
      const params = new URLSearchParams({
        search: filter.search,
        page: filter.page.toString(),
        entries: filter.entries.toString(),
        legality: filter.legality,
        safety: filter.safety,
      });

      const response = await fetch(
        `http://127.0.0.1:8000/api/get_reforestation_areas/?${params}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) throw new Error("Failed");

      const data = await response.json();

      setAreas(data.data);

      setFilter((prev) => ({
        ...prev,
        total_page: data.total_page,
      }));
    } catch {
      setPSAlert({
        type: "error",
        title: "Error",
        message: "Failed to load reforestation areas.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAreas();
  }, [filter.page, filter.entries, filter.legality, filter.safety]);

  // =========================
  // DELETE
  // =========================
  const setDelete = (id: number) => {
    setDeleteId(id);
    setIsDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const response = await fetch(
        `http://127.0.0.1:8000/api/delete_reforestation_areas/${deleteId}/`,
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

        fetchAreas();
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

  return (
    <div className="flex min-h-dvh bg-gray-50 justify-center flex-col">
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
      <header className="bg-gradient-to-r from-[#0F4A2F] to-[#1a6b44] text-white py-3 px-6 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-center">
          <div className="flex items-center gap-3 mb-2">
            <Leaf size={32} className="text-green-300" />
            <h1 className="text-3xl md:text-4xl font-bold">
              Reforestation Areas
            </h1>
          </div>
          <div className="flex items-center mt-5 mb-10 ml-auto">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center justify-center gap-2 bg-white hover:bg-[#0f4a2f] hover:text-white text-black h-10 px-3 py-2 ml-auto rounded-lg text-[.8rem] cursor-pointer"
            >
              <ChevronLeft size={20} />
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1 p-8 max-w-409">
        {/* HEADER */}

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
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>

          <label>Safety:</label>

          <select
            value={filter.safety}
            onChange={(e) =>
              setFilter((prev) => ({
                ...prev,
                safety: e.target.value,
                page: 1,
              }))
            }
            className="border border-black p-2 rounded-md text-[.8rem]"
          >
            <option value="All">All</option>
            <option value="safe">Low Risk</option>
            <option value="slightly">Slightly Unsafe</option>
            <option value="moderate">Moderate Risk</option>
            <option value="danger">High Risk</option>
          </select>

          <input
            type="text"
            placeholder="Search reforestation areas..."
            value={filter.search}
            onChange={(e) =>
              setFilter((prev) => ({
                ...prev,
                search: e.target.value,
                page: 1,
              }))
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") fetchAreas();
            }}
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
                <th className="py-3 px-5 text-left">Location</th>
                <th className="py-3 px-5 text-left">Legality</th>
                <th className="py-3 px-5 text-left">Safety</th>
                <th className="py-3 px-5 text-left">Created</th>
                <th className="py-3 px-5 text-left">Actions</th>
              </tr>
            </thead>

            <tbody>
              {areas.length > 0 ? (
                areas.map((area, index) => (
                  <tr
                    key={area.reforestation_area_id}
                    className={`${index % 2 ? "bg-[#0F4A2F0D]" : ""}`}
                  >
                    <td className="py-3 px-5">
                      {index + 1 + (filter.page - 1) * filter.entries}
                    </td>

                    <td className="py-3 px-5">{area.name}</td>

                    <td className="py-3 px-5">{area.location}</td>

                    <td className="py-3 px-5">
                      {area.legality === "legal"
                        ? "Legal"
                        : area.legality === "pending"
                          ? "Pending"
                          : "Illegal"}
                    </td>

                    <td className="py-3 px-5">{area.safety}</td>

                    <td className="py-3 px-5">{area.created_at}</td>

                    <td className="py-3 px-5">
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            navigate(
                              `/${useruserRole}/legality-and-safety/${area.reforestation_area_id}`,
                            )
                          }
                          className="cursor-pointer"
                        >
                          <Eye size={18} />
                        </button>
                        <button
                          onClick={() =>
                            navigate(
                              `/${useruserRole}/reforestation_analysis/site_analysis/${area.reforestation_area_id}`,
                            )
                          }
                          className="cursor-pointer"
                        >
                          <VerifiedIcon size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={7}
                    className="text-center py-5 text-gray-500 italic"
                  >
                    No areas found
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
