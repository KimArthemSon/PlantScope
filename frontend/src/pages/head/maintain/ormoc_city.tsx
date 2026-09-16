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
  Eye,
  EyeOff,
  Globe,
  RotateCcw,
} from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { api } from "@/constant/api";
import LoaderPending from "../../../components/layout/loaderSmall";
import PlantScopeAlert from "../../../components/alert/PlantScopeAlert";
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

// 📍 Mapbox Token
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

export default function Ormoc_City() {
  const mapRef = useRef<any>(null);

  const defaultCenter: [number, number] = [11.007, 124.602];

  const [markerInput, setMarkerInput] = useState({ lat: "", lng: "" });
  const [marker, setMarker] = useState<[number, number] | null>(null);
  const [polygon, setPolygon] = useState<[number, number][]>([]);
  const [mode, setMode] = useState<"marker" | "polygon">("polygon");
  const [loading, setLoading] = useState(false);
  const [fetchingBoundary, setFetchingBoundary] = useState(false);
  const [showPolygon, setShowPolygon] = useState(true);
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  // ✅ Store original coordinates for revert functionality
  const [originalMarker, setOriginalMarker] = useState<[number, number] | null>(null);
  const [originalPolygon, setOriginalPolygon] = useState<[number, number][]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  const [PSalert, setPSAlert] = useState<{
    type: "success" | "failed" | "error";
    title: string;
    message: string;
  } | null>(null);

  /* ---------------- Load Existing Coordinates ---------------- */
  useEffect(() => {
    async function loadCoordinates() {
      setLoading(true);
      const token = localStorage.getItem("token");
      try {
        const response = await fetch(api + "api/get_ormoc/", {
          headers: { Authorization: "Bearer " + token },
        });
        const data = await response.json();
        if (response.ok) {
          if (data.marker && Array.isArray(data.marker) && data.marker.length === 2) {
            setMarker([data.marker[0], data.marker[1]]);
            setMarkerInput({ lat: data.marker[0].toString(), lng: data.marker[1].toString() });
            setOriginalMarker([data.marker[0], data.marker[1]]);
            mapRef.current?.flyTo([data.marker[0], data.marker[1]], 16);
          } else if (data.polygon?.length) {
            setPolygon(data.polygon);
            mapRef.current?.flyTo(data.polygon[0], 15);
          }

          if (data.polygon?.length && data.marker) {
            setPolygon(data.polygon);
          }
          if (data.polygon?.length) {
            setOriginalPolygon(data.polygon);
          }
        }
      } catch (error) {
        console.error("Load error:", error);
      } finally {
        setLoading(false);
      }
    }
    loadCoordinates();
  }, []);

  // ✅ Track changes to enable/disable Revert button
  useEffect(() => {
    const markerChanged =
      originalMarker && marker
        ? originalMarker[0] !== marker[0] || originalMarker[1] !== marker[1]
        : false;

    const polygonChanged =
      originalPolygon.length !== polygon.length ||
      polygon.some(
        (coord, i) =>
          !originalPolygon[i] ||
          originalPolygon[i][0] !== coord[0] ||
          originalPolygon[i][1] !== coord[1]
      );

    setHasChanges(markerChanged || polygonChanged);
  }, [marker, polygon, originalMarker, originalPolygon]);

  /* ---------------- Revert Changes Logic ---------------- */
  function revertChanges() {
    if (!hasChanges) {
      setPSAlert({ type: "failed", title: "No Changes", message: "There are no changes to revert." });
      return;
    }

    if (originalMarker) {
      setMarker(originalMarker);
      setMarkerInput({ lat: originalMarker[0].toString(), lng: originalMarker[1].toString() });
    }
    setPolygon(originalPolygon);

    if (originalMarker) {
      mapRef.current?.flyTo(originalMarker, 16);
    } else if (originalPolygon.length > 0) {
      mapRef.current?.flyTo(originalPolygon[0], 15);
    }

    setPSAlert({ type: "success", title: "Reverted", message: "Coordinates restored to the last saved state." });
  }

  /* ---------------- Auto-Fetch Boundary Logic (IMPROVED) ---------------- */
/* ---------------- Auto-Fetch Boundary Logic (UPDATED) ---------------- */
async function fetchOrmocBoundary() {
  setFetchingBoundary(true);
  try {
    // Use Overpass API with specific query for full administrative boundary
    const overpassQuery = `
      [out:json][timeout:25];
      area["name"="Ormoc"]->.searchArea;
      relation["admin_level"="6"](area.searchArea);
      out geom;
    `;
    
    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: overpassQuery,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    if (!response.ok) throw new Error("Network response was not ok");

    const data = await response.json();

    if (data.elements && data.elements.length > 0) {
      const relation = data.elements[0];
      let coords: [number, number][] = [];

      if (relation.geometry) {
        coords = relation.geometry.map((node: any) => [node.lat, node.lon]);
      } else if (relation.members) {
        // Collect all nodes from ways
        const nodes = new Map();
        relation.members.forEach((member: any) => {
          if (member.type === "way" && member.geometry) {
            member.geometry.forEach((node: any) => {
              const key = `${node.lat},${node.lon}`;
              if (!nodes.has(key)) {
                nodes.set(key, [node.lat, node.lon]);
              }
            });
          }
        });
        coords = Array.from(nodes.values());
      }

      if (coords.length > 50) { // Full city boundary should have many points
        setPolygon(coords);
        
        // Calculate center
        const lats = coords.map(c => c[0]);
        const lngs = coords.map(c => c[1]);
        const centerLat = (Math.max(...lats) + Math.min(...lats)) / 2;
        const centerLng = (Math.max(...lngs) + Math.min(...lngs)) / 2;
        
        setMarker([centerLat, centerLng]);
        setMarkerInput({ 
          lat: centerLat.toFixed(6), 
          lng: centerLng.toFixed(6) 
        });
        
        // Fit bounds to show entire city
        const bounds = L.latLngBounds(coords);
        mapRef.current?.fitBounds(bounds, { padding: [50, 50] });

        setPSAlert({
          type: "success",
          title: "Success",
          message: `Full Ormoc City boundary fetched with ${coords.length} points covering all barangays.`,
        });
      } else {
        throw new Error(`Boundary has insufficient points (${coords.length})`);
      }
    } else {
      // Fallback: Try direct relation search
      const fallbackQuery = `
        [out:json][timeout:25];
        relation["name"="Ormoc"]["admin_level"="6"];
        out geom;
      `;
      
      const fallbackResponse = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        body: fallbackQuery,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      
      const fallbackData = await fallbackResponse.json();
      
      if (fallbackData.elements && fallbackData.elements.length > 0) {
        const relation = fallbackData.elements[0];
        let coords: [number, number][] = [];

        if (relation.geometry) {
          coords = relation.geometry.map((node: any) => [node.lat, node.lon]);
        }

        if (coords.length > 50) {
          setPolygon(coords);
          
          const lats = coords.map(c => c[0]);
          const lngs = coords.map(c => c[1]);
          const centerLat = (Math.max(...lats) + Math.min(...lats)) / 2;
          const centerLng = (Math.max(...lngs) + Math.min(...lngs)) / 2;
          
          setMarker([centerLat, centerLng]);
          setMarkerInput({ 
            lat: centerLat.toFixed(6), 
            lng: centerLng.toFixed(6) 
          });
          
          const bounds = L.latLngBounds(coords);
          mapRef.current?.fitBounds(bounds, { padding: [50, 50] });

          setPSAlert({
            type: "success",
            title: "Success",
            message: `Full Ormoc City boundary fetched with ${coords.length} points.`,
          });
        } else {
          throw new Error("Could not retrieve full city boundary");
        }
      } else {
        throw new Error("City boundary not found in OpenStreetMap");
      }
    }
  } catch (error) {
    console.error("Fetch error:", error);
    setPSAlert({
      type: "error",
      title: "Fetch Failed",
      message: "Could not fetch full Ormoc City boundary. The area might not be fully mapped in OpenStreetMap. Please add points manually.",
    });
  } finally {
    setFetchingBoundary(false);
  }
}

  // Helper to apply the fetched coordinates
  function applyFetchedBoundary(coords: [number, number][], source: string) {
    setPolygon(coords);
    
    const lats = coords.map(c => c[0]);
    const lngs = coords.map(c => c[1]);
    const centerLat = (Math.max(...lats) + Math.min(...lats)) / 2;
    const centerLng = (Math.max(...lngs) + Math.min(...lngs)) / 2;
    
    setMarker([centerLat, centerLng]);
    setMarkerInput({ lat: centerLat.toFixed(6), lng: centerLng.toFixed(6) });
    
    const bounds = L.latLngBounds(coords);
    mapRef.current?.fitBounds(bounds, { padding: [50, 50] });

    setPSAlert({
      type: "success",
      title: "Success",
      message: `Full Ormoc City boundary fetched via ${source} with ${coords.length} points.`,
    });
  }

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
      setPSAlert({ type: "error", title: "Missing Marker", message: "Please set a marker location." });
      return;
    }
    if (polygon.length < 3) {
      setPSAlert({ type: "error", title: "Incomplete Polygon", message: "Polygon must have at least 3 coordinates." });
      return;
    }

    const token = localStorage.getItem("token");
    setSaveStatus("saving");
    try {
      const response = await fetch(api + "api/update_ormoc_city/", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ marker, polygon }),
      });
      const data = await response.json();
      if (response.ok) {
        setSaveStatus("saved");
        setOriginalMarker(marker);
        setOriginalPolygon([...polygon]);
        setHasChanges(false);
        setPSAlert({ type: "success", title: "Success", message: data.message || "Coordinates saved successfully." });
        setTimeout(() => setSaveStatus("idle"), 2500);
      } else {
        setSaveStatus("error");
        setPSAlert({ type: "error", title: "Error", message: data.error || "Update failed." });
        setTimeout(() => setSaveStatus("idle"), 2500);
      }
    } catch (error) {
      setSaveStatus("error");
      setPSAlert({ type: "error", title: "Error", message: "Server error occurred." });
      setTimeout(() => setSaveStatus("idle"), 2500);
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

  const saveLabel =
    saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved!" : saveStatus === "error" ? "Error" : "Save Coordinates";

  const saveBg =
    saveStatus === "saved" ? "bg-green-600 hover:bg-green-700" : saveStatus === "error" ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700";

  /* ---------------- RENDER ---------------- */
  return (
    <div className="flex flex-col w-full h-full bg-gray-50 overflow-hidden relative">
      {loading && <LoaderPending />}
      {PSalert && (
        <PlantScopeAlert
          type={PSalert.type}
          title={PSalert.title}
          message={PSalert.message}
          onClose={() => setPSAlert(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 bg-white border-b shrink-0 z-10">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-green-50 border border-green-200">
          <MapPin size={18} className="text-green-700" />
        </div>
        <div>
          <h1 className="text-sm font-semibold text-gray-800">Ormoc City Map Configuration</h1>
          <p className="text-xs text-gray-500">Manage marker and boundary polygon coordinates</p>
        </div>
        <div className="ml-auto flex items-center gap-1 text-xs text-gray-400">
          <span className={`inline-block w-2 h-2 rounded-full ${marker ? "bg-green-500" : "bg-gray-300"}`} />
          {marker ? "Marker set" : "No marker"}
          <span className="mx-2 text-gray-200">|</span>
          <span className={`inline-block w-2 h-2 rounded-full ${polygon.length >= 3 ? "bg-green-500" : "bg-gray-300"}`} />
          {polygon.length >= 3 ? `${polygon.length} polygon pts` : "Polygon incomplete"}
          {hasChanges && (
            <>
              <span className="mx-2 text-gray-200">|</span>
              <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                Unsaved changes
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-1 gap-0 overflow-hidden min-h-0">
        {/* Sidebar */}
        <div className="flex flex-col w-105 bg-white border-r overflow-hidden shrink-0">
          {/* Mode Switch */}
          <div className="px-5 py-4 border-b shrink-0">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Interaction Mode</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setMode("marker")}
                className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-lg text-xs font-medium border transition-all ${
                  mode === "marker" ? "bg-green-700 text-white border-green-700 shadow-sm" : "text-gray-600 border-gray-200 hover:border-green-300 hover:bg-green-50"
                }`}
              >
                <Crosshair size={16} /> Marker
              </button>
              <button
                onClick={() => setMode("polygon")}
                className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-lg text-xs font-medium border transition-all ${
                  mode === "polygon" ? "bg-green-700 text-white border-green-700 shadow-sm" : "text-gray-600 border-gray-200 hover:border-green-300 hover:bg-green-50"
                }`}
              >
                <Layers size={16} /> Polygon
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-400 text-center">
              {mode === "marker" ? "Click on the map to place a marker" : "Click on the map to add polygon points"}
            </p>
          </div>

          {/* Marker Section */}
          <div className="px-5 py-4 border-b shrink-0">
            <div className="flex items-center gap-2 mb-3">
              <MapPin size={14} className="text-green-700" />
              <p className="text-xs font-semibold text-gray-700">Marker Location</p>
              {marker && (
                <span className="ml-auto inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full">Set</span>
              )}
            </div>
            <div className="flex gap-2 mb-3">
              <input
                type="number" step="any" placeholder="Latitude"
                className="border border-gray-200 rounded-lg p-2 text-xs w-1/2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                value={markerInput.lat}
                onChange={(e) => setMarkerInput((p) => ({ ...p, lat: e.target.value }))}
              />
              <input
                type="number" step="any" placeholder="Longitude"
                className="border border-gray-200 rounded-lg p-2 text-xs w-1/2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                value={markerInput.lng}
                onChange={(e) => setMarkerInput((p) => ({ ...p, lng: e.target.value }))}
              />
            </div>
            <div className="flex gap-2">
              <button title="Set marker" className="flex items-center justify-center gap-1.5 bg-green-700 hover:bg-green-800 text-white px-3 py-2 text-xs rounded-lg flex-1 transition-colors" onClick={addMarker}>
                <LocateFixed size={13} /> Set
              </button>
              <button title="Fly to marker" className="flex items-center justify-center gap-1.5 border border-gray-200 hover:bg-gray-50 text-gray-600 px-3 py-2 text-xs rounded-lg transition-colors" onClick={() => marker && mapRef.current?.flyTo(marker, 16)}>
                <Navigation size={13} />
              </button>
              <button title="Clear marker" className="flex items-center justify-center gap-1.5 border border-red-200 hover:bg-red-50 text-red-500 px-3 py-2 text-xs rounded-lg transition-colors" onClick={clearMarker}>
                <X size={13} />
              </button>
            </div>
          </div>

          {/* Polygon Section */}
          <div className="px-5 py-4 flex flex-col gap-3 flex-1 overflow-hidden">
            <div className="flex items-center gap-2">
              <Layers size={14} className="text-green-700" />
              <p className="text-xs font-semibold text-gray-700">Polygon Coordinates</p>
              <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{polygon.length} pts</span>
              <button
                onClick={() => setShowPolygon(!showPolygon)}
                className={`p-1 rounded transition-colors ${showPolygon ? "text-green-700 hover:bg-green-50" : "text-gray-400 hover:bg-gray-100"}`}
                title={showPolygon ? "Hide polygon on map" : "Show polygon on map"}
              >
                {showPolygon ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
            </div>

            <div className="flex gap-2 flex-wrap">
              <button
                onClick={fetchOrmocBoundary}
                disabled={fetchingBoundary}
                className="flex items-center gap-1.5 text-xs border border-green-200 hover:bg-green-50 text-green-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Fetch official Ormoc City boundary from OpenStreetMap"
              >
                <Globe size={12} /> {fetchingBoundary ? "Fetching..." : "Auto-Fetch"}
              </button>
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
                  <p className="text-xs opacity-70">Click the map, Add Point, or Auto-Fetch</p>
                </div>
              )}
              {polygon.map((coord, i) => (
                <div key={i} className="flex items-center gap-1.5 group">
                  <span className="text-xs text-gray-400 w-5 text-right shrink-0">{i + 1}</span>
                  <input
                    type="number" step="any"
                    className="border border-gray-200 p-1.5 text-xs rounded-lg w-1/2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    value={coord[0]}
                    onChange={(e) => updatePolygon(i, Number(e.target.value), coord[1])}
                    placeholder="Lat"
                  />
                  <input
                    type="number" step="any"
                    className="border border-gray-200 p-1.5 text-xs rounded-lg w-1/2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    value={coord[1]}
                    onChange={(e) => updatePolygon(i, coord[0], Number(e.target.value))}
                    placeholder="Lng"
                  />
                  {polygon.length > 1 && (
                    <button onClick={() => removePolygonPoint(i)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all shrink-0">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="px-5 py-4 border-t shrink-0 space-y-2">
            <button
              onClick={revertChanges}
              disabled={!hasChanges || saveStatus === "saving" || fetchingBoundary}
              className={`flex items-center justify-center gap-2 w-full text-sm px-4 py-2.5 rounded-lg font-medium transition-all border ${
                hasChanges ? "bg-white text-amber-700 border-amber-300 hover:bg-amber-50 hover:border-amber-400 shadow-sm" : "bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed"
              }`}
              title={hasChanges ? "Revert to last saved coordinates" : "No changes to revert"}
            >
              <RotateCcw size={15} /> {hasChanges ? "Revert Changes" : "No Changes to Revert"}
            </button>

            <button
              onClick={saveCoordinates}
              disabled={saveStatus === "saving" || fetchingBoundary}
              className={`flex items-center justify-center gap-2 w-full text-white text-sm px-4 py-2.5 rounded-lg shadow-sm font-medium transition-all ${saveBg} disabled:opacity-70`}
            >
              <Save size={15} /> {saveLabel}
            </button>
          </div>
        </div>

        {/* Map */}
        <div className="flex-1 relative">
          <div className="absolute top-3 left-3 z-999 flex items-center gap-1.5 bg-white/90 backdrop-blur-sm border border-gray-200 shadow-sm text-xs font-medium text-gray-700 px-3 py-1.5 rounded-full">
            <ChevronRight size={12} className="text-green-600" />
            {mode === "marker" ? "Marker mode — click to place" : "Polygon mode — click to add points"}
          </div>
          <MapContainer center={defaultCenter} zoom={15} style={{ height: "100%", width: "100%" }} ref={mapRef}>
            <TileLayer
              url={`https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`}
              tileSize={512}
              zoomOffset={-1}
              attribution='&copy; <a href="https://www.mapbox.com/">Mapbox</a> &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            <MapClickHandler />
            
            {marker && (
              <Marker
                position={marker}
                icon={L.divIcon({
                  className: "custom-marker",
                  html: `<div style="background-color: #15803d; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.4);"></div>`,
                  iconSize: [20, 20],
                  iconAnchor: [10, 10],
                })}
                draggable
                eventHandlers={{
                  dragend: (e) => {
                    const m = e.target.getLatLng();
                    setMarker([m.lat, m.lng]);
                    setMarkerInput({ lat: m.lat.toString(), lng: m.lng.toString() });
                  },
                }}
              >
                <Popup>Selected Location</Popup>
              </Marker>
            )}
            
            {showPolygon && polygon.map((coord, i) => (
              <Marker
                key={`vertex-${i}`}
                position={coord}
                icon={L.divIcon({
                  className: "vertex-marker-custom",
                  html: `<div style="background: #15803d; color: white; width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.4);">${i + 1}</div>`,
                  iconSize: [26, 26],
                  iconAnchor: [13, 13],
                })}
                draggable
                eventHandlers={{
                  dragend: (e) => {
                    const m = e.target.getLatLng();
                    updatePolygon(i, m.lat, m.lng);
                  },
                }}
              />
            ))}
            {showPolygon && polygon.length > 2 && (
              <Polygon positions={polygon} pathOptions={{ color: "#15803d", fillColor: "#16a34a", fillOpacity: 0.15 }}>
                <Popup>Boundary Area</Popup>
              </Polygon>
            )}
          </MapContainer>
        </div>
      </div>

      <style>{`
        .custom-marker, .vertex-marker-custom {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
        }
      `}</style>
    </div>
  );
}