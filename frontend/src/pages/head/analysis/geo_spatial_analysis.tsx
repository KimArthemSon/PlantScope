import { useState, useRef, useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polygon,
  Popup,
  useMapEvents,
} from "react-leaflet";
import { useNavigate, useParams } from "react-router-dom";
import {
  MapPin,
  Navigation,
  LocateFixed,
  X,
  Plus,
  Trash,
  ArrowLeft,
  Save,
} from "lucide-react";
import "leaflet/dist/leaflet.css";

export default function GeoSpatialAnalysis() {
  const navigate = useNavigate();
  const { id } = useParams();
  const mapRef = useRef<any>(null);

  const defaultCenter: [number, number] = [11.007, 124.602];

  const [markerInput, setMarkerInput] = useState({ lat: "", lng: "" });
  const [marker, setMarker] = useState<[number, number] | null>(null);
  const [polygon, setPolygon] = useState<[number, number][]>([]);
  const [mode, setMode] = useState<"marker" | "polygon">("polygon");
  const [loading, setLoading] = useState(true);

  /* ---------------- Load Existing Coordinates ---------------- */
  useEffect(() => {
    if (!id) return;

    async function loadCoordinates() {
      try {
        const token = localStorage.getItem("token");
        const response = await fetch(
          `http://127.0.0.1:8000/api/get_site_coordinates/?site_id=${id}`,
          {
            headers: {
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          },
        );
        const data = await response.json();
        if (response.ok) {
          if (data.coordinates) {
            setMarker([data.coordinates[0], data.coordinates[1]]);
            setMarkerInput({
              lat: data.coordinates[0].toString(),
              lng: data.coordinates[1].toString(),
            });
            mapRef.current?.flyTo(
              [data.coordinates[0], data.coordinates[1]],
              16,
            );
          }
          if (data.polygon_coordinates?.length) {
            setPolygon(data.polygon_coordinates);
            mapRef.current?.flyTo(data.polygon_coordinates[0], 15);
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
  }, [id]);

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
    if (!id) {
      alert("Missing site ID");
      return;
    }
    if (!marker) {
      alert("Please set a marker location");
      return;
    }
    if (polygon.length < 3) {
      alert("Polygon must have at least 3 coordinates");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        "http://127.0.0.1:8000/api/update_site_coordinates/",
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            site_id: id,
            coordinates: marker,
            polygon_coordinates: polygon,
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
    <div className="flex w-full h-full gap-6 p-6 bg-gray-50">
      {/* LEFT PANEL */}
      <div className="w-[420px] flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-xs bg-white border px-3 py-2 rounded-lg shadow-sm hover:bg-gray-100"
          >
            <ArrowLeft size={16} />
            Back
          </button>
          <h1 className="text-sm font-semibold text-gray-800">
            Geospatial Analysis
          </h1>
        </div>

        {/* MODE SWITCH */}
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
          ref={(map) => map && (mapRef.current = map)}
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
  );
}
