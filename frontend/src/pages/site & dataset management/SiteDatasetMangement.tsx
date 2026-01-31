import Sidebar from "../../components/layout/Sidebar";
import { useState, useMemo } from "react";
import {
  Plus,
  FileDown,
  FileUp,
  Edit,
  Trash2,
  Eye,
  X,
  Search,
  ChevronLeft,
  ChevronRight,
  Filter,
} from "lucide-react";

export default function SiteDatasetManagement() {
  // ✅ Extended dataset
  const [datasets, setDatasets] = useState([
    { id: 1, siteName: "Ormoc Watershed A", brgy: "San Jose", area: "2.5 ha", status: "Ongoing", soil: "Loam", moisture: "Moderate", vegetation: "Cogon Grass" },
    { id: 2, siteName: "Leyte Forest Zone", brgy: "Milagro", area: "4.0 ha", status: "Completed", soil: "Clay", moisture: "High", vegetation: "Mahogany" },
    { id: 3, siteName: "Lake Danao Site", brgy: "Libas", area: "3.2 ha", status: "Pending", soil: "Sandy Loam", moisture: "Low", vegetation: "Mixed Shrubs" },
    { id: 4, siteName: "Ormoc Highland Reforest", brgy: "Danao", area: "5.8 ha", status: "Ongoing", soil: "Loam", moisture: "High", vegetation: "Narra" },
    { id: 5, siteName: "Forest Recovery Zone", brgy: "Alta Vista", area: "6.0 ha", status: "Completed", soil: "Clay Loam", moisture: "High", vegetation: "Acacia" },
    { id: 6, siteName: "Valencia Replant Area", brgy: "Valencia", area: "3.0 ha", status: "Ongoing", soil: "Loam", moisture: "Low", vegetation: "Bamboo" },
    { id: 7, siteName: "Tongonan Reforest", brgy: "Tongonan", area: "2.9 ha", status: "Pending", soil: "Clay", moisture: "Moderate", vegetation: "Gmelina" },
    { id: 8, siteName: "Punta Forest Zone", brgy: "Punta", area: "4.5 ha", status: "Completed", soil: "Sandy Loam", moisture: "High", vegetation: "Ipil-Ipil" },
    { id: 9, siteName: "Liberty Agro Site", brgy: "Liberty", area: "5.0 ha", status: "Ongoing", soil: "Loam", moisture: "Moderate", vegetation: "Banana Mix" },
    { id: 10, siteName: "Matin-ao Watershed", brgy: "Matin-ao", area: "3.8 ha", status: "Completed", soil: "Clay Loam", moisture: "High", vegetation: "Talisay" },
    { id: 11, siteName: "Cabaon-an Reforest Plot", brgy: "Cabaon-an", area: "2.4 ha", status: "Ongoing", soil: "Loam", moisture: "Moderate", vegetation: "Molave" },
    { id: 12, siteName: "Naungan Pilot Site", brgy: "Naungan", area: "3.3 ha", status: "Pending", soil: "Sandy Loam", moisture: "Low", vegetation: "Grassland Mix" },
    { id: 13, siteName: "Guintigui-an Greenbelt", brgy: "Guintigui-an", area: "4.2 ha", status: "Ongoing", soil: "Clay", moisture: "High", vegetation: "Ipil-Ipil" },
    { id: 14, siteName: "Liloan Ridge Project", brgy: "Liloan", area: "5.1 ha", status: "Completed", soil: "Loam", moisture: "High", vegetation: "Mahogany & Narra" },
    { id: 15, siteName: "Ipil Agroforestry", brgy: "Ipil", area: "2.7 ha", status: "Ongoing", soil: "Clay Loam", moisture: "Moderate", vegetation: "Acacia Mangium" },
    { id: 16, siteName: "Tongonan North Plot", brgy: "Tongonan", area: "3.6 ha", status: "Pending", soil: "Sandy Loam", moisture: "Low", vegetation: "Pioneer Grass" },
    { id: 17, siteName: "Can-untog Restoration Zone", brgy: "Can-untog", area: "6.2 ha", status: "Completed", soil: "Clay", moisture: "High", vegetation: "Mixed Timber" },
  ]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [soilFilter, setSoilFilter] = useState("");
  const [moistureFilter, setMoistureFilter] = useState("");
  const [selected, setSelected] = useState<any | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(10); // default entries

  // ✅ Filtering + Search Logic
  const filteredData = useMemo(() => {
    return datasets.filter((data) => {
      const matchesSearch =
        data.siteName.toLowerCase().includes(search.toLowerCase()) ||
        data.brgy.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter ? data.status === statusFilter : true;
      const matchesSoil = soilFilter ? data.soil === soilFilter : true;
      const matchesMoisture = moistureFilter ? data.moisture === moistureFilter : true;
      return matchesSearch && matchesStatus && matchesSoil && matchesMoisture;
    });
  }, [datasets, search, statusFilter, soilFilter, moistureFilter]);

  const totalPages = Math.ceil(filteredData.length / perPage);
  const displayedData = filteredData.slice((currentPage - 1) * perPage, currentPage * perPage);

  const handleExport = () => alert("Exporting to Excel... (function to be implemented)");
  const handleImport = () => alert("Import Excel... (function to be implemented)");
  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this record?")) {
      setDatasets(datasets.filter((d) => d.id !== id));
    }
  };

  const handleNext = () => setCurrentPage((p) => Math.min(p + 1, totalPages));
  const handlePrev = () => setCurrentPage((p) => Math.max(p - 1, 1));

  return (
    <div className="flex h-screen overflow-hidden">
   
      <main className="flex-1 bg-gray-50 p-8 overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex gap-2 ml-auto mb-5">
            <button onClick={handleImport} className="flex items-center gap-2 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-md transition">
              <FileUp size={18} /> Import Excel
            </button>
            <button onClick={handleExport} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md transition">
              <FileDown size={18} /> Export Excel
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center mb-5">
          <div className="flex items-center bg-white border rounded-lg px-3 py-2 shadow-sm w-full sm:w-80">
            <Search size={18} className="text-gray-500 mr-2" />
            <input
              type="text"
              placeholder="Search site or barangay..."
              className="w-full outline-none text-sm"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          <div className="flex items-center gap-2 bg-white border rounded-lg px-3 py-2 shadow-sm">
            <Filter size={16} className="text-gray-500" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="outline-none text-sm bg-transparent"
            >
              <option value="">All Status</option>
              <option value="Ongoing">Ongoing</option>
              <option value="Completed">Completed</option>
              <option value="Pending">Pending</option>
            </select>
          </div>

          <div className="bg-white border rounded-lg px-3 py-2 shadow-sm">
            <select
              value={soilFilter}
              onChange={(e) => {
                setSoilFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="outline-none text-sm bg-transparent"
            >
              <option value="">All Soil Types</option>
              <option value="Loam">Loam</option>
              <option value="Clay">Clay</option>
              <option value="Clay Loam">Clay Loam</option>
              <option value="Sandy Loam">Sandy Loam</option>
            </select>
          </div>

          <div className="bg-white border rounded-lg px-3 py-2 shadow-sm">
            <select
              value={moistureFilter}
              onChange={(e) => {
                setMoistureFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="outline-none text-sm bg-transparent"
            >
              <option value="">All Moisture</option>
              <option value="Low">Low</option>
              <option value="Moderate">Moderate</option>
              <option value="High">High</option>
            </select>
          </div>
        </div>

        {/* Show entries + Table */}
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">
            <span>Show</span>
            <select
              value={perPage}
              onChange={(e) => {
                setPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="outline-none border rounded px-2 py-1 text-sm"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={75}>75</option>
              <option value={100}>100</option>
            </select>
            <span>entries</span>
          </div>
          <p className="text-gray-600">
            Showing {displayedData.length} of {filteredData.length} entries
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-md border overflow-x-auto">
          <table className="min-w-full text-sm text-left border-collapse">
            <thead className="bg-[#052e87] text-white">
              <tr>
                <th className="py-3 px-4">#</th>
                <th className="py-3 px-4">Site Name</th>
                <th className="py-3 px-4">Barangay</th>
                <th className="py-3 px-4">Area</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayedData.map((data, index) => (
                <tr key={data.id} className="hover:bg-gray-50 border-b last:border-none transition">
                  <td className="py-3 px-4">{(currentPage - 1) * perPage + index + 1}</td>
                  <td className="py-3 px-4 font-medium">{data.siteName}</td>
                  <td className="py-3 px-4">{data.brgy}</td>
                  <td className="py-3 px-4">{data.area}</td>
                  <td
                    className={`py-3 px-4 font-semibold ${
                      data.status === "Ongoing"
                        ? "text-yellow-600"
                        : data.status === "Completed"
                        ? "text-green-600"
                        : "text-gray-600"
                    }`}
                  >
                    {data.status}
                  </td>
                  <td className="py-3 px-4 text-center flex justify-center gap-3">
                    <button onClick={() => setSelected(data)} className="text-green-600 hover:text-green-800" title="View Dataset">
                      <Eye size={18} />
                    </button>
                    <button onClick={() => (window.location.href = `/edit-site/${data.id}`)} className="text-blue-600 hover:text-blue-800" title="Edit Site">
                      <Edit size={18} />
                    </button>
                    <button onClick={() => handleDelete(data.id)} className="text-red-600 hover:text-red-800" title="Delete Site">
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {displayedData.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-6 text-gray-500 italic">
                    No records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex justify-between items-center mt-4 text-sm">
          <div></div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrev}
              disabled={currentPage === 1}
              className={`p-2 rounded-md border ${
                currentPage === 1
                  ? "text-gray-400 border-gray-200 cursor-not-allowed"
                  : "text-[#052e87] border-[#052e87] hover:bg-[#052e87] hover:text-white"
              } transition`}
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-gray-600">Page {currentPage} of {totalPages}</span>
            <button
              onClick={handleNext}
              disabled={currentPage === totalPages}
              className={`p-2 rounded-md border ${
                currentPage === totalPages
                  ? "text-gray-400 border-gray-200 cursor-not-allowed"
                  : "text-[#052e87] border-[#052e87] hover:bg-[#052e87] hover:text-white"
              } transition`}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Modal */}
        {selected && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white w-full max-w-md rounded-xl shadow-lg p-6 relative">
              <button onClick={() => setSelected(null)} className="absolute top-3 right-3 text-gray-600 hover:text-gray-800">
                <X size={20} />
              </button>
              <h2 className="text-xl font-semibold text-[#052e87] mb-4">Site Dataset Details</h2>
              <div className="space-y-2 text-sm">
                <p><strong>Site Name:</strong> {selected.siteName}</p>
                <p><strong>Barangay:</strong> {selected.brgy}</p>
                <p><strong>Area:</strong> {selected.area}</p>
                <p><strong>Status:</strong> {selected.status}</p>
                <p><strong>Soil Type:</strong> {selected.soil}</p>
                <p><strong>Moisture Level:</strong> {selected.moisture}</p>
                <p><strong>Vegetation:</strong> {selected.vegetation}</p>
              </div>
              <div className="mt-4 text-right">
                <button onClick={() => setSelected(null)} className="bg-[#052e87] text-white px-4 py-2 rounded-md hover:bg-[#0342b5] transition">
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
