"use client";
import { useState } from "react";
import { MapPin, Satellite, Calendar, Upload, Search, ImageIcon } from "lucide-react";
import Sidebar from "../../components/layout/Sidebar";
import GenMap from "../../components/map/GenMap";

export default function SatelliteImageAnalysis() {
  const [selectedSatellite, setSelectedSatellite] = useState("Sentinel-2");
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [analyzing, setAnalyzing] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setUploadedFiles(Array.from(e.target.files));
    }
  };

  const handleAnalyze = () => {
    if (uploadedFiles.length === 0) {
      alert("Please upload at least one satellite image.");
      return;
    }
    setAnalyzing(true);
    setTimeout(() => {
      alert("Satellite image analysis complete — potential reforestation areas identified.");
      setAnalyzing(false);
    }, 2000);
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className="flex-1 bg-gray-50 p-6 overflow-y-auto">
        <h1 className="text-2xl font-bold text-[#052e87] mb-6">
          🛰️ Satellite Image Analysis
        </h1>

        {/* Filter & Upload Section */}
        <section className="bg-white p-6 rounded-xl shadow-sm border mb-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Satellite className="text-[#057501]" /> Image Upload & Filter
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Satellite Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Satellite Type
              </label>
              <select
                value={selectedSatellite}
                onChange={(e) => setSelectedSatellite(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-[#052e87]"
              >
                <option value="Sentinel-2">Sentinel-2</option>
                <option value="Landsat 8">Landsat 8</option>
                <option value="MODIS">MODIS</option>
              </select>
            </div>

            {/* Date From */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date From
              </label>
              <input
                type="date"
                value={dateRange.from}
                onChange={(e) =>
                  setDateRange({ ...dateRange, from: e.target.value })
                }
                className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-[#052e87]"
              />
            </div>

            {/* Date To */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date To
              </label>
              <input
                type="date"
                value={dateRange.to}
                onChange={(e) =>
                  setDateRange({ ...dateRange, to: e.target.value })
                }
                className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-[#052e87]"
              />
            </div>

            {/* Upload Section */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Upload Satellite Image
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 text-center bg-gray-50 hover:bg-gray-100 transition">
                <input
                  type="file"
                  accept="image/*,.tif,.tiff"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                  id="fileUpload"
                />
                <label
                  htmlFor="fileUpload"
                  className="cursor-pointer text-[#052e87] text-sm font-medium flex flex-col items-center gap-2"
                >
                  <Upload size={18} />
                  Click to upload
                </label>
                {uploadedFiles.length > 0 && (
                  <p className="text-xs text-gray-600 mt-2">
                    {uploadedFiles.length} image(s) uploaded
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end mt-4">
            <button
              onClick={handleAnalyze}
              disabled={analyzing}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-white transition ${
                analyzing
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-[#052e87] hover:bg-[#0644c1]"
              }`}
            >
              <Search size={18} /> {analyzing ? "Analyzing..." : "Analyze Image"}
            </button>
          </div>
        </section>

        {/* Map and Result Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Map Section */}
          <section className="lg:col-span-2 bg-white p-4 rounded-xl shadow-sm border">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <MapPin className="text-[#057501]" /> Map Visualization
            </h2>
            <div className="h-[500px] rounded-lg overflow-hidden border">
              <GenMap />
            </div>
          </section>

          {/* Analysis Result Section */}
          <section className="bg-white p-4 rounded-xl shadow-sm border">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <ImageIcon className="text-[#057501]" /> Analysis Results
            </h2>
            <div className="text-sm text-gray-600">
              {uploadedFiles.length === 0 ? (
                <p>No uploaded image. Please upload a satellite image to analyze.</p>
              ) : (
                <div>
                  <p className="mb-2">Detected potential reforestation zones:</p>
                  <ul className="list-disc pl-5 text-gray-700">
                    <li>Zone A – Moderate soil moisture</li>
                    <li>Zone B – High reforestation suitability</li>
                    <li>Zone C – Requires field verification</li>
                  </ul>
                  <div className="mt-4 border-t pt-3">
                    <p>
                      <strong>Satellite:</strong> {selectedSatellite}
                    </p>
                    <p>
                      <strong>Date Range:</strong>{" "}
                      {dateRange.from && dateRange.to
                        ? `${dateRange.from} → ${dateRange.to}`
                        : "Not selected"}
                    </p>
                    <p>
                      <strong>Uploaded Files:</strong> {uploadedFiles.length}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
