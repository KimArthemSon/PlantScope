import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { X, Plus, Trash2, Save, Search, ArrowLeft, Users, UserCheck } from "lucide-react";
import PlantScopeAlert from "@/components/alert/PlantScopeAlert";
import { useUserRole } from "@/hooks/authorization";

interface Inspector {
  user_id: number;
  full_name: string;
  email: string;
  profile_img?: string;
}

function Avatar({ inspector }: { inspector: Inspector }) {
  const initials = inspector.full_name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  if (inspector.profile_img) {
    return (
      <img
        src={"http://127.0.0.1:8000" + inspector.profile_img}
        className="w-10 h-10 rounded-full object-cover ring-2 ring-green-100 shrink-0"
        alt={inspector.full_name}
      />
    );
  }

  return (
    <div className="w-10 h-10 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-sm font-semibold shrink-0 ring-2 ring-green-200">
      {initials}
    </div>
  );
}

export default function Assign_onsite_inspector() {
  const { id } = useParams<{ id: string }>();
  const reforestation_area_id = parseInt(id || "0", 10);
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const [assigned, setAssigned] = useState<Inspector[]>([]);
  const [available, setAvailable] = useState<Inspector[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [searchAssigned, setSearchAssigned] = useState("");
  const [searchAvailable, setSearchAvailable] = useState("");

  const [PSalert, setPSAlert] = useState<{
    type: "success" | "failed" | "error";
    title: string;
    message: string;
  } | null>(null);

  const fetchAssigned = async () => {
    const res = await fetch(
      `http://127.0.0.1:8000/api/get_assigned_list/${reforestation_area_id}/`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const data = await res.json();
    setAssigned(data.results || []);
  };

  const fetchAvailable = async () => {
    const res = await fetch(
      `http://127.0.0.1:8000/api/get_unassigned_inspectors/${reforestation_area_id}/`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const data = await res.json();
    setAvailable(data.results || []);
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchAssigned();
      await fetchAvailable();
      setLoading(false);
    };
    load();
  }, []);

  const { userRole } = useUserRole();
  const [useruserRole, setUseruserRole] = useState("");

  useEffect(() => {
    if (userRole === "treeGrowers" || userRole === "CityENROHead") {
      setUseruserRole("");
      return;
    }
    if (userRole === "GISSpecialist") {
      setUseruserRole("/GISS");
      return;
    }
    if (userRole === "DataManager") {
      setUseruserRole("/DataManager");
      return;
    }
  }, [userRole]);

  const handleAssign = (inspector: Inspector) => {
    setAvailable((prev) => prev.filter((i) => i.user_id !== inspector.user_id));
    setAssigned((prev) => {
      if (prev.some((i) => i.user_id === inspector.user_id)) return prev;
      return [...prev, inspector];
    });
  };

  const handleRemove = (inspector: Inspector) => {
    setAssigned((prev) => prev.filter((i) => i.user_id !== inspector.user_id));
    setAvailable((prev) => {
      if (prev.some((i) => i.user_id === inspector.user_id)) return prev;
      return [...prev, inspector];
    });
  };

  const handleSave = async () => {
    setSaving(true);
    const ids = assigned.map((i) => i.user_id);

    const res = await fetch(`http://127.0.0.1:8000/api/assign_inspector/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ reforestation_area_id, user_ids: ids }),
    });

    const data = await res.json();
    setSaving(false);

    if (res.ok) {
      setPSAlert({ type: "success", title: "Success", message: "Assignments saved successfully!" });
    } else {
      setPSAlert({ type: "error", title: "Error", message: data.error || "Save failed" });
    }
  };

  const handleCancel = () => navigate(`${useruserRole}/reforestation-areas`);

  const filteredAssigned = assigned.filter(
    (i) =>
      i.full_name.toLowerCase().includes(searchAssigned.toLowerCase()) ||
      i.email.toLowerCase().includes(searchAssigned.toLowerCase()),
  );

  const filteredAvailable = available.filter(
    (i) =>
      i.full_name.toLowerCase().includes(searchAvailable.toLowerCase()) ||
      i.email.toLowerCase().includes(searchAvailable.toLowerCase()),
  );

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm font-medium">Loading inspectors...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {PSalert && (
        <PlantScopeAlert
          type={PSalert.type}
          title={PSalert.title}
          message={PSalert.message}
          onClose={() => setPSAlert(null)}
        />
      )}

      {/* Page Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={handleCancel}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-800">Assign Onsite Inspectors</h1>
            <p className="text-sm text-gray-500">
              Area ID #{reforestation_area_id} — drag inspectors between panels to manage assignments
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1.5"
          >
            <X size={15} />
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5 shadow-sm"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save size={15} />
            )}
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Panels */}
      <div className="flex flex-1 gap-5 p-5 overflow-hidden">

        {/* Assigned Panel */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
          {/* Panel Header */}
          <div className="bg-linear-to-r from-green-700 to-green-600 px-5 py-4 flex items-center justify-between rounded-t-xl">
            <div className="flex items-center gap-2.5">
              <div className="bg-white/20 p-1.5 rounded-lg">
                <UserCheck size={18} className="text-white" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-white">Assigned</h2>
                <p className="text-green-100 text-xs">Currently assigned to this area</p>
              </div>
            </div>
            <span className="bg-white/20 text-white text-sm font-semibold px-2.5 py-0.5 rounded-full">
              {assigned.length}
            </span>
          </div>

          {/* Search */}
          <div className="px-4 pt-4 pb-2">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchAssigned}
                onChange={(e) => setSearchAssigned(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-gray-50"
              />
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
            {filteredAssigned.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-10">
                <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                  <UserCheck size={24} className="text-gray-300" />
                </div>
                <p className="text-gray-400 text-sm font-medium">
                  {searchAssigned ? "No results found" : "No inspectors assigned yet"}
                </p>
                <p className="text-gray-300 text-xs mt-1">
                  {searchAssigned ? "Try a different search term" : "Add inspectors from the right panel"}
                </p>
              </div>
            ) : (
              filteredAssigned.map((inspector) => (
                <div
                  key={inspector.user_id}
                  className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-100 hover:border-green-300 transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar inspector={inspector} />
                    <div className="min-w-0">
                      <p className="font-medium text-gray-800 text-sm truncate">{inspector.full_name}</p>
                      <p className="text-xs text-gray-500 truncate">{inspector.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemove(inspector)}
                    className="ml-2 p-2 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                    title="Remove assignment"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Divider hint */}
        <div className="flex items-center">
          <div className="text-gray-300 text-xs flex flex-col items-center gap-1 select-none">
            <span>⟵</span>
            <span className="writing-mode-vertical text-center" style={{ writingMode: "vertical-rl" }}>
              manage
            </span>
            <span>⟶</span>
          </div>
        </div>

        {/* Available Panel */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
          {/* Panel Header */}
          <div className="bg-linear-to-r from-slate-600 to-slate-500 px-5 py-4 flex items-center justify-between rounded-t-xl">
            <div className="flex items-center gap-2.5">
              <div className="bg-white/20 p-1.5 rounded-lg">
                <Users size={18} className="text-white" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-white">Available</h2>
                <p className="text-slate-300 text-xs">Unassigned inspectors</p>
              </div>
            </div>
            <span className="bg-white/20 text-white text-sm font-semibold px-2.5 py-0.5 rounded-full">
              {available.length}
            </span>
          </div>

          {/* Search */}
          <div className="px-4 pt-4 pb-2">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchAvailable}
                onChange={(e) => setSearchAvailable(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent bg-gray-50"
              />
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
            {filteredAvailable.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-10">
                <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                  <Users size={24} className="text-gray-300" />
                </div>
                <p className="text-gray-400 text-sm font-medium">
                  {searchAvailable ? "No results found" : "All inspectors assigned"}
                </p>
                <p className="text-gray-300 text-xs mt-1">
                  {searchAvailable ? "Try a different search term" : "Remove assignments to make them available"}
                </p>
              </div>
            ) : (
              filteredAvailable.map((inspector) => (
                <div
                  key={inspector.user_id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100 hover:border-green-200 hover:bg-green-50/40 transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar inspector={inspector} />
                    <div className="min-w-0">
                      <p className="font-medium text-gray-800 text-sm truncate">{inspector.full_name}</p>
                      <p className="text-xs text-gray-500 truncate">{inspector.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleAssign(inspector)}
                    className="ml-2 p-2 rounded-lg text-green-500 hover:bg-green-100 hover:text-green-700 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                    title="Assign inspector"
                  >
                    <Plus size={15} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
