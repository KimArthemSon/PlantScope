import { useEffect, useState } from "react";
import {
  Trash2,
  Edit,
  Plus,
  ChevronRight,
  ChevronLeft,
  Info,
} from "lucide-react";
import PlantScopeAlert from "../../../components/alert/PlantScopeAlert";
import Delete_modal from "../../../components/layout/delete_modal";
import LoaderPending from "../../../components/layout/loaderSmall";
import { api } from "@/constant/api";

interface Animal {
  animal_id: number;
  name: string;
  scientific_name: string;
  description: string;
  created_at: string;
}

interface AnimalForm {
  name: string;
  scientific_name: string;
  description: string;
}

interface Filter {
  search: string;
  entries: number;
  page: number;
  total_page: number;
}

export default function Animals() {
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [animal, setAnimal] = useState<AnimalForm>({
    name: "",
    scientific_name: "",
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
  const [editAnimalId, setEditAnimalId] = useState<number>(0);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [action, setAction] = useState<"Add" | "Edit">("Add");
  const [PSalert, setPSAlert] = useState<{
    type: "success" | "failed" | "error";
    title: string;
    message: string;
  } | null>(null);

  const [animalIdToDelete, setAnimalIdToDelete] = useState<number | null>(null);
  const token = localStorage.getItem("token");

  const inputWrapper =
    "flex items-center border border-black rounded-md mt-2 p-1 " +
    "focus-within:border-green-700 focus-within:ring-2 " +
    "focus-within:ring-green-300 transition-all";

  const inputField = "flex-1 text-[1rem] p-2 ml-4 outline-none bg-transparent";

  // Fetch animals from backend
  const fetchAnimals = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search: filter.search,
        page: filter.page.toString(),
        entries: filter.entries.toString(),
      });

      const response = await fetch(
        api+`api/get_animals/?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!response.ok) throw new Error("Failed to fetch animals.");

      const data = await response.json();
      setAnimals(data.data);
      setFilter((prev) => ({ ...prev, total_page: data.total_page }));
    } catch (err) {
      setPSAlert({
        type: "error",
        title: "Failed",
        message: "Failed to load animals.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnimals();
  }, [filter.page, filter.entries]);

  const setDelete = (animal_id: number) => {
    setAnimalIdToDelete(animal_id);
    setIsDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!animalIdToDelete) return;
    const response = await fetch(
      api+`api/delete_animal/${animalIdToDelete}`,
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
      fetchAnimals();
    } else {
      setPSAlert({
        type: "failed",
        title: "Failed",
        message: "Failed to delete animal.",
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

      const res = await fetch(api+"api/create_animal/", {
        method: "POST",
        headers: { Authorization: "Bearer " + token },
        body: JSON.stringify(animal),
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
      setAnimal({ name: "", scientific_name: "", description: "" });
      fetchAnimals();
    } catch (e: any) {
      setPSAlert({
        type: "error",
        title: "Error",
        message: e.message || "Something went wrong",
      });
      setForm_loading(false);
    }
  }

  async function handleEdit() {
    try {
      setForm_loading(true);
      if (form_loading) return;

      const res = await fetch(
        api+"api/update_animal/" + editAnimalId,
        {
          method: "PUT",
          headers: { Authorization: "Bearer " + token },
          body: JSON.stringify(animal),
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
      fetchAnimals();
    } catch (e: any) {
      setPSAlert({
        type: "error",
        title: "Error",
        message: e.message || "Something went wrong",
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
      <main className="flex-1 p-8 w-full max-w-609">
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
            placeholder="Search animals..."
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
                fetchAnimals();
              }
            }}
            className="border border-black rounded-md p-2 w-80 text-[.8rem] ml-auto"
          />
          <button
            onClick={() => {
              setIsOpenAddEditModal(true);
              setAction("Add");
              setAnimal({ name: "", scientific_name: "", description: "" });
            }}
            className="flex items-center justify-center gap-2 bg-[#1a6b44] hover:bg-[#0f4a2f] text-white h-10 px-3 py-2 rounded-lg text-[.8rem] cursor-pointer"
          >
            <Plus size={20} /> Add new animal
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
                <th className="py-3 px-5 text-left text-[.9rem]">
                  Scientific Name
                </th>
                <th className="py-3 px-5 text-left text-[.9rem]">
                  Description
                </th>
                <th className="py-3 px-5 text-left text-[.9rem]">Created At</th>
                <th className="py-3 px-5 text-left text-[.9rem]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {animals.length > 0 ? (
                animals.map((animal, index) => (
                  <tr
                    key={animal.animal_id}
                    className={`${index % 2 === 0 ? "" : "bg-[#0F4A2F0D]"} transition`}
                  >
                    <td className="py-3 px-5 text-[.9rem]">
                      {index + 1 + (filter.page - 1) * filter.entries}
                    </td>
                    <td className="py-3 px-5 font-medium">{animal.name}</td>
                    <td className="py-3 px-5 text-[.85rem] italic text-gray-600">
                      {animal.scientific_name || "—"}
                    </td>
                    <td className="py-3 px-5 text-[.9rem] break-words max-w-75">
                      {animal.description || "—"}
                    </td>
                    <td className="py-3 px-5 text-[.9rem]">
                      {new Date(animal.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-5">
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setIsOpenAddEditModal(true);
                            setEditAnimalId(animal.animal_id);
                            setAction("Edit");
                            setAnimal({
                              name: animal.name,
                              scientific_name: animal.scientific_name,
                              description: animal.description,
                            });
                          }}
                          className="text-black px-3 py-1 rounded-md flex items-center gap-1 cursor-pointer hover:bg-gray-100"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => setDelete(animal.animal_id)}
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
                  <td
                    colSpan={6}
                    className="text-center py-5 text-gray-500 italic"
                  >
                    No animals found.
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
            className="px-2 py-1 border rounded-md text-gray-700 hover:bg-gray-100 ml-auto cursor-pointer disabled:opacity-50"
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
            className="px-2 py-1 border rounded-md text-gray-700 hover:bg-gray-100 cursor-pointer disabled:opacity-50"
          >
            <ChevronRight size={19} />
          </button>
        </div>
      </main>

      {/* Add/Edit Modal */}
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
          className={`flex flex-col items-center h-auto max-h-[90vh] overflow-y-auto gap-2 bg-white rounded-lg p-0 w-100 text-center shadow-lg
          transform transition-all duration-300
          ${isOpenAddEditModal ? "scale-100 opacity-100" : "scale-95 opacity-0"}
        `}
        >
          <div className="flex justify-items-start items-center gap-10 w-full bg-green-600 rounded-t-lg p-2">
            {action === "Add" ? (
              <Plus
                size={66}
                className="text-white bg-green-500 p-3 rounded-full mb-2"
              />
            ) : (
              <Edit
                size={66}
                className="text-white bg-green-500 p-3 rounded-full mb-2"
              />
            )}
            <h2 className="text-lg font-semibold text-white">
              {action} Animal
            </h2>
          </div>

          <div className="flex flex-col p-6 w-full gap-5">
            {/* Name */}
            <div className="flex flex-col">
              <label className="font-bold text-[1rem] mr-auto">
                Common Name *
              </label>
              <div className={inputWrapper}>
                <Info size={20} className="ml-4 text-green-700" />
                <input
                  required
                  type="text"
                  className={inputField}
                  placeholder="Ex: Philippine Eagle"
                  value={animal.name}
                  onChange={(e) =>
                    setAnimal((prev) => ({ ...prev, name: e.target.value }))
                  }
                />
              </div>
            </div>

            {/* Scientific Name */}
            <div className="flex flex-col">
              <label className="font-bold text-[1rem] mr-auto">
                Scientific Name
              </label>
              <div className={inputWrapper}>
                <Info size={20} className="ml-4 text-green-700" />
                <input
                  type="text"
                  className={inputField}
                  placeholder="Ex: Pithecophaga jefferyi"
                  value={animal.scientific_name}
                  onChange={(e) =>
                    setAnimal((prev) => ({
                      ...prev,
                      scientific_name: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            {/* Description */}
            <div className="flex flex-col">
              <label className="font-bold text-[1rem] mr-auto">
                Description
              </label>
              <div className={inputWrapper}>
                <textarea
                  className="w-full min-h-32 outline-0 p-2 resize-y"
                  placeholder="Habitat, behavior, conservation status, etc."
                  value={animal.description}
                  onChange={(e) =>
                    setAnimal((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            {/* Buttons */}
            <div className="flex items-center w-full gap-2 mt-2">
              <button
                type="submit"
                className="bg-green-500 text-white px-4 py-2 w-[50%] rounded-md border border-green-600 hover:bg-white hover:text-green-600 transition cursor-pointer"
              >
                Save
              </button>
              <button
                type="button"
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
