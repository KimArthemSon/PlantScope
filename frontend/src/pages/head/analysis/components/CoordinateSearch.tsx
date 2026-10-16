import { useEffect, useRef, useState } from "react";
import { Crosshair, Navigation, X } from "lucide-react";

interface CoordinateSearchProps {
  onGo: (lat: number, lng: number) => void;
}

// Accepts "11.0086, 124.6086" (or space-separated) pasted into either field
const splitPair = (value: string): [string, string] | null => {
  const parts = value.trim().split(/[\s,;]+/).filter(Boolean);
  return parts.length === 2 ? [parts[0], parts[1]] : null;
};

export default function CoordinateSearch({ onGo }: CoordinateSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const latInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    latInputRef.current?.focus();
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      )
        setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleChange = (field: "lat" | "lng", value: string) => {
    setError(null);
    const pair = splitPair(value);
    if (pair) {
      setLat(pair[0]);
      setLng(pair[1]);
      return;
    }
    if (field === "lat") setLat(value);
    else setLng(value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    if (isNaN(latNum) || isNaN(lngNum)) {
      setError("Enter both latitude and longitude.");
      return;
    }
    if (latNum < -90 || latNum > 90) {
      setError("Latitude must be between -90 and 90.");
      return;
    }
    if (lngNum < -180 || lngNum > 180) {
      setError("Longitude must be between -180 and 180.");
      return;
    }
    onGo(latNum, lngNum);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className={`flex items-center gap-1 px-3 py-1.5 rounded transition text-xs font-medium ${
          isOpen
            ? "bg-indigo-600 hover:bg-indigo-700 text-white"
            : "bg-gray-100 hover:bg-gray-200 text-gray-700"
        }`}
        title="Go to a latitude / longitude"
      >
        <Crosshair size={12} /> Go to Coordinate
      </button>

      {isOpen && (
        <form
          onSubmit={handleSubmit}
          className="absolute left-0 top-full mt-2 z-[1100] w-72 bg-white rounded-lg shadow-xl border border-gray-200 p-3"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
              <Crosshair size={13} className="text-indigo-600" /> Search by
              Coordinate
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-gray-600 p-0.5 rounded"
            >
              <X size={14} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-gray-600 font-semibold uppercase">
                Latitude
              </label>
              <input
                ref={latInputRef}
                type="text"
                inputMode="decimal"
                value={lat}
                onChange={(e) => handleChange("lat", e.target.value)}
                placeholder="11.0086"
                className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-600 font-semibold uppercase">
                Longitude
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={lng}
                onChange={(e) => handleChange("lng", e.target.value)}
                placeholder="124.6086"
                className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <p className="text-[10px] text-gray-400 mt-1.5">
            Tip: paste "lat, lng" into either field.
          </p>
          {error && (
            <p className="text-[11px] text-red-600 font-medium mt-1">{error}</p>
          )}

          <button
            type="submit"
            className="w-full mt-2 flex items-center justify-center gap-1.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded transition"
          >
            <Navigation size={12} /> Go
          </button>
        </form>
      )}
    </div>
  );
}
