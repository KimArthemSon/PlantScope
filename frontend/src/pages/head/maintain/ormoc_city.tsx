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
  Trash,
  Save,
  Leaf,
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

  /* ---------------- Load Existing Coordinates ---------------- */
  useEffect(() => {
    async function loadCoordinates() {
      setLoading(true);
      const token = localStorage.getItem("token");
      try {
        const response = await fetch("http://127.0.0.1:8000/api/get_ormoc/", {
          headers: {
            Authorization: "Bearer " + token,
          },
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
    setLoading(true);
    try {
      const response = await fetch(
        "http://127.0.0.1:8000/api/update_ormoc_city/",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + token,
          },
          body: JSON.stringify({
            marker: marker,
            polygon: polygon,
          }),
        },
      );

      const data = await response.json();
      if (response.ok) {
        alert("Coordinates saved successfully");
      } else {
        alert(data.error || "Update failed");
      }
    } catch (error) {
      console.error(error);
      alert("Server error");
    } finally {
      setLoading(false);
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
    return <div className="p-6 text-gray-500">Loading coordinates...</div>;
  }

  /* ---------------- RENDER ---------------- */
  return (
    <div className="flex flex-col w-full h-full gap-6 bg-gray-50">
      {/* LEFT PANEL */}
      <header className="bg-linear-to-r from-[#0F4A2F] to-[#1a6b44] text-white py-3 px-6 shadow-lg">
        <div className="max-w-7xl mx-auto p-4">
          <div className="flex items-center gap-3 mb-2">
            <Leaf size={32} className="text-green-300" />
            <h1 className="text-3xl md:text-4xl font-bold">
              {" "}
              Ormoc City Coordinates
            </h1>
          </div>
        </div>
      </header>
      <div className="flex flex-1 gap-6 p-6">
        {/* MODE SWITCH */}
        <div className="flex flex-col gap-6">
          <div className="bg-white border rounded-xl shadow-sm p-4 flex gap-2">
            <button
              onClick={() => setMode("marker")}
              className={`flex-1 text-xs p-2 rounded-md font-medium ${
                mode === "marker"
                  ? "bg-green-700 text-white"
                  : "border text-gray-600"
              }`}
            >
              Marker Mode
            </button>
            <button
              onClick={() => setMode("polygon")}
              className={`flex-1 text-xs p-2 rounded-md font-medium ${
                mode === "polygon"
                  ? "bg-green-700 text-white"
                  : "border text-gray-600"
              }`}
            >
              Polygon Mode
            </button>
          </div>

          {/* MARKER */}
          <div className="bg-white border rounded-xl shadow-sm p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <MapPin size={18} className="text-green-700" />
              <h2 className="font-semibold text-sm">Marker Location</h2>
            </div>
            <div className="flex gap-3">
              <input
                type="number"
                step="any"
                placeholder="Latitude"
                className="border rounded p-2 text-xs w-1/2"
                value={markerInput.lat}
                onChange={(e) =>
                  setMarkerInput((p) => ({ ...p, lat: e.target.value }))
                }
              />
              <input
                type="number"
                step="any"
                placeholder="Longitude"
                className="border rounded p-2 text-xs w-1/2"
                value={markerInput.lng}
                onChange={(e) =>
                  setMarkerInput((p) => ({ ...p, lng: e.target.value }))
                }
              />
            </div>
            <div className="flex gap-2">
              <button
                className="bg-green-700 text-white px-3 py-2 text-xs rounded"
                onClick={addMarker}
              >
                <LocateFixed size={16} />
              </button>
              <button
                className="border px-3 py-2 text-xs rounded"
                onClick={() => marker && mapRef.current?.flyTo(marker, 16)}
              >
                <Navigation size={16} />
              </button>
              <button
                className="border border-red-500 text-red-600 px-3 py-2 text-xs rounded"
                onClick={clearMarker}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* POLYGON */}
          <div className="bg-white border rounded-xl shadow-sm p-5 flex flex-col gap-4">
            <div className="flex items-center">
              <h2 className="font-semibold text-sm">Polygon Coordinates</h2>
              <button
                onClick={flyToPolygon}
                className="ml-auto text-xs border px-2 py-1 rounded"
              >
                Fly
              </button>
              <button
                onClick={addPolygonPoint}
                className="ml-2 bg-green-700 text-white text-xs px-2 py-1 rounded"
              >
                <Plus size={14} />
              </button>
            </div>
            <div className="flex flex-col gap-3 max-h-60 overflow-y-auto">
              {polygon.map((coord, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    type="number"
                    className="border p-2 text-xs rounded w-1/2"
                    value={coord[0]}
                    onChange={(e) =>
                      updatePolygon(i, Number(e.target.value), coord[1])
                    }
                  />
                  <input
                    type="number"
                    className="border p-2 text-xs rounded w-1/2"
                    value={coord[1]}
                    onChange={(e) =>
                      updatePolygon(i, coord[0], Number(e.target.value))
                    }
                  />
                  {polygon.length > 1 && (
                    <Trash
                      size={18}
                      className="text-red-600 cursor-pointer"
                      onClick={() => removePolygonPoint(i)}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* SAVE BUTTON */}
          <button
            onClick={saveCoordinates}
            disabled={loading}
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-3 rounded-lg shadow"
          >
            <Save size={18} />
            Save Coordinates
          </button>
        </div>
        {/* MAP */}
        <div className="flex-1 border rounded-xl overflow-hidden shadow-sm">
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
              <Polygon positions={polygon} pathOptions={{ color: "green" }}>
                <Popup>Analysis Area</Popup>
              </Polygon>
            )}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}
