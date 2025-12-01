import { useEffect, useState } from "react";
import Sidebar from "../../components/layout/Sidebar";
import { Trash2, Edit, Plus, X, Eye, EyeOff } from "lucide-react";
import PlantScopeAlert from "../../components/alert/PlantScopeAlert";
import NotFoundPage from "../../components/layout/NotFoundPage";
import { useNavigate } from "react-router-dom";

interface User {
  id: number;
  email: string;
  username: string;
  user_role: string;
}

export default function Accounts() {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [PSalert, setPSAlert] = useState<{
    type: "success" | "failed" | "error";
    title: string;
    message: string;
  } | null>(null);
  const navigate = useNavigate()
  // Form states
  const [formEmail, setFormEmail] = useState("");
  const [formUsername, setFormUsername] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState("FieldOfficer");
  const [showPassword, setShowPassword] = useState(false);

  const token = localStorage.getItem("token");

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch("http://127.0.0.1:8000/api/list_users/", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to fetch users.");
      const data = await response.json();
      setUsers(data);
    } catch (err: any) {
      setPSAlert({
        type: "error",
        title: "Failed",
        message: `Failed to Load user.`,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this user?")) return;

    const response = await fetch(
      `http://127.0.0.1:8000/api/delete_user/${id}/`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (response.ok) {
      setUsers(users.filter((u) => u.id !== id));
      setPSAlert({
        type: "success",
        title: "Success",
        message: `Successfully Deleted user.`,
      });
    } else {
      setPSAlert({
        type: "failed",
        title: "Failed",
        message: `Failed to Delete users.`,
      });
    }
  };

  const handleAddUser = async () => {
    const response = await fetch("http://127.0.0.1:8000/api/register/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        email: formEmail,
        username: formUsername,
        password: formPassword,
        user_role: formRole,
      }),
    });
  const data = await response.json()
  console.log(data);
    if (response.ok) {
      setShowAddModal(false);
      fetchUsers();
      resetForm();

      setPSAlert({
        type: "success",
        title: "Success",
        message: `Successfully Added!`,
      });
    } else {
      setPSAlert({
        type: "failed",
        title: "Failed",
        message: data.error,
      });
    }
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;

    const body: any = {
      email: formEmail,
      username: formUsername,
      user_role: formRole,
    };

    // Only send password if user typed something
    if (formPassword.trim() !== "") {
      body.password = formPassword;
    }

    const response = await fetch(
      `http://127.0.0.1:8000/api/update_user/${editingUser.id}/`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      }
    );
  const data = await response.json()
    if (response.ok) {
      setEditingUser(null);
      fetchUsers();
      resetForm();

      setPSAlert({
        type: "success",
        title: "Success",
        message: `Success updated user.`,
      });
    } else {
      setPSAlert({
        type: "failed",
        title: "Failed",
        message: data.error,
      });
    }
  };

  const resetForm = () => {
    setFormEmail("");
    setFormUsername("");
    setFormPassword("");
    setFormRole("FieldOfficer");
    setShowPassword(false);
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setFormEmail(user.email);
    setFormUsername(user.username);
    setFormRole(user.user_role);
    setFormPassword(""); // clear password field.
  };

  const filteredUsers = users.filter(
    (u) =>
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.user_role.toLowerCase().includes(search.toLowerCase())
  );
 const [isAuthorize, setIsAuthorize] = useState(true);

  useEffect(() => {
      checkIfStillLogin()
    }, []);
  
     const checkIfStillLogin = async () =>{
  
     const token = localStorage.getItem("token");

     if(!token){
      return;
     }
            try {
        const response = await fetch("http://127.0.0.1:8000/api/get_me/", {
          method: "POST",
           headers: { Authorization: `Bearer ${token}` },
        });
  
        const data = await response.json();
  
        if (response.ok) {     
            
            if (!(data.user_role === "CityENROHead")) {
                 setIsAuthorize(false)    
            }
        } 
  
      } catch (error) {
         setIsAuthorize(false)
      }
     } 
  if (!localStorage.getItem('token')){
     navigate("/Login");
  }
  if(!isAuthorize){
      <NotFoundPage />
  }

 
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      {PSalert && (
        <PlantScopeAlert
          type={PSalert.type}
          title={PSalert.title}
          message={PSalert.message}
          onClose={() => setPSAlert(null)}
        />
      )}

      <main className="flex-1 p-8">
        <h1 className="text-3xl font-bold text-green-700 mb-4">Accounts</h1>

        {/* Search + Add */}
        <div className="flex justify-between mb-4">
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border border-gray-300 rounded-md p-2 w-1/3"
          />

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md"
          >
            <Plus size={16} /> Add User
          </button>
        </div>

        {/* Error / Loading */}

        {loading && <p className="text-green-600 mb-2">Loading users...</p>}

        {/* Table */}
        <div className="overflow-x-auto shadow-lg rounded-xl border border-gray-200">
          <table className="min-w-full bg-white rounded-lg">
            <thead className="bg-green-700 text-white">
              <tr>
                <th className="py-3 px-5 text-left">Email</th>
                <th className="py-3 px-5 text-left">Username</th>
                <th className="py-3 px-5 text-left">Role</th>
                <th className="py-3 px-5 text-left">Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b hover:bg-green-50 transition"
                  >
                    <td className="py-3 px-5">{user.email}</td>
                    <td className="py-3 px-5">{user.username}</td>
                    <td className="py-3 px-5">{user.user_role}</td>

                    <td className="py-3 px-5 flex gap-2">
                      <button
                        onClick={() => openEditModal(user)}
                        className="bg-yellow-400 hover:bg-yellow-500 text-white px-3 py-1 rounded-md flex items-center gap-1"
                      >
                        <Edit size={14} /> Edit
                      </button>

                      <button
                        onClick={() => handleDelete(user.id)}
                        className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-md flex items-center gap-1"
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={4}
                    className="text-center py-5 text-gray-500 italic"
                  >
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>

      {/* ADD + EDIT MODAL */}
      {(showAddModal || editingUser) && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
          <div className="bg-white p-6 rounded-xl w-96 shadow-xl">
            <div className="flex justify-between mb-4">
              <h2 className="text-xl font-bold text-green-700">
                {editingUser ? "Edit User" : "Add User"}
              </h2>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingUser(null);
                  resetForm();
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <div className="space-y-3">
              <input
                type="email"
                className="w-full border p-2 rounded"
                placeholder="Email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
              />

              <input
                type="text"
                className="w-full border p-2 rounded"
                placeholder="Username"
                value={formUsername}
                onChange={(e) => setFormUsername(e.target.value)}
              />

              {/* PASSWORD (editable + show/hide) */}
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className="w-full border p-2 rounded"
                  placeholder={
                    editingUser ? "New Password (optional)" : "Password"
                  }
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-2 text-gray-600 hover:text-gray-800"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <select
                className="w-full border p-2 rounded"
                value={formRole}
                onChange={(e) => setFormRole(e.target.value)}
              >
                <option value="CityENROHead">City ENRO Head</option>
                <option value="AFA">Agricultural Field Assessor</option>
                <option value="FieldOfficer">Field Officer</option>
                <option value="MonitoringOfficer">Monitoring Officer</option>
                <option value="GISSpecialist">GIS Specialist</option>
              </select>
            </div>

            {/* Buttons */}
            <div className="flex justify-end mt-4">
              <button
                onClick={() =>
                  editingUser ? handleUpdateUser() : handleAddUser()
                }
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md"
              >
                {editingUser ? "Save Changes" : "Create User"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
