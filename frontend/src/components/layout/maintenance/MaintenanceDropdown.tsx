import {
  ClipboardList,
  Layers,
  TreePine,
  Mountain,
  ChevronLeft,
  Map,
  Box,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";

interface MaintenanceDropdownProps {
  expanded: boolean;
  maintenanceOpen: boolean;
  setMaintenanceOpen: (open: boolean) => void;
}

export default function MaintenanceDropdown({
  expanded,
  maintenanceOpen,
  setMaintenanceOpen,
}: MaintenanceDropdownProps) {
  const location = useLocation();

  // Helper to check if any maintenance sub-route is active
  const isMaintenanceActive = [
    "/maintenance/land-classification",
    "/maintenance/tree-species",
    "/maintenance/soils",
    "/maintenance/Classified_areas",
  ].some((path) => location.pathname.startsWith(path));

  return (
    <div className="relative">
      <button
        onClick={() => setMaintenanceOpen(!maintenanceOpen)}
        className={`
          w-full flex flex-row items-center transition-all duration-200 rounded-md
          px-6 py-3 justify-center
          ${
            isMaintenanceActive
              ? "bg-white/25 text-white shadow-inner"
              : "text-white/80 hover:bg-white/10 hover:text-white"
          }
        `}
      >
        <span className="mr-auto">
          <Box size={20} />
        </span>
        <span
          className={`
            flex text-[.8rem] overflow-hidden tracking-wide leading-tight transition-all whitespace-nowrap duration-600 ease-in-out mr-auto flex-1
            ${expanded ? "ml-3 w-auto opacity-100" : "w-0 ml-0 opacity-0"}
          `}
        >
          Maintenance
        </span>
        {expanded && (
          <ChevronLeft
            size={16}
            className={`transition-transform duration-200 ${
              maintenanceOpen ? "rotate-90" : "-rotate-90"
            }`}
          />
        )}
      </button>

      {/* Dropdown Content */}
      {expanded && maintenanceOpen && (
        <div className="mt-2 ml-6 space-y-1">
          <Link
            to="/maintenance/barangays"
            className={`
              flex items-center gap-3 px-4 py-3 text-[.75rem] rounded-md
              ${
                location.pathname === "/maintenance/barangays"
                  ? "bg-white/20 text-white"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }
            `}
          >
            <ClipboardList size={16} />
            <span>Barangay</span>
          </Link>
          <Link
            to="/maintenance/tree-species"
            className={`
              flex items-center gap-3 px-4 py-3 text-[.75rem] rounded-md
              ${
                location.pathname === "/maintenance/tree-species"
                  ? "bg-white/20 text-white"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }
            `}
          >
            <TreePine size={16} />
            <span>Tree Species</span>
          </Link>

          <Link
            to="/maintenance/soils"
            className={`
              flex items-center gap-3 px-4 py-3 text-[.75rem] rounded-md
              ${
                location.pathname === "/maintenance/soils"
                  ? "bg-white/20 text-white"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }
            `}
          >
            <Mountain size={16} />
            <span>Soils</span>
          </Link>
          <Link
            to="/maintenance/land-classification"
            className={`
              flex items-center gap-3 px-4 py-3 text-[.75rem] rounded-md
              ${
                location.pathname === "/maintenance/land-classification"
                  ? "bg-white/20 text-white"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }
            `}
          >
            <Layers size={16} />
            <span>Land Classification</span>
          </Link>
          <Link
            to="/maintenance/Classified_areas"
            className={`
              flex items-center gap-3 px-4 py-3 text-[.75rem] rounded-md
              ${
                location.pathname === "/maintenance/Classified_areas"
                  ? "bg-white/20 text-white"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }
            `}
          >
            <Map size={16} />
            <span>Classified Areas</span>
          </Link>
        </div>
      )}
    </div>
  );
}
