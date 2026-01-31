"use client";
import { useState, useMemo } from "react";
import {
  Eye,
  MessageSquare,
  CheckCircle,
  Filter,
  Search,
//   Check,
  X,
  XCircle,
} from "lucide-react";

export default function SiteVerification() {
  const [selectedSite, setSelectedSite] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [officerFilter, setOfficerFilter] = useState("");
  const [barangayFilter, _] = useState("");

  // Mock data
  const [assignedSites, setAssignedSites] = useState([
    {
      id: 1,
      siteName: "Ormoc Watershed A",
      barangay: "San Jose",
      officer: "Juan Dela Cruz",
      status: "Pending Feedback",
      assignedDate: "2025-11-06",
      feedback:
        "Observed low moisture levels and signs of soil erosion. Needs immediate intervention.",
    },
    {
      id: 2,
      siteName: "Lake Danao Site",
      barangay: "Libas",
      officer: "Maria Santos",
      status: "Completed",
      assignedDate: "2025-11-03",
      feedback:
        "Area suitable for planting. Ground cover vegetation healthy. Recommend inclusion in reforestation.",
    },
    {
      id: 3,
      siteName: "Ormoc Riverbank",
      barangay: "Cogon",
      officer: "Pedro Lopez",
      status: "Under Review",
      assignedDate: "2025-11-07",
      feedback: "Flood-prone area but good soil composition for native trees.",
    },
    {
      id: 4,
      siteName: "Tongonan Reforest",
      barangay: "Tongonan",
      officer: "Ana Reyes",
      status: "Pending Feedback",
      assignedDate: "2025-11-04",
      feedback: "",
    },
    {
      id: 5,
      siteName: "Valencia Agro Site",
      barangay: "Valencia",
      officer: "Juan Dela Cruz",
      status: "Completed",
      assignedDate: "2025-11-01",
      feedback:
        "Strong soil fertility index. Site is ideal for fruit-bearing trees.",
    },
  ]);

  // Filtering + Search Logic
  const filteredSites = useMemo(() => {
    return assignedSites.filter((site) => {
      const matchesSearch =
        site.siteName.toLowerCase().includes(search.toLowerCase()) ||
        site.barangay.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter
        ? site.status === statusFilter
        : true;
      const matchesOfficer = officerFilter
        ? site.officer === officerFilter
        : true;
      const matchesBarangay = barangayFilter
        ? site.barangay === barangayFilter
        : true;
      return (
        matchesSearch && matchesStatus && matchesOfficer && matchesBarangay
      );
    });
  }, [assignedSites, search, statusFilter, officerFilter, barangayFilter]);

  // Admin decision handlers
  const handleValidate = (id: number) => {
    if (confirm("Approve this site for official reforestation listing?")) {
      setAssignedSites((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, status: "Validated" } : s
        )
      );
      alert("✅ Site validated successfully.");
      setSelectedSite(null);
    }
  };

  const handleReject = (id: number) => {
    if (confirm("Reject this site and mark as not suitable?")) {
      setAssignedSites((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, status: "Rejected" } : s
        )
      );
      alert("❌ Site rejected and removed from candidate list.");
      setSelectedSite(null);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      
      <main className="flex-1 bg-gray-50 p-8 overflow-y-auto">
        {/* Header */}
        <h1 className="text-3xl font-bold text-[#052e87] mb-2">
          🌿 Site Monitoring & Validation
        </h1>
        <p className="text-gray-600 mb-6 max-w-3xl">
          Review feedback submitted by field officers and decide whether to
          <b> Validate </b> or <b> Reject </b> candidate reforestation sites.
        </p>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center mb-5">
          <div className="flex items-center bg-white border rounded-lg px-3 py-2 shadow-sm w-full sm:w-80">
            <Search size={18} className="text-gray-500 mr-2" />
            <input
              type="text"
              placeholder="Search site or barangay..."
              className="w-full outline-none text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 bg-white border rounded-lg px-3 py-2 shadow-sm">
            <Filter size={16} className="text-gray-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="outline-none text-sm bg-transparent"
            >
              <option value="">All Status</option>
              <option value="Pending Feedback">Pending Feedback</option>
              <option value="Under Review">Under Review</option>
              <option value="Completed">Completed</option>
              <option value="Validated">Validated</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          <div className="bg-white border rounded-lg px-3 py-2 shadow-sm">
            <select
              value={officerFilter}
              onChange={(e) => setOfficerFilter(e.target.value)}
              className="outline-none text-sm bg-transparent"
            >
              <option value="">All Officers</option>
              <option value="Juan Dela Cruz">Juan Dela Cruz</option>
              <option value="Maria Santos">Maria Santos</option>
              <option value="Pedro Lopez">Pedro Lopez</option>
              <option value="Ana Reyes">Ana Reyes</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-md border overflow-x-auto">
          <table className="min-w-full text-sm text-left border-collapse">
            <thead className="bg-[#052e87] text-white">
              <tr>
                <th className="py-3 px-4">#</th>
                <th className="py-3 px-4">Site Name</th>
                <th className="py-3 px-4">Barangay</th>
                <th className="py-3 px-4">Officer</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSites.map((site, index) => (
                <tr
                  key={site.id}
                  className="hover:bg-gray-50 border-b last:border-none transition"
                >
                  <td className="py-3 px-4">{index + 1}</td>
                  <td className="py-3 px-4 font-medium">{site.siteName}</td>
                  <td className="py-3 px-4">{site.barangay}</td>
                  <td className="py-3 px-4">{site.officer}</td>
                  <td className="py-3 px-4">{site.assignedDate}</td>
                  <td
                    className={`py-3 px-4 font-semibold ${
                      site.status === "Completed"
                        ? "text-green-600"
                        : site.status === "Validated"
                        ? "text-blue-600"
                        : site.status === "Under Review"
                        ? "text-yellow-600"
                        : site.status === "Rejected"
                        ? "text-red-600"
                        : "text-gray-600"
                    }`}
                  >
                    {site.status}
                  </td>
                  <td className="py-3 px-4 text-center flex justify-center gap-3">
                    <button
                      onClick={() => setSelectedSite(site)}
                      className="text-blue-600 hover:text-blue-800"
                      title="View Feedback"
                    >
                      <MessageSquare size={18} />
                    </button>
                    <button
                      onClick={() => alert(`Viewing details for ${site.siteName}`)}
                      className="text-gray-600 hover:text-gray-800"
                      title="View Details"
                    >
                      <Eye size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredSites.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="text-center py-6 text-gray-500 italic"
                  >
                    No sites found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Feedback Modal */}
        {selectedSite && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white w-full max-w-md rounded-xl shadow-lg p-6 relative">
              <button
                onClick={() => setSelectedSite(null)}
                className="absolute top-3 right-3 text-gray-600 hover:text-gray-800"
              >
                <X size={20} />
              </button>
              <h2 className="text-xl font-semibold text-[#052e87] mb-4">
                Field Officer Feedback
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                <b>Site:</b> {selectedSite.siteName} <br />
                <b>Officer:</b> {selectedSite.officer} <br />
                <b>Status:</b> {selectedSite.status}
              </p>

              <div className="border rounded-md p-3 bg-gray-50 mb-5 text-sm text-gray-700 min-h-[100px]">
                {selectedSite.feedback
                  ? selectedSite.feedback
                  : "No feedback submitted yet."}
              </div>

              {/* Decision Buttons */}
              <div className="flex justify-end gap-3">
                {selectedSite.status === "Completed" ||
                selectedSite.status === "Under Review" ? (
                  <>
                    <button
                      onClick={() => handleReject(selectedSite.id)}
                      className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white flex items-center gap-2"
                    >
                      <XCircle size={18} /> Reject
                    </button>
                    <button
                      onClick={() => handleValidate(selectedSite.id)}
                      className="px-4 py-2 rounded-md bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
                    >
                      <CheckCircle size={18} /> Confirm
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setSelectedSite(null)}
                    className="px-4 py-2 rounded-md border border-gray-400 text-gray-600 hover:bg-gray-100"
                  >
                    Close
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
