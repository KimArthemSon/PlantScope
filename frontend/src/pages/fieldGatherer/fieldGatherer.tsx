"use client";
import { useEffect, useState } from "react";
import {
  Plus,
  Edit,
  Trash2,
  Eye,
  CheckCircle,
  XCircle,
  ClipboardCheck,
} from "lucide-react";
import NotFoundPage from "../../components/layout/NotFoundPage";
import { useAuthorize } from "../../hooks/authorization";
import PlantScopeLoader from "../../components/alert/PlantScopeLoader";
import { useNavigate } from "react-router-dom";
export default function FieldGatherer() {
  const [showForm, setShowForm] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [sites, setSites] = useState<any[]>([
    {
      siteName: "Sitio Mahayag",
      officer: "Officer A",
      coordinates: "11.056N, 124.606E",
      soilType: "Loam",
      moisture: "Medium",
      vegetation: "Healthy",
      status: "Pending Feedback",
    },
  ]);
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    siteName: "",
    officer: "",
    coordinates: "",
    soilType: "",
    moisture: "",
    vegetation: "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = () => {
    if (editingIndex !== null) {
      const updatedSites = [...sites];
      updatedSites[editingIndex] = {
        ...formData,
        status: sites[editingIndex].status,
      };
      setSites(updatedSites);
      setEditingIndex(null);
    } else {
      setSites([...sites, { ...formData, status: "Pending Feedback" }]);
    }
    setFormData({
      siteName: "",
      officer: "",
      coordinates: "",
      soilType: "",
      moisture: "",
      vegetation: "",
    });
    setShowForm(false);
  };

  const handleEdit = (index: number) => {
    setFormData(sites[index]);
    setEditingIndex(index);
    setShowForm(true);
  };

  const handleDelete = (index: number) => {
    if (confirm("Are you sure you want to delete this site?")) {
      setSites(sites.filter((_, i) => i !== index));
    }
  };

  const handleAccept = (index: number) => {
    const updated = [...sites];
    updated[index].status = "Accepted";
    setSites(updated);
  };

  const handleReject = (index: number) => {
    const updated = [...sites];
    updated[index].status = "Rejected";
    setSites(updated);
  };

  const { isAuthorized, isLoading } = useAuthorize("CityENROHead");
  if (isLoading) {
    return <PlantScopeLoader />;
  }
  if (!localStorage.getItem("token")) {
    navigate("/Login");
  }
  if (!isAuthorized) {
    return <NotFoundPage />;
  }

  return (
    <div className="flex min-h-screen">
      <main className="flex-1 bg-gray-50 p-6 overflow-y-auto">
        <h1 className="text-2xl font-bold text-[#052e87] mb-6 flex items-center gap-2">
          <ClipboardCheck className="text-[#057501]" /> Field Data Gatherer
        </h1>

        {/* Action Bar */}
        <div className="flex gap-5 items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-800">
            Site Assignments
          </h2>
          <button
            onClick={() => {
              setShowForm(!showForm);
              setEditingIndex(null);
            }}
            className="bg-[#052e87] text-white px-4 py-2 rounded-lg  ml-auto flex items-center gap-2 hover:bg-[#063cb4] transition"
          >
            <Plus size={18} /> {showForm ? "Cancel" : "Add New Site"}
          </button>
          <button
            onClick={() => {
              navigate("/NDVIMap");
            }}
            className="bg-[#052e87] text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-[#063cb4] transition"
          >
            <Plus size={18} /> NVDI Map
          </button>
        </div>

        {/* Add/Edit Form */}
        {showForm && (
          <div className="bg-white border rounded-xl p-5 mb-6 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                name="siteName"
                value={formData.siteName}
                onChange={handleChange}
                placeholder="Site Name"
                className="border rounded-lg p-2"
              />
              <select
                name="officer"
                value={formData.officer}
                onChange={handleChange}
                className="border rounded-lg p-2"
              >
                <option value="">Assign Officer</option>
                <option>Officer A</option>
                <option>Officer B</option>
                <option>Officer C</option>
              </select>
              <input
                name="coordinates"
                value={formData.coordinates}
                onChange={handleChange}
                placeholder="Coordinates (e.g. 11.002N, 124.61E)"
                className="border rounded-lg p-2"
              />
              <input
                name="soilType"
                value={formData.soilType}
                onChange={handleChange}
                placeholder="Soil Type"
                className="border rounded-lg p-2"
              />
              <input
                name="moisture"
                value={formData.moisture}
                onChange={handleChange}
                placeholder="Moisture Level"
                className="border rounded-lg p-2"
              />
              <input
                name="vegetation"
                value={formData.vegetation}
                onChange={handleChange}
                placeholder="Vegetation Health"
                className="border rounded-lg p-2"
              />
            </div>

            <div className="flex justify-end mt-4">
              <button
                onClick={handleSubmit}
                className="bg-[#057501] text-white px-4 py-2 rounded-lg hover:bg-[#059601] transition"
              >
                {editingIndex !== null ? "Update Site" : "Save Site"}
              </button>
            </div>
          </div>
        )}

        {/* Table View */}
        <div className="bg-white shadow-sm border rounded-xl overflow-hidden">
          <table className="min-w-full text-sm text-left">
            <thead className="bg-[#052e87] text-white">
              <tr>
                <th className="p-3">Site Name</th>
                <th className="p-3">Officer</th>
                <th className="p-3">Coordinates</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sites.map((site, index) => (
                <tr
                  key={index}
                  className="border-b hover:bg-gray-50 transition text-gray-700"
                >
                  <td className="p-3 font-medium">{site.siteName}</td>
                  <td className="p-3">{site.officer}</td>
                  <td className="p-3">{site.coordinates}</td>
                  <td
                    className={`p-3 font-semibold ${
                      site.status === "Accepted"
                        ? "text-green-600"
                        : site.status === "Rejected"
                          ? "text-red-600"
                          : "text-yellow-600"
                    }`}
                  >
                    {site.status}
                  </td>
                  <td className="p-3 flex justify-center gap-2">
                    <button
                      onClick={() => alert("View field officer feedback")}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <Eye size={18} />
                    </button>
                    <button
                      onClick={() => handleEdit(index)}
                      className="text-yellow-500 hover:text-yellow-700"
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 size={18} />
                    </button>
                    <button
                      onClick={() => handleAccept(index)}
                      className="text-green-600 hover:text-green-700"
                    >
                      <CheckCircle size={18} />
                    </button>
                    <button
                      onClick={() => handleReject(index)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <XCircle size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {sites.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center p-6 text-gray-500">
                    No field assignments available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
