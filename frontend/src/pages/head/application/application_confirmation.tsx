import { useEffect, useState } from "react";
import { ChevronRight, ChevronLeft, FileCheck2, Calendar, Users } from "lucide-react";
import PlantScopeAlert from "../../../components/alert/PlantScopeAlert";
import { useNavigate } from "react-router-dom";
import LoaderPending from "../../../components/layout/loaderSmall";
import { api } from "@/constant/api";

// ✅ Updated Interface to match new backend response
interface Application {
  application_id: number;
  group_name: string;
  group_type: string;
  group_profile: string | null;
  title: string;
  total_treegrowers_will_participate: number;
  classification: string;
  status: string;
  orientation_date: string | null; 
  site_name: string | null;
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

export default function Application_confirmation() {
  const [application, setApplication] = useState<Application[]>([]);
  const [filter, setFilter] = useState<Filter>({
    search: "",
    entries: 10,
    page: 1,
    total_page: 1,
    status: "for_head", // Default to applications waiting for Head confirmation
    classification: "All",
  });

  const [loading, setLoading] = useState(false);
  const [PSalert, setPSAlert] = useState<{
    type: "success" | "failed" | "error";
    title: string;
    message: string;
  } | null>(null);

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
        `${api}api/get_applications/?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!response.ok) throw new Error("Failed to fetch Application.");

      const data = await response.json();
      setApplication(data.data);
      setFilter((prev) => ({ ...prev, total_page: data.total_page }));
    } catch (err) {
      setPSAlert({
        type: "error",
        title: "Failed",
        message: "Failed to load Applications.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplication();
  }, [filter.page, filter.entries, filter.classification, filter.status]);

  // ✅ Helper to format date
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Not scheduled";
    try {
      return new Date(dateStr).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
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

      <main className="flex-1 p-8 w-full max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#0F4A2F]">Head Confirmation Queue</h1>
          <p className="text-sm text-gray-500 mt-1">Review and approve applications evaluated by the Data Manager.</p>
        </div>

        {/* Filters */}
        <div className="flex items-center mb-7 gap-4 flex-wrap">
          <label className="text-sm font-medium text-gray-700">Show entries: </label>
          <select
            value={filter.entries}
            onChange={(e) =>
              setFilter((prev) => ({
                ...prev,
                entries: Number(e.target.value),
                page: 1,
              }))
            }
            className="border border-gray-300 p-2 rounded-md text-[.8rem] focus:ring-2 focus:ring-green-500 outline-none"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>

          <label className="text-sm font-medium text-gray-700">Classification:</label>
          <select
            value={filter.classification}
            onChange={(e) =>
              setFilter((prev) => ({
                ...prev,
                classification: e.target.value,
                page: 1,
              }))
            }
            className="border border-gray-300 p-2 rounded-md text-[.8rem] focus:ring-2 focus:ring-green-500 outline-none"
          >
            <option value="All">All Applicants</option>
            <option value="new">First-Time (New)</option>
            <option value="old">Returning (Old)</option>
          </select>

          <input
            type="text"
            placeholder="Search Group Name..."
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
                fetchApplication();
              }
            }}
            className="border border-gray-300 rounded-md p-2 w-64 text-[.8rem] ml-auto focus:ring-2 focus:ring-green-500 outline-none"
          />
        </div>

        {/* Table */}
        <div className="overflow-x-auto shadow-lg rounded-lg border border-gray-200 bg-white">
          {loading && <LoaderPending />}
          <table className="relative min-w-full">
            <thead className="bg-[#0f4a2fe0] text-white">
              <tr>
                <th className="py-3 px-5 text-left text-[.85rem] font-semibold">No</th>
                <th className="py-3 px-5 text-left text-[.85rem] font-semibold">Group</th>
                <th className="py-3 px-5 text-left text-[.85rem] font-semibold">Title</th>
                <th className="py-3 px-5 text-left text-[.85rem] font-semibold">Classification</th>
                <th className="py-3 px-5 text-left text-[.85rem] font-semibold">Growers</th>
                <th className="py-3 px-5 text-left text-[.85rem] font-semibold">Orientation Date</th>
                <th className="py-3 px-5 text-left text-[.85rem] font-semibold">Submitted</th>
                <th className="py-3 px-5 text-center text-[.85rem] font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {application.length > 0 ? (
                application.map((app, index) => (
                  <tr
                    key={app.application_id}
                    className={`${index % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-green-50/30 transition`}
                  >
                    <td className="py-3 px-5 text-[.85rem] text-gray-600">
                      {index + 1 + (filter.page - 1) * filter.entries}
                    </td>
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-3">
                        <img
                          src={app.group_profile ? (app.group_profile.startsWith('http') ? app.group_profile : api + app.group_profile) : 'https://via.placeholder.com/40'}
                          className="rounded-full h-10 w-10 object-cover border border-gray-200"
                          alt="group profile"
                        />
                        <div>
                          <h4 className="font-bold text-[.85rem] text-gray-800">
                            {app.group_name}
                          </h4>
                          <span className="text-gray-500 text-[.7rem]">
                            {app.group_type}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-5 text-[.85rem] font-medium text-gray-700 max-w-[150px] truncate">
                      {app.title}
                    </td>
                    <td className="py-3 px-5">
                      {app.classification === "new" ? (
                        <span className="px-2 py-1 text-[.7rem] font-semibold rounded-full bg-blue-100 text-blue-800">
                          First-Time
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-[.7rem] font-semibold rounded-full bg-purple-100 text-purple-800">
                          Returning
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-5 text-[.85rem] text-gray-700">
                      <div className="flex items-center gap-1.5">
                        <Users size={14} className="text-gray-400" />
                        {app.total_treegrowers_will_participate}
                      </div>
                    </td>
                    <td className="py-3 px-5 text-[.85rem]">
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <Calendar size={14} className={app.orientation_date ? "text-green-600" : "text-gray-400"} />
                        <span className={app.orientation_date ? "font-medium" : "italic text-gray-400"}>
                          {formatDate(app.orientation_date)}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-5 text-[.85rem] text-gray-500">
                      {app.created_at}
                    </td>
                    <td className="py-3 px-5 text-center">
                      <button
                        onClick={() => {
                            navigate("/evaluation/" + app.application_id);
                          }}
                        className="inline-flex items-center gap-1.5 bg-[#0F4A2F] hover:bg-[#1a6b44] text-white px-3 py-1.5 rounded-md text-[.8rem] font-semibold transition-colors shadow-sm"
                      >
                        <FileCheck2 size={14} />
                        Review & Confirm
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={8}
                    className="text-center py-8 text-gray-500 italic bg-gray-50"
                  >
                    No applications pending Head confirmation.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center gap-1 mt-5 w-full justify-end">
          <button
            disabled={filter.page <= 1}
            onClick={() =>
              setFilter((prev) => ({ ...prev, page: prev.page - 1 }))
            }
            className="px-2 py-1 border rounded-md text-gray-700 hover:bg-gray-100 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={19} />
          </button>

          {Array.from({ length: filter.total_page }, (_, i) => i + 1).map(
            (p) => (
              <button
                key={p}
                onClick={() => setFilter((prev) => ({ ...prev, page: p }))}
                className={`px-3 py-1 border rounded-md cursor-pointer text-[.8rem] ${
                  p === filter.page
                    ? "bg-green-600 text-white border-green-600"
                    : "text-gray-700 hover:bg-gray-100 border-gray-300"
                }`}
              >
                {p}
              </button>
            )
          )}

          <button
            disabled={filter.page >= filter.total_page}
            onClick={() =>
              setFilter((prev) => ({ ...prev, page: prev.page + 1 }))
            }
            className="px-2 py-1 border rounded-md text-gray-700 hover:bg-gray-100 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight size={19} />
          </button>
        </div>
      </main>
    </div>
  );
}