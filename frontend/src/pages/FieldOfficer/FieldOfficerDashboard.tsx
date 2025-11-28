import SidebarFO from "../../components/layout/SidebarFO";
import { ClipboardList, MapPin, BarChart3, FileText, LogOut, Activity } from "lucide-react";

export default function FieldOfficerDashboard() {
  const modules = [
    {
      title: "Log In",
      icon: <ClipboardList size={24} />,
      description: "Access your account and authentication tools.",
      color: "from-green-400 to-green-600",
      onClick: () => console.log("Navigate to Log In"),
    },
    {
      title: "Dashboard",
      icon: <BarChart3 size={24} />,
      description: "View overall statistics and activity summary.",
      color: "from-blue-400 to-blue-600",
      onClick: () => console.log("Navigate to Dashboard"),
    },
    {
      title: "Field Survey Module",
      icon: <MapPin size={24} />,
      description: "Conduct on-site surveys and submit collected information.",
      color: "from-purple-400 to-purple-600",
      onClick: () => console.log("Navigate to Field Survey"),
    },
    {
      title: "Reports",
      icon: <FileText size={24} />,
      description: "Generate and view field officer reports.",
      color: "from-yellow-400 to-yellow-600",
      onClick: () => console.log("Navigate to Reports"),
    },
    {
      title: "Monitoring Module",
      icon: <Activity size={24} />,
      description: "Track reforestation progress and site conditions.",
      color: "from-pink-400 to-pink-600",
      onClick: () => console.log("Navigate to Monitoring"),
    },
    {
      title: "Logout",
      icon: <LogOut size={24} />,
      description: "Sign out of your Field Officer account.",
      color: "from-red-400 to-red-600",
      onClick: () => console.log("Logout"),
    },
  ];

  return (
    <div className="flex min-h-screen bg-gray-50">
      <SidebarFO />

      <main className="flex-1 p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-green-700 mb-2">
            Field Officer Dashboard
          </h1>
          <p className="text-gray-600 text-lg">
            Welcome back! Here are your modules and quick actions.
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
