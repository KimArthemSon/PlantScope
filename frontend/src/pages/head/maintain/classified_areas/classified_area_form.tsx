import { useEffect, useState } from "react";
import { Map, Clipboard, Info, Trash } from "lucide-react";
import PlantScopeAlert from "@/components/alert/PlantScopeAlert";
import LoaderPending from "@/components/layout/loaderSmall";
import GoToCenterButton from "@/components/helper/gotocenter";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polygon,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useNavigate, useParams } from "react-router-dom";
import { useRef } from "react";


interface Polygon {
  coordinates: [number, number][];
  type: string;
}

interface Classified_area {
  name: string;
  description: string;
  land_classification_id: number;
  polygon: Polygon;
}

interface land_classification {
  land_classification_id: number;
  name: string;
}

export default function Classified_area_form() {
  const { id } = useParams();
  const mapRef = useRef<any>(null);
  const [action, setAction] = useState<"Add" | "Edit">(id ? "Edit" : "Add");
  const [PSalert, setPSAlert] = useState<{
    type: "success" | "failed" | "error";
    title: string;
    message: string;
  } | null>(null);
  const [land_classification, setLand_classification] = useState<
    land_classification[]
  >([
    {
      land_classification_id: 0,
      name: "land 1",
    },
  ]);
  const [classified_area, setClassified_area] = useState<Classified_area>({
    name: "",
    description: "",
    land_classification_id: 0,
    polygon: {
      coordinates: [[1, 1]],
      type: "POLYGON",
    },
  });
  const token = localStorage.getItem("token");
  const [loading, setLoading] = useState(false);
  const inputWrapper =
    "flex items-center border border-black rounded-md mt-2 p-1 " +
    "focus-within:border-green-700 focus-within:ring-2 " +
    "focus-within:ring-green-300 transition-all";

  const inputField = "flex-1 text-[.8rem] p-2 ml-4 outline-none bg-transparent";
  const navigate = useNavigate();

  // Default map center
  const currentPosition: [number, number] = [11.007, 124.602];

  useEffect(() => {
    get_land_classification_list();
  }, []);

  async function get_classified_area() {
    setLoading(true);

    try {
      const res = await fetch(
        "http://127.0.0.1:8000/api/get_classified_area/" + id,
        {
          headers: { Authorization: "Bearer " + token },
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setLoading(false);
        setPSAlert({
          type: "error",
          title: "Error",
          message: data.error,
        });
        return;
      }

      setClassified_area({
        name: data.data.name,
        description: data.data.description,
        land_classification_id: data.data.land_classification_id,
        polygon: data.data.polygon,
      });
      console.log(data);
      setLoading(false);
    } catch (e: any) {
      setLoading(false);
      setPSAlert({
        type: "error",
        title: "Error",
        message: "Successfully ",
      });
      setLoading(true);
    }
  }

  async function get_land_classification_list() {
    setLoading(true);

    try {
      const res = await fetch(
        "http://127.0.0.1:8000/api/get_land_classifications_list/",
        {
          headers: { Authorization: "Bearer " + token },
        },
      );

      const data = await res.json();
      if (!res.ok) {
        setLoading(false);
        setPSAlert({
          type: "error",
          title: "Error",
          message: data.error,
        });

        return;
      }

      if (data.data.length === 0) {
        navigate("/maintenance/Classified_areas");
        return;
      }

      setLand_classification(data.data);
      setClassified_area((prev) => ({
        ...prev,
        land_classification_id: data.data[0].land_classification_id,
      }));
      setLoading(false);
      if (id) get_classified_area();
    } catch (e: any) {
      setLoading(false);
      setPSAlert({
        type: "error",
        title: "Error",
        message: e.error.message,
      });
    }
  }

  async function hanle_submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (action === "Add") {
      handleAdd();
    } else {
      handleEdit();
    }
  }

  async function handleAdd() {
    console.log(classified_area);
    try {
      const token = localStorage.getItem("token");
      console.log("asdasd", classified_area);
      const res = await fetch(
        "http://127.0.0.1:8000/api/create_classified_area/",
        {
          method: "POST",
          headers: { Authorization: "Bearer " + token },
          body: JSON.stringify(classified_area),
        },
      );

      const data = await res.json();
      if (!res.ok) {
        setLoading(false);
        setPSAlert({
          type: "error",
          title: "Error",
          message: data.error,
        });
        return;
      }
      setLoading(false);
      setPSAlert({
        type: "success",
        title: "Success",
        message: "Successfully Created",
      });
      setTimeout(() => {
        navigate("/maintenance/Classified_areas");
      }, 2000);
    } catch (e: any) {
      setLoading(false);
      console.log(e);
      setPSAlert({
        type: "error",
        title: "Error",
        message: e.error,
      });
    }
  }

  async function handleEdit() {
    try {
      const token = localStorage.getItem("token");

      const res = await fetch(
        "http://127.0.0.1:8000/api/update_classified_area/" + id,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + token,
          },
          body: JSON.stringify(classified_area),
        },
      );

      const data = await res.json();
      if (!res.ok) {
        setLoading(false);
        setPSAlert({
          type: "error",
          title: "Error",
          message: data.error,
        });
        return;
      }
      setLoading(false);
      setPSAlert({
        type: "success",
        title: "Success",
        message: "Successfully Updated",
      });
      setTimeout(() => {
        navigate("/maintenance/Classified_areas");
      }, 2000);
    } catch (e: any) {
      setLoading(false);
      console.log(e);
      setPSAlert({
        type: "error",
        title: "Error",
        message: e.error,
      });
    }
  }

  return (
    <div className="flex flex-col flex-1 w-full min-w-150 h-full bg-gray-50 items-center p-10 pt-5">
      {PSalert && (
        <PlantScopeAlert
          type={PSalert.type}
          title={PSalert.title}
          message={PSalert.message}
          onClose={() => setPSAlert(null)}
        />
      )}
      {loading && <LoaderPending />}
      <main className="flex flex-col w-full flex-1 max-w-700 max-h-400 gap-8 min-w-200">
        <div>
          <h1 className="text-3xl font-bold text-green-700">
            {action} Classified Areas
          </h1>
        </div>

        <div className="flex gap-10 w-full h-full">
          {/* Left panel form */}
          <form
            className="flex flex-col w-[35%] gap-5 min-w-100"
            onSubmit={hanle_submit}
          >
            {/* Name */}
            <div className="flex flex-col">
              <label className="font-bold text-[.8rem] mr-auto">Name:</label>
              <div className={inputWrapper}>
                <Info size={20} className="ml-4 text-green-700" />
                <input
                  required
                  type="text"
                  className={inputField}
                  placeholder="Ex: Zone A"
                  value={classified_area.name}
                  onChange={(e) => {
                    setClassified_area((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }));
                  }}
                />
              </div>
            </div>

            {/* Description */}
            <div className="flex flex-col">
              <label className="font-bold text-[1rem] mr-auto">
                Description:
              </label>
              <div className={inputWrapper}>
                <Clipboard size={20} className="ml-4 text-green-700" />
                <textarea
                  required
                  className={inputField}
                  value={classified_area.description}
                  onChange={(e) => {
                    setClassified_area((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }));
                  }}
                />
              </div>
            </div>

            {/* Land Classification */}
            <div className="flex flex-col">
              <label className="font-bold text-[1rem] mr-auto">
                Land Classification:
              </label>
              <div className={inputWrapper}>
                <Map size={20} className="ml-4 text-green-700" />
                <select
                  required
                  className={inputField}
                  value={classified_area.land_classification_id}
                  onChange={(e) => {
                    setClassified_area((prev) => ({
                      ...prev,
                      land_classification_id: Number(e.target.value),
                    }));
                  }}
                >
                  {land_classification.map((e, i) => (
                    <option
                      key={e.land_classification_id}
                      value={e.land_classification_id}
                      selected={i === 1}
                    >
                      {e.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="font-bold text-[1rem] mr-auto mb-1">
                Polygon Coordinates
              </label>

              {classified_area.polygon.coordinates.map((element, i) => (
                <div key={i}>
                  <div className="flex">
                    <h1 className="font-bold">No: {i + 1}</h1>
                    {classified_area.polygon.coordinates.length > 1 && (
                      <Trash
                        size={30}
                        className="text-white bg-red-600 rounded-2xl p-2 ml-auto cursor-pointer"
                        onClick={(e) => {
                          e.preventDefault();

                          if (classified_area.polygon.coordinates.length > 1) {
                            setClassified_area((prev) => ({
                              ...prev,
                              polygon: {
                                ...prev.polygon,
                                coordinates: [
                                  ...prev.polygon.coordinates.filter(
                                    (_, il) => il != i,
                                  ),
                                ],
                              },
                            }));
                          }
                        }}
                      />
                    )}
                  </div>
                  <div className="flex gap-3">
                    {/* Coordinate X */}
                    <div className="flex flex-col w-1/2">
                      <label className="text-sm font-medium mb-1">
                        Coordinate X:
                      </label>
                      <div className={inputWrapper}>
                        <Map size={16} className="ml-3 text-green-700" />
                        <input
                          type="number"
                          className={inputField}
                          placeholder="Ex: 10.9695"
                          value={element[1]}
                          onChange={(e) => {
                            setClassified_area((prev) => ({
                              ...prev,
                              polygon: {
                                ...prev.polygon,
                                coordinates: prev.polygon.coordinates.map(
                                  (coord, ind) =>
                                    ind === i
                                      ? [coord[0], Number(e.target.value)]
                                      : coord,
                                ),
                              },
                            }));
                          }}
                        />
                      </div>
                    </div>
                    {/* Coordinate Y */}
                    <div className="flex flex-col w-1/2">
                      <label className="text-sm font-medium mb-1">
                        Coordinate Y:
                      </label>
                      <div className={inputWrapper}>
                        <Map size={16} className="ml-3 text-green-700" />
                        <input
                          type="number"
                          className={inputField}
                          placeholder="Ex: 124.603"
                          value={element[0]}
                          onChange={(e) => {
                            setClassified_area((prev) => ({
                              ...prev,
                              polygon: {
                                ...prev.polygon,
                                coordinates: prev.polygon.coordinates.map(
                                  (coord, ind) =>
                                    ind === i
                                      ? [Number(e.target.value), coord[1]]
                                      : coord,
                                ),
                              },
                            }));
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex w-full gap-3">
              <button
                className="bg-[#0F4A2F] p-2 min-w-30 rounded-lg text-white border border-[#0F4A2F] text-[.8rem] cursor-Map hover:text-[#0F4A2F] hover:bg-[#ffffff] ml-auto"
                onClick={(e) => {
                  e.preventDefault();
                  setClassified_area((prev) => ({
                    ...prev,
                    polygon: {
                      ...prev.polygon,
                      coordinates: [...prev.polygon.coordinates, [1, 1]],
                    },
                  }));
                }}
              >
                Add Coordinate
              </button>
              <button
                className="bg-[#0F4A2F] p-2 min-w-30 rounded-lg text-white border border-[#0F4A2F] text-[.8rem] cursor-Map hover:text-[#0F4A2F] hover:bg-[#ffffff]"
                onClick={(e) => {
                  e.preventDefault();
                  navigate("/maintenance/Classified_areas");
                }}
              >
                Cancel
              </button>
              <button className="bg-[#0F4A2F] min-w-30 p-2 rounded-lg text-white border border-[#0F4A2F] text-[.8rem] cursor-Map hover:text-[#0F4A2F] hover:bg-[#ffffff]">
                Submit
              </button>
            </div>
          </form>

          {/* Right panel */}
          <div className="flex flex-col flex-1">
            {/* upper panel filter & tools */}
            <div className="flex flex-row gap-2  items-center max-h-25 h-[20%]">
              <div className="flex flex-col w-40">
                <label className="font-bold text-[.8rem] mr-auto mb-1">
                  Coordinate X:
                </label>
                <div className={inputWrapper}>
                  <Map size={16} className="ml-4 text-green-700" />

                  <input
                    type="text"
                    className={inputField}
                    placeholder="Ex: 124.603"
                  />
                </div>
              </div>
              <div className="flex flex-col w-40">
                <label className="font-bold text-[.8rem] mr-auto mb-1">
                  Coordinate Y:
                </label>
                <div className={inputWrapper}>
                  <Map size={16} className="ml-4 text-green-700" />
                  <input
                    type="text"
                    className={inputField}
                    placeholder="Ex: 10.9695"
                  />
                </div>
              </div>
              <div className="flex flex-col w-40">
                <label className="font-bold text-[.8rem] mr-auto mb-1">
                  Land Classification
                </label>
                <div className={inputWrapper}>
                  <Map size={20} className="ml-4 text-green-700" />
                  <select className={inputField}>
                    <option value="">Land 1</option>
                    <option value="">Land 2</option>
                    <option value="">Land 3</option>
                    <option value="">Land 4</option>
                  </select>
                </div>
              </div>
              <button
                className="bg-[#0F4A2F] min-w-20 h-11 p-2 mt-auto mb-3 rounded-lg text-white border border-[#0F4A2F] text-[.8rem] cursor-Map hover:text-[#0F4A2F] hover:bg-[#ffffff]"
                onClick={() => {
                  if (!mapRef.current) return;
                  if (classified_area.polygon.coordinates.length === 0) return;

                  mapRef.current.flyTo(
                    classified_area.polygon.coordinates[0],
                    16,
                  );
                }}
              >
                To Polygon
              </button>
            </div>
            {/* lower panel map */}
            <div className="border border-black p-0 flex-1 rounded-lg overflow-hidden">
              <MapContainer
                center={currentPosition}
                zoom={16}
                scrollWheelZoom={true}
                style={{ width: "100%", height: "100%" }}
                ref={(map) => {
                  if (map != null) mapRef.current = map; // <-- TS happy
                }}
              >
                <TileLayer
                  url="http://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
                  attribution='&copy; <a href="https://www.google.com/intl/en/help/terms_maps.html">Google Maps</a>'
                />
                <GoToCenterButton center={currentPosition} />
                <Marker position={currentPosition}>
                  <Popup>Look Up</Popup>
                </Marker>
                <Polygon
                  positions={classified_area.polygon.coordinates}
                  pathOptions={{ color: "green" }}
                >
                  <Popup>Look Upasdasd</Popup>
                </Polygon>
              </MapContainer>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
