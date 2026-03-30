// src/components/map/BarangayClassifiedAreas.tsx
import { useEffect, useState, useMemo, useCallback } from "react";
import { Polygon, Popup } from "react-leaflet";

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
    coordinates: [number, number][]; // Your format: [[lat, lng], [lat, lng], ...]
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
          `http://127.0.0.1:8000/api/barangay/${barangayId}/classified-areas/`,
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
      if (!classificationName) return "#ff0000";
      const name = classificationName.toLowerCase();
      if (
        name.includes("forest") ||
        name.includes("protected") ||
        name.includes("conservation")
      )
        return "#22c55e";
      if (name.includes("agricultural") || name.includes("farm"))
        return "#eab308";
      if (
        name.includes("residential") ||
        name.includes("urban") ||
        name.includes("settlement")
      )
        return "#3b82f6";
      if (
        name.includes("restricted") ||
        name.includes("prohibited") ||
        name.includes("no-build")
      )
        return "#ef4444";
      if (name.includes("industrial") || name.includes("commercial"))
        return "#8b5cf6";
      return "#ff0000";
    };
  }, []);

  // ✅ Validate and filter coordinates
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
          // ✅ Handle your exact structure: coordinates is [[lat, lng], [lat, lng], ...]
          if (Array.isArray(area.polygon.coordinates)) {
            // Check if it's nested ([[lat, lng], ...]) or double-nested ([[[lat, lng], ...]])
            if (
              area.polygon.coordinates.length > 0 &&
              Array.isArray(area.polygon.coordinates[0])
            ) {
              if (typeof area.polygon.coordinates[0][0] === "number") {
                // Single nested: [[lat, lng], [lat, lng], ...] ← YOUR FORMAT
                polygonCoords =
                  area.polygon.coordinates.filter(isValidCoordinate);
              } else if (Array.isArray(area.polygon.coordinates[0][0])) {
                // Double nested: [[[lat, lng], [lat, lng], ...]] ← GeoJSON Polygon
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
            `⚠️ Area ${area.classified_area_id} "${area.name}" has only ${polygonCoords.length} valid coordinates. Need at least 3.`,
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
            <Popup minWidth={220} maxWidth={300}>
              <div className="text-sm max-w-[280px]">
                <strong className="text-[#0f4a2f] block mb-2 border-b border-gray-200 pb-1 text-base">
                  {area.name}
                </strong>

                {area.land_classification && (
                  <div className="mb-2">
                    <span className="text-gray-600 font-medium">
                      Classification:
                    </span>{" "}
                    <span className="font-semibold text-gray-800 ml-1">
                      {area.land_classification.name}
                    </span>
                  </div>
                )}

                {area.description && (
                  <div className="mb-2">
                    <span className="text-gray-600 font-medium">
                      Description:
                    </span>
                    <p className="text-gray-700 mt-1 text-xs leading-relaxed break-words">
                      {area.description}
                    </p>
                  </div>
                )}

                {area.created_at && (
                  <div className="mb-2 text-xs text-gray-500">
                    Added: {new Date(area.created_at).toLocaleDateString()}
                  </div>
                )}

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                  }}
                  className="mt-2 text-xs text-red-600 hover:text-red-800 underline font-medium transition-colors"
                >
                  Hide this layer
                </button>
              </div>
            </Popup>
          </Polygon>
        );
      })}
    </>
  );
}
