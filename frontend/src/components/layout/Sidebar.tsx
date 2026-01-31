import {
  LayoutDashboard,
  Satellite,
  Layers,
  BarChart3,
  ClipboardList,
  CheckCircle,
  TreePine,
  FileText,
  Users,
  LogOut,
  ChevronLeft,
  Mountain,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import logo from "../../assets/logo.png";
import { useState } from "react";
import Logout from "./logout";
import { Outlet } from "react-router-dom";
import PlantScopeLoader from "../alert/PlantScopeLoader";
import NotFoundPage from "./NotFoundPage";
import { useAuthorize } from "../../hooks/authorization";
import { useNavigate } from "react-router-dom";

// ✅ Import the MaintenanceDropdown component
import MaintenanceDropdown from "./maintenance/MaintenanceDropdown";

// ✅ Import your custom scrollbar styles
import "../../global css/sidebarScrollbar.css";

export default function Sidebar() {
  const location = useLocation();
  const [isLogout, setIsLogout] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);
  const navigate = useNavigate();

  const { isAuthorized, isLoading } = useAuthorize("CityENROHead");

  if (isLoading) {
    return <PlantScopeLoader />;
  }

  if (!localStorage.getItem("token")) {
    navigate("/Login");
    return null;
  }

  if (!isAuthorized) {
    return <NotFoundPage />;
  }

  function handleLogout() {
    setIsLogout(true);
  }

  return (
    <div className="flex">
      <Logout setIsLogout={setIsLogout} isLogout={isLogout} />

      {/* Sidebar */}
      <div
        className={`sticky top-0 p-1 pt-0 pb-0 h-screen bg-[#0F4A2F] text-white flex flex-col justify-between shadow-2xl transition-normal duration-500 ease-in-out ${
          expanded ? "p-2 w-[226px] min-w-[226px]" : "p-1 w-[88px] min-w-[88px]"
        }`}
      >
        {/* Header */}
        <div className="p-4 gap-2 mb-2 flex flex-row items-center border-b border-white/20">
          <img
            src={logo}
            alt="Logo"
            className="w-12 h-12 object-cover rounded-full border-2 border-white/50 cursor-pointer"
            onClick={() => setExpanded(!expanded)}
          />
          <h1
            className={`text-[.8rem] font-bold tracking-wide leading-tight overflow-hidden transition-all`}
          >
            PlantScope
          </h1>
          <div className="flex-1" />
          <button
            className={`p-2 rounded-[5px] hover:bg-white/10 bg-[#0f4a2fe0] cursor-pointer overflow-hidden transition-all ${
              !expanded && "opacity-0"
            }`}
            onClick={() => setExpanded(!expanded)}
          >
            <ChevronLeft size={18} />
          </button>
        </div>

        {/* Navigation — now with custom scrollbar class */}
        <div className="flex-1 p-1 overflow-x-hidden flex flex-col">
          <nav className="mt-1 gap-1 flex flex-col sidebar-scrollbar flex-1">
            {/* Dashboard */}
            <Link
              to="/dashboard"
              className={`
                flex flex-row items-center transition-all duration-200 rounded-md
                px-6 py-3 justify-center
                ${
                  location.pathname === "/dashboard"
                    ? "bg-white/25 text-white shadow-inner"
                    : "text-white/80 hover:bg-white/10 hover:text-white"
                }
              `}
            >
              <span className="mr-auto">
                <LayoutDashboard size={20} />
              </span>
              <span
                className={`
                  text-[.8rem] overflow-hidden tracking-wide leading-tight transition-all whitespace-nowrap duration-600 ease-in-out mr-auto flex-1
                  ${expanded ? "ml-3 w-auto opacity-100" : "w-0 ml-0 opacity-0"}
                `}
              >
                Dashboard
              </span>
            </Link>

            {/* Field Selection */}
            <Link
              to="/field-data"
              className={`
                flex flex-row items-center transition-all duration-200 rounded-md
                px-6 py-3 justify-center
                ${
                  location.pathname === "/field-data"
                    ? "bg-white/25 text-white shadow-inner"
                    : "text-white/80 hover:bg-white/10 hover:text-white"
                }
              `}
            >
              <span className="mr-auto">
                <ClipboardList size={20} />
              </span>
              <span
                className={`
                  text-[.8rem] overflow-hidden tracking-wide leading-tight transition-all whitespace-nowrap duration-600 ease-in-out mr-auto flex-1
                  ${expanded ? "ml-3 w-auto opacity-100" : "w-0 ml-0 opacity-0"}
                `}
              >
                Field Selection
              </span>
            </Link>

            {/* Maintenance Dropdown */}
            <MaintenanceDropdown
              expanded={expanded}
              maintenanceOpen={maintenanceOpen}
              setMaintenanceOpen={setMaintenanceOpen}
            />

            {/* Site */}
            <Link
              to="/site-management"
              className={`
                flex flex-row items-center transition-all duration-200 rounded-md
                px-6 py-3 justify-center
                ${
                  location.pathname === "/site-management"
                    ? "bg-white/25 text-white shadow-inner"
                    : "text-white/80 hover:bg-white/10 hover:text-white"
                }
              `}
            >
              <span className="mr-auto">
                <Layers size={20} />
              </span>
              <span
                className={`
                  text-[.8rem] overflow-hidden tracking-wide leading-tight transition-all whitespace-nowrap duration-600 ease-in-out mr-auto flex-1
                  ${expanded ? "ml-3 w-auto opacity-100" : "w-0 ml-0 opacity-0"}
                `}
              >
                Site
              </span>
            </Link>

            {/* Analysis */}
            <Link
              to="/analysis"
              className={`
                flex flex-row items-center transition-all duration-200 rounded-md
                px-6 py-3 justify-center
                ${
                  location.pathname === "/analysis"
                    ? "bg-white/25 text-white shadow-inner"
                    : "text-white/80 hover:bg-white/10 hover:text-white"
                }
              `}
            >
              <span className="mr-auto">
                <BarChart3 size={20} />
              </span>
              <span
                className={`
                  text-[.8rem] overflow-hidden tracking-wide leading-tight transition-all whitespace-nowrap duration-600 ease-in-out mr-auto flex-1
                  ${expanded ? "ml-3 w-auto opacity-100" : "w-0 ml-0 opacity-0"}
                `}
              >
                Analysis
              </span>
            </Link>

            {/* Site Verification */}
            <Link
              to="/site-verification"
              className={`
                flex flex-row items-center transition-all duration-200 rounded-md
                px-6 py-3 justify-center
                ${
                  location.pathname === "/site-verification"
                    ? "bg-white/25 text-white shadow-inner"
                    : "text-white/80 hover:bg-white/10 hover:text-white"
                }
              `}
            >
              <span className="mr-auto">
                <CheckCircle size={20} />
              </span>
              <span
                className={`
                  text-[.8rem] overflow-hidden tracking-wide leading-tight transition-all whitespace-nowrap duration-600 ease-in-out mr-auto flex-1
                  ${expanded ? "ml-3 w-auto opacity-100" : "w-0 ml-0 opacity-0"}
                `}
              >
                Site Verification
              </span>
            </Link>

            {/* Official Sites */}
            <Link
              to="/official-planting-sites"
              className={`
                flex flex-row items-center transition-all duration-200 rounded-md
                px-6 py-3 justify-center
                ${
                  location.pathname === "/official-planting-sites"
                    ? "bg-white/25 text-white shadow-inner"
                    : "text-white/80 hover:bg-white/10 hover:text-white"
                }
              `}
            >
              <span className="mr-auto">
                <TreePine size={20} />
              </span>
              <span
                className={`
                  text-[.8rem] overflow-hidden tracking-wide leading-tight transition-all whitespace-nowrap duration-600 ease-in-out mr-auto flex-1
                  ${expanded ? "ml-3 w-auto opacity-100" : "w-0 ml-0 opacity-0"}
                `}
              >
                Official Sites
              </span>
            </Link>

            {/* Reports */}
            <Link
              to="/reports"
              className={`
                flex flex-row items-center transition-all duration-200 rounded-md
                px-6 py-3 justify-center
                ${
                  location.pathname === "/reports"
                    ? "bg-white/25 text-white shadow-inner"
                    : "text-white/80 hover:bg-white/10 hover:text-white"
                }
              `}
            >
              <span className="mr-auto">
                <FileText size={20} />
              </span>
              <span
                className={`
                  text-[.8rem] overflow-hidden tracking-wide leading-tight transition-all whitespace-nowrap duration-600 ease-in-out mr-auto flex-1
                  ${expanded ? "ml-3 w-auto opacity-100" : "w-0 ml-0 opacity-0"}
                `}
              >
                Reports
              </span>
            </Link>

            {/* Log Trail */}
            <Link
              to="/Log-trail"
              className={`
                flex flex-row items-center transition-all duration-200 rounded-md
                px-6 py-3 justify-center
                ${
                  location.pathname === "/Log-trail"
                    ? "bg-white/25 text-white shadow-inner"
                    : "text-white/80 hover:bg-white/10 hover:text-white"
                }
              `}
            >
              <span className="mr-auto">
                <Satellite size={20} />
              </span>
              <span
                className={`
                  text-[.8rem] overflow-hidden tracking-wide leading-tight transition-all whitespace-nowrap duration-600 ease-in-out mr-auto flex-1
                  ${expanded ? "ml-3 w-auto opacity-100" : "w-0 ml-0 opacity-0"}
                `}
              >
                Log Trail
              </span>
            </Link>

            {/* Accounts */}
            <Link
              to="/account-management"
              className={`
                flex flex-row items-center transition-all duration-200 rounded-md
                px-6 py-3 justify-center
                ${
                  location.pathname === "/account-management"
                    ? "bg-white/25 text-white shadow-inner"
                    : "text-white/80 hover:bg-white/10 hover:text-white"
                }
              `}
            >
              <span className="mr-auto">
                <Users size={20} />
              </span>
              <span
                className={`
                  text-[.8rem] overflow-hidden tracking-wide leading-tight transition-all whitespace-nowrap duration-600 ease-in-out mr-auto flex-1
                  ${expanded ? "ml-3 w-auto opacity-100" : "w-0 ml-0 opacity-0"}
                `}
              >
                Accounts
              </span>
            </Link>
          </nav>
        </div>

        {/* Footer - Logout */}
        <div className="border-t border-white/20">
          <button
            onClick={handleLogout}
            className={`flex items-center gap-3 text-sm text-white/80 p-6 hover:text-white hover:bg-white/10 w-full rounded-md cursor-pointer transition-all duration-500 ease-in-out`}
          >
            <LogOut className="mr-auto" size={20} />
            {expanded && (
              <span
                className={`
                  text-[.8rem] overflow-hidden transition-all duration-300 ease-in-out mr-auto flex-1
                  ${expanded ? "w-auto opacity-100" : "w-0 ml-0 opacity-0"}
                `}
              >
                Logout
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 items-center overflow-y-auto overflow-x-auto bg-[rgba(255,255,255,0.1)]">
        <Outlet />
      </main>
    </div>
  );
}
