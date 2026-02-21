import { useEffect, useState } from "react";
import {
  Trash2,
  Edit,
  Plus,
  ChevronRight,
  ChevronLeft,
  Delete,
  Info,
} from "lucide-react";
import PlantScopeAlert from "../../../components/alert/PlantScopeAlert";
import Delete_modal from "../../../components/layout/delete_modal";
import { useNavigate } from "react-router-dom";
import LoaderPending from "../../../components/layout/loaderSmall";

interface Barangay {
  barangay_id: number;
  name: string;
  description: string;
  coordinate: any;
  created_at: string;
}

interface BarangayForm {
  name: string;
  description: string;
  coordinate: string; // JSON as string for input simplicity
}

interface Filter {
  search: string;
  entries: number;
  page: number;
  total_page: number;
}

export default function Barangays() {
  const [barangays, setBarangays] = useState<Barangay[]>([]);
  const [barangay, setBarangay] = useState<BarangayForm>({
    name: "",
    description: "",
    coordinate: '{"lat":0,"lng":0}',
  });

  const [filter, setFilter] = useState<Filter>({
    search: "",
    entries: 10,
    page: 1,
    total_page: 1,
  });

  const [isOpenAddEditModal, setIsOpenAddEditModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form_loading, setForm_loading] = useState(false);
  const [editBarangayId, setEditBarangayId] = useState<number>(0);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [action, setAction] = useState<"Add" | "Edit">("Add");
  const [PSalert, setPSAlert] = useState<{
    type: "success" | "failed" | "error";
    title: string;
    message: string;
  } | null>(null);

  const [barangayIdDelete, setBarangayIdDelete] = useState<number | null>(
    null
  );

  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const inputWrapper =
    "flex items-center border border-black rounded-md mt-2 p-1 " +
    "focus-within:border-green-700 focus-within:ring-2 " +
    "focus-within:ring-green-300 transition-all";
  const inputField =
    "flex-1 text-[1rem] p-2 ml-4 outline-none bg-transparent";

  // ------------------ Fetch Barangays ------------------
  const fetchBarangays = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search: filter.search,
        page: filter.page.toString(),
        entries: filter.entries.toString(),
      });

      const response = await fetch(
        `http://127.0.0.1:8000/api/get_barangays/?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) throw new Error("Failed to fetch barangays.");
      const data = await response.json();
      setBarangays(data.data);
      setFilter((prev) => ({ ...prev, total_page: data.total_page }));
    } catch (err) {
      setPSAlert({
        type: "error",
        title: "Failed",
        message: "Failed to load barangays.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBarangays();
  }, [filter.page, filter.entries]);

  const setDelete = (id: number) => {
    setBarangayIdDelete(id);
    setIsDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!barangayIdDelete) return;
    const response = await fetch(
      `http://127.0.0.1:8000/api/delete_barangay/${barangayIdDelete}/`,
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
      setIsDeleteModalOpen(false);
      fetchBarangays();
    } else {
      setPSAlert({
        type: "failed",
        title: "Failed",
        message: "Failed to delete barangay.",
      });
      setIsDeleteModalOpen(false);
    }
  };

  const handleSubmit = (e: any) => {
    e.preventDefault();
    action === "Add" ? handleAdd() : handleEdit();
  };

  const handleAdd = async () => {
    try {
      setForm_loading(true);
      if (form_loading) return;

      const res = await fetch("http://127.0.0.1:8000/api/create_barangay/", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          ...barangay,
          coordinate: JSON.parse(barangay.coordinate),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPSAlert({ type: "error", title: "Error", message: data.error });
        setForm_loading(false);
        return;
      }
      setPSAlert({ type: "success", title: "Success", message: "Barangay created successfully!" });
      setForm_loading(false);
      setIsOpenAddEditModal(false);
      fetchBarangays();
    } catch (e: any) {
      setPSAlert({ type: "error", title: "Error", message: e.error });
      setForm_loading(false);
    }
  };

  const handleEdit = async () => {
    try {
      setForm_loading(true);
      if (form_loading) return;

      const res = await fetch(
        `http://127.0.0.1:8000/api/update_barangay/${editBarangayId}/`,
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            ...barangay,
            coordinate: JSON.parse(barangay.coordinate),
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setPSAlert({ type: "error", title: "Error", message: data.error });
        setForm_loading(false);
        return;
      }
      setPSAlert({ type: "success", title: "Success", message: "Barangay updated successfully!" });
      setForm_loading(false);
      setIsOpenAddEditModal(false);
      fetchBarangays();
    } catch (e: any) {
      setPSAlert({ type: "error", title: "Error", message: e.error });
      setForm_loading(false);
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
          <h1 className="text-3xl font-bold text-green-700">Barangays</h1>
          <button
            onClick={() => {
              setIsOpenAddEditModal(true);
              setAction("Add");
              setBarangay({ name: "", description: "", coordinate: '{"lat":0,"lng":0}' });
            }}
            className="flex items-center justify-center gap-2 bg-[#0f4a2fe0] hover:bg-[#0f4a2f] text-white h-10 px-3 py-2 ml-auto rounded-lg text-[.8rem] cursor-pointer"
          >
            <Plus size={20} /> Add new Barangay
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center mb-7 gap-4">
          <label>Show entries: </label>
          <select
            value={filter.entries}
            onChange={(e) =>
              setFilter((prev) => ({ ...prev, entries: Number(e.target.value), page: 1 }))
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
            placeholder="Search Barangays..."
            value={filter.search}
            onChange={(e) => setFilter((prev) => ({ ...prev, search: e.target.value, page: 1 }))}
            onKeyDown={(e) => e.key === "Enter" && fetchBarangays()}
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
                <th className="py-3 px-5 text-left text-[.9rem]">Description</th>
                <th className="py-3 px-5 text-left text-[.9rem]">Coordinate</th>
                <th className="py-3 px-5 text-left text-[.9rem]">Created_at</th>
                <th className="py-3 px-5 text-left text-[.9rem]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {barangays.length > 0 ? (
                barangays.map((b, index) => (
                  <tr
                    key={b.barangay_id}
                    className={`${index % 2 === 0 ? "" : "bg-[#0F4A2F0D]"} transition`}
                  >
                    <td className="py-3 px-5 text-[.9rem]">{index + 1 + (filter.page - 1) * filter.entries}</td>
                    <td className="py-3 px-5">{b.name}</td>
                    <td className="py-3 px-5">{b.description}</td>
                    <td className="py-3 px-5">{JSON.stringify(b.coordinate)}</td>
                    <td className="py-3 px-5 text-[.9rem]">{b.created_at}</td>
                    <td className="py-3 px-5">
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setIsOpenAddEditModal(true);
                            setEditBarangayId(b.barangay_id);
                            setAction("Edit");
                            setBarangay({
                              name: b.name,
                              description: b.description,
                              coordinate: JSON.stringify(b.coordinate),
                            });
                          }}
                          className="text-black px-3 py-1 rounded-md flex items-center gap-1 cursor-pointer"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => setDelete(b.barangay_id)}
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
                  <td colSpan={6} className="text-center py-5 text-gray-500 italic">
                    No Barangays found.
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
            onClick={() => setFilter((prev) => ({ ...prev, page: prev.page - 1 }))}
            className="px-2 py-1 border rounded-md text-gray-700 hover:bg-gray-100 ml-auto cursor-pointer"
          >
            <ChevronLeft size={19} />
          </button>

          {Array.from({ length: filter.total_page }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setFilter((prev) => ({ ...prev, page: p }))}
              className={`px-2 py-1 border rounded-md cursor-pointer text-[.8rem] ${
                p === filter.page ? "bg-green-600 text-white" : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              {p}
            </button>
          ))}

          <button
            disabled={filter.page >= filter.total_page}
            onClick={() => setFilter((prev) => ({ ...prev, page: prev.page + 1 }))}
            className="px-2 py-1 border rounded-md text-gray-700 hover:bg-gray-100 cursor-pointer"
          >
            <ChevronRight size={19} />
          </button>
        </div>
      </main>

      {/* Add/Edit Modal */}
      <form
        className={`fixed inset-0 z-10 flex items-center justify-center bg-black/50 transition-opacity duration-300 ${
          isOpenAddEditModal ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onSubmit={handleSubmit}
      >
        {form_loading && <LoaderPending />}
        <div
          className={`flex flex-col items-center gap-2 bg-white rounded-lg p-0 w-100 text-center shadow-lg transform transition-all duration-300 ${
            isOpenAddEditModal ? "scale-100 opacity-100" : "scale-95 opacity-0"
          }`}
        >
          <div className="flex justify-items-start items-center gap-10 w-full bg-green-600 rounded-t-lg p-2">
            <Delete size={66} className="text-white bg-green-500 p-3 rounded-full mb-2" />
            <h2 className="text-lg font-semibold text-white">{action} Barangay</h2>
          </div>

          <div className="flex flex-col p-6 w-full gap-5">
            <div className="flex flex-col">
              <label className="font-bold text-[1rem] mr-auto">Name:</label>
              <div className={inputWrapper}>
                <Info size={20} className="ml-4 text-green-700" />
                <input
                  required
                  type="text"
                  className={inputField}
                  placeholder="Ex: Barangay San Miguel"
                  value={barangay.name}
                  onChange={(e) => setBarangay(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex flex-col">
              <label className="font-bold text-[1rem] mr-auto">Description:</label>
              <div className={inputWrapper}>
                <textarea
                  className="w-full min-h-50 outline-0 p-2"
                  placeholder="Description..."
                  required
                  value={barangay.description}
                  onChange={(e) => setBarangay(prev => ({ ...prev, description: e.target.value }))}
                ></textarea>
              </div>
            </div>

            <div className="flex flex-col">
              <label className="font-bold text-[1rem] mr-auto">Coordinate (JSON):</label>
              <div className={inputWrapper}>
                <textarea
                  className="w-full min-h-20 outline-0 p-2"
                  placeholder='{"lat": 0, "lng": 0}'
                  required
                  value={barangay.coordinate}
                  onChange={(e) => setBarangay(prev => ({ ...prev, coordinate: e.target.value }))}
                ></textarea>
              </div>
            </div>

            <div className="flex flex-cols items-center w-full gap-2">
              <button className="bg-green-500 text-white px-4 py-2 w-[50%] rounded-md border border-green-600 hover:bg-white hover:text-green-600 transition cursor-pointer">
                Save
              </button>

              <button
                onClick={(e) => { e.preventDefault(); setIsOpenAddEditModal(false); }}
                className="bg-white text-black px-4 py-2 rounded-md border w-[50%] border-black hover:border-green-600 hover:text-green-600 transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}