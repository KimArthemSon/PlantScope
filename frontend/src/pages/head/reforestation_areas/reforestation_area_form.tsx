import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Pointer, File, X, Image, Info, Clipboard, MapPin } from "lucide-react";

const API = "http://127.0.0.1:8000/api"; // Adjust if needed

const greenIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function MapClickHandler({ placingMarker, setForm, setPlacingMarker }: any) {
  useMapEvents({
    click(e) {
      if (!placingMarker) return;
      setForm((prev: any) => ({
        ...prev,
        coordinate: [e.latlng.lat, e.latlng.lng],
      }));
      setPlacingMarker(false);
    },
  });
  return null;
}

export default function UpdateReforestationArea() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [placingMarker, setPlacingMarker] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const [form, setForm] = useState({
    name: "",
    legality: "pending",
    safety: "danger",
    location: "",
    description: "",
    coordinate: null as [number, number] | null,
    polygon_coordinate: null,
    area_img: null as File | null,
  });

  const token = localStorage.getItem("token");

  useEffect(() => {
    if (!id || !token) return;
    fetch(`${API}/get_reforestation_area/${id}/`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    })
      .then((res) => res.json())
      .then((data) => {
        const area = data.data;
        setForm({
          name: area.name,
          legality: area.legality,
          safety: area.safety,
          location: area.location,
          description: area.description,
          coordinate: area.coordinate,
          polygon_coordinate: area.polygon_coordinate,
          area_img: null,
        });
        if (area.area_img)
          setImagePreview(`http://127.0.0.1:8000${area.area_img}`);
      });
  }, [id, token]);

  function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setForm({ ...form, area_img: file });
    setImagePreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return alert("No token found");

    const formData = new FormData();
    formData.append("name", form.name);
    formData.append("legality", form.legality);
    formData.append("safety", form.safety);
    formData.append("location", form.location);
    formData.append("description", form.description);
    if (form.coordinate)
      formData.append("coordinate", JSON.stringify(form.coordinate));
    if (form.polygon_coordinate)
      formData.append(
        "polygon_coordinate",
        JSON.stringify(form.polygon_coordinate),
      );
    if (form.area_img) formData.append("area_img", form.area_img);

    const res = await fetch(`${API}/update_reforestation_areas/${id}/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    const data = await res.json();
    if (res.ok) {
      alert("Updated successfully");
      navigate(-1);
    } else {
      alert(data.error || "Update failed");
    }
  }

  function handleCancel() {
    navigate(-1);
  }

  return (
    <div className="flex w-full h-screen bg-gray-100 p-6">
      {/* IMAGE MODAL */}
      {showModal && imagePreview && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="relative max-w-[90%] max-h-[90%]">
            <button
              onClick={() => setShowModal(false)}
              className="absolute -top-10 right-0 bg-white rounded-full p-2 shadow"
            >
              <X size={18} />
            </button>
            <img
              src={imagePreview}
              className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg shadow"
            />
          </div>
        </div>
      )}

      {/* LEFT PANEL */}
      <form
        onSubmit={handleSubmit}
        className="w-[380px] bg-white rounded-2xl shadow p-6 flex flex-col gap-5"
      >
        <h2 className="text-2xl font-bold text-green-700">
          Update Reforestation Area
        </h2>

        {/* NAME */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold flex items-center gap-1">
            <Info size={16} /> Name
          </label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Area Name"
            className="border p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-300"
            required
          />
        </div>

        {/* LOCATION */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold flex items-center gap-1">
            <MapPin size={16} /> Location
          </label>
          <input
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            placeholder="Location"
            className="border p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-300"
          />
        </div>

        {/* DESCRIPTION */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold flex items-center gap-1">
            <Clipboard size={16} /> Description
          </label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Description"
            className="border p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-300 resize-none"
            rows={3}
          />
        </div>

        {/* COORDINATE */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold flex items-center gap-1">
            <Pointer size={16} /> Coordinate (Lat, Lng)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={
                form.coordinate
                  ? `${form.coordinate[0]}, ${form.coordinate[1]}`
                  : ""
              }
              onChange={(e) => {
                const [lat, lng] = e.target.value.split(",").map(Number);
                setForm({ ...form, coordinate: [lat, lng] });
              }}
              className="flex-1 border p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-300"
              placeholder="11.007, 124.602"
            />
            <button
              type="button"
              onClick={() => setPlacingMarker(true)}
              className={`px-3 rounded text-white ${placingMarker ? "bg-orange-500" : "bg-green-700"}`}
            >
              <Pointer size={16} />
            </button>
          </div>
        </div>

        {/* IMAGE */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold flex items-center gap-1">
            <Image size={16} /> Area Image
          </label>
          <input type="file" onChange={handleImage} />
        </div>

        {/* BUTTONS */}
        <div className="flex gap-2 mt-2">
          <button
            type="button"
            onClick={handleCancel}
            className="flex-1 border p-2 rounded-lg hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 bg-green-700 text-white p-2 rounded-lg flex items-center justify-center gap-1 hover:bg-green-800"
          >
            <File size={16} /> Update
          </button>
        </div>
      </form>

      {/* RIGHT PANEL */}
      <div className="flex-1 flex flex-col gap-4 ml-6">
        {/* MAP */}
        <div className="flex-1 rounded-2xl overflow-hidden shadow">
          <MapContainer
            center={form.coordinate || [11.007, 124.602]}
            zoom={16}
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer url="http://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}" />
            <MapClickHandler
              placingMarker={placingMarker}
              setForm={setForm}
              setPlacingMarker={setPlacingMarker}
            />
            {form.coordinate && (
              <Marker
                position={[form.coordinate[0], form.coordinate[1]]}
                icon={greenIcon}
              />
            )}
          </MapContainer>
        </div>

        {/* IMAGE PREVIEW */}
        {imagePreview && (
          <div className="bg-white rounded-2xl shadow p-2">
            <div className="flex justify-between mb-2">
              <span className="text-sm font-semibold">Area Image</span>
              <button
                onClick={() => setShowModal(true)}
                className="text-sm bg-green-700 text-white px-2 py-1 rounded flex items-center gap-1 hover:bg-green-800"
              >
                <Image size={14} /> View
              </button>
            </div>
            <img
              src={imagePreview}
              className="w-full h-[150px] object-cover rounded-lg"
            />
          </div>
        )}
      </div>
    </div>
  );
}
