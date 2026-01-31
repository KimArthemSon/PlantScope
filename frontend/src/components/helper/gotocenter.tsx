import { useMap } from "react-leaflet";

export default function GoToCenterButton({
  center,
}: {
  center: [number, number];
}) {
  const map = useMap();

  return (
    <button
      onClick={() => map.flyTo(center, 16)}
      className="absolute top-3 right-3 z-[1000]
                 bg-white px-3 py-2 rounded shadow"
    >
      Go to center
    </button>
  );
}