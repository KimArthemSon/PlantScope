import { useState, useRef, useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polygon,
  Popup,
  useMapEvents,
} from "react-leaflet";
import {
  MapPin,
  Navigation,
  LocateFixed,
  X,
  Plus,
  Trash2,
  Save,
  ChevronRight,
  Crosshair,
  Layers,
} from "lucide-react";
import "leaflet/dist/leaflet.css";

export default function Ormoc_City() {
  const mapRef = useRef<any>(null);

  const defaultCenter: [number, number] = [11.007, 124.602];

  const [markerInput, setMarkerInput] = useState({ lat: "", lng: "" });
  const [marker, setMarker] = useState<[number, number] | null>(null);
  const [polygon, setPolygon] = useState<[number, number][]>([]);
  const [mode, setMode] = useState<"marker" | "polygon">("polygon");
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  /* ---------------- Load Existing Coordinates ---------------- */
  useEffect(() => {
    async function loadCoordinates() {
      setLoading(true);
      const token = localStorage.getItem("token");
      try {
        const response = await fetch("http://127.0.0.1:8000/api/get_ormoc/", {
          headers: { Authorization: "Bearer " + token },
        });
        const data = await response.json();
        if (response.ok) {
          if (
            data.marker &&
            Array.isArray(data.marker) &&
            data.marker.length === 2
          ) {
            setMarker([data.marker[0], data.marker[1]]);
            setMarkerInput({
              lat: data.marker[0].toString(),
              lng: data.marker[1].toString(),
            });
            mapRef.current?.flyTo([data.marker[0], data.marker[1]], 16);
          }
          if (data.polygon?.length) {
            setPolygon(data.polygon);
            mapRef.current?.flyTo(data.polygon[0], 15);
          }
        } else {
          console.error(data.error || "Failed to load coordinates");
        }
      } catch (error) {
        console.error("Error loading coordinates:", error);
      } finally {
        setLoading(false);
      }
    }
    loadCoordinates();
  }, []);

  /* ---------------- Marker Logic ---------------- */
  function addMarker() {
    const lat = parseFloat(markerInput.lat);
    const lng = parseFloat(markerInput.lng);
    if (isNaN(lat) || isNaN(lng)) return;
    setMarker([lat, lng]);
    mapRef.current?.flyTo([lat, lng], 16);
  }

  function clearMarker() {
    setMarker(null);
    setMarkerInput({ lat: "", lng: "" });
  }

  /* ---------------- Polygon Logic ---------------- */
  function addPolygonPoint() {
    setPolygon((prev) => [...prev, [0, 0]]);
  }

  function removePolygonPoint(index: number) {
    setPolygon((prev) => prev.filter((_, i) => i !== index));
  }

  function updatePolygon(index: number, lat: number, lng: number) {
    setPolygon((prev) => prev.map((p, i) => (i === index ? [lat, lng] : p)));
  }

  function flyToPolygon() {
    if (polygon.length === 0) return;
    mapRef.current?.flyTo(polygon[0], 15);
  }

  /* ---------------- Save Coordinates ---------------- */
  async function saveCoordinates() {
    if (!marker) {
      alert("Please set a marker location");
      return;
    }
    if (polygon.length < 3) {
      alert("Polygon must have at least 3 coordinates");
      return;
    }

    const token = localStorage.getItem("token");
    setSaveStatus("saving");
    try {
      const response = await fetch(
        "http://127.0.0.1:8000/api/update_ormoc_city/",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + token,
          },
          body: JSON.stringify({ marker, polygon }),
        },
      );
      const data = await response.json();
      if (response.ok) {
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2500);
      } else {
        setSaveStatus("error");
        setTimeout(() => setSaveStatus("idle"), 2500);
        alert(data.error || "Update failed");
      }
    } catch (error) {
      console.error(error);
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 2500);
      alert("Server error");
    }
  }

  /* ---------------- Map Click Handler ---------------- */
  function MapClickHandler() {
    useMapEvents({
      click(e) {
        const { lat, lng } = e.latlng;
        if (mode === "marker") {
          setMarker([lat, lng]);
          setMarkerInput({ lat: lat.toString(), lng: lng.toString() });
        }
        if (mode === "polygon") {
          setPolygon((prev) => [...prev, [lat, lng]]);
        }
      },
    });
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-green-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500 font-medium">
            Loading coordinates…
          </p>
        </div>
      </div>
    );
  }

  const saveLabel =
    saveStatus === "saving"
      ? "Saving…"
      : saveStatus === "saved"
        ? "Saved!"
        : saveStatus === "error"
          ? "Error"
          : "Save Coordinates";

  const saveBg =
    saveStatus === "saved"
      ? "bg-green-600 hover:bg-green-700"
      : saveStatus === "error"
        ? "bg-red-600 hover:bg-red-700"
        : "bg-blue-600 hover:bg-blue-700";

  /* ---------------- RENDER ---------------- */
  return (
    <div className="flex flex-col w-full h-full bg-gray-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 bg-white border-b shrink-0">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-green-50 border border-green-200">
          <MapPin size={18} className="text-green-700" />
        </div>
        <div>
          <h1 className="text-sm font-semibold text-gray-800">
            Ormoc City Map Configuration
          </h1>
          <p className="text-xs text-gray-500">
            Manage marker and boundary polygon coordinates
          </p>
        </div>
        <div className="ml-auto flex items-center gap-1 text-xs text-gray-400">
          <span
            className={`inline-block w-2 h-2 rounded-full ${marker ? "bg-green-500" : "bg-gray-300"}`}
          />
          {marker ? "Marker set" : "No marker"}
          <span className="mx-2 text-gray-200">|</span>
          <span
            className={`inline-block w-2 h-2 rounded-full ${polygon.length >= 3 ? "bg-green-500" : "bg-gray-300"}`}
          />
          {polygon.length >= 3
            ? `${polygon.length} polygon pts`
            : "Polygon incomplete"}
        </div>
      </div>

      <div className="flex flex-1 gap-0 overflow-hidden min-h-0">
        {/* Sidebar */}
        <div className="flex flex-col w-105 bg-white border-r overflow-hidden shrink-0">
          {/* Mode Switch */}
          <div className="px-5 py-4 border-b shrink-0">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
              Interaction Mode
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setMode("marker")}
                className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-lg text-xs font-medium border transition-all ${
                  mode === "marker"
                    ? "bg-green-700 text-white border-green-700 shadow-sm"
                    : "text-gray-600 border-gray-200 hover:border-green-300 hover:bg-green-50"
                }`}
              >
                <Crosshair size={16} />
                Marker
              </button>
              <button
                onClick={() => setMode("polygon")}
                className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-lg text-xs font-medium border transition-all ${
                  mode === "polygon"
                    ? "bg-green-700 text-white border-green-700 shadow-sm"
                    : "text-gray-600 border-gray-200 hover:border-green-300 hover:bg-green-50"
                }`}
              >
                <Layers size={16} />
                Polygon
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-400 text-center">
              {mode === "marker"
                ? "Click on the map to place a marker"
                : "Click on the map to add polygon points"}
            </p>
          </div>

          {/* Marker Section */}
          <div className="px-5 py-4 border-b shrink-0">
            <div className="flex items-center gap-2 mb-3">
              <MapPin size={14} className="text-green-700" />
              <p className="text-xs font-semibold text-gray-700">
                Marker Location
              </p>
              {marker && (
                <span className="ml-auto inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full">
                  Set
                </span>
              )}
            </div>
            <div className="flex gap-2 mb-3">
              <input
                type="number"
                step="any"
                placeholder="Latitude"
                className="border border-gray-200 rounded-lg p-2 text-xs w-1/2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                value={markerInput.lat}
                onChange={(e) =>
                  setMarkerInput((p) => ({ ...p, lat: e.target.value }))
                }
              />
              <input
                type="number"
                step="any"
                placeholder="Longitude"
                className="border border-gray-200 rounded-lg p-2 text-xs w-1/2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                value={markerInput.lng}
                onChange={(e) =>
                  setMarkerInput((p) => ({ ...p, lng: e.target.value }))
                }
              />
            </div>
            <div className="flex gap-2">
              <button
                title="Set marker"
                className="flex items-center justify-center gap-1.5 bg-green-700 hover:bg-green-800 text-white px-3 py-2 text-xs rounded-lg flex-1 transition-colors"
                onClick={addMarker}
              >
                <LocateFixed size={13} /> Set
              </button>
              <button
                title="Fly to marker"
                className="flex items-center justify-center gap-1.5 border border-gray-200 hover:bg-gray-50 text-gray-600 px-3 py-2 text-xs rounded-lg transition-colors"
                onClick={() => marker && mapRef.current?.flyTo(marker, 16)}
              >
                <Navigation size={13} />
              </button>
              <button
                title="Clear marker"
                className="flex items-center justify-center gap-1.5 border border-red-200 hover:bg-red-50 text-red-500 px-3 py-2 text-xs rounded-lg transition-colors"
                onClick={clearMarker}
              >
                <X size={13} />
              </button>
            </div>
          </div>

          {/* Polygon Section */}
          <div className="px-5 py-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Layers size={14} className="text-green-700" />
              <p className="text-xs font-semibold text-gray-700">
                Polygon Coordinates
              </p>
              <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                {polygon.length} pts
              </span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={flyToPolygon}
                disabled={polygon.length === 0}
                className="flex items-center gap-1.5 text-xs border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed text-gray-600 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Navigation size={12} /> Fly to
              </button>
              <button
                onClick={addPolygonPoint}
                className="flex items-center gap-1.5 ml-auto bg-green-700 hover:bg-green-800 text-white text-xs px-3 py-1.5 rounded-lg transition-colors"
              >
                <Plus size={12} /> Add Point
              </button>
            </div>

            <div className="flex flex-col gap-2 overflow-y-auto max-h-56 pr-1">
              {polygon.length === 0 && (
                <div className="flex flex-col items-center justify-center py-6 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
                  <Layers size={20} className="mb-1.5 opacity-50" />
                  <p className="text-xs">No points yet</p>
                  <p className="text-xs opacity-70">
                    Click the map or Add Point
                  </p>
                </div>
              )}
              {polygon.map((coord, i) => (
                <div key={i} className="flex items-center gap-1.5 group">
                  <span className="text-xs text-gray-400 w-5 text-right shrink-0">
                    {i + 1}
                  </span>
                  <input
                    type="number"
                    className="border border-gray-200 p-1.5 text-xs rounded-lg w-1/2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    value={coord[0]}
                    onChange={(e) =>
                      updatePolygon(i, Number(e.target.value), coord[1])
                    }
                    placeholder="Lat"
                  />
                  <input
                    type="number"
                    className="border border-gray-200 p-1.5 text-xs rounded-lg w-1/2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    value={coord[1]}
                    onChange={(e) =>
                      updatePolygon(i, coord[0], Number(e.target.value))
                    }
                    placeholder="Lng"
                  />
                  {polygon.length > 1 && (
                    <button
                      onClick={() => removePolygonPoint(i)}
                      className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Save Button */}
          <div className="px-5 py-4 border-t shrink-0">
            <button
              onClick={saveCoordinates}
              disabled={saveStatus === "saving"}
              className={`flex items-center justify-center gap-2 w-full text-white text-sm px-4 py-2.5 rounded-lg shadow-sm font-medium transition-all ${saveBg} disabled:opacity-70`}
            >
              <Save size={15} />
              {saveLabel}
            </button>
          </div>
        </div>

        {/* Map */}
        <div className="flex-1 relative">
          {/* Mode badge */}
          <div className="absolute top-3 left-3 z-999 flex items-center gap-1.5 bg-white/90 backdrop-blur-sm border border-gray-200 shadow-sm text-xs font-medium text-gray-700 px-3 py-1.5 rounded-full">
            <ChevronRight size={12} className="text-green-600" />
            {mode === "marker"
              ? "Marker mode — click to place"
              : "Polygon mode — click to add points"}
          </div>
          <MapContainer
            center={defaultCenter}
            zoom={15}
            style={{ height: "100%", width: "100%" }}
            ref={mapRef}
          >
            <TileLayer url="http://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}" />
            <MapClickHandler />
            {marker && (
              <Marker
                position={marker}
                draggable
                eventHandlers={{
                  dragend: (e) => {
                    const m = e.target.getLatLng();
                    setMarker([m.lat, m.lng]);
                    setMarkerInput({
                      lat: m.lat.toString(),
                      lng: m.lng.toString(),
                    });
                  },
                }}
              >
                <Popup>Selected Location</Popup>
              </Marker>
            )}
            {polygon.length > 2 && (
              <Polygon
                positions={polygon}
                pathOptions={{
                  color: "#15803d",
                  fillColor: "#16a34a",
                  fillOpacity: 0.15,
                }}
              >
                <Popup>Boundary Area</Popup>
              </Polygon>
            )}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}
