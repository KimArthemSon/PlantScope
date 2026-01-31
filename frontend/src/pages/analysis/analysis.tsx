"use client";
import { useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import {
  BarChart,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import { Search, FileDown } from "lucide-react";
import { useNavigate } from "react-router-dom";

// Custom marker icons by status
const iconUrls = {
  healthy: "https://maps.gstatic.com/mapfiles/ms2/micons/green-dot.png",
  degraded: "https://maps.gstatic.com/mapfiles/ms2/micons/yellow-dot.png",
  needsPlanting: "https://maps.gstatic.com/mapfiles/ms2/micons/red-dot.png",
};

const markerIcon = (status: string) =>
  L.icon({
    iconUrl:
      status === "Healthy"
        ? iconUrls.healthy
        : status === "Degraded"
          ? iconUrls.degraded
          : iconUrls.needsPlanting,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
  });

export default function Analysis() {
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();
  // Example mock dataset
  const sites = [
    {
      id: 1,
      name: "Ormoc Watershed A",
      brgy: "San Jose",
      status: "Needs Planting",
      vegetation: 40,
      soilMoisture: "Low",
      erosionRisk: "High",
      coords: [11.024, 124.615],
    },
    {
      id: 2,
      name: "Lake Danao Site",
      brgy: "Libas",
      status: "Healthy",
      vegetation: 80,
      soilMoisture: "Moderate",
      erosionRisk: "Low",
      coords: [11.073, 124.615],
    },
    {
      id: 3,
      name: "Forest Zone Leyte",
      brgy: "Milagro",
      status: "Degraded",
      vegetation: 30,
      soilMoisture: "Low",
      erosionRisk: "High",
      coords: [11.0, 124.6],
    },
    {
      id: 4,
      name: "Ormoc Riverbank",
      brgy: "Cogon",
      status: "Needs Planting",
      vegetation: 45,
      soilMoisture: "Low",
      erosionRisk: "Medium",
      coords: [11.015, 124.63],
    },
  ];

  const filteredSites = sites.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.brgy.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.status.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const pieData = [
    {
      name: "Needs Planting",
      value: sites.filter((s) => s.status === "Needs Planting").length,
    },
    {
      name: "Healthy",
      value: sites.filter((s) => s.status === "Healthy").length,
    },
    {
      name: "Degraded",
      value: sites.filter((s) => s.status === "Degraded").length,
    },
  ];

  const COLORS = ["#ef4444", "#16a34a", "#f59e0b"];

  const barData = sites.map((s) => ({
    name: s.name,
    Vegetation: s.vegetation,
  }));

  return (
    <div className="flex h-screen overflow-hidden">
      <main className="flex-1 bg-gray-50 p-6 overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold text-[#052e87]">
            🌍 Analysis & Results
          </h1>
          <button
            onClick={() => navigate("/image-analysis")}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md transition"
          >
            <FileDown size={18} /> Export Report
          </button>
        </div>

        <p className="text-gray-600 mb-4 max-w-3xl">
          This module consolidates AI & GIS results for all reforestation sites.
          It shows which areas require planting, maintenance, or are healthy
          based on vegetation, moisture, and erosion indicators.
        </p>

        {/* Search Input */}
        <div className="flex items-center gap-2 mb-4">
          <Search size={18} className="text-gray-500" />
          <input
            type="text"
            placeholder="Search site, barangay, or status..."
            className="border border-gray-300 rounded-md px-3 py-2 w-full focus:ring-2 focus:ring-[#052e87] outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Map Section */}
        <div className="w-full h-[80vh] mb-8 border rounded-lg shadow-md overflow-hidden">
          <MapContainer
            center={[11.0168, 124.6075]}
            zoom={12}
            className="h-full w-full"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {filteredSites.map((site) => (
              <Marker
                key={site.id}
                position={site.coords as [number, number]}
                icon={markerIcon(site.status)}
              >
                <Popup>
                  <div className="text-sm">
                    <b>{site.name}</b>
                    <br />
                    Barangay: {site.brgy}
                    <br />
                    Status:{" "}
                    <span
                      className={`font-semibold ${
                        site.status === "Healthy"
                          ? "text-green-600"
                          : site.status === "Degraded"
                            ? "text-yellow-600"
                            : "text-red-600"
                      }`}
                    >
                      {site.status}
                    </span>
                    <br />
                    Vegetation: {site.vegetation}%<br />
                    Soil Moisture: {site.soilMoisture}
                    <br />
                    Erosion Risk: {site.erosionRisk}
                    <br />
                    <button
                      className="mt-2 text-white bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded text-xs"
                      onClick={() =>
                        alert(`Assign field officer for ${site.name}`)
                      }
                    >
                      Assign for Monitoring
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Pie Chart */}
          <div className="bg-white rounded-xl shadow-md p-6 border">
            <h2 className="text-lg font-semibold text-[#052e87] mb-4">
              Overall Site Status
            </h2>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  label
                  outerRadius={80}
                >
                  {pieData.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Bar Chart */}
          <div className="bg-white rounded-xl shadow-md p-6 border">
            <h2 className="text-lg font-semibold text-[#052e87] mb-4">
              Vegetation Coverage by Site (%)
            </h2>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="Vegetation" fill="#16a34a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Table Section */}
        <div className="bg-white rounded-xl shadow-md border overflow-x-auto">
          <table className="min-w-full text-sm text-left border-collapse">
            <thead className="bg-[#052e87] text-white">
              <tr>
                <th className="py-3 px-4">#</th>
                <th className="py-3 px-4">Site Name</th>
                <th className="py-3 px-4">Barangay</th>
                <th className="py-3 px-4">Vegetation (%)</th>
                <th className="py-3 px-4">Soil Moisture</th>
                <th className="py-3 px-4">Erosion Risk</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredSites.map((site, index) => (
                <tr
                  key={site.id}
                  className="hover:bg-gray-50 border-b last:border-none transition"
                >
                  <td className="py-3 px-4">{index + 1}</td>
                  <td className="py-3 px-4 font-medium">{site.name}</td>
                  <td className="py-3 px-4">{site.brgy}</td>
                  <td className="py-3 px-4">{site.vegetation}%</td>
                  <td className="py-3 px-4">{site.soilMoisture}</td>
                  <td className="py-3 px-4">{site.erosionRisk}</td>
                  <td
                    className={`py-3 px-4 font-semibold ${
                      site.status === "Healthy"
                        ? "text-green-600"
                        : site.status === "Degraded"
                          ? "text-yellow-600"
                          : "text-red-600"
                    }`}
                  >
                    {site.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
