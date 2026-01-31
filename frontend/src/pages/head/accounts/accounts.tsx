import { useEffect, useState } from "react";
import { Trash2, Edit, Plus, ChevronRight, ChevronLeft } from "lucide-react";
import PlantScopeAlert from "../../../components/alert/PlantScopeAlert";
import Delete_modal from "../../../components/layout/delete_modal";
import { useNavigate } from "react-router-dom";
import LoaderPending from "../../../components/layout/loaderSmall";
interface User {
  id: number;
  email: string;
  user_role: string;
  profile_img: string;
}

interface Filter {
  search: string;
  role:
    | "ALL"
    | "CityENROHead"
    | "FieldOfficer"
    | "GISSpecialist"
    | "treeGrowers";
  entries: number;
  page: number;
  total_page: number;
}

export default function Accounts() {
  const [users, setUsers] = useState<User[]>([]);
  const [filter, setFilter] = useState<Filter>({
    search: "",
    role: "ALL",
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
  const [idDelete, setIdDelete] = useState<number | null>(null);
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  // Fetch users from backend
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search: filter.search,
        role: filter.role,
        page: filter.page.toString(),
        entries: filter.entries.toString(),
      });

      const response = await fetch(
        `http://127.0.0.1:8000/api/list_users/?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!response.ok) throw new Error("Failed to fetch users.");

      const data = await response.json();
      setUsers(data.accounts);
      setFilter((prev) => ({ ...prev, total_page: data.total_pages }));
    } catch (err) {
      setPSAlert({
        type: "error",
        title: "Failed",
        message: "Failed to load users.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [filter.role, filter.page, filter.entries]); // refetch when filters change

  const setDelete = (id: number) => {
    setIdDelete(id);
    setIsDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!idDelete) return;
    const response = await fetch(
      `http://127.0.0.1:8000/api/delete_user/${idDelete}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (response.ok) {
      setPSAlert({
        type: "success",
        title: "Deleted",
        message: "User deleted successfully.",
      });
      setIsDeleteModalOpen(false);
      fetchUsers(); // refresh list after delete
    } else {
      setPSAlert({
        type: "failed",
        title: "Failed",
        message: "Failed to delete user.",
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

      <main className="flex-1 p-8 max-w-[1636px]">
        {/* Header */}
        <div className="flex items-center mt-5 mb-10">
          <h1 className="text-3xl font-bold text-green-700">Accounts</h1>
          <button
            onClick={() => navigate("/account-management/profile/")}
            className="flex items-center justify-center gap-2 bg-[#0f4a2fe0] hover:bg-[#0f4a2f] text-white h-10 px-3 py-2 ml-auto rounded-lg text-[.8rem] cursor-pointer"
          >
            <Plus size={20} /> Add New Account
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

          <label className="ml-auto text-bold">User roles: </label>
          <select
            value={filter.role}
            onChange={(e) =>
              setFilter((prev) => ({
                ...prev,
                role: e.target.value as Filter["role"],
                page: 1,
              }))
            }
            className="border border-black p-2 rounded-md text-[.8rem]"
          >
            <option value="ALL">All</option>
            <option value="CityENROHead">City ENRO Head</option>
            <option value="FieldOfficer">Field Officer</option>
            <option value="GISSpecialist">GIS Specialist</option>
            <option value="treeGrowers">Tree Growers</option>
          </select>

          <input
            type="text"
            placeholder="Search users..."
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
                fetchUsers(); // call your fetch function on Enter
              }
            }}
            className="border border-gray-300 rounded-md p-2 w-80 text-[.8rem]"
          />
        </div>

        {/* Table */}
        <div className="overflow-x-auto shadow-lg rounded-sm border border-gray-200">
          <table className="relative min-w-full bg-white rounded-sm">
            {loading && <LoaderPending />}
            <thead className="bg-[#0f4a2fe0] text-white">
              <tr>
                <th className="py-3 px-5 text-left text-[.9rem]">No</th>
                <th className="py-3 px-5 text-left text-[.9rem]">Profile</th>
                <th className="py-3 px-5 text-left text-[.9rem]">Email</th>
                <th className="py-3 px-5 text-left text-[.9rem]">Role</th>
                <th className="py-3 px-5 text-left text-[.9rem]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length > 0 ? (
                users.map((user, index) => (
                  <tr
                    key={user.id}
                    className={`${index % 2 === 0 ? "" : "bg-[#0F4A2F0D]"} transition`}
                  >
                    <td className="py-3 px-5 text-[.9rem]">
                      {index + 1 + (filter.page - 1) * filter.entries}
                    </td>
                    <td className="py-3 px-5">
                      <img
                        src={"http://127.0.0.1:8000/" + user.profile_img}
                        alt="profile"
                        className="rounded-full w-20 h-[90%] min-h-20 max-h-25"
                      />
                    </td>
                    <td className="py-3 px-5 text-[.9rem]">{user.email}</td>
                    <td className="py-3 px-5 text-[.9rem]">{user.user_role}</td>
                    <td className="py-3 px-5">
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            navigate("/account-management/profile/" + user.id)
                          }
                          className="text-black px-3 py-1 rounded-md flex items-center gap-1 cursor-pointer"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => setDelete(user.id)}
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
                    No users found.
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
