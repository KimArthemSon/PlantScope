import { useEffect, useState } from "react";
import NotFoundPage from "../../components/layout/NotFoundPage";
import SidebarGISS from "../../components/layout/SidebarGISSpecialist";
import { BarChart3, Activity } from "lucide-react";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function DashboardGISS() {
  const [isAuthorize, setIsAuthorize] = useState(true);

  const chartData = [
    { month: "Jan", sites: 5 },
    { month: "Feb", sites: 8 },
    { month: "Mar", sites: 6 },
    { month: "Apr", sites: 10 },
    { month: "May", sites: 12 },
  ];

  useEffect(() => {
    checkIfStillLogin();
  }, []);

  const checkIfStillLogin = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const response = await fetch("http://127.0.0.1:8000/api/get_me/", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();

      if (response.ok) {
        if (!(data.user_role === "GISSpecialist")) {
          setIsAuthorize(false);
        }
      }
    } catch (error) {
      setIsAuthorize(false);
    }
  };

  if (!localStorage.getItem("token") || !isAuthorize) {
    return <NotFoundPage />;
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <SidebarGISS />

      <main className="flex-1 p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-green-700 mb-2">
            GIS Specialist Dashboard
          </h1>
          <p className="text-gray-600 text-lg">
            Overview of GIS-related activities, site monitoring, and analytics.
          </p>
        </div>

        {/* Chart Section */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <BarChart3 size={26} className="text-green-600" />
            <h2 className="text-2xl font-semibold text-gray-800">Sites Monitored Per Month</h2>
          </div>

          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <Line type="monotone" dataKey="sites" stroke="#16a34a" strokeWidth={3} />
              <CartesianGrid stroke="#e5e7eb" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-blue-600 text-white p-6 rounded-2xl shadow-md">
            <h3 className="text-xl font-bold mb-2">Total Sites</h3>
            <p className="text-4xl font-extrabold">42</p>
          </div>

          <div className="bg-purple-600 text-white p-6 rounded-2xl shadow-md">
            <h3 className="text-xl font-bold mb-2">Active Monitoring Tasks</h3>
            <p className="text-4xl font-extrabold">18</p>
          </div>

          <div className="bg-green-600 text-white p-6 rounded-2xl shadow-md">
            <h3 className="text-xl font-bold mb-2">GIS Reports Generated</h3>
            <p className="text-4xl font-extrabold">26</p>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <Activity size={26} className="text-pink-500" />
            <h2 className="text-2xl font-semibold text-gray-800">Recent Activity</h2>
          </div>

          <ul className="text-gray-700 space-y-2">
            <li>• Added new monitoring data for Site X.</li>
            <li>• Updated site coordinates for Barangay Y.</li>
            <li>• Generated GIS analysis report for Project Z.</li>
          </ul>
        </div>
      </main>
    </div>
  );
}