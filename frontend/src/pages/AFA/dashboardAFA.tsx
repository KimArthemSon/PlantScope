import { useEffect, useState } from "react";
import SidebarAFA from "../../components/layout/SidebarAFA";
import NotFoundPage from "../../components/layout/NotFoundPage";
import { BarChart3, Activity } from "lucide-react";
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function DashboardAFA() {
  const [isAuthorize, setIsAuthorize] = useState(true);

  const chartData = [
    { month: "Jan", trees: 120 },
    { month: "Feb", trees: 180 },
    { month: "Mar", trees: 150 },
    { month: "Apr", trees: 220 },
    { month: "May", trees: 300 },
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
        if (!(data.user_role === "AFA")) {
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
      <SidebarAFA />

      <main className="flex-1 p-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-green-700 mb-2">Admin / AFA Dashboard</h1>
          <p className="text-gray-600 text-lg">Overview of real-time statistics and activity.</p>
        </div>

        {/* Chart Section */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <BarChart3 size={26} className="text-green-600" />
            <h2 className="text-2xl font-semibold text-gray-800">Tree Planting Progress</h2>
          </div>

          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <Line type="monotone" dataKey="trees" stroke="#16a34a" strokeWidth={3} />
              <CartesianGrid stroke="#e5e7eb" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Additional Dashboard Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-green-600 text-white p-6 rounded-2xl shadow-md">
            <h3 className="text-xl font-bold mb-2">Total Reforestation Sites</h3>
            <p className="text-4xl font-extrabold">42</p>
          </div>

          <div className="bg-blue-600 text-white p-6 rounded-2xl shadow-md">
            <h3 className="text-xl font-bold mb-2">Active Field Officers</h3>
            <p className="text-4xl font-extrabold">17</p>
          </div>

          <div className="bg-purple-600 text-white p-6 rounded-2xl shadow-md">
            <h3 className="text-xl font-bold mb-2">Trees Planted This Month</h3>
            <p className="text-4xl font-extrabold">3,452</p>
          </div>
        </div>

        {/* Activity Log Summary */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mt-8">
          <div className="flex items-center gap-3 mb-4">
            <Activity size={26} className="text-pink-500" />
            <h2 className="text-2xl font-semibold text-gray-800">Recent Activity</h2>
          </div>

          <ul className="text-gray-700 space-y-2">
            <li>• Field Officer Juan D. submitted a site update.</li>
            <li>• New reforestation site created in Barangay X.</li>
            <li>• User Maria P. logged in.</li>
          </ul>
        </div>
      </main>
    </div>
  );
}