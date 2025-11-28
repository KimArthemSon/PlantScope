import { useState } from "react";
import Sidebar from "../../components/layout/Sidebar";
import { Upload, Brain, Map, BarChart2, FileDown, Loader2 } from "lucide-react";

export default function ImageAnalysis() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<any | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
  };

  const handleAnalyze = () => {
    if (!selectedFile) {
      alert("Please upload an image first!");
      return;
    }
    setIsAnalyzing(true);

    // Simulate AI processing delay
    setTimeout(() => {
      setIsAnalyzing(false);
      setAnalysisResults({
        vegetationCover: 68,
        waterCoverage: 12,
        bareSoil: 20,
        soilMoisture: "Moderate",
        erosionRisk: "Medium",
        reforestationPriority: "High",
        suggestedSpecies: ["Narra", "Acacia", "Ipil-Ipil"],
      });
    }, 2500);
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      <main className="flex-1 bg-gray-50 p-8 overflow-y-auto">
        <h1 className="text-3xl font-bold text-[#052e87] mb-6">🧠 Image Analysis</h1>
        <p className="text-gray-600 mb-6 max-w-3xl">
          Upload satellite or drone imagery for AI/GIS-based analysis. The system identifies degraded zones, vegetation density, 
          soil moisture, and other spatial factors to support reforestation planning.
        </p>

        {/* Upload Section */}
        <div className="bg-white border rounded-2xl p-6 shadow-sm mb-6">
          <h2 className="text-xl font-semibold text-[#052e87] mb-4 flex items-center gap-2">
            <Upload size={20} /> Upload Imagery
          </h2>

          <div className="border-2 border-dashed border-gray-300 p-8 rounded-xl text-center">
            {selectedFile ? (
              <div>
                <p className="font-medium">{selectedFile.name}</p>
                <img
                  src={URL.createObjectURL(selectedFile)}
                  alt="Preview"
                  className="mt-4 mx-auto max-h-64 rounded-lg border"
                />
              </div>
            ) : (
              <p className="text-gray-500">
                Drag & drop or select a satellite/drone image for analysis
              </p>
            )}

            <input
              type="file"
              accept="image/*"
              className="hidden"
              id="file-upload"
              onChange={handleFileChange}
            />
            <label
              htmlFor="file-upload"
              className="inline-block mt-4 bg-[#052e87] text-white px-4 py-2 rounded-md hover:bg-[#0342b5] transition cursor-pointer"
            >
              Choose File
            </label>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mb-8">
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || !selectedFile}
            className={`flex items-center gap-2 px-5 py-2 rounded-md text-white ${
              isAnalyzing || !selectedFile
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-green-600 hover:bg-green-700"
            } transition`}
          >
            {isAnalyzing ? <Loader2 size={18} className="animate-spin" /> : <Brain size={18} />}
            {isAnalyzing ? "Analyzing..." : "Run Analysis"}
          </button>

          <button
            onClick={() => alert("Map visualization coming soon!")}
            className="flex items-center gap-2 px-5 py-2 rounded-md border border-[#052e87] text-[#052e87] hover:bg-[#052e87] hover:text-white transition"
          >
            <Map size={18} /> View on Map
          </button>

          <button
            onClick={() => alert("Exporting report...")}
            className="flex items-center gap-2 px-5 py-2 rounded-md bg-gray-200 hover:bg-gray-300 text-gray-800 transition"
          >
            <FileDown size={18} /> Export Report
          </button>
        </div>

        {/* Analysis Results */}
        {analysisResults && (
          <div className="bg-white border rounded-2xl p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-[#052e87] mb-4 flex items-center gap-2">
              <BarChart2 size={20} /> Analysis Results
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="p-4 border rounded-xl text-center">
                <p className="text-3xl font-bold text-green-600">{analysisResults.vegetationCover}%</p>
                <p className="text-gray-600 text-sm">Vegetation Cover</p>
              </div>
              <div className="p-4 border rounded-xl text-center">
                <p className="text-3xl font-bold text-blue-600">{analysisResults.waterCoverage}%</p>
                <p className="text-gray-600 text-sm">Water Coverage</p>
              </div>
              <div className="p-4 border rounded-xl text-center">
                <p className="text-3xl font-bold text-yellow-600">{analysisResults.bareSoil}%</p>
                <p className="text-gray-600 text-sm">Bare Soil</p>
              </div>
              <div className="p-4 border rounded-xl text-center">
                <p className="font-semibold">{analysisResults.soilMoisture}</p>
                <p className="text-gray-600 text-sm">Soil Moisture</p>
              </div>
              <div className="p-4 border rounded-xl text-center">
                <p className="font-semibold">{analysisResults.erosionRisk}</p>
                <p className="text-gray-600 text-sm">Erosion Risk</p>
              </div>
              <div className="p-4 border rounded-xl text-center">
                <p
                  className={`font-semibold ${
                    analysisResults.reforestationPriority === "High"
                      ? "text-red-600"
                      : "text-green-600"
                  }`}
                >
                  {analysisResults.reforestationPriority}
                </p>
                <p className="text-gray-600 text-sm">Reforestation Priority</p>
              </div>
            </div>

            <div className="mt-6">
              <h3 className="font-semibold text-gray-800 mb-2">
                🌱 Suggested Species for Planting:
              </h3>
              <ul className="list-disc list-inside text-sm text-gray-700">
                {analysisResults.suggestedSpecies.map((s: string) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
