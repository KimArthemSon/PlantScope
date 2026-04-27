import { useEffect, useState } from "react";
import { Trash2, Edit, Plus, ChevronRight, ChevronLeft, X } from "lucide-react";
import PlantScopeAlert from "@/components/alert/PlantScopeAlert";
import Delete_modal from "@/components/layout/delete_modal";
import { useNavigate } from "react-router-dom";
import LoaderPending from "@/components/layout/loaderSmall";
import { useUserRole } from "@/hooks/authorization";

interface ClassifiedArea {
  classified_area_id: number;
  name: string;
  land_classification_id: number;
  land_classification_name: string;
  barangay_id: number;
  barangay_name: string;
  description: string;
  created_at: string;
}

interface Filter {
  search: string;
  entries: number;
  page: number;
  total_page: number;
  land_classification_id: number | "";
  barangay_id: number | "";
}

interface LandClassification {
  land_classification_id: number;
  name: string;
}

interface Barangay {
  barangay_id: number;
  name: string;
}

export default function Classified_areas() {
  const [classifiedAreas, setClassifiedAreas] = useState<ClassifiedArea[]>([]);
  const [filter, setFilter] = useState<Filter>({
    search: "",
    entries: 10,
    page: 1,
    total_page: 1,
    land_classification_id: "",
    barangay_id: "",
  });
  const [landClassificationList, setLandClassificationList] = useState<LandClassification[]>([]);
  const [barangayList, setBarangayList] = useState<Barangay[]>([]);
  const [loading, setLoading] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [PSalert, setPSAlert] = useState<{
    type: "success" | "failed" | "error";
    title: string;
    message: string;
  } | null>(null);
  const [classifiedAreaIdDelete, setClassifiedAreaIdDelete] = useState<number | null>(null);
  const navigate = useNavigate();

  const { userRole } = useUserRole();
  const [useruserRole, setUseruserRole] = useState("");
  const token = localStorage.getItem("token");

  useEffect(() => {
    if (userRole === "treeGrowers" || userRole === "CityENROHead") {
      setUseruserRole("");
      return;
    }
    if (userRole === "DataManager") {
      setUseruserRole("/DataManager");
      return;
    }
  }, [userRole]);

  // Fetch filter options on mount
  useEffect(() => {
    async function fetchOptions() {
      try {
        const [lcRes, brRes] = await Promise.all([
          fetch("http://127.0.0.1:8000/api/get_land_classifications_list/?for_reforestation=false", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch("http://127.0.0.1:8000/api/get_barangay_list/", {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        const [lcData, brData] = await Promise.all([lcRes.json(), brRes.json()]);
        if (lcRes.ok && lcData.data) setLandClassificationList(lcData.data);
        if (brRes.ok && brData.data) setBarangayList(brData.data);
      } catch {
        // silently fail — filters will just be empty
      }
    }
    fetchOptions();
  }, []);

  const fetchClassifiedAreas = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search: filter.search,
        page: filter.page.toString(),
        entries: filter.entries.toString(),
      });
      if (filter.land_classification_id !== "")
        params.append("land_classification_id", filter.land_classification_id.toString());
      if (filter.barangay_id !== "")
        params.append("barangay_id", filter.barangay_id.toString());

      const response = await fetch(
        `http://127.0.0.1:8000/api/get_classified_areas/?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!response.ok) throw new Error("Failed to fetch classified areas");
      const data = await response.json();
      setClassifiedAreas(data.data);
      setFilter((prev) => ({ ...prev, total_page: data.total_page }));
    } catch {
      setPSAlert({ type: "error", title: "Failed", message: "Failed to load classified areas." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClassifiedAreas();
  }, [filter.page, filter.entries, filter.land_classification_id, filter.barangay_id]);

  const activeFilterCount =
    (filter.land_classification_id !== "" ? 1 : 0) +
    (filter.barangay_id !== "" ? 1 : 0);

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
      setPSAlert({ type: "failed", title: "Failed", message: data.message || "Failed to delete" });
      setIsDeleteModalOpen(false);
    }
  };

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

      <main className="flex-1 p-8 max-w-409">

        {/* ── Top bar: entries + search + add ── */}
        <div className="flex items-center mb-3 gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 whitespace-nowrap">Show entries:</label>
            <select
              value={filter.entries}
              onChange={(e) =>
                setFilter((prev) => ({ ...prev, entries: Number(e.target.value), page: 1 }))
              }
              className="border border-gray-300 p-2 rounded-md text-[.8rem]"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
           <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Filter by:
          </span>

          {/* Land Classification */}
          <div className="relative">
            <select
              value={filter.land_classification_id}
              onChange={(e) =>
                setFilter((prev) => ({
                  ...prev,
                  land_classification_id: e.target.value === "" ? "" : Number(e.target.value),
                  page: 1,
                }))
              }
              className={`border rounded-lg px-3 py-1.5 text-[.8rem] pr-8 appearance-none cursor-pointer transition-colors ${
                filter.land_classification_id !== ""
                  ? "border-green-500 bg-green-50 text-green-800 font-medium"
                  : "border-gray-300 text-gray-600"
              }`}
            >
              <option value="">All Land Classifications</option>
              {landClassificationList.map((lc) => (
                <option key={lc.land_classification_id} value={lc.land_classification_id}>
                  {lc.name}
                </option>
              ))}
            </select>
            {filter.land_classification_id !== "" && (
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 text-green-600 hover:text-green-800"
                onClick={() => setFilter((prev) => ({ ...prev, land_classification_id: "", page: 1 }))}
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Barangay */}
          <div className="relative">
            <select
              value={filter.barangay_id}
              onChange={(e) =>
                setFilter((prev) => ({
                  ...prev,
                  barangay_id: e.target.value === "" ? "" : Number(e.target.value),
                  page: 1,
                }))
              }
              className={`border rounded-lg px-3 py-1.5 text-[.8rem] pr-8 appearance-none cursor-pointer transition-colors ${
                filter.barangay_id !== ""
                  ? "border-green-500 bg-green-50 text-green-800 font-medium"
                  : "border-gray-300 text-gray-600"
              }`}
            >
              <option value="">All Barangays</option>
              {barangayList.map((b) => (
                <option key={b.barangay_id} value={b.barangay_id}>
                  {b.name}
                </option>
              ))}
            </select>
            {filter.barangay_id !== "" && (
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 text-green-600 hover:text-green-800"
                onClick={() => setFilter((prev) => ({ ...prev, barangay_id: "", page: 1 }))}
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Clear all active filters */}
          {activeFilterCount > 0 && (
            <button
              onClick={() =>
                setFilter((prev) => ({ ...prev, land_classification_id: "", barangay_id: "", page: 1 }))
              }
              className="text-[.75rem] text-red-500 hover:text-red-700 flex items-center gap-1 font-medium"
            >
              <X size={12} /> Clear filters ({activeFilterCount})
            </button>
          )}
          <input
            type="text"
            placeholder="Search classified areas..."
            value={filter.search}
            onChange={(e) => setFilter((prev) => ({ ...prev, search: e.target.value, page: 1 }))}
            onKeyDown={(e) => { if (e.key === "Enter") fetchClassifiedAreas(); }}
            className="border border-gray-300 rounded-md p-2 w-72 text-[.8rem] ml-auto"
          />
          <button
            onClick={() => navigate(`${useruserRole}/maintenance/classified_area_form/`)}
            className="flex items-center justify-center gap-2 bg-[#1a6b44] hover:bg-[#0f4a2f] text-white h-10 px-3 py-2 rounded-lg text-[.8rem] cursor-pointer whitespace-nowrap"
          >
            <Plus size={18} /> Add classified area
          </button>
        </div>

        {/* ── Table ── */}
        <div className="overflow-x-auto shadow-lg rounded-sm border border-gray-200">
          {loading && <LoaderPending />}
          <table className="relative min-w-full bg-white rounded-sm">
            <thead className="bg-[#0f4a2fe0] text-white">
              <tr>
                <th className="py-3 px-5 text-left text-[.9rem]">No</th>
                <th className="py-3 px-5 text-left text-[.9rem]">Name</th>
                <th className="py-3 px-5 text-left text-[.9rem]">Land Classification</th>
                <th className="py-3 px-5 text-left text-[.9rem]">Barangay</th>
                <th className="py-3 px-5 text-left text-[.9rem]">Description</th>
                <th className="py-3 px-5 text-left text-[.9rem]">Created At</th>
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
                    <td className="py-3 px-5 text-[.9rem] font-medium">{area.name}</td>
                    <td className="py-3 px-5 text-[.9rem]">
                      <span className="bg-green-100 text-green-800 text-[.75rem] font-medium px-2 py-0.5 rounded-full">
                        {area.land_classification_name}
                      </span>
                    </td>
                    <td className="py-3 px-5 text-[.9rem]">{area.barangay_name}</td>
                    <td className="py-3 px-5 text-[.9rem] break-words max-w-60">
                      {area.description}
                    </td>
                    <td className="py-3 px-5 text-[.9rem] whitespace-nowrap">
                      {area.created_at}
                    </td>
                    <td className="py-3 px-5">
                      <div className="flex gap-1">
                        <button
                          onClick={() =>
                            navigate(`${useruserRole}/maintenance/classified_area_form/${area.classified_area_id}`)
                          }
                          className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 cursor-pointer transition-colors"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => setDelete(area.classified_area_id)}
                          className="p-2 rounded-lg hover:bg-red-50 text-red-500 cursor-pointer transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-400 italic text-sm">
                    No classified areas found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        <div className="flex items-center gap-1 mt-5 w-full">
          <button
            disabled={filter.page <= 1}
            onClick={() => setFilter((prev) => ({ ...prev, page: prev.page - 1 }))}
            className="px-2 py-1 border rounded-md text-gray-700 hover:bg-gray-100 ml-auto cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={19} />
          </button>

          {Array.from({ length: filter.total_page }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setFilter((prev) => ({ ...prev, page: p }))}
              className={`px-2 py-1 border rounded-md cursor-pointer text-[.8rem] ${
                p === filter.page ? "bg-green-600 text-white border-green-600" : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              {p}
            </button>
          ))}

          <button
            disabled={filter.page >= filter.total_page}
            onClick={() => setFilter((prev) => ({ ...prev, page: prev.page + 1 }))}
            className="px-2 py-1 border rounded-md text-gray-700 hover:bg-gray-100 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronRight size={19} />
          </button>
        </div>
      </main>
    </div>
  );
}
