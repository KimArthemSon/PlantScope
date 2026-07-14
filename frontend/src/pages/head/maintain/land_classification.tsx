import { useEffect, useState } from "react";
import {
  Trash2,
  Edit,
  Plus,
  ChevronRight,
  ChevronLeft,
  Info,
} from "lucide-react";
import PlantScopeAlert from "@/components/alert/PlantScopeAlert";
import Delete_modal from "@/components/layout/delete_modal";
import LoaderPending from "@/components/layout/loaderSmall";
import { api } from "@/constant/api";

// ✅ UPDATED: Replaced for_reforestation with ownership_type
interface Land_classifications {
  land_classification_id: number;
  name: string;
  description: string;
  ownership_type: "public" | "private";
  created_at: string;
}

interface Land_classification {
  name: string;
  description: string;
  ownership_type: "public" | "private";
}

interface Filter {
  search: string;
  entries: number;
  page: number;
  total_page: number;
  ownership_type: string; // '', 'public', or 'private'
}

export default function Land_classifications() {
  const [Land_classifications, setLand_classifications] = useState<
    Land_classifications[]
  >([]);
  
  // ✅ UPDATED: Default ownership_type to "private"
  const [Land_classification, setLand_classification] =
    useState<Land_classification>({
      name: "",
      description: "",
      ownership_type: "private",
    });
    
  const [filter, setFilter] = useState<Filter>({
    search: "",
    entries: 10,
    page: 1,
    total_page: 1,
    ownership_type: "", // ✅ UPDATED
  });

  const [isOpenAddEditModal, setIsOpenAddEditModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form_loading, setForm_loading] = useState(false);
  const [editLand_classification_id, setEditLand_classification_id] =
    useState<number>(0);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [action, setAction] = useState<"Add" | "Edit">("Add");
  const [PSalert, setPSAlert] = useState<{
    type: "success" | "failed" | "error";
    title: string;
    message: string;
  } | null>(null);

  const [Land_classification_idDelete, setLand_classification_idDelete] =
    useState<number | null>(null);

  const token = localStorage.getItem("token");

  const inputWrapper =
    "flex items-center border border-black rounded-md mt-2 p-1 " +
    "focus-within:border-green-700 focus-within:ring-2 " +
    "focus-within:ring-green-300 transition-all";

  const inputField = "flex-1 text-[1rem] p-2 ml-4 outline-none bg-transparent";

  // Fetch Land_classifications from backend
  const fetchLand_classifications = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search: filter.search,
        page: filter.page.toString(),
        entries: filter.entries.toString(),
      });

      // ✅ UPDATED: Append ownership_type instead of for_reforestation
      if (filter.ownership_type !== "") {
        params.append("ownership_type", filter.ownership_type);
      }

      const response = await fetch(
        api + `api/get_land_classifications/?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!response.ok)
        throw new Error("Failed to fetch Land_classifications.");

      const data = await response.json();
      setLand_classifications(data.data);
      setFilter((prev) => ({ ...prev, total_page: data.total_page }));
    } catch (err) {
      setPSAlert({
        type: "error",
        title: "Failed",
        message: "Failed to load Land_classifications.",
      });
    } finally {
      setLoading(false);
    }
  };

  // ✅ UPDATED: Dependency array uses ownership_type
  useEffect(() => {
    fetchLand_classifications();
  }, [filter.page, filter.entries, filter.ownership_type]);

  const setDelete = (Land_classification_id: number) => {
    setLand_classification_idDelete(Land_classification_id);
    setIsDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!Land_classification_idDelete) return;
    const response = await fetch(
      api + `api/delete_land_classification/${Land_classification_idDelete}`,
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
      fetchLand_classifications();
    } else {
      setPSAlert({
        type: "failed",
        title: "Failed",
        message: "Failed to delete Land_classification.",
      });
      setIsDeleteModalOpen(false);
    }
  };

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (action === "Add") {
      handleAdd();
    } else if (action === "Edit") {
      handleEdit();
    }
  }

  async function handleAdd() {
    try {
      setForm_loading(true);
      if (form_loading) return;

      const res = await fetch(api + "api/create_land_classification/", {
        method: "POST",
        headers: { 
          Authorization: "Bearer " + token,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(Land_classification),
      });
      const data = await res.json();
      
      if (!res.ok) {
        setPSAlert({
          type: "error",
          title: "Error",
          message: data.error,
        });
        setForm_loading(false);
        return;
      }
      setPSAlert({
        type: "success",
        title: "Success",
        message: "Successfully Created",
      });
      setForm_loading(false);
      setIsOpenAddEditModal(false);
      fetchLand_classifications();
    } catch (e: any) {
      setPSAlert({
        type: "error",
        title: "Error",
        message: e.message || "An unexpected error occurred",
      });
      setForm_loading(false);
    }
  }

  async function handleEdit() {
    try {
      setForm_loading(true);
      if (form_loading) return;

      const res = await fetch(
        api + "api/update_land_classification/" + editLand_classification_id,
        {
          method: "PUT",
          headers: { 
            Authorization: "Bearer " + token,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(Land_classification),
        }
      );
      const data = await res.json();

      if (!res.ok) {
        setPSAlert({
          type: "error",
          title: "Error",
          message: data.error,
        });
        setForm_loading(false);
        return;
      }
      setPSAlert({
        type: "success",
        title: "Success",
        message: data.message,
      });
      setForm_loading(false);
      setIsOpenAddEditModal(false);
      fetchLand_classifications();
    } catch (e: any) {
      setPSAlert({
        type: "error",
        title: "Error",
        message: e.message || "An unexpected error occurred",
      });
      setForm_loading(false);
    }
  }

  return (
    <div className="flex min-h-dvh bg-gray-50 justify-center items-center flex-col">
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
      <main className="flex-1 p-8 w-full max-w-6xl">
        {/* Filters */}
        <div className="flex items-center mb-7 gap-4 flex-wrap">
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

          {/* ✅ UPDATED: Ownership Type Filter */}
          <select
            value={filter.ownership_type}
            onChange={(e) =>
              setFilter((prev) => ({
                ...prev,
                ownership_type: e.target.value,
                page: 1,
              }))
            }
            className="border border-black p-2 rounded-md text-[.8rem]"
          >
            <option value="">All Types</option>
            <option value="public">Public</option>
            <option value="private">Private</option>
          </select>

          <input
            type="text"
            placeholder="Search Land classifications..."
            value={filter.search}
            onChange={(e) =>
              setFilter((prev) => ({
                ...prev,
                search: e.target.value,
                page: 1,
              }))
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                fetchLand_classifications();
              }
            }}
            className="border border-black rounded-md p-2 w-80 text-[.8rem] ml-auto"
          />
          <button
            onClick={() => {
              setIsOpenAddEditModal(true);
              setAction("Add");
              setLand_classification({
                name: "",
                description: "",
                ownership_type: "private", // ✅ UPDATED
              });
            }}
            className="flex items-center justify-center gap-2 bg-[#1a6b44] hover:bg-[#0f4a2f] text-white h-10 px-3 py-2 rounded-lg text-[.8rem] cursor-pointer"
          >
            <Plus size={20} /> Add new land classification
          </button>
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
                <th className="py-3 px-5 text-left text-[.9rem]">Ownership Type</th> {/* ✅ UPDATED */}
                <th className="py-3 px-5 text-left text-[.9rem]">Created At</th>
                <th className="py-3 px-5 text-left text-[.9rem]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {Land_classifications.length > 0 ? (
                Land_classifications.map((item, index) => (
                  <tr
                    key={item.land_classification_id}
                    className={`${index % 2 === 0 ? "" : "bg-[#0F4A2F0D]"} transition`}
                  >
                    <td className="py-3 px-5 text-[.9rem]">
                      {index + 1 + (filter.page - 1) * filter.entries}
                    </td>
                    <td className="py-3 px-5">{item.name}</td>
                    <td className="py-3 px-5 text-[.9rem] break-words max-w-xs">
                      {item.description}
                    </td>
                    {/* ✅ UPDATED: Ownership Type Badge */}
                    <td className="py-3 px-5 text-[.9rem]">
                      {item.ownership_type === "public" ? (
                        <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 border border-blue-300 text-xs font-semibold px-2.5 py-1 rounded-full">
                          Public
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 border border-amber-300 text-xs font-semibold px-2.5 py-1 rounded-full">
                          Private
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-5 text-[.9rem]">
                      {item.created_at}
                    </td>
                    <td className="py-3 px-5">
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setIsOpenAddEditModal(true);
                            setEditLand_classification_id(item.land_classification_id);
                            setAction("Edit");
                            setLand_classification({
                              name: item.name,
                              description: item.description,
                              ownership_type: item.ownership_type, // ✅ UPDATED
                            });
                          }}
                          className="text-black px-3 py-1 rounded-md flex items-center gap-1 cursor-pointer hover:bg-gray-100"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => setDelete(item.land_classification_id)}
                          className="text-red-500 px-3 py-1 rounded-md flex items-center gap-1 cursor-pointer hover:bg-red-50"
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
                    No Land classifications found.
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
            className="px-2 py-1 border rounded-md text-gray-700 hover:bg-gray-100 ml-auto cursor-pointer disabled:opacity-50"
          >
            <ChevronLeft size={19} />
          </button>

          {Array.from({ length: filter.total_page }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setFilter((prev) => ({ ...prev, page: p }))}
              className={`px-3 py-1 border rounded-md cursor-pointer text-[.8rem] ${
                p === filter.page
                  ? "bg-green-600 text-white"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              {p}
            </button>
          ))}

          <button
            disabled={filter.page >= filter.total_page}
            onClick={() => setFilter((prev) => ({ ...prev, page: prev.page + 1 }))}
            className="px-2 py-1 border rounded-md text-gray-700 hover:bg-gray-100 cursor-pointer disabled:opacity-50"
          >
            <ChevronRight size={19} />
          </button>
        </div>
      </main>

      {/* Add/Edit Modal */}
      <form
        className={`fixed inset-0 z-10 flex items-center justify-center bg-black/50 transition-opacity duration-300
          ${isOpenAddEditModal ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}
        `}
        onSubmit={handleSubmit}
      >
        {form_loading && <LoaderPending />}
        <div
          className={`flex flex-col h-auto max-h-[90vh] overflow-y-auto items-center gap-2 bg-white rounded-lg p-0 w-full max-w-md text-center shadow-lg
            transform transition-all duration-300
            ${isOpenAddEditModal ? "scale-100 opacity-100" : "scale-95 opacity-0"}
          `}
        >
          <div className="flex justify-items-start items-center gap-4 w-full bg-green-600 rounded-t-lg p-4">
            {action === "Add" ? (
              <Plus size={40} className="text-white bg-green-500 p-2 rounded-full" />
            ) : (
              <Edit size={40} className="text-white bg-green-500 p-2 rounded-full" />
            )}
            <h2 className="text-lg font-semibold text-white">
              {action} Land Classification
            </h2>
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
                  placeholder="Ex: Private Agricultural Land"
                  value={Land_classification.name}
                  onChange={(e) => {
                    setLand_classification((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }));
                  }}
                />
              </div>
            </div>

            <div className="flex flex-col">
              <label className="font-bold text-[1rem] mr-auto">Description:</label>
              <div className={inputWrapper}>
                <textarea
                  className="w-full min-h-[100px] outline-0 p-2 bg-transparent"
                  placeholder="Enter description..."
                  required
                  value={Land_classification.description}
                  onChange={(e) => {
                    setLand_classification((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }));
                  }}
                ></textarea>
              </div>
            </div>

            {/* ✅ UPDATED: Ownership Type Dropdown */}
            <div className="flex flex-col">
              <label className="font-bold text-[1rem] mr-auto">Ownership Type:</label>
              <div className={inputWrapper}>
                <Info size={20} className="ml-4 text-green-700" />
                <select
                  required
                  className={inputField}
                  value={Land_classification.ownership_type}
                  onChange={(e) => {
                    setLand_classification((prev) => ({
                      ...prev,
                      ownership_type: e.target.value as "public" | "private",
                    }));
                  }}
                >
                  <option value="private">Private</option>
                  <option value="public">Public</option>
                </select>
              </div>
            </div>

            <div className="flex items-center w-full gap-3 mt-2">
              <button 
                type="submit"
                className="bg-green-500 text-white px-4 py-2 w-[50%] rounded-md border border-green-600 hover:bg-white hover:text-green-600 transition cursor-pointer font-semibold"
              >
                Save
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setIsOpenAddEditModal(false);
                }}
                className="bg-white text-black px-4 py-2 rounded-md border w-[50%] border-black hover:border-green-600 hover:text-green-600 transition cursor-pointer font-semibold"
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