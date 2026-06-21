// src/components/map/BarangayClassifiedAreas.tsx
import { useEffect, useState, useMemo, useCallback } from "react";
import { Polygon, Popup } from "react-leaflet";
import { Info, MapPin, X, Layers } from "lucide-react";
import { api } from "@/constant/api.ts";

export interface LandClassification {
  id: number;
  name: string;
}

export interface ClassifiedArea {
  classified_area_id: number;
  name: string;
  description: string;
  land_classification: LandClassification | null;
  polygon: {
    type: string;
    coordinates: [number, number][];
  };
  created_at: string | null;
}

interface BarangayClassifiedAreasProps {
  barangayId: number | null;
  token: string | null;
  onClose: () => void;
  onStatusChange?: (status: {
    loading: boolean;
    error: string | null;
    count: number;
  }) => void;
}

export default function BarangayClassifiedAreas({
  barangayId,
  token,
  onClose,
  onStatusChange,
}: BarangayClassifiedAreasProps) {
  const [classifiedAreas, setClassifiedAreas] = useState<ClassifiedArea[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const notifyStatus = useCallback(
    (load: boolean, err: string | null, count: number) => {
      onStatusChange?.({ loading: load, error: err, count });
    },
    [onStatusChange],
  );

  useEffect(() => {
    setClassifiedAreas([]);
    setError(null);

    if (!barangayId) {
      setLoading(false);
      notifyStatus(false, null, 0);
      return;
    }

    const fetchClassifiedAreas = async () => {
      setLoading(true);
      notifyStatus(true, null, 0);

      try {
        const res = await fetch(
          api+`api/barangay/${barangayId}/classified-areas/`,
          {
            headers: {
              Authorization: token ? `Bearer ${token}` : "",
            },
          },
        );

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(
            errData.error ||
              `HTTP ${res.status}: Failed to fetch classified areas`,
          );
        }

        const data = await res.json();

        if (data.success && Array.isArray(data.data)) {
          setClassifiedAreas(data.data);
          notifyStatus(false, null, data.data.length);
        } else {
          throw new Error(data.error || "Invalid response format");
        }
      } catch (err: any) {
        console.error("Error fetching classified areas:", err);
        const errorMsg = err.message || "Failed to load classified areas";
        setError(errorMsg);
        setClassifiedAreas([]);
        notifyStatus(false, errorMsg, 0);
      } finally {
        setLoading(false);
      }
    };

    fetchClassifiedAreas();

    return () => {
      setClassifiedAreas([]);
      setError(null);
      setLoading(false);
    };
  }, [barangayId, token, notifyStatus]);

  const getClassificationColor = useMemo(() => {
    return (classificationName: string | null): string => {
      if (!classificationName) return "#dc2626";
      const name = classificationName.toLowerCase();
      if (
        name.includes("forest") ||
        name.includes("protected") ||
        name.includes("conservation")
      )
        return "#16a34a";
      if (name.includes("agricultural") || name.includes("farm"))
        return "#eab308";
      if (
        name.includes("residential") ||
        name.includes("urban") ||
        name.includes("settlement")
      )
        return "#2563eb";
      if (
        name.includes("restricted") ||
        name.includes("prohibited") ||
        name.includes("no-build")
      )
        return "#dc2626";
      if (name.includes("industrial") || name.includes("commercial"))
        return "#7c3aed";
      return "#dc2626";
    };
  }, []);

  const isValidCoordinate = (coord: [number, number]): boolean => {
    const [lat, lng] = coord;
    return (
      coord.length === 2 &&
      !isNaN(lat) &&
      !isNaN(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180
    );
  };

  if (!barangayId) return null;
  if (loading) return null;
  if (error) return null;
  if (classifiedAreas.length === 0) return null;

  return (
    <>
      {classifiedAreas.map((area) => {
        let polygonCoords: [number, number][] = [];

        try {
          if (Array.isArray(area.polygon.coordinates)) {
            if (
              area.polygon.coordinates.length > 0 &&
              Array.isArray(area.polygon.coordinates[0])
            ) {
              if (typeof area.polygon.coordinates[0][0] === "number") {
                polygonCoords =
                  area.polygon.coordinates.filter(isValidCoordinate);
              } else if (Array.isArray(area.polygon.coordinates[0][0])) {
                polygonCoords =
                  area.polygon.coordinates[0].filter(isValidCoordinate);
              }
            }
          }
        } catch (err) {
          console.error(
            `Error parsing polygon for area ${area.classified_area_id}:`,
            err,
          );
        }

        if (polygonCoords.length < 3) {
          console.warn(
            `⚠️ Area ${area.classified_area_id} "${area.name}" has only ${polygonCoords.length} valid coordinates.`,
          );
          return null;
        }

        const color = getClassificationColor(
          area.land_classification?.name || null,
        );

        return (
          <Polygon
            key={`classified-${area.classified_area_id}`}
            positions={polygonCoords}
            pathOptions={{
              color: color,
              weight: 2,
              fillColor: color,
              fillOpacity: 0.35,
            }}
            eventHandlers={{
              mouseover: (e) => {
                const layer = e.target;
                layer.setStyle({ weight: 4, fillOpacity: 0.6 });
              },
              mouseout: (e) => {
                const layer = e.target;
                layer.setStyle({ weight: 2, fillOpacity: 0.35 });
              },
            }}
          >
            <Popup minWidth={240} maxWidth={320}>
              <div className="text-sm min-w-[220px]">
                {/* Header with color indicator */}
                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-200">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: color }}
                  ></div>
                  <strong className="text-base text-gray-800 flex-1">
                    {area.name}
                  </strong>
                </div>

                <div className="space-y-1.5 text-xs">
                  {/* Classification Badge */}
                  {area.land_classification && (
                    <div className="flex items-start gap-2">
                      <Layers
                        size={14}
                        className="text-gray-500 mt-0.5 flex-shrink-0"
                      />
                      <div className="flex-1">
                        <span className="text-gray-500">Classification:</span>
                        <span
                          className="ml-1 font-semibold px-2 py-0.5 rounded text-white text-[10px]"
                          style={{ backgroundColor: color }}
                        >
                          {area.land_classification.name}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Description */}
                  {area.description && (
                    <div className="flex items-start gap-2">
                      <Info
                        size={14}
                        className="text-gray-500 mt-0.5 flex-shrink-0"
                      />
                      <div className="flex-1">
                        <span className="text-gray-500">Description:</span>
                        <p className="mt-0.5 text-gray-600 text-[11px] leading-relaxed break-words">
                          {area.description}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Created Date */}
                  {area.created_at && (
                    <div className="flex items-start gap-2 pt-1 border-t border-gray-100 mt-2">
                      <span className="text-gray-400 text-[10px]">
                        Added: {new Date(area.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Hide Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                  }}
                  className="mt-3 w-full flex items-center justify-center gap-1 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold py-1.5 px-2 rounded transition-colors"
                >
                  <X size={12} /> Hide Classified Areas
                </button>
              </div>
            </Popup>
          </Polygon>
        );
      })}
    </>
  );
}
