import { useEffect, useState } from "react";
import NotFoundPage from "../../components/layout/NotFoundPage";
import SidebarGISS from "../../components/layout/SidebarGISSpecialist";
import {
  ClipboardList,
  MapPin,
  BarChart3,
  FileText,
  LogOut,
  Activity,
  Users,
  PieChart,
} from "lucide-react";

export default function DashboardGISS() {
  const modules = [
    {
      title: "User Management",
      icon: <Users size={24} />,
      description: "Manage Field Officers and other users in the system.",
      color: "from-blue-400 to-blue-600",
      onClick: () => console.log("Navigate to User Management"),
    },
    {
      title: "Site Overview",
      icon: <MapPin size={24} />,
      description: "View all reforestation sites and their status.",
      color: "from-green-400 to-green-600",
      onClick: () => console.log("Navigate to Site Overview"),
    },
    {
      title: "Analytics Dashboard",
      icon: <BarChart3 size={24} />,
      description: "Track overall progress, statistics, and KPIs.",
      color: "from-purple-400 to-purple-600",
      onClick: () => console.log("Navigate to Analytics"),
    },
    {
      title: "Reports",
      icon: <FileText size={24} />,
      description: "Generate detailed reports for analysis.",
      color: "from-yellow-400 to-yellow-600",
      onClick: () => console.log("Navigate to Reports"),
    },
    {
      title: "Activity Log",
      icon: <Activity size={24} />,
      description: "Monitor login and logout activity of users.",
      color: "from-pink-400 to-pink-600",
      onClick: () => console.log("Navigate to Activity Log"),
    },
    {
      title: "Statistics",
      icon: <PieChart size={24} />,
      description: "Visualize data and trends in reforestation progress.",
      color: "from-indigo-400 to-indigo-600",
      onClick: () => console.log("Navigate to Statistics"),
    },
    {
      title: "Logout",
      icon: <LogOut size={24} />,
      description: "Sign out of your account safely.",
      color: "from-red-400 to-red-600",
      onClick: () => console.log("Logout"),
    },
  ];
const[isAuthorize, setIsAuthorize] = useState(true);
  
    useEffect(() => {
          checkIfStillLogin()
        }, []);
      
         const checkIfStillLogin = async () =>{
      
         const token = localStorage.getItem("token");
    
         if(!token){
          return;
         }
                try {
            const response = await fetch("http://127.0.0.1:8000/api/get_me/", {
              method: "POST",
               headers: { Authorization: `Bearer ${token}` },
            });
      
            const data = await response.json();
      
            if (response.ok) {     
                
                if (!(data.user_role === "GISSpecialist")) {
                     setIsAuthorize(false)    
                }
            } 
      
          } catch (error) {
             setIsAuthorize(false)
          }
         } 
    
      if (!localStorage.getItem('token') || !isAuthorize){
         return <NotFoundPage />
      }
  return (
    <div className="flex min-h-screen bg-gray-50">
      <SidebarGISS />

      <main className="flex-1 p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-green-700 mb-2">
            Admin / AFA Dashboard
          </h1>
          <p className="text-gray-600 text-lg">
            Welcome back! Here’s an overview of your modules and actions.
          </p>
        </div>

        {/* Grid Modules */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map((module) => (
            <div
              key={module.title}
              onClick={module.onClick}
              className={`cursor-pointer bg-linear-to-br ${module.color} text-white rounded-2xl shadow-lg p-6 hover:scale-105 hover:shadow-2xl transition transform duration-300 flex flex-col justify-between`}
            >
              <div className="flex items-center gap-3 mb-4">
                {module.icon}
                <h2 className="text-xl font-semibold">{module.title}</h2>
              </div>
              <p className="text-white/90 text-sm">{module.description}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
