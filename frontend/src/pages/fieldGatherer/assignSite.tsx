import { MapContainer, TileLayer, useMap, GeoJSON } from "react-leaflet";
import { useState, useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import "@geoman-io/leaflet-geoman-free";

// Fix Leaflet marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Helper component to capture map instance
function MapInitializer({ setMapRef }: { setMapRef: (map: L.Map) => void }) {
  const map = useMap();
  useEffect(() => {
    setMapRef(map);
  }, [map, setMapRef]);
  return null;
}

function MapController({ center }: { center: [number, number] }) {
  const map = useMap();
  map.setView(center, 12);
  return null;
}

export default function NDVIMap() {
  const token = localStorage.getItem('token')
  const ORMOCCITY: [number, number] = [11.02, 124.61];
  const mapRef = useRef<L.Map | null>(null);
  const drawnLayerRef = useRef<any>(null); // For managing map layer

  // NDVI State
  const [ndviTileUrl, setNdviTileUrl] = useState<string | null>(null);
  const [showNDVI, setShowNDVI] = useState(true);

  // Analysis State
  const [suitablePolygons, setSuitablePolygons] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [drawnGeometry, setDrawnGeometry] = useState<any>(null); // Track geometry

  // Shared date state
  const [start, setStart] = useState("2023-01-01");
  const [end, setEnd] = useState("2023-12-31");
  const [panelOpen, setPanelOpen] = useState(true);
  const [goHome, setGoHome] = useState(false);

  // Initialize Geoman drawing
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    (window as any).L = L;

    map.off("pm:create");
    map.on("pm:create", (e: any) => {
      // Remove previous layer if exists
      if (drawnLayerRef.current) {
        map.removeLayer(drawnLayerRef.current);
        drawnLayerRef.current = null;
      }

      const layer = e.layer;
      drawnLayerRef.current = layer;
      layer.setStyle({ color: "#3b82f6", weight: 2, fill: false });
      layer.addTo(map);

      // Save geometry to state → triggers UI update
      const geojson = layer.toGeoJSON();
      setDrawnGeometry(geojson.geometry);
    });

    return () => {
      map.off("pm:create");
      if (drawnLayerRef.current) {
        map.removeLayer(drawnLayerRef.current);
        drawnLayerRef.current = null;
      }
    };
  }, [mapRef.current]);

  // Render NDVI (city-wide)
  const renderNDVI = async () => {
    
    const res = await fetch(
      `http://127.0.0.1:8000/api/ndvi/?start=${start}&end=${end}`,
      {
        headers: {Authorization: 'Bearer '+token}
      },
    );
    const data = await res.json();
    if (data.tile_url) {
      setNdviTileUrl(data.tile_url);
      setSuitablePolygons(null);
      setDrawnGeometry(null);
      if (drawnLayerRef.current && mapRef.current) {
        mapRef.current.removeLayer(drawnLayerRef.current);
        drawnLayerRef.current = null;
      }
    } else {
      alert("Could not generate NDVI map. Try a different date range.");
    }
  };

  // Analyze drawn area
  const analyzeArea = async () => {
    if (!drawnGeometry) {
      alert("Please draw a rectangle first.");
      return;
    }
    setIsProcessing(true);
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/suitable-sites/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: 'Bearer '+token },
        body: JSON.stringify({ start, end, geometry: drawnGeometry }),
      });
      const data = await res.json();
      if (data.polygons && data.polygons.features?.length > 0) {
        setSuitablePolygons(data.polygons);
        setNdviTileUrl(null);
      } else {
        alert("No suitable planting sites found in this area.");
        setSuitablePolygons(null);
      }
    } catch (err) {
      console.error(err);
      alert("Error analyzing area. Try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Cancel current drawing
  const cancelDrawing = () => {
    if (mapRef.current && drawnLayerRef.current) {
      mapRef.current.removeLayer(drawnLayerRef.current);
      drawnLayerRef.current = null;
    }
    setDrawnGeometry(null);
  };

  const handleHome = () => {
    setGoHome(true);
    setTimeout(() => setGoHome(false), 100);
  };

  const clearAnalysis = () => {
    setSuitablePolygons(null);
    setDrawnGeometry(null);
    if (mapRef.current && drawnLayerRef.current) {
      mapRef.current.removeLayer(drawnLayerRef.current);
      drawnLayerRef.current = null;
    }
  };

  const startDrawing = () => {
    if (mapRef.current) {
      if (drawnLayerRef.current) {
        mapRef.current.removeLayer(drawnLayerRef.current);
        drawnLayerRef.current = null;
        setDrawnGeometry(null);
      }
      mapRef.current.pm.enableDraw("Rectangle", {
        snappable: false,
        cursorMarker: false,
        allowSelfIntersection: false,
      });
    }
  };

  const hasDrawnArea = !!drawnGeometry;

  return (
    <div className="relative h-screen w-full p-4">
      {!panelOpen && (
        <button
          onClick={() => setPanelOpen(true)}
          className="absolute top-4 right-4 z-[1000] bg-green-600 text-white px-4 py-2 rounded-lg shadow-md hover:bg-green-700 transition"
        >
          Open Panel
        </button>
      )}

      {panelOpen && (
        <div className="absolute top-4 right-4 z-[1000] bg-white rounded-xl shadow-lg p-4 w-[320px]">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-semibold text-gray-800">
              PLANTSCOPE Tools
            </h2>
            <button
              onClick={() => setPanelOpen(false)}
              className="text-sm text-gray-500 hover:text-red-600"
            >
              ✕
            </button>
          </div>

          <div className="flex flex-col gap-3">
            <div>
              <label className="text-sm text-gray-600">Start Date</label>
              <input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="w-full mt-1 p-2 border rounded-md focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div>
              <label className="text-sm text-gray-600">End Date</label>
              <input
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="w-full mt-1 p-2 border rounded-md focus:ring-2 focus:ring-green-500"
              />
            </div>

            <button
              onClick={renderNDVI}
              className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 rounded-md transition"
            >
              Render NDVI Canopy Map
            </button>

            {ndviTileUrl && (
              <button
                onClick={() => setShowNDVI(!showNDVI)}
                className={`font-medium py-2 rounded-md transition ${
                  showNDVI
                    ? "bg-yellow-500 hover:bg-yellow-600 text-white"
                    : "border border-yellow-500 text-yellow-700 hover:bg-yellow-50"
                }`}
              >
                {showNDVI ? "Hide NDVI Layer" : "Show NDVI Layer"}
              </button>
            )}

            <button
              onClick={startDrawing}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-md transition"
            >
              Draw Rectangle Area
            </button>

            <button
              onClick={analyzeArea}
              disabled={!hasDrawnArea || isProcessing}
              className={`py-2 rounded-md transition ${
                !hasDrawnArea || isProcessing
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-purple-600 hover:bg-purple-700 text-white"
              }`}
            >
              {isProcessing
                ? "Analyzing..."
                : "Analyze Area for Planting Sites"}
            </button>

            {hasDrawnArea && !suitablePolygons && (
              <button
                onClick={cancelDrawing}
                className="border border-gray-600 text-gray-700 hover:bg-gray-50 font-medium py-2 rounded-md transition"
              >
                Cancel Drawing
              </button>
            )}

            {suitablePolygons && (
              <button
                onClick={clearAnalysis}
                className="border border-red-600 text-red-700 hover:bg-red-50 font-medium py-2 rounded-md transition"
              >
                Clear Analysis Results
              </button>
            )}

            <button
              onClick={handleHome}
              className="border border-green-600 text-green-700 hover:bg-green-50 font-medium py-2 rounded-md transition"
            >
              Go to Ormoc City
            </button>
          </div>

          {/* Legends */}
          <div className="mt-4 space-y-3">
            {ndviTileUrl && (
              <>
                <p className="text-sm font-medium text-gray-700">
                  NDVI Canopy Legend
                </p>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 bg-gray-400 rounded"></span>
                    <span>Non-vegetated</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 bg-yellow-400 rounded"></span>
                    <span>Sparse vegetation</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 bg-orange-500 rounded"></span>
                    <span>Moderate canopy</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 bg-green-600 rounded"></span>
                    <span>Dense canopy</span>
                  </div>
                </div>
              </>
            )}

            {suitablePolygons && (
              <>
                <p className="text-sm font-medium text-gray-700">
                  Planting Sites
                </p>
                <div className="flex items-center gap-2 text-sm">
                  <span className="w-4 h-4 bg-red-500 rounded"></span>
                  <span>Potential Reforestation Area</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <MapContainer center={ORMOCCITY} zoom={12} className="h-full w-full">
        {/* Capture map instance */}
        <MapInitializer setMapRef={(map) => (mapRef.current = map)} />

        {/* Google Hybrid Basemap */}
        <TileLayer
          url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
          attribution='Map data &copy; <a href="https://www.google.com/maps">Google</a>'
        />

        {/* NDVI Layer */}
        {ndviTileUrl && showNDVI && (
          <TileLayer url={ndviTileUrl} opacity={0.7} />
        )}

        {/* Suitable Polygons */}
        {suitablePolygons && (
          <GeoJSON
            data={suitablePolygons}
            style={{
              color: "#dc2626",
              weight: 2,
              fillColor: "#fecaca",
              fillOpacity: 0.6,
            }}
          />
        )}

        {goHome && <MapController center={ORMOCCITY} />}
      </MapContainer>
    </div>
  );
}
