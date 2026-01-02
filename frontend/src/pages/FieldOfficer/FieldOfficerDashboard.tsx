import { useEffect, useState } from "react";
import NotFoundPage from "../../components/layout/NotFoundPage";
import SidebarFO from "../../components/layout/SidebarFO";
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

export default function FieldOfficerDashboard() {
  const [isAuthorize, setIsAuthorize] = useState(true);

  const chartData = [
    { month: "Jan", surveys: 12 },
    { month: "Feb", surveys: 18 },
    { month: "Mar", surveys: 14 },
    { month: "Apr", surveys: 20 },
    { month: "May", surveys: 27 },
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
        if (!(data.user_role === "FieldOfficer")) {
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
      <SidebarFO />

      <main className="flex-1 p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-green-700 mb-2">
            Field Officer Dashboard
          </h1>
          <p className="text-gray-600 text-lg">
            Overview of your field activity, surveys, and monitoring tasks.
          </p>
        </div>

        {/* Chart Section */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <BarChart3 size={26} className="text-green-600" />
            <h2 className="text-2xl font-semibold text-gray-800">Monthly Surveys Completed</h2>
          </div>

          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <Line type="monotone" dataKey="surveys" stroke="#15803d" strokeWidth={3} />
              <CartesianGrid stroke="#e5e7eb" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-green-600 text-white p-6 rounded-2xl shadow-md">
            <h3 className="text-xl font-bold mb-2">Total Surveys Submitted</h3>
            <p className="text-4xl font-extrabold">128</p>
          </div>

          <div className="bg-blue-600 text-white p-6 rounded-2xl shadow-md">
            <h3 className="text-xl font-bold mb-2">Active Assignments</h3>
            <p className="text-4xl font-extrabold">6</p>
          </div>

          <div className="bg-purple-600 text-white p-6 rounded-2xl shadow-md">
            <h3 className="text-xl font-bold mb-2">Sites Visited This Month</h3>
            <p className="text-4xl font-extrabold">21</p>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <Activity size={26} className="text-pink-500" />
            <h2 className="text-2xl font-semibold text-gray-800">Recent Activity</h2>
          </div>

          <ul className="text-gray-700 space-y-2">
            <li>• Submitted monitoring update for Site A.</li>
            <li>• Completed survey for Barangay San Mateo.</li>
            <li>• Uploaded new site photos for Project 3.</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
