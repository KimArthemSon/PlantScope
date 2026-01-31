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
interface Tree_species {
  tree_specie_id: number;
  name: string;
  description: string;
  created_at: string;
}
interface Tree_specie {
  name: string;
  description: string;
}

interface Filter {
  search: string;
  entries: number;
  page: number;
  total_page: number;
}

export default function Tree_species() {
  const [tree_species, setTree_species] = useState<Tree_species[]>([]);
  const [tree_specie, setTree_specie] = useState<Tree_specie>({
    name: "",
    description: "",
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
  const [edittree_specie_Id, setEdittree_specie_Id] = useState<number>(0);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [action, setAction] = useState<"Add" | "Edit">("Add");
  const [PSalert, setPSAlert] = useState<{
    type: "success" | "failed" | "error";
    title: string;
    message: string;
  } | null>(null);

  const [tree_specie_idDelete, settree_specie_IdDelete] = useState<
    number | null
  >(null);
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const inputWrapper =
    "flex items-center border border-black rounded-md mt-2 p-1 " +
    "focus-within:border-green-700 focus-within:ring-2 " +
    "focus-within:ring-green-300 transition-all";

  const inputField = "flex-1 text-[1rem] p-2 ml-4 outline-none bg-transparent";

  // Fetch tree_species from backend
  const fetchtree_species = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search: filter.search,
        page: filter.page.toString(),
        entries: filter.entries.toString(),
      });

      const response = await fetch(
        `http://127.0.0.1:8000/api/get_tree_species/?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!response.ok) throw new Error("Failed to fetch tree_species.");

      const data = await response.json();
      setTree_species(data.data);
      setFilter((prev) => ({ ...prev, total_page: data.total_page }));
    } catch (err) {
      setPSAlert({
        type: "error",
        title: "Failed",
        message: "Failed to load tree_species.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchtree_species();
  }, [filter.page, filter.entries]); // refetch when filters change

  const setDelete = (tree_specie_id: number) => {
    settree_specie_IdDelete(tree_specie_id);
    setIsDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!tree_specie_idDelete) return;
    const response = await fetch(
      `http://127.0.0.1:8000/api/delete_tree_specie/${tree_specie_idDelete}`,
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
      setIsDeleteModalOpen(false);
      fetchtree_species(); // refresh list after delete
    } else {
      setPSAlert({
        type: "failed",
        title: "Failed",
        message: "Failed to delete tree specie.",
      });
      setIsDeleteModalOpen(false);
    }
  };

  function handleSubmit(e: any) {
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

      const res = await fetch("http://127.0.0.1:8000/api/create_tree_specie/", {
        method: "POST",
        headers: { Authorization: "Bearer " + token },
        body: JSON.stringify(tree_specie),
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
        message: data.message,
      });
      setForm_loading(false);
      setIsOpenAddEditModal(false);
      fetchtree_species();
    } catch (e: any) {
      setPSAlert({
        type: "error",
        title: "Error",
        message: e.error,
      });
      setForm_loading(false);
    }
  }

  async function handleEdit() {
    try {
      setForm_loading(true);

      if (form_loading) return;

      const res = await fetch(
        "http://127.0.0.1:8000/api/update_tree_specie/" + edittree_specie_Id,
        {
          method: "PUT",
          headers: { Authorization: "Bearer " + token },
          body: JSON.stringify(tree_specie),
        },
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
      fetchtree_species();
    } catch (e: any) {
      setPSAlert({
        type: "error",
        title: "Error",
        message: e.error,
      });
      setForm_loading(false);
    }
  }

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
          <h1 className="text-3xl font-bold text-green-700">Tree Species</h1>
          <button
            onClick={() => {
              setIsOpenAddEditModal(true);
              setAction("Add");
              setTree_specie({
                name: "",
                description: "",
              });
            }}
            className="flex items-center justify-center gap-2 bg-[#0f4a2fe0] hover:bg-[#0f4a2f] text-white h-10 px-3 py-2 ml-auto rounded-lg text-[.8rem] cursor-pointer"
          >
            <Plus size={20} /> Add new tree specie
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
            placeholder="Search tree_species..."
            value={filter.search}
            onChange={(e) =>
              setFilter((prev) => ({
                ...prev,
                search: e.target.value,
                page: 1, // reset page when typing
              }))
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                fetchtree_species(); // call your fetch function on Enter
              }
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
                  Description
                </th>
                <th className="py-3 px-5 text-left text-[.9rem]">Created_at</th>
                <th className="py-3 px-5 text-left text-[.9rem]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tree_species.length > 0 ? (
                tree_species.map((tree_specie, index) => (
                  <tr
                    key={tree_specie.tree_specie_id}
                    className={`${index % 2 === 0 ? "" : "bg-[#0F4A2F0D]"} transition`}
                  >
                    <td className="py-3 px-5 text-[.9rem]">
                      {index + 1 + (filter.page - 1) * filter.entries}
                    </td>
                    <td className="py-3 px-5">{tree_specie.name}</td>
                    <td className="py-3 px-5 text-[.9rem] wrap-break-word max-w-75">
                      {tree_specie.description}
                    </td>
                    <td className="py-3 px-5 text-[.9rem]">
                      {tree_specie.created_at}
                    </td>
                    <td className="py-3 px-5">
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setIsOpenAddEditModal(true);
                            setEdittree_specie_Id(tree_specie.tree_specie_id);
                            setAction("Edit");
                            setTree_specie({
                              name: tree_species[index].name,
                              description: tree_species[index].description,
                            });
                          }}
                          className="text-black px-3 py-1 rounded-md flex items-center gap-1 cursor-pointer"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => setDelete(tree_specie.tree_specie_id)}
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
                    colSpan={5}
                    className="text-center py-5 text-gray-500 italic"
                  >
                    No tree_species found.
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
                className={`px-2 py-1 border rounded-md cursor-pointer text-[.8rem] ${
                  p === filter.page
                    ? "bg-green-600 text-white"
                    : "text-gray-700 hover:bg-gray-100"
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
            className="px-2 py-1 border rounded-md text-gray-700 hover:bg-gray-100 cursor-pointer"
          >
            <ChevronRight size={19} />
          </button>
        </div>
      </main>

      <form
        className={`fixed inset-0 z-10 flex items-center justify-center bg-black/50 transition-opacity duration-300
        ${
          isOpenAddEditModal
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }
      `}
        onSubmit={handleSubmit}
      >
        {form_loading && <LoaderPending />}
        <div
          className={`flex flex-col items-center gap-2 bg-white rounded-lg p-0 w-100 text-center shadow-lg
          transform transition-all duration-300
          ${isOpenAddEditModal ? "scale-100 opacity-100" : "scale-95 opacity-0"}
        `}
        >
          <div className="flex justify-items-start items-center gap-10 w-full bg-green-600 rounded-t-lg p-2">
            <Delete
              size={66}
              className="text-white bg-green-500 p-3 rounded-full mb-2"
            />

            <h2 className="text-lg font-semibold text-white">{action}</h2>
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
                  placeholder="Ex: Soil1"
                  value={tree_specie.name}
                  onChange={(e) => {
                    setTree_specie((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }));
                  }}
                />
              </div>
            </div>
            <div className="flex flex-col">
              <label className="font-bold text-[1rem] mr-auto">
                Description:
              </label>
              <div className={inputWrapper}>
                <textarea
                  className="w-full min-h-50 outline-0 p-2"
                  placeholder="Descriptions "
                  required
                  value={tree_specie.description}
                  onChange={(e) => {
                    setTree_specie((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }));
                  }}
                ></textarea>
              </div>
            </div>

            <div className="flex flex-cols items-center w-full gap-2">
              <button className="bg-green-500 text-white px-4 py-2 w-[50%] rounded-md border border-green-600 hover:bg-white hover:text-green-600 transition cursor-pointer">
                Save
              </button>

              <button
                onClick={(e) => {
                  e.preventDefault();
                  setIsOpenAddEditModal(false);
                }}
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
