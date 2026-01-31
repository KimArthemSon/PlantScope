"use client";
import { useState, useMemo } from "react";
import Sidebar from "../../components/layout/Sidebar";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Search, Filter } from "lucide-react";
import L from "leaflet";

// Fix Leaflet marker icons for Next.js
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

const DefaultIcon = L.icon({
  iconUrl: markerIcon, // <-- just use the string directly
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

export default function OfficialPlantingSites() {
  const [search, setSearch] = useState("");
  const [barangayFilter, setBarangayFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [sites] = useState([
    {
      id: 1,
      name: "Ormoc Watershed A",
      barangay: "San Jose",
      area: "12 ha",
      trees: 3000,
      status: "Planted",
      lat: 11.0186,
      lng: 124.6075,
    },
    {
      id: 2,
      name: "Lake Danao North Zone",
      barangay: "Libas",
      area: "8 ha",
      trees: 2200,
      status: "Ongoing",
      lat: 11.0901,
      lng: 124.6333,
    },
    {
      id: 3,
      name: "Valencia Agro Reforest",
      barangay: "Valencia",
      area: "10 ha",
      trees: 2700,
      status: "Planted",
      lat: 11.0404,
      lng: 124.6019,
    },
    {
      id: 4,
      name: "Tongonan Hills",
      barangay: "Tongonan",
      area: "15 ha",
      trees: 4000,
      status: "Under Maintenance",
      lat: 11.1032,
      lng: 124.6341,
    },
  ]);

  // Filtering Logic
  const filteredSites = useMemo(() => {
    return sites.filter((site) => {
      const matchesSearch = site.name
        .toLowerCase()
        .includes(search.toLowerCase());
      const matchesBarangay = barangayFilter
        ? site.barangay === barangayFilter
        : true;
      const matchesStatus = statusFilter ? site.status === statusFilter : true;
      return matchesSearch && matchesBarangay && matchesStatus;
    });
  }, [sites, search, barangayFilter, statusFilter]);

  return (
    <div className="flex h-screen overflow-hidden">
     

      <main className="flex-1 bg-gray-50 p-8 overflow-y-auto">
        {/* Header */}
        <h1 className="text-3xl font-bold text-[#052e87] mb-2">
          🌳 Official Planting Sites
        </h1>
        <p className="text-gray-600 mb-6">
          View, analyze, and manage officially approved reforestation areas in
          Ormoc City.
        </p>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="flex items-center bg-white border rounded-lg px-3 py-2 shadow-sm w-full sm:w-80">
            <Search size={18} className="text-gray-500 mr-2" />
            <input
              type="text"
              placeholder="Search site..."
              className="w-full outline-none text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex items-center bg-white border rounded-lg px-3 py-2 shadow-sm">
            <Filter size={16} className="text-gray-500 mr-2" />
            <select
              value={barangayFilter}
              onChange={(e) => setBarangayFilter(e.target.value)}
              className="outline-none text-sm bg-transparent"
            >
              <option value="">All Barangays</option>
              <option value="San Jose">San Jose</option>
              <option value="Libas">Libas</option>
              <option value="Valencia">Valencia</option>
              <option value="Tongonan">Tongonan</option>
            </select>
          </div>

          <div className="flex items-center bg-white border rounded-lg px-3 py-2 shadow-sm">
            <Filter size={16} className="text-gray-500 mr-2" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="outline-none text-sm bg-transparent"
            >
              <option value="">All Status</option>
              <option value="Planted">Planted</option>
              <option value="Ongoing">Ongoing</option>
              <option value="Under Maintenance">Under Maintenance</option>
            </select>
          </div>
        </div>

        {/* Table Section */}
        <div className="bg-white rounded-xl shadow-md border overflow-x-auto mb-6">
          <table className="min-w-full text-sm text-left border-collapse">
            <thead className="bg-[#052e87] text-white">
              <tr>
                <th className="py-3 px-4">#</th>
                <th className="py-3 px-4">Site Name</th>
                <th className="py-3 px-4">Barangay</th>
                <th className="py-3 px-4">Area</th>
                <th className="py-3 px-4">No. of Trees</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredSites.map((site, index) => (
                <tr
                  key={site.id}
                  className="hover:bg-gray-50 border-b last:border-none"
                >
                  <td className="py-3 px-4">{index + 1}</td>
                  <td className="py-3 px-4 font-medium">{site.name}</td>
                  <td className="py-3 px-4">{site.barangay}</td>
                  <td className="py-3 px-4">{site.area}</td>
                  <td className="py-3 px-4">{site.trees}</td>
                  <td
                    className={`py-3 px-4 font-semibold ${
                      site.status === "Planted"
                        ? "text-green-600"
                        : site.status === "Ongoing"
                        ? "text-yellow-600"
                        : "text-blue-600"
                    }`}
                  >
                    {site.status}
                  </td>
                </tr>
              ))}
              {filteredSites.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="text-center py-6 text-gray-500 italic"
                  >
                    No official planting sites found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Map Section */}
        <div className="bg-white rounded-xl shadow-md border p-4">
          <h2 className="text-lg font-semibold mb-3 text-[#052e87]">
            🗺️ Site Map
          </h2>
          <MapContainer
            center={[11.0355, 124.605]}
            zoom={12}
            className="h-[80vh] rounded-lg z-0"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {filteredSites.map((site) => (
              <Marker key={site.id} position={[site.lat, site.lng]}>
                <Popup>
                  <b>{site.name}</b>
                  <br />
                  Barangay: {site.barangay}
                  <br />
                  Area: {site.area}
                  <br />
                  Trees: {site.trees}
                  <br />
                  Status: {site.status}
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </main>
    </div>
  );
}
