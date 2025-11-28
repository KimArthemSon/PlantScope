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
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import logo from "../../assets/logo.png";
import { useState } from "react";
import Logout from "./logout";

const menuItems = [
  {
    name: "Dashboard",
    icon: <LayoutDashboard size={20} />,
    path: "/dashboard/AFA",
  },

  {
    name: "Site & Dataset Management",
    icon: <Layers size={20} />,
    path: "/site-management",
  },

  { name: "Analysis", icon: <BarChart3 size={20} />, path: "/analysis" },
  {
    name: "Site Verification",
    icon: <CheckCircle size={20} />,
    path: "/site-verification",
  },
  {
    name: "Official Planting Sites",
    icon: <TreePine size={20} />,
    path: "/official-planting-sites",
  },
  { name: "Reports", icon: <FileText size={20} />, path: "/reports" },
  { name: "Log Trail", icon: <Satellite size={20} />, path: "/Log-trail" },

];

export default function SidebarAFA() {
  const location = useLocation();
  const[isLogout, setIsLogout] = useState(false);

  function handleLogout(){
     setIsLogout(true);
  }
  return (
    <div className="sticky top-0 h-screen w-[256px] bg-linear-to-b from-[#052e87] to-[#057501] text-white flex flex-col justify-between shadow-2xl">
      {/* Header */}
      {isLogout && <Logout setIsLogout={setIsLogout}/>}
      <div>
        <div className="p-6 flex flex-col items-center border-b border-white/20">
          <img
            src={logo}
            alt="Logo"
            className="w-16 h-16 object-cover rounded-full mb-3 border-2 border-white/50"
          />
          <h1 className="text-2xl font-bold tracking-wide text-center leading-tight">
            PlantScope
          </h1>
          <p className="text-xs text-white/70 text-center mt-1">
            GIS-Enabled Reforestation System
          </p>
        </div>

        {/* Navigation */}
        <nav className="mt-3 flex flex-col space-y-1">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex items-center gap-3 px-6 py-3 text-sm font-medium rounded-md mx-2 transition-all duration-200
                  ${
                    isActive
                      ? "bg-white/25 text-white shadow-inner"
                      : "text-white/80 hover:bg-white/10 hover:text-white"
                  }`}
              >
                {item.icon}
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer */}
      <div className="p-6 border-t border-white/20">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 text-sm text-white/80 hover:text-white hover:bg-white/10 w-full py-2 px-3 rounded-md transition"
        >
          <LogOut size={20} />
          Logout
        </button>
      </div>
    </div>
  );
}
