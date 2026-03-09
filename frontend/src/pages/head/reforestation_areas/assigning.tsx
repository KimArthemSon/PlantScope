import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { X, Plus, Trash2, File } from "lucide-react";

interface Inspector {
  user_id: number;
  full_name: string;
  email: string;
  profile_img?: string;
}

export default function Assign_onsite_inspector() {
  const { id } = useParams<{ id: string }>();
  const reforestation_area_id = parseInt(id || "0", 10);
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const [assigned, setAssigned] = useState<Inspector[]>([]);
  const [available, setAvailable] = useState<Inspector[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchAssigned, setSearchAssigned] = useState("");
  const [searchAvailable, setSearchAvailable] = useState("");

  // -------------------------
  // FETCH ASSIGNED
  // -------------------------
  const fetchAssigned = async () => {
    const res = await fetch(
      `http://127.0.0.1:8000/api/get_assigned_list/${reforestation_area_id}/`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    const data = await res.json();
    console.log("Assigned", data);
    setAssigned(data.results || []);
  };

  // -------------------------
  // FETCH UNASSIGNED
  // -------------------------
  const fetchAvailable = async () => {
    const res = await fetch(
      `http://127.0.0.1:8000/api/get_unassigned_inspectors/${reforestation_area_id}/`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    const data = await res.json();
    console.log("Availe: ", data);
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

  // -------------------------
  // ASSIGN
  // -------------------------
  const handleAssign = (inspector: Inspector) => {
    setAvailable((prev) => prev.filter((i) => i.user_id !== inspector.user_id));

    setAssigned((prev) => {
      if (prev.some((i) => i.user_id === inspector.user_id)) return prev;
      return [...prev, inspector];
    });
  };

  // -------------------------
  // REMOVE
  // -------------------------
  const handleRemove = (inspector: Inspector) => {
    setAssigned((prev) => prev.filter((i) => i.user_id !== inspector.user_id));

    setAvailable((prev) => {
      if (prev.some((i) => i.user_id === inspector.user_id)) return prev;
      return [...prev, inspector];
    });
  };

  // -------------------------
  // SAVE
  // -------------------------
  const handleSave = async () => {
    const ids = assigned.map((i) => i.user_id);

    const res = await fetch(`http://127.0.0.1:8000/api/assign_inspector/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        reforestation_area_id,
        user_ids: ids,
      }),
    });

    const data = await res.json();

    if (res.ok) {
      alert("Assignments saved");
    } else {
      alert(data.error || "Save failed");
    }
  };

  const handleCancel = () => navigate("/reforestation-areas");

  // -------------------------
  // SEARCH FILTERS
  // -------------------------
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

  if (loading) return <div className="p-4">Loading...</div>;

  return (
    <div className="flex h-screen p-4 gap-4 bg-gray-100">
      {/* LEFT */}
      <div className="w-1/2 bg-white rounded-lg shadow flex flex-col pb-4">
        <h2 className="text-lg font-bold text-white p-5 bg-green-700 rounded-md">
          Assigned Onsite Inspectors
        </h2>

        <div className="p-2">
          <input
            type="text"
            placeholder="Search assigned..."
            value={searchAssigned}
            onChange={(e) => setSearchAssigned(e.target.value)}
            className="w-full p-1 border rounded text-sm"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-2">
          {filteredAssigned.map((inspector) => (
            <div
              key={inspector.user_id}
              className="flex items-center justify-between p-2 mb-2 bg-gray-50 rounded shadow border border-green-700"
            >
              <div className="flex items-center gap-3">
                {inspector.profile_img && (
                  <img
                    src={"http://127.0.0.1:8000" + inspector.profile_img}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                )}

                <div>
                  <p className="font-medium">{inspector.full_name}</p>
                  <p className="text-sm text-gray-500">{inspector.email}</p>
                </div>
              </div>

              <button
                onClick={() => handleRemove(inspector)}
                className="px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT */}
      <div className="w-1/2 bg-white rounded-lg shadow flex flex-col pb-4">
        <h2 className="text-lg font-bold text-white p-5 bg-green-700 rounded-md">
          Available Onsite Inspectors
        </h2>

        <div className="p-2">
          <input
            type="text"
            placeholder="Search available..."
            value={searchAvailable}
            onChange={(e) => setSearchAvailable(e.target.value)}
            className="w-full p-1 border rounded text-sm"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-2">
          {filteredAvailable.map((inspector) => (
            <div
              key={inspector.user_id}
              className="flex items-center justify-between p-2 mb-2 bg-gray-50 rounded shadow border border-green-700"
            >
              <div className="flex items-center gap-3">
                {inspector.profile_img && (
                  <img
                    src={"http://127.0.0.1:8000" + inspector.profile_img}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                )}

                <div>
                  <p className="font-medium">{inspector.full_name}</p>
                  <p className="text-sm text-gray-500">{inspector.email}</p>
                </div>
              </div>

              <button
                onClick={() => handleAssign(inspector)}
                className="px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600"
              >
                <Plus size={14} />
              </button>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 mt-4 px-2">
          <button
            onClick={handleCancel}
            className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400 flex items-center gap-1"
          >
            <X size={16} /> Cancel
          </button>

          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center gap-1"
          >
            <File size={16} /> Save
          </button>
        </div>
      </div>
    </div>
  );
}
