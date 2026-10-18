import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  X,
  Plus,
  Trash2,
  Save,
  Search,
  ArrowLeft,
  Users,
  UserCheck,
  Info,
  Mail,
  Phone,
  MapPin,
  Cake,
  Trees,
  Eye,
} from "lucide-react";
import PlantScopeAlert from "@/components/alert/PlantScopeAlert";
import { useUserRole } from "@/hooks/authorization";
import { api } from "@/constant/api.ts";

interface Inspector {
  user_id: number;
  full_name: string;
  email: string;
  profile_img?: string;
}

interface InspectorDetails extends Inspector {
  is_active: boolean;
  contact: string | null;
  address: string | null;
  gender: "M" | "F" | "O" | null;
  birthday: string | null;
  assigned_areas: {
    reforestation_area_id: number;
    name: string;
    barangay: string | null;
    assigned_at: string | null;
  }[];
}

const GENDER_LABEL = { M: "Male", F: "Female", O: "Other" } as const;

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
        src={inspector.profile_img}
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
      api+`api/get_assigned_list/${reforestation_area_id}/`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const data = await res.json();
    setAssigned(data.results || []);
  };

  const fetchAvailable = async () => {
    const res = await fetch(
      api+`api/get_unassigned_inspectors/${reforestation_area_id}/`,
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
  }, [reforestation_area_id]);

  // ── Inspector details modal ────────────────────────────────
  const [details, setDetails] = useState<InspectorDetails | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const openDetails = async (inspector: Inspector) => {
    setDetailsOpen(true);
    setDetailsLoading(true);
    setDetails(null);
    try {
      const res = await fetch(
        api + `api/get_inspector_details/${inspector.user_id}/`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDetails(data);
    } catch {
      setDetailsOpen(false);
      setPSAlert({
        type: "error",
        title: "Error",
        message: "Failed to load inspector details.",
      });
    } finally {
      setDetailsLoading(false);
    }
  };

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

    const res = await fetch(api+`api/assign_inspector/`, {
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
                  <div className="flex items-center ml-2 shrink-0">
                    <button
                      onClick={() => openDetails(inspector)}
                      className="p-2 rounded-lg text-gray-400 hover:bg-white hover:text-green-700 transition-colors"
                      title="View inspector details"
                    >
                      <Info size={15} />
                    </button>
                    <button
                      onClick={() => handleRemove(inspector)}
                      className="p-2 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                      title="Remove assignment"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
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
                  <div className="flex items-center ml-2 shrink-0">
                    <button
                      onClick={() => openDetails(inspector)}
                      className="p-2 rounded-lg text-gray-400 hover:bg-white hover:text-green-700 transition-colors"
                      title="View inspector details"
                    >
                      <Info size={15} />
                    </button>
                    <button
                      onClick={() => handleAssign(inspector)}
                      className="p-2 rounded-lg text-green-500 hover:bg-green-100 hover:text-green-700 transition-colors opacity-0 group-hover:opacity-100"
                      title="Assign inspector"
                    >
                      <Plus size={15} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Inspector Details Modal */}
      {detailsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setDetailsOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-linear-to-r from-green-700 to-green-600 px-5 py-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">Inspector Details</h2>
              <button
                onClick={() => setDetailsOpen(false)}
                className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-md transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {detailsLoading || !details ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="overflow-y-auto p-5 space-y-5">
                {/* Identity */}
                <div className="flex items-center gap-4">
                  {details.profile_img ? (
                    <img
                      src={details.profile_img}
                      alt={details.full_name}
                      className="w-16 h-16 rounded-full object-cover ring-2 ring-green-100"
                    />
                  ) : (
                    <Avatar inspector={details} />
                  )}
                  <div className="min-w-0">
                    <p className="text-lg font-semibold text-gray-800 truncate">
                      {details.full_name}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-green-700 bg-green-50 border border-green-100 px-2 py-0.5 rounded-full">
                        Onsite Inspector
                      </span>
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                          details.is_active
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {details.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Contact info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  {[
                    { icon: Mail, label: "Email", value: details.email },
                    { icon: Phone, label: "Contact", value: details.contact },
                    { icon: MapPin, label: "Address", value: details.address },
                    { icon: Cake, label: "Birthday", value: details.birthday },
                    {
                      icon: UserCheck,
                      label: "Gender",
                      value: details.gender ? GENDER_LABEL[details.gender] : null,
                    },
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex items-start gap-2.5 bg-gray-50 rounded-lg p-2.5 min-w-0">
                      <Icon size={15} className="text-green-600 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[11px] text-gray-400 uppercase tracking-wide">{label}</p>
                        <p className="text-gray-800 wrap-break-word">
                          {value || <span className="text-gray-400 italic">Not set</span>}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Assigned areas */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-2">
                    <Trees size={16} className="text-green-600" />
                    Assigned Reforestation Areas
                    <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                      {details.assigned_areas.length}
                    </span>
                  </h3>
                  {details.assigned_areas.length === 0 ? (
                    <p className="text-sm text-gray-400 italic bg-gray-50 rounded-lg p-3 text-center">
                      Not assigned to any reforestation area yet
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {details.assigned_areas.map((area) => {
                        const isCurrent = area.reforestation_area_id === reforestation_area_id;
                        return (
                          <li
                            key={area.reforestation_area_id}
                            className={`flex items-center justify-between gap-3 p-3 rounded-lg border ${
                              isCurrent ? "bg-green-50 border-green-200" : "bg-white border-gray-200"
                            }`}
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">
                                {area.name}
                                {isCurrent && (
                                  <span className="ml-2 text-[10px] font-semibold uppercase text-green-700">
                                    This area
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-gray-500 flex items-center gap-1">
                                <MapPin size={11} />
                                {area.barangay || "No barangay"}
                                {area.assigned_at && <> · Assigned {area.assigned_at}</>}
                              </p>
                            </div>
                            <button
                              onClick={() =>
                                navigate(
                                  `${useruserRole}/maintenance/view_reforestation_area/${area.reforestation_area_id}`,
                                )
                              }
                              className="p-2 rounded-lg text-gray-400 hover:bg-green-50 hover:text-green-700 transition-colors shrink-0"
                              title="View reforestation area"
                            >
                              <Eye size={15} />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <p className="text-[11px] text-gray-400 mt-2">
                    Shows saved assignments. Unsaved changes on this page aren't included until you click Save Changes.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
