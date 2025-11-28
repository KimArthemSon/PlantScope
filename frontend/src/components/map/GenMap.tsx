import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect } from "react";

// Fix for default marker icon not showing in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

export default function GenMap() {
  useEffect(() => {
    console.log("Leaflet map loaded!");
  }, []);

  return (
    <div className="w-full h-[85vh] rounded-lg overflow-hidden border shadow-sm">
      <MapContainer
        center={[11.0168, 124.6075]} // Ormoc City coordinates
        zoom={12}
        className="w-full h-full"
      >
        {/* Map Tiles */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Example Marker */}
        <Marker position={[11.0168, 124.6075]}>
          <Popup>
            <b>Ormoc City</b> <br /> Example marker location.
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
