import { useEffect, useState } from "react";
import { Trash2, Edit, Plus, ChevronRight, ChevronLeft } from "lucide-react";
import PlantScopeAlert from "@/components/alert/PlantScopeAlert";
import Delete_modal from "@/components/layout/delete_modal";
import { useNavigate } from "react-router-dom";
import LoaderPending from "@/components/layout/loaderSmall";

interface ClassifiedArea {
  classified_area_id: number;
  name: string;
  land_classification_id: number;
  land_classification_name: string;
  description: string;
  created_at: string;
}

interface Filter {
  search: string;
  entries: number;
  page: number;
  total_page: number;
}

export default function Classified_areas() {
  const [classifiedAreas, setClassifiedAreas] = useState<ClassifiedArea[]>([]);
  const [filter, setFilter] = useState<Filter>({
    search: "",
    entries: 10,
    page: 1,
    total_page: 1,
  });
  const [loading, setLoading] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [PSalert, setPSAlert] = useState<{
    type: "success" | "failed" | "error";
    title: string;
    message: string;
  } | null>(null);
  const [classifiedAreaIdDelete, setClassifiedAreaIdDelete] = useState<
    number | null
  >(null);

  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  // Fetch classified areas
  const fetchClassifiedAreas = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search: filter.search,
        page: filter.page.toString(),
        entries: filter.entries.toString(),
      });

      const response = await fetch(
        `http://127.0.0.1:8000/api/get_classified_areas/?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!response.ok) throw new Error("Failed to fetch classified areas");

      const data = await response.json();
      setClassifiedAreas(data.data);
      
      setFilter((prev) => ({ ...prev, total_page: data.total_page }));
    } catch (err) {
      setPSAlert({
        type: "error",
        title: "Failed",
        message: "Failed to load classified areas.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClassifiedAreas();
  }, [filter.page, filter.entries]);

  const setDelete = (id: number) => {
    setClassifiedAreaIdDelete(id);
    setIsDeleteModalOpen(true);
  };
  
  const handleDelete = async () => {
    if (!classifiedAreaIdDelete) return;

    const response = await fetch(
      `http://127.0.0.1:8000/api/delete_classified_area/${classifiedAreaIdDelete}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
    );
    const data = await response.json();
    if (response.ok) {
      setPSAlert({ type: "success", title: "Deleted", message: data.message });
      setIsDeleteModalOpen(false);
      fetchClassifiedAreas();
    } else {
      setPSAlert({
        type: "failed",
        title: "Failed",
        message: data.message || "Failed to delete",
      });
      setIsDeleteModalOpen(false);
    }
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

      <main className="flex-1 p-8 max-w-409">
        {/* Header */}
        <div className="flex items-center mt-5 mb-10">
          <h1 className="text-3xl font-bold text-green-700">
            Classified Areas
          </h1>
          <button
            onClick={() => navigate("/maintenance/classified_area_form/")}
            className="flex items-center gap-2 bg-[#0f4a2fe0] hover:bg-[#0f4a2f] text-white h-10 px-3 py-2 ml-auto rounded-lg text-[.8rem] cursor-pointer"
          >
            <Plus size={20} /> Add new classified area
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center mb-7 gap-4">
          <label>Show entries: </label>
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

          <input
            type="text"
            placeholder="Search classified areas..."
            value={filter.search}
            onChange={(e) =>
              setFilter((prev) => ({
                ...prev,
                search: e.target.value,
                page: 1,
              }))
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") fetchClassifiedAreas();
            }}
            className="border border-gray-300 rounded-md p-2 w-80 text-[.8rem] ml-auto"
          />
        </div>

        {/* Table */}
        <div className="overflow-x-auto shadow-lg rounded-sm border border-gray-200">
          {loading && <LoaderPending />}
          <table className="relative min-w-full bg-white rounded-sm">
            <thead className="bg-[#0f4a2fe0] text-white">
              <tr>
                <th className="py-3 px-5 text-left text-[.9rem]">No</th>
                <th className="py-3 px-5 text-left text-[.9rem]">Name</th>
                <th className="py-3 px-5 text-left text-[.9rem]">
                  Land Classification
                </th>
                <th className="py-3 px-5 text-left text-[.9rem]">
                  Description
                </th>
                <th className="py-3 px-5 text-left text-[.9rem]">Created_at</th>
                <th className="py-3 px-5 text-left text-[.9rem]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {classifiedAreas.length > 0 ? (
                classifiedAreas.map((area, index) => (
                  <tr
                    key={area.classified_area_id}
                    className={`${index % 2 === 0 ? "" : "bg-[#0F4A2F0D]"} transition`}
                  >
                    <td className="py-3 px-5 text-[.9rem]">
                      {index + 1 + (filter.page - 1) * filter.entries}
                    </td>
                    <td className="py-3 px-5">{area.name}</td>
                    <td className="py-3 px-5 text-[.9rem]">
                      {area.land_classification_name}
                    </td>
                    <td className="py-3 px-5 text-[.9rem] wrap-break-word max-w-75">
                      {area.description}
                    </td>
                    <td className="py-3 px-5 text-[.9rem]">
                      {area.created_at}
                    </td>
                    <td className="py-3 px-5">
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            navigate(
                              `/maintenance/classified_area_form/${area.classified_area_id}`,
                            )
                          }
                          className="text-black px-3 py-1 rounded-md flex items-center gap-1 cursor-pointer"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => setDelete(area.classified_area_id)}
                          className="text-red-500 px-3 py-1 rounded-md flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="text-center py-5 text-gray-500 italic"
                  >
                    No classified areas found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center gap-1 mt-5 w-full">
          <button
            disabled={filter.page <= 1}
            onClick={() =>
              setFilter((prev) => ({ ...prev, page: prev.page - 1 }))
            }
            className="px-2 py-1 border rounded-md text-gray-700 hover:bg-gray-100 ml-auto cursor-pointer"
          >
            <ChevronLeft size={19} />
          </button>

          {Array.from({ length: filter.total_page }, (_, i) => i + 1).map(
            (p) => (
              <button
                key={p}
                onClick={() => setFilter((prev) => ({ ...prev, page: p }))}
                className={`px-2 py-1 border rounded-md cursor-pointer text-[.8rem] ${p === filter.page ? "bg-green-600 text-white" : "text-gray-700 hover:bg-gray-100"}`}
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
            className="px-2 py-1 border rounded-md text-gray-700 hover:bg-gray-100 cursor-pointer"
          >
            <ChevronRight size={19} />
          </button>
        </div>
      </main>
    </div>
  );
}
