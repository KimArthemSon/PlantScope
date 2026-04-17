import { useEffect, useState } from "react";
import { ChevronRight, ChevronLeft, Leaf, VerifiedIcon } from "lucide-react";
import PlantScopeAlert from "../../../components/alert/PlantScopeAlert";
import Delete_modal from "../../../components/layout/delete_modal";
import { useNavigate } from "react-router-dom";
import LoaderPending from "../../../components/layout/loaderSmall";

interface Application {
  application_id: number;
  organization_name: string;
  org_email: string;
  org_profile: string;
  title: string;
  total_members: number;
  total_request_seedling: number;
  classification: string;
  status: string;
  created_at: string;
}

interface Filter {
  search: string;
  entries: number;
  page: number;
  total_page: number;
  status: string;
  classification: string;
}

export default function Application() {
  const [application, setApplication] = useState<Application[]>([]);
  const [filter, setFilter] = useState<Filter>({
    search: "",
    entries: 10,
    page: 1,
    total_page: 1,
    status: "for_evaluation",
    classification: "All",
  });

  const [loading, setLoading] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
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

  // Fetch Application from backend
  const fetchApplication = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search: filter.search,
        page: filter.page.toString(),
        entries: filter.entries.toString(),
        classification: filter.classification.toString(),
        status: filter.status.toString(),
      });

      const response = await fetch(
        `http://127.0.0.1:8000/api/get_applications/?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!response.ok) throw new Error("Failed to fetch Application.");

      const data = await response.json();
      setApplication(data.data);
      setFilter((prev) => ({ ...prev, total_page: data.total_page }));
    } catch (err) {
      setPSAlert({
        type: "error",
        title: "Failed",
        message: "Failed to load Application.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplication();
  }, [filter.page, filter.entries, filter.classification, filter.status]); // refetch when filters change

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
      fetchApplication(); // refresh list after delete
    } else {
      setPSAlert({
        type: "failed",
        title: "Failed",
        message: "Failed to delete tree specie.",
      });
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
      <header className="bg-gradient-to-r from-[#0F4A2F] to-[#1a6b44] text-white py-6 px-8 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-center">
          <div className="flex items-center gap-3 mb-2 mr-auto">
            <Leaf size={32} className="text-green-300" />
            <h1 className="text-3xl md:text-4xl font-bold">Application</h1>
          </div>
        </div>
      </header>
      <main className="flex-1 p-8 max-w-409">
        {/* Header */}

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

          <label>classification:</label>

          <select
            value={filter.classification}
            onChange={(e) =>
              setFilter((prev) => ({
                ...prev,
                classification: e.target.value,
                page: 1,
              }))
            }
            className="border border-black p-2 rounded-md text-[.8rem]"
          >
            <option value="All">All</option>
            <option value="new">New</option>
            <option value="old">Old</option>
          </select>
          <label>status:</label>

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
            <option value="for_evaluation">Evaluation</option>
            <option value="for_head">Head Confirmation</option>
            <option value="rejected">Rejected</option>
          </select>
          <input
            type="text"
            placeholder="Search Application..."
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
                fetchApplication(); // call your fetch function on Enter
              }
            }}
            className="border border-black rounded-md p-2 w-80 text-[.8rem] ml-auto"
          />
        </div>

        {/* Table */}
        <div className="overflow-x-auto shadow-lg rounded-sm border border-gray-200">
          {loading && <LoaderPending />}
          <table className="relative min-w-full bg-white rounded-sm">
            <thead className="bg-[#0f4a2fe0] text-white">
              <tr>
                <th className="py-3 px-5 text-left text-[.9rem]">No</th>
                <th className="py-3 px-5 text-left text-[.9rem]">Profile</th>
                <th className="py-3 px-5 text-left text-[.9rem]">Title</th>
                <th className="py-3 px-5 text-left text-[.9rem]">Status</th>
                <th className="py-3 px-5 text-left text-[.9rem]">
                  Classification
                </th>
                <th className="py-3 px-5 text-left text-[.9rem]">Members</th>
                <th className="py-3 px-5 text-left text-[.9rem]">
                  Request seedling
                </th>
                <th className="py-3 px-5 text-left text-[.9rem]">Created_at</th>
                <th className="py-3 px-5 text-left text-[.9rem]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {application.length > 0 ? (
                application.map((app, index) => (
                  <tr
                    key={app.application_id}
                    className={`${index % 2 === 0 ? "" : "bg-[#0F4A2F0D]"} transition`}
                  >
                    <td className="py-3 px-5 text-[.9rem]">
                      {index + 1 + (filter.page - 1) * filter.entries}
                    </td>
                    <td className="py-3 px-5">
                      <div className="flex gap-5">
                        <img
                          src={"http://127.0.0.1:8000/" + app.org_profile}
                          className="rounded-full h-15 w-15"
                          alt="prfile image"
                        />
                        <div>
                          <h4 className="font-bold text-[.8rem]">
                            {app.organization_name}
                          </h4>
                          <span className="text-[#00000091] text-[.7rem]">
                            {app.org_email}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-5 text-[.9rem] wrap-break-word max-w-75">
                      {app.title}
                    </td>
                    <td className="py-3 px-5 text-[.9rem] wrap-break-word max-w-75">
                      {app.status}
                    </td>
                    <td className="py-3 px-5 text-[.9rem] wrap-break-word max-w-75">
                      {app.classification}
                    </td>
                    <td className="py-3 px-5 text-[.9rem] wrap-break-word max-w-75">
                      {app.total_members}
                    </td>
                    <td className="py-3 px-5 text-[.9rem] wrap-break-word max-w-75">
                      {app.total_request_seedling}
                    </td>
                    <td className="py-3 px-5 text-[.9rem]">{app.created_at}</td>
                    <td className="py-3 px-5">
                      <div className="flex gap-2">
                        {app.status !== "for_head" && (
                          <button
                            onClick={() => {
                              navigate(
                                "/DataManager/evaluation/" + app.application_id,
                              );
                            }}
                            className="text-black px-3 py-1 rounded-md flex items-center gap-1 cursor-pointer"
                          >
                            <VerifiedIcon size={18} />
                          </button>
                        )}

                        {/* <button
                          onClick={() => setDelete(app.application_id)}
                          className="text-red-500 px-3 py-1 rounded-md flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 size={18} />
                        </button> */}
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
                    No Application found.
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
    </div>
  );
}
